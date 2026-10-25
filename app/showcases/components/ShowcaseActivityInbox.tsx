'use client'

import { X, Heart, ThumbsDown, MessageSquare, Calendar, SlidersHorizontal, Eye, Inbox } from 'lucide-react'
import type { ShowcaseActivityItem } from '@/types'
import { useEscapeToClose } from '@/components/ui/windowMotion'
import MotionModal from '@/components/ui/MotionModal'

interface ShowcaseActivityInboxProps {
  isOpen: boolean
  onClose: () => void
  items: ShowcaseActivityItem[]
  onOpenItem: (item: ShowcaseActivityItem) => void
}

// One look per kind of thing a client did in their Showcase.
const kindOf = (item: ShowcaseActivityItem) => {
  if (item.type === 'PROPERTY_COMMENT') return { icon: MessageSquare, tone: 'bg-blue-500', label: 'Comment' }
  if (item.type === 'TOUR_REQUEST') return { icon: Calendar, tone: 'bg-red-500', label: 'Tour request' }
  if (item.type === 'REFINE_SEARCH_REQUEST') return { icon: MessageSquare, tone: 'bg-[#C9A24D]', label: 'Message' }
  if (item.type === 'SHOWCASE_SEARCH_CHANGED') return { icon: SlidersHorizontal, tone: 'bg-sky-500', label: 'Search changed' }
  if (item.message?.startsWith('Disliked')) return { icon: ThumbsDown, tone: 'bg-gray-500', label: 'Passed' }
  if (item.message?.startsWith('Liked')) return { icon: Heart, tone: 'bg-green-500', label: 'Liked' }
  return { icon: Eye, tone: 'bg-gray-400', label: 'Activity' }
}

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

const street = (address?: string | null) => {
  const s = (address || '').split(',')[0].trim()
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s
}

export default function ShowcaseActivityInbox({ isOpen, onClose, items, onOpenItem }: ShowcaseActivityInboxProps) {
  useEscapeToClose(onClose, isOpen)

  // Same spring-up open / drop-away close as the Tours window (MotionModal) - user, 10/24.
  return (
    <MotionModal open={isOpen} onBackdropClick={(e) => { if (e.target === e.currentTarget) onClose() }} className="bg-black/60">
      <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-xl w-full max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#111827] dark:bg-white p-2 rounded-lg shadow-sm">
              <Inbox className="text-white dark:text-[#111827]" size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-[#111827] dark:text-white tracking-tight">Showcase Activity</h2>
              <p className="text-[#6B7280] dark:text-gray-400 font-medium text-[11px]">What your clients did in their Showcases - last 30 days</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-[#111827] dark:hover:text-white transition-all p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          {items.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-white dark:bg-[#151517] rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-gray-100 dark:border-gray-800">
                <Inbox className="h-6 w-6 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-sm font-bold text-[#111827] dark:text-white mb-1">Nothing yet</h3>
              <p className="text-xs text-[#6B7280] dark:text-gray-400">Likes, comments, tour requests and search changes show up here.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => {
                const k = kindOf(item)
                const Icon = k.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => onOpenItem(item)}
                    className={`w-full text-left flex items-center gap-3 rounded-xl p-2.5 border transition-all hover:border-[#C9A24D]/40 hover:shadow-sm ${
                      item.is_read ? 'bg-white dark:bg-[#151517] border-gray-100 dark:border-gray-800' : 'bg-[#C9A24D]/[0.06] dark:bg-[#C9A24D]/[0.08] border-[#C9A24D]/30'
                    }`}
                  >
                    <div className="relative w-11 h-11 flex-shrink-0">
                      {item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photo} alt="" className="w-11 h-11 rounded-lg object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-800" />
                      )}
                      <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${k.tone} text-white flex items-center justify-center ring-2 ring-white dark:ring-[#151517]`}>
                        <Icon size={10} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-[#111827] dark:text-white truncate">
                        {item.showcase_name || 'Client'} <span className="font-medium text-gray-500 dark:text-gray-400">· {k.label}</span>
                      </p>
                      <p className="text-[11px] text-[#6B7280] dark:text-gray-400 truncate">
                        {item.property_address ? street(item.property_address) : item.message}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">{ago(item.created_at)}</span>
                      {!item.is_read && <span className="w-2 h-2 rounded-full bg-[#C9A24D]" aria-label="New" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </MotionModal>
  )
}
