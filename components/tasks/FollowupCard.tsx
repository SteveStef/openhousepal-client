'use client'

// One follow-up, as a card on the Follow-ups page (and, `compact`, on the Dash).
//
// Built around what the agent does next, top to bottom - kept dense (one-line rows, no nested boxes):
//   header   - what kind of follow-up it is, when (red when overdue), and whether it's on their calendar
//   title    - the job (checkbox beside it), and why it exists / how they got here
//   the home - photo tile, opens it in their Showcase or on the listing page; picked times as chips
//   steps    - showings: 1) book it in ShowingTime (listing agent + MLS#), 2) text the client
//   client   - who, and one-tap copy of phone / email / the ready-to-send message
// Everything that's "copy onto my clipboard" is a same-size button, three to a row.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  AlertTriangle, ArrowUpRight, CalendarCheck, CalendarDays, Compass, CalendarClock, Check, CheckSquare, Clock, Copy, Hash, Home,
  Loader2, Mail, MessageCircle, MessageSquare, MoreHorizontal, Pencil, Phone, QrCode, Ticket, Trash2,
} from 'lucide-react'
import type { AgentTask, PropertyTour, TaskKind } from '@/types'
import api from '@/lib/api-service'
import { WhenSheet, addDays, clockText, nextWeekday, ymd } from '@/components/ui/WhenPicker'
import ViewToursModal from '@/components/ViewToursModal'
import { copyText } from '@/lib/copyText'
import { isPhoneDevice, mailHref, smsHref } from '@/lib/smsLink'

type Tone = 'gold' | 'sky' | 'emerald' | 'rose' | 'violet' | 'slate'

