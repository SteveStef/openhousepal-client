'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import FormWindow from '@/components/forms/FormWindow'
import { ArrowRight, Bath, BedDouble, CalendarDays, Images, MapPin, Ruler, Trees } from 'lucide-react'
import OpenHouseChip from '@/components/OpenHouseChip'
import { formatOpenHouse, upcomingOpenHouses, type MlsOpenHouse } from '@/lib/mlsOpenHouses'
import { AgentSale, formatSaleStatus, getSaleLocation, getSaleStatusClass, getStreetOnly } from '@/lib/agentSales'

// One listing gets the whole row - as a wide, low card at every width: the first photo on the
// left, the price, address, facts and open houses on the right, and the same click-through the
// small card had (the agent's Spotlight for this home, else the plain property page). Phones get
// a short bar (one row, rounded ends); tablets and desktops the wide rectangle. Classic and Luxe
// looks; `compact` is the hub home's shelf-height version (about half the height of the Sales
// page's card).

// Loose on `source` so the hub pages' own listing types (plain strings) fit too.
export type FeatureListing = Omit<AgentSale, 'source'> & { source?: string; open_houses?: MlsOpenHouse[] }

const fmtNum = (value?: number) => (value === undefined || value === null ? '' : Number.isInteger(value) ? String(value) : String(value))

export function listingFacts(listing: FeatureListing) {
  return [
    listing.beds ? { icon: BedDouble, value: fmtNum(listing.beds), label: listing.beds === 1 ? 'Bed' : 'Beds' } : null,
    listing.baths ? { icon: Bath, value: fmtNum(listing.baths), label: listing.baths === 1 ? 'Bath' : 'Baths' } : null,
    listing.sqft ? { icon: Ruler, value: Number(listing.sqft).toLocaleString(), label: 'Sq Ft' } : null,
    listing.acres ? { icon: Trees, value: String(listing.acres), label: Number(listing.acres) === 1 ? 'Acre' : 'Acres' } : null,
  ].filter(Boolean) as { icon: typeof Bath; value: string; label: string }[]
}

// Phone line - short units so all four facts fit on one line ("5,024 sq f..." used to cut off the acres).
const SHORT_FACT: Record<string, string> = { Bed: 'bd', Beds: 'bd', Bath: 'ba', Baths: 'ba', 'Sq Ft': 'sf', Acre: 'ac', Acres: 'ac' }

export const listingKicker = (status: string) =>
  status === 'Coming Soon' ? 'Coming to market' : status === 'Active' ? 'Now on the market' : status === 'Sold' ? 'Just sold' : status

