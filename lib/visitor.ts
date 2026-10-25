'use client'

import { useEffect, useState } from 'react'

// A website visitor the agent's site knows: signed in with Google One Tap (components/website-
// public/IdxOneTap), built a Showcase there, or opened their Showcase link on it. Their name, email
// and Showcase code live in a first-party cookie (on .openhousepal.com for the agent's free address,
// on the agent's own domain otherwise) - every form on the site fills them in, and the header shows
// "{first}'s Showcase" (SiteHeader). Never a Google token.
export const VISITOR_COOKIE = 'ohp_visitor'
export const VISITOR_EVENT = 'ohp-visitor'

export interface SiteVisitor {
  name: string
  firstName: string
  /** '' when the site only knows them from their Showcase link. */
  email: string
  /** Their Showcase's short code with this agent, when they have one. */
  showcase?: string
  /** Their phone, once they gave it in a Spotlight form (fills the other forms on the page). */
  phone?: string
}

function parse(raw: string | undefined | null): SiteVisitor | null {
  if (!raw) return null
  try {
    const v = JSON.parse(decodeURIComponent(raw))
    const email = typeof v?.e === 'string' && v.e.includes('@') ? v.e : ''
    const showcase = typeof v?.s === 'string' && /^[\w-]{3,80}$/.test(v.s) ? v.s : undefined
    if (!email && !showcase) return null
    const phone = typeof v?.p === 'string' && /^[\d\s()+.-]{7,24}$/.test(v.p) ? v.p : undefined
    return { name: String(v.n || ''), firstName: String(v.f || ''), email, ...(showcase ? { showcase } : {}), ...(phone ? { phone } : {}) }
  } catch {
    return null
  }
}

export function readVisitor(): SiteVisitor | null {
  if (typeof document === 'undefined') return null
  return parse(document.cookie.split('; ').find(c => c.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1))
}

/** The same, from a request's cookie value (the site's server-rendered pages). */
export function visitorFromCookie(value: string | undefined | null): SiteVisitor | null {
  return parse(value)
}

/** Where the cookie lives: the whole openhousepal.com site in production, this host otherwise. */
function cookieDomain(): string {
  const h = typeof window !== 'undefined' ? window.location.hostname : ''
  return h === 'openhousepal.com' || h.endsWith('.openhousepal.com') ? '; domain=.openhousepal.com' : ''
}

/** Saves what's known, keeping what was already there (a sign-in never forgets their Showcase). */
export function saveVisitor(v: Partial<SiteVisitor>) {
  const was = readVisitor()
  const next = {
    n: v.name || was?.name || '',
    f: v.firstName || was?.firstName || (v.name || was?.name || '').split(' ')[0] || '',
    e: v.email || was?.email || '',
    ...((v.showcase || was?.showcase) ? { s: v.showcase || was?.showcase } : {}),
    ...((v.phone || was?.phone) ? { p: v.phone || was?.phone } : {}),
  }
  const value = encodeURIComponent(JSON.stringify(next))
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${VISITOR_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${cookieDomain()}${secure}`
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(VISITOR_EVENT))
}

/** A Showcase link's short code ("/showcase/dana-k7q2" -> "dana-k7q2"). */
export function showcaseCodeOf(url: string | null | undefined): string | null {
  const m = /\/showcases?\/([\w-]{3,80})/.exec(url || '')
  return m ? m[1] : null
}

/** Form answers this visitor can fill in (premade forms' question ids). */
export function visitorPrefill(v: SiteVisitor | null): Record<string, string> {
  if (!v || !v.email) return {}
  const [first, ...rest] = (v.name || '').trim().split(/\s+/)
  return {
    full_name: v.name, name: v.name, email: v.email,
    ...(first ? { first_name: v.firstName || first } : {}),
    ...(rest.length ? { last_name: rest.join(' ') } : {}),
  }
}

/** The known visitor, updating the moment One Tap / the Showcase builder saves them on this page. */
export function useVisitor(): SiteVisitor | null {
  const [v, setV] = useState<SiteVisitor | null>(null)
  useEffect(() => {
    setV(readVisitor())
    const on = () => setV(readVisitor())
    window.addEventListener(VISITOR_EVENT, on)
    return () => window.removeEventListener(VISITOR_EVENT, on)
  }, [])
  return v
}
