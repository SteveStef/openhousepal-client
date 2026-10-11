'use client'

import { Sparkles, Star } from 'lucide-react'
import api from '@/lib/api-service'
import { FeaturedSettings } from '@/types'
import MultiSelectDatabaseInput from '@/components/MultiSelectDatabaseInput'
import NumberInput from './NumberInput'
import OhpSwitch from '@/components/ui/OhpSwitch'

const SORT_OPTIONS: { value: FeaturedSettings['sort']; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_desc', label: 'Highest price first' },
  { value: 'price_asc', label: 'Lowest price first' },
]

// Drives the public "Featured" nav tab (/properties) - a full page, not a page-builder block,
// so its settings live at the site level (see schemas.site.FeaturedSettings) rather than in
// any one page's blocks. 'My Active Listings' is today's behavior unchanged; 'Custom Filter'
// hands the page to a real full-MLS search (content_adapters.get_featured_page_listings) so an
// agent can build a showcase page - e.g. only $1.5M-$4M listings across a few school districts,
// highest price first - instead of just their own inventory.
export default function FeaturedSettingsPanel({
  value, onChange,
}: {
  value: FeaturedSettings
  onChange: (next: FeaturedSettings) => void
}) {
  const isFiltered = value.mode === 'filtered'

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]">
        <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#8b7355]">
          <Star className="h-3.5 w-3.5" /> Featured Page
        </p>
        <p className="mt-1 text-[10px] font-semibold text-gray-400">
          Controls what shows on your site&apos;s public &quot;Featured&quot; tab (yoursite.com/properties).
        </p>

        <div className="mt-3 grid gap-2">
          {([
            ['my_listings', 'My listings only', 'Just the homes you have listed right now.'],
            ['served_areas', 'Homes in my areas', 'Every home for sale in the towns on your Areas tab - yours shown first. Best when you have only a few listings of your own.'],
            ['filtered', 'Custom collection', 'Pick towns, school districts and a price range from the full MLS.'],
          ] as const).map(([mode, label, hint]) => {
            const on = value.mode === mode
            return (
              <button key={mode} onClick={() => onChange({ ...value, mode })} className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/5' : 'border-gray-200 hover:border-[#C9A24D]/40 dark:border-gray-800'}`}>
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D]' : 'border-gray-300'}`}>{on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                <span><span className="block text-xs font-black text-[#111827] dark:text-white">{label}</span><span className="mt-0.5 block text-[10px] font-semibold leading-snug text-gray-400">{hint}</span></span>
              </button>
            )
          })}
        </div>

        {value.mode === 'served_areas' && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Min price (optional)</label>
              <NumberInput value={value.min_price != null ? String(value.min_price) : ''} onChange={v => onChange({ ...value, min_price: v ? Number(v) : null })} placeholder="Any" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Sort</label>
              <select value={value.sort} onChange={e => onChange({ ...value, sort: e.target.value as FeaturedSettings['sort'] })} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white">
                {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {isFiltered && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Towns</label>
              <MultiSelectDatabaseInput
                values={value.towns}
                onChange={towns => onChange({ ...value, towns })}
                apiMethod={api.properties.cities}
                placeholder="Search towns..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">School districts</label>
              <MultiSelectDatabaseInput
                values={value.school_districts}
                onChange={school_districts => onChange({ ...value, school_districts })}
                apiMethod={api.properties.searchSchoolDistricts}
                placeholder="Search school districts..."
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <p className="text-xs font-black text-[#111827] dark:text-white">Prioritize My Listings</p>
                <p className="mt-0.5 text-[10px] font-semibold text-gray-400">Your own matching listings show first, ahead of the rest of the MLS.</p>
              </div>
              <OhpSwitch on={value.prioritize_my_listings} onChange={v => onChange({ ...value, prioritize_my_listings: v })} label="Prioritize My Listings" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Min price</label>
                <NumberInput
                  value={value.min_price != null ? String(value.min_price) : ''}
                  onChange={v => onChange({ ...value, min_price: v ? Number(v) : null })}
                  placeholder="1,500,000"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Max price</label>
                <NumberInput
                  value={value.max_price != null ? String(value.max_price) : ''}
                  onChange={v => onChange({ ...value, max_price: v ? Number(v) : null })}
                  placeholder="4,000,000"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Sort</label>
              <select
                value={value.sort}
                onChange={e => onChange({ ...value, sort: e.target.value as FeaturedSettings['sort'] })}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
              >
                {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            {value.towns.length === 0 && value.school_districts.length === 0 && (
              <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3 w-3" /> Add at least one town or school district to activate the filter - until then this falls back to your active listings.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
