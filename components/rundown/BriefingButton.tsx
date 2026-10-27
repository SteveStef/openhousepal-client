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
// this "Oct 26 Briefing" button. Something new since they looked (a sign-in, a like, the briefing
// going out) lights it up with how many; opening it again calms it down. It never brings the big
// card back. Other pages have the bell.
const POLL_MS = 60000

const BRIEF_CSS = `
        .ohp-brief-shine{position:absolute;inset:0;z-index:-1;border-radius:inherit;overflow:hidden;pointer-events:none}
        .ohp-brief-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.75) 48%,transparent 66%);transform:translateX(-120%)}
        .ohp-brief-lit .ohp-brief-shine::after{animation:ohpBriefShine 2.6s ease-in-out infinite}
        .ohp-brief-lit{animation:ohpBriefGlow 2.6s ease-in-out infinite}
        @keyframes ohpBriefShine{0%,35%{transform:translateX(-120%)}75%,100%{transform:translateX(120%)}}
        @keyframes ohpBriefGlow{0%,100%{box-shadow:0 6px 18px -8px rgba(168,128,58,.9),0 0 0 0 rgba(232,201,122,.55)}50%{box-shadow:0 6px 18px -8px rgba(168,128,58,.9),0 0 0 6px rgba(232,201,122,0)}}
      `

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

  if (!on || !st || !st.seen) return null   // not looked at yet - the big card is showing

  const [y, m, d] = st.date.split('-').map(Number)
  const day = new Date(y, (m || 1) - 1, d || 1)
  const month = day.toLocaleDateString('en-US', { month: 'short' })
  const lit = st.new_since > 0
  const count = st.new_since > 99 ? '99+' : String(st.new_since)
  const title = st.new_since ? `${st.new_since} new since you last looked` : `Today's briefing`

  if (compact) {
    return (
      <motion.button type="button" onClick={openTodaysRundown} title={title} aria-label={`${month} ${day.getDate()} Briefing. ${title}`}
        data-testid="briefing-button" data-lit={lit ? 'true' : 'false'}
        initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.94 }}
        className={`ohp-brief relative isolate inline-flex h-5 shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[10.5px] font-black leading-none text-[#1a1408] shadow-[0_3px_8px_-5px_rgba(168,128,58,.9)] ring-1 ring-[#a8803a]/40 ${lit && !reduce ? 'ohp-brief-lit' : ''}`}
        style={{ background: 'linear-gradient(115deg,#b8902f 0%,#e8c97a 48%,#C9A24D 100%)' }}>
        <style>{BRIEF_CSS}</style>
        <span className="ohp-brief-shine" aria-hidden />
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#111827] text-[#e8c97a]"><CalendarDays className="h-2.5 w-2.5" /></span>
        <span className="whitespace-nowrap">{month} {day.getDate()} Briefing</span>
        {/* The count sits inside the pill (not hanging off its corner) so the pill fits the
            "Dashboard - Updated" line exactly - same height, centred, no extra room (owner, 10/28). */}
        {st.new_since > 0 && (
          <motion.span key={count} initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }}
            className="-mr-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black tabular-nums text-white">{count}</motion.span>
        )}
      </motion.button>
    )
  }

  return (
    <motion.button type="button" onClick={openTodaysRundown} title={title} aria-label={`${month} ${day.getDate()} Briefing. ${title}`}
      data-testid="briefing-button" data-lit={lit ? 'true' : 'false'}
      initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.94 }}
      className={`ohp-brief group/brief relative isolate inline-flex h-9 shrink-0 items-center gap-1.5 overflow-visible rounded-full p-1 text-[13px] font-black leading-none text-[#1a1408] shadow-[0_6px_18px_-8px_rgba(168,128,58,.9)] ring-1 ring-[#a8803a]/40 transition hover:-translate-y-px sm:h-10 ${lit && !reduce ? 'ohp-brief-lit' : ''}`}
      style={{ background: 'linear-gradient(115deg,#b8902f 0%,#e8c97a 48%,#C9A24D 100%)' }}>
      <style>{BRIEF_CSS}</style>
      <span className="ohp-brief-shine" aria-hidden />
      {/* little calendar page */}
      <span className="flex h-7 w-7 shrink-0 flex-col items-center overflow-hidden rounded-full bg-[#111827] text-white shadow-inner sm:h-8 sm:w-8">
        <span className="mt-[5px] text-[6.5px] font-black uppercase tracking-[0.12em] text-[#e8c97a] sm:mt-[6px] sm:text-[7px]">{month}</span>
        <span className="-mt-px font-serif text-[12px] font-black leading-none sm:text-[13px]">{day.getDate()}</span>
      </span>
      <span className={`${word} whitespace-nowrap pr-2`}>Briefing</span>
      {st.new_since > 0 && (
        <motion.span key={count} initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }}
          className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10.5px] font-black tabular-nums text-white ring-2 ring-white dark:ring-[#0B0B0B]">{count}</motion.span>
      )}
    </motion.button>
  )
}
