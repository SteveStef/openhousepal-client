'use client'

import { Collection } from '@/types'
import { Share2 } from 'lucide-react'

interface CollectionCardProps {
  collection: Collection
  onClick: () => void
  onShare?: (collection: Collection) => void
  formatTimeframe: (timeframe: string) => string
  formatPriceRange: (priceRange: string) => string
}

export default function CollectionCard({ 
  collection, 
  onClick, 
  onShare,
  formatTimeframe, 
  formatPriceRange 
}: CollectionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-900/50 text-green-300 border-green-700/40'
      case 'PAUSED':
        return 'bg-yellow-900/50 text-yellow-300 border-yellow-700/40'
      case 'COMPLETED':
        return 'bg-gray-900/50 text-gray-300 border-gray-700/40'
      default:
        return 'bg-zinc-900/50 text-zinc-300 border-zinc-700/40'
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

  return (
    <div
      onClick={onClick}
      className="bg-zinc-900/30 rounded-2xl shadow-xl border border-zinc-800/30 backdrop-blur-lg p-6 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:border-zinc-700/50 hover:bg-zinc-900/40 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-1 font-light group-hover:text-zinc-100 transition-colors">
            {collection.customer.firstName} {collection.customer.lastName}
          </h3>
          <p className="text-zinc-400 text-sm font-light">{collection.customer.email}</p>
        </div>
        <div className="flex items-center space-x-2">
          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onShare(collection)
              }}
              className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800/50 rounded-lg transition-all duration-200"
              title="Share collection"
            >
              <Share2 size={16} />
            </button>
          )}
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(collection.status)}`}>
            {collection.status}
          </span>
        </div>
      </div>

      {/* Original Property */}
      <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-700/40 mb-4">
        <div className="flex items-center mb-2">
          <svg className="w-4 h-4 text-zinc-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
          </svg>
          <span className="text-xs font-medium text-zinc-400">Visited Property</span>
        </div>
        <p className="text-white text-sm font-medium mb-1">{collection.originalProperty.address}</p>
        <p className="text-zinc-300 text-sm">
          {collection.originalProperty.price?.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0
          })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-zinc-900/30 rounded-xl p-3 border border-zinc-700/30">
          <p className="text-xs font-medium text-zinc-400 mb-1">Properties</p>
          <p className="text-lg font-bold text-white">{collection.stats.totalProperties}</p>
        </div>
        <div className="bg-zinc-900/30 rounded-xl p-3 border border-zinc-700/30">
          <p className="text-xs font-medium text-zinc-400 mb-1">Viewed</p>
          <p className="text-lg font-bold text-white">{collection.stats.viewedProperties}</p>
        </div>
      </div>

      {/* Preferences */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-zinc-400">Budget:</span>
          <span className="text-xs text-white font-medium">{formatPriceRange(collection.preferences.priceRange)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-zinc-400">Timeframe:</span>
          <span className="text-xs text-white font-medium">{formatTimeframe(collection.preferences.timeframe)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-700/30">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            getActivityStatus() === 'Active now' ? 'bg-green-400' : 
            getActivityStatus().includes('h ago') ? 'bg-yellow-400' : 'bg-zinc-500'
          }`}></div>
          <span className="text-xs text-zinc-400">{getActivityStatus()}</span>
        </div>
        <svg className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </div>
    </div>
  )
}