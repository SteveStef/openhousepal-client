import { Lead } from '@/types'

// Where clicking this lead should take you when something specific needs addressing, in
// priority order - mirrors the backend's _lead_attention_item (ai_insights_service.py), which
// drives the same links from the Dashboard's Daily Digest. Returns null for a lead with no
// specific pending item, so the caller falls back to opening the generic detail modal/page.
// Shared by the Leads tab, the Dashboard's Activity feed, and the New Leads card so a tour
// request routes to the same place no matter where on the dashboard you click it from.
export function getLeadAttentionLink(lead: Lead): string | null {
  const showcaseLink = (suffix?: 'tours' | 'first') => {
    if (!lead.attention_collection_id) return `/leads/${lead.id}`
    const link = `/showcases?showcase=${lead.attention_collection_id}`
    if (suffix === 'tours') return `${link}&open=tours`
    if (suffix === 'first') return `${link}&focus=first`
    return link
  }

  // Second-visit/disclosure requests are answered on the Open Houses page
  // (OpenHouseFormRequestsPanel), not Forms - "/studio/forms?tab=results" was a dead link (that
  // page has no results tab at all). has_second_visit_request/has_disclosure_request are also both
  // now unseen-by-agent flags (cleared once the request is marked Sent/Scheduled there), not a
  // permanent "did this ever happen" flag.
  if (lead.has_second_visit_request || lead.has_disclosure_request) {
    return '/open-houses'
  }
  if (lead.has_tour_request) return showcaseLink('tours')
  // No single property id behind a match count (see showcase_new_matches) - land the agent on
  // the first card as currently sorted, scrolled into view, so they see something concrete.
  if (lead.showcase_new_matches) return showcaseLink('first')
  if (lead.has_liked_property || lead.has_disliked_property) return showcaseLink()
  if (lead.has_commented) return showcaseLink()
  return null
}
