'use client'

// The pieces that make each helper card feel like the feature it's making (owner, 11/01): the
// feature's own icon (with a gold sweep while it works), small live previews of what's being picked
// (a design, the brand look, a Spotlight's front page), and taps instead of chat questions (a CMA's
// AI or manual, a form's background and home). Every preview draws with the app's real renderers.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Bell, CalendarCheck, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Eye, Globe, Handshake, Home, Image as ImageIcon, LifeBuoy, Mail, MapPin, MessageSquare,
  Move, Newspaper, Palette, PartyPopper, Plus, Settings2, Sparkles, Star, UserRound, X, type LucideIcon,
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
import { BRAND_COLORS, brandFormLook, type BrandLook } from '@/lib/brandKit'
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
  send_invite_to_leads: Mail, remind_invite_non_responders: Mail, set_invite_rsvps: PartyPopper, duplicate_invite: PartyPopper,
  mark_form_response_reviewed: ClipboardList, duplicate_form: ClipboardList, create_form_tracking_link: ClipboardList,
  add_unfinished_form_response_to_leads: ClipboardList, build_open_house_kit: Home,
  withdraw_hosting_request: Handshake, offer_other_host_time: Handshake, answer_team_host_ask: Handshake, publish_blog_post: Newspaper,
  reply_to_help_ticket: LifeBuoy, update_email_signature: Mail, resync_calendar: CalendarCheck, send_crm_test_lead: Settings2,
  set_discovery_search: MapPin,
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
export function useSteps(ids: string[], start?: string | null) {
  const key = ids.join('|')
  // `start`: open another step first - e.g. the home they already named in chat (owner, 11/01)
  const [open, setOpen] = useState<string | null>(start !== undefined && (start === null || ids.includes(start)) ? start : ids[0] ?? null)
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
  // A step they browse (layout, colors) stays open while they tap around; its check folds it now.
  const done = (id: string) => { if (timer.current) clearTimeout(timer.current); const i = ids.indexOf(id); setOpen(o => (o === id ? ids[i + 1] ?? null : o)) }
  const closeAll = () => { if (timer.current) clearTimeout(timer.current); setOpen(null) }
  return { open, picked, toggle, done, closeAll, isOpen: (id: string) => open === id }
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

/** The check at the end of a step they browse (owner, 11/01: "click through and see all the
 *  options" - tapping one no longer folds the step; this does). */
export function StepDone({ onDone, label = 'Done' }: { onDone: () => void; label?: string }) {
  return (
    <button type="button" onClick={onDone} aria-label={label} title={label} data-testid="ai-step-done"
      className="ohp-ai-press inline-flex items-center gap-1 rounded-full bg-[#C9A24D] py-1.5 pl-2 pr-3 text-xs font-black text-white shadow-sm shadow-[#C9A24D]/30">
      <Check className="h-3.5 w-3.5" strokeWidth={3.5} /> {label}
    </button>
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

export function DesignLivePreview({ payload, layout, colors, property, photo, focal, onFocal, big = false }: {
  payload: Record<string, any>; layout: string | null; colors: string; property: LinkedProperty | null | undefined; photo?: string | null
  focal?: { x: number; y: number } | null; onFocal?: (f: { x: number; y: number }) => void; big?: boolean
}) {
  const { agent, kit } = useAgentBits()
  const situation = getSituation(payload.situation)
  const templates = getTemplatesFor(payload.situation, payload.format).filter(t => isCompositionReady(t.composition))
  const template = templates.find(t => t.composition === layout) || templates[0]
  // Big (the photo is picked, every step folded - owner, 11/01): drag the picture to move the photo
  // in its frame, like the Studio's own photo framing. The drag is drawn every frame, saved on release.
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null)
  const [live, setLive] = useState<{ x: number; y: number } | null>(null)
  const shown = live || focal || null
  const buildOptions = useMemo(() => ({
    openHouseDate: payload.open_house_date ? new Date(`${payload.open_house_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : undefined,
    openHouseTime: payload.start_time || undefined, priceMode: 'listing', heroPhoto: photo || undefined, heroFocal: shown,
  }) as any, [payload.open_house_date, payload.start_time, photo, shown?.x, shown?.y]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!template || property === undefined) {
    return <div className="ohp-skeleton mx-auto h-[170px] w-[136px] rounded-lg" />
  }
  const canDrag = big && !!onFocal && !!situation?.propertyAttached
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10))
  const onDown = (e: React.PointerEvent) => {
    if (!canDrag) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* a finger that already lifted - the drag still works */ }
    const f = focal || { x: 50, y: 50 }
    drag.current = { x: e.clientX, y: e.clientY, fx: f.x, fy: f.y }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !box.current) return
    const r = box.current.getBoundingClientRect()
    // the photo follows the finger: moving it right shows more of its left side
    setLive({ x: clamp(d.fx - ((e.clientX - d.x) / r.width) * 140), y: clamp(d.fy - ((e.clientY - d.y) / r.height) * 140) })
  }
  const onUp = () => {
    if (!drag.current) return
    drag.current = null
    if (live) onFocal?.(live)
    setLive(null)
  }
  return (
    <div className={`relative mx-auto transition-[width] duration-300 ease-out ${big ? 'w-[min(260px,100%)]' : 'w-[150px]'}`}>
      <div ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className={`overflow-hidden rounded-lg shadow-[0_10px_24px_-12px_rgba(0,0,0,.45)] ring-1 ring-black/10 ${canDrag ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''}`}
        data-testid="ai-design-preview" data-focal={shown ? `${shown.x},${shown.y}` : ''}>
        <StyleThumbnail designType={payload.format} styleId="modern_luxury" colorMode={colors as any} templateId={template.id} situation={payload.situation}
          property={situation?.propertyAttached ? property : null} agent={agent} brandKit={kit}
          messaging={payload.headline ? { id: 'custom', headline: String(payload.headline) } as any : undefined}
          buildOptions={buildOptions} rounded={false} />
      </div>
      {canDrag && (
        <p className={`pointer-events-none mt-1.5 flex items-center justify-center gap-1 text-[10.5px] font-bold text-gray-500 transition-opacity dark:text-zinc-400 ${live ? 'opacity-0' : 'opacity-100'}`}>
          <Move className="h-3 w-3" /> Drag the picture to move the photo
        </p>
      )}
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
const Q_LABEL: Record<string, string> = { short_text: 'Short answer', long_text: 'Long answer', select: 'Pick one', multi_select: 'Pick any', number: 'Number',
  currency: 'Dollar amount', date: 'Date', time: 'Time', email: 'Email', phone: 'Phone' }
type CardHome = { listing_key: string; address: string; city: string; state?: string | null; price?: number | null; beds?: number | null; baths?: number | null; sqft?: number | null; status?: string | null; photo?: string | null }

// Name, email and phone open every new form (the server adds them), so the agent's own questions
// are Q4 onward - the same numbers the preview shows and the helper is told.
const CORE_QS = [
  { id: 'core_name', type: 'short_text', label: 'Full name', required: true },
  { id: 'core_email', type: 'email', label: 'Email', required: true },
  { id: 'core_phone', type: 'phone', label: 'Phone', required: true },
]
export const FIRST_OWN_Q = CORE_QS.length + 1

/** The form as a guest sees it on a phone, one screen at a time (owner, 11/02): the real form screen
 *  in a phone-width frame (app/assistant/form-preview), so a phone layout shows even on a computer. */
function FormPreview({ title, questions, home, backgroundEffects, at, onAt }: {
  title: string; questions: FormQuestion[]; home: CardHome | null; backgroundEffects: boolean; at: number; onAt: (i: number) => void
}) {
  const { user, agent, kit } = useAgentBits()
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [w, setW] = useState(300)
  const all = useMemo(() => [...CORE_QS, ...questions.map((q, i) => ({ id: `q${i}`, type: q.type || 'short_text', label: q.label, required: !!q.required, options: q.options?.length ? q.options : null }))]
    .map(q => ({ ...q, locked: false })), [questions])
  const screens = useMemo(() => ['welcome', ...all.map(q => q.id), 'thankyou'], [all])
  const i = Math.min(at, screens.length - 1)
  const luxeOk = user?.plan_tier === 'IDX' || !!user?.is_admin
  useEffect(() => {
    const on = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data?.type === 'ohp-form-preview-ready' && e.source === frame.current?.contentWindow) setReady(true) }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!ready) return
    frame.current?.contentWindow?.postMessage({ type: 'ohp-form-preview', data: {
      questions: all, focus: screens[i], backgroundEffects, look: brandFormLook(kit, luxeOk),
      branding: { title, agentName: agent.agentName || 'Your Name', agentBrokerage: agent.agentBrokerage || '', agentPhotoUrl: agent.agentPhotoUrl, agentTitle: agent.agentTitle },
      linkedProperty: home ? { listing_key: home.listing_key, address: home.address, city: home.city, state: home.state, price: home.price, beds: home.beds, baths: home.baths,
        sqft: home.sqft, status: home.status, image_url: home.photo } : null,
    } }, window.location.origin)
  }, [ready, all, screens, i, backgroundEffects, kit, luxeOk, title, agent, home])
  // A 390 x 700 phone, scaled down to the card
  const PW = 390, PH = 700
  const s = Math.min(0.74, w / PW)
  const label = i === 0 ? 'Welcome screen' : i === screens.length - 1 ? 'Thank-you screen' : `Question ${i} of ${all.length}`
  const arrow = 'ohp-ai-press grid h-8 w-8 place-items-center rounded-full bg-white text-[#111827] shadow-sm ring-1 ring-black/5 disabled:opacity-30 dark:bg-zinc-900 dark:text-white dark:ring-white/10'
  return (
    <div ref={box} className="mb-2.5" data-testid="ai-form-preview">
      <div className="mx-auto overflow-hidden rounded-[22px] bg-[#FAFAF7] shadow-md ring-[5px] ring-[#111827] dark:ring-zinc-700" style={{ width: PW * s, height: PH * s }}>
        <iframe ref={frame} src="/assistant/form-preview" title={`Preview of ${title}`} tabIndex={-1}
          className="pointer-events-none origin-top-left border-0" style={{ width: PW, height: PH, transform: `scale(${s})` }} />
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        <button type="button" onClick={() => onAt(i - 1)} disabled={i === 0} aria-label="Previous screen" className={arrow}><ChevronLeft className="h-4 w-4" strokeWidth={3} /></button>
        <span className="min-w-[8.5rem] text-center text-[11.5px] font-black text-[#111827] dark:text-white" data-testid="ai-form-preview-label">{label}</span>
        <button type="button" onClick={() => onAt(i + 1)} disabled={i === screens.length - 1} aria-label="Next screen" className={arrow}><ChevronRight className="h-4 w-4" strokeWidth={3} /></button>
      </div>
      <p className="mt-1.5 text-center text-[10.5px] font-semibold leading-snug text-gray-500 dark:text-zinc-400">
        {`Want a change? Tell me, like “make question ${FIRST_OWN_Q + 1} a pick-one with Yes / No”.`}
      </p>
    </div>
  )
}

export function FormPick({ payload, picks, onPicks }: { payload: Record<string, any>; picks: FormPicks; onPicks: (p: FormPicks) => void }) {
  const homes = (payload.homes || []) as CardHome[]
  const steps = useSteps(homes.length ? ['questions', 'background', 'home'] : ['questions', 'background'])
  // A card that replaced one they asked to change opens its preview on the change (ai_routes._replace_open_form_cards)
  const [at, setAt] = useState(typeof payload.focus_q === 'number' ? FIRST_OWN_Q + payload.focus_q : 0)
  const [preview, setPreview] = useState(true)
  // The questions as taps too (owner, 11/01): what the helper suggested (tap to drop), common ones
  // to add, and their own typed in. Name, email and phone are always on the form already.
  const has = (b: FormQuestion) => picks.questions.some(q => q.label.toLowerCase() === b.label.toLowerCase())
  const ideas = ((payload.ideas || []) as FormQuestion[]).filter(b => !has(b))
  const bank = ((payload.bank || []) as FormQuestion[]).filter(b => !has(b) && !ideas.some(d => d.label.toLowerCase() === b.label.toLowerCase()))
  const [more, setMore] = useState(false)
  const [own, setOwn] = useState('')
  const addOwn = () => { const t = own.trim(); if (!t) return; onPicks({ ...picks, questions: [...picks.questions, { label: t, type: 'short_text' }] }); setOwn('') }
  const home = homes.find(h => h.listing_key === picks.listing_key)
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-[#faf7f0] p-2.5 dark:bg-zinc-800/50" data-testid="ai-form-pick">
      <CardStep id="questions" n={1} title="Questions" summary={`${picks.questions.length} + name, email, phone`} steps={steps}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Questions 1-3 are always name, email and phone.</p>
          <button type="button" onClick={() => setPreview(v => !v)} aria-expanded={preview} data-testid="ai-form-preview-toggle"
            className="ohp-ai-press inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-black text-[#8b7355] ring-1 ring-[#C9A24D]/40 dark:bg-zinc-900 dark:text-[#e8c97a]">
            <Eye className="h-3 w-3" strokeWidth={3} /> {preview ? 'Hide preview' : 'Preview'}
          </button>
        </div>
        {preview && (
          <FormPreview title={String(payload.title || 'Your form')} questions={picks.questions} backgroundEffects={picks.background_effects}
            home={homes.find(h => h.listing_key === picks.listing_key) || null} at={at} onAt={setAt} />
        )}
        <ol className="flex flex-col gap-1.5" data-testid="ai-form-questions">
          {picks.questions.map((q, i) => (
            <li key={`${q.label}-${i}`} className={`ohp-ai-card-in flex items-start gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 dark:bg-zinc-900 ${preview && at === FIRST_OWN_Q + i ? 'ring-[#C9A24D]' : 'ring-black/5 dark:ring-white/10'}`}>
              <button type="button" onClick={() => { setPreview(true); setAt(FIRST_OWN_Q + i) }} aria-label={`Preview question ${FIRST_OWN_Q + i}`} title="See it in the preview"
                className="ohp-ai-press mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#C9A24D]/15 text-[10px] font-black text-[#8b7355] dark:text-[#e8c97a]">{FIRST_OWN_Q + i}</button>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">{q.label}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">{Q_LABEL[q.type || 'short_text'] || 'Answer'}</span>
                  {(q.options || []).map(o => <span key={o} className="rounded-full border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-zinc-700 dark:text-zinc-300">{o}</span>)}
                </span>
              </span>
              <button type="button" aria-label={`Take off: ${q.label}`} title="Take it off"
                onClick={() => onPicks({ ...picks, questions: picks.questions.filter((_, k) => k !== i) })}
                className="ohp-ai-press grid h-6 w-6 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ol>
        {/* Ideas made for this form, then common ones for this kind of form (owner, 11/01) */}
        {[{ title: 'Ideas for this form', list: ideas }, { title: 'Common ones', list: more ? bank : bank.slice(0, 3) }].filter(g => g.list.length).map(g => (
          <div key={g.title} className="mt-2.5">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">{g.title}</p>
            <div className="flex flex-col gap-1" data-testid={g.title === 'Common ones' ? 'ai-form-bank' : 'ai-form-ideas'}>
              {g.list.map(b => (
                <button key={b.label} type="button" onClick={() => onPicks({ ...picks, questions: [...picks.questions, b] })}
                  className="ohp-ai-press flex items-center gap-2 rounded-lg border border-dashed border-[#C9A24D]/50 bg-white/70 px-2.5 py-1.5 text-left hover:border-[#C9A24D] dark:bg-zinc-900/60">
                  <Plus className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" strokeWidth={3} />
                  <span className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-gray-700 dark:text-zinc-200">{b.label}</span>
                  <span className="shrink-0 text-[9.5px] font-black uppercase tracking-wide text-gray-400">{Q_LABEL[b.type || 'short_text'] || ''}</span>
                </button>
              ))}
            </div>
            {g.title === 'Common ones' && bank.length > 3 && (
              <button type="button" onClick={() => setMore(m => !m)} className="mt-1 text-[11px] font-black text-[#8b7355] dark:text-[#e8c97a]">
                {more ? 'Show fewer' : `+ ${bank.length - 3} more`}
              </button>
            )}
          </div>
        ))}
        <div className="mt-2.5 flex gap-1.5">
          <input value={own} onChange={e => setOwn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOwn() } }} placeholder="Type your own question"
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 outline-none focus:border-[#C9A24D] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          <button type="button" onClick={addOwn} disabled={!own.trim()} className="rounded-xl bg-[#111827] px-3 text-[11px] font-black text-white disabled:opacity-40 dark:bg-[#C9A24D] dark:text-[#111827]">Add</button>
        </div>
        <div className="mt-2.5"><StepDone onDone={() => steps.done('questions')} /></div>
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

// (A blog post's card is its own file: ./BlogPick - the Blogs page's whole interview.)

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
      <span className="ohp-work-orb relative grid h-12 w-12 shrink-0 place-items-center rounded-full">
        <span aria-hidden className="ohp-work-orbit absolute inset-0"><span className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#C9A24D]" /></span>
        <span aria-hidden className="ohp-work-orbit ohp-work-orbit-2 absolute inset-1"><span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#e8c97a]" /></span>
        <OhpBot size={44} thinking />
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
