'use client'

import { useState } from 'react'
import { Search, Loader2, ShieldAlert, AlertTriangle, Check, User, Home } from 'lucide-react'
import api from '@/lib/api-service'
import { CmaReport } from '@/types'
import { formatMoney } from '@/lib/cma'

type LookupResult = CmaReport & { owner_name?: string | null; owner_email?: string | null }

function StatusBadge({ status }: { status: 'Blocked' | 'Warning' | 'Passed' }) {
  const cls = status === 'Blocked'
    ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
    : status === 'Warning'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
  const Icon = status === 'Blocked' ? ShieldAlert : status === 'Warning' ? AlertTriangle : Check
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {status}
    </span>
  )
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700 dark:bg-black/40 dark:text-gray-300">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

// Admin-only diagnostic: pull up the exact CMA report an agent's support ticket references, by
// the short code shown at the bottom of that agent's Summary step (see cmaSupportCode in
// lib/cma.ts). Surfaces exactly the two sections intentionally hidden from the agent's own view -
// the QA/review result and the "how this value was calculated" trace - so support can actually
// diagnose a reported problem instead of guessing which report and what went wrong.
export default function CmaLookupPanel() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<LookupResult | null>(null)

  const handleLookup = async () => {
    if (!code.trim() || loading) return
    setLoading(true)
    setError(null)
    setReport(null)
    const { success, data, error: err } = await api.admin.lookupCmaReportByCode(code.trim())
    setLoading(false)
    if (success && data) setReport(data)
    else setError(err || 'No CMA report matches that code.')
  }

  const estimate = report?.pricing?.ai_estimate as Record<string, any> | undefined
  const qa = estimate?.qa_result
  const blockers: string[] = Array.from(new Set([...(estimate?.qa_blocking || []), ...(qa?.blocking_errors || [])].filter(Boolean)))
  const warnings: string[] = (qa?.warnings || []).filter(Boolean)
  const status: 'Blocked' | 'Warning' | 'Passed' = blockers.length > 0 ? 'Blocked' : warnings.length > 0 ? 'Warning' : 'Passed'

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
        <h2 className="font-serif text-lg font-black text-[#111827] dark:text-white">CMA Support Lookup</h2>
        <p className="mt-0.5 text-xs font-semibold text-gray-400">
          Paste the code an agent read off their report (e.g. from a support ticket) to pull up its QA review and valuation trace.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            placeholder="e.g. 1278-465E-029D"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-bold tracking-wide outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
          />
          <button
            onClick={handleLookup}
            disabled={!code.trim() || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Look Up
          </button>
        </div>
        {error && <p className="mt-3 text-sm font-bold text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {report && (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400"><Home className="h-3 w-3" /> Subject</p>
                <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{report.subject?.street_address || 'No address'}</p>
                <p className="text-xs font-semibold text-gray-400">{report.mode} · {report.status}</p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400"><User className="h-3 w-3" /> Agent</p>
                <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{report.owner_name || '—'}</p>
                <p className="text-xs font-semibold text-gray-400">{report.owner_email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Fair Value</p>
                <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">
                  {formatMoney(estimate?.final_valuation?.value ?? estimate?.value)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-serif text-base font-black text-[#111827] dark:text-white">QA / Review</h3>
              <StatusBadge status={status} />
            </div>
            {blockers.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-black text-red-600 dark:text-red-400">Blocking</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-red-700 dark:text-red-400">
                  {blockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-black text-amber-600 dark:text-amber-400">Warnings</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-400">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer select-none text-xs font-black text-gray-500 dark:text-gray-400">Full qa_result</summary>
              <JsonBlock data={qa} />
            </details>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
            <h3 className="font-serif text-base font-black text-[#111827] dark:text-white">How This Value Was Calculated</h3>
            <p className="mt-0.5 text-xs font-semibold text-gray-400">Full valuation_trace - anchor, weights, adjustments, reasoning model output.</p>
            <JsonBlock data={estimate?.valuation_trace} />
          </div>
        </>
      )}
    </div>
  )
}
