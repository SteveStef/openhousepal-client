import { autoFeatured } from './features'
import type { TownFacts } from './TownSection'

// Shared data model for both Listing Spotlight templates (CinematicLuxuryTemplate /
// EditorialEstateTemplate). Everything here is a pure function of the resolve payload
// (backend/app/api/public_property_site_routes.resolve_property_site), so both templates make the
// exact same "does this section have real content?" decisions - a section only renders when the
// listing actually has something to put in it, never a placeholder or an empty box.

export interface PropertySiteAgent {
  name: string
  title?: string | null
  phone?: string | null
  /** The number they text from (blank = phone). */
  text_phone?: string | null
  email?: string | null
  website?: string | null
  license_number?: string | null
  brokerage?: string | null
  brokerage_logo_url?: string | null
  photo_url?: string | null
  bio?: string | null
  social_links?: { id?: string | null; label?: string | null; url: string }[]
  // The agent's published Agent Hub, when they have one ("More from this agent").
  hub_url?: string | null
}

export interface PropertySiteOpenHouse {
  id?: string
  date?: string | null
  start_time?: string | null
  end_time?: string | null
  source?: 'open_house_manager' | 'mls' | 'manual' | string
}

export interface PropertySiteChapter {
  id: string
  type: string
  label: string
  enabled: boolean
  photos: string[]
  copy: string
}

export interface PropertySiteFeatures {
  interior: string[]; exterior: string[]; lifestyle: string[]; community: string[]; other: string[]
}

export interface PropertySiteProperty {
  address: string; city?: string | null; state?: string | null; zipcode?: string | null
  price?: number | null; original_list_price?: number | null; status?: string | null
  beds?: number | null; baths?: number | null; sqft?: number | null
  above_grade_finished_area?: number | null; below_grade_finished_area?: number | null
  lot_size?: number | null; lot_size_acres?: number | null; year_built?: number | null
  description?: string | null; photos: string[]; latitude?: number | null; longitude?: number | null
  county?: string | null; township?: string | null; subdivision_name?: string | null
  school_district_name?: string | null; elementary_school?: string | null
  middle_or_junior_school?: string | null; high_school?: string | null
  listing_key?: string | null; mls_number?: string | null
  home_type?: string | null; property_type?: string | null; architectural_style?: string[] | null
  stories?: number | null; garage_spaces?: number | null; has_garage?: boolean | null
  association_fee?: number | null; association_fee_frequency?: string | null
  association_fee_includes?: string[] | null
  tax_annual_amount?: number | null; tax_year?: number | null
  heating?: string[] | null; cooling?: string[] | null; flooring?: string[] | null; basement?: string[] | null
  parking_features?: string[] | null; fireplaces?: number | null; water_source?: string[] | null; sewer?: string[] | null
  new_construction?: boolean | null
  days_on_market?: number | null; price_changed_at?: string | null; listed_at?: string | null
  list_office_name?: string | null
  features: PropertySiteFeatures
}

export interface TownPhoto { url: string; credit?: string | null; caption?: string | null; source_url?: string | null }

// How the top of the page moves: the main photo (with a slow zoom), a slideshow of the listing
// photos, or the AI "living photo" loop. motion applies to the photo and slideshow modes.
export type HeaderMode = 'photo' | 'cycle' | 'video'
export type HeaderMotion = 'in' | 'out' | 'both' | 'none'
/** The main photo's framing: the spot kept centered (0-100 of the photo) and how far the slow
 *  zoom travels (1 = none). x / y = on a computer; px / py = on a phone (a tall header often
 *  needs its own spot - the computer's when missing). desk_set / phone_set = the agent picked
 *  each one in "Frame your photo" (both are required). */
export interface HeroFrame { x: number; y: number; zoom: number; px?: number; py?: number; desk_set?: boolean; phone_set?: boolean }

export interface SpotlightHeader {
  mode?: HeaderMode
  motion?: HeaderMotion
  frame?: HeroFrame | null
  video?: { asset_id?: string | null; style?: string | null; photo?: string | null; url?: string | null; poster?: string | null; reviewed?: boolean } | null
}

