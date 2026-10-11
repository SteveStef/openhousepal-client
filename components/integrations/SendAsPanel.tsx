'use client'

// "Send from your own email" - connect Gmail or Outlook once and the emails that go to your guests
// and clients (Showcase invites, new-home updates, tour confirmations, replies, listing alerts) go
// out from your real address instead of OpenHousePal's, so they land in the inbox and show in your
// Sent folder. Your own alerts (daily digest, new-lead emails) still come from OpenHousePal. If
// your mailbox ever can't send, OpenHousePal sends that email instead - nothing is lost.
// Used on the Integrations page and as the setup flow's "Your email" step.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Check, Gauge, Loader2, MailCheck, Send, ShieldCheck } from 'lucide-react'
import api, { type MailboxInfo } from '@/lib/api-service'

const GUEST_EMAILS = ['Showcase invites', 'New homes for your clients', 'Tour confirmations', 'Your replies to comments', 'Listing alerts']

export default function SendAsPanel({ back, onChange, big = false }: { back?: 'setup' | 'emails'; onChange?: (m: MailboxInfo) => void; big?: boolean }) {
  const [info, setInfo] = useState<MailboxInfo | null>(null)
  const [busy, setBusy] = useState<'' | 'google' | 'microsoft' | 'toggle' | 'test' | 'disconnect'>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (m: MailboxInfo) => { setInfo(m); onChange?.(m) }
  useEffect(() => { api.integrations.mailbox().then(r => { if (r.success && r.data) set(r.data) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async (p: 'google' | 'microsoft') => {
    setBusy(p); setMsg(null)
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
            {busy === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-[15px] font-black text-[#4285F4]">G</span>} Connect Gmail
          </button>
          <button type="button" onClick={() => connect('microsoft')} disabled={!!busy || info.microsoft_available === false} className={`${btn} border-2 border-[#ece5d6] bg-white text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#141416] dark:text-white`}>
            {busy === 'microsoft' ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0078D4] text-[15px] font-black text-white">O</span>} Connect Outlook
          </button>
        </div>
        <p className="flex items-start gap-2 text-[13.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          We can only send - we never read your inbox. Works with Gmail, Google Workspace, Outlook and Microsoft 365.
        </p>
        <Chips />
        {msg && <p className={`text-[14px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
        <InboxRules />
      </div>
    )
  }

  const reconnect = info.status === 'needs_reconnect'
  const on = info.enabled && !reconnect
  return (
    <div className="space-y-4">
      <div className={`rounded-[22px] border-2 ${pad} ${reconnect ? 'border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10' : on ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-[#ece5d6] bg-white dark:border-white/10 dark:bg-[#141416]'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[18px] font-black ${info.provider === 'google' ? 'border border-gray-200 bg-white text-[#4285F4]' : 'bg-[#0078D4] text-white'}`}>{info.provider === 'google' ? 'G' : 'O'}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-black text-[#111827] dark:text-white">{info.account_email}</p>
            <p className={`text-[13px] font-bold ${reconnect ? 'text-rose-600' : on ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>
              {reconnect ? 'Needs reconnecting - guest emails are going out from OpenHousePal for now' : on ? `Client emails go out from you${info.total_sent ? ` · ${info.total_sent} sent so far` : ''}` : 'Switched off - client emails go out from OpenHousePal'}
            </p>
          </div>
          {!reconnect && (
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={test} disabled={!!busy || reconnect} className={`${btn} h-11 bg-[#111827] text-[14px] text-white dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]`}>
          {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send me a test
        </button>
        <button type="button" onClick={disconnect} disabled={!!busy} className="h-11 rounded-2xl px-4 text-[13px] font-black text-gray-500 underline-offset-4 hover:text-rose-600 hover:underline">Disconnect</button>
      </div>
      {msg && <p className={`flex items-start gap-2 text-[14px] font-bold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}{msg.text}</p>}
      <Chips />
      <InboxRules />
    </div>
  )
}

/** The engagement rules (backend client_email_service) in plain words - they protect both the
 * agent's own Gmail / Outlook and OpenHousePal's sending reputation. */
export function InboxRules() {
  const rules = [
    'Someone who leaves your emails unopened on 3 different days gets one weekly email instead of daily updates.',
    'If they also skip 3 weekly emails, automatic emails to them stop. Their lead card says why.',
    'The moment they open an email or use their Showcase, daily updates turn back on by themselves.',
    'Never more than 2 automatic emails a day to one person, sent a little apart instead of all at once.',
    'Tour confirmations and your replies always go out.',
  ]
  return (
    <div data-testid="inbox-rules" className="rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] p-4 dark:border-[#e8c97a]/20 dark:bg-[#C9A24D]/10">
      <p className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#e8c97a]"><Gauge className="h-3.5 w-3.5" /> Smart sending keeps you out of junk</p>
      <p className="mt-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-300">Inboxes trust senders whose emails get opened. So we automatically ease off people who stop opening, whether your emails go from you or from OpenHousePal:</p>
      <ul className="mt-2 space-y-1.5">
        {rules.map(r => (
          <li key={r} className="flex items-start gap-2 text-[13px] font-semibold leading-snug text-[#111827] dark:text-white">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {r}
          </li>
        ))}
      </ul>
      <Link href="/leads/emails" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
        See every email, who opened it and who&apos;s on weekly <ArrowRight className="h-3.5 w-3.5" />
      </Link>
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
