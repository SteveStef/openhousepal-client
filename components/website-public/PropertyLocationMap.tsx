'use client'

import { useEffect, useRef, useState } from 'react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import { SiteTheme } from './types'

// A real single-pin map for the property detail page's Location section - reuses the same
// googleMapsLoader singleton and classic google.maps.Marker pattern already proven in
// PropertyMapSearch (AdvancedMarkerElement needs a Map ID this app doesn't provision).
export default function PropertyLocationMap({ latitude, longitude, address, theme }: {
  latitude: number
  longitude: number
  address?: string | null
  theme: SiteTheme
}) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !mapDivRef.current) return
      const map = new google.maps.Map(mapDivRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        zoomControl: true,
      })
      new google.maps.Marker({
        map,
        position: { lat: latitude, lng: longitude },
        title: address || 'Property location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: theme.secondary_color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude])

  if (loadError) {
    return <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">Map unavailable right now.</div>
  }
  return <div ref={mapDivRef} className="h-full w-full" />
}
