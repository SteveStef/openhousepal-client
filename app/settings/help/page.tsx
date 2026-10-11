'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Archive, Bell, Loader2, Plus, Send, ChevronLeft, LifeBuoy, Lock, MessageCircle, RotateCcw, CircleSlash, ArrowRight } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import { SupportTicketDetail, SupportTicketListItem } from '@/types'
import LuxeHero, { LuxeStats, LuxeTabs } from '@/components/ui/LuxeHero'
import { formatDateTime } from '@/lib/relativeDays'
import NewTicketWindow, { type TicketPrefill } from '@/components/support/NewTicketWindow'
import { SUPPORT_CATEGORIES } from '@/lib/supportCategories'
import { CategoryPill, MessageAttachments, MessageBody } from '@/components/support/TicketBits'
import type { SupportTicketCategory } from '@/types'

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ${
      status === 'closed'
        ? 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-white/10'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-500/30'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'closed' ? 'bg-gray-400' : 'bg-emerald-500'}`} />
      {status === 'closed' ? 'Closed' : 'Open'}
    </span>
  )
}

// A ticket list item card - shared shape between the (mobile) list-only view and the desktop
// left pane, so selection styling never drifts between the two.
function TicketRow({ ticket, isActive, onClick }: { ticket: SupportTicketListItem; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-200 ${
        isActive
          ? 'border-[#C9A24D] bg-gradient-to-br from-[#fffdf8] to-[#fbf3df] shadow-[0_14px_30px_-20px_rgba(201,162,77,.95)] dark:from-[#C9A24D]/15 dark:to-[#C9A24D]/5'
          : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-[#C9A24D]/50 hover:shadow-md dark:border-gray-800 dark:bg-[#151517] dark:hover:border-[#C9A24D]/40'
      }`}
    >
      {isActive && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-[#C9A24D] to-[#e8c97a]" />}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-black text-[#111827] dark:text-white">{ticket.subject}</p>
        {ticket.unread && (
          <span className="relative flex h-2.5 w-2.5 shrink-0" title="New reply">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A24D] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#C9A24D]" />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryPill category={ticket.category} />
        <StatusPill status={ticket.status} />
        <span className="text-[10px] font-bold text-gray-400">{formatDateTime(ticket.updated_at)}</span>
      </div>
    </button>
  )
}

function HelpPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: isCheckingAuth } = useAuth()

  const [tickets, setTickets] = useState<SupportTicketListItem[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDetail | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  // Open/closed are shown as separate tabs, each paginated at PAGE_SIZE - an agent who's filed a
  // lot of tickets over time shouldn't be stuck scrolling one long undifferentiated list.
  const PAGE_SIZE = 5
  const [listTab, setListTab] = useState<'open' | 'closed'>('open')
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [listTab])

  // The "Submit a Ticket" window (components/support/NewTicketWindow.tsx). A prefill picks the
  // category up front (e.g. a CMA's "Submit Ticket" lands straight on a bug report).
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [prefill, setPrefill] = useState<TicketPrefill | null>(null)
  const startTicket = (category?: SupportTicketCategory) => {
    setPrefill(category ? { category } : null)
    setShowNewTicket(true)
  }

  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) router.replace('/')
  }, [isCheckingAuth, isAuthenticated, router])

  const fetchTickets = useCallback(async () => {
    const { success, data } = await api.support.getAll()
    if (success && data) setTickets(data)
    setLoadingTickets(false)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchTickets()
  }, [isAuthenticated, fetchTickets])

  // Short-poll the ticket list so a new admin reply shows up (unread dot, updated_at, status)
  // without the agent having to leave and come back - same pattern as useSupportUnreadCount's
  // badge poll, just scoped to this page's own list instead of the header icon.
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(fetchTickets, 8000)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchTickets])

  // While a thread is open, poll its own detail so a reply that lands while you're looking at it
  // appears live instead of only after reopening the ticket.
  useEffect(() => {
    if (!selectedId) return
    const interval = setInterval(async () => {
      const { success, data } = await api.support.getById(selectedId)
      if (success && data) setSelectedTicket(data)
    }, 4000)
    return () => clearInterval(interval)
  }, [selectedId])

  const openTicket = useCallback(async (id: string) => {
    setSelectedId(id)
    setMobileShowThread(true)
    setLoadingThread(true)
    const { success, data } = await api.support.getById(id)
    if (success && data) {
      setSelectedTicket(data)
      // Opening a ticket reads it server-side too - drop its unread dot locally right away
      // instead of waiting on the next list refetch.
      setTickets(prev => prev.map(t => t.id === id ? { ...t, unread: false } : t))
    }
    setLoadingThread(false)
  }, [])

  // Deep link from a notification click (?ticket=<id>) opens straight into that thread once the
  // agent's ticket list has loaded.
  useEffect(() => {
    const ticketParam = searchParams.get('ticket')
    if (ticketParam && !loadingTickets && selectedId !== ticketParam) {
      openTicket(ticketParam)
    }
  }, [searchParams, loadingTickets, selectedId, openTicket])

  // Deep link from the homepage's "Ask Us a Question" (?compose=1&category=support) - opens the
  // Submit a Ticket window instead of just landing on the inbox; with a category it skips the
  // picker. A CMA report's "Submit Ticket" link (see studio/cma/[id]/page.tsx) adds
  // ?cma_code=<code> so admin can pull up the exact report - that becomes a CMA bug report with
  // the code already filled in instead of making the agent retype it.
  useEffect(() => {
    if (searchParams.get('compose') !== '1') return
    const cmaCode = searchParams.get('cma_code')
    const asked = searchParams.get('category')
    if (cmaCode) {
      setPrefill({ category: 'bug', subject: 'Issue with a CMA report', body: `CMA Report Code: ${cmaCode}\n\n`, area: 'CMA' })
    } else if (asked === 'support' || asked === 'bug' || asked === 'feature') {
      setPrefill({ category: asked })
    }
    setShowNewTicket(true)
  }, [searchParams])

  const viewNewTicket = (ticket: SupportTicketDetail) => {
    setShowNewTicket(false)
    setListTab('open')
    setSelectedTicket(ticket)
    setSelectedId(ticket.id)
    setMobileShowThread(true)
  }

  const handleReply = async () => {
    if (!replyBody.trim() || !selectedId || sendingReply) return
    setSendingReply(true)
    const { success, data } = await api.support.reply(selectedId, replyBody.trim())
    setSendingReply(false)
    if (success && data) {
      setSelectedTicket(data)
      setReplyBody('')
      fetchTickets()
    }
  }

  const handleToggleStatus = async () => {
    if (!selectedId || !selectedTicket || updatingStatus) return
    const nextStatus = selectedTicket.status === 'closed' ? 'open' : 'closed'
    setUpdatingStatus(true)
    const { success, data } = await api.support.updateStatus(selectedId, nextStatus)
    setUpdatingStatus(false)
    if (success && data) {
      setSelectedTicket(data)
      fetchTickets()
    }
  }

  if (isCheckingAuth || !isAuthenticated) {
    return <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]" />
  }

  const openCount = tickets.filter(t => t.status !== 'closed').length
  const closedCount = tickets.filter(t => t.status === 'closed').length
  const unreadCount = tickets.filter(t => t.unread).length
  const filteredTickets = tickets.filter(t => (listTab === 'closed' ? t.status === 'closed' : t.status !== 'closed'))
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const pagedTickets = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 sm:py-6 animate-fadeIn">
        <LuxeHero
          compact
          backHref="/dash"
          backLabel="Dashboard"
          kicker="Help & Support"
          icon={LifeBuoy}
          title={<>We&apos;re here <em>to help.</em></>}
          subtitle="Submit a ticket and hear back from the OpenHousePal team, right here."
          asideClassName="w-full lg:w-[290px] lg:-mt-2"
          aside={
            <LuxeStats
              large
              stats={[
                { label: 'Open', value: openCount, icon: MessageCircle, alert: openCount > 0, onClick: () => setListTab('open') },
                { label: 'New replies', value: unreadCount, icon: Bell, urgent: unreadCount > 0, onClick: () => setListTab('open') },
              ]}
            />
          }
          tabs={
            <LuxeTabs
              label="Tickets"
              active={listTab}
              onChange={setListTab}
              items={[
                { id: 'open', label: `Open (${openCount})`, icon: MessageCircle },
                { id: 'closed', label: `Closed (${closedCount})`, icon: Archive },
              ]}
              pinEnd
              end={
                <button
                  onClick={() => startTicket()}
                  data-testid="submit-ticket"
                  className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3.5 py-2 text-xs font-black text-[#111827] shadow-md shadow-[#C9A24D]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <Plus className="relative h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" /> <span className="relative">Submit a Ticket</span>
                </button>
              }
            />
          }
        />

        <div className="mt-5 grid gap-4 md:grid-cols-[300px_1fr]">
          {/* Ticket list - hidden on mobile once a thread is open */}
          <div className={`${mobileShowThread ? 'hidden md:flex' : 'flex'} flex-col gap-2`}>
            {loadingTickets && [0, 1, 2].map(i => (
              <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
                <div className="h-3 w-4/5 rounded-full bg-gray-200 dark:bg-gray-800" />
                <div className="mt-2.5 h-2.5 w-2/5 rounded-full bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
            {!loadingTickets && filteredTickets.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#C9A24D]/40 bg-white/60 p-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fbf3df] text-[#8b7355] dark:bg-[#C9A24D]/15 dark:text-[#e8c97a]">
                  {listTab === 'closed' ? <Archive className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                </span>
                <p className="text-sm font-bold text-gray-500 dark:text-white/55">
                  {listTab === 'closed' ? 'No closed tickets.' : 'No open tickets. Start one if you need a hand.'}
                </p>
              </div>
            )}
            <AnimatePresence mode="popLayout" initial={false}>
              {pagedTickets.map((ticket, i) => (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34, delay: Math.min(i * 0.03, 0.15) }}
                >
                  <TicketRow ticket={ticket} isActive={ticket.id === selectedId} onClick={() => openTicket(ticket.id)} />
                </motion.div>
              ))}
            </AnimatePresence>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 pt-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black transition ${
                      p === page
                        ? 'bg-[#111827] text-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]'
                        : 'text-gray-400 hover:bg-[#C9A24D]/10 hover:text-[#111827] dark:hover:bg-white/[0.06] dark:hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thread */}
          <div className={`${mobileShowThread ? 'flex' : 'hidden md:flex'} min-h-[480px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_24px_50px_-34px_rgba(139,115,85,.5)] dark:border-gray-800 dark:bg-[#151517]`}>
            {!selectedId && (
              <div className="relative flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden p-10 text-center">
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C9A24D]/10 blur-3xl" />
                <motion.span
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-[#111827] to-[#1d1810] text-[#e8c97a] shadow-xl shadow-[#111827]/20"
                >
                  <LifeBuoy className="h-8 w-8" strokeWidth={1.6} />
                </motion.span>
                <p className="relative font-serif text-xl font-black text-[#111827] dark:text-white">How can we help?</p>
                <p className="relative max-w-xs text-sm font-semibold text-gray-500 dark:text-white/55">Pick a ticket on the left, or start a new one - a real person on our team replies right here.</p>
                {/* Straight into one of the three kinds of ticket */}
                <div className="relative mt-2 grid w-full max-w-md gap-2 sm:grid-cols-3">
                  {SUPPORT_CATEGORIES.map((c, i) => {
                    const Icon = c.icon
                    return (
                      <motion.button
                        key={c.id}
                        onClick={() => startTicket(c.id)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.06 } }}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.97 }}
                        className="group flex items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:border-[#C9A24D]/60 sm:flex-col sm:items-center sm:gap-2 sm:py-3.5 sm:text-center dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${c.tile}`} style={{ boxShadow: `0 10px 20px -10px ${c.glow}` }}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-xs font-black text-[#111827] dark:text-white">{c.title}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#C9A24D] sm:hidden" />
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedId && (
              <>
                <div className="relative flex items-center gap-2.5 border-b border-[#C9A24D]/20 bg-gradient-to-r from-[#fffdf8] to-[#fbf3df] px-4 py-3 dark:border-white/[0.07] dark:from-[#151517] dark:to-[#1d1810]">
                  <button onClick={() => setMobileShowThread(false)} className="rounded-lg p-1 text-gray-400 hover:text-[#111827] dark:hover:text-white md:hidden">
                    <ChevronLeft size={18} />
                  </button>
                  <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#111827] text-[#e8c97a] sm:grid dark:bg-white/10">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-base font-black text-[#111827] dark:text-white">{selectedTicket?.subject || '...'}</p>
                    {selectedTicket && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <CategoryPill category={selectedTicket.category} />
                        <StatusPill status={selectedTicket.status} />
                      </div>
                    )}
                  </div>
                  {selectedTicket && (
                    <button
                      onClick={handleToggleStatus}
                      disabled={updatingStatus}
                      data-testid="agent-toggle-status"
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:text-[#111827] disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60 dark:hover:text-white"
                    >
                      {updatingStatus ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : selectedTicket.status === 'closed' ? (
                        <RotateCcw size={12} />
                      ) : (
                        <CircleSlash size={12} />
                      )}
                      {selectedTicket.status === 'closed' ? 'Reopen' : <>Close<span className="hidden sm:inline">&nbsp;Ticket</span></>}
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(80%_60%_at_50%_0%,rgba(201,162,77,.06),transparent)] p-4">
                  {loadingThread && (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> Loading...
                    </div>
                  )}
                  {!loadingThread && selectedTicket?.messages.map(message => {
                    const mine = message.sender_type === 'agent'
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        {!mine && (
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#111827] text-[9px] font-black text-[#e8c97a]">OHP</span>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                          mine
                            ? 'rounded-br-sm bg-gradient-to-br from-[#C9A24D] to-[#e8c97a] text-[#111827]'
                            : 'rounded-bl-sm border border-gray-100 bg-[#FAFAF7] text-[#111827] dark:border-white/10 dark:bg-white/[0.06] dark:text-white'
                        }`}>
                          <MessageBody body={message.body} />
                          <MessageAttachments urls={message.attachments} mine={mine} />
                          <p className={`mt-1 text-[10px] font-bold ${mine ? 'text-[#111827]/60' : 'text-gray-400'}`}>
                            {message.sender_type === 'admin' ? 'OpenHousePal Support · ' : ''}{formatDateTime(message.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {selectedTicket?.status === 'closed' && (
                  <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-bold text-gray-500 dark:border-gray-800 dark:bg-white/5 dark:text-gray-400">
                    <Lock size={12} /> This ticket is closed — sending a reply will reopen it.
                  </div>
                )}

                <div className="flex items-end gap-2 border-t border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-[#151517]">
                  <textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                    placeholder="Type a reply..."
                    rows={1}
                    className="flex-1 resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-sm font-medium outline-none transition focus:border-[#C9A24D] focus:bg-white focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyBody.trim() || sendingReply}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111827] text-[#e8c97a] shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 dark:bg-[#e8c97a] dark:text-[#111827]"
                  >
                    {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <NewTicketWindow
        open={showNewTicket}
        prefill={prefill}
        onClose={() => setShowNewTicket(false)}
        onCreated={() => { setListTab('open'); fetchTickets() }}
        onViewTicket={viewNewTicket}
      />
    </div>
  )
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]" />}>
      <HelpPageContent />
    </Suspense>
  )
}
