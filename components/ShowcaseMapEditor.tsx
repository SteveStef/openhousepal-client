'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Map as MapIcon, LayoutGrid, Columns2, Pencil, RotateCcw, Loader2, AlertTriangle, SlidersHorizontal, ArrowLeft, Check, Sparkles, DollarSign, BedDouble, Ruler, Crosshair, Home as HomeIcon, Heart, Scale, MapPin, Target } from 'lucide-react'
import { Collection, CollectionPreferences, Property } from '@/types'
import api from '@/lib/api-service'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import GooglePlacesAutocomplete, { GooglePlacesAutocompleteRef } from './GooglePlacesAutocomplete'
import MultiSelectDatabaseInput from './MultiSelectDatabaseInput'
import { PropertyRecommendationCard } from './PropertyRecommendationCard'
import PropertySearchPicker from './PropertySearchPicker'
import OhpLoader from './brand/OhpLoader'
import FlowDock from './ui/FlowDock'
import BoundaryCanvas, { CanvasBadge, CanvasShape } from './maps/BoundaryCanvas'
import MapPopup from './maps/MapPopup'
import MapPropertyCard, { mapCardSpecs } from './maps/MapPropertyCard'
import { formatStatus, statusBadgeColor } from './website-public/listingFormat'
import { formatNumberWithCommas, stripCommas, normalizeImageUrl } from '@/lib/utils'
import { STATE_CENTERS, US_FALLBACK_CENTER } from '@/lib/usStateCenters'
import { homesLabel, SHOWCASE_MAX_HOMES } from '@/lib/showcaseLimit'
import ShowcaseLimitNote from '@/components/showcases/ShowcaseLimitNote'

// Restrained light-blue treatment for every geographic overlay (radius circle, drawn polygon) -
// deliberately distinct from the brand gold ([#C9A24D]), which stays reserved for selection/accent
// states elsewhere in the app. Keeps the overlays reading as "this is the search area", not as a
// selected/active UI element.
const BLUE = '#3B82F6'
const MILES_TO_METERS = 1609.34

function formatRadiusMiles(miles?: number | null) {
  if (!miles || miles <= 0) return null
  const rounded = Math.round(miles * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

// An `editable: true` Polygon draws a small drag-handle at every vertex AND at every midpoint
// between vertices - useful for a handful of points, but a freehand-dragged path can easily have
// 100+ closely-spaced points, which turns those handles into what looks like a ring of dots
// instead of a clean outline. Douglas-Peucker thins the path down to just the points that matter
// for the shape before it becomes the final editable polygon; a hard cap is a backstop for
// unusually long/complex drags DP alone doesn't reduce enough.
function simplifyPath(points: google.maps.LatLng[], toleranceDegrees = 0.0006, maxPoints = 18): google.maps.LatLng[] {
  if (points.length <= 3) return points

  const perpendicularDistance = (p: google.maps.LatLng, a: google.maps.LatLng, b: google.maps.LatLng) => {
    const x = p.lng(), y = p.lat(), x1 = a.lng(), y1 = a.lat(), x2 = b.lng(), y2 = b.lat()
    const dx = x2 - x1, dy = y2 - y1
    if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1)
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
  }

  const douglasPeucker = (pts: google.maps.LatLng[]): google.maps.LatLng[] => {
    if (pts.length <= 2) return pts
    let maxDist = 0, index = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1])
      if (dist > maxDist) { maxDist = dist; index = i }
    }
    if (maxDist <= toleranceDegrees) return [pts[0], pts[pts.length - 1]]
    const left = douglasPeucker(pts.slice(0, index + 1))
    const right = douglasPeucker(pts.slice(index))
    return [...left.slice(0, -1), ...right]
  }

  let simplified = douglasPeucker(points)
  if (simplified.length > maxPoints) {
    const step = Math.ceil(simplified.length / maxPoints)
    simplified = simplified.filter((_, i) => i % step === 0 || i === simplified.length - 1)
  }
  return simplified
}

type ViewMode = 'map' | 'grid' | 'split'
type AreaShape = { kind: 'town' | 'school_district' | 'county'; label: string; query: string; rings: number[][][]; zips?: string[] | null }

// Search-area highlight colours: towns gold, school districts in blues/greens, counties violet.
const AREA_COLORS = { town: ['#C9A24D', '#d97706', '#b45309'], school_district: ['#2563eb', '#059669', '#0891b2', '#4f46e5'], county: ['#7c3aed', '#a21caf'] }
const shortAreaName = (s: AreaShape) => s.kind === 'school_district'
  ? s.label.replace(/\s*(School District|Public Schools|Schools|Unified District|District)\s*$/i, '').replace(/^(The )?School District of (the )?/i, '').trim() || s.label
  : s.kind === 'county' ? s.label.replace(/\s+County$/i, '') : s.label
type GeoMode = 'address' | 'area' | 'polygon' | 'none'

type FormState = Pick<CollectionPreferences,
  | 'address' | 'lat' | 'long' | 'diameter' | 'search_polygon'
  | 'cities' | 'townships' | 'school_districts' | 'counties'
  | 'min_price' | 'max_price' | 'min_beds' | 'max_beds' | 'min_baths' | 'max_baths'
  | 'min_year_built' | 'max_year_built' | 'min_sqft' | 'max_sqft' | 'min_acres' | 'max_acres'
  | 'special_features'
  | 'is_town_house' | 'is_lot_land' | 'is_condo' | 'is_multi_family'
  | 'is_single_family' | 'is_apartment' | 'is_commercial' | 'is_farm'
  | 'compare_property_listing_key' | 'show_match_score'
>

const EMPTY_FORM: FormState = {
  address: '', lat: null, long: null, diameter: null, search_polygon: null,
  cities: [], townships: [], school_districts: [], counties: [],
  min_price: null, max_price: null, min_beds: null, max_beds: null, min_baths: null, max_baths: null,
  min_year_built: null, max_year_built: null, min_sqft: null, max_sqft: null, min_acres: null, max_acres: null,
  special_features: '',
  is_town_house: false, is_lot_land: false, is_condo: false, is_multi_family: false,
  is_single_family: false, is_apartment: false, is_commercial: false, is_farm: false,
  compare_property_listing_key: null, show_match_score: true,
}

const PROPERTY_TYPE_LABELS: Array<[keyof FormState, string]> = [
  ['is_single_family', 'Single Family'],
  ['is_condo', 'Condo'],
  ['is_town_house', 'Townhouse'],
  ['is_apartment', 'Rentals'],
  ['is_multi_family', 'Multi-Family'],
  ['is_lot_land', 'Lot/Land'],
  ['is_commercial', 'Commercial'],
  ['is_farm', 'Farm'],
]

interface ShowcaseMapEditorProps {
  collection: Collection | null
  isOpen: boolean
  onClose: () => void
  onSave: (collectionId: string, preferences: Partial<CollectionPreferences>) => Promise<void>
  // The agent's own service state (User.state, e.g. "PA") - used only as a local, zero-cost
  // default map view when the showcase has no search area defined yet. Never geocoded.
  agentState?: string | null
  // Creating a new showcase: this is the last step of the create flow. Back returns to the
  // client steps (keeping what's set here) and Save creates the showcase.
  create?: { clientName: string; onBack: (draft: Partial<CollectionPreferences>) => void }
}

// Opens and closes with motion (fresh each time it opens). Rendered at the end of <body> so an
// animated page around it can't trap the full-screen window inside its own box.
export default function ShowcaseMapEditor(props: ShowcaseMapEditorProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(<AnimatePresence>{props.isOpen && <ShowcaseMapEditorWindow key="showcase-editor" {...props} />}</AnimatePresence>, host)
}

