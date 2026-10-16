import api from '@/lib/api-service'
import { User } from '@/types'
import { getSaleSummary } from '@/lib/agentSales'
import { websitePublicUrl } from '@/lib/publicResourceLinks'
import { hasAgentHubAccess, hasMlsAccess, hasShowcaseAccess } from '@/lib/navAccess'

const firstPresent = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

const userField = (user: User | null, ...keys: string[]): unknown => {
  const record = user as Record<string, unknown> | null
  if (!record) return undefined
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  return undefined
}

const getAgentPhotoUrl = (config: any, currentUser: User | null): string | undefined => {
  return firstPresent(
    config?.profilePhotoUrl === '/home.jpg' ? undefined : config?.profilePhotoUrl, // old editor placeholder, not a headshot
    config?.profile_photo_url,
    userField(currentUser, 'photo_url', 'profile_image_url', 'profileImageUrl', 'profilePhotoUrl', 'profile_photo_url', 'photoUrl', 'avatar_url', 'avatar')
  )
}

const getAgentPhotoPosition = (config: any): { x: number; y: number } | undefined => {
  const pos = config?.profilePhotoPosition
  if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') return { x: pos.x, y: pos.y }
  return undefined
}

const formatPhoneNumber = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  if (digits.length !== 10) return raw
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

const getAgentPhone = (contact: any, currentUser: User | null): string | undefined => {
  const raw = firstPresent(
    contact?.call,
    contact?.phone,
    contact?.mobile,
    userField(currentUser, 'phone', 'phone_number', 'mobile_phone', 'mobilePhone', 'cell_phone', 'cellPhone')
  )
  return raw ? formatPhoneNumber(raw) : undefined
}

export interface BragSheetPayload {
  agent: {
    name: string
    title?: string
    brokerage?: string
    market?: string
    photoUrl?: string
    photoPosition?: { x: number; y: number }
    phone?: string
    email?: string
    bio?: string
    hubUrl: string | null
  }
  recentSales: { id: string; address: string; city?: string; state?: string; price?: number; image?: string }[]
  // Comps saved on the specific open house this Brag Sheet was generated from (the same
  // similar-properties snapshot the "Property Recommendations" PDF uses) - shown in the "What A
  // Showcase Looks Like" mock-up instead of generic Recent Sales when available, so the example
  // actually resembles what a guest of *this* open house would be matched with.
  showcaseSampleProperties: { id: string; address: string; city?: string; state?: string; price?: number; image?: string; beds?: number; baths?: number; sqft?: number; daysOnMarket?: number; schoolDistrict?: string }[]
  showcaseQrUrl: string | null
  showSalesStats: boolean
  stats: { totalSold: number; totalVolume: number; avgPrice: number }
}

/** Whether this plan can generate a Brag Sheet at all - it needs a source of sales: the Agent
 * Hub's curated Recent Sales (Agent Hub plans, incl. No-MLS Premium's manual sales) or, on Basic,
 * the agent's own Bright MLS sales. Plain No-MLS Basic has neither, so the kit leaves it out. */
export function planHasBragSheet(planTier?: string | null): boolean {
  return hasAgentHubAccess(planTier) || hasMlsAccess(planTier)
}

/** Whether this agent's public Agent Hub page actually loads - their plan includes it AND it has
 * the minimum the backend requires to go live (a name + a way to reach them; see
 * _hub_has_minimum_content). Every agent has a hub URL now, so a printed QR must check this or it
 * would point at a page that 404s. */
function hubIsLive(planTier: string | null | undefined, config: any): boolean {
  if (!hasAgentHubAccess(planTier)) return false
  const profile = config?.profile || {}
  const contact = config?.contact || {}
  const hasName = Boolean(String(profile.name || '').trim())
  const hasContact = ['call', 'text', 'email'].some(k => String(contact[k] || '').trim())
  return hasName && hasContact
}

