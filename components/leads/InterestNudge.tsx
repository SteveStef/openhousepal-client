'use client'

// "Worth a check-in" (owner, 11/13): a lead without an agent opening or clicking the same email again.
// A quiet card - what they did, which homes it was about (or which homes they looked at after it),
// and a suggested follow-up that one tap adds to their follow-ups (and calendar). Used in Today's
// Rundown and on that lead's own page. Backend: services/lead_interest_service.py.

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarPlus, Check, ChevronRight, Eye, Heart, MousePointerClick, X } from 'lucide-react'
import api from '@/lib/api-service'
import type { EmailAboutHome, InterestSignal } from '@/types'

const clock = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return time
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`
}

/** The lead's open nudges (or everyone's when no leadId), refreshed after a tap. */
export function useInterest(leadId?: string, enabled = true) {
  const [signals, setSignals] = useState<InterestSignal[] | null>(null)
  const load = useCallback(() => {
    api.clientEmails.interest(leadId).then(r => { if (r.success && r.data) setSignals(r.data.signals || []) })
  }, [leadId])
  useEffect(() => { if (enabled) load() }, [enabled, load])
  return { signals, reload: load, setSignals }
}

export function HomeChip({ h, viewed }: { h: EmailAboutHome; viewed: boolean }) {
  const [ok, setOk] = useState(false)
  const street = (h.street_address || '').split(',')[0]
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200/80 bg-white p-1.5 pr-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-[#efe6d4] to-[#d9c7a3] dark:from-[#1d1a14] dark:to-[#2a2218]">
        {h.image && <img src={h.image} alt="" loading="lazy" decoding="async" onLoad={() => setOk(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${ok ? 'opacity-100' : 'opacity-0'}`} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-black leading-tight text-[#111827] dark:text-white">{street}</span>
        <span className="flex items-center gap-1.5 truncate text-[10.5px] font-bold text-gray-500 dark:text-gray-400">
          {h.is_price_drop && h.new_price ? <span className="text-rose-600 dark:text-rose-400">{h.new_price}</span> : h.price}
          {viewed && h.liked && <span className="inline-flex items-center gap-0.5 text-rose-500"><Heart className="h-2.5 w-2.5 fill-current" />Liked</span>}
          {viewed && !h.liked && (h.views || 0) > 1 && <span className="inline-flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{h.views}x</span>}
        </span>
      </span>
    </span>
  )
}

