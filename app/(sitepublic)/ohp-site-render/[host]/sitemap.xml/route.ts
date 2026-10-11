// sitemap.xml for an agent's IDX site (proxy.ts rewrites <agent-domain>/sitemap.xml here). Lists
// the home page, every page-builder page, the built-in sections, each served town and each
// published article - so Google finds every page, including the ones it shows as sub-links.

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'

async function json(url: string) {
  const res = await fetch(url, { next: { revalidate: 300 } })
  return res.ok ? res.json() : null
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host: rawHost } = await params
  const host = decodeURIComponent(rawHost)
  const resolved = await json(`${INTERNAL_API_URL}/public/sites/resolve?host=${encodeURIComponent(host)}&path=`)
  if (!resolved?.site_id) return new Response('Not found', { status: 404 })
  const origin = `https://${resolved.canonical_hostname || host}`
  const snapshot = resolved.published_snapshot || {}
  if (snapshot.seo?.allow_indexing === false) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', { headers: { 'Content-Type': 'application/xml' } })
  }
  const [blog, areas, reviews, featured] = await Promise.all([
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/blog?limit=50`),
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`),
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/reviews`),
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/properties?limit=48`),
  ])
  const urls: { loc: string; lastmod?: string; priority: string }[] = [{ loc: origin, priority: '1.0' }]
  for (const slug of ['search', 'properties', 'neighborhoods', 'blog', 'home-value', 'about', 'contact']) urls.push({ loc: `${origin}/${slug}`, priority: '0.8' })
  if (reviews?.show) urls.push({ loc: `${origin}/testimonials`, priority: '0.7' })
  for (const p of snapshot.pages || []) if (!p.is_home && p.slug) urls.push({ loc: `${origin}/${p.slug}`, priority: '0.7' })
  for (const a of Array.isArray(areas) ? areas : []) if (a?.slug) urls.push({ loc: `${origin}/${a.slug}`, priority: '0.7' })
  for (const post of blog?.posts || []) if (post?.slug) urls.push({ loc: `${origin}/blog/${post.slug}`, lastmod: post.published_at || undefined, priority: '0.6' })
  // The Featured homes (a home with its own Spotlight redirects there, which Google follows).
  for (const l of Array.isArray(featured) ? featured : []) if (l?.listing_key) urls.push({ loc: `${origin}/properties/${encodeURIComponent(l.listing_key)}`, priority: '0.6' })
  const seen = new Set<string>()
  const unique = urls.filter(u => (seen.has(u.loc) ? false : (seen.add(u.loc), true)))
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map(u => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod.slice(0, 10))}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>\n`
  return new Response(body, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=300' } })
}
