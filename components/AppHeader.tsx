'use client'

import { usePathname } from 'next/navigation'
import Header from './Header'
import { TodaysRundownHost } from './rundown/TodaysRundown'
import { hasAppHeader } from '@/lib/appChrome'

export default function AppHeader() {
  const pathname = usePathname()

  // Public pages (sign-in, Showcase, Agent Hub, IDX...) have their own chrome - see lib/appChrome.
  if (!hasAppHeader(pathname)) {
    return null
  }

  // One header for every page, in the same spot, so going between pages never rebuilds it - that was
  // part of the jump between the homepage and the public pages (owner, 11/05). Today's Rundown window
  // lives here once, so the bell, Activity and Dash can open it on any page.
  const landing = pathname === '/'
  return <><Header mode={landing ? 'landing' : 'app'} />{!landing && <TodaysRundownHost />}</>
}
