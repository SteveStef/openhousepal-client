'use client'

// A check-in waiting for a lead (owner, 11/09): leads with nothing suggested, nothing open and no word from the
// agent in two weeks. The reason is free (no AI); "Write it" writes the text the agent would send THIS lead -
// from their open house (and how long ago), their sign-in answers, the agent's notes, their Showcase and what
// was already sent - in one small AI call, on the tap only. The time words stay right if it's sent later
// (backend followup_writer + tasks_service.fill_when).
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Check, Loader2, PenLine, RefreshCw, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import type { CheckinItem, WrittenMessage } from '@/types'

export const usagePct = (p?: number | null) => (p == null ? '' : p < 0.1 ? 'under 0.1%' : `about ${p}%`)
export type WriteEstimate = { usage_percent: number; left_percent: number | null; enough: boolean }

/** Tomorrow, any time (all-day) - the phone buzzes at 9 AM. Same as the other suggested follow-ups. */
function tomorrowAt(h: number) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0)
  return d.toISOString()
}

/** The message as it should be saved: the AI's own (time words stay right) unless the agent changed it. */
export function messageToSave(w: WrittenMessage, edited: string): string {
  if (edited.trim() === w.text.trim()) return w.message
  return w.link ? `${edited.trim()}\n\n{showcase}` : edited.trim()
}

export default function CheckinCard({ item, estimate, onAdded, showName = false }: {
  item: CheckinItem
  estimate?: WriteEstimate | null
  onAdded?: () => void
  /** On the Leads page the card says whose it is. */
  showName?: boolean
}) {
  const [state, setState] = useState<'idle' | 'writing' | 'ready' | 'adding' | 'added'>('idle')
  const [w, setW] = useState<WrittenMessage | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const who = item.first || item.name.split(' ')[0] || 'them'
  const noRoom = estimate ? !estimate.enough : false

  const write = async () => {
    setState('writing'); setError('')
    const res = await api.tasks.write({ lead_id: item.lead_id })
    if (!res.success || !res.data) { setError(res.error || "Couldn't write it just now - try again."); setState(w ? 'ready' : 'idle'); return }
    setW(res.data); setText(res.data.text); setState('ready')
  }

  const add = async () => {
    if (!w) return
    setState('adding')
    const res = await api.tasks.create({
      title: w.title, kind: w.kind, priority: 'normal', due_at: tomorrowAt(12), remind_at: tomorrowAt(9), all_day: true,
      lead_id: item.lead_id, notes: `Why now: ${item.reason}`, suggested_message: messageToSave(w, text), signed: true,
    })
    if (!res.success) { setError(res.error || "Couldn't add it - try again."); setState('ready'); return }
    setState('added'); onAdded?.()
  }

  const edited = !!w && text.trim() !== w.text.trim()
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-[#C9A24D]/40 bg-gradient-to-br from-[#fffaf0] to-white dark:border-[#C9A24D]/25 dark:from-[#C9A24D]/[0.07] dark:to-transparent" data-testid="checkin-card" data-lead={item.lead_id}>
      <div className="p-3.5">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#e8c97a]">
          <Sparkles className="h-3.5 w-3.5" /> Ready to check in
        </p>
        <p className="mt-1.5 text-[15px] font-black leading-snug text-[#111827] dark:text-white" data-testid="checkin-title">
          {showName ? `Check in with ${item.name}` : `Check in with ${who}`}
        </p>
        <p className="mt-0.5 text-[12px] font-semibold leading-snug text-gray-500 dark:text-gray-400" data-testid="checkin-reason">{item.reason}</p>

        <AnimatePresence mode="wait" initial={false}>
          {state === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
              <p className="text-[12px] font-semibold leading-snug text-[#6b5a3e] dark:text-[#e8d5a8]">
                One tap writes the text you&apos;d send {who} - from their open house, your notes and their Showcase - in your words. You check it, then add it.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <button type="button" onClick={write} disabled={noRoom} data-testid="checkin-write"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#111827] px-4 text-[12px] font-black text-white transition hover:-translate-y-px disabled:opacity-40 dark:bg-[#C9A24D] dark:text-[#111827] max-sm:w-full max-sm:justify-center">
                  <PenLine className="h-3.5 w-3.5" /> Write it
                </button>
                {estimate && (
                  <span className="text-[11px] font-semibold text-gray-400" data-testid="checkin-cost">
                    {noRoom ? 'Not enough chat usage left this month' : `Uses ${usagePct(estimate.usage_percent)} of your chat usage`}
                  </span>
                )}
              </div>
            </motion.div>
          )}
          {state === 'writing' && (
            <motion.p key="writing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-2 text-[12.5px] font-bold text-[#8b7355] dark:text-[#e8c97a]">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing it for {who}…
            </motion.p>
          )}
          {(state === 'ready' || state === 'adding') && w && (
            <motion.div key="ready" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3">
              <textarea value={text} onChange={e => setText(e.target.value)} rows={5} maxLength={700} data-testid="checkin-text"
                className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[15px] font-medium leading-snug text-[#111827] outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-white/10 dark:bg-[#0B0B0B] dark:text-white sm:text-[13.5px]" />
              <p className="mt-1 text-[11px] font-semibold leading-snug text-gray-400" data-testid="checkin-note">
                Signed with your name{w.link ? ' · their Showcase link goes last' : ''}
                {edited ? ' · edited by you' : ' · if it goes out later, "a few weeks ago" and the like stay right'}
                {w.used_percent != null ? ` · used ${usagePct(w.used_percent)} of chat usage` : ''}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={add} disabled={state === 'adding' || !text.trim()} data-testid="checkin-add"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#111827] px-4 text-[12px] font-black text-white transition hover:-translate-y-px disabled:opacity-50 dark:bg-[#C9A24D] dark:text-[#111827] max-sm:flex-1 max-sm:justify-center">
                  {state === 'adding' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />} Add for tomorrow
                </button>
                <button type="button" onClick={write} disabled={state === 'adding'} data-testid="checkin-rewrite"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-[12px] font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-gray-300">
                  <RefreshCw className="h-3.5 w-3.5" /> Rewrite
                </button>
              </div>
            </motion.div>
          )}
          {state === 'added' && (
            <motion.p key="added" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" data-testid="checkin-added">
              <Check className="h-3.5 w-3.5" /> Added for tomorrow - it&apos;s in your follow-ups
            </motion.p>
          )}
        </AnimatePresence>
        {error && <p className="mt-2 text-[11.5px] font-bold text-rose-600 dark:text-rose-400" data-testid="checkin-error">{error}</p>}
      </div>
    </div>
  )
}
