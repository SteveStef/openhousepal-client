'use client'

// The chat's Showcase card (owner, 11/08: "use this exact UI whenever it's referencing properties in a
// Showcase, always, instead of listing out the text - with the option to remove them or recommend
// them, and Send as a little pop-up, not changing where you are in the chat"). Under any reply that
// read a client's Showcase (ai_showcase_cards on the server): every home as a small row - photo,
// street, price, beds / baths, what the client did, and for a search the words that matched - with
// Recommend, Send and Remove on each. Select does several at once. Built for 100-home Showcases:
// the matches come first behind a "Matches" chip, quick filters and a search narrow it, and the
// list shows 8 at a time with "Show more" (never one long wall). Everything runs through the app's
// own Showcase routes as the agent; the Send window opens over the chat and the chat stays put.
import { announceChange } from '@/lib/dataChanged'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CheckCircle2, Home, Loader2, Search, Send, Star, Trash2, X } from 'lucide-react'
import api from '@/lib/api-service'
import { normalizeImageUrl } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { sendLine, sendsByHome, type HomeSend } from '@/lib/sendHome'
import { showcaseLinkPath } from '@/lib/showcaseLink'
import { openHousePalPublicUrl, websitePublicUrl } from '@/lib/publicResourceLinks'
import SendHomesSheet from '@/components/showcases/SendHomesSheet'
import Highlight from './Highlight'
import ChatPager, { listNav } from './ChatPager'
import PropertyQuickViewModal from '@/components/PropertyQuickViewModal'
import type { HomeMove } from '@/components/PropertyDetailsModal'
import { useLastValue } from '@/components/ui/windowMotion'
import type { Collection, Property, Site, SiteDomain } from '@/types'

type Row = { id: string; key: string; street: string; city?: string; state?: string; price?: number | null; beds?: number | null; baths?: number | null;
  sqft?: number | null; photo?: string | null; status?: string | null; tags?: string[]; recommended?: boolean
  /** The Showcase's must-haves line for this home (backend ai_showcase_cards) - Send's "Mention the must-haves". */
  smart?: Property['smartMatch'] }
type Info = { id: string; name: string; client?: string; first?: string; last?: string; email?: string | null; phone?: string | null;
  share_token?: string | null; short_code?: string | null; is_public?: boolean; status?: string }
export type ShowcaseCardRef = { record_id: string; collection: Info; homes: Row[]; matched?: Record<string, string[]>; looked_for?: string[]; searched?: boolean
  /** Matches the chat says aren't real ("a pool table") - shown last in Matches, greyed, with why. */
  doubtful?: Record<string, string>
  /** Not enough chat usage was left for AI to read the listings - these are simple word matches. */
  words_only?: boolean }
type View = 'matches' | 'all' | 'recommended' | 'touched' | 'off'

const PAGE = 6
const homes = (n: number) => `${n} home${n === 1 ? '' : 's'}`
const money = (v?: number | null) => (!v || v <= 0 ? '' : v >= 1e6 ? `$${(v / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`)
const num = (v?: number | null) => String(Number(v)).replace(/\.0$/, '')
const touched = (r: Row) => (r.tags || []).some(t => t === 'Loved' || t === 'Commented' || t === 'Tour ask')
const TAG: Record<string, string> = {
  Loved: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  Passed: 'bg-gray-500/10 text-gray-600 ring-gray-400/30 dark:text-zinc-300',
  Commented: 'bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300',
  'Tour ask': 'bg-amber-400/20 text-amber-800 ring-amber-500/30 dark:text-amber-300',
}
const chip = (on: boolean) => `ohp-ai-press shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`
const pill = 'ohp-ai-press inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-black transition-colors disabled:opacity-50'

// The agent's website + domains (a Showcase link uses their own domain when they have one) - loaded once.
let siteCache: Promise<{ site: Site | null; domains: SiteDomain[] }> | null = null
function loadSite() {
  if (!siteCache) siteCache = Promise.all([api.sites.getMine(), api.sites.getDomains()])
    .then(([s, d]) => ({ site: (s.success && s.data) || null, domains: (d.success && d.data) || [] }))
    .catch(() => ({ site: null, domains: [] }))
  return siteCache
}

