'use client'

// The Showcase smart filter (owner, 11/09): up to 3 things the AI looks for in every home the search
// finds ("first-floor primary", "9 ft+ ceilings", "pool"). Homes that have them all are starred, as if the
// agent recommended them, with a line under the address; the rest still show, without the star.
// backend: services/showcase_smart_filter.py
import { useEffect, useState } from 'react'
import api from '@/lib/api-service'
import { Plus, Sparkles, X } from 'lucide-react'

export type SmartState = { wants?: string[]; state?: 'reading' | 'done' | 'no_room' | 'error' | 'off'; matched?: number; left?: number; read?: number; at?: string }
export type SmartMatch = { wants?: string[]; quotes?: string[] } | null | undefined

export const MAX_WANTS = 3
const IDEAS = ['First-floor primary bedroom', '9 ft+ ceilings', 'Pool', 'Finished basement', '3-car garage', 'Home office', 'Walk-out basement', 'Fenced yard', 'One-level living']

/** Chips + a box to add more - used in the Showcase search editor (create and edit). */
export function SmartWantsInput({ wants, onChange, state }: { wants: string[]; onChange: (w: string[]) => void; state?: SmartState | null }) {
  const [text, setText] = useState('')
  const add = (w: string) => {
    const t = w.replace(/\s+/g, ' ').trim().slice(0, 60)
    if (!t || wants.length >= MAX_WANTS || wants.some(x => x.toLowerCase() === t.toLowerCase())) return
    onChange([...wants, t]); setText('')
  }
  const ideas = IDEAS.filter(i => !wants.some(w => w.toLowerCase() === i.toLowerCase())).slice(0, 6)
  return (
    <div className="space-y-2.5" data-testid="smart-wants">
      <p className="text-[11.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
        The AI reads every home your search finds. Homes that have <span className="font-black text-[#111827] dark:text-white">all</span> of these get a star and a line saying so - the rest still show, without the star.
      </p>
      {wants.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {wants.map(w => (
            <span key={w} className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#C9A24D]/60 bg-[#C9A24D]/10 py-1 pl-2.5 pr-1 text-[12px] font-black text-[#8b7355] dark:text-[#e8c97a]" data-testid="smart-want">
              <Sparkles className="h-3 w-3 shrink-0" /> <span className="min-w-0 truncate">{w}</span>
              <button type="button" aria-label={`Take off ${w}`} onClick={() => onChange(wants.filter(x => x !== w))} className="grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-[#C9A24D]/20" data-testid="smart-want-remove">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {wants.length < MAX_WANTS && (
        <>
          <div className="flex gap-1.5">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(text) } }}
              maxLength={60} placeholder={wants.length ? 'Add another (up to 3)' : 'e.g. first-floor primary, 9 ft+ ceilings, pool'} data-testid="smart-want-input"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-[#FAFAF7] px-3 py-2 text-[16px] font-bold text-[#0B0B0B] outline-none placeholder:font-semibold placeholder:text-gray-300 focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 sm:text-sm dark:border-white/10 dark:bg-[#0B0B0B] dark:text-white dark:placeholder:text-gray-600" />
            <button type="button" onClick={() => add(text)} disabled={!text.trim()} aria-label="Add it" data-testid="smart-want-add"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#111827] text-white transition disabled:opacity-30 dark:bg-[#C9A24D] dark:text-[#111827]"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1">
            {ideas.map(i => (
              <button key={i} type="button" onClick={() => add(i)} data-testid="smart-want-idea"
                className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10.5px] font-bold text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                + {i}
              </button>
            ))}
          </div>
        </>
      )}
      {state && <SmartStatus state={state} />}
      <p className="text-[10.5px] font-semibold text-gray-400 dark:text-gray-500">Each home is read once - new listings as they come in. It uses a little of your chat usage.</p>
    </div>
  )
}

/** Where the reading is: reading / how many have them all / no chat usage left. */
export function SmartStatus({ state, className = '' }: { state: SmartState; className?: string }) {
  if (!state.wants?.length || state.state === 'off') return null
  const text = state.state === 'reading' ? `Reading ${state.left ? `${state.left} ` : ''}home${state.left === 1 ? '' : 's'} for these…`
    : state.state === 'no_room' ? `Paused - not enough chat usage left this month to read ${state.left || 'the'} home${state.left === 1 ? '' : 's'}. It picks up on your billing day.`
    : state.state === 'error' ? "Couldn't read the homes just now - it tries again with the next new listing or when you save."
    : `${state.matched ?? 0} home${state.matched === 1 ? ' has' : 's have'} all of them - starred for you`
  const tone = state.state === 'no_room' || state.state === 'error' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]'
  return (
    <p className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold leading-snug ${tone} ${className}`} data-testid="smart-status" data-state={state.state}>
      <Sparkles className={`mt-px h-3.5 w-3.5 shrink-0 ${state.state === 'reading' ? 'animate-pulse' : ''}`} /> {text}
    </p>
  )
}

/** Under a home's address on its card: what the AI found, gold - only when it has every must-have. */
export function SmartMatchLine({ match, className = '' }: { match: SmartMatch; className?: string }) {
  if (!match?.wants?.length) return null
  return (
    <p className={`flex min-w-0 items-center gap-1 text-[11px] font-bold leading-snug text-[#8b7355] dark:text-[#e8c97a] ${className}`} data-testid="smart-match-line"
      title={(match.quotes || []).map(q => q.replace(/[⟦⟧]/g, '')).join(' · ') || undefined}>
      <Sparkles className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">This appears to have {match.wants.map(w => w.charAt(0).toLowerCase() + w.slice(1)).join(', ')}</span>
    </p>
  )
}

/** On the agent's Showcase: the must-haves and where the reading is. While it reads, it checks every few
 *  seconds; when it's done, onDone reloads the homes so the stars and lines show. Edit opens the search editor. */
export function SmartFilterBar({ collectionId, initial, onEdit, onDone }: { collectionId: string; initial?: SmartState | null; onEdit?: () => void; onDone?: () => void }) {
  const [st, setSt] = useState<SmartState | null>(initial || null)
  useEffect(() => { setSt(initial || null) }, [collectionId, JSON.stringify(initial || null)]) // eslint-disable-line react-hooks/exhaustive-deps
  const reading = st?.state === 'reading'
  useEffect(() => {
    if (!reading) return
    let live = true
    const t = window.setInterval(async () => {
      const r = await api.collections.smartFilter(collectionId)
      if (!live || !r.success || !r.data) return
      const next = r.data.smart_filter
      setSt(next)
      if (next?.state !== 'reading') onDone?.()
    }, 4000)
    return () => { live = false; window.clearInterval(t) }
  }, [reading, collectionId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!st?.wants?.length || st.state === 'off') return null
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#C9A24D]/35 bg-gradient-to-r from-[#fffaf0] to-white px-3 py-2.5 dark:border-[#C9A24D]/25 dark:from-[#C9A24D]/[0.07] dark:to-transparent" data-testid="smart-filter-bar">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#C9A24D]">Must-haves</span>
      {st.wants.map(w => <span key={w} className="rounded-full bg-white px-2 py-0.5 text-[11.5px] font-black text-[#111827] ring-1 ring-[#C9A24D]/40 dark:bg-zinc-900 dark:text-white">{w}</span>)}
      <SmartStatus state={st} className="!bg-transparent !px-1 !py-0" />
      {onEdit && <button type="button" onClick={onEdit} className="ml-auto text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]" data-testid="smart-filter-edit">Change</button>}
    </div>
  )
}
