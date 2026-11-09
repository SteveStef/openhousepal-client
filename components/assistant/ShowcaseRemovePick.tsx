'use client'

// "Remove the homes without a first-floor bedroom from Nicole's Showcase" from the chat (owner,
// 11/08: "a nice UI in the chat where the agent can remove from the Showcase - they do the
// clicking"). Every home in the Showcase as a row - photo, street, price, beds / baths and what
// the client did with it (Loved, Commented, Tour ask) - the ones the chat suggests already
// checked. Checked rows turn red: they're the ones leaving. A search, quick filters and
// "Select all shown"; the count at the bottom and the main button always say how many go.
//
// ActionCard wiring (picker === 'showcase_remove'): picks are sent on Confirm as { property_ids: [...] }.
import { useMemo, useState } from 'react'
import { Check, Home, Search, Trash2, X } from 'lucide-react'
import { normalizeImageUrl } from '@/lib/utils'

export type ShowcaseRemovePicks = { property_ids: string[] }
type Row = { id: string; key: string; street: string; city?: string; price?: number | null; beds?: number | null; baths?: number | null; photo?: string | null; status?: string | null; tags?: string[] }

const homes = (n: number) => `${n} home${n === 1 ? '' : 's'}`

export function showcaseRemoveInitial(payload?: Record<string, unknown> | null): ShowcaseRemovePicks {
  const sel = (payload as any)?.selected
  return { property_ids: Array.isArray(sel) ? sel.filter((x: unknown): x is string => typeof x === 'string') : [] }
}

export function showcaseRemoveLabel(picks: ShowcaseRemovePicks): string {
  const n = picks.property_ids.length
  return n ? `Remove ${homes(n)}` : 'Check homes to remove'
}

const PAGE = 40
const money = (v?: number | null) => (!v || v <= 0 ? '' : v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`)
const num = (v?: number | null) => (v == null ? '' : String(Number(v)).replace(/\.0$/, ''))
const TAG: Record<string, string> = {
  Loved: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  Commented: 'bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  'Tour ask': 'bg-amber-400/20 text-amber-800 ring-amber-500/30 dark:text-amber-300',
  'You recommended': 'bg-[#C9A24D]/15 text-[#8b7355] ring-[#C9A24D]/35 dark:text-[#e8c97a]',
}
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-8 text-[16px] font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:text-xs'
const chip = (on: boolean) => `ohp-ai-press shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`

function Box({ on }: { on: boolean }) {
  return (
    <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors ${on ? 'border-rose-500 bg-rose-500 text-white' : 'border-gray-300 dark:border-zinc-600'}`}>
      {on && <Check className="h-3 w-3" strokeWidth={4} />}
    </span>
  )
}

function HomeRow({ r, on, onClick }: { r: Row; on: boolean; onClick: () => void }) {
  const [broken, setBroken] = useState(false)
  const facts = [money(r.price), r.beds ? `${num(r.beds)} bd` : '', r.baths ? `${num(r.baths)} ba` : ''].filter(Boolean).join(' · ')
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} data-testid="ai-remove-row" data-key={r.key}
      className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border p-1.5 pr-2.5 text-left transition-colors ${on
        ? 'border-rose-400 bg-rose-50 dark:border-rose-500/60 dark:bg-rose-500/[0.08]'
        : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-zinc-700 dark:bg-zinc-900'}`}>
      <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800">
        {r.photo && !broken
          ? <img src={normalizeImageUrl(r.photo)} alt="" loading="lazy" onError={() => setBroken(true)} className={`h-full w-full object-cover transition ${on ? 'opacity-60 grayscale-[40%]' : ''}`} />
          : <Home className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-gray-300" />}
        {on && <span className="absolute inset-0 grid place-items-center bg-rose-600/25"><Trash2 className="h-4 w-4 text-white drop-shadow" /></span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[12.5px] font-bold leading-snug ${on ? 'text-rose-900 line-through decoration-rose-400/70 dark:text-rose-200' : 'text-[#111827] dark:text-white'}`}>{r.street || 'Home'}</span>
        <span className="block truncate text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{[r.city, facts].filter(Boolean).join(' · ')}</span>
        {(!!r.tags?.length || r.status) && (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
            {r.status && <span className="shrink-0 rounded-full bg-gray-200/80 px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-gray-600 dark:bg-zinc-700 dark:text-zinc-300">{r.status}</span>}
            {(r.tags || []).map(t => <span key={t} className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wide ring-1 ${TAG[t] || TAG['You recommended']}`}>{t}</span>)}
          </span>
        )}
      </span>
      <Box on={on} />
    </button>
  )
}

