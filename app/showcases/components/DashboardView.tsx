'use client'

import { useState, useMemo, memo } from 'react'
import { Collection } from '@/types'
import { Share2, Edit3, Trash2, Mail, Phone, Check, Users, Search, DollarSign, MapPin, Activity } from 'lucide-react'

// --- HELPERS ---
const timeAgo = (dateString?: string) => {
  if (!dateString) return null;
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now.getTime() - past.getTime();
  
  const seconds = Math.floor(diffInMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  
  return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatLocation = (name: string) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50',
    'bg-emerald-50 text-green-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50',
    'bg-violet-50 text-purple-700 border-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900/50',
    'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50',
    'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50',
    'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-900/50',
    'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-900/50',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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
        const address = prefs.address;
        const parts = address.split(',');
        if (parts.length >= 2) {
          const cityPart = parts[parts.length - 2].trim();
          if (cityPart) {
            if (cityPart.length === 2 && parts.length >= 3) {
              // We found a state code (e.g. "PA"), look at the segment before it
              const potentialCity = parts[parts.length - 3].trim();
              
              // If the segment is long (contains street info), take the last word
              if (potentialCity.split(' ').length > 2) {
                const words = potentialCity.split(' ');
                displayLocations = [formatLocation(words[words.length - 1])];
              } else {
                displayLocations = [formatLocation(potentialCity)];
              }
            } else {
              displayLocations = [formatLocation(cityPart)];
            }
          }
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
        <div className="bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6 mb-6 shadow-sm relative overflow-hidden">
          {/* Subtle Accent Bar */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C9A24D]" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between">
            <div className="flex items-center space-x-4 mb-4 lg:mb-0">
              <div className="p-3 bg-[#C9A24D]/10 rounded-xl">
                <Users size={24} className="text-[#C9A24D]" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Showcases</h1>
                  <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400 text-xs font-black rounded-full border border-gray-200 dark:border-gray-700">
                    {collections.length}
                  </span>
                </div>
                <p className="text-[#6B7280] dark:text-gray-400 font-medium text-sm">Manage customer property showcases and preferences</p>
              </div>
            </div>
            <button
              onClick={onCreateClick}
              className="px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-300 flex items-center space-x-2 shadow-sm hover:shadow-md border-2 bg-white dark:bg-[#1A1A1C] text-[#111827] dark:text-white border-gray-100 dark:border-[#C9A24D]/20 hover:border-[#C9A24D] dark:hover:border-[#C9A24D] hover:bg-[#FAFAF7] dark:hover:bg-[#252529] self-start lg:self-center"
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
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="Search Visitor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/5 transition-all text-xs font-medium"
              />
            </div>

            {/* Budget */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                <DollarSign size={14} />
              </div>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/5 transition-all text-xs cursor-pointer font-bold appearance-none"
              >
                <option value="ALL">All Budgets</option>
                <option value="UNDER_500">Under $500K</option>
                <option value="500_1000">$500K - $1M</option>
                <option value="1000_1500">$1M - $1.5M</option>
                <option value="1500_2500">$1.5M - $2.5M</option>
                <option value="OVER_2500">$2.5M+</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            {/* Location */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                <MapPin size={14} />
              </div>
              <input
                type="text"
                placeholder="Filter Location..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/5 transition-all text-xs font-medium"
              />
            </div>

            {/* Status */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                <Activity size={14} />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/5 transition-all text-xs cursor-pointer font-bold appearance-none"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
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
                    <th className="px-2 py-5 text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em] w-32">New</th>
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
                      const address = prefs.address;
                      // Handle formats like "612 Radnor Valley Drive Villanova, PA, 19085"
                      // 1. Split by comma to separate the Street+City from State/Zip
                      const parts = address.split(',');
                      if (parts.length >= 2) {
                        // The last part is usually State Zip (e.g. " PA 19085")
                        // The second to last part is usually the City
                        const cityPart = parts[parts.length - 2].trim();
                        
                        // Heuristic: If the city part looks like a 2-letter state (e.g. "PA"), 
                        // we might need to go one more step back, but usually City is right before the first comma 
                        // for simple "City, State Zip" or second to last for "Street, City, State Zip"
                        
                        if (cityPart) {
                          // Simple check: if cityPart is just 2 letters, it's likely a state, take the part before it
                          if (cityPart.length === 2 && parts.length >= 3) {
                            const potentialCity = parts[parts.length - 3].trim();
                            if (potentialCity.split(' ').length > 2) {
                              const words = potentialCity.split(' ');
                              displayLocations = [formatLocation(words[words.length - 1])];
                            } else {
                              displayLocations = [formatLocation(potentialCity)];
                            }
                          } else {
                            displayLocations = [formatLocation(cityPart)];
                          }
                        }
                      }
                    }
                    
                    return (
                      <tr 
                        key={collection.id} 
                        onClick={() => onCollectionClick(collection)}
                        className="group hover:bg-[#FAFAF7] dark:hover:bg-[#1A1A1C] transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-6 border-l-2 border-transparent group-hover:border-l-[#C9A24D] transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black border ${getAvatarColor(collection.customer.firstName + collection.customer.lastName)}`}>
                              {collection.customer.firstName.charAt(0)}{collection.customer.lastName.charAt(0)}
                            </div>
                            <div>
                              <div className="text-base font-black text-[#0B0B0B] dark:text-white group-hover:text-[#C9A24D] transition-colors leading-tight">
                                {collection.customer.firstName} {collection.customer.lastName.charAt(0)}.
                              </div>
                              {collection.stats.lastActivity && (
                                <div className="text-[10px] font-bold text-gray-400 tracking-tight mt-0.5">
                                  Active: {timeAgo(collection.stats.lastActivity)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6">
                          <div className="space-y-1.5">
                            <div className="flex items-center text-[13px] font-bold text-[#6B7280] dark:text-gray-400">
                              <Mail size={14} className="mr-2 opacity-50" />
                              {collection.customer.email}
                            </div>
                            <div className="flex items-center text-[13px] font-bold text-[#6B7280] dark:text-gray-400">
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
                          {collection.stats.totalProperties > 0 ? (
                            <div className="flex items-baseline">
                              <span className="text-base font-black text-[#0B0B0B] dark:text-white">
                                {collection.stats.activeProperties}
                              </span>
                              <span className="ml-1 text-xs font-bold text-[#6B7280] dark:text-gray-500">
                                / {collection.stats.totalProperties}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-start">
                              <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest rounded border border-amber-100 dark:border-amber-900/30">
                                No Matches
                              </span>
                              <span className="text-[10px] font-bold text-gray-400 mt-1">Needs Update</span>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-6">
                          <div className="flex items-center space-x-2">
                            {collection.stats.newProperties > 0 ? (
                              <>
                                <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#C9A24D]/10 dark:bg-[#C9A24D]/5 border border-[#C9A24D]/30 rounded-full group/badge transition-all hover:bg-[#C9A24D]/20 shadow-sm">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#C9A24D] animate-pulse shadow-[0_0_8px_rgba(201,162,77,0.6)]" />
                                  <span className="text-[10px] font-black text-[#C9A24D] uppercase tracking-wider whitespace-nowrap">
                                    {collection.stats.newProperties} NEW
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDismissNew(collection.id); }}
                                  className="p-1.5 text-gray-400 hover:text-[#C9A24D] hover:bg-[#C9A24D]/10 rounded-lg transition-all flex-shrink-0"
                                  title="Dismiss New Listings"
                                >
                                  <Check size={14} />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs font-bold text-gray-300 dark:text-gray-700 ml-4">—</span>
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
                            
                            {/* Toggle Switch */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onStatusToggle(collection.id); }}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                collection.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                              }`}
                              title={collection.status === 'ACTIVE' ? 'Deactivate Showcase' : 'Activate Showcase'}
                            >
                              <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  collection.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
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

