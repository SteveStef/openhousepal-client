// llms.txt for an agent's IDX site (proxy.ts rewrites <agent-domain>/llms.txt here): a plain
// summary of who the agent is and the site's main pages - towns, articles - for AI search tools
// (ChatGPT, Perplexity, Google AI answers) that read it, the way search engines read sitemap.xml.
// Same facts and the same "hide me" switch as the sitemap.

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'

async function json(url: string) {
  const res = await fetch(url, { next: { revalidate: 300 } })
  return res.ok ? res.json() : null
}

const line = (s: string) => String(s || '').replace(/\s+/g, ' ').trim()

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host: rawHost } = await params
  const host = decodeURIComponent(rawHost)
  const resolved = await json(`${INTERNAL_API_URL}/public/sites/resolve?host=${encodeURIComponent(host)}&path=`)
  if (!resolved?.site_id || resolved.published_snapshot?.seo?.allow_indexing === false) return new Response('Not found', { status: 404 })
  const origin = `https://${resolved.canonical_hostname || host}`
  const [profile, areas, blog, reviews] = await Promise.all([
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/profile`),
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/areas`),
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/blog?limit=50`),
    json(`${INTERNAL_API_URL}/public/sites/${resolved.site_id}/reviews`),
  ])
  const seo = resolved.published_snapshot?.seo || {}
  const name = line(profile?.name || seo.site_name || resolved.subdomain_slug)
  const who = [profile?.title, profile?.brokerage ? `with ${profile.brokerage}` : '', profile?.market ? `serving ${profile.market}` : ''].filter(Boolean).join(' ')
  const out: string[] = [`# ${name}`, '', `> ${line(seo.description || `${name}${who ? `, ${who}` : ''} - homes for sale, neighborhood guides, market data and local real estate advice.`)}`, '']
  const contact = [profile?.phone ? `Phone: ${profile.phone}` : '', profile?.email ? `Email: ${profile.email}` : '', profile?.license_number ? `License: ${profile.license_number}` : ''].filter(Boolean)
  if (contact.length) out.push(contact.join(' · '), '')
  // Same rule as the Google data: a rating only when it's safe to share (profile.google_rating).
  const rated = seo.share_rating !== false ? profile?.google_rating : null
  if (reviews?.show && rated?.count) out.push(`Client reviews: ${rated.count}, average ${Number(rated.average).toFixed(1)} of 5 (${origin}/testimonials)`, '')
  out.push('## Main pages', '',
    `- [Search homes for sale](${origin}/search): every active listing in the area, live from the MLS`,
    `- [Featured homes](${origin}/properties)`,
    `- [Neighborhood guides](${origin}/neighborhoods)`,
    `- [Articles & market updates](${origin}/blog)`,
    `- [What's my home worth? (free home value)](${origin}/home-value)`,
    `- [About ${name}](${origin}/about)`,
    `- [Contact](${origin}/contact)`, '')
  const towns = Array.isArray(areas) ? areas : []
  if (towns.length) {
    out.push('## Neighborhoods', '')
    for (const a of towns) {
      const facts = [a.active_count ? `${a.active_count} homes for sale` : '', a.median_price ? `median list price $${Math.round(a.median_price).toLocaleString('en-US')}` : ''].filter(Boolean).join(', ')
      out.push(`- [${a.name}${a.state ? `, ${a.state}` : ''}](${origin}/${a.slug})${facts ? `: ${facts}` : ''}`)
    }
    out.push('')
  }
  const posts = blog?.posts || []
  if (posts.length) {
    out.push('## Articles', '')
    for (const p of posts) out.push(`- [${line(p.title)}](${origin}/blog/${p.slug})${p.subtitle ? `: ${line(p.subtitle)}` : ''}`)
    out.push('')
  }
  return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
