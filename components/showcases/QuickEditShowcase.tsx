'use client'

// "Edit Showcase" from a lead or an open house guest (owner, 11/01): the few things an agent
// changes after talking to someone - price, beds/baths, size, how new, towns, schools - and taking
// off the open house's distance circle, without hunting for their Showcase. Starts from what the
// Showcase has now, shows how many homes would match as you go, and saves through the same
// update-and-refresh the full editor uses (their follow-up picks it up). Phone: a bottom sheet.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Check, Loader2, MapPin, X } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import MultiSelectDatabaseInput from '@/components/MultiSelectDatabaseInput'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { formatNumberWithCommas, stripCommas } from '@/lib/utils'
import { tidyAllCaps } from '@/lib/cheatSheetContent'

export type QuickShowcase = { id: string; name?: string | null }

type Form = {
  min_price: string; max_price: string; min_beds: number | null; min_baths: number | null
  min_sqft: string; max_sqft: string; min_year_built: string
  cities: string[]; townships: string[]; school_districts: string[]; dropRadius: boolean
}

const BEDS = [null, 1, 2, 3, 4, 5]
const BATHS = [null, 1, 1.5, 2, 3]
const num = (s: string) => { const n = Number(stripCommas(s || '')); return s && Number.isFinite(n) && n > 0 ? Math.round(n) : null }
const str = (n: unknown) => (n == null || n === '' || Number(n) <= 0 ? '' : formatNumberWithCommas(Number(n)))

// The rest of the search this window doesn't edit - shown so a low count is never a mystery.
function otherFilters(p: any): string[] {
  if (!p) return []
  const types = [['is_single_family', 'Single family'], ['is_town_house', 'Townhouses'], ['is_condo', 'Condos'], ['is_multi_family', 'Multi-family'],
    ['is_lot_land', 'Land'], ['is_farm', 'Farms'], ['is_commercial', 'Commercial'], ['is_apartment', 'Rentals']].filter(([k]) => p[k]).map(([, l]) => l)
  return [
    types.length ? types.join(', ') : '',
    (p.counties || []).length ? `${(p.counties as string[]).map(c => c.split(',')[0]).join(', ')} County` : '',
    p.max_beds > 0 ? `up to ${p.max_beds} beds` : '',
    p.max_baths > 0 ? `up to ${p.max_baths} baths` : '',
    p.min_acres > 0 || p.max_acres > 0 ? `${p.min_acres > 0 ? `${p.min_acres}+` : ''}${p.max_acres > 0 ? `${p.min_acres > 0 ? ' to ' : 'up to '}${p.max_acres}` : ''} acres` : '',
    p.max_year_built ? `built by ${p.max_year_built}` : '',
    p.search_polygon ? 'an area drawn on the map' : '',
    p.special_features ? `"${String(p.special_features).slice(0, 40)}"` : '',
  ].filter(Boolean)
}

function formFrom(p: any): Form {
  return {
    min_price: str(p?.min_price), max_price: str(p?.max_price),
    min_beds: p?.min_beds || null, min_baths: p?.min_baths || null,
    min_sqft: str(p?.min_sqft), max_sqft: str(p?.max_sqft), min_year_built: p?.min_year_built ? String(p.min_year_built) : '',
    cities: p?.cities || [], townships: p?.townships || [], school_districts: p?.school_districts || [], dropRadius: false,
  }
}

/** What changed, as the update the server takes. */
function changesOf(p: any, f: Form): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const set = (k: string, v: unknown, was: unknown) => { if (JSON.stringify(v ?? null) !== JSON.stringify(was ?? null)) out[k] = v }
  set('min_price', num(f.min_price), p?.min_price || null)
  set('max_price', num(f.max_price), p?.max_price || null)
  set('min_beds', f.min_beds, p?.min_beds || null)
  set('min_baths', f.min_baths, p?.min_baths || null)
  set('min_sqft', num(f.min_sqft), p?.min_sqft || null)
  set('max_sqft', num(f.max_sqft), p?.max_sqft || null)
  const yr = num(f.min_year_built)
  set('min_year_built', yr && yr > 1700 && yr < 2100 ? yr : null, p?.min_year_built || null)
  set('cities', f.cities, p?.cities || [])
  set('townships', f.townships, p?.townships || [])
  set('school_districts', f.school_districts, p?.school_districts || [])
  if (f.dropRadius) Object.assign(out, { address: '', lat: null, long: null, diameter: null })
  return out
}

