// Type-only re-export - erased entirely at build time, so this adds zero runtime bundle cost
// to the public renderer despite pulling from the shared frontend/types/index.ts. Keeps one
// source of truth (avoids drift between the editor and the public renderer) without violating
// the isolation principle, which is about runtime code/network calls, not type definitions.
export type { SiteBlockType, SiteBlock, SitePage, SiteTheme, SiteContent } from '@/types'

import { SiteTheme } from '@/types'

export const DEFAULT_SITE_THEME: SiteTheme = {
  primary_color: '#111827',
  secondary_color: '#C9A24D',
  heading_font: 'serif',
  body_font: 'sans',
  logo_url: null,
  // Sites saved before the template field existed render as Luxe (what they always looked like).
  template: 'luxe',
  mode: 'light',
  allow_mode_toggle: true,
  footer_signature: false,
}

// Every field a plain query string value (App Router's searchParams shape) - 'q' is the hero's
// free-text box, everything else backs the Search tab's own Zillow-style filter bar (see
// PropertyMapSearch) and is forwarded straight through to content_adapters.get_search_results,
// which gives explicit filters precedence over anything parsed out of 'q'.
export interface SearchFilterParams {
  q?: string
  min_price?: string
  max_price?: string
  min_beds?: string
  min_baths?: string
  property_type?: string
  min_sqft?: string
  max_sqft?: string
  min_acres?: string
  min_year_built?: string
  school_district?: string
  sort?: string
  include_rentals?: string
  // A drawn map area (Search "Draw"): "lat,lng;lat,lng;..." - see backend geography.polygon_from_param.
  area?: string
  // Blog index's category filter - reuses this same shared searchParams shape rather than a
  // second per-page params type, since Next.js hands every page the same raw query-string object.
  category?: string
  // Neighborhood Compare reserved route.
  areas?: string
  first?: string
  // Direct form links are bare by default; IDX-owned buttons can opt into site chrome.
  site_chrome?: string
  // Campaign token (Forms Campaigns) - which separately-tracked link this form visit came from.
  c?: string
}
