import { NextRequest, NextResponse } from 'next/server'

// Same-origin proxy to the backend's existing unauthenticated property-detail endpoint
// (public_site_routes.get_site_property) - same CORS rationale as
// app/api/website-search/school-districts/route.ts: a public site page can be served on any
// agent-owned hostname, so the browser must only ever talk to its own origin, never directly to
// INTERNAL_API_URL. Backs the Featured page's click-to-quick-view modal (see
// PropertyQuickViewModal) - the server-rendered /properties/{key} detail page itself doesn't need
// this (it already fetches server-side), only this client-side "pop up without navigating away"
// path does.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string; listingKey: string }> }) {
  const { siteId, listingKey } = await params
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/${encodeURIComponent(siteId)}/properties/${encodeURIComponent(listingKey)}`, {
    cache: 'no-store',
  })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}
