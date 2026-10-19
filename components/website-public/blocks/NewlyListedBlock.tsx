'use client'

import { useEffect, useRef, useState } from 'react'
import { Bath, BedDouble, ChevronLeft, ChevronRight, Crown, MapPin, Ruler, Sparkles } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import OpenHouseChip from '@/components/OpenHouseChip'
import SpotlightChip from '../SpotlightChip'
import type { MlsOpenHouse } from '@/lib/mlsOpenHouses'
import { sizedBg } from '@/lib/siteImage'

interface NewlyListedItem {
  listing_key: string
  address?: string | null
  city?: string | null
  state?: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  days_on_market?: number | null
  photo?: string | null
  open_houses?: MlsOpenHouse[] | null
  spotlight_url?: string | null
}

function PhotoCard({ listing, theme, luxe, className = '', style }: { listing: NewlyListedItem; theme: SiteTheme; luxe: boolean; className?: string; style?: React.CSSProperties }) {
  const statPills = [
    listing.bedrooms != null ? { icon: BedDouble, label: String(listing.bedrooms) } : null,
    listing.bathrooms != null ? { icon: Bath, label: String(listing.bathrooms) } : null,
    listing.living_area != null ? { icon: Ruler, label: listing.living_area.toLocaleString() } : null,
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[]
  return (
    <div className={`overflow-hidden bg-gray-900 shadow-2xl ${luxe ? 'rounded-[28px]' : 'rounded-2xl'} ${className}`} style={style}>
      <div className="relative aspect-[3/4] w-full bg-cover bg-center" style={{ backgroundImage: sizedBg(listing.photo, 640) }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/10" />
        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--site-heading)' }}>
            <Sparkles className="h-3 w-3" style={{ color: 'var(--site-accent)' }} /> New Listing
          </span>
          <SpotlightChip url={listing.spotlight_url} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <OpenHouseChip openHouses={listing.open_houses} className="mb-2" />
          {listing.price != null && (
            <p className={`text-2xl font-black text-white sm:text-3xl ${fontClass(theme.heading_font, 'font-serif')}`}>${listing.price.toLocaleString()}</p>
          )}
          {listing.address && <p className="mt-1 flex items-center gap-1 truncate text-sm font-bold text-white/90"><MapPin className="h-3.5 w-3.5 shrink-0" />{listing.address}</p>}
          {(listing as any).list_office_name && <p className="mt-1 truncate text-[10px] font-medium text-white/60">Courtesy of {(listing as any).list_office_name}</p>}
          {listing.city && <p className="text-xs text-white/60">{[listing.city, listing.state].filter(Boolean).join(', ')}</p>}
          {statPills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {statPills.map((s, si) => (
                <span key={si} className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white "><s.icon className="h-3 w-3" /> {s.label}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// The agent's newest listings. Luxe: a rotating 3D card stack (active card centered and sharp,
// neighbours fading away to each side), auto-advancing, pausable on hover. Default: a smooth
// horizontal row with prev/next. Real data only (content_adapters.get_active_listings).
export default function NewlyListedBlock({ data, theme, siteId, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; siteId?: string; basePrefix?: string }) {
  const luxe = theme.template !== 'default'
  const listings: NewlyListedItem[] = data.resolved || []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!luxe || listings.length < 2 || paused) return
    const id = setInterval(() => setIndex(i => (i + 1) % listings.length), 5000)
    return () => clearInterval(id)
  }, [listings.length, paused, luxe])

  if (!listings.length) return null

  const go = (delta: number) => {
    if (luxe) { setIndex(i => (i + delta + listings.length) % listings.length); return }
    rowRef.current?.scrollBy({ left: delta * 320, behavior: 'smooth' })
  }
  const hrefFor = (l: NewlyListedItem) => (siteId ? `${basePrefix}/properties/${encodeURIComponent(l.listing_key)}` : undefined)
  const serif = fontClass(theme.heading_font, 'font-serif')

  return (
    <section className="overflow-hidden px-6 py-16 sm:py-24" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: theme.primary_color }}>
                <Crown className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
              </span>
              <span className="h-px w-6" style={{ backgroundColor: 'var(--site-accent)' }} />
              <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent)' }}>{data.eyebrow || 'Just Listed'}</span>
            </div>
            <h2 className={`mt-3 text-4xl font-black leading-[1.1] sm:text-5xl ${serif}`} style={{ color: 'var(--site-ink)' }}>
              {data.headline || 'Newly Listed'}
            </h2>
            <p className="mt-2 text-sm text-gray-500 sm:text-base">{data.subtext || 'The latest exceptional properties to hit the market.'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => go(-1)} aria-label="Previous" className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-gray-300 hover:text-gray-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => go(1)} aria-label="Next" className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-gray-300 hover:text-gray-800">
              <ChevronRight className="h-4 w-4" />
            </button>
            {siteId && (
              <a href={`${basePrefix}/properties`} className="ml-2 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white" style={{ backgroundColor: theme.primary_color }}>
                View All <ChevronRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        {luxe ? (
          <>
            {listings.length > 1 && (
              <div className="mt-8 flex items-center justify-center gap-1.5">
                {listings.map((_, i) => (
                  <button key={i} onClick={() => setIndex(i)} aria-label={`Show listing ${i + 1}`} className="h-1.5 rounded-full transition-all" style={{ width: i === index ? 28 : 6, backgroundColor: i === index ? 'var(--site-accent)' : 'var(--site-line-strong)' }} />
                ))}
              </div>
            )}
            {/* 3D card stack - each card's transform/opacity/z-index from its distance to the active index. */}
            <div className="relative mt-10 flex h-[420px] items-center justify-center sm:h-[560px]">
              {listings.map((listing, i) => {
                let offset = i - index
                const half = listings.length / 2
                if (offset > half) offset -= listings.length
                if (offset < -half) offset += listings.length
                const abs = Math.abs(offset)
                if (abs > 2) return null
                const translate = offset * 300
                const scale = abs === 0 ? 1 : abs === 1 ? 0.86 : 0.72
                const opacity = abs === 0 ? 1 : abs === 1 ? 0.55 : 0.22
                const zIndex = 30 - abs
                const card = <PhotoCard listing={listing} theme={theme} luxe className="absolute w-[300px] transition-all duration-500 ease-out sm:w-[380px]" style={{ transform: `translateX(${translate}px) scale(${scale})`, opacity, zIndex }} />
                return abs === 0 && siteId ? (
                  <a key={listing.listing_key} href={hrefFor(listing)} className="contents">{card}</a>
                ) : (
                  <div key={listing.listing_key} className="contents">{card}</div>
                )
              })}
            </div>
          </>
        ) : (
          <div ref={rowRef} className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {listings.map(listing => {
              const card = <PhotoCard listing={listing} theme={theme} luxe={false} className="w-[280px] shrink-0 snap-start sm:w-[320px]" />
              return hrefFor(listing) ? <a key={listing.listing_key} href={hrefFor(listing)} className="contents">{card}</a> : <div key={listing.listing_key} className="contents">{card}</div>
            })}
          </div>
        )}
      </div>
    </section>
  )
}
