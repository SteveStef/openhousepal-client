'use client'

// Shared pieces for the setup flow's plan-feature steps (Sales, Agent Hub, Forms, Signature):
// big obvious question cards, "where it shows" tiles, and the read-modify-write savers for the
// features' own saved settings (Agent Hub config, Email Signature config) - so the flow never
// keeps a copy of anything.
import { useRef } from 'react'
import { Check, type LucideIcon } from 'lucide-react'
import api from '@/lib/api-service'
import { mergeSignatureConfig, type SignatureConfig } from '@/lib/signatureConfig'
import OhpSwitch from '@/components/ui/OhpSwitch'

/** Saves one after another (two quick taps never race and drop each other's change). */
export function useSerialSaves() {
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  return <T,>(job: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(job, job)
    chain.current = next.catch(() => undefined)
    return next
  }
}

/** Read-modify-write of the Agent Hub config (PUT replaces the whole thing). */
export async function patchHubConfig(patch: Record<string, unknown> | ((cfg: Record<string, any>) => Record<string, unknown>)) {
  const latest = await api.agentHub.getMine()
  // couldn't read it: don't write a config built from nothing (it would wipe the hub) - report it
  if (!latest.success) return { success: false as const, error: latest.error, status: latest.status }
  const base: Record<string, any> = latest.data?.config ? latest.data.config : {}
  const next = typeof patch === 'function' ? patch(base) : patch
  return api.agentHub.saveConfig({ ...base, ...next })
}

/** Read-modify-write of the Email Signature config, with the editor's own defaults. */
export async function patchSignature(fn: (c: SignatureConfig) => SignatureConfig) {
  const r = await api.emailSignature.getMine()
  if (!r.success) return r
  return api.emailSignature.saveConfig(fn(mergeSignatureConfig(r.data?.config)))
}

// The Agent Hub's sections, in its default order (app/[slug]/page.tsx defaultVisibleSectionIds).
export const HUB_SECTION_IDS = ['listings', 'sales', 'videos', 'tours', 'blogs', 'reviews']

/** Whether a hub section is switched on (config.layoutSections; missing = on). */
export function hubSectionOn(cfg: Record<string, any> | null | undefined, id: string) {
  const s = Array.isArray(cfg?.layoutSections) ? cfg!.layoutSections.find((x: any) => x?.id === id) : null
  return s ? s.visible !== false : true
}

/** The config keys that switch one hub section on or off - layoutSections and the
 *  visibleSectionIds the editor keeps beside it. */
export function hubSectionPatch(cfg: Record<string, any>, id: string, on: boolean) {
  const saved: { id: string; visible?: boolean }[] = Array.isArray(cfg.layoutSections) ? cfg.layoutSections.filter((s: any) => s && typeof s.id === 'string') : []
  const seen = new Set(saved.map(s => s.id))
  const all = [...saved, ...HUB_SECTION_IDS.filter(x => !seen.has(x)).map(x => ({ id: x, visible: true }))]
  const layoutSections = all.map(s => (s.id === id ? { ...s, visible: on } : s))
  return { layoutSections, visibleSectionIds: layoutSections.filter(s => s.visible !== false).map(s => s.id) }
}

/** A big question - one card you can't miss, a switch on the right, what it changes underneath. */
export function QuestionCard({ icon: Icon, title, blurb, on, onChange, children, disabled, testId }: {
  icon: LucideIcon; title: string; blurb?: React.ReactNode; on: boolean; onChange: (v: boolean) => void
  children?: React.ReactNode; disabled?: boolean; testId?: string
}) {
  return (
    <div data-testid={testId} className={`overflow-hidden rounded-[26px] border-2 transition-colors duration-300 ${on ? 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white shadow-[0_26px_50px_-34px_rgba(139,106,43,.9)] dark:from-[#1d1912] dark:to-[#141416]' : 'border-[#ece5d6] bg-white dark:border-white/10 dark:bg-[#141416]'}`}>
      {/* Phones: icon, title and switch share the top row and the explanation gets the full width
          under them (squeezed between the icon and the switch it wrapped every two words). */}
      <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="block w-full p-4 text-left disabled:opacity-60 sm:p-6">
        <span className="flex items-center gap-3 sm:gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] transition-colors sm:h-14 sm:w-14 sm:rounded-[18px] ${on ? 'bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] ring-1 ring-[#C9A24D]/50' : 'bg-[#f4efe5] text-[#8b7355] dark:bg-white/[0.06] dark:text-gray-400'}`}><Icon className="h-5 w-5 sm:h-6 sm:w-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-[18px] font-black leading-tight text-[#111827] dark:text-white sm:text-[20px]">{title}</span>
            {blurb && <span className="mt-1 hidden text-[14px] font-medium leading-snug text-gray-500 dark:text-gray-400 sm:block">{blurb}</span>}
          </span>
          <OhpSwitch as="span" on={on} size="lg" />
        </span>
        {blurb && <span className="mt-2.5 block text-[14px] font-medium leading-snug text-gray-500 dark:text-gray-400 sm:hidden">{blurb}</span>}
      </button>
      {children && <div className="border-t-2 border-dashed border-[#ece5d6] px-5 pb-5 pt-4 dark:border-white/10 sm:px-6">{children}</div>}
    </div>
  )
}

/** A small caps label inside a question card. */
export function MiniLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{children}</p>
}

