'use client'

// Setup's "The towns you serve" picker - the same served-areas API the website editor's AreasPanel
// uses (shared town records, researched once), made obvious for someone who's never done this:
// towns from their own recent sales to tap, a search where every suggestion has a clear "Select"
// button, and the picked towns listed right underneath with Remove. A town shows up the instant
// it's tapped (the server confirms behind it); research runs in the background with its own
// progress, so nothing here waits on it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Home, Loader2, MapPin, Plus, Search, Sparkles, X } from 'lucide-react'
import api from '@/lib/api-service'
import type { AgentMarketArea } from '@/types'
import type { AgentSale } from '@/lib/agentSales'
import { inputCls } from './SetupUi'
import { PopupPortal, useAnchoredStyle } from '@/components/ui/AnchoredPopup'

const MAX = 15
const RESEARCH_STEPS = ['Finding the schools', 'Pulling home prices', 'Mapping parks & shops', 'Writing your town page']

type Row = { key: string; linkId?: string; name: string; state: string; status: string; neighborhood?: boolean; parent?: string | null }

// Saves still on their way to the server. A tap shows the town as added at once (owner, 10/22) -
// the save runs in the background and keeps going if they move on; Continue waits briefly for it.
const pendingSaves = new Set<Promise<unknown>>()
export async function waitForTownSaves(ms: number) {
  if (!pendingSaves.size) return
  await Promise.race([Promise.allSettled(Array.from(pendingSaves)), new Promise(r => window.setTimeout(r, ms))])
}

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const keyOf = (name: string, state: string) => `${name.trim().toLowerCase()}|${state.trim().toUpperCase()}`
const splitCity = (raw: string) => { const [c, s] = raw.split(',').map(x => x.trim()); return { name: title(c || ''), state: (s || '').toUpperCase() } }

