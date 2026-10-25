'use client'

import { useEffect, useState } from 'react'
import api, { type MailboxInfo } from './api-service'
import type { FollowupSettings, IntegrationsInfo, TaskCounts } from '@/types'

// Gates whether the Reviews status links to the real tool or reads as plan-gated - matches the
// backend's REVIEWS_ACCESS_TIERS (Premium / IDX / Pro No-MLS). Shared by both places that show a
// live Calendar/Reviews/Integrations connection status (Settings' Tools accordion and the Tools
// page's own Calendar/Reviews/Integrations/Follow-ups bars) so the two can't drift out of sync.
export const REVIEWS_TIERS = ['PREMIUM', 'IDX', 'PRO_NO_MLS']

/** ok = set up and working (green) · warn = needs setting up (red) · off = not on this plan (grey) */
export type ToolTone = 'ok' | 'warn' | 'off'

export type ToolConnectionStatus = {
  loading: boolean
  calendarStatus: string
  calendarOk: boolean
  calendarTone: ToolTone
  calendarDetail: string
  reviewsStatus: string
  reviewsOk: boolean
  reviewsTone: ToolTone
  reviewsDetail: string
  reviewsAvailable: boolean
  integrationsStatus: string
  integrationsOk: boolean
  integrationsTone: ToolTone
  integrationsDetail: string
  followupsStatus: string
  followupsTone: ToolTone
  followupsDetail: string
  /** Follow-ups due today or overdue - the red count on the Tools page's Follow-ups card. */
  followupsDue: number
  emailStatus: string
  emailTone: ToolTone
  emailDetail: string
}

