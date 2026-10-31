'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertOctagon, ArrowLeft, DollarSign, MessageSquare, Users, ShieldAlert, X, Bot, Loader2, Globe2, Radar } from 'lucide-react'
import api from '@/lib/api-service'
import OhpSwitch from '@/components/ui/OhpSwitch'
import { AIAdminOverview, AIAdminAgentSummary, AIAdminAgentDetail, AIAdminBudgetStatus, AIAdminTopConsumer, AIAdminMonthlyPoint } from '@/types'

// Mirrors ai_rate_limit_service.classify_provider_error's machine keys - a real upstream AI
// provider failure (not one of our own configured ceilings), the kind that used to be invisible
// anywhere but a backend log line. "insufficient_credit" is the one that actually happened on
// 2026-09-14 (Anthropic account ran out of credit balance mid-CMA-generation).
const PROVIDER_FAILURE_LABELS: Record<string, string> = {
  insufficient_credit: 'Provider account is out of credit balance - reload it now',
  provider_rate_limited: 'Provider rate limit hit',
  provider_overloaded: 'Provider reported itself overloaded',
  provider_timeout: 'Provider call timed out',
  provider_auth_error: 'Provider rejected our API key',
  provider_error: 'Provider call failed (unclassified)',
  provider_not_configured: 'Provider integration is missing its API key',
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  chat: 'Chat', tts: 'Read Aloud', realtime: 'Talk to OHP', cma_ai: 'CMA - comp analysis',
  cma_reasoning: 'CMA - final reasoning', area_narrative: 'Area narrative', area_research: 'Area research',
  copywrite: 'AI Copywriter', blog_writer: 'AI Blog Writer', external_api: 'Google look-ups (agents)',
  studio_media_image: 'Studio Media - image', studio_media_video: 'Studio Media - video',
  cma_ai_recompute: 'CMA - recompute', area_fair_housing: 'Town pages - fair housing check',
  school_lookup: 'Cheat sheet - schools', cheat_sheet_downtown: 'Cheat sheet - nearby places',
  cheat_sheet_proofread: 'Cheat sheet - proofread', explore_nearby: 'Explore Nearby (Google, visitors)',
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic (Claude)', openai: 'OpenAI', fal: 'fal (AI video)', google: 'Google (agent look-ups)',
  google_places: 'Google Places (visitors)', other: 'Other',
}

function eventTypeLabel(key: string): string {
  return EVENT_TYPE_LABELS[key] || key
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`
}

function formatLastActive(iso?: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// Dependency-free sparkline - a normalized SVG polyline. Good enough for a 30-point daily
// trend without pulling in a charting library the rest of the frontend doesn't use.
function Sparkline({ points, color = '#C9A24D' }: { points: number[]; color?: string }) {
  if (points.length < 2) return <div className="h-12" />
  const max = Math.max(...points, 0.0001)
  const min = Math.min(...points, 0)
  const range = max - min || 1
  const w = 100
  const h = 32
  const coords = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-12">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function ToolUsageBars({ toolUsage }: { toolUsage: Record<string, number> }) {
  const entries = Object.entries(toolUsage).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return <p className="text-xs text-gray-400 dark:text-zinc-500">No tool calls recorded.</p>
  const max = entries[0][1]
  return (
    <div className="space-y-2">
      {entries.map(([name, count]) => (
        <div key={name} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-600 dark:text-zinc-300 w-40 truncate">{name}</span>
          <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-[#C9A24D] rounded-full" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  )
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

// Per-month cost history so an admin can see what an agent has been doing over time, not just
// the rolling 30-day window (which drops a month as soon as it's more than 30 days old).
function MonthlyTrendBars({ points }: { points: AIAdminMonthlyPoint[] }) {
  if (points.length === 0) return <p className="text-xs text-gray-400 dark:text-zinc-500">No monthly history yet.</p>
  const max = Math.max(...points.map((p) => p.cost_usd), 0.01)
  return (
    <div className="flex items-end gap-1.5 h-20">
      {points.map((p) => (
        <div key={p.month} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
          <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-t-sm overflow-hidden flex items-end h-14">
            <div className="w-full bg-[#C9A24D] rounded-t-sm transition-all" style={{ height: `${Math.max(4, (p.cost_usd / max) * 100)}%` }} />
          </div>
          <span className="text-[8px] font-bold text-gray-400 dark:text-zinc-500">{formatMonthLabel(p.month)}</span>
          <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-[#111827] text-white text-[9px] font-bold px-2 py-1 rounded whitespace-nowrap z-10">
            {formatCost(p.cost_usd)} · {p.messages} msgs
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-white dark:bg-[#151517] px-6 py-4 max-sm:px-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col ${accent ? 'border-l-4 border-l-[#C9A24D]' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1 text-[#6B7280] dark:text-gray-500">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-2xl font-black leading-tight ${accent ? 'text-[#C9A24D]' : 'text-[#111827] dark:text-white'}`}>{value}</span>
    </div>
  )
}

