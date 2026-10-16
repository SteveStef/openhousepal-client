'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, Home, Loader2, Save, Trash2, Upload, User as UserIcon, Users, Wand2 } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { BrandKit } from '@/types'
import StudioPageHeader from '@/components/studio/StudioPageHeader'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import { BRAND_ACCENT_COLORS, BRAND_MAIN_COLORS, type BrandSwatch } from '@/lib/brandSwatches'
import { isLight } from '@/components/setup/SetupUi'

const FONT_OPTIONS = [
  { value: 'serif', label: 'Editorial Serif', className: 'font-serif' },
  { value: 'sans', label: 'Modern Sans', className: 'font-sans' },
  { value: 'mono', label: 'Structured Mono', className: 'font-mono' },
]

const DEFAULT_KIT: BrandKit = {
  primary_color: '#111827',
  secondary_color: '#C9A24D',
  accent_color: '#816937',
  heading_font: 'serif',
  body_font: 'sans',
}

export default function BrandKitPage() {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <BrandKitPageInner />
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function BrandKitPageInner() {
  const [kit, setKit] = useState<BrandKit>(DEFAULT_KIT)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [logoError, setLogoError] = useState('')
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.studio.getBrandKit().then(response => {
      if (response.success && response.data) setKit(response.data)
      setLoading(false)
    })
  }, [])

  const scheduleSave = (next: BrandKit) => {
    setKit(next)
    // Half-typed colors ("#1F3") stay on screen but aren't saved until they're a real color.
    const hex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
    if (![next.primary_color, next.secondary_color, next.accent_color].every(c => hex.test(c || ''))) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      setSaveStatus('idle')
      return
    }
    setSaveStatus('saving')
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      const response = await api.studio.updateBrandKit({
        primary_color: next.primary_color,
        secondary_color: next.secondary_color,
        accent_color: next.accent_color,
        heading_font: next.heading_font,
        body_font: next.body_font,
        disclaimer_text: next.disclaimer_text,
      })
      setSaveStatus(response.success ? 'saved' : 'error')
      if (response.success) setTimeout(() => setSaveStatus('idle'), 1500)
    }, 500)
  }

  const handleLogoUpload = async (slot: 'personal' | 'team' | 'brokerage', file: File) => {
    setLogoError('')
    if (!/(jpe?g|png)$/i.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      setLogoError('Logos need to be a JPG or PNG file.')
      return
    }
    setUploadingSlot(slot)
    const response = await api.studio.uploadBrandLogo(slot, file)
    if (response.success && response.data) setKit(response.data)
    else setLogoError(response.error || "That logo couldn't be uploaded. Try a different JPG or PNG.")
    setUploadingSlot(null)
  }

  const handleLogoDelete = async (slot: 'personal' | 'team' | 'brokerage') => {
    setUploadingSlot(slot)
    const response = await api.studio.deleteBrandLogo(slot)
    if (response.success && response.data) setKit(response.data)
    setUploadingSlot(null)
  }

  if (loading) {
    return <OhpLoader />
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <StudioPageHeader
          icon={Wand2}
          kicker="Brand Kit"
          title={<>Your brand, <em>set once.</em></>}
          subtitle="Shared across Studio and Blogs, so you never re-enter your branding."
          actions={
            <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
              saveStatus === 'saved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300' :
              saveStatus === 'saving' ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' :
              saveStatus === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' : 'opacity-0'
            }`}>
              {saveStatus === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saveStatus === 'saved' && <Check className="h-3.5 w-3.5" />}
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Try again' : <Save className="h-3.5 w-3.5" />}
            </div>
          }
        />

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            {/* Logos */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Logos</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <LogoSlot label="Personal" icon={UserIcon} url={kit.personal_logo_url} uploading={uploadingSlot === 'personal'} onUpload={file => handleLogoUpload('personal', file)} onDelete={() => handleLogoDelete('personal')} />
                <LogoSlot label="Team" icon={Users} url={kit.team_logo_url} uploading={uploadingSlot === 'team'} onUpload={file => handleLogoUpload('team', file)} onDelete={() => handleLogoDelete('team')} />
                <LogoSlot label="Brokerage" icon={Building2} url={kit.brokerage_logo_url} uploading={uploadingSlot === 'brokerage'} onUpload={file => handleLogoUpload('brokerage', file)} onDelete={() => handleLogoDelete('brokerage')} />
              </div>
              {logoError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">{logoError}</p>}
            </section>

            {/* Colors */}
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Colors</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <ColorField label="Primary" value={kit.primary_color} onChange={v => scheduleSave({ ...kit, primary_color: v })} swatches={BRAND_MAIN_COLORS} />
                <ColorField label="Secondary" value={kit.secondary_color} onChange={v => scheduleSave({ ...kit, secondary_color: v })} swatches={BRAND_ACCENT_COLORS} />
                <ColorField label="Accent" value={kit.accent_color} onChange={v => scheduleSave({ ...kit, accent_color: v })} />
              </div>
            </section>

            {/* Fonts */}
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Fonts</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-400">Heading font</p>
                  <div className="space-y-2">
                    {FONT_OPTIONS.map(font => (
                      <button
                        key={font.value}
                        onClick={() => scheduleSave({ ...kit, heading_font: font.value })}
                        className={`w-full rounded-xl border-2 p-3 text-left transition ${font.className} ${
                          kit.heading_font === font.value ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-lg font-black text-[#111827] dark:text-white">{font.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-400">Body font</p>
                  <div className="space-y-2">
                    {FONT_OPTIONS.map(font => (
                      <button
                        key={font.value}
                        onClick={() => scheduleSave({ ...kit, body_font: font.value })}
                        className={`w-full rounded-xl border-2 p-3 text-left transition ${font.className} ${
                          kit.body_font === font.value ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <span className="text-sm font-semibold text-[#111827] dark:text-white">{font.label} — sample text</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Disclaimer */}
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Default Disclaimer</h2>
              <p className="mt-1 text-xs font-semibold text-gray-400">Shown on print materials where required. Leave blank to omit.</p>
              <textarea
                rows={3}
                value={kit.disclaimer_text || ''}
                onChange={event => scheduleSave({ ...kit, disclaimer_text: event.target.value })}
                placeholder="Equal Housing Opportunity. Information deemed reliable but not guaranteed."
                className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-white"
              />
            </section>
          </div>

          {/* Live preview */}
          <div className="lg:sticky lg:top-6">
            <p className="mb-2 px-1 text-xs font-black uppercase tracking-widest text-gray-400">Live Preview</p>
            <BrandKitPreview kit={kit} />
            <p className="mt-2 px-1 text-[11px] font-semibold leading-relaxed text-gray-400">A sample listing card showing exactly how your logo, colors, and fonts will look across Studio and Blogs.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrandKitPreview({ kit }: { kit: BrandKit }) {
  const headingClass = kit.heading_font === 'mono' ? 'font-mono' : kit.heading_font === 'sans' ? 'font-sans' : 'font-serif'
  const bodyClass = kit.body_font === 'mono' ? 'font-mono' : kit.body_font === 'serif' ? 'font-serif' : 'font-sans'
  const logoUrl = kit.personal_logo_url || kit.team_logo_url || kit.brokerage_logo_url
  // white / silver main colors get dark type (the designs do the same)
  const lightBg = isLight(kit.primary_color || '#111827')
  const pillInk = isLight(kit.secondary_color || '#C9A24D') ? '#111827' : '#ffffff'

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      {/* Mock card, styled like a Just Listed design */}
      <div className="relative flex aspect-[4/5] flex-col overflow-hidden" style={{ backgroundColor: kit.primary_color, color: lightBg ? '#111827' : '#ffffff' }}>
        <div className="flex h-2/5 items-center justify-center bg-black/20">
          <Home className="h-10 w-10 opacity-40" />
        </div>
        <div className="flex items-start justify-between px-4 pt-3">
          <span className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest shadow" style={{ backgroundColor: kit.secondary_color, color: pillInk }}>
            Just Listed
          </span>
          {logoUrl && (
            <img src={resolveMediaUrl(logoUrl)} alt="Logo" className="h-7 max-w-[72px] rounded bg-white/90 object-contain p-1" />
          )}
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1.5 px-4 pb-4">
          <p className={`${headingClass} text-lg font-black leading-tight`}>123 Maple Street</p>
          <p className={`${bodyClass} text-xs font-bold opacity-80`}>Springfield, IL</p>
          <p className="text-xl font-black" style={{ color: kit.secondary_color }}>$650,000</p>
          <p className={`${bodyClass} mt-1 line-clamp-2 text-[11px] font-medium leading-snug opacity-75`}>
            A sample description will appear in this style — showing your chosen body font and spacing.
          </p>
          <div className={`mt-2 flex items-center gap-2 border-t pt-2 ${lightBg ? 'border-black/15' : 'border-white/20'}`}>
            <div className="h-6 w-6 rounded-full border-2 bg-white/20" style={{ borderColor: kit.secondary_color }} />
            <div className="leading-tight">
              <p className="text-[10px] font-black">Your Name</p>
              <p className="text-[9px] font-bold opacity-60">Brokerage</p>
            </div>
          </div>
        </div>
      </div>
      {kit.disclaimer_text && (
        <p className="border-t border-gray-100 px-4 py-2.5 text-[9px] font-semibold leading-relaxed text-gray-400 dark:border-gray-800">
          {kit.disclaimer_text}
        </p>
      )}
    </div>
  )
}

// A color: the same quick picks Setup offers (lib/brandSwatches), plus the picker for any other color.
function ColorField({ label, value, onChange, swatches }: { label: string; value: string; onChange: (value: string) => void; swatches?: BrandSwatch[] }) {
  return (
    <div>
      <label className="block">
        <span className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</span>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] p-2 dark:border-gray-700 dark:bg-[#1A1A1C]">
          <input type="color" value={value} onChange={event => onChange(event.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent" />
          <input value={value} onChange={event => onChange(event.target.value)} className="w-full bg-transparent text-sm font-bold uppercase text-[#111827] outline-none dark:text-white" />
        </div>
      </label>
      {swatches && (
        <div role="radiogroup" aria-label={`${label} quick picks`} className="mt-2.5 flex flex-wrap gap-1.5">
          {swatches.map(s => {
            const on = s.color.toLowerCase() === (value || '').toLowerCase()
            return (
              <button key={s.color} type="button" role="radio" aria-checked={on} title={s.label} onClick={() => onChange(s.color)}
                className={`h-6 w-6 rounded-full ring-1 ring-black/15 transition hover:scale-110 dark:ring-white/20 ${on ? 'scale-110 outline outline-2 outline-offset-2 outline-[#C9A24D]' : ''}`}
                style={{ background: s.color }} />
            )
          })}
        </div>
      )}
    </div>
  )
}

function LogoSlot({ label, icon: Icon, url, uploading, onUpload, onDelete }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  url?: string | null
  uploading: boolean
  onUpload: (file: File) => void
  onDelete: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 text-center dark:border-gray-700 dark:bg-[#1A1A1C]">
      <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-[#111113]">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : url ? (
          <img src={resolveMediaUrl(url)} alt={label} className="h-full w-full object-contain p-1" />
        ) : (
          <Icon className="h-6 w-6 text-gray-300" />
        )}
      </div>
      <p className="mt-2 text-xs font-black text-[#111827] dark:text-white">{label}</p>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-black uppercase text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
          <Upload className="h-3 w-3" /> {url ? 'Replace' : 'Upload'}
        </button>
        {url && (
          <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-black uppercase text-gray-500 hover:border-red-300 hover:text-red-600 dark:border-gray-700">
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
