'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useOptionalAuth } from '@/contexts/AuthContext'
import { homeHref } from '@/lib/sitePages'

/** A link to the homepage that works signed in too (plain `/` would bounce to the dashboard). */
export default function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const signedIn = !!useOptionalAuth()?.isAuthenticated
  return <Link href={homeHref(signedIn)} className={className}>{children}</Link>
}
