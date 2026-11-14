'use client'

// One check-in (owner, 11/13): someone worth reaching back out to, and exactly why - strongest reason first
// ("Opened your emails 5 times since you last reached out", "You left a note on Jane at your listing ..."),
// then how long since the agent reached out. Free to show (backend checkins_service - no AI).
//
// Two ways to add it:
//  - Quick add (no AI): a plain "how's the search going?" text for tomorrow - the main button when there's
//    nothing personal to work in (item.simple).
//  - Write it (AI): the text written for THIS person from their open house, the agent's notes, their Showcase
//    and what was already sent - one small AI call on the tap only (backend followup_writer). The main
//    button when there's a note, liked homes or a comment to work in.
// "Not now" hides it for 30 days (Undo right there).
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarClock, Check, Clock, EyeOff, Loader2, PenLine, RefreshCw, Sparkles, Undo2, Zap } from 'lucide-react'
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

const initials = (name: string) => name.replace(/\s*\(test\)\s*$/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'

function Tag({ label }: { label: string }) {
  const tone = /^No agent|Pre-approved|Paying cash|Buying/.test(label)
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20'
    : /^Has an agent/.test(label)
      ? 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10'
      : 'bg-[#C9A24D]/10 text-[#7a6440] ring-[#C9A24D]/25 dark:text-[#e0c486]'
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-black ring-1 ring-inset ${tone}`}>{label}</span>
}

export default function CheckinCard({ item, estimate, onAdded, onSkipped, showName = false }: {
  item: CheckinItem
  estimate?: WriteEstimate | null
  onAdded?: () => void
  /** Hidden for 30 days (or brought back with Undo: false). */
  onSkipped?: (skipped: boolean) => void
  /** On the Follow-ups page the card says whose it is. */
  showName?: boolean
}) {
  const [state, setState] = useState<'idle' | 'writing' | 'ready' | 'adding' | 'added' | 'skipped'>('idle')
  const [w, setW] = useState<WrittenMessage | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [quick, setQuick] = useState(false)
  const who = item.first || item.name.split(' ')[0] || 'them'
  const noRoom = estimate ? !estimate.enough : false
  const why = [item.headline, ...(item.reasons || [])].filter(Boolean).join(' · ')

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
      lead_id: item.lead_id, notes: `Why now: ${why}`, suggested_message: messageToSave(w, text), signed: true,
    })
    if (!res.success) { setError(res.error || "Couldn't add it - try again."); setState('ready'); return }
    setState('added'); onAdded?.()
  }

  const quickAdd = async () => {
    setState('adding'); setError(''); setQuick(true)
    const res = await api.tasks.checkinAdd(item.lead_id, why)
    if (!res.success) { setError(res.error || "Couldn't add it - try again."); setState('idle'); setQuick(false); return }
    setState('added'); onAdded?.()
  }

  const skip = async (on: boolean) => {
    setError('')
    const res = await api.tasks.checkinSkip(item.lead_id, on ? 30 : 0)
    if (!res.success) { setError(res.error || 'Something went wrong - try again.'); return }
    setState(on ? 'skipped' : 'idle'); onSkipped?.(on)
  }

  const edited = !!w && text.trim() !== w.text.trim()
  const aiCost = estimate ? (noRoom ? 'Not enough AI usage left this month' : `Uses ${usagePct(estimate.usage_percent)} of your AI usage`) : ''

  if (state === 'skipped') {
    return (
      <div className="flex h-full items-center gap-2 rounded-2xl border border-dashed border-gray-200 px-3.5 py-3 text-[12px] font-semibold text-gray-500 dark:border-white/10 dark:text-gray-400" data-testid="checkin-skipped" data-lead={item.lead_id}>
        <EyeOff className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.name} hidden for 30 days</span>
        <button type="button" onClick={() => skip(false)} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]" data-testid="checkin-unskip">
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#C9A24D]/35 bg-gradient-to-br from-[#fffaf0] to-white dark:border-[#C9A24D]/20 dark:from-[#C9A24D]/[0.07] dark:to-[#141416]" data-testid="checkin-card" data-lead={item.lead_id} data-group={item.group}>
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[12px] font-black text-[#111827]">{initials(item.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-black leading-snug text-[#111827] dark:text-white" data-testid="checkin-title">
              {showName ? `Check in with ${item.name}` : `Check in with ${who}`}
            </p>
            {item.tags?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{item.tags.map(t => <Tag key={t} label={t} />)}</div>}
          </div>
          {state === 'idle' && (
            <button type="button" onClick={() => skip(true)} title="Hide for 30 days" aria-label={`Not now - hide ${item.name} for 30 days`} data-testid="checkin-skip"
              className="-mr-1 -mt-1 shrink-0 rounded-full px-2 py-1 text-[11px] font-bold text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-200">
              Not now
            </button>
          )}
        </div>

        <p className="mt-2.5 text-[13px] font-bold leading-snug text-[#111827] dark:text-white" data-testid="checkin-reason">{item.headline}</p>
        {item.reasons?.length > 0 && (
          <ul className="mt-1 space-y-0.5" data-testid="checkin-reasons">
            {item.reasons.map(r => (
              <li key={r} className="flex gap-1.5 text-[12px] font-semibold leading-snug text-gray-600 dark:text-gray-300">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#C9A24D]" />
                <span className="min-w-0 break-words">{r}</span>
              </li>
            ))}
          </ul>
        )}
        {item.gap && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-gray-400" data-testid="checkin-gap">
            <Clock className="mt-px h-3 w-3 shrink-0" /> {item.gap}
          </p>
        )}

        <div className="mt-auto">
          <AnimatePresence mode="wait" initial={false}>
            {(state === 'idle' || (state === 'adding' && quick)) && (
              <motion.div key="idle" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-3">
                {item.simple ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={quickAdd} disabled={state === 'adding'} data-testid="checkin-quick"
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#111827] whitespace-nowrap px-4 text-[12px] font-black text-white transition hover:-translate-y-px disabled:opacity-50 dark:bg-[#C9A24D] dark:text-[#111827] max-sm:flex-1">
                        {state === 'adding' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Quick add
                      </button>
                      <button type="button" onClick={write} disabled={noRoom || state === 'adding'} data-testid="checkin-write"
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white whitespace-nowrap px-4 text-[12px] font-black text-gray-700 transition hover:border-[#C9A24D] disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-gray-200 max-sm:flex-1">
                        <PenLine className="h-3.5 w-3.5" /> Write it with AI
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold leading-snug text-gray-400" data-testid="checkin-cost">
                      Quick add: a plain check-in text for tomorrow, signed by you - free.{aiCost ? ` With AI: ${aiCost.charAt(0).toLowerCase()}${aiCost.slice(1)}.` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={write} disabled={noRoom || state === 'adding'} data-testid="checkin-write"
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#111827] whitespace-nowrap px-4 text-[12px] font-black text-white transition hover:-translate-y-px disabled:opacity-40 dark:bg-[#C9A24D] dark:text-[#111827] max-sm:flex-1">
                        <Sparkles className="h-3.5 w-3.5" /> Write it for {who}
                      </button>
                      <button type="button" onClick={quickAdd} disabled={state === 'adding'} data-testid="checkin-quick"
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white whitespace-nowrap px-4 text-[12px] font-black text-gray-700 transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-gray-200 max-sm:flex-1">
                        {state === 'adding' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Quick add
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold leading-snug text-gray-400" data-testid="checkin-cost">
                      Written from your notes and what {who} did{aiCost ? ` - ${aiCost.charAt(0).toLowerCase()}${aiCost.slice(1)}` : ''}. Quick add is free.
                    </p>
                  </>
                )}
              </motion.div>
            )}
            {state === 'writing' && (
              <motion.p key="writing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 pt-3 text-[12.5px] font-bold text-[#8b7355] dark:text-[#e8c97a]">
                <Loader2 className="h-4 w-4 animate-spin" /> Writing it for {who}…
              </motion.p>
            )}
            {(state === 'ready' || (state === 'adding' && !quick)) && w && (
              <motion.div key="ready" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-3">
                <textarea value={text} onChange={e => setText(e.target.value)} rows={5} maxLength={700} data-testid="checkin-text"
                  className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[16px] font-medium leading-snug text-[#111827] outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-white/10 dark:bg-[#0B0B0B] dark:text-white sm:text-[13.5px]" />
                <p className="mt-1 text-[11px] font-semibold leading-snug text-gray-400" data-testid="checkin-note">
                  Signed with your name{w.link ? ' · their Showcase link goes last' : ''}
                  {edited ? ' · edited by you' : ' · if it goes out later, "a few weeks ago" and the like stay right'}
                  {w.used_percent != null ? ` · used ${usagePct(w.used_percent)} of your AI usage` : ''}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={add} disabled={state === 'adding' || !text.trim()} data-testid="checkin-add"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#111827] whitespace-nowrap px-4 text-[12px] font-black text-white transition hover:-translate-y-px disabled:opacity-50 dark:bg-[#C9A24D] dark:text-[#111827] max-sm:flex-1">
                    {state === 'adding' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />} Add for tomorrow
                  </button>
                  <button type="button" onClick={write} disabled={state === 'adding'} data-testid="checkin-rewrite"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white whitespace-nowrap px-4 text-[12px] font-black text-gray-600 transition hover:border-[#C9A24D] dark:border-white/10 dark:bg-transparent dark:text-gray-300 max-sm:flex-1">
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
    </div>
  )
}
