'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Users, UserPlus, Trash2, Send, Inbox, AlertTriangle, Home, Search } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { AgentSearchResult, Broadcast, IncomingBroadcast, MyListingItem, TeamMember } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'
import { formatEventDate, formatTime } from './formatters'

type Tab = 'team' | 'incoming'

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
  const [tab, setTab] = useState<Tab>('team')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [members, setMembers] = useState<TeamMember[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [incoming, setIncoming] = useState<IncomingBroadcast[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AgentSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  const [broadcastListingKey, setBroadcastListingKey] = useState('')
  const [broadcastDate, setBroadcastDate] = useState('')
  const [broadcastStart, setBroadcastStart] = useState('')
  const [broadcastEnd, setBroadcastEnd] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const [membersRes, broadcastsRes, incomingRes] = await Promise.all([
      api.openHouseManager.getTeamMembers(),
      api.openHouseManager.getMyBroadcasts(),
      api.openHouseManager.getIncomingBroadcasts(),
    ])
    if (membersRes.success && membersRes.data) setMembers(membersRes.data)
    if (broadcastsRes.success && broadcastsRes.data) setBroadcasts(broadcastsRes.data)
    if (incomingRes.success && incomingRes.data) setIncoming(incomingRes.data)
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
      showToast(`${data.name} added to your team.`, 'success')
    } else {
      showToast(error || 'Unable to add this agent right now.', 'error')
    }
    setAddingId(null)
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

  const handleSendBroadcast = async () => {
    if (!broadcastListingKey || !broadcastDate || !broadcastStart || !broadcastEnd) {
      showToast('Pick a listing, date, and time window first.', 'error')
      return
    }
    setIsSendingBroadcast(true)
    const { success, data, error } = await api.openHouseManager.createBroadcast({
      listing_key: broadcastListingKey,
      requested_date: broadcastDate,
      requested_start_time: broadcastStart,
      requested_end_time: broadcastEnd,
      message: broadcastMessage.trim() || undefined,
    })
    setIsSendingBroadcast(false)
    if (success && data) {
      setBroadcasts(prev => [data, ...prev])
      setBroadcastListingKey('')
      setBroadcastDate('')
      setBroadcastStart('')
      setBroadcastEnd('')
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

  const handleRespond = async (broadcastId: string) => {
    setRespondingId(broadcastId)
    const { success, error } = await api.openHouseManager.respondToBroadcast(broadcastId)
    setRespondingId(null)
    if (success) {
      setIncoming(prev => prev.filter(b => b.id !== broadcastId))
      showToast("Sent - the listing agent will follow up if it's a match.", 'success')
    } else {
      showToast(error || 'Unable to send your response right now.', 'error')
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

        <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800 px-5 pt-3">
          <button
            onClick={() => setTab('team')}
            className={`rounded-t-lg px-3 py-2 text-xs font-black uppercase tracking-widest transition ${tab === 'team' ? 'text-[#C9A24D] border-b-2 border-[#C9A24D]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            My Team
          </button>
          <button
            onClick={() => setTab('incoming')}
            className={`relative rounded-t-lg px-3 py-2 text-xs font-black uppercase tracking-widest transition ${tab === 'incoming' ? 'text-[#C9A24D] border-b-2 border-[#C9A24D]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
          >
            Team Requests
            {incoming.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#C9A24D]/15 px-1.5 py-0.5 text-[9px] text-[#C9A24D]">{incoming.length}</span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load your team" description={loadError} />
          ) : tab === 'team' ? (
            <div className="space-y-8">
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
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{agent.name}</p>
                          <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{agent.brokerage || agent.email}</p>
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
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{member.name}</p>
                          {member.brokerage && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{member.brokerage}</p>}
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
                    onChange={e => setBroadcastListingKey(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
                  >
                    <option value="">Select a listing...</option>
                    {listings.map(listing => (
                      <option key={listing.listing_key} value={listing.listing_key}>{listing.address}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <input type="date" value={broadcastDate} onChange={e => setBroadcastDate(e.target.value)} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white" />
                    <input type="time" value={broadcastStart} onChange={e => setBroadcastStart(e.target.value)} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white" />
                    <input type="time" value={broadcastEnd} onChange={e => setBroadcastEnd(e.target.value)} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-2 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white" />
                  </div>
                  <textarea
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder="Optional note for your team..."
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-3 py-2 text-xs font-medium outline-none focus:border-[#C9A24D] dark:text-white"
                  />
                  <button
                    onClick={handleSendBroadcast}
                    disabled={isSendingBroadcast || members.length === 0}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111827] dark:bg-white px-3 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                  >
                    {isSendingBroadcast ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to Team
                  </button>
                </div>
              </section>

              {broadcasts.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <Inbox size={15} className="text-[#C9A24D]" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Sent Requests</h3>
                  </div>
                  <div className="space-y-3">
                    {broadcasts.map(broadcast => (
                      <div key={broadcast.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#111827] dark:text-white">{broadcast.property_address || 'Listing'}</p>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{formatEventDate(broadcast.requested_date)} · {formatTime(broadcast.requested_start_time)} - {formatTime(broadcast.requested_end_time)}</p>
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
                              <HostRequestCard key={request.id} request={request} onApprove={handleApprove} onDecline={handleDecline} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : incoming.length === 0 ? (
            <EmptyState icon={Inbox} title="No open requests" description="When an agent who's added you to their team needs a host, it'll show up here." />
          ) : (
            <div className="space-y-3">
              {incoming.map(broadcast => (
                <div key={broadcast.id} className="rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
                    <Home size={12} /> {broadcast.property_address || 'Listing'}
                  </div>
                  <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{broadcast.owner_agent_name}</p>
                  {broadcast.owner_agent_brokerage && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{broadcast.owner_agent_brokerage}</p>}
                  <p className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">{formatEventDate(broadcast.requested_date)} · {formatTime(broadcast.requested_start_time)} - {formatTime(broadcast.requested_end_time)}</p>
                  {broadcast.message && (
                    <p className="mt-3 rounded-xl bg-gray-50 dark:bg-[#0F0F11] p-3 text-xs font-medium italic text-gray-600 dark:text-gray-300">"{broadcast.message}"</p>
                  )}
                  <button
                    onClick={() => handleRespond(broadcast.id)}
                    disabled={respondingId === broadcast.id}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                  >
                    {respondingId === broadcast.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} I Can Host This
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
