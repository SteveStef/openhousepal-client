'use client'

import { useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import { formatStatus, statusBadgeColor } from '../listingFormat'
import OpenHouseChip from '@/components/OpenHouseChip'
import SpotlightChip from '../SpotlightChip'
import IdxHomeGridCard from '../IdxHomeGridCard'
import Reveal from '../Reveal'
import PropertyQuickViewModal from '../PropertyQuickViewModal'
import LuxuryAbstractBackground from '../LuxuryAbstractBackground'
import ClassicSectionHead from './ClassicSectionHead'
import type { MlsOpenHouse } from '@/lib/mlsOpenHouses'
import { sizedBg } from '@/lib/siteImage'

interface ListingCard {
  listing_key: string
  address: string | null
  city: string | null
  state: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  living_area: number | null
  status: string | null
  photo: string | null
  photos?: string[] | null
  open_houses?: MlsOpenHouse[] | null
  spotlight_url?: string | null
  days_on_market?: number | null
  features?: string[]
}

// Classic's listing card: the photo on top (photos rotate on hover), then the price, the street,
// the town and a ruled beds / baths / sq ft row on white - a clean, photo-first card, nothing laid
// over the photo but the status and Spotlight chips.
export function ClassicListingCard({ listing, href, onOpen }: { listing: ListingCard; href?: string; onOpen?: () => void }) {
  const badge = statusBadgeColor(listing.status)
  const pics = (listing.photos && listing.photos.length ? listing.photos : listing.photo ? [listing.photo] : []).slice(0, 4)
  const [pi, setPi] = useState(0)
  const facts = [
    listing.bedrooms != null ? `${listing.bedrooms} bd` : null,
    listing.bathrooms != null ? `${listing.bathrooms} ba` : null,
    listing.living_area != null ? `${listing.living_area.toLocaleString()} sq ft` : null,
  ].filter(Boolean) as string[]
  const open = () => { if (onOpen) onOpen(); else if (href) window.location.assign(href) }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      onMouseEnter={() => pics.length > 1 && setPi(1)}
      onMouseLeave={() => setPi(0)}
      className="ohp-card group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)' }}
    >
      <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
        {pics.map((u, i) => (
          <div key={u + i} className="ohp-mls-crop absolute inset-0 bg-cover bg-center transition-all duration-700 group-hover:scale-[1.03]" style={{ backgroundImage: sizedBg(u, 640), opacity: i === pi ? 1 : 0 }} />
        ))}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          {listing.status && <span className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm" style={{ backgroundColor: badge.bg, color: badge.fg }}>{formatStatus(listing.status)}</span>}
          <SpotlightChip url={listing.spotlight_url} />
        </div>
        {listing.open_houses && listing.open_houses.length > 0 && <div className="absolute bottom-3 left-3"><OpenHouseChip openHouses={listing.open_houses} /></div>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {listing.price != null && <p className="text-[1.65rem] font-extrabold leading-none tracking-tight" style={{ color: 'var(--site-heading)' }}>${listing.price.toLocaleString()}</p>}
        {listing.address && <p className="mt-2.5 truncate text-[15px] font-semibold" style={{ color: 'var(--site-ink-soft)' }}>{listing.address}</p>}
        {(listing as any).list_office_name && <p className="mt-1 truncate text-[10px] font-medium" style={{ color: 'var(--site-faint)' }}>Courtesy of {(listing as any).list_office_name}</p>}
        {listing.city && <p className="mt-0.5 text-sm" style={{ color: 'var(--site-muted)' }}>{[listing.city, listing.state].filter(Boolean).join(', ')}</p>}
        {facts.length > 0 && (
          <div className="mt-auto flex items-center gap-3 border-t pt-4 text-[13px] font-semibold" style={{ borderColor: 'var(--site-line)', color: 'var(--site-ink-soft)' }}>
            {facts.map((f, i) => <span key={f} className="flex items-center gap-3">{i > 0 && <span className="h-3 w-px" style={{ backgroundColor: 'var(--site-line-strong)' }} />}{f}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

// The homes themselves: the Agent Hub Sales page's card layout (IdxHomeGridCard) in the site's
// colors - one or two homes sit centered at card width instead of stretching across the row.
function FeaturedGrid({ listings, theme, basePrefix, onQuickView }: { listings: ListingCard[]; theme: SiteTheme; basePrefix: string; onQuickView?: (key: string) => void }) {
  const n = listings.length
  return (
    <div className={`mx-auto mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 ${n >= 3 ? 'lg:grid-cols-3' : n === 2 ? 'max-w-4xl' : 'max-w-md sm:grid-cols-1'}`}>
      {listings.map((listing, k) => (
        <Reveal key={listing.listing_key} delay={(k % 3) * 80} className="h-full">
          <IdxHomeGridCard listing={listing as any} theme={theme} basePrefix={basePrefix} onQuickView={onQuickView} />
        </Reveal>
      ))}
    </div>
  )
}

// Featured homes on the home page. Both looks read the Featured tab's own pool
// (content_adapters.get_featured_page_listings) - this block only decides how to show it.
//
// Luxe: the same cinematic treatment as the Featured page's top - a midnight band with the gold
// grid behind it and the serif headline with the shimmer; Default: the light band. In both, the
// homes are Agent Hub Sales-page cards (IdxHomeGridCard) in the site's own colors (user, 10/19:
// the old carousel/cards looked bad). A click opens the same quick look the Featured page uses.
export default function FeaturedListingsBlock({ data, theme, siteId, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; siteId?: string; basePrefix?: string }) {
  const luxe = theme.template !== 'default'
  const listings: ListingCard[] = (data.resolved || []).slice(0, luxe ? 9 : 9)
  const [quickViewKey, setQuickViewKey] = useState<string | null>(null)
  if (!listings.length) return null
  const serif = fontClass(theme.heading_font, 'font-serif')
  const gold = theme.secondary_color

  if (luxe) {
    return (
      <section className="relative overflow-hidden px-6 pb-20 pt-24 sm:pb-24 sm:pt-28" style={{ backgroundColor: theme.primary_color }}>
        <LuxuryAbstractBackground accentColor={gold} />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 shrink-0" style={{ color: gold }} />
                <span className="h-px w-8" style={{ backgroundColor: gold }} />
                <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: gold }}>{data.eyebrow || 'Featured Collection'}</span>
              </div>
              <h2 className={`ohp-site-heading mt-4 text-4xl font-black leading-[1.05] text-white sm:text-6xl ${serif}`}>
                {(() => {
                  const words = String(data.headline || 'Featured Listings').trim().split(' ')
                  const last = words.pop()
                  return <>{words.join(' ')}{words.length ? ' ' : ''}<span className="ohp-text-shimmer">{last}</span></>
                })()}
              </h2>
              <p className="mt-4 max-w-xl text-sm text-white/70 sm:text-base">{data.subtext || 'A curated selection of exceptional homes available now.'}</p>
            </div>
            {siteId && (
              <a href={`${basePrefix}/properties`} className="ohp-gold-sheen inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase tracking-widest shadow-lg transition hover:-translate-y-0.5" style={{ backgroundColor: gold, color: theme.primary_color }}>
                See the collection <ChevronRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <FeaturedGrid listings={listings} theme={theme} basePrefix={basePrefix} onQuickView={siteId ? setQuickViewKey : undefined} />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${gold}88, transparent)` }} />
        {siteId && <PropertyQuickViewModal siteId={siteId} listingKey={quickViewKey} onClose={() => setQuickViewKey(null)} theme={theme} basePrefix={basePrefix} />}
      </section>
    )
  }

  return (
    <section className="px-6 py-16 sm:py-24" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
      <div className="mx-auto max-w-7xl">
        <ClassicSectionHead eyebrow={data.eyebrow || 'Featured'} title={data.headline || 'Featured Listings'} sub={data.subtext || 'A curated selection of exceptional homes available now.'} href={siteId ? `${basePrefix}/properties` : undefined} linkLabel="View all homes" />
        <FeaturedGrid listings={listings} theme={theme} basePrefix={basePrefix} onQuickView={siteId ? setQuickViewKey : undefined} />
      </div>
      {siteId && <PropertyQuickViewModal siteId={siteId} listingKey={quickViewKey} onClose={() => setQuickViewKey(null)} theme={theme} basePrefix={basePrefix} />}
    </section>
  )
}
