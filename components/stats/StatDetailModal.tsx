'use client'

// One stat, opened from its card (Dash, Agent Hub, Blogs, Open Houses...). Rebuilt 11/03 - the owner
// opened "Interacted" on All Time and got one sloping line and a grid of empty squares: "basically
// shows nothing". Now it opens on the last 30 days and answers, in order:
//   1. how many, and is that up or down (big number + change vs the period before)
//   2. when (a bar per day / week / month - tap or hover one), with the average marked
//   3. highlights (best day, daily average, busiest weekday) and what it was made of (top forms,
//      posts, open houses, lead sources), then the weekly rhythm.
// A bottom sheet on phones, a centred card on computers. Transform/opacity animation only (no blur).
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { ArrowDownRight, ArrowUpRight, CalendarDays, Minus, Sparkles, X } from 'lucide-react'
import api from '@/lib/api-service'
import { StatBreakdown, StatDailyPoint, StatHistory } from '@/types'
import { todayLocal } from '@/lib/relativeDays'

interface StatDetailModalProps {
  metric: string
  label: string
  isPercent?: boolean
  onClose: () => void
}

type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom'
const RANGES: { id: Exclude<Range, 'custom'>; label: string; words: string; days?: number }[] = [
  { id: '7d', label: '7D', words: 'last 7 days', days: 7 },
  { id: '30d', label: '30D', words: 'last 30 days', days: 30 },
  { id: '90d', label: '90D', words: 'last 90 days', days: 90 },
  { id: '1y', label: '1Y', words: 'last 12 months', days: 365 },
  { id: 'all', label: 'All', words: 'all time' },
]

// What each stat means, in the agent's words, and what to do when it's empty.
const INFO: Record<string, { about: string; one: string; many: string; empty: string }> = {
  agent_hub_visits: { about: 'People who opened your Agent Hub, by link or QR code - each person once a day', one: 'visitor', many: 'visitors', empty: 'Share your Agent Hub link - your email signature, texts and socials are the easy places.' },
  agent_hub_interactions: { about: 'Visitors who tapped something - call, text, a form, a home or Save Contact', one: 'person', many: 'people', empty: 'Visitors who tap Call, Text, a form or a home show up here.' },
  qr_scans: { about: 'Times your QR codes were scanned', one: 'scan', many: 'scans', empty: 'Put your QR code on flyers, signs and your open house kit.' },
  form_views: { about: 'People who opened one of your forms', one: 'person', many: 'people', empty: 'Share a form link or put its QR code on a flyer.' },
  form_fills: { about: 'Forms people finished and sent you', one: 'form', many: 'forms', empty: 'Finished forms show up here and in your Leads.' },
  form_completion: { about: 'Of the people who opened a form, how many finished it', one: '%', many: '%', empty: 'Once people open your forms, the share who finish shows here.' },
  blog_reads: { about: 'Times your blog posts were read', one: 'read', many: 'reads', empty: 'Publish a post and share it - reads show up here.' },
  open_house_signins: { about: 'Guests who signed in at your open houses', one: 'sign-in', many: 'sign-ins', empty: 'Guests who sign in at an open house show up here.' },
  open_house_signin_views: { about: 'Times your open house sign-in page was opened', one: 'view', many: 'views', empty: 'Your sign-in page views show up here after an open house.' },
  open_house_unrepresented: { about: 'Guests who said they don\'t have an agent yet', one: 'guest', many: 'guests', empty: 'Guests without an agent - your best follow-ups - show up here.' },
  open_house_signin_completion: { about: 'Of the people who opened your sign-in page, how many signed in', one: '%', many: '%', empty: 'Once guests open your sign-in page, the share who sign in shows here.' },
  new_leads: { about: 'New people added to your Leads', one: 'lead', many: 'leads', empty: 'New leads from forms, open houses and Showcases show up here.' },
}

// ---------------------------------------------------------------- dates (local YYYY-MM-DD)
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => new Date(`${s}T00:00:00`)
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
const short = (s: string) => parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

