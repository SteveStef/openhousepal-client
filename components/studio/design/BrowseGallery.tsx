'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { BrandKit, DesignColorMode, DesignStyleId } from '@/types'
import { DESIGN_SITUATIONS, DesignSituationId } from '@/lib/studio/designSituations'
import { getDesignFormat } from '@/lib/studio/designFormats'
import { getTemplatesFor } from '@/lib/studio/designTemplates'
import { COMPOSITION_LABELS } from '@/lib/studio/designCompositions'
import type { DesignAgentInfo } from '@/lib/studio/designAgent'
import StyleThumbnail from './StyleThumbnail'

export interface BrowsePick {
  situationId: DesignSituationId
  designType: string
  templateId: string
  styleId: DesignStyleId
  colorMode: DesignColorMode
}

interface BrowseItem extends BrowsePick { key: string; situationLabel: string; formatLabel: string; layoutLabel: string }

// Each card gets a different style + theme so the gallery doubles as a tour of the whole range.
const LOOKS: { styleId: DesignStyleId; colorMode: DesignColorMode }[] = [
  { styleId: 'modern_luxury', colorMode: 'light' },
  { styleId: 'editorial', colorMode: 'forest' },
  { styleId: 'bold', colorMode: 'dark' },
  { styleId: 'minimal', colorMode: 'stone' },
  { styleId: 'modern_luxury', colorMode: 'dark' },
  { styleId: 'editorial', colorMode: 'light' },
  { styleId: 'bold', colorMode: 'light' },
  { styleId: 'minimal', colorMode: 'forest' },
  { styleId: 'modern_luxury', colorMode: 'stone' },
]

// Placement filters - grouped the way agents think about where a design goes.
const PLACEMENTS: { id: string; label: string; types: string[] }[] = [
  { id: 'all', label: 'Everywhere', types: [] },
  { id: 'instagram', label: 'Feed posts (Instagram, Facebook, LinkedIn)', types: ['instagram_post', 'instagram_portrait'] },
  { id: 'story', label: 'Story', types: ['instagram_story'] },
  { id: 'flyer', label: 'Flyers', types: ['just_listed_flyer', 'open_house_flyer'] },
  { id: 'mail', label: 'Postcards & mailers', types: ['postcard', 'postcard_jumbo', 'letter_mailer'] },
  { id: 'hanger', label: 'Door hangers', types: ['door_hanger'] },
]

function buildItems(situation: string, placement: string): BrowseItem[] {
  const allowed = PLACEMENTS.find(p => p.id === placement)?.types || []
  const situations = DESIGN_SITUATIONS.filter(s => situation === 'all' || s.id === situation)
  const items: BrowseItem[] = []
  for (const s of situations) {
    let formats = s.formats.filter(f => !allowed.length || allowed.includes(f))
    // "Everything, everywhere" would be ~150 cards - a featured mix per situation instead: its
    // Instagram post in all 3 layouts plus one story and one print piece.
    if (situation === 'all' && placement === 'all') {
      const social = formats.find(f => f === 'instagram_post') || formats[0]
      const extra = [formats.find(f => f === 'instagram_story'), formats.find(f => getDesignFormat(f)?.isPrint)].filter(Boolean) as string[]
      formats = [social, ...extra]
    }
    for (const f of formats) {
      const format = getDesignFormat(f)
      const templates = getTemplatesFor(s.id, f)
      const pick = situation === 'all' && placement === 'all' && f !== formats[0] ? templates.slice(0, 1) : templates
      for (const tpl of pick) {
        items.push({
          key: `${s.id}-${f}-${tpl.id}`, situationId: s.id, designType: f, templateId: tpl.id,
          styleId: 'modern_luxury', colorMode: 'light',
          situationLabel: s.label, formatLabel: format?.label || f, layoutLabel: COMPOSITION_LABELS[tpl.composition]?.label || tpl.label,
        })
      }
    }
  }
  // Luxe cards always show in the Luxe theme - the full signature look.
  return items.map((item, i) => (item.layoutLabel === 'Luxe' ? { ...item, styleId: 'modern_luxury' as DesignStyleId, colorMode: 'luxe' as DesignColorMode } : { ...item, ...LOOKS[i % LOOKS.length] }))
}