function ceilingBarColor(spent: number, limit: number | null | undefined): string {
  if (!limit) return 'bg-gray-300 dark:bg-gray-700'
  const pct = spent / limit
  if (pct >= 0.9) return 'bg-red-500'
  if (pct >= 0.6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function BudgetStatusRow({ status }: { status: AIAdminBudgetStatus }) {
  const hasCostLimit = status.day_limit_usd != null || status.month_limit_usd != null
  const hasCount = status.day_count_limit != null || status.month_count_limit != null
  return (
    <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
      <p className="text-xs font-black text-[#111827] dark:text-white mb-2">{status.label}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-1">
            <span>Day: {formatCost(status.day_spent_usd)}{status.day_limit_usd != null ? ` / ${formatCost(status.day_limit_usd)}` : ''}</span>
            <span>Month: {formatCost(status.month_spent_usd)}{status.month_limit_usd != null ? ` / ${formatCost(status.month_limit_usd)}` : ''}</span>
          </div>
          {hasCostLimit ? (
            <>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${ceilingBarColor(status.month_spent_usd, status.month_limit_usd ?? status.day_limit_usd)}`}
                  style={{ width: `${Math.min(100, ((status.month_limit_usd ?? status.day_limit_usd) ? (status.month_spent_usd / (status.month_limit_usd ?? status.day_limit_usd!)) * 100 : 0))}%` }}
                />
              </div>
              {status.est_remaining_calls_month != null && (
                <p className="mt-1 text-[9px] font-bold text-gray-400">
                  ~{status.est_remaining_calls_month.toLocaleString()} more calls fit under this month's remaining budget, at this month's actual average cost per call
                </p>
              )}
            </>
          ) : (
            <p className="text-[9px] font-semibold text-gray-300 dark:text-gray-600">No dollar ceiling - gated by call count instead (see right)</p>
          )}
        </div>
        {hasCount && (
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-1">
              <span>Day: {status.day_count ?? 0}{status.day_count_limit != null ? ` / ${status.day_count_limit}` : ''} calls</span>
              <span>Month: {status.month_count ?? 0}{status.month_count_limit != null ? ` / ${status.month_count_limit}` : ''} calls</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${ceilingBarColor(status.month_count ?? 0, status.month_count_limit)}`}
                style={{ width: `${Math.min(100, status.month_count_limit ? ((status.month_count ?? 0) / status.month_count_limit) * 100 : 0)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {status.free_tier_note && (
        <p className="mt-2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{status.free_tier_note}</p>
      )}
    </div>
  )
}

const LIVE_REFRESH_MS = 20_000

export default function AIUsagePanel() {
  const [overview, setOverview] = useState<AIAdminOverview | null>(null)
  const [agents, setAgents] = useState<AIAdminAgentSummary[]>([])
  const [period, setPeriod] = useState<'month' | 'all'>('month')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AIAdminAgentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // The bottom-right AI helper for every paying agent (10/30) - one switch turns it off for all.
  const [helperOn, setHelperOn] = useState<boolean | null>(null)
  const [helperBusy, setHelperBusy] = useState(false)

  useEffect(() => {
    api.admin.getAIHelperSwitch().then((r) => { if (r.success && r.data) setHelperOn(r.data.open_to_all) })
  }, [])

  const flipHelper = async (next: boolean) => {
    setHelperBusy(true)
    const r = await api.admin.setAIHelperSwitch(next)
    if (r.success && r.data) setHelperOn(r.data.open_to_all)
    setHelperBusy(false)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([api.admin.getAIOverview(), api.admin.getAIAgents(period)]).then(([ov, ag]) => {
      if (ov.success && ov.data) setOverview(ov.data)
      if (ag.success && ag.data) setAgents(ag.data)
      setLoading(false)
    })
  }, [period])

  // Live-updating usage tracker: the budget ceilings (Places included) can change from real
  // visitor traffic between page loads, so this panel re-polls quietly in the background rather
  // than only ever showing a stale snapshot from whenever an admin happened to open the tab. No
  // loading spinner on these ticks - only the very first load shows one.
  useEffect(() => {
    const id = setInterval(() => {
      api.admin.getAIOverview().then((ov) => { if (ov.success && ov.data) setOverview(ov.data) })
    }, LIVE_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  // Any Places bucket that has actually hit its monthly free-tier cap right now - calls are
  // being hard-blocked (ExploreNearbyBudgetExceeded) until the period rolls over, not just
  // "getting close" (that's what the amber/red bar below already shows).
  const exhaustedBuckets = useMemo(
    () => (overview?.global_budget_status || []).filter(
      (s) => s.bucket.startsWith('places_') && s.month_count != null && s.month_count_limit != null && s.month_count >= s.month_count_limit
    ),
    [overview]
  )

  const trendPoints = useMemo(() => (overview?.daily_trend_30d || []).map((p) => p.cost_usd), [overview])

  const openDetail = async (ownerId: string) => {
    setDetailLoading(true)
    const res = await api.admin.getAIAgentDetail(ownerId)
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
      {helperOn !== null && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <Bot className="h-5 w-5 shrink-0 text-[#8b7355] dark:text-[#C9A24D]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#111827] dark:text-white">AI helper for every agent</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-zinc-400">
              {helperOn ? 'On - every agent with an active plan sees the chat button in the bottom right.' : 'Off - only the admin account and test accounts (Peter Stefanatos) see it.'}
            </p>
          </div>
          <OhpSwitch on={helperOn} onChange={flipHelper} busy={helperBusy} label="AI helper for every agent" />
        </div>
      )}

      {/* Provider-side failure alert (exhausted credit balance, outage, auth, rate limit) in the
          last 24h - the one thing that used to be totally invisible here and only ever showed up
          as a backend log line, e.g. an Anthropic account running out of credit mid-generation. */}
      {overview?.recent_provider_failures && overview.recent_provider_failures.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-red-400 bg-red-50 p-5 dark:border-red-800 dark:bg-red-900/15">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-red-600 animate-pulse" />
          <div>
            <p className="text-sm font-black text-red-700 dark:text-red-400">AI provider call(s) failed in the last 24 hours</p>
            {overview.recent_provider_failures.map((f) => (
              <p key={`${f.event_type}:${f.reason}`} className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                {eventTypeLabel(f.event_type)}: {PROVIDER_FAILURE_LABELS[f.reason] || f.reason} — {f.count}x, last {formatLastActive(f.last_seen)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Free-tier-exhausted alert - only appears once a Places bucket has actually hit its
          monthly cap (calls are being blocked right now), not merely trending toward it. */}
      {exhaustedBuckets.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-900/10">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-black text-red-700 dark:text-red-400">Free monthly usage used up</p>
            {exhaustedBuckets.map((s) => (
              <p key={s.bucket} className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                {s.label}: {s.month_count}/{s.month_count_limit} calls this month - further requests are being blocked (not billed) until next month.
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

      {/* Site spend at a glance - today and this month against the all-features emergency brake,
          plus CMA (its own site-wide cap), so the whole-platform number is the first thing read. */}
      {(() => {
        const brake = overview?.global_budget_status?.find((s) => s.bucket === 'platform_emergency')
        const cma = overview?.global_budget_status?.find((s) => s.bucket === 'cma_ai_global')
        const tiles: { label: string; spent: number; limit?: number | null; sub: string }[] = [
          { label: 'Site spend today', spent: overview?.total_cost_today_usd || 0, limit: brake?.day_limit_usd, sub: 'every AI + Google feature combined' },
          { label: 'Site spend this month', spent: overview?.total_cost_month_usd || 0, limit: brake?.month_limit_usd, sub: 'every AI + Google feature combined' },
          { label: 'CMA today', spent: overview?.cma_cost_today_usd ?? cma?.day_spent_usd ?? 0, limit: cma?.day_limit_usd, sub: 'every CMA AI step, vs the site-wide CMA cap' },
          { label: 'CMA this month', spent: overview?.cma_cost_month_usd ?? cma?.month_spent_usd ?? 0, limit: cma?.month_limit_usd, sub: 'every CMA AI step, vs the site-wide CMA cap' },
        ]
        return (
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4 max-sm:gap-3">
            {tiles.map((t) => {
              const pct = t.limit ? Math.min(100, (t.spent / t.limit) * 100) : 0
              return (
                <div key={t.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] max-sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6B7280] dark:text-gray-500">{t.label}</p>
                  <p className="mt-2 text-2xl font-black text-[#111827] dark:text-white max-sm:text-xl">
                    {formatCost(t.spent)}
                    {t.limit != null && <span className="text-sm font-bold text-gray-400 max-sm:block max-sm:text-xs"> / {formatCost(t.limit)}</span>}
                  </p>
                  {t.limit != null && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className={`h-full rounded-full ${ceilingBarColor(t.spent, t.limit)}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <p className="mt-2 text-[10px] font-semibold text-gray-400">{t.sub}</p>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 max-sm:gap-3">
        <StatCard icon={<DollarSign className="w-3 h-3" />} label="Cost (Month)" value={formatCost(overview?.total_cost_month_usd || 0)} accent />
        <StatCard icon={<DollarSign className="w-3 h-3" />} label="Cost (All-Time)" value={formatCost(overview?.total_cost_all_time_usd || 0)} />
        <StatCard icon={<MessageSquare className="w-3 h-3" />} label="AI calls (Month)" value={String(overview?.messages_month || 0)} />
        <StatCard icon={<Users className="w-3 h-3" />} label="Active Agents (30d)" value={String(overview?.active_agents_30d || 0)} />
        <StatCard icon={<ShieldAlert className="w-3 h-3" />} label="Blocked (Month)" value={String(overview?.blocked_count_month || 0)} />
      </div>

      {/* Trend */}
      <div className="bg-white dark:bg-[#151517] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm mb-8">
        <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-3">30-Day Cost Trend</p>
        <Sparkline points={trendPoints} />
      </div>

      {/* Why calls were blocked this month - our own ceilings (daily_limit, cost_ceiling, etc.)
          mixed with real provider failures (insufficient_credit, etc. - see the red banner above
          for the live last-24h version of the same data). */}
      {overview?.top_block_reasons && overview.top_block_reasons.length > 0 && (
        <div className="bg-white dark:bg-[#151517] p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm mb-8">
          <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-3">Blocked Calls This Month — Top Reasons</p>
          <div className="space-y-2">
            {overview.top_block_reasons.map((r) => {
              const isProviderFailure = r.reason in PROVIDER_FAILURE_LABELS
              return (
                <div key={r.reason} className="flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isProviderFailure ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                    {PROVIDER_FAILURE_LABELS[r.reason] || r.reason}
                  </span>
                  <span className="font-black text-[#111827] dark:text-white">{r.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cost by feature - every event_type that spent money this month (chat, Read Aloud, Talk
          to OHP, both CMA AI stages, area narrative/research, AI Copywriter, ...), not a fixed
          hardcoded set - a newly metered feature shows up here automatically. */}
      {overview?.cost_by_type_month && Object.keys(overview.cost_by_type_month).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(overview.cost_by_type_month)
            .sort((a, b) => b[1] - a[1])
            .map(([key, cost]) => (
              <StatCard key={key} icon={<DollarSign className="w-3 h-3" />} label={`${eventTypeLabel(key)} (Month)`} value={formatCost(cost)} />
            ))}
        </div>
      )}

      {/* Cost by provider - Anthropic / OpenAI / Google Places, all combined */}
      {overview?.cost_by_provider_month && Object.keys(overview.cost_by_provider_month).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {Object.entries(overview.cost_by_provider_month).map(([provider, cost]) => (
            <StatCard key={provider} icon={<Globe2 className="w-3 h-3" />} label={`${PROVIDER_LABELS[provider] || provider} (Month)`} value={formatCost(cost)} />
          ))}
        </div>
      )}

      {/* Every metered API's day/month standing against its configured ceiling - Places, AI
          chat/tts/realtime/area-research, and the platform-wide emergency brake that spans all
          of them combined. */}
      {overview?.global_budget_status && overview.global_budget_status.length > 0 && (
        <div className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm mb-8 overflow-hidden">
          <p className="px-6 pt-5 pb-3 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Every Metered API — Day/Month vs. Ceiling</p>
          {overview.global_budget_status.map((s) => (
            <BudgetStatusRow key={s.bucket} status={s} />
          ))}
        </div>
      )}

      {/* Abuse watch - today's closest-to-capped visitor IPs/devices on Explore Nearby. Empty
          when nobody's near their $3/day ceiling, which is the common case. */}
      {overview?.top_google_places_consumers && overview.top_google_places_consumers.length > 0 && (
        <div className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm mb-8 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="w-3.5 h-3.5 text-[#6B7280] dark:text-gray-500" />
            <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Explore Nearby — Today's Top IP/Device Spend</p>
          </div>
          <div className="space-y-2">
            {overview.top_google_places_consumers.map((c: AIAdminTopConsumer) => (
              <div key={`${c.kind}:${c.identifier}`} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 break-all font-mono text-gray-500 dark:text-gray-400">
                  <span className="uppercase text-[9px] font-black text-gray-400 mr-2">{c.kind}</span>
                  {c.identifier}
                </span>
                <span className={`shrink-0 font-black ${c.spent_today_usd / c.limit_usd >= 0.9 ? 'text-red-500' : 'text-[#111827] dark:text-white'}`}>
                  {formatCost(c.spent_today_usd)} / {formatCost(c.limit_usd)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white dark:bg-[#151517] rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#151517] via-[#C9A24D] to-[#151517]" />
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-gray-800 max-sm:flex-wrap max-sm:gap-3 max-sm:px-5">
          <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Cost Leaderboard — Who's Driving Spend</p>
          <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
            {(['month', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 max-sm:py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  period === p ? 'bg-[#C9A24D] text-white shadow-lg shadow-[#C9A24D]/20' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {p === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
        {/* Phones: one card per agent instead of the 7-column table. */}
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
          {agents.length === 0 && <li className="px-5 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">No AI usage recorded for this period.</li>}
          {agents.map((a) => (
            <li key={a.owner_id}>
              <button onClick={() => openDetail(a.owner_id)} className="w-full px-5 py-4 text-left active:bg-[#FAFAF7] dark:active:bg-gray-900/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black leading-tight text-[#111827] dark:text-white">{a.name}</p>
                    <p className="break-all text-xs font-medium text-[#6B7280] dark:text-gray-500">{a.email}</p>
                  </div>
                  <span className="shrink-0 font-black text-[#C9A24D]">{formatCost(a.cost_usd)}</span>
                </div>
                <p className="mt-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  {a.messages} messages · {a.tool_calls} tool calls
                  {a.blocked_count > 0 && <span className="text-red-500"> · {a.blocked_count} blocked</span>}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  Site today: <span className={a.site_daily_limit_usd && a.site_spend_today_usd / a.site_daily_limit_usd >= 0.9 ? 'font-black text-red-500' : 'font-black text-gray-700 dark:text-gray-300'}>{formatCost(a.site_spend_today_usd)}{a.site_daily_limit_usd ? ` / ${formatCost(a.site_daily_limit_usd)}` : ''}</span>
                  {' · '}last active {formatLastActive(a.last_active)}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto max-sm:hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800">
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Agent</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Cost</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Messages</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Tool Calls</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Site Spend (Today)</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Blocked</th>
                <th className="px-8 py-4 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.2em]">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {agents.length === 0 && (
                <tr><td colSpan={7} className="px-8 py-10 text-center text-sm text-gray-400 dark:text-zinc-500">No AI usage recorded for this period.</td></tr>
              )}
              {agents.map((a) => (
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
                  <td className="px-8 py-5 font-black text-[#C9A24D]">{formatCost(a.cost_usd)}</td>
                  <td className="px-8 py-5 text-sm font-bold text-gray-700 dark:text-gray-300">{a.messages}</td>
                  <td className="px-8 py-5 text-sm font-bold text-gray-700 dark:text-gray-300">{a.tool_calls}</td>
                  <td className="px-8 py-5 text-sm font-bold">
                    {a.site_spend_today_usd > 0 ? (
                      <span className={a.site_daily_limit_usd && a.site_spend_today_usd / a.site_daily_limit_usd >= 0.9 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}>
                        {formatCost(a.site_spend_today_usd)}{a.site_daily_limit_usd ? ` / ${formatCost(a.site_daily_limit_usd)}` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-zinc-600">$0.00</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-sm font-bold">
                    {a.blocked_count > 0 ? (
                      <span className="text-red-500">{a.blocked_count}</span>
                    ) : (
                      <span className="text-gray-300 dark:text-zinc-600">0</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-xs text-gray-500 dark:text-gray-400 font-medium">{formatLastActive(a.last_active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill-down modal */}
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
                      <Bot className="w-5 h-5" />
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
                    <p className="text-lg font-black text-[#C9A24D]">{formatCost(detail.cost_usd)}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">All-Time Cost</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111827] dark:text-white">{detail.messages}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Messages</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111827] dark:text-white">{detail.blocked_count}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Blocked</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111827] dark:text-white">
                      {formatCost(detail.site_spend_today_usd)}{detail.site_daily_limit_usd ? ` / ${formatCost(detail.site_daily_limit_usd)}` : ''}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">IDX Site Spend (Today)</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-xl p-3 text-center">
                    <p className="text-lg font-black text-[#111827] dark:text-white">
                      {formatCost(detail.total_spend_today_usd)}{detail.total_daily_limit_usd ? ` / ${formatCost(detail.total_daily_limit_usd)}` : ''}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total Attributed Spend (Today)</p>
                  </div>
                </div>

                <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-2">30-Day Cost Trend</p>
                <Sparkline points={detail.daily_trend.map((p) => p.cost_usd)} />

                <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-2 mt-6">Monthly History (Past Year)</p>
                <MonthlyTrendBars points={detail.monthly_trend} />

                <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-2 mt-6">What They're Doing (Tool Usage)</p>
                <ToolUsageBars toolUsage={detail.tool_usage} />

                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-6">
                  Last active {formatLastActive(detail.last_active)}. This view shows usage metadata only — conversation content is never exposed here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
