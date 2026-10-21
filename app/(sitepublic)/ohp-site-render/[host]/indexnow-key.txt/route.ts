// IndexNow key file for an agent's IDX site (proxy.ts rewrites <agent-domain>/indexnow-key.txt
// here). Each publish pings IndexNow (Bing, Yandex, Seznam...) with the changed pages - they check
// this file holds the same key to trust the ping. See backend google_search_service.ping_indexnow.

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function GET(_req: Request, { params }: { params: Promise<{ host: string }> }) {
  const { host: rawHost } = await params
  const host = decodeURIComponent(rawHost)
  const res = await fetch(`${INTERNAL_API_URL}/public/sites/resolve?host=${encodeURIComponent(host)}&path=`, { next: { revalidate: 300 } })
  const resolved = res.ok ? await res.json() : null
  if (!resolved?.indexnow_key) return new Response('Not found', { status: 404 })
  return new Response(resolved.indexnow_key, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
