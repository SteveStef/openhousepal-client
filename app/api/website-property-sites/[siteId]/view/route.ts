import { NextRequest, NextResponse } from 'next/server'

// Same-origin visit beacon for a published Listing Spotlight page - identical CORS reasoning to
// the inquiry/tour-request routes next to this one: a Spotlight site is served on an
// agent-owned hostname, so the visitor's browser posts here (same origin as the page) rather
// than cross-origin to the backend. Cookies are forwarded both ways so the backend's soft
// per-browser `ohp_vid` id stays stable across visits - that id is what "unique visitors" counts.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const ownerRef = request.nextUrl.searchParams.get('owner_ref') === '1'
  const cookie = request.headers.get('cookie')

  const res = await fetch(
    `${INTERNAL_API_URL}/public/property-sites/${encodeURIComponent(siteId)}/view${ownerRef ? '?owner_ref=1' : ''}`,
    {
      method: 'POST',
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
    },
  )
  const body = await res.json().catch(() => ({}))
  const out = NextResponse.json(body, { status: res.status })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) out.headers.set('set-cookie', setCookie)
  return out
}