/**
 * Assembles the data needed for the Agent Brag Sheet PDF - shared between the wizard's inline
 * preview and the saved-open-house Documents modal, so both stay in sync with one source of truth.
 *
 * What goes on it depends on the plan, so it never promises something the agent's plan can't do:
 * - Page 2 (the Showcase pitch + "Create Your Own Showcase" QR) only on Showcase plans
 *   (Premium/IDX). On Basic a guest scanning it would never get a Showcase, so it's left out.
 * - The "Scan to see more - my Agent Hub" QR on page 1 only on plans whose public Agent Hub page
 *   exists (it 404s on Basic).
 * - Sales: the Agent Hub's curated Recent Sales; Basic (no Agent Hub to curate in) falls back to
 *   the agent's own Bright MLS sales.
 */
export async function buildBragSheetData(currentUser: User | null, similarProperties?: any[], opts?: { showcases?: boolean }): Promise<{ data: BragSheetPayload | null; error?: string }> {
  const planTier = currentUser?.plan_tier
  if (!planHasBragSheet(planTier)) {
    return { data: null, error: 'The Brag Sheet is built from your Recent Sales - it comes with No-MLS Premium, where you can add your sales by hand.' }
  }
  // ...and only when this open house gives guests Showcases (a listing agent at their own listing
  // turns them off - no page sending guests to shop other homes).
  const withShowcase = hasShowcaseAccess(planTier) && opts?.showcases !== false
  const withHub = hasAgentHubAccess(planTier)

  const [hubRes, formsRes, siteRes, domainsRes] = await Promise.all([
    api.agentHub.getMine(),
    withShowcase ? api.forms.getMine() : Promise.resolve({ success: false, data: [] as any[] }),
    api.sites.getMine().catch(() => ({ success: false, data: null })),
    api.sites.getDomains().catch(() => ({ success: false, data: [] })),
  ])

  const hub = hubRes.success ? hubRes.data : null
  const idxSite = siteRes.success ? siteRes.data : null
  const idxDomains = domainsRes.success ? domainsRes.data || [] : []
  const websiteShowcaseCreatorUrl = websitePublicUrl(idxSite, idxDomains, '/create-showcase')

  const config = (hub?.config || {}) as any
  const profile = config.profile || {}
  const contact = config.contact || {}

  // Recent Sales come from what the agent curated/toggled visible in the Agent Hub "Recent
  // Sales" tab (Studio > Site), so the Brag Sheet matches their public Agent Hub page. Basic has
  // no Agent Hub to curate in, so it uses the agent's own sales pulled from Bright MLS instead.
  let configuredSales = Array.isArray(config.recentSales) ? config.recentSales : []
  let visibleSales = configuredSales.filter((sale: any) => sale?.visible)
  if (visibleSales.length === 0 && !withHub && hasMlsAccess(planTier)) {
    const brightRes = await api.agentHub.getRecentSales().catch(() => ({ success: false, data: [] as any[] }))
    const brightSales = (brightRes.success ? brightRes.data || [] : []).filter((sale: any) => (sale?.price || 0) > 0)
    configuredSales = brightSales.map((sale: any) => ({ ...sale, visible: true }))
    visibleSales = configuredSales
  }
  if (visibleSales.length === 0) {
    return {
      data: null,
      error: withHub
        ? 'Add and show at least one sale in the Recent Sales tab of your Agent Hub (Studio > Site) before generating a Brag Sheet.'
        : "We couldn't find any of your closed sales in Bright MLS yet - make sure your MLS ID is set in Settings, then try again.",
    }
  }

  // Mirrors the public Agent Hub page's stats block: computed from every eligible sale
  // (not just the ones toggled "visible"), and only shown at all if the agent has the
  // "Show stats" switch on in the Recent Sales tab.
  const showSalesStats = typeof config.showSalesStats === 'boolean' ? config.showSalesStats : true
  const stats = getSaleSummary(configuredSales)

  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://openhousepal.com'
  let showcaseQrUrl: string | null = null
  if (withShowcase) {
    const showcaseForm = formsRes.success ? (formsRes.data || []).find((f: any) => f.form_type === 'showcase_request') : null
    const openHousePalShowcaseCreatorUrl = showcaseForm && hub?.slug ? `${clientUrl}/${hub.slug}/${showcaseForm.slug}` : null
    showcaseQrUrl = showcaseForm ? (websiteShowcaseCreatorUrl || openHousePalShowcaseCreatorUrl) : null
  }

  const fallbackName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : ''
  const photoUrl = getAgentPhotoUrl(config, currentUser)

  return {
    data: {
      agent: {
        name: profile.name || fallbackName || 'Your Name',
        title: profile.title || currentUser?.professional_title || undefined,
        brokerage: profile.brokerage || currentUser?.brokerage || undefined,
        market: profile.market || currentUser?.market || undefined,
        photoUrl,
        photoPosition: getAgentPhotoPosition(config),
        phone: getAgentPhone(contact, currentUser),
        email: contact.email || currentUser?.email || undefined,
        bio: profile.about || undefined,
        // Only link the Agent Hub where that public page actually exists.
        hubUrl: hub?.slug && hubIsLive(planTier, config) ? `${clientUrl}/${hub.slug}` : null,
      },
      recentSales: visibleSales.map((sale: any) => ({
        id: sale.id,
        address: sale.address,
        city: sale.city,
        state: sale.state,
        price: sale.price,
        image: sale.image,
      })),
      showcaseSampleProperties: (similarProperties || []).slice(0, 4).map((property: any, index: number) => ({
        id: property.id || property.ListingKey || property.listing_key || `similar-${index}`,
        address: property.FullStreetAddress || property.address,
        city: property.City || property.city,
        state: property.State || property.state,
        price: property.ListPrice || property.price,
        image: property.ListPictureURL || property.image,
        beds: property.BedroomsTotal ?? property.bedrooms ?? property.beds,
        baths: property.BathroomsTotal ?? property.bathrooms ?? property.baths,
        sqft: property.LivingArea ?? property.livingArea ?? property.sqft,
        daysOnMarket: property.DaysOnMarket ?? property.daysOnMarket ?? property.dom,
        schoolDistrict: property.SchoolDistrictName ?? property.schoolDistrictName ?? property.school_district_name ?? property.schoolDistrict,
      })),
      showcaseQrUrl,
      showSalesStats,
      stats,
    },
  }
}

