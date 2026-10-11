'use client'

import { Loader2, MessageSquarePlus, Sparkles, Trash2 } from 'lucide-react'
import { AIConversationListItem } from '@/types'

interface ConversationSidebarProps {
  conversations: AIConversationListItem[]
  activeConversationId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

export default function ConversationSidebar({
  conversations, activeConversationId, loading, onSelect, onNew, onDelete,
}: ConversationSidebarProps) {
  return (
    <aside className="hidden md:flex md:flex-col w-64 flex-shrink-0 border-r border-gray-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900">
      <div className="p-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 rounded-xl bg-[#8b7355] hover:bg-[#7a6549] text-white text-sm font-bold px-3 py-2.5 transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-gray-300 dark:text-zinc-600" />
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-zinc-500 px-3 py-2">No conversations yet.</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`group flex items-center gap-1.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
              activeConversationId === conv.id
                ? 'bg-gray-100 dark:bg-zinc-800 text-[#111827] dark:text-white'
                : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/60'
            }`}
            onClick={() => onSelect(conv.id)}
          >
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-gray-300 dark:text-zinc-600" />
            <span className="flex-1 text-sm font-semibold truncate">{conv.title || 'New conversation'}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0"
              aria-label="Delete conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
