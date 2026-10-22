'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Clock, Loader2, Search, Send, ShieldCheck, Trash2, User as UserIcon, UserPlus, Users } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { AgentSearchResult, Broadcast, MyListingItem, TeamMember } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'
import OhSheet, { FourPager } from './OhSheet'
import TeamAskFlow from './TeamAskFlow'
import { DateTile } from './OpenHouseInsightsModal'
import { formatEventDate, formatTime } from './formatters'

// My Team as a short flow instead of one long list of everything (user, 10/22): a home screen with
// your team and three plain choices - ask them to host (its own step-by-step window), add someone,
// and who may ask to host your listings - plus the asks still waiting for an answer.

type View = 'home' | 'add' | 'who'

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
  const [view, setView] = useState<View>('home')
  const [dir, setDir] = useState(1)
  const [asking, setAsking] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AgentSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  // Only asks still waiting on someone - a filled/cancelled one is resolved history.
  const openBroadcasts = broadcasts.filter(b => b.status === 'open')
  const accepted = members.filter(m => m.status === 'accepted')
  const restricted = Boolean(user?.restrict_host_requests_to_team)

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
    if (isOpen) { setView('home'); load() }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return }
    setIsSearching(true)
    const timeout = setTimeout(async () => {
      const { success, data } = await api.openHouseManager.searchAgents(searchQuery.trim())
      if (success && data) setSearchResults(data)
      setIsSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const go = (v: View) => { setDir(v === 'home' ? -1 : 1); setView(v) }

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
    if (restrictToTeam === restricted) return
    setIsSavingRestriction(true)
    const { success, error } = await api.openHouseManager.updateRestriction(restrictToTeam)
    if (success) {
      await refreshUser()
      showToast(restrictToTeam ? 'Only your team can ask to host your listings now.' : 'Agents at your brokerage can ask to host again.', 'success')
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

  const avatar = (m: { photo_url?: string | null; name: string }, size = 'h-11 w-11') => m.photo_url
    ? <img src={m.photo_url} alt="" className={`${size} shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-[#141416]`} />
    : <span className={`${size} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-xs font-black text-[#111827] ring-2 ring-white dark:ring-[#141416]`}>{m.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}</span>

  const slide = {
    initial: (d: number) => ({ opacity: 0, x: d * 40 }),
    animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
    exit: (d: number) => ({ opacity: 0, x: d * -30, transition: { duration: 0.15 } }),
  } as const

  const choice = (icon: React.ReactNode, title: string, blurb: string, onClick: () => void, dark = false, disabled = false) => (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onClick} disabled={disabled}
      className={`group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition disabled:opacity-50 ${dark
        ? 'relative overflow-hidden bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#3a2e18] text-white shadow-[0_16px_34px_-22px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40 hover:-translate-y-0.5'
        : 'border border-gray-200 bg-white hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#141416]'}`}>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${dark ? 'bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/12 text-[#8b7355] dark:text-[#e8c97a]'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-black ${dark ? '' : 'text-[#111827] dark:text-white'}`}>{title}</span>
        <span className={`block text-[12px] font-semibold ${dark ? 'text-white/65' : 'text-gray-500 dark:text-gray-400'}`}>{blurb}</span>
      </span>
      <ChevronRight className={`h-5 w-5 shrink-0 transition group-hover:translate-x-0.5 ${dark ? 'text-[#e8c97a]' : 'text-gray-300'}`} />
    </motion.button>
  )

  return (
    <>
    <OhSheet open={isOpen} onClose={onClose} variant="side" title={view === 'add' ? 'Add to your team' : view === 'who' ? 'Who can ask to host' : 'My Team'}
      icon={view === 'home' ? <Users className="h-5 w-5" /> : undefined}
      subtitle={view === 'home' ? 'Agents you trust to host your open houses' : undefined}>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
      ) : loadError ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load your team" description={loadError} />
      ) : (
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            {view === 'home' && (
              <motion.div key="home" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className="space-y-5">
                {/* your team at a glance */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/[0.07] dark:bg-[#141416]">
                  {members.length === 0 ? (
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-dashed border-[#C9A24D]/50 text-[#C9A24D]"><UserPlus className="h-5 w-5" /></span>
                      <div>
                        <p className="text-sm font-black text-[#111827] dark:text-white">No one on your team yet</p>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Add the agents you trust - then ask them all at once.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-3">{members.slice(0, 5).map(m => <span key={m.id}>{avatar(m)}</span>)}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#111827] dark:text-white">{accepted.length} on your team</p>
                          {members.length > accepted.length && <p className="text-xs font-semibold text-amber-600">{members.length - accepted.length} invite{members.length - accepted.length === 1 ? '' : 's'} waiting to be accepted</p>}
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        {members.map(m => (
                          <div key={m.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                            {avatar(m, 'h-9 w-9')}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{m.name}</p>
                              <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{m.status === 'pending' ? 'Invite sent - waiting' : m.brokerage || 'Teammate'}</p>
                            </div>
                            <button type="button" onClick={() => handleRemoveMember(m)} aria-label={`Remove ${m.name}`} title="Remove"
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-300 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2.5">
                  {choice(<Send className="h-5 w-5" />, 'Ask my team to host', accepted.length ? `Pick a home, a day and a time - all ${accepted.length} get it` : 'Add someone to your team first', () => setAsking(true), true, accepted.length === 0 || listings.length === 0)}
                  {choice(<UserPlus className="h-5 w-5" />, 'Add someone to my team', 'Search any agent by name, email or MLS ID', () => go('add'))}
                  {choice(<ShieldCheck className="h-5 w-5" />, 'Who can ask to host my listings', restricted ? 'Only my team' : 'My team and agents at my brokerage', () => go('who'))}
                </div>

                {openBroadcasts.length > 0 && (
                  <section>
                    <div className="mb-2.5 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#C9A24D]" />
                      <h3 className="text-[13px] font-black uppercase tracking-[0.16em] text-[#111827] dark:text-white">Waiting for an answer</h3>
                      <span className="rounded-full bg-[#C9A24D]/12 px-2 py-0.5 text-[10px] font-black text-[#8b7355] dark:text-[#e8c97a]">{openBroadcasts.length}</span>
                    </div>
                    <FourPager items={openBroadcasts} resetKey={isOpen} render={b => (
                      <div className="rounded-2xl border border-gray-100 bg-white p-3 dark:border-white/[0.07] dark:bg-[#141416]">
                        <div className="flex items-center gap-3">
                          <DateTile date={b.requested_date} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-[#111827] dark:text-white">{b.property_address || 'Listing'}</p>
                            <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                              {formatEventDate(b.requested_date)} · {b.is_anytime ? 'Any time' : `${formatTime(b.requested_start_time)} - ${formatTime(b.requested_end_time)}`}
                            </p>
                            <p className="truncate text-[11px] font-bold text-[#8b7355] dark:text-[#e8c97a]">{b.is_direct ? `Asked ${b.target_agent_name}` : 'Asked your whole team'}</p>
                          </div>
                        </div>
                        {b.interested_requests.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-white/[0.07]">
                            {b.interested_requests.map(r => <HostRequestCard key={r.id} request={r} showHistory onApprove={handleApprove} onDecline={handleDecline} />)}
                          </div>
                        )}
                      </div>
                    )} />
                  </section>
                )}
              </motion.div>
            )}

            {view === 'add' && (
              <motion.div key="add" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className="space-y-4">
                <BackRow onBack={() => go('home')} />
                <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 transition focus-within:border-[#C9A24D] focus-within:ring-4 focus-within:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#141416]">
                  <Search className="h-5 w-5 shrink-0 text-[#C9A24D]" />
                  <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Name, email or MLS ID"
                    className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] outline-none placeholder:font-medium placeholder:text-gray-400 dark:text-white" />
                  {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
                </label>
                <div className="space-y-2">
                  {searchResults.map((agent, i) => {
                    const already = members.some(m => m.agent_id === agent.id)
                    return (
                      <motion.div key={agent.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 dark:border-white/[0.07] dark:bg-[#141416]">
                        {agent.photo_url ? <img src={agent.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/10"><UserIcon className="h-5 w-5" /></span>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{agent.name}</p>
                          <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{agent.brokerage || agent.email}</p>
                        </div>
                        {already ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Check className="h-3.5 w-3.5" /> On team</span>
                        ) : (
                          <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={() => handleAddMember(agent)} disabled={addingId === agent.id}
                            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-4 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                            {addingId === agent.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4" /> Add</>}
                          </motion.button>
                        )}
                      </motion.div>
                    )
                  })}
                  {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
                    <p className="py-6 text-center text-sm font-semibold text-gray-400">No agents match “{searchQuery.trim()}”.</p>
                  )}
                  {searchQuery.trim().length < 2 && (
                    <p className="py-6 text-center text-sm font-semibold text-gray-400">They get an invite - once they accept, they&apos;re on your team.</p>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'who' && (
              <motion.div key="who" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className="space-y-3">
                <BackRow onBack={() => go('home')} />
                {([
                  [false, 'My team and my brokerage', 'Agents at your brokerage can ask to host too. This is the usual choice.'],
                  [true, 'Only my team', 'Everyone else sees “Not accepting host requests” on your listings.'],
                ] as const).map(([value, title, blurb]) => {
                  const on = restricted === value
                  return (
                    <motion.button key={title} type="button" whileTap={{ scale: 0.98 }} disabled={isSavingRestriction} onClick={() => handleToggleRestriction(value)}
                      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.07]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-white/10 dark:bg-[#141416]'}`}>
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-white/20'}`}>
                        {on && (isSavingRestriction ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />)}
                      </span>
                      <span>
                        <span className="block text-[15px] font-black text-[#111827] dark:text-white">{title}</span>
                        <span className="mt-0.5 block text-[13px] font-medium text-gray-500 dark:text-gray-400">{blurb}</span>
                      </span>
                    </motion.button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </OhSheet>
    <TeamAskFlow open={asking} listings={listings} teamSize={accepted.length} onClose={() => setAsking(false)} onSent={() => { setAsking(false); load() }} />
    </>
  )
}

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
      <ArrowLeft className="h-4 w-4" /> My team
    </button>
  )
}
