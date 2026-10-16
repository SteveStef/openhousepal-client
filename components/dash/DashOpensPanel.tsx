'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, Bath, Bed, CalendarCheck, Hammer, Home, Inbox, Maximize, Search, Users } from 'lucide-react'
import { HostRequest, MyListingItem } from '@/types'
import WeekendCalendarCards, { hostingNote } from '@/components/open-house-manager/WeekendCalendarCards'
import ScrollableSection from './ScrollableSection'
import { CoverageMeter, ListingCover, Pill, SectionLabel, compactPrice, niceAddress, whenText } from './openHouseBits'

export interface DiscoveryListing {
  ListingKey: string
  Street?: string
  City?: string
  State?: string
  Image?: string
  Price?: string
  Beds?: number
  Baths?: number
  SquareFeet?: number
  DaysOnMarket?: number
  DistanceFromLandmark?: number
  /** Coming Soon: "coming_soon" = no go-live date yet; HostsFrom = first day it can be hosted. */
  HostingBlocked?: string | null
  HostsFrom?: string | null
}

// Pending requests need a response fast (the other agent is waiting), so this sits at the very
// top of the panel and glows - the same "needs your attention right now" treatment the
// page-level headliner uses. Each row says who wants which date, with a Review button.
function RequestsSection({ hostRequests }: { hostRequests: HostRequest[] }) {
  if (hostRequests.length === 0) return null
  return (
    <div className="animate-pulse-glow rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-3 shadow-[0_0_22px_rgba(245,158,11,0.28)] dark:border-amber-500/50 dark:from-amber-500/10 dark:via-transparent dark:to-amber-500/5">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-500 text-white"><Inbox className="h-3 w-3" /></span>
        {hostRequests.length} agent{hostRequests.length === 1 ? '' : 's'} asked to host - waiting on you
      </p>
      <ScrollableSection maxHeightClass="max-h-[210px]" viewHref="/open-houses/my-listings?panel=host-requests" viewLabel="View all requests">
        {hostRequests.slice(0, 9).map(hr => (
          <Link
            key={hr.id}
            href={`/open-houses/my-listings?listingKey=${encodeURIComponent(hr.listing_key)}`}
            className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-amber-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 dark:border-amber-500/25 dark:bg-[#151517]"
          >
            <ListingCover src={hr.property_image} className="h-10 w-12" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-[#111827] dark:text-white">{niceAddress(hr.property_address) || hr.listing_key}</p>
              <p className="line-clamp-2 text-[10.5px] font-semibold text-gray-500 dark:text-gray-400">
                <span className="font-black text-[#111827] dark:text-white">{hr.requesting_agent_name}</span> · {whenText(hr.requested_date, hr.requested_start_time, hr.requested_end_time)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-white shadow-sm transition group-hover:bg-amber-600">Review</span>
          </Link>
        ))}
      </ScrollableSection>
    </div>
  )
}

// Shared with DashDiscoveryPanel so the two cards land at the same height on Dash regardless of
// which one has more content - a fixed floor, not an attempt to measure/match at render time.
export const DASH_OPENS_MIN_HEIGHT_CLASS = 'min-h-[360px]'

export default function DashOpensPanel({ listings, hostRequests, discoveryListings, hasSearchPreferences }: {
  listings: MyListingItem[]
  hostRequests: HostRequest[]
  discoveryListings: DiscoveryListing[]
  // Whether the agent has ever saved Discovery search preferences (landmark/radius, etc.) - lets
  // the empty state tell "you haven't set up a search yet" apart from "your search just has no
  // nearby matches right now", which need different next steps (set up vs. widen/wait).
  hasSearchPreferences: boolean
}) {
  const router = useRouter()

  if (listings.length === 0) {
    const topMatches = [...discoveryListings]
      .sort((a, b) => (a.DistanceFromLandmark ?? Infinity) - (b.DistanceFromLandmark ?? Infinity))
      .slice(0, 6)

    return (
      <div className={`min-w-0 space-y-3 ${DASH_OPENS_MIN_HEIGHT_CLASS}`}>
        <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">
          No listings under your name yet. Listings where you're the MLS listing agent show up here automatically once synced.
        </p>
        {topMatches.length > 0 && (
          <div className="min-w-0">
            <SectionLabel>Or host one of these instead</SectionLabel>
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2">
              {topMatches.map(listing => (
                <Link key={listing.ListingKey} href="/discovery" className="group/oh flex min-w-0 items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/40 dark:border-gray-800 dark:bg-[#151517]">
                  <ListingCover src={listing.Image} className="h-10 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-[#111827] dark:text-white">{listing.Street || 'Property'}{listing.City ? `, ${listing.City}` : ''}</p>
                    <p className="truncate text-[10px] font-semibold text-gray-400">
                      {[listing.Price, listing.DistanceFromLandmark != null ? `${listing.DistanceFromLandmark.toFixed(1)} mi` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        {topMatches.length === 0 && !hasSearchPreferences && (
          <Link
            href="/discovery"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C9A24D]/40 bg-[#C9A24D]/5 py-3 text-xs font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 dark:text-[#d7b974]"
          >
            <Search className="h-3.5 w-3.5" /> Set up your Discovery search to find one to host
          </Link>
        )}
      </div>
    )
  }

  // Listings still needing a host lead (most actionable first), then the rest, then the ones that
  // can't have an open house right now (under contract / Coming Soon with no go-live date).
  const needsHost = listings.filter(l => l.open_house_status === 'needs_host' && !l.hosting_blocked)
  const ordered = [
    ...needsHost,
    ...listings.filter(l => l.open_house_status !== 'needs_host' && !l.hosting_blocked),
    ...listings.filter(l => l.hosting_blocked),
  ]
  // Up to STACK_LIMIT listings render one-per-row (full width) so this panel's height lands close
  // to Discovery's own 3-card stack when the two sit side by side on Dash. Past that it switches
  // to the 2-per-row grid, capped at 4 (2 full rows), with a "view all" link for the rest.
  const STACK_LIMIT = 3
  const stacked = ordered.length <= STACK_LIMIT
  const calendarListings = stacked ? ordered : ordered.slice(0, 4)
  // Another agent's request still waiting on you shows on its date as "Request in", not "Find Host".
  const pendingFor = (key: string) => hostRequests.filter(r => r.listing_key === key && r.status === 'pending').map(r => String(r.requested_date))

  return (
    <div className={`min-w-0 space-y-4 ${DASH_OPENS_MIN_HEIGHT_CLASS}`}>
      <RequestsSection hostRequests={hostRequests} />

      <div>
        <SectionLabel right={<span className="text-[10px] font-bold text-gray-400">Next 4 open-house days</span>}>Your listings</SectionLabel>
        <div className={`grid min-w-0 gap-2.5 ${stacked ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {calendarListings.map((listing, i) => {
            const pending = pendingFor(listing.listing_key)
            const kitsToBuild = (listing.confirmed_pending_kit || []).length
            // Under contract / Coming Soon before it goes live - says why, instead of "Hosts needed".
            const cantHost = hostingNote(listing)
            const openListing = () => router.push(`/open-houses/my-listings?listingKey=${encodeURIComponent(listing.listing_key)}`)
            return (
              <motion.div
                key={listing.listing_key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 26 }}
                className={`group/oh relative min-w-0 overflow-hidden rounded-2xl border bg-white p-2.5 shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-26px_rgba(201,162,77,.8)] dark:bg-[#151517] ${
                  cantHost ? 'border-gray-200 dark:border-gray-800' : listing.open_house_status === 'needs_host' ? 'border-amber-200/80 hover:border-amber-300 dark:border-amber-500/20' : 'border-emerald-200/80 hover:border-emerald-300 dark:border-emerald-500/20'}`}
              >
                {/* status edge - amber still needs a host, green all set, grey can't have one yet */}
                <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${cantHost ? 'bg-gray-300 dark:bg-gray-700' : listing.open_house_status === 'needs_host' ? 'bg-gradient-to-b from-amber-300 to-amber-500' : 'bg-gradient-to-b from-emerald-300 to-emerald-500'}`} />
                <button type="button" onClick={openListing} className="flex w-full min-w-0 items-center gap-3 text-left">
                  <ListingCover
                    src={listing.image}
                    price={compactPrice(listing.price)}
                    chip={listing.days_on_market != null ? `${listing.days_on_market}d` : undefined}
                    className={stacked ? 'h-[72px] w-[96px]' : 'h-14 w-16'}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[14.5px] font-black leading-tight text-[#111827] dark:text-white">{niceAddress(listing.address)}</p>
                    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[10.5px] font-bold text-gray-400">
                      {listing.city && <span className="truncate">{niceAddress(listing.city)}</span>}
                      {listing.bedrooms != null && <span className="inline-flex items-center gap-0.5"><Bed className="h-2.5 w-2.5" />{listing.bedrooms}</span>}
                      {listing.bathrooms != null && <span className="inline-flex items-center gap-0.5"><Bath className="h-2.5 w-2.5" />{listing.bathrooms}</span>}
                      {listing.living_area != null && stacked && <span className="inline-flex items-center gap-0.5"><Maximize className="h-2.5 w-2.5" />{Number(listing.living_area).toLocaleString()}</span>}
                    </p>
                    <div className="mt-1.5"><CoverageMeter opens={listing.scheduled_opens} pendingDates={pending} openLabel="need a host" hostingWindow={listing} /></div>
                  </div>
                </button>
                {/* What's going on with it, in one row of pills */}
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
                  {cantHost
                    ? <Pill tone="muted" icon={listing.hosting_blocked === 'pending' || listing.hosting_blocked === 'off_market' ? Home : CalendarCheck} title={cantHost}>{listing.hosting_blocked === 'pending' ? 'Under contract' : listing.hosting_blocked === 'off_market' ? 'Off market' : 'Coming Soon'}</Pill>
                    : listing.open_house_status === 'needs_host'
                    ? <Pill tone="amber" icon={Users}>Hosts needed</Pill>
                    : <Pill tone="green" icon={CalendarCheck}>Host booked</Pill>}
                  {listing.pending_request_count > 0 && <Pill tone="red" icon={Inbox}>{listing.pending_request_count} request{listing.pending_request_count === 1 ? '' : 's'}</Pill>}
                  {kitsToBuild > 0 && <Pill tone="gold" icon={Hammer} title="A host is confirmed but hasn't built their kit yet">{kitsToBuild === 1 ? 'Kit not built' : `${kitsToBuild} kits not built`}</Pill>}
                  {listing.opens_hosted_count > 0 && stacked && (
                    <Pill tone="muted" icon={Users} title="Average guests per hosted open house">~{Math.round(listing.avg_guests_per_open)} guests / open</Pill>
                  )}
                </div>
                <div className="mt-2">
                  <WeekendCalendarCards
                    opens={listing.scheduled_opens}
                    onCellClick={openListing}
                    size={stacked ? 'md' : 'sm'}
                    emptyCellTitle="Click to find a host for this date"
                    filledCellTitle="Click to view/edit host notes for this open"
                    emptyCellLabel="Find Host"
                    pendingDates={pending}
                    pendingLabel="Request in"
                    pendingTitle="An agent asked to host this date - review it"
                    hostingWindow={listing}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Always shown (not just when there's overflow beyond what's rendered above) - same
          "Browse all of X" pattern Discovery's own panel ends on, for the same reason: a
          consistent way out to the full page regardless of how many listings fit here. */}
      <Link href="/open-houses/my-listings" className="group flex items-center justify-center gap-1.5 rounded-xl border border-[#C9A24D]/25 bg-[#C9A24D]/[0.05] py-2 text-[10.5px] font-black uppercase tracking-wide text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D] hover:text-white dark:text-[#d7b974] dark:hover:text-[#111827]">
        <Home className="h-3 w-3" /> All my listings{listings.length > calendarListings.length ? ` (${listings.length})` : ''} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </Link>
    </div>
  )
}
