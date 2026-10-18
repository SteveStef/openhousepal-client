'use client'

import NearbyMap from '@/components/maps/NearbyMap'
import type { NearbyKind } from '@/components/maps/useNearby'
import { SiteTheme } from './types'

// Explore Nearby as its own section - the IDX town page, and a Spotlight whose Location section is
// hidden. Everywhere else it lives on the home's Location map. Same map + picker either way
// (components/maps/NearbyMap); every Places lookup goes through our backend's budget-gated proxy
// (components/maps/useNearby), never straight from the browser to Google.
export default function ExploreNearby({
  siteId,
  kind,
  slug,
  listingKey,
  title,
  originLabel,
  origin,
  theme,
  variant = 'light',
  embedded = false,
}: {
  siteId: string
  kind: NearbyKind
  slug?: string
  listingKey?: string
  title: string
  originLabel: string
  origin?: { lat: number; lng: number } | null
  theme: SiteTheme
  // 'dark' for dark page templates (Spotlight's Cinematic Luxury) - same content, dark surfaces.
  variant?: 'light' | 'dark'
  /** Inside a page section that already sets the width and padding (the town page). */
  embedded?: boolean
}) {
  const dark = variant === 'dark'
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return null
  return (
    <section id="explore-nearby" className={embedded ? '' : 'mx-auto max-w-6xl px-4 pb-14 sm:px-6'}>
      <div className={`rounded-[1.25rem] border p-4 shadow-sm sm:p-7 ${dark ? 'border-white/10 bg-[#111111]' : 'border-gray-100 bg-white dark:border-white/10 dark:bg-white/[0.03]'}`}>
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: theme.secondary_color }}>Explore Nearby</p>
        <h2 className={`ohp-site-heading mt-2 text-2xl font-black sm:text-3xl ${dark ? 'text-white' : ''}`} style={dark ? undefined : { color: 'var(--site-heading)' }}>{title}</h2>
        <p className={`mt-1.5 text-sm ${dark ? 'text-white/60' : 'text-gray-500 dark:text-white/60'}`}>Restaurants, coffee, parks and everyday essentials near {originLabel}.</p>
        <div className="mt-5">
          <NearbyMap latitude={origin.lat} longitude={origin.lng} accent={theme.secondary_color || '#C9A24D'} dark={dark ? true : undefined} tone={dark ? 'dark' : 'auto'}
            siteId={siteId} kind={kind} slug={slug} listingKey={listingKey} originLabel={originLabel}
            showHome={kind !== 'area'}
            boxClassName={`relative h-[280px] w-full overflow-hidden rounded-2xl border sm:h-[380px] ${dark ? 'border-white/10' : 'border-gray-100 dark:border-white/10'}`} />
        </div>
      </div>
    </section>
  )
}
