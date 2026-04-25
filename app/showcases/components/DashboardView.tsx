'use client'

import { useState, useMemo, memo } from 'react'
import CollectionCard from '@/components/CollectionCard'
import { Collection } from '@/types'

interface DashboardViewProps {
  collections: Collection[];
  isLoading: boolean;
  onCreateClick: () => void;
  onCollectionClick: (collection: Collection) => void;
  onShare: (collection: Collection) => void;
  onEditPreferences: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
  onStatusToggle: (collectionId: string) => void;
  formatPriceRange: (priceRange: string) => string;
}

export const DashboardView = memo(function DashboardView({
  collections,
  isLoading,
  onCreateClick,
  onCollectionClick,
  onShare,
  onEditPreferences,
  onDelete,
  onStatusToggle,
  formatPriceRange
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  const filteredCollections = useMemo(() => {
    return collections.filter(collection => {
      const matchesSearch =
        collection.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.customer.email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === 'ALL' || collection.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [collections, searchTerm, statusFilter])

  return (
    <div className="flex-1 p-6 pb-20 sm:pb-32">
      <div className="max-w-7xl mx-auto">
        {/* Combined Header and Filters */}
        <div className="bg-white/50 dark:bg-[#151517]/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6 mb-8">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4">
            <div className="flex-1 mb-4 lg:mb-0">
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Showcases</h1>
              <p className="text-[#6B7280] dark:text-gray-400 font-medium text-sm">Manage customer property showcases and preferences</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                onClick={onCreateClick}
                className="px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-[0_0_20px_rgba(201,162,77,0.2)] hover:scale-[1.02] transform border-2 bg-[#111827] dark:bg-white text-white dark:text-[#111827] border-[#C9A24D]/20 hover:border-[#C9A24D] hover:bg-[#1a2333] dark:hover:bg-[#f0f0f0]"
              >
                <svg className="w-3.5 h-3.5 text-[#C9A24D] transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="tracking-widest uppercase">Create Showcase</span>
              </button>
            </div>
          </div>
          
          {/* Filters Section */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-black text-[#0B0B0B] dark:text-white uppercase tracking-[0.2em]">Filter Showcases</h3>
              <div className="flex items-center space-x-4">
                <span className="text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">
                  {filteredCollections.length} results
                </span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-500 group-focus-within:text-[#C9A24D] transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 focus:border-[#C9A24D] transition-all duration-300 text-sm shadow-sm"
                />
              </div>
              <div className="sm:w-48 relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-4 py-2 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 focus:border-[#C9A24D] transition-all duration-300 text-sm shadow-sm appearance-none font-bold cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Showcases Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading showcases...</p>
            </div>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-24 bg-white/50 dark:bg-[#151517]/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="w-20 h-20 bg-white dark:bg-[#0B0B0B] rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100 dark:border-gray-800">
              <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No showcases found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">We couldn't find any showcases matching your filters. Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onClick={() => onCollectionClick(collection)}
                onShare={onShare}
                onEditPreferences={onEditPreferences}
                onDelete={() => onDelete(collection)}
                onStatusToggle={() => onStatusToggle(collection.id)}
                formatPriceRange={formatPriceRange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
