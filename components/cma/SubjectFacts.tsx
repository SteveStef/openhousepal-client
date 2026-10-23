'use client'

// The CMA builder's subject facts: the "Enter Manually" address search (Google suggestions) and
// the facts editor every subject uses - manual (a home not on the MLS yet, most seller CMAs) or
// MLS. Each field writes the exact subject field the valuation engine reads (see backend
// cma_ai_service.py _continuous_relevance / _v10_feature_adjustments), in the MLS's own form:
//   baths = full + 0.5 per half (Bright's BathroomsTotal), sqft = above grade + finished lower
//   level (Bright's LivingArea), garage "2 Car" + garage_spaces, levels + stories, "Full, Fully
//   Finished, Walkout Level" basements, "Public Sewer" / "On Site Septic" / "Cesspool".

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, DollarSign, Home, Image as ImageIcon, Loader2, MapPin, Ruler, Search, Upload, X } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { normalizeImageUrl } from '@/lib/utils'
import { CmaLocatedAddress, CmaSubjectArea, CmaSubjectProperty } from '@/types'

type SetSubject = (fn: (s: CmaSubjectProperty) => CmaSubjectProperty) => void

const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
const sectionLabelClass = 'mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]'

// ---------------------------------------------------------------------------------------------
// Option lists - values are what Bright itself writes, so comps and a manual subject compare.
// ---------------------------------------------------------------------------------------------

const PROPERTY_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single family' },
  { value: 'TWIN', label: 'Twin / semi' },
  { value: 'TOWNHOUSE', label: 'Townhouse / row' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'MULTI_FAMILY', label: 'Multi-family' },
]

const HOME_STYLES = [
  'Colonial', 'Traditional', 'Ranch/Rambler', 'Cape Cod', 'Split Level', 'Bi-level', 'Split Foyer',
  'Contemporary', 'Craftsman', 'Farmhouse/National Folk', 'Victorian', 'Tudor', 'Transitional',
  'Bungalow', 'Other',
].map(v => ({ value: v, label: v === 'Ranch/Rambler' ? 'Ranch / rambler' : v === 'Farmhouse/National Folk' ? 'Farmhouse' : v }))

const STORIES = [1, 1.5, 2, 2.5, 3, 3.5].map(n => ({ value: String(n), label: n === 3.5 ? '3+ stories' : `${n} ${n === 1 ? 'story' : 'stories'}` }))

const GARAGE = [0, 1, 2, 3, 4].map(n => ({ value: String(n), label: n === 0 ? 'No garage' : n === 4 ? '4+ car' : `${n} car` }))

const BASEMENT = [
  { value: 'None', label: 'No basement' },
  { value: 'Unfinished', label: 'Unfinished' },
  { value: 'Partially Finished', label: 'Partially finished' },
  { value: 'Fully Finished', label: 'Finished' },
]

const WATER = [{ value: 'Public', label: 'Public water' }, { value: 'Well', label: 'Well' }]
const SEWER = [
  { value: 'Public Sewer', label: 'Public sewer' },
  { value: 'On Site Septic', label: 'Septic' },
  { value: 'Cesspool', label: 'Cesspool' },
]
const HEAT_SYSTEMS = ['Forced Air', 'Heat Pump', 'Hot Water', 'Baseboard - Electric', 'Radiator', 'Radiant', 'Geothermal', 'Other']
const HEAT_FUELS = ['Natural Gas', 'Oil', 'Electric', 'Propane']
const COOLING = ['Central A/C', 'Ductless/Mini-Split', 'Window Unit(s)', 'None']

// ---------------------------------------------------------------------------------------------
// Reading/writing the subject fields
// ---------------------------------------------------------------------------------------------

const firstText = (v: string[] | string | null | undefined): string => (Array.isArray(v) ? v[0] : v) || ''
const listText = (v: string[] | string | null | undefined): string => (Array.isArray(v) ? v.join(', ') : v) || ''

function num(v: string): number | null {
  const n = Number(v.replace(/,/g, ''))
  return v.trim() && Number.isFinite(n) ? n : null
}

export function basementKind(text: string | null | undefined): string {
  const t = (text || '').toLowerCase()
  if (!t) return ''
  if (t.includes('partial')) return 'Partially Finished'
  if (t.includes('unfinished')) return 'Unfinished'
  if (t.includes('finished')) return 'Fully Finished'
  if (t === 'none' || t === 'no') return 'None'
  return text || ''
}

