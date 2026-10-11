'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'

// Drives the small red dot on the Help nav icon (Header) - clears once the agent opens the
// ticket whose reply is unread. Same on-focus + short-poll refresh pattern as NotificationBell,
// just scoped to support-ticket unread state instead of the full notification list.
const POLL_INTERVAL_MS = 15000

export function useSupportUnreadCount(): number {
  const { isAuthenticated, isLoading: isAuthenticating } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (isAuthenticating || !isAuthenticated) return

    const fetchCount = async () => {
      const { success, data } = await api.support.getUnreadCount()
      if (success && data) setCount(data.unread_count)
    }

    fetchCount()
    const handleFocus = () => fetchCount()
    window.addEventListener('focus', handleFocus)
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [isAuthenticating, isAuthenticated])

  return count
}
