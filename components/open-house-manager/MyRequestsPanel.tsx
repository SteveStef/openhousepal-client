'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Send, AlertTriangle, Inbox, Home, Check, CalendarClock, UserPlus, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { HostRequest, IncomingBroadcast, IncomingTeamInvite } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'
import { formatEventDate, formatTime, TIME_SLOT_OPTIONS, endTimeOptionsFor } from './formatters'
import TimeSelect from './TimeSelect'
import { refreshOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'

export function BroadcastCard({ broadcast, onAccept, onCounter, busy }: {
  broadcast: IncomingBroadcast
  onAccept: (id: string) => void
  onCounter: (id: string, date: string, start: string, end: string, note: string) => void
  busy: string | null
}) {
  const [isCountering, setIsCountering] = useState(false)
  const [date, setDate] = useState(broadcast.requested_date)
  // API times come back as "HH:MM:SS" - trim to "HH:MM" to match the time <select>s' option values.
  // An Anytime broadcast has no requested time to default to - 1-4pm is the same default used
  // everywhere else a fresh time window is offered (Request to Host, direct requests).
  const [start, setStart] = useState(broadcast.requested_start_time ? broadcast.requested_start_time.slice(0, 5) : '13:00')
  const [end, setEnd] = useState(broadcast.requested_end_time ? broadcast.requested_end_time.slice(0, 5) : '16:00')
  const [note, setNote] = useState('')

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
          <Home size={12} /> {broadcast.property_address || 'Listing'}
        </div>
        {broadcast.is_direct && (
          <span className="shrink-0 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">Direct Request</span>
        )}
      </div>
      <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{broadcast.owner_agent_name}</p>
      {broadcast.owner_agent_brokerage && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{broadcast.owner_agent_brokerage}</p>}
      <p className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">
        {formatEventDate(broadcast.requested_date)} · {broadcast.is_anytime ? 'Anytime' : `${formatTime(broadcast.requested_start_time)} - ${formatTime(broadcast.requested_end_time)}`}
      </p>
      {broadcast.message && (
        <p className="mt-3 rounded-xl bg-gray-50 dark:bg-[#0F0F11] p-3 text-xs font-medium italic text-gray-600 dark:text-gray-300">"{broadcast.message}"</p>
      )}
      {broadcast.is_anytime ? (
        // No time was set to accept "as-is" - pick one here instead of the normal one-click
        // accept. Submitting through onCounter (same handler as "propose a different time") still
        // counts as an instant claim on the backend as long as the date is unchanged, since the
        // owner already said any time works.
        <div className="mt-3 space-y-3 rounded-xl border border-[#C9A24D]/30 dark:border-[#C9A24D]/20 bg-[#C9A24D]/5 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">
            <Clock size={11} /> Anytime - choose the time you'll host
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Start</span>
              <TimeSelect
                value={start}
                onChange={value => { setStart(value); if (!endTimeOptionsFor(value).some(opt => opt.value === end)) setEnd('') }}
                options={TIME_SLOT_OPTIONS}
                placeholder="Start"
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">End</span>
              <TimeSelect
                value={end}
                onChange={setEnd}
                options={endTimeOptionsFor(start)}
                placeholder="End"
                disabled={!start}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white disabled:opacity-50"
              />
            </label>
          </div>
          <button
            onClick={() => onCounter(broadcast.id, date, start, end, note.trim())}
            disabled={busy === broadcast.id || !start || !end}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
          >
            {busy === broadcast.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Confirm & Host
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onAccept(broadcast.id)}
              disabled={busy === broadcast.id}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
            >
              {busy === broadcast.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} I Can Host This
            </button>
            <button
              onClick={() => setIsCountering(v => !v)}
              disabled={busy === broadcast.id}
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              aria-label="Propose a different time"
              title="Propose a different time"
            >
              <CalendarClock size={14} />
            </button>
          </div>
          {isCountering && (
            <div className="mt-3 space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Propose a different time</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Date</span>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white" />
                </label>
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Start</span>
                  <TimeSelect
                    value={start}
                    onChange={value => { setStart(value); if (!endTimeOptionsFor(value).some(opt => opt.value === end)) setEnd('') }}
                    options={TIME_SLOT_OPTIONS}
                    placeholder="Start"
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">End</span>
                  <TimeSelect
                    value={end}
                    onChange={setEnd}
                    options={endTimeOptionsFor(start)}
                    placeholder="End"
                    disabled={!start}
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white disabled:opacity-50"
                  />
                </label>
              </div>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Add a note (optional)..."
                className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-medium outline-none focus:border-[#C9A24D] dark:text-white"
              />
              <button
                onClick={() => onCounter(broadcast.id, date, start, end, note.trim())}
                disabled={busy === broadcast.id}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111827] dark:bg-white px-3 py-2 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
              >
                {busy === broadcast.id ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />} Send Proposed Time
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const PAGE_SIZE = 5

export default function MyRequestsPanel({ isOpen, onClose, onActionComplete }: { isOpen: boolean; onClose: () => void; onActionComplete?: () => void }) {
  const { showToast } = useToast()
  const [requests, setRequests] = useState<HostRequest[]>([])
  const [incoming, setIncoming] = useState<IncomingBroadcast[]>([])
  const [invites, setInvites] = useState<IncomingTeamInvite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null)
  // Pending = still part of an open negotiation either direction (invites, incoming asks, my own
  // sent requests awaiting a response or just countered). Approved/Denied are resolved history -
  // all three are real tabs so the actionable stuff never gets buried under a growing history.
  const [mainTab, setMainTab] = useState<'pending' | 'approved' | 'denied'>('pending')
  const [resolvedPage, setResolvedPage] = useState(1)
  // Requests declined (or cancelled - cancelling an approved open sends this same notification
  // type) since the last time this mailbox was opened - surfaced once under Pending so a decline
  // is never missed just because Denied isn't a tab agents check regularly, then this snapshot
  // ages out (see the markTypesAsRead call below) so it only ever appears here the one time.
  const [unseenDeclinedIds, setUnseenDeclinedIds] = useState<Set<string>>(new Set())

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const [requestsRes, incomingRes, invitesRes, unreadNotifsRes] = await Promise.all([
      api.openHouseManager.getMyRequests(),
      api.openHouseManager.getIncomingBroadcasts(),
      api.openHouseManager.getIncomingTeamInvites(),
      api.notifications.getAll(true),
    ])
    if (requestsRes.success && requestsRes.data) setRequests(requestsRes.data)
    else setLoadError(requestsRes.error || 'Unable to load your requests right now.')
    if (incomingRes.success && incomingRes.data) setIncoming(incomingRes.data)
    if (invitesRes.success && invitesRes.data) setInvites(invitesRes.data)
    if (unreadNotifsRes.success && unreadNotifsRes.data) {
      setUnseenDeclinedIds(new Set(
        unreadNotifsRes.data.filter(n => n.type === 'HOST_REQUEST_DECLINED' && n.referenceId).map(n => n.referenceId as string)
      ))
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (!isOpen) return
    setMainTab('pending')
    setResolvedPage(1)
    // Load first (it snapshots which declines/cancellations are still unseen), then mark them
    // read - marking read first would clear that snapshot before it's ever captured, so a decline
    // would never show up under Pending even the first time.
    load().then(() => {
      // Opening this mailbox is how the agent "checks out" everything waiting on them - clear every
      // unseen-based badge (Header nav, Dash, Discovery, My Team button) the moment it's seen here.
      api.notifications.markTypesAsRead(['HOST_REQUEST_APPROVED', 'HOST_REQUEST_DECLINED', 'HOST_REQUEST_COUNTERED', 'TEAM_BROADCAST_RECEIVED', 'DIRECT_HOST_REQUEST_RECEIVED', 'TEAM_INVITE_RECEIVED']).then(refreshOpenHouseActionCounts)
    })
  }, [isOpen])

  useEffect(() => { setResolvedPage(1) }, [mainTab])

  // Pending = still part of an open negotiation, one way or another - either I'm waiting on them
  // (pending) or they're waiting on me (countered, a new time was proposed). Everything else
  // (approved/declined) is resolved and lives in its own tab instead.
  const actionableRequests = requests.filter(r => r.status === 'pending' || r.status === 'countered')
  const approvedRequests = requests.filter(r => r.status === 'approved')
  const deniedRequests = requests.filter(r => r.status === 'declined')
  // Not seen yet (see unseenDeclinedIds above) - shown once under Pending in addition to always
  // living in the Denied tab, not instead of it.
  const newlyDeclinedRequests = deniedRequests.filter(r => unseenDeclinedIds.has(r.id))
  const resolvedRequests = mainTab === 'approved' ? approvedRequests : deniedRequests
  const resolvedTotalPages = Math.max(1, Math.ceil(resolvedRequests.length / PAGE_SIZE))
  const pagedResolvedRequests = resolvedRequests.slice((resolvedPage - 1) * PAGE_SIZE, resolvedPage * PAGE_SIZE)
  const pendingCount = invites.length + incoming.length + actionableRequests.length + newlyDeclinedRequests.length

  const isRespondingRef = useRef(false)

  const handleRespond = async (broadcastId: string) => {
    if (isRespondingRef.current) return
    isRespondingRef.current = true
    setRespondingId(broadcastId)
    const { success, data, error } = await api.openHouseManager.respondToBroadcast(broadcastId)
    isRespondingRef.current = false
    setRespondingId(null)
    if (success) {
      setIncoming(prev => prev.filter(b => b.id !== broadcastId))
      if (data) setRequests(prev => [data, ...prev])
      showToast(data?.status === 'approved' ? "You're confirmed to host!" : "Sent - the listing agent will follow up if it's a match.", 'success')
    } else {
      showToast(error || 'Unable to send your response right now.', 'error')
    }
  }

  const handleCounterBroadcast = async (broadcastId: string, date: string, start: string, end: string, note: string) => {
    if (isRespondingRef.current) return
    isRespondingRef.current = true
    setRespondingId(broadcastId)
    const { success, data, error } = await api.openHouseManager.respondToBroadcast(broadcastId, {
      proposed_date: date, proposed_start_time: start, proposed_end_time: end, note: note || undefined,
    })
    isRespondingRef.current = false
    setRespondingId(null)
    if (success) {
      setIncoming(prev => prev.filter(b => b.id !== broadcastId))
      if (data) setRequests(prev => [data, ...prev])
      showToast('Proposed time sent to the listing agent.', 'success')
    } else {
      showToast(error || 'Unable to send your response right now.', 'error')
    }
  }

  const handleAcceptCounter = async (id: string) => {
    const { success, error } = await api.openHouseManager.acceptCounter(id)
    if (success) {
      showToast('New time confirmed.', 'success')
      load()
      onActionComplete?.()
    } else {
      showToast(error || 'Failed to confirm this time.', 'error')
    }
  }

  const handleDeclineCounter = async (id: string) => {
    const { success, error } = await api.openHouseManager.declineCounter(id)
    if (success) {
      showToast('Proposed time declined.', 'success')
      load()
      onActionComplete?.()
    } else {
      showToast(error || 'Failed to decline this time.', 'error')
    }
  }

  const handleCounterBack = async (id: string, proposedDate: string, proposedStart: string, proposedEnd: string, note: string) => {
    const { success, error } = await api.openHouseManager.counterBack(id, {
      proposed_date: proposedDate, proposed_start_time: proposedStart, proposed_end_time: proposedEnd, note: note || undefined,
    })
    if (success) {
      showToast('Proposed time sent.', 'success')
      load()
      onActionComplete?.()
    } else {
      showToast(error || 'Failed to send this time.', 'error')
    }
  }

  const handleRespondToInvite = async (id: string, accept: boolean) => {
    setRespondingInviteId(id)
    const response = accept ? await api.openHouseManager.acceptTeamInvite(id) : await api.openHouseManager.declineTeamInvite(id)
    setRespondingInviteId(null)
    if (response.success) {
      setInvites(prev => prev.filter(i => i.id !== id))
      showToast(accept ? "You're on the team." : 'Invite declined.', 'success')
    } else {
      showToast(response.error || 'Unable to respond to this invite right now.', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white dark:bg-[#0B0B0B] shadow-2xl animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 p-5">
          <div>
            <h2 className="text-lg font-black text-[#111827] dark:text-white">My Requests</h2>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Open houses you've asked to host</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load your requests" description={loadError} />
          ) : requests.length === 0 && incoming.length === 0 && invites.length === 0 ? (
            <EmptyState icon={Send} title="No requests yet" description="Requests you send to host other agents' listings - and asks from agents who've added you to their team - will show up here." />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
                <button
                  onClick={() => setMainTab('pending')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition ${
                    mainTab === 'pending' ? 'bg-white dark:bg-[#151517] text-[#8b7355] dark:text-[#e8cf8a] shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <Send size={13} /> Pending ({pendingCount})
                </button>
                <button
                  onClick={() => setMainTab('approved')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition ${
                    mainTab === 'approved' ? 'bg-white dark:bg-[#151517] text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <CheckCircle2 size={13} /> Approved ({approvedRequests.length})
                </button>
                <button
                  onClick={() => setMainTab('denied')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black uppercase tracking-widest transition ${
                    mainTab === 'denied' ? 'bg-white dark:bg-[#151517] text-red-600 dark:text-red-400 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <XCircle size={13} /> Denied ({deniedRequests.length})
                </button>
              </div>

              {mainTab === 'pending' ? (
                pendingCount === 0 ? (
                  <EmptyState icon={Send} title="Nothing pending" description="Opens you've requested to host, and asks/invitations coming in, will show up here while they're still awaiting a response." />
                ) : (
                  <div className="space-y-5">
                    {newlyDeclinedRequests.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <XCircle size={13} className="text-red-500" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400">Declined / Cancelled</h4>
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{newlyDeclinedRequests.length}</span>
                        </div>
                        <div className="space-y-3">
                          {newlyDeclinedRequests.map(request => (
                            <HostRequestCard key={request.id} request={request} showAddress showHistory />
                          ))}
                        </div>
                      </section>
                    )}

                    {invites.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <UserPlus size={13} className="text-[#C9A24D]" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Team Invites</h4>
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{invites.length}</span>
                        </div>
                        <div className="space-y-3">
                          {invites.map(invite => (
                            <div key={invite.id} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                              <p className="text-sm font-black text-[#111827] dark:text-white">{invite.owner_agent_name}</p>
                              {invite.owner_agent_brokerage && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{invite.owner_agent_brokerage}</p>}
                              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Wants you on their Open House Team.</p>
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  onClick={() => handleRespondToInvite(invite.id, true)}
                                  disabled={respondingInviteId === invite.id}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                                >
                                  {respondingInviteId === invite.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Accept
                                </button>
                                <button
                                  onClick={() => handleRespondToInvite(invite.id, false)}
                                  disabled={respondingInviteId === invite.id}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs font-black text-[#111827] dark:text-white transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                                >
                                  <X size={13} strokeWidth={3} /> Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {incoming.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <Inbox size={13} className="text-[#C9A24D]" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Team Requests</h4>
                          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{incoming.length}</span>
                        </div>
                        <div className="space-y-3">
                          {incoming.map(broadcast => (
                            <BroadcastCard key={broadcast.id} broadcast={broadcast} onAccept={handleRespond} onCounter={handleCounterBroadcast} busy={respondingId} />
                          ))}
                        </div>
                      </section>
                    )}

                    {actionableRequests.length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <CalendarClock size={13} className="text-[#C9A24D]" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Sent Requests</h4>
                          <span className="rounded-full bg-[#C9A24D]/20 px-2 py-0.5 text-[10px] font-black text-[#8b7355] dark:text-[#e8cf8a]">{actionableRequests.length}</span>
                        </div>
                        <div className="space-y-3">
                          {actionableRequests.map(request => (
                            <HostRequestCard key={request.id} request={request} showAddress showHistory onAcceptCounter={handleAcceptCounter} onDeclineCounter={handleDeclineCounter} onCounterBack={handleCounterBack}
                        buildKitHref={request.status === 'approved' && String(request.requested_date) >= new Date().toISOString().slice(0, 10) ? `/open-houses?build=${request.id}` : undefined} />
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )
              ) : resolvedRequests.length === 0 ? (
                <EmptyState
                  icon={mainTab === 'approved' ? CheckCircle2 : XCircle}
                  title={mainTab === 'approved' ? 'No approved requests yet' : 'No denied requests'}
                  description={mainTab === 'approved' ? "Requests you've sent will show up here once a listing agent confirms." : "Requests a listing agent turned down will show up here."}
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {pagedResolvedRequests.map(request => (
                      <HostRequestCard key={request.id} request={request} showAddress showHistory onAcceptCounter={handleAcceptCounter} onDeclineCounter={handleDeclineCounter} onCounterBack={handleCounterBack}
                        buildKitHref={request.status === 'approved' && String(request.requested_date) >= new Date().toISOString().slice(0, 10) ? `/open-houses?build=${request.id}` : undefined} />
                    ))}
                  </div>
                  {resolvedTotalPages > 1 && (
                    <div className="mt-3 flex items-center justify-center gap-1">
                      <button
                        onClick={() => setResolvedPage(p => Math.max(1, p - 1))}
                        disabled={resolvedPage === 1}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      {Array.from({ length: resolvedTotalPages }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          onClick={() => setResolvedPage(n)}
                          className={`h-7 min-w-[1.75rem] rounded-lg px-1.5 text-xs font-black transition ${
                            n === resolvedPage ? 'bg-[#C9A24D] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setResolvedPage(p => Math.min(resolvedTotalPages, p + 1))}
                        disabled={resolvedPage === resolvedTotalPages}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        aria-label="Next page"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
