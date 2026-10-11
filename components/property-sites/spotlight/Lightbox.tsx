'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Grid3x3, X } from 'lucide-react'

// Full-screen photo viewer shared by both Spotlight templates: arrow keys / swipe to move, Esc to
// close, a thumbnail rail to jump, and an "all photos" grid view - the way every serious listing
// portal presents a home's photos. Always dark regardless of template (photos read best on black).
export default function Lightbox({
  photos, index, onClose, onIndex, title,
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
  const open = index !== null
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
    const el = railRef.current.querySelector<HTMLElement>(`[data-thumb="${index}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [index])

  if (!open || index === null || !photos[index]) return null

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/[0.97] text-white" role="dialog" aria-modal="true" aria-label={`${title} photos`}>
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
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((src, i) => (
              <button
                key={src + i}
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
            className="relative flex min-h-0 flex-1 select-none items-center justify-center px-2 sm:px-16"
            onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
            onTouchEnd={e => {
              const start = touch.current
              touch.current = null
              if (!start) return
              const dx = e.changedTouches[0].clientX - start.x
              const dy = e.changedTouches[0].clientY - start.y
              if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
              else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.4) onClose()
            }}
          >
            <img
              key={photos[index]}
              src={photos[index]}
              alt={`${title} - photo ${index + 1} of ${count}`}
              className="sp-lightbox-img max-h-full max-w-full object-contain"
              draggable={false}
            />
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
            {/* Preload the neighbours so arrowing never waits on a spinner. */}
            {count > 1 && (
              <div className="hidden" aria-hidden>
                <img src={photos[(index + 1) % count]} alt="" />
                <img src={photos[(index - 1 + count) % count]} alt="" />
              </div>
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
        .sp-lightbox-img { animation: spLightboxIn .35s cubic-bezier(.2,.7,.2,1) both }
        @media (prefers-reduced-motion: reduce) { .sp-lightbox-img { animation: none } }
      `}</style>
    </div>
  )
}
