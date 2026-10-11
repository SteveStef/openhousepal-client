'use client'

import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import { MousePointer2 } from 'lucide-react'

// A mouse pointer that really travels to the element it "clicks": `target` is a CSS selector
// (e.g. [data-cursor="approve"]) inside `container`, measured from the real layout, so the click
// always lands on the button you see. The container must be `relative`. Click ripple when `click`.
// `moveKey`: change it to re-measure when a new screen reuses the same selector.
export default function DemoCursor({ container, target, click = false, moveKey }: { container: RefObject<HTMLElement | null>; target: string | null; click?: boolean; moveKey?: string | number }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const root = container.current
    if (!root || !target) return
    const measure = () => {
      const el = root.querySelector<HTMLElement>(target)
      if (!el) return
      // Walk offsetParents up to the container - layout pixels, unaffected by CSS scale/zoom.
      let x = el.offsetWidth * 0.55, y = el.offsetHeight * 0.55
      let n: HTMLElement | null = el
      while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null }
      if (n === root) setPos({ x, y })
    }
    measure()
    const t = setTimeout(measure, 120) // after enter animations settle
    return () => clearTimeout(t)
  }, [container, target, moveKey])

  const shown = !!target && !!pos
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{
        transform: `translate(${pos?.x ?? 0}px, ${pos?.y ?? 0}px)`,
        opacity: shown ? 1 : 0,
        transition: 'transform 850ms cubic-bezier(.45,.05,.35,1), opacity 300ms ease',
      }}
    >
      {click && shown && (
        <>
          <span className="absolute -left-3 -top-3 h-7 w-7 animate-ping rounded-full bg-[#C9A24D]/45" />
          <span className="absolute -left-1.5 -top-1.5 h-4 w-4 rounded-full bg-[#C9A24D]/40" />
        </>
      )}
      <MousePointer2 className={`relative h-5 w-5 text-[#111827] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)] transition-transform duration-150 dark:text-white ${click ? 'scale-90' : ''}`} fill="currentColor" strokeWidth={1.5} />
    </span>
  )
}
