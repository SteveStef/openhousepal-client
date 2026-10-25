'use client'

// Shared constants, helpers, and small presentational pieces used by all three AI Property Media
// pages (list /studio/media, create /studio/media/new, result /studio/media/[id]) - split out of
// what used to be one single page/modal so each route only mounts what it actually needs. See the
// per-page files for why: a "Create New" modal sitting on top of an always-mounted project list
// meant the list's own polling/rendering kept running underneath the (much heavier) wizard, which
// is the real cause of the reported lag - not just a cosmetic "should be its own page like CMA".

import PhotoGridGate from '@/components/ui/PhotoGridGate'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, Download, Film, Lightbulb, Loader2, Maximize, Moon, Pointer, Sofa, Sparkles, Trash2, Video, X } from 'lucide-react'
import { usePagePin } from '@/components/ui/windowMotion'
import type { StudioEnhancement, StudioImageEffect, StudioMediaAsset, StudioRoomType, StudioStagingStyle } from '@/types'

export const MAX_VIDEO_PHOTOS = 7
export const VIDEO_PHOTO_MIN_RATIO = 1.30 // allows 4:3 landscape with a little camera/export variance
export const VIDEO_PHOTO_MAX_RATIO = 1.80 // allows 16:9 landscape without admitting ultra-wide panoramas

export const EFFECTS: { id: StudioImageEffect; label: string; blurb: string }[] = [
  { id: 'twilight', label: 'Twilight', blurb: 'Daytime exterior → high-end dusk, lights on' },
  { id: 'lights_on', label: 'Lights On', blurb: 'Turn the visible lights on' },
  { id: 'virtual_staging', label: 'Virtual Stage', blurb: 'Furnish an empty room' },
  { id: 'enhance', label: 'Enhance', blurb: 'Grass, sky, lighting, polish & clean-up' },
]
export const ROOM_TYPES: { id: StudioRoomType; label: string }[] = [
  { id: 'living_room', label: 'Living room' },
  { id: 'family_room', label: 'Family room' },
  { id: 'primary_bedroom', label: 'Primary bedroom' },
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'nursery', label: 'Nursery' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'dining_room', label: 'Dining room' },
  { id: 'office', label: 'Home office' },
  { id: 'basement', label: 'Finished basement' },
  { id: 'bonus_room', label: 'Bonus / flex room' },
  { id: 'home_gym', label: 'Home gym' },
  { id: 'sunroom', label: 'Sunroom' },
  { id: 'entryway', label: 'Entryway / foyer' },
  { id: 'patio', label: 'Patio / outdoor' },
]
export const STAGING_STYLES: { id: StudioStagingStyle; label: string }[] = [
  { id: 'modern', label: 'Modern' },
  { id: 'transitional', label: 'Transitional' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'traditional', label: 'Traditional' },
]
// Two groups in the picker: "Enhance" (make it look its best) and "Clean up" (take things away).
export const ENHANCEMENTS: { id: StudioEnhancement; label: string; group: 'enhance' | 'cleanup' }[] = [
  { id: 'grass', label: 'Improve grass / lawn', group: 'enhance' },
  { id: 'sky', label: 'Improve / replace sky', group: 'enhance' },
  { id: 'brighten_exterior', label: 'Brighten exterior', group: 'enhance' },
  { id: 'lighting', label: 'Improve lighting', group: 'enhance' },
  { id: 'polish', label: 'General photo polish', group: 'enhance' },
  { id: 'yard_cleanup', label: 'Clean up leaves, sticks & debris', group: 'cleanup' },
  { id: 'declutter', label: 'Remove cars, bins & clutter', group: 'cleanup' },
  { id: 'remove_furniture', label: 'Remove furniture (chairs, sofas, tables)', group: 'cleanup' },
]

/** The Enhance effect's options: "Enhance" picks, then a "Clean up" section under them. */
export function EnhancementOptions({ value, onToggle }: { value: StudioEnhancement[]; onToggle: (id: StudioEnhancement) => void }) {
  return (
    <div className="space-y-3">
      {([['enhance', 'Enhance'], ['cleanup', 'Clean up']] as const).map(([group, label]) => (
        <OptionRow key={group} label={label}>
          {ENHANCEMENTS.filter(e => e.group === group).map(e => (
            <Chip key={e.id} active={value.includes(e.id)} onClick={() => onToggle(e.id)}>{e.label}</Chip>
          ))}
        </OptionRow>
      ))}
    </div>
  )
}

