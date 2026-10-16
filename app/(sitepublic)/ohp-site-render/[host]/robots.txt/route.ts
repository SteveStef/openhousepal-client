// robots.txt for an agent's IDX site (proxy.ts rewrites <agent-domain>/robots.txt here): points
// search engines at the sitemap, or keeps them out when the agent turned indexing off.

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host: rawHost } = await params
  const host = decodeURIComponent(rawHost)
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/resolve?host=${encodeURIComponent(host)}&path=`, { next: { revalidate: 300 } })
  const resolved = res.ok ? await res.json() : null
  if (!resolved?.site_id) return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } })
  const origin = `https://${resolved.canonical_hostname || host}`
  const off = resolved.published_snapshot?.seo?.allow_indexing === false
  const body = off
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\nDisallow: /forms/\nDisallow: /open-house/\nDisallow: /showcase/\nDisallow: /showcases/\nDisallow: /cma/\n\nSitemap: ${origin}/sitemap.xml\n`
  return new Response(body, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=300' } })
}
