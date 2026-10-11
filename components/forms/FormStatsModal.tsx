'use client'

// A form's Stats tab - Typeform-style insights: who opened it, who started, who shared contact
// info, who submitted, WHERE people give up (per question, from each visit's real path so branching
// forms are right) and WHEN (day by day + weekday/time heatmap), plus where they came from (QR
// scan / link / website), device and campaign. Numbers come from forms_routes._build_stats_payload
// -> form_insights_service.build_insights. Charts are hand-rolled SVG (no chart library here).
//
// Series colours were validated for colour-blind separation in both themes (dataviz validator,
// all-pairs): Views blue, Submitted gold, Dropped off magenta.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowRight, Clock, Eye, Globe, Laptop, Link2, Loader2, MousePointerClick, QrCode,
  Send, Smartphone, Tablet, UserCheck, X,
} from 'lucide-react'
import { FormStats, FormSplitRow } from '@/types'
import api from '@/lib/api-service'
import { useEscapeToClose } from '@/components/ui/windowMotion'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
] as const

// Scoped colour tokens (light + dark, validated) - text never wears these, only marks do.
const TOKENS = `
.ohp-insights{--views:#2a78d6;--done:#b8862b;--drop:#d55181;--grid:rgba(17,24,39,.07);--cell0:#f1efe9}
.dark .ohp-insights{--views:#3987e5;--done:#a8822c;--drop:#d55181;--grid:rgba(255,255,255,.07);--cell0:#1f1f22}
`

export function fmtDuration(seconds?: number | null) {
  if (seconds == null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : s ? `${m}m ${s}s` : `${m}m`
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

// ---------------------------------------------------------------- small pieces
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700)
      setShown(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  const decimals = Number.isInteger(value) ? 0 : 1
  return <>{shown.toFixed(decimals)}{suffix}</>
}

function Card({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] dark:border-white/10 dark:bg-[#121214] sm:p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-black text-[#111827] dark:text-white">{title}</h3>
          {hint && <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  )
}

function Kpi({ icon: Icon, label, value, text, suffix, caption, delay }: {
  icon: typeof Eye; label: string; value?: number | null; text?: string; suffix?: string; caption?: string; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-[#121214]"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <Icon className="h-3.5 w-3.5 text-[#C9A24D]" /> {label}
      </div>
      <p className="mt-1.5 text-[26px] font-black leading-none tracking-tight text-[#111827] dark:text-white">
        {text ?? (value == null ? '—' : <CountUp value={value} suffix={suffix} />)}
      </p>
      {caption && <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{caption}</p>}
    </motion.div>
  )
}

function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[150px] -translate-x-1/2 -translate-y-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] shadow-xl dark:border-white/10 dark:bg-[#1b1b1e]"
      style={{ left: x, top: y - 10 }}
    >
      {children}
    </div>
  )
}

const Swatch = ({ v }: { v: string }) => <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: `var(${v})` }} />

