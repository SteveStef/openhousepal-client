'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { FlowDockHostContext } from '@/components/ui/FlowDock'

// The whole "Generate Kit" flow after the address - Similar Homes, cover photo, Cheat Sheet photos,
// Review, Guests - in one pop-out window over the Opens page (user, 10/16). The window itself opens
// once; inside it each step slides in, and every step change (and every results page) brings the
// window back to the top. Nothing animates its height, so filters never make the page jump.

export type KitFlowStepId = 'similar' | 'cover' | 'cheat' | 'kit' | 'guests'

const STEP_LABEL: Record<KitFlowStepId, string> = { similar: 'Similar Homes', cover: 'Cover photo', cheat: 'Cheat Sheet', kit: 'Your kit', guests: 'Guests' }

// Steps inside the window call this to go back to the top (e.g. results page 2).
const ScrollTopContext = createContext<(() => void) | null>(null)
export const useKitFlowScrollTop = () => useContext(ScrollTopContext)

// Phones: each step draws the flow bar (components/ui/FlowDock) with this window's real step
// number - null outside the window (the same views open on their own from an open house's card).
const KitFlowDockContext = createContext<{ step: number; total: number } | null>(null)
export const useKitFlowDock = () => useContext(KitFlowDockContext)

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
  // The flow bar is drawn into this window (not <body>, which sits under it) - outside the card,
  // whose slide-in transform would otherwise pin a fixed bar to the card instead of the screen.
  const [dockHost, setDockHost] = useState<HTMLElement | null>(null)
  const dock = useMemo(() => ({ step: at + 1, total: steps.length }), [at, steps.length])

  if (typeof document === 'undefined') return null
  return createPortal(
    // Phones: one full-screen sheet (no grey strips down the sides, nothing of the page behind
    // showing at the end) under a lit header - the home's photo, the step, a 5-part progress line -
    // the same feel as Schedule a Showing / the host flows (owner, 10/22). Computers: unchanged.
    <motion.div ref={scroller} className="fixed inset-0 z-[120] overflow-y-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden bg-[#FAFAF7] pb-[calc(5rem+env(safe-area-inset-bottom))] dark:bg-[#151517] sm:bg-black/60 sm:p-5 print:hidden" style={{ overscrollBehavior: 'contain' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <style>{KIT_SHELL_CSS}</style>
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="relative mx-auto w-full max-w-[1240px] overflow-hidden bg-[#FAFAF7] dark:bg-[#151517] sm:rounded-[2rem] sm:border sm:border-white/50 sm:shadow-2xl sm:dark:border-gray-800">
        <ScrollTopContext.Provider value={scrollTop}>
          {/* phone header: the home, lit */}
          <div className="relative isolate overflow-hidden bg-[#0b0b0c] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white sm:hidden">
            {photo && <img src={photo} alt="" className="kit-ken absolute inset-0 -z-20 h-full w-full object-cover" />}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.42),transparent_55%),linear-gradient(180deg,rgba(11,11,12,.45),rgba(11,11,12,.93))]" />
            <span aria-hidden className="kit-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
            <div className="flex items-center justify-between gap-3">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={current} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                  className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.26em] text-[#e8c97a]">
                  {steps.length > 1 ? `Step ${at + 1} of ${steps.length} · ` : ''}{STEP_LABEL[current]}
                </motion.p>
              </AnimatePresence>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition active:bg-white/25"><X className="h-4 w-4" /></button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.h3 key={title} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22 }}
                className="mt-2 font-serif text-[1.55rem] font-black leading-tight">{title}</motion.h3>
            </AnimatePresence>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-white/70">{address}</p>
            {steps.length > 1 && (
              <div className="mt-3.5 flex gap-1.5" aria-hidden>
                {steps.map((s, i) => (
                  <span key={s} className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                    <motion.span className="absolute inset-0 origin-left rounded-full bg-[#e8c97a]" initial={false}
                      animate={{ scaleX: i <= at ? 1 : 0, opacity: i < at ? 0.75 : 1 }} transition={{ type: 'spring', stiffness: 220, damping: 30 }} />
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* computer header: the home, this step's name, where you are in the flow */}
          <div className="hidden border-b border-gray-200/60 bg-white/60 px-4 py-3.5 sm:block sm:px-8 sm:py-4 dark:border-gray-800 dark:bg-[#0B0B0B]/50">
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
          <FlowDockHostContext.Provider value={dockHost}>
            <KitFlowDockContext.Provider value={dock}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={contentKey ?? current} initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}>
                  {children}
                </motion.div>
              </AnimatePresence>
            </KitFlowDockContext.Provider>
          </FlowDockHostContext.Provider>
        </ScrollTopContext.Provider>
      </motion.div>
      <div ref={setDockHost} />
    </motion.div>,
    document.body,
  )
}

// Transforms only (no animated blur / background-position - they lag on phones).
const KIT_SHELL_CSS = `
.kit-ken{animation:kitKen 18s ease-out both}
@keyframes kitKen{from{transform:scale(1.14)}to{transform:scale(1.02)}}
.kit-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);animation:kitEdge 6s ease-in-out infinite}
@keyframes kitEdge{0%{transform:translateX(-60%)}100%{transform:translateX(60%)}}
@media (prefers-reduced-motion:reduce){.kit-ken,.kit-edge{animation:none}}
`
