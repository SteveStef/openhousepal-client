'use client'

import { usePathname } from 'next/navigation'
import Header from './Header'
import { hasAppHeader } from '@/lib/appChrome'

export default function AppHeader() {
  const pathname = usePathname()

  // Public pages (sign-in, Showcase, Agent Hub, IDX...) have their own chrome - see lib/appChrome.
  if (!hasAppHeader(pathname)) {
    return null
  }

  // Landing page gets 'landing' mode
  if (pathname === '/') {
    return <Header mode="landing" />
  }

  // All other pages get 'app' mode (which persists)
  return <Header mode="app" />
}
