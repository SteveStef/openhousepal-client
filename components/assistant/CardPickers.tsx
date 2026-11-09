'use client'

// The pieces that make each helper card feel like the feature it's making (owner, 11/01): the
// feature's own icon (with a gold sweep while it works), small live previews of what's being picked
// (a design, the brand look, a Spotlight's front page), and taps instead of chat questions (a CMA's
// AI or manual, a form's background and home). Every preview draws with the app's real renderers.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, Bell, CalendarCheck, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Eye, Globe, Handshake, Home, Image as ImageIcon, LifeBuoy, Mail, MapPin, MessageSquare,
  Lock, Move, Newspaper, Palette, PartyPopper, Plus, Send, Settings2, Sparkles, Star, Trash2, UserRound, X, type LucideIcon, GitBranch } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import type { BrandKit, LinkedProperty } from '@/types'
import StyleThumbnail from '@/components/studio/design/StyleThumbnail'
import { FeaturePreview, FitStage, paintOf } from '@/components/studio/branding/FeaturePreviews'
import { getSituation } from '@/lib/studio/designSituations'
import { DESIGN_FORMAT_META } from '@/lib/studio/designFormats'
import { getTemplatesFor, isCompositionReady } from '@/lib/studio/designTemplates'
import { designAgentFrom, SAMPLE_DESIGN_AGENT } from '@/lib/studio/designAgent'
import { fetchLinkedProperty } from '@/components/studio/PropertySelector'
import { BRAND_COLORS, brandFormLook, luxeAllowedFor, type BrandLook } from '@/lib/brandKit'
import { luxeUpgrade } from '@/lib/navAccess'
import type { FormLook } from '@/lib/formLook'
import { HUB_CLASSIC_ACCENTS } from '@/components/agent-hub/HubClassicTheme'
import { LUXE_METALS, LUXE_METAL_ORDER, type LuxeMetal } from '@/lib/luxeMetals'
import type { SetupStep } from '@/components/property-sites/spotlight/autoSetup'
import { OhpBot } from './OhpBot'

// ---------------------------------------------------------------- the feature's icon
const ICONS: Record<string, LucideIcon> = {
  create_design: ImageIcon, update_branding: Palette, create_invite: PartyPopper, create_showcase: Sparkles,
  update_showcase_search: Sparkles, set_showcase: Sparkles, add_home_to_showcase: Sparkles, remove_showcase_homes: Trash2, resend_showcase_invite: Sparkles,
  confirm_showcase_tour: CalendarCheck, reply_to_showcase_comment: MessageSquare, create_spotlight: Star, publish_spotlight: Star,
  create_form: ClipboardList, edit_form: ClipboardList, write_blog_post: Newspaper, start_cma: BarChart3, update_email_settings: Mail,
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
export const chip = (on: boolean) => `ohp-ai-press rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${on
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

// A card's cream box (owner, 11/04: "desktop full open view should have more thoughtful layouts"):
// in a wide chat (the computer's big window) the preview sits on the left and the whole flow in one
// column on its right, kept to a comfortable width so a button never ends up far from what it goes
// with (owner, 11/06); in a narrow one (a phone, the corner panel) they stack. Goes by the card's own
// width, not the screen's.
// 11/09 (owner: "can go farther to the right side only making the preview larger ... as long as the
// selection section doesn't get wider ... it should span to bottom of other sections"): the options
// keep the width they had; the card grows wider (ChatThread lets a row with a side-by-side card reach
// 1120px) and all of that goes to the preview, which is as tall as the options next to it - previews
// read that height from --pick-h.
export const pickOptionsWidth = (side: number) => Math.max(340, Math.min(460, 650 - side))
export const WIDE_CARD_COLUMNS = (side: number) => `minmax(${side}px,1fr) ${pickOptionsWidth(side)}px`
export function PickShell({ testid, preview, side = 280, children }: { testid: string; preview?: React.ReactNode; side?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const optsRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [optsH, setOptsH] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const wide = !!preview && w >= 600
  useEffect(() => {
    const el = optsRef.current
    if (!wide || !el) return
    const ro = new ResizeObserver(([e]) => setOptsH(Math.round(e.contentRect.height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [wide])
  return (
    <div ref={ref} className="group/pick mt-3 rounded-xl bg-[#faf7f0] p-1.5 sm:p-2.5 dark:bg-zinc-800/50" data-testid={testid} data-wide={wide ? 'yes' : 'no'}>
      {wide ? (
        <div className="grid items-start gap-5" style={{ gridTemplateColumns: WIDE_CARD_COLUMNS(side) }}>
          <div className="sticky top-2 min-w-0" data-testid="ai-pick-preview" style={{ ['--pick-h' as string]: `${Math.max(440, Math.min(720, optsH || 460))}px` }}>{preview}</div>
          <div ref={optsRef} className="ohp-steps min-w-0">{children}</div>
        </div>
      ) : (
        <div className="space-y-2">{preview}<div className="ohp-steps">{children}</div></div>
      )}
    </div>
  )
}

/** A list of choices: one per row on a phone, two or three across when there's room. */
export const OPTION_GRID = 'grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]'

export function CardStep({ id, n, title, summary, steps, children }: {
  id: string; n: number; title: string; summary?: React.ReactNode; steps: ReturnType<typeof useSteps>; children: React.ReactNode
}) {
  const open = steps.isOpen(id)
  return (
    <div className={`rounded-xl transition-colors ${open ? 'bg-white shadow-sm ring-1 ring-[#C9A24D]/35 dark:bg-zinc-900' : 'bg-white/60 ring-1 ring-black/5 dark:bg-zinc-900/50 dark:ring-white/10'}`}
      data-testid={`ai-step-${id}`} data-open={open ? 'yes' : 'no'}>
      <button type="button" onClick={() => steps.toggle(id)} aria-expanded={open} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black group-data-[wide=yes]/pick:h-6 group-data-[wide=yes]/pick:w-6 group-data-[wide=yes]/pick:text-[11.5px] ${open ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-[#C9A24D] text-white'}`}>
          {open ? n : <Check className="h-3 w-3" strokeWidth={3.5} />}
        </span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] group-data-[wide=yes]/pick:text-[11.5px] dark:text-[#C9A24D]">{title}</span>
        <span className={`ml-auto min-w-0 truncate text-xs font-bold text-[#111827] transition-opacity dark:text-white ${open ? 'opacity-0' : 'opacity-100'}`}>{summary}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-2 pb-2 pt-1 sm:px-2.5 sm:pb-2.5">{children}</div>
        </div>
      </div>
    </div>
  )
}

