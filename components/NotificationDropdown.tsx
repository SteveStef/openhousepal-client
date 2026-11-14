'use client'

import LeadStar from '@/components/leads/LeadStar'
import Link from 'next/link'
import { Notification } from '@/types'
import { Calendar, Layers, X } from 'lucide-react'
import { stackNotifications, type BellItem } from '@/lib/bellStack'
import { getNotificationMeta } from '@/lib/notificationDisplay'

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
  /** A combined row - opens the Activity page (every one of them, one by one). */
  onStackClick?: (items: Notification[]) => void
}

export default function NotificationDropdown({
  notifications,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
  onStackClick,
}: NotificationDropdownProps) {
  // History mailbox - every notification stays visible after being clicked/dismissed, newest
  // first (already sorted server-side); unread ones are just highlighted until read.
  // Same-day small things of one kind combine into one row (lib/bellStack.ts, owner 11/13) - the
  // Activity page still lists every one. Unread counts rows, not each email open.
  const items: BellItem[] = stackNotifications(notifications)
  const unreadCount = items.filter(i => (i.kind === 'one' ? !i.n.isRead : !i.isRead)).length
  // The dropdown itself only ever shows the 10 most recent rows - the full history (up to 30 days,
  // and everything older than that) lives on the /activity page via the link at the bottom.
  const visibleItems = items.slice(0, 10)
  const hasMore = items.length > visibleItems.length

  const getTypeBadge = (type: string, message?: string, title?: string) => {
    const { icon: Icon, label, className } = getNotificationMeta(type, message, title)
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
        <Icon className="w-4 h-4" />
        <span className="ml-1">{label}</span>
      </span>
    )
  }

        return (
          <div className="fixed inset-x-0 top-[64px] mx-auto w-[95%] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white dark:bg-[#151517] rounded-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 z-[9999] overflow-hidden transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0B0B0B]">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {unreadCount} unread
            </p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-[#C9A24D] hover:text-[#b38e3e] font-medium transition-colors"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Notifications List - a history mailbox: everything stays here after being dismissed, so
          this never truly empties out once there's been any activity. */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#151517]">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">No notifications yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Activity will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleItems.map((item) => item.kind === 'stack' ? (
              <div
                key={item.key}
                data-testid="bell-stack"
                onClick={() => onStackClick?.(item.items)}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-[#2c241b] cursor-pointer transition-colors ${
                  !item.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-white dark:bg-[#151517] opacity-70'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {!item.isRead && (
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{item.title}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {getTypeBadge(item.type, item.items[0].message, item.items[0].title)}
                      <span className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300">
                        <Layers className="h-3 w-3" /> {item.items.length}
                      </span>
                    </div>
                    {item.message && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 truncate">{item.message}</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5">
                      {formatTimestamp(item.timestamp)} · <span className="font-semibold text-[#C9A24D]">See each in Activity</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : ((notification: Notification) => (
              <div
                key={notification.id}
                onClick={() => {
                  onNotificationClick(notification)
                  if (!notification.isRead) {
                    onMarkAsRead(notification.id)
                  }
                }}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-[#2c241b] cursor-pointer transition-colors ${
                  !notification.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : 'bg-white dark:bg-[#151517] opacity-70'
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
                    {/* Headline - backend sets a type-appropriate title for every notification,
                        e.g. "New Open House Visitor: Jane Doe" or "New time confirmed" */}
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      <LeadStar link={notification.link} showcaseId={notification.collectionId} name={notification.visitorName} text={`${notification.title} ${notification.message}`} className="mr-1 -mt-0.5" />{notification.title}
                    </p>

                    {/* Type Badge */}
                    <div className="mt-1">
                      {getTypeBadge(notification.type, notification.message, notification.title)}
                    </div>

                    {/* Property Address - not every notification has one (e.g. forms with no
                        address question, like Buying/Showing/How Can We Help) */}
                    {notification.propertyAddress && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 truncate">
                        {notification.propertyAddress}
                      </p>
                    )}

                    {/* Message */}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {notification.message}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))(item.n))}
          </div>
        )}
      </div>

      {/* The dropdown itself is capped to the 10 most recent - this is the way to reach anything
          beyond that (up to 30 days here; everything older lives on the Activity page too). */}
      <Link
        href="/activity"
        onClick={onClose}
        className="block border-t border-gray-200 p-3 text-center text-xs font-bold text-[#C9A24D] transition-colors hover:bg-gray-50 hover:text-[#b38e3e] dark:border-gray-800 dark:hover:bg-[#2c241b]"
      >
        {hasMore ? `View All Activity (${notifications.length})` : 'View All Activity'}
      </Link>
    </div>
  )
}
