'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Play, Square, RotateCcw, Trash2, Download, Target, ShieldCheck, ShieldAlert, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react'
import api from '@/lib/api-service'
import { formatMoney } from '@/lib/cma'

// Admin-only CMA accuracy test: real past sales re-run through the normal agent CMA flow as of the
// day before each went under contract (backend: cma_backtest_service + cma_time_machine), scored
// against the real sale price. Test reports never show to agents or clients.

type Stats = {
  n: number; median_abs_error_pct?: number; mean_error_pct?: number; within_5_pct?: number; within_10_pct?: number
  range_hit_pct?: number; asking_price_median_abs_error_pct?: number | null; asking_price_within_5_pct?: number | null
}

const card = 'rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#151517]'
const label = 'text-[10px] font-black uppercase tracking-widest text-gray-400'
const input = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-[#C9A24D] dark:border-white/10 dark:bg-[#0B0B0B] dark:text-white'
const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-40'

function pct(v?: number | null, signed = false) {
  if (v === null || v === undefined) return '-'
  return `${signed && v > 0 ? '+' : ''}${v}%`
}

function errColor(v?: number | null) {
  if (v === null || v === undefined) return 'text-gray-400'
  const a = Math.abs(v)
  return a <= 5 ? 'text-emerald-600 dark:text-emerald-400' : a <= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
}

function StatTile({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3 dark:border-white/10">
      <p className={label}>{title}</p>
      <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-[11px] font-semibold text-gray-400">{sub}</p>}
    </div>
  )
}

function Scoreboard({ s }: { s: Stats }) {
  if (!s || !s.n) return <p className="text-sm font-semibold text-gray-400">No finished homes yet.</p>
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <StatTile title="Median miss" value={pct(s.median_abs_error_pct)} sub={`avg ${pct(s.mean_error_pct, true)} (low/high bias)`} />
      <StatTile title="Within 5%" value={pct(s.within_5_pct)} sub={`${s.n} homes`} />
      <StatTile title="Within 10%" value={pct(s.within_10_pct)} />
      <StatTile title="Range caught the sale" value={pct(s.range_hit_pct)} />
      <StatTile title="Just guessing the asking price" value={pct(s.asking_price_median_abs_error_pct)} sub={`within 5%: ${pct(s.asking_price_within_5_pct)}`} />
    </div>
  )
}

