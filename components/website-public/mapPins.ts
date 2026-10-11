// IDX map search pins, drawn as real HTML in one Google Maps overlay instead of google.maps.Marker.
// Marker draws every label in a separate layer above every pin, so where homes overlap the price
// text of one pin shows through the next and the numbers jumble together. Here each pin is one
// solid element (its own background, border and text), and pins that would overlap at the current
// zoom merge into one "N homes" bubble; clicking that bubble zooms in to them. Styles: .ohp-pin in
// app/(sitepublic)/site-theme.css.

export interface PinItem { key: string; lat: number; lng: number; label: string }
export interface PinState { active: string | null; hover: string | null; seen: Set<string> }
export interface PinLayer {
  setItems(items: PinItem[]): void
  setState(state: PinState): void
  projection(): google.maps.MapCanvasProjection | null
  destroy(): void
}

const OVERLAP_X = 58
const OVERLAP_Y = 26

export function createPinLayer(map: google.maps.Map, on: { click(key: string): void; hover(key: string | null): void }): PinLayer {
  class Layer extends google.maps.OverlayView {
    items: PinItem[] = []
    state: PinState = { active: null, hover: null, seen: new Set() }
    root = document.createElement('div')
    groups: PinItem[][] = []

    constructor() {
      super()
      this.root.className = 'ohp-pins'
      this.root.addEventListener('click', e => {
        const el = (e.target as HTMLElement).closest('[data-pin]') as HTMLElement | null
        if (!el) return
        e.stopPropagation()
        const group = this.groups[Number(el.dataset.pin)]
        if (!group) return
        if (group.length === 1) { on.click(group[0].key); return }
        const b = new google.maps.LatLngBounds()
        group.forEach(p => b.extend({ lat: p.lat, lng: p.lng }))
        const z = map.getZoom() || 12
        // Same building (condos): zooming can't separate them - open the first one instead.
        if (z >= 18 || b.getNorthEast().equals(b.getSouthWest())) { on.click(group[0].key); return }
        map.fitBounds(b, 80)
      })
      this.root.addEventListener('mouseover', e => {
        const el = (e.target as HTMLElement).closest('[data-pin]') as HTMLElement | null
        const group = el ? this.groups[Number(el.dataset.pin)] : null
        if (group?.length === 1) on.hover(group[0].key)
      })
      this.root.addEventListener('mouseout', e => {
        const to = (e as MouseEvent).relatedTarget as HTMLElement | null
        if (!to || !to.closest?.('[data-pin]')) on.hover(null)
      })
    }
    onAdd() { this.getPanes()?.overlayMouseTarget.appendChild(this.root) }
    onRemove() { this.root.remove() }

    draw() {
      const proj = this.getProjection()
      if (!proj) return
      const pts = this.items.map(it => ({ it, p: proj.fromLatLngToDivPixel(new google.maps.LatLng(it.lat, it.lng)) }))
      const groups: { items: PinItem[]; x: number; y: number }[] = []
      pts.forEach(({ it, p }) => {
        if (!p) return
        const g = groups.find(g => Math.abs(g.x - p.x) < OVERLAP_X && Math.abs(g.y - p.y) < OVERLAP_Y)
        if (g) { g.items.push(it); g.x = (g.x * (g.items.length - 1) + p.x) / g.items.length; g.y = (g.y * (g.items.length - 1) + p.y) / g.items.length }
        else groups.push({ items: [it], x: p.x, y: p.y })
      })
      this.groups = groups.map(g => g.items)
      this.root.innerHTML = groups.map((g, i) => {
        const one = g.items.length === 1
        const text = one ? g.items[0].label : `${g.items.length} homes`
        return `<button type="button" data-pin="${i}" class="ohp-pin${one ? '' : ' ohp-pin-group'}" style="left:${Math.round(g.x)}px;top:${Math.round(g.y)}px">${text.replace(/</g, '&lt;')}</button>`
      }).join('')
      this.paint()
    }

    paint() {
      const { active, hover, seen } = this.state
      this.root.querySelectorAll<HTMLElement>('[data-pin]').forEach(el => {
        const group = this.groups[Number(el.dataset.pin)] || []
        const keys = group.map(g => g.key)
        const isActive = !!active && keys.includes(active)
        const isHover = !isActive && !!hover && keys.includes(hover)
        el.classList.toggle('is-active', isActive)
        el.classList.toggle('is-hover', isHover)
        el.classList.toggle('is-seen', group.length === 1 && seen.has(keys[0]) && !isActive && !isHover)
      })
    }
  }

  const layer = new Layer()
  layer.setMap(map)
  return {
    setItems(items) { layer.items = items; layer.draw() },
    setState(state) { layer.state = state; layer.paint() },
    projection: () => layer.getProjection() || null,
    destroy() { layer.setMap(null) },
  }
}
