import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// Called by the IDX website editor right after a publish, a town added/removed/reordered, or a
// reviews switch, so the live site shows it on the next visit instead of after the 30-second cache
// window (agents opened their site straight after "Your website is live" and saw the old version).
// Only expires cached site lookups - the worst a stray call can do is one extra fetch per page.
export async function POST() {
  revalidateTag('idx-sites', { expire: 0 })
  revalidateTag('town-pages', { expire: 0 })
  return NextResponse.json({ ok: true })
}
