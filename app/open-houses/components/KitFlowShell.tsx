'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

// The whole "Generate Kit" flow after the address - Similar Homes, cover photo, Cheat Sheet photos,
// Review, Guests - in one pop-out window over the Opens page (user, 10/16). The window itself opens
// once; inside it each step slides in, and every step change (and every results page) brings the
// window back to the top. Nothing animates its height, so filters never make the page jump.

export type KitFlowStepId = 'similar' | 'cover' | 'cheat' | 'kit' | 'guests'

const STEP_LABEL: Record<KitFlowStepId, string> = { similar: 'Similar Homes', cover: 'Cover photo', cheat: 'Cheat Sheet', kit: 'Your kit', guests: 'Guests' }

// Steps inside the window call this to go back to the top (e.g. results page 2).
const ScrollTopContext = createContext<(() => void) | null>(null)
export const useKitFlowScrollTop = () => useContext(ScrollTopContext)

export default function KitFlowShell({ steps, current, contentKey, title, address, photo, onClose, children }: {
  steps: KitFlowStepId[]
  current: KitFlowStepId
  /** What slides in/out - Review's Your kit / Guests share one so it isn't rebuilt between them. */
  contentKey?: string
  title: string
  address: string
  photo?: string | null
  onClose: () => void
  children: React.ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const scrollTop = useCallback(() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }), [])
  useEffect(() => { scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }) }, [current])
  // The page behind doesn't scroll while the window is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  const at = Math.max(0, steps.indexOf(current))

  if (typeof document === 'undefined') return null
  return createPortal(
    <motion.div ref={scroller} className="fixed inset-0 z-[120] overflow-y-auto bg-black/60 p-2 sm:p-5 print:hidden" style={{ overscrollBehavior: 'contain' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative mx-auto w-full max-w-[1240px] overflow-hidden rounded-[1.6rem] border border-white/50 bg-[#FAFAF7] shadow-2xl sm:rounded-[2rem] dark:border-gray-800 dark:bg-[#151517]">
        <ScrollTopContext.Provider value={scrollTop}>
          {/* header: the home, this step's name, where you are in the flow */}
          <div className="border-b border-gray-200/60 bg-white/60 px-4 py-3.5 sm:px-8 sm:py-4 dark:border-gray-800 dark:bg-[#0B0B0B]/50">
            <div className="flex items-center gap-3">
              {photo && <span className="h-11 w-11 shrink-0 rounded-xl bg-cover bg-center shadow-inner ring-1 ring-black/5 sm:h-12 sm:w-12" style={{ backgroundImage: `url(${photo})` }} />}
              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h3 key={title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}
                    className="truncate text-lg font-black tracking-tight text-[#0B0B0B] sm:text-2xl dark:text-white">{title}</motion.h3>
                </AnimatePresence>
                <p className="truncate text-xs font-medium text-[#6B7280] sm:text-sm dark:text-gray-400">{address}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" title="Leave the kit (nothing is saved)"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:rotate-90 hover:text-[#111827] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400 dark:hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {steps.length > 1 && (
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                {steps.map((s, i) => (
                  <React.Fragment key={s}>
                    {i > 0 && <span className={`h-px w-4 shrink-0 transition-colors duration-500 sm:w-8 ${i <= at ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-700'}`} />}
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors duration-500 ${i === at
                      ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
                      : i < at ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-400'}`}>
                      {i < at ? <Check className="h-3 w-3" strokeWidth={3.5} /> : <span>{i + 1}</span>}{STEP_LABEL[s]}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={contentKey ?? current} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </ScrollTopContext.Provider>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
