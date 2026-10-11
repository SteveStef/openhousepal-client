'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { DESIGN_SITUATIONS, DesignSituationDef, DesignSituationId } from '@/lib/studio/designSituations'
import { getDesignFormat } from '@/lib/studio/designFormats'
import { SITUATION_ICONS } from '@/components/studio/design/DesignCreateFlow'
import { CardAlive, GoldLastWord, TOOL_CARD_CSS, TOOL_CARD_ICON_TILE, TOOL_CARD_SURFACE, trackGlow } from '@/components/ui/LuxeSurface'

// "What are you creating marketing for?" - the first choice in Studio, as the same feature cards
// the Tools page uses (ivory + gold surface, dark icon tile, serif title with the gold last word,
// a real description, and a Create button) instead of ten little chips squeezed five to a row.
// Two groups, each on a grid it fills exactly: the six listing moments three-up, the four
// lead-magnet pieces (no listing needed) four-up - the same 4-per-row / 3-per-row rhythm as Tools.

export default function SituationCards({ onPick }: { onPick: (id: DesignSituationId) => void }) {
  const listing = DESIGN_SITUATIONS.filter(s => s.propertyAttached)
  const leads = DESIGN_SITUATIONS.filter(s => !s.propertyAttached)
  return (
    <div>
      <style>{TOOL_CARD_CSS}</style>
      <GroupLabel label="Market a listing" hint="Pulls the photos, price and facts straight from the MLS" />
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {listing.map((s, i) => <SituationCard key={s.id} situation={s} index={i} onPick={onPick} />)}
      </div>
      <GroupLabel label="Bring in new leads" hint="No listing needed - these market you" className="mt-7" />
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {leads.map((s, i) => <SituationCard key={s.id} situation={s} index={listing.length + i} onPick={onPick} />)}
      </div>
    </div>
  )
}

function GroupLabel({ label, hint, className = '' }: { label: string; hint?: string; className?: string }) {
  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">{label}</p>
      <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/40 to-transparent" />
      {hint && <p className="hidden text-[11px] font-semibold text-gray-400 dark:text-white/40 sm:block">{hint}</p>}
    </div>
  )
}

/** "Print & social · 10 sizes" - which channels this situation ships in, in plain words. */
function channelLine(situation: DesignSituationDef): string {
  const formats = situation.formats.map(id => getDesignFormat(id)).filter(Boolean) as NonNullable<ReturnType<typeof getDesignFormat>>[]
  const print = formats.some(f => f.isPrint)
  const social = formats.some(f => !f.isPrint)
  const mix = print && social ? 'Print & social' : print ? 'Print' : 'Social'
  const n = situation.formats.length
  return `${mix} · ${n} ${n === 1 ? 'size' : 'sizes'}`
}

// One card, two shapes: from tablet up it is the Tools feature card (icon tile, channel line, serif
// title, description, Create button); on a phone the same card lies down as a bar (icon, title,
// one-line description, arrow) so ten of them are a short scroll, not a long column of boxes.
// The entrance animation lives on a wrapper, as on Tools - framer leaves an inline transform on
// whatever it animates, which would cancel the button's own hover lift.
function SituationCard({ situation, index, onPick }: { situation: DesignSituationDef; index: number; onPick: (id: DesignSituationId) => void }) {
  const Icon = SITUATION_ICONS[situation.id]
  const lead = !situation.propertyAttached
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.05 + Math.min(index, 9) * 0.05 }}
      whileTap={{ scale: 0.98 }}
      className="h-full"
    >
      <button
        type="button"
        onClick={() => onPick(situation.id)}
        onMouseMove={trackGlow}
        className={`${TOOL_CARD_SURFACE} flex h-full w-full items-center gap-3.5 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A24D] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0B0B] sm:flex-col sm:items-stretch sm:gap-0 sm:p-5`}
      >
        <div aria-hidden className="ohp-tool-grid pointer-events-none absolute inset-0" />
        <CardAlive seed={index * 3 + 2} />
        <Icon aria-hidden className="lx-mark pointer-events-none absolute -bottom-8 -right-5 hidden h-28 w-28 text-[#C9A24D]/[0.08] dark:text-[#e8c97a]/[0.06] sm:block" />
        <div aria-hidden className="ohp-tool-edge pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-[#C9A24D]/0 blur-3xl transition-colors duration-700 group-hover:bg-[#C9A24D]/20" />

        {/* Icon tile (+ the "no listing needed" tag, tablet-up only; the phone bar says it in the text). */}
        <div className="relative flex shrink-0 items-start justify-between gap-2 sm:w-full">
          <span className={`${TOOL_CARD_ICON_TILE} h-11 w-11 sm:h-10 sm:w-10`}>
            <Icon className="ohp-icon-draw h-5 w-5 sm:h-[18px] sm:w-[18px]" />
          </span>
          {lead && (
            <span className="mt-0.5 hidden shrink-0 rounded-full border border-[#C9A24D]/30 bg-white/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355] dark:border-[#C9A24D]/30 dark:bg-white/[0.06] dark:text-[#e8c97a] sm:inline-block">
              No listing needed
            </span>
          )}
        </div>

        <div className="relative min-w-0 flex-1 sm:flex-none">
          <p className="hidden text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974] sm:mt-3 sm:block">{channelLine(situation)}</p>
          <h3 className="font-serif text-base font-black leading-tight text-[#111827] dark:text-white sm:mt-1 sm:text-lg"><GoldLastWord text={situation.label} /></h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400 sm:mt-1.5 sm:line-clamp-none sm:text-xs sm:leading-relaxed">{situation.description}</p>
          {lead && <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#e8c97a] sm:hidden">No listing needed</p>}
        </div>

        {/* Tablet-up: the Create button, pinned to the card's bottom so every row's buttons line up. */}
        <div className="relative mt-auto hidden items-center justify-between gap-2 pt-4 sm:flex">
          <span className="relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm transition group-hover:bg-black dark:bg-white dark:text-[#111827] dark:group-hover:bg-gray-200">
            Create <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            <span className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-[#C9A24D] transition-all duration-300 ease-out group-hover:w-[calc(100%-1rem)]" />
          </span>
        </div>
        {/* Phone: the arrow circle the Tools bars use. */}
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#C9A24D]/30 bg-white/70 text-[#8b7355] transition-all duration-300 group-hover:translate-x-0.5 group-hover:border-[#C9A24D] group-hover:bg-[#111827] group-hover:text-[#e8c97a] dark:bg-white/[0.06] dark:text-[#e8c97a] sm:hidden">
          <ArrowRight className="h-4 w-4" />
        </span>
      </button>
    </motion.div>
  )
}
