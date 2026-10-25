'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Copy, Moon, Sparkles, Sun, Sunrise } from 'lucide-react'
import { clock, clockRange, dayLong, isoDay, parseDay, type InviteDay, type InviteType, type ScheduledSlot } from '@/lib/invites'

// The day and time steps of the invite flow - the same look as the open-house host flow's (big day
// tiles, popular times first, "Pick your own" for anything else), with suggestions that fit the kind
// of event: weekends for open houses, weekdays for broker's opens, evenings for dinners.

const pad = (n: number) => String(n).padStart(2, '0')
const minutes = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }
const fromMinutes = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`

/** The days an event like this usually happens on: 0 = Sunday ... 6 = Saturday. */
const DAYS_FOR: Record<InviteType, number[]> = {
  open_house: [6, 0],
  brokers_open: [2, 3, 4],
  client_event: [4, 5, 6],
  custom: [0, 1, 2, 3, 4, 5, 6],
}

export function suggestedDays(type: InviteType, count = 6) {
  const out: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  for (let k = 0; k < 90 && out.length < count; k++) {
    if (DAYS_FOR[type].includes(d.getDay())) out.push(isoDay(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Which day(s) (10/24): the home's open houses already on the calendar come first (ours or
 *  Bright's - picked for the agent the first time, with their times), then the usual days for this
 *  kind of event, then any day on the calendar. Tap to add or remove - an invite can have several. */
export function DayStep({ type, days, scheduled, onChange }: { type: InviteType; days: InviteDay[]; scheduled: ScheduledSlot[] | null; onChange: (d: InviteDay[]) => void }) {
  const today = isoDay(new Date())
  const picked = new Set(days.map(d => d.date))
  const sched = (scheduled || []).filter(s => s.date >= today)
  const suggested = useMemo(() => suggestedDays(type).filter(d => !sched.some(s => s.date === d)), [type, sched.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const extra = days.map(d => d.date).filter(d => !suggested.includes(d) && !sched.some(s => s.date === d))
  const [own, setOwn] = useState(extra.length > 0)
  const hint = type === 'open_house' ? 'Coming weekends' : type === 'brokers_open' ? 'Coming weekdays' : type === 'client_event' ? 'Coming evenings out' : 'Coming days'
  const toggle = (d: string, withTime?: { start?: string | null; end?: string | null }) => {
    if (picked.has(d)) onChange(days.filter(x => x.date !== d))
    else {
      // A new day takes the hours of the days already picked (most invites keep the same hours).
      const like = withTime || (days.length && days.every(x => x.start === days[0].start && x.end === days[0].end) ? { start: days[0].start, end: days[0].end } : {})
      onChange([...days, { date: d, start: like.start || null, end: like.end || null }].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7))
    }
  }
  return (
    <div>
      {sched.length > 0 && (
        <div className="mb-5" data-testid="invite-scheduled">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]"><Sparkles className="h-3 w-3" /> Already scheduled for this home</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {sched.map((s, i) => {
              const on = picked.has(s.date)
              const dt = parseDay(s.date)
              return (
                <motion.button key={s.date} type="button" onClick={() => toggle(s.date, s)} data-testid={`sched-${s.date}`} aria-pressed={on}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 360, damping: 28 }} whileTap={{ scale: 0.97 }}
                  className={`relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.1] shadow-[0_14px_28px_-20px_rgba(201,162,77,1)]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.03]'}`}>
                  <span className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${on ? 'bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-[#111827] dark:bg-white/10 dark:text-white'}`}>
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-70">{dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="text-xl font-black leading-none">{dt.getDate()}</span>
                    <span className="text-[9px] font-bold uppercase opacity-60">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-black text-[#111827] dark:text-white">{dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                    <span className="block text-[12.5px] font-bold text-gray-500 dark:text-gray-400">{clockRange(s.start, s.end) || 'Time not set'}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${s.source === 'ohp' ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'}`}>{s.source === 'ohp' ? 'Your open house' : 'From Bright MLS'}</span>
                  </span>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'border border-gray-300 text-transparent dark:border-white/20'}`}><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{hint} <span className="font-bold normal-case tracking-normal">- tap one or more</span></p>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {[...suggested, ...extra].map((d, i) => {
          const on = picked.has(d)
          const dt = parseDay(d)
          return (
            <motion.button key={d} type="button" onClick={() => toggle(d)} data-testid={`day-${d}`} aria-pressed={on}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035, type: 'spring', stiffness: 380, damping: 28 }}
              whileTap={{ scale: 0.94 }}
              className={`relative isolate flex min-w-0 flex-col items-center rounded-2xl border px-1 py-3 transition-colors ${on ? 'border-transparent text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.06] dark:border-white/10 dark:bg-white/[0.03] dark:text-white'}`}>
              <AnimatePresence>{on && <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] shadow-[0_12px_22px_-8px_rgba(201,162,77,.8)]" />}</AnimatePresence>
              <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{d === today ? 'Today' : dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="text-2xl font-black leading-tight">{dt.getDate()}</span>
              <span className="text-[10px] font-bold uppercase opacity-60">{dt.toLocaleDateString('en-US', { month: 'short' })}</span>
              {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#111827] text-white shadow dark:bg-white dark:text-[#111827]"><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}
            </motion.button>
          )
        })}
      </div>
      <button type="button" onClick={() => setOwn(v => !v)}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5 text-[12px] font-black uppercase tracking-widest transition ${own ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] text-[#7a5f22] dark:text-[#e8c97a]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
        <CalendarPlus className="h-4 w-4" /> {own ? 'Hide the calendar' : 'Pick other days'}
      </button>
      <AnimatePresence initial={false}>
        {own && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="overflow-hidden">
            <MonthCalendar picked={picked} onPick={d => toggle(d)} min={today} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {days.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} layout
            className="mt-4 rounded-2xl bg-[#C9A24D]/10 px-4 py-3 text-center text-sm font-black text-[#7a5f22] dark:text-[#e8c97a]">
            {days.length === 1 ? dayLong(days[0].date) : <>{days.length} days: {days.map(d => parseDay(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })).join(' · ')}</>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MonthCalendar({ picked, onPick, min }: { picked: Set<string>; onPick: (d: string) => void; min: string }) {
  const value = Array.from(picked).sort()[0] || null
  const start = parseDay(value && value > min ? value : min)
  const [month, setMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1))
  const [dir, setDir] = useState(1)
  const first = month.getDay()
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => isoDay(new Date(month.getFullYear(), month.getMonth(), i + 1)))]
  const minDate = parseDay(min)
  const canBack = month > new Date(minDate.getFullYear(), minDate.getMonth(), 1)
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
        <motion.div key={month.toISOString()} initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -18 }} transition={{ duration: 0.18 }} className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`b${i}`} />
            const on = picked.has(d)
            const off = d < min
            return (
              <button key={d} type="button" disabled={off} onClick={() => onPick(d)}
                className={`aspect-square rounded-xl text-[15px] font-black transition ${on ? 'bg-[#111827] text-white shadow-md dark:bg-white dark:text-[#111827]' : off ? 'text-gray-300 dark:text-gray-700' : 'text-[#111827] hover:bg-[#C9A24D]/15 dark:text-white'}`}>
                {parseDay(d).getDate()}
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const TIMES_FOR: Record<InviteType, [string, string][]> = {
  open_house: [['11:00', '13:00'], ['12:00', '14:00'], ['13:00', '15:00'], ['13:00', '16:00'], ['14:00', '16:00']],
  brokers_open: [['10:00', '12:00'], ['11:00', '13:00'], ['11:30', '13:30'], ['12:00', '14:00'], ['13:00', '15:00']],
  client_event: [['17:00', '19:00'], ['18:00', '20:00'], ['18:30', '21:00'], ['19:00', '22:00'], ['12:00', '14:00']],
  custom: [['10:00', '12:00'], ['12:00', '14:00'], ['14:00', '16:00'], ['17:00', '19:00'], ['18:00', '20:00']],
}
const PERIODS = [
  { id: 'morning', label: 'Morning', icon: Sunrise, from: 8 * 60, to: 11 * 60 + 30 },
  { id: 'afternoon', label: 'Afternoon', icon: Sun, from: 12 * 60, to: 16 * 60 + 30 },
  { id: 'evening', label: 'Evening', icon: Moon, from: 17 * 60, to: 21 * 60 },
] as const

/** The time step for one or several days: a row per day (its hours - already filled in for a
 *  scheduled open house), the picker below sets the highlighted day and moves on to the next one
 *  still without hours; "Same time every day" copies it to all of them. */
export function TimeStep({ type, days, onChange }: { type: InviteType; days: InviteDay[]; onChange: (d: InviteDay[]) => void }) {
  const firstOpen = Math.max(0, days.findIndex(d => !d.start || !d.end))
  const [active, setActive] = useState(firstOpen)
  const i = Math.min(active, Math.max(0, days.length - 1))
  const cur = days[i]
  const several = days.length > 1
  const set = (start: string, end: string) => {
    const next = days.map((d, k) => (k === i ? { ...d, start, end } : d))
    onChange(next)
    // On to the next day without hours (if any).
    const open = next.findIndex((d, k) => k > i && (!d.start || !d.end))
    if (open >= 0) window.setTimeout(() => setActive(open), 260)
  }
  const allSet = days.length > 0 && days.every(d => d.start && d.end)
  if (!cur) return null
  return (
    <div>
      {several && (
        <div className="mb-4 space-y-1.5" data-testid="invite-time-days">
          {days.map((d, k) => {
            const on = k === i
            const dt = parseDay(d.date)
            return (
              <motion.button key={d.date} type="button" onClick={() => setActive(k)} layout
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 bg-white text-[#111827] dark:border-white/10 dark:bg-white/[0.03] dark:text-white'}`}>
                <CalendarDays className={`h-4 w-4 shrink-0 ${on ? 'text-[#e8c97a] dark:text-[#a8843a]' : 'text-[#C9A24D]'}`} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-black">{dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                <span className={`shrink-0 text-[12.5px] font-bold ${d.start && d.end ? '' : on ? 'opacity-70' : 'text-[#a8843a]'}`}>{d.start && d.end ? clockRange(d.start, d.end) : 'Pick a time'}</span>
                {d.start && d.end && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={3} />}
              </motion.button>
            )
          })}
          {cur.start && cur.end && days.some(d => d.start !== cur.start || d.end !== cur.end) && (
            <button type="button" onClick={() => onChange(days.map(d => ({ ...d, start: cur.start, end: cur.end })))}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black uppercase tracking-widest text-[#7a5f22] transition hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
              <Copy className="h-3.5 w-3.5" /> Same time every day ({clockRange(cur.start, cur.end)})
            </button>
          )}
        </div>
      )}
      <TimePicker key={cur.date} type={type} day={several ? null : cur.date} start={cur.start || null} end={cur.end || null} onChange={set} />
      {several && allSet && <p className="mt-3 text-center text-[12px] font-bold text-emerald-600 dark:text-emerald-400">Every day has its time.</p>}
    </div>
  )
}

