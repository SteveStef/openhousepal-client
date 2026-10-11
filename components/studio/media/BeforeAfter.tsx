'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Drag-to-compare slider. `before` is the untouched source photo, `after` is the generated
 * result. Both render at full wrapper size, stacked: `after` is the base layer (fills the whole
 * frame), and `before` is clipped on top from the left edge to the handle - so the LEFT of the
 * handle shows the BEFORE photo and the RIGHT shows the AFTER, matching the corner labels.
 * Nothing is ever scaled.
 */
export default function BeforeAfter({ before, after, alt = '' }: { before: string; after: string; alt?: string }) {
  const [pos, setPos] = useState(50)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.min(100, Math.max(0, pct)))
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); setFromClientX(e.clientX) }}
      onPointerMove={(e) => { if (dragging.current) setFromClientX(e.clientX) }}
      onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId) }}
    >
      {/* base layer: AFTER, full size (shows on the right of the handle) */}
      <img src={after} alt={alt} className="absolute inset-0 h-full w-full object-contain" draggable={false} />

      {/* reveal layer: BEFORE, full size, clipped to everything LEFT of the handle */}
      <img
        src={before}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />

      {/* handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
        <div className="absolute top-1/2 -ml-4 -mt-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#111827] shadow-lg">↔</div>
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">Before</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-[#C9A24D] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#111827]">After</span>
    </div>
  )
}
