import { NextRequest, NextResponse } from 'next/server'

// Same-origin doorway for the IDX property page's "Ask a question" box (public_site_routes.
// ask_about_site_property) - same reason as the GET next door: a site can live on any hostname,
// so the browser only ever talks to its own origin. The visitor's IP is passed along so the
// backend's per-visitor submit limit counts them, not this server.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; listingKey: string }> }) {
  const { siteId, listingKey } = await params
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/${encodeURIComponent(siteId)}/properties/${encodeURIComponent(listingKey)}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}) },
    body: JSON.stringify(await request.json().catch(() => ({}))),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  return NextResponse.json(body, { status: res.status })
}
