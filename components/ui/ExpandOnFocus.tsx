'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useIsPhone } from '@/components/ui/windowMotion'

/**
 * A small search box that grows when you tap it (user, 10/24): on a phone, focusing the input
 * inside lifts the whole box to the top of the screen, full width and bigger, over a dimmed page -
 * so a long address is readable while the keyboard is up. It's the SAME input element moving (not a
 * copy), so the keyboard never drops and nothing re-types. Tap the dimmed page (or search) and it
 * settles back into place. Desktop: renders the children untouched.
 *
 * `openClassName` styles the lifted box (give it a solid background matching the input's colours).
 */
export default function ExpandOnFocus({ children, className = '', openClassName = 'bg-white dark:bg-[#151517]', label }: {
  children: React.ReactNode
  className?: string
  openClassName?: string
  /** Small caption over the lifted box, e.g. "Search by address". */
  label?: string
}) {
  const phone = useIsPhone()
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(0)
  const [top, setTop] = useState(12)
  const boxRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)

  // Keep the lifted box just under the top of what's visible while the keyboard is up (iOS moves
  // the visual viewport rather than the page).
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    // Just under the site header while it's on screen (some pages keep the header above every
    // layer), else just under the top of the visible area.
    const place = () => {
      const header = document.querySelector('header')?.getBoundingClientRect()
      const offset = vv?.offsetTop || 0
      setTop(Math.max(offset + 12, header && header.bottom > offset ? header.bottom + 10 : 0))
    }
    place()
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    return () => { vv?.removeEventListener('resize', place); vv?.removeEventListener('scroll', place) }
  }, [open])
  useLayoutEffect(() => { if (!open && boxRef.current) setHeight(boxRef.current.offsetHeight) })
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current) }, [])

  if (!phone) return <div className={className}>{children}</div>

  const onFocus = () => {
    if (closeTimer.current) { window.clearTimeout(closeTimer.current); closeTimer.current = null }
    if (boxRef.current) setHeight(boxRef.current.offsetHeight)
    setOpen(true)
  }
  const onBlur = (e: React.FocusEvent) => {
    if (boxRef.current?.contains(e.relatedTarget as Node | null)) return
    // A beat later, so a tap on an address suggestion lands first.
    closeTimer.current = window.setTimeout(() => setOpen(false), 140)
  }

  return (
    <>
      {/* Holds the box's spot in the row while it's lifted, so nothing under it jumps. */}
      {open && <div aria-hidden className={className} style={{ height }} />}
      <motion.div
        ref={boxRef}
        layout
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        onFocus={onFocus}
        onBlur={onBlur}
        style={open ? { position: 'fixed', top, left: 12, right: 12, zIndex: 72 } : undefined}
        className={open ? `rounded-2xl p-2 shadow-[0_30px_70px_-20px_rgba(0,0,0,.65)] ring-1 ring-[#C9A24D]/40 [&_input]:!text-[17px] [&_input]:!py-3 ${openClassName}` : className}
      >
        {open && label && <p className="px-2 pb-1.5 pt-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A24D]">{label}</p>}
        {children}
      </motion.div>
      {/* Same stacking layer as the box (not portaled) so it always sits just under it. */}
      <AnimatePresence>
        {open && (
          <motion.div key="expand-backdrop" className="fixed inset-0 z-[71] bg-[#0b0b0c]/55"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            // Tapping the dimmed page puts the keyboard away, which settles the box back.
            onPointerDown={e => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur() }} />
        )}
      </AnimatePresence>
    </>
  )
}
