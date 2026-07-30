'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Send, AlertTriangle } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { HostRequest } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'

export default function MyRequestsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showToast } = useToast()
  const [requests, setRequests] = useState<HostRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const { success, data, error } = await api.openHouseManager.getMyRequests()
    if (success && data) setRequests(data)
    else setLoadError(error || 'Unable to load your requests right now.')
    setIsLoading(false)
  }

  useEffect(() => {
    if (!isOpen) return
    load()
  }, [isOpen])

  const handleAcceptCounter = async (id: string) => {
    const { success, error } = await api.openHouseManager.acceptCounter(id)
    if (success) {
      showToast('New time confirmed.', 'success')
      load()
    } else {
      showToast(error || 'Failed to confirm this time.', 'error')
    }
  }

  const handleDeclineCounter = async (id: string) => {
    const { success, error } = await api.openHouseManager.declineCounter(id)
    if (success) {
      showToast('Proposed time declined.', 'success')
      load()
    } else {
      showToast(error || 'Failed to decline this time.', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white dark:bg-[#0B0B0B] shadow-2xl animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 p-5">
          <div>
            <h2 className="text-lg font-black text-[#111827] dark:text-white">My Requests</h2>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Open houses you've asked to host</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load your requests" description={loadError} />
          ) : requests.length === 0 ? (
            <EmptyState icon={Send} title="No requests yet" description="Requests you send to host other agents' listings will show up here." />
          ) : (
            <div className="space-y-3">
              {requests.map(request => (
                <HostRequestCard key={request.id} request={request} showAddress onAcceptCounter={handleAcceptCounter} onDeclineCounter={handleDeclineCounter} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
