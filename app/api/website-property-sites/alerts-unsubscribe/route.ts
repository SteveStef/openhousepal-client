import { NextRequest, NextResponse } from 'next/server'

// One-click "stop these emails" from a Spotlight alert email - same-origin proxy to
// backend/app/api/public_property_site_routes.py's /alerts/unsubscribe.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || ''
  try {
    const res = await fetch(`${INTERNAL_API_URL}/public/property-sites/alerts/unsubscribe?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    return NextResponse.json(body, { status: res.status })
  } catch {
    return NextResponse.json({ detail: 'Could not reach the server. Please try again.' }, { status: 502 })
  }
}
