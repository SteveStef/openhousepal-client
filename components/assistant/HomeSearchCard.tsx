'use client'

// The chat's Home search card (owner, 11/08): "find homes for sale in Exton with a first-floor primary
// bedroom" never reads a whole town on its own. The chat fills the boxes it can from the question; the
// agent finishes the required ones - a town / zip or school district, the least bedrooms, the least
// size - and watches how many homes fit and how much of their AI usage reading them takes, as they
// type (that count is a plain database count: free). Search opens at 300 homes or fewer and only when
// their AI usage has room; then the AI reads every listing and the matches show here with the words
// that show it, "maybe" ones greyed after. The results stay on the card when the chat is opened again.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Home, Loader2, MapPin, Pencil, Search, Sparkles, X } from 'lucide-react'
import api from '@/lib/api-service'
import { normalizeImageUrl } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import Highlight from './Highlight'
import ChatPager, { listNav } from './ChatPager'
import PropertyQuickViewModal from '@/components/PropertyQuickViewModal'
import type { HomeMove } from '@/components/PropertyDetailsModal'

type Filters = { town?: string; district?: string; min_beds?: number | null; min_sqft?: number | null; min_price?: number | null; max_price?: number | null; question?: string }
type Hit = { id: string; key: string; street: string; city?: string; state?: string; price?: number | null; beds?: number | null; baths?: number | null
  sqft?: number | null; photo?: string | null; v: 'yes' | 'maybe'; quote?: string; src?: string; why?: string }
type Result = { homes: Hit[]; yes: number; maybe: number; read: number; failed?: number; used_percent?: number; filters?: Filters }
export type HomeSearchRef = { record_id: string; filters: Filters; count?: number; result?: Result | null }
type Count = { count: number; cap: number; missing: string[]; usage_percent: number; left_percent: number | null; enough: boolean; ready: boolean }
type Place = { kind: 'town' | 'district'; value: string; label: string; count: number }