function SegmentTable({ title, rows }: { title: string; rows: Record<string, Stats> }) {
  const entries = Object.entries(rows || {})
  if (!entries.length) return null
  return (
    <div>
      <p className={`${label} mb-1`}>{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="text-gray-400"><th className="py-1 pr-3">Segment</th><th className="pr-3">Homes</th><th className="pr-3">Median miss</th><th className="pr-3">Within 10%</th><th className="pr-3">Range caught</th><th>Asking-price miss</th></tr></thead>
          <tbody>
            {entries.map(([k, s]) => (
              <tr key={k} className="border-t border-gray-100 font-semibold text-gray-700 dark:border-white/5 dark:text-gray-300">
                <td className="py-1 pr-3">{k}</td><td className="pr-3">{s.n}</td>
                <td className={`pr-3 font-black ${errColor(s.median_abs_error_pct)}`}>{pct(s.median_abs_error_pct)}</td>
                <td className="pr-3">{pct(s.within_10_pct)}</td><td className="pr-3">{pct(s.range_hit_pct)}</td>
                <td>{pct(s.asking_price_median_abs_error_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HomeRow({ it }: { it: any }) {
  const [open, setOpen] = useState(false)
  const leak = it.status === 'leak' || (it.leak_log && it.leak_log.length)
  const checks = (it.leak_checks || []).length
  const findings = it.audit_findings || []
  return (
    <>
      <tr className="border-t border-gray-100 align-top text-xs font-semibold text-gray-700 dark:border-white/5 dark:text-gray-300">
        <td className="py-2 pr-2">
          <button onClick={() => setOpen(o => !o)} className="inline-flex items-start gap-1 text-left font-black text-gray-900 dark:text-white">
            {open ? <ChevronDown className="mt-0.5 h-3 w-3" /> : <ChevronRight className="mt-0.5 h-3 w-3" />}
            <span>{it.address}<span className="block text-[10px] font-semibold text-gray-400">{it.city} - {it.segment?.type} - {it.segment?.price_band}</span></span>
          </button>
        </td>
        <td className="pr-2">{it.as_of}<span className="block text-[10px] text-gray-400">{it.dom_as_of ?? '-'} days listed</span></td>
        <td className="pr-2">{formatMoney(it.list_price)}</td>
        <td className="pr-2 font-black">{formatMoney(it.close_price)}<span className="block text-[10px] font-semibold text-gray-400">{it.close_date}</span></td>
        <td className="pr-2">{it.value ? formatMoney(it.value) : '-'}<span className="block text-[10px] text-gray-400">{it.range_min ? `${formatMoney(it.range_min)}-${formatMoney(it.range_max)}` : ''}</span></td>
        <td className={`pr-2 font-black ${errColor(it.error_pct)}`}>{pct(it.error_pct, true)}</td>
        <td className="pr-2">{it.value ? (it.in_range ? 'Yes' : 'No') : '-'}</td>
        <td className={`pr-2 ${errColor(it.list_error_pct)}`}>{pct(it.list_error_pct, true)}</td>
        <td className="pr-2">
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${it.status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : leak || it.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-white/5'}`}>
            {leak ? 'leak' : it.status}
          </span>
          {it.status === 'done' && <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-400">{leak ? <ShieldAlert className="h-3 w-3 text-red-500" /> : <ShieldCheck className="h-3 w-3 text-emerald-500" />}{checks} leak checks</span>}
        </td>
        <td>{it.report_id ? <a href={`/studio/cma/${it.report_id}`} target="_blank" rel="noreferrer" className="font-black text-[#8b7355] underline dark:text-[#d7b974]">Open</a> : '-'}
          <span className="block text-[10px] text-gray-400">{it.cost_usd ? `$${Number(it.cost_usd).toFixed(2)}` : ''}</span></td>
      </tr>
      {open && (
        <tr><td colSpan={10} className="pb-3">
          <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-[11px] text-gray-600 dark:bg-black/30 dark:text-gray-300">
            <p><b>As-of date:</b> {it.as_of} - {it.as_of_source}. <b>Lookup:</b> {it.lookup_note || '-'}</p>
            {it.remarks_removed?.length > 0 && <p><b>Removed from the listing remarks (written after the deal):</b> {it.remarks_removed.join(' | ')}</p>}
            {it.error && <p className="text-red-600"><b>Error:</b> {it.error}</p>}
            {it.leak_log?.length > 0 && <p className="text-red-600"><b>Leak log:</b> {it.leak_log.join(' | ')}</p>}
            {it.comps?.length > 0 && <p><b>Comps the wizard picked:</b> {it.comps.map((c: any) => `${c.address} (${formatMoney(c.sale_price)}, ${c.close_date}, ${c.match}%)`).join('; ')}</p>}
            {it.search?.search_steps && <p><b>Search:</b> {it.search.search_steps.map((s: any) => `${s.radius_mi} mi / ${s.sold_within_days} d: ${s.results} found, ${s.usable_70} usable 70%+`).join(' -> ')}</p>}
            {it.ai_steps && <p><b>AI steps run:</b> {it.ai_steps.join(', ')} - {it.images_sent ?? 0} photos/maps sent</p>}
            <p><b>Free text checks:</b> {findings.length === 0 ? 'nothing flagged' : `${findings.length} to review`}</p>
            {findings.length > 0 && (
              <ul className="list-disc pl-4">
                {findings.map((f: any, i: number) => <li key={i}><span className={f.severity === 'leak' ? 'font-black text-red-600' : 'font-black'}>{f.section}:</span> {f.message} <span className="text-gray-400">"{f.excerpt}"</span></li>)}
              </ul>
            )}
          </div>
        </td></tr>
      )}
    </>
  )
}

export default function CmaBacktestPanel() {
  const [opts, setOpts] = useState<any>(null)
  const [towns, setTowns] = useState<string[]>([])
  const [townQuery, setTownQuery] = useState('')
  const [randomSpread, setRandomSpread] = useState(false)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [ptype, setPtype] = useState('single_family')
  const [count, setCount] = useState(10)
  const [mode, setMode] = useState('buyer')
  const [cap, setCap] = useState(20)
  const [dryRun, setDryRun] = useState(true)
  const [preview, setPreview] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batches, setBatches] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)

  const loadBatches = useCallback(async () => {
    const r = await api.admin.cmaBacktestBatches()
    if (r.success && r.data) setBatches(r.data)
  }, [])

  useEffect(() => {
    api.admin.cmaBacktestOptions().then(r => { if (r.success) setOpts(r.data) })
    loadBatches()
  }, [loadBatches])

  // Live refresh while a test is working.
  useEffect(() => {
    if (!active || !['queued', 'running'].includes(active.status)) return
    const t = setInterval(async () => {
      const r = await api.admin.cmaBacktestBatch(active.id)
      if (r.success && r.data) setActive(r.data)
      loadBatches()
    }, 6000)
    return () => clearInterval(t)
  }, [active, loadBatches])

  const settings = () => ({
    towns, random_spread: randomSpread, price_min: priceMin ? Number(priceMin) : null, price_max: priceMax ? Number(priceMax) : null,
    property_type: ptype, count, mode, cost_cap_usd: cap, dry_run: dryRun,
  })

  const doPreview = async () => {
    setBusy(true); setError(null)
    const r = await api.admin.cmaBacktestPreview(settings())
    setBusy(false)
    if (r.success) setPreview(r.data); else setError(r.error || 'Preview failed')
  }

  const doStart = async () => {
    if (!preview?.homes?.length) return
    const msg = dryRun
      ? `Run a DRY RUN on ${preview.homes.length} homes? No AI is called (zero cost) - it proves the flow and the no-leak checks only.`
      : `Run the real test on ${preview.homes.length} homes?\n\nEstimated AI cost: about $${preview.estimated_cost_usd.toFixed(2)} (cap $${cap.toFixed(2)}), charged to ${opts?.charged_to?.email}.`
    if (!window.confirm(msg)) return
    setBusy(true); setError(null)
    const r = await api.admin.cmaBacktestStart({ ...settings(), listing_keys: preview.homes.map((h: any) => h.listing_key) })
    setBusy(false)
    if (r.success) { setActive(r.data); setPreview(null); loadBatches() } else setError(r.error || 'Could not start')
  }

  const open = async (id: string) => {
    const r = await api.admin.cmaBacktestBatch(id)
    if (r.success) setActive(r.data)
  }

  const act = async (fn: () => Promise<any>) => { const r = await fn(); if (r?.success && r.data) setActive(r.data); loadBatches() }

  const downloadReview = async (id: string) => {
    const r = await api.admin.cmaBacktestReview(id)
    if (!r.success) return setError(r.error || 'Download failed')
    const blob = new Blob([JSON.stringify(r.data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cma-accuracy-test-${id.slice(0, 8)}.json`; a.click()
  }

  const townList = useMemo(() => (opts?.towns || []).filter((t: any) => !townQuery || t.town.toLowerCase().includes(townQuery.toLowerCase())).slice(0, 40), [opts, townQuery])

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 h-5 w-5 text-[#C9A24D]" />
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">CMA accuracy test</h2>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Picks homes that really sold, sets the clock back to the day before each went under contract, and makes the CMA exactly the way an agent would
              (address lookup, automatic comps, the full AI report with photos, QA). Then it compares our value to the real sale price.
              The home&apos;s own sale, later sales and later listing changes are hidden, and every AI input is checked for leaks. Test reports never show to agents or clients.
            </p>
          </div>
        </div>
      </div>

      <div className={card}>
        <p className={`${label} mb-3`}>Set up a test</p>
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <p className={label}>Towns {towns.length > 0 && <span className="text-[#8b7355]">({towns.length} picked)</span>}</p>
            <input className={`${input} mt-1`} placeholder="Search towns..." value={townQuery} onChange={e => setTownQuery(e.target.value)} disabled={randomSpread} />
            <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
              {townList.map((t: any) => {
                const on = towns.includes(t.town)
                return (
                  <button key={t.town} disabled={randomSpread} onClick={() => setTowns(v => on ? v.filter(x => x !== t.town) : [...v, t.town])}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300'} disabled:opacity-40`}>
                    {t.town} <span className="opacity-60">{t.closed_sales}</span>
                  </button>
                )
              })}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={randomSpread} onChange={e => setRandomSpread(e.target.checked)} /> Random spread across all towns
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><p className={label}>Sold price from</p><input className={input} inputMode="numeric" placeholder="Any" value={priceMin} onChange={e => setPriceMin(e.target.value.replace(/\D/g, ''))} /></div>
            <div><p className={label}>Sold price to</p><input className={input} inputMode="numeric" placeholder="Any" value={priceMax} onChange={e => setPriceMax(e.target.value.replace(/\D/g, ''))} /></div>
            <div><p className={label}>Property type</p>
              <select className={input} value={ptype} onChange={e => setPtype(e.target.value)}>
                {(opts?.property_types || []).map((p: any) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select></div>
            <div><p className={label}>How many homes</p><input className={input} type="number" min={1} max={opts?.max_homes || 50} value={count} onChange={e => setCount(Math.max(1, Math.min(opts?.max_homes || 50, Number(e.target.value) || 1)))} /></div>
            <div><p className={label}>Report type</p>
              <select className={input} value={mode} onChange={e => setMode(e.target.value)}>
                <option value="buyer">Buyer (offer on the active listing)</option>
                <option value="listing">Seller (pricing the active listing)</option>
              </select></div>
            <div><p className={label}>Cost cap ($)</p><input className={input} type="number" min={1} value={cap} onChange={e => setCap(Number(e.target.value) || 20)} /></div>
            <label className="col-span-2 flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
              Dry run - no AI is called ($0). Proves the flow, comp picks and the no-leak checks; the values are placeholders, not a valuation.
            </label>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={doPreview} disabled={busy || (!randomSpread && towns.length === 0)} className={`${btn} bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-white`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />} Preview homes
          </button>
          {opts?.cost && <span className="text-[11px] font-semibold text-gray-400">
            A full report costs about ${opts.cost.average_per_report_usd.toFixed(2)} (photos + AI analysis + final valuation, from the last {opts.cost.based_on_reports} real reports).
            Charged to {opts.charged_to?.email}.
          </span>}
        </div>
        {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
        {preview && (
          <div className="mt-3 rounded-xl border border-gray-100 p-3 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-gray-900 dark:text-white">
                {preview.homes.length} homes - estimated cost {dryRun ? '$0 (dry run)' : `$${preview.estimated_cost_usd.toFixed(2)}`}
                {!dryRun && !preview.within_cap && <span className="ml-2 text-red-600">over the ${cap} cap</span>}
              </p>
              <button onClick={doStart} disabled={busy || !preview.homes.length || (!dryRun && !preview.within_cap)} className={`${btn} bg-[#C9A24D] text-white`}>
                <Play className="h-3.5 w-3.5" /> {dryRun ? 'Run dry run' : 'Run test'}
              </button>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="text-gray-400"><th className="py-1 pr-2">Home</th><th className="pr-2">Type</th><th className="pr-2">Listed at</th><th className="pr-2">Sold</th><th className="pr-2">Test date (as of)</th><th>Why that date</th></tr></thead>
                <tbody>{preview.homes.map((h: any) => (
                  <tr key={h.listing_key} className="border-t border-gray-100 font-semibold text-gray-700 dark:border-white/5 dark:text-gray-300">
                    <td className="py-1 pr-2">{h.address}, {h.city}</td><td className="pr-2">{h.segment?.type}</td><td className="pr-2">{formatMoney(h.list_price)}</td>
                    <td className="pr-2">{formatMoney(h.close_price)} <span className="text-gray-400">{h.close_date}</span></td><td className="pr-2">{h.as_of}</td>
                    <td className="text-[10px] text-gray-400">{h.as_of_source}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className={card}>
        <div className="mb-2 flex items-center justify-between">
          <p className={label}>Tests</p>
          <button onClick={async () => { if (window.confirm('Delete every accuracy-test CMA report? The scoreboards stay.')) { const r = await api.admin.cmaBacktestDeleteAllReports(); if (r.success) window.alert(`Deleted ${r.data?.deleted} test reports.`) } }}
            className={`${btn} text-red-600`}><Trash2 className="h-3.5 w-3.5" /> Delete all test reports</button>
        </div>
        {batches.length === 0 ? <p className="text-sm font-semibold text-gray-400">No tests yet.</p> : (
          <div className="space-y-1">
            {batches.map(b => (
              <button key={b.id} onClick={() => open(b.id)} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ${active?.id === b.id ? 'bg-[#C9A24D]/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                <span className="font-black text-gray-900 dark:text-white">{new Date(b.created_at).toLocaleString()} {b.settings?.dry_run ? <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500 dark:bg-white/10">DRY RUN</span> : null}</span>
                <span className="text-gray-500">{b.status} - {b.counts.done}/{Object.values(b.counts as Record<string, number>).reduce((a, c) => a + c, 0)} done
                  {b.summary?.overall?.n ? ` - median miss ${b.summary.overall.median_abs_error_pct}%` : ''} - ${Number(b.actual_cost_usd || 0).toFixed(2)} of ${Number(b.estimated_cost_usd || 0).toFixed(2)} est.</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {active && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">Test {active.id.slice(0, 8)} {active.settings?.dry_run ? '(dry run - placeholder values)' : ''}</p>
              <p className="text-[11px] font-semibold text-gray-400">{active.status}{active.error ? ` - ${active.error}` : ''} - spent ${Number(active.actual_cost_usd || 0).toFixed(2)} (estimate ${Number(active.estimated_cost_usd || 0).toFixed(2)}, cap ${active.settings?.cost_cap_usd})</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {['queued', 'running'].includes(active.status) && <button onClick={() => act(() => api.admin.cmaBacktestStop(active.id))} className={`${btn} bg-gray-100 dark:bg-white/10`}><Square className="h-3.5 w-3.5" /> Stop</button>}
              {['stopped'].includes(active.status) && <button onClick={() => act(() => api.admin.cmaBacktestResume(active.id))} className={`${btn} bg-gray-100 dark:bg-white/10`}><RotateCcw className="h-3.5 w-3.5" /> Resume</button>}
              <button onClick={() => downloadReview(active.id)} className={`${btn} bg-gray-100 dark:bg-white/10`}><Download className="h-3.5 w-3.5" /> Review file</button>
              <button onClick={async () => { if (window.confirm('Delete this test and its reports?')) { await api.admin.cmaBacktestDelete(active.id); setActive(null); loadBatches() } }} className={`${btn} text-red-600`}><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            </div>
          </div>
          <div className="mt-3"><Scoreboard s={active.summary?.overall} /></div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <SegmentTable title="By town" rows={active.summary?.by_segment?.town} />
            <SegmentTable title="By price" rows={active.summary?.by_segment?.price_band} />
            <SegmentTable title="By type" rows={active.summary?.by_segment?.type} />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className={label}><th className="py-1 pr-2">Home</th><th className="pr-2">As of</th><th className="pr-2">Asking</th><th className="pr-2">Sold for</th><th className="pr-2">Our value</th><th className="pr-2">Miss</th><th className="pr-2">Range caught</th><th className="pr-2">Asking miss</th><th className="pr-2">Status</th><th>Report</th></tr></thead>
              <tbody>{(active.items || []).map((it: any) => <HomeRow key={it.listing_key} it={it} />)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
