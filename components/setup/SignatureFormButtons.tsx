'use client'

// The Signature step's "buttons on your email signature" picker: a small copy of the signature
// with its button row (it changes as they tap), then one big card per form. Saves to the
// signature's own ctaButtons (lib/signatureConfig - "My Agent Hub" always first, MAX_CTA_BUTTONS more).
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeDollarSign, Calendar, Check, DollarSign, Handshake, Home, LayoutTemplate, Lock, MousePointerClick, TrendingUp, type LucideIcon } from 'lucide-react'
import type { AgentFormConfig } from '@/types'
import { FORM_BUTTON_DEFAULTS, MAX_CTA_BUTTONS, type SignatureConfig } from '@/lib/signatureConfig'
import { LUXE_METALS } from '@/lib/luxeMetals'

const ICONS: Record<string, LucideIcon> = { how_can_i_help: Handshake, home_value: DollarSign, showing: Calendar, buying: Home, selling: TrendingUp, make_me_sell: BadgeDollarSign }

export default function SignatureFormButtons({ cfg, available, onToggle, name, title, photoUrl }: {
  cfg: SignatureConfig
  available: AgentFormConfig[]
  onToggle: (f: AgentFormConfig) => void
  name: string
  title: string
  photoUrl: string
}) {
  const chosen = cfg.ctaButtons
  const full = chosen.length >= MAX_CTA_BUTTONS
  const m = LUXE_METALS[cfg.luxeMetal]
  const accent = cfg.luxe ? m.base : cfg.accentColor
  const dark = cfg.darkMode
  const card = dark
    ? (cfg.luxe ? 'linear-gradient(135deg, #111827 0%, #2a2218 100%)' : 'linear-gradient(135deg, #1B1D22 0%, #0D0E11 100%)')
    : (cfg.luxe ? 'linear-gradient(135deg, #fffdf8 0%, #f4ead7 100%)' : 'linear-gradient(135deg, #fffdfa 0%, #f6f2eb 100%)')
  const ink = dark ? '#ffffff' : '#111827'
  const pill = (filled: boolean): React.CSSProperties => cfg.luxe
    ? filled ? { background: `linear-gradient(135deg, ${m.deep}, ${m.base} 45%, ${m.light} 70%, ${m.deep})`, color: '#111827' } : { border: `1.5px solid ${m.base}`, color: dark ? m.light : m.deep }
    : filled ? { background: accent, color: '#ffffff' } : { border: `1.5px solid ${accent}`, color: dark ? '#ffffff' : accent }

  return (
    <div className="space-y-4" data-testid="signature-form-buttons">
      {/* the signature, small - the button row is what this section sets */}
      <div className="rounded-[26px] bg-[#f4efe5] p-3 ring-1 ring-[#ece5d6] dark:bg-white/[0.03] dark:ring-white/10 sm:p-4">
        <div className="relative rounded-[18px] p-4 shadow-[0_18px_34px_-26px_rgba(17,24,39,.8)] ring-1 ring-black/5" style={{ background: card }}>
          <div className="flex items-center gap-3">
            {photoUrl ? <img src={photoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as string]: accent }} /> : <span className="h-12 w-12 shrink-0 rounded-full bg-gray-300" />}
            <div className="min-w-0 sm:pr-24">
              <p className={`truncate text-[16px] font-black leading-tight ${cfg.luxe ? 'font-serif' : ''}`} style={{ color: ink }}>{name || 'Your name'}</p>
              <p className="truncate text-[11.5px] font-semibold" style={{ color: dark ? 'rgba(255,255,255,.65)' : '#6b7280' }}>{title || 'REALTOR®'}</p>
            </div>
          </div>
          <div className="mt-3.5 h-px" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-black" style={pill(true)}><LayoutTemplate className="h-3 w-3" /> My Agent Hub</span>
            <AnimatePresence initial={false}>
              {chosen.map(b => (
                <motion.span key={b.formType} layout initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                  className="inline-flex items-center rounded-full px-3 py-1.5 text-[11.5px] font-black" style={pill(false)}>
                  {b.label || FORM_BUTTON_DEFAULTS[b.formType || ''] || 'Form'}
                </motion.span>
              ))}
              {Array.from({ length: Math.max(0, MAX_CTA_BUTTONS - chosen.length) }).map((_, k) => (
                <motion.span key={`empty-${k}`} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="inline-flex items-center rounded-full border-[1.5px] border-dashed px-3 py-1.5 text-[11.5px] font-bold" style={{ borderColor: dark ? 'rgba(255,255,255,.3)' : 'rgba(17,24,39,.2)', color: dark ? 'rgba(255,255,255,.45)' : '#9ca3af' }}>
                  + a form
                </motion.span>
              ))}
            </AnimatePresence>
            <span className="pointer-events-none absolute right-3 top-3 hidden items-center sm:flex gap-1 rounded-full bg-[#111827] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#e8c97a] shadow-lg dark:bg-[#C9A24D] dark:text-[#111827]"><MousePointerClick className="h-3 w-3" /> Tappable</span>
          </div>
        </div>
        <p className="mt-3 px-1 text-center text-[12.5px] font-semibold text-gray-500 dark:text-gray-400">People tap these buttons right inside your emails - each one opens that form.</p>
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[13px] font-black text-[#111827] dark:text-white"><Lock className="mr-1 inline h-3.5 w-3.5 text-gray-400" /> “My Agent Hub” is always first</p>
        <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-black ${full ? 'bg-[#C9A24D] text-white' : 'bg-[#f4efe5] text-[#8b6a2b] dark:bg-white/[0.06] dark:text-[#e8c97a]'}`}>{chosen.length} of {MAX_CTA_BUTTONS} picked</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {available.map(f => {
          const on = chosen.some(b => b.formType === f.form_type)
          const blocked = !on && full
          const Icon = ICONS[f.form_type] || DollarSign
          return (
            <button key={f.id} type="button" onClick={() => onToggle(f)} aria-pressed={on} disabled={blocked}
              className={`flex w-full min-w-0 items-center gap-3 rounded-[18px] border-2 px-4 py-3 text-left transition ${on ? 'border-[#C9A24D] bg-white shadow-[0_14px_28px_-22px_rgba(139,106,43,.9)] dark:bg-[#1a1712]' : blocked ? 'cursor-not-allowed border-dashed border-[#ece5d6] bg-transparent opacity-60 dark:border-white/10' : 'border-[#ece5d6] bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416]'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${on ? 'bg-[#111827] text-[#e8c97a] dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-[#f4efe5] text-gray-400 dark:bg-white/[0.06]'}`}><Icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-[#111827] dark:text-white">{FORM_BUTTON_DEFAULTS[f.form_type] || f.title}</span>
                <span className="block truncate text-[12.5px] font-medium text-gray-500 dark:text-gray-400">{blocked ? 'Tap one you picked to swap it' : `Opens your “${f.title}” form`}</span>
              </span>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-white/20'}`}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
