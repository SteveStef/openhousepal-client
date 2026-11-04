'use client'

// "Send my invite to these leads" from the chat (owner, 11/01: the helper should follow through on
// Forms & Invites, as stunning as the other cards). The agent's leads as check-box rows - name,
// email, a small tag (Open house guest / Showcase / Form...) - with a search box, "Select all
// shown" and a clear count. People who can't get it (no email, unsubscribed, already answered)
// are greyed with why. Nothing is sent until the card's main button, which says how many.
//
// ActionCard wiring (picker === 'invite_send'):
//   import { InviteSendPick, inviteSendInitial, inviteSendLabel, type InviteSendPicks } from './InviteSendPick'
//   const isInviteSend = action.picker === 'invite_send'
//   const [inviteSend, setInviteSend] = useState<InviteSendPicks>(() => inviteSendInitial(action.payload))
//   picks: ... : isInviteSend ? inviteSend : undefined          (sent on Confirm as { lead_ids: [...] })
//   render: {isInviteSend && choosing && <InviteSendPick payload={action.payload as Record<string, any>} picks={inviteSend} onPicks={setInviteSend} />}
//   button: {isInviteSend ? inviteSendLabel(inviteSend) : (action.confirm_label || 'Confirm')}
//           and disabled={!!busy || (isInviteSend && !inviteSend.lead_ids.length)}
import { useMemo, useState } from 'react'
import { Check, Mail, PartyPopper, Search, X } from 'lucide-react'
import { CardStep, OPTION_GRID, StepDone, useSteps } from './CardPickers'

export type InviteSendPicks = { lead_ids: string[] }
type Row = { id: string; name: string; email?: string | null; tag: string; sub?: string; why?: string; invited?: string; agent?: boolean }

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

/** The card's starting picks: whoever the helper pre-checked (the people the agent named). */
export function inviteSendInitial(payload?: Record<string, unknown> | null): InviteSendPicks {
  const sel = (payload as any)?.selected
  return { lead_ids: Array.isArray(sel) ? sel.filter((x: unknown): x is string => typeof x === 'string') : [] }
}

/** The main button's words - always says how many get emailed. */
export function inviteSendLabel(picks: InviteSendPicks): string {
  const n = picks.lead_ids.length
  return n ? `Email ${people(n)}` : 'Check people to email'
}

const PAGE = 40
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-8 text-xs font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
const chip = (on: boolean) => `ohp-ai-press shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`

