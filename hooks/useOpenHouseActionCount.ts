'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { hasValidSubscription } from '@/lib/auth-helpers'
import { hasMlsAccess } from '@/lib/navAccess'

// Live "action needed" counts for open house host requests, each blending two sources:
//   - a live count derived straight from request status (auto-clears the instant a request is
//     resolved - no mark-as-read bookkeeping needed for that part), plus
//   - an "unseen update" notification count for events that don't leave anything outstanding to
//     derive from (e.g. the host already accepted your proposed time) - those clear once the
//     relevant panel (Manage Hosts / Host Requests / My Requests) is opened.
//   - listingAgentCount: requests on my listings awaiting my approve/decline/counter, plus unseen
//     "host responded to your proposed time" updates. Drives the badge on the Open Houses nav
//     tab, the Dash "Manage Your Listings" panel, and the "Host Requests" button on My Listings.
//   - hostCount: requests I sent that got countered and are awaiting my accept/decline, plus
//     unseen "listing agent approved/declined your request" updates. Drives the badge on the
//     Dash "Find an Open House" panel and the "My Requests" mailbox on Discovery.
// Event name panels dispatch (via refreshOpenHouseActionCounts) right after marking the
// notifications behind these counts as read, so every mounted badge (Header, Dash, Discovery, My
// Listings) clears the instant the agent "checks out" the relevant panel, instead of waiting for
// the next 30s poll or window focus.
const REFRESH_EVENT = 'openhouse-action-counts:refresh'
// Matches the poll interval used by useLeadsNotificationCount.ts / NotificationBell so every
// "live" badge in the app updates on the same near-real-time cadence.
const POLL_INTERVAL_MS = 8000

export function refreshOpenHouseActionCounts() {
  window.dispatchEvent(new Event(REFRESH_EVENT))
}

export function useOpenHouseActionCounts() {
  const { isAuthenticated, isLoading: isAuthenticating, user } = useAuth()
  // Manager counts come from Bright listings - the No-MLS plans can't load them (server says 403).
  const canUse = !!user?.broker_authorized && hasValidSubscription(user) && hasMlsAccess(user?.plan_tier)
  const [listingAgentCount, setListingAgentCount] = useState(0)
  const [hostCount, setHostCount] = useState(0)
  // Raw "unseen update" halves, exposed separately so a consumer that already has its own
  // still-pending count from elsewhere (e.g. My Listings' own pending_request_count sum) can add
  // just this part in, instead of double-counting the pending portion.
  const [listingAgentUnseenUpdates, setListingAgentUnseenUpdates] = useState(0)
  const [hostUnseenUpdates, setHostUnseenUpdates] = useState(0)
  // The host side split out for Dash's Discovery card, so it can say what's actually waiting:
  // a counter-offer to answer vs. listing agents asking you to host vs. just news to look at.
  const [counteredAsHost, setCounteredAsHost] = useState(0)
  const [incomingAsks, setIncomingAsks] = useState(0)
  const lastFetchedRef = useRef(0)

  const fetchCounts = async (force = false) => {
    if (!isAuthenticated || isAuthenticating || !canUse) return
    const now = Date.now()
    if (!force && now - lastFetchedRef.current < POLL_INTERVAL_MS) return
    const { success, data } = await api.openHouseManager.getActionCounts()
    if (success && data) {
      setListingAgentCount(data.pending_as_listing_agent + data.listing_agent_unseen_updates)
      setHostCount(data.countered_as_host + data.host_unseen_updates + data.pending_incoming_broadcasts)
      setListingAgentUnseenUpdates(data.listing_agent_unseen_updates)
      setHostUnseenUpdates(data.host_unseen_updates)
      setCounteredAsHost(data.countered_as_host)
      setIncomingAsks(data.pending_incoming_broadcasts)
      lastFetchedRef.current = now
    }
  }

  useEffect(() => {
    if (isAuthenticating || !isAuthenticated || !canUse) return

    fetchCounts(true)

    const handleFocus = () => fetchCounts()
    const handleRefresh = () => fetchCounts(true)
    window.addEventListener('focus', handleFocus)
    window.addEventListener(REFRESH_EVENT, handleRefresh)
    const interval = setInterval(() => fetchCounts(), POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(REFRESH_EVENT, handleRefresh)
      clearInterval(interval)
    }
  }, [isAuthenticating, isAuthenticated, canUse])

  return { listingAgentCount, hostCount, listingAgentUnseenUpdates, hostUnseenUpdates, counteredAsHost, incomingAsks }
}
