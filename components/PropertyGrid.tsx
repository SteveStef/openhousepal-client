'use client'

import { Property } from '@/types'
import PropertyCard from './PropertyCard'

interface PropertyGridProps {
  properties: Property[]
  title?: string
  onLike?: (propertyId: number, liked: boolean) => void
  onDislike?: (propertyId: number, disliked: boolean) => void
  onFavorite?: (propertyId: number, favorited: boolean) => void
  onPropertyClick?: (property: Property) => void
}

export default function PropertyGrid({ properties, title = "Properties", onLike, onDislike, onFavorite, onPropertyClick }: PropertyGridProps) {
  if (properties.length === 0) {
    return (
      <div className="bg-zinc-900/20 rounded-2xl shadow-xl border border-zinc-800/30 backdrop-blur-lg p-8">
        <h2 className="text-2xl font-bold text-white mb-6 font-light">{title}</h2>
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-zinc-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2 font-light">No properties found</h3>
          <p className="text-zinc-400 font-light">Properties will appear here when they match customer preferences</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900/20 rounded-2xl shadow-xl border border-zinc-800/30 backdrop-blur-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white font-light">{title}</h2>
          <p className="text-zinc-400 text-sm font-light mt-1">Click on any property to view details or schedule tours</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800/50 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
          </button>
          <button className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800/50 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
            </svg>
          </button>
          <span className="text-sm text-zinc-400 bg-zinc-900/60 px-3 py-1 rounded-full border border-zinc-700/40">
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
            onFavorite={onFavorite}
            onPropertyClick={onPropertyClick}
          />
        ))}
      </div>
    </div>
  )
}