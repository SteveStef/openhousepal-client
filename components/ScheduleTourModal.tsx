'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { backdropMotion, useEscapeToClose, useIsPhone, useLastValue, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, Moon, Send, Sun, Sunrise, X } from 'lucide-react'
import { Property, TourRequest } from '@/types'
import { cleanAddress, normalizeImageUrl } from '@/lib/utils'

interface ScheduleTourModalProps {
  property: Property | null
  isOpen: boolean
  onClose: () => void
  /** Sends the request. Throw (or reject) when it didn't go - the window shows the problem and
   *  stays open; on success it plays its "sent" moment and closes itself. */
  onSubmit: (data: TourRequest) => Promise<void>
  showContactFields?: boolean
  // Pre-filled contact fields (e.g. a Guest Pass - they already gave these at sign-in). Still editable.
  initialName?: string
  initialContact?: string
  /** The agent's busy blocks from their connected Google / Outlook calendar - those times are
   *  crossed out. Omitted (or none connected) = every time is open. */
  loadBusy?: () => Promise<{ start: string; end: string }[]>
  /** 'full' asks for name, email AND phone separately (all required - the Schedule a Showing
   *  form); default 'compact' is name + "phone or email". Email goes out as visitorContact. */
  contactStyle?: 'compact' | 'full'
  /** How many times they can offer (default 3). */
  maxPicks?: number
}

