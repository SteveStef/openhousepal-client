'use client'

import OhpLoader from '@/components/brand/OhpLoader'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { handleAuthError } from '@/lib/auth-helpers'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    // Only redirect if loading is finished and we are definitely not authenticated
    if (!isLoading && !isAuthenticated) {
      handleAuthError()
    }
  }, [isLoading, isAuthenticated])

  // Show loading state while AuthContext is fetching the initial user state
  if (isLoading) {
    return (
      fallback || (
        <OhpLoader />
      )
    )
  }

  // If not authenticated, we return null while the useEffect handles the redirect
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}