function ago(iso?: string | null): string {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

// Real, live "is this actually set up" text for the connect-a-service tools - explicit ask: the
// Tools page cards used to show generic feature-name tags that never said whether the agent had
// actually connected anything.
export function useToolConnectionStatus(planTier?: string): ToolConnectionStatus {
  const [info, setInfo] = useState<IntegrationsInfo | null>(null)
  const [reviewsSummary, setReviewsSummary] = useState<{ destinations: number; received: number; names: string[] } | null>(null)
  const [counts, setCounts] = useState<TaskCounts | null>(null)
  const [rules, setRules] = useState<FollowupSettings | null>(null)
  const [mailbox, setMailbox] = useState<MailboxInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const reviewsAvailable = REVIEWS_TIERS.includes(planTier || '')

  useEffect(() => {
    let alive = true
    const loads: Promise<unknown>[] = [
      api.integrations.get().then(r => { if (alive && r.success && r.data) setInfo(r.data) }),
      api.tasks.counts().then(r => { if (alive && r.success && r.data) setCounts(r.data) }),
      api.tasks.autoRules().then(r => { if (alive && r.success && r.data) setRules(r.data) }),
      api.integrations.mailbox().then(r => { if (alive && r.success && r.data) setMailbox(r.data) }),
    ]
    if (reviewsAvailable) {
      loads.push(
        api.agentHub.listReviews().then(r => {
          if (!alive || !r.success || !r.data) return
          const names = [r.data.settings.google_review_url && 'Google', r.data.settings.zillow_review_url && 'Zillow'].filter(Boolean) as string[]
          setReviewsSummary({ destinations: names.length, received: r.data.reviews.length, names })
        })
      )
    }
    Promise.all(loads).then(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewsAvailable])

  // ---- Calendar
  const g = info?.google_calendar
  const ms = info?.microsoft_calendar
  const calendarNeedsReconnect = !!(g?.needs_reconnect || ms?.needs_reconnect)
  const calendarStatus = calendarNeedsReconnect
    ? 'Stopped syncing - reconnect'
    : g && ms ? 'Connected to Google & Microsoft Calendar'
      : g ? `Connected to Google Calendar${g.account_email ? ` (${g.account_email})` : ''}`
        : ms ? `Connected to Microsoft Calendar${ms.account_email ? ` (${ms.account_email})` : ''}`
          : 'Not connected - no phone alerts for follow-ups'
  const lastSync = [g?.last_sync_at, ms?.last_sync_at].filter(Boolean).sort().pop()
  const calendarOk = !!(g || ms) && !calendarNeedsReconnect
  const calendarDetail = calendarOk
    ? `Follow-ups, open houses & tours sync automatically${lastSync ? ` · synced ${ago(lastSync)}` : ''}`
    : 'Connect Google or Outlook so follow-ups buzz your phone'

  // ---- Integrations (CRM)
  const crmChannelSet = !!(info?.crm_fub_connected || info?.crm_webhook_url || info?.crm_parse_email)
  const crmName = info?.crm_fub_connected ? 'Follow Up Boss' : info?.crm_webhook_url ? 'Webhook' : info?.crm_parse_email ? 'CRM email' : ''
  const integrationsOk = !!info?.crm_push_enabled
  const integrationsStatus = integrationsOk
    ? `Sending new leads to ${crmName || 'your CRM'}`
    : crmChannelSet ? 'CRM connected - sending is turned off' : 'Not set up - leads stay in OpenHousePal only'
  const lastPush = info?.crm_last_push_at
  const integrationsDetail = integrationsOk
    ? (lastPush ? `Last lead sent ${ago(lastPush)}${info?.crm_last_push_status && info.crm_last_push_status !== 'ok' ? ` · ${info.crm_last_push_status}` : ''}` : 'No leads sent yet')
    : 'Follow Up Boss, Lofty, kvCORE & more · portal leads in'

  // ---- Reviews
  const reviewsOk = !!reviewsSummary && reviewsSummary.destinations > 0
  const reviewsStatus = !reviewsAvailable
    ? 'Not available on your plan'
    : reviewsOk
      ? `Sending happy clients to ${reviewsSummary!.names.join(' & ')}`
      : reviewsSummary && reviewsSummary.received > 0
        ? 'Collecting reviews - no Google/Zillow link yet'
        : 'Not set up yet'
  const reviewsDetail = !reviewsAvailable
    ? (planTier === 'NO_MLS' ? 'Available on No-MLS Premium' : 'Available on Premium & IDX')
    : `${reviewsSummary?.received ?? 0} review${reviewsSummary?.received === 1 ? '' : 's'} received · 1-3★ stay private`

  // ---- Follow-ups
  const onRules = rules?.rules.filter(r => r.enabled).length ?? 0
  const totalRules = rules?.rules.length ?? 0
  const due = (counts?.overdue ?? 0) + (counts?.today ?? 0)
  const followupsTone: ToolTone = rules?.enabled === false || !calendarOk || onRules === 0 ? 'warn' : 'ok'
  const followupsOff = rules?.enabled === false
  const followupsStatus = followupsOff
    ? 'Turned off'
    : onRules === 0
    ? 'Automatic follow-ups are all off'
    : !calendarOk
      ? 'On - but no phone alerts (calendar not connected)'
      : `${onRules} of ${totalRules} automatic situations on · phone alerts`
  const followupsDetail = `${counts?.open_total ?? 0} open · ${due} due today${counts?.overdue ? ` (${counts.overdue} overdue)` : ''}`

  // ---- Email (Tools -> Email)
  const mailboxOk = !!(mailbox?.connected && mailbox.enabled && mailbox.status === 'ok')
  const emailStatus = mailboxOk
    ? `Client emails come from ${mailbox!.account_email || 'your email'}`
    : mailbox?.connected && mailbox.status === 'needs_reconnect' ? 'Stopped sending from your email - reconnect'
      : 'Sending from OpenHousePal - connect your email'
  const emailDetail = 'Choose which emails go out, and which come to you'

  return {
    loading,
    emailStatus,
    emailTone: mailboxOk ? 'ok' : 'warn',
    emailDetail,
    calendarStatus,
    calendarOk,
    calendarTone: calendarOk ? 'ok' : 'warn',
    calendarDetail,
    reviewsStatus,
    reviewsOk,
    reviewsTone: !reviewsAvailable ? 'off' : reviewsOk ? 'ok' : 'warn',
    reviewsDetail,
    reviewsAvailable,
    integrationsStatus,
    integrationsOk,
    integrationsTone: integrationsOk ? 'ok' : 'warn',
    integrationsDetail,
    followupsStatus,
    followupsTone,
    followupsDetail,
    followupsDue: due,
  }
}