export function ShowcaseRemovePick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: ShowcaseRemovePicks; onPicks: (p: ShowcaseRemovePicks) => void }) {
  const rows = useMemo(() => ((payload.homes || []) as Row[]).filter(r => r && r.id), [payload.homes])
  const [q, setQ] = useState('')
  const [view, setView] = useState<'all' | 'checked' | 'touched' | 'off'>('all')
  const [shown, setShown] = useState(PAGE)
  const picked = useMemo(() => new Set(picks.property_ids), [picks.property_ids])
  const touched = (r: Row) => (r.tags || []).some(t => t === 'Loved' || t === 'Commented' || t === 'Tour ask')
  const counts = { all: rows.length, checked: picked.size, touched: rows.filter(touched).length, off: rows.filter(r => r.status).length }
  const match = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter(r => (view === 'all' || (view === 'checked' ? picked.has(r.id) : view === 'touched' ? touched(r) : !!r.status))
      && words.every(w => `${r.street} ${r.city || ''} ${(r.tags || []).join(' ')} ${r.status || ''}`.toLowerCase().includes(w)))
  }, [rows, q, view, picked])
  const allOn = match.length > 0 && match.every(r => picked.has(r.id))
  const set = (ids: string[]) => onPicks({ property_ids: ids })
  const toggle = (id: string) => set(picked.has(id) ? picks.property_ids.filter(x => x !== id) : [...picks.property_ids, id])
  const selectShown = () => {
    if (allOn) { const off = new Set(match.map(r => r.id)); set(picks.property_ids.filter(x => !off.has(x))) }
    else set(Array.from(new Set([...picks.property_ids, ...match.map(r => r.id)])))
  }
  const n = picks.property_ids.length
  const left = rows.length - n
  const client = String(payload.client || '') || 'their'
  const goingTouched = rows.filter(r => picked.has(r.id) && touched(r)).length
  const views: [typeof view, string, number][] = [['all', 'All', counts.all], ['checked', 'Checked', counts.checked], ['touched', 'Loved / commented', counts.touched], ['off', 'Off the market', counts.off]]

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-remove-pick">
      <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-[#1b1a17] via-[#2a2218] to-[#111827] px-3 py-2.5 ring-1 ring-[#C9A24D]/40">
        <Home className="h-4 w-4 shrink-0 text-[#e8c97a]" strokeWidth={2.2} />
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] font-black uppercase tracking-[0.18em] text-[#C9A24D]">Showcase</span>
          <span className="block truncate font-serif text-[14px] font-black leading-tight text-white">{payload.name || 'Showcase'}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-black tabular-nums text-white/85">{homes(rows.length)}</span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => { setQ(e.target.value); setShown(PAGE) }} placeholder="Search street or town" className={inputCls}
          aria-label="Search the homes" data-testid="ai-remove-search" />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none]">
        {views.filter(([k, , c]) => k === 'all' || c > 0 || k === view).map(([k, label, c]) => (
          <button key={k} type="button" onClick={() => { setView(k); setShown(PAGE) }} className={chip(view === k)} data-testid={`ai-remove-view-${k}`}>{label} · {c}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" role="checkbox" aria-checked={allOn} onClick={selectShown} disabled={!match.length} data-testid="ai-remove-all"
          className="ohp-ai-press inline-flex items-center gap-2 rounded-lg py-1 pr-2 text-[11.5px] font-black text-[#111827] disabled:opacity-40 dark:text-white">
          <Box on={allOn} /> {allOn ? 'Uncheck' : 'Check'} all shown{match.length ? ` (${match.length})` : ''}
        </button>
        {n > 0 && <button type="button" onClick={() => set([])} className="ml-auto text-[11px] font-bold text-gray-500 underline-offset-2 hover:underline dark:text-zinc-400">Uncheck all</button>}
      </div>
      <div className="grid max-h-[340px] gap-1.5 overflow-y-auto overscroll-contain pr-0.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr))] sm:max-h-[440px]" data-testid="ai-remove-list">
        {match.slice(0, shown).map(r => <HomeRow key={r.id} r={r} on={picked.has(r.id)} onClick={() => toggle(r.id)} />)}
        {match.length > shown && (
          <button type="button" onClick={() => setShown(s => s + PAGE)}
            className="ohp-ai-press w-full rounded-xl border border-dashed border-[#C9A24D]/50 py-2 text-[11.5px] font-black text-[#8b7355] dark:text-[#C9A24D]">
            Show {Math.min(PAGE, match.length - shown)} more of {match.length - shown}
          </button>
        )}
        {!match.length && <p className="py-3 text-center text-[11.5px] font-semibold text-gray-500 dark:text-zinc-400">{view === 'checked' ? 'Nothing checked yet.' : 'No home matches that.'}</p>}
      </div>
      {goingTouched > 0 && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid="ai-remove-touched">
          {homes(goingTouched)} you checked {goingTouched === 1 ? 'is one' : 'are ones'} {client === 'their' ? 'they' : client} loved, commented on or asked to tour.
        </p>
      )}
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold transition-colors ${n
        ? 'bg-rose-600 text-white' : 'bg-white text-gray-500 ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-white/10'}`}
        data-testid="ai-remove-count" aria-live="polite">
        <Trash2 className="h-4 w-4 shrink-0" />
        {n ? <span><span className="tabular-nums">{homes(n)}</span> leave{n === 1 ? 's' : ''} {client === 'their' ? 'their' : `${client}'s`} Showcase · <span className="tabular-nums">{left}</span> stay</span> : <span>Check the homes to remove</span>}
      </div>
    </div>
  )
}
