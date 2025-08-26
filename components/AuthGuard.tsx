'use client'

import { useEffect, useState } from 'react'
import { checkAuth, handleAuthError } from '@/lib/auth'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const verifyAuth = async () => {
      const isAuth = await checkAuth()
      
      if (!isAuth) {
        handleAuthError()
        return
      }
      
      setIsAuthenticated(isAuth)
    }

    verifyAuth()
  }, [])

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355]"></div>
        </div>
      )
    )
  }

  // If not authenticated, the redirect will happen in useEffect
  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}