export default function QuickEditShowcase({ open, onClose, leadId, showcases: given, initialId, who, onSaved }: {
  open: boolean
  onClose: () => void
  /** Their lead - its Showcases are offered when there's more than one. */
  leadId?: string | null
  showcases?: QuickShowcase[]
  initialId?: string | null
  who?: string | null
  onSaved?: (r: { id: string; count: number; added: number; removed: number }) => void
}) {
  const { showToast } = useToast()
  const [list, setList] = useState<QuickShowcase[]>(given || [])
  const [id, setId] = useState<string | null>(initialId || given?.[0]?.id || null)
  const [prefs, setPrefs] = useState<any>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [count, setCount] = useState<{ n: number; limit?: boolean } | null>(null)
  const [counting, setCounting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // What the client asked for from their Showcase ("Could you add Downingtown too?") - shown here,
  // and marked handled when this saves (its follow-up is checked off too).
  const [asked, setAsked] = useState<string | null>(null)

  // Their Showcases (a guest can have two - pick which).
  useEffect(() => {
    if (!open) return
    setDone(null)
    if (given?.length) { setList(given); setId(i => (i && given.some(s => s.id === i) ? i : initialId || given[0].id)); return }
    if (!leadId) return
    api.leads.get(leadId).then(r => {
      const scs = (r.data?.showcases || []).map(s => ({ id: s.id, name: s.name }))
      if (initialId && !scs.some(s => s.id === initialId)) scs.unshift({ id: initialId, name: null })
      setList(scs)
      setId(i => i || initialId || scs[0]?.id || null)
    })
  }, [open, leadId, given, initialId])
  useEffect(() => { if (open && initialId) setId(initialId) }, [open, initialId])

  // The Showcase's search as it is now.
  useEffect(() => {
    if (!open || !id) return
    setPrefs(null); setForm(null); setCount(null); setNote(null)
    api.collections.getById(id).then(r => {
      const p = r.data?.preferences || {}
      setPrefs(p); setForm(formFrom(p))
      setAsked(r.data?.refine_request_message || null)
    })
  }, [open, id])

  const changes = useMemo(() => (prefs && form ? changesOf(prefs, form) : {}), [prefs, form])
  const dirty = Object.keys(changes).length > 0
  const radius = !!(prefs?.address && prefs?.diameter && prefs?.lat != null)
  const places = !!(form && (form.cities.length || form.townships.length || (prefs?.counties || []).length))
  const area = !!(form && (places || form.school_districts.length || (radius && !form.dropRadius) || prefs?.search_polygon))

  // Live "N homes match" as they change things (same search Save runs).
  const seq = useRef(0)
  useEffect(() => {
    if (!open || !prefs || !form) return
    if (!area) { setCount(null); return }
    const mine = ++seq.current
    setCounting(true)
    const t = window.setTimeout(async () => {
      const { id: _i, collection_id: _c, created_at: _a, updated_at: _u, ...saved } = prefs
      const r = await api.collections.previewMatches({ ...saved, ...changes } as any)
      if (mine !== seq.current) return
      setCounting(false)
      if (r.success && r.data) setCount({ n: r.data.count, limit: r.data.at_limit })
    }, 450)
    return () => window.clearTimeout(t)
  }, [open, prefs, form, changes, area])

  const save = useCallback(async () => {
    if (!id || !dirty || !area) return
    setSaving(true)
    const r = await api.collections.updatePreferencesAndRefresh(id, changes) as any
    setSaving(false)
    if (!r.success) { showToast(r.error || "Couldn't update their Showcase", 'error'); return }
    if (asked) { await api.collections.dismissRefineRequest(id); setAsked(null) }
    const d = r.data || {}
    const n = d.properties_count ?? count?.n ?? 0
    const delta = [d.added ? `${d.added} new` : '', d.removed ? `${d.removed} gone` : ''].filter(Boolean).join(' · ')
    const line = `Updated - ${n} ${n === 1 ? 'home' : 'homes'}${delta ? ` (${delta})` : ''}`
    setDone(line)
    showToast(`${who ? `${who.split(' ')[0]}'s Showcase` : 'Showcase'} updated - ${n} ${n === 1 ? 'home' : 'homes'}${delta ? ` (${delta})` : ''}`, 'success')
    setPrefs({ ...prefs, ...changes })
    setForm(f => (f ? { ...f, dropRadius: false } : f))
    onSaved?.({ id, count: n, added: d.added || 0, removed: d.removed || 0 })
    window.setTimeout(onClose, 900)
  }, [id, dirty, area, changes, count, prefs, who, onSaved, onClose, showToast, asked])

  // A max under the open house's starting min (owner, 11/01: "looking for 1.15M max" on a $6M-$9M
  // open house search) clears that min instead of matching nothing.
  const up = (patch: Partial<Form>) => setForm(f => {
    if (!f) return f
    const next = { ...f, ...patch }
    const cleared: string[] = []
    if ('max_price' in patch && num(next.max_price) && num(next.min_price) && num(next.max_price)! < num(next.min_price)!) { next.min_price = ''; cleared.push('min price') }
    if ('max_sqft' in patch && num(next.max_sqft) && num(next.min_sqft) && num(next.max_sqft)! < num(next.min_sqft)!) { next.min_sqft = ''; cleared.push('min sq ft') }
    if (cleared.length) setNote(`Cleared the ${cleared.join(' and ')} - it was above the new max.`)
    return next
  })
  // Start from scratch: drop the open house's starting search (price, beds, baths, size, the circle).
  const fresh = () => {
    setForm(f => (f ? { ...f, min_price: '', max_price: '', min_beds: null, min_baths: null, min_sqft: '', max_sqft: '', min_year_built: '', dropRadius: radius } : f))
    setNote(radius ? 'Cleared - add a town or school district, then what they want.' : 'Cleared - set what they want.')
  }
  const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] font-bold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-2 focus:ring-[#C9A24D]/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-white'
  const label = 'mb-1.5 block text-[10.5px] font-black uppercase tracking-[0.14em] text-gray-400'
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-[12px] font-black transition active:scale-95 ${on
    ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]'
    : 'border-gray-200 bg-white text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300'}`
  const current = list.find(s => s.id === id)

  const footer = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 text-[12px] font-bold text-gray-500 dark:text-gray-400" data-testid="quick-edit-count">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={done || (!area ? 'area' : counting ? 'counting' : String(count?.n))} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="block truncate">
            {done ? <span className="text-emerald-700 dark:text-emerald-300">{done}</span>
              : !area ? <span className="text-amber-700 dark:text-amber-300">Pick a town or school district</span>
              : counting || !count ? 'Counting homes…'
              : <><b className="text-[#111827] dark:text-white">{count.n}{count.limit ? '+' : ''}</b> {count.n === 1 ? 'home matches' : 'homes match'}</>}
          </motion.span>
        </AnimatePresence>
      </div>
      <button type="button" onClick={save} disabled={!dirty || !area || saving || !!done} data-testid="quick-edit-save"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-[13px] font-black text-white transition hover:bg-black active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-[#111827]">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4" /> : null} {done ? 'Saved' : 'Save'}
      </button>
    </div>
  )

  return (
    <OhSheet open={open} onClose={onClose} width="max-w-lg" title="Edit Showcase"
      subtitle={who ? `${who}${current?.name ? ` · ${tidyAllCaps(current.name)}` : ''}` : current?.name ? tidyAllCaps(current.name) : undefined}
      footer={id ? footer : undefined}>
      <div className="space-y-5" data-testid="quick-edit-showcase">
        {list.length > 1 && (
          <div>
            <span className={label}>Which Showcase</span>
            <div className="flex flex-wrap gap-1.5">
              {list.map(s => (
                <button key={s.id} type="button" onClick={() => setId(s.id)} className={chip(s.id === id)} data-testid="quick-edit-pick">
                  {tidyAllCaps(s.name || 'Showcase')}
                </button>
              ))}
            </div>
          </div>
        )}

        {!id && <p className="py-6 text-center text-sm font-bold text-gray-400">They don&apos;t have a Showcase yet.</p>}
        {id && !form && <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /></div>}

        {form && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <AnimatePresence mode="wait" initial={false}>
                {note ? (
                  <motion.p key={note} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="quick-edit-note"
                    className="text-[12px] font-bold leading-snug text-amber-700 dark:text-amber-300">{note}</motion.p>
                ) : <span key="none" />}
              </AnimatePresence>
              <button type="button" onClick={fresh} data-testid="quick-edit-fresh"
                className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black text-gray-600 transition hover:border-[#C9A24D] active:scale-95 dark:border-white/10 dark:text-gray-300">
                Start from scratch
              </button>
            </div>

            {asked && (
              <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-3.5 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10" data-testid="quick-edit-asked">
                <p className="text-[10.5px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">They asked you</p>
                <p className="mt-0.5 text-[13px] font-bold text-amber-900 dark:text-amber-100">&ldquo;{asked}&rdquo;</p>
                <p className="mt-1 text-[11px] font-semibold text-amber-700/80 dark:text-amber-300/80">Saving marks it done.</p>
              </div>
            )}

            {/* Where */}
            <div>
              <span className={label}>Where</span>
              <AnimatePresence initial={false}>
                {radius && !form.dropRadius && (
                  <motion.div key="radius" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mb-2 flex items-center gap-2.5 rounded-2xl border border-[#C9A24D]/40 bg-[#C9A24D]/[0.07] px-3 py-2.5" data-testid="quick-edit-radius">
                      <MapPin className="h-4 w-4 shrink-0 text-[#8b7355] dark:text-[#e8c97a]" />
                      <span className="min-w-0 flex-1 text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">
                        Within {prefs.diameter} mi of {tidyAllCaps(String(prefs.address).split(',')[0])}
                        {places && <span className="block text-[11px] font-semibold text-gray-500">Not used - the towns below are the search</span>}
                      </span>
                      <button type="button" onClick={() => up({ dropRadius: true })} data-testid="quick-edit-remove-radius"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-gray-600 shadow-sm ring-1 ring-black/5 hover:text-red-600 dark:bg-white/10 dark:text-gray-200">
                        <X className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {form.dropRadius && (
                <p className="mb-2 flex items-center gap-2 text-[12px] font-bold text-gray-500">
                  Distance search removed.
                  <button type="button" onClick={() => up({ dropRadius: false })} className="font-black text-[#8b7355] underline dark:text-[#e8c97a]">Undo</button>
                </p>
              )}
              <MultiSelectDatabaseInput values={form.cities} apiMethod={api.properties.citiesPublic} placeholder="Add towns…" onChange={cities => up({ cities })} />
              {form.townships.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.townships.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11.5px] font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                      {tidyAllCaps(t.split(',')[0])} <button type="button" aria-label={`Remove ${t}`} onClick={() => up({ townships: form.townships.filter(x => x !== t) })}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className={label}>School district</span>
              <MultiSelectDatabaseInput values={form.school_districts} apiMethod={api.properties.schoolDistrictsPublic} placeholder="Add a school district…" onChange={school_districts => up({ school_districts })} />
            </div>

            {/* Price */}
            <div>
              <span className={label}>Price</span>
              <div className="grid grid-cols-2 gap-2">
                <input inputMode="numeric" placeholder="No min" value={form.min_price ? `$${form.min_price}` : ''} aria-label="Min price"
                  onChange={e => up({ min_price: formatNumberWithCommas(e.target.value.replace(/[^\d]/g, '')) })} className={field} />
                <input inputMode="numeric" placeholder="No max" value={form.max_price ? `$${form.max_price}` : ''} aria-label="Max price" data-testid="quick-edit-max-price"
                  onChange={e => up({ max_price: formatNumberWithCommas(e.target.value.replace(/[^\d]/g, '')) })} className={field} />
              </div>
            </div>

            {/* Beds / baths */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={label}>Beds</span>
                <div className="flex flex-wrap gap-1.5">{BEDS.map(b => <button key={String(b)} type="button" className={chip(form.min_beds === b)} onClick={() => up({ min_beds: b })}>{b == null ? 'Any' : `${b}+`}</button>)}</div>
              </div>
              <div>
                <span className={label}>Baths</span>
                <div className="flex flex-wrap gap-1.5">{BATHS.map(b => <button key={String(b)} type="button" className={chip(form.min_baths === b)} onClick={() => up({ min_baths: b })}>{b == null ? 'Any' : `${b}+`}</button>)}</div>
              </div>
            </div>

            {/* Size + age */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={label}>Sq ft</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <input inputMode="numeric" placeholder="Min" value={form.min_sqft} aria-label="Min sq ft" onChange={e => up({ min_sqft: formatNumberWithCommas(e.target.value.replace(/[^\d]/g, '')) })} className={field} />
                  <input inputMode="numeric" placeholder="Max" value={form.max_sqft} aria-label="Max sq ft" data-testid="quick-edit-max-sqft" onChange={e => up({ max_sqft: formatNumberWithCommas(e.target.value.replace(/[^\d]/g, '')) })} className={field} />
                </div>
              </div>
              <div>
                <span className={label}>Built in or after</span>
                <input inputMode="numeric" maxLength={4} placeholder="Any year" value={form.min_year_built} aria-label="Built in or after" data-testid="quick-edit-year"
                  onChange={e => up({ min_year_built: e.target.value.replace(/[^\d]/g, '').slice(0, 4) })} className={field} />
              </div>
            </div>

            {otherFilters(prefs).length > 0 && (
              <p className="text-[11.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400" data-testid="quick-edit-also">
                <span className="font-black text-gray-600 dark:text-gray-300">Also in this search:</span> {otherFilters(prefs).join(' · ')}
              </p>
            )}

            <Link href={`/showcases?showcase=${id}`} onClick={onClose}
              className="inline-flex items-center gap-1 text-[12px] font-black text-[#8b7355] hover:text-[#111827] dark:text-[#e8c97a]">
              Open their Showcase for every search option <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </div>
    </OhSheet>
  )
}
