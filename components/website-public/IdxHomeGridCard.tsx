'use client'

import { ArrowUpRight, Bath, BedDouble, CalendarDays, Images, LandPlot, MapPin, Ruler } from 'lucide-react'
import OpenHouseChip from '@/components/OpenHouseChip'
import { formatOpenHouse, upcomingOpenHouses } from '@/lib/mlsOpenHouses'
import { IMG } from '@/lib/siteImage'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import { cleanStreet, formatStatus, listedAgo, statusBadgeColor } from './listingFormat'
import SpotlightChip from './SpotlightChip'
import SitePhoto from './SitePhoto'
import type { HomeCardListing } from './HomeCard'

// The home page's Featured homes card - the same LAYOUT as the Agent Hub's Sales page card
// (components/agent-hub/HubHomeGridCard), in this site's own colors: Classic = the site surface
// lit by its accent, Luxe = the metal frame. Photo: status (+ open house, Spotlight) on the left,
// photo count on the right, "Listed at" and the price at the bottom. Under it: street + town on the
// left, the facts in a ruled column on the right, open-house times, then "View home" (+ the IDX
// "Courtesy of" line, which MLS rules need on every home that isn't the agent's own).
export default function IdxHomeGridCard({ listing, theme, basePrefix = '', onQuickView, priority = false }: {
  listing: HomeCardListing
  theme: SiteTheme
  basePrefix?: string
  onQuickView?: (listingKey: string) => void
  priority?: boolean
}) {
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  const photos = (listing.photos && listing.photos.length ? listing.photos : listing.photo ? [listing.photo] : []).filter(Boolean)
  const href = listing.spotlight_url || `${basePrefix}/properties/${encodeURIComponent(listing.listing_key)}`
  const quick = !!onQuickView && !listing.spotlight_url
  const street = cleanStreet(listing.address, listing.city) || 'Address on request'
  const town = [listing.city, listing.state].filter(Boolean).join(', ')
  const badge = statusBadgeColor(listing.status)
  const openHouses = upcomingOpenHouses(listing.open_houses)
  const fresh = listedAgo(listing.days_on_market)
  const facts = [
    listing.bedrooms != null ? { icon: BedDouble, v: `${listing.bedrooms}`, l: 'bd' } : null,
    listing.bathrooms != null ? { icon: Bath, v: `${listing.bathrooms}`, l: 'ba' } : null,
    listing.living_area != null ? { icon: Ruler, v: Math.round(listing.living_area).toLocaleString('en-US'), l: 'sq ft' } : listing.lot_size_acres != null ? { icon: LandPlot, v: listing.lot_size_acres.toFixed(listing.lot_size_acres < 1 ? 2 : 1), l: 'ac' } : null,
  ].filter(Boolean) as { icon: typeof Bath; v: string; l: string }[]

  const body = (
    <>
      <span className="relative block aspect-[4/3] overflow-hidden" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
        <SitePhoto src={photos[0]} widths={IMG.card} sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" priority={priority}
          className="ohp-mls-crop absolute inset-0 h-full w-full object-cover transition-transform duration-[1.4s] ease-out group-hover/hc:scale-[1.06]" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/15" />
        <span className="absolute left-3 right-3 top-3 flex items-center gap-1.5">
          {listing.status && <span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow" style={{ backgroundColor: badge.bg, color: badge.fg }}>{formatStatus(listing.status)}</span>}
          {openHouses.length > 0 && <span className="flex min-w-0"><OpenHouseChip openHouses={listing.open_houses} variant={luxe ? 'luxe' : 'classic'} compact /></span>}
          <SpotlightChip url={listing.spotlight_url} />
          {photos.length > 1 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white ring-1 ring-white/15">
              <Images className="h-3 w-3" /> {photos.length}
            </span>
          )}
        </span>
        <span className="absolute inset-x-4 bottom-3.5 block">
          <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-white/85">{fresh || 'Listed at'}</span>
          <span className={`mt-1 block text-[27px] leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.45)] ${luxe ? `font-black ${serif}` : 'font-black tracking-tight'}`}>
            {listing.price != null ? `$${listing.price.toLocaleString()}` : 'Price upon request'}
          </span>
        </span>
      </span>

      <span className="block px-4 pb-4 pt-3.5">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1">
            <span className={`block line-clamp-2 text-[17px] font-black leading-snug ${serif}`} style={{ color: 'var(--site-heading)' }}>{street}</span>
            {town && (
              <span className="mt-1 flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: 'var(--site-muted)' }}>
                <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--site-accent-text)' }} /><span className="truncate">{town}</span>
              </span>
            )}
          </span>
          {facts.length > 0 && (
            <span className="flex shrink-0 flex-col items-end gap-1 border-l pl-3" style={{ borderColor: 'var(--site-line)' }}>
              {facts.map(f => (
                <span key={f.l} className="inline-flex items-center gap-1.5 text-[12px] font-black leading-none" style={{ color: 'var(--site-ink)' }}>
                  <f.icon className="h-3.5 w-3.5" style={{ color: 'var(--site-accent-text)' }} />{f.v}<span className="font-bold" style={{ color: 'var(--site-muted)' }}>{f.l}</span>
                </span>
              ))}
            </span>
          )}
        </span>

        {openHouses.length > 0 && (
          <span className="mt-3 block rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(var(--site-accent-rgb),.28)', backgroundColor: 'rgba(var(--site-accent-rgb),.07)' }}>
            <span className="block text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-accent-text)' }}>Open {openHouses.length === 1 ? 'house' : 'houses'}</span>
            {openHouses.slice(0, 2).map(oh => (
              <span key={`${oh.date}-${oh.start || ''}`} className="mt-1 flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: 'var(--site-ink)' }}>
                <CalendarDays className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--site-accent-text)' }} />{formatOpenHouse(oh)}
              </span>
            ))}
          </span>
        )}

        <span className="mt-3.5 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--site-line)' }}>
          <span className="min-w-0">
            <span className="block text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--site-accent-text)' }}>{quick ? 'Quick look' : 'View home'}</span>
            {listing.list_office_name && <span className="mt-0.5 block truncate text-[10px] font-semibold" style={{ color: 'var(--site-muted)' }}>Courtesy of {listing.list_office_name}</span>}
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover/hc:-translate-y-0.5 group-hover/hc:translate-x-0.5"
            style={luxe ? { background: 'linear-gradient(135deg, var(--site-accent-light), var(--site-accent-deep))', color: '#111827' } : { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </span>
      </span>
    </>
  )

  const frameCls = `group/hc relative block h-full overflow-hidden rounded-[22px] text-left transition duration-500 hover:-translate-y-1 ${luxe ? 'p-[1.5px]' : 'border'}`
  const frameStyle = luxe
    ? { background: 'linear-gradient(135deg, var(--site-accent-light), rgba(var(--site-accent-rgb),.45) 45%, var(--site-accent-deep))', boxShadow: 'var(--site-shadow)' }
    : { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', boxShadow: 'var(--site-shadow)' }
  const inner = luxe ? <span className="relative block h-full overflow-hidden rounded-[20.5px]" style={{ backgroundColor: 'var(--site-surface)' }}>{body}</span> : body
  // A div acting as the link (not an <a>): the Spotlight chip inside it is a real link, and an
  // <a> inside an <a> breaks the page's hydration.
  const open = (e: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => {
    if (quick && !(e.metaKey || e.ctrlKey || e.shiftKey)) onQuickView!(listing.listing_key)
    else if (e.metaKey || e.ctrlKey) window.open(href, '_blank', 'noopener')
    else window.location.assign(href)
  }
  return (
    <div role="link" tabIndex={0} aria-label={`${street}${town ? `, ${town}` : ''}`} data-testid="home-card" data-ohp-qv={quick ? listing.listing_key : undefined}
      onClick={open} onKeyDown={e => { if (e.key === 'Enter') open(e) }}
      className={`${frameCls} cursor-pointer`} style={frameStyle}>
      {inner}
    </div>
  )
}
