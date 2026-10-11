'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, X, Loader2, Calendar, Users, UserX, CalendarCheck, ChevronDown, ChevronUp, Home, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api-service'
import { ListingDetail, ScheduledOpen } from '@/types'
import EmptyState from './EmptyState'
import GuestDetailsToggle from './GuestDetailsToggle'
import SummaryMetricCard from './SummaryMetricCard'
import WeekendCalendarCards from './WeekendCalendarCards'
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
  // History can run long over time - paginate instead of one long scrolling list.
  const HISTORY_PAGE_SIZE = 4
  const [historyPage, setHistoryPage] = useState(1)

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
    setHistoryPage(1)
  }, [listingKey])

  const allOpens: ScheduledOpen[] = detail ? [...detail.scheduled_opens, ...detail.confirmed_pending_kit] : []
  // A reusable kit whose own date got cleared back to "evergreen" (see cancel_approved_open) isn't
  // scheduled for anything specific, so it doesn't belong in a list titled "Scheduled Opens."
  const datedOpens = allOpens.filter(o => o.scheduled_date)

  return (
    <AnimatePresence>
      {listingKey && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#0B0B0B] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
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
                    {datedOpens.length} Events
                  </span>
                </div>
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-400">This weekend / Next weekend</p>
                <WeekendCalendarCards opens={allOpens} />

                {datedOpens.length === 0 ? (
                  <div className="mt-3"><EmptyState icon={CalendarCheck} title="No opens scheduled" description="Once a host is confirmed for a date, it'll show up here." /></div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {datedOpens
                      .sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''))
                      .map(open => {
                        const duration = formatDuration(open.scheduled_start_time, open.scheduled_end_time)
                        const startTime = formatTime(open.scheduled_start_time)
                        const endTime = formatTime(open.scheduled_end_time)
                        return (
                          <div key={open.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/5 p-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#C9A24D]/15 text-[#C9A24D]"><Calendar size={15} /></div>
                              <div>
                                <p className="text-sm font-black text-[#111827] dark:text-white">{formatEventDate(open.scheduled_date)}</p>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Hosted by {open.hosting_agent_name}</p>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {startTime && endTime && (
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{startTime} - {endTime}</span>
                              )}
                              {duration && <span className="text-[10px] font-semibold text-gray-400">{duration}</span>}
                              {!open.kit_built && (
                                <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
                                  Kit Not Built Yet
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Key Metrics</h3>
                <div className="grid grid-cols-3 gap-3">
                  <SummaryMetricCard accent="blue" icon={Users} label="Total Guests" value={detail.key_metrics.total_guests} />
                  <SummaryMetricCard accent="red" icon={UserX} label="Unrepresented Guests" value={detail.key_metrics.unrepresented_guests} />
                  <SummaryMetricCard accent="green" icon={CalendarCheck} label="Total Opens Hosted" value={detail.key_metrics.total_opens_hosted} highlight />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-[#111827] dark:text-white">Breakdown &amp; History</h3>
                {detail.history.length === 0 ? (
                  <EmptyState icon={Users} title="No completed opens yet" description="Once open houses here wrap up, their guest breakdown will show here." />
                ) : (
                  <div className="space-y-2">
                    {detail.history.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE).map(row => {
                      const isExpanded = expandedId === row.id
                      const duration = formatDuration(row.start_time, row.end_time)
                      return (
                        <div key={`${row.id}-${row.event_date}`} className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
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
                              <div className="col-span-2 sm:col-span-4">
                                {row.share_guests_enabled ? (
                                  <GuestDetailsToggle eventId={row.id} windowDate={row.event_date} />
                                ) : (
                                  <p className="text-[10px] font-medium text-gray-400">Guest details are private unless {row.hosting_agent_name} chooses to share them.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {detail.history.length > HISTORY_PAGE_SIZE && (() => {
                  const totalPages = Math.ceil(detail.history.length / HISTORY_PAGE_SIZE)
                  return (
                    <div className="mt-3 flex items-center justify-center gap-1">
                      <button
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          onClick={() => setHistoryPage(n)}
                          className={`h-7 min-w-[1.75rem] rounded-lg px-1.5 text-xs font-black transition ${
                            n === historyPage ? 'bg-[#C9A24D] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                        disabled={historyPage === totalPages}
                        className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
                        aria-label="Next page"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )
                })()}
              </section>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}
