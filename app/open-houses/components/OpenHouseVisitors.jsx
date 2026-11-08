'use client'

import { useState, useEffect, useRef, useMemo, Fragment } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Copy, Check, Mail, Phone, Users, UserCheck, UserPlus, Star, Pencil, ChevronRight, NotebookPen, Search } from 'lucide-react'
import Link from 'next/link'
import { starChanged } from '@/lib/starredPeople'
import { VisitorStar, PassActivitySheet, VisitorShowcaseSwitch, VisitorReach, ContactedChip, reachedBy, GuestActivityButton, OpenShowcaseLink } from './VisitorExtras'
import { useToast } from '@/contexts/ToastContext'
import LuxeHero, { LuxeStats } from '@/components/ui/LuxeHero'
import { formatPhone } from '@/lib/leadEventDetails'
import { toTitleCase } from '@/lib/cheatSheetContent'
import Footer from '@/components/Footer'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import NotesThread from '@/components/leads/NotesThread'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import OhSheet from '@/components/open-house-manager/OhSheet'
import QuickEditShowcase from '@/components/showcases/QuickEditShowcase'
import { copyText } from '@/lib/copyText'

// `contacted`: "Texted" / "Emailed" right after the number / email once they were reached that way (11/02).
function CopyField({ field, value, icon: FieldIcon, href, display, contacted, copied, onCopy }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 min-w-0">
      <FieldIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
      {href ? (
        <a href={href} className="truncate hover:text-[#8b7355] dark:hover:text-[#C9A24D] transition-colors">{display || value}</a>
      ) : (
        <span className="truncate">{display || value}</span>
      )}
      <button
        type="button"
        onClick={() => onCopy(field, value)}
        className="shrink-0 rounded-md p-1 text-gray-300 transition hover:bg-gray-100 hover:text-[#8b7355] dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-[#C9A24D]"
        aria-label={`Copy ${field}`}
        title={`Copy ${field}`}
      >
        {copied === field ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
      {contacted && <ContactedChip label={contacted} />}
    </div>
  )
}

// A busy open house (owner, 11/07: "60 people sign in"): past this many guests the list gets a search,
// a sort and filters up top, and draws a screenful or so at a time (pageSize) with Show more. Drawing all 60 at once froze the
// window for most of a second on a phone. The Visitors sheet's placeholder leaves room for the bar too.
export const BIG_LIST = 10
// How many are drawn at a time: a phone shows about two cards a screen, a computer about seven rows.
const pageSize = wide => wide ? 20 : 10

// Which layout to build: only the one on screen (the list used to be built twice, table and cards,
// with one hidden - twice the work every time it opened).
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