type Day = { date: string; count: number; num: number; den: number }
type Bucket = { key: string; label: string; tip: string; value: number; num: number; den: number; isNow: boolean }

function fillDays(daily: StatDailyPoint[], start: string, end: string): Day[] {
  const map = new Map(daily.map(p => [p.date, p]))
  const out: Day[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const p = map.get(d)
    out.push({ date: d, count: p?.count || 0, num: p?.num || 0, den: p?.den || 0 })
  }
  return out
}

// A day's rate is only meaningful with its parts - a range's rate is finished / opened, not an average of daily percents.
// 1 tap in 30 days is 0.03 a day - "0.0" read as nothing happened, so tiny averages say "<0.1"
const perDay = (n: number) => (n > 0 && n < 0.05 ? '<0.1' : n < 10 ? n.toFixed(1) : Math.round(n))

// "19 of 22" - or both numbers when more finished than opened (paper / Clipboard sign-ins never open
// the page), so none of them get hidden behind a "19 of 19"
const ofText = (num: number, den: number) => (num <= den ? `${num.toLocaleString()} of ${den.toLocaleString()}` : `${num.toLocaleString()} finished, ${den.toLocaleString()} opened`)

const rateOf = (days: Day[], isPercent: boolean) => {
  if (!isPercent) return days.reduce((s, d) => s + d.count, 0)
  const den = days.reduce((s, d) => s + d.den, 0)
  if (den) return Math.min(100, Math.round(days.reduce((s, d) => s + d.num, 0) / den * 100))
  const active = days.filter(d => d.count)
  return active.length ? Math.round(active.reduce((s, d) => s + d.count, 0) / active.length) : 0
}

