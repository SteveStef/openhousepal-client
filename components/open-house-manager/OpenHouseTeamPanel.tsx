'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Users, UserPlus, Trash2, Send, Inbox, AlertTriangle, Search, ShieldCheck, User as UserIcon } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { AgentSearchResult, Broadcast, MyListingItem, TeamMember } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'
import TakenDatesPicker from './TakenDatesPicker'
import { formatEventDate, formatTime, TIME_SLOT_OPTIONS, endTimeOptionsFor } from './formatters'

export default function OpenHouseTeamPanel({
  isOpen,
  onClose,
  listings,
  onActionComplete,
}: {
  isOpen: boolean
  onClose: () => void
  listings: MyListingItem[]
  onActionComplete: () => void
}) {
  const { showToast } = useToast()
  const { user, refreshUser } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSavingRestriction, setIsSavingRestriction] = useState(false)

  const [members, setMembers] = useState<TeamMember[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AgentSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  // "Opened Requests" only ever shows what's still awaiting someone - a filled/cancelled
  // broadcast is resolved history, not something worth watching here.
  const openBroadcasts = broadcasts.filter(b => b.status === 'open')

  const [broadcastListingKey, setBroadcastListingKey] = useState('')
  const [broadcastDate, setBroadcastDate] = useState('')
  const [broadcastStart, setBroadcastStart] = useState('')
  const [broadcastEnd, setBroadcastEnd] = useState('')
  const [broadcastAnytime, setBroadcastAnytime] = useState(false)

  // Dates already scheduled for whichever listing is selected, so the date picker below can cross
  // them out the same way Request to Host does - broadcasting for an already-booked date is never
  // useful. Empty until a listing is picked.
  const selectedBroadcastListing = listings.find(l => l.listing_key === broadcastListingKey)
  const broadcastTakenDates = new Set(
    selectedBroadcastListing
      ? [...selectedBroadcastListing.scheduled_opens, ...selectedBroadcastListing.confirmed_pending_kit]
          .map(o => o.scheduled_date)
          .filter((d): d is string => !!d)
      : []
  )

  const handleBroadcastStartChange = (value: string) => {
    setBroadcastStart(value)
    const validEndTimes = endTimeOptionsFor(value)
    if (!validEndTimes.some(opt => opt.value === broadcastEnd)) {
      setBroadcastEnd(validEndTimes[0]?.value || '')
    }
  }
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false)

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const [membersRes, broadcastsRes] = await Promise.all([
      api.openHouseManager.getTeamMembers(),
      api.openHouseManager.getMyBroadcasts(),
    ])
    if (membersRes.success && membersRes.data) setMembers(membersRes.data)
    if (broadcastsRes.success && broadcastsRes.data) setBroadcasts(broadcastsRes.data)
    if (!membersRes.success) setLoadError(membersRes.error || 'Unable to load your team right now.')
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen])

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    const timeout = setTimeout(async () => {
      const { success, data } = await api.openHouseManager.searchAgents(searchQuery.trim())
      if (success && data) setSearchResults(data)
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const handleAddMember = async (agent: AgentSearchResult) => {
    setAddingId(agent.id)
    const { success, data, error } = await api.openHouseManager.addTeamMember(agent.email)
    if (success && data) {
      setMembers(prev => [data, ...prev])
      setSearchQuery('')
      setSearchResults([])
      showToast(`Invite sent to ${data.name}.`, 'success')
    } else {
      showToast(error || 'Unable to add this agent right now.', 'error')
    }
    setAddingId(null)
  }

  const handleToggleRestriction = async (restrictToTeam: boolean) => {
    setIsSavingRestriction(true)
    const { success, error } = await api.openHouseManager.updateRestriction(restrictToTeam)
    if (success) {
      await refreshUser()
      showToast(restrictToTeam ? 'Only your team can request to host your listings now.' : 'Agents at your brokerage can request to host again.', 'success')
    } else {
      showToast(error || 'Unable to save this setting right now.', 'error')
    }
    setIsSavingRestriction(false)
  }

  const handleRemoveMember = async (member: TeamMember) => {
    const { success, error } = await api.openHouseManager.removeTeamMember(member.id)
    if (success) {
      setMembers(prev => prev.filter(m => m.id !== member.id))
      showToast(`${member.name} removed from your team.`, 'success')
    } else {
      showToast(error || 'Unable to remove this agent right now.', 'error')
    }
  }

  const isSendingBroadcastRef = useRef(false)

  const handleSendBroadcast = async () => {
    if (isSendingBroadcastRef.current) return
    if (!broadcastListingKey || !broadcastDate || (!broadcastAnytime && (!broadcastStart || !broadcastEnd))) {
      showToast('Pick a listing and date first (and a time window, unless this is Anytime).', 'error')
      return
    }
    isSendingBroadcastRef.current = true
    setIsSendingBroadcast(true)
    const { success, data, error } = await api.openHouseManager.createBroadcast({
      listing_key: broadcastListingKey,
      requested_date: broadcastDate,
      requested_start_time: broadcastAnytime ? undefined : broadcastStart,
      requested_end_time: broadcastAnytime ? undefined : broadcastEnd,
      is_anytime: broadcastAnytime,
      message: broadcastMessage.trim() || undefined,
    })
    isSendingBroadcastRef.current = false
    setIsSendingBroadcast(false)
    if (success && data) {
      setBroadcasts(prev => [data, ...prev])
      setBroadcastListingKey('')
      setBroadcastDate('')
      setBroadcastStart('')
      setBroadcastEnd('')
      setBroadcastAnytime(false)
      setBroadcastMessage('')
      showToast('Sent to your team.', 'success')
    } else {
      showToast(error || 'Unable to send this to your team right now.', 'error')
    }
  }

  const handleApprove = async (id: string) => {
    const { success, error } = await api.openHouseManager.approveRequest(id)
    if (success) {
      showToast('Request approved - open house scheduled.', 'success')
      load()
      onActionComplete()
    } else {
      showToast(error || 'Failed to approve this request.', 'error')
    }
  }

  const handleDecline = async (id: string) => {
    const { success, error } = await api.openHouseManager.declineRequest(id)
    if (success) {
      showToast('Request declined.', 'success')
      load()
      onActionComplete()
    } else {
      showToast(error || 'Failed to decline this request.', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col bg-white dark:bg-[#0B0B0B] shadow-2xl animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 p-5">
          <div>
            <h2 className="text-lg font-black text-[#111827] dark:text-white">Open House Team</h2>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Ask agents on your team if they can host - no guest or contact info shared until you approve someone.</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load your team" description={loadError} />
          ) : (
            <div className="space-y-8">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Who Can Ask to Host</h3>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <input
                    type="checkbox"
                    checked={Boolean(user?.restrict_host_requests_to_team)}
                    disabled={isSavingRestriction}
                    onChange={e => handleToggleRestriction(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#C9A24D]"
                  />
                  <span>
                    <span className="block text-sm font-black text-[#111827] dark:text-white">Only my selected team can request to host my listings</span>
                    <span className="mt-0.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      {user?.restrict_host_requests_to_team
                        ? 'Turned on - only the agents on your team below can send you a host request. Everyone else will see "Not Accepting Host Requests" on your listings.'
                        : 'Turned off (default) - agents at your own brokerage can also ask to host your listings, in addition to your team below.'}
                    </span>
                  </span>
                </label>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <UserPlus size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Add an Agent</h3>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or MLS ID..."
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                  />
                </div>
                {isSearching && <div className="mt-2 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /></div>}
                {searchResults.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {searchResults.map(agent => (
                      <div key={agent.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {agent.photo_url ? (
                            <img src={agent.photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                              <UserIcon size={14} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#111827] dark:text-white">{agent.name}</p>
                            <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{agent.brokerage || agent.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddMember(agent)}
                          disabled={addingId === agent.id}
                          className="shrink-0 rounded-lg bg-[#111827] dark:bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                        >
                          {addingId === agent.id ? <Loader2 size={12} className="animate-spin" /> : 'Add'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Users size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Team Members</h3>
                  {members.length > 0 && <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-black text-gray-500 dark:text-gray-400">{members.length}</span>}
                </div>
                {members.length === 0 ? (
                  <EmptyState icon={Users} title="No team members yet" description="Add agents above so you can ask them to cover your open houses." />
                ) : (
                  <div className="space-y-2">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {member.photo_url ? (
                            <img src={member.photo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                              <UserIcon size={14} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{member.name}</p>
                              {member.status === 'pending' && (
                                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">Pending</span>
                              )}
                            </div>
                            {member.brokerage && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{member.brokerage}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          aria-label={`Remove ${member.name}`}
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Send size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Ask Your Team to Host</h3>
                </div>
                <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <select
                    value={broadcastListingKey}
                    onChange={e => { setBroadcastListingKey(e.target.value); setBroadcastDate('') }}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                  >
                    <option value="">Select a listing...</option>
                    {listings.map(listing => (
                      <option key={listing.listing_key} value={listing.listing_key}>{listing.address}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex-1">
                      <TakenDatesPicker
                        value={broadcastDate}
                        onChange={setBroadcastDate}
                        takenDates={broadcastTakenDates}
                        buttonClassName="flex w-full items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-left text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                      />
                    </div>
                    {!broadcastAnytime && (
                      <>
                        <select
                          value={broadcastStart}
                          onChange={e => handleBroadcastStartChange(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                        >
                          <option value="">Start time</option>
                          {TIME_SLOT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <select
                          value={broadcastEnd}
                          onChange={e => setBroadcastEnd(e.target.value)}
                          disabled={!broadcastStart}
                          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] disabled:opacity-50 dark:text-white"
                        >
                          <option value="">End time</option>
                          {endTimeOptionsFor(broadcastStart).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 px-0.5">
                    <input
                      type="checkbox"
                      checked={broadcastAnytime}
                      onChange={e => setBroadcastAnytime(e.target.checked)}
                      className="h-3.5 w-3.5 shrink-0 accent-[#C9A24D]"
                    />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Anytime - I don't care what time</span>
                  </label>
                  <textarea
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder="Optional note for your team..."
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-3 py-2 text-xs font-medium outline-none focus:border-[#C9A24D] dark:text-white"
                  />
                  <button
                    onClick={handleSendBroadcast}
                    disabled={isSendingBroadcast || members.filter(m => m.status === 'accepted').length === 0}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111827] dark:bg-white px-3 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                  >
                    {isSendingBroadcast ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to Team
                  </button>
                </div>
              </section>

              {openBroadcasts.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Inbox size={15} className="text-[#C9A24D]" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Opened Requests</h3>
                    {openBroadcasts.length > 5 && (
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">(last 5 of {openBroadcasts.length})</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {/* Newest-first from the API - capped at 5 so a long list doesn't push the
                        rest of the panel off-screen. Only still-open asks - filled/cancelled ones
                        are resolved, not something to keep watching here. */}
                    {openBroadcasts.slice(0, 5).map(broadcast => (
                      <div key={broadcast.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{broadcast.property_address || 'Listing'}</p>
                              {broadcast.is_direct && (
                                <span className="shrink-0 rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">Direct: {broadcast.target_agent_name}</span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                              {formatEventDate(broadcast.requested_date)} · {broadcast.is_anytime ? 'Anytime' : `${formatTime(broadcast.requested_start_time)} - ${formatTime(broadcast.requested_end_time)}`}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                            broadcast.status === 'filled' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : broadcast.status === 'cancelled' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                              : 'bg-[#C9A24D]/10 text-[#C9A24D]'
                          }`}>
                            {broadcast.status}
                          </span>
                        </div>
                        {broadcast.interested_requests.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                            {broadcast.interested_requests.map(request => (
                              <HostRequestCard key={request.id} request={request} showHistory onApprove={handleApprove} onDecline={handleDecline} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
