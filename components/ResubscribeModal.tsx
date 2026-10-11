'use client'

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { type PlanTierId } from '@/lib/pricing'
import { PricingTierCard } from '@/components/pricing/PricingCards'

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

export default function ResubscribeModal({
  isOpen,
  onClose,
  onSelectPlan,
  isLoading = false,
  inBright = true,
}: ResubscribeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<PlanTierId | null>(null)

  const handleSelectPlan = (planTier: PlanTierId) => {
    setLoadingPlan(planTier)
    onSelectPlan(planTier)
  }

  if (!isOpen) return null
  const busy = loadingPlan !== null || isLoading

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#111827]/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-[2rem] shadow-2xl max-w-6xl w-full p-8 md:p-12 max-h-[95vh] overflow-y-auto border border-white dark:border-gray-800 transition-colors duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-6 right-6 text-gray-400 hover:text-[#111827] dark:hover:text-white transition-colors disabled:opacity-50 z-10 p-2 hover:bg-white dark:hover:bg-gray-800 rounded-full shadow-sm"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Title */}
        <div className="text-center mb-12">
          <h3 className="text-4xl font-black text-[#111827] dark:text-white mb-4 tracking-tight">
            Choose Your Plan
          </h3>
          <p className="text-lg text-[#6B7280] dark:text-gray-400 mb-8 font-light max-w-xl mx-auto">
            Select a plan to resubscribe and regain access to your dashboard and tools.
          </p>

          {/* Warning - No Trial */}
          <div className="inline-flex items-center px-6 py-3 bg-white dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-2xl shadow-sm">
            <AlertCircle className="w-5 h-5 text-orange-500 dark:text-orange-400 mr-3 flex-shrink-0" />
            <p className="text-sm font-bold text-orange-900 dark:text-orange-300 uppercase tracking-wider">
              No free trial — Your account will be activated immediately
            </p>
          </div>
        </div>

        {/* Plan Options - the exact same canonical cards the homepage and checkout show */}
        <div className={`grid gap-6 items-start md:grid-cols-2 ${inBright ? 'lg:grid-cols-3' : 'max-w-3xl mx-auto w-full'}`}>
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

        {/* Cancel Button */}
        <div className="mt-12 text-center">
          <button
            onClick={onClose}
            disabled={busy}
            className="group inline-flex items-center text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 px-6 py-3 rounded-full hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm disabled:opacity-50"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}
