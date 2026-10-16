'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Calendar, Clock, Send, Loader2, Plus, CalendarCheck, Users } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { IncomingBroadcast } from '@/types'
import { formatShortDateWithDay, formatTime, TIME_SLOT_OPTIONS, endTimeOptionsFor } from './formatters'
import { BroadcastCard } from './MyRequestsPanel'
import TakenDatesPicker from './TakenDatesPicker'
import TimeSelect from './TimeSelect'
import { refreshOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import { todayLocal } from '@/lib/relativeDays'

export default function RequestToHostModal({
  property,
  initialDate,
  scheduledOpens = [],
  teamBroadcasts = [],
  onClose,
  onSent,
  onBroadcastHandled,
  onFallbackToEmail,
}: {
  property: any
  // Set when the agent got here by clicking an empty weekend-calendar cell on the listing row
  // instead of the plain "Request to Host" button - saves them re-picking the date they just saw.
  initialDate?: string
  // Every open already scheduled (kit built or approved-and-pending) for this listing, so the
  // requester can see what's taken before picking a date instead of finding out after submitting.
  scheduledOpens?: { scheduled_date: string | null, scheduled_start_time: string | null, scheduled_end_time: string | null }[]
  // Open "my team needs a host" asks (team-wide or a direct request) for this exact listing that
  // the viewer is eligible to respond to - lets them accept straight from Discovery instead of
  // having to separately find it in My Requests.
  teamBroadcasts?: IncomingBroadcast[]
  onClose: () => void
  onSent: () => void
  // Called after accepting/countering a team broadcast from this modal, so the parent page can
  // refresh My Requests / the incoming-broadcasts list the same way it does after a normal send.
  onBroadcastHandled?: () => void
  onFallbackToEmail: () => void
}) {
  const { showToast } = useToast()
  const { user } = useAuth()
  const [respondingBroadcastId, setRespondingBroadcastId] = useState<string | null>(null)
  const [localBroadcasts, setLocalBroadcasts] = useState(teamBroadcasts)
  const [date, setDate] = useState(initialDate || '')
  const [startTime, setStartTime] = useState('13:00')
  const [endTime, setEndTime] = useState('16:00')
  const [showSecondSlot, setShowSecondSlot] = useState(false)
  const [date2, setDate2] = useState('')
  const [startTime2, setStartTime2] = useState('13:00')
  const [endTime2, setEndTime2] = useState('16:00')

  const agentName = user?.first_name || 'there'
  const address = property.Street || 'this listing'
  const premadeMessages = [
    `Hi, I'm ${agentName}. I'd love to host the open house at ${address} if you're looking for help.`,
    `Hello, this is ${agentName}. I'd be glad to host an open house at ${address} if you need an extra hand.`,
    `Hi there, I'm ${agentName}, and I'd welcome the opportunity to host your open house at ${address}.`,
    `Hi, ${agentName} here. I'd love to help by hosting an open house at ${address} if you're open to it.`,
    `Hello, I'm ${agentName}. If you're looking for someone to host ${address}, I'd be happy to help out!`,
  ]
  const [message, setMessage] = useState(
    () => premadeMessages[Math.floor(Math.random() * premadeMessages.length)]
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStartTimeChange = (value: string) => {
    setStartTime(value)
    if (!endTimeOptionsFor(value).some(opt => opt.value === endTime)) setEndTime('')
  }

  const handleStartTime2Change = (value: string) => {
    setStartTime2(value)
    if (!endTimeOptionsFor(value).some(opt => opt.value === endTime2)) setEndTime2('')
  }

  const handleSubmit = async () => {
    if (!date || !startTime || !endTime) {
      showToast('Please choose a date and time.', 'error')
      return
    }
    if (showSecondSlot && (!date2 || !startTime2 || !endTime2)) {
      showToast('Please choose a date and time for the second open, or remove it.', 'error')
      return
    }
    if (showSecondSlot && date2 === date) {
      showToast('The second open needs a different date than the first - please pick another date.', 'error')
      return
    }

    setIsSubmitting(true)
    // Shared only when offering a second slot, so the backend can fold both into one
    // notification/badge count instead of two - see CreateHostRequestPayload.group_id.
    const groupId = showSecondSlot ? crypto.randomUUID() : undefined
    const { success, data, error } = await api.openHouseManager.createRequest({
      listing_key: property.ListingKey,
      requested_date: date,
      requested_start_time: `${startTime}:00`,
      requested_end_time: `${endTime}:00`,
      message: message.trim() || undefined,
      group_id: groupId,
    })

    if (!success || !data) {
      setIsSubmitting(false)
      showToast(error || 'Unable to submit this request right now.', 'error')
      return
    }

    if (!data.on_platform) {
      setIsSubmitting(false)
      showToast("This listing agent doesn't use OpenHousePal yet - here's an email template instead.", 'success')
      onFallbackToEmail()
      return
    }

    if (showSecondSlot) {
      const second = await api.openHouseManager.createRequest({
        listing_key: property.ListingKey,
        requested_date: date2,
        requested_start_time: `${startTime2}:00`,
        requested_end_time: `${endTime2}:00`,
        message: message.trim() || undefined,
        group_id: groupId,
      })
      setIsSubmitting(false)
      if (!second.success) {
        showToast('First date was sent, but the second date failed to send.', 'error')
        onSent()
        return
      }
      showToast('Both requests sent! The listing agent will be notified.', 'success')
      onSent()
      return
    }

    setIsSubmitting(false)
    showToast('Request sent! The listing agent will be notified.', 'success')
    onSent()
  }

  const hasScheduledOpens = scheduledOpens.length > 0
  const hasTeamBroadcasts = localBroadcasts.length > 0
  const sortedScheduledOpens = [...scheduledOpens].sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
  const takenDates = new Set(scheduledOpens.map(o => o.scheduled_date).filter((d): d is string => !!d))
  // Coming Soon: nothing before the day it goes active (Bright allows no showings until then).
  const comingSoonFrom: string | undefined = property.HostsFrom && property.HostsFrom > todayLocal() ? property.HostsFrom : undefined
  // The second open's picker also crosses out whatever was picked for the first open - two
  // requests for the same date isn't a real "second open," and the first date isn't in
  // scheduledOpens (it's not booked yet, just already chosen on this form).
  const takenDatesForSecond = new Set(takenDates)
  if (date) takenDatesForSecond.add(date)

  const handleAcceptBroadcast = async (broadcastId: string) => {
    setRespondingBroadcastId(broadcastId)
    const { success, error } = await api.openHouseManager.respondToBroadcast(broadcastId)
    setRespondingBroadcastId(null)
    if (success) {
      setLocalBroadcasts(prev => prev.filter(b => b.id !== broadcastId))
      showToast("You're confirmed to host!", 'success')
      refreshOpenHouseActionCounts()
      onBroadcastHandled?.()
    } else {
      showToast(error || 'Unable to send your response right now.', 'error')
    }
  }

  const handleCounterBroadcast = async (broadcastId: string, date: string, start: string, end: string, note: string) => {
    setRespondingBroadcastId(broadcastId)
    const { success, error } = await api.openHouseManager.respondToBroadcast(broadcastId, {
      proposed_date: date, proposed_start_time: start, proposed_end_time: end, note: note || undefined,
    })
    setRespondingBroadcastId(null)
    if (success) {
      setLocalBroadcasts(prev => prev.filter(b => b.id !== broadcastId))
      showToast('Proposed time sent to the listing agent.', 'success')
      refreshOpenHouseActionCounts()
      onBroadcastHandled?.()
    } else {
      showToast(error || 'Unable to send your response right now.', 'error')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`bg-white dark:bg-[#1A1A1C] w-full ${hasScheduledOpens || hasTeamBroadcasts ? 'max-w-3xl' : 'max-w-md'} rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
        {hasTeamBroadcasts && (
          <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 bg-[#C9A24D]/5 p-5 overflow-y-auto max-h-[40vh]">
            <span className="flex items-center gap-1.5 text-[10px] font-black text-[#8b7355] dark:text-[#e8cf8a] uppercase tracking-widest mb-3">
              <Users size={12} /> Your Open House Team Needs a Host
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              {localBroadcasts.map(broadcast => (
                <BroadcastCard key={broadcast.id} broadcast={broadcast} onAccept={handleAcceptBroadcast} onCounter={handleCounterBroadcast} busy={respondingBroadcastId} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {hasScheduledOpens && (
          <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0B0B0B]/50 p-6 overflow-y-auto">
            <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
              <CalendarCheck size={12} className="text-emerald-500" /> Already Scheduled
            </span>
            {/* flex-wrap instead of one-per-row - on mobile (full width) several chips share a
                row instead of each eating the whole width; on desktop's narrow 224px column they
                still end up basically one-per-line on their own since there's no room to wrap. */}
            <div className="flex flex-wrap gap-2">
              {sortedScheduledOpens.map((open, i) => (
                <div key={i} className="inline-flex flex-col rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 px-3 py-2">
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatShortDateWithDay(open.scheduled_date)}</p>
                  {(open.scheduled_start_time || open.scheduled_end_time) && (
                    <p className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/70 whitespace-nowrap">
                      {formatTime(open.scheduled_start_time) || 'TBD'}{open.scheduled_end_time ? ` - ${formatTime(open.scheduled_end_time)}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-gray-50 dark:border-gray-800/50 flex items-center justify-between bg-gray-50/50 dark:bg-[#0B0B0B]/50">
          <div>
            <h3 className="text-lg font-black text-[#111827] dark:text-white uppercase tracking-tight">Request to Host</h3>
            <p className="truncate text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[280px]">{property.Street}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Calendar size={11} /> Date</span>
            <div className="mt-2">
              <TakenDatesPicker
                value={date}
                onChange={setDate}
                takenDates={takenDates}
                minDate={comingSoonFrom}
                buttonClassName="flex w-full items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-left text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white"
              />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Clock size={11} /> Start</span>
              <TimeSelect
                value={startTime}
                onChange={handleStartTimeChange}
                options={TIME_SLOT_OPTIONS}
                placeholder="Start"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Clock size={11} /> End</span>
              <TimeSelect
                value={endTime}
                onChange={setEndTime}
                options={endTimeOptionsFor(startTime)}
                placeholder="End"
                disabled={!startTime}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white disabled:opacity-50"
              />
            </label>
          </div>

          {/* Offer a Second Open only applies to the general "Request to Host" entry point - when
              this modal was opened from clicking a specific weekend-calendar date instead, the
              agent already committed to that one date and a second-date offer doesn't belong. */}
          {initialDate ? null : showSecondSlot ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Second Open</span>
                <button
                  type="button"
                  onClick={() => { setShowSecondSlot(false); setDate2(''); }}
                  className="text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-red-500"
                >
                  Remove
                </button>
              </div>
              <label className="block">
                <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Calendar size={11} /> Date</span>
                <div className="mt-2">
                  <TakenDatesPicker
                    value={date2}
                    onChange={setDate2}
                    takenDates={takenDatesForSecond}
                    minDate={comingSoonFrom}
                    buttonClassName="flex w-full items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-left text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white"
                  />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Clock size={11} /> Start</span>
                  <TimeSelect
                    value={startTime2}
                    onChange={handleStartTime2Change}
                    options={TIME_SLOT_OPTIONS}
                    placeholder="Start"
                    className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Clock size={11} /> End</span>
                  <TimeSelect
                    value={endTime2}
                    onChange={setEndTime2}
                    options={endTimeOptionsFor(startTime2)}
                    placeholder="End"
                    disabled={!startTime2}
                    className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white disabled:opacity-50"
                  />
                </label>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSecondSlot(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] transition-colors"
            >
              <Plus size={12} /> Offer a Second Open
            </button>
          )}

          <label className="block">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message (optional)</span>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Introduce yourself and why you'd like to host..."
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white"
            />
          </label>
        </div>

        <div className="p-6 bg-gray-50/50 dark:bg-[#0B0B0B]/50 border-t border-gray-50 dark:border-gray-800/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C9A24D] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-[#C9A24D]/30 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {showSecondSlot ? 'Send 2 Requests' : 'Send Request'}
          </button>
        </div>
        </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
