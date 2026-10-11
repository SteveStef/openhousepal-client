'use client'

// Agent-only sections (Tools/Studio, Leads): a logged-out visitor goes to the homepage, same as
// the Dash does - never a page of locked cards. Nothing renders until the session check is done.
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function SignedInOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  // A design's /print page is opened by the server's headless export browser, which has no session -
  // it signs its data fetches with a short-lived export token instead. Sending it home exported the
  // homepage as the "PDF".
  const exportRender = /\/print\/?$/.test(usePathname() || '')

  useEffect(() => {
    if (!exportRender && !isLoading && !isAuthenticated) router.replace('/')
  }, [exportRender, isLoading, isAuthenticated, router])

  // Hidden only until we know who's signed in. A later re-check (refreshUser after a save) keeps the
  // page mounted - blanking it there threw away the page's state mid-use.
  if (!isAuthenticated && !exportRender) return null
  return <>{children}</>
}
