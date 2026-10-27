'use client'

// Studio -> Branding (owner 10/24: "make it a theme center"). Three parts, all painted live in the
// agent's brand look:
//   1. BrandColorStage - pick the brand color (BrandLookPicker) beside "Where it shows": every
//      feature with whether it wears the brand right now, and "Use this color for all features".
//   2. FeatureShowcase - every feature drawn in that color at once (computer: one bento wall to
//      compare side by side; phone: a swipe carousel). Tap one for a bigger look (a slide-up sheet
//      on phones) and a link straight to it.
//   3. BrandColorDock - phones: once the picker scrolls away, the palette rides along the bottom
//      so the color can be changed while looking at the features.
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, ClipboardList, Globe, Link2, Loader2, Mail, Megaphone, Palette, PartyPopper, Sparkles, Wand2 } from 'lucide-react'
import type { BrandKit, BrandUsage } from '@/types'
import { BRAND_COLOR_GROUPS, BRAND_FINISHES, brandColorName, modeLabel, type BrandKitPatch, type BrandLook } from '@/lib/brandKit'
import { LUXE_METALS } from '@/lib/luxeMetals'
import BrandLookPicker from '@/components/studio/BrandLookPicker'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { SpotlightIcon } from '@/components/icons/CustomIcons'
import { useOptionalAuth } from '@/contexts/AuthContext'
import { hasAgentHubAccess, hasEmailSignatureAccess, hasMlsAccess, hasStudioDesignAccess } from '@/lib/navAccess'
import type { DesignAgentInfo } from '@/lib/studio/designAgent'
import { FeaturePreview, FitStage, paintOf, PREVIEW_SIZE, type FeatureId, type Person } from './FeaturePreviews'

type Tone = 'ok' | 'warn' | 'off'
type FeatureDef = { id: FeatureId; label: string; blurb: string; href: string; icon: React.ComponentType<{ className?: string }>; how: string }

export const BRAND_FEATURES: FeatureDef[] = [
  { id: 'hub', label: 'Agent Hub', blurb: 'Your one-page site', href: '/studio/site', icon: Link2, how: 'Your Agent Hub wears your brand while "Look comes from" is set to My Brand Kit.' },
  { id: 'idx', label: 'IDX Website', blurb: 'Your home-search site', href: '/studio/website?tab=design', icon: Globe, how: 'Your website follows your brand while its Theme is on My Brand Kit - no republish needed.' },
  { id: 'forms', label: 'Forms', blurb: 'Buyer, seller & home-value', href: '/studio/site?tab=forms', icon: ClipboardList, how: 'Every form on My Brand Kit changes with it.' },
  { id: 'signature', label: 'Email Signature', blurb: 'In every email you send', href: '/studio/email-signature', icon: Mail, how: 'Your signature follows your brand while it is on My Brand Kit. Already installed? Copy it into your email again after a change.' },
  { id: 'invites', label: 'Invites', blurb: 'Open house & event invitations', href: '/studio/site?tab=forms&view=invites', icon: PartyPopper, how: 'New invitations start in your brand color, and live ones made in it change with it.' },
  { id: 'spotlight', label: 'Listing Spotlight', blurb: 'A site for each listing', href: '/studio/property-sites', icon: SpotlightIcon as unknown as React.ComponentType<{ className?: string }>, how: 'Every Spotlight page always uses your brand color.' },
  { id: 'designs', label: 'Studio Designs', blurb: 'Flyers, posts & mailers', href: '/studio/design', icon: Palette, how: 'Designs set to the "Brand" color theme use your brand color on your print background.' },
]

