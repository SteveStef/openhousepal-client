'use client'

import { Search } from 'lucide-react'
import type { HostRequest } from '@/types'
import DashCardHeader from './DashCardHeader'
import DashDiscoveryPanel, { DiscoveryListingStatus } from './DashDiscoveryPanel'
import { DiscoveryListing } from './DashOpensPanel'
import { todayLocal } from '@/lib/relativeDays'

// The "host someone else's open house" side, its own Dash card now (was a tab inside the shared
// "Open House Manager" card - split out so it sits beside Manager and uses the full column width).
export default function DashDiscoveryCard({
  listings, statuses, actionCount, hasSearchPreferences, myRequests = [], counteredAsHost = 0, incomingAsks = 0,
}: {
  listings: DiscoveryListing[]
  statuses: Record<string, DiscoveryListingStatus>
  actionCount: number
  hasSearchPreferences: boolean
  myRequests?: HostRequest[]
  counteredAsHost?: number
  incomingAsks?: number
}) {
  // Say what's actually waiting: only a counter-offer or someone asking you to host needs a reply
  // (red). "Approved / declined" news is just an update - it shows in Your hosting below.
  const toAnswer = counteredAsHost + incomingAsks
  const today = todayLocal()
  const hosting = myRequests.filter(r => r.status === 'approved' && String(r.requested_date) >= today).length
  const status = toAnswer > 0 ? `${toAnswer} to respond to`
    : hosting > 0 ? `Hosting ${hosting} upcoming`
    : listings.length ? `${listings.length} to host nearby`
    : hasSearchPreferences ? 'No matches right now' : 'Set up your search'
  const tone = toAnswer > 0 ? 'red' : hosting > 0 ? 'green' : listings.length ? 'gold' : 'muted'

  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbf8f2] p-4 shadow-sm transition-shadow duration-300 hover:border-[#C9A24D]/40 hover:shadow-[0_18px_40px_-28px_rgba(201,162,77,.9)] dark:border-gray-800 dark:from-[#141416] dark:to-[#121110] sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.16),transparent_65%)]" />
      <DashCardHeader
        icon={Search} title="Open House Discovery" href="/discovery" badgeCount={actionCount}
        status={status}
        statusTone={tone}
      />

      <div className="mt-4 min-w-0">
        <DashDiscoveryPanel listings={listings} statuses={statuses} hasSearchPreferences={hasSearchPreferences} myRequests={myRequests} incomingAsks={incomingAsks} />
      </div>
    </div>
  )
}
