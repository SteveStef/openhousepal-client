'use client'

import OhpLoader from '@/components/brand/OhpLoader'

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

    // Admins are exempt from this check
    if (user.is_admin) return

    // Check for authorization
    if (!user.broker_authorized && pathname !== '/broker-authorization') {
      console.log('Redirecting to broker authorization page...')
      router.push('/broker-authorization')
    }
  }, [user, isAuthenticated, isLoading, router, pathname])

  if (isLoading) {
    return (
      <OhpLoader />
    )
  }

  // If not authorized, don't render children until redirect
  if (isAuthenticated && user && !user.is_admin && !user.broker_authorized && pathname !== '/broker-authorization') {
    return null
  }

  return <>{children}</>
}
