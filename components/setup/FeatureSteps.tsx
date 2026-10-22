'use client'

// The plan-feature steps: sales, reviews, brand, Agent Hub, forms, email signature. Each reads and
// writes the feature's own saved settings (the same ones its full editor uses), so whatever the
// agent sets here is exactly what they find later in that feature, and the other way round.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, ExternalLink, Facebook, Globe, ImageIcon, Instagram, Layers, Loader2, Moon, MoveRight, Music2, Sparkles, Sun, Trash2, UserRound, Youtube } from 'lucide-react'
import api, { type SetupFormDefaults } from '@/lib/api-service'
import type { AgentFormConfig, BrandKit } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { buildDesignPreviewHtml } from '@/lib/signaturePreview'
import { buildSignatureSiteInput } from '@/lib/signatureSiteData'
import {
  DEFAULT_ACCENT, FONT_OPTIONS, FORM_BUTTON_DEFAULTS, FORM_BUTTON_ORDER, MAX_CTA_BUTTONS,
  mergeSignatureConfig, seedSignatureButtons, seedSignatureSocials, staleSignatureFields, withoutFields, type SignatureConfig,
} from '@/lib/signatureConfig'
import { socialUrlsFrom } from '@/lib/signatureSiteData'
import SignatureDualPreview from '@/components/studio/signature/SignatureDualPreview'
import { HUB_CLASSIC_ACCENTS, hubAccentOf } from '@/components/agent-hub/HubClassicTheme'
import { HUB_MOBILE_HEADERS } from '@/components/agent-hub/HubLuxeTheme'
import { LUXE_METALS, LUXE_METAL_ORDER, metalOf, type LuxeMetal } from '@/lib/luxeMetals'
import { ACCENT_COLORS } from '@/lib/accentSwatches'
import { BRAND_MAIN_COLORS, brandFormLook, brandSignaturePatch, modeLabel, useBrandKit, type BrandLook } from '@/lib/brandKit'
import { BigToggle, ChoiceCard, Field, isLight, MiniFlow, StepCtx, SubHead, Swatches, toJpeg, useGate, useMiniFlow } from './SetupUi'
import ZillowLinkHelp, { ZILLOW_REVIEW_PLACEHOLDER } from '@/components/reviews/ZillowLinkHelp'
import QrBrandPicker from '@/components/settings/QrBrandPicker'
import FormLookPicker, { FormPhonePreview } from '@/components/forms/FormLookPicker'
import { formLookOf, resolveFormLook, type FormLookFields } from '@/lib/formLook'
import BrandStepLook from './BrandStepLook'
import SignatureFormButtons from './SignatureFormButtons'
import { HubContentPicker, HubFormButtons, HubLinkNote, OpenHubButton } from './HubExtras'
import { Note, QuestionCard } from './FeatureUi'

export { SalesStep } from './SalesStep'

const METAL_SWATCHES = LUXE_METAL_ORDER.map(m => ({ color: LUXE_METALS[m].base, label: m[0].toUpperCase() + m.slice(1) }))

/** A tiny tile painted in a look - the "My Brand Kit" / "Choose my own" cards. */
function LookTile({ luxe, metal, accent, dark, className = 'h-20' }: { luxe: boolean; metal: LuxeMetal; accent: string; dark: boolean; className?: string }) {
  const m = LUXE_METALS[metal]
  const bg = luxe
    ? dark ? `radial-gradient(120% 80% at 85% -10%, rgba(${m.rgb},.32), transparent 60%), linear-gradient(135deg,#0c0c0e,#1b1a17)` : `radial-gradient(120% 80% at 85% -10%, rgba(${m.rgb},.28), transparent 60%), linear-gradient(135deg,#fffdf8,#f4ead7)`
    : dark ? '#0B0B0B' : '#f7f5f1'
  const fill = luxe ? `linear-gradient(135deg, ${m.deep}, ${m.base} 45%, ${m.light} 70%, ${m.deep})` : accent
  return (
    <div className={`flex items-center justify-center gap-2.5 rounded-2xl ring-1 ring-black/5 ${className}`} style={{ background: bg }}>
      <span className="h-9 w-9 rounded-full" style={{ background: luxe ? `conic-gradient(${m.deep}, ${m.light}, ${m.base}, ${m.deep})` : '#d1d5db' }} />
      <span className="space-y-1.5">
        <span className={`block h-2 w-16 rounded ${dark ? 'bg-white' : 'bg-[#111827]'}`} />
        <span className="block h-3 w-20 rounded-full" style={{ background: fill }} />
      </span>
    </div>
  )
}
const lookName = (luxe: boolean, metal: LuxeMetal, accentLabel: string | null, dark: boolean) =>
  `${luxe ? `Luxe, ${LUXE_METALS[metal].label.toLowerCase()}` : `Classic${accentLabel ? `, ${accentLabel.toLowerCase()}` : ''}`}, ${modeLabel(dark)}`
const colorLabel = (hex: string) => [...HUB_CLASSIC_ACCENTS, ...ACCENT_COLORS].find(c => c.color.toLowerCase() === hex.toLowerCase())?.label || null

// ---------- Reviews ----------
export function ReviewsStep({ ctx }: { ctx: StepCtx }) {
  const r = ctx.data.reviews || {}
  const [google, setGoogle] = useState<string>(r.google_review_url || '')
  const [zillow, setZillow] = useState<string>(r.zillow_review_url || '')
  const [show, setShow] = useState<boolean>(r.showOnHub !== false)
  const timer = useRef<number | undefined>(undefined)
  // Every save sends all three - one shared timer, so a save that only carried the field just typed
  // dropped the other one (type Google, then Zillow straight after: the Google link was never saved).
  const latest = useRef({ google_review_url: google, zillow_review_url: zillow, show_on_hub: show })
  const save = (data: { google_review_url?: string; zillow_review_url?: string; show_on_hub?: boolean }, now = false) => {
    latest.current = { ...latest.current, ...data }
    window.clearTimeout(timer.current)
    const run = () => ctx.markSaving(api.agentHub.updateReviewSettings(latest.current))
    if (now) run(); else timer.current = window.setTimeout(run, 600)
  }
  // leaving the step before the timer fires still saves what was typed
  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); api.agentHub.updateReviewSettings(latest.current) } }, [])
  useGate(ctx, { ok: true, onContinue: async () => { window.clearTimeout(timer.current); await api.agentHub.updateReviewSettings({ google_review_url: google, zillow_review_url: zillow, show_on_hub: show }) } }, [google, zillow, show])
  // first visit: reviews on the hub default to on
  useEffect(() => { if (r.showOnHub === undefined) save({ show_on_hub: true }, true) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-6">
      <Field label="Your Google review link" value={google} onChange={v => { setGoogle(v); save({ google_review_url: v }) }} placeholder="https://g.page/r/..." inputMode="url"
        hint='In your Google Business Profile, tap "Ask for reviews" and copy the link it gives you.' />
      <Field label="Your Zillow review link" value={zillow} onChange={v => { setZillow(v); save({ zillow_review_url: v }) }} placeholder={ZILLOW_REVIEW_PLACEHOLDER} inputMode="url"
        hint="The link behind the Write a review button on your Zillow profile. Happy clients land right on your Zillow review form.">
        <ZillowLinkHelp value={zillow} />
      </Field>
      <BigToggle on={show} onChange={v => { setShow(v); save({ show_on_hub: v }, true) }} title="Show my reviews on my Agent Hub" blurb="Only 4 and 5-star reviews are ever shown." />
    </div>
  )
}

