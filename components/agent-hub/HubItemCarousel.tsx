'use client'

import { useEffect, useState, ReactNode } from 'react'

// Generic auto-advancing "1 item at a time" carousel shared by Videos, House Tours, and Blogs
// sections (Recent Sales has its own variant since its slide shape differs - see RecentSalesCarousel).
export default function HubItemCarousel<T extends { id: string }>({
  items,
  renderSlide,
  height,
  aspectRatio = '16 / 9',
  intervalMs = 4000,
  dotsTone = 'light',
  showDots = true,
}: {
  items: T[]
  renderSlide: (item: T) => ReactNode
  height?: number
  // Used instead of `height` when no fixed height is given, so slides (e.g. video
  // thumbnails) keep correct proportions at any viewport width instead of a fixed
  // px height cropping/zooming differently on narrow mobile screens.
  aspectRatio?: string
  intervalMs?: number
  dotsTone?: 'light' | 'dark'
  showDots?: boolean
}) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (items.length <= 1 || paused) return
    const timer = setInterval(() => setIndex(current => (current + 1) % items.length), intervalMs)
    return () => clearInterval(timer)
  }, [items.length, paused, intervalMs])

  useEffect(() => {
    if (index >= items.length) setIndex(0)
  }, [items.length, index])

  if (!items.length) return null

  const dotActive = dotsTone === 'light' ? 'bg-white' : 'bg-[#111827] dark:bg-white'
  const dotInactive = dotsTone === 'light' ? 'bg-white/50' : 'bg-[#111827]/30 dark:bg-white/30'

  return (
    <div
      className="relative w-full overflow-hidden rounded-[18px]"
      style={height ? { height } : { aspectRatio }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex h-full transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map(item => (
          <div key={item.id} className="h-full w-full shrink-0">{renderSlide(item)}</div>
        ))}
      </div>

      {showDots && items.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {items.map((item, slideIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={(event) => { event.preventDefault(); setIndex(slideIndex) }}
              className={`h-1.5 rounded-full transition-all ${slideIndex === index ? `w-5 ${dotActive}` : `w-1.5 ${dotInactive}`}`}
              aria-label={`Go to slide ${slideIndex + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
