'use client'

import { Bed, Bath, Ruler, Clock, Users, CalendarCheck, Star, BarChart3, UserCog, Home, Trash2 } from 'lucide-react'
import { MyListingItem } from '@/types'
import StatusBadge from './StatusBadge'

function formatPrice(price?: number | null) {
  if (!price) return 'Price unavailable'
  return `$${Number(price).toLocaleString()}`
}

export default function ListingCard({
  listing,
  onViewInsights,
  onManageHosts,
  onRequestRemove,
}: {
  listing: MyListingItem
  onViewInsights: (listingKey: string) => void
  onManageHosts: (listingKey: string) => void
  onRequestRemove?: (listingKey: string) => void
}) {
  const cityState = [listing.city, listing.state].filter(Boolean).join(', ')

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white dark:bg-[#151517] shadow-sm transition ${listing.is_high_priority ? 'border-[#C9A24D]/50' : 'border-gray-100 dark:border-gray-800'}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        {listing.image ? (
          <img src={listing.image} alt={listing.address} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-700">
            <Home size={28} />
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {typeof listing.days_on_market === 'number' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-white">
              <Clock size={10} /> {listing.days_on_market} days
            </span>
          )}
          {listing.is_high_priority && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#C9A24D] px-2.5 py-1 text-[10px] font-black text-white">
              <Star size={10} fill="currentColor" /> Priority
            </span>
          )}
          {listing.is_manual && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-black text-white">Manual</span>
          )}
        </div>
        {listing.is_manual && onRequestRemove && (
          <button
            onClick={() => onRequestRemove(listing.listing_key)}
            className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white transition hover:bg-red-600"
            aria-label="Remove this manually added listing"
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-[#111827] dark:text-white">{listing.address}</p>
            {cityState && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{cityState}{listing.zipcode ? ` ${listing.zipcode}` : ''}</p>}
          </div>
          <p className="shrink-0 text-lg font-black text-[#111827] dark:text-white">{formatPrice(listing.price)}</p>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs font-bold text-gray-500 dark:text-gray-400">
          {listing.bedrooms != null && <span className="inline-flex items-center gap-1"><Bed size={13} /> {listing.bedrooms} bed</span>}
          {listing.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath size={13} /> {listing.bathrooms} bath</span>}
          {listing.living_area != null && <span className="inline-flex items-center gap-1"><Ruler size={13} /> {Number(listing.living_area).toLocaleString()} sqft</span>}
        </div>

        <div className="mt-3">
          <StatusBadge status={listing.open_house_status} />
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs font-bold text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1"><Users size={13} /> {listing.avg_guests_per_open} avg guests/open</span>
          <span className="inline-flex items-center gap-1"><CalendarCheck size={13} /> {listing.opens_hosted_count} opens hosted</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => onViewInsights(listing.listing_key)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-xs font-black text-[#111827] dark:text-white transition hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <BarChart3 size={14} /> View Insights
          </button>
          <button
            onClick={() => onManageHosts(listing.listing_key)}
            className="relative flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] dark:bg-white px-3 py-2.5 text-xs font-black text-white dark:text-[#111827] transition hover:bg-black dark:hover:bg-gray-200"
          >
            <UserCog size={14} /> Manage Hosts
            {listing.pending_request_count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C9A24D] px-1 text-[10px] font-black text-white">
                {listing.pending_request_count}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
