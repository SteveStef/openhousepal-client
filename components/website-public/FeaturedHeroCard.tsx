'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import { ShowcaseListing } from './PropertyShowcaseCard'
import KioskPhotoLayer from './KioskPhotoLayer'
import ListingFactBar from './ListingFactBar'
import OpenHouseChip from '@/components/OpenHouseChip'
import SpotlightChip from './SpotlightChip'
import { isNewListing } from './listingFormat'

// The Featured page hero carousel's individual card (see FeaturedHeroCarousel) - real photos via
// the kiosk-style cycler (KioskPhotoLayer, adapted from the open house sign-in sheet's rotating
// display), all three panels showing the SAME featured listing, just different photos of it.
// `variant="hero"` is the large 7-col showcase card, carrying the full overlay chrome -
// price/address/stats (ListingFactBar)/features/CTA, in that order, all stacked directly on the
// photo. `variant="secondary"` is the two smaller side panels, deliberately left as pure photo - no
// overlay text at all - so they read as gallery glimpses of the house rather than competing info
// cards.
//
// When the carousel swaps in a different listing, the photo cross-fades (a plain, unhurried
// dissolve, not a directional slide) and - once that's mostly settled - the overlay text comes
// in as two separate, sequenced beats rather than one flat block: the stats row (ListingFactBar)
// emerges first (STATS_DELAY_S in), then price/address/features rise up out of it a beat later
// (PRICE_DELAY_S in, with a bigger initial y offset so they visibly travel up from around where
// the stats row just settled, not from a generic "below"). `revealDelay` (set by the carousel,
// staggered per panel) pushes both beats back a little further on the two side panels so the
// reveal cascades hero -> side -> side instead of all three panels moving in perfect lockstep.
const FADE_S = 1.9
// Same soft "expo out" curve throughout - a snappier material-style curve on just the photo was
// part of what made the whole sequence read as rushed/messy instead of one composed motion.
const FADE_EASE = [0.16, 1, 0.3, 1] as const
const STATS_DELAY_S = 0.75
const PRICE_DELAY_S = STATS_DELAY_S + 0.5
const INFO_EASE = [0.16, 1, 0.3, 1] as const

