'use client'

import { ReactNode } from 'react'
import HubCinema from '@/components/agent-hub/HubCinema'

// Generic auto-advancing "1 item at a time" carousel shared by the Videos, House Tours and Blogs
// sections (Recent Sales / My Listings have their own, since their slides carry home details) -
// the same HubCinema cut between slides (seam of light, the old slide sinking back).
export default function HubItemCarousel<T extends { id: string }>({
  items,
  renderSlide,
  height,
  aspectRatio = '16 / 9',
  intervalMs = 4500,
  dotsTone = 'light',
  showDots = true,
  autoScroll = true,
}: {
  items: T[]
  renderSlide: (item: T) => ReactNode
  height?: number
  // Used instead of `height` when no fixed height is given, so slides (e.g. video thumbnails)
  // keep correct proportions at any viewport width.
  aspectRatio?: string
  intervalMs?: number
  dotsTone?: 'light' | 'dark'
  showDots?: boolean
  // Defaults to true so existing callers that don't pass it keep advancing, but callers with a
  // real "Auto Scroll" toggle should pass it through.
  autoScroll?: boolean
}) {
  if (!items.length) return null
  return (
    <HubCinema
      height={height}
      aspectRatio={aspectRatio}
      intervalMs={intervalMs}
      autoScroll={autoScroll}
      showProgress={showDots}
      progressTone={dotsTone}
      slides={items.map(item => ({ id: item.id, custom: renderSlide(item) }))}
    />
  )
}
