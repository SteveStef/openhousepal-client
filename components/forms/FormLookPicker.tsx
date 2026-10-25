'use client'

// How a form looks (user, 10/18 - "make forms colors customizable just like agent hub, same colors
// and themes ... and in setup flow make this a part"): match the Agent Hub (the default), or its own
// look from the hub's choices - Classic in one of the hub colours, Luxe in gold / silver / bronze
// (IDX), light or dark. Used in a form's Settings, the Showcase form's theme window and the setup
// flow; FormPhonePreview shows the real form page changing as each choice is tapped.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Layers, Loader2, Moon, Sparkles, Sun } from 'lucide-react'
import { HUB_CLASSIC_ACCENTS } from '@/components/agent-hub/HubClassicTheme'
import { LUXE_METALS, LUXE_METAL_ORDER, type LuxeMetal } from '@/lib/luxeMetals'
import { formLookLabel, formPaint, resolveFormLook, type FormLook, type FormLookFields } from '@/lib/formLook'

const colorName = (hex: string) => HUB_CLASSIC_ACCENTS.find(a => a.color.toLowerCase() === hex.toLowerCase())?.label || null
export const formLookName = (look: FormLook) => formLookLabel(look, colorName)

/** A tiny welcome screen painted in a look - the picker's tiles. */
export function FormLookThumb({ look, className = '' }: { look: FormLook; className?: string }) {
  const p = formPaint(look)
  const luxe = look.theme === 'luxe'
  const m = LUXE_METALS[look.metal]
  const bg = luxe
    ? look.dark ? `radial-gradient(120% 70% at 85% -10%, rgba(${m.rgb},.32), transparent 60%), linear-gradient(180deg,#0c0c0e,#141318)` : `radial-gradient(120% 70% at 85% -10%, rgba(${m.rgb},.3), transparent 60%), linear-gradient(180deg,#fffdf8,#f6efe1)`
    : look.dark ? `radial-gradient(circle at 25% 15%, rgba(${p.rgb},.28), transparent 45%), #0B0B0B` : `radial-gradient(circle at 25% 15%, rgba(${p.rgb},.2), transparent 45%), #FAFAF7`
  const ink = look.dark ? '#ffffff' : '#111827'
  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl ${className}`} style={{ background: bg, boxShadow: luxe ? `inset 0 0 0 1px rgba(${m.rgb},.35)` : undefined }}>
      {luxe && <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${m.deep}, ${m.light}, ${m.deep}, transparent)` }} />}
      <span className="h-5 w-5 rounded-full" style={{ background: luxe ? `conic-gradient(${m.deep}, ${m.light}, ${m.base}, ${m.deep})` : '#d1d5db', padding: 2 }}>
        <span className="block h-full w-full rounded-full" style={{ background: look.dark ? '#2a2a2e' : '#e5e7eb' }} />
      </span>
      <span className="mt-1.5 h-[5px] w-14 rounded-full" style={{ background: luxe ? `linear-gradient(90deg, ${ink}, ${look.dark ? m.light : m.deep}, ${ink})` : ink, opacity: 0.92 }} />
      <span className="mt-1 h-[3px] w-10 rounded-full" style={{ background: ink, opacity: 0.25 }} />
      <span className="mt-2 h-3.5 w-12 rounded-[5px]" style={{ background: p.fill, boxShadow: `0 6px 12px -6px rgba(${luxe ? m.rgb : p.rgb},.9)` }} />
    </div>
  )
}

