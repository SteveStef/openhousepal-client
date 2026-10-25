'use client'

// Glides to its content's height instead of snapping (owner, 10/24: switching plan cards / Bright
// vs non-Bright on a phone made everything below jump). Clips only top-to-bottom, with `room` of
// breathing space above and below (the cards' "Most Popular" badge and shadows), so nothing at the
// sides gets cut. Plain CSS transition - the homepage stays free of animation libraries.
import { useLayoutEffect, useRef, useState } from 'react'

export default function SmoothHeight({ children, className = '', room = 40 }: { children: React.ReactNode; className?: string; room?: number }) {
  const content = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = content.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      className={`motion-reduce:transition-none ${className}`}
      style={{
        height: height === null ? undefined : height + room * 2,
        transition: 'height 520ms cubic-bezier(.22,1,.36,1)',
        overflowY: 'clip', overflowX: 'visible', marginTop: -room, marginBottom: -room, paddingTop: room, boxSizing: 'border-box',
      }}
    >
      <div ref={content}>{children}</div>
    </div>
  )
}
