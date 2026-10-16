'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { Loader2, X } from 'lucide-react'
import api from '@/lib/api-service'
import { StatDailyPoint } from '@/types'
import { todayLocal } from '@/lib/relativeDays'

interface StatDetailModalProps {
  metric: string
  label: string
  isPercent?: boolean
  onClose: () => void
}

type RangeOption = '1m' | '3m' | '6m' | 'ytd' | '1y' | 'all' | 'custom'

const RANGE_OPTIONS: { id: RangeOption; label: string }[] = [
  { id: '1m', label: '1M' },
  { id: '3m', label: '3M' },
  { id: '6m', label: '6M' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom' },
]

function rangeStartDate(range: RangeOption): Date | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const back = (days: number) => { const d = new Date(today); d.setDate(d.getDate() - days); return d }
  switch (range) {
    case '1m': return back(30)
    case '3m': return back(90)
    case '6m': return back(180)
    case '1y': return back(365)
    case 'ytd': return new Date(today.getFullYear(), 0, 1)
    case 'all': case 'custom': default: return null
  }
}

function rangeSpanDays(range: RangeOption, customStart?: string, customEnd?: string): number {
  if (range === 'custom') {
    if (!customStart || !customEnd) return 30
    const days = Math.round((new Date(`${customEnd}T00:00:00`).getTime() - new Date(`${customStart}T00:00:00`).getTime()) / 86400000)
    return Math.max(days, 1)
  }
  const start = rangeStartDate(range)
  if (!start) return 370
  const days = Math.round((Date.now() - start.getTime()) / 86400000)
  return Math.max(days, 7)
}

function filterDailyByRange(daily: StatDailyPoint[], range: RangeOption, customStart?: string, customEnd?: string): StatDailyPoint[] {
  if (range === 'custom') {
    if (!customStart && !customEnd) return daily
    return daily.filter(point => (!customStart || point.date >= customStart) && (!customEnd || point.date <= customEnd))
  }
  const start = rangeStartDate(range)
  if (!start) return daily
  const cutoff = start.toISOString().slice(0, 10)
  return daily.filter(point => point.date >= cutoff)
}

function monthlySeries(daily: StatDailyPoint[], isPercent: boolean): { label: string; value: number }[] {
  const sums = new Map<string, { total: number; days: number }>()
  daily.forEach(point => {
    const key = point.date.slice(0, 7)
    const entry = sums.get(key) || { total: 0, days: 0 }
    entry.total += point.count
    entry.days += 1
    sums.set(key, entry)
  })
  return Array.from(sums.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { total, days }]) => {
      const [y, m] = key.split('-').map(Number)
      const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
      return { label, value: isPercent ? Math.round(total / days) : total }
    })
}

function weeklySeries(daily: StatDailyPoint[], isPercent: boolean): { label: string; value: number }[] {
  const sums = new Map<string, { total: number; days: number; start: Date }>()
  daily.forEach(point => {
    const d = new Date(`${point.date}T00:00:00`)
    const weekStart = new Date(d)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const key = weekStart.toISOString().slice(0, 10)
    const entry = sums.get(key) || { total: 0, days: 0, start: weekStart }
    entry.total += point.count
    entry.days += 1
    sums.set(key, entry)
  })
  return Array.from(sums.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { total, days, start }]) => {
      const label = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      return { label, value: isPercent ? Math.round(total / days) : total }
    })
}

function contributionWeeks(daily: StatDailyPoint[], spanDays: number): { date: string; count: number }[][] {
  const map = new Map(daily.map(d => [d.date, d.count]))
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - spanDays)
  start.setDate(start.getDate() - start.getDay())

  const weeks: { date: string; count: number }[][] = []
  let week: { date: string; count: number }[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10)
    week.push({ date: iso, count: map.get(iso) || 0 })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (week.length) weeks.push(week)
  return weeks
}

