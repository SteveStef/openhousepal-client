'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { CheckCircle2, Sparkles, ArrowLeft, Lock } from 'lucide-react'
import { getCurrentUser, User } from '@/lib/auth'
import { PRICING_PLANS } from '@/lib/pricing'

export default function UpgradeRequiredPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser()
        setUser(userData)
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchUser()
  }, [])

  const handleUpgrade = () => {
    router.push('/settings/subscription')
  }

  const hasInactiveSubscription = user?.subscription_status &&
    ['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(user.subscription_status)

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] overflow-hidden relative">
      {/* Sophisticated Background Architecture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-[#111827]/5 rounded-full blur-[100px] mix-blend-multiply" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-light.png')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <Header mode="app" />

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-5xl w-full">
          {/* Header Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#C9A24D]/10 text-[#C9A24D] mb-8 shadow-sm border border-[#C9A24D]/20 transform rotate-3 hover:rotate-6 transition-transform duration-300">
              <Lock className="w-10 h-10" strokeWidth={1.5} />
            </div>
            <h1 className="text-5xl font-black text-[#0B0B0B] mb-6 tracking-tight">
              Premium Feature
            </h1>
            <p className="text-xl text-[#6B7280] font-light max-w-2xl mx-auto leading-relaxed">
              Unlock the full power of OpenHousePal. Upgrade to Premium to create unlimited <span className="text-[#111827] font-medium">Property Showcases</span> and automate your visitor follow-ups.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-16 items-start">
            {/* Basic Plan (Current) */}
            <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative group hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all duration-300">
              <div className="text-center mb-8">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Current Plan</h2>
                <h3 className="text-3xl font-black text-[#0B0B0B] mb-4">Basic</h3>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-black text-[#0B0B0B] tracking-tight">{PRICING_PLANS.BASIC.priceString}</span>
                  <span className="text-[#6B7280] ml-2 font-medium">/mo</span>
                </div>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center text-gray-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                  Unlimited QR codes
                </div>
                <div className="flex items-center text-gray-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                  Visitor sign-in forms
                </div>
                <div className="flex items-center text-gray-400 font-medium">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 mr-3 flex-shrink-0 flex items-center justify-center">
                    <div className="w-0.5 h-3 bg-gray-200 rotate-45"></div>
                  </div>
                  <span className="line-through decoration-gray-300">Property Showcases</span>
                </div>
                <div className="flex items-center text-gray-400 font-medium">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 mr-3 flex-shrink-0 flex items-center justify-center">
                    <div className="w-0.5 h-3 bg-gray-200 rotate-45"></div>
                  </div>
                  <span className="line-through decoration-gray-300">Automated Matching</span>
                </div>
              </div>

              {!isLoading && hasInactiveSubscription && (
                <button
                  onClick={handleUpgrade}
                  className="w-full py-4 bg-gray-50 text-[#111827] rounded-xl font-bold border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-300"
                >
                  Reactivate Basic
                </button>
              )}
            </div>

            {/* Premium Plan (Upgrade Target) */}
            <div className="bg-[#111827] rounded-[2rem] p-10 shadow-[0_30px_80px_-20px_rgba(201,162,77,0.3)] border border-gray-800 relative overflow-hidden transform md:-translate-y-4">
              {/* Gradient Effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#2c241b] to-[#3d3226] z-0"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A24D]/20 rounded-full blur-[80px] z-0"></div>
              
              <div className="relative z-10">
                <div className="absolute top-0 right-0">
                   <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#C9A24D] text-[#111827] text-[10px] font-black uppercase tracking-widest">
                    Recommended
                   </span>
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-sm font-bold text-[#C9A24D] uppercase tracking-widest mb-2">Upgrade To</h2>
                  <h3 className="text-3xl font-black text-white mb-4">Premium</h3>
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-black text-white tracking-tight">{PRICING_PLANS.PREMIUM.priceString}</span>
                    <span className="text-gray-400 ml-2 font-medium">/mo</span>
                  </div>
                </div>

                <div className="bg-white/10 rounded-xl p-4 mb-8 border border-white/5">
                  <p className="text-sm font-medium text-center text-white/90">
                    <Sparkles className="w-4 h-4 inline-block text-[#C9A24D] mr-2 -mt-0.5" />
                    Unlocks all features immediately
                  </p>
                </div>

                <div className="space-y-4 mb-10">
                  <div className="flex items-center text-white font-medium">
                    <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                    Everything in Basic
                  </div>
                  <div className="flex items-center text-white font-medium">
                    <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                    Unlimited Property Showcases
                  </div>
                  <div className="flex items-center text-white font-medium">
                    <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                    Automated Buyer Matching
                  </div>
                  <div className="flex items-center text-white font-medium">
                    <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                    Advanced Analytics & Insights
                  </div>
                </div>

                <button
                  onClick={handleUpgrade}
                  className="w-full py-4 bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] text-[#111827] rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-[#C9A24D]/30 transition-all duration-300 transform hover:-translate-y-1"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>

          {/* Feature Deep Dive */}
          <div className="bg-white rounded-[2rem] p-10 border border-gray-100 shadow-sm">
            <div className="flex items-center mb-8">
              <div className="w-12 h-12 bg-[#111827] rounded-2xl flex items-center justify-center mr-6 text-[#C9A24D]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-[#0B0B0B] tracking-tight">Why Upgrade?</h3>
                <p className="text-[#6B7280]">How Showcases transform your workflow</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-[#FAFAF7] flex items-center justify-center mr-4 mt-1 flex-shrink-0 border border-gray-100">
                  <span className="text-sm font-bold text-[#111827]">01</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#111827] mb-2">Automatic Matching</h4>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    The system analyzes visitor preferences and instantly finds matching properties from your portfolio, saving you hours of manual searching.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-[#FAFAF7] flex items-center justify-center mr-4 mt-1 flex-shrink-0 border border-gray-100">
                  <span className="text-sm font-bold text-[#111827]">02</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#111827] mb-2">Personalized Collections</h4>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    Each visitor receives a unique, branded webpage featuring properties they'll love. It's like a digital brochure custom-made for them.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-[#FAFAF7] flex items-center justify-center mr-4 mt-1 flex-shrink-0 border border-gray-100">
                  <span className="text-sm font-bold text-[#111827]">03</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#111827] mb-2">Engagement Tracking</h4>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    Know exactly when they open their showcase, which homes they view, and get notified instantly when they request a tour.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-[#FAFAF7] flex items-center justify-center mr-4 mt-1 flex-shrink-0 border border-gray-100">
                  <span className="text-sm font-bold text-[#111827]">04</span>
                </div>
                <div>
                  <h4 className="font-bold text-[#111827] mb-2">Zero Maintenance</h4>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    As new properties hit the market, showcases automatically update. You stay top-of-mind without lifting a finger.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => router.back()}
              className="group inline-flex items-center text-[#6B7280] hover:text-[#111827] font-bold text-xs uppercase tracking-widest transition-all duration-300 px-6 py-3 rounded-full hover:bg-white hover:shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}