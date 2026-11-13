'use client'

// Every paid provider's month so far against its free monthly allowance or our own monthly cap
// (owner 11/13: "tracking ... how much is gone ... alerts about these limits getting close ... with
// all providers"). Backend: GET /admin/ai/provider-limits (provider_limits_service.py), which also
// sends the admin one bell per row at 80% and 95% each month.
import { useEffect, useState } from 'react'
import { Gauge, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-service'

type LimitRow = {
  key: string; provider: string; label: string; used: number; limit: number | null; unit: string
  percent: number | null; note: string; spend_usd: number | null; kind: 'free' | 'cap' | 'spend'
}

const fmt = (v: number, unit: string) =>
  unit === 'usd' ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${Math.round(v).toLocaleString()}${unit ? ` ${unit}` : ''}`

const barColor = (p: number) => (p >= 95 ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : 'bg-emerald-500')

export default function ProviderLimitsCard() {
  const [rows, setRows] = useState<LimitRow[] | null>(null)
  const [month, setMonth] = useState('')
  useEffect(() => {
    const load = () => api.admin.getProviderLimits().then(({ success, data }) => {
      if (success && data) { setRows(data.rows as LimitRow[]); setMonth(data.month) }
    })
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!rows) {
    return (
      <div className="mb-6 flex items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 dark:border-gray-800 dark:bg-[#151517]">
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" />
      </div>
    )
  }
  const limited = rows.filter(r => r.limit).sort((a, b) => (b.percent || 0) - (a.percent || 0))
  const spend = rows.filter(r => r.kind === 'spend')
  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <div className="mb-1 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-[#C9A24D]" />
        <p className="text-sm font-black text-[#111827] dark:text-white">Free allowances &amp; limits this month</p>
        {month && <span className="ml-auto whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-gray-400">{month}</span>}
      </div>
      <p className="mb-4 text-xs font-semibold text-[#6B7280] dark:text-gray-400">
        How much of each provider&apos;s free monthly allowance (or our own monthly cap) is gone. You get a bell at 80% and again at 95%.
      </p>
      <div className="space-y-3.5">
        {limited.map(r => {
          const p = Math.min(100, r.percent || 0)
          return (
            <div key={r.key}>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <p className="text-xs font-black text-[#111827] dark:text-white">{r.label}</p>
                <p className={`text-[11px] font-black sm:shrink-0 ${p >= 95 ? 'text-red-600' : p >= 80 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {fmt(r.used, r.unit)} of {fmt(r.limit || 0, r.unit)} · {(r.percent || 0).toFixed(r.percent && r.percent < 10 ? 1 : 0)}%
                </p>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className={`h-full rounded-full ${barColor(p)}`} style={{ width: `${Math.max(p, 0.6)}%` }} />
              </div>
              {r.note && <p className="mt-1 text-[10.5px] font-semibold text-gray-400">{r.note}</p>}
            </div>
          )
        })}
        {rows.filter(r => !r.limit && r.kind !== 'spend').map(r => (
          <div key={r.key} className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-black text-[#111827] dark:text-white">{r.label}</p>
              {r.note && <p className="text-[10.5px] font-semibold text-gray-400">{r.note}</p>}
            </div>
            <p className="shrink-0 text-[11px] font-black text-gray-500">{fmt(r.used, r.unit)}</p>
          </div>
        ))}
      </div>
      {spend.length > 0 && (
        <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Spent this month by provider</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {spend.map(r => (
              <div key={r.key} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{r.provider}</p>
                <p className="text-sm font-black text-[#111827] dark:text-white">{fmt(r.spend_usd || 0, 'usd')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