export default function TownPicker({ idx = true }: { idx?: boolean }) {
  const [areas, setAreas] = useState<AgentMarketArea[] | null>(null)
  const [adding, setAdding] = useState<Row[]>([])
  const [sales, setSales] = useState<AgentSale[]>([])
  const [mode, setMode] = useState<'city' | 'neighborhood'>('city')
  const [q, setQ] = useState('')
  const [hoodState, setHoodState] = useState('PA')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // The suggestions float on top of the page under the search row - inside the setup card they
  // were cut off at the card's bottom edge (owner, 10/26).
  const rowRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listOpen = mode === 'city' && open && suggestions.length > 0
  const listStyle = useAnchoredStyle(rowRef, listRef, listOpen, { maxHeight: 460, gap: 8 })

  const load =useCallback(() => api.sites.getAreas(true).then(r => { if (r.success && r.data) setAreas(r.data) }), [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.agentHub.getMine().then(r => { const c = r.success ? r.data?.config : null; if (Array.isArray(c?.recentSales)) setSales(c.recentSales) })
  }, [])

  const rows: Row[] = useMemo(() => {
    const real: Row[] = (areas || []).map(l => ({
      key: keyOf(l.area.name, l.area.state), linkId: l.id, name: l.area.name, state: l.area.state, status: l.area.enrichment_status,
      neighborhood: l.area.area_type === 'neighborhood', parent: l.area.parent_area_name,
    }))
    const have = new Set(real.map(r => r.key))
    return [...adding.filter(a => !have.has(a.key)), ...real]
  }, [areas, adding])
  const picked = new Set(rows.map(r => r.key))
  const full = rows.length >= MAX

  // research runs in the background - check on it until every town is ready
  const researching = rows.some(r => r.status === 'PENDING' || r.status === 'RESEARCHING')
  useEffect(() => {
    if (!researching) return
    const t = window.setInterval(load, 4000)
    return () => window.clearInterval(t)
  }, [researching, load])

  // towns from their own sales (most sales first), not already picked
  const fromSales = useMemo(() => {
    const count = new Map<string, { name: string; state: string; n: number }>()
    for (const s of sales) {
      if (!s?.city || !s?.state) continue
      const name = title(s.city.trim()), state = s.state.trim().toUpperCase().slice(0, 2)
      const k = keyOf(name, state)
      const cur = count.get(k) || { name, state, n: 0 }
      cur.n += 1
      count.set(k, cur)
    }
    return Array.from(count.entries()).filter(([k]) => !picked.has(k)).map(([, v]) => v).sort((a, b) => b.n - a.n).slice(0, 8)
  }, [sales, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'city') { setSuggestions([]); return }
    const query = q.trim()
    if (query.length < 2) { setSuggestions([]); return }
    setSearching(true)
    const t = window.setTimeout(() => {
      api.properties.cities(query).then(r => {
        setSearching(false)
        if (r.success && r.data) { setSuggestions(r.data.results.slice(0, 8)); setActive(0) }
      })
    }, 250)
    return () => window.clearTimeout(t)
  }, [q, mode])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const add = async (name: string, state: string, kind: 'city' | 'neighborhood' = 'city') => {
    setError('')
    const k = keyOf(name, state)
    if (picked.has(k)) { setError(`${name} is already on your list.`); return }
    if (full) { setError(`You can pick up to ${MAX} - remove one to add another.`); return }
    if (!name.trim() || state.trim().length !== 2) { setError('Type the name and the 2-letter state (like PA).'); return }
    setAdding(a => [{ key: k, name, state, status: 'ADDING', neighborhood: kind === 'neighborhood' }, ...a])
    setQ(''); setSuggestions([]); setOpen(false)
    // Not awaited by the tap: the town is already shown as added; the save (and the town's research
    // on the server) carries on even if they leave this step.
    const save = api.sites.addArea(name.trim(), state.trim().toUpperCase(), kind).then(async r => {
      if (r.success) await load()
      else setError(r.error || `We couldn't add ${name} - please try again.`)
      setAdding(a => a.filter(x => x.key !== k))
    })
    pendingSaves.add(save)
    save.finally(() => pendingSaves.delete(save))
  }

  const remove = async (row: Row) => {
    if (!row.linkId) return
    setConfirmId(null)
    setAreas(a => (a || []).filter(x => x.id !== row.linkId))
    const r = await api.sites.removeArea(row.linkId)
    if (!r.success) { setError(`We couldn't remove ${row.name} - please try again.`); load() }
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mode !== 'city') { if (e.key === 'Enter') { e.preventDefault(); add(title(q.trim()), hoodState, 'neighborhood') } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && suggestions[active]) { e.preventDefault(); const c = splitCity(suggestions[active]); add(c.name, c.state) }
    else if (e.key === 'Escape') setOpen(false)
  }

  if (!areas) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const pct = Math.min(100, (rows.length / MAX) * 100)

  return (
    <div className="space-y-7">
      {idx && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-[#f7f3ea] px-4 py-3 text-[14px] font-semibold text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" />
          <span><b className="text-[#111827] dark:text-white">Tap a town and it&apos;s on your website.</b> You&apos;ll also find them in your website editor&apos;s Areas tab.</span>
        </p>
      )}
      {/* how many - big and obvious */}
      <div className="rounded-[22px] border-2 border-[#C9A24D]/35 bg-gradient-to-br from-[#fffaf0] to-white p-5 dark:from-[#1d1912] dark:to-[#141416]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="font-serif text-[26px] font-black leading-none text-[#111827] dark:text-white">
            {rows.length} <span className="text-[18px] text-gray-400">of {MAX}</span> <span className="text-[19px]">towns picked</span>
          </p>
          <p className="text-[13px] font-bold text-gray-500 dark:text-gray-400">{full ? 'That’s the most you can pick.' : rows.length ? `You can add ${MAX - rows.length} more.` : 'Pick the towns you sell in.'}</p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#C9A24D]/15">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#e8c97a]" initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 140, damping: 22 }} />
        </div>
      </div>

      {/* from their own sales */}
      {fromSales.length > 0 && !full && (
        <div>
          <p className="flex items-center gap-2 text-[15px] font-black text-[#111827] dark:text-white"><Home className="h-4 w-4 text-[#C9A24D]" /> Towns from your recent sales</p>
          <p className="mt-0.5 text-[13.5px] font-medium text-gray-500 dark:text-gray-400">Tap one to add it.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {fromSales.map(t => (
              <motion.button key={keyOf(t.name, t.state)} layout type="button" onClick={() => add(t.name, t.state)} whileTap={{ scale: 0.96 }}
                className="group inline-flex items-center gap-2 rounded-full border-2 border-[#C9A24D]/40 bg-white py-2 pl-3 pr-2 text-[14.5px] font-black text-[#111827] transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:shadow-[0_12px_24px_-16px_rgba(139,106,43,.8)] dark:bg-[#141416] dark:text-white">
                <MapPin className="h-4 w-4 text-[#C9A24D]" />
                {t.name}, {t.state}
                <span className="text-[12px] font-bold text-gray-400">{t.n} sale{t.n === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white transition group-hover:bg-[#C9A24D] group-hover:text-[#111827] dark:bg-white dark:text-[#111827]"><Plus className="h-3 w-3" strokeWidth={3} /> Add</span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* search */}
      <div>
        <div className="mb-3 inline-flex rounded-2xl bg-[#f3eee3] p-1 dark:bg-white/[0.05]">
          {(['city', 'neighborhood'] as const).map(m => (
            <button key={m} type="button" onClick={() => { setMode(m); setQ(''); setError(''); setSuggestions([]) }} aria-pressed={mode === m}
              className={`rounded-xl px-4 py-2 text-[14px] font-black transition ${mode === m ? 'bg-white text-[#111827] shadow-sm dark:bg-[#1c1c1f] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
              {m === 'city' ? 'A town or city' : 'A neighborhood'}
            </button>
          ))}
        </div>
        {mode === 'neighborhood' && <p className="mb-2.5 text-[13.5px] font-medium text-gray-500 dark:text-gray-400">For a named area that isn&apos;t its own town - like Rittenhouse Square, Main Line or Fishtown.</p>}
        <div ref={boxRef} className="relative">
          <div ref={rowRef} className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#C9A24D]" />
              <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); setError('') }} onFocus={() => setOpen(true)} onKeyDown={onKey}
                disabled={full} autoComplete="off" aria-label={mode === 'city' ? 'Search for a town' : 'Neighborhood name'}
                placeholder={full ? 'Remove a town to add another' : mode === 'city' ? 'Start typing a town…' : 'Neighborhood name'}
                className={`${inputCls} !pl-14`} />
              {searching && <Loader2 className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#C9A24D]" />}
            </div>
            {mode === 'neighborhood' && (
              <>
                <input value={hoodState} onChange={e => setHoodState(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} aria-label="State" className={`${inputCls} !w-20 text-center uppercase`} />
                <button type="button" disabled={full || !q.trim()} onClick={() => add(title(q.trim()), hoodState, 'neighborhood')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#111827] px-6 text-[15px] font-black text-white transition hover:-translate-y-0.5 disabled:opacity-40 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
                  <Plus className="h-4 w-4" strokeWidth={3} /> Add
                </button>
              </>
            )}
          </div>
          <PopupPortal from={boxRef}>
          <AnimatePresence>
            {listOpen && (
              <motion.ul ref={listRef} style={listStyle} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
                role="listbox" className="overflow-y-auto overscroll-contain rounded-[20px] border-2 border-[#ece5d6] bg-white p-1.5 shadow-[0_30px_60px_-30px_rgba(17,24,39,.55)] dark:border-white/10 dark:bg-[#17171a]">
                {suggestions.map((raw, i) => {
                  const c = splitCity(raw)
                  const already = picked.has(keyOf(c.name, c.state))
                  return (
                    <li key={raw} role="option" aria-selected={i === active}>
                      <button type="button" disabled={already} onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); if (!already) add(c.name, c.state) }}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${i === active && !already ? 'bg-[#C9A24D]/15' : ''} disabled:cursor-default`}>
                        <MapPin className="h-[18px] w-[18px] shrink-0 text-[#C9A24D]" />
                        <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-[#111827] dark:text-white">{c.name}<span className="text-gray-400">, {c.state}</span></span>
                        {already
                          ? <span className="inline-flex items-center gap-1 text-[12px] font-black text-emerald-600"><Check className="h-4 w-4" /> Picked</span>
                          : <span className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-black uppercase tracking-wide transition ${i === active ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>Select</span>}
                      </button>
                    </li>
                  )
                })}
              </motion.ul>
            )}
          </AnimatePresence>
          </PopupPortal>
          {mode === 'city' && open && q.trim().length >= 2 && !searching && suggestions.length === 0 && (
            <p className="mt-2 text-[13.5px] font-semibold text-gray-500">No town by that name in the MLS yet - check the spelling, or add it as a neighborhood.</p>
          )}
        </div>
        {error && <p className="mt-2.5 text-[14px] font-bold text-rose-600">{error}</p>}
      </div>

      {/* what they picked */}
      <div>
        <p className="text-[15px] font-black text-[#111827] dark:text-white">Your towns</p>
        {rows.length === 0 ? (
          <p className="mt-2 rounded-2xl border-2 border-dashed border-[#e7dfcf] px-5 py-6 text-center text-[14.5px] font-semibold text-gray-400 dark:border-white/10">Nothing picked yet - the towns you add show up here.</p>
        ) : (
          <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {rows.map(r => (
                <motion.li key={r.key} layout initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}>
                  <TownCard idx={idx} row={r} confirming={confirmId === r.key} onAskRemove={() => setConfirmId(r.key)} onKeep={() => setConfirmId(null)} onRemove={() => remove(r)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {researching && (
          <p className="mt-3 flex items-center gap-2 text-[13.5px] font-medium text-gray-500 dark:text-gray-400"><Sparkles className="h-4 w-4 shrink-0 text-[#C9A24D]" /> {idx ? 'We’re gathering each new town’s schools, prices and places for its page. ' : 'We’re gathering each new town’s details. '}You can keep going or leave - it finishes by itself.</p>
        )}
      </div>
    </div>
  )
}

function TownCard({ idx, row, confirming, onAskRemove, onKeep, onRemove }: { idx: boolean; row: Row; confirming: boolean; onAskRemove: () => void; onKeep: () => void; onRemove: () => void }) {
  const busy = row.status === 'PENDING' || row.status === 'RESEARCHING'
  const justAdded = row.status === 'ADDING'
  const ready = row.status === 'ENRICHED' || row.status === 'PARTIAL'
  const failed = row.status === 'FAILED'
  const [stepIx, setStepIx] = useState(0)
  useEffect(() => {
    if (!busy) return
    const t = window.setInterval(() => setStepIx(i => (i + 1) % RESEARCH_STEPS.length), 2200)
    return () => window.clearInterval(t)
  }, [busy, row.status])
  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 px-4 py-3.5 transition ${ready ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/25 dark:bg-emerald-500/[0.07]' : failed ? 'border-rose-200 bg-rose-50/50 dark:border-rose-500/25 dark:bg-rose-500/[0.07]' : 'border-[#C9A24D]/40 bg-[#fffaf0] dark:bg-[#1a1712]'}`}>
      {(busy || justAdded) && <span aria-hidden className="ohp-town-sweep pointer-events-none absolute inset-0" />}
      <div className="relative flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ready ? 'bg-emerald-600 text-white' : failed ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15' : 'bg-[#C9A24D] text-[#111827]'}`}>
          {failed ? <MapPin className="h-5 w-5" /> : <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}><Check className="h-5 w-5" strokeWidth={3} /></motion.span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-black text-[#111827] dark:text-white">{row.name}{row.parent ? <span className="font-bold text-gray-400">, {row.parent}</span> : null}<span className="font-bold text-gray-400">, {row.state}</span></p>
          <div className="relative h-[18px] overflow-hidden text-[12.5px] font-bold">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={justAdded ? 'adding' : busy ? `r${stepIx}` : row.status} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.25 }}
                className={ready ? 'text-emerald-700 dark:text-emerald-300' : failed ? 'text-rose-600' : 'text-[#8b6a2b] dark:text-[#e8c97a]'}>
                {justAdded ? 'Added - getting its details…' : busy ? `Added · ${RESEARCH_STEPS[stepIx].toLowerCase()}…` : ready ? `Ready${idx ? ' - town page made' : ''}${row.neighborhood ? ' · neighborhood' : ''}` : failed ? (idx ? 'We couldn’t research this one - it still shows on your site' : 'Added - we couldn’t get its details') : 'Added'}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        {row.linkId && !confirming && (
          <button type="button" onClick={onAskRemove} aria-label={`Remove ${row.name}`} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-black text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
            <X className="h-4 w-4" /> Remove
          </button>
        )}
      </div>
      <AnimatePresence>
        {confirming && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden">
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3 dark:border-white/10">
              <span className="flex-1 text-[13px] font-bold text-gray-600 dark:text-gray-300">{idx ? `Take ${row.name} off your website?` : `Remove ${row.name}?`}</span>
              <button type="button" onClick={onKeep} className="rounded-full px-3 py-1.5 text-[13px] font-black text-gray-600 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/5">Keep it</button>
              <button type="button" onClick={onRemove} className="rounded-full bg-rose-600 px-3.5 py-1.5 text-[13px] font-black text-white hover:bg-rose-700">Yes, remove</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`.ohp-town-sweep{background:linear-gradient(100deg,transparent 20%,rgba(232,201,122,.28) 45%,rgba(255,255,255,.35) 50%,rgba(232,201,122,.28) 55%,transparent 80%);background-size:250% 100%;animation:ohpTownSweep 2.2s ease-in-out infinite}@keyframes ohpTownSweep{0%{background-position:120% 0}100%{background-position:-120% 0}}@media (prefers-reduced-motion:reduce){.ohp-town-sweep{animation:none;opacity:.4}}`}</style>
    </div>
  )
}
