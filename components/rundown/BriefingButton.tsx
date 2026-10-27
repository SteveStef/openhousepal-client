'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { SEEN_EVENT, openTodaysRundown } from './TodaysRundown'

type Status = { date: string; seen: boolean; new_since: number }

// Today's Rundown in the header (owner, 10/26): once the agent has looked at it - opened it here,
// or opened / clicked the briefing email - the big Dash card steps aside and this "Oct 26 Briefing"
// button opens it from any page. Before that it's on every page except the Dash (the card is there).
// Something new since they looked (a sign-in, a like, the briefing going out) lights it up with how
// many; opening it again calms it down. It never brings the big card back.
const POLL_MS = 60000

/** `word` = the classes that show the word "Briefing" (hidden where the header has no room - a
 * phone shows just the calendar page with the date). */
export default function BriefingButton({ word = 'inline' }: { word?: string }) {
  const { isAuthenticated, user } = useAuth()
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const [st, setSt] = useState<Status | null>(null)
  const on = isAuthenticated && !!user && !user.is_admin

  const load = useCallback(() => {
    api.notifications.rundownStatus().then(r => { if (r.success && r.data) setSt(r.data) })
  }, [])
  useEffect(() => {
    if (!on) return
    load()
    const t = window.setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    const onSeen = () => setSt(s => s && { ...s, seen: true, new_since: 0 })
    const onFocus = () => load()
    window.addEventListener(SEEN_EVENT, onSeen)
    window.addEventListener('leads-notification-count:refresh', load)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(t); window.removeEventListener(SEEN_EVENT, onSeen)
      window.removeEventListener('leads-notification-count:refresh', load); window.removeEventListener('focus', onFocus)
    }
  }, [on, load])

  if (!on || !st) return null
  if (!st.seen && pathname === '/dash') return null   // the big card is right there

  const [y, m, d] = st.date.split('-').map(Number)
  const day = new Date(y, (m || 1) - 1, d || 1)
  const month = day.toLocaleDateString('en-US', { month: 'short' })
  const lit = !st.seen || st.new_since > 0
  const count = st.new_since > 99 ? '99+' : String(st.new_since)
  const title = !st.seen ? `Today's briefing - not opened yet` : st.new_since ? `${st.new_since} new since you last looked` : `Today's briefing`

  return (
    <motion.button type="button" onClick={openTodaysRundown} title={title} aria-label={`${month} ${day.getDate()} Briefing. ${title}`}
      data-testid="briefing-button" data-lit={lit ? 'true' : 'false'}
      initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.94 }}
      className={`ohp-brief group/brief relative isolate inline-flex h-9 shrink-0 items-center gap-1.5 overflow-visible rounded-full p-1 text-[13px] font-black leading-none text-[#1a1408] shadow-[0_6px_18px_-8px_rgba(168,128,58,.9)] ring-1 ring-[#a8803a]/40 transition hover:-translate-y-px sm:h-10 ${lit && !reduce ? 'ohp-brief-lit' : ''}`}
      style={{ background: 'linear-gradient(115deg,#b8902f 0%,#e8c97a 48%,#C9A24D 100%)' }}>
      <style>{`
        .ohp-brief-shine{position:absolute;inset:0;z-index:-1;border-radius:inherit;overflow:hidden;pointer-events:none}
        .ohp-brief-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.75) 48%,transparent 66%);transform:translateX(-120%)}
        .ohp-brief-lit .ohp-brief-shine::after{animation:ohpBriefShine 2.6s ease-in-out infinite}
        .ohp-brief-lit{animation:ohpBriefGlow 2.6s ease-in-out infinite}
        @keyframes ohpBriefShine{0%,35%{transform:translateX(-120%)}75%,100%{transform:translateX(120%)}}
        @keyframes ohpBriefGlow{0%,100%{box-shadow:0 6px 18px -8px rgba(168,128,58,.9),0 0 0 0 rgba(232,201,122,.55)}50%{box-shadow:0 6px 18px -8px rgba(168,128,58,.9),0 0 0 6px rgba(232,201,122,0)}}
      `}</style>
      <span className="ohp-brief-shine" aria-hidden />
      {/* little calendar page */}
      <span className="flex h-7 w-7 shrink-0 flex-col items-center overflow-hidden rounded-full bg-[#111827] text-white shadow-inner sm:h-8 sm:w-8">
        <span className="mt-[5px] text-[6.5px] font-black uppercase tracking-[0.12em] text-[#e8c97a] sm:mt-[6px] sm:text-[7px]">{month}</span>
        <span className="-mt-px font-serif text-[12px] font-black leading-none sm:text-[13px]">{day.getDate()}</span>
      </span>
      <span className={`${word} whitespace-nowrap pr-2`}>Briefing</span>
      {st.seen && st.new_since > 0 && (
        <motion.span key={count} initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }}
          className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10.5px] font-black tabular-nums text-white ring-2 ring-white dark:ring-[#0B0B0B]">{count}</motion.span>
      )}
      {!st.seen && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-600 ring-2 ring-white dark:ring-[#0B0B0B]" aria-hidden />}
    </motion.button>
  )
}
