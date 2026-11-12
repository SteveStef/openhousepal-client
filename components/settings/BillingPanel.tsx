'use client'

import OhpLoader from '@/components/brand/OhpLoader'

// The actual billing/subscription UI and logic - shared by the standalone /settings/subscription
// page (still the page PayPal itself redirects back to after checkout/plan-change/etc, so it must
// keep working exactly as before) and the "Billing" tab inside /settings (`embedded`), so an agent
// can manage their plan without leaving Settings for the common case. Same component either way -
// only the outer page chrome (background decoration, hero heading, Footer) differs.
//
// Restyled 2026-09-24 to match the rest of Settings' card language (rounded-2xl, gray-200 borders,
// font-serif headings) instead of its own oversized "landing page" styling, and to cut down how
// long the panel reads by default - the full marketing plan-details card is now tucked behind a
// "View full plan details" toggle instead of always rendered open. No handler, condition, or piece
// of copy was removed - only spacing, sizing, and grouping changed.

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Footer from '@/components/Footer'
import ConfirmationModal from '@/components/ConfirmationModal'
import ResubscribeModal from '@/components/ResubscribeModal'
import IdxSetupFee, { owesIdxSetupFee } from '@/components/settings/IdxSetupFee'
import { IdxDomainNotice } from '@/components/IdxDomainNotice'
import api from '@/lib/api-service'
import { User } from '@/types'
import type { OfferPlanView } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Sparkles, AlertCircle, Calendar, CheckCircle2, ChevronDown, ExternalLink } from 'lucide-react'
import { TRIAL_PERIOD_DAYS, PRICING_PLANS, type PlanTierId } from '@/lib/pricing'
import { PricingTierCard } from '@/components/pricing/PricingCards'
import PlanChangeImpact from '@/components/settings/PlanChangeImpact'
import { CardPayModal, type SubscriptionStart } from '@/components/CardPayButtons'

