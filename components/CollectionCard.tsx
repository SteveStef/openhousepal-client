'use client'

import { Collection } from '@/types'
import { Share2, Edit3, Trash2, AlertTriangle } from 'lucide-react'

interface CollectionCardProps {
  collection: Collection
  onClick: () => void
  onShare?: (collection: Collection) => void
  onEditPreferences?: (collection: Collection) => void
  onDelete?: (collection: Collection) => void
  onStatusToggle?: (collection: Collection) => void
  formatPriceRange: (priceRange: string) => string
}

export default function CollectionCard({
  collection,
  onClick,
  onShare,
  onEditPreferences,
  onDelete,
  onStatusToggle,
  formatPriceRange
}: CollectionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'PAUSED':
        return 'bg-amber-100 text-amber-800 border-amber-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getActivityStatus = () => {
    if (!collection.stats.lastActivity) return 'No activity'
    
    const lastActivity = new Date(collection.stats.lastActivity)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Active now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return formatDate(collection.stats.lastActivity)
  }

      return (
        <div
          onClick={onClick}
          className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-200 hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)] hover:border-[#C9A24D]/30 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group flex flex-col h-full overflow-hidden"
        >
          {/* Header Section */}
          <div className="p-6 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4 min-w-0">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-[#111827] rounded-2xl flex items-center justify-center shadow-sm transition-transform duration-300">
                    <span className="text-white text-lg font-black">
                      {collection.customer.firstName.charAt(0)}{collection.customer.lastName.charAt(0)}
                    </span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#C9A24D] rounded-full border-2 border-white shadow-sm"></div>
                </div>
                
                <div className="min-w-0">
                  <h3 className="font-black text-[#0B0B0B] text-lg tracking-tight group-hover:text-[#C9A24D] transition-colors truncate">
                    {collection.customer.firstName} {collection.customer.lastName}
                  </h3>
                  <p className="text-sm text-[#6B7280] font-medium truncate">{collection.customer.email}</p>
                </div>
              </div>
    
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                {onEditPreferences && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditPreferences(collection)
                    }}
                    className="p-2 text-gray-400 hover:text-[#C9A24D] hover:bg-[#FAFAF7] rounded-xl transition-all"
                    title="Edit preferences"
                  >
                    <Edit3 size={16} />
                  </button>
                )}
                {onShare && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onShare(collection)
                    }}
                    className="p-2 text-gray-400 hover:text-[#111827] hover:bg-[#FAFAF7] rounded-xl transition-all"
                    title="Share collection"
                  >
                    <Share2 size={16} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(collection)
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete collection"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
    
            {/* Status and Activity Row */}
            <div className="flex items-center justify-between">
              {onStatusToggle ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onStatusToggle(collection)
                  }}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${getStatusColor(collection.status)} hover:shadow-sm`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${collection.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  {collection.status}
                </button>
              ) : (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(collection.status)}`}>
                  {collection.status}
                </span>
              )}
              <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">{getActivityStatus()}</span>
            </div>
          </div>
    
          {/* Metrics Section */}
          <div className="px-6 py-4 bg-[#FAFAF7] border-y border-gray-100 group-hover:bg-white transition-colors duration-300">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest mb-1">Properties</span>
                <div className="flex items-baseline">
                  <span className="text-xl font-black text-[#0B0B0B] leading-none transition-transform origin-left">{collection.stats.totalProperties}</span>
                  <span className="ml-1.5 text-xs font-bold text-[#6B7280]">Total</span>
                </div>
              </div>
              <div className="flex flex-col border-l border-gray-200 pl-4">
                <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest mb-1">Budget Range</span>
                <div className="text-sm font-black text-[#C9A24D] leading-tight bg-[#C9A24D]/5 px-2 py-1 rounded border border-[#C9A24D]/10 inline-block w-fit transition-colors group-hover:bg-[#C9A24D]/10">
                  {(collection.preferences && 'priceRange' in collection.preferences) ? formatPriceRange(collection.preferences.priceRange) : 'N/A'}
                </div>
              </div>
            </div>
          </div>      {/* Warnings */}
      {(collection.stats.totalProperties >= 41 || collection.stats.totalProperties === 0) && (
        <div className={`px-6 py-2 border-b ${collection.stats.totalProperties === 0 ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-3.5 h-3.5 ${collection.stats.totalProperties === 0 ? 'text-red-500' : 'text-amber-500'}`} />
            <p className={`text-[10px] font-bold uppercase tracking-wide ${collection.stats.totalProperties === 0 ? 'text-red-700' : 'text-amber-700'}`}>
              {collection.stats.totalProperties === 0 ? 'No properties found' : 'Large collection limit'}
            </p>
          </div>
        </div>
      )}

      {/* Preferences Preview */}
      <div className="p-6 flex-1 bg-white">
        <div className="space-y-4">
          {/* Intent */}
          <div className="flex items-center space-x-3 bg-[#FAFAF7] rounded-xl p-3 border border-gray-100">
            <div className="w-2 h-2 bg-[#C9A24D] rounded-full shadow-[0_0_8px_rgba(201,162,77,0.4)]"></div>
            <span className="text-xs font-bold text-[#0B0B0B]">
              {(collection.preferences as any)?.visiting_reason
                ? (collection.preferences as any).visiting_reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
                : 'Browsing'
              }
            </span>
          </div>

          {/* Property Types Tags */}
          {collection.preferences && (
            <div className="flex flex-wrap gap-1.5">
              {(collection.preferences as any).is_single_family && <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-[#6B7280] shadow-sm">Single Family</span>}
              {(collection.preferences as any).is_town_house && <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-[#6B7280] shadow-sm">Townhouse</span>}
              {(collection.preferences as any).is_condo && <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-[#6B7280] shadow-sm">Condo</span>}
              {(collection.preferences as any).is_apartment && <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-[#6B7280] shadow-sm">Apartment</span>}
              {(collection.preferences as any).is_multi_family && <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-[#6B7280] shadow-sm">Multi-Family</span>}
              {(collection.preferences as any).is_lot_land && <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white border border-gray-200 text-[#6B7280] shadow-sm">Lot/Land</span>}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-white border-t border-gray-50 mt-auto">
        <div className="flex items-center justify-between text-[10px] font-bold text-[#6B7280] uppercase tracking-widest">
          <span>{collection.customer.firstName}'s Showcase</span>
          <span>{formatDate(collection.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}
