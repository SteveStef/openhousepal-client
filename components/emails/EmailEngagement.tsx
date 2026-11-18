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
  // The date is in the label itself (owner, 11/18): "Not opened yet" alone didn't say since when.
  const at = emailDay(e.delivery_at || e.sent_at || e.created_at, false)
  return { tone: 'gray', text: e.delivery === 'delivered' ? `Delivered ${at} - not opened yet` : `Not opened yet (sent ${at})` }
}

/** "3 times" / "twice" / "once". */
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** "Today, Nov 18 · 4:31 PM", "Yesterday, Nov 17", "Mon, Nov 16 · 4:31 PM", "Mon, Nov 16, 2025" - always the
 *  real date, never just "Mon" (owner, 11/18). */
export function emailDay(iso?: string | null, withTime = true): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const now = new Date()
  const day0 = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((day0(now) - day0(d)) / 864e5)
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
  const lead = days === 0 ? 'today' : days === 1 ? 'yesterday' : d.toLocaleDateString(undefined, { weekday: 'short' })
  const time = withTime ? ` · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''
  return `${lead}, ${md}${time}`
}
const capDay = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Smooth, no bounce (owner, 11/18): a plain ease-out that never passes its end point.
const EASE = [0.22, 1, 0.36, 1] as const
export const SMOOTH = { height: { duration: 0.28, ease: EASE }, opacity: { duration: 0.2, ease: EASE } }

const KIND_TAG: Record<string, { text: string; cls: string }> = {
  new: { text: 'New match', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  price_drop: { text: 'Price drop', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  price_change: { text: 'Price change', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  picked: { text: 'Picked for them', cls: 'bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]' },
  sold: { text: 'Sold', cls: 'bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-gray-200' },
  pending: { text: 'Under contract', cls: 'bg-gray-100 text-gray-700 dark:bg-white/[0.08] dark:text-gray-200' },
  open_house: { text: 'Open house', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
}

/** One home in an email: photo, street, what it was (new match / price drop $X → $Y). */
function EmailHome({ h }: { h: EmailAboutHome }) {
  const [ok, setOk] = useState(false)
  const tag = KIND_TAG[h.kind || (h.is_price_drop ? 'price_drop' : '')]
  const drop = h.kind === 'price_drop' || h.kind === 'price_change' || h.is_price_drop
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200/80 bg-white p-1.5 pr-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]" data-testid="email-home">
      <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#efe6d4] to-[#d9c7a3] dark:from-[#1d1a14] dark:to-[#2a2218]">
        {h.image && <img src={h.image} alt="" loading="lazy" decoding="async" onLoad={() => setOk(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${ok ? 'opacity-100' : 'opacity-0'}`} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-black leading-tight text-[#111827] dark:text-white">{(h.street_address || '').split(',')[0]}</span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] font-bold text-gray-500 dark:text-gray-400">
          {tag && <span className={`rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wide ${tag.cls}`}>{tag.text}</span>}
          {drop && h.old_price && h.new_price ? <span><s className="opacity-60">{h.old_price}</s> → <span className="text-rose-600 dark:text-rose-400">{h.new_price}</span></span>
            : drop && (h.new_price || h.price) ? <span className="text-rose-600 dark:text-rose-400">now {h.new_price || h.price}</span>
              : h.price ? <span>{h.price}</span> : null}
        </span>
      </span>
    </span>
  )
}

/** Opened up: what the email had in it - its homes, which were new matches and which were price
 *  changes, how many - for opened AND unopened emails, and how they treated it (owner, 11/13 + 11/18).
 *  Older emails that kept nothing fall back to the homes they looked at after it. */
