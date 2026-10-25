import { NextRequest, NextResponse } from 'next/server'

// The listing agent as a phone contact (photo included) for a Spotlight's "Save contact" - a plain
// link to this same-origin route, so a phone opens it straight into "Create New Contact" on any
// address the Spotlight is served from (see backend public_property_site_routes.property_site_vcard).
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  try {
    const res = await fetch(`${INTERNAL_API_URL}/public/property-sites/${encodeURIComponent(siteId)}/vcard`, { cache: 'no-store' })
    if (!res.ok) return NextResponse.json({ detail: 'Contact not available.' }, { status: res.status })
    const body = await res.arrayBuffer()
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': res.headers.get('content-disposition') || 'attachment; filename="contact.vcf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ detail: 'Could not reach the server. Please try again.' }, { status: 502 })
  }
}
