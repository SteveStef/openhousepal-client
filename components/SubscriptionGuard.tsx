'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser, hasValidSubscription, User } from '@/lib/auth'

interface SubscriptionGuardProps {
  children: React.ReactNode
  requiredPlan: 'PREMIUM' | 'BASIC'
}

export default function SubscriptionGuard({ children, requiredPlan }: SubscriptionGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasAccess, setHasAccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAccess()
  }, [])

  const checkAccess = async () => {
    try {
      const user: User | null = await getCurrentUser()

      // Not authenticated - redirect to login
      if (!user) {
        router.push('/login?redirect=' + encodeURIComponent(pathname))
        return
      }

      // Check if user has valid subscription (including grace periods)
      if (!hasValidSubscription(user)) {
        // Subscription expired, cancelled without grace period, or suspended
        router.push('/upgrade-required')
        return
      }

      // Check if user has required plan tier
      if (requiredPlan === 'PREMIUM' && user.plan_tier !== 'PREMIUM') {
        // User needs to upgrade to Premium
        router.push('/upgrade-required')
        return
      }

      // All checks passed - grant access
      setHasAccess(true)
      setIsLoading(false)
    } catch (error) {
      console.error('Subscription check error:', error)
      router.push('/login')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B] transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] dark:border-[#C9A24D] mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verifying access...</p>
        </div>
      </div>
    )
  }

  return hasAccess ? <>{children}</> : null
}
