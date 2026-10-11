'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, FileText, Heart,
  Home, Loader2, MessageSquareText, Sparkles, ThumbsDown, TrendingUp, X,
} from 'lucide-react'
import api from '@/lib/api-service'
import { DailyDigest, DigestItem } from '@/types'
import { formatDateTime } from '@/lib/relativeDays'

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  tour_request: CalendarClock,
  second_visit: CalendarClock,
  disclosure: FileText,
  new_match: TrendingUp,
  liked: Heart,
  disliked: ThumbsDown,
  comment: MessageSquareText,
  new_lead: Sparkles,
  open_house_visitor: Home,
  form_submission: ClipboardList,
  form_partial: ClipboardList,
  property_tour: CalendarClock,
  property_comment: MessageSquareText,
  open_house_second_visit: CalendarClock,
  open_house_disclosure: FileText,
}

const SEVERITY_STYLE: Record<string, { ring: string; icon: string }> = {
  urgent: { ring: 'border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-900/10', icon: 'bg-red-500 text-white' },
  attention: { ring: 'border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-900/10', icon: 'bg-amber-400 text-white' },
  info: { ring: 'border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/40', icon: 'bg-[#8b7355]/15 text-[#8b7355] dark:bg-[#C9A24D]/15 dark:text-[#C9A24D]' },
}

function AttentionMiniCard({ item, index, onDismiss, onGo }: { item: DigestItem; index: number; onDismiss: (id: string) => void; onGo: (link: string) => void }) {
  const Icon = KIND_ICON[item.kind] || AlertCircle
  const style = SEVERITY_STYLE[item.severity] || SEVERITY_STYLE.info
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
      className={`flex min-w-0 flex-col gap-1.5 rounded-lg border p-2 ${style.ring}`}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${style.icon}`}>
          <Icon className="h-2.5 w-2.5" />
        </span>
        <p className="min-w-0 flex-1 text-[10.5px] font-black leading-tight text-[#111827] line-clamp-2 dark:text-white">{item.title}</p>
        <button
          onClick={() => onDismiss(item.id)}
          title="Dismiss"
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-0.5 text-gray-300 transition hover:bg-black/5 hover:text-gray-500 dark:text-zinc-600 dark:hover:bg-white/5 dark:hover:text-zinc-300"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {item.link && (
        <button
          onClick={() => onGo(item.link!)}
          className="inline-flex items-center gap-0.5 self-start text-[9.5px] font-black uppercase tracking-wide text-[#8b7355] hover:text-[#111827] dark:text-[#C9A24D] dark:hover:text-white"
        >
          Go <ArrowRight className="h-2.5 w-2.5" />
        </button>
      )}
    </motion.div>
  )
}

function TodayRow({ item, index }: { item: DigestItem; index: number }) {
  const router = useRouter()
  const Icon = KIND_ICON[item.kind] || Sparkles
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.3) }}>
      <button
        onClick={() => item.link && router.push(item.link)}
        disabled={!item.link}
        className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-50 disabled:cursor-default dark:hover:bg-zinc-800/60"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Icon className="h-3 w-3" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-gray-600 dark:text-zinc-300">{item.title}</p>
        {item.occurred_at && (
          <span className="shrink-0 text-[10px] font-bold text-gray-400 dark:text-zinc-500">
            {formatDateTime(item.occurred_at)}
          </span>
        )}
      </button>
    </motion.div>
  )
}

export default function DashDigestPanel() {
  const router = useRouter()
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.ai.getDigest().then((r) => {
      if (r.success && r.data) setDigest(r.data)
      setLoading(false)
    })
  }, [])

  const handleDismiss = (itemId: string) => {
    // Optimistic - the item's gone from view immediately, not after a round trip.
    setDigest((prev) => (prev ? { ...prev, needs_attention: prev.needs_attention.filter((i) => i.id !== itemId) } : prev))
    api.ai.dismissDigestItem(itemId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-[#C9A24D]" />
      </div>
    )
  }

  const needsAttention = digest?.needs_attention || []
  const today = digest?.today || []

  if (needsAttention.length === 0 && today.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">All caught up - nothing needs you right now.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {needsAttention.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            Needs your attention &middot; {needsAttention.length}
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence initial={false}>
              {needsAttention.map((item, i) => (
                <AttentionMiniCard key={item.id} item={item} index={i} onDismiss={handleDismiss} onGo={(link) => router.push(link)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {today.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            Today
          </p>
          <div className="space-y-0.5">
            {today.map((item, i) => <TodayRow key={item.id} item={item} index={i} />)}
          </div>
        </div>
      )}

      {today.length === 0 && needsAttention.length > 0 && (
        <p className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500">Nothing new today yet.</p>
      )}
    </div>
  )
}
