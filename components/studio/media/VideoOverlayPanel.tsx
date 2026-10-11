'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Clapperboard, Crown, Flag, Layers, Maximize, Palette, Pause, Play, RotateCcw, Scissors, Sparkles, Type, UserRound, Wand2 } from 'lucide-react'
import type { BrandingOptions, BrandingPosition, LayerTiming, LinkedProperty, TitleCardOptions, TitleCardPosition, TitleCardPreset } from '@/types'
import {
  clipCuts, drawMotion, loadMotionFonts, loadMotionImage, MIN_LAYER_SECONDS, MotionAgent, MotionScene, MotionStyle,
  resolveTiming, SIGNATURE_COLORS, situationOf, SITUATIONS,
} from '@/lib/studio/videoMotion'
import { LUXE_METAL_ORDER, LUXE_METALS, metalOf } from '@/lib/luxeMetals'

// AI Media's video designs: pick a look (Default or Luxe) and a situation, then which layers ride
// on the video. Everything is drawn by lib/studio/videoMotion.ts - the same renderer paints the
// live preview over the player and the frames of the exported video.

export const DEFAULT_TITLE_CARD: TitleCardOptions = {
  enabled: false,
  preset: 'just_listed',
  title: 'Just Listed',
  show_address: true,
  show_location: true,
  show_price: true,
  show_beds: true,
  show_baths: true,
  show_sqft: true,
  manual: {},
  position: 'bottom',
  style: 'default',
  corner_tag: false,
  end_card: false,
}

export const DEFAULT_BRANDING: BrandingOptions = { enabled: false, position: 'top-left' }

const BRANDING_POSITIONS: { id: BrandingPosition; label: string }[] = [
  { id: 'top-left', label: 'Top left' },
  { id: 'bottom-left', label: 'Bottom left' },
  { id: 'top-middle', label: 'Top middle' },
]
const POSITIONS: { id: TitleCardPosition; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'middle', label: 'Middle' },
  { id: 'bottom', label: 'Bottom' },
]

/** True when any layer would draw - the export then renders the design in. */
export const motionOn = (tc?: TitleCardOptions | null, br?: BrandingOptions | null) =>
  !!(tc?.enabled || tc?.corner_tag || tc?.end_card || br?.enabled)

// ---------------------------------------------------------------- shared bits

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={(e) => { e.stopPropagation(); onChange(!on) }}
      className={`relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ${on ? 'justify-end bg-[#C9A24D]' : 'justify-start bg-gray-300 dark:bg-gray-700'}`}>
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className="block h-5 w-5 rounded-full bg-white shadow-md" />
    </button>
  )
}

