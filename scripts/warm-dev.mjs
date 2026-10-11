// Pre-compiles dev-server routes so the first click on each tab is fast.
// `next dev` compiles a route on its first request (5-10s each with webpack); this hits every
// dashboard route once, sequentially (parallel requests just thrash webpack), right after start.
// Usage: `npm run dev` in one terminal, `npm run warm` in another (it waits for the server).
// Dynamic routes use a placeholder id - the page still compiles even though its data 404s.

const BASE = process.env.WARM_BASE_URL || 'http://localhost:3000'

const ROUTES = [
  // Most-used first so they're ready soonest
  '/dash', '/showcases', '/leads', '/leads/tasks', '/open-houses', '/open-houses/my-listings',
  '/studio', '/settings', '/activity', '/assistant', '/discovery', '/agent-hub',
  '/leads/warmup',
  '/studio/cma', '/studio/cma/warmup',
  '/studio/design', '/studio/design/warmup',
  '/studio/blogs', '/studio/blogs/warmup',
  '/studio/media', '/studio/media/new', '/studio/media/warmup',
  '/studio/property-sites', '/studio/property-sites/warmup',
  '/studio/forms', '/studio/site', '/studio/website', '/studio/brand-kit', '/studio/calendar',
  '/studio/email-signature', '/studio/integrations', '/studio/reviews',
  '/studio/tools', '/studio/tools/buyer-cash-needed', '/studio/tools/seller-net-sheet',
  '/settings/subscription', '/settings/help',
  '/admin', '/checkout', '/broker-authorization',
  '/', '/login', '/register',
  // Public agent pages (placeholder slug - compiles the route even though there's no such agent)
  '/warmup', '/warmup/sales', '/warmup/listings', '/warmup/review', '/warmup/blogs', '/warmup/blogs/warmup',
]

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(BASE, { method: 'HEAD' })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error(`Dev server not reachable at ${BASE}`)
}

await waitForServer()
console.log(`[warm] Pre-compiling ${ROUTES.length} routes on ${BASE}...`)
const started = Date.now()
for (const route of ROUTES) {
  const t = Date.now()
  try {
    const res = await fetch(BASE + route, { redirect: 'manual' })
    await res.arrayBuffer()
    console.log(`[warm] ${String(res.status).padEnd(4)} ${((Date.now() - t) / 1000).toFixed(1).padStart(5)}s  ${route}`)
  } catch (err) {
    console.log(`[warm] ERR        ${route}  (${err.message})`)
  }
}
console.log(`[warm] Done in ${Math.round((Date.now() - started) / 1000)}s - tabs should open fast now.`)
