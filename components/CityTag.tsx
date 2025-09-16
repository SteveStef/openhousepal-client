'use client'

import { X } from 'lucide-react'

interface CityTagProps {
  city: string
  onRemove: (city: string) => void
  className?: string
}

export default function CityTag({ city, onRemove, className = '' }: CityTagProps) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#8b7355] text-white border border-[#8b7355] transition-all duration-200 hover:bg-[#7a6549] hover:border-[#7a6549] ${className}`}>
      <span className="truncate max-w-[150px]">{city}</span>
      <button
        type="button"
        onClick={() => onRemove(city)}
        className="ml-2 hover:bg-white/20 rounded-full p-0.5 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-white/50"
        aria-label={`Remove ${city}`}
      >
        <X size={14} />
      </button>
    </span>
  )
}