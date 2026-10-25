'use client'

// Every agent page opens the same way: nothing half-loaded is ever shown - the page appears once it
// is really ready (all its API calls answered, fonts in, the photos on screen loaded) and rises in,
// section by section. The OpenHousePal house loader only appears when that takes a moment: a page
// that's ready right away just appears - no logo, no forced wait (user, 10/17 - it used to hold
// every page at least 1.2s so the house could finish drawing).
//
// "Ready" is measured, not guessed: every fetch to the API is counted (window.fetch is wrapped
// once), and the page counts as loaded once nothing has been in flight for a moment. It starts on
// the link click (so the old page never sits there frozen) and on any path change (router.push,
// back / forward). Hard cap so a stuck request can never trap anyone behind the loader.
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import OhpLoader from '@/components/brand/OhpLoader'
import { API_BASE_URL } from '@/lib/api-service'
import { isGatedAppPage } from '@/lib/appChrome'

const QUIET_MS = 160      // nothing in flight for this long = the data is in
const GRACE_MS = 280      // ready within this = the page just appears (the loader never shows)
const MIN_SHOWN_MS = 450  // once the loader IS up, keep it this long so it never flickers
const MAX_MS = 9000       // a slow / stuck request never holds the page hostage
const IMAGES_MAX_MS = 2500
const NAV_WAIT_MS = 5000  // a clicked link that never navigates lets go after this...
const NAV_SLOW_MS = 45000 // ...unless the new page is still on its way (slow network / a rebuilding dev server)

// ---- in-flight API calls -------------------------------------------------------------------
let pending = 0
let pageFetches = 0 // Next's own fetches for the next page (?_rsc=) - a navigation still in progress
let patched = false
function countApiCalls() {
  if (patched || typeof window === 'undefined') return
  patched = true
  const original = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(API_BASE_URL)) {
      if (!url.includes('_rsc=')) return original(input, init)
      pageFetches++
      let over = false
      const fin = () => { if (!over) { over = true; pageFetches-- } }
      return original(input, init).then(r => { fin(); return r }, e => { fin(); throw e })
    }
    pending++
    let done = false
    const end = () => { if (!done) { done = true; pending-- } }
    return original(input, init).then(r => { end(); return r }, e => { end(); throw e })
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function untilQuiet(alive: () => boolean, started: number) {
  let quietSince = 0
  while (alive()) {
    const now = Date.now()
    if (pending === 0) { if (!quietSince) quietSince = now } else quietSince = 0
    if ((quietSince && now - quietSince >= QUIET_MS) || now - started > MAX_MS) return
    await sleep(50)
  }
}

// The photos you'd see first: wait for the ones in view (not the whole page) to finish.
async function untilImagesIn(root: HTMLElement | null) {
  const waits: Promise<unknown>[] = []
  if (document.fonts?.ready) waits.push(document.fonts.ready)
  root?.querySelectorAll('img').forEach(img => {
    if (img.complete) return
    const r = img.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) return
    waits.push(new Promise(res => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }) }))
  })
  if (waits.length) await Promise.race([Promise.all(waits), sleep(IMAGES_MAX_MS)])
}

