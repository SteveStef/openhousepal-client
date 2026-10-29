'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Share2 } from 'lucide-react'
import { formPlacements } from '@/lib/formPlacements'

// Top of a premade form's editor: everywhere this form opens, so changing the default one isn't a
// surprise ("I want people to see that warning when they're thinking about changing their default
// one" - user, 10/27). One slim line that opens and closes like any dropdown (user, 10/28): the line
// itself is the warning, the list is a tap away. Phones start closed.
export default function FormPlacementsNotice({ formType, planTier, className = '', compact = false }: {
  formType: string; planTier?: string | null; className?: string
  /** A full-width strip (the form's Campaigns window) that starts closed; otherwise a rounded box. */
  compact?: boolean
}) {
  const places = formPlacements(formType, planTier)
  const [open, setOpen] = useState(() => {
    if (compact) return false
    try { return window.matchMedia('(min-width: 640px)').matches } catch { return true }
  })
  if (!places.length) return null
  const count = `${places.length} ${places.length === 1 ? 'place' : 'places'}`
  return (
    <div data-testid="form-placements" className={`${compact ? 'border-b' : 'rounded-2xl border'} border-amber-200 bg-amber-50/80 dark:border-amber-400/20 dark:bg-amber-500/[0.08] ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={`flex w-full items-center gap-2.5 text-left ${compact ? 'px-5 py-2' : 'px-3 py-2.5'}`}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Share2 className="h-3.5 w-3.5" /></span>
        <span className="min-w-0 flex-1 text-[13px] font-black leading-tight text-[#111827] dark:text-white">
          This form shows up in {count}
          <span className="hidden font-semibold text-amber-800/80 dark:text-amber-200/70 sm:inline"> - changing it changes them all</span>
        </span>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className={compact ? 'px-5 pb-3' : 'px-3 pb-3'}>
              <p className="text-xs font-semibold leading-snug text-amber-800/80 dark:text-amber-200/70">Anything you change here - questions, wording, look - changes it everywhere below.</p>
              <ul className="mt-2 space-y-1.5">
                {places.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-snug text-gray-700 dark:text-white/75">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span><b className="font-black text-[#111827] dark:text-white">{p.where}:</b> {p.what}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