function bucketClass(count: number, max: number): string {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800'
  const ratio = max > 0 ? count / max : 0
  if (ratio > 0.75) return 'bg-[#C9A24D]'
  if (ratio > 0.5) return 'bg-[#C9A24D]/70'
  if (ratio > 0.25) return 'bg-[#C9A24D]/45'
  return 'bg-[#C9A24D]/25'
}

function StockChart({ data, isPercent, unit = 'total' }: { data: { label: string; value: number }[]; isPercent?: boolean; unit?: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ index: number; left: number; top: number } | null>(null)

  if (data.length === 0) {
    return <p className="flex h-44 items-center justify-center text-sm font-bold text-gray-400">No history in this range</p>
  }
  const width = 640
  const height = 180
  const padX = 8
  const padY = 16
  const max = Math.max(...data.map(d => d.value), isPercent ? 100 : 1)
  const step = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0
  const points = data.map((d, i) => {
    const x = padX + i * step
    const y = height - padY - (d.value / max) * (height - padY * 2)
    return { x, y, ...d }
  })
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${height - padY} L${points[0].x.toFixed(1)},${height - padY} Z`

  // Positions the tooltip in fixed (viewport) coordinates via a portal, instead of absolute
  // positioning inside the horizontally-scrollable chart wrapper - an absolutely-positioned
  // tooltip in that wrapper would overflow it near the edges and force a spurious scrollbar.
  const handleEnter = (index: number, point: { x: number; y: number }) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    setHover({
      index,
      left: rect.left + (point.x / width) * rect.width,
      top: rect.top + (point.y / height) * rect.height,
    })
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="statAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A24D" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#C9A24D" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path key={`a-${areaPath}`} d={areaPath} fill="url(#statAreaGradient)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.25 }} />
          <motion.path key={`l-${linePath}`} d={linePath} fill="none" stroke="#C9A24D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={hover?.index === i ? 4 : 2.5} fill="#C9A24D" className="transition-all" />
              {/* Larger transparent hit target so hovering near a point is easy, not just the tiny dot */}
              <circle cx={p.x} cy={p.y} r={Math.max(step / 2, 10)} fill="transparent" onMouseEnter={() => handleEnter(i, p)} className="cursor-pointer" />
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-1 flex min-w-[480px] justify-between px-1 text-[10px] font-black uppercase tracking-wide text-gray-400">
        {points.filter((_, i) => i === 0 || i === points.length - 1 || points.length <= 8).map((p, i) => (
          <span key={i}>{p.label}</span>
        ))}
      </div>
      {hover && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[300] -translate-x-1/2 -translate-y-full rounded-lg bg-[#111827] px-2.5 py-1.5 text-xs font-black text-white shadow-lg dark:bg-white dark:text-[#111827]"
          style={{ left: hover.left, top: hover.top - 8 }}
        >
          {points[hover.index].value}{isPercent ? '% completion' : ` ${unit}`}
          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-300 dark:text-gray-500">{points[hover.index].label}</span>
        </div>,
        document.body
      )}
    </div>
  )
}

function ContributionGraph({ daily, spanDays }: { daily: StatDailyPoint[]; spanDays: number }) {
  const weeks = contributionWeeks(daily, spanDays)
  const max = Math.max(...daily.map(d => d.count), 1)
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]" style={{ minWidth: weeks.length * 13 }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) => (
              <div
                key={di}
                title={`${day.date}: ${day.count}`}
                className={`h-[10px] w-[10px] rounded-[2px] ${bucketClass(day.count, max)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatDetailModal({ metric, label, isPercent, onClose }: StatDetailModalProps) {
  const [loading, setLoading] = useState(true)
  const [daily, setDaily] = useState<StatDailyPoint[]>([])
  const [joinedAt, setJoinedAt] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [range, setRange] = useState<RangeOption>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let cancelled = false
    api.stats.getHistory(metric as any).then(response => {
      if (cancelled) return
      if (response.success && response.data) {
        setDaily(response.data.daily)
        setJoinedAt(response.data.joined_at)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [metric])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rangedDaily = useMemo(() => filterDailyByRange(daily, range, customStart, customEnd), [daily, range, customStart, customEnd])
  const spanDays = useMemo(() => rangeSpanDays(range, customStart, customEnd), [range, customStart, customEnd])
  const isWeeklyView = range === '1m' || (range === 'custom' && spanDays <= 31)
  const series = useMemo(
    () => (isWeeklyView ? weeklySeries(rangedDaily, Boolean(isPercent)) : monthlySeries(rangedDaily, Boolean(isPercent))),
    [rangedDaily, isWeeklyView, isPercent]
  )

  if (!mounted) return null

  const totalInRange = isPercent
    ? (series.length ? Math.round(series.reduce((s, m) => s + m.value, 0) / series.length) : 0)
    : rangedDaily.reduce((s, d) => s + d.count, 0)

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0b0f17]/65 p-4"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98, transition: { duration: 0.18 } }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-3xl border border-[#C9A24D]/25 bg-white p-6 shadow-[0_40px_90px_-30px_rgba(17,24,39,.6)] dark:border-white/[0.08] dark:bg-[#151517] sm:p-8"
        onClick={event => event.stopPropagation()}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">Stat History</p>
            <h2 className="mt-1 font-serif text-2xl font-black text-[#111827] dark:text-white">{label}</h2>
            {joinedAt && <p className="mt-1 text-xs font-semibold text-gray-400">Tracking since {new Date(`${joinedAt}T00:00:00`).toLocaleDateString()}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full border border-gray-200 p-2 text-gray-400 transition hover:rotate-90 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map(option => (
            <button
              key={option.id}
              onClick={() => setRange(option.id)}
              className={`relative rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                range === option.id ? 'text-white dark:text-[#111827]' : 'border border-gray-200 text-gray-400 hover:border-[#C9A24D]/60 hover:text-[#8b7355] dark:border-gray-700'
              }`}
            >
              {range === option.id && <motion.span layoutId={`stat-range-${metric}`} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-full bg-[#111827] dark:bg-white" />}
              <span className="relative">{option.label}</span>
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 dark:border-gray-800 dark:bg-[#111113]">
            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-gray-400">
              From
              <input
                type="date"
                value={customStart}
                max={customEnd || todayLocal()}
                onChange={event => setCustomStart(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-[#111827] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-gray-400">
              To
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={todayLocal()}
                onChange={event => setCustomEnd(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-[#111827] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
              />
            </label>
            {!customStart || !customEnd ? (
              <span className="text-[11px] font-semibold text-gray-400">Pick both dates to see that range's totals.</span>
            ) : null}
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm font-bold text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading history...
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="mt-6 space-y-8">
            <div className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-800 dark:bg-[#111113] sm:p-5">
              <p className="font-serif text-4xl font-black tabular-nums text-[#111827] dark:text-white"><AnimatedNumber value={totalInRange} />{isPercent ? '%' : ''}</p>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                {isPercent ? 'Average completion' : 'Total'} · {range === 'custom'
                  ? (customStart && customEnd
                    ? `${new Date(`${customStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(`${customEnd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Custom')
                  : RANGE_OPTIONS.find(o => o.id === range)?.label}
              </p>
            </div>

            <div>
              <h3 className="font-serif text-lg font-black text-[#111827] dark:text-white">{isWeeklyView ? 'Weekly trend' : 'Monthly trend'}</h3>
              <p className="text-xs font-semibold text-gray-400">Hover a point for that {isWeeklyView ? "week's" : "month's"} total</p>
              <div className="mt-3">
                <StockChart data={series} isPercent={isPercent} unit={label.toLowerCase()} />
              </div>
            </div>

            <div>
              <h3 className="font-serif text-lg font-black text-[#111827] dark:text-white">Daily activity</h3>
              <div className="mt-3">
                <ContributionGraph daily={rangedDaily} spanDays={spanDays} />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
