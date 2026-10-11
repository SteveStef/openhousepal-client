'use client'

import { useCallback, useEffect, useState } from 'react'
import { HelpCircle, Loader2, Send, ChevronLeft, Lock, Unlock, Layers, Flame, Monitor, MapPin, Clock, Link2 } from 'lucide-react'
import api from '@/lib/api-service'
import { AdminSupportTicketListItem, SupportTicketCategory, SupportTicketDetail, SupportTicketDetails } from '@/types'
import { formatDateTime } from '@/lib/relativeDays'
import { SUPPORT_CATEGORIES, URGENCY_OPTIONS, supportCategory } from '@/lib/supportCategories'
import { CategoryPill, MessageAttachments, MessageBody } from '@/components/support/TicketBits'

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
      status === 'closed'
        ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    }`}>
      {status === 'closed' ? 'Closed' : 'Open'}
    </span>
  )
}

// What the agent's browser sent along with the ticket (page they came from, device, urgency) -
// shown as a compact strip above the thread so the admin never has to ask "which browser?".
function TicketDetailsStrip({ details }: { details?: SupportTicketDetails | null }) {
  if (!details) return null
  const urgency = details.urgency ? URGENCY_OPTIONS.find(u => u.id === details.urgency) : null
  const rows: { icon: typeof Monitor; label: string; value: React.ReactNode; tone?: string }[] = []
  if (urgency) rows.push({ icon: Flame, label: 'Urgency', value: `${urgency.label} - ${urgency.hint}`, tone: details.urgency === 'urgent' ? 'text-rose-600 dark:text-rose-300' : undefined })
  if (details.area) rows.push({ icon: MapPin, label: 'Where', value: details.area })
  if (details.page_url) rows.push({
    icon: Link2, label: 'Page',
    value: <a href={details.page_url} target="_blank" rel="noopener noreferrer" className="break-all underline decoration-[#C9A24D]/50 underline-offset-2 hover:text-[#8b7355]">{details.page_url.replace(/^https?:\/\/[^/]+/, '')}</a>,
  })
  if (details.browser || details.os) rows.push({ icon: Monitor, label: 'Device', value: [details.browser && details.os ? `${details.browser} on ${details.os}` : details.browser || details.os, details.device].filter(Boolean).join(' · ') })
  if (details.viewport || details.screen) rows.push({ icon: Layers, label: 'Size', value: [details.viewport && `window ${details.viewport}`, details.screen && `screen ${details.screen}`].filter(Boolean).join(' · ') })
  if (details.timezone || details.language) rows.push({ icon: Clock, label: 'Locale', value: [details.timezone, details.language].filter(Boolean).join(' · ') })
  if (!rows.length) return null
  return (
    <div data-testid="admin-ticket-details" className="grid gap-x-4 gap-y-1.5 border-b border-gray-100 bg-[#fdfbf6] px-4 py-3 sm:grid-cols-2 dark:border-gray-800 dark:bg-white/[0.02]">
      {rows.map(r => (
        <div key={r.label} className="flex min-w-0 items-start gap-2 text-xs">
          <r.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
          <span className="w-14 shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-400">{r.label}</span>
          <span className={`min-w-0 font-semibold text-gray-700 dark:text-gray-300 ${r.tone || ''}`}>{r.value}</span>
        </div>
      ))}
      {details.user_agent && (
        <details className="text-[10px] text-gray-400 sm:col-span-2">
          <summary className="cursor-pointer font-bold">Full browser string</summary>
          <p className="mt-1 break-all font-mono">{details.user_agent}</p>
        </details>
      )}
    </div>
  )
}

// Admin-side counterpart to the agent's /settings/help inbox - every agent's tickets in one
// place, unread-for-admin first (see admin_support_routes.py's sort), reply-as-admin creates a
// Notification for the agent via the same mechanism every other in-app alert uses. Tickets carry
// the category the agent picked (support / bug / feature) - colored badges + a filter row.
export default function SupportInboxPanel({ onRead }: { onRead?: () => void }) {
  const [tickets, setTickets] = useState<AdminSupportTicketListItem[]>([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDetail | null>(null)
  const [loadingThread, setLoadingThread] = useState(false)
  const [mobileShowThread, setMobileShowThread] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)

  // Same Open/Closed tabs + 5-per-page pagination as the agent's own /settings/help inbox - an
  // admin fielding tickets across every agent shouldn't be stuck scrolling one long list either.
  const PAGE_SIZE = 5
  const [listTab, setListTab] = useState<'open' | 'closed'>('open')
  const [categoryFilter, setCategoryFilter] = useState<SupportTicketCategory | 'all'>('all')
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [listTab, categoryFilter])

  const fetchTickets = useCallback(async () => {
    const { success, data } = await api.admin.getSupportTickets()
    if (success && data) setTickets(data)
    setLoadingTickets(false)
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Short-poll the ticket list so a new/replied agent ticket shows up (unread dot, updated_at,
  // status) without the admin having to leave and come back - same pattern as the agent-facing
  // /settings/help inbox's own list poll.
  useEffect(() => {
    const interval = setInterval(fetchTickets, 8000)
    return () => clearInterval(interval)
  }, [fetchTickets])

  // While a thread is open, poll its own detail so an agent's reply that lands while you're
  // looking at it appears live instead of only after reopening the ticket.
  useEffect(() => {
    if (!selectedId) return
    const interval = setInterval(async () => {
      const { success, data } = await api.admin.getSupportTicket(selectedId)
      if (success && data) setSelectedTicket(data)
    }, 4000)
    return () => clearInterval(interval)
  }, [selectedId])

  const openTicket = async (id: string) => {
    setSelectedId(id)
    setMobileShowThread(true)
    setLoadingThread(true)
    const { success, data } = await api.admin.getSupportTicket(id)
    if (success && data) {
      setSelectedTicket(data)
      setTickets(prev => prev.map(t => t.id === id ? { ...t, unread: false } : t))
      onRead?.()
    }
    setLoadingThread(false)
  }

  const handleReply = async () => {
    if (!replyBody.trim() || !selectedId || sendingReply) return
    setSendingReply(true)
    const { success, data } = await api.admin.replySupportTicket(selectedId, replyBody.trim())
    setSendingReply(false)
    if (success && data) {
      setSelectedTicket(data)
      setReplyBody('')
      fetchTickets()
    }
  }

  const toggleStatus = async () => {
    if (!selectedId || !selectedTicket || togglingStatus) return
    setTogglingStatus(true)
    const nextStatus = selectedTicket.status === 'closed' ? 'open' : 'closed'
    const { success, data } = await api.admin.updateSupportTicketStatus(selectedId, nextStatus)
    setTogglingStatus(false)
    if (success && data) {
      setSelectedTicket(data)
      fetchTickets()
    }
  }

  const selectedTicketMeta = tickets.find(t => t.id === selectedId)

  const openCount = tickets.filter(t => t.status !== 'closed').length
  const closedCount = tickets.filter(t => t.status === 'closed').length
  const inTab = tickets.filter(t => (listTab === 'closed' ? t.status === 'closed' : t.status !== 'closed'))
  const filteredTickets = categoryFilter === 'all' ? inTab : inTab.filter(t => (t.category || 'support') === categoryFilter)
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const pagedTickets = filteredTickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="grid gap-4 md:grid-cols-[340px_1fr]">
      {/* Ticket list */}
      <div className={`${mobileShowThread ? 'hidden md:flex' : 'flex'} min-w-0 flex-col gap-2`}>
        <div className="flex items-center gap-1 rounded-xl border border-gray-100 bg-white p-1 dark:border-gray-800 dark:bg-[#151517]">
          {(['open', 'closed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setListTab(tab)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-widest transition ${
                listTab === tab
                  ? 'bg-[#C9A24D] text-[#111827]'
                  : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              {tab === 'open' ? `Open (${openCount})` : `Closed (${closedCount})`}
            </button>
          ))}
        </div>

        {/* Category filter - counts follow the Open/Closed tab */}
        <div data-testid="admin-category-filter" className="flex flex-wrap gap-1.5">
          {([{ id: 'all' as const, label: 'All', dot: 'bg-gray-400', icon: Layers }, ...SUPPORT_CATEGORIES]).map(c => {
            const on = categoryFilter === c.id
            const count = c.id === 'all' ? inTab.length : inTab.filter(t => (t.category || 'support') === c.id).length
            const Icon = c.icon
            return (
              <button
                key={c.id}
                data-testid={`admin-filter-${c.id}`}
                onClick={() => setCategoryFilter(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
                  on
                    ? c.id === 'all'
                      ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]'
                      : `border-transparent ring-1 ${supportCategory(c.id).badge}`
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-gray-800 dark:bg-[#151517] dark:text-gray-400 dark:hover:border-gray-700'
                }`}
              >
                <Icon className="h-3 w-3" />
                {c.label}
                <span className={`rounded-full px-1.5 text-[9px] ${on ? 'bg-black/10 dark:bg-white/15' : 'bg-gray-100 dark:bg-gray-800'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {loadingTickets && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-10 text-sm font-bold text-gray-400 dark:border-gray-800 dark:bg-[#151517]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        )}
        {!loadingTickets && filteredTickets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm font-bold text-gray-400 dark:border-gray-700">
            {categoryFilter !== 'all'
              ? `No ${listTab} ${supportCategory(categoryFilter).label.toLowerCase()} tickets.`
              : listTab === 'closed' ? 'No closed tickets.' : 'No open tickets.'}
          </div>
        )}
        {pagedTickets.map(ticket => {
          const meta = supportCategory(ticket.category)
          return (
            <button
              key={ticket.id}
              data-testid="admin-ticket-row"
              onClick={() => openTicket(ticket.id)}
              className={`relative flex w-full min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border p-3.5 pl-4 text-left transition ${
                ticket.id === selectedId
                  ? 'border-[#C9A24D] bg-[#C9A24D]/10'
                  : 'border-gray-100 bg-white hover:border-gray-200 dark:border-gray-800 dark:bg-[#151517] dark:hover:border-gray-700'
              }`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${meta.dot}`} />
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-black text-[#111827] dark:text-white">{ticket.subject}</p>
                {ticket.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
              </div>
              <p className="truncate text-xs font-bold text-gray-500 dark:text-gray-400">{ticket.agent_name} · {ticket.agent_email}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <CategoryPill category={ticket.category} />
                <StatusPill status={ticket.status} />
                <span className="text-[10px] font-bold text-gray-400">{formatDateTime(ticket.updated_at)}</span>
              </div>
            </button>
          )
        })}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 pt-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black transition ${
                  p === page
                    ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Thread */}
      <div className={`${mobileShowThread ? 'flex' : 'hidden md:flex'} min-h-[480px] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#151517]`}>
        {!selectedId && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-sm font-bold text-gray-400">
            <HelpCircle className="h-8 w-8 text-gray-300 dark:text-gray-700" />
            Select a ticket to view the conversation.
          </div>
        )}

        {selectedId && (
          <>
            <div className="flex items-center gap-2 border-b border-gray-100 p-4 dark:border-gray-800">
              <button onClick={() => setMobileShowThread(false)} className="rounded-lg p-1 text-gray-400 hover:text-[#111827] dark:hover:text-white md:hidden">
                <ChevronLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#111827] dark:text-white">{selectedTicket?.subject || '...'}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {selectedTicket && <CategoryPill category={selectedTicket.category} />}
                  {selectedTicket && <StatusPill status={selectedTicket.status} />}
                  {selectedTicketMeta && <span className="min-w-0 truncate text-xs font-bold text-gray-500 dark:text-gray-400">{selectedTicketMeta.agent_name} · {selectedTicketMeta.agent_email}</span>}
                </div>
              </div>
              {selectedTicket && (
                <button
                  onClick={toggleStatus}
                  disabled={togglingStatus}
                  data-testid="admin-toggle-status"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 transition hover:border-[#C9A24D] hover:text-[#C9A24D] disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
                >
                  {selectedTicket.status === 'closed' ? <Unlock size={12} /> : <Lock size={12} />}
                  {selectedTicket.status === 'closed' ? 'Reopen' : 'Close'}
                </button>
              )}
            </div>

            {!loadingThread && <TicketDetailsStrip details={selectedTicket?.details} />}

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loadingThread && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              )}
              {!loadingThread && selectedTicket?.messages.map(message => (
                <div key={message.id} className={`flex ${message.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    message.sender_type === 'admin'
                      ? 'bg-[#C9A24D] text-[#111827] rounded-br-sm'
                      : 'bg-gray-100 text-[#111827] dark:bg-gray-800 dark:text-white rounded-bl-sm'
                  }`}>
                    <MessageBody body={message.body} />
                    <MessageAttachments urls={message.attachments} mine={message.sender_type === 'admin'} />
                    <p className={`mt-1 text-[10px] font-bold ${message.sender_type === 'admin' ? 'text-[#111827]/60' : 'text-gray-400'}`}>
                      {message.sender_type === 'admin' ? 'You · ' : ''}{formatDateTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
              <textarea
                value={replyBody}
                data-testid="admin-reply"
                onChange={e => setReplyBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                placeholder="Reply to this agent..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
              />
              <button
                onClick={handleReply}
                disabled={!replyBody.trim() || sendingReply}
                data-testid="admin-reply-send"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#111827]"
              >
                {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
