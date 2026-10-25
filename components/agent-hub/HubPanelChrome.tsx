'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import OhpSwitch, { type OhpSwitchSize } from '@/components/ui/OhpSwitch'

// Shared chrome for every collapsible Agent Hub panel (Studio > Site Editor/Layout tabs, and the
// same panels carried over into Settings). Explicit ask: no per-section color washes, gradient icon
// chips, or glowing toggles - one clean OpenHousePal look matching the nav/Tools page: a dark icon
// tile whose icon builds itself in on hover (ohp-icon-draw), a plain white card, and a smooth
// height animation when a panel opens or closes instead of an instant snap.

export const HUB_ICON_TILE = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-[0_10px_22px_-12px_rgba(17,24,39,.8)] ring-1 ring-[#C9A24D]/30 transition-transform duration-300 group-hover:scale-105 dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]'
export const HUB_ICON = 'ohp-icon-draw h-5 w-5'

// Same card language as the Spotlight / Studio pages: soft ivory edge, gold hairline border, a warm
// shadow that deepens when the panel is open.
export function hubCardClass(open: boolean) {
  return `overflow-hidden rounded-3xl border bg-white transition-[border-color,box-shadow] duration-300 dark:bg-[#151517] ${
    open ? 'border-[#C9A24D]/45 shadow-[0_26px_50px_-34px_rgba(139,115,85,.75)] dark:border-[#C9A24D]/30' : 'border-[#C9A24D]/20 shadow-[0_14px_34px_-30px_rgba(139,115,85,.7)] hover:border-[#C9A24D]/45 dark:border-white/[0.08] dark:hover:border-[#C9A24D]/30'
  }`
}

// Panels inside a provider set to true start open - the Agent Hub editor's category tabs show
// each tab's panels straight away instead of a stack of closed dropdowns. Settings keeps them closed.
export const HubPanelsOpen = createContext(false)

// The Agent Hub editor remembers each panel: every panel starts closed the first time, and after
// that opens (or stays closed) the way the agent last left it - per panel, in this browser.
// Provide a namespace to switch it on; without one (Settings) panels just start closed.
export const HubPanelMemory = createContext<string | null>(null)
export function useHubPanelOpen(id: string): [boolean, (next: boolean) => void] {
  const forced = useContext(HubPanelsOpen)
  const ns = useContext(HubPanelMemory)
  const key = ns ? `ohp.panels.${ns}.${id}` : ''
  const [open, setOpen] = useState(() => {
    if (forced) return true
    if (!key || typeof window === 'undefined') return false
    try { return window.localStorage.getItem(key) === '1' } catch { return false }
  })
  const set = useCallback((next: boolean) => {
    setOpen(next)
    if (key) { try { window.localStorage.setItem(key, next ? '1' : '0') } catch { /* private mode */ } }
  }, [key])
  return [open, set]
}

// Gold "on" track, no glow (the old dark:shadow-[0_0_8px...] halo read as juvenile).
export const HUB_TOGGLE_ON = 'bg-[#C9A24D]'
export const HUB_TOGGLE_OFF = 'bg-gray-300 dark:bg-gray-600'

/** Buttery hub switches (owner, 10/24: "the sliders lag on mobile"). The switch flips on its own
 *  first - only this tiny component re-renders - and the real change (which re-renders the whole
 *  editor + live preview and saves) lands once the knob has finished sliding. Follows the outside
 *  value again whenever it changes (a save that failed flips it back). */
export function useSmoothToggle(on: boolean, commit: (next: boolean) => void, delayMs = 230): [boolean, () => void] {
  const [shown, setShown] = useState(on)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(on)
  latest.current = on
  useEffect(() => { if (!timer.current) setShown(on) }, [on])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const flip = useCallback(() => {
    const next = !shown
    setShown(next)
    if (timer.current) clearTimeout(timer.current)
    // two quick taps land back where it started - nothing to save then
    timer.current = setTimeout(() => { timer.current = null; if (next !== latest.current) commit(next) }, delayMs)
  }, [shown, commit, delayMs])
  return [shown, flip]
}

/** The hub's one switch look (same spring switch as the rest of the app - OhpSwitch). */
export function HubSwitch({ on, onChange, label, size = 'sm', as = 'button' }: { on: boolean; onChange?: (next: boolean) => void; label?: string; size?: OhpSwitchSize; as?: 'button' | 'span' }) {
  const [shown, flip] = useSmoothToggle(on, next => onChange?.(next))
  if (as === 'span') return <OhpSwitch on={on} size={size} as="span" />
  return <OhpSwitch on={shown} size={size} label={label} onChange={() => flip()} />
}

export function HubCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="hub-collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.38, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.22 } }}
          className="overflow-hidden"
        >
          {/* the content rises in a touch behind the opening edge - reads as a smooth unfold */}
          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -6, opacity: 0 }}
            transition={{ y: { type: 'spring', stiffness: 360, damping: 32, delay: 0.04 }, opacity: { duration: 0.24, delay: 0.04 } }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
