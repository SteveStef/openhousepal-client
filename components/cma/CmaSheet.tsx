'use client'

// A CMA builder window with the Showcase sheet mechanics (components/ui/windowMotion): on a phone
// a sheet that slides up, pulls down to close (from anywhere that isn't a text box or a scrolled
// list) and keeps a pinned footer; on a wide screen a centred window that springs into place. The
// page behind is pinned while it's open. Used across the CMA builder (Refine Your Search, the lot-size
// question, the Review editor's sheets).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

export default function CmaSheet({ open, onClose, title, subtitle, headerRight, footer, children, maxWidth = 'sm:max-w-4xl' }: {
  open: boolean, onClose: () => void, title: string, subtitle?: React.ReactNode, headerRight?: React.ReactNode,
  footer?: React.ReactNode, children: React.ReactNode, maxWidth?: string,
}) {
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone && open)
  const releasePagePin = usePagePin(open)
  useEscapeToClose(onClose, open)
  // Backstop (11/15): the close animation normally takes the window off the page when it finishes. If the page
  // re-draws while it is closing (an autosave landing, a report coming back from the server) that hand-off can
  // be missed, and the closed window stays - invisible, on top of everything, swallowing every tap. So a closed
  // window is ALSO taken off by a timer, a little after its close animation would have ended.
  const [gone, setGone] = useState(!open)
  useEffect(() => {
    if (open) { setGone(false); return }
    const t = setTimeout(() => { setGone(true); releasePagePin() }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  if (typeof document === 'undefined' || (gone && !open)) return null
  return createPortal(
    <AnimatePresence onExitComplete={releasePagePin}>
      {open && (
        <motion.div key="cma-sheet" data-scroll-lock="off" className="cma-touch fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" onClick={onClose}>
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[#0B0B0B]/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: 0.22 } }}
          />
          <motion.div
            ref={sheetRef}
            {...sheetMotion}
            style={{ y: phone && !reduce ? y : undefined }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={e => e.stopPropagation()}
            className={`relative flex max-h-[calc(100%-2.5rem)] w-full flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl dark:bg-[#151517] sm:max-h-[88vh] sm:rounded-[28px] ${maxWidth}`}
          >
            <div className="z-10 border-b border-gray-100 bg-white px-4 pb-3 pt-1.5 dark:border-gray-800 dark:bg-[#151517] sm:px-6 sm:py-4">
              <div aria-hidden className="mx-auto mb-2 h-[5px] w-10 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden" />
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-black tracking-tight text-gray-900 dark:text-white sm:text-2xl">{title}</h2>
                  {subtitle && <div className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{subtitle}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {headerRight}
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                    onClick={onClose}
                    aria-label="Close"
                    className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-[#111827] dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                </div>
              </div>
            </div>
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">{children}</div>
            {footer && (
              <div className="border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-gray-800 dark:bg-[#151517] sm:px-6 sm:py-4">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