/** Show-or-hide switches for a page's sections (a Spotlight's, a CMA report's). */
export function SectionToggles({ all, hidden, onChange }: { all: [string, string][]; hidden: string[]; onChange: (hidden: string[]) => void }) {
  return (
    <div className={OPTION_GRID} data-testid="ai-sections">
      {all.map(([id, name]) => {
        const on = !hidden.includes(id)
        return (
          <button key={id} type="button" role="switch" aria-checked={on} onClick={() => onChange(on ? [...hidden, id] : hidden.filter(x => x !== id))}
            className={`ohp-ai-press flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] font-bold transition-colors ${on ? 'border-[#C9A24D]/60 bg-white text-[#111827] dark:bg-zinc-900 dark:text-white' : 'border-gray-200 bg-white/50 text-gray-400 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-500'}`}>
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ${on ? 'bg-[#C9A24D] text-white' : 'bg-gray-200 dark:bg-zinc-700'}`}>{on && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
            <span className="min-w-0 truncate">{name}</span>
          </button>
        )
      })}
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
export function useAgentBits() {
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

export function DesignLivePreview({ payload, layout, colors, property, photo, focal, onFocal, big = false, brandingMode }: {
  payload: Record<string, any>; layout: string | null; colors: string; property: LinkedProperty | null | undefined; photo?: string | null
  focal?: { x: number; y: number } | null; onFocal?: (f: { x: number; y: number }) => void; big?: boolean
  brandingMode?: 'personal' | 'team' | 'brokerage' | 'none'
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
  // width / height of the design (a story is tall, a postcard wide) - the preview fills the space beside the options
  const px = DESIGN_FORMAT_META[payload.format]?.exportPx || [1080, 1080]
  const aspect = (px[0] / px[1]).toFixed(4)
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
    <div className={`relative mx-auto transition-[width] duration-300 ease-out ${big ? 'w-[min(260px,100%)] group-data-[wide=yes]/pick:w-[var(--pick-w)]' : 'w-[150px] group-data-[wide=yes]/pick:w-[var(--pick-w)]'}`}
      style={{ ['--pick-w' as string]: `min(100%, calc((var(--pick-h, 420px) - ${canDrag ? 26 : 0}px) * ${aspect}))` }}>
      <div ref={box} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className={`overflow-hidden rounded-lg shadow-[0_10px_24px_-12px_rgba(0,0,0,.45)] ring-1 ring-black/10 ${canDrag ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''}`}
        data-testid="ai-design-preview" data-focal={shown ? `${shown.x},${shown.y}` : ''}>
        <StyleThumbnail designType={payload.format} styleId="modern_luxury" colorMode={colors as any} templateId={template.id} situation={payload.situation}
          property={situation?.propertyAttached ? property : null} agent={agent} brandKit={kit} brandingMode={brandingMode}
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
  // One big preview with a switch under it (owner, 11/09: "show the full image ... a pill under it to switch"
  // between the Agent Hub and the forms - two small ones side by side "looks like mud"). Same on a phone.
  const [view, setView] = useState<'hub' | 'forms'>('hub')
  return (
    <div className="flex flex-col gap-2" data-testid="ai-brand-preview" data-view={view}>
      <div className="overflow-hidden rounded-xl bg-[#f3efe6] h-[340px] group-data-[wide=yes]/pick:h-[calc(var(--pick-h,460px)_-_44px)] dark:bg-zinc-800/70">
        <FitStage key={view} w={150} h={290} pad={0.94}><FeaturePreview id={view} look={look} kit={kit} person={person} agent={agent} /></FitStage>
      </div>
      <div className="mx-auto inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10" role="tablist" data-testid="ai-brand-switch">
        {([['hub', 'Agent Hub'], ['forms', 'Forms']] as const).map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} data-testid={`ai-brand-view-${id}`}
            className={`ohp-ai-press rounded-full px-4 py-1.5 text-[11.5px] font-black transition-colors ${view === id ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-zinc-400 dark:hover:text-white'}`}>
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- a form: background + home
export type FormQuestion = { label: string; type?: string; options?: string[]; required?: boolean; show_if?: { question: string; answers: string[] } | null; fields?: { id?: string; label: string; type?: string; required?: boolean }[] | null }
export type FormPicks = { background_effects: boolean; welcome_text_effects: boolean; dark: boolean | null; look?: FormLook | null; style?: Partial<Pick<FormLook, 'theme' | 'accent' | 'metal'>> | null; one_contact: boolean; first_last: boolean; after_mode: string | null; after_url: string; listing_key: string | null; questions: FormQuestion[] }
const Q_LABEL: Record<string, string> = { short_text: 'Short answer', long_text: 'Long answer', select: 'Pick one', multi_select: 'Pick any', number: 'Number',
  currency: 'Dollar amount', date: 'Date', time: 'Time', email: 'Email', phone: 'Phone', contact_group: 'Several on one page' }
type CardHome = { listing_key: string; address: string; city: string; state?: string | null; price?: number | null; beds?: number | null; baths?: number | null; sqft?: number | null; status?: string | null; photo?: string | null }

// Name, email and phone open every new form (the server adds them), so the agent's own questions
// are Q4 onward - the same numbers the preview shows and the helper is told.
const CORE_QS = [
  { id: 'core_name', type: 'short_text', label: 'Full name', required: true },
  { id: 'core_email', type: 'email', label: 'Email', required: true },
  { id: 'core_phone', type: 'phone', label: 'Phone', required: true },
]
// ...or all three on one screen (owner, 11/04) - the same question the premade forms use.
const ONE_CONTACT = [{ id: 'core_contact', type: 'contact_group', label: 'Your Contact Information', required: true,
  fields: [{ id: 'full_name', type: 'short_text', label: 'Full name', required: true }, { id: 'email', type: 'email', label: 'Email', required: true }, { id: 'phone', type: 'phone', label: 'Phone', required: true }] }]
const FIRST_LAST = [{ id: 'buyer_first_name', type: 'short_text', label: 'First name', required: true }, { id: 'buyer_last_name', type: 'short_text', label: 'Last name', required: true }]
const coreQs = (one?: boolean, split?: boolean) => (one
  ? [{ ...ONE_CONTACT[0], fields: split ? [...FIRST_LAST, ...ONE_CONTACT[0].fields.slice(1)] : ONE_CONTACT[0].fields }]
  : CORE_QS) as Array<{ id: string; type: string; label: string; required: boolean; fields?: unknown[] }>

/** The form as a guest sees it on a phone, one screen at a time (owner, 11/02): the real form screen
 *  in a phone-width frame (app/assistant/form-preview), so a phone layout shows even on a computer. */
function FormPreview({ title, questions, home, backgroundEffects, welcomeTextEffects = true, oneContact = false, firstLast = false, look, at, fitH }: {
  title: string; questions: FormQuestion[]; home: CardHome | null; backgroundEffects: boolean; welcomeTextEffects?: boolean; oneContact?: boolean; firstLast?: boolean; look?: FormLook | null; at: number
  /** beside the options on a wide card: as tall as they are (owner, 11/09) */
  fitH?: number
}) {
  const { user, agent, kit } = useAgentBits()
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [w, setW] = useState(300)
  const all = useMemo(() => [...coreQs(oneContact, firstLast), ...questions.map((q, i) => ({ id: `q${i}`, type: q.type || 'short_text', label: q.label, required: !!q.required, fields: q.fields?.map((f, k) => ({ id: `q${i}f${k}`, type: f.type || 'short_text', label: f.label, required: !!f.required })), options: q.options?.length ? q.options : null }))]
    .map(q => ({ ...q, locked: false })), [questions, oneContact, firstLast])
  const screens = useMemo(() => ['welcome', ...all.map(q => q.id), 'thankyou'], [all])
  const i = Math.min(at, screens.length - 1)
  const luxeOk = luxeAllowedFor(user) || !!user?.is_admin
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
      questions: all, focus: screens[i], backgroundEffects, welcomeTextEffects, look: look || brandFormLook(kit, luxeOk),
      branding: { title, agentName: agent.agentName || 'Your Name', agentBrokerage: agent.agentBrokerage || '', agentPhotoUrl: agent.agentPhotoUrl, agentTitle: agent.agentTitle },
      linkedProperty: home ? { listing_key: home.listing_key, address: home.address, city: home.city, state: home.state, price: home.price, beds: home.beds, baths: home.baths,
        sqft: home.sqft, status: home.status, image_url: home.photo } : null,
    } }, window.location.origin)
  }, [ready, all, screens, i, backgroundEffects, welcomeTextEffects, look, kit, luxeOk, title, agent, home])
  const PW = 390, PH = 700
  // A 390 x 700 phone, a little smaller now that the card shows one question under it (11/03)
  const s = fitH ? Math.min(w / PW, (fitH - 14) / PH) : Math.min(0.62, w / PW)
  return (
    <div ref={box} className={fitH ? '' : 'mb-2.5'} data-testid="ai-form-preview">
      <div className="mx-auto overflow-hidden rounded-[22px] bg-[#FAFAF7] shadow-md ring-[5px] ring-[#111827] dark:ring-zinc-700" style={{ width: PW * s, height: PH * s }}>
        <iframe ref={frame} src="/assistant/form-preview" title={`Preview of ${title}`} tabIndex={-1}
          className="pointer-events-none origin-top-left border-0" style={{ width: PW, height: PH, transform: `scale(${s})` }} />
      </div>
    </div>
  )
}

export function FormPick({ payload, picks, onPicks, onOpenEditor, onRevise, busy }: {
  payload: Record<string, any>; picks: FormPicks; onPicks: (p: FormPicks) => void; onOpenEditor?: () => void; busy?: boolean
  onRevise?: (instruction: string, at: number | null) => Promise<{ ok: boolean; message: string; focus?: number; oneContact?: boolean }>
}) {
  const homes = (payload.homes || []) as CardHome[]
  const steps = useSteps(homes.length ? ['questions', 'look', 'home', 'after'] : ['questions', 'look', 'after'])
  const cores = coreQs(picks.one_contact, picks.first_last)
  const firstOwn = cores.length + 1
  // The look: the brand look until they pick something else, then the form's own look with only
  // that changed - the same choices as the form editor's picker (owner, 11/04).
  const { user, kit } = useAgentBits()
  const luxeOk = luxeAllowedFor(user) || !!user?.is_admin
  const brandLook = useMemo(() => brandFormLook(kit, luxeOk), [kit, luxeOk])
  const isDark = picks.dark ?? brandLook.dark
  const wanted: FormLook = { ...brandLook, ...(picks.style || {}), dark: isDark }
  const sameAsBrand = wanted.theme === brandLook.theme && wanted.dark === brandLook.dark
    && (wanted.theme === 'luxe' ? wanted.metal === brandLook.metal : wanted.accent.toLowerCase() === brandLook.accent.toLowerCase())
  const shownLook = sameAsBrand ? null : wanted
  const pickStyle = (patch: NonNullable<FormPicks['style']>) => onPicks({ ...picks, style: { theme: wanted.theme, accent: wanted.accent, metal: wanted.metal, ...patch } })
  const lookName = wanted.theme === 'luxe' ? `Luxe ${LUXE_METALS[wanted.metal].label}` : HUB_CLASSIC_ACCENTS.find(a => a.color.toLowerCase() === wanted.accent.toLowerCase())?.label || 'Classic'
  useEffect(() => {
    if (JSON.stringify(picks.look ?? null) !== JSON.stringify(shownLook)) onPicks({ ...picks, look: shownLook })
  }, [JSON.stringify(shownLook)]) // eslint-disable-line react-hooks/exhaustive-deps
  const title = String(payload.title || 'Your form')
  // One screen at a time, the same screens as the preview (owner, 11/03): welcome, name/email/phone
  // (greyed - nothing to change), their questions, thank-you. A card that replaced one they asked to
  // change opens on that question (ai_routes._replace_open_form_cards).
  const [at, setAt] = useState(typeof payload.focus_q === 'number' ? coreQs(picks.one_contact, picks.first_last).length + 1 + payload.focus_q : 0)
  const [preview, setPreview] = useState(true)
  const last = picks.questions.length + cores.length + 1
  const i = Math.min(at, last)
  const own = i >= firstOwn && i < last ? i - firstOwn : null
  const q = own !== null ? picks.questions[own] : null
  const core = i >= 1 && i < firstOwn ? cores[i - 1] : null
  // "What should change or be added?" (owner, 11/03): the card itself changes - the preview and this
  // screen update right here and it moves to the changed (or first added) question. No new card.
  const [fix, setFix] = useState('')
  const [fixing, setFixing] = useState(false)
  const [fixNote, setFixNote] = useState<{ ok: boolean; text: string } | null>(null)
  const sendFix = async () => {
    const t = fix.trim()
    if (!t || fixing || !onRevise) return
    setFixing(true); setFixNote(null)
    const r = await onRevise(t, own)
    setFixing(false)
    if (r.ok) { setFix(''); if (r.oneContact !== undefined) setAt(1); else if (typeof r.focus === 'number') setAt(firstOwn + r.focus) }
    setFixNote({ ok: r.ok, text: r.message })
  }
  useEffect(() => { if (!fixing) setFixNote(n => (n?.ok ? n : null)) }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  // Adding: what the helper suggested, common ones for this kind of form, or their own typed in.
  const has = (b: FormQuestion) => picks.questions.some(x => x.label.toLowerCase() === b.label.toLowerCase())
  const ideas = ((payload.ideas || []) as FormQuestion[]).filter(b => !has(b))
  const bank = ((payload.bank || []) as FormQuestion[]).filter(b => !has(b) && !ideas.some(d => d.label.toLowerCase() === b.label.toLowerCase()))
  const [adding, setAdding] = useState(false)
  const [more, setMore] = useState(false)
  const [mine, setMine] = useState('')
  const add = (b: FormQuestion) => { onPicks({ ...picks, questions: [...picks.questions, b] }); setAt(firstOwn + picks.questions.length) }
  const addMine = () => { const t = mine.trim(); if (!t) return; add({ label: t, type: 'short_text' }); setMine('') }
  const home = homes.find(h => h.listing_key === picks.listing_key)
  const screenName = i === 0 ? 'Welcome screen' : i === last ? 'Thank-you screen' : `Question ${i} of ${last - 1}`
  // Every screen as a numbered step, between Back and Next - tap to jump. Theirs are gold, the contact
  // and welcome / thank-you screens grey; the one they're on is filled (owner, 11/04).
  const stepNumbers = (
<div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-0.5 gap-y-1 group-data-[wide=yes]/pick:gap-x-1.5" data-testid="ai-form-steps">
          {Array.from({ length: last + 1 }, (_, k) => {
            const on = k === i, mine = k >= firstOwn && k < last
            return (
              <button key={k} type="button" onClick={() => setAt(k)} aria-current={on ? 'step' : undefined}
                aria-label={k === 0 ? 'Welcome screen' : k === last ? 'Thank-you screen' : `Question ${k}`}
                className={`ohp-ai-press grid h-[22px] min-w-[22px] place-items-center rounded-full px-0.5 text-[10px] font-black transition group-data-[wide=yes]/pick:h-9 group-data-[wide=yes]/pick:min-w-9 group-data-[wide=yes]/pick:text-[14px] ${on
                  ? 'bg-[#111827] text-white ring-2 ring-[#C9A24D] ring-offset-1 ring-offset-white dark:bg-[#C9A24D] dark:text-[#111827] dark:ring-offset-zinc-900'
                  : mine ? 'bg-[#C9A24D]/15 text-[#8b7355] ring-1 ring-[#C9A24D]/40 dark:text-[#e8c97a]'
                  : 'bg-gray-100 text-gray-400 dark:bg-zinc-800 dark:text-zinc-500'}`}>
                {k === 0 ? <Home className="h-3 w-3 group-data-[wide=yes]/pick:h-4 group-data-[wide=yes]/pick:w-4" strokeWidth={3} /> : k === last ? <Check className="h-3 w-3 group-data-[wide=yes]/pick:h-4 group-data-[wide=yes]/pick:w-4" strokeWidth={3.5} /> : k}
              </button>
            )
          })}
        </div>
  )
  // A wide chat (computer, big window) puts a small preview on the left and the steps on the right
  // (owner, 11/04: the preview took the whole card). Goes by the card's own width.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cardW, setCardW] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setCardW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // 11/09 (owner: "forms have the preview on the left side and all the options on the right side"): wide
  // at the same card width as every other card (it was 720 - a 760px chat row never got there).
  const wide = cardW >= 600
  const optsRef = useRef<HTMLDivElement>(null)
  const [optsH, setOptsH] = useState(0)
  useEffect(() => {
    const el = optsRef.current
    if (!wide || !el) return
    const ro = new ResizeObserver(([e]) => setOptsH(Math.round(e.contentRect.height)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [wide])
  const afterChoices: [string, string][] = [
    ...(picks.listing_key ? [['property', 'That home'] as [string, string]] : []),
    ['agent_hub', 'My Agent Hub'], ['website', 'My website'], ['none', 'Stay on the thank-you'], ['custom', 'My own link'],
  ]
  const afterMode = picks.after_mode && afterChoices.some(c => c[0] === picks.after_mode) ? picks.after_mode : picks.listing_key ? 'property' : 'agent_hub'
  // A narrow card (a phone): Back and Next stack their arrow over the word, thick tiles that leave the
  // row to the numbers, so a long form still fits on one or two lines (owner, 11/04).
  const tight = cardW < 480
  const navBtn = `ohp-ai-press inline-flex h-12 shrink-0 items-center justify-center rounded-xl font-black shadow-sm disabled:opacity-30 ${tight ? 'w-[46px] flex-col text-[10.5px] leading-tight' : 'gap-1 px-4 text-[13px]'}`
  return (
    <div ref={wrapRef} className="group/pick mt-3 rounded-xl bg-[#faf7f0] p-1.5 sm:p-2.5 dark:bg-zinc-800/50" data-testid="ai-form-pick" data-wide={wide ? 'yes' : 'no'}>
     <div className={wide ? 'grid items-start gap-5' : undefined} style={wide ? { gridTemplateColumns: WIDE_CARD_COLUMNS(300) } : undefined}>
      {wide && <div className="sticky top-2 min-w-0" data-testid="ai-pick-preview"><FormPreview fitH={Math.max(420, Math.min(760, optsH || 520))} title={title} questions={picks.questions} backgroundEffects={picks.background_effects} welcomeTextEffects={picks.welcome_text_effects} oneContact={picks.one_contact} firstLast={picks.first_last} look={shownLook} home={home || null} at={steps.isOpen('look') ? 0 : i} /></div>}
     <div ref={optsRef} className="ohp-steps min-w-0">
      {onOpenEditor && (
        <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
          <p className="min-w-0 flex-1 text-[11.5px] font-semibold leading-snug text-gray-600 dark:text-zinc-300">Rather edit it in the full form editor?</p>
          <button type="button" onClick={onOpenEditor} disabled={busy} data-testid="ai-form-open-editor"
            className="ohp-ai-press inline-flex shrink-0 items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50 dark:bg-[#C9A24D] dark:text-[#111827]">
            Open in Forms <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
      )}
      <CardStep id="questions" n={1} title="Questions" summary={`${picks.questions.length} + name, email, phone`} steps={steps}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13.5px] font-black text-[#111827] dark:text-white" data-testid="ai-form-preview-label">{screenName}</span>
          {!wide && <button type="button" onClick={() => setPreview(v => !v)} aria-expanded={preview} data-testid="ai-form-preview-toggle"
            className="ohp-ai-press inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-black text-[#8b7355] ring-1 ring-[#C9A24D]/40 dark:bg-zinc-900 dark:text-[#e8c97a]">
            <Eye className="h-3 w-3" strokeWidth={3} /> {preview ? 'Hide preview' : 'Preview'}
          </button>}
        </div>
        <div>
        {preview && !wide && <FormPreview title={title} questions={picks.questions} backgroundEffects={picks.background_effects} welcomeTextEffects={picks.welcome_text_effects} oneContact={picks.one_contact} firstLast={picks.first_last} look={shownLook} home={home || null} at={i} />}
        <div className="min-w-0">
        {/* This screen: greyed when there's nothing to change, else the question with its fix bar */}
        <div className="ohp-ai-card-in rounded-xl bg-[#faf7f0]/60 p-2 ring-1 ring-black/5 sm:p-2.5 dark:bg-zinc-800/40 dark:ring-white/10" key={i} data-testid="ai-form-screen">
          {q ? (
            <>
              <div className="flex items-start gap-2">
                <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#C9A24D]/15 text-[10px] font-black text-[#8b7355] dark:text-[#e8c97a]">{i}</span>
                <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-[#111827] group-data-[wide=yes]/pick:text-[15px] dark:text-white">{q.label}</p>
                <button type="button" aria-label={`Take off: ${q.label}`} title="Take it off"
                  onClick={() => onPicks({ ...picks, questions: picks.questions.filter((_, k) => k !== own) })}
                  className="ohp-ai-press -mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {q.show_if && (
                <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-lg bg-[#C9A24D]/12 px-2 py-1 text-[11px] font-bold text-[#8b7355] dark:text-[#e8c97a]" data-testid="ai-form-fork">
                  <GitBranch className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">Only if &ldquo;{q.show_if.question}&rdquo; is {q.show_if.answers.join(' or ')}</span>
                  <button type="button" aria-label="Ask this of everyone" title="Ask this of everyone" className="ohp-ai-press -mr-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full hover:bg-black/5"
                    onClick={() => onPicks({ ...picks, questions: picks.questions.map((x, k) => (k === own ? { ...x, show_if: null } : x)) })}><X className="h-3 w-3" strokeWidth={3} /></button>
                </p>
              )}
              {/* Answer choices share a line when they fit */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">{Q_LABEL[q.type || 'short_text'] || 'Answer'}</span>
                {(q.fields || []).map(f => <span key={f.label} className="rounded-full border border-gray-200 px-2 py-0.5 text-[10.5px] font-semibold text-gray-600 dark:border-zinc-700 dark:text-zinc-300">{f.label}</span>)}
                {(q.options || []).map(o => <span key={o} className="rounded-full border border-gray-200 px-2 py-0.5 text-[10.5px] font-semibold text-gray-600 dark:border-zinc-700 dark:text-zinc-300">{o}</span>)}
              </div>
            </>
          ) : (
            <>
            <div className="flex items-center gap-2 text-gray-400 dark:text-zinc-500">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <p className="text-[12px] font-semibold leading-snug">
                {core ? (picks.one_contact ? `${picks.first_last ? 'First and last name' : 'Full name'}, email and phone, all on one screen. Every form asks these.` : `${core.label} - every form asks this.`)
                  : i === 0 ? 'The welcome screen shows your name, photo and the form’s title. Nothing to change here.'
                  : 'The thank-you screen. You can change its words later in the form editor.'}
              </p>
            </div>
            {core && !payload.contact_fixed && (
              <button type="button" role="switch" aria-checked={picks.one_contact} data-testid="ai-form-one-contact"
                onClick={() => { onPicks({ ...picks, one_contact: !picks.one_contact, first_last: picks.one_contact ? false : picks.first_last }); setAt(1) }}
                className="ohp-ai-press mt-2 flex w-full items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-2 text-left dark:bg-zinc-900">
                <span className="text-[12.5px] font-bold text-[#111827] dark:text-white">Name, email and phone on one screen</span>
                <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${picks.one_contact ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-zinc-600'}`}>
                  <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${picks.one_contact ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </span>
              </button>
            )}
            {core && !payload.contact_fixed && (
              <button type="button" role="switch" aria-checked={picks.first_last} data-testid="ai-form-first-last"
                onClick={() => { onPicks({ ...picks, first_last: !picks.first_last, one_contact: picks.first_last ? picks.one_contact : true }); setAt(1) }}
                className="ohp-ai-press mt-1.5 flex w-full items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-2 text-left dark:bg-zinc-900">
                <span className="text-[12.5px] font-bold text-[#111827] dark:text-white">First and last name on one line</span>
                <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${picks.first_last ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-zinc-600'}`}>
                  <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${picks.first_last ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </span>
              </button>
            )}
            </>
          )}
        </div>
        {/* One line for any change or addition - the card updates right here (owner, 11/03) */}
        {onRevise && (
          <div className="mt-2" data-testid="ai-form-fix">
            <div className="flex gap-1.5">
              <input value={fix} onChange={e => setFix(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendFix() } }} disabled={fixing}
                placeholder={q ? 'What should change or be added?' : 'Add a question - just say it'}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-800 outline-none focus:border-[#C9A24D] disabled:opacity-60 sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <button type="button" onClick={sendFix} disabled={!fix.trim() || fixing} aria-label="Make the change"
                className="ohp-ai-press grid w-10 shrink-0 place-items-center rounded-xl bg-[#8b7355] text-white disabled:opacity-40">
                {fixing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {fixing && <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">Changing it...</p>}
            {!fixing && fixNote && <p className={`mt-1 text-[11px] font-semibold ${fixNote.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} data-testid="ai-form-fix-note">{fixNote.text}</p>}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2" data-testid="ai-form-nav">
          <button type="button" onClick={() => setAt(i - 1)} disabled={i === 0} className={`${navBtn} bg-white text-[#111827] ring-1 ring-black/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10`}>
            <ChevronLeft className="h-4 w-4" strokeWidth={3} /> Back
          </button>
          {stepNumbers}
          {i < last ? (
            <button type="button" onClick={() => setAt(i + 1)} className={`${navBtn} bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]`} data-testid="ai-form-next">
              Next <ChevronRight className="h-4 w-4" strokeWidth={3} />
            </button>
          ) : (
            <StepDone onDone={() => steps.done('questions')} />
          )}
        </div>
        <button type="button" onClick={() => setAdding(v => !v)} aria-expanded={adding} data-testid="ai-form-add-toggle"
          className="ohp-ai-press mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-black text-[#8b7355] dark:text-[#e8c97a]">
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {adding ? 'Hide question ideas' : 'Add a question'}
        </button>
        {adding && (
          <>
            {/* Ideas made for this form, then common ones for this kind of form - short ones share a line */}
            {[{ title: 'Ideas for this form', list: ideas }, { title: 'Common ones', list: more ? bank : bank.slice(0, 3) }].filter(g => g.list.length).map(g => (
              <div key={g.title} className="mt-2">
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">{g.title}</p>
                <div className="flex flex-wrap gap-1" data-testid={g.title === 'Common ones' ? 'ai-form-bank' : 'ai-form-ideas'}>
                  {g.list.map(b => (
                    <button key={b.label} type="button" onClick={() => add(b)} title={Q_LABEL[b.type || 'short_text'] || undefined}
                      className="ohp-ai-press inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-[#C9A24D]/50 bg-white/70 py-1 pl-2 pr-2.5 text-left hover:border-[#C9A24D] dark:bg-zinc-900/60">
                      <Plus className="h-3 w-3 shrink-0 text-[#C9A24D]" strokeWidth={3} />
                      <span className="min-w-0 text-[11.5px] font-semibold leading-snug text-gray-700 dark:text-zinc-200">{b.label}</span>
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
            <div className="mt-2 flex gap-1.5">
              <input value={mine} onChange={e => setMine(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMine() } }} placeholder="Your own question"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-800 outline-none focus:border-[#C9A24D] sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              <button type="button" onClick={addMine} disabled={!mine.trim()} className="rounded-xl bg-[#111827] px-3 text-[11px] font-black text-white disabled:opacity-40 dark:bg-[#C9A24D] dark:text-[#111827]">Add</button>
            </div>
          </>
        )}
        </div>
        </div>
      </CardStep>
      <CardStep id="look" n={2} title="Look" summary={`${lookName} · ${isDark ? 'Dark' : 'Light'}`} steps={steps}>
        {/* The same choices as the form editor, with the form beside them (owner, 11/04) */}
        <div>
          {!wide && steps.isOpen('look') && <FormPreview title={title} questions={picks.questions} backgroundEffects={picks.background_effects} welcomeTextEffects={picks.welcome_text_effects} oneContact={picks.one_contact} firstLast={picks.first_last} look={shownLook} home={home || null} at={0} />}
          <div className="min-w-0 space-y-1.5" data-testid="ai-form-look">
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Style">
              {([['classic', 'Classic'], ['luxe', 'Luxe']] as const).map(([t, label]) => (
                <button key={t} type="button" aria-pressed={wanted.theme === t} disabled={t === 'luxe' && !luxeOk} onClick={() => pickStyle({ theme: t })} data-testid={`ai-form-${t}`}
                  className={`ohp-ai-press h-10 rounded-xl text-[13px] font-black transition-colors disabled:opacity-60 ${wanted.theme === t ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-black/10 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10'}`}>
                  {label}{t === 'luxe' && !luxeOk && <span className="ml-1.5 whitespace-nowrap rounded-full bg-[#111827] px-1.5 py-0.5 text-[9px] font-black tracking-wider text-[#e8c97a]">{luxeUpgrade(user?.plan_tier).label}</span>}
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-white px-2.5 py-2 dark:bg-zinc-900" data-testid="ai-form-colors">
              <p className="mb-1.5 text-[11px] font-black text-[#111827] dark:text-white">{wanted.theme === 'luxe' ? `Finish: ${LUXE_METALS[wanted.metal].label}` : `Color: ${lookName === 'Classic' ? 'Your own' : lookName}`}</p>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={wanted.theme === 'luxe' ? 'Finish' : 'Color'}>
                {wanted.theme === 'luxe'
                  ? LUXE_METAL_ORDER.map((m: LuxeMetal) => {
                    const c = LUXE_METALS[m]
                    return <button key={m} type="button" role="radio" aria-checked={wanted.metal === m} aria-label={c.label} title={c.label} onClick={() => pickStyle({ metal: m })} data-testid={`ai-form-metal-${m}`}
                      className={`ohp-ai-press h-8 w-8 rounded-full ring-1 ring-black/10 ${wanted.metal === m ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`}
                      style={{ background: `conic-gradient(from 210deg, ${c.deep}, ${c.light}, ${c.pale}, ${c.base}, ${c.deep})` }} />
                  })
                  : HUB_CLASSIC_ACCENTS.map(a => (
                    <button key={a.color} type="button" role="radio" aria-checked={wanted.accent.toLowerCase() === a.color.toLowerCase()} aria-label={a.label} title={a.label} onClick={() => pickStyle({ accent: a.color })} data-testid={`ai-form-color-${a.label.toLowerCase().replace(/ /g, '-')}`}
                      className={`ohp-ai-press h-8 w-8 rounded-full ring-1 ring-black/10 ${wanted.accent.toLowerCase() === a.color.toLowerCase() ? 'ring-2 ring-[#111827] ring-offset-2 dark:ring-white dark:ring-offset-zinc-900' : ''}`}
                      style={{ background: a.color }} />
                  ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Light or dark">
              {([[false, 'Light'], [true, 'Dark']] as const).map(([d, label]) => (
                <button key={label} type="button" aria-pressed={isDark === d} onClick={() => onPicks({ ...picks, dark: d })} data-testid={`ai-form-${label.toLowerCase()}`}
                  className={`ohp-ai-press h-10 rounded-xl text-[13px] font-black transition-colors ${isDark === d ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-black/10 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10'}`}>{label}</button>
              ))}
            </div>
            {([['background_effects', 'Background effects', 'A quiet street of homes behind the form', 'ai-form-bg'], ['welcome_text_effects', 'Welcome text effects', 'The welcome words glide in one by one', 'ai-form-welcome']] as const).map(([k, label, blurb, id]) => (
              <button key={k} type="button" role="switch" aria-checked={picks[k]} onClick={() => onPicks({ ...picks, [k]: !picks[k] })} data-testid={id}
                className="ohp-ai-press flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left dark:bg-zinc-900">
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-[#111827] dark:text-white">{label}</span>
                  <span className="block text-[11px] font-semibold leading-snug text-gray-500 dark:text-zinc-400">{blurb}</span>
                </span>
                <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${picks[k] ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-zinc-600'}`}>
                  <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${picks[k] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </span>
              </button>
            ))}
            {!sameAsBrand && (
              <button type="button" onClick={() => onPicks({ ...picks, style: null, dark: null })} data-testid="ai-form-brand-look"
                className="ohp-ai-press w-full rounded-xl py-1.5 text-[11.5px] font-black text-[#8b7355] dark:text-[#e8c97a]">Use my Brand Kit look</button>
            )}
            <StepDone onDone={() => steps.done('look')} />
          </div>
        </div>
      </CardStep>
      {homes.length > 0 && (
        <CardStep id="home" n={3} title="About a home?" summary={home ? home.address : 'No'} steps={steps}>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { onPicks({ ...picks, listing_key: null, after_mode: picks.after_mode === 'property' ? null : picks.after_mode }); steps.picked('home') }} aria-pressed={!picks.listing_key} className={chip(!picks.listing_key)}>No</button>
            {homes.map(h => {
              const on = picks.listing_key === h.listing_key
              return (
                <button key={h.listing_key} type="button" onClick={() => { onPicks({ ...picks, listing_key: h.listing_key, after_mode: 'property' }); steps.picked('home') }} aria-pressed={on} title={`${h.address}, ${h.city}`}
                  className={`${chip(on)} inline-flex items-center gap-1.5 !py-1 !pl-1`} data-testid="ai-form-home">
                  {h.photo ? <img src={resolveMediaUrl(h.photo)} alt="" className="h-5 w-5 rounded-full object-cover" /> : <Home className="ml-1 h-3.5 w-3.5" />}
                  {h.address}
                </button>
              )
            })}
          </div>
        </CardStep>
      )}
      {/* Where the thank-you sends them, the same choices as the form editor (owner, 11/04). A form
          about a home goes to that home unless they pick something else. */}
      <CardStep id="after" n={homes.length ? 4 : 3} title="After the thank-you" summary={afterMode === 'none' ? 'Stay here' : afterChoices.find(c => c[0] === afterMode)?.[1] || ''} steps={steps}>
        <div className="flex flex-wrap gap-1.5" data-testid="ai-form-after">
          {afterChoices.map(([m, label]) => (
            <button key={m} type="button" aria-pressed={afterMode === m} onClick={() => { onPicks({ ...picks, after_mode: m }); if (m !== 'custom') steps.picked('after') }} className={chip(afterMode === m)} data-after={m}>{label}</button>
          ))}
        </div>
        {afterMode === 'custom' && (
          <input value={picks.after_url} onChange={e => onPicks({ ...picks, after_url: e.target.value })} placeholder="yourwebsite.com/page" inputMode="url" data-testid="ai-form-after-url"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-800 outline-none focus:border-[#C9A24D] sm:text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" />
        )}
      </CardStep>
     </div>
     </div>
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
  remove_showcase_homes: ['Taking the homes out...', 'Updating their Showcase...'],
  create_form: ['Building your form...', 'Adding the questions...'],
  edit_form: ['Saving your changes...', 'Updating the form...'],
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
