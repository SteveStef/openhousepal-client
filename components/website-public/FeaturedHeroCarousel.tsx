'use client'

import { useEffect, useState } from 'react'
import { ShowcaseListing } from './PropertyShowcaseCard'
import FeaturedHeroCard from './FeaturedHeroCard'
import { ROTATE_MS as KIOSK_ROTATE_MS } from './KioskPhotoLayer'
import { SiteTheme } from './types'

// A listing stays up for 4 of the side panels' photo changes (KioskPhotoLayer ROTATE_MS, 4s each),
// so a listing change never lands mid-fade on the side panels.
const ROTATE_MS = KIOSK_ROTATE_MS * 4
// Per-panel stagger (seconds) so the hero and the two side panels don't fade/slide-up at the
// exact same instant - see FeaturedHeroCard's revealDelay. Wide enough that each panel's fade
// visibly finishes settling before the next one starts, rather than overlapping into a busy,
// rushed-looking pile-up of simultaneous motion.
const REVEAL_STAGGER_S = 0.4

type CarouselListing = ShowcaseListing & { days_on_market?: number | null; features?: string[] }

// The two side panels never repeat the big photo on the left (photo 0 - it's already showing):
// they split the rest between them, alternating, so they never show the same photo either.
function sidePhotos(photos: string[]): [string[], string[]] {
  const rest = photos.slice(1)
  if (rest.length === 0) return [photos, photos]
  if (rest.length === 1) return [rest, rest]
  return [rest.filter((_, i) => i % 2 === 0), rest.filter((_, i) => i % 2 === 1)]
}

// The Featured page's top hero - one "listing of the moment" pulled from up to 10 properties
// chosen by the agent's own Featured page settings (order already decided server-side by
// content_adapters.get_featured_page_listings - this component just walks a cursor through
// whatever order it was given). Rather than 3 different properties side by side, all three
// panels (1 large + 2 smaller, the existing bento layout) show real photos of THAT SAME listing
// - the two side panels are simply other angles of the house on the left, not separate listings
// - so the group reads as one considered showcase instead of 3 unrelated cards competing for
// attention. Dots (position within the pool) sit under the hero panel only. Auto-advance pauses
// the instant a visitor hovers any of the 3 panels - see FeaturedHeroCard, which turns that same
// hover into the real kiosk-style photo animation (KioskPhotoLayer) on all three at once.
export default function FeaturedHeroCarousel({ listings, theme, basePrefix, onQuickView }: {
  listings: CarouselListing[]
  theme: SiteTheme
  basePrefix?: string
  onQuickView?: (listingKey: string) => void
}) {
  const n = listings.length
  const canRotate = n > 1
  const [cursor, setCursor] = useState(0)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    setCursor(0)
  }, [n])

  useEffect(() => {
    if (!canRotate || hovered) return
    const id = setInterval(() => setCursor(c => (c + 1) % n), ROTATE_MS)
    return () => clearInterval(id)
  }, [canRotate, hovered, n])

  if (n === 0) return null

  const hero = listings[cursor]
  const heroPhotos = hero.photos && hero.photos.length > 0 ? hero.photos : hero.photo ? [hero.photo] : []
  const [sideA, sideB] = sidePhotos(heroPhotos)
  const secondaryA: CarouselListing = { ...hero, photos: sideA }
  const secondaryB: CarouselListing = { ...hero, photos: sideB }
  const showSecondary = heroPhotos.length > 0

  const hoverProps = { hovered, onHoverChange: setHovered }

  return (
    <div className="relative mx-auto mt-6 max-w-7xl">
      {/* Photo row only contains the 3 cards themselves - nothing else - on both sides, so their
          natural heights (hero's min-h vs. 2x secondary's min-h + the gap between them, sized to
          match exactly - see FeaturedHeroCard) line up top and bottom without fighting CSS
          grid's stretch behavior over a taller sibling. The dots live in their own row
          underneath, constrained to the same width as the hero column. Stats/price/address all
          live directly on the hero photo itself now - see FeaturedHeroCard/ListingFactBar. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <FeaturedHeroCard listing={hero} theme={theme} basePrefix={basePrefix} variant="hero" onQuickView={onQuickView} revealDelay={0} {...hoverProps} />
        </div>

        {showSecondary && (
          // Phones: just the featured home - the two side panels are computers only.
          <div className="hidden min-w-0 grid-cols-1 gap-6 lg:col-span-5 lg:grid">
            {/* Both panels mount together and share KioskPhotoLayer's fixed rotation clock, so
                the same effectOffset puts them in lockstep - same Ken Burns move, same moment -
                reading as one considered showcase rather than two panels doing their own thing. */}
            <FeaturedHeroCard listing={secondaryA} theme={theme} basePrefix={basePrefix} variant="secondary" onQuickView={onQuickView} revealDelay={REVEAL_STAGGER_S} effectOffset={0} {...hoverProps} />
            <FeaturedHeroCard listing={secondaryB} theme={theme} basePrefix={basePrefix} variant="secondary" onQuickView={onQuickView} revealDelay={REVEAL_STAGGER_S * 2} effectOffset={0} {...hoverProps} />
          </div>
        )}
      </div>

      {canRotate && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <div className="mt-4 flex items-center justify-center gap-1.5">
              {listings.map((l, i) => (
                <button
                  key={l.listing_key}
                  onClick={() => setCursor(i)}
                  aria-label={`Show property ${i + 1}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: i === cursor ? 28 : 6, backgroundColor: i === cursor ? theme.secondary_color : 'rgba(255,255,255,0.3)' }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
