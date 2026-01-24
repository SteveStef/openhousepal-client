'use client'

import { useMemo, memo } from 'react'
import Image from 'next/image'
import { Property } from '@/types'
import { ThumbsUp, ThumbsDown, MessageCircle, Calendar, Eye } from 'lucide-react'

interface PropertyCardProps {
  property: Property
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onPropertyClick?: (property: Property) => void
  onScheduleTour?: (property: Property) => void
  showDetailedViewCount?: boolean // If true, shows "X views", if false shows just "Viewed"
  showNewForUnviewed?: boolean // If true, shows NEW badge when viewCount === 0, if false uses property.is_new
}

const PropertyCard = memo(function PropertyCard({ property, onLike, onDislike, onPropertyClick, onScheduleTour, showDetailedViewCount = false, showNewForUnviewed = false }: PropertyCardProps) {
  // Memoize visitor interaction counts to avoid redundant filtering on every render
  const interactionCounts = useMemo(() => {
    if (!property.visitorInteractions) {
      return { liked: 0, disliked: 0 }
    }
    return {
      liked: property.visitorInteractions.filter(vi => vi.liked).length,
      disliked: property.visitorInteractions.filter(vi => vi.disliked).length
    }
  }, [property.visitorInteractions])

  // Helper function to determine if property is available (clickable)
  const isPropertyAvailable = useMemo(() => {
    const status = property.status || (property.details as any)?.homeStatus;
    if (!status) return true; // Assume available if no status

    const normalizedStatus = status.toLowerCase().replace(/[_\s]/g, '');
    return normalizedStatus === 'forsale' || normalizedStatus === 'forrent';
  }, [property.status, property.details])

  // Helper function to format status display
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'recentlysold': 'Recently Sold',
      'sold': 'Sold',
      'pending': 'Pending',
      'off_market': 'Off Market',
      'offmarket': 'Off Market',
      'forrent': 'For Rent',
      'for_rent': 'For Rent'
    };

    const normalized = status.toLowerCase().replace(/[_\s]/g, '');
    return statusMap[normalized] || status.replace(/_/g, ' ');
  }

  const formatPrice = (price?: number) => {
    return price ? price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }) : 'Price Available Upon Request'
  }

  const available = isPropertyAvailable
  const status = property.status || (property.details as any)?.homeStatus

  return (
    <div
      onClick={available ? () => onPropertyClick?.(property) : undefined}
      className={`bg-white rounded-2xl overflow-hidden border border-gray-200 transition-all duration-300 flex flex-col h-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] will-change-transform group ${
        available
          ? 'hover:border-gray-300 hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 cursor-pointer'
          : 'opacity-75 cursor-not-allowed'
      }`}
    >
      {/* Property Image */}
      <div className="relative bg-gray-100 aspect-[16/9] overflow-hidden">
        {property.imageUrl ? (
          <Image
            src={property.imageUrl}
            alt={property.address}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500"
            loading="lazy"
            quality={75}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
        )}

        {/* Badge Priority: Status > NEW > View Count */}
        {!available && status ? (
          <div className="absolute top-4 right-4">
            <span className="bg-gray-900/90 text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg border-2 border-white">
              {formatStatus(status)}
            </span>
          </div>
        ) : showNewForUnviewed && (!property.viewCount || property.viewCount === 0) ? (
          <div className="absolute top-4 right-4" title="Not yet viewed">
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg border-2 border-white">
              NEW
            </span>
          </div>
        ) : showDetailedViewCount ? (
          <div className="absolute top-4 right-4">
            <span className="bg-white/90 text-gray-700 font-medium px-3 py-1 rounded-full text-sm border border-gray-200 flex items-center gap-1.5 shadow-sm">
              <Eye size={16} />
              <span>{property.viewCount || 0}</span>
            </span>
          </div>
        ) : (
          property.viewCount && property.viewCount > 0 && (
            <div className="absolute top-4 right-4">
              <span className="bg-white/90 text-gray-700 font-medium px-3 py-1 rounded-full text-sm border border-gray-200 flex items-center gap-1.5 shadow-sm">
                <Eye size={16} />
                <span>Viewed</span>
              </span>
            </div>
          )
        )}
      </div>

      {/* Property Details */}
      <div className="p-6 pb-0">
        <p className="text-gray-500 text-[10px] mb-1 font-bold uppercase tracking-widest">
          {property.city}, {property.state} {property.zipCode}
        </p>
        
        <h3 className="text-lg font-black text-[#0B0B0B] mb-4 tracking-tight leading-snug group-hover:text-[#C9A24D] transition-colors">
          {property.address}
        </h3>

        {/* Property Stats */}
        <div className="flex items-center space-x-4 text-sm mb-6">
            <div className="flex items-center text-gray-600">
            <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
            </svg>
            <span className="font-medium text-[#111827]">{property.beds}</span><span className="ml-1 text-xs">beds</span>
          </div>
          
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path>
              </svg>
              <span className="font-medium text-[#111827]">{property.baths}</span><span className="ml-1 text-xs">baths</span>
            </div>
          
          {property.squareFeet && (
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
              </svg>
              <span className="font-medium text-[#111827]">{property.squareFeet.toLocaleString()}</span><span className="ml-1 text-xs">sqft</span>
            </div>
          )}
        </div>

        {/* Price and Quick Actions */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-lg font-black text-[#C9A24D] tracking-tight">
            {formatPrice(property.price)}
          </span>
            
            <div className="flex items-center space-x-2">
              {/* Like button with visitor count */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (property.id !== undefined && available) {
                      onLike?.(property.id, !property.liked);
                    }
                  }}
                  disabled={!available}
                  className={`flex items-center transition-colors p-1 rounded-md ${
                    available ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'
                  } ${
                    property.liked
                      ? 'text-green-400 hover:text-green-300'
                      : 'text-gray-400 hover:text-green-500'
                  }`}
                  title={available ? `${property.liked ? 'Unlike' : 'Like'} this property` : 'Property no longer available'}
                >
                  <ThumbsUp
                    size={16}
                    fill={property.liked ? "currentColor" : "none"}
                  />
                </button>
                {interactionCounts.liked > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    title={`${interactionCounts.liked} visitor(s) liked this property`}
                  >
                    {interactionCounts.liked}
                  </span>
                )}
              </div>
              
              {/* Dislike button with visitor count */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (property.id !== undefined && available) {
                      onDislike?.(property.id, !property.disliked);
                    }
                  }}
                  disabled={!available}
                  className={`flex items-center transition-colors p-1 rounded-md ${
                    available ? 'hover:bg-gray-100' : 'opacity-50 cursor-not-allowed'
                  } ${
                    property.disliked
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-gray-400 hover:text-red-500'
                  }`}
                  title={available ? `${property.disliked ? 'Remove dislike' : 'Dislike'} this property` : 'Property no longer available'}
                >
                  <ThumbsDown
                    size={16}
                    fill={property.disliked ? "currentColor" : "none"}
                  />
                </button>
                {interactionCounts.disliked > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    title={`${interactionCounts.disliked} visitor(s) disliked this property`}
                  >
                    {interactionCounts.disliked}
                  </span>
                )}
              </div>
              {property.comments && property.comments.length > 0 && (
                <div className="flex items-center space-x-1 text-[#8b7355] text-xs">
                  <MessageCircle size={12} />
                  <span>{property.comments.length}</span>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Action Buttons - Moved to Bottom */}
      <div className="p-6 pt-4 mt-auto">
        <div className="flex space-x-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (available) onPropertyClick?.(property);
            }}
            disabled={!available}
            className={`flex-1 font-bold py-2.5 px-4 rounded-xl transition-all duration-300 text-xs uppercase tracking-wide ${
              available
                ? 'bg-[#111827] hover:bg-[#C9A24D] text-white shadow-md hover:shadow-lg hover:scale-[1.02]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {available ? 'View Details' : 'Unavailable'}
          </button>
          {onScheduleTour ? (
            property.hasTourScheduled ? (
              <div className="flex items-center space-x-1 px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-xs shadow-sm">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span className="text-green-700 font-bold">Scheduled</span>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (available) onScheduleTour?.(property);
                }}
                disabled={!available}
                className={`font-bold py-2.5 px-4 rounded-xl border transition-all duration-300 text-xs uppercase tracking-wide ${
                  available
                    ? 'bg-white hover:bg-gray-50 text-[#111827] border-gray-200 hover:border-gray-300 shadow-sm'
                    : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                }`}
              >
                Tour
              </button>
            )
          ) : (
            <div className="flex items-center space-x-1 px-3 py-2 bg-[#111827]/5 border border-[#111827]/10 rounded-xl text-xs">
              <Calendar size={14} className="text-[#111827]" />
              <span className="text-[#111827] font-bold">
                {property.tourCount || 0}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default PropertyCard
