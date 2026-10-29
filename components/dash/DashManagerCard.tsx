'use client'

import { AlertCircle, CalendarCheck, Calendar as CalendarIcon, Users } from 'lucide-react'
import { HostRequest, MyListingsResponse } from '@/types'
import DashOpensPanel, { DiscoveryListing } from './DashOpensPanel'
import DashCardHeader from './DashCardHeader'
import { StatTile } from './openHouseBits'
import { weekendSummary } from '@/components/open-house-manager/WeekendCalendarCards'

// The listing-agent side of open houses, its own Dash card now (was a tab inside a shared
// "Open House Manager" card next to Discovery - split out so each gets the full column width).
export default function DashManagerCard({
  myListings, hostRequests, discoveryListings, actionCount, hasSearchPreferences, onChanged,
}: {
  myListings: MyListingsResponse | null
  hostRequests: HostRequest[]
  discoveryListings: DiscoveryListing[]
  actionCount: number
  hasSearchPreferences: boolean
  /** Reload the Dash after something changed in the hosts window. */
  onChanged?: () => void
}) {
  // Counted from the same boxes shown below (the next 4 open-house days of every listing), so the
  // numbers always match what you see: "1 covered · 3 need a host".
  const summary = myListings ? (myListings.listings || []).reduce((acc, l) => {
    const s = weekendSummary(l.scheduled_opens || [], l)
    return { scheduled: acc.scheduled + s.scheduled, needed: acc.needed + s.needed }
  }, { scheduled: 0, needed: 0 }) : null
  const avgGuests = myListings?.summary?.avg_guests_per_open || 0

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbf8f2] p-4 shadow-sm transition-shadow duration-300 hover:border-[#C9A24D]/40 hover:shadow-[0_18px_40px_-28px_rgba(201,162,77,.9)] dark:border-gray-800 dark:from-[#141416] dark:to-[#121110] sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.16),transparent_65%)]" />
      <DashCardHeader icon={CalendarIcon} title="Open House Manager" href="/open-houses/my-listings" badgeCount={actionCount}
        status={<span className="text-[11px] font-bold text-gray-400">Your listings - who&apos;s hosting when</span>} />

      {/* The three numbers that matter at a glance */}
      {summary && (myListings?.listings.length || 0) > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatTile icon={CalendarCheck} tone="green" value={summary.scheduled} label="Covered" />
          <StatTile icon={AlertCircle} tone="amber" value={summary.needed} label="Need host" />
          <StatTile icon={Users} tone="gold" value={avgGuests ? (Math.round(avgGuests * 10) / 10) : '-'} label="Avg guests" />
        </div>
      )}

      <div className="mt-4 min-w-0">
        <DashOpensPanel listings={myListings?.listings || []} hostRequests={hostRequests} discoveryListings={discoveryListings} hasSearchPreferences={hasSearchPreferences} onChanged={onChanged} />
      </div>
    </div>
  )
}
