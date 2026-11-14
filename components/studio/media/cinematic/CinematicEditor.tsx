'use client'

// AI Media - Cinematic Video editor. One project from the first tap (a draft that autosaves): length
// and shape first, then the rooms to show (the AI sorts the listing's photos into rooms), a quick
// one-photo-at-a-time check, the moment, the look, the flow, the words, and Make - with a live
// preview of the real video placed to suit its shape. Then the finished video with every shape to
// download and quick section / transition edits. The same editor runs on its own page and inside
// the AI chat (embedded). See lib/studio/cinematic.ts, /motion-video (the video itself) and backend
// app/services/studio_motion_service.py.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Download, Expand, Film, ImagePlus, Loader2,
  Music2, Pause, Play, Plus, RefreshCw, Shuffle, Sparkles, Wand2, X,
} from 'lucide-react'
import FlowDock from '@/components/ui/FlowDock'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import { OHP_MEDIA_STYLE } from '@/components/studio/media/shared'
import { MINI_CSS, MOTION_FONT_CSS, StyleMini, ThemeMini, TransitionMini } from '@/components/studio/media/cinematic/MiniPreviews'
import api from '@/lib/api-service'
import { saveFile } from '@/lib/mobileShare'
import { SIGNATURE_COLORS } from '@/lib/studio/videoMotion'
import { LUXE_METALS, LUXE_METAL_ORDER } from '@/lib/luxeMetals'
import {
  RENDER_ACTIVE, addPhoto, analysisOf, clock, cycleChoice, formatsOf, pct, photosForRooms, pickedIn, proxied, removePhoto, renderOf, sectionsOf, settingsOf, sized, suggestRooms,
  swapPhoto, thumbOf, trimToCap, wantOf, type MotionPhotoSetting, type MotionPoolPhoto, type MotionSettings, type PhotoSection,
} from '@/lib/studio/cinematic'
import {
  KIND_LABELS, MOVE_LABELS, SITUATION_PRESETS, STYLE_PRESETS, TRANSITION_PRESETS, kindLabel, roomOption, situationPreset, stylePreset,
  transitionPreset, type RoomKey,
} from '@/motion-video/presets'
import { LENGTH_OPTIONS, buildTimeline, maxPhotosFor } from '@/motion-video/timeline'
import { FORMAT_SIZE, musicFile, type MotionFormat, type PhotoKind, type TransitionId } from '@/motion-video/types'
import type { StudioMediaAsset } from '@/types'

const LivePreview = dynamic(() => import('@/components/studio/media/cinematic/LivePreview'), {
  ssr: false,
  // kept short while it loads (in the wide chat a full-width 16:9 box filled the screen - owner 11/13)
  loading: () => <div className="aspect-video max-h-[40vh] w-full rounded-2xl bg-[#111827]" />,
})

const STEPS = [
  { key: 'setup', title: 'Length & shape', short: 'Length' },
  { key: 'rooms', title: 'What to show', short: 'Photos' },
  { key: 'check', title: 'Check each photo', short: 'Check' },
  { key: 'situation', title: "What's it for?", short: 'For' },
  { key: 'look', title: 'Look & motion', short: 'Look' },
  { key: 'flow', title: 'Order & transitions', short: 'Flow' },
  { key: 'details', title: 'Words & details', short: 'Details' },
  { key: 'make', title: 'Make your video', short: 'Make' },
] as const
const S = { setup: 0, rooms: 1, check: 2, situation: 3, look: 4, flow: 5, details: 6, make: 7 } as const
const TALL: MotionFormat[] = ['9:16', '4:5']

const FORMAT_INFO: { id: MotionFormat; label: string; where: string }[] = [
  { id: '16:9', label: 'Landscape', where: 'YouTube, websites, email' },
  { id: '9:16', label: 'Vertical', where: 'Reels, TikTok, Stories' },
  { id: '1:1', label: 'Square', where: 'Instagram & Facebook feed' },
  { id: '4:5', label: 'Portrait', where: 'Instagram feed, tallest' },
]

const MUSIC_INFO = [
  { id: 'elegant' as const, label: 'Elegant piano', blurb: 'Piano and soft strings - calm and refined' },
  { id: 'bright' as const, label: 'Bright & modern', blurb: 'Acoustic guitar, light drums - upbeat' },
  { id: 'none' as const, label: 'No music', blurb: 'Add your own in Instagram or TikTok' },
]

// In a narrow space on a wide screen (the chat panel) the window-size grid classes would cram the
// cards; this keeps them to one or two columns based on the editor's own width.
const NARROW_CSS = `
.ohp-cine-narrow .sm\\:grid-cols-4,.ohp-cine-narrow .sm\\:grid-cols-3{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.ohp-cine-narrow .sm\\:grid-cols-6{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.ohp-cine-narrow .sm\\:grid-cols-2,.ohp-cine-narrow .sm\\:grid-cols-\\[minmax\\(0\\,1fr\\)_minmax\\(0\\,0\\.6fr\\)\\]{grid-template-columns:minmax(0,1fr)!important}
.ohp-cine-narrow .sm\\:text-3xl{font-size:1.5rem!important;line-height:2rem!important}
.ohp-cine-narrow .sm\\:flex-none{flex:1 1 0%!important}
.ohp-cine-narrow .ohp-dl-row{flex-wrap:wrap;row-gap:.5rem}
.ohp-cine-narrow .ohp-dl-text{flex-basis:calc(100% - 3rem)}
.ohp-cine-narrow .ohp-dl-where{white-space:normal;overflow:visible}
.ohp-cine-narrow .ohp-dl-btn{margin-left:3rem}
`

const gold = 'text-[#8b7355] dark:text-[#d7b974]'
const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none transition placeholder:font-medium placeholder:text-gray-400 focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white'
const labelCls = 'mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400'

// ---------------------------------------------------------------- small parts

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
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
          className={`relative flex-1 rounded-lg px-2 py-2 text-[11px] font-black transition-colors ${value === o.id ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
          {value === o.id && <motion.span layoutId={id} className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-5 ${className}`}>{children}</div>
}

function CardTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-serif text-base font-black text-[#111827] dark:text-white">{title}</p>
        {sub && <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

function Pick({ active, onClick, children, className = '', badge, disabled, expanded, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string; badge?: string; disabled?: boolean; expanded?: boolean; testId?: string }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} aria-expanded={expanded} aria-pressed={active} data-testid={testId}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition ${disabled ? 'cursor-not-allowed opacity-55' : 'hover:-translate-y-0.5'} ${active ? 'border-[#C9A24D] shadow-[0_0_34px_-14px_rgba(201,162,77,0.8)]' : `border-gray-200 dark:border-gray-800 ${disabled ? '' : 'hover:border-[#C9A24D]/50'}`} bg-white dark:bg-[#151517] ${className}`}>
      {children}
      {badge && <span className="absolute left-2 top-2 z-10 rounded-full bg-[#111827]/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#f1d58b]">{badge}</span>}
      <AnimatePresence>
        {active && (
          <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
            className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827] shadow-md">
            <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

function Field({ label, value, onChange, placeholder, maxLength = 60, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; hint?: string }) {
  return (
    <label className="block min-w-0">
      <span className={labelCls}>{label}</span>
      <input className={inputCls} value={value || ''} placeholder={placeholder} maxLength={maxLength} onChange={e => onChange(e.target.value)} />
      {hint && <span className="mt-1 block text-[10.5px] font-semibold text-gray-400">{hint}</span>}
    </label>
  )
}

// The "Making your video" screen's moving parts, kept to transform + opacity only so the browser's
// compositor runs them without repainting (owner 11/13: the old scanning screen lagged - a JS-driven
// zoom on a brightness-filtered photo plus a background-position shimmer repainted every frame). The
// photo is darkened by a plain black layer instead of a filter. Everything stops while the card is off
// screen or the tab is hidden (data-paused), and with reduced motion.
const MAKING_CSS = `
@keyframes ohpMkScan{0%{transform:translate3d(0,-120%,0)}100%{transform:translate3d(0,320%,0)}}
@keyframes ohpMkDrift{0%{transform:scale(1.06)}100%{transform:scale(1.18)}}
@keyframes ohpMkSheen{0%{transform:translate3d(-100%,0,0)}100%{transform:translate3d(100%,0,0)}}
@keyframes ohpMkGlow{0%,100%{opacity:.35}50%{opacity:.8}}
@keyframes ohpMkSpin{to{transform:rotate(360deg)}}
.ohp-mk-scan{animation:ohpMkScan 2.4s cubic-bezier(.4,0,.2,1) infinite;will-change:transform}
.ohp-mk-photo{opacity:0;transform:scale(1.18);transition:opacity 1.4s ease}
.ohp-mk-photo.on{opacity:1;animation:ohpMkDrift 4.6s linear both;will-change:transform,opacity}
.ohp-mk-glow{animation:ohpMkGlow 1.6s ease-in-out infinite}
.ohp-mk-spin{animation:ohpMkSpin 1s linear infinite}
.ohp-mk-sheen{position:relative;overflow:hidden}
.ohp-mk-sheen::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:ohpMkSheen 1.8s linear infinite;will-change:transform}
.ohp-mk[data-paused] *,.ohp-mk[data-paused] *::after{animation-play-state:paused!important}
@media (prefers-reduced-motion:reduce){.ohp-mk *,.ohp-mk *::after,.ohp-mk-sheen::after{animation:none!important}}
`

/** True while this element is on screen and the tab is showing - loops pause otherwise. */
function useShowing(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true)
  const [tabShown, setTabShown] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  useEffect(() => {
    const v = () => setTabShown(!document.hidden)
    v(); document.addEventListener('visibilitychange', v)
    return () => document.removeEventListener('visibilitychange', v)
  }, [])
  return inView && tabShown
}

/** A video being made (owner 11/13: the old bar was "very bland and boring") - in the AI photo tool's
 *  style: the home's own photos drifting behind a sweeping gold light, a glowing spinner, a big
 *  percent, a shimmering bar, the countdown and the line. Shaped like the video they chose; smaller
 *  inside the chat. It runs its own one-second clock (the editor around it no longer re-draws every
 *  second while a video is being made). */
function MakingCard({ photos, aspect, title, stage, pct, etaAt, startedAt, ahead, compact, embedded }: {
  photos: string[]; aspect: number; title: string; stage: string; pct: number; etaAt?: string | null; startedAt?: string | null; ahead: number; compact?: boolean; embedded?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const showing = useShowing(ref)
  const [{ i, prev }, setPair] = useState({ i: 0, prev: -1 })
  const [now, setNow] = useState(() => Date.now())
  const [broken, setBroken] = useState<Record<string, true>>({})
  const list = photos.filter(u => !broken[u])
  useEffect(() => {
    if (!showing || list.length < 2) return
    const n = list.length
    const t = setInterval(() => setPair(p => ({ prev: p.i % n, i: (p.i + 1) % n })), 4600)
    return () => clearInterval(t)
  }, [showing, list.length])
  useEffect(() => {
    if (!showing) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [showing])
  const elapsed = startedAt ? Math.max(0, (now - new Date(startedAt).getTime()) / 1000) : 0
  // Time left: the video maker's own estimate (its measured speed + the videos ahead in line); the
  // progress-bar guess only before it has answered.
  const etaLeft = etaAt ? Math.max(0, (new Date(etaAt).getTime() - now) / 1000) : null
  const eta = etaLeft != null ? etaLeft : pct > 0.15 && elapsed > 5 ? Math.max(5, (elapsed / pct) * (1 - pct)) : null
  const tall = aspect < 1
  const maxH = embedded ? '58vh' : '72vh'
  const cur = list.length ? i % list.length : -1
  return (
    <div ref={ref} data-paused={showing ? undefined : ''} data-testid="cine-making"
      className="ohp-mk ohp-reveal relative mx-auto w-full overflow-hidden rounded-2xl border-2 border-[#C9A24D]/50 bg-[#0b0b0d]"
      style={{
        aspectRatio: compact ? '16 / 10' : String(aspect), minHeight: compact || embedded ? 300 : 360,
        maxWidth: compact ? undefined : tall ? `min(${embedded ? 420 : 820}px, calc(${maxH} * ${aspect.toFixed(4)}))` : embedded ? 600 : 820,
        boxShadow: '0 0 44px -10px rgba(201,162,77,0.5)',
      }}>
      {list.map((src, k) => (k === cur || k === prev) && (
        <img key={src} src={src} alt="" draggable={false} decoding="async" onError={() => setBroken(b => ({ ...b, [src]: true }))}
          className={`ohp-mk-photo absolute inset-0 h-full w-full object-cover ${k === cur ? 'on' : ''}`} />
      ))}
      <div className="absolute inset-0 bg-black/60" />
      <div className="ohp-mk-scan pointer-events-none absolute inset-x-0 top-0 h-1/3"
        style={{ background: 'linear-gradient(180deg,transparent,rgba(230,199,122,0.42) 45%,rgba(255,255,255,0.7) 50%,rgba(230,199,122,0.42) 55%,transparent)' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30" />
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 px-6 text-center [text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <span className="ohp-mk-glow absolute inset-0 rounded-full bg-[#C9A24D]/45" />
          <span className="ohp-mk-spin absolute inset-0 rounded-full border-2 border-white/15 border-t-[#f1d58b]" />
          <Clapperboard className="relative h-6 w-6 text-white" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f1d58b]">{title}</p>
        <p className="text-sm font-black text-white">{stage}</p>
        <p className={`font-serif font-black tabular-nums leading-none text-white ${embedded || compact ? 'text-4xl' : 'text-5xl'}`}>{Math.round(pct * 100)}%</p>
        <div className="h-1.5 w-full max-w-[300px] overflow-hidden rounded-full bg-white/15">
          <div className="ohp-mk-sheen h-full rounded-full bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D] transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(4, Math.min(100, pct * 100))}%` }} />
        </div>
        <p className="text-[11.5px] font-bold tabular-nums text-white/80">
          {eta != null ? `Ready in about ${clock(eta)}` : 'Usually a few minutes'}{ahead > 0 ? ` · ${ahead} ${ahead === 1 ? 'video' : 'videos'} ahead of yours` : ''} · {clock(elapsed)} so far
        </p>
        <p className="max-w-[300px] rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[10.5px] font-semibold leading-snug text-white/75 [text-shadow:none]">
          You can close this page or log out - it keeps going. Your bell lets you know when it&apos;s ready.
        </p>
      </div>
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
      <div className="ohp-mk-sheen h-full rounded-full bg-gradient-to-r from-[#C9A24D] via-[#f1d58b] to-[#C9A24D] transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(4, Math.min(100, value * 100))}%` }} />
    </div>
  )
}

const aboutPct = (v?: number | null) => { const p = pct(v); return !p || p === '<1%' ? 'less than 1%' : `about ${p}` }
const visibleCount = (d: MotionSettings) => d.photos.filter(p => !p.hidden).length

/** One room's photos with tick boxes, opened under its card on "What to show" (owner 11/13: "pick
 *  WHICH photos - e.g. 3 of 5 bedroom photos"). Our pick is pre-ticked; the length's limit applies. */
// Rooms a photo is easily filed under instead (a basement bedroom may sit under Basement, the primary
// suite under Primary bedroom) - each strip links to these when the home has them.
const RELATED: Partial<Record<string, string[]>> = {
  bedroom: ['primary', 'basement', 'bonus'], primary: ['bedroom'], bath: ['primary_bath', 'basement'], primary_bath: ['bath'],
  living: ['family', 'entry'], family: ['living', 'basement'], basement: ['bedroom', 'bath', 'bonus'], bonus: ['basement', 'office'], office: ['bonus'],
  kitchen: ['dining'], dining: ['kitchen'], entry: ['living'], front: ['back', 'aerial'], back: ['yard', 'front'], yard: ['back', 'view', 'pool'],
  pool: ['yard'], view: ['yard', 'aerial'], aerial: ['front', 'view'], detail: ['other'],
}

function SectionPanel({ sec, s, cols, full, maxShown, related, onToggle, onDone, onRemove, onAdd, onOpen }: {
  sec: PhotoSection; s: MotionSettings; cols: number; full: boolean; maxShown: number; related: PhotoSection[]
  onToggle: (it: MotionPoolPhoto) => void; onDone: () => void; onRemove: () => void; onAdd: () => void; onOpen: (id: string) => void
}) {
  const picked = new Set(pickedIn(s, sec).map(p => p.source))
  const other = sec.id === 'other'
  return (
    <div style={{ gridColumn: '1 / -1' }} data-testid="cine-section-panel"
      className="ohp-reveal rounded-2xl border-2 border-[#C9A24D]/55 bg-white p-3 shadow-[0_10px_34px_-18px_rgba(201,162,77,0.7)] dark:bg-[#151517] sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-base font-black text-[#111827] dark:text-white">{other ? 'Other photos' : `${sec.label} photos`}</p>
          <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {other
              ? 'Ones we\'d usually leave out (floor plans, garages, closets) or couldn\'t place - tick any you want.'
              : `Tick the ones you want in the video${sec.photos.length > 1 ? ' - "Our pick" is the one we think shows it best' : ''}.`}
          </p>
        </div>
        <button type="button" onClick={onDone} className="shrink-0 rounded-full bg-[#111827] px-4 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">Done</button>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {sec.photos.map((it, k) => {
          const on = picked.has(it.source)
          const blocked = !on && full
          return (
            <button key={it.source} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(it)}
              aria-label={`${it.label || sec.label} - ${on ? 'in the video' : 'not in the video'}`} title={blocked ? `Your video holds ${maxShown} photos - untick one first` : undefined}
              className={`relative overflow-hidden rounded-xl border-2 bg-gray-50 text-left transition dark:bg-white/[0.03] ${on ? 'border-[#C9A24D]' : 'border-transparent hover:border-[#C9A24D]/50'} ${blocked ? 'opacity-55' : ''}`}>
              <span className="relative block aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img src={thumbOf(it.clean || it.source) || ''} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                <span className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border-2 shadow ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-white/90 bg-black/30 text-transparent'}`}>
                  <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                </span>
                {k === 0 && !other && sec.photos.length > 1 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#111827]/85 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-[#f1d58b]">Our pick</span>
                )}
              </span>
              <span className="block truncate px-1.5 py-1 text-[10.5px] font-bold text-gray-600 dark:text-gray-300">{it.label || roomOption(it.room)?.label || 'Photo'}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[11px] font-bold ${full ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500'}`}>
          {picked.size} of {sec.photos.length} ticked · {full ? `your video is full (${maxShown} photos) - untick one to swap, or pick a longer video` : `${visibleCount(s)} of ${maxShown} in your video`}
        </p>
        {related.length > 0 && (
          <p className="flex w-full flex-wrap items-center gap-1.5 text-[11px] font-bold text-gray-400 order-last">
            Not here? Also see
            {related.map(r => (
              <button key={r.id} type="button" onClick={() => onOpen(r.id)}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-black text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300">
                {r.label} · {r.photos.length}
              </button>
            ))}
          </p>
        )}
        <div className="flex items-center gap-1">
          {other && <button type="button" onClick={onAdd} className="rounded-full px-3 py-1.5 text-[11px] font-black text-gray-500 hover:bg-gray-100 hover:text-[#8b7355] dark:hover:bg-white/10">Add more photos</button>}
          {picked.size > 0 && (
            <button type="button" onClick={onRemove} className="rounded-full px-3 py-1.5 text-[11px] font-black text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
              {other ? 'Untick all' : 'Take this room out'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export default function CinematicEditor({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const router = useRouter()
  const [asset, setAsset] = useState<StudioMediaAsset | null>(null)
  const [s, setS] = useState<MotionSettings | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(0)
  const [view, setView] = useState<'steps' | 'video'>('steps')
  const [videoTab, setVideoTab] = useState<'video' | 'preview'>('video')
  const [save, setSave] = useState<'saved' | 'saving' | 'error'>('saved')
  const [error, setError] = useState('')
  const [exampleOpen, setExampleOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [gapFor, setGapFor] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [est, setEst] = useState<Awaited<ReturnType<typeof api.mediaLab.motion.estimate>>['data'] | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [workerUp, setWorkerUp] = useState<boolean | null>(null)
  const [speed, setSpeed] = useState<{ wait_seconds?: number; sec_per_frame?: number; start_seconds?: number; save_seconds?: number; queued?: number; busy?: boolean } | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  // Laid out by the space it actually has (the full page, or a message in the chat) - not the window.
  const [width, setWidth] = useState(0)
  const [checkAt, setCheckAt] = useState(0)
  const [roomNote, setRoomNote] = useState('')
  // The room whose photo strip is open on "What to show" (owner 11/13: pick WHICH photos of a room)
  const [openSec, setOpenSec] = useState<string | null>(null)
  const transitionTouched = useRef(false)
  const dirty = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analyzeKicked = useRef(false)
  const prevAnalysis = useRef<string>('idle')
  const topRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [asset != null]) // eslint-disable-line react-hooks/exhaustive-deps
  const wide = width >= (embedded ? 680 : 860)

  // ---- load
  useEffect(() => {
    let alive = true
    api.mediaLab.getAsset(id).then(({ success, data, error: e }) => {
      if (!alive) return
      if (!success || !data) { setLoadError(e || 'We couldn\'t open this project.'); return }
      if (data.action !== 'motion') { router.replace(`/studio/media/${id}`); return }
      setAsset(data)
      const st = settingsOf(data)
      setS(st)
      prevAnalysis.current = analysisOf(data).status
      if (data.status === 'succeeded') setView('video')
      else if (data.status === 'processing' || data.status === 'failed') setStep(S.make)
      else if (st && st.photos.some(p => !p.hidden)) {
        // A draft picks up where it was left.
        const vis = st.photos.filter(p => !p.hidden)
        const base = vis.every(p => p.confirmed) ? S.situation : S.check
        // ...and further on, the step they were on last time on this device (QA 11/12: it reopened at
        // "What's it for?" after they'd reached Words & details)
        let last = 0
        try { last = Number(window.localStorage.getItem(`ohp-cine-step:${id}`)) || 0 } catch { /* private mode */ }
        setStep(base === S.situation && last > base && last <= S.make ? last : base)
      }
    })
    api.mediaLab.usage().then(r => { if (alive && r.success && r.data) setBudget(r.data.month_ai_budget_usd ?? null) })
    return () => { alive = false }
  }, [id, router])

  const analysis = analysisOf(asset)
  const render = renderOf(asset)
  const rendering = RENDER_ACTIVE.includes(render.state)
  const formats = formatsOf(asset)

  // ---- autosave (debounced; never on the first fill from the server)
  const flush = useCallback(async (settings?: MotionSettings | null) => {
    const cur = settings ?? s
    if (!cur || !dirty.current) return true
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    dirty.current = false
    setSave('saving')
    const { success, data } = await api.mediaLab.motion.update(id, cur as unknown as Record<string, unknown>)
    if (!success || !data) { setSave('error'); dirty.current = true; return false }
    setAsset(prev => (prev ? { ...prev, options: { ...data.options, motion: (prev.options as any)?.motion ?? (data.options as any)?.motion } } : data))
    setSave('saved')
    return true
  }, [id, s])
  const flushRef = useRef(flush)
  flushRef.current = flush
  const up = useCallback((fn: (d: MotionSettings) => MotionSettings) => {
    setS(prev => {
      if (!prev) return prev
      const next = fn(prev)
      dirty.current = true
      setSave('saving')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => { flushRef.current(next) }, 700)
      return next
    })
  }, [])
  useEffect(() => () => { if (dirty.current) flushRef.current() }, [])

  const upPhoto = (pid: string, patch: Partial<MotionPhotoSetting>) =>
    up(d => ({ ...d, photos: d.photos.map(p => (p.id === pid ? { ...p, ...patch } : p)) }))
  const movePhoto = (pid: string, dir: -1 | 1) => up(d => {
    const i = d.photos.findIndex(p => p.id === pid)
    const j = i + dir
    if (i < 0 || j < 0 || j >= d.photos.length) return d
    const photos = [...d.photos]; [photos[i], photos[j]] = [photos[j], photos[i]]
    return { ...d, photos }
  })

  // ---- polling while the AI sorts the photos, depth maps are made, or a video is being made
  const prepRunning = !!((asset?.options as any)?.prep?.running)
  const missingDepth = !!s && s.photos.some(p => !p.hidden && !p.prep_failed && !(p.clean && p.depth))
  const polling = analysis.status === 'running' || rendering || prepRunning || missingDepth
  useEffect(() => {
    if (!polling) return
    const t = setInterval(async () => {
      const { success, data } = await api.mediaLab.getAsset(id)
      if (!success || !data) return
      setAsset(data)
      const server = settingsOf(data)
      const wasRunning = prevAnalysis.current === 'running'
      const nowStatus = analysisOf(data).status
      prevAnalysis.current = nowStatus
      if (!server) return
      setS(prev => {
        if (!prev) return server
        // The pool (rooms, captions, depth files) is the server's; the agent's choices stay theirs.
        const bySrc = new Map((server.pool || []).map(it => [it.source, it]))
        const srvPhotos = new Map(server.photos.map(p => [p.source, p]))
        const photos = prev.photos.map(p => {
          const q = srvPhotos.get(p.source)
          const it = bySrc.get(p.source)
          let next = { ...p, clean: q?.clean ?? it?.clean ?? p.clean, depth: q?.depth ?? it?.depth ?? p.depth, sharp: q?.sharp ?? p.sharp, prep_failed: q?.prep_failed ?? p.prep_failed }
          if (wasRunning && nowStatus === 'done' && it?.analyzed && !p.analyzed && !p.confirmed) {
            next = { ...next, room: it.room, kind: it.kind, label: it.label, kicker: it.kicker, sure: it.sure, focusX: it.focusX, lights: it.lights, water: it.water, sky: it.sky, trees: it.trees, fire: it.fire, fireBox: it.fireBox ?? null, analyzed: true }
          }
          return next
        })
        return { ...prev, pool: server.pool, photos, copy: wasRunning && nowStatus === 'done' ? { ...prev.copy, tagline: prev.copy?.tagline || server.copy?.tagline } : prev.copy }
      })
      if (renderOf(data).state === 'done' && data.status === 'succeeded' && (renderOf(data).main ?? true)) {
        setView('video'); setVideoTab('video')
      }
    }, 2500)
    return () => clearInterval(t)
  }, [polling, id])

  // ---- the AI sorts the photos into rooms once, by itself (a few cents at most)
  const startAnalysis = useCallback(async () => {
    setError('')
    const { success, data, error: e } = await api.mediaLab.motion.analyze(id)
    if (!success || !data) { setError(e || 'We couldn\'t start looking at your photos. Try again.'); return }
    prevAnalysis.current = analysisOf(data).status
    setAsset(data)
    const srv = settingsOf(data)
    if (srv?.pool) setS(prev => (prev ? { ...prev, pool: srv.pool } : prev))
  }, [id])
  useEffect(() => {
    if (!asset || !s || analyzeKicked.current) return
    const pool = s.pool ?? s.photos
    const needs = pool.some(p => !p.analyzed)
    if (needs && analysis.status !== 'running' && analysis.status !== 'failed') {
      analyzeKicked.current = true
      startAnalysis()
    }
  }, [asset, s, analysis.status, startAnalysis])

  // ---- rooms -> photos. The first time the sorting is done, start from our suggestion.
  const sections = useMemo(() => sectionsOf(s?.pool || []), [s?.pool])
  const sorted = !!s && (s.pool ?? []).length > 0 && (s.pool ?? []).every(it => it.analyzed)
  useEffect(() => {
    if (!s || !sorted || (s.want && s.want.length) || s.photos.length) return
    const want = suggestRooms(s.pool, s.length)
    up(d => { const photos = photosForRooms(d, want, d.length); return { ...d, want: wantOf(photos, d.pool), photos } })
  }, [sorted]) // eslint-disable-line react-hooks/exhaustive-deps
  const maxShown = maxPhotosFor(s?.length)
  // Picking single photos (owner 11/13). Every change works on the latest settings (d), never on a
  // copy from an earlier render, and keeps `want` (the rooms in the video) in step for the server.
  const fullNote = () => setRoomNote(`That's the most for a ${s?.length || 30}-second video - untick a photo first, or pick a longer video.`)
  const withPhotos = (d: MotionSettings, photos: MotionPhotoSetting[]): MotionSettings => ({ ...d, photos, want: wantOf(photos, d.pool) })
  const togglePoolPhoto = (it: MotionPoolPhoto) => {
    if (!s) return
    const on = s.photos.some(p => p.source === it.source && !p.hidden)
    if (!on && visibleCount(s) >= maxShown) { fullNote(); return }
    setRoomNote('')
    up(d => {
      const isOn = d.photos.some(p => p.source === it.source && !p.hidden)
      if (!isOn && visibleCount(d) >= maxPhotosFor(d.length)) return d
      return withPhotos(d, isOn ? removePhoto(d, it.source) : addPhoto(d, it))
    })
  }
  const tapSection = (sec: PhotoSection) => {
    if (!s) return
    const n = pickedIn(s, sec).length
    if (openSec === sec.id) { setOpenSec(null); return }
    setOpenSec(sec.id)
    // A room not in the video yet starts with our pick of its photos (its best one); "Other photos"
    // just opens - those are the ones we'd leave out.
    if (n || sec.id === 'other') { setRoomNote(''); return }
    if (visibleCount(s) >= maxShown) { fullNote(); return }
    setRoomNote('')
    const best = sec.photos[0]
    up(d => (visibleCount(d) >= maxPhotosFor(d.length) || d.photos.some(p => p.source === best.source && !p.hidden) ? d : withPhotos(d, addPhoto(d, best))))
  }
  const removeSection = (sec: PhotoSection) => {
    setRoomNote('')
    const srcs = new Set(sec.photos.map(p => p.source))
    up(d => withPhotos(d, d.photos.filter(p => !srcs.has(p.source))))
    setOpenSec(null)
  }
  const setLength = (len: number) => up(d => {
    const photos = trimToCap(d, maxPhotosFor(len))
    return { ...withPhotos(d, photos), length: len }
  })

  const visible = useMemo(() => (s ? s.photos.filter(p => !p.hidden) : []), [s])
  const hiddenPhotos = useMemo(() => (s ? s.photos.filter(p => p.hidden) : []), [s])
  const needsSharpen = useMemo(() => (s ? visible.filter(p => !p.sharp).length : 0), [s, visible])


  useEffect(() => {
    if (step !== S.make && view !== 'video') return
    api.mediaLab.motion.health().then(r => { setWorkerUp(!!(r.success && r.data?.worker)); setSpeed(r.success && r.data ? r.data : null) })
  }, [step, view])
  // Launch audit 11/13: the "restarting" note said "give it a minute, then press the button", but
  // the button stayed greyed out until the page was left - look again every 15 s until it's back.
  useEffect(() => {
    if (workerUp !== false) return
    const t = setInterval(() => api.mediaLab.motion.health().then(r => {
      if (r.success && r.data?.worker) { setWorkerUp(true); setSpeed(r.data) }
    }), 15000)
    return () => clearInterval(t)
  }, [workerUp])

  const timeline = useMemo(() => (s ? buildTimeline({ ...s, photos: s.photos.map(p => ({ ...p, src: '' })) } as never) : null), [s])
  const length = timeline?.duration ?? 0
  // ---- AI usage estimate: sharpening the photos that aren't yet + making the video itself (AWS,
  // owner 11/13 - its share depends on how long the video is)
  const lengthBucket = Math.round(length / 5) * 5
  useEffect(() => {
    if (!s) return
    let alive = true
    const n = Math.max(1, needsSharpen)
    const t = setTimeout(() => api.mediaLab.motion.estimate(n, true, lengthBucket || 30).then(r => { if (alive && r.success && r.data) setEst(r.data) }), 300)
    return () => { alive = false; clearTimeout(t) }
  }, [needsSharpen, s?.sharpen, lengthBucket]) // eslint-disable-line react-hooks/exhaustive-deps
  // "To make": the video maker's measured speed + the line ahead right now (QA 11/12 - was a fixed
  // guess); the old rule of thumb only if it hasn't answered.
  const makeSecs = speed?.sec_per_frame
    ? (speed.wait_seconds || 0) + (speed.start_seconds || 15) + length * 30 * speed.sec_per_frame + (speed.save_seconds || 20)
      + (needsSharpen ? 20 : 0)
    : null
  const makeMinutes = makeSecs != null ? (makeSecs < 90 ? `~${Math.max(1, Math.round(makeSecs / 60))}m` : `~${Math.round(makeSecs / 60)}m`) : `~${Math.max(2, Math.round(length / 6))}m`
  const sit = situationPreset(s?.situation)
  // Uploads have no listing address: ask for it on "What's it for?" (stays shown once typed, so the
  // box doesn't vanish mid-word; a listing's own address is already filled in)
  const needsAddress = !!s && (asset?.source_kind === 'upload' || !asset?.linked_property)
  const allConfirmed = visible.length > 0 && visible.every(p => p.confirmed)
  const analyzing = analysis.status === 'running'
  const analysisDone = s ? (s.pool ?? s.photos).every(p => p.analyzed) : false
  const opts = (asset?.options || {}) as Record<string, any>
  const changesPending = asset?.status === 'succeeded' && (save !== 'saved' || (opts.current_hash && opts.rendered_hash && opts.current_hash !== opts.rendered_hash))

  const canNext = (k: number) => {
    if (!s) return false
    if (k === S.rooms) return analysisDone && visible.length >= 2
    if (k === S.check) return visible.length >= 2 && allConfirmed
    if (k === S.situation) {
      if (needsAddress && !(s.facts.address || '').trim()) return false
      if (sit.needs === 'when') return !!(s.facts.when || '').trim()
      if (s.situation === 'custom') return !!(s.copy.title || '').trim()
      return true
    }
    return true
  }
  const nextBlockedReason = (k: number) => {
    if (!s) return ''
    if (k === S.rooms) {
      if (!analysisDone) return 'Sorting your photos into rooms…'
      if (visible.length < 2) return 'Pick at least 2 photos'
    }
    if (k === S.check) {
      if (visible.length < 2) return 'Keep at least 2 photos'
      if (!allConfirmed) return `${visible.filter(p => p.confirmed).length} of ${visible.length} checked`
    }
    if (k === S.situation && needsAddress && !(s.facts.address || '').trim()) return 'Add the address'
    if (k === S.situation && sit.needs === 'when' && !(s.facts.when || '').trim()) return 'Add the open house day and time'
    if (k === S.situation && s.situation === 'custom' && !(s.copy.title || '').trim()) return 'Add your title'
    return ''
  }
  const goStep = (k: number) => {
    const to = Math.max(0, Math.min(STEPS.length - 1, k))
    if (to === S.check && s) {
      const first = s.photos.filter(p => !p.hidden).findIndex(p => !p.confirmed)
      setCheckAt(Math.max(0, first))
    }
    setStep(to)
    try { window.localStorage.setItem(`ohp-cine-step:${id}`, String(to)) } catch { /* private mode */ }
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // ---- make the video
  const make = async (format?: MotionFormat) => {
    if (!s) return
    setError(''); setBusy(format ? `fmt-${format}` : 'make')
    if (!(await flush())) { setBusy(null); setError('Your latest changes didn\'t save - check your connection and try again.'); return }
    const { success, data, error: e } = await api.mediaLab.motion.render(id, format ? { format } : { sharpen: true })
    setBusy(null)
    if (!success || !data) { setError(e || 'We couldn\'t start your video. Try again in a moment.'); return }
    setAsset(data)
    // The first make shows its progress on the Make step; updates stay on the finished video.
    if (!format && !asset?.result_url) { setView('steps'); setStep(S.make) }
    if (!format && asset?.result_url) { setView('video'); setVideoTab('video') }
  }

  const download = async (fmt: MotionFormat) => {
    if (!asset) return
    setDownloading(fmt); setError('')
    const { success, blob } = await api.mediaLab.download(asset.id, fmt)
    setDownloading(null)
    if (!success || !blob) { setError('Download failed. Try again in a moment.'); return }
    const name = (s?.facts.address || 'cinematic-video').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    await saveFile(blob, `${name}-${FORMAT_SIZE[fmt].label.toLowerCase()}.mp4`)
  }

  if (loadError) {
    return (
      <div className={`flex ${embedded ? 'min-h-[10rem]' : 'min-h-[60vh]'} flex-col items-center justify-center gap-3 p-6 text-center`}>
        <p className="font-serif text-xl font-black text-[#111827] dark:text-white">{loadError}</p>
        <Link href="/studio/media" className={`text-sm font-black ${gold}`}>Back to your projects</Link>
      </div>
    )
  }
  if (!asset || !s) {
    // Inside the chat: a small placeholder, not most of the screen (owner 11/13)
    return embedded
      ? <div className="flex h-40 items-center justify-center rounded-2xl bg-[#faf9f7] dark:bg-[#0B0B0B]"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
      : <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  }

  const title = s.facts.address || 'Cinematic Video'
  const p = render.progress || 0
  const ahead = render.state === 'queued' ? render.ahead || 0 : 0
  const usedPct = budget && asset.cost_usd ? (asset.cost_usd / budget) * 100 : null
  const sharpenPct = est?.sharpen_percent != null && est.photos ? (est.sharpen_percent * needsSharpen) / est.photos : null

  // Where the live preview sits: beside the options (left) on a wide space - the full page AND a wide
  // chat (owner 11/13: in the chat on a big screen the preview was huge and on top). Narrow spaces
  // (phones, the narrow chat panel) stack it on top, kept short.
  const tall = TALL.includes(s.format)
  // The check step shows each photo big, and while the video is being made the making screen
  // takes over - no preview on either.
  const showPreview = step !== S.check && !(step === S.make && rendering)
  const sidePreview = wide && showPreview
  const previewMaxH = wide ? (tall ? (embedded ? '62vh' : '74vh') : '60vh') : tall ? '52vh' : '40vh'
  // The options' own width (beside a side preview, it's what's left) decides how many columns fit.
  const sideW = embedded ? 300 : 360
  const pad = 24 + (embedded ? 24 : 32)
  const optionsW = sidePreview ? (tall ? width - sideW - pad : (width - pad) / 2.1) : width

  // ================================================================ step contents
  const want = s.want || []
  const shownCount = visible.length
  // "What to show": room cards in rows; the open room's photo strip goes right under its row.
  const secCols = optionsW >= 520 ? 3 : 2
  const thumbCols = optionsW >= 520 ? 4 : 3
  const openIdx = sections.findIndex(x => x.id === openSec)
  const openSection = openIdx >= 0 ? sections[openIdx] : null
  const panelAfter = openIdx >= 0 ? Math.min(sections.length - 1, Math.floor(openIdx / secCols) * secCols + secCols - 1) : -1
  const poolCount = (s.pool ?? s.photos).length
  // Each length's share of THIS agent's monthly AI (owner 11/13): making it (AWS, per second of video)
  // + the photo prep still to do. From the agent's own allowance, so it differs by plan.
  const perSecPct = est?.render_paid && est.render_percent != null ? est.render_percent / Math.max(5, lengthBucket || 30) : null
  const prepPct = (needsSharpen > 0 && !est?.sharpen_paused && est?.sharpen_percent != null && est.photos ? (est.sharpen_percent * needsSharpen) / est.photos : 0)
  const setupStep = (
    <div className="space-y-4">
      <Card>
        <CardTitle title="How long?" sub="The length decides how many photos fit - shorter is punchier" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {LENGTH_OPTIONS.map(o => (
            <Pick key={o.seconds} active={(s.length || 30) === o.seconds} onClick={() => setLength(o.seconds)} className="items-center px-3 pb-3 pt-6 text-center"
              badge={o.seconds === 30 ? 'Popular' : undefined}>
              <p className="font-serif text-3xl font-black leading-none text-[#111827] dark:text-white">{o.seconds}<span className="ml-0.5 text-sm font-black text-gray-400">sec</span></p>
              <p className="mt-1.5 text-[10.5px] font-semibold leading-tight text-gray-500">{o.hint}</p>
              {perSecPct != null && <p className="mt-1.5 text-[10px] font-black leading-tight text-[#8b7355] dark:text-[#d7b974]">{aboutPct(perSecPct * o.seconds + prepPct)} of your monthly AI</p>}
            </Pick>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle title="Shape" sub="Where you'll post it first - you can add the other shapes once it's made" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {FORMAT_INFO.map(f => (
            <Pick key={f.id} active={s.format === f.id} onClick={() => up(d => ({ ...d, format: f.id }))} className="items-center p-3 text-center">
              <span className="mb-2 flex h-12 items-center justify-center">
                <span className="rounded-[5px] border-2 border-[#111827]/70 dark:border-white/70" style={{ width: 12 * Math.sqrt(FORMAT_SIZE[f.id].w / FORMAT_SIZE[f.id].h) * 2.6, height: 12 * Math.sqrt(FORMAT_SIZE[f.id].h / FORMAT_SIZE[f.id].w) * 2.6 }} />
              </span>
              <p className="text-xs font-black text-[#111827] dark:text-white">{f.label}</p>
              <p className="text-[10px] font-semibold leading-tight text-gray-500">{f.where}</p>
            </Pick>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold text-gray-400">Every other shape is made fresh for its screen later (nothing gets cut off) - a few minutes each{est?.render_paid ? ', each a small share of your monthly AI' : ', no AI usage'}.</p>
      </Card>
    </div>
  )

  const roomsStep = (
    <div className="space-y-4">
      {!analysisDone && analysis.status !== 'failed' && (
        <Card className="ohp-reveal overflow-hidden">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#e0b85f] text-[#111827]"><Wand2 className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-black text-[#111827] dark:text-white">Sorting your photos into rooms</p>
              <p className="text-xs font-semibold text-gray-500">Looking at all {poolCount} photos - which room each one is, and which look best…</p>
            </div>
          </div>
          <div className="mt-3"><ProgressBar value={analyzing ? 0.7 : 0.15} /></div>
          <p className="mt-2 text-[11px] font-semibold text-gray-400">Usually 15-40 seconds, once per project - less than 1% of your monthly AI. Your project is saved - you can leave and come back.</p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-100 dark:bg-white/[0.05]" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
        </Card>
      )}
      {analysis.status === 'failed' && (
        <Card className="border-red-200 dark:border-red-900/50">
          <p className="text-sm font-black text-red-700 dark:text-red-300">{analysis.error || 'We couldn\'t look at those photos just now.'}</p>
          <button type="button" onClick={() => { analyzeKicked.current = true; startAnalysis() }} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </Card>
      )}
      {analysisDone && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/[0.07] px-4 py-3">
            <p className="text-xs font-bold text-[#6b5a3f] dark:text-[#e8d5a8]" data-testid="cine-picked-count">
              <span className="font-black">{shownCount} of {maxShown} photos</span> picked for a {s.length || 30}-second video{want.length ? ` · ${want.length} room${want.length === 1 ? '' : 's'}` : ''}
            </p>
            <button type="button" onClick={() => {
              setRoomNote(''); setOpenSec(null)
              up(d => withPhotos(d, photosForRooms({ ...d, photos: [] }, suggestRooms(d.pool, d.length), d.length)))
            }}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#111827] shadow-sm hover:-translate-y-0.5 dark:bg-white/10 dark:text-white">
              <Shuffle className="h-3.5 w-3.5 text-[#C9A24D]" /> Our pick
            </button>
          </div>
          <AnimatePresence>
            {roomNote && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{roomNote}</motion.p>
            )}
          </AnimatePresence>
          {sections.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-xs font-bold text-gray-400 dark:border-gray-700">We couldn&apos;t sort these photos into rooms. Add photos below to keep going.</p>
          ) : (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${secCols}, minmax(0, 1fr))` }}>
              {sections.map((sec, i) => {
                const picked = pickedIn(s, sec)
                const n = picked.length
                const coverPh = picked[0] || sec.photos[0]
                const isOpen = openSec === sec.id
                return [
                  <Pick key={sec.id} active={n > 0} onClick={() => tapSection(sec)} expanded={isOpen} testId={`cine-sec-${sec.id}`}
                    className={`ohp-reveal ${isOpen ? 'ring-4 ring-[#C9A24D]/25' : ''}`}>
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
                      <img src={thumbOf(coverPh.clean || coverPh.source) || ''} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <span className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-black ${n ? 'bg-[#C9A24D] text-[#111827]' : 'bg-black/60 text-white'}`}>
                        {n ? `${n} of ${sec.photos.length} picked` : `${sec.photos.length} photo${sec.photos.length === 1 ? '' : 's'}`}
                      </span>
                    </div>
                    <span className="flex items-center justify-between gap-1 px-3 py-2.5">
                      <span className="min-w-0 truncate text-xs font-black text-[#111827] dark:text-white">{sec.label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#C9A24D]' : ''}`} />
                    </span>
                  </Pick>,
                  i === panelAfter && openSection && (
                    <SectionPanel key={`panel-${openSection.id}`} sec={openSection} s={s} cols={thumbCols} full={shownCount >= maxShown} maxShown={maxShown}
                      related={(RELATED[openSection.id] || []).map(id => sections.find(x => x.id === id)).filter((x): x is PhotoSection => !!x)}
                      onToggle={togglePoolPhoto} onDone={() => setOpenSec(null)} onRemove={() => removeSection(openSection)} onAdd={() => setAddOpen(true)}
                      onOpen={id => { setRoomNote(''); setOpenSec(id); requestAnimationFrame(() => document.querySelector(`[data-testid="cine-sec-${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })) }} />
                  ),
                ]
              })}
            </div>
          )}
          <button type="button" onClick={() => setAddOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-3.5 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/5 hover:text-[#8b7355] dark:border-gray-700">
            <ImagePlus className="h-4 w-4" /> Don&apos;t see something? Add photos
          </button>
          <p className="text-[11px] font-semibold text-gray-400">We tick the best photo of each room to start. Tap a room to see all its photos and tick the ones you want - up to {maxShown} for {s.length || 30} seconds. You&apos;ll check each caption next.</p>
        </>
      )}
    </div>
  )

  const ci = Math.min(checkAt, Math.max(0, visible.length - 1))
  const cur = visible[ci]
  const choice = cur ? cycleChoice(s, cur) : { next: null, at: 0, total: 0 }
  const confirmCur = () => {
    if (!cur) return
    upPhoto(cur.id, { confirmed: true })
    const after = visible.map(p => (p.id === cur.id ? { ...p, confirmed: true } : p))
    const nxt = after.findIndex((p, j) => j > ci && !p.confirmed)
    const first = after.findIndex(p => !p.confirmed)
    setCheckAt(nxt >= 0 ? nxt : first >= 0 ? first : ci)
  }
  const checkStep = !cur ? (
    <Card><p className="text-sm font-bold text-gray-500">Pick what to show first.</p></Card>
  ) : (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {visible.map((ph, i) => (
          <button key={ph.id} type="button" onClick={() => setCheckAt(i)} aria-label={`Photo ${i + 1}`}
            className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === ci ? 'border-[#C9A24D] shadow-[0_0_18px_-6px_rgba(201,162,77,0.9)]' : 'border-transparent opacity-80 hover:opacity-100'}`}>
            <img src={thumbOf(ph.clean || ph.source) || ''} alt="" loading="lazy" className="h-full w-full object-cover" />
            {ph.confirmed
              ? <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>
              : <span className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] font-black text-white">{i + 1}</span>}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={cur.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.2 }}>
          <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-[#151517] ${cur.confirmed ? 'border-emerald-300/70 dark:border-emerald-800/60' : !cur.sure ? 'border-amber-300 dark:border-amber-700/60' : 'border-gray-200 dark:border-gray-800'}`}>
            <div className="relative mx-auto w-full overflow-hidden bg-gray-100 dark:bg-gray-800" style={{ aspectRatio: '3 / 2', maxWidth: embedded ? 'calc(40vh * 1.5)' : 'calc(50vh * 1.5)' /* smaller inside the chat */ }}>
              {/* Until its clean copy is made, hide the MLS badge strip the video crops off anyway. */}
              <img src={sized(cur.clean || cur.source, 1080, 80) || ''} alt="" className="w-full object-cover object-top" style={{ height: cur.clean || asset.source_kind === 'upload' ? '100%' : '108.2%' }} />
              <span className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">Photo {ci + 1} of {visible.length}</span>
              <div className="absolute bottom-3 left-3 right-3 flex justify-between">
                <button type="button" aria-label="Previous photo" onClick={() => setCheckAt(Math.max(0, ci - 1))} disabled={ci === 0} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-0"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" aria-label="Next photo" onClick={() => setCheckAt(Math.min(visible.length - 1, ci + 1))} disabled={ci >= visible.length - 1} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-0"><ChevronRight className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="font-serif text-lg font-black text-[#111827] dark:text-white">
                  {cur.confirmed ? 'Checked' : roomOption(cur.room)?.one ? `Is this ${roomOption(cur.room)!.one}?` : 'Is this caption right?'}
                </p>
                {!cur.sure && !cur.confirmed && <p className="mt-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">We weren&apos;t sure about this one - take a close look.</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={confirmCur}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827] sm:flex-none">
                  <Check className="h-4 w-4 text-[#C9A24D]" strokeWidth={3} /> {cur.confirmed ? 'Looks right' : 'Yes, looks right'}
                </button>
                <button type="button" disabled={!choice.next} data-testid="cine-try-another"
                  onClick={() => up(d => {
                    // from the latest settings, so quick taps keep walking forward through the room
                    const now = d.photos.find(p => p.id === cur.id)
                    const c = now ? cycleChoice(d, now) : null
                    return now && c?.next ? withPhotos(d, swapPhoto(d, now.id, c.next)) : d
                  })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-3 text-xs font-black text-gray-700 transition hover:border-[#C9A24D] disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">
                  <Shuffle className="h-3.5 w-3.5" /> Try another
                  {choice.total > 1 && choice.at > 0 && <span className="font-bold tabular-nums text-gray-400">{choice.at} of {choice.total}</span>}
                </button>
                <button type="button" disabled={visible.length <= 2} onClick={() => { upPhoto(cur.id, { hidden: true }); setCheckAt(Math.max(0, Math.min(ci, visible.length - 2))) }}
                  title={visible.length <= 2 ? 'A video needs at least 2 photos' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-3 text-xs font-black text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-900/20">
                  <X className="h-3.5 w-3.5" /> Take it out
                </button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)]">
                <Field label="Caption on the video" value={cur.label} maxLength={48} placeholder={kindLabel(cur.kind).label} onChange={v => upPhoto(cur.id, { label: v })} />
                <Field label="Small line above" value={cur.kicker} maxLength={28} placeholder="Optional" onChange={v => upPhoto(cur.id, { kicker: v })} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                <label className="inline-flex items-center gap-2 text-[11px] font-bold text-gray-500">
                  <Switch on={cur.showLabel} label="Show the caption" onChange={v => upPhoto(cur.id, { showLabel: v })} /> Show the caption
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                  Wrong room?
                  <select value={cur.kind} onChange={e => { const k = e.target.value as PhotoKind; upPhoto(cur.id, { kind: k, kicker: kindLabel(k).kicker, label: cur.label || kindLabel(k).label }) }}
                    className="rounded-lg border border-gray-200 bg-white py-1 pl-2 pr-7 text-[11px] font-black text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white">
                    {KIND_LABELS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
      {allConfirmed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-900/15">
          <p className="text-xs font-black text-emerald-800 dark:text-emerald-200">Every photo checked - nice.</p>
          <button type="button" onClick={() => goStep(S.situation)} className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-3.5 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">Next: {STEPS[S.situation].title} <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button type="button" onClick={() => up(d => ({ ...d, photos: d.photos.map(p => (p.hidden ? p : { ...p, confirmed: true })) }))}
          className="text-[11px] font-black text-gray-400 underline-offset-2 hover:text-[#8b7355] hover:underline">
          They all look right - skip ahead
        </button>
      )}
    </div>
  )

  const situationStep = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {SITUATION_PRESETS.map(sp => (
          <Pick key={sp.id} active={s.situation === sp.id} onClick={() => up(d => ({ ...d, situation: sp.id }))} className="p-4">
            <p className="pr-7 font-serif text-base font-black text-[#111827] dark:text-white">{sp.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{sp.blurb}</p>
            <p className={`mt-2.5 text-[10.5px] font-black uppercase tracking-[0.14em] ${gold}`}>
              Ends with: <span className="normal-case tracking-normal">{sp.endKicker} · {sp.endBig(s.facts)}</span>
            </p>
          </Pick>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {(sit.needs || s.situation === 'custom') && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card>
              {sit.needs === 'when' && <Field label="Open house day & time" value={s.facts.when || ''} placeholder="Sat, Nov 15 · 1-3 PM" onChange={v => up(d => ({ ...d, facts: { ...d.facts, when: v } }))} />}
              {sit.needs === 'was' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Old price (crossed out)" value={s.facts.wasPrice || ''} placeholder="$3,450,000" onChange={v => up(d => ({ ...d, facts: { ...d.facts, wasPrice: v } }))} />
                  <Field label="New price" value={s.facts.price || ''} placeholder="$3,199,000" onChange={v => up(d => ({ ...d, facts: { ...d.facts, price: v } }))} />
                </div>
              )}
              {s.situation === 'custom' && <Field label="Your title" value={s.copy.title || ''} placeholder="Featured property" onChange={v => up(d => ({ ...d, copy: { ...d.copy, title: v } }))} />}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {needsAddress && (
        // Uploaded photos come with no address - ask here so the video never opens on "Your listing" (QA 11/12)
        <Card>
          <CardTitle title="The home" sub="Shown in the opening title and on the closing card" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address" value={s.facts.address || ''} placeholder="18 Willow Bend Ct" onChange={v => up(d => ({ ...d, facts: { ...d.facts, address: v } }))} />
            <Field label="Town" value={s.facts.cityLine || ''} placeholder="Media, PA" onChange={v => up(d => ({ ...d, facts: { ...d.facts, cityLine: v } }))} />
            <Field label="Price (optional)" value={s.facts.price || ''} placeholder="$849,000" onChange={v => up(d => ({ ...d, facts: { ...d.facts, price: v } }))} />
          </div>
        </Card>
      )}
      <p className="text-[11px] font-semibold text-gray-400">This sets the opening words and the closing card for you - you can change any of it in Words &amp; details.</p>
    </div>
  )

  const lookStep = (
    <div className="space-y-4">
      <Card>
        <CardTitle title="Theme" sub="The type and colors on your video" />
        <div className="grid grid-cols-2 gap-3">
          {(['classic', 'luxe'] as const).map(th => (
            <Pick key={th} active={s.theme === th} onClick={() => up(d => ({ ...d, theme: th }))}>
              <ThemeMini theme={th} accent={s.accent} metal={s.metal} address={s.facts.address || '847 Lesley Road'} kicker={s.copy.kicker || sit.kicker} luxeKicker={s.copy.kicker || sit.luxeKicker} className="aspect-video w-full" />
              <div className="p-3">
                <p className="font-serif text-sm font-black text-[#111827] dark:text-white">{th === 'classic' ? 'Default' : 'Luxe'}</p>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{th === 'classic' ? 'Ivory type with your accent color' : 'Black, ivory and metal'}</p>
              </div>
            </Pick>
          ))}
        </div>
        <div className="mt-4">
          <span className={labelCls}>{s.theme === 'luxe' ? 'Metal' : 'Accent color'}</span>
          {s.theme === 'luxe' ? (
            <div className="flex flex-wrap gap-2">
              {LUXE_METAL_ORDER.map(m => (
                <button key={m} type="button" onClick={() => up(d => ({ ...d, metal: m }))}
                  className={`inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-xs font-black transition ${s.metal === m ? 'border-[#C9A24D] text-[#111827] dark:text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700'}`}>
                  <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, ${LUXE_METALS[m].light}, ${LUXE_METALS[m].base} 55%, ${LUXE_METALS[m].deep})` }} />
                  {LUXE_METALS[m].label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {SIGNATURE_COLORS.map(c => (
                <button key={c.color} type="button" title={c.label} aria-label={c.label} onClick={() => up(d => ({ ...d, accent: c.color }))}
                  className={`relative h-8 w-8 rounded-full border-2 transition hover:scale-110 ${s.accent === c.color ? 'border-[#111827] dark:border-white' : 'border-white shadow dark:border-white/30'}`} style={{ background: c.color }}>
                  {s.accent === c.color && <Check className="absolute inset-0 m-auto h-4 w-4 text-white" strokeWidth={3.5} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
      <Card>
        <CardTitle title="Animation style" sub="How the camera moves and how quickly rooms change"
          right={<button type="button" onClick={() => setExampleOpen(true)} className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-black ${gold} hover:underline`}><Play className="h-3.5 w-3.5" /> See an example</button>} />
        <div className="grid gap-3 sm:grid-cols-3">
          {STYLE_PRESETS.map(st => (
            <Pick key={st.id} active={s.style === st.id} badge={st.id === 'cinematic' ? 'Recommended' : 'Coming soon'} disabled={st.id !== 'cinematic' && s.style !== st.id}
              onClick={() => up(d => ({ ...d, style: st.id, transition: transitionTouched.current ? d.transition : st.defaultTransition }))}>
              <StyleMini id={st.id} className="aspect-video w-full" />
              <div className="p-3">
                <p className="font-serif text-sm font-black text-[#111827] dark:text-white">{st.label}</p>
                <p className="text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{st.blurb}</p>
              </div>
            </Pick>
          ))}
        </div>
      </Card>
    </div>
  )

  const flowStep = (
    <div className="space-y-4">
      <Card>
        <CardTitle title="Transition between rooms" sub="Used everywhere - you can change single ones below" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TRANSITION_PRESETS.map(tp => (
            <Pick key={tp.id} active={s.transition === tp.id} badge={tp.id === stylePreset(s.style).defaultTransition ? 'Recommended' : undefined}
              onClick={() => { transitionTouched.current = true; up(d => ({ ...d, transition: tp.id })) }}>
              <TransitionMini id={tp.id} className="aspect-video w-full" />
              <div className="p-2.5">
                <p className="text-xs font-black text-[#111827] dark:text-white">{tp.label}</p>
                <p className="line-clamp-2 text-[10.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{tp.blurb}</p>
              </div>
            </Pick>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle title="Your video, in order" sub="Move rooms, pick a camera move, or change a single transition" />
        <Timeline s={s} onMove={movePhoto} onPhoto={upPhoto} gapFor={gapFor} setGapFor={setGapFor} />
      </Card>
    </div>
  )

  const detailsStep = (
    <div className="space-y-4">
      <Card>
        <CardTitle title="Opening title" sub="Over the first shot" right={<Switch on={s.sections.opening} label="Opening title" onChange={v => up(d => ({ ...d, sections: { ...d.sections, opening: v } }))} />} />
        {s.sections.opening && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Small line" value={s.copy.kicker || ''} placeholder={s.theme === 'luxe' ? sit.luxeKicker : sit.kicker} onChange={v => up(d => ({ ...d, copy: { ...d.copy, kicker: v } }))} maxLength={40} />
            <Field label="Opening line" value={s.copy.tagline || ''} placeholder="Some homes simply have a soul" onChange={v => up(d => ({ ...d, copy: { ...d.copy, tagline: v } }))} maxLength={60} />
          </div>
        )}
      </Card>
      <Card>
        <CardTitle title="The home" sub="Used in the opening, the stats and the closing card" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Address" value={s.facts.address} onChange={v => up(d => ({ ...d, facts: { ...d.facts, address: v } }))} />
          <Field label="Town" value={s.facts.cityLine} onChange={v => up(d => ({ ...d, facts: { ...d.facts, cityLine: v } }))} />
          <Field label={s.situation === 'price_improved' ? 'New price' : 'Price'} value={s.facts.price || ''} placeholder="$1,250,000" onChange={v => up(d => ({ ...d, facts: { ...d.facts, price: v } }))} />
          {s.situation === 'price_improved' && <Field label="Old price" value={s.facts.wasPrice || ''} onChange={v => up(d => ({ ...d, facts: { ...d.facts, wasPrice: v } }))} />}
          {s.situation === 'open_house' && <Field label="Open house day & time" value={s.facts.when || ''} onChange={v => up(d => ({ ...d, facts: { ...d.facts, when: v } }))} />}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-[#111827] dark:text-white">Beds, baths &amp; size near the end</p>
          <Switch on={s.sections.stats} label="Stats" onChange={v => up(d => ({ ...d, sections: { ...d.sections, stats: v } }))} />
        </div>
        {s.sections.stats && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Beds" value={s.facts.beds || ''} onChange={v => up(d => ({ ...d, facts: { ...d.facts, beds: v } }))} maxLength={6} />
            <Field label="Baths" value={s.facts.baths || ''} onChange={v => up(d => ({ ...d, facts: { ...d.facts, baths: v } }))} maxLength={6} />
            <Field label="Sq ft" value={s.facts.sqft || ''} onChange={v => up(d => ({ ...d, facts: { ...d.facts, sqft: v } }))} maxLength={8} />
            <Field label="Acres" value={s.facts.acres || ''} onChange={v => up(d => ({ ...d, facts: { ...d.facts, acres: v } }))} maxLength={6} />
          </div>
        )}
      </Card>
      <Card>
        <CardTitle title="Room captions" sub="The label on each photo (you checked them in Check each photo)" right={<Switch on={s.sections.labels} label="Room captions" onChange={v => up(d => ({ ...d, sections: { ...d.sections, labels: v } }))} />} />
      </Card>
      <Card>
        <CardTitle title="Closing card" sub={`${sit.endKicker} · ${sit.endBig(s.facts)}`} right={<Switch on={s.sections.endCard} label="Closing card" onChange={v => up(d => ({ ...d, sections: { ...d.sections, endCard: v } }))} />} />
        {s.sections.endCard && (
          <Field label="Call to action" value={s.copy.cta || ''} placeholder={sit.cta} onChange={v => up(d => ({ ...d, copy: { ...d.copy, cta: v } }))} maxLength={60} />
        )}
        {s.facts.courtesy && (
          <div className="mt-3">
            <Field label="Listing credit (MLS rules: keep it when it isn't your listing)" value={s.facts.courtesy} onChange={v => up(d => ({ ...d, facts: { ...d.facts, courtesy: v } }))} maxLength={90} />
          </div>
        )}
      </Card>
      <Card>
        <CardTitle title="Your branding" sub="Your photo, name, brokerage, phone and email - like the top of your sign-in sheet" />
        <Seg id="agentseg" value={s.sections.agent} onChange={v => up(d => ({ ...d, sections: { ...d.sections, agent: v } }))}
          options={[{ id: 'off', label: 'Off' }, { id: 'opening', label: 'Opening only' }, { id: 'always', label: 'Whole video' }]} />
        <div className="mt-3 flex items-center gap-3">
          {s.agent.photo
            ? <img src={proxied(s.agent.photo) || ''} alt="" className="h-12 w-12 shrink-0 rounded-full border-2 border-[#C9A24D] object-cover" />
            : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-sm font-black text-[#111827]">{(s.agent.name || 'You').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>}
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <input className={inputCls} value={s.agent.name || ''} placeholder="Your name" maxLength={60} onChange={e => up(d => ({ ...d, agent: { ...d.agent, name: e.target.value } }))} />
            <input className={inputCls} value={s.agent.brokerage || ''} placeholder="Brokerage" maxLength={80} onChange={e => up(d => ({ ...d, agent: { ...d.agent, brokerage: e.target.value } }))} />
            <input className={inputCls} value={s.agent.phone || ''} placeholder="Phone" maxLength={30} onChange={e => up(d => ({ ...d, agent: { ...d.agent, phone: e.target.value } }))} />
            <input className={inputCls} value={s.agent.email || ''} placeholder="Email" type="email" maxLength={80} onChange={e => up(d => ({ ...d, agent: { ...d.agent, email: e.target.value } }))} />
          </div>
        </div>
      </Card>
      <Card>
        <CardTitle title="Music" sub="Written for OpenHousePal - safe to post anywhere" />
        <MusicPicker value={s.music} onChange={v => up(d => ({ ...d, music: v }))} />
      </Card>
    </div>
  )

  // The home's own photos behind the making screen. 11/13 fix: they asked /pimg for width 720 at
  // quality 65 - neither is a size next.config.js allows, so every photo came back an error (the
  // broken-image icon top-left). 750 / 70 are allowed sizes.
  const makingPhotos = visible.map(ph => sized(ph.clean || ph.source, 750, 70) || '').filter(Boolean)
  const target = (render.target as MotionSettings['format']) || s.format
  const making = (
    <MakingCard photos={makingPhotos} embedded={embedded}
      aspect={FORMAT_SIZE[target].w / FORMAT_SIZE[target].h}
      title={render.main === false ? `Making the ${FORMAT_SIZE[target].label.toLowerCase()} version` : asset.result_url ? 'Updating your video' : 'Making your video'}
      stage={render.stage || 'Starting the cameras'} pct={p} etaAt={render.eta_at} startedAt={render.started_at} ahead={ahead} />
  )
  const makeStep = rendering ? making : (
    <div className="space-y-4">
      {render.state === 'failed' && asset.status !== 'succeeded' ? (
        <Card className="ohp-reveal">
          <p className="text-sm font-black text-red-700 dark:text-red-300">{render.error || 'The video couldn\'t be finished.'}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">Nothing was charged for the failed part. Your settings are saved.</p>
        </Card>
      ) : null}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06]">
            <span className="rounded-[4px] border-2 border-[#111827]/70 dark:border-white/70" style={{ width: 9 * Math.sqrt(FORMAT_SIZE[s.format].w / FORMAT_SIZE[s.format].h) * 2.4, height: 9 * Math.sqrt(FORMAT_SIZE[s.format].h / FORMAT_SIZE[s.format].w) * 2.4 }} />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-base font-black text-[#111827] dark:text-white">{FORMAT_SIZE[s.format].label} · {s.length || 30} seconds</p>
            <p className="truncate text-xs font-semibold text-gray-500">{FORMAT_INFO.find(f => f.id === s.format)?.where}</p>
          </div>
        </div>
        <button type="button" onClick={() => goStep(S.setup)} className={`text-[11px] font-black ${gold} hover:underline`}>Change</button>
      </Card>
      {/* Owner 11/12: photos are always sharpened (no switch) - a fraction of a cent each, once. */}
      <Card className="bg-gradient-to-br from-[#C9A24D]/[0.08] via-white to-white dark:via-[#151517] dark:to-[#151517]">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="font-serif text-2xl font-black text-[#111827] dark:text-white">{visible.length}</p><p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Photos</p></div>
          <div><p className="font-serif text-2xl font-black text-[#111827] dark:text-white">{Math.round(length)}s</p><p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Long</p></div>
          <div><p className="font-serif text-2xl font-black text-[#111827] dark:text-white">{makeMinutes}</p><p className="text-[10px] font-black uppercase tracking-wider text-gray-400">To make</p></div>
        </div>
        <div className="mt-4 space-y-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} /> Rooms sorted &amp; captions written: done{usedPct != null ? ` (${aboutPct(usedPct)} of your monthly AI)` : ''}</p>
          <p className="flex items-center gap-2">
            {missingDepth ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A24D]" /> : <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} />}
            3D depth for each photo: {missingDepth ? 'getting ready (free)' : 'ready (free)'}
          </p>
          <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={3} /> {est?.render_paid ? `Making the video: ${aboutPct(est.render_percent)} of your monthly AI (each update or extra shape is made again)` : 'Making the video itself uses no AI - edits and remakes are free'}</p>
          {!!speed?.busy && (
            <p className="flex items-center gap-2"><Clapperboard className="h-3.5 w-3.5 text-[#C9A24D]" />
              {`${(speed.queued || 0) + 1} ${(speed.queued || 0) + 1 === 1 ? 'video' : 'videos'} ahead of yours in line right now - that's included in the time`}</p>
          )}
          <p className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" />
            {needsSharpen === 0 ? 'Photos sharpened with AI: done' : (est?.sharpen_paused || est?.soft_capped) ? 'Photos sharpened with AI: paused (your AI limit is reached for now)' : `Every photo sharpened with AI for crisper detail: ${aboutPct(sharpenPct)} of your monthly AI`}
          </p>
        </div>
        <MonthlyAiUsageMeter variant="inline" compact stretch className="mt-4" />
      </Card>
      {workerUp === false && <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">The video maker is restarting - give it a minute. The button turns back on by itself.</p>}
      {est?.render_paid && est?.render_paused && <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">You&apos;ve reached your AI limit for now, so new videos can&apos;t be made until it resets. Your finished videos still play and save.</p>}
      {!est?.render_paid && (est?.sharpen_paused || est?.soft_capped) && needsSharpen > 0 && <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">You&apos;ve reached your AI limit for now, so this video is made without the extra sharpening. It still looks great, and you can update it later to add it.</p>}
      <div className={embedded ? '' : 'hidden sm:block'}>
        <button type="button" onClick={() => make()} disabled={!!busy || rendering || workerUp === false || !!(est?.render_paid && est?.render_paused)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#111827] to-[#2a2a2e] px-6 py-4 text-base font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-50 dark:from-white dark:to-gray-200 dark:text-[#111827]">
          {busy === 'make' || rendering ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clapperboard className="h-5 w-5 text-[#C9A24D]" />}
          {rendering ? 'Making your video…' : asset.result_url ? 'Update my video' : 'Make my video'}
        </button>
      </div>
    </div>
  )

  const stepBodies = [setupStep, roomsStep, checkStep, situationStep, lookStep, flowStep, detailsStep, makeStep]

  // ================================================================ the finished video
  const videoView = (
    <div className={`grid gap-5 ${wide ? (tall ? 'grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-[minmax(0,1fr)_380px]') : 'grid-cols-1'}`}>
      <div className="min-w-0 space-y-3">
        <div className="ohp-reveal mb-1">
          <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${gold}`}>{rendering ? 'Updating' : 'Your video is ready'}</p>
          <h1 className="font-serif text-2xl font-black text-[#111827] dark:text-white sm:text-3xl">{sit.label} · {s.facts.address || 'Cinematic Video'}</h1>
          <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {Math.round(Number(opts.duration_seconds) || length)} sec · {visible.length} photos · {s.theme === 'luxe' ? `Luxe ${s.metal}` : 'Default'} · {stylePreset(s.style).label} · {transitionPreset(s.transition).label}
          </p>
        </div>
        {changesPending && (
          <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
            {(['video', 'preview'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setVideoTab(tab)}
                className={`relative flex-1 rounded-lg py-2 text-xs font-black ${videoTab === tab ? 'text-[#111827] dark:text-white' : 'text-gray-500'}`}>
                {videoTab === tab && <motion.span layoutId="vtab" className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-white/10" />}
                <span className="relative">{tab === 'video' ? 'Your video' : 'Preview your changes'}</span>
              </button>
            ))}
          </div>
        )}
        {videoTab === 'preview' && changesPending
          ? <LivePreview settings={s} autoPlay />
          : (
            <div className="overflow-hidden rounded-2xl bg-black shadow-xl" style={{ aspectRatio: `${FORMAT_SIZE[s.format].w} / ${FORMAT_SIZE[s.format].h}`, maxHeight: '78vh', margin: '0 auto' }}>
              {asset.result_url && <video key={asset.result_url} src={asset.result_url} poster={opts.preview_frame_url || undefined} controls playsInline className="h-full w-full" />}
            </div>
          )}
        {rendering && (
          <MakingCard compact embedded={embedded} photos={makingPhotos} aspect={16 / 10}
            title={render.main === false ? `Making the ${FORMAT_SIZE[target].label.toLowerCase()} version` : 'Updating your video'}
            stage={render.stage || 'Starting the cameras'} pct={p} etaAt={render.eta_at} startedAt={render.started_at} ahead={ahead} />
        )}
        <Card>
          <CardTitle title="Download" sub="Every shape is made for it - nothing gets cropped off" />
          {workerUp === false && <p className="mb-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">The video maker is restarting - new shapes and updates turn back on by themselves in a minute. Saving what's made still works.</p>}
          <div className="space-y-2">
            {FORMAT_INFO.map(f => {
              const isMain = f.id === s.format
              const ready = isMain ? !!asset.result_url : !!formats[f.id]?.url
              const makingThis = rendering && render.target === f.id
              return (
                // In the narrow chat panel the button drops under the words (owner, 11/13 - "Uses less than 1%"
                // was wrapping one word per line beside it); see NARROW_CSS.
                <div key={f.id} className="ohp-dl-row flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                    <span className="rounded-[4px] border-2 border-[#111827]/70 dark:border-white/70" style={{ width: 9 * Math.sqrt(FORMAT_SIZE[f.id].w / FORMAT_SIZE[f.id].h) * 2.4, height: 9 * Math.sqrt(FORMAT_SIZE[f.id].h / FORMAT_SIZE[f.id].w) * 2.4 }} />
                  </span>
                  <div className="ohp-dl-text min-w-0 flex-1">
                    <p className="text-xs font-black text-[#111827] dark:text-white">{f.label}{isMain && <span className={`ml-1.5 text-[9px] uppercase tracking-wider ${gold}`}>Main</span>}</p>
                    <p className="ohp-dl-where truncate text-[10.5px] font-semibold text-gray-500">{f.where}</p>
                    {!ready && est?.render_paid && <p className="text-[10px] font-black text-[#8b7355] dark:text-[#d7b974]">Uses {aboutPct(est.render_percent)} of your monthly AI</p>}
                  </div>
                  {ready ? (
                    <button type="button" onClick={() => download(f.id)} disabled={!!downloading}
                      className="ohp-dl-btn inline-flex items-center gap-1.5 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                      {downloading === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Save
                    </button>
                  ) : (
                    <button type="button" onClick={() => make(f.id)} disabled={rendering || !!busy || changesPending || workerUp === false || !!(est?.render_paid && est?.render_paused)}
                      title={changesPending ? 'Update your video first' : est?.render_paid && est?.render_paused ? "You've reached your AI limit for now" : est?.render_paid ? `Uses ${aboutPct(est.render_percent)} of your monthly AI` : 'Free - no AI'}
                      className="ohp-dl-btn inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black text-gray-700 hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
                      {makingThis || busy === `fmt-${f.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Make it
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-2.5 text-[10.5px] font-semibold text-gray-400">{est?.render_paid && est?.render_paused ? "You've reached your AI limit for now - new shapes and updates wait until it resets. Saving what's made still works." : est?.render_paid ? 'Each extra shape is made fresh for its screen - a few minutes each.' : 'Extra shapes take about a minute and use no AI.'}</p>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardTitle title="Sections" sub="Tap to take something out - or put it back" />
          <div className="space-y-1.5">
            <SectionRow label="Opening title" on={s.sections.opening} onChange={v => up(d => ({ ...d, sections: { ...d.sections, opening: v } }))} />
            {s.photos.map((ph, i) => (
              <SectionRow key={ph.id} label={ph.label || kindLabel(ph.kind).label} thumb={thumbOf(ph.clean || ph.source)} index={i + 1}
                on={!ph.hidden} onChange={v => upPhoto(ph.id, { hidden: !v })} disabled={!ph.hidden && visible.length <= 2} />
            ))}
            <SectionRow label="Room captions" on={s.sections.labels} onChange={v => up(d => ({ ...d, sections: { ...d.sections, labels: v } }))} />
            <SectionRow label="Beds, baths & size" on={s.sections.stats} onChange={v => up(d => ({ ...d, sections: { ...d.sections, stats: v } }))} />
            <SectionRow label="Closing card" on={s.sections.endCard} onChange={v => up(d => ({ ...d, sections: { ...d.sections, endCard: v } }))} />
            <SectionRow label="Your branding" on={s.sections.agent !== 'off'} onChange={v => up(d => ({ ...d, sections: { ...d.sections, agent: v ? 'opening' : 'off' } }))} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setView('steps'); goStep(S.flow) }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-700 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-200">
              <Film className="h-3.5 w-3.5" /> Transitions
            </button>
            <button type="button" onClick={() => { setView('steps'); goStep(S.look) }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-700 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-200">
              <Wand2 className="h-3.5 w-3.5" /> Edit everything
            </button>
          </div>
        </Card>
        <AnimatePresence>
          {changesPending && !rendering && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <Card className="border-[#C9A24D]/50">
                <p className="font-serif text-base font-black text-[#111827] dark:text-white">You have changes</p>
                <p className="mt-0.5 text-xs font-semibold text-gray-500">Preview them above, then update your video. {est?.render_paid ? `Updating it uses ${aboutPct((est.render_percent || 0) + (needsSharpen > 0 && !est?.sharpen_paused ? (sharpenPct || 0) : 0))} of your monthly AI.` : <>No AI usage{needsSharpen > 0 && !est?.sharpen_paused ? ` (except sharpening ${needsSharpen} new photo${needsSharpen === 1 ? '' : 's'}, ${aboutPct(sharpenPct)})` : ''}.</>}</p>
                <button type="button" onClick={() => make()} disabled={!!busy || workerUp === false || !!(est?.render_paid && est?.render_paused)}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#111827] to-[#2a2a2e] py-3 text-sm font-black text-white shadow-lg disabled:opacity-50 dark:from-white dark:to-gray-200 dark:text-[#111827]">
                  {busy === 'make' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-[#C9A24D]" />} Update my video
                </button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        {usedPct != null && <p className="px-1 text-[11px] font-semibold text-gray-400">This video used {aboutPct(usedPct)} of your monthly AI so far.</p>}
      </div>
    </div>
  )

  const preview = (
    <div className="space-y-2">
      <LivePreview settings={s} maxH={previewMaxH} />
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-bold text-gray-400">
        <span className="truncate">{visible.length ? `Live preview · ${visible.length} photos · ${Math.round(length)} sec · free` : `Live preview · ${s.length || 30} sec · your look on example photos`}</span>
        <button type="button" onClick={() => setExampleOpen(true)} className={`inline-flex shrink-0 items-center gap-1 font-black ${gold} hover:underline`}><Play className="h-3 w-3" /> Example</button>
      </div>
      {missingDepth && visible.length > 0 && <p className="px-1 text-[11px] font-semibold text-gray-400">The 3D camera switches on as each photo is measured.</p>}
    </div>
  )

  return (
    <div ref={wrapRef} className={`ohp-media-lab relative ${embedded ? 'rounded-2xl' : 'min-h-screen'} bg-[#faf9f7] dark:bg-[#0B0B0B] ${width && optionsW < 600 ? 'ohp-cine-narrow' : ''}`}>
      <style>{OHP_MEDIA_STYLE + MINI_CSS + MOTION_FONT_CSS + NARROW_CSS + MAKING_CSS}</style>
      <div ref={topRef} className={`mx-auto scroll-mt-4 ${embedded ? 'px-3 pb-4 pt-3' : 'max-w-6xl px-4 pb-32 pt-4 sm:pb-16 sm:pt-6'}`}>
        {/* top bar */}
        <div className={`${embedded ? 'relative mb-4 rounded-2xl border' : 'sticky top-0 -mx-4 mb-5 border-b sm:-mx-0 sm:rounded-2xl sm:border'} z-20 overflow-hidden border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]`}>
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#C9A24D] to-[#e0b85f]" />
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            {embedded ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#f1d58b]"><Film className="h-4 w-4" /></span>
            ) : (
              <Link href="/studio/media" aria-label="Back to projects" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${gold}`}>Cinematic Video</p>
              <p className="truncate font-serif text-base font-black text-[#111827] dark:text-white sm:text-lg">{title}</p>
            </div>
            {/* not inside the chat: the narrow panel needs the room for the address (QA 11/12: it showed "4…") */}
            <span className={`hidden shrink-0 items-center gap-1.5 text-[11px] font-bold text-gray-400 ${embedded ? '' : 'sm:inline-flex'}`}>
              {save === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving</> : save === 'error' ? <span className="text-red-500">Not saved</span> : <><Check className="h-3 w-3 text-emerald-500" strokeWidth={3} /> Saved</>}
            </span>
            {asset.status === 'succeeded' && view === 'steps' && (
              <button type="button" onClick={() => { setView('video'); setVideoTab(changesPending ? 'preview' : 'video') }}
                className="shrink-0 rounded-full bg-[#111827] px-3.5 py-1.5 text-[11px] font-black text-white dark:bg-white dark:text-[#111827]">Your video</button>
            )}
            {embedded && (
              <Link href={`/studio/media/motion/${id}`} aria-label="Open full screen" title="Open full screen"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/10 dark:hover:text-white">
                <Expand className="h-4 w-4" />
              </Link>
            )}
          </div>
          {view === 'steps' && (
            <div className="px-4 pb-3 sm:px-5">
              <p className="mb-1.5 text-[11px] font-black text-gray-500 md:hidden">Step {step + 1} of {STEPS.length} · <span className="text-[#111827] dark:text-white">{STEPS[step].title}</span></p>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0,1fr))` }}>
                {STEPS.map((st, i) => {
                  // while the first video is being made nothing can be changed (owner 11/13)
                  const locked = rendering && !asset.result_url && i !== step
                  const reachable = !locked && (i <= step || STEPS.slice(0, i).every((_, k) => canNext(k)))
                  const done = i < step
                  return (
                    <button key={st.key} type="button" disabled={!reachable} onClick={() => goStep(i)} title={st.title} aria-label={`Step ${i + 1}: ${st.title}`}
                      className="group min-w-0 py-1 text-left disabled:cursor-not-allowed">
                      <span className={`block h-1.5 rounded-full transition-colors ${i === step ? 'bg-[#C9A24D]' : done ? 'bg-[#111827] dark:bg-white/80' : 'bg-gray-200 group-hover:bg-gray-300 dark:bg-white/10'}`} />
                      <span className={`mt-1.5 hidden truncate text-[10.5px] font-black md:block ${i === step ? 'text-[#111827] dark:text-white' : done ? 'text-[#8b7355] dark:text-[#d7b974]' : 'text-gray-400'}`}>
                        {done ? <Check className="mr-0.5 inline h-3 w-3 -translate-y-px" strokeWidth={3.5} /> : <span className="mr-0.5">{i + 1}.</span>}{st.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">{error}</p>}

        {view === 'video' ? videoView : (
          <div className="grid gap-6" style={{ gridTemplateColumns: sidePreview ? (tall ? `${sideW}px minmax(0,1fr)` : 'minmax(0,1.1fr) minmax(0,1fr)') : 'minmax(0,1fr)' }}>
            {sidePreview && <div className="min-w-0"><div className={embedded ? 'sticky top-3' : 'sticky top-36'}>{preview}</div></div>}
            <div className="min-w-0">
              <div className="mb-4">
                <h1 className="font-serif text-2xl font-black text-[#111827] dark:text-white sm:text-3xl">{STEPS[step].title}</h1>
                <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  {[
                    'How long it runs and where you\'ll post it first.',
                    'Tap a room to see all of its photos, then tick the ones you want - we\'ve ticked our picks.',
                    'One photo at a time: is it the right room, and are the words right?',
                    'Pick the moment - it sets the opening words and the closing card.',
                    'Choose a theme, your color, and how the camera moves.',
                    'The order of the rooms and how they flow into each other.',
                    'Every word on your video, your branding and the music.',
                    'Check the summary, then make it. You can change anything afterwards.',
                  ][step]}
                </p>
              </div>
              {!sidePreview && showPreview && <div className={`mb-5 ${wide ? 'mx-auto max-w-3xl' : ''}`}>{preview}</div>}
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                  {stepBodies[step]}
                </motion.div>
              </AnimatePresence>
              <div className={`mt-6 items-center justify-between ${embedded ? 'flex' : 'hidden sm:flex'}`}>
                <button type="button" onClick={() => goStep(step - 1)} disabled={step === 0 || (rendering && !asset.result_url)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-black text-gray-500 transition hover:bg-gray-100 disabled:opacity-0 dark:hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                {step < STEPS.length - 1 && (
                  <div className="flex items-center gap-3">
                    {!canNext(step) && <span className="text-xs font-bold text-gray-400">{nextBlockedReason(step)}</span>}
                    <button type="button" onClick={() => goStep(step + 1)} disabled={!canNext(step)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                      {STEPS[step + 1].short === 'Make' ? 'Almost done' : `Next: ${STEPS[step + 1].title}`} <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* phones: the flow bar (inside the chat the buttons sit under the step instead) */}
      {view === 'steps' && !embedded && (
        <FlowDock step={step + 1} total={STEPS.length}
          onBack={step > 0 && !(rendering && !asset.result_url) ? () => goStep(step - 1) : undefined}
          onContinue={step < STEPS.length - 1 ? () => goStep(step + 1) : () => make()}
          disabled={step < STEPS.length - 1 ? !canNext(step) : (rendering || workerUp === false || !!(est?.render_paid && est?.render_paused))}
          busy={busy === 'make' || (step === STEPS.length - 1 && rendering)}
          note={step < STEPS.length - 1 && !canNext(step) ? nextBlockedReason(step) : undefined}
          continueLabel={step < STEPS.length - 1 ? 'Next' : rendering ? 'Making…' : asset.result_url ? 'Update video' : 'Make video'}
          icon={step === STEPS.length - 1 ? <Clapperboard /> : undefined} />
      )}

      <AnimatePresence>
        {exampleOpen && <ExampleModal onClose={() => setExampleOpen(false)} />}
        {addOpen && (
          <AddPhotosModal asset={asset} used={[...s.photos.map(p => p.source), ...(s.pool || []).map(it => it.source)]} onClose={() => setAddOpen(false)}
            onAdd={async (urls) => {
              setAddOpen(false)
              if (!urls.length) return
              await flush()
              const { success, data, error: e } = await api.mediaLab.motion.addPhotos(id, urls)
              if (!success || !data) { setError(e || 'Couldn\'t add those photos.'); return }
              setAsset(data); setS(settingsOf(data))
              analyzeKicked.current = true
              startAnalysis()
            }} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------- timeline (order, camera, single transitions)

function Timeline({ s, onMove, onPhoto, gapFor, setGapFor }: {
  s: MotionSettings; onMove: (id: string, dir: -1 | 1) => void; onPhoto: (id: string, patch: Partial<MotionPhotoSetting>) => void
  gapFor: string | null; setGapFor: (v: string | null) => void
}) {
  const vis = s.photos.filter(p => !p.hidden)
  return (
    <div>
      {vis.map((ph, i) => {
        const tIn: TransitionId = ph.transitionIn || s.transition
        return (
          <div key={ph.id}>
            {i > 0 && (
              <div className="relative flex items-center py-1.5 pl-[3.25rem]">
                <span className="absolute bottom-0 left-[1.6rem] top-0 w-px bg-gray-200 dark:bg-gray-700" />
                <button type="button" onClick={() => setGapFor(gapFor === ph.id ? null : ph.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-black transition ${ph.transitionIn ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#d7b974]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D] dark:border-gray-700'}`}>
                  <Film className="h-3 w-3" /> {transitionPreset(tIn).label}{ph.transitionIn ? '' : ' (default)'}
                </button>
              </div>
            )}
            <AnimatePresence initial={false}>
              {gapFor === ph.id && i > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mb-2 ml-[3.25rem] grid grid-cols-3 gap-2 rounded-xl border border-gray-200 bg-[#faf9f7] p-2 dark:border-gray-800 dark:bg-[#0f0f10] sm:grid-cols-6">
                    {TRANSITION_PRESETS.map(tp => (
                      <button key={tp.id} type="button" onClick={() => { onPhoto(ph.id, { transitionIn: tp.id === s.transition ? null : tp.id }); setGapFor(null) }}
                        className={`overflow-hidden rounded-lg border-2 text-left ${tIn === tp.id ? 'border-[#C9A24D]' : 'border-transparent hover:border-[#C9A24D]/50'}`}>
                        <TransitionMini id={tp.id} className="aspect-video w-full" />
                        <p className="truncate bg-white px-1.5 py-1 text-[10px] font-black text-[#111827] dark:bg-[#151517] dark:text-white">{tp.label}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-[#151517]">
              <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg">
                <img src={thumbOf(ph.clean || ph.source) || ''} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111827]/85 text-[9px] font-black text-white">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-[#111827] dark:text-white">{ph.label || kindLabel(ph.kind).label}</p>
                <select value={ph.move} onChange={e => onPhoto(ph.id, { move: e.target.value as MotionPhotoSetting['move'] })}
                  className="mt-0.5 max-w-full rounded-md border-0 bg-transparent p-0 pr-6 text-[11px] font-bold text-gray-500 outline-none dark:text-gray-400">
                  {MOVE_LABELS.map(m => <option key={m.id} value={m.id}>Camera: {m.label}</option>)}
                </select>
              </div>
              <button type="button" aria-label="Earlier" onClick={() => onMove(ph.id, -1)} disabled={s.photos[0]?.id === ph.id} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-white/10"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" aria-label="Later" onClick={() => onMove(ph.id, 1)} disabled={s.photos[s.photos.length - 1]?.id === ph.id} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-white/10"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" aria-label="Take out" onClick={() => onPhoto(ph.id, { hidden: true })} disabled={vis.length <= 2} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/20"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )
      })}
      {s.photos.some(p => p.hidden) && (
        <div className="mt-4">
          <p className={labelCls}>Taken out</p>
          <div className="flex flex-wrap gap-2">
            {s.photos.filter(p => p.hidden).map(ph => (
              <button key={ph.id} type="button" onClick={() => onPhoto(ph.id, { hidden: false })}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-gray-300 py-1 pl-1 pr-3 text-[11px] font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
                <img src={thumbOf(ph.clean || ph.source) || ''} alt="" className="h-6 w-8 rounded-full object-cover" /> <Plus className="h-3 w-3" /> {ph.label || kindLabel(ph.kind).label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SectionRow({ label, on, onChange, thumb, index, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; thumb?: string | null; index?: number; disabled?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition ${on ? '' : 'opacity-55'}`}>
      {thumb ? (
        <span className="relative h-8 w-11 shrink-0 overflow-hidden rounded-md">
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
          {index && <span className="absolute left-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-[8px] font-black text-white">{index}</span>}
        </span>
      ) : <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-white/[0.06]"><Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" /></span>}
      <p className={`min-w-0 flex-1 truncate text-xs font-black text-[#111827] dark:text-white ${on ? '' : 'line-through'}`}>{label}</p>
      <button type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled} title={disabled ? 'A video needs at least 2 rooms' : undefined}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-black transition disabled:opacity-40 ${on ? 'text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20' : 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#d7b974]'}`}>
        {on ? <><X className="h-3 w-3" /> Remove</> : <><Plus className="h-3 w-3" /> Put back</>}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- music (with a listen button)

function MusicPicker({ value: raw, onChange }: { value: MotionSettings['music']; onChange: (v: MotionSettings['music']) => void }) {
  const value = musicFile(raw || 'elegant') // an older project's "piano"/"ambient" shows as its new track
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  useEffect(() => () => { audio.current?.pause() }, [])
  const toggle = (m: string) => {
    if (playing === m) { audio.current?.pause(); setPlaying(null); return }
    audio.current?.pause()
    const a = new Audio(`/motion/music/${m}.m4a`)
    a.volume = 0.8
    a.onended = () => setPlaying(null)
    a.play().catch(() => setPlaying(null))
    audio.current = a
    setPlaying(m)
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {MUSIC_INFO.map(m => (
        <div key={m.id} role="button" tabIndex={0} onClick={() => onChange(m.id)} onKeyDown={e => { if (e.key === 'Enter') onChange(m.id) }}
          className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition ${value === m.id ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
          {m.id === 'none' ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-white/[0.06]"><Music2 className="h-4 w-4" /></span>
          ) : (
            <button type="button" aria-label={playing === m.id ? 'Stop' : 'Listen'} onClick={e => { e.stopPropagation(); toggle(m.id) }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white shadow dark:bg-white dark:text-[#111827]">
              {playing === m.id ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
          )}
          <div className="min-w-0">
            <p className="text-xs font-black text-[#111827] dark:text-white">{m.label}</p>
            <p className="text-[10.5px] font-semibold leading-tight text-gray-500">{m.blurb}</p>
          </div>
          {value === m.id && <Check className="absolute right-2.5 top-2.5 h-4 w-4 text-[#C9A24D]" strokeWidth={3} />}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- modals

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  return (
    <motion.div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={e => e.stopPropagation()}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl dark:bg-[#151517] sm:rounded-3xl sm:p-6 ${wide ? 'sm:max-w-4xl' : 'sm:max-w-2xl'}`}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200"><X className="h-4 w-4" /></button>
        {children}
      </motion.div>
    </motion.div>
  )
}

function ExampleModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} wide>
      <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${gold}`}>Example</p>
      <p className="mb-3 pr-10 font-serif text-xl font-black text-[#111827] dark:text-white">Three photos, about 18 seconds</p>
      <video src="/motion/example/example.mp4" poster="/motion/example/example.jpg" controls autoPlay muted playsInline preload="metadata" className="aspect-video w-full rounded-2xl bg-black" />
      <p className="mt-3 text-xs font-semibold text-gray-500">Real listing photos, moved like a film camera through their own depth - nothing is made up. Yours uses your photos, your words and your branding.</p>
    </Modal>
  )
}

function AddPhotosModal({ asset, used, onClose, onAdd }: { asset: StudioMediaAsset; used: string[]; onClose: () => void; onAdd: (urls: string[]) => void }) {
  const [uploads, setUploads] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  useEffect(() => {
    api.mediaLab.listAssets({ kind: 'upload', limit: 60 }).then(r => {
      if (r.success && r.data) setUploads(r.data.assets.map(a => a.result_url).filter((u): u is string => !!u))
    })
  }, [])
  const listing = (asset.linked_property?.photos || []).filter(u => !used.includes(u))
  const mine = uploads.filter(u => !used.includes(u))
  const grid = (urls: string[]) => (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map(u => {
        const on = picked.includes(u)
        return (
          <button key={u} type="button" onClick={() => setPicked(p => (on ? p.filter(x => x !== u) : [...p, u]))}
            className={`relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition ${on ? 'border-[#C9A24D] ring-2 ring-[#C9A24D]/30' : 'border-transparent hover:border-[#C9A24D]/40'}`}>
            <img src={thumbOf(u) || ''} alt="" loading="lazy" className="h-full w-full object-cover" />
            {on && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
          </button>
        )
      })}
    </div>
  )
  return (
    <Modal onClose={onClose}>
      <p className="mb-1 pr-10 font-serif text-xl font-black text-[#111827] dark:text-white">Add photos</p>
      <p className="mb-4 text-xs font-semibold text-gray-500">New photos get labeled and measured for the 3D camera - about a cent of AI.</p>
      {listing.length > 0 && <><p className={labelCls}>From this listing</p>{grid(listing)}</>}
      {mine.length > 0 && <div className="mt-4"><p className={labelCls}>Your uploads</p>{grid(mine)}</div>}
      {!listing.length && !mine.length && <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-xs font-bold text-gray-400">Every photo is already in your video. Upload more in AI Media first.</p>}
      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-gray-100 bg-white px-4 pt-3 dark:border-gray-800 dark:bg-[#151517] sm:-mx-6 sm:px-6">
        <button type="button" disabled={!picked.length} onClick={() => onAdd(picked)}
          className="w-full rounded-xl bg-[#111827] py-3 text-sm font-black text-white disabled:opacity-40 dark:bg-white dark:text-[#111827]">
          {picked.length ? `Add ${picked.length} photo${picked.length === 1 ? '' : 's'}` : 'Pick photos to add'}
        </button>
      </div>
    </Modal>
  )
}
