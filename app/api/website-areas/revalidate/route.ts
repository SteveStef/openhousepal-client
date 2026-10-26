import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// Called by the admin Neighborhoods tab right after a town is edited, so every IDX town page shows
// the change at once rather than after the 30-second cache window (the backend drops its own copies
// in admin_area_routes.forget_cached_town). Only expires cached town-page lookups - the worst a stray
// call can do is one extra fetch per town page.
export async function POST() {
  revalidateTag('town-pages', { expire: 0 })
  return NextResponse.json({ ok: true })
}
