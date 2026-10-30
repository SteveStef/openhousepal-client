'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { hasValidSubscription } from '@/lib/auth-helpers'
import { loginUrlForHere } from '@/lib/loginRedirect'
import { useAuth } from '@/contexts/AuthContext'
import { hasMlsAccess, hasAgentHubAccess, hasEmailSignatureAccess, hasStudioDesignAccess, hasStudioMediaAccess, meetsTier } from '@/lib/navAccess'

interface SubscriptionGuardProps {
  children: React.ReactNode
  /** Real Bright MLS data access - My Listings, Discovery, base CMA. Excludes NO_MLS only. */
  requireMlsAccess?: boolean
  /** Agent Hub's bifurcated capability: PRO_NO_MLS (manual mode), PREMIUM/IDX (full mode).
   * Excludes BASIC and plain NO_MLS. */
  requireAgentHubAccess?: boolean
  /** Email Signature: IDX or PRO_NO_MLS only - narrower than Agent Hub's own set (excludes plain
   * PREMIUM too). */
  requireEmailSignatureAccess?: boolean
  /** Rank-based gate for genuine Basic->Premium->IDX ladder features (Open House Manager,
   * Showcases need PREMIUM; the IDX site needs IDX). NO_MLS / PRO_NO_MLS always fail this. */
  requiredTier?: 'PREMIUM' | 'IDX'
  /** Names the feature on the upgrade page for a requiredTier gate ("Showcases are included on..."). */
  featureName?: string
  /** Design Studio + Blogs: PREMIUM, IDX, or PRO_NO_MLS. */
  requireStudioDesignAccess?: boolean
  /** Studio AI Media tool: IDX or PRO_NO_MLS only. */
  requireStudioMediaAccess?: boolean
}

function hasAccessForTier(planTier: string | undefined, props: SubscriptionGuardProps): boolean {
  if (props.requireMlsAccess && !hasMlsAccess(planTier)) return false
  if (props.requireAgentHubAccess && !hasAgentHubAccess(planTier)) return false
  if (props.requireEmailSignatureAccess && !hasEmailSignatureAccess(planTier)) return false
  if (props.requireStudioDesignAccess && !hasStudioDesignAccess(planTier)) return false
  if (props.requireStudioMediaAccess && !hasStudioMediaAccess(planTier)) return false
  if (props.requiredTier && !meetsTier(planTier, props.requiredTier)) return false
  return true
}

// Which plan unlocks the thing this route needed, and a label for it - so the upgrade pitch
// shows the right branded card (e.g. a No-MLS agent who taps a Design Studio link lands on the
// "No-MLS Premium" card, not the Bright "Premium" one).
function upgradeTargetFor(planTier: string | undefined, props: SubscriptionGuardProps): { tier: string; feature: string } {
  const noMlsTrack = planTier === 'NO_MLS' || planTier === 'PRO_NO_MLS'
  if (props.requireStudioMediaAccess) return { tier: noMlsTrack ? 'PRO_NO_MLS' : 'IDX', feature: 'Media Lab' }
  if (props.requireStudioDesignAccess) return { tier: noMlsTrack ? 'PRO_NO_MLS' : 'PREMIUM', feature: 'Studio & Blogs' }
  if (props.requireAgentHubAccess) return { tier: noMlsTrack ? 'PRO_NO_MLS' : 'PREMIUM', feature: 'Agent Hub' }
  if (props.requireEmailSignatureAccess) return { tier: noMlsTrack ? 'PRO_NO_MLS' : 'IDX', feature: 'Signature' }
  if (props.requiredTier) return { tier: props.requiredTier, feature: props.featureName || 'This feature' }
  if (props.requireMlsAccess) return { tier: 'BASIC', feature: 'Bright MLS tools' }
  return { tier: 'PREMIUM', feature: 'This feature' }
}

export default function SubscriptionGuard(props: SubscriptionGuardProps) {
  const { children } = props
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading) return

    // Not authenticated - redirect to login
    if (!isAuthenticated || !user) {
      router.push(loginUrlForHere())  // the whole link (query + #), so they land back on it after login
      return
    }

    // Admins have access to everything
    if (user.is_admin) return

    // Check for users waiting to pay or with no active subscription
    if (user.subscription_status === 'PENDING_PAYMENT' || !hasValidSubscription(user)) {
      router.push('/checkout')
      return
    }

    // Check the specific capability(ies) this route requires
    if (!hasAccessForTier(user.plan_tier, props)) {
      const t = upgradeTargetFor(user.plan_tier, props)
      router.push(`/upgrade-required?tier=${t.tier}&feature=${encodeURIComponent(t.feature)}`)
      return
    }
  }, [user, isAuthenticated, isLoading, props.requireMlsAccess, props.requireAgentHubAccess, props.requireEmailSignatureAccess, props.requireStudioDesignAccess, props.requireStudioMediaAccess, props.requiredTier, router, pathname])

  if (isLoading) {
    return (
      <OhpLoader />
    )
  }

  // Permission check for rendering
  const hasAccess = user?.is_admin || (
    isAuthenticated &&
    user &&
    (user.subscription_status !== 'PENDING_PAYMENT' && hasValidSubscription(user)) &&
    hasAccessForTier(user.plan_tier, props)
  )

  return hasAccess ? <>{children}</> : null
}
