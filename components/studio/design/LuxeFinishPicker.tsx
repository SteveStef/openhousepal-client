'use client'

// "Luxe finish" - the Email Signature's gold, silver and bronze as a design's accent, on any layout,
// style and color theme. Same metal chips as the signature (a polished gradient that catches the
// light on hover); "None" keeps the theme's own accent. IDX plans apply it; others see it locked.
import { Check, Crown } from 'lucide-react'
import { motion } from 'framer-motion'
import { LUXE_METALS, LUXE_METAL_ORDER, type LuxeMetal } from '@/lib/luxeMetals'

export default function LuxeFinishPicker({ value, onChange, locked = false, compact = false, goldTheme = false }: {
  value: LuxeMetal | null
  onChange: (metal: LuxeMetal | null) => void
  locked?: boolean
  compact?: boolean
  /** The theme's own accent is already gold (Luxe theme / Luxe layout): no "None" chip, Gold shows picked. */
  goldTheme?: boolean
}) {
  const current: LuxeMetal | null = value ?? (goldTheme ? 'gold' : null)
  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">
        <Crown className="h-3.5 w-3.5 text-[#C9A24D]" /> Luxe finish
        {!compact && <span className="font-semibold normal-case tracking-normal text-gray-400">- the gold, silver and bronze from your signature</span>}
      </p>
      <div className={`mt-2 grid gap-2 ${compact ? 'grid-cols-2' : goldTheme ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {!goldTheme && <button type="button" onClick={() => onChange(null)} data-testid="luxe-finish-none"
          className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition hover:-translate-y-0.5 ${value === null ? 'border-[#111827] dark:border-white' : 'border-gray-200 dark:border-white/10'}`}>
          <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-gray-300 dark:border-white/20" />
          <span className="min-w-0 leading-tight"><span className="block text-xs font-black text-[#111827] dark:text-white">None</span><span className="block text-[10px] font-semibold text-gray-400">Theme accent</span></span>
          {value === null && <Check className="ml-auto h-3.5 w-3.5 text-[#111827] dark:text-white" />}
        </button>}
        {LUXE_METAL_ORDER.map(m => {
          const mp = LUXE_METALS[m]
          const on = current === m
          return (
            <motion.button key={m} type="button" whileTap={{ scale: 0.96 }} onClick={() => onChange(m)} data-testid={`luxe-finish-${m}`}
              className={`group relative flex items-center gap-2 overflow-hidden rounded-xl border-2 px-3 py-2.5 text-left transition hover:-translate-y-0.5 ${on ? 'shadow-[0_10px_24px_-14px_rgba(0,0,0,.45)]' : 'border-gray-200 dark:border-white/10'}`}
              style={on ? { borderColor: mp.base } : undefined}>
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${mp.deep}, ${mp.base} 40%, ${mp.pale} 55%, ${mp.light} 70%, ${mp.deep})` }}>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: mp.deep }}>Luxe</span>
                <span className="block text-xs font-black text-[#111827] dark:text-white">{mp.label}</span>
              </span>
              {locked
                ? <Crown className="ml-auto h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
                : on && <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white" style={{ background: mp.base }}><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></span>}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
