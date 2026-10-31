'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Check, Home, Loader2, Trash2, Upload, User as UserIcon, Users, Wand2 } from 'lucide-react'
import { SaveStatusBar, SaveStatusContext, useSaveState, useSaveStatus } from '@/components/ui/SaveStatus'
import SelectedMark, { SELECTED_RING } from '@/components/ui/SelectedMark'
import type { BrandUsage } from '@/types'
import { BRANDING_CSS, BrandColorDock, BrandColorStage, FeatureShowcase } from '@/components/studio/branding/BrandingCenter'
import { designAgentFrom, SAMPLE_DESIGN_AGENT } from '@/lib/studio/designAgent'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { BrandKit } from '@/types'
import LuxeHero from '@/components/ui/LuxeHero'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import QrBrandPicker from '@/components/settings/QrBrandPicker'
import { isLight } from '@/components/setup/SetupUi'
import { useAuth } from '@/contexts/AuthContext'
import { hasAgentHubAccess, hasMlsAccess } from '@/lib/navAccess'
import { brandLookOf, luxeAllowedFor, modeLabel, brandColorName, useBrandKit, type BrandKitPatch } from '@/lib/brandKit'
import { LUXE_METALS } from '@/lib/luxeMetals'

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

// The header line lists only what this plan has (No-MLS plans have no website / Spotlight;
// plain No-MLS has no Agent Hub, signature or Studio designs either).
function brandWearers(planTier?: string | null): string {
  if (!planTier || hasMlsAccess(planTier)) return 'Pick your color once - your Agent Hub, website, forms, signature, invites, Spotlight and designs all wear it.'
  if (hasAgentHubAccess(planTier)) return 'Pick your color once - your Agent Hub, forms, signature, invites and designs all wear it.'
  return 'Pick your color once - your open house sign-in, forms and invites all wear it.'
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
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [logoError, setLogoError] = useState('')
  const { user } = useAuth()
  const luxeAllowed = luxeAllowedFor(user)
  // The shared copy (lib/brandKit) - a save here updates every open "My Brand Kit" preview too.
  const shared = useBrandKit()
  // One save status for the page (components/ui/SaveStatus): Saving… -> All changes saved, or
  // Couldn't save + Try again. Every save below goes through it.
  const save = useSaveStatus()
  const saveState = useSaveState(save)

  useEffect(() => {
    api.studio.getBrandKit().then(response => {
      if (response.success && response.data) setKit(response.data)
      setLoading(false)
    })
    api.agentHub.getMine().then(r => { if (r.success && r.data) setHub(r.data) })
  }, [])

  // Branding center: which features wear the brand (refreshed after every save), and the people
  // drawn in the previews.
  const [usage, setUsage] = useState<BrandUsage | null>(null)
  const [hub, setHub] = useState<{ slug?: string | null; config?: Record<string, any> | null } | null>(null)
  const loadUsage = () => api.studio.brandUsage().then(r => { if (r.success && r.data) setUsage(r.data) })
  useEffect(() => { void loadUsage() }, [])
  useEffect(() => { if (saveState === 'saved') void loadUsage() }, [saveState])
  const applyAll = async () => {
    const r = await save.track(async () => {
      const res = await api.studio.applyBrandEverywhere()
      if (res.success && res.data) setUsage(res.data)
      return res
    }, { key: 'apply-everywhere' })
    return r.success && r.data ? r.data : null
  }
  const agent = designAgentFrom(user, hub)
  const designAgent = agent.agentName ? agent : SAMPLE_DESIGN_AGENT
  const person = {
    name: agent.agentName || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Your Name',
    title: agent.agentTitle || 'Realtor',
    brokerage: agent.agentBrokerage || 'Your Brokerage',
    photo: agent.agentPhotoUrl || user?.photo_url || null,
    phone: agent.agentPhone || '(610) 555-0134',
    email: user?.email || '',
  }
  // phones: the palette rides along the bottom once the picker has scrolled away and the features are in view
  const pickerRef = useRef<HTMLElement>(null)
  const showcaseRef = useRef<HTMLDivElement>(null)
  const [pickerVisible, setPickerVisible] = useState(true)
  const [showcaseVisible, setShowcaseVisible] = useState(false)
  useEffect(() => {
    if (loading) return
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.target === pickerRef.current) setPickerVisible(e.isIntersecting)
      if (e.target === showcaseRef.current) setShowcaseVisible(e.isIntersecting)
    }), { threshold: 0.05 })
    if (pickerRef.current) io.observe(pickerRef.current)
    if (showcaseRef.current) io.observe(showcaseRef.current)
    return () => io.disconnect()
  }, [loading])
  const dockOn = !pickerVisible && showcaseVisible

  // Every Brand Kit change (look, color, fonts, disclaimer) is merged into one waiting patch and
  // sent through one save, so quick taps never overwrite each other, and a failed save is kept and
  // re-sent (Try again, or along with the next change). The screen changes at once; the status
  // bar follows: Saving… -> All changes saved.
  const waiting = useRef<BrandKitPatch>({})
  const mergePatch = (a: BrandKitPatch, b: BrandKitPatch): BrandKitPatch => ({ ...a, ...b, ...(a.look || b.look ? { look: { ...a.look, ...b.look } } : {}) })
  const sendKit = async () => {
    const patch = waiting.current
    if (!Object.keys(patch).length) return { success: true }
    waiting.current = {}
    const response = await shared.save(patch)
    if (response.success && response.data) {
      const savedLook = response.data.look
      setKit(k => ({ ...k, look: savedLook }))
    } else {
      waiting.current = mergePatch(patch, waiting.current) // newer changes win
    }
    return response
  }
  const queue = (patch: BrandKitPatch, delay: number) => {
    waiting.current = mergePatch(waiting.current, patch)
    if (delay <= 0) void save.track(sendKit, { key: 'kit', retry: sendKit })
    else save.schedule('kit', sendKit, delay, { retry: sendKit })
  }

  // The look (Classic / Luxe, finish, Ivory / Midnight) saves at once - every feature on
  // "My Brand Kit" changes with it. A color tap from the look picker goes through scheduleSave.
  const changeLook = (patch: BrandKitPatch) => {
    if (patch.secondary_color) { scheduleSave({ ...kit, secondary_color: patch.secondary_color }, 250); return }
    if (!patch.look) return
    const cur = brandLookOf(kit)
    setKit({ ...kit, look: { ...cur, ...(kit.look || {}), ...patch.look, saved: true } })
    queue({ look: patch.look }, 0)
  }

  const hexOk = (c?: string | null) => /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c || '')
  const scheduleSave = (next: BrandKit, delay = 600) => {
    setKit(next)
    // Half-typed colors ("#1F3") stay on screen as "Unsaved changes…" until they're a real color.
    if (![next.primary_color, next.secondary_color, next.accent_color].every(hexOk)) { save.markDirty('kit-color'); return }
    save.clearDirty('kit-color')
    queue({
      primary_color: next.primary_color,
      secondary_color: next.secondary_color,
      accent_color: next.accent_color,
      heading_font: next.heading_font,
      body_font: next.body_font,
      disclaimer_text: next.disclaimer_text,
    }, delay)
  }

  const handleLogoUpload = async (slot: 'personal' | 'team' | 'brokerage', file: File) => {
    setLogoError('')
    if (!/(jpe?g|png)$/i.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) {
      setLogoError('Logos need to be a JPG or PNG file.')
      return
    }
    setUploadingSlot(slot)
    await save.track(async () => {
      const response = await api.studio.uploadBrandLogo(slot, file)
      if (response.success && response.data) { setKit(response.data); shared.setLocal(response.data); setLogoError('') }
      else setLogoError(response.error || "That logo couldn't be uploaded. Try a different JPG or PNG.")
      return response
    }, { key: `logo-${slot}` })
    setUploadingSlot(null)
  }

  const handleLogoDelete = async (slot: 'personal' | 'team' | 'brokerage') => {
    setUploadingSlot(slot)
    await save.track(async () => {
      const response = await api.studio.deleteBrandLogo(slot)
      if (response.success && response.data) { setKit(response.data); shared.setLocal(response.data) }
      return response
    }, { key: `logo-${slot}` })
    setUploadingSlot(null)
  }

  if (loading) {
    return <OhpLoader />
  }

  const look = brandLookOf(kit)
  const shownLook = { ...look, theme: look.theme === 'luxe' && luxeAllowed ? 'luxe' as const : 'classic' as const }
  const lookName = `${shownLook.theme === 'luxe' ? 'Luxe' : 'Classic'} · ${shownLook.theme === 'luxe' ? LUXE_METALS[look.metal].label : brandColorName(kit.secondary_color) || 'Custom color'} · ${modeLabel(look.dark)}`
  return (
    <SaveStatusContext.Provider value={save}>
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-4 pb-4 sm:pb-6">
        {/* Always in view (sticky): what's picked + whether it saved (owner 10/26). */}
        <SaveStatusBar store={save} label={`Branding · ${lookName}`} shortLabel="Branding" hint="Tap to choose - everything saves on its own, no Save button needed." />
        <LuxeHero
          compact
          backHref="/studio"
          backLabel="Tools"
          kicker="Branding"
          icon={Wand2}
          title={<>Your brand, <em>everywhere</em></>}
          subtitle={<>{brandWearers(user?.plan_tier)} <span className="sr-only">{lookName}</span></>}
        />
        <style>{BRANDING_CSS}</style>

        {/* 1. the color + where it shows (owner 10/24: Brand Kit -> a Branding center) */}
        <motion.div className="mt-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <BrandColorStage kit={kit} look={shownLook} luxeAllowed={luxeAllowed} onChange={changeLook} usage={usage} idxPlan={luxeAllowed}
            pickerRef={pickerRef} applyAll={applyAll} onApplied={u => setUsage(u)} />
        </motion.div>

        {/* 2. every feature in the color */}
        <div ref={showcaseRef}>
          <FeatureShowcase kit={kit} look={shownLook} usage={usage} idxPlan={luxeAllowed} person={person} agent={designAgent} />
        </div>

        {/* 3. logos, QR codes, fonts, disclaimer */}
        <div className="mt-10 flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#C9A24D]/40 to-[#C9A24D]/40" />
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">Logos, fonts &amp; print</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#C9A24D]/40 to-[#C9A24D]/40" />
        </div>
        <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="min-w-0">
            {/* Logos */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-[#151517]">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Logos</h2>
              <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">JPG or PNG. Used on your designs, Spotlight and signature.</p>
              {/* Three small tiles in one row on every screen (they were three tall stacked boxes on phones). */}
              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
                <LogoSlot label="Personal" icon={UserIcon} url={kit.personal_logo_url} uploading={uploadingSlot === 'personal'} onUpload={file => handleLogoUpload('personal', file)} onDelete={() => handleLogoDelete('personal')} />
                <LogoSlot label="Team" icon={Users} url={kit.team_logo_url} uploading={uploadingSlot === 'team'} onUpload={file => handleLogoUpload('team', file)} onDelete={() => handleLogoDelete('team')} />
                <LogoSlot label="Brokerage" icon={Building2} url={kit.brokerage_logo_url} uploading={uploadingSlot === 'brokerage'} onUpload={file => handleLogoUpload('brokerage', file)} onDelete={() => handleLogoDelete('brokerage')} />
              </div>
              {logoError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">{logoError}</p>}
            </section>

            {/* The middle of every QR code (owner 10/31: moved here from Settings; the "Print background"
                color that sat here is gone - the stored primary_color is untouched). Keyed on the
                personal logo so uploading one above shows it as a choice at once. */}
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-gray-800 dark:bg-[#151517]" data-testid="brand-qr">
              <QrBrandPicker logosAbove key={kit.personal_logo_url || 'none'} />
            </section>

          </div>
          <div className="min-w-0">
            {/* Fonts */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Fonts</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-400">Heading font</p>
                  <div role="radiogroup" aria-label="Heading font" className="space-y-2.5">
                    {FONT_OPTIONS.map(font => {
                      const on = kit.heading_font === font.value
                      return (
                        <button
                          key={font.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-testid={`brand-heading-font-${font.value}`}
                          onClick={() => scheduleSave({ ...kit, heading_font: font.value }, 0)}
                          className={`relative flex w-full items-center gap-2 rounded-xl border-2 p-3 text-left transition active:scale-[0.98] ${font.className} ${
                            on ? `${SELECTED_RING} bg-[#C9A24D]/10` : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-700'
                          }`}
                        >
                          {on && <SelectedMark key={`h-${font.value}`} />}
                          <span className="min-w-0 flex-1 text-lg font-black text-[#111827] dark:text-white">{font.label}</span>
                          {on && <span className="shrink-0 rounded-full bg-[#C9A24D] px-2 py-0.5 font-sans text-[9px] font-black uppercase tracking-wider text-white">Selected</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-gray-400">Body font</p>
                  <div role="radiogroup" aria-label="Body font" className="space-y-2.5">
                    {FONT_OPTIONS.map(font => {
                      const on = kit.body_font === font.value
                      return (
                        <button
                          key={font.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-testid={`brand-body-font-${font.value}`}
                          onClick={() => scheduleSave({ ...kit, body_font: font.value }, 0)}
                          className={`relative flex w-full items-center gap-2 rounded-xl border-2 p-3 text-left transition active:scale-[0.98] ${font.className} ${
                            on ? `${SELECTED_RING} bg-[#C9A24D]/10` : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-700'
                          }`}
                        >
                          {on && <SelectedMark key={`b-${font.value}`} />}
                          <span className="min-w-0 flex-1 text-sm font-semibold text-[#111827] dark:text-white">{font.label} — sample text</span>
                          {on && <span className="shrink-0 rounded-full bg-[#C9A24D] px-2 py-0.5 font-sans text-[9px] font-black uppercase tracking-wider text-white">Selected</span>}
                        </button>
                      )
                    })}
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

        </div>
      </div>
      <BrandColorDock look={shownLook} luxeAllowed={luxeAllowed} onChange={changeLook} show={dockOn} />
      {dockOn && <div aria-hidden className="h-20 lg:hidden" />}
    </div>
    </SaveStatusContext.Provider>
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
    <div data-testid={`brand-logo-${label.toLowerCase()}`} data-has-logo={url ? '1' : '0'}
      className={`relative min-w-0 rounded-xl border-2 bg-[#fbfaf7] p-2.5 text-center transition dark:bg-[#1A1A1C] sm:p-4 ${url ? `${SELECTED_RING}` : 'border-gray-200 dark:border-gray-700'}`}>
      {url && !uploading && <SelectedMark key={url} size="sm" />}
      <button type="button" onClick={() => inputRef.current?.click()} aria-label={`${url ? 'Replace' : 'Upload'} ${label} logo`}
        className={`mx-auto flex aspect-square w-full max-w-[80px] items-center justify-center overflow-hidden rounded-xl border bg-white transition hover:border-[#C9A24D] dark:bg-[#111113] ${url ? 'border-[#C9A24D]/40' : 'border-dashed border-gray-300 dark:border-gray-700'}`}>
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : url ? (
          <img src={resolveMediaUrl(url)} alt={label} className="h-full w-full object-contain p-1" />
        ) : (
          <Icon className="h-6 w-6 text-gray-300" />
        )}
      </button>
      <p className="mt-2 truncate text-xs font-black text-[#111827] dark:text-white">{label}</p>
      <p className={`truncate text-[10px] font-black uppercase tracking-wider ${uploading ? 'text-[#8b6a2b]' : url ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{uploading ? 'Saving…' : url ? 'Added' : 'None yet'}</p>
      <div className="mt-1.5 flex items-center justify-center gap-1">
        <button onClick={() => inputRef.current?.click()} className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-black uppercase text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
          <Upload className="h-3 w-3" /> <span className="max-sm:sr-only">{url ? 'Replace' : 'Upload'}</span>
        </button>
        {url && (
          <button onClick={onDelete} aria-label={`Remove ${label} logo`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-black uppercase text-gray-500 hover:border-red-300 hover:text-red-600 dark:border-gray-700">
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
