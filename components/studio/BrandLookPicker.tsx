'use client'

// The Brand Kit's look picker - Classic / Luxe, the color (the Agent Hub / IDX palette) or Luxe's
// finish, and Ivory / Midnight - plus a small live preview painted in it. Used by Studio -> Brand Kit
// and the setup flow's Brand step (components/setup/BrandStepLook). Pure UI: the caller saves
// (lib/brandKit useBrandKit().save).
import { useState } from 'react'
import { Check, Crown, Lock, Moon, Pipette, Sparkles, Sun } from 'lucide-react'
import type { BrandKit } from '@/types'
import { BRAND_COLOR_GROUPS, BRAND_FINISHES, BRAND_MODES, brandColorName, brandLookOf, type BrandKitPatch, type BrandLook } from '@/lib/brandKit'
import { LUXE_METALS } from '@/lib/luxeMetals'
import { formPaint } from '@/lib/formLook'

const inkOn = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.6 ? '#111827' : '#ffffff'
}

function Label({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <p className="mb-2 flex flex-wrap items-baseline gap-x-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
      {children}{note && <span className="normal-case tracking-normal text-[#8b7355] dark:text-[#e8c97a]">· {note}</span>}
    </p>
  )
}

export default function BrandLookPicker({ kit, luxeAllowed, onChange, showPreview = false }: {
  kit: BrandKit | null
  luxeAllowed: boolean
  onChange: (patch: BrandKitPatch) => void
  /** A small live preview under the choices (the setup step uses it; the Brand Kit page has its own). */
  showPreview?: boolean
}) {
  const look = brandLookOf(kit)
  const theme = look.theme === 'luxe' && luxeAllowed ? 'luxe' : 'classic'
  const [customOpen, setCustomOpen] = useState(false)
  const secondary = (kit?.secondary_color || look.accent).toUpperCase()

  return (
    <div className="space-y-5">
      {/* Look */}
      <div>
        <Label>Look</Label>
        <div className="grid grid-cols-2 gap-2.5">
          {([['classic', 'Classic', 'Clean and bright, in your color.', Sparkles], ['luxe', 'Luxe', luxeAllowed ? 'Metal shine, serif type, cinematic light.' : 'Included with the IDX plan.', Crown]] as const).map(([id, name, blurb, Icon]) => {
            const on = theme === id
            const locked = id === 'luxe' && !luxeAllowed
            return (
              <button key={id} type="button" disabled={locked} aria-pressed={on} data-testid={`brand-look-${id}`}
                onClick={() => onChange({ look: { theme: id } })}
                className={`relative rounded-2xl border-2 p-2 text-left transition disabled:cursor-not-allowed ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06] shadow-[0_14px_30px_-22px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'} ${locked ? 'opacity-60' : ''}`}>
                <BrandLookPreview look={{ ...look, theme: id }} compact />
                <span className="mt-2 flex items-center gap-1.5 px-0.5">
                  <Icon className={`h-3.5 w-3.5 ${on ? 'text-[#C9A24D]' : 'text-gray-400'}`} />
                  <span className="text-sm font-black text-[#111827] dark:text-white">{name}</span>
                  {locked && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#111827] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#e8c97a]"><Lock className="h-2.5 w-2.5" /> IDX</span>}
                  {on && !locked && <span className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
                </span>
                <span className="mt-0.5 block px-0.5 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{blurb}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Color (Classic) or finish (Luxe) */}
      {theme === 'luxe' ? (
        <div>
          <Label note={LUXE_METALS[look.metal].label}>Finish</Label>
          <div className="grid grid-cols-3 gap-2">
            {BRAND_FINISHES.map(f => {
              const on = look.metal === f.id
              const p = f.palette
              return (
                <button key={f.id} type="button" aria-pressed={on} data-testid={`brand-metal-${f.id}`} onClick={() => onChange({ look: { metal: f.id } })}
                  className={`rounded-xl border-2 p-2 text-left transition ${on ? 'border-[#111827] dark:border-white' : 'border-gray-200 hover:border-gray-400 dark:border-gray-800'}`}>
                  <span className="block h-8 rounded-lg" style={{ background: `linear-gradient(115deg, ${p.deep}, ${p.base} 35%, ${p.pale} 52%, ${p.light} 62%, ${p.deep})` }} />
                  <span className="mt-1.5 flex items-center gap-1 text-[12px] font-black text-[#111827] dark:text-white">{on && <Check className="h-3 w-3" strokeWidth={3} />}{f.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <Label note={brandColorName(secondary) || 'Custom color'}>Color</Label>
            <button type="button" onClick={() => setCustomOpen(v => !v)} className="mb-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-gray-400 hover:text-[#8b7355]">
              <Pipette className="h-3 w-3" /> {customOpen ? 'Hide' : 'Any color'}
            </button>
          </div>
          {/* One even grid (9 across - the palette fills two full rows), the dots sized to fit, so a
              phone never leaves one color alone on its own row (user, 10/22). */}
          <div role="radiogroup" aria-label="Brand color" className="grid grid-cols-9 gap-1.5 sm:gap-2">
            {BRAND_COLOR_GROUPS.flat().map(c => {
              const on = c.color.toUpperCase() === secondary
              return (
                <button key={c.color} type="button" role="radio" aria-checked={on} title={c.label} aria-label={c.label} data-testid={`brand-color-${c.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => onChange({ secondary_color: c.color })}
                  className={`relative grid aspect-square w-full max-w-9 place-items-center justify-self-center rounded-full transition hover:scale-110 active:scale-95 ${on ? 'ring-2 ring-[#111827] ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-[#151517]' : 'ring-1 ring-black/10 dark:ring-white/15'}`}
                  style={{ background: c.color }}>
                  {on && <Check className="h-4 w-4" strokeWidth={3.5} style={{ color: inkOn(c.color) }} />}
                </button>
              )
            })}
          </div>
          {customOpen && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] p-2 dark:border-gray-700 dark:bg-[#1A1A1C]">
              <input type="color" aria-label="Any color" value={/^#[0-9a-f]{6}$/i.test(secondary) ? secondary : '#C9A24D'} onChange={e => onChange({ secondary_color: e.target.value })} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent" />
              <span className="text-sm font-bold uppercase text-[#111827] dark:text-white">{secondary}</span>
            </div>
          )}
        </div>
      )}

      {/* Ivory / Midnight */}
      <div>
        <Label>Ivory or Midnight</Label>
        <div className="grid grid-cols-2 gap-2">
          {BRAND_MODES.map(m => {
            const on = look.dark === m.dark
            const Icon = m.dark ? Moon : Sun
            return (
              <button key={m.id} type="button" aria-pressed={on} data-testid={`brand-mode-${m.id}`} onClick={() => onChange({ look: { dark: m.dark } })}
                className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/5' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.dark ? 'bg-[#111827] text-[#e8c97a]' : 'bg-[#fff7df] text-[#b8860b]'}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="block text-xs font-black text-[#111827] dark:text-white">{m.label}</span><span className="block text-[10px] font-semibold leading-snug text-gray-400">{m.blurb}</span></span>
              </button>
            )
          })}
        </div>
      </div>

      {showPreview && <BrandLookPreview look={{ ...look, theme }} />}
    </div>
  )
}

/** A tiny Agent Hub painted in a brand look - photo ring, name, the lead buttons. */
export function BrandLookPreview({ look, compact = false, name = 'Your Name', photoUrl }: { look: BrandLook; compact?: boolean; name?: string; photoUrl?: string | null }) {
  const luxe = look.theme === 'luxe'
  const m = LUXE_METALS[look.metal]
  const dark = look.dark
  const accent = look.accent
  const bg = luxe
    ? dark ? `radial-gradient(120% 70% at 85% -10%, rgba(${m.rgb},.32), transparent 60%), linear-gradient(180deg,#0c0c0e,#141318)` : `radial-gradient(120% 70% at 85% -10%, rgba(${m.rgb},.28), transparent 60%), linear-gradient(180deg,#fffdf8,#f6efe1)`
    : dark ? '#0B0B0B' : '#FAFAF7'
  const ink = dark ? '#ffffff' : '#111827'
  const sub = dark ? 'rgba(255,255,255,.55)' : 'rgba(17,24,39,.5)'
  // Same paint as a real form / hub (lib/formLook formPaint) - black on Midnight flips light, etc.
  const paint = formPaint({ theme: luxe ? 'luxe' : 'classic', accent, metal: look.metal, dark })
  const fill = paint.fill
  const fillInk = paint.ink
  const softInk = luxe ? (dark ? m.light : m.deep) : paint.text
  const ring = luxe ? `conic-gradient(${m.deep}, ${m.light}, ${m.base}, ${m.pale}, ${m.deep})` : accent
  const tint = luxe ? `rgba(${m.rgb},.14)` : `${accent}1f`
  return (
    <div className={`pointer-events-none select-none overflow-hidden rounded-xl border ${dark ? 'border-white/10' : 'border-black/[0.07]'} ${compact ? 'px-3 py-3' : 'px-5 py-6'}`} style={{ background: bg }} aria-hidden>
      {luxe && <span className={`${compact ? '-mx-3 -mt-3 mb-2' : '-mx-5 -mt-6 mb-3'} block h-[2px]`} style={{ background: `linear-gradient(90deg, transparent, ${m.deep}, ${m.light}, ${m.deep}, transparent)` }} />}
      <div className="flex flex-col items-center">
        <span className={`${compact ? 'h-9 w-9' : 'h-16 w-16'} rounded-full p-[2.5px]`} style={{ background: ring }}>
          <span className="block h-full w-full rounded-full bg-cover bg-center" style={{ background: photoUrl ? `center/cover url(${photoUrl})` : dark ? '#2a2a2e' : '#e5e7eb' }} />
        </span>
        <span className={`${compact ? 'mt-1.5 text-[11px]' : 'mt-2.5 text-lg'} font-black leading-tight ${luxe ? 'font-serif' : ''}`} style={{ color: ink }}>{name}</span>
        {!compact && <span className="mt-0.5 text-[11px] font-bold" style={{ color: sub }}>Realtor · Your Brokerage</span>}
        <div className={`${compact ? 'mt-2 w-full space-y-1' : 'mt-4 w-full max-w-[240px] space-y-1.5'}`}>
          <span className={`block rounded-full text-center font-black ${compact ? 'py-1 text-[8px]' : 'py-2 text-[11px]'}`} style={{ background: fill, color: fillInk, boxShadow: luxe ? `0 8px 18px -10px rgba(${m.rgb},.9)` : undefined }}>Save Contact</span>
          <span className={`block rounded-full text-center font-black ${compact ? 'py-1 text-[8px]' : 'py-2 text-[11px]'}`} style={{ background: tint, color: softInk, border: `1px solid ${luxe ? `rgba(${m.rgb},.4)` : `${accent}55`}` }}>Schedule a Showing</span>
          {!compact && <span className="block rounded-full py-2 text-center text-[11px] font-black" style={{ background: tint, color: softInk, border: `1px solid ${luxe ? `rgba(${m.rgb},.4)` : `${accent}55`}` }}>Home Value</span>}
        </div>
      </div>
    </div>
  )
}
