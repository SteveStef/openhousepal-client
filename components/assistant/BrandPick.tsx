'use client'

import { Check, Lock } from 'lucide-react'
import { BRAND_COLOR_GROUPS, BRAND_FINISHES, BRAND_LOOKS, BRAND_MODES } from '@/lib/brandKit'
import { CardStep, useSteps } from './CardPickers'

export type BrandPicks = { theme: 'classic' | 'luxe'; metal: string; dark: boolean; secondary_color: string; apply_all?: boolean }

// The Branding page's own choices, right on the helper's card (owner, 10/31: "show me every color we
// have, like I was on that page") - the look, the color (Classic) or finish (Luxe), Ivory / Midnight.
// Nothing saves until Save on the card; the server checks the picks again (ai_actions_catalog._adjust_brand).
export default function BrandPick({ picks, onPicks, idx, notUsing = [] }: { picks: BrandPicks; onPicks: (p: BrandPicks) => void; idx: boolean; notUsing?: string[] }) {
  const set = (patch: Partial<BrandPicks>) => onPicks({ ...picks, ...patch })
  const chip = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
    ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
    : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`
  const luxe = picks.theme === 'luxe'
  const metal = (BRAND_FINISHES.find(f => f.id === picks.metal) || BRAND_FINISHES[0]).palette
  // Steps that fold away once picked (owner, 11/01)
  const steps = useSteps(notUsing.length ? ['look', 'color', 'pages', 'everywhere'] : ['look', 'color', 'pages'])
  const colorName = BRAND_COLOR_GROUPS.flat().find(c => c.color.toLowerCase() === picks.secondary_color.toLowerCase())?.label || 'Your color'
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-brand-pick">
      {/* the look, drawn small so they can see what they're picking */}
      <div className="flex items-center gap-3">
        <div className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10 ${picks.dark ? 'bg-[#101114]' : 'bg-[#fbf8f1]'}`}>
          <span className="absolute left-2 top-2 h-1.5 w-9 rounded-full" style={{ background: luxe ? metal.base : picks.secondary_color }} />
          <span className={`absolute left-2 top-5 h-1 w-12 rounded-full ${picks.dark ? 'bg-white/30' : 'bg-black/15'}`} />
          <span className="absolute bottom-2 left-2 h-3 w-10 rounded-full" style={{ background: luxe ? `linear-gradient(90deg,${metal.deep},${metal.light},${metal.deep})` : picks.secondary_color }} />
        </div>
        <p className="text-xs font-semibold text-gray-600 dark:text-zinc-300">
          {luxe ? 'Luxe' : 'Classic'} · {luxe ? (BRAND_FINISHES.find(f => f.id === picks.metal)?.label || 'Gold') : 'your color'} · {picks.dark ? 'Midnight' : 'Ivory'}
        </p>
      </div>
      <CardStep id="look" n={1} title="Look" summary={luxe ? 'Luxe' : 'Classic'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {BRAND_LOOKS.map(l => {
            const locked = l.idxOnly && !idx
            return (
              <button key={l.id} type="button" disabled={locked} onClick={() => { set({ theme: l.id }); steps.picked('look') }} aria-pressed={picks.theme === l.id}
                title={locked ? 'Comes with the IDX plan' : l.blurb} className={`${chip(picks.theme === l.id)} ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
                {locked && <Lock className="-mt-0.5 mr-1 inline h-3 w-3" />}{l.label}
              </button>
            )
          })}
        </div>
      </CardStep>
      {luxe ? (
        <CardStep id="color" n={2} title="Finish" summary={BRAND_FINISHES.find(f => f.id === picks.metal)?.label || 'Gold'} steps={steps}>
          <div className="flex flex-wrap gap-1.5">
            {BRAND_FINISHES.map(f => <button key={f.id} type="button" onClick={() => { set({ metal: f.id }); steps.picked('color') }} aria-pressed={picks.metal === f.id} className={chip(picks.metal === f.id)}>{f.label}</button>)}
          </div>
        </CardStep>
      ) : (
        <CardStep id="color" n={2} title="Color" steps={steps}
          summary={<span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: picks.secondary_color }} />{colorName}</span>}>
          {/* one even grid - the page's rows wrapped 6, 2, 6, 2, 1 in a phone-width card (owner's test, 11/01) */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] justify-items-center gap-1.5">
            {BRAND_COLOR_GROUPS.flat().map(c => {
              const on = c.color.toLowerCase() === picks.secondary_color.toLowerCase()
              return (
                <button key={c.color} type="button" onClick={() => { set({ secondary_color: c.color }); steps.picked('color') }} aria-pressed={on} title={c.label} aria-label={c.label}
                  className={`ohp-ai-press relative grid h-7 w-7 place-items-center rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 ${on ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`}
                  style={{ background: c.color }}>
                  {on && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" strokeWidth={3} />}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
      <CardStep id="pages" n={3} title="Pages" summary={picks.dark ? 'Midnight' : 'Ivory'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {BRAND_MODES.map(m => <button key={m.id} type="button" onClick={() => { set({ dark: m.dark }); steps.picked('pages') }} aria-pressed={picks.dark === m.dark} title={m.blurb} className={chip(picks.dark === m.dark)}>{m.label}</button>)}
        </div>
      </CardStep>
      {notUsing.length > 0 && (
        // Like the Branding page's "Use this color for all features" - asked, never assumed (owner, 11/01)
        <CardStep id="everywhere" n={4} title="Every tool?" summary={picks.apply_all ? 'Yes, every tool' : 'Only where it is on'} steps={steps}>
          <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Not using your brand now: {notUsing.join(', ')}.</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { set({ apply_all: true }); steps.picked('everywhere') }} aria-pressed={!!picks.apply_all} className={chip(!!picks.apply_all)} data-testid="ai-brand-all">Yes, every tool</button>
            <button type="button" onClick={() => { set({ apply_all: false }); steps.picked('everywhere') }} aria-pressed={!picks.apply_all} className={chip(!picks.apply_all)}>Only where it&apos;s on now</button>
          </div>
        </CardStep>
      )}
    </div>
  )
}
