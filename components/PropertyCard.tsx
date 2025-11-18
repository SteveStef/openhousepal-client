'use client'

import { useMemo, memo } from 'react'
import Image from 'next/image'
import { Property } from '@/types'
import { ThumbsUp, ThumbsDown, Star, MessageCircle, Calendar, Eye } from 'lucide-react'

interface PropertyCardProps {
  property: Property
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onFavorite?: (propertyId: string | number, favorited: boolean) => void
  onPropertyClick?: (property: Property) => void
  onScheduleTour?: (property: Property) => void
  showDetailedViewCount?: boolean // If true, shows "X views", if false shows just "Viewed"
  showNewForUnviewed?: boolean // If true, shows NEW badge when viewCount === 0, if false uses property.is_new
}

const PropertyCard = memo(function PropertyCard({ property, onLike, onDislike, onFavorite, onPropertyClick, onScheduleTour, showDetailedViewCount = false, showNewForUnviewed = false }: PropertyCardProps) {
  // Memoize visitor interaction counts to avoid redundant filtering on every render
  const interactionCounts = useMemo(() => {
    if (!property.visitorInteractions) {
      return { liked: 0, disliked: 0, favorited: 0 }
    }
    return {
      liked: property.visitorInteractions.filter(vi => vi.liked).length,
      disliked: property.visitorInteractions.filter(vi => vi.disliked).length,
      favorited: property.visitorInteractions.filter(vi => vi.favorited).length
    }
  }, [property.visitorInteractions])

  const formatPrice = (price?: number) => {
    return price ? price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }) : 'Price Available Upon Request'
  }

  return (
    <div
      onClick={() => onPropertyClick?.(property)}
      className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-transform duration-200 hover:-translate-y-1 group cursor-pointer flex flex-col h-full shadow-sm hover:shadow-lg will-change-transform"
    >
      {/* Property Image */}
      <div className="relative bg-gray-100 aspect-[16/9]">
        {property.imageUrl ? (
          <Image
            src={property.imageUrl}
            alt={property.address}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
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

        {/* NEW Badge - Top Right (only for visitor view when unviewed) */}
        {showNewForUnviewed && (!property.viewCount || property.viewCount === 0) && (
          <div className="absolute top-4 right-4" title="Not yet viewed">
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-3 py-1 rounded-full text-xs shadow-lg border-2 border-white">
              NEW
            </span>
          </div>
        )}

        {/* View Count Badge */}
        {showDetailedViewCount ? (
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
      <div className="p-5">
        <p className="text-gray-500 text-xs mb-1 font-light uppercase tracking-wide">
          {property.city}, {property.state} {property.zipCode}
        </p>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-4 font-light group-hover:text-gray-800 transition-colors">
          {property.address}
        </h3>

        {/* Property Stats */}
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-gray-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
            </svg>
            <span>{property.beds} beds</span>
          </div>
          
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path>
              </svg>
              <span>{property.baths} baths</span>
            </div>
          
          {property.squareFeet && (
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
              </svg>
              <span>{property.squareFeet.toLocaleString()} sqft</span>
            </div>
          )}
        </div>

        {/* Price and Quick Actions */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-base font-bold text-[#8b7355]">
            Price: {formatPrice(property.price)}
          </span>
            
            <div className="flex items-center space-x-2">
              {/* Like button with visitor count */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (property.id !== undefined) {
                      onLike?.(property.id, !property.liked);
                    }
                  }}
                  className={`flex items-center transition-colors p-1 rounded-md hover:bg-gray-100 ${
                    property.liked 
                      ? 'text-green-400 hover:text-green-300' 
                      : 'text-gray-400 hover:text-green-500'
                  }`}
                  title={`${property.liked ? 'Unlike' : 'Like'} this property`}
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
                    if (property.id !== undefined) {
                      onDislike?.(property.id, !property.disliked);
                    }
                  }}
                  className={`flex items-center transition-colors p-1 rounded-md hover:bg-gray-100 ${
                    property.disliked 
                      ? 'text-red-400 hover:text-red-300' 
                      : 'text-gray-400 hover:text-red-500'
                  }`}
                  title={`${property.disliked ? 'Remove dislike' : 'Dislike'} this property`}
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
              {/* Favorite button with visitor count */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavorite?.(property.id!, !property.favorited);
                  }}
                  className={`flex items-center transition-colors p-1 rounded-md hover:bg-gray-100 ${
                    property.favorited
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-gray-400 hover:text-amber-500'
                  }`}
                  title={`${property.favorited ? 'Remove from favorites' : 'Add to favorites'}`}
                >
                  <Star
                    size={16}
                    fill={property.favorited ? "currentColor" : "none"}
                  />
                </button>
                {interactionCounts.favorited > 0 && (
                  <span
                    className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    title={`${interactionCounts.favorited} visitor(s) favorited this property`}
                  >
                    {interactionCounts.favorited}
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
      <div className="px-5 pb-5 mt-auto">
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPropertyClick?.(property);
            }}
            className="flex-1 bg-[#8b7355] hover:bg-[#7a6549] text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 border border-[#8b7355] text-xs"
          >
            View Details
          </button>
          {onScheduleTour ? (
            property.hasTourScheduled ? (
              <div className="flex items-center space-x-1 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span className="text-green-700 font-medium">Tour Scheduled</span>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onScheduleTour?.(property);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-800 font-medium py-2 px-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-300 text-xs"
              >
                Schedule Tour
              </button>
            )
          ) : (
            <div className="flex items-center space-x-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
              <Calendar size={14} className="text-blue-600" />
              <span className="text-blue-700 font-medium">
                {property.tourCount || 0} {property.tourCount === 1 ? 'tour' : 'tours'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default PropertyCard