export function EmailWhatItShowed({ e }: { e: ClientEmailRow }) {
  const [d, setD] = useState<(ClientEmailRow & { viewed_after: EmailAboutHome[] }) | null>(null)
  const [failed, setFailed] = useState(false)
  const known = e.contents !== undefined   // the list already worked it out - no wait
  useEffect(() => {
    if (known && (e.contents?.homes?.length || 0) > 0) return
    let live = true
    api.clientEmails.detail(e.id).then(r => { if (!live) return; if (r.success && r.data) setD(r.data); else setFailed(true) })
    return () => { live = false }
  }, [e.id, known, e.contents])
  const c = d?.contents || e.contents || null
  const homes: EmailAboutHome[] = c?.homes?.length ? c.homes : (e.about || [])
  const viewed = !homes.length ? (d?.viewed_after || []) : []
  const loading = !homes.length && !d && !failed
  const counts = c ? [c.new_count ? `${c.new_count} new ${c.new_count === 1 ? 'match' : 'matches'}` : '', c.drop_count ? `${c.drop_count} price ${c.drop_count === 1 ? 'drop' : 'drops'}` : '',
    !c.new_count && !c.drop_count && c.home_count > 1 ? `${c.home_count} homes` : ''].filter(Boolean) : []
  const more = c && c.home_count > homes.length ? c.home_count - homes.length : 0
  return (
    <div className="mt-2 rounded-xl border border-gray-100 bg-[#faf9f7] p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]" data-testid="email-what-it-showed">
      <dl className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-3" data-testid="email-stats">
        <Stat k="Sent" v={capDay(emailDay(e.sent_at || e.created_at))} />
        <Stat k="Opened" v={e.opened_at ? `${capDay(times(e.open_count || 1))}, first ${emailDay(e.opened_at)}` : 'Not yet'} tone={e.opened_at ? 'emerald' : undefined} />
        <Stat k="Clicked" v={e.clicked_at ? `${capDay(times(e.click_count || 1))}, first ${emailDay(e.clicked_at)}` : 'Not yet'} tone={e.clicked_at ? 'sky' : undefined} />
        {e.last_engaged_at && (e.open_count + e.click_count > 1) && <Stat k="Last looked" v={capDay(emailDay(e.last_engaged_at))} />}
        <Stat k="From" v={e.via === 'mailbox' ? 'Your email' : 'OpenHousePal'} />
        <Stat k="Kind" v={e.kind === 'auto' ? 'Automatic' : 'Personal'} />
      </dl>
      {loading ? (
        <div className="flex min-h-[56px] items-center gap-2 text-[11px] font-bold text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking it up…</div>
      ) : homes.length > 0 ? (
        <>
          <p className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[9.5px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#e8c97a]">
            <span>{homes.length === 1 && (c?.home_count || 1) <= 1 ? 'The home in this email' : 'Homes in this email'}</span>
            {counts.length > 0 && <span className="normal-case tracking-normal text-[11px] font-bold text-gray-500 dark:text-gray-400" data-testid="email-counts">{counts.join(' · ')}</span>}
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {homes.slice(0, 6).map((h, k) => <EmailHome key={k} h={h} />)}
          </div>
          {(homes.length > 6 || more > 0) && <p className="mt-1 text-[10.5px] font-bold text-gray-400">+ {Math.max(homes.length - 6, 0) + more} more in their Showcase</p>}
          {c?.source === 'rebuilt' && <p className="mt-1 text-[10px] font-semibold text-gray-400">An older email - these are the homes that came into their Showcase just before it went out.</p>}
        </>
      ) : c?.summary ? (
        <p className="text-[11.5px] font-bold text-[#5c4a2e] dark:text-[#e8c97a]/90">{c.summary}</p>
      ) : viewed.length > 0 ? (
        <>
          <p className="mb-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#e8c97a]">Homes they looked at after it</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{viewed.slice(0, 6).map((h, k) => <HomeChip key={k} h={h} viewed />)}</div>
        </>
      ) : (
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          This older email didn&apos;t keep a copy of what it showed{e.opened_at ? ', and they haven’t looked at any homes since it went out' : ''}.
        </p>
      )}
    </div>
  )
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'emerald' | 'sky' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{k}</dt>
      <dd className={`break-words font-bold leading-snug ${tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : tone === 'sky' ? 'text-sky-700 dark:text-sky-300' : 'text-[#111827] dark:text-gray-200'}`} title={v}>{v}</dd>
    </div>
  )
}

