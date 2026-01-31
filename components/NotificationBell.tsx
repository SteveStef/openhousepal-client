'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'
import { Notification } from '@/types'
import { notificationApi } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

export default function NotificationBell() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const { isAuthenticated, isLoading: isAuthenticating } = useAuth()

  // Fetch notifications from API
  const fetchNotifications = async () => {
    if (!isAuthenticated || isAuthenticating) return

    try {
      setIsLoading(true)
      const response = await notificationApi.getAll(true) // Only fetch unread

      if (response && response.success && response.data) {
        setNotifications(response.data)
      } else {
        console.error('Failed to fetch notifications')
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Load notifications on mount and when auth status changes
  useEffect(() => {
    if (!isAuthenticating) {
      fetchNotifications()
    }
  }, [isAuthenticating, isAuthenticated])

  // Fetch notifications when window gains focus
  useEffect(() => {
    if (!isAuthenticated) return

    const handleFocus = () => {
      fetchNotifications()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isAuthenticated])

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

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleMarkAsRead = async (id: string) => {
    try {
      // Optimistically update UI
      setNotifications(prevNotifications =>
        prevNotifications.filter(notification => notification.id !== id)
      )

      // Call API to mark as read
      const response = await notificationApi.markAsRead(id)

      if (!response.success) {
        console.error('Failed to mark notification as read:', response.error)
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
      // Optimistically clear all notifications
      setNotifications([])

      // Call API to mark all as read
      const response = await notificationApi.markAllAsRead()

      if (!response.success) {
        console.error('Failed to mark all notifications as read:', response.error)
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
    // Navigate to the link if available
    if (notification.link) {
      router.push(notification.link)
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
        className="relative flex items-center space-x-1 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 sm:w-4 sm:h-4 text-[#C9A24D]" />
        <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-300">
          Notifications
        </span>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 sm:top-0 sm:right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full border-2 border-white dark:border-[#0B0B0B]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div ref={dropdownRef}>
          <NotificationDropdown
            notifications={notifications}
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
