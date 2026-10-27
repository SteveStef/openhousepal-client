import type { MouseEvent } from 'react'

// "Take me there" for a place we only know by name + town (town page day-to-day places, transit,
// hospitals): Google Maps by default, Apple Maps on an iPhone / iPad / Mac Safari. Replaces links
// to the website the place was researched on - those were often wrong (user, 10/27).
// The href is always the Google link (the same on server and browser, so no hydration mismatch);
// the click handler swaps in Apple Maps on Apple devices.
const query = (parts: (string | null | undefined)[]) => parts.map(p => String(p || '').trim()).filter(Boolean).join(', ')

export function mapsSearchHref(...parts: (string | null | undefined)[]): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query(parts))}`
}

export function openInAppleMaps(e: MouseEvent<HTMLAnchorElement>, ...parts: (string | null | undefined)[]) {
  const ua = navigator.userAgent
  if (!/iPhone|iPad|iPod|Macintosh/.test(ua) || /Chrome|CriOS|FxiOS|Edg/.test(ua)) return
  e.preventDefault()
  window.open(`https://maps.apple.com/?q=${encodeURIComponent(query(parts))}`, '_blank', 'noopener')
}
