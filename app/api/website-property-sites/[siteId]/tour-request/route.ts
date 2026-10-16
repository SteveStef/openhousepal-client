import { NextRequest, NextResponse } from 'next/server'

// Same-origin proxy to the backend's public property-site tour-request endpoint - see
// app/api/website-property-sites/[siteId]/inquiry/route.ts for the full CORS rationale.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ detail: 'Invalid request.' }, { status: 400 })
  }
  // A backend that's down/restarting (or answers with a non-JSON error page) must still come
  // back to the visitor's form as a clean error, never an unhandled 500 from this route.
  try {
    const res = await fetch(`${INTERNAL_API_URL}/public/property-sites/${encodeURIComponent(siteId)}/tour-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('x-forwarded-for') ? { 'X-Forwarded-For': request.headers.get('x-forwarded-for') as string } : {}),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })
    const body = await res.json().catch(() => ({}))
    return NextResponse.json(body, { status: res.status })
  } catch {
    return NextResponse.json({ detail: 'Could not reach the server. Please try again.' }, { status: 502 })
  }
}