function basementText(kind: string, walkout: boolean): string | null {
  if (!kind) return null
  if (kind === 'None') return 'None'
  return ['Full', kind, walkout ? 'Walkout Level' : ''].filter(Boolean).join(', ')
}

function garageSpaces(s: CmaSubjectProperty): number | null {
  if (s.garage_spaces != null) return s.garage_spaces
  const t = (s.garage || '').toLowerCase()
  const m = t.match(/(\d+(?:\.\d+)?)\s*(car|space|bay|stall)/)
  if (m) return Number(m[1])
  return t === 'none' || t === 'no' ? 0 : null
}

function storiesOf(s: CmaSubjectProperty): number | null {
  if (s.stories != null) return s.stories
  const n = Number(String(firstText(s.levels)).replace('+', ''))
  return firstText(s.levels) && Number.isFinite(n) ? n : null
}

function splitHeating(text: string | null | undefined): { system: string, fuel: string } {
  const parts = (text || '').split(',').map(p => p.trim()).filter(Boolean)
  return {
    system: parts.find(p => HEAT_SYSTEMS.includes(p)) || parts.find(p => !HEAT_FUELS.includes(p)) || '',
    fuel: parts.find(p => HEAT_FUELS.includes(p)) || '',
  }
}

function aboveGrade(s: CmaSubjectProperty): number | null {
  if (s.above_grade_finished_area != null) return s.above_grade_finished_area
  return s.sqft != null ? s.sqft - (s.below_grade_finished_area || 0) : null
}

function bathParts(s: CmaSubjectProperty): { full: number | null, half: number | null } {
  if (s.full_baths != null || s.half_baths != null) return { full: s.full_baths ?? null, half: s.half_baths ?? null }
  if (s.baths == null) return { full: null, half: null }
  return { full: Math.floor(s.baths), half: s.baths % 1 ? 1 : 0 }
}

function withBaths(s: CmaSubjectProperty, full: number | null, half: number | null): CmaSubjectProperty {
  const total = full == null && half == null ? null : (full || 0) + 0.5 * (half || 0)
  return { ...s, full_baths: full, half_baths: half, baths: total }
}

// "Nether Providence Township" (Google) -> "Nether Providence" (how the MLS writes it).
const stripMunicipalSuffix = (name: string | null | undefined) =>
  (name || '').replace(/\s+(township|borough|city|town|village)$/i, '').trim() || null

// Column span for the LAST field of a 2 / 3 / 4-column grid (phone / tablet / desktop) so it
// stretches to finish its row instead of leaving empty cells. `count` = fields in the grid.
function fillRowSpan(count: number): string {
  const phone = count % 2 === 1 ? 'col-span-2' : 'col-span-1'
  const tablet = ({ 0: 'sm:col-span-1', 1: 'sm:col-span-3', 2: 'sm:col-span-2' } as Record<number, string>)[count % 3]
  const desktop = ({ 0: 'lg:col-span-1', 1: 'lg:col-span-4', 2: 'lg:col-span-3', 3: 'lg:col-span-2' } as Record<number, string>)[count % 4]
  return `${phone} ${tablet} ${desktop}`
}

// Facts the valuation leans on - shown as a short "still missing" list so a manual subject
// isn't sent to the engine half-filled.
export function missingKeyFacts(s: CmaSubjectProperty): string[] {
  const out: string[] = []
  if (s.latitude == null || s.longitude == null) out.push('map location')
  if (!s.property_type) out.push('property type')
  if (s.beds == null) out.push('bedrooms')
  if (s.baths == null) out.push('bathrooms')
  if (!aboveGrade(s)) out.push('above-grade square feet')
  if (!s.year_built) out.push('year built')
  if (!firstText(s.architectural_style)) out.push('home style')
  if (!s.lot_size && s.property_type !== 'CONDO') out.push('lot size')
  if (!s.basement) out.push('basement')
  return out
}

// ---------------------------------------------------------------------------------------------
// Address pick -> subject
// ---------------------------------------------------------------------------------------------

export function placeToAddress(place: google.maps.places.PlaceResult): CmaLocatedAddress | null {
  const comps = place.address_components || []
  const get = (type: string, short = false) => {
    const c = comps.find(x => x.types.includes(type))
    return c ? (short ? c.short_name : c.long_name) : null
  }
  const loc = place.geometry?.location
  if (!loc) return null
  const parts = (place.formatted_address || '').split(',').map(p => p.trim())
  return {
    // Short route ("Dogwood Ln") - the MLS spells streets that way, and the comp search keeps the
    // subject's own past sales out by matching the street text.
    street_address: [get('street_number'), get('route', true)].filter(Boolean).join(' ') || null,
    city: get('locality') || get('postal_town') || get('neighborhood') || (parts.length >= 4 ? parts[1] : null),
    state: get('administrative_area_level_1', true),
    zipcode: get('postal_code'),
    county: get('administrative_area_level_2'),
    township: get('administrative_area_level_3'),
    latitude: loc.lat(),
    longitude: loc.lng(),
    precise: Boolean(get('street_number')),
    formatted_address: place.formatted_address || null,
  }
}

