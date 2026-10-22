'use client'

// "Send from your own email" - connect Gmail or Outlook once and the emails that go to your guests
// and clients (Showcase invites, new-home updates, tour confirmations, replies, listing alerts) go
// out from your real address instead of OpenHousePal's, so they land in the inbox and show in your
// Sent folder. Your own alerts (daily digest, new-lead emails) still come from OpenHousePal. If
// your mailbox ever can't send, OpenHousePal sends that email instead - nothing is lost.
// Used on the Integrations page and as the setup flow's "Your email" step.
import { useCallback, useEffect, useState } from 'react'
import { CONNECTED_EVENT, OUTLOOK_LIVE, openSignInTab } from '@/lib/providers'
import { GoogleLogo, OutlookLogo } from '@/components/brand/ProviderLogos'
import { AlertTriangle, ArrowRight, Check, Gauge, Loader2, MailCheck, Send, ShieldCheck } from 'lucide-react'
import api, { type MailboxInfo } from '@/lib/api-service'

const GUEST_EMAILS = ['Showcase invites', 'New homes for your clients', 'Tour confirmations', 'Your replies to comments', 'Listing alerts']

export default function SendAsPanel({ back, onChange, big = false, hideRules = false }: { back?: 'setup' | 'emails'; onChange?: (m: MailboxInfo) => void; big?: boolean
  /** Studio -> Email shows the rules in its own fold-out instead. */
  hideRules?: boolean }) {
  const [info, setInfo] = useState<MailboxInfo | null>(null)
  const [busy, setBusy] = useState<'' | 'google' | 'microsoft' | 'toggle' | 'test' | 'disconnect'>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (m: MailboxInfo) => { setInfo(m); onChange?.(m) }
  const load = useCallback(() => { api.integrations.mailbox().then(r => { if (r.success && r.data) { set(r.data); if (r.data.connected) setBusy('') } }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load])
  // Setup opens the sign-in in its own tab - refresh when it finishes (or the agent comes back).
  useEffect(() => {
    if (back !== 'setup') return
    const onStorage = (e: StorageEvent) => { if (e.key === CONNECTED_EVENT) load() }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', load)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('focus', load) }
  }, [back, load])

  const connect = async (p: 'google' | 'microsoft') => {
    setBusy(p); setMsg(null)
    if (back === 'setup') {
      // Never leave setup: sign in on a new tab, this panel updates by itself.
      let error = ''
      const opened = await openSignInTab(async () => {
        const r = await api.integrations.mailboxConnectUrl(p, back)
        if (!r.success) error = r.error || ''
        return r.data?.auth_url
      })
      if (!opened) {
        setMsg({ ok: false, text: error || 'Your browser blocked the new tab - allow pop-ups for OpenHousePal, then press Connect again.' })
        setBusy('')
      } else setMsg({ ok: true, text: 'Finish signing in on the new tab - this updates by itself.' })
      return
    }
    const r = await api.integrations.mailboxConnectUrl(p, back)
    if (r.success && r.data?.auth_url) { window.location.href = r.data.auth_url; return }
    setMsg({ ok: false, text: r.error || 'That email provider can’t be connected right now - please try again later.' })
    setBusy('')
  }
  const toggle = async () => {
    if (!info) return
    setBusy('toggle')
    const r = await api.integrations.setMailboxEnabled(!info.enabled)
    if (r.success && r.data) set({ ...info, ...r.data })
    setBusy('')
  }
  const test = async () => {
    setBusy('test'); setMsg(null)
    const r = await api.integrations.testMailbox()
    if (r.success && r.data) { set({ ...info!, ...r.data }); setMsg({ ok: r.data.ok, text: r.data.detail }) }
    else setMsg({ ok: false, text: r.error || 'The test didn’t go through - please try again.' })
    setBusy('')
  }
  const disconnect = async () => {
    setBusy('disconnect'); setMsg(null)
    const r = await api.integrations.disconnectMailbox()
    if (r.success && r.data) set({ ...info!, ...r.data })
    setBusy('')
  }

  if (!info) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const pad = big ? 'p-5' : 'p-4'
  const btn = 'inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl px-5 text-[15px] font-black transition hover:-translate-y-0.5 disabled:opacity-50'

  if (!info.connected) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => connect('google')} disabled={!!busy || info.google_available === false} className={`${btn} border-2 border-[#ece5d6] bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#141416] dark:text-white`}>
            {busy === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="h-7 w-7"><GoogleLogo /></span>} Connect Gmail
          </button>
          {OUTLOOK_LIVE ? (
            <button type="button" onClick={() => connect('microsoft')} disabled={!!busy || info.microsoft_available === false} className={`${btn} border-2 border-[#ece5d6] bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#141416] dark:text-white`}>
              {busy === 'microsoft' ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="h-7 w-7"><OutlookLogo /></span>} Connect Outlook
            </button>
          ) : (
            <div className={`${btn} cursor-default border-2 border-dashed border-[#ece5d6] bg-white/60 text-gray-400 hover:translate-y-0 dark:border-white/10 dark:bg-[#141416]/60`}>
              <span className="h-7 w-7 opacity-60"><OutlookLogo /></span> Outlook <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-white/[0.06]">Coming soon</span>
            </div>
          )}
        </div>
        <p className="flex items-start gap-2 text-[13.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          We can only send - we never read your inbox. Works with Gmail and Google Workspace{OUTLOOK_LIVE ? ', Outlook and Microsoft 365' : ' (Outlook coming soon)'}.
        </p>
        <Chips />
        {msg && <p className={`text-[14px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
        {!hideRules && <InboxRules />}
      </div>
    )
  }

  const reconnect = info.status === 'needs_reconnect'
  // Paused for a reason reconnecting won't fix (agent_mailbox_service.refusal_kind): our side isn't
  // switched on yet, or their office blocks apps from sending. "Send me a test" turns it back on.
  const unavailable = info.status === 'unavailable'
  const blocked = info.status === 'blocked'
  const paused = unavailable || blocked
  const on = info.enabled && !reconnect && !paused
  return (
    <div className="space-y-4">
      <div className={`rounded-[22px] border-2 ${pad} ${reconnect ? 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10' : paused ? 'border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10' : on ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-[#ece5d6] bg-white dark:border-white/10 dark:bg-[#141416]'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-11 w-11 shrink-0">{info.provider === 'google' ? <GoogleLogo /> : <OutlookLogo />}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-black text-[#111827] dark:text-white">{info.account_email}</p>
            <p className={`text-[13px] font-bold ${reconnect ? 'text-rose-600' : paused ? 'text-amber-700 dark:text-amber-300' : on ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>
              {reconnect ? 'Needs reconnecting - guest emails are going out from OpenHousePal for now'
                : unavailable ? 'Paused on our side - guest emails are going out from OpenHousePal for now'
                : blocked ? 'Your office blocks apps from sending - guest emails are going out from OpenHousePal'
                : on ? `Client emails go out from you${info.total_sent ? ` · ${info.total_sent} sent so far` : ''}` : 'Switched off - client emails go out from OpenHousePal'}
            </p>
          </div>
          {!reconnect && !paused && (
            <button type="button" role="switch" aria-checked={info.enabled} aria-label="Send my guest emails from this address" onClick={toggle} disabled={busy === 'toggle'}
              className={`relative h-8 w-14 shrink-0 rounded-full transition ${info.enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${info.enabled ? 'left-7' : 'left-1'}`} />
            </button>
          )}
        </div>
        {reconnect && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="flex flex-1 items-start gap-2 text-[13.5px] font-semibold text-rose-700 dark:text-rose-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Your email account stopped letting us send (a password change or removed permission does this).</p>
            <button type="button" onClick={() => connect(info.provider || 'google')} disabled={!!busy} className={`${btn} bg-[#111827] text-white dark:bg-white dark:text-[#111827]`}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Reconnect</button>
          </div>
        )}
        {paused && (
          <p className="mt-3 flex items-start gap-2 text-[13.5px] font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {unavailable
              ? 'Sending from your email isn’t switched on on our side yet. Nothing for you to do - once it is, press “Send me a test” and it turns back on.'
              : 'Your email account doesn’t let apps send for you - usually a setting your office (Google Workspace / Microsoft 365) controls. Ask your IT team to allow OpenHousePal, or disconnect and connect a personal email instead. Press “Send me a test” to try again.'}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={test} disabled={!!busy || reconnect} className={`${btn} h-11 bg-[#111827] text-[14px] text-white dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]`}>
          {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send me a test
        </button>
        <button type="button" onClick={disconnect} disabled={!!busy} className="h-11 rounded-2xl px-4 text-[13px] font-black text-gray-500 underline-offset-4 hover:text-rose-600 hover:underline">Disconnect</button>
      </div>
      {msg && <p className={`flex items-start gap-2 text-[14px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}{msg.text}</p>}
      <Chips />
      {!hideRules && <InboxRules />}
    </div>
  )
}

/** The sending rules (backend client_email_service + showcase_digest_service) in plain words -
 * agents need to trust their own Gmail / Outlook won't end up in spam, so this says exactly how
 * often a client can hear from them and why. Keep it in step with those two services. */
export function InboxRules() {
  const often: { b: string; t: string }[] = [
    { b: 'One update a day, at most.', t: 'Every new home and price drop for a client is rolled into one email at 4:30 PM - never one email per home.' },
    { b: 'Nothing new? No email.', t: 'Quiet days send nothing at all.' },
    { b: 'The only time there can be a 2nd:', t: 'a home they asked to follow on one of your Spotlight pages changes price, gets an open house, or goes under contract (checked once a day too). Even then, never more than 2 automatic emails in a day - sent apart, not together.' },
    { b: 'Emails they asked for always go:', t: 'the thank-you after signing in at your open house, a tour confirmation, your reply to their comment, or a Showcase you send them yourself. These only happen when they (or you) just did something.' },
  ]
  const backoff = [
    'Someone who leaves your emails unopened on 3 different days drops to one email a week.',
    'If they also skip 3 weekly emails, automatic emails to them stop. Their lead card tells you why.',
    'Their Showcase then goes to sleep (Showcases -> Inactive) - unless you starred it, or in the last 2 weeks opened it or worked that lead. You still get its updates while it\'s awake.',
    'The moment they open one or use their Showcase, daily updates turn back on by themselves (a sleeping Showcase wakes up too).',
    'Your 4:30 emails go out a few seconds apart, never in one burst - bursts look like spam. Every update has a one-click unsubscribe.',
  ]
  return (
    <div data-testid="inbox-rules" className="rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] p-4 sm:p-5 dark:border-[#e8c97a]/20 dark:bg-[#C9A24D]/10">
      <p className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#e8c97a]"><Gauge className="h-3.5 w-3.5" /> Smart sending keeps you out of junk</p>
      <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-gray-600 dark:text-gray-300">Gmail and Outlook decide who to trust by how often you email and whether people open it. So we send far less than you&apos;d think - the same rules whether your emails go from you or from OpenHousePal.</p>
      <p className="mt-3.5 text-[12px] font-black uppercase tracking-[0.14em] text-[#111827] dark:text-white">How often a client hears from you</p>
      <ul className="mt-2 space-y-2">
        {often.map(r => (
          <li key={r.b} className="flex items-start gap-2 text-[13px] leading-snug text-gray-700 dark:text-gray-200">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span><b className="font-black text-[#111827] dark:text-white">{r.b}</b> {r.t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3.5 text-[12px] font-black uppercase tracking-[0.14em] text-[#111827] dark:text-white">If someone stops opening</p>
      <ul className="mt-2 space-y-1.5">
        {backoff.map(r => (
          <li key={r} className="flex items-start gap-2 text-[13px] font-semibold leading-snug text-[#111827] dark:text-white">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {r}
          </li>
        ))}
      </ul>
      {/* a plain new-tab link: this sits inside setup, which must never be left */}
      <a href="/leads/emails" target="_blank" rel="noreferrer" className="mt-3.5 inline-flex items-center gap-1 text-[12.5px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
        See every email, who opened it and who&apos;s on weekly <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}

function Chips() {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-gray-400"><MailCheck className="h-3.5 w-3.5" /> Sent from you</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {GUEST_EMAILS.map(g => <span key={g} className="rounded-full border border-[#C9A24D]/30 bg-white px-3 py-1 text-[12.5px] font-bold text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white">{g}</span>)}
      </div>
      <p className="mt-2 text-[12.5px] font-medium text-gray-500 dark:text-gray-400">Your own alerts (daily digest, new-lead emails) still come from OpenHousePal. If your email ever can&apos;t send, OpenHousePal sends it instead - nothing gets lost.</p>
    </div>
  )
}
