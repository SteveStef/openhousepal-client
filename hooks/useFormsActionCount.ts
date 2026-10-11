'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { hasValidSubscription } from '@/lib/auth-helpers'

// Count of "Request Seller Disclosure" / "Schedule a Second Visit" Cheat Sheet scans the agent
// hasn't marked Scheduled/Sent yet, plus unread submissions on any lead-capture form - drives the
// badge on the Studio nav's Forms item and the Forms card on the Studio hub, so it's visible
// without having to open Forms Results first.
// Matches the poll interval used by useLeadsNotificationCount.ts / useOpenHouseActionCount.ts /
// NotificationBell so every "live" badge in the app updates on the same near-real-time cadence.
const POLL_INTERVAL_MS = 8000
// Fired right after a response is marked reviewed (or back) so every mounted badge re-counts at
// once instead of on the next poll.
const REFRESH_EVENT = 'forms-action-count:refresh'

export function refreshFormsActionCount() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REFRESH_EVENT))
}

export function useFormsActionCount() {
  const { isAuthenticated, isLoading: isAuthenticating, user } = useAuth()
  // Unpaid / lapsed accounts can't open Forms - don't poll endpoints that would only say no.
  const canUse = hasValidSubscription(user)
  const [count, setCount] = useState(0)
  const lastFetchedRef = useRef(0)

  const fetchCount = async (force = false) => {
    if (!isAuthenticated || isAuthenticating || !canUse) return
    const now = Date.now()
    if (!force && now - lastFetchedRef.current < POLL_INTERVAL_MS) return
    const [requestsResult, unreadResult] = await Promise.all([
      api.openHouses.getFormRequests(),
      api.forms.getUnreadSubmissionsCount(),
    ])
    const requestsCount = requestsResult.success && requestsResult.data
      ? requestsResult.data.filter(r => !r.completedAt).length
      : 0
    const unreadCount = unreadResult.success && unreadResult.data ? unreadResult.data.count : 0
    setCount(requestsCount + unreadCount)
    lastFetchedRef.current = now
  }

  useEffect(() => {
    if (isAuthenticating || !isAuthenticated || !canUse) return

    fetchCount(true)

    const handleFocus = () => fetchCount()
    const handleRefresh = () => fetchCount(true)
    window.addEventListener('focus', handleFocus)
    window.addEventListener(REFRESH_EVENT, handleRefresh)
    const interval = setInterval(() => fetchCount(), POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(REFRESH_EVENT, handleRefresh)
      clearInterval(interval)
    }
  }, [isAuthenticating, isAuthenticated, canUse])

  return count
}
