'use client'

import HubCinema, { HomeOverlay } from '@/components/agent-hub/HubCinema'
import OpenHouseChip from '@/components/OpenHouseChip'
import type { MlsOpenHouse } from '@/lib/mlsOpenHouses'
import { formatSaleStatus, getSaleStatusClass, getStreetOnly } from '@/lib/agentSales'

type HeroListing = {
  id: string
  address: string
  city: string
  state: string
  price?: number
  status?: string
  image?: string
  photos?: string[]
  beds?: number
  baths?: number
  sqft?: number
  // The "smart QR" destination for this exact property (the agent's own Listing Spotlight if
  // they made one, else the generic one-page property view) - falls back to `linkHref` (the
  // Sales page, where current listings lead) when not resolved. See resolve_listing_link.
  listingLinkUrl?: string | null
  // Upcoming Bright open houses (soonest first) - shown as the "Open House" chip.
  open_houses?: MlsOpenHouse[]
}

const fmtNum = (value?: number) => (value === undefined || value === null ? '' : String(value))

const listingStats = (listing: HeroListing) => [
  listing.beds ? `${fmtNum(listing.beds)} bd` : '',
  listing.baths ? `${fmtNum(listing.baths)} ba` : '',
  listing.sqft ? `${Number(listing.sqft).toLocaleString()} sqft` : '',
].filter(Boolean).join(' · ')

const titleOf = (l: HeroListing) => `${getStreetOnly(l.address)}${l.city ? `, ${l.city}` : ''}`

// One listing: cut through THAT listing's own photos while the price/address stay put. Two or
// more: cut between listings, each one's words rising in as it lands. Same HubCinema engine as
// Recent Sales (seam of light, slow drift, segments), in the metal frame on Luxe.
export default function ListingHeroCarousel({
  listings,
  linkHref,
  intervalMs = 4500,
  autoScroll = true,
  luxe = false,
}: {
  listings: HeroListing[]
  linkHref?: string
  intervalMs?: number
  autoScroll?: boolean
  luxe?: boolean
}) {
  if (!listings.length) return null
  const overlayFor = (l: HeroListing, still: boolean) => (
    <HomeOverlay
      luxe={luxe}
      still={still}
      status={formatSaleStatus(l.status)}
      statusClass={getSaleStatusClass(l.status)}
      price={l.price ? `$${l.price.toLocaleString()}` : 'Price upon request'}
      title={titleOf(l)}
      sub={listingStats(l) || undefined}
      badge={l.open_houses?.length ? <OpenHouseChip openHouses={l.open_houses} variant={luxe ? 'luxe' : 'classic'} /> : undefined}
    />
  )

  if (listings.length === 1) {
    const l = listings[0]
    const photos = (l.photos && l.photos.length ? l.photos : [l.image || '']).filter(Boolean)
    return (
      <HubCinema
        height={240}
        intervalMs={Math.max(intervalMs, 4500)}
        autoScroll={autoScroll}
        luxe={luxe}
        staticOverlay={overlayFor(l, true)}
        slides={(photos.length ? photos : ['']).map((photo, i) => ({ id: `${l.id}-${i}`, image: photo, href: l.listingLinkUrl || linkHref }))}
      />
    )
  }

  return (
    <HubCinema
      height={240}
      intervalMs={intervalMs}
      autoScroll={autoScroll}
      luxe={luxe}
      slides={listings.map(l => ({ id: l.id, image: l.image || l.photos?.[0], href: l.listingLinkUrl || linkHref, overlay: overlayFor(l, false) }))}
    />
  )
}
