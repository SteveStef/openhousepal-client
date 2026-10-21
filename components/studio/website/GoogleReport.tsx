'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Eye, FileText, MousePointerClick, Search, Table2, Trophy, X } from 'lucide-react'
import type { GoogleReport as Report } from '@/lib/api-service'

// "How people find you on Google" - the agent's last 28 days in Google Search (backend
// google_search_service.report_for, from the Search Console property OpenHousePal set up for them).
// A small strip on the Google tab's "Show up on Google" card opens the full report: three headline
// numbers, the day-by-day trend (hover for any day), what people typed, and the pages they found.
// One series per chart, one axis; the gold passes the dataviz checks on both light and dark.

const GOLD = '#B08A3A'
const nf = new Intl.NumberFormat('en-US')
const compact = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n))
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

type Metric = 'impressions' | 'clicks'
const METRIC_LABEL: Record<Metric, string> = { impressions: 'Showed up', clicks: 'Visits' }

/** The headline, in plain words. */
export function reportHeadline(r: Report): string {
  const t = r.totals
  if (!t || (!t.impressions && !t.clicks)) return 'Google just added your site. Your first numbers usually show up within a few days.'
  const change = pct(t.clicks, r.previous?.clicks)
  const top = r.queries?.[0]?.query
  const lead = t.clicks
    ? `${nf.format(t.clicks)} ${t.clicks === 1 ? 'person' : 'people'} visited your site from Google${change !== null && change >= 5 ? ` - up ${change}%` : ''}.`
    : `You showed up in Google ${nf.format(t.impressions)} times.`
  return top ? `${lead} Top search: “${top}”.` : lead
}

function pct(cur: number, prev?: number | null): number | null {
  if (!prev) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function spotLabel(pos: number | null): string {
  if (!pos) return 'Shows once people find you'
  return pos <= 10 ? 'First page of Google' : pos <= 20 ? 'Second page' : `Page ${Math.ceil(pos / 10)}`
}

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

/** The little strip on the "Show up on Google" card. */
export function GoogleReportStrip({ report, onOpen }: { report: Report; onOpen: () => void }) {
  const t = report.totals
  const empty = !t || (!t.impressions && !t.clicks)
  return (
    <motion.button type="button" onClick={onOpen} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}
      className="group mt-3 block w-full overflow-hidden rounded-xl border border-[#C9A24D]/30 bg-white text-left shadow-[0_10px_24px_-20px_rgba(139,106,43,.8)] transition dark:border-white/10 dark:bg-[#141416]">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">Your Google report · last 28 days</p>
        <ChevronRight className="h-3.5 w-3.5 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-[#111827] dark:group-hover:text-white" />
      </div>
      {empty ? (
        <p className="px-3 pb-3 pt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">First numbers in a few days - tap to see what you&apos;ll get.</p>
      ) : (
        <div className="flex items-end justify-between gap-3 px-3 pb-2.5 pt-1">
          <div className="flex gap-4">
            <div><p className="font-serif text-xl font-black leading-none text-[#111827] dark:text-white">{compact(t!.impressions)}</p><p className="mt-1 text-[10px] font-bold text-gray-500">showed up</p></div>
            <div><p className="font-serif text-xl font-black leading-none text-[#111827] dark:text-white">{compact(t!.clicks)}</p><p className="mt-1 text-[10px] font-bold text-gray-500">visits</p></div>
          </div>
          <Sparkline days={report.days || []} />
        </div>
      )}
    </motion.button>
  )
}

