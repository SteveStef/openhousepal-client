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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#faf9f7] via-white to-[#f5f4f2]">
      {/* Toast Notification */}
      {notification.type && (
        <div className={`fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
          notification.type === 'success' ? 'bg-green-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          notification.type === 'info' ? 'bg-blue-500 text-white' : ''
        }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {notification.type === 'success' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'error' && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {notification.type === 'info' && (
                <svg className="w-5 h-5 animate-spin" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setNotification({ type: null, message: '' })}
                className="inline-flex text-white hover:text-gray-200 focus:outline-none focus:text-gray-200"
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

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Subscription</h1>
            <p className="text-gray-600">View and manage your Open House Pal subscription</p>
          </div>

          {/* Alert for suspended/expired subscriptions */}
          {(isSuspended || isExpired) && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">
                  {isSuspended ? 'Payment Failed' : 'Subscription Expired'}
                </h3>
                <p className="text-sm text-red-700">
                  {isSuspended
                    ? 'Your payment method failed. Please update your payment method on PayPal to restore access.'
                    : 'Your subscription has expired. Please reactivate or create a new subscription to continue using Open House Pal.'}
                </p>
              </div>
            </div>
          )}

          {/* Alert for cancelled subscription */}
          {isCancelled && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">Subscription Cancelled</h3>
                <p className="text-sm text-yellow-700 mb-2">
                  Your subscription has been cancelled. You will keep access until your current billing period ends.
                </p>
                {daysRemaining !== null && daysRemaining > 0 && (
                  <div className="mt-2 inline-flex items-center px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-lg">
                    <Calendar className="w-4 h-4 text-yellow-700 mr-2" />
                    <span className="text-sm font-semibold text-yellow-900">
                      {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                    </span>
                  </div>
                )}
                {daysRemaining === 0 && (
                  <div className="mt-2 inline-flex items-center px-3 py-1.5 bg-red-100 border border-red-300 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-700 mr-2" />
                    <span className="text-sm font-semibold text-red-900">
                      Access expires today
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-6">
            {/* 1. Current Subscription Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Current Subscription</h2>
                {user?.subscription_status && <StatusBadge status={user.subscription_status} />}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Plan</p>
                  <p className="text-lg font-semibold text-gray-900">{getPlanName()}</p>
                  <p className="text-2xl font-bold text-[#8b7355] mt-1">
                    {getPlanPrice()}<span className="text-base font-normal text-gray-600">/month</span>
                  </p>
                </div>

                <div className="space-y-3">
                  {isTrial && user?.trial_ends_at && (
                    <div>
                      <p className="text-sm text-gray-500">Trial Ends</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(user.trial_ends_at)}</p>
                    </div>
                  )}

                  {user?.subscription_started_at && (
                    <div>
                      <p className="text-sm text-gray-500">Started</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(user.subscription_started_at)}</p>
                    </div>
                  )}

                  {user?.last_billing_date && (
                    <div>
                      <p className="text-sm text-gray-500">Last Billing</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(user.last_billing_date)}</p>
                    </div>
                  )}

                  {(isTrial || isActive) && (user?.next_billing_date || user?.trial_ends_at) && (
                    <div>
                      <p className="text-sm text-gray-500">
                        {isTrial ? 'First Billing' : 'Next Billing'}
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(isTrial ? user.trial_ends_at : user.next_billing_date)}
                      </p>
                    </div>
                  )}

                  {isCancelled && (user?.next_billing_date || user?.trial_ends_at) && (
                    <div>
                      <p className="text-sm text-gray-500">Access Ends</p>
                      <p className="text-sm font-medium text-yellow-700">
                        {formatDate(user.next_billing_date || user.trial_ends_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Feature list */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">Your Plan Includes:</p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    Unlimited Open House QR codes
                  </li>
                  <li className="flex items-start text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    Visitor sign-in forms
                  </li>
                  <li className="flex items-start text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    Lead capture and management
                  </li>
                  {isPremium && (
                    <>
                      <li className="flex items-start text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        Property Showcases
                      </li>
                      <li className="flex items-start text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        Automated property matching
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            {/* 2. Change Plan Card */}
            {(isActive || isTrial) && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center mb-4">
                  <Sparkles className="w-5 h-5 text-[#8b7355] mr-2" />
                  <h2 className="text-xl font-bold text-gray-900">Change Plan</h2>
                </div>

                <p className="text-gray-600 mb-6">
                  {isBasic
                    ? 'Upgrade to Premium to unlock Property Showcases and automated property matching.'
                    : 'You are currently on the Premium plan with access to all features.'}
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  {isBasic && (
                    <button
                      onClick={() => setUpgradeModalOpen(true)}
                      className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all"
                    >
                      <Sparkles className="w-5 h-5 mr-2" />
                      Upgrade to Premium
                    </button>
                  )}

                  {isPremium && (
                    <button
                      onClick={() => setDowngradeModalOpen(true)}
                      className="flex items-center justify-center px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Downgrade to Basic
                    </button>
                  )}
                </div>

                {(isBasic || isPremium) && (
                  <p className="text-xs text-gray-500 mt-4">
                    * Plan changes take effect at the start of your next billing cycle.
                  </p>
                )}
              </div>
            )}

            {/* 3. Manage Subscription Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Manage Subscription</h2>

              {(isActive || isTrial) && !isCancelled && (
                <>
                  <p className="text-gray-600 mb-6">
                    If you cancel your subscription, you'll keep access until the end of your current billing period.
                  </p>
                  <button
                    onClick={() => setCancelModalOpen(true)}
                    className="px-6 py-3 border-2 border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors"
                  >
                    Cancel Subscription
                  </button>
                </>
              )}

              {isSuspended && (
                <>
                  <p className="text-gray-600 mb-6">
                    Your payment method failed. Update your payment method on PayPal, then reactivate your subscription to restore access.
                  </p>
                  <button
                    onClick={() => setReactivateModalOpen(true)}
                    className="px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all"
                  >
                    Reactivate Subscription
                  </button>
                </>
              )}

              {(isCancelled || isExpired) && (
                <>
                  <p className="text-gray-600 mb-6">
                    {isCancelled
                      ? 'Your subscription has been cancelled. Create a new subscription to regain access.'
                      : 'Your subscription has expired. Create a new subscription to regain access.'}
                  </p>
                  <button
                    onClick={() => setResubscribeModalOpen(true)}
                    className="px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all"
                  >
                    Resubscribe
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Back button */}
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-[#8b7355] font-medium transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </main>

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
            : "You may need to approve this change on PayPal. The upgrade will take effect at the start of your next billing cycle."
        }
        confirmText={isTrial ? "Upgrade Plan" : "Continue"}
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={downgradeModalOpen}
        onClose={() => setDowngradeModalOpen(false)}
        onConfirm={handleDowngrade}
        title="Downgrade to Basic?"
        message={
          isTrial
            ? "You'll lose access to Property Showcases and automated matching. Your plan will be downgraded immediately during your trial."
            : "You'll lose access to Property Showcases and automated matching. You may need to approve this change on PayPal. The downgrade will take effect at the start of your next billing cycle."
        }
        confirmText={isTrial ? "Downgrade Plan" : "Continue"}
        confirmButtonClass="bg-gray-600 hover:bg-gray-700"
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Subscription?"
        message="You'll keep access until the end of your current billing period. After cancellation, you'll need to create a new subscription to regain access."
        confirmText="Yes, Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={reactivateModalOpen}
        onClose={() => setReactivateModalOpen(false)}
        onConfirm={handleReactivate}
        title="Reactivate Subscription?"
        message="Your subscription will be reactivated and you'll continue to be billed at the end of your current period."
        confirmText="Reactivate"
        isLoading={actionLoading}
      />

      {/* Resubscribe Modal */}
      <ResubscribeModal
        isOpen={resubscribeModalOpen}
        onClose={() => setResubscribeModalOpen(false)}
        onSelectPlan={handleResubscribe}
        isLoading={actionLoading}
      />
    </div>
  )
}