export default function FeaturedHeroCard({ listing, theme, basePrefix = '', variant = 'hero', hovered = false, onHoverChange, onQuickView, revealDelay = 0, effectOffset = 0 }: {
  listing: ShowcaseListing & { days_on_market?: number | null; features?: string[] }
  theme: SiteTheme
  basePrefix?: string
  variant?: 'hero' | 'secondary'
  hovered?: boolean
  onHoverChange?: (hovered: boolean) => void
  onQuickView?: (listingKey: string) => void
  revealDelay?: number
  // Offsets which Ken Burns effect (zoom/pan) KioskPhotoLayer starts on, so the two always-on
  // side panels don't end up doing the same zoom-in (or pan) at the same moment - see
  // FeaturedHeroCarousel, which gives the two panels different offsets.
  effectOffset?: number
}) {
  // Exit has no delay on either (the old info should get out of the way promptly); enter is
  // held back by STATS_DELAY_S/PRICE_DELAY_S (+ this panel's stagger) so each lands after the
  // photo fade rather than racing it - and price/address starts from further down (y: 70 vs.
  // the stats row's y: 24) so it visibly rises up out of where the stats row just emerged.
  const statsVariants = {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: INFO_EASE, delay: STATS_DELAY_S + revealDelay } },
    exit: { opacity: 0, transition: { duration: 0.3, ease: INFO_EASE } },
  }
  const priceVariants = {
    initial: { opacity: 0, y: 70 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.9, ease: INFO_EASE, delay: PRICE_DELAY_S + revealDelay } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.35, ease: INFO_EASE } },
  }
  const photos = listing.photos && listing.photos.length > 0 ? listing.photos : listing.photo ? [listing.photo] : []
  const isHero = variant === 'hero'
  const justListed = isNewListing(listing.days_on_market)

  // A div, not an <a>: the Spotlight chip inside is its own link (a link can't hold a link).
  const href = `${basePrefix}/properties/${encodeURIComponent(listing.listing_key)}`
  const open = () => { if (onQuickView) onQuickView(listing.listing_key); else window.location.assign(href) }
  return (
    <div
      role="link"
      tabIndex={0}
      data-ohp-qv={onQuickView ? listing.listing_key : undefined}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      className={`group relative block cursor-pointer overflow-hidden rounded-[28px] bg-gray-900 shadow-2xl ring-1 ring-white/10 transition duration-500 ${isHero ? 'aspect-[4/3.4] sm:aspect-auto sm:min-h-[684px]' : 'min-h-[230px] sm:min-h-[330px]'}`}
    >
      {/* A plain, unhurried cross-fade between listings - no directional slide. The two side
          panels run the full kiosk-style Ken Burns cycling continuously - always "on". The hero
          deliberately does NOT switch photos or effects on hover - see KioskPhotoLayer's
          non-active branch - it just holds its one cover photo and lets CSS do a slow, plain
          zoom-in via group-hover, since swapping through several photos/pan effects on hover was
          read as changing the picture rather than a considered zoom. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={listing.listing_key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_S, ease: FADE_EASE, delay: revealDelay }}
          className="absolute inset-0"
        >
          <KioskPhotoLayer photos={photos} active={!isHero} effectOffset={effectOffset} />
        </motion.div>
      </AnimatePresence>

      {/* Secondary panels are pure photo - no veil, no badges, no price/address; the hero alone
          carries the overlay text, so it's the only one that needs a legibility gradient. */}
      {isHero && (
        <>
          {/* Lighter than a first pass at this - dark enough for the bottom third (where price/
              address/stats actually sit) to stay legible, but no longer dims the whole photo,
              which was fighting the point of a full-bleed showcase photo. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

          <div className="absolute left-5 top-5 flex flex-wrap gap-2">
            <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow" style={{ backgroundColor: theme.secondary_color, color: theme.primary_color }}>
              Featured
            </span>
            {justListed && (
              <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow ">
                Just Listed{listing.days_on_market ? ` · ${listing.days_on_market}d` : ''}
              </span>
            )}
            <OpenHouseChip openHouses={listing.open_houses} className="self-center" />
            <SpotlightChip url={listing.spotlight_url} className="self-center" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 pb-5 sm:p-6 sm:pb-7">
            {/* Price/address/features - rises up second, after the stats row below has already
                emerged (see priceVariants/PRICE_DELAY_S above). */}
            <AnimatePresence mode="wait">
              <motion.div key={listing.listing_key} variants={priceVariants} initial="initial" animate="animate" exit="exit">
                {listing.price != null && (
                  <p className={`font-black text-white drop-shadow-lg ${fontClass(theme.heading_font, 'font-serif')} text-2xl sm:text-4xl`}>
                    ${listing.price.toLocaleString()}
                  </p>
                )}
                <p className="mt-1.5 truncate text-sm font-bold text-white/90 sm:text-base">{listing.address}</p>
                {(listing as any).list_office_name && <p className="mt-1 truncate text-[10px] font-medium text-white/60">Courtesy of {(listing as any).list_office_name}</p>}
                <p className="text-xs text-white/60">{[listing.city, listing.state].filter(Boolean).join(', ')}</p>

                {listing.features && listing.features.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {listing.features.map((f, i) => (
                      <span key={i} className="rounded-full border border-white/25 px-3 py-1 text-[11px] font-semibold text-white/80">{f}</span>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Its own full-width row at the very bottom of the block, not squeezed between
                address and features - see ListingFactBar. Emerges first (see statsVariants/
                STATS_DELAY_S above), with price/address rising up out of it a beat later. No
                separate "Quick View" hint below it either - that invisible-until-hover span
                still occupied layout space at rest, which was exactly what kept pushing this
                stats row further from price/address than it needed to be (the same bug already
                fixed once on the secondary cards); the whole card is already a link, so it
                isn't needed. */}
            <AnimatePresence mode="wait">
              <motion.div key={listing.listing_key} variants={statsVariants} initial="initial" animate="animate" exit="exit">
                <ListingFactBar listing={listing} theme={theme} />
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}
