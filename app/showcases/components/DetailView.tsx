'use client'

import { memo } from 'react'
import { Calendar } from 'lucide-react'
import PropertyGrid from '@/components/PropertyGrid'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import ViewToursModal from '@/components/ViewToursModal'
import { Collection, Property, Comment, PropertyTour } from '@/types'

interface DetailViewProps {
  selectedCollection: Collection;
  matchedProperties: Property[];
  activeTab: 'all' | 'liked' | 'disliked';
  setActiveTab: (tab: 'all' | 'liked' | 'disliked') => void;
  tabCounts: { all: number, liked: number, disliked: number };
  sortBy: string;
  setSortBy: (sort: any) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  onBack: () => void;
  onStatusToggle: (id: string) => void;
  onNotificationToggle: (id: string, type: 'visitor' | 'agent') => void;
  onViewTours: () => void;
  // Property Actions
  onPropertyLike: (id: string | number, liked: boolean) => void;
  onPropertyDislike: (id: string | number, disliked: boolean) => void;
  onPropertyClick: (property: Property) => void;
  onAddComment: (id: string | number, comment: string) => void;
  // Modal States
  selectedProperty: Property | null;
  isModalOpen: boolean;
  onCloseModal: () => void;
  isLoadingDetails: boolean;
  detailsError: string | null;
  isLoadingComments: boolean;
  commentsError: string | null;
  // Tour Modal
  isToursModalOpen: boolean;
  onCloseToursModal: () => void;
  collectionTours: PropertyTour[];
  onUpdateTourCompletion: (id: string, completed: boolean) => Promise<void>;
  isLoadingTours: boolean;
}

