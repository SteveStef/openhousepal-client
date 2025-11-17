'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { User, getCurrentUser } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasFetchedRef = useRef(false)

  const fetchUser = async () => {
    try {
      const userData = await getCurrentUser()
      setUser(userData)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Only fetch user data once when the app first loads
    // Prevents refetching on every navigation
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchUser()
    }
  }, [])

  const refreshUser = async () => {
    setIsLoading(true)
    await fetchUser()
  }

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    refreshUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
