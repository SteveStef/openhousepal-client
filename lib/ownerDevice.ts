// "This browser is the agent's own" for their pages on OTHER domains (their IDX site, own domain,
// Spotlight subdomains) - owner, 11/13: no stat should count the agent themselves.
//
// On openhousepal.com the sign-in cookie already tells the server who's looking (backend
// utils/own_traffic). Other domains can't see that cookie, so the app's "View site" links add
// ?ohp_owner=1 and the site remembers it in this origin's localStorage (each agent's site is its own
// origin, so the mark only ever covers that agent's own pages). Trackers there then add owner_ref=1
// and the server leaves the visit out. Never set on openhousepal.com itself: every agent shares that
// origin, so a mark there would hide other agents' guests.

const KEY = 'ohp_owner_device'
// Spotlight's own older mark (SpotlightViewBeacon) - same meaning.
const LEGACY_KEYS = ['ohp_spotlight_owner']

function onSharedAppHost(): boolean {
  const h = window.location.hostname.toLowerCase()
  const base = (process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com').toLowerCase()
  return h === base || h === `www.${base}` || h === `app.${base}` || h === 'localhost' || h === '127.0.0.1'
}

/** True when this browser is the site owner's (marked from the app). Saves the mark on first sight. */
export function isOwnerDevice(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (onSharedAppHost()) return false
    if (new URLSearchParams(window.location.search).get('ohp_owner') === '1') {
      localStorage.setItem(KEY, '1')
      return true
    }
    return localStorage.getItem(KEY) === '1' || LEGACY_KEYS.some(k => localStorage.getItem(k) === '1')
  } catch {
    return false   // storage blocked: count as a normal visitor
  }
}

/** `url` with owner_ref=1 added when this is the owner's browser (for the site's tracking calls). */
export function withOwnerRef(url: string): string {
  return isOwnerDevice() ? `${url}${url.includes('?') ? '&' : '?'}owner_ref=1` : url
}

/** An app link to the agent's own page on another domain, marked so their visits aren't counted. */
export function markOwnerLink(url: string | null | undefined): string {
  if (!url) return url || ''
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://openhousepal.com')
    if (typeof window !== 'undefined' && u.origin === window.location.origin) return url   // same origin: the cookie covers it
    u.searchParams.set('ohp_owner', '1')
    return u.toString()
  } catch {
    return url
  }
}
