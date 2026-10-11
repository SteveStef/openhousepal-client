'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Building2, Check, Compass, Copy, Eye, EyeOff, Heart, Home, Loader2, Mail,
  MailX, MessageCircle, Pencil, Phone, Plus, Sparkles, Tag, ThumbsDown, Trash2, X,
} from 'lucide-react'
import api from '@/lib/api-service'
import { eventDetails, formatPhone } from '@/lib/leadEventDetails'
import { activityMeta, dialable, exactTime, ORIGIN_META, TONE_CLASSES, timeAgo } from '@/lib/leadActivity'
import { LeadDetail, LeadEvent, LeadNote, LeadRepresented, LeadShowcase, LeadStatus, LeadTodo } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import TasksPanel from '@/components/tasks/TasksPanel'
import { LeadEmailCard } from '@/components/emails/EmailEngagement'
import { useFollowupsEnabled } from '@/components/tasks/FollowupsSwitch'
import Pager from '@/components/ui/Pager'
import NotesThread from './NotesThread'
import { copyText } from '@/lib/copyText'
import LuxeSelect from '@/components/ui/LuxeSelect'
import MotionModal from '@/components/ui/MotionModal'

// The pipeline, in order. (Older rows may still say qualified/converted/archived - shown as these.)
const STATUSES: { id: LeadStatus; label: string; dot: string; hex: string; hint: string }[] = [
  { id: 'new', label: 'New', dot: 'bg-sky-500', hex: '#0ea5e9', hint: "Haven't talked yet" },
  { id: 'contacted', label: 'Contacted', dot: 'bg-amber-500', hex: '#f59e0b', hint: "You've reached out" },
  { id: 'in_talks', label: 'In talks', dot: 'bg-violet-500', hex: '#8b5cf6', hint: 'Actively working together' },
  { id: 'signed', label: 'Signed', dot: 'bg-emerald-500', hex: '#10b981', hint: 'Your client' },
]

export function normalizedStatus(lead: { status: LeadStatus; hidden_at?: string | null }): LeadStatus {
  if (lead.hidden_at || lead.status === 'archived' || lead.status === 'hidden') return 'hidden'
  if (lead.status === 'qualified') return 'in_talks'
  if (lead.status === 'converted') return 'signed'
  return lead.status
}

export const STATUS_LABEL: Record<string, string> = { new: 'New', contacted: 'Contacted', in_talks: 'In talks', signed: 'Signed', hidden: 'Hidden' }
export const STATUS_PILL: Record<string, string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/25',
  contacted: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
  in_talks: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25',
  signed: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
  hidden: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-400 dark:ring-white/10',
}

const REPRESENTED: { id: LeadRepresented; label: string; hex: string; hint: string }[] = [
  { id: 'no', label: 'No agent', hex: '#10b981', hint: 'Free to work with you' },
  { id: 'unknown', label: 'Not sure', hex: '#f59e0b', hint: "Haven't asked yet" },
  { id: 'yes', label: 'Has an agent', hex: '#9ca3af', hint: 'Moves to "Has agent"' },
]

// Timeline filters.
type Filter = 'all' | 'asks' | 'showcase'
const SHOWCASE_TYPES = new Set(['collection_visitor', 'property_comment', 'property_tour'])
const isShowcaseType = (t: string) => t.startsWith('showcase_') || SHOWCASE_TYPES.has(t)

// Long lists page instead of growing forever.
const PAGE = 12          // activity rows per page
const NOTES_PAGE = 5
const OPEN_HOUSES_SHOWN = 4

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(); y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(d.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }) })
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

// One timeline row, or several "Looked at ..." views from the same day folded into one.
type Row = { kind: 'event'; e: LeadEvent } | { kind: 'views'; items: LeadEvent[] }

// Which activity entries each "Waiting on you" request comes from (backend lead_routes._enrich).
const REQUEST_TYPES: Partial<Record<LeadTodo['kind'], string[]>> = {
  showing: ['property_tour', 'property_website_tour_request', 'property_page_tour_request'],
  second_visit: ['open_house_second_visit'],
  disclosure: ['open_house_disclosure'],
  comment: ['property_comment'],
}

