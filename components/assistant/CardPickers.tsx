'use client'

// The pieces that make each helper card feel like the feature it's making (owner, 11/01): the
// feature's own icon (with a gold sweep while it works), small live previews of what's being picked
// (a design, the brand look, a Spotlight's front page), and taps instead of chat questions (a CMA's
// AI or manual, a form's background and home). Every preview draws with the app's real renderers.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Bell, CalendarCheck, Check, ChevronDown, ClipboardList, Globe, Handshake, Home, Image as ImageIcon, LifeBuoy, Mail, MapPin, MessageSquare,
  Newspaper, Palette, PartyPopper, Settings2, Sparkles, Star, UserRound, X, type LucideIcon,
} from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import type { BrandKit, LinkedProperty } from '@/types'
import StyleThumbnail from '@/components/studio/design/StyleThumbnail'
import { FeaturePreview, FitStage, paintOf } from '@/components/studio/branding/FeaturePreviews'
import { getSituation } from '@/lib/studio/designSituations'
import { getTemplatesFor, isCompositionReady } from '@/lib/studio/designTemplates'
import { designAgentFrom, SAMPLE_DESIGN_AGENT } from '@/lib/studio/designAgent'
import { fetchLinkedProperty } from '@/components/studio/PropertySelector'
import { BRAND_COLORS, type BrandLook } from '@/lib/brandKit'
import type { SetupStep } from '@/components/property-sites/spotlight/autoSetup'
import { OhpBot } from './OhpBot'

// ---------------------------------------------------------------- the feature's icon
const ICONS: Record<string, LucideIcon> = {
  create_design: ImageIcon, update_branding: Palette, create_invite: PartyPopper, create_showcase: Sparkles,
  update_showcase_search: Sparkles, set_showcase: Sparkles, add_home_to_showcase: Sparkles, resend_showcase_invite: Sparkles,
  confirm_showcase_tour: CalendarCheck, reply_to_showcase_comment: MessageSquare, create_spotlight: Star, publish_spotlight: Star,
  create_form: ClipboardList, write_blog_post: Newspaper, start_cma: BarChart3, update_email_settings: Mail,
  update_profile: UserRound, set_website_on: Globe, add_town: MapPin, create_followup: Bell, update_followup: Bell,
  set_followup_rules: Bell, open_help_ticket: LifeBuoy, update_review_settings: Star, answer_host_request: Handshake,
  ask_team_to_host: Handshake, request_to_host: Handshake, answer_suggested_host_time: Handshake,
}
const iconFor = (tool: string): LucideIcon =>
  ICONS[tool] || (/open_house|guest|similar/.test(tool) ? Home : /lead/.test(tool) ? UserRound : /setting|switch|alert/.test(tool) ? Settings2 : Sparkles)

/** The card's feature icon: gold tile, a sweep while it's working, a pop + check when it's done. */
export function CardIcon({ tool, state }: { tool: string; state: 'idle' | 'live' | 'done' | 'off' }) {
  const Icon = iconFor(tool)
  return (
    <span className={`ohp-ai-icon relative grid h-10 w-10 shrink-0 place-items-center rounded-xl ${state === 'live' ? 'ohp-ai-icon-live' : ''} ${state === 'done' ? 'ohp-ai-icon-pop' : ''}`}>
      <span className={`absolute inset-0 rounded-xl ${state === 'off' ? 'bg-gray-100 dark:bg-zinc-800' : 'bg-gradient-to-br from-[#1b1a17] via-[#2a2218] to-[#111827] shadow-[0_6px_16px_-6px_rgba(139,115,85,.6)] ring-1 ring-[#C9A24D]/40'}`} />
      <Icon className={`relative h-[18px] w-[18px] ${state === 'off' ? 'text-gray-400' : 'text-[#e8c97a]'}`} strokeWidth={2.2} />
      {state === 'done' && (
        <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-zinc-900">
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        </span>
      )}
    </span>
  )
}

