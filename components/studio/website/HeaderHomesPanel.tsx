'use client'

import { useEffect, useState } from 'react'
import { Check, Home, Loader2, MapPin } from 'lucide-react'
import api from '@/lib/api-service'
import NumberInput from './NumberInput'
import OhpSwitch from '@/components/ui/OhpSwitch'

// "Your header" (Featured tab): which homes fill the top of the home page. The header always shows
// the NEWEST homes for sale that match - in the towns picked here (none picked = every town on
// the Areas tab), inside the price range and home type - refreshed on every visit, the agent's
// own matching listings first when that's on (content_adapters.get_header_listings). Everything
// here is stored on the Hero block (header_towns, photo_price_min/max, photo_property_type,
// header_mine_first, photo_source_mode).
const TYPES = [
  { value: '', label: 'Any type' },
  { value: 'single_family', label: 'Single family' },
  { value: 'town_house', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
  { value: 'multi_family', label: 'Multi-family' },
]

export default function HeaderHomesPanel({ data, onChange, onEditHero }: {
  data: Record<string, any> | null
  onChange: (patch: Record<string, any>) => void
  /** Opens the Sections tab on the header (headline, search box, buttons). */
  onEditHero?: () => void
}) {
  const [towns, setTowns] = useState<string[] | null>(null)
  useEffect(() => {
    api.sites.getAreas(true).then(r => setTowns(r.success && r.data ? r.data.map(a => a.area?.name).filter(Boolean) as string[] : []))
  }, [])

  if (!data) {
    return <p className="rounded-2xl border border-dashed border-gray-300 p-4 text-xs font-semibold text-gray-400 dark:border-gray-700">Your home page has no header section. Add &quot;Header&quot; from the Sections tab.</p>
  }

  const picked: string[] = Array.isArray(data.header_towns) ? data.header_towns : []
  const manual = data.photo_source_mode === 'manual'
  const mineFirst = data.header_mine_first !== false && data.header_mine_first !== 'false'
  const toggleTown = (t: string) => onChange({ header_towns: picked.includes(t) ? picked.filter(x => x !== t) : [...picked, t] })
  const input = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-[#151517]" data-testid="header-homes-panel">
      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#8b7355]"><Home className="h-3.5 w-3.5" /> Your header</p>
      <p className="mt-1 text-[10px] font-semibold text-gray-400">The top of your home page shows the <b>newest homes for sale</b> that match below - price, address and how new each one is, one tap to the home. It refreshes itself every visit.</p>

      {manual ? (
        <div className="mt-3 rounded-xl bg-[#C9A24D]/10 p-3">
          <p className="text-xs font-semibold text-[#8b7355] dark:text-[#e8c97a]">Your header is showing one photo you uploaded instead of homes.</p>
          <button type="button" onClick={() => onChange({ photo_source_mode: 'auto' })} className="mt-2 rounded-lg bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">Show the newest homes instead</button>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Towns</p>
            {towns === null ? <Loader2 className="mt-2 h-4 w-4 animate-spin text-gray-400" /> : towns.length === 0 ? (
              <p className="mt-1 text-[11px] font-semibold text-gray-400">Add the towns you serve on the Areas tab - the header uses them.</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onChange({ header_towns: [] })}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-black transition ${picked.length === 0 ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D] dark:border-gray-700'}`}>
                  {picked.length === 0 && <Check className="h-3 w-3" />}All my towns
                </button>
                {towns.map(t => {
                  const on = picked.includes(t)
                  return (
                    <button key={t} type="button" onClick={() => toggleTown(t)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-black transition ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300'}`}>
                      {on ? <Check className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}{t}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Price from</label>
              <NumberInput value={data.photo_price_min ? String(data.photo_price_min) : ''} onChange={v => onChange({ photo_price_min: v ? Number(v) : '' })} placeholder="Any" className={input} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Up to</label>
              <NumberInput value={data.photo_price_max ? String(data.photo_price_max) : ''} onChange={v => onChange({ photo_price_max: v ? Number(v) : '' })} placeholder="Any" className={input} />
            </div>
          </div>
          <div className="mt-2">
            <label className="text-[10px] font-black uppercase tracking-wide text-gray-400">Home type</label>
            <select value={data.photo_property_type || ''} onChange={e => onChange({ photo_property_type: e.target.value })} className={input}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button type="button" role="switch" aria-checked={mineFirst} onClick={() => onChange({ header_mine_first: !mineFirst })}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 text-left dark:border-gray-800">
            <span><span className="block text-xs font-black text-[#111827] dark:text-white">My own listings first</span><span className="block text-[10px] font-semibold text-gray-400">Your matching listings lead, then the newest from the MLS.</span></span>
            <OhpSwitch as="span" on={mineFirst} size="sm" />
          </button>
        </>
      )}
      {onEditHero && <button type="button" onClick={onEditHero} className="mt-3 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:underline dark:text-[#e8c97a]">Edit the headline, search box &amp; buttons →</button>}
    </div>
  )
}
