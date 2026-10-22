'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Inbox, History, Users, Save, AlertTriangle, CalendarClock, Send, Trash2, ChevronRight, Info, PencilLine, User } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { Broadcast, ListingDetail, ScheduledOpen, TeamMember, TrustedHost } from '@/types'
import HostRequestCard from './HostRequestCard'
import GuestDetailsToggle from './GuestDetailsToggle'
import EmptyState from './EmptyState'
import WeekendCalendarCards, { WeekendCell, WeekendCalendarOpen, dayIsHostable, getUpcomingWeekendCells, hostingNote, type HostingWindow } from './WeekendCalendarCards'
import FindHostFlow from './FindHostFlow'
import InfoTooltip from './InfoTooltip'
import { formatEventDate, formatDuration, formatTime } from './formatters'
import OhSheet, { FourPager, Unfold } from './OhSheet'
import { DateTile } from './OpenHouseInsightsModal'
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
  // Find a Host is its own step-by-step window (FindHostFlow) - open on a day, or on none.
  const [findHost, setFindHost] = useState<{ date: string | null } | null>(null)
  const openFindHost = (date: string | null) => setFindHost({ date })
  const [openBroadcasts, setOpenBroadcasts] = useState<Broadcast[]>([])
  const [cancelTarget, setCancelTarget] = useState<ScheduledOpen | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)


  const directRequestSectionRef = useRef<HTMLDivElement>(null)
  const hostNotesSectionRef = useRef<HTMLDivElement>(null)
  const [directHighlight, setDirectHighlight] = useState(false)
  const [notesHighlight, setNotesHighlight] = useState(false)
  // Host Notes sit half-open (a nudge when empty, a preview when written) - the editor opens on tap.
  const [notesOpen, setNotesOpen] = useState(false)

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
  // One entry per host (user, 10/22: the same host used to be listed once per open), their opens
  // newest first; whoever hosted most comes first.
  const pastHosts = useMemo(() => {
    const by = new Map<string, { id: string; name: string; brokerage?: string | null; opens: typeof hostingHistory; guests: number; unrep: number }>()
    for (const row of hostingHistory) {
      const key = row.hosting_agent_id || row.hosting_agent_name
      const h = by.get(key) || { id: key, name: row.hosting_agent_name, brokerage: row.hosting_agent_brokerage, opens: [], guests: 0, unrep: 0 }
      h.opens.push(row)
      h.guests += row.total_guests
      h.unrep += row.unrepresented_guests
      by.set(key, h)
    }
    return Array.from(by.values())
      .map(h => ({ ...h, opens: [...h.opens].sort((a, b) => String(b.event_date).localeCompare(String(a.event_date))) }))
      .sort((a, b) => b.opens.length - a.opens.length || String(b.opens[0]?.event_date).localeCompare(String(a.opens[0]?.event_date)))
  }, [hostingHistory])

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
      openFindHost(prefillDirectDate)
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
      openFindHost(cell.date)
    }
  }

  const allOpens: ScheduledOpen[] = detail ? [...detail.scheduled_opens, ...detail.confirmed_pending_kit] : []
  // A kit that's been reused so much its own recorded date got cleared back to "evergreen" (see
  // cancel_approved_open) is still a real, built kit - just not scheduled for any specific date -
  // so it doesn't belong in a list titled "Scheduled Opens" (nor in its count badge).
  const datedOpens = allOpens.filter(o => o.scheduled_date)
  const takenDates = new Set(allOpens.map(o => o.scheduled_date).filter((d): d is string => !!d))
  // The coming open-house days with no host and no request in yet - one tap each in Find a Host.
  const pendingDates = (detail?.pending_requests || []).map(r => String(r.requested_date))
  const openDaysNeedingHost = getUpcomingWeekendCells(takenDates).map(c => c.date)
    .filter(d => !takenDates.has(d) && !pendingDates.includes(d) && dayIsHostable(hostingWindow, d) && !openBroadcasts.some(b => b.requested_date === d))

  return (
    <>
    <OhSheet open={!!listingKey} onClose={onClose} title="Open House Hosts" subtitle={detail?.address || 'Loading…'} image={detail?.image ?? null} width="max-w-5xl">
        <div>
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
                    <div className="mt-3 flex-1">
                      {/* Both a built kit AND a confirmed-but-kit-less date can exist for this
                          listing at the same time (e.g. two different approved requests) - both
                          render here, sorted together, so neither one hides the other. Every date
                          (not just the two weekends above), four at a time, so a farther-out or
                          weekday date and the cancel action stay reachable without a long list. */}
                      <FourPager resetKey={listingKey}
                        items={[...datedOpens].sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))}
                        render={open => {
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
                        }} />
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
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tap a day, then choose who to ask.</p>
                </div>
                {hostingWindow?.hosting_blocked ? (
                  <EmptyState compact icon={CalendarClock} title="Not taking hosts right now" description={hostingNote(hostingWindow) || 'This home can\'t be shown right now.'} />
                ) : (
                <>
                {/* The days that still need someone, one tap each - or the big button for any day. */}
                {openDaysNeedingHost.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Still needs a host</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {openDaysNeedingHost.map((d, i) => (
                        <motion.button key={d} type="button" onClick={() => openFindHost(d)} whileTap={{ scale: 0.95 }}
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                          className="group flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:border-amber-500/25 dark:bg-amber-500/[0.06]">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-center shadow-sm dark:bg-white/10">
                            <span className="leading-none">
                              <span className="block text-[8px] font-black uppercase text-gray-400">{new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                              <span className="block text-base font-black text-[#111827] dark:text-white">{new Date(`${d}T00:00:00`).getDate()}</span>
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-bold uppercase text-gray-400">{new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long' })}</span>
                            <span className="flex items-center gap-0.5 whitespace-nowrap text-[12px] font-black text-[#8b7355] dark:text-[#e8cf8a]">Find host <ChevronRight size={12} className="transition group-hover:translate-x-0.5" /></span>
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
                <motion.button type="button" onClick={() => openFindHost(null)} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
                  className="relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#3a2e18] p-4 text-left text-white shadow-[0_16px_34px_-22px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40">
                  <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(232,201,122,.35),transparent_65%)]" />
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Send size={18} /></span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block text-[15px] font-black">Find a host for any day</span>
                    <span className="block text-[12px] font-semibold text-white/60">Pick the day and time, then who to ask - your team, a past host, or any agent</span>
                  </span>
                  <span className="relative hidden shrink-0 items-center gap-1 rounded-full bg-[#e8c97a] px-4 py-2 text-[11px] font-black uppercase tracking-wide text-[#111827] sm:inline-flex">Start <ChevronRight size={13} /></span>
                </motion.button>
                {openBroadcasts.length > 0 && <div className="mt-3">
                      <div>
                        <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">Waiting for an answer</p>
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

              {/* Who has hosted here - one row per agent (user, 10/22: the same host used to show once
                  per open); open a host to see every open they did here and how each one went. */}
              <section className="space-y-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <History size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Who has hosted here</h3>
                  {pastHosts.length > 0 && (
                    <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black text-[#8b7355] dark:text-[#e8cf8a]">{pastHosts.length}</span>
                  )}
                </div>
                <FourPager resetKey={listingKey} items={pastHosts}
                  empty={<EmptyState compact icon={Users} title="No one has hosted here yet" description="After an open house happens here, each host and how it went shows up here." />}
                  render={host => (
                    <Unfold head={() => (
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-sm font-black text-[#111827]">
                          {host.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{host.name}</p>
                          <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {host.opens.length} open{host.opens.length === 1 ? '' : 's'} · {host.guests} guest{host.guests === 1 ? '' : 's'}{host.brokerage ? ` · ${host.brokerage}` : ''}
                          </p>
                        </div>
                        {host.unrep > 0 && <span className="hidden shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-600 dark:bg-rose-500/10 dark:text-rose-300 sm:inline">{host.unrep} no agent</span>}
                      </div>
                    )}>
                      <div className="space-y-2">
                        {host.opens.map(row => {
                          const duration = formatDuration(row.start_time, row.end_time)
                          return (
                            <div key={`${row.id}-${row.event_date}`} className="rounded-xl border border-gray-100 bg-white p-3 dark:border-white/[0.07] dark:bg-[#141416]">
                              <div className="flex items-center gap-3">
                                <DateTile date={row.event_date} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-black text-[#111827] dark:text-white">{formatEventDate(row.event_date)}</p>
                                  <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{[row.start_time && row.end_time ? `${formatTime(row.start_time)} - ${formatTime(row.end_time)}` : '', duration].filter(Boolean).join(' · ') || 'Time not recorded'}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-black text-[#111827] tabular-nums dark:text-white">{row.total_guests} <span className="text-[10px] font-bold uppercase text-gray-400">guests</span></p>
                                  <p className="text-[11px] font-bold text-rose-500 tabular-nums">{row.unrepresented_guests} no agent</p>
                                </div>
                              </div>
                              {row.share_guests_enabled ? (
                                <div className="mt-2"><GuestDetailsToggle eventId={row.id} windowDate={row.event_date} /></div>
                              ) : (
                                <p className="mt-2 text-[10px] font-medium text-gray-400">Guest names are private unless {row.hosting_agent_name} chooses to share them.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </Unfold>
                  )} />
              </section>
            </div>
          ) : null}
        </div>
    </OhSheet>

    {detail && listingKey && (
      <FindHostFlow
        open={!!findHost}
        listingKey={listingKey}
        street={detail.address?.split(',')[0] || 'This listing'}
        place={detail.address?.split(',').slice(1).join(',').trim()}
        photo={detail.image}
        initialDate={findHost?.date}
        hostingWindow={hostingWindow}
        taken={new Map(datedOpens.map(o => [o.scheduled_date as string, o.hosting_agent_name || 'yes']))}
        requested={pendingDates}
        teamHosts={teamHosts}
        pastHosts={nonTeamTrustedHosts}
        onClose={() => setFindHost(null)}
        onSent={() => { setFindHost(null); loadBroadcasts(listingKey) }}
      />
    )}

    {cancelTarget && (
      <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4" onClick={() => !isCancelling && setCancelTarget(null)}>
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