export const DetailView = memo(function DetailView({
  selectedCollection,
  matchedProperties,
  activeTab,
  setActiveTab,
  tabCounts,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onBack,
  onStatusToggle,
  onNotificationToggle,
  onViewTours,
  onPropertyLike,
  onPropertyDislike,
  onPropertyClick,
  onAddComment,
  selectedProperty,
  isModalOpen,
  onCloseModal,
  isLoadingDetails,
  detailsError,
  isLoadingComments,
  commentsError,
  isToursModalOpen,
  onCloseToursModal,
  collectionTours,
  onUpdateTourCompletion,
  isLoadingTours
}: DetailViewProps) {
  
  const filteredProperties = matchedProperties.filter(property => {
    if (activeTab === 'liked') return property.liked
    if (activeTab === 'disliked') return property.disliked
    return true
  }).sort((a, b) => {
    let comparison = 0
    if (sortBy === 'price') comparison = (a.ListPrice || 0) - (b.ListPrice || 0)
    else if (sortBy === 'beds') comparison = (a.BedroomsTotal || 0) - (b.BedroomsTotal || 0)
    else if (sortBy === 'squareFeet') comparison = (a.LivingArea || 0) - (b.LivingArea || 0)
    else if (sortBy === 'daysOnMarket') comparison = (a.DaysOnMarket || 0) - (b.DaysOnMarket || 0)
    else if (sortBy === 'lastUpdated') comparison = new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const formatAddressForTitle = (address: string) => {
    const parts = address.split(',');
    const rawAddress = parts.length > 1 ? `${parts[0].trim()}, ${parts[1].trim()}` : parts[0].trim();
    return rawAddress.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  return (
    <div className="flex-1 p-4 pb-20 sm:p-6 sm:pb-32">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={onBack}
          className="group mb-6 flex items-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 font-medium"
        >
          <div className="w-8 h-8 rounded-full bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 flex items-center justify-center mr-3 group-hover:border-gray-300 dark:group-hover:border-gray-700 group-hover:shadow-sm transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </div>
          Back to Showcases
        </button>

        <div className="bg-white/50 dark:bg-[#151517]/50 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-gray-800 p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-1">Property Recommendations</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-light" title={selectedCollection.originalProperty.FullStreetAddress}>
                Curated properties for {formatAddressForTitle(selectedCollection.originalProperty.FullStreetAddress)}
              </p>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={onViewTours}
                className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-[#151517] via-[#3a2f25] to-[#8b7355] dark:from-white dark:via-gray-200 dark:to-gray-400 dark:text-[#111827] shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 whitespace-nowrap group"
              >
                <Calendar size={16} className="mr-2 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">View Tours</span>
                <span className="sm:hidden">Tours</span>
              </button>
              <button
                onClick={() => onStatusToggle(selectedCollection.id)}
                className={`inline-flex items-center px-3 py-2 rounded-xl text-xs font-bold border transition-all duration-300 hover:shadow-md whitespace-nowrap uppercase tracking-wide ${
                  selectedCollection.status === 'ACTIVE'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900 hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${selectedCollection.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'}`} />
                {selectedCollection.status === 'ACTIVE' ? 'Turn Off' : 'Turn On'}
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Properties', count: tabCounts.all },
                { key: 'liked', label: 'Liked', count: tabCounts.liked },
                { key: 'disliked', label: 'Disliked', count: tabCounts.disliked }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center space-x-2 border ${
                    activeTab === tab.key
                      ? 'bg-[#151517] dark:bg-white text-white dark:text-[#111827] border-[#151517] dark:border-white shadow-md'
                      : 'bg-white dark:bg-[#151517] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-white/20 dark:bg-black/10 text-white dark:text-[#111827]' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-6 text-sm bg-gray-50/50 dark:bg-white/5 p-2 px-4 rounded-2xl border border-gray-100 dark:border-gray-800/50">
              <span className="text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap hidden lg:inline">Email Alerts:</span>
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-semibold ${selectedCollection.isBlacklisted ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>Visitor</span>
                <button
                  onClick={() => !selectedCollection.isBlacklisted && onNotificationToggle(selectedCollection.id, 'visitor')}
                  disabled={selectedCollection.isBlacklisted}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedCollection.isBlacklisted ? 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed' : (selectedCollection.notifyVisitor ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700')}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${(selectedCollection.notifyVisitor && !selectedCollection.isBlacklisted) ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center space-x-2 border-l border-gray-200 dark:border-gray-800 pl-6">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Agent</span>
                <button
                  onClick={() => onNotificationToggle(selectedCollection.id, 'agent')}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${selectedCollection.notifyAgent ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${selectedCollection.notifyAgent ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all appearance-none cursor-pointer">
                <option value="daysOnMarket">Days on Market</option>
                <option value="price">Price</option>
                <option value="beds">Bedrooms</option>
                <option value="squareFeet">Square Feet</option>
                <option value="lastUpdated">Last Updated</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Sort Order</label>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)} className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8b7355]/20 focus:border-[#8b7355] transition-all appearance-none cursor-pointer">
                <option value="asc">Low to High</option>
                <option value="desc">High to Low</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => { setSortBy('daysOnMarket'); setSortOrder('asc'); setActiveTab('all') }} className="w-full px-4 py-2.5 bg-white dark:bg-[#151517] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Reset Filters</button>
            </div>
          </div>
        </div>

        <PropertyGrid
          properties={filteredProperties}
          title="Matched Properties"
          onLike={onPropertyLike}
          onDislike={onPropertyDislike}
          onPropertyClick={onPropertyClick}
          showDetailedViewCount={true}
        />

        <PropertyDetailsModal
          property={selectedProperty}
          isOpen={isModalOpen}
          onClose={onCloseModal}
          onLike={onPropertyLike}
          onDislike={onPropertyDislike}
          onAddComment={onAddComment}
          isLoadingDetails={isLoadingDetails}
          detailsError={detailsError}
          onRetryDetails={() => onPropertyClick(selectedProperty!)}
          isLoadingComments={isLoadingComments}
          commentsError={commentsError}
        />

        <ViewToursModal
          isOpen={isToursModalOpen}
          onClose={onCloseToursModal}
          tours={collectionTours}
          onUpdateCompletion={onUpdateTourCompletion}
          isLoading={isLoadingTours}
        />
      </div>
    </div>
  )
})
