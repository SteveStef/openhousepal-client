'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Crown, Loader2, Moon, Sparkles, Sun, Trash2, Upload, Wand2 } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { SiteTheme } from '@/types'
import { accentLabel } from '@/lib/accentSwatches'
import { CLASSIC_ACCENTS, CLASSIC_DEFAULT_ACCENT, siteLuxeMetal, siteThemeVars } from '@/lib/siteTheme'
import { LUXE_METALS, LUXE_METAL_ORDER, type LuxeMetal } from '@/lib/luxeMetals'
import { useToast } from '@/contexts/ToastContext'
import OhpSwitch from '@/components/ui/OhpSwitch'
import { brandColorName, brandLookOf, modeLabel, siteThemeWithBrand } from '@/lib/brandKit'
import { isLightColor } from '@/lib/siteTheme'

// The Design tab. Everything here is "one click, whole site": the look (Classic / Luxe), the
// accent color (the same swatches as the Email Signature), light or dark by default (visitors
// get a switch unless it's turned off), fonts and logo. Every change is reflected in the live
// preview immediately through lib/siteTheme.ts -> site-theme.css variables.

const TEMPLATE_DEFAULT_HEADING: Record<'default' | 'luxe', string> = { default: 'sans', luxe: 'serif' }

function MiniSite({ template, mode, accent, primary }: { template: 'default' | 'luxe'; mode: 'light' | 'dark'; accent: string; primary: string }) {
  const dark = mode === 'dark'
  const luxe = template === 'luxe'
  const bg = dark ? '#0d0f14' : luxe ? '#f8f7f3' : '#ffffff'
  const surface = dark ? '#171a21' : '#ffffff'
  const ink = dark ? '#e9e6df' : '#1a1a1a'
  const line = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)'
  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-xl border" style={{ backgroundColor: bg, borderColor: line, fontFamily: luxe ? 'Georgia, serif' : 'system-ui, sans-serif' }}>
      {/* header */}
      <div className="flex items-center justify-between px-2.5 py-1.5" style={{ backgroundColor: luxe ? primary : surface, borderBottom: `1px solid ${line}` }}>
        <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: luxe ? accent : ink, opacity: luxe ? 1 : 0.8 }} />
        <span className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="h-1 w-3 rounded-full" style={{ backgroundColor: luxe ? 'rgba(255,255,255,.5)' : ink, opacity: luxe ? 1 : 0.35 }} />)}</span>
      </div>
      {/* hero */}
      <div className="relative px-2.5 py-3" style={{ background: luxe ? `linear-gradient(135deg, ${primary}, #05070c 70%)` : dark ? `linear-gradient(135deg, ${primary}, #0d0f14)` : `linear-gradient(135deg, ${primary}cc, ${primary})` }}>
        {luxe && <span className="absolute inset-0 opacity-[.12] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:10px_10px]" />}
        {luxe && <span className="absolute -right-4 -top-6 h-14 w-14 rounded-full opacity-40 blur-xl" style={{ backgroundColor: accent }} />}
        <span className="relative block h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
        <span className="relative mt-1.5 block h-2 w-20 rounded-sm bg-white/90" />
        <span className="relative mt-1 block h-2 w-12 rounded-sm" style={{ backgroundColor: accent }} />
        <span className={`relative mt-2 block h-3 w-24 bg-white/95 ${luxe ? 'rounded-full' : 'rounded-md'}`} />
      </div>
      {/* cards */}
      <div className="grid grid-cols-3 gap-1.5 px-2.5 py-2">
        {[0, 1, 2].map(i => (
          <div key={i} className={`overflow-hidden ${luxe ? 'rounded-lg' : 'rounded-md'}`} style={{ backgroundColor: surface, border: `1px solid ${line}` }}>
            <div className="h-6" style={{ background: `linear-gradient(135deg, ${primary}99, ${primary})` }} />
            <div className="space-y-1 p-1">
              <span className="block h-1 w-3/4 rounded-full" style={{ backgroundColor: ink, opacity: 0.7 }} />
              <span className="block h-1 w-1/2 rounded-full" style={{ backgroundColor: accent }} />
            </div>
          </div>
        ))}
      </div>
      {/* dark band */}
      <div className="mx-2.5 mb-2 flex items-center justify-between rounded-md px-2 py-1.5" style={{ backgroundColor: luxe ? primary : dark ? surface : '#f3f4f6' }}>
        <span className="block h-1 w-10 rounded-full" style={{ backgroundColor: luxe ? 'rgba(255,255,255,.6)' : ink, opacity: luxe ? 1 : 0.6 }} />
        <span className="block h-2 w-6 rounded-full" style={{ backgroundColor: accent }} />
      </div>
    </div>
  )
}

