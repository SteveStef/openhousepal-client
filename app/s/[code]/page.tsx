import { notFound, redirect } from 'next/navigation'

// Short, personal Showcase links - openhousepal.com/s/dana-k7q2 (backend services/showcase_links.py).
// Sends the client on to their Showcase, keeping anything after the code (e.g. ?property=… from a
// follow-up text). The long /showcase/coll-… links keep working as before.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export const dynamic = 'force-dynamic'

export default async function ShortShowcaseLink({ params, searchParams }: {
  params: Promise<{ code: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { code } = await params
  const sp = await searchParams
  let token: string | null = null
  try {
    const res = await fetch(`${INTERNAL_API_URL}/collections/short/${encodeURIComponent(code)}`, { cache: 'no-store' })
    if (res.ok) token = (await res.json())?.share_token || null
  } catch { /* fall through to not found */ }
  if (!token) notFound()
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') q.set(k, v)
    else if (Array.isArray(v) && v[0]) q.set(k, v[0])
  }
  redirect(`/showcase/${encodeURIComponent(token)}${q.toString() ? `?${q}` : ''}`)
}
