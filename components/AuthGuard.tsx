'use client'

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
        <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex items-center justify-center transition-colors duration-300">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-[#C9A24D]/20 border-t-[#C9A24D] rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest animate-pulse">
              Checking authentication...
            </p>
          </div>
        </div>
      )
    )
  }

  // If not authenticated, we return null while the useEffect handles the redirect
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}