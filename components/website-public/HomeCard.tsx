'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bath, BedDouble, Camera, Eye, Heart, LandPlot, MessageCircle, Ruler } from 'lucide-react'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import { cleanStreet, formatStatus, isNewListing, listedAgo, statusBadgeColor, tidyCaps } from './listingFormat'
import OpenHouseChip from '@/components/OpenHouseChip'
import SpotlightChip from './SpotlightChip'
import type { ShowcaseListing } from './PropertyShowcaseCard'
import SitePhoto from './SitePhoto'
import { IMG } from '@/lib/siteImage'

export type HomeCardListing = ShowcaseListing & { days_on_market?: number | null; list_office_name?: string | null; features?: string[] | null }

// The site's home card, in both looks. Photo up top (hovering walks through the home's real
// photos; a "1/24" count shows there's more), price on the photo, then the street, town and the
// facts. Two quick actions float on the photo: "Ask" (a question about THIS home, address filled
// in) and the heart (get homes like this one first - the Showcase request form); both open the
// agent's forms in a window (SiteFormLauncher). The card itself opens the quick view when
// `onQuickView` is passed, else the home's page. IDX: "Courtesy of" the listing office always.
export default function HomeCard({ listing, theme, basePrefix = '', onQuickView, wide = false }: {
  listing: HomeCardListing
  theme: SiteTheme
  basePrefix?: string
  onQuickView?: (listingKey: string) => void
  /** Spans two grid columns - same photo height, a wider panorama. */
  wide?: boolean
}) {
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  const photos = (listing.photos && listing.photos.length ? listing.photos : listing.photo ? [listing.photo] : []).slice(0, 8)
  const [i, setI] = useState(0)
  const [hover, setHover] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!hover || photos.length < 2) return
    // First change soon after the pointer lands, then a calm 4s per photo (owner's call, 10/07).
    const first = setTimeout(() => {
      setI(v => (v + 1) % photos.length)
      timer.current = setInterval(() => setI(v => (v + 1) % photos.length), 4000)
    }, 900)
    return () => { clearTimeout(first); if (timer.current) clearInterval(timer.current) }
  }, [hover, photos.length])
  useEffect(() => { if (!hover) setI(0) }, [hover])

  const href = listing.spotlight_url || `${basePrefix}/properties/${encodeURIComponent(listing.listing_key)}`
  const open = () => { if (onQuickView && !listing.spotlight_url) onQuickView(listing.listing_key); else window.location.assign(href) }
  const street = cleanStreet(listing.address, listing.city)
  const full = [street, listing.city, listing.state].filter(Boolean).join(', ')
  const fresh = isNewListing(listing.days_on_market)
  const badge = statusBadgeColor(listing.status)
  const facts = [
    listing.bedrooms != null ? { icon: BedDouble, v: `${listing.bedrooms}`, l: 'bd' } : null,
    listing.bathrooms != null ? { icon: Bath, v: `${listing.bathrooms}`, l: 'ba' } : null,
    listing.living_area != null ? { icon: Ruler, v: Math.round(listing.living_area).toLocaleString('en-US'), l: 'sqft' } : null,
    listing.lot_size_acres != null ? { icon: LandPlot, v: listing.lot_size_acres.toFixed(listing.lot_size_acres < 1 ? 2 : 1), l: 'ac' } : null,
  ].filter(Boolean) as { icon: typeof Bath; v: string; l: string }[]
  const prefill = JSON.stringify({ property_of_interest: full, address: full })
  // The heart: homes like this one (same town, a price band around it, at least its bedrooms) -
  // opens the short Save window (SaveSearchWindow) via SiteFormLauncher.
  const criteria = JSON.stringify({
    kind: 'home', cities: listing.city ? [listing.city] : [],
    min_price: listing.price ? Math.round(listing.price * 0.8 / 5000) * 5000 : undefined,
    max_price: listing.price ? Math.round(listing.price * 1.2 / 5000) * 5000 : undefined,
    min_beds: listing.bedrooms || undefined,
    home: { address: full, photo: photos[0] || null, price: listing.price ?? null },
  })

  return (
    <div
      role="link" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter') open() }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      data-testid="home-card"
      data-ohp-qv={onQuickView && !listing.spotlight_url ? listing.listing_key : undefined}
      className={`ohp-home-card group relative flex h-full cursor-pointer flex-col overflow-hidden border transition duration-500 hover:-translate-y-1.5 ${luxe ? 'rounded-[26px]' : 'rounded-2xl'}`}
      style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }}
    >
      <div className={`relative w-full overflow-hidden ${wide ? 'h-64 sm:h-72' : 'h-64 sm:h-72'}`} style={{ backgroundColor: 'var(--site-bg-alt)' }}>
        {/* Only the cover loads with the page (right-sized, lazy); while hovered, the photo on
            screen and the next one - never all 8 photos of every card up front (10/19 sweep). */}
        {photos.map((url, k) => (k === 0 || (hover && (k === i || k === (i + 1) % photos.length))) && (
          <SitePhoto key={`${url}-${k}`} src={url} widths={IMG.card} sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className={`ohp-mls-crop absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ${k === i ? 'opacity-100' : 'opacity-0'} ${hover ? 'scale-[1.05]' : 'scale-100'}`}
            style={{ transitionDuration: '1000ms, 6000ms' }} />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/25" />
        {luxe && <span aria-hidden className="ohp-card-sheen pointer-events-none absolute inset-0" />}

        <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-1.5">
          {listing.status && <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow ${luxe ? 'rounded-full' : 'rounded-md'}`} style={{ backgroundColor: badge.bg, color: badge.fg }}>{formatStatus(listing.status)}</span>}
          {fresh && <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow ${luxe ? 'rounded-full' : 'rounded-md'}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>New</span>}
          <OpenHouseChip openHouses={listing.open_houses} />
          <SpotlightChip url={listing.spotlight_url} />
        </div>

        <div className="absolute right-3.5 top-3.5 flex flex-col gap-1.5 opacity-100 transition duration-300 sm:translate-x-2 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100">
          <a href={`${basePrefix}/create-showcase?site_chrome=1`} data-ohp-form="showcase_request" data-ohp-form-title="Get homes like this first" data-ohp-prefill={prefill} data-ohp-criteria={criteria}
            onClick={e => e.stopPropagation()} aria-label="Get homes like this first" title="Get homes like this first"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#111827] shadow-lg transition hover:scale-110 hover:text-rose-500"><Heart className="h-4 w-4" /></a>
          <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title="Ask about this home" data-ohp-prefill={prefill}
            onClick={e => e.stopPropagation()} aria-label="Ask about this home" title="Ask about this home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#111827] shadow-lg transition hover:scale-110"><MessageCircle className="h-4 w-4" /></a>
        </div>

        <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3">
          {listing.price != null && (
            <p className={`text-[26px] leading-none text-white drop-shadow-lg ${luxe ? `font-black ${serif} ohp-price-glint` : 'font-extrabold tracking-tight'}`}>${listing.price.toLocaleString()}</p>
          )}
          {photos.length > 1 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-bold text-white ">
              <Camera className="h-3 w-3" />{hover ? `${i + 1}/${photos.length}` : photos.length}
            </span>
          )}
        </div>
        {hover && photos.length > 1 && (
          <div className="absolute inset-x-4 bottom-0 flex gap-1">
            {photos.map((_, k) => <span key={k} className="h-0.5 flex-1 rounded-full transition-colors" style={{ backgroundColor: k <= i ? 'var(--site-accent-light)' : 'rgba(255,255,255,.35)' }} />)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className={`truncate text-[15px] ${luxe ? `font-black ${serif}` : 'font-bold'}`} style={{ color: 'var(--site-heading)' }}>{street || 'Address on request'}</p>
        <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{[listing.city, listing.school_district && `${tidyCaps(listing.school_district).replace(/ school district$/i, '')} schools`].filter(Boolean).join(' · ')}</p>
        {facts.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-bold" style={{ color: 'var(--site-ink-soft)' }}>
            {facts.map(f => (
              <span key={f.l} className="inline-flex items-center gap-1.5"><f.icon className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{f.v}<span className="font-semibold" style={{ color: 'var(--site-faint)' }}>{f.l}</span></span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3.5" style={{ borderColor: 'var(--site-line)', marginTop: facts.length ? '1rem' : 'auto' }}>
          <span className="min-w-0 truncate text-[10.5px] font-semibold" style={{ color: 'var(--site-faint)' }}>
            {listedAgo(listing.days_on_market) ? <span className="mr-1.5 font-black" style={{ color: 'var(--site-accent-text)' }}>{listedAgo(listing.days_on_market)}</span> : null}
            {listing.list_office_name ? `Courtesy of ${listing.list_office_name}` : ''}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black transition group-hover:gap-1.5" style={{ color: 'var(--site-heading)' }}>
            {onQuickView && !listing.spotlight_url ? <><Eye className="h-3.5 w-3.5" /> Quick look</> : <>View <ArrowUpRight className="h-3.5 w-3.5" /></>}
          </span>
        </div>
      </div>
    </div>
  )
}
