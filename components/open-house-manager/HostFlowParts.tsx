'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Home, Moon, Send, Sparkles, Sun, Sunrise, X } from 'lucide-react'
import { backdropMotion, useEscapeToClose, useIsPhone, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import FlowDock, { FlowDockHostContext } from '@/components/ui/FlowDock'
import { dayIsHostable, type HostingWindow } from './WeekendCalendarCards'

// The window's step number for the phone flow bar FlowFooter draws (null outside a HostFlowWindow).
const HostFlowDockContext = createContext<{ stepNo: number; total: number } | null>(null)

// The open-house side of the "Schedule a Showing" look (user, 10/22): the same lit photo panel,
// one question per step, big tap targets, and a "sent" moment - for asking to host a home
// (RequestToHostModal) and for a listing agent finding a host (FindHostFlow). Built for older
// agents on phones: nothing to type until the optional note, suggested days and times first,
// and "Pick your own" for anything else.

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const dayLong = (s: string) => parseDay(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
export const dayShort = (s: string) => parseDay(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
export const clock = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
/** "1 - 3 PM", or "11 AM - 1 PM" when the halves of the day differ. */
export const clockRange = (a: string, b: string) => {
  const x = clock(a), y = clock(b)
  return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)} - ${y}` : `${x} - ${y}`
}
const minutes = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }
const fromMinutes = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`

/** What a day looks like to the person picking it. */
/** `asked` = the day the other side asked for (Offer another time) - marked, still pickable. */
export type DayInfo = { taken?: string | null; requested?: boolean; locked?: boolean; asked?: boolean }

// ---------------------------------------------------------------- the window

export function HostFlowWindow({ open, onClose, busy = false, photo, street, place, facts, kicker, steps, stepNo, done, title, stepKey, dir, footer, children }: {
  open: boolean
  onClose: () => void
  /** Sending - the window can't be closed by a stray tap. */
  busy?: boolean
  photo?: string | null
  street: string
  place?: string
  facts?: string
  kicker: string
  steps: string[]
  stepNo: number
  done: boolean
  title: string
  /** Changes when the step changes - drives the slide. */
  stepKey: string
  dir: number
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <Window key="host-flow" {...{ onClose, busy, photo, street, place, facts, kicker, steps, stepNo, done, title, stepKey, dir, footer }}>{children}</Window>
      )}
    </AnimatePresence>,
    host,
  )
}

