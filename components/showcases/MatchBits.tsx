'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, Eye, Heart, MessageSquare, ThumbsDown } from 'lucide-react'

// One home matched into a client's Showcase - the New Matches mailbox and a lead's newest matches.
export type MatchHome = {
  collection_id: string
  client: string | null
  client_email?: string | null
  showcase?: string | null
  property_id: string
  listing_key?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  status?: string | null
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  photo?: string | null
  matched_at?: string | null
  is_new: boolean
  activity: { viewed: boolean; liked: boolean; disliked: boolean; comments: number; tour: boolean }
}

export const niceStreet = (a?: string | null) => {
  const s = (a || '').split(',')[0].trim()
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : s
}

export const shortPrice = (p?: number | null) => (p ? (p >= 1_000_000 ? `$${(p / 1_000_000).toFixed(p % 100_000 ? 2 : 1)}M` : `$${Math.round(p / 1000)}K`) : '')

export const homeFacts = (m: Pick<MatchHome, 'beds' | 'baths' | 'sqft'>) =>
  [m.beds != null && `${m.beds} bd`, m.baths != null && `${m.baths} ba`, m.sqft ? `${Math.round(m.sqft).toLocaleString()} sf` : null].filter(Boolean).join(' · ')

export const matchedAgo = (iso?: string | null) => {
  if (!iso) return ''
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return mins < 2 ? 'just now' : `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

/** What the client did with this home, as small icons that pop in. */
export function MatchActivity({ a }: { a: MatchHome['activity'] }) {
  const items = [
    a.tour && { key: 'tour', icon: Calendar, tone: 'bg-red-500/12 text-red-600 dark:text-red-300', title: 'Asked for a tour' },
    a.comments > 0 && { key: 'comment', icon: MessageSquare, tone: 'bg-blue-500/12 text-blue-600 dark:text-blue-300', title: `${a.comments} comment${a.comments === 1 ? '' : 's'}` },
    a.liked && { key: 'liked', icon: Heart, tone: 'bg-rose-500/12 text-rose-600 dark:text-rose-300', title: 'Liked it' },
    a.disliked && { key: 'passed', icon: ThumbsDown, tone: 'bg-gray-500/12 text-gray-500 dark:text-gray-400', title: 'Passed on it' },
    a.viewed && { key: 'viewed', icon: Eye, tone: 'bg-sky-500/12 text-sky-600 dark:text-sky-300', title: 'Client viewed it' },
  ].filter(Boolean) as { key: string; icon: typeof Eye; tone: string; title: string }[]
  if (!items.length) return null
  return (
    <span className="inline-flex items-center gap-1" data-testid="match-activity">
      {items.map((it, i) => (
        <motion.span key={it.key} title={it.title} aria-label={it.title} initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 22, delay: 0.12 + i * 0.05 }}
          className={`grid h-[18px] w-[18px] place-items-center rounded-full ${it.tone}`}>
          <it.icon className="h-2.5 w-2.5" strokeWidth={2.6} />
        </motion.span>
      ))}
    </span>
  )
}

/** NEW until the agent opens the home or its Showcase - it pops away when that happens. */
export function NewTag({ on }: { on: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {on && (
        <motion.span key="new" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 480, damping: 24 }} data-testid="match-new"
          className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-[#111827] shadow-[0_4px_10px_-4px_rgba(201,162,77,.9)]">
          <span className="relative flex h-1 w-1"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#111827]/50" /><span className="relative inline-flex h-1 w-1 rounded-full bg-[#111827]" /></span>
          New
        </motion.span>
      )}
    </AnimatePresence>
  )
}