/** The status line under each feature. */
export function featureStatus(id: FeatureId, u: BrandUsage | null, idxPlan: boolean): { tone: Tone; text: string; switchable: boolean } {
  if (!u) return { tone: 'off', text: '…', switchable: false }
  switch (id) {
    case 'hub': return u.hub.follows ? { tone: 'ok', text: 'Uses your brand', switchable: false } : { tone: 'warn', text: 'Its own look', switchable: true }
    case 'signature': return u.signature.follows ? { tone: 'ok', text: 'Uses your brand', switchable: false } : { tone: 'warn', text: 'Its own look', switchable: true }
    case 'idx':
      if (!idxPlan) return { tone: 'off', text: 'With the IDX plan', switchable: false }
      if (!u.idx.exists) return { tone: 'off', text: 'Not set up yet', switchable: false }
      return u.idx.follows ? { tone: 'ok', text: 'Uses your brand', switchable: false } : { tone: 'warn', text: 'Its own look', switchable: true }
    case 'forms':
      if (!u.forms.total) return { tone: 'off', text: 'No forms yet', switchable: false }
      return u.forms.follows >= u.forms.total ? { tone: 'ok', text: `All ${u.forms.total} forms`, switchable: false } : { tone: 'warn', text: `${u.forms.follows} of ${u.forms.total} forms`, switchable: true }
    case 'invites':
      if (!u.invites.total) return { tone: 'ok', text: 'New invites start in it', switchable: false }
      return u.invites.follows >= u.invites.total ? { tone: 'ok', text: `All ${u.invites.total} live invites`, switchable: false } : { tone: 'warn', text: `${u.invites.follows} of ${u.invites.total} live invites`, switchable: true }
    case 'spotlight': return { tone: 'ok', text: u.spotlight.total ? `All ${u.spotlight.total} pages` : 'Always your brand', switchable: false }
    case 'designs': return { tone: u.designs.brand ? 'ok' : 'off', text: u.designs.brand ? `${u.designs.brand} on the Brand theme` : 'Pick "Brand" in a design', switchable: false }
  }
}

const TONE: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  off: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-white/[0.06] dark:text-white/50 dark:ring-white/10',
}

export function StatusPill({ tone, text, className = '' }: { tone: Tone; text: string; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${TONE[tone]} ${className}`}>
      {tone === 'ok' ? <Check className="h-2.5 w-2.5 shrink-0" strokeWidth={3.5} /> : <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'warn' ? 'bg-amber-500' : 'bg-gray-400'}`} />}
      <span className="truncate">{text}</span>
    </span>
  )
}

/** CSS for the color easing on every preview + the orb's slow spin. Render once. */
export const BRANDING_CSS = `.bc-tint *{transition:background-color .5s ease,color .5s ease,border-color .5s ease,box-shadow .5s ease}
@keyframes bcSpin{to{transform:rotate(360deg)}}.bc-spin{animation:bcSpin 9s linear infinite}
@media (prefers-reduced-motion:reduce){.bc-spin{animation:none}.bc-tint *{transition:none}}`

