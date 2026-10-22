'use client'

import { OhpSpinner } from '@/components/brand/OhpLoader'
import { AnimatePresence, motion } from 'framer-motion'
import { backdropMotion, useEscapeToClose, useIsPhone, useLastValue, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import { useState, useRef, useEffect } from 'react'
import { X, MessageCircle, Send } from 'lucide-react'
import { Property } from '@/types'
import { cleanAddress, normalizeImageUrl } from '@/lib/utils'

interface QuickCommentModalProps {
  property: Property | null
  isOpen: boolean
  onClose: () => void
  onAddComment: (propertyId: string | number, comment: string) => void
  isLoading?: boolean
}

const formatDate = (dateString: string) => {
  try {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  } catch {
    return ''
  }
}

// Lightweight popup for replying to a property's comment thread directly from its card -
// same data/handlers as PropertyDetailsModal's Comments sidebar, just without needing to open
// the full property details view first.
function QuickCommentWindow({ property, isOpen, onClose, onAddComment, isLoading = false }: QuickCommentModalProps & { property: NonNullable<QuickCommentModalProps['property']> }) {
  useEscapeToClose(onClose)
  const sheetMotion = useSheetMotion()
  const phone = useIsPhone()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, phone)
  const [newComment, setNewComment] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNewComment('')
  }, [property?.id])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [property?.comments?.length, isOpen])


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || property.id === undefined) return
    onAddComment(property.id, newComment.trim())
    setNewComment('')
  }

  return (
    // Phones: a bottom sheet flush with the bottom edge (grab handle, pull down to close, clear of
    // the home indicator); larger screens: the same card, centred.
    <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <motion.div {...backdropMotion} className="absolute inset-0 bg-black/55" />
      <motion.div
        ref={sheetRef}
        {...sheetMotion}
        style={phone ? { y: sheetY } : undefined}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[26px] border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517] sm:max-h-[80vh] sm:max-w-sm sm:rounded-2xl sm:border"
      >
        <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-white/15 sm:hidden" />
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 pb-3 pt-2 dark:border-gray-800 flex-shrink-0 sm:p-4">
          {property.ListPictureURL && (
            <img src={normalizeImageUrl(property.ListPictureURL)} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black text-[#C9A24D] uppercase tracking-widest">Messages</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{cleanAddress(property.FullStreetAddress, property.City)}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center sm:h-auto sm:w-auto sm:p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thread */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[160px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <OhpSpinner size={24} />
            </div>
          ) : property.comments && property.comments.length > 0 ? (
            property.comments.map((comment) => (
              <div key={comment.id} className="pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-wider truncate">{comment.author}</span>
                  <span className="text-[9px] font-bold text-gray-400 flex-shrink-0">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{comment.content}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <MessageCircle className="mx-auto text-gray-300 dark:text-gray-700 mb-2" size={28} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No messages yet</p>
            </div>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={handleSubmit} style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }} className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-end gap-2 flex-shrink-0">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-base sm:text-sm resize-none focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all max-h-24"
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            aria-label="Send"
            className="grid h-11 w-11 place-items-center sm:h-auto sm:w-auto sm:p-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// Opens and closes with motion (the home stays on screen while it closes).
export default function QuickCommentModal(props: QuickCommentModalProps) {
  const property = useLastValue(props.property)
  return (
    <AnimatePresence>
      {props.isOpen && property && <QuickCommentWindow key="quick-comment" {...props} property={property} />}
    </AnimatePresence>
  )
}