function TimePicker({ type, day, start, end, onChange }: { type: InviteType; day: string | null; start: string | null; end: string | null; onChange: (start: string, end: string) => void }) {
  const times = TIMES_FOR[type]
  const same = (t: [string, string]) => start === t[0] && end === t[1]
  const [own, setOwn] = useState(!!start && !times.some(same))
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>(type === 'client_event' ? 'evening' : type === 'brokers_open' ? 'morning' : 'afternoon')
  const startsIn = (p: (typeof PERIODS)[number]) => Array.from({ length: (p.to - p.from) / 30 + 1 }, (_, i) => fromMinutes(p.from + i * 30))
  const lengths = start ? [60, 90, 120, 150, 180, 240].filter(n => minutes(start) + n <= 23 * 60 + 30) : []
  return (
    <div>
      {day && <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-gray-500 dark:text-gray-400"><CalendarDays className="h-4 w-4 text-[#C9A24D]" /> {dayLong(day)}</p>}
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Popular times</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {times.map((t, i) => {
          const on = same(t)
          return (
            <motion.button key={t.join()} type="button" onClick={() => { setOwn(false); onChange(t[0], t[1]) }} data-testid={`time-${t[0]}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035 }} whileTap={{ scale: 0.95 }}
              className={`relative flex items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-[15px] font-black transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:text-white'}`}>
              <Clock className={`h-4 w-4 ${on ? 'text-[#e8c97a] dark:text-[#a8843a]' : 'text-[#C9A24D]'}`} />{clockRange(t[0], t[1])}
              {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3} /></motion.span>}
            </motion.button>
          )
        })}
      </div>
      <button type="button" onClick={() => setOwn(v => !v)}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5 text-[12px] font-black uppercase tracking-widest transition ${own ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07] text-[#7a5f22] dark:text-[#e8c97a]' : 'border-gray-300 text-gray-500 hover:border-[#C9A24D] hover:text-[#7a5f22] dark:border-white/15 dark:text-gray-400'}`}>
        <Clock className="h-4 w-4" /> {own ? 'Back to popular times' : 'Pick your own time'}
      </button>
      <AnimatePresence initial={false}>
        {own && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="overflow-hidden">
            <div className="mt-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-3 dark:border-white/10 dark:bg-[#0b0b0c] sm:p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">1. It starts at</p>
              <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
                {PERIODS.map(p => (
                  <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
                    className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-wider ${period === p.id ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {period === p.id && <motion.span layoutId="inv-period" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <p.icon className="relative h-3.5 w-3.5" /><span className="relative">{p.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {startsIn(PERIODS.find(p => p.id === period)!).map(t => (
                  <button key={t} type="button" onClick={() => onChange(t, fromMinutes(Math.min(minutes(t) + 120, 23 * 60 + 30)))}
                    className={`rounded-xl border py-3 text-[13px] font-black transition-colors ${start === t ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                    {clock(t)}
                  </button>
                ))}
              </div>
              {start && (
                <>
                  <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">2. For how long</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {lengths.map(n => {
                      const e = fromMinutes(minutes(start) + n)
                      const on = end === e
                      return (
                        <button key={n} type="button" onClick={() => onChange(start, e)}
                          className={`rounded-xl border px-1 py-2.5 text-center transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-white'}`}>
                          <span className="block text-[14px] font-black">{n % 60 ? `${Math.floor(n / 60)}½` : n / 60} hr{n > 60 ? 's' : ''}</span>
                          <span className={`block text-[10px] font-bold ${on ? 'opacity-70' : 'text-gray-400'}`}>until {clock(e)}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {start && end && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl bg-[#C9A24D]/10 px-4 py-3 text-center text-sm font-black text-[#7a5f22] dark:text-[#e8c97a]">
            {clockRange(start, end)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
