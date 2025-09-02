'use client'

import { Collection } from '@/types'
import { Share2, Edit3 } from 'lucide-react'

interface CollectionCardProps {
  collection: Collection
  onClick: () => void
  onShare?: (collection: Collection) => void
  onEditPreferences?: (collection: Collection) => void
  formatTimeframe: (timeframe: string) => string
  formatPriceRange: (priceRange: string) => string
}

export default function CollectionCard({ 
  collection, 
  onClick, 
  onShare,
  onEditPreferences,
  formatTimeframe, 
  formatPriceRange 
}: CollectionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
  console.log(collection);

  return (
    <div
      onClick={onClick}
      className="bg-white/95 rounded-2xl shadow-xl border border-gray-200/60 backdrop-blur-lg p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:border-[#8b7355]/30 hover:bg-white group relative overflow-hidden hover:-translate-y-1"
    >
      {/* Header Section */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1 min-w-0 mr-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2 font-light group-hover:text-gray-800 transition-colors truncate">
            {collection.customer.firstName} {collection.customer.lastName}
          </h3>
          <p className="text-gray-600 text-sm font-light truncate" title={collection.customer.email}>
            {collection.customer.email}
          </p>
        </div>
        
        {/* Action Buttons and Budget */}
        <div className="flex flex-col items-end space-y-2 flex-shrink-0">
          {/* Buttons Row */}
          <div className="flex items-center space-x-3">
            {onEditPreferences && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditPreferences(collection)
                }}
                className="p-2 text-gray-400 hover:text-[#8b7355] hover:bg-[#8b7355]/10 rounded-lg transition-all duration-200"
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
                className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-blue-500/25 hover:scale-105 z-10 relative"
                title="Share collection with customer"
              >
                <Share2 size={14} />
                <span className="text-xs font-medium">Share</span>
              </button>
            )}
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(collection.status)}`}>
              {collection.status}
            </span>
          </div>
          
          {/* Budget Row */}
          <span className="text-xs font-medium text-gray-700">
            {collection.preferences && 'priceRange' in collection.preferences 
              ? formatPriceRange((collection.preferences as any).priceRange) 
              : collection.preferences?.min_price || collection.preferences?.max_price
              ? `$${(collection.preferences as any).min_price || 0}K - $${(collection.preferences as any).max_price || 0}K`
              : 'Not specified'}
          </span>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white/60 rounded-lg p-3 border border-[#8b7355]/20 shadow-sm">
          <div className="flex items-center space-x-2 mb-1">
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
            <span className="text-xs font-medium text-gray-600">Properties</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{collection.stats.totalProperties}</p>
        </div>
        
        <div className="bg-white/60 rounded-lg p-3 border border-[#8b7355]/20 shadow-sm">
          <div className="flex items-center space-x-2 mb-1">
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            <span className="text-xs font-medium text-gray-600">Viewed</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{collection.stats.viewedProperties}</p>
        </div>
      </div>

      {/* Visitor Context or Preferences Section */}
      {collection.preferences && ((collection.preferences as any).visitingReason || (collection.preferences as any).visiting_reason || (collection.preferences as any).hasAgent || (collection.preferences as any).has_agent) ? (
        <div className="bg-blue-50/80 rounded-xl p-4 border border-blue-200/60 mb-5">
          <div className="flex items-center mb-3">
            <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            <span className="text-sm font-semibold text-blue-800">Visitor Context</span>
          </div>
          <div className="space-y-3">
            {/* Address and Price */}
            <div className="flex items-start space-x-2">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900 leading-tight">{collection.originalProperty.address}</p>
                <p className="text-sm font-bold text-blue-800 mt-0.5">
                  {collection.originalProperty.price?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0
                  })}
                </p>
              </div>
            </div>

            {/* Visit Information */}
            <div className="grid grid-cols-3 gap-2">
              {(collection.preferences as any).visitingReason && (
                <div className="bg-blue-100/60 rounded-lg px-2 py-1 text-center">
                  <span className="text-xs font-medium text-blue-800">
                    {(collection.preferences as any).visitingReason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                </div>
              )}
              {(collection.preferences as any).hasAgent && (
                <div className="bg-blue-100/60 rounded-lg px-2 py-1 text-center">
                  <span className="text-xs font-medium text-blue-800">
                    {(collection.preferences as any).hasAgent === 'YES' ? 'Has Agent' : (collection.preferences as any).hasAgent === 'NO' ? 'No Agent' : 'Seeking Agent'}
                  </span>
                </div>
              )}
              <div className="bg-blue-100/60 rounded-lg px-2 py-1 text-center">
                <span className="text-xs font-medium text-blue-800">{formatTimeframe((collection.preferences as any).timeframe)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/60 mb-5">
          <div className="flex items-center mb-3">
            <svg className="w-4 h-4 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span className="text-sm font-semibold text-gray-700">Search Preferences</span>
          </div>
          <div className="space-y-3">
            {/* Address and Price */}
            <div className="flex items-start space-x-2">
              <svg className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900 leading-tight">{collection.originalProperty.address}</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">
                  {collection.originalProperty.price?.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0
                  })}
                </p>
              </div>
            </div>

            {/* Search Preferences */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center space-x-1.5 bg-gray-100/60 rounded-lg px-2 py-1">
                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
                <span className="text-xs font-medium text-gray-800">{formatPriceRange((collection.preferences as any).priceRange)}</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-gray-100/60 rounded-lg px-2 py-1">
                <svg className="w-3 h-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span className="text-xs font-medium text-gray-800">{formatTimeframe((collection.preferences as any).timeframe)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#8b7355]/20">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            getActivityStatus() === 'Active now' ? 'bg-green-400' : 
            getActivityStatus().includes('h ago') ? 'bg-yellow-400' : 'bg-gray-500'
          }`}></div>
          <span className="text-sm text-gray-600 font-medium">{getActivityStatus()}</span>
        </div>
        <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </div>
    </div>
  )
}
