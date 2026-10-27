'use client'

import { mapsSearchHref, openInAppleMaps } from '@/lib/mapsLink'

// A place's name/button that opens it in Google Maps (Apple Maps on Apple devices) - usable from
// server-rendered town page parts, which can't attach the Apple Maps click swap themselves.
export default function MapsLink({ place, near, className, style, children, label }: {
  place: string; near?: (string | null | undefined)[]; className?: string; style?: React.CSSProperties; children: React.ReactNode; label?: string
}) {
  const parts = [place, ...(near || [])]
  return (
    <a href={mapsSearchHref(...parts)} onClick={e => openInAppleMaps(e, ...parts)} target="_blank" rel="noopener noreferrer"
      aria-label={label || `${place} on the map`} className={className} style={style}>
      {children}
    </a>
  )
}
