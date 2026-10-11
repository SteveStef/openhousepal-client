'use client'

import { useEffect, useRef } from 'react'

// Replay-safe vertical auto-scroll for the "scroll through the whole real page" demos (Agent Hub,
// IDX, Spotlight). The translateY is a PURE function of `stop` - there is no separate "scrolled"
// boolean or live-measured distance that can mutate mid-animation and make the content lurch
// (that was the old up/down "bounce" on replay). Each stop is a short ease; the parent owns the
// hold timing between stops via its own beat timeline. On the wrap back to stop 0 the transition
// is suppressed for one frame so it snaps instead of reverse-scrolling the whole page.
export default function DemoScroller({
  offsets,
  stop,
  transitionMs = 1400,
  children,
  className = '',
}: {
  offsets: number[] // translateY px for each stop; offsets[0] should be 0
  stop: number
  transitionMs?: number
  children: React.ReactNode
  className?: string
}) {
  const clamped = Math.max(0, Math.min(stop, offsets.length - 1))
  const y = offsets[clamped] ?? 0
  const prev = useRef(clamped)
  const snap = clamped === 0 && prev.current !== 0
  useEffect(() => {
    prev.current = clamped
  }, [clamped])

  return (
    <div className={`h-[420px] overflow-hidden relative ${className}`}>
      <div
        className="absolute inset-x-0 top-0 will-change-transform"
        style={{
          transform: `translate3d(0, -${y}px, 0)`,
          transition: snap ? 'none' : `transform ${transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

// A small horizontal auto-advancing carousel track (Recent Sales / Videos shelves). Pure function
// of `index`; loops. Items are laid out in a flex row and the whole row translates.
export function CarouselTrack({
  index,
  itemPercent = 100,
  gapPx = 8,
  children,
}: {
  index: number
  itemPercent?: number
  gapPx?: number
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden">
      <div
        className="flex"
        style={{
          gap: gapPx,
          transform: `translateX(calc(-${index} * (${itemPercent}% + ${gapPx}px)))`,
          transition: 'transform 650ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
