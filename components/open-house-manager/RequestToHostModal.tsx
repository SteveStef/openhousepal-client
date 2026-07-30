'use client'

import { useState } from 'react'
import { X, Calendar, Clock, Send, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'

export default function RequestToHostModal({
  property,
  onClose,
  onSent,
  onFallbackToEmail,
}: {
  property: any
  onClose: () => void
  onSent: () => void
  onFallbackToEmail: () => void
}) {
  const { showToast } = useToast()
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('13:00')
  const [endTime, setEndTime] = useState('16:00')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!date || !startTime || !endTime) {
      showToast('Please choose a date and time.', 'error')
      return
    }
    setIsSubmitting(true)
    const { success, data, error } = await api.openHouseManager.createRequest({
      listing_key: property.ListingKey,
      requested_date: date,
      requested_start_time: `${startTime}:00`,
      requested_end_time: `${endTime}:00`,
      message: message.trim() || undefined,
    })
    setIsSubmitting(false)

    if (!success || !data) {
      showToast(error || 'Unable to submit this request right now.', 'error')
      return
    }

    if (!data.on_platform) {
      showToast("This listing agent doesn't use OpenHousePal yet - here's an email template instead.", 'success')
      onFallbackToEmail()
      return
    }

    showToast('Request sent! The listing agent will be notified.', 'success')
    onSent()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A1A1C] w-full max-w-md rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Clock size={11} /> Start</span>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest"><Clock size={11} /> End</span>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B] px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:text-white"
              />
            </label>
          </div>

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
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Request
          </button>
        </div>
      </div>
    </div>
  )
}
