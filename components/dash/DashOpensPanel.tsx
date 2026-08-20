'use client'

import Link from 'next/link'
import { AlertCircle, CalendarCheck, Home, Inbox, Search } from 'lucide-react'
import { HostRequest, MyListingItem } from '@/types'
import { formatShortDate, formatTime } from '@/components/open-house-manager/formatters'
import ScrollableSection from './ScrollableSection'

export interface DiscoveryListing {
  ListingKey: string
  Street?: string
  City?: string
  State?: string
  Image?: string
  Price?: string
  Beds?: number
  Baths?: number
  DistanceFromLandmark?: number
}

// Small photo thumbnail shared by the sections below - same "your listing, at a glance" pattern
// as the Open House Kits & Forms panel's own thumbnails, so a request/scheduled slot reads as a
// real listing instead of just an address string.
function ListingThumb({ src }: { src?: string | null }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white dark:bg-[#151517]">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <Home className="h-3.5 w-3.5 text-gray-300" />}
    </div>
  )
}

function RequestsSection({ hostRequests }: { hostRequests: HostRequest[] }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <Inbox className="h-3 w-3" /> Requests
      </p>
      {hostRequests.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-3 text-center text-xs font-bold text-gray-400 dark:border-gray-700">No pending requests</p>
      ) : (
        <ScrollableSection maxHeightClass="max-h-[210px]" viewHref="/open-houses/my-listings" viewLabel="View all requests">
          {hostRequests.slice(0, 9).map(hr => (
            <Link
              key={hr.id}
              href="/open-houses/my-listings"
              className="flex min-w-0 items-center gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/60 p-2.5 shadow-sm transition hover:-translate-y-0.5 dark:border-amber-500/20 dark:bg-amber-500/5"
            >
              <ListingThumb src={hr.property_image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-[#111827] dark:text-white">{hr.property_address || hr.listing_key}</p>
                <p className="truncate text-[10px] font-semibold text-gray-400">{hr.requesting_agent_name} · {hr.requested_date}</p>
              </div>
            </Link>
          ))}
        </ScrollableSection>
      )}
    </div>
  )
}

// Who's hosting each of your own listings, and when - the same scheduled_opens data ListingCard
// already shows on the My Listings page, surfaced here too so it's visible without leaving Dash.
function ScheduledSection({ listings }: { listings: MyListingItem[] }) {
  const rows = listings.flatMap(listing => listing.scheduled_opens.map(open => ({ listing, open })))
  if (rows.length === 0) return null

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">
        <CalendarCheck className="h-3 w-3" /> Scheduled
      </p>
      <ScrollableSection maxHeightClass="max-h-[210px]" viewHref="/open-houses/my-listings" viewLabel="View all listings">
        {rows.slice(0, 9).map(({ listing, open }) => {
          const time = open.scheduled_start_time && open.scheduled_end_time
            ? `${formatTime(open.scheduled_start_time)}-${formatTime(open.scheduled_end_time)}`
            : null
          return (
            <Link
              key={open.id}
              href="/open-houses/my-listings"
              className="flex min-w-0 items-center gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-2.5 shadow-sm transition hover:-translate-y-0.5 dark:border-emerald-500/20 dark:bg-emerald-500/5"
            >
              <ListingThumb src={listing.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-[#111827] dark:text-white">{listing.address}</p>
                <p className="truncate text-[10px] font-semibold text-gray-400">
                  {open.hosting_agent_name} · {open.scheduled_date ? formatShortDate(open.scheduled_date) : 'Ongoing'}{time ? ` · ${time}` : ''}
                </p>
              </div>
            </Link>
          )
        })}
      </ScrollableSection>
    </div>
  )
}

export default function DashOpensPanel({ listings, hostRequests, discoveryListings }: {
  listings: MyListingItem[]
  hostRequests: HostRequest[]
  discoveryListings: DiscoveryListing[]
}) {
  if (listings.length === 0) {
    const topMatches = [...discoveryListings]
      .sort((a, b) => (a.DistanceFromLandmark ?? Infinity) - (b.DistanceFromLandmark ?? Infinity))
      .slice(0, 6)

    if (topMatches.length === 0) {
      return <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs font-bold text-gray-400 dark:border-gray-700">Set your search preferences in Discovery to see matches here</p>
    }

    return (
      <div className="grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2">
        {topMatches.map(listing => (
          <Link key={listing.ListingKey} href="/discovery" className="flex min-w-0 items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/40 dark:border-gray-800 dark:bg-[#151517]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
              {listing.Image ? <img src={listing.Image} alt="" className="h-full w-full object-cover" /> : <Search className="h-4 w-4 text-gray-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-[#111827] dark:text-white">{listing.Street || 'Property'}{listing.City ? `, ${listing.City}` : ''}</p>
              <p className="truncate text-[10px] font-semibold text-gray-400">
                {[listing.Price, listing.DistanceFromLandmark != null ? `${listing.DistanceFromLandmark.toFixed(1)} mi` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </Link>
        ))}
      </div>
    )
  }

  const scheduledCount = listings.reduce((sum, l) => sum + l.scheduled_opens_count, 0)
  const needsHost = listings.filter(l => l.open_house_status === 'needs_host')

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-xs font-black text-gray-500 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><CalendarCheck className="h-3.5 w-3.5" /> {scheduledCount} scheduled</span>
        <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><AlertCircle className="h-3.5 w-3.5" /> {needsHost.length} need a host</span>
      </div>

      <ScheduledSection listings={listings} />

      {needsHost.length === 0 ? (
        <p className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3 text-center text-xs font-bold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-400">
          All your opens are staffed
        </p>
      ) : (
        <ScrollableSection maxHeightClass="max-h-[210px]" viewHref="/open-houses/my-listings" viewLabel="View all listings">
          {needsHost.slice(0, 9).map(listing => (
            <Link key={listing.listing_key} href="/open-houses/my-listings" className="flex min-w-0 items-center gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/60 p-2.5 shadow-sm transition hover:-translate-y-0.5 dark:border-amber-500/20 dark:bg-amber-500/5">
              <ListingThumb src={listing.image} />
              <p className="min-w-0 flex-1 truncate text-xs font-black text-[#111827] dark:text-white">{listing.address}</p>
              <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-400">Find a Host →</span>
            </Link>
          ))}
        </ScrollableSection>
      )}

      <RequestsSection hostRequests={hostRequests} />
    </div>
  )
}
