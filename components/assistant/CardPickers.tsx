'use client'

// The pieces that make each helper card feel like the feature it's making (owner, 11/01): the
// feature's own icon (with a gold sweep while it works), small live previews of what's being picked
// (a design, the brand look, a Spotlight's front page), and taps instead of chat questions (a CMA's
// AI or manual, a form's background and home). Every preview draws with the app's real renderers.
import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, Bell, CalendarCheck, Check, ClipboardList, Globe, Handshake, Home, Image as ImageIcon, LifeBuoy, Mail, MapPin, MessageSquare,
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
export function DesignLivePreview({ payload, layout, colors }: { payload: Record<string, any>; layout: string | null; colors: string }) {
  const { agent, kit } = useAgentBits()
  const [property, setProperty] = useState<LinkedProperty | null | undefined>(undefined)
  const situation = getSituation(payload.situation)
  useEffect(() => {
    if (!situation?.propertyAttached) { setProperty(null); return }
    let live = true
    fetchLinkedProperty(payload.address || '', undefined, payload.listing_key || undefined).then(r => { if (live) setProperty(r.property || null) })
    return () => { live = false }
  }, [payload.address, payload.listing_key, situation?.propertyAttached])
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
          openHouseTime: payload.start_time || undefined, priceMode: 'listing' } as any} rounded={false} />
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
      <div>
        <p className={label}>Look</p>
        <div className="flex flex-wrap gap-1.5">
          {[['cinematic_luxury', 'Luxe'], ['editorial_estate', 'Editorial']].map(([id, name]) => (
            <button key={id} type="button" onClick={() => onPicks({ ...picks, template_id: id })} aria-pressed={picks.template_id === id} className={chip(picks.template_id === id)}>{name}</button>
          ))}
        </div>
      </div>
      <div>
        <p className={label}>Color</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] justify-items-center gap-1.5">
          {SPOT_COLORS.map(c => {
            const on = c.color.toLowerCase() === color.toLowerCase()
            return (
              <button key={c.color} type="button" title={c.label} aria-label={c.label} aria-pressed={on} onClick={() => onPicks({ ...picks, brand_color: c.color })}
                className={`ohp-ai-press grid h-7 w-7 place-items-center rounded-full ring-1 ring-black/10 ${on ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`} style={{ background: c.color }}>
                {on && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
        {changed && <p className="mt-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">This is your brand color - your hub, forms and website change with it.</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- a CMA: AI or manual
export function CmaPick({ payload, ai, onAi }: { payload: Record<string, any>; ai: boolean; onAi: (v: boolean) => void }) {
  const pct = typeof payload.ai_percent === 'number' ? payload.ai_percent : null
  const opt = (on: boolean) => `ohp-ai-press flex w-full items-start gap-2.5 rounded-xl border-2 p-2.5 text-left transition-colors ${on
    ? 'border-[#C9A24D] bg-white shadow-sm dark:bg-zinc-900' : 'border-transparent bg-white/60 hover:border-[#C9A24D]/40 dark:bg-zinc-900/60'}`
  const dot = (on: boolean) => `mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D]' : 'border-gray-300 dark:border-zinc-600'}`
  return (
    <div className="mt-3 space-y-1.5 rounded-xl bg-[#faf7f0] p-2 dark:bg-zinc-800/50" data-testid="ai-cma-pick">
      <button type="button" onClick={() => onAi(true)} aria-pressed={ai} className={opt(ai)} data-testid="ai-cma-ai">
        <span className={dot(ai)}>{ai && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-black text-[#111827] dark:text-white">AI CMA - I do all of it</span>
          <span className="block text-[11px] font-semibold leading-snug text-gray-500 dark:text-zinc-400">Picks the comps, values the home, writes the report{pct != null ? ` · about ${pct < 1 ? 'under 1' : Math.round(pct)}% of your AI` : ''}</span>
        </span>
      </button>
      <button type="button" onClick={() => onAi(false)} aria-pressed={!ai} className={opt(!ai)} data-testid="ai-cma-manual">
        <span className={dot(!ai)}>{!ai && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-black text-[#111827] dark:text-white">Manual</span>
          <span className="block text-[11px] font-semibold leading-snug text-gray-500 dark:text-zinc-400">You pick the comps on the CMA page - no AI used</span>
        </span>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- a form: background + home
export type FormPicks = { background_effects: boolean; listing_key: string | null }

export function FormPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: FormPicks; onPicks: (p: FormPicks) => void }) {
  const homes = (payload.homes || []) as { listing_key: string; address: string; city: string; photo?: string | null }[]
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-form-pick">
      <button type="button" role="switch" aria-checked={picks.background_effects} onClick={() => onPicks({ ...picks, background_effects: !picks.background_effects })}
        className="ohp-ai-press flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-zinc-900" data-testid="ai-form-bg">
        <span className="text-[13px] font-bold text-[#111827] dark:text-white">Moving background</span>
        <span className={`relative h-6 w-10 rounded-full transition-colors ${picks.background_effects ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-zinc-600'}`}>
          <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${picks.background_effects ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </span>
      </button>
      {homes.length > 0 && (
        <div>
          <p className={label}>About a home?</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onPicks({ ...picks, listing_key: null })} aria-pressed={!picks.listing_key} className={chip(!picks.listing_key)}>No</button>
            {homes.map(h => {
              const on = picks.listing_key === h.listing_key
              return (
                <button key={h.listing_key} type="button" onClick={() => onPicks({ ...picks, listing_key: h.listing_key })} aria-pressed={on} title={`${h.address}, ${h.city}`}
                  className={`${chip(on)} inline-flex items-center gap-1.5 !py-1 !pl-1`} data-testid="ai-form-home">
                  {h.photo ? <img src={resolveMediaUrl(h.photo)} alt="" className="h-5 w-5 rounded-full object-cover" /> : <Home className="ml-1 h-3.5 w-3.5" />}
                  {h.address}
                </button>
              )
            })}
          </div>
        </div>
      )}
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
