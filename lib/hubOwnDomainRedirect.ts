// openhousepal.com/<hub-slug>/... -> the same page on the agent's OWN connected domain.
//
// Once an IDX agent's own domain is fully working, every link the app hands out already uses it
// (backend site_service.owner_links). This forwards the old openhousepal.com/<slug> links too -
// printed QR codes, old signatures, bookmarks. Whether the domain counts is decided ONLY by the
// backend (GET /agent-hub/public/<slug>/own-domain = the owner_links rule, the same one behind the
// setup flow's "Your link now goes to your own domain" note); this file only maps paths.
//
// Never forwards (= the hub just opens here, exactly as before):
//  - anything that isn't a plain top-level page visit: iframes (the agent's own domain shows the hub
//    by framing openhousepal.com/<slug> - forwarding that would loop), Studio / setup live previews,
//    Next's in-app page fetches (RSC / prefetch), POSTs;
//  - ?preview=1, ?idx_light / ?idx_return (the own-domain frame), ?embed=1;
//  - a visit coming from the agent's own domain (an older browser's frame without Sec-Fetch-Dest);
//  - paths that have no matching page there, and whenever the lookup fails or is slow (fail open).
// 307 (temporary), never cached: if the agent disconnects or switches the domain off, the old link
// stops forwarding within CACHE_MS - a 301/308 would stay stuck in visitors' browsers.

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Top-level app pages outside proxy.ts's RESERVED_APP_SEGMENTS that still aren't Agent Hubs.
const NOT_A_HUB = new Set(['d', 'dev', 'dev-demos', 'i', 'ohp-site-render', 'open-house', 'spotlight-preview', 'spotlight-unsubscribe'])
// Query params that mean "this is a frame / preview / embed, not a visitor".
const STAY_PARAMS = ['preview', 'idx_light', 'idx_return', 'embed']
const CACHE_MS = 60_000
const ERROR_CACHE_MS = 15_000
const LOOKUP_TIMEOUT_MS = 1_500

type Lookup = { slug: string | null; base: string | null }
const cache = new Map<string, { until: number; value: Promise<Lookup> }>()

async function fetchLookup(slug: string): Promise<{ value: Lookup; ok: boolean }> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/agent-hub/public/${encodeURIComponent(slug)}/own-domain`, {
      cache: 'no-store', signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    })
    if (!res.ok) return { value: { slug: null, base: null }, ok: false }
    const data = await res.json()
    const base = typeof data?.own_domain === 'string' && /^https:\/\/[a-z0-9.-]+$/i.test(data.own_domain) ? data.own_domain : null
    const canonical = typeof data?.slug === 'string' && SLUG_RE.test(data.slug) ? data.slug : null
    return { value: { slug: canonical, base }, ok: true }
  } catch {
    return { value: { slug: null, base: null }, ok: false }
  }
}

/** The agent's own-domain base for this hub slug, cached per slug for a minute (fast hub loads). */
function lookup(slug: string): Promise<Lookup> {
  const now = Date.now()
  const hit = cache.get(slug)
  if (hit && now < hit.until) return hit.value
  if (cache.size > 5000) cache.clear()
  const value = fetchLookup(slug).then(r => {
    // a failed lookup is retried sooner
    if (!r.ok) cache.set(slug, { until: Date.now() + ERROR_CACHE_MS, value: Promise.resolve(r.value) })
    return r.value
  })
  cache.set(slug, { until: now + CACHE_MS, value })
  return value
}

/** Where openhousepal.com/<slug>/<rest> lives on the own domain (null = no matching page there).
 *  Short addresses the app hands out (site_service.OwnerLinks) where they show the same page;
 *  everything else at <domain>/<slug>/..., which the domain serves as the very same hub page
 *  (ohp-site-render HubAliasPage), query string and all. */
export function ownDomainPath(slug: string, rest: string[]): string | null {
  if (rest.length === 0) return '/hub'
  const [a, b] = rest
  if (rest.length === 1) {
    if (a === 'sales' || a === 'listings') return '/sales'  // Listings = the Sales page now
    if (a === 'review') return '/reviews'
    return `/${slug}/${a}`  // a form (keeps ?src=qr, ?c= campaign links) or the blog list
  }
  if (rest.length === 2 && a === 'blogs') return `/${slug}/blogs/${b}`
  return null
}

type ReqLike = { method: string; headers: Headers; nextUrl: { pathname: string; search: string; searchParams: URLSearchParams } }

/** The full own-domain URL to send this request to, or null to serve it here as usual. */
export async function hubOwnDomainTarget(request: ReqLike): Promise<string | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const h = request.headers
  // Next's in-app page fetches. Next strips RSC / Next-Router-* before the proxy sees them, but
  // Next-Url (sent with them) isn't; Sec-Fetch-Dest "empty" below catches them in every modern browser.
  if (h.get('next-url') || h.get('rsc') || h.get('next-router-prefetch') || h.get('next-router-state-tree') || h.get('next-action')) return null
  const dest = h.get('sec-fetch-dest')
  if (dest && dest !== 'document') return null
  if (STAY_PARAMS.some(p => request.nextUrl.searchParams.has(p))) return null

  const segments = request.nextUrl.pathname.split('/').filter(Boolean)
  const first = segments[0]?.toLowerCase()
  if (!first || NOT_A_HUB.has(first) || !SLUG_RE.test(first) || segments.length > 3) return null
  if (ownDomainPath(first, segments.slice(1)) === null) return null

  const { slug, base } = await lookup(first)
  if (!slug || !base) return null
  const path = ownDomainPath(slug, segments.slice(1))
  if (!path) return null

  // Coming from the agent's own domain (its frame in an older browser) - stay, never loop.
  const strip = (host: string) => host.toLowerCase().replace(/^www\./, '')
  const target = new URL(base)
  try {
    const ref = h.get('referer')
    if (ref && strip(new URL(ref).hostname) === strip(target.hostname)) return null
  } catch { /* unreadable referer - ignore */ }

  return `${target.origin}${path}${request.nextUrl.search}`
}
