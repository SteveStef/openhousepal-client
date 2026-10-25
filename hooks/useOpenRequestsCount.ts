'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { hasValidSubscription } from '@/lib/auth-helpers'

// Open house requests waiting on the agent (user, 10/25): a guest asked for the seller disclosure
// or a second tour - on their Guest Pass, the Cheat Sheet QR or an invite - and it isn't marked
// Sent / Scheduled yet. Drives the red badge on the Opens tab (desktop + phone menu). Clears the
// moment the request is marked handled (OpenHouseFormRequestsPanel fires the refresh event).
const POLL_INTERVAL_MS = 8000
const REFRESH_EVENT = 'open-requests-count:refresh'

export function refreshOpenRequestsCount() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REFRESH_EVENT))
}

export function useOpenRequestsCount() {
  const { isAuthenticated, isLoading: isAuthenticating, user } = useAuth()
  const canUse = hasValidSubscription(user)
  const [count, setCount] = useState(0)
  const lastFetchedRef = useRef(0)

  useEffect(() => {
    if (isAuthenticating || !isAuthenticated || !canUse) return
    let alive = true
    const fetchCount = async (force = false) => {
      const now = Date.now()
      if (!force && now - lastFetchedRef.current < POLL_INTERVAL_MS) return
      lastFetchedRef.current = now
      const r = await api.openHouses.getFormRequests()
      if (alive && r.success && r.data) setCount(r.data.filter(x => !x.completedAt).length)
    }
    fetchCount(true)
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') fetchCount() }, POLL_INTERVAL_MS)
    const onFocus = () => fetchCount()
    const onRefresh = () => fetchCount(true)
    window.addEventListener('focus', onFocus)
    window.addEventListener(REFRESH_EVENT, onRefresh)
    return () => {
      alive = false
      window.clearInterval(t)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(REFRESH_EVENT, onRefresh)
    }
  }, [isAuthenticated, isAuthenticating, canUse])

  return count
}
