// Runs once when the website server starts (every deploy). A few seconds later it opens every live
// IDX site itself - the home page, the pages linked from its menu, and the resized photos they show
// - so the slow "first visit after an update" is always us, never a real visitor (user, 10/19 -
// "can we just load it once ourselves first so nobody ever has a bad experience"). Production
// only; one page at a time so it never competes with real visitors. The backend does the same for
// its numbers (app_cache + warm_area_caches).

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production' || process.env.DISABLE_SELF_WARM === '1') return
  setTimeout(() => { selfWarm().catch(() => {}) }, 8000)
}

async function selfWarm() {
  const api = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL
  if (!api) return
  const base = `http://127.0.0.1:${process.env.PORT || '3000'}`
  // the API may still be starting after a joint deploy - give it a minute
  let hosts: string[] = []
  for (let i = 0; i < 6 && !hosts.length; i++) {
    try {
      const r = await fetch(`${api}/public/sites/warm-hosts`, { signal: AbortSignal.timeout(10000) })
      if (r.ok) hosts = ((await r.json()).hosts || []) as string[]
      else await wait(10000)
    } catch { await wait(10000) }
  }
  const started = Date.now()
  let pages = 0
  let photos = 0
  for (const host of hosts) {
    const html = await page(base, '/', host)
    if (html == null) continue
    pages++
    // the site's own menu pages (one level: /search, /neighborhoods, /about...)
    const links = Array.from(new Set(Array.from(html.matchAll(/href="(\/[a-z0-9-]+)"/gi)).map(m => m[1]))).slice(0, 6)
    const shown = [html]
    for (const path of links) {
      const h = await page(base, path, host)
      if (h != null) { pages++; shown.push(h) }
    }
    // the photos those pages show, made at their shown size now instead of on a visitor's phone
    const imgs = Array.from(new Set(shown.flatMap(h => Array.from(h.matchAll(/\/_next\/image\?url=[^"'\s)]+/g)).map(m => m[0].replace(/&amp;/g, '&'))))).slice(0, 40)
    for (const src of imgs) {
      try {
        const r = await fetch(base + src, { headers: { accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'x-forwarded-host': host }, signal: AbortSignal.timeout(20000) })
        await r.arrayBuffer()
        photos++
      } catch { /* next one */ }
    }
  }
  console.log(`[self-warm] ${hosts.length} sites, ${pages} pages, ${photos} photos in ${Math.round((Date.now() - started) / 1000)}s`)
}

async function page(base: string, path: string, host: string): Promise<string | null> {
  try {
    const r = await fetch(base + path, { headers: { 'x-forwarded-host': host, 'user-agent': 'OpenHousePal self-warm' }, signal: AbortSignal.timeout(30000) })
    return r.ok ? await r.text() : null
  } catch {
    return null
  }
}

function wait(ms: number) { return new Promise(res => setTimeout(res, ms)) }