const label = 'mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]'
const chip = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
  ? 'border-[#111827] bg-[#111827] text-white dark:border-[#C9A24D] dark:bg-[#C9A24D] dark:text-[#111827]'
  : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`

// ---------------------------------------------------------------- steps that fold away
// A card's choices as steps (owner, 11/01: "be smart and conserve space"): one open at a time; a
// pick shows for a moment, then that step folds to one line with what was picked and the next
// opens. Tapping a folded line opens it again.
export function useSteps(ids: string[]) {
  const key = ids.join('|')
  const [open, setOpen] = useState<string | null>(ids[0] ?? null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  // A step that went away (e.g. no photos to pick) never stays the open one.
  useEffect(() => { setOpen(o => (o && !ids.includes(o) ? ids[0] ?? null : o)) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const picked = (id: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const i = ids.indexOf(id)
      setOpen(o => (o === id ? ids[i + 1] ?? null : o))
    }, 450)
  }
  const toggle = (id: string) => { if (timer.current) clearTimeout(timer.current); setOpen(o => (o === id ? null : id)) }
  return { open, picked, toggle, isOpen: (id: string) => open === id }
}

export function CardStep({ id, n, title, summary, steps, children }: {
  id: string; n: number; title: string; summary?: React.ReactNode; steps: ReturnType<typeof useSteps>; children: React.ReactNode
}) {
  const open = steps.isOpen(id)
  return (
    <div className={`rounded-xl transition-colors ${open ? 'bg-white shadow-sm ring-1 ring-[#C9A24D]/35 dark:bg-zinc-900' : 'bg-white/60 ring-1 ring-black/5 dark:bg-zinc-900/50 dark:ring-white/10'}`}
      data-testid={`ai-step-${id}`} data-open={open ? 'yes' : 'no'}>
      <button type="button" onClick={() => steps.toggle(id)} aria-expanded={open} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${open ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-[#C9A24D] text-white'}`}>
          {open ? n : <Check className="h-3 w-3" strokeWidth={3.5} />}
        </span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">{title}</span>
        <span className={`ml-auto min-w-0 truncate text-xs font-bold text-[#111827] transition-opacity dark:text-white ${open ? 'opacity-0' : 'opacity-100'}`}>{summary}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-2.5 pb-2.5">{children}</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the agent, once per card
function useAgentBits() {
  const { user } = useAuth()
  const [hub, setHub] = useState<any>(null)
  const [kit, setKit] = useState<BrandKit | null>(null)
  useEffect(() => {
    let live = true
    api.agentHub.getMine().then(r => { if (live && r.success) setHub(r.data) }).catch(() => {})
    api.studio.getBrandKit().then(r => { if (live && r.success && r.data) setKit(r.data) }).catch(() => {})
    return () => { live = false }
  }, [])
  const agent = useMemo(() => (user ? designAgentFrom(user, hub) : SAMPLE_DESIGN_AGENT), [user, hub])
  return { user, agent, kit }
}

// ---------------------------------------------------------------- a design, as it will look
/** The listing a design is about (null when the design isn't about a home; undefined while loading). */
export function useDesignProperty(payload: Record<string, any>) {
  const [property, setProperty] = useState<LinkedProperty | null | undefined>(undefined)
  const situation = getSituation(payload.situation)
  useEffect(() => {
    if (!situation?.propertyAttached) { setProperty(null); return }
    let live = true
    fetchLinkedProperty(payload.address || '', undefined, payload.listing_key || undefined).then(r => { if (live) setProperty(r.property || null) })
    return () => { live = false }
  }, [payload.address, payload.listing_key, situation?.propertyAttached])
  return property
}

