'use client'

// The chat's follow-up card (owner, 11/09: "a few of these uis should be much nicer like the follow up one
// and should have the options changeable there in the ui"): everything the follow-up will have, ready to
// change right on the card - what it is, call / text / email, who it's for, when, notes and the message to
// send. Confirm saves exactly what the card shows (ai_actions_catalog._adjust_followup checks it again).
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Clock, Mail, MessageSquare, Phone, Search, UserRound, X, Home, ClipboardList, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'

export type FollowupPicks = {
  title: string; kind: string; lead_id: string | null; lead_name: string
  due_date: string; due_time: string; notes: string; suggested_message: string
}

export function followupStart(payload: Record<string, any> | undefined): FollowupPicks {
  const f = (payload?.form || {}) as Partial<FollowupPicks>
  return {
    title: f.title || payload?.body?.title || '', kind: f.kind || 'general', lead_id: f.lead_id || null, lead_name: f.lead_name || '',
    due_date: f.due_date || '', due_time: f.due_time || '', notes: f.notes || '', suggested_message: f.suggested_message || '',
  }
}

const KINDS: [string, string, typeof Phone][] = [['call', 'Call', Phone], ['text', 'Text', MessageSquare], ['email', 'Email', Mail], ['showing', 'Showing', Home], ['general', 'To-do', ClipboardList]]
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plus = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d) }
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return iso(d) }
const TIMES: [string, string][] = [['09:00', '9 AM'], ['10:00', '10 AM'], ['12:00', 'Noon'], ['14:00', '2 PM'], ['17:00', '5 PM']]

