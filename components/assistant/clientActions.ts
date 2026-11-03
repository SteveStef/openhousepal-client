'use client'

// Things the AI helper makes IN THE BROWSER after the agent taps Confirm (owner, 10/30) - a Studio
// design is built from the same templates, rules and profile checks the Studio's own "new design"
// steps use (DesignCreateFlow), so a design made in chat is the same design made on the page.
import api from '@/lib/api-service'
import { LinkedProperty, User } from '@/types'
import { fetchLinkedProperty } from '@/components/studio/PropertySelector'
import { getSituation } from '@/lib/studio/designSituations'
import { getDesignFormat } from '@/lib/studio/designFormats'
import { getTemplatesFor, isCompositionReady } from '@/lib/studio/designTemplates'
import { profileGaps } from '@/lib/studio/designCompliance'
import { designAgentFrom } from '@/lib/studio/designAgent'
import { tidyAllCaps } from '@/lib/cheatSheetContent'

export interface ClientResult { ok: boolean; message: string; link?: string; made?: Record<string, unknown> }

function timeOfDay(value?: string): string {
  if (!value) return ''
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h)) return value
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function longDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/** What the agent's profile still lacks for this design ("your headshot and your mobile number"),
 *  or '' - the design card checks it as soon as it shows (11/02: it only said so after Make it). */
export async function designProfileMissing(formatId: string, user: User | null): Promise<string> {
  const format = getDesignFormat(formatId)
  const hub = await api.agentHub.getMine().catch(() => null)
  const labels = profileGaps(designAgentFrom(user, hub?.success ? hub.data : null), !!format?.isPrint).map(g => g.label.toLowerCase())
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}` : labels[0] || ''
}

async function createDesign(p: Record<string, any>, user: User | null): Promise<ClientResult> {
  const situation = getSituation(p.situation)
  const format = getDesignFormat(p.format)
  if (!situation || !format || !situation.formats.includes(p.format)) return { ok: false, message: "That kind of design isn't available." }

  // The Studio's advertising rule: nothing gets made until the profile has what every ad must show.
  const missing = await designProfileMissing(p.format, user)
  if (missing) {
    return { ok: false, message: `Add ${missing} to your profile first - every ad has to show them.`, link: '/settings' }
  }

  let property: LinkedProperty | null = null
  if (situation.propertyAttached) {
    const found = await fetchLinkedProperty(p.address || '', undefined, p.listing_key || undefined)
    property = found.property
    if (!property) return { ok: false, message: found.error || "I couldn't load that home's details." }
  }

  const templates = getTemplatesFor(p.situation, p.format).filter(t => isCompositionReady(t.composition))
  const template = templates.find(t => t.composition === p.layout) || templates[0]
  if (!template) return { ok: false, message: "That design doesn't have a ready layout yet." }

  const messaging = p.headline ? { id: 'custom', headline: String(p.headline) } : situation.messagingVariants?.[0]
  const blocks = template.buildBlocks(situation.propertyAttached ? property : null, messaging, {
    heroPhoto: situation.propertyAttached ? (p.photo ? String(p.photo) : null) : undefined,
    heroFocal: situation.propertyAttached && p.focal && typeof p.focal.x === 'number' ? { x: Number(p.focal.x), y: Number(p.focal.y) } : null,
    openHouseDate: longDate(p.open_house_date),
    openHouseTime: p.start_time && p.end_time ? `${timeOfDay(p.start_time)} – ${timeOfDay(p.end_time)}` : timeOfDay(p.start_time),
    qrTarget: situation.propertyAttached ? undefined : 'agent_hub',
    priceMode: 'listing',
  })
  // "Open House Flyer — 417 Dogwood Ln" (not "Open House Open House Flyer — 417 DOGWOOD LN")
  const kind = format.label.toLowerCase().startsWith(situation.label.toLowerCase()) ? format.label : `${situation.label} ${format.label}`
  const name = `${kind}${property ? ` — ${tidyAllCaps(property.address)}` : messaging?.headline ? ` — ${messaging.headline}` : ''}`
  const res = await api.designs.create({
    design_type: format.designType,
    style_id: 'modern_luxury',
    template_id: template.id,
    situation: p.situation,
    color_mode: p.colors || 'light',
    name,
    linked_property: situation.propertyAttached ? property : null,
    blocks,
    branding_mode: 'personal',
    campaign_id: null,
  } as any)
  if (!res.success || !res.data) return { ok: false, message: res.error || 'Something went wrong making that design.' }
  return {
    ok: true,
    message: 'Made - it\'s in your Studio too.',
    link: `/studio/design/${res.data.id}`,
    made: { kind: 'design', design_id: res.data.id, title: name, is_print: format.isPrint ? 'yes' : '' },
  }
}

// An Open House Kit (11/01): the card's choices go to the Opens page's own kit maker, which runs its
// steps with them and stops on Review & Save. Already on Opens: it starts there (no reload); anywhere
// else the chat moves the page there (and steps aside).
function buildKit(p: Record<string, any>): ClientResult {
  const home = ((p.homes || []) as any[]).find(h => h.listing_key === p.listing_key)
  if (!home) return { ok: false, message: "I couldn't find that home - nothing was made." }
  const auto = { listing_key: home.listing_key, lat: home.lat ?? null, lng: home.lng ?? null, cover: p.cover || null,
    similar: p.similar !== false, cheatSheet: p.cheatSheet !== false, autoShowcase: p.autoShowcase !== false, guestPass: p.guestPass !== false,
    followupsMode: ['on', 'no_calendar', 'off'].includes(p.followupsMode) ? p.followupsMode : 'on' }
  const address = home.address || [home.street, home.city].filter(Boolean).join(', ')
  if (window.location.pathname === '/open-houses') {
    window.dispatchEvent(new CustomEvent('ohp:chat-kit', { detail: { address, auto } }))
  } else {
    window.dispatchEvent(new CustomEvent('ohp:navigate', { detail: `/open-houses?kit=${encodeURIComponent(address)}&chatkit=${encodeURIComponent(JSON.stringify(auto))}` }))
  }
  return { ok: true, message: `Building the kit for ${home.street || address} on your Opens page - look it over and tap Save.`, link: '/open-houses' }
}

export async function runClientAction(kind: string, payload: Record<string, unknown>, user: User | null): Promise<ClientResult> {
  try {
    if (kind === 'create_design') return await createDesign(payload as Record<string, any>, user)
    if (kind === 'build_open_house_kit') return buildKit(payload as Record<string, any>)
    return { ok: false, message: "This chat can't make that yet." }
  } catch {
    return { ok: false, message: 'Something went wrong - nothing was made.' }
  }
}
