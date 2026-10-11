'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import FeaturedHeroCarousel from './FeaturedHeroCarousel'
import { ShowcaseListing } from './PropertyShowcaseCard'
import HomeCollection from './HomeCollection'
import PropertyQuickViewModal from './PropertyQuickViewModal'
import LuxuryAbstractBackground from './LuxuryAbstractBackground'
import { fontClass } from './blocks/fontClass'
import { SiteTheme } from './types'
import ClassicPageHero from './ClassicPageHero'
import { formatStatus, statusBadgeColor } from './listingFormat'

type Listing = ShowcaseListing & { days_on_market?: number | null; features?: string[]; list_office_name?: string | null }

// Owns the Featured page's whole interactive middle - the dark hero (headline + auto-cycling
// carousel) down through the grid below - as one client component so a single piece of state
// (which listing is open in the quick-view modal, see PropertyQuickViewModal) is shared by both:
// a click from either the hero carousel or the grid opens the same overlay instead of navigating
// away and losing the visitor's place. Only the CTA footer below stays server-rendered in
// PropertiesIndex (no interactivity needed there).
export default function FeaturedPageClient({ siteId, theme, basePrefix, heroPool, rest }: {
  siteId: string
  theme: SiteTheme
  basePrefix: string
  heroPool: Listing[]
  rest: Listing[]
}) {
  const [quickViewKey, setQuickViewKey] = useState<string | null>(null)

  if (theme.template === 'default') {
    const all = [...heroPool, ...rest]
    const prices = all.map(l => l.price).filter((n): n is number => typeof n === 'number')
    const fmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : `$${Math.round(n / 1000)}K`)
    return (
      <>
        <ClassicPageHero
          eyebrow="Featured collection"
          title="Exceptional"
          accent="homes"
          subtitle="A curated showcase of some of the most stunning properties available right now."
          photos={all.map(l => l.photo || l.photos?.[0]).filter(Boolean).slice(0, 3) as string[]}
          stats={[
            { label: 'Homes', value: String(all.length) },
            ...(prices.length ? [{ label: 'From', value: fmt(Math.min(...prices)) }, { label: 'Up to', value: fmt(Math.max(...prices)) }] : []),
          ]}
        />
        <ClassicSpotlight listings={heroPool} onOpen={setQuickViewKey} />
        <HomeCollection listings={rest.length ? rest : heroPool} theme={theme} basePrefix={basePrefix} onQuickView={setQuickViewKey} />
        <PropertyQuickViewModal siteId={siteId} listingKey={quickViewKey} onClose={() => setQuickViewKey(null)} theme={theme} basePrefix={basePrefix} />
      </>
    )
  }

  return (
    <>
      {/* Immersive hero + auto-cycling carousel - a decorative abstract wallpaper behind the
          headline (not any one listing's photo, which would misrepresent it as more significant
          than the rest of the collection sitting right below it - see LuxuryAbstractBackground),
          with the real photography reserved for the actual listing cards. */}
      {/* pt- must clear SiteChrome's fixed header (~72px tall) - it overlays via position:fixed
          regardless of this section's own padding, so too little top padding here means the
          header visibly clips the top of the headline instead of sitting above it. */}
      {/* pb- needs real room below the dots before the fade zone starts (see the fade div
          further down, h-32/128px) - this has to clear that fade height entirely, not just be
          "some" padding, or the fade band eats into the dots row itself and washes out the last
          bit of solid blue (and the dots sitting in it) instead of staying empty breathing room
          past it. */}
      <div className="relative overflow-hidden px-6 pb-40 pt-24 sm:pb-44 sm:pt-28" style={{ backgroundColor: theme.primary_color }}>
        <LuxuryAbstractBackground accentColor={theme.secondary_color} />

        {/* Kept deliberately tight - this is a lead-in line, not the main event. The listing
            photos below are what the page is actually for, so the intro shouldn't push them
            down the page or out of view. Same gold eyebrow (Sparkles/line/label/line/Sparkles)
            as the Blog and Community pages' own headers, so the Featured page matches the rest
            of the site instead of looking like a one-off design. */}
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-2 flex items-center justify-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.secondary_color }} />
            <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
            <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.secondary_color }}>Featured Collection</span>
            <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.secondary_color }} />
          </div>
          <h1 className={`ohp-site-heading text-xl font-black leading-[1.1] text-white sm:text-3xl ${fontClass(theme.heading_font, 'font-serif')}`}>
            Exceptional <span className="ohp-text-shimmer">Homes</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-xs text-white/75 sm:text-sm">
            A curated showcase of some of the most stunning properties available right now.
          </p>
        </div>

        <div className="relative">
          <FeaturedHeroCarousel listings={heroPool} theme={theme} basePrefix={basePrefix} onQuickView={setQuickViewKey} />
        </div>

        {/* Fades the hero's dark bottom edge into the page's cream background instead of a hard
            cut - matches the homepage hero's bottom transition. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[var(--site-cream)]" />
        {/* See SiteChrome's IntersectionObserver - marks exactly where this hero ends. */}
        <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </div>

      <HomeCollection listings={rest.length ? rest : heroPool} theme={theme} basePrefix={basePrefix} onQuickView={setQuickViewKey} />

      <PropertyQuickViewModal siteId={siteId} listingKey={quickViewKey} onClose={() => setQuickViewKey(null)} theme={theme} basePrefix={basePrefix} />
    </>
  )
}

