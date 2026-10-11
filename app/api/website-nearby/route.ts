import { NextRequest, NextResponse } from 'next/server'

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8080'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const siteId = params.get('site_id') || ''
  const kind = params.get('kind') || ''
  const category = params.get('category') || ''
  const radiusMiles = params.get('radius_miles')

  if (!siteId || !kind) {
    return NextResponse.json({ detail: 'Missing required nearby search parameters.' }, { status: 422 })
  }

  // Spotlight (single-property) sites live in a separate table/id-space from the older
  // website-builder Site model, so they get their own backend prefix - everything else about
  // this proxy (budget gating, response shape) is identical either way.
  const base = kind === 'property_site' ? '/public/property-sites' : '/public/sites'

  if (kind === 'availability' || kind === 'property_site_availability') {
    const prefix = kind === 'property_site_availability' ? '/public/property-sites' : '/public/sites'
    const res = await fetch(`${INTERNAL_API_URL}${prefix}/${encodeURIComponent(siteId)}/nearby/availability`, {
      cache: 'no-store',
    })
    const body = await res.json()
    return NextResponse.json(body, { status: res.status })
  }

  if (kind === 'place_details' || kind === 'property_site_place_details') {
    const prefix = kind === 'property_site_place_details' ? '/public/property-sites' : '/public/sites'
    const placeId = params.get('place_id') || ''
    if (!placeId) return NextResponse.json({ detail: 'Missing place ID.' }, { status: 422 })
    const res = await fetch(`${INTERNAL_API_URL}${prefix}/${encodeURIComponent(siteId)}/places/${encodeURIComponent(placeId)}/details`, {
      cache: 'no-store',
    })
    const body = await res.json()
    return NextResponse.json(body, { status: res.status })
  }

  if (!category) return NextResponse.json({ detail: 'Missing nearby category.' }, { status: 422 })

  const qs = new URLSearchParams({ category })
  if (radiusMiles) qs.set('radius_miles', radiusMiles)

  let path: string | null = null
  if (kind === 'area') {
    const slug = params.get('slug') || ''
    if (!slug) return NextResponse.json({ detail: 'Missing area slug.' }, { status: 422 })
    path = `${base}/${encodeURIComponent(siteId)}/areas/${encodeURIComponent(slug)}/nearby`
  } else if (kind === 'property') {
    const listingKey = params.get('listing_key') || ''
    if (!listingKey) return NextResponse.json({ detail: 'Missing listing key.' }, { status: 422 })
    path = `${base}/${encodeURIComponent(siteId)}/properties/${encodeURIComponent(listingKey)}/nearby`
  } else if (kind === 'property_site') {
    // A Spotlight site's real coordinates are already scoped by its own id - no listing_key
    // needed (a manual/non-MLS listing has no Property row to key off in the first place).
    path = `${base}/${encodeURIComponent(siteId)}/nearby`
  }

  if (!path) return NextResponse.json({ detail: 'Unsupported nearby search kind.' }, { status: 422 })

  const res = await fetch(`${INTERNAL_API_URL}${path}?${qs.toString()}`, { cache: 'no-store' })
  const body = await res.json()
  return NextResponse.json(body, { status: res.status })
}
