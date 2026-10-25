'use client'

// Small shared pieces of a form's Settings (the form builder and the Showcase form's theme window):
// switch rows, "After they submit", and the Save / Revert buttons with a satisfying press.
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Globe, Loader2, RotateCcw, Save, Sparkles, Type, X } from 'lucide-react'
import type { AgentFormConfig } from '@/types'

/** The forms whose answers build the visitor a Showcase (forms_service.submit_form). */
export const SHOWCASE_BUILDING_FORMS = new Set(['showcase_request', 'buying', 'how_can_i_help'])

export function SettingSwitch({ on, onToggle, icon, title, blurb, disabled = false }: {
  on: boolean
  onToggle: () => void
  icon?: React.ReactNode
  title: string
  blurb?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      whileTap={{ scale: 0.985 }}
      aria-pressed={on}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50 ${on ? 'border-[#C9A24D]/45 bg-[#C9A24D]/[0.07] dark:border-[#C9A24D]/30 dark:bg-[#C9A24D]/[0.06]' : 'border-gray-200 bg-[#fbfaf7] dark:border-gray-700 dark:bg-[#151517]'}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon && <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${on ? 'bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/12 text-[#8b7355] dark:text-[#e8c97a]'}`}>{icon}</span>}
        <span className="min-w-0">
          <span className="block text-sm font-black text-[#111827] dark:text-white">{title}</span>
          {blurb && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{blurb}</span>}
        </span>
      </span>
      <span className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-300 ${on ? 'justify-end bg-emerald-500' : 'justify-start bg-gray-300 dark:bg-gray-700'}`}>
        <motion.span layout transition={{ type: 'spring', stiffness: 650, damping: 32 }} className="grid h-5 w-5 place-items-center rounded-full bg-white shadow-md">
          <AnimatePresence initial={false} mode="wait">
            <motion.span key={on ? 'on' : 'off'} initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ duration: 0.16 }} className="grid place-items-center">
              {on ? <Check className="h-3 w-3 text-emerald-600" strokeWidth={4} /> : <X className="h-3 w-3 text-gray-400" strokeWidth={3} />}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      </span>
    </motion.button>
  )
}

/** Where the visitor goes after the thank-you screen. Showcase forms: their new Showcase (on by
 *  default) and/or the Agent Hub (off by default on the Showcase form) - the Showcase wins when
 *  one was built; the Agent Hub catches everyone else. */
export function AfterSubmitSettings({ form, hubAvailable, onToggleHub, onToggleShowcase }: {
  form: AgentFormConfig
  hubAvailable: boolean
  onToggleHub: () => void
  onToggleShowcase?: () => void
}) {
  const buildsShowcase = SHOWCASE_BUILDING_FORMS.has(form.form_type)
  const showcaseOn = form.redirect_to_showcase !== false
  if (!buildsShowcase && !hubAvailable) return null
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-black uppercase tracking-widest text-gray-400">After they submit</p>
      {buildsShowcase && onToggleShowcase && (
        <SettingSwitch on={showcaseOn} onToggle={onToggleShowcase} icon={<Sparkles className="h-4 w-4" />}
          title="Open their new Showcase"
          blurb={form.form_type === 'showcase_request' ? 'The Showcase their answers just built opens right after the thank-you.' : 'When their answers build a Showcase (a buyer without an agent), it opens right after the thank-you.'} />
      )}
      {hubAvailable && (
        <SettingSwitch on={!!form.redirect_to_agent_hub} onToggle={onToggleHub} icon={<Globe className="h-4 w-4" />}
          title="Go to my Agent Hub"
          blurb={buildsShowcase && showcaseOn ? 'For anyone who didn\'t get a Showcase - a few seconds after the thank-you.' : 'A few seconds after the thank-you, they land on your Agent Hub.'} />
      )}
    </div>
  )
}

export function EffectsSettings({ form, onToggleBackground, onToggleWelcome }: { form: AgentFormConfig; onToggleBackground: () => void; onToggleWelcome: () => void }) {
  return (
    <div className="space-y-2.5">
      <SettingSwitch on={form.background_effects !== false} onToggle={onToggleBackground} icon={<Sparkles className="h-4 w-4" />}
        title="Background effects" blurb="Soft animated graphics (floating cards, glow, grid) behind the form." />
      <SettingSwitch on={form.welcome_text_effects !== false} onToggle={onToggleWelcome} icon={<Type className="h-4 w-4" />}
        title="Welcome text effects" blurb="The welcome title, words and Start button glide in one after another." />
    </div>
  )
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Save: a shine runs across it while there are unsaved changes; on save the label rolls to a
 *  ticked "Saved" with a little pop and a ring that ripples out. */
export function SaveFormButton({ status, dirty, onClick, className = '' }: { status: SaveStatus; dirty?: boolean; onClick: () => void; className?: string }) {
  const label = status === 'saving' ? 'Saving' : status === 'saved' && !dirty ? 'Saved' : status === 'error' ? 'Try again' : 'Save'
  const tone = status === 'saved' && !dirty ? 'bg-emerald-500 text-white' : status === 'error' ? 'bg-red-600 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={status === 'saving'}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.94 }}
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm font-black shadow-sm transition-colors duration-300 disabled:cursor-wait ${tone} ${className}`}
    >
      {dirty && status !== 'saving' && (
        <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)' }}
          animate={{ x: ['0%', '400%'] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }} />
      )}
      <AnimatePresence>
        {status === 'saved' && !dirty && (
          <motion.span key="ring" aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-emerald-400"
            initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.35 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={label} className="relative inline-flex items-center gap-2"
          initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 32 }}>
          {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" />
            : label === 'Saved' ? <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: [0, 1.35, 1], rotate: 0 }} transition={{ duration: 0.45 }} className="inline-flex"><Check className="h-4 w-4" strokeWidth={3} /></motion.span>
              : <Save className="h-4 w-4" />}
          {label}
          {dirty && status !== 'saving' && <span className="h-1.5 w-1.5 rounded-full bg-[#e8c97a]" title="Unsaved changes" />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/** Revert to default: the arrow spins back a full turn as it's pressed. */
export function RevertButton({ onClick, busy = false, done = false }: { onClick: () => void; busy?: boolean; done?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={busy}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.95 }}
      className={`group mt-3 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-black transition-colors ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 dark:border-red-900/50 dark:bg-[#151517] dark:text-red-400 dark:hover:bg-red-900/20'}`}
    >
      <motion.span className="inline-flex" animate={busy ? { rotate: -360 } : { rotate: 0 }} transition={busy ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}>
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <RotateCcw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:-rotate-180" />}
      </motion.span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={done ? 'd' : busy ? 'b' : 'i'} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.18 }}>
          {done ? 'Back to default' : busy ? 'Reverting...' : 'Revert to default'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
