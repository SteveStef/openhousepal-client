'use client'

import { useState, useMemo, memo } from 'react'
import { Collection } from '@/types'
import { Share2, Edit3, Trash2, Mail, Phone, Check } from 'lucide-react'

// --- HELPERS ---
const formatLocation = (name: string) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface DashboardViewProps {
  collections: Collection[];
  isLoading: boolean;
  onCreateClick: () => void;
  onCollectionClick: (collection: Collection) => void;
  onShare: (collection: Collection) => void;
  onEditPreferences: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
  onStatusToggle: (collectionId: string) => void;
  onDismissNew: (collectionId: string) => void;
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
  onDismissNew,
  formatPriceRange
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [locationFilter, setLocationFilter] = useState('')
  const [budgetFilter, setBudgetFilter] = useState('ALL')

  const filteredCollections = useMemo(() => {
    return collections.filter(collection => {
      const prefs = collection.preferences as any
      // Basic Search
      const matchesSearch =
        collection.customer.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.customer.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.customer.email.toLowerCase().includes(searchTerm.toLowerCase())

      // Status Filter
      const matchesStatus = statusFilter === 'ALL' || collection.status === statusFilter

      // Location Filter Logic
      let displayLocations: string[] = [
        ...(prefs?.cities || []),
        ...(prefs?.townships || []),
        ...(prefs?.school_districts || [])
      ].map(formatLocation)

      if (displayLocations.length === 0 && prefs?.address) {
        const parts = prefs.address.split(',')
        if (parts.length >= 2) {
          const parsedCity = parts[1].trim()
          if (parsedCity) displayLocations = [formatLocation(parsedCity)]
        }
      }
      
      const matchesLocation = locationFilter === '' || 
        displayLocations.some((l: string) => l.toLowerCase().includes(locationFilter.toLowerCase()))

      // Budget Filter Logic (Numeric Buckets)
      let matchesBudget = true
      if (budgetFilter !== 'ALL') {
        const minPrice = prefs?.min_price || 0
        const maxPrice = prefs?.max_price || Infinity

        if (budgetFilter === 'UNDER_500') {
          matchesBudget = minPrice < 500000
        } else if (budgetFilter === '500_1000') {
          // Overlaps with 500k-1M range
          matchesBudget = minPrice < 1000000 && maxPrice >= 500000
        } else if (budgetFilter === '1000_1500') {
          // Overlaps with 1M-1.5M range
          matchesBudget = minPrice < 1500000 && maxPrice >= 1000000
        } else if (budgetFilter === '1500_2500') {
          // Overlaps with 1.5M-2.5M range
          matchesBudget = minPrice < 2500000 && maxPrice >= 1500000
        } else if (budgetFilter === 'OVER_2500') {
          matchesBudget = maxPrice >= 2500000
        }
      }

      return matchesSearch && matchesStatus && matchesLocation && matchesBudget
    })
    .sort((a, b) => {
      // Primary sort: New Properties (descending)
      if (b.stats.newProperties !== a.stats.newProperties) {
        return b.stats.newProperties - a.stats.newProperties;
      }
      // Secondary sort: Created Date (descending)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
  }, [collections, searchTerm, statusFilter, locationFilter, budgetFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
    }
  }

  return (
    <div className="flex-1 p-6 pb-20 sm:pb-32">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between">
            <div className="flex-1 mb-4 lg:mb-0">
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Showcases</h1>
              <p className="text-[#6B7280] dark:text-gray-400 font-medium text-sm">Manage customer property showcases and preferences</p>
            </div>
            <button
              onClick={onCreateClick}
              className="px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-[0_0_20px_rgba(201,162,77,0.2)] hover:scale-[1.02] transform border-2 bg-[#111827] dark:bg-white text-white dark:text-[#111827] border-[#C9A24D]/20 hover:border-[#C9A24D] hover:bg-[#1a2333] dark:hover:bg-[#f0f0f0] self-start lg:self-center"
            >
              <svg className="w-3.5 h-3.5 text-[#C9A24D] transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="tracking-widest uppercase">Create Showcase</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters Row */}
        <div className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-[10px] font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em]">Filter Showcases</h3>
            <span className="text-[10px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-[#0B0B0B] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800">
              {filteredCollections.length} results
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative group">
              <input
                type="text"
                placeholder="Search Visitor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-4 py-2 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#C9A24D] transition-all text-xs"
              />
            </div>

            {/* Budget */}
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:border-[#C9A24D] transition-all text-xs cursor-pointer font-bold"
            >
              <option value="ALL">All Budgets</option>
              <option value="UNDER_500">Under $500K</option>
              <option value="500_1000">$500K - $1M</option>
              <option value="1000_1500">$1M - $1.5M</option>
              <option value="1500_2500">$1.5M - $2.5M</option>
              <option value="OVER_2500">$2.5M+</option>
            </select>

            {/* Location */}
            <input
              type="text"
              placeholder="Filter Location..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#C9A24D] transition-all text-xs"
            />

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:border-[#C9A24D] transition-all text-xs cursor-pointer font-bold"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading showcases...</p>
            </div>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-24 bg-white/50 dark:bg-[#151517]/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No showcases found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-[#FAFAF7] dark:bg-[#0B0B0B]">
                    <th className="px-6 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em]">Visitor</th>
                    <th className="px-6 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em]">Contact</th>
                    <th className="px-6 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em] min-w-[160px]">Budget</th>
                    <th className="px-6 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em]">Location</th>
                    <th className="px-2 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em] w-28">Listings</th>
                    <th className="px-6 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em]">New</th>
                    <th className="px-6 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredCollections.map((collection, index) => {
                    const prefs = collection.preferences as any
                    
                    let displayLocations: string[] = [
                      ...(prefs?.cities || []),
                      ...(prefs?.townships || []),
                      ...(prefs?.school_districts || [])
                    ].map(formatLocation)

                    if (displayLocations.length === 0 && prefs?.address) {
                      const parts = prefs.address.split(',')
                      if (parts.length >= 2) {
                        const parsedCity = parts[1].trim()
                        if (parsedCity) displayLocations = [formatLocation(parsedCity)]
                      }
                    }
                    
                    return (
                      <tr 
                        key={collection.id} 
                        onClick={() => onCollectionClick(collection)}
                        className="group hover:bg-[#FAFAF7] dark:hover:bg-[#1A1A1C] transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-6">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-[#111827] dark:bg-white rounded-full flex items-center justify-center text-xs font-black text-white dark:text-[#111827]">
                              {collection.customer.firstName.charAt(0)}{collection.customer.lastName.charAt(0)}
                            </div>
                            <div>
                              <div className="text-base font-black text-[#0B0B0B] dark:text-white group-hover:text-[#C9A24D] transition-colors leading-tight">
                                {collection.customer.firstName} {collection.customer.lastName}
                              </div>
                              <div className="text-xs font-bold text-[#C9A24D] uppercase tracking-widest mt-0.5">
                                #{index + 1}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="space-y-1.5">
                            <div className="flex items-center text-xs font-bold text-[#6B7280] dark:text-gray-400">
                              <Mail size={14} className="mr-2 opacity-50" />
                              {collection.customer.email}
                            </div>
                            <div className="flex items-center text-xs font-bold text-[#6B7280] dark:text-gray-400">
                              <Phone size={14} className="mr-2 opacity-50" />
                              {collection.customer.phone}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <span className="text-sm font-black text-[#C9A24D]">
                            {(collection.preferences && 'priceRange' in collection.preferences && collection.preferences.priceRange !== 'Not specified') 
                              ? formatPriceRange(collection.preferences.priceRange) 
                              : 'Not Specified'}
                          </span>
                        </td>
                        <td className="px-6 py-6">
                          <div 
                            className="flex items-center gap-2 max-w-[140px]" 
                            title={displayLocations.join(', ')}
                          >
                            {displayLocations.length > 0 ? (
                              <>
                                <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 truncate">
                                  {displayLocations[0]}
                                </span>
                                {displayLocations.length > 1 && (
                                  <span className="flex-shrink-0 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-black text-gray-400 border border-gray-200 dark:border-gray-700">
                                    +{displayLocations.length - 1}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs font-bold text-gray-400">Any</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-6">
                          <div className="flex items-baseline">
                            <span className="text-base font-black text-[#0B0B0B] dark:text-white">
                              {collection.stats.activeProperties}
                            </span>
                            <span className="ml-1 text-xs font-bold text-[#6B7280] dark:text-gray-500">
                              / {collection.stats.totalProperties}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="flex items-center space-x-2">
                            {collection.stats.newProperties > 0 ? (
                              <>
                                <span className="px-2 py-0.5 bg-[#C9A24D] text-white text-[10px] font-black rounded-full shadow-[0_0_10px_rgba(201,162,77,0.3)] animate-pulse whitespace-nowrap">
                                  {collection.stats.newProperties} NEW
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDismissNew(collection.id); }}
                                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-all"
                                  title="Dismiss New Listings"
                                >
                                  <Check size={14} />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs font-bold text-gray-300 dark:text-gray-700">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-6 text-right">
                          <div className="flex items-center justify-end space-x-3 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEditPreferences(collection); }}
                              className="p-2 text-gray-400 hover:text-[#C9A24D] hover:bg-[#C9A24D]/5 rounded-xl transition-all"
                              title="Edit Preferences"
                            >
                              <Edit3 size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onShare(collection); }}
                              className="p-2 text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                              title="Share Showcase"
                            >
                              <Share2 size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDelete(collection); }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                            <div className="w-px h-5 bg-gray-100 dark:bg-gray-800 mx-1"></div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onStatusToggle(collection.id); }}
                              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${getStatusColor(collection.status)}`}
                            >
                              {collection.status === 'ACTIVE' ? 'Off' : 'On'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

