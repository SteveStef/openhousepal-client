'use client'

import { useState, useMemo } from 'react'
import { Home, ClipboardCheck, UserX } from 'lucide-react'
import { OpenHouseCard } from './OpenHouseCard'
import StatDetailModal from '@/components/stats/StatDetailModal'
import { GuestSettingsPatch, OpenHouse, StatMetric, StatSummary, StatSummaryEntry } from '@/types'

const EMPTY_ENTRY: StatSummaryEntry = { current: 0, previous: 0, percent: 0 }

// Deliberately not the full StatCard tile used on the main dashboard - this row has to live
// between the "Your Opens" title and the search box, so each stat is just an icon + number in
// a small pill (full label on hover/in the drilldown modal) to keep the whole row tight.
function CompactStat({ metric, label, shortLabel, icon: Icon, entry, isPercent }: {
  metric: StatMetric
  label: string
  shortLabel: string
  icon: React.ComponentType<{ className?: string }>
  entry: StatSummaryEntry
  isPercent?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#C9A24D]/20 bg-white px-2 py-1 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/60 hover:shadow-md dark:border-white/10 dark:bg-[#151517] sm:gap-2 sm:rounded-xl sm:px-3 sm:py-1.5"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#8b7355] sm:h-4 sm:w-4" />
        <span className="text-sm font-black leading-none text-[#111827] dark:text-white sm:text-base">{entry.current}{isPercent ? '%' : ''}</span>
        <span className="text-[9px] font-black uppercase leading-none tracking-wide text-gray-400 whitespace-nowrap sm:text-[11px]">
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
      </button>
      {open && <StatDetailModal metric={metric} label={label} isPercent={isPercent} onClose={() => setOpen(false)} />}
    </>
  )
}

interface OpenHouseHistoryProps {
  openHouses: OpenHouse[];
  isLoadingHistory: boolean;
  statSummary: StatSummary | null;
  onViewVisitors: (openHouse: OpenHouse) => void;
  onOpenViewPDFs: (openHouse: OpenHouse) => void;
  onDeleteClick: (openHouse: OpenHouse) => void;
  onOpenNoteModal: (openHouse: OpenHouse) => void;
  onOpenKiosk: (openHouse: OpenHouse) => void;
  onGuestSettings: (openHouse: OpenHouse, patch: GuestSettingsPatch) => void;
  formatAddress: (address: string) => string;
}

export function OpenHouseHistory({
  openHouses,
  isLoadingHistory,
  statSummary,
  onViewVisitors,
  onOpenViewPDFs,
  onDeleteClick,
  onOpenNoteModal,
  onOpenKiosk,
  onGuestSettings,
  formatAddress
}: OpenHouseHistoryProps) {
  const [filterQuery, setFilterQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  // Filter open houses based on search query
  const filteredOpenHouses = useMemo(() => {
    if (!filterQuery.trim()) return openHouses
    const query = filterQuery.toLowerCase().trim()
    return openHouses.filter(oh =>
      oh.address.toLowerCase().includes(query) ||
      (oh as any).notes?.toLowerCase().includes(query)
    )
  }, [openHouses, filterQuery])

  // Pagination logic
  const totalPages = Math.ceil(filteredOpenHouses.length / itemsPerPage)
  const paginatedOpenHouses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredOpenHouses.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredOpenHouses, currentPage])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 mb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-2xl font-black text-[#111827] dark:text-white">Your Opens</h2>
          <span className="rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#e8c97a]">
            {openHouses.length} Listings
          </span>
        </div>

        {/* Sign-in stats - only sign-ins/guests scanned from an actual open house */}
        {statSummary && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355]/80 dark:text-[#e8c97a]/70">
              Last 30 Days
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <CompactStat
                metric="open_house_signins"
                label="Guests"
                shortLabel="Guests"
                icon={Home}
                entry={statSummary.open_house_signins || EMPTY_ENTRY}
              />
              <CompactStat
                metric="open_house_signin_completion"
                label="Completion"
                shortLabel="Complete"
                icon={ClipboardCheck}
                entry={statSummary.open_house_signin_completion || EMPTY_ENTRY}
                isPercent
              />
              <CompactStat
                metric="open_house_unrepresented"
                label="Unrepresented"
                shortLabel="Unrep."
                icon={UserX}
                entry={statSummary.open_house_unrepresented || EMPTY_ENTRY}
              />
            </div>
          </div>
        )}

        {/* Opens Filter Search */}
        <div className="relative max-w-md w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search your opens..."
            value={filterQuery}
            onChange={(e) => {
              setFilterQuery(e.target.value)
              setCurrentPage(1) // Reset to first page on search
            }}
            className="block w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-semibold text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C9A24D]/20 focus:border-[#C9A24D] transition-all"
          />
        </div>
      </div>

      <div className="mb-5 h-px bg-gradient-to-r from-[#C9A24D]/55 via-[#C9A24D]/15 to-transparent" />

      <div className="min-h-[400px]">
        {isLoadingHistory ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-[#151517] rounded-2xl h-48 animate-pulse border border-gray-100 dark:border-gray-800"></div>
            ))}
          </div>
        ) : filteredOpenHouses.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#151517] rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
            <div className="w-12 h-12 bg-gray-50 dark:bg-[#0B0B0B] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {filterQuery ? 'No matching listings found' : 'Your portfolio is empty'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
              {filterQuery ? 'Try adjusting your search terms' : 'Use the generator above to create your first open house kit.'}
            </p>
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="mt-4 text-[#8b7355] hover:underline text-sm font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
              {paginatedOpenHouses.map((openHouse, index) => (
                <OpenHouseCard
                  key={openHouse.id}
                  openHouse={openHouse}
                  index={index}
                  onViewVisitors={onViewVisitors}
                  onViewPDF={() => onOpenViewPDFs(openHouse)}
                  onDelete={onDeleteClick}
                  onAddNote={onOpenNoteModal}
                  onOpenKiosk={onOpenKiosk}
                  onGuestSettings={onGuestSettings}
                  formatAddress={formatAddress}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 pt-6 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.max(1, prev - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#202022] hover:border-[#8b7355] dark:hover:border-[#C9A24D] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Page <span className="font-bold text-gray-900 dark:text-white">{currentPage}</span> of <span className="font-bold text-gray-900 dark:text-white">{totalPages}</span>
                </span>
                <button
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages, prev + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-[#202022] hover:border-[#8b7355] dark:hover:border-[#C9A24D] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
