'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { SEEN_EVENT, openTodaysRundown } from './TodaysRundown'

type Status = { date: string; seen: boolean; new_since: number }

// Today's Rundown, top right of the Dashboard's header (owner, 10/26): once the agent has looked
// at it - opened it here, or opened / clicked the briefing email - the big Dash card steps aside for
// this "Oct 26 Briefing" button. Anything new since they looked (a sign-in, a like, the briefing
// going out) brings the big card back under the header and this button steps aside instead - it
// never carries a count (owner, 10/28). Other pages have the bell.
const POLL_MS = 60000

// One request for every copy on the page (the Dash shows one for phones and one for computers).
let inflight: Promise<Status | null> | null = null
let last: { at: number; st: Status } | null = null
function fetchStatus(): Promise<Status | null> {
  if (last && Date.now() - last.at < 5000) return Promise.resolve(last.st)
  if (!inflight) {
    inflight = api.notifications.rundownStatus()
      .then(r => { if (r.success && r.data) { last = { at: Date.now(), st: r.data }; return r.data } return null })
      .finally(() => { inflight = null })
  }
  return inflight
}

/** `word` = the classes that show the word "Briefing". `compact` = the phone's small pill on the
 * Dash's "Updated" line ("Oct 26 Briefing" with a calendar icon, not just a round date). */
export default function BriefingButton({ word = 'inline', compact = false }: { word?: string; compact?: boolean }) {
  const { isAuthenticated, user } = useAuth()
  const reduce = useReducedMotion()
  const [st, setSt] = useState<Status | null>(null)
  const on = isAuthenticated && !!user && !user.is_admin

  const load = useCallback(() => {
    fetchStatus().then(s => { if (s) setSt(s) })
  }, [])
  useEffect(() => {
    if (!on) return
    load()
    const t = window.setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    const onSeen = () => { last = null; setSt(s => s && { ...s, seen: true, new_since: 0 }) }
    const onFocus = () => load()
    window.addEventListener(SEEN_EVENT, onSeen)
    window.addEventListener('leads-notification-count:refresh', load)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(t); window.removeEventListener(SEEN_EVENT, onSeen)
      window.removeEventListener('leads-notification-count:refresh', load); window.removeEventListener('focus', onFocus)
    }
  }, [on, load])

  // Not looked at yet, or something new since - the big card is showing.
  if (!on || !st || !st.seen || st.new_since > 0) return null

  const [y, m, d] = st.date.split('-').map(Number)
  const day = new Date(y, (m || 1) - 1, d || 1)
  const month = day.toLocaleDateString('en-US', { month: 'short' })

  if (compact) {
    return (
      <motion.button type="button" onClick={openTodaysRundown} title="Today's briefing" aria-label={`${month} ${day.getDate()} Briefing`}
        data-testid="briefing-button"
        initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.94 }}
        className="ohp-brief relative isolate inline-flex h-5 shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[10.5px] font-black leading-none text-[#1a1408] shadow-[0_3px_8px_-5px_rgba(168,128,58,.9)] ring-1 ring-[#a8803a]/40"
        style={{ background: 'linear-gradient(115deg,#b8902f 0%,#e8c97a 48%,#C9A24D 100%)' }}>
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#111827] text-[#e8c97a]"><CalendarDays className="h-2.5 w-2.5" /></span>
        <span className="whitespace-nowrap">{month} {day.getDate()} Briefing</span>
      </motion.button>
    )
  }

  return (
    <motion.button type="button" onClick={openTodaysRundown} title="Today's briefing" aria-label={`${month} ${day.getDate()} Briefing`}
      data-testid="briefing-button"
      initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.94 }}
      className="ohp-brief group/brief relative isolate inline-flex h-9 shrink-0 items-center gap-1.5 overflow-visible rounded-full p-1 text-[13px] font-black leading-none text-[#1a1408] shadow-[0_6px_18px_-8px_rgba(168,128,58,.9)] ring-1 ring-[#a8803a]/40 transition hover:-translate-y-px sm:h-10"
      style={{ background: 'linear-gradient(115deg,#b8902f 0%,#e8c97a 48%,#C9A24D 100%)' }}>
      {/* little calendar page */}
      <span className="flex h-7 w-7 shrink-0 flex-col items-center overflow-hidden rounded-full bg-[#111827] text-white shadow-inner sm:h-8 sm:w-8">
        <span className="mt-[5px] text-[6.5px] font-black uppercase tracking-[0.12em] text-[#e8c97a] sm:mt-[6px] sm:text-[7px]">{month}</span>
        <span className="-mt-px font-serif text-[12px] font-black leading-none sm:text-[13px]">{day.getDate()}</span>
      </span>
      <span className={`${word} whitespace-nowrap pr-2`}>Briefing</span>
    </motion.button>
  )
}
