'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Header from './Header'
import { getToken } from '@/lib/token'

export default function AppHeader() {
  const pathname = usePathname()
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    setHasToken(Boolean(getToken()))
  }, [pathname])

  // Pages that should NOT have the main app header
  const noHeaderPaths = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/open-house/',
    '/property/',
    '/showcase/',
    '/unsubscribe',
  ]

  const isPublicAgentPage = Boolean(
    pathname?.match(/^\/(?!admin$|agent-hub$|login$|register$|forgot-password$|reset-password$|open-house(?:\/|$)|open-houses(?:\/|$)|privacy$|terms$|unsubscribe$|checkout$|discovery$|broker-authorization$|showcase(?:s)?(?:\/|$)|settings(?:\/|$)|upgrade-required$)[^/]+(?:\/sales)?\/?$/) ||
    pathname?.startsWith('/AgentHub/')
  )

  const isNoHeader = noHeaderPaths.some(path => pathname?.startsWith(path)) || (isPublicAgentPage && !hasToken)

  if (isNoHeader) {
    return null
  }

  // Landing page gets 'landing' mode
  if (pathname === '/') {
    return <Header mode="landing" />
  }

  // All other pages get 'app' mode (which persists)
  return <Header mode="app" />
}
