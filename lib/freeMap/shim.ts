/* eslint-disable @typescript-eslint/no-explicit-any */
// The free backup map (owner, 11/10: "if our Google runs out one month make it basically look exactly
// the same everywhere ... same functionality"). Once this month's Google map allowance is used up,
// lib/googleMapsLoader.ts calls installFreeMaps(): Google's own script is still loaded (loading it
// costs nothing - Google bills each map drawn), but the parts that DRAW - google.maps.Map, Marker,
// Polygon, Polyline, Circle and OverlayView - are swapped for these stand-ins, which draw with
// MapLibre on OpenFreeMap's free street map instead. LatLng, LatLngBounds, MVCArray, events,
// geometry and Places stay Google's own, so every map in the app (IDX search, town pages, home
// pages, Showcase circle, Showcase editor, CMA maps) runs its same code unchanged.
//
// Matching Google closely where our maps depend on it:
// - zoom numbers are Google's (MapLibre's are one lower), fitBounds snaps to whole zooms like Google
// - overlay panes and pixel math behave like Google's (div pixels stay put while the map is
//   dragged, and draw() runs after a zoom and when the map settles)
// - gestureHandling greedy / cooperative / none / auto, draggable, double-click zoom, cursors
// - markers: picture icons, circle symbols, labels, z-order, titles, clicks, bounce
// - shapes: fills / lines / circles, editable corner handles and circle size handles
// - Google's zoom buttons and full-screen button, same spots

import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { FREE_STYLE_URL, applyToStyle, paletteFrom, paletteOps } from './style'

const TILE = 256
const MAX_GZOOM = 21
let styleDoc: Promise<any> | null = null
const loadStyle = () => (styleDoc ||= fetch(FREE_STYLE_URL).then(r => {
  if (!r.ok) throw new Error(`free map style ${r.status}`)
  return r.json()
}))

const world = (lat: number, lng: number, z: number) => {
  const s = TILE * 2 ** z
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999)
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }
}
const unworld = (x: number, y: number, z: number) => {
  const s = TILE * 2 ** z
  const n = Math.PI - (2 * Math.PI * y) / s
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: (x / s) * 360 - 180 }
}
const latOf = (p: any): number => (typeof p.lat === 'function' ? p.lat() : p.lat)
const lngOf = (p: any): number => (typeof p.lng === 'function' ? p.lng() : p.lng)

let installed = false
export function freeMapsInstalled() { return installed }