// The page's main sections: walk down past single wrappers (min-h-screen > mx-auto...) to the
// level where the page actually splits into header / toolbar / list, then the ones in view.
function sectionsOf(root: HTMLElement): HTMLElement[] {
  const kids = (el: Element) => Array.from(el.children).filter((c): c is HTMLElement =>
    c instanceof HTMLElement && c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT' && c.offsetHeight > 0)
  let node: HTMLElement = root
  for (let depth = 0; depth < 6; depth++) {
    const list = kids(node)
    if (list.length === 0) break
    const biggest = list.reduce((a, b) => (b.offsetHeight > a.offsetHeight ? b : a))
    if (list.length === 1 || biggest.offsetHeight >= node.offsetHeight * 0.8) { node = biggest; continue }
    break
  }
  return kids(node).filter(el => el.getBoundingClientRect().top < window.innerHeight).slice(0, 8)
}

function reveal(root: HTMLElement | null) {
  if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // Web Animations, not CSS classes - they stack on top of a section's own CSS animations instead
  // of replacing (and later replaying) them.
  sectionsOf(root).forEach((el, i) => {
    el.animate(
      [{ opacity: 0, transform: 'translateY(22px) scale(.985)' }, { opacity: 1, transform: 'none' }],
      { duration: 720, delay: 60 + i * 75, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' },
    )
  })
}

const LABELS: [string, string][] = [
  ['/dash', 'Loading your dashboard'],
  ['/leads/tasks', 'Loading your follow-ups'],
  ['/leads/emails', 'Loading your emails'],
  ['/leads', 'Loading your leads'],
  ['/activity', 'Loading your activity'],
  ['/showcases', 'Loading your Showcases'],
  ['/open-houses', 'Loading your open houses'],
  ['/discovery', 'Loading Discovery'],
  ['/settings', 'Loading your settings'],
  ['/admin', 'Loading admin'],
]
const labelFor = (p: string) => LABELS.find(([prefix]) => p === prefix || p.startsWith(prefix + '/'))?.[1]

// pending = page held back but no loader yet (the first GRACE_MS); loading = the loader is up.
// waiting = a link was clicked: the old page stays as it is until the new one arrives.
type Phase = 'waiting' | 'pending' | 'loading' | 'leaving' | 'done'
// ohp-gate-hold / ohp-gate-cover (globals.css): the hidden page + the loader are server-rendered,
// so if the page's JavaScript never starts, pure CSS steps the loader aside after 10s - it can never
// trap anyone.

export default function PageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const [phase, setPhase] = useState<Phase>(() => (isGatedAppPage(pathname) ? 'pending' : 'done'))
  const [label, setLabel] = useState(() => labelFor(pathname))
  const root = useRef<HTMLDivElement>(null)
  const run = useRef(0)
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const open = useCallback(async (path: string) => {
    const id = ++run.current
    if (navTimer.current) { clearTimeout(navTimer.current); navTimer.current = null }
    if (!isGatedAppPage(path)) { setPhase('done'); return }
    setLabel(labelFor(path))
    const alive = () => run.current === id
    const started = Date.now()
    let shownAt = 0
    // Not ready by the end of the grace period -> now (and only now) the loader comes up.
    setPhase(p => (p === 'loading' ? p : 'pending'))
    const grace = setTimeout(() => { if (alive()) { shownAt = Date.now(); setPhase('loading') } }, GRACE_MS)
    await sleep(0)
    await untilQuiet(alive, started)
    if (!alive()) { clearTimeout(grace); return }
    await untilImagesIn(root.current)
    clearTimeout(grace)
    if (!alive()) return
    if (shownAt) {
      const left = MIN_SHOWN_MS - (Date.now() - shownAt)
      if (left > 0) await sleep(left)
      if (!alive()) return
      setPhase('leaving')
      requestAnimationFrame(() => reveal(root.current))
      await sleep(420)
      if (alive()) setPhase('done')
    } else {
      // Ready before the loader was needed: the page just appears (a quick rise, no logo).
      setPhase('done')
      requestAnimationFrame(() => reveal(root.current))
    }
  }, [])

  // Every new page (first load, link, router.push, back / forward). Layout effect: the loader is
  // up before the new page ever paints.
  useLayoutEffect(() => { countApiCalls(); (window as any).__ohpHydrated = 1 }, [])
  useLayoutEffect(() => { open(pathname) }, [pathname, open])

  // Cover the old page the moment a link to another app page is clicked.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // (Next's <Link> always cancels the browser's own navigation to do its client-side one, so a
      // cancelled click is normal here.)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return
      let url: URL
      try { url = new URL(a.href, window.location.href) } catch { return }
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (!isGatedAppPage(url.pathname)) return
      run.current++
      setLabel(labelFor(url.pathname))
      // Hold the old page still; the loader only appears if the new one takes a moment.
      setPhase('waiting')
      const clickRun = run.current
      setTimeout(() => { if (run.current === clickRun) setPhase(p => (p === 'waiting' ? 'loading' : p)) }, GRACE_MS)
      if (navTimer.current) clearTimeout(navTimer.current)
      // The link never went anywhere (an unsaved-changes prompt, a button-like link...) - let go.
      // A slow page that does arrive later is simply covered again by the path change.
      // (Before 10/09 this let go after 5s even when the page was merely slow, so the agent saw the
      // old page again and the click looked ignored - now it keeps waiting while Next is still fetching it.)
      const clickedAt = Date.now()
      const check = () => {
        if (window.location.pathname === url.pathname) return
        if (pageFetches > 0 && Date.now() - clickedAt < NAV_SLOW_MS) { navTimer.current = setTimeout(check, 500); return }
        open(window.location.pathname)
      }
      navTimer.current = setTimeout(check, NAV_WAIT_MS)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [open])

  return (
    <>
      <div ref={root} className={`flex flex-1 flex-col ${phase === 'loading' || phase === 'pending' ? 'ohp-gate-hold' : ''}`}>
        {children}
      </div>
      {/* 'pending' too (10/24, iPhone Safari): a page opened in a NEW TAB is a full load - its
          server HTML arrives with the page held hidden, and until all of its JavaScript has
          downloaded and started there was nothing else on screen: a black page (dark mode) for
          seconds on a phone, for good if a script never arrived. The loader is now in that first
          HTML, fading in after the same short grace (CSS, no JavaScript needed), so a fast page
          still just appears and a slow one shows the house loader from the first second. */}
      {(phase === 'pending' || phase === 'loading' || phase === 'leaving') && (
        <div aria-hidden={phase === 'leaving'}
          className={`fixed inset-0 z-40 transition-all duration-[400ms] ease-out ${phase === 'leaving' ? 'pointer-events-none scale-[1.03] opacity-0' : phase === 'pending' ? 'ohp-gate-cover ohp-gate-pending' : 'ohp-gate-cover opacity-100'}`}>
          <OhpLoader label={label} />
        </div>
      )}
    </>
  )
}
