'use client'

import { useState } from 'react'
import { Check, Home, MapPin, TriangleAlert, UserRound, X } from 'lucide-react'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import { CardStep, OPTION_GRID, PickShell, StepDone, useSteps } from './CardPickers'

// The agent's Discovery search, set up from the chat (owner, 11/01: "if they have not set a filter yet
// ... make that filter for them in discovery, and it saves"): where to center it (their listings, their
// towns, the place they named), how far, and an optional price floor and beds. Saves to the Discovery
// page's own filter (set_discovery_search).
export type DiscoveryCenter = { label: string; lat: number; lng: number; kind: 'listing' | 'town' | 'home' | 'current' }
export type DiscoveryPicks = {
  center: string; miles: number; min_price: number | null; max_price: number | null; min_bedrooms: number | null
  /** The Discovery page's Exclude Agents / Only Agents list and which of the two it is (owner, 11/01). */
  agents: string[]; agent_mode: 'exclude' | 'include'
  /** Any address typed on the card (their own home, so they can search by commute - owner, 11/05). */
  custom_center?: { label: string; lat: number; lng: number } | null
  clear_also?: boolean
}

export function discoveryStart(payload: Record<string, any>): DiscoveryPicks {
  return { center: payload.center || '', miles: Number(payload.miles) || 10, min_price: payload.min_price ?? null, max_price: payload.max_price ?? null, min_bedrooms: payload.min_bedrooms ?? null,
    agents: Array.isArray(payload.agents) ? payload.agents : [], agent_mode: payload.agent_mode === 'include' ? 'include' : 'exclude' }
}

const money = (v: number) => v >= 1000000 ? `$${+(v / 1000000).toFixed(2)}M` : `$${Math.round(v / 1000)}K`
// The set choices, plus the exact amount asked for in the chat ("$1.5M to $5M") when it isn't one of them.
const withValue = (opts: [number | null, string][], v: number | null): [number | null, string][] =>
  v == null || opts.some(o => o[0] === v) ? opts : [...opts, [v, money(v)] as [number, string]].sort((x, y) => (x[0] ?? -1) - (y[0] ?? -1))

