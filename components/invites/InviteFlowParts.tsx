'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, Moon, Sun, Sunrise } from 'lucide-react'
import { clock, clockRange, dayLong, isoDay, parseDay, type InviteType } from '@/lib/invites'

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

export function DayStep({ type, value, onChange }: { type: InviteType; value: string | null; onChange: (d: string) => void }) {
  const today = isoDay(new Date())
  const suggested = useMemo(() => suggestedDays(type), [type])
  const extra = value && !suggested.includes(value) ? [value] : []
  const [own, setOwn] = useState(extra.length > 0)
  const hint = type === 'open_house' ? 'Coming weekends' : type === 'brokers_open' ? 'Coming weekdays' : type === 'client_event' ? 'Coming evenings out' : 'Coming days'
  return (
    <div>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{hint}</p>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {[...suggested, ...extra].map((d, i) => {
          const on = value === d
          const dt = parseDay(d)
          return (
            <motion.button key={d} type="button" onClick={() => onChange(d)} data-testid={`day-${d}`}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035, type: 'spring', stiffness: 380, damping: 28 }}
              whileTap={{ scale: 0.94 }}
              className={`relative isolate flex min-w-0 flex-col items-center rounded-2xl border px-1 py-3 transition-colors ${on ? 'border-transparent text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.06] dark:border-white/10 dark:bg-white/[0.03] dark:text-white'}`}>
              {on && <motion.span layoutId="inv-day" className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-[#e2c47a] to-[#C9A24D] shadow-[0_12px_22px_-8px_rgba(201,162,77,.8)]" />}
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
        <CalendarPlus className="h-4 w-4" /> {own ? 'Hide the calendar' : 'Pick your own day'}
      </button>
      <AnimatePresence initial={false}>
        {own && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} className="overflow-hidden">
            <MonthCalendar value={value} onPick={onChange} min={today} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {value && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-4 rounded-2xl bg-[#C9A24D]/10 px-4 py-3 text-center text-sm font-black text-[#7a5f22] dark:text-[#e8c97a]">
            {dayLong(value)}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function MonthCalendar({ value, onPick, min }: { value: string | null; onPick: (d: string) => void; min: string }) {
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
            const on = value === d
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

export function TimeStep({ type, day, start, end, onChange }: { type: InviteType; day: string | null; start: string | null; end: string | null; onChange: (start: string, end: string) => void }) {
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