function Seg<T extends string>({ value, options, onChange, id }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={`relative flex-1 rounded-lg py-1.5 text-[11px] font-black transition-colors ${value === o.id ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
          {value === o.id && <motion.span layoutId={id} className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-gray-400'

// A small looping canvas of one situation's opening, used on the situation cards.
function MiniPreview({ style, preset, photo, listing, agent, active, accent, metal }: {
  style: MotionStyle; preset: TitleCardPreset; photo: HTMLImageElement | null; listing: LinkedProperty | null; agent: MotionAgent; active: boolean
  accent?: string | null; metal?: 'gold' | 'silver' | 'bronze'
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState(false)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const W = 320, H = 180
    c.width = W; c.height = H
    const sit = situationOf(preset)
    const scene: MotionScene = {
      title: { ...DEFAULT_TITLE_CARD, enabled: true, preset, title: sit.title, style, accent, metal, position: style === 'luxe' ? 'middle' : 'bottom', show_beds: false, show_baths: false, show_sqft: false, show_price: !!sit.showPrice, event_line: sit.event === 'when' ? 'Sat · 1–3 PM' : sit.event === 'was' ? listing?.price ? Math.round(listing.price * 1.05).toLocaleString() : '899,000' : '' },
      branding: { enabled: false },
      listing,
      agent,
    }
    let raf = 0
    const start = performance.now()
    const paint = (t: number) => {
      ctx.clearRect(0, 0, W, H)
      if (photo) {
        const s = Math.max(W / photo.width, H / photo.height) * (1.06 - 0.06 * Math.min(1, t / 5))
        ctx.drawImage(photo, (W - photo.width * s) / 2, (H - photo.height * s) / 2, photo.width * s, photo.height * s)
      } else {
        const g = ctx.createLinearGradient(0, 0, W, H)
        g.addColorStop(0, '#2b2f3a'); g.addColorStop(1, '#4a3a1f')
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      }
      drawMotion(ctx, W, H, t, 12, scene)
    }
    const loop = () => {
      const t = ((performance.now() - start) / 1000) % 6.1
      paint(t)
      raf = requestAnimationFrame(loop)
    }
    if (hover || active) loop()
    else paint(2.6)
    return () => cancelAnimationFrame(raf)
  }, [style, preset, photo, listing, agent, hover, active, accent, metal])
  return <canvas ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className="block aspect-video w-full rounded-lg bg-black" />
}

// ---------------------------------------------------------------- editor

/** The design editor beside the video: look, situation, and the layers on top. `hasListing`
 *  decides whether a shown field uses the real listing or a typed value (uploads have no listing). */
export function VideoOverlayEditor({
  titleCard, onTitleCardChange, branding, onBrandingChange, hasListing, listing, posterUrl, agent,
}: {
  titleCard: TitleCardOptions
  onTitleCardChange: (next: TitleCardOptions) => void
  branding: BrandingOptions
  onBrandingChange: (next: BrandingOptions) => void
  hasListing: boolean
  listing?: LinkedProperty | null
  posterUrl?: string | null
  agent?: MotionAgent
}) {
  const patch = (p: Partial<TitleCardOptions>) => onTitleCardChange({ ...titleCard, ...p })
  const style: MotionStyle = titleCard.style === 'luxe' ? 'luxe' : 'default'
  const sit = situationOf(titleCard.preset)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [fontsOk, setFontsOk] = useState(false)
  useEffect(() => { loadMotionFonts().then(() => setFontsOk(true)) }, [])
  useEffect(() => { let alive = true; loadMotionImage(posterUrl).then(img => { if (alive) setPhoto(img) }); return () => { alive = false } }, [posterUrl])
  const miniAgent: MotionAgent = agent || { name: 'Your Name', brokerage: '' }
  const [tab, setTab] = useState<'look' | 'layers'>('look')
  const layersOn = [titleCard.enabled, titleCard.corner_tag, titleCard.end_card, branding.enabled].filter(Boolean).length
  const accentNow = titleCard.accent || sit.accent
  const metal = metalOf(titleCard.metal)

  const pickSituation = (id: TitleCardPreset) => {
    const s = situationOf(id)
    const keepTitle = titleCard.preset === 'custom' && id === 'custom'
    patch({
      preset: id,
      title: keepTitle ? titleCard.title : s.title,
      kicker: undefined,
      event_line: s.event && s.event === situationOf(titleCard.preset).event ? titleCard.event_line : '',
      show_price: s.showPrice ? true : titleCard.show_price,
      enabled: true,
    })
  }

  const fields: { key: 'show_address' | 'show_location' | 'show_beds' | 'show_baths' | 'show_sqft' | 'show_price'; manualKey: keyof TitleCardOptions['manual']; label: string; placeholder: string }[] = [
    { key: 'show_address', manualKey: 'address', label: 'Address', placeholder: '2800 Pacific Coast Hwy' },
    { key: 'show_location', manualKey: 'location', label: 'Town', placeholder: 'Malibu, CA' },
    { key: 'show_price', manualKey: 'price', label: 'Price', placeholder: '6,495,000' },
    { key: 'show_beds', manualKey: 'beds', label: 'Beds', placeholder: '4' },
    { key: 'show_baths', manualKey: 'baths', label: 'Baths', placeholder: '3' },
    { key: 'show_sqft', manualKey: 'sqft', label: 'Sq ft', placeholder: '5,437' },
  ]

  // One layer's settings open at a time, so the whole list fits on screen.
  const [openLayer, setOpenLayer] = useState<string | null>(null)
  const layer = (opts: { id: string; icon: React.ReactNode; title: string; sub: string; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) => {
    const expanded = opts.on && openLayer === opts.id
    const toggle = (v: boolean) => { opts.onToggle(v); setOpenLayer(v && opts.children ? opts.id : null) }
    const tap = () => { if (!opts.on) toggle(true); else setOpenLayer(expanded ? null : opts.id) }
    return (
    <motion.div layout className={`overflow-hidden rounded-2xl border transition-colors ${opts.on ? 'border-[#C9A24D]/50 bg-[#C9A24D]/[0.05]' : 'border-gray-200 dark:border-gray-800'}`}>
      <div role="button" tabIndex={0} onClick={tap} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap() } }} className="flex w-full cursor-pointer items-center gap-3 p-3 text-left">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${opts.on ? 'bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06]'}`}>{opts.icon}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-black text-[#111827] dark:text-white">{opts.title}</span>
          <span className="block truncate text-[11px] font-semibold text-gray-400">{opts.sub}</span>
        </span>
        {opts.on && opts.children && (
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} className="shrink-0 text-gray-400"><ChevronDown className="h-4 w-4" /></motion.span>
        )}
        <Switch on={opts.on} onChange={toggle} />
      </div>
      <AnimatePresence initial={false}>
        {expanded && opts.children && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-[#C9A24D]/20 p-3">{opts.children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    )
  }

  const metalSwatch = (m: typeof metal) => `linear-gradient(135deg, ${LUXE_METALS[m].deep}, ${LUXE_METALS[m].light} 55%, ${LUXE_METALS[m].base})`

  const lookTab = (
    <div className="space-y-4">
      {/* the look */}
      <div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: 'default', label: 'Signature', sub: 'Bold, modern, colorful', swatch: `linear-gradient(135deg, ${accentNow}, #111827)` },
            { id: 'luxe', label: 'Luxe', sub: `Black, ivory & ${LUXE_METALS[metal].label.toLowerCase()}`, swatch: `linear-gradient(135deg,#0b0b0c 40%,${LUXE_METALS[metal].base} 120%)` },
          ] as const).map(o => {
            const on = style === o.id
            return (
              <motion.button key={o.id} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => patch({ style: o.id, position: o.id === 'luxe' && titleCard.position === 'bottom' ? 'middle' : o.id === 'default' && titleCard.position === 'middle' ? 'bottom' : titleCard.position })}
                className={`relative overflow-hidden rounded-2xl border-2 p-2.5 text-left transition-colors ${on ? 'border-[#C9A24D] shadow-[0_14px_30px_-18px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
                <span className="mb-2 block h-8 rounded-xl" style={{ background: o.swatch }}>
                  {o.id === 'luxe' && <span className="flex h-full items-center justify-center font-serif text-sm tracking-[0.3em]" style={{ color: LUXE_METALS[metal].light }}>LUXE</span>}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">{o.id === 'luxe' ? <Crown className="h-3.5 w-3.5 text-[#C9A24D]" /> : <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" />}{o.label}</span>
                <span className="block text-[10px] font-semibold text-gray-400">{o.sub}</span>
                <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* color - any Signature color, or Luxe's three metals */}
      <div>
        <p className={`${labelCls} flex items-center gap-1.5`}><Palette className="h-3 w-3" /> {style === 'luxe' ? 'Finish' : 'Color'}</p>
        <AnimatePresence mode="wait" initial={false}>
          {style === 'luxe' ? (
            <motion.div key="metals" className="grid grid-cols-3 gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              {LUXE_METAL_ORDER.map(m => {
                const on = metal === m
                return (
                  <motion.button key={m} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => patch({ metal: m })}
                    className={`relative flex items-center gap-2 rounded-xl border-2 p-1.5 pr-2.5 text-left transition-colors ${on ? 'border-[#111827] dark:border-white' : 'border-gray-200 hover:border-gray-400 dark:border-gray-800'}`}>
                    <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg shadow-inner" style={{ background: metalSwatch(m) }}>
                      <span className="absolute inset-y-0 -left-full w-1/2 skew-x-12 bg-white/50 transition-transform duration-700 group-hover:translate-x-[300%]" />
                    </span>
                    <span className="text-xs font-black text-[#111827] dark:text-white">{LUXE_METALS[m].label}</span>
                    <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="ml-auto grid h-4 w-4 place-items-center rounded-full bg-[#111827] text-white dark:bg-white dark:text-[#111827]"><Check className="h-2.5 w-2.5" strokeWidth={4} /></motion.span>}</AnimatePresence>
                  </motion.button>
                )
              })}
            </motion.div>
          ) : (
            <motion.div key="colors" className="flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }} onClick={() => patch({ accent: null })} title={`Automatic - ${sit.label}'s own color`}
                className={`relative inline-flex h-8 items-center gap-1.5 rounded-full border-2 pl-1 pr-2.5 text-[10px] font-black uppercase tracking-wider transition-colors ${!titleCard.accent ? 'border-[#111827] text-[#111827] dark:border-white dark:text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400 dark:border-gray-700'}`}>
                <span className="h-5 w-5 rounded-full" style={{ background: sit.accent }} /> Auto
              </motion.button>
              <div className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${SIGNATURE_COLORS.length + 1}, minmax(0, 1fr))` }}>
              {SIGNATURE_COLORS.map(c => {
                const on = titleCard.accent?.toLowerCase() === c.color.toLowerCase()
                return (
                  <motion.button key={c.color} type="button" whileHover={{ y: -2, scale: 1.08 }} whileTap={{ scale: 0.88 }} onClick={() => patch({ accent: c.color })} title={c.label} aria-label={c.label}
                    className={`relative grid aspect-square w-full max-w-8 place-items-center rounded-full transition-shadow ${on ? 'ring-2 ring-[#111827] ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-[#151517]' : ''}`} style={{ background: c.color }}>
                    <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-3.5 w-3.5 text-white" strokeWidth={4} /></motion.span>}</AnimatePresence>
                  </motion.button>
                )
              })}
              <label title="Any color" className={`relative grid aspect-square w-full max-w-8 cursor-pointer place-items-center overflow-hidden rounded-full transition-transform hover:scale-110 ${titleCard.accent && !SIGNATURE_COLORS.some(c => c.color.toLowerCase() === titleCard.accent!.toLowerCase()) ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white' : ''}`}
                style={{ background: 'conic-gradient(#E5484D,#E3A33A,#3FAE6B,#14A89A,#2563EB,#8B6CF0,#EC4899,#E5484D)' }}>
                <span className="h-1/2 w-1/2 rounded-full bg-white/90 shadow" />
                <input type="color" value={titleCard.accent || sit.accent} onChange={e => patch({ accent: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Pick any color" />
              </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the situation - each card plays its own opening on hover */}
      <div>
        <p className={labelCls}>Situation</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SITUATIONS.map((s, i) => {
            const on = titleCard.preset === s.id
            return (
              <motion.button key={s.id} type="button" onClick={() => pickSituation(s.id)}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                className={`relative rounded-xl border-2 p-1 text-left transition-colors ${on ? 'border-[#C9A24D]' : 'border-transparent hover:border-[#C9A24D]/40'}`}>
                {fontsOk ? <MiniPreview style={style} preset={s.id} photo={photo} listing={listing ?? null} agent={miniAgent} active={on} accent={titleCard.accent} metal={metal} /> : <span className="block aspect-video w-full animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />}
                <span className="mt-1 flex items-center gap-1.5 px-0.5 text-[11px] font-black text-[#111827] dark:text-white">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: style === 'luxe' ? LUXE_METALS[metal].base : (titleCard.accent || s.accent) }} /><span className="truncate">{s.label}</span>
                </span>
                <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-[#111827] shadow"><Check className="h-3 w-3" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
              </motion.button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[10px] font-semibold text-gray-400">Hover a card to watch it play. {sit.blurb}.</p>
      </div>
    </div>
  )

  const layersTab = (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 rounded-xl bg-[#C9A24D]/[0.08] px-3 py-2 text-[11px] font-semibold text-[#7a5f22] dark:text-[#e8c97a]">
        <Scissors className="h-3.5 w-3.5 shrink-0" /> Set when each one shows on the timeline under the video.
      </p>
      <div className="space-y-2">
        {layer({
          id: 'title', icon: <Type className="h-4 w-4" />, title: 'Opening title', sub: 'The big reveal at the start', on: titleCard.enabled, onToggle: v => patch({ enabled: v }),
          children: (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={labelCls}>Title</label><input value={titleCard.title} maxLength={60} onChange={e => patch({ title: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Small line above</label><input value={titleCard.kicker ?? (style === 'luxe' ? sit.luxeKicker : sit.kicker)} maxLength={60} onChange={e => patch({ kicker: e.target.value })} className={inputCls} /></div>
              </div>
              {sit.event && (
                <div>
                  <label className={labelCls}>{sit.event === 'when' ? 'Day & time' : 'Previous price'}</label>
                  <input value={titleCard.event_line || ''} maxLength={60} onChange={e => patch({ event_line: e.target.value })} placeholder={sit.event === 'when' ? 'Saturday, Oct 12 · 1–3 PM' : '1,295,000'} className={inputCls} />
                </div>
              )}
              <div><label className={labelCls}>Where it sits</label><Seg id="mo-pos" value={titleCard.position || 'bottom'} options={POSITIONS} onChange={v => patch({ position: v })} /></div>
              <div>
                <label className={labelCls}>Property info</label>
                <div className="flex flex-wrap gap-1.5">
                  {fields.map(f => {
                    const on = !!titleCard[f.key]
                    return (
                      <motion.button key={f.key} type="button" layout whileTap={{ scale: 0.92 }} onClick={() => patch({ [f.key]: !on } as Partial<TitleCardOptions>)}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-gray-700'}`}>
                        {on && <Check className="h-3 w-3" strokeWidth={3.5} />}{f.label}
                      </motion.button>
                    )
                  })}
                </div>
                {!hasListing && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {fields.filter(f => titleCard[f.key]).map(f => (
                      <input key={f.key} value={titleCard.manual[f.manualKey] || ''} onChange={e => patch({ manual: { ...titleCard.manual, [f.manualKey]: e.target.value } })} placeholder={`${f.label}: ${f.placeholder}`} className={`${inputCls} py-1.5 text-xs`} />
                    ))}
                  </div>
                )}
              </div>
            </>
          ),
        })}
        {layer({ id: 'tag', icon: <Flag className="h-4 w-4" />, title: 'Corner tag', sub: `“${(titleCard.title || sit.title)}” in the corner`, on: !!titleCard.corner_tag, onToggle: v => patch({ corner_tag: v }) })}
        {layer({
          id: 'outro', icon: <Clapperboard className="h-4 w-4" />, title: 'Closing card', sub: 'You, your contact & a call to action', on: !!titleCard.end_card, onToggle: v => patch({ end_card: v }),
          children: (
            <div><label className={labelCls}>Call to action</label><input value={titleCard.end_cta || ''} maxLength={60} onChange={e => patch({ end_cta: e.target.value })} placeholder={sit.id === 'just_sold' ? 'Thinking of selling? Let’s talk.' : 'Schedule your private tour'} className={inputCls} /></div>
          ),
        })}
        {layer({
          id: 'brand', icon: <UserRound className="h-4 w-4" />, title: 'Your branding', sub: 'Photo, name & brokerage badge', on: branding.enabled, onToggle: v => onBrandingChange({ ...branding, enabled: v }),
          children: <Seg id="mo-brand" value={branding.position || 'top-left'} options={BRANDING_POSITIONS} onChange={v => onBrandingChange({ ...branding, position: v })} />,
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="relative flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
        {([['look', 'Look & color', Wand2], ['layers', 'Layers', Layers]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors ${tab === k ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
            {tab === k && <motion.span layoutId="mo-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
            <Icon className="relative h-3.5 w-3.5" /><span className="relative">{label}</span>
            {k === 'layers' && (
              <motion.span key={layersOn} initial={{ scale: 0.4 }} animate={{ scale: 1 }} className={`relative grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] ${layersOn ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-300 text-white dark:bg-gray-700'}`}>{layersOn}</motion.span>
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, x: tab === 'look' ? -16 : 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: tab === 'look' ? 16 : -16 }} transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
          {tab === 'look' ? lookTab : layersTab}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------- timeline

type RowKey = 'title' | 'tag' | 'brand' | 'outro'
type Exit = 'animate' | 'cut'
type Drag = { key: RowKey; mode: 'move' | 'start' | 'end'; grabAt: number; s0: number; e0: number; min: number; exit: Exit }
type Row = { key: RowKey; label: string; icon: React.ReactNode; start: number; end: number; exit: Exit; min: number }

/** One layer's timing written into the options (an end at the video's end = "to the end"). */
function withTiming(tc: TitleCardOptions, D: number, key: RowKey, s: number, e: number, exit: Exit): TitleCardOptions {
  const timing = { ...(tc.timing || {}) }
  const r = (n: number) => Math.round(n * 100) / 100
  if (key === 'outro') timing.outro = { start: r(s) }
  else timing[key] = { start: r(s), end: e >= D - 0.02 ? null : r(e), exit } as LayerTiming
  return { ...tc, timing }
}

/** The ruler's label step: the smallest that leaves each label room to breathe. */
const RULER_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60]
const fmtSec = (s: number, tenths = true) => {
  if (s >= 60) return `${Math.floor(s / 60)}:${(s % 60).toFixed(tenths ? 1 : 0).padStart(tenths ? 4 : 2, '0')}`
  return `${tenths ? (Math.round(s * 10) / 10).toFixed(1) : Math.round(s)}s`
}

/** One bar per layer under the video, over a seconds ruler. Drag a bar or its ends and it snaps to
 *  the clip changes; each bar picks how it leaves - animate out, or cut instantly / stay to the end.
 *  While dragging, only this timeline and the preview redraw (a local draft); the page gets the
 *  result once, on release. The playhead and its time are moved by the player's frame loop. */
function MotionTimeline({ duration, clipCount, titleCard, branding, onChange, onDraft, onSeek, playheadRef, playheadLabelRef }: {
  duration: number; clipCount: number
  titleCard: TitleCardOptions; branding: BrandingOptions
  onChange: (next: TitleCardOptions) => void
  onDraft: (next: TitleCardOptions | null) => void
  onSeek: (t: number) => void
  playheadRef: React.RefObject<HTMLSpanElement | null>
  playheadLabelRef: React.RefObject<HTMLSpanElement | null>
}) {
  const D = Math.max(0.5, duration)
  const [draft, setDraft] = useState<TitleCardOptions | null>(null)
  const tc = draft || titleCard
  const cuts = clipCuts(D, clipCount)
  const tm = resolveTiming(tc, D, clipCount)
  const trackRef = useRef<HTMLDivElement>(null)
  const hoverRef = useRef<HTMLSpanElement>(null)
  const hoverLabelRef = useRef<HTMLSpanElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [snapAt, setSnapAt] = useState<number | null>(null)
  const [trackW, setTrackW] = useState(0)
  const lux = tc.style === 'luxe' ? LUXE_METALS[metalOf(tc.metal)] : null
  const accent = tc.accent || situationOf(tc.preset).accent
  const barBg = lux ? `linear-gradient(90deg, ${lux.deep}, ${lux.mid})` : `linear-gradient(90deg, ${accent}aa, ${accent})`

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth))
    ro.observe(el)
    setTrackW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const rows: Row[] = []
  if (tc.enabled) rows.push({ key: 'title', label: 'Opening title', icon: <Type className="h-3 w-3" />, ...tm.title, min: MIN_LAYER_SECONDS.title })
  if (tc.corner_tag) rows.push({ key: 'tag', label: 'Corner tag', icon: <Flag className="h-3 w-3" />, ...tm.tag, min: MIN_LAYER_SECONDS.tag })
  if (branding.enabled) rows.push({ key: 'brand', label: 'Branding', icon: <UserRound className="h-3 w-3" />, ...tm.brand, min: MIN_LAYER_SECONDS.brand })
  if (tm.outro.on) rows.push({ key: 'outro', label: 'Closing card', icon: <Clapperboard className="h-3 w-3" />, start: tm.outro.start, end: D, exit: 'cut', min: MIN_LAYER_SECONDS.outro })

  const points = [0, ...cuts, D]
  const snapRange = Math.max(0.3, D * 0.025)
  const snap = (v: number) => {
    let best: number | null = null
    for (const p of points) if (Math.abs(p - v) <= snapRange && (best == null || Math.abs(p - v) < Math.abs(best - v))) best = p
    return best
  }
  const timeAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect()
    if (!r) return 0
    return clamp01((clientX - r.left) / r.width) * D
  }

  // Dragging: pointer moves are folded into one update per frame.
  const latestX = useRef(0)
  const frame = useRef(0)
  const draftRef = useRef<TitleCardOptions | null>(null)
  useEffect(() => {
    if (!drag) return
    const apply = () => {
      frame.current = 0
      const at = timeAt(latestX.current)
      const len = drag.e0 - drag.s0
      let s = drag.s0, e = drag.e0, hit: number | null = null
      if (drag.mode === 'move' && drag.key !== 'outro') {
        s = Math.max(0, Math.min(D - len, drag.s0 + (at - drag.grabAt)))
        const a = snap(s), b = snap(s + len)
        if (a != null && (b == null || Math.abs(a - s) <= Math.abs(b - s - len))) { s = a; hit = a } else if (b != null) { s = b - len; hit = b }
        s = Math.max(0, Math.min(D - len, s)); e = s + len
      } else if (drag.mode === 'start' || drag.key === 'outro') {
        s = Math.max(0, Math.min(drag.e0 - drag.min, at))
        const a = snap(s); if (a != null && a <= drag.e0 - drag.min) { s = a; hit = a }
      } else {
        e = Math.min(D, Math.max(drag.s0 + drag.min, at))
        const b = snap(e); if (b != null && b >= drag.s0 + drag.min) { e = b; hit = b }
      }
      setSnapAt(hit != null && hit > 0 && hit < D ? hit : null)
      const next = withTiming(titleCard, D, drag.key, s, e, drag.exit)
      draftRef.current = next
      setDraft(next)
      onDraft(next)
      onSeek(drag.mode === 'end' ? Math.max(s, e - 1.6) : s)
    }
    const move = (ev: PointerEvent) => {
      latestX.current = ev.clientX
      if (!frame.current) frame.current = requestAnimationFrame(apply)
    }
    const up = () => {
      if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0 }
      const done = draftRef.current
      draftRef.current = null
      setDrag(null); setSnapAt(null); setDraft(null); onDraft(null)
      if (done) onChange(done)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0 }
    }
  }, [drag]) // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (e: React.PointerEvent, r: Row, mode: Drag['mode']) => {
    e.preventDefault(); e.stopPropagation()
    latestX.current = e.clientX
    setDrag({ key: r.key, mode, grabAt: timeAt(e.clientX), s0: r.start, e0: r.end, min: r.min, exit: r.exit })
  }

  // Scrubbing on the ruler / clip strip: press and drag to move through the video.
  const scrubbing = useRef(false)
  const scrubDown = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbing.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeek(timeAt(e.clientX))
  }
  const scrubMove = (e: React.PointerEvent<HTMLDivElement>) => { if (scrubbing.current) onSeek(timeAt(e.clientX)) }
  const scrubUp = (e: React.PointerEvent<HTMLDivElement>) => { scrubbing.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId) }

  // A hairline + time under the cursor, written straight to the DOM (no re-render per move).
  const hover = (e: React.PointerEvent) => {
    const h = hoverRef.current, l = hoverLabelRef.current
    if (!h || !l) return
    const t = timeAt(e.clientX)
    h.style.opacity = '1'
    h.style.left = `${(t / D) * 100}%`
    l.textContent = fmtSec(t)
  }
  const unhover = () => { if (hoverRef.current) hoverRef.current.style.opacity = '0' }

  const pct = (v: number) => `${(v / D) * 100}%`
  const step = RULER_STEPS.find(st => trackW > 0 && (trackW * st) / D >= 38) ?? 60
  const ticks: { t: number; major: boolean }[] = []
  for (let k = 0; k * (step / 2) <= D + 1e-6; k++) ticks.push({ t: k * (step / 2), major: k % 2 === 0 })

  if (!rows.length) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-center text-[11px] font-semibold text-gray-400 dark:border-gray-800">
        Turn on a layer and its timeline shows up here - drag it to line it up with the clip changes.
      </div>
    )
  }

  const easing = 'cubic-bezier(.2,.8,.2,1)'
  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#141416]">
      <style>{TIMELINE_CSS}</style>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]"><Scissors className="h-3 w-3" /> Timeline</p>
        <p className="hidden text-[10px] font-semibold text-gray-400 sm:block">Drag a bar or its ends - they snap to clip changes · drag the ruler to scrub</p>
      </div>
      <div className="flex gap-2">
        {/* names */}
        <div className="w-6 shrink-0 sm:w-[104px]">
          <div className="h-[38px]" />
          {rows.map(r => (
            <div key={r.key} className="flex h-9 items-center gap-1.5 text-[11px] font-black text-[#111827] dark:text-white">
              <span title={r.label} className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#C9A24D]/15 text-[#a8843a] dark:text-[#e8c97a]">{r.icon}</span>
              <span className="hidden truncate sm:inline">{r.label}</span>
            </div>
          ))}
        </div>
        {/* tracks */}
        <div ref={trackRef} className="relative min-w-0 flex-1 touch-none select-none" onPointerMove={hover} onPointerLeave={unhover}>
          {/* seconds ruler - press and drag to scrub */}
          <div className="relative h-5 cursor-ew-resize" onPointerDown={scrubDown} onPointerMove={scrubMove} onPointerUp={scrubUp} onPointerCancel={scrubUp}>
            {ticks.map(({ t, major }) => (
              <span key={t} className="pointer-events-none absolute bottom-0" style={{ left: pct(t) }}>
                <span className={`absolute bottom-0 w-px ${major ? 'h-2 bg-gray-400 dark:bg-white/35' : 'h-1 bg-gray-300 dark:bg-white/15'}`} />
                {major && t < D - step * 0.45 && (
                  <span className={`absolute bottom-2 whitespace-nowrap text-[9px] font-black tabular-nums text-gray-400 ${t === 0 ? 'left-0' : '-translate-x-1/2'}`}>{fmtSec(t, step < 1)}</span>
                )}
              </span>
            ))}
            <span className="pointer-events-none absolute bottom-2 right-0 text-[9px] font-black tabular-nums text-gray-300 dark:text-white/30">{fmtSec(D)}</span>
          </div>
          {/* clip strip */}
          <div className="relative mt-1 flex h-4 cursor-ew-resize overflow-hidden rounded-md" onPointerDown={scrubDown} onPointerMove={scrubMove} onPointerUp={scrubUp} onPointerCancel={scrubUp}>
            {points.slice(0, -1).map((p, i) => (
              <div key={i} className={`flex h-full items-center justify-center text-[8.5px] font-black uppercase tracking-widest text-gray-400 ${i % 2 ? 'bg-gray-100 dark:bg-white/[0.04]' : 'bg-gray-50 dark:bg-white/[0.08]'}`} style={{ width: pct(points[i + 1] - p) }}>
                <span className="sm:hidden">{i + 1}</span><span className="hidden sm:inline">Clip {i + 1}</span>
              </div>
            ))}
          </div>
          {rows.map(r => {
            const animOut = r.key !== 'outro' && r.exit === 'animate'
            const dragging = drag?.key === r.key
            const editEdge = dragging ? (drag!.mode === 'end' ? r.end : r.start) : null
            return (
              <div key={r.key} className="relative h-9" onPointerDown={e => { if (e.target === e.currentTarget) onSeek(timeAt(e.clientX)) }}>
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gray-100 dark:bg-white/[0.06]" />
                <div
                  className={`tl-bar group absolute top-1.5 flex h-6 items-center overflow-hidden rounded-lg ${r.key === 'outro' ? 'cursor-ew-resize' : 'cursor-grab active:cursor-grabbing'} ${dragging ? 'tl-bar-on' : ''}`}
                  style={{ left: pct(r.start), width: pct(r.end - r.start), background: barBg, transition: drag ? 'box-shadow .2s, transform .2s' : `left .32s ${easing}, width .32s ${easing}, box-shadow .2s, transform .2s` }}
                  onPointerDown={e => startDrag(e, r, r.key === 'outro' ? 'start' : 'move')}>
                  <span className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-white/60 to-transparent" />
                  {animOut && <span className="pointer-events-none absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-white/60 to-transparent" />}
                  <span className="pointer-events-none relative mx-auto hidden truncate px-2 text-[9px] font-black tabular-nums text-white drop-shadow sm:inline">{fmtSec(r.start)} – {fmtSec(r.end)}</span>
                  {!animOut && r.key !== 'outro' && r.end < D - 0.02 && <Scissors className="pointer-events-none absolute right-1.5 h-3 w-3 text-white drop-shadow" />}
                  <span onPointerDown={e => startDrag(e, r, 'start')} className="tl-handle absolute inset-y-0 left-0 w-3 cursor-ew-resize"><span className="absolute inset-y-1.5 left-1 w-0.5 rounded-full bg-white/85" /></span>
                  {r.key !== 'outro' && (
                    <span onPointerDown={e => startDrag(e, r, 'end')} className="tl-handle absolute inset-y-0 right-0 w-3 cursor-ew-resize"><span className="absolute inset-y-1.5 right-1 w-0.5 rounded-full bg-white/85" /></span>
                  )}
                </div>
                {/* the exact second being set, riding the edge you're dragging */}
                {editEdge != null && (
                  <span className="pointer-events-none absolute -top-2.5 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111827] px-1.5 py-0.5 text-[10px] font-black tabular-nums text-white shadow-lg dark:bg-white dark:text-[#111827]" style={{ left: pct(editEdge) }}>
                    {drag!.mode === 'move' ? `${fmtSec(r.start)} – ${fmtSec(r.end)}` : fmtSec(editEdge)}
                  </span>
                )}
              </div>
            )
          })}
          {/* clip changes */}
          {cuts.map(c => {
            const hit = snapAt != null && Math.abs(snapAt - c) < 0.01
            return <span key={`${c}-${hit}`} className={`pointer-events-none absolute bottom-0 top-[38px] w-px ${hit ? 'tl-snap bg-[#C9A24D]' : 'bg-gray-300/80 dark:bg-white/15'}`} style={{ left: pct(c) }} />
          })}
          {/* hover hairline */}
          <span ref={hoverRef} className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-[#C9A24D]/70 opacity-0 transition-opacity duration-150">
            <span ref={hoverLabelRef} className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#C9A24D] px-1 text-[9px] font-black tabular-nums text-[#111827]" />
          </span>
          {/* playhead - moved every frame by the player */}
          <span ref={playheadRef} className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 -translate-x-1/2 rounded-full bg-[#111827] will-change-[left] dark:bg-white" style={{ left: '0%' }}>
            <span ref={playheadLabelRef} className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[#111827] px-1.5 py-px text-[9px] font-black tabular-nums text-white shadow dark:bg-white dark:text-[#111827]">0.0s</span>
          </span>
        </div>
        {/* how each one leaves */}
        <div className="w-[96px] shrink-0 sm:w-[132px]">
          <div className="flex h-[38px] items-end justify-center pb-1 text-[9px] font-black uppercase tracking-widest text-gray-400">Leaves by</div>
          {rows.map(r => {
            if (r.key === 'outro') return <div key={r.key} className="flex h-9 items-center justify-center text-[10px] font-bold text-gray-400">Ends the video</div>
            const atEnd = r.end >= D - 0.02
            const opts: { id: Exit; label: string }[] = [{ id: 'animate', label: 'Animate' }, { id: 'cut', label: atEnd ? 'Stay' : 'Cut' }]
            return (
              <div key={r.key} className="flex h-9 items-center">
                <div className="flex w-full gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-white/[0.06]">
                  {opts.map(o => (
                    <button key={o.id} type="button" onClick={() => { if (r.exit !== o.id) onChange(withTiming(titleCard, D, r.key, r.start, r.end, o.id)) }}
                      title={o.id === 'animate' ? 'Plays its exit animation as it leaves' : atEnd ? 'Stays on to the very last frame' : 'Disappears instantly - like an edit on the clip change'}
                      className={`relative flex-1 rounded-md py-1 text-[10px] font-black transition-colors active:scale-95 ${r.exit === o.id ? 'text-[#111827] dark:text-white' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'}`}>
                      {r.exit === o.id && <motion.span layoutId={`exit-${r.key}`} className="absolute inset-0 rounded-md bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />}
                      <span className="relative">{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const TIMELINE_CSS = `
.tl-bar{box-shadow:0 1px 2px rgba(0,0,0,.12)}
.tl-bar:hover{box-shadow:0 6px 16px -6px rgba(0,0,0,.45)}
.tl-bar-on{box-shadow:0 0 0 2px rgba(17,24,39,.75),0 10px 22px -8px rgba(0,0,0,.5);transform:translateY(-1px)}
.dark .tl-bar-on{box-shadow:0 0 0 2px rgba(255,255,255,.8),0 10px 22px -8px rgba(0,0,0,.6)}
.tl-handle{background:transparent;transition:background .15s}
.tl-handle:hover{background:rgba(0,0,0,.22)}
.tl-snap{box-shadow:0 0 10px #C9A24D;animation:tlSnap .35s ease-out}
@keyframes tlSnap{0%{transform:scaleX(1)}40%{transform:scaleX(4)}100%{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){.tl-snap{animation:none}}
`

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

// ---------------------------------------------------------------- live preview player

/** The <video> with the design painted over it, its own controls and the timeline. The frame loop
 *  only repaints when the picture can have changed, and drives the playhead, scrubber and clock
 *  directly - no React re-render per frame. */
export function VideoResultPlayer({
  previewSrc, previewClassName, titleCard, branding, listing, agentName, agentBrokerage, agentAvatarUrl, agentPhone, clipCount = 1, onTitleCardChange, onDuration,
}: {
  previewSrc: string
  previewClassName: string
  titleCard: TitleCardOptions
  branding: BrandingOptions
  /** Clips the video is made of - the timeline marks where they change. */
  clipCount?: number
  /** Given = the timeline under the video can retime the layers. */
  onTitleCardChange?: (next: TitleCardOptions) => void
  /** The clip's real length once it loads. */
  onDuration?: (seconds: number) => void
  listing: LinkedProperty | null
  agentName: string
  agentBrokerage: string
  agentAvatarUrl?: string | null
  agentPhone?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrubRef = useRef<HTMLInputElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const playheadRef = useRef<HTMLSpanElement>(null)
  const playheadLabelRef = useRef<HTMLSpanElement>(null)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => { loadMotionFonts().then(() => setReady(true)) }, [])
  useEffect(() => { let alive = true; loadMotionImage(agentAvatarUrl).then(img => { if (alive) setPhoto(img) }); return () => { alive = false } }, [agentAvatarUrl])

  // What to draw: the saved design, or the timeline's draft while a bar is being dragged.
  const sceneRef = useRef<MotionScene | null>(null)
  const draftRef = useRef<TitleCardOptions | null>(null)
  const versionRef = useRef(0)
  sceneRef.current = { title: titleCard, branding, listing, agent: { name: agentName, brokerage: agentBrokerage, phone: agentPhone, photo }, clipCount }
  versionRef.current++
  const onDraft = useCallback((next: TitleCardOptions | null) => { draftRef.current = next; versionRef.current++ }, [])

  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [dur, setDur] = useState(0)
  const scrubbingRef = useRef(false)
  const fmtClock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`

  useEffect(() => {
    if (!ready) return
    let raf = 0
    let box = { w: 0, h: 0 }
    const wrap = wrapRef.current
    const ro = wrap ? new ResizeObserver(() => { box = { w: wrap.clientWidth, h: wrap.clientHeight }; last.ver = -1 }) : null
    if (wrap && ro) { ro.observe(wrap); box = { w: wrap.clientWidth, h: wrap.clientHeight } }
    const last = { t: -1, ver: -1, vw: 0 }
    const tick = () => {
      const v = videoRef.current, c = canvasRef.current
      if (v && c && box.w) {
        const t = v.currentTime || 0
        const D = v.duration || 0
        const vw = v.videoWidth || 16, vh = v.videoHeight || 9
        // repaint only when the frame, the design or the size changed
        if (t !== last.t || versionRef.current !== last.ver || vw !== last.vw) {
          const s = Math.min(box.w / vw, box.h / vh)
          const dw = vw * s, dh = vh * s
          const dpr = Math.min(2, window.devicePixelRatio || 1)
          if (c.width !== Math.round(dw * dpr) || c.height !== Math.round(dh * dpr)) {
            c.width = Math.round(dw * dpr); c.height = Math.round(dh * dpr)
            c.style.width = `${dw}px`; c.style.height = `${dh}px`
            c.style.left = `${(box.w - dw) / 2}px`; c.style.top = `${(box.h - dh) / 2}px`
          }
          const ctx = c.getContext('2d')
          const scene = sceneRef.current
          if (ctx && scene) {
            ctx.clearRect(0, 0, c.width, c.height)
            drawMotion(ctx, c.width, c.height, t, D || 30, draftRef.current ? { ...scene, title: draftRef.current } : scene)
          }
          if (t !== last.t && D) {
            const p = `${(Math.min(t, D) / D) * 100}%`
            if (playheadRef.current) playheadRef.current.style.left = p
            if (playheadLabelRef.current) playheadLabelRef.current.textContent = fmtSec(t)
            if (clockRef.current) clockRef.current.textContent = `${fmtClock(t)} / ${fmtClock(D)}`
            if (scrubRef.current && !scrubbingRef.current) scrubRef.current.value = String(t)
          }
          last.t = t; last.ver = versionRef.current; last.vw = vw
        }
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [ready])

  // Seeks never pile up: while the video is still finding one frame, only the newest target waits.
  const pendingSeek = useRef<number | null>(null)
  const seekTo = useCallback((t: number) => {
    const v = videoRef.current
    if (!v) return
    if (!v.paused) v.pause()
    setStarted(true)
    if (v.seeking) { pendingSeek.current = t; return }
    pendingSeek.current = null
    v.currentTime = t
  }, [])
  const onSeeked = () => {
    const v = videoRef.current, p = pendingSeek.current
    if (v && p != null) { pendingSeek.current = null; v.currentTime = p }
  }

  const replay = () => { const v = videoRef.current; if (!v) return; v.currentTime = 0; v.play().catch(() => {}) }
  const toggle = () => { const v = videoRef.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause() }

  return (
    <div className="mx-auto w-full">
      <div ref={wrapRef} className={`group relative mx-auto w-full overflow-hidden rounded-xl border border-gray-200 bg-black dark:border-gray-700 ${previewClassName}`}>
        <video ref={videoRef} src={previewSrc} playsInline onClick={toggle} preload="auto"
          onPlay={() => { setPlaying(true); setStarted(true) }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onSeeked={onSeeked}
          onLoadedMetadata={e => { const d = e.currentTarget.duration || 0; setDur(d); onDuration?.(d); if (clockRef.current) clockRef.current.textContent = `${fmtClock(0)} / ${fmtClock(d)}` }}
          className="h-full w-full cursor-pointer object-contain" />
        <canvas ref={canvasRef} className="pointer-events-none absolute" />
        <AnimatePresence>
          {!playing && !started && (
            <motion.button key="big-play" type="button" onClick={toggle} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}
              className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 transition hover:bg-[#C9A24D] hover:text-[#111827]" aria-label="Play">
              <Play className="ml-0.5 h-6 w-6" fill="currentColor" />
            </motion.button>
          )}
        </AnimatePresence>
        <button type="button" onClick={() => wrapRef.current?.requestFullscreen?.()} title="Open fullscreen"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-[#C9A24D] hover:text-[#111827]">
          <Maximize className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* controls live under the picture so nothing covers the design */}
      <div className="mt-2 flex items-center gap-2.5">
        <motion.button type="button" onClick={toggle} whileTap={{ scale: 0.88 }} aria-label={playing ? 'Pause' : 'Play'}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#111827] text-white transition hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={playing ? 'pause' : 'play'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.12 }}>
              {playing ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="ml-0.5 h-3.5 w-3.5" fill="currentColor" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
        <input ref={scrubRef} type="range" min={0} max={dur || 1} step={0.01} defaultValue={0} aria-label="Seek"
          onPointerDown={() => { scrubbingRef.current = true }} onPointerUp={() => { scrubbingRef.current = false }}
          onInput={e => seekTo(parseFloat((e.target as HTMLInputElement).value))}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#C9A24D]" />
        <span ref={clockRef} className="w-[92px] shrink-0 text-right text-[11px] font-black tabular-nums text-gray-500 dark:text-gray-400">0:00.0 / 0:00.0</span>
        <motion.button type="button" onClick={replay} whileHover={{ y: -1 }} whileTap={{ scale: 0.92 }} title="Replay from the start"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-gray-200 px-3 text-[10px] font-black uppercase tracking-wider text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white">
          <RotateCcw className="h-3 w-3" /> Replay
        </motion.button>
      </div>
      {onTitleCardChange && dur > 0 && (
        <MotionTimeline duration={dur} clipCount={clipCount} titleCard={titleCard} branding={branding}
          onChange={onTitleCardChange} onDraft={onDraft} onSeek={seekTo} playheadRef={playheadRef} playheadLabelRef={playheadLabelRef} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- export (in the browser)

/** Plays the clip once into a canvas with the design painted over each frame and records it.
 *  Real-time (a 30s clip takes ~30s). MP4 where the browser can record it, else WebM. */
export async function renderMotionVideo(opts: {
  source: Blob
  titleCard: TitleCardOptions
  branding: BrandingOptions
  listing: LinkedProperty | null
  agent: { name: string; brokerage: string; phone?: string; avatarUrl?: string | null }
  clipCount?: number
  onProgress?: (p: number) => void
}): Promise<{ blob: Blob; ext: 'mp4' | 'webm' }> {
  await loadMotionFonts()
  const photo = await loadMotionImage(opts.agent.avatarUrl)
  const url = URL.createObjectURL(opts.source)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Could not read the video')) })
  const w = video.videoWidth, h = video.videoHeight, duration = video.duration
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  const scene: MotionScene = { title: opts.titleCard, branding: opts.branding, listing: opts.listing, agent: { name: opts.agent.name, brokerage: opts.agent.brokerage, phone: opts.agent.phone, photo }, clipCount: opts.clipCount }
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
  const mime = types.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || 'video/webm'
  const stream = canvas.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(w * h * 30 * 0.18) })
  const chunks: Blob[] = []
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
  const done = new Promise<void>(resolve => { rec.onstop = () => resolve() })
  const paint = () => {
    ctx.drawImage(video, 0, 0, w, h)
    drawMotion(ctx, w, h, video.currentTime, duration, scene)
    opts.onProgress?.(Math.min(1, video.currentTime / duration))
  }
  paint()
  rec.start(250)
  await video.play()
  await new Promise<void>(resolve => {
    const step = () => {
      paint()
      if (video.ended || video.currentTime >= duration - 0.02) { resolve(); return }
      if ('requestVideoFrameCallback' in video) (video as any).requestVideoFrameCallback(step)
      else requestAnimationFrame(step)
    }
    step()
    video.onended = () => { paint(); resolve() }
  })
  await new Promise(r => setTimeout(r, 200))
  rec.stop()
  await done
  URL.revokeObjectURL(url)
  opts.onProgress?.(1)
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), ext: mime.includes('mp4') ? 'mp4' : 'webm' }
}
