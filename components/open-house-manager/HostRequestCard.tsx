'use client'

import { useState } from 'react'
import { todayLocal } from '@/lib/relativeDays'
import { Calendar, Clock, Check, X, Loader2, Home, CalendarClock, History, ChevronDown } from 'lucide-react'
import OfferTimeFlow from './OfferTimeFlow'
import { HostRequest, HostRequestEvent } from '@/types'
import api from '@/lib/api-service'

const ACTION_LABEL: Record<HostRequestEvent['action'], string> = {
  requested: 'Requested',
  countered: 'Proposed a different time',
  counter_accepted: 'Accepted the proposed time',
  counter_declined: 'Declined the proposed time',
  approved: 'Approved',
  declined: 'Declined',
  note: 'Note',
}

function RequestHistory({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<HostRequestEvent[] | null>(null)

  const handleToggle = async () => {
    const next = !open
    setOpen(next)
    if (next && events === null) {
      setLoading(true)
      const { success, data } = await api.openHouseManager.getRequestHistory(requestId)
      if (success && data) setEvents(data)
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <span className="inline-flex items-center gap-1.5"><History size={12} /> Activity</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        loading ? (
          <div className="flex justify-center py-3"><Loader2 size={14} className="animate-spin text-[#C9A24D]" /></div>
        ) : (
          <div className="mt-2 space-y-2">
            {(events || []).map(event => (
              <div key={event.id} className="text-xs">
                <p className="font-bold text-gray-700 dark:text-gray-300">
                  {event.actor_name || 'System'} · <span className="font-medium text-gray-400">{ACTION_LABEL[event.action]}</span>
                </p>
                {event.proposed_date && (
                  <p className="text-gray-500 dark:text-gray-400">{formatDate(event.proposed_date)}{event.proposed_start_time && event.proposed_end_time ? `, ${formatTime(event.proposed_start_time)} - ${formatTime(event.proposed_end_time)}` : ''}</p>
                )}
                {event.note && <p className="italic text-gray-500 dark:text-gray-400">"{event.note}"</p>}
                <p className="text-[10px] text-gray-400">{new Date(event.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}


export default function HostRequestCard({
  request,
  showAddress = false,
  onApprove,
  onDecline,
  onCounter,
  onAcceptCounter,
  onDeclineCounter,
  onCounterBack,
  asHost = false,
  onWithdraw,
  showHistory = false,
  buildKitHref,
}: {
  request: HostRequest
  showAddress?: boolean
  /** The host's own approved request: their kit for this home (open it, or build it if they have none). */
  buildKitHref?: string
  onApprove?: (id: string) => Promise<void>
  onDecline?: (id: string) => Promise<void>
  onCounter?: (id: string, counterDate: string, counterStart: string, counterEnd: string, counterMessage: string) => Promise<void>
  onAcceptCounter?: (id: string) => Promise<void>
  onDeclineCounter?: (id: string) => Promise<void>
  // Host proposing yet another time after the listing agent countered - lets the two sides keep
  // negotiating instead of being capped at one round.
  onCounterBack?: (id: string, proposedDate: string, proposedStart: string, proposedEnd: string, note: string) => Promise<void>
  /** The host's own request (My requests): show the listing agent they're dealing with, not themselves. */
  asHost?: boolean
  /** Host side: take the request back, or back out of a confirmed open. */
  onWithdraw?: (id: string) => Promise<void>
  showHistory?: boolean
}) {
  const [busy, setBusy] = useState<'approve' | 'decline' | 'counter' | 'accept-counter' | 'decline-counter' | 'counter-back' | 'withdraw' | null>(null)
  const [isCountering, setIsCountering] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [isCounteringBack, setIsCounteringBack] = useState(false)
  const isPending = request.status === 'pending'
  const isCountered = request.status === 'countered'

  const handleApprove = async () => {
    if (!onApprove || busy) return
    setBusy('approve')
    await onApprove(request.id)
    setBusy(null)
  }

  const handleDecline = async () => {
    if (!onDecline || busy) return
    setBusy('decline')
    await onDecline(request.id)
    setBusy(null)
  }

  const handleAcceptCounter = async () => {
    if (!onAcceptCounter || busy) return
    setBusy('accept-counter')
    await onAcceptCounter(request.id)
    setBusy(null)
  }

  const handleDeclineCounter = async () => {
    if (!onDeclineCounter || busy) return
    setBusy('decline-counter')
    await onDeclineCounter(request.id)
    setBusy(null)
  }

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517] p-4">
      {showAddress && request.property_address && (
        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
          <Home size={12} /> {request.property_address}
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {asHost && request.listing_agent_name ? (
            <>
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Listing agent</p>
              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{request.listing_agent_name}</p>
              {request.listing_agent_brokerage && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{request.listing_agent_brokerage}</p>}
            </>
          ) : (
            <>
              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{request.requesting_agent_name}</p>
              {request.requesting_agent_brokerage && (
                <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{request.requesting_agent_brokerage}</p>
              )}
            </>
          )}
        </div>
        {!isPending && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
            request.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : request.status === 'countered' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}>
            {request.status === 'countered' ? 'New time proposed' : request.status}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1"><Calendar size={12} /> {formatDate(request.requested_date)}</span>
        <span className="inline-flex items-center gap-1"><Clock size={12} /> {formatTime(request.requested_start_time)} - {formatTime(request.requested_end_time)}</span>
      </div>

      {/* The original note this request was sent with - kept visible no matter how it was
          resolved, instead of getting replaced once the listing agent's standing Host Notes
          become available on approval. */}
      {request.message && (
        <p className="mt-3 rounded-xl bg-gray-50 dark:bg-[#0F0F11] p-3 text-xs font-medium italic text-gray-600 dark:text-gray-300">
          "{request.message}"
        </p>
      )}

      {request.status === 'approved' && (
        <>
          {/* The note it was ultimately accepted with, if the final time came from a counter -
              also kept once approved instead of only showing while status is still "countered". */}
          {request.counter_message && (
            <p className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-xs font-medium italic text-amber-700 dark:text-amber-400">
              "{request.counter_message}"
            </p>
          )}
          {buildKitHref && (
            <a href={buildKitHref} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700">
              Your kit &rarr;
            </a>
          )}
          {request.listing_host_notes && (
            <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Host Notes from the Listing Agent</p>
              <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-200 whitespace-pre-line">{request.listing_host_notes}</p>
            </div>
          )}
        </>
      )}

      {isCountered && request.counter_date && request.counter_start_time && request.counter_end_time && (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-400">
            <span className="inline-flex items-center gap-1">
              <CalendarClock size={13} /> Proposed instead: {formatDate(request.counter_date)}, {formatTime(request.counter_start_time)} - {formatTime(request.counter_end_time)}
            </span>
          </div>
          {request.counter_message && (
            <p className="rounded-xl bg-gray-50 dark:bg-[#0F0F11] p-3 text-xs font-medium italic text-gray-600 dark:text-gray-300">"{request.counter_message}"</p>
          )}
        </div>
      )}

      {isPending && (onApprove || onDecline) && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
          >
            {busy === 'approve' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Approve
          </button>
          <button
            onClick={handleDecline}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs font-black text-[#111827] dark:text-white transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {busy === 'decline' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} strokeWidth={3} />} Decline
          </button>
          {onCounter && !request.listing_agent_suggested_time && (
            <button
              onClick={() => setIsCountering(true)}
              disabled={busy !== null}
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              aria-label="Suggest a different time"
              title="Suggest a different time"
            >
              <CalendarClock size={14} /><span className="ml-1.5 text-xs font-black">Other time</span>
            </button>
          )}
        </div>
      )}

      {isPending && onCounter && request.listing_agent_suggested_time && (
        <p className="mt-2 text-[11px] font-semibold text-gray-400">You already suggested another time once, so now it&apos;s a yes or no.</p>
      )}


      {isCountered && (onAcceptCounter || onDeclineCounter) && (
        <div className="mt-3 flex items-center gap-2">
          {onAcceptCounter && (
            <button
              onClick={handleAcceptCounter}
              disabled={busy !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
            >
              {busy === 'accept-counter' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Accept New Time
            </button>
          )}
          {onDeclineCounter && (
            <button
              onClick={handleDeclineCounter}
              disabled={busy !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs font-black text-[#111827] dark:text-white transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {busy === 'decline-counter' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} strokeWidth={3} />} Decline
            </button>
          )}
          {onCounterBack && !request.host_suggested_time && (
            <button
              onClick={() => setIsCounteringBack(true)}
              disabled={busy !== null}
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              aria-label="Propose a different time"
              title="Propose a different time"
            >
              <CalendarClock size={14} /><span className="ml-1.5 text-xs font-black">Other time</span>
            </button>
          )}
        </div>
      )}

      {isCountered && onCounterBack && request.host_suggested_time && (
        <p className="mt-2 text-[11px] font-semibold text-gray-400">You already suggested another time once, so now it&apos;s a yes or no.</p>
      )}


      {/* "Other time" opens the step-by-step window (user, 10/22) instead of small date boxes here. */}
      {onCounter && (
        <OfferTimeFlow open={isCountering} onClose={() => setIsCountering(false)}
          street={(request.property_address || 'This listing').split(',')[0]} photo={request.property_image}
          theirDate={request.requested_date} theirStart={request.requested_start_time} theirEnd={request.requested_end_time}
          theirLabel={`${(request.requesting_agent_name || 'They').split(' ')[0]} asked for`} toName={request.requesting_agent_name || undefined}
          onSend={async (date, start, end, note) => { await onCounter(request.id, date, start, end, note) }} />
      )}
      {onCounterBack && (
        <OfferTimeFlow open={isCounteringBack} onClose={() => setIsCounteringBack(false)}
          street={(request.property_address || 'This listing').split(',')[0]} photo={request.property_image}
          theirDate={request.counter_date || request.requested_date} theirStart={request.counter_start_time || request.requested_start_time} theirEnd={request.counter_end_time || request.requested_end_time}
          theirLabel="They offered" toName={request.listing_agent_name || undefined}
          onSend={async (date, start, end, note) => { await onCounterBack(request.id, date, start, end, note) }} />
      )}

      {onWithdraw && (isPending || isCountered || (request.status === 'approved' && String(request.requested_date) >= todayLocal())) && (
        confirmWithdraw ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-3 dark:bg-rose-500/10">
            <p className="min-w-0 flex-1 text-xs font-bold text-rose-700 dark:text-rose-300">
              {request.status === 'approved' ? 'Tell the listing agent you can’t host? The day opens up for someone else.' : 'Take this request back?'}
            </p>
            <button onClick={() => setConfirmWithdraw(false)} className="rounded-lg px-3 py-1.5 text-xs font-black text-gray-500">Keep it</button>
            <button onClick={async () => { setBusy('withdraw'); await onWithdraw(request.id); setBusy(null); setConfirmWithdraw(false) }} disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50">
              {busy === 'withdraw' && <Loader2 size={12} className="animate-spin" />} {request.status === 'approved' ? 'I can’t host' : 'Withdraw'}
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmWithdraw(true)} className="mt-3 block text-[11px] font-black text-gray-400 underline-offset-4 hover:text-rose-600 hover:underline">
            {request.status === 'approved' ? 'Can’t host anymore?' : 'Withdraw request'}
          </button>
        )
      )}

      {showHistory && <RequestHistory requestId={request.id} />}
    </div>
  )
}
