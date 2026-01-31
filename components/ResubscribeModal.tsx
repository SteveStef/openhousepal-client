'use client'

import { useState } from 'react'
import { X, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react'
import { PRICING_PLANS } from '@/lib/pricing'

interface ResubscribeModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPlan: (planTier: 'BASIC' | 'PREMIUM') => void
  isLoading?: boolean
}

export default function ResubscribeModal({
  isOpen,
  onClose,
  onSelectPlan,
  isLoading = false
}: ResubscribeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<'BASIC' | 'PREMIUM' | null>(null)

  const handleSelectPlan = (planTier: 'BASIC' | 'PREMIUM') => {
    setLoadingPlan(planTier)
    onSelectPlan(planTier)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#111827]/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-[2rem] shadow-2xl max-w-5xl w-full p-8 md:p-12 max-h-[95vh] overflow-y-auto border border-white dark:border-gray-800 transition-colors duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loadingPlan !== null}
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

        {/* Plan Options */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Basic Plan */}
          <div className="bg-white dark:bg-[#151517] rounded-[2rem] p-10 border border-gray-100 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative group hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all duration-300">
            <div className="text-center mb-10">
              <h4 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Basic Plan</h4>
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-black text-[#111827] dark:text-white tracking-tight">{PRICING_PLANS.BASIC.priceString}</span>
                <span className="text-[#6B7280] dark:text-gray-500 ml-2 font-medium">/mo</span>
              </div>
              <p className="text-xs font-black text-orange-500 dark:text-orange-400 uppercase tracking-widest mt-4">
                Billed today
              </p>
            </div>

            <ul className="space-y-4 mb-10">
              <li className="flex items-start text-gray-700 dark:text-gray-300 font-medium">
                <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 mr-3 flex-shrink-0" />
                <span>Unlimited Open House QR codes</span>
              </li>
              <li className="flex items-start text-gray-700 dark:text-gray-300 font-medium">
                <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 mr-3 flex-shrink-0" />
                <span>Visitor sign-in forms</span>
              </li>
              <li className="flex items-start text-gray-700 dark:text-gray-300 font-medium">
                <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 mr-3 flex-shrink-0" />
                <span>Lead capture and management</span>
              </li>
            </ul>

            <button
              onClick={() => handleSelectPlan('BASIC')}
              disabled={loadingPlan !== null}
              className="w-full py-5 bg-[#FAFAF7] dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#111827] dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPlan === 'BASIC' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#111827] dark:border-white"></div>
                </div>
              ) : (
                `Select Basic`
              )}
            </button>
          </div>

          {/* Premium Plan */}
          <div className="bg-[#111827] dark:bg-[#1A1A1C] rounded-[2rem] p-10 shadow-[0_30px_80px_-20px_rgba(201,162,77,0.3)] border border-gray-800 dark:border-gray-700 relative overflow-hidden transform md:-translate-y-4 transition-all duration-300">
            {/* Gradient Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#2c241b] to-[#3d3226] dark:from-[#1A1A1C] dark:via-[#2c241b] dark:to-[#3d3226] z-0"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A24D]/20 rounded-full blur-[80px] z-0"></div>
            
            <div className="relative z-10">
              <div className="absolute top-0 right-0">
                 <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#C9A24D] text-[#111827] text-[10px] font-black uppercase tracking-widest">
                  Recommended
                 </span>
              </div>

              <div className="text-center mb-10">
                <h4 className="text-sm font-bold text-[#C9A24D] uppercase tracking-widest mb-2">Premium Plan</h4>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black text-white tracking-tight">{PRICING_PLANS.PREMIUM.priceString}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-2 font-medium">/mo</span>
                </div>
                <p className="text-xs font-black text-yellow-400 dark:text-yellow-500 uppercase tracking-widest mt-4">
                  Billed today
                </p>
              </div>

              <div className="bg-white/10 dark:bg-black/20 rounded-xl p-4 mb-8 border border-white/5 dark:border-white/10">
                <p className="text-sm font-medium text-center text-white/90">
                  <Sparkles className="w-4 h-4 inline-block text-[#C9A24D] mr-2 -mt-0.5" />
                  Regain full access immediately
                </p>
              </div>

              <ul className="space-y-4 mb-10">
                <li className="flex items-start text-white font-medium">
                  <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                  </div>
                  <span>Unlimited Property Showcases</span>
                </li>
                <li className="flex items-start text-white font-medium">
                  <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                  </div>
                  <span>Automated Buyer Matching</span>
                </li>
                <li className="flex items-start text-white font-medium">
                  <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                  </div>
                  <span>Advanced Analytics & Insights</span>
                </li>
              </ul>

              <button
                onClick={() => handleSelectPlan('PREMIUM')}
                disabled={loadingPlan !== null}
                className="w-full py-5 bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] text-[#111827] rounded-2xl font-black text-sm uppercase tracking-widest hover:shadow-lg hover:shadow-[#C9A24D]/30 transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingPlan === 'PREMIUM' ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#111827] dark:border-white"></div>
                  </div>
                ) : (
                  <span className="flex items-center justify-center">
                    <Sparkles className="w-5 h-5 mr-3" />
                    Select Premium
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Cancel Button */}
        <div className="mt-12 text-center">
          <button
            onClick={onClose}
            disabled={loadingPlan !== null}
            className="group inline-flex items-center text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 px-6 py-3 rounded-full hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm disabled:opacity-50"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}