function Tile({ on, onClick, disabled, title, blurb, badge, children }: { on: boolean; onClick: () => void; disabled?: boolean; title: string; blurb?: string; badge?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      className={`group relative w-full overflow-hidden rounded-[20px] border-2 p-2.5 text-left transition-all duration-300 disabled:cursor-not-allowed ${on
        ? 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white shadow-[0_18px_34px_-24px_rgba(139,106,43,.85)] dark:from-[#1d1912] dark:to-[#141416]'
        : 'border-[#ece5d6] bg-white hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416]'} ${disabled ? 'opacity-60' : ''}`}>
      {children}
      <span className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <span className="text-[14px] font-black text-[#111827] dark:text-white">{title}</span>
        {badge}
        {on && !badge && <span className="grid h-5 w-5 place-items-center rounded-full bg-[#C9A24D] text-white"><Check className="h-3 w-3" strokeWidth={3.5} /></span>}
      </span>
      {blurb && <span className="mt-0.5 block px-0.5 text-[12px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{blurb}</span>}
    </button>
  )
}

// Ivory / Midnight as two little scenes (user, 10/24 - "much nicer + animated"): a warm page with a
// sun whose rays turn, or a night page with a moon and twinkling stars. The picked one lifts, gets
// a ring and a tick, and its sky comes alive.
function ModeCard({ dark, on, accent, onClick }: { dark: boolean; on: boolean; accent: string; onClick: () => void }) {
  const stars = [[18, 22, 0], [74, 16, 0.6], [58, 40, 1.2], [86, 52, 0.3], [30, 50, 0.9]]
  return (
    <motion.button type="button" onClick={onClick} aria-pressed={on} whileTap={{ scale: 0.95 }}
      animate={{ y: on ? -2 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`relative h-[86px] overflow-hidden rounded-2xl text-left transition-shadow duration-300 ${on ? 'shadow-[0_16px_30px_-18px_rgba(17,24,39,.75)]' : 'opacity-80 hover:opacity-100'}`}
      style={{
        background: dark ? 'radial-gradient(120% 90% at 85% 0%, #23263a 0%, #0d0e14 60%, #08080b 100%)' : 'radial-gradient(120% 90% at 85% 0%, #fff4d6 0%, #fdf8ee 55%, #f6efe1 100%)',
        boxShadow: on ? `inset 0 0 0 2px ${accent}, 0 16px 30px -18px rgba(17,24,39,.75)` : `inset 0 0 0 1px ${dark ? 'rgba(255,255,255,.08)' : 'rgba(17,24,39,.08)'}`,
      }}>
      {dark ? (
        <>
          {stars.map(([x, y, delay], i) => (
            <motion.span key={i} className="absolute h-[3px] w-[3px] rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%` }}
              animate={on ? { opacity: [0.2, 1, 0.2], scale: [0.7, 1.2, 0.7] } : { opacity: 0.35, scale: 0.8 }}
              transition={on ? { duration: 2.2, delay, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }} />
          ))}
          <motion.span className="absolute right-3 top-2.5 text-[#f3e3b3]" animate={on ? { rotate: [-12, 8, -12] } : { rotate: 0 }} transition={on ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}>
            <Moon className="h-7 w-7 fill-[#f3e3b3]/30" />
          </motion.span>
        </>
      ) : (
        <motion.span className="absolute right-2.5 top-2 text-[#e0a526]" animate={on ? { rotate: 360 } : { rotate: 0 }} transition={on ? { duration: 14, repeat: Infinity, ease: 'linear' } : { duration: 0.4 }}>
          <Sun className="h-8 w-8 fill-[#ffd36a]/50" />
        </motion.span>
      )}
      <span className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between">
        <span>
          <span className={`block text-[15px] font-black ${dark ? 'text-white' : 'text-[#111827]'}`}>{dark ? 'Midnight' : 'Ivory'}</span>
          <span className={`block text-[11px] font-semibold ${dark ? 'text-white/55' : 'text-[#6b5a3a]/70'}`}>{dark ? 'Dark & dramatic' : 'Light & airy'}</span>
        </span>
        <AnimatePresence>
          {on && (
            <motion.span key="tick" initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: accent }}>
              <Check className="h-3.5 w-3.5" strokeWidth={3.5} style={{ color: dark ? '#111827' : '#fff' }} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{children}</p>
}

const sameLook = (a: FormLook, b: FormLook) => a.theme === b.theme && a.dark === b.dark && (a.theme === 'luxe' ? a.metal === b.metal : a.accent.toLowerCase() === b.accent.toLowerCase())

export default function FormLookPicker({ value, hubLook, brandLook, luxeAllowed, onChange, onApplyAll, applyAllLabel = 'Use this look on all my forms' }: {
  value: FormLookFields
  hubLook: FormLook
  /** Given = the two choices "My Brand Kit" (default) / "Choose my own" (forms' own pages). Without
   *  it (the setup flow, until it moves over) the older "Match my Agent Hub" / "Its own look". */
  brandLook?: FormLook
  luxeAllowed: boolean
  onChange: (patch: FormLookFields) => void
  /** Copies this look to every form. */
  onApplyAll?: () => Promise<boolean>
  applyAllLabel?: string
}) {
  // Brand mode: a legacy "match my hub" form reads as "My Brand Kit" when the hub wears the Brand
  // Kit (same look), else as its own look (the hub's) - so what visitors see never changes.
  const legacyHub = !!brandLook && value.look_mode !== 'custom' && value.look_mode !== 'brand'
  const legacyOwn = legacyHub && !sameLook(resolveFormLook({ look_mode: 'hub' }, hubLook, luxeAllowed), resolveFormLook({ look_mode: 'brand' }, hubLook, luxeAllowed, brandLook))
  const own = value.look_mode === 'custom' || legacyOwn
  const base = brandLook || hubLook
  const shown = resolveFormLook(value, hubLook, luxeAllowed, brandLook)
  const theme = value.look_mode === 'custom' ? (value.look_theme === 'luxe' && luxeAllowed ? 'luxe' : 'classic') : shown.theme
  const [applied, setApplied] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  useEffect(() => { setApplied('idle') }, [JSON.stringify(value)]) // eslint-disable-line react-hooks/exhaustive-deps

  // Its own look starts from the one it wears now, so the first tap changes nothing until they pick.
  const goOwn = () => {
    if (value.look_mode === 'custom') return
    if (brandLook) {
      onChange({ look_mode: 'custom', look_theme: shown.theme, accent_color: shown.accent, luxe_metal: shown.metal, dark_mode: shown.dark })
      return
    }
    const accentKnown = !!colorName(value.accent_color || '')
    onChange({ look_mode: 'custom', look_theme: hubLook.theme, accent_color: accentKnown ? value.accent_color : hubLook.accent, luxe_metal: hubLook.metal, dark_mode: hubLook.dark })
  }
  // A picked control on a legacy own (hub) look pins it as the form's own first.
  const pick = (patch: FormLookFields) => {
    if (value.look_mode !== 'custom') onChange({ look_mode: 'custom', look_theme: shown.theme, accent_color: shown.accent, luxe_metal: shown.metal, dark_mode: shown.dark, ...patch })
    else onChange(patch)
  }
  const metal = (value.look_mode === 'custom' ? value.luxe_metal as LuxeMetal : shown.metal) || 'gold'
  const accent = (value.look_mode === 'custom' ? value.accent_color || base.accent : shown.accent).toLowerCase()
  const brandShown = brandLook ? resolveFormLook({ look_mode: 'brand' }, hubLook, luxeAllowed, brandLook) : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {brandShown ? (
          <Tile on={!own} onClick={() => onChange({ look_mode: 'brand' })} title="My Brand Kit" blurb={formLookName(brandShown)}>
            <div className="relative" data-testid="form-look-brand">
              <FormLookThumb look={brandShown} className="h-24" />
              <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#8b6a2b] shadow-sm dark:bg-black/60 dark:text-[#e8c97a]"><Layers className="h-3.5 w-3.5" /></span>
            </div>
          </Tile>
        ) : (
          <Tile on={!own} onClick={() => onChange({ look_mode: 'hub' })} title="Match my Agent Hub" blurb={formLookName(resolveFormLook({ look_mode: 'hub' }, hubLook, luxeAllowed))}>
            <div className="relative">
              <FormLookThumb look={resolveFormLook({ look_mode: 'hub' }, hubLook, luxeAllowed)} className="h-24" />
              <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#8b6a2b] shadow-sm dark:bg-black/60 dark:text-[#e8c97a]"><Layers className="h-3.5 w-3.5" /></span>
            </div>
          </Tile>
        )}
        <Tile on={own} onClick={goOwn} title={brandShown ? 'Choose my own' : 'Its own look'} blurb={own ? formLookName(shown) : 'Pick a style, color and Ivory or Midnight.'}>
          <div className="relative" data-testid="form-look-own">
            <FormLookThumb look={own ? shown : { ...base, theme: 'classic', accent: '#2563EB' }} className="h-24" />
            <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#8b6a2b] shadow-sm dark:bg-black/60 dark:text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /></span>
          </div>
        </Tile>
      </div>

      <AnimatePresence initial={false}>
        {own && (
          <motion.div key="own" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="space-y-5 overflow-hidden">
            <div>
              <Label>Style</Label>
              <div className="grid grid-cols-2 gap-3">
                <Tile on={theme === 'classic'} onClick={() => pick({ look_theme: 'classic' })} title="Classic" blurb="Clean, in your color.">
                  <FormLookThumb look={{ ...shown, theme: 'classic' }} className="h-20" />
                </Tile>
                <Tile on={theme === 'luxe'} disabled={!luxeAllowed} onClick={() => pick({ look_theme: 'luxe' })} title="Luxe"
                  blurb={luxeAllowed ? 'Metal shine and a serif title.' : 'Included with the IDX plan.'}
                  badge={!luxeAllowed ? <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#e8c97a]">IDX</span> : undefined}>
                  <FormLookThumb look={{ ...shown, theme: 'luxe' }} className="h-20" />
                </Tile>
              </div>
            </div>

            <div>
              <Label>{theme === 'luxe' ? 'Finish' : 'Color'}</Label>
              <div role="radiogroup" aria-label={theme === 'luxe' ? 'Finish' : 'Color'} className="flex flex-wrap gap-2.5">
                {theme === 'luxe'
                  ? LUXE_METAL_ORDER.map(m => {
                    const on = metal === m
                    const c = LUXE_METALS[m]
                    return (
                      <button key={m} type="button" role="radio" aria-checked={on} onClick={() => pick({ luxe_metal: m })}
                        className={`flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3.5 text-[13px] font-black transition ${on ? 'border-[#111827] dark:border-white' : 'border-transparent bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05]'} text-[#111827] dark:text-white`}>
                        <span className="h-7 w-7 rounded-full" style={{ background: `conic-gradient(from 210deg, ${c.deep}, ${c.light}, ${c.pale}, ${c.base}, ${c.deep})`, boxShadow: `inset 0 0 0 1px rgba(0,0,0,.08)` }} />
                        {c.label}
                      </button>
                    )
                  })
                  : HUB_CLASSIC_ACCENTS.map(a => {
                    const on = accent === a.color.toLowerCase()
                    return (
                      <button key={a.color} type="button" role="radio" aria-checked={on} title={a.label} aria-label={a.label} onClick={() => pick({ accent_color: a.color })}
                        className={`relative grid h-10 w-10 place-items-center rounded-full transition hover:scale-105 ${on ? 'ring-2 ring-[#111827] ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-[#141416]' : ''}`}
                        style={{ background: a.color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }}>
                        {on && <Check className="h-4 w-4" strokeWidth={3.5} style={{ color: formPaint({ ...shown, theme: 'classic', accent: a.color, dark: false }).ink }} />}
                      </button>
                    )
                  })}
              </div>
              {theme === 'classic' && <p className="mt-2 text-[12px] font-bold text-gray-500 dark:text-gray-400">{colorName(accent) || 'Your custom color'}</p>}
            </div>

            <div>
              <Label>Ivory or Midnight</Label>
              <div className="grid grid-cols-2 gap-3">
                {[false, true].map(d => {
                  const on = (value.look_mode === 'custom' ? !!value.dark_mode : shown.dark) === d
                  return <ModeCard key={String(d)} dark={d} on={on} accent={formPaint({ ...shown, dark: d }).text} onClick={() => pick({ dark_mode: d })} />
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {onApplyAll && (
        // A real button, not a dashed link (user, 10/24): the look's own thumbnail, what it does,
        // and a tick that pops when every form has it.
        <motion.button type="button" disabled={applied === 'busy'}
          whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          onClick={async () => { setApplied('busy'); setApplied((await onApplyAll()) ? 'done' : 'error') }}
          className={`group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border-2 p-3 text-left shadow-[0_18px_34px_-26px_rgba(17,24,39,.8)] transition-colors disabled:cursor-wait ${applied === 'done' ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10' : 'border-[#111827] bg-[#111827] dark:border-white dark:bg-white'}`}>
          {applied !== 'done' && (
            <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg]" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,201,122,.35), transparent)' }}
              animate={{ x: ['0%', '420%'] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }} />
          )}
          <FormLookThumb look={shown} className="h-12 w-12 shrink-0 !rounded-xl" />
          <span className="relative min-w-0 flex-1">
            <span className={`block text-[14px] font-black ${applied === 'done' ? 'text-emerald-700 dark:text-emerald-300' : 'text-white dark:text-[#111827]'}`}>
              {applied === 'done' ? 'All your forms use this look now' : applied === 'error' ? 'That didn’t save - try again' : applyAllLabel}
            </span>
            <span className={`mt-0.5 block truncate text-[12px] font-semibold ${applied === 'done' ? 'text-emerald-600/80 dark:text-emerald-300/70' : 'text-white/60 dark:text-[#111827]/60'}`}>{formLookName(shown)} on every form</span>
          </span>
          <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full ${applied === 'done' ? 'bg-emerald-500 text-white' : 'bg-[#e8c97a] text-[#111827]'}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={applied} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }} className="grid place-items-center">
                {applied === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : applied === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : <Layers className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.button>
      )}
    </div>
  )
}

/** The real form page in a phone frame, repainted live as the look changes (?preview=1). */
export function FormPhonePreview({ src, look, width = 250, label = 'Your form' }: { src: string; look: FormLook; width?: number; label?: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const lookRef = useRef(look)
  lookRef.current = look
  const [ready, setReady] = useState(false)
  const [pulse, setPulse] = useState(0)
  const send = () => frame.current?.contentWindow?.postMessage({ type: 'ohp-form-look', look: lookRef.current }, window.location.origin)
  const key = JSON.stringify(look)
  const first = useRef(true)
  useEffect(() => {
    send()
    if (first.current) { first.current = false; return }
    setPulse(n => n + 1)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'ohp-form-preview-ready') return
      send(); window.setTimeout(() => setReady(true), 250)
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const inner = width - 20
  const scale = inner / 400
  const h = Math.round(inner * 2.05)
  const p = formPaint(look)
  const ring = look.theme === 'luxe' ? LUXE_METALS[look.metal].base : p.fill
  return (
    <div className="mx-auto shrink-0" style={{ width }}>
      <div className="relative rounded-[40px] border-[10px] border-[#111827] bg-[#111827] shadow-[0_40px_70px_-40px_rgba(17,24,39,.9)]">
        <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="relative overflow-hidden rounded-[30px] transition-colors duration-300" style={{ height: h, background: look.dark ? '#0B0B0B' : '#FAFAF7' }}>
          <iframe ref={frame} src={src} title={label} tabIndex={-1} aria-hidden
            className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
            style={{ width: 400, height: Math.round(h / scale), transform: `scale(${scale})` }} />
          {!ready && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>}
        </div>
        <AnimatePresence>
          {pulse > 0 && (
            <motion.span key={pulse} aria-hidden className="pointer-events-none absolute -inset-[10px] rounded-[40px] border-[3px]" style={{ borderColor: ring }}
              initial={{ opacity: 0.95, scale: 1 }} animate={{ opacity: 0, scale: 1.06 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          )}
        </AnimatePresence>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] font-black uppercase tracking-[0.2em] text-gray-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live preview</p>
    </div>
  )
}
