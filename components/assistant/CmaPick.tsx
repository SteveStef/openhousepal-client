'use client'

import { Check, Home, MapPin } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { CardStep, OPTION_GRID, PickShell, SectionToggles, StepDone, chip, useSteps } from './CardPickers'
import { PhotoDrop } from './PhotoDrop'

// A CMA from the chat (owner, 11/05): who it's for, AI or manual, then what the page asks that the AI
// can't see for itself: the client, the home's condition and recent updates, and the report's look and
// sections. A home that isn't on the MLS takes its address and facts here too, like the CMA page.
export type CmaSubject = {
  street_address?: string; city?: string; state?: string; zipcode?: string; county?: string; latitude?: number; longitude?: number
  property_type?: string; beds?: number | null; full_baths?: number | null; half_baths?: number | null; above_grade_finished_area?: number | null; year_built?: number | null
}
export type CmaPicks = { client_name: string; condition: string; recent_updates: string; public_remarks: string; theme: 'light' | 'dark'; hidden_sections: string[]; subject: CmaSubject; condition_photos: string[] }

export const cmaStart = (payload: Record<string, any>): CmaPicks => ({ client_name: payload?.client_name || '', condition: '', recent_updates: '', public_remarks: '', theme: 'light', hidden_sections: [],
  subject: {}, condition_photos: payload?.condition_photos || [] })

const CONDITIONS = ['Needs major work', 'Needs some updating', 'Average', 'Updated', 'Fully renovated']
const TYPES: [string, string][] = [['SINGLE_FAMILY', 'Single family'], ['TWIN', 'Twin'], ['TOWNHOUSE', 'Townhouse'], ['CONDO', 'Condo'], ['MULTI_FAMILY', 'Multi-family']]
const SECTIONS: [string, string][] = [['subject', 'The home'], ['comparison_table', 'Comparison table'], ['location', 'Location'], ['comparables', 'Comparable homes'],
  ['market_context', 'The market'], ['charts', 'Charts'], ['competition', 'The competition'], ['pricing', 'Pricing']]
const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
const label = 'mb-1 mt-2 block text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] first:mt-0 dark:text-[#C9A24D]'

/** Google's place, as the CMA's address fields. */
function placeParts(place: google.maps.places.PlaceResult): CmaSubject {
  const part = (t: string, short = false) => { const c = (place.address_components || []).find(x => x.types.includes(t)); return (short ? c?.short_name : c?.long_name) || '' }
  const loc = place.geometry?.location
  return { street_address: [part('street_number'), part('route')].filter(Boolean).join(' '), city: part('locality') || part('sublocality') || part('administrative_area_level_3'), state: part('administrative_area_level_1', true),
    zipcode: part('postal_code'), county: part('administrative_area_level_2').replace(/ County$/, ''), latitude: loc?.lat(), longitude: loc?.lng() }
}

