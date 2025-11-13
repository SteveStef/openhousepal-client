'use client'

import { useState } from 'react'
import { X, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loadingPlan !== null}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Choose Your Plan
          </h3>
          <p className="text-gray-600 mb-4">
            Select a plan to resubscribe and regain access to Open House Pal
          </p>

          {/* Warning - No Trial */}
          <div className="inline-flex items-center px-4 py-3 bg-orange-50 border-2 border-orange-300 rounded-xl">
            <AlertCircle className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0" />
            <p className="text-sm font-bold text-orange-900">
              No free trial - Your card will be charged immediately
            </p>
          </div>
        </div>

        {/* Plan Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Basic Plan */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-[#8b7355] transition-all">
            <div className="text-center mb-6">
              <h4 className="text-xl font-bold text-gray-900 mb-2">Basic Plan</h4>
              <div className="text-3xl font-bold text-gray-900">
                $49.99<span className="text-lg font-normal text-gray-600">/month</span>
              </div>
              <p className="text-sm font-semibold text-orange-600 mt-2">
                Billed today: $49.99
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Unlimited Open House QR codes</span>
              </li>
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Visitor sign-in forms</span>
              </li>
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">Lead capture and management</span>
              </li>
            </ul>

            <button
              onClick={() => handleSelectPlan('BASIC')}
              disabled={loadingPlan !== null}
              className="w-full px-4 py-3 border-2 border-[#8b7355] text-[#8b7355] rounded-xl font-semibold hover:bg-[#8b7355] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPlan === 'BASIC' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#8b7355]"></div>
                </div>
              ) : (
                'Subscribe Now - $49.99'
              )}
            </button>
          </div>

          {/* Premium Plan */}
          <div className="bg-gradient-to-br from-[#8b7355] to-[#7a6549] rounded-xl p-6 relative transform md:scale-105 shadow-xl">
            {/* Recommended Badge */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <div className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-xs font-bold">
                RECOMMENDED
              </div>
            </div>

            <div className="text-center mb-6">
              <h4 className="text-xl font-bold text-white mb-2">Premium Plan</h4>
              <div className="text-3xl font-bold text-white">
                $99.99<span className="text-lg font-normal text-white/80">/month</span>
              </div>
              <p className="text-sm font-semibold text-yellow-300 mt-2">
                Billed today: $99.99
              </p>
              <p className="text-sm text-white/80 mt-1">Everything in Basic, plus:</p>
            </div>

            <ul className="space-y-3 mb-6">
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-white font-medium">All Basic Plan features</span>
              </li>
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-white font-medium">Property Showcases (Unlimited)</span>
              </li>
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-white font-medium">Automated property matching</span>
              </li>
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-white font-medium">Advanced filtering and preferences</span>
              </li>
              <li className="flex items-start text-sm">
                <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-white font-medium">Shareable property collections</span>
              </li>
            </ul>

            <button
              onClick={() => handleSelectPlan('PREMIUM')}
              disabled={loadingPlan !== null}
              className="w-full px-4 py-3 bg-white text-[#8b7355] rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loadingPlan === 'PREMIUM' ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#8b7355]"></div>
                </div>
              ) : (
                <span className="flex items-center justify-center">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Subscribe Now - $99.99
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Cancel Button */}
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            disabled={loadingPlan !== null}
            className="text-gray-600 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
