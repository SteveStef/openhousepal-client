'use client'

// Pick one of a short list (which campaign: All / General / each named one) - a dropdown on a
// computer, a slide-up sheet that drags down to close on a phone (user, 10/24: not a row of pills).
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Megaphone } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { useIsPhone } from '@/components/ui/windowMotion'

export type ScopeOption<T> = { value: T; label: string; sub?: string }

export default function ScopePicker<T>({ options, value, onChange, title = 'Campaign', align = 'left' }: {
  options: ScopeOption<T>[]
  value: T
  onChange: (value: T) => void
  title?: string
  align?: 'left' | 'right'
}) {
  const phone = useIsPhone()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.value === value) || options[0]
  useEffect(() => {
    if (!open || phone) return
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc) }
  }, [open, phone])
  const pick = (v: T) => { onChange(v); setOpen(false) }
  const list = (
    <div className="space-y-1">
      {options.map(o => {
        const on = o.value === value
        return (
          <button key={o.label} type="button" onClick={() => pick(o.value)}
            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition ${on ? 'bg-[#C9A24D]/12 dark:bg-[#C9A24D]/15' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'}`}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-[#111827] dark:text-white">{o.label}</span>
              {o.sub && <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{o.sub}</span>}
            </span>
            {on && <Check className="h-4 w-4 shrink-0 text-[#8b6a2b] dark:text-[#e8c97a]" strokeWidth={3} />}
          </button>
        )
      })}
    </div>
  )
  return (
    <div ref={box} className="relative">
      <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="inline-flex max-w-[240px] items-center gap-2 rounded-full border border-gray-200 bg-white py-1.5 pl-2 pr-3 text-xs font-black text-[#111827] shadow-sm transition hover:border-[#C9A24D]/60 dark:border-gray-700 dark:bg-[#151517] dark:text-white">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a]"><Megaphone className="h-3 w-3" /></span>
        <span className="truncate">{current?.label}</span>
        <motion.span animate={{ rotate: open && !phone ? 180 : 0 }} className="inline-flex shrink-0"><ChevronDown className="h-3.5 w-3.5 text-gray-400" /></motion.span>
      </motion.button>
      {phone ? (
        <OhSheet open={open} onClose={() => setOpen(false)} title={title} subtitle="Show results for" icon={<Megaphone className="h-5 w-5" />}>
          {list}
        </OhSheet>
      ) : (
        <AnimatePresence>
          {open && (
            <motion.div key="menu" role="listbox" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
              className={`absolute top-full z-30 mt-2 max-h-80 w-64 origin-top overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_24px_50px_-20px_rgba(17,24,39,.5)] dark:border-gray-700 dark:bg-[#151517] ${align === 'right' ? 'right-0' : 'left-0'}`}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{title}</p>
              {list}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
