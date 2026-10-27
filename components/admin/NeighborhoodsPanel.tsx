'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Globe, Loader2,
  MapPin, Maximize2, Monitor, Pencil, Plus, RotateCcw, Search, ShieldCheck, Smartphone, Sparkles, Trash2, Undo2, X,
} from 'lucide-react'
import api from '@/lib/api-service'
import type { AdminAreaDetail, AdminAreaListItem, AdminAreaList, AdminAreaPlace, AdminAreaPlaceList, AdminAreaPlaceInput, AdminAreaSchool } from '@/types'
import ConfirmationModal from '@/components/ConfirmationModal'
import { FIELD } from './BrokerageGroupsPanel'

type Toast = (message: string, type: 'success' | 'error') => void

const STATUS: Record<string, [string, string]> = {
  ENRICHED: ['Researched', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'],
  PARTIAL: ['Partly researched', 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'],
  PENDING: ['Not researched yet', 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'],
  RESEARCHING: ['Being researched now', 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'],
  FAILED: ['Research failed', 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'],
}
const shortDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''
const cap = (s?: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
const BTN = 'inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50'
const BTN_DARK = `${BTN} bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827]`
const BTN_GOLD = `${BTN} bg-[#C9A24D] text-white hover:bg-[#b48f3f]`
const BTN_SOFT = `${BTN} border border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D]/60 dark:border-gray-700 dark:bg-[#151517] dark:text-white`
const ICON_BTN = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:border-[#C9A24D]/60 hover:text-[#111827] disabled:opacity-30 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300 dark:hover:text-white'
const CARD = 'rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 dark:border-gray-800 dark:bg-[#151517]'

/** A town page link the admin can open: the agent's real address, or this computer's copy while testing. */
function viewHref(detail: AdminAreaDetail, host?: string | null, url?: string | null) {
  if (!host || !url) return null
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return `${window.location.origin}/ohp-site-render/${encodeURIComponent(host)}/${detail.slug}`
  }
  return url
}

/** Admin "Neighborhoods": every shared town record - search, see what the page says, fix or add to it. */
export default function NeighborhoodsPanel({ onToast }: { onToast: Toast }) {
  const [openId, setOpenId] = useState<string | null>(null)
  useEffect(() => {
    try { const id = new URLSearchParams(window.location.search).get('town'); if (id) setOpenId(id) } catch { /* no saved town */ }
  }, [])
  const open = (id: string | null) => {
    setOpenId(id)
    try {
      const url = new URL(window.location.href)
      if (id) url.searchParams.set('town', id); else url.searchParams.delete('town')
      window.history.replaceState(window.history.state, '', url.toString())
    } catch { /* fine without the address */ }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return openId
    ? <TownEditor id={openId} onBack={() => open(null)} onToast={onToast} />
    : <TownList onOpen={open} onToast={onToast} />
}

// ------------------------------------------------------------------ the list

function TownList({ onOpen, onToast }: { onOpen: (id: string) => void; onToast: Toast }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [state, setState] = useState('')
  const [type, setType] = useState('')
  const [research, setResearch] = useState('')
  const [used, setUsed] = useState('')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AdminAreaList | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(1) }, [debounced, state, type, research, used, sort])
  useEffect(() => {
    let live = true
    setLoading(true)
    api.admin.getAreas({ q: debounced, state, area_type: type, research, used, sort, page, page_size: 24 }).then(r => {
      if (!live) return
      if (r.success && r.data) setData(r.data)
      else onToast(r.error || "Couldn't load the towns", 'error')
      setLoading(false)
    })
    return () => { live = false }
  }, [debounced, state, type, research, used, sort, page, onToast])
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-[#111827] dark:text-white"><MapPin className="h-5 w-5 text-[#C9A24D]" /> Neighborhoods</h2>
        <p className="mt-1 max-w-3xl text-sm font-medium text-gray-500 dark:text-gray-400">
          Every town and neighborhood in the database. One town is shared by every agent who serves it, so a change here shows on all of their sites right away. Open one to see exactly what its town page says, then fix it or add to it.
        </p>
      </div>

      <div className={CARD}>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a town, neighborhood or county" aria-label="Search towns"
            className={`${FIELD} min-h-[46px] pl-10`} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Pick label="State" value={state} onChange={setState} options={[['', 'All states'], ...(data?.states || []).map(s => [s, s])]} />
          <Pick label="Kind" value={type} onChange={setType} options={[['', 'Towns & neighborhoods'], ['city', 'Towns & cities'], ['neighborhood', 'Neighborhoods']]} />
          <Pick label="Research" value={research} onChange={setResearch} options={[['', 'Any research'], ...Object.entries(STATUS).map(([k, [l]]) => [k, l])]} />
          <Pick label="Agents" value={used} onChange={setUsed} options={[['', 'Used or not'], ['yes', 'Used by agents'], ['no', 'No agents yet']]} />
          <Pick label="Sort" value={sort} onChange={setSort} options={[['name', 'A to Z'], ['agents', 'Most agents'], ['researched', 'Newest research']]} className="col-span-2 md:col-span-1" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[#111827] dark:text-white">{data ? `${data.total} ${data.total === 1 ? 'town' : 'towns'}` : ' '}</p>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" />}
      </div>

      {data && data.items.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-gray-200 px-6 py-14 text-center dark:border-gray-800">
          <MapPin className="h-9 w-9 text-gray-300" />
          <p className="font-black text-gray-600 dark:text-gray-300">No towns match</p>
          <p className="max-w-md text-sm font-semibold text-gray-400">Try fewer words, or set the filters back to all.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.items || []).map(t => <TownCard key={t.id} t={t} onOpen={() => onOpen(t.id)} />)}
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className={BTN_SOFT} disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /> Back</button>
          <span className="px-2 text-xs font-black text-gray-500">Page {page} of {pages}</span>
          <button className={BTN_SOFT} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next <ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  )
}

function Pick({ label, value, onChange, options, className = '' }: { label: string; value: string; onChange: (v: string) => void; options: string[][]; className?: string }) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className={`${FIELD} min-h-[44px] appearance-none truncate pr-8`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </label>
  )
}

function TownCard({ t, onOpen }: { t: AdminAreaListItem; onOpen: () => void }) {
  const [label, chip] = STATUS[t.enrichment_status] || [t.enrichment_status, STATUS.PENDING[1]]
  return (
    <button onClick={onOpen} className="group relative w-full min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/50 hover:shadow-lg sm:p-5 dark:border-gray-800 dark:bg-[#151517]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827]" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-[#111827] dark:text-white">{t.name}, {t.state}</p>
          <p className="truncate text-xs font-semibold text-gray-400">
            {t.area_type === 'neighborhood' ? `Neighborhood${t.parent_area_name ? ` of ${t.parent_area_name}` : ''}` : 'Town'}{t.county ? ` · ${t.county}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${chip}`}>{label}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile label="Agents" value={String(t.agent_count)} />
        <Tile label="Places" value={String(t.place_count)} />
        <Tile label="Researched" value={t.last_enriched_at ? shortDate(t.last_enriched_at) : 'Never'} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
        {t.places_checked
          ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-3.5 w-3.5" />Places checked on Google</span>
          : <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />Places not checked yet</span>}
        {t.places_waiting && <span className="text-amber-600 dark:text-amber-400">Check waiting on Google</span>}
        {t.admin_edited_at && <span className="inline-flex items-center gap-1 text-[#8b7355] dark:text-[#e8c97a]"><Pencil className="h-3 w-3" />Edited by you</span>}
        {!t.has_summary && <span className="text-gray-400">No write-up</span>}
      </div>
    </button>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#faf9f7] px-2.5 py-2 dark:bg-white/[0.04]">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="truncate text-sm font-black text-[#111827] dark:text-white max-sm:whitespace-normal max-sm:text-[13px] max-sm:leading-tight">{value}</p>
    </div>
  )
}

// ------------------------------------------------------------------ one town

function TownEditor({ id, onBack, onToast }: { id: string; onBack: () => void; onToast: Toast }) {
  const [d, setD] = useState<AdminAreaDetail | null>(null)
  const [failed, setFailed] = useState('')
  const [confirm, setConfirm] = useState<'check' | 'research' | null>(null)
  const [busy, setBusy] = useState<'check' | 'research' | null>(null)
  const [notice, setNotice] = useState<{ title: string; lines: string[] } | null>(null)
  // Goes up after every save or check, so the page preview loads again with the change.
  const [previewVersion, setPreviewVersion] = useState(0)

  const load = useCallback(async () => {
    const r = await api.admin.getArea(id)
    if (r.success && r.data) { setD(r.data); setFailed('') }
    else setFailed(r.error || "Couldn't open this town")
  }, [id])
  useEffect(() => { load() }, [load])
  // While the research runs (a few minutes), look again every 15 seconds.
  useEffect(() => {
    if (d?.enrichment_status !== 'RESEARCHING') return
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [d?.enrichment_status, load])

  /** After any save: show the new record, say what the wording rules changed, refresh the live pages. */
  const saved = useCallback((next: AdminAreaDetail, what: string) => {
    setD(next)
    setPreviewVersion(v => v + 1)
    api.admin.refreshTownPages()
    const changes = next.wording_changes || []
    if (changes.length) {
      setNotice({ title: 'Saved - the Fair Housing wording rules changed a few words', lines: changes.map(c => `${c.where}: "${c.before}" became "${c.after}"`) })
    }
    onToast(`${what} saved - it's on the town page now`, 'success')
  }, [onToast])

  const runCheck = async () => {
    if (!d) return
    setConfirm(null); setBusy('check')
    const r = await api.admin.checkAreaPlaces(d.id)
    setBusy(null)
    if (r.success && r.data) {
      setD(r.data)
      setPreviewVersion(v => v + 1)
      api.admin.refreshTownPages()
      const res = r.data.check_result
      const names = Object.entries(res?.removed_names || {}).flatMap(([, n]) => n)
      setNotice({
        title: `Checked ${res?.checked ?? 0} places on Google`,
        lines: [
          res?.removed ? `${res.removed} taken off: ${names.join(', ')}. You'll find each one, with the reason, under "Taken off" in its list.` : 'Nothing was taken off.',
          ...(res?.waiting ? ["Google's free look-ups for this month ran out part-way - the rest are checked when they come back."] : []),
        ],
      })
    } else onToast(r.error || "Couldn't check the places", 'error')
  }
  const runResearch = async () => {
    if (!d) return
    setConfirm(null); setBusy('research')
    const r = await api.admin.researchAreaAgain(d.id)
    setBusy(null)
    if (r.success && r.data) { setD(r.data); onToast('Research started - it takes a few minutes', 'success') }
    else onToast(r.error || "Couldn't start the research", 'error')
  }

  if (failed) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className={BTN_SOFT}><ArrowLeft className="h-4 w-4" /> All towns</button>
        <div className={`${CARD} text-sm font-bold text-red-600`}>{failed}</div>
      </div>
    )
  }
  if (!d) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-[#C9A24D]" /></div>

  const [statusLabel, statusChip] = STATUS[d.enrichment_status] || [d.enrichment_status, STATUS.PENDING[1]]
  const view = viewHref(d, d.view_host, d.view_url)
  const researching = d.enrichment_status === 'RESEARCHING'
  const lists = (section: string) => d.lists.filter(l => l.section === section)

  return (
    <div className="space-y-5">
      <button onClick={onBack} className={BTN_SOFT}><ArrowLeft className="h-4 w-4" /> All towns</button>

      {/* The town at a glance + the two actions */}
      <div className={`${CARD} relative overflow-hidden`}>
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827]" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-[#111827] dark:text-white">{d.name}, {d.state}</h2>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {d.area_type === 'neighborhood' ? `Neighborhood${d.parent_area_name ? ` of ${d.parent_area_name}` : ''}` : 'Town'}
              {d.county ? ` · ${d.county}` : ''}{d.zip_codes.length ? ` · ZIP ${d.zip_codes.slice(0, 4).join(', ')}${d.zip_codes.length > 4 ? '…' : ''}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusChip}`}>{statusLabel}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Agents" value={String(d.agents.length)} />
          <Tile label="Researched" value={d.last_enriched_at ? shortDate(d.last_enriched_at) : 'Never'} />
          <Tile label="Places checked" value={d.places_check.version ? shortDate(d.places_check.checked_at) : 'Not yet'} />
          <Tile label="Last edited by you" value={d.admin_edited_at ? shortDate(d.admin_edited_at) : 'Never'} />
        </div>
        {researching && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-sky-50 p-3 text-xs font-bold text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> This town is being researched right now. It takes a few minutes - this page updates by itself.
          </p>
        )}
        {d.places_check.waiting && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Some places are still waiting to be checked - Google&apos;s free look-ups ran out for the month. They&apos;re checked when they come back.
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {view
            ? <a href={view} target="_blank" rel="noreferrer" className={BTN_DARK}><Globe className="h-4 w-4" /> See the town page <ExternalLink className="h-3.5 w-3.5" /></a>
            : <span className={`${BTN_SOFT} cursor-default text-gray-400`}><Globe className="h-4 w-4" /> No agent shows this page yet</span>}
          <button onClick={() => setConfirm('check')} disabled={!!busy || researching} className={BTN_SOFT}>
            {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 text-[#C9A24D]" />}
            {busy === 'check' ? 'Checking on Google…' : 'Check places on Google'}
          </button>
          <button onClick={() => setConfirm('research')} disabled={!!busy || researching} className={BTN_SOFT}>
            {busy === 'research' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[#C9A24D]" />}
            Research again <span className="font-semibold text-gray-400">(about ${d.research_cost_usd.toFixed(2)})</span>
          </button>
        </div>
        <nav className="mt-4 flex flex-wrap gap-1.5 border-t border-gray-100 pt-4 dark:border-gray-800" aria-label="Jump to">
          {[['preview', 'Preview page'], ['writeup', 'Write-up'], ['schools', 'Schools'], ['living', 'Living here'], ['around', 'Getting around'], ['agents', 'Agents'], ['facts', 'Other facts']].map(([k, l]) => (
            <a key={k} href={`#town-${k}`} className="inline-flex min-h-[36px] items-center rounded-full bg-[#faf9f7] px-3 text-[11px] font-black text-gray-600 hover:bg-[#C9A24D]/15 hover:text-[#111827] dark:bg-white/[0.05] dark:text-gray-300 dark:hover:text-white">{l}</a>
          ))}
        </nav>
      </div>

      {notice && (
        <div className="rounded-3xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 p-4 text-sm dark:bg-[#C9A24D]/10">
          <div className="flex items-start justify-between gap-3">
            <p className="font-black text-[#111827] dark:text-white">{notice.title}</p>
            <button onClick={() => setNotice(null)} className={ICON_BTN} aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <ul className="mt-2 space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
            {notice.lines.map((l, i) => <li key={i} className="break-words">{l}</li>)}
          </ul>
        </div>
      )}

      <Section id="preview" title="Preview page" sub="The town page as visitors see it. It loads again after every change you save.">
        <PagePreview d={d} version={`${previewVersion}-${d.last_enriched_at || ''}`} />
      </Section>

      <Section id="writeup" title="Write-up" sub="The paragraphs at the top of the town page.">
        <SummaryEditor d={d} onSaved={saved} onToast={onToast} />
      </Section>

      <Section id="schools" title="Schools" sub="Public schools by level, then private schools - the page's Schools section.">
        <PublicSchoolsEditor d={d} onSaved={saved} onToast={onToast} />
        {lists('Schools').map(l => <PlaceListEditor key={l.key} areaId={d.id} list={l} onSaved={saved} onToast={onToast} />)}
      </Section>

      <Section id="living" title="Living here" sub="Downtown, restaurants, shopping, groceries and parks.">
        {lists('Living here').map(l => <PlaceListEditor key={l.key} areaId={d.id} list={l} onSaved={saved} onToast={onToast} />)}
      </Section>

      <Section id="around" title="Getting around" sub="Trains, buses, airports and medical care.">
        {lists('Getting around').map(l => <PlaceListEditor key={l.key} areaId={d.id} list={l} onSaved={saved} onToast={onToast} />)}
      </Section>

      <Section id="agents" title="Agents who show this town" sub="The town page is on each of their websites.">
        {d.agents.length === 0 ? <p className="text-sm font-semibold text-gray-400">No agent has picked this town yet.</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {d.agents.map(a => {
              const href = viewHref(d, a.site_host, a.page_url)
              return (
                <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#111827] dark:text-white">{a.name}</p>
                    <p className="truncate text-xs font-semibold text-gray-400">{a.email}{a.site_host ? ` · ${a.site_host}` : ''}</p>
                  </div>
                  {href
                    ? <a href={href} target="_blank" rel="noreferrer" className={BTN_SOFT}><ExternalLink className="h-3.5 w-3.5" /> Their town page</a>
                    : <span className="text-xs font-bold text-gray-400">Website not live</span>}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section id="facts" title="Other facts on the page" sub="Worked out from maps, the Census and the MLS - not edited here.">
        {d.other_facts.length === 0 ? <p className="text-sm font-semibold text-gray-400">None yet.</p> : (
          <dl className="divide-y divide-gray-100 dark:divide-gray-800">
            {d.other_facts.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:justify-between sm:gap-4">
                <dt className="text-xs font-bold text-gray-500 dark:text-gray-400">{k}</dt>
                <dd className="break-words text-sm font-black text-[#111827] sm:text-right dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <ConfirmationModal
        isOpen={confirm === 'check'} onClose={() => setConfirm(null)} onConfirm={runCheck}
        title="Check every place on Google?"
        message={`This looks up about ${d.places_check.lookups_estimate} places on Google to make sure each is still open, is the right kind of place, and is close enough - and works out the real driving distance. It uses Google's free monthly look-ups. Places you added or changed here are left exactly as they are. It can take up to a minute.`}
        confirmText="Check places"
      />
      <ConfirmationModal
        isOpen={confirm === 'research'} onClose={() => setConfirm(null)} onConfirm={runResearch}
        title="Research this town again?"
        message={`This runs the whole town research again with AI. It costs about $${d.research_cost_usd.toFixed(2)} and takes a few minutes. The new research replaces the write-up and the place lists - including any changes you made here.`}
        confirmText={`Yes, spend about $${d.research_cost_usd.toFixed(2)}`}
        confirmButtonClass="bg-[#C9A24D] hover:bg-[#b48f3f] text-white"
      />
    </div>
  )
}

function Section({ id, title, sub, children }: { id: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={`town-${id}`} className="scroll-mt-24 space-y-3">
      <div>
        <h3 className="text-lg font-black text-[#111827] dark:text-white">{title}</h3>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{sub}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

// ------------------------------------------------------------------ page preview

const DESKTOP_W = 1440
const PHONE_W = 390
const FRAME_H = 640

/** The real town page (app/admin/town-preview), as one agent's site shows it or with a stand-in
 * agent - in a phone- or computer-sized window. On a phone it opens full screen instead. */
function PagePreview({ d, version }: { d: AdminAreaDetail; version: string }) {
  // Live sites only; real agents before test accounts (@example.com) - same order as the backend's default.
  const live = useMemo(() => d.agents.filter(a => a.site_live && a.site_id)
    .sort((a, b) => Number(a.email.toLowerCase().endsWith('@example.com')) - Number(b.email.toLowerCase().endsWith('@example.com'))), [d.agents])
  const [site, setSite] = useState<string>(live[0]?.site_id || 'none')
  const [look, setLook] = useState<'classic' | 'luxe'>('classic')
  const [size, setSize] = useState<'phone' | 'desktop'>('desktop')
  const [wide, setWide] = useState<boolean | null>(null)
  const [width, setWidth] = useState(0)
  const [loading, setLoading] = useState(true)
  const box = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [wide])

  const query = `site=${encodeURIComponent(site)}${site === 'none' && look === 'luxe' ? '&look=luxe' : ''}`
  const fullHref = `/admin/town-preview/${encodeURIComponent(d.id)}?${query}`
  const src = `${fullHref}&v=${encodeURIComponent(version)}`
  useEffect(() => { setLoading(true) }, [src, size])

  const pageW = size === 'desktop' ? DESKTOP_W : PHONE_W
  const room = Math.max(0, width - (size === 'phone' ? 24 : 0))
  const scale = room ? Math.min(1, room / pageW) : 1
  const frameH = size === 'phone' ? 760 : FRAME_H

  return (
    <div className={CARD}>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <label className="block sm:min-w-[240px] sm:flex-1">
          <span className="mb-1 block text-[11px] font-black text-gray-500 dark:text-gray-400">Preview as</span>
          <select value={site} onChange={e => setSite(e.target.value)} className={FIELD} aria-label="Preview as">
            {live.map(a => <option key={a.site_id!} value={a.site_id!}>{a.name}&apos;s website</option>)}
            <option value="none">No agent (sample)</option>
          </select>
        </label>
        {site === 'none' && (
          <label className="block sm:w-[160px]">
            <span className="mb-1 block text-[11px] font-black text-gray-500 dark:text-gray-400">Look</span>
            <select value={look} onChange={e => setLook(e.target.value as 'classic' | 'luxe')} className={FIELD} aria-label="Look">
              <option value="classic">Classic</option>
              <option value="luxe">Luxe</option>
            </select>
          </label>
        )}
        {wide && (
          <div className="inline-flex rounded-xl border border-gray-200 bg-[#faf9f7] p-1 dark:border-gray-700 dark:bg-white/[0.04]" role="group" aria-label="Screen size">
            {([['phone', 'Phone', Smartphone], ['desktop', 'Computer', Monitor]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => setSize(k)} aria-pressed={size === k}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-black transition ${size === k ? 'bg-white text-[#111827] shadow-sm dark:bg-[#151517] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                <Icon className="h-4 w-4" /> {l}
              </button>
            ))}
          </div>
        )}
        <a href={fullHref} target="_blank" rel="noreferrer" className={wide ? BTN_SOFT : BTN_GOLD}>
          <Maximize2 className="h-4 w-4" /> {wide ? 'Open full screen' : 'Open the preview'}
        </a>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-gray-400">
        {site === 'none'
          ? (live.length ? 'With a stand-in agent ("Your name here") - the town facts, homes and numbers are the real ones.' : 'No agent shows this town yet, so a stand-in agent ("Your name here") fills their spots. The town facts, homes and numbers are the real ones.')
          : 'Exactly as it looks on this agent\'s website. Links open their real site in a new tab; forms are off.'}
      </p>

      {wide === false && (
        <p className="mt-3 rounded-2xl bg-[#faf9f7] p-3 text-xs font-semibold text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">
          On a phone the preview opens full screen, just like a visitor sees it. Close that tab to come back here.
        </p>
      )}

      {wide && (
        <div ref={box} className="mt-4">
          <div className={`relative mx-auto overflow-hidden ${size === 'phone' ? 'rounded-[2.2rem] border-[10px] border-[#111827] shadow-xl' : 'rounded-2xl border border-gray-200 dark:border-gray-700'}`}
            style={{ width: size === 'phone' ? PHONE_W * scale + 20 : '100%', height: frameH * (size === 'phone' ? scale : 1) + (size === 'phone' ? 20 : 0) }}>
            <iframe
              key={`${src}|${size}`}
              src={src}
              title={`${d.name} town page preview`}
              onLoad={() => setLoading(false)}
              className="block border-0 bg-white"
              style={{
                width: pageW,
                height: size === 'phone' ? frameH : FRAME_H / scale,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 text-xs font-black text-gray-500 dark:bg-[#151517]/85 dark:text-gray-300">
                <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /> Loading the page…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SaveBar({ dirty, saving, onUndo, onSave, label = 'Save' }: { dirty: boolean; saving: boolean; onUndo: () => void; onSave: () => void; label?: string }) {
  if (!dirty && !saving) return null
  return (
    <div className="sticky bottom-3 z-10 mt-4 flex flex-col gap-2 rounded-2xl border border-[#C9A24D]/40 bg-white/95 p-3 shadow-lg backdrop-blur-sm sm:flex-row-reverse sm:items-center sm:justify-end sm:gap-4 dark:bg-[#151517]/95">
      <p className="text-xs font-black text-[#8b7355] dark:text-[#e8c97a]">You have changes that aren&apos;t saved yet.</p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button onClick={onUndo} disabled={saving} className={BTN_SOFT}><Undo2 className="h-4 w-4" /> Undo</button>
        <button onClick={onSave} disabled={saving} className={BTN_GOLD}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {label}</button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ write-up

function SummaryEditor({ d, onSaved, onToast }: { d: AdminAreaDetail; onSaved: (d: AdminAreaDetail, what: string) => void; onToast: Toast }) {
  const [text, setText] = useState(d.summary.text)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setText(d.summary.text) }, [d.summary.text])
  const dirty = text.trim() !== d.summary.text.trim()
  const save = async () => {
    setSaving(true)
    const r = await api.admin.saveAreaSummary(d.id, text)
    setSaving(false)
    if (r.success && r.data) onSaved(r.data, 'The write-up')
    else onToast(r.error || "Couldn't save the write-up", 'error')
  }
  const differs = !dirty && d.summary.page_text.trim() !== d.summary.text.trim()
  return (
    <div className={CARD}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-400">
        {d.summary.admin_edited ? <Badge tone="gold">Written by you</Badge> : d.summary.generated_at ? <span>Written by the AI research on {shortDate(d.summary.generated_at)}</span> : null}
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={9} aria-label="Write-up"
        className={`${FIELD} min-h-[180px] resize-y leading-relaxed`} placeholder="A few paragraphs about the town." />
      <p className="mt-2 text-[11px] font-semibold text-gray-400">
        Saved text goes through the Fair Housing wording rules. The page leaves out sentences with distances or travel times (the place lists show the real driving miles).
      </p>
      {differs && (
        <details className="mt-3 rounded-2xl bg-[#faf9f7] p-3 dark:bg-white/[0.04]">
          <summary className="cursor-pointer text-xs font-black text-[#111827] dark:text-white">What visitors actually see</summary>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-300">{d.summary.page_text || '(nothing - every sentence was left out)'}</p>
        </details>
      )}
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setText(d.summary.text)} onSave={save} label="Save write-up" />
    </div>
  )
}

function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'gold' | 'green' | 'red' }) {
  const c = {
    gray: 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300',
    gold: 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${c}`}>{children}</span>
}

// ------------------------------------------------------------------ one place list

type Fields = { name: string; category: string; city: string; address: string; description: string; source_url: string }
type Draft = { key: string; ref: number | null; removed_ref: number | null; f: Fields; editing: boolean; orig?: AdminAreaPlace }
const FIELD_KEYS: (keyof Fields)[] = ['name', 'category', 'city', 'address', 'description', 'source_url']
const toFields = (e?: AdminAreaPlace): Fields => ({ name: e?.name || '', category: e?.category || '', city: e?.city || '', address: e?.address || '', description: e?.description || '', source_url: e?.source_url || '' })
let draftSeq = 0
const nextKey = () => `d${++draftSeq}`

function PlaceListEditor({ areaId, list, onSaved, onToast }: { areaId: string; list: AdminAreaPlaceList; onSaved: (d: AdminAreaDetail, what: string) => void; onToast: Toast }) {
  const isSchools = list.key === 'private_schools'
  const signature = useMemo(() => JSON.stringify([list.entities, list.removed, list.notes]), [list])
  const fresh = useCallback((): Draft[] => list.entities.map((e, i) => ({ key: nextKey(), ref: i, removed_ref: null, f: toFields(e), editing: false, orig: e })), [list.entities])
  const [items, setItems] = useState<Draft[]>(fresh)
  const [notes, setNotes] = useState(list.notes)
  const [showRemoved, setShowRemoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(list.entities.length > 0)
  const sigRef = useRef(signature)
  useEffect(() => {
    if (sigRef.current === signature) return
    sigRef.current = signature
    setItems(fresh()); setNotes(list.notes)
  }, [signature, fresh, list.notes])

  const usedRefs = new Set(items.filter(i => i.ref !== null).map(i => i.ref))
  const backRefs = new Set(items.filter(i => i.removed_ref !== null).map(i => i.removed_ref))
  const pendingOff = list.entities.map((e, i) => ({ e, i })).filter(x => !usedRefs.has(x.i))
  const changed = (it: Draft) => it.ref === null || FIELD_KEYS.some(k => (it.f[k] || '').trim() !== ((it.orig?.[k] as string) || '').trim())
  const dirty = notes.trim() !== (list.notes || '').trim() || items.length !== list.entities.length
    || items.some((it, idx) => it.ref !== idx || changed(it))

  const set = (key: string, patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it))
  const move = (idx: number, by: number) => setItems(prev => {
    const next = [...prev]; const j = idx + by
    if (j < 0 || j >= next.length) return prev
    ;[next[idx], next[j]] = [next[j], next[idx]]
    return next
  })
  const add = () => { setOpen(true); setItems(prev => [...prev, { key: nextKey(), ref: null, removed_ref: null, f: toFields(), editing: true }]) }
  const putBack = (r: AdminAreaPlace, i: number) => setItems(prev => [...prev, { key: nextKey(), ref: null, removed_ref: i, f: toFields(r), editing: false, orig: r }])
  const keep = (i: number) => setItems(prev => {
    const next = [...prev]
    next.splice(Math.min(i, next.length), 0, { key: nextKey(), ref: i, removed_ref: null, f: toFields(list.entities[i]), editing: false, orig: list.entities[i] })
    return next
  })
  const undo = () => { setItems(fresh()); setNotes(list.notes) }

  const save = async () => {
    const blank = items.find(it => !it.f.name.trim())
    if (blank) { onToast('Every place needs a name', 'error'); set(blank.key, { editing: true }); return }
    setSaving(true)
    const entities: AdminAreaPlaceInput[] = items.map(it => ({
      ref: it.ref, removed_ref: it.removed_ref,
      ...Object.fromEntries(FIELD_KEYS.map(k => [k, it.f[k].trim() || null])) as Omit<AdminAreaPlaceInput, 'ref' | 'removed_ref'>,
    }))
    const r = await api.admin.saveAreaPlaces(areaId, list.key, {
      entities, notes: notes.trim() !== (list.notes || '').trim() ? notes : null,
      base_names: list.entities.map(e => e.name), base_removed_names: list.removed.map(e => e.name),
    })
    setSaving(false)
    if (r.success && r.data) onSaved(r.data, list.label)
    else onToast(r.error || `Couldn't save ${list.label}`, 'error')
  }

  const removedShown = list.removed.map((r, i) => ({ r, i })).filter(x => !backRefs.has(x.i))
  return (
    <div className={CARD}>
      <button onClick={() => setOpen(o => !o)} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left" aria-expanded={open}>
        <div className="min-w-0">
          <p className="text-base font-black text-[#111827] dark:text-white">{list.label}</p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            {list.entities.length} {list.entities.length === 1 ? 'place' : 'places'} on the page{list.removed.length ? ` · ${list.removed.length} taken off` : ''}
            {dirty ? ' · not saved' : ''}
          </p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {!isSchools && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-black text-gray-500 dark:text-gray-400">Short intro above the list (optional)</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${FIELD} resize-y`} placeholder="A sentence or two about this part of town life." />
              {!dirty && list.notes && list.page_notes !== list.notes && (
                <span className="mt-1 block text-[11px] font-semibold text-gray-400">On the page: {list.page_notes || '(left out - it only had distances or research notes)'}</span>
              )}
            </label>
          )}

          {list.page_limit && <p className="text-[11px] font-semibold text-gray-400">The page shows the first {list.page_limit} places in this order - the first one big, as the &quot;Local favorite&quot;.</p>}
          {items.length === 0 && <p className="rounded-2xl bg-[#faf9f7] p-4 text-center text-sm font-semibold text-gray-400 dark:bg-white/[0.04]">Nothing on the page for this yet.</p>}
          <ol className="space-y-2">
            {items.map((it, idx) => (
              <PlaceRow key={it.key} it={it} idx={idx} count={items.length} isSchools={isSchools} changed={changed(it)} pageLimit={list.page_limit}
                onField={(k, v) => set(it.key, d => ({ f: { ...d.f, [k]: v } }))}
                onEdit={() => set(it.key, d => ({ editing: !d.editing }))}
                onUp={() => move(idx, -1)} onDown={() => move(idx, 1)}
                onRemove={() => setItems(prev => prev.filter(x => x.key !== it.key))} />
            ))}
          </ol>
          <button onClick={add} className={`${BTN_SOFT} w-full border-dashed`}><Plus className="h-4 w-4" /> {isSchools ? 'Add a school' : 'Add a place'}</button>

          {(removedShown.length > 0 || pendingOff.length > 0) && (
            <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
              <button onClick={() => setShowRemoved(s => !s)} className="flex min-h-[40px] w-full items-center justify-between gap-2 text-left" aria-expanded={showRemoved}>
                <span className="text-xs font-black text-gray-600 dark:text-gray-300">Taken off ({removedShown.length + pendingOff.length}) - not on the page</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition ${showRemoved || pendingOff.length ? 'rotate-180' : ''}`} />
              </button>
              {(showRemoved || pendingOff.length > 0) && (
                <ul className="mt-2 space-y-2">
                  {pendingOff.map(({ e, i }) => (
                    <li key={`p${i}`} className="flex flex-col gap-2 rounded-xl bg-red-50/60 p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-red-500/[0.06]">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-black text-[#111827] dark:text-white">{e.name}</p>
                        <p className="text-[11px] font-bold text-red-600 dark:text-red-300">Comes off the page when you save</p>
                      </div>
                      <button onClick={() => keep(i)} className={BTN_SOFT}><RotateCcw className="h-3.5 w-3.5" /> Keep it</button>
                    </li>
                  ))}
                  {showRemoved && removedShown.map(({ r, i }) => (
                    <li key={`r${i}`} className="flex flex-col gap-2 rounded-xl bg-[#faf9f7] p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.04]">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-black text-[#111827] dark:text-white">{r.name}</p>
                        <p className="break-words text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          <span className="font-black">Why:</span> {cap(r.removed_reason) || 'No reason saved'}{r.removed_at ? ` · ${shortDate(r.removed_at)}` : ''}
                        </p>
                        {[r.category, r.city].filter(Boolean).length > 0 && <p className="text-[11px] font-semibold text-gray-400">{[r.category, r.city].filter(Boolean).join(' · ')}</p>}
                      </div>
                      <button onClick={() => putBack(r, i)} className={BTN_SOFT}><RotateCcw className="h-3.5 w-3.5" /> Put back</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <SaveBar dirty={dirty} saving={saving} onUndo={undo} onSave={save} label={`Save ${list.label.toLowerCase()}`} />
        </div>
      )}
    </div>
  )
}

function PlaceRow({ it, idx, count, isSchools, changed, pageLimit, onField, onEdit, onUp, onDown, onRemove }: {
  it: Draft; idx: number; count: number; isSchools: boolean; changed: boolean; pageLimit: number | null
  onField: (k: keyof Fields, v: string) => void; onEdit: () => void; onUp: () => void; onDown: () => void; onRemove: () => void
}) {
  const o = it.orig
  const meta = changed ? [it.f.category, it.f.city].filter(Boolean).join(' · ') : (o?.page?.meta || [it.f.category, it.f.city].filter(Boolean).join(' · '))
  return (
    <li className={`rounded-2xl border p-3 ${changed ? 'border-[#C9A24D]/50 bg-[#C9A24D]/[0.04]' : 'border-gray-100 dark:border-gray-800'}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#faf9f7] text-[11px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-gray-300">{idx + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] font-black leading-snug text-[#111827] dark:text-white">{it.f.name || <span className="text-gray-400">New place</span>}</p>
          {meta && <p className="mt-0.5 break-words text-[11px] font-bold uppercase tracking-wide text-gray-400">{meta}</p>}
          {!it.editing && (o?.page?.description || it.f.description) && (
            <p className="mt-1 line-clamp-3 break-words text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{changed ? it.f.description : (o?.page?.description ?? it.f.description)}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {it.ref === null && it.removed_ref === null && <Badge tone="gold">New - not saved</Badge>}
            {it.removed_ref !== null && <Badge tone="gold">Put back - not saved</Badge>}
            {it.ref !== null && changed && <Badge tone="gold">Changed - not saved</Badge>}
            {o?.admin_edited && !changed && <Badge tone="gold">{o.source_type === 'admin' ? 'Added by you' : 'Edited by you'}</Badge>}
            {o?.google_checked && <Badge tone="green">Checked on Google</Badge>}
            {o?.survey_matched && <Badge tone="green">On the federal school list</Badge>}
            {pageLimit && idx === 0 && count > 2 && <Badge>Shown big as the Local favorite</Badge>}
            {pageLimit && idx >= pageLimit && <Badge tone="red">Not shown - the page shows the first {pageLimit}</Badge>}
          </div>
        </div>
      </div>
      {it.editing && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Name" value={it.f.name} onChange={v => onField('name', v)} className="sm:col-span-2" autoFocus={!it.f.name} />
          <Field label={isSchools ? 'Grades (e.g. Grades K-8)' : 'What it is (e.g. Italian restaurant)'} value={it.f.category} onChange={v => onField('category', v)} />
          <Field label="Town" value={it.f.city} onChange={v => onField('city', v)} />
          {!isSchools && <Field label="Street address (not shown on the page)" value={it.f.address} onChange={v => onField('address', v)} className="sm:col-span-2" />}
          {!isSchools && (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11px] font-black text-gray-500 dark:text-gray-400">Short description</span>
              <textarea value={it.f.description} onChange={e => onField('description', e.target.value)} rows={2} className={`${FIELD} resize-y`} />
            </label>
          )}
          <Field label="Web link (the name links here)" value={it.f.source_url} onChange={v => onField('source_url', v)} className="sm:col-span-2" placeholder="https://" />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={onEdit} className={`${BTN_SOFT} flex-1 sm:flex-none`}>{it.editing ? <><Check className="h-4 w-4" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit</>}</button>
        <button onClick={onUp} disabled={idx === 0} className={ICON_BTN} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
        <button onClick={onDown} disabled={idx === count - 1} className={ICON_BTN} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
        <button onClick={onRemove} className={`${ICON_BTN} hover:border-red-300 hover:text-red-600`} aria-label="Take off the page"><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  )
}

function Field({ label, value, onChange, className = '', placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; className?: string; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[11px] font-black text-gray-500 dark:text-gray-400">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} className={`${FIELD} min-h-[44px]`} placeholder={placeholder} autoFocus={autoFocus} />
    </label>
  )
}

// ------------------------------------------------------------------ public schools

type SchoolDraft = { key: string; ref: number | null; name: string; district: string; orig?: AdminAreaSchool }

function PublicSchoolsEditor({ d, onSaved, onToast }: { d: AdminAreaDetail; onSaved: (d: AdminAreaDetail, what: string) => void; onToast: Toast }) {
  const ps = d.public_schools
  const signature = JSON.stringify(ps.levels)
  const fresh = useCallback(() => Object.fromEntries(ps.levels.map(l => [l.key, l.schools.map((s, i) => ({ key: nextKey(), ref: i, name: s.name || '', district: s.district || '', orig: s }))])) as Record<string, SchoolDraft[]>, [ps.levels])
  const [levels, setLevels] = useState<Record<string, SchoolDraft[]>>(fresh)
  const [saving, setSaving] = useState(false)
  const sigRef = useRef(signature)
  useEffect(() => { if (sigRef.current !== signature) { sigRef.current = signature; setLevels(fresh()) } }, [signature, fresh])

  const levelDirty = (key: string) => {
    const orig = ps.levels.find(l => l.key === key)?.schools || []
    const cur = levels[key] || []
    return cur.length !== orig.length || cur.some((s, i) => s.ref !== i || s.name.trim() !== (s.orig?.name || '') || s.district.trim() !== (s.orig?.district || ''))
  }
  const dirty = ps.levels.some(l => levelDirty(l.key))
  const edit = (lvl: string, fn: (list: SchoolDraft[]) => SchoolDraft[]) => setLevels(prev => ({ ...prev, [lvl]: fn(prev[lvl] || []) }))
  const districts = ps.districts.map(x => x.name)

  const save = async () => {
    const changedLevels = ps.levels.filter(l => levelDirty(l.key))
    if (changedLevels.some(l => (levels[l.key] || []).some(s => !s.name.trim()))) { onToast('Every school needs a name', 'error'); return }
    setSaving(true)
    const r = await api.admin.saveAreaPublicSchools(d.id, {
      levels: Object.fromEntries(changedLevels.map(l => [l.key, (levels[l.key] || []).map(s => ({ ref: s.ref, name: s.name.trim(), district: s.district.trim() || null }))])),
      base: Object.fromEntries(changedLevels.map(l => [l.key, l.schools.map(s => s.name)])),
    })
    setSaving(false)
    if (r.success && r.data) onSaved(r.data, 'Public schools')
    else onToast(r.error || "Couldn't save the public schools", 'error')
  }

  return (
    <div className={CARD}>
      <p className="text-base font-black text-[#111827] dark:text-white">Public schools</p>
      {ps.districts.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ps.districts.map(x => (
            <span key={x.name} className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-2.5 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">
              {x.name}{x.share ? <span className="rounded-full bg-white/20 px-1.5 text-[10px] dark:bg-black/10">{x.share}% of homes</span> : null}
            </span>
          ))}
        </div>
      ) : <p className="mt-1 text-xs font-semibold text-gray-400">No school district researched yet.</p>}
      {ps.boundary_caveat && <p className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{ps.boundary_caveat}</p>}
      <p className="mt-2 text-[11px] font-semibold text-gray-400">Districts and their share of homes are worked out from the MLS and district maps on every page view.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {ps.levels.map(l => (
          <div key={l.key} className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{l.label}</p>
            <ol className="mt-2 space-y-2">
              {(levels[l.key] || []).map((s, i, arr) => (
                <li key={s.key} className={`rounded-2xl border p-2.5 ${s.ref === null || s.name !== (s.orig?.name || '') || s.district !== (s.orig?.district || '') ? 'border-[#C9A24D]/50' : 'border-gray-100 dark:border-gray-800'}`}>
                  <input value={s.name} onChange={e => edit(l.key, list => list.map(x => x.key === s.key ? { ...x, name: e.target.value } : x))} aria-label={`${l.label} school name`}
                    className={`${FIELD} min-h-[42px]`} placeholder="School name" />
                  <div className="relative mt-2">
                    <select value={s.district} onChange={e => edit(l.key, list => list.map(x => x.key === s.key ? { ...x, district: e.target.value } : x))} aria-label="District"
                      className={`${FIELD} min-h-[42px] appearance-none truncate pr-8 text-xs`}>
                      <option value="">No district shown</option>
                      {Array.from(new Set([...districts, ...(s.district && !districts.includes(s.district) ? [s.district] : [])])).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {s.orig?.admin_edited && <Badge tone="gold">Edited by you</Badge>}
                    <span className="flex-1" />
                    <button onClick={() => edit(l.key, list => { const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })} disabled={i === 0} className={ICON_BTN} aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
                    <button onClick={() => edit(l.key, list => { const n = [...list]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n })} disabled={i === arr.length - 1} className={ICON_BTN} aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
                    <button onClick={() => edit(l.key, list => list.filter(x => x.key !== s.key))} className={`${ICON_BTN} hover:border-red-300 hover:text-red-600`} aria-label="Take off the page"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ol>
            <button onClick={() => edit(l.key, list => [...list, { key: nextKey(), ref: null, name: '', district: districts.length === 1 ? districts[0] : '' }])}
              className={`${BTN_SOFT} mt-2 w-full border-dashed`}><Plus className="h-4 w-4" /> Add a school</button>
          </div>
        ))}
      </div>
      <SaveBar dirty={dirty} saving={saving} onUndo={() => setLevels(fresh())} onSave={save} label="Save public schools" />
    </div>
  )
}