function ShowcaseMapEditorWindow({ collection, isOpen, onClose, onSave, agentState, create }: ShowcaseMapEditorProps) {
  const googleAutocompleteRef = useRef<GooglePlacesAutocompleteRef>(null)
  const locationSectionRef = useRef<HTMLElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  // Multiple independent shapes are supported (the backend's ray-casting polygon filter already
  // ORs any number of polygons together - see areas/geography.py's _polygon_filter), so this is an
  // array, not a single ref: a live in-progress drag polygon during drawing plus zero or more
  // already-finished, still-editable shapes an agent has drawn so far.
  const polygonsRef = useRef<google.maps.Polygon[]>([])
  const livePolygonRef = useRef<google.maps.Polygon | null>(null)
  // google.maps.drawing.DrawingManager was removed from the Maps JavaScript API as of v3.65 (the
  // installed @types/google.maps confirms this - the class ships with zero methods) - hand-rolled
  // freehand press-drag-release drawing below is the current supported replacement pattern: a
  // Compass-style "draw a shape" gesture, not click-to-place-each-vertex.
  const drawMouseDownListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const drawMouseMoveListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const drawMouseUpListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  // Backstop for releasing the mouse button outside the map's own element (e.g. dragged off the
  // edge onto the sidebar) - the map's own 'mouseup' only fires for releases over the map itself.
  const drawWindowMouseUpListenerRef = useRef<(() => void) | null>(null)
  const isDrawingPointerDownRef = useRef(false)
  // Drawing works like the IDX map search's "Draw an area" (PropertyMapSearch): a see-through
  // layer over the map takes the finger / mouse (pointer events, so phones work too), a live
  // line follows it, and letting go turns it into the shape. drawProjRef turns a screen point
  // into a map point; drawLineRef is the live line.
  const drawProjRef = useRef<google.maps.OverlayView | null>(null)
  const drawLineRef = useRef<google.maps.Polyline | null>(null)
  const drawPxRef = useRef<{ x: number; y: number } | null>(null)
  const drawPathRef = useRef<google.maps.LatLng[]>([])
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  // The home whose little card is open on the map (MapPopup keeps it inside the map, 10/25).
  const [popupId, setPopupId] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  // Below the tablet breakpoint the panel/map/grid don't fit side-by-side at all, so mobile gets
  // its own 3-way tab switcher instead of viewMode's Map/Grid/Both toggle (which stays for
  // tablet+, where there's room to show the panel and content together).
  // Phones always open on Criteria first - editing and creating alike (user, 10/24). The map still
  // builds behind it at full size (see the main column below), so the Map tab is instant.
  const [mobileTab, setMobileTab] = useState<'criteria' | 'map' | 'grid'>('criteria')
  const [isDrawing, setIsDrawing] = useState(false)
  // Refs don't trigger re-renders, so this mirrors polygonsRef.current.length purely so the
  // "Shape 1 / Shape 2 / ..." remove-list in the left panel can actually reflect the shape count.
  const [shapeCount, setShapeCount] = useState(0)
  const [isPlacingCenter, setIsPlacingCenter] = useState(false)
  const placeCenterMouseDownListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const placeCenterMouseMoveListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const placeCenterMouseUpListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  // Backstop for releasing outside the map element, same reasoning as the Draw gesture's own.
  const placeCenterWindowMouseUpListenerRef = useRef<(() => void) | null>(null)
  const isPlacingCenterPointerDownRef = useRef(false)
  const placeCenterOriginRef = useRef<google.maps.LatLng | null>(null)
  const placeCenterPreviewCircleRef = useRef<google.maps.Circle | null>(null)
  const [previewProperties, setPreviewProperties] = useState<Property[]>([])
  const [previewCount, setPreviewCount] = useState(0)
  // More homes match than a Showcase holds (lib/showcaseLimit): counts say "100+" + a tighten-it note.
  const [previewAtLimit, setPreviewAtLimit] = useState(false)
  const countLabel = homesLabel(previewCount, previewAtLimit)
  const atLimit = previewAtLimit || previewCount > SHOWCASE_MAX_HOMES
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  // Homes already in this Showcase - the client's liked / commented / toured ones always stay,
  // even when the new search wouldn't find them (backend repopulate_collection_from_preferences).
  const [currentHomes, setCurrentHomes] = useState<any[]>([])
  const [keepNotice, setKeepNotice] = useState(false)
  // The real lines of the picked towns / school districts / counties (Census, via the backend).
  const [areaShapes, setAreaShapes] = useState<AreaShape[]>([])
  const [areaShapesLoading, setAreaShapesLoading] = useState(false)
  const [isDarkUi, setIsDarkUi] = useState(false)
  // True for a beat after Map / Both / Grid changes the map's size - a soft cover hides the grey
  // strip Google shows while it fills in the newly exposed tiles.
  const [mapSettling, setMapSettling] = useState(false)
  const [displayRadiusMiles, setDisplayRadiusMiles] = useState<number | null>(null)
  const [mapLoadError, setMapLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  // Match-score "compare against" property - address is display-only (for "Comparing to: ...");
  // the thing that actually gets saved is formData.compare_property_listing_key.
  const [compareAddress, setCompareAddress] = useState<string | null>(null)
  const [showComparePicker, setShowComparePicker] = useState(false)

  const geoMode: GeoMode =
    formData.search_polygon ? 'polygon' :
    formData.address ? 'address' :
    ((formData.cities?.length || formData.school_districts?.length || formData.counties?.length)) ? 'area' :
    'none'
  const radiusDisplayLabel = formatRadiusMiles(displayRadiusMiles ?? formData.diameter)

  // --- Load initial preferences whenever the editor opens for a (possibly different) collection ---
  useEffect(() => {
    if (isOpen) {
      const p = collection?.preferences as CollectionPreferences | undefined
      setFormData({
        address: p?.address || '', lat: p?.lat ?? null, long: p?.long ?? null,
        diameter: p?.diameter || null, search_polygon: p?.search_polygon ?? null,
        cities: p?.cities || [], townships: p?.townships || [], school_districts: p?.school_districts || [],
        // Older form-built Showcases kept the county only in the single `county` text field.
        counties: p?.counties?.length ? p.counties : ((p as any)?.county ? String((p as any).county).split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 2) : []),
        min_price: p?.min_price ?? null, max_price: p?.max_price ?? null,
        min_beds: p?.min_beds ?? null, max_beds: p?.max_beds ?? null,
        min_baths: p?.min_baths ?? null, max_baths: p?.max_baths ?? null,
        min_year_built: p?.min_year_built ?? null, max_year_built: p?.max_year_built ?? null,
        min_sqft: p?.min_sqft ?? null, max_sqft: p?.max_sqft ?? null,
        min_acres: p?.min_acres ?? null, max_acres: p?.max_acres ?? null,
        special_features: p?.special_features || '',
        is_town_house: !!p?.is_town_house, is_lot_land: !!p?.is_lot_land, is_condo: !!p?.is_condo,
        is_multi_family: !!p?.is_multi_family, is_single_family: !!p?.is_single_family,
        is_apartment: !!p?.is_apartment, is_commercial: !!p?.is_commercial, is_farm: !!p?.is_farm,
        compare_property_listing_key: p?.compare_property_listing_key ?? null,
        show_match_score: p?.show_match_score !== false,
      })
      setCompareAddress(collection?.originalProperty?.FullStreetAddress || null)
      setShowComparePicker(false)
      setLocationError('')
      setFocusedId(null)
      setIsPlacingCenter(false)
    }
  }, [isOpen, collection])

  // --- Live, unsaved preview - debounced, reuses the exact PropertyService function Save uses ---
  useEffect(() => {
    if (!isOpen) return
    const hasGeo = geoMode !== 'none'
    if (!hasGeo) {
      setPreviewProperties([])
      setPreviewCount(0)
      setPreviewAtLimit(false)
      return
    }
    setIsLoadingPreview(true)
    const timeoutId = setTimeout(async () => {
      const { success, data } = await api.collections.previewMatches(formData)
      if (success && data) {
        setPreviewProperties(data.properties || [])
        setPreviewCount(data.count || 0)
        setPreviewAtLimit(!!data.at_limit)
      }
      setIsLoadingPreview(false)
    }, 450)
    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, JSON.stringify(formData)])

  // --- Map init: ONCE per editor session, never re-instantiated on filter changes (each
  // `new google.maps.Map(...)` call is a separately-billed map load) - only markers/overlays update.
  // Reads collection.preferences directly (not `formData`) for the starting center/zoom: `formData`
  // is only populated by a separate effect on the same `isOpen` change, so at the instant this
  // effect runs on a fresh open it would still hold last render's (possibly stale/empty) values. ---
  useEffect(() => {
    if (!isOpen || !mapDivRef.current) return
    let cancelled = false

    googleMapsLoader.load().then(() => {
      if (cancelled || !mapDivRef.current) return
      const savedPrefs = collection?.preferences as CollectionPreferences | undefined
      const hasSavedAddress = !!(savedPrefs?.lat && savedPrefs?.long)
      const stateCenter = (agentState && STATE_CENTERS[agentState.toUpperCase()]) || null

      const center = hasSavedAddress
        ? { lat: savedPrefs!.lat as number, lng: savedPrefs!.long as number }
        : { lat: stateCenter?.lat ?? US_FALLBACK_CENTER.lat, lng: stateCenter?.lng ?? US_FALLBACK_CENTER.lng }
      // No saved search area yet: default to the agent's own state, zoomed way out - never start
      // the editor zoomed into an arbitrary/wrong spot before the agent has chosen anything.
      const zoom = hasSavedAddress ? 11 : (stateCenter?.zoom ?? US_FALLBACK_CENTER.zoom)

      const map = new google.maps.Map(mapDivRef.current, {
        center,
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      })
      mapRef.current = map
      // The container's real size isn't settled until after this paint (it's laid out via CSS
      // Grid/flex, not a fixed px height like the app's other maps), so the map can construct
      // itself against a stale 0x0 measurement and render nothing. Re-measuring on the next frame
      // and re-centering (resize alone can leave the viewport anchored to the bad measurement)
      // fixes it without waiting on a Maps-internal event that may already have fired too early.
      requestAnimationFrame(() => {
        google.maps.event.trigger(map, 'resize')
        map.setCenter(center)
      })
      setMapLoaded(true)
    }).catch(() => {
      if (!cancelled) setMapLoadError("Map couldn't load. Double-check the Maps JavaScript API is enabled for this Google Cloud project.")
    })

    return () => {
      cancelled = true
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current.clear()
      circleRef.current?.setMap(null)
      polygonsRef.current.forEach(p => p.setMap(null))
      polygonsRef.current = []
      livePolygonRef.current?.setMap(null)
      livePolygonRef.current = null
      drawLineRef.current?.setMap(null)
      drawLineRef.current = null
      drawProjRef.current?.setMap(null)
      drawProjRef.current = null
      drawMouseDownListenerRef.current?.remove()
      drawMouseMoveListenerRef.current?.remove()
      drawMouseUpListenerRef.current?.remove()
      if (drawWindowMouseUpListenerRef.current) {
        window.removeEventListener('mouseup', drawWindowMouseUpListenerRef.current)
        window.removeEventListener('touchend', drawWindowMouseUpListenerRef.current)
      }
      placeCenterMouseDownListenerRef.current?.remove()
      placeCenterMouseMoveListenerRef.current?.remove()
      placeCenterMouseUpListenerRef.current?.remove()
      if (placeCenterWindowMouseUpListenerRef.current) {
        window.removeEventListener('mouseup', placeCenterWindowMouseUpListenerRef.current)
        window.removeEventListener('touchend', placeCenterWindowMouseUpListenerRef.current)
      }
      placeCenterPreviewCircleRef.current?.setMap(null)
      setPopupId(null)
      mapRef.current = null
      circleRef.current = null
      setMapLoaded(false)
      setIsDrawing(false)
      setIsPlacingCenter(false)
      setShapeCount(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, collection?.id, agentState])

  // --- Re-measure the map whenever the Map/Grid/Both toggle changes its container's box size -
  // otherwise the map keeps rendering against whatever size it had at construction time. ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const center = map.getCenter()
    setMapSettling(true)
    const done = () => setMapSettling(false)
    const fallback = window.setTimeout(done, 900)
    const idle = google.maps.event.addListenerOnce(map, 'idle', () => window.setTimeout(done, 120))
    requestAnimationFrame(() => {
      google.maps.event.trigger(map, 'resize')
      if (center) map.setCenter(center)
    })
    return () => { window.clearTimeout(fallback); idle.remove() }
  }, [viewMode, mapLoaded, mobileTab])

  const polygonToRing = (polygon: google.maps.Polygon): number[][] => {
    const path = polygon.getPath()
    const coordinates: number[][] = []
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      coordinates.push([point.lng(), point.lat()])
    }
    if (coordinates.length > 0) coordinates.push(coordinates[0]) // close the ring
    return coordinates
  }

  // Rebuilds formData.search_polygon from every currently-persisted shape - a single Polygon if
  // there's just one, a MultiPolygon if there are several. The backend's ray-casting filter
  // (areas/geography.py's _polygon_filter) already ORs any number of polygons together, so no
  // backend change was needed to support multiple shapes.
  const syncPolygonsToForm = () => {
    const rings = polygonsRef.current.map(polygonToRing).filter(ring => ring.length >= 4)
    if (rings.length === 0) {
      setFormData(prev => ({ ...prev, search_polygon: null }))
      return
    }
    const geometry = rings.length === 1
      ? { type: 'Polygon' as const, coordinates: [rings[0]] }
      : { type: 'MultiPolygon' as const, coordinates: rings.map(ring => [ring]) }
    // Geography criteria stack (address+radius, towns/school-districts/counties, and drawn shapes
    // can all be active together - the backend already ORs across all of them), so this no longer
    // clears any other geo field.
    setFormData(prev => ({ ...prev, search_polygon: geometry }))
  }

  // Every persisted shape stays individually editable - dragging any of its points re-syncs all
  // shapes together into the one search_polygon field.
  const attachPolygonSyncListeners = (polygon: google.maps.Polygon) => {
    const path = polygon.getPath()
    path.addListener('set_at', syncPolygonsToForm)
    path.addListener('insert_at', syncPolygonsToForm)
    path.addListener('remove_at', syncPolygonsToForm)
  }

  const removeShape = (index: number) => {
    const polygon = polygonsRef.current[index]
    if (!polygon) return
    polygon.setMap(null)
    polygonsRef.current = polygonsRef.current.filter((_, i) => i !== index)
    setShapeCount(polygonsRef.current.length)
    syncPolygonsToForm()
  }

  // --- Radius circle: create/update in place, never recreated from scratch on every keystroke ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (!formData.lat || !formData.long) {
      circleRef.current?.setMap(null)
      circleRef.current = null
      setDisplayRadiusMiles(null)
      return
    }

    const center = { lat: formData.lat, lng: formData.long }
    const radiusMeters = (formData.diameter || 2) * MILES_TO_METERS

    if (!circleRef.current) {
      const circle = new google.maps.Circle({
        map, center, radius: radiusMeters,
        editable: true, draggable: false,
        fillColor: BLUE, fillOpacity: 0.1, strokeColor: BLUE, strokeOpacity: 0.65, strokeWeight: 2,
      })
      circleRef.current = circle
      setDisplayRadiusMiles(formData.diameter || 2)
      circle.addListener('radius_changed', () => {
        const miles = Math.max(0.1, Math.round((circle.getRadius() / MILES_TO_METERS) * 10) / 10)
        setDisplayRadiusMiles(miles)
        setFormData(prev => (prev.diameter === miles ? prev : { ...prev, diameter: miles }))
      })
      map.fitBounds(circle.getBounds() as google.maps.LatLngBounds)
    } else {
      circleRef.current.setCenter(center)
      const currentMeters = circleRef.current.getRadius()
      if (Math.abs(currentMeters - radiusMeters) > 1) circleRef.current.setRadius(radiusMeters)
      setDisplayRadiusMiles(formData.diameter || 2)
    }
  }, [mapLoaded, geoMode, formData.lat, formData.long, formData.diameter])

  // --- Polygon shapes stay synced if formData.search_polygon changes from outside a live draw
  // (e.g. loading a previously-saved Polygon/MultiPolygon when the editor first opens) ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    if (!formData.search_polygon) {
      if (!isDrawing) {
        polygonsRef.current.forEach(p => p.setMap(null))
        polygonsRef.current = []
        setShapeCount(0)
      }
      return
    }
    if (polygonsRef.current.length > 0) return // already showing the live-drawn/edited shapes, don't clobber them

    const geometry = formData.search_polygon
    const rings: number[][][] = geometry.type === 'MultiPolygon'
      ? (geometry.coordinates as number[][][][]).map(polygon => polygon[0]).filter(Boolean)
      : [(geometry.coordinates as number[][][])[0]].filter(Boolean)

    const bounds = new google.maps.LatLngBounds()
    const newPolygons: google.maps.Polygon[] = []
    rings.forEach(ring => {
      const path = ring.map(([lng, lat]) => ({ lat, lng }))
      path.forEach(pt => bounds.extend(pt))
      const polygon = new google.maps.Polygon({
        map, paths: path, editable: true,
        fillColor: BLUE, fillOpacity: 0.12, strokeColor: BLUE, strokeOpacity: 0.7, strokeWeight: 2,
      })
      attachPolygonSyncListeners(polygon)
      newPolygons.push(polygon)
    })
    polygonsRef.current = newPolygons
    setShapeCount(newPolygons.length)
    if (!bounds.isEmpty()) map.fitBounds(bounds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, geoMode])

  // Bigger, darker-gold pin for whichever property is currently focused (clicked on the map or
  // selected in the grid) - a plain thin ring around the grid card wasn't noticeable enough on its
  // own, so the map side needed its own unmistakable "this one" signal too.
  const markerIcon = (isFocused: boolean): google.maps.Symbol => ({
    path: google.maps.SymbolPath.CIRCLE,
    scale: isFocused ? 11 : 7,
    fillColor: isFocused ? '#8b7355' : '#C9A24D',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: isFocused ? 3 : 2,
  })

  // Shared by a real marker click AND a grid-card click - sets focus, swaps marker icons, and
  // opens the home's map card. Deliberately does NOT scroll the grid: that's only wanted when a map
  // click reveals which card it corresponds to, not when clicking a card scrolls itself around.
  const focusProperty = (id: string) => {
    setFocusedId(id)
    markersRef.current.forEach((m, markerId) => {
      m.setIcon(markerIcon(markerId === id))
      m.setZIndex(markerId === id ? 999 : 1)
    })
    const marker = markersRef.current.get(id)
    if (!marker) return
    // Picked from the grid while its pin is off the map: bring the pin into view first.
    const pos = marker.getPosition()
    const map = mapRef.current
    if (map && pos && !map.getBounds()?.contains(pos)) map.panTo(pos)
    setPopupId(id)
  }

  // The open home's card: picture-left, info-right (no taller than the old mini card).
  const popupHome = popupId ? previewProperties.find(p => String((p as any).id || p.ListingKey) === popupId && p.Latitude != null && p.Longitude != null) || null : null
  const popupCard = (property: Property) => {
    const dom = property.DaysOnMarket
    const status = formatStatus(property.MlsStatus)
    const badge = statusBadgeColor(property.MlsStatus)
    const lotSqft = property.LotSizeSquareFeet
    return (
      <MapPropertyCard
        layout="row"
        photo={normalizeImageUrl(property.ListPictureURL || (property as any).imageUrl || '') || null}
        price={property.ListPrice ? `$${Number(property.ListPrice).toLocaleString()}` : null}
        priceNote={dom != null ? `${dom} ${dom === 1 ? 'day' : 'days'} on mkt` : null}
        status={status ? { label: status, bg: badge.bg, fg: badge.fg } : null}
        street={property.FullStreetAddress || 'Property'}
        place={property.City || null}
        specs={mapCardSpecs({ beds: property.BedroomsTotal, baths: property.BathroomsTotal, sqft: property.LivingArea, acres: (property as any).LotSizeAcres ?? (lotSqft ? lotSqft / 43560 : null) })}
        onClose={() => setPopupId(null)}
      />
    )
  }

  useEffect(() => {
    if (!isOpen || create || !collection?.id) { setCurrentHomes([]); return }
    let cancelled = false
    api.collections.getProperties(collection.id).then(r => {
      if (!cancelled && r.success) setCurrentHomes(Array.isArray(r.data) ? r.data : (r.data?.properties || []))
    })
    return () => { cancelled = true }
  }, [isOpen, create, collection?.id])

  const keepReason = (h: any) => [h.liked ? 'Liked' : '', (h.comments?.length || h.unreadCommentCount) ? 'Commented' : '', h.tourCount ? 'Tour asked' : ''].filter(Boolean).join(' · ')
  const previewIds = new Set(previewProperties.map(p => String((p as any).id || p.ListingKey)))
  // Engaged homes the new search drops - they stay in the Showcase; shown first, marked.
  const keptHomes = geoMode === 'none' ? [] : currentHomes.filter(h => keepReason(h) && !previewIds.has(String(h.id || h.ListingKey)))

  // --- Search-area highlight: the picked towns / districts / counties drawn with their real lines ---
  const areaKey = JSON.stringify([formData.cities || [], formData.school_districts || [], formData.counties || []])
  useEffect(() => {
    if (!isOpen) return
    const [cities, school_districts, counties] = JSON.parse(areaKey) as string[][]
    if (!cities.length && !school_districts.length && !counties.length) { setAreaShapes([]); return }
    let cancelled = false
    setAreaShapesLoading(true)
    const t = setTimeout(() => {
      api.properties.areaShapes({ cities, school_districts, counties })
        .then(r => { if (!cancelled) setAreaShapes(r.data?.shapes || []) })
        .catch(() => { if (!cancelled) setAreaShapes([]) })
        .finally(() => { if (!cancelled) setAreaShapesLoading(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [isOpen, areaKey])

  useEffect(() => {
    const read = () => setIsDarkUi(document.documentElement.classList.contains('dark'))
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  // Glide to the highlighted areas whenever the set changes - framing everything the search covers
  // at once (a radius or drawn shape the agent also has stays in view with them).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !areaShapes.length) return
    const b = new google.maps.LatLngBounds()
    areaShapes.forEach(sh => sh.rings.forEach(r => r.forEach(([lng, lat]) => b.extend({ lat, lng }))))
    const circleBounds = circleRef.current?.getBounds()
    if (circleBounds) b.union(circleBounds)
    polygonsRef.current.forEach(pg => pg.getPath().forEach(pt => b.extend(pt)))
    if (!b.isEmpty()) map.fitBounds(b, 48)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaShapes, mapLoaded])

  const areaCanvasShapes: CanvasShape[] = areaShapes.map((sh, i) => {
    const pal = AREA_COLORS[sh.kind]
    const n = areaShapes.slice(0, i).filter(x => x.kind === sh.kind).length
    return { id: `${sh.kind}:${sh.query}`, rings: sh.rings, color: pal[n % pal.length], fill: sh.kind === 'county' ? 0.06 : 0.12, width: sh.kind === 'town' ? 3 : 2.5 }
  })
  const areaBadges: CanvasBadge[] = areaShapes.map((sh, i) => ({
    id: `b:${sh.kind}:${sh.query}`, shapeId: `${sh.kind}:${sh.query}`, title: shortAreaName(sh),
    sub: sh.kind === 'town' ? (sh.zips?.length ? `Town · ZIP ${sh.zips.slice(0, 2).join(', ')}${sh.zips.length > 2 ? '…' : ''}` : 'Town') : sh.kind === 'school_district' ? 'School district' : 'County',
    color: areaCanvasShapes[i].color, icon: sh.kind === 'school_district' ? 'school' : sh.kind === 'county' ? 'county' : 'town',
  }))
  const homePins = previewProperties.filter(p => p.Latitude != null && p.Longitude != null).slice(0, 300).map(p => ({ lat: p.Latitude as number, lng: p.Longitude as number }))

  // --- Property pins: rebuilt whenever the preview result set changes, map instance persists ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current.clear()

    const withCoords = previewProperties.filter(p => p.Latitude != null && p.Longitude != null)
    if (withCoords.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    withCoords.forEach(property => {
      const position = { lat: property.Latitude as number, lng: property.Longitude as number }
      bounds.extend(position)
      const id = String((property as any).id || property.ListingKey)
      const marker = new google.maps.Marker({
        map, position, title: property.FullStreetAddress || 'Property',
        icon: markerIcon(id === focusedId),
        zIndex: id === focusedId ? 999 : 1,
      })
      marker.addListener('click', () => {
        focusProperty(id)
        cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      markersRef.current.set(id, marker)
    })

    // Only auto-fit when there's no active radius/polygon shape dictating the view already -
    // otherwise every preview refresh would fight the agent's own drawn/dragged search area.
    if (geoMode === 'area' && !areaShapes.length && !bounds.isEmpty()) map.fitBounds(bounds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewProperties, mapLoaded])

  const stopDrawListeners = () => {
    drawMouseDownListenerRef.current?.remove()
    drawMouseDownListenerRef.current = null
    drawMouseMoveListenerRef.current?.remove()
    drawMouseMoveListenerRef.current = null
    drawMouseUpListenerRef.current?.remove()
    drawMouseUpListenerRef.current = null
    if (drawWindowMouseUpListenerRef.current) {
      window.removeEventListener('mouseup', drawWindowMouseUpListenerRef.current)
      window.removeEventListener('touchend', drawWindowMouseUpListenerRef.current)
      drawWindowMouseUpListenerRef.current = null
    }
    isDrawingPointerDownRef.current = false
  }

  // google.maps.drawing.DrawingManager is gone from the current Maps JS API (see the note on
  // drawMouseDownListenerRef above) - this hand-rolled press-drag-release flow is the replacement:
  // holding the mouse down and moving traces a freehand shape, and releasing ends the session and
  // hands off to the same editable Polygon + path-listener pattern the loaded-from-preferences
  // case already uses below.
  const finishDrawing = useCallback(() => {
    stopDrawListeners()
    setIsDrawing(false)

    const map = mapRef.current
    // Restore normal panning/zoom now that drawing has ended - see toggleDrawing for why these
    // were turned off in the first place.
    map?.setOptions({ draggable: true, gestureHandling: 'greedy', disableDoubleClickZoom: false, draggableCursor: null })
    livePolygonRef.current?.setMap(null)
    livePolygonRef.current = null
    drawLineRef.current?.setMap(null)
    drawLineRef.current = null
    drawPxRef.current = null
    const rawPath = drawPathRef.current
    if (!map || rawPath.length < 3) return

    // Added to the existing shapes, not replacing them - an agent can draw several disconnected
    // areas (e.g. two separate neighborhoods) and the backend already matches "inside any of them".
    const path = simplifyPath(rawPath)
    const polygon = new google.maps.Polygon({
      map, paths: path, editable: true,
      fillColor: BLUE, fillOpacity: 0.12, strokeColor: BLUE, strokeOpacity: 0.7, strokeWeight: 2,
    })
    attachPolygonSyncListeners(polygon)
    polygonsRef.current = [...polygonsRef.current, polygon]
    setShapeCount(polygonsRef.current.length)
    syncPolygonsToForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleDrawing = () => {
    const map = mapRef.current
    if (!map) return

    if (isDrawing) {
      finishDrawing()
      return
    }

    // Turning off Draw and Place-Center are mutually exclusive map click-modes.
    if (isPlacingCenter) togglePlacingCenter()

    drawPathRef.current = []
    livePolygonRef.current?.setMap(null)
    livePolygonRef.current = null
    if (!drawProjRef.current) {
      const ov = new google.maps.OverlayView()
      ov.onAdd = () => {}; ov.draw = () => {}; ov.onRemove = () => {}
      ov.setMap(map)
      drawProjRef.current = ov
    }
    // The map holds still while drawing so the gesture draws instead of panning.
    map.setOptions({ draggable: false, gestureHandling: 'none', disableDoubleClickZoom: true, draggableCursor: 'crosshair' })

    setIsDrawing(true)
  }

  const drawPoint = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const drawLatLng = (pt: { x: number; y: number }) => drawProjRef.current?.getProjection()?.fromContainerPixelToLatLng(new google.maps.Point(pt.x, pt.y)) || null
  const onDrawDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const map = mapRef.current
    if (!map) return
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawingPointerDownRef.current = true
    const pt = drawPoint(e)
    drawPxRef.current = pt
    const ll = drawLatLng(pt)
    drawPathRef.current = ll ? [ll] : []
    drawLineRef.current?.setMap(null)
    drawLineRef.current = new google.maps.Polyline({ map, path: drawPathRef.current, strokeColor: BLUE, strokeWeight: 3, strokeOpacity: 0.95, clickable: false, zIndex: 5 })
  }
  const onDrawMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawingPointerDownRef.current || !drawLineRef.current) return
    const pt = drawPoint(e)
    const last = drawPxRef.current
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 4) return
    drawPxRef.current = pt
    const ll = drawLatLng(pt)
    if (!ll) return
    drawPathRef.current.push(ll)
    drawLineRef.current.getPath().push(ll)
  }
  const onDrawUp = () => {
    if (!isDrawingPointerDownRef.current) return
    isDrawingPointerDownRef.current = false
    // A tap, not a shape - stay in drawing mode.
    if (drawPathRef.current.length < 8) {
      drawLineRef.current?.setMap(null); drawLineRef.current = null
      drawPathRef.current = []
      return
    }
    finishDrawing()
  }

  const clearAllShapes = () => {
    stopDrawListeners()
    drawPathRef.current = []
    setIsDrawing(false)
    mapRef.current?.setOptions({ draggable: true, gestureHandling: 'greedy', disableDoubleClickZoom: false, draggableCursor: null })
    drawLineRef.current?.setMap(null)
    drawLineRef.current = null
    livePolygonRef.current?.setMap(null)
    livePolygonRef.current = null
    polygonsRef.current.forEach(p => p.setMap(null))
    polygonsRef.current = []
    setShapeCount(0)
    setFormData(prev => ({ ...prev, search_polygon: null }))
  }

  const stopPlaceCenterListeners = () => {
    placeCenterMouseDownListenerRef.current?.remove()
    placeCenterMouseDownListenerRef.current = null
    placeCenterMouseMoveListenerRef.current?.remove()
    placeCenterMouseMoveListenerRef.current = null
    placeCenterMouseUpListenerRef.current?.remove()
    placeCenterMouseUpListenerRef.current = null
    if (placeCenterWindowMouseUpListenerRef.current) {
      window.removeEventListener('mouseup', placeCenterWindowMouseUpListenerRef.current)
      window.removeEventListener('touchend', placeCenterWindowMouseUpListenerRef.current)
      placeCenterWindowMouseUpListenerRef.current = null
    }
    isPlacingCenterPointerDownRef.current = false
    placeCenterOriginRef.current = null
    placeCenterPreviewCircleRef.current?.setMap(null)
    placeCenterPreviewCircleRef.current = null
  }

  // --- "Place Circle": press on the map to drop a search-center pin, drag outward to size the
  // radius live, release to finish - instead of typing/picking an address. The final center+radius
  // is functionally identical to an address search that resolved to those coordinates, so it
  // reuses the exact same address+radius geo mode/circle once it's set. ---
  const togglePlacingCenter = () => {
    const map = mapRef.current
    if (!map) return

    if (isPlacingCenter) {
      stopPlaceCenterListeners()
      map.setOptions({ draggable: true, draggableCursor: null })
      setIsPlacingCenter(false)
      return
    }

    // Turning on Place-Center and Draw are mutually exclusive map click-modes.
    if (isDrawing) finishDrawing()

    // Disabling drag frees up press-and-move for sizing the radius instead of panning the map -
    // the same fix Draw needed for the same reason.
    map.setOptions({ draggable: false, draggableCursor: 'crosshair' })

    const finishPlacing = () => {
      const origin = placeCenterOriginRef.current
      const previewCircle = placeCenterPreviewCircleRef.current
      stopPlaceCenterListeners()
      map.setOptions({ draggable: true, draggableCursor: null })
      setIsPlacingCenter(false)
      if (!origin) return

      // A drag under ~0.3mi reads as "just clicked to place a pin" rather than a deliberate
      // radius drag, so it falls back to the same sensible default the old click-only version used.
      const draggedMiles = previewCircle ? previewCircle.getRadius() / MILES_TO_METERS : 0
      const miles = draggedMiles >= 0.3 ? Math.round(draggedMiles * 10) / 10 : 2
      setDisplayRadiusMiles(miles)

      setFormData(prev => ({
        ...prev,
        address: 'Custom Location (dropped pin)', lat: origin.lat(), long: origin.lng(), diameter: miles,
      }))
    }

    const handleWindowMouseUp = () => { if (isPlacingCenterPointerDownRef.current) finishPlacing() }
    placeCenterWindowMouseUpListenerRef.current = handleWindowMouseUp
    window.addEventListener('mouseup', handleWindowMouseUp)
    window.addEventListener('touchend', handleWindowMouseUp)

    placeCenterMouseDownListenerRef.current = map.addListener('mousedown', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return
      isPlacingCenterPointerDownRef.current = true
      placeCenterOriginRef.current = event.latLng
      placeCenterPreviewCircleRef.current?.setMap(null)
      placeCenterPreviewCircleRef.current = new google.maps.Circle({
        map, center: event.latLng, radius: 1,
        fillColor: BLUE, fillOpacity: 0.1, strokeColor: BLUE, strokeOpacity: 0.65, strokeWeight: 2, clickable: false,
      })
    })
    placeCenterMouseMoveListenerRef.current = map.addListener('mousemove', (event: google.maps.MapMouseEvent) => {
      const origin = placeCenterOriginRef.current
      if (!isPlacingCenterPointerDownRef.current || !origin || !event.latLng || !window.google.maps.geometry) return
      const meters = google.maps.geometry.spherical.computeDistanceBetween(origin, event.latLng)
      placeCenterPreviewCircleRef.current?.setRadius(Math.max(meters, 1))
      setDisplayRadiusMiles(Math.max(0.1, Math.round((meters / MILES_TO_METERS) * 10) / 10))
    })
    placeCenterMouseUpListenerRef.current = map.addListener('mouseup', () => {
      if (isPlacingCenterPointerDownRef.current) finishPlacing()
    })

    setIsPlacingCenter(true)
  }

  const clearAddress = () => {
    setDisplayRadiusMiles(null)
    setFormData(prev => ({ ...prev, address: '', lat: null, long: null, diameter: null }))
  }

  const handleSave = async () => {
    if (!collection) return
    setLocationError('')

    let finalData = { ...formData }
    if (finalData.address && (!finalData.lat || !finalData.long)) {
      const resolved = await googleAutocompleteRef.current?.resolveAddress()
      if (resolved) finalData = { ...finalData, address: resolved.address, lat: resolved.lat, long: resolved.lng }
    }

    const hasAddress = !!(finalData.address && finalData.lat && finalData.long)
    const hasArea = !!(finalData.cities?.length || finalData.school_districts?.length || finalData.townships?.length || finalData.counties?.length)
    const hasPolygon = !!finalData.search_polygon
    if (!hasAddress && !hasArea && !hasPolygon) {
      setLocationError('Choose at least one search area, draw a shape, or enter a search center address before saving.')
      locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (hasAddress && (!finalData.diameter || finalData.diameter <= 0)) {
      setLocationError('Please enter a search radius.')
      locationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (keptHomes.length && !keepNotice) { setKeepNotice(true); return }
    setKeepNotice(false)
    setIsSubmitting(true)
    try {
      await onSave(collection.id, finalData)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const inputClass = "block w-full px-3.5 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-white/10 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/15 focus:border-[#C9A24D] focus:bg-white dark:focus:bg-[#111113] transition-all font-bold text-sm placeholder:font-semibold placeholder:text-gray-300 dark:placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
  const labelClass = "block text-[10px] font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-[0.18em] mb-1.5 ml-1"
  const miniLabel = "mb-1 ml-1 block text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500"
  const firstName = collection?.customer?.firstName || ''
  const typeCount = PROPERTY_TYPE_LABELS.filter(([key]) => formData[key]).length

  // One criteria group: icon, title, a gold edge + check once it holds something. Called as a
  // function (not <Card />) so typing in its inputs never remounts them.
  const card = (opts: { i: number; icon: ReactNode; title: string; hint?: string; set?: boolean; action?: ReactNode; children: ReactNode; sectionRef?: React.Ref<HTMLElement> }) => (
    <motion.section
      ref={opts.sectionRef}
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.1 + opts.i * 0.06, type: 'spring', stiffness: 300, damping: 28 }}
      className={`me-lift relative overflow-hidden rounded-[22px] border bg-white p-4 shadow-[0_16px_34px_-30px_rgba(17,24,39,.7)] dark:bg-[#18181b] ${opts.set ? 'border-[#C9A24D]/45 dark:border-[#C9A24D]/30' : 'border-gray-100 dark:border-white/[0.07]'}`}
    >
      <AnimatePresence>{opts.set && <motion.span key="edge" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} className="absolute inset-y-4 left-0 w-1 origin-top rounded-r-full bg-gradient-to-b from-[#e8c97a] to-[#C9A24D]" />}</AnimatePresence>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${opts.set ? 'bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827] shadow-[0_8px_18px_-10px_rgba(201,162,77,.9)]' : 'bg-[#C9A24D]/12 text-[#a8843a] dark:text-[#e8c97a]'}`}>{opts.icon}</span>
        <p className="text-sm font-black text-[#111827] dark:text-white">{opts.title}</p>
        <AnimatePresence>{opts.set && <motion.span key="ok" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }} className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></motion.span>}</AnimatePresence>
        {opts.hint && !opts.action && <span className="ml-auto text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">{opts.hint}</span>}
        {opts.action && <div className="ml-auto">{opts.action}</div>}
      </div>
      {opts.children}
    </motion.section>
  )

  const pair = (a: { label: string; node: ReactNode }, b: { label: string; node: ReactNode }) => (
    <div className="grid grid-cols-2 gap-2.5">
      <div><label className={labelClass}>{a.label}</label>{a.node}</div>
      <div><label className={labelClass}>{b.label}</label>{b.node}</div>
    </div>
  )
  const money = (key: 'min_price' | 'max_price', ph: string) => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-[#C9A24D]">$</span>
      <input type="text" inputMode="numeric" value={formatNumberWithCommas(formData[key])} onChange={(e) => setFormData(prev => ({ ...prev, [key]: parseInt(stripCommas(e.target.value)) || null }))} className={`${inputClass} pl-7`} placeholder={ph} />
    </div>
  )
  const linkBtn = 'text-[10px] font-black uppercase tracking-widest text-[#a8843a] transition-colors hover:text-[#111827] dark:text-[#e8c97a] dark:hover:text-white'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.22 } }}
      className="fixed inset-0 z-50 flex flex-col bg-[#FAFAF7] dark:bg-[#0B0B0B]"
    >
      <style>{EDITOR_CSS}</style>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 30 } }}
        exit={{ opacity: 0, y: 14, transition: { duration: 0.18 } }}
        className="flex min-h-0 flex-1 flex-col"
      >
      {create ? (
      // Create flow, step 3 - same editor, header in the create flow's look.
      <div className="relative shrink-0 overflow-hidden border-b border-[#C9A24D]/25 bg-[#fbf7ef] px-3 py-2.5 dark:border-white/[0.07] dark:bg-[#0b0f0e] sm:px-6 sm:py-3">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_180%_at_100%_0%,rgba(201,162,77,.24),transparent_60%),linear-gradient(135deg,#fffdf8,#f4ead7)] dark:bg-[radial-gradient(70%_180%_at_100%_0%,rgba(201,162,77,.2),transparent_60%),linear-gradient(135deg,#0b0f0e,#111827_60%,#1d1810)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent" />
        <div className="relative flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => create.onBack(formData)}
            title="Back to About them"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#C9A24D]/30 bg-white/80 text-[#8b7355] shadow-sm transition hover:-translate-x-0.5 hover:border-[#C9A24D] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#e8c97a]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a] sm:text-[10px]">
              New Showcase · Search area
              <span className="ml-2 font-bold normal-case tracking-normal text-gray-500 dark:text-white/50">
                {isLoadingPreview ? 'Updating matches…' : geoMode === 'none' ? '' : `${countLabel} matching ${previewCount === 1 && !atLimit ? 'home' : 'homes'}`}
              </span>
            </p>
            <h2 className="line-clamp-2 font-serif text-base font-black leading-tight text-[#111827] dark:text-white sm:truncate sm:text-2xl">
              Where should we look <em className="font-light text-[#a8803a] dark:text-[#e8c97a]">for {create.clientName || 'them'}?</em>
            </h2>
          </div>
          <div className="hidden items-center gap-1.5 text-[10px] font-black uppercase tracking-widest lg:flex">
            {['Client', 'About them'].map(t => (
              <span key={t} className="flex items-center gap-1 text-[#8b7355] dark:text-[#e8c97a]"><Check className="h-3 w-3" strokeWidth={3} />{t}<span className="ml-1.5 h-px w-5 bg-[#C9A24D]/60" /></span>
            ))}
            <span className="flex items-center gap-1.5 rounded-lg bg-[#111827] px-2.5 py-1.5 text-white dark:bg-[#e8c97a] dark:text-[#111827]"><MapIcon className="h-3 w-3 text-[#e8c97a] dark:text-[#111827]" />Search area</span>
          </div>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="group relative flex shrink-0 items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3.5 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 sm:px-5 sm:text-xs"
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="relative">{isSubmitting ? 'Creating…' : <>Create<span className="hidden sm:inline"> Showcase</span></>}</span>
          </button>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-gray-400 transition hover:rotate-90 hover:bg-white/70 hover:text-gray-900 dark:hover:bg-white/[0.06] dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      ) : (
      /* Header - lit, with the client, a live match counter and the save */
      <div className="relative isolate shrink-0 overflow-hidden bg-[#0b0b0c] px-4 py-3 text-white sm:px-6 sm:py-3.5">
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,#0b0b0c,#141821_60%,#1d1810)]" />
        <div aria-hidden className="me-aurora pointer-events-none" />
        <span aria-hidden className="me-edge pointer-events-none absolute inset-x-0 bottom-0 h-px" />
        {[['62%', '28%', 0], ['78%', '70%', 1.7], ['44%', '78%', 3.1]].map(([l, t, dl], k) => (
          <span key={k} aria-hidden className="me-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${dl}s` }} />
        ))}
        <div className="flex items-center gap-3">
          <motion.span initial={{ scale: 0.5, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.05 }}
            className="relative isolate hidden h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl text-[#111827] shadow-[0_12px_28px_-10px_rgba(201,162,77,.95)] sm:grid">
            <span aria-hidden className="me-ring" />
            <span aria-hidden className="absolute inset-[2px] -z-[1] rounded-[14px] bg-gradient-to-br from-[#e8c97a] to-[#C9A24D]" />
            <SlidersHorizontal className="h-5 w-5" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="truncate text-[10px] font-black uppercase tracking-[0.26em] text-[#e8c97a]">
              Edit search{collection?.customer?.firstName ? ` · ${collection.customer.firstName} ${collection.customer.lastName || ''}` : ''}
            </motion.p>
            <h2 className="line-clamp-2 font-serif text-base font-black leading-tight sm:truncate sm:text-[1.6rem]">
              {(firstName ? `Fine-tune ${firstName}’s search` : 'Fine-tune the search').split(' ').map((w, k) => (
                <motion.span key={k} className="inline-block" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 + k * 0.05, type: 'spring', stiffness: 320, damping: 26 }}>
                  {w}&nbsp;
                </motion.span>
              ))}
            </h2>
          </div>
          {/* live match count */}
          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2 sm:flex">
            {isLoadingPreview ? <Loader2 className="h-4 w-4 animate-spin text-[#e8c97a]" /> : <span className="relative grid h-2.5 w-2.5 place-items-center"><span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/60" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></span>}
            <span className="relative h-6 min-w-[2ch] overflow-hidden text-lg font-black tabular-nums leading-6">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={countLabel} className="block" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -18, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}>{countLabel}</motion.span>
              </AnimatePresence>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{previewCount === 1 && !atLimit ? 'match' : 'matches'}</span>
          </div>
          <motion.button
            onClick={handleSave}
            disabled={isSubmitting}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="me-shine relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#111827] shadow-[0_14px_30px_-12px_rgba(201,162,77,.9)] disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:text-xs"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={isSubmitting ? 'busy' : 'idle'} className="inline-flex items-center gap-2" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.15 }}>
                {isSubmitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving</> : <><Sparkles className="h-3.5 w-3.5" /> Save<span className="hidden sm:inline"> search</span></>}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
      )}

      {/* Mobile tab bar - below md there's no room for the panel/map/grid side by side, so mobile
          gets an explicit 3-way switcher instead. Hidden at md+, where the split layout below
          shows the panel and content together (tablet intentionally looks like desktop here). */}
      <div className="relative flex shrink-0 gap-1 border-b border-gray-200 bg-white p-1.5 dark:border-white/[0.07] dark:bg-[#151517] md:hidden">
        {([['criteria', SlidersHorizontal, 'Criteria'], ['map', MapIcon, 'Map'], ['grid', LayoutGrid, 'Grid']] as const).map(([tab, Icon, label]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors ${
              mobileTab === tab ? 'text-white dark:text-[#111827]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {mobileTab === tab && <motion.span layoutId="me-mobile-tab" className="absolute inset-0 rounded-xl bg-[#111827] shadow-md dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <Icon className="relative h-3.5 w-3.5" /><span className="relative">{label}</span>
            {tab === 'grid' && previewCount > 0 && <span className={`relative rounded-full px-1.5 text-[9px] ${mobileTab === tab ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-500 dark:bg-white/10'}`}>{countLabel}</span>}
          </button>
        ))}
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
        {/* Left control panel - always visible at md+ (tablet is deliberately desktop-like); on
            mobile only when the Criteria tab is active. */}
        <div className={`${mobileTab === 'criteria' ? 'block' : 'hidden'} me-scroll md:block min-h-0 space-y-3 overflow-y-auto border-b border-gray-200 bg-[#f6f4ef] p-3.5 dark:border-white/[0.07] dark:bg-[#0f0f11] md:border-b-0 md:border-r`}>
          <AnimatePresence>
            {locationError && (
              <motion.p key="err" initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center overflow-hidden rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400">
                <AlertTriangle className="mr-2 h-4 w-4 shrink-0" />
                {locationError}
              </motion.p>
            )}
          </AnimatePresence>

          <ShowcaseLimitNote show={geoMode !== 'none' && !isLoadingPreview && atLimit} />
          {card({
            i: 0, icon: <DollarSign className="h-4 w-4" />, title: 'Budget', set: !!(formData.min_price || formData.max_price),
            children: pair({ label: 'Min price', node: money('min_price', '0') }, { label: 'Max price', node: money('max_price', 'No limit') }),
          })}

          {card({
            i: 1, icon: <BedDouble className="h-4 w-4" />, title: 'Bedrooms & baths', set: !!(formData.min_beds || formData.max_beds || formData.min_baths || formData.max_baths),
            children: (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Bedrooms - at least</label>
                  {chipRow([null, 1, 2, 3, 4, 5], formData.min_beds, v => setFormData(prev => ({ ...prev, min_beds: v })), 'me-beds')}
                </div>
                <div>
                  <label className={labelClass}>Baths - at least</label>
                  {chipRow([null, 1, 1.5, 2, 3, 4], formData.min_baths, v => setFormData(prev => ({ ...prev, min_baths: v })), 'me-baths')}
                </div>
                {pair(
                  { label: 'Max beds', node: <input type="number" min="0" value={formData.max_beds || ''} onChange={(e) => setFormData(prev => ({ ...prev, max_beds: parseInt(e.target.value) || null }))} className={inputClass} placeholder="Any" /> },
                  { label: 'Max baths', node: <input type="number" min="0" step="0.5" value={formData.max_baths || ''} onChange={(e) => setFormData(prev => ({ ...prev, max_baths: parseFloat(e.target.value) || null }))} className={inputClass} placeholder="Any" /> },
                )}
              </div>
            ),
          })}

          {card({
            i: 2, icon: <Ruler className="h-4 w-4" />, title: 'Size, lot & age', hint: 'optional',
            set: !!(formData.min_sqft || formData.max_sqft || formData.min_acres || formData.max_acres || formData.min_year_built || formData.max_year_built),
            children: (
              <div className="space-y-3">
                {pair(
                  { label: 'Min sq ft', node: <input type="text" inputMode="numeric" value={formatNumberWithCommas(formData.min_sqft)} onChange={(e) => setFormData(prev => ({ ...prev, min_sqft: parseInt(stripCommas(e.target.value)) || null }))} className={inputClass} placeholder="Any" /> },
                  { label: 'Max sq ft', node: <input type="text" inputMode="numeric" value={formatNumberWithCommas(formData.max_sqft)} onChange={(e) => setFormData(prev => ({ ...prev, max_sqft: parseInt(stripCommas(e.target.value)) || null }))} className={inputClass} placeholder="Any" /> },
                )}
                {pair(
                  { label: 'Min acres', node: <input type="number" min="0" step="0.1" value={formData.min_acres ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, min_acres: parseFloat(e.target.value) || null }))} className={inputClass} placeholder="Any" /> },
                  { label: 'Max acres', node: <input type="number" min="0" step="0.1" value={formData.max_acres ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, max_acres: parseFloat(e.target.value) || null }))} className={inputClass} placeholder="Any" /> },
                )}
                {pair(
                  { label: 'Built after', node: <input type="number" min="0" value={formData.min_year_built ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, min_year_built: parseInt(e.target.value) || null }))} className={inputClass} placeholder="Any" /> },
                  { label: 'Built before', node: <input type="number" min="0" value={formData.max_year_built ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, max_year_built: parseInt(e.target.value) || null }))} className={inputClass} placeholder="Any" /> },
                )}
              </div>
            ),
          })}

          {/* Geography criteria stack: address+radius, towns/school-districts/counties, and drawn
              shapes can all be combined at once - a property matches if it falls in any of them.
              A school district narrows all of them (radius AND district, like Zillow/Redfin). */}
          {card({
            i: 3, icon: <Crosshair className="h-4 w-4" />, title: 'Where', sectionRef: locationSectionRef,
            set: geoMode !== 'none',
            children: (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className={miniLabel}>Towns</label>
                    <MultiSelectDatabaseInput values={formData.cities || []} onChange={(cities) => setFormData(prev => ({ ...prev, cities }))} apiMethod={api.properties.cities} placeholder="Search towns..." />
                  </div>
                  <div>
                    <label className={miniLabel}>School districts <span className="normal-case tracking-normal text-gray-400">· narrows every area</span></label>
                    <MultiSelectDatabaseInput values={formData.school_districts || []} onChange={(school_districts) => setFormData(prev => ({ ...prev, school_districts }))} apiMethod={api.properties.searchSchoolDistricts} placeholder="Search school districts..." />
                  </div>
                  <div>
                    <label className={miniLabel}>Counties</label>
                    <MultiSelectDatabaseInput values={formData.counties || []} onChange={(counties) => setFormData(prev => ({ ...prev, counties }))} apiMethod={api.properties.counties} placeholder="Search counties..." />
                  </div>
                  {/* Each pick is drawn on the map with its real lines (U.S. Census - a town is the
                      ZIP area its homes use) - see the BoundaryCanvas above the map. */}
                </div>

                <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 dark:text-gray-600"><span className="h-px flex-1 bg-current" />and / or<span className="h-px flex-1 bg-current" /></div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className={`${labelClass} mb-0`}>Search center</label>
                    <motion.button type="button" onClick={togglePlacingCenter} whileTap={{ scale: 0.94 }}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${isPlacingCenter ? 'bg-blue-500 text-white shadow-[0_8px_18px_-8px_rgba(59,130,246,.9)]' : 'bg-[#C9A24D]/12 text-[#a8843a] hover:bg-[#C9A24D]/25 dark:text-[#e8c97a]'}`}>
                      <MapPin className="h-3 w-3" />{isPlacingCenter ? 'Drag on the map…' : 'Place on map'}
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {isPlacingCenter && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-1.5 overflow-hidden text-[10px] font-semibold text-blue-500">Press and drag out from a point to set the radius, or just click to use the default</motion.p>
                    )}
                  </AnimatePresence>
                  <GooglePlacesAutocomplete
                    ref={googleAutocompleteRef}
                    value={formData.address || ''}
                    onChange={(addr) => setFormData(prev => ({ ...prev, address: addr }))}
                    // A distance search needs a distance: picking an address starts at the 2 mi the map
                    // shows when none is set (a Showcase drawn on the map first saved 0).
                    onCoordinatesChange={(lat, long) => setFormData(prev => ({ ...prev, lat, long, diameter: prev.diameter && prev.diameter > 0 ? prev.diameter : 2 }))}
                    placeholder="Enter an address, or place a pin on the map"
                  />
                  <AnimatePresence initial={false}>
                    {!!(formData.lat && formData.long) && (
                      <motion.div key="radius" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-3">
                          <div className="flex flex-wrap gap-1.5">
                            {RADII.map(r => {
                              const on = formData.diameter === r
                              return (
                                <motion.button key={r} type="button" whileTap={{ scale: 0.9 }} onClick={() => { setDisplayRadiusMiles(null); setFormData(prev => ({ ...prev, diameter: r })) }}
                                  className={`relative rounded-full px-3 py-1.5 text-[11px] font-black transition-colors ${on ? 'text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                                  {on && <motion.span layoutId="me-radius" className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] shadow-[0_8px_18px_-8px_rgba(201,162,77,.9)]" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                                  {!on && <span className="absolute inset-0 rounded-full border border-gray-200 dark:border-white/10" />}
                                  <span className="relative">{r} mi</span>
                                </motion.button>
                              )
                            })}
                          </div>
                          <div className="mt-2.5 flex items-center gap-3">
                            <div className="relative flex-1">
                              <input type="number" min="0.1" step="0.1" value={formData.diameter ?? ''} onChange={(e) => { setDisplayRadiusMiles(null); setFormData(prev => ({ ...prev, diameter: parseFloat(e.target.value) || null })) }} className={`${inputClass} pr-10`} placeholder="Radius" />
                              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-gray-400">mi</span>
                            </div>
                            <button type="button" onClick={clearAddress} className={linkBtn}>Clear</button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className={`${labelClass} mb-0`}>Draw a search area</label>
                    {shapeCount > 0 && <button type="button" onClick={clearAllShapes} className={linkBtn}>Clear all</button>}
                  </div>
                  <motion.button
                    type="button"
                    onClick={toggleDrawing}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    className={`relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${
                      isDrawing
                        ? 'border-blue-500 bg-blue-500 text-white shadow-[0_12px_26px_-12px_rgba(59,130,246,.9)]'
                        : 'border-dashed border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600 dark:border-white/15 dark:bg-[#0B0B0B] dark:text-gray-300'
                    }`}
                  >
                    {isDrawing && <span aria-hidden className="me-draw-pulse absolute inset-0" />}
                    {isDrawing ? <RotateCcw className="relative h-3.5 w-3.5" /> : <Pencil className="relative h-3.5 w-3.5" />}
                    <span className="relative">{isDrawing ? 'Drawing - trace on the map' : shapeCount > 0 ? 'Add another shape' : 'Draw on map'}</span>
                  </motion.button>
                  <AnimatePresence>
                    {isDrawing && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 overflow-hidden text-center text-[10px] font-semibold text-blue-500">Trace around the area with your finger or mouse - lift to finish</motion.p>}
                  </AnimatePresence>
                  {shapeCount > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <AnimatePresence initial={false}>
                        {Array.from({ length: shapeCount }).map((_, index) => (
                          <motion.span
                            key={index}
                            layout
                            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1.5 text-[10px] font-bold text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"
                          >
                            Shape {index + 1}
                            <button type="button" onClick={() => removeShape(index)} title={`Remove Shape ${index + 1}`} aria-label={`Remove Shape ${index + 1}`} className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-500/20">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            ),
          })}

          {card({
            i: 4, icon: <HomeIcon className="h-4 w-4" />, title: 'Property type', set: typeCount > 0,
            hint: typeCount ? `${typeCount} picked` : 'any',
            children: (
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPE_LABELS.map(([key, label]) => {
                  const on = !!formData[key]
                  return (
                    <motion.button
                      key={key}
                      type="button"
                      layout
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setFormData(prev => ({ ...prev, [key]: !prev[key] }))}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                        on
                          ? 'border-[#111827] bg-[#111827] text-white shadow-[0_8px_18px_-10px_rgba(17,24,39,.9)] dark:border-white dark:bg-white dark:text-[#111827]'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D]/60 hover:text-[#111827] dark:border-white/10 dark:bg-[#0B0B0B] dark:text-gray-400 dark:hover:text-white'
                      }`}
                    >
                      <AnimatePresence initial={false}>
                        {on && <motion.span key="c" initial={{ width: 0, opacity: 0, scale: 0 }} animate={{ width: 'auto', opacity: 1, scale: 1 }} exit={{ width: 0, opacity: 0, scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="inline-flex"><Check className="h-3 w-3 text-[#e8c97a] dark:text-[#a8843a]" strokeWidth={3.5} /></motion.span>}
                      </AnimatePresence>
                      {label}
                    </motion.button>
                  )
                })}
              </div>
            ),
          })}

          {card({
            i: 5, icon: <Scale className="h-4 w-4" />, title: 'Match score', set: !!formData.show_match_score,
            action: (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, show_match_score: !prev.show_match_score }))}
                title={formData.show_match_score ? 'Showing the % Match badge' : '% Match badge hidden'}
                className={`relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ${formData.show_match_score ? 'justify-end bg-emerald-500' : 'justify-start bg-gray-300 dark:bg-gray-700'}`}
              >
                <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className="block h-5 w-5 rounded-full bg-white shadow-md" />
              </button>
            ),
            children: (
              <div>
                <motion.div layout className="flex items-center gap-2.5 rounded-xl bg-[#FAFAF7] p-2.5 dark:bg-[#0B0B0B]">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#C9A24D]/15 text-[#a8843a] dark:text-[#e8c97a]"><MapPin className="h-4 w-4" /></span>
                  <div className="min-w-0 leading-tight">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]">Comparing to</p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p key={compareAddress || 'none'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="truncate text-xs font-black text-[#111827] dark:text-white">
                        {compareAddress || 'No property yet'}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
                <motion.button
                  type="button"
                  onClick={() => setShowComparePicker(v => !v)}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-700 transition-colors hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:bg-[#0B0B0B] dark:text-gray-300"
                >
                  {showComparePicker ? <><X className="h-3.5 w-3.5" /> Cancel</> : compareAddress ? 'Change compare property' : 'Set compare property'}
                </motion.button>
                {/* Any status works here, including sold - the point is scoring against a real
                    property, not just currently-active listings (PropertySearchPicker's own search
                    never filters by status). */}
                <AnimatePresence initial={false}>
                  {showComparePicker && (
                    <motion.div key="picker" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="overflow-hidden">
                      <div className="pt-2">
                        <PropertySearchPicker
                          embedded
                          onSelectFromLookup={(raw) => {
                            setFormData(prev => ({ ...prev, compare_property_listing_key: raw.ListingKey || raw.listing_key || null }))
                            setCompareAddress(raw.FullStreetAddress || raw.address || null)
                            setShowComparePicker(false)
                          }}
                          onSelectFromListing={(listing) => {
                            setFormData(prev => ({ ...prev, compare_property_listing_key: listing.listing_key || null }))
                            setCompareAddress(listing.address || null)
                            setShowComparePicker(false)
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ),
          })}
        </div>

        {/* Main: map + optional grid - always visible at md+; on mobile only when Criteria isn't
            the active tab (Map/Grid tabs then pick which of the two panes shows below). */}
        {/* On the Criteria tab it's laid out underneath, invisible - not display:none - so the map
            measures its real size and fits the search area before the agent ever taps Map. */}
        <div className={`${mobileTab === 'criteria' ? 'max-md:pointer-events-none max-md:invisible max-md:absolute max-md:inset-0' : ''} flex min-h-0 flex-1 flex-col`} aria-hidden={mobileTab === 'criteria' ? true : undefined}>
          <div className="hidden shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2 dark:border-white/[0.07] dark:bg-[#151517] md:flex">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
              {isLoadingPreview ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A24D]" /> Updating matches…</> : geoMode === 'none' ? 'Set a search area to see matches' : <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{countLabel} live {previewCount === 1 && !atLimit ? 'match' : 'matches'}{keptHomes.length > 0 && <span className="ml-1 text-rose-500">+ {keptHomes.length} kept</span>}{atLimit && <span className="ml-1 normal-case tracking-normal text-[#a8843a] dark:text-[#e8c97a]">· the closest {SHOWCASE_MAX_HOMES} are kept</span>}</>}
            </p>
            <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
              {([['map', MapIcon, 'Map'], ['split', Columns2, 'Both'], ['grid', LayoutGrid, 'Grid']] as const).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    viewMode === mode ? 'text-white dark:text-[#111827]' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {viewMode === mode && <motion.span layoutId="me-view" className="absolute inset-0 rounded-lg bg-[#111827] shadow-sm dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <Icon className="relative h-3.5 w-3.5" /><span className="relative">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`flex min-h-0 flex-1 ${viewMode === 'split' ? 'flex-col xl:flex-row' : 'flex-col'}`}>
            <div className={`${mobileTab !== 'grid' ? 'flex' : 'hidden'} ${(viewMode === 'map' || viewMode === 'split') ? 'md:flex' : 'md:hidden'} me-pane relative min-h-[320px] flex-1 bg-gray-100 dark:bg-gray-800`}>
                <AnimatePresence>
                  {!mapLoaded && !mapLoadError && (
                    <motion.div key="loading" exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.35 } }} className="absolute inset-0 z-10 grid place-items-center bg-[#f6f4ef] dark:bg-[#111113]">
                      <OhpLoader fullScreen={false} label="Loading map" className="!py-0" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {mapLoadError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white text-center dark:bg-[#151517]">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                    <p className="max-w-xs text-sm font-black text-red-500">{mapLoadError}</p>
                  </div>
                )}
                <div ref={mapDivRef} className="h-full w-full" />
                <MapPopup map={mapLoaded ? mapRef.current : null} position={popupHome ? { lat: popupHome.Latitude as number, lng: popupHome.Longitude as number } : null}
                  anchor={{ above: 14, below: 14, side: 14 }} onClose={() => setPopupId(null)} className="z-[45]">
                  {popupHome && popupCard(popupHome)}
                </MapPopup>
                <BoundaryCanvas map={mapLoaded ? mapRef.current : null} shapes={areaCanvasShapes} badges={areaBadges} avoid={homePins} dark={isDarkUi} animKey="area" />
                <AnimatePresence>
                  {areaShapesLoading && mapLoaded && (
                    <motion.div key="area-lines" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-black text-[#111827] shadow-lg dark:bg-[#151922]/95 dark:text-white">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A24D]" /> Drawing the area lines…
                    </motion.div>
                  )}
                </AnimatePresence>
                {isDrawing && (
                  <div className="absolute inset-0 z-[15] cursor-crosshair" style={{ touchAction: 'none' }}
                    onPointerDown={onDrawDown} onPointerMove={onDrawMove} onPointerUp={onDrawUp} onPointerCancel={onDrawUp} />
                )}
                <AnimatePresence>
                  {isDrawing && mapLoaded && (
                    <motion.div key="draw-hint" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                      className="absolute inset-x-0 top-3 z-20 flex justify-center gap-2 px-3">
                      <span className="pointer-events-none rounded-full bg-white/95 px-3.5 py-2 text-xs font-black text-[#111827] shadow-lg">Draw around the area you want</span>
                      <button type="button" onClick={() => { stopDrawListeners(); drawLineRef.current?.setMap(null); drawLineRef.current = null; drawPathRef.current = []; setIsDrawing(false); mapRef.current?.setOptions({ draggable: true, gestureHandling: 'greedy', disableDoubleClickZoom: false, draggableCursor: null }) }}
                        className="rounded-full bg-[#111827] px-3.5 py-2 text-xs font-black text-white shadow-lg">Cancel</button>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {mapSettling && mapLoaded && (
                    <motion.div key="settle" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="pointer-events-none absolute inset-0 z-[5] bg-[#f6f4ef] dark:bg-[#111113]" />
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {radiusDisplayLabel && mapLoaded && (geoMode === 'address' || isPlacingCenter) && (
                    <motion.div key="radius-label" initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                      className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-xl bg-[#111827]/90 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white shadow-lg dark:bg-white/90 dark:text-[#111827]">
                      <Target className="h-3.5 w-3.5 text-[#e8c97a] dark:text-[#a8843a]" />{radiusDisplayLabel} mi radius
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {geoMode === 'none' && mapLoaded && (
                    <motion.div key="hint" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
                      <span className="flex items-center gap-2 rounded-full bg-[#111827]/90 px-4 py-2 text-xs font-bold text-white shadow-lg ">
                        <Sparkles className="h-3.5 w-3.5 text-[#e8c97a]" /> Pick a search center, town, school district, or draw an area
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
            </div>

            <div className={`${mobileTab === 'grid' ? 'block' : 'hidden'} ${(viewMode === 'grid' || viewMode === 'split') ? 'md:block' : 'md:hidden'} me-scroll me-pane min-h-0 flex-1 overflow-y-auto border-t border-gray-200 bg-[#f6f4ef] p-4 dark:border-white/[0.07] dark:bg-[#0f0f11] xl:border-l xl:border-t-0`}>
                {isLoadingPreview && previewProperties.length === 0 ? (
                  <div className={`grid grid-cols-1 gap-3 ${viewMode === 'grid' ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
                    {Array.from({ length: 4 }).map((_, k) => (
                      <div key={k} className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-white/[0.06] dark:bg-[#151517]">
                        <div className="me-shimmer aspect-video" />
                        <div className="space-y-2 p-3"><div className="me-shimmer h-3 w-1/2 rounded" /><div className="me-shimmer h-3 w-3/4 rounded" /></div>
                      </div>
                    ))}
                  </div>
                ) : previewProperties.length === 0 && keptHomes.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex h-48 flex-col items-center justify-center gap-2 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#C9A24D] shadow-sm dark:bg-[#151517]"><HomeIcon className="h-5 w-5" /></span>
                    <p className="text-sm font-black text-gray-600 dark:text-gray-300">No matching homes yet</p>
                    <p className="text-xs font-semibold text-gray-400">Set or widen the search area to see results here.</p>
                  </motion.div>
                ) : (
                  <motion.div layout className={`grid grid-cols-1 gap-3 transition-opacity duration-300 ${isLoadingPreview ? 'opacity-60' : ''} ${viewMode === 'grid' ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
                    <AnimatePresence initial={false}>
                      {[...keptHomes.map(h => ({ ...h, __kept: keepReason(h) })), ...previewProperties].map((property: any, k) => {
                        const id = String((property as any).id || property.ListingKey)
                        return (
                          <motion.div
                            key={id}
                            layout
                            initial={{ opacity: 0, y: 16, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(k, 8) * 0.035, type: 'spring', stiffness: 320, damping: 30 } }}
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                            ref={(el: HTMLDivElement | null) => { if (el) cardRefs.current.set(id, el); else cardRefs.current.delete(id) }}
                            onClick={() => focusProperty(id)}
                            className="relative"
                          >
                            {property.__kept && (
                              <motion.span initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                                className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-2.5 py-1 text-[9.5px] font-black uppercase tracking-[0.12em] text-white shadow-[0_8px_18px_-8px_rgba(225,29,72,.9)]">
                                Stays · {property.__kept}
                              </motion.span>
                            )}
                            <PropertyRecommendationCard
                              image={property.ListPictureURL || (property as any).imageUrl || '/placeholder.svg'}
                              streetAddress={property.FullStreetAddress || ''}
                              city={property.City || ''}
                              state={property.StateOrProvince}
                              zipcode={property.PostalCode}
                              price={property.ListPrice}
                              beds={property.BedroomsTotal ?? 0}
                              baths={property.BathroomsTotal ?? 0}
                              sqft={property.LivingArea ?? 0}
                              acres={0}
                              property={property}
                              yearBuilt={property.YearBuilt ?? 0}
                              dom={property.DaysOnMarket ?? 0}
                              hideQr
                              isCompact
                              photoOverlays
                              selected={focusedId === id}
                            />
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </motion.div>
                )}
              </div>
          </div>
        </div>
      </div>
      {/* Phones, creating a new showcase: the flow bar - 3 / 3 (Client, About them, Search area),
          Back to About them and Create - the same handlers as the header buttons. */}
      {create && (
        <FlowDock inline step={3} total={3} onBack={() => create.onBack(formData)} backDisabled={isSubmitting}
          onContinue={handleSave} busy={isSubmitting} continueLabel={isSubmitting ? 'Creating…' : 'Create'} icon={<Sparkles />}
          note={isLoadingPreview ? 'Updating…' : geoMode === 'none' ? undefined : `${countLabel} ${previewCount === 1 && !atLimit ? 'home' : 'homes'}`} />
      )}
      </motion.div>

      {/* Saving would drop homes the client engaged with - they stay; tell the agent first. */}
      <AnimatePresence>
        {keepNotice && (
          <motion.div key="keep-notice" className="absolute inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setKeepNotice(false)}>
            <motion.div onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 32 } }} exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#151517]">
              <div className="bg-gradient-to-br from-rose-50 to-white px-6 pb-4 pt-6 dark:from-rose-500/10 dark:to-transparent">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg"><Heart className="h-5 w-5" fill="currentColor" /></span>
                <h3 className="mt-3 text-xl font-black text-[#111827] dark:text-white">
                  {keptHomes.length === 1 ? '1 home stays' : `${keptHomes.length} homes stay`} in {create?.clientName || collection?.customer?.firstName || 'their'}{create?.clientName || collection?.customer?.firstName ? "'s" : ''} Showcase
                </h3>
                <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">They don't match the new search, but your client liked, commented on or asked to tour {keptHomes.length === 1 ? 'it' : 'them'}, so {keptHomes.length === 1 ? "it isn't" : "they aren't"} removed.</p>
              </div>
              <ul className="max-h-56 space-y-2 overflow-y-auto px-6 py-3">
                {keptHomes.map((h: any, i: number) => (
                  <motion.li key={String(h.id || h.ListingKey)} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 p-2 dark:border-white/[0.06]">
                    {h.ListPictureURL ? <img src={h.ListPictureURL} alt="" className="h-11 w-14 shrink-0 rounded-xl object-cover" /> : <span className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-gray-100 dark:bg-white/5"><HomeIcon className="h-4 w-4 text-gray-400" /></span>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-[#111827] dark:text-white">{h.FullStreetAddress}</p>
                      <p className="text-[11px] font-bold text-rose-500">{keepReason(h)}</p>
                    </div>
                  </motion.li>
                ))}
              </ul>
              <div className="flex gap-2 border-t border-gray-100 px-6 py-4 dark:border-white/[0.06]">
                <button type="button" onClick={() => setKeepNotice(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-black text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5">Go back</button>
                <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => { handleSave() }} className="flex-[1.4] rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] py-2.5 text-sm font-black text-[#111827] shadow-md shadow-[#C9A24D]/30">OK, save search</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )

  // At least N - "Any" plus a few steps, the chosen one in a sliding pill.
  function chipRow(values: (number | null)[], current: number | null | undefined, set: (v: number | null) => void, id: string) {
    return (
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}>
        {values.map(v => {
          const on = (current ?? null) === v
          return (
            <motion.button key={String(v)} type="button" whileTap={{ scale: 0.9 }} onClick={() => set(v)}
              className={`relative min-w-0 rounded-xl px-1 py-2 text-xs font-black transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
              {on && <motion.span layoutId={id} className="absolute inset-0 rounded-xl bg-[#111827] shadow-md dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              {!on && <span className="absolute inset-0 rounded-xl border border-gray-200 dark:border-white/10" />}
              <span className="relative">{v == null ? 'Any' : `${v}+`}</span>
            </motion.button>
          )
        })}
      </div>
    )
  }
}

const RADII = [0.5, 1, 2, 3, 5, 10, 15]

const EDITOR_CSS = `
.me-aurora{position:absolute;inset:-60%;background:radial-gradient(30% 40% at 25% 40%,rgba(201,162,77,.35),transparent 70%),radial-gradient(25% 35% at 75% 30%,rgba(232,201,122,.2),transparent 70%),radial-gradient(35% 45% at 55% 95%,rgba(120,90,40,.3),transparent 70%);animation:meAurora 16s ease-in-out infinite alternate;z-index:-1}
@keyframes meAurora{0%{transform:translate(-5%,-3%) rotate(0deg)}100%{transform:translate(6%,4%) rotate(9deg)}}
.me-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);background-size:200% 100%;animation:meEdge 6s ease-in-out infinite}
@keyframes meEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.me-spark{width:4px;height:4px;border-radius:999px;background:#e8c97a;box-shadow:0 0 10px 2px #e8c97a;opacity:0;animation:meSpark 7s ease-in-out infinite}
@keyframes meSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-12px) scale(1)}100%{opacity:0;transform:translateY(-36px) scale(.5)}}
.me-ring{position:absolute;inset:-3px;border-radius:18px;background:conic-gradient(from 0deg,transparent,#fff6dc,transparent 40%);animation:meSpin 3.2s linear infinite;z-index:-1}
@keyframes meSpin{to{transform:rotate(360deg)}}
.me-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-100%);animation:meShine 3.6s ease-in-out infinite}
@keyframes meShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.me-lift{transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s}
.me-lift:hover{transform:translateY(-2px);box-shadow:0 24px 44px -32px rgba(17,24,39,.6)}
.me-draw-pulse{background:radial-gradient(circle at center,rgba(255,255,255,.35),transparent 60%);animation:meDraw 1.4s ease-out infinite}
@keyframes meDraw{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.me-shimmer{background:linear-gradient(100deg,rgba(17,24,39,.05) 30%,rgba(17,24,39,.12) 50%,rgba(17,24,39,.05) 70%);background-size:200% 100%;animation:meShimmer 1.3s linear infinite}
.dark .me-shimmer{background:linear-gradient(100deg,rgba(255,255,255,.04) 30%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.04) 70%);background-size:200% 100%}
@keyframes meShimmer{to{background-position:-200% 0}}
/* Runs each time a pane goes from hidden to shown (Map / Both / Grid) - no remount, so the map keeps its state. */
.me-pane{animation:mePaneIn .38s cubic-bezier(.2,.8,.2,1) both}
@keyframes mePaneIn{from{opacity:0;transform:scale(.985) translateY(6px)}to{opacity:1;transform:none}}
.me-scroll{scrollbar-width:thin;scrollbar-color:rgba(201,162,77,.45) transparent}
@media (prefers-reduced-motion:reduce){.me-aurora,.me-edge,.me-spark,.me-ring,.me-shine:after,.me-draw-pulse,.me-shimmer,.me-pane{animation:none}}
`
