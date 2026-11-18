// An agent's own domain while their IDX website is switched off (backend GET /public/sites/hub-domain
// decides; this file only maps paths). Three answers (owner, 11/18 - an agent's domain advertises
// them, never OpenHousePal):
//   slug      - the domain shows their Agent Hub by itself
//   forwardTo - "Turn my domain off completely": every visit forwards to their openhousepal.com Hub
//   dead      - their domain, but no live Hub to show: a plain "not available" page Google drops
// Fails open: any doubt and the domain answers the way it always did.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const CACHE_MS = 60_000

export type HubOnlyDomain = { slug: string | null; forwardTo: string | null; dead: boolean }
const NONE: HubOnlyDomain = { slug: null, forwardTo: null, dead: false }
const cache = new Map<string, { until: number; value: Promise<HubOnlyDomain> }>()

async function lookup(host: string): Promise<HubOnlyDomain> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/public/sites/hub-domain?host=${encodeURIComponent(host)}`, { cache: 'no-store', signal: AbortSignal.timeout(1500) })
    if (!res.ok) return NONE
    const data = await res.json()
    return {
      slug: typeof data?.hub_slug === 'string' ? data.hub_slug : null,
      forwardTo: typeof data?.forward_to === 'string' && /^https?:\/\//.test(data.forward_to) ? data.forward_to : null,
      dead: data?.dead === true,
    }
  } catch {
    return NONE
  }
}

export function hubOnlyDomain(host: string): Promise<HubOnlyDomain> {
  const hit = cache.get(host)
  if (hit && hit.until > Date.now()) return hit.value
  const value = lookup(host)
  cache.set(host, { until: Date.now() + CACHE_MS, value })
  if (cache.size > 2000) cache.clear()
  return value
}

/** The website's short addresses -> the hub's own pages. */
export function hubOnlyPath(pathname: string, slug: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0]?.toLowerCase() === slug) return pathname
  if (!parts.length || parts[0] === 'hub' || parts[0] === 'about' || parts[0] === 'contact') return `/${slug}`
  if (parts[0] === 'forms' && parts[1]) return `/${slug}/${parts.slice(1).join('/')}`
  if (parts[0] === 'reviews' || parts[0] === 'testimonials') return `/${slug}/review`
  return `/${slug}/${parts.join('/')}`
}
