'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

// Count of showcases with a visitor's refine-search message still sitting unaddressed - drives
// the badge on the Showcases nav item, since otherwise there's no way to tell a visitor requested
// a change without opening every showcase individually (the banner only shows once you're already
// inside one). Keyed off Collection.refine_request_message (via /collections/refine-requests/
// count), the same signal the DetailView banner itself checks - NOT notification read-state,
// which is a separate, decoupled concept (reading the bell alert doesn't dismiss the banner, and
// dismissing the banner doesn't mark the notification read).
// Same poll cadence as useFormsActionCount/useOpenHouseActionCount.
const POLL_INTERVAL_MS = 8000

export function useShowcasesActionCount() {
  const { isAuthenticated, isLoading: isAuthenticating } = useAuth()
  const [count, setCount] = useState(0)
  const lastFetchedRef = useRef(0)

  const fetchCount = async (force = false) => {
    if (!isAuthenticated || isAuthenticating) return
    const now = Date.now()
    if (!force && now - lastFetchedRef.current < POLL_INTERVAL_MS) return
    const { success, data } = await api.collections.getPendingRefineRequestsCount()
    setCount(success && data ? data.count : 0)
    lastFetchedRef.current = now
  }

  useEffect(() => {
    if (isAuthenticating || !isAuthenticated) return

    fetchCount(true)

    const handleFocus = () => fetchCount()
    window.addEventListener('focus', handleFocus)
    const interval = setInterval(() => fetchCount(), POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [isAuthenticating, isAuthenticated])

  return count
}
