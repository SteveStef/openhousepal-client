'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

const TOOLTIP_WIDTH = 224

export default function InfoTooltip({ text, className = '' }: { text: string; className?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  // Fixed-position coords computed from the trigger's own rect, and where to anchor the little
  // arrow within the box (may not be dead-center once the box gets nudged in from a screen edge).
  const [pos, setPos] = useState<{ top: number; left: number; arrowLeft: number; flipped: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('click', handleClickAway)
    return () => document.removeEventListener('click', handleClickAway)
  }, [isOpen])

  // Portaled to <body> instead of rendered inline - this trigger very often sits inside a small
  // scrollable list (e.g. Manage Hosts' Scheduled Opens), and an inline absolutely-positioned
  // popup gets silently clipped by that ancestor's overflow, forcing a scroll (down AND sideways,
  // since a lone overflow-y also computes overflow-x to auto) just to read the tooltip text.
  useEffect(() => {
    if (!isOpen) return
    const updatePosition = () => {
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      const iconCenter = rect.left + rect.width / 2
      const desiredLeft = iconCenter - TOOLTIP_WIDTH / 2
      const left = Math.min(Math.max(8, desiredLeft), window.innerWidth - TOOLTIP_WIDTH - 8)
      // Flip above the icon when there's not enough room below, so the box itself never runs off
      // the bottom of the viewport either.
      const flipped = rect.bottom + 90 > window.innerHeight && rect.top > 90
      setPos({
        top: flipped ? rect.top - 8 : rect.bottom + 8,
        left,
        arrowLeft: Math.min(Math.max(12, iconCenter - left), TOOLTIP_WIDTH - 12),
        flipped,
      })
    }
    updatePosition()
    const close = () => setIsOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen])

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          setIsOpen(v => !v)
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition hover:text-[#C9A24D]"
        aria-label="More info"
      >
        <Info size={13} />
      </button>
      {isOpen && pos && createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: TOOLTIP_WIDTH, transform: pos.flipped ? 'translateY(-100%)' : undefined }}
          className="z-[100] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1f] p-3 text-left text-[11px] font-semibold normal-case leading-relaxed text-gray-600 dark:text-gray-300 shadow-xl"
        >
          {text}
          <div
            style={{ left: pos.arrowLeft }}
            className={`absolute h-2 w-2 -translate-x-1/2 rotate-45 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1f] ${
              pos.flipped ? '-bottom-1 border-b border-r' : '-top-1 border-l border-t'
            }`}
          />
        </div>,
        document.body
      )}
    </div>
  )
}
