import { Loader } from '@googlemaps/js-api-loader'

// Single shared Loader instance for the whole app. @googlemaps/js-api-loader throws if `new
// Loader(...)` is called more than once with different options (e.g. a different `libraries`
// list) after the first `.load()` - so every place that needs the Maps JS API (Places
// Autocomplete, the CMA comps map, anything future) must go through this one instance instead of
// constructing its own.
// 'drawing' (DrawingManager, for the Showcase editor's "Draw on Map" tool) and 'geometry'
// (poly.containsLocation/spherical helpers) add no billable cost - pure extra client-side JS from
// the same load, no additional Google API SKU (see the Showcase map-editor cost audit).
const loader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  version: 'weekly',
  libraries: ['places', 'maps', 'drawing', 'geometry'],
})

const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

// Every map shown is a billed Google "map load" in the browser, out of the server's sight - so each
// one is counted first (backend public_site_routes.allow_map_load) under a cap below Google's monthly
// free allowance (owner rule, 11/09: Google free tier only). Over the cap (429) load() rejects and the
// map just isn't drawn - every caller already shows its homes / text without it. Any other answer
// (offline, server busy) lets the map load: the cap is a money guard, never a reason for a broken page.
async function mapAllowed(): Promise<boolean> {
  if (!API) return true
  try {
    const r = await fetch(`${API}/public/sites/maps/allow`, { method: 'POST', keepalive: true })
    return r.status !== 429
  } catch {
    return true
  }
}

export class MapBudgetError extends Error {
  constructor() { super('Google map limit reached for now') }
}

export const googleMapsLoader = {
  async load() {
    if (!(await mapAllowed())) throw new MapBudgetError()
    return loader.load()
  },
}