export function subjectFromAddress(a: CmaLocatedAddress): CmaSubjectProperty {
  return {
    source: 'manual', listing_key: null, photo_url: null, photos: [],
    street_address: a.street_address, city: a.city, state: a.state, zipcode: a.zipcode,
    county: a.county, township: stripMunicipalSuffix(a.township),
    latitude: a.latitude, longitude: a.longitude,
    beds: null, baths: null, sqft: null, lot_size: null, year_built: null,
    list_price: null, days_on_market: null, mls_status: null, last_sale_date: null, last_sale_price: null,
  }
}

// Nearby MLS homes' school district / township / water / sewer fill only what's still blank -
// never over an agent's own entry.
export function applyAreaSuggestions(s: CmaSubjectProperty, area: CmaSubjectArea): CmaSubjectProperty {
  const blank = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
  const next = { ...s }
  if (blank(next.school_district) && area.school_district) next.school_district = area.school_district
  // The MLS spelling wins over Google's ("NETHER PROVIDENCE" vs "Nether Providence Township") -
  // the engine's same-township check compares the text.
  if (area.township && (blank(next.township) || (next.township || '').toLowerCase() === (stripMunicipalSuffix(area.township) || '').toLowerCase())) next.township = area.township
  if (blank(next.subdivision_name) && area.subdivision_name) next.subdivision_name = area.subdivision_name
  if (blank(next.water_source) && area.water_source) next.water_source = area.water_source
  if (blank(next.sewer) && area.sewer) next.sewer = area.sewer
  return next
}