const MILES = [3, 5, 10, 15, 25]
const PRICES: [number | null, string][] = [[null, 'Any'], [300000, '$300K'], [500000, '$500K'], [750000, '$750K'], [1000000, '$1M'], [1500000, '$1.5M'], [2000000, '$2M']]
const MAXES: [number | null, string][] = [[null, 'No max'], [500000, '$500K'], [750000, '$750K'], [1000000, '$1M'], [1500000, '$1.5M'], [2000000, '$2M'], [3000000, '$3M'], [5000000, '$5M']]
const BEDS: [number | null, string][] = [[null, 'Any'], [2, '2+'], [3, '3+'], [4, '4+'], [5, '5+']]
const chipCls = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`

export function DiscoveryPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: DiscoveryPicks; onPicks: (p: DiscoveryPicks) => void }) {
  const centers = (payload.centers || []) as DiscoveryCenter[]
  const known = (payload.agents_known || []) as string[]
  const steps = useSteps(known.length ? ['center', 'miles', 'filters', 'agents'] : ['center', 'miles', 'filters'])
  const set = (p: Partial<DiscoveryPicks>) => onPicks({ ...picks, ...p })
  const prices = withValue(PRICES, picks.min_price), maxes = withValue(MAXES, picks.max_price)
  const [typed, setTyped] = useState<string>(payload.unresolved || '')
  const custom = picks.custom_center
  const also = (payload.also || []) as string[]
  const lo = prices.find(p => p[0] === picks.min_price)?.[1]
  const hi = maxes.find(p => p[0] === picks.max_price)?.[1]
  const agentsLine = picks.agents.length ? `${picks.agent_mode === 'include' ? 'Only' : 'Hiding'} ${picks.agents.map(n => n.split(' ')[0]).join(', ')}` : 'Any agent'
  // "$500K - $1M", "$500K+", "Up to $1M" or "Any price"
  const price = picks.min_price && picks.max_price ? `${lo} - ${hi}` : picks.min_price ? `${lo}+` : picks.max_price ? `Up to ${hi}` : 'Any'
  const beds = BEDS.find(b => b[0] === picks.min_bedrooms)?.[1] || 'Any'
  // The rings grow with the distance picked, so the preview moves as they tap.
  const ring = 26 + (MILES.indexOf(picks.miles) < 0 ? 2 : MILES.indexOf(picks.miles)) * 8
  return (
    <PickShell testid="ai-discovery-pick" side={260} preview={
      /* the search as it will save */
      <div className="overflow-hidden rounded-xl bg-[#111827] text-white dark:bg-zinc-900 dark:ring-1 dark:ring-[#C9A24D]/30" data-testid="ai-discovery-preview">
        <div className="relative hidden h-[150px] place-items-center group-data-[wide=yes]/pick:grid group-data-[wide=yes]/pick:h-[calc(var(--pick-h,300px)_-_90px)]">
          <span className="absolute rounded-full border border-[#C9A24D]/30 transition-all duration-500" style={{ width: ring * 3, height: ring * 3 }} />
          <span className="absolute rounded-full border border-[#C9A24D]/50 bg-[#C9A24D]/10 transition-all duration-500" style={{ width: ring * 2, height: ring * 2 }} />
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-[#C9A24D] text-[#111827]"><MapPin className="h-4 w-4" /></span>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#C9A24D]/20 text-[#e8c97a] group-data-[wide=yes]/pick:hidden"><MapPin className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-black">{picks.miles} miles around {picks.center.split(',')[0] || '...'}</span>
            <span className="block truncate text-[10.5px] font-semibold text-white/60">{[price !== 'Any' ? price : 'Any price', beds !== 'Any' ? `${beds} beds` : 'any beds', ...(known.length ? [agentsLine] : [])].join(' · ')}</span>
          </span>
        </div>
      </div>
    }>
      <CardStep id="center" n={1} title="Center" summary={picks.center.split(',')[0] || 'Pick one'} steps={steps}>
        {payload.unresolved && !custom && (
          <p className="mb-2 flex items-start gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300"><TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> Pick &quot;{payload.unresolved}&quot; from the list below so I can find it on the map.</p>
        )}
        <div className="mb-2" data-testid="ai-discovery-address">
          <p className="mb-1 text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">Any address, like your home, to search by your drive</p>
          <GooglePlacesAutocomplete value={typed} onChange={setTyped} placeholder="Type an address, then pick it from the list"
            onCoordinatesChange={(lat, lng, address) => { set({ custom_center: { label: address, lat, lng }, center: address }); setTyped(address); steps.picked('center') }}
            className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        </div>
        <div className={OPTION_GRID} data-testid="ai-discovery-centers">
          {custom && !centers.some(c => c.label === custom.label) && (
            <button type="button" role="radio" aria-checked={picks.center === custom.label} onClick={() => set({ center: custom.label })} className="ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border border-[#C9A24D] bg-[#fffaf0] px-2.5 py-2 text-left dark:bg-[#C9A24D]/[0.08]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3.5} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold text-[#111827] dark:text-white">{custom.label}</span><span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">The address you typed</span></span>
            </button>
          )}
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
                  <span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{c.kind === 'current' ? 'Your center now' : c.kind === 'listing' ? 'Your listing' : c.kind === 'town' ? 'Town' : 'Address'}</span>
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
          {([['Price from', prices, 'min_price'], ['Up to', maxes, 'max_price']] as const).map(([label, opts, key]) => (
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
      {also.length > 0 && (
        <div className="rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300" data-testid="ai-discovery-also">
          <p>Your Discovery also limits homes by: {also.join(' · ')}.</p>
          <button type="button" aria-pressed={!!picks.clear_also} onClick={() => set({ clear_also: !picks.clear_also })} className={`${chipCls(!!picks.clear_also)} mt-1.5`}>{picks.clear_also ? 'These will be cleared' : 'Clear these too'}</button>
        </div>
      )}
      {known.length > 0 && (
        <CardStep id="agents" n={4} title="Agents" summary={agentsLine} steps={steps}>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            {([['exclude', 'Hide these agents'], ['include', 'Only these agents']] as const).map(([m, l]) => (
              <button key={m} type="button" aria-pressed={picks.agent_mode === m} onClick={() => set({ agent_mode: m })} className={`${chipCls(picks.agent_mode === m)} w-full`}>{l}</button>
            ))}
          </div>
          <div className={OPTION_GRID} data-testid="ai-discovery-agents">
            {known.map(n => {
              const on = picks.agents.includes(n)
              return (
                <button key={n} type="button" aria-pressed={on} onClick={() => set({ agents: on ? picks.agents.filter(x => x !== n) : [...picks.agents, n] })}
                  className={`ohp-ai-press flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${on
                    ? 'border-[#C9A24D] bg-[#fffaf0] dark:border-[#C9A24D]/70 dark:bg-[#C9A24D]/[0.08]' : 'border-gray-200 bg-white opacity-70 dark:border-zinc-700 dark:bg-zinc-900'}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${on ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-400 dark:bg-zinc-800'}`}><UserRound className="h-3.5 w-3.5" /></span>
                  <span className={`min-w-0 flex-1 truncate text-[12.5px] font-bold ${on ? 'text-[#111827] dark:text-white' : 'text-gray-400 line-through'}`}>{n}</span>
                  <span className="text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">{on ? 'In the list' : <span className="inline-flex items-center gap-0.5"><X className="h-3 w-3" />Removed</span>}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{picks.agents.length ? (picks.agent_mode === 'include' ? 'Only their listings show.' : 'Their listings are hidden.') : 'No agent filter - every listing agent shows.'}</p>
          <div className="mt-2.5"><StepDone onDone={() => steps.done('agents')} /></div>
        </CardStep>
      )}
    </PickShell>
  )
}
