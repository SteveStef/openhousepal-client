'use client'

// The one "this is picked" mark (owner 10/26: people couldn't see what they had selected): a gold
// check badge that pops in on the corner of a picked card / font / logo. Pair it with the gold
// ring class below on the card itself. The parent must be `relative`.
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

/** Gold ring + soft glow for a picked card. */
export const SELECTED_RING = 'border-[#C9A24D] ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-white shadow-[0_14px_30px_-20px_rgba(201,162,77,.95)] dark:ring-offset-[#151517]'

export default function SelectedMark({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  return (
    <motion.span aria-hidden data-selected-mark
      initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }}
      className={`pointer-events-none absolute -right-2 -top-2 z-10 grid ${box} place-items-center rounded-full bg-[#C9A24D] text-white shadow-[0_4px_10px_-2px_rgba(139,106,43,.7)] ring-2 ring-white dark:ring-[#151517] ${className}`}>
      <Check className={icon} strokeWidth={3.5} />
    </motion.span>
  )
}