export function actionLabel(action: string): string {
  if (action === 'animate') return 'AI Video'
  return action.split('+').map(e => EFFECTS.find(x => x.id === e)?.label || e).join(' + ')
}

export type VideoFmt = '16:9' | '9:16' | '1:1' | '4:5'

// Real-world observed timing (2026-09-05, enhance -> Hailuo 2.3 Fast Pro -> ByteDance 2K
// finishing pass): a 5-photo/25s video ran ~11 min end to end, occasionally longer depending on
// the fal queue that day - close to the ~3 min/photo this scales by. This is the ONE number
// driving both the live countdown and the "up to ~X min" copy below it.
export const VIDEO_ETA_SECONDS_PER_PHOTO = 180
export function estimatedVideoSeconds(photoCount: number): number {
  return Math.max(1, photoCount) * VIDEO_ETA_SECONDS_PER_PHOTO
}
export function formatMinSec(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export type PhotoDims = { width: number; height: number }
export type VideoPhotoEligibility = 'unknown' | 'eligible' | 'unsupported'

export function videoPhotoEligibility(dims?: PhotoDims): VideoPhotoEligibility {
  if (!dims || dims.width <= 0 || dims.height <= 0) return 'unknown'
  const ratio = dims.width / dims.height
  const landscape = dims.width > dims.height
  const standardLandscape = ratio >= VIDEO_PHOTO_MIN_RATIO && ratio <= VIDEO_PHOTO_MAX_RATIO
  return landscape && standardLandscape ? 'eligible' : 'unsupported'
}

// Staged "what's happening now" label, so the wait reads like a process, not a spinner.
export function stageLabel(
  isVideo: boolean, elapsed: number, effectNames: string,
  clips?: { status?: string; output_url?: string; final_url?: string }[],
): string {
  if (isVideo) {
    if (clips && clips.length) {
      const failed = clips.some(c => c.status === 'failed')
      if (failed) return 'Wrapping up…'
      const rendered = clips.filter(c => !!c.output_url).length
      if (rendered < clips.length) return `Rendering shot ${Math.min(rendered + 1, clips.length)} of ${clips.length}…`
      const finalized = clips.filter(c => !!c.final_url).length
      if (finalized < clips.length) return `Enhancing shot ${Math.min(finalized + 1, clips.length)} of ${clips.length} (2K upscale)…`
      return 'Stitching your shots together…'
    }
    if (elapsed < 6) return 'Queuing your shots with OpenHousePal AI…'
    if (elapsed < 20) return 'Rendering the first shots…'
    return 'Rendering shots…'
  }
  if (elapsed < 5) return 'Preparing your photo…'
  if (elapsed < 35) return `Applying ${effectNames || 'your edits'}…`
  if (elapsed < 70) return 'Refining detail & lighting…'
  return 'Almost there…'
}

// Shared animation/button-feel CSS, identical on all 3 pages (each page's own root div carries
// the `ohp-media-lab` class so this stays scoped, not global).
export const OHP_MEDIA_STYLE = `
  @keyframes ohpShimmer{0%{background-position:-40% 0}100%{background-position:140% 0}}
  @keyframes ohpScan{0%{transform:translateY(-120%)}100%{transform:translateY(320%)}}
  @keyframes ohpGlow{0%,100%{opacity:.35}50%{opacity:.8}}
  @keyframes ohpFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.06)}}
  @keyframes ohpPop{0%{opacity:0;transform:scale(.55) translateY(10px)}62%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
  .ohp-pop{animation:ohpPop .44s cubic-bezier(.34,1.56,.64,1) both}
  @keyframes ohpReveal{0%{opacity:0;transform:translateY(14px) scale(.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
  .ohp-reveal{animation:ohpReveal .5s cubic-bezier(.16,1,.3,1) both}
  .ohp-media-lab button{transition:transform .13s cubic-bezier(.2,0,.2,1),box-shadow .22s ease,background-color .18s ease,border-color .18s ease,color .18s ease,opacity .18s ease}
  .ohp-media-lab button:not(:disabled){cursor:pointer}
  .ohp-media-lab button:not(:disabled):active{transform:scale(.98)}
  .ohp-media-lab button:disabled{cursor:not-allowed}
  @keyframes ohpCardIn{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
  .ohp-card-in{animation:ohpCardIn .6s cubic-bezier(.2,.8,.2,1) backwards}
  @keyframes ohpSelect{0%{transform:scale(1)}30%{transform:scale(.93)}65%{transform:scale(1.035)}100%{transform:scale(1)}}
  @keyframes ohpRing{0%{box-shadow:0 0 0 0 rgba(201,162,77,.75)}100%{box-shadow:0 0 0 16px rgba(201,162,77,0)}}
  .ohp-sel{animation:ohpSelect .5s cubic-bezier(.2,.8,.2,1),ohpRing .8s ease-out}
  @keyframes ohpTipPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,201,122,.85)}50%{box-shadow:0 0 0 7px rgba(232,201,122,0)}}
  .ohp-tip-pulse{animation:ohpTipPulse 1.3s ease-in-out infinite}
  @keyframes ohpCoach{0%{left:46%;top:58%;transform:scale(1);opacity:0}10%{opacity:1}22%{left:46%;top:58%;transform:scale(.8)}32%{transform:scale(1)}58%{left:calc(100% - 22px);top:14px;transform:scale(1)}70%{transform:scale(.8)}80%{transform:scale(1);opacity:1}100%{left:calc(100% - 22px);top:14px;opacity:0}}
  .ohp-coach{animation:ohpCoach 2.8s cubic-bezier(.4,0,.2,1) infinite}
  @keyframes ohpDone{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
  .ohp-done{animation:ohpDone .55s cubic-bezier(.34,1.56,.64,1) both}
  @media (prefers-reduced-motion:reduce){.ohp-media-lab button,.ohp-media-lab .animate-fadeIn,.ohp-media-lab .ohp-pop,.ohp-media-lab .ohp-reveal,.ohp-media-lab .ohp-card-in,.ohp-media-lab .ohp-sel,.ohp-media-lab .ohp-coach,.ohp-media-lab .ohp-tip-pulse,.ohp-media-lab .ohp-done{transition:none!important;animation:none!important}}
`

// What a still-photo edit usually takes, end to end (one model pass ~40-70s, plus the circled
// removal pass when there is one) - drives the progress bars on the result page and the list.
export const PHOTO_ETA_SECONDS = 75

export function Section({ step, title, active = true, overflowVisible = false, raised = false, leading, aside, flush = false, oneLine = false, children }: {
  step: number; title: string; active?: boolean; overflowVisible?: boolean; raised?: boolean
  /** Before the title (e.g. a back arrow) / at the end of the title line (info chips). */
  leading?: React.ReactNode; aside?: React.ReactNode
  /** No top margin - the section is the first thing on the page. */
  flush?: boolean
  /** Phones: title + aside stay on one line (the aside shrinks/truncates instead of wrapping). */
  oneLine?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`animate-fadeIn relative ${flush ? '' : 'mt-5'} rounded-2xl border bg-white shadow-sm transition-colors dark:bg-[#151517] ${raised ? 'z-10' : ''} ${overflowVisible ? '' : 'overflow-hidden'} ${active ? 'border-[#C9A24D]/40' : 'border-gray-200 opacity-90 dark:border-gray-800'}`}>
      <div className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl ${active ? 'bg-gradient-to-r from-[#C9A24D] to-[#e0b85f]' : 'bg-transparent'}`} />
      <div className="p-4 sm:p-5">
        <div className={`mb-3.5 flex items-center gap-x-3 gap-y-2 ${oneLine ? 'flex-nowrap gap-x-2 sm:flex-wrap sm:gap-x-3' : 'flex-wrap'}`}>
          <h3 className={`flex items-center gap-2.5 font-serif text-lg font-black text-[#111827] dark:text-white ${oneLine ? 'shrink-0 gap-2 sm:gap-2.5' : ''}`}>
            {leading}
            {step > 0 && (
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${active ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{step}</span>
            )}
            {title}
          </h3>
          {oneLine ? <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:contents">{aside}</div> : aside}
        </div>
        {children}
      </div>
    </div>
  )
}

export function ModeCard({ active, onClick, icon: Icon, title, blurb }: {
  active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; blurb: string
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-start gap-3.5 overflow-hidden rounded-2xl border-2 p-4 text-left transition ${
        active
          ? 'border-[#C9A24D] bg-gradient-to-br from-[#C9A24D]/15 via-white to-white shadow-[0_0_36px_-14px_rgba(201,162,77,0.55)] dark:via-[#151517] dark:to-[#151517]'
          : 'border-gray-200 bg-white hover:-translate-y-0.5 hover:border-[#C9A24D]/50 hover:shadow-lg dark:border-gray-800 dark:bg-[#151517]'
      }`}
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition ${
        active
          ? 'border-[#C9A24D] bg-gradient-to-br from-[#C9A24D] to-[#e0b85f] text-[#111827] shadow-md shadow-[#C9A24D]/40'
          : 'border-[#C9A24D]/30 bg-[#111827] text-[#C9A24D] group-hover:border-[#C9A24D] dark:bg-[#0B0B0B]'
      }`}>
        <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="font-serif text-base font-black text-[#111827] dark:text-white">{title}</p>
        <p className="mt-1 text-[11.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{blurb}</p>
      </div>
      {active && <Check className="absolute right-3 top-3 h-4 w-4 text-[#C9A24D]" />}
    </button>
  )
}

export function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${active ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D]/50 dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white'}`}
    >
      {children}
    </button>
  )
}

