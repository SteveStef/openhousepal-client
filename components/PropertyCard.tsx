'use client'

import { useMemo, memo } from 'react'
import Image from 'next/image'
import { Property } from '@/types'
import { ThumbsUp, ThumbsDown, MessageCircle, Calendar, Eye, Bed, Bath, Square } from 'lucide-react'
import { cleanAddress } from '@/lib/utils'

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
    const status = property.MlsStatus;
    if (!status) return true; // Assume available if no status

    const normalizedStatus = status.toLowerCase().replace(/[_\s-]/g, '');
    // Standard RESO statuses: Active, Coming Soon, Active-Bright
    return normalizedStatus === 'active' || normalizedStatus === 'activebright' || normalizedStatus === 'comingsoon';
  }, [property.MlsStatus])

  // Helper function to format status display
  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      'recentlysold': 'Recently Sold',
      'sold': 'Sold',
      'pending': 'Pending',
      'off_market': 'Off Market',
      'offmarket': 'Off Market',
      'forrent': 'For Rent',
      'for_rent': 'For Rent',
      'activebright': 'For Sale',
      'active': 'For Sale',
      'comingsoon': 'Coming Soon',
      'comingsoonbright': 'Coming Soon'
    };

    const normalized = status.toLowerCase().replace(/[_\s-]/g, '');
    return statusMap[normalized] || status.replace(/[_-]/g, ' ');
  }

  const formatPrice = (price?: number) => {
    return price ? price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }) : 'Price Available Upon Request'
  }

  const available = isPropertyAvailable
  const status = property.MlsStatus

  return (
    <div
      onClick={available ? () => onPropertyClick?.(property) : undefined}
      className={`bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col h-full shadow-[0_2px_8px_rgba(0,0,0,0.04)] will-change-transform group ${
        available
          ? 'hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 cursor-pointer'
          : 'opacity-75 cursor-not-allowed'
      }`}
    >
      {/* Property Image */}
      <div className="relative bg-gray-100 dark:bg-[#0B0B0B] aspect-[16/9] overflow-hidden">
        {property.ListPictureURL ? (
          <Image
            src={property.ListPictureURL}
            alt={property.FullStreetAddress}
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
            <span className="bg-gray-900/90 dark:bg-white/90 text-white dark:text-[#111827] font-bold px-3 py-1 rounded-full text-xs shadow-lg border-2 border-white dark:border-[#151517]">
              {formatStatus(status)}
            </span>
          </div>
        ) : showNewForUnviewed && (!property.viewCount || property.viewCount === 0) ? (
          <div className="absolute top-4 right-4" title="Not yet viewed">
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg border-2 border-white dark:border-[#151517]">
              NEW
            </span>
          </div>
        ) : showDetailedViewCount ? (
          <div className="absolute top-4 right-4">
            <span className="bg-white/90 dark:bg-[#151517]/90 text-gray-700 dark:text-gray-300 font-medium px-3 py-1 rounded-full text-sm border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 shadow-sm">
              <Eye size={16} />
              <span>{property.viewCount || 0}</span>
            </span>
          </div>
        ) : (
          property.viewCount && property.viewCount > 0 && (
            <div className="absolute top-4 right-4">
              <span className="bg-white/90 dark:bg-[#151517]/90 text-gray-700 dark:text-gray-300 font-medium px-3 py-1 rounded-full text-sm border border-gray-200 dark:border-gray-700 flex items-center gap-1.5 shadow-sm">
                <Eye size={16} />
                <span>Viewed</span>
              </span>
            </div>
          )
        )}
      </div>

      {/* Property Details */}
      <div className="p-6 pb-0">
        <p className="text-gray-500 dark:text-gray-400 text-[10px] mb-1 font-bold uppercase tracking-widest">
          {property.City}, {property.StateOrProvince} {property.PostalCode}
        </p>
        
        <h3 
          className="text-lg font-black text-[#0B0B0B] dark:text-white mb-1 tracking-tight leading-snug group-hover:text-[#C9A24D] transition-colors line-clamp-1"
          title={property.FullStreetAddress}
        >
          {cleanAddress(property.FullStreetAddress, property.City)}
        </h3>

        {/* Broker Attribution */}
        {property.ListOfficeName && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-4 line-clamp-1">
            Courtesy of {property.ListOfficeName}
          </p>
        )}

        {/* Property Stats */}
        <div className="flex items-center space-x-4 text-sm mb-6">
            <div className="flex items-center text-gray-600 dark:text-gray-400">
            <Bed className="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500" />
            <span className="font-medium text-[#111827] dark:text-white">{property.BedroomsTotal}</span><span className="ml-1 text-xs">beds</span>
          </div>
          
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Bath className="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500" />
              <span className="font-medium text-[#111827] dark:text-white">{property.BathroomsTotal}</span><span className="ml-1 text-xs">baths</span>
            </div>
          
          {property.LivingArea && (
            <div className="flex items-center text-gray-600 dark:text-gray-400">
              <Square className="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500" />
              <span className="font-medium text-[#111827] dark:text-white">{property.LivingArea.toLocaleString()}</span><span className="ml-1 text-xs">sqft</span>
            </div>
          )}
        </div>

        {/* Price and Quick Actions */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-lg font-black text-[#C9A24D] tracking-tight">
            {formatPrice(property.ListPrice)}
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
                    available ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : 'opacity-50 cursor-not-allowed'
                  } ${
                    property.liked
                      ? 'text-green-400 hover:text-green-300'
                      : 'text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-green-400'
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
                    available ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : 'opacity-50 cursor-not-allowed'
                  } ${
                    property.disliked
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400'
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
                <div className="flex items-center space-x-1 text-[#8b7355] dark:text-[#C9A24D] text-xs">
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
                ? 'bg-[#111827] dark:bg-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] shadow-md hover:shadow-lg hover:scale-[1.02]'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
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
