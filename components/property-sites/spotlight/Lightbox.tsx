'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Grid3x3, X } from 'lucide-react'
import { usePresence } from './motion'

// Full-screen photo viewer shared by both Spotlight templates: arrow keys / swipe to move, Esc to
// close, a thumbnail rail to jump, and an "all photos" grid view - the way every serious listing
// portal presents a home's photos. Always dark regardless of template (photos read best on black).
// The photos sit side by side in a snapping strip (user, 10/24): on a phone the photo follows the
// finger and the next one slides in with it, like the Photos app - not a jump after letting go.
export default function Lightbox({
  photos: photosIn, index: indexIn, onClose, onIndex, title,
}: {
  photos: string[]
  index: number | null
  onClose: () => void
  onIndex: (i: number) => void
  title: string
}) {
  const [grid, setGrid] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const open = indexIn !== null
  // The page clears the photos the moment it closes - keep the last set on screen while the
  // viewer fades away.
  const last = useRef<{ photos: string[]; index: number } | null>(null)
  if (open && photosIn.length) last.current = { photos: photosIn, index: indexIn }
  const { show, closing } = usePresence(open, 220)
  const photos = open ? photosIn : last.current?.photos || []
  const index = open ? indexIn : show ? last.current?.index ?? null : null
  const count = photos.length

  const go = useCallback((delta: number) => {
    if (index === null || count === 0) return
    onIndex((index + delta + count) % count)
  }, [index, count, onIndex])

  useEffect(() => {
    if (!open) { setGrid(false); return }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [open, go, onClose])

  // Keep the active thumbnail in view as the visitor arrows through a long set.
  useEffect(() => {
    if (index === null || !railRef.current) return
    const rail = railRef.current
    const el = rail.querySelector<HTMLElement>(`[data-thumb="${index}"]`)
    // Scroll the rail itself (scrollIntoView could also nudge the swipe strip / page).
    if (el) rail.scrollTo({ left: el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [index])

  // ---- the swipe strip: one full-width cell per photo, snapping into place.
  const trackRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(index)
  indexRef.current = index
  // The index the strip itself just reported (a swipe) - the strip is already there, so the
  // "move the strip to the new photo" effect below must not scroll it again mid-swipe.
  const fromSwipe = useRef<number | null>(null)
  const stripShown = show && !grid && index !== null
  // Opening (or coming back from the grid): jump straight to the photo, no glide.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!stripShown || !track || indexRef.current === null) return
    track.scrollLeft = indexRef.current * track.clientWidth
  }, [stripShown])
  useEffect(() => {
    const track = trackRef.current
    if (!track || index === null) return
    if (fromSwipe.current === index) { fromSwipe.current = null; return }
    const target = index * track.clientWidth
    if (Math.abs(track.scrollLeft - target) < 2) return
    const far = Math.abs(track.scrollLeft - target) > track.clientWidth * 1.5 // e.g. last -> first
    track.scrollTo({ left: target, behavior: far ? 'auto' : 'smooth' })
  }, [index])
  // Rotating the phone changes the cell width - stay on the same photo.
  useEffect(() => {
    if (!stripShown) return
    const onResize = () => {
      const track = trackRef.current
      if (track && indexRef.current !== null) track.scrollLeft = indexRef.current * track.clientWidth
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [stripShown])
  const onTrackScroll = () => {
    const track = trackRef.current
    if (!track || !track.clientWidth) return
    const i = Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / track.clientWidth)))
    if (i !== indexRef.current) { fromSwipe.current = i; onIndex(i) }
  }

  if (!show || index === null || !photos[index]) return null

  return (
    <div className={`sp-lb fixed inset-0 z-[200] flex flex-col bg-black/[0.97] text-white ${closing ? 'is-closing pointer-events-none' : ''}`} role="dialog" aria-modal="true" aria-label={`${title} photos`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="min-w-0 truncate text-xs font-medium tracking-wide text-white/60">
          <span className="font-semibold text-white">{index + 1}</span> / {count}
          <span className="ml-3 hidden sm:inline">{title}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGrid(g => !g)}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${grid ? 'bg-white text-black' : 'bg-white/10 hover:bg-white/20'}`}
            aria-pressed={grid}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> All photos
          </button>
          <button ref={closeRef} onClick={onClose} className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20" aria-label="Close photos">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {grid ? (
        <div className="flex-1 overflow-y-auto px-3 pb-8 sm:px-6">
          <div className="sp-lb-grid mx-auto grid max-w-6xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((src, i) => (
              <button
                key={src + i}
                style={{ ['--i' as string]: i }}
                onClick={() => { onIndex(i); setGrid(false) }}
                className={`group relative aspect-[4/3] overflow-hidden rounded-lg ${i === index ? 'ring-2 ring-white' : ''}`}
                aria-label={`Open photo ${i + 1}`}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            className="relative flex min-h-0 flex-1 select-none"
            onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
            onTouchEnd={e => {
              const start = touch.current
              touch.current = null
              if (!start) return
              const dx = e.changedTouches[0].clientX - start.x
              const dy = e.changedTouches[0].clientY - start.y
              // Side to side is the strip's own scrolling; a firm pull down closes the viewer.
              if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.4) onClose()
            }}
          >
            <div
              ref={trackRef}
              onScroll={onTrackScroll}
              className="sp-lb-track flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((src, i) => (
                <div key={src + i} className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-2 sm:px-16" aria-hidden={i !== index}>
                  {/* Only the photos around the one on screen are loaded - a 40-photo listing stays light. */}
                  {Math.abs(i - index) <= 2 || (index === 0 && i === count - 1) || (index === count - 1 && i === 0) ? (
                    <img
                      src={src}
                      alt={`${title} - photo ${i + 1} of ${count}`}
                      className="max-h-full max-w-full object-contain"
                      draggable={false}
                    />
                  ) : null}
                </div>
              ))}
            </div>
            {count > 1 && (
              <>
                <button onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 transition hover:bg-white/25 sm:left-4 sm:block" aria-label="Previous photo">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button onClick={() => go(1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 transition hover:bg-white/25 sm:right-4 sm:block" aria-label="Next photo">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          {count > 1 && (
            <div ref={railRef} className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:justify-center sm:px-6 [&::-webkit-scrollbar]:hidden">
              {photos.map((src, i) => (
                <button
                  key={src + i}
                  data-thumb={i}
                  onClick={() => onIndex(i)}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition ${i === index ? 'opacity-100 ring-2 ring-white' : 'opacity-45 hover:opacity-80'}`}
                  aria-label={`Photo ${i + 1}`}
                  aria-current={i === index}
                >
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <style>{`
        @keyframes spLightboxIn { from { opacity: 0; transform: scale(.985) } to { opacity: 1; transform: none } }
        @keyframes spLbFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spLbOut { to { opacity: 0; transform: scale(.985) } }
        .sp-lb { animation: spLbFade .25s ease both }
        .sp-lb.is-closing { animation: spLbOut .22s cubic-bezier(.4,0,1,1) both }
        .sp-lightbox-img { animation: spLightboxIn .35s cubic-bezier(.2,.7,.2,1) both }
        .sp-lb-grid > * { animation: spLightboxIn .4s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(min(var(--i, 0), 12) * 25ms) }
        @media (prefers-reduced-motion: reduce) { .sp-lightbox-img, .sp-lb, .sp-lb-grid > * { animation: none } }
      `}</style>
    </div>
  )
}
