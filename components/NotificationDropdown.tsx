'use client'

import { Notification } from '@/types'
import { Calendar, Eye, Heart, X, Home } from 'lucide-react'

// Helper function to format timestamps
const formatTimestamp = (timestamp: string): string => {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return then.toLocaleDateString()
}

interface NotificationDropdownProps {
  notifications: Notification[]
  onClose: () => void
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onNotificationClick: (notification: Notification) => void
}

export default function NotificationDropdown({
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick
}: NotificationDropdownProps) {
  // Filter to only show unread notifications
  const unreadNotifications = notifications.filter(n => !n.isRead)
  const unreadCount = unreadNotifications.length

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'OPEN_HOUSE_SIGN_IN':
        return <Home className="w-4 h-4" />
      case 'TOUR_REQUEST':
        return <Calendar className="w-4 h-4" />
      case 'PROPERTY_INTERACTION':
        return <Heart className="w-4 h-4" />
      default:
        return <Eye className="w-4 h-4" />
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'OPEN_HOUSE_SIGN_IN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            {getTypeIcon(type)}
            <span className="ml-1">New Visitor</span>
          </span>
        )
      case 'TOUR_REQUEST':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            {getTypeIcon(type)}
            <span className="ml-1">Tour Request</span>
          </span>
        )
      case 'PROPERTY_INTERACTION':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            {getTypeIcon(type)}
            <span className="ml-1">Property Activity</span>
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-600 mt-0.5">
              {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-[#8b7355] hover:text-[#7a6549] font-medium transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {unreadNotifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600">No new notifications</p>
            <p className="text-xs text-gray-400 mt-1">
              You're all caught up!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {unreadNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => {
                  onNotificationClick(notification)
                  if (!notification.isRead) {
                    onMarkAsRead(notification.id)
                  }
                }}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  !notification.isRead ? 'bg-blue-50/30' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Visitor Name */}
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {notification.visitorName}
                    </p>

                    {/* Type Badge */}
                    <div className="mt-1">
                      {getTypeBadge(notification.type)}
                    </div>

                    {/* Property Address */}
                    <p className="text-xs text-gray-600 mt-1.5 truncate">
                      {notification.propertyAddress}
                    </p>

                    {/* Message */}
                    <p className="text-xs text-gray-500 mt-1">
                      {notification.message}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-gray-400 mt-1.5">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
