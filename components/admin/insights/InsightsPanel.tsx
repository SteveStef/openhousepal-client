'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import api from '@/lib/api-service'
import { EmailsPage, GuestsPage, ShowcasesPage, SigninsPage, SummaryPage, ToolsPage } from './pages'

// One Insights page: the period picker, then that page's numbers (admin_insights_service).
const PERIODS = [
  { days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' },
  { days: 365, label: '12 months' }, { days: 0, label: 'All time' },
]
const STORE = 'ohp_admin_insights_days'

function savedDays(): number {
  if (typeof window === 'undefined') return 30
  try {
    const v = Number(localStorage.getItem(STORE))
    return PERIODS.some(p => p.days === v) && localStorage.getItem(STORE) !== null ? v : 30
  } catch {
    return 30
  }
}

export default function InsightsPanel({ page, title, blurb, onGo }: { page: string; title: string; blurb: string; onGo: (tab: string) => void }) {
  const [days, setDays] = useState<number>(savedDays)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Only the newest request counts - switching period or page quickly must never leave an older
  // answer on screen (or the page waiting for one that will never match).
  const latest = useRef(0)
  const load = useCallback(() => {
    const ticket = ++latest.current
    setLoading(true)
    setError(null)
    api.admin.getInsights(page, days).then(r => {
      if (ticket !== latest.current) return
      if (r.success && r.data) setData({ page, ...r.data })
      else setError(r.error || "Couldn't load these numbers")
      setLoading(false)
    })
  }, [page, days])
  useEffect(load, [load])

  const pick = (d: number) => {
    setDays(d)
    try { localStorage.setItem(STORE, String(d)) } catch { /* per-browser nicety only */ }
  }
  const ready = data && data.page === page && data.days === days
  const label = PERIODS.find(p => p.days === days)?.label || ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black leading-tight text-[#111827] dark:text-white">{title}</h2>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{blurb}</p>
        </div>
        <div className="flex items-center gap-2 max-sm:w-full">
          <div role="radiogroup" aria-label="Time period" className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-gray-200 dark:bg-[#151517] dark:ring-white/10 max-sm:min-w-0 max-sm:flex-1">
            {PERIODS.map(p => (
              <button key={p.days} role="radio" aria-checked={days === p.days} onClick={() => pick(p.days)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black transition sm:px-3 max-sm:flex-1 max-sm:whitespace-nowrap max-sm:px-1 max-sm:py-2.5 ${days === p.days ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} aria-label="Refresh" title="Refresh"
            className="rounded-xl bg-white p-2 max-sm:p-3 text-gray-500 shadow-sm ring-1 ring-gray-200 hover:text-[#111827] dark:bg-[#151517] dark:text-gray-400 dark:ring-white/10 dark:hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {!ready && !error && (
        <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Adding it up…</div>
      )}
      {ready && (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {page === 'summary' && <SummaryPage d={data} period={label} onGo={onGo} />}
          {page === 'signins' && <SigninsPage d={data} period={label} />}
          {page === 'showcases' && <ShowcasesPage d={data} period={label} />}
          {page === 'emails' && <EmailsPage d={data} period={label} />}
          {page === 'tools' && <ToolsPage d={data} period={label} onGo={onGo} />}
          {page === 'guests' && <GuestsPage d={data} period={label} />}
        </div>
      )}
    </div>
  )
}