// ---------------------------------------------------------------- funnel
function Funnel({ funnel }: { funnel: NonNullable<FormStats['funnel']> }) {
  const top = Math.max(1, funnel[0]?.count || 0)
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="space-y-1">
      {funnel.map((f, i) => {
        const pct = (f.count / top) * 100
        const prev = i > 0 ? funnel[i - 1].count : null
        const lost = prev != null ? prev - f.count : 0
        return (
          <div key={f.key}>
            {i > 0 && (
              <div className="flex items-center gap-1.5 py-1 pl-3 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                <Swatch v="--drop" />
                {lost > 0 ? `${lost} didn't go on (${prev ? Math.round((lost / prev) * 100) : 0}%)` : 'Nobody lost here'}
              </div>
            )}
            <div
              className="group relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex items-baseline justify-between gap-2 text-[12px] font-bold text-gray-700 dark:text-gray-200">
                <span>{f.label}</span>
                <span className="tabular-nums text-[#111827] dark:text-white">
                  {f.count.toLocaleString()} <span className="text-[10px] font-semibold text-gray-400">{Math.round(pct)}%</span>
                </span>
              </div>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, f.count ? 2 : 0)}%` }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: 'var(--done)', opacity: hover === null || hover === i ? 1 : 0.55 }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- activity (lines + crosshair)
const SERIES = [
  { key: 'views', label: 'Views', v: '--views' },
  { key: 'completions', label: 'Submitted', v: '--done' },
  { key: 'dropOffs', label: 'Dropped off', v: '--drop' },
] as const

function Activity({ daily }: { daily: NonNullable<FormStats['daily']> }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const H = 190, padL = 28, padR = 10, padT = 10, padB = 22
  const max = Math.max(1, ...daily.flatMap(d => [d.views, d.completions, d.dropOffs]))
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4
  const w = Math.max(0, width - padL - padR)
  const x = (i: number) => padL + (daily.length <= 1 ? w / 2 : (i / (daily.length - 1)) * w)
  const y = (v: number) => padT + (1 - v / niceMax) * (H - padT - padB)
  const empty = daily.every(d => !d.views && !d.completions && !d.dropOffs)

  const path = (key: typeof SERIES[number]['key']) =>
    daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')

  const onMove = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const px = e.clientX - r.left - padL
    const i = Math.round((px / Math.max(1, w)) * (daily.length - 1))
    setHover(Math.min(daily.length - 1, Math.max(0, i)))
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-gray-600 dark:text-gray-300">
        {SERIES.map(s => (
          <span key={s.key} className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full" style={{ background: `var(${s.v})` }} />{s.label}</span>
        ))}
      </div>
      <div ref={ref} className="relative touch-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {empty ? (
          <p className="flex h-[190px] items-center justify-center text-xs font-semibold text-gray-400">No visits in this range yet.</p>
        ) : width > 0 && (
          <svg width={width} height={H} className="block overflow-visible">
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <g key={t}>
                <line x1={padL} x2={width - padR} y1={y(niceMax * t)} y2={y(niceMax * t)} stroke="var(--grid)" />
                <text x={padL - 6} y={y(niceMax * t) + 3} textAnchor="end" className="fill-gray-400 text-[9px] font-semibold">{Math.round(niceMax * t)}</text>
              </g>
            ))}
            {SERIES.map(s => (
              <motion.path
                key={s.key}
                d={path(s.key)}
                fill="none"
                stroke={`var(${s.v})`}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
              />
            ))}
            {[0, Math.floor((daily.length - 1) / 2), daily.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'} className="fill-gray-400 text-[9px] font-semibold">
                {shortDate(daily[i].date)}
              </text>
            ))}
            {hover != null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeDasharray="3 3" />
                {SERIES.map(s => (
                  <circle key={s.key} cx={x(hover)} cy={y(daily[hover][s.key])} r={4.5} fill={`var(${s.v})`} stroke="white" strokeWidth={2} className="dark:stroke-[#121214]" />
                ))}
              </g>
            )}
          </svg>
        )}
        {hover != null && !empty && (
          <Tip x={Math.min(Math.max(x(hover), 80), width - 80)} y={Math.min(...SERIES.map(s => y(daily[hover][s.key])))}>
            <p className="mb-1 font-black text-[#111827] dark:text-white">{longDate(daily[hover].date)}</p>
            {SERIES.map(s => (
              <p key={s.key} className="flex items-center justify-between gap-3 font-semibold text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-1.5"><Swatch v={s.v} />{s.label}</span>
                <span className="tabular-nums font-black text-[#111827] dark:text-white">{daily[hover][s.key]}</span>
              </p>
            ))}
            <p className="mt-1 flex justify-between gap-3 border-t border-gray-100 pt-1 font-semibold text-gray-500 dark:border-white/10 dark:text-gray-400">
              <span>Started</span><span className="tabular-nums font-black">{daily[hover].starts}</span>
            </p>
          </Tip>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- per question
function QuestionDropOff({ questions, onShowUnfinished }: { questions: NonNullable<FormStats['questions']>; onShowUnfinished?: () => void }) {
  const maxSeen = Math.max(1, ...questions.map(q => q.seenCount))
  const worst = Math.max(0, ...questions.map(q => q.droppedCount))
  const [hover, setHover] = useState<string | null>(null)
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <span className="flex items-center gap-1.5"><Swatch v="--views" /> Went on</span>
        <span className="flex items-center gap-1.5"><Swatch v="--drop" /> Left on this question</span>
      </div>
      <ol className="space-y-2.5">
        {questions.map((q, i) => {
          const continued = Math.max(0, q.seenCount - q.droppedCount)
          const isWorst = worst > 0 && q.droppedCount === worst
          return (
            <li
              key={q.questionId}
              onMouseEnter={() => setHover(q.questionId)}
              onMouseLeave={() => setHover(null)}
              className={`relative rounded-xl px-2.5 py-2 transition ${isWorst ? 'bg-[#d55181]/[0.06] ring-1 ring-[#d55181]/25' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[12px] font-bold leading-snug text-gray-700 dark:text-gray-200">
                  <span className="mr-1.5 text-gray-400">{q.number}.</span>{q.label}
                </p>
                <div className="shrink-0 text-right">
                  <p className={`text-[13px] font-black tabular-nums ${q.droppedCount ? 'text-[#111827] dark:text-white' : 'text-gray-400'}`}>
                    {q.droppedCount ? `${q.dropOffPercent}%` : '0%'}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">left here</p>
                </div>
              </div>
              <div className="mt-1.5 flex h-2.5 w-full items-center gap-[2px]">
                <div className="flex h-full gap-[2px]" style={{ width: `${(q.seenCount / maxSeen) * 100}%` }}>
                  {continued > 0 && (
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: i * 0.03 }}
                      className="h-full origin-left rounded-l-full" style={{ flexGrow: continued, background: 'var(--views)', borderRadius: q.droppedCount ? '9999px 0 0 9999px' : '9999px' }} />
                  )}
                  {q.droppedCount > 0 && (
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6, delay: 0.15 + i * 0.03 }}
                      className="h-full origin-left" style={{ flexGrow: q.droppedCount, background: 'var(--drop)', borderRadius: continued ? '0 9999px 9999px 0' : '9999px' }} />
                  )}
                </div>
                {q.seenCount === 0 && <span className="text-[10px] font-semibold text-gray-400">Nobody reached this yet</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                <span>{q.seenCount} saw it</span>
                {q.droppedCount > 0 && <span>{q.droppedCount} stopped here</span>}
                {q.medianSeconds != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDuration(q.medianSeconds)} typical</span>}
                {q.droppedCount > 0 && onShowUnfinished && (
                  <button
                    onClick={onShowUnfinished}
                    className={`ml-auto inline-flex items-center gap-0.5 font-black text-[#8b7355] transition-opacity hover:underline dark:text-[#d7b974] ${hover === q.questionId || isWorst ? 'sm:opacity-100' : 'sm:opacity-0'}`}
                  >
                    See who <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------- when (weekday x part of day)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PARTS = ['Night', 'Morning', 'Afternoon', 'Evening']
const PART_HOURS = ['12–6am', '6am–12pm', '12–6pm', '6pm–12am']

function DropHeat({ heat }: { heat: number[][] }) {
  const max = Math.max(0, ...heat.flat())
  const [hover, setHover] = useState<{ d: number; p: number } | null>(null)
  if (!max) return <p className="py-8 text-center text-xs font-semibold text-gray-400">No drop-offs in this range - nice.</p>
  let peak = { d: 0, p: 0 }
  heat.forEach((row, d) => row.forEach((v, p) => { if (v > heat[peak.d][peak.p]) peak = { d, p } }))
  return (
    <div>
      <div className="grid grid-cols-[34px_repeat(4,1fr)] gap-[3px] text-[9px] font-black uppercase tracking-wide text-gray-400">
        <span />
        {PARTS.map(p => <span key={p} className="pb-1 text-center">{p}</span>)}
        {heat.map((row, d) => (
          <div key={d} className="contents">
            <span className="flex items-center text-[10px]">{DAYS[d]}</span>
            {row.map((v, p) => (
              <div
                key={p}
                onMouseEnter={() => setHover({ d, p })}
                onMouseLeave={() => setHover(null)}
                className="relative flex h-7 items-center justify-center rounded-md text-[10px] font-black tabular-nums transition hover:ring-2 hover:ring-[#111827]/30 dark:hover:ring-white/40"
                style={{
                  background: v ? `color-mix(in oklab, var(--drop) ${18 + (v / max) * 72}%, var(--cell0))` : 'var(--cell0)',
                  color: v / max > 0.55 ? '#fff' : undefined,
                }}
              >
                <span className={v / max > 0.55 ? '' : 'text-gray-600 dark:text-gray-300'}>{v || ''}</span>
                {hover?.d === d && hover?.p === p && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111827] px-2 py-1 text-[10px] font-bold normal-case tracking-normal text-white shadow-lg">
                    {v} drop-off{v === 1 ? '' : 's'} · {DAYS[d]} {PART_HOURS[p]}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        Most drop-offs: <span className="font-black text-[#111827] dark:text-white">{DAYS[peak.d]} {PARTS[peak.p].toLowerCase()}</span> ({PART_HOURS[peak.p]}, Eastern)
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- sources / devices
const SOURCE_ICON: Record<string, typeof QrCode> = { qr: QrCode, link: Link2, website: Globe, mobile: Smartphone, tablet: Tablet, desktop: Laptop }

function Split({ rows }: { rows: FormSplitRow[] }) {
  const max = Math.max(1, ...rows.map(r => r.views))
  if (!rows.length) return <p className="py-4 text-center text-xs font-semibold text-gray-400">No visits yet.</p>
  return (
    <ul className="space-y-3">
      {rows.map(r => {
        const Icon = SOURCE_ICON[r.key] || MousePointerClick
        return (
          <li key={r.key}>
            <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-gray-700 dark:text-gray-200">
              <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-gray-400" />{r.label}</span>
              <span className="tabular-nums text-[#111827] dark:text-white">{r.views}<span className="ml-1 text-[10px] font-semibold text-gray-400">views</span></span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(r.views / max) * 100}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full" style={{ background: 'var(--views)' }} />
            </div>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">{r.completions} submitted · {r.completionRate}%</p>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- the dashboard
// Pure content, no modal chrome - reused both by the standalone modal below and inline as the
// Stats tab of FormCampaignsModal.
export function FormStatsContent({
  formId, campaignId, onShowUnfinished,
}: {
  formId: string
  // Unset = "All Campaigns" combined. 'general' = General only. A real id = that one campaign.
  campaignId?: string | 'general' | null
  // Jump to the Unfinished list (Results tab) - "See who" buttons.
  onShowUnfinished?: () => void
}) {
  const [days, setDays] = useState<number>(30)
  const [stats, setStats] = useState<FormStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    const request = campaignId === 'general'
      ? api.forms.getGeneralStats(formId, days)
      : campaignId
        ? api.forms.getCampaignStats(formId, campaignId, days)
        : api.forms.getStats(formId, days)
    request.then(response => {
      if (cancelled) return
      if (response.success && response.data) setStats(response.data)
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [formId, campaignId, days])

  const rangeLabel = RANGES.find(r => r.days === days)?.label.toLowerCase() || ''
  const leak = stats?.biggestLeak

  const campaigns = useMemo(() => {
    const rows = stats?.campaignBreakdown || []
    const max = Math.max(1, ...rows.map(r => r.views))
    return { rows, max }
  }, [stats])

  return (
    <div className="ohp-insights">
      <style>{TOKENS}</style>

      {/* range */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Eastern time · updates live as people fill it out</p>
        <div className="relative flex rounded-full border border-gray-200 bg-gray-50 p-0.5 dark:border-white/10 dark:bg-white/5">
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`relative rounded-full px-3 py-1 text-[11px] font-black transition-colors ${days === r.days ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
            >
              {days === r.days && <motion.span layoutId="insights-range" className="absolute inset-0 rounded-full bg-[#111827] dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
              <span className="relative">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && !stats ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
      ) : !stats ? (
        <p className="py-16 text-center text-sm font-semibold text-gray-400">Couldn&apos;t load stats.</p>
      ) : (
        <div className={`space-y-4 transition-opacity ${isLoading ? 'opacity-60' : ''}`}>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
            <Kpi icon={Eye} label="Views" value={stats.totalViews} caption={`in the last ${rangeLabel}`.replace('last all time', 'all time')} delay={0} />
            <Kpi icon={MousePointerClick} label="Started" value={stats.totalStarts} caption={`${stats.startRate ?? 0}% of views`} delay={0.04} />
            <Kpi icon={UserCheck} label="Shared contact" value={stats.contactCount ?? 0} caption={`${stats.contactRate ?? 0}% · reachable`} delay={0.08} />
            <Kpi icon={Send} label="Submitted" value={stats.totalCompletions} caption={`${stats.completionRate}% completion`} delay={0.12} />
            <div className="col-span-2 lg:col-span-1">
              <Kpi icon={Clock} label="Time to finish" text={fmtDuration(stats.medianCompletionSeconds)} caption="typical person who submitted" delay={0.16} />
            </div>
          </div>

          {/* leak callout */}
          <AnimatePresence>
            {leak && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-2 rounded-2xl border border-[#d55181]/25 bg-[#d55181]/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b83d6a] dark:text-[#e584a8]" />
                  <p className="text-[12px] font-semibold leading-snug text-gray-700 dark:text-gray-200">
                    <b className="text-[#111827] dark:text-white">Biggest drop-off: question {leak.number}</b> &ldquo;{leak.label}&rdquo; - {leak.droppedCount} people ({leak.dropOffPercent}%) stopped there.
                    <span className="text-gray-500 dark:text-gray-400"> Making it optional or moving it later usually helps.</span>
                  </p>
                </div>
                {onShowUnfinished && (
                  <button onClick={onShowUnfinished} className="inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white transition hover:brightness-125 dark:bg-white dark:text-[#111827] sm:self-auto">
                    See who stopped <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Card title="Activity" hint="Views, submissions and drop-offs by day - hover any day">
              <Activity daily={stats.daily || []} />
            </Card>
            <Card title="How far people get" hint="From opening the form to pressing Submit">
              <Funnel funnel={stats.funnel || []} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <Card
              title="Where people drop off"
              hint="Every question, in order - who saw it and who left on it. Branching questions only count people who were shown them."
              action={stats.dropOffCount ? (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600 dark:bg-white/10 dark:text-gray-300">{stats.dropOffCount} dropped off</span>
              ) : undefined}
            >
              {(stats.questions || []).length
                ? <QuestionDropOff questions={stats.questions!} onShowUnfinished={onShowUnfinished} />
                : <p className="py-6 text-center text-xs font-semibold text-gray-400">No questions to show.</p>}
            </Card>
            <div className="space-y-4">
              <Card title="When people drop off" hint="Day of week and time of day they left">
                <DropHeat heat={stats.dropOffHeat || Array.from({ length: 7 }, () => [0, 0, 0, 0])} />
              </Card>
              <Card title="Where visits come from" hint="QR code scans (mailers, flyers, signs) vs. links">
                <Split rows={stats.sources || []} />
              </Card>
              <Card title="Devices">
                <Split rows={stats.devices || []} />
              </Card>
            </div>
          </div>

          {(campaigns.rows.length > 1 || (stats.referrers || []).length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {campaigns.rows.length > 1 && (
                <Card title="By campaign" hint="Each mailer / ad gets its own link + QR - see which one pulls">
                  <ul className="space-y-3">
                    {campaigns.rows.map((c, i) => (
                      <li key={c.campaignId || `general-${i}`}>
                        <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-gray-700 dark:text-gray-200">
                          <span className="truncate">{c.name}{c.isDeleted ? ' (deleted)' : ''}</span>
                          <span className="shrink-0 tabular-nums text-[#111827] dark:text-white">{c.views}<span className="ml-1 text-[10px] font-semibold text-gray-400">views</span></span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(c.views / campaigns.max) * 100}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full" style={{ background: 'var(--views)' }} />
                        </div>
                        <p className="mt-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                          {c.leads} submitted · {c.views ? Math.round((c.leads / c.views) * 100) : 0}%
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {(stats.referrers || []).length > 0 && (
                <Card title="Top referring sites" hint="Where link clicks came from">
                  <ul className="space-y-1.5">
                    {stats.referrers!.map(r => (
                      <li key={r.host} className="flex items-center justify-between text-[12px] font-bold text-gray-700 dark:text-gray-200">
                        <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-gray-400" />{r.host}</span>
                        <span className="tabular-nums">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {(stats.inProgressCount ?? 0) > 0 && (
            <p className="flex items-center gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              {stats.inProgressCount} {stats.inProgressCount === 1 ? 'person is' : 'people are'} filling it out right now
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function FormStatsModal({
  formId, title, onClose, campaignId,
}: {
  formId: string
  title: string
  onClose: () => void
  campaignId?: string | 'general' | null
}) {
  useEscapeToClose(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-[#f7f6f2] p-5 shadow-2xl dark:border-gray-800 dark:bg-[#0B0B0B] sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-black tracking-tight text-[#111827] dark:text-white">Stats</p>
            <p className="truncate text-xs font-semibold text-gray-400">{title}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">
          <FormStatsContent formId={formId} campaignId={campaignId} />
        </div>
      </div>
    </div>
  )
}
