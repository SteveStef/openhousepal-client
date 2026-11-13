'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react'
import { User } from '@/types'
import api from '@/lib/api-service'
import { getToken, setToken, tokenInfo } from '@/lib/token'
import { setQrOwner } from '@/lib/qr'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  refreshUser: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasInitialCheckRef = useRef(false)

  const fetchUser = useCallback(async () => {
    // Only attempt to fetch if we have a token
    const token = getToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      // Never wait forever on "who's signed in" (10/24 - a new tab on an iPhone sat on the loader
      // for good when this one request never came back): each try gives up after 12s, three tries.
      // Launch audit 11/13: no answer at all, or the server restarting (a deploy: 502/503), is
      // tried again for up to ~40s - it used to count as "signed out" and sent the agent to the
      // sign-in page. A real answer (signed in, or not) ends it at once.
      let res: { success: boolean; data?: any } = { success: false }
      const started = Date.now()
      for (let attempt = 0; attempt < 8; attempt++) {
        const timedOut = new Promise<null>(r => setTimeout(() => r(null), 12000))
        const got = await Promise.race([api.auth.me(), timedOut])
        if (got && (got.success || (got.status && got.status < 500))) { res = got; break }
        if (Date.now() - started > 40000) break
        await new Promise(r => setTimeout(r, Math.min(1500 * (attempt + 1), 6000)))
      }
      const { success, data } = res
      if (success && data) {
        setUser(data)
        // Every QR code drawn in the app from now on uses this agent's centre logo choice.
        setQrOwner(data.id)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial check on mount
    if (!hasInitialCheckRef.current) {
      hasInitialCheckRef.current = true
      fetchUser()
    }
  }, [fetchUser])

  // Stay signed in while they use it (owner, 11/01: signed out every 24 hours): a Remember-me sign-in
  // is renewed to a fresh 30 days once it's a day old - on load and when they come back to the tab.
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let busy = false
    const renew = () => {
      const info = tokenInfo(getToken())
      if (busy || !info || !info.remember || info.exp - Date.now() > 29 * 864e5) return
      busy = true
      api.auth.refreshSession().then(r => {
        if (r.success && r.data?.access_token) setToken(r.data.access_token, r.data.days || 30)
      }).finally(() => { busy = false })
    }
    renew()
    window.addEventListener('focus', renew)
    return () => window.removeEventListener('focus', renew)
  }, [userId])

  const refreshUser = async () => {
    // Only a first sign-in shows the loading state. Re-checking an agent who's already signed in
    // (after a profile save, a plan change...) must not flip every guard back to its loader - that
    // unmounted whole pages mid-use and threw away what the agent was doing (Studio create flow, 10/09).
    if (!user) setIsLoading(true)
    await fetchUser()
  }

  const logout = () => {
    api.auth.logout()
    setUser(null)
  }

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    refreshUser,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Like useAuth, but safe outside AuthProvider (e.g. shared pieces also used on public sites) - undefined there. */
export function useOptionalAuth() {
  return useContext(AuthContext)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