export function installFreeMaps(g: any) {
  if (installed) return
  installed = true
  g.maps.__ohpFree = true
  const gm = g.maps
  const ev = gm.event
  const MVC = gm.MVCObject
  const LatLng = gm.LatLng
  const LatLngBounds = gm.LatLngBounds
  const Point = gm.Point
  const MVCArray = gm.MVCArray
  const toLL = (p: any) => (p instanceof LatLng ? p : new LatLng(latOf(p), lngOf(p)))
  let seq = 0
  const live = new Set<any>()

  const mouseEvent = (latLng: any, domEvent?: Event, pixel?: { x: number; y: number }) => ({
    latLng, domEvent, pixel: pixel ? new Point(pixel.x, pixel.y) : undefined, stop() { domEvent?.stopPropagation() },
  })

  // ---------- the map ----------
  class FMap extends MVC {
    ml: maplibregl.Map
    _div: HTMLElement
    _opts: any = {}
    _origin = { x: 0, y: 0, z: 0 }
    _overlays = new Set<any>()
    _shapes: any[] = []
    _styleReady = false
    _styleQueue: (() => void)[] = []
    _panesRoot: HTMLDivElement
    _panes: Record<string, HTMLDivElement>
    _canvasProj: any
    _ui: { zoom?: HTMLElement; full?: HTMLElement } = {}
    _down: { x: number; y: number } | null = null
    _idleTimer = 0
    _layers: any[] = []
    _palette: any
    controls: any[] = []
    _inner: HTMLDivElement | null = null

    _dead = false
    _destroy() {
      this._dead = true
      live.delete(this)
      clearTimeout(this._idleTimer)
      this._overlays.clear()
      this._shapes = []
      try { this.ml.remove() } catch { /* already gone */ }
      this._inner?.remove()
    }

    constructor(div: HTMLElement, opts: any = {}) {
      super()
      this._div = div
      this._opts = { ...opts }
      // A new map in the same box replaces the old one (Google does the same), and maps whose box
      // has left the page are shut down - each one holds a graphics context, and phones allow few.
      live.forEach(m => { if (m._div === div || !m._div.isConnected) m._destroy() })
      live.add(this)
      ;(div as any).__ohpFreeMap = this
      if (getComputedStyle(div).position === 'static') div.style.position = 'relative'
      div.style.overflow = 'hidden'
      const inner = document.createElement('div')
      inner.style.cssText = 'position:absolute;inset:0;'
      div.appendChild(inner)
      this._inner = inner
      const c = opts.center ? toLL(opts.center) : new LatLng(39.95, -75.16)
      const z = typeof opts.zoom === 'number' ? opts.zoom : 12
      this._palette = paletteFrom(opts.styles)
      this.ml = new maplibregl.Map({
        container: inner,
        style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': this._palette.land } }] },
        center: [lngOf(c), latOf(c)],
        zoom: z - 1,
        minZoom: Math.max(0, (opts.minZoom ?? 0) - 1),
        maxZoom: (opts.maxZoom ?? MAX_GZOOM) - 1,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
        fadeDuration: 150,
      } as any)
      this.ml.touchZoomRotate.disableRotation()
      this.ml.keyboard.disableRotation()
      this.ml.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

      // Google's panes: zero-size boxes stacked over the map, moved together while the map is dragged.
      const root = document.createElement('div')
      root.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:1;'
      const mk = (name: string, z: number, events: boolean) => {
        const p = document.createElement('div')
        p.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;z-index:${z};pointer-events:${events ? 'auto' : 'none'};`
        p.dataset.pane = name
        root.appendChild(p)
        return p
      }
      this._panes = {
        mapPane: mk('mapPane', 100, false),
        overlayLayer: mk('overlayLayer', 101, false),
        markerLayer: mk('markerLayer', 103, true),
        overlayMouseTarget: mk('overlayMouseTarget', 104, true),
        floatPane: mk('floatPane', 106, true),
      }
      this._panesRoot = root
      this.ml.getCanvasContainer().appendChild(root)
      // A click that ends a drag starting on a pin isn't a click on the pin (Google drops it too).
      const cc = this.ml.getCanvasContainer()
      const down = (x: number, y: number) => { this._down = { x, y } }
      cc.addEventListener('mousedown', e => down(e.clientX, e.clientY), true)
      cc.addEventListener('touchstart', e => { const t = e.touches[0]; if (t) down(t.clientX, t.clientY) }, { capture: true, passive: true })
      root.addEventListener('click', e => {
        const d = this._down
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) { e.stopPropagation(); e.preventDefault() }
      }, true)

      this._canvasProj = this._makeCanvasProjection()
      this._resetOrigin()
      this._wireEvents()
      this._applyUi()
      this._applyGestures()
      ev.addListener(this, 'resize', () => this.ml.resize())

      loadStyle().then(doc => {
        const style = applyToStyle(JSON.parse(JSON.stringify(doc)), this._palette)
        this._layers = style.layers
        // Only the real street map counts (not the blank one the map opened with).
        const ready = () => {
          if (this._styleReady || !this.ml.getLayer('water')) return
          this._styleReady = true
          this.ml.off('style.load', ready)
          const q = this._styleQueue.splice(0)
          q.forEach(fn => fn())
        }
        this.ml.on('style.load', ready)
        this.ml.setStyle(style as any, { diff: false })
      }).catch(err => console.warn('[free map] style failed', err))

      setTimeout(() => {
        ;['projection_changed', 'bounds_changed', 'center_changed', 'zoom_changed'].forEach(n => ev.trigger(this, n))
      }, 0)
    }

    // ---- pixel math (Google's "div pixels": fixed until a zoom or the map settles) ----
    _topLeft(z = this.getZoom()) {
      const c = this.ml.getCenter()
      const w = world(c.lat, c.lng, z)
      const el = this.ml.getContainer()
      return { x: w.x - el.clientWidth / 2, y: w.y - el.clientHeight / 2 }
    }
    _resetOrigin() {
      const z = this.getZoom()
      const tl = this._topLeft(z)
      this._origin = { x: tl.x, y: tl.y, z }
      this._panesRoot.style.transform = 'translate(0px, 0px)'
    }
    _shiftPanes() {
      const tl = this._topLeft(this._origin.z)
      this._panesRoot.style.transform = `translate(${Math.round(this._origin.x - tl.x)}px, ${Math.round(this._origin.y - tl.y)}px)`
    }
    _drawAll() {
      this._overlays.forEach(o => { try { o._ohpDraw() } catch (e) { console.error(e) } })
    }
    _makeCanvasProjection() {
      const self = this
      return {
        fromLatLngToDivPixel(ll: any) {
          if (!ll) return null
          const w = world(latOf(ll), lngOf(ll), self._origin.z)
          return new Point(w.x - self._origin.x, w.y - self._origin.y)
        },
        fromDivPixelToLatLng(pt: any) {
          if (!pt) return null
          const r = unworld(pt.x + self._origin.x, pt.y + self._origin.y, self._origin.z)
          return new LatLng(r.lat, r.lng)
        },
        fromLatLngToContainerPixel(ll: any) {
          if (!ll) return null
          const z = self.getZoom()
          const tl = self._topLeft(z)
          const w = world(latOf(ll), lngOf(ll), z)
          return new Point(w.x - tl.x, w.y - tl.y)
        },
        fromContainerPixelToLatLng(pt: any) {
          if (!pt) return null
          const z = self.getZoom()
          const tl = self._topLeft(z)
          const r = unworld(pt.x + tl.x, pt.y + tl.y, z)
          return new LatLng(r.lat, r.lng)
        },
        getWorldWidth() { return TILE * 2 ** self.getZoom() },
        getVisibleRegion() { return null },
      }
    }

    _wireEvents() {
      const ml = this.ml
      let lastZ = this.getZoom()
      ml.on('move', () => {
        const z = this.getZoom()
        if (Math.abs(z - this._origin.z) > 1e-9) { this._resetOrigin(); this._drawAll() } else this._shiftPanes()
        ev.trigger(this, 'bounds_changed')
        ev.trigger(this, 'center_changed')
        if (Math.abs(z - lastZ) > 1e-9) { lastZ = z; ev.trigger(this, 'zoom_changed') }
      })
      ml.on('moveend', () => { this._resetOrigin(); this._drawAll(); this._queueIdle() })
      ml.on('resize', () => { this._resetOrigin(); this._drawAll(); ev.trigger(this, 'bounds_changed') })
      ml.on('load', () => { this._queueIdle(); ev.trigger(this, 'tilesloaded'); this._foldCredit() })
      ml.on('styledata', () => this._foldCredit())
      ml.on('dragstart', () => ev.trigger(this, 'dragstart'))
      ml.on('drag', () => ev.trigger(this, 'drag'))
      ml.on('dragend', () => ev.trigger(this, 'dragend'))
      const ll = (e: any) => new LatLng(e.lngLat.lat, e.lngLat.lng)
      const onCanvas = (e: any) => !e.originalEvent || e.originalEvent.target === ml.getCanvas()
      ml.on('click', (e: any) => {
        if (!onCanvas(e)) return
        const hit = this._shapeAt(e.point)
        if (hit) { ev.trigger(hit, 'click', mouseEvent(ll(e), e.originalEvent, e.point)); return }
        ev.trigger(this, 'click', mouseEvent(ll(e), e.originalEvent, e.point))
      })
      ml.on('dblclick', (e: any) => { if (onCanvas(e)) ev.trigger(this, 'dblclick', mouseEvent(ll(e), e.originalEvent, e.point)) })
      ml.on('contextmenu', (e: any) => ev.trigger(this, 'rightclick', mouseEvent(ll(e), e.originalEvent, e.point)))
      ml.on('mousedown', (e: any) => ev.trigger(this, 'mousedown', mouseEvent(ll(e), e.originalEvent, e.point)))
      ml.on('mouseup', (e: any) => ev.trigger(this, 'mouseup', mouseEvent(ll(e), e.originalEvent, e.point)))
      ml.on('mousemove', (e: any) => {
        ev.trigger(this, 'mousemove', mouseEvent(ll(e), e.originalEvent, e.point))
        if (onCanvas(e)) this._hoverShapes(e.point)
      })
      ml.on('mouseout', (e: any) => ev.trigger(this, 'mouseout', mouseEvent(ll(e), e.originalEvent, e.point)))
      // Google turns one-finger touches into the same mousedown / mousemove / mouseup.
      ml.on('touchstart', (e: any) => { if (e.points?.length === 1) ev.trigger(this, 'mousedown', mouseEvent(ll(e), e.originalEvent, e.point)) })
      ml.on('touchmove', (e: any) => { if (e.points?.length === 1) ev.trigger(this, 'mousemove', mouseEvent(ll(e), e.originalEvent, e.point)) })
      ml.on('touchend', (e: any) => ev.trigger(this, 'mouseup', mouseEvent(ll(e), e.originalEvent, e.point)))
    }
    // The map's credit line starts folded to its small (i) button, in Google's logo corner, so it
    // never covers what our maps put along the bottom edge; a tap opens it.
    _foldCredit() {
      this.ml.getContainer().querySelectorAll('.maplibregl-ctrl-attrib.maplibregl-compact-show').forEach(el => el.classList.remove('maplibregl-compact-show'))
    }
    _queueIdle() {
      clearTimeout(this._idleTimer)
      this._idleTimer = window.setTimeout(() => ev.trigger(this, 'idle'), 0)
    }
    _whenStyle(fn: () => void) { if (this._styleReady) fn(); else this._styleQueue.push(fn) }

    // ---- shapes under the pointer (Google: a clickable shape takes the click, not the map) ----
    _shapeLayerIds() { return this._shapes.filter(s => s._clickable() && s._visible()).flatMap(s => s._layerIds()) }
    _shapeAt(point: any) {
      if (!this._styleReady) return null
      const ids = this._shapeLayerIds().filter(id => this.ml.getLayer(id))
      if (!ids.length) return null
      const hits = this.ml.queryRenderedFeatures(point, { layers: ids })
      if (!hits.length) return null
      const id = hits[0].layer.id
      return this._shapes.find(s => s._layerIds().includes(id)) || null
    }
    _hovered: any = null
    _hoverShapes(point: any) {
      const hit = this._shapeAt(point)
      if (hit !== this._hovered) {
        if (this._hovered) ev.trigger(this._hovered, 'mouseout', mouseEvent(null))
        if (hit) ev.trigger(hit, 'mouseover', mouseEvent(null))
        this._hovered = hit
      }
      const canvas = this.ml.getCanvas()
      canvas.style.cursor = hit ? 'pointer' : (this._opts.draggableCursor || '')
    }

    // ---- options ----
    _applyGestures() {
      const o = this._opts
      const ml = this.ml as any
      let mode = o.gestureHandling || 'auto'
      if (o.draggable === false && mode === 'auto') mode = 'greedy'
      if (mode === 'auto') {
        const doc = document.scrollingElement || document.documentElement
        mode = window.self !== window.top || doc.scrollHeight > window.innerHeight + 4 ? 'cooperative' : 'greedy'
      }
      const all = ['dragPan', 'scrollZoom', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate', 'keyboard']
      if (mode === 'none') {
        all.forEach(h => ml[h]?.disable())
        ml.cooperativeGestures?.disable()
      } else {
        all.forEach(h => ml[h]?.enable())
        ml.touchZoomRotate.disableRotation()
        ml.keyboard.disableRotation()
        if (mode === 'cooperative') ml.cooperativeGestures?.enable()
        else ml.cooperativeGestures?.disable()
        if (o.draggable === false) ml.dragPan.disable()
        if (o.scrollwheel === false) ml.scrollZoom.disable()
        if (o.disableDoubleClickZoom) ml.doubleClickZoom.disable()
        if (o.keyboardShortcuts === false) ml.keyboard.disable()
      }
      ml.getCanvas().style.cursor = o.draggableCursor || ''
    }
    _applyUi() {
      const o = this._opts
      const showZoom = o.zoomControl ?? !o.disableDefaultUI
      const showFull = o.fullscreenControl ?? false
      const box = this.ml.getContainer()
      const btn = 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:0;background:#fff;cursor:pointer;padding:0;color:#666;'
      const shell = 'position:absolute;z-index:3;background:#fff;border-radius:2px;box-shadow:rgba(0,0,0,.3) 0 1px 4px -1px;pointer-events:auto;user-select:none;'
      const stop = (el: HTMLElement) => ['mousedown', 'touchstart', 'dblclick', 'click', 'wheel', 'pointerdown'].forEach(n => el.addEventListener(n, e => e.stopPropagation(), { passive: true }))
      if (showZoom && !this._ui.zoom) {
        const el = document.createElement('div')
        el.style.cssText = `${shell}right:10px;bottom:24px;width:40px;`
        const plus = document.createElement('button')
        plus.type = 'button'; plus.title = 'Zoom in'; plus.setAttribute('aria-label', 'Zoom in')
        plus.style.cssText = btn
        plus.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M18 7h-7V0H7v7H0v4h7v7h4v-7h7z" fill="currentColor"/></svg>'
        const sep = document.createElement('div')
        sep.style.cssText = 'height:1px;margin:0 6px;background:#e6e6e6;'
        const minus = document.createElement('button')
        minus.type = 'button'; minus.title = 'Zoom out'; minus.setAttribute('aria-label', 'Zoom out')
        minus.style.cssText = btn
        minus.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M0 7h18v4H0z" fill="currentColor"/></svg>'
        ;[plus, minus].forEach(b => {
          b.addEventListener('mouseenter', () => { b.style.color = '#333' })
          b.addEventListener('mouseleave', () => { b.style.color = '#666' })
        })
        plus.addEventListener('click', () => this.ml.zoomTo(Math.round(this.ml.getZoom()) + 1, { duration: 250 }))
        minus.addEventListener('click', () => this.ml.zoomTo(Math.round(this.ml.getZoom()) - 1, { duration: 250 }))
        el.append(plus, sep, minus)
        stop(el)
        box.appendChild(el)
        this._ui.zoom = el
      } else if (!showZoom && this._ui.zoom) { this._ui.zoom.remove(); this._ui.zoom = undefined }
      if (showFull && !this._ui.full) {
        const el = document.createElement('button')
        el.type = 'button'; el.title = 'Toggle fullscreen view'; el.setAttribute('aria-label', 'Toggle fullscreen view')
        el.style.cssText = `${shell}${btn}right:10px;top:10px;`
        el.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M0 0v6h2V2h4V0H0zm16 0h-4v2h4v4h2V0h-2zm0 16h-4v2h6v-6h-2v4zM2 12H0v6h6v-2H2v-4z" fill="currentColor"/></svg>'
        el.addEventListener('click', () => {
          const d = document as any
          if (d.fullscreenElement) d.exitFullscreen?.()
          else (this._div as any).requestFullscreen?.()
        })
        stop(el)
        box.appendChild(el)
        this._ui.full = el
      } else if (!showFull && this._ui.full) { this._ui.full.remove(); this._ui.full = undefined }
    }
    _applyStyles() {
      this._palette = paletteFrom(this._opts.styles)
      if (!this._styleReady) {
        // Not open yet: the style is colored when it arrives (constructor), with the newest palette.
        this._styleQueue.push(() => this._applyStyles())
        return
      }
      for (const op of paletteOps(this._layers, this._palette)) {
        if (!this.ml.getLayer(op.layer)) continue
        try {
          if (op.kind === 'paint') this.ml.setPaintProperty(op.layer, op.prop, op.value as any)
          else this.ml.setLayoutProperty(op.layer, op.prop, op.value as any)
        } catch { /* a layer without that property */ }
      }
    }
    setOptions(opts: any) {
      if (!opts || this._dead) return
      this._opts = { ...this._opts, ...opts }
      if ('styles' in opts) this._applyStyles()
      if (['gestureHandling', 'draggable', 'scrollwheel', 'disableDoubleClickZoom', 'keyboardShortcuts', 'draggableCursor'].some(k => k in opts)) this._applyGestures()
      if (['zoomControl', 'fullscreenControl', 'disableDefaultUI'].some(k => k in opts)) this._applyUi()
      if ('minZoom' in opts) this.ml.setMinZoom(opts.minZoom == null ? 0 : Math.max(0, opts.minZoom - 1))
      if ('maxZoom' in opts) this.ml.setMaxZoom((opts.maxZoom ?? MAX_GZOOM) - 1)
      if (opts.center) this.setCenter(opts.center)
      if (typeof opts.zoom === 'number') this.setZoom(opts.zoom)
    }

    // ---- camera ----
    getDiv() { return this._div }
    getCenter() { const c = this.ml.getCenter(); return new LatLng(c.lat, c.lng) }
    setCenter(ll: any) { if (ll && !this._dead) this.ml.jumpTo({ center: [lngOf(ll), latOf(ll)] }) }
    getZoom() { return this.ml.getZoom() + 1 }
    setZoom(z: number) { if (typeof z === 'number' && !this._dead) this.ml.jumpTo({ zoom: Math.min(MAX_GZOOM, z) - 1 }) }
    panTo(ll: any) {
      if (!ll || this._dead) return
      const to = this._canvasProj.fromLatLngToContainerPixel(ll)
      const el = this.ml.getContainer()
      const near = to && Math.abs(to.x - el.clientWidth / 2) < el.clientWidth * 1.5 && Math.abs(to.y - el.clientHeight / 2) < el.clientHeight * 1.5
      if (near) this.ml.easeTo({ center: [lngOf(ll), latOf(ll)], duration: 350 })
      else this.setCenter(ll)
    }
    panBy(x: number, y: number) { if (!this._dead) this.ml.panBy([x, y], { duration: 250 }) }
    panToBounds(b: any) { if (b && !this.getBounds().contains(b.getCenter())) this.panTo(b.getCenter()) }
    fitBounds(b: any, padding?: any) {
      if (!b || this._dead) return
      const bounds = b instanceof LatLngBounds ? b : new LatLngBounds(b.south != null ? { lat: b.south, lng: b.west } : b.getSouthWest?.(), b.north != null ? { lat: b.north, lng: b.east } : b.getNorthEast?.())
      if (bounds.isEmpty()) return
      const el = this.ml.getContainer()
      const W = el.clientWidth, H = el.clientHeight
      if (!W || !H) {
        // No size yet (a hidden tab): aim the center now, size the view once it shows.
        this.setCenter(bounds.getCenter())
        const once = () => { if (el.clientWidth && el.clientHeight) { this.ml.off('resize', once); this.fitBounds(bounds, padding) } }
        this.ml.on('resize', once)
        return
      }
      // No padding given: Google leaves a margin of its own (its docs: pass 0 to fit exactly).
      const pad = padding == null ? 40 : padding
      let p = typeof pad === 'number' ? { top: pad, bottom: pad, left: pad, right: pad }
        : { top: pad.top ?? 0, bottom: pad.bottom ?? 0, left: pad.left ?? 0, right: pad.right ?? 0 }
      // Padding wider than the map: shrink it (Google still fits; MapLibre would give up).
      const kx = Math.min(1, (W - 8) / Math.max(1, p.left + p.right)), ky = Math.min(1, (H - 8) / Math.max(1, p.top + p.bottom))
      if (kx < 1 || ky < 1) p = { top: p.top * ky, bottom: p.bottom * ky, left: p.left * kx, right: p.right * kx }
      const sw = bounds.getSouthWest(), ne = bounds.getNorthEast()
      const cam = this.ml.cameraForBounds([[sw.lng(), sw.lat()], [ne.lng(), ne.lat()]], { padding: p })
      if (!cam) return
      // Google zooms to whole steps when fitting (so the fit leaves the same margin it does there).
      const gz = Math.min(MAX_GZOOM, Math.floor((cam.zoom ?? 0) + 1 + 1e-6))
      this.ml.jumpTo({ center: cam.center as any, zoom: gz - 1 })
    }
    getBounds() {
      const b = this.ml.getBounds()
      return new LatLngBounds({ lat: b.getSouth(), lng: b.getWest() }, { lat: b.getNorth(), lng: b.getEast() })
    }
    getProjection() {
      return {
        fromLatLngToPoint(ll: any) { const w = world(latOf(ll), lngOf(ll), 0); return new Point(w.x, w.y) },
        fromPointToLatLng(pt: any) { const r = unworld(pt.x, pt.y, 0); return new LatLng(r.lat, r.lng) },
      }
    }
    getMapTypeId() { return 'roadmap' }
    setMapTypeId() { /* street map only */ }
    getHeading() { return 0 }
    getTilt() { return 0 }
    getClickableIcons() { return false }
    setClickableIcons() { /* no place icons to click */ }
  }

  // ---------- OverlayView ----------
  class FOverlayView extends MVC {
    __map: any = null
    __added = false
    static preventMapHitsFrom(el: HTMLElement) { ['click', 'dblclick', 'contextmenu'].forEach(n => el.addEventListener(n, e => e.stopPropagation())) }
    static preventMapHitsAndGesturesFrom(el: HTMLElement) { ['click', 'dblclick', 'contextmenu', 'mousedown', 'touchstart', 'wheel', 'pointerdown'].forEach(n => el.addEventListener(n, e => e.stopPropagation(), { passive: true })) }
    setMap(m: any) {
      const cur = this.__map
      if (cur === (m || null)) return
      if (cur) {
        cur._overlays.delete(this)
        if (this.__added) { this.__added = false; try { (this as any).onRemove?.() } catch (e) { console.error(e) } }
      }
      this.__map = m || null
      ;(MVC.prototype as any).set.call(this, 'map', m || null)
      if (m) {
        m._overlays.add(this)
        Promise.resolve().then(() => {
          if (this.__map !== m || this.__added) return
          this.__added = true
          try { (this as any).onAdd?.() } catch (e) { console.error(e) }
          this._ohpDraw()
        })
      }
    }
    getMap() { return this.__map }
    getPanes() { return this.__map && this.__added ? this.__map._panes : null }
    getProjection() { return this.__map ? this.__map._canvasProj : null }
    _ohpDraw() { if (this.__added) (this as any).draw?.() }
  }

  // ---------- Marker ----------
  const ANIM = { BOUNCE: gm.Animation?.BOUNCE ?? 1, DROP: gm.Animation?.DROP ?? 2 }
  const CIRCLE = gm.SymbolPath?.CIRCLE ?? 0
  class FMarker extends MVC {
    __map: any = null
    _o: any
    el = document.createElement('div')
    inner = document.createElement('div')
    _anim: Animation | null = null
    constructor(opts: any = {}) {
      super()
      this._o = { clickable: true, visible: true, ...opts }
      this.el.style.cssText = 'position:absolute;left:0;top:0;'
      this.inner.style.cssText = 'position:absolute;left:0;top:0;'
      this.el.appendChild(this.inner)
      this.el.addEventListener('click', e => {
        if (!this._o.clickable) return
        ev.trigger(this, 'click', mouseEvent(this.getPosition(), e))
      })
      this.el.addEventListener('mouseover', e => ev.trigger(this, 'mouseover', mouseEvent(this.getPosition(), e)))
      this.el.addEventListener('mouseout', e => ev.trigger(this, 'mouseout', mouseEvent(this.getPosition(), e)))
      this._render()
      if (opts.map) this.setMap(opts.map)
      if (opts.animation) this.setAnimation(opts.animation)
    }
    _render() {
      const o = this._o
      const icon = o.icon
      const box = this.inner
      box.innerHTML = ''
      box.style.transform = ''
      let lx = 0, ly = 0 // label spot, relative to the marker's point
      if (!icon) {
        // Google's red pin
        box.innerHTML = '<svg width="27" height="43" viewBox="0 0 27 43"><path d="M13.5 0C6 0 0 6 0 13.4c0 9.6 13.5 29.6 13.5 29.6S27 23 27 13.4C27 6 21 0 13.5 0z" fill="#ea4335" stroke="#a52714" stroke-width="1"/><circle cx="13.5" cy="13.5" r="4.5" fill="#a52714"/></svg>'
        box.style.transform = 'translate(-13.5px, -43px)'
        lx = 0; ly = -29
      } else if (typeof icon === 'string' || icon.url) {
        const img = document.createElement('img')
        img.src = typeof icon === 'string' ? icon : icon.url
        img.alt = ''
        img.draggable = false
        img.style.cssText = 'display:block;max-width:none;user-select:none;'
        const size = typeof icon === 'object' ? (icon.scaledSize || icon.size) : null
        if (size) { img.style.width = `${size.width}px`; img.style.height = `${size.height}px` }
        box.appendChild(img)
        if (size) {
          const ax = icon.anchor ? icon.anchor.x : size.width / 2
          const ay = icon.anchor ? icon.anchor.y : size.height
          box.style.transform = `translate(${-ax}px, ${-ay}px)`
          lx = (icon.labelOrigin ? icon.labelOrigin.x : size.width / 2) - ax
          ly = (icon.labelOrigin ? icon.labelOrigin.y : size.height / 2) - ay
        } else {
          box.style.transform = 'translate(-50%, -100%)'
        }
      } else {
        // A symbol: Google's circle, or an SVG path in its own units, scaled.
        const s = icon.scale ?? (icon.path === CIRCLE ? 5 : 1)
        const sw = icon.strokeWeight ?? (icon.path === CIRCLE ? s : 1)
        const fill = icon.fillColor || '#000'
        const fo = icon.fillOpacity ?? 0
        const stroke = icon.strokeColor || '#000'
        const so = icon.strokeOpacity ?? 1
        const ax = (icon.anchor?.x ?? 0) * s, ay = (icon.anchor?.y ?? 0) * s
        const pad = s + sw + 2
        let body: string
        if (icon.path === CIRCLE) body = `<circle cx="0" cy="0" r="${s}" fill="${fill}" fill-opacity="${fo}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="${sw}"/>`
        else body = `<path d="${icon.path}" transform="scale(${s}) rotate(${icon.rotation || 0})" fill="${fill}" fill-opacity="${fo}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="${sw / s}" vector-effect="non-scaling-stroke"/>`
        const size = icon.path === CIRCLE ? pad * 2 : 0
        box.innerHTML = icon.path === CIRCLE
          ? `<svg width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${size} ${size}" style="display:block;overflow:visible">${body}</svg>`
          : `<svg width="1" height="1" style="display:block;overflow:visible">${body}</svg>`
        box.style.transform = icon.path === CIRCLE ? `translate(${-pad - ax}px, ${-pad - ay}px)` : `translate(${-ax}px, ${-ay}px)`
        lx = (icon.labelOrigin ? icon.labelOrigin.x * s : 0) - ax
        ly = (icon.labelOrigin ? icon.labelOrigin.y * s : 0) - ay
      }
      // label
      this.el.querySelector('[data-label]')?.remove()
      const lab = o.label
      if (lab) {
        const L = typeof lab === 'string' ? { text: lab } : lab
        const span = document.createElement('span')
        span.dataset.label = ''
        span.textContent = L.text
        span.style.cssText = `position:absolute;left:${lx}px;top:${ly}px;transform:translate(-50%,-50%);white-space:nowrap;line-height:1;pointer-events:none;`
          + `color:${L.color || '#000'};font-size:${L.fontSize || '14px'};font-weight:${L.fontWeight || '400'};font-family:${L.fontFamily || 'Roboto, Arial, sans-serif'};`
        if (L.className) span.className = L.className
        this.el.appendChild(span)
      }
      this.el.title = o.title || ''
      this.el.style.cursor = o.clickable ? (o.cursor || 'pointer') : ''
      this.el.style.pointerEvents = o.clickable ? 'auto' : 'none'
      this.el.style.opacity = o.opacity != null ? String(o.opacity) : ''
      this.el.style.display = o.visible === false ? 'none' : ''
      this._z()
    }
    _z() {
      const pos = this._o.position
      const z = this._o.zIndex ?? (pos ? Math.round((90 - latOf(pos)) * 100) : 0)
      this.el.style.zIndex = String(z)
    }
    _ohpDraw() {
      const m = this.__map
      if (!m || !this._o.position) return
      const p = m._canvasProj.fromLatLngToDivPixel(this._o.position)
      this.el.style.transform = `translate(${p.x}px, ${p.y}px)`
    }
    setMap(m: any) {
      if (this.__map === (m || null)) return
      if (this.__map) { this.__map._overlays.delete(this); this.el.remove() }
      this.__map = m || null
      ;(MVC.prototype as any).set.call(this, 'map', m || null)
      if (m) {
        m._panes.markerLayer.appendChild(this.el)
        m._overlays.add(this)
        this._ohpDraw()
      }
    }
    getMap() { return this.__map }
    getPosition() { return this._o.position ? toLL(this._o.position) : null }
    setPosition(p: any) { this._o.position = p; this._z(); this._ohpDraw(); ev.trigger(this, 'position_changed') }
    getIcon() { return this._o.icon }
    setIcon(i: any) { this._o.icon = i; this._render(); this._ohpDraw() }
    getLabel() { return this._o.label }
    setLabel(l: any) { this._o.label = l; this._render(); this._ohpDraw() }
    getTitle() { return this._o.title }
    setTitle(t: string) { this._o.title = t; this.el.title = t || '' }
    getZIndex() { return this._o.zIndex }
    setZIndex(z: number) { this._o.zIndex = z; this._z() }
    getVisible() { return this._o.visible !== false }
    setVisible(v: boolean) { this._o.visible = v; this.el.style.display = v === false ? 'none' : '' }
    setOpacity(o: number) { this._o.opacity = o; this.el.style.opacity = o != null ? String(o) : '' }
    getClickable() { return !!this._o.clickable }
    setClickable(c: boolean) { this._o.clickable = c; this._render(); this._ohpDraw() }
    setDraggable() { /* our maps never drag pins */ }
    getDraggable() { return false }
    setOptions(o: any) {
      const map = o && 'map' in o ? o.map : undefined
      this._o = { ...this._o, ...o }
      delete this._o.map
      this._render()
      if (map !== undefined) this.setMap(map)
      else this._ohpDraw()
      if (o && 'animation' in o) this.setAnimation(o.animation)
    }
    getAnimation() { return this._o.animation ?? null }
    setAnimation(a: any) {
      this._anim?.cancel()
      this._anim = null
      this._o.animation = a ?? null
      if (a === ANIM.BOUNCE) {
        this._anim = this.el.animate(
          [{ translate: '0 0', easing: 'ease-out' }, { translate: '0 -18px', easing: 'ease-in' }, { translate: '0 0' }],
          { duration: 700, iterations: Infinity } as any,
        )
      } else if (a === ANIM.DROP) {
        this._anim = this.el.animate([{ translate: '0 -240px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.3,.6,.4,1)' } as any)
      }
    }
  }

  // ---------- shapes ----------
  const DEF = { strokeColor: '#000000', strokeOpacity: 1, strokeWeight: 3, fillColor: '#000000', fillOpacity: 0.3, clickable: true, editable: false, draggable: false, visible: true }
  const handleCss = (mid: boolean) => `position:absolute;left:0;top:0;width:${mid ? 9 : 11}px;height:${mid ? 9 : 11}px;margin:${mid ? -5 : -6}px 0 0 ${mid ? -5 : -6}px;`
    + `border-radius:50%;background:#fff;border:1px solid #5f6368;box-shadow:0 1px 2px rgba(0,0,0,.25);cursor:pointer;touch-action:none;${mid ? 'opacity:.55;' : ''}`

  // Drags one handle: the pointer's spot on the map, live, until it's let go.
  // The shape's other handles hold still until it's let go (rebuilding them mid-drag would drop the
  // finger's touch on a phone); the one being dragged follows the pointer.
  function dragHandle(map: any, shape: any, el: HTMLElement, onMove: (ll: any) => void, onEnd?: () => void) {
    const start = (e: MouseEvent | TouchEvent) => {
      e.stopPropagation()
      if (e.cancelable) e.preventDefault()
      shape._dragging = true
      const rect = () => map.ml.getContainer().getBoundingClientRect()
      const at = (cx: number, cy: number) => { const r = rect(); return map._canvasProj.fromContainerPixelToLatLng(new Point(cx - r.left, cy - r.top)) }
      const go = (cx: number, cy: number) => {
        const ll = at(cx, cy)
        if (!ll) return
        onMove(ll)
        const p = map._canvasProj.fromLatLngToDivPixel(ll)
        el.style.transform = `translate(${p.x}px, ${p.y}px)`
      }
      // A finger's moves keep arriving at the dot it started on (kept in place while dragging), so
      // they're read there - and stopped there, so the map doesn't pan along. The mouse can leave
      // the dot, so its moves are read from the whole page.
      const mm = (ev2: MouseEvent) => go(ev2.clientX, ev2.clientY)
      const tm = (ev2: TouchEvent) => {
        ev2.stopPropagation()
        const t = ev2.touches[0]
        if (t) { if (ev2.cancelable) ev2.preventDefault(); go(t.clientX, t.clientY) }
      }
      const up = (ev2?: Event) => {
        ev2?.stopPropagation()
        document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', up)
        el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', up); el.removeEventListener('touchcancel', up)
        shape._dragging = false
        shape._ohpDraw()
        onEnd?.()
      }
      if (e.type === 'touchstart') {
        el.addEventListener('touchmove', tm, { passive: false }); el.addEventListener('touchend', up); el.addEventListener('touchcancel', up)
      } else {
        document.addEventListener('mousemove', mm); document.addEventListener('mouseup', up)
      }
    }
    el.addEventListener('mousedown', start)
    el.addEventListener('touchstart', start, { passive: false })
    ;['click', 'dblclick'].forEach(n => el.addEventListener(n, e => e.stopPropagation()))
  }

  abstract class FShape extends MVC {
    __map: any = null
    _o: any
    _id = `ohp-shape-${++seq}`
    _handles: HTMLDivElement | null = null
    _dragging = false
    abstract _kind: 'poly' | 'line' | 'circle'
    abstract _geojson(): any
    constructor(opts: any) { super(); this._o = { ...DEF, ...opts } }
    _layerIds() { return this._kind === 'line' ? [`${this._id}-l`] : [`${this._id}-f`, `${this._id}-l`] }
    _clickable() { return this._o.clickable !== false }
    _visible() { return this._o.visible !== false }
    _paint() {
      const o = this._o
      return {
        fill: { 'fill-color': o.fillColor || '#000', 'fill-opacity': o.fillOpacity ?? 0.3 },
        line: { 'line-color': o.strokeColor || '#000', 'line-opacity': o.strokeOpacity ?? 1, 'line-width': o.strokeWeight ?? 3 },
      }
    }
    _add() {
      const m = this.__map
      if (!m) return
      m._whenStyle(() => {
        if (this.__map !== m || m._dead || m.ml.getSource(this._id)) return
        m.ml.addSource(this._id, { type: 'geojson', data: this._geojson() })
        const p = this._paint()
        const vis = this._visible() ? 'visible' : 'none'
        const before = this._beforeId(m)
        if (this._kind !== 'line') m.ml.addLayer({ id: `${this._id}-f`, type: 'fill', source: this._id, paint: p.fill as any, layout: { visibility: vis } }, before)
        m.ml.addLayer({ id: `${this._id}-l`, type: 'line', source: this._id, paint: p.line as any, layout: { visibility: vis, 'line-join': 'round', 'line-cap': 'round' } }, before)
      })
    }
    // Higher zIndex draws on top (Google), else newest on top.
    _beforeId(m: any) {
      const z = this._o.zIndex ?? 0
      const later = m._shapes.find((s: any) => s !== this && (s._o.zIndex ?? 0) > z && m.ml.getLayer(s._layerIds()[0]))
      return later ? later._layerIds()[0] : undefined
    }
    _remove(m: any) {
      if (!m || m._dead) return
      this._layerIds().forEach(id => { if (m.ml.getLayer(id)) m.ml.removeLayer(id) })
      if (m.ml.getSource(this._id)) m.ml.removeSource(this._id)
    }
    _update() {
      const m = this.__map
      if (!m || m._dead) return
      const src = m.ml.getSource(this._id) as any
      if (src) src.setData(this._geojson())
      this._ohpDraw()
    }
    _restyle() {
      const m = this.__map
      if (!m || m._dead || !m.ml.getLayer(this._layerIds()[0])) return
      const p = this._paint()
      const vis = this._visible() ? 'visible' : 'none'
      if (this._kind !== 'line') { Object.entries(p.fill).forEach(([k, v]) => m.ml.setPaintProperty(`${this._id}-f`, k, v)); m.ml.setLayoutProperty(`${this._id}-f`, 'visibility', vis) }
      Object.entries(p.line).forEach(([k, v]) => m.ml.setPaintProperty(`${this._id}-l`, k, v))
      m.ml.setLayoutProperty(`${this._id}-l`, 'visibility', vis)
    }
    setMap(m: any) {
      const cur = this.__map
      if (cur === (m || null)) return
      if (cur) {
        this._remove(cur)
        cur._shapes = cur._shapes.filter((s: any) => s !== this)
        cur._overlays.delete(this)
        this._handles?.remove(); this._handles = null
      }
      this.__map = m || null
      ;(MVC.prototype as any).set.call(this, 'map', m || null)
      if (m) {
        m._shapes.push(this)
        m._overlays.add(this)
        this._add()
        this._ohpDraw()
      }
    }
    getMap() { return this.__map }
    getVisible() { return this._visible() }
    setVisible(v: boolean) { this._o.visible = v; this._restyle(); this._ohpDraw() }
    getEditable() { return !!this._o.editable }
    setEditable(e: boolean) { this._o.editable = e; this._ohpDraw() }
    getDraggable() { return !!this._o.draggable }
    setDraggable(d: boolean) { this._o.draggable = d }
    setOptions(o: any) {
      const map = o && 'map' in o ? o.map : undefined
      const geo = this._takeGeometry(o || {})
      this._o = { ...this._o, ...o }
      delete this._o.map
      if (geo) this._update()
      this._restyle()
      if (map !== undefined) this.setMap(map)
      else this._ohpDraw()
    }
    _takeGeometry(_o: any) { return false }
    // Editable handles (Google's white dots), redrawn with the map.
    _handleBox() {
      const m = this.__map
      if (!this._handles) {
        this._handles = document.createElement('div')
        this._handles.style.cssText = 'position:absolute;left:0;top:0;'
      }
      if (this._handles.parentNode !== m._panes.overlayMouseTarget) m._panes.overlayMouseTarget.appendChild(this._handles)
      return this._handles
    }
    abstract _ohpDraw(): void
  }

  const pathOf = (p: any) => {
    if (!p) return new MVCArray([])
    if (p instanceof MVCArray) return p
    return new MVCArray((p as any[]).map(toLL))
  }
  class FPoly extends FShape {
    _kind: 'poly' | 'line' = 'poly'
    _paths: any
    _offs: any[] = []
    constructor(opts: any = {}, line = false) {
      super(opts)
      if (line) this._kind = 'line'
      this._setPaths(line ? opts.path : opts.paths)
      if (opts.map) this.setMap(opts.map)
    }
    _setPaths(p: any) {
      this._offs.forEach(l => l.remove())
      this._offs = []
      let arr: any[]
      if (!p) arr = [new MVCArray([])]
      else if (p instanceof MVCArray) {
        const first = p.getLength() ? p.getAt(0) : null
        arr = first instanceof MVCArray ? p.getArray() : [p]
      } else if (Array.isArray(p) && p.length && (Array.isArray(p[0]) || p[0] instanceof MVCArray)) arr = p.map(pathOf)
      else arr = [pathOf(p)]
      this._paths = new MVCArray(arr)
      arr.forEach((path: any) => ['set_at', 'insert_at', 'remove_at'].forEach(n => this._offs.push(ev.addListener(path, n, () => this._update()))))
      this._update()
    }
    _takeGeometry(o: any) {
      if (this._kind === 'line' && 'path' in o) { this._setPaths(o.path); delete o.path; return true }
      if (this._kind === 'poly' && 'paths' in o) { this._setPaths(o.paths); delete o.paths; return true }
      return false
    }
    _rings() { return this._paths.getArray().map((path: any) => path.getArray().map((ll: any) => [lngOf(ll), latOf(ll)])) }
    _geojson() {
      const rings = this._rings().filter((r: number[][]) => r.length)
      if (this._kind === 'line') return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: rings[0] || [] } }
      const closed = rings.filter((r: number[][]) => r.length >= 3).map((r: number[][]) => [...r, r[0]])
      return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: closed } }
    }
    getPath() { return this._paths.getAt(0) }
    setPath(p: any) { this._setPaths(p) }
    getPaths() { return this._paths }
    setPaths(p: any) { this._setPaths(p) }
    _ohpDraw() {
      const m = this.__map
      if (!m || this._dragging) return
      if (!this._o.editable || !this._visible()) { if (this._handles) this._handles.innerHTML = ''; return }
      const box = this._handleBox()
      box.innerHTML = ''
      this._paths.getArray().forEach((path: any) => {
        const n = path.getLength()
        for (let i = 0; i < n; i++) {
          const ll = path.getAt(i)
          const p = m._canvasProj.fromLatLngToDivPixel(ll)
          const h = document.createElement('div')
          h.style.cssText = handleCss(false)
          h.style.transform = `translate(${p.x}px, ${p.y}px)`
          dragHandle(m, this, h, to => path.setAt(i, to), () => ev.trigger(this, 'mouseup'))
          box.appendChild(h)
          // midpoint: dragging it adds a corner there
          const last = i === n - 1
          if (last && this._kind === 'line') continue
          if (n < 2) continue
          const nx = path.getAt(last ? 0 : i + 1)
          const mp = m._canvasProj.fromLatLngToDivPixel(new LatLng((latOf(ll) + latOf(nx)) / 2, (lngOf(ll) + lngOf(nx)) / 2))
          const mh = document.createElement('div')
          mh.style.cssText = handleCss(true)
          mh.style.transform = `translate(${mp.x}px, ${mp.y}px)`
          let added = false
          dragHandle(m, this, mh, to => {
            if (!added) { added = true; mh.style.opacity = '1'; path.insertAt(i + 1, to) } else path.setAt(i + 1, to)
          })
          box.appendChild(mh)
        }
      })
    }
  }
  class FPolygon extends FPoly { constructor(o: any = {}) { super(o, false) } }
  class FPolyline extends FPoly { constructor(o: any = {}) { super(o, true) } }

  const R = 6378137
  class FCircle extends FShape {
    _kind: 'circle' = 'circle'
    constructor(opts: any = {}) {
      super(opts)
      this._o.center = opts.center ? toLL(opts.center) : null
      this._o.radius = opts.radius ?? 0
      if (opts.map) this.setMap(opts.map)
    }
    _ring() {
      const c = this._o.center
      if (!c) return []
      const lat = latOf(c), lng = lngOf(c), r = this._o.radius || 0
      const out: number[][] = []
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * 2 * Math.PI
        const dLat = (r * Math.cos(a)) / R
        const lat2 = lat + (dLat * 180) / Math.PI
        const dLng = (r * Math.sin(a)) / (R * Math.cos(((lat + lat2) / 2) * Math.PI / 180))
        out.push([lng + (dLng * 180) / Math.PI, lat2])
      }
      return out
    }
    _geojson() { return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: this._o.center ? [this._ring()] : [] } } }
    _takeGeometry(o: any) {
      let ch = false
      if ('center' in o) { this._o.center = o.center ? toLL(o.center) : null; delete o.center; ch = true }
      if ('radius' in o) { this._o.radius = o.radius; delete o.radius; ch = true }
      return ch
    }
    getCenter() { return this._o.center }
    setCenter(c: any) { this._o.center = c ? toLL(c) : null; this._update(); ev.trigger(this, 'center_changed') }
    getRadius() { return this._o.radius }
    setRadius(r: number) { this._o.radius = r; this._update(); ev.trigger(this, 'radius_changed') }
    getBounds() {
      const c = this._o.center
      if (!c) return null
      const r = this._o.radius || 0
      const dLat = (r / R) * 180 / Math.PI
      const dLng = dLat / Math.cos((latOf(c) * Math.PI) / 180)
      return new LatLngBounds({ lat: latOf(c) - dLat, lng: lngOf(c) - dLng }, { lat: latOf(c) + dLat, lng: lngOf(c) + dLng })
    }
    _ohpDraw() {
      const m = this.__map
      if (!m || this._dragging) return
      if (!this._o.editable || !this._visible() || !this._o.center) { if (this._handles) this._handles.innerHTML = ''; return }
      const box = this._handleBox()
      box.innerHTML = ''
      const c = this._o.center
      const b = this.getBounds()!
      const spots = [
        { ll: c, center: true },
        { ll: new LatLng(b.getNorthEast().lat(), lngOf(c)) },
        { ll: new LatLng(latOf(c), b.getNorthEast().lng()) },
        { ll: new LatLng(b.getSouthWest().lat(), lngOf(c)) },
        { ll: new LatLng(latOf(c), b.getSouthWest().lng()) },
      ]
      spots.forEach(s => {
        const p = m._canvasProj.fromLatLngToDivPixel(s.ll)
        const h = document.createElement('div')
        h.style.cssText = handleCss(false)
        h.style.transform = `translate(${p.x}px, ${p.y}px)`
        if (s.center) dragHandle(m, this, h, to => this.setCenter(to))
        else dragHandle(m, this, h, to => this.setRadius(Math.max(1, gm.geometry.spherical.computeDistanceBetween(this._o.center, to))))
        box.appendChild(h)
      })
    }
  }

  const swap = (name: string, val: any) => {
    try { gm[name] = val } catch { Object.defineProperty(gm, name, { value: val, configurable: true, writable: true }) }
  }
  swap('Map', FMap)
  swap('OverlayView', FOverlayView)
  swap('Marker', FMarker)
  swap('Polygon', FPolygon)
  swap('Polyline', FPolyline)
  swap('Circle', FCircle)
}
