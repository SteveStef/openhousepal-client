'use client'

import { useState } from 'react'
import { Calendar, Clock, Check, X, MessageSquare, Loader2, Home, CalendarClock } from 'lucide-react'
import { HostRequest } from '@/types'

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
}: {
  request: HostRequest
  showAddress?: boolean
  onApprove?: (id: string) => Promise<void>
  onDecline?: (id: string) => Promise<void>
  onCounter?: (id: string, counterDate: string, counterStart: string, counterEnd: string) => Promise<void>
  onAcceptCounter?: (id: string) => Promise<void>
  onDeclineCounter?: (id: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<'approve' | 'decline' | 'counter' | 'accept-counter' | 'decline-counter' | null>(null)
  const [isCountering, setIsCountering] = useState(false)
  const [counterDate, setCounterDate] = useState(request.requested_date)
  const [counterStart, setCounterStart] = useState(request.requested_start_time)
  const [counterEnd, setCounterEnd] = useState(request.requested_end_time)
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

  const handleSendCounter = async () => {
    if (!onCounter || busy || !counterDate || !counterStart || !counterEnd) return
    setBusy('counter')
    await onCounter(request.id, counterDate, counterStart, counterEnd)
    setBusy(null)
    setIsCountering(false)
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
          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{request.requesting_agent_name}</p>
          {request.requesting_agent_brokerage && (
            <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{request.requesting_agent_brokerage}</p>
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

      {request.message && (
        <p className="mt-3 rounded-xl bg-gray-50 dark:bg-[#0F0F11] p-3 text-xs font-medium italic text-gray-600 dark:text-gray-300">
          "{request.message}"
        </p>
      )}

      {isCountered && request.counter_date && request.counter_start_time && request.counter_end_time && (
        <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-xs font-bold text-amber-700 dark:text-amber-400">
          <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> Proposed instead: {formatDate(request.counter_date)}, {formatTime(request.counter_start_time)} - {formatTime(request.counter_end_time)}</span>
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
          {onCounter && (
            <button
              onClick={() => setIsCountering(v => !v)}
              disabled={busy !== null}
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              aria-label="Suggest a different time"
              title="Suggest a different time"
            >
              <CalendarClock size={14} />
            </button>
          )}
          {request.requesting_agent_email && (
            <a
              href={`mailto:${request.requesting_agent_email}`}
              className="flex shrink-0 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 p-2.5 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-800"
              aria-label={`Message ${request.requesting_agent_name}`}
              title="Message"
            >
              <MessageSquare size={14} />
            </a>
          )}
        </div>
      )}

      {isPending && isCountering && onCounter && (
        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Suggest a different time</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={counterDate}
              onChange={e => setCounterDate(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
            />
            <input
              type="time"
              value={counterStart}
              onChange={e => setCounterStart(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
            />
            <input
              type="time"
              value={counterEnd}
              onChange={e => setCounterEnd(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-2 py-1.5 text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white"
            />
          </div>
          <button
            onClick={handleSendCounter}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111827] dark:bg-white px-3 py-2 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
          >
            {busy === 'counter' ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />} Send Proposed Time
          </button>
        </div>
      )}

      {isCountered && (onAcceptCounter || onDeclineCounter) && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleAcceptCounter}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
          >
            {busy === 'accept-counter' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />} Accept New Time
          </button>
          <button
            onClick={handleDeclineCounter}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs font-black text-[#111827] dark:text-white transition hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {busy === 'decline-counter' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} strokeWidth={3} />} Decline
          </button>
        </div>
      )}
    </div>
  )
}
