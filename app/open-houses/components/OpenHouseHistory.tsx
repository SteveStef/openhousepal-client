'use client'

import { useState, useMemo } from 'react'
import { OpenHouseCard } from './OpenHouseCard'
import { OpenHouse } from '@/types'

interface OpenHouseHistoryProps {
  openHouses: OpenHouse[];
  isLoadingHistory: boolean;
  onViewVisitors: (openHouse: OpenHouse) => void;
  onOpenViewPDFs: (openHouse: OpenHouse) => void;
  onDeleteClick: (openHouse: OpenHouse) => void;
  onOpenNoteModal: (openHouse: OpenHouse) => void;
  formatAddress: (address: string) => string;
}

export function OpenHouseHistory({
  openHouses,
  isLoadingHistory,
  onViewVisitors,
  onOpenViewPDFs,
  onDeleteClick,
  onOpenNoteModal,
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
    <div className="mt-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Your Portfolio</h2>
          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-bold border border-gray-200 dark:border-gray-700">
            {openHouses.length} Listings
          </span>
        </div>

        {/* Portfolio Filter Search */}
        <div className="relative max-w-md w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search your portfolio..."
            value={filterQuery}
            onChange={(e) => {
              setFilterQuery(e.target.value)
              setCurrentPage(1) // Reset to first page on search
            }}
            className="block w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all"
          />
        </div>
      </div>

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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" />
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
