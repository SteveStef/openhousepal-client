'use client'

import type { ReactNode, MouseEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { backdropMotion, panelMotion } from './windowMotion'

// The shared open/close for the app's small windows (Share, Delete, Tours ...): the backdrop
// fades, the window springs up into place, and on close it drops away - same feel as the
// Showcase windows (windowMotion). The window's own panel goes in `children`, unchanged.
export default function MotionModal({ open, children, onBackdropClick, className = 'bg-black/55' }: {
  open: boolean
  children: ReactNode
  onBackdropClick?: (e: MouseEvent<HTMLDivElement>) => void
  className?: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="motion-modal" {...backdropMotion} onClick={onBackdropClick}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}>
          <motion.div {...panelMotion} className="flex w-full justify-center" onClick={e => { if (e.target === e.currentTarget) onBackdropClick?.(e as any) }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