function Window({ onClose, busy, photo, street, place, facts, kicker, steps, stepNo, done, title, stepKey, dir, footer, children }: Omit<Parameters<typeof HostFlowWindow>[0], 'open'>) {
  useEscapeToClose(onClose, !busy)
  const sheetMotion = useSheetMotion()
  const isPhone = useIsPhone()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, isPhone && !busy)
  const slide = {
    initial: (d: number) => ({ opacity: 0, x: d * 36 }),
    animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
    exit: (d: number) => ({ opacity: 0, x: d * -28, transition: { duration: 0.16 } }),
  } as const
  const fit = street.length > 24 ? '1.05rem' : street.length > 18 ? '1.25rem' : street.length > 13 ? '1.5rem' : '1.75rem'
  const [dockHost, setDockHost] = useState<HTMLElement | null>(null)
  const dockStep = useMemo(() => ({ stepNo, total: steps.length }), [stepNo, steps.length])
  return (
    <motion.div {...backdropMotion} className="fixed inset-0 z-[120] flex items-end justify-center bg-[#0b0b0c]/70 sm:items-center sm:p-5"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <style>{HOST_FLOW_CSS}</style>
      <motion.div ref={sheetRef} {...sheetMotion} style={isPhone ? { y: sheetY } : undefined}
        className="relative grid max-h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[26px] bg-white shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#111113] sm:h-[min(580px,calc(100dvh-2.5rem))] sm:max-w-[940px] sm:grid-cols-[300px_minmax(0,1fr)] sm:grid-rows-1 sm:rounded-[30px]">
        {/* ---- the home, lit */}
        <div className="relative isolate overflow-hidden bg-[#0b0b0c] text-white">
          {photo ? <img src={photo} alt="" className="hf-ken absolute inset-0 -z-20 h-full w-full object-cover" /> : (
            // No photo: a drawn backdrop instead of a bare black panel - a soft gold glow, a fine
            // grid and a large outline house.
            <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden bg-[radial-gradient(90%_70%_at_20%_100%,rgba(201,162,77,.28),transparent_60%),linear-gradient(160deg,#1a1d22,#0b0b0c_65%)]">
              <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#e8c97a_1px,transparent_1px),linear-gradient(90deg,#e8c97a_1px,transparent_1px)] [background-size:28px_28px]" />
              <Home className="absolute -right-6 top-1/2 h-56 w-56 -translate-y-1/2 text-[#e8c97a]/[0.09] sm:-right-10 sm:h-72 sm:w-72" strokeWidth={0.8} />
            </div>
          )}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.45),transparent_55%),linear-gradient(180deg,rgba(11,11,12,.35),rgba(11,11,12,.92))]" />
          <span aria-hidden className="hf-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
          {[['14%', '22%', 0], ['80%', '16%', 1.4], ['70%', '64%', 2.6], ['30%', '80%', 1.9]].map(([l, t, d], k) => (
            <span key={k} aria-hidden className="hf-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
          ))}
          <div className="flex h-full flex-col p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]"><CalendarDays className="h-3.5 w-3.5" /> {kicker}</p>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:hidden"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 sm:mt-auto">
              <h2 className="truncate whitespace-nowrap font-serif font-black leading-tight" title={street} style={{ fontSize: fit }}>{street}</h2>
              {place && <p className="mt-0.5 truncate text-[13px] font-semibold text-white/70">{place}</p>}
              {facts && <p className="mt-2 truncate text-[10px] font-black uppercase tracking-[0.2em] text-[#e8c97a]">{facts}</p>}
            </div>
            {/* steps: dots on phones, a list with checks on wider screens */}
            <div className="mt-4 flex gap-1.5 sm:hidden">
              {steps.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i + 1 <= stepNo || done ? 'w-8 bg-[#e8c97a]' : 'w-4 bg-white/25'}`} />)}
            </div>
            <ol className="mt-8 hidden space-y-3 sm:block">
              {steps.map((label, i) => {
                const n = i + 1
                const past = n < stepNo || done
                return (
                  <li key={label} className={`flex items-center gap-3 text-sm font-bold transition-colors duration-300 ${n === stepNo && !done ? 'text-white' : past ? 'text-white/70' : 'text-white/35'}`}>
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black transition-all duration-300 ${past ? 'bg-[#e8c97a] text-[#111827]' : n === stepNo ? 'bg-white text-[#111827] shadow-[0_0_0_4px_rgba(232,201,122,.25)]' : 'bg-white/10'}`}>
                      {past ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
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
          {!done && (
            <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 sm:px-8 sm:pt-7">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#a8843a] dark:text-[#e8c97a]">Step {stepNo} of {steps.length}</p>
                <h3 className="font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{title}</h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="hidden h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white sm:grid"><X className="h-5 w-5" /></button>
            </div>
          )}
          <div className="scrollbar-hide relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={stepKey} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className={done ? 'h-full' : 'px-5 pb-4 pt-3 sm:px-8'}>
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Phones: FlowFooter draws the flow bar (components/ui/FlowDock) into the spot under
              this row instead - Back, "2 / 4", Continue / Send - so every long flow's bar matches. */}
          {!done && footer && (
            <FlowDockHostContext.Provider value={dockHost}>
              <HostFlowDockContext.Provider value={dockStep}>
                <div className="hidden items-center gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/[0.07] sm:flex sm:px-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                  {footer}
                </div>
              </HostFlowDockContext.Provider>
            </FlowDockHostContext.Provider>
          )}
          {!done && footer && <div ref={setDockHost} className="sm:hidden" />}
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Back + the big dark Continue / Send button, the same as the showing window's. */
export function FlowFooter({ onBack, onNext, nextLabel, nextIcon, disabled, busy }: {
  onBack?: () => void
  onNext: () => void
  nextLabel: React.ReactNode
  nextIcon?: React.ReactNode
  disabled?: boolean
  busy?: boolean
}) {
  const dock = useContext(HostFlowDockContext)
  // The bar has room for a word or two: "Continue with 2 days" -> "Continue", the Send steps'
  // icon + name label -> "Send" (the step itself shows who / what is being sent).
  const phoneLabel = typeof nextLabel === 'string' ? (nextLabel.startsWith('Continue') ? 'Continue' : nextLabel) : busy ? 'Sending…' : 'Send'
  return (
    <>
      {dock && (
        <FlowDock inline step={dock.stepNo} total={dock.total} onBack={onBack} backDisabled={busy}
          onContinue={onNext} disabled={disabled} busy={busy} continueLabel={phoneLabel}
          icon={typeof nextLabel === 'string' ? nextIcon : <Send />} />
      )}
      {onBack && (
        <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onBack} disabled={busy}
          className="inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
          <ChevronLeft className="h-4 w-4" /> Back
        </motion.button>
      )}
      <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} disabled={disabled || busy} onClick={onNext}
        className="hf-shine relative ml-auto inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#111827] px-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_16px_34px_-14px_rgba(17,24,39,.9)] transition-opacity disabled:opacity-40 dark:bg-white dark:text-[#111827] sm:flex-none sm:px-9">
        {nextLabel}{nextIcon}
      </motion.button>
    </>
  )
}

