'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'
import { Notification } from '@/types'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { AUTO_HIDE_WHEN_READ_TYPES, visibleNotifications } from '@/lib/notificationDisplay'

// Matches the poll interval used across the app's other "live" badges (leads/open-house action
// counts) so the notification center itself updates on the same near-real-time cadence, not just
// on window focus.
const POLL_INTERVAL_MS = 8000
const LEADS_REFRESH_EVENT = 'leads-notification-count:refresh'
const OPEN_HOUSE_REFRESH_EVENT = 'openhouse-action-counts:refresh'

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const lastFetchedRef = useRef<number>(0)
  const { isAuthenticated, isLoading: isAuthenticating } = useAuth()

  // Fetch notifications from API with throttling
  const fetchNotifications = async (force = false) => {
    if (!isAuthenticated || isAuthenticating) return

    const now = Date.now()
    // Throttling: only fetch this often unless forced
    if (!force && now - lastFetchedRef.current < POLL_INTERVAL_MS) {
      return
    }

    try {
      setIsLoading(true)
      // Only the last 30 days here - older notifications drop off the bell but stay visible on
      // the full /activity page, so this list doesn't grow forever.
      const { success, data } = await api.notifications.getAll(false, 30)

      if (success && data) {
        setNotifications(data)
        lastFetchedRef.current = now
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Unified effect for auth changes and window focus
  useEffect(() => {
    if (isAuthenticating || !isAuthenticated) return

    // Initial fetch on mount or auth change
    fetchNotifications(true)

    // Fetch on window focus, on a short poll, and the instant another part of the app marks
    // something read/resolved (same cross-page refresh events the badge-count hooks use).
    const handleFocus = () => fetchNotifications()
    const handleRefresh = () => fetchNotifications(true)
    window.addEventListener('focus', handleFocus)
    window.addEventListener(LEADS_REFRESH_EVENT, handleRefresh)
    window.addEventListener(OPEN_HOUSE_REFRESH_EVENT, handleRefresh)
    const interval = setInterval(() => fetchNotifications(), POLL_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener(LEADS_REFRESH_EVENT, handleRefresh)
      window.removeEventListener(OPEN_HOUSE_REFRESH_EVENT, handleRefresh)
      clearInterval(interval)
    }
  }, [isAuthenticating, isAuthenticated])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    // Close on Escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // AI Video ready/failed alerts are removed from view the moment they've been seen anywhere
  // (bell opened, Activity page viewed, or the finished video looked at in AI Media itself - see
  // the other two triggers in app/activity/page.tsx and app/studio/media/page.tsx) rather than
  // just grayed out like every other notification type - see lib/notificationDisplay.tsx.
  const visible = visibleNotifications(notifications)
  const unreadCount = visible.filter(n => !n.isRead).length

  // Opening the dropdown is itself a "seen it" moment for these types - mark them read in the
  // background so the next time the bell opens (or the Activity page loads) they're gone,
  // without waiting for an explicit click the way every other notification type still requires.
  useEffect(() => {
    if (!isOpen) return
    const hasUnseenAutoHide = notifications.some(n => AUTO_HIDE_WHEN_READ_TYPES.has(n.type) && !n.isRead)
    if (!hasUnseenAutoHide) return
    api.notifications.markTypesAsRead(Array.from(AUTO_HIDE_WHEN_READ_TYPES)).then(() => {
      setNotifications(prev => prev.map(n => AUTO_HIDE_WHEN_READ_TYPES.has(n.type) ? { ...n, isRead: true } : n))
    })
  }, [isOpen, notifications])

  const handleMarkAsRead = async (id: string) => {
    try {
      // Dismiss (mark read) without removing it - this is a history mailbox, not an inbox that
      // empties on click.
      setNotifications(prevNotifications =>
        prevNotifications.map(notification => notification.id === id ? { ...notification, isRead: true } : notification)
      )

      // Call API to mark as read
      const { success, error } = await api.notifications.markAsRead(id)

      if (!success) {
        console.error('Failed to mark notification as read:', error)
        // Refetch to restore correct state
        fetchNotifications()
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
      // Refetch to restore correct state
      fetchNotifications()
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      // Optimistically dismiss all, but keep them visible as read history
      setNotifications(prevNotifications => prevNotifications.map(notification => ({ ...notification, isRead: true })))

      // Call API to mark all as read
      const { success, error } = await api.notifications.markAllAsRead()

      if (!success) {
        console.error('Failed to mark all notifications as read:', error)
        // Refetch to restore correct state
        fetchNotifications()
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      // Refetch to restore correct state
      fetchNotifications()
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    // Opens in a new tab - clicking a notification shouldn't navigate away from whatever the
    // agent is currently doing.
    if (notification.link) {
      window.open(notification.link, '_blank', 'noopener,noreferrer')
    }

    // Close the dropdown
    setIsOpen(false)
  }

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative z-[9999]">
      {/* Bell Button */}
      <button
        ref={bellRef}
        onClick={toggleDropdown}
        className="relative flex items-center px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
        title="Notifications"
        aria-label="Notifications"
      >
        {/* The bell glyph itself is left exactly as-is (explicit ask: no builder draw-in here) -
            only the unread dot below it animates. */}
        <Bell className="w-5 h-5 sm:w-4 sm:h-4 text-[#C9A24D]" />

        {/* Unread badge - sits at the BOTTOM of the bell (not the usual top-right) and "generates"
            in with a quick scale+fade pop each time it appears or its count changes, instead of
            just statically being there or not - the `key={unreadCount}` remounts (and replays the
            pop) on every count change, not only the very first time it goes from 0. */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ opacity: 0, scale: 0.3, y: -3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              className="absolute -bottom-1 right-1.5 sm:right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none tabular-nums text-white shadow-sm shadow-red-500/40 ring-2 ring-white dark:ring-[#0B0B0B]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div ref={dropdownRef}>
          <NotificationDropdown
            notifications={visible}
            onClose={() => setIsOpen(false)}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onNotificationClick={handleNotificationClick}
          />
        </div>
      )}
    </div>
  )
}
