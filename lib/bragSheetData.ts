import api from '@/lib/api-service'
import { User } from '@/types'

export interface BragSheetPayload {
  agent: {
    name: string
    title?: string
    brokerage?: string
    market?: string
    photoUrl?: string
    phone?: string
    email?: string
    bio?: string
  }
  recentSales: { id: string; address: string; city?: string; state?: string; price?: number; image?: string }[]
  showcaseQrUrl: string | null
}

/**
 * Assembles the data needed for the Agent Brag Sheet PDF - shared between the wizard's inline
 * preview and the saved-open-house Documents modal, so both stay in sync with one source of truth.
 * Returns null (with an error message) if the agent hasn't set up their Agent Hub URL yet, since
 * there's no valid public page to build the Showcase Request QR code from.
 */
export async function buildBragSheetData(currentUser: User | null): Promise<{ data: BragSheetPayload | null; error?: string }> {
  const [hubRes, salesRes, formsRes] = await Promise.all([
    api.agentHub.getMine(),
    api.agentHub.getRecentSales(),
    api.forms.getMine(),
  ])

  const hub = hubRes.success ? hubRes.data : null
  if (!hub?.slug) {
    return { data: null, error: 'Set up your Agent Hub URL first (in Agent Hub settings) so guests have somewhere to land when they scan your Showcase QR code.' }
  }

  const config = (hub.config || {}) as any
  const profile = config.profile || {}
  const contact = config.contact || {}

  const showcaseForm = formsRes.success ? (formsRes.data || []).find(f => f.form_type === 'showcase_request') : null
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://openhousepal.com'
  const showcaseQrUrl = showcaseForm ? `${clientUrl}/${hub.slug}/${showcaseForm.slug}` : null

  const fallbackName = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : ''

  return {
    data: {
      agent: {
        name: profile.name || fallbackName || 'Your Name',
        title: profile.title || currentUser?.professional_title || undefined,
        brokerage: profile.brokerage || currentUser?.brokerage || undefined,
        market: profile.market || currentUser?.market || undefined,
        photoUrl: config.profilePhotoUrl || currentUser?.photo_url || undefined,
        phone: contact.call || undefined,
        email: contact.email || currentUser?.email || undefined,
        bio: profile.about || undefined,
      },
      recentSales: salesRes.success ? (salesRes.data || []) : [],
      showcaseQrUrl,
    },
  }
}

export interface CheatSheetAgentPayload {
  name: string
  title?: string
  brokerage?: string
  market?: string
  photoUrl?: string
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

  return {
    name: profile.name || fallbackName || 'Your Agent',
    title: profile.title || currentUser?.professional_title || undefined,
    brokerage: profile.brokerage || currentUser?.brokerage || undefined,
    market: profile.market || currentUser?.market || undefined,
    photoUrl: config.profilePhotoUrl || currentUser?.photo_url || undefined,
    phone: contact.call || undefined,
    email: contact.email || currentUser?.email || undefined,
    hubUrl: hub?.slug ? `${clientUrl}/${hub.slug}` : null,
  }
}
