import { MapPin } from 'lucide-react'

// Bold white pill with a MapPin icon, bottom-center of a listing photo - the one place a
// listing's city shows on any card now (the address line under/over the photo is street-only,
// no "City, ST" repeated next to it - see listingFormat.ts's _listing_card comment). Shared by
// every card component across the site (Search's grid/map/list cards, the Featured page's hero
// and grid cards) so the treatment stays identical everywhere.
export default function CityPill({ city, offsetClass = 'bottom-3' }: { city?: string | null; offsetClass?: string }) {
  if (!city) return null
  return (
    <span className={`absolute left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[11px] font-black text-white shadow ${offsetClass}`}>
      <MapPin className="h-3 w-3" /> {city}
    </span>
  )
}
