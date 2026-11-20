'use client'

// A person's Showcase must-haves at a glance (owner, 11/21: "someone tells me at the open house the home needs
// a pool"): gold chips on the visitor row and the lead page's Showcase card; with none yet, a "+ Must-have" chip.
// Either one opens Edit Showcase straight at its must-haves (QuickEditShowcase focus="must-haves").
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Star } from 'lucide-react'

export default function MustHaveChips({ wants, onOpen, className = '' }: { wants?: string[] | null; onOpen: () => void; className?: string }) {
  const list = (wants || []).filter(Boolean)
  return (
    <motion.button type="button" layout onClick={e => { e.stopPropagation(); onOpen() }} whileTap={{ scale: 0.96 }}
      aria-label={list.length ? `Must-haves: ${list.join(', ')} - change them` : 'Add a must-have'}
      className={`group inline-flex max-w-full flex-wrap items-center gap-1 text-left ${className}`} data-testid="must-have-chips">
      <AnimatePresence initial={false} mode="popLayout">
        {list.length ? list.map(w => (
          <motion.span key={w} layout initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#C9A24D]/60 bg-gradient-to-r from-[#C9A24D]/20 to-[#C9A24D]/10 px-2 py-0.5 text-[11px] font-black text-[#8b7355] transition group-hover:border-[#C9A24D] dark:text-[#e8c97a]"
            data-testid="must-have-chip">
            <Star className="h-2.5 w-2.5 shrink-0 fill-current" /><span className="min-w-0 truncate">{w}</span>
          </motion.span>
        )) : (
          <motion.span key="add" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#C9A24D]/60 px-2 py-0.5 text-[11px] font-black text-[#8b7355] transition group-hover:border-[#C9A24D] group-hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]"
            data-testid="must-have-add">
            <Plus className="h-3 w-3 shrink-0" /> Must-have
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