export interface PropertySiteResolveResponse {
  /** Set when the listing agent's Email Signature card should close the page. */
  signature_hub_slug?: string | null
  site_id: string
  slug: string
  template_id: string
  property: PropertySiteProperty
  content: {
    hero_image?: string | null
    description_override?: string | null
    featured_amenities?: string[]
    virtual_tour_url?: string | null
    floor_plans?: { label: string; image_url: string }[]
    documents?: { label: string; url: string }[]
    // Computed live server-side (Open House Manager + MLS + agent-entered), upcoming only.
    open_houses?: PropertySiteOpenHouse[]
    section_visibility?: Record<string, boolean>
    // Short chip-style headline facts with no structured field of their own (e.g. "44-Car
    // Automotive Estate") - agent-entered, shown alongside the real stats.
    notable_facts?: string[]
    // Agent-authored/approved short marketing phrases.
    highlights?: string[]
    // Agent-controlled room/section photo mapping for the chapter storytelling layout.
    chapters?: PropertySiteChapter[]
    // "About the town" - AI-drafted in the editor, then the agent's to edit or hide.
    town_story?: { name?: string; body?: string; hidden?: boolean; facts?: TownFacts | null; photo?: TownPhoto | null } | null
    // The page header - see HeroMedia.tsx.
    header?: SpotlightHeader | null
    // The photo beside "The residence" - the agent's pick in the editor's Story step.
    story_photo?: string | null
  }
  video: { url: string } | null
  agents: PropertySiteAgent[]
  brand_kit: { primary_color: string; secondary_color: string; logo_url: string | null }
  canonical_hostname: string | null
}

// ---------- formatting ----------

// One-line street address: sized to its own length against the nearest container's width
// (the caller's wrapper sets `container-type: inline-size`), never past `max`. A long street
// gets smaller type instead of breaking onto a second line.
export function fitLine(text: string, max: string, k = 190): { fontSize: string; whiteSpace: 'nowrap' } {
  return { fontSize: `min(${max}, ${(k / Math.max(text.length, 6)).toFixed(2)}cqw)`, whiteSpace: 'nowrap' }
}

export function fmtMoney(n?: number | null): string | null {
  if (!n) return null
  return `$${Math.round(Number(n)).toLocaleString('en-US')}`
}

export function fmtCompactMoney(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m.toFixed(m >= 10 ? 1 : 2).replace(/\.?0+$/, '')}M`
  }
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`
  return `$${Math.round(n)}`
}

