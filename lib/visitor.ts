'use client'

import { useEffect, useState } from 'react'

// A website visitor who signed in with Google One Tap (components/website-public/IdxOneTap): their
// name + email, kept in a first-party cookie on .openhousepal.com so every form on the agent's site
// (and the form windows it opens from openhousepal.com) fills them in. Never the Google token.
export const VISITOR_COOKIE = 'ohp_visitor'
export const VISITOR_EVENT = 'ohp-visitor'

export interface SiteVisitor { name: string; firstName: string; email: string }

export function readVisitor(): SiteVisitor | null {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find(c => c.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1)
  if (!raw) return null
  try {
    const v = JSON.parse(decodeURIComponent(raw))
    return v && typeof v.e === 'string' && v.e.includes('@') ? { name: String(v.n || ''), firstName: String(v.f || ''), email: v.e } : null
  } catch {
    return null
  }
}

/** Where the cookie lives: the whole openhousepal.com site in production, this host locally. */
function cookieDomain(): string {
  const h = typeof window !== 'undefined' ? window.location.hostname : ''
  return h === 'openhousepal.com' || h.endsWith('.openhousepal.com') ? '; domain=.openhousepal.com' : ''
}

export function saveVisitor(v: SiteVisitor) {
  const value = encodeURIComponent(JSON.stringify({ n: v.name, f: v.firstName, e: v.email }))
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `${VISITOR_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${cookieDomain()}${secure}`
}

/** Form answers this visitor can fill in (premade forms' question ids). */
export function visitorPrefill(v: SiteVisitor | null): Record<string, string> {
  if (!v) return {}
  const [first, ...rest] = (v.name || '').trim().split(/\s+/)
  return {
    full_name: v.name, name: v.name, email: v.email,
    ...(first ? { first_name: v.firstName || first } : {}),
    ...(rest.length ? { last_name: rest.join(' ') } : {}),
  }
}

/** The signed-in visitor, updating the moment One Tap finishes on this page. */
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
