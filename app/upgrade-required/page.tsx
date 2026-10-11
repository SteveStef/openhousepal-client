'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Footer from '@/components/Footer'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Lock } from 'lucide-react'
import { PRICING_PLANS, type PlanTierId } from '@/lib/pricing'
import { PricingTierCard } from '@/components/pricing/PricingCards'
import { IdxDomainNotice } from '@/components/IdxDomainNotice'
import MissedShowcasesBanner from '@/components/MissedShowcasesBanner'

const VALID_TIERS: PlanTierId[] = ['NO_MLS', 'PRO_NO_MLS', 'BASIC', 'PREMIUM', 'IDX']

function UpgradeRequiredContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useAuth()

  const requestedTier = searchParams.get('tier') as PlanTierId | null
  const askedTier: PlanTierId = requestedTier && VALID_TIERS.includes(requestedTier) ? requestedTier : 'PREMIUM'
  // Accounts outside Bright MLS can't move onto a Bright plan - their way up is No-MLS Premium.
  const targetTier: PlanTierId = user && !user.mls_id && !['NO_MLS', 'PRO_NO_MLS'].includes(askedTier) ? 'PRO_NO_MLS' : askedTier
  const featureLabel = searchParams.get('feature') || 'This feature'
  const targetPlan = PRICING_PLANS[targetTier]

  const currentTier = (user?.plan_tier && VALID_TIERS.includes(user.plan_tier as PlanTierId)) ? (user.plan_tier as PlanTierId) : null
  const currentPlan = currentTier ? PRICING_PLANS[currentTier] : null

  const handleUpgrade = () => {
    router.push('/settings/subscription')
  }

  const hasInactiveSubscription = user?.subscription_status &&
    ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(user.subscription_status)

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] overflow-hidden relative transition-colors duration-300">
      {/* Sophisticated Background Architecture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-[#111827]/5 dark:bg-[#C9A24D]/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-light.png')] opacity-[0.03] dark:opacity-[0.01] mix-blend-overlay"></div>
      </div>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-5xl w-full">
          {/* Header Section - a real pitch (glowing icon, gradient headline) rather than a plain
              label, but still well short of the original's full-height centered stack. */}
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C9A24D]/10 text-[#C9A24D] shadow-sm border border-[#C9A24D]/20">
              <div className="absolute -inset-2.5 -z-10 rounded-3xl bg-[#C9A24D]/25 blur-xl animate-glow-pulse" />
              <Lock className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.3em] text-[#C9A24D]">Unlock More</span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#111827] via-[#3a2f25] to-[#C9A24D] dark:from-white dark:via-[#e5e7eb] dark:to-[#C9A24D]">{targetPlan.name} Plan</span>
            </h1>
            <p className="text-base text-[#6B7280] dark:text-gray-400 font-light leading-relaxed">
              <span className="text-[#111827] dark:text-white font-medium">{featureLabel}</span> is included on the <span className="text-[#111827] dark:text-white font-medium">{targetPlan.name}</span> plan. Upgrade to {targetPlan.name} to unlock it, along with everything else at that tier.
            </p>
          </div>

          {/* Showcases pitch for a Basic agent: the real guests they'd be serving right now. */}
          {/showcase/i.test(featureLabel) && (
            <div className="mx-auto mb-10 max-w-4xl">
              <MissedShowcasesBanner ctaHref="/settings/subscription" />
            </div>
          )}

          {/* Pricing Cards - both sides use the exact same shared card component as the homepage
              pricing grid (just `current` instead of a CTA on the left), so a Basic/Premium/IDX
              card looks identical everywhere in the app instead of drifting out of sync with a
              separate hand-rolled summary. */}
          <div className="grid md:grid-cols-2 gap-8 mb-16 items-start">
            {/* Current Plan */}
            <div className="flex flex-col gap-3">
              {currentTier ? (
                <PricingTierCard tier={currentTier} current />
              ) : (
                <div className="rounded-[2rem] border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-sm font-bold text-gray-400">
                  No active plan
                </div>
              )}
              {!isLoading && hasInactiveSubscription && (
                <button
                  onClick={handleUpgrade}
                  className="w-full py-3.5 bg-gray-50 dark:bg-gray-800 text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 text-sm"
                >
                  Reactivate {currentPlan?.name || 'Plan'}
                </button>
              )}
            </div>

            {/* Upgrade Target - the same polished tier card used on the homepage pricing grid,
                so what an agent sees here always matches what they saw when they signed up. No
                lift/translate here (unlike the homepage grid) so its top edge lines up exactly
                with the current-plan card beside it. */}
            <PricingTierCard tier={targetTier} ctaHref="/settings/subscription" ctaLabel={`Unlock ${featureLabel} — Upgrade Now`} />
          </div>

          {targetTier === 'IDX' && (
            <div className="max-w-3xl mx-auto mb-16 -mt-8">
              <IdxDomainNotice />
            </div>
          )}

          <div className="text-center mt-12">
            <button
              onClick={() => router.back()}
              className="group inline-flex items-center text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 px-6 py-3 rounded-full hover:bg-white dark:hover:bg-[#151517] hover:shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default function UpgradeRequiredPage() {
  return (
    <Suspense fallback={null}>
      <UpgradeRequiredContent />
    </Suspense>
  )
}
