'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

// The phone bar for long step-by-step flows (owner approved the example, 10/22): Back on the far
// left, "2 / 5" in the exact middle, the step's own Continue on the far right - the same slim bar
// as the account setup flow. Phones only (sm:hidden); each flow keeps its own buttons on bigger
// screens. Portaled to <body> so an animated step (transform) can't trap the fixed bar.
//
// Extras (10/22, "other flows might have other buttons in that bar"): one optional 44px button
// beside Back (Skip, Preview, Edit...) with a tiny word under its icon. The counter stays in the
// exact middle whatever sits on either side - the Continue button is capped at the room right of
// the counter, so nothing can ever run into it.
//
// Where it lives:
//  - default: fixed to the bottom of the screen, portaled to <body> (pages like the CMA builder).
//  - inside a FlowDockHost: portaled into that element instead - a pop-out window that scrolls as a
//    whole (the Open House Kit) puts one there so the bar sits over the window, not behind it.
//  - inline: drawn right where it's rendered, as the bottom row of a full-screen window that's
//    already laid out as header / body / footer (Studio's design flow, Invites, the blog writer) -
//    or, inside a FlowDockHost, drawn into that window's own footer spot (the host-a-home flows).

/** A pop-out window that wants its flow bar on top of itself: provide the element to draw into. */
export const FlowDockHostContext = createContext<HTMLElement | null>(null)

export type FlowDockExtra = {
  /** One short word shown under the icon (e.g. "Skip", "Preview"). */
  label: string
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
}

export default function FlowDock({ step, total, onBack, onContinue, continueLabel = 'Continue', disabled = false, busy = false, note, icon, extra, inline = false, backDisabled = false }: {
  /** 1-based. */
  step: number
  total: number
  /** Omitted on the first step - the slot stays so the counter never moves. */
  onBack?: () => void
  onContinue?: () => void | Promise<void>
  continueLabel?: React.ReactNode
  disabled?: boolean
  busy?: boolean
  /** A short line under the counter (e.g. "3 of 5 comps"). */
  note?: string
  /** Replaces the arrow on the Continue button. */
  icon?: React.ReactNode
  /** An optional second button beside Back, for something that genuinely helps in this flow. */
  extra?: FlowDockExtra
  /** Draw in place (a window's own footer row) instead of fixed to the bottom of the screen. */
  inline?: boolean
  backDisabled?: boolean
}) {
  const hostFromContext = useContext(FlowDockHostContext)
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [working, setWorking] = useState(false)
  useEffect(() => { setBody(document.body) }, [])
  const host = hostFromContext || body
  const run = async () => {
    if (!onContinue || working) return
    setWorking(true)
    try { await onContinue() } finally { setWorking(false) }
  }
  const spinning = busy || working
  // The Continue button may use everything right of the counter (less a small gap) - measured, so
  // a wider counter ("8 / 9" + a note) leaves it less room and the two can never touch.
  const [counterHalf, setCounterHalf] = useState(22)
  const measureCounter = useCallback((el: HTMLDivElement | null) => {
    if (el && el.offsetWidth) setCounterHalf(Math.ceil(el.offsetWidth / 2))
  }, [step, total, note]) // eslint-disable-line react-hooks/exhaustive-deps

  const row = (
    <div className="relative flex items-center justify-between gap-2 px-3 py-2">
      <div className="flex shrink-0 items-center gap-1">
        {onBack ? (
          <button type="button" onClick={onBack} disabled={backDisabled} aria-label="Back" className="inline-flex h-11 min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-2.5 text-[14px] font-black text-gray-600 transition active:bg-black/5 disabled:opacity-40 dark:text-gray-300 dark:active:bg-white/5">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : <span className="h-11 w-11" aria-hidden />}
        {extra && (
          <button type="button" onClick={extra.onClick} disabled={extra.disabled} aria-label={extra.label} title={extra.label} data-flow-dock-extra
            className="inline-flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[#8b7355] transition active:bg-black/5 disabled:opacity-40 dark:text-[#e8c97a] dark:active:bg-white/5 [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {extra.icon}
            <span className="whitespace-nowrap text-[9px] font-black leading-none tracking-wide">{extra.label}</span>
          </button>
        )}
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center leading-none" data-flow-dock-counter ref={measureCounter}>
        <span className="whitespace-nowrap text-[12px] font-black tabular-nums tracking-[0.1em] text-[#a8843a] dark:text-[#e8c97a]">{step} / {total}</span>
        {note && <span className="mt-1 whitespace-nowrap text-[10px] font-bold text-gray-400">{note}</span>}
      </div>

      {onContinue ? (
        <button type="button" onClick={run} disabled={disabled || spinning} data-flow-dock-continue style={{ maxWidth: `calc(50% - ${counterHalf + 6}px)` }}
          className={`group inline-flex h-11 min-w-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#111827] to-[#2a2218] px-4 text-[15px] font-black text-white shadow-[0_14px_28px_-16px_rgba(17,24,39,.9)] ring-1 ring-[#C9A24D]/40 transition disabled:opacity-50 dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]`}>
          {spinning ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
          <span className="min-w-0 truncate">{continueLabel}</span>
          {!spinning && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon ?? <ArrowRight className="h-4 w-4" />}</span>}
        </button>
      ) : <span className="h-11 w-11" aria-hidden />}
    </div>
  )

  if (inline) {
    const bar = (
      <div data-flow-dock className="shrink-0 border-t border-[#C9A24D]/20 bg-[#fbf8f2] pb-[env(safe-area-inset-bottom)] dark:border-white/[0.07] dark:bg-[#0c0c0d] sm:hidden">
        {row}
      </div>
    )
    // A window that keeps its footer row somewhere the step can't reach provides that spot.
    return hostFromContext ? createPortal(bar, hostFromContext) : bar
  }
  if (!host) return null
  return createPortal(
    <motion.div initial={{ y: 80 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} data-flow-dock
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C9A24D]/20 bg-[#fbf8f2]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-14px_30px_-20px_rgba(0,0,0,0.3)] dark:border-white/[0.07] dark:bg-[#0c0c0d]/95 sm:hidden">
      {row}
    </motion.div>,
    host,
  )
}