export function InterestCard({ s, onDone, onAdded, go, showName = true }: {
  s: InterestSignal
  /** Right after the follow-up is made (e.g. reload a follow-up list). */
  onAdded?: () => void
  /** After Add / Dismiss - the parent drops it from its list. */
  onDone: (emailId: string) => void
  /** Open a link (the Rundown closes itself first). Defaults to a normal navigation. */
  go?: (link: string) => void
  showName?: boolean
}) {
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'clearing'>('idle')
  const homes = s.about.length ? s.about : s.viewed_after
  const viewed = !s.about.length && s.viewed_after.length > 0
  const open = (link: string) => (go ? go(link) : (window.location.href = link))
  const add = async () => {
    if (state !== 'idle') return
    setState('adding')
    const r = await api.clientEmails.interestFollowup(s.email_id)
    if (r.success) {
      setState('added')
      window.dispatchEvent(new Event('leads-notification-count:refresh'))
      onAdded?.()
      window.setTimeout(() => onDone(s.email_id), 1600)
    } else setState('idle')
  }
  const dismiss = async () => {
    if (state !== 'idle') return
    setState('clearing')
    const r = await api.clientEmails.interestClear(s.email_id)
    if (r.success) onDone(s.email_id); else setState('idle')
  }
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }} data-testid="interest-card"
      className="overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffdf8] to-white shadow-[0_10px_26px_-22px_rgba(139,115,85,.9)] dark:border-[#e8c97a]/15 dark:from-[#17140f] dark:to-[#141416]">
      <div className="flex items-start gap-3 p-3.5 pb-2.5">
        <span className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#111827] to-[#2a2218] text-[12px] font-black text-[#e8c97a]">
          {(s.first_name || '?').slice(0, 1).toUpperCase()}
          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D] text-white ring-2 ring-white dark:ring-[#141416]">
            <MousePointerClick className="h-2.5 w-2.5" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          {showName ? (
            <button type="button" onClick={() => open(`/leads?lead=${s.lead_id}`)} className="block text-left text-[13.5px] font-black leading-snug text-[#111827] hover:underline dark:text-white">
              {s.headline}
            </button>
          ) : (
            <span className="block text-[13.5px] font-black leading-snug text-[#111827] dark:text-white">{s.headline.replace(`${s.first_name} `, 'They ')}</span>
          )}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
            <span className={`rounded-full px-1.5 py-px text-[10px] font-black ${s.represented === 'no'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/60'}`}>
              {s.represented === 'no' ? 'No agent' : 'Agent unknown'}
            </span>
            {s.last_at && <span>Last {clock(s.last_at)}</span>}
            {s.subject && <span className="min-w-0 max-w-full truncate">&ldquo;{s.subject}&rdquo;</span>}
          </span>
        </span>
      </div>
      {homes.length > 0 && (
        <div className="px-3.5 pb-2.5">
          <p className="mb-1.5 text-[9.5px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#e8c97a]">
            {viewed ? 'Looked at after opening it' : 'What the email showed'}
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {homes.slice(0, 4).map((h, k) => <HomeChip key={k} h={h} viewed={viewed} />)}
          </div>
          {homes.length > 4 && <p className="mt-1 text-[10.5px] font-bold text-gray-400">+ {homes.length - 4} more</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#C9A24D]/15 bg-[#C9A24D]/[0.05] px-3.5 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[11.5px] font-bold text-[#5c4a2e] dark:text-[#e8c97a]/90">
          <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">Suggested: text {s.first_name} <span className="font-black">{s.suggestion.when_label}</span></span>
        </span>
        <AnimatePresence mode="wait" initial={false}>
          {state === 'added' ? (
            <motion.span key="added" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11.5px] font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Check className="h-3.5 w-3.5" /> Added to follow-ups
            </motion.span>
          ) : (
            <motion.span key="btns" className="flex items-center gap-1.5" exit={{ opacity: 0 }}>
              <button type="button" onClick={dismiss} disabled={state !== 'idle'} aria-label="Dismiss" data-testid="interest-dismiss"
                className="grid h-8 w-8 place-items-center rounded-full text-gray-400 transition hover:bg-black/5 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={add} disabled={state !== 'idle'} data-testid="interest-add"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#111827] px-3.5 text-[11.5px] font-black text-white shadow-sm transition hover:bg-black disabled:opacity-60 dark:bg-[#e8c97a] dark:text-[#111827]">
                <CalendarPlus className="h-3.5 w-3.5" /> {state === 'adding' ? 'Adding…' : 'Add follow-up'}
              </button>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {state === 'added' && (
        <button type="button" onClick={() => open('/leads/tasks')} className="flex w-full items-center justify-center gap-1 border-t border-[#C9A24D]/15 py-2 text-[11px] font-black text-[#8b7355] dark:border-white/[0.06] dark:text-[#e8c97a]">
          See it in Follow-ups <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </motion.div>
  )
}

/** A lead's own nudges, on their page - nothing at all when there are none. */
export function LeadInterestNudges({ leadId, onAdded }: { leadId: string; onAdded?: () => void }) {
  const { signals, setSignals } = useInterest(leadId)
  if (!signals || signals.length === 0) return null
  return (
    <div className="space-y-2" data-testid="lead-interest">
      <p className="px-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]">Worth a check-in</p>
      <AnimatePresence initial={false}>
        {signals.map(s => <InterestCard key={s.email_id} s={s} showName={false} onAdded={onAdded} onDone={id => setSignals(v => (v || []).filter(x => x.email_id !== id))} />)}
      </AnimatePresence>
    </div>
  )
}
