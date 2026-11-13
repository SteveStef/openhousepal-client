'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Copy, Layers, ListChecks, Loader2, Mail, MessageSquare, Send, Sparkles, Smartphone } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { normalizeImageUrl } from '@/lib/utils'
import { mailtoHref, smsHref } from '@/lib/messageTemplates'
import { useQrDataUrl } from '@/lib/qr'
import { useIsPhone } from '@/components/ui/windowMotion'
import type { ListingAgentHome, ListingAgentHomes } from '@/types'
import { dayIsHostable } from './WeekendCalendarCards'
import { DayStep, FlowFooter, HostFlowWindow, SentMoment, TimeStep, clockRange, dayShort, isAnytime, type DayInfo, type TimePick } from './HostFlowParts'

// "I'd host any of these" (owner, 11/12). Instead of asking for one home, getting a no, asking for
// the next one... the agent ticks the listing agent's homes they'd host and says when - one day +
// time for all of them (the listing agent picks a home) or a day + time for each - and sends it ONE
// way: an OpenHousePal request (one alert, one card; yes to one closes the others that day), a text
// from their own phone, or an email. Same step window and look as Request to Host.

const titleCase = (v?: string) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : v || '')
const nicePhone = (v: string) => {
  const d = v.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v
}
const hhmm = (t: string) => `${t}:00`

type Step = 'homes' | 'how' | 'day' | 'time' | 'eachDay' | 'eachTime' | 'send' | 'done'
type Plan = { day: string | null; time: TimePick | null }
type Via = 'app' | 'text' | 'email'

/** Discovery row -> a home in the same shape the backend sends (used until / unless it answers). */
function homeFromRow(p: any): ListingAgentHome {
  return {
    ListingKey: p.ListingKey, Street: p.Street || '', City: p.City || '', State: p.State || '', Zipcode: p.Zipcode || '',
    Price: p.Price || '', Image: p.Image || '', Beds: p.Beds || 0, Baths: p.Baths || 0, SquareFeet: p.SquareFeet || 0,
    HostingBlocked: p.HostingBlocked || null, HostsFrom: p.HostsFrom || null, taken: [], asked: [],
  }
}

/** Open the many-homes window instead of the one-home one: this listing agent has more homes. */
export const offersHostAny = (p: any) => (p?.AgentHostableCount ?? 1) > 1

