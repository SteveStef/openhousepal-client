'use client'

import { useMemo, memo } from 'react'
import Image from 'next/image'
import { Property } from '@/types'
import { ThumbsUp, ThumbsDown, MessageCircle, Calendar, Eye, Bed, Bath, Square, Home } from 'lucide-react'
import { cleanAddress, formatMlsStatus } from '@/lib/utils'

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
    return formatMlsStatus(status);
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

  const isViewed = property.viewCount !== undefined && property.viewCount > 0

  return (
    <div
      onClick={available ? () => onPropertyClick?.(property) : undefined}
      className={`bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transition-all duration-500 flex flex-col h-full shadow-[0_2px_8px_rgba(0,0,0,0.02)] will-change-transform group ${
        available
          ? 'hover:border-[#C9A24D]/30 dark:hover:border-[#C9A24D]/30 hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] cursor-pointer'
          : 'opacity-75 cursor-not-allowed'
      }`}
    >
      {/* 70% Height - Rectangle Image (Landscape) */}
      <div className="relative bg-gray-100 dark:bg-[#0B0B0B] aspect-video overflow-hidden flex-[7]">
        {property.ListPictureURL ? (
          <Image
            src={property.ListPictureURL}
            alt={property.FullStreetAddress}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-all duration-1000"
            loading="lazy"
            quality={85}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-12 h-12 text-gray-300 dark:text-gray-800" />
          </div>
        )}

        {/* Floating Badges (Top Left) */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {!available && status && (
            <span className="bg-gray-900/90 backdrop-blur-md text-white font-black px-2.5 py-1 rounded-lg text-[8px] uppercase tracking-widest border border-white/10">
              {formatStatus(status)}
            </span>
          )}
          {showNewForUnviewed && !isViewed && (
            <span className="bg-[#C9A24D] text-white font-black px-2.5 py-1 rounded-lg text-[8px] uppercase tracking-widest shadow-xl border border-white/10 animate-pulse">
              NEW
            </span>
          )}
        </div>

        {/* Interaction Indicators (Bottom Right) */}
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {isViewed && (
            <div className="bg-[#111827]/90 backdrop-blur-md text-white px-2.5 py-1 rounded-lg border border-white/10 flex items-center space-x-1.5 shadow-xl">
              <Eye size={10} className="text-[#C9A24D]" />
              <span className="text-[9px] font-black uppercase tracking-widest">
                {showDetailedViewCount ? `${property.viewCount} Views` : 'Viewed'}
              </span>
            </div>
          )}
          {interactionCounts.liked > 0 && (
            <div className="bg-green-500/90 backdrop-blur-md text-white p-1.5 rounded-lg border border-white/10 shadow-xl">
              <ThumbsUp size={10} fill="currentColor" />
            </div>
          )}
        </div>
      </div>

      {/* 30% Height - Details Section */}
      <div className="p-4 flex flex-col flex-[3] justify-between">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-lg font-black text-[#111827] dark:text-white tracking-tight leading-none group-hover:text-[#C9A24D] transition-colors">
              {formatPrice(property.ListPrice)}
            </span>
            <div className="flex items-center space-x-1.5">
              {/* Interaction Actions */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (property.id !== undefined && available) {
                    onLike?.(property.id, !property.liked);
                  }
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  property.liked
                    ? 'text-green-500 bg-green-500/10'
                    : 'text-gray-300 hover:text-green-500'
                }`}
              >
                <ThumbsUp size={18} fill={property.liked ? "currentColor" : "none"} />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (property.id !== undefined && available) {
                    onDislike?.(property.id, !property.disliked);
                  }
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  property.disliked
                    ? 'text-red-500 bg-red-500/10'
                    : 'text-gray-300 hover:text-red-500'
                }`}
              >
                <ThumbsDown size={18} fill={property.disliked ? "currentColor" : "none"} />
              </button>

              {((!onScheduleTour && property.tourCount !== undefined && property.tourCount > 0) || 
                (property.comments && property.comments.length > 0)) && (
                <div className="w-px h-3 bg-gray-200 dark:bg-gray-800 mx-1" />
              )}

              {/* Status Indicators */}
              {!onScheduleTour && property.tourCount !== undefined && property.tourCount > 0 && (
                <div className="flex items-center text-[#111827] dark:text-white">
                  <Calendar size={12} />
                  <span className="text-[10px] font-black ml-1">{property.tourCount}</span>
                </div>
              )}
              {property.comments && property.comments.length > 0 && (
                <div className="flex items-center text-[#C9A24D]">
                  <MessageCircle size={14} />
                  <span className="text-[10px] font-bold ml-1">{property.comments.length}</span>
                </div>
              )}
            </div>
          </div>
          
          <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-wide uppercase line-clamp-1 mb-3">
            {cleanAddress(property.FullStreetAddress, property.City)}
          </h3>

          <div className="flex items-center gap-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
            <div className="flex items-center">
              <span className="text-[#111827] dark:text-white mr-1.5">{property.BedroomsTotal}</span>
              <span>Beds</span>
            </div>
            <div className="flex items-center">
              <span className="text-[#111827] dark:text-white mr-1.5">{property.BathroomsTotal}</span>
              <span>Baths</span>
            </div>
            {property.LivingArea && (
              <div className="flex items-center">
                <span className="text-[#111827] dark:text-white mr-1.5">{property.LivingArea.toLocaleString()}</span>
                <span>SqFt</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          {onScheduleTour ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (available) onScheduleTour?.(property);
              }}
              className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                property.hasTourScheduled
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                  : 'bg-gray-900 dark:bg-white/10 text-white dark:text-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-lg'
              }`}
            >
              {property.hasTourScheduled ? 'Scheduled' : 'Schedule Tour'}
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (available) onPropertyClick?.(property);
              }}
              className="w-full py-3 bg-gray-900 dark:bg-white/10 text-white dark:text-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:shadow-lg"
            >
               View Details
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default PropertyCard