function buckets(days: Day[], isPercent: boolean): { grain: 'day' | 'week' | 'month'; list: Bucket[] } {
  const today = todayLocal()
  const grain = days.length <= 31 ? 'day' : days.length <= 120 ? 'week' : 'month'
  const groups = new Map<string, Day[]>()
  for (const d of days) {
    const dt = parse(d.date)
    const key = grain === 'day' ? d.date : grain === 'week' ? addDays(d.date, -dt.getDay()) : d.date.slice(0, 7)
    groups.set(key, [...(groups.get(key) || []), d])
  }
  const list = Array.from(groups.entries()).map(([key, ds]) => {
    const first = ds[0].date, last = ds[ds.length - 1].date
    const label = grain === 'day' ? String(parse(key).getDate())
      : grain === 'week' ? short(first)
      : parse(`${key}-01`).toLocaleDateString('en-US', { month: 'short' })
    const tip = grain === 'day' ? parse(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : grain === 'week' ? `${short(first)} – ${short(last)}`
      : parse(`${key}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    return { key, label, tip, value: rateOf(ds, isPercent), num: ds.reduce((s, d) => s + d.num, 0), den: ds.reduce((s, d) => s + d.den, 0), isNow: first <= today && today <= last }
  })
  return { grain, list }
}

// ---------------------------------------------------------------- pieces
function ChangePill({ now, before, words, isPercent }: { now: number; before: number; words: string; isPercent: boolean }) {
  if (!now && !before) return null
  const pct = before ? Math.round(((now - before) / before) * 100) : null
  // From a small start a percent is silly (1 -> 88 read "+8700%", 11/03) - say the difference instead
  const diff = now - before
  const plain = isPercent || before < 10 || Math.abs(pct || 0) >= 300
  const up = diff > 0
  const same = diff === 0
  const Icon = same ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${same ? 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'
        : up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={3} />
      {diff === 0 ? 'Same' : plain ? `${diff > 0 ? '+' : '-'}${Math.abs(diff).toLocaleString()}${isPercent ? ' pts' : ''}` : `${Math.abs(pct || 0)}%`}
      <span className="font-semibold opacity-70">vs the {words} before</span>
    </motion.span>
  )
}

function Bars({ list, grain, isPercent, unit, avg }: { list: Bucket[]; grain: 'day' | 'week' | 'month'; isPercent: boolean; unit: (n: number) => string; avg: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const max = Math.max(...list.map(b => b.value), isPercent ? 100 : 1)
  const n = list.length
  // a handful of evenly spread labels, always the last one
  const every = Math.max(1, Math.ceil(n / (grain === 'day' ? 7 : 6)))
  const shown = sel ?? null
  return (
    <div className="relative select-none" onPointerLeave={() => setSel(null)}>
      <div className="relative flex h-44 items-end sm:h-52" style={{ gap: n > 60 ? 1 : n > 20 ? 3 : 6 }}>
        {/* average line */}
        {avg > 0 && (
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 z-10 origin-left border-t border-dashed border-[#8b7355]/60 dark:border-[#e8c97a]/50" style={{ bottom: `${(avg / max) * 100}%` }}>
            <span className="absolute -top-[18px] left-0 rounded bg-white/90 px-1 text-[9.5px] font-black uppercase tracking-wide text-[#8b7355] dark:bg-[#151517]/90 dark:text-[#e8c97a]">
              avg {isPercent ? `${Math.round(avg)}%` : perDay(avg)}
            </span>
          </motion.div>
        )}
        {list.map((b, i) => {
          const h = b.value ? Math.max((b.value / max) * 100, 3) : 0
          const on = shown === i
          return (
            <button key={b.key} type="button" aria-label={`${b.tip}: ${isPercent ? `${b.value}%` : unit(b.value)}`}
              onPointerEnter={e => { if (e.pointerType === 'mouse') setSel(i) }} onClick={() => setSel(on ? null : i)}
              className="group relative flex h-full flex-1 cursor-pointer items-end justify-center outline-none">
              {/* empty days keep a faint stub so the timeline reads as a timeline */}
              <span className="absolute bottom-0 h-[3px] w-full rounded-full bg-gray-200/80 dark:bg-white/[0.07]" />
              <motion.span
                initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                transition={{ type: 'spring', stiffness: 170, damping: 22, delay: 0.08 + Math.min(i, 40) * (0.5 / Math.max(n, 12)) }}
                className={`relative w-full origin-bottom rounded-t-[5px] transition-[filter,opacity] duration-200 ${shown !== null && !on ? 'opacity-45' : ''} ${on ? 'brightness-110' : ''}`}
                style={{ height: `${h}%`, background: b.isNow ? 'linear-gradient(180deg,#f0d58b 0%,#C9A24D 100%)' : 'linear-gradient(180deg,#d8b866 0%,#b08a3c 100%)',
                  boxShadow: on ? '0 0 0 2px rgba(201,162,77,.35), 0 8px 18px -8px rgba(176,138,60,.8)' : undefined }} />
              {b.isNow && <span className="absolute -bottom-2.5 h-1 w-1 rounded-full bg-[#C9A24D]" />}
            </button>
          )
        })}
        <AnimatePresence>
          {shown !== null && list[shown] && (
            <motion.div key="tip" initial={{ opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.16 }}
              className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-xl bg-[#111827] px-3 py-2 text-center shadow-xl dark:bg-white"
              style={{ left: `clamp(72px, ${((shown + 0.5) / n) * 100}%, calc(100% - 72px))`, bottom: `calc(${Math.min((list[shown].value / max) * 100, 88)}% + 10px)` }}>
              <p className="text-[15px] font-black leading-none text-white dark:text-[#111827]">
                {isPercent ? `${list[shown].value}%` : unit(list[shown].value)}
              </p>
              {isPercent && list[shown].den > 0 && <p className="mt-0.5 text-[10px] font-bold text-white/60 dark:text-gray-500">{ofText(list[shown].num, list[shown].den)}</p>}
              <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#e8c97a] dark:text-[#8b7355]">{list[shown].tip}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3.5 flex text-[10px] font-black uppercase tracking-wide text-gray-400" style={{ gap: n > 60 ? 1 : n > 20 ? 3 : 6 }}>
        {list.map((b, i) => (
          <span key={b.key} className={`flex-1 text-center ${b.isNow ? 'text-[#8b7355] dark:text-[#e8c97a]' : ''}`}>
            {(i % every === 0 && n - 1 - i >= every / 2) || i === n - 1 ? (b.isNow && grain === 'day' ? 'Today' : b.label) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function Tile({ k, label, value, sub, i }: { k: string; label: string; value: React.ReactNode; sub?: string; i: number }) {
  return (
    <motion.div key={k} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="min-w-0 rounded-2xl border border-gray-200/80 bg-white px-3 py-3 dark:border-white/[0.07] dark:bg-white/[0.03] sm:px-4">
      <p className="truncate text-[9.5px] font-black uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="mt-1 truncate font-serif text-xl font-black leading-tight text-[#111827] dark:text-white sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{sub}</p>}
    </motion.div>
  )
}

function Rhythm({ days }: { days: Day[] }) {
  const sums = WEEKDAYS.map((_, w) => days.filter(d => parse(d.date).getDay() === w).reduce((s, d) => s + d.count, 0))
  const max = Math.max(...sums, 1)
  const top = sums.indexOf(Math.max(...sums))
  return (
    <div className="flex items-end gap-2 sm:gap-3">
      {sums.map((v, w) => (
        <div key={w} className="flex flex-1 flex-col items-center gap-1.5">
          <span className={`text-[10px] font-black tabular-nums ${w === top && v ? 'text-[#8b7355] dark:text-[#e8c97a]' : 'text-gray-400'}`}>{v || ''}</span>
          <div className="flex h-16 w-full items-end overflow-hidden rounded-lg bg-gray-100 dark:bg-white/[0.05]">
            <motion.div initial={{ height: 0 }} animate={{ height: `${(v / max) * 100}%` }} transition={{ delay: 0.3 + w * 0.05, type: 'spring', stiffness: 140, damping: 20 }}
              className={`w-full rounded-lg ${w === top && v ? 'bg-gradient-to-t from-[#b08a3c] to-[#f0d58b]' : 'bg-[#C9A24D]/40'}`} />
          </div>
          <span className={`text-[10px] font-black uppercase ${w === top && v ? 'text-[#111827] dark:text-white' : 'text-gray-400'}`}>{WEEKDAYS[w].slice(0, 1)}<span className="hidden sm:inline">{WEEKDAYS[w].slice(1)}</span></span>
        </div>
      ))}
    </div>
  )
}

function Breakdown({ data, isPercent, unit, total: shown }: { data: StatBreakdown; isPercent: boolean; unit: (n: number) => string; total: number }) {
  const max = Math.max(...data.items.map(i => (isPercent ? 100 : i.count)), 1)
  // shares of the big number above, so they always agree with it
  const total = Math.max(shown, data.items.reduce((s, i) => s + i.count, 0))
  return (
    <ul className="space-y-2.5">
      {data.items.map((it, i) => (
        <motion.li key={it.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] font-bold text-[#111827] dark:text-gray-100">{it.label}</span>
            <span className="shrink-0 text-[12px] font-black tabular-nums text-[#111827] dark:text-white">
              {isPercent ? `${it.count}%` : unit(it.count)}
              <span className="ml-1.5 font-semibold text-gray-400">{isPercent ? ofText(it.num ?? 0, it.den ?? 0) : total ? `${Math.round((it.count / total) * 100)}%` : ''}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(((isPercent ? it.count : it.count) / max) * 100, it.count ? 2 : 0)}%` }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-gradient-to-r from-[#b08a3c] to-[#f0d58b]" />
          </div>
        </motion.li>
      ))}
      {!!data.more && <li className="text-[11px] font-semibold text-gray-400">+ {data.more} more</li>}
    </ul>
  )
}

