'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Moon, Sparkles, Sun, Sunrise, X } from 'lucide-react'
import { backdropMotion, useIsPhone, useSheetMotion, useSwipeToClose } from './windowMotion'

// One date & time picker for everything that isn't the open-house flows (user, 10/22 - "make it
// like we really have it"): the same pieces as the showing window and the host flows, step-locked
// so older agents never wonder what to tap next -
//   (1) a day: quick suggestions, the next few days as big tiles, or "Pick your own day" (a full
//       month calendar, with a month / year jump for far-off dates)
//   (2) a part of the day: Morning / Afternoon / Evening (or popular blocks for a time range)
//   (3) a time - and a plain-English line saying exactly what was picked.
// Days and times that can't be used are crossed out. Values are the same strings the old inputs
// gave: dates YYYY-MM-DD, times HH:MM (24h), both local. `WhenSheet` wraps it in a window (a
// slide-up sheet on phones) with Cancel / Done.

// ---------------------------------------------------------------- dates & times

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const toMin = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + (m || 0) }
const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`
/** "9 AM", "9:30 AM". */
export const clockText = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
/** "1 – 3 PM", or "11 AM – 1 PM" when the halves of the day differ. */
export const rangeText = (a: string, b: string) => {
  const x = clockText(a), y = clockText(b)
  return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)} – ${y}` : `${x} – ${y}`
}
/** "Saturday, October 24" (+ the year when it isn't this year). */
export const dayText = (s: string, short = false) => {
  const d = parseYmd(s)
  const opts: Intl.DateTimeFormatOptions = short ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long', month: 'long', day: 'numeric' }
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return d.toLocaleDateString('en-US', opts)
}
/** Today + n days, as YYYY-MM-DD. */
export const addDays = (n: number, from: Date = new Date()) => { const d = new Date(from); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return ymd(d) }
/** The next given weekday (0 = Sunday). `includeToday` lets "this Saturday" be today on a Saturday. */
export const nextWeekday = (dow: number, includeToday = false) => {
  const d = new Date(); d.setHours(12, 0, 0, 0)
  let k = (dow - d.getDay() + 7) % 7
  if (k === 0 && !includeToday) k = 7
  return addDays(k, d)
}

export type WhenMode = 'date' | 'time' | 'datetime' | 'range'
/** time = the time (or a range's start); end = a range's end; anytime = "Any time that day". */
export type WhenValue = { date: string | null; time: string | null; end?: string | null; anytime?: boolean }
export const emptyWhen: WhenValue = { date: null, time: null, end: null, anytime: false }
/** A quick pick ("Tomorrow 8 AM") - sets the whole answer in one tap. */
export type WhenSuggestion = { label: string; date: string; time?: string | null; end?: string | null; anytime?: boolean }

export function whenComplete(v: WhenValue, mode: WhenMode): boolean {
  if (mode === 'time') return !!v.time
  if (!v.date) return false
  if (mode === 'date') return true
  if (v.anytime) return true
  return mode === 'range' ? !!(v.time && v.end) : !!v.time
}

/** The plain-English answer: "Saturday, October 24 at 9 AM". */
/** `short` = "Thu, Nov 6 at 2 PM" - for tight spots that must stay on one line. */
export function whenText(v: WhenValue, mode: WhenMode, anytimeText = 'any time', short = false): string {
  if (mode === 'time') return v.time ? clockText(v.time) : ''
  if (!v.date) return ''
  const day = dayText(v.date, short)
  if (mode === 'date') return day
  if (v.anytime) return `${day} · ${anytimeText}`
  if (mode === 'range') return v.time && v.end ? `${day}, ${rangeText(v.time, v.end)}` : v.time ? `${day} from ${clockText(v.time)}` : day
  return v.time ? `${day} at ${clockText(v.time)}` : day
}

// Parts of the day (minutes from midnight, inclusive), in half hours.
export type WhenPeriods = { morning: [number, number]; afternoon: [number, number]; evening: [number, number] }
const DEFAULT_PERIODS: WhenPeriods = { morning: [6 * 60, 11 * 60 + 30], afternoon: [12 * 60, 16 * 60 + 30], evening: [17 * 60, 21 * 60 + 30] }
const PERIOD_META = [
  { id: 'morning', label: 'Morning', icon: Sunrise },
  { id: 'afternoon', label: 'Afternoon', icon: Sun },
  { id: 'evening', label: 'Evening', icon: Moon },
] as const
type PeriodId = (typeof PERIOD_META)[number]['id']
const periodOf = (t: string): PeriodId => { const m = toMin(t); return m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : 'evening' }
const OPEN_HOUSE_BLOCKS: [string, string][] = [['11:00', '13:00'], ['12:00', '14:00'], ['13:00', '15:00'], ['13:00', '16:00'], ['14:00', '16:00']]

// Readable text on a custom accent (a form's own colour).
const inkOn = (hex: string) => {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  if (!m) return '#ffffff'
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#111827' : '#ffffff'
}

// ---------------------------------------------------------------- the picker

