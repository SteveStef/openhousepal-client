// Invites (Forms & Invites -> Invites) - shared types, the API calls, and small helpers used by the
// creation flow, the agent's results and the guest's public invitation page (/i/<code>).
// Backend: app/api/invites_routes.py + app/services/invites_service.py.
import { API_BASE_URL } from '@/lib/api-service'
import { getToken } from '@/lib/token'

export type InviteType = 'open_house' | 'brokers_open' | 'client_event' | 'custom'
export type InviteAudience = 'clients' | 'agents'
export type InviteDesign = 'classic' | 'garden' | 'midnight' | 'modern'
export type RsvpResponse = 'yes' | 'maybe' | 'no'

/** The forms question shape (FormQuestion) plus `role` - what a pre-made question means. */
export type InviteQuestion = {
  id: string
  type: 'short_text' | 'long_text' | 'select' | 'multi_select' | 'number' | 'phone' | 'email' | 'date'
  label: string
  options?: string[]
  required?: boolean
  placeholder?: string
  helper_text?: string
  role?: 'guests' | 'represented' | 'brokerage'
}

export type InviteProperty = {
  listing_key?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  image?: string | null
  photos?: string[] | null
  /** The agent picked "No photo" (the home's photos still show lower on the page). */
  no_cover?: boolean | null
}

export type InviteCounts = { yes: number; maybe: number; no: number; guests_yes: number; guests_maybe: number; unseen: number; last_rsvp_at: string | null }

/** One day of an invite (10/24: an invite can have several - pick scheduled open houses and/or add days). */
export type InviteDay = { date: string; start?: string | null; end?: string | null }
export type InviteMotion = 'normal' | 'luxe'
export type InviteMetal = 'gold' | 'silver' | 'bronze'
/** A scheduled open house for the picked home (ours or Bright's) - the date step's first picks. */
export type ScheduledSlot = InviteDay & { source: 'ohp' | 'bright' }

export type InviteDraft = {
  invite_type: InviteType
  audience?: InviteAudience
  title: string
  /** The flyer's line 2 as the agent typed it (round 8): null = automatic (the town), '' = none. */
  subtitle?: string | null
  message?: string | null
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  place_name?: string | null
  address?: string | null
  linked_property?: InviteProperty | null
  cover_image_url?: string | null
  design: InviteDesign
  accent_color?: string | null
  questions: InviteQuestion[]
  /** Days after the first (event_date / start_time / end_time is always the first). */
  extra_dates?: InviteDay[]
  motion?: InviteMotion
  /** A Luxe metal colour was picked (accent_color is then that metal's base tone). */
  luxe_metal?: InviteMetal | null
  /** Where the cover photo sits (% from left / top) - dragged in the builder. */
  cover_position?: { x: number; y: number } | null
  /** The agent's open house for this home - the guest page's Cheat Sheet + requests. */
  open_house_event_id?: string | null
}

export type Invite = InviteDraft & {
  id: string
  code: string
  audience: InviteAudience
  status: 'live' | 'closed'
  view_count: number
  when_label: string
  is_past: boolean
  /** Every day, soonest first. */
  dates: InviteDay[]
  share_url: string
  platform_url: string
  created_at: string | null
  updated_at: string | null
  counts: InviteCounts
}

export type InviteRsvp = {
  id: string
  response: RsvpResponse
  name: string | null
  email?: string | null
  phone?: string | null
  guest_count: number
  answers: { questionId: string; label: string; type: string; value: string | string[] }[]
  lead_id?: string | null
  is_seen?: boolean
  created_at: string | null
  updated_at: string | null
  token?: string
  updated?: boolean
  days?: string[]
  is_agent?: boolean | null
  has_agent?: boolean | null
  /** lead | agent | represented | declined (invites_service.lead_kind_of) - agent view only. */
  lead_kind?: 'lead' | 'agent' | 'represented' | 'declined' | null
  still_interested?: boolean | null
  keep_updated?: boolean | null
  requests?: Record<string, unknown>
}

