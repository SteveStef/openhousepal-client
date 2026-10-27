'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, Crown, GraduationCap, Home, Landmark } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import { formatCompactPrice } from '../listingFormat'
import ClassicSectionHead from './ClassicSectionHead'
import SitePhoto from '@/components/website-public/SitePhoto'
import { IMG, sizedBg } from '@/lib/siteImage'

interface AreaCard {
  slug: string
  name: string
  state: string
  county: string | null
  photo: string | null
  summary: string | null
  median_price?: number | null
  active_count?: number | null
  min_price?: number | null
  max_price?: number | null
  price_range_basis?: string | null
  school_districts?: string[]
}

function neighborhoodsLabel(value?: string | null, fallback = '') {
  return (value || fallback)
    .replace(/\bCommunities\b/g, 'Neighborhoods')
    .replace(/\bCommunity\b/g, 'Neighborhood')
    .replace(/\bcommunities\b/g, 'neighborhoods')
    .replace(/\bcommunity\b/g, 'neighborhood')
}

function compactStats(area: AreaCard) {
  return [
    area.active_count != null ? { icon: Home, label: 'For sale', value: String(area.active_count) } : null,
    area.median_price != null ? { icon: Landmark, label: 'Median', value: formatCompactPrice(area.median_price) } : null,
    area.school_districts?.length ? { icon: GraduationCap, label: 'Schools', value: area.school_districts.slice(0, 2).join(' / ') } : null,
  ].filter(Boolean) as { icon: typeof Home; label: string; value: string }[]
}

function visibleWindow<T>(items: T[], start: number, count: number) {
  if (items.length <= count) return items
  return Array.from({ length: count }, (_, i) => items[(start + i) % items.length])
}

// One card slot in the row. When the row pages, each slot cross-fades its own card (old one lifts
// away, new one settles in from a soft blur), left to right a beat apart - instead of the whole
// row blinking out and back. Both cards share one grid cell so nothing jumps while they swap.
function Slot({ id, i, className, children }: { id: string; i: number; className?: string; children: ReactNode }) {
  return (
    <div className={`grid min-w-0 grid-cols-1 ${className || ''}`}>
      <AnimatePresence initial={false}>
        <motion.div
          key={id}
          className="min-w-0 [grid-area:1/1]"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.12 + i * 0.09 } }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.45, ease: [0.4, 0, 1, 1], delay: i * 0.06 } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// Front-page Neighborhoods preview: a row of photo tiles with live stats (homes for sale, median
