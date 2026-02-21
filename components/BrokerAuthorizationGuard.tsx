'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { ReactNode, useEffect } from 'react'

interface BrokerAuthorizationGuardProps {
  children: ReactNode
}

/**
 * A guard component that redirects users to the broker authorization page
 * if their account is not yet authorized.
 * Admins are exempt from this check.
 */
export default function BrokerAuthorizationGuard({ children }: BrokerAuthorizationGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading) return

    // If not authenticated, let AuthGuard handle it
    if (!isAuthenticated || !user) return

    // Check for authorization
    if (!user.broker_authorized && pathname !== '/broker-authorization') {
      console.log('Redirecting to broker authorization page...')
      router.push('/broker-authorization')
    }
  }, [user, isAuthenticated, isLoading, router, pathname])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex items-center justify-center p-4 transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#C9A24D]/20 border-t-[#C9A24D] rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest animate-pulse">
            Verifying access...
          </p>
        </div>
      </div>
    )
  }

  // If not authorized, don't render children until redirect
  if (isAuthenticated && user && !user.broker_authorized && pathname !== '/broker-authorization') {
    return null
  }

  return <>{children}</>
}
