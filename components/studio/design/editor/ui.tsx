'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ComponentType, ReactNode } from 'react'
import { Check, ChevronDown, Loader2, RotateCcw, Star, Upload } from 'lucide-react'
import api from '@/lib/api-service'

// Shared building blocks for the design editor's right-hand panel. Everything here is tuned for
// someone who has never used design software: big targets, plain words, one idea per row.

export const inputCls = 'mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[15px] font-semibold text-[#111827] outline-none transition placeholder:text-gray-300 focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#18181b] dark:text-white dark:placeholder:text-gray-600'
export const labelCls = 'text-[11px] font-black uppercase tracking-[0.14em] text-gray-400'

export function Field({ label, hint, action, children }: { label: string; hint?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2">
        <span className={labelCls}>{label}</span>
        {action}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] font-semibold text-gray-400">{hint}</span>}
    </label>
  )
}

// One accordion card per group of things to change. `flash` briefly glows the card gold when the
// agent clicked that element in the preview, so the eye lands on the right controls.
export function Card({ icon: Icon, title, hint, open, onToggle, flash, children, badge }: {
  icon: ComponentType<{ className?: string }>; title: string; hint?: string; open: boolean; onToggle: () => void; flash?: boolean; children: ReactNode; badge?: ReactNode
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white transition-shadow duration-500 dark:bg-[#151517] ${open ? 'border-[#C9A24D] shadow-[0_18px_40px_-28px_rgba(201,162,77,.9)]' : 'border-gray-200 dark:border-white/10'} ${flash ? 'ring-4 ring-[#C9A24D]/30' : 'ring-0 ring-transparent'}`}>
      <button type="button" onClick={onToggle} className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#C9A24D]/[0.04] active:bg-[#C9A24D]/[0.08]">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:-translate-y-0.5 ${open ? 'scale-105 bg-[#C9A24D] text-white shadow-[0_8px_18px_-8px_rgba(201,162,77,.9)]' : 'bg-[#111827] text-[#e8c97a] dark:bg-white/10'}`}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-black text-[#111827] dark:text-white">{title}</span>
            {badge}
          </span>
          {hint && !open && <span className="block truncate text-xs font-semibold text-gray-400">{hint}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180 text-[#8b7355]' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.32, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.22 } }} className="overflow-hidden">
            <motion.div initial={{ y: -6 }} animate={{ y: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} className="space-y-4 border-t border-gray-100 px-4 pb-5 pt-4 dark:border-white/5">{children}</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export function Toggle({ label, hint, on, onChange, disabled }: { label: string; hint?: string; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition ${on ? 'border-[#C9A24D]/60 bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/10'} disabled:opacity-50`}>
      <span className="min-w-0">
        <span className="block text-sm font-black text-[#111827] dark:text-white">{label}</span>
        {hint && <span className="block text-[11px] font-semibold text-gray-400">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${on ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-white/15'}`}>
        <motion.span initial={false} animate={{ x: on ? 20 : 0 }} transition={{ type: 'spring', stiffness: 520, damping: 32 }} className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </button>
  )
}

// A row of equally-sized choices - the "approved options" pattern (sizes, positions, labels).
export function Seg<T extends string>({ value, options, onChange, columns }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; columns?: number }) {
  const id = useId()
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns || options.length}, minmax(0, 1fr))` }}>
      {options.map(o => {
        const on = o.value === value
        return (
          <motion.button key={o.value} type="button" whileTap={{ scale: 0.96 }} onClick={() => onChange(o.value)} className={`relative rounded-xl border px-2 py-2 text-center transition-colors duration-200 ${on ? 'border-[#C9A24D] text-[#111827] dark:text-white' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>
            {on && <motion.span layoutId={`seg-${id}`} transition={{ type: 'spring', stiffness: 480, damping: 36 }} className="absolute inset-0 rounded-[11px] bg-[#C9A24D]/10" />}
            <span className="relative block text-[12px] font-black">{o.label}</span>
            {o.hint && <span className="relative block text-[10px] font-semibold text-gray-400">{o.hint}</span>}
          </motion.button>
        )
      })}
    </div>
  )
}

// Quick-pick chips with the current value highlighted; typing in the field beside them still works.
export function Chips({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = o.trim().toLowerCase() === value.trim().toLowerCase()
        return (
          <motion.button key={o} type="button" whileTap={{ scale: 0.94 }} onClick={() => onPick(o)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-black transition duration-200 hover:-translate-y-0.5 ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] shadow-[0_6px_14px_-10px_rgba(201,162,77,.9)]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>
            {on && <Check className="h-3 w-3" />}{o}
          </motion.button>
        )
      })}
    </div>
  )
}