// The Notes button: how many there are, before opening it (owner, 11/07).
function NoteCount({ n }) {
  if (!n) return null
  return <span data-testid="visitor-note-count" className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-[#C9A24D]/15 px-1 text-[10px] font-black tabular-nums tracking-normal text-[#8b7355] dark:text-[#e8c97a]">{n}</span>
}

// The Visitor Insights view. As its own page (/open-houses/visitors/[id]) it reads the id from the
// URL; inside the Opens screen's pop-up it's handed `openHouseEventId` + `onClose`, so agents
// never lose their place on Opens, plus `preloaded`: the list, fetched while the sheet slid up.
export default function OpenHouseVisitors({ openHouseEventId: idProp, onClose, showcasesOn: showcasesOnProp, preloaded }) {
  const router = useRouter()
  const params = useParams()
  const openHouseEventId = idProp || params?.openHouseEventId
  const embedded = !!onClose
  const { user } = useAuth()

  const wide = useWide()
  const [visitors, setVisitors] = useState(preloaded?.visitors || [])
  const [openHouse, setOpenHouse] = useState(preloaded?.openHouse || null)
  const [isLoading, setIsLoading] = useState(!preloaded)
  const [error, setError] = useState(preloaded?.error || '')
  const [copiedField, setCopiedField] = useState('')
  // Deep link (?visitor=<id> - "View Sign-in" on a lead's Activity): that person's row, scrolled
  // into view and highlighted.
  const [focusVisitorId, setFocusVisitorId] = useState(null)
  useEffect(() => {
    if (embedded) return
    try { setFocusVisitorId(new URLSearchParams(window.location.search).get('visitor')) } catch { /* no window */ }
  }, [])
  useEffect(() => {
    if (!focusVisitorId || isLoading) return
    const t = setTimeout(() => {
      const els = document.querySelectorAll(`[data-visitor-id="${focusVisitorId}"]`)
      const shown = Array.from(els).find(el => el.offsetParent !== null)
      shown?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    return () => clearTimeout(t)
  }, [focusVisitorId, isLoading])
  // Search / sort / filter / how many are drawn (see BIG_LIST). The list is kept newest-first.
  const [sortBy, setSortBy] = useState('newest')
  const [show, setShow] = useState('all')
  const [query, setQuery] = useState('')
  const PAGE = pageSize(wide)
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => { setLimit(PAGE) }, [sortBy, show, query, PAGE])
  const big = visitors.length > BIG_LIST
  const noAgent = v => String(v.has_agent || '').toUpperCase() !== 'YES'
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    let list = visitors.filter(v => {
      if (show === 'noagent' && !noAgent(v)) return false
      if (show === 'starred' && !v.is_favorite) return false
      if (show === 'activity' && !(v.pass_events > 0)) return false
      if (!q) return true
      return String(v.full_name || '').toLowerCase().includes(q) || String(v.email || '').toLowerCase().includes(q)
        || (digits.length >= 3 && String(v.phone || '').replace(/\D/g, '').includes(digits))
    })
    if (sortBy === 'oldest') list = [...list].reverse()
    else if (sortBy === 'name') list = [...list].sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'en', { sensitivity: 'base' }))
    return list
  }, [visitors, sortBy, show, query])
  const chips = [
    { key: 'all', label: 'All', n: visitors.length },
    { key: 'noagent', label: 'No agent', n: visitors.filter(noAgent).length },
    { key: 'starred', label: 'Starred', n: visitors.filter(v => v.is_favorite).length },
    { key: 'activity', label: <><span className="sm:hidden">Activity</span><span className="hidden sm:inline">Guest Activity</span></>, n: visitors.filter(v => v.pass_events > 0).length },
  ].filter(c => c.key === 'all' || c.n > 0 || c.key === show)
  // A deep link to someone further down: draw far enough to reach them.
  useEffect(() => {
    if (!focusVisitorId) return
    const i = shown.findIndex(v => v.id === focusVisitorId)
    if (i >= limit) setLimit(i + 1)
  }, [focusVisitorId, shown, limit])
  const page = shown.slice(0, limit)
  // Day headings only make sense in time order.
  const grouped = sortBy !== 'name'
  const newDayAt = (i) => grouped && (i === 0 || new Date(page[i - 1].created_at).toDateString() !== new Date(page[i].created_at).toDateString())
  const focusRing = (id) => id === focusVisitorId ? 'ring-2 ring-inset ring-[#C9A24D] bg-[#C9A24D]/[0.07]' : ''

  // Lead star (user, 10/24): saves right away; when it's turned ON and the person has a Showcase,
  // asks whether to star the Showcase too - never when this open house's Showcases are off.
  const showcasesOn = showcasesOnProp ?? (openHouse ? openHouse.autoShowcase !== false || !!openHouse.passShowcase : true)
  // "534 Holly Knoll" - for the Text / Email greeting (owner, 11/01)
  const ohStreet = toTitleCase(String(openHouse?.address || '').split(',')[0].trim())
  const [activityFor, setActivityFor] = useState(null)
  // Edit Showcase straight from the guest (owner, 11/01)
  const [editFor, setEditFor] = useState(null)
  const patchVisitor = (id, patch) => setVisitors(prev => prev.map(v => v.id === id ? { ...v, ...patch } : v))
  // Text / Email tapped for a guest - their lead shows Texted / Emailed here and on the Leads page (11/02).
  const markContacted = (visitor, via) => {
    if (!visitor.lead_id) return
    const entry = { at: new Date().toISOString(), via, what: null }
    setVisitors(prev => prev.map(v => v.lead_id === visitor.lead_id ? { ...v, contact_log: [...(v.contact_log || []), entry] } : v))
    api.leads.contacted(visitor.lead_id, via).then(r => {
      if (r.success && r.data) setVisitors(prev => prev.map(v => v.lead_id === visitor.lead_id ? { ...v, contact_log: r.data.contact_log } : v))
    })
  }
  const toggleStar = async (visitor) => {
    if (!visitor.lead_id) return
    const next = !visitor.is_favorite
    patchVisitor(visitor.id, { is_favorite: next })
    const { success } = await api.leads.update(visitor.lead_id, { is_favorite: next })
    if (!success) { patchVisitor(visitor.id, { is_favorite: !next }); return }
    starChanged()
    if (visitor.showcase_id) patchVisitor(visitor.id, { showcase_starred: next })   // one star: the lead's save stars their Showcase too
  }
  // Per-visitor Showcase switch (user, 10/25): flips at once, saves in order (a quick on-then-off
  // is two saves, the second cancels the first's invite), and flips back if a save fails.
  const { showToast } = useToast()
  const [showcaseBusy, setShowcaseBusy] = useState({})
  const showcaseQueue = useRef({})
  const toggleShowcase = (visitor) => {
    const next = !visitor.showcase_on
    patchVisitor(visitor.id, { showcase_on: next, ...(next ? {} : { showcase_invite_at: null }) })
    setShowcaseBusy(b => ({ ...b, [visitor.id]: (b[visitor.id] || 0) + 1 }))
    const run = async () => {
      const { success, data, error } = await api.openHouses.setVisitorShowcase(visitor.id, next)
      setShowcaseBusy(b => ({ ...b, [visitor.id]: Math.max(0, (b[visitor.id] || 1) - 1) }))
      if (!success) {
        patchVisitor(visitor.id, { showcase_on: !next })
        showToast?.(error || "Couldn't change their Showcase - switched back.", 'error')
        return
      }
      if (next) {
        patchVisitor(visitor.id, { showcase_invite_at: data?.invite_at || null, ...(data?.showcase_id ? { showcase_id: data.showcase_id } : {}) })
        // A brand-new Showcase is built in the background - pick up its invite time in a moment.
        if (data?.building) setTimeout(async () => {
          const r = await api.openHouses.getVisitors(openHouseEventId)
          const fresh = r.success && r.data ? r.data.find(v => v.id === visitor.id) : null
          // (keeps the expected time if the queued invite isn't saved yet)
          if (fresh) patchVisitor(visitor.id, { showcase_on: fresh.showcase_on, showcase_invite_at: fresh.showcase_invite_at || data?.invite_at || null, showcase_id: fresh.showcase_id })
        }, 9000)
      }
    }
    showcaseQueue.current[visitor.id] = (showcaseQueue.current[visitor.id] || Promise.resolve()).then(run, run)
  }

  const handleCopy = (field, value) => {
    if (!value) return
    copyText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(current => current === field ? '' : current), 1200)
  }

  // Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [selectedVisitorForNote, setSelectedVisitorForNote] = useState(null)
  const [currentNote, setCurrentNote] = useState('')
  const [visitorNotes, setVisitorNotes] = useState([])
  const [visitorNotesLoading, setVisitorNotesLoading] = useState(false)

  useEffect(() => {
    if (!preloaded) loadVisitors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openHouseEventId])

  const loadVisitors = async () => {
    setIsLoading(true)
    setError('')
    const [visitorsResult, openHouseResult] = await Promise.all([
      api.openHouses.getVisitors(openHouseEventId),
      api.openHouses.getById(openHouseEventId),
    ])

    if (visitorsResult.success && visitorsResult.data) {
      // Newest sign-in first (user, 10/17) - the person who just walked in is on top.
      setVisitors([...visitorsResult.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    } else {
      setError(visitorsResult.error || 'Failed to load visitors')
    }
    if (openHouseResult.success && openHouseResult.data) {
      setOpenHouse(openHouseResult.data)
    }
    setIsLoading(false)
  }

  const formatGroupDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    if (date.toDateString() === today.toDateString()) return 'Today'
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getAgentStatusLabel = (status) => {
    const labels = {
      'YES': 'Has Agent',
      'NO': 'No Agent',
      'LOOKING': 'Looking for Agent'
    }
    return labels[status] || status
  }

  const getAgentStatusColor = (status) => {
    const colors = {
      'YES': 'bg-blue-100 text-blue-800 border-blue-200',
      'NO': 'bg-green-100 text-green-800 border-green-200',
      'LOOKING': 'bg-purple-100 text-purple-800 border-purple-200'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // The same person can sign in twice: their notes are their lead's, so every row of theirs updates.
  const setNoteCount = (visitor, count) => setVisitors(prev => prev.map(v =>
    (visitor.lead_id ? v.lead_id === visitor.lead_id : v.id === visitor.id) ? { ...v, note_count: count } : v))

  const handleOpenNoteModal = async (visitor) => {
    setSelectedVisitorForNote(visitor)
    setCurrentNote('')
    setIsNoteModalOpen(true)

    if (visitor.lead_id) {
      // Shared notes path: same lead_notes rows shown on this visitor's Leads profile.
      setVisitorNotes([])
      setVisitorNotesLoading(true)
      const { success, data } = await api.openHouses.getVisitorNotes(visitor.id)
      if (success && data) { setVisitorNotes(data); setNoteCount(visitor, data.length) }
      setVisitorNotesLoading(false)
    } else {
      // Legacy fallback for the rare visitor with no matching lead record yet.
      setCurrentNote(visitor.notes || '')
    }
  }

  const handleSaveNoteFromModal = async () => {
    if (!selectedVisitorForNote) return

    const { success, error } = await api.openHouses.updateVisitorNote(selectedVisitorForNote.id, currentNote)

    if (success) {
      // Update local state on success
      setVisitors(prev => prev.map(v =>
        v.id === selectedVisitorForNote.id ? { ...v, notes: currentNote, note_count: currentNote.trim() ? 1 : 0 } : v
      ))
      setIsNoteModalOpen(false)
    } else {
      alert('Failed to save note: ' + (error || 'Unknown error'))
    }
  }

  const handleAddVisitorNote = async (text) => {
    if (!selectedVisitorForNote) return
    const { success, data } = await api.openHouses.addVisitorNote(selectedVisitorForNote.id, { text })
    if (success && data) {
      setVisitorNotes(current => [data, ...current])
      setNoteCount(selectedVisitorForNote, visitorNotes.length + 1)
    }
  }

  const handleEditVisitorNote = async (noteId, text) => {
    const { success, data } = await api.openHouses.updateVisitorNoteThread(noteId, text)
    if (success && data) setVisitorNotes(current => current.map(n => n.id === noteId ? data : n))
  }

  const handleDeleteVisitorNote = async (noteId) => {
    const { success } = await api.openHouses.deleteVisitorNoteThread(noteId)
    if (success) {
      setVisitorNotes(current => current.filter(n => n.id !== noteId))
      setNoteCount(selectedVisitorForNote, Math.max(0, visitorNotes.length - 1))
    }
  }

  // The sheet keeps its contents while it slides away; the next open starts them fresh.
  const handleCloseNoteModal = () => setIsNoteModalOpen(false)

  return (
    <div className={embedded ? 'flex flex-col' : 'min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B] flex flex-col transition-colors duration-300'}>
      

      <div className={embedded ? 'flex-1' : 'flex-1 p-6 sm:p-8 pb-20 sm:pb-32'}>
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className={embedded ? 'mb-4' : 'mb-8'}>
            {embedded ? (
              // Inside the Visitors sheet - its header already shows the home; just the counts here.
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Visitors', value: visitors.length, icon: Users },
                  { label: 'No agent', value: visitors.filter(v => String(v.has_agent || '').toUpperCase() !== 'YES').length, icon: UserPlus },
                  { label: 'Starred', value: visitors.filter(v => v.is_favorite).length, icon: Star },
                ].map(t => (
                  // Phones: number over its label (side by side "No agent" got cut off).
                  <div key={t.label} className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-gray-100 bg-white px-2 py-2 dark:border-white/[0.07] dark:bg-[#141416] sm:flex-row sm:gap-2 sm:py-2.5">
                    <span className="flex items-center gap-1.5">
                      <t.icon className="h-4 w-4 shrink-0 text-[#C9A24D]" />
                      <span className="text-base font-black tabular-nums text-[#111827] dark:text-white">{isLoading ? '–' : t.value}</span>
                    </span>
                    <span className="max-w-full truncate text-[9px] font-black uppercase tracking-widest text-gray-400">{t.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <LuxeHero
                compact
                kicker="Visitors"
                icon={Users}
                backHref="/open-houses"
                backLabel="Open Houses"
                title={<>Visitor <em>insights</em></>}
                subtitle={openHouse?.address ? <>{toTitleCase(String(openHouse?.address || '').split(',')[0])}{openHouse.price ? ` · $${Number(openHouse.price).toLocaleString()}` : ''}</> : 'Everyone who signed in at this open house.'}
                aside={!isLoading && !error && (
                  <LuxeStats
                    stats={[
                      { label: 'Visitors', value: visitors.length, icon: Users },
                      { label: 'No agent', value: visitors.filter(v => String(v.has_agent || '').toUpperCase() === 'NO').length, icon: UserPlus },
                      { label: 'Has agent', value: visitors.filter(v => String(v.has_agent || '').toUpperCase() === 'YES').length, icon: UserCheck },
                    ]}
                  />
                )}
              />
            )}
          </div>

          {/* Content Section */}
          <div className="bg-transparent">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="text-center">
                  <OhpSpinner size={30} label="Loading visitors" />
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-24 bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Error Loading Visitors</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">{error}</p>
                <button
                  onClick={loadVisitors}
                  className="px-8 py-3 bg-gradient-to-br from-[#151517] via-[#3a2f25] to-[#8b7355] dark:from-[#C9A24D] dark:to-[#8b7355] text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            ) : visitors.length === 0 ? (
              <div className="text-center py-24 bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="w-20 h-20 bg-gray-50 dark:bg-[#0B0B0B] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Visitors Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">When visitors sign in at your open house, they'll appear here.</p>
              </div>
            ) : (
              <>
                {big && (
                  // Computer (owner, 11/07): search, filters and sort on one line; a phone stacks them.
                  <div data-testid="visitors-tools" className="mb-3 space-y-2 lg:flex lg:items-center lg:gap-2 lg:space-y-0">
                    <div className="flex gap-2 lg:contents">
                      <label className="relative min-w-0 flex-1 lg:order-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guests" aria-label="Search visitors" data-testid="visitors-search"
                          className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-[16px] text-gray-900 placeholder-gray-400 focus:border-[#C9A24D] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-white/10 dark:bg-[#141416] dark:text-white dark:placeholder-gray-500 sm:text-sm" />
                      </label>
                      <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort visitors" data-testid="visitors-sort"
                        className="h-11 shrink-0 rounded-xl border border-gray-200 bg-white pl-3 pr-2 lg:order-3 text-[16px] font-bold text-gray-700 focus:border-[#C9A24D] focus:outline-none dark:border-white/10 dark:bg-[#141416] dark:text-gray-200 sm:text-[13px]">
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="name">Name A-Z</option>
                      </select>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] lg:order-2 lg:shrink-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
                      {chips.map(c => (
                        <button key={c.key} type="button" onClick={() => setShow(c.key)} aria-pressed={show === c.key} data-testid={`visitors-show-${c.key}`}
                          className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide sm:px-3 transition active:scale-95 ${show === c.key ? 'border-[#111827] bg-[#111827] text-[#e8c97a] dark:border-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'}`}>
                          {c.label} <span className="tabular-nums opacity-60">{c.n}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {shown.length === 0 && (
                  <div data-testid="visitors-no-match" className="rounded-2xl border border-gray-100 bg-white px-4 py-12 text-center dark:border-white/[0.07] dark:bg-[#141416]">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">No one matches that</p>
                    <button type="button" onClick={() => { setQuery(''); setShow('all') }}
                      className="mt-3 rounded-full border border-[#C9A24D]/45 px-4 py-2 text-[12px] font-black text-[#8b7355] active:scale-95 dark:text-[#e8c97a]">Show everyone</button>
                  </div>
                )}

                {/* Desktop / tablet: table */}
                {wide && shown.length > 0 && <div className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                      <thead className="bg-[#faf9f7] dark:bg-[#0B0B0B]">
                        <tr>
                          <th scope="col" className="px-4 py-4 lg:px-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Visitor
                          </th>
                          <th scope="col" className="px-4 py-4 lg:px-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Contact Info
                          </th>
                          <th scope="col" className="px-4 py-4 lg:px-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Agent &amp; Showcase
                          </th>
                          <th scope="col" className="px-4 py-4 lg:px-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Checked In
                          </th>
                          <th scope="col" className="px-4 py-4 lg:px-5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-[#151517]">
                        {page.map((visitor, index) => (
                          <Fragment key={visitor.id}>
                            {newDayAt(index) && (
                              // A clear break before each new day - room above the label, a hairline
                              // after it (it sat right under the last row - user, 10/24).
                              <tr className={index > 0 ? 'border-t border-gray-100 dark:border-gray-800/60' : ''}>
                                <td colSpan={5} className={`px-4 lg:px-5 pb-2 ${index > 0 ? 'pt-8' : 'pt-4'}`}>
                                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">
                                    <span className="shrink-0">{formatGroupDate(visitor.created_at)}</span>
                                    <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/40 to-transparent" />
                                  </div>
                                </td>
                              </tr>
                            )}
                            <tr
                              data-visitor-id={visitor.id}
                              className={`hover:bg-gray-50 dark:hover:bg-[#2c241b] transition-colors ${index > 0 && !newDayAt(index) ? 'border-t border-gray-100 dark:border-gray-800/60' : ''} ${focusRing(visitor.id)}`}
                            >
                              <td className="px-4 py-4 lg:px-5 whitespace-nowrap w-1/5">
                                <div className="flex items-center">
                                  <div className="h-10 w-10 bg-[#151517] dark:bg-[#C9A24D] rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                                    <span className="text-white text-sm font-bold">
                                      {visitor.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="ml-4">
                                    {/* Their lead page, one tap from the visitor list (owner, 11/01). */}
                                    {visitor.lead_id ? (
                                      <Link href={`/leads/${visitor.lead_id}`} data-testid="visitor-lead-link" className="group block">
                                        <div className="text-sm font-bold text-gray-900 group-hover:text-[#8b7355] dark:text-white dark:group-hover:text-[#C9A24D]">{visitor.full_name}</div>
                                        <div className="flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400">#{index + 1} · <span className="font-bold text-[#8b7355] dark:text-[#C9A24D]">Lead page</span><ChevronRight className="h-3 w-3 text-[#8b7355] dark:text-[#C9A24D]" /></div>
                                      </Link>
                                    ) : (
                                      <>
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">{visitor.full_name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">#{index + 1}</div>
                                      </>
                                    )}
                                  </div>
                                  {visitor.lead_id && <div className="ml-2"><VisitorStar size="sm" on={!!visitor.is_favorite} onToggle={() => toggleStar(visitor)} /></div>}
                                </div>
                              </td>
                              <td className="px-4 py-4 lg:px-5 whitespace-nowrap w-1/4">
                                <div className="flex flex-col space-y-1">
                                  <CopyField field={`${visitor.id}-email`} value={visitor.email} icon={Mail} href={`mailto:${visitor.email}`} contacted={reachedBy(visitor, 'email')} copied={copiedField} onCopy={handleCopy} />
                                  <CopyField field={`${visitor.id}-phone`} value={visitor.phone} icon={Phone} href={`tel:${visitor.phone}`} display={formatPhone(visitor.phone)} contacted={reachedBy(visitor, 'text')} copied={copiedField} onCopy={handleCopy} />
                                  <VisitorReach compact visitor={visitor} agent={user} street={ohStreet} onContacted={via => markContacted(visitor, via)} />
                                </div>
                              </td>
                              <td className="px-4 py-4 lg:px-5 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getAgentStatusColor(visitor.has_agent)}`}>
                                  {getAgentStatusLabel(visitor.has_agent)}
                                </span>
                                {visitor.showcase_switchable && (
                                  <VisitorShowcaseSwitch layout="cell" visitor={visitor} busy={!!showcaseBusy[visitor.id]} onToggle={() => toggleShowcase(visitor)} />
                                )}
                                {visitor.showcase_id && (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <button type="button" data-testid="visitor-edit-showcase" onClick={e => { e.stopPropagation(); setEditFor(visitor) }} className="inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/40 bg-white px-2.5 py-1 text-[11px] font-black text-[#8b7355] transition hover:border-[#C9A24D] active:scale-95 dark:bg-white/5 dark:text-[#e8c97a]"><Pencil className="h-3 w-3" /> Edit Showcase</button>
                                    <OpenShowcaseLink compact id={visitor.showcase_id} />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4 lg:px-5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                {embedded ? new Date(visitor.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : formatDate(visitor.created_at)}
                              </td>
                              <td className="px-4 py-4 lg:px-5 whitespace-nowrap">
                                <div className="inline-flex flex-col items-stretch gap-1.5">
                                <button
                                  onClick={() => handleOpenNoteModal(visitor)}
                                  data-testid="visitor-notes"
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600"
                                >
                                  <NotebookPen className="w-3 h-3" />
                                  Notes
                                  <NoteCount n={visitor.note_count} />
                                </button>
                                {visitor.pass_events > 0 && <GuestActivityButton compact visitor={visitor} onOpen={() => setActivityFor(visitor)} />}
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>}

                {/* Phones (user, 10/24): roomy cards grouped by day - a clear gap + gold rule
                    before each new day, the lead star up top, Notes / Guest Activity side by side. */}
                {!wide && shown.length > 0 && <div>
                  {page.map((visitor, index) => {
                    const newDay = newDayAt(index)
                    const status = String(visitor.has_agent || '').toUpperCase()
                    return (
                    <div key={visitor.id} className={index === 0 ? '' : newDay ? 'mt-8' : 'mt-2.5'}>
                      {newDay && (
                        <div className="mb-2.5 flex items-center gap-3 px-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">
                          <span className="shrink-0">{formatGroupDate(visitor.created_at)}</span>
                          <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/45 to-transparent" />
                        </div>
                      )}
                      <div
                        data-visitor-id={visitor.id}
                        className={`overflow-hidden rounded-[22px] border bg-white [contain-intrinsic-size:auto_320px] [content-visibility:auto] shadow-[0_14px_30px_-26px_rgba(17,24,39,.55)] dark:bg-[#141416] ${visitor.is_favorite ? 'border-[#C9A24D]/45' : 'border-gray-100 dark:border-white/[0.07]'} ${focusVisitorId === visitor.id ? 'ring-2 ring-[#C9A24D] ring-offset-2 dark:ring-offset-[#0B0B0B]' : ''}`}
                      >
                        <div className="flex items-center gap-3 p-3.5 pb-3">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] font-serif text-sm font-black text-[#e8c97a] shadow-sm">
                            {visitor.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-serif text-[16px] font-black leading-tight text-[#111827] dark:text-white">{visitor.full_name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${status === 'YES' ? 'bg-sky-500' : status === 'LOOKING' ? 'bg-violet-500' : 'bg-emerald-500'}`} />
                              <span className="truncate">{getAgentStatusLabel(visitor.has_agent)} · {new Date(visitor.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                            </p>
                          </div>
                          {visitor.lead_id && (
                            <Link href={`/leads/${visitor.lead_id}`} data-testid="visitor-lead-link" aria-label={`${visitor.full_name}'s lead page`}
                              className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#C9A24D]/45 px-2.5 py-1.5 text-[11px] font-black text-[#8b7355] active:scale-95 dark:text-[#e8c97a]">
                              Lead <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {visitor.lead_id && <VisitorStar on={!!visitor.is_favorite} onToggle={() => toggleStar(visitor)} />}
                        </div>

                        <div className="mx-3.5 flex flex-col gap-1.5 rounded-2xl bg-[#faf9f7] px-3 py-2.5 dark:bg-white/[0.03]">
                          <CopyField field={`${visitor.id}-email-m`} value={visitor.email} icon={Mail} href={`mailto:${visitor.email}`} contacted={reachedBy(visitor, 'email')} copied={copiedField} onCopy={handleCopy} />
                          <CopyField field={`${visitor.id}-phone-m`} value={visitor.phone} icon={Phone} href={`tel:${visitor.phone}`} display={formatPhone(visitor.phone)} contacted={reachedBy(visitor, 'text')} copied={copiedField} onCopy={handleCopy} />
                        </div>

                        <div className="mx-3.5 mt-2.5">
                          <VisitorReach visitor={visitor} agent={user} street={ohStreet} onContacted={via => markContacted(visitor, via)} />
                        </div>

                        {visitor.showcase_switchable && (
                          <div className="mx-3.5 mt-2.5 flex gap-2">
                            <div className="min-w-0 flex-1"><VisitorShowcaseSwitch visitor={visitor} busy={!!showcaseBusy[visitor.id]} onToggle={() => toggleShowcase(visitor)} /></div>
                            {visitor.showcase_id && <OpenShowcaseLink id={visitor.showcase_id} />}
                          </div>
                        )}
                        {visitor.showcase_id && (
                          <div className="mx-3.5 mt-2 flex gap-2">
                            <button type="button" data-testid="visitor-edit-showcase" onClick={() => setEditFor(visitor)}
                              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-[#C9A24D]/40 bg-white py-2.5 text-[13px] font-black text-[#8b7355] transition active:scale-[0.98] dark:bg-white/5 dark:text-[#e8c97a]">
                              <Pencil className="h-3.5 w-3.5" /> Edit Showcase
                            </button>
                            {!visitor.showcase_switchable && <OpenShowcaseLink id={visitor.showcase_id} />}
                          </div>
                        )}

                        <div className={`grid gap-2 p-3.5 pt-3 ${visitor.pass_events > 0 ? 'grid-cols-1 min-[360px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]' : 'grid-cols-1'}`}>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleOpenNoteModal(visitor)}
                            data-testid="visitor-notes"
                            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 text-[11px] font-black uppercase tracking-wide text-[#111827] dark:border-white/10 dark:bg-white/5 dark:text-white"
                          >
                            <NotebookPen className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
                            Notes
                            <NoteCount n={visitor.note_count} />
                          </motion.button>
                          {visitor.pass_events > 0 && <GuestActivityButton visitor={visitor} onOpen={() => setActivityFor(visitor)} />}
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>}

                {shown.length > limit && (
                  <button type="button" data-testid="visitors-more" onClick={() => setLimit(l => l + PAGE)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#C9A24D]/40 bg-white py-3 text-[13px] font-black text-[#8b7355] transition active:scale-[0.99] dark:bg-white/5 dark:text-[#e8c97a]">
                    Show {Math.min(PAGE, shown.length - limit)} more <span className="font-semibold text-gray-400">· {shown.length - limit} left</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {!embedded && <Footer />}

      {/* Notes: the same slide-up sheet as everything else here, a centred window on a computer. It
          sits over the Visitors sheet and lifts above the phone keyboard by itself. */}
      <OhSheet open={isNoteModalOpen} onClose={handleCloseNoteModal} zClass="z-[120]" width="max-w-lg"
        title="Notes" subtitle={selectedVisitorForNote ? `For ${selectedVisitorForNote.full_name}` : undefined} icon={<NotebookPen className="h-5 w-5" />}>
        {selectedVisitorForNote?.lead_id ? (
          <div data-testid="visitor-notes-sheet">
            <p className="mb-3 text-[11px] font-medium text-gray-400">Shared with this visitor's matching lead profile.</p>
            <NotesThread
              notes={visitorNotes}
              loading={visitorNotesLoading}
              currentUserId={user?.id}
              onAdd={handleAddVisitorNote}
              onEdit={handleEditVisitorNote}
              onDelete={handleDeleteVisitorNote}
            />
          </div>
        ) : (
          <div data-testid="visitor-notes-sheet">
            <textarea
              value={currentNote}
              onChange={(e) => setCurrentNote(e.target.value)}
              className="block w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 resize-none font-medium"
              rows={6}
              placeholder="Enter notes about this visitor's preferences, feedback, or follow-up needs..."
            />
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={handleCloseNoteModal}
                className="px-5 py-2.5 bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl transition-all duration-200 text-xs uppercase tracking-wide"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNoteFromModal}
                className="px-6 py-2.5 bg-[#151517] dark:bg-white hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-wide"
              >
                Save Note
              </button>
            </div>
          </div>
        )}
      </OhSheet>

      <PassActivitySheet visitor={activityFor} onClose={() => setActivityFor(null)} onSeen={id => patchVisitor(id, { pass_new: 0 })} />
      <QuickEditShowcase open={!!editFor} onClose={() => setEditFor(null)} leadId={editFor?.lead_id} initialId={editFor?.showcase_id} who={editFor?.full_name} />
    </div>
  )
}
