'use client'

// The plan-feature steps: sales, reviews, brand, Agent Hub look, email signature. Each reads and
// writes the feature's own saved settings (the same ones its full editor uses), so whatever the
// agent sets here is exactly what they find later in that feature, and the other way round.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, ExternalLink, Facebook, Globe, ImageIcon, Instagram, Loader2, Lock, Moon, Music2, Sun, Trash2, Youtube } from 'lucide-react'
import api from '@/lib/api-service'
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
import RecentSalesPanel from '@/components/agent-hub/RecentSalesPanel'
import { HubPanelsOpen } from '@/components/agent-hub/HubPanelChrome'
import type { AgentSale } from '@/lib/agentSales'
import { HUB_CLASSIC_ACCENTS, hubAccentOf } from '@/components/agent-hub/HubClassicTheme'
import { HUB_MOBILE_HEADERS } from '@/components/agent-hub/HubLuxeTheme'
import { LUXE_METALS, LUXE_METAL_ORDER, metalOf, type LuxeMetal } from '@/lib/luxeMetals'
import { ACCENT_COLORS } from '@/lib/accentSwatches'
import { BRAND_ACCENT_COLORS, BRAND_MAIN_COLORS } from '@/lib/brandSwatches'
import { BigToggle, ChoiceCard, Field, isLight, PinnedPreview, StepCtx, SubHead, Swatches, toJpeg, useGate } from './SetupUi'
import ZillowLinkHelp, { ZILLOW_REVIEW_PLACEHOLDER } from '@/components/reviews/ZillowLinkHelp'

const METAL_SWATCHES = LUXE_METAL_ORDER.map(m => ({ color: LUXE_METALS[m].base, label: m[0].toUpperCase() + m.slice(1) }))

/** Read-modify-write of the hub config (PUT replaces the whole thing). */
async function patchHubConfig(patch: Record<string, unknown>) {
  const latest = await api.agentHub.getMine()
  const base = latest.success && latest.data?.config ? latest.data.config : {}
  return api.agentHub.saveConfig({ ...base, ...patch })
}

