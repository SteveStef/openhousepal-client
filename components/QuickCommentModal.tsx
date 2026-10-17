'use client'

import { OhpSpinner } from '@/components/brand/OhpLoader'
import { AnimatePresence, motion } from 'framer-motion'
import { backdropMotion, panelMotion, useEscapeToClose, useLastValue } from '@/components/ui/windowMotion'
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
    <div className="fixed inset-0 z-[10000] flex items-end justify-center p-3 sm:items-center sm:p-4" onClick={onClose}>
      <motion.div {...backdropMotion} className="absolute inset-0 bg-black/55" />
      <motion.div
        {...panelMotion}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white dark:bg-[#151517] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          {property.ListPictureURL && (
            <img src={normalizeImageUrl(property.ListPictureURL)} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black text-[#C9A24D] uppercase tracking-widest">Messages</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{cleanAddress(property.FullStreetAddress, property.City)}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={16} />
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
        <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-end gap-2 flex-shrink-0">
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
            className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all max-h-24"
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="p-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
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
