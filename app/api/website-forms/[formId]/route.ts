import { NextRequest, NextResponse } from 'next/server'

// Same-origin proxy to the backend's site-scoped public form endpoints (see
// backend/app/api/public_site_routes.py). Exists purely to avoid a CORS problem: a public site
// page can be served on ANY agent-owned hostname, and the browser filling out a Form block needs
// to submit from that hostname - proxying through this Next.js route (same origin as whatever
// hostname served the page, since one Next.js app serves every OHP site) means the browser only
// ever talks to its own origin, and the actual cross-service call happens server-to-server via
// INTERNAL_API_URL, exactly like every other public site data fetch. This keeps
// backend/app/main.py's CORSMiddleware untouched - see the Website Builder Phase 1 plan's note
// on why widening allow_origins would be a real security downgrade (allow_credentials=True).
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'

export async function GET(request: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  const siteId = request.nextUrl.searchParams.get('site_id')
  if (!siteId) return NextResponse.json({ detail: 'site_id is required' }, { status: 400 })

  const res = await fetch(`${INTERNAL_API_URL}/public/sites/${encodeURIComponent(siteId)}/forms/${encodeURIComponent(formId)}`, {
    cache: 'no-store',
  })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  const siteId = request.nextUrl.searchParams.get('site_id')
  if (!siteId) return NextResponse.json({ detail: 'site_id is required' }, { status: 400 })

  const payload = await request.json()
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/${encodeURIComponent(siteId)}/forms/${encodeURIComponent(formId)}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}
