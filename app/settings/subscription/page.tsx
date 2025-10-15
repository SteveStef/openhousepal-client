'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ConfirmationModal from '@/components/ConfirmationModal'
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

  useEffect(() => {
    loadUserData()
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
        alert(`Failed to start upgrade: ${response.error || 'Please try again.'}`)
        setActionLoading(false)
        setUpgradeModalOpen(false)
        return
      }

      // Redirect user to PayPal approval URL
      window.location.href = response.data?.approval_url

    } catch (error) {
      console.error('Upgrade error:', error)
      alert('Failed to process upgrade. Please try again.')
      setActionLoading(false)
      setUpgradeModalOpen(false)
    }
  }

  const handleDowngrade = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/downgrade', { method: 'POST' })

      if (response.status !== 200) {
        alert(`Failed to start downgrade: ${response.error || 'Please try again.'}`)
        setActionLoading(false)
        setDowngradeModalOpen(false)
        return
      }

      // Redirect user to PayPal approval URL
      window.location.href = response.data?.approval_url

    } catch (error) {
      console.error('Downgrade error:', error)
      alert('Failed to process downgrade. Please try again.')
      setActionLoading(false)
      setDowngradeModalOpen(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/cancel', { method: 'POST' })

      if (response.status !== 200) {
        alert(`Failed to cancel subscription: ${response.error || 'Please try again.'}`)
        setActionLoading(false)
        setCancelModalOpen(false)
        return
      }

      // Update local state to reflect cancellation
      if (user) {
        setUser({ ...user, subscription_status: 'CANCELLED' })
      }

      alert(response.data?.message || 'Subscription cancelled. You will keep access until your billing period ends.')
      setActionLoading(false)
      setCancelModalOpen(false)

    } catch (error) {
      console.error('Cancel error:', error)
      alert('Failed to cancel subscription. Please try again.')
      setActionLoading(false)
      setCancelModalOpen(false)
    }
  }

  const handleReactivate = async () => {
    setActionLoading(true)

    try {
      const response = await apiRequest('/subscriptions/reactivate', { method: 'POST' })

      if (response.status !== 200) {
        alert(`Failed to reactivate subscription: ${response.error || 'Please try again.'}`)
        setActionLoading(false)
        setReactivateModalOpen(false)
        return
      }

      // Update local state
      if (user) {
        setUser({ ...user, subscription_status: 'ACTIVE' })
      }

      alert(response.data?.message || 'Subscription reactivated successfully!')
      setActionLoading(false)
      setReactivateModalOpen(false)

    } catch (error) {
      console.error('Reactivate error:', error)
      alert('Failed to reactivate subscription. Please try again.')
      setActionLoading(false)
      setReactivateModalOpen(false)
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

  // Determine plan name
  const getPlanName = () => {
    if (user?.plan_tier === 'PREMIUM') return 'Premium Plan'
    if (user?.plan_tier === 'BASIC') return 'Basic Plan'
    return 'Unknown Plan'
  }

  // Determine plan price
  const getPlanPrice = () => {
    if (user?.plan_tier === 'PREMIUM') return '$99.99'
    if (user?.plan_tier === 'BASIC') return '$49.99'
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
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Subscription Cancelled</h3>
                <p className="text-sm text-yellow-700">
                  Your subscription has been cancelled. You will keep access until your current billing period ends.
                </p>
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

              {isCancelled && (
                <>
                  <p className="text-gray-600 mb-6">
                    Your subscription is cancelled but you still have access until your billing period ends. You can reactivate anytime.
                  </p>
                  <button
                    onClick={() => setReactivateModalOpen(true)}
                    className="px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all"
                  >
                    Reactivate Subscription
                  </button>
                </>
              )}

              {(isExpired || isSuspended) && (
                <>
                  <p className="text-gray-600 mb-6">
                    {isSuspended
                      ? 'Update your payment method on PayPal to restore your subscription.'
                      : 'Your subscription has expired. You can create a new subscription to regain access.'}
                  </p>
                  <button
                    onClick={() => router.push('/register')}
                    className="px-6 py-3 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all"
                  >
                    Create New Subscription
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
        message="You'll be redirected to PayPal to approve the plan change. The upgrade will take effect at the start of your next billing cycle."
        confirmText="Continue to PayPal"
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={downgradeModalOpen}
        onClose={() => setDowngradeModalOpen(false)}
        onConfirm={handleDowngrade}
        title="Downgrade to Basic?"
        message="You'll lose access to Property Showcases and automated matching. The downgrade will take effect at the start of your next billing cycle."
        confirmText="Continue to PayPal"
        confirmButtonClass="bg-gray-600 hover:bg-gray-700"
        isLoading={actionLoading}
      />

      <ConfirmationModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Subscription?"
        message="You'll keep access until the end of your current billing period. You can reactivate anytime before it expires."
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
    </div>
  )
}