export default function HostAnyFlow({ property, user, initialDate, onClose, onSent }: {
  property: any
  user: any
  initialDate?: string
  onClose: () => void
  /** A request went out in OpenHousePal - refresh My Requests. */
  onSent?: () => void
}) {
  const { showToast } = useToast()
  const isPhone = useIsPhone()
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<Step>('homes')
  const [dir, setDir] = useState(1)
  const [data, setData] = useState<ListingAgentHomes | null>(null)
  const [picked, setPicked] = useState<string[]>([property.ListingKey])
  const [mode, setMode] = useState<'same' | 'each'>('same')
  const [days, setDays] = useState<string[]>(initialDate ? [initialDate] : [])
  const [time, setTime] = useState<TimePick | null>(null)
  const [plans, setPlans] = useState<Record<string, Plan>>(initialDate ? { [property.ListingKey]: { day: initialDate, time: null } } : {})
  const [idx, setIdx] = useState(0)
  const [note, setNote] = useState('')
  const noteTouched = useRef(false)
  const [busy, setBusy] = useState(false)
  const [via, setVia] = useState<Via | null>(null)
  const [appSent, setAppSent] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  // The listing agent and their homes. A failed lookup still works - just this one home.
  useEffect(() => {
    let live = true
    api.openHouseManager.listingAgentHomes(property.ListingKey).then(r => {
      if (!live) return
      const d: ListingAgentHomes = r.success && r.data ? r.data : {
        agent: {
          name: property.ListAgentFullName || '', email: property.ListingAgentEmail || '',
          phone: property.ListAgentPreferredPhone && property.ListAgentPreferredPhone !== 'N/A' ? property.ListAgentPreferredPhone : '',
          office: property.ListOfficeName || '', on_platform: !!property.AgentOnPlatform, eligible: property.HostRequestEligible !== false, photo_url: property.ListAgentPhotoUrl || null,
        },
        homes: [homeFromRow(property)],
      }
      setData(d)
      // Only this one home: straight to the day.
      if (d.homes.length <= 1) { setDir(1); setStep('day') }
    })
    return () => { live = false }
  }, [property])

  const homes = data?.homes || [homeFromRow(property)]
  const byKey = useMemo(() => Object.fromEntries(homes.map(h => [h.ListingKey, h])), [homes])
  const chosen = homes.filter(h => picked.includes(h.ListingKey))
  const many = chosen.length > 1
  const agent = data?.agent
  const agentName = agent?.name || property.ListAgentFullName || ''
  const first = agentName.trim().split(/\s+/)[0] || 'there'
  const canApp = !!agent?.on_platform && agent.eligible !== false && !appSent
  const current = mode === 'each' ? chosen[idx] : undefined

  const open_ = (h: ListingAgentHome, d: string) => dayIsHostable({ hosting_blocked: h.HostingBlocked, hosts_from: h.HostsFrom }, d) && !h.taken.includes(d) && !h.asked.includes(d)
  // One day for all of them: a day is out only when it's out for every home.
  const sameInfo = (d: string): DayInfo => ({
    taken: chosen.length && chosen.every(h => h.taken.includes(d)) ? 'yes' : null,
    requested: !!chosen.length && chosen.every(h => h.asked.includes(d)),
    locked: !!chosen.length && chosen.every(h => !dayIsHostable({ hosting_blocked: h.HostingBlocked, hosts_from: h.HostsFrom }, d)),
  })
  const homeInfo = (h: ListingAgentHome) => (d: string): DayInfo => ({ taken: h.taken.includes(d) ? 'yes' : null, requested: h.asked.includes(d) })

  // What goes out: every home x day that can still be asked about.
  const items = useMemo(() => {
    const out: { key: string; day: string; start: string; end: string }[] = []
    if (mode === 'same' || !many) {
      if (!time || isAnytime(time)) return out
      for (const h of chosen) for (const d of days) if (open_(h, d)) out.push({ key: h.ListingKey, day: d, start: time.start, end: time.end })
    } else {
      for (const h of chosen) {
        const p = plans[h.ListingKey]
        if (p?.day && p.time && !isAnytime(p.time) && open_(h, p.day)) out.push({ key: h.ListingKey, day: p.day, start: p.time.start, end: p.time.end })
      }
    }
    return out
  }, [mode, many, time, days, chosen, plans]) // eslint-disable-line react-hooks/exhaustive-deps

  const street = (k: string) => titleCase(byKey[k]?.Street) || 'this home'
  const homesAsked = Array.from(new Set(items.map(i => i.key)))
  const sameWhen = time && !isAnytime(time) ? `${days.map(dayShort).join(' or ')}, ${clockRange(time.start, time.end)}` : ''
  const lines = (mode === 'same' || !many)
    ? (homesAsked.length > 1 ? `${sameWhen} - any of these:\n${homesAsked.map(k => `• ${street(k)}`).join('\n')}` : homesAsked.map(k => `• ${street(k)}: ${sameWhen}`).join('\n'))
    : items.map(i => `• ${street(i.key)}: ${dayShort(i.day)}, ${clockRange(i.start, i.end)}`).join('\n')
  const myName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim()
  const defaultNote = !many
    ? 'I’d love to help by hosting an open house for you.'
    : mode === 'same'
      ? 'I’d love to host an open house for you - I’m free then and happy to do whichever of these helps you most.'
      : 'I’d love to host an open house for you. Here’s when I could do each one - say yes to whichever helps (or more than one!).'
  useEffect(() => { if (!noteTouched.current) setNote(defaultNote) }, [defaultNote])
  const fullText = `Hi ${first},\n\n${note.trim()}\n\n${lines}\n\nThanks!\n${myName}${user?.brokerage ? `\n${user.brokerage}` : ''}${user?.phone ? `\n${user.phone}` : ''}`
  const subject = many ? 'Hosting an open house for you' : `Hosting an open house for ${street(chosen[0]?.ListingKey || property.ListingKey)}`
  const qr = useQrDataUrl(qrOpen && agent?.phone ? `SMSTO:${agent.phone.replace(/[^\d+]/g, '')}:${fullText}` : null, { size: 240, ecc: 'M' })

  // ---- moving between steps
  const order: Step[] = ['homes', 'how', 'day', 'time', 'eachDay', 'eachTime', 'send', 'done']
  const go = (s: Step, back = false) => { setDir(back || order.indexOf(s) < order.indexOf(step) ? -1 : 1); setStep(s) }
  const closing = useRef(false)
  const close = (then: () => void = onClose) => {
    if (closing.current) return
    closing.current = true
    setOpen(false)
    window.setTimeout(then, 280)
  }
  const afterHomes = () => {
    if (!many) { setMode('same'); go('day') } else go('how')
  }
  const pickMode = (m: 'same' | 'each') => {
    setMode(m)
    if (m === 'each') { setIdx(0); go('eachDay') } else go('day')
  }
  const nextHome = () => {
    if (idx + 1 < chosen.length) { setDir(1); setIdx(idx + 1); setStep('eachDay') } else go('send')
  }
  const back = () => {
    if (step === 'how') go('homes', true)
    else if (step === 'day') go(many ? 'how' : homes.length > 1 ? 'homes' : 'day', true)
    else if (step === 'time') go('day', true)
    else if (step === 'eachDay') { if (idx === 0) go('how', true); else { setDir(-1); setIdx(idx - 1); setStep('eachTime') } }
    else if (step === 'eachTime') go('eachDay', true)
    else if (step === 'send') { if (mode === 'each' && many) { setDir(-1); setIdx(chosen.length - 1); setStep('eachTime') } else go('time', true) }
  }
  const togglePick = (k: string) => setPicked(cur => cur.includes(k) ? (cur.length > 1 ? cur.filter(x => x !== k) : cur) : [...cur, k])
  const toggleDay = (d: string) => setDays(cur => cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].slice(-2).sort())
  const setPlan = (k: string, p: Partial<Plan>) => setPlans(cur => ({ ...cur, [k]: { ...{ day: null, time: null }, ...cur[k], ...p } }))

  // ---- sending
  const sendApp = async () => {
    if (!items.length) return
    setBusy(true)
    const r = await api.openHouseManager.createRequestsBatch({
      items: items.map(i => ({ listing_key: i.key, requested_date: i.day, requested_start_time: hhmm(i.start), requested_end_time: hhmm(i.end) })),
      message: note.trim() || undefined,
    })
    setBusy(false)
    if (!r.success || !r.data) { showToast(r.error || 'That didn’t go through - please try again.', 'error'); return }
    if (!r.data.on_platform) {
      setData(d => d ? { ...d, agent: { ...d.agent, on_platform: false } } : d)
      showToast(`${first} isn’t on OpenHousePal - text or email it instead.`, 'success')
      return
    }
    if (r.data.skipped.length) showToast(`Sent. Skipped ${r.data.skipped.length}: ${r.data.skipped[0].reason}`, 'success')
    setAppSent(true)
    setVia('app')
    onSent?.()
    go('done')
  }
  const sendText = () => {
    if (!agent?.phone) return
    if (!isPhone) { setQrOpen(v => !v); return }
    setVia('text')
    window.location.href = smsHref(agent.phone, fullText)
    window.setTimeout(() => go('done'), 400)
  }
  const sendEmail = () => {
    if (!agent?.email) return
    setVia('email')
    window.location.href = mailtoHref(agent.email, subject, fullText)
    window.setTimeout(() => go('done'), 400)
  }
  const copyText = async () => {
    try { await navigator.clipboard.writeText(fullText); showToast('Text copied', 'success') } catch { showToast('Couldn’t copy - select the text instead', 'error') }
  }

  // ---- the window's left side and header
  const lead = current || chosen[0] || homes[0]
  const photo = lead?.Image ? normalizeImageUrl(lead.Image) : null
  const stepNo = step === 'homes' ? 1 : step === 'send' || step === 'done' ? 3 : 2
  const multiHeader = many && step !== 'eachDay' && step !== 'eachTime'
  const titles: Record<Step, string> = {
    homes: data ? `Which of ${first}’s homes?` : `Finding ${first}’s homes`,
    how: 'How would you like to offer?',
    day: many ? 'Which day works?' : 'Which day works?',
    time: 'What time?',
    eachDay: `${street(current?.ListingKey || '')}: which day?`,
    eachTime: `${street(current?.ListingKey || '')}: what time?`,
    send: `Send it to ${first}`,
    done: '',
  }
  const footer = step === 'homes'
    ? <FlowFooter onNext={afterHomes} disabled={!data} nextLabel={many ? `Continue with ${chosen.length} homes` : 'Continue'} nextIcon={<ArrowRight className="h-4 w-4" />} />
    : step === 'how'
    ? <FlowFooter onBack={back} onNext={() => pickMode(mode)} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
    : step === 'day'
    ? <FlowFooter onBack={homes.length > 1 ? back : undefined} onNext={() => go('time')} disabled={!days.length} nextLabel={days.length > 1 ? 'Continue with 2 days' : 'Continue'} nextIcon={<ArrowRight className="h-4 w-4" />} />
    : step === 'time'
    ? <FlowFooter onBack={back} onNext={() => go('send')} disabled={!time || isAnytime(time) || !items.length} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
    : step === 'eachDay'
    ? <FlowFooter onBack={back} onNext={() => go('eachTime')} disabled={!plans[current?.ListingKey || '']?.day} nextLabel="Continue" nextIcon={<ArrowRight className="h-4 w-4" />} />
    : step === 'eachTime'
    ? <FlowFooter onBack={back} onNext={nextHome} disabled={!plans[current?.ListingKey || '']?.time} nextLabel={idx + 1 < chosen.length ? 'Next home' : 'Continue'} nextIcon={<ArrowRight className="h-4 w-4" />} />
    : step === 'send' && canApp
    ? <FlowFooter onBack={back} onNext={sendApp} busy={busy} disabled={!items.length}
        nextLabel={busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> Send request</>} />
    : step === 'send'
    ? <FlowFooter onBack={back} onNext={() => close()} nextLabel="Done" nextIcon={<Check className="h-4 w-4" />} />
    : undefined

  const Option = ({ how, icon, title, sub, disabled, onClick, badge }: { how: Via; icon: React.ReactNode; title: string; sub: string; disabled?: boolean; onClick: () => void; badge?: string }) => (
    <motion.button type="button" whileTap={disabled ? undefined : { scale: 0.97 }} disabled={disabled || busy} onClick={onClick} data-testid={`host-any-${how}`}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${disabled
        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-white/10 dark:bg-white/[0.02]'
        : 'border-[#C9A24D]/40 bg-white shadow-[0_14px_30px_-24px_rgba(139,115,85,.9)] hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04]'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${disabled ? 'bg-gray-200 text-gray-400 dark:bg-white/10' : 'bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14.5px] font-black text-[#111827] dark:text-white">{title}
          {badge && <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#8b7355] dark:text-[#e8c97a]">{badge}</span>}
        </span>
        <span className="block truncate text-[12px] font-semibold text-gray-500 dark:text-gray-400">{sub}</span>
      </span>
      {!disabled && <ArrowRight className="h-4 w-4 shrink-0 text-[#C9A24D]" />}
    </motion.button>
  )

  return (
    <HostFlowWindow
      open={open}
      onClose={() => close()}
      busy={busy}
      photo={photo}
      street={multiHeader ? `${chosen.length} of ${first}’s homes` : titleCase(lead?.Street) || 'This listing'}
      place={multiHeader ? chosen.map(h => titleCase(h.Street)).join(' · ') : [titleCase(lead?.City), [lead?.State, lead?.Zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
      facts={multiHeader ? 'Any of these' : mode === 'each' && current ? `Home ${idx + 1} of ${chosen.length}` : [lead?.Price, lead?.Beds ? `${lead.Beds} bd` : '', lead?.Baths ? `${lead.Baths} ba` : ''].filter(Boolean).join(' · ')}
      kicker="Ask to host"
      steps={['Pick the homes', 'Days & times', 'Send it']}
      stepNo={stepNo}
      done={step === 'done'}
      title={titles[step]}
      stepKey={step === 'eachDay' || step === 'eachTime' ? `${step}-${idx}` : step}
      dir={dir}
      footer={footer}
    >
      {step === 'homes' && (
        <div className="space-y-3" data-testid="host-any-homes">
          <div className="flex items-start gap-3 rounded-2xl border border-[#C9A24D]/35 bg-[#C9A24D]/[0.07] p-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-sm font-black text-[#111827]">
              {agent?.photo_url ? <img src={agent.photo_url} alt="" className="h-full w-full object-cover" /> : (first[0] || '?').toUpperCase()}
            </span>
            <p className="text-[13px] font-semibold leading-snug text-[#5c4a1f] dark:text-[#e8cf8a]">
              {data
                ? <>{agentName || 'This agent'} has {homes.length} homes that could use a host. Tick the ones you’d host - one ask covers them all, and {first} picks.</>
                : <>Looking up {agentName || 'the listing agent'}’s other homes…</>}
            </p>
          </div>
          {data && homes.length > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{chosen.length} of {homes.length} picked</p>
              <button type="button" onClick={() => setPicked(chosen.length === homes.length ? [property.ListingKey] : homes.map(h => h.ListingKey))} data-testid="host-any-all"
                className="text-[12px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">{chosen.length === homes.length ? 'Just this one' : 'Pick all'}</button>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {(data ? homes : [homeFromRow(property), null, null]).map((h, i) => h ? (
              <motion.button key={h.ListingKey} type="button" onClick={() => togglePick(h.ListingKey)} data-testid="host-any-home" aria-pressed={picked.includes(h.ListingKey)}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 380, damping: 30 }} whileTap={{ scale: 0.97 }}
                className={`relative flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${picked.includes(h.ListingKey)
                  ? 'border-[#C9A24D] bg-[#C9A24D]/[0.08] shadow-[0_14px_30px_-22px_rgba(201,162,77,.9)]'
                  : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.03]'}`}>
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/10">
                  {h.Image && <img src={normalizeImageUrl(h.Image)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-black text-[#111827] dark:text-white">{titleCase(h.Street)}</span>
                  <span className="block truncate text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">{[titleCase(h.City), h.Price].filter(Boolean).join(' · ')}</span>
                  <span className="block truncate text-[10px] font-black uppercase tracking-wider text-[#a8843a] dark:text-[#e8c97a]">
                    {[h.Beds ? `${h.Beds} bd` : '', h.Baths ? `${h.Baths} ba` : '', h.HostsFrom ? `Hosting from ${dayShort(h.HostsFrom)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${picked.includes(h.ListingKey) ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-300 dark:border-white/20'}`}>
                  <AnimatePresence>{picked.includes(h.ListingKey) && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-4 w-4" strokeWidth={3} /></motion.span>}</AnimatePresence>
                </span>
              </motion.button>
            ) : (
              <div key={`sk${i}`} className="h-[78px] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.05]" />
            ))}
          </div>
        </div>
      )}

      {step === 'how' && (
        <div className="space-y-3" data-testid="host-any-how">
          {([
            { m: 'same' as const, icon: <Layers className="h-5 w-5" />, title: 'One day & time for all', sub: `You pick when - ${first} picks which home.` },
            { m: 'each' as const, icon: <ListChecks className="h-5 w-5" />, title: 'A day & time for each home', sub: `${first} can say yes to more than one.` },
          ]).map((o, i) => (
            <motion.button key={o.m} type="button" onClick={() => pickMode(o.m)} data-testid={`host-any-mode-${o.m}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 380, damping: 30 }} whileTap={{ scale: 0.97 }}
              className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors ${mode === o.m ? 'border-[#C9A24D] bg-[#C9A24D]/[0.08]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.03]'}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]">{o.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-[#111827] dark:text-white">{o.title}</span>
                <span className="block text-[12.5px] font-semibold text-gray-500 dark:text-gray-400">{o.sub}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#C9A24D]" />
            </motion.button>
          ))}
          <p className="px-1 pt-1 text-[12px] font-semibold text-gray-400">Either way it’s one message. You can only host one open a day, so a yes on one closes the others that day.</p>
        </div>
      )}

      {step === 'day' && (
        <DayStep picked={days} onToggle={toggleDay} max={2} info={many ? sameInfo : homeInfo(chosen[0] || homes[0])}
          hostingWindow={many ? undefined : { hosting_blocked: (chosen[0] || homes[0])?.HostingBlocked, hosts_from: (chosen[0] || homes[0])?.HostsFrom }}
          hint={many ? <p className="mb-3 text-[13px] font-bold text-gray-500 dark:text-gray-400">For any of your {chosen.length} homes - {first} picks one.</p> : undefined} />
      )}
      {step === 'time' && (
        <div>
          <TimeStep value={time} onChange={setTime} days={days} />
          {time && !isAnytime(time) && !items.length && <p className="mt-3 text-sm font-bold text-rose-600">Those days are already taken for these homes - go back and pick another day.</p>}
        </div>
      )}

      {step === 'eachDay' && current && (
        <DayStep picked={plans[current.ListingKey]?.day ? [plans[current.ListingKey].day as string] : []}
          onToggle={d => setPlan(current.ListingKey, { day: plans[current.ListingKey]?.day === d ? null : d })} max={1}
          info={homeInfo(current)} hostingWindow={{ hosting_blocked: current.HostingBlocked, hosts_from: current.HostsFrom }}
          hint={idx > 0 && (() => {
            const prev = plans[chosen[idx - 1].ListingKey]
            if (!prev?.day || !prev.time || isAnytime(prev.time) || !open_(current, prev.day)) return null
            const t = prev.time
            return (
              <motion.button type="button" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} data-testid="host-any-same-as-prev"
                onClick={() => { setPlan(current.ListingKey, { day: prev.day, time: t }); nextHome() }}
                className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#C9A24D]/60 bg-[#C9A24D]/[0.06] p-3 text-left">
                <Sparkles className="h-4 w-4 shrink-0 text-[#C9A24D]" />
                <span className="min-w-0 flex-1 text-[13px] font-bold text-[#5c4a1f] dark:text-[#e8cf8a]">Same as {street(chosen[idx - 1].ListingKey)}: {dayShort(prev.day)}, {clockRange(t.start, t.end)}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#C9A24D]" />
              </motion.button>
            )
          })()} />
      )}
      {step === 'eachTime' && current && (
        <TimeStep value={plans[current.ListingKey]?.time || null} onChange={t => setPlan(current.ListingKey, { time: t })} days={plans[current.ListingKey]?.day ? [plans[current.ListingKey].day as string] : []} />
      )}

      {step === 'send' && (
        <div className="space-y-4" data-testid="host-any-send">
          <div className="rounded-2xl border border-dashed border-[#C9A24D]/45 p-3.5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#a8843a] dark:text-[#e8c97a]">{many ? (mode === 'same' ? `${sameWhen} - ${first} picks one` : 'When you’d host each') : 'Your ask'}</p>
            <ul className="space-y-1.5">
              {(mode === 'same' || !many ? homesAsked.map(k => ({ k, w: many ? '' : sameWhen })) : items.map(i => ({ k: i.key, w: `${dayShort(i.day)}, ${clockRange(i.start, i.end)}` }))).map(r => (
                <li key={r.k} className="flex items-center gap-2.5">
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10">{byKey[r.k]?.Image && <img src={normalizeImageUrl(byKey[r.k].Image)} alt="" className="h-full w-full object-cover" />}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-black text-[#111827] dark:text-white">{street(r.k)}</span>
                  {r.w && <span className="shrink-0 text-[12px] font-bold text-gray-500 dark:text-gray-400">{r.w}</span>}
                </li>
              ))}
            </ul>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your note (we wrote one - change it if you like)</span>
            <textarea value={note} onChange={e => { noteTouched.current = true; setNote(e.target.value) }} rows={3} data-testid="host-any-note"
              className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[15px] font-medium leading-relaxed text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          </label>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{canApp ? 'Or send it yourself' : 'Send it from your phone or email'}</p>
            {agent?.on_platform && agent.eligible === false && !appSent && (
              <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">{first} only takes OpenHousePal requests from their team - text or email works.</p>
            )}
            <Option how="text" icon={<MessageSquare className="h-5 w-5" />} title={`Text ${first}`} sub={agent?.phone ? `${nicePhone(agent.phone)}${isPhone ? '' : ' · opens on your phone'}` : 'No phone number on file'} disabled={!agent?.phone} onClick={sendText} />
            <AnimatePresence initial={false}>
              {qrOpen && !isPhone && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden" data-testid="host-any-qr">
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-4 text-center dark:border-white/10 dark:bg-[#0b0b0c] sm:flex-row sm:text-left">
                    <div className="grid h-[132px] w-[132px] shrink-0 place-items-center rounded-xl bg-white p-1.5">{qr ? <img src={qr} alt="Scan to open the text on your phone" className="h-full w-full" /> : <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" />}</div>
                    <div className="min-w-0 space-y-2">
                      <p className="flex items-center justify-center gap-1.5 text-[13px] font-black text-[#111827] dark:text-white sm:justify-start"><Smartphone className="h-4 w-4 text-[#C9A24D]" /> Scan with your phone</p>
                      <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">Messages opens with {first}’s number and your text filled in - you press send.</p>
                      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                        <button type="button" onClick={copyText} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[12px] font-black text-gray-600 dark:border-white/15 dark:text-gray-300"><Copy className="h-3.5 w-3.5" /> Copy text</button>
                        <button type="button" onClick={() => { setVia('text'); go('done') }} data-testid="host-any-text-sent" className="inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-[12px] font-black text-white dark:bg-white dark:text-[#111827]"><Check className="h-3.5 w-3.5" /> I sent it</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Option how="email" icon={<Mail className="h-5 w-5" />} title={`Email ${first}`} sub={agent?.email || 'No email on file'} disabled={!agent?.email} onClick={sendEmail} />
          </div>
          {canApp && <p className="text-center text-[12px] font-semibold text-gray-400">Send request = {first} gets it in OpenHousePal right away, all {homesAsked.length} {homesAsked.length === 1 ? 'home' : 'homes'} in one message.</p>}
        </div>
      )}

      {step === 'done' && (
        <SentMoment
          title={via === 'app' ? 'Request sent' : via === 'text' ? 'Your text is ready' : 'Your email is ready'}
          text={via === 'app'
            ? <>{first} gets one message with {homesAsked.length > 1 ? `all ${homesAsked.length} homes` : 'your ask'} right away. You’ll see it under My Requests.</>
            : <>Send it from your {via === 'text' ? 'Messages' : 'email'} app.</>}
          onClose={() => close()}
          ms={via === 'app' && (agent?.phone || agent?.email) ? 7000 : 2600}
          extra={via === 'app' && (agent?.phone || agent?.email) ? (
            <button type="button" onClick={() => go('send', true)} data-testid="host-any-also"
              className="inline-flex items-center gap-2 rounded-full border border-[#C9A24D]/50 bg-white px-4 py-2.5 text-[13px] font-black text-[#8b7355] shadow-sm transition hover:border-[#C9A24D] dark:bg-white/[0.05] dark:text-[#e8c97a]">
              <MessageSquare className="h-4 w-4" /> Also text or email {first}
            </button>
          ) : undefined}
        />
      )}
    </HostFlowWindow>
  )
}
