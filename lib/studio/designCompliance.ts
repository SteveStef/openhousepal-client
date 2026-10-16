import type { DesignAgentInfo } from '@/lib/studio/designAgent'
import type { DesignSituationId } from '@/lib/studio/designSituations'

// Real-estate advertising rules, as Studio enforces them (user 10/09: "we must be fully compliant").
//
// 1. Who it's from. Every ad names the agent AND the brokerage (PA 49 Pa. Code 35.305 and most
//    states); print pieces also carry the brokerage's office phone. Studio won't make or download a
//    design until these are on the agent's profile - plus a headshot and their own number, which
//    every layout is built around.
// 2. Whose home it is. Only the agent who represented a home may advertise it: "Just Sold" only by
//    the listing or buyer's agent (NAR Standard of Practice 12-7); a listing's ads (Just Listed,
//    Coming Soon, price change, Under Contract) only by its listing agent; an open house by its
//    listing agent or a host the listing agent approved. The property picker only offers those
//    homes; anything typed in by hand needs the agent to confirm they represented it.

export type ProfileGap = { key: 'name' | 'brokerage' | 'photo' | 'phone' | 'officePhone'; label: string; inline: boolean }

const digits = (v: string | null | undefined) => (v || '').replace(/\D/g, '')

/** What's still missing from the agent's profile before a design can be made / downloaded. */
export function profileGaps(agent: DesignAgentInfo | null | undefined, isPrint: boolean): ProfileGap[] {
  const gaps: ProfileGap[] = []
  if (!agent?.agentName?.trim()) gaps.push({ key: 'name', label: 'Your name', inline: false })
  if (!agent?.agentBrokerage?.trim()) gaps.push({ key: 'brokerage', label: 'Your brokerage', inline: false })
  if (!agent?.agentPhotoUrl) gaps.push({ key: 'photo', label: 'Your headshot', inline: false })
  if (digits(agent?.agentPhone).length < 10) gaps.push({ key: 'phone', label: 'Your mobile number', inline: true })
  if (isPrint && digits(agent?.agentOfficePhone).length < 10) gaps.push({ key: 'officePhone', label: "Your brokerage's phone", inline: true })
  return gaps
}

export type PropertyRule = 'listings' | 'sales' | 'open_house'

/** Which homes a situation may advertise (null = no property attached, e.g. lead-gen). */
export function propertyRuleFor(situation: DesignSituationId | string | null | undefined): PropertyRule | null {
  switch (situation) {
    case 'just_sold': return 'sales'
    case 'open_house': return 'open_house'
    case 'just_listed': case 'coming_soon': case 'price_improvement': case 'under_contract': return 'listings'
    default: return null
  }
}

export const PROPERTY_RULE_NOTE: Record<PropertyRule, string> = {
  listings: 'Only your own listings can be advertised this way - that\'s the MLS and REALTOR® rule.',
  sales: 'Only sales you represented (as the listing or buyer\'s agent) can be called "Sold" - that\'s the REALTOR® rule.',
  open_house: 'Your own listings, or a home whose listing agent approved you to host.',
}

export const PROPERTY_RULE_ATTEST: Record<PropertyRule, string> = {
  listings: 'I\'m the listing agent for this home (or have the listing broker\'s written OK to advertise it).',
  sales: 'I represented the seller or the buyer in this sale.',
  open_house: 'I\'m the listing agent, or the listing agent approved me to host this open house.',
}