export type InviteRequestKind = 'disclosure' | 'second_tour' | 'updates'

export type InviteDetail = Invite & { rsvps: InviteRsvp[]; recipients: { total: number; waiting: number } }

export type InviteAgent = {
  name: string; title: string; brokerage: string; photo_url?: string | null
  /** Service area (the profile's market - the same field the Agent Hub and signature show). */
  market?: string
  phone: string; text_phone: string; email: string; hub_slug?: string | null; logo_url?: string | null
  id?: string; first_name?: string
}

export type PublicInvite = Omit<Invite, 'counts' | 'view_count'> & {
  host_ok: boolean; agent: InviteAgent
  /** The open house's Cheat Sheet (the Guest Pass's), when the invite belongs to one. */
  cheat_sheet?: { property: any; amenities: any } | null
}

export type InvitePreset = {
  id: InviteType; label: string; blurb: string; audience: InviteAudience; design: InviteDesign
  title: string; message: string; questions: InviteQuestion[]
}

export type InvitePresets = {
  presets: InvitePreset[]; brand: { accent_color: string; logo_url?: string | null }; share_base: string
  /** The invite footer's agent (round 5): from the Agent Hub profile, like the signature. */
  host?: { name: string; brokerage: string; market: string; photo_url?: string | null }
}

type Res<T> = { success: true; data: T } | { success: false; error: string }

async function call<T>(path: string, init: RequestInit = {}, auth = true): Promise<Res<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> || {}) }
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
    const text = await r.text()
    let data: any = null
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    if (!r.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : Array.isArray(data?.detail) ? data.detail.map((d: any) => d.msg).join(', ') : 'Something went wrong - please try again.'
      return { success: false, error: detail }
    }
    return { success: true, data: data as T }
  } catch {
    return { success: false, error: 'Could not reach OpenHousePal - check your connection and try again.' }
  }
}

