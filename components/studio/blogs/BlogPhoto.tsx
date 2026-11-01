'use client'

import { useEffect, useRef, useState } from 'react'
import { resolveMediaUrl } from '@/lib/api-service'
import { sizedImage, sizedSrcSet } from '@/lib/siteImage'

// A home or town photo inside an article, loaded the way the Agent Hub's Sales page loads its
// cards: right-sized WebP/AVIF through the site's photo resizer (lib/siteImage) instead of the
// full 1-2 MB Bright MLS JPEG over plain http. 11/01: on a phone, scrolling the blog showed those
// big JPEGs half-drawn (top strip of the house, grey below). The photo also stays invisible until
// it has completely loaded, then fades in over its frame's placeholder - never a partial picture.
// If the resizer can't serve it, the original address is used instead.

export default function BlogPhoto({ src, width, widths, sizes, alt = '', className = '', eager = false }: {
  src?: string | null
  /** About how wide it shows (CSS px) - the size picked when the browser can't use the srcset. */
  width: number
  widths?: readonly number[]
  /** Layout width hint for the srcset, e.g. "(min-width: 640px) 280px, 100vw". */
  sizes?: string
  alt?: string
  className?: string
  /** Above the fold: load now instead of when it scrolls near. */
  eager?: boolean
}) {
  const url = src ? resolveMediaUrl(src) : ''
  const [direct, setDirect] = useState(false)
  const [ready, setReady] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => { setDirect(false); setReady(false) }, [url])
  // Already loaded before React hydrated (cached photo) - onLoad won't fire again.
  useEffect(() => { const el = ref.current; if (el?.complete && el.naturalWidth) setReady(true) }, [url, direct])
  if (!url) return null
  const resized = sizedImage(url, width)
  const useResized = !direct && resized !== url
  return (
    <img
      ref={ref}
      src={useResized ? resized : url}
      srcSet={useResized ? sizedSrcSet(url, widths ? [...widths] : undefined) || undefined : undefined}
      sizes={useResized ? sizes : undefined}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onLoad={() => setReady(true)}
      onError={() => { if (useResized) setDirect(true) }}
      className={/\btransition\b/.test(className) ? className : `${className} transition-opacity duration-500`}
      style={ready ? undefined : { opacity: 0 }}
    />
  )
}
