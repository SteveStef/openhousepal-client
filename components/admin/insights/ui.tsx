'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import Pager from '@/components/ui/Pager'

// Building blocks shared by the admin Insights pages: number tiles, a trend chart with a hover
// crosshair, bar lists, an hour-of-day strip and a sortable per-agent table.
// Series colours = the validated categorical slots 1-3 (dataviz palette), light and dark steps.
export const SERIES = [
  { stroke: 'stroke-[#2a78d6] dark:stroke-[#3987e5]', fill: 'fill-[#2a78d6] dark:fill-[#3987e5]', bg: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
  { stroke: 'stroke-[#eb6834] dark:stroke-[#d95926]', fill: 'fill-[#eb6834] dark:fill-[#d95926]', bg: 'bg-[#eb6834] dark:bg-[#d95926]' },
  { stroke: 'stroke-[#1baf7a] dark:stroke-[#199e70]', fill: 'fill-[#1baf7a] dark:fill-[#199e70]', bg: 'bg-[#1baf7a] dark:bg-[#199e70]' },
]

export const n0 = (v?: number | null) => (v == null ? '-' : Math.round(v).toLocaleString())
export const pctTxt = (v?: number | null) => (v == null ? '-' : `${v % 1 === 0 ? v : v.toFixed(1)}%`)
export const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
export function secsTxt(v?: number | null) {
  if (v == null) return '-'
  const s = Math.round(v)
  return s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} sec` : ''}`.trim()
}
export const ago = (iso?: string | null) => {
  if (!iso) return 'Never'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
const PLAN: Record<string, string> = { NO_MLS: 'No-MLS', PRO_NO_MLS: 'Pro No-MLS', BASIC: 'Basic', PREMIUM: 'Premium', IDX: 'IDX' }
export const planName = (t?: string | null) => (t && PLAN[t]) || 'No plan'

export function Card({ title, sub, children, className = '', action }: { title?: string; sub?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <section className={`rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-[#151517] ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-black text-[#111827] dark:text-white">{title}</h3>}
            {sub && <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, sub, warn, good, onClick }: { label: string; value: React.ReactNode; sub?: React.ReactNode; warn?: boolean; good?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition dark:bg-[#151517] ${warn ? 'border-red-200 dark:border-red-500/30' : 'border-gray-100 dark:border-gray-800'} ${onClick ? 'hover:border-[#C9A24D]/50' : ''}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${warn ? 'text-red-600 dark:text-red-400' : good ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#111827] dark:text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{sub}</p>}
    </Tag>
  )
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-[#C9A24D]/10 px-4 py-3 text-xs font-semibold leading-relaxed text-[#6b5a3a] dark:text-[#e8c97a]">{children}</p>
}

// ---------------------------------------------------------------- trend chart

export type Point = { d: string } & Record<string, number | string>

function bucketLabel(d: string, unit: string, long = false) {
  const dt = new Date(`${d}T12:00:00`)
  const s = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(long ? { weekday: unit === 'day' ? 'short' : undefined } : {}) })
  return unit === 'week' ? `${long ? 'Week of ' : ''}${s}` : s
}

/** True on phone-width screens - charts draw on a narrower canvas there so their labels stay readable. */
function usePhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(max-width: 639px)')
    const read = () => setPhone(m.matches)
    read()
    m.addEventListener('change', read)
    return () => m.removeEventListener('change', read)
  }, [])
  return phone
}

/** Up to 3 series over time, one axis, crosshair + tooltip on hover (and tap). */
export function TrendChart({ data, series, unit, height = 200 }: {
  data: Point[]; series: { key: string; label: string }[]; unit: string; height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  // Phones: a 360-wide canvas (not 720) so the axis text isn't shrunk to a few pixels.
  const phone = usePhone()
  const W = phone ? 360 : 720, H = phone ? Math.round(height * 0.8) : height, PL = 34, PR = 12, PT = 10, PB = 24
  const max = Math.max(1, ...data.flatMap(p => series.map(s => Number(p[s.key]) || 0)))
  const nice = (() => { const m = Math.pow(10, Math.floor(Math.log10(max))); return Math.ceil(max / m) * m })()
  const x = (i: number) => PL + (data.length <= 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (data.length - 1))
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / nice)
  const ticks = [0, nice / 2, nice]
  const every = Math.max(1, Math.ceil(data.length / (phone ? 4 : 7)))
  const total = (k: string) => data.reduce((a, p) => a + (Number(p[k]) || 0), 0)

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || !data.length) return
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - PL) / (W - PL - PR)) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }
  const hp = hover != null ? data[hover] : null
  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">
              <span className={`h-2 w-3 rounded-sm ${SERIES[i].bg}`} />{s.label} <span className="font-black text-[#111827] tabular-nums dark:text-white">{n0(total(s.key))}</span>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y select-none" role="img"
          aria-label={`${series.map(s => s.label).join(', ')} over time`}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="stroke-gray-100 dark:stroke-white/[0.06]" strokeWidth={1} />
              <text x={PL - 6} y={y(t) + 3} textAnchor="end" className="fill-gray-400 text-[10px] font-semibold dark:fill-gray-500">{n0(t)}</text>
            </g>
          ))}
          {data.map((p, i) => i % every === 0 && (
            <text key={p.d} x={x(i)} y={H - 6} textAnchor="middle" className="fill-gray-400 text-[10px] font-semibold dark:fill-gray-500">{bucketLabel(p.d, unit)}</text>
          ))}
          {series.map((s, si) => {
            const pts = data.map((p, i) => `${x(i)},${y(Number(p[s.key]) || 0)}`).join(' ')
            return (
              <g key={s.key}>
                {series.length === 1 && (
                  <polygon points={`${x(0)},${y(0)} ${pts} ${x(data.length - 1)},${y(0)}`} className={`${SERIES[si].fill} opacity-[0.08]`} />
                )}
                <polyline points={pts} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={SERIES[si].stroke} />
              </g>
            )
          })}
          {hp && hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} className="stroke-gray-300 dark:stroke-white/20" strokeWidth={1} strokeDasharray="3 3" />
              {series.map((s, si) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number(hp[s.key]) || 0)} r={4.5} strokeWidth={2} className={`${SERIES[si].fill} stroke-white dark:stroke-[#151517]`} />
              ))}
            </g>
          )}
        </svg>
        {hp && hover != null && (
          <div className="pointer-events-none absolute top-0 z-10 min-w-[140px] -translate-x-1/2 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-xl dark:border-gray-700 dark:bg-[#1f1f22]"
            style={{ left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%` }}>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{bucketLabel(hp.d, unit, true)}</p>
            {series.map((s, si) => (
              <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-300">
                <span className={`h-2 w-2 rounded-full ${SERIES[si].bg}`} />{s.label}
                <span className="ml-auto pl-3 font-black tabular-nums text-[#111827] dark:text-white">{n0(Number(hp[s.key]) || 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- bar lists

/** Ranked horizontal bars with the count (and share) written beside each - one hue, magnitude only. */
export function BarList({ items, empty = 'Nothing yet', valueText }: {
  items: { label: string; value: number; sub?: string }[]; empty?: string; valueText?: (v: number, total: number) => string
}) {
  const max = Math.max(1, ...items.map(i => i.value))
  const total = items.reduce((a, i) => a + i.value, 0)
  if (!items.length || !total) return <p className="py-6 text-center text-xs font-semibold text-gray-400">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {items.map(i => (
        <li key={i.label} title={`${i.label}: ${n0(i.value)}${total ? ` (${pctTxt(pctOf(i.value, total))})` : ''}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-bold text-gray-700 dark:text-gray-200">{i.label}{i.sub && <span className="ml-1.5 font-semibold text-gray-400">{i.sub}</span>}</span>
            <span className="shrink-0 font-black tabular-nums text-[#111827] dark:text-white">{valueText ? valueText(i.value, total) : `${n0(i.value)} · ${pctTxt(pctOf(i.value, total))}`}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.06]">
            <div className={`h-2 rounded-full ${SERIES[0].bg}`} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** A funnel: each step's bar is its share of the first step; the drop between steps is written out. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value || 0
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null
        return (
          <li key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-bold text-gray-700 dark:text-gray-200">{s.label}</span>
              <span className="font-black tabular-nums text-[#111827] dark:text-white">
                {n0(s.value)}
                {prev != null && <span className="ml-1.5 font-semibold text-gray-500 dark:text-gray-400">{prev ? `${pctTxt(pctOf(s.value, prev))} of the step before` : ''}</span>}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/[0.06]">
              <div className={`h-2.5 rounded-full ${SERIES[0].bg}`} style={{ width: `${first ? Math.max(1.5, Math.min(100, (s.value / first) * 100)) : 0}%` }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Count per slot (hours of the day, days of the week) as small columns, hover for the number. */
export function Columns({ values, labels, every = 1 }: { values: number[]; labels: string[]; every?: number }) {
  const max = Math.max(1, ...values)
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div>
      <div className="relative flex h-28 items-end gap-[2px]" onPointerLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
            <div className={`w-full rounded-t-[4px] ${SERIES[0].bg} ${hover != null && hover !== i ? 'opacity-40' : ''}`} style={{ height: `${v ? Math.max(4, (v / max) * 100) : 0}%` }} />
          </div>
        ))}
        {hover != null && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 rounded-lg bg-[#111827] px-2 py-1 text-[11px] font-bold text-white shadow dark:bg-white dark:text-[#111827]"
            style={{ left: `${((hover + 0.5) / values.length) * 100}%` }}>
            {labels[hover]}: {n0(values[hover])}
          </div>
        )}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {labels.map((l, i) => <span key={i} className="flex-1 text-center text-[9px] font-semibold text-gray-400">{i % every === 0 ? l : ''}</span>)}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- per-agent table

export type Col<R> = { key: string; label: string; value: (r: R) => number | string | null | undefined; render?: (r: R) => React.ReactNode; num?: boolean; hint?: string }

export function AgentTable<R extends { id: string; name: string; plan_tier?: string | null }>({ rows, cols, initialSort, empty = 'No agents yet', onOpen }: {
  rows: R[]; cols: Col<R>[]; initialSort?: string; empty?: string; onOpen?: (r: R) => void
}) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort || cols[0]?.key, dir: -1 })
  const [page, setPage] = useState(1)
  const [hideZero, setHideZero] = useState(false)
  const PAGE = 15
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const col = sort.key === "__name" ? { value: (r: R) => r.name } : cols.find(c => c.key === sort.key)
    const out = rows.filter(r => (!s || r.name.toLowerCase().includes(s)) && (!hideZero || cols.some(c => c.num && Number(c.value(r)) > 0)))
    if (col) out.sort((a, b) => {
      const va = col.value(a), vb = col.value(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * sort.dir
    })
    return out
  }, [rows, cols, q, sort, hideZero])
  const shown = list.slice((page - 1) * PAGE, page * PAGE)
  const flip = (key: string) => { setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 })); setPage(1) }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative flex-1 sm:max-w-xs max-sm:basis-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Find an agent" aria-label="Find an agent"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 max-sm:py-2.5 text-xs font-semibold text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0f0f10] dark:text-white" />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 max-sm:min-h-[40px]">
          <input type="checkbox" checked={hideZero} onChange={e => { setHideZero(e.target.checked); setPage(1) }} className="accent-[#C9A24D] max-sm:h-5 max-sm:w-5" /> Hide agents with nothing
        </label>
        <span className="ml-auto text-[11px] font-semibold text-gray-400">{list.length} agent{list.length === 1 ? '' : 's'}</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-gray-50/80 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
            <tr>
              <th className="px-3 py-2.5 font-black max-sm:sticky max-sm:left-0 max-sm:z-[1] max-sm:bg-[#f9fafb] dark:max-sm:bg-[#1a1a1c]">
                <button onClick={() => flip('__name')} className="font-black uppercase">Agent</button>
              </th>
              {cols.map(c => (
                <th key={c.key} className={`px-3 py-2.5 font-black ${c.num ? 'text-right' : ''}`} title={c.hint}>
                  <button onClick={() => flip(c.key)} className={`inline-flex items-center gap-1 font-black uppercase ${sort.key === c.key ? 'text-[#8b7355] dark:text-[#e8c97a]' : ''}`}>
                    {c.label}{sort.key === c.key && (sort.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {shown.map(r => (
              <tr key={r.id} className={`text-gray-700 dark:text-gray-200 ${onOpen ? 'cursor-pointer hover:bg-[#C9A24D]/[0.06]' : ''}`} onClick={onOpen ? () => onOpen(r) : undefined}>
                {/* Phones: the name column stays put while the numbers scroll sideways. */}
                <td className="px-3 py-2.5 max-sm:sticky max-sm:left-0 max-sm:z-[1] max-sm:min-w-[118px] max-sm:max-w-[140px] max-sm:bg-white max-sm:shadow-[1px_0_0_rgba(17,24,39,0.06)] dark:max-sm:bg-[#151517]">
                  <p className="font-black text-[#111827] dark:text-white">{r.name}</p>
                  <p className="text-[10px] font-semibold text-gray-400">{planName(r.plan_tier)}</p>
                </td>
                {cols.map(c => (
                  <td key={c.key} className={`whitespace-nowrap px-3 py-2.5 font-semibold ${c.num ? 'text-right tabular-nums' : ''}`}>
                    {c.render ? c.render(r) : (c.value(r) ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center font-semibold text-gray-400">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {list.length > PAGE && <div className="mt-3"><Pager page={page} pages={Math.ceil(list.length / PAGE)} onChange={setPage} /></div>}
    </div>
  )
}