const TONE: Record<Tone, { dot: string; chip: string }> = {
  gold: { dot: 'bg-[#C9A24D]', chip: 'bg-[#C9A24D]/10 text-[#7a6440] ring-[#C9A24D]/25 dark:text-[#e0c486]' },
  sky: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20' },
  emerald: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20' },
  rose: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20' },
  violet: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20' },
  slate: { dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10' },
}

// tasks_service auto_source -> the tag in the card's corner.
const SITUATION: Record<string, { label: string; tone: Tone }> = {
  open_house_signin: { label: 'Open house', tone: 'sky' },
  similar_homes_qr: { label: 'Similar homes', tone: 'sky' },
  open_house_noted: { label: 'Has an agent', tone: 'slate' },
  second_visit_request: { label: 'Second visit', tone: 'gold' },
  showing_request: { label: 'Showing request', tone: 'gold' },
  disclosure_request: { label: 'Disclosure', tone: 'gold' },
  open_house_request: { label: 'Open house request', tone: 'gold' },
  showcase_setup: { label: 'Showcase', tone: 'violet' },
  showcase_comment: { label: 'Showcase comment', tone: 'violet' },
  showcase_search_request: { label: 'Search change', tone: 'violet' },
  showcase_likes: { label: 'Liked homes', tone: 'rose' },
  buyer_form: { label: "I'm Buying", tone: 'sky' },
  how_can_we_help: { label: 'How Can We Help', tone: 'sky' },
  how_can_we_help_seller: { label: 'Seller lead', tone: 'emerald' },
  form_submission: { label: 'Form', tone: 'sky' },
  invite_rsvp: { label: 'Invite RSVP', tone: 'gold' },
  form_unfinished: { label: 'Unfinished form', tone: 'slate' },
  listing_inquiry: { label: 'Listing inquiry', tone: 'sky' },
  website_signin: { label: 'Website sign-in', tone: 'sky' },
  portal_lead: { label: 'Listing inquiry', tone: 'sky' },
  spotlight_inquiry: { label: 'Listing inquiry', tone: 'sky' },
  private_feedback: { label: 'Private feedback', tone: 'rose' },
}
const KIND: Record<TaskKind, { label: string; icon: typeof Phone }> = {
  call: { label: 'Call', icon: Phone }, text: { label: 'Text', icon: MessageSquare }, email: { label: 'Email', icon: Mail },
  showing: { label: 'Showing', icon: Home }, general: { label: 'To-do', icon: CheckSquare },
}

// Alerts for the agent - nothing to send (tasks_service.ALERT_ONLY_RULES). The disclosure has a
// message too, but only once they've emailed it (see the hint under the buttons).
const ALERT_ONLY = new Set(['showcase_comment', 'showcase_search_request', 'private_feedback'])
// "Book the showing" follow-ups (tasks_service.SHOWING_RULES).
const SHOWING = new Set(['second_visit_request', 'showing_request'])
// Follow-ups about someone who signed in at one of your open houses - "Guest", not "Client".
const OPEN_HOUSE_GUEST = new Set(['open_house_signin', 'similar_homes_qr', 'open_house_noted', 'second_visit_request'])
const FILL_IN_RE =/\[[A-Z0-9 &]+\]/
// "What they told you" rows shown before "+N more".
const TOLD_PREVIEW = 4

export function fmtDue(due?: string | null, allDay?: boolean): string {
  if (!due) return ''
  const d = new Date(due)
  const now = new Date()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const datePart = d.toDateString() === now.toDateString() ? 'Today'
    : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (allDay) return datePart
  return `${datePart} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

// Notes minus what the card already shows. Alerts keep only the extra facts (the long how-to is
// for the calendar alert); everything else keeps what the agent typed / the feedback text.
function extraNotes(t: AgentTask): string {
  if (!t.notes) return ''
  if (!t.auto_source) return t.notes
  if (ALERT_ONLY.has(t.auto_source)) return t.notes.split('\n').filter(l => /^(They'd also like|Their feedback:)/.test(l)).join('\n').trim()
  // The disclosure's how-to + email/phone lines are for the calendar event - the card already
  // shows what they asked for, the contact buttons and the order to do it in.
  if (t.auto_source === 'disclosure_request') return t.notes.split('\n').filter(l => /^(They'd also like|To do:)/.test(l)).join('\n').trim()
  const skip = /^(Auto-created|Open house: |Contact: |Signed in: |Heads up - )/
  return t.notes.split('\n').filter(l => !skip.test(l)).join('\n').trim()
}

// The "why" line without a trailing " - 847 LESLEY RD" when the home tile is right under it.
function contextLine(t: AgentTask, trimStreet = false): string {
  const ctx = t.context || ''
  // In the timeline: "Requested a tour of 1425 County Line Rd" -> "Requested a tour" (the tile says where).
  const street = (t.property?.address || '').split(',')[0].trim()
  if (trimStreet && street) {
    const lc = ctx.toLowerCase().replace(/\.$/, '')
    for (const joiner of [' of ', ' about ', ' for ']) {
      if (lc.endsWith(joiner + street.toLowerCase())) return ctx.slice(0, lc.length - joiner.length - street.length)
    }
  }
  const cut = ctx.lastIndexOf(' - ')
  const home = (t.property?.address || '').toLowerCase()
  if (cut > 0 && home && !t.completed_at) {
    const tail = ctx.slice(cut + 3).trim().toLowerCase()
    if (tail && home.startsWith(tail.split(',')[0])) return ctx.slice(0, cut)
  }
  return ctx
}

// The backend's "where they came from" sentence (visit_source.describe_came_from) -> one plain
// sentence + an icon: "Scanned its QR code on your Similar Homes sheet at your 847 Lesley Rd,
// Villanova open house on Sep 7." Unknown wording stays whole.
function cameFromSentence(text: string, street = ''): { icon: typeof Compass; text: string } {
  const on = (day?: string) => (day ? ` on ${day}` : '')
  let m = text.match(/^Scanned (.+?) on your Similar Homes sheet from your (.+?) open house(?: \((.+)\))?$/)
  if (m) {
    // The home tile right below names the house - "its QR code" instead of the address a second time.
    const qr = street && m[1].toLowerCase().includes(street.toLowerCase()) ? 'its QR code'
      : m[1].replace(/^the QR under /, 'the QR code for ').replace(/^a home's QR$/, "a home's QR code")
    return { icon: QrCode, text: `Scanned ${qr} on your Similar Homes sheet at your ${m[2]} open house${on(m[3])}.` }
  }
  m = text.match(/^Opened it from their Guest Pass after signing in at your (.+?) open house(?: \((.+)\))?$/)
  if (m) return { icon: Ticket, text: `Opened it from their Guest Pass after signing in at your ${m[1]} open house${on(m[2])}.` }
  m = text.match(/^Signed in at your (.+?) open house(?: \((.+)\))?, which took them to your Spotlight$/)
  if (m) return { icon: Home, text: `Signed in at your ${m[1]} open house${on(m[2])}, then opened your Spotlight.` }
  return { icon: Compass, text }
}

const cleanName = (name?: string | null) => (name || '').replace(/\s*\(test\)\s*$/i, '').trim()
function initials(name?: string | null): string {
  const parts = cleanName(name).split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

/** A same-size copy button. `primary` = the one main action on the card. */
function CopyButton({ icon: Icon, label, value, title, primary, onCopy }: {
  icon: typeof Phone; label: string; value: string; title: string; primary?: boolean; onCopy?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyText(value).catch(() => {})
    onCopy?.()
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }
  return (
    <button type="button" onClick={copy} title={title} aria-label={title}
      className={`relative flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-[10px] px-2 text-[11.5px] font-semibold transition active:scale-[0.97] ${
        copied
          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
          : primary
            ? 'bg-[#111827] text-white shadow-sm shadow-black/10 hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-100'
            : 'border border-gray-200 bg-white text-gray-700 shadow-[0_1px_0_rgba(16,24,40,0.04)] hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]'
      }`}>
      {copied ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} /> : <Icon className={`h-3.5 w-3.5 shrink-0 ${primary ? '' : 'text-gray-400 dark:text-gray-500'}`} />}
      <span className="truncate">{copied ? 'Copied' : label}</span>
    </button>
  )
}

/** One pill, two parts: "Email" opens their email app with the message written; the small copy
 *  part on the right copies the address (for Gmail in a browser, a CRM...). */
function EmailPill({ email, href, first }: { email: string; href: string; first: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyText(email).catch(() => {})
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div className={`flex h-9 min-w-0 flex-1 overflow-hidden rounded-[10px] border text-[11.5px] font-semibold shadow-[0_1px_0_rgba(16,24,40,0.04)] transition ${
      copied ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-200 bg-white text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200'}`}>
      <a href={href} onClick={e => e.stopPropagation()} title={`Email ${first} - opens your email app with the message written`}
        className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 transition active:scale-[0.97] ${copied ? '' : 'hover:bg-gray-50 dark:hover:bg-white/[0.08]'}`}>
        <Mail className={`h-3.5 w-3.5 shrink-0 ${copied ? '' : 'text-gray-400 dark:text-gray-500'}`} />
        <span className="truncate">{copied ? 'Copied' : 'Email'}</span>
      </a>
      <button type="button" onClick={copy} title={`Copy ${first}'s email - ${email}`} aria-label={`Copy ${first}'s email - ${email}`}
        className={`flex w-8 shrink-0 items-center justify-center border-l transition active:scale-[0.95] ${copied ? 'border-white/30' : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:border-white/10 dark:text-gray-500 dark:hover:bg-white/[0.08]'}`}>
        {copied ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

function Avatar({ name }: { name?: string | null }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F3E6C4] to-[#C9A24D] text-[9.5px] font-bold tracking-wide text-[#4d3d1f]">
      {initials(name)}
    </span>
  )
}

/** The row above a set of copy buttons: [step #] the job on the left; on the same row, who it's with -
 *  "Listing agent: Jane Hall" with their brokerage stacked small under it (truncates, full on hover). */
function StepHead({ n, action, role, name, sub }: { n: number; action: string; role: string; name?: string; sub?: string | null }) {
  return (
    <div className="mb-1.5 flex min-w-0 items-center gap-2">
      <p className="flex shrink-0 items-center gap-1.5 text-[12px] font-bold leading-5 text-gray-900 dark:text-white">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[9px] font-black text-white">{n}</span>
        {action}
      </p>
      <div className="min-w-0 flex-1 text-right leading-tight" title={[`${role}: ${name || ''}`, sub].filter(Boolean).join(' · ')}>
        <p className="truncate text-[11.5px]">
          <span className="text-gray-500 dark:text-gray-400">{role}{name ? ': ' : ''}</span>
          {name && <span className="font-semibold text-gray-900 dark:text-white">{name}</span>}
        </p>
        {sub && <p className="truncate text-[9.5px] text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

export default function FollowupCard({ t, compact, busy, clickable, onToggleDone, onOpenLead, onSnooze, onPickDay, onDelete }: {
  t: AgentTask
  compact?: boolean
  busy?: boolean
  clickable?: boolean
  onToggleDone: () => void
  onOpenLead?: () => void
  onSnooze?: (days: number) => void
  // Move it to any day (YYYY-MM-DD, keeps its time of day).
  onPickDay?: (ymd: string) => void
  onDelete?: () => void
}) {
  const done = !!t.completed_at
  // On a phone the card's main action is "Text": Messages opens with the number + this text written
  // (from the agent's own cell) and the follow-up checks itself off - the tick stays put until they
  // leave the page, so a second tap on it undoes.
  const [onPhone, setOnPhone] = useState(false)
  useEffect(() => { setOnPhone(isPhoneDevice()) }, [])
  const src = t.auto_source || ''
  const situation = SITUATION[src] || { label: KIND[t.kind]?.label || 'Follow-up', tone: 'slate' as Tone }
  const tone = TONE[situation.tone]
  const KindIcon = KIND[t.kind]?.icon || CheckSquare
  const overdue = !done && t.bucket === 'overdue'
  const showing = !compact && !done && SHOWING.has(src)
  const alertOnly = ALERT_ONLY.has(src)
  const fillIn = !done && t.suggested_message ? t.suggested_message.match(FILL_IN_RE)?.[0] : undefined
  const agent = t.property?.list_agent
  const hasAgent = !!(agent && (agent.phone || agent.email))
  const lead = t.lead
  const client = cleanName(lead?.name)
  const first = client.split(' ')[0] || 'them'
  const times = t.requested_times || []
  // The picked times have their own block - don't repeat "They'd also like another tour: …" below.
  // ...and never twice: a Guest Pass copy of a question the card already shows is dropped.
  const squash = (v: string) => v.toLowerCase().replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()
  const toldValues = new Set((t.details || []).map(l => squash(l.replace(/^[^:]{1,60}:\s+/, ''))))
  const notes = compact ? '' : extraNotes(t).split('\n')
    .filter(l => !(times.length && l.startsWith("They'd also like")))
    .filter(l => { const q = l.match(/^Asked on their Guest Pass:\s*(.+)$/); return !(q && toldValues.has(squash(q[1]))) })
    .join('\n').trim()
  const [street, ...rest] = (t.property?.address || '').split(', ')

  // "Label: value" / "Question? answer" lines -> rows; the home's own address is already on the tile.
  const streetLc = (street || '').toLowerCase()
  // A question typed on their Guest Pass reads as exactly that.
  const fromGuestPass = /Guest Pass/.test(`${t.context || ''}\n${t.notes || ''}`)
  const told = (t.details || []).map(line => {
    // "Label: answer" first (a message can itself contain "?"), then "Question? answer".
    const m = line.match(/^([^:?]{1,60}):\s+(.+)$/) || line.match(/^(.{1,90}?\?)\s+(.+)$/)
    const row = m ? { label: m[1].replace(/:$/, ''), value: m[2] } : { label: '', value: line }
    return fromGuestPass && row.label === 'Their question' ? { ...row, label: 'Asked on their Guest Pass' } : row
  }).filter(row => !(streetLc && row.value.toLowerCase().startsWith(streetLc)))
  const [showAllTold, setShowAllTold] = useState(false)
  const [photoOk, setPhotoOk] = useState(true)
  const [menu, setMenu] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  // The menu floats over the page (portal) - inside the card, the next card or the "Automatic
  // follow-ups" panel below could cover it, hiding Next week / Pick a day / Delete.
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const place = () => {
    const r = menuRef.current?.getBoundingClientRect()
    if (!r) return false
    if (r.bottom < 0 || r.top > window.innerHeight) return false
    const right = Math.max(8, window.innerWidth - r.right)
    setPos(window.innerHeight - r.bottom < 250 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right })
    return true
  }
  const openMenu = () => { if (place()) setMenu(true) }
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => {
      const n = e.target as Node
      if (!menuRef.current?.contains(n) && !popRef.current?.contains(n)) setMenu(false)
    }
    // Scrolling keeps it pinned to its "…" button; it closes once the button is off screen.
    const follow = () => { if (!place()) setMenu(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', follow, true); window.removeEventListener('resize', follow) }
  }, [menu])

  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const journey = t.property?.came_from ? cameFromSentence(t.property.came_from, (t.property.address || '').split(',')[0].trim()) : null
  // Showing cards name both people - who's the listing agent, who's your guest (vs. a web client).
  const clientRole = src === 'how_can_we_help_seller' ? 'Seller'
    : journey || OPEN_HOUSE_GUEST.has(src) ? 'Guest' : 'Client'

  return (
    <article
      onClick={clickable ? onOpenLead : undefined}
      role={clickable ? 'button' : undefined}
      // A clear edge on every card (light + dark) - they're big, so where one ends has to be obvious.
      className={`group relative flex h-full flex-col rounded-2xl border p-3.5 transition duration-200 ${clickable ? 'cursor-pointer' : ''} ${
        done
          ? 'border-gray-200 bg-gray-50/70 dark:border-white/[0.08] dark:bg-white/[0.02]'
          : `bg-white shadow-[0_1px_3px_rgba(16,24,40,0.08),0_1px_2px_rgba(16,24,40,0.04)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-14px_rgba(16,24,40,0.28)] dark:bg-[#17171A] dark:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] ${
              overdue ? 'border-red-300 dark:border-red-500/40' : 'border-gray-300/90 hover:border-[#C9A24D]/60 dark:border-white/[0.14] dark:hover:border-[#C9A24D]/50'}`
      }`}
    >
      {/* ── overdue strip: its own row across the top, so it never squeezes the situation label */}
      {overdue && (
        <div className="-mx-3.5 -mt-3.5 mb-3 flex items-center gap-2 rounded-t-[15px] border-b border-red-200 bg-red-50 px-3.5 py-1.5 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.1em]">Overdue</span>
          {t.due_at && <span className="ml-auto text-[11px] font-semibold tabular-nums opacity-80">Was due {fmtDue(t.due_at, t.all_day)}</span>}
        </div>
      )}

      {/* ── header: kind · when · calendar · menu */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${done ? TONE.slate.chip : tone.chip}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${done ? 'bg-gray-400' : tone.dot}`} />
          {situation.label}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {done ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" strokeWidth={3} /> Done</span>
          ) : overdue ? null : t.due_at ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
              <Clock className="h-3 w-3" />
              {fmtDue(t.due_at, t.all_day)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400"><CalendarClock className="h-3 w-3" /> No date</span>
          )}
          {!done && t.on_calendar && (
            <span title="On your calendar" aria-label="On your calendar" className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CalendarCheck className="h-3.5 w-3.5" />
            </span>
          )}
          {!compact && !done && (onSnooze || onDelete) && (
            <div ref={menuRef} className="relative" onClick={stop}>
              <button type="button" onClick={() => (menu ? setMenu(false) : openMenu())} aria-label="More" title="Snooze or delete"
                className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
              </button>
              {menu && pos && createPortal(
                <div ref={popRef} onClick={stop} style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, right: pos.right }}
                  className="z-[300] w-44 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-xl shadow-black/10 dark:border-white/10 dark:bg-[#1A1A1C]">
                  <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400">Snooze</p>
                  {([['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7]] as const).map(([label, d]) => (
                    <button key={label} type="button" onClick={() => { setMenu(false); onSnooze?.(d) }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                      <Clock className="h-3.5 w-3.5 text-gray-400" /> {label}
                    </button>
                  ))}
                  {onPickDay && (
                    // Any day, not just the three quick ones - the big step-by-step day picker (10/22).
                    <button type="button" onClick={() => { setMenu(false); setPickOpen(true) }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                      <CalendarDays className="h-3.5 w-3.5 text-gray-400" /> Pick a day…
                    </button>
                  )}
                  <div className="my-1 h-px bg-gray-100 dark:bg-white/10" />
                  <button type="button" onClick={() => { setMenu(false); onDelete?.() }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>,
                document.body,
              )}
              {onPickDay && (
                <WhenSheet open={pickOpen} onClose={() => setPickOpen(false)} mode="date"
                  title="Move it to which day?" kicker="Snooze"
                  photo={t.property?.photo || null} context={t.title} contextSub={client || t.property?.address || null}
                  intro={t.due_at && !t.all_day ? `It keeps its time - ${clockText(`${String(new Date(t.due_at).getHours()).padStart(2, '0')}:${String(new Date(t.due_at).getMinutes()).padStart(2, '0')}`)}.` : 'It keeps its time of day.'}
                  value={t.due_at && ymd(new Date(t.due_at)) >= ymd(new Date()) ? { date: ymd(new Date(t.due_at)), time: null } : null}
                  suggestions={[
                    { label: 'Tomorrow', date: addDays(1) },
                    { label: 'In 3 days', date: addDays(3) },
                    { label: 'Next week', date: addDays(7) },
                    { label: 'Next Monday', date: nextWeekday(1) },
                  ]}
                  summaryPrefix="Moves to"
                  doneLabel="Move it"
                  onDone={v => { setPickOpen(false); if (v.date) onPickDay(v.date) }} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── title + done */}
      <div className="mt-3 flex items-start gap-3">
        <button type="button" onClick={e => { stop(e); onToggleDone() }} disabled={busy}
          aria-label={done ? 'Reopen' : 'Mark done'} title={done ? 'Undo - mark not done' : 'Mark done'}
          className={`group/check mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition ${
            done ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 text-[#C9A24D] hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:border-gray-600'
          }`}>
          <Check className={`h-3 w-3 transition ${done ? 'opacity-100' : 'opacity-0 group-hover/check:opacity-100'}`} strokeWidth={3.5} />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className={`break-words text-[15px] font-bold leading-snug tracking-[-0.01em] ${done ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
            {!t.auto_source && <KindIcon className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-gray-400" />}
            {t.title}
          </h3>
          {t.context && !(journey && !done) && <p className="mt-0.5 break-words text-[12px] leading-snug text-gray-500 dark:text-gray-400">{contextLine(t)}</p>}
        </div>
      </div>

      {/* ── how they got here: what they did, then where from as one sentence - its own
          full-width box (same as the home and message tiles), not indented under the title */}
      {journey && !done && (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-[12px] leading-snug dark:border-white/[0.06] dark:bg-white/[0.03]">
          {t.context && <p className="font-semibold text-gray-900 dark:text-white">{contextLine(t, true)}</p>}
          <p className={`${t.context ? 'mt-0.5' : ''} flex items-start gap-1.5 break-words text-gray-600 dark:text-gray-300`}>
            <journey.icon className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#8b7355] dark:text-[#d7b974]" />
            <span className="min-w-0">{journey.text}</span>
          </p>
        </div>
      )}

      {/* ── the home */}
      {!done && t.property?.address && (() => {
        const inner = (
          <>
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
              {t.property.photo && photoOk
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={t.property.photo} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setPhotoOk(false)} />
                : <Home className="absolute inset-0 m-auto h-4 w-4 text-gray-400" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-gray-900 dark:text-white">{street}</span>
              <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                {[rest.join(', '), SHOWING.has(src) && t.property.mls ? `MLS# ${t.property.mls}` : ''].filter(Boolean).join(' · ')}
              </span>
            </span>
            {t.property.url && (
              // Just an arrow (the tooltip says where it goes) - leaves the width to the address + MLS#.
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#8b7355] shadow-sm ring-1 ring-black/5 transition group-hover/home:bg-[#C9A24D] group-hover/home:text-white dark:bg-white/10 dark:text-[#d7b974] dark:ring-white/10">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            )}
          </>
        )
        const cls = 'group/home mt-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-1.5 pr-3 transition dark:border-white/[0.06] dark:bg-white/[0.03]'
        return t.property.url
          ? <a href={t.property.url} target="_blank" rel="noopener noreferrer" onClick={stop} title={t.property.where === 'showcase' ? `Open it in ${first}'s Showcase` : 'See the listing'}
              className={`${cls} hover:border-[#C9A24D]/40 hover:bg-[#C9A24D]/[0.06]`}>{inner}</a>
          : <div className={cls}>{inner}</div>
      })()}

      {/* ── the day(s) / time(s) they picked (showing, second visit, disclosure tour) - one wrapping row of chips */}
      {!done && !!times.length && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8b7355] dark:text-[#d7b974]">
            <CalendarClock className="h-3.5 w-3.5" />
            {src === 'disclosure_request' ? 'Also wants a tour' : 'They picked'}
          </span>
          {times.map((x, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A24D]/[0.08] px-2 py-1 text-[12px] font-semibold tabular-nums text-gray-900 ring-1 ring-inset ring-[#C9A24D]/30 dark:bg-[#C9A24D]/[0.1] dark:text-white dark:ring-[#C9A24D]/25">
              {times.length > 1 && <span className="text-[9px] font-black uppercase text-[#8b7355] dark:text-[#d7b974]">{['1st', '2nd', '3rd'][i]}</span>}
              {x.replace(/\s+-\s+(morning|afternoon|evening|anytime)$/i, ' · $1')}
            </span>
          ))}
        </div>
      )}

      {/* ── what they told you (form answers, their message) - "Label: answer" rows, no header */}
      {!done && told.length > 0 && (
        <div className="mt-2 flex gap-2 rounded-xl bg-gray-50/80 px-2.5 py-1.5 dark:bg-white/[0.03]" onClick={stop} title="What they told you">
          <MessageCircle className="mt-[3px] h-3.5 w-3.5 shrink-0 text-gray-400" />
          <div className="min-w-0 flex-1 space-y-0.5">
            {(showAllTold ? told : told.slice(0, TOLD_PREVIEW)).map((row, i) => (
              <p key={i} className="break-words text-[12px] leading-snug">
                {row.label && <span className="text-gray-500 dark:text-gray-400">{row.label}: </span>}
                <span className="font-semibold text-gray-900 dark:text-white">{row.value}</span>
              </p>
            ))}
            {told.length > TOLD_PREVIEW && (
              <button type="button" onClick={() => setShowAllTold(v => !v)}
                className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8b7355] hover:underline dark:text-[#d7b974]">
                {showAllTold ? 'Show less' : `+${told.length - TOLD_PREVIEW} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── what they said on their Showcase */}
      {!done && !!t.comments?.length && (
        <div className="mt-3 space-y-1.5">
          {t.comments.slice(0, compact ? 1 : 3).map((c, i) => (
            <div key={i} className="rounded-xl bg-violet-50/70 px-3 py-2 dark:bg-violet-500/[0.07]">
              <p className={`break-words text-[12.5px] leading-snug text-gray-800 dark:text-gray-100 ${compact ? 'line-clamp-2' : 'line-clamp-4'}`}>
                <MessageCircle className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-violet-500" />&ldquo;{c.text}&rdquo;
              </p>
              <Link href={c.path} onClick={stop}
                className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-violet-700 hover:underline dark:text-violet-300">
                {c.home} <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* ── anything else worth knowing (their feedback, answers so far, your note) */}
      {!done && notes && (
        <p className="mt-3 line-clamp-5 whitespace-pre-wrap rounded-xl bg-gray-50 px-3 py-2 text-[12px] leading-snug text-gray-600 dark:bg-white/[0.03] dark:text-gray-300">{notes}</p>
      )}

      {/* ── actions sit at the bottom, so buttons line up across a row of cards */}
      {!done && (lead || hasAgent) && (
        <div className="mt-auto space-y-2.5 pt-3" onClick={stop}>
          {/* Showing, step 1: book it in ShowingTime - the listing agent + the MLS# to search. */}
          {showing && (
            <div>
              <StepHead n={1} action="Book in ShowingTime" role="Listing agent" name={agent?.name || undefined} sub={agent?.office} />
              <div>
                <div className="flex gap-1.5">
                  {agent?.phone && <CopyButton icon={Phone} label="Phone" value={agent.phone} title={`Copy the listing agent's number - ${agent.phone}`} />}
                  {agent?.email && <CopyButton icon={Mail} label="Email" value={agent.email} title={`Copy the listing agent's email - ${agent.email}`} />}
                  {t.property?.mls
                    ? <CopyButton icon={Hash} label="MLS#" value={t.property.mls} title={`Copy MLS# ${t.property.mls} - search it in ShowingTime`} />
                    : <span className="flex h-9 flex-1 items-center justify-center rounded-[10px] border border-dashed border-gray-200 px-2 text-[11px] font-semibold text-gray-400 dark:border-white/10">Search the address</span>}
                </div>
              </div>
            </div>
          )}

          {/* The client: who, and phone / email / the message to send. */}
          {lead && (
            <div>
              {showing ? (
                <StepHead n={2} action={`Text ${first}`} role={clientRole} name={client || undefined} />
              ) : !compact && (
                <div className="mb-1.5 flex min-w-0 items-center gap-2 text-[12px]">
                  <Avatar name={client} />
                  <span className="truncate font-semibold text-gray-900 dark:text-white">{client || clientRole}</span>
                  <span className="shrink-0 text-gray-500 dark:text-gray-400">· {clientRole}</span>
                </div>
              )}
              <div>
                <div className="flex gap-1.5">
                  {lead.phone && <CopyButton icon={Phone} label="Phone" value={lead.phone} title={`Copy ${first}'s number - ${lead.phone}`} />}
                  {lead.email && (src === 'disclosure_request'
                    ? <CopyButton icon={Mail} label="Copy email" value={lead.email} primary title={`Copy ${lead.email} - send them the seller disclosure`} />
                    : <EmailPill email={lead.email} first={first} href={mailHref(lead.email, street ? `Following up - ${street}` : 'Following up', t.suggested_message)} />
                  )}
                  {t.suggested_message && (
                    <CopyButton icon={Copy} label="Message" value={t.suggested_message} primary={!(onPhone && lead.phone)} title="Copy the ready-to-send message" />
                  )}
                  {onPhone && lead.phone && t.suggested_message && (
                    <a href={smsHref(lead.phone, t.suggested_message)} title={`Text ${first} - opens Messages with the text written, and checks this off`}
                      onClick={e => { e.stopPropagation(); if (!done) onToggleDone() }}
                      className="relative flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-[10px] bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2 text-[11.5px] font-bold text-[#111827] shadow-sm shadow-[#C9A24D]/30 transition active:scale-[0.97]">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Text {first}</span>
                    </a>
                  )}
                </div>
                {/* What's left to do after copying. */}
                {!compact && (fillIn || alertOnly || src === 'disclosure_request') && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                    <Pencil className="mt-px h-3 w-3 shrink-0 text-[#C9A24D]" />
                    {fillIn ? <span>After you paste it, replace <b className="font-semibold text-gray-700 dark:text-gray-200">{fillIn}</b> {fillIn === '[ANSWER THEIR QUESTION]' ? `with your answer to ${first}'s question above` : fillIn === '[ADD YOUR MESSAGE HERE]' ? `with what you'd like to say to ${first}` : 'with the time you booked'}.</span>
                      : src === 'disclosure_request' ? <span>Email {first} the seller disclosure first, then send this text.</span>
                      : src === 'private_feedback' ? <span>Reach out to {first} in your own words - a quick call usually goes further than a text.</span>
                      : src === 'showcase_search_request' ? <span>Update {first}&apos;s Showcase search, then let them know.</span>
                      : <span>Reply to {first}&apos;s comment in your own words.</span>}
                  </p>
                )}
              </div>
            </div>
          )}
          {!compact && !done && t.request && <RequestAnswer t={t} onAnswered={onToggleDone} />}
        </div>
      )}
    </article>
  )
}

// Answer the request behind this follow-up right on the card - on the Dash as on Follow-ups (user,
// 10/21): a Showcase tour opens the same window as Showcases (confirm one of their times, or mark it
// done); a second visit is "Mark scheduled", a disclosure "Mark sent" - either also checks this off.
function RequestAnswer({ t, onAnswered }: { t: AgentTask; onAnswered: () => void }) {
  const req = t.request!
  const [busy, setBusy] = useState(false)
  const [tours, setTours] = useState<PropertyTour[] | null>(null)
  const [loading, setLoading] = useState(false)
  const loadTour = async () => {
    if (req.kind !== 'tour') return
    setLoading(true)
    const r = await api.collections.getTours(req.collection_id)
    setLoading(false)
    setTours(((r.success && r.data) || []).filter((x: PropertyTour) => x.id === req.tour_id))
  }
  const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[11.5px] font-bold transition active:scale-[0.97] disabled:opacity-60'
  if (req.kind === 'tour') {
    return (
      <div className="mt-2.5 flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
        {req.confirmed
          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"><CalendarCheck className="h-3.5 w-3.5" /> Tour confirmed</span>
          : <span className="text-[11.5px] font-semibold text-gray-500 dark:text-gray-400">Waiting on your answer</span>}
        <button type="button" onClick={loadTour} disabled={loading}
          className={`${btn} bg-[#111827] text-white dark:bg-white dark:text-[#111827]`}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
          {req.confirmed ? 'View tour' : 'Respond to tour'}
        </button>
        {tours && (
          <ViewToursModal
            isOpen
            onClose={() => setTours(null)}
            tours={tours}
            isLoading={false}
            onConfirmTour={async (id, d, time) => { const r = await api.collections.confirmTour(id, d, time); if (r.success) { await loadTour() } }}
            onUnconfirmTour={async id => { const r = await api.collections.unconfirmTour(id); if (r.success) { await loadTour() } }}
            onUpdateCompletion={async (id, isDone) => { const r = await api.collections.updateTourCompletion(id, isDone); if (r.success) { setTours(null); if (isDone) onAnswered() } }}
          />
        )}
      </div>
    )
  }
  const label = req.kind === 'second_visit' ? 'Mark scheduled' : 'Mark sent'
  return (
    <div className="mt-2.5 flex items-center gap-2" onClick={e => e.stopPropagation()}>
      <button type="button" disabled={busy || req.handled}
        onClick={async () => {
          setBusy(true)
          const r = await api.openHouses.completeFormRequest(req.request_id)
          setBusy(false)
          if (r.success) onAnswered()
        }}
        className={`${btn} bg-[#111827] text-white dark:bg-white dark:text-[#111827]`}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {req.handled ? (req.kind === 'second_visit' ? 'Scheduled' : 'Sent') : label}
      </button>
      <span className="text-[11px] text-gray-500 dark:text-gray-400">{req.kind === 'second_visit' ? 'Once you’ve booked it - also checks this off.' : 'Once you’ve sent it - also checks this off.'}</span>
    </div>
  )
}
