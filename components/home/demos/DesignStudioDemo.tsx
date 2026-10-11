'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, Check, Loader2, Palette, Search, X } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import DemoCursor from './DemoCursor'
import StyleThumbnail from '@/components/studio/design/StyleThumbnail'
import { DESIGN_SITUATIONS } from '@/lib/studio/designSituations'
import { DESIGN_FORMAT_META, DESIGN_STYLES } from '@/lib/studio/designFormats'
import { DESIGN_COLOR_MODES } from '@/lib/studio/designColors'
import { getTemplatesFor } from '@/lib/studio/designTemplates'
import { COMPOSITION_LABELS } from '@/lib/studio/designCompositions'
import { AGENT, DEMO_PLACEHOLDER_PHOTOS, REAL_STUDIO_PROPERTY } from './realData'
import type { DesignColorMode, DesignStyleId, LinkedProperty } from '@/types'

// A literal recreation of the real wizard (components/studio/design/DesignCreateFlow.tsx), in the
// real wizard's order - Situation -> Where it's posted -> Property -> Layout -> Style -> Theme ->
// Create - and every design on screen is the REAL renderer (StyleThumbnail -> DesignCanvas) with
// the real templates, so the homepage can never show a design the product doesn't make.
// The steps are grouped into 4 on-screen pages (the look - layout, style, theme - reads as one).
const TOTAL_DISPLAY_STEPS = 4
const DISPLAY_TITLES: Record<number, string> = {
  1: 'What are you marketing?', 2: 'Where will it be posted?', 3: 'Which property is this for?', 4: 'Choose the look',
}

const SITUATION_ID = 'just_sold'
const DESIGN_TYPE = 'instagram_post'
// Kept simple on the homepage: 4 situations and 4 places to post (the real wizard offers more).
const SITUATIONS = ['just_listed', 'coming_soon', 'just_sold', 'under_contract'].map(id => DESIGN_SITUATIONS.find(s => s.id === id)!)
const situationIdx = SITUATIONS.findIndex(s => s.id === SITUATION_ID)
const situation = SITUATIONS[situationIdx]
const placements = [
  { designType: 'instagram_post', label: 'Instagram' },
  { designType: 'instagram_portrait', label: 'Feed Post' },
  { designType: 'postcard', label: 'Mailer' },
  { designType: 'just_listed_flyer', label: 'Flyer' },
]
const placementIdx = placements.findIndex(f => f.designType === DESIGN_TYPE)
const templates = getTemplatesFor(SITUATION_ID, DESIGN_TYPE)
// The layout it settles on: the first Just Sold post (full-bleed photo), after a look at the Headline Band.
const LAYOUT_ORDER = [Math.max(0, templates.findIndex(t => t.composition === 'band')), 0]
const STYLE_ORDER = [DESIGN_STYLES.findIndex(s => s.id === 'bold'), DESIGN_STYLES.findIndex(s => s.id === 'modern_luxury')]
// The homepage shows 5 themes in one row (Luxe left out - a 6th tile wrapped onto a second line).
const COLOR_MODES = DESIGN_COLOR_MODES.filter(c => c.id !== 'luxe')
const COLOR_ORDER = [COLOR_MODES.findIndex(c => c.id === 'dark'), COLOR_MODES.findIndex(c => c.id === 'light')]
const finalTemplate = templates[LAYOUT_ORDER[LAYOUT_ORDER.length - 1]]
const finalStyle = DESIGN_STYLES[STYLE_ORDER[STYLE_ORDER.length - 1]].id as DesignStyleId
const finalColor = COLOR_MODES[COLOR_ORDER[COLOR_ORDER.length - 1]].id as DesignColorMode

const property: LinkedProperty = REAL_STUDIO_PROPERTY
const agent = {
  agentName: AGENT.name, agentTitle: 'REALTOR®', agentBrokerage: 'Compass RE', agentPhotoUrl: AGENT.photo,
  agentPhotoPosition: null, agentPhone: AGENT.phone, agentEmail: AGENT.email, agentHubSlug: null,
}
const MY_LISTINGS = [
  { address: property.address, price: property.price, photo: property.photos![0] },
  { address: '27 Laurel Lane', price: 1_245_000, photo: DEMO_PLACEHOLDER_PHOTOS[2] },
  { address: '905 Aldwyn Road', price: 689_000, photo: DEMO_PLACEHOLDER_PHOTOS[3] },
]

type Beat =
  | { phase: 'situation'; index: number }
  | { phase: 'format'; index: number }
  | { phase: 'property-mine' }
  | { phase: 'property' }
  | { phase: 'layout'; index: number }
  | { phase: 'style'; index: number }
  | { phase: 'color'; index: number }
  | { phase: 'creating' }
  | { phase: 'created' }

