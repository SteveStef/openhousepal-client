'use client'

// Client email tracking + the daily / weekly / off rules (backend client_email_service), shown in
// three places: the Emails page (/leads/emails), each lead's card, and the Leads list.
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Check, ChevronDown, Loader2, Mail, MailCheck, MailOpen, MailX, MousePointerClick, Send } from 'lucide-react'
import api from '@/lib/api-service'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import OhSheet from '@/components/open-house-manager/OhSheet'
import LuxeSelect from '@/components/ui/LuxeSelect'
import Pager from '@/components/ui/Pager'
import { useToast } from '@/contexts/ToastContext'
import { timeAgo } from '@/lib/leadActivity'
import type { ClientEmailRow, EmailAboutHome, EmailMode, EmailPerson } from '@/types'
import { HomeChip } from '@/components/leads/InterestNudge'

export const MODE_META: Record<EmailMode, { label: string; short: string; icon: typeof Mail; pill: string }> = {
  daily: { label: 'Emails on', short: 'On', icon: MailCheck, pill: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
  weekly: { label: 'Weekly only', short: 'Weekly', icon: CalendarClock, pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' },
  biweekly: { label: 'Every 2 weeks', short: '2 weeks', icon: CalendarClock, pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' },
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
  // Blocked by them or their mailbox - a switch here couldn't do anything, so say what can.
  if (p.code === 'unsubscribed' || p.code === 'bounced' || p.code === 'spam') {
    return <span className="text-[11px] font-semibold text-gray-400">{p.code === 'bounced' ? 'Fix their email address to send again'
      : p.code === 'spam' ? 'They marked you as spam - emails stay off' : 'Only they can turn emails back on'}</span>
  }
  const turnOn = p.mode === 'off' || (p.mode !== 'daily' && p.code !== 'chosen')
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

/** What happened to one sent email, in a few words - the same everywhere (lead view, Emails page).
 *  Spam / bounce / blocked come from Mailgun's webhooks; nobody can see the spam folder itself. */
export function deliveryState(e: ClientEmailRow): { tone: 'rose' | 'amber' | 'emerald' | 'gray'; text: string } | null {
  if (e.delivery === 'spam') return { tone: 'rose', text: 'Marked as spam by them' }
  if (e.status === 'failed') return { tone: 'rose', text: `Didn't go through${e.error || e.delivery_note ? ` - ${e.error || e.delivery_note}` : ''}` }
  if (e.delivery === 'delayed' && !e.opened_at) return { tone: 'amber', text: 'Delayed - their email server is slow, retrying' }
  if (e.opened_at) return null
  return { tone: 'gray', text: e.delivery === 'delivered' ? 'Delivered - not opened yet' : 'Not opened yet' }
}

/** "3 times" / "twice" / "once". */
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** Opened up: the homes the email showed (or, for older emails, the homes they looked at after it),
 *  and how many times they opened / clicked it (owner, 11/13). */
function EmailWhatItShowed({ e }: { e: ClientEmailRow }) {
  const [d, setD] = useState<(ClientEmailRow & { viewed_after: EmailAboutHome[] }) | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    api.clientEmails.detail(e.id).then(r => { if (!live) return; if (r.success && r.data) setD(r.data); else setFailed(true) })
    return () => { live = false }
  }, [e.id])
  const about = d?.about?.length ? d.about : (e.about || [])
  const viewed = !about.length ? (d?.viewed_after || []) : []
  const homes = about.length ? about : viewed
  return (
    <div className="mt-2 rounded-xl border border-gray-100 bg-[#faf9f7] p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]" data-testid="email-what-it-showed">
      {(e.open_count > 0 || e.click_count > 0) && (
        <p className="mb-2 text-[11.5px] font-bold text-[#5c4a2e] dark:text-[#e8c97a]/90">
          {e.open_count > 0 && <>Opened {times(e.open_count)}</>}
          {e.open_count > 0 && e.click_count > 0 && ' · '}
          {e.click_count > 0 && <>clicked {times(e.click_count)}</>}
          {e.last_engaged_at && <span className="font-semibold text-gray-500 dark:text-gray-400"> · last {timeAgo(e.last_engaged_at)}</span>}
        </p>
      )}
      {!d && !failed && !about.length ? (
        <div className="flex items-center gap-2 py-2 text-[11px] font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking it up…</div>
      ) : homes.length > 0 ? (
        <>
          <p className="mb-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#e8c97a]">
            {about.length ? 'Homes in this email' : 'Homes they looked at after it'}
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {homes.slice(0, 6).map((h, k) => <HomeChip key={k} h={h} viewed={!about.length} />)}
          </div>
          {homes.length > 6 && <p className="mt-1 text-[10.5px] font-bold text-gray-400">+ {homes.length - 6} more</p>}
        </>
      ) : (
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {e.opened_at ? 'This email didn’t list homes, and they haven’t looked at any homes since it went out.' : 'Not opened yet.'}
        </p>
      )}
    </div>
  )
}

/** One sent email: what, when, opened / clicked - tap it to see what it showed. */
export function EmailRowLine({ e, showTo = false }: { e: ClientEmailRow; showTo?: boolean }) {
  const [open, setOpen] = useState(false)
  const canOpen = e.status !== 'failed'
  return (
    <div className="min-w-0">
    <div role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined} aria-expanded={canOpen ? open : undefined}
      onClick={canOpen ? () => setOpen(v => !v) : undefined}
      onKeyDown={canOpen ? ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setOpen(v => !v) } } : undefined}
      data-testid="email-row" className={`flex min-w-0 items-start gap-3 ${canOpen ? 'cursor-pointer' : ''}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${e.clicked_at ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300'
        : e.opened_at ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
          : (e.status === 'failed' || e.delivery === 'spam') ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06]'}`}>
        {e.clicked_at ? <MousePointerClick className="h-3.5 w-3.5" /> : e.opened_at ? <MailOpen className="h-3.5 w-3.5" /> : (e.status === 'failed' || e.delivery === 'spam') ? <MailX className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-black leading-snug text-[#111827] dark:text-white">{e.subject || e.label}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {showTo && <>{e.name || e.to} · </>}
          {sentence(e.label)} · {e.via === 'mailbox' ? 'from your email' : 'from OpenHousePal'}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-bold">
          <span className="text-gray-400">{e.status === 'failed' ? 'Tried' : 'Sent'} {timeAgo(e.sent_at || e.created_at) || '-'}</span>
          {e.opened_at && e.delivery !== 'spam' && <span className="text-emerald-600 dark:text-emerald-300">Opened {timeAgo(e.opened_at)}{e.open_count > 1 ? ` · ${e.open_count}×` : ''}</span>}
          {(() => {
            const d = deliveryState(e)
            if (!d) return null
            const c = d.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : d.tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : 'text-gray-400'
            return <span className={c} title={e.delivery_note || e.error || undefined}>{d.text}</span>
          })()}
          {e.clicked_at && <span className="text-sky-600 dark:text-sky-300">Clicked {timeAgo(e.clicked_at)}{e.click_count > 1 ? ` · ${e.click_count}×` : ''}</span>}
        </p>
      </div>
      {canOpen && <ChevronDown aria-hidden className={`mt-1 h-4 w-4 shrink-0 text-gray-300 transition-transform duration-200 dark:text-white/30 ${open ? 'rotate-180 text-[#C9A24D]' : ''}`} />}
    </div>
    <AnimatePresence initial={false}>
      {open && (
        <motion.div key="what" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="overflow-hidden pl-11">
          <EmailWhatItShowed e={e} />
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  )
}

/** The "Emails" card on a lead: are automatic emails on, why not, and the last few emails. */
export function LeadEmailCard({ email, initial }: { email?: string | null; initial?: EmailPerson | null }) {
  const [person, setPerson] = useState<EmailPerson | null>(initial || null)
  const [rows, setRows] = useState<ClientEmailRow[] | null>(null)
  const [allOpen, setAllOpen] = useState(false)
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
      <EmailFrequencySelect person={p} onChanged={setPerson} className="mt-2.5" />
      {p.mode !== 'daily' && p.reason && (
        <p className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold leading-relaxed ${p.mode !== 'off' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'}`}>
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
      <button type="button" onClick={() => setAllOpen(true)} data-testid="lead-all-emails" className="mt-3 inline-flex text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
        All emails →
      </button>
      <PersonEmailsSheet email={allOpen ? email : null} onClose={() => setAllOpen(false)} />
    </section>
  )
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', hint: 'Slows down by itself if they stop opening' },
  { value: 'weekly', label: 'Weekly', hint: 'Stays weekly, opened or not' },
  { value: 'biweekly', label: 'Every 2 weeks', hint: 'Stays every 2 weeks, opened or not' },
] as const
type Frequency = (typeof FREQUENCY_OPTIONS)[number]['value']

/** How often this person gets automatic emails (owner, 11/07). Pass `person` when it's already loaded,
 *  or `email` to read it. Daily runs the normal rules from today; weekly and every 2 weeks stay put. */
export function EmailFrequencySelect({ person, email, onChanged, className = '', compact = false, pill = false, align = 'left', sheetTitle }: {
  person?: EmailPerson; email?: string | null; onChanged?: (next: EmailPerson) => void; className?: string; compact?: boolean
  /** A small round picker that sits inside another control (the Showcase's email switches). */
  pill?: boolean
  align?: 'left' | 'right'
  /** Phones: the choices open as a pull-up sheet with this title. */
  sheetTitle?: string
}) {
  const { showToast } = useToast()
  const [loaded, setLoaded] = useState<EmailPerson | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (person || !email) return
    let live = true
    api.clientEmails.status(email).then(r => { if (live && r.success && r.data) setLoaded({ ...r.data, email }) })
    return () => { live = false }
  }, [person, email])
  const p = person || loaded
  if (!p || p.code === 'unsubscribed' || p.code === 'bounced' || p.code === 'spam' || p.code === 'lead_deleted') return null
  const value = p.frequency || (p.mode === 'off' ? 'off' : p.mode)
  const go = async (v: string) => {
    if (v === value || v === 'off') return
    setSaving(true)
    const r = await api.clientEmails.setFrequency(p.email, v as Frequency)
    setSaving(false)
    if (r.success && r.data) {
      const next = { ...p, ...r.data }
      setLoaded(next); onChanged?.(next)
      showToast(`Emails set to ${FREQUENCY_OPTIONS.find(o => o.value === v)?.label.toLowerCase()}`, 'success')
    } else showToast(r.error || "Couldn't change that - try again", 'error')
  }
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="email-frequency">
      {!compact && !pill && <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">How often</span>}
      <LuxeSelect<string>
        className={pill ? 'w-[88px] sm:w-[118px] [&>button]:h-7 [&>button]:rounded-full [&>button]:border-[#C9A24D]/40 [&>button]:bg-white [&>button]:px-2.5 [&>button]:py-0 [&>button]:text-[11px] dark:[&>button]:bg-white/5' : compact ? 'w-[132px]' : 'w-[150px]'}
        ariaLabel="How often they get automatic emails"
        value={value}
        onChange={go}
        align={align}
        sheetOnPhone={pill}
        sheetTitle={sheetTitle}
        menuWidth={260}
        options={[...FREQUENCY_OPTIONS.map(o => ({ value: o.value as string, label: o.label, hint: o.hint })), ...(value === 'off' ? [{ value: 'off', label: 'Off', hint: 'No automatic emails right now' }] : [])]}
      />
    </div>
  )
}

const LOG_PAGE = 20

/** One person's emails, opened over the page you're on (owner, 11/07: no separate log page). */
export function PersonEmailsSheet({ email, name, onClose }: { email: string | null; name?: string | null; onClose: () => void }) {
  const [shownFor, setShownFor] = useState<string | null>(null)
  const [rows, setRows] = useState<ClientEmailRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  useEffect(() => { if (email) { setShownFor(email); setPage(1) } }, [email])
  useEffect(() => {
    if (!email) return
    let live = true
    setRows(null)
    api.clientEmails.log({ email, limit: LOG_PAGE, offset: (page - 1) * LOG_PAGE }).then(r => {
      if (!live) return
      if (r.success && r.data) { setRows(r.data.emails); setTotal(r.data.total) } else setRows([])
    })
    return () => { live = false }
  }, [email, page])
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE))
  return (
    <OhSheet open={!!email} onClose={onClose} width="max-w-xl" title="Their emails" subtitle={name || shownFor || undefined} icon={<Mail className="h-5 w-5" />}>
      <div data-testid="person-emails">
        {rows === null ? (
          <div className="flex min-h-[200px] items-center justify-center"><OhpSpinner size={28} label="Loading emails" /></div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">No emails sent to them yet.</p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="space-y-3">
              {rows.map(e => <EmailRowLine key={e.id} e={e} />)}
            </motion.div>
          </AnimatePresence>
        )}
        {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} prevLabel="Newer" nextLabel="Older" className="mt-4" />}
      </div>
    </OhSheet>
  )
}