// ---------- Brand ----------
// Logos, then the Brand Kit's look (the very same picker as Studio -> Brand Kit: Classic / Luxe, the
// full color palette or Luxe's finish, Ivory / Midnight) - whatever's picked here IS the Brand Kit,
// which the Agent Hub, website, forms and signature wear on "My Brand Kit".
export function BrandStep({ ctx }: { ctx: StepCtx }) {
  const { kit, setLocal, save } = useBrandKit()
  const [busy, setBusy] = useState<string | null>(null)
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'brand' }) } }, [])
  const flow = useMiniFlow(ctx, ['Logos', 'Look', 'Color', 'QR'])
  if (!kit) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const upload = async (slot: 'personal' | 'team' | 'brokerage', file?: File) => {
    if (!file) return
    setBusy(slot)
    const f = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/svg+xml' || file.type === 'image/webp' ? file : await toJpeg(file)
    const r = await api.studio.uploadBrandLogo(slot, f)
    if (r.success && r.data) setLocal(r.data)
    setBusy(null)
  }
  const remove = async (slot: 'personal' | 'team' | 'brokerage') => {
    setBusy(slot)
    const r = await api.studio.deleteBrandLogo(slot)
    if (r.success && r.data) setLocal(r.data)
    setBusy(null)
  }
  const setMain = (c: string) => {
    setLocal({ ...kit, primary_color: c } as BrandKit)
    ctx.markSaving(save({ primary_color: c }))
  }
  const slots: { slot: 'personal' | 'team' | 'brokerage'; label: string; url?: string | null }[] = [
    { slot: 'brokerage', label: 'Brokerage logo', url: kit.brokerage_logo_url },
    { slot: 'personal', label: 'Your own logo', url: kit.personal_logo_url },
    { slot: 'team', label: 'Team logo', url: kit.team_logo_url },
  ]
  return (
    <MiniFlow flow={flow} pages={[
      <div key="logos">
        <SubHead sub="Add any you have - PNG with a clear background looks best.">Logos</SubHead>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {slots.map(s => (
            <div key={s.slot} className="rounded-[18px] border-2 border-[#ece5d6] bg-white p-2 dark:border-white/10 dark:bg-[#141416] sm:rounded-[22px] sm:p-3">
              <label className="flex h-20 cursor-pointer items-center justify-center overflow-hidden rounded-2xl sm:h-28 bg-[repeating-conic-gradient(#f4efe5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#1c1c1f_0%_25%,#141416_0%_50%)]">
                {busy === s.slot ? <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /> : s.url ? <img src={s.url} alt={s.label} className="max-h-[85%] max-w-[85%] object-contain" /> : <span className="flex flex-col items-center gap-1 text-[#8b6a2b] dark:text-[#e8c97a]"><ImageIcon className="h-6 w-6 sm:h-7 sm:w-7" /><span className="text-[12px] font-black">Add</span></span>}
                <input type="file" accept="image/*" className="sr-only" onChange={e => { upload(s.slot, e.target.files?.[0]); e.target.value = '' }} />
              </label>
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <span className="text-[12px] font-black leading-tight text-[#111827] dark:text-white sm:text-[14px]">{s.label}</span>
                {s.url && <button type="button" onClick={() => remove(s.slot)} aria-label={`Remove ${s.label}`} className="rounded-lg p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>,
      <div key="look">
        <SubHead sub="Your Agent Hub, website, forms and email signature all wear this look - each one can still choose its own later.">Your look</SubHead>
        <BrandStepLook />
      </div>,
      <div key="color">
        <SubHead sub="The color for headers and backgrounds on your reports, net sheets and designs.">Main color</SubHead>
        <Swatches label="Main color" colors={BRAND_MAIN_COLORS} value={kit.primary_color || '#111827'} onChange={setMain} />
        <div className="mt-4 overflow-hidden rounded-[22px] border-2 border-[#ece5d6] dark:border-white/10">
          <div className="flex flex-wrap items-center gap-4 px-5 py-5" style={{ background: kit.primary_color }}>
            {(kit.brokerage_logo_url || kit.personal_logo_url) && <img src={kit.personal_logo_url || kit.brokerage_logo_url || ''} alt="" className="h-10 max-w-[120px] object-contain" />}
            <div className="min-w-0">
              <p className="font-serif text-[20px] font-black" style={{ color: isLight(kit.primary_color) ? '#111827' : '#ffffff' }}>{ctx.data.info.name || 'Your name'}</p>
              <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: kit.secondary_color }}>{ctx.data.info.brokerage || 'Your brokerage'}</p>
            </div>
            <span className="ml-auto rounded-full px-4 py-2 text-[13px] font-black" style={{ background: kit.secondary_color, color: isLight(kit.secondary_color) ? '#111827' : '#ffffff' }}>Contact me</span>
          </div>
          <p className="bg-white px-5 py-2.5 text-[12px] font-bold text-gray-500 dark:bg-[#141416]">A quick look at your colors together</p>
        </div>
      </div>,
      <div key="qr">
        <SubHead sub="What sits in the middle of every QR code you print or share. Codes you already printed keep working.">Your QR codes</SubHead>
        <QrBrandPicker compact key={kit.personal_logo_url || 'none'} />
      </div>,
    ]} />
  )
}

// ---------- Agent Hub ----------
// The real public page in a phone frame. Each look change is handed straight to the page inside
// (it listens in ?preview=1 mode - see app/[slug]/page.tsx), so the phone changes the instant a
// choice is tapped; the save happens alongside. Content changes (sections, buttons) reload it.
type HubLook = { hubTheme: string; hubAccent: string; hubLuxeMetal: string; visitorDarkMode: boolean; mobileHeader: string }
function HubPhonePreview({ src, look, label, width = 260 }: { src: string; look: HubLook; label: string; width?: number }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const lookRef = useRef(look)
  lookRef.current = look
  const [ready, setReady] = useState(false)
  const [pulse, setPulse] = useState(0)
  const send = () => frame.current?.contentWindow?.postMessage({ type: 'ohp-hub-look', look: lookRef.current }, window.location.origin)
  const key = JSON.stringify(look)
  const first = useRef(true)
  useEffect(() => {
    send()
    if (first.current) { first.current = false; return }
    setPulse(n => n + 1)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // the page says hello once it's listening; its own saved look loads a moment later, so say it again
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'ohp-hub-preview-ready') return
      send(); window.setTimeout(send, 1200); window.setTimeout(send, 3500)
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const inner = width - 20
  const scale = inner / 480
  const h = Math.round(inner * 1.93)
  // A status bar like a real phone's, so the notch sits over the clock row - not over the agent's photo.
  const bar = Math.round(inner * 0.11)
  const ink = look.visitorDarkMode ? '#ffffff' : '#111827'
  return (
    <div className="mx-auto shrink-0" style={{ width }}>
      <div className="relative rounded-[40px] border-[10px] border-[#111827] bg-[#111827] shadow-[0_40px_70px_-40px_rgba(17,24,39,.9)]">
        <div className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="relative overflow-hidden rounded-[30px] transition-colors duration-300" style={{ height: h, background: look.visitorDarkMode ? '#0B0B0B' : '#f7f5f1' }}>
          <div aria-hidden className="absolute inset-x-0 top-0 flex items-center justify-between px-[11%] text-[10px] font-bold transition-colors duration-300" style={{ height: bar, color: ink }}>
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <svg width="13" height="9" viewBox="0 0 18 12"><g fill={ink}><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></g></svg>
              <svg width="18" height="9" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke={ink} strokeOpacity=".45" /><rect x="2" y="2" width="17" height="8" rx="2" fill={ink} /></svg>
            </span>
          </div>
          <iframe ref={frame} src={src} title={label} onLoad={() => { send(); window.setTimeout(() => setReady(true), 500) }}
            className={`absolute left-0 origin-top-left border-0 transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
            style={{ top: bar, width: 480, height: Math.round((h - bar) / scale), transform: `scale(${scale})` }} />
          {!ready && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>}
        </div>
        <AnimatePresence>
          {pulse > 0 && (
            <motion.span key={pulse} aria-hidden className="pointer-events-none absolute -inset-[10px] rounded-[40px] border-[3px] border-[#C9A24D]"
              initial={{ opacity: 0.95, scale: 1 }} animate={{ opacity: 0, scale: 1.06 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          )}
        </AnimatePresence>
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[12px] font-black uppercase tracking-[0.2em] text-gray-400"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live preview</p>
    </div>
  )
}

/** The hub keys for the Brand Kit's look (Luxe stays IDX-only). */
const brandHubLook = (b: BrandLook, isIdx: boolean) => ({ hubTheme: b.theme === 'luxe' && isIdx ? 'luxe' : 'classic', hubAccent: b.accent, hubLuxeMetal: b.metal, visitorDarkMode: b.dark })

export function HubStep({ ctx }: { ctx: StepCtx }) {
  const look = ctx.data.look || {}
  const isIdx = ctx.plan === 'IDX'
  const { look: brand } = useBrandKit()
  // "My Brand Kit" unless the hub chose its own (legacy hubs with a saved look keep it - brand_look_service).
  const legacyOwn = !!(look.hubTheme || look.hubAccent || look.hubLuxeMetal || look.visitorDarkMode === true)
  const [source, setSource] = useState<'brand' | 'own'>(look.lookSource === 'brand' ? 'brand' : look.lookSource === 'own' || legacyOwn ? 'own' : 'brand')
  const [theme, setTheme] = useState<string>(isIdx && look.hubTheme === 'luxe' ? 'luxe' : 'classic')
  const [accent, setAccent] = useState<string>(hubAccentOf(look.hubAccent))
  const [metal, setMetal] = useState<LuxeMetal>(metalOf(look.hubLuxeMetal))
  const [dark, setDark] = useState<boolean>(look.visitorDarkMode === true)
  const [header, setHeader] = useState<string>(typeof look.mobileHeader === 'string' ? look.mobileHeader : 'centered')
  const [slug, setSlug] = useState(ctx.data.slug)
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'saved' | 'error'>('idle')
  const [reload, setReload] = useState(0)
  const saveLook = (patch: Record<string, string | boolean>) => ctx.saveInfo({ look: patch })
  const own = { hubTheme: theme, hubAccent: accent, hubLuxeMetal: metal, visitorDarkMode: dark }
  const shownLook = source === 'brand' ? brandHubLook(brand, isIdx) : own
  const phoneLook: HubLook = { ...shownLook, mobileHeader: header }
  useGate(ctx, {
    ok: slugState !== 'taken' && slugState !== 'checking',
    message: slugState === 'taken' ? 'That link is taken - try another.' : undefined,
    onContinue: async () => {
      if (slug !== ctx.data.slug && slugState === 'ok') {
        const r = await api.agentHub.updateSlug(slug)
        if (!r.success) { setSlugState('error'); return false }
      }
      await api.setup.setState({ confirm: 'hub' })
    },
  }, [slug, slugState])
  const checkSlug = useRef<number | undefined>(undefined)
  const onSlug = (raw: string) => {
    const v = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 60)
    setSlug(v)
    window.clearTimeout(checkSlug.current)
    if (v === ctx.data.slug) { setSlugState('idle'); return }
    if (v.length < 3) { setSlugState('taken'); return }
    setSlugState('checking')
    checkSlug.current = window.setTimeout(async () => {
      const r = await api.agentHub.checkSlug(v.replace(/-+$/, ''))
      setSlugState(r.success && r.data?.available ? 'ok' : 'taken')
    }, 450)
  }
  const pickBrand = () => { setSource('brand'); saveLook({ ...brandHubLook(brand, isIdx), lookSource: 'brand' }) }
  // "Choose my own" starts from the look it wears now, so nothing changes until they pick.
  const pickOwn = () => {
    if (source === 'own') return
    const from = brandHubLook(brand, isIdx)
    setTheme(from.hubTheme); setAccent(hubAccentOf(from.hubAccent)); setMetal(metalOf(from.hubLuxeMetal)); setDark(from.visitorDarkMode)
    setSource('own'); saveLook({ ...from, lookSource: 'own' })
  }
  const shownSlug = ctx.data.slug
  const src = `/${shownSlug}?preview=1${reload ? `&r=${reload}` : ''}`
  const bump = () => setReload(n => n + 1)
  // Four short pages instead of one long list (owner, 10/22). The phone preview stays put beside
  // (or, on a phone, under) whichever page is showing, so it never reloads between pages.
  const flow = useMiniFlow(ctx, ['Look', 'Layout', 'Buttons', 'Link'])
  const lookPage = (
    <div className="space-y-9">
        <div>
          <SubHead sub="Wear your Brand Kit, or give your hub a look of its own.">Look</SubHead>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard on={source === 'brand'} onClick={pickBrand} title="My Brand Kit" blurb={lookName(brand.theme === 'luxe' && isIdx, brand.metal, colorLabel(brand.accent), brand.dark)}>
              <div className="relative"><LookTile luxe={brand.theme === 'luxe' && isIdx} metal={brand.metal} accent={brand.accent} dark={brand.dark} /><span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#8b6a2b] shadow-sm dark:bg-black/60 dark:text-[#e8c97a]"><Layers className="h-3.5 w-3.5" /></span></div>
            </ChoiceCard>
            <ChoiceCard on={source === 'own'} onClick={pickOwn} title="Choose my own" blurb={source === 'own' ? lookName(theme === 'luxe', metal, colorLabel(accent), dark) : 'Pick a style, color and Ivory or Midnight.'}>
              <div className="relative"><LookTile luxe={source === 'own' && theme === 'luxe'} metal={metal} accent={source === 'own' ? accent : '#2563EB'} dark={source === 'own' && dark} /><span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#8b6a2b] shadow-sm dark:bg-black/60 dark:text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /></span></div>
            </ChoiceCard>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {source === 'own' && (
            <motion.div key="own" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="space-y-8 overflow-hidden">
              <div>
                <SubHead>Style</SubHead>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoiceCard on={theme === 'classic'} onClick={() => { setTheme('classic'); saveLook({ hubTheme: 'classic' }) }} title="Classic" blurb="Clean and bright.">
                    <div className="flex h-24 items-center justify-center rounded-2xl bg-[#f7f5f1]"><div className="h-16 w-24 rounded-xl border border-gray-200 bg-white p-2 shadow-sm"><div className="mx-auto h-4 w-4 rounded-full bg-gray-300" /><div className="mx-auto mt-1.5 h-1.5 w-12 rounded bg-[#111827]" /><div className="mt-1.5 h-2.5 rounded" style={{ background: accent }} /></div></div>
                  </ChoiceCard>
                  <ChoiceCard on={theme === 'luxe'} disabled={!isIdx} onClick={() => { setTheme('luxe'); saveLook({ hubTheme: 'luxe' }) }} title="Luxe" blurb={isIdx ? 'Gold light and a cinematic entrance.' : 'Included with the IDX plan.'} badge={!isIdx ? <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#e8c97a]">IDX</span> : undefined}>
                    <div className="flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b0f0e] via-[#111827] to-[#2a2218]"><div className="h-16 w-24 rounded-xl border border-[#C9A24D]/50 bg-[#151517] p-2"><div className="mx-auto h-4 w-4 rounded-full" style={{ background: `conic-gradient(${LUXE_METALS[metal].deep}, ${LUXE_METALS[metal].light}, ${LUXE_METALS[metal].base})` }} /><div className="mx-auto mt-1.5 h-1.5 w-12 rounded bg-white" /><div className="mt-1.5 h-2.5 rounded" style={{ background: `linear-gradient(90deg, ${LUXE_METALS[metal].deep}, ${LUXE_METALS[metal].light})` }} /></div></div>
                  </ChoiceCard>
                </div>
              </div>
              <div>
                <SubHead>{theme === 'luxe' ? 'Finish' : 'Color'}</SubHead>
                {theme === 'luxe'
                  ? <Swatches label="Finish" colors={METAL_SWATCHES} value={LUXE_METALS[metal].base} onChange={c => { const m = LUXE_METAL_ORDER.find(x => LUXE_METALS[x].base === c) || 'gold'; setMetal(m); saveLook({ hubLuxeMetal: m }) }} />
                  : <Swatches label="Color" colors={HUB_CLASSIC_ACCENTS} value={accent} onChange={c => { setAccent(c); saveLook({ hubAccent: c }) }} />}
              </div>
              <div>
                <SubHead>Ivory or Midnight</SubHead>
                <div className="grid grid-cols-2 gap-3">
                  {[false, true].map(d => (
                    <ChoiceCard key={String(d)} on={dark === d} onClick={() => { setDark(d); saveLook({ visitorDarkMode: d }) }} title={modeLabel(d)} blurb={d ? 'Deep pages, light text.' : 'Bright pages, dark text.'}>
                      <div className={`flex h-16 items-center justify-center rounded-2xl ${d ? 'bg-[#0B0B0B]' : 'bg-[#f7f5f1]'}`}>{d ? <Moon className="h-7 w-7 text-[#e8c97a]" /> : <Sun className="h-7 w-7 text-[#C9A24D]" />}</div>
                    </ChoiceCard>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
  const layoutPage = (
    <div className="space-y-9">
        <div>
          <SubHead sub="How your name and photo sit at the top on a phone.">Top of the page</SubHead>
          <div className="grid gap-3 sm:grid-cols-2">
            {HUB_MOBILE_HEADERS.map(h => (
              <ChoiceCard key={h.id} on={header === h.id} onClick={() => { setHeader(h.id); saveLook({ mobileHeader: h.id }) }} title={h.label} blurb={h.blurb}>
                <div className="flex h-16 items-center justify-center rounded-2xl bg-[#f2efe8] dark:bg-white/[0.04]">
                  {h.id === 'split'
                    ? <div className="flex w-28 items-center gap-2 rounded-lg border border-gray-200 bg-white p-1.5 dark:border-white/10 dark:bg-[#151517]"><span className="h-9 w-7 rounded-md bg-gray-300" /><span className="flex-1 space-y-1"><span className="block h-1.5 w-12 rounded bg-[#111827] dark:bg-white" /><span className="block h-1 w-9 rounded bg-gray-300" /></span></div>
                    : <div className="flex w-28 flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 dark:border-white/10 dark:bg-[#151517]"><span className="h-5 w-5 rounded-full bg-gray-300" /><span className="h-1.5 w-12 rounded bg-[#111827] dark:bg-white" /></div>}
                </div>
              </ChoiceCard>
            ))}
          </div>
        </div>
        <div>
          <SubHead sub="Switch on what you want people to see. Anything with nothing in it yet stays hidden until it has something.">What’s on your Agent Hub</SubHead>
          <HubContentPicker ctx={ctx} onSaved={bump} />
        </div>
    </div>
  )
  const buttonsPage = (
        <div>
          <SubHead sub="The big buttons under your name. Each one opens that form.">Form buttons on your Agent Hub</SubHead>
          <HubFormButtons ctx={ctx} onSaved={bump} />
        </div>
  )
  const linkPage = (
        <div>
          <SubHead sub="The address you share. Short and simple is best.">Your link</SubHead>
          <div className="flex overflow-hidden rounded-2xl border-2 border-[#e7dfcf] bg-white focus-within:border-[#C9A24D] dark:border-white/10 dark:bg-[#0e0e10]">
            <span className="flex items-center border-r-2 border-[#e7dfcf] bg-[#fbf6ea] px-3 text-[14px] font-black text-gray-500 dark:border-white/10 dark:bg-[#1a1712] sm:px-4 sm:text-[15px]">openhousepal.com/</span>
            <input value={slug} onChange={e => onSlug(e.target.value)} aria-label="Your Agent Hub link" className="min-w-0 flex-1 bg-transparent px-3 py-4 text-[17px] font-bold text-[#111827] outline-none dark:text-white sm:px-4" />
          </div>
          <p className={`mt-2 text-[13.5px] font-bold ${slugState === 'taken' || slugState === 'error' ? 'text-rose-600' : slugState === 'ok' ? 'text-emerald-600' : 'text-gray-400'}`}>
            {slugState === 'checking' ? 'Checking...' : slugState === 'ok' ? 'Available - it switches over when you continue. Your old link keeps working.' : slugState === 'taken' ? 'That one is taken - try adding your town or a middle initial.' : slugState === 'error' ? 'We couldn’t save that link - please try another.' : 'This is your link today.'}
          </p>
          <OpenHubButton slug={shownSlug} className="mt-4 w-full sm:w-auto" />
          <HubLinkNote ctx={ctx} slug={shownSlug} />
        </div>
  )
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <MiniFlow flow={flow} pages={[lookPage, layoutPage, buttonsPage, linkPage]} />
      <div className="lg:hidden">
        <HubPhonePreview src={src} look={phoneLook} label="Your Agent Hub" width={230} />
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-28"><HubPhonePreview src={src} look={phoneLook} label="Your Agent Hub" /></div>
      </div>
    </div>
  )
}

// ---------- Forms ----------
// The look ("My Brand Kit" first, or one look of their own - saved to every form as it's tapped),
// then three defaults for every form now and every form made later (POST /setup/form-defaults).
// The phone is the real What's My Home Worth page repainting live (?preview=1).
export function FormsStep({ ctx }: { ctx: StepCtx }) {
  const look = ctx.data.look || {}
  const luxeAllowed = ctx.plan === 'IDX'
  const { kit } = useBrandKit()
  const hubLook = formLookOf({ theme: look.hubTheme === 'luxe' && luxeAllowed ? 'luxe' : 'classic', accent: hubAccentOf(look.hubAccent), metal: look.hubLuxeMetal, dark: look.visitorDarkMode === true })
  const brandLook = brandFormLook(kit, luxeAllowed)
  const [forms, setForms] = useState<AgentFormConfig[] | null>(null)
  const [value, setValue] = useState<FormLookFields>({ look_mode: 'brand' })
  const [defaults, setDefaults] = useState<SetupFormDefaults | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    api.forms.getMine().then(r => {
      const list = r.success && r.data ? r.data : []
      setForms(list)
      const own = list.find(f => f.look_mode === 'custom')
      if (own) setValue({ look_mode: 'custom', look_theme: own.look_theme || 'classic', accent_color: own.accent_color, luxe_metal: own.luxe_metal || 'gold', dark_mode: own.dark_mode })
      else setValue({ look_mode: list.length && list.every(f => f.look_mode === 'brand') ? 'brand' : list.some(f => f.look_mode === 'brand') ? 'brand' : 'hub' })
    })
    api.setup.formDefaults().then(r => { if (r.success && r.data) setDefaults(r.data) })
  }, [])
  const timer = useRef<number | undefined>(undefined)
  const change = (patch: FormLookFields) => {
    const next = { ...value, ...patch }
    setValue(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      ctx.markSaving(api.forms.updateAllLook({
        look_mode: next.look_mode === 'custom' ? 'custom' : next.look_mode === 'brand' ? 'brand' : 'hub',
        look_theme: next.look_theme || 'classic', accent_color: next.accent_color || undefined, luxe_metal: next.luxe_metal || 'gold', dark_mode: !!next.dark_mode,
      }))
    }, 350)
  }
  const setDefault = (key: 'animated' | 'show_branding' | 'redirect_to_agent_hub', v: boolean) => {
    setDefaults(d => (d ? { ...d, [key]: { ...d[key], value: v, mixed: false } } : d))
    const p = api.setup.setFormDefaults({ [key]: v }).then(r => { if (r.success && r.data) setDefaults(r.data); setReload(n => n + 1); return r })
    ctx.markSaving(p)
  }
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'forms' }) } }, [])
  const shown = resolveFormLook(value, hubLook, luxeAllowed, brandLook)
  const sample = forms ? forms.find(f => f.form_type === 'home_value' && f.is_enabled) || forms.find(f => f.is_enabled && f.form_type !== 'showing') || forms[0] : null
  const src = sample ? `/${ctx.data.slug}/${sample.slug}?preview=1${reload ? `&r=${reload}` : ''}` : null
  const enabled = (forms || []).filter(f => f.is_enabled)
  const redirect = defaults?.redirect_to_agent_hub
  const flow = useMiniFlow(ctx, ['Look', 'Settings'])
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <MiniFlow flow={flow} pages={[
        <div key="look">
          <SubHead sub="One look for every form you share - What's My Home Worth, I'm Buying, I'm Selling and the rest.">Your forms’ look</SubHead>
          <FormLookPicker value={value} hubLook={hubLook} brandLook={brandLook} luxeAllowed={luxeAllowed} onChange={change} />
        </div>,
        <div key="settings" className="space-y-8">
        {defaults ? (
          <div className="space-y-4">
            <SubHead sub="For every form you have now - and any form you make later.">Every form</SubHead>
            <QuestionCard icon={Sparkles} testId="forms-animated" on={defaults.animated.value} onChange={v => setDefault('animated', v)} title="Make my forms animated"
              blurb="A soft moving background and the welcome words gliding in. Off: calm and still." />
            <QuestionCard icon={UserRound} testId="forms-branding" on={defaults.show_branding.value} onChange={v => setDefault('show_branding', v)} title="Show my agent branding on my forms"
              blurb="Your photo, name and brokerage on the first screen, so people know who they’re talking to." />
            {redirect && (
              <QuestionCard icon={MoveRight} testId="forms-redirect" on={redirect.value} onChange={v => setDefault('redirect_to_agent_hub', v)} title="After someone sends a form, take them to my Agent Hub"
                blurb={redirect.value ? 'They see your thank-you message, then your Agent Hub opens.' : 'They stay on your thank-you message.'}>
                <div className="space-y-2 text-[13px] font-medium leading-snug text-gray-500 dark:text-gray-400">
                  {redirect.mixed && redirect.differs.length > 0 && <Note tone="gold">Right now {redirect.differs.join(', ')} {redirect.differs.length === 1 ? 'goes' : 'go'} somewhere else - this switch sets them all the same.</Note>}
                  {redirect.locked.length > 0 && <p>“{redirect.locked.join('”, “')}” always opens the visitor’s new Showcase instead.</p>}
                  <p>A campaign link with its own after-submit choice keeps it. Your open house sign-in (Guest Pass) isn’t affected.</p>
                </div>
              </QuestionCard>
            )}
          </div>
        ) : <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>}
        {enabled.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">Used on all {enabled.length} of your forms</p>
            <div className="flex flex-wrap gap-1.5">
              {enabled.map(f => <span key={f.id} className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[12.5px] font-bold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">{f.title}</span>)}
            </div>
            <p className="mt-3 text-[13px] font-medium text-gray-500 dark:text-gray-400">You can still change any one form later, in that form&apos;s Settings.</p>
          </div>
        )}
        </div>,
      ]} />
      {src && <div className="lg:hidden"><FormPhonePreview key={src} src={src} look={shown} label="Your form" width={230} /></div>}
      {src && (
        <div className="hidden lg:block">
          <div className="sticky top-28"><FormPhonePreview key={src} src={src} look={shown} label="Your form" /></div>
        </div>
      )}
    </div>
  )
}

// ---------- Email signature ----------
// The same saved signature the Studio editor edits, read and written with the editor's own rules
// (lib/signatureConfig: defaults, the 2-button cap with "My Agent Hub" always first, Luxe locking
// the serif + metal, the same colors and fonts), and the same two previews: the Site Version (the
// card on their website, articles, Spotlights...) and the Email Version (what Copy pastes).
const SIG_STEPS: Record<'gmail' | 'outlook' | 'apple', string[]> = {
  gmail: ['Open Gmail on a computer and click the gear, then "See all settings".', 'Scroll to "Signature", click "Create new" and name it.', 'Click in the box and paste (Ctrl+V, or Cmd+V on a Mac).', 'Scroll down and click "Save Changes".'],
  outlook: ['In Outlook, open Settings, then "Signatures".', 'Click "New signature" and name it.', 'Click in the box and paste (Ctrl+V, or Cmd+V on a Mac).', 'Choose it for new messages and click "Save".'],
  apple: ['In Mail on your Mac, open Settings, then "Signatures".', 'Click + to add a signature.', 'Untick "Always match my default message font", then paste.', 'Close the window - it saves itself.'],
}
const SIG_THEME_LOOK = {
  light: { classic: 'linear-gradient(135deg, #fffdfa 0%, #f6f2eb 100%)', luxe: 'linear-gradient(135deg, #fffdf8 0%, #f4ead7 100%)' },
  dark: { classic: 'linear-gradient(135deg, #1B1D22 0%, #0D0E11 100%)', luxe: 'linear-gradient(135deg, #111827 0%, #2a2218 100%)' },
}

const SIG_SOCIALS = [
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'tiktok', label: 'TikTok', icon: Music2 },
] as const

export function SignatureStep({ ctx }: { ctx: StepCtx }) {
  const { user } = useAuth()
  const { look: brand } = useBrandKit()
  const luxeAllowed = ctx.plan === 'IDX'
  const [cfg, setCfg] = useState<SignatureConfig | null>(null)
  const [hub, setHub] = useState<{ config: any; slug: string }>({ config: {}, slug: '' })
  const [forms, setForms] = useState<AgentFormConfig[]>([])
  const [emailVersion, setEmailVersion] = useState(0)
  const [copied, setCopied] = useState<'' | 'ok' | 'err'>('')
  const [client, setClient] = useState<'gmail' | 'outlook' | 'apple'>('gmail')
  const saveTimer = useRef<number | undefined>(undefined)
  const pending = useRef<SignatureConfig | null>(null)

  const persist = (next: SignatureConfig) => {
    const p = api.emailSignature.saveConfig(next).then(r => { if (r.success) setEmailVersion(v => v + 1) })
    ctx.markSaving(p)
    return p
  }
  useEffect(() => {
    Promise.all([api.emailSignature.getMine(), api.agentHub.getMine(), api.forms.getMine()]).then(([s, h, f]) => {
      const hubConfig = (h.success && h.data?.config) || {}
      setHub({ config: hubConfig, slug: (h.success && h.data?.slug) || ctx.data.slug || '' })
      const myForms: AgentFormConfig[] = f.success && f.data ? f.data : []
      setForms(myForms)
      // GET /me already writes the Brand Kit's look in (lookSource 'brand') for a signature that
      // follows it - including one that was never styled (brand_look_service).
      let c = mergeSignatureConfig(s.success ? s.data?.config : null)
      let changed = false
      // the editor's own first-visit rules: two starting buttons, and nothing left switched on
      // that has nothing behind it any more
      if (!c.ctaButtons.length) { const seed = seedSignatureButtons(myForms); if (seed.length) { c = { ...c, ctaButtons: seed }; changed = true } }
      const stale = staleSignatureFields(c, hubConfig)
      if (stale.length) { c = withoutFields(c, stale); changed = true }
      // every social they added in "Your socials" goes on, like the Agent Hub (once - see seedSignatureSocials)
      const seeded = seedSignatureSocials(c, hubConfig)
      if (seeded) { c = seeded; changed = true }
      setCfg(c)
      if (changed) persist(c)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useGate(ctx, {
    ok: true,
    onContinue: async () => {
      if (pending.current) { window.clearTimeout(saveTimer.current); const p = pending.current; pending.current = null; await persist(p) }
      await api.setup.setState({ confirm: 'signature' })
    },
  }, [])
  const update = (fn: (c: SignatureConfig) => SignatureConfig) => {
    setCfg(cur => {
      if (!cur) return cur
      const next = fn(cur)
      pending.current = next
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => { const p = pending.current; pending.current = null; if (p) persist(p) }, 700)
      return next
    })
  }
  // A look control picked while on "Choose my own" keeps it the signature's own.
  const updateOwn = (fn: (c: SignatureConfig) => SignatureConfig) => update(c => ({ ...fn(c), lookSource: 'own' }))
  useEffect(() => () => { window.clearTimeout(saveTimer.current); if (pending.current) api.emailSignature.saveConfig(pending.current) }, [])

  // The Site Version, built in the browser from exactly what the editor's live preview uses.
  const siteHtml = useMemo(() => {
    if (!cfg) return ''
    return buildDesignPreviewHtml(buildSignatureSiteInput({
      config: cfg, hubConfig: hub.config, agentHubSlug: hub.slug, ownerId: user?.id, forms,
      fallbackName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || ctx.data.info.name, fallbackPhoto: user?.photo_url || ctx.data.info.photoUrl || '',
    }))
  }, [cfg, hub, forms, user, ctx.data.info.name, ctx.data.info.photoUrl])

  const copy = async () => {
    if (pending.current) { window.clearTimeout(saveTimer.current); const p = pending.current; pending.current = null; await persist(p) }
    const r = await api.emailSignature.getHtml()
    if (!r.success || !r.data?.html) { setCopied('err'); return }
    try {
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([r.data.html], { type: 'text/html' }), 'text/plain': new Blob([r.data.html], { type: 'text/plain' }) })])
      } else {
        await navigator.clipboard.writeText(r.data.html)
      }
      setCopied('ok')
      if (r.data.html_hash) api.emailSignature.markInstalled(r.data.html_hash, r.data.assets_hash, client)
    } catch {
      setCopied('err')
    }
  }

  const available = FORM_BUTTON_ORDER.map(t => forms.find(f => f.form_type === t)).filter((f): f is AgentFormConfig => Boolean(f))
  // Short pages under the preview (owner, 10/22); "Buttons" only when they have forms to put there.
  const flow = useMiniFlow(ctx, available.length ? ['Look', 'Buttons', 'Extras', 'Install'] : ['Look', 'Extras', 'Install'])
  if (!cfg) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const fromBrand = cfg.lookSource === 'brand'
  const brandSig = brandSignaturePatch(brand, luxeAllowed)
  const luxe = cfg.luxe
  const metal = cfg.luxeMetal
  const colors = ACCENT_COLORS.some(c => c.color.toLowerCase() === cfg.accentColor.toLowerCase())
    ? ACCENT_COLORS
    : [{ color: cfg.accentColor, label: cfg.accentColor.toLowerCase() === DEFAULT_ACCENT.toLowerCase() ? 'Copper' : 'Yours' }, ...ACCENT_COLORS]
  const toggleButton = (f: AgentFormConfig) => update(c => {
    if (c.ctaButtons.some(b => b.formType === f.form_type)) return { ...c, ctaButtons: c.ctaButtons.filter(b => b.formType !== f.form_type) }
    if (c.ctaButtons.length >= MAX_CTA_BUTTONS) return c
    return { ...c, ctaButtons: [...c.ctaButtons, { id: `cta-${f.form_type}`, label: FORM_BUTTON_DEFAULTS[f.form_type] || f.title, formType: f.form_type, url: '', enabled: true }] }
  })
  const listings = (hub.config.myListings || []).length > 0
  const sales = (hub.config.recentSales || []).length > 0
  const socialUrls = socialUrlsFrom(hub.config)
  const socialNets = SIG_SOCIALS.filter(s => socialUrls[s.id])

  return (
    <div className="space-y-9">
      {/* the preview sits in its own place - it doesn't follow them down the page (user, 10/20) */}
      <SignatureDualPreview siteHtml={siteHtml} emailVersion={emailVersion} />

      <MiniFlow flow={flow} pages={[
      <div key="look" className="space-y-9">
      <div>
        <SubHead sub="Wear your Brand Kit, or choose a look just for your signature.">Look</SubHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard on={fromBrand} onClick={() => update(c => ({ ...c, ...brandSig }))} title="My Brand Kit"
            blurb={lookName(brandSig.luxe, brand.metal, colorLabel(brand.accent), brand.dark)}>
            <div className="relative">
              <div className="flex h-16 items-center justify-center gap-2 rounded-2xl ring-1 ring-black/5" style={{ background: SIG_THEME_LOOK[brand.dark ? 'dark' : 'light'][brandSig.luxe ? 'luxe' : 'classic'] }}>
                <span className="h-9 w-9 rounded-xl" style={{ background: brandSig.luxe ? `linear-gradient(135deg, ${LUXE_METALS[brand.metal].deep}, ${LUXE_METALS[brand.metal].base} 45%, ${LUXE_METALS[brand.metal].light} 70%, ${LUXE_METALS[brand.metal].deep})` : brand.accent }} />
                <span className="h-3 w-20 rounded-full" style={{ background: brandSig.luxe ? LUXE_METALS[brand.metal].base : brand.accent }} />
              </div>
              <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#8b6a2b] shadow-sm dark:bg-black/60 dark:text-[#e8c97a]"><Layers className="h-3.5 w-3.5" /></span>
            </div>
          </ChoiceCard>
          <ChoiceCard on={!fromBrand} onClick={() => { if (fromBrand) update(c => ({ ...c, lookSource: 'own' })) }} title="Choose my own"
            blurb={!fromBrand ? lookName(luxe, metal, colorLabel(cfg.accentColor), cfg.darkMode) : 'A style, color and font just for your signature.'}>
            <div className="relative">
              <div className="flex h-16 items-center justify-center gap-1.5 rounded-2xl bg-[#fbfaf7] dark:bg-white/[0.04]">
                {ACCENT_COLORS.slice(0, 5).map(a => <span key={a.color} className="h-6 w-6 rounded-full ring-2 ring-white dark:ring-[#141416]" style={{ background: a.color }} />)}
              </div>
              <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#8b6a2b] shadow-sm dark:bg-black/60 dark:text-[#e8c97a]"><Sparkles className="h-3.5 w-3.5" /></span>
            </div>
          </ChoiceCard>
        </div>
      </div>

      <AnimatePresence initial={false}>
      {!fromBrand && (
      <motion.div key="own" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="space-y-8 overflow-hidden">
      <div>
        <SubHead sub="Classic takes your color and font. Luxe is our premade look: serif type and a metal finish.">Style</SubHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard on={!luxe} onClick={() => updateOwn(c => ({ ...c, luxe: false }))} title="Classic" blurb="Your color, clean layout.">
            <div className="flex h-20 items-center gap-3 rounded-2xl bg-[#fbfaf7] px-4 dark:bg-white/[0.04]">
              <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: cfg.accentColor }} />
              <span className="flex-1 space-y-1.5"><span className="block h-2 w-24 rounded bg-[#111827] dark:bg-white" /><span className="block h-1.5 w-16 rounded bg-gray-300" /><span className="block h-3 w-20 rounded-full" style={{ background: cfg.accentColor }} /></span>
            </div>
          </ChoiceCard>
          <ChoiceCard on={luxe} onClick={() => updateOwn(c => ({ ...c, luxe: true }))} title="Luxe" blurb="Serif type and a metal finish.">
            <div className="flex h-20 items-center gap-3 rounded-2xl px-4" style={{ background: 'linear-gradient(135deg,#111827 0%,#1b1a17 55%,#2a2218 100%)' }}>
              <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${LUXE_METALS[metal].deep}, ${LUXE_METALS[metal].base} 40%, ${LUXE_METALS[metal].pale} 55%, ${LUXE_METALS[metal].light} 70%, ${LUXE_METALS[metal].deep})` }} />
              <span className="flex-1 space-y-1.5"><span className="block font-serif text-[15px] italic leading-none text-white">{(ctx.data.info.name || 'Your name').split(' ')[0]}</span><span className="block h-1.5 w-16 rounded bg-white/30" /><span className="block h-3 w-20 rounded-full" style={{ background: LUXE_METALS[metal].base }} /></span>
            </div>
          </ChoiceCard>
        </div>
      </div>

      <div>
        {luxe
          ? <><SubHead sub="The same gold, silver and bronze as your website and Agent Hub.">Finish</SubHead>
              <Swatches label="Finish" colors={METAL_SWATCHES} value={LUXE_METALS[metal].base} onChange={c => updateOwn(x => ({ ...x, luxeMetal: LUXE_METAL_ORDER.find(m => LUXE_METALS[m].base === c) || 'gold' }))} /></>
          : <><SubHead sub="Your buttons, icons and lines.">Color</SubHead>
              <Swatches label="Color" colors={colors} value={cfg.accentColor} onChange={c => updateOwn(x => ({ ...x, accentColor: c }))} /></>}
      </div>

      <div>
        <SubHead sub="Changes in an already-pasted signature too - nothing to re-copy.">Ivory or Midnight</SubHead>
        <div className="grid grid-cols-2 gap-3">
          {([false, true] as const).map(d => (
            <ChoiceCard key={String(d)} on={cfg.darkMode === d} onClick={() => updateOwn(c => ({ ...c, darkMode: d }))} title={modeLabel(d)}>
              <div className="flex h-16 items-center justify-center rounded-2xl ring-1 ring-black/5" style={{ background: SIG_THEME_LOOK[d ? 'dark' : 'light'][luxe ? 'luxe' : 'classic'] }}>
                {d ? <Moon className="h-7 w-7 text-[#e8c97a]" /> : <Sun className="h-7 w-7 text-[#C9A24D]" />}
              </div>
            </ChoiceCard>
          ))}
        </div>
      </div>

      {!luxe && (
        <div>
          <SubHead sub="Email-safe fonts only - each one shows correctly in Gmail and Outlook.">Font</SubHead>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FONT_OPTIONS.map(f => {
              const on = cfg.fontFamily === f.id
              return (
                <button key={f.id} type="button" onClick={() => updateOwn(c => ({ ...c, fontFamily: f.id }))} aria-pressed={on}
                  className={`rounded-[18px] border-2 px-3 py-3 text-center transition ${on ? 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white shadow-[0_14px_30px_-22px_rgba(139,106,43,.85)] dark:from-[#1d1912] dark:to-[#141416]' : 'border-[#ece5d6] bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416]'}`}>
                  <span className="block text-[26px] leading-none text-[#111827] dark:text-white" style={{ fontFamily: f.stack }}>Aa</span>
                  <span className="mt-1.5 block text-[12.5px] font-black text-gray-600 dark:text-gray-300">{f.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      </motion.div>
      )}
      </AnimatePresence>
      </div>,

      ...(available.length > 0 ? [
        <div key="buttons">
          <SubHead sub={`Buttons people tap inside your emails to reach you. "My Agent Hub" always comes first - pick up to ${MAX_CTA_BUTTONS} of your forms to go beside it.`}>The form buttons on your signature</SubHead>
          <SignatureFormButtons cfg={cfg} available={available} onToggle={toggleButton} name={ctx.data.info.name} title={[ctx.data.info.title, ctx.data.info.brokerage].filter(Boolean).join(' · ')} photoUrl={ctx.data.info.photoUrl} />
        </div>,
      ] : []),

      <div key="extras" className="space-y-9">
      <div>
        <SubHead sub="Each one taps through to that page. They come from “Your socials” - change a link there and it changes here too.">Social icons</SubHead>
        {socialNets.length ? (
          <div className="flex flex-wrap gap-2">
            {socialNets.map(s => {
              const on = !!cfg.fields[s.id]?.include
              return (
                <button key={s.id} type="button" aria-pressed={on} onClick={() => update(c => ({ ...c, fields: { ...c.fields, [s.id]: { ...c.fields[s.id], include: !on } } }))}
                  className={`inline-flex items-center gap-2 rounded-full border-2 py-2 pl-2.5 pr-4 text-[14px] font-black transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white' : 'border-[#ece5d6] text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-400'}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full transition ${on ? 'bg-[#111827] text-[#e8c97a] dark:bg-white dark:text-[#111827]' : 'bg-gray-100 text-gray-400 dark:bg-white/[0.06]'}`}><s.icon className="h-3.5 w-3.5" /></span>
                  {s.label}{on && <Check className="h-4 w-4 text-[#C9A24D]" />}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="rounded-2xl bg-[#f7f3ea] px-4 py-3 text-[14px] font-semibold text-gray-600 dark:bg-white/[0.04] dark:text-gray-300">No social links yet - add them in the “Your socials” step and they show up here.</p>
        )}
      </div>

      {/* Two separate switches: stats work with the listings & sales card off (they become a slim strip).
          Which sales show and the stats are also asked in the Sales step - same settings. */}
      <div className="space-y-3">
        <SubHead sub="Both update themselves - nothing to re-copy when you sell a home.">Your listings, sales & stats</SubHead>
        <BigToggle on={cfg.blockVisibility.banner} onChange={v => update(c => ({ ...c, blockVisibility: { banner: v } }))} title="Show my listings & recent sales" blurb={listings || sales ? 'Your newest listing - or your recent sales - under your name, with a photo.' : 'Add a listing or recent sale first - then this shows them.'} />
        <BigToggle on={cfg.banner.showStats} onChange={v => update(c => ({ ...c, banner: { ...c.banner, showStats: v } }))} title="Show my sold stats" blurb={sales ? 'Homes sold, total volume and average price.' : 'Add your recent sales first - then your numbers show here.'} />
      </div>
      </div>,

      <div key="install" className="rounded-[22px] border-2 border-[#C9A24D]/40 bg-[#fbf6ea] p-5 dark:bg-[#1a1712]">
        <SubHead sub="Copy it, then paste it into your email app - it takes a minute.">Put it in your email</SubHead>
        <div className="flex flex-wrap gap-2">
          {(['gmail', 'outlook', 'apple'] as const).map(c => <button key={c} type="button" onClick={() => setClient(c)} className={`rounded-full px-4 py-2 text-[14px] font-black transition ${client === c ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-600 dark:bg-black/30 dark:text-gray-300'}`}>{c === 'gmail' ? 'Gmail' : c === 'outlook' ? 'Outlook' : 'Apple Mail'}</button>)}
        </div>
        <ol className="mt-4 space-y-2.5">
          <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-[13px] font-black text-white">1</span>
            <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2 text-[14px] font-black text-white dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">{copied === 'ok' ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy my signature</>}</button>
          </li>
          {SIG_STEPS[client].map((s, k) => <li key={k} className="flex gap-3 text-[15px] font-semibold text-[#111827] dark:text-white"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9A24D] text-[13px] font-black text-white">{k + 2}</span><span className="pt-0.5">{s}</span></li>)}
        </ol>
        {copied === 'err' && <p className="mt-3 text-[14px] font-bold text-rose-600">Copying didn&apos;t work in this browser - open the full signature page to copy it there.</p>}
        <p className="mt-4 text-[13px] font-semibold text-gray-500 dark:text-gray-400">Your headshot crop, which details show and the verified badge are in the full editor.</p>
        <a href="/studio/email-signature" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-black text-[#8b6a2b] underline-offset-4 hover:underline dark:text-[#e8c97a]">Open the full signature editor <ExternalLink className="h-4 w-4" /></a>
      </div>,
      ]} />
    </div>
  )
}