function Skeleton() {
  return (
    <div className="mt-6 space-y-5" aria-hidden>
      <div className="ohp-skeleton h-24 rounded-2xl" />
      <div className="flex h-44 items-end gap-1.5">{Array.from({ length: 18 }, (_, i) => <div key={i} className="ohp-skeleton flex-1 rounded-t-md" style={{ height: `${20 + ((i * 37) % 70)}%` }} />)}</div>
      <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(i => <div key={i} className="ohp-skeleton h-20 rounded-2xl" />)}</div>
    </div>
  )
}

// ---------------------------------------------------------------- the pop-up
export default function StatDetailModal({ metric, label, isPercent = false, onClose }: StatDetailModalProps) {
  const [history, setHistory] = useState<StatHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [wide, setWide] = useState(true)
  const [range, setRange] = useState<Range>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [breakdown, setBreakdown] = useState<StatBreakdown | null>(null)
  const drag = useDragControls()  // phones: only the grab bar pulls the sheet down - the page inside still scrolls
  const info = INFO[metric] || { about: '', one: 'time', many: 'times', empty: '' }
  const unit = (n: number) => `${n.toLocaleString()} ${n === 1 ? info.one : info.many}`

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(min-width: 640px)')
    const on = () => setWide(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    let live = true
    api.stats.getHistory(metric as any).then(r => {
      if (!live) return
      if (r.success && r.data) setHistory(r.data)
      setLoading(false)
    })
    return () => { live = false }
  }, [metric])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const today = todayLocal()
  const joined = history?.joined_at || today
  const [start, end] = useMemo((): [string, string] => {
    if (range === 'custom') return customStart && customEnd ? [customStart, customEnd] : [addDays(today, -29), today]
    if (range === 'all') return [joined < today ? joined : addDays(today, -29), today]
    const r = RANGES.find(x => x.id === range)!
    return [addDays(today, -((r.days || 30) - 1)), today]
  }, [range, customStart, customEnd, joined, today])
  const span = daysBetween(start, end) + 1
  const words = range === 'custom' ? `${short(start)} – ${short(end)}` : RANGES.find(r => r.id === range)!.words
  const periodWords = range === 'custom' || range === 'all' ? null : words.replace('last ', '')

  const days = useMemo(() => fillDays(history?.daily || [], start, end), [history, start, end])
  const before = useMemo(() => fillDays(history?.daily || [], addDays(start, -span), addDays(start, -1)), [history, start, span])
  const { grain, list } = useMemo(() => buckets(days, isPercent), [days, isPercent])
  const value = rateOf(days, isPercent)
  const prevValue = rateOf(before, isPercent)
  const num = days.reduce((s, d) => s + d.num, 0), den = days.reduce((s, d) => s + d.den, 0)
  const companionTotal = useMemo(() => fillDays(history?.companion?.daily || [], start, end).reduce((s, d) => s + d.count, 0), [history, start, end])
  const avg = list.length ? (isPercent ? value : list.reduce((s, b) => s + b.value, 0) / list.length) : 0
  const best = days.reduce<Day | null>((b, d) => (d.count > (b?.count || 0) ? d : b), null)
  const activeDays = days.filter(d => d.count).length
  const weekdaySums = WEEKDAYS.map((_, w) => days.filter(d => parse(d.date).getDay() === w).reduce((s, d) => s + d.count, 0))
  const busiest = weekdaySums.some(Boolean) ? weekdaySums.indexOf(Math.max(...weekdaySums)) : -1
  const lastActive = useMemo(() => [...(history?.daily || [])].reverse().find(p => p.count)?.date || null, [history])
  const empty = !loading && !days.some(d => d.count || d.den)

  // what it was made of, for this range
  useEffect(() => {
    let live = true
    setBreakdown(null)
    if (range === 'custom' && !(customStart && customEnd)) return
    api.stats.getBreakdown(metric as any, start, end).then(r => { if (live && r.success && r.data) setBreakdown(r.data) })
    return () => { live = false }
  }, [metric, start, end, range, customStart, customEnd])

  if (!mounted) return null

  const sheet = !wide
  const content = (
    <>
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3 w-3" /> Your stats</p>
          <h2 className="mt-1 font-serif text-[26px] font-black leading-tight text-[#111827] dark:text-white">{label}</h2>
          {info.about && <p className="mt-0.5 text-[13px] font-medium leading-snug text-gray-500 dark:text-gray-400">{info.about}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-full border border-gray-200 p-2 text-gray-400 transition hover:rotate-90 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* range */}
      <div className="mt-4 flex items-center gap-2">
        <div className="relative flex flex-1 rounded-full bg-gray-100 p-1 dark:bg-white/[0.06]">
          {RANGES.map(r => (
            <button key={r.id} type="button" onClick={() => setRange(r.id)} aria-pressed={range === r.id}
              className={`relative flex-1 rounded-full py-1.5 text-[12px] font-black tracking-wide transition-colors ${range === r.id ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
              {range === r.id && <motion.span layoutId={`stat-range-${metric}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-[#111827] shadow-sm dark:bg-white" />}
              <span className="relative">{r.label}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setRange('custom')} aria-label="Pick dates" aria-pressed={range === 'custom'}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${range === 'custom' ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-gray-100 text-gray-500 hover:text-[#111827] dark:bg-white/[0.06] dark:text-gray-400'}`}>
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {range === 'custom' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 px-3.5 py-3 dark:bg-white/[0.04]">
              {([['From', customStart, setCustomStart, joined, customEnd || today], ['To', customEnd, setCustomEnd, customStart || joined, today]] as const).map(([w, v, set, min, max]) => (
                <label key={w} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-gray-400">
                  {w}
                  <input type="date" value={v} min={min} max={max} onChange={e => set(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-[#111827] dark:border-white/10 dark:bg-[#0B0B0B] dark:text-white" />
                </label>
              ))}
              {(!customStart || !customEnd) && <span className="text-[11px] font-semibold text-gray-400">Pick both days.</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <Skeleton /> : (
        <AnimatePresence mode="wait">
          <motion.div key={`${start}-${end}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="mt-5">
            {/* 1. how many, up or down */}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div>
                <p className="font-serif text-[52px] font-black leading-[0.95] tabular-nums tracking-tight text-[#111827] dark:text-white sm:text-6xl">
                  <AnimatedNumber value={value} />{isPercent ? <span className="text-[0.6em]">%</span> : null}
                </p>
                <p className="mt-1.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400">
                  {isPercent ? (den ? (num <= den ? `${ofText(num, den)} finished` : ofText(num, den)) : 'finished') : value === 1 ? info.one : info.many} · {words}
                </p>
                {!isPercent && history?.companion && companionTotal > 0 && (
                  <p className="mt-1 text-[12px] font-bold text-[#8b7355] dark:text-[#e8c97a]">
                    {Math.min(100, Math.round((value / companionTotal) * 100))}% of {companionTotal.toLocaleString()} {history.companion.label}
                  </p>
                )}
              </div>
              {periodWords && <ChangePill now={value} before={prevValue} words={periodWords} isPercent={isPercent} />}
            </div>

            {/* 2. when */}
            <div className="relative mt-6 rounded-3xl border border-gray-200/80 bg-gradient-to-b from-[#fbf8f1] to-white px-3 pb-3 pt-6 dark:border-white/[0.07] dark:from-white/[0.035] dark:to-transparent sm:px-5">
              <p className="absolute left-4 top-3 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 sm:left-5">By {grain}{sheet ? ' · tap a bar' : ''}</p>
              <div className="mt-3"><Bars list={list} grain={grain} isPercent={isPercent} unit={unit} avg={empty ? 0 : avg} /></div>
              {empty && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                  className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl border border-[#C9A24D]/25 bg-white/95 p-4 text-center shadow-lg dark:bg-[#1c1c1f]/95">
                  <p className="font-serif text-lg font-black text-[#111827] dark:text-white">Nothing in the {words}</p>
                  {info.empty && <p className="mx-auto mt-1 max-w-sm text-[12.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{info.empty}</p>}
                  {lastActive && lastActive < start && (
                    <button type="button" onClick={() => setRange(daysBetween(lastActive, today) < 90 ? '90d' : daysBetween(lastActive, today) < 365 ? '1y' : 'all')}
                      className="mt-3 rounded-full bg-[#111827] px-4 py-2 text-[12px] font-black text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
                      Last one was {short(lastActive)} - show it
                    </button>
                  )}
                </motion.div>
              )}
            </div>

            {/* 3. highlights */}
            {!empty && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                {isPercent ? (
                  <>
                    <Tile k="o" i={0} label="Opened" value={den.toLocaleString()} sub={words} />
                    <Tile k="f" i={1} label="Finished" value={num.toLocaleString()} />
                    <Tile k="b" i={2} label="Best day" value={best ? `${best.count}%` : '-'} sub={best ? short(best.date) : undefined} />
                  </>
                ) : (
                  <>
                    <Tile k="b" i={0} label="Best day" value={best ? best.count.toLocaleString() : '-'} sub={best ? parse(best.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : undefined} />
                    <Tile k="a" i={1} label="Per day" value={perDay(value / span)} sub={`${activeDays} active day${activeDays === 1 ? '' : 's'}`} />
                    <Tile k="w" i={2} label="Busiest" value={busiest >= 0 ? WEEKDAYS[busiest] : '-'} sub={busiest >= 0 ? unit(weekdaySums[busiest]) : undefined} />
                  </>
                )}
              </div>
            )}

            {/* what it was */}
            {breakdown?.title && breakdown.items.length > 0 && (
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6">
                <h3 className="font-serif text-lg font-black text-[#111827] dark:text-white">{breakdown.title}</h3>
                <div className="mt-3"><Breakdown data={breakdown} isPercent={isPercent} unit={unit} total={value} /></div>
              </motion.section>
            )}

            {/* weekly rhythm */}
            {!empty && !isPercent && span >= 14 && (
              <section className="mt-6">
                <h3 className="font-serif text-lg font-black text-[#111827] dark:text-white">Your week</h3>
                <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{busiest >= 0 ? `${WEEKDAY_PLURAL[busiest]} are your busiest - a good day to post or send.` : ''}</p>
                <div className="mt-3"><Rhythm days={days} /></div>
              </section>
            )}

            <p className="mt-6 text-center text-[11px] font-semibold text-gray-400">Tracking since {parse(joined).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </motion.div>
        </AnimatePresence>
      )}
    </>
  )

  return createPortal(
    <motion.div className={`fixed inset-0 z-[200] flex bg-[#0b0f17]/65 ${sheet ? 'items-end' : 'items-center justify-center p-4'}`} onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.22 }}>
      <motion.div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${label} stats`} data-testid="stat-detail"
        initial={sheet ? { y: '100%' } : { opacity: 0, y: 28, scale: 0.97 }}
        animate={sheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
        exit={sheet ? { y: '100%', transition: { duration: 0.22 } } : { opacity: 0, y: 18, scale: 0.98, transition: { duration: 0.18 } }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        drag={sheet ? 'y' : false} dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 600) onClose() }}
        className={`relative w-full overflow-y-auto overscroll-contain bg-white shadow-[0_40px_90px_-30px_rgba(17,24,39,.6)] dark:bg-[#151517] ${sheet
          ? 'max-h-[92dvh] rounded-t-[28px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3'
          : 'max-h-[90vh] max-w-2xl rounded-[28px] border border-[#C9A24D]/25 p-7 dark:border-white/[0.08]'}`}>
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent" />
        {sheet && <div onPointerDown={e => drag.start(e)} className="-mx-4 -mt-3 mb-1 flex cursor-grab touch-none justify-center pb-2 pt-3" aria-hidden><span className="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-white/20" /></div>}
        {content}
      </motion.div>
    </motion.div>,
    document.body
  )
}
