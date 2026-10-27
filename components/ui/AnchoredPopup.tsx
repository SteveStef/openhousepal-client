'use client'

// Pop-ups that open on top of the page instead of inside the card they sit in.
//
// A list or menu drawn `absolute` inside its parent gets cut off by any card with overflow
// hidden/auto/clip (setup's step card, a Featured "Source" box, a modal's scroll area), hidden
// behind a later sibling's stacking context (the website editor's live preview), or pushed off the
// side of a phone. Owner, 10/26: "Polish with AI" in Setup lost its button that way - see
// components/ai/AiWriteButton.tsx for the first fix. This file is the same idea, shared:
//
// - `useAnchoredStyle` - a `position: fixed` box measured from the field/button it belongs to:
//   under it when there's room, flipped above when there isn't, kept on screen sideways, capped to
//   the visible height (the iPhone keyboard shrinks that - visualViewport), and following on
//   scroll/resize.
// - `PopupPortal` - renders into <body>, keeping a force-light form light.
// - `PopupSheet` - phones: a bottom sheet with a backdrop and safe-area padding, for menus and
//   info boxes (type-ahead lists stay anchored to their field so the keyboard and field stay put).

import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export const POPUP_Z = 10002
const MARGIN = 8

/** True below 640px (Tailwind's `sm`) - only listens while `active`. */
export function usePhoneWidth(active = true): boolean {
  const [phone, setPhone] = useState(false)
  useLayoutEffect(() => {
    if (!active) return
    const on = () => setPhone(window.innerWidth < 640)
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [active])
  return phone
}

type Place = {
  /** 'anchor' = as wide as the field/button (default) */
  width?: number | 'anchor'
  minWidth?: number
  /** the list's tallest size; it shrinks to fit the space it gets */
  maxHeight?: number
  /** line up with the anchor's left edge (default) or right edge */
  align?: 'left' | 'right'
  gap?: number
}

const HIDDEN: CSSProperties = { position: 'fixed', top: 0, left: 0, visibility: 'hidden', zIndex: POPUP_Z }

/** Style for a `position: fixed` pop-up tied to `anchorRef`. Put `panelRef` on the pop-up itself. */
export function useAnchoredStyle(
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  { width = 'anchor', minWidth = 0, maxHeight = 320, align = 'left', gap = 6 }: Place = {},
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(HIDDEN)
  useLayoutEffect(() => {
    if (!open) { setStyle(HIDDEN); return }
    let raf = 0
    const place = () => {
      const a = anchorRef.current
      if (!a) return
      const r = a.getBoundingClientRect()
      const vv = window.visualViewport
      const viewTop = vv ? vv.offsetTop : 0
      const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
      const vw = document.documentElement.clientWidth || window.innerWidth
      const w = Math.min(Math.max(width === 'anchor' ? r.width : width, minWidth), vw - MARGIN * 2)
      const left = Math.min(Math.max(MARGIN, align === 'right' ? r.right - w : r.left), vw - w - MARGIN)
      const below = viewBottom - r.bottom - gap - MARGIN
      const above = r.top - viewTop - gap - MARGIN
      const need = Math.min(panelRef.current?.scrollHeight || maxHeight, maxHeight)
      const flip = below < need && above > below
      const room = Math.max(96, Math.floor(flip ? above : below))
      const h = Math.min(need, room)
      const next: CSSProperties = {
        position: 'fixed', zIndex: POPUP_Z, left: Math.round(left), width: Math.round(w),
        top: Math.round(flip ? r.top - gap - h : r.bottom + gap), maxHeight: Math.min(maxHeight, room),
      }
      setStyle(prev => (prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.maxHeight === next.maxHeight && prev.visibility !== 'hidden' ? prev : next))
    }
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place) }
    place()
    const vv = window.visualViewport
    window.addEventListener('resize', later)
    window.addEventListener('scroll', later, true)
    vv?.addEventListener('resize', later)
    vv?.addEventListener('scroll', later)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(later) : null
    if (anchorRef.current) ro?.observe(anchorRef.current)
    if (panelRef.current) ro?.observe(panelRef.current)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', later)
      window.removeEventListener('scroll', later, true)
      vv?.removeEventListener('resize', later)
      vv?.removeEventListener('scroll', later)
      ro?.disconnect()
    }
  }, [open, anchorRef, panelRef, width, minWidth, maxHeight, align, gap])
  return style
}

/** Renders into <body>. Pass `from` (the field/button) so a force-light form keeps its light look. */
export function PopupPortal({ children, from }: { children: ReactNode; from?: RefObject<HTMLElement | null> }) {
  // Pop-ups only render after a tap or keystroke, so <body> is always there by then.
  if (typeof document === 'undefined') return null
  const light = !!from?.current?.closest('.ohp-force-light')
  return createPortal(light ? <div className="ohp-force-light" style={{ display: 'contents' }}>{children}</div> : children, document.body)
}

/** Phones: a bottom sheet over a dimmed page. Escape or a tap on the backdrop closes it. */
export function PopupSheet({ open, onClose, title, children, panelRef }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  panelRef?: RefObject<HTMLDivElement | null>
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <PopupPortal>
      <div className="fixed inset-0 bg-black/45" style={{ zIndex: POPUP_Z - 1 }} onClick={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true"
        className="fixed inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.35)] dark:border-gray-700 dark:bg-[#1A1A1C]"
        style={{ zIndex: POPUP_Z }}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </PopupPortal>
  )
}
