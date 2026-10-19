'use client'

// "Around a home I love": the home on a map with a soft circle around it in the site's colour - the
// circle grows / shrinks smoothly as the visitor picks how far to look, and the map keeps it framed.
import { useEffect, useRef, useState } from 'react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'

const MILE = 1609.34
const STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station.bus', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', stylers: [{ color: '#c9dcea' }] },
  { featureType: 'landscape', stylers: [{ color: '#f3f2ee' }] },
]

export default function RadiusMap({ lat, lng, miles, accent, className = '' }: { lat: number; lng: number; miles: number; accent: string; className?: string }) {
  const div = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const circle = useRef<google.maps.Circle | null>(null)
  const pin = useRef<google.maps.Marker | null>(null)
  const anim = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !div.current) return
      const m = new google.maps.Map(div.current, {
        center: { lat, lng }, zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false,
        gestureHandling: 'cooperative', styles: STYLE,
      })
      circle.current = new google.maps.Circle({
        map: m, center: { lat, lng }, radius: miles * MILE, clickable: false,
        strokeColor: accent, strokeOpacity: 0.95, strokeWeight: 2.5, fillColor: accent, fillOpacity: 0.14,
      })
      pin.current = new google.maps.Marker({
        map: m, position: { lat, lng },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: accent, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 },
      })
      setMap(m)
    }).catch(() => {})
    return () => { cancelled = true; circle.current?.setMap(null); pin.current?.setMap(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A new home: move there.
  useEffect(() => {
    if (!map) return
    circle.current?.setCenter({ lat, lng })
    pin.current?.setPosition({ lat, lng })
  }, [map, lat, lng])

  // How far: the circle eases to its new size, and the map follows it.
  useEffect(() => {
    if (!map || !circle.current) return
    const c = circle.current
    const from = c.getRadius(), to = miles * MILE
    const t0 = performance.now()
    if (anim.current) cancelAnimationFrame(anim.current)
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 520)
      const e = 1 - Math.pow(1 - k, 3)
      c.setRadius(from + (to - from) * e)
      if (k < 1) anim.current = requestAnimationFrame(step)
      else { const b = c.getBounds(); if (b) map.fitBounds(b, 18) }
    }
    anim.current = requestAnimationFrame(step)
    return () => { if (anim.current) cancelAnimationFrame(anim.current) }
  }, [map, miles, lat, lng])

  useEffect(() => { circle.current?.setOptions({ strokeColor: accent, fillColor: accent }) }, [accent])

  return <div ref={div} className={className} />
}
