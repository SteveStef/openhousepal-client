'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import PayPalSubscriptionButton from '@/components/PayPalSubscriptionButton'
import { PayPalScriptProvider } from "@paypal/react-paypal-js"
import { PRICING_PLANS, TRIAL_PERIOD_DAYS } from '@/lib/pricing'
import { hasValidSubscription } from '@/lib/auth'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import AuthGuard from '@/components/AuthGuard'
import Toast from '@/components/Toast'
import Footer from '@/components/Footer'
import Image from 'next/image'
import { CheckCircle2, Sparkles, CreditCard, Gift, ShieldCheck, ArrowLeft } from 'lucide-react'

// PayPal configuration
const paypalOptions = {
  clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '',
  vault: true,
  intent: "subscription",
  currency: "USD",
}

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <CheckoutContent />
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}

interface SelectedPlan {
  id: string;
  name: string;
  price: string;
  priceValue: number;
  tier: string;
  features: string[] | readonly string[];
}

function CheckoutContent() {
  const router = useRouter()
  const { user, refreshUser, isLoading: isAuthLoading } = useAuth()
  
  const [registrationStep, setRegistrationStep] = useState<'pricing' | 'payment'>('pricing')
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null)
  const [bundleCode, setBundleCode] = useState('')
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [appliedBundleCode, setAppliedBundleCode] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })

  useEffect(() => {
    if (isAuthLoading || !user) return

    // If user is already paid and has a valid subscription, send them to open-houses
    if (hasValidSubscription(user)) {
      router.push('/open-houses')
      return
    }

    // If they had a subscription that is now cancelled/expired, send them to settings
    // This prevents them from getting another free trial through the checkout page
    if (user.subscription_status === 'CANCELLED' || user.subscription_status === 'EXPIRED') {
      router.push('/settings/subscription')
    }
  }, [user, isAuthLoading, router])
  const handleVerifyBundleCode = async () => {
    if (!bundleCode.trim()) return
    
    setIsVerifyingCode(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
      const response = await fetch(`${apiUrl}/auth/verify-bundle-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: bundleCode.trim() })
      })
      
      const data = await response.json()
      if (response.ok && data.valid) {
        setAppliedBundleCode(bundleCode.trim())
        setSelectedPlan({
          id: data.plan_id,
          name: PRICING_PLANS.PREMIUM.name,
          price: PRICING_PLANS.PREMIUM.priceString,
          priceValue: PRICING_PLANS.PREMIUM.price,
          tier: 'PREMIUM',
          features: [...PRICING_PLANS.PREMIUM.features]
        })
        setRegistrationStep('payment')
        setNotification({ type: 'success', message: 'Promo code applied! Enjoy your special rate.' })
      } else {
        setNotification({ type: 'error', message: data.detail || 'Invalid promo code' })
      }
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to verify code' })
    } finally {
      setIsVerifyingCode(false)
    }
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#C9A24D]/20 border-t-[#C9A24D] rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] relative overflow-hidden transition-colors duration-300">
      {/* Sophisticated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-[#111827]/5 dark:bg-[#C9A24D]/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-light.png')] opacity-[0.03] dark:opacity-[0.01] mix-blend-overlay"></div>
      </div>

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-5xl w-full">
          
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-black text-[#0B0B0B] dark:text-white mb-6 tracking-tight uppercase">
              Finalize <span className="text-[#C9A24D]">Account</span>
            </h1>
            <p className="text-xl text-[#6B7280] dark:text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
              Your credentials have been verified. Select your plan below to activate your <span className="text-[#111827] dark:text-white font-medium italic underline decoration-[#C9A24D]/30 underline-offset-4">{TRIAL_PERIOD_DAYS}-day free trial</span> and start automating your lead workflow.
            </p>
          </div>

          {registrationStep === 'pricing' ? (
            <>
              {/* Pricing Cards */}
              <div className="grid md:grid-cols-2 gap-8 mb-16 items-start">
                {/* Basic Plan */}
                <div className="bg-white dark:bg-[#151517] rounded-[2rem] p-10 border border-gray-100 dark:border-gray-800 shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative group hover:shadow-[0_30px_60px_rgba(0,0,0,0.08)] transition-all duration-300">
                  <div className="text-center mb-8">
                    <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Essential Access</h2>
                    <h3 className="text-3xl font-black text-[#0B0B0B] dark:text-white mb-4">{PRICING_PLANS.BASIC.name}</h3>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-black text-[#0B0B0B] dark:text-white tracking-tight">{PRICING_PLANS.BASIC.priceString}</span>
                      <span className="text-[#6B7280] dark:text-gray-500 ml-2 font-medium">/mo</span>
                    </div>
                    <p className="text-[10px] font-black text-[#C9A24D] mt-4 uppercase tracking-[0.2em]">After {TRIAL_PERIOD_DAYS}-Day Free Trial</p>
                  </div>
                  
                  <div className="space-y-4 mb-10">
                    {PRICING_PLANS.BASIC.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center text-gray-700 dark:text-gray-300 font-medium text-sm">
                        <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400 mr-3 flex-shrink-0" />
                        {feature}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlan({
                        id: PRICING_PLANS.BASIC.paypalPlanId,
                        name: PRICING_PLANS.BASIC.name,
                        price: PRICING_PLANS.BASIC.priceString,
                        priceValue: PRICING_PLANS.BASIC.price,
                        tier: 'BASIC',
                        features: [...PRICING_PLANS.BASIC.features]
                      })
                      setRegistrationStep('payment')
                    }}
                    className="w-full py-5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white transition-all shadow-xl active:scale-95"
                  >
                    Select Basic Plan
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

                    <div className="text-center mb-8">
                      <h2 className="text-sm font-bold text-[#C9A24D] uppercase tracking-widest mb-2">Most Powerful</h2>
                      <h3 className="text-3xl font-black text-white mb-4">Premium</h3>
                      <div className="flex items-baseline justify-center">
                        <span className="text-5xl font-black text-white tracking-tight">{PRICING_PLANS.PREMIUM.priceString}</span>
                        <span className="text-gray-400 dark:text-gray-500 ml-2 font-medium">/mo</span>
                      </div>
                      <p className="text-[10px] font-black text-[#C9A24D] mt-4 uppercase tracking-[0.2em]">After {TRIAL_PERIOD_DAYS}-Day Free Trial</p>
                    </div>

                    <div className="space-y-4 mb-10">
                      {PRICING_PLANS.PREMIUM.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-white font-medium text-sm">
                          <div className="w-5 h-5 bg-[#C9A24D] rounded-full flex items-center justify-center mr-3 flex-shrink-0 text-[#111827]">
                            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
                          </div>
                          {feature}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedPlan({
                          id: PRICING_PLANS.PREMIUM.paypalPlanId,
                          name: PRICING_PLANS.PREMIUM.name,
                          price: PRICING_PLANS.PREMIUM.priceString,
                          priceValue: PRICING_PLANS.PREMIUM.price,
                          tier: 'PREMIUM',
                          features: [...PRICING_PLANS.PREMIUM.features]
                        })
                        setRegistrationStep('payment')
                      }}
                      className="w-full py-5 bg-gradient-to-r from-[#C9A24D] to-[#b38e3e] text-[#111827] rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-[#C9A24D]/30 transition-all duration-300 transform active:scale-95"
                    >
                      Select Premium Plan
                    </button>
                  </div>
                </div>
              </div>

              {/* Promo Code Entry */}
              <div className="max-w-md mx-auto bg-white dark:bg-[#151517] p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gray-50 dark:bg-[#0B0B0B] rounded-xl text-gray-400">
                    <Gift size={18} />
                  </div>
                  <h4 className="font-black text-[#111827] dark:text-white uppercase tracking-widest text-[10px]">Promo Code</h4>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={bundleCode}
                    onChange={(e) => setBundleCode(e.target.value.toUpperCase())}
                    placeholder="ENTER CODE"
                    className="flex-1 px-5 py-4 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-transparent focus:border-[#C9A24D]/30 rounded-2xl text-xs font-black tracking-widest focus:outline-none transition-all uppercase placeholder-gray-300 dark:placeholder-gray-700"
                  />
                  <button
                    onClick={handleVerifyBundleCode}
                    disabled={isVerifyingCode || !bundleCode}
                    className="px-8 py-4 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] dark:hover:text-white transition-all disabled:opacity-50 active:scale-95"
                  >
                    {isVerifyingCode ? '...' : 'Apply'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Final Payment State - Refined & Secure */
            <div className="max-w-4xl mx-auto grid md:grid-cols-5 gap-8 items-start">
              
              {/* Left Column: Summary (2/5) */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white dark:bg-[#151517] rounded-[2rem] p-8 border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden transition-all">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#C9A24D]"></div>
                  
                  <div className="mb-8">
                    <h3 className="text-[10px] font-black text-[#C9A24D] uppercase tracking-[0.3em] mb-2">Order Summary</h3>
                    <div className="text-2xl font-black text-[#111827] dark:text-white uppercase tracking-tight">{selectedPlan?.name}</div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#6B7280] dark:text-gray-500 font-bold uppercase tracking-wider">Setup Fee</span>
                      <span className="text-[#111827] dark:text-white font-black">$0.00</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#6B7280] dark:text-gray-500 font-bold uppercase tracking-wider">Trial Duration</span>
                      <span className="text-[#111827] dark:text-white font-black">{TRIAL_PERIOD_DAYS} Days</span>
                    </div>
                    <div className="pt-4 border-t border-gray-50 dark:border-gray-800 flex justify-between items-baseline">
                      <span className="text-[#111827] dark:text-white font-black text-xs uppercase tracking-widest">Post-Trial Price</span>
                      <div className="text-right">
                        <div className="text-2xl font-black text-[#C9A24D] tracking-tighter">{appliedBundleCode ? 'Special Rate' : selectedPlan?.price}<span className="text-[10px] ml-1">/mo</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      No commitment. Cancel anytime before trial ends.
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setRegistrationStep('pricing')}
                  className="flex items-center gap-2 px-6 text-[10px] font-black text-[#6B7280] hover:text-[#111827] dark:hover:text-white uppercase tracking-[0.3em] transition-colors group"
                >
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                  Change Selected Plan
                </button>
              </div>

              {/* Right Column: Payment (3/5) */}
              <div className="md:col-span-3">
                <div className="bg-white dark:bg-[#1A1A1C] rounded-[2.5rem] p-10 shadow-2xl border border-gray-100 dark:border-gray-700 relative overflow-hidden transition-colors duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FAFAF7]/50 via-white/30 to-[#FAFAF7]/50 dark:from-[#111827] dark:via-[#1a1a1e] dark:to-[#111827] opacity-50 z-0"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-10">
                      <div>
                        <h2 className="text-2xl font-black text-[#111827] dark:text-white uppercase tracking-tight mb-1">Activate Account</h2>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                          <span className="text-[10px] font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.2em]">Secure Checkout Enabled</span>
                        </div>
                      </div>
                      <div className="p-3 bg-[#C9A24D]/10 dark:bg-white/5 rounded-2xl border border-[#C9A24D]/20 dark:border-white/10 text-[#C9A24D]">
                        <CreditCard className="w-6 h-6" />
                      </div>
                    </div>
                    
                    <div className="bg-[#FAFAF7] dark:bg-black/20 rounded-[2rem] p-8 mb-8 border border-gray-100 dark:border-white/5 backdrop-blur-sm">
                      <p className="text-center text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.3em] mb-8">Pay securely with PayPal</p>
                      
                      <div className="rounded-xl overflow-hidden shadow-sm">
                        <PayPalScriptProvider options={paypalOptions}>
                          <PayPalSubscriptionButton 
                            planId={selectedPlan?.id || ''}
                            registrationData={{} as any}
                            isCheckoutOnly={true}
                            bundleCode={appliedBundleCode || undefined}
                            onSuccess={async () => {
                              await refreshUser()
                              router.push('/open-houses')
                            }}
                            onError={(err) => setNotification({ type: 'error', message: err })}
                          />
                        </PayPalScriptProvider>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#111827] dark:text-white" />
                          <span className="text-[9px] font-black text-[#111827] dark:text-white uppercase tracking-widest text-center leading-none">SSL Encrypted</span>
                        </div>
                        <div className="w-px h-4 bg-[#111827]/20 dark:bg-white/20"></div>
                        <span className="text-[9px] font-black text-[#111827] dark:text-white uppercase tracking-widest text-center leading-none">PCI Compliant</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <Toast 
        isVisible={!!notification.type}
        message={notification.message}
        type={notification.type === 'error' ? 'error' : 'success'}
        onClose={() => setNotification({ type: null, message: '' })}
      />
    </div>
  )
}
