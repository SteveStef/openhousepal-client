import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// Called by the Spotlight editor right after a publish/unpublish so the live page shows the new
// version (template switch included) immediately, rather than after the 30-second cache window.
// Only expires cached Spotlight lookups - the worst a stray call can do is one extra fetch.
export async function POST() {
  revalidateTag('property-sites', { expire: 0 })
  return NextResponse.json({ ok: true })
}
