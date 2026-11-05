// An agent's own domain while their IDX website is switched off: the domain shows their Agent Hub by
// itself (backend GET /public/sites/hub-domain decides; this file only maps paths). Fails open: any
// doubt and the domain answers the way it always did.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const CACHE_MS = 60_000
const cache = new Map<string, { until: number; slug: Promise<string | null> }>()

async function lookup(host: string): Promise<string | null> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/public/sites/hub-domain?host=${encodeURIComponent(host)}`, { cache: 'no-store', signal: AbortSignal.timeout(1500) })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.hub_slug === 'string' ? data.hub_slug : null
  } catch {
    return null
  }
}

export function hubOnlySlug(host: string): Promise<string | null> {
  const hit = cache.get(host)
  if (hit && hit.until > Date.now()) return hit.slug
  const slug = lookup(host)
  cache.set(host, { until: Date.now() + CACHE_MS, slug })
  if (cache.size > 2000) cache.clear()
  return slug
}

/** The website's short addresses -> the hub's own pages. */
export function hubOnlyPath(pathname: string, slug: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0]?.toLowerCase() === slug) return pathname
  if (!parts.length || parts[0] === 'hub') return `/${slug}`
  if (parts[0] === 'forms' && parts[1]) return `/${slug}/${parts.slice(1).join('/')}`
  if (parts[0] === 'reviews' || parts[0] === 'testimonials') return `/${slug}/review`
  return `/${slug}/${parts.join('/')}`
}
