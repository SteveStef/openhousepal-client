'use client'

// Client email tracking + the daily / weekly / off rules (backend client_email_service), shown in
// three places: the Emails page (/leads/emails), each lead's card, and the Leads list.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Check, Loader2, Mail, MailCheck, MailOpen, MailX, MousePointerClick, Send } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { timeAgo } from '@/lib/leadActivity'
import type { ClientEmailRow, EmailMode, EmailPerson } from '@/types'

export const MODE_META: Record<EmailMode, { label: string; short: string; icon: typeof Mail; pill: string }> = {
  daily: { label: 'Emails on', short: 'On', icon: MailCheck, pill: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
  weekly: { label: 'Weekly only', short: 'Weekly', icon: CalendarClock, pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' },
  off: { label: 'Emails off', short: 'Off', icon: MailX, pill: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300' },
}

export function ModePill({ mode, code, className = '' }: { mode: EmailMode; code?: string; className?: string }) {
  const m = MODE_META[mode] || MODE_META.daily
  const label = code === 'unsubscribed' ? 'Unsubscribed' : m.label
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${m.pill} ${className}`}>
      <m.icon className="h-3 w-3" /> {label}
    </span>
  )
}

/** "Sent 12 · Opened 8 · Clicked 3" */
export function EngagementLine({ p, className = '' }: { p: EmailPerson; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-bold text-gray-500 dark:text-gray-400 ${className}`}>
      <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> {p.sent} sent</span>
      <span className="inline-flex items-center gap-1"><MailOpen className="h-3 w-3" /> {p.opened} opened</span>
      <span className="inline-flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {p.clicked} clicked</span>
      {p.rate != null && <span className={`rounded-full px-1.5 py-px text-[10px] font-black tabular-nums ${rateTone(p.rate)}`}>{p.rate}% open</span>}
    </span>
  )
}

/** "daily Showcase update" -> "Daily Showcase update" (Tailwind's capitalize would do every word). */
export const sentence = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

export function rateTone(rate: number) {
  if (rate >= 50) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
  if (rate >= 20) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
  return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
}

/** Turn automatic emails off for one person, or back on (which restarts the unopened count). */
export function PersonSwitch({ p, onChanged, size = 'sm' }: { p: EmailPerson; onChanged: (next: EmailPerson) => void; size?: 'sm' | 'md' }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  if (p.code === 'unsubscribed') {
    return <span className="text-[11px] font-semibold text-gray-400">Only they can turn emails back on</span>
  }
  const turnOn = p.mode !== 'daily'
  const go = async () => {
    setBusy(true)
    const r = await api.clientEmails.setPerson(p.email, turnOn)
    setBusy(false)
    if (r.success && r.data) {
      onChanged({ ...p, ...r.data })
      showToast(turnOn ? 'Emails turned back on' : 'Automatic emails turned off', 'success')
    } else showToast(r.error || 'Could not change that - try again', 'error')
  }
  const cls = size === 'md' ? 'px-3.5 py-2 text-xs' : 'px-2.5 py-1.5 text-[11px]'
  return (
    <button type="button" onClick={go} disabled={busy}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-black transition disabled:opacity-60 ${cls} ${turnOn
        ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] hover:bg-[#C9A24D]/20 dark:text-[#e8c97a]'
        : 'border-gray-200 bg-white text-gray-600 hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300'}`}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : turnOn ? <Check className="h-3.5 w-3.5" /> : <MailX className="h-3.5 w-3.5" />}
      {turnOn ? 'Turn back on' : 'Turn off'}
    </button>
  )
}

/** One sent email: what, when, opened / clicked. */
export function EmailRowLine({ e, showTo = false }: { e: ClientEmailRow; showTo?: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${e.clicked_at ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300'
        : e.opened_at ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
          : e.status === 'failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06]'}`}>
        {e.clicked_at ? <MousePointerClick className="h-3.5 w-3.5" /> : e.opened_at ? <MailOpen className="h-3.5 w-3.5" /> : e.status === 'failed' ? <MailX className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-black leading-snug text-[#111827] dark:text-white">{e.subject || e.label}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {showTo && <>{e.name || e.to} · </>}
          {sentence(e.label)} · {e.via === 'mailbox' ? 'from your email' : 'from OpenHousePal'}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-bold">
          <span className="text-gray-400">Sent {timeAgo(e.sent_at) || '-'}</span>
          {e.status === 'failed'
            ? <span className="text-rose-600 dark:text-rose-300">Didn&apos;t go through</span>
            : e.opened_at
              ? <span className="text-emerald-600 dark:text-emerald-300">Opened {timeAgo(e.opened_at)}{e.open_count > 1 ? ` · ${e.open_count}×` : ''}</span>
              : <span className="text-gray-400">Not opened yet</span>}
          {e.clicked_at && <span className="text-sky-600 dark:text-sky-300">Clicked {timeAgo(e.clicked_at)}{e.click_count > 1 ? ` · ${e.click_count}×` : ''}</span>}
        </p>
      </div>
    </div>
  )
}

/** The "Emails" card on a lead: are automatic emails on, why not, and the last few emails. */
export function LeadEmailCard({ email, initial }: { email?: string | null; initial?: EmailPerson | null }) {
  const [person, setPerson] = useState<EmailPerson | null>(initial || null)
  const [rows, setRows] = useState<ClientEmailRow[] | null>(null)
  const load = useCallback(async () => {
    if (!email) return
    const r = await api.clientEmails.log({ email, limit: 4 })
    if (r.success && r.data) setRows(r.data.emails)
  }, [email])
  useEffect(() => { setPerson(initial || null) }, [initial])
  useEffect(() => { load() }, [load])
  if (!email) return null
  const p: EmailPerson = person || { email, mode: 'daily', sent: 0, opened: 0, clicked: 0, rate: null, code: 'ok' }
  return (
    <section data-testid="lead-email-card" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#151517]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-sm font-black text-[#111827] dark:text-white"><Mail className="h-4 w-4 text-[#C9A24D]" /> Emails</h3>
        <ModePill mode={p.mode} code={p.code} />
      </div>
      {p.mode !== 'daily' && p.reason && (
        <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold leading-relaxed ${p.mode === 'weekly' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'}`}>
          <b>Why:</b> {p.reason}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        {p.sent > 0 ? <EngagementLine p={p} /> : <span className="text-xs font-semibold text-gray-400">No emails sent to them yet.</span>}
        <PersonSwitch p={p} onChanged={setPerson} />
      </div>
      {rows && rows.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
          {rows.map(e => <EmailRowLine key={e.id} e={e} />)}
        </div>
      )}
      <Link href={`/leads/emails?email=${encodeURIComponent(email)}`} className="mt-3 inline-flex text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
        All emails & how the rules work →
      </Link>
    </section>
  )
}
