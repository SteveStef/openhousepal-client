'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, BellRing, ChevronDown, Sparkles } from 'lucide-react'
import HomeCard, { type HomeCardListing } from './HomeCard'
import Reveal from './Reveal'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'

type Sort = 'newest' | 'price_desc' | 'price_asc'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'price_asc', label: 'Price: low to high' },
]

// A collection of homes (the Featured page under its header; the home page's "more homes"):
//   - a bar with the count, a sort, and one-tap town filters (when the homes span several towns);
//   - HomeCards in a grid - the first one a wide panorama - revealed as they scroll in;
//   - a "get these before anyone else" tile in the grid (the agent's Showcase request form);
//   - "Show more" past the first page.
export default function HomeCollection({ listings, theme, basePrefix = '', onQuickView, title = 'More homes you’ll love', eyebrow = 'The collection', pageSize = 9, showTools = true }: {
  listings: HomeCardListing[]
  theme: SiteTheme
  basePrefix?: string
  onQuickView?: (key: string) => void
  title?: string
  eyebrow?: string
  pageSize?: number
  showTools?: boolean
}) {
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  const [sort, setSort] = useState<Sort>('newest')
  const [town, setTown] = useState<string | null>(null)
  const [limit, setLimit] = useState(pageSize)
  const towns = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of listings) if (l.city) counts.set(l.city, (counts.get(l.city) || 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }))
  }, [listings])
  const shown = useMemo(() => {
    const list = listings.filter(l => !town || l.city === town)
    if (sort === 'price_desc') return [...list].sort((a, b) => (b.price || 0) - (a.price || 0))
    if (sort === 'price_asc') return [...list].sort((a, b) => (a.price || 0) - (b.price || 0))
    return list
  }, [listings, sort, town])
  if (!listings.length) return null
  const page = shown.slice(0, limit)
  // The lead tile sits after the 4th card (or at the end of a short list).
  const tileAt = Math.min(4, page.length)

  const chip = (on: boolean) => on
    ? { backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)', borderColor: 'transparent' }
    : { backgroundColor: 'var(--site-surface)', color: 'var(--site-ink-soft)', borderColor: 'var(--site-line-strong)' }

  const leadTile = (
    <Reveal key="lead-tile" className="h-full">
      <a href={`${basePrefix}/create-showcase`}
        className={`group relative flex h-full min-h-[340px] flex-col justify-between overflow-hidden p-7 text-white transition duration-500 hover:-translate-y-1.5 ${luxe ? 'rounded-[26px]' : 'rounded-2xl'}`}
        style={{ background: luxe
          ? `radial-gradient(120% 90% at 100% 0%, rgba(var(--site-accent-rgb),.45), transparent 60%), radial-gradient(90% 80% at 0% 100%, rgba(var(--site-accent-rgb),.22), transparent 60%), ${theme.primary_color}`
          : 'radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,.18), transparent 55%), linear-gradient(150deg, var(--site-accent), var(--site-accent-deep))' }}>
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-[.08]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,.12)' }}><BellRing className="h-6 w-6" style={{ color: luxe ? 'var(--site-accent-light)' : '#fff' }} /></span>
        <span className="relative">
          <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: luxe ? 'var(--site-accent-light)' : 'rgba(255,255,255,.75)' }}>Free · private</span>
          <span className={`mt-2 block text-[26px] leading-tight ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`}>Get homes like these before anyone else.</span>
          <span className="mt-2 block text-sm text-white/70">Tell me what you love - you&apos;ll get your own private page that finds new matches the minute they list.</span>
        </span>
        <span className={`relative inline-flex w-fit items-center gap-2 px-5 py-3 text-sm font-black transition group-hover:gap-3 ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={luxe ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : { backgroundColor: '#fff', color: 'var(--site-accent-deep)' }}>
          Create my free Showcase <ArrowRight className="h-4 w-4" />
        </span>
      </a>
    </Reveal>
  )

  return (
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-20" data-testid="home-collection">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.26em]" style={{ color: 'var(--site-accent)' }}>
              {luxe && <Sparkles className="h-3.5 w-3.5" />}{eyebrow}
            </p>
            <h2 className={`mt-2 text-3xl leading-tight sm:text-4xl ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`} style={{ color: 'var(--site-heading)' }}>{title}</h2>
            <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--site-muted)' }}>{shown.length} {shown.length === 1 ? 'home' : 'homes'}{town ? ` in ${town}` : ''}</p>
          </div>
          {showTools && (
            <label className="relative inline-flex items-center">
              <span className="sr-only">Sort homes</span>
              <select value={sort} onChange={e => setSort(e.target.value as Sort)} className={`appearance-none border py-2.5 pl-4 pr-10 text-sm font-bold outline-none ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={chip(false)}>
                {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 h-4 w-4" style={{ color: 'var(--site-muted)' }} />
            </label>
          )}
        </div>
        {showTools && towns.length > 1 && (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <button type="button" onClick={() => { setTown(null); setLimit(pageSize) }} className={`shrink-0 border px-4 py-2 text-xs font-black transition ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={chip(!town)}>All towns</button>
            {towns.map(t => (
              <button key={t.name} type="button" onClick={() => { setTown(t.name); setLimit(pageSize) }} className={`shrink-0 border px-4 py-2 text-xs font-black transition ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={chip(town === t.name)}>
                {t.name} <span className="ml-1 opacity-60">{t.n}</span>
              </button>
            ))}
          </div>
        )}
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {page.map((l, k) => {
          const wide = k === 0 && !town && sort === 'newest' && page.length > 4
          return [
            k === tileAt ? leadTile : null,
            <Reveal key={`${town}-${sort}-${l.listing_key}`} delay={(k % 3) * 80} className={`h-full ${wide ? 'sm:col-span-2' : ''}`}>
              <HomeCard listing={l} theme={theme} basePrefix={basePrefix} onQuickView={onQuickView} wide={wide} />
            </Reveal>,
          ]
        })}
        {tileAt === page.length && leadTile}
      </div>

      {shown.length > limit && (
        <div className="mt-10 text-center">
          <button type="button" onClick={() => setLimit(v => v + pageSize)} className={`inline-flex items-center gap-2 border px-7 py-3.5 text-sm font-black transition hover:-translate-y-0.5 ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={chip(false)}>
            Show more homes <span style={{ color: 'var(--site-faint)' }}>({shown.length - limit} more)</span>
          </button>
        </div>
      )}
    </section>
  )
}
