import type { MetadataRoute } from 'next'

const BASE =
  process.env.NEXT_PUBLIC_CLIENT_URL?.startsWith('https')
    ? process.env.NEXT_PUBLIC_CLIENT_URL
    : `https://${process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'}`
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export const revalidate = 3600

// Agent Hubs and forms on openhousepal.com are noindex (proxy.ts), but Google kept them as sitelinks
// under OpenHousePal's own result until it looks at them again (owner, 10/30). Listing them here for
// a while gets them re-checked sooner, so the noindex is seen and they drop out. The server stops
// returning them on its own after mid-December - then this is the marketing sitemap again.
async function recheckPaths(): Promise<string[]> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/agent-hub/public-recheck-paths`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.paths) ? data.paths : []
  } catch {
    return []
  }
}

// Premium agents' articles (owner, 10/30) - the ones the article page itself lets Google list
// (backend /agent-hub/public-blog-paths applies the same rules).
async function blogPosts(): Promise<{ path: string; lastmod?: string | null }[]> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/agent-hub/public-blog-paths`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.posts) ? data.posts : []
  } catch {
    return []
  }
}

// Marketing-site sitemap, plus Premium agents' articles. Each agent's published IDX site lives on its own subdomain /
// custom domain and should serve its own sitemap from the site renderer — that's a separate
// piece of work (see the checklist).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const [recheck, posts] = await Promise.all([recheckPaths(), blogPosts()])
  return [
    ...posts.map((p) => ({ url: `${BASE}${p.path}`, lastModified: p.lastmod ? new Date(p.lastmod) : now, changeFrequency: 'monthly' as const, priority: 0.6 })),
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...recheck.map((path) => ({ url: `${BASE}${path}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.1 })),
  ]
}