export function DesignLivePreview({ payload, layout, colors, property, photo }: {
  payload: Record<string, any>; layout: string | null; colors: string; property: LinkedProperty | null | undefined; photo?: string | null
}) {
  const { agent, kit } = useAgentBits()
  const situation = getSituation(payload.situation)
  const templates = getTemplatesFor(payload.situation, payload.format).filter(t => isCompositionReady(t.composition))
  const template = templates.find(t => t.composition === layout) || templates[0]
  if (!template || property === undefined) {
    return <div className="ohp-skeleton mx-auto h-[170px] w-[136px] rounded-lg" />
  }
  return (
    <div className="mx-auto w-[150px] overflow-hidden rounded-lg shadow-[0_10px_24px_-12px_rgba(0,0,0,.45)] ring-1 ring-black/10" data-testid="ai-design-preview">
      <StyleThumbnail designType={payload.format} styleId="modern_luxury" colorMode={colors as any} templateId={template.id} situation={payload.situation}
        property={situation?.propertyAttached ? property : null} agent={agent} brandKit={kit}
        messaging={payload.headline ? { id: 'custom', headline: String(payload.headline) } as any : undefined}
        buildOptions={{ openHouseDate: payload.open_house_date ? new Date(`${payload.open_house_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : undefined,
          openHouseTime: payload.start_time || undefined, priceMode: 'listing', heroPhoto: photo || undefined } as any} rounded={false} />
    </div>
  )
}

// ---------------------------------------------------------------- the brand look on their own pages
export function BrandLivePreview({ picks }: { picks: { theme: string; metal: string; dark: boolean; secondary_color: string } }) {
  const { user, agent, kit } = useAgentBits()
  const look: BrandLook = { theme: picks.theme as any, metal: picks.metal as any, dark: picks.dark, accent: picks.secondary_color, primary: '#111827', saved: true }
  const person = {
    name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Your Name', title: user?.professional_title || 'Realtor',
    brokerage: user?.brokerage || '', photo: user?.photo_url || null, phone: '', email: user?.email || '',
  }
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="ai-brand-preview">
      {(['hub', 'forms'] as const).map(id => (
        <div key={id} className="overflow-hidden rounded-xl bg-[#f3efe6] dark:bg-zinc-800/70">
          <div className="h-[150px]"><FitStage w={150} h={290} pad={0.92}><FeaturePreview id={id} look={look} kit={kit} person={person} agent={agent} /></FitStage></div>
          <p className="pb-1.5 text-center text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{id === 'hub' ? 'Your Agent Hub' : 'Your forms'}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- a Spotlight's front page
export type SpotlightPicks = { template_id: string; brand_color: string }
const SPOT_COLORS = BRAND_COLORS.slice(0, 14)

export function SpotlightPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: SpotlightPicks; onPicks: (p: SpotlightPicks) => void }) {
  const pv = (payload.preview || {}) as Record<string, any>
  const luxe = picks.template_id === 'cinematic_luxury'
  const color = picks.brand_color
  const look: BrandLook = { theme: 'classic', metal: 'gold', dark: luxe, accent: color, primary: '#111827', saved: true }
  const p = paintOf(look)
  const price = pv.price ? `$${Math.round(pv.price).toLocaleString()}` : ''
  const facts = [pv.beds && `${pv.beds} bd`, pv.baths && `${pv.baths} ba`, pv.sqft && `${Math.round(pv.sqft).toLocaleString()} sq ft`].filter(Boolean).join(' · ')
  const changed = color.toLowerCase() !== String(pv.brand_color || '').toLowerCase()
  const steps = useSteps(['look', 'color'])
  const colorName = SPOT_COLORS.find(c => c.color.toLowerCase() === color.toLowerCase())?.label || 'Your color'
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-spotlight-pick">
      {/* the front page, small: their photo, address and price, in the look + color picked */}
      <div className={`relative h-[150px] overflow-hidden rounded-xl ring-1 ring-black/10 ${luxe ? 'bg-[#0d0d0f]' : 'bg-[#f7f3ea]'}`}>
        {pv.photo && <img src={resolveMediaUrl(pv.photo)} alt="" className={`absolute inset-0 h-full w-full object-cover ${luxe ? '' : 'h-[62%]'}`} />}
        <div className={`absolute inset-0 ${luxe ? 'bg-gradient-to-t from-black/85 via-black/25 to-black/5' : 'bg-gradient-to-t from-[#f7f3ea] via-[#f7f3ea]/10 to-transparent'}`} />
        <span className="absolute left-2.5 top-2 text-[8px] font-black uppercase tracking-[0.24em]" style={{ color: luxe ? 'rgba(255,255,255,.8)' : '#172522' }}>Spotlight</span>
        <div className="absolute bottom-2.5 left-2.5 right-2.5">
          <span className="inline-block rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em]" style={{ background: p.color, color: p.fillInk }}>For sale</span>
          <p className="mt-1 truncate text-[17px] leading-tight" style={{ fontFamily: 'Georgia, serif', color: luxe ? '#fff' : '#172522', fontStyle: luxe ? 'normal' : 'italic' }}>{pv.address || 'Your listing'}</p>
          <p className="truncate text-[9px] font-semibold" style={{ color: luxe ? 'rgba(255,255,255,.72)' : 'rgba(23,37,34,.65)' }}>{[pv.city, facts].filter(Boolean).join(' · ')}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[14px] font-black" style={{ color: luxe ? color : '#172522' }}>{price}</span>
            <span className="rounded-full px-2.5 py-1 text-[8px] font-black" style={{ background: p.fill, color: p.fillInk }}>Book a tour</span>
          </div>
        </div>
      </div>
      <CardStep id="look" n={1} title="Look" summary={luxe ? 'Luxe' : 'Editorial'} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {[['cinematic_luxury', 'Luxe'], ['editorial_estate', 'Editorial']].map(([id, name]) => (
            <button key={id} type="button" onClick={() => { onPicks({ ...picks, template_id: id }); steps.picked('look') }} aria-pressed={picks.template_id === id} className={chip(picks.template_id === id)}>{name}</button>
          ))}
        </div>
      </CardStep>
      <CardStep id="color" n={2} title="Color" steps={steps}
        summary={<span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: color }} />{colorName}</span>}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] justify-items-center gap-1.5">
          {SPOT_COLORS.map(c => {
            const on = c.color.toLowerCase() === color.toLowerCase()
            return (
              <button key={c.color} type="button" title={c.label} aria-label={c.label} aria-pressed={on} onClick={() => { onPicks({ ...picks, brand_color: c.color }); steps.picked('color') }}
                className={`ohp-ai-press grid h-7 w-7 place-items-center rounded-full ring-1 ring-black/10 ${on ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`} style={{ background: c.color }}>
                {on && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </CardStep>
      {changed && <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">This is your brand color - your hub, forms and website change with it.</p>}
    </div>
  )
}

// ---------------------------------------------------------------- a CMA: who it's for, then AI or manual
// Two taps as steps (owner, 11/01: "it should have asked first, buyer or seller, as a clickable option").
export function CmaPick({ payload, ai, onAi, mode, onMode }: { payload: Record<string, any>; ai: boolean; onAi: (v: boolean) => void; mode: string; onMode: (m: string) => void }) {
  const pct = typeof payload.ai_percent === 'number' ? payload.ai_percent : null
  const steps = useSteps(['who', 'how'])
  const opt = (on: boolean) => `ohp-ai-press flex w-full items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors ${on
    ? 'border-[#C9A24D] bg-white shadow-sm dark:bg-zinc-900' : 'border-transparent bg-white/60 hover:border-[#C9A24D]/40 dark:bg-zinc-900/60'}`
  const dot = (on: boolean) => `mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D]' : 'border-gray-300 dark:border-zinc-600'}`
  const choice = (on: boolean, title: string, sub: string, onClick: () => void, testId: string) => (
    <button type="button" onClick={onClick} aria-pressed={on} className={opt(on)} data-testid={testId}>
      <span className={dot(on)}>{on && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-black text-[#111827] dark:text-white">{title}</span>
        <span className="block text-[11px] font-semibold leading-snug text-gray-500 dark:text-zinc-400">{sub}</span>
      </span>
    </button>
  )
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-cma-pick">
      <CardStep id="who" n={1} title="Who it's for" summary={mode === 'buyer' ? 'Buyer / Offer' : 'Seller / Listing'} steps={steps}>
        <div className="space-y-1.5">
          {choice(mode !== 'buyer', 'Seller / Listing', 'What their home should list for', () => { onMode('listing'); steps.picked('who') }, 'ai-cma-seller')}
          {choice(mode === 'buyer', 'Buyer / Offer', 'What to offer on a home they want', () => { onMode('buyer'); steps.picked('who') }, 'ai-cma-buyer')}
        </div>
      </CardStep>
      <CardStep id="how" n={2} title="How" summary={ai ? 'AI CMA' : 'Manual'} steps={steps}>
        <div className="space-y-1.5">
          {choice(ai, 'AI CMA - I do all of it', `Picks the comps, values the home, writes the report${pct != null ? ` · about ${pct < 1 ? 'under 1' : Math.round(pct)}% of your AI` : ''}`, () => { onAi(true); steps.picked('how') }, 'ai-cma-ai')}
          {choice(!ai, 'Manual', 'You pick the comps on the CMA page - no AI used', () => { onAi(false); steps.picked('how') }, 'ai-cma-manual')}
        </div>
      </CardStep>
    </div>
  )
}

// ---------------------------------------------------------------- a form: background + home
export type FormQuestion = { label: string; type?: string; options?: string[]; required?: boolean }
export type FormPicks = { background_effects: boolean; listing_key: string | null; questions: FormQuestion[] }

export function FormPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: FormPicks; onPicks: (p: FormPicks) => void }) {
  const homes = (payload.homes || []) as { listing_key: string; address: string; city: string; photo?: string | null }[]
  const steps = useSteps(homes.length ? ['questions', 'background', 'home'] : ['questions', 'background'])
  // The questions as taps too (owner, 11/01): what the helper suggested (tap to drop), common ones
  // to add, and their own typed in. Name, email and phone are always on the form already.
  const bank = ((payload.bank || []) as FormQuestion[]).filter(b => !picks.questions.some(q => q.label.toLowerCase() === b.label.toLowerCase()))
  const [own, setOwn] = useState('')
  const addOwn = () => { const t = own.trim(); if (!t) return; onPicks({ ...picks, questions: [...picks.questions, { label: t, type: 'short_text' }] }); setOwn('') }
  const home = homes.find(h => h.listing_key === picks.listing_key)
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-form-pick">
      <CardStep id="questions" n={1} title="Questions" summary={`${picks.questions.length} + name, email, phone`} steps={steps}>
        <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Full name, email and phone are always asked. Tap one to take it off.</p>
        <div className="flex flex-col gap-1.5" data-testid="ai-form-questions">
          {picks.questions.map((q, i) => (
            <button key={`${q.label}-${i}`} type="button" onClick={() => onPicks({ ...picks, questions: picks.questions.filter((_, k) => k !== i) })}
              className="ohp-ai-press flex items-center gap-2 rounded-xl border border-[#111827] bg-white px-3 py-2 text-left text-xs font-bold text-[#111827] dark:border-[#C9A24D] dark:bg-zinc-900 dark:text-white">
              <span className="min-w-0 flex-1">{q.label}{q.options?.length ? <span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{q.options.join(' · ')}</span> : null}</span>
              <X className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </button>
          ))}
        </div>
        {bank.length > 0 && (
          <>
            <p className="mb-1 mt-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">Add a common one</p>
            <div className="flex flex-wrap gap-1.5">
              {bank.map(b => <button key={b.label} type="button" onClick={() => onPicks({ ...picks, questions: [...picks.questions, b] })} className={`${chip(false)} text-left`}>+ {b.label}</button>)}
            </div>
          </>
        )}
        <div className="mt-2 flex gap-1.5">
          <input value={own} onChange={e => setOwn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOwn() } }} placeholder="Or type your own question"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          <button type="button" onClick={addOwn} disabled={!own.trim()} className="rounded-xl bg-[#111827] px-3 text-[11px] font-black text-white disabled:opacity-40 dark:bg-[#C9A24D] dark:text-[#111827]">Add</button>
        </div>
        <button type="button" onClick={() => steps.picked('questions')} className="mt-2 rounded-full bg-[#111827] px-3.5 py-1.5 text-[11px] font-black text-white dark:bg-[#C9A24D] dark:text-[#111827]">Done</button>
      </CardStep>
      <CardStep id="background" n={2} title="Background" summary={picks.background_effects ? 'Moving' : 'Still'} steps={steps}>
      <button type="button" role="switch" aria-checked={picks.background_effects} onClick={() => { onPicks({ ...picks, background_effects: !picks.background_effects }); steps.picked('background') }}
        className="ohp-ai-press flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-zinc-900" data-testid="ai-form-bg">
        <span className="text-[13px] font-bold text-[#111827] dark:text-white">Moving background</span>
        <span className={`relative h-6 w-10 rounded-full transition-colors ${picks.background_effects ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-zinc-600'}`}>
          <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${picks.background_effects ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </span>
      </button>
      </CardStep>
      {homes.length > 0 && (
        <CardStep id="home" n={3} title="About a home?" summary={home ? home.address : 'No'} steps={steps}>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { onPicks({ ...picks, listing_key: null }); steps.picked('home') }} aria-pressed={!picks.listing_key} className={chip(!picks.listing_key)}>No</button>
            {homes.map(h => {
              const on = picks.listing_key === h.listing_key
              return (
                <button key={h.listing_key} type="button" onClick={() => { onPicks({ ...picks, listing_key: h.listing_key }); steps.picked('home') }} aria-pressed={on} title={`${h.address}, ${h.city}`}
                  className={`${chip(on)} inline-flex items-center gap-1.5 !py-1 !pl-1`} data-testid="ai-form-home">
                  {h.photo ? <img src={resolveMediaUrl(h.photo)} alt="" className="h-5 w-5 rounded-full object-cover" /> : <Home className="ml-1 h-3.5 w-3.5" />}
                  {h.address}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- a blog post: the Blogs page's questions
export type BlogPicks = {
  tone: string; length: string; key_points: string; personal_take: string; cta: string
  audiences: string[]; areas: string[]; spotlight: boolean; sale_ids: string[]
}
const BLOG_TONES: [string, string][] = [['warm', 'Warm & personal'], ['professional', 'Professional'], ['luxury', 'Refined luxury'], ['straight', 'Straight talk'], ['energetic', 'Energetic']]
const BLOG_LENGTHS: [string, string, string][] = [['short', 'Quick read', '~650 words'], ['standard', 'Standard', '~1,000 words'], ['long', 'In-depth guide', '~1,700 words']]
const BLOG_AUDIENCES = ['Buyers', 'Sellers', 'First-time buyers', 'Move-up buyers', 'Luxury buyers', 'Investors', 'Relocating', 'Homeowners']
const BLOG_CTAS: [string, string][] = [['how_can_i_help', 'Ready to Buy or Sell?'], ['home_value', "What's My Home Worth?"], ['showing', 'Schedule a Showing'],
  ['buying', "I'm Buying"], ['selling', "I'm Selling"], ['make_me_sell', 'Make Me Sell'], ['question', 'Ask Me a Question']]

// The AI writer's own questions as taps (owner, 11/01: "ask the steps in chat flow for look and options"
// - same as the Blogs page): one open at a time, picking folds it; pick-several steps fold on Done.
export function BlogPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: BlogPicks; onPicks: (p: BlogPicks) => void }) {
  const opts = (payload.options || {}) as { areas?: string[]; area_cards?: Record<string, string>; sales?: { id: string; label: string }[] }
  const towns = Array.from(new Set([...(opts.areas || []), ...picks.areas]))
  const sales = opts.sales || []
  const steps = useSteps(['who', 'towns', ...(sales.length ? ['sales'] : []), 'tone', 'length', 'cta', 'points'])
  const n = (id: string) => ['who', 'towns', ...(sales.length ? ['sales'] : []), 'tone', 'length', 'cta', 'points'].indexOf(id) + 1
  const pct = (payload.percents || {}) as Record<string, number>
  const pctText = (ln: string) => (typeof pct[ln] === 'number' ? `about ${pct[ln] < 1 ? 'under 1' : Math.round(pct[ln])}% of your AI` : '')
  const toggle = (list: string[], v: string, max: number) => (list.includes(v) ? list.filter(x => x !== v) : list.length >= max ? list : [...list, v])
  const done = (id: string) => (
    <button type="button" onClick={() => steps.picked(id)} className="mt-2 rounded-full bg-[#111827] px-3.5 py-1.5 text-[11px] font-black text-white dark:bg-[#C9A24D] dark:text-[#111827]">Done</button>
  )
  const few = (list: string[], none: string) => (list.length ? (list.length > 2 ? `${list.slice(0, 2).join(', ')} +${list.length - 2}` : list.join(', ')) : none)
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-blog-pick">
      <CardStep id="who" n={n('who')} title="Who it's for" summary={few(picks.audiences, 'Anyone')} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {BLOG_AUDIENCES.map(a => <button key={a} type="button" onClick={() => onPicks({ ...picks, audiences: toggle(picks.audiences, a, 8) })} aria-pressed={picks.audiences.includes(a)} className={chip(picks.audiences.includes(a))}>{a}</button>)}
        </div>
        {done('who')}
      </CardStep>
      <CardStep id="towns" n={n('towns')} title="Towns" summary={few(picks.areas, 'None picked')} steps={steps}>
        <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Up to 5 - naming them is what makes it rank locally.</p>
        <div className="flex flex-wrap gap-1.5">
          {towns.map(t => <button key={t} type="button" onClick={() => onPicks({ ...picks, areas: toggle(picks.areas, t, 5) })} aria-pressed={picks.areas.includes(t)} className={chip(picks.areas.includes(t))}>{t}</button>)}
        </div>
        <button type="button" role="switch" aria-checked={picks.spotlight} onClick={() => onPicks({ ...picks, spotlight: !picks.spotlight })}
          className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left dark:bg-zinc-900">
          <span className="min-w-0"><span className="block text-[12.5px] font-bold text-[#111827] dark:text-white">Town Spotlight</span>
            <span className="block text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">A photo, live market numbers, schools and what's nearby for each town</span></span>
          <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${picks.spotlight ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-zinc-600'}`}>
            <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${picks.spotlight ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
          </span>
        </button>
        {done('towns')}
      </CardStep>
      {sales.length > 0 && (
        <CardStep id="sales" n={n('sales')} title="Your sales" summary={picks.sale_ids.length ? `${picks.sale_ids.length} picked` : 'None'} steps={steps}>
          <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Mention up to 4 of your real sales (optional).</p>
          <div className="flex flex-col gap-1.5">
            {sales.map(x => {
              const on = picks.sale_ids.includes(x.id)
              return <button key={x.id} type="button" onClick={() => onPicks({ ...picks, sale_ids: toggle(picks.sale_ids, x.id, 4) })} aria-pressed={on}
                className={`${chip(on)} !rounded-xl text-left`}>{x.label}</button>
            })}
          </div>
          {done('sales')}
        </CardStep>
      )}
      <CardStep id="tone" n={n('tone')} title="Tone" summary={BLOG_TONES.find(t => t[0] === picks.tone)?.[1]} steps={steps}>
        <div className="flex flex-wrap gap-1.5">
          {BLOG_TONES.map(([id, name]) => (
            <button key={id} type="button" onClick={() => { onPicks({ ...picks, tone: id }); steps.picked('tone') }} aria-pressed={picks.tone === id} className={chip(picks.tone === id)}>{name}</button>
          ))}
        </div>
      </CardStep>
      <CardStep id="length" n={n('length')} title="Length" summary={BLOG_LENGTHS.find(l => l[0] === picks.length)?.[1]} steps={steps}>
        <div className="space-y-1.5">
          {BLOG_LENGTHS.map(([id, name, words]) => {
            const on = picks.length === id
            return (
              <button key={id} type="button" onClick={() => { onPicks({ ...picks, length: id }); steps.picked('length') }} aria-pressed={on}
                className={`ohp-ai-press flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${on
                  ? 'border-[#111827] bg-white ring-2 ring-[#C9A24D]/60 dark:border-[#C9A24D] dark:bg-zinc-900'
                  : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-zinc-700 dark:bg-zinc-900'}`}>
                <span className="text-xs font-black text-[#111827] dark:text-white">{name} <span className="font-semibold text-gray-400">{words}</span></span>
                <span className="shrink-0 text-[10.5px] font-semibold text-gray-500 dark:text-zinc-400">{pctText(id)}</span>
              </button>
            )
          })}
        </div>
      </CardStep>
      <CardStep id="cta" n={n('cta')} title="Ending button" summary={BLOG_CTAS.find(c => c[0] === picks.cta)?.[1]} steps={steps}>
        <p className="mb-1.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">What readers tap at the end - it opens that form right on the article.</p>
        <div className="flex flex-wrap gap-1.5">
          {BLOG_CTAS.map(([id, name]) => (
            <button key={id} type="button" onClick={() => { onPicks({ ...picks, cta: id }); steps.picked('cta') }} aria-pressed={picks.cta === id} className={chip(picks.cta === id)}>{name}</button>
          ))}
        </div>
      </CardStep>
      <CardStep id="points" n={n('points')} title="Key points" summary={picks.key_points.trim() || picks.personal_take.trim() ? 'Added' : 'Optional'} steps={steps}>
        <textarea value={picks.key_points} onChange={e => onPicks({ ...picks, key_points: e.target.value })} rows={2} maxLength={2000}
          placeholder="Key points to cover (optional) - bullets are fine"
          className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
        <textarea value={picks.personal_take} onChange={e => onPicks({ ...picks, personal_take: e.target.value })} rows={2} maxLength={2000}
          placeholder="Your take, or a local story only you could tell (optional)"
          className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
      </CardStep>
      {typeof pct[picks.length] === 'number' && (
        <p className="px-0.5 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Uses {pctText(picks.length)} allowance · saved as a draft</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- something being made
// While a card is making something (a design, a blog draft, an AI CMA, a Spotlight's setup): the
// little robot thinking in a gold ring, with what it's doing now (owner, 11/01: "a nice cute little
// loading animation ... for all situations like this").
const WORK_LINES: Record<string, string[]> = {
  write_blog_post: ['Researching your market...', 'Reading recent sales...', 'Writing your draft...', 'Fact-checking every number...'],
  start_cma: ['Finding homes that sold nearby...', 'Picking the best comps...', 'Estimating the value...', 'Writing the report...'],
  create_design: ['Laying out your design...', 'Placing the photo...', 'Adding your details...'],
  create_spotlight: ['Building the page...', 'Writing the story...', 'Adding the highlights...'],
  create_showcase: ['Searching for matching homes...', 'Setting up their Showcase...'],
  create_form: ['Building your form...', 'Adding the questions...'],
}

export function WorkingScene({ tool, message }: { tool: string; message?: string }) {
  const lines = WORK_LINES[tool] || ['Working on it...']
  const [i, setI] = useState(0)
  useEffect(() => {
    if (lines.length < 2) return
    const t = setInterval(() => setI(n => (n + 1) % lines.length), 2600)
    return () => clearInterval(t)
  }, [lines.length])
  return (
    <div className="flex items-center gap-3" data-testid="ai-working">
      <span className="ohp-work-orb relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#faf6ec] ring-1 ring-[#C9A24D]/40 dark:bg-zinc-800">
        <span aria-hidden className="ohp-work-orbit absolute inset-0"><span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#C9A24D]" /></span>
        <span aria-hidden className="ohp-work-orbit ohp-work-orbit-2 absolute inset-1"><span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#e8c97a]" /></span>
        <OhpBot size={32} thinking />
      </span>
      <div className="min-w-0 flex-1">
        <p key={i} className="ohp-work-line truncate text-[13px] font-black text-[#111827] dark:text-white">{lines[i]}</p>
        {message && <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-500 dark:text-zinc-400">{message}</p>}
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#C9A24D]/15"><div className="ohp-work-bar h-full w-1/3 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" /></div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- a Spotlight finishing itself
export function SetupSteps({ steps }: { steps: SetupStep[] }) {
  const shown = steps.filter(s => s.state !== 'skip')
  if (!shown.length) return null
  return (
    <ul className="mt-2 space-y-1.5" data-testid="ai-spotlight-setup">
      {shown.map(s => (
        <li key={s.key} className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-zinc-300">
          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${s.state === 'done' ? 'bg-emerald-500 text-white' : s.state === 'fail' ? 'bg-gray-200 text-gray-500 dark:bg-zinc-700' : 'bg-[#C9A24D]/20'}`}>
            {s.state === 'done' ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : s.state === 'fail' ? <X className="h-2.5 w-2.5" /> : <span className={`h-1.5 w-1.5 rounded-full bg-[#C9A24D] ${s.state === 'run' ? 'animate-pulse' : 'opacity-40'}`} />}
          </span>
          <span className={s.state === 'run' ? 'ohp-ai-shimmer' : ''}>{s.label}</span>
        </li>
      ))}
    </ul>
  )
}
