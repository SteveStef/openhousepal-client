import { NextRequest, NextResponse } from 'next/server'

// The preview a texted link unfurls into (title, picture, site) - read from the page's own og: tags,
// the same ones iMessage reads. For the AI helper's "here's the link" cards (owner, 10/31).
// Only OpenHousePal's own pages: a path on this app, or an address on openhousepal.com / its
// subdomains (Spotlights) - never an arbitrary site.
const BASE = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'

function target(raw: string, req: NextRequest): URL | null {
  try {
    if (raw.startsWith('/') && !raw.startsWith('//')) return new URL(raw, req.nextUrl.origin)
    const u = new URL(raw)
    if (!/^https?:$/.test(u.protocol)) return null
    const h = u.hostname.toLowerCase()
    if (h === req.nextUrl.hostname || h === BASE || h.endsWith(`.${BASE}`)) return u
    return null
  } catch {
    return null
  }
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i')
  const m = html.match(re)
  const v = m ? (m[1] ?? m[2]) : null
  return v ? v.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : null
}

export async function GET(req: NextRequest) {
  const u = target(req.nextUrl.searchParams.get('u') || '', req)
  if (!u) return NextResponse.json({ error: 'not allowed' }, { status: 400 })
  try {
    const res = await fetch(u, { headers: { 'user-agent': 'OpenHousePal link preview', accept: 'text/html' }, next: { revalidate: 300 } })
    if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const html = (await res.text()).slice(0, 400_000)
    const title = meta(html, 'og:title') || html.match(/<title>([^<]*)<\/title>/i)?.[1] || null
    const image = meta(html, 'og:image')
    return NextResponse.json({
      title,
      description: meta(html, 'og:description'),
      image: image ? new URL(image, u).toString() : null,
      site: meta(html, 'og:site_name'),
    }, { headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 502 })
  }
}
