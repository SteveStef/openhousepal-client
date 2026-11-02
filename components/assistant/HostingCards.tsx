'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api-service'
import type { HostRequest } from '@/types'
import DashDiscoveryPanel, { type DiscoveryListingStatus } from '@/components/dash/DashDiscoveryPanel'
import type { DiscoveryListing } from '@/components/dash/DashOpensPanel'

// "Help me find an open house to host" in the chat (owner, 11/01: "just like as if I was on the
// discovery tab"): the homes the helper found - their Discovery filter, newest first - as the Dash's
// own Discovery rows: the weekend calendar, Request to host (the step-by-step day and time window),
// the home's quick view, See more homes and Browse all of Discovery. Loaded fresh, so what's
// requested or taken is current every time the chat opens.
export default function HostingCards({ listingKeys }: { listingKeys: string[] }) {
  const [listings, setListings] = useState<DiscoveryListing[] | null>(null)
  const [statuses, setStatuses] = useState<Record<string, DiscoveryListingStatus>>({})
  const [myRequests, setMyRequests] = useState<HostRequest[]>([])

  useEffect(() => {
    let live = true
    api.discovery.get().then(r => {
      if (!live) return
      const all: DiscoveryListing[] = (r.success && (r.data as any)?.data) || []
      setListings(all.filter(l => listingKeys.includes(l.ListingKey)))
    }).catch(() => live && setListings([]))
    if (listingKeys.length) {
      api.openHouseManager.getListingStatuses(listingKeys).then(({ success, data }) => {
        if (live && success && data) setStatuses(data as Record<string, DiscoveryListingStatus>)
      }).catch(() => {})
    }
    api.openHouseManager.getMyRequests().then(r => { if (live && r.success && r.data) setMyRequests(r.data) }).catch(() => {})
    return () => { live = false }
  }, [listingKeys.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!listings) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-3 py-3 text-xs font-bold text-gray-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading homes to host...
      </div>
    )
  }
  return (
    <div className="ohp-ai-card-in mt-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" data-testid="ai-hosting-cards">
      <DashDiscoveryPanel listings={listings} statuses={statuses} hasSearchPreferences myRequests={myRequests} orderKeys={listingKeys} inChat />
    </div>
  )
}