export default function ListingFeatureCard({ listing, luxe = false, compact = false, href, showingHref, onClick, className = '' }: {
  listing: FeatureListing
  luxe?: boolean
  compact?: boolean
  /** Where the home opens (Spotlight / property page). None = the card isn't a link. */
  href?: string | null
  /** The agent's "Schedule a Showing" form - opens in a window over the page with this home filled in. */
  showingHref?: string
  onClick?: () => void
  className?: string
}) {
  const router = useRouter()
  const [showingOpen, setShowingOpen] = useState(false)
  const status = formatSaleStatus(listing.status)
  const sold = status === 'Sold'
  const photos = (listing.photos && listing.photos.length ? listing.photos : [listing.image || '']).filter(Boolean)
  const main = photos[0] || '/placeholder.jpg'
  const facts = listingFacts(listing)
  const openHouses = upcomingOpenHouses(listing.open_houses)
  const price = listing.price ? `$${listing.price.toLocaleString()}` : 'Price upon request'
  const street = getStreetOnly(listing.address)
  const location = getSaleLocation(listing as AgentSale)
  const ink = luxe ? 'text-white' : 'text-[#111827] dark:text-white'
  const soft = luxe ? 'text-white/60' : 'text-gray-500 dark:text-gray-300'
  const metal = luxe ? 'text-[var(--m-light)]' : 'text-[#C9A24D]'

  const statusPill = sold
    ? 'hub-lx-sold rounded-[9px] px-3 py-1.5 text-[10px]'
    : `rounded-full px-2.5 py-1 text-[9.5px] shadow ${getSaleStatusClass(listing.status)}`

  // The first photo only - a mosaic of three read as busy and made the card tall.
  const photoSide = (
    <div className={`relative shrink-0 overflow-hidden ${compact ? 'w-[40%] min-w-[132px] sm:w-[42%]' : 'w-[38%] min-w-[128px] sm:w-[44%]'}`}>
      <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.6s] ease-out group-hover/feat:scale-[1.05]" style={{ backgroundImage: `url(${main})` }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/10" />
      {luxe && <span aria-hidden className="hub-lx-sweep absolute inset-y-0 left-0 w-1/3" />}
      {/* status, with the open house (if any) right beside it */}
      <span className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center font-black uppercase tracking-wide ${statusPill}`}>{sold && <span className="hub-lx-sold-dot" />}<span className="relative">{status}</span></span>
        {openHouses.length > 0 && <span className="hidden min-w-0 sm:flex"><OpenHouseChip openHouses={listing.open_houses} variant={luxe ? 'luxe' : 'classic'} compact /></span>}
      </span>
      {photos.length > 1 && !compact && (
        <span className="absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white sm:inline-flex">
          <Images className="h-3 w-3" /> {photos.length} photos
        </span>
      )}
    </div>
  )


  const detailSide = (
    <div className={`relative flex min-w-0 flex-1 flex-col justify-center ${compact ? 'px-4 py-3.5 sm:px-6 sm:py-4' : 'px-4 py-3.5 sm:px-7 sm:py-6 lg:px-9 lg:py-8'}`}>
      {!compact && (
        <p className={`hidden items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] sm:flex ${luxe ? 'text-[var(--m-light)]' : 'text-[#8b7355] dark:text-[#d7b974]'}`}>
          <span className={`h-px w-6 ${luxe ? 'bg-[var(--m-light)]' : 'bg-[#d2b16f]'}`} />{listingKicker(status)}
        </p>
      )}
      {luxe ? (
        <p className={`hub-lx-price leading-none ${compact ? 'text-[24px] sm:text-[28px]' : 'text-[24px] sm:mt-2.5 sm:text-[36px] lg:text-[42px]'}`}>{price}</p>
      ) : (
        <p className={`font-black leading-none tracking-tight ${ink} ${compact ? 'text-[22px] sm:text-[26px]' : 'text-[22px] sm:mt-2.5 sm:text-4xl lg:text-[44px]'}`}>{price}</p>
      )}
      <h3 className={`mt-1.5 truncate font-serif font-black leading-tight ${ink} ${compact ? 'text-[15px] sm:text-lg' : 'text-[15px] sm:text-2xl lg:text-[26px]'}`}>{street}</h3>
      <p className={`mt-1 flex items-center gap-1.5 truncate text-xs font-semibold sm:text-sm ${soft}`}>
        <MapPin className={`h-3.5 w-3.5 shrink-0 ${luxe ? 'text-[var(--m-light)]' : 'text-[#d0ad65]'}`} /> <span className="truncate">{location}</span>
      </p>

      {facts.length > 0 && (
        <>
          {/* phones: one quiet line; tablets up: tiles */}
          <p className={`mt-1.5 truncate text-[11px] font-bold sm:hidden ${soft}`}>{facts.map(f => `${f.value} ${SHORT_FACT[f.label] || f.label.toLowerCase()}`).join(' · ')}</p>
          {/* tablets up: one row of square tiles - icon on top, number + label under it. Pills used
              to wrap, dropping Acres onto a second line. */}
          <div className={`hidden sm:grid ${compact ? 'mt-2.5 max-w-[340px] gap-1.5' : 'mt-4 max-w-[420px] gap-2'}`} style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
            {facts.map(({ icon: Icon, value, label }) => (
              <span key={label} className={`flex min-w-0 flex-col items-center justify-center rounded-xl text-center ${compact ? 'px-1 py-1.5' : 'px-1.5 py-2.5'} ${luxe ? 'border border-white/10 bg-white/[0.05]' : 'border border-gray-200 bg-[#fbfaf7] dark:border-gray-700 dark:bg-[#0f0f0f]'}`}>
                <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${metal}`} />
                <span className={`mt-1 max-w-full truncate font-black leading-none ${ink} ${compact ? 'text-[12px]' : 'text-[15px]'}`}>{value}</span>
                <span className={`mt-0.5 max-w-full truncate font-bold uppercase tracking-wide ${luxe ? 'text-white/50' : 'text-gray-400'} ${compact ? 'text-[8.5px]' : 'text-[9.5px]'}`}>{label}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {openHouses.length > 0 && !compact && (
        <ul className="mt-3 hidden space-y-1 lg:block">
          {openHouses.slice(0, 2).map(oh => (
            <li key={`${oh.date}-${oh.start || ''}`} className={`flex items-center gap-2 text-sm font-semibold ${luxe ? 'text-white/85' : 'text-[#111827] dark:text-white'}`}>
              <CalendarDays className={`h-3.5 w-3.5 ${luxe ? 'text-[var(--m-light)]' : 'text-emerald-500'}`} />Open house {formatOpenHouse(oh)}
            </li>
          ))}
        </ul>
      )}

      <div className={`hidden flex-wrap items-center gap-2 sm:flex ${compact ? 'mt-3' : 'mt-5 lg:mt-6'}`}>
        {href ? (
          <Link href={href} onClick={e => { e.stopPropagation(); onClick?.() }} className={`inline-flex items-center gap-2 rounded-full font-black shadow-lg ${compact ? 'px-3.5 py-1.5 text-xs' : 'px-4 py-2 text-[13px]'} transition-transform duration-300 group-hover/feat:translate-x-0.5 ${luxe ? 'bg-gradient-to-r from-[var(--m-deep)] via-[var(--m-base)] to-[var(--m-light)] text-[#111827] shadow-[0_14px_30px_-14px_rgba(var(--m-rgb),.9)]' : 'bg-[#111827] text-white shadow-[#111827]/25 dark:bg-white dark:text-[#111827]'}`}>
            View this home <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
        {showingHref && (
          <button type="button" onClick={e => { e.stopPropagation(); setShowingOpen(true) }} className={`inline-flex items-center gap-2 rounded-full border font-black transition hover:-translate-y-0.5 ${compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-[13px]'} ${luxe ? 'border-white/20 text-white hover:border-[var(--m-light)]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white'}`}>
            <CalendarDays className="h-4 w-4" /> Schedule a showing
          </button>
        )}
      </div>
      {href && <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 sm:hidden ${metal}`}><ArrowRight className="h-4 w-4" /></span>}
    </div>
  )

  const size = compact ? 'min-h-[132px] sm:min-h-[172px]' : 'min-h-[138px] sm:min-h-[236px] lg:min-h-[280px]'
  const radius = compact ? 'rounded-[22px]' : 'rounded-[22px] sm:rounded-[26px]'
  const inner = luxe ? (
    <>
      <span aria-hidden className={`absolute inset-0 ${radius} bg-gradient-to-br from-[var(--m-cream)] via-[rgba(var(--m-rgb),0.45)] to-[var(--m-deep)]`} />
      <span className={`relative flex overflow-hidden rounded-[20.5px] bg-[#0f1420] sm:rounded-[24.5px] ${size}`}>
        {photoSide}
        {detailSide}
      </span>
    </>
  ) : (
    <span className={`relative flex overflow-hidden ${radius} border border-gray-200 bg-white shadow-sm transition-shadow duration-500 group-hover/feat:shadow-[0_30px_60px_-36px_rgba(17,24,39,.45)] dark:border-gray-800 dark:bg-[#151517] ${size}`}>
      {photoSide}
      {detailSide}
    </span>
  )
  // The whole card opens the home (a div, not a link - the buttons inside are real links, and a
  // link can't hold links). Spotlights live on their own domain, so absolute URLs navigate fully.
  const go = () => {
    if (!href) return
    onClick?.()
    if (/^https?:\/\//i.test(href)) window.location.assign(href)
    else router.push(href)
  }
  const base = `group/feat relative block w-full text-left ${luxe ? `hub-lx-card hub-lx-gcard overflow-hidden ${radius} p-[1.5px]` : ''} ${href ? 'cursor-pointer' : ''} ${className}`
  return (
    <div
      role={href ? 'link' : undefined}
      tabIndex={href ? 0 : undefined}
      onClick={go}
      onKeyDown={e => { if (href && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go() } }}
      className={base}
    >
      {inner}
      {showingHref && (
        <span onClick={e => e.stopPropagation()}>
          <FormWindow url={showingOpen ? showingHref.split('?')[0] : null} title="Schedule a showing" prefill={{ property_of_interest: [street, location].filter(Boolean).join(', ') }} onClose={() => setShowingOpen(false)} />
        </span>
      )}
    </div>
  )
}
