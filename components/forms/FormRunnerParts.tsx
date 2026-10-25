'use client'

// Pieces of the guest form (FormRunner) added 10/24 (user's fix list, group 07):
//  - WheelPicker: tap / scroll pickers for price, beds, baths, lot size, sq ft and build year -
//    no keyboard, Zillow-style price steps, the same on a phone and a computer.
//  - AreaPicker: "Where are you looking?" as three rows (towns OR school districts OR counties) -
//    each opens a slide-up sheet (phone) / window (computer) to search and pick.
//  - ShowcaseTrail: the Showcase-builder header on the home-search questions (the creator /
//    editor's look brought into the form).
//  - useFormViewportLock: the public form page sits still - the keyboard can't drag it down and
//    the progress bar + agent branding always stay in view.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BedDouble, Building2, CalendarDays, Check, ChevronDown, DollarSign, GraduationCap, Home, LandPlot, Loader2, MapPin, Plus, Ruler, Search, Sparkles, X } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import type { ApiResponse, FormQuestion } from '@/types'

// --------------------------------------------------------------------------------------------
// Pickers

export type PickerKind = 'price' | 'beds' | 'baths' | 'acres' | 'sqft' | 'year'
type FieldLike = { id: string; type: string; label?: string | null }

/** Which picker a number / money answer gets - null = it stays a typed answer (e.g. what's owed on a mortgage). */
export function pickerKindOf(f: FieldLike): PickerKind | null {
  if (f.type !== 'number' && f.type !== 'currency') return null
  const k = `${f.id} ${f.label || ''}`.toLowerCase()
  if (/year|built/.test(k)) return 'year'
  if (/acre|\blot\b/.test(k)) return 'acres'
  if (/sq\s*ft|sqft|square/.test(k)) return 'sqft'
  if (/bath/.test(k)) return 'baths'
  if (/bed/.test(k)) return 'beds'
  if (f.type === 'currency' && /price|budget/.test(k)) return 'price'
  return null
}

export type PickOption = { value: string; label: string }

