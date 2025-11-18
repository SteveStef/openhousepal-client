'use client'

import { Collection } from '@/types'
import { Share2, Edit3, Trash2 } from 'lucide-react'

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
  console.log(collection);

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
      className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer group overflow-hidden flex flex-col h-full"
    >
      {/* Header Section */}
      <div className="p-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {collection.customer.firstName.charAt(0)}{collection.customer.lastName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-base truncate">
                  {collection.customer.firstName} {collection.customer.lastName}
                </h3>
                <p className="text-sm text-gray-500">{collection.customer.email}</p>
                {collection.customer.phone && collection.customer.phone !== '(000) 000-0000' && (
                  <p className="text-xs text-gray-400">{collection.customer.phone}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Actions and Status */}
          <div className="flex items-center space-x-2 ml-4">
            {/* Action Buttons */}
            <div className="flex items-center space-x-1 opacity-100 transition-opacity">
              {onEditPreferences && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditPreferences(collection)
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title="Edit preferences"
                >
                  <Edit3 size={14} />
                </button>
              )}
              {onShare && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onShare(collection)
                  }}
                  className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                  title="Share collection"
                >
                  <Share2 size={14} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(collection)
                  }}
                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                  title="Delete collection"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            
            {/* Status Tab - Clickable */}
            {onStatusToggle ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusToggle(collection)
                }}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:shadow-sm ${getStatusColor(collection.status)} ${
                  collection.status === 'ACTIVE'
                    ? 'hover:bg-green-200 hover:border-green-300'
                    : 'hover:bg-gray-200 hover:border-gray-300'
                } cursor-pointer`}
                title={`Click to ${collection.status === 'ACTIVE' ? 'deactivate' : 'activate'} showcase`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${collection.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                {collection.status}
              </button>
            ) : (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(collection.status)}`}>
                <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${collection.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                {collection.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="px-4 py-3 bg-gray-50/50">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{collection.stats.totalProperties}</div>
            <div className="text-xs text-gray-500">Properties</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-blue-600 leading-tight">
              {(collection.preferences && 'priceRange' in collection.preferences) ? formatPriceRange(collection.preferences.priceRange) : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">Budget</div>
          </div>
        </div>
      </div>

      {/* Search Preferences */}
      <div className="p-4 flex-1">
        <div className="space-y-3">
          {/* Intent */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-sm text-gray-700">
              {(collection.preferences as any)?.visiting_reason
                ? (collection.preferences as any).visiting_reason.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())
                : 'Browsing'
              }
            </span>
          </div>

          {/* Property Requirements */}
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              {(collection.preferences as any)?.min_beds && (
                <span>
                  {(collection.preferences as any).min_beds}
                  {(collection.preferences as any).max_beds && (collection.preferences as any).max_beds !== (collection.preferences as any).min_beds 
                    ? `-${(collection.preferences as any).max_beds}` : '+'} bed{(collection.preferences as any).min_beds !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-gray-500">
              {(collection.preferences as any)?.has_agent 
                ? ((collection.preferences as any).has_agent === 'YES' ? 'Has Agent' : (collection.preferences as any).has_agent === 'NO' ? 'No Agent' : 'Seeking Agent')
                : 'Agent status unknown'
              }
            </div>
          </div>

          {/* Property Types */}
          {collection.preferences && (
            <div className="flex flex-wrap gap-1">
              {(collection.preferences as any).is_single_family && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Single Family</span>}
              {(collection.preferences as any).is_town_house && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Townhouse</span>}
              {(collection.preferences as any).is_condo && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Condo</span>}
              {(collection.preferences as any).is_apartment && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Apartment</span>}
              {(collection.preferences as any).is_multi_family && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Multi-Family</span>}
              {(collection.preferences as any).is_lot_land && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Lot/Land</span>}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{getActivityStatus()}</span>
          <span>Created {formatDate(collection.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}
