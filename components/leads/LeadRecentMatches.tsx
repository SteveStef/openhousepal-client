'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import PropertyQuickViewModal from '@/components/PropertyQuickViewModal'
import { MatchActivity, MatchHome, NewTag, homeFacts, matchedAgo, niceStreet, shortPrice } from '@/components/showcases/MatchBits'

/** The 3 newest homes in this lead's Showcase, seen or not (owner, 11/04): small, a quick look at price
 *  and stats, NEW until the agent opens that home, and what the client did with it. Showing them here
 *  clears nothing - opening one marks just that home seen. */
export default function LeadRecentMatches({ leadId, onOpenMailbox }: { leadId: string; onOpenMailbox?: () => void }) {
  const { user } = useAuth()
  const [homes, setHomes] = useState<MatchHome[]>([])
  const [viewing, setViewing] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    api.leads.recentMatches(leadId).then(r => { if (live && r.success && r.data) setHomes(r.data.homes) }).catch(() => {})
    return () => { live = false }
  }, [leadId])
  if (!homes.length) return null

  const open = (h: MatchHome) => {
    api.collections.trackPropertyView(h.collection_id, h.property_id).catch(() => {})
    setHomes(list => list.map(x => (x.property_id === h.property_id && x.collection_id === h.collection_id ? { ...x, is_new: false } : x)))
    if (h.listing_key) setViewing(h.listing_key)
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 dark:border-white/10" data-testid="lead-recent-matches">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Newest matches</p>
        {onOpenMailbox && <button type="button" onClick={onOpenMailbox} data-testid="lead-open-mailbox" className="text-[10.5px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">Open mailbox</button>}
      </div>
      <div className="space-y-1">
        {homes.map((h, i) => (
          <motion.button key={`${h.collection_id}-${h.property_id}`} type="button" onClick={() => open(h)} data-testid="lead-match"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 26, delay: i * 0.05 }}
            whileHover={{ x: 2 }} whileTap={{ scale: 0.985 }}
            className="group flex w-full min-w-0 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-[#C9A24D]/[0.07]">
            <span className="h-9 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
              {h.photo && <img src={resolveMediaUrl(h.photo)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1">
                <span className="text-[12px] font-black text-[#111827] dark:text-white">{shortPrice(h.price)}</span>
                <span className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{niceStreet(h.address)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400">
                <span className="truncate">{homeFacts(h)}</span>
                {h.matched_at && <span className="shrink-0">· {matchedAgo(h.matched_at)}</span>}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1"><MatchActivity a={h.activity} /><NewTag on={h.is_new} /></span>
          </motion.button>
        ))}
      </div>
      {user && <PropertyQuickViewModal listingKey={viewing} agentId={user.id} onClose={() => setViewing(null)} />}
    </div>
  )
}
