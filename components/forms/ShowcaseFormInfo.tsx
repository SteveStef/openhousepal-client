'use client'

// The premade forms that build the person filling them out their own Showcase - and exactly when
// they do. Mirrors the backend: forms_service.submit_form (+ _showcase_gate) and
// CollectionsService.create_or_update_from_form_submission (Premium/IDX plans only; I'm Buying and
// How Can We Help need an actual search - an area, price or bedrooms - or nothing is built).
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Home, Sparkles, X } from 'lucide-react'

type Info = { badge: string; title: string; lead: string; yes: string[]; no: string[] }

export const SHOWCASE_FORMS: Record<string, Info> = {
  showcase_request: {
    badge: 'Builds their Showcase',
    title: 'This form builds the guest their own Showcase',
    lead: 'It\'s the whole point of the form: when they finish, their Showcase of matching homes opens for them right away and keeps updating as new homes hit the market.',
    yes: [
      'Anyone who finishes it and isn\'t working with an agent.',
      'Guests usually arrive from the QR code on your Brag Sheet, or a link you shared.',
      'Someone who already has a Showcase gets it updated with their new answers - never a second one.',
    ],
    no: [
      'They say they already have an agent - the form stops there and thanks them.',
    ],
  },
  buying: {
    badge: 'Builds a Showcase',
    title: 'This form quietly builds a Showcase for buyers without an agent',
    lead: 'When a buyer finishes it, a Showcase is built from their home-search answers. They aren\'t sent to it - your follow-up message introduces it as a nice surprise.',
    yes: [
      'They say they are NOT working with an agent.',
      'They told us what they want - at least an area, a price range or bedrooms.',
      'Someone who already has a Showcase gets it updated instead of a second one.',
    ],
    no: [
      'They already have an agent.',
      'They left the whole home search blank.',
      'They didn\'t finish the form (an unfinished response never builds one).',
    ],
  },
  how_can_i_help: {
    badge: 'Builds a Showcase for buyers',
    title: 'Only buyers without an agent get a Showcase from this form',
    lead: 'How Can We Help asks if they\'re buying or selling. Buyers who aren\'t working with an agent get a Showcase built quietly from their answers - your follow-up message introduces it.',
    yes: [
      'They picked buying (or buying and selling).',
      'They say they are NOT working with an agent.',
      'They told us what they want - at least an area, a price range or bedrooms.',
    ],
    no: [
      'Sellers only - no Showcase (they still become a lead with a follow-up).',
      'Buyers who already have an agent.',
      'A blank home search, or a form they didn\'t finish.',
    ],
  },
}

/** Small pill for the form cards on the Forms page. */
export function ShowcaseFormBadge({ formType }: { formType?: string | null }) {
  const info = formType ? SHOWCASE_FORMS[formType] : undefined
  if (!info) return null
  return (
    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
      <Sparkles className="h-3 w-3" /> {info.badge}
    </span>
  )
}

/** The bigger explainer at the top of a form's own window. */
export function ShowcaseFormInfoBlock({ formType, compact = false }: { formType?: string | null; compact?: boolean }) {
  const info = formType ? SHOWCASE_FORMS[formType] : undefined
  // Collapsed once = stays collapsed (per form type, this browser) - it's a one-time explainer.
  const memoryKey = `ohp:showcaseInfoCollapsed:${formType}`
  const [open, setOpenState] = useState(() => {
    try { return typeof window === 'undefined' || window.localStorage.getItem(memoryKey) !== '1' } catch { return true }
  })
  const setOpen = (next: (o: boolean) => boolean) => setOpenState(o => {
    const v = next(o)
    try { if (v) window.localStorage.removeItem(memoryKey); else window.localStorage.setItem(memoryKey, '1') } catch { /* private mode */ }
    return v
  })
  if (!info) return null
  return (
    <div className={`${compact ? 'rounded-xl border' : 'border-b'} border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-[#fbf7ee] px-5 py-4 dark:border-emerald-500/10 dark:from-emerald-500/[0.07] dark:via-[#0B0B0B] dark:to-[#1c1a14]`}>
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <Home className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-[#111827] dark:text-white">{info.title}</span>
          <span className="mt-0.5 block text-xs font-medium leading-relaxed text-gray-600 dark:text-gray-300">{info.lead}</span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className={`mt-3 grid gap-2 ${compact ? '' : 'pl-12 sm:grid-cols-2'}`}>
              <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 dark:border-emerald-500/20 dark:bg-white/[0.03]">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Built when</p>
                <ul className="mt-1.5 space-y-1.5">
                  {info.yes.map(t => (
                    <li key={t} className="flex gap-1.5 text-[12px] font-medium leading-snug text-gray-700 dark:text-gray-200">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-700 dark:bg-white/[0.03]">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Not built when</p>
                <ul className="mt-1.5 space-y-1.5">
                  {info.no.map(t => (
                    <li key={t} className="flex gap-1.5 text-[12px] font-medium leading-snug text-gray-700 dark:text-gray-200">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className={`mt-2 text-[10px] font-semibold text-gray-400 ${compact ? '' : 'pl-12'}`}>Showcases are part of the Premium and IDX plans.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