const money = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2).replace(/0$/, '')}M` : `$${Math.round(n / 1000)}K`
const range = (a: number, b: number, s: number) => { const out: number[] = []; for (let v = a; v <= b + 1e-9; v += s) out.push(Math.round(v * 100) / 100); return out }

// Zillow's price steps: $25K to $500K, $50K to $1M, $250K to $5M, then $1M.
const PRICES = [...range(50_000, 500_000, 25_000), ...range(550_000, 1_000_000, 50_000), ...range(1_250_000, 5_000_000, 250_000), ...range(6_000_000, 10_000_000, 1_000_000)]
const SQFT = [...range(500, 4000, 250), ...range(4500, 7000, 500), 8000, 9000, 10000]
const ACRES = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50, 100]

/** The steps for one answer. `empty` = what "nothing picked" reads as (No min / No max / Any). */
export function pickerOptions(kind: PickerKind, f: FieldLike, empty: string, current?: string): PickOption[] {
  const k = `${f.id} ${f.label || ''}`.toLowerCase()
  const atLeast = /min|at least|desired/.test(k)
  let nums: number[]
  let label: (n: number) => string
  switch (kind) {
    case 'price': nums = PRICES; label = money; break
    case 'beds': nums = range(1, 8, 1); label = n => `${n}${atLeast ? '+' : ''}`; break
    case 'baths': nums = /partial|half/.test(k) ? range(0, 4, 1) : [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6]; label = n => `${n}${atLeast && n > 0 ? '+' : ''}`; break
    case 'acres': nums = ACRES; label = n => `${n} ${n === 1 ? 'acre' : 'acres'}`; break
    case 'sqft': nums = SQFT; label = n => `${n.toLocaleString()} sq ft`; break
    default: {
      const now = new Date().getFullYear()
      nums = [1900, 1920, 1940, ...range(1950, 2010, 5), ...range(2011, now + 1, 1)]
      label = n => String(n)
    }
  }
  // Something already typed / handed over that isn't one of the steps keeps its place in the list.
  const cur = Number(current)
  if (current && Number.isFinite(cur) && !nums.includes(cur)) nums = [...nums, cur].sort((a, b) => a - b)
  return [{ value: '', label: empty }, ...nums.map(n => ({ value: String(n), label: label(n) }))]
}

/** "No min" / "No max" / "Any" - from the answer's own words. */
export function emptyLabelOf(f: FieldLike, grouped: boolean): string {
  const k = `${f.id} ${f.label || ''}`.toLowerCase()
  if (/\bmax|before|at most/.test(k)) return 'No max'
  if (/\bmin|after|at least/.test(k)) return 'No min'
  return grouped ? 'Any' : 'Not sure'
}

const ROW = 40
const ROWS = 5

/** A scroll wheel: flick or drag it (phone), scroll or click (computer), arrow keys too. The pick
 *  is the row in the band in the middle; rows tilt away above and below it like an iPhone wheel. */
export function WheelPicker({ options, value, onChange, accent, label, compact = false }: {
  options: PickOption[]
  value: string
  onChange: (value: string) => void
  accent: string
  label: string
  compact?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const index = Math.max(0, options.findIndex(o => o.value === value))
  const rows = compact ? 3 : ROWS
  const pad = ((rows - 1) / 2) * ROW
  const lastUser = useRef(0)
  const tick = useRef(index)
  const settle = useRef<number | null>(null)
  const frame = useRef<number | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  // Each row's tilt / fade from its distance to the middle band - written straight to the rows
  // (no re-render while scrolling, so it stays smooth on a phone).
  const paint = () => {
    const el = ref.current
    if (!el) return
    const top = el.scrollTop
    const items = el.children
    for (let i = 0; i < items.length; i++) {
      const d = (i * ROW - top) / ROW
      const a = Math.min(Math.abs(d), 3)
      const s = (items[i] as HTMLElement).style
      s.transform = `rotateX(${(-d * 16).toFixed(1)}deg) scale(${(1 - a * 0.07).toFixed(3)})`
      s.opacity = String(Math.max(0.12, 1 - a * 0.32))
    }
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // An answer changed from outside (Any / No preference, Back) - roll there; never while a finger
    // or wheel is on it.
    if (Date.now() - lastUser.current > 400 && Math.abs(el.scrollTop - index * ROW) > 1) {
      const smooth = el.dataset.ready === '1'
      el.scrollTo({ top: index * ROW, behavior: smooth ? 'smooth' : 'auto' })
    }
    el.dataset.ready = '1'
    tick.current = index
    paint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const commit = () => {
    const el = ref.current
    if (!el) return
    const i = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / ROW)))
    if (options[i] && options[i].value !== valueRef.current) onChange(options[i].value)
  }

  const onScroll = () => {
    lastUser.current = Date.now()
    if (frame.current == null) frame.current = requestAnimationFrame(() => { frame.current = null; paint() })
    const el = ref.current
    if (el) {
      const i = Math.round(el.scrollTop / ROW)
      if (i !== tick.current) { tick.current = i; try { navigator.vibrate?.(4) } catch { /* not supported */ } }
    }
    if (settle.current) window.clearTimeout(settle.current)
    settle.current = window.setTimeout(commit, 140)
  }

  const go = (i: number) => {
    const el = ref.current
    if (!el) return
    const n = Math.max(0, Math.min(options.length - 1, i))
    lastUser.current = Date.now()
    el.scrollTo({ top: n * ROW, behavior: 'smooth' })
  }

  // A computer's mouse wheel moves one row per notch (a trackpad's small steps add up to rows).
  const wheelAcc = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      wheelAcc.current += e.deltaY
      const step = Math.abs(e.deltaY) >= 50 ? Math.sign(e.deltaY) : Math.trunc(wheelAcc.current / 36)
      if (!step) return
      wheelAcc.current = 0
      const cur = Math.round(el.scrollTop / ROW)
      go(cur + step)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length])

  const fade = 'linear-gradient(to bottom, transparent 0%, #000 34%, #000 66%, transparent 100%)'
  return (
    <div className="fr-wheel relative select-none overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] dark:border-white/10 dark:bg-[#151517]"
      style={{ height: rows * ROW, perspective: 600 }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-1.5 rounded-xl"
        style={{ top: pad, height: ROW, backgroundColor: `${accent}1A`, boxShadow: `inset 0 0 0 1.5px ${accent}59` }} />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); go(Math.round((ref.current?.scrollTop || 0) / ROW) + 1) }
          if (e.key === 'ArrowUp') { e.preventDefault(); go(Math.round((ref.current?.scrollTop || 0) / ROW) - 1) }
        }}
        data-no-sheet-drag=""
        className="fr-wheel-scroll absolute inset-0 snap-y snap-mandatory overflow-y-scroll overscroll-contain outline-none"
        style={{ paddingTop: pad, paddingBottom: pad, maskImage: fade, WebkitMaskImage: fade, scrollbarWidth: 'none', transformStyle: 'preserve-3d' }}
      >
        {options.map((o, i) => (
          <button
            key={o.value || 'none'}
            type="button"
            role="option"
            aria-selected={i === index}
            tabIndex={-1}
            onClick={() => go(i)}
            className={`flex w-full snap-center items-center justify-center whitespace-nowrap px-2 text-[17px] font-black tabular-nums tracking-tight ${o.value ? 'text-[#0B0B0B] dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}
            style={{ height: ROW, willChange: 'transform, opacity' }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export const WHEEL_CSS = `.fr-wheel-scroll::-webkit-scrollbar{display:none}`

// --------------------------------------------------------------------------------------------
// Where are you looking?

export const US_STATE_BY_ABBR: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

/** "PA" / "pa" / "Pennsylvania" -> "Pennsylvania" (null when it isn't a state). */
export function stateNameOf(raw?: string | null): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  if (US_STATE_BY_ABBR[s.toUpperCase()]) return US_STATE_BY_ABBR[s.toUpperCase()]
  return Object.values(US_STATE_BY_ABBR).find(n => n.toLowerCase() === s.toLowerCase()) || null
}

export const isAreaField = (t: string) => t === 'city_multiselect' || t === 'school_district_multiselect' || t === 'county_multiselect'

const tidy = (name: string) => {
  const [main, st] = name.split(',')
  const t = main.toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase())
  return st ? `${t}, ${st.trim().toUpperCase()}` : t
}

