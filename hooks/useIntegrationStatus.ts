'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

export interface IntegrationStatus {
  loaded: boolean
  /** Google or Outlook calendar connected (two-way sync). */
  calendarConnected: boolean
  /** "Google Calendar" / "Outlook" / "Google Calendar & Outlook" - for "Synced to ..." lines. */
  calendarLabel: string
  /** Connected but the provider stopped accepting our tokens - agent must reconnect. */
  calendarNeedsReconnect: boolean
  crmConnected: boolean
  /** "Google" / "Microsoft" / "Google & Microsoft" - short, for the connected icon. */
  calendarProvider: string
  /** "Follow Up Boss" when that's connected, otherwise "CRM". */
  crmLabel: string
  /** Account the calendar is connected with, e.g. name@brokerage.com */
  calendarEmail: string
}

const EMPTY: IntegrationStatus = {
  loaded: false, calendarConnected: false, calendarLabel: '', calendarNeedsReconnect: false, crmConnected: false, calendarProvider: '', crmLabel: 'CRM', calendarEmail: '',
}

// Several widgets on one page (dash checklist + follow-ups footer) ask for the same thing - share
// one in-flight request and a short-lived result instead of hitting /integrations for each.
let cached: { at: number; value: IntegrationStatus } | null = null
let inflight: Promise<IntegrationStatus> | null = null
const TTL_MS = 30_000

async function fetchStatus(): Promise<IntegrationStatus> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  if (inflight) return inflight
  inflight = (async () => {
    const res = await api.integrations.get()
    const d = res.success ? res.data : null
    const google = d?.google_calendar?.connected ? d.google_calendar : null
    const ms = d?.microsoft_calendar?.connected ? d.microsoft_calendar : null
    const names = [google && 'Google Calendar', ms && 'Outlook'].filter(Boolean) as string[]
    const value: IntegrationStatus = {
      loaded: !!d,
      calendarConnected: names.length > 0,
      calendarLabel: names.join(' & '),
      calendarNeedsReconnect: !!(google?.needs_reconnect || ms?.needs_reconnect),
      crmConnected: !!d?.crm_push_enabled,
      calendarProvider: [google && 'Google', ms && 'Microsoft'].filter(Boolean).join(' & '),
      crmLabel: d?.crm_fub_connected ? 'Follow Up Boss' : 'CRM',
      calendarEmail: [google?.account_email, ms?.account_email].filter(Boolean).join(', '),
    }
    if (d) cached = { at: Date.now(), value }
    return value
  })()
  try { return await inflight } finally { inflight = null }
}

export function useIntegrationStatus(): IntegrationStatus {
  const { isAuthenticated } = useAuth()
  const [state, setState] = useState<IntegrationStatus>(cached?.value ?? EMPTY)
  useEffect(() => {
    if (!isAuthenticated) return
    let alive = true
    const load = () => fetchStatus().then(v => { if (alive) setState(v) }).catch(() => {})
    load()
    const onFocus = () => { cached = null; load() }
    window.addEventListener('focus', onFocus)
    return () => { alive = false; window.removeEventListener('focus', onFocus) }
  }, [isAuthenticated])
  return state
}
