'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { useIsPhone } from '@/components/ui/windowMotion'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { PopupPortal, useAnchoredStyle } from '@/components/ui/AnchoredPopup'

// A dropdown that matches the app instead of the browser's grey native <select>: a pill button
// that shows the current pick (gold when a filter is on), and a floating menu that springs open
// with a gliding highlight, a check on the current pick, and full keyboard support
// (arrows / Enter / Escape). Same value + onChange contract as a <select>.
export interface LuxeOption<T extends string> { value: T; label: string; hint?: string; icon?: ReactNode; dot?: string }

export default function LuxeSelect<T extends string>({ value, onChange, options, icon, placeholderValue, menuWidth = 220, align = 'left', ariaLabel, className = '', sheetOnPhone = false, sheetTitle }: {
  /** On a phone, open as a pull-up sheet that drags down to close instead of a floating menu. */
  sheetOnPhone?: boolean
  sheetTitle?: string
  value: T
  onChange: (v: T) => void
  options: LuxeOption<T>[]
  icon?: ReactNode
  placeholderValue?: T // the "no filter" option - the button stays neutral while it's picked
  menuWidth?: number
  align?: 'left' | 'right'
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(() => Math.max(0, options.findIndex(o => o.value === value)))
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const current = options.find(o => o.value === value) || options[0]
  const active = placeholderValue !== undefined && value !== placeholderValue
  const phone = useIsPhone()
  const asSheet = sheetOnPhone && phone
  // The menu floats on top of the page from the button (flipped above when there's no room below,
  // kept on screen sideways) - in a modal or near a phone's edge it was cut off (owner, 10/26).
  const menuRef = useRef<HTMLUListElement>(null)
  const menuStyle = useAnchoredStyle(rootRef, menuRef, open && !asSheet, { width: menuWidth, align, maxHeight: 440 })

  useEffect(() => {
    if (!open || asSheet) return
    setHi(Math.max(0, options.findIndex(o => o.value === value)))
    const close = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pick = (v: T) => { onChange(v); setOpen(false) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setHi(h => (h + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
    }
    if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); pick(options[hi].value) }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKey}>
      <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={ariaLabel}
        className={`group flex h-full w-full items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-black transition-colors ${
          active
            ? 'border-[#C9A24D]/60 bg-[#C9A24D]/12 text-[#8b6a2b] shadow-[0_6px_16px_-10px_rgba(201,162,77,.9)] dark:text-[#e8c97a]'
            : open
              ? 'border-[#C9A24D]/60 bg-white text-[#111827] dark:bg-[#151517] dark:text-white'
              : 'border-gray-200 bg-white text-[#111827] hover:border-[#C9A24D]/50 dark:border-gray-800 dark:bg-[#151517] dark:text-white'
        }`}>
        {icon && <span className={`shrink-0 ${active ? '' : 'text-gray-400 group-hover:text-[#C9A24D]'} transition-colors`}>{icon}</span>}
        {current.dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: current.dot }} />}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={current.value} className="min-w-0 flex-1 truncate text-left"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {current.label}
          </motion.span>
        </AnimatePresence>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="shrink-0 opacity-60">
          <ChevronDown size={13} strokeWidth={2.6} />
        </motion.span>
      </motion.button>

      {asSheet && (
        <OhSheet open={open} onClose={() => setOpen(false)} title={sheetTitle || ariaLabel || 'Choose one'} icon={icon ? <span className="[&_svg]:!block [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : undefined}>
          <div role="listbox" aria-label={ariaLabel} className="space-y-2">
            {options.map((o, i) => {
              const sel = o.value === value
              return (
                <motion.button key={o.value} type="button" role="option" aria-selected={sel} whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.035, type: 'spring', stiffness: 420, damping: 32 }}
                  onClick={() => pick(o.value)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${sel ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10' : 'border-gray-100 bg-white dark:border-white/10 dark:bg-white/[0.03]'}`}>
                  {o.dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.dot }} />}
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] font-black ${sel ? 'text-[#8b6a2b] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`}>{o.label}</span>
                    {o.hint && <span className="block text-[11.5px] font-semibold text-gray-400">{o.hint}</span>}
                  </span>
                  {sel && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#C9A24D] text-white"><Check size={13} strokeWidth={3.5} /></span>}
                </motion.button>
              )
            })}
          </div>
        </OhSheet>
      )}
      <PopupPortal from={rootRef}>
      <AnimatePresence>
        {open && !asSheet && (
          <motion.ul ref={menuRef} id={id} role="listbox" aria-activedescendant={`${id}-${hi}`}
            initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            style={{ ...menuStyle, transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            className={`overflow-y-auto overscroll-contain rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(17,24,39,.45)] dark:border-gray-800 dark:bg-[#151517]`}>
            {options.map((o, i) => {
              const sel = o.value === value
              return (
                <motion.li key={o.value} id={`${id}-${i}`} role="option" aria-selected={sel}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.02 * i, duration: 0.18 }}
                  onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)}
                  className="relative flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5">
                  {hi === i && <motion.span layoutId={`${id}-hi`} className="absolute inset-0 rounded-xl bg-[#C9A24D]/12" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />}
                  {o.dot && <span className="relative h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.dot }} />}
                  {o.icon && <span className="relative shrink-0 text-gray-400">{o.icon}</span>}
                  <span className="relative min-w-0 flex-1">
                    <span className={`block text-[12.5px] font-black ${sel ? 'text-[#8b6a2b] dark:text-[#e8c97a]' : 'text-[#111827] dark:text-white'}`}>{o.label}</span>
                    {o.hint && <span className="block text-[10.5px] font-semibold text-gray-400">{o.hint}</span>}
                  </span>
                  <AnimatePresence>
                    {sel && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                        className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-white">
                        <Check size={11} strokeWidth={3.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      </PopupPortal>
    </div>
  )
}
