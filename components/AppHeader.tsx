'use client'

import { usePathname } from 'next/navigation'
import Header from './Header'

export default function AppHeader() {
  const pathname = usePathname()

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
    pathname?.match(/^\/(?!admin$|agent-hub$|login$|register$|forgot-password$|reset-password$|open-house(?:\/|$)|open-houses(?:\/|$)|privacy$|terms$|unsubscribe$|checkout$|discovery$|broker-authorization$|showcase(?:s)?(?:\/|$)|settings(?:\/|$)|upgrade-required$)[^/]+(?:\/[^/]+)?\/?$/) ||
    pathname?.startsWith('/AgentHub/')
  )

  const isNoHeader = noHeaderPaths.some(path => pathname?.startsWith(path)) || isPublicAgentPage

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
