import { NextRequest, NextResponse } from 'next/server'

// "Open X's Showcase" in a follow-up's calendar event - the SHORT link (openhousepal.com/d/<code>/s,
// the same shape as the done link beside it). The full Showcase link on an agent's own domain is too
// wide for a phone line and the calendar app only linked the part before the wrap (user, 10/24), so
// the event carries this one and it forwards to the real Showcase (that home inside it, if any).
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Only the agent ever has this link (it's in their own calendar), so it opens the Showcase here on
// the app's address - where they're signed in, so they get the "You're seeing X's Showcase" bar and
// the way back to OpenHousePal - not on their own domain (user, 10/28). There it runs inside a
// frame, and phones keep the openhousepal.com sign-in out of frames, so it looked like a client.
function onAppAddress(url: string, request: NextRequest): string {
  try {
    const u = new URL(url)
    if (!u.pathname.startsWith('/showcase/')) return url
    const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim()
    if (!host) return url
    const proto = (request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '')).split(',')[0].trim()
    return `${proto}://${host}${u.pathname}${u.search}`
  } catch {
    return url
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const res = await fetch(`${INTERNAL_API_URL}/public/followups/${encodeURIComponent(code)}/showcase`, { cache: 'no-store' })
  const data = res.ok ? await res.json().catch(() => null) : null
  const url = typeof data?.url === 'string' && /^https?:\/\//i.test(data.url) ? data.url : null
  if (!url) {
    return new NextResponse("This Showcase link isn't active anymore.", {
      status: res.ok ? 404 : res.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const out = NextResponse.redirect(onAppAddress(url, request), 302)
  out.headers.set('Cache-Control', 'no-store')
  return out
}
