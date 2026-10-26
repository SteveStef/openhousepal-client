'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, HardDrive, X, Loader2, Database } from 'lucide-react'
import api from '@/lib/api-service'
import { AdminStorageAgentSummary, AdminStorageAgentDetail, AdminStorageMonthlyPoint } from '@/types'

function formatBytes(n: number): string {
  if (n <= 0) return '0 MB'
  const gb = n / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`
  const mb = n / (1024 * 1024)
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function CATEGORY_LABEL(cat: string): string {
  const map: Record<string, string> = {
    ai_media_image: 'Media Lab - Images', ai_media_video: 'Media Lab - Video', ai_media_upload: 'Media Lab - Uploads',
    design: 'Studio', blog: 'Blog Posts', brand_logo: 'Brand Logos',
    listing_photo: 'Listing Photos', agent_photo: 'Agent Headshots', agent_sale_photo: 'Agent Sale Photos',
  }
  return map[cat] || cat
}

function capBarColor(used: number, cap: number): string {
  if (!cap) return 'bg-gray-300 dark:bg-gray-700'
  const pct = used / cap
  if (pct >= 0.9) return 'bg-red-500'
  if (pct >= 0.6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function MonthlyBytesBars({ points }: { points: AdminStorageMonthlyPoint[] }) {
  if (points.length === 0) return <p className="text-xs text-gray-400 dark:text-zinc-500">No upload history yet.</p>
  const max = Math.max(...points.map((p) => p.bytes_added), 1)
  return (
    <div className="flex items-end gap-1.5 h-20">
      {points.map((p) => (
        <div key={p.month} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
          <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-t-sm overflow-hidden flex items-end h-14">
            <div className="w-full bg-[#C9A24D] rounded-t-sm transition-all" style={{ height: `${Math.max(4, (p.bytes_added / max) * 100)}%` }} />
          </div>
          <span className="text-[8px] font-bold text-gray-400 dark:text-zinc-500">{formatMonthLabel(p.month)}</span>
          <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-[#111827] text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap z-10">
            {formatBytes(p.bytes_added)} added
          </div>
        </div>
      ))}
    </div>
  )
}

const LIVE_REFRESH_MS = 30_000

export default function AgentStorageUsagePanel() {
  const [agents, setAgents] = useState<AdminStorageAgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AdminStorageAgentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = () => api.admin.getStorageAgents().then((res) => { if (res.success && res.data) setAgents(res.data) })

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [])

  // Storage doesn't change nearly as fast as AI cost, but still moves as agents upload/delete -
  // poll quietly in the background like the AI Usage tab does, no spinner after the first load.
  useEffect(() => {
    const id = setInterval(load, LIVE_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const totalUsed = useMemo(() => agents.reduce((sum, a) => sum + a.used_bytes, 0), [agents])
  const nearCap = useMemo(() => agents.filter((a) => a.cap_bytes > 0 && a.used_bytes / a.cap_bytes >= 0.9), [agents])

  const openDetail = async (ownerId: string) => {
    setDetailLoading(true)
    const res = await api.admin.getStorageAgentDetail(ownerId)
    if (res.success && res.data) setDetail(res.data)
    setDetailLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A24D]" />
      </div>
    )
  }

  return (
    <div>
      {nearCap.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-900/10">
          <HardDrive className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-black text-amber-700 dark:text-amber-400">Agents near their storage cap</p>
            {nearCap.map((a) => (
              <p key={a.owner_id} className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                {a.name}: {formatBytes(a.used_bytes)} / {formatBytes(a.cap_bytes)}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        Live - updates every {LIVE_REFRESH_MS / 1000}s
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-[#151517] px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col border-l-4 border-l-[#C9A24D]">
          <div className="flex items-center gap-1.5 mb-1 text-[#6B7280] dark:text-gray-500">
            <Database className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Total Stored (All Agents)</span>
          </div>
          <span className="text-2xl font-black leading-tight text-[#C9A24D]">{formatBytes(totalUsed)}</span>
        </div>
        <div className="bg-white dark:bg-[#151517] px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 mb-1 text-[#6B7280] dark:text-gray-500">
            <HardDrive className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Agents With Files</span>
          </div>
          <span className="text-2xl font-black leading-tight text-[#111827] dark:text-white">{agents.length}</span>
        </div>
        <div className="bg-white dark:bg-[#151517] px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
          <div className="flex items-center gap-1.5 mb-1 text-[#6B7280] dark:text-gray-500">
            <HardDrive className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">Near Cap (90%+)</span>
          </div>
          <span className="text-2xl font-black leading-tight text-amber-500">{nearCap.length}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#151517] rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#151517] via-[#C9A24D] to-[#151517]" />
        <div className="px-8 py-5 border-b border-gray-100 dark:border-gray-800 max-sm:px-5">
          <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Storage Leaderboard — Who's Using The Most</p>
        </div>
        {/* Phones: one card per agent instead of the table. */}
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
          {agents.length === 0 && <li className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">No stored media recorded yet.</li>}
          {agents.map((a) => {
            const pct = a.cap_bytes > 0 ? Math.min(100, (a.used_bytes / a.cap_bytes) * 100) : 0
            return (
              <li key={a.owner_id}>
                <button onClick={() => openDetail(a.owner_id)} className="w-full px-5 py-4 text-left active:bg-[#FAFAF7] dark:active:bg-gray-900/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black leading-tight text-[#111827] dark:text-white">{a.name}</p>
                      <p className="break-all text-xs font-medium text-[#6B7280] dark:text-gray-500">{a.email}</p>
                    </div>
                    <span className="shrink-0 rounded bg-gray-100 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:bg-gray-800 dark:text-gray-400">{a.plan_tier || 'FREE'}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400">
                    <span>{formatBytes(a.used_bytes)} of {formatBytes(a.cap_bytes)}</span>
                    <span>{a.item_count} files</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className={`h-full rounded-full ${capBarColor(a.used_bytes, a.cap_bytes)}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="overflow-x-auto max-sm:hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800">
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Agent</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Plan</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Used / Cap</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {agents.length === 0 && (
                <tr><td colSpan={4} className="px-8 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">No stored media recorded yet.</td></tr>
              )}
              {agents.map((a) => {
                const pct = a.cap_bytes > 0 ? Math.min(100, (a.used_bytes / a.cap_bytes) * 100) : 0
                return (
                  <tr
                    key={a.owner_id}
                    onClick={() => openDetail(a.owner_id)}
                    className="hover:bg-[#FAFAF7] dark:hover:bg-gray-900/30 transition-all cursor-pointer group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-[#111827] dark:text-white leading-tight">{a.name}</span>
                        <span className="text-xs text-[#6B7280] dark:text-gray-500 font-medium">{a.email}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {a.plan_tier || 'FREE'}
                      </span>
                    </td>
                    <td className="px-8 py-5 w-56">
                      <div className="flex items-center justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1">
                        <span>{formatBytes(a.used_bytes)}</span>
                        <span>{formatBytes(a.cap_bytes)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${capBarColor(a.used_bytes, a.cap_bytes)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-gray-700 dark:text-gray-300">{a.item_count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 max-sm:!m-0 max-sm:p-0" onClick={() => setDetail(null)}>
          <div
            className="bg-white dark:bg-[#151517] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-lg w-full max-h-[85vh] overflow-y-auto overscroll-contain max-sm:h-full max-sm:max-h-none max-sm:rounded-none max-sm:border-0"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !detail ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-6 h-6 animate-spin text-[#C9A24D]" />
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4 max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:-mx-6 max-sm:-mt-6 max-sm:items-center max-sm:gap-3 max-sm:border-b max-sm:border-gray-100 max-sm:bg-white max-sm:px-6 max-sm:py-3 dark:max-sm:border-gray-800 dark:max-sm:bg-[#151517]">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Phones: a back arrow to the list in place of the round icon (the X is for computers). */}
                    <button onClick={() => setDetail(null)} aria-label="Back to the list" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 sm:hidden dark:bg-white/10 dark:text-gray-200">
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-[#C9A24D]/10 flex items-center justify-center text-[#C9A24D] max-sm:hidden">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-[#111827] dark:text-white leading-tight">{detail.name}</p>
                      <p className="break-all text-xs text-[#6B7280] dark:text-gray-500">{detail.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setDetail(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 max-sm:hidden">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#C9A24D]">{formatBytes(detail.used_bytes)}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Used</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111827] dark:text-white">{formatBytes(detail.cap_bytes)}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Cap ({detail.plan_tier || 'FREE'})</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111827] dark:text-white">{detail.item_count}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Files</p>
                  </div>
                </div>

                <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-2">By Category</p>
                <div className="space-y-2 mb-6">
                  {detail.by_category.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-zinc-500">Nothing stored yet.</p>
                  ) : detail.by_category.map((cat) => {
                    const max = Math.max(...detail.by_category.map((c) => c.bytes), 1)
                    return (
                      <div key={cat.category} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300 w-36 truncate">{CATEGORY_LABEL(cat.category)}</span>
                        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#C9A24D] rounded-full" style={{ width: `${(cat.bytes / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 w-20 text-right">{formatBytes(cat.bytes)}</span>
                      </div>
                    )
                  })}
                </div>

                <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-2 mt-6">Monthly Upload History (Past Year)</p>
                <MonthlyBytesBars points={detail.monthly_trend} />

                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-6">
                  Reflects what's currently stored - a deleted file drops off the ledger immediately, so monthly bars show bytes added that month, not a running total.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