export function fmtNumber(n?: number | null): string | null {
  if (n == null || Number.isNaN(Number(n))) return null
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function fmtTime(t?: string | null): string | null {
  if (!t) return null
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  if (Number.isNaN(hour)) return null
  const period = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return m && m !== '00' ? `${h12}:${m} ${period}` : `${h12} ${period}`
}

// A YYYY-MM-DD date is a calendar day, not an instant - parse it as local midnight so it never
// shifts a day for a visitor west of UTC.
export function parseDay(date?: string | null): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return null
  const d = new Date(`${date.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtDay(date?: string | null, style: 'long' | 'short' = 'long'): string | null {
  const d = parseDay(date)
  if (!d) return null
  return d.toLocaleDateString('en-US', style === 'long'
    ? { weekday: 'long', month: 'long', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric' })
}

export function fmtTimeRange(start?: string | null, end?: string | null): string | null {
  const s = fmtTime(start)
  const e = fmtTime(end)
  if (s && e) return `${s} – ${e}`
  return s || e || null
}

// A luxury site reads like a magazine, not an MLS sheet - splits on real sentence boundaries and
// keeps only the first `count` sentences (or, with `skip`, the ones after an excerpt already
// shown elsewhere on the page).
export function excerpt(text: string, count: number, maxChars: number, skip = 0): string {
  if (!text) return ''
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  let out = sentences.slice(skip, skip + count).join(' ')
  if (out.length > maxChars) out = out.slice(0, maxChars).replace(/\s+\S*$/, '') + '…'
  return out
}

// Real-estate marketing phrases worth calling out when the agent's actual listing description
// uses them - each pattern names something concrete a plain MLS checkbox list never captures.
const DESCRIPTION_HIGHLIGHT_PATTERNS: RegExp[] = [
  /\b(unreal|breathtaking|stunning|panoramic|unobstructed|sweeping|jaw[- ]dropping)\s+views?\b/i,
  /\bchef'?s?\s+kitchen\b/i, /\bgourmet\s+kitchen\b/i,
  /\bspa[- ]like\b/i, /\bresort[- ]style\b/i, /\bsmart\s+home\b/i,
  /\bvaulted\s+ceilings?\b/i, /\bopen\s+floor\s?plan\b/i,
  /\bwalk[- ]in\s+closets?\b/i, /\bwine\s+(cellar|fridge|room)\b/i,
  /\bhome\s+theater\b/i, /\bin[- ]?ground\s+pool\b/i, /\bwaterfront\b/i,
  /\bcul[- ]de[- ]sac\b/i, /\bmove[- ]in\s+ready\b/i, /\b(newly|recently)\s+renovated\b/i,
  /\bcustom[- ]built\b/i, /\bhardwood\s+floors?\b/i, /\bquartz\s+counter(top)?s?\b/i,
  /\bstainless\s+steel\s+appliances\b/i, /\bfinished\s+basement\b/i,
  /\bfenced[- ]in\s+(yard|backyard)\b/i, /\bnew\s+roof\b/i, /\bprivate\s+backyard\b/i,
  /\bgated\s+communit(y|ies)\b/i, /\bcorner\s+lot\b/i, /\bfloor[- ]to[- ]ceiling\s+windows?\b/i,
]

// Pulls the exact sentence around each match - never a paraphrase, just the real words already
// in the listing description. Skips anything that duplicates a tag already shown.
export function extractDescriptionHighlights(description: string, alreadyShown: string[]): string[] {
  if (!description) return []
  const already = new Set(alreadyShown.map(s => s.toLowerCase()))
  const sentences = description.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  const out: string[] = []
  for (const sentence of sentences) {
    for (const pattern of DESCRIPTION_HIGHLIGHT_PATTERNS) {
      if (pattern.test(sentence)) {
        const clean = sentence.replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim()
        // A 60-word run-on sentence isn't a highlight - it's the description again.
        if (clean && clean.length <= 180 && !already.has(clean.toLowerCase()) && !out.some(o => o.toLowerCase() === clean.toLowerCase())) {
          out.push(clean)
        }
        break
      }
    }
    if (out.length >= 6) break
  }
  return out
}

// ---------- status / price ----------

export type StatusKind = 'active' | 'coming_soon' | 'pending' | 'sold' | 'off_market'

export interface StatusInfo { label: string; kind: StatusKind; forSale: boolean }

// Bright MLS strings look like "ACTIVE-BRIGHT" / "ACTIVE UNDER CONTRACT-BRIGHT" / "CLOSED-BRIGHT";
// a manual listing may carry anything the agent typed ("active", "For Sale") or nothing at all.
export function statusInfo(status?: string | null): StatusInfo | null {
  if (!status || !status.trim()) return null
  const clean = status.replace(/-BRIGHT$/i, '').replace(/_/g, ' ').trim()
  const up = clean.toUpperCase()
  const title = clean.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
  if (up.includes('CLOSED') || up === 'SOLD') return { label: 'Sold', kind: 'sold', forSale: false }
  if (up.includes('CONTRACT') || up.includes('PENDING')) return { label: up.includes('ACTIVE') ? 'Under Contract' : title, kind: 'pending', forSale: false }
  if (up.includes('COMING SOON')) return { label: 'Coming Soon', kind: 'coming_soon', forSale: true }
  if (up.includes('WITHDRAWN') || up.includes('EXPIRED') || up.includes('CANCEL') || up.includes('HOLD')) {
    return { label: 'Off Market', kind: 'off_market', forSale: false }
  }
  if (up === 'ACTIVE' || up === 'FOR SALE' || up === 'FOR_SALE') return { label: 'For Sale', kind: 'active', forSale: true }
  return { label: title, kind: 'active', forSale: true }
}

export const STATUS_COLORS: Record<StatusKind, { bg: string; fg: string; dot: string }> = {
  active: { bg: '#0f5132', fg: '#d1fae5', dot: '#34d399' },
  coming_soon: { bg: '#1e1b4b', fg: '#e0e7ff', dot: '#818cf8' },
  pending: { bg: '#713f12', fg: '#fef3c7', dot: '#fbbf24' },
  sold: { bg: '#7f1d1d', fg: '#fee2e2', dot: '#f87171' },
  off_market: { bg: '#374151', fg: '#f3f4f6', dot: '#9ca3af' },
}

// Only a real, downward move off the ORIGINAL list price is advertised - an increase isn't a
// selling point, and a closed/pending listing's price history isn't the visitor's business here.
export function priceReduction(p: PropertySiteProperty, status: StatusInfo | null): number | null {
  if (!p.price || !p.original_list_price || (status && !status.forSale)) return null
  const diff = Math.round(p.original_list_price - p.price)
  return diff >= 1000 ? diff : null
}

// ---------- key facts / schools ----------

function joinList(v?: string[] | null, max = 3): string | null {
  const list = (v || []).map(s => String(s).trim()).filter(Boolean)
  if (!list.length) return null
  return list.slice(0, max).join(', ') + (list.length > max ? ` +${list.length - max} more` : '')
}

export function hoaMonthly(fee?: number | null, frequency?: string | null): number | null {
  if (!fee || fee <= 0) return null
  const f = (frequency || 'monthly').toLowerCase()
  if (f.includes('semi')) return fee / 6
  if (f.includes('quarter')) return fee / 3
  if (f.includes('annual') || f.includes('year')) return fee / 12
  return fee
}

export interface KeyFact { label: string; value: string }

// Real fields only - a missing value drops its whole row rather than rendering "—".
export function buildKeyFacts(p: PropertySiteProperty, status: StatusInfo | null): KeyFact[] {
  const facts: (KeyFact | null)[] = []
  const add = (label: string, value: string | null | undefined) => { if (value) facts.push({ label, value }) }
  add('Status', status?.label)
  add('Property type', p.property_type || p.home_type)
  add('Architectural style', joinList(p.architectural_style, 2))
  add('Year built', p.year_built ? String(p.year_built) : null)
  add('Interior', p.sqft ? `${fmtNumber(p.sqft)} sq ft` : null)
  // The cheat sheet's above / below grade split - buyers comparing homes ask for it.
  if (p.above_grade_finished_area && p.below_grade_finished_area) {
    add('Above / below grade', `${fmtNumber(p.above_grade_finished_area)} / ${fmtNumber(p.below_grade_finished_area)} sq ft`)
  }
  add('Lot', p.lot_size_acres ? `${fmtNumber(p.lot_size_acres)} acres` : p.lot_size ? `${fmtNumber(p.lot_size)} sq ft` : null)
  add('Bedrooms', p.beds != null ? String(p.beds) : null)
  add('Bathrooms', p.baths != null ? String(p.baths) : null)
  add('Stories', p.stories ? String(p.stories) : null)
  add('Garage', p.garage_spaces ? `${fmtNumber(p.garage_spaces)} spaces` : null)
  add('Parking', joinList(p.parking_features))
  add('Heating', joinList(p.heating))
  add('Cooling', joinList(p.cooling))
  add('Flooring', joinList(p.flooring))
  add('Basement', joinList(p.basement, 2))
  add('Fireplaces', p.fireplaces ? String(p.fireplaces) : null)
  add('Water', joinList(p.water_source, 2))
  add('Sewer', joinList(p.sewer, 2))
  const hoa = p.association_fee ? `${fmtMoney(p.association_fee)}${p.association_fee_frequency ? ` / ${p.association_fee_frequency.toLowerCase()}` : ''}` : null
  add('HOA dues', hoa)
  add('HOA includes', joinList(p.association_fee_includes, 4))
  add('Annual taxes', p.tax_annual_amount ? `${fmtMoney(p.tax_annual_amount)}${p.tax_year ? ` (${p.tax_year})` : ''}` : null)
  add('Subdivision', p.subdivision_name)
  add('County', p.county)
  add('Township', p.township)
  add('New construction', p.new_construction ? 'Yes' : null)
  add('Days on market', status?.forSale && p.days_on_market != null && p.days_on_market >= 0 ? String(p.days_on_market) : null)
  add('MLS #', p.mls_number)
  return facts.filter(Boolean) as KeyFact[]
}

export function buildSchools(p: PropertySiteProperty): { level: string; name: string }[] {
  return [
    { level: 'Elementary', name: p.elementary_school },
    { level: 'Middle', name: p.middle_or_junior_school },
    { level: 'High', name: p.high_school },
  ].filter(s => s.name && String(s.name).trim()) as { level: string; name: string }[]
}

// MLS feeds often deliver addresses in all caps ("5829 RIDGEVIEW DR") - set in a large display
// serif that reads as shouting. Title-case only strings with no lowercase at all, keeping
// directionals (NE, SW...) and unit designators readable.
const KEEP_UPPER = new Set(['NE', 'NW', 'SE', 'SW', 'N', 'S', 'E', 'W', 'PO', 'US', 'II', 'III', 'IV'])
export function tidyCase(value?: string | null): string {
  const v = (value || '').trim()
  if (!v || /[a-z]/.test(v)) return v
  return v.toLowerCase().replace(/[a-z0-9'#.-]+/g, (word) => {
    const up = word.toUpperCase().replace(/\.$/, '')
    if (KEEP_UPPER.has(up)) return word.toUpperCase()
    if (/^\d/.test(word)) return word // 1st, 22nd, 12a
    return word.charAt(0).toUpperCase() + word.slice(1)
  })
}

// MLS school fields are often truncated to a single trailing level letter ("RADNOR M").
function tidySchool(name: string | null | undefined, level: 'Elementary' | 'Middle' | 'High'): string | null {
  const v = tidyCase(name)
  if (!v) return null
  return v.replace(new RegExp(` ${level[0]}$`, 'i'), ` ${level}`)
}

// "6107817003" -> "(610) 781-7003"; anything that isn't a plain 10/11-digit US number is left as typed.
export function fmtPhone(phone?: string | null): string {
  const v = (phone || '').trim()
  const d = v.replace(/\D/g, '')
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
  if (ten.length === 10 && !/[a-z]/i.test(v)) return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
  return v
}

// Many MLS remarks open in all caps ("SOME HOMES SIMPLY HAVE A SOUL.") - fine in a feed, loud
// as a display-size lede. Sentence-case a line only when it has no lowercase letters at all.
export function calmCaps(text: string): string {
  if (!text || /[a-z]/.test(text) || text.replace(/[^A-Z]/g, '').length < 8) return text
  return text.toLowerCase().replace(/^(\s*)(\S)/, (_m, ws: string, ch: string) => ws + ch.toUpperCase())
}

// Applies calmCaps sentence by sentence, keeping the agent's own paragraph breaks intact.
function calmDescription(text: string): string {
  return text.replace(/[^.!?\n]+[.!?]*/g, seg => calmCaps(seg))
}

// ---------- the whole-page model ----------

export function buildSpotlight(data: PropertySiteResolveResponse) {
  const p: PropertySiteProperty = {
    ...data.property,
    address: tidyCase(data.property.address) || 'This home',
    city: tidyCase(data.property.city) || null,
    // Bright MLS suffixes counties with the state ("DELAWARE-PA").
    county: tidyCase((data.property.county || '').replace(/-[A-Za-z]{2}$/, '')) || null,
    township: tidyCase(data.property.township) || null,
    subdivision_name: tidyCase(data.property.subdivision_name) || null,
    school_district_name: tidyCase(data.property.school_district_name) || null,
    elementary_school: tidySchool(data.property.elementary_school, 'Elementary'),
    middle_or_junior_school: tidySchool(data.property.middle_or_junior_school, 'Middle'),
    high_school: tidySchool(data.property.high_school, 'High'),
  }
  const c = data.content || {}
  const vis = c.section_visibility || {}
  const show = (key: string, fallback = true) => (vis[key] !== undefined ? vis[key] : fallback)
  const photos = (p.photos || []).filter(Boolean)
  const clean = (list?: string[] | null) => (list || []).map(t => String(t || '').trim()).filter(Boolean)
  const features: PropertySiteFeatures = {
    interior: clean(p.features?.interior), exterior: clean(p.features?.exterior), lifestyle: clean(p.features?.lifestyle),
    community: clean(p.features?.community), other: clean(p.features?.other),
  }
  const heroImage = c.hero_image || photos[0] || null
  // The hero photo leads the gallery even when the agent picked one deep in the MLS order.
  const galleryPhotos = heroImage && photos.includes(heroImage) ? [heroImage, ...photos.filter(u => u !== heroImage)] : photos
  const description = calmDescription((c.description_override || p.description || '').trim())
  const agents = (data.agents || []).filter(a => a && a.name)
  const agent = agents[0]
  const status = statusInfo(p.status)
  const reduction = priceReduction(p, status)
  const cityState = [p.city, p.state].filter(Boolean).join(', ')
  const fullAddress = [p.address, p.city, [p.state, p.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const hasCoords = p.latitude != null && p.longitude != null && !(p.latitude === 0 && p.longitude === 0)
  const mapQuery = hasCoords ? `${p.latitude},${p.longitude}` : fullAddress
  const openHouses = (c.open_houses || []).filter(o => parseDay(o.date))
  const highlights = (c.highlights || []).map(h => h.trim()).filter(Boolean)
  const allFeatureTags = [...features.interior, ...features.exterior, ...features.lifestyle, ...features.community, ...features.other]
  // The agent's picks - or, until they pick, the big-ticket items (a pool before a railing).
  const agentFeatured = (c.featured_amenities || []).filter(Boolean)
  const featured = agentFeatured.length ? agentFeatured : autoFeatured(allFeatureTags)
  const descriptionHighlights = extractDescriptionHighlights(description, [...featured, ...highlights, ...allFeatureTags])
  const chapters = (c.chapters || []).filter(ch => ch.enabled && (ch.photos || []).length > 0)
  const keyFacts = buildKeyFacts(p, status)
  const schools = buildSchools(p)
  const taxesMonthly = p.tax_annual_amount ? p.tax_annual_amount / 12 : null
  const hoa = hoaMonthly(p.association_fee, p.association_fee_frequency)
  const floorPlans = (c.floor_plans || []).filter(f => f && f.image_url)
  const documents = (c.documents || []).filter(d => d && d.url)
  const tourUrl = (c.virtual_tour_url || '').trim()
  const townBody = (c.town_story?.body || '').trim()
  const townFacts = c.town_story?.facts || null
  const hasFacts = !!townFacts && !!(townFacts.tagline || townFacts.known_for?.length || townFacts.downtown?.name || townFacts.why_move?.length || townFacts.getting_around?.length)
  const town = (townBody || hasFacts) && !c.town_story?.hidden
    ? { name: (c.town_story?.name || p.city || '').trim(), body: townBody, facts: hasFacts ? townFacts : null, photo: c.town_story?.photo?.url ? c.town_story.photo : null }
    : null

  const hasFeatureContent = allFeatureTags.length > 0 || featured.length > 0 || highlights.length > 0

  const has = {
    story: show('story') && !!description,
    features: show('features', hasFeatureContent) && hasFeatureContent,
    chapters: chapters.length > 0,
    // A single photo is already the hero - a one-tile "gallery" of it again reads as filler.
    gallery: show('gallery', photos.length > 1) && photos.length > 1,
    video: show('video') && !!data.video?.url,
    tour: show('virtual_tour', !!tourUrl) && /^https?:\/\//i.test(tourUrl),
    floorPlans: show('floor_plans', floorPlans.length > 0) && floorPlans.length > 0,
    // An address alone is enough for a map embed + directions (a manual listing usually has no
    // coordinates); Explore Nearby needs real coordinates for its server-side Places search.
    location: show('location') && !!(hasCoords || (p.address && (p.city || p.zipcode))),
    nearby: show('explore_nearby', hasCoords) && hasCoords,
    details: show('details', keyFacts.length >= 4) && keyFacts.length >= 4,
    // The estimator only makes sense for a home that's actually for sale at a real price.
    payment: show('payment', true) && !!p.price && p.price >= 25000 && (!status || status.forSale),
    openHouses: show('open_houses', openHouses.length > 0) && openHouses.length > 0 && (!status || status.forSale),
    documents: show('documents', documents.length > 0) && documents.length > 0,
    town: show('town', !!town) && !!town,
    agents: show('agents') && !!agent,
    // The agent's Email Signature card inside the Listing Agent section (own switch, default on).
    signature: show('signature') && !!agent && !!data.signature_hub_slug,
  }

  // Row 1: hard structured facts only - a field with no value is skipped entirely.
  const marqueeFacts: string[] = []
  if (fmtMoney(p.price)) marqueeFacts.push(fmtMoney(p.price)!)
  if (p.beds != null) marqueeFacts.push(`${p.beds} Bedroom${p.beds === 1 ? '' : 's'}`)
  if (p.baths != null) marqueeFacts.push(`${p.baths} Bath${p.baths === 1 ? '' : 's'}`)
  if (p.sqft) marqueeFacts.push(`${fmtNumber(p.sqft)} Sq Ft`)
  if (p.lot_size_acres) marqueeFacts.push(`${fmtNumber(p.lot_size_acres)} Acres`)
  for (const fact of (c.notable_facts || [])) if (fact.trim()) marqueeFacts.push(fact.trim())
  if (p.year_built) marqueeFacts.push(`Built ${p.year_built}`)
  if (p.school_district_name) marqueeFacts.push(p.school_district_name)

  return {
    p, c, show, photos: galleryPhotos, heroImage, description, agents, agent, status, reduction,
    cityState, fullAddress, hasCoords,
    mapEmbedUrl: `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery)}`,
    openHouses, nextOpenHouse: openHouses[0] || null,
    highlights, featured, features, descriptionHighlights,
    // Agent-curated highlights lead, then the description's own real sentences fill in behind.
    featureQuotes: [...highlights, ...descriptionHighlights].slice(0, 6),
    chapters, keyFacts, schools, taxesMonthly, hoaMonthly: hoa, floorPlans, documents, tourUrl,
    marqueeFacts, notableFacts: (c.notable_facts || []).filter(f => f.trim()),
    town, allFeatureTags,
    // The agent's pick, or (until they pick) a photo a little way into the gallery.
    storyPhoto: (c.story_photo && galleryPhotos.includes(c.story_photo) ? c.story_photo : null) || galleryPhotos[2] || galleryPhotos[1] || galleryPhotos[0] || null,
    header: {
      mode: (c.header?.mode === 'video' && c.header.video?.url ? 'video' : c.header?.mode === 'cycle' ? 'cycle' : 'photo') as HeaderMode,
      motion: (['in', 'out', 'both', 'none'].includes(c.header?.motion || '') ? c.header!.motion : 'out') as HeaderMotion,
      videoUrl: c.header?.video?.url || null,
      videoPoster: c.header?.video?.poster || null,
      frame: (c.header?.frame && typeof c.header.frame.x === 'number' ? c.header.frame : null) as HeroFrame | null,
    },
    isMls: !!p.listing_key,
    has,
  }
}

export type SpotlightModel = ReturnType<typeof buildSpotlight>

// Opens the lead form from anywhere on the page (hero CTA, sticky bar, open house card...) -
// a tiny window event instead of lifting form state into every template.
export const LEAD_EVENT = 'ohp-spotlight:lead'
export function openLeadForm(tab: 'info' | 'tour', extra?: { date?: string; message?: string }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LEAD_EVENT, { detail: { tab, ...extra } }))
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
