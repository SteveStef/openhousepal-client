'use client'

import { useEffect } from 'react'
import api from '@/lib/api-service'
import { getToken } from '@/lib/token'

export type PassView = 'similar' | 'cheat' | 'showcase' | 'map' | 'nearby' | 'spotlight' | 'directions' | 'photos' | 'contact' | 'home_tour' | 'home_question'

// The agent opening their own guest's pass isn't the guest: nothing they do there is logged. Any other
// signed-in account is a real guest (a fellow agent can walk an open house too).
let muted = false
const signedInAs = (id?: string | null) => {
  const jwt = getToken()
  if (!jwt || !id) return false
  try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub === id } catch { return false }
}

/** One thing the guest did. Fire-and-forget. */
export function trackPass(token: string, view: PassView, key?: string | null, seconds?: number) {
  if (!muted) api.public.guestPassSeen(token, view, key, seconds).catch(() => {})
}

type Links = { agentId?: string | null; hub?: string | null; website?: string | null; spotlight?: string | null }
const bare = (url: string) => url.split(/[?#]/)[0].replace(/\/$/, '')
const sameLink = (href: string, target?: string | null) => !!target && bare(href) === bare(target)

/**
 * Guest Pass activity for the agent's log (Visitors -> Guest Activity, owner 11/07): a heartbeat every
 * 20s while the pass is on screen (how long each visit lasted, return visits), plus every tap that
 * means something, wherever it is on the pass: calling, texting or emailing the agent, their Hub and
 * website, the full tour, directions, What's Nearby, moving the map. Homes / Cheat Sheet / Showcase /
 * requests are logged by their own calls.
 */
export function usePassTracking(token: string | undefined, ready: boolean, links: Links) {
  const { agentId, hub, website, spotlight } = links
  useEffect(() => {
    if (!token || !ready || typeof window === 'undefined') return
    muted = signedInAs(agentId)
    if (muted) return
    const ping = () => { api.public.guestPassPing(token).catch(() => {}) }
    const beat = () => { if (document.visibilityState === 'visible') ping() }
    beat()
    const t = window.setInterval(beat, 20000)
    // One more beat as they leave or come back, so a visit's time isn't cut short by up to 20 seconds.
    document.addEventListener('visibilitychange', ping)
    window.addEventListener('pagehide', ping)

    // A real move of a map, not a thumb scrolling the page past it (that touch used to count as using it).
    let press: { x: number; y: number; scroll: number } | null = null
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      press = el?.closest?.('.gm-style, [data-pass-map], .maplibregl-map, .leaflet-container') ? { x: e.clientX, y: e.clientY, scroll: window.scrollY } : null
    }
    const onUp = (e: PointerEvent) => {
      if (!press) return
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y)
      const pin = (e.target as HTMLElement | null)?.closest?.('button, [role="button"]')
      if (Math.abs(window.scrollY - press.scroll) < 4 && (moved > 12 || pin)) trackPass(token, 'map')
      press = null
    }
    const onCancel = () => { press = null }

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null
      if (!el?.closest) return
      const near = el.closest<HTMLElement>('[data-nearby-cat]')
      if (near?.dataset.nearbyCat) { trackPass(token, 'nearby', near.dataset.nearbyCat); return }
      const a = el.closest<HTMLAnchorElement>('a[href]')
      if (!a) return
      const href = a.href
      if (href.startsWith('tel:')) trackPass(token, 'contact', 'call')
      else if (href.startsWith('sms:')) trackPass(token, 'contact', 'text')
      else if (href.startsWith('mailto:')) trackPass(token, 'contact', 'email')
      else if (sameLink(href, spotlight)) trackPass(token, 'spotlight')
      else if (sameLink(href, hub)) trackPass(token, 'contact', 'hub')
      else if (sameLink(href, website)) trackPass(token, 'contact', 'website')
      else if (/google\.[a-z.]+\/maps|maps\.google|maps\.apple/.test(href)) trackPass(token, 'directions')
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('pointercancel', onCancel, true)
    document.addEventListener('click', onClick, true)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', ping)
      window.removeEventListener('pagehide', ping)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('pointerup', onUp, true)
      document.removeEventListener('pointercancel', onCancel, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [token, ready, agentId, hub, website, spotlight])
}

// Time on each home this visit, kept across leaving and coming back to it.
const onHome = new Map<string, number>()

/** How long they stay on a home they opened (owner, 11/07: five seconds is what makes it an alert).
 *  Counts only while the page is on screen. Sent at five seconds, then every 20, and as they leave. */
export function useHomeTime(token: string | undefined, key: string | null | undefined, ready: boolean) {
  useEffect(() => {
    if (!token || !key || !ready) return
    let since: number | null = document.visibilityState === 'visible' ? Date.now() : null
    let spent = onHome.get(key) || 0
    let sent = Math.floor(spent / 1000)
    const total = () => Math.floor((spent + (since ? Date.now() - since : 0)) / 1000)
    const send = () => { const s = total(); if (s > sent) { sent = s; trackPass(token, 'similar', key, s) } }
    const tick = window.setInterval(() => { const s = total(); if ((s >= 5 && sent < 5) || s - sent >= 20) send() }, 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') { since = since ?? Date.now(); return }
      if (since) { spent += Date.now() - since; since = null }
      send()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', send)
    return () => {
      window.clearInterval(tick)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', send)
      if (since) spent += Date.now() - since
      since = null
      onHome.set(key, spent)
      send()
    }
  }, [token, key, ready])
}
