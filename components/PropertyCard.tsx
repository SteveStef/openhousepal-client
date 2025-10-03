'use client'

import { Property } from '@/types'
import { ThumbsUp, ThumbsDown, Bookmark, MessageCircle } from 'lucide-react'

interface PropertyCardProps {
  property: Property
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onFavorite?: (propertyId: string | number, favorited: boolean) => void
  onPropertyClick?: (property: Property) => void
  onScheduleTour?: (property: Property) => void
}

export default function PropertyCard({ property, onLike, onDislike, onFavorite, onPropertyClick, onScheduleTour }: PropertyCardProps) {
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
      className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:-translate-y-1 hover:bg-gray-50 group cursor-pointer backdrop-blur-sm flex flex-col h-full shadow-sm hover:shadow-lg"
    >
      {/* Property Image */}
      <div className="relative h-48 bg-gray-100">
        {property.imageUrl ? (
          <img
            src={property.imageUrl}
            alt={property.address}
            className="w-full h-full object-cover transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
        )}
        
        {/* Price Badge */}
        <div className="absolute top-4 left-4">
          <span className="bg-[#8b7355] text-white font-semibold px-3 py-1 rounded-full text-sm backdrop-blur-sm border border-[#7a6549]">
            {formatPrice(property.price)}
          </span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span className="bg-green-900/80 text-green-300 font-semibold px-3 py-1 rounded-full text-xs backdrop-blur-sm border border-green-700/40">
            Available
          </span>
        </div>
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

        {/* Property Type and Quick Actions */}
        {property.propertyType && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full border border-gray-200">
              {property.propertyType[0]}{property.propertyType?.toLowerCase().substring(1,property.propertyType?.length)}
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
                {property.visitorInteractions && property.visitorInteractions.filter(vi => vi.liked).length > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    title={`${property.visitorInteractions.filter(vi => vi.liked).length} visitor(s) liked this property`}
                  >
                    {property.visitorInteractions.filter(vi => vi.liked).length}
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
                {property.visitorInteractions && property.visitorInteractions.filter(vi => vi.disliked).length > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    title={`${property.visitorInteractions.filter(vi => vi.disliked).length} visitor(s) disliked this property`}
                  >
                    {property.visitorInteractions.filter(vi => vi.disliked).length}
                  </span>
                )}
              </div>
              {/* Favorite button with visitor count */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavorite?.(Number(property.id!), !property.favorited);
                  }}
                  className={`flex items-center transition-colors p-1 rounded-md hover:bg-gray-100 ${
                    property.favorited 
                      ? 'text-amber-400 hover:text-amber-300' 
                      : 'text-gray-400 hover:text-amber-500'
                  }`}
                  title={`${property.favorited ? 'Remove from favorites' : 'Add to favorites'}`}
                >
                  <Bookmark 
                    size={16} 
                    fill={property.favorited ? "currentColor" : "none"}
                  />
                </button>
                {property.visitorInteractions && property.visitorInteractions.filter(vi => vi.favorited).length > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    title={`${property.visitorInteractions.filter(vi => vi.favorited).length} visitor(s) favorited this property`}
                  >
                    {property.visitorInteractions.filter(vi => vi.favorited).length}
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
        )}
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onScheduleTour?.(property);
            }}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-800 font-medium py-2 px-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-300 text-xs"
          >
            Schedule Tour
          </button>
        </div>
      </div>
    </div>
  )
}
