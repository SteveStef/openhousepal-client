import { BRIGHT_TIER_ORDER, type PlanTierId } from './pricing'

// Mirrors the backend's capability split in app.utils.auth (require_mls_access,
// require_agent_hub_access, require_plan_tier) - explicit membership/rule checks, not a single
// rank comparison, so NO_MLS (a parallel track, not the ladder's bottom rung) is never
// accidentally swept into a `tier >= X` check. Keep these two in sync if either changes.
// Agent Hub lives on PRO_NO_MLS's card now, not plain NO_MLS's - BASIC and NO_MLS both get none.
const AGENT_HUB_ACCESS_TIERS: PlanTierId[] = ['PRO_NO_MLS', 'PREMIUM', 'IDX']

// Email Signature: narrower than Agent Hub's own set - IDX only on the Bright ladder (NOT plain
// PREMIUM), plus PRO_NO_MLS (manual-entry mode, no Bright pull for recent sales/listings). Keep
// in sync with EMAIL_SIGNATURE_ACCESS_TIERS in the backend's auth.py.
const EMAIL_SIGNATURE_ACCESS_TIERS: PlanTierId[] = ['PRO_NO_MLS', 'IDX']

// Design Studio + Blogs: PREMIUM-ladder Studio features that don't need Bright MLS data, so
// PRO_NO_MLS gets them too. The AI Media tool is narrower - IDX and PRO_NO_MLS only.
// Keep in sync with STUDIO_DESIGN_ACCESS_TIERS / STUDIO_MEDIA_ACCESS_TIERS in backend auth.py.
const STUDIO_DESIGN_ACCESS_TIERS: PlanTierId[] = ['PRO_NO_MLS', 'PREMIUM', 'IDX']
const STUDIO_MEDIA_ACCESS_TIERS: PlanTierId[] = ['PRO_NO_MLS', 'IDX']

// Luxe article theme: IDX + No-MLS Premium. Keep in sync with LUXE_BLOG_THEME_ACCESS_TIERS in
// backend auth.py. luxeBlogUpgrade = the plan that unlocks it from this plan's track.
export function luxeBlogAllowed(planTier?: string | null): boolean {
  return planTier === 'IDX' || planTier === 'PRO_NO_MLS'
}
export function luxeBlogUpgrade(planTier?: string | null): { tier: PlanTierId; label: string } {
  return planTier === 'NO_MLS' ? { tier: 'PRO_NO_MLS', label: 'No-MLS Premium' } : { tier: 'IDX', label: 'IDX' }
}

export function hasMlsAccess(planTier?: string | null): boolean {
  return !!planTier && planTier !== 'NO_MLS' && planTier !== 'PRO_NO_MLS'
}

export function hasAgentHubAccess(planTier?: string | null): boolean {
  return !!planTier && AGENT_HUB_ACCESS_TIERS.includes(planTier as PlanTierId)
}

export function hasEmailSignatureAccess(planTier?: string | null): boolean {
  return !!planTier && EMAIL_SIGNATURE_ACCESS_TIERS.includes(planTier as PlanTierId)
}

export function hasStudioDesignAccess(planTier?: string | null): boolean {
  return !!planTier && STUDIO_DESIGN_ACCESS_TIERS.includes(planTier as PlanTierId)
}

const REVIEWS_ACCESS_TIERS: PlanTierId[] = ['PREMIUM', 'IDX', 'PRO_NO_MLS']
export function hasReviewsAccess(planTier?: string | null): boolean {
  return !!planTier && REVIEWS_ACCESS_TIERS.includes(planTier as PlanTierId)
}

export function hasStudioMediaAccess(planTier?: string | null): boolean {
  return !!planTier && STUDIO_MEDIA_ACCESS_TIERS.includes(planTier as PlanTierId)
}

// Showcases (auto-built client showcases from open house sign-ins + the "Setup My Own Showcase"
// QR): Bright ladder Premium and up only. Keep in sync with SHOWCASE_ACCESS_TIERS in auth.py.
const SHOWCASE_ACCESS_TIERS: PlanTierId[] = ['PREMIUM', 'IDX']

