'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, AlertTriangle, Loader2, CircleDollarSign, Info } from 'lucide-react'
import api from '@/lib/api-service'
import { AIAdminOverview } from '@/types'

// Every third-party service OpenHousePal pays real money for. Deliberately static, not derived
// from .env at runtime (this is a browser-side admin page - it can't read backend secrets), so
// this list has to be kept in sync by hand when a new paid provider is added (see AIUsagePanel's
// _EVENT_TYPE_PROVIDER map on the backend for the AI-cost side of the same list).
//
// None of these providers expose a simple "remaining balance" API we can pull into this page -
// OpenAI/Anthropic/Runway pay-as-you-go accounts don't have a public balance-check endpoint, and
// Mailgun/AWS balance depends on plan/payment-method state, not a number their APIs hand back.
// So this is a click-through directory (go check the real number on the provider's own billing
// page), not a live balance ticker - paired with the spend/failure signals we DO have in-app.
type ProviderInfo = {
  key: string
  name: string
  powers: string
  billingUrl: string
  billingLabel: string
  costProviderKeys?: string[] // matches AIAdminOverview.cost_by_provider_month keys, if tracked
  failureEventTypes?: string[] // AIUsageEvent.event_type values whose failures belong to this provider
  tracked: boolean
}

const PROVIDERS: ProviderInfo[] = [
  {
    key: 'anthropic',
    name: 'Anthropic (Claude)',
    powers: 'Agent Chat, Area narrative/research, CMA comp analysis, AI Copywriter',
    billingUrl: 'https://console.anthropic.com/settings/billing',
    billingLabel: 'console.anthropic.com',
    costProviderKeys: ['anthropic'],
    failureEventTypes: ['chat', 'area_narrative', 'area_research', 'cma_ai', 'copywrite', 'blog_writer'],
    tracked: true,
  },
  {
    key: 'openai',
    name: 'OpenAI',
    powers: 'Read Aloud, Talk to OHP, CMA final reasoning ("Astra"), Studio Media image generation',
    billingUrl: 'https://platform.openai.com/settings/organization/billing/overview',
    billingLabel: 'platform.openai.com',
    costProviderKeys: ['openai'],
    failureEventTypes: ['tts', 'realtime', 'cma_reasoning', 'studio_media_image'],
    tracked: true,
  },
  {
    key: 'runway',
    name: 'Runway ML',
    powers: 'Studio Media video generation and AI photo/video upscaling',
    billingUrl: 'https://app.runwayml.com/',
    billingLabel: 'app.runwayml.com',
    failureEventTypes: ['studio_media_video'],
    tracked: false,
  },
  {
    key: 'google_places',
    name: 'Google Cloud (Places / Maps)',
    powers: 'Explore Nearby amenities, area geocoding and enrichment',
    billingUrl: 'https://console.cloud.google.com/billing',
    billingLabel: 'console.cloud.google.com',
    costProviderKeys: ['google_places'],
    tracked: true,
  },
  {
    key: 'mailgun',
    name: 'Mailgun',
    powers: 'Transactional email - task reminders, notifications, review requests, inbound lead parsing',
    billingUrl: 'https://app.mailgun.com/',
    billingLabel: 'app.mailgun.com',
    tracked: false,
  },
  {
    key: 'aws',
    name: 'AWS (S3)',
    powers: 'Photo, document, and generated-media storage',
    billingUrl: 'https://console.aws.amazon.com/billing/home',
    billingLabel: 'console.aws.amazon.com',
    tracked: false,
  },
]

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

const REASON_LABELS: Record<string, string> = {
  insufficient_credit: 'Out of credit balance',
  provider_rate_limited: 'Rate limited',
  provider_overloaded: 'Reported itself overloaded',
  provider_timeout: 'Timed out',
  provider_auth_error: 'Rejected our API key',
  provider_not_configured: 'Missing its API key entirely',
  provider_error: 'Failing (unclassified)',
}

const LIVE_REFRESH_MS = 20_000

export default function ProviderBalancesPanel() {
  const [overview, setOverview] = useState<AIAdminOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () => api.admin.getAIOverview().then(({ success, data }) => { if (success && data) setOverview(data) })
    load().finally(() => setLoading(false))
    const id = setInterval(load, LIVE_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A24D]" />
      </div>
    )
  }

  const failuresByEventType = new Map<string, { reason: string; count: number; last_seen: string | null }>()
  for (const f of overview?.recent_provider_failures || []) {
    failuresByEventType.set(f.event_type, f)
  }

  return (
    <div>
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6B7280] dark:text-gray-500" />
        <p className="text-xs font-semibold text-[#6B7280] dark:text-gray-400 leading-relaxed">
          None of these providers hand back a live "remaining balance" through their API, so this isn't a real-time balance
          ticker - it's a click-through to each one's own billing page, plus whatever spend and failure signal we can see
          in-app. If a provider is flagged red below, it already failed a real request in the last 24 hours.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => {
          const failures = (p.failureEventTypes || [])
            .map((et) => failuresByEventType.get(et))
            .filter((f): f is { reason: string; count: number; last_seen: string | null } => !!f)
          const monthCost = (p.costProviderKeys || []).reduce(
            (sum, k) => sum + (overview?.cost_by_provider_month?.[k] || 0), 0
          )
          const isDown = failures.length > 0

          return (
            <div
              key={p.key}
              className={`rounded-2xl border p-5 shadow-sm transition-colors ${
                isDown
                  ? 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10'
                  : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-[#151517]'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-black text-[#111827] dark:text-white leading-tight">{p.name}</p>
                {p.tracked ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#C9A24D]">
                    <CircleDollarSign className="w-3 h-3" /> {formatCost(monthCost)} / mo
                  </span>
                ) : (
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-600">
                    Not cost-tracked in-app
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-[#6B7280] dark:text-gray-400 mb-4 leading-relaxed">{p.powers}</p>

              {isDown && (
                <div className="mb-4 space-y-1.5">
                  {failures.map((f) => (
                    <div key={f.reason} className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {REASON_LABELS[f.reason] || f.reason} - {f.count}x, last {formatLastSeen(f.last_seen)}
                    </div>
                  ))}
                </div>
              )}

              <a
                href={p.billingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl transition-all ${
                  isDown
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-50 text-gray-600 hover:bg-[#C9A24D] hover:text-white dark:bg-gray-900/50 dark:text-gray-400'
                }`}
              >
                Check Balance on {p.billingLabel} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
