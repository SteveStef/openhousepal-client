'use client'

// Standalone Calendar page - extracted out of Settings (where it used to be a tab) so it gets a
// full page's breathing room. Same real logic/API calls as before (Google two-way OAuth,
// Microsoft/Outlook two-way OAuth - the read-only subscribe-by-link option was retired), laid out for
// someone who has never connected a calendar before: a plain-language "what is this" explainer up
// top, bigger connect buttons, and a calmer one-thing-at-a-time layout instead of a dense
// accordion tucked inside a Settings tab.

import { useEffect, useState } from 'react'
import {
  AlertCircle, BellRing, CalendarClock, CalendarDays, Check, Home, Loader2, RefreshCw,
} from 'lucide-react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { LuxeSurface } from '@/components/ui/LuxeSurface'
import api from '@/lib/api-service'
import { GoogleCalendarLogo, OutlookLogo } from '@/components/brand/ProviderLogos'
import { OUTLOOK_LIVE } from '@/lib/providers'
import type { IntegrationsInfo } from '@/types'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import StudioPageHeader from '@/components/studio/StudioPageHeader'

// "2m ago" / "3h ago" / "5d ago" for a past ISO timestamp.
function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function CalendarPage() {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <CalendarPageInner />
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function CalendarPageInner() {
  const [info, setInfo] = useState<IntegrationsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'' | 'connect' | 'disconnect' | 'resync'>('')
  const [banner, setBanner] = useState<'connected' | 'error' | null>(null)

  const [msBusy, setMsBusy] = useState<'' | 'connect' | 'disconnect' | 'resync'>('')

  useEffect(() => {
    api.integrations.get().then(ig => {
      if (ig.success && ig.data) setInfo(ig.data)
      setLoading(false)
    })
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      const c = p.get('calendar')
      if (c === 'connected' || c === 'error') {
        setBanner(c)
        p.delete('calendar')
        const qs = p.toString()
        window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
        setTimeout(() => setBanner(null), 6000)
      }
    }
  }, [])

  const connect = async () => {
    setBusy('connect')
    const r = await api.integrations.googleConnectUrl()
    if (r.success && r.data?.auth_url) { window.location.href = r.data.auth_url; return }
    setBusy(''); setBanner('error')
  }
  const disconnect = async () => {
    if (!confirm('Disconnect Google Calendar? The “OpenHousePal” calendar it created and the events on it will be removed from your Google account.')) return
    setBusy('disconnect')
    const r = await api.integrations.disconnectGoogle()
    if (r.success && r.data) setInfo(r.data)
    setBusy('')
  }
  const resync = async () => {
    setBusy('resync')
    await api.integrations.resyncGoogle()
    setTimeout(async () => { const g = await api.integrations.get(); if (g.success && g.data) setInfo(g.data); setBusy('') }, 2500)
  }
  const msConnect = async () => {
    setMsBusy('connect')
    const r = await api.integrations.microsoftConnectUrl()
    if (r.success && r.data?.auth_url) { window.location.href = r.data.auth_url; return }
    setMsBusy(''); setBanner('error')
  }
  const msDisconnect = async () => {
    if (!confirm('Disconnect Microsoft Calendar? The “OpenHousePal” calendar it created and the events on it will be removed from your Outlook/Microsoft 365 account.')) return
    setMsBusy('disconnect')
    const r = await api.integrations.disconnectMicrosoft()
    if (r.success && r.data) setInfo(r.data)
    setMsBusy('')
  }
  const msResync = async () => {
    setMsBusy('resync')
    await api.integrations.resyncMicrosoft()
    setTimeout(async () => { const g = await api.integrations.get(); if (g.success && g.data) setInfo(g.data); setMsBusy('') }, 2500)
  }
  const gAvail = !!info?.google_calendar_available
  const g = info?.google_calendar
  // Outlook shows "Coming soon" until it's fully set up (lib/providers) - unless already connected.
  const msConnected = !!info?.microsoft_calendar?.connected
  const msAvail = !!info?.microsoft_calendar_available && (OUTLOOK_LIVE || msConnected)
  const ms = info?.microsoft_calendar
  const anyOAuthAvail = gAvail || msAvail
  const connectedSomewhere = !!g || !!ms
  const connectedLabel = g ? 'Google Calendar' : ms ? 'Outlook' : null

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <StudioPageHeader
          icon={CalendarClock}
          kicker="Calendar"
          title={<>Your follow-ups, <em>on your calendar.</em></>}
          subtitle="Put your follow-ups and scheduled open houses on the calendar you already use."
        />

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="space-y-5">
            <AnimatePresence>
              {banner && (
                <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className={`flex items-center gap-2 overflow-hidden rounded-2xl border px-4 py-3 text-sm font-semibold ${banner === 'connected' ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                  {banner === 'connected'
                    ? <><Check className="h-4 w-4 shrink-0" /> Connected - your tasks and open houses are syncing now. Look for an “OpenHousePal” calendar.</>
                    : <><AlertCircle className="h-4 w-4 shrink-0" /> Couldn’t connect. Try again - if Google showed an “unverified app” screen, click Advanced → continue.</>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* What it does, as a picture: a sample week filling itself in */}
            <motion.div variants={rise}>
              <LuxeSurface icon={CalendarDays} className="rounded-3xl border border-[#C9A24D]/30 p-5 text-[#111827] shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.07] dark:text-white sm:p-6">
                <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.3fr]">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">How it works</p>
                    <p className="lx-title mt-1 font-serif text-2xl font-black leading-tight">One calendar called <em>“OpenHousePal”</em></p>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-[#6b5a45] dark:text-white/60">We add it to your Google or Outlook account and keep it filled in - every follow-up and open house, automatically. Connect once and you&apos;re done.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[{ i: BellRing, t: 'Follow-ups' }, { i: Home, t: 'Open houses' }, { i: RefreshCw, t: 'Always in sync' }].map(({ i: I, t }, k) => (
                        <motion.span key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + k * 0.08 }} className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/30 bg-white/80 px-3 py-1 text-[11px] font-black text-[#6b5a45] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/75"><I className="h-3.5 w-3.5 text-[#C9A24D]" /> {t}</motion.span>
                      ))}
                    </div>
                    <span className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black ${connectedSomewhere ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200'}`}>
                      <span className="relative flex h-2 w-2"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${connectedSomewhere ? 'bg-emerald-400' : 'bg-amber-400'}`} /><span className={`relative inline-flex h-2 w-2 rounded-full ${connectedSomewhere ? 'bg-emerald-500' : 'bg-amber-500'}`} /></span>
                      {connectedSomewhere ? `Syncing to ${connectedLabel}` : 'Not connected yet - pick one below'}
                    </span>
                  </div>
                  <WeekPreview />
                </div>
              </LuxeSurface>
            </motion.div>

            {/* Two-way providers, side by side */}
            {anyOAuthAvail && (
              <motion.div variants={rise} className="grid gap-5 md:grid-cols-2">
                {gAvail && (
                  <ProviderCard
                    name="Google Calendar" mark={<GoogleCalendarLogo />} recommended
                    blurb="Two-way - edit events right in Google, and we skip times you're already booked."
                    status={g} busy={busy} onConnect={connect} onDisconnect={disconnect} onResync={resync}
                    steps={['Click Connect - you’ll sign in with Google.', 'If Google says “unverified app”: Advanced → Go to OpenHousePal → Allow.', 'You land back here, synced.']} />
                )}
                {msAvail && (
                  <ProviderCard
                    name="Outlook Calendar" mark={<OutlookLogo />}
                    blurb="Two-way with Outlook / Microsoft 365 - events you can drag and edit."
                    status={ms} busy={msBusy} onConnect={msConnect} onDisconnect={msDisconnect} onResync={msResync}
                    steps={['Click Connect - sign in with Microsoft (work or personal).', 'You land back here, synced.']} />
                )}
                {!msAvail && (
                  <div className="flex items-center gap-4 rounded-3xl border-2 border-dashed border-gray-200 bg-white/60 p-6 dark:border-white/10 dark:bg-white/[0.02]">
                    <span className="h-12 w-12 shrink-0 opacity-60"><OutlookLogo /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-black text-gray-500 dark:text-gray-400">Outlook Calendar</p>
                      <p className="text-sm font-medium text-gray-400">We&apos;re finishing this one. Use Google, or the calendar link above, for now.</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">Coming soon</span>
                  </div>
                )}
              </motion.div>
            )}

            {connectedSomewhere && (
              <p className="text-center text-xs font-semibold text-gray-400">All set - new tasks and open houses keep appearing on your calendar automatically.</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

const rise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } } }

type ProviderStatus = { account_email?: string | null; last_sync_at?: string | null; needs_reconnect?: boolean; last_error?: string | null } | null | undefined

function ProviderCard({ name, mark, recommended, blurb, status, busy, onConnect, onDisconnect, onResync, steps }: {
  name: string; mark: React.ReactNode; recommended?: boolean; blurb: string; status: ProviderStatus
  busy: '' | 'connect' | 'disconnect' | 'resync'; onConnect: () => void; onDisconnect: () => void; onResync: () => void; steps: string[]
}) {
  const connected = !!status
  const expired = !!status?.needs_reconnect
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-30px_rgba(139,115,85,.6)] dark:bg-[#121214] sm:p-6 ${connected && !expired ? 'border-emerald-300/70 dark:border-emerald-400/25' : expired ? 'border-amber-300 dark:border-amber-400/30' : 'border-gray-200 dark:border-white/[0.07]'}`}>
      {connected && !expired && <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />}
      <div className="relative flex items-start gap-3">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-sm transition group-hover:rotate-[-4deg] dark:border-white/10">{mark}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-serif text-lg font-black text-[#111827] dark:text-white">
            {name}
            {recommended && !connected && <span className="rounded-full bg-[#C9A24D]/20 px-2 py-0.5 font-sans text-[9px] font-black uppercase tracking-wider text-[#8b7355] dark:text-[#d7b974]">Recommended</span>}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{blurb}</p>
        </div>
      </div>

      {connected ? (
        <div className="relative mt-5 flex flex-1 flex-col">
          <div className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 ${expired ? 'bg-amber-50 dark:bg-amber-400/10' : 'bg-emerald-50 dark:bg-emerald-400/10'}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${expired ? 'bg-amber-500' : 'bg-emerald-500'}`}>{expired ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={3} />}</span>
            <div className="min-w-0">
              <p className={`text-sm font-black ${expired ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200'}`}>{expired ? 'Sign-in expired' : 'Connected'}</p>
              <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-white/55">{status?.account_email || 'Your account'}{status?.last_sync_at ? ` · synced ${timeAgo(status.last_sync_at)}` : ''}</p>
            </div>
          </div>
          {status?.last_error && !expired && <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">Last sync issue: {status.last_error}</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {expired ? (
              <button onClick={onConnect} disabled={busy !== ''} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white transition hover:bg-amber-700 disabled:opacity-50">
                {busy === 'connect' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Reconnect
              </button>
            ) : (
              <button onClick={onResync} disabled={busy !== ''} className="group/b inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:bg-transparent dark:text-white">
                {busy === 'resync' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover/b:rotate-180" />} Sync now
              </button>
            )}
            <button onClick={onDisconnect} disabled={busy !== ''} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide text-gray-400 transition hover:text-red-600 disabled:opacity-50">
              {busy === 'disconnect' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mt-5 flex flex-1 flex-col">
          <ol className="mb-5 space-y-1.5">
            {steps.map((st, i) => (
              <li key={i} className="flex gap-2 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#C9A24D]/20 text-[9px] font-black text-[#8b7355] dark:text-[#e8c97a]">{i + 1}</span>{st}
              </li>
            ))}
          </ol>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onConnect} disabled={busy !== ''}
            className="lx-shine relative mt-auto inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#111827] px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_14px_30px_-16px_rgba(17,24,39,.9)] transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-white dark:text-[#111827]">
            <span className="relative inline-flex items-center gap-2">{busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Connect {name.split(' ')[0]}</span>
          </motion.button>
        </div>
      )}
    </div>
  )
}

// A sample week whose OpenHousePal events drop in one by one - what the calendar will look like.
function WeekPreview() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const events: { d: number; top: number; h: number; t: string; s: string; kind: 'fu' | 'oh' }[] = [
    { d: 0, top: 8, h: 20, t: 'Call Robin', s: '9:00', kind: 'fu' },
    { d: 1, top: 34, h: 20, t: 'Text Jamie', s: '1:00', kind: 'fu' },
    { d: 3, top: 14, h: 20, t: 'Email Alex', s: '10:30', kind: 'fu' },
    { d: 5, top: 26, h: 42, t: 'Open House', s: '1-3 PM', kind: 'oh' },
    { d: 6, top: 30, h: 36, t: 'Open House', s: '12-2', kind: 'oh' },
  ]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#C9A24D]/25 bg-white/85 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-black text-[#111827] dark:text-white">This week</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#8b7355] dark:text-[#e8c97a]"><span className="h-1.5 w-1.5 rounded-full bg-[#C9A24D]" /> OpenHousePal</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={d} className="relative h-28 rounded-lg bg-gray-50 dark:bg-white/[0.03] sm:h-32">
            <p className="pt-1 text-center text-[8px] font-black uppercase tracking-wider text-gray-400">{d}</p>
            {events.filter(e => e.d === i).map((e, k) => (
              <motion.div key={k} initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.5 + events.indexOf(e) * 0.22, type: 'spring', stiffness: 260, damping: 18 }}
                className={`absolute inset-x-0.5 overflow-hidden rounded-md px-1 py-0.5 ${e.kind === 'oh' ? 'bg-gradient-to-br from-[#C9A24D] to-[#e8c97a] text-[#111827]' : 'border-l-2 border-[#C9A24D] bg-[#C9A24D]/15 text-[#6b5a45] dark:text-[#e8c97a]'}`}
                style={{ top: `${e.top + 14}%`, height: `${e.h}%` }}>
                <p className="truncate text-[8px] font-black leading-tight">{e.t}</p>
                <p className="truncate text-[7px] font-bold opacity-75">{e.s}</p>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