const BEATS: Beat[] = [
  { phase: 'situation', index: 0 }, { phase: 'situation', index: situationIdx },
  { phase: 'format', index: placementIdx },
  { phase: 'property-mine' }, { phase: 'property' },
  ...LAYOUT_ORDER.map(index => ({ phase: 'layout' as const, index })),
  ...STYLE_ORDER.map(index => ({ phase: 'style' as const, index })),
  ...COLOR_ORDER.map(index => ({ phase: 'color' as const, index })),
  { phase: 'creating' }, { phase: 'created' },
]
const DISPLAY_STEP: Record<Beat['phase'], number> = {
  situation: 1, format: 2, 'property-mine': 3, property: 3, layout: 4, style: 4, color: 4, creating: 4, created: 4,
}
// How long each on-screen page runs in total (the progress bar fills continuously across it).
const PAGE_DURATIONS: Record<number, number> = { 1: 5900, 2: 2700, 3: 5100, 4: 18300 }

// A live thumbnail of the real design, with the demo's property and agent.
function Live({ styleId, colorMode, templateId }: { styleId: DesignStyleId; colorMode: DesignColorMode; templateId: string }) {
  return <StyleThumbnail designType={DESIGN_TYPE} styleId={styleId} colorMode={colorMode} templateId={templateId} situation={SITUATION_ID} property={property} agent={agent} rounded={false} />
}