export function CmaPick({ payload, ai, onAi, mode, onMode, picks, onPicks }: {
  payload: Record<string, any>; ai: boolean; onAi: (v: boolean) => void; mode: string; onMode: (m: string) => void; picks: CmaPicks; onPicks: (p: CmaPicks) => void
}) {
  const pct = typeof payload.ai_percent === 'number' ? payload.ai_percent : null
  const manual = !!payload.manual
  const ids = ['who', 'how', ...(manual ? ['home'] : []), 'client', 'condition', 'report']
  const steps = useSteps(ids)
  const n = (id: string) => ids.indexOf(id) + 1
  const set = (p: Partial<CmaPicks>) => onPicks({ ...picks, ...p })
  const sub = picks.subject
  const setSub = (p: Partial<CmaSubject>) => set({ subject: { ...sub, ...p } })
  const num = (v: string) => (v === '' ? null : Math.max(0, Number(v)) || 0)
  const opt = (on: boolean) => `ohp-ai-press flex w-full items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors ${on
    ? 'border-[#C9A24D] bg-white shadow-sm dark:bg-zinc-900' : 'border-transparent bg-white/60 hover:border-[#C9A24D]/40 dark:bg-zinc-900/60'}`
  const dot = (on: boolean) => `mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D]' : 'border-gray-300 dark:border-zinc-600'}`
  const choice = (on: boolean, title: string, subline: string, onClick: () => void, testId: string) => (
    <button type="button" onClick={onClick} aria-pressed={on} className={opt(on)} data-testid={testId}>
      <span className={dot(on)}>{on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-black text-[#111827] dark:text-white">{title}</span>
        <span className="block text-[11px] font-semibold leading-snug text-gray-500 dark:text-zinc-400">{subline}</span>
      </span>
    </button>
  )
  const f = (payload.facts || {}) as Record<string, any>
  const facts = manual ? [sub.beds && `${sub.beds} bd`, sub.full_baths && `${sub.full_baths} ba`, sub.above_grade_finished_area && `${sub.above_grade_finished_area.toLocaleString()} sq ft`]
    : [f.beds && `${f.beds} bd`, f.baths && `${f.baths} ba`, f.sqft && `${Math.round(f.sqft).toLocaleString()} sq ft`]
  const address = (manual ? sub.street_address : payload.address) || payload.address
  return (
    <PickShell testid="ai-cma-pick" side={280} preview={
      /* the report's cover, in its look */
      <div className={`overflow-hidden rounded-xl ring-1 ring-black/10 ${picks.theme === 'dark' ? 'bg-[#101114] text-white' : 'bg-white text-[#111827]'}`} data-testid="ai-cma-preview">
        <div className="relative h-[110px] bg-gray-100 group-data-[wide=yes]/pick:h-[calc(var(--pick-h,380px)*0.5)] dark:bg-zinc-800">
          {payload.photo ? <img src={resolveMediaUrl(payload.photo)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-gray-400"><Home className="h-8 w-8" /></div>}
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white">{mode === 'buyer' ? 'Buyer CMA' : 'Seller CMA'}</span>
        </div>
        <div className="p-2.5">
          <p className="truncate text-[15px] leading-tight" style={{ fontFamily: 'Georgia, serif' }}>{address}</p>
          <p className="mt-0.5 truncate text-[10.5px] font-semibold opacity-60">{[f.city || sub.city, ...facts].filter(Boolean).join(' · ') || 'Your home'}</p>
          {picks.client_name && <p className="mt-1.5 truncate text-[10.5px] font-bold text-[#8b7355] dark:text-[#C9A24D]">Prepared for {picks.client_name}</p>}
        </div>
      </div>
    }>
      <CardStep id="who" n={n('who')} title="Who it's for" summary={mode === 'buyer' ? 'Buyer / Offer' : 'Seller / Listing'} steps={steps}>
        <div className={OPTION_GRID}>
          {choice(mode !== 'buyer', 'Seller / Listing', 'What their home should list for', () => { onMode('listing'); steps.picked('who') }, 'ai-cma-seller')}
          {choice(mode === 'buyer', 'Buyer / Offer', 'What to offer on a home they want', () => { onMode('buyer'); steps.picked('who') }, 'ai-cma-buyer')}
        </div>
      </CardStep>
      <CardStep id="how" n={n('how')} title="How" summary={ai ? 'AI CMA' : 'Manual'} steps={steps}>
        <div className={OPTION_GRID}>
          {choice(ai, 'AI CMA - I do all of it', `Picks the comps, values the home, writes the report${pct != null ? ` · about ${pct < 1 ? 'under 1' : Math.round(pct)}% of your AI` : ''}`, () => { onAi(true); steps.picked('how') }, 'ai-cma-ai')}
          {choice(!ai, 'Manual', 'You pick the comps on the CMA page - no AI used', () => { onAi(false); steps.picked('how') }, 'ai-cma-manual')}
        </div>
      </CardStep>
      {manual && (
        <CardStep id="home" n={n('home')} title="The home" summary={sub.street_address || 'Add its address'} steps={steps}>
          <span className={label}>Address</span>
          <GooglePlacesAutocomplete value={sub.street_address ? [sub.street_address, sub.city, sub.state].filter(Boolean).join(', ') : String(payload.address || '')} onChange={() => {}} onPlaceSelected={p => setSub(placeParts(p))} placeholder="Start typing, then pick it from the list" className={inputCls} />
          {sub.latitude != null
            ? <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"><MapPin className="h-3 w-3" /> Found on the map</p>
            : <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Pick it from the list so I can find it on the map.</p>}
          <span className={label}>Home type</span>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map(([id, name]) => <button key={id} type="button" onClick={() => setSub({ property_type: id })} aria-pressed={sub.property_type === id} className={chip(sub.property_type === id)}>{name}</button>)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 chatwide:grid-cols-3">
            {([['beds', 'Bedrooms'], ['full_baths', 'Full baths'], ['half_baths', 'Half baths'], ['above_grade_finished_area', 'Finished sq ft'], ['year_built', 'Year built']] as const).map(([k, name]) => (
              <label key={k} className="min-w-0 text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">{name}
                <input type="number" min={0} inputMode="numeric" value={sub[k] ?? ''} onChange={e => setSub({ [k]: num(e.target.value) })} className={`${inputCls} mt-0.5`} />
              </label>
            ))}
          </div>
          <div className="mt-2"><StepDone onDone={() => steps.done('home')} /></div>
        </CardStep>
      )}
      <CardStep id="client" n={n('client')} title="Client" summary={picks.client_name || 'None yet'} steps={steps}>
        <input value={picks.client_name} onChange={e => set({ client_name: e.target.value })} placeholder="Client's name (optional)" aria-label="Client's name" className={inputCls} />
        <div className="mt-2"><StepDone onDone={() => steps.done('client')} /></div>
      </CardStep>
      <CardStep id="condition" n={n('condition')} title="Condition" summary={picks.condition || 'Not said'} steps={steps}>
        <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">What the listing can&apos;t show. The AI weighs this when it values the home.</p>
        <div className="flex flex-wrap gap-1.5">
          {CONDITIONS.map(c => <button key={c} type="button" onClick={() => set({ condition: picks.condition === c ? '' : c })} aria-pressed={picks.condition === c} className={chip(picks.condition === c)}>{c}</button>)}
        </div>
        <textarea value={picks.recent_updates} onChange={e => set({ recent_updates: e.target.value })} rows={2} placeholder="Recent updates (new roof 2024, kitchen redone...)" aria-label="Recent updates" className={`${inputCls} mt-2 resize-none`} />
        {manual && (
          <>
            <textarea value={picks.public_remarks} onChange={e => set({ public_remarks: e.target.value })} rows={2} placeholder="Anything else about the home" aria-label="About the home" className={`${inputCls} mt-1.5 resize-none`} />
            <span className={label}>Photos of its condition</span>
            {picks.condition_photos.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1.5">{picks.condition_photos.map(u => <img key={u} src={resolveMediaUrl(u)} alt="" className="h-12 w-16 rounded-md object-cover ring-1 ring-black/10" />)}</div>
            )}
            {picks.condition_photos.length < 10 && <PhotoDrop compact onPhoto={ph => set({ condition_photos: [...picks.condition_photos, ph.url] })} testid="ai-cma-photo" />}
          </>
        )}
        <div className="mt-2"><StepDone onDone={() => steps.done('condition')} /></div>
      </CardStep>
      <CardStep id="report" n={n('report')} title="The report" summary={`${picks.theme === 'dark' ? 'Dark' : 'Light'}${picks.hidden_sections.length ? ` · ${picks.hidden_sections.length} hidden` : ''}`} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {([['light', 'Light'], ['dark', 'Dark']] as const).map(([id, name]) => <button key={id} type="button" onClick={() => set({ theme: id })} aria-pressed={picks.theme === id} className={chip(picks.theme === id)}>{name}</button>)}
        </div>
        <div className="mt-2"><SectionToggles all={SECTIONS} hidden={picks.hidden_sections} onChange={hidden_sections => set({ hidden_sections })} /></div>
      </CardStep>
    </PickShell>
  )
}
