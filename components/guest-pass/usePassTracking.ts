'use client'

import { useEffect } from 'react'
import api from '@/lib/api-service'
import { getToken } from '@/lib/token'

/**
 * Guest Pass activity for the agent's log (Visitors window -> Activity, user 10/24): a heartbeat
 * every 20s while the pass is on screen (how long each visit lasted, and return visits on other
 * days), plus a "used the map" line the first time a map on the pass is touched in a visit.
 * Homes / Cheat Sheet / Showcase / requests are logged by their own calls. Never runs for a
 * signed-in agent looking at a pass (that's not the guest).
 */
export function usePassTracking(token: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!token || !ready || typeof window === 'undefined') return
    if (getToken()) return
    const ping = () => { if (document.visibilityState === 'visible') api.public.guestPassPing(token).catch(() => {}) }
    ping()
    const t = window.setInterval(ping, 20000)
    const onVis = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVis)
    // Any map on the pass (Google map, or a container marked data-pass-map) - once per visit.
    let mapNoted = false
    const onPointer = (e: Event) => {
      if (mapNoted) return
      const el = e.target as HTMLElement | null
      if (!el?.closest?.('.gm-style, [data-pass-map], .maplibregl-map, .leaflet-container')) return
      mapNoted = true
      api.public.guestPassSeen(token, 'map').catch(() => {})
    }
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [token, ready])
}
