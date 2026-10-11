import type { MetadataRoute } from 'next'

const BASE =
  process.env.NEXT_PUBLIC_CLIENT_URL?.startsWith('https')
    ? process.env.NEXT_PUBLIC_CLIENT_URL
    : `https://${process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'}`

// Marketing-site sitemap only. Each agent's published IDX site lives on its own subdomain /
// custom domain and should serve its own sitemap from the site renderer — that's a separate
// piece of work (see the checklist).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
