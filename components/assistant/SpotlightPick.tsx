'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { BRAND_COLORS, type BrandLook } from '@/lib/brandKit'
import { paintOf } from '@/components/studio/branding/FeaturePreviews'
import { CardStep, PickShell, SectionToggles, StepDone, chip, useSteps } from './CardPickers'

// A Spotlight's whole setup on the card (owner, 11/05: "it doesn't look like Spotlight has all the
// customizeable options"): the editor's look, color, main photo, how the header moves, the story, the
// sections and the 3D tour, with the front page moving just as it will. Nothing is made until Make it.
export type SpotlightPicks = {
  template_id: string; brand_color: string; hero_image: string | null
  header_mode: 'photo' | 'cycle'; header_motion: 'out' | 'in' | 'both' | 'none'
  story_mode: 'short' | 'original'; hidden_sections: string[]; virtual_tour_url: string; publish: boolean; editor?: boolean
}

export function spotlightStart(payload: Record<string, any>): SpotlightPicks {
  const pv = (payload?.preview || {}) as Record<string, any>
  return { template_id: payload?.template_id || 'cinematic_luxury', brand_color: pv.brand_color || '#C9A24D', hero_image: pv.photo || null,
    header_mode: 'photo', header_motion: 'out', story_mode: 'short', hidden_sections: [], virtual_tour_url: '', publish: false }
}

const SPOT_COLORS = BRAND_COLORS.slice(0, 14)
const MOTIONS: [SpotlightPicks['header_motion'], string][] = [['out', 'Slow zoom out'], ['in', 'Slow zoom in'], ['both', 'Both'], ['none', 'No movement']]
const SECTIONS: [string, string][] = [['story', 'Property story'], ['gallery', 'Photo gallery'], ['features', 'Features & amenities'], ['details', 'Property details'], ['location', 'Location & schools'],
  ['explore_nearby', 'Explore nearby'], ['town', 'About the town'], ['payment', 'Payment estimator'], ['open_houses', 'Open houses'], ['guest_tools', 'Follow this home & fact sheet'],
  ['video', 'AI video'], ['virtual_tour', '3D virtual tour'], ['floor_plans', 'Floor plans'], ['documents', 'Documents'], ['agents', 'Listing agent']]
const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
const ZOOM_CSS = `@keyframes spZoomOut{from{transform:scale(1.14)}to{transform:scale(1)}}@keyframes spZoomIn{from{transform:scale(1)}to{transform:scale(1.14)}}
.sp-z-out{animation:spZoomOut 7s ease-out infinite alternate}.sp-z-in{animation:spZoomIn 7s ease-out infinite alternate}.sp-z-both{animation:spZoomIn 3.5s ease-in-out infinite alternate}
@media (prefers-reduced-motion:reduce){.sp-z-out,.sp-z-in,.sp-z-both{animation:none}}`