export const invitesApi = {
  presets: () => call<InvitePresets>('/invites/presets'),
  list: () => call<Invite[]>('/invites'),
  get: (id: string) => call<InviteDetail>(`/invites/${id}`),
  create: (draft: InviteDraft) => call<Invite>('/invites', { method: 'POST', body: JSON.stringify(draft) }),
  update: (id: string, draft: InviteDraft) => call<Invite>(`/invites/${id}`, { method: 'PUT', body: JSON.stringify(draft) }),
  duplicate: (id: string) => call<Invite>(`/invites/${id}/duplicate`, { method: 'POST' }),
  setStatus: (id: string, status: 'live' | 'closed') => call<Invite>(`/invites/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  markSeen: (id: string) => call<null>(`/invites/${id}/seen`, { method: 'POST' }),
  remove: (id: string) => call<null>(`/invites/${id}`, { method: 'DELETE' }),
  send: (id: string, recipients: { email: string; name?: string }[]) =>
    call<{ sent: number; sent_to: string[]; skipped: { email: string; reason: string }[] }>(`/invites/${id}/send`, { method: 'POST', body: JSON.stringify({ recipients }) }),
  resend: (id: string) => call<{ sent: number; sent_to: string[]; skipped: { email: string; reason: string }[] }>(`/invites/${id}/resend`, { method: 'POST' }),
  scheduled: (listingKey?: string | null, address?: string | null) => {
    const q = new URLSearchParams()
    if (listingKey) q.set('listing_key', listingKey)
    if (address) q.set('address', address)
    return call<{ slots: ScheduledSlot[]; open_house_event_id: string | null }>(`/invites/scheduled?${q.toString()}`)
  },
  // ---- the guest's side (no login)
  publicGet: (code: string, host?: string) => call<PublicInvite>(`/invites/public/${encodeURIComponent(code)}${host ? `?host=${encodeURIComponent(host)}` : ''}`, {}, false),
  publicView: (code: string) => call<null>(`/invites/public/${encodeURIComponent(code)}/view`, { method: 'POST' }, false),
  publicMine: (code: string, token: string) => call<InviteRsvp>(`/invites/public/${encodeURIComponent(code)}/rsvp/${encodeURIComponent(token)}`, {}, false),
  publicRsvp: (code: string, body: {
    response: RsvpResponse; name: string; email?: string; phone?: string; answers: { questionId: string; value: unknown }[]; token?: string
    days?: string[]; is_agent?: boolean | null; has_agent?: boolean | null; still_interested?: boolean | null; keep_updated?: boolean | null
  }) =>
    call<InviteRsvp>(`/invites/public/${encodeURIComponent(code)}/rsvp`, { method: 'POST', body: JSON.stringify(body) }, false),
  publicRequest: (code: string, body: { kind: InviteRequestKind; token?: string; name?: string; email?: string; phone?: string; times?: string; is_agent?: boolean | null; has_agent?: boolean | null }) =>
    call<{ sent: boolean; already: boolean }>(`/invites/public/${encodeURIComponent(code)}/request`, { method: 'POST', body: JSON.stringify(body) }, false),
}

/** Apple / Outlook calendar file - every day, or just the days given. */
export const icsUrl = (code: string, days?: string[] | null) =>
  `${API_BASE_URL}/invites/public/${encodeURIComponent(code)}/ics${days && days.length ? `?days=${days.join(',')}` : ''}`

/** Every day of a draft / invite, soonest first (the first is event_date / start_time / end_time). */
export function allDays(d: Pick<InviteDraft, 'event_date' | 'start_time' | 'end_time' | 'extra_dates'>): InviteDay[] {
  const out: InviteDay[] = []
  if (d.event_date) out.push({ date: d.event_date, start: d.start_time || null, end: d.end_time || null })
  for (const x of d.extra_dates || []) if (x?.date && !out.some(o => o.date === x.date)) out.push({ date: x.date, start: x.start || null, end: x.end || null })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** The other way round: a list of days -> the draft's first day + extra_dates. */
export function daysPatch(days: InviteDay[]): Pick<InviteDraft, 'event_date' | 'start_time' | 'end_time' | 'extra_dates'> {
  const s = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const first = s[0]
  return { event_date: first?.date || null, start_time: first?.start || null, end_time: first?.end || null, extra_dates: s.slice(1).map(x => ({ date: x.date, start: x.start || null, end: x.end || null })) }
}

const dayShort = (s: string) => parseDay(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
/** "Saturday, November 8 · 1 - 3 PM"; several days: "Sat, Nov 8 & Sun, Nov 9 · 1 - 3 PM" or each with its own hours. */
export function daysText(days: InviteDay[]): string {
  if (!days.length) return ''
  if (days.length === 1) return whenText({ event_date: days[0].date, start_time: days[0].start, end_time: days[0].end })
  const same = new Set(days.map(d => `${d.start}|${d.end}`)).size === 1
  if (same) {
    const names = days.map(d => dayShort(d.date))
    const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
    const rng = clockRange(days[0].start, days[0].end)
    return rng ? `${joined} · ${rng}` : joined
  }
  return days.map(d => [dayShort(d.date), clockRange(d.start, d.end)].filter(Boolean).join(' · ')).join(' / ')
}

// ---------------------------------------------------------------- helpers

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const clock = (v?: string | null) => {
  if (!v) return ''
  const [h, m] = v.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
export const clockRange = (a?: string | null, b?: string | null) => {
  if (!a) return ''
  if (!b) return clock(a)
  const x = clock(a), y = clock(b)
  return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)} - ${y}` : `${x} - ${y}`
}
export const dayLong = (s?: string | null) => s ? parseDay(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''
export const whenText = (d: Pick<InviteDraft, 'event_date' | 'start_time' | 'end_time'>) =>
  [dayLong(d.event_date), clockRange(d.start_time, d.end_time)].filter(Boolean).join(' · ')

export const placeText = (d: Pick<InviteDraft, 'place_name' | 'address'>) => [d.place_name, d.address].filter(Boolean).join(', ')

export function mapsUrl(address?: string | null) {
  return address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : ''
}

/** "Add to Google Calendar" - times are Eastern wall clock, like the rest of the app. */
export function googleCalendarUrl(src: Pick<InviteDraft, 'title' | 'event_date' | 'start_time' | 'end_time' | 'message' | 'place_name' | 'address'>, link: string, oneDay?: InviteDay | null) {
  // One of several days: that day's date + hours.
  const inv = oneDay ? { ...src, event_date: oneDay.date, start_time: oneDay.start || null, end_time: oneDay.end || null } : src
  if (!inv.event_date) return ''
  const ymd = inv.event_date.replace(/-/g, '')
  const t = (v: string) => v.replace(':', '') + '00'
  const start = inv.start_time ? `${ymd}T${t(inv.start_time)}` : ymd
  let end = inv.end_time ? `${ymd}T${t(inv.end_time)}` : ''
  if (!end) {
    if (inv.start_time) {
      const [h, m] = inv.start_time.split(':').map(Number)
      end = `${ymd}T${pad(Math.min(23, h + 2))}${pad(m)}00`
    } else {
      const d = parseDay(inv.event_date); d.setDate(d.getDate() + 1); end = isoDay(d).replace(/-/g, '')
    }
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: inv.title, dates: `${start}/${end}`, ctz: 'America/New_York', details: [inv.message, link].filter(Boolean).join('\n\n'), location: placeText(inv) })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

export function initialsOf(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'OH'
}

// ---------------------------------------------------------------- colour

const hex6 = (v?: string | null) => {
  const h = (v || '').trim()
  return /^#[0-9a-f]{6}$/i.test(h) ? h : '#C9A24D'
}
export function mix(a: string, b: string, t: number) {
  const x = parseInt(hex6(a).slice(1), 16), y = parseInt(hex6(b).slice(1), 16)
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t)
  return `#${[16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('')}`
}
export function lum(hex: string) {
  const n = parseInt(hex6(hex).slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
export const accentOf = (v?: string | null) => hex6(v)
/** Text that reads on top of the accent colour. */
export const onAccent = (v?: string | null) => (lum(hex6(v)) > 0.6 ? '#111827' : '#FFFFFF')

export const INVITE_COLORS = ['#C9A24D', '#1F3A5F', '#4F6F52', '#B5654A', '#9C4F6B', '#5B4B8A', '#111827', '#2F6F73']

/** The two animation types (10/24): Normal = the envelope; Luxe = the black-lacquer, gold-foil
 *  opening and a page that keeps moving. */
export const MOTIONS: { id: InviteMotion; label: string; note: string }[] = [
  { id: 'normal', label: 'Normal', note: 'A paper envelope that opens to the card' },
  { id: 'luxe', label: 'Luxe', note: 'Lacquer, foil and light - a cinematic reveal' },
]

export const DESIGNS: { id: InviteDesign; label: string; note: string }[] = [
  { id: 'classic', label: 'Classic', note: 'Ivory card, fine border, timeless' },
  { id: 'garden', label: 'Garden', note: 'Soft botanicals, warm and welcoming' },
  { id: 'midnight', label: 'Midnight', note: 'Dark and dramatic, metallic accents' },
  { id: 'modern', label: 'Modern', note: 'Big photo, bold type, clean' },
]

export const TYPE_META: Record<InviteType, { label: string; short: string; who: string }> = {
  open_house: { label: 'Open House', short: 'Open House', who: 'Buyers, neighbors & clients' },
  brokers_open: { label: "Broker's Open", short: "Broker's Open", who: 'Other agents' },
  client_event: { label: 'Client Event / Dinner', short: 'Client Event', who: 'Your clients' },
  custom: { label: 'Custom', short: 'Custom', who: 'Anyone you like' },
}

export const RSVP_WORD: Record<RsvpResponse, string> = { yes: 'Coming', maybe: 'Maybe', no: "Can't make it" }