/** "Shows up on" - each place it appears, plainly. */
export function PlaceList({ places }: { places: { icon: LucideIcon; label: string; sub?: string }[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {places.map(p => (
        <li key={p.label} className="flex items-start gap-3 rounded-2xl bg-white/80 px-3.5 py-3 ring-1 ring-[#ece5d6] dark:bg-white/[0.03] dark:ring-white/10">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D]/[.12] text-[#8b6a2b] dark:text-[#e8c97a]"><p.icon className="h-4 w-4" /></span>
          <span className="min-w-0">
            <span className="block text-[14px] font-black text-[#111827] dark:text-white">{p.label}</span>
            {p.sub && <span className="block text-[12.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{p.sub}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** One place you can switch on or off (Agent Hub / Website / Email signature...). */
export function PlaceTile({ icon: Icon, title, sub, on, onChange, disabled, note }: {
  icon: LucideIcon; title: string; sub?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; note?: string
}) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative flex w-full items-start gap-3 rounded-[20px] border-2 p-3.5 text-left transition-all duration-200 disabled:cursor-not-allowed ${on && !disabled
        ? 'border-[#C9A24D] bg-white shadow-[0_16px_30px_-24px_rgba(139,106,43,.9)] dark:bg-[#1a1712]'
        : 'border-[#ece5d6] bg-white/70 hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-white/[0.02]'} ${disabled ? 'opacity-60' : ''}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] transition-colors ${on && !disabled ? 'bg-[#111827] text-[#e8c97a] dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-[#f4efe5] text-gray-400 dark:bg-white/[0.06]'}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1 pr-7">
        <span className="block text-[15px] font-black text-[#111827] dark:text-white">{title}</span>
        {sub && <span className="mt-0.5 block text-[12.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{sub}</span>}
        {note && <span className="mt-1.5 block text-[12px] font-bold leading-snug text-[#8b6a2b] dark:text-[#e8c97a]">{note}</span>}
      </span>
      <span className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${on && !disabled ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-white/20'}`}>
        {on && !disabled && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  )
}

/** Big segmented choice (sort order, Ivory / Midnight...). */
export function BigChoices<T extends string | number>({ value, onChange, options, label, cols = 3 }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string; sub?: string; icon?: LucideIcon }[]; label: string; cols?: 2 | 3 | 4
}) {
  const grid = cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-2.5 ${grid}`}>
      {options.map(o => {
        const on = o.id === value
        return (
          <button key={String(o.id)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.id)}
            className={`flex items-center gap-3 rounded-[18px] border-2 px-4 py-3.5 text-left transition-all duration-200 ${on ? 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white shadow-[0_14px_28px_-22px_rgba(139,106,43,.9)] dark:from-[#1d1912] dark:to-[#141416]' : 'border-[#ece5d6] bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416]'}`}>
            {o.icon && <o.icon className={`h-5 w-5 shrink-0 ${on ? 'text-[#C9A24D]' : 'text-gray-400'}`} />}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-black text-[#111827] dark:text-white">{o.label}</span>
              {o.sub && <span className="block text-[12px] font-medium leading-snug text-gray-500 dark:text-gray-400">{o.sub}</span>}
            </span>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-white/20'}`}>{on && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
          </button>
        )
      })}
    </div>
  )
}

/** A calm note box. */
export function Note({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'gold' }) {
  return (
    <p className={`rounded-2xl px-4 py-3 text-[13.5px] font-semibold leading-snug ${tone === 'gold' ? 'bg-[#fbf6ea] text-[#6f5523] ring-1 ring-[#C9A24D]/30 dark:bg-[#1a1712] dark:text-[#e8c97a]' : 'bg-[#f7f3ea] text-gray-600 dark:bg-white/[0.04] dark:text-gray-300'}`}>{children}</p>
  )
}

export const fmtMoney = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`)