export function followupWhen(p: FollowupPicks) {
  if (!p.due_date) return 'No due date'
  const d = new Date(`${p.due_date}T${p.due_time || '12:00'}:00`)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return p.due_time ? `${day} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : `${day} · all day`
}

const label = 'text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]'
const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[16px] font-semibold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-2 focus:ring-[#C9A24D]/20 sm:text-[13px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
const chip = (on: boolean) => `ohp-ai-press inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[84px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <p className={`${label} sm:pt-2`}>{name}</p>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function FollowupPick({ picks, onPicks }: { picks: FollowupPicks; onPicks: (p: FollowupPicks) => void }) {
  const set = (patch: Partial<FollowupPicks>) => onPicks({ ...picks, ...patch })
  // who it's for: their leads, searched as they type
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<{ id: string; name: string; email?: string | null }[]>([])
  const [looking, setLooking] = useState(false)
  const [finding, setFinding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    const t = q.trim()
    if (!finding || t.length < 2) { setHits([]); return }
    timer.current = setTimeout(async () => {
      setLooking(true)
      const r = await api.leads.list({ search: t, limit: 6 })
      setLooking(false)
      setHits(r.success && Array.isArray(r.data) ? r.data.map((l: any) => ({ id: String(l.id), name: l.name || l.email || 'No name', email: l.email })) : [])
    }, 250)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q, finding])
  const showMessage = picks.kind === 'text' || picks.kind === 'email' || !!picks.suggested_message
  const quick: [string, string][] = [['Today', plus(0)], ['Tomorrow', plus(1)], ['In 3 days', plus(3)], ['Next week', nextMonday()]]

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-[#faf7f0] p-2.5 sm:p-3.5 dark:bg-zinc-800/50" data-testid="ai-followup-pick">
      <Row name="What">
        <input value={picks.title} onChange={e => set({ title: e.target.value })} maxLength={200} placeholder="Call Lisa about her Showcase" className={field} data-testid="ai-fu-title" />
      </Row>
      <Row name="Type">
        <div className="flex flex-wrap gap-1.5" data-testid="ai-fu-kinds">
          {KINDS.map(([id, name, Icon]) => (
            <button key={id} type="button" aria-pressed={picks.kind === id} onClick={() => set({ kind: id })} className={chip(picks.kind === id)} data-testid={`ai-fu-kind-${id}`}>
              <Icon className="h-3.5 w-3.5" /> {name}
            </button>
          ))}
        </div>
      </Row>
      <Row name="For">
        {picks.lead_id && !finding ? (
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#C9A24D]/50 bg-white py-1 pl-1 pr-1.5 dark:bg-zinc-900" data-testid="ai-fu-lead">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#e8c97a]"><UserRound className="h-3.5 w-3.5" /></span>
            <span className="min-w-0 truncate text-[12.5px] font-black text-[#111827] dark:text-white">{picks.lead_name || 'Lead'}</span>
            <button type="button" onClick={() => { setFinding(true); setQ('') }} className="ohp-ai-press rounded-full px-2 py-0.5 text-[10.5px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]" data-testid="ai-fu-lead-change">Change</button>
            <button type="button" aria-label="Not for a person" title="Not for a person" onClick={() => set({ lead_id: null, lead_name: '' })} className="ohp-ai-press grid h-6 w-6 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800" data-testid="ai-fu-lead-clear"><X className="h-3.5 w-3.5" /></button>
          </span>
        ) : !finding ? (
          <button type="button" onClick={() => setFinding(true)} className={chip(false)} data-testid="ai-fu-lead-add"><UserRound className="h-3.5 w-3.5" /> Add a person</button>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type a lead's name or email" className={`${field} pl-8 pr-9`} data-testid="ai-fu-lead-search" />
            <button type="button" aria-label="Stop searching" onClick={() => { setFinding(false); setQ('') }} className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:text-gray-700">
              {looking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
            {hits.length > 0 && (
              <div className="mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {hits.map(h => (
                  <button key={h.id} type="button" onClick={() => { set({ lead_id: h.id, lead_name: h.name }); setFinding(false); setQ('') }} data-testid="ai-fu-lead-hit"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#C9A24D]/10">
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[#111827] dark:text-white">{h.name}</span>
                    {h.email && <span className="hidden min-w-0 truncate text-[11px] text-gray-400 sm:block">{h.email}</span>}
                  </button>
                ))}
              </div>
            )}
            {q.trim().length >= 2 && !looking && !hits.length && <p className="mt-1 text-[11px] font-semibold text-gray-400">No lead by that name.</p>}
          </div>
        )}
      </Row>
      <Row name="When">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" data-testid="ai-fu-days">
            {quick.map(([name, d]) => (
              <button key={name} type="button" aria-pressed={picks.due_date === d} onClick={() => set({ due_date: d })} className={chip(picks.due_date === d)}>{name}</button>
            ))}
            <button type="button" aria-pressed={!picks.due_date} onClick={() => set({ due_date: '', due_time: '' })} className={chip(!picks.due_date)} data-testid="ai-fu-nodate">No date</button>
          </div>
          {picks.due_date && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={picks.due_date} min={plus(0)} onChange={e => e.target.value && set({ due_date: e.target.value })} className={`${field} w-[170px] pl-8`} data-testid="ai-fu-date" />
                </label>
                <label className="relative">
                  <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input type="time" value={picks.due_time} onChange={e => set({ due_time: e.target.value })} className={`${field} w-[140px] pl-8`} data-testid="ai-fu-time" />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TIMES.map(([t, name]) => <button key={t} type="button" aria-pressed={picks.due_time === t} onClick={() => set({ due_time: t })} className={chip(picks.due_time === t)}>{name}</button>)}
                <button type="button" aria-pressed={!picks.due_time} onClick={() => set({ due_time: '' })} className={chip(!picks.due_time)} data-testid="ai-fu-allday">All day</button>
              </div>
            </>
          )}
          <p className="text-[11.5px] font-bold text-gray-500 dark:text-zinc-400" data-testid="ai-fu-when">{followupWhen(picks)}</p>
        </div>
      </Row>
      {showMessage && (
        <Row name="Message">
          <textarea value={picks.suggested_message} onChange={e => set({ suggested_message: e.target.value })} rows={3} maxLength={2000}
            placeholder={picks.kind === 'email' ? 'The email to send them' : 'The text to send them'} className={`${field} resize-y leading-snug`} data-testid="ai-fu-message" />
        </Row>
      )}
      <Row name="Notes">
        <textarea value={picks.notes} onChange={e => set({ notes: e.target.value })} rows={2} maxLength={4000} placeholder="Anything to remember (optional)"
          className={`${field} resize-y leading-snug`} data-testid="ai-fu-notes" />
      </Row>
    </div>
  )
}
