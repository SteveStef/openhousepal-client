'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import SiteLoader from './SiteLoader'

// Every click to another page on the IDX site gets instant feedback: a thin accent line glides
// across the top of the screen until the next page arrives (and the new page's content fades up -
// .ohp-site main in site-theme.css). Skips form buttons (they open a window), new tabs, hash
// links on the same page, downloads and other sites.
export default function SiteNavProgress() {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const pathname = usePathname()
  // In-app navigations (no full reload) finish when the path changes.
  useEffect(() => { setState(s => (s === 'loading' ? 'done' : s)) }, [pathname])
  // Never leave the line hanging (a link that ends up not navigating).
  useEffect(() => {
    if (state !== 'loading') return
    const t = setTimeout(() => setState('done'), 8000)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download') || a.dataset.ohpForm || a.dataset.ohpCriteria) return
      let url: URL
      try { url = new URL(a.href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      setState('loading')
    }
    const onShow = () => setState(s => (s === 'loading' ? 'done' : s))
    document.addEventListener('click', onClick)
    window.addEventListener('pageshow', onShow)
    return () => { document.removeEventListener('click', onClick); window.removeEventListener('pageshow', onShow) }
  }, [])

  useEffect(() => {
    if (state !== 'done') return
    const t = setTimeout(() => setState('idle'), 400)
    return () => clearTimeout(t)
  }, [state])

  // A page that isn't there in a blink gets the site's own loading screen - the agent's logo or
  // initials (SiteLoader) on the site's background - like the OpenHousePal app's loading pages.
  // Waits a moment first so quick pages never flash it.
  const [screen, setScreen] = useState(false)
  useEffect(() => {
    if (state !== 'loading') { setScreen(false); return }
    const t = setTimeout(() => setScreen(true), 350)
    return () => clearTimeout(t)
  }, [state])

  if (state === 'idle') return null
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
        <div className={`ohp-nav-progress h-full ${state === 'done' ? 'is-done' : ''}`} />
      </div>
      {screen && (
        <div className="ohp-nav-screen fixed inset-0 z-[190] grid place-items-center">
          <SiteLoader size="lg" label={null} />
        </div>
      )}
    </>
  )
}
