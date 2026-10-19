import type { CSSProperties } from 'react'
import { IMG, sizedImage, sizedSrcSet } from '@/lib/siteImage'

// A listing / town / cover photo on the agent's site: right-sized (lib/siteImage), lazy below the
// fold, decoded off the main thread. Drop-in for the old `bg-cover` divs - give it the same
// absolute/inset or h/w classes plus object-cover. Server-safe (no hooks).
export default function SitePhoto({ src, alt = '', sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw', widths = IMG.card, quality = 70, priority = false, className = '', style }: {
  src: string | null | undefined
  alt?: string
  /** What fraction of the screen the photo fills, so the browser picks the right file. */
  sizes?: string
  widths?: readonly number[]
  quality?: number
  /** Above the fold (the hero / first card): load at once, high priority. */
  priority?: boolean
  className?: string
  style?: CSSProperties
}) {
  if (!src) return null
  const set = sizedSrcSet(src, [...widths], quality)
  const fallback = sizedImage(src, widths[Math.min(widths.length - 1, Math.max(0, Math.floor(widths.length / 2)))], quality)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fallback}
      srcSet={set || undefined}
      sizes={set ? sizes : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      draggable={false}
      className={className}
      style={style}
    />
  )
}
