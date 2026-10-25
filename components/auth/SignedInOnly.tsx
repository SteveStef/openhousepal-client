'use client'

// Agent-only sections (Tools/Studio, Leads): a logged-out visitor goes to the homepage, same as
// the Dash does - never a page of locked cards. Nothing renders until the session check is done.
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import OhpLoader from '@/components/brand/OhpLoader'

export default function SignedInOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  // A design's /print page is opened by the server's headless export browser, which has no session -
  // it signs its data fetches with a short-lived export token instead. Sending it home exported the
  // homepage as the "PDF".
  const exportRender = /\/print\/?$/.test(usePathname() || '')

  const pathname = usePathname() || '/'
  useEffect(() => {
    // Not signed in on this tab (e.g. a shortcut link opened in a new tab without a session): the
    // sign-in page, then straight back here - instead of a blank page or the homepage.
    if (!exportRender && !isLoading && !isAuthenticated) {
      const back = pathname + (typeof window !== 'undefined' ? window.location.search : '')
      router.replace(`/login?redirect=${encodeURIComponent(back)}`)
    }
  }, [exportRender, isLoading, isAuthenticated, router, pathname])

  // Until we know who's signed in: the house loader - never an empty page. (It used to render
  // nothing here, and the page loader (PageGate) stops waiting after 9s, so a new tab whose sign-in
  // check was slow showed a bare black / white page that looked like it was loading forever - 10/24.)
  // A later re-check (refreshUser after a save) keeps the page mounted - blanking it there threw
  // away the page's state mid-use.
  if (!isAuthenticated && !exportRender) return <OhpLoader label={isLoading ? undefined : 'Taking you to sign in'} />
  return <>{children}</>
}