// ---------------------------------------------------------------------------------------------
// 1. The color + "where it shows"
// ---------------------------------------------------------------------------------------------
export function BrandColorStage({ kit, look, luxeAllowed, onChange, usage, idxPlan, onApplied, applyAll, pickerRef }: {
  kit: BrandKit
  look: BrandLook
  luxeAllowed: boolean
  onChange: (patch: BrandKitPatch) => void
  usage: BrandUsage | null
  idxPlan: boolean
  onApplied: (u: BrandUsage) => void
  applyAll: () => Promise<BrandUsage | null>
  pickerRef?: React.Ref<HTMLElement>
}) {
  const p = paintOf(look)
  const name = look.theme === 'luxe' ? `Luxe ${LUXE_METALS[look.metal].label}` : brandColorName(look.accent) || 'Your color'
  const hex = look.theme === 'luxe' ? LUXE_METALS[look.metal].base : look.accent
  // No-MLS plans: only list what their plan has (no Agent Hub / Signature / Studio on plain No-MLS,
  // never IDX or Spotlight) - "Every feature already uses it" must be about THEIR features.
  const planTier = useOptionalAuth()?.user?.plan_tier
  const noMls = !!planTier && !hasMlsAccess(planTier)
  const onPlan = (id: FeatureId) => !noMls
    || (id === 'hub' ? hasAgentHubAccess(planTier) : id === 'signature' ? hasEmailSignatureAccess(planTier) : id === 'designs' ? hasStudioDesignAccess(planTier) : id !== 'idx' && id !== 'spotlight')
  const statuses = BRAND_FEATURES.filter(f => onPlan(f.id)).map(f => ({ f, s: featureStatus(f.id, usage, idxPlan) }))
  const toSwitch = statuses.filter(x => x.s.switchable)
  const [confirm, setConfirm] = useState(false)
  const [applying, setApplying] = useState(false)
  const [justApplied, setJustApplied] = useState(false)
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6">
      {/* the color */}
      <section ref={pickerRef} className="relative overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-[0_20px_44px_-34px_rgba(139,115,85,.6)] dark:border-white/[0.08] dark:bg-[#151517]" data-testid="brand-look-section">
        <div className="bc-tint relative flex items-center gap-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-5" style={{ background: p.page }}>
          {/* the orb: the brand color with a slow metal / color halo; it pulses when the color changes */}
          <div className="relative grid h-16 w-16 shrink-0 place-items-center sm:h-20 sm:w-20">
            <span className="bc-spin absolute inset-0 rounded-full opacity-80" style={{ background: p.luxe ? `conic-gradient(${p.m.deep}, ${p.m.light}, ${p.m.base}, ${p.m.pale}, ${p.m.deep})` : `conic-gradient(${hex}, ${hex}55, ${hex}, ${hex}22, ${hex})` }} />
            <span className="absolute inset-[3px] rounded-full" style={{ background: p.dark ? '#111113' : '#FFFFFF' }} />
            <AnimatePresence>
              <motion.span key={hex + look.theme} initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-2 rounded-full" style={{ background: p.fill }} />
            </AnimatePresence>
            <motion.span layout key={`dot-${hex}`} initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              className="relative h-11 w-11 rounded-full shadow-[inset_0_2px_6px_rgba(255,255,255,.35),0_10px_24px_-10px_rgba(0,0,0,.55)] sm:h-14 sm:w-14" style={{ background: p.fill }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: p.text }}>Your brand color</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}
                className="truncate font-serif text-2xl font-black leading-tight sm:text-3xl" style={{ color: p.ink }} data-testid="brand-look-name">{name}</motion.p>
            </AnimatePresence>
            <p className="text-[11px] font-bold" style={{ color: p.sub }}>{look.theme === 'luxe' ? 'Luxe' : 'Classic'} · {modeLabel(look.dark)} · <span className="uppercase">{hex}</span></p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <BrandLookPicker kit={kit} luxeAllowed={luxeAllowed} onChange={onChange} />
        </div>
      </section>

      {/* where it shows */}
      <section className="relative flex flex-col overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(140deg,#fffdf8_0%,#fbf6ec_60%,#f6eddb_100%)] p-4 shadow-[0_20px_44px_-34px_rgba(139,115,85,.6)] dark:border-white/[0.08] dark:bg-[radial-gradient(120%_120%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(140deg,#0b0f0e_0%,#111827_60%,#1d1810_100%)] sm:p-6" data-testid="brand-usage">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">Where it shows</p>
        <h2 className="mt-1 font-serif text-xl font-black text-[#111827] dark:text-white">Your features <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">at a glance</em></h2>
        <ul className="mt-3 divide-y divide-[#C9A24D]/15 dark:divide-white/[0.06]">
          {statuses.map(({ f, s }, i) => (
            <motion.li key={f.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-3 py-2">
              <span className="bc-tint relative grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ background: s.tone === 'ok' ? p.fill : s.tone === 'warn' ? '#d6d0c4' : '#e8e5df', color: s.tone === 'ok' ? p.fillInk : '#6b6b6b' }}>
                <f.icon className="h-4 w-4" />
              </span>
              <Link href={f.href} className="min-w-0 flex-1 text-sm font-black text-[#111827] hover:underline dark:text-white">{f.label}</Link>
              <motion.span key={s.text} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }} className="min-w-0 shrink">
                <StatusPill tone={s.tone} text={s.text} />
              </motion.span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <p className="mb-3 flex items-start gap-2 rounded-2xl bg-white/60 px-3 py-2.5 text-[11px] font-semibold leading-snug text-gray-600 ring-1 ring-[#C9A24D]/15 dark:bg-white/[0.04] dark:text-white/60 dark:ring-white/[0.06]">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
            Everything marked “Uses your brand” changes the moment you pick a new color - no saving or republishing.
          </p>
          <button type="button" data-testid="brand-apply-all" disabled={!usage || applying || !toSwitch.length} onClick={() => setConfirm(true)}
            className="lx-shine relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] px-4 py-3.5 text-sm font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:cursor-default disabled:from-emerald-500 disabled:via-emerald-500 disabled:to-emerald-400 disabled:text-white disabled:shadow-emerald-500/20 disabled:hover:translate-y-0">
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : !toSwitch.length && usage ? <Check className="h-4 w-4" strokeWidth={3} /> : <Wand2 className="h-4 w-4" />}
            {!toSwitch.length && usage ? (justApplied ? 'Done - every feature uses it' : 'Every feature already uses it') : 'Use this color for all features'}
          </button>
          {!!toSwitch.length && <p className="mt-2 text-center text-[11px] font-semibold text-gray-500 dark:text-white/50">{toSwitch.length} {toSwitch.length === 1 ? 'feature has' : 'features have'} {toSwitch.length === 1 ? 'its' : 'their'} own look right now.</p>}
        </div>
      </section>

      <OhSheet open={confirm} onClose={() => setConfirm(false)} width="max-w-md" title="Use it everywhere?" subtitle={`${name} on every feature`} icon={<Wand2 className="h-5 w-5" />}
        footer={
          <button type="button" data-testid="brand-apply-confirm" disabled={applying}
            onClick={async () => {
              setApplying(true)
              const u = await applyAll()
              setApplying(false)
              setConfirm(false)
              if (u) { onApplied(u); setJustApplied(true) }
            }}
            className="lx-shine relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] py-3.5 text-[15px] font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 active:scale-[0.98]">
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Use my brand everywhere
          </button>
        }>
        <div className="space-y-3 p-5">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">These switch back to <b className="text-[#111827] dark:text-white">My Brand Kit</b> - their own color choices are replaced by your brand look:</p>
          <ul className="space-y-1.5">
            {toSwitch.map(({ f, s }) => (
              <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
                <f.icon className="h-4 w-4 shrink-0 text-[#8b7355]" />
                <span className="min-w-0 flex-1 text-sm font-black text-[#111827] dark:text-white">{f.label}</span>
                <StatusPill tone={s.tone} text={s.text} />
              </li>
            ))}
          </ul>
          <p className="text-[11px] font-semibold text-gray-400">You can still give any one of them its own look later, in that feature.</p>
        </div>
      </OhSheet>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// 2. Every feature in the color
// ---------------------------------------------------------------------------------------------
const BENTO: Record<FeatureId, string> = {
  idx: 'lg:col-span-2', hub: '', forms: '', signature: '', invites: '', spotlight: 'lg:col-span-2', designs: '',
}
const ORDER: FeatureId[] = ['idx', 'hub', 'forms', 'signature', 'invites', 'spotlight', 'designs']

export function FeatureShowcase({ kit, look, usage, idxPlan, person, agent }: {
  kit: BrandKit; look: BrandLook; usage: BrandUsage | null; idxPlan: boolean; person: Person; agent: DesignAgentInfo
}) {
  const [open, setOpen] = useState<FeatureId | null>(null)
  // null until measured, then true from 1024px up
  const [wide, setWide] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setWide(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [last, setLast] = useState<FeatureId>('idx')
  useEffect(() => { if (open) setLast(open) }, [open])
  const feature = (id: FeatureId) => BRAND_FEATURES.find(f => f.id === id)!
  const shown = feature(open || last)
  // phone carousel: which card is centred
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const onScroll = () => {
    const el = railRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const i = Math.round(el.scrollLeft / (card.offsetWidth + 12))
    setActive(Math.max(0, Math.min(ORDER.length - 1, i)))
  }
  const go = (i: number) => {
    const el = railRef.current
    const card = el?.children[i] as HTMLElement | undefined
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 16, behavior: 'smooth' })
  }
  const card = (id: FeatureId, i: number, phone: boolean) => {
    const f = feature(id)
    const s = featureStatus(id, usage, idxPlan)
    const [w, h] = PREVIEW_SIZE[id]
    return (
      <motion.button key={id} type="button" onClick={() => setOpen(id)} data-testid={`brand-feature-${id}`}
        initial={{ opacity: 0, y: 18 }} {...(phone ? { animate: { opacity: 1, y: 0 } } : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.15 } })} transition={{ delay: phone ? Math.min(i, 2) * 0.08 : (i % 3) * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`group relative flex flex-col overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white text-left shadow-[0_20px_44px_-34px_rgba(139,115,85,.6)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#C9A24D]/60 hover:shadow-[0_28px_56px_-30px_rgba(201,162,77,.75)] dark:border-white/[0.08] dark:bg-[#151517] ${phone ? 'w-[80vw] max-w-[340px] shrink-0 snap-center' : BENTO[id]}`}>
        <div className={`bc-tint relative ${phone ? 'h-[230px]' : 'h-[260px]'} bg-[radial-gradient(90%_90%_at_50%_0%,#fbf6ec,#efe9dd)] dark:bg-[radial-gradient(90%_90%_at_50%_0%,#1d1b17,#0e0e10)]`}>
          <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
            <FitStage w={w} h={h} pad={0.86}><FeaturePreview id={id} look={look} kit={kit} person={person} agent={agent} /></FitStage>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[#C9A24D]/15 px-4 py-3 dark:border-white/[0.06]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/30"><f.icon className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-[15px] font-black text-[#111827] dark:text-white">{f.label}</span>
            <span className="block truncate text-[11px] font-semibold text-gray-500 dark:text-white/50">{f.blurb}</span>
          </span>
          <StatusPill tone={s.tone} text={s.text} className="max-w-[46%]" />
        </div>
      </motion.button>
    )
  }
  const s = featureStatus(shown.id, usage, idxPlan)
  const [bw, bh] = PREVIEW_SIZE[shown.id]
  return (
    <section className="mt-8" data-testid="brand-showcase">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">See it everywhere</p>
          <h2 className="mt-1 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">Every feature, <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">in your color</em></h2>
          <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-white/55">Change the color above - they all change with it. Tap one for a closer look.</p>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex lg:hidden">
          <button type="button" aria-label="Previous" onClick={() => go(Math.max(0, active - 1))} className="grid h-9 w-9 place-items-center rounded-full border border-[#C9A24D]/30 bg-white text-[#8b7355] dark:bg-white/5"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" aria-label="Next" onClick={() => go(Math.min(ORDER.length - 1, active + 1))} className="grid h-9 w-9 place-items-center rounded-full border border-[#C9A24D]/30 bg-white text-[#8b7355] dark:bg-white/5"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* computer: the whole wall at once (only one of the two layouts is ever drawn) */}
      {wide && <div className="grid grid-cols-3 gap-4">{ORDER.map((id, i) => card(id, i, false))}</div>}

      {/* phone / tablet: swipe through */}
      {wide === false && <div>
        <div ref={railRef} onScroll={onScroll} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ORDER.map((id, i) => card(id, i, true))}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {ORDER.map((id, i) => (
            <button key={id} type="button" aria-label={feature(id).label} onClick={() => go(i)} className="p-1">
              <motion.span animate={{ width: i === active ? 20 : 6, opacity: i === active ? 1 : 0.4 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="block h-1.5 rounded-full bg-[#C9A24D]" />
            </button>
          ))}
        </div>
      </div>}

      <OhSheet open={!!open} onClose={() => setOpen(null)} width="max-w-2xl" title={shown.label} subtitle={shown.blurb} icon={<shown.icon className="h-5 w-5" />}
        badge={<StatusPill tone={s.tone} text={s.text} />}
        footer={
          <Link href={shown.href} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] py-3.5 text-[15px] font-black text-white shadow-lg active:scale-[0.98] dark:bg-white dark:text-[#111827]">
            Open {shown.label} <ArrowUpRight className="h-4 w-4" />
          </Link>
        }>
        <div className="bc-tint h-[min(52dvh,420px)] bg-[radial-gradient(90%_90%_at_50%_0%,#fbf6ec,#efe9dd)] dark:bg-[radial-gradient(90%_90%_at_50%_0%,#1d1b17,#0e0e10)]">
          <FitStage w={bw} h={bh} pad={0.9}><FeaturePreview id={shown.id} look={look} kit={kit} person={person} agent={agent} /></FitStage>
        </div>
        <p className="flex items-start gap-2 px-5 py-4 text-[13px] font-semibold leading-relaxed text-gray-600 dark:text-gray-300">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A24D]" /> {shown.how}
        </p>
      </OhSheet>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------
// 3. Phones: the palette rides along the bottom while you look at the features
// ---------------------------------------------------------------------------------------------
export function BrandColorDock({ look, luxeAllowed, onChange, show }: { look: BrandLook; luxeAllowed: boolean; onChange: (patch: BrandKitPatch) => void; show: boolean }) {
  const luxe = look.theme === 'luxe' && luxeAllowed
  const colors = useMemo(() => BRAND_COLOR_GROUPS.flat(), [])
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="dock" initial={{ y: 120 }} animate={{ y: 0, transition: { type: 'spring', stiffness: 380, damping: 36 } }} exit={{ y: 120, transition: { duration: 0.2 } }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#C9A24D]/25 bg-white/[0.97] pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_40px_-24px_rgba(17,24,39,.5)] dark:border-white/10 dark:bg-[#111113]/[0.97] lg:hidden" data-testid="brand-color-dock">
          <p className="px-4 text-[9px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">{luxe ? 'Finish' : 'Brand color'} · <span className="normal-case tracking-normal text-gray-500">{luxe ? LUXE_METALS[look.metal].label : brandColorName(look.accent) || 'Custom'}</span></p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {luxe
              ? BRAND_FINISHES.map(f => {
                  const on = look.metal === f.id
                  return (
                    <button key={f.id} type="button" onClick={() => onChange({ look: { metal: f.id } })} aria-label={f.label}
                      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-4 text-xs font-black text-[#111827] transition ${on ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 dark:ring-offset-[#111113]' : ''}`}
                      style={{ background: `linear-gradient(115deg, ${f.palette.deep}, ${f.palette.base} 35%, ${f.palette.pale} 52%, ${f.palette.light} 62%, ${f.palette.deep})` }}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}{f.label}</button>
                  )
                })
              : colors.map(c => {
                  const on = c.color.toUpperCase() === look.accent.toUpperCase()
                  return (
                    <motion.button key={c.color} type="button" whileTap={{ scale: 0.88 }} onClick={() => onChange({ secondary_color: c.color })} aria-label={c.label}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${on ? 'ring-[3px] ring-[#C9A24D] ring-offset-2 dark:ring-offset-[#111113]' : 'ring-1 ring-black/10'}`} style={{ background: c.color }}>
                      {on && <Check className="h-4 w-4 text-white mix-blend-difference" strokeWidth={3.5} />}
                    </motion.button>
                  )
                })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}


