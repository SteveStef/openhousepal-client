'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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

export function HubCollapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="hub-collapse"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { duration: 0.34, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.22 } }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