export default function ThemePanel({ theme, onChange }: { theme: SiteTheme; onChange: (theme: SiteTheme) => void }) {
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  // Any hand edit here means the site stops following the Brand Kit (the "Match my Brand Kit"
  // button below brings it back).
  const set = (patch: Partial<SiteTheme>) => onChange({ ...theme, ...patch, follow_brand_kit: false })
  const template: 'default' | 'luxe' = theme.template === 'default' ? 'default' : 'luxe'
  const mode: 'light' | 'dark' = theme.mode === 'dark' ? 'dark' : 'light'
  const vars = siteThemeVars(theme)
  const accentName = accentLabel(theme.secondary_color)

  const pickTemplate = (next: 'default' | 'luxe') => {
    if (next === template) return
    // Each look has its own natural heading font; swap it unless the agent chose a font themselves.
    const other = template
    const headingFont = theme.heading_font === TEMPLATE_DEFAULT_HEADING[other] ? TEMPLATE_DEFAULT_HEADING[next] : theme.heading_font
    // Each look keeps its own color: Luxe a metal finish, Classic a (non-metal) accent.
    const classicAccent = CLASSIC_ACCENTS.some(c => c.color.toLowerCase() === (theme.secondary_color || '').toLowerCase()) ? theme.secondary_color : CLASSIC_DEFAULT_ACCENT
    set(next === 'luxe'
      ? { template: next, heading_font: headingFont, luxe_metal: siteLuxeMetal(theme), secondary_color: LUXE_METALS[siteLuxeMetal(theme)].base }
      : { template: next, heading_font: headingFont, secondary_color: classicAccent })
  }
  const metal = siteLuxeMetal(theme)
  const pickMetal = (m: LuxeMetal) => set({ luxe_metal: m, secondary_color: LUXE_METALS[m].base })

  const uploadLogo = async (file: File) => {
    setUploading(true)
    const res = await api.studio.uploadMedia(file, 'brand_logo')
    setUploading(false)
    if (res.success && res.data?.url) set({ logo_url: res.data.url })
    else showToast(res.error || 'Could not upload that file.', 'error')
  }
  const loaderRef = useRef<HTMLInputElement>(null)
  const [loaderUploading, setLoaderUploading] = useState(false)
  const uploadLoaderLogo = async (file: File) => {
    setLoaderUploading(true)
    const res = await api.studio.uploadMedia(file, 'brand_logo')
    setLoaderUploading(false)
    if (res.success && res.data?.url) set({ loader_logo_url: res.data.url })
    else showToast(res.error || 'Could not upload that file.', 'error')
  }

  // "My Brand Kit": colors, fonts, logo - and the look once one is saved in the Brand Kit - follow
  // it live (backend content_adapters.resolve_theme; lib/brandKit siteThemeWithBrand here).
  const following = theme.follow_brand_kit !== false
  const [brandSummary, setBrandSummary] = useState<string>('')
  const matchBrandKit = async () => {
    setResetting(true)
    const res = await api.studio.getBrandKit()
    setResetting(false)
    if (!res.success || !res.data) { showToast('Could not read your Brand Kit.', 'error'); return }
    onChange(siteThemeWithBrand({ ...theme, follow_brand_kit: true }, res.data))
    showToast('Your site now follows your Brand Kit.', 'success')
  }
  useEffect(() => {
    api.studio.getBrandKit().then(res => {
      if (!res.success || !res.data) return
      const l = brandLookOf(res.data)
      setBrandSummary(l.saved
        ? `${l.theme === 'luxe' ? `Luxe · ${LUXE_METALS[l.metal].label}` : `Classic · ${brandColorName(l.accent) || 'Custom color'}`} · ${modeLabel(l.dark)}`
        : 'Your colors, fonts and logo')
    })
  }, [])

  const label = 'text-[10px] font-black uppercase tracking-wide text-gray-400'
  const input = 'mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'

  return (
    <div className="space-y-5">
      {/* 0. Where it comes from - the Brand Kit (default) or this site's own */}
      <div>
        <p className={label}>Look comes from</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where the look comes from">
          {([['brand', 'My Brand Kit', brandSummary || 'Your Brand Kit'], ['own', 'Choose my own', 'Pick a look just for this site below.']] as const).map(([id, name, blurb]) => {
            const on = (id === 'brand') === following
            return (
              <button key={id} type="button" role="radio" aria-checked={on} data-testid={`site-look-${id}`} disabled={id === 'brand' && resetting}
                onClick={() => (id === 'brand' ? (!following && matchBrandKit()) : following && onChange({ ...theme, follow_brand_kit: false }))}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/5' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
                <span className="flex items-center gap-1.5 text-xs font-black text-[#111827] dark:text-white">{id === 'brand' ? (resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 text-[#C9A24D]" />) : <Sparkles className="h-3.5 w-3.5 text-gray-400" />}{name}{on && <Check className="ml-auto h-3.5 w-3.5 text-[#C9A24D]" />}</span>
                <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-gray-400">{blurb}</span>
              </button>
            )
          })}
        </div>
        {following && <p className="mt-1.5 text-[10px] font-semibold text-gray-400">Change your Brand Kit (Studio → Brand Kit) and your site changes too. Picking anything below gives the site its own look.</p>}
      </div>

      {/* 1. The look */}
      <div>
        <p className={label}>The look</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {([
            ['default', 'Classic', 'Clean and bright. Same sections, calmer finish - great for most agents.', Sparkles],
            ['luxe', 'Luxe', 'Cinematic: deep panels, metallic accents, gliding photo strips. For high-end brands.', Crown],
          ] as const).map(([id, name, blurb, Icon]) => {
            const on = template === id
            return (
              <button key={id} type="button" onClick={() => pickTemplate(id)} className={`group rounded-2xl border-2 p-2 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/5 shadow-[0_14px_30px_-22px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
                <MiniSite template={id} mode={mode} accent={vars.accent} primary={theme.primary_color} />
                <div className="mt-2 flex items-center gap-1.5 px-0.5">
                  <Icon className={`h-3.5 w-3.5 ${on ? 'text-[#C9A24D]' : 'text-gray-400'}`} />
                  <span className="text-sm font-black text-[#111827] dark:text-white">{name}</span>
                  {on && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#111827]"><Check className="h-2.5 w-2.5" /> On</span>}
                </div>
                <p className="mt-0.5 px-0.5 text-[10px] font-semibold leading-snug text-gray-400">{blurb}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Color - Luxe: a metal finish (the Email Signature's exact gold / silver / bronze);
          Classic: any of the other accent colors. */}
      {template === 'luxe' ? (
        <div>
          <p className={label}>Finish<span className="ml-1.5 normal-case tracking-normal text-[#8b7355] dark:text-[#e8c97a]">· {LUXE_METALS[metal].label}</span></p>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {LUXE_METAL_ORDER.map(m => {
              const p = LUXE_METALS[m]
              const on = metal === m
              return (
                <button key={m} type="button" onClick={() => pickMetal(m)} data-testid={`site-metal-${m}`}
                  className={`group relative overflow-hidden rounded-xl border-2 p-2 text-left transition ${on ? 'border-[#111827] dark:border-white' : 'border-gray-200 hover:border-gray-400 dark:border-gray-800'}`}>
                  <span className="block h-9 rounded-lg" style={{ background: `linear-gradient(115deg, ${p.deep}, ${p.base} 35%, ${p.pale} 52%, ${p.light} 62%, ${p.deep})` }} />
                  <span className="mt-1.5 flex items-center gap-1 text-[11px] font-black text-[#111827] dark:text-white">{on && <Check className="h-3 w-3" />}{p.label}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[10px] font-semibold text-gray-400">The same gold, silver and bronze as your Email Signature and Agent Hub.</p>
        </div>
      ) : (
      <div>
        <div className="flex items-center justify-between">
          <p className={label}>Accent color{accentName ? <span className="ml-1.5 normal-case tracking-normal text-[#8b7355] dark:text-[#e8c97a]">· {accentName}</span> : null}</p>
          <button type="button" onClick={() => setCustomOpen(v => !v)} className="text-[10px] font-black uppercase tracking-wide text-gray-400 hover:text-[#8b7355]">{customOpen ? 'Hide custom' : 'Custom'}</button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {CLASSIC_ACCENTS.map(s => {
            const on = vars.accent.toLowerCase() === s.color.toLowerCase()
            return (
              <button
                key={s.color} type="button" title={s.label} aria-label={s.label} onClick={() => set({ secondary_color: s.color })}
                className={`relative h-8 w-8 rounded-full ring-offset-2 ring-offset-white transition hover:scale-110 active:scale-95 dark:ring-offset-[#141416] ${on ? 'ring-2 ring-[#111827] dark:ring-white' : 'ring-1 ring-black/10'}`}
                style={{ background: s.color }}
              >
                {on && <Check className="absolute inset-0 m-auto h-3.5 w-3.5" style={{ color: isLightColor(s.color) || s.color === '#F1746B' ? '#111827' : '#fff' }} />}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[10px] font-semibold text-gray-400">Buttons, highlights, headline accents and chips across the whole site change with one click.</p>
        {customOpen && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Any accent color</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={vars.accent} onChange={e => set({ secondary_color: e.target.value })} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-200" />
                <input value={theme.secondary_color} onChange={e => set({ secondary_color: e.target.value })} className="w-full rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
              </div>
            </div>
            <div>
              <label className={label}>Dark panels & buttons</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={theme.primary_color} onChange={e => set({ primary_color: e.target.value })} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-200" />
                <input value={theme.primary_color} onChange={e => set({ primary_color: e.target.value })} className="w-full rounded-xl border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* 3. Ivory / Midnight (light / dark) */}
      <div>
        <p className={label}>Ivory or Midnight</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {([['light', 'Ivory', Sun, 'Bright pages, dark text.'], ['dark', 'Midnight', Moon, 'Deep pages, light text - your accent glows.']] as const).map(([id, name, Icon, blurb]) => {
            const on = mode === id
            return (
              <button key={id} type="button" onClick={() => set({ mode: id })} className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/5' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${id === 'dark' ? 'bg-[#111827] text-[#e8c97a]' : 'bg-[#fff7df] text-[#b8860b]'}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="block text-xs font-black text-[#111827] dark:text-white">{name}{on ? ' · default' : ''}</span><span className="block text-[10px] font-semibold leading-snug text-gray-400">{blurb}</span></span>
              </button>
            )
          })}
        </div>
        <label className="mt-2 flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800">
          <span className="min-w-0 pr-3"><span className="block text-xs font-black text-[#111827] dark:text-white">Let visitors switch</span><span className="block text-[10px] font-semibold text-gray-400">A sun / moon button in your site&apos;s header. Their choice is remembered on their device.</span></span>
          <OhpSwitch on={theme.allow_mode_toggle !== false} onChange={v => set({ allow_mode_toggle: v })} testId="site-mode-toggle-switch" />
        </label>
      </div>

      {/* 4. Fonts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Heading font</label>
          <select value={theme.heading_font} onChange={e => set({ heading_font: e.target.value })} className={input}>
            <option value="serif">Elegant serif</option>
            <option value="sans">Modern sans</option>
            <option value="mono">Typewriter</option>
          </select>
        </div>
        <div>
          <label className={label}>Body font</label>
          <select value={theme.body_font} onChange={e => set({ body_font: e.target.value })} className={input}>
            <option value="sans">Modern sans</option>
            <option value="serif">Elegant serif</option>
            <option value="mono">Typewriter</option>
          </select>
        </div>
      </div>

      {/* 5. Logo */}
      <div>
        <p className={label}>Logo</p>
        <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-gray-200 p-2.5 dark:border-gray-800">
          <span className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#111827] p-1.5">
            {theme.logo_url ? <img src={resolveMediaUrl(theme.logo_url)} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] font-black uppercase tracking-wide text-white/40">Your name</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold leading-snug text-gray-400">{theme.logo_url ? 'Shown in the header and footer.' : 'No logo - your site name is shown instead. PNG with a clear background looks best.'}</p>
            <div className="mt-1.5 flex gap-1.5">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:text-white">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} {theme.logo_url ? 'Replace' : 'Upload'}
              </button>
              {theme.logo_url && (
                <button type="button" onClick={() => set({ logo_url: null })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:text-red-600"><Trash2 className="h-3 w-3" /> Remove</button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }} />
        </div>
      </div>

      {/* 5b. Loading mark */}
      <div>
        <p className={label}>Loading mark</p>
        <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-gray-200 p-2.5 dark:border-gray-800">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white p-1.5" style={{ borderColor: theme.secondary_color }}>
            {theme.loader_logo_url ? <img src={resolveMediaUrl(theme.loader_logo_url)} alt="Loading logo" className="max-h-full max-w-full object-contain" /> : <span className="font-serif text-sm font-black text-[#111827]">AB</span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold leading-snug text-gray-400">{theme.loader_logo_url ? 'Your logo spins in the loading animation across your site.' : 'While a page, home or search loads, visitors see your Brand Kit logo (or your initials) in an animated ring. Upload a logo here to use a different one.'}</p>
            <div className="mt-1.5 flex gap-1.5">
              <button type="button" onClick={() => loaderRef.current?.click()} disabled={loaderUploading} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:text-white">
                {loaderUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} {theme.loader_logo_url ? 'Replace' : 'Upload logo'}
              </button>
              {theme.loader_logo_url && (
                <button type="button" onClick={() => set({ loader_logo_url: null })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:text-red-600"><Trash2 className="h-3 w-3" /> Use my initials</button>
              )}
            </div>
          </div>
          <input ref={loaderRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadLoaderLogo(f); e.target.value = '' }} />
        </div>
      </div>

      {/* 6. Signature in the footer */}
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800">
        <span className="min-w-0 pr-3"><span className="block text-xs font-black text-[#111827] dark:text-white">My email signature in the footer</span><span className="block text-[10px] font-semibold text-gray-400">Your signature card is the agent block at the bottom of every page (Studio → Email Signature). Off = plain name &amp; contact details.</span></span>
        <OhpSwitch on={theme.footer_signature === true} onChange={v => set({ footer_signature: v })} testId="site-footer-signature-switch" />
      </label>

    </div>
  )
}
