import { NextRequest, NextResponse } from 'next/server'

// Same-origin proxy to the backend's public "agent busy" read for a Spotlight page - the tour
// picker crosses out times the listing agent is already booked (see .../inquiry/route.ts for why
// Spotlight pages talk to same-origin proxies). Never fails the page: no data = nothing crossed out.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  try {
    const res = await fetch(`${INTERNAL_API_URL}/public/property-sites/${encodeURIComponent(siteId)}/agent-busy?days=14`, { cache: 'no-store' })
    const body = await res.json().catch(() => ({ busy: [] }))
    return NextResponse.json(res.ok ? body : { busy: [] })
  } catch {
    return NextResponse.json({ busy: [] })
  }
}
