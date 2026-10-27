'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle, ArrowRight, ArrowUpDown, BellRing, ChevronDown, Flame, ListChecks, CalendarClock, CalendarDays, Check, Compass, Download, Eye, EyeOff, Home, Loader2, Mail, MailX,
  CheckCheck, MessageCircle, MoreHorizontal, Pencil, Phone, Search, ShieldCheck, Sparkles, Star, Tag, Trash2, UserCheck, Users, X,
} from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { copyText } from '@/lib/copyText'
import LuxeSelect from '@/components/ui/LuxeSelect'
import MotionModal from '@/components/ui/MotionModal'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { useIsPhone, useLastValue } from '@/components/ui/windowMotion'
import api from '@/lib/api-service'
import { Lead, LeadOpenHouse, LeadOriginGroup, LeadStatus, LeadTodo } from '@/types'
import { useToast } from '@/contexts/ToastContext'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import { normalizedStatus, STATUS_LABEL, STATUS_PILL } from '@/components/leads/LeadDetailPanel'
import LuxeHero, { LuxeTabs } from '@/components/ui/LuxeHero'
import { CrmChip } from '@/components/tasks/TasksPanel'
import { useFollowupsEnabled } from '@/components/tasks/FollowupsSwitch'
import { activityMeta, dialable, ORIGIN_META, TONE_CLASSES, timeAgo, todoWhen } from '@/lib/leadActivity'
import { formatPhone } from '@/lib/leadEventDetails'
import Pager from '@/components/ui/Pager'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import { PopupPortal, useAnchoredStyle } from '@/components/ui/AnchoredPopup'

// The tabs (user, 10/17): what needs the agent, then everyone without an agent (the default -
// plus anyone with an agent you left a note on), then the pipeline, then All next to the two side piles.
type View = 'needs' | 'no_agent' | 'all' | 'new' | 'contacted' | 'in_talks' | 'signed' | 'has_agent' | 'hidden'
const VIEWS: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'needs', label: 'Needs you', icon: BellRing },
  { id: 'no_agent', label: 'No agent', icon: UserCheck },
  { id: 'new', label: 'New', icon: Sparkles },
  { id: 'contacted', label: 'Contacted', icon: MessageCircle },
  { id: 'in_talks', label: 'In talks', icon: CalendarClock },
  { id: 'signed', label: 'Signed', icon: Check },
  { id: 'all', label: 'All', icon: Users },
  { id: 'has_agent', label: 'Has agent', icon: ShieldCheck },
  { id: 'hidden', label: 'Hidden', icon: EyeOff },
]

type Sort = 'needs' | 'warmth' | 'recent' | 'newest' | 'name' | 'email_most' | 'email_least'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'needs', label: 'Action needed first' },
  { id: 'warmth', label: 'Warmest first' },
  { id: 'recent', label: 'Latest activity' },
  { id: 'newest', label: 'Newest leads' },
  { id: 'name', label: 'Name A-Z' },
  { id: 'email_most', label: 'Opens my emails most' },
  { id: 'email_least', label: 'Opens my emails least' },
]

// Look-back windows for the header's "new leads" number.
type StatPeriod = '7d' | '30d' | '90d' | 'ytd' | 'all'
const PERIODS: { id: StatPeriod; label: string }[] = [
  { id: '7d', label: 'This week' }, { id: '30d', label: 'Last 30 days' }, { id: '90d', label: 'Last 3 months' },
  { id: 'ytd', label: 'This year' }, { id: 'all', label: 'All time' },
]
function periodStart(p: StatPeriod): number {
  const now = new Date()
  if (p === 'all') return 0
  if (p === 'ytd') return new Date(now.getFullYear(), 0, 1).getTime()
  return now.getTime() - ({ '7d': 7, '30d': 30, '90d': 92 }[p]) * 864e5
}

const PAGE = 25
const latestAt = (l: Lead) => new Date(l.latest?.at || l.created_at).getTime()
const firstDue = (l: Lead) => Math.min(...(l.todos || []).filter(t => t.kind === 'followup' && t.due_at).map(t => new Date(t.due_at!).getTime()), Infinity)
const digits = (s?: string | null) => (s || '').replace(/\D/g, '')
const emailRate = (l: Lead, none: number) => l.email_engagement?.rate ?? none
// Red on the list: something waiting on the agent, or something new they haven't opened.
const isRed = (l: Lead) => !!(l.needs_you || l.needs_attention)

function inView(l: Lead, v: View): boolean {
  const status = normalizedStatus(l)
  if (v === 'hidden') return status === 'hidden'
  if (status === 'hidden') return false
  if (v === 'all') return true
  if (v === 'has_agent') return l.represented === 'yes'
  if (v === 'no_agent') return l.represented !== 'yes' || !!l.has_note  // noted ones stay here too
  if (l.represented === 'yes') return false  // someone else's client - only under "Has an agent"
  if (v === 'needs') return !!l.needs_you
  return status === v
}

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPageInner />
    </Suspense>
  )
}

