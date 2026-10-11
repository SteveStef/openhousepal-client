'use client'

// Building blocks for the setup flow - big, calm and obvious, for someone who has never filled in
// a website form before: large type, one plain label per box, a short hint under it, and choices
// as tappable cards instead of dropdowns.
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Lock } from 'lucide-react'
import type { SetupData, SetupInfoPatch } from '@/lib/api-service'
import OhpSwitch from '@/components/ui/OhpSwitch'

export type Gate = { ok: boolean; message?: string; onContinue?: () => Promise<boolean | void> }
export type StepCtx = {
  data: SetupData
  setData: (d: SetupData) => void
  /** debounced, merged save of the agent's info (hub config + account) */
  saveInfo: (patch: SetupInfoPatch) => void
  /** report a save made through another endpoint, for the "Saved" pill */
  markSaving: (p: Promise<unknown>) => void
  setGate: (g: Gate) => void
  plan: string | null
}

/** Register this step's Continue rule; re-registers whenever deps change. */
export function useGate(ctx: StepCtx, gate: Gate, deps: unknown[]) {
  const ref = useRef(gate)
  ref.current = gate
  useEffect(() => {
    ctx.setGate({ ok: gate.ok, message: gate.message, onContinue: gate.onContinue ? () => ref.current.onContinue!() : undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export const inputCls = 'block w-full rounded-2xl border-2 border-[#e7dfcf] bg-white px-5 py-4 text-[17px] font-semibold text-[#111827] shadow-[inset_0_1px_2px_rgba(17,24,39,.04)] outline-none transition placeholder:font-medium placeholder:text-gray-400 focus:border-[#C9A24D] focus:shadow-[0_0_0_5px_rgba(201,162,77,.16)] dark:border-white/10 dark:bg-[#0e0e10] dark:text-white dark:placeholder:text-gray-500 dark:focus:border-[#C9A24D]'

export function Field({ label, hint, required, value, onChange, placeholder, type = 'text', inputMode, autoComplete, onBlur, invalid, maxLength, children }: {
  label: string; hint?: string; required?: boolean; value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; autoComplete?: string; onBlur?: () => void; invalid?: boolean; maxLength?: number
  children?: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-[15px] font-black text-[#111827] dark:text-white">
        {label}
        {required ? <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#8b6a2b] dark:text-[#e8c97a]">Needed</span> : <span className="text-[12px] font-bold text-gray-400">Optional</span>}
      </span>
      {hint && <span className="mt-1 block text-[13.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{hint}</span>}
      <input
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={`${inputCls} mt-2.5 ${invalid ? '!border-rose-300 dark:!border-rose-500/60' : ''}`}
      />
      {children}
    </label>
  )
}

/** (610) 555-0134 as they type; anything that isn't a 10/11-digit US number is left alone. */
export function formatPhone(v: string): string {
  const d = v.replace(/\D/g, '')
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  if (ten.length !== 10) return v
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}
export const phoneOk = (v: string) => { const d = v.replace(/\D/g, ''); return d.length === 10 || (d.length === 11 && d.startsWith('1')) }
export const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export function ChoiceCard({ on, onClick, title, blurb, children, badge, disabled }: {
  on: boolean; onClick: () => void; title: string; blurb?: string; children?: React.ReactNode; badge?: React.ReactNode; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`group relative w-full overflow-hidden rounded-[22px] border-2 p-3 text-left transition-all duration-300 disabled:cursor-not-allowed ${on
        ? 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white shadow-[0_22px_40px_-26px_rgba(139,106,43,.85)] dark:from-[#1d1912] dark:to-[#141416]'
        : 'border-[#ece5d6] bg-white hover:-translate-y-0.5 hover:border-[#C9A24D]/60 hover:shadow-[0_18px_34px_-28px_rgba(139,106,43,.7)] dark:border-white/10 dark:bg-[#141416] dark:hover:border-[#C9A24D]/50'} ${disabled ? 'opacity-70' : ''}`}
    >
      {children}
      <div className="mt-3 flex items-center gap-2 px-1">
        <p className="font-serif text-[18px] font-black text-[#111827] dark:text-white">{title}</p>
        {badge}
        <span className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-white/20'}`}>
          {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </div>
      {blurb && <p className="mt-0.5 px-1 pb-1 text-[13px] font-medium leading-snug text-gray-500 dark:text-gray-400">{blurb}</p>}
    </button>
  )
}

export function Swatches({ colors, value, onChange, label }: { colors: { color: string; label: string }[]; value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
      {colors.map(c => {
        const on = c.color.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={c.color}
            type="button"
            role="radio"
            aria-checked={on}
            title={c.label}
            onClick={() => onChange(c.color)}
            className="group flex flex-col items-center gap-1.5"
          >
            <span className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-sm ring-1 ring-black/10 transition ${on ? 'scale-110 border-[#111827] dark:border-white' : 'border-white group-hover:scale-105 dark:border-[#141416]'}`} style={{ background: c.color, boxShadow: on ? '0 0 0 3px rgba(201,162,77,.35)' : undefined }}>
              {on && <Check className={`h-5 w-5 ${isLight(c.color) ? 'text-[#111827]' : 'text-white'}`} strokeWidth={3} />}
            </span>
            <span className={`text-[11px] font-bold ${on ? 'text-[#111827] dark:text-white' : 'text-gray-500'}`}>{c.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function isLight(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 165
}

export function BigToggle({ on, onChange, title, blurb, disabled }: { on: boolean; onChange: (v: boolean) => void; title: string; blurb?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-4 rounded-2xl border-2 border-[#ece5d6] bg-white px-5 py-4 text-left transition hover:border-[#C9A24D]/50 disabled:opacity-60 dark:border-white/10 dark:bg-[#141416]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-black text-[#111827] dark:text-white">{title}</span>
        {blurb && <span className="mt-0.5 block text-[13.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{blurb}</span>}
      </span>
      <OhpSwitch as="span" on={on} size="lg" />
    </button>
  )
}

/** A preview pinned under the top bar while they scroll through the choices below it - on every
 *  screen size, or (`desktopOnly`) only where there's room for it to stay. */
export function PinnedPreview({ children, desktopOnly = false }: { children: React.ReactNode; desktopOnly?: boolean }) {
  return (
    <div className={`${desktopOnly ? 'lg:sticky' : 'sticky'} top-[67px] z-20 -mx-6 -mt-8 border-b border-[#C9A24D]/15 bg-white/95 px-6 pb-5 pt-5 shadow-[0_18px_30px_-28px_rgba(17,24,39,.5)] dark:border-white/[0.06] dark:bg-[#121214]/95 sm:-mx-10 sm:-mt-10 sm:px-10`}>
      {children}
    </div>
  )
}

export function SubHead({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h3 className="font-serif text-[21px] font-black tracking-tight text-[#111827] dark:text-white">{children}</h3>
      {sub && <p className="mt-0.5 text-[14px] font-medium text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
}

export function MoreOptions({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl border-2 border-dashed border-[#e7dfcf] dark:border-white/10">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[15px] font-black text-[#111827] dark:text-white">
        {label}
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-5 border-t-2 border-dashed border-[#e7dfcf] px-5 pb-5 pt-4 dark:border-white/10">{children}</div>}
    </div>
  )
}

export function LockedValue({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <span className="text-[15px] font-black text-[#111827] dark:text-white">{label}</span>
      <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border-2 border-[#C9A24D]/40 bg-[#fbf6ea] px-5 py-4 dark:bg-[#1a1712]">
        <span className="text-[19px] font-black tracking-wide text-[#111827] dark:text-white">{value}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-[#8b6a2b] shadow-sm dark:bg-black/30 dark:text-[#e8c97a]"><Lock className="h-3.5 w-3.5" /> Saved & locked</span>
      </div>
      <p className="mt-2 text-[13.5px] font-medium text-gray-500 dark:text-gray-400">{note}</p>
    </div>
  )
}

/** Shrinks any picked image to a JPG under ~4MB (the upload accepts JPG only) - so a PNG or a
 * huge phone photo still just works. */
export async function toJpeg(file: File, maxSide = 2000): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const g = canvas.getContext('2d')!
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9))
    if (!blob) throw new Error('convert failed')
    return new File([blob], (file.name.replace(/\.[^.]+$/, '') || 'photo') + '.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