/** The row's picture (owner, 11/18): a new match's photo, else the price-changed home, else the email icon. */
function EmailThumb({ e }: { e: ClientEmailRow }) {
  const [ok, setOk] = useState(false)
  const photo = e.contents?.photo
  const badge = e.clicked_at ? { cls: 'bg-sky-500', icon: MousePointerClick } : e.opened_at ? { cls: 'bg-emerald-500', icon: MailOpen }
    : (e.status === 'failed' || e.delivery === 'spam') ? { cls: 'bg-rose-500', icon: MailX } : { cls: 'bg-gray-400 dark:bg-gray-500', icon: Mail }
  const B = badge.icon
  if (!photo) {
    return (
      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${e.clicked_at ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300'
        : e.opened_at ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
          : (e.status === 'failed' || e.delivery === 'spam') ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06]'}`}>
        <B className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span className="relative mt-0.5 h-11 w-14 shrink-0" data-testid="email-row-photo">
      <span className="block h-11 w-14 overflow-hidden rounded-lg bg-gradient-to-br from-[#efe6d4] to-[#d9c7a3] dark:from-[#1d1a14] dark:to-[#2a2218]">
        <img src={photo} alt="" loading="lazy" decoding="async" onLoad={() => setOk(true)} className={`h-full w-full object-cover transition-opacity duration-300 ${ok ? 'opacity-100' : 'opacity-0'}`} />
      </span>
      <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-white ring-2 ring-white dark:ring-[#151517] ${badge.cls}`}><B className="h-2.5 w-2.5" /></span>
    </span>
  )
}

/** One sent email: what, when, opened / clicked - tap it to see what it had in it. */
export function EmailRowLine({ e, showTo = false }: { e: ClientEmailRow; showTo?: boolean }) {
  const [open, setOpen] = useState(false)
  const canOpen = e.status !== 'failed'
  const summary = e.contents?.summary
  return (
    <div className="min-w-0">
    <div role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined} aria-expanded={canOpen ? open : undefined}
      onClick={canOpen ? () => setOpen(v => !v) : undefined}
      onKeyDown={canOpen ? ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setOpen(v => !v) } } : undefined}
      data-testid="email-row" className={`flex min-w-0 items-start gap-3 ${canOpen ? 'cursor-pointer' : ''}`}>
      <EmailThumb e={e} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-black leading-snug text-[#111827] dark:text-white">{e.subject || e.label}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          {showTo && <>{e.name || e.to} · </>}
          {sentence(e.label)}{summary && summary !== e.subject ? <> · <span className="text-[#8b7355] dark:text-[#e8c97a]" data-testid="email-row-summary">{summary}</span></> : null}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-bold">
          {(e.opened_at || e.status === 'failed' || e.delivery === 'spam' || e.delivery === 'delayed') && (
            <span className="text-gray-400">{e.status === 'failed' ? 'Tried' : 'Sent'} {emailDay(e.sent_at || e.created_at)}</span>
          )}
          {e.opened_at && e.delivery !== 'spam' && <span className="text-emerald-600 dark:text-emerald-300">Opened {emailDay(e.opened_at)}{e.open_count > 1 ? ` · ${e.open_count}×` : ''}</span>}
          {(() => {
            const d = deliveryState(e)
            if (!d) return null
            const c = d.tone === 'rose' ? 'text-rose-600 dark:text-rose-300' : d.tone === 'amber' ? 'text-amber-600 dark:text-amber-300' : 'text-gray-400'
            return <span className={c} title={e.delivery_note || e.error || undefined}>{d.tone === 'gray' ? `Sent ${emailDay(e.sent_at || e.created_at)} · not opened yet` : d.text}</span>
          })()}
          {e.clicked_at && <span className="text-sky-600 dark:text-sky-300">Clicked {emailDay(e.clicked_at)}{e.click_count > 1 ? ` · ${e.click_count}×` : ''}</span>}
        </p>
      </div>
      {canOpen && <ChevronDown aria-hidden className={`mt-1 h-4 w-4 shrink-0 text-gray-300 transition-transform duration-300 dark:text-white/30 ${open ? 'rotate-180 text-[#C9A24D]' : ''}`} />}
    </div>
    <AnimatePresence initial={false}>
      {open && (
        <motion.div key="what" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={SMOOTH} className="overflow-hidden pl-[3.25rem] max-sm:pl-0">
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
        {p.sent > 0 ? (p.stats_90 ? <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">{p.sent} email{p.sent === 1 ? '' : 's'} in all</span> : <EngagementLine p={p} />)
          : <span className="text-xs font-semibold text-gray-400">No emails sent to them yet.</span>}
        <PersonSwitch p={p} onChanged={setPerson} />
      </div>
      {p.sent > 0 && p.stats_90 && <PersonStats p={p} className="mt-2.5" />}
      {rows && rows.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
          {rows.map(e => <EmailRowLine key={e.id} e={e} />)}
        </div>
      )}
      <button type="button" onClick={() => setAllOpen(true)} data-testid="lead-all-emails" className="mt-3 inline-flex text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">
        All emails →
      </button>
      <PersonEmailsSheet email={allOpen ? email : null} person={p} onClose={() => setAllOpen(false)} />
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

/** Where someone is in the email rule (owner, 11/18): 3 unopened days -> weekly, then 2 more -> off. */
export function ruleStep(p: EmailPerson): string | null {
  if (p.code === 'chosen' || p.mode === 'off') return null
  const days = p.unopened_days || 0
  const weekly = p.weekly_unopened || 0
  if (p.mode === 'weekly' && p.code === 'unopened_days') {
    const left = Math.max(1, 2 - weekly)
    return `${weekly} of 2 weekly emails unopened - ${left} more and automatic emails stop until they open one`
  }
  if (p.mode === 'daily' && days > 0) return `${days} of 3 days unopened in a row - at 3 they go to weekly`
  return null
}

/** The detailed numbers for one person (owner, 11/18) - the same 90 days as the open rate. */
export function PersonStats({ p, className = '' }: { p: EmailPerson; className?: string }) {
  const s = p.stats_90
  const step = ruleStep(p)
  if (!s) return null
  const cells: [string, string, string | null][] = [
    ['Sent', String(s.sent), s.sent ? `${s.auto} automatic · ${s.personal} personal` : null],
    ['Opened', String(s.opened), p.rate != null ? `${p.rate}% of them${s.opens_total > s.opened ? ` · ${s.opens_total} opens` : ''}` : null],
    ['Clicked', String(s.clicked), s.click_rate != null ? `${s.click_rate}% of them${s.clicks_total > s.clicked ? ` · ${s.clicks_total} clicks` : ''}` : null],
    ['Unopened', String(p.unopened_in_a_row || 0), 'in a row'],
  ]
  return (
    <div className={className} data-testid="person-stats">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {cells.map(([k, v, sub]) => (
          <div key={k} className="min-w-0 rounded-xl bg-[#faf9f7] px-2.5 py-2 dark:bg-white/[0.04]">
            <p className="font-serif text-lg font-black leading-none tabular-nums text-[#111827] dark:text-white">{v}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-gray-400">{k}</p>
            {sub && <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400" title={sub}>{sub}</p>}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
        Last 90 days{p.first_sent_at ? ` · first email ${emailDay(p.first_sent_at, false)}` : ''}{p.last_opened_at ? ` · last opened ${emailDay(p.last_opened_at)}` : ' · never opened yet'}
        {p.last_clicked_at ? ` · last clicked ${emailDay(p.last_clicked_at)}` : ''}
      </p>
      {step && <p className="mt-1 text-[10.5px] font-bold text-amber-700 dark:text-amber-300" data-testid="person-rule-step">{step}</p>}
    </div>
  )
}

/** One person's emails, opened over the page you're on (owner, 11/07: no separate log page). */
export function PersonEmailsSheet({ email, name, person, onClose }: { email: string | null; name?: string | null; person?: EmailPerson | null; onClose: () => void }) {
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
        {person && person.email === shownFor && <PersonStats p={person} className="mb-3.5 border-b border-gray-100 pb-3.5 dark:border-white/[0.06]" />}
        {rows === null ? (
          <div className="flex min-h-[200px] items-center justify-center"><OhpSpinner size={28} label="Loading emails" /></div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">No emails sent to them yet.</p>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: EASE }} className="space-y-3.5">
              {rows.map(e => <EmailRowLine key={e.id} e={e} />)}
            </motion.div>
          </AnimatePresence>
        )}
        {pages > 1 && <Pager page={page} pages={pages} onChange={setPage} prevLabel="Newer" nextLabel="Older" className="mt-4" />}
      </div>
    </OhSheet>
  )
}
