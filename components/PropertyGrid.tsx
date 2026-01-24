'use client'

import { Property } from '@/types'
import PropertyCard from './PropertyCard'

interface PropertyGridProps {
  properties: Property[]
  title?: string
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onPropertyClick?: (property: Property) => void
  onScheduleTour?: (property: Property) => void
  showDetailedViewCount?: boolean
  showNewForUnviewed?: boolean
}

export default function PropertyGrid({ properties, title = "Properties", onLike, onDislike, onPropertyClick, onScheduleTour, showDetailedViewCount = false, showNewForUnviewed = false }: PropertyGridProps) {
  if (properties.length === 0) {
    return (
      <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
          <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
          </svg>
        </div>
        <h3 className="text-xl font-black text-[#0B0B0B] mb-2 tracking-tight">No properties found</h3>
        <p className="text-[#6B7280]">Properties will appear here when they match customer preferences</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0B0B0B] tracking-tight">{title}</h2>
          <p className="text-[#6B7280] text-sm mt-1">Click on any property to view details or schedule tours</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-[#6B7280] bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm whitespace-nowrap uppercase tracking-wider">
            {properties.length} {properties.length === 1 ? 'property' : 'properties'}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onLike={onLike}
            onDislike={onDislike}
            onPropertyClick={onPropertyClick}
            onScheduleTour={onScheduleTour}
            showDetailedViewCount={showDetailedViewCount}
            showNewForUnviewed={showNewForUnviewed}
          />
        ))}
      </div>
    </div>
  )
}