export function PhotoGeneratingCard({ src, label, elapsed }: { src?: string; label: string; elapsed: number }) {
  return (
    <div className="mt-4 max-w-md">
      <div
        className="relative flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-[#C9A24D]/50 px-6 py-8 text-center"
        style={{ animation: 'ohpGlow 2.4s ease-in-out infinite', boxShadow: '0 0 44px -8px rgba(201,162,77,0.55)' }}
      >
        {src
          ? <img src={src} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] brightness-[0.55] saturate-[1.1]" draggable={false} />
          : <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#172033] to-[#4a3820]" />}
        <div
          className="pointer-events-none absolute inset-x-0 h-1/3"
          style={{
            animation: 'ohpScan 2.1s cubic-bezier(.4,0,.2,1) infinite',
            background: 'linear-gradient(180deg,transparent,rgba(230,199,122,0.55) 45%,rgba(255,255,255,0.85) 50%,rgba(230,199,122,0.55) 55%,transparent)',
            filter: 'blur(2px)',
          }}
        />
        <Sparkles className="absolute left-3 top-3 h-4 w-4 text-white/80" style={{ animation: 'ohpFloat 2.8s ease-in-out infinite' }} />
        <Sparkles className="absolute bottom-3 right-3 h-3.5 w-3.5 text-[#e6c77a]" style={{ animation: 'ohpFloat 3.4s ease-in-out infinite 0.6s' }} />
        <div className="relative z-10 flex flex-col items-center gap-3 px-2">
          <div className="relative flex h-11 w-11 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40" style={{ animation: 'ohpGlow 1.6s ease-in-out infinite' }} />
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <p className="text-sm font-black text-white drop-shadow">{label}</p>
          <p className="text-[11px] font-bold text-white/70">{elapsed}s elapsed · usually 40–90s</p>
          <div className="max-w-[240px] rounded-xl border border-white/15 bg-white/10 px-3 py-2 ">
            <p className="text-[10.5px] font-semibold leading-snug text-white/70">
              Feel free to close this tab — it keeps working in the background and will be waiting in Your projects when you're back.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Module-level (not defined inline) so its identity is stable across renders, and memoized so a
// click that changes ONE tile's selected-state doesn't re-render every other tile in a 20-40+
// photo grid. `loading="lazy"`/`decoding="async"` stop the browser from eagerly fetching+decoding
// every full-resolution MLS photo at once on mount.
const PhotoTile = memo(function PhotoTile({
  url, kind, isVideo, selected, badge, canRemove, eligibility, onLoadDims, onPick, onInspect, onRemoveUpload, coach = false,
}: {
  /** First-time hint on this tile: a finger taps the photo, then the enlarge button. */
  coach?: boolean
  url: string
  kind: 'listing' | 'upload'
  isVideo: boolean
  selected: boolean
  badge: number | null
  canRemove: boolean
  eligibility: VideoPhotoEligibility
  onLoadDims: (url: string, dims: PhotoDims) => void
  onPick: (url: string, kind: 'listing' | 'upload') => void
  onInspect: (url: string) => void
  onRemoveUpload: (url: string) => void
}) {
  const blockedForVideo = isVideo && eligibility !== 'eligible'
  const unsupported = isVideo && eligibility === 'unsupported'
  const title = unsupported ? 'Choose a standard landscape photo for best AI video quality.' : undefined
  return (
    <div className="group relative" title={title}>
      <button
        onClick={() => onPick(url, kind)}
        disabled={blockedForVideo}
        aria-disabled={blockedForVideo}
        className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl border-2 transition ${
          selected
            ? 'ohp-sel border-[#C9A24D] ring-4 ring-[#C9A24D]/35 shadow-lg shadow-[#C9A24D]/40'
            : unsupported
              ? 'border-gray-200 opacity-45 grayscale hover:border-gray-200 dark:border-gray-800'
              : blockedForVideo
                ? 'border-gray-200 opacity-70 dark:border-gray-800'
                : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-gray-800'
        }`}
      >
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onLoad={(e) => onLoadDims(url, {
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight,
          })}
        />
        {selected && (
          <>
            <span className="pointer-events-none absolute inset-0 bg-[#C9A24D]/15" />
            <span className="ohp-pop absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827] shadow-md">
              {isVideo ? <span className="text-[12px] font-black">{badge}</span> : <Check className="h-3.5 w-3.5" strokeWidth={4} />}
            </span>
          </>
        )}
        {coach && (
          <span aria-hidden className="ohp-coach pointer-events-none absolute z-20 -ml-3 -mt-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,.6)]">
            <Pointer className="h-6 w-6 fill-white/90 text-[#111827]" strokeWidth={1.6} />
          </span>
        )}
        {unsupported && (
          <span className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-black/70 px-1.5 py-1 text-[9px] font-black uppercase leading-tight text-white ">
            Not supported for AI video
          </span>
        )}
      </button>
      {unsupported && (
        <span className="pointer-events-none absolute inset-x-1.5 top-8 z-10 hidden rounded-md bg-[#111827] px-2 py-1.5 text-[10px] font-bold leading-snug text-white shadow-lg group-focus-within:block group-hover:block">
          Choose a standard landscape photo for best AI video quality.
        </span>
      )}
      {/* See it big. Always showing on touch screens (there's no hover there). */}
      <button
        type="button"
        onClick={() => onInspect(url)}
        title="See it bigger"
        aria-label="See this photo bigger"
        className={`absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-[#C9A24D] hover:text-[#111827] focus:opacity-100 sm:h-6 sm:w-6 ${coach ? 'ohp-tip-pulse bg-[#C9A24D] text-[#111827] opacity-100' : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'}`}
      >
        <Maximize className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
      </button>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemoveUpload(url)}
          title="Remove upload"
          className="absolute right-1.5 top-8 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-600 group-hover:flex"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
})

/** The big view of one photo. Portalled to <body> - inside the page it sat in a parent with a
 *  transform (the reveal animation), which made "fixed" measure from that box instead of the
 *  screen, so on a phone it opened halfway down the page (user, 10/24). */
export function ImageInspectModal({ url, onClose, onUse, used }: { url: string; onClose: () => void; onUse?: () => void; used?: boolean }) {
  usePagePin(true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-black/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Photo preview"
    >
      <motion.div
        className="relative max-h-full max-w-6xl"
        initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-white hover:text-[#111827]"
        >
          <X className="h-5 w-5" />
        </button>
        <img src={url} alt="" className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-2xl sm:max-h-[88vh]" />
      </motion.div>
      {onUse && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          onClick={(e) => { e.stopPropagation(); onUse() }}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-6 py-3 text-sm font-black text-[#111827] shadow-lg shadow-black/40"
        >
          <Check className="h-4 w-4" strokeWidth={3} /> {used ? 'Picked - keep this photo' : 'Use this photo'}
        </motion.button>
      )}
    </motion.div>,
    document.body,
  )
}

const PHOTO_TIP_KEY = 'ohp-media-photo-tip'

export type StagingTagPos = 'off' | 'bottom-right' | 'bottom-middle'

/** A photo with the "Virtually Staged" label drawn where (and as big as) it lands on the
 *  downloaded file - the backend's apply_staging_tag: Inter bold, 2% of the photo's width, a dark
 *  pill 2.5% in from the bottom (and right) edge. The wrapper hugs the photo, so the label sits
 *  on the picture, never on letterboxing. */
export function StagedPhoto({ src, tag, imgClassName = '', className = '', onLoad }: {
  src: string
  tag?: StagingTagPos | null
  imgClassName?: string
  className?: string
  onLoad?: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const on = tag === 'bottom-right' || tag === 'bottom-middle'
  const font = Math.max(7, w * 0.02)
  return (
    <div ref={wrapRef} className={`relative mx-auto w-fit max-w-full ${className}`}>
      <img src={src} alt="" className={`block max-w-full ${imgClassName}`} onLoad={() => { if (wrapRef.current) setW(wrapRef.current.clientWidth); onLoad?.() }} />
      <AnimatePresence>
        {on && w > 0 && (
          <motion.span
            key="staged-tag"
            layout
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="pointer-events-none absolute whitespace-nowrap rounded-full font-bold uppercase leading-none text-white"
            style={{
              bottom: w * 0.025, fontSize: font, padding: `${w * 0.0075}px ${w * 0.016}px`,
              background: 'rgba(17,24,39,0.84)', fontFamily: 'Inter, system-ui, sans-serif',
              ...(tag === 'bottom-middle' ? { left: '50%', x: '-50%' } : { right: w * 0.025 }),
            }}
          >
            Virtually Staged
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PhotoGrid({ photos, kind, isVideo, videoPhotos, selectedUrl, uploadAssets, onPick, onRemoveUpload, onInspect }: {
  photos: string[]
  kind: 'listing' | 'upload'
  isVideo: boolean
  videoPhotos: string[]
  selectedUrl: string | null
  uploadAssets: StudioMediaAsset[]
  onPick: (url: string, kind: 'listing' | 'upload') => void
  onRemoveUpload: (asset: StudioMediaAsset) => void
  /** The page shows the big view itself (it can then keep the grid open meanwhile). */
  onInspect?: (url: string, kind: 'listing' | 'upload') => void
}) {
  const [dimsByUrl, setDimsByUrl] = useState<Record<string, PhotoDims>>({})
  const [ownInspectUrl, setOwnInspectUrl] = useState<string | null>(null)
  // Tap once = pick it; a second tap on the same photo within a moment (double tap) or the
  // enlarge button = see it big.
  const lastTap = useRef<{ url: string; t: number } | null>(null)
  const inspect = useCallback((url: string) => {
    if (onInspect) onInspect(url, kind)
    else setOwnInspectUrl(url)
  }, [onInspect, kind])
  // First visit only: a finger shows "tap to pick, tap here to see it big" on the first photo.
  const [tip, setTip] = useState(false)
  useEffect(() => {
    try { if (!window.localStorage.getItem(PHOTO_TIP_KEY)) setTip(true) } catch { /* private mode - no tip */ }
  }, [])
  const endTip = useCallback(() => {
    setTip(false)
    try { window.localStorage.setItem(PHOTO_TIP_KEY, '1') } catch { /* fine */ }
  }, [])
  useEffect(() => {
    if (!tip) return
    const t = window.setTimeout(endTip, 9000)
    return () => window.clearTimeout(t)
  }, [tip, endTip])
  const tapTile = useCallback((url: string, k: 'listing' | 'upload') => {
    if (tip) endTip()
    const now = Date.now()
    const prev = lastTap.current
    if (prev && prev.url === url && now - prev.t < 330) {
      lastTap.current = null
      // a double tap on a multi-pick grid shouldn't also un-pick the photo
      if (isVideo) onPick(url, k)
      inspect(url)
      return
    }
    lastTap.current = { url, t: now }
    onPick(url, k)
  }, [tip, endTip, isVideo, onPick, inspect])
  const inspectTile = useCallback((url: string) => { if (tip) endTip(); inspect(url) }, [tip, endTip, inspect])
  const uploadByUrl = useMemo(() => {
    const m = new Map<string, StudioMediaAsset>()
    if (kind === 'upload') for (const a of uploadAssets) if (a.result_url) m.set(a.result_url, a)
    return m
  }, [kind, uploadAssets])
  const rememberDims = useCallback((url: string, dims: PhotoDims) => {
    setDimsByUrl(prev => {
      const old = prev[url]
      if (old?.width === dims.width && old?.height === dims.height) return prev
      return { ...prev, [url]: dims }
    })
  }, [])
  const removeUploadByUrl = useCallback((url: string) => {
    const asset = uploadByUrl.get(url)
    if (asset) onRemoveUpload(asset)
  }, [uploadByUrl, onRemoveUpload])

  return (
    <>
      <AnimatePresence initial={false}>
        {tip && photos.length > 0 && (
          <motion.p
            key="tip"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <span className="mb-2 flex items-center gap-2 rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-2 text-[11.5px] font-bold text-[#6b5530] dark:text-[#e8c97a]">
              <Pointer className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">Tap a photo to pick it. Tap <Maximize className="mx-0.5 inline h-3 w-3" /> or double-tap to see it bigger.</span>
              <button type="button" onClick={endTip} className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] hover:bg-[#C9A24D]/20 dark:text-[#e8c97a]">Got it</button>
            </span>
          </motion.p>
        )}
      </AnimatePresence>
      <PhotoGridGate urls={photos.slice(0, 16)}>
      <div
        className="ohp-reveal grid max-h-[520px] auto-rows-max grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4"
        style={{ overscrollBehavior: 'auto' }}
      >
        {photos.map((url, i) => {
          const vIdx = videoPhotos.indexOf(url)
          const selected = isVideo ? vIdx >= 0 : selectedUrl === url
          return (
            <PhotoTile
              key={url}
              url={url}
              kind={kind}
              isVideo={isVideo}
              selected={selected}
              badge={isVideo ? vIdx + 1 : null}
              canRemove={uploadByUrl.has(url)}
              eligibility={videoPhotoEligibility(dimsByUrl[url])}
              onLoadDims={rememberDims}
              onPick={tapTile}
              onInspect={inspectTile}
              onRemoveUpload={removeUploadByUrl}
              coach={tip && i === 0}
            />
          )
        })}
      </div>
      </PhotoGridGate>
      <AnimatePresence>
        {ownInspectUrl && <ImageInspectModal key={ownInspectUrl} url={ownInspectUrl} onClose={() => setOwnInspectUrl(null)} />}
      </AnimatePresence>
    </>
  )
}

function useElapsedSeconds(createdAt: string): number {
  const start = useMemo(() => new Date(createdAt).getTime(), [createdAt])
  const [elapsed, setElapsed] = useState(() => Math.max(0, (Date.now() - start) / 1000))
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.max(0, (Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [start])
  return elapsed
}

// The list card's version of the "stunning" processing animation used on the full result page -
// same scan-line/shimmer language (see OHP_MEDIA_STYLE), but only ever the listing's first photo
// (never the whole per-clip photo strip - that richer view belongs to the result page, which has
// room for it and real per-clip status to drive it).
function ProjectCardVideoProgress({ asset }: { asset: StudioMediaAsset }) {
  const elapsed = useElapsedSeconds(asset.created_at)
  const photoCount = (asset.options?.photo_count as number | undefined) || 1
  const pct = Math.max(4, Math.min(96, Math.round((elapsed / (asset.kind === 'video' ? estimatedVideoSeconds(photoCount) : PHOTO_ETA_SECONDS)) * 100)))
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      {asset.source_photo_url
        ? <img src={asset.source_photo_url} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover blur-[1.5px] brightness-[0.55]" draggable={false} />
        : <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#172033] to-[#4a3820]" />}
      <div
        className="pointer-events-none absolute inset-x-0 h-1/3"
        style={{ animation: 'ohpScan 2.1s cubic-bezier(.4,0,.2,1) infinite', background: 'linear-gradient(180deg,transparent,rgba(230,199,122,0.5) 45%,rgba(255,255,255,0.8) 50%,rgba(230,199,122,0.5) 55%,transparent)', filter: 'blur(1.5px)' }}
      />
      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-white drop-shadow" />
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#f1d58b] drop-shadow">Generating</span>
        <span className="font-serif text-lg font-black leading-none tabular-nums text-white drop-shadow">{pct}%</span>
      </div>
      <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#C9A24D,#f1d58b,#C9A24D)', backgroundSize: '200% 100%', animation: 'ohpShimmer 1.8s linear infinite' }}
        />
      </div>
    </div>
  )
}

// What kind of result a project is - drives the Media Lab filter tabs and each card's tag.
export type MediaGroup = 'video' | 'twilight' | 'staging' | 'lights' | 'enhance'
export function mediaGroup(asset: StudioMediaAsset): MediaGroup {
  if (asset.kind === 'video') return 'video'
  if (asset.action.includes('twilight')) return 'twilight'
  if (asset.action.includes('virtual_staging')) return 'staging'
  if (asset.action.includes('lights_on')) return 'lights'
  return 'enhance'
}
const GROUP_TAG: Record<MediaGroup, { label: string; icon: typeof Video }> = {
  video: { label: 'Video', icon: Video },
  twilight: { label: 'Twilight', icon: Moon },
  staging: { label: 'Staged', icon: Sofa },
  lights: { label: 'Lights on', icon: Lightbulb },
  enhance: { label: 'Enhanced', icon: Sparkles },
}

// Gallery card: the result fills the card, a glass tag says what it is, videos play on hover,
// and `feature` makes it the big 2x2 tile at the front of the grid.
export function ProjectCard({ asset, active, downloading, onOpen, onDownload, onDelete, feature = false, index = 0, justDone = false }: {
  asset: StudioMediaAsset
  active: boolean
  downloading: boolean
  onOpen: () => void
  onDownload: () => void
  onDelete: () => void
  feature?: boolean
  index?: number
  /** It finished while the list was open - a "Ready" moment until it's opened. */
  justDone?: boolean
}) {
  const isVid = asset.kind === 'video'
  const done = asset.status === 'succeeded' && !!asset.result_url
  const created = asset.created_at ? new Date(asset.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
  const tag = GROUP_TAG[mediaGroup(asset)]
  const vid = useRef<HTMLVideoElement>(null)
  // The real length, read off the file itself (the stored figure is the nominal clip total).
  const [secs, setSecs] = useState<number>(Number(asset.options?.duration_seconds) || 0)
  const length = isVid && secs ? `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}` : ''
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
      onMouseEnter={() => { vid.current?.play().catch(() => {}) }}
      onMouseLeave={() => { const v = vid.current; if (v) { v.pause(); v.currentTime = 0 } }}
      className={`ohp-card-in group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_44px_-26px_rgba(139,115,85,.75)] dark:bg-[#151517] ${justDone && done ? 'border-emerald-400 ring-2 ring-emerald-400/40' : asset.status === 'processing' ? 'border-[#C9A24D]/60' : active ? 'border-[#C9A24D] ring-2 ring-[#C9A24D]/30' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-gray-800'} ${feature ? 'lg:col-span-2 lg:row-span-2' : ''}`}
    >
      <button onClick={onOpen} className={`relative block w-full overflow-hidden bg-gray-100 dark:bg-gray-800 ${feature ? 'aspect-[4/3] lg:aspect-auto lg:min-h-0 lg:flex-1' : 'aspect-[4/3]'}`}>
        <div className="absolute inset-0">
          {done && !isVid && <img src={asset.result_url!} alt="" className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]" />}
          {done && isVid && <video ref={vid} src={asset.result_url!} muted loop playsInline preload="metadata" onLoadedMetadata={e => { const d = e.currentTarget.duration; if (d && isFinite(d)) setSecs(d) }} className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.03]" />}
          {!done && (
            asset.status === 'processing'
              ? <ProjectCardVideoProgress asset={asset} />
              : (
                <div className="flex h-full w-full items-center justify-center text-gray-300">
                  <Film className="h-5 w-5" />
                </div>
              )
          )}
        </div>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
        {isVid && done && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center transition duration-300 group-hover:scale-75 group-hover:opacity-0">
            <span className={`flex items-center justify-center rounded-full border border-white/40 bg-black/35 text-white shadow-lg ${feature ? 'h-14 w-14' : 'h-10 w-10'}`}><Video className={feature ? 'h-6 w-6' : 'h-4 w-4'} /></span>
          </span>
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white ">
            <tag.icon className="h-2.5 w-2.5 text-[#e8c97a]" /> {tag.label}
          </span>
          {asset.action.includes('+hd') && <span className="rounded-full bg-[#C9A24D] px-1.5 py-0.5 text-[8px] font-black text-[#111827]">1080p</span>}
          {asset.status === 'failed' && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-black text-white">FAILED</span>}
        </span>
        {length && (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black tabular-nums text-white ">
            <Clock className="h-2.5 w-2.5 text-[#e8c97a]" /> {length}
          </span>
        )}
        {justDone && done && (
          <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-emerald-900/70 via-black/40 to-[#8b7355]/60">
            <span className="ohp-done flex items-center gap-1.5 text-xs font-black text-white drop-shadow">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40"><Check className="h-3 w-3" strokeWidth={3.5} /></span>
              Ready
            </span>
            <span className="rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow">Tap to open</span>
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-1 px-3 py-2.5">
        <div className="min-w-0">
          <p className={`truncate font-black text-[#111827] dark:text-white ${feature ? 'text-sm' : 'text-xs'}`}>{asset.options?.custom_name || actionLabel(asset.action)}</p>
          <p className="truncate text-[9px] font-bold uppercase tracking-wide text-gray-400">{asset.kind}{length ? ` · ${length}` : ''}{created ? ` · ${created}` : ''}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {done && (
            <button onClick={onDownload} disabled={downloading} title="Download" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-[#C9A24D]/10 hover:text-[#8b7355] disabled:opacity-40">
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          )}
          <button onClick={onDelete} title="Delete" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