// ---------------------------------------------------------------- dates & times

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const timeLabel = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}
const dayLabel = (s: string, long = false) => {
  const d = parseYmd(s)
  const today = ymd(new Date())
  const tomorrow = ymd(new Date(Date.now() + 86400000))
  if (s === today) return 'Today'
  if (s === tomorrow) return 'Tomorrow'
  return d.toLocaleDateString('en-US', long ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' })
}

// Tours run 7 AM - 9 PM in half hours, in three parts of the day.
const slots = (from: number, to: number) => {
  const out: string[] = []
  for (let h = from; h <= to; h++) for (const m of [0, 30]) if (h * 60 + m <= 21 * 60) out.push(`${pad(h)}:${pad(m)}`)
  return out
}
const PERIODS = [
  { id: 'morning', label: 'Morning', icon: Sunrise, times: slots(7, 11) },
  { id: 'afternoon', label: 'Afternoon', icon: Sun, times: slots(12, 16) },
  { id: 'evening', label: 'Evening', icon: Moon, times: slots(17, 21) },
] as const
const TIMES = PERIODS.flatMap(p => [...p.times])

// A slot is gone when it's today and already past (no "today at 9am" at 3pm).
const isPast = (date: string, time: string) => {
  if (date !== ymd(new Date())) return false
  const [h, m] = time.split(':').map(Number)
  const now = new Date()
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes()
}

type Pick = { date: string; time: string }
type Step = 'when' | 'you' | 'done'

// ---------------------------------------------------------------- the window

// "Schedule a showing" as a short, animated flow that never needs scrolling: the home on a lit
// photo panel, then (1) tap a day and up to three times, (2) who you are + an optional note,
// (3) a "sent" moment that closes the window on its own. Used by the Showcase and the Listing Page.
function ScheduleTourWindow({
  property,
  onClose,
  onSubmit,
  showContactFields = false,
  initialName = '',
  initialContact = '',
  loadBusy,
  contactStyle = 'compact',
  maxPicks = 3,
}: ScheduleTourModalProps & { property: NonNullable<ScheduleTourModalProps['property']> }) {
  // The agent's busy blocks (ms), read once when the window opens.
  const [busy, setBusy] = useState<[number, number][]>([])
  useEffect(() => {
    if (!loadBusy) return
    let alive = true
    loadBusy().then(list => {
      if (alive) setBusy((list || []).map(b => [Date.parse(b.start), Date.parse(b.end)] as [number, number]).filter(([a, b]) => a < b))
    }).catch(() => {})
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // A half-hour showing that would overlap something on the agent's calendar.
  const isBusy = (date: string, time: string) => {
    if (!busy.length) return false
    const [h, m] = time.split(':').map(Number)
    const d = parseYmd(date)
    d.setHours(h, m, 0, 0)
    const a = d.getTime(), b = a + 30 * 60000
    return busy.some(([s, e]) => s < b && e > a)
  }
  // The next 8 days (today only while there's still a time left in it) - one row, no scrolling.
  const openDays = useMemo(() => Array.from({ length: 9 }, (_, i) => ymd(new Date(Date.now() + i * 86400000)))
    .filter(d => TIMES.some(t => !isPast(d, t))).slice(0, 8), [])
  const [day, setDay] = useState(openDays[0])
  const firstOpen = (d: string) => (PERIODS.find(p => p.times.some(t => !isPast(d, t))) || PERIODS[0]).id
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>(() => firstOpen(openDays[0]))
  // Today late in the day: jump past the parts of it that are over.
  useEffect(() => {
    if (!PERIODS.find(p => p.id === period)!.times.some(t => !isPast(day, t))) setPeriod(firstOpen(day))
  }, [day]) // eslint-disable-line react-hooks/exhaustive-deps
  const [picks, setPicks] = useState<Pick[]>([])
  const [step, setStep] = useState<Step>('when')
  const [dir, setDir] = useState(1)
  const [name, setName] = useState(initialName)
  const [contact, setContact] = useState(initialContact)
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  useEscapeToClose(onClose, !sending)
  const sheetMotion = useSheetMotion()
  const isPhone = useIsPhone()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, isPhone && !sending)
  const [error, setError] = useState('')

  // Closes itself a moment after the request went through.
  useEffect(() => {
    if (step !== 'done') return
    const t = window.setTimeout(onClose, 2600)
    return () => window.clearTimeout(t)
  }, [step, onClose])

  const go = (s: Step) => { setDir(s === 'when' ? -1 : 1); setStep(s); setError('') }
  const toggle = (time: string) => {
    setPicks(cur => {
      const at = cur.findIndex(p => p.date === day && p.time === time)
      if (at > -1) return cur.filter((_, i) => i !== at)
      if (cur.length >= maxPicks) return [...cur.slice(0, maxPicks - 1), { date: day, time }]
      return [...cur, { date: day, time }]
    })
  }

  const photo = property.ListPictureURL ? normalizeImageUrl(property.ListPictureURL) : ''
  const tc = (v?: string | null) => { const t = String(v || '').trim(); return t && t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, c) => a + c.toUpperCase()) : t }
  const street = tc(String(property.FullStreetAddress || '').split(',')[0]) || cleanAddress(property.FullStreetAddress, property.City)
  const place = [tc(property.City), [property.StateOrProvince, property.PostalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const facts = [
    property.BedroomsTotal ? `${property.BedroomsTotal} bd` : '',
    property.BathroomsTotal ? `${property.BathroomsTotal} ba` : '',
    property.LivingArea ? `${property.LivingArea.toLocaleString()} sqft` : '',
  ].filter(Boolean).join(' · ')
  const phoneLike = /^[\d\s()+.-]{7,}$/.test(contact.trim())

  const submit = async () => {
    if (showContactFields && (!name.trim() || !contact.trim())) { setError('Add your name and a phone or email so we can confirm.'); return }
    if (showContactFields && contactStyle === 'full') {
      if (!/^\S+@\S+\.\S+$/.test(contact.trim())) { setError('That email doesn’t look right.'); return }
      if (phone.replace(/\D/g, '').length < 10) { setError('Add a phone number so we can confirm.'); return }
    }
    if (!picks.length) { go('when'); return }
    const [a, b, c] = picks
    setSending(true)
    setError('')
    try {
      await onSubmit({
        propertyId: property.id!,
        propertyAddress: property.FullStreetAddress,
        visitorName: showContactFields ? name.trim() : undefined,
        visitorContact: showContactFields ? contact.trim() : undefined,
        visitorPhone: showContactFields && phone.trim() ? phone.trim() : undefined,
        preferredDate: a.date,
        preferredTime: a.time,
        preferredDate2: b?.date,
        preferredTime2: b?.time,
        preferredDate3: c?.date,
        preferredTime3: c?.time,
        message: note.trim() || undefined,
      })
      setDir(1)
      setStep('done')
    } catch (e: any) {
      setError(e?.message && !/^failed/i.test(e.message) ? e.message : 'That didn’t go through - please try again.')
    } finally {
      setSending(false)
    }
  }

  const stepNo = step === 'when' ? 1 : step === 'you' ? 2 : 3
  const STEPS = ['Pick your times', 'Your details', 'Request sent']
  const slide = {
    initial: (d: number) => ({ opacity: 0, x: d * 36 }),
    animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
    exit: (d: number) => ({ opacity: 0, x: d * -28, transition: { duration: 0.16 } }),
  } as const

  return (
    <motion.div
      {...backdropMotion}
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0b0b0c]/70 sm:items-center sm:p-5"
      onClick={(e) => { if (e.target === e.currentTarget && !sending) onClose() }}
    >
      <style>{TOUR_CSS}</style>
      <motion.div
        ref={sheetRef}
        {...sheetMotion}
        style={isPhone ? { y: sheetY } : undefined}
        className="relative grid max-h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[26px] bg-white shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#111113] sm:max-h-[min(640px,calc(100dvh-2.5rem))] sm:max-w-[920px] sm:grid-cols-[300px_minmax(0,1fr)] sm:grid-rows-1 sm:rounded-[30px]"
      >
        {/* ---- the home, lit */}
        <div className="relative isolate overflow-hidden bg-[#0b0b0c] text-white">
          {photo && <img src={photo} alt="" className="tour-ken absolute inset-0 -z-20 h-full w-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.45),transparent_55%),linear-gradient(180deg,rgba(11,11,12,.35),rgba(11,11,12,.92))]" />
          <span aria-hidden className="tour-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
          {[['14%', '22%', 0], ['80%', '16%', 1.4], ['70%', '64%', 2.6], ['30%', '80%', 1.9]].map(([l, t, d], k) => (
            <span key={k} aria-hidden className="tour-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
          ))}
          <div className="flex h-full flex-col p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]"><CalendarDays className="h-3.5 w-3.5" /> Private showing</p>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:hidden"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 sm:mt-auto">
              <h2 className="truncate whitespace-nowrap font-serif font-black leading-tight" title={street}
                style={{ fontSize: street.length > 24 ? '1.05rem' : street.length > 18 ? '1.25rem' : street.length > 13 ? '1.5rem' : '1.75rem' }}>{street}</h2>
              {place && <p className="mt-0.5 text-[13px] font-semibold text-white/70">{place}</p>}
              {facts && <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#e8c97a]">{facts}</p>}
            </div>
            {/* steps: dots on phones, a list with checks beside the form on wider screens */}
            <div className="mt-4 flex gap-1.5 sm:hidden">
              {[1, 2, 3].map(n => <span key={n} className={`h-1 rounded-full transition-all duration-500 ${n <= stepNo ? 'w-8 bg-[#e8c97a]' : 'w-4 bg-white/25'}`} />)}
            </div>
            <ol className="mt-8 hidden space-y-3 sm:block">
              {STEPS.map((label, i) => {
                const n = i + 1
                const done = n < stepNo || step === 'done'
                return (
                  <li key={label} className={`flex items-center gap-3 text-sm font-bold transition-colors duration-300 ${n === stepNo ? 'text-white' : done ? 'text-white/70' : 'text-white/35'}`}>
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black transition-all duration-300 ${done ? 'bg-[#e8c97a] text-[#111827]' : n === stepNo ? 'bg-white text-[#111827] shadow-[0_0_0_4px_rgba(232,201,122,.25)]' : 'bg-white/10'}`}>
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
                    </span>
                    {label}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        {/* ---- the steps */}
        <div className="flex min-h-0 min-w-0 flex-col">
          {step !== 'done' && (
            <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 sm:px-8 sm:pt-7">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#a8843a] dark:text-[#e8c97a]">Step {stepNo} of 2</p>
                <h3 className="font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{step === 'when' ? 'When works for you?' : showContactFields ? 'Confirm your details' : 'Anything to add?'}</h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="hidden h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white sm:grid"><X className="h-5 w-5" /></button>
            </div>
          )}

          <div className="scrollbar-hide relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              {step === 'when' && (
                <motion.div key="when" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className="flex h-full flex-col px-5 pt-3 sm:px-8">
                  {/* days */}
                  <div className="grid grid-cols-8 gap-1 pb-2 pt-1 sm:gap-1.5">
                    {openDays.map(d => {
                      const on = d === day
                      const dt = parseYmd(d)
                      const count = picks.filter(p => p.date === d).length
                      return (
                        <motion.button key={d} type="button" whileTap={{ scale: 0.94 }} onClick={() => setDay(d)}
                          className={`relative isolate flex min-w-0 flex-col items-center rounded-2xl py-2 transition-colors ${on ? 'text-[#111827]' : 'bg-gray-50 text-gray-600 hover:bg-[#C9A24D]/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]'}`}>
                          {on && <motion.span layoutId="tour-day" className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-[#d9b864] to-[#C9A24D] shadow-[0_12px_22px_-8px_rgba(201,162,77,.75)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                          <span className="relative text-[8px] font-black uppercase tracking-wider opacity-75 sm:text-[9px]">{d === ymd(new Date()) ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                          <span className="relative text-lg font-black leading-tight sm:text-xl">{dt.getDate()}</span>
                          <span className="relative text-[9px] font-bold uppercase opacity-60">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
                          {count > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#111827] px-1 text-[9px] font-black text-white dark:bg-white dark:text-[#111827]">{count}</span>}
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* part of the day */}
                  <div className="mt-4 flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
                    {PERIODS.map(p => {
                      const open = p.times.some(t => !isPast(day, t))
                      return (
                        <button key={p.id} type="button" disabled={!open} onClick={() => setPeriod(p.id)}
                          className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black uppercase tracking-wider transition-colors disabled:opacity-35 ${period === p.id ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                          {period === p.id && <motion.span layoutId="tour-period" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                          <p.icon className="relative h-3.5 w-3.5" /><span className="relative">{p.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* times */}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={`${day}-${period}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
                      className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                      {PERIODS.find(p => p.id === period)!.times.map((t, i) => {
                        const at = picks.findIndex(p => p.date === day && p.time === t)
                        const past = isPast(day, t)
                        const taken = !past && isBusy(day, t)
                        return (
                          <motion.button key={t} type="button" disabled={past || taken} onClick={() => toggle(t)} title={taken ? 'Your agent is busy then' : undefined}
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.015 }}
                            whileTap={{ scale: 0.92 }}
                            className={`relative rounded-xl border py-2.5 text-[12px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${at > -1 ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:text-white'}`}>
                            <span className={taken ? 'line-through decoration-2 decoration-rose-400/70' : ''}>{timeLabel(t)}</span>
                            {at > -1 && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D] text-[9px] font-black text-[#111827]">{at + 1}</motion.span>}
                          </motion.button>
                        )
                      })}
                    </motion.div>
                  </AnimatePresence>

                  {/* the chosen times */}
                  <div className="pb-2 pt-5">
                    {busy.length > 0 && (
                      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><span className="h-px w-4 bg-rose-400/70" /> Crossed-out times are already booked on the agent&apos;s calendar.</p>
                    )}
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your times <span className="font-bold normal-case tracking-normal">- up to {maxPicks}, first is your top pick</span></p>
                    <div className="mt-2 flex min-h-[34px] flex-wrap gap-1.5">
                      <AnimatePresence initial={false}>
                        {picks.map((p, i) => (
                          <motion.button layout key={`${p.date}-${p.time}`} type="button" onClick={() => setPicks(cur => cur.filter((_, j) => j !== i))}
                            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                            className="group inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/15 py-1.5 pl-2 pr-2.5 text-[11px] font-black text-[#7a5f22] dark:text-[#e8c97a]">
                            <span className="grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D] text-[9px] text-[#111827]">{i + 1}</span>
                            {dayLabel(p.date)} · {timeLabel(p.time)}
                            <X className="h-3 w-3 opacity-50 transition group-hover:opacity-100" />
                          </motion.button>
                        ))}
                      </AnimatePresence>
                      {!picks.length && <span className="self-center text-xs font-semibold text-gray-400">Tap a time above to add it.</span>}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'you' && (
                <motion.div key="you" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className="flex h-full flex-col gap-3 px-5 pt-3 sm:px-8">
                  {showContactFields && (
                    <>
                      <Field label="Your name" value={name} onChange={setName} placeholder="First and last name" autoComplete="name" />
                      {contactStyle === 'full' ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Email" value={contact} onChange={setContact} placeholder="you@email.com" type="email" autoComplete="email" />
                          <Field label="Phone" value={phone} onChange={v => setPhone(formatPhone(v))} placeholder="(555) 000-0000" type="tel" autoComplete="tel" />
                        </div>
                      ) : (
                        <>
                          <Field label="Phone or email" value={contact} onChange={setContact} placeholder="So we can confirm your showing" autoComplete="email" />
                          {!phoneLike && <Field label="Mobile (optional)" value={phone} onChange={setPhone} placeholder="For a quick text back" type="tel" autoComplete="tel" />}
                        </>
                      )}
                    </>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">A note (optional)</span>
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={showContactFields ? 2 : 4} placeholder="Anything we should know - who's coming, questions about the home..."
                      className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
                  </label>
                  <div className="mt-auto rounded-2xl border border-dashed border-[#C9A24D]/40 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]">You asked for</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      {picks.map((p, i) => <span key={i} className="text-[13px] font-bold text-[#111827] dark:text-white">{i + 1}. {dayLabel(p.date, true)} · {timeLabel(p.time)}</span>)}
                    </div>
                  </div>
                  {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-rose-600">{error}</motion.p>}
                </motion.div>
              )}

              {step === 'done' && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="relative">
                    <motion.span className="absolute inset-0 rounded-full bg-emerald-400/30" initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.05 }}
                      className="relative grid h-20 w-20 place-items-center rounded-full bg-emerald-500 shadow-[0_18px_40px_-12px_rgba(16,185,129,.8)]">
                      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }} />
                      </svg>
                    </motion.div>
                    {Array.from({ length: 10 }).map((_, i) => {
                      const a = (i / 10) * Math.PI * 2
                      return <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full" style={{ background: i % 2 ? '#C9A24D' : '#34d399' }}
                        initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * 70, y: Math.sin(a) * 70, opacity: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }} />
                    })}
                  </div>
                  <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-7 font-serif text-3xl font-black text-[#111827] dark:text-white">Showing requested</motion.h3>
                  <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-2 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">
                    {picks[0] ? `${dayLabel(picks[0].date, true)} at ${timeLabel(picks[0].time)}${picks.length > 1 ? ` (+${picks.length - 1} backup${picks.length > 2 ? 's' : ''})` : ''}.` : ''}{' '}It&apos;s pending your agent&apos;s approval - you&apos;ll get a message when it&apos;s confirmed.
                  </motion.p>
                  {/* the bar that runs out as the window closes itself */}
                  <div className="mt-7 h-1 w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <motion.span className="block h-full rounded-full bg-[#C9A24D]" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 2.5, ease: 'linear' }} />
                  </div>
                  <button type="button" onClick={onClose} className="mt-4 text-[11px] font-black uppercase tracking-widest text-gray-400 transition hover:text-[#111827] dark:hover:text-white">Close</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {step !== 'done' && (
            <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/[0.07] sm:px-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {step === 'you' && (
                <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => go('when')} disabled={sending}
                  className="inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" /> Back
                </motion.button>
              )}
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                disabled={sending || (step === 'when' && !picks.length)}
                onClick={() => (step === 'when' ? go('you') : submit())}
                className="tour-shine relative ml-auto inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white shadow-[0_16px_34px_-14px_rgba(17,24,39,.9)] transition-opacity disabled:opacity-40 dark:bg-white dark:text-[#111827] sm:flex-none sm:px-9"
              >
                {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</>
                  : step === 'when' ? <>Continue <ArrowRight className="h-4 w-4" /></>
                  : <><Send className="h-4 w-4" /> Request showing</>}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// (555) 123-4567 as they type.
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

function Field({ label, value, onChange, placeholder, type = 'text', autoComplete }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
        className="block w-full rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
    </label>
  )
}

const TOUR_CSS = `
.tour-ken{animation:tourKen 16s ease-out both}
@keyframes tourKen{from{transform:scale(1.15)}to{transform:scale(1.02)}}
.tour-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);background-size:200% 100%;animation:tourEdge 6s ease-in-out infinite}
@keyframes tourEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.tour-spark{width:4px;height:4px;border-radius:999px;background:#e8c97a;box-shadow:0 0 10px 2px #e8c97a;opacity:0;animation:tourSpark 7s ease-in-out infinite}
@keyframes tourSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.tour-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-100%);animation:tourShine 3.4s ease-in-out infinite}
@keyframes tourShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.tour-ken,.tour-edge,.tour-spark,.tour-shine:after{animation:none}}
`

// Opens and closes with motion; the flow starts fresh each time it opens. Rendered at the end of
// <body>: inside an animated page (the Guest Pass, a Showcase window) a "fixed" window would be
// trapped in that page's box and cut off.
export default function ScheduleTourModal(props: ScheduleTourModalProps) {
  const property = useLastValue(props.property)
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {props.isOpen && property && <ScheduleTourWindow key="tour" {...props} property={property} />}
    </AnimatePresence>,
    host,
  )
}
