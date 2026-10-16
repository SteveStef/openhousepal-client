import { NextRequest, NextResponse } from 'next/server'

// Same-origin proxy to the backend's existing unauthenticated school-district autocomplete
// (properties_routes.search_school_districts_public) - same CORS rationale as
// app/api/website-forms/[formId]/route.ts: a public site page can be served on any agent-owned
// hostname, so the browser must only ever talk to its own origin, never directly to
// INTERNAL_API_URL. Backs the Search tab's school-district filter (see PropertyMapSearch).
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query') || ''
  if (!query.trim()) return NextResponse.json({ success: true, results: [] })

  const res = await fetch(`${INTERNAL_API_URL}/api/properties/school-districts/public?query=${encodeURIComponent(query)}`, {
    cache: 'no-store',
  })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}
