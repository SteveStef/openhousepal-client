import { Loader } from '@googlemaps/js-api-loader'

// Single shared Loader instance for the whole app. @googlemaps/js-api-loader throws if `new
// Loader(...)` is called more than once with different options (e.g. a different `libraries`
// list) after the first `.load()` - so every place that needs the Maps JS API (Places
// Autocomplete, the CMA comps map, anything future) must go through this one instance instead of
// constructing its own.
// 'drawing' (DrawingManager, for the Showcase editor's "Draw on Map" tool) and 'geometry'
// (poly.containsLocation/spherical helpers) add no billable cost - pure extra client-side JS from
// the same load, no additional Google API SKU (see the Showcase map-editor cost audit).
export const googleMapsLoader = new Loader({
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  version: 'weekly',
  libraries: ['places', 'maps', 'drawing', 'geometry'],
})
