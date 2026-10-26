'use client'

// Admin "Recent failures" (user, 10/20: a CMA generation failed and nothing showed in admin).
// Every feature failure the backend already records - AI calls, CMA generations, AI Media, client
// emails, scheduled emails, broken mailbox / calendar connections - newest first: who, which
// feature, when, the code and the message. See backend admin_failures_service.py.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Cpu, Image as ImageIcon, Loader2, Mail, RefreshCw, Search, Calculator, ShieldCheck, Link2 } from 'lucide-react'
import api from '@/lib/api-service'
import type { AdminFailure, AdminFailuresResponse } from '@/types'

const SOURCE: Record<AdminFailure['source'], { label: string, icon: React.ComponentType<{ className?: string }> }> = {
  ai: { label: 'AI call', icon: Cpu },
  cma: { label: 'CMA', icon: Calculator },
  media: { label: 'AI Media', icon: ImageIcon },
  email: { label: 'Email', icon: Mail },
  connection: { label: 'Connection', icon: Link2 },
}

function when(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function RecentFailuresPanel() {
  const [days, setDays] = useState(14)
  const [includeLimits, setIncludeLimits] = useState(false)
  const [data, setData] = useState<AdminFailuresResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [feature, setFeature] = useState<string>('')
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await api.admin.getRecentFailures(days, includeLimits)
    if (r.success && r.data) setData(r.data)
    else setError(r.error || 'Could not load failures.')
    setLoading(false)
  }, [days, includeLimits])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.failures || []).filter(f =>
      (!feature || f.feature === feature)
      && (!q || [f.owner_name, f.owner_email, f.feature, f.code, f.message, f.ref].some(v => (v || '').toLowerCase().includes(q))))
  }, [data, query, feature])

  const features = useMemo(() => Object.entries(data?.by_feature || {}).sort((a, b) => b[1] - a[1]), [data])

  return (
    <div className="space-y-4">
      {/* The admin page's own tab header already says what this is - just the controls here. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold max-sm:min-h-[44px] max-sm:flex-1 dark:border-gray-700 dark:bg-[#151517] dark:text-white">
            {[1, 7, 14, 30, 90].map(d => <option key={d} value={d}>Last {d === 1 ? '24 hours' : `${d} days`}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 max-sm:min-h-[44px] max-sm:w-full max-sm:order-last dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
            <input type="checkbox" checked={includeLimits} onChange={e => setIncludeLimits(e.target.checked)} className="h-4 w-4 accent-[#C9A24D]" />
            Also show spending-limit blocks
          </label>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white max-sm:min-h-[44px] dark:bg-white dark:text-[#111827]">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* by feature */}
      {data && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFeature('')} className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors max-sm:py-2 ${!feature ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-gray-200 dark:bg-[#151517] dark:text-gray-300 dark:ring-gray-700'}`}>
            All · {data.errors} {data.errors === 1 ? 'error' : 'errors'}
          </button>
          {features.map(([name, n]) => (
            <button key={name} onClick={() => setFeature(f => (f === name ? '' : name))}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors max-sm:py-2 ${feature === name ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'}`}>
              {name} · {n}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search agent, feature, error…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /> Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-rose-600"><AlertTriangle className="h-5 w-5" /> {error}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-black text-gray-600 dark:text-gray-300">No failures {query || feature ? 'match' : `in the last ${days === 1 ? '24 hours' : `${days} days`}`}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((f, i) => {
              const S = SOURCE[f.source] || SOURCE.ai
              const isOpen = open === i
              return (
                <li key={`${f.at}-${i}`}>
                  <button onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${f.kind === 'limit' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                      <S.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-sm font-black text-[#111827] dark:text-white">{f.feature}</p>
                        {f.code && <code className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${f.kind === 'limit' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'}`}>{f.code}</code>}
                        {f.kind === 'limit' && <span className="text-[10px] font-black uppercase tracking-wide text-amber-600">limit, not an error</span>}
                      </div>
                      <p className={`mt-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300 ${isOpen ? 'whitespace-pre-wrap break-words' : 'line-clamp-1'}`}>{f.message || 'No message recorded.'}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-bold text-gray-400">
                        <span className="min-w-0 break-all">{f.owner_name || 'Unknown agent'}{f.owner_email && f.owner_email !== f.owner_name ? ` · ${f.owner_email}` : ''}</span>
                        {f.ref && <span className="min-w-0 break-all">· {f.ref}</span>}
                      </p>
                      {/* Phones: the time sits under the details, so the title gets the full width. */}
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-gray-400 sm:hidden"><CalendarClock className="h-3.5 w-3.5" /> {when(f.at)}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-gray-400 max-sm:hidden" title={f.at ? new Date(f.at).toLocaleString() : undefined}>
                      <CalendarClock className="h-3.5 w-3.5" /> {when(f.at)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