export function ManualAddressPicker({ onPick }: { onPick: (a: CmaLocatedAddress) => void }) {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [typed, setTyped] = useState(false)
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('PA')
  const [zip, setZip] = useState('')
  const [locating, setLocating] = useState(false)

  const locateTyped = async () => {
    const full = [street, city, `${state} ${zip}`.trim()].filter(s => s.trim()).join(', ')
    if (!street.trim() || !(city.trim() || zip.trim())) { showToast('Enter the street and the town or ZIP.', 'error'); return }
    setLocating(true)
    const r = await api.cma.locateAddress(full)
    setLocating(false)
    if (!r.success || !r.data) { showToast(r.error || "Couldn't find that address on the map - check the spelling and ZIP.", 'error'); return }
    // Keep what the agent typed for the text parts; the lookup supplies the location.
    onPick({ ...r.data, street_address: street.trim(), city: city.trim() || r.data.city, state: state.trim() || r.data.state, zipcode: zip.trim() || r.data.zipcode })
  }

  return (
    <div className="mt-4 space-y-3">
      {!typed ? (
        <>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <GooglePlacesAutocomplete
              id="cma-manual-address"
              name="cma-manual-address"
              value={text}
              onChange={setText}
              onPlaceSelected={place => {
                const a = placeToAddress(place)
                if (a) onPick(a)
              }}
              placeholder="Start typing the home's address..."
              className="!rounded-xl !py-2.5 !pl-9 text-sm font-semibold"
            />
          </div>
          <p className="text-xs font-semibold text-gray-400">
            Pick the address from the list - it places the home on the map so nearby sales can be found.{' '}
            <button type="button" onClick={() => setTyped(true)} className="font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#d7b974]">
              Address not in the list? Type it in
            </button>
          </p>
        </>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
            <div className="col-span-2 sm:col-span-6"><Labeled label="Street address"><input className={inputClass} value={street} onChange={e => setStreet(e.target.value)} placeholder="417 Dogwood Ln" /></Labeled></div>
            <div className="col-span-2 sm:col-span-3"><Labeled label="Town"><input className={inputClass} value={city} onChange={e => setCity(e.target.value)} /></Labeled></div>
            <div className="sm:col-span-1"><Labeled label="State"><input className={inputClass} value={state} maxLength={2} onChange={e => setState(e.target.value.toUpperCase())} /></Labeled></div>
            <div className="sm:col-span-2"><Labeled label="ZIP"><input className={inputClass} value={zip} inputMode="numeric" maxLength={5} onChange={e => setZip(e.target.value.replace(/\D/g, ''))} /></Labeled></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={locateTyped} disabled={locating} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-[#111827]">
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} Find on the map
            </button>
            <button type="button" onClick={() => setTyped(false)} className="text-xs font-black text-gray-400 hover:text-gray-600">Back to address search</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Small inputs
// ---------------------------------------------------------------------------------------------

function Labeled({ label, hint, children }: { label: string, hint?: string, children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-[10px] font-semibold leading-snug text-gray-400">{hint}</p>}
    </div>
  )
}

// iPhone date boxes (10/20): an empty one shows TODAY's date (looked like a real sale date), its
// Reset button doesn't reach React's onChange, and its built-in width overflowed the card. So the
// native text is hidden while empty (a "Not set" label shows instead), the value is also read on
// input/blur, and there's our own Clear button.
function DateField({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => { if (el.value !== value) onChange(el.value) }
    el.addEventListener('input', sync)
    el.addEventListener('blur', sync)
    return () => { el.removeEventListener('input', sync); el.removeEventListener('blur', sync) }
  }, [value, onChange])
  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        {/* Empty: the native box is fully invisible (some browsers still drew mm/dd/yyyy and the
            calendar icon under "Not set" - letters on top of each other, 10/23) but stays on top
            so a tap still opens the picker; this look-alike box shows "Not set" underneath. */}
        {!value && <div className={`${inputClass} pointer-events-none absolute inset-0 flex items-center text-sm font-semibold !text-gray-400`}>Not set</div>}
        <input
          ref={ref}
          type="date"
          className={`${inputClass} relative block min-w-0 appearance-none ${value ? '' : 'opacity-0'}`}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      {value && (
        <button type="button" onClick={() => onChange('')} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide text-gray-500 hover:text-[#8b7355] dark:text-gray-400">
          Clear
        </button>
      )}
    </div>
  )
}

function SelectField({ label, value, options, onChange, placeholder = 'Not sure', hint }: {
  label: string, value: string, options: { value: string, label: string }[], onChange: (v: string) => void, placeholder?: string, hint?: string
}) {
  // An MLS subject can carry a value outside the list ("Straight Thru") - keep it pickable.
  const all = value && !options.some(o => o.value === value) ? [{ value, label: value }, ...options] : options
  return (
    <Labeled label={label} hint={hint}>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${inputClass} !pl-2.5 pr-7`}>
        <option value="">{placeholder}</option>
        {all.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Labeled>
  )
}

// Text input that keeps the agent's half-typed text ("0." on the way to "0.45") instead of
// re-rendering the parsed number; commas are fine.
function NumberField({ label, value, onChange, icon: Icon, decimals = false, hint, placeholder }: {
  label: string, value: number | null | undefined, onChange: (v: number | null) => void,
  icon?: React.ComponentType<{ className?: string }>, decimals?: boolean, hint?: string, placeholder?: string
}) {
  const format = (v: number | null | undefined) => v == null ? '' : decimals ? String(v) : Number(v).toLocaleString()
  const [text, setText] = useState(format(value))
  useEffect(() => {
    if (num(text) !== (value ?? null)) setText(format(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <Labeled label={label} hint={hint}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-300" />}
        <input
          type="text"
          inputMode={decimals ? 'decimal' : 'numeric'}
          value={text}
          placeholder={placeholder}
          onChange={e => {
            const raw = decimals ? e.target.value.replace(/[^\d.]/g, '') : e.target.value.replace(/[^\d,]/g, '')
            setText(raw)
            onChange(num(raw))
          }}
          onBlur={() => setText(format(value))}
          className={`${inputClass} ${Icon ? 'pl-8' : ''}`}
        />
      </div>
    </Labeled>
  )
}

// Free text with a suggestion list (nearby MLS values first, then an optional database search).
function SuggestField({ label, value, onChange, options, search, placeholder, hint }: {
  label: string, value: string, onChange: (v: string) => void, options: string[],
  search?: (q: string) => Promise<string[]>, placeholder?: string, hint?: string
}) {
  const [open, setOpen] = useState(false)
  const [found, setFound] = useState<string[]>([])
  const typedRef = useRef(false)
  useEffect(() => {
    if (!search || !open || !typedRef.current || value.trim().length < 2) { setFound([]); return }
    let cancelled = false
    const t = setTimeout(() => { search(value.trim()).then(r => { if (!cancelled) setFound(r) }) }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [value, open, search])
  const q = value.trim().toLowerCase()
  const list = useMemo(() => {
    const near = options.filter(o => !typedRef.current || !q || o.toLowerCase().includes(q))
    return Array.from(new Set([...near, ...found])).filter(o => o.toLowerCase() !== q).slice(0, 10)
  }, [options, found, q])
  return (
    <Labeled label={label} hint={hint}>
      <div className="relative">
        <input
          value={value}
          placeholder={placeholder}
          onFocus={() => { typedRef.current = false; setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => { typedRef.current = true; onChange(e.target.value); setOpen(true) }}
          className={inputClass}
        />
        {open && list.length > 0 && (
          <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
            {list.map(o => (
              <button
                key={o}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(o); setOpen(false) }}
                className="flex w-full items-center justify-between gap-2 border-b border-gray-50 px-3 py-2 text-left text-xs font-bold text-[#111827] last:border-0 hover:bg-[#C9A24D]/10 dark:border-gray-800 dark:text-white"
              >
                <span className="truncate">{o}</span>
                {options.includes(o) && <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">Nearby</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </Labeled>
  )
}

const searchSchoolDistricts = async (q: string): Promise<string[]> => {
  const r = await api.properties.searchSchoolDistricts(q)
  // The reference table answers "LOWER MERION, PA"; comps store just "LOWER MERION".
  return r.success && r.data ? (r.data.results || []).map(d => d.replace(/,\s*[A-Z]{2}$/, '')) : []
}

// ---------------------------------------------------------------------------------------------
// Photo
// ---------------------------------------------------------------------------------------------

function SubjectPhoto({ reportId, subject, setSubject }: { reportId: string, subject: CmaSubjectProperty, setSubject: SetSubject }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState<'' | 'upload' | 'street_view' | 'aerial'>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const hasGeo = subject.latitude != null && subject.longitude != null

  // Which photo came from where, for the photos added in this visit (the listing's own photos have
  // no entry) - so picking a thumbnail keeps the right label and "Back to listing photo" knows
  // which ones are Google's (user, 10/21: after Street View there was no clear way back).
  const [sources, setSources] = useState<Record<string, 'upload' | 'street_view' | 'aerial'>>(() =>
    subject.photo_url && subject.photo_source ? { [subject.photo_url]: subject.photo_source } : {})
  const use = (url: string, source: 'upload' | 'street_view' | 'aerial') => {
    setSources(m => ({ ...m, [url]: source }))
    setSubject(s => ({ ...s, photo_url: url, photo_source: source, photos: [url, ...(s.photos || []).filter(p => p !== url)] }))
  }
  const allPhotos = (subject.photos && subject.photos.length ? subject.photos : subject.photo_url ? [subject.photo_url] : [])
  const listingPhotos = allPhotos.filter(p => !sources[p])
  const pick = (url: string) => setSubject(s => ({ ...s, photo_url: url, photo_source: sources[url] ?? null }))
  const showingGoogle = subject.photo_source === 'street_view' || subject.photo_source === 'aerial'

  const upload = async (file: File) => {
    setBusy('upload')
    const r = await api.cma.uploadSubjectPhoto(reportId, file)
    setBusy('')
    if (r.success && r.data) use(r.data.photo_url, 'upload')
    else showToast(r.error || "Couldn't upload that photo.", 'error')
  }

  const fromGoogle = async (kind: 'street_view' | 'aerial') => {
    setBusy(kind)
    const r = await api.cma.googleSubjectPhoto(reportId, { kind, latitude: subject.latitude, longitude: subject.longitude })
    setBusy('')
    if (r.success && r.data) use(r.data.photo_url, kind)
    else showToast(r.error || "Couldn't get a photo from Google.", 'error')
  }

  const remove = () => setSubject(s => {
    const rest = (s.photos || []).filter(p => p !== s.photo_url)
    return { ...s, photo_url: rest[0] || null, photos: rest, photo_source: rest.length ? s.photo_source : null }
  })

  const btn = 'inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-50 dark:border-gray-700 dark:text-gray-400'
  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-sm ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
        {subject.photo_url
          ? <img src={normalizeImageUrl(subject.photo_url || undefined)} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-300"><Home className="h-7 w-7" /><span className="text-[10px] font-black uppercase tracking-wide">No photo yet</span></div>}
        {busy && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>}
        {subject.photo_url && !busy && (
          <button type="button" onClick={remove} title="Remove this photo" className="absolute right-2 top-2 rounded-full bg-black/55 p-1 text-white hover:bg-black/75"><X className="h-3.5 w-3.5" /></button>
        )}
        {subject.photo_url && subject.photo_source && subject.photo_source !== 'upload' && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
            {subject.photo_source === 'street_view' ? 'Google Street View' : 'Aerial view'}
          </span>
        )}
        {showingGoogle && listingPhotos.length > 0 && !busy && (
          <button type="button" onClick={() => pick(listingPhotos[0])}
            className="cma-btn absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-[#111827] shadow-lg ring-1 ring-black/10 hover:bg-white">
            <ImageIcon className="h-3.5 w-3.5 text-[#C9A24D]" /> Back to listing photo
          </button>
        )}
      </div>
      {allPhotos.length > 1 && (
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-gray-400">Cover photo · tap to choose ({allPhotos.length})</p>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            {allPhotos.map((p, i) => {
              const on = p === subject.photo_url
              const src = sources[p]
              return (
                <button key={p + i} type="button" onClick={() => pick(p)} aria-pressed={on}
                  title={src === 'street_view' ? 'Google Street View' : src === 'aerial' ? 'Aerial view' : src === 'upload' ? 'Your upload' : `Listing photo ${listingPhotos.indexOf(p) + 1}`}
                  className={`relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg transition sm:h-12 sm:w-16 ${on ? 'ring-2 ring-[#C9A24D] ring-offset-1 ring-offset-white dark:ring-offset-[#151517]' : 'opacity-75 ring-1 ring-black/10 hover:opacity-100 dark:ring-white/10'}`}>
                  <img src={normalizeImageUrl(p)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {src && src !== 'upload' && (
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 py-px text-center text-[8px] font-black uppercase tracking-wide text-white">{src === 'street_view' ? 'Street' : 'Aerial'}</span>
                  )}
                  {on && <span className="absolute right-0.5 top-0.5 rounded-full bg-[#C9A24D] p-0.5"><Check className="h-2.5 w-2.5 text-white" /></span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
      <div className="flex gap-1.5">
        <button type="button" className={btn} disabled={!!busy} onClick={() => fileRef.current?.click()}><Upload className="h-3 w-3" /> Upload</button>
        <button type="button" className={btn} disabled={!!busy || !hasGeo} onClick={() => fromGoogle('street_view')} title="A Google Street View photo of the front of the house"><Camera className="h-3 w-3" /> Street</button>
        <button type="button" className={btn} disabled={!!busy || !hasGeo} onClick={() => fromGoogle('aerial')} title="A satellite view of the lot"><ImageIcon className="h-3 w-3" /> Aerial</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------------------------

export function SubjectFactsEditor({ reportId, subject, setSubject, area }: {
  reportId: string, subject: CmaSubjectProperty, setSubject: SetSubject, area: CmaSubjectArea | null,
}) {
  const manual = subject.source === 'manual' && !subject.listing_key
  const set = (patch: Partial<CmaSubjectProperty>) => setSubject(s => ({ ...s, ...patch }))
  const { full, half } = bathParts(subject)
  const above = aboveGrade(subject)
  const below = subject.below_grade_finished_area ?? null
  const bsmtKind = basementKind(subject.basement)
  const walkout = /walk ?out/i.test(subject.basement || '')
  const bsmtFinished = bsmtKind === 'Partially Finished' || bsmtKind === 'Fully Finished'
  const heat = splitHeating(subject.heating)
  const missing = missingKeyFacts(subject)

  const setAbove = (v: number | null) => setSubject(s => ({ ...s, above_grade_finished_area: v, sqft: v == null && !s.below_grade_finished_area ? null : (v || 0) + (s.below_grade_finished_area || 0) }))
  const setBelow = (v: number | null) => setSubject(s => {
    const ag = aboveGrade(s)
    return { ...s, above_grade_finished_area: ag, below_grade_finished_area: v, sqft: ag == null && v == null ? null : (ag || 0) + (v || 0) }
  })
  const setBasement = (kind: string, wo: boolean) => setSubject(s => {
    const next: CmaSubjectProperty = { ...s, basement: basementText(kind, wo) }
    if (kind === 'None' || kind === 'Unfinished') {
      const ag = aboveGrade(s)
      next.above_grade_finished_area = ag
      next.below_grade_finished_area = 0
      next.sqft = ag
    }
    return next
  })

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[15rem_1fr]">
      <div className="space-y-3">
        <SubjectPhoto reportId={reportId} subject={subject} setSubject={setSubject} />
        <div className="rounded-2xl border border-gray-100 bg-[#fbfaf7] p-3 dark:border-gray-800 dark:bg-[#0B0B0B]">
          <p className={sectionLabelClass}>{manual ? 'Listing & Sale History' : 'Market Status'}</p>
          <div className="space-y-2.5">
            {manual ? (
              // A hand-entered home is usually not listed yet; "Active" makes the engine treat its
              // list price and days on market as a live listing, exactly like an MLS subject.
              <SelectField label="Listing Status" value={subject.mls_status || ''} placeholder="Not listed yet"
                options={[{ value: 'Active', label: 'Listed for sale' }, { value: 'Coming Soon', label: 'Coming soon' }]}
                onChange={v => set(v ? { mls_status: v } : { mls_status: null, list_price: null, days_on_market: null })} />
            ) : (
              <>
                <NumberField label="Days on Market" value={subject.days_on_market} onChange={v => set({ days_on_market: v })} />
                <Labeled label="Current Status"><input className={inputClass} value={subject.mls_status || ''} onChange={e => set({ mls_status: e.target.value })} /></Labeled>
              </>
            )}
            {(!manual || subject.mls_status) && (
              <NumberField label="List Price" icon={DollarSign} value={subject.list_price} onChange={v => set({ list_price: v })} />
            )}
            {manual && subject.mls_status && (
              <NumberField label="Days on Market" value={subject.days_on_market} onChange={v => set({ days_on_market: v })} />
            )}
            <Labeled label="Last Sale Date"><DateField value={subject.last_sale_date || ''} onChange={v => set({ last_sale_date: v || null })} /></Labeled>
            <NumberField label="Last Sale Price" icon={DollarSign} value={subject.last_sale_price} onChange={v => set({ last_sale_price: v })} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {missing.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Still missing: {missing.join(', ')}. The value is only as good as these facts.
          </div>
        )}

        <div>
          <p className={sectionLabelClass}>Location</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-4"><Labeled label="Street Address"><input className={inputClass} value={subject.street_address || ''} onChange={e => set({ street_address: e.target.value })} /></Labeled></div>
            <Labeled label="City / Town"><input className={inputClass} value={subject.city || ''} onChange={e => set({ city: e.target.value })} /></Labeled>
            <Labeled label="State"><input className={inputClass} value={subject.state || ''} maxLength={2} onChange={e => set({ state: e.target.value.toUpperCase() })} /></Labeled>
            <Labeled label="ZIP"><input className={inputClass} value={subject.zipcode || ''} onChange={e => set({ zipcode: e.target.value })} /></Labeled>
            <Labeled label="County"><input className={inputClass} value={subject.county || ''} onChange={e => set({ county: e.target.value })} /></Labeled>
            <div className="col-span-2">
              <SuggestField label="School District" value={subject.school_district || ''} onChange={v => set({ school_district: v || null })}
                options={area?.school_district_options || []} search={searchSchoolDistricts} placeholder="Start typing..." />
            </div>
            <SuggestField label="Township / Municipality" value={subject.township || ''} onChange={v => set({ township: v || null })} options={area?.township_options || []} />
            <SuggestField label="Neighborhood" value={subject.subdivision_name || ''} onChange={v => set({ subdivision_name: v || null })} options={area?.subdivision_options || []} placeholder="Optional" />
          </div>
          {subject.latitude == null && (
            <p className="mt-2 text-xs font-semibold text-red-500">This home isn&apos;t on the map yet - use Change Property and pick the address so nearby sales can be found.</p>
          )}
          {subject.latitude != null && area && area.nearby_count > 0 && manual && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400"><Check className="h-3 w-3 text-emerald-500" /> School district, township, water and sewer suggested from {area.nearby_count} nearby MLS homes - change any that are wrong.</p>
          )}
        </div>

        <div>
          <p className={sectionLabelClass}>Size & Layout</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <SelectField label="Property Type" value={subject.property_type || ''} options={PROPERTY_TYPES} onChange={v => set({ property_type: v || null })} />
            <SelectField label="Home Style" value={firstText(subject.architectural_style)} options={HOME_STYLES} onChange={v => set({ architectural_style: v || null })} />
            <SelectField label="Stories" value={storiesOf(subject) != null ? String(storiesOf(subject)) : ''} options={STORIES}
              onChange={v => set({ stories: v ? Number(v) : null, levels: v || null })} hint="Above ground - don't count the basement." />
            <NumberField label="Year Built" value={subject.year_built} onChange={v => set({ year_built: v })} decimals placeholder="1965" />
            <NumberField label="Bedrooms" value={subject.beds} onChange={v => set({ beds: v })} decimals />
            <NumberField label="Full Baths" value={full} onChange={v => setSubject(s => withBaths(s, v, bathParts(s).half ?? (v != null ? 0 : null)))} decimals />
            <NumberField label="Half Baths" value={half} onChange={v => setSubject(s => withBaths(s, bathParts(s).full ?? (v != null ? 0 : null), v))} decimals />
            <NumberField label="Above-Grade Sq Ft" icon={Ruler} value={above} onChange={setAbove} hint="Finished space above ground." />
            {/* The walkout box sits inside the Basement cell (it used to take a grid cell of its own
                and leave holes in the grid). */}
            <div>
              <SelectField label="Basement" value={bsmtKind} options={BASEMENT} onChange={v => setBasement(v, walkout)} />
              {bsmtKind && bsmtKind !== 'None' && (
                <label className="mt-1.5 flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={walkout} onChange={e => setBasement(bsmtKind, e.target.checked)} className="h-4 w-4 accent-[#C9A24D]" /> Walkout
                </label>
              )}
            </div>
            {bsmtFinished && (
              <NumberField label="Finished Lower-Level Sq Ft" icon={Ruler} value={below} onChange={setBelow} hint="Needed to value the lower level." />
            )}
            <NumberField label="Lot (Acres)" value={subject.lot_size ? Number((subject.lot_size / 43560).toFixed(3)) : null}
              onChange={v => set({ lot_size: v ? Math.round(v * 43560) : null })} decimals placeholder="0.25" />
            {/* the last field stretches to finish its row at every width - no empty cells (10/20) */}
            <div className={fillRowSpan(bsmtFinished ? 12 : 11)}>
              <SelectField label="Garage" value={garageSpaces(subject) != null ? String(Math.min(4, garageSpaces(subject) as number)) : ''} options={GARAGE}
                onChange={v => set(v === '' ? { garage_spaces: null, garage: null } : { garage_spaces: Number(v), garage: Number(v) === 0 ? 'None' : `${v} Car` })} />
            </div>
          </div>
          {subject.sqft ? <p className="mt-1.5 text-[11px] font-semibold text-gray-400">Total finished: {Number(subject.sqft).toLocaleString()} sq ft</p> : null}
        </div>

        <div>
          <p className={sectionLabelClass}>Systems & Costs</p>
          <div className="grid grid-flow-row-dense grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {/* Sewer gets two columns (its values are long - "On Site Septic"); the order + spans
                fill every row at 2, 3 and 4 columns with no empty cells (user, 10/20). */}
            <SelectField label="Water" value={listText(subject.water_source)} options={WATER} onChange={v => set({ water_source: v || null })} />
            <NumberField label="Annual Taxes" icon={DollarSign} value={subject.annual_taxes} onChange={v => set({ annual_taxes: v })} />
            <div className="col-span-2">
              <SelectField label="Sewer" value={listText(subject.sewer)} options={SEWER} onChange={v => set({ sewer: v || null })} />
            </div>
            <SelectField label="Heating" value={heat.system} options={HEAT_SYSTEMS.map(v => ({ value: v, label: v }))}
              onChange={v => set({ heating: [v, heat.fuel].filter(Boolean).join(', ') || null })} />
            <SelectField label="Heating Fuel" value={heat.fuel} options={HEAT_FUELS.map(v => ({ value: v, label: v }))}
              onChange={v => set({ heating: [heat.system, v].filter(Boolean).join(', ') || null })} />
            <div className="col-span-2 sm:col-span-3 lg:col-span-2">
              <SelectField label="Cooling" value={subject.cooling || ''} options={COOLING.map(v => ({ value: v, label: v === 'Ductless/Mini-Split' ? 'Ductless / mini-split' : v }))} onChange={v => set({ cooling: v || null })} />
            </div>
          </div>
        </div>

        <div>
          {/* No condition / recent-updates questions (user, 10/20): the analysis reads condition and
              updates from the description and the photos, so the agent isn't asked to type them. */}
          <p className={sectionLabelClass}>Description</p>
          <div>
            <Labeled label="" hint="Describe the home the way a listing would - finishes, layout, lot, anything special. The analysis reads this.">
              <textarea rows={4} className={`${inputClass} resize-y font-medium leading-relaxed`} value={subject.public_remarks || ''}
                onChange={e => set({ public_remarks: e.target.value || null })} />
            </Labeled>
          </div>
        </div>
      </div>
    </div>
  )
}