export default function DesignStudioDemo() {
  const [showTitle, setShowTitle] = useState(true)
  const [i, setI] = useState(0)
  const beat = BEATS[i]
  const displayStep = DISPLAY_STEP[beat.phase]
  const isLastOfPhase = useMemo(() => { const next = BEATS[i + 1]; return !next || next.phase !== beat.phase }, [i, beat.phase])

  useEffect(() => {
    if (!showTitle) return
    const t = setTimeout(() => setShowTitle(false), 5000)
    return () => clearTimeout(t)
  }, [showTitle])

  // The click lands near the END of each beat, after the viewer has seen the screen.
  const [clicking, setClicking] = useState(false)
  const modal = useRef<HTMLDivElement>(null)
  const duration = beat.phase === 'created' ? 4200 : beat.phase === 'creating' ? 1400 : beat.phase === 'situation' ? (isLastOfPhase ? 3500 : 2400)
    : beat.phase === 'property-mine' ? 2700 : beat.phase === 'property' ? 2400 : beat.phase === 'format' ? 2700 : isLastOfPhase ? 2300 : 1750
  useEffect(() => {
    setClicking(false)
    if (showTitle) return
    const t1 = setTimeout(() => setClicking(true), Math.max(300, duration - 650))
    const t2 = setTimeout(() => {
      if (i + 1 >= BEATS.length) { setI(0); setShowTitle(true) } else setI(i + 1)
    }, duration)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [i, showTitle, duration])

  if (showTitle) {
    return <TitleSlide icon={Palette} kicker="Design" title="Studio" body="Flyers, posts & cards from your listing - designed in minutes." nowrapBody durationMs={5000} totalPages={1 + TOTAL_DISPLAY_STEPS} pageIndex={0} url="app.openhousepal.com/studio/design" />
  }

  const lookStep = beat.phase === 'layout' || beat.phase === 'style' || beat.phase === 'color'
  const layoutId = beat.phase === 'layout' ? templates[beat.index].id : finalTemplate.id
  const styleId = beat.phase === 'style' ? DESIGN_STYLES[beat.index].id as DesignStyleId : beat.phase === 'layout' ? 'modern_luxury' : finalStyle
  const colorMode = beat.phase === 'color' ? COLOR_MODES[beat.index].id as DesignColorMode : 'light'
  const tile = (active: boolean) => `relative overflow-hidden rounded-lg border-2 transition-all duration-150 ${active ? `border-[#C9A24D] ${clicking ? 'scale-95' : ''}` : 'border-gray-200 dark:border-gray-700'}`
  const continueClick = clicking && (beat.phase === 'property')
  // The pointer really travels to what gets clicked: the choice on each screen, or Continue.
  const cursorTarget = beat.phase === 'creating' || beat.phase === 'created' ? null
    : beat.phase === 'property' ? '[data-cursor="continue"]'
    : beat.phase === 'property-mine' ? '[data-cursor="tile-0"]'
    : `[data-cursor="tile-${beat.index}"]`

  return (
    <BrowserFrame url="app.openhousepal.com/studio/design" progress={{ pages: 1 + TOTAL_DISPLAY_STEPS, current: displayStep, durationMs: PAGE_DURATIONS[displayStep] }}>
      <div className="flex h-[420px] items-center justify-center bg-black/45 p-3">
        <div ref={modal} className="relative flex max-h-full w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">New Design &middot; Step {displayStep} of {TOTAL_DISPLAY_STEPS}</p>
              <h4 className="mt-0.5 font-serif text-[17px] font-black leading-tight text-[#111827] dark:text-white">
                {lookStep ? (beat.phase === 'layout' ? 'Choose a layout' : beat.phase === 'style' ? 'Choose a style' : 'Choose a color theme') : DISPLAY_TITLES[displayStep]}
              </h4>
            </div>
            <X className="h-4 w-4 flex-shrink-0 text-gray-300" />
          </div>
          <div className="flex gap-1 px-4 pt-3">
            {[1, 2, 3, 4].map(s => <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${s <= displayStep ? 'bg-[#C9A24D]' : 'bg-gray-100 dark:bg-gray-800'}`} />)}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-4">
            {beat.phase === 'situation' && (
              <div key="situation" className="grid grid-cols-2 gap-2 animate-fadeIn">
                {SITUATIONS.map((s, idx) => (
                  <div key={s.id} data-cursor={`tile-${idx}`} className={`relative rounded-xl border-2 px-2 py-4 text-center transition-all duration-150 ${idx === beat.index ? `border-[#C9A24D] bg-[#C9A24D]/10 ${clicking ? 'scale-95' : ''}` : 'border-gray-200 dark:border-gray-700'}`}>
                    <p className="text-[12.5px] font-black leading-tight text-[#111827] dark:text-white">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {beat.phase === 'format' && (
              <div key="format" className="grid grid-cols-2 gap-2 animate-fadeIn">
                {placements.map((f, idx) => (
                  <div key={f.designType} data-cursor={`tile-${idx}`} className={`relative rounded-xl border-2 px-2 py-3.5 text-center transition-all duration-150 ${idx === beat.index ? `border-[#C9A24D] bg-[#C9A24D]/10 ${clicking ? 'scale-95' : ''}` : 'border-gray-200 dark:border-gray-700'}`}>
                    <p className="text-[12.5px] font-black leading-tight text-[#111827] dark:text-white">{f.label}</p>
                    <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-gray-400">{DESIGN_FORMAT_META[f.designType]?.size}</p>
                  </div>
                ))}
              </div>
            )}

            {beat.phase === 'property-mine' && (
              <div key="mine" className="animate-fadeIn">
                <p className="mb-2 text-[9.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Address, price, facts and photos fill in automatically.</p>
                <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 dark:border-gray-700">
                  <Search className="h-3 w-3 text-gray-400" /><span className="text-[9px] font-semibold text-gray-400">My listings</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MY_LISTINGS.map((l, idx) => (
                    <div key={l.address} data-cursor={`tile-${idx}`} className={`relative overflow-hidden rounded-lg border bg-white shadow-sm transition-all duration-150 animate-fadeIn dark:bg-[#151517] ${idx === 0 && clicking ? 'scale-95 border-[#C9A24D]' : 'border-gray-200 dark:border-gray-700'}`} style={{ animationDelay: `${idx * 90}ms` }}>
                      <div className="relative aspect-[4/3] bg-gray-100"><Image src={l.photo} alt={l.address} fill className="object-cover" unoptimized /></div>
                      <div className="p-1.5">
                        <p className="truncate text-[8px] font-black text-[#111827] dark:text-white">{l.address}</p>
                        <p className="text-[7.5px] font-bold text-gray-500 dark:text-gray-400">${Number(l.price).toLocaleString()}</p>
                      </div>
                      
                    </div>
                  ))}
                </div>
              </div>
            )}

            {beat.phase === 'property' && (
              <div key="property" className="flex gap-3 animate-fadeIn">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 rounded-lg border-2 border-[#C9A24D] bg-[#C9A24D]/5 p-1.5">
                    <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md"><Image src={property.photos![0]} alt="" fill className="object-cover" unoptimized /></div>
                    <div className="min-w-0">
                      <p className="truncate text-[9.5px] font-black text-[#111827] dark:text-white">{property.address}</p>
                      <p className="text-[8px] text-gray-400">{property.beds} bd &middot; {property.baths} ba &middot; {property.sqft?.toLocaleString()} sqft</p>
                    </div>
                  </div>
                  <p className="mb-1 mt-2 text-[8px] font-black uppercase tracking-widest text-gray-400">Lead photo</p>
                  <div className="grid grid-cols-3 gap-1">
                    {property.photos!.slice(0, 3).map((p, idx) => (
                      <div key={p} className={`relative aspect-[4/3] overflow-hidden rounded-md ${idx === 0 ? 'ring-2 ring-[#C9A24D] ring-offset-1' : 'opacity-70'}`}><Image src={p} alt="" fill className="object-cover" unoptimized /></div>
                    ))}
                  </div>
                </div>
                <div className="w-[120px] flex-shrink-0">
                  <p className="mb-1 text-[7.5px] font-black uppercase tracking-widest text-gray-400">Live preview</p>
                  <div className="overflow-hidden rounded-md shadow-lg"><Live styleId="modern_luxury" colorMode="light" templateId={templates[0].id} /></div>
                </div>
              </div>
            )}

            {lookStep && (
              <div key={beat.phase} className="animate-fadeIn">
                {beat.phase === 'layout' && (
                  <div className="grid grid-cols-3 gap-1.5">
                    {templates.map((tpl, idx) => (
                      <div key={tpl.id} data-cursor={`tile-${idx}`} className={tile(idx === beat.index)}>
                        <Live styleId="modern_luxury" colorMode="light" templateId={tpl.id} />
                        <p className="truncate px-1 py-1 text-[8px] font-black text-[#111827] dark:text-white">{COMPOSITION_LABELS[tpl.composition].label}</p>
                        
                      </div>
                    ))}
                  </div>
                )}
                {beat.phase === 'style' && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {DESIGN_STYLES.map((s, idx) => (
                      <div key={s.id} data-cursor={`tile-${idx}`} className={tile(idx === beat.index)}>
                        <Live styleId={s.id as DesignStyleId} colorMode="light" templateId={finalTemplate.id} />
                        <p className="truncate px-1 py-1 text-[7.5px] font-black text-[#111827] dark:text-white">{s.label}</p>
                        
                      </div>
                    ))}
                  </div>
                )}
                {beat.phase === 'color' && (
                  <div className="grid grid-cols-5 gap-1">
                    {COLOR_MODES.map((c, idx) => (
                      <div key={c.id} data-cursor={`tile-${idx}`} className={tile(idx === beat.index)}>
                        <Live styleId={finalStyle} colorMode={c.id as DesignColorMode} templateId={finalTemplate.id} />
                        <p className="truncate px-0.5 py-1 text-center text-[7px] font-black text-[#111827] dark:text-white">{c.label}</p>
                        
                      </div>
                    ))}
                  </div>
                )}
                {/* The big live preview underneath follows every choice. */}
                <div className="mx-auto mt-2.5 w-[33%] overflow-hidden rounded-md shadow-xl">
                  <Live styleId={styleId} colorMode={colorMode} templateId={layoutId} />
                </div>
              </div>
            )}

            {(beat.phase === 'creating' || beat.phase === 'created') && (
              <div key="final" className="flex items-center gap-3 animate-fadeIn">
                <div className="relative w-[58%] flex-shrink-0 overflow-hidden rounded-lg shadow-xl">
                  <Live styleId={finalStyle} colorMode={finalColor} templateId={finalTemplate.id} />
                  {beat.phase === 'created' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/20 animate-fadeIn">
                      <div className="rounded-full bg-emerald-600 p-2 text-white shadow-lg"><Check className="h-4 w-4" /></div>
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-1.5">
                  <p className="text-[10px] font-black text-[#111827] dark:text-white">{situation.label} &middot; Instagram Post</p>
                  <p className="text-[8.5px] font-semibold text-gray-500 dark:text-gray-400">{COMPOSITION_LABELS[finalTemplate.composition].label} &middot; {DESIGN_STYLES[STYLE_ORDER[STYLE_ORDER.length - 1]].label} &middot; {COLOR_MODES[COLOR_ORDER[COLOR_ORDER.length - 1]].label}</p>
                  <p className="text-[8.5px] font-semibold leading-snug text-gray-400">Every word, photo and color stays editable.</p>
                </div>
              </div>
            )}
          </div>

          <DemoCursor container={modal} target={cursorTarget} click={clicking && !!cursorTarget} moveKey={i} />
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-gray-300 dark:text-gray-600"><ArrowLeft className="h-3 w-3" /> Back</span>
            {beat.phase === 'creating' || beat.phase === 'created' ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white dark:bg-white dark:text-[#111827]">
                {beat.phase === 'creating' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {beat.phase === 'created' ? 'Created!' : 'Creating...'}
              </span>
            ) : (
              <span data-cursor="continue" className={`relative inline-flex items-center gap-1 rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white transition-transform duration-200 dark:bg-white dark:text-[#111827] ${continueClick ? 'scale-95' : ''}`}>
                Continue <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}
