'use client'

import { useState } from 'react'
import { ChevronDown, Share2 } from 'lucide-react'
import { formPlacements } from '@/lib/formPlacements'

// Top of a premade form's editor: everywhere this form opens, so changing the default one isn't a
// surprise ("I want people to see that warning when they're thinking about changing their default
// one" - user, 10/27). Phones show the first three places, the rest a tap away.
export default function FormPlacementsNotice({ formType, planTier, className = '', compact = false }: {
  formType: string; planTier?: string | null; className?: string
  /** One line ("Shows up in 7 places · See where") that opens to the list - the form's Campaigns window. */
  compact?: boolean
}) {
  const places = formPlacements(formType, planTier)
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState(false)
  if (!places.length) return null
  if (compact && !open) return (
    <button type="button" onClick={() => setOpen(true)} data-testid="form-placements" className={`flex w-full items-center gap-2 border-y border-amber-200 bg-amber-50/80 px-5 py-2 text-left text-xs font-bold text-amber-900 transition hover:bg-amber-100/70 dark:border-amber-400/20 dark:bg-amber-500/[0.08] dark:text-amber-200 ${className}`}>
      <Share2 className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">This form shows up in {places.length} {places.length === 1 ? 'place' : 'places'} - changing it changes them all.</span>
      <span className="inline-flex shrink-0 items-center gap-0.5 font-black underline-offset-4 hover:underline">See where <ChevronDown className="h-3 w-3" /></span>
    </button>
  )
  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-400/25 dark:bg-amber-500/[0.08] ${className}`} data-testid="form-placements">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Share2 className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="text-sm font-black text-[#111827] dark:text-white">This form shows up in {places.length} {places.length === 1 ? 'place' : 'places'}</p>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-amber-800/80 dark:text-amber-200/70">Anything you change here - questions, wording, look - changes it everywhere below.</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {places.map((p, i) => (
          <li key={i} className={`${!all && i >= 3 ? 'hidden sm:flex' : 'flex'} items-start gap-2 text-xs leading-snug text-gray-700 dark:text-white/75`}>
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <span><b className="font-black text-[#111827] dark:text-white">{p.where}:</b> {p.what}</span>
          </li>
        ))}
      </ul>
      {!all && places.length > 3 && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-amber-800 underline-offset-4 hover:underline dark:text-amber-200 sm:hidden">
          Show all {places.length} <ChevronDown className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