// price, schools) that pages through the agent's served areas. Luxe sits on the brand's dark
// panel; Default on the page's quiet alternate background with ink text.
export default function CommunitiesBlock({ data, theme, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; basePrefix?: string }) {
  const luxe = theme.template !== 'default'
  const areas: AreaCard[] = data.resolved || []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // Luxe pages five at a time on its own; Classic shows four and lets the visitor page.
  const per = luxe ? 5 : 4
  const visibleAreas = useMemo(() => visibleWindow(areas, index, per), [areas, index, per])

  useEffect(() => {
    if (!luxe || areas.length <= 5 || paused) return
    const id = setInterval(() => setIndex(i => (i + 5) % areas.length), 7000)
    return () => clearInterval(id)
  }, [areas.length, luxe, paused])

  if (!areas.length) return null

  const eyebrow = neighborhoodsLabel(data.eyebrow, 'Neighborhoods We Serve')
  const headline = neighborhoodsLabel(data.headline, 'Explore Neighborhoods')
  const subtext = neighborhoodsLabel(data.subtext, 'Live inventory, price ranges, schools and local context at a glance.')
  const move = (pages: number) => setIndex(i => (i + pages * per + areas.length * per) % areas.length)
  if (!luxe) {
    return (
      <section className="px-6 py-16 sm:py-24" style={{ backgroundColor: 'var(--site-bg)' }}>
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <ClassicSectionHead eyebrow={eyebrow} title={headline} sub={subtext} />
            <div className="flex items-center gap-2">
              {areas.length > per && (
                <>
                  <button onClick={() => move(-1)} aria-label="Previous neighborhoods" className="grid h-11 w-11 place-items-center rounded-xl border transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => move(1)} aria-label="Next neighborhoods" className="grid h-11 w-11 place-items-center rounded-xl border transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><ChevronRight className="h-4 w-4" /></button>
                </>
              )}
              <a href={`${basePrefix}/neighborhoods`} className="inline-flex items-center gap-1.5 rounded-xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)' }}>All neighborhoods <ArrowRight className="h-4 w-4" /></a>
            </div>
          </div>
          <div className="-mx-6 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {visibleAreas.map((area, slot) => {
              const range = area.min_price != null && area.max_price != null ? `${formatCompactPrice(area.min_price)} - ${formatCompactPrice(area.max_price)}` : null
              const cells = [
                area.active_count != null ? ['For sale', String(area.active_count)] : null,
                area.median_price != null ? ['Median', formatCompactPrice(area.median_price)] : null,
              ].filter(Boolean) as [string, string][]
              return (
                <Slot key={slot} id={area.slug} i={slot} className="w-[78%] shrink-0 snap-start sm:w-auto">
                <a href={`${basePrefix}/${area.slug}`} className="ohp-card group flex h-full flex-col overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)' }}>
                  <div className="relative aspect-[4/3] overflow-hidden" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    <SitePhoto src={resolveMediaUrl(area.photo)} widths={IMG.card} className="ohp-mls-crop absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04] object-cover h-full w-full" />
                    {(area.county || area.state) && <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#111827] shadow-sm">{area.county ? (/\b(county|city)$/i.test(area.county) ? area.county : `${area.county} County`) : area.state}</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--site-heading)' }}>{area.name}</p>
                    {range && <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>{area.price_range_basis === 'sold_2y' ? 'Most homes sold for' : 'Homes from'} {range}</p>}
                    {area.school_districts?.length ? <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--site-ink-soft)' }}><GraduationCap className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--site-accent)' }} /><span className="truncate">{area.school_districts.slice(0, 2).join(' / ')}</span></p> : null}
                    {cells.length > 0 && (
                      <div className="mt-auto grid grid-cols-2 gap-px overflow-hidden rounded-xl border pt-0" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-line)', marginTop: '1rem' }}>
                        {cells.map(([k, v]) => (
                          <div key={k} className="px-3 py-2.5" style={{ backgroundColor: 'var(--site-surface-2)' }}>
                            <p className="text-base font-extrabold" style={{ color: 'var(--site-heading)' }}>{v}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--site-faint)' }}>{k}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: 'var(--site-accent-text)' }}>Explore {area.name} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                  </div>
                </a>
                </Slot>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  const onPanel = luxe
  const headingColor = onPanel ? '#ffffff' : 'var(--site-ink)'
  const subColor = onPanel ? 'rgba(255,255,255,0.6)' : 'var(--site-muted)'
  const ghostBtn = onPanel ? 'border-white/20 text-white hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:border-gray-300'

  return (
    <section className="overflow-hidden px-6 py-16 sm:py-24" style={{ backgroundColor: onPanel ? theme.primary_color : 'var(--site-bg-alt)' }}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: onPanel ? 'var(--site-accent)' : theme.primary_color }}>
                <Crown className="h-4 w-4" style={{ color: onPanel ? theme.primary_color : 'var(--site-accent)' }} />
              </span>
              <span className="h-px w-6" style={{ backgroundColor: 'var(--site-accent)' }} />
              <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: onPanel ? 'var(--site-accent-light)' : 'var(--site-accent)' }}>{eyebrow}</span>
            </div>
            <h2 className={`mt-3 text-4xl font-black leading-[1.1] sm:text-5xl ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: headingColor }}>{headline}</h2>
            <p className="mt-2 max-w-lg text-sm sm:text-base" style={{ color: subColor }}>{subtext}</p>
          </div>

          <div className="flex items-center gap-2">
            {areas.length > 5 && (
              <>
                <button onClick={() => move(-1)} aria-label="Previous neighborhoods" className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${ghostBtn}`}><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => move(1)} aria-label="Next neighborhoods" className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${ghostBtn}`}><ChevronRight className="h-4 w-4" /></button>
              </>
            )}
            <a href={`${basePrefix}/neighborhoods`} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wide transition hover:-translate-y-0.5 ${onPanel ? 'border border-white/20 text-white hover:bg-white/10' : 'text-white'}`} style={onPanel ? undefined : { backgroundColor: theme.primary_color }}>
              All Neighborhoods <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="-mx-6 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
          {visibleAreas.map((area, slot) => {
            const stats = compactStats(area)
            const range = area.min_price != null && area.max_price != null ? `${formatCompactPrice(area.min_price)}-${formatCompactPrice(area.max_price)}` : null
            return (
              <Slot key={slot} id={area.slug} i={slot} className="w-[72%] shrink-0 snap-start sm:w-auto">
              <a
                href={`${basePrefix}/${area.slug}`}
                className={`ohp-card group relative block aspect-[7/10] min-h-[240px] w-full overflow-hidden bg-gray-800 shadow-[0_18px_45px_rgba(0,0,0,0.22)] ring-1 ring-white/10 transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(0,0,0,0.32)] ${luxe ? 'rounded-[18px]' : 'rounded-2xl'}`}
              >
                <SitePhoto src={resolveMediaUrl(area.photo)} widths={IMG.half} className="ohp-mls-crop absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110 object-cover h-full w-full" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/5" />
                <span className="absolute left-2.5 top-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm " style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.85)', color: 'var(--site-on-accent)' }}>
                  {area.county ? (/\b(county|city)$/i.test(area.county) ? area.county : `${area.county} County`) : area.state}
                </span>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className={`text-lg font-black leading-tight text-white ${fontClass(theme.heading_font, 'font-serif')}`}>{area.name}</p>
                  {range && <p className="mt-1 text-[11px] font-bold text-white/70">{area.price_range_basis === 'sold_2y' ? `Most sold ${range}` : range}</p>}
                  <div className="mt-3 space-y-1.5">
                    {stats.map(stat => {
                      const Icon = stat.icon
                      return (
                        <div key={stat.label} className="flex items-center justify-between gap-2 rounded-xl bg-black/30 px-2.5 py-1.5 ">
                          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-white/55"><Icon className="h-3 w-3" />{stat.label}</p>
                          <p className="line-clamp-1 max-w-[58%] text-right text-xs font-black text-white">{stat.value}</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-wide" style={{ color: 'var(--site-accent-light)' }}>
                    Explore <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </a>
              </Slot>
            )
          })}
        </div>
      </div>
    </section>
  )
}
