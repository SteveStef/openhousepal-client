'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, X, Loader2, Calendar, Users, UserX, Bell, CalendarCheck, ChevronDown, ChevronUp, Home, AlertTriangle } from 'lucide-react'
import api from '@/lib/api-service'
import { ListingDetail } from '@/types'
import EmptyState from './EmptyState'
import SummaryMetricCard from './SummaryMetricCard'
import { formatEventDate, formatTime, formatDuration } from './formatters'

export default function OpenHouseInsightsModal({
  listingKey,
  onClose,
}: {
  listingKey: string | null
  onClose: () => void
}) {
  const [detail, setDetail] = useState<ListingDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!listingKey) return
    const load = async () => {
      setIsLoading(true)
      setLoadError('')
      const { success, data, error } = await api.openHouseManager.getListingDetail(listingKey)
      if (success && data) setDetail(data)
      else setLoadError(error || 'Unable to load insights for this listing right now.')
      setIsLoading(false)
    }
    load()
  }, [listingKey])

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
            <h2 className="truncate text-base font-black text-[#111827] dark:text-white">Open House Insights</h2>
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
            <EmptyState icon={AlertTriangle} title="Couldn't load insights" description={loadError} />
          ) : detail ? (
            <div className="space-y-8">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Calendar size={15} className="text-[#C9A24D]" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Scheduled Opens</h3>
                  <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-black text-gray-500 dark:text-gray-400">
                    {detail.scheduled_opens.length} Events
                  </span>
                </div>
                {detail.scheduled_opens.length === 0 ? (
                  <EmptyState icon={CalendarCheck} title="No opens scheduled" description="Approve a host request to get this listing on the calendar." />
                ) : (
                  <div className="space-y-2">
                    {detail.scheduled_opens.map(open => {
                      const duration = formatDuration(open.scheduled_start_time, open.scheduled_end_time)
                      return (
                        <div key={open.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/5 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C9A24D]/15 text-[#C9A24D]"><Calendar size={15} /></div>
                            <div>
                              <p className="text-sm font-black text-[#111827] dark:text-white">{formatEventDate(open.scheduled_date)}</p>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Hosted by {open.hosting_agent_name}</p>
                            </div>
                          </div>
                          {duration && <span className="shrink-0 text-xs font-bold text-gray-500 dark:text-gray-400">{duration}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Key Metrics</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <SummaryMetricCard icon={Users} label="Total Guests" value={detail.key_metrics.total_guests} />
                  <SummaryMetricCard icon={UserX} label="Unrepresented Guests" value={detail.key_metrics.unrepresented_guests} />
                  <SummaryMetricCard icon={Bell} label="Requested Updates" value={detail.key_metrics.requested_updates} />
                  <SummaryMetricCard icon={CalendarCheck} label="Total Opens Hosted" value={detail.key_metrics.total_opens_hosted} highlight />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Breakdown &amp; History</h3>
                {detail.history.length === 0 ? (
                  <EmptyState icon={Users} title="No completed opens yet" description="Once open houses here wrap up, their guest breakdown will show here." />
                ) : (
                  <div className="space-y-2">
                    {detail.history.map(row => {
                      const isExpanded = expandedId === row.id
                      const duration = formatDuration(row.start_time, row.end_time)
                      return (
                        <div key={row.id} className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="flex w-full items-center justify-between gap-3 p-3 text-left"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#111827] dark:text-white">{formatEventDate(row.event_date)}</p>
                              <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{row.hosting_agent_name}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-xs font-bold text-gray-500 dark:text-gray-400">
                              <span>{row.total_guests} Guests</span>
                              <span>{row.unrepresented_guests} Unrep</span>
                              <span>{row.requested_updates} Updates</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#0F0F11] p-3 text-xs sm:grid-cols-4">
                              <div>
                                <p className="font-bold uppercase tracking-widest text-gray-400">Hosting Agent</p>
                                <p className="mt-0.5 font-black text-[#111827] dark:text-white">{row.hosting_agent_name}</p>
                                {row.hosting_agent_brokerage && <p className="text-gray-500 dark:text-gray-400">{row.hosting_agent_brokerage}</p>}
                              </div>
                              <div>
                                <p className="font-bold uppercase tracking-widest text-gray-400">Duration</p>
                                <p className="mt-0.5 font-black text-[#111827] dark:text-white">{duration || 'Unknown'}</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase tracking-widest text-gray-400">Total Guests</p>
                                <p className="mt-0.5 font-black text-[#111827] dark:text-white">{row.total_guests}</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase tracking-widest text-gray-400">Unrepresented</p>
                                <p className="mt-0.5 font-black text-[#111827] dark:text-white">{row.unrepresented_guests}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
