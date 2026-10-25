import { NextRequest, NextResponse } from 'next/server'

// "Open X's Showcase" in a follow-up's calendar event - the SHORT link (openhousepal.com/d/<code>/s,
// the same shape as the done link beside it). The full Showcase link on an agent's own domain is too
// wide for a phone line and the calendar app only linked the part before the wrap (user, 10/24), so
// the event carries this one and it forwards to the real Showcase (that home inside it, if any).
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
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
  const out = NextResponse.redirect(url, 302)
  out.headers.set('Cache-Control', 'no-store')
  return out
}
