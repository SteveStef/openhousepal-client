'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ConfirmationModal from '@/components/ConfirmationModal'
import ResubscribeModal from '@/components/ResubscribeModal'
import { getCurrentUser, User, apiRequest } from '@/lib/auth'
import { CreditCard, Sparkles, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react'

export default function SubscriptionManagementPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modal states
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false)
  const [resubscribeModalOpen, setResubscribeModalOpen] = useState(false)

  // Toast notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | null
    message: string
  }>({ type: null, message: '' })

  // Show notification with auto-dismiss
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => {
      setNotification({ type: null, message: '' })
    }, 5000)
  }

  useEffect(() => {
    loadUserData()
  }, [])

  // Handle subscription completion after PayPal redirect
  useEffect(() => {
    const completeSubscription = async () => {
      const params = new URLSearchParams(window.location.search)
      const subscriptionId = params.get('subscription_id')

      // If we have a subscription_id, complete the subscription
      if (subscriptionId) {
        console.log('📝 Completing new subscription:', subscriptionId)

        try {
          const response = await apiRequest('/subscriptions/complete-new', {
            method: 'POST',
            body: JSON.stringify({ subscription_id: subscriptionId })
          })

          if (response.status === 200) {
            showNotification('success', response.data?.message || 'Subscription activated successfully!')

            // Reload user data to show new subscription
            await loadUserData()

            // Clean up URL (remove query params)
            window.history.replaceState({}, '', window.location.pathname)
          } else {
            showNotification('error', response.error || 'Failed to complete subscription. Please contact support.')
          }
        } catch (error) {
          console.error('Error completing subscription:', error)
          showNotification('error', 'Failed to complete subscription. Please contact support.')
        }
      }
    }

    completeSubscription()
  }, [])

  const loadUserData = async () => {
    try {
      const userData = await getCurrentUser()
      if (!userData) {
        router.push('/login')
        return
      }
      setUser(userData)
    } catch (error) {
      console.error('Failed to load user data:', error)
      router.push('/login')
    } finally {
      setIsLoading(false)
    }
  }

  // Real API calls to backend
  const handleUpgrade = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/upgrade', { method: 'POST' })

      if (response.status !== 200) {
        showNotification('error', response.error || 'Failed to start upgrade. Please try again.')
        setActionLoading(false)
        setUpgradeModalOpen(false)
        return
      }

      // Check if change was immediate or requires approval
      if (response.data?.immediate) {
        // Plan changed immediately - refresh to show new plan
        showNotification('success', response.data?.message || 'Plan upgraded successfully!')
        setTimeout(() => window.location.reload(), 1500)
      } else if (response.data?.approval_url) {
        // Redirect user to PayPal approval URL
        window.location.href = response.data.approval_url
      } else {
        showNotification('error', 'Unexpected response from server. Please try again.')
        setActionLoading(false)
        setUpgradeModalOpen(false)
      }

    } catch (error) {
      console.error('Upgrade error:', error)
      showNotification('error', 'Failed to process upgrade. Please try again.')
      setActionLoading(false)
      setUpgradeModalOpen(false)
    }
  }

  const handleDowngrade = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/downgrade', { method: 'POST' })

      if (response.status !== 200) {
        showNotification('error', response.error || 'Failed to start downgrade. Please try again.')
        setActionLoading(false)
        setDowngradeModalOpen(false)
        return
      }

      // Check if change was immediate or requires approval
      if (response.data?.immediate) {
        // Plan changed immediately - refresh to show new plan
        showNotification('success', response.data?.message || 'Plan downgraded successfully!')
        setTimeout(() => window.location.reload(), 1500)
      } else if (response.data?.approval_url) {
        // Redirect user to PayPal approval URL
        window.location.href = response.data.approval_url
      } else {
        showNotification('error', 'Unexpected response from server. Please try again.')
        setActionLoading(false)
        setDowngradeModalOpen(false)
      }

    } catch (error) {
      console.error('Downgrade error:', error)
      showNotification('error', 'Failed to process downgrade. Please try again.')
      setActionLoading(false)
      setDowngradeModalOpen(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/cancel', { method: 'POST' })

      if (response.status !== 200) {
        showNotification('error', response.error || 'Failed to cancel subscription. Please try again.')
        setActionLoading(false)
        setCancelModalOpen(false)
        return
      }

      // Update local state to reflect cancellation
      if (user) {
        setUser({ ...user, subscription_status: 'CANCELLED' })
      }

      showNotification('success', response.data?.message || 'Subscription cancelled. You will keep access until your billing period ends.')
      setActionLoading(false)
      setCancelModalOpen(false)

    } catch (error) {
      console.error('Cancel error:', error)
      showNotification('error', 'Failed to cancel subscription. Please try again.')
      setActionLoading(false)
      setCancelModalOpen(false)
    }
  }

  const handleReactivate = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/reactivate', { method: 'POST' })

      if (response.status !== 200) {
        showNotification('error', response.error || 'Failed to reactivate subscription. Please try again.')
        setActionLoading(false)
        setReactivateModalOpen(false)
        return
      }

      // Update local state
      if (user) {
        setUser({ ...user, subscription_status: 'ACTIVE' })
      }

      showNotification('success', response.data?.message || 'Subscription reactivated successfully!')
      setActionLoading(false)
      setReactivateModalOpen(false)

    } catch (error) {
      console.error('Reactivate error:', error)
      showNotification('error', 'Failed to reactivate subscription. Please try again.')
      setActionLoading(false)
      setReactivateModalOpen(false)
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
        showNotification('error', response.error || 'Failed to create new subscription. Please try again.')
        setActionLoading(false)
        setResubscribeModalOpen(false)
        return
      }

      // Redirect to PayPal approval URL
      if (response.data?.approval_url) {
        showNotification('info', 'Redirecting to PayPal to complete your subscription...')
        setTimeout(() => {
          window.location.href = response.data.approval_url
        }, 1000)
      } else {
        showNotification('error', 'Failed to get PayPal approval URL. Please try again.')
        setActionLoading(false)
        setResubscribeModalOpen(false)
      }

    } catch (error) {
      console.error('Resubscribe error:', error)
      showNotification('error', 'Failed to create new subscription. Please try again.')
      setActionLoading(false)
      setResubscribeModalOpen(false)
    }
  }

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'TRIAL':
          return { color: 'bg-blue-100 text-blue-800', icon: Calendar, text: 'Free Trial' }
        case 'ACTIVE':
          return { color: 'bg-green-100 text-green-800', icon: CheckCircle2, text: 'Active' }
        case 'CANCELLED':
          return { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, text: 'Cancelled' }
        case 'SUSPENDED':
          return { color: 'bg-red-100 text-red-800', icon: AlertCircle, text: 'Payment Failed' }
        case 'EXPIRED':
          return { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, text: 'Expired' }
        default:
          return { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, text: status }
      }
    }

    const config = getStatusConfig()
    const Icon = config.icon

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1.5" />
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

    return diffDays > 0 ? diffDays : 0
  }

  const daysRemaining = getDaysRemaining()

  // Determine plan name
  const getPlanName = () => {
    if (user?.plan_tier === 'PREMIUM') return 'Premium Plan'
    if (user?.plan_tier === 'BASIC') return 'Basic Plan'
    return 'Unknown Plan'
  }

  // Determine plan price
  const getPlanPrice = () => {
    if (user?.plan_tier === 'PREMIUM') return '$99.95'
    if (user?.plan_tier === 'BASIC') return '$49.95'
    return 'N/A'
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription details...</p>
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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF7]">
      {/* Toast Notification */}
      {notification.type && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl shadow-2xl transform transition-all duration-300 border-l-4 ${
          notification.type === 'success' ? 'bg-white border-green-500 text-gray-900 shadow-green-100' :
          notification.type === 'error' ? 'bg-white border-red-500 text-gray-900 shadow-red-100' :
          notification.type === 'info' ? 'bg-white border-blue-500 text-gray-900 shadow-blue-100' : ''
        }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {notification.type === 'success' && (
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 text-blue-500 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold text-gray-900 tracking-tight">{notification.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setNotification({ type: null, message: '' })}
                className="inline-flex text-gray-400 hover:text-gray-900"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <Header mode="app" />

      <main className="flex-1 px-6 py-12 sm:py-20">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-black text-[#0B0B0B] tracking-tight mb-2">Subscription</h1>
            <p className="text-[#6B7280] font-light text-lg">Manage your OpenHousePal plan and billing</p>
          </div>

          {/* Alert for suspended/expired subscriptions */}
          {(isSuspended || isExpired) && (
            <div className="mb-8 bg-white border border-red-100 rounded-2xl p-6 flex items-start shadow-sm">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-red-900 mb-1 uppercase tracking-wide text-xs">
                  {isSuspended ? 'Payment Failed' : 'Subscription Expired'}
                </h3>
                <p className="text-sm text-red-700/80 leading-relaxed font-medium">
                  {isSuspended
                    ? 'Your last payment could not be processed. Please update your payment method on PayPal to restore full access.'
                    : 'Your current subscription term has ended. Please reactivate your plan to continue using our premium tools.'}
                </p>
              </div>
            </div>
          )}

          {/* Alert for cancelled subscription */}
          {isCancelled && (
            <div className="mb-8 bg-white border border-amber-100 rounded-2xl p-6 flex items-start shadow-sm">
              <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 mb-1 uppercase tracking-wide text-xs">Subscription Ending Soon</h3>
                <p className="text-sm text-amber-800/80 leading-relaxed font-medium mb-4">
                  Your subscription has been cancelled. You will maintain access to all features until your current period expires.
                </p>
                {daysRemaining !== null && daysRemaining > 0 && (
                  <div className="inline-flex items-center px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                    <Calendar className="w-3.5 h-3.5 text-amber-700 mr-2" />
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                    </span>
                  </div>
                )}
                {daysRemaining === 0 && (
                  <div className="inline-flex items-center px-4 py-1.5 bg-red-50 border border-red-200 rounded-full">
                    <AlertCircle className="w-3.5 h-3.5 text-red-700 mr-2" />
                    <span className="text-xs font-bold text-red-900 uppercase tracking-wider">
                      Access expires today
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-8">
            {/* 1. Current Subscription Card */}
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-8 border border-gray-100">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-50">
                <h2 className="text-xl font-black text-[#0B0B0B] tracking-tight">Current Plan</h2>
                {user?.subscription_status && <StatusBadge status={user.subscription_status} />}
              </div>

              <div className="grid md:grid-cols-2 gap-10">
                <div className="bg-[#FAFAF7] rounded-2xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest mb-2">Selected Tier</p>
                  <p className="text-2xl font-black text-[#0B0B0B] tracking-tight">{getPlanName()}</p>
                  <div className="flex items-baseline mt-4 bg-white px-4 py-2 rounded-xl border border-gray-100 w-fit">
                    <span className="text-2xl font-black text-[#C9A24D] tracking-tighter">{getPlanPrice()}</span>
                    <span className="ml-1.5 text-xs font-bold text-[#6B7280] uppercase tracking-wider">/month</span>
                  </div>
                </div>

                <div className="space-y-4 py-2">
                  {isTrial && user?.trial_ends_at && (
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Trial Ends</p>
                      <p className="text-sm font-black text-[#0B0B0B]">{formatDate(user.trial_ends_at)}</p>
                    </div>
                  )}

                  {user?.subscription_started_at && (
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Active Since</p>
                      <p className="text-sm font-black text-[#0B0B0B]">{formatDate(user.subscription_started_at)}</p>
                    </div>
                  )}

                  {user?.last_billing_date && (
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Last Billing</p>
                      <p className="text-sm font-black text-[#0B0B0B]">{formatDate(user.last_billing_date)}</p>
                    </div>
                  )}

                  {(isTrial || isActive) && (user?.next_billing_date || user?.trial_ends_at) && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">
                        {isTrial ? 'First Payment' : 'Renewal Date'}
                      </p>
                      <p className="text-sm font-black text-[#C9A24D]">
                        {formatDate(isTrial ? user.trial_ends_at : user.next_billing_date)}
                      </p>
                    </div>
                  )}

                  {isCancelled && (user?.next_billing_date || user?.trial_ends_at) && (
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                      <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">Access Ends</p>
                      <p className="text-sm font-black text-amber-600">
                        {formatDate(user.next_billing_date || user.trial_ends_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Feature list */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                <p className="text-xs font-black text-[#6B7280] uppercase tracking-widest mb-4">Included in your plan</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    'Unlimited Open House QR codes',
                    'Dynamic visitor sign-in forms',
                    'Advanced lead management',
                    ...(isPremium ? ['Personalized Property Showcases', 'Automated property matching'] : [])
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center text-sm text-gray-700 font-medium">
                      <div className="w-5 h-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center mr-3 flex-shrink-0">
                        <CheckCircle2 size={12} />
                      </div>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Change Plan Card */}
            {(isActive || isTrial) && (
              <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-8 border border-gray-100">
                <div className="flex items-center mb-6">
                  <div className="w-10 h-10 bg-[#FAFAF7] rounded-xl flex items-center justify-center mr-4 border border-gray-100">
                    <Sparkles className="w-5 h-5 text-[#C9A24D]" />
                  </div>
                  <h2 className="text-xl font-black text-[#0B0B0B] tracking-tight">Plan Options</h2>
                </div>

                <p className="text-[#6B7280] mb-8 leading-relaxed">
                  {isBasic
                    ? 'Elevate your business with Property Showcases and automated buyer matching.'
                    : 'You are on our most powerful plan. Enjoy full access to all conversion tools.'}
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  {isBasic && (
                    <button
                      onClick={() => setUpgradeModalOpen(true)}
                      className="flex items-center justify-center px-6 py-4 bg-[#111827] text-white rounded-xl font-bold shadow-lg hover:bg-[#C9A24D] hover:scale-[1.02] transition-all duration-300 group"
                    >
                      <Sparkles className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                      Upgrade to Premium
                    </button>
                  )}

                  {isPremium && (
                    <button
                      onClick={() => setDowngradeModalOpen(true)}
                      className="flex items-center justify-center px-6 py-4 border-2 border-gray-200 text-[#6B7280] hover:text-[#111827] hover:border-[#111827] rounded-xl font-bold transition-all duration-300"
                    >
                      Switch to Basic
                    </button>
                  )}
                </div>

                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-6">
                  * All changes take effect at the start of your next billing cycle.
                </p>
              </div>
            )}

            {/* 3. Manage Subscription Card */}
            <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-8 border border-gray-100">
              <h2 className="text-xl font-black text-[#0B0B0B] tracking-tight mb-6">Security & Billing</h2>

              {(isActive || isTrial) && !isCancelled && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <p className="text-[#6B7280] text-sm leading-relaxed max-w-md">
                    Looking to pause? If you cancel, your data stays safe and you'll keep access until the end of your billing term.
                  </p>
                  <button
                    onClick={() => setCancelModalOpen(true)}
                    className="px-6 py-3 border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl font-bold text-sm transition-all duration-300"
                  >
                    Cancel Plan
                  </button>
                </div>
              )}

              {isSuspended && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <p className="text-[#6B7280] text-sm leading-relaxed max-w-md">
                    Reactivate your subscription to immediately restore access to your showcases and visitor data.
                  </p>
                  <button
                    onClick={() => setReactivateModalOpen(true)}
                    className="px-8 py-4 bg-[#111827] text-white rounded-xl font-bold shadow-lg hover:bg-[#C9A24D] transition-all duration-300"
                  >
                    Reactivate Now
                  </button>
                </div>
              )}

              {(isCancelled || isExpired) && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <p className="text-[#6B7280] text-sm leading-relaxed max-w-md">
                    Regain full access to the platform by starting a new subscription today.
                  </p>
                  <button
                    onClick={() => setResubscribeModalOpen(true)}
                    className="px-8 py-4 bg-[#111827] text-white rounded-xl font-bold shadow-lg hover:bg-[#C9A24D] transition-all duration-300"
                  >
                    Resubscribe
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Back button */}
          <div className="mt-12 text-center">
            <button
              onClick={() => router.push('/')}
              className="group inline-flex items-center text-[#6B7280] hover:text-[#111827] font-bold text-xs uppercase tracking-widest transition-all duration-300"
            >
              <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>

      <Footer />

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
        confirmButtonClass="bg-[#111827] hover:bg-gray-800"
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
        confirmText="Reactivate Now"
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

      {/* Confirmation Modals */}
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
        confirmButtonClass="bg-[#111827] hover:bg-gray-800"
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
        confirmText="Reactivate Now"
        isLoading={actionLoading}
      />
    </div>
  )
}