export function ResetLink({ onClick, children = 'Use the listing’s details' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">
      <RotateCcw className="h-3 w-3" /> {children}
    </button>
  )
}

export function Note({ children, tone = 'quiet' }: { children: ReactNode; tone?: 'quiet' | 'gold' | 'warn' }) {
  const cls = tone === 'gold' ? 'bg-[#C9A24D]/[0.08] text-[#6f5a37] dark:text-[#d7b974]' : tone === 'warn' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-[#f7f5f1] text-gray-500 dark:bg-white/5 dark:text-gray-400'
  return <p className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold leading-relaxed ${cls}`}>{children}</p>
}

// Picker tiles are ~120px wide - ask Unsplash for a small copy instead of decoding a 1600px photo per
// tile (the photo card can hold 20+ of them; full-size ones made the panel stutter while scrolling).
const thumb = (src: string) => (/images\.unsplash\.com\//.test(src) ? src.replace(/([?&])w=\d+/, '$1w=360').replace(/([?&])q=\d+/, '$1q=70') : src)

export function PhotoTile({ src, selected, onClick, starred, onStar, label, starTitle }: { src: string; selected?: boolean; onClick: () => void; starred?: boolean; onStar?: () => void; label?: string; starTitle?: string }) {
  return (
    <div className="group relative">
      <button type="button" onClick={onClick} className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl transition focus:outline-none ${selected ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#151517]' : 'opacity-90 hover:opacity-100'}`}>
        <img src={thumb(src)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        {label && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow">{label}</span>}
        {selected && !label && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D] text-white shadow"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
      </button>
      {onStar && (
        <button type="button" onClick={onStar} title={starTitle} className={`absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full shadow transition ${starred ? 'bg-[#C9A24D] text-white' : 'bg-black/45 text-white/90 opacity-0 group-hover:opacity-100 focus:opacity-100'}`}>
          <Star className={`h-3.5 w-3.5 ${starred ? 'fill-current' : ''}`} />
        </button>
      )}
    </div>
  )
}

// Upload straight into the agent's own Studio media. JPG/PNG/WebP; the server keeps the original.
export function UploadTile({ onUploaded, label = 'Upload a photo', compact = false }: { onUploaded: (url: string) => void; label?: string; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (file: File) => {
    setError('')
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setError('Please choose a JPG, PNG or WebP photo.'); return }
    setBusy(true)
    const res = await api.studio.uploadMedia(file, 'design')
    setBusy(false)
    if (res.success && res.data?.url) onUploaded(res.data.url)
    else setError(res.error || 'That upload did not work. Please try again.')
  }
  return (
    <div className={compact ? 'inline-block' : ''}>
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className={compact
        ? 'inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-white/10 dark:text-white'
        : 'flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 text-[11px] font-black text-gray-400 transition hover:border-[#C9A24D] hover:text-[#8b7355] disabled:opacity-60 dark:border-white/10'}>
        {busy ? <Loader2 className={compact ? 'h-3.5 w-3.5 animate-spin' : 'h-5 w-5 animate-spin'} /> : <Upload className={compact ? 'h-3.5 w-3.5' : 'h-5 w-5'} />}
        {busy ? 'Uploading…' : label}
      </button>
      {error && <p className="mt-1.5 text-[11px] font-bold text-red-500">{error}</p>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />
    </div>
  )
}

// Keeps a text input snappy while the design autosaves - edits land in local state instantly and
// reach the design a beat later.
export function useDraftValue(value: string, commit: (v: string) => void, delay = 250) {
  const [draft, setDraft] = useState(value)
  const last = useRef(value)
  useEffect(() => { if (value !== last.current) { last.current = value; setDraft(value) } }, [value])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = (v: string) => {
    setDraft(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { last.current = v; commit(v) }, delay)
  }
  return [draft, set] as const
}

export function money(v: number | string | null | undefined): string {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString('en-US')}` : ''
}

export function digitsOnly(v: string): string {
  return v.replace(/[^\d]/g, '')
}

export function prettyDigits(v: string | number | null | undefined): string {
  const d = digitsOnly(String(v ?? ''))
  return d ? Number(d).toLocaleString('en-US') : ''
}