const toProperty = (r: Row) => ({ id: r.id, ListingKey: r.key, FullStreetAddress: r.street, City: r.city, StateOrProvince: r.state, ListPrice: r.price,
  BedroomsTotal: r.beds, BathroomsTotal: r.baths, LivingArea: r.sqft, ListPictureURL: r.photo, MlsStatus: r.status ? 'Closed' : 'Active', smartMatch: r.smart || null } as unknown as Property)
const toCollection = (c: Info) => ({ id: c.id, shareToken: c.share_token, shortCode: c.short_code, isPublic: c.is_public, status: c.status,
  customer: { firstName: c.first || c.client || '', lastName: c.last || '', email: c.email || '', phone: c.phone || '' } } as unknown as Collection)

function Tile({ r, why, doubt, sent, selecting, picked, onPick, onOpen, onRecommend, onSend, onRemove, busy, client }: {
  r: Row; why?: string[]; doubt?: string; sent?: HomeSend; selecting: boolean; picked: boolean; onPick: () => void; onOpen: () => void
  onRecommend: () => void; onSend: () => void; onRemove: () => void; busy: boolean; client: string
}) {
  const [broken, setBroken] = useState(false)
  const [asking, setAsking] = useState(false)
  const facts = [money(r.price), r.beds ? `${num(r.beds)} bd` : '', r.baths ? `${num(r.baths)} ba` : ''].filter(Boolean).join(' · ')
  const quote = ((why || []).find(w => w.startsWith('Description:')) || (why || [])[0] || '').replace(/^(Description|MLS):\s*/, '')
  const body = (
    <>
      <span className="relative h-[50px] w-[64px] shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-zinc-800">
        {r.photo && !broken
          ? <img src={normalizeImageUrl(r.photo)} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
          : <Home className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-gray-300" />}
        {r.recommended && <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-[#111827] shadow"><Star className="h-3 w-3" fill="currentColor" /></span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">{r.street || 'Home'}</span>
        <span className="block truncate text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{[r.city, facts].filter(Boolean).join(' · ')}</span>
        {(!!r.tags?.length || r.status || sent) && (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
            {r.status && <span className="shrink-0 rounded-full bg-gray-200/80 px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-gray-600 dark:bg-zinc-700 dark:text-zinc-300">{r.status}</span>}
            {(r.tags || []).map(t => <span key={t} className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wide ring-1 ${TAG[t] || TAG.Passed}`}>{t}</span>)}
            {sent && <span className="shrink-0 rounded-full bg-emerald-500/12 px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300" title={`Sent ${sendLine(sent)}`}>Sent</span>}
          </span>
        )}
      </span>
    </>
  )
  if (selecting) {
    return (
      <button type="button" role="checkbox" aria-checked={picked} onClick={onPick} data-testid="ai-sc-tile" data-key={r.key}
        className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border p-1.5 pr-2.5 text-left transition-colors ${picked
          ? 'border-[#C9A24D] bg-[#fffaf0] dark:border-[#C9A24D]/70 dark:bg-[#C9A24D]/[0.08]' : 'border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'}`}>
        {body}
        <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-2 ${picked ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-zinc-600'}`}>
          {picked && <Check className="h-3 w-3" strokeWidth={4} />}
        </span>
      </button>
    )
  }
  // Smaller tiles (owner, 11/08): Recommend / Send / Remove are three round buttons in the top right
  // corner, and a long address ends in "..." instead of pushing them down a row.
  const icon = 'ohp-ai-press grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-50'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-1.5 dark:border-zinc-700 dark:bg-zinc-900" data-testid="ai-sc-tile" data-key={r.key}>
      <div className="flex items-start gap-2.5">
        {/* the photo and address open the home over the chat (owner, 11/09) */}
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-2.5 text-left" data-testid="ai-sc-open">{body}</button>
        {!asking && (
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={onRecommend} disabled={busy} aria-pressed={!!r.recommended} data-testid="ai-sc-recommend"
              aria-label={r.recommended ? 'Recommended - tap to take it off' : 'Recommend'} title={r.recommended ? 'Recommended - tap to take it off' : 'Recommend'}
              className={`${icon} ${r.recommended ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-[#C9A24D]/45 text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]'}`}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" fill={r.recommended ? 'currentColor' : 'none'} />}
            </button>
            <button type="button" onClick={onSend} data-testid="ai-sc-send" aria-label={sent ? `Sent ${sendLine(sent)} - send again` : 'Send'} title={sent ? `Sent ${sendLine(sent)} - send again` : 'Send'}
              className={`${icon} ${sent ? 'border-emerald-500/45 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-gray-200 text-[#111827] hover:border-[#111827] dark:border-zinc-700 dark:text-white'}`}>
              {sent ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            </button>
            <button type="button" onClick={() => setAsking(true)} disabled={busy} aria-label="Remove from the Showcase" title="Remove from the Showcase" data-testid="ai-sc-remove"
              className={`${icon} border-gray-200 text-gray-400 hover:border-rose-300 hover:text-rose-600 dark:border-zinc-700`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>
      {quote && (
        <p className={`mt-1.5 line-clamp-2 border-l-2 pl-2 text-[11px] font-medium italic leading-snug ${doubt ? 'border-gray-300 text-gray-400 dark:border-zinc-600 dark:text-zinc-500' : 'border-[#C9A24D] text-gray-600 dark:text-zinc-300'}`} data-testid="ai-sc-why"><Highlight text={quote} dim={!!doubt} /></p>
      )}
      {doubt && (
        <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600 dark:bg-zinc-800 dark:text-zinc-300" data-testid="ai-sc-doubt">
          <X className="h-3 w-3 shrink-0" strokeWidth={3} /> <span className="truncate">Maybe not: {doubt}</span>
        </p>
      )}
      {asking && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 dark:bg-rose-500/10" data-testid="ai-sc-remove-ask">
          <span className="min-w-0 flex-1 text-[11px] font-bold text-rose-800 dark:text-rose-200">Take it out of {client === 'their' ? 'their' : `${client}'s`} Showcase for good?</span>
          <button type="button" onClick={() => { setAsking(false); onRemove() }} data-testid="ai-sc-remove-yes" className={`${pill} border-rose-600 bg-rose-600 text-white`}>Remove</button>
          <button type="button" onClick={() => setAsking(false)} className={`${pill} border-gray-200 bg-white text-gray-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300`}>Keep</button>
        </div>
      )}
    </div>
  )
}

export default function ShowcaseHomesCard({ card }: { card: ShowcaseCardRef }) {
  const { user } = useAuth()
  const [info, setInfo] = useState<Info>(card.collection)
  const [rows, setRows] = useState<Row[]>(card.homes || [])
  const [gone, setGone] = useState(false)
  const matched = useMemo(() => card.matched || {}, [card.matched])
  const doubtful = useMemo(() => card.doubtful || {}, [card.doubtful])
  const nMatched = rows.filter(r => matched[r.id]).length
  const nDoubt = rows.filter(r => matched[r.id] && doubtful[r.id]).length
  const [view, setView] = useState<View>(card.searched && Object.keys(card.matched || {}).length ? 'matches' : 'all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<string | null>(null)
  const [move, setMove] = useState<HomeMove | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [sends, setSends] = useState<Record<string, HomeSend[]>>({})
  const [sendList, setSendList] = useState<Row[] | null>(null)
  const lastSend = useLastValue(sendList)
  const [site, setSite] = useState<{ site: Site | null; domains: SiteDomain[] } | null>(null)
  const client = info.client || info.first || 'their'

  // Opened later: the Showcase as it is now (a home removed or recommended since shows that way).
  useEffect(() => {
    let live = true
    api.ai.showcaseCard(card.collection.id).then(r => {
      if (!live) return
      if (r.success && r.data) { setRows(r.data.homes as Row[]); setInfo(r.data.collection as Info) }
      else if ((r as any).status === 404 || /isn't there/.test(String(r.error || ''))) setGone(true)
    })
    api.collections.sendHomeState(card.collection.id).then(r => { if (live && r.success && r.data) setSends(sendsByHome(r.data.sends || [])) })
    loadSite().then(s => { if (live) setSite(s) })
    return () => { live = false }
  }, [card.collection.id])

  const counts: Record<View, number> = {
    matches: nMatched, all: rows.length, recommended: rows.filter(r => r.recommended).length,
    touched: rows.filter(touched).length, off: rows.filter(r => r.status).length,
  }
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const inView = rows.filter(r => view === 'all' || (view === 'matches' ? !!matched[r.id] : view === 'recommended' ? r.recommended : view === 'touched' ? touched(r) : !!r.status))
    const hit = inView.filter(r => words.every(w => `${r.street} ${r.city || ''} ${(r.tags || []).join(' ')} ${r.status || ''} ${(matched[r.id] || []).join(' ')}`.toLowerCase().includes(w)))
    // matches, then the agent's picks, then the rest (the server's order: newest first)
    const rank = (r: Row) => (matched[r.id] ? (doubtful[r.id] ? 1 : 2) : 0)
    return [...hit].sort((a, b) => rank(b) - rank(a) || (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))
  }, [rows, view, q, matched, doubtful])
  useEffect(() => { setPage(0) }, [view, q])

  const showcaseUrl = info.share_token && info.is_public !== false
    ? (site ? websitePublicUrl(site.site, site.domains, showcaseLinkPath({ shortCode: info.short_code, shareToken: info.share_token })) : null)
      || openHousePalPublicUrl(showcaseLinkPath({ shortCode: info.short_code, shareToken: info.share_token }))
    : null
  const liveCount = rows.filter(r => !r.status && !(r.tags || []).includes('Passed')).length
  const flash = (ok: boolean, text: string) => { setNote({ ok, text }); window.setTimeout(() => setNote(n => (n?.text === text ? null : n)), 4200) }
  const mark = (ids: string[], on: boolean) => setBusy(b => { const n = new Set(b); ids.forEach(i => (on ? n.add(i) : n.delete(i))); return n })

  const recommendOne = async (r: Row) => {
    const next = !r.recommended
    setRows(rs => rs.map(x => (x.id === r.id ? { ...x, recommended: next, tags: next ? (x.tags || []).filter(t => t !== 'Passed') : x.tags } : x)))
    mark([r.id], true)
    const res = await api.collections.recommend(info.id, r.id, next)
    mark([r.id], false)
    if (!res.success) {
      setRows(rs => rs.map(x => (x.id === r.id ? { ...x, recommended: !next } : x)))
      flash(false, res.error || "Couldn't save that - try again.")
    } else { announceChange(); flash(true, next ? `Recommended - ${client === 'their' ? 'they' : client} will see it at the top` : 'Recommendation taken off') }
  }
  const removeIds = async (ids: string[]) => {
    mark(ids, true)
    const res = await api.collections.bulkHomes(info.id, 'remove', ids)
    mark(ids, false)
    if (!res.success || !res.data) { flash(false, res.error || "Couldn't remove that - try again."); return }
    const done = new Set(res.data.done.map(String))
    announceChange()
    setRows(rs => rs.filter(x => !done.has(x.id)))
    setPicked(p => p.filter(x => !done.has(x)))
    flash(true, `Removed ${homes(done.size)} · ${rows.length - done.size} left in ${client === 'their' ? 'their' : `${client}'s`} Showcase`)
  }
  const recommendIds = async (ids: string[]) => {
    setBulkBusy(true)
    const res = await api.collections.bulkHomes(info.id, 'recommend', ids)
    setBulkBusy(false)
    if (!res.success || !res.data) { flash(false, res.error || "Couldn't save that - try again."); return }
    const done = new Set(res.data.done.map(String))
    announceChange()
    setRows(rs => rs.map(x => (done.has(x.id) ? { ...x, recommended: true, tags: (x.tags || []).filter(t => t !== 'Passed') } : x)))
    flash(true, `Recommended ${homes(done.size)}`)
    endSelect()
  }
  const endSelect = () => { setSelecting(false); setPicked([]); setAsk(false) }
  const togglePick = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const pickedRows = rows.filter(r => picked.includes(r.id))
  const allShownPicked = list.length > 0 && list.every(r => picked.includes(r.id))

  if (gone) {
    return <div className="mt-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-semibold text-gray-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400" data-testid="ai-sc-card">That Showcase isn&apos;t there any more.</div>
  }
  const views: [View, string][] = [['matches', 'Matches'], ['all', 'All'], ['recommended', 'Recommended'], ['touched', 'Loved / commented'], ['off', 'Off the market']]

  return (
    <div className="ohp-ai-card-in mt-2 w-full rounded-2xl border border-[#C9A24D]/40 bg-white p-2.5 text-left shadow-sm dark:border-[#C9A24D]/30 dark:bg-zinc-900 sm:p-3" data-testid="ai-sc-card">
      <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-[#1b1a17] via-[#2a2218] to-[#111827] px-3 py-2.5 ring-1 ring-[#C9A24D]/40">
        <Home className="h-4 w-4 shrink-0 text-[#e8c97a]" strokeWidth={2.2} />
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] font-black uppercase tracking-[0.18em] text-[#C9A24D]">Showcase</span>
          <span className="block truncate font-serif text-[14px] font-black leading-tight text-white">{info.name}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[10.5px] font-black tabular-nums text-white/85">{homes(rows.length)}</span>
          {card.searched && <span className="block text-[10px] font-bold tabular-nums text-[#e8c97a]" data-testid="ai-sc-match-count">{nMatched - nDoubt} match{nDoubt ? ` · ${nDoubt} maybe not` : ''}</span>}
        </span>
      </div>

      {card.words_only && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold leading-snug text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid="ai-sc-words-only">
          Quick word matches only - there isn&apos;t enough chat usage left this month for AI to read every listing, so some homes may be missed.
        </p>
      )}
      <div className="-mx-0.5 mt-2 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none]">
        {views.filter(([k]) => (k === 'matches' ? card.searched : k === 'all' || counts[k] > 0 || k === view)).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setView(k)} className={chip(view === k)} data-testid={`ai-sc-view-${k}`}>{label} · {counts[k]}</button>
        ))}
      </div>
      {rows.length > PAGE && (
        <div className="relative mt-1.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search street, town or words" aria-label="Search the homes" data-testid="ai-sc-search"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-8 text-[16px] font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:text-xs" />
          {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>}
        </div>
      )}

      {selecting && (
        <div className="mt-2 flex items-center gap-2">
          <button type="button" role="checkbox" aria-checked={allShownPicked} disabled={!list.length} data-testid="ai-sc-pick-all"
            onClick={() => setPicked(p => (allShownPicked ? p.filter(x => !list.some(r => r.id === x)) : Array.from(new Set([...p, ...list.map(r => r.id)]))))}
            className="ohp-ai-press inline-flex items-center gap-2 py-1 text-[11.5px] font-black text-[#111827] disabled:opacity-40 dark:text-white">
            <span className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border-2 ${allShownPicked ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-zinc-600'}`}>{allShownPicked && <Check className="h-3 w-3" strokeWidth={4} />}</span>
            {allShownPicked ? 'Uncheck' : 'Check'} all {list.length > PAGE ? `${list.length} ` : ''}in this list
          </button>
        </div>
      )}

      <div className="mt-2 grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr))]" data-testid="ai-sc-list">
        {list.slice(page * PAGE, (page + 1) * PAGE).map(r => (
          <Tile key={r.id} r={r} why={matched[r.id]} doubt={matched[r.id] ? doubtful[r.id] : undefined} sent={sends[r.id]?.[0]} selecting={selecting} picked={picked.includes(r.id)} onPick={() => togglePick(r.id)} onOpen={() => { setMove(null); setViewing(r.key) }}
            onRecommend={() => recommendOne(r)} onSend={() => setSendList([r])} onRemove={() => removeIds([r.id])} busy={busy.has(r.id)} client={client} />
        ))}
      </div>
      {!list.length && (
        <p className="py-4 text-center text-[11.5px] font-semibold text-gray-500 dark:text-zinc-400">
          {view === 'matches' && !q ? 'No home in it mentioned that.' : 'No home matches that.'}
        </p>
      )}
      <ChatPager page={page} pages={Math.ceil(list.length / PAGE)} onPage={setPage} testid="ai-sc-pager" />
      {user && (
        <PropertyQuickViewModal listingKey={viewing} agentId={user.id} onClose={() => setViewing(null)} move={move}
          nav={listNav(list.map(r => r.key), viewing, (k, dir) => {
            setMove(m => ({ dir, kind: 'nav', seq: (m?.seq || 0) + 1 })); setViewing(k)
            const i = list.findIndex(r => r.key === k); if (i >= 0) setPage(Math.floor(i / PAGE))
          })} />
      )}

      {note && (
        <p aria-live="polite" data-testid="ai-sc-note" className={`mt-2 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold ${note.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'}`}>
          {note.ok && <Check className="mr-1 inline h-3.5 w-3.5 align-[-2px]" strokeWidth={3} />}{note.text}
        </p>
      )}

      {/* Select several: Send / Recommend / Remove them at once (Remove asks first). */}
      {selecting ? (
        <div className="mt-2 rounded-xl bg-[#111827] p-2 text-white dark:bg-zinc-800" data-testid="ai-sc-select-bar">
          {ask ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-[12px] font-bold">Remove {homes(picked.length)} from {client === 'their' ? 'their' : `${client}'s`} Showcase for good?</span>
              <button type="button" onClick={async () => { setAsk(false); await removeIds(picked); setSelecting(false) }} data-testid="ai-sc-bulk-remove-yes"
                className={`${pill} border-rose-500 bg-rose-600 text-white`}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
              <button type="button" onClick={() => setAsk(false)} className={`${pill} border-white/20 text-white`}>Keep</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-auto text-[12px] font-black tabular-nums" data-testid="ai-sc-picked">{picked.length} selected</span>
              <button type="button" disabled={!picked.length} onClick={() => setSendList(pickedRows)} data-testid="ai-sc-bulk-send" className={`${pill} border-white/25 text-white`}><Send className="h-3.5 w-3.5" /> Send</button>
              <button type="button" disabled={!picked.length || bulkBusy} onClick={() => recommendIds(picked)} data-testid="ai-sc-bulk-recommend" className={`${pill} border-[#C9A24D] text-[#e8c97a]`}>
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />} Recommend
              </button>
              <button type="button" disabled={!picked.length} onClick={() => setAsk(true)} data-testid="ai-sc-bulk-remove" className={`${pill} border-rose-400/60 text-rose-200`}><Trash2 className="h-3.5 w-3.5" /> Remove</button>
              <button type="button" onClick={endSelect} className={`${pill} border-white/25 text-white/80`}>Done</button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          {rows.length > 0 && (
            <button type="button" onClick={() => { setSelecting(true); setNote(null) }} data-testid="ai-sc-select"
              className={`${pill} border-gray-200 text-[#111827] hover:border-[#111827] dark:border-zinc-700 dark:text-white`}><Check className="h-3.5 w-3.5" /> Select several</button>
          )}
          <Link href={`/showcases?showcase=${info.id}`} className="group ml-auto inline-flex items-center gap-1 text-[11.5px] font-black text-[#8b7355] dark:text-[#C9A24D]">
            Open {client === 'their' ? 'the' : `${client}'s`} Showcase <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}

      <SendHomesSheet
        open={!!sendList}
        onClose={() => setSendList(null)}
        homes={(sendList || lastSend || []).map(toProperty)}
        collection={toCollection(info)}
        showcaseUrl={showcaseUrl}
        agentFirst={user?.first_name || ''}
        homeCount={liveCount}
        onTurnOnLink={() => { setSendList(null); flash(false, `${client === 'their' ? 'Their' : `${client}'s`} Showcase link is off - turn it on from Share on the Showcase page first.`) }}
        onSent={() => { if (selecting) endSelect() }}
        onSendsChange={s => setSends(sendsByHome(s))}
      />
    </div>
  )
}
