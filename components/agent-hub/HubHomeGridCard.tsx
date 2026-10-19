'use client'

import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Images, MapPin } from 'lucide-react'
import OpenHouseChip from '@/components/OpenHouseChip'
import HubStatusBadge from '@/components/agent-hub/HubStatusBadge'
import { listingFacts, type FeatureListing } from '@/components/agent-hub/ListingFeatureCard'
import { formatOpenHouse, upcomingOpenHouses } from '@/lib/mlsOpenHouses'
import { AgentSale, getSaleLocation, getStreetOnly } from '@/lib/agentSales'
import { sizedBg } from '@/lib/siteImage'

// A home card on the agent's Sales page (current listings and past sales), in the hub's own look:
// Classic = white card lit by the agent's accent color, Luxe = the dark card in a metal frame.
// Photo: status (+ open house beside it), photo count, "Listed at" / "Sold for" and the price.
// Under it: the street and town on the left, the home's facts on the right (that side used to sit
// empty), open house times for a listing, and a footer (sold date, or "View home").

const SHORT: Record<string, string> = { Bed: 'bd', Beds: 'bd', Bath: 'ba', Baths: 'ba', 'Sq Ft': 'sq ft', Acre: 'ac', Acres: 'ac' }

const soldOn = (value?: string) => {
  if (!value) return ''
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function HubHomeGridCard({ home, kind, luxe = false, href, index = 0 }: {
  home: FeatureListing
  kind: 'listing' | 'sale'
  luxe?: boolean
  /** Where the card opens (Spotlight / property page). None = not a link. */
  href?: string | null
  index?: number
}) {
  const sale = kind === 'sale'
  const photos = (home.photos && home.photos.length ? home.photos : [home.image || '']).filter(Boolean)
  const image = photos[0] || '/placeholder.jpg'
  const price = home.price ? `$${home.price.toLocaleString()}` : sale ? 'Price unavailable' : 'Price upon request'
  const facts = listingFacts(home).slice(0, 3)
  const openHouses = sale ? [] : upcomingOpenHouses(home.open_houses)
  const date = sale ? soldOn(home.sold_date) : ''
  const street = getStreetOnly(home.address)
  const town = getSaleLocation(home as AgentSale)

  const ink = luxe ? 'text-white' : 'text-[#111827] dark:text-white'
  const soft = luxe ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'
  const accent = luxe ? 'text-[var(--m-light)]' : 'text-[var(--hub-accent-deep,#8b7355)] dark:text-[var(--hub-accent-soft,#d7b974)]'

  const body = (
    <>
      <span className="relative block aspect-[4/3] overflow-hidden">
        <span className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.4s] ease-out group-hover/hc:scale-[1.07]" style={{ backgroundImage: sizedBg(image, 640) }} />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/10" />
        {luxe && <span aria-hidden className="hub-lx-sweep absolute inset-y-0 left-0 w-1/3" />}
        <span className="absolute left-3 right-3 top-3 flex items-center gap-1.5">
          <HubStatusBadge status={home.status || (sale ? 'Sold' : 'Active')} size="sm" />
          {openHouses.length > 0 && <span className="flex min-w-0"><OpenHouseChip openHouses={home.open_houses} variant={luxe ? 'luxe' : 'classic'} compact /></span>}
          {photos.length > 1 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-black text-white ring-1 ring-white/15">
              <Images className="h-3 w-3" /> {photos.length}
            </span>
          )}
        </span>
        <span className="absolute inset-x-4 bottom-3.5 block">
          <span className={`block text-[9.5px] font-black uppercase tracking-[0.24em] ${luxe ? 'text-[var(--m-light)]' : 'text-white/75'}`}>{sale ? 'Sold for' : 'Listed at'}</span>
          <span className={`mt-1 block leading-none ${luxe ? 'hub-lx-price text-[28px]' : 'text-[27px] font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.35)]'}`}>{price}</span>
        </span>
      </span>

      <span className="block px-4 pb-4 pt-3.5">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1">
            <span className={`block line-clamp-2 font-serif text-[17px] font-black leading-snug ${ink}`}>{street}</span>
            <span className={`mt-1 flex items-center gap-1 text-[12.5px] font-semibold ${soft}`}>
              <MapPin className={`h-3.5 w-3.5 shrink-0 ${accent}`} /><span className="truncate">{town}</span>
            </span>
          </span>
          {facts.length > 0 && (
            <span className={`flex shrink-0 flex-col items-end gap-1 border-l pl-3 ${luxe ? 'border-white/10' : 'border-gray-100 dark:border-white/10'}`}>
              {facts.map(({ icon: Icon, value, label }) => (
                <span key={label} className={`inline-flex items-center gap-1.5 text-[12px] font-black leading-none ${ink}`}>
                  <Icon className={`h-3.5 w-3.5 ${accent}`} />{value}<span className={`font-bold ${soft}`}>{SHORT[label] || label.toLowerCase()}</span>
                </span>
              ))}
            </span>
          )}
        </span>

        {openHouses.length > 0 && (
          <span className={`mt-3 block rounded-xl px-3 py-2 ${luxe ? 'border border-white/10 bg-white/[0.04]' : 'border border-emerald-100 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/[0.07]'}`}>
            <span className={`block text-[9.5px] font-black uppercase tracking-[0.2em] ${luxe ? 'text-[var(--m-light)]' : 'text-emerald-700 dark:text-emerald-300'}`}>Open {openHouses.length === 1 ? 'house' : 'houses'}</span>
            {openHouses.slice(0, 3).map(oh => (
              <span key={`${oh.date}-${oh.start || ''}`} className={`mt-1 flex items-center gap-2 text-[12.5px] font-semibold ${ink}`}>
                <CalendarDays className={`h-3.5 w-3.5 shrink-0 ${luxe ? 'text-[var(--m-light)]' : 'text-emerald-600 dark:text-emerald-400'}`} />{formatOpenHouse(oh)}
              </span>
            ))}
          </span>
        )}

        {(date || href) && (
          <span className={`mt-3.5 flex items-center justify-between gap-2 border-t pt-3 text-[11px] font-black uppercase tracking-[0.14em] ${luxe ? 'border-white/10' : 'border-gray-100 dark:border-white/10'}`}>
            {sale
              ? <span className={`inline-flex items-center gap-1.5 ${soft}`}><CalendarDays className={`h-3.5 w-3.5 ${accent}`} />{date ? `Sold ${date}` : 'Recent sale'}</span>
              : <span className={accent}>View home</span>}
            {href && (
              <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-300 group-hover/hc:-translate-y-0.5 group-hover/hc:translate-x-0.5 ${luxe ? 'bg-gradient-to-br from-[var(--m-light)] to-[var(--m-deep)] text-[#111827]' : 'bg-[var(--hub-accent,#C9A24D)] text-[var(--hub-accent-ink,#fff)]'}`}>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            )}
          </span>
        )}
      </span>
    </>
  )

  const frame = luxe
    ? 'hub-lx-card hub-lx-gcard group/hc relative block overflow-hidden rounded-[22px] p-[1.5px]'
    : 'hub-lx-gcard group/hc relative block overflow-hidden rounded-[22px] border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(17,24,39,.04),0_12px_32px_-22px_rgba(17,24,39,.35)] transition duration-500 hover:-translate-y-1 hover:border-[rgba(var(--hub-accent-rgb,201,162,77),.45)] hover:shadow-[0_28px_56px_-30px_rgba(17,24,39,.5)] dark:border-white/10 dark:bg-[#151517] dark:hover:border-[rgba(var(--hub-accent-rgb,201,162,77),.5)]'
  const inner = luxe ? (
    <>
      <span aria-hidden className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-[var(--m-cream)] via-[rgba(var(--m-rgb),0.45)] to-[var(--m-deep)]" />
      <span className="relative block h-full overflow-hidden rounded-[20.5px] bg-[#111827]">{body}</span>
    </>
  ) : body
  const style = { animationDelay: `${Math.min(index, 12) * 70}ms` }
  if (!href) return <article className={frame} style={style}>{inner}</article>
  // Spotlights live on their own domain - absolute URLs are plain links.
  return /^https?:\/\//i.test(href)
    ? <a href={href} className={frame} style={style}>{inner}</a>
    : <Link href={href} className={frame} style={style}>{inner}</Link>
}