function Sparkline({ days }: { days: { impressions: number }[] }) {
  const W = 110, H = 34
  const max = Math.max(1, ...days.map(d => d.impressions))
  const pts = days.map((d, i) => [(i / Math.max(1, days.length - 1)) * W, H - 3 - (d.impressions / max) * (H - 6)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0">
      <path d={`${line}L${W},${H}L0,${H}Z`} fill={GOLD} opacity={0.1} />
      <motion.path d={line} fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      {pts.length > 0 && <circle cx={pts[pts.length - 1][0] - 1} cy={pts[pts.length - 1][1]} r={3} fill={GOLD} />}
    </svg>
  )
}

/** The full report. */
export default function GoogleReportModal({ report, agentName, onClose }: { report: Report; agentName?: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!mounted) return null
  const t = report.totals || { impressions: 0, clicks: 0, ctr: null, position: null }
  const empty = !t.impressions && !t.clicks
  const range = report.start && report.end ? `${shortDay(report.start)} – ${shortDay(report.end)}` : 'Last 28 days'

  return createPortal(
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Your Google report"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={e => e.stopPropagation()} initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-[#faf9f7] shadow-2xl dark:bg-[#0E0E10] sm:rounded-3xl">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-[#C9A24D]/25 bg-gradient-to-br from-[#fffaf0] via-[#f8eed8] to-[#efdcb3] px-5 pb-5 pt-5 dark:border-white/10 dark:from-[#1b1710] dark:via-[#141210] dark:to-[#0E0E10] sm:px-8 sm:pt-7">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.35),transparent_65%)]" />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/70 p-2 text-gray-600 transition hover:bg-white hover:text-[#111827] dark:bg-white/10 dark:text-white/70 dark:hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]"><Search className="h-3 w-3" /> Your Google report</p>
          <h2 className="mt-1.5 font-serif text-3xl font-black tracking-tight text-[#111827] dark:text-white sm:text-4xl">How people <span className="italic text-[#a8812f] dark:text-[#e8c97a]">find you</span></h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-[#4b4234] dark:text-white/70">{reportHeadline(report)}</p>
          <p className="mt-2 text-[11px] font-bold text-[#8b7355]/80 dark:text-white/40">{range}{report.host ? ` · ${report.host}` : ''} · Google&apos;s numbers run 2-3 days behind</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-8">
          {/* Headline numbers */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatTile icon={Eye} label="Times you showed up" hint="Your site appeared in someone's Google results" value={t.impressions} change={pct(t.impressions, report.previous?.impressions)} delay={0} />
            <StatTile icon={MousePointerClick} label="Visits from Google" hint="People who clicked through to your site" value={t.clicks} change={pct(t.clicks, report.previous?.clicks)} delay={0.08} />
            <StatTile icon={Trophy} label="Your average spot" hint={spotLabel(t.position)} value={t.position || 0} format={v => (t.position ? `#${Math.max(1, Math.round(v))}` : '-')}
              change={t.position && report.previous?.position ? Math.round(report.previous.position - t.position) : null} changeUnit="spots" delay={0.16} />
          </div>

          {/* Trend */}
          <TrendCard days={report.days || []} empty={empty} />

          {/* Searches + pages */}
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Section className="lg:col-span-3" icon={Search} title="What people typed into Google" sub="The searches that showed your site, most first">
              {report.queries?.length ? (
                <BarList rows={report.queries.map(q => ({ label: q.query, value: q.impressions, aside: q.clicks ? `${nf.format(q.clicks)} ${q.clicks === 1 ? 'visit' : 'visits'}` : '', chip: isYourName(q.query, agentName) ? 'Your name' : '' }))} unit="times" />
              ) : <Empty text={empty ? 'Your top searches show up here - usually your name and your towns first.' : 'Google keeps rare searches private, so none to show yet.'} />}
            </Section>
            <Section className="lg:col-span-2" icon={FileText} title="Pages people found" sub="Where Google sent them">
              {report.pages?.length ? (
                <BarList rows={report.pages.map(p => ({ label: pageName(p.path), value: p.impressions, aside: p.clicks ? `${nf.format(p.clicks)} ${p.clicks === 1 ? 'visit' : 'visits'}` : '' }))} unit="times" />
              ) : <Empty text="Your home page, town guides and listings show up here." />}
            </Section>
          </div>

          <p className="mt-5 text-center text-[11px] font-semibold text-gray-400">
            Straight from Google Search Console. Updated twice a day - nothing for you to set up.
          </p>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

function isYourName(query: string, name?: string) {
  const q = query.toLowerCase()
  return !!name && name.toLowerCase().split(/\s+/).filter(w => w.length > 2).some(w => q.includes(w))
}

function pageName(path: string) {
  if (!path || path === '/') return 'Home page'
  const seg = path.replace(/^\/+|\/+$/g, '').split('/')
  const names: Record<string, string> = { search: 'Search homes', properties: 'Featured homes', neighborhoods: 'Neighborhoods', blog: 'Articles', about: 'About', contact: 'Contact', testimonials: 'Reviews', 'home-value': 'Home value' }
  if (seg.length === 1 && names[seg[0]]) return names[seg[0]]
  return decodeURIComponent(seg[seg.length - 1]).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function StatTile({ icon: Icon, label, hint, value, change, changeUnit = '%', format, delay }: {
  icon: typeof Eye; label: string; hint: string; value: number; change: number | null; changeUnit?: string; format?: (v: number) => string; delay: number
}) {
  const v = useCountUp(value)
  const up = change !== null && change > 0
  const down = change !== null && change < 0
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 220, damping: 22 }}
      className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-3 shadow-[0_14px_30px_-26px_rgba(17,24,39,.5)] sm:p-4 dark:border-white/[0.08] dark:bg-[#141416]">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a] sm:h-8 sm:w-8"><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
        {change !== null && change !== 0 && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black sm:px-2 sm:text-[10px] ${up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/60'}`}>
            {up ? <ArrowUpRight className="h-3 w-3" strokeWidth={3} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={3} />}
            {up ? '+' : ''}{change}{changeUnit === '%' ? '%' : ` ${changeUnit}`}
          </span>
        )}
      </div>
      <p className="mt-2 font-serif text-2xl font-black tabular-nums sm:mt-3 sm:text-4xl tracking-tight text-[#111827] dark:text-white">{format ? format(v) : nf.format(Math.round(v))}</p>
      <p className="mt-1 text-[10px] font-black leading-tight text-[#111827] dark:text-white sm:text-xs">{label}</p>
      <p className="mt-0.5 hidden text-[11px] font-semibold text-gray-500 dark:text-gray-400 sm:block">{hint}{(up || down) ? <span className="sr-only">{up ? ', up' : ', down'} versus the 28 days before</span> : null}</p>
    </motion.div>
  )
}

function Section({ icon: Icon, title, sub, children, className = '' }: { icon: typeof Eye; title: string; sub: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.08] dark:bg-[#141416] ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white"><Icon className="h-3.5 w-3.5 text-[#C9A24D]" />{title}</p>
      <p className="mb-3 mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{sub}</p>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-[11px] font-semibold text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">{text}</p>
}

function BarList({ rows, unit }: { rows: { label: string; value: number; aside?: string; chip?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={`${r.label}-${i}`} title={`${r.label}: showed up ${nf.format(r.value)} ${unit}${r.aside ? `, ${r.aside}` : ''}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-xs font-bold text-[#111827] dark:text-white">{r.label}</span>
              {r.chip && <span className="shrink-0 rounded-full bg-[#C9A24D]/15 px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-[#8b6a2b] dark:text-[#e8c97a]">{r.chip}</span>}
            </span>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-500 dark:text-gray-400">{nf.format(r.value)}{r.aside ? <span className="text-gray-400"> · {r.aside}</span> : null}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
            <motion.div className="h-full rounded-full" style={{ background: GOLD }} initial={{ width: 0 }} animate={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} transition={{ delay: 0.15 + i * 0.04, type: 'spring', stiffness: 120, damping: 20 }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

function niceMax(v: number) {
  if (v <= 4) return 4
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => n <= s) || 10) * p
}

function TrendCard({ days, empty }: { days: { date: string; impressions: number; clicks: number }[]; empty: boolean }) {
  const [metric, setMetric] = useState<Metric>('impressions')
  const [table, setTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A brand-new site has no numbers yet - show the shape it'll take, clearly marked as an example.
  const sample = useMemo(() => days.map((d, i) => ({ ...d, impressions: Math.round(6 + i * 1.6 + 5 * Math.sin(i / 2.2)), clicks: Math.round(0.4 + i * 0.12 + Math.sin(i / 3)) })), [days])
  const data = empty ? sample : days
  const H = 210, L = 40, R = 14, TOP = 14, B = 26
  const max = niceMax(Math.max(1, ...data.map(d => d[metric])))
  const x = (i: number) => L + (i / Math.max(1, data.length - 1)) * (w - L - R)
  const y = (v: number) => TOP + (1 - v / max) * (H - TOP - B)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[metric]).toFixed(1)}`).join('')
  const area = data.length ? `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : ''
  const ticks = [0, max / 2, max]
  const hi = hover !== null ? data[hover] : null
  const total = data.reduce((s, d) => s + d[metric], 0)

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * (w - L - R)
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((px / (w - L - R)) * (data.length - 1)))))
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/[0.08] dark:bg-[#141416]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#111827] dark:text-white">{metric === 'impressions' ? 'Times you showed up, day by day' : 'Visits from Google, day by day'}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{empty ? 'An example of what you\'ll see - your real numbers start in a few days' : `${nf.format(total)} in the last 28 days · hover any day`}</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" className="flex rounded-full bg-gray-100 p-0.5 dark:bg-white/[0.06]">
            {(['impressions', 'clicks'] as Metric[]).map(m => (
              <button key={m} role="tab" aria-selected={metric === m} type="button" onClick={() => setMetric(m)}
                className={`relative rounded-full px-3 py-1 text-[11px] font-black transition ${metric === m ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-white/60 dark:hover:text-white'}`}>
                {metric === m && <motion.span layoutId="g-metric" className="absolute inset-0 rounded-full bg-[#111827] dark:bg-white" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                <span className="relative">{METRIC_LABEL[m]}</span>
              </button>
            ))}
          </div>
          {!empty && (
            <button type="button" onClick={() => setTable(v => !v)} aria-pressed={table} title="Show as a table"
              className={`rounded-full p-1.5 transition ${table ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'}`}>
              <Table2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div ref={wrap} className="relative mt-3">
        <AnimatePresence mode="wait" initial={false}>
          {table && !empty ? (
            <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-h-[210px] overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-white text-gray-500 dark:bg-[#141416]"><tr><th className="py-1 font-black">Day</th><th className="py-1 text-right font-black">Showed up</th><th className="py-1 text-right font-black">Visits</th></tr></thead>
                <tbody>{[...data].reverse().map(d => (
                  <tr key={d.date} className="border-t border-gray-100 font-semibold text-[#111827] dark:border-white/5 dark:text-white"><td className="py-1">{longDay(d.date)}</td><td className="py-1 text-right tabular-nums">{nf.format(d.impressions)}</td><td className="py-1 text-right tabular-nums">{nf.format(d.clicks)}</td></tr>
                ))}</tbody>
              </table>
            </motion.div>
          ) : (
            <motion.div key={`chart-${metric}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={empty ? 'opacity-60' : ''}>
              <svg width={w} height={H} role="img" aria-label={`${METRIC_LABEL[metric]} per day for the last 28 days`} className="block overflow-visible">
                <defs>
                  <linearGradient id="g-wash" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={0.22} /><stop offset="100%" stopColor={GOLD} stopOpacity={0.02} /></linearGradient>
                </defs>
                {ticks.map(v => (
                  <g key={v}>
                    <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} className="stroke-gray-100 dark:stroke-white/[0.06]" strokeWidth={1} />
                    <text x={L - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-gray-400 text-[10px] font-bold tabular-nums">{compact(Math.round(v))}</text>
                  </g>
                ))}
                {data.length > 0 && [0, Math.floor((data.length - 1) / 2), data.length - 1].map(i => (
                  <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="fill-gray-400 text-[10px] font-bold">{shortDay(data[i].date)}</text>
                ))}
                <path d={area} fill="url(#g-wash)" />
                <motion.path d={line} fill="none" stroke={GOLD} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={empty ? '4 4' : undefined}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
                {!empty && data.length > 0 && hover === null && (
                  <g>
                    <circle cx={x(data.length - 1)} cy={y(data[data.length - 1][metric])} r={6} className="fill-white dark:fill-[#141416]" />
                    <circle cx={x(data.length - 1)} cy={y(data[data.length - 1][metric])} r={4} fill={GOLD} />
                  </g>
                )}
                {hi && hover !== null && (
                  <g pointerEvents="none">
                    <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={y(0)} className="stroke-gray-300 dark:stroke-white/20" strokeWidth={1} />
                    <circle cx={x(hover)} cy={y(hi[metric])} r={6} className="fill-white dark:fill-[#141416]" />
                    <circle cx={x(hover)} cy={y(hi[metric])} r={4} fill={GOLD} />
                  </g>
                )}
                {!empty && <rect x={L} y={TOP} width={Math.max(0, w - L - R)} height={H - TOP - B} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ cursor: 'crosshair' }} />}
              </svg>
              {hi && hover !== null && (
                <div className="pointer-events-none absolute top-0 z-10 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-white/10 dark:bg-[#1c1c1f]"
                  style={{ left: Math.min(Math.max(x(hover) - 70, 0), w - 150), transform: 'translateY(-8px)' }}>
                  <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">{longDay(hi.date)}</p>
                  <p className="mt-0.5 text-xs font-black text-[#111827] dark:text-white">{nf.format(hi.impressions)} <span className="font-semibold text-gray-500">showed up</span></p>
                  <p className="text-xs font-black text-[#111827] dark:text-white">{nf.format(hi.clicks)} <span className="font-semibold text-gray-500">{hi.clicks === 1 ? 'visit' : 'visits'}</span></p>
                </div>
              )}
              {empty && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#111827] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-[#111827]">Example</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
