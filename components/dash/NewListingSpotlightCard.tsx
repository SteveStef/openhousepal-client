'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { getNavFeatureAccess } from '@/lib/navAccess'
import type { MarketingListing } from '@/types'

const DISMISS_KEY = 'ohp:dash:new-listing-dismissed'

const readDismissed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') } catch { return [] }
}

// Dash: "New listing: 12 Maple Ave - make a Spotlight". Shows the agent's newest listing(s) from
// the last three weeks that don't have a Listing Spotlight yet (synced from the MLS - nothing to
// enter). One tap opens the Spotlight builder with that home already picked. Dismissable per home.
export default function NewListingSpotlightCard({ className = '' }: { className?: string }) {
  const { user } = useAuth()
  const [items, setItems] = useState<MarketingListing[]>([])
  const access = getNavFeatureAccess(user?.plan_tier, 'listing_spotlight')

  useEffect(() => {
    if (!access.visible || access.locked) return
    api.agentHub.marketingMoments().then(res => {
      if (!res.success || !res.data) return
      const dismissed = readDismissed()
      setItems(res.data.needs_spotlight.filter(l => l.is_new && !dismissed.includes(l.listing_key)).slice(0, 2))
    })
  }, [access.visible, access.locked])

  const dismiss = (key: string) => {
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...readDismissed(), key])) } catch {}
    setItems(prev => prev.filter(l => l.listing_key !== key))
  }

  const href = (l: MarketingListing) => {
    const q = new URLSearchParams({ new: '1', listing: l.listing_key, address: l.address || '' })
    for (const [k, v] of [['city', l.city], ['state', l.state], ['zipcode', l.zipcode], ['price', l.price], ['beds', l.beds], ['baths', l.baths], ['sqft', l.sqft], ['image', l.image]] as const) {
      if (v != null && v !== '') q.set(k, String(v))
    }
    return `/studio/property-sites?${q.toString()}`
  }

  return (
    <AnimatePresence initial={false}>
      {items.map(l => (
        <motion.div
          key={l.listing_key}
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
          className={className}
        >
          <div className="group relative flex items-center gap-4 overflow-hidden rounded-3xl border border-[#C9A24D]/40 bg-[radial-gradient(120%_160%_at_100%_0%,rgba(201,162,77,.22),transparent_55%),linear-gradient(135deg,#0b0f0e,#111827_60%,#2a2218)] p-3 pr-4 text-white shadow-[0_24px_50px_-30px_rgba(201,162,77,.8)]">
            <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-card-shimmer" />
            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15 sm:h-[72px] sm:w-28">
              {l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}
            </div>
            <div className="relative min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-[#e8c97a]">
                <Sparkles className="h-3 w-3" /> New listing{l.days_on_market != null ? ` · ${l.days_on_market === 0 ? 'today' : `${l.days_on_market}d ago`}` : ''}
              </p>
              <p className="truncate font-serif text-lg font-black leading-tight">{l.address}</p>
              <p className="truncate text-xs font-semibold text-white/60">Give it a Listing Spotlight - its own cinematic page, built from your MLS photos in seconds.</p>
            </div>
            <Link
              href={href(l)}
              className="relative inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-xs font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition hover:-translate-y-0.5"
            >
              Make a Spotlight <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button onClick={() => dismiss(l.listing_key)} aria-label="Dismiss" className="relative shrink-0 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