// ---------- Sales ----------
export function SalesStep({ ctx }: { ctx: StepCtx }) {
  const [ready, setReady] = useState(false)
  const [sales, setSales] = useState<AgentSale[]>([])
  const [showStats, setShowStats] = useState(true)
  const [carousel, setCarousel] = useState(true)
  const [autoScroll, setAutoScroll] = useState(false)
  const [minPrice, setMinPrice] = useState(0)
  useEffect(() => {
    api.agentHub.getMine().then(r => {
      const c = (r.success && r.data?.config) || {}
      if (Array.isArray(c.recentSales)) setSales(c.recentSales)
      if (typeof c.showSalesStats === 'boolean') setShowStats(c.showSalesStats)
      if (typeof c.salesCarousel === 'boolean') setCarousel(c.salesCarousel)
      if (typeof c.salesAutoScroll === 'boolean') setAutoScroll(c.salesAutoScroll)
      if (typeof c.salesMinPrice === 'number') setMinPrice(c.salesMinPrice)
      setReady(true)
    })
  }, [])
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'sales' }) } }, [])
  const save = async (o?: { recentSales?: AgentSale[]; showSalesStats?: boolean; salesCarousel?: boolean; salesAutoScroll?: boolean; salesMinPrice?: number }) => {
    const p = patchHubConfig({
      recentSales: o?.recentSales ?? sales, showSalesStats: o?.showSalesStats ?? showStats,
      salesCarousel: o?.salesCarousel ?? carousel, salesAutoScroll: o?.salesAutoScroll ?? autoScroll, salesMinPrice: o?.salesMinPrice ?? minPrice,
    })
    ctx.markSaving(p)
    await p
  }
  if (!ready) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  return (
    <HubPanelsOpen.Provider value>
      <div className="setup-embed">
        <RecentSalesPanel reLicenseNumber={ctx.data.info.licenseNumber} agentSales={sales} setAgentSales={setSales} showStats={showStats} setShowStats={setShowStats} carousel={carousel} setCarousel={setCarousel} autoScroll={autoScroll} setAutoScroll={setAutoScroll} minPrice={minPrice} setMinPrice={setMinPrice} onChange={() => {}} onSave={save} plain ready />
      </div>
    </HubPanelsOpen.Provider>
  )
}

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
const BRAND_COLORS = BRAND_MAIN_COLORS
const ACCENTS = BRAND_ACCENT_COLORS
export function BrandStep({ ctx }: { ctx: StepCtx }) {
  const [kit, setKit] = useState<BrandKit | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { api.studio.getBrandKit().then(r => { if (r.success && r.data) setKit(r.data) }) }, [])
  useGate(ctx, { ok: true, onContinue: async () => { await api.setup.setState({ confirm: 'brand' }) } }, [])
  if (!kit) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const upload = async (slot: 'personal' | 'team' | 'brokerage', file?: File) => {
    if (!file) return
    setBusy(slot)
    const f = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/svg+xml' || file.type === 'image/webp' ? file : await toJpeg(file)
    const r = await api.studio.uploadBrandLogo(slot, f)
    if (r.success && r.data) setKit(r.data)
    setBusy(null)
  }
  const remove = async (slot: 'personal' | 'team' | 'brokerage') => {
    setBusy(slot)
    const r = await api.studio.deleteBrandLogo(slot)
    if (r.success && r.data) setKit(r.data)
    setBusy(null)
  }
  const setColor = (k: 'primary_color' | 'secondary_color', c: string) => {
    setKit({ ...kit, [k]: c })
    ctx.markSaving(api.studio.updateBrandKit({ [k]: c }))
  }
  const slots: { slot: 'personal' | 'team' | 'brokerage'; label: string; url?: string | null }[] = [
    { slot: 'brokerage', label: 'Brokerage logo', url: kit.brokerage_logo_url },
    { slot: 'personal', label: 'Your own logo', url: kit.personal_logo_url },
    { slot: 'team', label: 'Team logo', url: kit.team_logo_url },
  ]
  return (
    <div className="space-y-8">
      <div>
        <SubHead sub="Add any you have - PNG with a clear background looks best.">Logos</SubHead>
        <div className="grid gap-3 sm:grid-cols-3">
          {slots.map(s => (
            <div key={s.slot} className="rounded-[22px] border-2 border-[#ece5d6] bg-white p-3 dark:border-white/10 dark:bg-[#141416]">
              <label className="flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-[repeating-conic-gradient(#f4efe5_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#1c1c1f_0%_25%,#141416_0%_50%)]">
                {busy === s.slot ? <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /> : s.url ? <img src={s.url} alt={s.label} className="max-h-24 max-w-[85%] object-contain" /> : <span className="flex flex-col items-center gap-1 text-[#8b6a2b] dark:text-[#e8c97a]"><ImageIcon className="h-7 w-7" /><span className="text-[12px] font-black">Add</span></span>}
                <input type="file" accept="image/*" className="sr-only" onChange={e => { upload(s.slot, e.target.files?.[0]); e.target.value = '' }} />
              </label>
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <span className="text-[14px] font-black text-[#111827] dark:text-white">{s.label}</span>
                {s.url && <button type="button" onClick={() => remove(s.slot)} aria-label={`Remove ${s.label}`} className="rounded-lg p-1.5 text-gray-400 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SubHead sub="The color for headers and backgrounds.">Main color</SubHead>
        <Swatches label="Main color" colors={BRAND_COLORS} value={kit.primary_color} onChange={c => setColor('primary_color', c)} />
      </div>
      <div>
        <SubHead sub="The highlight color for buttons and accents.">Accent color</SubHead>
        <Swatches label="Accent color" colors={ACCENTS} value={kit.secondary_color} onChange={c => setColor('secondary_color', c)} />
      </div>
      <div className="overflow-hidden rounded-[22px] border-2 border-[#ece5d6] dark:border-white/10">
        <div className="flex items-center gap-4 px-5 py-5" style={{ background: kit.primary_color }}>
          {(kit.brokerage_logo_url || kit.personal_logo_url) && <img src={kit.personal_logo_url || kit.brokerage_logo_url || ''} alt="" className="h-10 max-w-[120px] object-contain" />}
          <div className="min-w-0">
            <p className="font-serif text-[20px] font-black" style={{ color: isLight(kit.primary_color) ? '#111827' : '#ffffff' }}>{ctx.data.info.name || 'Your name'}</p>
            <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: kit.secondary_color }}>{ctx.data.info.brokerage || 'Your brokerage'}</p>
          </div>
          <span className="ml-auto rounded-full px-4 py-2 text-[13px] font-black" style={{ background: kit.secondary_color, color: '#111827' }}>Contact me</span>
        </div>
        <p className="bg-white px-5 py-2.5 text-[12px] font-bold text-gray-500 dark:bg-[#141416]">A quick look at your colors together</p>
      </div>
    </div>
  )
}

// ---------- Agent Hub look ----------
// The real public page in a phone frame. Each look change is handed straight to the page inside
// (it listens in ?preview=1 mode - see app/[slug]/page.tsx), so the phone changes the instant a
// choice is tapped; the save happens alongside. A gold ring pulses so the eye catches it.
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

export function HubStep({ ctx }: { ctx: StepCtx }) {
  const look = ctx.data.look || {}
  const isIdx = ctx.plan === 'IDX'
  const [theme, setTheme] = useState<string>(isIdx && look.hubTheme === 'luxe' ? 'luxe' : 'classic')
  const [accent, setAccent] = useState<string>(hubAccentOf(look.hubAccent))
  const [metal, setMetal] = useState<LuxeMetal>(metalOf(look.hubLuxeMetal))
  const [dark, setDark] = useState<boolean>(look.visitorDarkMode === true)
  const [header, setHeader] = useState<string>(typeof look.mobileHeader === 'string' ? look.mobileHeader : 'centered')
  const [slug, setSlug] = useState(ctx.data.slug)
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'saved' | 'error'>('idle')
  const saveLook = (patch: Record<string, string | boolean>) => ctx.saveInfo({ look: patch })
  const phoneLook: HubLook = { hubTheme: theme, hubAccent: accent, hubLuxeMetal: metal, visitorDarkMode: dark, mobileHeader: header }
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
  const shownSlug = ctx.data.slug
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-8">
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
          <SubHead>Light or dark</SubHead>
          <div className="grid grid-cols-2 gap-3">
            {[false, true].map(d => (
              <ChoiceCard key={String(d)} on={dark === d} onClick={() => { setDark(d); saveLook({ visitorDarkMode: d }) }} title={d ? 'Dark' : 'Light'}>
                <div className={`flex h-16 items-center justify-center rounded-2xl ${d ? 'bg-[#0B0B0B]' : 'bg-[#f7f5f1]'}`}>{d ? <Moon className="h-7 w-7 text-[#e8c97a]" /> : <Sun className="h-7 w-7 text-[#C9A24D]" />}</div>
              </ChoiceCard>
            ))}
          </div>
        </div>
        <div className="lg:hidden">
          <HubPhonePreview src={`/${shownSlug}?preview=1`} look={phoneLook} label="Your Agent Hub" width={230} />
        </div>
        <div>
          <SubHead>Top of the page</SubHead>
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
          <SubHead sub="The address you share. Short and simple is best.">Your link</SubHead>
          <div className="flex overflow-hidden rounded-2xl border-2 border-[#e7dfcf] bg-white focus-within:border-[#C9A24D] dark:border-white/10 dark:bg-[#0e0e10]">
            <span className="flex items-center border-r-2 border-[#e7dfcf] bg-[#fbf6ea] px-4 text-[15px] font-black text-gray-500 dark:border-white/10 dark:bg-[#1a1712]">openhousepal.com/</span>
            <input value={slug} onChange={e => onSlug(e.target.value)} aria-label="Your Agent Hub link" className="min-w-0 flex-1 bg-transparent px-4 py-4 text-[17px] font-bold text-[#111827] outline-none dark:text-white" />
          </div>
          <p className={`mt-2 text-[13.5px] font-bold ${slugState === 'taken' || slugState === 'error' ? 'text-rose-600' : slugState === 'ok' ? 'text-emerald-600' : 'text-gray-400'}`}>
            {slugState === 'checking' ? 'Checking...' : slugState === 'ok' ? 'Available - it switches over when you continue. Your old link keeps working.' : slugState === 'taken' ? 'That one is taken - try adding your town or a middle initial.' : slugState === 'error' ? 'We couldn’t save that link - please try another.' : 'This is your link today.'}
          </p>
        </div>
      </div>
      <a href={`/${shownSlug}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-[#C9A24D]/40 bg-white text-[15px] font-black text-[#111827] lg:hidden dark:bg-white/5 dark:text-white">Open my Agent Hub <ExternalLink className="h-4 w-4" /></a>
      <div className="hidden lg:block">
        <div className="sticky top-28"><HubPhonePreview src={`/${shownSlug}?preview=1`} look={phoneLook} label="Your Agent Hub" /></div>
      </div>
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

  if (!cfg) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  const luxe = cfg.luxe
  const metal = cfg.luxeMetal
  const colors = ACCENT_COLORS.some(c => c.color.toLowerCase() === cfg.accentColor.toLowerCase())
    ? ACCENT_COLORS
    : [{ color: cfg.accentColor, label: cfg.accentColor.toLowerCase() === DEFAULT_ACCENT.toLowerCase() ? 'Copper' : 'Yours' }, ...ACCENT_COLORS]
  const chosen = cfg.ctaButtons
  const available = FORM_BUTTON_ORDER.map(t => forms.find(f => f.form_type === t)).filter((f): f is AgentFormConfig => Boolean(f))
  const toggleButton = (f: AgentFormConfig) => update(c => {
    if (c.ctaButtons.some(b => b.formType === f.form_type)) return { ...c, ctaButtons: c.ctaButtons.filter(b => b.formType !== f.form_type) }
    if (c.ctaButtons.length >= MAX_CTA_BUTTONS) return c
    return { ...c, ctaButtons: [...c.ctaButtons, { id: `cta-${f.form_type}`, label: FORM_BUTTON_DEFAULTS[f.form_type] || f.title, formType: f.form_type, url: '', enabled: true }] }
  })
  const listings = (hub.config.myListings || []).length > 0
  const sales = (hub.config.recentSales || []).length > 0
  const full2 = chosen.length >= MAX_CTA_BUTTONS
  const socialUrls = socialUrlsFrom(hub.config)
  const socialNets = SIG_SOCIALS.filter(s => socialUrls[s.id])

  return (
    <div className="space-y-8">
      {/* the live preview stays in view while they choose */}
      <PinnedPreview>
        <SignatureDualPreview siteHtml={siteHtml} emailVersion={emailVersion} />
      </PinnedPreview>

      <div>
        <SubHead sub="Classic takes your color and font. Luxe is our premade look: serif type and a metal finish.">Style</SubHead>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard on={!luxe} onClick={() => update(c => ({ ...c, luxe: false }))} title="Classic" blurb="Your color, clean layout.">
            <div className="flex h-20 items-center gap-3 rounded-2xl bg-[#fbfaf7] px-4 dark:bg-white/[0.04]">
              <span className="h-11 w-11 shrink-0 rounded-xl" style={{ background: cfg.accentColor }} />
              <span className="flex-1 space-y-1.5"><span className="block h-2 w-24 rounded bg-[#111827] dark:bg-white" /><span className="block h-1.5 w-16 rounded bg-gray-300" /><span className="block h-3 w-20 rounded-full" style={{ background: cfg.accentColor }} /></span>
            </div>
          </ChoiceCard>
          <ChoiceCard on={luxe} onClick={() => update(c => ({ ...c, luxe: true }))} title="Luxe" blurb="Serif type and a metal finish.">
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
              <Swatches label="Finish" colors={METAL_SWATCHES} value={LUXE_METALS[metal].base} onChange={c => update(x => ({ ...x, luxeMetal: LUXE_METAL_ORDER.find(m => LUXE_METALS[m].base === c) || 'gold' }))} /></>
          : <><SubHead sub="Your buttons, icons and lines.">Color</SubHead>
              <Swatches label="Color" colors={colors} value={cfg.accentColor} onChange={c => update(x => ({ ...x, accentColor: c }))} /></>}
      </div>

      <div>
        <SubHead sub="Changes in an already-pasted signature too - nothing to re-copy.">Light or dark</SubHead>
        <div className="grid grid-cols-2 gap-3">
          {([false, true] as const).map(d => (
            <ChoiceCard key={String(d)} on={cfg.darkMode === d} onClick={() => update(c => ({ ...c, darkMode: d }))} title={luxe ? (d ? 'Midnight' : 'Ivory') : (d ? 'Dark' : 'Light')}>
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
                <button key={f.id} type="button" onClick={() => update(c => ({ ...c, fontFamily: f.id }))} aria-pressed={on}
                  className={`rounded-[18px] border-2 px-3 py-3 text-center transition ${on ? 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white shadow-[0_14px_30px_-22px_rgba(139,106,43,.85)] dark:from-[#1d1912] dark:to-[#141416]' : 'border-[#ece5d6] bg-white hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416]'}`}>
                  <span className="block text-[26px] leading-none text-[#111827] dark:text-white" style={{ fontFamily: f.stack }}>Aa</span>
                  <span className="mt-1.5 block text-[12.5px] font-black text-gray-600 dark:text-gray-300">{f.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <SubHead sub={`"My Agent Hub" always comes first. Pick up to ${MAX_CTA_BUTTONS} more - each opens that form.`}>Buttons</SubHead>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-[#111827] bg-[#111827] px-4 py-2.5 text-[14px] font-black text-white dark:border-white dark:bg-white dark:text-[#111827]"><Lock className="h-3.5 w-3.5 opacity-70" /> My Agent Hub</span>
            {available.map(f => {
              const on = chosen.some(b => b.formType === f.form_type)
              const blocked = !on && full2
              return (
                <button key={f.id} type="button" onClick={() => toggleButton(f)} aria-pressed={on} disabled={blocked} title={blocked ? `You have ${MAX_CTA_BUTTONS} - tap one to remove it first` : undefined}
                  className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-[14px] font-black transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#111827] dark:text-white' : blocked ? 'cursor-not-allowed border-dashed border-[#ece5d6] text-gray-400 dark:border-white/10' : 'border-[#ece5d6] text-gray-600 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>
                  {on && <Check className="h-4 w-4 text-[#C9A24D]" />}{FORM_BUTTON_DEFAULTS[f.form_type] || f.title}
                </button>
              )
            })}
          </div>
          {full2 && <p className="mt-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400">That&apos;s the most that fit on one line - tap one to swap it.</p>}
        </div>
      )}

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

      {/* Two separate switches: stats work with the listings & sales card off (they become a slim strip). */}
      <div className="space-y-3">
        <SubHead sub="Both update themselves - nothing to re-copy when you sell a home.">Your listings, sales & stats</SubHead>
        <BigToggle on={cfg.blockVisibility.banner} onChange={v => update(c => ({ ...c, blockVisibility: { banner: v } }))} title="Show my listings & recent sales" blurb={listings || sales ? 'Your newest listing - or your recent sales - under your name, with a photo.' : 'Add a listing or recent sale first - then this shows them.'} />
        <BigToggle on={cfg.banner.showStats} onChange={v => update(c => ({ ...c, banner: { ...c.banner, showStats: v } }))} title="Show my sales stats" blurb={sales ? 'Homes sold, total volume and average price.' : 'Add your recent sales first - then your numbers show here.'} />
      </div>

      <div className="rounded-[22px] border-2 border-[#C9A24D]/40 bg-[#fbf6ea] p-5 dark:bg-[#1a1712]">
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
      </div>
    </div>
  )
}
