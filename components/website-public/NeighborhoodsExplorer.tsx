'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Compass, Home, MapPin, Sparkles, Train, Trees, Utensils } from 'lucide-react'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import { formatCompactPrice } from './listingFormat'
import Reveal from './Reveal'
import SitePhoto from '@/components/website-public/SitePhoto'
import { IMG, sizedBg } from '@/lib/siteImage'

export interface ExplorerArea {
  slug: string
  name: string
  state?: string | null
  county?: string | null
  photo?: string | null
  summary?: string | null
  median_price?: number | null
  active_count?: number | null
  min_price?: number | null
  max_price?: number | null
  price_range_basis?: string | null
  school_districts?: string[] | null
  hover_facts?: Record<string, string[]> | null
}

const firstSentence = (t?: string | null) => {
  const s = String(t || '').trim()
  const m = s.match(/^.{40,180}?[.!?](\s|$)/)
  return m ? m[0].trim() : s.slice(0, 150) + (s.length > 150 ? '…' : '')
}

// The Neighborhoods page: every town the agent serves (the Areas tab) as an immersive photo card -
// the real median price and homes for sale on it, the town's highlights (town center, parks,
// dining, the train) revealed on hover, one tap into the town's full guide or straight to its homes.
// An agent serves a handful of towns, so there's no search box or sorting (a visitor could only
// "find" towns the agent doesn't cover) - the hero lists the towns as one-tap buttons instead,
// in the agent's own order (their Areas list). Then the side-by-side compare.
export default function NeighborhoodsExplorer({ areas, theme, basePrefix = '', compare }: {
  areas: ExplorerArea[]; theme: SiteTheme; basePrefix?: string; compare?: React.ReactNode
}) {
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  const [bg, setBg] = useState(0)
  const photos = useMemo(() => areas.map(a => a.photo).filter(Boolean) as string[], [areas])
  useEffect(() => {
    if (photos.length < 2) return
    const id = setInterval(() => setBg(i => (i + 1) % photos.length), 6000)
    return () => clearInterval(id)
  }, [photos.length])

  const totalHomes = areas.reduce((n, a) => n + (a.active_count || 0), 0)
  const medians = areas.map(a => a.median_price).filter((n): n is number => !!n)
  // The agent's own town order (Areas list arrows) - their main town leads as the big card.
  const shown = areas
  // Phones show the first 3 town buttons and a "+N more" - all of them buried the hero photo.
  const [allPills, setAllPills] = useState(false)
  const PHONE_PILLS = 3
  // Few towns get bigger cards: 1-2 -> one per row half, 4 -> two across, else three across.
  const cols = shown.length <= 2 ? 'sm:grid-cols-2' : shown.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'

  const stats = [
    { v: String(areas.length), l: areas.length === 1 ? 'Neighborhood' : 'Neighborhoods' },
    { v: totalHomes.toLocaleString(), l: 'Homes for sale now' },
    ...(medians.length ? [{ v: `${formatCompactPrice(Math.min(...medians))}–${formatCompactPrice(Math.max(...medians))}`, l: 'Median prices' }] : []),
  ]

  return (
    <main data-testid="neighborhoods-explorer" style={{ backgroundColor: 'var(--site-bg)' }}>
      {/* Hero */}
      <section className="relative isolate overflow-hidden" style={{ backgroundColor: luxe ? theme.primary_color : 'var(--site-bg-alt)' }}>
        {photos.map((p, i) => (photos.length < 4 || i === bg || i === (bg + 1) % photos.length || i === (bg - 1 + photos.length) % photos.length) && (
          <div key={`${p}-${i}`} className={`absolute inset-0 -z-10 bg-cover bg-center transition-opacity duration-[1600ms] ${i === bg ? (luxe ? 'opacity-100' : 'opacity-100') : 'opacity-0'}`}
            style={{ backgroundImage: sizedBg(p, 1920) }}>
            {i === bg && <div className="ohp-hero-kenburns absolute inset-0 bg-cover bg-center" style={{ backgroundImage: sizedBg(p, 1920) }} />}
          </div>
        ))}
        <div className="absolute inset-0 -z-10" style={{ background: luxe ? `linear-gradient(180deg, rgba(0,0,0,.55), ${theme.primary_color} 96%)` : 'linear-gradient(180deg, rgba(255,255,255,.55), var(--site-bg) 92%)' }} />
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-32 text-center sm:px-6 sm:pb-20 sm:pt-40">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: luxe ? 'var(--site-accent-light)' : 'var(--site-accent-deep)' }}>
              <Compass className="h-3.5 w-3.5" /> Explore the area
            </p>
            <h1 className={`mt-4 text-5xl leading-[1.02] sm:text-7xl ${luxe ? `font-black text-white ${serif}` : 'font-extrabold tracking-tight'}`} style={luxe ? undefined : { color: 'var(--site-heading)' }}>
              Find where you <span className={luxe ? 'ohp-text-shimmer' : ''} style={luxe ? undefined : { color: 'var(--site-accent)' }}>belong.</span>
            </h1>
            <p className={`mx-auto mt-5 max-w-2xl text-base sm:text-lg ${luxe ? 'text-white/75' : ''}`} style={luxe ? undefined : { color: 'var(--site-muted)' }}>
              Every town I serve - real homes for sale, real prices, schools, the train and the best local spots.
            </p>
            <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
              {shown.map((a, i) => (
                <a key={a.slug} href={`${basePrefix}/${a.slug}`}
                  className={`ohp-town-pill group ${i >= PHONE_PILLS && !allPills ? 'hidden sm:inline-flex' : 'inline-flex'} items-center gap-2 border px-4 py-2.5 text-sm font-black transition duration-300 hover:-translate-y-0.5 ${luxe ? 'rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20' : 'rounded-xl'}`}
                  style={{ animationDelay: `${120 + i * 60}ms`, ...(luxe ? {} : { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-heading)' }) }}>
                  <MapPin className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{a.name}
                  {a.active_count ? <span className={`text-xs font-bold ${luxe ? 'text-white/55' : ''}`} style={luxe ? undefined : { color: 'var(--site-faint)' }}>{a.active_count}</span> : null}
                  {/* Takes no room until hover - a hidden arrow left dead space at the end of every pill */}
                  <ArrowRight className="-ml-2 h-3.5 w-0 -translate-x-1 opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:w-3.5 group-hover:translate-x-0 group-hover:opacity-100" />
                </a>
              ))}
              {!allPills && shown.length > PHONE_PILLS && (
                <button type="button" onClick={() => setAllPills(true)}
                  className={`ohp-town-pill inline-flex items-center border px-4 py-2.5 text-sm font-black transition sm:hidden ${luxe ? 'rounded-full border-white/20 bg-white/5 text-white/80' : 'rounded-xl'}`}
                  style={{ animationDelay: `${120 + PHONE_PILLS * 60}ms`, ...(luxe ? {} : { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-muted)' }) }}>
                  +{shown.length - PHONE_PILLS} more
                </button>
              )}
            </div>
            <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-2xl" style={{ backgroundColor: luxe ? 'rgba(255,255,255,.12)' : 'var(--site-line)' }}>
              {stats.map(s => (
                <div key={s.l} className="px-1.5 py-4 sm:px-3 sm:py-5" style={{ backgroundColor: luxe ? 'rgba(0,0,0,.35)' : 'var(--site-surface)' }}>
                  <p className={`text-xl font-black sm:text-3xl ${luxe ? `text-white ${serif}` : ''}`} style={luxe ? undefined : { color: 'var(--site-heading)' }}>{s.v}</p>
                  <p className={`mt-1 text-[10px] font-black uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.16em] ${luxe ? 'text-white/55' : ''}`} style={luxe ? undefined : { color: 'var(--site-faint)' }}>{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
        <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </section>

      {/* Towns */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-20">
        {/* Rows are at least 360 but grow with the card - the big card's summary + highlights
            don't fit 360 on a phone and used to spill up over its badges */}
        <div className={`grid auto-rows-[minmax(360px,auto)] grid-cols-1 gap-5 ${cols}`}>
          {shown.map((a, i) => {
            const big = i === 0 && shown.length > 4 && shown.length !== 4
            const facts = a.hover_facts || {}
            const highlights = [
              facts.downtown?.[0] && { icon: Sparkles, label: 'Town center', v: facts.downtown[0] },
              facts.parks?.[0] && { icon: Trees, label: 'Parks', v: facts.parks.slice(0, 2).join(' · ') },
              facts.restaurants_shopping?.[0] && { icon: Utensils, label: 'Dining & shops', v: facts.restaurants_shopping.slice(0, 2).join(' · ') },
              facts.transportation?.[0] && { icon: Train, label: 'Getting around', v: facts.transportation[0] },
            ].filter(Boolean).slice(0, big ? 4 : 3) as { icon: typeof Trees; label: string; v: string }[]
            return (
              <Reveal key={a.slug} delay={(i % 3) * 80} className={`h-full ${big ? 'sm:col-span-2 lg:row-span-2' : ''}`}>
                <div className={`group relative flex h-full min-h-[360px] flex-col justify-end overflow-hidden ${luxe ? 'rounded-[28px]' : 'rounded-3xl'}`} style={{ boxShadow: '0 30px 60px -36px rgba(0,0,0,.6)' }}>
                  <a href={`${basePrefix}/${a.slug}`} aria-label={`Explore ${a.name}`} className="absolute inset-0 z-10" />
                  <div className="absolute inset-0 bg-cover bg-center transition duration-[1400ms] group-hover:scale-110" style={{ backgroundImage: sizedBg(a.photo, 640), backgroundColor: theme.primary_color }} />
                  {/* The big card's text climbs high up the photo, so its shade does too */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${big ? 'from-black/95 via-black/65 to-black/25' : 'from-black/90 via-black/30 to-black/10'} transition duration-500 group-hover:from-black/95 group-hover:via-black/60`} />
                  {luxe && <span aria-hidden className="ohp-card-sheen pointer-events-none absolute inset-0" />}
                  <div className={`absolute left-4 top-4 flex gap-1.5 transition duration-300 ${big ? '' : 'sm:group-hover:-translate-y-2 sm:group-hover:opacity-0'}`}>
                    {a.active_count ? <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-[#111827]"><Home className="h-3 w-3" />{a.active_count} for sale</span> : null}
                    {big && <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Featured</span>}
                  </div>
                  <div className="relative p-5 pt-16 text-white sm:p-6 sm:pt-16">
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-white/60"><MapPin className="h-3 w-3" />{[a.county, a.state].filter(Boolean).join(', ') || 'Neighborhood'}</p>
                    <p className={`mt-1 leading-none ${big ? 'text-5xl sm:text-6xl' : 'text-3xl'} ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`}>{a.name}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-white/85">
                      {a.median_price ? <span><span className="text-white/55">Median</span> {formatCompactPrice(a.median_price)}</span> : null}
                      {a.min_price && a.max_price ? <span><span className="text-white/55">{a.price_range_basis === 'sold_2y' ? 'Most sold' : 'Range'}</span> {formatCompactPrice(a.min_price)}–{formatCompactPrice(a.max_price)}</span> : null}
                    </div>
                    {big && a.summary && <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">{firstSentence(a.summary)}</p>}
                    {/* Highlights rise in on hover (always shown on the big card and on phones) */}
                    {highlights.length > 0 && (
                      // A solid frosted panel behind the highlights so they read cleanly over any photo.
                      // Small cards reveal it on hover (computers only - phones tap Explore).
                      <div className={`grid transition-all duration-500 ${big ? 'mt-4 grid-rows-[1fr] opacity-100' : 'hidden sm:grid sm:grid-rows-[0fr] sm:opacity-0 sm:group-hover:mt-3 sm:group-hover:grid-rows-[1fr] sm:group-hover:opacity-100'}`}>
                        <div className="overflow-hidden">
                          <div className={`grid gap-2.5 rounded-2xl bg-black/70 p-3.5 ring-1 ring-white/10 ${big ? 'sm:grid-cols-2' : ''}`}>
                            {highlights.map(h => (
                              <p key={h.label} className="flex items-start gap-2 text-[13px] font-medium leading-snug text-white">
                                <h.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--site-accent-light)' }} />
                                <span><span className="block text-[10px] font-black uppercase tracking-[0.16em] text-white/60">{h.label}</span>{h.v}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="relative z-20 mt-4 flex flex-wrap gap-2">
                      <a href={`${basePrefix}/${a.slug}`} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black transition group-hover:gap-2.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Explore {a.name} <ArrowRight className="h-3.5 w-3.5" /></a>
                      {a.active_count ? <a href={`${basePrefix}/search?q=${encodeURIComponent(a.name)}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-black text-white transition hover:bg-white/20">See {a.active_count} homes</a> : null}
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

      </section>

      {compare}
    </main>
  )
}
