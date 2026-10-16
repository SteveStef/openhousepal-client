import { User } from '@/types'
import { getBrokeragePhone } from '@/lib/hubPhones'

// Who a design is "from" - resolved once from the agent's profile plus their Agent Hub contact card
// (the same phone/email/headshot/crop the Agent Hub, vCard and email signature use), so every
// design shows the agent's real, current contact details without them retyping anything.
export interface DesignAgentInfo {
  agentName: string
  agentTitle: string | null
  agentBrokerage: string | null
  agentPhotoUrl: string | null
  agentPhotoPosition: { x: number; y: number } | null
  agentPhone: string | null
  // The brokerage's office line (Settings > Contact / setup flow; stored on the Save Contact card).
  // Advertising rules (e.g. PA 49 Pa. Code 35.305) want the broker's name AND phone on print pieces.
  agentOfficePhone?: string | null
  agentEmail: string | null
  agentHubSlug: string | null
}

export function designAgentFrom(user: Partial<User> | null | undefined, hub: { slug?: string | null; config?: Record<string, any> | null } | null | undefined): DesignAgentInfo {
  const config = hub?.config || {}
  const contact = config.contact || {}
  const pos = config.profilePhotoPosition
  return {
    agentName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
    agentTitle: user?.professional_title || null,
    agentBrokerage: user?.brokerage || null,
    agentPhotoUrl: config.profilePhotoUrl || user?.photo_url || null,
    agentPhotoPosition: pos && typeof pos.x === 'number' && typeof pos.y === 'number' ? { x: pos.x, y: pos.y } : null,
    agentPhone: (typeof contact.call === 'string' && contact.call.trim()) || (typeof contact.text === 'string' && contact.text.trim()) || null,
    // The brokerage's main number (print compliance) - not the agent's own office line.
    agentOfficePhone: getBrokeragePhone(config) || null,
    agentEmail: (typeof contact.email === 'string' && contact.email.trim()) || user?.email || null,
    agentHubSlug: hub?.slug || null,
  }
}

// Neutral stand-in for previews shown before real agent data exists (never a real brokerage name).
export const SAMPLE_DESIGN_AGENT: DesignAgentInfo = {
  agentName: 'Your Name',
  agentTitle: 'REALTOR®',
  agentBrokerage: 'Your Brokerage',
  agentPhotoUrl: null,
  agentPhotoPosition: null,
  agentPhone: '(555) 555-0123',
  agentOfficePhone: '(555) 555-0100',
  agentEmail: null,
  agentHubSlug: null,
}