export function hasShowcaseAccess(planTier?: string | null): boolean {
  return !!planTier && SHOWCASE_ACCESS_TIERS.includes(planTier as PlanTierId)
}

export function meetsTier(planTier: string | null | undefined, minimum: 'PREMIUM' | 'IDX'): boolean {
  const rank = BRIGHT_TIER_ORDER.indexOf((planTier || '') as PlanTierId)
  const minRank = BRIGHT_TIER_ORDER.indexOf(minimum)
  return rank !== -1 && rank >= minRank
}

export type NavFeatureKey =
  | 'discovery' | 'my_listings' | 'cma'
  | 'agent_hub' | 'email_signature' | 'showcases' | 'blogs' | 'design_studio' | 'ai_media' | 'open_house_manager'
  | 'idx_website' | 'listing_spotlight' | 'reviews'

const FEATURE_LABELS: Record<NavFeatureKey, string> = {
  discovery: 'Discovery',
  my_listings: 'My Listings',
  cma: 'CMA',
  agent_hub: 'Agent Hub',
  email_signature: 'Signature',
  showcases: 'Showcases',
  blogs: 'Blogs',
  design_studio: 'Studio',
  ai_media: 'Media Lab',
  open_house_manager: 'Open House Manager',
  idx_website: 'IDX Website',
  listing_spotlight: 'Spotlight',
  reviews: 'Client Reviews',
}

// MLS-only features: available to Basic/Premium/IDX, never to No-MLS / Pro No-MLS. No
// lock/upgrade prompt within the Bright ladder since every Bright tier already includes these.
const MLS_ONLY_FEATURES: NavFeatureKey[] = ['discovery', 'my_listings', 'cma', 'open_house_manager']

// Premium-ladder features that lean on Bright data: hidden entirely for the No-MLS track (not
// a Bright-ladder upgrade target for them), greyed + locked for Basic, unlocked for Premium/IDX.
const PREMIUM_LADDER_FEATURES: NavFeatureKey[] = ['showcases']

export interface NavFeatureAccess {
  /** false = don't render this nav item at all (No-MLS on a Bright-only feature). */
  visible: boolean
  /** true = render it, but greyed out with a lock icon; clicking goes to the upgrade prompt. */
  locked: boolean
  /** Where a locked item's click should go. Empty when not locked. */
  upgradeHref: string
}

