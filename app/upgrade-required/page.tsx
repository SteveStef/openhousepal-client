'use client'

import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CheckCircle2, Sparkles } from 'lucide-react'

export default function UpgradeRequiredPage() {
  const router = useRouter()

  const handleUpgrade = () => {
    // TODO: Implement PayPal plan upgrade flow
    // For now, redirect to register page with upgrade message
    router.push('/register?upgrade=true')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2]">
      <Header mode="app" />

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full">
          {/* Premium Feature Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#8b7355] to-[#7a6549] mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Premium Feature
            </h1>
            <p className="text-xl text-gray-600">
              Upgrade to Premium to unlock Showcases and create unlimited property collections
            </p>
          </div>

          {/* Pricing Comparison */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Basic Plan (Current) */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic Plan</h2>
                <div className="text-3xl font-bold text-gray-600">
                  $49.99<span className="text-lg font-normal">/month</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">Your current plan</p>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Unlimited Open House QR codes</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Visitor sign-in forms</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Lead capture and management</span>
                </li>
                <li className="flex items-start opacity-40">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 mr-3 mt-0.5 flex-shrink-0"></div>
                  <span className="text-gray-500 line-through">Property Showcases</span>
                </li>
                <li className="flex items-start opacity-40">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 mr-3 mt-0.5 flex-shrink-0"></div>
                  <span className="text-gray-500 line-through">Automated property matching</span>
                </li>
              </ul>
            </div>

            {/* Premium Plan */}
            <div className="bg-gradient-to-br from-[#8b7355] to-[#7a6549] rounded-2xl shadow-2xl p-8 border-2 border-[#8b7355] relative transform md:scale-105">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                  RECOMMENDED
                </div>
              </div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Premium Plan</h2>
                <div className="text-3xl font-bold text-white">
                  $99.99<span className="text-lg font-normal">/month</span>
                </div>
                <p className="text-sm text-white/80 mt-2">Everything in Basic, plus:</p>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-white font-medium">All Basic Plan features</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-white font-medium">Property Showcases (Unlimited)</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-white font-medium">Automated property matching</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-white font-medium">Advanced filtering and preferences</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-white font-medium">Shareable property collections</span>
                </li>
              </ul>
              <button
                onClick={handleUpgrade}
                className="w-full mt-8 bg-white text-[#8b7355] font-bold py-4 px-6 rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>

          {/* What are Showcases? */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">What are Property Showcases?</h3>
            <p className="text-gray-700 mb-4">
              Property Showcases allow you to automatically create personalized property collections for your open house visitors.
              When someone expresses interest in similar properties, the system automatically finds and organizes matching listings
              based on their preferences.
            </p>
            <ul className="grid md:grid-cols-2 gap-4">
              <li className="flex items-start">
                <CheckCircle2 className="w-5 h-5 text-[#8b7355] mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900">Automatic Matching</span>
                  <p className="text-sm text-gray-600">System finds properties matching buyer preferences</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-5 h-5 text-[#8b7355] mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900">Shareable Collections</span>
                  <p className="text-sm text-gray-600">Generate unique links to send to potential buyers</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-5 h-5 text-[#8b7355] mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900">Visitor Engagement</span>
                  <p className="text-sm text-gray-600">Track likes, comments, and tour requests</p>
                </div>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-5 h-5 text-[#8b7355] mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900">Unlimited Collections</span>
                  <p className="text-sm text-gray-600">Create as many showcases as you need</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Go Back Button */}
          <div className="text-center">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-[#8b7355] font-medium transition-colors"
            >
              ← Go Back
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
