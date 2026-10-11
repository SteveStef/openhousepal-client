'use client'

// The one on/off switch: a gold track that fills in, a knob that springs across (and squishes a
// little when pressed), a check that draws itself when on, and a light sweep the moment it turns
// on. `as="span"` renders just the look, for rows that are themselves the button (the whole row
// is clickable and already carries role="switch").
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'

const SIZES = {
  sm: { w: 36, h: 20, knob: 16, pad: 2, icon: 10 },
  md: { w: 44, h: 24, knob: 20, pad: 2, icon: 12 },
  lg: { w: 56, h: 32, knob: 26, pad: 3, icon: 15 },
} as const

export type OhpSwitchSize = keyof typeof SIZES

export default function OhpSwitch({ on, onChange, size = 'md', disabled = false, busy = false, label, as = 'button', className = '', testId }: {
  on: boolean
  onChange?: (next: boolean) => void
  size?: OhpSwitchSize
  disabled?: boolean
  /** Shows a small spinner in the knob while a save is in flight. */
  busy?: boolean
  /** Accessible name when there's no visible label tied to it. */
  label?: string
  as?: 'button' | 'span'
  className?: string
  testId?: string
}) {
  const s = SIZES[size]
  const travel = s.w - s.knob - s.pad * 2
  const look = (
    <>
      <span aria-hidden className="absolute inset-0 rounded-full bg-gray-300 shadow-[inset_0_1px_3px_rgba(0,0,0,.18)] dark:bg-gray-600" />
      <motion.span aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#e8c97a] shadow-[inset_0_1px_2px_rgba(0,0,0,.18),0_0_0_3px_rgba(201,162,77,.14),0_6px_16px_-6px_rgba(201,162,77,.85)]"
        initial={false} animate={{ opacity: on ? 1 : 0 }} transition={{ duration: 0.28 }} />
      <AnimatePresence>
        {on && (
          <motion.span key="sweep" aria-hidden className="pointer-events-none absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
            initial={{ x: '-110%', opacity: 1 }} animate={{ x: '230%', opacity: 0.2 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
      <motion.span
        aria-hidden
        className="absolute flex items-center justify-center rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,.28),0_0_0_0.5px_rgba(0,0,0,.06)]"
        style={{ top: s.pad, left: s.pad, width: s.knob, height: s.knob }}
        initial={false}
        animate={{ x: on ? travel : 0 }}
        whileTap={disabled ? undefined : { scaleX: 1.18 }}
        transition={{ type: 'spring', stiffness: 520, damping: 30, mass: 0.7 }}
      >
        <AnimatePresence initial={false} mode="wait">
          {busy ? (
            <motion.span key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Loader2 className="animate-spin text-[#C9A24D]" style={{ width: s.icon, height: s.icon }} /></motion.span>
          ) : on ? (
            <motion.span key="on" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 24 }}>
              <Check className="text-[#a8803a]" strokeWidth={3.5} style={{ width: s.icon, height: s.icon }} />
            </motion.span>
          ) : (
            <motion.span key="off" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="rounded-full bg-gray-300 dark:bg-gray-400" style={{ width: s.icon * 0.45, height: s.icon * 0.45 }} />
          )}
        </AnimatePresence>
      </motion.span>
    </>
  )
  const cls = `relative inline-block shrink-0 overflow-hidden rounded-full align-middle ${disabled ? 'opacity-50' : ''} ${className}`
  const style = { width: s.w, height: s.h }
  if (as === 'span') return <span className={cls} style={style} data-on={on || undefined}>{look}</span>
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} data-testid={testId}
      onClick={() => onChange?.(!on)}
      className={`${cls} outline-none transition focus-visible:ring-2 focus-visible:ring-[#C9A24D] focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:focus-visible:ring-offset-[#141416]`} style={style}>
      {look}
    </button>
  )
}
