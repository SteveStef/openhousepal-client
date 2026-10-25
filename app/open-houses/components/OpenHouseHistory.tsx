'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, ClipboardCheck, UserX } from 'lucide-react'
import NumberPager, { scrollListTop } from '@/components/ui/NumberPager'
import { useIsPhone } from '@/components/ui/windowMotion'
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
        onTouchStart={() => { /* lets iPhone Safari show the :active "pressed" look */ }}
        title={label}
        // A raised key you can press (user, 10/24): light top edge, a solid "base" under it, and
        // it sinks onto that base when tapped. Shadows only - the pill keeps its exact size.
        className="flex shrink-0 select-none items-center gap-1.5 rounded-lg border border-[#C9A24D]/30 bg-gradient-to-b from-white to-[#f6efe1] px-2 py-1 shadow-[0_2px_0_0_rgba(185,150,80,0.45),0_7px_14px_-9px_rgba(139,115,85,0.7),inset_0_1px_0_rgba(255,255,255,0.95)] transition-[transform,box-shadow,border-color] duration-150 ease-out [-webkit-tap-highlight-color:transparent] hover:-translate-y-px hover:border-[#C9A24D]/70 hover:shadow-[0_3px_0_0_rgba(185,150,80,0.5),0_10px_18px_-10px_rgba(139,115,85,0.8),inset_0_1px_0_rgba(255,255,255,0.95)] active:translate-y-[2px] active:shadow-[0_0_0_0_rgba(185,150,80,0.45),0_2px_5px_-3px_rgba(139,115,85,0.6),inset_0_2px_3px_rgba(139,115,85,0.15)] dark:border-white/15 dark:from-[#202024] dark:to-[#141416] dark:shadow-[0_2px_0_0_rgba(0,0,0,0.75),0_7px_14px_-9px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] dark:hover:border-[#C9A24D]/50 dark:active:shadow-[0_0_0_0_rgba(0,0,0,0.7),inset_0_2px_3px_rgba(0,0,0,0.5)] sm:gap-2 sm:rounded-xl sm:px-3 sm:py-1.5"
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
  const [pageDir, setPageDir] = useState(1)
  // Phones: 4 per page (one column); computers: 6 (three rows of two).
  const phone = useIsPhone()
  const itemsPerPage = phone ? 4 : 6
  const listTop = useRef<HTMLDivElement>(null)
  const goToPage = (n: number) => {
    setPageDir(n > currentPage ? 1 : -1)
    setCurrentPage(n)
    scrollListTop(listTop.current)
  }

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
  // A delete (or a narrower screen) can leave us past the last page - step back onto it.
  useEffect(() => { if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages) }, [currentPage, totalPages])
  const paginatedOpenHouses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredOpenHouses.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredOpenHouses, currentPage, itemsPerPage])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4 mb-3">
        {/* Phones: title left, the listing count on the far right of the same line; the stats and
            the search box centered under it (user, 10/17). */}
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
          <h2 className="font-serif text-2xl font-black text-[#111827] dark:text-white">Your Opens</h2>
          <span className="rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#e8c97a]">
            {openHouses.length} {openHouses.length === 1 ? 'Listing' : 'Listings'}
          </span>
        </div>

        {/* Sign-in stats - only sign-ins/guests scanned from an actual open house */}
        {statSummary && (
          <div className="flex w-full flex-col items-center gap-1 sm:w-auto">
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
        <div className="relative mx-auto w-full max-w-md sm:mx-0 sm:w-80">
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

      <div className={isLoadingHistory ? 'min-h-[400px]' : ''}>
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
          <div ref={listTop} className="scroll-mt-24">
            {/* A page slides in the way you moved; inside a page, a removed card collapses away and
                the rest glide up into its place (no reload, no jump - user, 10/24). */}
            <div className="relative overflow-x-clip">
              <AnimatePresence mode="popLayout" initial={false} custom={pageDir}>
                <motion.div
                  key={currentPage}
                  custom={pageDir}
                  initial={{ opacity: 0, x: pageDir * 48 }}
                  animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 360, damping: 36 } }}
                  exit={{ opacity: 0, x: pageDir * -36, transition: { duration: 0.16 } }}
                  className="relative grid grid-cols-1 lg:grid-cols-2 gap-x-6"
                >
                  <AnimatePresence initial={false}>
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
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>
            </div>

            <NumberPager
              page={currentPage - 1}
              pages={totalPages}
              onChange={n => goToPage(n + 1)}
              total={filteredOpenHouses.length}
              size={itemsPerPage}
              className="pt-2"
            />
          </div>
        )}
      </div>
    </div>
  )
}
