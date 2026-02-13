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
    // open-house/[id] is visitor facing, usually no nav
    '/open-house/',
    '/property/',
  ]

  const isNoHeader = noHeaderPaths.some(path => pathname?.startsWith(path))

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
