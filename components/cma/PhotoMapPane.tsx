'use client'

// Photos <-> Map for one home, made to feel instant (11/15; it used to swap one for the other and then wait
// for the map to load, with no transition):
//   - the photos and the map are both there; the switch is a quick cross-fade with a slight zoom;
//   - a picture of the map (drawn once by our server and kept) is fetched ahead and shows the moment the
//     agent switches, so there is never an empty box;
//   - the live map loads quietly in the background a moment after the pane appears, and fades in over the
//     picture when it is ready - by the time the agent taps Map it is usually already there.
import { createContext, useContext, useEffect, useState } from 'react'
import { buildCompLocationMapUrl } from '@/lib/cma'
import { preloadPhoto } from '@/components/cma/report/PhotoFlip'

/** The report id, for the server-drawn map pictures (only a report's own homes can be drawn). */
export const CmaMapRefContext = createContext<string | null>(null)

export default function PhotoMapPane({ showMap, lat, lng, label, zoom = 18, interactive = true, mapClassName = 'inset-x-0 top-0 h-72 rounded-xl border border-gray-200 dark:border-gray-800', className = '', children }: {
  showMap: boolean
  lat?: number | null
  lng?: number | null
  label: string
  zoom?: number
  /** false = the map can't be dragged (a small tile that opens the home's details on tap). */
  interactive?: boolean
  /** Where the map sits over the photos (the photo frame's box). */
  mapClassName?: string
  className?: string
  /** The photos. */
  children: React.ReactNode
}) {
  const mapRef = useContext(CmaMapRefContext)
  const hasGeo = typeof lat === 'number' && typeof lng === 'number'
  const [warm, setWarm] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [stillOk, setStillOk] = useState(true)
  const still = hasGeo && mapRef ? buildCompLocationMapUrl({ latitude: lat, longitude: lng }, '700x320', 17, mapRef) : null
  useEffect(() => { setLoaded(false); setStillOk(true) }, [lat, lng])
  useEffect(() => { if (still) preloadPhoto(still) }, [still])
  // The live map: at once when asked for, otherwise quietly a moment after this home is shown.
  useEffect(() => {
    if (!hasGeo) return
    if (showMap) { setWarm(true); return }
    const t = setTimeout(() => setWarm(true), 900)
    return () => clearTimeout(t)
  }, [showMap, hasGeo, lat, lng])
  const on = showMap && hasGeo
  return (
    <div className={`relative ${className}`}>
      <div className={`h-full transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${on ? 'pointer-events-none scale-[0.985] opacity-0' : 'opacity-100'}`} aria-hidden={on || undefined}>{children}</div>
      {hasGeo && (
        <div aria-hidden={!on || undefined}
          className={`absolute overflow-hidden bg-gray-100 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none dark:bg-[#0B0B0B] ${mapClassName} ${on ? 'opacity-100' : 'pointer-events-none scale-[1.02] opacity-0'}`}>
          {still && stillOk && <img src={still} alt="" onError={() => setStillOk(false)} className="absolute inset-0 h-full w-full object-cover" />}
          {warm && (
            <iframe
              title={`Map of ${label}`}
              src={`https://www.google.com/maps?q=${lat},${lng}&z=${zoom}&t=h&output=embed`}
              onLoad={() => setLoaded(true)}
              tabIndex={on ? 0 : -1}
              referrerPolicy="no-referrer-when-downgrade"
              className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${interactive ? '' : 'pointer-events-none'}`}
            />
          )}
        </div>
      )}
    </div>
  )
}
