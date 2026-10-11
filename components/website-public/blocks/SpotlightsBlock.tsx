'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Bath, BedDouble, Ruler, Sparkles } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import { formatStatus, statusBadgeColor } from '../listingFormat'

interface SpotlightCard {
  id: string
  slug: string
  url: string
  listing_key?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  price?: number | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  status?: string | null
  photo?: string | null
  photos?: string[] | null
  template_id?: string | null
}

// The agent's published Listing Spotlights (Studio -> Spotlights) - each card opens that
// home's cinematic single-property site. Photos cycle slowly on hover; the status badge is live
// MLS status (a sold Spotlight stays as a portfolio piece, marked Sold). See
// content_adapters.get_published_spotlights.
function Card({ item, theme, luxe }: { item: SpotlightCard; theme: SiteTheme; luxe: boolean }) {
  const photos = item.photos && item.photos.length > 0 ? item.photos : item.photo ? [item.photo] : []
  const [index, setIndex] = useState(0)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    if (!hover || photos.length < 2) return
    const id = setInterval(() => setIndex(i => (i + 1) % photos.length), 1600)
    return () => clearInterval(id)
  }, [hover, photos.length])
  const badge = statusBadgeColor(item.status)
  const stats = [
    item.bedrooms != null ? { icon: BedDouble, label: `${item.bedrooms} bd` } : null,
    item.bathrooms != null ? { icon: Bath, label: `${item.bathrooms} ba` } : null,
    item.living_area != null ? { icon: Ruler, label: `${Math.round(item.living_area).toLocaleString()} sqft` } : null,
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[]

  const card = (
    <div className={`group relative h-full overflow-hidden ${luxe ? 'rounded-[26px]' : 'rounded-2xl'} bg-gray-900 shadow-[0_24px_60px_-30px_rgba(0,0,0,.6)] transition duration-500 hover:-translate-y-1`}>
      <div className="relative aspect-[16/11] w-full overflow-hidden">
        {photos.length > 0 ? photos.map((url, i) => (
          <div key={`${url}-${i}`} className="absolute inset-0 bg-cover bg-center transition-all duration-1000 group-hover:scale-105" style={{ backgroundImage: `url(${url})`, opacity: i === index ? 1 : 0 }} />
        )) : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.primary_color}, #000)` }} />}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--site-on-accent)] shadow" style={{ backgroundColor: 'var(--site-accent)' }}>
            <Sparkles className="h-3 w-3" /> Spotlight
          </span>
          {item.status && <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow" style={{ backgroundColor: badge.bg, color: badge.fg }}>{formatStatus(item.status)}</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          {item.price != null && <p className={`text-2xl font-black leading-none text-white drop-shadow sm:text-3xl ${fontClass(theme.heading_font, 'font-serif')}`}>${Math.round(item.price).toLocaleString()}</p>}
          {item.address && <p className="mt-2 truncate text-sm font-black text-white drop-shadow">{item.address}</p>}
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">{[item.city, item.state].filter(Boolean).join(', ')}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ backgroundColor: 'var(--site-surface)' }}>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-gray-500">
          {stats.map((s, i) => <span key={i} className="flex items-center gap-1"><s.icon className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{s.label}</span>)}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--site-accent-deep)' }}>
          Experience it <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </div>
  )

  return (
    <a href={item.url} className="block h-full" onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setIndex(0) }}>
      {luxe ? <div className="ohp-lx-frame h-full rounded-[27px]">{card}</div> : card}
    </a>
  )
}

export default function SpotlightsBlock({ data, theme }: { data: Record<string, any>; theme: SiteTheme }) {
  const items: SpotlightCard[] = (data.resolved || []).filter((s: SpotlightCard) => s?.url)
  if (!items.length) return null
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  return (
    <section className="px-6 py-16 sm:py-24" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: theme.primary_color }}>
                <Sparkles className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
              </span>
              <span className="h-px w-6" style={{ backgroundColor: 'var(--site-accent)' }} />
              <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent)' }}>{data.eyebrow || 'Cinematic listing pages'}</span>
            </div>
            <h2 className={`mt-3 text-4xl font-black leading-[1.1] sm:text-5xl ${serif}`} style={{ color: 'var(--site-ink)' }}>{data.headline || 'Listing Spotlights'}</h2>
            <p className="mt-2 max-w-xl text-sm text-gray-500 sm:text-base">{data.subtext || 'Each of these homes has its own immersive page - every photo, every room, the neighborhood and a private showing request.'}</p>
          </div>
        </div>
        <div className={`mt-12 grid gap-6 sm:grid-cols-2 ${items.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
          {items.map(item => <Card key={item.id} item={item} theme={theme} luxe={luxe} />)}
        </div>
      </div>
    </section>
  )
}
