'use client'

// Puts a card (usually MapPropertyCard) next to a spot on a Google map and keeps it fully inside
// the map's visible area (10/25). Google's InfoWindow only pans the map when it can; on a short
// map, a phone, or a pin near the edge the bubble was cut off. This one:
// - sits above the pin when there's room, else below, else beside it; slides sideways (and up or
//   down when beside) so no edge is ever crossed - never covers the pin unless the map is smaller
//   than the card
// - when nothing fits around the pin, nudges the map once on open (like Google's auto-pan)
// - follows the pin while the map is dragged or zoomed; hides while the pin is off the map
// - closes on a click on the map or Escape
//
// It is a normal React element laid over the map (not inside Google's panes), so clicks and
// links in the card behave like anywhere else on the page. Render it inside the same positioned
// wrapper as the map's div.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'

type Side = 'above' | 'below' | 'right' | 'left'
export interface MapSpace { width: number; height: number }

export default function MapPopup({ map, position, anchor = { above: 14, below: 14, side: 14 }, onClose, children, margin = 10, className = 'z-30' }: {
  map: google.maps.Map | null
  /** The pin's spot; null = closed. */
  position: google.maps.LatLngLiteral | null
  /** How far the pin reaches above / below / beside its spot, so the card doesn't cover it. */
  anchor?: { above: number; below: number; side: number }
  onClose: () => void
  /** A node, or a function of the map's size (to pick a compact card on small maps). */
  children: ReactNode | ((space: MapSpace) => ReactNode)
  margin?: number
  className?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const ovRef = useRef<google.maps.OverlayView | null>(null)
  const sideRef = useRef<Side | null>(null)
  const openedForRef = useRef<string | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [space, setSpace] = useState<MapSpace>({ width: 0, height: 0 })
  const key = position ? `${position.lat},${position.lng}` : null

  const place = useCallback(() => {
    const el = boxRef.current
    const proj = ovRef.current?.getProjection()
    if (!el || !proj || !map || !position) return
    const mapDiv = map.getDiv()
    const parent = (el.offsetParent as HTMLElement | null) || mapDiv
    const mr = mapDiv.getBoundingClientRect()
    const pr = parent.getBoundingClientRect()
    const W = mr.width
    const H = mr.height
    const pt = proj.fromLatLngToContainerPixel(new google.maps.LatLng(position.lat, position.lng))
    if (!pt || !W || !H) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const m = margin
    const gap = 8
    const a = anchor
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v))

    // The pin scrolled off the map: hide until it's back.
    if (pt.x < -2 || pt.x > W + 2 || pt.y < -2 || pt.y > H + 2) {
      el.style.visibility = 'hidden'
      return
    }
    const fits: Record<Side, boolean> = {
      above: pt.y - a.above - gap - h >= m,
      below: pt.y + a.below + gap + h <= H - m,
      right: pt.x + a.side + gap + w <= W - m && h <= H - 2 * m,
      left: pt.x - a.side - gap - w >= m && h <= H - 2 * m,
    }
    // Keep the side it's on while it still fits (no flip-flopping while the map is dragged).
    const order: Side[] = ['above', 'below', 'right', 'left']
    const side = sideRef.current && fits[sideRef.current] ? sideRef.current : order.find(s => fits[s]) || null

    const first = openedForRef.current !== key
    openedForRef.current = key
    if (!side && first) {
      // Nothing fits around the pin: slide the map so the card fits above (or below) it.
      const needDown = m + h + gap + a.above - pt.y
      const needUp = pt.y + a.below + gap + h - (H - m)
      const tallEnough = h + gap + Math.max(a.above, a.below) + 2 * m <= H
      if (tallEnough) {
        if (needDown <= needUp) map.panBy(0, -needDown)
        else map.panBy(0, needUp)
        return // bounds_changed calls back here once the map has moved
      }
    }
    sideRef.current = side

    let x: number
    let y: number
    if (side === 'right' || side === 'left') {
      x = side === 'right' ? pt.x + a.side + gap : pt.x - a.side - gap - w
      y = clamp(pt.y - h / 2, m, H - m - h)
    } else {
      x = clamp(pt.x - w / 2, m, W - m - w)
      y = side === 'below' ? pt.y + a.below + gap : clamp(pt.y - a.above - gap - h, m, H - m - h)
    }
    el.style.transform = `translate(${Math.round(mr.left - pr.left + x)}px, ${Math.round(mr.top - pr.top + y)}px)`
    // Shown by dropping the inline "hidden" - not by forcing "visible", which outranked a hidden map
    // (a phone's Criteria tab) and left the card floating over the next tab (user, 10/28).
    el.style.visibility = ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, margin, anchor.above, anchor.below, anchor.side])
  const placeRef = useRef(place)
  placeRef.current = place

  // A do-nothing overlay, only for the map's pixel math; plus the map's size for `children`.
  useEffect(() => {
    if (!map) return
    const ov = new google.maps.OverlayView()
    ov.onAdd = () => {}
    ov.onRemove = () => {}
    ov.draw = () => placeRef.current()
    ov.setMap(map)
    ovRef.current = ov
    const div = map.getDiv()
    const measure = () => setSpace(s => (s.width === div.clientWidth && s.height === div.clientHeight ? s : { width: div.clientWidth, height: div.clientHeight }))
    measure()
    const ro = new ResizeObserver(() => { measure(); placeRef.current() })
    ro.observe(div)
    return () => { ro.disconnect(); ov.setMap(null); ovRef.current = null }
  }, [map])

  useEffect(() => {
    if (!map || !key) return
    sideRef.current = null
    const moved = map.addListener('bounds_changed', () => placeRef.current())
    const clicked = map.addListener('click', () => onCloseRef.current())
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    const el = boxRef.current
    const ro = el ? new ResizeObserver(() => placeRef.current()) : null
    if (el && ro) ro.observe(el)
    placeRef.current()
    return () => { moved.remove(); clicked.remove(); window.removeEventListener('keydown', onKey); ro?.disconnect() }
  }, [map, key])

  if (!map || !position) return null
  return (
    // touch-action none: a pinch that starts on the card can't zoom the whole phone page (it blew
    // the card and the map's labels up to twice their size - user, 10/28). Taps still work.
    <div ref={boxRef} className={`absolute left-0 top-0 max-w-[calc(100%-20px)] ${className}`} style={{ visibility: 'hidden', touchAction: 'none' }}>
      <motion.div key={key} initial={{ opacity: 0, scale: 0.96, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
        {typeof children === 'function' ? children(space) : children}
      </motion.div>
    </div>
  )
}