function foldViews(events: LeadEvent[]): Row[] {
  const rows: Row[] = []
  for (const e of events) {
    const last = rows[rows.length - 1]
    if (e.source_type === 'showcase_view' && last?.kind === 'views'
      && new Date(last.items[0].occurred_at).toDateString() === new Date(e.occurred_at).toDateString()) {
      last.items.push(e)
    } else if (e.source_type === 'showcase_view') {
      rows.push({ kind: 'views', items: [e] })
    } else {
      rows.push({ kind: 'event', e })
    }
  }
  return rows
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">{children}</h2>
      {aside}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-[#151517] sm:p-5 ${className}`}>{children}</div>
}

interface LeadDetailPanelProps {
  leadId: string
  // Leave this lead's view - back to /leads on the standalone page, or close the modal over the list.
  onBack: () => void
  backLabel?: string
  // Fired after any change here (status, contact, follow-ups...) so a list behind it can resync.
  onChanged?: () => void
}

export default function LeadDetailPanel({ leadId, onBack, backLabel = 'Leads', onChanged }: LeadDetailPanelProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const followupsOn = useFollowupsEnabled().enabled !== false
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notesList, setNotesList] = useState<LeadNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const [notesPage, setNotesPage] = useState(1)
  const [allOpenHouses, setAllOpenHouses] = useState(false)
  const activityTop = useRef<HTMLDivElement>(null)
  const [openRows, setOpenRows] = useState<Set<string>>(new Set())
  const [handling, setHandling] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    const r = await api.leads.get(leadId)
    if (r.success && r.data) setLead(r.data)
  }, [leadId])

  useEffect(() => {
    if (!leadId) return
    setLoading(true); setNotesLoading(true); setPage(1); setNotesPage(1); setFilter('all'); setAllOpenHouses(false)
    api.leads.get(leadId).then(r => { if (r.success && r.data) setLead(r.data); setLoading(false) })
    api.leads.getNotes(leadId).then(r => { if (r.success && r.data) setNotesList(r.data); setNotesLoading(false) })
  }, [leadId])

  const applyUpdate = async (data: Parameters<typeof api.leads.update>[1]) => {
    if (!lead) return false
    const previous = lead
    // Optimistic - the change shows at once and rolls back if the save fails.
    const { mark_contacted, ...patch } = data
    setLead({ ...lead, ...patch, ...(mark_contacted ? { last_contacted_at: new Date().toISOString(), status: lead.status === 'new' ? 'contacted' : lead.status } : {}) } as LeadDetail)
    setSaving(true)
    const r = await api.leads.update(lead.id, data)
    if (r.success && r.data) { setLead(r.data); onChanged?.() } else { setLead(previous); showToast(r.error || "Couldn't save that", 'error') }
    setSaving(false)
    return r.success
  }

  const setStatus = async (status: LeadStatus) => {
    if (!lead) return
    if (status === 'hidden') {
      setSaving(true)
      const r = await api.leads.hide(lead)
      if (r.success && r.data) { setLead(r.data); onChanged?.() }
      setSaving(false)
      return
    }
    applyUpdate({ status })
  }

  const handled = async (t: LeadTodo) => {
    if (!lead) return
    setHandling(t.kind)
    const r = await api.leads.markHandled(lead.id, t.kind)
    if (r.success && r.data) { setLead(r.data); onChanged?.() }
    setHandling(null)
  }

  const remove = async () => {
    if (!lead) return
    setDeleting(true)
    const r = await api.leads.delete(lead.id)
    setDeleting(false)
    if (r.success) { onChanged?.(); onBack() } else showToast(r.error || "Couldn't delete this lead", 'error')
  }

  const copy = (text: string, what: string) => {
    copyText(text).then(() => showToast(`${what} copied`, 'success'), () => {})
  }

  const events = lead?.events || []
  // The event they came in with (the summary's "first touch") - the oldest one the backend picked.
  const originEvent = useMemo(() => {
    const at = lead?.origin ? new Date(lead.origin.at).getTime() : NaN
    return events.find(e => e.source_type === lead?.origin?.type && new Date(e.occurred_at).getTime() === at) || null
  }, [events, lead?.origin])
  // Jump to one entry in Activity: show everything, turn to its page, open its details, scroll
  // there and flash it gold.
  const seeEvent = (ev: LeadEvent | null) => {
    setFilter('all')
    const at = ev ? foldViews(events).findIndex(r => r.kind === 'event' && r.e.id === ev.id) : -1
    setPage(at >= 0 ? Math.floor(at / PAGE) + 1 : Number.MAX_SAFE_INTEGER)
    if (ev) setOpenRows(prev => new Set(prev).add(ev.id))
    window.setTimeout(() => {
      const row = ev ? document.getElementById(`lead-ev-${ev.id}`) : null
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        row.animate([{ backgroundColor: 'rgba(201,162,77,.22)' }, { backgroundColor: 'rgba(201,162,77,0)' }], { duration: 1800, easing: 'ease-out' })
      } else activityTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }
  const seeOrigin = () => seeEvent(originEvent)
  // The request behind a "Waiting on you" row - newest first.
  const requestEvent = (t: LeadTodo) => events.find(e => (REQUEST_TYPES[t.kind] || []).includes(e.source_type)) || null
  const filtered = useMemo(() => events.filter(e =>
    filter === 'all' ? true : filter === 'showcase' ? isShowcaseType(e.source_type) : !isShowcaseType(e.source_type) || e.source_type === 'showcase_refine' || e.source_type === 'property_tour' || e.source_type === 'property_comment'),
  [events, filter])
  const rows = useMemo(() => foldViews(filtered), [filtered])

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  }
  if (!lead) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <p className="font-black text-gray-500 dark:text-gray-400">This lead couldn&apos;t be found - it may have been deleted.</p>
        <button onClick={onBack} className="text-sm font-black text-[#8b7355]">{backLabel}</button>
      </div>
    )
  }

  const status = normalizedStatus(lead)
  const first = (lead.name || '').split(' ')[0] || 'them'
  const requests = (lead.todos || []).filter(t => t.kind !== 'followup')
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const curPage = Math.min(page, pages)
  const shownRows = rows.slice((curPage - 1) * PAGE, curPage * PAGE)
  const goPage = (n: number) => {
    setPage(Math.min(Math.max(1, n), pages))
    activityTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const notePages = Math.max(1, Math.ceil(notesList.length / NOTES_PAGE))
  const notesShown = notesList.slice((Math.min(notesPage, notePages) - 1) * NOTES_PAGE, Math.min(notesPage, notePages) * NOTES_PAGE)
  let lastDay = ''

  return (
    <div>
      <button onClick={onBack} className="hidden items-center gap-1.5 text-sm font-black text-gray-400 transition hover:text-[#111827] dark:hover:text-white sm:inline-flex">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </button>

      {/* ── who they are, how to reach them, where they stand */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="sm:mt-4">
        <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111827] text-lg font-black text-[#C9A24D] dark:bg-white dark:text-[#8b7355] sm:h-14 sm:w-14 sm:text-xl">
            {(lead.name || lead.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex flex-col gap-2">
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name"
                  className="w-full max-w-sm rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-serif text-lg font-black text-[#111827] outline-none focus:ring-2 focus:ring-[#C9A24D]/30 dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                <div className="flex flex-wrap items-center gap-2">
                  <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" type="email"
                    className="w-full max-w-[16rem] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#C9A24D]/30 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-200" />
                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone" type="tel"
                    className="w-full max-w-[11rem] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#C9A24D]/30 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-200" />
                  <button onClick={async () => { if (await applyUpdate({ name: editName.trim(), email: editEmail.trim(), phone: editPhone.trim() })) setEditing(false) }} disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                    <Check className="h-3.5 w-3.5" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-black text-gray-500 dark:border-gray-700">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="break-words font-serif text-[22px] font-black leading-tight text-[#111827] dark:text-white sm:text-3xl">{lead.name || 'No name given'}</h1>
                  <button onClick={() => { setEditName(lead.name || ''); setEditEmail(lead.email || ''); setEditPhone(lead.phone || ''); setEditing(true) }}
                    title="Edit name, email or phone"
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </div>
                <div className={`mt-3 grid gap-2 sm:mt-2 sm:flex sm:flex-wrap ${lead.phone && lead.email ? 'grid-cols-3' : lead.phone ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {lead.phone && (
                    <>
                      <a href={`tel:${dialable(lead.phone)}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2.5 text-xs font-black text-white transition hover:bg-black dark:bg-white dark:text-[#111827] sm:py-2">
                        <Phone className="h-3.5 w-3.5" /> Call
                      </a>
                      <a href={`sms:${dialable(lead.phone)}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-black sm:py-2 text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                        <MessageCircle className="h-3.5 w-3.5" /> Text
                      </a>
                    </>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-black sm:py-2 text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                </div>
                {/* The number + email, each with its own copy button. */}
                <div className="mt-2.5 flex flex-col items-start gap-1.5 text-[13px] font-semibold text-gray-500 dark:text-gray-400 sm:mt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                  {([['phone', lead.phone ? formatPhone(lead.phone) : null, Phone, 'Phone number'], ['email', lead.email, Mail, 'Email']] as const).filter(([, v]) => !!v).map(([kind, value, Icon, what]) => (
                    <span key={kind} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{value}</span>
                      <button onClick={() => copy(value as string, what)} title={`Copy ${what.toLowerCase()}`} aria-label={`Copy ${what.toLowerCase()}`}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-gray-200 text-gray-400 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:hover:text-[#e8c97a]">
                        <Copy className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {!lead.email && !lead.phone && <span>No contact info yet</span>}
                </div>
              </>
            )}
          </div>
          {/* Where they stand + do they have an agent - compact, top right. */}
          {!editing && (
            <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto">
              <LuxeSelect<LeadStatus>
                className="flex-1 sm:w-[128px] sm:flex-none"
                ariaLabel="Where they stand"
                value={status}
                onChange={v => { if (v !== status) setStatus(v) }}
                align="left"
                menuWidth={210}
                options={[
                  ...STATUSES.map(x => ({ value: x.id, label: x.label, dot: x.hex, hint: x.hint })),
                  ...(status === 'hidden' ? [{ value: 'hidden' as LeadStatus, label: 'Hidden', dot: '#9ca3af', hint: 'Off your lists' }] : []),
                ]}
              />
              <LuxeSelect<LeadRepresented>
                className="flex-1 sm:w-[128px] sm:flex-none"
                ariaLabel="Do they have an agent?"
                value={lead.represented}
                onChange={v => { if (v !== lead.represented) applyUpdate({ represented: v }) }}
                align="right"
                menuWidth={220}
                options={REPRESENTED.map(r => ({ value: r.id, label: r.label, dot: r.hex, hint: r.hint }))}
              />
            </div>
          )}
        </div>

        {(status === 'hidden' || lead.unsubscribed) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status === 'hidden' && (
              <button onClick={() => applyUpdate({ status: lead.status === 'hidden' || lead.status === 'archived' ? 'new' : lead.status })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">
                <Eye className="h-3.5 w-3.5" /> Hidden - show again
              </button>
            )}
            {lead.unsubscribed && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                <MailX className="h-3.5 w-3.5" /> Unsubscribed from emails
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* ── how they found you: a summary the timeline can't give at a glance - where they came
          from, their first and latest touch, and what they told you when they came in. (The
          first touch's full answers stay in Activity - "See it" jumps there.) */}
      {lead.origin && <OriginSummary lead={lead} originEvent={originEvent} onSeeIt={seeOrigin} />}

      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {/* ── what's waiting on the agent: their requests, then follow-ups */}
          {requests.length > 0 && (
            <Card>
              <SectionTitle>Waiting on you</SectionTitle>
              <div className="space-y-2">
                {requests.map(t => (
                  <div key={t.kind} className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 ${t.urgent ? 'bg-amber-50 dark:bg-amber-500/[0.08]' : 'bg-rose-50/70 dark:bg-rose-500/[0.07]'}`}>
                    <p className="flex min-w-0 basis-full items-center gap-2 text-sm font-bold text-[#111827] dark:text-white sm:basis-auto sm:flex-1">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${t.urgent ? 'bg-amber-500' : 'bg-rose-400'}`} /> {t.label}
                    </p>
                    {/* An in-app screen to handle it (their Showcase's tour requests, the open house
                        request, the form answer) opens that screen. A request made on a public
                        listing page / Spotlight has no such screen - the buyer-facing listing is
                        no place to book from - so Open jumps to the request in their Activity
                        (the home + the times they picked). */}
                    {t.href && !/^https?:/.test(t.href) ? (
                      <Link href={t.href} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white sm:ml-0 px-2.5 py-1.5 text-[11px] font-black text-[#8b7355] shadow-sm ring-1 ring-black/5 hover:text-[#111827] dark:bg-white/10 dark:text-[#e8c97a] dark:ring-white/10">
                        Open <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    ) : (t.href || requestEvent(t)) ? (
                      <button type="button" onClick={() => { const ev = requestEvent(t); if (ev) seeEvent(ev); else window.open(t.href!, '_blank', 'noopener,noreferrer') }}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg bg-white sm:ml-0 px-2.5 py-1.5 text-[11px] font-black text-[#8b7355] shadow-sm ring-1 ring-black/5 hover:text-[#111827] dark:bg-white/10 dark:text-[#e8c97a] dark:ring-white/10">
                        Open <ArrowDown className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button onClick={() => handled(t)} disabled={handling === t.kind} title="I've handled this - clear it"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-black text-gray-500 hover:bg-white hover:text-emerald-700 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-emerald-300">
                      {handling === t.kind ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Done
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {followupsOn && (
            <Card>
              <SectionTitle aside={<Link href="/leads/tasks" className="inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">All follow-ups <ArrowRight className="h-3 w-3" /></Link>}>
                Follow-ups
              </SectionTitle>
              <TasksPanel leadId={lead.id} leadName={lead.name} singleColumn onChanged={() => { reload(); onChanged?.() }} />
            </Card>
          )}

          {/* On a phone their Showcase comes before the long history (the side column is last). */}
          {(lead.showcases || []).length > 0 && <div className="space-y-4 lg:hidden">{(lead.showcases || []).map(sc => <ShowcaseCard key={sc.id} sc={sc} onCopy={copy} />)}</div>}

          {/* ── emails we sent them: opened / clicked, and whether automatic ones are on, weekly or off (and why) */}
          {lead.email && <LeadEmailCard email={lead.email} initial={lead.email_engagement} />}

          {/* ── everything they've done, newest first */}
          <div ref={activityTop} className="scroll-mt-20" />
          <Card>
            <SectionTitle aside={<span className="text-[11px] font-bold text-gray-400">{events.length} {events.length === 1 ? 'thing' : 'things'}</span>}>
              Activity
            </SectionTitle>
            <div className="mb-4 flex flex-wrap gap-1">
              {([['all', 'Everything'], ['asks', 'Forms & requests'], ['showcase', 'Showcase']] as [Filter, string][]).map(([id, label]) => (
                <button key={id} onClick={() => { setFilter(id); setPage(1) }}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${filter === id ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]'}`}>
                  {label}
                </button>
              ))}
            </div>
            {rows.length === 0 && <p className="py-6 text-center text-sm font-semibold text-gray-400">Nothing here yet.</p>}
            <div>
              {shownRows.map((row, i) => {
                const at = row.kind === 'event' ? row.e.occurred_at : row.items[0].occurred_at
                const day = dayLabel(at)
                const header = day !== lastDay ? day : null
                lastDay = day
                return (
                  <div key={row.kind === 'event' ? row.e.id : `v-${row.items[0].id}`} id={row.kind === 'event' ? `lead-ev-${row.e.id}` : undefined} className="-mx-2 scroll-mt-24 rounded-xl px-2">
                    {header && <p className={`mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 ${i ? 'mt-5' : ''}`}>{header}</p>}
                    {row.kind === 'views' ? (
                      <ViewsRow items={row.items} open={openRows.has(row.items[0].id)}
                        onToggle={() => setOpenRows(prev => { const n = new Set(prev); const k = row.items[0].id; if (n.has(k)) n.delete(k); else n.add(k); return n })} />
                    ) : (
                      <EventRow e={row.e} open={openRows.has(row.e.id)}
                        onToggle={() => setOpenRows(prev => { const n = new Set(prev); if (n.has(row.e.id)) n.delete(row.e.id); else n.add(row.e.id); return n })} />
                    )}
                  </div>
                )
              })}
            </div>
            {pages > 1 && (
              <div className="mt-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                <p className="mb-2 text-center text-[11px] font-bold text-gray-400">
                  {(curPage - 1) * PAGE + 1}-{Math.min(curPage * PAGE, rows.length)} of {rows.length}
                </p>
                <Pager page={curPage} pages={pages} onChange={goPage} prevLabel="Newer" nextLabel="Older" />
              </div>
            )}
          </Card>
        </div>

        {/* ── side: their Showcase, open houses, tags, notes, record */}
        <div className="min-w-0 space-y-4 sm:space-y-5">
          {(lead.showcases || []).map(sc => (
            <div key={sc.id} className="hidden lg:block"><ShowcaseCard sc={sc} onCopy={copy} /></div>
          ))}

          {!!lead.open_houses?.length && (
            <Card>
              <SectionTitle>Open houses they came to</SectionTitle>
              <div className="space-y-1.5">
                {(allOpenHouses ? lead.open_houses : lead.open_houses.slice(0, OPEN_HOUSES_SHOWN)).map(oh => (
                  <Link key={oh.id} href={`/open-houses/visitors/${oh.id}`}
                    className="flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
                      {oh.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={oh.image} alt="" className="h-full w-full object-cover" />
                        : <Home className="m-2.5 h-4 w-4 text-gray-400" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-[#111827] dark:text-white">{oh.address || 'Open house'}</span>
                      <span className="block truncate text-[11px] text-gray-400">{[oh.city, oh.is_deleted ? 'Past' : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                  </Link>
                ))}
              </div>
              {lead.open_houses.length > OPEN_HOUSES_SHOWN && (
                <button onClick={() => setAllOpenHouses(v => !v)} className="mt-2 w-full text-center text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">
                  {allOpenHouses ? 'Show fewer' : `Show all ${lead.open_houses.length}`}
                </button>
              )}
            </Card>
          )}

          <Card>
            <SectionTitle>Notes</SectionTitle>
            <NotesThread notes={notesShown} loading={notesLoading} currentUserId={user?.id}
              onAdd={async text => { const r = await api.leads.addNote(lead.id, { text }); if (r.success && r.data) { setNotesList(c => [r.data!, ...c]); setNotesPage(1) } }}
              onEdit={async (id, text) => { const r = await api.leads.updateNote(id, text); if (r.success && r.data) setNotesList(c => c.map(n => n.id === id ? r.data! : n)) }}
              onDelete={async id => { const r = await api.leads.deleteNote(id); if (r.success) setNotesList(c => c.filter(n => n.id !== id)) }} />
            <Pager page={Math.min(notesPage, notePages)} pages={notePages} onChange={n => setNotesPage(Math.min(Math.max(1, n), notePages))} prevLabel="Newer" nextLabel="Older" className="mt-3" />
            <p className="mt-2 text-[10px] font-semibold text-gray-400">Also shows on their open house sign-in and on their follow-ups.</p>
          </Card>

          <Card>
            <SectionTitle>Tags</SectionTitle>
            {lead.tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {lead.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">
                    <Tag className="h-3 w-3" /> {tag}
                    <button onClick={() => applyUpdate({ tags: lead.tags.filter(t => t !== tag) })} aria-label={`Remove ${tag}`} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); const v = tagInput.trim(); if (!v) return; setTagInput(''); applyUpdate({ tags: Array.from(new Set([...lead.tags, v])) }) }}>
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add a tag..."
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
              <button type="submit" aria-label="Add tag" className="rounded-xl border border-gray-200 p-1.5 text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700"><Plus className="h-3.5 w-3.5" /></button>
            </form>
          </Card>

          <Card>
            <SectionTitle>Record</SectionTitle>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2"><dt className="font-bold text-gray-400">Lead since</dt><dd className="text-right font-semibold text-[#111827] dark:text-white">{exactTime(lead.created_at)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="font-bold text-gray-400">Last contacted</dt><dd className="text-right font-semibold text-[#111827] dark:text-white">{lead.last_contacted_at ? exactTime(lead.last_contacted_at) : 'Not yet'}</dd></div>
              {lead.latest && !lead.origin && <div className="flex justify-between gap-2"><dt className="font-bold text-gray-400">Last active</dt><dd className="text-right font-semibold text-[#111827] dark:text-white">{timeAgo(lead.latest.at)}</dd></div>}
            </dl>
            <button onClick={() => applyUpdate({ mark_contacted: true })} disabled={saving}
              className="mt-3 w-full rounded-xl bg-[#111827] px-3 py-2 text-xs font-black text-white transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]">
              {lead.last_contacted_at ? 'Contacted them again' : 'Mark contacted'}
            </button>
            <p className="mt-1.5 text-[10px] font-semibold text-gray-400">Checking off a follow-up does this for you.</p>
            <div className="mt-4 flex gap-1.5 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
              {status !== 'hidden' && (
                <button onClick={() => setStatus('hidden')} disabled={saving} title="Take them off your lists - nothing is deleted"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-gray-200 px-2 py-2 text-[11px] font-black text-gray-500 hover:border-gray-300 hover:text-[#111827] dark:border-white/10 dark:text-gray-400 dark:hover:text-white">
                  <EyeOff className="h-3.5 w-3.5" /> Hide
                </button>
              )}
              <button onClick={() => setConfirmDelete(true)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-red-200 px-2 py-2 text-[11px] font-black text-red-600 hover:bg-red-50 dark:border-red-500/25 dark:text-red-300 dark:hover:bg-red-500/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </Card>
        </div>
      </div>

      <MotionModal open={confirmDelete} onBackdropClick={() => setConfirmDelete(false)} className="z-[60] bg-black/55">
        <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#151517]">
          <h3 className="text-lg font-black text-[#111827] dark:text-white">Delete {lead.name || 'this lead'}?</h3>
          <p className="mt-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
            This permanently removes them, their activity and their notes. To just get them off your lists, use <b>Hide</b> instead - you can bring them back any time.
          </p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold dark:border-white/10 dark:text-white">Keep</button>
            <button onClick={remove} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </MotionModal>
    </div>
  )

}

function EventRow({ e, open, onToggle }: { e: LeadEvent; open: boolean; onToggle: () => void }) {
  const m = activityMeta(e.source_type)
  // Anything the line itself already says (a short comment it quotes) isn't repeated underneath.
  const said = e.summary.toLowerCase()
  const details = eventDetails(e.raw_snapshot, e.source_type).filter(r => !said.includes(r.value.toLowerCase()))
  const link = e.link
  const shownDetails = open ? details : details.slice(0, 3)
  return (
    <div className="flex gap-3 pb-4">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[m.tone]}`}><m.icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0 flex-1 border-b border-gray-100 pb-4 dark:border-white/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 text-sm font-semibold text-[#111827] dark:text-white">{e.summary}</p>
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-400" title={exactTime(e.occurred_at)}>{clock(e.occurred_at)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${TONE_CLASSES[m.tone]}`}>{m.label}</span>
          {link && (link.external ? (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#d7b974]">
              {link.label} <ArrowUpRight className="h-3 w-3" />
            </a>
          ) : (
            <Link href={link.href} className="inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#d7b974]">
              {link.label} <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
        {e.came_from && e.source_type !== 'property_comment' && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400"><Compass className="mt-px h-3.5 w-3.5 shrink-0" /> {e.came_from}</p>
        )}
        {details.length > 0 && (
          <div className="mt-2 rounded-xl bg-[#fbfaf7] p-3 text-xs dark:bg-white/[0.03]">
            <dl className="divide-y divide-gray-200/70 dark:divide-white/[0.06]">
              {shownDetails.map((r, k) => r.long ? (
                <div key={k} className="py-1.5 first:pt-0 last:pb-0">
                  <dt className="font-bold text-gray-400">{r.label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words font-semibold leading-snug text-[#111827] dark:text-white">{r.value}</dd>
                </div>
              ) : (
                <div key={k} className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                  <dt className="min-w-0 font-bold text-gray-400">{r.label}</dt>
                  <dd className="max-w-[60%] break-words text-right font-semibold text-[#111827] dark:text-white">{r.value}</dd>
                </div>
              ))}
            </dl>
            {details.length > 3 && (
              <button onClick={onToggle} className="mt-2 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#d7b974]">
                {open ? 'Show less' : `Show all ${details.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ViewsRow({ items, open, onToggle }: { items: LeadEvent[]; open: boolean; onToggle: () => void }) {
  const m = activityMeta('showcase_view')
  const homes = items.map(e => (e.property_address || '').split(',')[0]).filter(Boolean)
  const single = items.length === 1
  return (
    <div className="flex gap-3 pb-4">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[m.tone]}`}><m.icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0 flex-1 border-b border-gray-100 pb-4 dark:border-white/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 text-sm font-semibold text-gray-600 dark:text-gray-300">
            {single ? items[0].summary : `Looked at ${items.length} homes in their Showcase`}
          </p>
          <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-400">{clock(items[0].occurred_at)}</span>
        </div>
        {!single && (
          <>
            <button onClick={onToggle} className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#d7b974]">
              {open ? 'Hide homes' : 'Which homes'}
            </button>
            {open && <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{homes.join(' · ')}</p>}
          </>
        )}
      </div>
    </div>
  )
}

function ShowcaseCard({ sc, onCopy }: { sc: LeadShowcase; onCopy: (text: string, what: string) => void }) {
  return (
    <Card>
      <SectionTitle>Their Showcase</SectionTitle>
      <p className="truncate text-sm font-black text-[#111827] dark:text-white">{sc.name || 'Showcase'}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-xl bg-gray-50 py-2 dark:bg-white/[0.04]"><p className="text-base font-black text-[#111827] dark:text-white">{sc.home_count}</p><p className="text-[10px] font-bold text-gray-400">Homes</p></div>
        <div className="rounded-xl bg-rose-50 py-2 dark:bg-rose-500/[0.08]"><p className="flex items-center justify-center gap-1 text-base font-black text-rose-600 dark:text-rose-300"><Heart className="h-3.5 w-3.5" />{sc.liked}</p><p className="text-[10px] font-bold text-gray-400">Liked</p></div>
        <div className="rounded-xl bg-gray-50 py-2 dark:bg-white/[0.04]"><p className="flex items-center justify-center gap-1 text-base font-black text-gray-600 dark:text-gray-300"><ThumbsDown className="h-3.5 w-3.5" />{sc.disliked}</p><p className="text-[10px] font-bold text-gray-400">Passed</p></div>
      </div>
      <div className="mt-3 space-y-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
        {sc.new_matches > 0 && <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> {sc.new_matches} new {sc.new_matches === 1 ? 'match' : 'matches'} since you last looked</p>}
        <p>{sc.last_active_at ? `Last active ${timeAgo(sc.last_active_at).toLowerCase()}` : "Hasn't opened it yet"}</p>
        <p>{sc.emails_on ? 'Gets Showcase emails' : 'Turned Showcase emails off'}</p>
        {sc.refine_message && <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Asked for: &ldquo;{sc.refine_message}&rdquo;</p>}
      </div>
      <div className="mt-3 flex gap-1.5">
        <Link href={`/showcases?showcase=${sc.id}`} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#111827] px-3 py-2 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">
          <Building2 className="h-3.5 w-3.5" /> Open
        </Link>
        {sc.share_token && (
          <button onClick={() => onCopy(`${window.location.origin}/showcase/${sc.share_token}`, 'Their Showcase link')}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-[11px] font-black text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">
            <Copy className="h-3.5 w-3.5" /> Their link
          </button>
        )}
      </div>
    </Card>
  )
}

// "How they found you": where they came from, first vs latest touch, and the key things they told
// you when they came in - the parts of the timeline an agent wants before calling, in one card.
function OriginSummary({ lead, originEvent, onSeeIt }: { lead: LeadDetail; originEvent: LeadEvent | null; onSeeIt: () => void }) {
  const origin = lead.origin!
  const latest = lead.latest
  const group = ORIGIN_META[lead.origin_group || origin.group || 'other'] || ORIGIN_META.other
  const m = activityMeta(origin.type)
  const sameAsFirst = !latest || new Date(latest.at).getTime() === new Date(origin.at).getTime()
  const repeat = !sameAsFirst && latest!.label === origin.label  // did the same thing again later
  const lm = latest ? activityMeta(latest.type) : null
  // What they told you: the short answers as chips, the first long one (a question / message) as a quote.
  const details = originEvent ? eventDetails(originEvent.raw_snapshot, originEvent.source_type) : []
  const said = origin.label.toLowerCase()
  // (Their name / email / phone are already at the top of the lead.)
  const contact = [lead.name, lead.email, lead.phone ? formatPhone(lead.phone) : null, lead.phone].filter(Boolean).map(v => String(v).toLowerCase())
  const isContact = (d: { label: string; value: string }) => /^(full |first |last )?name$|e-?mail|phone/i.test(d.label) || contact.includes(d.value.toLowerCase())
  const useful = details.filter(d => !isContact(d))
  const chips = useful.filter(d => !d.long && !said.includes(d.value.toLowerCase())).slice(0, 4)
  const quote = useful.find(d => d.long)
  const more = useful.length - chips.length - (quote ? 1 : 0)
  const Cell = ({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) => (
    <div className="min-w-0 px-4 py-2.5 sm:py-3">
      <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <div className="mt-1 text-[13px] font-bold leading-snug text-[#111827] dark:text-white">{children}</div>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#fbf6ea] via-white to-white shadow-sm dark:border-[#C9A24D]/20 dark:from-[#C9A24D]/[0.08] dark:via-[#151517] dark:to-[#151517] sm:mt-5">
      <div className="flex items-center justify-between gap-2 border-b border-[#C9A24D]/15 px-4 py-2 dark:border-white/[0.06]">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">
          <Compass className="h-3.5 w-3.5" /> How they found you
        </p>
        <button onClick={onSeeIt} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-black text-[#8b7355] transition hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
          See it in Activity <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="grid divide-y divide-[#C9A24D]/10 dark:divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Cell label="Came from" sub={origin.came_from || undefined}>
          <span className="flex items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[m.tone]}`}><group.icon className="h-3.5 w-3.5" /></span>
            <span className="truncate">{group.label}</span>
          </span>
        </Cell>
        <Cell label="First touch" sub={exactTime(origin.at)}>
          <span className="line-clamp-2">{origin.label}</span>
        </Cell>
        <Cell label="Latest" sub={sameAsFirst ? undefined : `${timeAgo(latest!.at)} · ${repeat ? 'again' : lm!.label}`}>
          {sameAsFirst ? <span className="font-semibold text-gray-500 dark:text-gray-400">Nothing new since they came in</span>
            : <span className="line-clamp-2">{latest!.label}</span>}
        </Cell>
      </div>
      {(chips.length > 0 || quote) && (
        <div className="border-t border-[#C9A24D]/15 px-4 py-2.5 dark:border-white/[0.06]">
          <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-gray-400">What they told you</p>
          {quote && <p className="mt-1 line-clamp-2 text-[13px] font-semibold italic text-[#111827] dark:text-white">&ldquo;{quote.value}&rdquo;</p>}
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <span key={i} className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-inset ring-[#C9A24D]/20 dark:bg-white/[0.05] dark:text-gray-300 dark:ring-white/10">
                  <span className="shrink-0 text-gray-400">{c.label}</span> <span className="truncate font-black text-[#111827] dark:text-white">{c.value}</span>
                </span>
              ))}
              {more > 0 && <button onClick={onSeeIt} className="rounded-full px-2 py-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">+{more} more</button>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