// Renders its thumbnail only once it scrolls near the viewport - dozens of live designs would
// otherwise all decode their photos on page load.
function LazyThumb({ item, brandKit, agent }: { item: BrowseItem; brandKit: BrandKit | null; agent: DesignAgentInfo }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const ar = getDesignFormat(item.designType)?.aspectRatio || 1
  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])
  // Every tile is the same square stage; the design sits inside it at its true proportions.
  return (
    <div ref={ref} className="flex aspect-square w-full items-center justify-center bg-[#f4f2ee] p-3 dark:bg-white/[0.03]">
      <div style={{ aspectRatio: String(ar), width: ar >= 1 ? '100%' : `${ar * 100}%` }} className="relative overflow-hidden shadow-[0_6px_18px_rgba(0,0,0,0.16)] transition duration-300 group-hover:scale-[1.03]">
        {visible
          ? <div className="absolute inset-0 animate-fadeIn"><StyleThumbnail designType={item.designType} styleId={item.styleId} colorMode={item.colorMode} templateId={item.templateId} situation={item.situationId} brandKit={brandKit} agent={agent} rounded={false} /></div>
          : <div className="ohp-skeleton absolute inset-0" />}
      </div>
    </div>
  )
}

const PAGE = 15

export default function BrowseGallery({ brandKit, agent, onPick }: { brandKit: BrandKit | null; agent: DesignAgentInfo; onPick: (pick: BrowsePick) => void }) {
  const [situation, setSituation] = useState<string>('all')
  const [placement, setPlacement] = useState<string>('all')
  const [shown, setShown] = useState(PAGE)
  const items = useMemo(() => buildItems(situation, placement), [situation, placement])
  useEffect(() => { setShown(PAGE) }, [situation, placement])
  // Placement chips only for placements the chosen situation actually offers.
  const placements = useMemo(() => {
    if (situation === 'all') return PLACEMENTS
    const formats = DESIGN_SITUATIONS.find(s => s.id === situation)?.formats || []
    return PLACEMENTS.filter(p => p.id === 'all' || p.types.some(t => formats.includes(t)))
  }, [situation])

  const chip = (active: boolean) => `shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10.5px] font-black transition hover:-translate-y-0.5 active:scale-95 ${active
    ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]'
    : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D]/60 hover:text-[#111827] dark:border-gray-800 dark:bg-[#151517] dark:text-gray-400 dark:hover:text-white'}`

  return (
    <div>
      {/* Every situation on one line - it slides sideways on narrow screens instead of wrapping. */}
      <div className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] lg:justify-between">
        <button className={chip(situation === 'all')} onClick={() => { setSituation('all'); setPlacement('all') }}>All situations</button>
        {DESIGN_SITUATIONS.map(s => (
          <button key={s.id} className={chip(situation === s.id)} onClick={() => { setSituation(s.id); setPlacement('all') }}>{s.label}</button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-gray-200/70 pt-3 dark:border-white/10">
        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Where</span>
        {placements.map(p => (
          <button key={p.id} onClick={() => setPlacement(p.id)}
            className={`shrink-0 rounded-lg px-3 py-1 text-[11px] font-bold transition ${placement === p.id ? 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <div key={`${situation}-${placement}`} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.slice(0, shown).map((item, i) => (
          <button
            key={item.key}
            onClick={() => onPick(item)}
            style={{ ['--i' as any]: i % PAGE }}
            className="ohp-rise group relative block w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:shadow-lg hover:ring-4 hover:ring-[#C9A24D]/15 dark:border-gray-800 dark:bg-[#151517]"
          >
            <LazyThumb item={item} brandKit={brandKit} agent={agent} />
            {item.layoutLabel === 'Luxe' && <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center rounded-full bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-md">Luxe · IDX</span>}
            <span className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-2 opacity-0 transition group-hover:opacity-100">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#111827]/90 px-2.5 py-1 text-[10px] font-black text-white shadow">Use this <ArrowRight className="h-3 w-3" /></span>
            </span>
            <span className="block border-t border-gray-100 px-2.5 py-1.5 dark:border-gray-800">
              <span className="block truncate text-[11px] font-black text-[#111827] dark:text-white">{item.situationLabel}</span>
              <span className="block truncate text-[10px] font-semibold text-gray-400">{item.formatLabel} · {item.layoutLabel}</span>
            </span>
          </button>
        ))}
      </div>
      {items.length > shown && (
        <div className="mt-2 flex justify-center">
          <button onClick={() => setShown(n => n + PAGE)} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-black text-[#111827] shadow-sm transition hover:border-[#C9A24D]/60 dark:border-gray-800 dark:bg-[#151517] dark:text-white">
            Show more designs ({items.length - shown})
          </button>
        </div>
      )}
    </div>
  )
}