// Classic's "home of the moment": one wide card (big photo, then the price, address, facts and a
// quick look) that turns through the collection on its own every few seconds, with arrows and a
// row of small photos to pick one - the bright counterpart of Luxe's FeaturedHeroCarousel.
function ClassicSpotlight({ listings, onOpen }: { listings: Listing[]; onOpen: (key: string) => void }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (listings.length < 2 || paused) return
    const id = setInterval(() => setI(v => (v + 1) % listings.length), 6500)
    return () => clearInterval(id)
  }, [listings.length, paused])
  if (!listings.length) return null
  const l = listings[i % listings.length]
  const badge = statusBadgeColor(l.status)
  const facts = [
    l.bedrooms != null ? ['Beds', String(l.bedrooms)] : null,
    l.bathrooms != null ? ['Baths', String(l.bathrooms)] : null,
    l.living_area != null ? ['Sq ft', l.living_area.toLocaleString()] : null,
    l.days_on_market != null ? ['Days listed', String(l.days_on_market)] : null,
  ].filter(Boolean) as [string, string][]
  const go = (d: number) => setI(v => (v + d + listings.length) % listings.length)
  return (
    <section className="mx-auto max-w-7xl px-6 py-14 sm:py-16" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--site-accent)' }}>Home of the moment</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>{i + 1} of {listings.length}</p>
        </div>
        {listings.length > 1 && (
          <div className="flex gap-2">
            <button onClick={() => go(-1)} aria-label="Previous home" className="grid h-11 w-11 place-items-center rounded-xl border transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => go(1)} aria-label="Next home" className="grid h-11 w-11 place-items-center rounded-xl border transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div key={l.listing_key} className="mt-5 grid animate-fadeIn overflow-hidden rounded-[24px] border lg:grid-cols-[1.45fr_1fr]" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)' }}>
        <button type="button" onClick={() => onOpen(l.listing_key)} className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[420px]" aria-label="Open this home">
          <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.4s] hover:scale-[1.03]" style={{ backgroundImage: l.photo ? `url(${l.photo})` : undefined, backgroundColor: 'var(--site-bg-alt)' }} />
          {l.status && <span className="absolute left-4 top-4 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm" style={{ backgroundColor: badge.bg, color: badge.fg }}>{formatStatus(l.status)}</span>}
        </button>
        <div className="flex flex-col p-7 sm:p-9">
          {l.price != null && <p className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--site-heading)' }}>${l.price.toLocaleString()}</p>}
          {l.address && <p className="mt-3 text-lg font-semibold" style={{ color: 'var(--site-ink-soft)' }}>{l.address}</p>}
          {(l as any).list_office_name && <p className="mt-1 text-xs font-medium" style={{ color: 'var(--site-faint)' }}>Courtesy of {(l as any).list_office_name}</p>}
          {l.city && <p className="text-sm" style={{ color: 'var(--site-muted)' }}>{[l.city, l.state].filter(Boolean).join(', ')}</p>}
          {facts.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-line)' }}>
              {facts.map(([k, v]) => (
                <div key={k} className="px-4 py-3.5" style={{ backgroundColor: 'var(--site-surface-2)' }}>
                  <dd className="text-xl font-extrabold" style={{ color: 'var(--site-heading)' }}>{v}</dd>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--site-faint)' }}>{k}</dt>
                </div>
              ))}
            </dl>
          )}
          {l.features && l.features.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {l.features.slice(0, 4).map(f => <span key={f} className="rounded-md px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-ink-soft)' }}>{f}</span>)}
            </div>
          )}
          <button type="button" onClick={() => onOpen(l.listing_key)} className="mt-7 inline-flex w-fit items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 lg:mt-auto" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            Take a look <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {listings.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto p-1 [scrollbar-width:none]">
          {listings.map((x, k) => (
            <button key={x.listing_key} onClick={() => setI(k)} aria-label={`Show ${x.address || 'home'}`} className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-cover bg-center transition ${k === i ? 'ring-2 ring-offset-2' : 'opacity-60 hover:opacity-100'}`} style={{ backgroundImage: x.photo ? `url(${x.photo})` : undefined, ['--tw-ring-color' as string]: 'var(--site-accent)', ['--tw-ring-offset-color' as string]: 'var(--site-bg)' }} />
          ))}
        </div>
      )}
    </section>
  )
}
