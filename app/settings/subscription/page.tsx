'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Footer from '@/components/Footer'
import ConfirmationModal from '@/components/ConfirmationModal'
import ResubscribeModal from '@/components/ResubscribeModal'
import { User, apiRequest } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Sparkles, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react'
import { TRIAL_PERIOD_DAYS, PRICING_PLANS  } from '@/lib/pricing'

function SubscriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { user: authUser, isLoading: authLoading, refreshUser } = useAuth()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  console.log(user);

  // Modal states
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false)
  const [resubscribeModalOpen, setResubscribeModalOpen] = useState(false)
  const [startFreshModalOpen, setStartFreshModalOpen] = useState(false)

  // Sync local user with auth context
  useEffect(() => {
    if (!authLoading) {
      if (!authUser) {
        router.push('/login')
      } else {
        setUser(authUser)
        setIsLoading(false)
      }
    }
  }, [authUser, authLoading, router])

  // Handle subscription completion after PayPal redirect
  useEffect(() => {
    const completeSubscription = async () => {
      const subscriptionId = searchParams.get('subscription_id')

      // If we have a subscription_id, complete the subscription
      if (subscriptionId) {
        console.log('📝 Completing new subscription:', subscriptionId)

        try {
          const response = await apiRequest('/subscriptions/complete-new', {
            method: 'POST',
            body: JSON.stringify({ subscription_id: subscriptionId })
          })

          if (response.status === 200) {
            showToast(response.data?.message || 'Subscription activated successfully!', 'success')

            // Reload user data to show new subscription
            await refreshUser()

            // Clean up URL (remove query params)
            router.replace(pathname)
          } else {
            showToast(response.error || 'Failed to complete subscription. Please contact support.', 'error')
          }
        } catch (error) {
          console.error('Error completing subscription:', error)
          showToast('Failed to complete subscription. Please contact support.', 'error')
        }
      }
    }

    completeSubscription()
  }, [searchParams, pathname, router, refreshUser, showToast])

  // Real API calls to backend
  const handleUpgrade = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/upgrade', { method: 'POST' })

      if (response.status !== 200) {
        showToast(response.error || 'Failed to start upgrade. Please try again.', 'error')
        setActionLoading(false)
        setUpgradeModalOpen(false)
        return
      }

      // Check if change was immediate or requires approval
      if (response.data?.immediate) {
        // Plan changed immediately - refresh to show new plan
        showToast(response.data?.message || 'Plan upgraded successfully!', 'success')
        setActionLoading(false)
        setUpgradeModalOpen(false)
        await refreshUser()
        router.refresh()
      } else if (response.data?.approval_url) {
        // Redirect user to PayPal approval URL
        window.location.href = response.data.approval_url
      } else {
        showToast('Unexpected response from server. Please try again.', 'error')
        setActionLoading(false)
        setUpgradeModalOpen(false)
      }

    } catch (error) {
      console.error('Upgrade error:', error)
      showToast('Failed to process upgrade. Please try again.', 'error')
      setActionLoading(false)
      setUpgradeModalOpen(false)
    }
  }

  const handleDowngrade = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/downgrade', { method: 'POST' })

      if (response.status !== 200) {
        showToast(response.error || 'Failed to start downgrade. Please try again.', 'error')
        setActionLoading(false)
        setDowngradeModalOpen(false)
        return
      }

      // Check if change was immediate or requires approval
      if (response.data?.immediate) {
        // Plan changed immediately - refresh to show new plan
        showToast(response.data?.message || 'Plan downgraded successfully!', 'success')
        setActionLoading(false)
        setDowngradeModalOpen(false)
        await refreshUser()
        router.refresh()
      } else if (response.data?.approval_url) {
        // Redirect user to PayPal approval URL
        window.location.href = response.data.approval_url
      } else {
        showToast('Unexpected response from server. Please try again.', 'error')
        setActionLoading(false)
        setDowngradeModalOpen(false)
      }

    } catch (error) {
      console.error('Downgrade error:', error)
      showToast('Failed to process downgrade. Please try again.', 'error')
      setActionLoading(false)
      setDowngradeModalOpen(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/cancel', { method: 'POST' })

      if (response.status !== 200) {
        showToast(response.error || 'Failed to cancel subscription. Please try again.', 'error')
        setActionLoading(false)
        setCancelModalOpen(false)
        return
      }

      // Refresh global state to reflect cancellation
      await refreshUser()

      showToast(response.data?.message || 'Subscription cancelled. You will keep access until your billing period ends.', 'success')
      setActionLoading(false)
      setCancelModalOpen(false)

    } catch (error) {
      console.error('Cancel error:', error)
      showToast('Failed to cancel subscription. Please try again.', 'error')
      setActionLoading(false)
      setCancelModalOpen(false)
    }
  }

  const handleReactivate = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/reactivate', { method: 'POST' })

      if (response.status !== 200) {
        showToast(response.error || 'Failed to reactivate subscription. Please try again.', 'error')
        setActionLoading(false)
        setReactivateModalOpen(false)
        return
      }

      // Refresh global state
      await refreshUser()

      showToast(response.data?.message || 'Subscription reactivated successfully!', 'success')
      setActionLoading(false)
      setReactivateModalOpen(false)

    } catch (error) {
      console.error('Reactivate error:', error)
      showToast('Failed to reactivate subscription. Please try again.', 'error')
      setActionLoading(false)
      setReactivateModalOpen(false)
    }
  }

  const handleStartFreshConfirm = async () => {
    setActionLoading(true)
    try {
      // Step 1: Cancel the existing suspended subscription
      const response = await apiRequest('/subscriptions/cancel', { method: 'POST' })
      
      if (response.status !== 200) {
        showToast(response.error || 'Failed to cancel existing agreement. Please try again.', 'error')
        setActionLoading(false)
        setStartFreshModalOpen(false)
        return
      }

      // Step 2: Update local state to CANCELLED
      if (user) {
        const updatedUser = { ...user, subscription_status: 'CANCELLED' }
        setUser(updatedUser)
        // refreshUser() // Optional: could wait until full completion
      }

      // Step 3: Transition to resubscribe modal
      setStartFreshModalOpen(false)
      setActionLoading(false)
      setTimeout(() => {
        setResubscribeModalOpen(true)
      }, 300)

    } catch (error) {
      console.error('Start fresh error:', error)
      showToast('Something went wrong. Please try again.', 'error')
      setActionLoading(false)
      setStartFreshModalOpen(false)
    }
  }

  const handleResubscribe = async (planTier: 'BASIC' | 'PREMIUM') => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/create-new', {
        method: 'POST',
        body: JSON.stringify({ plan_tier: planTier })
      })

      if (response.status !== 200) {
        showToast(response.error || 'Failed to create new subscription. Please try again.', 'error')
        setActionLoading(false)
        setResubscribeModalOpen(false)
        return
      }

      // Redirect to PayPal approval URL
      if (response.data?.approval_url) {
        showToast('Redirecting to PayPal to complete your subscription...', 'success')
        setTimeout(() => {
          window.location.href = response.data.approval_url
        }, 1000)
      } else {
        showToast('Failed to get PayPal approval URL. Please try again.', 'error')
        setActionLoading(false)
        setResubscribeModalOpen(false)
      }

    } catch (error) {
      console.error('Resubscribe error:', error)
      showToast('Failed to create new subscription. Please try again.', 'error')
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
      <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${config.color}`}>
        <Icon className="w-3.5 h-3.5 mr-2" />
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

    // Check trial grace period first
    if (user?.trial_ends_at) {
      endDate = new Date(user.trial_ends_at)
    }
    // Then check paid grace period
    else if (user?.next_billing_date) {
      endDate = new Date(user.next_billing_date)
    }

    if (!endDate) return null

    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays
  }

  const daysRemaining = getDaysRemaining()

  // Determine plan name
  const getPlanName = () => {
    if (hasFreeSub) {
      return user?.plan_tier === 'PREMIUM' ? 'Premium (Managed)' : 'Basic (Managed)'
    }
    if (user?.subscription_status === 'PENDING_PAYMENT') return 'No Plan Active'
    if (user?.plan_tier === 'PREMIUM') return 'Premium Plan'
    if (user?.plan_tier === 'BASIC') return 'Basic Plan'
    return 'Unknown Plan'
  }

  // Determine plan price
  const getPlanPrice = () => {
    if (hasFreeSub) return 'Brokerage Paid'
    if (user?.subscription_status === 'PENDING_PAYMENT') return '$0.00'
    if (user?.plan_tier === 'PREMIUM') return PRICING_PLANS.PREMIUM.priceString
    if (user?.plan_tier === 'BASIC') return PRICING_PLANS.BASIC.priceString
    return 'N/A'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] dark:border-white mx-auto mb-4"></div>
          <p className="text-[#6B7280] dark:text-gray-400 font-medium animate-pulse">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  const isPremium = user?.plan_tier === 'PREMIUM'
  const isBasic = user?.plan_tier === 'BASIC'
  const isCancelled = user?.subscription_status === 'CANCELLED'
  const isExpired = user?.subscription_status === 'EXPIRED'
  const isSuspended = user?.subscription_status === 'SUSPENDED'
  const isTrial = user?.subscription_status === 'TRIAL'
  const isActive = user?.subscription_status === 'ACTIVE'
  const isAuthorized = user?.broker_authorized || user?.is_admin
  const isPendingPayment = user?.subscription_status === 'PENDING_PAYMENT' && isAuthorized

  const SecurityBillingSection = !hasFreeSub && isAuthorized && user?.subscription_status !== 'PENDING_PAYMENT' ? (
    <div className="bg-white dark:bg-[#151517] rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 sm:p-10 border border-gray-100 dark:border-gray-800 transition-colors">
      <h2 className="text-xl font-black text-[#0B0B0B] dark:text-white tracking-tight mb-8 pb-4 border-b border-gray-50 dark:border-gray-800">Security & Billing</h2>

      {(isActive || isTrial) && !isCancelled && !isSuspended && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h4 className="font-bold text-[#111827] dark:text-white mb-2">Need to pause?</h4>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm leading-relaxed">
                If you cancel, your data stays safe and secure. You'll keep full access to all features until the end of your current billing term.
            </p>
          </div>
          <button
            onClick={() => setCancelModalOpen(true)}
            className="px-6 py-4 border border-red-100 dark:border-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-900/50 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 whitespace-nowrap"
          >
            Cancel Plan
          </button>
        </div>
      )}

      {isSuspended && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h4 className="font-bold text-[#111827] dark:text-white mb-2">Restore Access</h4>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm leading-relaxed">
              Reactivate your subscription to immediately restore access to your showcases and visitor data.
            </p>
          </div>
          <button
            onClick={() => setReactivateModalOpen(true)}
            className="px-8 py-5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-[#C9A24D]/30 hover:-translate-y-1 transition-all duration-300"
          >
            Reactivate
          </button>
        </div>
      )}

      {(isCancelled || isExpired || isSuspended) && (
        <div className={`${isSuspended ? 'mt-12 pt-8 border-t border-gray-50 dark:border-gray-800' : ''} flex flex-col sm:flex-row sm:items-center justify-between gap-8`}>
          <div className="max-w-xl">
            <h4 className="font-bold text-[#111827] dark:text-white mb-2">{isSuspended ? 'Use Different Card' : 'Come back anytime'}</h4>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm leading-relaxed">
              {isSuspended 
                ? 'To start fresh with a different card, we must first cancel your current failed agreement.'
                : 'Regain full access to the platform by starting a new subscription today. Your previous data is waiting for you.'}
            </p>
          </div>
          <button
            onClick={() => isSuspended ? setStartFreshModalOpen(true) : setResubscribeModalOpen(true)}
            className="px-8 py-5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-[#C9A24D]/30 hover:-translate-y-1 transition-all duration-300"
          >
            {isSuspended ? 'Start Fresh' : 'Resubscribe'}
          </button>
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B] relative overflow-hidden transition-colors duration-300">
      {/* Sophisticated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-[#111827]/5 dark:bg-[#C9A24D]/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-light.png')] opacity-[0.03] dark:opacity-[0.01] mix-blend-overlay"></div>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-12 sm:py-20 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-12 text-center sm:text-left">
            <h1 className="text-4xl sm:text-5xl font-black text-[#0B0B0B] dark:text-white tracking-tight mb-4">Subscription</h1>
            <p className="text-[#6B7280] dark:text-gray-400 font-light text-xl max-w-2xl">
              Manage your OpenHousePal plan, billing details, and subscription preferences.
            </p>
          </div>

          {/* Alert for pending payment (Account authorized but no plan) */}
          {isPendingPayment && (
            <div className="mb-12 bg-white/90 dark:bg-[#151517]/90 border-2 border-[#C9A24D]/30 rounded-[2.5rem] p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-8 shadow-2xl shadow-[#C9A24D]/5 transition-all">
              <div className="w-20 h-20 bg-[#C9A24D]/10 rounded-[2rem] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-10 h-10 text-[#C9A24D]" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-black text-[#111827] dark:text-white mb-2 uppercase tracking-widest text-xs">Account Authorized</h3>
                <p className="text-lg text-[#6B7280] dark:text-gray-400 leading-relaxed font-medium mb-0">
                  Your brokerage credentials have been verified! {hasFreeSub ? 'Your account has been upgraded to a managed plan by your brokerage.' : `Choose a plan below to activate your ${TRIAL_PERIOD_DAYS}-day free trial and get started.`}
                </p>
              </div>
              {!hasFreeSub && (
                <button
                  onClick={() => router.push('/checkout')}
                  className="w-full sm:w-auto px-10 py-5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-[#C9A24D]/30 transition-all hover:-translate-y-1 active:scale-95"
                >
                  Choose Plan
                </button>
              )}
            </div>
          )}

          {/* Alert for suspended/expired subscriptions */}
          {(isSuspended || isExpired || (isCancelled && daysRemaining !== null && daysRemaining < 0)) && (
            <div className="mb-8 bg-white/90 dark:bg-[#151517]/90 border border-red-100 dark:border-red-900/30 rounded-3xl p-8 flex items-start shadow-xl shadow-red-500/5 transition-colors">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mr-6 flex-shrink-0 shadow-inner">
                <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-black text-red-900 dark:text-red-400 mb-2 uppercase tracking-widest text-xs">
                  {isSuspended ? 'Action Required: Payment Failed' : 'Subscription Expired'}
                </h3>
                <p className="text-base text-red-700/80 dark:text-red-300/80 leading-relaxed font-medium">
                  {isSuspended
                    ? 'Your last payment could not be processed. Please update your payment method on PayPal to restore full access.'
                    : (isCancelled && daysRemaining !== null && daysRemaining < 0) 
                      ? 'Your access period has ended. Please resubscribe to continue using our premium tools.'
                      : 'Your current subscription term has ended. Please reactivate your plan to continue using our premium tools.'}
                </p>
              </div>
            </div>
          )}

          {/* Alert for cancelled subscription */}
          {isCancelled && daysRemaining !== null && daysRemaining >= 0 && (
            <div className="mb-8 bg-white/90 dark:bg-[#151517]/90 border border-amber-100 dark:border-amber-900/30 rounded-3xl p-8 flex items-start shadow-xl shadow-amber-500/5 transition-colors">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mr-6 flex-shrink-0 shadow-inner">
                <AlertCircle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-amber-900 dark:text-amber-400 mb-2 uppercase tracking-widest text-xs">Subscription Ending Soon</h3>
                <p className="text-base text-amber-800/80 dark:text-amber-300/80 leading-relaxed font-medium mb-6">
                  Your subscription has been cancelled. You will maintain access to all features until your current period expires.
                </p>
                {daysRemaining > 0 && (
                  <div className="inline-flex items-center px-5 py-2.5 bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                    <Calendar className="w-4 h-4 text-amber-700 dark:text-amber-400 mr-3" />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-400 uppercase tracking-widest">
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                    </span>
                  </div>
                )}
                {daysRemaining === 0 && (
                  <div className="inline-flex items-center px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400 mr-3" />
                    <span className="text-xs font-bold text-red-900 dark:text-red-400 uppercase tracking-widest">
                      Access expires today
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-8">
            {/* Show Security & Billing at TOP if they are cancelled/expired/suspended (Urgent actions) */}
            {(isCancelled || isExpired || isSuspended) && SecurityBillingSection}

            {/* 1. Current Subscription Card */}
            <div className="bg-white dark:bg-[#151517] rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 sm:p-10 border border-gray-100 dark:border-gray-800 relative overflow-hidden transition-colors">
              {/* Decorative top border */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827]"></div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 pb-8 border-b border-gray-100 dark:border-gray-800 gap-4">
                <div>
                  <h2 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight mb-1">Current Plan</h2>
                  <p className="text-sm font-medium text-gray-400">Your active subscription tier</p>
                </div>
                {user?.subscription_status && <StatusBadge status={user.subscription_status} />}
              </div>

              <div className="grid md:grid-cols-2 gap-12">
                <div>
                  <div className="bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-3xl p-8 border border-gray-100 dark:border-gray-800 relative">
                    <p className="text-[10px] font-black text-[#6B7280] dark:text-gray-500 uppercase tracking-widest mb-3">Selected Tier</p>
                    <p className="text-3xl font-black text-[#0B0B0B] dark:text-white tracking-tight mb-6">{getPlanName()}</p>
                    <div className="flex items-baseline bg-white dark:bg-[#151517] px-6 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 w-fit shadow-sm">
                      <span className="text-3xl font-black text-[#C9A24D] tracking-tighter">{getPlanPrice()}</span>
                      {!hasFreeSub && <span className="ml-2 text-xs font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-wider">/month</span>}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 py-2">
                  {hasFreeSub ? (
                    <div className="h-full flex flex-col justify-center">
                      <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/20 rounded-2xl">
                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-2">Billing Information</p>
                        <p className="text-sm text-indigo-900/70 dark:text-indigo-300/70 leading-relaxed font-medium">
                          Your subscription is managed and paid for by your team lead or brokerage. You have full access to all features included in the {user?.plan_tier === 'PREMIUM' ? 'Premium' : 'Basic'} tier.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {isTrial && user?.trial_ends_at && (
                        <div className="flex justify-between items-center group">
                          <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Trial Ends</p>
                          <p className="text-base font-black text-[#0B0B0B] dark:text-white">{formatDate(user.trial_ends_at)}</p>
                        </div>
                      )}

                      {user?.subscription_started_at && (
                        <div className="flex justify-between items-center group">
                          <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Active Since</p>
                          <p className="text-base font-black text-[#0B0B0B] dark:text-white">{formatDate(user.subscription_started_at)}</p>
                        </div>
                      )}

                      {user?.last_billing_date && (
                        <div className="flex justify-between items-center group">
                          <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Last Billing</p>
                          <p className="text-base font-black text-[#0B0B0B] dark:text-white">{formatDate(user.last_billing_date)}</p>
                        </div>
                      )}

                      {(isTrial || isActive) && (user?.next_billing_date || user?.trial_ends_at) && (
                        <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-800 mt-2">
                          <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">
                            {isTrial ? 'First Payment' : 'Next Renewal'}
                          </p>
                          <p className="text-base font-black text-[#C9A24D]">
                            {formatDate(isTrial ? user.trial_ends_at : user.next_billing_date)}
                          </p>
                        </div>
                      )}

                      {isCancelled && (user?.next_billing_date || user?.trial_ends_at) && (
                        <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-800 mt-2">
                          <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest">Access Ends</p>
                          <p className="text-base font-black text-amber-600 dark:text-amber-400">
                            {formatDate(user.next_billing_date || user.trial_ends_at)}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Feature list - Only shown if authorized */}
              {isAuthorized && (
                <div className="mt-10 pt-10 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-6">Features Included in {getPlanName()}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      'Unlimited Open House QR codes',
                      'Dynamic visitor sign-in forms',
                      'Advanced lead management dashboard',
                      ...(isPremium ? ['Personalized Property Showcases', 'Automated buyer matching engine', 'Priority support'] : [])
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center text-sm text-gray-700 dark:text-gray-300 font-bold group">
                        <div className="w-6 h-6 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center mr-3 flex-shrink-0 group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors">
                          <CheckCircle2 size={14} strokeWidth={3} />
                        </div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Change Plan Card - Only shown if they have an active or trial subscription and NOT managed */}
            {!hasFreeSub && (isActive || isTrial) && !isCancelled && (
              <div className="bg-white dark:bg-[#151517] rounded-[2rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 sm:p-10 border border-gray-100 dark:border-gray-800 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                 <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-2xl flex items-center justify-center mr-5 border border-gray-100 dark:border-gray-800 shadow-sm group-hover:scale-105 transition-transform">
                    <Sparkles className="w-6 h-6 text-[#C9A24D]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Plan Options</h2>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Upgrade or Modify</p>
                  </div>
                </div>

                <p className="text-[#6B7280] dark:text-gray-400 mb-8 leading-relaxed font-medium text-lg">
                  {isBasic
                    ? 'Ready to automate your closings? Upgrade to Premium for instant Property Showcases and intelligent buyer matching.'
                    : 'You are currently on our most powerful plan, enjoying full access to all conversion tools and automated workflows.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  {isBasic && (
                    <button
                      onClick={() => setUpgradeModalOpen(true)}
                      className="flex-1 flex items-center justify-center px-8 py-5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-[#C9A24D]/30 hover:-translate-y-1 transition-all duration-300 group"
                    >
                      <Sparkles className="w-5 h-5 mr-3 group-hover:animate-pulse" />
                      Upgrade to Premium
                    </button>
                  )}

                  {isPremium && (
                    <button
                      onClick={() => setDowngradeModalOpen(true)}
                      className="flex-1 flex items-center justify-center px-8 py-5 bg-white dark:bg-[#0B0B0B] border-2 border-gray-100 dark:border-gray-800 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:border-[#111827] dark:hover:border-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 hover:-translate-y-1"
                    >
                      Switch to Basic
                    </button>
                  )}
                </div>

                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-6 text-center sm:text-left">
                  * All changes take effect at the start of your next billing cycle.
                </p>
              </div>
            )}

            {/* Show Security & Billing at BOTTOM for normal active/trial users */}
            {!(isCancelled || isExpired || isSuspended) && SecurityBillingSection}
          </div>
        </div>
      </main>

      {/* Confirmation Modals - These use a consistent theme via components */}
      <ConfirmationModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        onConfirm={handleUpgrade}
        title="Upgrade to Premium?"
        message={
          isTrial
            ? "Your plan will be upgraded immediately during your trial. The new price will apply when your trial ends."
            : "The upgrade will take effect at the start of your next billing cycle. You'll be redirected to PayPal to authorize the change."
        }
        confirmText={isTrial ? "Upgrade Now" : "Confirm Upgrade"}
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={downgradeModalOpen}
        onClose={() => setDowngradeModalOpen(false)}
        onConfirm={handleDowngrade}
        title="Downgrade to Basic?"
        message="You will lose access to automated Showcases and matching tools at the end of your current term."
        confirmText="Confirm Downgrade"
        confirmButtonClass="bg-[#111827] hover:bg-gray-800 text-white"
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Subscription?"
        message="Your data will remain secure, but premium features will be disabled once your current access period ends."
        confirmText="Yes, Cancel Plan"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
        isLoading={actionLoading}
      />

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

      {/* Resubscribe Modal */}
      <ResubscribeModal
        isOpen={resubscribeModalOpen}
        onClose={() => setResubscribeModalOpen(false)}
        onSelectPlan={handleResubscribe}
        isLoading={actionLoading}
      />

      <Footer />
    </div>
  )
}

export default function SubscriptionManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111827] mx-auto mb-4"></div>
          <p className="text-[#6B7280] font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  )
}
