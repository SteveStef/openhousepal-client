'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Inbox, AlertTriangle, Bell } from 'lucide-react'
import OhSheet from './OhSheet'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { HostRequest, Notification } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'
import { refreshOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'

function formatTimestamp(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export default function HostRequestsPanel({
  isOpen,
  onClose,
  onActionComplete,
}: {
  isOpen: boolean
  onClose: () => void
  onActionComplete: () => void
}) {
  const { showToast } = useToast()
  const [requests, setRequests] = useState<HostRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [recentUpdates, setRecentUpdates] = useState<Notification[]>([])

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const { success, data, error } = await api.openHouseManager.getHostRequests('pending')
    if (success && data) setRequests(data)
    else setLoadError(error || 'Unable to load host requests right now.')
    setIsLoading(false)
  }

  const loadRecentUpdates = async () => {
    // Fetch before marking read, so the items that are about to clear the badge are still
    // visible here - this panel is where that badge count told the agent to come look.
    const { success, data } = await api.notifications.getAll(true)
    if (success && data) {
      setRecentUpdates(data.filter(n => n.type === 'HOST_REQUEST_COUNTER_RESPONSE'))
    }
    await api.notifications.markTypesAsRead(['HOST_REQUEST_RECEIVED', 'HOST_REQUEST_COUNTER_RESPONSE'])
    refreshOpenHouseActionCounts()
  }

  useEffect(() => {
    if (isOpen) {
      load()
      loadRecentUpdates()
    }
  }, [isOpen])

  const handleApprove = async (id: string) => {
    const { success, error } = await api.openHouseManager.approveRequest(id)
    if (success) {
      setRequests(prev => prev.filter(r => r.id !== id))
      showToast("Request approved - the host was notified and it's on their calendar. They'll use their kit for this home (or build one if it's their first time hosting it).", 'success')
      // Approving one time closes that host's other offers for the same day - reload so none of
      // them are left here to act on.
      load()
      onActionComplete()
    } else {
      showToast(error || 'Failed to approve this request.', 'error')
    }
  }

  const handleDecline = async (id: string) => {
    const { success, error } = await api.openHouseManager.declineRequest(id)
    if (success) {
      setRequests(prev => prev.filter(r => r.id !== id))
      showToast('Request declined.', 'success')
      onActionComplete()
    } else {
      showToast(error || 'Failed to decline this request.', 'error')
    }
  }

  const handleCounter = async (id: string, counterDate: string, counterStart: string, counterEnd: string, counterMessage: string) => {
    const { success, error } = await api.openHouseManager.counterRequest(id, {
      counter_date: counterDate, counter_start_time: counterStart, counter_end_time: counterEnd, counter_message: counterMessage || undefined,
    })
    if (success) {
      setRequests(prev => prev.filter(r => r.id !== id))
      showToast('Proposed a new time.', 'success')
      onActionComplete()
    } else {
      showToast(error || 'Failed to propose a new time.', 'error')
    }
  }

  // A sheet that slides up on a phone (you stay on the Manager), a panel from the right on a computer.
  return (
    <OhSheet open={isOpen} onClose={onClose} variant="side" title="Host Requests" icon={<Inbox className="h-5 w-5" />}
      subtitle="Agents asking to host your listings"
      badge={requests.length > 0 ? <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{requests.length}</span> : undefined}>
        <div>
          {recentUpdates.length > 0 && (
            <div className="mb-5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Recent Updates</p>
              {recentUpdates.map(update => (
                <div key={update.id} className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-500/10 dark:bg-blue-500/5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                    <Bell size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[#111827] dark:text-white">{update.title}</p>
                    <p className="mt-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">{update.message}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{formatTimestamp(update.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load requests" description={loadError} />
          ) : requests.length === 0 ? (
            recentUpdates.length === 0 && (
              <EmptyState icon={Inbox} title="No pending requests" description="When another agent asks to host one of your listings, it'll show up here." />
            )
          ) : (
            <div className="space-y-3">
              {requests.map((request, i) => (
                <motion.div key={request.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.05, type: 'spring', stiffness: 380, damping: 30 }}>
                  <HostRequestCard request={request} showAddress showHistory onApprove={handleApprove} onDecline={handleDecline} onCounter={handleCounter} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
    </OhSheet>
  )
}
