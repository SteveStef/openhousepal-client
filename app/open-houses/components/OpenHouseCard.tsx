'use client'

import { memo } from 'react'
import Image from 'next/image'
import { Bed, Bath, BoxSelect, DollarSign } from 'lucide-react'
import { OpenHouse } from '@/types'

interface OpenHouseCardProps {
  openHouse: OpenHouse;
  index: number;
  onViewVisitors: (openHouse: OpenHouse) => void;
  onViewPDF: (openHouse: OpenHouse) => void;
  onDelete: (openHouse: OpenHouse) => void;
  onAddNote: (openHouse: OpenHouse) => void;
  formatAddress: (address: string) => string;
}

export const OpenHouseCard = memo(function OpenHouseCard({
  openHouse,
  index,
  onViewVisitors,
  onViewPDF,
  onDelete,
  onAddNote,
  formatAddress
}: OpenHouseCardProps) {
  return (
    <div
      onClick={() => onViewVisitors(openHouse)}
      className="group relative flex flex-col sm:flex-row bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer h-auto sm:h-40 isolate transform-gpu"
    >
      {/* Left Side: Image */}
      <div className="relative h-40 sm:h-full w-full sm:w-56 flex-shrink-0 bg-gray-100 dark:bg-[#202022]">
        <Image
          src={openHouse.coverImageUrl || (openHouse as any).cover_image_url || "/placeholder.svg"}
          alt={`Property at ${openHouse.address}`}
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover"
        />
        {/* Subtle Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 sm:bg-gradient-to-tr sm:from-black/50 sm:via-transparent sm:to-transparent"></div>
      </div>

      {/* Right Side: Content */}
      <div className="flex-1 flex flex-col p-3.5 min-w-0 gap-2">
        
        {/* Top Row: Title + Overflow */}
        <div className="flex items-start justify-between gap-3">
          <h3 
            className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 leading-tight truncate"
            title={openHouse.address}
          >
            {formatAddress(openHouse.address)}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(openHouse)
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors -mr-1.5 -mt-1.5"
            title="Options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
          {/* Beds */}
          <div className="flex items-center gap-1">
            <Bed className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="font-semibold">{openHouse.BedroomsTotal || (openHouse as any).bedrooms || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">Beds</span>
          </div>
          {/* Baths */}
          <div className="flex items-center gap-1">
            <Bath className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="font-semibold">{openHouse.BathroomsTotal || (openHouse as any).bathrooms || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">Baths</span>
          </div>
           {/* SqFt */}
           <div className="flex items-center gap-1">
            <BoxSelect className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="font-semibold">{(openHouse.LivingArea || (openHouse as any).living_area || (openHouse as any).livingArea)?.toLocaleString() || '-'}</span>
            <span className="text-gray-400 dark:text-gray-600 text-[10px]">SqFt</span>
          </div>
          {/* Price */}
          {(openHouse.ListPrice || (openHouse as any).price) && (
            <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-3">
              <DollarSign className="w-3.5 h-3.5 text-[#8b7355] dark:text-[#C9A24D]" />
              <span className="font-bold text-[#8b7355] dark:text-[#C9A24D]">
                {(openHouse.ListPrice || (openHouse as any).price).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0
                })}
              </span>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="mt-auto pt-1.5 flex flex-row items-center gap-2">
          
          {/* Primary CTA */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewVisitors(openHouse)
            }}
            className="flex-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors border border-transparent dark:border-white/5"
          >
            Visitors
          </button>

          {/* Secondary Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onViewPDF(openHouse) }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#202022] hover:bg-gray-100 dark:hover:bg-[#2c2c2e] border border-gray-200 dark:border-gray-800 transition-colors group/btn"
              title="View PDFs"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover/btn:text-[#8b7355] dark:group-hover/btn:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">PDFs</span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAddNote(openHouse) }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#202022] hover:bg-gray-100 dark:hover:bg-[#2c2c2e] border border-gray-200 dark:border-gray-800 transition-colors group/btn"
              title="Add Note"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover/btn:text-[#8b7355] dark:group-hover/btn:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Note</span>
            </button>

            <a
              href={openHouse.formUrl || (openHouse as any).form_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#202022] hover:bg-gray-100 dark:hover:bg-[#2c2c2e] border border-gray-200 dark:border-gray-800 transition-colors group/btn"
              title="Open Form Link"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 group-hover/btn:text-[#8b7355] dark:group-hover/btn:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">Link</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})