function Box({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors ${on
      ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : dim ? 'border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-800' : 'border-gray-300 dark:border-zinc-600'}`}>
      {on && <Check className="h-3 w-3" strokeWidth={4} />}
    </span>
  )
}

function Person({ r, on, onClick }: { r: Row; on: boolean; onClick: () => void }) {
  const off = !!r.why
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-disabled={off} disabled={off} onClick={onClick} data-testid="ai-invite-send-row"
      className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${off
        ? 'cursor-not-allowed border-dashed border-gray-200 bg-gray-50/70 opacity-60 dark:border-zinc-700 dark:bg-zinc-800/40'
        : on ? 'border-[#C9A24D] bg-[#fffaf0] dark:border-[#C9A24D]/70 dark:bg-[#C9A24D]/[0.08]'
          : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-zinc-700 dark:bg-zinc-900'}`}>
      <Box on={on} dim={off} />
      {/* Name gets the whole width (owner's phone, 11/01: names and tags were both cut off side by
          side); the email, then the tag and where they came from, go underneath. */}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[12.5px] font-bold leading-snug ${off ? 'text-gray-500 dark:text-zinc-400' : 'text-[#111827] dark:text-white'}`}>{r.name}</span>
        <span className="block truncate text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">
          {r.email || 'No email on file'}{r.invited && !off ? ` · Invited ${r.invited === 'before' ? 'already' : r.invited}` : ''}
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5">
          {off
            ? <span className="shrink-0 rounded-full bg-gray-200/80 px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-gray-600 dark:bg-zinc-700 dark:text-zinc-300">{r.why}</span>
            : <span className="shrink-0 rounded-full bg-[#C9A24D]/[0.12] px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-[#8b7355] ring-1 ring-[#C9A24D]/30 dark:text-[#e8c97a]">{r.tag}</span>}
          {!off && r.sub && <span className="min-w-0 truncate text-[10px] font-semibold text-gray-400 dark:text-zinc-500">{r.sub}</span>}
        </span>
      </span>
    </button>
  )
}

export function InviteSendPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: InviteSendPicks; onPicks: (p: InviteSendPicks) => void }) {
  const rows = useMemo(() => ((payload.rows || []) as Row[]).filter(r => r && r.id), [payload.rows])
  const steps = useSteps(['people', 'note'])
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string>('')
  const [shown, setShown] = useState(PAGE)
  const picked = useMemo(() => new Set(picks.lead_ids), [picks.lead_ids])

  // the filter chips: only the kinds of people they actually have, with counts
  const tags = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach(r => { if (!r.why) m.set(r.tag, (m.get(r.tag) || 0) + 1) })
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [rows])
  const match = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter(r => (!tag || (r.tag === tag && !r.why))
      && words.every(w => `${r.name} ${r.email || ''} ${r.sub || ''} ${r.tag}`.toLowerCase().includes(w)))
  }, [rows, q, tag])
  const open = match.filter(r => !r.why)
  const allOn = open.length > 0 && open.every(r => picked.has(r.id))
  const greyed = rows.filter(r => r.why).length

  const set = (ids: string[]) => onPicks({ lead_ids: ids })
  const toggle = (id: string) => set(picked.has(id) ? picks.lead_ids.filter(x => x !== id) : [...picks.lead_ids, id])
  const selectShown = () => {
    if (allOn) { const off = new Set(open.map(r => r.id)); set(picks.lead_ids.filter(x => !off.has(x))) }
    else set(Array.from(new Set([...picks.lead_ids, ...open.map(r => r.id)])))
  }
  const names = rows.filter(r => picked.has(r.id)).map(r => r.name)
  const summary = names.length ? (names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')) : 'Nobody yet'
  const n = picks.lead_ids.length

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-invite-send-pick">
      {/* the invite going out */}
      <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-[#1b1a17] via-[#2a2218] to-[#111827] px-3 py-2.5 ring-1 ring-[#C9A24D]/40">
        <PartyPopper className="h-4 w-4 shrink-0 text-[#e8c97a]" strokeWidth={2.2} />
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] font-black uppercase tracking-[0.18em] text-[#C9A24D]">Your invite</span>
          <span className="block truncate font-serif text-[14px] font-black leading-tight text-white">{payload.invite_title || 'Invite'}</span>
          {payload.when && <span className="block truncate text-[10.5px] font-semibold text-white/60">{payload.when}</span>}
        </span>
      </div>

      <CardStep id="people" n={1} title="Who gets it" summary={summary} steps={steps}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); setShown(PAGE) }} placeholder="Search name, email or home" className={inputCls}
            aria-label="Search your leads" data-testid="ai-invite-send-search" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {tags.length > 1 && (
          <div className="-mx-0.5 mt-1.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none]">
            <button type="button" onClick={() => { setTag(''); setShown(PAGE) }} className={chip(!tag)}>Everyone</button>
            {tags.map(([t, c]) => (
              <button key={t} type="button" onClick={() => { setTag(tag === t ? '' : t); setShown(PAGE) }} className={chip(tag === t)}>{t} · {c}</button>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <button type="button" role="checkbox" aria-checked={allOn} onClick={selectShown} disabled={!open.length} data-testid="ai-invite-send-all"
            className="ohp-ai-press inline-flex items-center gap-2 rounded-lg py-1 pr-2 text-[11.5px] font-black text-[#111827] disabled:opacity-40 dark:text-white">
            <Box on={allOn} /> Select all shown{open.length ? ` (${open.length})` : ''}
          </button>
          {n > 0 && (
            <button type="button" onClick={() => set([])} className="ml-auto text-[11px] font-bold text-gray-500 underline-offset-2 hover:underline dark:text-zinc-400">Clear</button>
          )}
        </div>
        <div className={`mt-1.5 max-h-[320px] overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[420px] ${OPTION_GRID}`} data-testid="ai-invite-send-list">
          {match.slice(0, shown).map(r => <Person key={r.id} r={r} on={picked.has(r.id)} onClick={() => toggle(r.id)} />)}
          {match.length > shown && (
            <button type="button" onClick={() => setShown(s => s + PAGE)}
              className="ohp-ai-press w-full rounded-xl border border-dashed border-[#C9A24D]/50 py-2 text-[11.5px] font-black text-[#8b7355] dark:text-[#C9A24D]">
              Show {Math.min(PAGE, match.length - shown)} more of {match.length - shown}
            </button>
          )}
          {!match.length && <p className="py-3 text-center text-[11.5px] font-semibold text-gray-500 dark:text-zinc-400">Nobody matches that.</p>}
        </div>
        {greyed > 0 && <p className="mt-1.5 text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{people(greyed)} greyed out can&apos;t get it (no email, unsubscribed or already answered).</p>}
        <div className="mt-2.5"><StepDone onDone={() => steps.done('people')} /></div>
      </CardStep>

      <CardStep id="note" n={2} title="What they get" summary="A note from you + RSVP link" steps={steps}>
        <div className="space-y-1 rounded-lg bg-[#faf7f0] p-2.5 text-[11.5px] leading-snug text-gray-700 dark:bg-zinc-800 dark:text-zinc-300">
          <p><span className="font-black text-[#8b7355] dark:text-[#C9A24D]">From</span> {String(payload.from || 'you').replace(/^from /, '')}</p>
          <p><span className="font-black text-[#8b7355] dark:text-[#C9A24D]">Subject</span> {payload.invite_title}</p>
          <p>A short note with the day, time and place, and a button to RSVP. Their answers show on the invite and in your Leads.</p>
        </div>
        <div className="mt-2.5"><StepDone onDone={() => steps.done('note')} /></div>
      </CardStep>

      {/* the count, always in view */}
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold transition-colors ${n
        ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-white text-gray-500 ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/10'}`}
        data-testid="ai-invite-send-count" aria-live="polite">
        <Mail className="h-4 w-4 shrink-0" />
        {n ? <span><span className="tabular-nums">{people(n)}</span> will get an email from you</span> : <span>Check who should get it</span>}
      </div>
    </div>
  )
}
