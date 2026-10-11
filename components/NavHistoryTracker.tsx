'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordNav } from '@/lib/navHistory'

// Feeds lib/navHistory on every route change so header back arrows can return to the real
// previous page. Query strings are part of the entry (tabs like ?tab=results are their own step).
export default function NavHistoryTracker() {
  const pathname = usePathname()
  useEffect(() => {
    recordNav(window.location.pathname + window.location.search)
  }, [pathname])
  return null
}