const AREA_META: Record<string, { title: string; icon: typeof MapPin; blank: string; search: string }> = {
  city_multiselect: { title: 'Towns', icon: MapPin, blank: 'Any town or city', search: 'Search towns...' },
  school_district_multiselect: { title: 'School districts', icon: GraduationCap, blank: 'Any school district', search: 'Search school districts...' },
  county_multiselect: { title: 'Counties', icon: Building2, blank: 'Any county', search: 'Search counties...' },
}

type AreaApi = (query: string) => Promise<ApiResponse<{ results: string[] }>>

/** The whole "Where are you looking?" answer: towns OR school districts OR counties (any one is
 *  enough - more of them sharpen the search), plus the state, already set to the agent's. */
export function AreaPicker({ fields, answers, setAnswer, accent, apiFor }: {
  fields: { id: string; type: string; label: string; options?: string[] | null }[]
  answers: Record<string, string | string[]>
  setAnswer: (id: string, value: string | string[]) => void
  accent: string
  apiFor: (type: string) => AreaApi
}) {
  const [open, setOpen] = useState<string | null>(null)
  const areaFields = fields.filter(f => isAreaField(f.type))
  const stateField = fields.find(f => f.id === 'state' && f.type === 'select')
  const stateValue = stateField && typeof answers[stateField.id] === 'string' ? (answers[stateField.id] as string) : ''
  const openField = fields.find(f => f.id === open)
  const anyPicked = areaFields.some(f => Array.isArray(answers[f.id]) && (answers[f.id] as string[]).length > 0)
  return (
    <div className="text-left">
      <div className="mb-3 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-semibold leading-snug text-[#4b5563] dark:text-gray-300" style={{ backgroundColor: `${accent}12` }}>
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
        <span>Pick <b className="font-black text-[#111827] dark:text-white">any one</b> - a town, a school district or a county. Add more to sharpen your search.</span>
      </div>
      <div className="space-y-1.5">
        {areaFields.map((f, n) => {
          const meta = AREA_META[f.type]
          const Icon = meta.icon
          const picked = Array.isArray(answers[f.id]) ? (answers[f.id] as string[]) : []
          return (
            <div key={f.id}>
              {n > 0 && (
                <div className="flex items-center gap-3 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">
                  <span className="h-px flex-1 bg-current opacity-40" />or<span className="h-px flex-1 bg-current opacity-40" />
                </div>
              )}
              <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setOpen(f.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 text-left dark:border-white/10 shadow-[0_10px_24px_-22px_rgba(17,24,39,.7)] transition-colors dark:bg-[#151517]"
                style={{ borderColor: picked.length ? `${accent}80` : undefined }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" data-fill={picked.length ? '' : undefined}
                  style={picked.length ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: `${accent}1A`, color: accent }}>
                  {picked.length ? <Check className="h-4 w-4" strokeWidth={3} /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#111827] dark:text-white">{meta.title}</span>
                  <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{picked.length ? picked.map(tidy).join(' · ') : meta.blank}</span>
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-300">
                  {picked.length ? <span className="text-[11px] font-black" style={{ color: accent }}>{picked.length}</span> : <Plus className="h-4 w-4" />}
                </span>
              </motion.button>
            </div>
          )
        })}
      </div>
      {stateField && (
        <button type="button" onClick={() => setOpen(stateField.id)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-600 transition hover:border-gray-300 dark:border-white/10 dark:bg-[#151517] dark:text-gray-300">
          <MapPin className="h-3.5 w-3.5" style={{ color: accent }} />
          {stateValue ? <>Searching in <b className="font-black text-[#111827] dark:text-white">{stateValue}</b></> : 'Pick a state'}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      )}
      {!anyPicked && <p className="sr-only">Nothing picked yet - that's fine, you can skip this.</p>}

      <OhSheet open={!!openField} onClose={() => setOpen(null)} width="max-w-lg"
        title={openField ? (openField.id === stateField?.id ? 'State' : AREA_META[openField.type]?.title) : ''}
        subtitle={openField?.id === stateField?.id ? 'Where you want to live' : 'Pick as many as you like'}
        icon={(() => { const I = openField && AREA_META[openField.type] ? AREA_META[openField.type].icon : MapPin; return <I className="h-5 w-5" style={{ color: accent }} /> })()}
        footer={openField && openField.id !== stateField?.id ? (
          <button type="button" onClick={() => setOpen(null)} data-fill=""
            className="w-full rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-lg active:scale-[0.98]" style={{ backgroundColor: accent }}>
            Done
          </button>
        ) : undefined}>
        {openField && openField.id === stateField?.id ? (
          <StateList options={stateField.options || Object.values(US_STATE_BY_ABBR)} value={stateValue} accent={accent}
            onPick={v => { setAnswer(stateField.id, v); setOpen(null) }} />
        ) : openField ? (
          <AreaSearch key={openField.id} api={apiFor(openField.type)} placeholder={AREA_META[openField.type].search} accent={accent}
            values={Array.isArray(answers[openField.id]) ? (answers[openField.id] as string[]) : []}
            onChange={v => setAnswer(openField.id, v)} />
        ) : null}
      </OhSheet>
    </div>
  )
}

function AreaSearch({ api, values, onChange, placeholder, accent }: { api: AreaApi; values: string[]; onChange: (v: string[]) => void; placeholder: string; accent: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    let live = true
    const t = window.setTimeout(async () => {
      try {
        const r = await api(query)
        if (live && r.success && r.data) setResults(r.data.results || [])
      } finally { if (live) setLoading(false) }
    }, 250)
    return () => { live = false; window.clearTimeout(t) }
  }, [q, api])
  const toggle = (name: string) => onChange(values.includes(name) ? values.filter(v => v !== name) : [...values, name])
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} enterKeyHint="search"
          className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-10 text-base font-semibold text-[#111827] outline-none transition focus:border-current dark:border-white/10 dark:bg-[#151517] dark:text-white"
          style={{ caretColor: accent }} />
        {loading && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" style={{ color: accent }} />}
      </div>
      {values.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {values.map(v => (
              <motion.button layout key={v} type="button" onClick={() => toggle(v)} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                className="inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-2 text-xs font-black text-white" data-fill="" style={{ backgroundColor: accent }}>
                {tidy(v)} <X className="h-3.5 w-3.5 opacity-80" />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
      <div className="mt-3 space-y-1">
        {q.trim().length < 2 ? (
          <p className="px-1 py-6 text-center text-sm font-semibold text-gray-400">Start typing a name - pick one or several.</p>
        ) : !loading && results.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm font-semibold text-gray-400">No matches for &ldquo;{q.trim()}&rdquo;</p>
        ) : results.map(r => {
          const on = values.includes(r)
          return (
            <button key={r} type="button" onClick={() => toggle(r)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-bold text-[#111827] transition hover:bg-black/[0.03] dark:text-white dark:hover:bg-white/[0.05]">
              {tidy(r)}
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition" data-fill={on ? '' : undefined}
                style={on ? { borderColor: accent, backgroundColor: accent, color: '#fff' } : { borderColor: '#d1d5db' }}>
                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StateList({ options, value, onPick, accent }: { options: string[]; value: string; onPick: (v: string) => void; accent: string }) {
  const [q, setQ] = useState('')
  const shown = q.trim() ? options.filter(o => o.toLowerCase().includes(q.trim().toLowerCase())) : options
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' }) }, [])
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search states..."
          className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-base font-semibold text-[#111827] outline-none dark:border-white/10 dark:bg-[#151517] dark:text-white" />
      </div>
      <div ref={list} className="mt-3 space-y-1">
        {shown.map(o => (
          <button key={o} type="button" aria-selected={o === value} onClick={() => onPick(o)}
            className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-bold text-[#111827] transition hover:bg-black/[0.03] dark:text-white dark:hover:bg-white/[0.05]"
            style={o === value ? { backgroundColor: `${accent}1A` } : undefined}>
            {o}{o === value && <Check className="h-4 w-4" style={{ color: accent }} />}
          </button>
        ))}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------------------
// The Showcase builder look on the home-search questions

// The questions that build the visitor's Showcase all hang off "working with an agent?".
const SHOWCASE_GATES = new Set(['has_agent', 'sc_has_agent', 'buy_working_with_agent'])

type ShowcaseStep = { key: string; title: string; icon: typeof MapPin }
const fieldIds = (q: FormQuestion) => new Set((q.fields || []).map(f => f.id))

export function showcaseStepOf(q: FormQuestion | null | undefined): ShowcaseStep | null {
  if (!q || !q.depends_on || !SHOWCASE_GATES.has(q.depends_on.question_id)) return null
  const ids = fieldIds(q)
  if (ids.has('cities')) return { key: 'area', title: 'Where', icon: MapPin }
  if (ids.has('budget_min')) return { key: 'price', title: 'Budget', icon: DollarSign }
  if (ids.has('min_bedrooms') || ids.has('buy_bedrooms')) return { key: 'beds', title: 'Bedrooms', icon: BedDouble }
  if (ids.has('min_acres')) return { key: 'lot', title: 'Lot size', icon: LandPlot }
  if (ids.has('min_sqft')) return { key: 'size', title: 'Living space', icon: Ruler }
  if (ids.has('min_year_built')) return { key: 'age', title: 'Build year', icon: CalendarDays }
  if (q.id === 'home_type') return { key: 'type', title: 'Home type', icon: Home }
  if (q.id === 'key_features') return { key: 'features', title: 'Must-haves', icon: Sparkles }
  return null
}

const filled = (v: unknown) => Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim())

/** Is anything picked on this question (for the trail's checks + the card's gold edge)? */
export function questionHasAnswer(q: FormQuestion, answers: Record<string, unknown>): boolean {
  if (q.type === 'contact_group') return (q.fields || []).some(f => f.id !== 'state' && filled(answers[f.id]))
  return filled(answers[q.id])
}

/** Header over a home-search question: "Building your Showcase", then one icon per step - done
 *  ones ticked, this one lit - like the creator's Client > About them > Search area trail. */
export function ShowcaseTrail({ steps, currentId, answers, accent }: {
  steps: FormQuestion[]
  currentId: string
  answers: Record<string, unknown>
  accent: string
}) {
  const at = steps.findIndex(s => s.id === currentId)
  return (
    <div className="mb-4">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>
        <Sparkles className="h-3.5 w-3.5" /> Building your Showcase
        <span className="font-bold tracking-[0.18em] text-gray-400">{at + 1} / {steps.length}</span>
      </p>
      <div className="mt-2.5 flex items-center gap-1">
        {steps.map((s, i) => {
          const meta = showcaseStepOf(s)
          const Icon = meta?.icon || Sparkles
          const here = i === at
          const done = !here && i < at
          const set = questionHasAnswer(s, answers)
          return (
            <div key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
              <motion.span
                initial={false}
                animate={{ scale: here ? 1 : 0.86 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                data-fill={here ? '' : undefined}
                style={here ? { backgroundColor: accent, color: '#fff', boxShadow: `0 8px 18px -10px ${accent}` } : { backgroundColor: `${accent}${done ? '24' : '12'}`, color: accent }}
                title={meta?.title}
              >
                <Icon className="h-3.5 w-3.5" />
                {done && set && (
                  <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-[#FAFAF7] dark:ring-[#0B0B0B]">
                    <Check className="h-2 w-2" strokeWidth={4} />
                  </span>
                )}
              </motion.span>
              {i < steps.length - 1 && <span className="h-px min-w-1 flex-1 rounded-full" style={{ backgroundColor: i < at ? accent : `${accent}33` }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The creator's criteria card: icon tile, title, a tick + coloured edge once something is picked. */
export function ShowcaseCard({ step, title, set, accent, hint, children }: { step: ShowcaseStep; title: ReactNode; set: boolean; accent: string; hint?: string; children: ReactNode }) {
  const Icon = step.icon
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-gray-200/80 bg-white p-4 dark:border-white/[0.08] shadow-[0_16px_34px_-30px_rgba(17,24,39,.7)] dark:bg-[#18181b] sm:p-5"
      style={{ borderColor: set ? `${accent}73` : undefined }}>
      <AnimatePresence>
        {set && <motion.span key="edge" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} className="absolute inset-y-4 left-0 w-1 origin-top rounded-r-full" data-fill="" style={{ backgroundColor: accent }} />}
      </AnimatePresence>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-300" data-fill={set ? '' : undefined}
          style={set ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: `${accent}1F`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="min-w-0 flex-1 text-lg font-black leading-snug tracking-tight text-[#0B0B0B] dark:text-white sm:text-xl">{title}</h2>
        <AnimatePresence>
          {set && <motion.span key="ok" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={4} /></motion.span>}
        </AnimatePresence>
        {!set && hint && <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

// --------------------------------------------------------------------------------------------
// The public form page sits still

/** Pins the form page to what's actually visible: the phone's keyboard can't drag it down, and
 *  once the keyboard closes it's exactly where it was (progress bar + agent branding in view). A
 *  text box the keyboard would cover is scrolled into view inside the form's own scroll area. */
export function useFormViewportLock(enabled = true) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!enabled) return
    const html = document.documentElement
    const body = document.body
    const saved = { h: html.style.overflow, b: body.style.overflow, ob: body.style.overscrollBehavior, oh: html.style.overscrollBehavior }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    const vv = window.visualViewport
    const fit = () => {
      const el = ref.current
      if (!el) return
      const h = vv ? vv.height : window.innerHeight
      const top = vv ? vv.offsetTop : 0
      el.style.height = `${Math.round(h)}px`
      el.style.transform = top > 0.5 ? `translateY(${Math.round(top)}px)` : ''
    }
    fit()
    let keyTimer: number | undefined
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || !t.matches?.('input, textarea, [contenteditable="true"]')) return
      window.clearTimeout(keyTimer)
      // once the keyboard is up: make sure the box isn't hidden under it
      keyTimer = window.setTimeout(() => {
        fit()
        const area = t.closest('[data-fr-scroll]') as HTMLElement | null
        if (!area) return
        const a = area.getBoundingClientRect(), r = t.getBoundingClientRect()
        if (r.bottom > a.bottom - 12 || r.top < a.top + 12) area.scrollBy({ top: r.top - a.top - a.height / 2 + r.height / 2, behavior: 'smooth' })
      }, 320)
    }
    const onFocusOut = () => {
      window.clearTimeout(keyTimer)
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null
        if (active?.matches?.('input, textarea')) return
        if (window.scrollY !== 0) window.scrollTo(0, 0)
        fit()
      }, 60)
    }
    const onWinScroll = () => { if (!(document.activeElement as HTMLElement | null)?.matches?.('input, textarea')) { if (window.scrollY !== 0) window.scrollTo(0, 0) } fit() }
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    window.addEventListener('scroll', onWinScroll, { passive: true })
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      window.clearTimeout(keyTimer)
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
      window.removeEventListener('scroll', onWinScroll)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      html.style.overflow = saved.h
      body.style.overflow = saved.b
      html.style.overscrollBehavior = saved.oh
      body.style.overscrollBehavior = saved.ob
    }
  }, [enabled])
  return ref
}

/** True on a touch phone/tablet - where a text box must never focus itself (it pops the keyboard). */
export function useCoarsePointer(): boolean {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches, [])
}
