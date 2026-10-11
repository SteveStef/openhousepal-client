'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'
import LeadDetailPanel from './LeadDetailPanel'
import { backdropMotion, panelMotion, useLastValue } from '@/components/ui/windowMotion'

interface LeadDetailModalProps {
  /** The lead to show. Pass null (instead of unmounting) to let the window animate closed. */
  leadId: string | null
  onClose: () => void
  // Fired after any edit inside the panel (status, represented, tags, contacted) so the
  // Leads list underneath can resync without a full page reload.
  onChanged?: () => void
}

// Opens a lead over the current list (closing leaves the list's scroll and filters as they were).
// On a phone it's a full screen of its own with a back bar on top; on bigger screens a centered
// window. Same open/close feel as the app's other windows (windowMotion): the backdrop fades, the
// window springs up, and on close it drops away.
//
// Smooth scrolling: the window has exactly ONE scroller (the body below), the backdrop is a plain
// dark scrim - no backdrop blur (blurring the live, animated page behind it made every scrolled
// frame re-blur the whole screen) - and the scroller is opaque so the browser can scroll it on
// the GPU without repainting.
export default function LeadDetailModal({ leadId, onClose, onChanged }: LeadDetailModalProps) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Keep showing the lead while the window animates closed.
  const shownId = useLastValue(leadId)
  const open = !!leadId

  // The page behind shouldn't scroll while a lead is open (and shouldn't jump sideways when its
  // scrollbar goes away); Esc closes it.
  useEffect(() => {
    if (!open) return
    const body = document.body
    const prev = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
    const bar = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (bar > 0) body.style.paddingRight = `${bar}px`
    // Esc inside an open dropdown (status, has-an-agent) just closes that dropdown, not the lead.
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[data-lead-scroller] [role=listbox]')) return
      closeRef.current()
    }
    document.addEventListener('keydown', esc)
    return () => {
      body.style.overflow = prev.overflow
      body.style.paddingRight = prev.paddingRight
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && shownId && (
        <motion.div
          key="lead-window"
          {...backdropMotion}
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/55 sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            {...panelMotion}
            role="dialog"
            aria-modal="true"
            onClick={event => event.stopPropagation()}
            className="relative flex h-full w-full flex-col overflow-hidden bg-[#faf9f7] shadow-2xl dark:bg-[#0B0B0B] sm:h-[min(92dvh,1100px)] sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-white/50 sm:dark:border-gray-800"
          >
            {/* Phone: a back bar that stays put while the lead scrolls under it. */}
            <div className="flex shrink-0 items-center border-b border-gray-200/70 bg-[#faf9f7] px-2 py-1.5 dark:border-white/10 dark:bg-[#0B0B0B] sm:hidden">
              <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-black text-[#111827] dark:text-white">
                <ArrowLeft className="h-4 w-4" /> Leads
              </button>
            </div>
            <motion.button
              onClick={onClose}
              aria-label="Close"
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              className="absolute right-4 top-4 z-10 hidden h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 shadow-md hover:text-[#111827] dark:bg-[#151517] dark:text-gray-400 dark:hover:text-white sm:flex"
            >
              <X className="h-4 w-4" />
            </motion.button>
            <div
              data-lead-scroller
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#faf9f7] px-4 pb-12 pt-4 [will-change:scroll-position] dark:bg-[#0B0B0B] sm:px-8 sm:py-10"
            >
              <LeadDetailPanel leadId={shownId} onBack={onClose} backLabel="Close" onChanged={onChanged} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
