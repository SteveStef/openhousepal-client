'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, X, Loader2, Inbox, History, Users, Home, Star, Save, AlertTriangle } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { ListingDetail } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'
import { formatEventDate, formatDuration } from './formatters'

export default function ManageHostsModal({
  listingKey,
  onClose,
  onActionComplete,
}: {
  listingKey: string | null
  onClose: () => void
  onActionComplete: () => void
}) {
  const { showToast } = useToast()
  const [detail, setDetail] = useState<ListingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [priorityOverride, setPriorityOverride] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  const load = async (key: string) => {
    setIsLoading(true)
    setLoadError('')
    const { success, data, error } = await api.openHouseManager.getListingDetail(key)
    if (success && data) {
      setDetail(data)
      setNotesDraft(data.notes.notes || '')
      setPriorityOverride(data.notes.is_priority_override)
    } else {
      setLoadError(error || 'Unable to load this listing right now.')
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (listingKey) load(listingKey)
  }, [listingKey])

  const handleApprove = async (id: string) => {
    const { success, error } = await api.openHouseManager.approveRequest(id)
    if (success) {
      showToast('Request approved - open house scheduled.', 'success')
      if (listingKey) await load(listingKey)
      onActionComplete()
    } else {
      showToast(error || 'Failed to approve this request.', 'error')
    }
  }

  const handleDecline = async (id: string) => {
    const { success, error } = await api.openHouseManager.declineRequest(id)
    if (success) {
      showToast('Request declined.', 'success')
      if (listingKey) await load(listingKey)
      onActionComplete()
    } else {
      showToast(error || 'Failed to decline this request.', 'error')
    }
  }

  const handleCounter = async (id: string, counterDate: string, counterStart: string, counterEnd: string) => {
    const { success, error } = await api.openHouseManager.counterRequest(id, { counter_date: counterDate, counter_start_time: counterStart, counter_end_time: counterEnd })
    if (success) {
      showToast('Proposed a new time.', 'success')
      if (listingKey) await load(listingKey)
      onActionComplete()
    } else {
      showToast(error || 'Failed to propose a new time.', 'error')
    }
  }

  const handleSaveNotes = async () => {
    if (!listingKey) return
    setIsSavingNotes(true)
    const { success, data, error } = await api.openHouseManager.saveListingNotes(listingKey, {
      notes: notesDraft,
      is_priority_override: priorityOverride,
    })
    if (success && data) {
      setDetail(prev => prev ? { ...prev, notes: data } : prev)
      showToast('Host notes saved.', 'success')
      onActionComplete()
    } else {
      showToast(error || 'Failed to save notes.', 'error')
    }
    setIsSavingNotes(false)
  }

  if (!listingKey) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#0B0B0B] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 p-5">
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
            {detail?.image ? (
              <img src={detail.image} alt={detail.address || ''} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-700"><Home size={18} /></div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-black text-[#111827] dark:text-white">Open House Hosts</h2>
            <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{detail?.address || 'Loading...'}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load this listing" description={loadError} />
          ) : detail ? (
            <div className="space-y-8">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Inbox size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Requests to Host</h3>
                  {detail.pending_requests.length > 0 && (
                    <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black text-[#C9A24D]">{detail.pending_requests.length}</span>
                  )}
                </div>
                {detail.pending_requests.length === 0 ? (
                  <EmptyState icon={Inbox} title="No pending requests" description="No one has asked to host this listing yet." />
                ) : (
                  <div className="space-y-3">
                    {detail.pending_requests.map(request => (
                      <HostRequestCard key={request.id} request={request} onApprove={handleApprove} onDecline={handleDecline} onCounter={handleCounter} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <History size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Agents Who Have Hosted Here</h3>
                </div>
                {detail.history.length === 0 ? (
                  <EmptyState icon={Users} title="No hosting history yet" description="Once an open house happens here, hosting agents and their visitor stats will show up here." />
                ) : (
                  <div className="space-y-2">
                    {detail.history.map(row => {
                      const duration = formatDuration(row.start_time, row.end_time)
                      return (
                        <div key={row.id} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{row.hosting_agent_name}</p>
                              <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {row.hosting_agent_brokerage ? `${row.hosting_agent_brokerage} · ` : ''}{formatEventDate(row.event_date)}
                                {duration ? ` · ${duration}` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-xs font-bold text-gray-500 dark:text-gray-400">
                              <span>{row.total_guests} guests</span>
                              <span>{row.unrepresented_guests} unrep</span>
                              <span>{row.requested_updates} updates</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Host Notes</h3>
                  {detail.notes.updated_at && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Updated {new Date(detail.notes.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={5}
                  placeholder="Access instructions, lockbox/keypad code, parking, alarm, seller preferences, setup expectations, refreshments..."
                  className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] p-3 text-sm font-medium outline-none focus:border-[#C9A24D] dark:text-white"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setPriorityOverride(v => !v)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                      priorityOverride ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#C9A24D]' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Star size={11} fill={priorityOverride ? 'currentColor' : 'none'} /> Mark as high priority
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-4 py-2 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50"
                  >
                    {isSavingNotes ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Notes
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
