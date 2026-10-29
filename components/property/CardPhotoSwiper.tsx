'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// A listing card's photo you can flip through without opening the home (user, 10/27) - Discovery
// and Showcase cards: swipe on a phone (native scroll-snap, so it glides and settles like the
// Photos app), small arrows on a computer when the pointer is over the photo, dots for where you
// are. Photos past the next one aren't loaded until someone flips toward them, so a page of cards
// still loads like one photo each.
export default function CardPhotoSwiper({ photos, alt, sizes, priority = false, imgClassName = '', dotsClassName = 'bottom-2.5 md:bottom-2' }: {
  photos: string[]; alt: string; sizes: string; priority?: boolean
  /** Extra classes for each photo (hover zoom etc.). */
  imgClassName?: string
  /** Where the dots sit, when the card has its own pill at the bottom centre. */
  dotsClassName?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const [reach, setReach] = useState(1)
  const n = photos.length

  // Start the cover photo about two phone screens before the card scrolls into view (user, 10/28:
  // on an iPhone the photos only started as they came on screen, so each one drew in while you
  // watched). The browser's own lazy loading waits far too long, and each MLS photo is shrunk
  // from 2048px on its first request, so it needs the head start.
  const [near, setNear] = useState(priority)
  useEffect(() => {
    const el = track.current
    if (near || !el) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setNear(true) }, { rootMargin: '1600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  // Each photo shows once it has fully arrived (a soft fade over the grey box) instead of
  // painting top-down and leaving a blank band under the half-drawn part.
  const [shown, setShown] = useState<Record<number, true>>({})
  // Backup: a photo that finished before the page woke up (cached, or loaded from the server's
  // first paint) may never report it, and must not stay hidden.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const done: Record<number, true> = {}
      track.current?.querySelectorAll<HTMLImageElement>('img[data-k]').forEach(img => {
        if (img.complete && img.naturalWidth) done[Number(img.dataset.k)] = true
      })
      if (Object.keys(done).length) setShown(s => ({ ...s, ...done }))
    }, 1200)
    return () => window.clearTimeout(t)
  }, [near, reach])

  // Where a swipe was heading (-1 back, 1 forward, 0 none) - so a slow drag that stops between two
  // photos settles on the one it was going toward.
  const heading = useRef(0)
  const touching = useRef(false)
  const settleTimer = useRef<number | undefined>(undefined)
  // Always land on a whole photo: if the browser leaves the strip between two (it did on some pages,
  // and iPhone Safari can skip the strip's own snapping), glide to the nearest one, in the direction
  // the finger was going.
  const settle = () => {
    const el = track.current
    if (!el || !el.clientWidth || touching.current) return
    const pos = el.scrollLeft / el.clientWidth
    if (Math.abs(pos - Math.round(pos)) * el.clientWidth <= 3) return
    const k = heading.current > 0 ? Math.ceil(pos) : heading.current < 0 ? Math.floor(pos) : Math.round(pos)
    heading.current = 0
    goTo(Math.max(0, Math.min(n - 1, k)))
  }
  const onScroll = () => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const k = Math.round(el.scrollLeft / el.clientWidth)
    if (k !== at) setAt(k)
    if (k + 1 > reach) setReach(k + 1)
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(settle, 160)
  }
  const goTo = (k: number) => {
    const el = track.current
    if (!el) return
    setReach(r => Math.max(r, k + 1))
    el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' })
  }
  const go = (step: number) => (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    goTo((at + step + n) % n)
  }
  // Backup for iPhone Safari (user, 10/27: photos wouldn't swipe there): a clear sideways swipe that
  // didn't move the strip on its own still turns the photo.
  const touch = useRef<{ x: number; y: number; left: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touching.current = true
    touch.current = t && track.current ? { x: t.clientX, y: t.clientY, left: track.current.scrollLeft } : null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current, t = e.changedTouches[0], el = track.current
    touching.current = false
    touch.current = null
    if (!s || !t || !el || n < 2) return
    const dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.3) return
    heading.current = dx < 0 ? 1 : -1
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(settle, 160)
    window.setTimeout(() => {
      if (Math.abs(el.scrollLeft - s.left) > 4) return
      goTo(Math.max(0, Math.min(n - 1, at + (dx < 0 ? 1 : -1))))
    }, 90)
  }

  return (
    <div className="group/photos absolute inset-0">
      <div
        ref={track}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        data-card-photos
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, k) => (
          <div key={k} className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden">
            {k <= reach && (
              <Image
                src={src}
                alt={k ? `${alt} - photo ${k + 1}` : alt}
                fill
                draggable={false}
                data-k={k}
                onLoad={() => setShown(s => (s[k] ? s : { ...s, [k]: true }))}
                className={`ohp-mls-crop object-cover transition-[transform,opacity] duration-500 ${shown[k] ? 'opacity-100' : 'opacity-0'} ${imgClassName || 'group-hover:scale-105'}`}
                sizes={sizes}
                priority={priority && k === 0}
                loading={k === 0 && near ? 'eager' : 'lazy'}
              />
            )}
          </div>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" onClick={go(-1)} aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-900 opacity-0 shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:scale-110 hover:bg-white focus-visible:opacity-100 group-hover/photos:opacity-100 md:grid">
            <ChevronLeft size={15} strokeWidth={2.75} />
          </button>
          <button type="button" onClick={go(1)} aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-900 opacity-0 shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:scale-110 hover:bg-white focus-visible:opacity-100 group-hover/photos:opacity-100 md:grid">
            <ChevronRight size={15} strokeWidth={2.75} />
          </button>
          {/* Up to 5 dots that slide along with you; the one you're on is a wider pill. */}
          <div className={`pointer-events-none absolute inset-x-0 z-10 flex justify-center gap-1 ${dotsClassName}`}>
            {photos.map((_, k) => {
              const start = Math.min(Math.max(0, at - 2), Math.max(0, n - 5))
              if (k < start || k >= start + 5) return null
              return (
                <span key={k} className={`h-1.5 rounded-full bg-white shadow-[0_0_3px_rgba(0,0,0,0.6)] transition-all duration-300 ${k === at ? 'w-4 opacity-100' : 'w-1.5 opacity-60'}`} />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