export default function BillingPanel({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { user: authUser, isLoading: authLoading, refreshUser } = useAuth()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [actionLoading, setActionLoading] = useState(false)

  // Modal states
  const [changePlanTarget, setChangePlanTarget] = useState<PlanTierId | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false)
  const [resubscribeModalOpen, setResubscribeModalOpen] = useState(false)
  const [startFreshModalOpen, setStartFreshModalOpen] = useState(false)
  // Coming back on IDX when the one-time setup fee still applies - a step to show it (and take a code) first.
  const [idxResubOpen, setIdxResubOpen] = useState(false)
  const [idxCode, setIdxCode] = useState<string | null>(null)
  // The card checkout pop-up for a restart / plan change (CardPayButtons).
  const [pay, setPay] = useState<{ kind: 'change' | 'restart'; tier: PlanTierId; start: SubscriptionStart; offer?: { price: number; full: number } } | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [payErr, setPayErr] = useState('')
  const finishPay = async (subscriptionId: string) => {
    if (!pay) return
    setPayBusy(true); setPayErr('')
    const { success, data, error } = await api.paypal.completeNew(subscriptionId)
    setPayBusy(false)
    if (!success) {
      setPayErr(`${error || 'Your card went through, but we couldn’t switch your plan yet.'} Email support and mention ${subscriptionId} - you won’t be charged twice.`)
      return
    }
    setPay(null)
    showToast(data?.message || `You're now on ${PRICING_PLANS[pay.tier]?.name || 'your new plan'}.`, 'success')
    await refreshUser()
    router.refresh()
  }

  // Whether the full marketing plan-details card (the same one shown on Pricing/Upgrade) is
  // expanded - collapsed by default so this panel doesn't read as one long page. Nothing in it is
  // removed, just tucked behind a click.
  const [showFullPlan, setShowFullPlan] = useState(false)

  // Sync local user with auth context
  useEffect(() => {
    if (!authLoading) {
      if (!authUser) {
        if (!embedded) router.push('/login')
      } else {
        setUser(authUser)
        setIsLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, authLoading])

  // Back from PayPal. Two different returns: approving a brand-new subscription
  // (?resubscribed=true&subscription_id=...) and approving a plan change (?plan_changed=1, PayPal
  // also tacks on subscription_id). Only the first creates anything; a plan change is just
  // re-read from PayPal so the new plan shows straight away.
  const prevTier = authUser?.plan_tier
  useEffect(() => {
    const subscriptionId = searchParams.get('subscription_id')
    const planChanged = searchParams.get('plan_changed')
    const resubscribed = searchParams.get('resubscribed')
    if (!planChanged && !resubscribed) return

    const finish = async () => {
      if (planChanged) {
        const { success, data } = await api.paypal.sync()
        await refreshUser()
        if (success && data?.plan_tier && data.plan_tier !== prevTier) {
          showToast(`You're now on ${PRICING_PLANS[data.plan_tier as PlanTierId]?.name || 'your new plan'}.`, 'success')
        } else {
          showToast('Plan change approved - PayPal can take a minute to confirm it. It will show here shortly.', 'success')
        }
      } else if (subscriptionId) {
        const { success, data, error } = await api.paypal.completeNew(subscriptionId)
        if (success) {
          showToast(data?.message || 'Subscription activated successfully!', 'success')
          await refreshUser()
        } else {
          showToast(error || 'Failed to complete subscription. Please contact support.', 'error')
          return
        }
      }
      router.replace(pathname)
    }

    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Real API calls to backend - generalized across all 4 tiers (was separate handleUpgrade/
  // handleDowngrade for Basic<->Premium only).
  const handleChangePlan = async () => {
    if (!changePlanTarget) return
    setActionLoading(true)

    const { success, data, error } = await api.paypal.changePlan(changePlanTarget, changePlanTarget === 'IDX' ? idxCode : null)

    if (!success) {
      showToast(error || 'Failed to change your plan. Please try again.', 'error')
      setActionLoading(false)
      setChangePlanTarget(null)
      return
    }

    if (data?.checkout?.plan_id) {
      // Card checkout - a new subscription replaces the current one (CardPayButtons).
      setPay({ kind: 'change', tier: changePlanTarget, start: { plan_id: data.checkout.plan_id, start_time: data.checkout.start_time } })
      setActionLoading(false)
      setChangePlanTarget(null)
    } else if (data?.immediate) {
      showToast(data?.message || 'Plan changed successfully!', 'success')
      setActionLoading(false)
      setChangePlanTarget(null)
      await refreshUser()
      router.refresh()
    } else if (data?.approval_url) {
      window.location.href = data.approval_url
    } else {
      showToast('Unexpected response from server. Please try again.', 'error')
      setActionLoading(false)
      setChangePlanTarget(null)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)

    const { success, data, error } = await api.paypal.cancel()

    if (success) {
      // Refresh global state to reflect cancellation
      await refreshUser()

      showToast(data?.message || 'Subscription cancelled. You will keep access until your billing period ends.', 'success')
      setActionLoading(false)
      setCancelModalOpen(false)
    } else {
      showToast(error || 'Failed to cancel subscription. Please try again.', 'error')
      setActionLoading(false)
      setCancelModalOpen(false)
    }
  }

  const handleReactivate = async () => {
    setActionLoading(true)

    const { success, error } = await api.paypal.reactivate()

    if (success) {
      // Refresh global state
      await refreshUser()

      showToast('Subscription reactivated successfully!', 'success')
      setActionLoading(false)
      setReactivateModalOpen(false)
    } else {
      showToast(error || 'Failed to reactivate subscription. Please try again.', 'error')
      setActionLoading(false)
      setReactivateModalOpen(false)
    }
  }

  const handleStartFreshConfirm = async () => {
    setActionLoading(true)

    // Step 1: Cancel the existing suspended subscription
    const { success, error } = await api.paypal.cancel()

    if (!success) {
      showToast(error || 'Failed to cancel existing agreement. Please try again.', 'error')
      setActionLoading(false)
      setStartFreshModalOpen(false)
      return
    }

    // Step 2: Update local state to CANCELLED
    if (user) {
      const updatedUser = { ...user, subscription_status: 'CANCELLED' }
      setUser(updatedUser)
    }

    // Step 3: Transition to resubscribe modal
    setStartFreshModalOpen(false)
    setActionLoading(false)
    setTimeout(() => {
      setResubscribeModalOpen(true)
    }, 300)
  }

  const handleResubscribe = async (planTier: PlanTierId, confirmedFee = false) => {
    if (planTier === 'IDX' && !confirmedFee && owesIdxSetupFee(user)) {
      setResubscribeModalOpen(false); setIdxCode(null); setIdxResubOpen(true)
      return
    }
    setActionLoading(true)

    const { success, data, error } = await api.paypal.createNew(planTier, planTier === 'IDX' ? idxCode : null)

    if (!success) {
      showToast(error || 'Failed to create new subscription. Please try again.', 'error')
      setActionLoading(false)
      setResubscribeModalOpen(false)
      return
    }

    if (data?.plan_id) {
      setPay({ kind: 'restart', tier: planTier, start: { plan_id: data.plan_id },
        offer: data.offer_price ? { price: Number(data.offer_price), full: Number(data.full_price) } : undefined })
      setActionLoading(false)
      setResubscribeModalOpen(false)
      return
    }
    // Redirect to PayPal approval URL
    if (data?.approval_url) {
      showToast('Redirecting to PayPal to complete your subscription...', 'success')
      setTimeout(() => {
        window.location.href = data.approval_url
      }, 1000)
    } else {
      showToast('Failed to get PayPal approval URL. Please try again.', 'error')
      setActionLoading(false)
      setResubscribeModalOpen(false)
    }
  }

  // Helper to determine if subscription is managed by brokerage/team
  const isManagedSubscription = (user: User | null) => {
    if (!user) return false
    return !user.subscription_id && !user.plan_id && !!user.plan_tier
  }

  const hasFreeSub = isManagedSubscription(user)

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = () => {
      // Prioritize managed status
      if (hasFreeSub) {
        return { color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30', icon: CheckCircle2, text: 'Managed Subscription' }
      }

      // Prioritize unauthorized status
      if (!user?.broker_authorized && !user?.is_admin) {
        return { color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700', icon: AlertCircle, text: 'Pending Verification' }
      }

      switch (status) {
        case 'PENDING_PAYMENT':
          return { color: 'bg-[#C9A24D]/10 text-[#C9A24D] border-[#C9A24D]/20', icon: Sparkles, text: 'Awaiting Plan Selection' }
        case 'TRIAL':
          return { color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/30', icon: Sparkles, text: 'Free Trial' }
        case 'ACTIVE':
          return { color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30', icon: CheckCircle2, text: 'Active' }
        case 'CANCELLED':
          return { color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30', icon: AlertCircle, text: 'Cancelled' }
        case 'SUSPENDED':
          return { color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30', icon: AlertCircle, text: 'Payment Failed' }
        case 'EXPIRED':
          return { color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700', icon: AlertCircle, text: 'Expired' }
        default:
          return { color: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-100 dark:border-gray-700', icon: AlertCircle, text: status }
      }
    }

    const config = getStatusConfig()
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest border ${config.color}`}>
        <Icon className="w-3.5 h-3.5 mr-1.5" />
        {config.text}
      </span>
    )
  }

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Calculate days remaining until grace period ends
  const getDaysRemaining = () => {
    if (user?.subscription_status !== 'CANCELLED') return null

    const now = new Date()
    let endDate: Date | null = null

    const trialEnd = user?.trial_ends_at ? new Date(user.trial_ends_at) : null
    const billingEnd = user?.next_billing_date ? new Date(user.next_billing_date) : null

    // Pick the furthest date out of trial or billing end
    if (trialEnd && billingEnd) {
      endDate = trialEnd > billingEnd ? trialEnd : billingEnd
    } else {
      endDate = trialEnd || billingEnd
    }

    if (!endDate) return null

    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays
  }

  const daysRemaining = getDaysRemaining()

  const currentTierPlan = user?.plan_tier && user.plan_tier in PRICING_PLANS ? PRICING_PLANS[user.plan_tier as PlanTierId] : null
  const currentTierId = currentTierPlan ? (user!.plan_tier as PlanTierId) : null

  // Determine plan name
  const getPlanName = () => {
    if (hasFreeSub) return currentTierPlan ? `${currentTierPlan.name} (Managed)` : 'Managed Plan'
    if (user?.subscription_status === 'PENDING_PAYMENT') return 'No Plan Active'
    if (currentTierPlan) return `${currentTierPlan.name} Plan`
    return 'Unknown Plan'
  }

  // Signed up through a sign-up offer: their real price, not the regular one.
  const [offerPlan, setOfferPlan] = useState<OfferPlanView | null>(null)
  useEffect(() => {
    if (!user?.plan_id || !user?.subscription_id) { setOfferPlan(null); return }
    let live = true
    api.paypal.myOfferPlan().then(r => { if (live && r.success) setOfferPlan(r.data?.plan || null) })
    return () => { live = false }
  }, [user?.plan_id, user?.subscription_id])

  // Determine plan price
  const getPlanPrice = () => {
    if (hasFreeSub) return 'Brokerage Paid'
    if (user?.subscription_status === 'PENDING_PAYMENT') return '$0.00'
    if (offerPlan && offerPlan.tier === user?.plan_tier) return `$${offerPlan.offer_price.toFixed(2)}`
    if (currentTierPlan) return currentTierPlan.priceString
    return 'N/A'
  }

  if (isLoading) {
    return (
      <OhpLoader fullScreen={!embedded} />
    )
  }

  const isCancelled = user?.subscription_status === 'CANCELLED'
  const isExpired = user?.subscription_status === 'EXPIRED'
  const isSuspended = user?.subscription_status === 'SUSPENDED'
  const isTrial = user?.subscription_status === 'TRIAL'
  const isActive = user?.subscription_status === 'ACTIVE'
  const isAuthorized = user?.broker_authorized || user?.is_admin
  const isPendingPayment = user?.subscription_status === 'PENDING_PAYMENT' && isAuthorized

  // Shared card shell - matches the rest of Settings (SettingsAccordion's rounded-2xl / gray-200
  // border / shadow-sm) instead of Billing's old standalone rounded-[2rem] "landing page" cards.
  const cardCls = 'bg-white dark:bg-[#151517] rounded-2xl shadow-sm p-5 sm:p-6 border border-gray-200 dark:border-gray-800 transition-colors'

  const SecurityBillingSection = !hasFreeSub && isAuthorized && user?.subscription_status !== 'PENDING_PAYMENT' ? (
    <div className={cardCls}>
      <h2 className="font-serif text-lg font-black text-[#0B0B0B] dark:text-white mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">Manage Subscription</h2>

      {(isActive || isTrial) && !isCancelled && !isSuspended && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="max-w-xl">
            <h4 className="font-bold text-sm text-[#111827] dark:text-white mb-1">Need to pause?</h4>
            <p className="text-[#6B7280] dark:text-gray-400 text-xs leading-relaxed">
                If you cancel, you'll keep full access to all features until the end of your current billing term. After that, your data may be permanently deleted if you don't renew.
            </p>
          </div>
          <button
            onClick={() => setCancelModalOpen(true)}
            className="shrink-0 px-4 py-2.5 border border-red-200 dark:border-red-900/40 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-900/60 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all duration-200 whitespace-nowrap"
          >
            Cancel Plan
          </button>
        </div>
      )}

      {isSuspended && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="max-w-xl">
            <h4 className="font-bold text-sm text-[#111827] dark:text-white mb-1">Restore Access</h4>
            <p className="text-[#6B7280] dark:text-gray-400 text-xs leading-relaxed">
              Reactivate your subscription to immediately restore access to your showcases and visitor data.
            </p>
          </div>
          <button
            onClick={() => setReactivateModalOpen(true)}
            className="group shrink-0 px-5 py-3 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transition-all duration-200"
          >
            Reactivate
          </button>
        </div>
      )}

      {(isCancelled || isExpired || isSuspended) && (
        <div className={`${isSuspended ? 'mt-6 pt-6 border-t border-gray-100 dark:border-gray-800' : ''} flex flex-col sm:flex-row sm:items-center justify-between gap-5`}>
          <div className="max-w-xl">
            <h4 className="font-bold text-sm text-[#111827] dark:text-white mb-1">{isSuspended ? 'Use Different Card' : 'Come back anytime'}</h4>
            <p className="text-[#6B7280] dark:text-gray-400 text-xs leading-relaxed">
              {isSuspended
                ? 'To start fresh with a different card, we must first cancel your current failed agreement.'
                : "Regain full access to the platform by starting a new subscription today. Data from an ended subscription isn't guaranteed to be kept, so renew as soon as you can."}
            </p>
          </div>
          <button
            onClick={() => isSuspended ? setStartFreshModalOpen(true) : setResubscribeModalOpen(true)}
            className="shrink-0 px-5 py-3 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transition-all duration-200"
          >
            {isSuspended ? 'Start Fresh' : 'Resubscribe'}
          </button>
        </div>
      )}
    </div>
  ) : null

  const body = (
    <div className={embedded ? '' : 'max-w-3xl mx-auto'}>
      {!embedded && (
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-serif font-black text-[#0B0B0B] dark:text-white tracking-tight mb-2">Subscription</h1>
          <p className="text-[#6B7280] dark:text-gray-400 text-base max-w-2xl">
            Manage your OpenHousePal plan, billing details, and subscription preferences.
          </p>
        </div>
      )}

      {/* Alert for pending payment (Account authorized but no plan) */}
      {isPendingPayment && (
        <div className="mb-6 bg-white dark:bg-[#151517] border border-[#C9A24D]/30 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-5 shadow-sm">
          <div className="w-14 h-14 bg-[#C9A24D]/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-7 h-7 text-[#C9A24D]" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-black text-[#111827] dark:text-white mb-1 uppercase tracking-widest text-[11px]">Account Authorized</h3>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 leading-relaxed font-medium mb-0">
              Your brokerage credentials have been verified! {hasFreeSub ? 'Your account has been upgraded to a managed plan by your brokerage.' : `Choose a plan below to activate your ${TRIAL_PERIOD_DAYS}-day free trial and get started.`}
            </p>
          </div>
          {!hasFreeSub && (
            <button
              onClick={() => router.push('/checkout')}
              className="w-full sm:w-auto shrink-0 px-6 py-3 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transition-all"
            >
              Choose Plan
            </button>
          )}
        </div>
      )}

      {/* Alert for suspended/expired subscriptions */}
      {(isSuspended || isExpired || (isCancelled && daysRemaining !== null && daysRemaining < 0)) && (
        <div className="mb-5 bg-white dark:bg-[#151517] border border-red-200 dark:border-red-900/40 rounded-2xl p-5 flex items-start shadow-sm">
          <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-black text-red-900 dark:text-red-400 mb-1.5 uppercase tracking-widest text-[11px]">
              {isSuspended ? 'Action Required: Payment Failed' : 'Subscription Expired'}
            </h3>
            <p className="text-sm text-red-700/80 dark:text-red-300/80 leading-relaxed font-medium">
              {isSuspended
                ? 'Your last payment could not be processed. Update the card on your PayPal account to restore full access.'
                : (isCancelled && daysRemaining !== null && daysRemaining < 0)
                  ? 'Your access period has ended. Please resubscribe to continue using our premium tools.'
                  : 'Your current subscription term has ended. Please reactivate your plan to continue using our premium tools.'}
            </p>
            {isSuspended && (
              <a
                href="https://www.paypal.com/myaccount/autopay/"
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-700"
              >
                Update payment method on PayPal <ExternalLink className="ohp-icon-draw w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Alert for cancelled subscription */}
      {isCancelled && daysRemaining !== null && daysRemaining >= 0 && (
        <div className="mb-5 bg-white dark:bg-[#151517] border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 flex items-start shadow-sm">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-amber-900 dark:text-amber-400 mb-1.5 uppercase tracking-widest text-[11px]">Subscription Ending Soon</h3>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 leading-relaxed font-medium mb-3">
              Your subscription has been cancelled. You will maintain access to all features until your current period expires - after that, your data may be permanently deleted unless you renew.
            </p>
            {daysRemaining > 0 && (
              <div className="inline-flex items-center px-4 py-2 bg-amber-100/60 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 mr-2" />
                <span className="text-[11px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-widest">
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                </span>
              </div>
            )}
            {daysRemaining === 0 && (
              <div className="inline-flex items-center px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl">
                <AlertCircle className="w-3.5 h-3.5 text-red-700 dark:text-red-400 mr-2" />
                <span className="text-[11px] font-bold text-red-900 dark:text-red-400 uppercase tracking-widest">
                  Access expires today
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Show Manage Subscription at TOP if they are cancelled/expired/suspended (urgent actions) */}
        {(isCancelled || isExpired || isSuspended) && SecurityBillingSection}

        {/* 1. Current Plan - a compact summary row instead of a tall two-column hero card */}
        <div className={`${cardCls} relative overflow-hidden`}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827]" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-5 border-b border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-1">Current Plan</p>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-2xl font-serif font-black text-[#0B0B0B] dark:text-white tracking-tight">{getPlanName()}</p>
                <span className="text-sm font-black text-[#C9A24D]">{getPlanPrice()}{!hasFreeSub && <span className="ml-1 text-[10px] font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">/mo</span>}</span>
              </div>
            </div>
            {user?.subscription_status && <StatusBadge status={user.subscription_status} />}
          </div>
          {offerPlan && offerPlan.tier === user?.plan_tier && offerPlan.percent_off > 0 && (
            <p className="-mt-3 mb-5 rounded-xl bg-[#C9A24D]/10 px-3 py-2 text-xs font-bold text-[#8b7355] dark:text-[#e8c97a]">
              {isCancelled
                ? <>Your sign-up offer {offerPlan.discount_months ? 'months you have left are' : `price ($${offerPlan.offer_price.toFixed(2)}/mo) is`} still yours if you restart {user?.next_billing_date ? `by ${formatDate(user.next_billing_date)}` : 'before your paid time ends'}. After that it's gone for good.</>
                : <>Your sign-up offer: {offerPlan.percent_off}% off {offerPlan.discount_months ? `for your first ${offerPlan.discount_months === 1 ? 'month' : `${offerPlan.discount_months} months`}, then $${offerPlan.full_price.toFixed(2)}/mo` : 'every month'}.</>}
            </p>
          )}

          {hasFreeSub ? (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/20 rounded-xl">
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-1.5">Billing Information</p>
              <p className="text-xs text-indigo-900/70 dark:text-indigo-300/70 leading-relaxed font-medium">
                Your plan is billed directly - by OpenHousePal, or by your team lead or brokerage - so there&apos;s nothing to manage in PayPal. You have full access to everything in the {currentTierPlan?.name || 'your'} plan. Questions about your bill? Message support.
              </p>
            </div>
          ) : (
            <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {isTrial && user?.trial_ends_at && (
                <div className="flex justify-between items-center gap-3 sm:contents">
                  <dt className="text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">Trial Ends</dt>
                  <dd className="text-sm font-black text-[#0B0B0B] dark:text-white sm:text-right">{formatDate(user.trial_ends_at)}</dd>
                </div>
              )}
              {user?.subscription_started_at && (
                <div className="flex justify-between items-center gap-3 sm:contents">
                  <dt className="text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">Active Since</dt>
                  <dd className="text-sm font-black text-[#0B0B0B] dark:text-white sm:text-right">{formatDate(user.subscription_started_at)}</dd>
                </div>
              )}
              {user?.last_billing_date && (
                <div className="flex justify-between items-center gap-3 sm:contents">
                  <dt className="text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">Last Billing</dt>
                  <dd className="text-sm font-black text-[#0B0B0B] dark:text-white sm:text-right">{formatDate(user.last_billing_date)}</dd>
                </div>
              )}
              {(isTrial || isActive) && (user?.next_billing_date || user?.trial_ends_at) && (
                <div className="flex justify-between items-center gap-3 sm:contents">
                  <dt className="text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">{isTrial ? 'First Payment' : 'Next Renewal'}</dt>
                  <dd className="text-sm font-black text-[#C9A24D] sm:text-right">{formatDate(isTrial ? user.trial_ends_at : user.next_billing_date)}</dd>
                </div>
              )}
              {isCancelled && (user?.next_billing_date || user?.trial_ends_at) && (
                <div className="flex justify-between items-center gap-3 sm:contents">
                  <dt className="text-[11px] font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">Access Ends</dt>
                  <dd className="text-sm font-black text-amber-600 dark:text-amber-400 sm:text-right">{formatDate(user.next_billing_date || user.trial_ends_at)}</dd>
                </div>
              )}
            </dl>
          )}

          {/* Full marketing plan card (feature list) - the exact card homepage/checkout/upgrade
              show, so what an agent sees for their own plan never drifts from what was sold. Kept
              in full, just collapsed by default so the panel isn't a wall of content on load. */}
          {isAuthorized && user?.plan_tier && user.plan_tier in PRICING_PLANS && (
            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowFullPlan(v => !v)}
                className="group flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">View full plan details</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ${showFullPlan ? 'rotate-180' : ''}`} />
              </button>
              {showFullPlan && (
                <div className="mt-4 mx-auto max-w-sm">
                  <PricingTierCard tier={user.plan_tier as PlanTierId} current />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Change Plan Card - Only shown if they have an active or trial subscription and NOT managed */}
        {!hasFreeSub && (isActive || isTrial) && !isCancelled && (
          <div className={cardCls}>
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-xl flex items-center justify-center mr-3.5 border border-gray-100 dark:border-gray-800">
                <Sparkles className="w-5 h-5 text-[#C9A24D]" />
              </div>
              <div>
                <h2 className="font-serif text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">Plan Options</h2>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Upgrade or Modify</p>
              </div>
            </div>

            <p className="text-[#6B7280] dark:text-gray-400 mb-5 text-sm leading-relaxed">
              Switch to any plan below. You&apos;ll add your card, your new plan switches on right away, and your old plan stops so you never pay for both.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(PRICING_PLANS) as PlanTierId[])
                .filter(tier => tier !== user?.plan_tier)
                // Outside Bright MLS only the No-MLS plans apply.
                .filter(tier => !!user?.mls_id || tier === 'NO_MLS' || tier === 'PRO_NO_MLS')
                .map(tier => (
                  <button
                    key={tier}
                    onClick={() => setChangePlanTarget(tier)}
                    className="group flex items-center justify-between px-4 py-3.5 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-800 text-[#111827] dark:text-white hover:border-[#C9A24D] dark:hover:border-[#C9A24D] rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200"
                  >
                    <span className="flex items-center"><Sparkles className="ohp-icon-draw w-3.5 h-3.5 mr-1.5 text-[#C9A24D]" />Switch to {PRICING_PLANS[tier].name}</span>
                    <span className="text-[#C9A24D]">{PRICING_PLANS[tier].priceString}/mo</span>
                  </button>
                ))}
            </div>

            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-4 text-center sm:text-left">
              * New features switch on right away. The new price starts with your next bill.
            </p>
          </div>
        )}

        {/* Show Manage Subscription at BOTTOM for normal active/trial users */}
        {!(isCancelled || isExpired || isSuspended) && SecurityBillingSection}
      </div>
    </div>
  )

  return (
    <>
      {embedded ? (
        body
      ) : (
        <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300">
          <main className="flex-1 px-4 sm:px-6 py-10 sm:py-14">
            {body}
          </main>

          <Footer />
        </div>
      )}

      {/* Confirmation Modal - one generic modal driven by changePlanTarget, replacing the old
          Basic<->Premium-only upgrade/downgrade pair now that there are 4 tiers. */}
      <ConfirmationModal
        isOpen={changePlanTarget !== null}
        onClose={() => { setChangePlanTarget(null); setIdxCode(null) }}
        onConfirm={handleChangePlan}
        title={changePlanTarget ? `Switch to ${PRICING_PLANS[changePlanTarget].name}?` : ''}
        message={
          isTrial
            ? "Next you'll add your card. Your new plan switches on right away, you keep your free trial, and the new price only starts when your trial ends."
            : "Next you'll add your card. Your new plan switches on right away, and the new price starts with your next bill."
        }
        confirmText="Continue"
        isLoading={actionLoading}
      >
        {changePlanTarget === 'IDX' && owesIdxSetupFee(user) && <IdxSetupFee startsOn={user?.next_billing_date || user?.trial_ends_at} onCode={setIdxCode} />}
        {changePlanTarget === 'IDX' && <IdxDomainNotice defaultOpen />}
        {/* Concrete "what you and your clients lose" warning - renders nothing for a pure upgrade. */}
        {changePlanTarget && currentTierId && <PlanChangeImpact from={currentTierId} to={changePlanTarget} />}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Subscription?"
        message="You keep full access until your current paid period ends. After that, everything below stops - and your data may be permanently deleted if you don't renew."
        confirmText="Yes, Cancel Plan"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
        isLoading={actionLoading}
      >
        {cancelModalOpen && offerPlan && offerPlan.tier === user?.plan_tier && offerPlan.percent_off > 0 && (
          <div className="mb-3 rounded-xl border-2 border-[#C9A24D] bg-[#C9A24D]/10 p-4 text-left" data-testid="cancel-offer-warning">
            <p className="text-sm font-black text-[#111827] dark:text-white">You&apos;ll lose your sign-up offer for good</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-[#6B7280] dark:text-gray-300">
              You pay ${offerPlan.offer_price.toFixed(2)}/mo ({offerPlan.percent_off}% off). Change your mind {user?.next_billing_date ? `by ${formatDate(user.next_billing_date)}` : 'before your paid time ends'} and you can restart {offerPlan.discount_months ? 'and keep any discounted months you have left' : 'at this same price'}. After that, the offer is gone and plans are back to the regular ${offerPlan.full_price.toFixed(2)}/mo.
            </p>
          </div>
        )}
        {cancelModalOpen && currentTierId && <PlanChangeImpact from={currentTierId} to="CANCEL" />}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={reactivateModalOpen}
        onClose={() => setReactivateModalOpen(false)}
        onConfirm={handleReactivate}
        title="Reactivate Plan?"
        message="Great to have you back! Your billing will resume at the end of your current term."
        confirmText="Reactivate"
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={startFreshModalOpen}
        onClose={() => setStartFreshModalOpen(false)}
        onConfirm={handleStartFreshConfirm}
        title="Start Fresh?"
        message="This will cancel your current failed agreement and let you pick a new plan with a different card."
        confirmText="Cancel & Continue"
        confirmButtonClass="bg-[#111827] hover:bg-gray-800 text-white"
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={idxResubOpen}
        onClose={() => { setIdxResubOpen(false); setIdxCode(null) }}
        onConfirm={() => { setIdxResubOpen(false); handleResubscribe('IDX', true) }}
        title="Come back on IDX?"
        message="Next you'll add your card, and IDX switches on right away."
        confirmText="Continue"
        isLoading={actionLoading}
      >
        {idxResubOpen && <IdxSetupFee onCode={setIdxCode} />}
      </ConfirmationModal>

      <CardPayModal
        open={!!pay}
        start={pay?.start || null}
        title={pay ? (pay.kind === 'change' ? `Switch to ${PRICING_PLANS[pay.tier]?.name}` : `Restart ${PRICING_PLANS[pay.tier]?.name}`) : ''}
        note={pay?.kind === 'change'
          ? (isTrial
            ? 'Add your card to switch. Your new plan switches on right away, you keep your free trial, and the new price starts when your trial ends. Your old plan stops, so you never pay for both.'
            : 'Add your card to switch. Your new plan switches on right away and the new price starts on your next bill date. Your old plan stops, so you never pay for both.')
          : pay?.offer
            ? `Add your card and your plan switches on right away - at your sign-up offer price of $${pay.offer.price.toFixed(2)}/mo.`
            : 'Add your card and your plan switches on right away.'}
        busy={payBusy}
        error={payErr}
        onApproved={finishPay}
        onClose={() => { if (!payBusy) { setPay(null); setPayErr('') } }}
      />

      {/* Resubscribe Modal */}
      <ResubscribeModal
        isOpen={resubscribeModalOpen}
        onClose={() => setResubscribeModalOpen(false)}
        onSelectPlan={handleResubscribe}
        isLoading={actionLoading}
        inBright={!!user?.mls_id}
      />
    </>
  )
}
