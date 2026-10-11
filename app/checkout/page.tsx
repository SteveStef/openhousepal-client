'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import PayPalSubscriptionButton from '@/components/PayPalSubscriptionButton'
import { PayPalScriptProvider } from "@paypal/react-paypal-js"
import { PRICING_PLANS, TRIAL_PERIOD_DAYS, type PlanTierId } from '@/lib/pricing'
import type { CheckoutCode } from '@/types'
import { PricingTierCard } from '@/components/pricing/PricingCards'
import { hasValidSubscription } from '@/lib/auth-helpers'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import AuthGuard from '@/components/AuthGuard'
import Toast from '@/components/Toast'
import Footer from '@/components/Footer'
import { CheckCircle2, CreditCard, Gift, ShieldCheck, ArrowLeft } from 'lucide-react'

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
}

// One place to turn a tier id into the SelectedPlan shape the payment step needs.
function planToSelected(tier: PlanTierId): SelectedPlan {
  const p = PRICING_PLANS[tier]
  return { id: p.paypalPlanId, name: p.name, price: p.priceString, priceValue: p.price, tier }
}

function CheckoutContent() {
  const router = useRouter()
  const { user, refreshUser, isLoading: isAuthLoading } = useAuth()
  
  const [registrationStep, setRegistrationStep] = useState<'pricing' | 'payment'>('pricing')
  const [checkoutAudience, setCheckoutAudience] = useState<'bright' | 'no_mls'>('bright')
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null)
  const [bundleCode, setBundleCode] = useState('')
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [appliedCode, setAppliedCode] = useState<CheckoutCode | null>(null)
  const [isActivating, setIsActivating] = useState(false)
  // A 'billed by us' code: no PayPal at all, we invoice the agent ourselves.
  const billedByUs = appliedCode?.kind === 'billed_by_us'
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' })

  // Agents outside Bright MLS (no MLS ID) can only use the No-MLS plans. Everyone else starts on
  // the side of the plan card they clicked before signing up (remembered by the sign-up page).
  const inBright = !!user?.mls_id
  useEffect(() => {
    if (!user) return
    if (!user.mls_id) { setCheckoutAudience('no_mls'); return }
    try {
      const plan = localStorage.getItem('ohp_signup_plan')
      if (plan === 'no_mls' || plan === 'pro_no_mls') setCheckoutAudience('no_mls')
    } catch {}
  }, [user])

  useEffect(() => {
    if (isAuthLoading || !user) return

    // If user is already paid and has a valid subscription, send them to their Dash (where the welcome email points too)
    if (hasValidSubscription(user)) {
      router.push('/dash')
      return
    }

    // If they had a subscription that is now cancelled/expired, send them to settings
    // This prevents them from getting another free trial through the checkout page
    if (user.subscription_status === 'CANCELLED' || user.subscription_status === 'EXPIRED' || user.subscription_status === 'SUSPENDED' || user.subscription_id) {
      router.push('/settings/subscription')
    }
  }, [user, isAuthLoading, router])
  // What PayPal will actually do for the picked plan (trial length, price, setup fee) - the
  // order summary shows this instead of assuming every plan has the same free trial.
  const [terms, setTerms] = useState<{ trial_days: number; price: number | null; setup_fee: number } | null>(null)
  useEffect(() => {
    setTerms(null)
    const id = selectedPlan?.id
    if (!id || id.startsWith('P-DEFAULT') || billedByUs) return
    let live = true
    api.paypal.planTerms(id).then(({ success, data }) => { if (live && success && data) setTerms(data) })
    return () => { live = false }
  }, [selectedPlan?.id, billedByUs])

  // Picking a plan swaps the page to the payment step - bring it into view (the plan cards are
  // long, so the button that was tapped is often far down the page).
  useEffect(() => {
    if (registrationStep === 'payment') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [registrationStep])

  // IDX never has a free trial; the others fall back to the standard trial until PayPal answers.
  const trialDays = billedByUs ? 0 : terms ? terms.trial_days : (selectedPlan?.tier === 'IDX' || appliedCode ? 0 : TRIAL_PERIOD_DAYS)
  const hasTrial = trialDays > 0

  const handleVerifyBundleCode = async () => {
    if (!bundleCode.trim()) return
    
    setIsVerifyingCode(true)
    const { success, data, error } = await api.auth.verifyBundleCode(bundleCode.trim())

    if (success && data) {
      const tier = (data.plan_tier in PRICING_PLANS ? data.plan_tier : 'PREMIUM') as PlanTierId
      setAppliedCode(data)
      setSelectedPlan({ ...planToSelected(tier), id: data.plan_id || '', name: data.plan_name || PRICING_PLANS[tier].name })
      setRegistrationStep('payment')
      setNotification({ type: 'success', message: data.message || 'Code applied!' })
    } else {
      setNotification({ type: 'error', message: error || "That code isn't valid" })
    }
    setIsVerifyingCode(false)
  }

  const activateWithCode = async () => {
    if (!appliedCode) return
    setIsActivating(true)
    const { success, error } = await api.auth.redeemCode(appliedCode.code)
    if (success) {
      await refreshUser()
      router.push('/dash')
      return
    }
    setNotification({ type: 'error', message: error || "Couldn't switch your account on" })
    setIsActivating(false)
  }
  const cycleWord = (c?: string | null) => (c === 'yearly' ? 'yr' : c === 'quarterly' ? 'qtr' : 'mo')

  if (isAuthLoading) {
    return (
      <OhpLoader />
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
              Pick your plan to switch your account on. {inBright ? 'Every plan except IDX starts' : 'Both plans start'} with a <span className="text-[#111827] dark:text-white font-medium italic underline decoration-[#C9A24D]/30 underline-offset-4">{TRIAL_PERIOD_DAYS}-day free trial</span>.
            </p>
          </div>

          {registrationStep === 'pricing' ? (
            <>
              {/* Audience Toggle - only for Bright agents (they may pick either side) */}
              {!inBright && (
                <p className="mb-10 text-center text-sm font-medium text-[#6B7280] dark:text-gray-400">
                  Your account isn&apos;t connected to Bright MLS, so these are your plans.
                </p>
              )}
              <div className={`flex justify-center mb-10 ${inBright ? '' : 'hidden'}`}>
                <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] p-1 shadow-sm">
                  <button
                    onClick={() => setCheckoutAudience('bright')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${checkoutAudience === 'bright' ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-500 dark:text-gray-400 hover:text-[#0B0B0B] dark:hover:text-white'}`}
                  >
                    Bright MLS Agent
                  </button>
                  <button
                    onClick={() => setCheckoutAudience('no_mls')}
                    className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${checkoutAudience === 'no_mls' ? 'bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]' : 'text-gray-500 dark:text-gray-400 hover:text-[#0B0B0B] dark:hover:text-white'}`}
                  >
                    Non-Bright MLS
                  </button>
                </div>
              </div>

              {/* One set of canonical plan cards - the exact same components the homepage,
                  /upgrade-required, Settings, and the resubscribe modal render. onCtaClick
                  drives the local pricing -> payment step instead of navigating. */}
              {checkoutAudience === 'bright' ? (
              <div className="grid md:grid-cols-3 gap-8 mb-16 items-start">
                {(['BASIC', 'PREMIUM', 'IDX'] as const).map((tier) => (
                  <PricingTierCard
                    key={tier}
                    tier={tier}
                    ctaLabel={`Select ${PRICING_PLANS[tier].name}`}
                    onCtaClick={() => { setSelectedPlan(planToSelected(tier)); setRegistrationStep('payment') }}
                  />
                ))}
              </div>
              ) : (
              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16 items-start">
                {(['NO_MLS', 'PRO_NO_MLS'] as const).map((tier) => (
                  <PricingTierCard
                    key={tier}
                    tier={tier}
                    ctaLabel={`Select ${PRICING_PLANS[tier].name}`}
                    onCtaClick={() => { setSelectedPlan(planToSelected(tier)); setRegistrationStep('payment') }}
                  />
                ))}
              </div>
              )}

              {/* Promo Code Entry */}
              <div className="max-w-md mx-auto bg-white dark:bg-[#151517] p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gray-50 dark:bg-[#0B0B0B] rounded-xl text-gray-400">
                    <Gift size={18} />
                  </div>
                  <h4 className="font-black text-[#111827] dark:text-white uppercase tracking-widest text-[10px]">Have a team or promo code?</h4>
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
                    {appliedCode && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8c97a]">
                        <Gift className="h-3 w-3" /> {appliedCode.code}{appliedCode.label ? ` · ${appliedCode.label}` : ''}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#6B7280] dark:text-gray-500 font-bold uppercase tracking-wider">Setup Fee</span>
                      <span className="text-[#111827] dark:text-white font-black">
                        {billedByUs ? '$0.00' : terms ? (terms.setup_fee > 0 ? `$${terms.setup_fee.toFixed(2)} one-time` : '$0.00') : (selectedPlan?.tier === 'IDX' || appliedCode ? 'Shown on PayPal' : '$0.00')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#6B7280] dark:text-gray-500 font-bold uppercase tracking-wider">Free Trial</span>
                      <span className="text-[#111827] dark:text-white font-black">{hasTrial ? `${trialDays} Days` : 'None'}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-50 dark:border-gray-800 flex justify-between items-baseline">
                      <span className="text-[#111827] dark:text-white font-black text-xs uppercase tracking-widest">{billedByUs ? 'Your Price' : hasTrial ? 'Post-Trial Price' : 'Monthly Price'}</span>
                      <div className="text-right">
                        {billedByUs ? (
                          <div className="text-2xl font-black text-[#C9A24D] tracking-tighter">{appliedCode?.custom_price != null ? `$${appliedCode.custom_price.toFixed(2)}` : 'As agreed'}{appliedCode?.custom_price != null && <span className="text-[10px] ml-1">/{cycleWord(appliedCode.billing_cycle)}</span>}</div>
                        ) : (
                          <div className="text-2xl font-black text-[#C9A24D] tracking-tighter">{terms?.price ? `$${terms.price.toFixed(2)}` : appliedCode ? 'Special Rate' : selectedPlan?.price}<span className="text-[10px] ml-1">/mo</span></div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3 text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {billedByUs ? "We'll send your invoices directly - no PayPal needed." : hasTrial ? 'No commitment. Cancel anytime before trial ends.' : 'No commitment. Cancel anytime in Settings > Billing.'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setRegistrationStep('pricing'); setAppliedCode(null); setBundleCode('') }}
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
                    
                    <div className="bg-[#FAFAF7] dark:bg-black/20 rounded-[2rem] p-8 mb-8 border border-gray-100 dark:border-white/5 ">
                      <p className="text-center text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-[0.3em] mb-8">{billedByUs ? 'Billed directly by OpenHousePal' : 'Pay securely with PayPal'}</p>
                      
                      <div className="rounded-xl overflow-hidden shadow-sm">
                        {billedByUs ? (
                          <div className="text-center">
                            <p className="mb-6 text-sm font-medium leading-relaxed text-[#6B7280] dark:text-gray-400">
                              Your code switches your account on right away. There&apos;s nothing to pay here - we&apos;ll send your invoices directly.
                            </p>
                            <button
                              type="button"
                              onClick={activateWithCode}
                              disabled={isActivating}
                              className="w-full rounded-2xl bg-[#111827] py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#C9A24D] disabled:opacity-60 dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] dark:hover:text-white"
                            >
                              {isActivating ? 'Switching on...' : 'Switch on my account'}
                            </button>
                          </div>
                        ) : !selectedPlan?.id || selectedPlan.id.startsWith('P-DEFAULT') ? (
                          // The plan's PayPal ID isn't configured on this server - say so plainly
                          // instead of letting PayPal fail with a vague error.
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center text-sm font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                            The {selectedPlan?.name} plan isn&apos;t available to sign up for just yet. Please pick another plan or email support.
                          </div>
                        ) : (
                        <PayPalScriptProvider options={paypalOptions}>
                          <PayPalSubscriptionButton 
                            planId={selectedPlan?.id || ''}
                            isCheckoutOnly={true}
                            bundleCode={appliedCode?.code}
                            onSuccess={async () => {
                              await refreshUser()
                              router.push('/dash')
                            }}
                            onError={(err) => setNotification({ type: 'error', message: err })}
                          />
                        </PayPalScriptProvider>
                        )}
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
