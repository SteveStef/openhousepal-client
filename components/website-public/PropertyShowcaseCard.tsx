'use client'

import { useEffect, useState } from 'react'
import { Bath, BedDouble, LandPlot, Ruler } from 'lucide-react'
import { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import { formatStatus, statusBadgeColor } from './listingFormat'
import OpenHouseChip from '@/components/OpenHouseChip'
import SpotlightChip from './SpotlightChip'
import type { MlsOpenHouse } from '@/lib/mlsOpenHouses'

export interface ShowcaseListing {
  listing_key: string
  address?: string | null
  city?: string | null
  state?: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  lot_size_acres?: number | null
  status?: string | null
  photo?: string | null
  photos?: string[] | null
  year_built?: number | null
  price_per_sqft?: number | null
  has_hoa?: boolean | null
  school_district?: string | null
  // Upcoming Bright open houses, soonest first - the "Open House" chip.
  open_houses?: MlsOpenHouse[] | null
  // The agent's own Listing Spotlight for this home, when one is published.
  spotlight_url?: string | null
}

// The Featured page's card - full-bleed photo, auto-rotating through every real photo on the
// listing (not just the cover shot) so a stunning property gets to show more than one angle
// without the visitor having to click in. `onQuickView` (when passed) intercepts the click to
// open the same-page quick-view modal instead of a full navigation - the href is kept either way
// so the card stays a real, right-clickable/middle-clickable link.
export default function PropertyShowcaseCard({ listing, theme, basePrefix = '', onQuickView, featured = false }: {
  listing: ShowcaseListing
  theme: SiteTheme
  basePrefix?: string
  onQuickView?: (listingKey: string) => void
  featured?: boolean
}) {
  const photos = (listing.photos && listing.photos.length > 0 ? listing.photos : listing.photo ? [listing.photo] : [])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (photos.length < 2) return
    const id = setInterval(() => setIndex(i => (i + 1) % photos.length), 3500)
    return () => clearInterval(id)
  }, [photos.length])

  // A div, not an <a>: the Spotlight chip inside is its own link (a link can't hold a link).
  const href = `${basePrefix}/properties/${encodeURIComponent(listing.listing_key)}`
  const open = () => { if (onQuickView) onQuickView(listing.listing_key); else window.location.assign(href) }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      className="ohp-card group relative block h-full cursor-pointer overflow-hidden rounded-[28px] bg-white shadow-[0_8px_40px_rgba(17,24,39,0.10)] ring-1 ring-black/[0.04] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(17,24,39,0.18)]"
    >
      <div className={`relative w-full overflow-hidden bg-gray-100 ${featured ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}>
        {photos.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="absolute inset-0 scale-105 bg-cover bg-center transition-opacity duration-1000 group-hover:scale-110"
            style={{ backgroundImage: `url(${url})`, opacity: i === index ? 1 : 0, transitionProperty: 'opacity, transform' }}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />

        <div className="absolute left-4 right-4 top-4 flex flex-col items-start gap-1.5">
          {listing.status && (
            <span
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow"
              style={{ backgroundColor: statusBadgeColor(listing.status).bg, color: statusBadgeColor(listing.status).fg }}
            >
              {formatStatus(listing.status)}
            </span>
          )}
          <OpenHouseChip openHouses={listing.open_houses} />
          <SpotlightChip url={listing.spotlight_url} />
        </div>

        {photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {photos.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
            ))}
          </div>
        )}

        {listing.price != null && (
          <p className={`absolute bottom-4 left-4 text-2xl font-black text-white drop-shadow-lg ${fontClass(theme.heading_font, 'font-serif')}`}>
            ${listing.price.toLocaleString()}
          </p>
        )}
      </div>

      <div className="p-5">
        <p className="truncate text-sm font-bold text-gray-800">
          {listing.address}{listing.city ? `, ${listing.city}` : ''}
        </p>
        {(listing as any).list_office_name && <p className="mt-1 truncate text-[10px] font-medium text-gray-400">Courtesy of {(listing as any).list_office_name}</p>}
        {(listing.bedrooms != null || listing.bathrooms != null || listing.living_area != null || listing.lot_size_acres != null) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-3 text-xs font-semibold text-gray-500">
            {listing.bedrooms != null && <span className="flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" style={{ color: theme.secondary_color }} /> {listing.bedrooms} bd</span>}
            {listing.bathrooms != null && <span className="flex items-center gap-1.5"><Bath className="h-3.5 w-3.5" style={{ color: theme.secondary_color }} /> {listing.bathrooms} ba</span>}
            {listing.living_area != null && <span className="flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5" style={{ color: theme.secondary_color }} /> {listing.living_area.toLocaleString()} sqft</span>}
            {listing.lot_size_acres != null && <span className="flex items-center gap-1.5"><LandPlot className="h-3.5 w-3.5" style={{ color: theme.secondary_color }} /> {listing.lot_size_acres.toFixed(listing.lot_size_acres < 1 ? 2 : 1)} ac</span>}
          </div>
        )}
      </div>
    </div>
  )
}