function LeadsPageInner() {
  const params = useSearchParams()
  const { showToast } = useToast()
  const followupsOn = useFollowupsEnabled().enabled !== false
  const [leads, setLeads] = useState<Lead[]>([])
  const [hiddenLeads, setHiddenLeads] = useState<Lead[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View | null>(null)
  const [search, setSearch] = useState('')
  const [origin, setOrigin] = useState<LeadOriginGroup | 'any'>('any')
  const [tag, setTag] = useState('')
  const [openHouseId, setOpenHouseId] = useState<string>('')
  const [openHouses, setOpenHouses] = useState<LeadOpenHouse[]>([])
  const [sort, setSort] = useState<Sort>('needs')
  const [page, setPage] = useState(1)
  const [period, setPeriod] = useState<StatPeriod>('30d')
  const [followupCount, setFollowupCount] = useState<number | null>(null)
  const [selectedLeadId, setSelectedLeadIdRaw] = useState<string | null>(params.get('lead'))
  // The address bar follows the open lead (?lead=<id>): reload with one open reopens it, and backing
  // out of it takes the id off - so a reload after closing shows the list, not that lead again.
  const setSelectedLeadId = useCallback((id: string | null) => {
    setSelectedLeadIdRaw(id)
    try {
      const url = new URL(window.location.href)
      if (id) url.searchParams.set('lead', id); else url.searchParams.delete('lead')
      window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash)
    } catch { /* harmless */ }
  }, [])
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null)
  const [exporting, setExporting] = useState(false)
  const [confirmSeenAll, setConfirmSeenAll] = useState(false)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => { setNarrow(window.innerWidth < 640) }, [])
  const [pageDir, setPageDir] = useState(0)
  const listTopRef = useRef<HTMLDivElement>(null)
  const deleteShown = useLastValue(confirmDelete)  // stays on screen while the window closes

  const load = useCallback(async () => {
    const r = await api.leads.list({ sort: 'activity' })
    if (r.success && r.data) setLeads(r.data)
    setLoading(false)
  }, [])
  const loadHidden = useCallback(async () => {
    const r = await api.leads.list({ hidden: true, sort: 'activity' })
    if (r.success && r.data) setHiddenLeads(r.data)
  }, [])
  const refresh = useCallback(() => { load(); if (hiddenLeads !== null) loadHidden() }, [load, loadHidden, hiddenLeads])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (view === 'hidden' && hiddenLeads === null) loadHidden() }, [view, hiddenLeads, loadHidden])
  useEffect(() => {
    api.leads.getOpenHouseHistory().then(r => { if (r.success && r.data) setOpenHouses(r.data) })
    api.tasks.counts().then(r => { if (r.success && r.data) setFollowupCount(r.data.overdue + r.data.today) })
    // Opening Leads = seeing the new-lead alerts (every kind of lead that lands here - the rows keep
    // their red dot until each one is opened). Showcase likes / search requests clear on Showcases.
    api.notifications.markTypesAsRead(['OPEN_HOUSE_SIGN_IN', 'OPEN_HOUSE_SECOND_VISIT', 'OPEN_HOUSE_DISCLOSURE', 'FORM_SUBMISSION', 'TOUR_REQUEST', 'PROPERTY_COMMENT', 'PROPERTY_INQUIRY', 'PORTAL_LEAD', 'LEAD'])
      .then(() => window.dispatchEvent(new Event('leads-notification-count:refresh')))
  }, [])

  const all = useMemo(() => [...leads, ...(hiddenLeads || [])], [leads, hiddenLeads])
  const counts = useMemo(() => {
    const c = {} as Record<View, number>
    for (const v of VIEWS) c[v.id] = v.id === 'hidden' ? (hiddenLeads?.length ?? 0) : leads.filter(l => inView(l, v.id)).length
    return c
  }, [leads, hiddenLeads])

  // Lands on "No agent" - the people worth working (user, 10/17).
  useEffect(() => { if (view === null && !loading) setView('no_agent') }, [view, loading])
  const activeView: View = view || 'no_agent'
  useEffect(() => { setPage(1) }, [activeView, search, origin, tag, openHouseId, sort])

  const originsPresent = useMemo(() => {
    const m = new Map<LeadOriginGroup, number>()
    for (const l of leads) m.set(l.origin_group || 'other', (m.get(l.origin_group || 'other') || 0) + 1)
    return m
  }, [leads])
  // Every tag the agent has put on a lead, most used first.
  const tagsPresent = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of all) for (const t of l.tags || []) m.set(t, (m.get(t) || 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [all])
  useEffect(() => { if (tag && !tagsPresent.some(([t]) => t === tag)) setTag('') }, [tag, tagsPresent])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const qd = digits(q)
    const list = (activeView === 'hidden' ? hiddenLeads || [] : leads).filter(l => {
      if (!inView(l, activeView)) return false
      if (origin !== 'any' && (l.origin_group || 'other') !== origin) return false
      if (tag && !(l.tags || []).includes(tag)) return false
      if (openHouseId && !l.open_houses?.some(oh => oh.id === openHouseId)) return false
      if (q && !((l.name || '').toLowerCase().includes(q) || (l.email || '').includes(q) || (qd.length >= 3 && digits(l.phone).includes(qd))
        // ...or the open house they came to / Cheat Sheet they scanned (user, 10/21)
        || (l.places || []).some(p => p.toLowerCase().includes(q))
        || (l.open_houses || []).some(oh => `${oh.address || ''} ${oh.city || ''}`.toLowerCase().includes(q)))) return false
      return true
    })
    const by = {
      // Red first, then within red: waiting on you (soonest due), then just-new; then latest activity.
      needs: (a: Lead, b: Lead) => (Number(isRed(b)) - Number(isRed(a))) || (Number(!a.needs_you) - Number(!b.needs_you)) || (a.needs_you ? firstDue(a) - firstDue(b) : 0) || latestAt(b) - latestAt(a),
      recent: (a: Lead, b: Lead) => latestAt(b) - latestAt(a),
      // Most active right now first; on a tie, the one heating up (a jump on their usual week) wins.
      warmth: (a: Lead, b: Lead) => (b.warmth || 0) - (a.warmth || 0) || (Number(!!b.heating_up) - Number(!!a.heating_up)) || latestAt(b) - latestAt(a),
      newest: (a: Lead, b: Lead) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      name: (a: Lead, b: Lead) => (a.name || a.email || '').localeCompare(b.name || b.email || ''),
      // Email engagement: % of the last 90 days' emails they opened (never emailed = last either way).
      email_most: (a: Lead, b: Lead) => emailRate(b, -1) - emailRate(a, -1) || (b.email_engagement?.clicked || 0) - (a.email_engagement?.clicked || 0),
      email_least: (a: Lead, b: Lead) => emailRate(a, 101) - emailRate(b, 101) || (b.email_engagement?.unopened_in_a_row || 0) - (a.email_engagement?.unopened_in_a_row || 0),
    }[sort]
    return [...list].sort(by)
  }, [leads, hiddenLeads, activeView, origin, tag, openHouseId, search, sort])

  const pages = Math.max(1, Math.ceil(visible.length / PAGE))
  const curPage = Math.min(page, pages)
  const unseenCount = leads.filter(l => l.needs_attention).length
  const markAllSeen = async () => {
    setConfirmSeenAll(false)
    setLeads(prev => prev.map(l => ({ ...l, needs_attention: false })))
    const r = await api.leads.markAllSeen()
    if (r.success) { showToast('All leads marked as seen', 'success'); window.dispatchEvent(new Event('leads-notification-count:refresh')) }
    else { showToast(r.error || "Couldn't mark them seen - try again", 'error'); load() }
  }
  const since = periodStart(period)
  const newInPeriod = leads.filter(l => new Date(l.created_at).getTime() >= since).length
  const emailsSlowed = leads.filter(l => l.email_engagement && l.email_engagement.mode !== 'daily' && !['unsubscribed', 'bounced', 'spam'].includes(l.email_engagement.code || '') && !l.unsubscribed).length

  // Row actions.
  const setStatus = async (lead: Lead, status: LeadStatus) => {
    setMenuFor(null); setBusyId(lead.id)
    const r = status === 'hidden' ? await api.leads.hide(lead) : await api.leads.update(lead.id, { status })
    if (!r.success) showToast(r.error || "Couldn't update this lead", 'error')
    await load(); if (hiddenLeads !== null || status === 'hidden') await loadHidden()
    setBusyId(null)
  }
  const markContacted = async (lead: Lead) => {
    setMenuFor(null); setBusyId(lead.id)
    const r = await api.leads.update(lead.id, { mark_contacted: true })
    if (r.success) showToast(`${lead.name || 'Lead'} marked contacted`, 'success')
    await load(); setBusyId(null)
  }
  // Star / unstar this person - shows at once, rolls back if the save fails.
  const toggleFavorite = async (lead: Lead) => {
    const next = !lead.is_favorite
    const flip = (v: boolean) => (l: Lead) => l.id === lead.id ? { ...l, is_favorite: v } : l
    setLeads(prev => prev.map(flip(next)))
    setHiddenLeads(prev => prev ? prev.map(flip(next)) : prev)
    const r = await api.leads.update(lead.id, { is_favorite: next })
    if (!r.success) {
      setLeads(prev => prev.map(flip(!next)))
      setHiddenLeads(prev => prev ? prev.map(flip(!next)) : prev)
      showToast(r.error || "Couldn't star this lead", 'error')
    }
  }
  const markSeen = (lead: Lead) => {
    setMenuFor(null)
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, needs_attention: false } : l))
    api.leads.get(lead.id)  // opening a lead marks it seen
  }
  const doDelete = async () => {
    const lead = confirmDelete
    if (!lead) return
    setBusyId(lead.id)
    const r = await api.leads.delete(lead.id)
    if (r.success) {
      setConfirmDelete(null)
      showToast(r.data?.message || `${lead.name || 'Lead'} deleted`, 'success')
      await load(); if (hiddenLeads !== null) await loadHidden()
    } else showToast(r.error || "Couldn't delete this lead", 'error')
    setBusyId(null)
  }
  const exportCsv = async () => {
    setExporting(true)
    // Exactly the leads on screen - this tab, search, filters and sort.
    try { await api.leads.downloadCsv({ ids: visible.map(l => l.id), hidden: activeView === 'hidden' }) } catch { showToast("Couldn't export - try again", 'error') }
    setExporting(false)
  }

  const viewLabel = (id: View) => {
    const v = VIEWS.find(x => x.id === id)!
    const n = counts[id]
    return id === 'hidden' && hiddenLeads === null ? v.label : `${v.label} ${n}`
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      {/* While a lead is open, the header's ambient animations (aurora, gold sweep, sparkles) are
          paused - nobody can see them under the window, and they'd keep the GPU busy while the
          lead scrolls. */}
      <div className={`mx-auto max-w-6xl px-4 py-4 sm:py-6 ${selectedLeadId ? 'leads-behind-window' : ''}`}>
        <style>{'.leads-behind-window *,.leads-behind-window *::after{animation-play-state:paused!important}'}</style>
        <LuxeHero
          compact
          // Above the toolbar below, so the header's dropdown menus open over it.
          className="relative z-20"
          kicker="Leads"
          icon={Users}
          title={<>Every lead, <em>one place.</em></>}
          subtitle="Everyone who signs in, fills out a form, asks about a home or uses their Showcase - one lead per person, with everything they've done."
          asideClassName="w-full lg:w-[460px] lg:-mt-1 xl:w-[600px]"
          aside={
            <div className="flex w-full flex-col gap-2">
              {/* One thin row: sending leads on, the two pages agents jump to, and Action Plans (soon) beside Email Tracker. */}
              <div className="grid grid-cols-2 items-stretch gap-1.5 xl:grid-cols-4 [&>*]:min-w-0 [&>*]:justify-center">
                <CrmChip />
                {followupsOn && (
                  <Link href="/leads/tasks" title="Every follow-up - overdue, today and coming up"
                    className="group relative inline-flex items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2.5 py-2 text-xs font-black text-[#111827] shadow-md shadow-[#C9A24D]/30 sm:px-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <CalendarClock className="ohp-icon-draw ohp-icon-assemble-calendar relative h-3.5 w-3.5" /> <span className="relative">Follow-ups</span>
                    {followupCount != null && followupCount > 0 && <span className="relative rounded-full bg-[#111827] px-1.5 text-[10px] font-black leading-4 text-[#e8c97a]">{followupCount}</span>}
                  </Link>
                )}
                {/* Every client email + opens / clicks, who is on weekly or off, and the "send from my email" switch. */}
                <Link href="/leads/emails" title="Every email your clients got - opened, clicked, who gets fewer, and which address they come from"
                  className={`group relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-2 text-xs font-black shadow-md sm:px-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${emailsSlowed > 0
                    ? 'border-amber-300 bg-amber-50 text-amber-800 shadow-amber-500/10 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'border-[#C9A24D]/35 bg-white text-[#111827] shadow-[#C9A24D]/10 hover:border-[#C9A24D] dark:border-white/15 dark:bg-white/[0.07] dark:text-white'}`}>
                  <Mail className={`ohp-icon-draw ohp-icon-assemble-mail h-3.5 w-3.5 ${emailsSlowed > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-[#8b7355] dark:text-[#e8c97a]'}`} /> Email Tracker
                  {emailsSlowed > 0 && <span title="Leads whose automatic emails are now weekly or off" className="rounded-full bg-amber-500 px-1.5 text-[10px] font-black leading-4 text-white">{emailsSlowed}</span>}
                </Link>
                {/* Coming soon (Future Feature Ideas on the launch checklist): a series of follow-ups over
                    weeks - day 1, 3, 7, 30 - instead of one at a time. Not a link yet. */}
                <span aria-disabled title="Action Plans - coming soon: a series of follow-ups over weeks (day 1, 3, 7, 30) for each new lead, instead of one at a time"
                  className="relative inline-flex cursor-default items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-dashed border-[#C9A24D]/45 bg-white/60 px-2.5 py-2 text-xs font-black text-gray-500 sm:px-3.5 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/50">
                  <ListChecks className="h-3.5 w-3.5 shrink-0 text-[#8b7355]/70 dark:text-[#e8c97a]/60" /> Action Plans
                  <span className="absolute -right-1 -top-2 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-1.5 text-[8.5px] font-black uppercase leading-4 tracking-wide text-[#111827] shadow-sm">Soon</span>
                </span>
              </div>
              {/* The numbers - just to read, not buttons (the tabs below do the switching). */}
              <div className="flex w-fit max-w-full items-center gap-2 self-center rounded-full sm:self-end border border-[#C9A24D]/25 bg-white/70 py-1 pl-3.5 pr-1 shadow-sm dark:border-white/10 dark:bg-white/[0.05] sm:gap-2.5 sm:pl-4">
                <span className={`flex min-w-0 items-center gap-1.5 rounded-full ${counts.needs > 0 ? 'text-red-600 dark:text-red-300' : 'text-[#111827] dark:text-white'}`} title="Leads waiting on you">
                  <span className="relative hidden h-3.5 w-3.5 shrink-0 sm:block">
                    <BellRing className={`h-3.5 w-3.5 ${counts.needs > 0 ? 'text-red-500' : 'text-[#8b7355] dark:text-[#e8c97a]'}`} />
                  </span>
                  <span className="font-serif text-lg font-black leading-none tabular-nums"><AnimatedNumber value={counts.needs} duration={600} /></span>
                  <span className="whitespace-nowrap text-[9.5px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-white/50">Need you</span>
                </span>
                <span aria-hidden className="h-5 w-px shrink-0 bg-[#C9A24D]/30 dark:bg-white/10" />
                <span className="flex min-w-0 items-center gap-1.5 text-[#111827] dark:text-white" title="New leads in the period on the right">
                  <Sparkles className="hidden h-3.5 w-3.5 shrink-0 text-[#8b7355] dark:text-[#e8c97a] sm:block" />
                  <span className="font-serif text-lg font-black leading-none tabular-nums"><AnimatedNumber value={newInPeriod} duration={600} /></span>
                  <span className="whitespace-nowrap text-[9.5px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-white/50">New</span>
                </span>
                <LuxeSelect<StatPeriod>
                  className="w-[128px] shrink-0 sm:w-[140px] [&>button]:rounded-full"
                  ariaLabel="New leads over"
                  icon={<CalendarDays className="hidden h-3 w-3 sm:block" />}
                  value={period}
                  onChange={setPeriod}
                  align="right"
                  menuWidth={190}
                  options={PERIODS.map(p => ({ value: p.id, label: p.label }))}
                />
              </div>
            </div>
          }
          tabs={
            <LuxeTabs
              label="Leads view"
              active={activeView}
              onChange={v => setView(v)}
              items={VIEWS.map(v => ({ id: v.id, label: viewLabel(v.id), icon: v.icon }))}
            />
          }
        />

        {/* ── find someone: search, where they came from, order, export */}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-white/[0.08] dark:bg-[#151517] sm:flex sm:flex-wrap">
          <div className="relative min-w-0 sm:min-w-[200px] sm:flex-[2]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={narrow ? "Name, email or address" : "Search name, email, phone or open house"}
              className="w-full rounded-xl border border-gray-200 bg-[#faf9f7] py-2.5 pl-9 pr-8 text-sm font-semibold outline-none transition focus:border-[#C9A24D] focus:bg-white dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
          </div>
          <LuxeSelect<string>
            className="w-[104px] sm:w-auto sm:min-w-[140px] sm:flex-1 [&>button]:py-2.5 [&_ul]:max-h-[320px] [&_ul]:!overflow-y-auto"
            ariaLabel="Tags"
            icon={<Tag className="h-3.5 w-3.5" />}
            value={tag}
            placeholderValue=""
            onChange={setTag}
            menuWidth={240}
            options={[
              { value: '', label: 'Tags', hint: tagsPresent.length ? undefined : 'Add tags inside a lead' },
              ...tagsPresent.map(([t, n]) => ({ value: t, label: t, hint: `${n} ${n === 1 ? 'lead' : 'leads'}`, icon: <Tag className="h-3.5 w-3.5" /> })),
            ]}
          />
          {/* Row 2 on phones; part of the same wrapping row from sm: up (sm:contents). */}
          <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:contents">
          <LuxeSelect<LeadOriginGroup | 'any'>
            className="min-w-0 flex-1 sm:min-w-[150px] [&>button]:py-2.5"
            ariaLabel="Came in from"
            icon={<Compass className="h-3.5 w-3.5" />}
            value={origin}
            placeholderValue="any"
            onChange={v => { setOrigin(v); if (v !== 'open_house') setOpenHouseId('') }}
            menuWidth={240}
            options={[
              { value: 'any', label: 'Came in from: anywhere', hint: `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}` },
              ...Array.from(originsPresent.entries()).map(([g, n]) => {
                const Icon = ORIGIN_META[g].icon
                return { value: g, label: ORIGIN_META[g].label, hint: `${n} ${n === 1 ? 'lead' : 'leads'}`, icon: <Icon className="h-3.5 w-3.5" /> }
              }),
            ]}
          />
          <AnimatePresence initial={false}>
            {origin === 'open_house' && openHouses.length > 0 && (
              <motion.div key="oh-picker" className="min-w-[150px] flex-1"
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}>
                {/* A long open-house history scrolls inside the menu instead of running off the page. */}
                <LuxeSelect<string>
                  className="[&>button]:py-2.5 [&_ul]:max-h-[320px] [&_ul]:!overflow-y-auto"
                  ariaLabel="Which open house"
                  icon={<Home className="h-3.5 w-3.5" />}
                  value={openHouseId}
                  placeholderValue=""
                  onChange={setOpenHouseId}
                  menuWidth={300}
                  options={[{ value: '', label: 'Any open house' }, ...openHouses.map(oh => ({
                    value: oh.id,
                    label: `${oh.address || 'Open house'}${oh.is_deleted ? ' (past)' : ''}`,
                    hint: `${oh.visitor_count} ${oh.visitor_count === 1 ? 'guest' : 'guests'}`,
                  }))]}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {/* How the list is ordered. */}
          <LuxeSelect<Sort>
            className="min-w-0 flex-1 sm:min-w-[170px] [&>button]:py-2.5"
            ariaLabel="Order"
            icon={<ArrowUpDown className="h-3.5 w-3.5" />}
            value={sort}
            onChange={setSort}
            align="right"
            menuWidth={240}
            options={SORTS.map(o => ({ value: o.id, label: o.label }))}
          />
          <button onClick={exportCsv} disabled={exporting} title="Download these leads as a spreadsheet (CSV)"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-black text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:text-white">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} <span className="hidden sm:inline">Export</span>
          </button>
          </div>
        </div>

        {/* "Mark all seen" - clears every red "new" dot at once (follow-ups and requests stay). */}
        <AnimatePresence initial={false}>
          {unseenCount > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-3.5 py-2 dark:border-red-500/20 dark:bg-red-500/[0.06]">
                <p className="text-[12.5px] font-bold text-red-700 dark:text-red-300">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500 align-middle" />
                  {unseenCount} {unseenCount === 1 ? 'lead has' : 'leads have'}{' '}something new you haven&apos;t opened
                </p>
                <button type="button" onClick={() => setConfirmSeenAll(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12px] font-black text-[#111827] ring-1 ring-red-200 transition hover:ring-red-400 dark:bg-white/10 dark:text-white dark:ring-red-500/30">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all seen
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* What "Warmest first" means - shown with that sort, foldable, remembered. */}
        {sort === 'warmth' && <WarmthExplainer />}

        {/* ── the list */}
        <div ref={listTopRef} className="mt-4 scroll-mt-24 space-y-2.5">
          {loading && (
            <div className="flex items-center justify-center py-16"><OhpSpinner size={26} label="Loading leads" /></div>
          )}
          {!loading && activeView === 'hidden' && hiddenLeads === null && (
            <div className="flex items-center justify-center py-16"><OhpSpinner size={26} /></div>
          )}
          {!loading && visible.length === 0 && !(activeView === 'hidden' && hiddenLeads === null) && (
            <EmptyState view={activeView} filtered={!!search || origin !== 'any' || !!tag || !!openHouseId} noLeads={leads.length === 0}
              onClear={() => { setSearch(''); setOrigin('any'); setTag(''); setOpenHouseId('') }} onAll={() => setView('all')} />
          )}
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.slice((curPage - 1) * PAGE, curPage * PAGE).map((lead, i) => (
              <motion.div key={`${curPage}:${lead.id}`} layout
                // The open row's menu has to sit over the rows below it (each row is its own layer).
                style={{ position: 'relative', zIndex: menuFor === lead.id ? 30 : 0 }}
                initial={{ opacity: 0, y: 14, x: pageDir * 18 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 36, delay: Math.min(i * 0.025, 0.3) }}>
                <LeadRow lead={lead} busy={busyId === lead.id} activeTag={tag} inNoAgent={activeView === 'no_agent'} onTag={setTag} menuOpen={menuFor === lead.id} showRate={sort === 'email_most' || sort === 'email_least'} showWarmth={sort === 'warmth'}
                  onOpen={() => setSelectedLeadId(lead.id)}
                  onMenu={open => setMenuFor(open ? lead.id : null)}
                  onStatus={s => setStatus(lead, s)} onContacted={() => markContacted(lead)} onSeen={() => markSeen(lead)}
                  onDelete={() => { setMenuFor(null); setConfirmDelete(lead) }} onFavorite={() => toggleFavorite(lead)} />
              </motion.div>
            ))}
          </AnimatePresence>
          {pages > 1 && (
            <div className="pt-2">
              <p className="mb-2 text-center text-[11px] font-bold text-gray-400">
                {(curPage - 1) * PAGE + 1}-{Math.min(curPage * PAGE, visible.length)} of {visible.length} leads
              </p>
              <Pager page={curPage} pages={pages} onChange={n => { const next = Math.min(Math.max(1, n), pages); setPageDir(next > curPage ? 1 : -1); setPage(next); listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
            </div>
          )}
          {!loading && pages === 1 && visible.length > 5 && (
            <p className="pt-1 text-center text-[11px] font-bold text-gray-400">That&apos;s everyone here - {visible.length} {visible.length === 1 ? 'lead' : 'leads'}.</p>
          )}
        </div>
      </div>

      <MotionModal open={confirmSeenAll} onBackdropClick={() => setConfirmSeenAll(false)}>
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-[#151517]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10"><CheckCheck className="h-6 w-6" /></span>
          <h3 className="mt-3 font-serif text-xl font-black text-[#111827] dark:text-white">Mark all {unseenCount} as seen?</h3>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-gray-500 dark:text-gray-400">
            Their red &ldquo;new&rdquo; dots clear, as if you opened each one. Follow-ups and requests that still need doing stay in &ldquo;Needs you&rdquo;. This can&apos;t be undone.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmSeenAll(false)} className="rounded-xl border border-gray-200 py-2.5 text-sm font-black text-gray-600 dark:border-white/10 dark:text-gray-300">Cancel</button>
            <button type="button" onClick={markAllSeen} className="rounded-xl bg-[#111827] py-2.5 text-sm font-black text-white dark:bg-white dark:text-[#111827]">Mark all seen</button>
          </div>
        </div>
      </MotionModal>

      <MotionModal open={!!confirmDelete} onBackdropClick={() => setConfirmDelete(null)}>
        {deleteShown && (
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-[#111827] dark:text-white">Delete {deleteShown.name || deleteShown.email || 'this lead'}?</h3>
            <p className="mt-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
              This removes them from everything for good: their activity and notes, your Activity feed, the Email Tracker - and <b>their Showcase is deleted too</b>. Automatic emails to them stop.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              To just get them off your lists, use <b>Hide</b> instead - you can bring them back any time.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold dark:border-white/10 dark:text-white">Keep</button>
              <button onClick={doDelete} disabled={busyId === deleteShown.id} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {busyId === deleteShown.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </MotionModal>

      {/* Always mounted, so closing a lead animates out instead of vanishing. */}
      <LeadDetailModal leadId={selectedLeadId} onClose={() => { setSelectedLeadId(null); refresh() }} onChanged={refresh} />
    </div>
  )
}

function TodoChip({ t }: { t: LeadTodo }) {
  const when = todoWhen(t)
  const tone = !t.urgent ? 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25'
    : t.bucket === 'overdue' ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25'
    : t.kind === 'followup' && t.bucket !== 'today' ? 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-white/[0.05] dark:text-gray-300 dark:ring-white/10'
    : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25'
  return (
    <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${tone}`}>
      {t.kind === 'followup' ? <CalendarClock className="h-3 w-3 shrink-0" /> : t.urgent ? <AlertCircle className="h-3 w-3 shrink-0" /> : null}
      <span className="truncate">{t.label}{when && <span className="font-black"> · {when}</span>}</span>
    </span>
  )
}

// Plain-words explainer for the warmth score (backend: app/services/lead_warmth.py).
function WarmthExplainer() {
  const [open, setOpen] = useState(true)
  useEffect(() => { try { if (localStorage.getItem('ohp-warmth-explainer') === 'closed') setOpen(false) } catch {} }, [])
  const toggle = () => {
    setOpen(o => {
      try { localStorage.setItem('ohp-warmth-explainer', o ? 'closed' : 'open') } catch {}
      return !o
    })
  }
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50/80 to-amber-50/60 dark:border-orange-500/20 dark:from-orange-500/[0.07] dark:to-amber-500/[0.04]">
      <button onClick={toggle} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <Flame className="h-4 w-4 shrink-0 text-orange-500" />
        <span className="text-xs font-black text-[#111827] dark:text-white">How warmth works</span>
        <span className="hidden truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400 sm:inline">- who&apos;s most active right now, from what they&apos;ve actually done</span>
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="grid gap-x-6 gap-y-2 px-4 pb-3.5 text-[11.5px] font-semibold leading-snug text-gray-600 dark:text-gray-300 sm:grid-cols-2">
              <p><b className="text-[#111827] dark:text-white">Every action earns points.</b> Asking to see a home counts most, then questions, sign-ins and forms, then likes and comments. Views and email opens count a little.</p>
              <p><b className="text-[#111827] dark:text-white">Into one home = straight to the top.</b> Coming back to the same house, liking it, asking about it or asking to see it lifts them to Hot - up to 100.</p>
              <p><b className="text-[#111827] dark:text-white">Recent counts most.</b> This week counts in full, then less and less - after 30 quiet days the points are gone, so nobody stays Hot off one busy week.</p>
              <p><b className="text-[#111827] dark:text-white">Just looking stays Warm.</b> Scrolling lots of homes or opening emails can&apos;t make anyone Hot (phones open emails on their own). Your own previews never count.</p>
              <p className="sm:col-span-2">
                <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-orange-50 px-1.5 py-px text-[10px] font-black text-orange-700 ring-1 ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30">Hot 40+</span>
                <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-black text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">Warm 15+</span>
                <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-black text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30">Cool</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-1.5 py-px text-[10px] font-black text-white"><Flame className="h-2.5 w-2.5" /> Heating up</span>
                {' '}= this week is a big jump on their usual. It only changes the order and adds a tag - nobody is hidden, and their emails and follow-ups don&apos;t change.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const WARMTH_LABEL: Record<string, string> = { hot: 'Hot', warm: 'Warm', cool: 'Cool', cold: 'Cold' }
const WARMTH_PILL: Record<string, string> = {
  hot: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300',
  warm: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  cool: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  cold: 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400',
}

function LeadRow({ lead, busy, menuOpen, showRate = false, showWarmth = false, activeTag = '', inNoAgent = false, onTag, onOpen, onMenu, onStatus, onContacted, onSeen, onDelete, onFavorite }: {
  lead: Lead; busy: boolean; menuOpen: boolean; showRate?: boolean; showWarmth?: boolean; activeTag?: string; onTag?: (t: string) => void
  // On the "No agent" tab, a lead who has an agent is only there because you left a note - say so
  inNoAgent?: boolean
  onOpen: () => void; onMenu: (open: boolean) => void; onStatus: (s: LeadStatus) => void
  onContacted: () => void; onSeen: () => void; onDelete: () => void; onFavorite: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const isPhone = useIsPhone()
  // Computers: the menu floats on top of the page from the "..." button and flips above it on the
  // last rows, instead of running off the bottom of the screen (10/26).
  const panelRef = useRef<HTMLDivElement>(null)
  const panelStyle = useAnchoredStyle(menuRef, panelRef, menuOpen && !isPhone, { width: 208, align: 'right', maxHeight: 420 })
  // Starred person, or their Showcase is starred: a gold outline so they stand out in the list.
  const starred = !!(lead.is_favorite || lead.showcase_starred)
  useEffect(() => {
    if (!menuOpen || isPhone) return  // the phone's sheet closes itself
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) onMenu(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen, onMenu, isPhone])
  const status = normalizedStatus(lead)
  const origin = lead.origin
  const latest = lead.latest
  // The latest line only when it says something beyond how they came in.
  const showLatest = latest && (!origin || latest.label !== origin.label)
  const om = origin ? activityMeta(origin.type) : null
  const lm = latest ? activityMeta(latest.type) : null
  // Same to-do twice (two follow-ups for one showing) shows once.
  const todos = (lead.todos || []).filter(t => t.urgent || t.kind === 'likes')
    .filter((t, i, all) => all.findIndex(o => o.label === t.label && todoWhen(o) === todoWhen(t)) === i)
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const [copied, setCopied] = useState(false)
  const copyEmail = async () => {
    if (!lead.email || !(await copyText(lead.email))) return
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  // Red = something waiting on you (stays red after you open them, until it's handled) or
  // something new they did that you haven't opened yet. Nothing else gets a dot.
  const fresh = isRed(lead)

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen() }}
      className={`group relative rounded-2xl border bg-white p-3.5 shadow-sm transition hover:-translate-y-px hover:border-[#C9A24D]/50 hover:shadow-md dark:bg-[#151517] sm:p-4 ${
        fresh ? 'border-l-4 border-red-200 border-l-red-500 hover:border-l-red-500 dark:border-red-500/25 dark:border-l-red-500'
        : 'border-gray-200 dark:border-white/[0.08]'} ${busy ? 'opacity-60' : ''} ${starred ? 'ring-2 ring-[#C9A24D]/55 ring-offset-0 dark:ring-[#e8c97a]/45' : ''}`}>
      {/* Phones: its own layout (user, 10/24) - everything the computer row shows, stacked to read. */}
      <PhoneLeadCard lead={lead} status={status} fresh={fresh} todos={todos} showRate={showRate} showWarmth={showWarmth} activeTag={activeTag} inNoAgent={inNoAgent}
        onTag={onTag} onMenu={() => onMenu(!menuOpen)} onContacted={onContacted} onFavorite={onFavorite} copied={copied} onCopyEmail={copyEmail} />
      <div className="hidden sm:flex sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111827] text-sm font-black sm:h-10 sm:w-10 text-[#C9A24D] dark:bg-white dark:text-[#8b7355]">
          {(lead.name || lead.email || '?').charAt(0).toUpperCase()}
          {fresh && <span title={lead.needs_you ? 'Waiting on you' : 'Something new since you last opened them'} className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#151517]" />}
          {starred && <span title={lead.is_favorite ? 'Starred' : 'Their Showcase is starred'} className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#C9A24D] text-white ring-2 ring-white dark:ring-[#151517]"><Star className="h-2.5 w-2.5" fill="currentColor" /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 max-sm:min-h-9">
            <p className={`truncate text-[15px] text-[#111827] dark:text-white ${lead.needs_attention ? 'font-black' : 'font-bold'}`}>{lead.name || lead.email || 'No name given'}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
            {lead.showcase_starred && (
              <span title="You starred their Showcase" className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D]/12 px-2 py-0.5 text-[10px] font-black text-[#8b6d2c] ring-1 ring-inset ring-[#C9A24D]/40 dark:text-[#e8c97a]">
                <Star className="h-3 w-3" fill="currentColor" /> Showcase starred
              </span>
            )}
            {lead.represented === 'yes' && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"><ShieldCheck className="h-3 w-3" /> Has an agent</span>}
            {inNoAgent && lead.represented === 'yes' && lead.has_note && (
              <span title="They have an agent, but you left a note on them, so they stay on this tab too"
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                <Pencil className="h-3 w-3" /> Here because you left a note
              </span>
            )}
            {/* Bounced / marked as spam (Mailgun) say so - the agent has to act on a bounce. */}
            {(lead.email_engagement?.code === 'bounced' || lead.email_engagement?.code === 'spam') ? (
              <span title={lead.email_engagement.reason || undefined} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
                <MailX className="h-3 w-3" /> {lead.email_engagement.code === 'bounced' ? 'Email bounced' : 'Marked you as spam'}
              </span>
            ) : lead.unsubscribed && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"><MailX className="h-3 w-3" /> No emails</span>}
            {!lead.unsubscribed && lead.email_engagement && lead.email_engagement.mode !== 'daily' && (
              <span title={lead.email_engagement.reason || undefined}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${lead.email_engagement.mode === 'weekly' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                <MailX className="h-3 w-3" /> {lead.email_engagement.mode === 'weekly' ? 'Emails weekly' : 'Emails off'}
              </span>
            )}
            {showRate && lead.email_engagement?.rate != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-black tabular-nums text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"><Mail className="h-3 w-3" /> {lead.email_engagement.rate}% opened</span>
            )}
            {(lead.tags || []).slice(0, 3).map(t => (
              <button key={t} type="button" onClick={e => { e.stopPropagation(); onTag?.(activeTag === t ? '' : t) }} title={activeTag === t ? 'Show every tag again' : `Only leads tagged "${t}"`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black transition ${activeTag === t ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/10 text-[#8b7355] hover:bg-[#C9A24D]/20 dark:text-[#e8c97a]'}`}>
                <Tag className="h-2.5 w-2.5" /> {t}
              </button>
            ))}
            {lead.heating_up ? (
              <span title={`Warmth ${lead.warmth ?? 0}/100. Much busier than usual this week${lead.warmth_reason ? ` - ${lead.warmth_reason}` : ''}. A good moment to reach out.`}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm shadow-orange-500/30">
                <Flame className="h-3 w-3" />
                <span className="rounded-full bg-white/25 px-1.5 tabular-nums">{lead.warmth ?? 0}<span className="opacity-70">/100</span></span>
                Heating up{lead.warmth_reason ? ` · ${lead.warmth_reason}` : ''}
              </span>
            ) : showWarmth && lead.warmth_level && lead.warmth_level !== 'cold' && (
              <span title={`Warmth ${lead.warmth}/100 - how active they are right now${lead.warmth_reason ? ` (${lead.warmth_reason})` : ''}`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${WARMTH_PILL[lead.warmth_level]}`}>
                <Flame className="h-3 w-3" />
                <span className="rounded-full bg-white/80 px-1.5 tabular-nums ring-1 ring-current/15 dark:bg-white/10">{lead.warmth ?? 0}<span className="opacity-60">/100</span></span>
                {WARMTH_LABEL[lead.warmth_level]}
                {lead.warmth_level === 'hot' && lead.warmth_reason?.startsWith('Into ') && <span className="font-bold">· {lead.warmth_reason.split(' - ')[0]}</span>}
              </span>
            )}
            {!!lead.showcase_new_matches && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Sparkles className="h-3 w-3" /> {lead.showcase_new_matches} new {lead.showcase_new_matches === 1 ? 'match' : 'matches'}</span>}
          </div>
          <div className="max-sm:-ml-12">
          {origin && om && (
            <p className="mt-1 flex min-w-0 items-start gap-1.5 text-[12.5px] leading-5 text-gray-600 dark:text-gray-300" title={origin.came_from || undefined}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${TONE_CLASSES[om.tone]}`}><om.icon className="h-3 w-3" /></span>
              <span className="min-w-0 line-clamp-2 sm:line-clamp-1">
                <span className="mr-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Came in</span>
                <span className="font-semibold">{origin.label}</span>
                <span className="text-gray-400"> · {timeAgo(origin.at)}</span>
              </span>
            </p>
          )}
          {showLatest && lm && (
            <p className="mt-1 flex min-w-0 items-start gap-1.5 text-[12.5px] leading-5 text-gray-600 dark:text-gray-300">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${TONE_CLASSES[lm.tone]}`}><lm.icon className="h-3 w-3" /></span>
              <span className="min-w-0 line-clamp-2 sm:line-clamp-1">
                <span className="mr-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Latest</span>
                <span className="font-semibold">{latest!.label}</span>
                <span className="text-gray-400"> · {timeAgo(latest!.at)}</span>
              </span>
            </p>
          )}
          {todos.length > 0 && (
            <div className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
              {todos.slice(0, 2).map((t, k) => <TodoChip key={k} t={t} />)}
              {todos.length > 2 && <span className="rounded-full px-1.5 py-0.5 text-[11px] font-bold text-gray-400">+{todos.length - 2} more</span>}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Reach them in one tap, or change where they stand. */}
      <div className="flex shrink-0 items-center gap-1.5 sm:self-center" onClick={stop}>
        {/* Star this person (separate from starring their Showcase) and "I reached out" (user, 10/24). */}
        <StarButton lead={lead} onFavorite={onFavorite} />
        <ContactedButton lead={lead} onContacted={onContacted} />
        {lead.phone && (
          <>
            <a href={`tel:${dialable(lead.phone)}`} title={`Call ${formatPhone(lead.phone)}`} aria-label="Call"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:text-gray-300 sm:h-9 sm:w-9"><Phone className="h-4 w-4" /></a>
            <a href={`sms:${dialable(lead.phone)}`} title={`Text ${formatPhone(lead.phone)}`} aria-label="Text"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:text-gray-300 sm:h-9 sm:w-9"><MessageCircle className="h-4 w-4" /></a>
          </>
        )}
        {lead.email && (
          <button type="button" onClick={copyEmail} title={`Copy ${lead.email}`} aria-label={copied ? 'Email copied' : 'Copy email'}
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition sm:h-9 sm:w-9 ${copied ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:text-gray-300'}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={copied ? 'y' : 'n'} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.14 }}>
                {copied ? <Check className="h-4 w-4" strokeWidth={3} /> : <Mail className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence>
              {copied && (
                <motion.span role="status" initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                  style={{ x: '-50%' }} className="pointer-events-none absolute bottom-full left-1/2 mb-2 whitespace-nowrap rounded-lg bg-[#111827] px-2.5 py-1 text-[11px] font-black text-white shadow-lg dark:bg-white dark:text-[#111827]">
                  Email copied
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
        <div ref={menuRef} className="relative">
          <button onClick={() => onMenu(!menuOpen)} aria-label="More" title="Change status, hide or delete"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-white/10 dark:text-gray-300 dark:hover:text-white sm:h-9 sm:w-9">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
          </button>
          <PopupPortal>
          <AnimatePresence>
            {menuOpen && !isPhone && (
              <motion.div ref={panelRef} style={panelStyle} initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#1A1A1C]">
                <LeadMenuItems lead={lead} status={status} onStatus={onStatus} onContacted={onContacted} onSeen={onSeen} onDelete={onDelete} />
              </motion.div>
            )}
          </AnimatePresence>
          </PopupPortal>
        </div>
        <span className="hidden h-9 w-6 items-center justify-center text-gray-300 transition group-hover:text-[#C9A24D] sm:flex"><ArrowRight className="h-4 w-4" /></span>
      </div>
      </div>
      {/* Phones: the "..." choices as a sheet that slides up (drag down to close). */}
      {isPhone && (
        <OhSheet open={menuOpen} onClose={() => onMenu(false)} width="max-w-md"
          title={lead.name || lead.email || 'This lead'} subtitle={<span className={`rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ring-inset ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>}>
          <div className="px-4 pb-6 pt-1" onClick={stop}>
            <LeadMenuItems lead={lead} status={status} big onStatus={onStatus} onContacted={onContacted} onSeen={onSeen} onDelete={onDelete} />
          </div>
        </OhSheet>
      )}
    </div>
  )
}

/** The "..." choices - the dropdown on a computer, the slide-up sheet on a phone. */
function LeadMenuItems({ lead, status, big = false, onStatus, onContacted, onSeen, onDelete }: {
  lead: Lead; status: ReturnType<typeof normalizedStatus>; big?: boolean
  onStatus: (s: LeadStatus) => void; onContacted: () => void; onSeen: () => void; onDelete: () => void
}) {
  const row = `flex w-full items-center gap-2 rounded-xl px-2.5 text-left font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10 ${big ? 'py-3 text-[15px]' : 'py-1.5 text-[13px]'}`
  return (
    <>
      <p className="px-2.5 pb-1 pt-1 text-[9px] font-black uppercase tracking-[0.16em] text-gray-400">Move to</p>
      <div className={big ? 'grid grid-cols-2 gap-1.5' : ''}>
        {(['new', 'contacted', 'in_talks', 'signed'] as LeadStatus[]).map(s => (
          <button key={s} onClick={() => onStatus(s)}
            className={big ? `flex items-center justify-between rounded-xl border px-3 py-3 text-[14px] font-black ${status === s ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-700 dark:border-white/10 dark:text-gray-200'}`
              : 'flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-[13px] font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10'}>
            {STATUS_LABEL[s]} {status === s && <Check className="h-3.5 w-3.5 text-[#C9A24D]" />}
          </button>
        ))}
      </div>
      <div className="my-1.5 h-px bg-gray-100 dark:bg-white/10" />
      <button onClick={onContacted} className={row}><Check className="h-4 w-4 text-gray-400" /> Mark contacted</button>
      {lead.needs_attention && <button onClick={onSeen} className={row}><Eye className="h-4 w-4 text-gray-400" /> Mark as seen</button>}
      {status === 'hidden' ? (
        <button onClick={() => onStatus(lead.status === 'hidden' || lead.status === 'archived' ? 'new' : lead.status)} className={row}><Eye className="h-4 w-4 text-gray-400" /> Show again</button>
      ) : (
        <button onClick={() => onStatus('hidden')} className={row}><EyeOff className="h-4 w-4 text-gray-400" /> Hide</button>
      )}
      <button onClick={onDelete} className={`${row} !text-red-600 hover:!bg-red-50 dark:!text-red-300 dark:hover:!bg-red-500/10`}><Trash2 className="h-4 w-4" /> Delete</button>
    </>
  )
}

/** Gold star = you starred this person; a small "Showcase" star = their Showcase is starred. */
function StarButton({ lead, onFavorite, compact = false }: { lead: Lead; onFavorite: () => void; compact?: boolean }) {
  const on = !!lead.is_favorite
  return (
    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); onFavorite() }}
      aria-pressed={on} aria-label={on ? 'Unstar this lead' : 'Star this lead'}
      title={on ? 'Starred - tap to unstar' : lead.showcase_starred ? 'Their Showcase is starred - star the lead too' : 'Star this lead'}
      className={`relative flex shrink-0 items-center justify-center rounded-xl border transition ${compact ? 'h-9 w-9' : 'h-9 w-9'} ${on
        ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#b8892f] dark:text-[#e8c97a]'
        : 'border-gray-200 text-gray-400 hover:border-[#C9A24D] hover:text-[#b8892f] dark:border-white/10 dark:text-gray-400'}`}>
      <motion.span key={on ? 'on' : 'off'} initial={{ scale: 0.4, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
        <Star className="h-4 w-4" fill={on ? 'currentColor' : 'none'} strokeWidth={2.2} />
      </motion.span>
      {lead.showcase_starred && !on && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#C9A24D] ring-2 ring-white dark:ring-[#151517]" />}
    </motion.button>
  )
}

const contactedToday = (l: Lead) => !!l.last_contacted_at && new Date(l.last_contacted_at).toDateString() === new Date().toDateString()

/** "I reached out" in one tap - stamps last contacted and moves a New lead to Contacted. */
function ContactedButton({ lead, onContacted, block = false }: { lead: Lead; onContacted: () => void; block?: boolean }) {
  const done = contactedToday(lead)
  return (
    <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={e => { e.stopPropagation(); if (!done) onContacted() }}
      title={done ? 'Marked contacted today' : 'Mark that you reached out'}
      className={block
        ? `flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-black transition active:bg-gray-50 dark:active:bg-white/5 ${done ? 'bg-emerald-50/70 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-[#111827] dark:text-white'}`
        : `inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-black transition ${done
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'border-gray-200 text-[#111827] hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:text-white'}`}>
      {done ? <CheckCheck className="h-4 w-4" /> : <UserCheck className={`h-4 w-4 ${block ? 'text-[#8b7355] dark:text-[#e8c97a]' : ''}`} />}
      Contacted
    </motion.button>
  )
}

/** One lead on a phone: who + where they stand, why they're here, what's waiting, then one row of actions. */
function PhoneLeadCard({ lead, status, fresh, todos, showRate, showWarmth, activeTag, inNoAgent, onTag, onMenu, onContacted, onFavorite, copied, onCopyEmail }: {
  lead: Lead; status: ReturnType<typeof normalizedStatus>; fresh: boolean; todos: LeadTodo[]; showRate: boolean; showWarmth: boolean; activeTag: string; inNoAgent: boolean
  onTag?: (t: string) => void; onMenu: () => void; onContacted: () => void; onFavorite: () => void; copied: boolean; onCopyEmail: () => void
}) {
  const origin = lead.origin
  const latest = lead.latest
  const showLatest = latest && (!origin || latest.label !== origin.label)
  const om = origin ? activityMeta(origin.type) : null
  const lm = latest ? activityMeta(latest.type) : null
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const pill = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-black'
  const action = 'flex h-[52px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-black text-[#111827] transition active:bg-gray-50 dark:text-white dark:active:bg-white/5'
  return (
    <div className="sm:hidden">
      {/* who */}
      <div className="flex items-start gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111827] text-base font-black text-[#C9A24D] dark:bg-white dark:text-[#8b7355]">
          {(lead.name || lead.email || '?').charAt(0).toUpperCase()}
          {fresh && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#151517]" />}
          {(lead.is_favorite || lead.showcase_starred) && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-white ring-2 ring-white dark:ring-[#151517]"><Star className="h-3 w-3" fill="currentColor" /></span>
          )}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`truncate text-[16px] leading-tight text-[#111827] dark:text-white ${lead.needs_attention ? 'font-black' : 'font-bold'}`}>{lead.name || lead.email || 'No name given'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ring-inset ${STATUS_PILL[status]}`}>{STATUS_LABEL[status]}</span>
            {lead.showcase_starred && <span className={`${pill} bg-[#C9A24D]/12 text-[#8b6d2c] ring-1 ring-inset ring-[#C9A24D]/40 dark:text-[#e8c97a]`}><Star className="h-3 w-3" fill="currentColor" /> Showcase starred</span>}
            {lead.represented === 'yes' && <span className={`${pill} bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400`}><ShieldCheck className="h-3 w-3" /> Has an agent</span>}
            {inNoAgent && lead.represented === 'yes' && lead.has_note && <span className={`${pill} bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300`}><Pencil className="h-3 w-3" /> You left a note</span>}
            {(lead.email_engagement?.code === 'bounced' || lead.email_engagement?.code === 'spam') ? (
              <span className={`${pill} bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300`}><MailX className="h-3 w-3" /> {lead.email_engagement.code === 'bounced' ? 'Email bounced' : 'Marked you as spam'}</span>
            ) : lead.unsubscribed && <span className={`${pill} bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400`}><MailX className="h-3 w-3" /> No emails</span>}
            {!lead.unsubscribed && lead.email_engagement && lead.email_engagement.mode !== 'daily' && (
              <span className={`${pill} ${lead.email_engagement.mode === 'weekly' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                <MailX className="h-3 w-3" /> {lead.email_engagement.mode === 'weekly' ? 'Emails weekly' : 'Emails off'}
              </span>
            )}
            {showRate && lead.email_engagement?.rate != null && <span className={`${pill} bg-sky-50 tabular-nums text-sky-700 dark:bg-sky-500/10 dark:text-sky-300`}><Mail className="h-3 w-3" /> {lead.email_engagement.rate}% opened</span>}
            {!!lead.showcase_new_matches && <span className={`${pill} bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300`}><Sparkles className="h-3 w-3" /> {lead.showcase_new_matches} new {lead.showcase_new_matches === 1 ? 'match' : 'matches'}</span>}
            {!lead.heating_up && showWarmth && lead.warmth_level && lead.warmth_level !== 'cold' && (
              <span className={`${pill} ${WARMTH_PILL[lead.warmth_level]}`}><Flame className="h-3 w-3" /> {lead.warmth ?? 0}/100 {WARMTH_LABEL[lead.warmth_level]}</span>
            )}
            {(lead.tags || []).slice(0, 3).map(t => (
              <button key={t} type="button" onClick={e => { e.stopPropagation(); onTag?.(activeTag === t ? '' : t) }}
                className={`${pill} ${activeTag === t ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]'}`}><Tag className="h-2.5 w-2.5" /> {t}</button>
            ))}
          </div>
        </div>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-1" onClick={stop}>
          <StarButton lead={lead} onFavorite={onFavorite} compact />
          <button type="button" onClick={onMenu} aria-label="More" className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-300"><MoreHorizontal className="h-4 w-4" /></button>
        </div>
      </div>

      {/* heating up - its own strip, reason included */}
      {lead.heating_up && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-2 text-white shadow-sm shadow-orange-500/30">
          <Flame className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="min-w-0 text-[12px] font-bold leading-snug">
            <span className="mr-1 rounded-full bg-white/25 px-1.5 font-black tabular-nums">{lead.warmth ?? 0}/100</span>
            <span className="font-black">Heating up</span>{lead.warmth_reason ? <span className="opacity-90"> · {lead.warmth_reason}</span> : null}
          </p>
        </div>
      )}

      {/* why they're here + the latest thing they did */}
      {(origin && om) || (showLatest && lm) ? (
        <div className="mt-3 space-y-1.5 rounded-xl bg-gray-50/80 px-3 py-2.5 dark:bg-white/[0.03]">
          {origin && om && (
            <p className="flex items-start gap-2 text-[13px] leading-snug text-gray-700 dark:text-gray-300">
              <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${TONE_CLASSES[om.tone]}`}><om.icon className="h-3 w-3" /></span>
              <span className="min-w-0">
                <span className="block text-[9.5px] font-black uppercase tracking-wider text-gray-400">Came in · {timeAgo(origin.at)}</span>
                <span className="line-clamp-3 font-semibold">{origin.label}</span>
              </span>
            </p>
          )}
          {showLatest && lm && (
            <p className="flex items-start gap-2 text-[13px] leading-snug text-gray-700 dark:text-gray-300">
              <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${TONE_CLASSES[lm.tone]}`}><lm.icon className="h-3 w-3" /></span>
              <span className="min-w-0">
                <span className="block text-[9.5px] font-black uppercase tracking-wider text-gray-400">Latest · {timeAgo(latest!.at)}</span>
                <span className="line-clamp-3 font-semibold">{latest!.label}</span>
              </span>
            </p>
          )}
        </div>
      ) : null}

      {/* what's waiting on the agent - whole, never cut off */}
      {todos.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {todos.slice(0, 3).map((t, k) => <PhoneTodo key={k} t={t} />)}
          {todos.length > 3 && <span className="pl-1 text-[11px] font-bold text-gray-400">+{todos.length - 3} more inside</span>}
        </div>
      )}

      {/* one row of actions */}
      <div className="-mx-3.5 -mb-3.5 mt-3 grid auto-cols-fr grid-flow-col divide-x divide-gray-100 overflow-hidden rounded-b-2xl border-t border-gray-100 dark:divide-white/[0.06] dark:border-white/[0.06]" onClick={stop}>
        {lead.phone && <a href={`tel:${dialable(lead.phone)}`} className={action}><Phone className="h-4 w-4 text-[#8b7355] dark:text-[#e8c97a]" /> Call</a>}
        {lead.phone && <a href={`sms:${dialable(lead.phone)}`} className={action}><MessageCircle className="h-4 w-4 text-[#8b7355] dark:text-[#e8c97a]" /> Text</a>}
        {lead.email && (
          <button type="button" onClick={onCopyEmail} className={`${action} ${copied ? '!text-emerald-600 dark:!text-emerald-300' : ''}`}>
            {copied ? <Check className="h-4 w-4" strokeWidth={3} /> : <Mail className="h-4 w-4 text-[#8b7355] dark:text-[#e8c97a]" />} {copied ? 'Copied' : 'Copy email'}
          </button>
        )}
        <div className="h-[52px]"><ContactedButton lead={lead} onContacted={onContacted} block /></div>
      </div>
    </div>
  )
}

/** A to-do on a phone card - the whole label, wrapping instead of "Book the showing · Over...". */
function PhoneTodo({ t }: { t: LeadTodo }) {
  const when = todoWhen(t)
  const tone = !t.urgent ? 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25'
    : t.bucket === 'overdue' ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25'
    : t.kind === 'followup' && t.bucket !== 'today' ? 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-white/[0.05] dark:text-gray-300 dark:ring-white/10'
    : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25'
  return (
    <span className={`flex items-start gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-bold leading-snug ring-1 ring-inset ${tone}`}>
      {t.kind === 'followup' ? <CalendarClock className="mt-px h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0">{t.label}{when && <span className="font-black"> · {when}</span>}</span>
    </span>
  )
}

function EmptyState({ view, filtered, noLeads, onClear, onAll }: { view: View; filtered: boolean; noLeads: boolean; onClear: () => void; onAll: () => void }) {
  const text = noLeads ? { t: 'No leads yet', s: 'Open house sign-ins, forms, Spotlight questions, portal leads and Showcase activity all land here on their own.' }
    : filtered ? { t: 'No one matches that', s: 'Try a different search, or clear the filters.' }
    : view === 'needs' ? { t: "You're all caught up", s: 'Nothing is waiting on you right now - no follow-ups due and no unanswered requests.' }
    : view === 'hidden' ? { t: 'No hidden leads', s: 'Leads you hide (from the ... menu) wait here - nothing is deleted.' }
    : view === 'has_agent' ? { t: 'No one with an agent', s: "People who say they're working with another agent show up here, out of your way." }
    : { t: 'No one here yet', s: 'Leads move into this list as you change their status.' }
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 px-6 py-14 text-center dark:border-white/10">
      {view === 'needs' && !filtered && !noLeads ? <Check className="h-8 w-8 text-emerald-400" /> : <Users className="h-8 w-8 text-gray-300" />}
      <p className="font-black text-gray-600 dark:text-gray-300">{text.t}</p>
      <p className="max-w-md text-sm font-semibold text-gray-400">{text.s}</p>
      {filtered ? (
        <button onClick={onClear} className="mt-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">Clear filters</button>
      ) : view !== 'all' && !noLeads ? (
        <button onClick={onAll} className="mt-2 inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">See all leads <ArrowRight className="h-3 w-3" /></button>
      ) : null}
    </div>
  )
}