export function getNavFeatureAccess(planTier: string | null | undefined, feature: NavFeatureKey): NavFeatureAccess {
  // Both No-MLS-track tiers have no Bright data, so MLS-only and IDX features are hidden for them.
  const isNoMlsTrack = planTier === 'NO_MLS' || planTier === 'PRO_NO_MLS'
  const label = encodeURIComponent(FEATURE_LABELS[feature])

  if (MLS_ONLY_FEATURES.includes(feature)) {
    if (isNoMlsTrack) return { visible: false, locked: false, upgradeHref: '' }
    return { visible: true, locked: false, upgradeHref: '' }
  }

  // Design Studio + Blogs: available to PRO_NO_MLS as well as PREMIUM/IDX. Locked upsell for the
  // rest: plain No-MLS -> No-MLS Premium (its card lists Studio + Blogs, same as Media Lab / Agent
  // Hub / Signature already did), BASIC -> Premium.
  if (feature === 'design_studio' || feature === 'blogs') {
    if (hasStudioDesignAccess(planTier)) return { visible: true, locked: false, upgradeHref: '' }
    const target = planTier === 'NO_MLS' ? 'PRO_NO_MLS' : 'PREMIUM'
    return { visible: true, locked: true, upgradeHref: `/upgrade-required?feature=${label}&tier=${target}` }
  }

  // AI Media tool: unlocked for IDX + PRO_NO_MLS; shown but LOCKED for everyone else
  // (BASIC, PREMIUM, and the NO_MLS track) with an upgrade prompt, same as other gated
  // features. NO_MLS upsells to the parallel PRO_NO_MLS tier; the Bright tiers to IDX.
  if (feature === 'ai_media') {
    if (hasStudioMediaAccess(planTier)) return { visible: true, locked: false, upgradeHref: '' }
    const target = planTier === 'NO_MLS' ? 'PRO_NO_MLS' : 'IDX'
    return { visible: true, locked: true, upgradeHref: `/upgrade-required?feature=${label}&tier=${target}` }
  }

  if (feature === 'agent_hub') {
    if (hasAgentHubAccess(planTier)) return { visible: true, locked: false, upgradeHref: '' }
    // Reachable for BASIC and plain NO_MLS - each upsells to its own ladder's next tier up
    // (PREMIUM/IDX already pass hasAgentHubAccess above).
    const target = planTier === 'NO_MLS' ? 'PRO_NO_MLS' : 'PREMIUM'
    return { visible: true, locked: true, upgradeHref: `/upgrade-required?feature=${label}&tier=${target}` }
  }

  // Email Signature: IDX only on the Bright ladder (not plain PREMIUM), plus PRO_NO_MLS - a
  // narrower set than Agent Hub's own. BASIC/PREMIUM upsell to IDX; NO_MLS upsells to PRO_NO_MLS.
  if (feature === 'email_signature') {
    if (hasEmailSignatureAccess(planTier)) return { visible: true, locked: false, upgradeHref: '' }
    const target = planTier === 'NO_MLS' ? 'PRO_NO_MLS' : 'IDX'
    return { visible: true, locked: true, upgradeHref: `/upgrade-required?feature=${label}&tier=${target}` }
  }

  // Client Reviews (Review Hub): Premium / IDX / No-MLS Premium - matches REVIEWS_ACCESS_TIERS in
  // backend auth.py. Plain No-MLS upsells to No-MLS Premium, Basic to Premium.
  if (feature === 'reviews') {
    if (hasReviewsAccess(planTier)) return { visible: true, locked: false, upgradeHref: '' }
    const target = planTier === 'NO_MLS' ? 'PRO_NO_MLS' : 'PREMIUM'
    return { visible: true, locked: true, upgradeHref: `/upgrade-required?feature=${label}&tier=${target}` }
  }

  if (PREMIUM_LADDER_FEATURES.includes(feature)) {
    if (isNoMlsTrack) return { visible: false, locked: false, upgradeHref: '' }
    if (meetsTier(planTier, 'PREMIUM')) return { visible: true, locked: false, upgradeHref: '' }
    return { visible: true, locked: true, upgradeHref: `/upgrade-required?feature=${label}&tier=PREMIUM` }
  }

  // IDX-only features: the IDX website builder AND Listing Spotlight. Hidden for the No-MLS
  // track (not a Bright-ladder upgrade target for them), greyed + locked with an IDX upsell for
  // Basic/Premium, unlocked for IDX. Keep in sync with the backend: site_routes.py and
  // property_website_routes.py both gate on require_plan_tier(PlanTier.IDX).
  if (feature === 'idx_website' || feature === 'listing_spotlight') {
    if (isNoMlsTrack) return { visible: false, locked: false, upgradeHref: '' }
    if (meetsTier(planTier, 'IDX')) return { visible: true, locked: false, upgradeHref: '' }
    return { visible: true, locked: true, upgradeHref: `/upgrade-required?feature=${label}&tier=IDX` }
  }

  return { visible: true, locked: false, upgradeHref: '' }
}

/** True for agents on a real, active Bright-ladder tier below the top (Basic or Premium) -
 * the audience for the "you're missing out on features" daily nudge. No-MLS and IDX are
 * excluded: No-MLS's missing features are hidden rather than shown-locked, and IDX has nothing
 * left to unlock. */
export function isMissingLadderFeatures(planTier?: string | null): boolean {
  return planTier === 'BASIC' || planTier === 'PREMIUM'
}