export function SpotlightPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: SpotlightPicks; onPicks: (p: SpotlightPicks) => void }) {
  const pv = (payload.preview || {}) as Record<string, any>
  const photos = (pv.photos || []) as string[]
  const luxe = picks.template_id === 'cinematic_luxury'
  const color = picks.brand_color
  const look: BrandLook = { theme: 'classic', metal: 'gold', dark: luxe, accent: color, primary: '#111827', saved: true }
  const p = paintOf(look)
  const price = pv.price ? `$${Math.round(pv.price).toLocaleString()}` : ''
  const facts = [pv.beds && `${pv.beds} bd`, pv.baths && `${pv.baths} ba`, pv.sqft && `${Math.round(pv.sqft).toLocaleString()} sq ft`].filter(Boolean).join(' · ')
  const changed = color.toLowerCase() !== String(pv.brand_color || '').toLowerCase()
  const ids = ['look', 'color', ...(photos.length > 1 ? ['photo'] : []), 'motion', 'story', 'sections', 'finish']
  const steps = useSteps(ids)
  const n = (id: string) => ids.indexOf(id) + 1
  const set = (patch: Partial<SpotlightPicks>, step?: string) => { onPicks({ ...picks, ...patch }); if (step) steps.picked(step) }
  const colorName = SPOT_COLORS.find(c => c.color.toLowerCase() === color.toLowerCase())?.label || 'Your color'
  // A slideshow turns through the first few photos, as the page will.
  const [turn, setTurn] = useState(0)
  useEffect(() => {
    if (picks.header_mode !== 'cycle' || photos.length < 2) return
    const t = window.setInterval(() => setTurn(i => i + 1), 2600)
    return () => window.clearInterval(t)
  }, [picks.header_mode, photos.length])
  const shown = picks.header_mode === 'cycle' && photos.length > 1 ? [picks.hero_image, ...photos.filter(x => x !== picks.hero_image)].slice(0, 4)[turn % Math.min(4, photos.length)] : picks.hero_image
  const zoom = picks.header_motion === 'none' ? '' : `sp-z-${picks.header_motion}`
  return (
    <PickShell testid="ai-spotlight-pick" side={320} preview={
      /* the front page: their photo, address and price, moving as the header will */
      <div className={`relative h-[170px] overflow-hidden rounded-xl ring-1 ring-black/10 group-data-[wide=yes]/pick:h-[var(--pick-h,300px)] ${luxe ? 'bg-[#0d0d0f]' : 'bg-[#f7f3ea]'}`} data-testid="ai-spotlight-preview">
        <style dangerouslySetInnerHTML={{ __html: ZOOM_CSS }} />
        {shown && <div className={`absolute inset-x-0 top-0 overflow-hidden ${luxe ? 'bottom-0' : 'bottom-[38%]'}`}><img key={shown} src={resolveMediaUrl(shown)} alt="" className={`ohp-ai-fade h-full w-full object-cover ${zoom}`} /></div>}
        <div className={`absolute inset-0 ${luxe ? 'bg-gradient-to-t from-black/85 via-black/25 to-black/5' : 'bg-gradient-to-t from-[#f7f3ea] via-[#f7f3ea]/10 to-transparent'}`} />
        <span className="absolute left-2.5 top-2 text-[8px] font-black uppercase tracking-[0.24em]" style={{ color: luxe ? 'rgba(255,255,255,.8)' : '#172522' }}>Spotlight</span>
        <div className="absolute bottom-2.5 left-2.5 right-2.5">
          <span className="inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em]" style={{ background: p.color, color: p.fillInk }}>For sale</span>
          <p className="mt-1 truncate text-[17px] leading-tight" style={{ fontFamily: 'Georgia, serif', color: luxe ? '#fff' : '#172522', fontStyle: luxe ? 'normal' : 'italic' }}>{pv.address || 'Your listing'}</p>
          <p className="truncate text-[9px] font-semibold" style={{ color: luxe ? 'rgba(255,255,255,.72)' : 'rgba(23,37,34,.65)' }}>{[pv.city, facts].filter(Boolean).join(' · ')}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[14px] font-black" style={{ color: luxe ? '#fff' : '#172522' }}>{price}</span>
            <span className="rounded-full px-2.5 py-1 text-[8px] font-black" style={{ background: p.fill, color: p.fillInk }}>Book a tour</span>
          </div>
        </div>
      </div>
    }>
      <CardStep id="look" n={n('look')} title="Look" summary={luxe ? 'Luxe' : 'Editorial'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {[['cinematic_luxury', 'Luxe'], ['editorial_estate', 'Editorial']].map(([id, name]) => (
            <button key={id} type="button" onClick={() => set({ template_id: id }, 'look')} aria-pressed={picks.template_id === id} className={chip(picks.template_id === id)}>{name}</button>
          ))}
        </div>
      </CardStep>
      <CardStep id="color" n={n('color')} title="Color" steps={steps}
        summary={<span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: color }} />{colorName}</span>}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] justify-items-center gap-1.5">
          {SPOT_COLORS.map(c => {
            const on = c.color.toLowerCase() === color.toLowerCase()
            return (
              <button key={c.color} type="button" title={c.label} aria-label={c.label} aria-pressed={on} onClick={() => set({ brand_color: c.color }, 'color')}
                className={`ohp-ai-press grid h-7 w-7 place-items-center rounded-full ring-1 ring-black/10 ${on ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`} style={{ background: c.color }}>
                {on && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </CardStep>
      {photos.length > 1 && (
        <CardStep id="photo" n={n('photo')} title="Main photo" summary={picks.hero_image === photos[0] ? 'First photo' : `Photo ${photos.indexOf(picks.hero_image || '') + 1}`} steps={steps}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5" data-testid="ai-spotlight-photos">
            {photos.map((src, i) => {
              const on = src === picks.hero_image
              return (
                <button key={src} type="button" onClick={() => set({ hero_image: src }, 'photo')} aria-pressed={on} aria-label={`Photo ${i + 1}`}
                  className={`ohp-ai-press relative aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-black/10 ${on ? 'ring-2 ring-[#C9A24D] ring-offset-1 dark:ring-offset-zinc-900' : 'opacity-80 hover:opacity-100'}`}>
                  <img src={resolveMediaUrl(src)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {on && <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
      <CardStep id="motion" n={n('motion')} title="Header" steps={steps}
        summary={`${picks.header_mode === 'cycle' ? 'Slideshow' : 'Still photo'} · ${MOTIONS.find(m => m[0] === picks.header_motion)?.[1]}`}>
        <div className="flex flex-wrap gap-1.5">
          {([['photo', 'Still photo'], ['cycle', 'Photo slideshow']] as const).map(([id, name]) => (
            <button key={id} type="button" onClick={() => set({ header_mode: id })} aria-pressed={picks.header_mode === id} className={chip(picks.header_mode === id)}>{name}</button>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MOTIONS.map(([id, name]) => <button key={id} type="button" onClick={() => set({ header_motion: id })} aria-pressed={picks.header_motion === id} className={chip(picks.header_motion === id)}>{name}</button>)}
          <StepDone onDone={() => steps.done('motion')} />
        </div>
      </CardStep>
      <CardStep id="story" n={n('story')} title="Story" summary={picks.story_mode === 'short' ? 'Short & polished' : 'Original description'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {([['short', 'Short & polished'], ['original', 'Original description']] as const).map(([id, name]) => (
            <button key={id} type="button" onClick={() => set({ story_mode: id }, 'story')} aria-pressed={picks.story_mode === id} className={chip(picks.story_mode === id)}>{name}</button>
          ))}
        </div>
      </CardStep>
      <CardStep id="sections" n={n('sections')} title="Sections" summary={picks.hidden_sections.length ? `${picks.hidden_sections.length} hidden` : 'All on'} steps={steps}>
        <SectionToggles all={SECTIONS} hidden={picks.hidden_sections} onChange={hidden_sections => set({ hidden_sections })} />
        <p className="mt-1.5 text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">A section with nothing in it hides by itself.</p>
        <div className="mt-2"><StepDone onDone={() => steps.done('sections')} /></div>
      </CardStep>
      <CardStep id="finish" n={n('finish')} title="Last bits" summary={picks.publish ? 'Publish when ready' : 'Keep as a draft'} steps={steps}>
        <input value={picks.virtual_tour_url} onChange={e => set({ virtual_tour_url: e.target.value })} placeholder="3D tour link (optional)" aria-label="3D tour link" inputMode="url" className={inputCls} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => set({ publish: false })} aria-pressed={!picks.publish} className={chip(!picks.publish)}>Keep as a draft</button>
          <button type="button" onClick={() => set({ publish: true })} aria-pressed={picks.publish} className={chip(picks.publish)} data-testid="ai-spotlight-publish">Publish when it&apos;s ready</button>
        </div>
      </CardStep>
      {changed && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">This is your brand color - your hub, forms and website change with it.</p>}
    </PickShell>
  )
}
