import { NextRequest, NextResponse } from 'next/server'

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'
const OHP_BASE_DOMAIN = process.env.NEXT_PUBLIC_OHP_BASE_DOMAIN || 'openhousepal.com'
// Local dev and the app's own hostnames (openhousepal.com/ohp-site-render/<host>) name the site in the page.
const LOCAL_TEST_HOSTS = new Set(['localhost', '127.0.0.1', OHP_BASE_DOMAIN, `www.${OHP_BASE_DOMAIN}`, `app.${OHP_BASE_DOMAIN}`])

function requestHostname(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = forwardedHost || request.headers.get('host') || ''
  return host.split(':')[0].toLowerCase()
}

async function resolveSiteId(request: NextRequest, formId: string) {
  const providedSiteId = request.nextUrl.searchParams.get('site_id')
  const hostname = requestHostname(request)
  if (LOCAL_TEST_HOSTS.has(hostname)) return providedSiteId

  const res = await fetch(`${INTERNAL_API_URL}/public/sites/resolve?host=${encodeURIComponent(hostname)}&path=forms/${encodeURIComponent(formId)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  const resolved = await res.json()
  if (providedSiteId && providedSiteId !== resolved?.site_id) return null
  return resolved?.site_id || null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  const siteId = await resolveSiteId(request, formId)
  if (!siteId) return NextResponse.json({ success: true })

  const payload = await request.json()
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/${encodeURIComponent(siteId)}/forms/${encodeURIComponent(formId)}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({ success: true }))
  return NextResponse.json(body, { status: res.status })
}
