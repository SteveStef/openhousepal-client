'use client'

// "What your Featured page shows" (owner, 10/22) - tick what the page is made of (your own
// listings, homes in your towns, homes you hand-pick from the MLS) and how they're ordered:
// "my listings first, then the rest" (one listing never means a one-card page) or "mix them
// together". The setup flow and the website editor's Featured tab both use this, on the same
// saved featured_settings, so a change in one shows in the other.
import { useEffect, useState } from 'react'
import { Check, Home, ListOrdered, MapPin, Search, Shuffle } from 'lucide-react'
import api from '@/lib/api-service'
import type { FeaturedSettings } from '@/types'
import MultiSelectDatabaseInput from '@/components/MultiSelectDatabaseInput'
import PricePicker from './PricePicker'

export const DEFAULT_FEATURED: FeaturedSettings = {
  mode: 'my_listings', min_price: null, max_price: null, towns: [], school_districts: [], sort: 'newest', prioritize_my_listings: true,
}

/** What the page is made of. Saves from before 10/22 only have `mode` - read the way they always
 *  worked (same rule as the server's content_adapters.featured_sources). */
export function featuredSources(v: FeaturedSettings): { mine: boolean; areas: boolean; custom: boolean } {
  return {
    mine: v.show_mine ?? (v.mode !== 'filtered' || v.prioritize_my_listings !== false),
    areas: v.show_area_homes ?? v.mode === 'served_areas',
    custom: v.show_custom ?? v.mode === 'filtered',
  }
}

/** Writes the tick boxes, plus the matching old `mode` so anything still reading it agrees. */
export function withSources(v: FeaturedSettings, s: { mine: boolean; areas: boolean; custom: boolean }): FeaturedSettings {
  return { ...v, show_mine: s.mine, show_area_homes: s.areas, show_custom: s.custom, mode: s.custom ? 'filtered' : s.areas ? 'served_areas' : 'my_listings' }
}

const SORTS: { value: FeaturedSettings['sort']; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_desc', label: 'Highest price first' },
  { value: 'price_asc', label: 'Lowest price first' },
]

