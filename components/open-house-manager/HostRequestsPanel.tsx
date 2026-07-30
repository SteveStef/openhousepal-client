'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Inbox, AlertTriangle } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { HostRequest } from '@/types'
import HostRequestCard from './HostRequestCard'
import EmptyState from './EmptyState'

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

  const load = async () => {
    setIsLoading(true)
    setLoadError('')
    const { success, data, error } = await api.openHouseManager.getHostRequests('pending')
    if (success && data) setRequests(data)
    else setLoadError(error || 'Unable to load host requests right now.')
    setIsLoading(false)
  }

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen])

  const handleApprove = async (id: string) => {
    const { success, error } = await api.openHouseManager.approveRequest(id)
    if (success) {
      setRequests(prev => prev.filter(r => r.id !== id))
      showToast('Request approved - open house scheduled.', 'success')
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

  const handleCounter = async (id: string, counterDate: string, counterStart: string, counterEnd: string) => {
    const { success, error } = await api.openHouseManager.counterRequest(id, { counter_date: counterDate, counter_start_time: counterStart, counter_end_time: counterEnd })
    if (success) {
      setRequests(prev => prev.filter(r => r.id !== id))
      showToast('Proposed a new time.', 'success')
      onActionComplete()
    } else {
      showToast(error || 'Failed to propose a new time.', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in duration-200" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white dark:bg-[#0B0B0B] shadow-2xl animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#111827] dark:text-white">Host Requests</h2>
              {requests.length > 0 && (
                <span className="rounded-full bg-[#C9A24D]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">
                  {requests.length} Pending
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Agents requesting to host open houses at your listings</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
          ) : loadError ? (
            <EmptyState icon={AlertTriangle} title="Couldn't load requests" description={loadError} />
          ) : requests.length === 0 ? (
            <EmptyState icon={Inbox} title="No pending requests" description="When another agent asks to host one of your listings, it'll show up here." />
          ) : (
            <div className="space-y-3">
              {requests.map(request => (
                <HostRequestCard key={request.id} request={request} showAddress onApprove={handleApprove} onDecline={handleDecline} onCounter={handleCounter} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