// ---------------------------------------------------------------- step: the day

/** The next open-house days (Saturdays and Sundays) from today, `count` of them. */
export function upcomingWeekendDays(count = 6, from?: string) {
  const out: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let k = 0; k < 120 && out.length < count; k++) {
    const iso = isoDay(d)
    if ((d.getDay() === 0 || d.getDay() === 6) && (!from || iso >= from)) out.push(iso)
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function DayStep({ picked, onToggle, max = 1, info, hostingWindow, hint }: {
  picked: string[]
  onToggle: (date: string) => void
  /** How many days they can pick (2 = "offer a second open"). */
  max?: number
  info: (date: string) => DayInfo
  hostingWindow?: HostingWindow
  hint?: React.ReactNode
}) {
  const today = isoDay(new Date())
  const from = hostingWindow?.hosts_from && hostingWindow.hosts_from > today ? hostingWindow.hosts_from : undefined
  const suggested = useMemo(() => upcomingWeekendDays(6, from), [from])
  // A day they chose on the calendar shows up in the row too, so they can see (and undo) it.
  const extra = picked.filter(d => !suggested.includes(d))
  const [own, setOwn] = useState(extra.length > 0)
  const status = (d: string): DayInfo => {
    const i = info(d)
    return { ...i, locked: i.locked || !dayIsHostable(hostingWindow, d) }
  }
  return (
    <div>
      {hint}
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
        Coming weekends {max > 1 && <span className="font-bold normal-case tracking-normal">- pick up to {max}</span>}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[...suggested, ...extra].map((d, i) => {
          const st = status(d)
          const on = picked.includes(d)
          const blocked = !!st.taken || !!st.locked || !!st.requested
          const dt = parseDay(d)
          return (
            <motion.button key={d} type="button" disabled={blocked} onClick={() => onToggle(d)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035, type: 'spring', stiffness: 380, damping: 28 }}
              whileTap={{ scale: 0.94 }}
              title={st.taken ? `Already hosted${st.taken !== 'yes' ? ` by ${st.taken}` : ''}` : st.requested ? 'Already asked - waiting for an answer' : st.locked ? 'This home can\'t be shown that day' : undefined}
              className={`relative isolate flex min-w-0 flex-col items-center rounded-2xl border px-1 py-3 transition-colors disabled:cursor-not-allowed ${on
                ? 'border-transparent text-[#111827]'
                : blocked ? 'border-gray-100 bg-gray-50 text-gray-300 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-gray-600'
                : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.06] dark:border-white/10 dark:bg-white/[0.03] dark:text-white'}`}>
              {on && <motion.span layoutId={`hf-day-${d}`} className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] shadow-[0_12px_22px_-8px_rgba(201,162,77,.8)]" />}
              <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{d === today ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className={`text-2xl font-black leading-tight ${blocked && !on ? 'line-through decoration-2' : ''}`}>{dt.getDate()}</span>
              <span className="text-[10px] font-bold uppercase opacity-60">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
              <span className={`mt-1 text-[9px] font-black uppercase tracking-wide ${on ? 'text-[#111827]' : st.taken ? 'text-emerald-600/70 dark:text-emerald-400/60' : st.requested ? 'text-sky-600 dark:text-sky-300' : st.locked ? 'text-gray-400' : 'text-[#a8843a] dark:text-[#e8c97a]'}`}>
                {on ? 'Picked' : st.taken ? 'Hosted' : st.requested ? 'Requested' : st.locked ? 'Not yet' : st.asked ? 'Asked' : 'Open'}
              </span>
              {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#111827] text-white shadow dark:bg-white dark:text-[#111827]"><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}
            </motion.button>
          )
        })}
      </div>

      <button type="button" onClick={() => setOwn(v => !v)}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5 text-[12px] font-black uppercase tracking-widest transition ${own ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] text-[#7a5f22] dark:text-[#e8c97a]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
        <CalendarPlus className="h-4 w-4" /> {own ? 'Hide the calendar' : 'Pick your own day'}
      </button>
      <AnimatePresence initial={false}>
        {own && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="overflow-hidden">
            <MonthCalendar picked={picked} onPick={onToggle} status={status} min={from || today} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MonthCalendar({ picked, onPick, status, min }: { picked: string[]; onPick: (d: string) => void; status: (d: string) => DayInfo; min: string }) {
  const start = parseDay(min)
  const [month, setMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1))
  const [dir, setDir] = useState(1)
  const first = month.getDay()
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  const canBack = month > new Date(start.getFullYear(), start.getMonth(), 1)
  const go = (n: number) => { setDir(n); setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1)) }
  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-3 dark:border-white/10 dark:bg-[#0b0b0c] sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} disabled={!canBack} aria-label="Last month" className="grid h-10 w-10 place-items-center rounded-full text-gray-500 transition hover:bg-white disabled:opacity-25 dark:hover:bg-white/10"><ChevronLeft className="h-5 w-5" /></button>
        <p className="font-serif text-lg font-black text-[#111827] dark:text-white">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        <button type="button" onClick={() => go(1)} aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-full text-gray-500 transition hover:bg-white dark:hover:bg-white/10"><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-wider text-gray-400">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={month.toISOString()} initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -18 }} transition={{ duration: 0.18 }}
          className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />
            const st = status(d)
            const on = picked.includes(d)
            const off = d < min || !!st.taken || !!st.locked || !!st.requested
            const wkd = [0, 6].includes(parseDay(d).getDay())
            return (
              <button key={d} type="button" disabled={off} onClick={() => onPick(d)}
                title={st.taken ? 'Already hosted' : undefined}
                className={`relative aspect-square rounded-xl text-[15px] font-black transition ${on ? 'bg-[#111827] text-white shadow-md dark:bg-white dark:text-[#111827]'
                  : off ? 'text-gray-300 dark:text-gray-700' : `${wkd ? 'text-[#7a5f22] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'} hover:bg-[#C9A24D]/15`} ${st.taken && !on ? 'line-through' : ''}`}>
                {parseDay(d).getDate()}
                {st.requested && !on && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-500" />}
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>
      <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">Weekends in gold · crossed-out days already have a host</p>
    </div>
  )
}

// ---------------------------------------------------------------- step: the time

export type TimePick = { start: string; end: string } | { anytime: true }
export const isAnytime = (t: TimePick | null): t is { anytime: true } => !!t && 'anytime' in t

const SUGGESTED_TIMES: [string, string][] = [['11:00', '13:00'], ['12:00', '14:00'], ['13:00', '15:00'], ['13:00', '16:00'], ['14:00', '16:00']]
const START_PERIODS = [
  { id: 'morning', label: 'Morning', icon: Sunrise, from: 8 * 60, to: 11 * 60 + 30 },
  { id: 'afternoon', label: 'Afternoon', icon: Sun, from: 12 * 60, to: 16 * 60 + 30 },
  { id: 'evening', label: 'Evening', icon: Moon, from: 17 * 60, to: 20 * 60 },
] as const

export function TimeStep({ value, onChange, allowAnytime = false, days }: {
  value: TimePick | null
  onChange: (t: TimePick | null) => void
  /** Find a Host: "Anytime - the host picks the hours". */
  allowAnytime?: boolean
  /** The day(s) picked, shown as a reminder. */
  days: string[]
}) {
  const same = (a: [string, string]) => !!value && !isAnytime(value) && value.start === a[0] && value.end === a[1]
  const suggestedOn = SUGGESTED_TIMES.some(same) || isAnytime(value)
  const [own, setOwn] = useState(!!value && !suggestedOn)
  const [period, setPeriod] = useState<(typeof START_PERIODS)[number]['id']>('afternoon')
  const start = value && !isAnytime(value) ? value.start : null
  const startsIn = (p: (typeof START_PERIODS)[number]) => Array.from({ length: (p.to - p.from) / 30 + 1 }, (_, i) => fromMinutes(p.from + i * 30))
  const lengths = start ? [60, 90, 120, 150, 180, 240, 300].filter(n => minutes(start) + n <= 23 * 60 + 30) : []
  return (
    <div>
      <p className="mb-3 flex flex-wrap items-center gap-x-2 text-[13px] font-bold text-gray-500 dark:text-gray-400">
        <CalendarDays className="h-4 w-4 text-[#C9A24D]" /> {days.map(dayLong).join(' and ')}
      </p>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Popular open-house times</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SUGGESTED_TIMES.map((t, i) => {
          const on = same(t)
          return (
            <motion.button key={t.join()} type="button" onClick={() => { setOwn(false); onChange({ start: t[0], end: t[1] }) }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }} whileTap={{ scale: 0.95 }}
              className={`relative flex items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-[15px] font-black transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:text-white'}`}>
              <Clock className={`h-4 w-4 ${on ? 'text-[#e8c97a] dark:text-[#a8843a]' : 'text-[#C9A24D]'}`} />{clockRange(t[0], t[1])}
              {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}
            </motion.button>
          )
        })}
        {allowAnytime && (
          <motion.button type="button" onClick={() => { setOwn(false); onChange({ anytime: true }) }} whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-[15px] font-black transition-colors ${isAnytime(value) ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:text-white'}`}>
            <Sparkles className="h-4 w-4 text-[#C9A24D]" /> Any time
          </motion.button>
        )}
      </div>

      <button type="button" onClick={() => { setOwn(v => !v); if (!own && suggestedOn) onChange(null) }}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5 text-[12px] font-black uppercase tracking-widest transition ${own ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] text-[#7a5f22] dark:text-[#e8c97a]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
        <Clock className="h-4 w-4" /> {own ? 'Back to popular times' : 'Pick your own time'}
      </button>
      <AnimatePresence initial={false}>
        {own && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="overflow-hidden">
            <div className="mt-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-3 dark:border-white/10 dark:bg-[#0b0b0c] sm:p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">1. It starts at</p>
              <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
                {START_PERIODS.map(p => (
                  <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
                    className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider ${period === p.id ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {period === p.id && <motion.span layoutId="hf-period" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <p.icon className="relative h-3.5 w-3.5" /><span className="relative">{p.label}</span>
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={period} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                  className="mt-2 grid grid-cols-4 gap-1.5">
                  {startsIn(START_PERIODS.find(p => p.id === period)!).map(t => (
                    <button key={t} type="button" onClick={() => onChange({ start: t, end: fromMinutes(Math.min(minutes(t) + 120, 23 * 60 + 30)) })}
                      className={`rounded-xl border py-3 text-[13px] font-black transition-colors ${start === t ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                      {clock(t)}
                    </button>
                  ))}
                </motion.div>
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {start && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">2. For how long</p>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {lengths.map(n => {
                        const end = fromMinutes(minutes(start) + n)
                        const on = !!value && !isAnytime(value) && value.end === end
                        return (
                          <button key={n} type="button" onClick={() => onChange({ start, end })}
                            className={`rounded-xl border px-1 py-2.5 text-center transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                            <span className="block text-[14px] font-black">{n % 60 ? `${Math.floor(n / 60)}½` : n / 60} hr{n > 60 ? 's' : ''}</span>
                            <span className={`block text-[10px] font-bold ${on ? 'opacity-70' : 'text-gray-400'}`}>until {clock(end)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {value && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl bg-[#C9A24D]/10 px-4 py-3 text-center text-sm font-black text-[#7a5f22] dark:text-[#e8c97a]">
            {isAnytime(value) ? 'Any time that day - the host picks the hours' : clockRange(value.start, value.end)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The summary box on the last step. */
export function Summary({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#C9A24D]/45 p-4">
      <dl className="space-y-2">
        {rows.map(r => (
          <div key={r.label} className="flex items-baseline gap-3">
            <dt className="w-16 shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-[#a8843a] dark:text-[#e8c97a]">{r.label}</dt>
            <dd className="min-w-0 text-[14px] font-bold text-[#111827] dark:text-white">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** The "sent" moment - a check that draws itself, a burst, then the window closes on its own. */
// extra: one more thing to offer under the message (e.g. "Also text or email them") - it stays up longer.
export function SentMoment({ title, text, onClose, ms = 2600, extra }: { title: string; text: React.ReactNode; onClose: () => void; ms?: number; extra?: React.ReactNode }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, ms)
    return () => window.clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="flex h-full min-h-[340px] flex-col items-center justify-center px-6 py-12 text-center">
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
      <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-7 font-serif text-3xl font-black text-[#111827] dark:text-white">{title}</motion.h3>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-2 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">{text}</motion.p>
      {extra && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-5">{extra}</motion.div>}
      <div className="mt-7 h-1 w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <motion.span className="block h-full rounded-full bg-[#C9A24D]" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: ms / 1000 - 0.1, ease: 'linear' }} />
      </div>
      <button type="button" onClick={onClose} className="mt-4 text-[11px] font-black uppercase tracking-widest text-gray-400 transition hover:text-[#111827] dark:hover:text-white">Close</button>
    </motion.div>
  )
}

const HOST_FLOW_CSS = `
.hf-ken{animation:hfKen 16s ease-out both}
@keyframes hfKen{from{transform:scale(1.15)}to{transform:scale(1.02)}}
.hf-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);transform:translateX(-100%);animation:hfEdge 6s ease-in-out infinite;will-change:transform}
@keyframes hfEdge{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.hf-spark{width:4px;height:4px;border-radius:999px;background:#e8c97a;box-shadow:0 0 10px 2px #e8c97a;opacity:0;animation:hfSpark 7s ease-in-out infinite}
@keyframes hfSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.hf-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-100%);animation:hfShine 3.4s ease-in-out infinite}
@keyframes hfShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.hf-ken,.hf-edge,.hf-spark,.hf-shine:after{animation:none}}
`
