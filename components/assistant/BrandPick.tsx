'use client'

import FitLogo from '@/components/ui/FitLogo'
import { Check, Lock, X } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { BRAND_COLOR_GROUPS, BRAND_FINISHES, BRAND_LOOKS, BRAND_MODES } from '@/lib/brandKit'
import { CardStep, StepDone, useSteps } from './CardPickers'
import { PhotoDrop } from './PhotoDrop'

export type BrandPicks = {
  theme: 'classic' | 'luxe'; metal: string; dark: boolean; secondary_color: string; apply_all?: boolean
  heading_font: string; body_font: string; disclaimer_text: string; logos: Record<string, string | null>; headshot: string | null; qr: string
}
const FONTS: [string, string, string][] = [['serif', 'Editorial Serif', 'Georgia, serif'], ['sans', 'Modern Sans', 'system-ui, sans-serif'], ['mono', 'Structured Mono', 'ui-monospace, monospace']]
const LOGOS: [string, string][] = [['personal', 'Personal logo'], ['team', 'Team logo'], ['brokerage', 'Brokerage logo']]
const QRS: [string, string, boolean][] = [['ohp', 'OpenHousePal mark', false], ['logo', 'My logo', true], ['initials', 'My initials', true]]

// The Branding page's own choices, right on the helper's card (owner, 10/31: "show me every color we
// have, like I was on that page") - the look, the color (Classic) or finish (Luxe), Ivory / Midnight.
// Nothing saves until Save on the card; the server checks the picks again (ai_actions_catalog._adjust_brand).
export default function BrandPick({ picks, onPicks, luxeOk, upgradeLabel, notUsing = [], qrAllowed = false }: { picks: BrandPicks; onPicks: (p: BrandPicks) => void; luxeOk: boolean; upgradeLabel: string; notUsing?: string[]; qrAllowed?: boolean }) {
  const set = (patch: Partial<BrandPicks>) => onPicks({ ...picks, ...patch })
  const chip = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
    ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
    : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`
  const luxe = picks.theme === 'luxe'
  // Steps that fold away once picked (owner, 11/01)
  const ids = ['look', 'color', 'pages', ...(notUsing.length ? ['everywhere'] : []), 'logos', 'headshot', 'fonts', 'disclaimer', 'qr']
  const steps = useSteps(ids)
  const n = (id: string) => ids.indexOf(id) + 1
  const logoCount = Object.values(picks.logos).filter(Boolean).length
  const colorName = BRAND_COLOR_GROUPS.flat().find(c => c.color.toLowerCase() === picks.secondary_color.toLowerCase())?.label || 'Your color'
  return (
    <>
      <CardStep id="look" n={n('look')} title="Look" summary={luxe ? 'Luxe' : 'Classic'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {BRAND_LOOKS.map(l => {
            const locked = l.gated && !luxeOk
            return (
              <button key={l.id} type="button" disabled={locked} onClick={() => { set({ theme: l.id }); steps.picked('look') }} aria-pressed={picks.theme === l.id}
                title={locked ? `Comes with the ${upgradeLabel} plan` : l.blurb} className={`${chip(picks.theme === l.id)} ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
                {locked && <Lock className="-mt-0.5 mr-1 inline h-3 w-3" />}{l.label}
              </button>
            )
          })}
        </div>
      </CardStep>
      {luxe ? (
        <CardStep id="color" n={n('color')} title="Finish" summary={BRAND_FINISHES.find(f => f.id === picks.metal)?.label || 'Gold'} steps={steps}>
          <div className="flex flex-wrap gap-1.5">
            {BRAND_FINISHES.map(f => <button key={f.id} type="button" onClick={() => { set({ metal: f.id }); steps.picked('color') }} aria-pressed={picks.metal === f.id} className={chip(picks.metal === f.id)}>{f.label}</button>)}
          </div>
        </CardStep>
      ) : (
        <CardStep id="color" n={n('color')} title="Color" steps={steps}
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
          <label className="mt-2 inline-flex items-center gap-2 text-[11px] font-bold text-gray-600 dark:text-zinc-300">
            <input type="color" value={picks.secondary_color} onChange={e => set({ secondary_color: e.target.value })} aria-label="Any color" className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" /> Any color
          </label>
        </CardStep>
      )}
      <CardStep id="pages" n={n('pages')} title="Pages" summary={picks.dark ? 'Midnight' : 'Ivory'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {BRAND_MODES.map(m => <button key={m.id} type="button" onClick={() => { set({ dark: m.dark }); steps.picked('pages') }} aria-pressed={picks.dark === m.dark} title={m.blurb} className={chip(picks.dark === m.dark)}>{m.label}</button>)}
        </div>
      </CardStep>
      {notUsing.length > 0 && (
        // Like the Branding page's "Use this color for all features" - asked, never assumed (owner, 11/01)
        <CardStep id="everywhere" n={n('everywhere')} title="Every tool?" summary={picks.apply_all ? 'Yes, every tool' : 'Only where it is on'} steps={steps}>
          <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Not using your brand now: {notUsing.join(', ')}.</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { set({ apply_all: true }); steps.picked('everywhere') }} aria-pressed={!!picks.apply_all} className={chip(!!picks.apply_all)} data-testid="ai-brand-all">Yes, every tool</button>
            <button type="button" onClick={() => { set({ apply_all: false }); steps.picked('everywhere') }} aria-pressed={!picks.apply_all} className={chip(!picks.apply_all)}>Only where it&apos;s on now</button>
          </div>
        </CardStep>
      )}
      <CardStep id="logos" n={n('logos')} title="Logos" summary={logoCount ? `${logoCount} added` : 'None yet'} steps={steps}>
        <div className="grid gap-2 sm:grid-cols-3" data-testid="ai-brand-logos">
          {LOGOS.map(([id, label]) => (
            <div key={id} className="min-w-0">
              <p className="mb-1 text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">{label}</p>
              {picks.logos[id]
                ? <div className="relative flex h-16 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-black/10"><FitLogo src={resolveMediaUrl(picks.logos[id]!)} on="light" alt={label} className="max-h-full max-w-full object-contain" />
                    <button type="button" aria-label={`Replace ${label}`} onClick={() => set({ logos: { ...picks.logos, [id]: null } })} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><X className="h-3 w-3" /></button></div>
                : <PhotoDrop compact label="Drop or tap" testid={`ai-brand-logo-${id}`} onPhoto={p => set({ logos: { ...picks.logos, [id]: p.png_url || p.url } })} />}
            </div>
          ))}
        </div>
        <div className="mt-2"><StepDone onDone={() => steps.done('logos')} /></div>
      </CardStep>
      <CardStep id="headshot" n={n('headshot')} title="Headshot" summary={picks.headshot ? 'Added' : 'None yet'} steps={steps}>
        <div className="flex items-center gap-3">
          {picks.headshot && <img src={resolveMediaUrl(picks.headshot)} alt="Your headshot" className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-black/10" />}
          <div className="min-w-0 flex-1"><PhotoDrop compact label={picks.headshot ? 'Drop a new one, or tap' : 'Drop your headshot, or tap'} testid="ai-brand-headshot" onPhoto={p => { set({ headshot: p.url }); steps.picked('headshot') }} /></div>
        </div>
      </CardStep>
      <CardStep id="fonts" n={n('fonts')} title="Fonts" summary={`${FONTS.find(f => f[0] === picks.heading_font)?.[1] || 'Serif'} + ${FONTS.find(f => f[0] === picks.body_font)?.[1] || 'Sans'}`} steps={steps}>
        {([['heading_font', 'Headings'], ['body_font', 'Body text']] as const).map(([k, label]) => (
          <div key={k} className="mb-2">
            <p className="mb-1 text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">{label}</p>
            <div className="flex flex-wrap gap-1.5">
              {FONTS.map(([id, name, family]) => <button key={id} type="button" onClick={() => set({ [k]: id } as Partial<BrandPicks>)} aria-pressed={picks[k] === id} style={{ fontFamily: family }} className={chip(picks[k] === id)}>{name}</button>)}
            </div>
          </div>
        ))}
        <StepDone onDone={() => steps.done('fonts')} />
      </CardStep>
      <CardStep id="disclaimer" n={n('disclaimer')} title="Disclaimer" summary={picks.disclaimer_text ? 'Added' : 'None'} steps={steps}>
        <textarea value={picks.disclaimer_text} onChange={e => set({ disclaimer_text: e.target.value })} maxLength={2000} rows={3} aria-label="Default disclaimer" placeholder="The small print on your designs. Leave it blank for none."
          className="w-full resize-none rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <div className="mt-2"><StepDone onDone={() => steps.done('disclaimer')} /></div>
      </CardStep>
      <CardStep id="qr" n={n('qr')} title="QR center" summary={QRS.find(q => q[0] === picks.qr)?.[1] || 'OpenHousePal mark'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {QRS.map(([id, name, gated]) => {
            const locked = gated && !qrAllowed
            return <button key={id} type="button" disabled={locked} title={locked ? `Comes with the ${upgradeLabel} plan` : undefined} onClick={() => { set({ qr: id }); steps.picked('qr') }} aria-pressed={picks.qr === id} className={`${chip(picks.qr === id)} ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>{locked && <Lock className="-mt-0.5 mr-1 inline h-3 w-3" />}{name}</button>
          })}
        </div>
      </CardStep>
    </>
  )
}
