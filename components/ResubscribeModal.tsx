'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { type PlanTierId } from '@/lib/pricing'
import { PricingTierCard } from '@/components/pricing/PricingCards'
import OhSheet from '@/components/open-house-manager/OhSheet'

interface ResubscribeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPlan: (planTier: PlanTierId) => void
  isLoading?: boolean
  // false = account outside Bright MLS - only the No-MLS plans apply.
  inBright?: boolean
}

// Every plan, so an agent can always come back to the one they had (No-MLS Premium included).
const TIER_ORDER: PlanTierId[] = ['NO_MLS', 'PRO_NO_MLS', 'BASIC', 'PREMIUM', 'IDX']
const SELECT_LABEL: Record<PlanTierId, string> = {
  NO_MLS: 'Select No-MLS Basic', PRO_NO_MLS: 'Select No-MLS Premium',
  BASIC: 'Select Basic', PREMIUM: 'Select Premium', IDX: 'Select IDX',
}

/** Restart a plan - a sheet that slides up on a phone, a wide window on a computer (owner, 11/11). */
export default function ResubscribeModal({
  isOpen,
  onClose,
  onSelectPlan,
  isLoading = false,
  inBright = true,
}: ResubscribeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanTierId | null>(null)
  // Opening it again starts fresh (a plan picked last time used to keep every button disabled).
  useEffect(() => { if (isOpen) setLoadingPlan(null) }, [isOpen])

  const handleSelectPlan = (planTier: PlanTierId) => {
    setLoadingPlan(planTier)
    onSelectPlan(planTier)
  }

  const busy = loadingPlan !== null || isLoading
  const close = () => { if (!busy) onClose() }

  return (
    <OhSheet open={isOpen} onClose={close} width="max-w-6xl" title="Choose your plan" subtitle="Restart and get back to your dashboard and tools" icon={<RotateCcw className="h-5 w-5" />} zClass="z-[110]">
      <div className="mb-6 flex items-center justify-center">
        <div className="inline-flex items-center rounded-2xl border border-orange-100 bg-white px-4 py-2.5 shadow-sm dark:border-orange-900/30 dark:bg-orange-900/10">
          <AlertCircle className="mr-2.5 h-4 w-4 flex-shrink-0 text-orange-500 dark:text-orange-400" />
          <p className="text-xs font-bold uppercase tracking-wider text-orange-900 dark:text-orange-300">
            No free trial - your account switches on right away
          </p>
        </div>
      </div>

      {/* The exact same canonical cards the homepage and checkout show */}
      <div className={`grid items-start gap-5 md:grid-cols-2 ${inBright ? 'lg:grid-cols-3' : 'mx-auto w-full max-w-3xl'}`}>
        {TIER_ORDER.filter(t => inBright || t === 'NO_MLS' || t === 'PRO_NO_MLS').map(tier => (
          <PricingTierCard
            key={tier}
            tier={tier}
            ctaLabel={loadingPlan === tier ? 'Starting…' : SELECT_LABEL[tier]}
            onCtaClick={() => handleSelectPlan(tier)}
            ctaDisabled={busy}
          />
        ))}
      </div>
    </OhSheet>
  )
}