export default function FeaturedPagePicker({ value, onChange, compact = false }: {
  value: FeaturedSettings
  onChange: (next: FeaturedSettings) => void
  /** the website editor's smaller look */
  compact?: boolean
}) {
  const v = { ...DEFAULT_FEATURED, ...value }
  const src = featuredSources(v)
  const [towns, setTowns] = useState<string[] | null>(null)
  useEffect(() => {
    api.sites.getAreas(true).then(r => setTowns(r.success && r.data ? r.data.map(a => a.area?.name).filter(Boolean) as string[] : []))
  }, [])
  const others = src.areas || src.custom
  const set = (patch: Partial<typeof src>) => {
    const next = { ...src, ...patch }
    if (!next.mine && !next.areas && !next.custom) return // always something on the page
    onChange(withSources(v, next))
  }
  const picked = (v.area_towns || []).filter(t => !towns || towns.includes(t))
  const toggleTown = (t: string) => onChange({ ...v, area_towns: picked.includes(t) ? picked.filter(x => x !== t) : [...picked, t] })

  const T = compact
    ? { h: 'text-[10px] font-black uppercase tracking-wide text-gray-400', title: 'text-xs font-black', blurb: 'text-[10px] font-semibold leading-snug text-gray-400', box: 'gap-3 rounded-xl border-2 p-3', gap: 'space-y-4', ico: 'h-7 w-7 rounded-lg', icoI: 'h-3.5 w-3.5', tick: 'h-4 w-4', chip: 'min-h-[32px] px-3 py-1.5 text-[11px]' }
    : { h: 'font-serif text-[21px] font-black tracking-tight text-[#111827] dark:text-white', title: 'text-[16px] font-black', blurb: 'text-[13.5px] font-medium leading-snug text-gray-500 dark:text-gray-400', box: 'gap-4 rounded-2xl border-2 p-4 sm:px-5', gap: 'space-y-7', ico: 'h-11 w-11 rounded-2xl', icoI: 'h-5 w-5', tick: 'h-7 w-7', chip: 'min-h-[44px] px-4 py-2 text-[14px]' }

  const choice = (sel: boolean) => `flex items-start gap-3 rounded-2xl border-2 text-left transition ${compact ? 'p-2.5 !rounded-xl' : 'p-4'} ${sel ? 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white shadow-[0_14px_28px_-22px_rgba(139,106,43,.9)] dark:from-[#1d1912] dark:to-[#141416]' : 'border-[#ece5d6] bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416]'}`

  return (
    <div className={T.gap} data-testid="featured-page-picker">
      <div>
        <p className={T.h}>What it shows</p>
        {!compact && <p className="mt-0.5 text-[14px] font-medium text-gray-500 dark:text-gray-400">Tick everything you want on it.</p>}
        <div className={`${compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}`}>
          <Source T={T} compact={compact} on={src.mine} onToggle={() => set({ mine: !src.mine })} icon={Home} title="My own listings" blurb="The homes you have listed right now." />
          <Source T={T} compact={compact} on={src.areas} onToggle={() => set({ areas: !src.areas })} icon={MapPin} title="Homes for sale in my towns" blurb="Every home for sale in the towns you serve - great when you only have a few listings.">
            {towns === null ? null : towns.length === 0 ? (
              <p className={T.blurb}>Add the towns you serve first (the &quot;Towns you serve&quot; step, or the Areas tab) - this uses them.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onChange({ ...v, area_towns: [] })} className={`inline-flex items-center gap-1 rounded-full border-2 font-black transition ${T.chip} ${picked.length === 0 ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-[#ece5d6] text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300'}`}>
                  {picked.length === 0 && <Check className="h-3.5 w-3.5" strokeWidth={3} />}All my towns
                </button>
                {towns.map(t => {
                  const on = picked.includes(t)
                  return (
                    <button key={t} type="button" onClick={() => toggleTown(t)} className={`inline-flex items-center gap-1 rounded-full border-2 font-black transition ${T.chip} ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-[#ece5d6] text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300'}`}>
                      {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <MapPin className="h-3.5 w-3.5" />}{t}
                    </button>
                  )
                })}
              </div>
            )}
          </Source>
          <Source T={T} compact={compact} on={src.custom} onToggle={() => set({ custom: !src.custom })} icon={Search} title="Other homes I pick" blurb="Choose any towns or school districts from the whole MLS - like a luxury showcase.">
            <div className="space-y-3">
              <div>
                <p className={compact ? T.h : 'text-[14px] font-black text-[#111827] dark:text-white'}>Towns</p>
                <MultiSelectDatabaseInput values={v.towns} onChange={t => onChange({ ...v, towns: t })} apiMethod={api.properties.cities} placeholder="Search towns..." className="mt-1" />
              </div>
              <div>
                <p className={compact ? T.h : 'text-[14px] font-black text-[#111827] dark:text-white'}>School districts</p>
                <MultiSelectDatabaseInput values={v.school_districts} onChange={d => onChange({ ...v, school_districts: d })} apiMethod={api.properties.searchSchoolDistricts} placeholder="Search school districts..." className="mt-1" />
              </div>
              {v.towns.length === 0 && v.school_districts.length === 0 && <p className="text-[12px] font-bold text-amber-600 dark:text-amber-400">Add at least one town or school district.</p>}
            </div>
          </Source>
        </div>
      </div>

      {src.mine && others && (
        <div>
          <p className={T.h}>In what order?</p>
          <div className={`grid gap-2 ${compact ? 'mt-2' : 'mt-3 gap-3'}`}>
            <button type="button" aria-pressed={v.prioritize_my_listings !== false} onClick={() => onChange({ ...v, prioritize_my_listings: true })} className={choice(v.prioritize_my_listings !== false)}>
              <ListOrdered className={`mt-0.5 shrink-0 text-[#C9A24D] ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
              <span><span className={`block text-[#111827] dark:text-white ${T.title}`}>My listings first, then fill with others</span><span className={`mt-0.5 block ${T.blurb}`}>Yours lead the page; the rest fill in after, so it&apos;s never just one or two homes.</span></span>
            </button>
            <button type="button" aria-pressed={v.prioritize_my_listings === false} onClick={() => onChange({ ...v, prioritize_my_listings: false })} className={choice(v.prioritize_my_listings === false)}>
              <Shuffle className={`mt-0.5 shrink-0 text-[#C9A24D] ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
              <span><span className={`block text-[#111827] dark:text-white ${T.title}`}>Mix them together</span><span className={`mt-0.5 block ${T.blurb}`}>Everything in one list, in the order you pick below.</span></span>
            </button>
          </div>
        </div>
      )}

      {others && (
        <div>
          <p className={T.h}>Price of the other homes</p>
          <div className={compact ? 'mt-2' : 'mt-3'}>
            <PricePicker compact={compact} min={v.min_price ?? null} max={v.max_price ?? null} onChange={(min_price, max_price) => onChange({ ...v, min_price, max_price })} />
          </div>
        </div>
      )}

      <div>
        <p className={T.h}>Sort by</p>
        <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3 gap-2'}`}>
          {SORTS.map(s => (
            <button key={s.value} type="button" aria-pressed={v.sort === s.value} onClick={() => onChange({ ...v, sort: s.value })}
              className={`inline-flex items-center gap-1 rounded-full border-2 font-black transition ${T.chip} ${v.sort === s.value ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-[#ece5d6] text-gray-600 hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300'}`}>
              {v.sort === s.value && <Check className="h-3.5 w-3.5" strokeWidth={3} />}{s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Source({ on, onToggle, icon: Icon, title, blurb, children, T, compact }: { on: boolean; onToggle: () => void; icon: typeof Home; title: string; blurb: string; children?: React.ReactNode; T: Record<string, string>; compact: boolean }) {
  return (
    <div className={`overflow-hidden rounded-2xl border-2 transition ${on ? 'border-[#C9A24D] bg-[#fffdf8] dark:bg-[#1a1712]' : 'border-[#ece5d6] bg-white dark:border-white/10 dark:bg-[#141416]'} ${compact ? '!rounded-xl' : ''}`}>
      <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className={`flex w-full items-center text-left ${T.box} !rounded-none !border-0`}>
        <span className={`flex shrink-0 items-center justify-center ${T.ico} ${on ? 'bg-[#111827] text-[#e8c97a] dark:bg-white dark:text-[#111827]' : 'bg-[#f3eee3] text-[#8b7355] dark:bg-white/[0.06]'}`}><Icon className={T.icoI} /></span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[#111827] dark:text-white ${T.title}`}>{title}</span>
          <span className={`mt-0.5 block ${T.blurb}`}>{blurb}</span>
        </span>
        <span className={`flex shrink-0 items-center justify-center rounded-lg border-2 transition ${T.tick} ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-white/25'}`}>{on && <Check className="h-3/5 w-3/5" strokeWidth={3.5} />}</span>
      </button>
      {on && children && <div className={compact ? 'border-t border-[#C9A24D]/20 px-3 pb-3 pt-2.5' : 'border-t border-[#C9A24D]/20 px-4 pb-4 pt-3 sm:px-5'}>{children}</div>}
    </div>
  )
}