export type WhenPickerProps = {
  mode: WhenMode
  value: WhenValue
  onChange: (v: WhenValue) => void
  /** Quick picks shown first ("Tomorrow 8 AM", "Next Monday"). */
  suggestions?: WhenSuggestion[]
  suggestionsLabel?: string
  /** How many day tiles (default 8). */
  days?: number
  /** Tiles are the coming Saturdays and Sundays only (open houses). */
  weekendsOnly?: boolean
  /** Earliest day - default today. `null` = no limit (past dates allowed, e.g. a form question). */
  minDate?: string | null
  maxDate?: string | null
  /** A day that can't be used: return the reason ("Already scheduled") and it's crossed out. */
  dayOff?: (date: string) => string | false | null | undefined
  /** A time that can't be used (crossed out). */
  timeOff?: (date: string | null, time: string) => string | false | null | undefined
  /** Busy blocks from a connected calendar - times that overlap are crossed out. */
  busy?: { start: string; end: string }[]
  /** How long a picked time lasts, for the busy check (default 30 minutes). */
  slotMinutes?: number
  /** The line under the calendar / times that explains the cross-outs. */
  offNote?: string
  /** Offer "Any time" (no set time). A string is its label. */
  allowAnytime?: boolean | string
  periods?: WhenPeriods
  /** Range mode: the popular blocks (default: open-house times). */
  rangeBlocks?: [string, string][]
  rangeBlocksLabel?: string
  /** A custom accent (a form's colour); default is the gold house look. */
  accent?: string
  /** The plain-English line at the bottom (default on). */
  showSummary?: boolean
  summaryPrefix?: string
  /** Tiles that are weekends read in gold on the calendar (default on). */
  goldWeekends?: boolean
}

