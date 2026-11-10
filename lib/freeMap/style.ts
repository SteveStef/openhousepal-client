// Colors for the free backup map (OpenFreeMap's "liberty" street map), set to match the Google maps
// it stands in for. Every map in the app hands Google a short color list (google.maps.MapTypeStyle[]
// - the muted IDX look, the dark look, or nothing for Google's own default); the same list is read
// here and turned into colors for the free map's layers, so a map looks the same whichever one
// draws it. Only the handful of rules our maps actually use are understood (land, water, roads,
// highways, borders, label text, and "hide places / transit / road signs").

export const FREE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

type GStyle = { featureType?: string; elementType?: string; stylers?: Record<string, unknown>[] }

export interface Palette {
  land: string
  natural: string
  park: string
  water: string
  waterText: string
  building: string
  buildingLine: string
  road: string
  roadCasing: string
  arterial: string
  arterialCasing: string
  highway: string
  highwayCasing: string
  rail: string
  boundary: string
  text: string
  placeText: string
  halo: string
  airport: string
  hidePoi: boolean
  hideTransit: boolean
  hideShields: boolean
}

// Google's own current street map (colors sampled from our Google maps, 11/10): blue-grey main
// roads, pale blue-grey side streets, white streets up close.
const GOOGLE_DEFAULT: Palette = {
  land: '#f3f4f1',
  natural: '#e3eedb',
  park: '#c8e9cc',
  water: '#9cc8f2',
  waterText: '#4a7fb0',
  building: '#e8e9ec',
  buildingLine: '#dcdde1',
  road: '#ffffff',
  roadCasing: '#d6dee6',
  arterial: '#d0d9e6',
  arterialCasing: '#c3cddf',
  highway: '#abbcd6',
  highwayCasing: '#9eb0cd',
  rail: '#d5d8dd',
  boundary: '#a8abaf',
  text: '#5f6368',
  placeText: '#3c4043',
  halo: '#ffffff',
  airport: '#e8eaed',
  hidePoi: false,
  hideTransit: false,
  hideShields: false,
}

function stylerOf(rule: GStyle) {
  const out: { color?: string; visibility?: string } = {}
  ;(rule.stylers || []).forEach(s => {
    if (typeof s.color === 'string') out.color = s.color
    if (typeof s.visibility === 'string') out.visibility = s.visibility
  })
  return out
}

/** Google's color list -> one set of colors for the free map. */
export function paletteFrom(styles?: GStyle[] | null): Palette {
  const p: Palette = { ...GOOGLE_DEFAULT }
  let parkHidden = false
  let landSet = false
  for (const rule of styles || []) {
    const ft = rule.featureType || 'all'
    const et = rule.elementType || 'all'
    const { color, visibility } = stylerOf(rule)
    const geometry = et === 'all' || et.startsWith('geometry')
    if (ft === 'all') {
      if (color && geometry) {
        p.land = p.natural = p.park = p.building = p.buildingLine = p.airport = color
        p.road = p.roadCasing = p.arterial = p.arterialCasing = p.highway = p.highwayCasing = p.water = p.boundary = p.rail = color
        landSet = true
      }
      if (color && et === 'labels.text.fill') p.text = p.placeText = p.waterText = color
      if (color && et === 'labels.text.stroke') p.halo = color
      continue
    }
    if (ft === 'poi' || ft.startsWith('poi.')) {
      if (visibility === 'off') {
        p.hidePoi = true
        if (ft === 'poi' || ft === 'poi.park') parkHidden = true
      }
      if (color && geometry && (ft === 'poi' || ft === 'poi.park')) p.park = color
      continue
    }
    if (ft === 'transit' && visibility === 'off') { p.hideTransit = true; continue }
    if (ft === 'road' || ft.startsWith('road.')) {
      if (et === 'labels.icon' && visibility === 'off') { p.hideShields = true; continue }
      if (color && geometry) {
        if (ft === 'road.highway') p.highway = p.highwayCasing = color
        else if (ft === 'road.arterial') p.arterial = p.arterialCasing = color
        else if (ft === 'road') p.road = p.roadCasing = p.arterial = p.arterialCasing = p.highway = p.highwayCasing = color
        else p.road = p.roadCasing = color
      }
      continue
    }
    if (ft === 'water' && color && (geometry || et === 'all')) { p.water = color; continue }
    if (ft.startsWith('landscape') && color && geometry) {
      p.land = p.natural = p.building = p.buildingLine = p.airport = color
      landSet = true
      continue
    }
    if (ft.startsWith('administrative') && color && geometry) p.boundary = color
  }
  // Hidden places take their park patches with them (Google draws those as plain land).
  if (parkHidden) p.park = p.land
  if (landSet && parkHidden) p.natural = p.land
  return p
}