export interface CheatSheetAgentPayload {
  id?: string
  name: string
  title?: string
  brokerage?: string
  market?: string
  photoUrl?: string
  photoPosition?: { x: number; y: number }
  phone?: string
  email?: string
  hubUrl: string | null
}

/**
 * Lighter-weight counterpart to buildBragSheetData - just the agent's Agent Hub contact info
 * and their hub URL (for a QR code), without the recent-sales/forms fetches the Brag Sheet needs.
 * Unlike the Brag Sheet, a missing Agent Hub slug isn't blocking here - the QR is simply omitted.
 */
export async function buildCheatSheetAgentData(currentUser: User | null): Promise<CheatSheetAgentPayload> {
  const hubRes = await api.agentHub.getMine()
  const hub = hubRes.success ? hubRes.data : null
  const config = (hub?.config || {}) as any
  const profile = config.profile || {}
  const contact = config.contact || {}

  const fallbackName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : ''
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://openhousepal.com'
  const photoUrl = getAgentPhotoUrl(config, currentUser)

  return {
    id: currentUser?.id,
    name: profile.name || fallbackName || 'Your Agent',
    title: profile.title || currentUser?.professional_title || undefined,
    brokerage: profile.brokerage || currentUser?.brokerage || undefined,
    market: profile.market || currentUser?.market || undefined,
    photoUrl,
    photoPosition: getAgentPhotoPosition(config),
    phone: getAgentPhone(contact, currentUser),
    email: contact.email || currentUser?.email || undefined,
    hubUrl: hub?.slug && hubIsLive(currentUser?.plan_tier, config) ? `${clientUrl}/${hub.slug}` : null,
  }
}