export default function WhenPicker(props: WhenPickerProps) {
  const {
    mode, value, onChange, suggestions = [], suggestionsLabel = 'Quick picks', days = 8, weekendsOnly = false,
    maxDate = null, dayOff, timeOff, busy, slotMinutes = 30, offNote, allowAnytime = false,
    periods = DEFAULT_PERIODS, rangeBlocks = OPEN_HOUSE_BLOCKS, rangeBlocksLabel = 'Popular times', accent,
    showSummary = true, summaryPrefix, goldWeekends = true,
  } = props
  const uid = useId().replace(/:/g, '')
  const today = ymd(new Date())
  const noLimit = props.minDate === null
  const min = props.minDate === undefined ? today : props.minDate
  const anytimeLabel = typeof allowAnytime === 'string' ? allowAnytime : 'Any time'
  const hasDay = mode !== 'time'
  const hasTime = mode !== 'date'

  // ---- busy blocks -> crossed-out times
  const busyMs = useMemo(() => (busy || []).map(b => [Date.parse(b.start), Date.parse(b.end)] as [number, number]).filter(([a, b]) => a < b), [busy])
  const offReason = (date: string | null, t: string): string | null => {
    const own = timeOff?.(date, t)
    if (own) return own
    if (date && busyMs.length) {
      const d = parseYmd(date); d.setHours(0, toMin(t), 0, 0)
      const a = d.getTime(), b = a + slotMinutes * 60000
      if (busyMs.some(([s, e]) => s < b && e > a)) return 'Busy on your calendar'
    }
    return null
  }
  const isPast = (date: string | null, t: string) => {
    if (noLimit || !date || date !== today) return false
    const now = new Date()
    return toMin(t) <= now.getHours() * 60 + now.getMinutes()
  }
  const dayReason = (d: string) => dayOff?.(d) || null
  const dayBlocked = (d: string) => (!noLimit && !!min && d < min) || (!!maxDate && d > maxDate) || !!dayReason(d)

  // ---- the day tiles
  const tiles = useMemo(() => {
    const out: string[] = []
    const start = parseYmd(min && min > today ? min : today)
    for (let k = 0; k < 120 && out.length < days; k++) {
      const d = new Date(start); d.setDate(start.getDate() + k)
      const iso = ymd(d)
      if (maxDate && iso > maxDate) break
      if (weekendsOnly && d.getDay() !== 0 && d.getDay() !== 6) continue
      out.push(iso)
    }
    return out
  }, [min, today, days, maxDate, weekendsOnly])
  const [ownDay, setOwnDay] = useState(() => !!value.date && !tiles.includes(value.date))

  // ---- the part of the day
  const [period, setPeriod] = useState<PeriodId | null>(() => (value.time && mode !== 'range' ? periodOf(value.time) : null))
  const slotsIn = (p: PeriodId) => {
    const [a, b] = periods[p]
    const out: string[] = []
    for (let m = a; m <= b; m += 30) out.push(fromMin(m))
    // A saved time that isn't on the half hour still shows (and stays picked).
    if (value.time && mode !== 'range' && periodOf(value.time) === p && !out.includes(value.time)) out.push(value.time)
    return out.sort()
  }
  const periodOpen = (p: PeriodId) => slotsIn(p).some(t => !isPast(value.date, t))

  // ---- range mode: popular blocks, or their own start + length
  const blockOn = (b: [string, string]) => !value.anytime && value.time === b[0] && value.end === b[1]
  const [ownRange, setOwnRange] = useState(() => mode === 'range' && !!value.time && !rangeBlocks.some(blockOn))
  const [rangePeriod, setRangePeriod] = useState<PeriodId>(() => (value.time ? periodOf(value.time) : 'afternoon'))

  const set = (patch: Partial<WhenValue>) => onChange({ ...value, ...patch })
  const pickDay = (d: string) => {
    // Keep the time when it still works on the new day; otherwise step 2 starts again.
    const keep = !!value.time && !isPast(d, value.time) && !offReason(d, value.time)
    onChange({ ...value, date: d, ...(keep ? {} : { time: null, end: null }) })
    if (!keep && mode === 'datetime' && !value.anytime) setPeriod(null)
  }
  const pickSuggestion = (s: WhenSuggestion) => {
    onChange({ date: s.date, time: s.time ?? null, end: s.end ?? null, anytime: !!s.anytime })
    if (s.time) { setPeriod(periodOf(s.time)); setRangePeriod(periodOf(s.time)) }
    setOwnDay(!tiles.includes(s.date))
  }
  const suggestionOn = (s: WhenSuggestion) => value.date === s.date && (mode === 'date' || ((s.time ?? null) === value.time && !!s.anytime === !!value.anytime))

  // Stage numbers for the labels.
  const dayDone = !!value.date
  const periodDone = !!period || !!value.anytime
  const stage = mode === 'time' ? (!period ? 1 : 2) : !dayDone ? 1 : mode === 'datetime' ? (!periodDone ? 2 : 3) : 2
  const locked = (n: number) => stage < n

  // Selected-state paint: the gold house look, or the form's own accent.
  const onStyle = accent ? { backgroundColor: accent, borderColor: accent, color: inkOn(accent) } : undefined
  const onClass = accent ? '' : 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]'
  const ringStyle = accent ? { boxShadow: `0 0 0 2px ${accent}55` } : undefined
  const ringClass = accent ? '' : 'ring-2 ring-[#C9A24D]/45'

  const anyDayOff = tiles.some(dayBlocked)
  const anyTimeOff = !!busyMs.length || !!timeOff

  return (
    <div className="when-picker">
      {/* ---------- 1. the day */}
      {hasDay && (
        <>
          {suggestions.length > 0 && (
            <>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{suggestionsLabel}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {suggestions.map((s, i) => {
                  const on = suggestionOn(s)
                  const off = dayBlocked(s.date) || (!!s.time && (isPast(s.date, s.time) || !!offReason(s.date, s.time)))
                  return (
                    <motion.button key={s.label} type="button" disabled={off} onClick={() => pickSuggestion(s)}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.95 }}
                      style={on ? onStyle : undefined}
                      className={`inline-flex min-h-[48px] items-center gap-2 rounded-2xl border px-4 text-[14px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${on ? onClass : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.03] dark:text-white'}`}>
                      <Sparkles className={`h-4 w-4 ${on ? 'opacity-80' : 'text-[#C9A24D]'}`} />
                      <span className={off ? 'line-through decoration-2' : ''}>{s.label}</span>
                      {on && <Check className="h-4 w-4" strokeWidth={3} />}
                    </motion.button>
                  )
                })}
              </div>
            </>
          )}

          {mode !== 'date' && <StageLabel n={1} active={stage === 1} done={dayDone} text="Pick a day" accent={accent} />}
          {mode === 'date' && <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{weekendsOnly ? 'Coming weekends' : 'Pick a day'}</p>}
          <div className="grid grid-cols-4 gap-2 sm:[grid-template-columns:repeat(var(--wp-cols),minmax(0,1fr))]" style={{ ['--wp-cols' as string]: String(Math.min(Math.max(tiles.length, 1), 8)) }}>
            {tiles.map((d, i) => {
              const on = value.date === d
              const reason = dayReason(d)
              const blocked = dayBlocked(d)
              const dt = parseYmd(d)
              return (
                <motion.button key={d} type="button" disabled={blocked} onClick={() => pickDay(d)} title={reason || undefined}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, type: 'spring', stiffness: 380, damping: 28 }}
                  whileTap={{ scale: 0.94 }}
                  className={`relative isolate flex min-h-[84px] min-w-0 flex-col items-center justify-center rounded-2xl border px-1 py-2.5 transition-colors disabled:cursor-not-allowed ${on
                    ? 'border-transparent text-[#111827]'
                    : blocked ? 'border-gray-100 bg-gray-50 text-gray-300 dark:border-white/[0.05] dark:bg-white/[0.02] dark:text-gray-600'
                    : `border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.06] dark:border-white/10 dark:bg-white/[0.03] dark:text-white ${stage === 1 && !accent ? 'ring-1 ring-[#C9A24D]/30' : ''}`}`}
                  style={on && accent ? { color: inkOn(accent) } : undefined}>
                  {on && (
                    <motion.span layoutId={`wp-day-${uid}`} transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      className={`absolute inset-0 -z-10 rounded-2xl ${accent ? '' : 'bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] shadow-[0_12px_22px_-8px_rgba(201,162,77,.8)]'}`}
                      style={accent ? { backgroundColor: accent, boxShadow: `0 12px 22px -10px ${accent}` } : undefined} />
                  )}
                  <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{d === today ? 'Today' : d === addDays(1) ? 'Tmrw' : dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className={`text-2xl font-black leading-tight ${blocked && !on ? 'line-through decoration-2 decoration-rose-400/70' : ''}`}>{dt.getDate()}</span>
                  <span className="text-[10px] font-bold uppercase opacity-60">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
                  {(on || reason) && <span className="mt-0.5 max-w-full truncate px-1 text-[8.5px] font-black uppercase tracking-wide">{on ? 'Picked' : 'Taken'}</span>}
                  {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#111827] text-white shadow dark:bg-white dark:text-[#111827]"><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}
                </motion.button>
              )
            })}
          </div>

          <button type="button" onClick={() => setOwnDay(v => !v)}
            className={`mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-[12px] font-black uppercase tracking-widest transition ${ownDay ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] text-[#7a5f22] dark:text-[#e8c97a]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
            <CalendarPlus className="h-4 w-4" /> {ownDay ? 'Hide the calendar' : 'Pick your own day'}
          </button>
          <AnimatePresence initial={false}>
            {ownDay && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="overflow-hidden">
                <MonthCalendar picked={value.date} onPick={pickDay} blocked={dayBlocked} reason={dayReason} min={noLimit ? null : min} max={maxDate}
                  goldWeekends={goldWeekends} accent={accent} note={offNote && anyDayOff ? offNote : undefined} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ---------- 2/3. the time */}
      {(mode === 'time' || mode === 'datetime') && (
        <div className={hasDay ? 'mt-4' : ''}>
          <StageLabel n={hasDay ? 2 : 1} active={stage === (hasDay ? 2 : 1)} done={periodDone} locked={hasDay && locked(2)} text="Morning, afternoon or evening" accent={accent} />
          <div className={`flex gap-1 rounded-2xl bg-gray-100 p-1 transition-opacity duration-300 dark:bg-white/[0.06] ${hasDay && locked(2) ? 'pointer-events-none opacity-40' : ''} ${stage === (hasDay ? 2 : 1) ? ringClass : ''}`}
            style={stage === (hasDay ? 2 : 1) ? ringStyle : undefined}>
            {PERIOD_META.map(p => {
              const open = periodOpen(p.id)
              const on = period === p.id && !value.anytime
              return (
                <button key={p.id} type="button" disabled={!open} onClick={() => { setPeriod(p.id); if (value.anytime) set({ anytime: false }) }}
                  className={`relative flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${on ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                  {on && <motion.span layoutId={`wp-period-${uid}`} className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <p.icon className="relative h-4 w-4" /><span className="relative">{p.label}</span>
                </button>
              )
            })}
          </div>
          {allowAnytime && (
            <button type="button" disabled={hasDay && !dayDone} onClick={() => { setPeriod(null); set({ anytime: true, time: null, end: null }) }}
              style={value.anytime ? onStyle : undefined}
              className={`mt-2 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl border text-[13px] font-black transition-colors disabled:pointer-events-none disabled:opacity-40 ${value.anytime ? onClass : 'border-dashed border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
              <Sparkles className="h-4 w-4" /> {anytimeLabel}
              {value.anytime && <Check className="h-4 w-4" strokeWidth={3} />}
            </button>
          )}

          <StageLabel n={hasDay ? 3 : 2} active={stage === (hasDay ? 3 : 2) && !value.anytime} done={!!value.time} locked={!period || !!value.anytime} text="Pick a time" accent={accent} />
          <AnimatePresence mode="wait" initial={false}>
            {period && !value.anytime && (!hasDay || dayDone) ? (
              <motion.div key={`${value.date}-${period}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
                className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {slotsIn(period).map((t, i) => {
                  const on = value.time === t
                  const past = isPast(value.date, t)
                  const reason = past ? null : offReason(value.date, t)
                  return (
                    <motion.button key={t} type="button" disabled={past || !!reason} onClick={() => set({ time: t, anytime: false })} title={reason || undefined}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.012 }} whileTap={{ scale: 0.92 }}
                      style={on ? onStyle : undefined}
                      className={`relative min-h-[46px] rounded-xl border py-2.5 text-[13px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${on ? onClass : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                      <span className={reason ? 'line-through decoration-2 decoration-rose-400/80' : ''}>{clockText(t)}</span>
                      {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></motion.span>}
                    </motion.button>
                  )
                })}
              </motion.div>
            ) : (
              <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}
                className="grid grid-cols-4 gap-1.5 opacity-40 sm:grid-cols-6" aria-hidden>
                {['1 PM', '1:30 PM', '2 PM', '2:30 PM', '3 PM', '3:30 PM'].map((t, i) => (
                  <span key={t} className={`rounded-xl border border-dashed border-gray-300 py-2.5 text-center text-[13px] font-black text-gray-400 dark:border-white/15 ${i > 3 ? 'hidden sm:block' : ''}`}>{value.anytime ? '—' : t}</span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {anyTimeOff && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400"><span className="h-px w-4 bg-rose-400/70" /> {offNote || 'Crossed-out times are already booked on your calendar.'}</p>
          )}
        </div>
      )}

      {mode === 'range' && (
        <div className="mt-4">
          <StageLabel n={2} active={stage === 2} done={whenComplete(value, 'range')} locked={locked(2)} text="Pick the hours" accent={accent} />
          <div className={`transition-opacity duration-300 ${locked(2) ? 'pointer-events-none opacity-40' : ''}`}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{rangeBlocksLabel}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {rangeBlocks.map((b, i) => {
                const on = blockOn(b)
                return (
                  <motion.button key={b.join()} type="button" onClick={() => { setOwnRange(false); set({ time: b[0], end: b[1], anytime: false }) }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }} whileTap={{ scale: 0.95 }}
                    style={on ? onStyle : undefined}
                    className={`relative flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border px-3 text-[15px] font-black transition-colors ${on ? onClass : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                    <Clock className={`h-4 w-4 ${on ? 'opacity-80' : 'text-[#C9A24D]'}`} />{rangeText(b[0], b[1])}
                    {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}
                  </motion.button>
                )
              })}
              {allowAnytime && (
                <motion.button type="button" onClick={() => { setOwnRange(false); set({ anytime: true, time: null, end: null }) }} whileTap={{ scale: 0.95 }}
                  style={value.anytime ? onStyle : undefined}
                  className={`flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border px-3 text-[14px] font-black transition-colors ${value.anytime ? onClass : 'border-dashed border-gray-300 text-gray-500 hover:border-[#C9A24D] dark:border-white/15 dark:text-gray-400'}`}>
                  <Sparkles className="h-4 w-4 text-[#C9A24D]" /> {anytimeLabel}
                </motion.button>
              )}
            </div>
            <button type="button" onClick={() => setOwnRange(v => !v)}
              className={`mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-[12px] font-black uppercase tracking-widest transition ${ownRange ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] text-[#7a5f22] dark:text-[#e8c97a]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
              <Clock className="h-4 w-4" /> {ownRange ? 'Back to popular times' : 'Pick your own time'}
            </button>
            <AnimatePresence initial={false}>
              {ownRange && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="overflow-hidden">
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-3 dark:border-white/10 dark:bg-[#0b0b0c] sm:p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">1. It starts at</p>
                    <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
                      {PERIOD_META.map(p => (
                        <button key={p.id} type="button" onClick={() => setRangePeriod(p.id)}
                          className={`relative flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider ${rangePeriod === p.id ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                          {rangePeriod === p.id && <motion.span layoutId={`wp-rperiod-${uid}`} className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                          <p.icon className="relative h-3.5 w-3.5" /><span className="relative">{p.label}</span>
                        </button>
                      ))}
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={rangePeriod} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
                        className="mt-2 grid grid-cols-4 gap-1.5">
                        {(() => { const [a, b] = periods[rangePeriod]; const out: string[] = []; for (let m = a; m <= b; m += 30) out.push(fromMin(m)); if (value.time && periodOf(value.time) === rangePeriod && !out.includes(value.time)) out.push(value.time); return out.sort() })().map(t => {
                          const on = value.time === t && !value.anytime
                          const past = isPast(value.date, t)
                          return (
                            <button key={t} type="button" disabled={past} onClick={() => set({ time: t, end: fromMin(Math.min(toMin(t) + 120, 23 * 60 + 30)), anytime: false })}
                              style={on ? onStyle : undefined}
                              className={`min-h-[44px] rounded-xl border py-2.5 text-[13px] font-black transition-colors disabled:opacity-30 ${on ? onClass : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                              {clockText(t)}
                            </button>
                          )
                        })}
                      </motion.div>
                    </AnimatePresence>
                    <AnimatePresence initial={false}>
                      {value.time && !value.anytime && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">2. For how long</p>
                          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                            {[30, 60, 90, 120, 150, 180, 240, 300].filter(n => toMin(value.time!) + n <= 23 * 60 + 30).map(n => {
                              const end = fromMin(toMin(value.time!) + n)
                              const on = value.end === end
                              return (
                                <button key={n} type="button" onClick={() => set({ end })}
                                  style={on ? onStyle : undefined}
                                  className={`min-h-[48px] rounded-xl border px-1 py-2 text-center transition-colors ${on ? onClass : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                                  <span className="block text-[14px] font-black">{n < 60 ? '30 min' : `${n % 60 ? `${Math.floor(n / 60)}½` : n / 60} hr${n > 60 ? 's' : ''}`}</span>
                                  <span className={`block text-[10px] font-bold ${on ? 'opacity-70' : 'text-gray-400'}`}>until {clockText(end)}</span>
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
          </div>
        </div>
      )}

      {/* ---------- the answer, in words */}
      {showSummary && (
        <AnimatePresence initial={false}>
          {whenComplete(value, mode) && (
            <motion.p key="sum" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#C9A24D]/10 px-4 py-3 text-center text-[15px] font-black text-[#7a5f22] dark:text-[#e8c97a]"
              style={accent ? { backgroundColor: `${accent}1A`, color: undefined } : undefined}>
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{summaryPrefix ? `${summaryPrefix} ` : ''}{whenText(value, mode, typeof allowAnytime === 'string' ? allowAnytime.toLowerCase() : 'any time', true)}</span>
            </motion.p>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}

// "1 Pick a day": gold while it's the one to do, a check once done, grey while locked.
function StageLabel({ n, text, active, done, locked, accent }: { n: number; text: string; active?: boolean; done?: boolean; locked?: boolean; accent?: string }) {
  return (
    <p className={`mb-2 mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors duration-300 first:mt-0 ${active ? 'text-[#a8843a] dark:text-[#e8c97a]' : done ? 'text-gray-500 dark:text-gray-400' : 'text-gray-300 dark:text-gray-600'}`}
      style={active && accent ? { color: accent } : undefined}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[9px] transition-all duration-300 ${done ? 'bg-[#C9A24D] text-[#111827]' : active ? 'bg-[#111827] text-white shadow-[0_0_0_3px_rgba(201,162,77,.3)] dark:bg-white dark:text-[#111827]' : 'bg-gray-100 text-gray-400 dark:bg-white/10'}`}
        style={done && accent ? { backgroundColor: accent, color: inkOn(accent) } : undefined}>
        {done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : n}
      </span>
      {text}{locked && !done && <span className="hidden normal-case tracking-normal sm:inline">&nbsp;- pick the step above first</span>}
    </p>
  )
}

// ---------------------------------------------------------------- the month calendar

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function MonthCalendar({ picked, onPick, blocked, reason, min, max, goldWeekends, accent, note }: {
  picked: string | null
  onPick: (d: string) => void
  blocked: (d: string) => boolean
  reason: (d: string) => string | null
  min: string | null
  max: string | null
  goldWeekends: boolean
  accent?: string
  note?: string
}) {
  const anchor = parseYmd(picked || (min && min > ymd(new Date()) ? min : ymd(new Date())))
  const [month, setMonth] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  const [dir, setDir] = useState(1)
  // Tap the month name: jump by month and year (a far-off date shouldn't take 40 taps).
  const [jump, setJump] = useState<null | 'months' | 'years'>(null)
  const [yearPage, setYearPage] = useState(month.getFullYear())
  const first = month.getDay()
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => ymd(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  const minMonth = min ? new Date(parseYmd(min).getFullYear(), parseYmd(min).getMonth(), 1) : null
  const maxMonth = max ? new Date(parseYmd(max).getFullYear(), parseYmd(max).getMonth(), 1) : null
  const canBack = !minMonth || month > minMonth
  const canFwd = !maxMonth || month < maxMonth
  const go = (n: number) => { setDir(n); setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1)) }
  const monthAllowed = (y: number, m: number) => {
    const d = new Date(y, m, 1)
    return (!minMonth || d >= minMonth) && (!maxMonth || d <= maxMonth)
  }
  const navBtn = 'grid h-11 w-11 place-items-center rounded-full text-gray-500 transition hover:bg-white disabled:opacity-25 dark:hover:bg-white/10'
  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-3 dark:border-white/10 dark:bg-[#0b0b0c] sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => (jump === 'years' ? setYearPage(y => y - 12) : jump === 'months' ? setMonth(m => new Date(m.getFullYear() - 1, m.getMonth(), 1)) : go(-1))}
          disabled={!jump && !canBack} aria-label="Back" className={navBtn}><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => { setYearPage(month.getFullYear()); setJump(j => (j ? null : 'months')) }}
          className="rounded-xl px-3 py-1.5 font-serif text-lg font-black text-[#111827] transition hover:bg-white dark:text-white dark:hover:bg-white/10">
          {jump === 'years' ? `${yearPage - 5} – ${yearPage + 6}` : jump === 'months' ? month.getFullYear() : month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </button>
        <button type="button" onClick={() => (jump === 'years' ? setYearPage(y => y + 12) : jump === 'months' ? setMonth(m => new Date(m.getFullYear() + 1, m.getMonth(), 1)) : go(1))}
          disabled={!jump && !canFwd} aria-label="Forward" className={navBtn}><ChevronRight className="h-5 w-5" /></button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {jump === 'months' ? (
          <motion.div key="months" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((m, i) => {
                const ok = monthAllowed(month.getFullYear(), i)
                const on = month.getMonth() === i
                return (
                  <button key={m} type="button" disabled={!ok} onClick={() => { setMonth(new Date(month.getFullYear(), i, 1)); setJump(null) }}
                    className={`min-h-[48px] rounded-xl text-[14px] font-black transition disabled:opacity-25 ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-[#111827] hover:bg-[#C9A24D]/15 dark:text-white'}`}>{m}</button>
                )
              })}
            </div>
            <button type="button" onClick={() => setJump('years')} className="mt-2 w-full rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-white dark:text-gray-400 dark:hover:bg-white/10">Pick a different year</button>
          </motion.div>
        ) : jump === 'years' ? (
          <motion.div key="years" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => yearPage - 5 + i).map(y => {
              const ok = monthAllowed(y, 0) || monthAllowed(y, 11) || (!!minMonth && minMonth.getFullYear() === y) || (!!maxMonth && maxMonth.getFullYear() === y)
              return (
                <button key={y} type="button" disabled={!ok} onClick={() => { setMonth(new Date(y, month.getMonth(), 1)); setJump('months') }}
                  className={`min-h-[48px] rounded-xl text-[14px] font-black transition disabled:opacity-25 ${y === month.getFullYear() ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-[#111827] hover:bg-[#C9A24D]/15 dark:text-white'}`}>{y}</button>
              )
            })}
          </motion.div>
        ) : (
          <motion.div key={month.toISOString()} initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -18 }} transition={{ duration: 0.18 }}>
            <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-wider text-gray-400">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="py-1">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <span key={`b${i}`} />
                const on = picked === d
                const off = blocked(d)
                const why = reason(d)
                const wkd = goldWeekends && [0, 6].includes(parseYmd(d).getDay())
                const isToday = d === ymd(new Date())
                return (
                  <button key={d} type="button" disabled={off} onClick={() => onPick(d)} title={why || undefined}
                    style={on && accent ? { backgroundColor: accent, color: inkOn(accent) } : undefined}
                    className={`relative aspect-square min-h-[40px] rounded-xl text-[15px] font-black transition ${on ? (accent ? 'shadow-md' : 'bg-[#111827] text-white shadow-md dark:bg-white dark:text-[#111827]')
                      : off ? 'text-gray-300 dark:text-gray-700' : `${wkd ? 'text-[#7a5f22] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'} hover:bg-[#C9A24D]/15`} ${why && !on ? 'line-through decoration-2 decoration-rose-400/70' : ''}`}>
                    {parseYmd(d).getDate()}
                    {isToday && !on && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#C9A24D]" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!jump && <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">{note || 'Tap the month to jump to another month or year'}</p>}
    </div>
  )
}

/// ---------------------------------------------------------------- the window

export type WhenSheetProps = Omit<WhenPickerProps, 'value' | 'onChange'> & {
  open: boolean
  onClose: () => void
  /** What's picked now - the sheet starts from it each time it opens. */
  value?: WhenValue | null
  /** Done: the finished answer. */
  onDone: (v: WhenValue) => void
  title: string
  kicker?: string
  /** A line under the title (right-hand side). */
  intro?: React.ReactNode
  doneLabel?: string
  /** The lit panel: a photo behind it (the home, the article's cover)... */
  photo?: string | null
  /** ...and what this is for ("26 Old Gulph Rd", "Follow up with Robin"), with a small gold line under it. */
  context?: string | null
  contextSub?: string | null
}

/** The picker in the house window (the same look as the showing / host flows): a lit photo or
 *  context panel with the steps ticking off on the left, one step at a time on the right. On a
 *  phone it's a slide-up sheet (pull down to close) with the panel as a short header. Rendered at
 *  the end of <body>, above every other window. */
export function WhenSheet(props: WhenSheetProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {props.open && <SheetWindow key="when-sheet" {...props} />}
    </AnimatePresence>,
    host,
  )
}

const STEP_NAMES: Record<WhenMode, string[]> = {
  date: ['Pick a day'],
  time: ['Part of the day', 'Pick a time'],
  datetime: ['Pick a day', 'Part of the day', 'Pick a time'],
  range: ['Pick a day', 'Pick the hours'],
}

function SheetWindow({ onClose, value, onDone, title, kicker = 'Pick a time', intro, doneLabel = 'Done', photo, context, contextSub, ...picker }: WhenSheetProps) {
  const [draft, setDraft] = useState<WhenValue>(() => ({ ...emptyWhen, ...(value || {}) }))
  const sheetMotion = useSheetMotion()
  const isPhone = useIsPhone()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, isPhone)
  // Escape closes just this window, not the one underneath it.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    // Enter only presses the focused button here - never the window underneath's "Enter to continue".
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); closeRef.current() }
      else if (e.key === 'Enter') e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  const mode = picker.mode
  const ready = whenComplete(draft, mode)
  const timeDone = !!draft.time || !!draft.anytime
  const done: boolean[] = mode === 'date' ? [!!draft.date]
    : mode === 'time' ? [!!draft.time, !!draft.time]
    : mode === 'datetime' ? [!!draft.date, !!draft.date && timeDone, !!draft.date && timeDone]
    : [!!draft.date, ready]
  const names = STEP_NAMES[mode]
  const current = Math.max(0, done.findIndex(d => !d))
  const stepNo = ready ? names.length : current + 1
  // Short words ("Thu, Nov 6 at 2 PM") so the "Your pick" box stays one line.
  const answer = ready ? whenText(draft, mode, typeof picker.allowAnytime === 'string' ? picker.allowAnytime.toLowerCase() : 'any time', true) : ''
  return (
    // Clicks stay inside: the sheet is portaled, but React still bubbles its events to whatever
    // opened it (a clickable card would open behind it).
    <motion.div {...backdropMotion} data-scroll-lock="off"
      className="fixed inset-0 z-[150] flex items-end justify-center bg-[#0b0b0c]/70 sm:items-center sm:p-5"
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
      onPointerDown={e => e.stopPropagation()}>
      <style>{WHEN_CSS}</style>
      <motion.div ref={sheetRef} {...sheetMotion} style={isPhone ? { y: sheetY } : undefined}
        role="dialog" aria-modal="true" aria-label={title}
        className="relative grid max-h-[94dvh] w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[26px] bg-white shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#111113] sm:max-h-[min(720px,calc(100dvh-2.5rem))] sm:min-h-[520px] sm:max-w-[980px] sm:grid-cols-[300px_minmax(0,1fr)] sm:grid-rows-1 sm:rounded-[30px]">
        {/* ---- the lit panel: what this is for, and the steps ticking off */}
        <div className="relative isolate overflow-hidden bg-[#0b0b0c] text-white">
          {photo && <img src={photo} alt="" className="wp-ken absolute inset-0 -z-20 h-full w-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.45),transparent_55%),linear-gradient(180deg,rgba(11,11,12,.35),rgba(11,11,12,.92))]" />
          <span aria-hidden className="wp-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/35 sm:hidden" />
          {[['14%', '22%', 0], ['80%', '16%', 1.4], ['70%', '64%', 2.6], ['30%', '80%', 1.9]].map(([l, t, d], k) => (
            <span key={k} aria-hidden className="wp-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
          ))}
          <div className="flex h-full flex-col px-5 pb-4 pt-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{kicker}</span></p>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:hidden"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 sm:mt-auto">
              <h2 className="font-serif text-[1.4rem] font-black leading-tight sm:text-[1.75rem]">{title}</h2>
              {context && <p className="mt-1 truncate text-[13px] font-semibold text-white/70" title={context}>{context}</p>}
              {contextSub && <p className="mt-1.5 truncate text-[10px] font-black uppercase tracking-[0.2em] text-[#e8c97a]">{contextSub}</p>}
            </div>
            {/* steps: dots on phones, a list with checks on wider screens */}
            <div className="mt-3 flex gap-1.5 sm:hidden">
              {names.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all duration-500 ${done[i] ? 'w-8 bg-[#e8c97a]' : i === current ? 'w-6 bg-white/60' : 'w-4 bg-white/25'}`} />)}
            </div>
            <ol className="mt-8 hidden space-y-3 sm:block">
              {names.map((label, i) => (
                <li key={label} className={`flex items-center gap-3 text-sm font-bold transition-colors duration-300 ${i === current && !ready ? 'text-white' : done[i] ? 'text-white/70' : 'text-white/35'}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black transition-all duration-300 ${done[i] ? 'bg-[#e8c97a] text-[#111827]' : i === current ? 'bg-white text-[#111827] shadow-[0_0_0_4px_rgba(232,201,122,.25)]' : 'bg-white/10'}`}>
                    {done[i] ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
            {/* the answer so far, in words */}
            <div className="mt-6 hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:block">
              <p className="text-[9px] font-black uppercase tracking-[0.26em] text-[#e8c97a]">{picker.summaryPrefix || 'Your pick'}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={answer || 'none'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
                  className={`mt-1 truncate whitespace-nowrap font-serif text-[17px] font-black leading-snug ${answer ? 'text-white' : 'text-white/35'}`} title={answer || undefined}>
                  {answer || 'Nothing picked yet'}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ---- the steps */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4 sm:px-8 sm:pt-7">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#a8843a] dark:text-[#e8c97a]">{ready ? 'All set' : `Step ${stepNo} of ${names.length}`}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h3 key={ready ? 'ready' : current} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}
                  className="font-serif text-xl font-black leading-tight text-[#111827] dark:text-white sm:text-2xl">
                  {ready ? 'Looks good?' : names[current]}
                </motion.h3>
              </AnimatePresence>
              {intro && <div className="mt-1 text-[13px] font-medium text-gray-500 dark:text-gray-400">{intro}</div>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="hidden h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white sm:grid"><X className="h-5 w-5" /></button>
          </div>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4 pt-3 [scrollbar-width:none] sm:px-8">
            <WhenPicker {...picker} showSummary={isPhone && picker.showSummary !== false} value={draft} onChange={setDraft} />
          </div>
          <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/[0.07] sm:px-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onClose}
              className="inline-flex h-12 items-center rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
              Cancel
            </motion.button>
            <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} disabled={!ready} onClick={() => onDone(draft)}
              className="wp-shine relative ml-auto inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#111827] px-4 text-xs font-black uppercase tracking-widest text-white shadow-[0_16px_34px_-14px_rgba(17,24,39,.9)] transition-opacity disabled:opacity-40 dark:bg-white dark:text-[#111827] sm:flex-none sm:px-9">
              <Check className="h-4 w-4" strokeWidth={3} /> {doneLabel}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const WHEN_CSS = `
.wp-ken{animation:wpKen 16s ease-out both}
@keyframes wpKen{from{transform:scale(1.15)}to{transform:scale(1.02)}}
.wp-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);background-size:200% 100%;animation:wpEdge 6s ease-in-out infinite}
@keyframes wpEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.wp-spark{width:4px;height:4px;border-radius:999px;background:#e8c97a;box-shadow:0 0 10px 2px #e8c97a;opacity:0;animation:wpSpark 7s ease-in-out infinite}
@keyframes wpSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.wp-shine:not(:disabled):after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-100%);animation:wpShine 3.4s ease-in-out infinite}
@keyframes wpShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.wp-ken,.wp-edge,.wp-spark,.wp-shine:after{animation:none}}
`

// ---------------------------------------------------------------- a "done" moment

/** A check that draws itself with a little burst - for "Confirmed", "Added", "Scheduled". */
export function WhenDoneMoment({ title, text, className = '' }: { title: string; text?: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={`flex flex-col items-center justify-center px-6 py-8 text-center ${className}`}>
      <div className="relative">
        <motion.span className="absolute inset-0 rounded-full bg-emerald-400/30" initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.05 }}
          className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald-500 shadow-[0_18px_40px_-12px_rgba(16,185,129,.8)]">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }} />
          </svg>
        </motion.div>
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2
          return <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full" style={{ background: i % 2 ? '#C9A24D' : '#34d399' }}
            initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * 60, y: Math.sin(a) * 60, opacity: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }} />
        })}
      </div>
      <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 font-serif text-2xl font-black text-[#111827] dark:text-white">{title}</motion.h3>
      {text && <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-1.5 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">{text}</motion.p>}
    </motion.div>
  )
}

/** A big tap-to-open field that shows the answer in words (for a form row or a settings line). */
export function WhenField({ value, mode, placeholder = 'Pick a day', onOpen, onClear, accent, anytimeText, className = '' }: {
  value: WhenValue
  mode: WhenMode
  placeholder?: string
  onOpen: () => void
  onClear?: () => void
  accent?: string
  anytimeText?: string
  className?: string
}) {
  const text = whenComplete(value, mode) ? whenText(value, mode, anytimeText) : ''
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onOpen}
        className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 text-left transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.03]">
        {mode === 'time' ? <Clock className="h-5 w-5 shrink-0" style={{ color: accent || '#C9A24D' }} /> : <CalendarDays className="h-5 w-5 shrink-0" style={{ color: accent || '#C9A24D' }} />}
        <span className={`min-w-0 flex-1 py-2 text-[15px] font-black leading-snug ${text ? 'text-[#111827] dark:text-white' : 'text-gray-400'}`}>{text || placeholder}</span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-400">{text ? 'Change' : 'Pick'}</span>
      </motion.button>
      {text && onClear && (
        <button type="button" onClick={onClear} aria-label="Clear" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button>
      )}
    </div>
  )
}
