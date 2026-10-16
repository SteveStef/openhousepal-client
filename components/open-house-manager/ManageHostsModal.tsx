'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, X, Loader2, Inbox, History, Users, Home, Star, Save, AlertTriangle, CalendarClock, Send, Search, Trash2, ChevronLeft, ChevronRight, ChevronDown, Info, PencilLine, User } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { AgentSearchResult, Broadcast, ListingDetail, ScheduledOpen, TeamMember, TrustedHost } from '@/types'
import HostRequestCard from './HostRequestCard'
import GuestDetailsToggle from './GuestDetailsToggle'
import EmptyState from './EmptyState'
import WeekendCalendarCards, { WeekendCell, WeekendCalendarOpen, hostingNote, type HostingWindow } from './WeekendCalendarCards'
import { todayLocal } from '@/lib/relativeDays'
import TakenDatesPicker from './TakenDatesPicker'
import InfoTooltip from './InfoTooltip'
import { formatEventDate, formatDuration, formatTime, TIME_SLOT_OPTIONS, endTimeOptionsFor } from './formatters'
import TimeSelect from './TimeSelect'
import Pager from '@/components/Pager'
import { refreshOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'

export default function ManageHostsModal({
  listingKey,
  onClose,
  onActionComplete,
  prefillDirectDate,
  focusHostNotes,
  hostingWindow,
}: {
  listingKey: string | null
  onClose: () => void
  onActionComplete: () => void
  // Set when the agent got here by clicking an empty weekend cell on the property card - fills
  // the Direct Request date in for them so they don't have to look the date back up.
  prefillDirectDate?: string | null
  // Set when the agent clicked an already-filled weekend cell - jumps to Host Notes since that's
  // the thing worth their attention there (see the warning banner on that section).
  focusHostNotes?: boolean
  // Coming Soon / under contract - days it can't be shown are locked on the calendar.
  hostingWindow?: HostingWindow
}) {
  const { showToast } = useToast()
  const [detail, setDetail] = useState<ListingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  const [trustedHosts, setTrustedHosts] = useState<TrustedHost[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [directSearchQuery, setDirectSearchQuery] = useState('')
  const [directSearchResults, setDirectSearchResults] = useState<AgentSearchResult[]>([])
  const [directTargetAgent, setDirectTargetAgent] = useState<{ id: string; name: string } | null>(null)
  // Set instead of directTargetAgent when sending the same Direct Request form to the whole team
  // at once rather than one specific agent - same createBroadcast call either way, just without
  // target_agent_id (see handleSendDirectRequest).
  const [sendToWholeTeam, setSendToWholeTeam] = useState(false)
  const [directDate, setDirectDate] = useState('')
  const [directStart, setDirectStart] = useState('')
  const [directEnd, setDirectEnd] = useState('')
  const [directIsAnytime, setDirectIsAnytime] = useState(false)
  const [directMessage, setDirectMessage] = useState('')
  const [isSendingDirect, setIsSendingDirect] = useState(false)
  const [openBroadcasts, setOpenBroadcasts] = useState<Broadcast[]>([])
  const [cancelTarget, setCancelTarget] = useState<ScheduledOpen | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  // "Agents Who Have Hosted Here" can run long - paginate it so a listing with a big hosting
  // history doesn't push the rest of the modal way down.
  const HISTORY_PAGE_SIZE = 6
  const [historyPage, setHistoryPage] = useState(1)

  const trustedHostsScrollRef = useRef<HTMLDivElement>(null)
  const [trustedHostsOverflow, setTrustedHostsOverflow] = useState(false)
  const teamHostsScrollRef = useRef<HTMLDivElement>(null)
  const [teamHostsOverflow, setTeamHostsOverflow] = useState(false)

  const directRequestSectionRef = useRef<HTMLDivElement>(null)
  const hostNotesSectionRef = useRef<HTMLDivElement>(null)
  const [directHighlight, setDirectHighlight] = useState(false)
  const [notesHighlight, setNotesHighlight] = useState(false)
  // Host Notes sit half-open (a nudge when empty, a preview when written) - the editor opens on tap.
  const [notesOpen, setNotesOpen] = useState(false)
  // Hosting history starts folded - it's looked at far less than requests and finding a host.
  const [historyOpen, setHistoryOpen] = useState(false)

  // Accepted teammates get their own starred row above "Hosted for you before," sorted by who's
  // hosted the most FOR THIS AGENT specifically - reuses the same times_hosted the trusted-hosts
  // audit-log query already computed rather than a second backend query. Anyone shown here is
  // pulled out of "Hosted for you before" below so they don't appear twice.
  const teamHosts = useMemo(() => {
    const timesHostedByAgent = new Map(trustedHosts.map(h => [h.agent_id, h.times_hosted]))
    return teamMembers
      .filter(m => m.status === 'accepted')
      .map(m => ({ agent_id: m.agent_id, name: m.name, photo_url: m.photo_url, times_hosted: timesHostedByAgent.get(m.agent_id) || 0 }))
      .sort((a, b) => b.times_hosted - a.times_hosted)
  }, [teamMembers, trustedHosts])

  const teamAgentIds = useMemo(() => new Set(teamHosts.map(t => t.agent_id)), [teamHosts])
  const nonTeamTrustedHosts = useMemo(() => trustedHosts.filter(h => !teamAgentIds.has(h.agent_id)), [trustedHosts, teamAgentIds])

  const hostingHistory = detail?.history ?? []
  const historyTotalPages = Math.max(1, Math.ceil(hostingHistory.length / HISTORY_PAGE_SIZE))
  const pagedHostingHistory = hostingHistory.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)

  // Arrows only make sense once the chips actually overflow the row - re-checked whenever the
  // list changes or the modal is resized, not just once on mount.
  useEffect(() => {
    const el = trustedHostsScrollRef.current
    if (!el) { setTrustedHostsOverflow(false); return }
    const checkOverflow = () => setTrustedHostsOverflow(el.scrollWidth > el.clientWidth + 1)
    checkOverflow()
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [nonTeamTrustedHosts])

  useEffect(() => {
    const el = teamHostsScrollRef.current
    if (!el) { setTeamHostsOverflow(false); return }
    const checkOverflow = () => setTeamHostsOverflow(el.scrollWidth > el.clientWidth + 1)
    checkOverflow()
    const resizeObserver = new ResizeObserver(checkOverflow)
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [teamHosts])

  const scrollTeamHosts = (direction: 'left' | 'right') => {
    teamHostsScrollRef.current?.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  const scrollTrustedHosts = (direction: 'left' | 'right') => {
    trustedHostsScrollRef.current?.scrollBy({ left: direction === 'left' ? -160 : 160, behavior: 'smooth' })
  }

  const loadBroadcasts = async (key: string) => {
    const { success, data } = await api.openHouseManager.getMyBroadcasts()
    if (success && data) setOpenBroadcasts(data.filter(b => b.listing_key === key && b.status === 'open'))
  }

  const load = async (key: string) => {
    setIsLoading(true)
    setLoadError('')
    const { success, data, error } = await api.openHouseManager.getListingDetail(key)
    if (success && data) {
      setDetail(data)
      setNotesDraft(data.notes.notes || '')
      setHistoryPage(1)
    } else {
      setLoadError(error || 'Unable to load this listing right now.')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (listingKey) {
      load(listingKey)
      loadBroadcasts(listingKey)
      // Clear the "unseen update" badge contribution for host-responded-to-your-proposed-time
      // notifications now that the listing agent is looking at this listing's requests.
      api.notifications.markTypesAsRead(['HOST_REQUEST_RECEIVED', 'HOST_REQUEST_COUNTER_RESPONSE']).then(refreshOpenHouseActionCounts)
      api.openHouseManager.getHostedBefore().then(({ success, data }) => { if (success && data) setTrustedHosts(data) })
      api.openHouseManager.getTeamMembers().then(({ success, data }) => { if (success && data) setTeamMembers(data) })
    }
  }, [listingKey])

  // Arriving here from a calendar-cell click on the property card - prefill/jump to whichever
  // section that click was about, then briefly pulse it so it's obvious where to look.
  useEffect(() => {
    if (!listingKey) return
    if (prefillDirectDate) {
      setDirectDate(prefillDirectDate)
      setTimeout(() => {
        directRequestSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setDirectHighlight(true)
        setTimeout(() => setDirectHighlight(false), 2000)
      }, 200)
    } else if (focusHostNotes) {
      setTimeout(() => {
        hostNotesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setNotesHighlight(true); setNotesOpen(true)
        setTimeout(() => setNotesHighlight(false), 2000)
      }, 200)
    }
    // Only meant to fire once per open, not on every subsequent state change these effects cause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingKey, prefillDirectDate, focusHostNotes])

  useEffect(() => {
    if (directSearchQuery.trim().length < 2) {
      setDirectSearchResults([])
      return
    }
    const timeout = setTimeout(async () => {
      const { success, data } = await api.openHouseManager.searchAgents(directSearchQuery.trim())
      if (success && data) setDirectSearchResults(data)
    }, 300)
    return () => clearTimeout(timeout)
  }, [directSearchQuery])

  const handleDirectStartChange = (value: string) => {
    setDirectStart(value)
    if (!endTimeOptionsFor(value).some(opt => opt.value === directEnd)) setDirectEnd('')
  }

  // A ref, not just the isSendingDirect state, guards against a real double-click - state updates
  // aren't reflected in the disabled attribute until the next render, so two clicks inside that
  // window could otherwise both slip through and fire two identical broadcasts.
  const isSendingDirectRef = useRef(false)

  const handleSendDirectRequest = async () => {
    if (isSendingDirectRef.current) return
    if (!listingKey || (!directTargetAgent && !sendToWholeTeam) || !directDate || (!directIsAnytime && (!directStart || !directEnd))) {
      showToast('Pick a day and time (or Anytime), then who to ask.', 'error')
      return
    }
    isSendingDirectRef.current = true
    setIsSendingDirect(true)
    const { success, error } = await api.openHouseManager.createBroadcast({
      listing_key: listingKey,
      requested_date: directDate,
      requested_start_time: directIsAnytime ? undefined : directStart,
      requested_end_time: directIsAnytime ? undefined : directEnd,
      is_anytime: directIsAnytime,
      message: directMessage.trim() || undefined,
      target_agent_id: sendToWholeTeam ? undefined : directTargetAgent!.id,
    })
    isSendingDirectRef.current = false
    setIsSendingDirect(false)
    if (success) {
      showToast(sendToWholeTeam ? 'Sent to your entire team.' : `Sent to ${directTargetAgent!.name}.`, 'success')
      setDirectTargetAgent(null)
      setSendToWholeTeam(false)
      setDirectSearchQuery('')
      setDirectDate('')
      setDirectStart('')
      setDirectEnd('')
      setDirectIsAnytime(false)
      setDirectMessage('')
      if (listingKey) await loadBroadcasts(listingKey)
    } else {
      showToast(error || 'Unable to send this request right now.', 'error')
    }
  }

  const handleCancelBroadcast = async (broadcastId: string) => {
    const { success, error } = await api.openHouseManager.cancelBroadcast(broadcastId)
    if (success) {
      setOpenBroadcasts(prev => prev.filter(b => b.id !== broadcastId))
      showToast('Request cancelled.', 'success')
    } else {
      showToast(error || 'Unable to cancel this request right now.', 'error')
    }
  }

  const handleApprove = async (id: string) => {
    const { success, error } = await api.openHouseManager.approveRequest(id)
    if (success) {
      showToast("Request approved - the host was notified and it's on their calendar. They'll use their kit for this home (or build one if it's their first time hosting it).", 'success')
      if (listingKey) { await load(listingKey); await loadBroadcasts(listingKey) }
      onActionComplete()
    } else {
      showToast(error || 'Failed to approve this request.', 'error')
    }
  }

  const handleDecline = async (id: string) => {
    const { success, error } = await api.openHouseManager.declineRequest(id)
    if (success) {
      showToast('Request declined.', 'success')
      if (listingKey) await load(listingKey)
      onActionComplete()
    } else {
      showToast(error || 'Failed to decline this request.', 'error')
    }
  }

  const handleCounter = async (id: string, counterDate: string, counterStart: string, counterEnd: string, counterMessage: string) => {
    const { success, error } = await api.openHouseManager.counterRequest(id, {
      counter_date: counterDate, counter_start_time: counterStart, counter_end_time: counterEnd, counter_message: counterMessage || undefined,
    })
    if (success) {
      showToast('Proposed a new time.', 'success')
      if (listingKey) await load(listingKey)
      onActionComplete()
    } else {
      showToast(error || 'Failed to propose a new time.', 'error')
    }
  }

  const handleConfirmCancel = async () => {
    if (!listingKey || !cancelTarget || !cancelTarget.scheduled_date) return
    setIsCancelling(true)
    const { success, error } = await api.openHouseManager.cancelApprovedOpen(listingKey, cancelTarget.hosting_agent_id, cancelTarget.scheduled_date, cancelTarget.scheduled_start_time, cancelTarget.scheduled_end_time)
    setIsCancelling(false)
    if (success) {
      showToast('Open house cancelled. The host has been notified.', 'success')
      setCancelTarget(null)
      await load(listingKey)
      onActionComplete()
    } else {
      showToast(error || 'Unable to cancel this open house right now.', 'error')
    }
  }

  const handleSaveNotes = async () => {
    if (!listingKey) return
    setIsSavingNotes(true)
    const { success, data, error } = await api.openHouseManager.saveListingNotes(listingKey, {
      notes: notesDraft,
    })
    if (success && data) {
      setDetail(prev => prev ? { ...prev, notes: data } : prev)
      setNotesOpen(false)
      showToast('Host notes saved.', 'success')
      onActionComplete()
    } else {
      showToast(error || 'Failed to save notes.', 'error')
    }
    setIsSavingNotes(false)
  }

  const handleCalendarCellClick = (cell: WeekendCell, open?: WeekendCalendarOpen) => {
    if (open) {
      hostNotesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNotesHighlight(true); setNotesOpen(true)
      setTimeout(() => setNotesHighlight(false), 2000)
    } else {
      setDirectDate(cell.date)
      directRequestSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setDirectHighlight(true)
      setTimeout(() => setDirectHighlight(false), 2000)
    }
  }

  // Coming Soon: no days before it goes live (the server refuses them anyway).
  const firstHostableDay = hostingWindow?.hosts_from && hostingWindow.hosts_from > todayLocal() ? hostingWindow.hosts_from : undefined
  const askReady = !!directDate && (directIsAnytime || (!!directStart && !!directEnd)) && (sendToWholeTeam || !!directTargetAgent)
  const askLabel = !directDate || (!directIsAnytime && (!directStart || !directEnd))
    ? 'Pick a day and time'
    : !sendToWholeTeam && !directTargetAgent
      ? 'Choose who to ask'
      : sendToWholeTeam
        ? (teamHosts.length === 1 ? 'Ask your teammate' : `Ask all ${teamHosts.length} teammates`)
        : `Ask ${directTargetAgent!.name.split(' ')[0]}`

  const allOpens: ScheduledOpen[] = detail ? [...detail.scheduled_opens, ...detail.confirmed_pending_kit] : []
  // A kit that's been reused so much its own recorded date got cleared back to "evergreen" (see
  // cancel_approved_open) is still a real, built kit - just not scheduled for any specific date -
  // so it doesn't belong in a list titled "Scheduled Opens" (nor in its count badge).
  const datedOpens = allOpens.filter(o => o.scheduled_date)
  const takenDates = new Set(allOpens.map(o => o.scheduled_date).filter((d): d is string => !!d))

  return (
    <>
    <AnimatePresence>
      {listingKey && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white dark:bg-[#0B0B0B] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-b from-gray-50 to-white dark:from-white/[0.03] dark:to-[#0B0B0B] p-5 sm:p-6">
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-sm">
            {detail?.image ? (
              <img src={detail.image} alt={detail.address || ''} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-700"><Home size={20} /></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black text-[#111827] dark:text-white">Open House Hosts</h2>
            <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{detail?.address || 'Loading...'}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load this listing" description={loadError} />
          ) : detail ? (
            <div className="space-y-5">
              {/* Requests to Host - full width, top priority since an incoming ask needs a
                  response before anything else here matters. */}
              <section className={`rounded-2xl border p-4 sm:p-5 transition-shadow ${
                detail.pending_requests.length > 0
                  ? 'border-red-300 dark:border-red-500/50 bg-white dark:bg-[#151517] shadow-[0_0_0_4px_rgba(239,68,68,0.1)] dark:shadow-[0_0_0_4px_rgba(239,68,68,0.15)]'
                  : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] shadow-sm'
              }`}>
                <div className="mb-3 flex items-center gap-2">
                  <Inbox size={15} className={detail.pending_requests.length > 0 ? 'text-red-500' : 'text-[#C9A24D]'} />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Requests to Host</h3>
                  {detail.pending_requests.length > 0 && (
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">{detail.pending_requests.length} NEEDS A RESPONSE</span>
                  )}
                </div>
                {detail.pending_requests.length === 0 ? (
                  <EmptyState compact icon={Inbox} title="No pending requests" description="No one has asked to host this listing yet." />
                ) : (
                  <div className="space-y-3">
                    {detail.pending_requests.map(request => (
                      <HostRequestCard key={request.id} request={request} showHistory onApprove={handleApprove} onDecline={handleDecline} onCounter={handleCounter} />
                    ))}
                  </div>
                )}
              </section>

              {/* Scheduled Opens + Host Notes side by side, same length - the two things worth
                  checking together before you commit a date to someone. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
                <section className="flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] p-4 sm:p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarClock size={15} className="text-[#C9A24D]" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Scheduled Opens</h3>
                    {datedOpens.length > 0 && (
                      <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black text-[#C9A24D]">{datedOpens.length}</span>
                    )}
                  </div>

                  <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-400">This weekend / Next weekend</p>
                  <WeekendCalendarCards opens={allOpens} onCellClick={handleCalendarCellClick} hostingWindow={hostingWindow}
                    pendingDates={detail.pending_requests.map(r => String(r.requested_date))} pendingLabel="Request in" pendingTitle="An agent asked to host this date - see the request above" />

                  {datedOpens.length === 0 ? (
                    <div className="mt-3 flex-1">
                      <EmptyState compact icon={CalendarClock} title="No opens scheduled" description="Once a host is confirmed for a date, it'll show up here until that date passes." />
                    </div>
                  ) : (
                    <div className="mt-3 flex-1 space-y-2 overflow-y-auto max-h-56">
                      {/* Both a built kit AND a confirmed-but-kit-less date can exist for this
                          listing at the same time (e.g. two different approved requests) - both
                          render here, sorted together, so neither one hides the other. Full list
                          (not just the two weekends above) so a farther-out or weekday date, and
                          the cancel action, both stay reachable. */}
                      {datedOpens
                        .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
                        .map(open => {
                          const startTime = formatTime(open.scheduled_start_time)
                          const endTime = formatTime(open.scheduled_end_time)
                          const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : null
                          const isBrightMls = open.hosting_agent_id === 'BRIGHT-MLS'
                          return (
                            <div key={open.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  {open.hosting_agent_photo_url ? (
                                    <img src={open.hosting_agent_photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                                  ) : (
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                                      <User size={14} />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-[#111827] dark:text-white">{open.hosting_agent_name}</p>
                                    <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                                      {open.hosting_agent_brokerage ? `${open.hosting_agent_brokerage} · ` : ''}{formatEventDate(open.scheduled_date)}
                                      {timeRange ? ` · ${timeRange}` : ''}
                                    </p>
                                  </div>
                                </div>
                                {!open.kit_built && (
                                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
                                    Kit Not Built Yet
                                    <InfoTooltip text="The hosting agent has been confirmed for this date but hasn't built an Open House Kit yet - the sign-in form, materials, etc. That's on them, not something you need to do." />
                                  </span>
                                )}
                                {/* No cancel for a Bright-sourced date - there's no OpenHousePal
                                    request behind it to revoke, it's just what Bright reports. */}
                                {open.scheduled_date && !isBrightMls && (
                                  <button
                                    onClick={() => setCancelTarget(open)}
                                    className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                    aria-label="Cancel this open house"
                                    title="Cancel this open house"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  )}
                </section>

                <motion.section
                  ref={hostNotesSectionRef}
                  animate={notesHighlight ? { boxShadow: ['0 0 0 0px rgba(201,162,77,0)', '0 0 0 4px rgba(201,162,77,0.5)', '0 0 0 0px rgba(201,162,77,0)'] } : {}}
                  transition={{ duration: 2 }}
                  className="flex flex-col rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] p-4 sm:p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Host Notes
                      {!(detail.notes.notes || '').trim() && !notesOpen && <span className="rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black tracking-widest text-white">Empty</span>}
                    </h3>
                    {detail.notes.updated_at && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Updated {new Date(detail.notes.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {notesOpen ? (
                  <>
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/5 p-2.5">
                    <Info size={13} className="mt-0.5 shrink-0 text-blue-500" />
                    <p className="text-[10px] font-semibold leading-snug text-blue-700 dark:text-blue-300">
                      This note is shared with every agent who hosts here in the future - you can always change it.
                    </p>
                  </div>
                  <textarea
                    autoFocus
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    rows={5}
                    placeholder="Access instructions, lockbox/keypad code, parking, alarm, seller preferences, setup expectations, refreshments..."
                    className="w-full flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] p-3 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white"
                  />
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <button
                      onClick={() => { setNotesDraft(detail.notes.notes || ''); setNotesOpen(false) }}
                      disabled={isSavingNotes}
                      className="px-3 py-2 text-xs font-black text-gray-500 hover:text-gray-700 dark:hover:text-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                    >
                      {isSavingNotes ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Notes
                    </button>
                  </div>
                  </>
                  ) : (detail.notes.notes || '').trim() ? (
                    <button onClick={() => setNotesOpen(true)} className="group flex flex-1 flex-col text-left">
                      <p className="line-clamp-4 whitespace-pre-line rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-sm font-medium text-gray-700 dark:text-gray-200">{detail.notes.notes}</p>
                      <span className="mt-2 text-xs font-black text-[#8b7355] group-hover:underline dark:text-[#e8cf8a]">Edit notes</span>
                    </button>
                  ) : (
                    <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border-2 border-dashed border-[#C9A24D]/60 bg-[#C9A24D]/5 p-4">
                      <p className="text-sm font-semibold leading-snug text-[#5c4a30] dark:text-[#e8cf8a]">
                        Hosts need this to get in. Add the lockbox code, parking, and anything else they should know.
                      </p>
                      <button onClick={() => setNotesOpen(true)}
                        className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-white transition hover:bg-[#b08b3a]">
                        <PencilLine size={13} /> Write host notes
                      </button>
                    </div>
                  )}
                </motion.section>
              </div>

              {/* Find a Host - one step for both ways of asking: pick the day, then pick one agent
                  or the whole team. (Agents can still ask on their own from Discovery.) */}
              <motion.section
                ref={directRequestSectionRef}
                animate={directHighlight ? { boxShadow: ['0 0 0 0px rgba(201,162,77,0)', '0 0 0 4px rgba(201,162,77,0.5)', '0 0 0 0px rgba(201,162,77,0)'] } : {}}
                transition={{ duration: 2 }}
                className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] p-4 sm:p-5 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    <Send size={15} className="text-[#C9A24D]" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Find a Host</h3>
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Pick a day, then who to ask.</p>
                </div>
                {hostingWindow?.hosting_blocked ? (
                  <EmptyState compact icon={CalendarClock} title="Not taking hosts right now" description={hostingNote(hostingWindow) || 'This home can\'t be shown right now.'} />
                ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">1 · When</p>
                    <div className="flex flex-wrap gap-2">
                      <div className="min-w-[140px] flex-1">
                        <TakenDatesPicker value={directDate} onChange={setDirectDate} takenDates={takenDates} minDate={firstHostableDay} />
                      </div>
                      {!directIsAnytime && (
                        <>
                          <TimeSelect
                            value={directStart}
                            onChange={handleDirectStartChange}
                            options={TIME_SLOT_OPTIONS}
                            placeholder="Start"
                            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                          />
                          <TimeSelect
                            value={directEnd}
                            onChange={setDirectEnd}
                            options={endTimeOptionsFor(directStart)}
                            placeholder="End"
                            disabled={!directStart}
                            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white disabled:opacity-50"
                          />
                        </>
                      )}
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 px-0.5">
                      <input
                        type="checkbox"
                        checked={directIsAnytime}
                        onChange={e => setDirectIsAnytime(e.target.checked)}
                        className="h-3.5 w-3.5 shrink-0 accent-[#C9A24D]"
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Anytime - I don't care what time</span>
                    </label>
                    <textarea
                      value={directMessage}
                      onChange={e => setDirectMessage(e.target.value)}
                      placeholder="Optional note..."
                      rows={2}
                      className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-3 py-2 text-xs font-medium outline-none focus:border-[#C9A24D] dark:text-white"
                    />
                  </div>

                  <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">2 · Who</p>
                    {(directTargetAgent || sendToWholeTeam) ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-[#C9A24D]/10 px-3 py-2">
                          <span className="text-sm font-black text-[#8b7355] dark:text-[#e8cf8a]">{sendToWholeTeam ? `Your whole team (${teamHosts.length})` : directTargetAgent!.name}</span>
                          <button onClick={() => { setDirectTargetAgent(null); setSendToWholeTeam(false) }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                        </div>
                        {/* Sending to the entire team pings everyone at once - show exactly who
                            that is (with a scroll once the roster is long) instead of leaving it
                            as an abstract "the whole team" the sender has to take on faith. */}
                        {sendToWholeTeam && teamHosts.length > 0 && (
                          <div className="space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: '160px' }}>
                            {teamHosts.map(host => (
                              <div key={host.agent_id} className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 px-2.5 py-1.5">
                                {host.photo_url ? (
                                  <img src={host.photo_url} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                                    <User size={12} />
                                  </div>
                                )}
                                <span className="truncate text-xs font-bold text-gray-700 dark:text-gray-200">{host.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        {teamHosts.length > 0 && (
                          <div className="space-y-2">
                            {/* Its own full-width button, not a small text link - sending to the
                                whole team at once is a big deal (everyone gets pinged), so it
                                should read like the deliberate alternative action it is. */}
                            <button
                              type="button"
                              onClick={() => setSendToWholeTeam(true)}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#C9A24D] bg-[#C9A24D]/10 px-3 py-3 text-xs font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a] transition hover:bg-[#C9A24D]/20 active:scale-[0.99]"
                            >
                              <Users size={15} /> My Whole Team ({teamHosts.length})
                            </button>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Or one teammate</p>
                            <div className="relative flex items-center">
                              {teamHostsOverflow && (
                                <button
                                  type="button"
                                  onClick={() => scrollTeamHosts('left')}
                                  className="absolute left-0 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400"
                                  aria-label="Scroll left"
                                >
                                  <ChevronLeft size={14} />
                                </button>
                              )}
                              <div
                                ref={teamHostsScrollRef}
                                className={`flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-hide ${teamHostsOverflow ? 'px-7' : ''}`}
                              >
                                {teamHosts.map(host => (
                                  <button
                                    key={host.agent_id}
                                    onClick={() => setDirectTargetAgent({ id: host.agent_id, name: host.name })}
                                    className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2.5 py-1 text-[11px] font-bold text-[#8b7355] dark:text-[#e8cf8a] hover:border-[#C9A24D]"
                                  >
                                    <Star size={9} fill="currentColor" className="text-[#C9A24D]" />
                                    {host.name}{host.times_hosted > 0 ? ` (${host.times_hosted}x)` : ''}
                                  </button>
                                ))}
                              </div>
                              {teamHostsOverflow && (
                                <button
                                  type="button"
                                  onClick={() => scrollTeamHosts('right')}
                                  className="absolute right-0 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400"
                                  aria-label="Scroll right"
                                >
                                  <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {nonTeamTrustedHosts.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">Hosted for you before</p>
                            <div className="relative flex items-center">
                              {trustedHostsOverflow && (
                                <button
                                  type="button"
                                  onClick={() => scrollTrustedHosts('left')}
                                  className="absolute left-0 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400"
                                  aria-label="Scroll left"
                                >
                                  <ChevronLeft size={14} />
                                </button>
                              )}
                              <div
                                ref={trustedHostsScrollRef}
                                className={`flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-hide ${trustedHostsOverflow ? 'px-7' : ''}`}
                              >
                                {nonTeamTrustedHosts.map(host => (
                                  <button
                                    key={host.agent_id}
                                    onClick={() => setDirectTargetAgent({ id: host.agent_id, name: host.name })}
                                    className="shrink-0 whitespace-nowrap rounded-full border border-gray-200 dark:border-gray-700 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:border-[#C9A24D] hover:text-[#8b7355]"
                                  >
                                    {host.name} ({host.times_hosted}x)
                                  </button>
                                ))}
                              </div>
                              {trustedHostsOverflow && (
                                <button
                                  type="button"
                                  onClick={() => scrollTrustedHosts('right')}
                                  className="absolute right-0 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400"
                                  aria-label="Scroll right"
                                >
                                  <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={directSearchQuery}
                            onChange={e => setDirectSearchQuery(e.target.value)}
                            placeholder="Or search any agent: name, email, MLS ID..."
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] py-2 pl-8 pr-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                          />
                        </div>
                        {directSearchResults.length > 0 && (
                          <div className="space-y-1.5">
                            {directSearchResults.map(agent => (
                              <button
                                key={agent.id}
                                onClick={() => { setDirectTargetAgent({ id: agent.id, name: agent.name }); setDirectSearchQuery(''); setDirectSearchResults([]) }}
                                className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-2 text-left hover:border-[#C9A24D]/50"
                              >
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{agent.name}</span>
                                <span className="text-[10px] text-gray-400">{agent.brokerage || agent.email}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSendDirectRequest}
                  disabled={isSendingDirect || !askReady}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-3 py-3 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                >
                  {isSendingDirect ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {askLabel}
                </button>
                {openBroadcasts.length > 0 && <div className="mt-3">
                      <div>
                        <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">Awaiting a response</p>
                        {/* Capped to ~2 visible rows with a scroll for the rest - this list can
                            grow long and it was pushing the rest of Manage Hosts down the page. */}
                        <div className="space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: '132px' }}>
                          {openBroadcasts.map(broadcast => (
                            <div key={broadcast.id} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-black text-[#111827] dark:text-white">
                                  {broadcast.is_direct ? `Sent to ${broadcast.target_agent_name}` : 'Sent to your whole team'}
                                </p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{formatEventDate(broadcast.requested_date)}</p>
                              </div>
                              <button
                                onClick={() => handleCancelBroadcast(broadcast.id)}
                                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                aria-label="Cancel this request"
                                title="Cancel this request"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                </div>}
                </>
                )}
              </motion.section>

              {/* Agents Who Have Hosted Here - its own full-width section. */}
              <section className="space-y-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] p-4 sm:p-5 shadow-sm">
                <button onClick={() => setHistoryOpen(v => !v)} aria-expanded={historyOpen} className="flex w-full items-center gap-2 text-left">
                  <History size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Agents Who Have Hosted Here</h3>
                  {hostingHistory.length > 0 && (
                    <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black text-[#8b7355] dark:text-[#e8cf8a]">{hostingHistory.length}</span>
                  )}
                  <ChevronDown size={16} className={`ml-auto shrink-0 text-gray-400 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                </button>
                {!historyOpen ? null : hostingHistory.length === 0 ? (
                  <EmptyState compact icon={Users} title="No hosting history yet" description="Once an open house happens here, hosting agents and their visitor stats will show up here." />
                ) : (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pagedHostingHistory.map(row => {
                      const duration = formatDuration(row.start_time, row.end_time)
                      return (
                        <div key={`${row.id}-${row.event_date}`} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{row.hosting_agent_name}</p>
                              <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {row.hosting_agent_brokerage ? `${row.hosting_agent_brokerage} · ` : ''}{formatEventDate(row.event_date)}
                                {duration ? ` · ${duration}` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-xs font-bold text-gray-500 dark:text-gray-400">
                              <span>{row.total_guests} guests</span>
                              <span>{row.unrepresented_guests} unrep</span>
                            </div>
                          </div>
                          {row.share_guests_enabled ? (
                            <GuestDetailsToggle eventId={row.id} windowDate={row.event_date} />
                          ) : (
                            <p className="mt-1.5 text-[10px] font-medium text-gray-400">Guest details are private unless {row.hosting_agent_name} chooses to share them.</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {historyTotalPages > 1 && (
                    <div className="mt-3 flex flex-col items-center gap-1.5">
                      <Pager page={historyPage} totalPages={historyTotalPages} onChange={setHistoryPage} />
                      <p className="text-[10px] font-semibold text-gray-400">
                        {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, hostingHistory.length)} of {hostingHistory.length}
                      </p>
                    </div>
                  )}
                  </>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>

    {cancelTarget && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => !isCancelling && setCancelTarget(null)}>
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#151517] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
              <Trash2 size={18} />
            </div>
            <h3 className="text-base font-black text-[#111827] dark:text-white">Cancel this open house?</h3>
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
            {cancelTarget.hosting_agent_name} is confirmed to host on <span className="text-[#111827] dark:text-white">{formatEventDate(cancelTarget.scheduled_date)}</span>. Cancelling revokes their approval and notifies them right away - this can't be undone.
          </p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              onClick={() => setCancelTarget(null)}
              disabled={isCancelling}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              Keep It
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {isCancelling ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Cancel Open House
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
