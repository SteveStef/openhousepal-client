'use client'

// The one photo viewer of the CMA flow (11/15): the flip from "Comparing Subject vs. Comp" - the new photo
// settles in with a slight zoom (.cma-comp-photo, globals.css) - used for every home, on the agent's screens
// and on the client report. Made to feel instant:
//   - the photos either side of the one showing are fetched ahead, so a flip never waits on the network;
//   - the photo that was showing stays underneath until the next one has arrived (no grey flash);
//   - arrows, a finger swipe, the keyboard's arrow keys and the thumbnails all drive the same index.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Home } from 'lucide-react'
import { normalizeImageUrl } from '@/lib/utils'

const fetched = new Set<string>()
/** Fetch a photo ahead of time (once per address for the page's life). */
export function preloadPhoto(url?: string | null) {
  if (!url || typeof window === 'undefined' || fetched.has(url)) return
  fetched.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

export function usePhotoList(photos?: (string | null | undefined)[] | null, fallback?: string | null): string[] {
  return useMemo(() => {
    const all = [...(photos || []), fallback].filter((p): p is string => !!p).map(p => normalizeImageUrl(p))
    return Array.from(new Set(all))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(photos || []).join('|'), fallback])
}

export interface PhotoFlipProps {
  /** Already-normalized photo addresses (see usePhotoList). */
  photos: string[]
  /** Changing this sends the viewer back to the first photo (a different home). */
  resetKey?: string
  /** 'cover' fills the frame; 'contain' shows the whole photo (judging condition from it). */
  fit?: 'cover' | 'contain'
  /** Sizing / rounding of the frame. */
  className?: string
  /** Tapping the photo (not an arrow) - usually opens the home's details. */
  onOpen?: () => void
  /** Controlled index (optional) - leave out to let the viewer keep its own. */
  index?: number
  onIndex?: (index: number, total: number) => void
  /** "3 / 21" in the corner. */
  counter?: boolean
  /** Small dots along the bottom instead of a counter (phones, tight cards). */
  dots?: boolean
  /** Smaller arrows for small cards. */
  compact?: boolean
  /** Arrows only show on hover (desktop) - always on touch screens. */
  quietArrows?: boolean
  alt?: string
  /** Zoom in a little from the top-right so the MLS badge in the bottom-left corner is cropped away (the subject's hero). */
  hideBadge?: boolean
  /** Badges and captions laid over the photo. */
  children?: React.ReactNode
}

export default function PhotoFlip({ photos, resetKey, fit = 'cover', className = '', onOpen, index: controlled, onIndex, counter = false, dots = false, compact = false, quietArrows = false, alt = '', hideBadge = false, children }: PhotoFlipProps) {
  const [own, setOwn] = useState(0)
  const total = photos.length
  const raw = controlled ?? own
  const index = total ? Math.min(Math.max(raw, 0), total - 1) : 0
  // The photo that was up before this one - kept underneath until the new one has loaded.
  const [under, setUnder] = useState<string | null>(null)
  const shownRef = useRef<string | null>(null)
  const current = photos[index] || null

  useEffect(() => { if (controlled == null) setOwn(0) }, [resetKey, controlled])
  useEffect(() => { onIndex?.(index, total) }, [index, total, onIndex])
  useEffect(() => {
    if (shownRef.current && shownRef.current !== current) setUnder(shownRef.current)
    shownRef.current = current
  }, [current])
  // Fetch the neighbours ahead (two forward, one back) so the next flips are already here.
  useEffect(() => {
    if (total < 2) return
    for (const d of [1, -1, 2]) preloadPhoto(photos[(index + d + total) % total])
  }, [index, total, photos])

  const go = useCallback((d: number) => {
    if (total < 2) return
    const next = (index + d + total) % total
    if (controlled == null) setOwn(next)
    else onIndex?.(next, total)
  }, [index, total, controlled, onIndex])

  // Finger swipe: sideways only (an up/down drag stays a page scroll).
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY }; swiped.current = false }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current; start.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.4) { swiped.current = true; go(dx < 0 ? 1 : -1) }
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    else if ((e.key === 'Enter' || e.key === ' ') && onOpen) { e.preventDefault(); onOpen() }
  }

  const fitCls = fit === 'contain' ? 'object-contain' : 'object-cover'
  const arrowCls = `absolute top-1/2 z-[2] flex -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white outline-none transition [-webkit-tap-highlight-color:transparent] hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-[#C9A24D] active:scale-90 print:hidden ${compact ? 'h-7 w-7' : 'h-9 w-9'} ${quietArrows ? '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/flip:opacity-100 [@media(hover:hover)]:group-focus-within/flip:opacity-100' : ''}`

  return (
    <div
      className={`group/flip relative isolate overflow-hidden bg-gray-100 outline-none dark:bg-[#0B0B0B] ${className}`}
      tabIndex={total > 1 || onOpen ? 0 : undefined}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role={total > 1 ? 'group' : undefined}
      aria-roledescription={total > 1 ? 'photo viewer' : undefined}
      aria-label={total > 1 ? `Photo ${index + 1} of ${total}` : undefined}
    >
      {current ? (
        <div className={hideBadge ? 'absolute inset-0 origin-[72%_26%] scale-[1.14]' : 'contents'}>
          {under && under !== current && (
            <img src={under} alt="" aria-hidden draggable={false} className={`absolute inset-0 h-full w-full ${fitCls}`} />
          )}
          <img
            key={current}
            src={current}
            alt={alt}
            draggable={false}
            decoding="async"
            onLoad={() => setUnder(null)}
            onClick={() => { if (!swiped.current) onOpen?.() }}
            className={`cma-comp-photo absolute inset-0 h-full w-full ${fitCls} ${onOpen ? 'cursor-pointer' : ''}`}
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center"><Home className="h-8 w-8 text-gray-300 dark:text-gray-600" /></div>
      )}
      {children}
      {total > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={e => { e.stopPropagation(); go(-1) }} className={`${arrowCls} ${compact ? 'left-1.5' : 'left-2.5'}`}>
            <ChevronLeft className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </button>
          <button type="button" aria-label="Next photo" onClick={e => { e.stopPropagation(); go(1) }} className={`${arrowCls} ${compact ? 'right-1.5' : 'right-2.5'}`}>
            <ChevronRight className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          </button>
          {counter && (
            <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-[2] rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black tabular-nums text-white print:hidden">{index + 1} / {total}</span>
          )}
          {dots && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[2] flex justify-center gap-1 print:hidden">
              {photos.slice(0, 8).map((_, i) => {
                const on = total <= 8 ? i === index : i === Math.round((index / (total - 1)) * 7)
                return <span key={i} className={`h-1.5 rounded-full bg-white shadow transition-all duration-200 ${on ? 'w-4 opacity-100' : 'w-1.5 opacity-60'}`} />
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Thumbnails under a viewer - the current one ringed in gold and slid into view (the strip moves, never the page). */
export function PhotoThumbs({ photos, index, onPick, className = '', size = 'md' }: { photos: string[]; index: number; onPick: (i: number) => void; className?: string; size?: 'sm' | 'md' }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    const strip = stripRef.current, thumb = refs.current[index]
    if (!strip || !thumb) return
    const left = thumb.offsetLeft
    if (left < strip.scrollLeft || left + thumb.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: Math.max(0, left - (strip.clientWidth - thumb.offsetWidth) / 2), behavior: 'smooth' })
    }
  }, [index])
  if (photos.length < 2) return null
  return (
    <div ref={stripRef} className={`scrollbar-hide relative flex gap-1.5 overflow-x-auto p-0.5 print:hidden ${className}`}>
      {photos.map((url, i) => (
        <button
          key={`${url}-${i}`}
          type="button"
          ref={el => { refs.current[i] = el }}
          onClick={() => onPick(i)}
          aria-label={`Photo ${i + 1}`}
          aria-current={i === index}
          className={`shrink-0 overflow-hidden rounded-lg ring-2 transition duration-200 [-webkit-tap-highlight-color:transparent] ${size === 'sm' ? 'h-9 w-12' : 'h-11 w-[3.75rem]'} ${i === index ? 'opacity-100 ring-[#C9A24D]' : 'opacity-60 ring-transparent hover:opacity-100'}`}
        >
          <img src={url} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  )
}
