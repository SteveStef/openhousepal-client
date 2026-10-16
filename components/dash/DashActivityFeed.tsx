'use client'

import { Notification } from '@/types'
import { getNotificationMeta } from '@/lib/notificationDisplay'
import { formatDateTime } from '@/lib/relativeDays'
import api from '@/lib/api-service'

// Mirrors the notification bell's own feed (same endpoint/window), not a leads query - this
// panel is meant to answer "what actually happened recently," same as the bell.
export default function DashActivityFeed({ notifications, onRead }: { notifications: Notification[]; onRead?: (id: string) => void }) {
  const handleClick = (notification: Notification) => {
    if (!notification.isRead) {
      // Read right away here (dot + "N new"), and the bell / Activity page catch up straight after.
      onRead?.(notification.id)
      api.notifications.markAsRead(notification.id).then(() => window.dispatchEvent(new Event('leads-notification-count:refresh')))
    }
    // Opens in a new tab, same as the bell dropdown and the Activity page - clicking one shouldn't
    // navigate the Dashboard itself away.
    window.open(notification.link || '/activity', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-w-0 space-y-1.5">
      {notifications.map(notification => {
        const { icon: Icon, className } = getNotificationMeta(notification.type, notification.message, notification.title)
        return (
          <button
            key={notification.id}
            onClick={() => handleClick(notification)}
            className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/40 dark:border-gray-800 dark:bg-[#151517] ${notification.isRead ? 'opacity-70' : ''}`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${className}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-[#111827] dark:text-white">{notification.title}</p>
              {(notification.propertyAddress || notification.message) && (
                <p className="truncate text-[10px] font-semibold text-gray-400">{notification.propertyAddress || notification.message}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="whitespace-nowrap text-[10px] font-bold text-gray-300 dark:text-gray-600">{formatDateTime(notification.timestamp)}</span>
              {!notification.isRead && <span className="h-2 w-2 rounded-full bg-blue-500" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