type Op = { layer: string; kind: 'paint' | 'layout'; prop: string; value: unknown }

const isHighway = (id: string) => /motorway|trunk_primary/.test(id)
const isArterial = (id: string) => /secondary_tertiary/.test(id)

/** The free map's layer changes for one palette (applied to the style before the map opens, or live). */
export function paletteOps(layers: { id: string; type: string; ['source-layer']?: string }[], p: Palette): Op[] {
  const ops: Op[] = []
  const paint = (layer: string, prop: string, value: unknown) => ops.push({ layer, kind: 'paint', prop, value })
  const show = (layer: string, on: boolean) => ops.push({ layer, kind: 'layout', prop: 'visibility', value: on ? 'visible' : 'none' })
  for (const l of layers) {
    const id = l.id
    const src = l['source-layer'] || ''
    if (l.type === 'background') { paint(id, 'background-color', p.land); continue }
    // Google shows none of these: relief shading, 3-D buildings, rail hatching, town/county lines.
    if (id === 'natural_earth' || id === 'building-3d' || id === 'road_area_pattern' || id.startsWith('road_one_way') || id === 'park_outline'
      || id === 'waterway_tunnel' || id.endsWith('_hatching') || id === 'boundary_3') { show(id, false); continue }
    if (id === 'park') { paint(id, 'fill-color', p.park); paint(id, 'fill-outline-color', p.park); paint(id, 'fill-opacity', 1); continue }
    if (src === 'landcover' || id === 'landuse_residential') {
      paint(id, 'fill-color', id === 'landuse_residential' || id === 'landcover_ice' || id === 'landcover_sand' ? p.land : p.natural)
      if (id === 'landuse_residential') paint(id, 'fill-opacity', 1)
      continue
    }
    if (src === 'landuse') {
      paint(id, 'fill-color', p.hidePoi ? p.land : (id === 'landuse_cemetery' || id === 'landuse_pitch' ? p.park : p.airport))
      continue
    }
    if (id === 'water') { paint(id, 'fill-color', p.water); continue }
    if (src === 'waterway' && l.type === 'line') { paint(id, 'line-color', p.water); continue }
    if (src === 'aeroway') { paint(id, l.type === 'fill' ? 'fill-color' : 'line-color', p.airport); continue }
    if (id === 'building') { paint(id, 'fill-color', p.building); paint(id, 'fill-outline-color', p.buildingLine); continue }
    if (src === 'transportation' && l.type === 'line') {
      if (/rail/.test(id)) {
        show(id, !p.hideTransit)
        paint(id, 'line-color', p.rail)
        continue
      }
      const casing = id.endsWith('_casing')
      const hw = isHighway(id)
      const art = isArterial(id)
      paint(id, 'line-color', casing
        ? (hw ? p.highwayCasing : art ? p.arterialCasing : p.roadCasing)
        : (id.includes('path_pedestrian') ? p.roadCasing : hw ? p.highway : art ? p.arterial : p.road))
      if (id.startsWith('tunnel_')) paint(id, 'line-opacity', 0.7)
      continue
    }
    if (src === 'boundary') { paint(id, 'line-color', p.boundary); continue }
    if (l.type === 'symbol') {
      if (src === 'poi' || id === 'airport') { show(id, !p.hidePoi) }
      if (/shield/.test(id)) { show(id, !p.hideShields); continue }
      const place = id === 'label_town' || id === 'label_city' || id === 'label_city_capital' || id === 'label_village'
      paint(id, 'text-color', src === 'water_name' || id.startsWith('waterway') ? p.waterText : place ? p.placeText : p.text)
      paint(id, 'text-halo-color', p.halo)
      // Google's neighborhood names are small plain capitals, not italics.
      if (id === 'label_other') ops.push({ layer: id, kind: 'layout', prop: 'text-font', value: ['Noto Sans Regular'] })
    }
  }
  return ops
}

/** Bakes a palette into a style document (the free map opens already in the right colors). */
export function applyToStyle(style: { layers: { id: string; type: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> }[] }, p: Palette) {
  const byId = new Map(style.layers.map(l => [l.id, l]))
  for (const op of paletteOps(style.layers, p)) {
    const l = byId.get(op.layer)
    if (!l) continue
    const bag = (l[op.kind] = l[op.kind] || {})
    bag[op.prop] = op.value
  }
  return style
}
