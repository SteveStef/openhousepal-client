import { NextRequest, NextResponse } from 'next/server'

// "Save to your contacts" link in a follow-up's calendar event. Served from the app's own domain
// (the same one as the done link beside it) and proxied server-to-server to the backend, which
// builds the vCard live - the phone opens it straight into Create New Contact, notes included.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const forwardedFor = request.headers.get('x-forwarded-for')
  const res = await fetch(`${INTERNAL_API_URL}/public/followups/${encodeURIComponent(code)}/contact.vcf`, {
    cache: 'no-store',
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : undefined,
  })
  if (!res.ok) {
    return new NextResponse("This contact link isn't active anymore.", {
      status: res.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return new NextResponse(await res.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': res.headers.get('content-disposition') || 'inline; filename="contact.vcf"',
      'Cache-Control': 'no-store',
    },
  })
}
