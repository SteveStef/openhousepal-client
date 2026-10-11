'use client'

import { MousePointer2 } from 'lucide-react'

// A mouse pointer that glides between spots in a demo screen (x / y in % of the nearest
// positioned box) and shows a click ripple when `click` is set - so the walkthroughs read as
// someone actually using the product, not screens swapping on their own.
export default function DemoPointer({ x, y, click = false, show = true }: { x: number; y: number; click?: boolean; show?: boolean }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-50"
      style={{ left: `${x}%`, top: `${y}%`, opacity: show ? 1 : 0, transition: 'left 900ms cubic-bezier(.45,.05,.35,1), top 900ms cubic-bezier(.45,.05,.35,1), opacity 300ms ease' }}
    >
      {click && (
        <>
          <span className="absolute -left-3 -top-3 h-7 w-7 animate-ping rounded-full bg-[#C9A24D]/45" />
          <span className="absolute -left-1.5 -top-1.5 h-4 w-4 rounded-full bg-[#C9A24D]/40" />
        </>
      )}
      <MousePointer2 className={`relative h-[18px] w-[18px] text-[#111827] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)] transition-transform duration-150 dark:text-white ${click ? 'scale-90' : ''}`} fill="currentColor" strokeWidth={1.5} />
    </span>
  )
}
