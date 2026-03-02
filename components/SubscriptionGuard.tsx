'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { hasValidSubscription } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'

interface SubscriptionGuardProps {
  children: React.ReactNode
  requiredPlan: 'PREMIUM' | 'BASIC'
}

export default function SubscriptionGuard({ children, requiredPlan }: SubscriptionGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading) return

    // Not authenticated - redirect to login
    if (!isAuthenticated || !user) {
      router.push('/login?redirect=' + encodeURIComponent(pathname))
      return
    }

    // Admins have access to everything
    if (user.is_admin) return

    // Check for users waiting to pay or with no active subscription
    if (user.subscription_status === 'PENDING_PAYMENT' || !hasValidSubscription(user)) {
      router.push('/checkout')
      return
    }

    // Check if user has required plan tier (Premium vs Basic)
    if (requiredPlan === 'PREMIUM' && user.plan_tier !== 'PREMIUM') {
      // User has Basic but needs Premium - send to upgrade page
      router.push('/upgrade-required')
      return
    }
  }, [user, isAuthenticated, isLoading, requiredPlan, router, pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C9A24D] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-bold uppercase tracking-widest text-xs animate-pulse">Verifying access...</p>
        </div>
      </div>
    )
  }

  // Permission check for rendering
  const hasAccess = user?.is_admin || (
    isAuthenticated && 
    user && 
    (user.subscription_status !== 'PENDING_PAYMENT' && hasValidSubscription(user)) &&
    !(requiredPlan === 'PREMIUM' && user.plan_tier !== 'PREMIUM')
  )

  return hasAccess ? <>{children}</> : null
}