const BEDS = [1, 2, 3, 4, 5]
const SIZES = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000]
const PAGE = 6
const money = (v?: number | null) => (!v || v <= 0 ? '' : v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`)
const num = (v?: number | null) => String(Number(v)).replace(/\.0$/, '')
const pct = (p?: number | null) => (p == null ? '' : p < 0.1 ? 'under 0.1%' : `about ${p}%`)
const tidy = (s: string) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
const chip = (on: boolean) => `ohp-ai-press shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-bold tabular-nums transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`
const input = 'w-full rounded-xl border bg-white py-2 text-[16px] font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:bg-zinc-900 dark:text-zinc-100 sm:text-xs'
const label = 'mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 dark:text-zinc-400'
const need = <span className="rounded-full bg-amber-400/20 px-1.5 py-px text-[8.5px] font-black tracking-wide text-amber-800 dark:text-amber-300">Required</span>

function Tile({ h, onOpen }: { h: Hit; onOpen: () => void }) {
  const [broken, setBroken] = useState(false)
  const maybe = h.v === 'maybe'
  const facts = [money(h.price), h.beds ? `${num(h.beds)} bd` : '', h.baths ? `${num(h.baths)} ba` : '', h.sqft ? `${Math.round(h.sqft).toLocaleString()} sqft` : ''].filter(Boolean).join(' · ')
  return (
    <button type="button" onClick={onOpen} data-testid="ai-hs-tile" data-key={h.key} data-v={h.v}
      className={`ohp-ai-press block w-full min-w-0 rounded-xl border p-1.5 text-left transition-colors ${maybe ? 'border-gray-200 bg-gray-50/70 dark:border-zinc-700 dark:bg-zinc-900/60' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900'}`}>
      <span className="flex items-center gap-2.5">
        <span className={`relative h-[58px] w-[76px] shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800 ${maybe ? 'opacity-70' : ''}`}>
          {h.photo && !broken
            ? <img src={normalizeImageUrl(h.photo)} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
            : <Home className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-gray-300" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">{h.street || 'Home'}</span>
          <span className="block truncate text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{[h.city, facts].filter(Boolean).join(' · ')}</span>
          {maybe && <span className="mt-1 inline-block rounded-full bg-gray-200/80 px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-gray-600 dark:bg-zinc-700 dark:text-zinc-300">Maybe</span>}
        </span>
      </span>
      {(h.quote || h.why) && (
        <span className={`mt-1.5 block border-l-2 pl-2 text-[11px] font-medium leading-snug ${maybe ? 'border-gray-300 text-gray-500 dark:border-zinc-600 dark:text-zinc-400' : 'border-[#C9A24D] text-gray-600 dark:text-zinc-300'}`} data-testid="ai-hs-why">
          {h.quote ? <span className="line-clamp-2 italic">{h.src === 'MLS' ? 'MLS: ' : ''}&ldquo;<Highlight text={h.quote} dim={maybe} />&rdquo;</span> : null}
          {h.why && <span className="mt-0.5 block text-[10.5px] font-bold not-italic text-gray-500 dark:text-zinc-400">{h.why}</span>}
        </span>
      )}
    </button>
  )
}

export default function HomeSearchCard({ card, messageId }: { card: HomeSearchRef; messageId: string }) {
  const { user } = useAuth()
  const [f, setF] = useState<Filters>(card.result?.filters || card.filters || {})
  const [placeText, setPlaceText] = useState(card.filters?.district ? tidy(card.filters.district) : card.filters?.town || '')
  const [places, setPlaces] = useState<Place[]>([])
  const [placeOpen, setPlaceOpen] = useState(false)
  const [cnt, setCnt] = useState<Count | null>(null)
  const [counting, setCounting] = useState(false)
  const [result, setResult] = useState<Result | null>(card.result || null)
  const [editing, setEditing] = useState(!card.result)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'yes' | 'maybe'>('yes')
  const [page, setPage] = useState(0)
  // a home opens over the chat (owner, 11/09: never off the chat), Next / Previous through the list
  const [viewing, setViewing] = useState<string | null>(null)
  const [move, setMove] = useState<HomeMove | null>(null)
  const seq = useRef(0)
  const set = (patch: Partial<Filters>) => setF(x => ({ ...x, ...patch }))
  const filters = useMemo(() => ({ town: f.town || '', district: f.district || '', min_beds: f.min_beds || null, min_sqft: f.min_sqft || null,
    min_price: f.min_price || null, max_price: f.max_price || null, question: f.question || '' }), [f])

  // The live count - a database count, no AI, so it can run on every change.
  useEffect(() => {
    if (!editing) return
    const n = ++seq.current
    setCounting(true)
    const t = window.setTimeout(async () => {
      const r = await api.ai.homeSearchCount(filters)
      if (n !== seq.current) return
      setCounting(false)
      if (r.success && r.data) setCnt(r.data)
    }, 320)
    return () => window.clearTimeout(t)
  }, [filters, editing])

  // Place suggestions as they type.
  useEffect(() => {
    const q = placeText.trim()
    if (!placeOpen || q.length < 2) { setPlaces([]); return }
    const t = window.setTimeout(async () => {
      const r = await api.ai.homeSearchPlaces(q)
      if (r.success && r.data) setPlaces(r.data.places)
    }, 220)
    return () => window.clearTimeout(t)
  }, [placeText, placeOpen])

  const run = async () => {
    setErr(null); setRunning(true)
    const r = await api.ai.homeSearchRun(messageId, card.record_id, filters)
    setRunning(false)
    if (!r.success || !r.data) { setErr(r.error || "Couldn't search just now - try again."); return }
    setResult(r.data as Result); setEditing(false); setTab((r.data as Result).yes ? 'yes' : 'maybe'); setPage(0)
  }

  const missing = new Set(cnt?.missing || [])
  const placeLabel = f.district ? `${tidy(f.district)} school district` : f.town || ''
  const list = (result?.homes || []).filter(h => h.v === tab)
  const n = cnt?.count ?? 0

  let status: { tone: 'ok' | 'warn' | 'bad' | 'idle'; text: string } = { tone: 'idle', text: 'Pick a town, zip or school district to see how many homes fit.' }
  if (cnt && !missing.has('place')) {
    if (!n) status = { tone: 'warn', text: 'No homes for sale fit these boxes - widen them a little.' }
    else if (n > cnt.cap) status = { tone: 'warn', text: `Too many to read - narrow it to ${cnt.cap} or fewer: more bedrooms, a bigger size or a price range.` }
    else if (!cnt.enough) status = { tone: 'bad', text: `Not enough AI usage left: reading them takes ${pct(cnt.usage_percent)} and ${pct(cnt.left_percent)} is left this month. It resets on your billing day, or a bigger plan has more.` }
    // One line, even on a small phone (owner, 11/08)
    else status = { tone: 'ok', text: `Uses ${pct(cnt.usage_percent).replace('about ', '~')} of AI usage${cnt.left_percent != null ? ` · ${cnt.left_percent}% left` : ''}` }
  }
  const canRun = !!cnt?.ready && !counting && !running

  return (
    <div className="ohp-ai-card-in mt-2 w-full rounded-2xl border border-[#C9A24D]/40 bg-white p-2.5 text-left shadow-sm dark:border-[#C9A24D]/30 dark:bg-zinc-900 chatwide:p-3" data-testid="ai-hs-card">
      <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-[#1b1a17] via-[#2a2218] to-[#111827] px-3 py-2.5 ring-1 ring-[#C9A24D]/40">
        <Search className="h-4 w-4 shrink-0 text-[#e8c97a]" strokeWidth={2.4} />
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] font-black uppercase tracking-[0.18em] text-[#C9A24D]">Home search</span>
          <span className="block truncate font-serif text-[14px] font-black leading-tight text-white">{f.question || 'Homes for sale'}</span>
        </span>
        {result && !editing && (
          <span className="shrink-0 text-right">
            <span className="block text-[10.5px] font-black tabular-nums text-white/85" data-testid="ai-hs-summary">{result.yes} match{result.yes === 1 ? '' : 'es'}</span>
            <span className="block text-[10px] font-bold tabular-nums text-[#e8c97a]">{result.read} read{result.maybe ? ` · ${result.maybe} maybe` : ''}</span>
          </span>
        )}
      </div>

      {editing ? (
        <div className="mt-2.5 grid gap-3 [grid-template-columns:minmax(0,1fr)]">
          <div>
            <p className={label}>Looking for {missing.has('question') && need}</p>
            <input value={f.question || ''} onChange={e => set({ question: e.target.value })} placeholder="A first-floor primary bedroom" data-testid="ai-hs-question"
              className={`${input} px-3 ${missing.has('question') ? 'border-amber-400' : 'border-gray-200 dark:border-zinc-700'}`} />
          </div>

          <div className="relative">
            <p className={label}><MapPin className="h-3 w-3" /> Town, zip or school district {missing.has('place') && need}</p>
            {placeLabel && !placeOpen ? (
              <button type="button" onClick={() => { setPlaceOpen(true); setPlaceText('') }} data-testid="ai-hs-place-chip"
                className="ohp-ai-press inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#C9A24D]/60 bg-[#fffaf0] py-1.5 pl-3 pr-2 text-[12px] font-bold text-[#111827] dark:bg-[#C9A24D]/10 dark:text-white">
                <span className="truncate">{placeLabel}</span>
                <X className="h-3.5 w-3.5 shrink-0 text-gray-500" onClick={e => { e.stopPropagation(); set({ town: '', district: '' }); setPlaceText(''); setPlaceOpen(true) }} />
              </button>
            ) : (
              <>
                <input value={placeText} autoFocus={placeOpen} onFocus={() => setPlaceOpen(true)} data-testid="ai-hs-place"
                  onChange={e => { setPlaceText(e.target.value); set({ town: e.target.value.trim(), district: '' }) }}
                  onBlur={() => window.setTimeout(() => setPlaceOpen(false), 180)}
                  placeholder="Exton, 19341 or West Chester Area" className={`${input} px-3 ${missing.has('place') ? 'border-amber-400' : 'border-gray-200 dark:border-zinc-700'}`} />
                {placeOpen && places.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900" data-testid="ai-hs-places">
                    {places.map(p => (
                      <button key={`${p.kind}-${p.value}`} type="button" onMouseDown={e => e.preventDefault()} data-testid="ai-hs-place-opt"
                        onClick={() => { set(p.kind === 'district' ? { district: p.value, town: '' } : { town: p.value, district: '' }); setPlaceText(p.label); setPlaceOpen(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-semibold text-gray-800 hover:bg-[#fffaf0] dark:text-zinc-100 dark:hover:bg-zinc-800">
                        <span className="min-w-0 flex-1 truncate">{p.label}</span>
                        <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-gray-400">{p.count.toLocaleString()} for sale</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <p className={label}>Bedrooms, at least {missing.has('min_beds') && need}</p>
            <div className="flex flex-wrap gap-1.5">
              {BEDS.map(b => <button key={b} type="button" onClick={() => set({ min_beds: f.min_beds === b ? null : b })} className={chip(f.min_beds === b)} data-testid={`ai-hs-beds-${b}`}>{b}+</button>)}
            </div>
          </div>

          <div>
            <p className={label}>House size, at least {missing.has('min_sqft') && need}</p>
            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] chatwide:flex-wrap">
              {SIZES.map(s => <button key={s} type="button" onClick={() => set({ min_sqft: f.min_sqft === s ? null : s })} className={chip(f.min_sqft === s)} data-testid={`ai-hs-size-${s}`}>{s.toLocaleString()} sqft</button>)}
            </div>
          </div>

          <div>
            <p className={label}>Price <span className="font-bold normal-case tracking-normal text-gray-400">(optional)</span></p>
            <div className="grid grid-cols-2 gap-2">
              {(['min_price', 'max_price'] as const).map(k => (
                <div key={k} className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-gray-400">$</span>
                  <input inputMode="numeric" value={f[k] ? Number(f[k]).toLocaleString() : ''} placeholder={k === 'min_price' ? 'No min' : 'No max'} data-testid={`ai-hs-${k}`}
                    onChange={e => { const v = Number(e.target.value.replace(/[^0-9]/g, '')); set({ [k]: v || null } as Partial<Filters>) }}
                    className={`${input} border-gray-200 pl-6 pr-3 dark:border-zinc-700`} />
                </div>
              ))}
            </div>
          </div>

          {/* The live count + what reading them takes */}
          <div className={`rounded-xl px-3 py-2.5 ring-1 ${status.tone === 'bad' ? 'bg-rose-50 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/30' : status.tone === 'warn' ? 'bg-amber-50 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30' : 'bg-[#fbf8f1] ring-[#C9A24D]/30 dark:bg-zinc-800/70 dark:ring-zinc-700'}`} data-testid="ai-hs-count-box">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[24px] font-black leading-none tabular-nums text-[#111827] dark:text-white" data-testid="ai-hs-count">
                {missing.has('place') || !cnt ? '–' : n.toLocaleString()}
              </span>
              <span className="text-[11.5px] font-bold text-gray-600 dark:text-zinc-300">home{n === 1 ? '' : 's'} for sale fit</span>
              {counting && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-gray-400" />}
            </div>
            <p className={`mt-1 text-[11px] font-semibold leading-snug ${status.tone === 'ok' ? 'truncate whitespace-nowrap' : ''} ${status.tone === 'bad' ? 'text-rose-800 dark:text-rose-200' : status.tone === 'warn' ? 'text-amber-800 dark:text-amber-200' : 'text-gray-500 dark:text-zinc-400'}`} data-testid="ai-hs-status">{status.text}</p>
            {status.tone !== 'bad' && <p className="mt-1 text-[10px] font-semibold text-gray-400 dark:text-zinc-500">Counting is free - only Search uses AI usage. Homes with no size listed are left out.</p>}
          </div>

          {err && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid="ai-hs-error">{err}</p>}

          <div className="flex items-center gap-2">
            <button type="button" onClick={run} disabled={!canRun} data-testid="ai-hs-run"
              className="ohp-ai-press inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C9A24D] px-4 text-[13px] font-black text-[#111827] shadow-sm transition-opacity disabled:opacity-40">
              {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading {n.toLocaleString()} listings…</> : <><Sparkles className="h-4 w-4" /> {cnt?.ready ? `Read ${n.toLocaleString()} listing${n === 1 ? '' : 's'}` : 'Search'}</>}
            </button>
            {result && !running && (
              <button type="button" onClick={() => setEditing(false)} className="ohp-ai-press h-10 rounded-xl border border-gray-200 px-3 text-[12px] font-bold text-gray-600 dark:border-zinc-700 dark:text-zinc-300">Back</button>
            )}
          </div>
          {running && <p className="-mt-1.5 text-center text-[10.5px] font-semibold text-gray-400">The AI is reading each description - usually 10-30 seconds.</p>}
        </div>
      ) : result && (
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400" data-testid="ai-hs-where">
            {[placeLabel, f.min_beds ? `${f.min_beds}+ bd` : '', f.min_sqft ? `${f.min_sqft.toLocaleString()}+ sqft` : '', f.min_price || f.max_price ? `${money(f.min_price) || 'any'}–${money(f.max_price) || 'any'}` : ''].filter(Boolean).join(' · ')}
            {result.used_percent != null && <> · used {pct(result.used_percent)}</>}
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <button type="button" onClick={() => { setTab('yes'); setPage(0) }} className={chip(tab === 'yes')} data-testid="ai-hs-tab-yes">Matches · {result.yes}</button>
            {result.maybe > 0 && <button type="button" onClick={() => { setTab('maybe'); setPage(0) }} className={chip(tab === 'maybe')} data-testid="ai-hs-tab-maybe">Maybe · {result.maybe}</button>}
          </div>
          <div className="mt-2 grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]" data-testid="ai-hs-list">
            {list.slice(page * PAGE, (page + 1) * PAGE).map(h => <Tile key={h.id} h={h} onOpen={() => { setMove(null); setViewing(h.key) }} />)}
          </div>
          {!list.length && <p className="py-4 text-center text-[11.5px] font-semibold text-gray-500 dark:text-zinc-400">None of the {result.read} listings mentioned that.</p>}
          <ChatPager page={page} pages={Math.ceil(list.length / PAGE)} onPage={setPage} testid="ai-hs-pager" />
          {user && (
            <PropertyQuickViewModal listingKey={viewing} agentId={user.id} onClose={() => setViewing(null)} move={move}
              nav={listNav(list.map(h => h.key), viewing, (k, dir) => {
                setMove(m => ({ dir, kind: 'nav', seq: (m?.seq || 0) + 1 })); setViewing(k)
                const i = list.findIndex(h => h.key === k); if (i >= 0) setPage(Math.floor(i / PAGE))
              })} />
          )}
          {!!result.failed && <p className="mt-1.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">{result.failed} listing{result.failed === 1 ? '' : 's'} couldn&apos;t be read just now.</p>}
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} data-testid="ai-hs-edit"
              className="ohp-ai-press inline-flex h-7 items-center gap-1 rounded-full border border-gray-200 px-2.5 text-[11px] font-black text-[#111827] hover:border-[#111827] dark:border-zinc-700 dark:text-white">
              <Pencil className="h-3.5 w-3.5" /> Change search
            </button>
            <span className="ml-auto text-[10.5px] font-semibold text-gray-400">Tap a home to open it</span>
          </div>
        </div>
      )}
    </div>
  )
}
