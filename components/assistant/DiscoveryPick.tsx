'use client'

import { Check, Home, MapPin } from 'lucide-react'
import { CardStep, StepDone, useSteps } from './CardPickers'

// The agent's Discovery search, set up from the chat (owner, 11/01: "if they have not set a filter yet
// ... make that filter for them in discovery, and it saves"): where to center it (their listings, their
// towns, the place they named), how far, and an optional price floor and beds. Saves to the Discovery
// page's own filter (set_discovery_search).
export type DiscoveryCenter = { label: string; lat: number; lng: number; kind: 'listing' | 'town' | 'home' }
export type DiscoveryPicks = { center: string; miles: number; min_price: number | null; max_price: number | null; min_bedrooms: number | null }

export function discoveryStart(payload: Record<string, any>): DiscoveryPicks {
  return { center: payload.center || '', miles: Number(payload.miles) || 10, min_price: payload.min_price ?? null, max_price: payload.max_price ?? null, min_bedrooms: payload.min_bedrooms ?? null }
}

const MILES = [3, 5, 10, 15, 25]
const PRICES: [number | null, string][] = [[null, 'Any'], [300000, '$300K'], [500000, '$500K'], [750000, '$750K'], [1000000, '$1M'], [2000000, '$2M']]
const MAXES: [number | null, string][] = [[null, 'No max'], [500000, '$500K'], [750000, '$750K'], [1000000, '$1M'], [1500000, '$1.5M'], [2000000, '$2M'], [3000000, '$3M']]
const BEDS: [number | null, string][] = [[null, 'Any'], [2, '2+'], [3, '3+'], [4, '4+'], [5, '5+']]
const chipCls = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`

export function DiscoveryPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: DiscoveryPicks; onPicks: (p: DiscoveryPicks) => void }) {
  const centers = (payload.centers || []) as DiscoveryCenter[]
  const steps = useSteps(['center', 'miles', 'filters'])
  const set = (p: Partial<DiscoveryPicks>) => onPicks({ ...picks, ...p })
  const lo = PRICES.find(p => p[0] === picks.min_price)?.[1]
  const hi = MAXES.find(p => p[0] === picks.max_price)?.[1]
  // "$500K - $1M", "$500K+", "Up to $1M" or "Any price"
  const price = picks.min_price && picks.max_price ? `${lo} - ${hi}` : picks.min_price ? `${lo}+` : picks.max_price ? `Up to ${hi}` : 'Any'
  const beds = BEDS.find(b => b[0] === picks.min_bedrooms)?.[1] || 'Any'
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-discovery-pick">
      {/* the search in one line, as it will save */}
      <div className="flex items-center gap-2.5 rounded-xl bg-[#111827] px-3 py-2.5 text-white dark:bg-zinc-900 dark:ring-1 dark:ring-[#C9A24D]/30">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#C9A24D]/20 text-[#e8c97a]"><MapPin className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-black">{picks.miles} miles around {picks.center.split(',')[0] || '...'}</span>
          <span className="block truncate text-[10.5px] font-semibold text-white/60">{[price !== 'Any' ? price : 'Any price', beds !== 'Any' ? `${beds} beds` : 'any beds'].join(' · ')}</span>
        </span>
      </div>
      <CardStep id="center" n={1} title="Center" summary={picks.center.split(',')[0]} steps={steps}>
        <div className="space-y-1.5" data-testid="ai-discovery-centers">
          {centers.map(c => {
            const on = c.label === picks.center
            const Icon = c.kind === 'town' ? MapPin : Home
            return (
              <button key={c.label} type="button" role="radio" aria-checked={on} onClick={() => { set({ center: c.label }); steps.picked('center') }}
                className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${on
                  ? 'border-[#C9A24D] bg-[#fffaf0] dark:border-[#C9A24D]/70 dark:bg-[#C9A24D]/[0.08]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-zinc-700 dark:bg-zinc-900'}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${on ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                  {on ? <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> : <Icon className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-[#111827] dark:text-white">{c.label}</span>
                  <span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{c.kind === 'listing' ? 'Your listing' : c.kind === 'town' ? 'Town' : 'Address'}</span>
                </span>
              </button>
            )
          })}
        </div>
      </CardStep>
      <CardStep id="miles" n={2} title="How far" summary={`${picks.miles} miles`} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {MILES.map(m => <button key={m} type="button" aria-pressed={picks.miles === m} onClick={() => { set({ miles: m }); steps.picked('miles') }} className={chipCls(picks.miles === m)}>{m} mi</button>)}
        </div>
      </CardStep>
      <CardStep id="filters" n={3} title="Homes" summary={`${price} · ${beds} beds`} steps={steps}>
        {/* min and max side by side, like the Discovery page (owner, 11/01) - each a row to swipe */}
        <div className="grid grid-cols-2 gap-2">
          {([['Price from', PRICES, 'min_price'], ['Up to', MAXES, 'max_price']] as const).map(([label, opts, key]) => (
            <div key={key} className="min-w-0">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">{label}</p>
              <div className="flex flex-col gap-1" data-testid={`ai-discovery-${key}`}>
                {opts.map(([v, l]) => {
                  const bad = key === 'max_price' && v != null && picks.min_price != null && v <= picks.min_price
                    || key === 'min_price' && v != null && picks.max_price != null && v >= picks.max_price
                  return <button key={l} type="button" disabled={bad} aria-pressed={picks[key] === v} onClick={() => set({ [key]: v } as Partial<DiscoveryPicks>)}
                    className={`${chipCls(picks[key] === v)} w-full disabled:opacity-30`}>{l}</button>
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mb-1.5 mt-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">Bedrooms</p>
        <div className="flex flex-wrap gap-1.5">
          {BEDS.map(([v, l]) => <button key={l} type="button" aria-pressed={picks.min_bedrooms === v} onClick={() => set({ min_bedrooms: v })} className={chipCls(picks.min_bedrooms === v)}>{l}</button>)}
        </div>
        <div className="mt-2.5"><StepDone onDone={() => steps.done('filters')} /></div>
      </CardStep>
    </div>
  )
}
