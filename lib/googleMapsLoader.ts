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
// free allowance (owner rule, 11/09: Google free tier only). Any answer but "over the cap" (offline,
// server busy) keeps Google: the cap is a money guard, never a reason for a broken page.
async function mapAllowed(): Promise<boolean> {
  if (!API) return true
  try {
    const r = await fetch(`${API}/public/sites/maps/allow`, { method: 'POST', keepalive: true })
    return r.status !== 429
  } catch {
    return true
  }
}

// Over the cap, maps don't disappear any more (owner, 11/10): the same maps draw on the free
// OpenFreeMap street map instead (lib/freeMap/shim.ts) - same pins, shapes, buttons and colors.
// The choice is made once per page load: every map on a page is the same kind (a Google map and
// a free map can't share pins), and free maps aren't counted. `?freemap=1` (or localStorage
// ohp-free-map=1) shows the free map on purpose - for checking it; it only ever saves money.
let mode: Promise<'google' | 'free'> | null = null

function forcedFree(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get('freemap') === '1') return true
    return window.localStorage.getItem('ohp-free-map') === '1'
  } catch {
    return false
  }
}

async function useFreeMap(g: typeof google) {
  const { installFreeMaps } = await import('./freeMap/shim')
  installFreeMaps(g)
}

export class MapBudgetError extends Error {
  constructor() { super('Google map limit reached for now') }
}

export const googleMapsLoader = {
  /** Google's script, ready to draw a map (a Google one, or the free one once this month's are used). */
  async load() {
    if (!mode) {
      mode = (async () => (forcedFree() || !(await mapAllowed()) ? 'free' : 'google'))()
      const m = await mode
      const g = await loader.load()
      if (m === 'free') await useFreeMap(g)
      return g
    }
    const m = await mode
    const g = await loader.load()
    if (m === 'free') await useFreeMap(g)
    else void mapAllowed() // every further Google map on the page is counted too
    return g
  },
  /** Google's script for address look-ups only (Places) - not a map, so not counted against maps. */
  loadPlaces() {
    return loader.load()
  },
}

/** True once this page is drawing the free map (for a small "Map data" note, tests). */
export function usingFreeMap(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { google?: { maps?: { __ohpFree?: boolean } } }).google?.maps?.__ohpFree
}
