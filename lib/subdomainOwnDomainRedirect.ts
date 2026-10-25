// <slug>.openhousepal.com/<path> -> the same page on the agent's OWN connected domain (owner, 10/24:
// "both links work - the old openhousepal link redirects to your site").
//
// Same rules as lib/hubOwnDomainRedirect (the openhousepal.com/<hub-slug> forward):
//  - whether the domain counts is decided ONLY by the backend
//    (GET /public/sites/subdomain/<slug>/own-domain = the owner_links rule behind every shared link);
//  - only plain top-level page visits (never iframes, Studio previews, RSC/prefetch fetches, POSTs,
//    ?preview / ?embed, files like robots.txt or sitemap.xml);
//  - 307 + no-store, so switching the domain off stops the forward within a minute;
//  - any doubt, error or slow lookup = no redirect (the free address just keeps working).

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'
const NOT_AGENT = new Set(['www', 'app', 'api', 'sites', 'parse', 'mg', 'mail', 'admin', 'staging', 'dev'])
const STAY_PARAMS = ['preview', 'idx_light', 'idx_return', 'embed', 'ohp_template', 'ohp_mode']
const CACHE_MS = 60_000
const ERROR_CACHE_MS = 15_000
const LOOKUP_TIMEOUT_MS = 1_500

const cache = new Map<string, { until: number; value: Promise<string | null> }>()

function lookup(slug: string): Promise<string | null> {
  const now = Date.now()
  const hit = cache.get(slug)
  if (hit && now < hit.until) return hit.value
  if (cache.size > 5000) cache.clear()
  const value = fetch(`${INTERNAL_API_URL}/public/sites/subdomain/${encodeURIComponent(slug)}/own-domain`, {
    cache: 'no-store', signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  })
    .then(async res => {
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const base = typeof data?.own_domain === 'string' && /^https:\/\/[a-z0-9.-]+$/i.test(data.own_domain) ? data.own_domain : null
      return base
    })
    .catch(() => {
      cache.set(slug, { until: Date.now() + ERROR_CACHE_MS, value: Promise.resolve(null) })
      return null
    })
  cache.set(slug, { until: now + CACHE_MS, value })
  return value
}

type ReqLike = { method: string; headers: Headers; nextUrl: { pathname: string; search: string; searchParams: URLSearchParams } }

/** The own-domain URL for a visit to <slug>.openhousepal.com, or null to serve it here as usual. */
export async function subdomainOwnDomainTarget(hostWithoutPort: string, request: ReqLike): Promise<string | null> {
  const suffix = `.${OHP_BASE_DOMAIN}`
  if (!hostWithoutPort.endsWith(suffix)) return null
  const slug = hostWithoutPort.slice(0, -suffix.length)
  if (!slug || slug.includes('.') || NOT_AGENT.has(slug) || !/^[a-z0-9-]+$/.test(slug)) return null
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const h = request.headers
  if (h.get('next-url') || h.get('rsc') || h.get('next-router-prefetch') || h.get('next-router-state-tree') || h.get('next-action')) return null
  const dest = h.get('sec-fetch-dest')
  if (dest && dest !== 'document') return null
  if (STAY_PARAMS.some(p => request.nextUrl.searchParams.has(p))) return null
  const last = request.nextUrl.pathname.split('/').pop() || ''
  if (last.includes('.')) return null  // robots.txt, sitemap.xml, IndexNow key, images

  const base = await lookup(slug)
  if (!base) return null
  const target = new URL(base)
  // Coming from the own domain itself - stay, never loop.
  try {
    const ref = h.get('referer')
    const strip = (x: string) => x.toLowerCase().replace(/^www\./, '')
    if (ref && strip(new URL(ref).hostname) === strip(target.hostname)) return null
  } catch { /* unreadable referer - ignore */ }
  return `${target.origin}${request.nextUrl.pathname}${request.nextUrl.search}`
}
