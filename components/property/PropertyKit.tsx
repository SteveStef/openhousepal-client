'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Flame, GraduationCap,
  Home, MapPin, Maximize2, MessageCircle, Navigation, Share2, Receipt, Send, Trees, TrendingDown, TrendingUp, X,
} from 'lucide-react'
import { formatStatus, statusBadgeColor } from '@/components/website-public/listingFormat'
import { upcomingOpenHouses, formatOpenHouse, type MlsOpenHouse } from '@/lib/mlsOpenHouses'
import { copyText } from '@/lib/copyText'
import { API_BASE_URL } from '@/lib/api-service'
import { sizedImage } from '@/lib/siteImage'

// One design for every place a single home opens: the Listing Page (/property/...), the IDX site's
// property page and its quick look, and the Showcase detail window. Each page keeps its own extras
// (Like/Pass + comments, the message form, the tour window, the Spotlight banner...) and builds the
// rest from these parts: the big photo in Bright's own 4:3 frame + filmstrip (arrows, days on market
// on the photo) + full-screen viewer, the summary (price, address, the ruled facts row), the remarks
// with the listing source under them, "Every detail" (the whole MLS record, one full-width card per
// group), price history, the map, the dark agent panel, the quick Ask form and the Bright notice
// (courtesy line, last updated, IDX disclaimer). Sections are separated by SectionDivider.
//
// Colors come from CSS variables on <PropertySurface>, so the same parts sit in the app (ivory and
// gold, dark mode via the `dark` class) or on an IDX site (its own theme vars, its own dark mode)
// without either leaking into the other.

export type HomeRecord = Record<string, any>

export type HomeView = {
  key: string
  street: string
  place: string
  city: string
  fullAddress: string
  price: number | null
  /** Sold, but Bright never sent what it sold for - `price` is its last asking price. */
  priceIsAsking?: boolean
  originalPrice: number | null
  priceChangedAt: string | null
  listedAt: string | null
  status: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  acres: number | null
  lotSqft: number | null
  yearBuilt: number | null
  pricePerSqft: number | null
  dom: number | null
  mlsNumber: string | null
  photos: string[]
  description: string
  features: string[]
  schoolDistrict: string
  township: string
  subdivision: string
  hasHoa: boolean | null
  lat: number | null
  lng: number | null
  openHouses: MlsOpenHouse[]
  spotlightUrl: string | null
  courtesy: { agent: string; office: string; phone: string; email: string }
  /** The MLS record, RESO field names (PropertyDetailResponse, or the IDX card's `report`). */
  record: HomeRecord
}

// ---------------------------------------------------------------- formatting

export const titleCase = (t?: string | null) => (t ? String(t).toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (_, a, c) => a + c.toUpperCase()) : '')
export const money = (n?: number | null) => (n != null ? `$${Math.round(n).toLocaleString()}` : '')
const asList = (v: any): string => (Array.isArray(v) ? v.filter(Boolean).join(', ') : v == null ? '' : String(v))
const yesNo = (v: any) => (v === true ? 'Yes' : v === false ? 'No' : '')
const num = (v: any) => (typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 })) : v ? String(v) : '')
const sqftText = (v: any) => (typeof v === 'number' && v > 0 ? `${Math.round(v).toLocaleString()} sq ft` : '')
export const shortDate = (v?: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
const typeLabel = (v?: string | null) => (v ? titleCase(String(v).replace(/_/g, ' ')) : '')
const cleanName = (v?: string | null) => (v && !/none available|^n\/?a$/i.test(v) ? titleCase(v) : '')
const nz = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
// Remarks sometimes arrive double-encoded from the feed ("â€œWooded Hillâ€").
const fixText = (t?: string | null) => (t || '').replace(/â€œ|â€\u009d|â€/g, '"').replace(/â€™|â€˜/g, "'").replace(/â€“|â€”/g, '-')
// Listing remarks sometimes arrive with raw <p>/<br> tags and **emphasis** stars typed by the agent.
const fixRemarks = (t?: string | null) => fixText(t)
  .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/?\s*p\s*>/gi, '\n\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\*{2,}/g, '')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
const placeLine = (city?: string | null, state?: string | null, zip?: string | null) =>
  [titleCase(city), [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')

// ---------------------------------------------------------------- adapters

/** From the app's PropertyDetailResponse (Listing Page, Showcase window). */
export function homeFromMls(p: HomeRecord, opts: { photo?: (url: string) => string; openHouses?: MlsOpenHouse[] | null; spotlightUrl?: string | null } = {}): HomeView {
  const fix = opts.photo || ((u: string) => u)
  const raw: string[] = (Array.isArray(p.photos) && p.photos.length ? p.photos : p.ListPictureURL ? [p.ListPictureURL] : []).filter((u: any) => typeof u === 'string' && u)
  const streetRaw = String(p.FullStreetAddress || p.UnparsedAddress || '').split(',')[0]
  const street = titleCase(streetRaw)
  const place = placeLine(p.City, p.StateOrProvince, p.PostalCode)
  // A sold home shows what it sold for, not its list price (10/19: "Sold for $520,000" on a $601,000 sale).
  const isSold = /closed|sold/i.test(String(p.MlsStatus || p.home_status || ''))
  const closePrice = isSold ? nz(p.ClosePrice) : null
  const price = closePrice ?? nz(p.ListPrice)
  const sqft = nz(p.LivingArea)
  return {
    key: String(p.ListingKey || p.id || ''),
    street,
    place,
    city: titleCase(p.City),
    fullAddress: [street, place].filter(Boolean).join(', '),
    price,
    priceIsAsking: isSold && closePrice == null,
    originalPrice: nz(p.OriginalListPrice),
    priceChangedAt: p.PriceChangeTimestamp || null,
    listedAt: p.MLSListDate || null,
    status: p.MlsStatus || null,
    beds: nz(p.BedroomsTotal),
    baths: nz(p.BathroomsTotal),
    sqft,
    acres: nz(p.LotSizeAcres),
    lotSqft: nz(p.LotSizeSquareFeet),
    yearBuilt: nz(p.YearBuilt),
    pricePerSqft: nz(p.PricePerSquareFoot) ?? (price && sqft ? price / sqft : null),
    dom: nz(p.DaysOnMarket),
    mlsNumber: p.ListingId || null,
    photos: raw.map(u => fix(u.replace(/^http:\/\//, 'https://'))),
    description: fixRemarks(p.PublicRemarks),
    features: [],
    schoolDistrict: titleCase(p.SchoolDistrictName),
    township: titleCase(p.MLSAreaMajor),
    subdivision: cleanName(p.SubdivisionName),
    hasHoa: p.AssociationYN === true || (typeof p.AssociationFee === 'number' && p.AssociationFee > 0) ? true : p.AssociationYN === false ? false : null,
    lat: nz(p.Latitude),
    lng: nz(p.Longitude),
    openHouses: upcomingOpenHouses(opts.openHouses),
    spotlightUrl: opts.spotlightUrl || null,
    courtesy: {
      agent: p.ListAgentFullName || '',
      office: p.ListOfficeName || '',
      phone: p.ListAgentPreferredPhone || p.ListOfficePhone || '',
      email: p.ListAgentEmail || '',
    },
    record: p,
  }
}

/** From an IDX site card (content_adapters.get_property_detail - snake_case + `report`). */
export function homeFromIdx(p: HomeRecord, opts: { photo?: (url: string) => string } = {}): HomeView {
  const fix = opts.photo || ((u: string) => u)
  const r: HomeRecord = p.report || {}
  const raw: string[] = (Array.isArray(p.photos) && p.photos.length ? p.photos : p.photo ? [p.photo] : []).filter(Boolean)
  const street = titleCase(p.address)
  const place = placeLine(p.city, p.state, p.zipcode)
  return {
    key: String(p.listing_key || ''),
    street,
    place,
    city: titleCase(p.city),
    fullAddress: [street, place].filter(Boolean).join(', '),
    price: (/closed|sold/i.test(String(p.status || r.MlsStatus || '')) && nz(r.ClosePrice)) || nz(p.price),
    priceIsAsking: /closed|sold/i.test(String(p.status || r.MlsStatus || '')) && !nz(r.ClosePrice),
    originalPrice: nz(p.original_list_price) ?? nz(r.OriginalListPrice),
    priceChangedAt: p.price_change_timestamp || r.PriceChangeTimestamp || null,
    listedAt: p.mls_list_date || r.MLSListDate || null,
    status: p.status || r.MlsStatus || null,
    beds: nz(p.bedrooms),
    baths: nz(p.bathrooms),
    sqft: nz(p.living_area),
    acres: nz(p.lot_size_acres),
    lotSqft: nz(p.lot_size),
    yearBuilt: nz(p.year_built),
    pricePerSqft: nz(p.price_per_sqft) ?? (p.price && p.living_area ? p.price / p.living_area : null),
    dom: nz(p.days_on_market),
    mlsNumber: p.mls_number || r.ListingId || null,
    photos: raw.map(u => fix(u)),
    description: fixRemarks(p.description),
    features: Array.isArray(p.features) ? p.features : [],
    schoolDistrict: titleCase(p.school_district || r.SchoolDistrictName),
    township: titleCase(r.MLSAreaMajor),
    subdivision: cleanName(r.SubdivisionName),
    hasHoa: typeof p.has_hoa === 'boolean' ? p.has_hoa : null,
    lat: nz(p.latitude),
    lng: nz(p.longitude),
    openHouses: upcomingOpenHouses(p.open_houses),
    spotlightUrl: p.spotlight_url || null,
    courtesy: {
      agent: p.list_agent_full_name || '',
      office: p.list_office_name || '',
      phone: p.list_agent_phone || p.list_office_phone || '',
      email: p.list_agent_email || '',
    },
    record: r,
  }
}

// ---------------------------------------------------------------- record -> cards

type Row = [string, string]
export type DetailGroup = { id: string; title: string; icon: typeof Home; rows: Row[] }

export function detailGroups(h: HomeView): DetailGroup[] {
  const r = h.record
  const g = (id: string, title: string, icon: typeof Home, rows: Row[]): DetailGroup => ({ id, title, icon, rows: rows.filter(([, v]) => v && v.trim()) })
  const structure = Array.from(new Set([typeLabel(r.MlsPropertyType), typeLabel(r.MlsStructureDesignType), titleCase(asList(r.StructureType))].filter(Boolean))).join(' · ')
  // Order agents asked for: the listing facts first, then schools, the outside (parking included), systems, inside.
  return [
    g('listing', 'Listing', ClipboardList, [
      ['Status', titleCase(formatStatus(h.status || r.MlsStatus || '') || '')],
      ['Listed', shortDate(r.MLSListDate || h.listedAt)],
      ['Days on market', h.dom != null ? String(h.dom) : num(r.DaysOnMarket)],
      ['Total days on market', r.CumulativeDaysOnMarket != null && r.CumulativeDaysOnMarket !== (h.dom ?? r.DaysOnMarket) ? num(r.CumulativeDaysOnMarket) : ''],
      ['Original price', h.originalPrice ? money(h.originalPrice) : ''],
      ['Price changed', shortDate(r.PriceChangeTimestamp || h.priceChangedAt)],
      ['Price per sq ft', h.pricePerSqft ? `$${Math.round(h.pricePerSqft).toLocaleString()}` : ''],
      ['Property type', typeLabel(r.PropertyType)],
      ['Year built', (r.YearBuilt ?? h.yearBuilt) ? String(r.YearBuilt ?? h.yearBuilt) : ''],
      ['New construction', yesNo(r.NewConstructionYN)],
      ['Possession', asList(r.Possession)],
      ['MLS #', h.mlsNumber || asList(r.ListingId)],
    ]),
    g('area', 'Schools & area', GraduationCap, [
      ['School district', titleCase(r.SchoolDistrictName) || h.schoolDistrict],
      ['Elementary', titleCase(r.ElementarySchool)],
      ['Middle', titleCase(r.MiddleOrJuniorSchool || r.MiddleSchool)],
      ['High school', titleCase(r.HighSchool)],
      ['County', titleCase(String(r.County || '').replace(/-[A-Za-z]{2}$/, ''))],
      ['Municipality', titleCase(r.IncorporatedCityName || r.Township || r.MLSAreaMajor)],
      ['Subdivision', cleanName(r.SubdivisionName)],
      ['Community', [r.SeniorCommunityYN === true ? '55+ community' : '', asList(r.AssociationAmenities)].filter(Boolean).join(', ')],
      ['Pets', asList(r.PetsAllowed)],
    ]),
    g('exterior', 'Exterior & lot', Trees, [
      ['Style', asList(r.ArchitecturalStyle)],
      ['Structure', structure],
      ['Construction', asList(r.ConstructionMaterials)],
      ['Roof', asList(r.Roof)],
      ['Foundation', asList(r.FoundationDetails)],
      ['Lot', [(r.LotSizeAcres ?? h.acres) ? `${num(r.LotSizeAcres ?? h.acres)} acres` : '', sqftText(r.LotSizeSquareFeet ?? h.lotSqft)].filter(Boolean).join(' · ')],
      ['View', asList(r.View)],
      ['Waterfront', asList(r.WaterfrontFeatures)],
      ['Exterior features', asList(r.ExteriorFeatures)],
      ['Lot features', asList(r.LotFeatures)],
      ['Garage', r.GarageSpaces ? `${num(r.GarageSpaces)} ${Number(r.GarageSpaces) === 1 ? 'space' : 'spaces'}${r.AttachedGarageYN === true ? ' · attached' : r.AttachedGarageYN === false ? ' · detached' : ''}` : yesNo(r.GarageYN)],
      ['Parking', asList(r.ParkingFeatures)],
      ['Zoning', asList(r.Zoning)],
    ]),
    g('systems', 'Heating, cooling & utilities', Flame, [
      ['Heating', [asList(r.Heating), asList(r.HeatingFuel)].filter(Boolean).join(' · ')],
      ['Cooling', [asList(r.Cooling) || (r.CentralAirYN ? 'Central air' : ''), asList(r.CoolingFuel)].filter(Boolean).join(' · ')],
      ['Water', asList(r.WaterSource)],
      ['Sewer', asList(r.Sewer)],
      ['Utilities', asList(r.Utilities)],
    ]),
    g('interior', 'Interior', Home, [
      ['Bedrooms', num(r.BedroomsTotal ?? h.beds)],
      ['Bathrooms', num(r.BathroomsTotal ?? h.baths)],
      ['Living area', sqftText(r.LivingArea ?? h.sqft)],
      ['Above grade', sqftText(r.AboveGradeFinishedArea)],
      ['Below grade', sqftText(r.BelowGradeFinishedArea)],
      ['Stories', num(r.Stories)],
      ['Levels', asList(r.Levels)],
      ['Basement', asList(r.Basement) || yesNo(r.BasementYN)],
      ['Fireplaces', r.FireplacesTotal ? `${r.FireplacesTotal}${r.FireplaceFeatures?.length ? ` · ${asList(r.FireplaceFeatures)}` : ''}` : yesNo(r.FireplaceYN)],
      ['Flooring', asList(r.Flooring)],
      ['Appliances', asList(r.Appliances)],
      ['Interior features', asList(r.InteriorFeatures)],
      ['Doors & windows', [asList(r.DoorFeatures), asList(r.WindowFeatures)].filter(Boolean).join(', ')],
      ['Accessibility', asList(r.AccessibilityFeatures)],
    ]),
    g('money', 'Taxes & fees', Receipt, [
      ['Annual taxes', r.TaxAnnualAmount ? `${money(r.TaxAnnualAmount)}${r.TaxYear ? ` (${r.TaxYear})` : ''}` : ''],
      ['Assessment', r.TaxAssessmentAmount ? `${money(r.TaxAssessmentAmount)}${r.AssessmentYear ? ` (${r.AssessmentYear})` : ''}` : ''],
      ['Tax ID', asList(r.ListingTaxID)],
      ['HOA', r.AssociationFee ? `${money(r.AssociationFee)}${r.AssociationFeeFrequency ? ` / ${String(r.AssociationFeeFrequency).toLowerCase()}` : ''}` : (r.AssociationYN === false || h.hasHoa === false ? 'None' : yesNo(r.AssociationYN))],
      ['Second fee', r.AssociationFee2 ? `${money(r.AssociationFee2)}${r.AssociationFee2Frequency ? ` / ${String(r.AssociationFee2Frequency).toLowerCase()}` : ''}` : ''],
      ['HOA includes', asList(r.AssociationFeeIncludes)],
    ]),
  ].filter(grp => grp.rows.length > 0)
}

// ---------------------------------------------------------------- surface

const Kit = createContext<{ serif: string }>({ serif: 'font-serif' })
const useSerif = () => useContext(Kit).serif

export function PropertySurface({ surface, gold, ink, serif = 'font-serif', className = '', id, children }: {
  surface: 'app' | 'site'
  gold: string
  ink: string
  serif?: string
  className?: string
  id?: string
  children: ReactNode
}) {
  return (
    <Kit.Provider value={{ serif }}>
      <div id={id} data-surface={surface} className={`pp ${className}`} style={{ '--pp-gold': gold, '--pp-ink': ink } as CSSProperties}>
        <style>{PP_CSS}</style>
        {children}
      </div>
    </Kit.Provider>
  )
}

// Shared class strings (all colors are surface variables).
export const pp = {
  card: 'rounded-[24px] border border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] shadow-[0_22px_44px_-36px_rgba(17,24,39,.55)]',
  heading: 'text-[color:var(--pp-heading)]',
  text: 'text-[color:var(--pp-soft)]',
  muted: 'text-[color:var(--pp-muted)]',
  faint: 'text-[color:var(--pp-faint)]',
  kicker: 'text-[11px] font-black uppercase tracking-[0.26em] text-[color:var(--pp-gold-text)]',
  goldBtn: 'pp-sheen inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--pp-gold)] px-5 py-4 text-xs font-black uppercase tracking-widest text-[color:var(--pp-ink)] shadow-lg transition hover:-translate-y-0.5',
  ghostBtn: 'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-white/10',
  smallBtn: 'inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 px-3 py-3 text-[11px] font-black uppercase tracking-widest text-white/80 transition hover:bg-white/10',
  input: 'w-full rounded-2xl border border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] px-4 py-3.5 text-sm font-medium text-[color:var(--pp-text)] outline-none transition placeholder:text-[color:var(--pp-faint)] focus:border-[color:var(--pp-gold)] focus:ring-4 focus:ring-[color:var(--pp-gold-wash)]',
}

export function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  const serif = useSerif()
  return (
    <div>
      <p className={`flex items-center gap-3 ${pp.kicker}`}><span className="h-px w-8 bg-[var(--pp-gold)]" />{kicker}</p>
      <h2 className={`ohp-site-heading mt-2 text-[1.9rem] font-black leading-tight tracking-tight sm:text-[2.1rem] ${pp.heading} ${serif}`}>{title}</h2>
      {sub && <p className={`mt-1.5 text-sm ${pp.muted}`}>{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- photos

function StatusPill({ status, small }: { status: string | null; small?: boolean }) {
  if (!status) return null
  const b = statusBadgeColor(status)
  return <span className={`rounded-full font-black uppercase tracking-wider shadow ${small ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1 text-[11px]'}`} style={{ backgroundColor: b.bg, color: b.fg }}>{formatStatus(status)}</span>
}

/** "12 days on market" / "Listed today" - nothing for a sold home or when the feed has no count. */
// The filmstrip's thumbnail width (the cells stretch a little to fill the row exactly).
const THUMB_W = 76
const VIEWER_THUMB_W = 96

function domText(home: HomeView): string | null {
  if (home.dom == null || /closed|sold/i.test(home.status || '')) return null
  return home.dom === 0 ? 'Listed today' : `${home.dom} ${home.dom === 1 ? 'day' : 'days'} on market`
}

/** The photo stage: one photo at a time in Bright's own 4:3 shape (never cropped, never padded),
 *  arrows on the photo, swipe on phones, a counter that opens the full-screen viewer, and every
 *  photo in a filmstrip underneath. Crossfades between photos. */
export function PropertyPhotos({ home, extraBadges, split = 'lg', className = '' }: {
  home: HomeView
  /** Kept for older callers - the stage is the same everywhere now. */
  variant?: 'page' | 'window'
  extraBadges?: ReactNode
  /** The width the hero goes side by side at: below it the photo is a swipe-only stage (no arrows
   *  or filmstrip) that the info panel overlaps. */
  split?: 'md' | 'lg'
  className?: string
}) {
  const photos = home.photos
  const n = photos.length
  const [index, setIndex] = useState(0)
  // Crossfade: the photo being left stays underneath (fully shown) while the new one fades in over
  // it once loaded - never a flash of empty background between photos.
  const [under, setUnder] = useState(0)
  const [ready, setReady] = useState(true)
  const [viewer, setViewer] = useState<number | null>(null)
  const touchX = useRef<number | null>(null)
  // How many small thumbnails fit whole beside the arrows (never a half-cut one at the end).
  const stripRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(6)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; if (w > 0) setFit(Math.max(3, Math.floor((w + 8) / (THUMB_W + 8)))) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])
  const indexRef = useRef(0)
  indexRef.current = index
  useEffect(() => { setIndex(0); setUnder(0); setReady(true) }, [home.key])
  const show = useCallback((i: number) => {
    const cur = indexRef.current
    if (i === cur) return
    setUnder(cur)
    setReady(false)
    setIndex(i)
  }, [])
  const onViewer = useCallback((v: number | null) => { setViewer(v); if (v !== null) show(v) }, [show])
  if (!n) {
    return (
      <div className={`grid aspect-[4/3] place-items-center rounded-[26px] border border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] ${className}`}>
        <span className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${pp.faint}`}><Home className="h-4 w-4" />Photos coming soon</span>
      </div>
    )
  }
  const go = (d: number) => show((index + d + n) % n)
  const wide = split === 'md' ? 'md' : 'lg'
  // Photos fill the frame (no bars) and are pinned to their bottom-left corner, where Bright MLS
  // prints its stamp, so the stamp is never cut off. On phones the price panel sits right under the
  // photo at its full width (user, 10/19 - one block, no floating card), so the photo fills the frame.
  const sharpH = 'h-full'
  const arrow = `absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#111827] shadow-[0_10px_24px_-8px_rgba(0,0,0,.6)] transition duration-300 hover:scale-105 opacity-0 group-hover/ph:opacity-100 ${wide === 'md' ? 'md:grid' : 'lg:grid'}`
  return (
    <div className={`min-w-0 ${className}`}>
      <div
        className={`pp-in group/ph relative aspect-[4/3] overflow-hidden rounded-t-[22px] sm:rounded-t-[26px] ${wide === 'md' ? 'md:bg-[#0b0b0c] md:shadow-[0_34px_70px_-44px_rgba(0,0,0,.85)]' : 'lg:bg-[#0b0b0c] lg:shadow-[0_34px_70px_-44px_rgba(0,0,0,.85)]'}`}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => { if (touchX.current === null) return; const d = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(d) > 40) go(d < 0 ? 1 : -1) }}
      >
        <button type="button" onClick={() => setViewer(index)} className="absolute inset-0 block cursor-zoom-in" aria-label="Open photos full screen">
          <img src={sizedImage(photos[index], 64)} alt="" aria-hidden className={`absolute inset-0 hidden h-full w-full scale-110 object-cover blur-xl ${wide === 'md' ? 'md:block' : 'lg:block'}`} />
          {index !== under && <img src={sizedImage(photos[under], 1200)} alt="" aria-hidden className={`absolute left-0 top-0 w-full object-cover object-left-bottom ${sharpH}`} />}
          <img
            key={index}
            ref={el => { if (el?.complete && el.naturalWidth && !ready) setReady(true) }}
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
            src={sizedImage(photos[index], 1200)}
            alt={index === 0 ? home.fullAddress : `${home.street} - photo ${index + 1}`}
            className={`absolute left-0 top-0 w-full object-cover object-left-bottom ${sharpH} transition-opacity duration-300 ease-out ${ready ? 'opacity-100' : 'opacity-0'}`}
          />
          <span className={`absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent ${wide === 'md' ? 'md:hidden' : 'lg:hidden'}`} />
        </button>
        {n > 1 && <img src={sizedImage(photos[(index + 1) % n], 1200)} alt="" aria-hidden className="hidden" />}
        {n > 2 && <img src={sizedImage(photos[(index - 1 + n) % n], 1200)} alt="" aria-hidden className="hidden" />}
        {/* Phones (user, 10/19 - "copy Zillow"): status top-left, days on market top-right of the
            photo. The side panel on a wide screen shows both itself. */}
        {(extraBadges || home.status) && (
          <div className="pointer-events-none absolute left-3 top-3 flex max-w-[60%] flex-wrap gap-2 sm:left-4 sm:top-4">
            {home.status && <span className={wide === 'md' ? 'md:hidden' : 'lg:hidden'}><StatusPill status={home.status} small /></span>}
            {extraBadges}
          </div>
        )}
        {domText(home) && (
          <span className={`pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-lg ${wide === 'md' ? 'md:hidden' : 'lg:hidden'}`}>{domText(home)}</span>
        )}
        {n > 1 && (
          <div className={`pointer-events-none absolute inset-x-0 bottom-3.5 flex justify-center gap-1.5 ${wide === 'md' ? 'md:hidden' : 'lg:hidden'}`}>
            {Array.from({ length: Math.min(n, 7) }).map((_, i) => {
              // Up to 7 dots; with more photos the lit dot stays centered until the ends.
              const at = n <= 7 ? index : index < 3 ? index : index > n - 4 ? 6 - (n - 1 - index) : 3
              return <span key={i} className={`h-1.5 rounded-full bg-white shadow transition-all duration-300 ${i === at ? 'w-5 opacity-100' : 'w-1.5 opacity-60'}`} />
            })}
          </div>
        )}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${arrow} left-3`}><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${arrow} right-3`}><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
        <button type="button" onClick={() => setViewer(index)} className={`absolute bottom-2.5 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] font-black text-white shadow-lg transition hover:bg-black/75 ${wide === 'md' ? 'md:bottom-2.5 md:px-3 md:py-1.5 md:text-[11px]' : 'lg:bottom-2.5 lg:px-3 lg:py-1.5 lg:text-[11px]'}`}>
          <Maximize2 className="h-3.5 w-3.5" /> {n > 1 ? `${index + 1} / ${n}` : 'View'}
        </button>
      </div>

      {n > 1 && (() => {
        // The current photo first, then what's next - only whole thumbnails, same small size always.
        const shown = Math.min(n, fit)
        const next = Array.from({ length: shown }, (_, k) => (n <= fit ? k : (index + k) % n))
        const nav = 'grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--pp-gold)] hover:text-[color:var(--pp-gold-text)] active:scale-95'
        return (
          <div className={`mt-3 hidden items-center gap-2 ${wide === 'md' ? 'md:flex' : 'lg:flex'}`}>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${nav} ${pp.muted}`}><ChevronLeft className="h-4 w-4" /></button>
            <div ref={stripRef} className="grid min-w-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${fit}, minmax(0, 1fr))` }}>
              <AnimatePresence initial={false} mode="popLayout">
                {next.map((i, k) => (
                  <motion.button
                    key={i}
                    layout
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    type="button"
                    onClick={() => show(i)}
                    aria-label={`Photo ${i + 1}`}
                    aria-current={i === index ? 'true' : undefined}
                    className={`group/th relative aspect-[4/3] overflow-hidden rounded-lg bg-black/10 ${i === index ? 'ring-2 ring-[color:var(--pp-gold)] ring-offset-2 ring-offset-[color:var(--pp-bg)]' : ''}`}
                  >
                    <img src={sizedImage(photos[i], 256)} alt="" className={`h-full w-full object-cover object-left-bottom transition duration-300 ${i === index ? '' : 'opacity-65 group-hover/th:opacity-100'}`} loading={k < 8 ? 'eager' : 'lazy'} />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${nav} ${pp.muted}`}><ChevronRight className="h-4 w-4" /></button>
          </div>
        )
      })()}

      <PhotoViewer photos={photos} title={home.street} index={viewer} onChange={onViewer} />
    </div>
  )
}

/** Full-screen photos. Portaled to <body> so a transformed window (Showcase, quick look) can't trap it. */
export function PhotoViewer({ photos, title, index, onChange }: { photos: string[]; title: string; index: number | null; onChange: (i: number | null) => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const touchX = useRef<number | null>(null)
  // Same strip as the page under the photo: the current photo first, then what's next, so it always
  // shows where you are. As many whole thumbnails as fit beside the arrows.
  const [fit, setFit] = useState(8)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const measure = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    stripRef.current = el
    if (!el) return
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; if (w > 0) setFit(Math.max(3, Math.floor((w + 8) / (VIEWER_THUMB_W + 8)))) })
    ro.observe(el)
    roRef.current = ro
  }, [])
  useEffect(() => () => roRef.current?.disconnect(), [])
  useEffect(() => {
    if (index === null) return
    // Capture phase + stopImmediatePropagation: Escape closes the photos, not the window under them.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onChange(null) }
      if (e.key === 'ArrowRight') { e.stopImmediatePropagation(); onChange((index + 1) % photos.length) }
      if (e.key === 'ArrowLeft') { e.stopImmediatePropagation(); onChange((index - 1 + photos.length) % photos.length) }
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey, true)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey, true) }
  }, [index, photos.length, onChange])
  if (!mounted) return null
  const go = (d: number) => index !== null && onChange((index + d + photos.length) % photos.length)
  return createPortal(
    <AnimatePresence>
      {index !== null && photos[index] && (
        <motion.div className="fixed inset-0 z-[400] flex flex-col bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="flex items-center justify-between gap-4 px-5 py-4 text-white">
            <p className="truncate text-sm font-bold text-white/80">{title}</p>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs font-black text-white/60">{index + 1} / {photos.length}</span>
              <button type="button" onClick={() => onChange(null)} aria-label="Close photos" className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4"
            onTouchStart={e => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={e => { if (touchX.current === null) return; const d = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(d) > 40) go(d < 0 ? 1 : -1) }}
          >
            <div className="relative h-full w-full">
              <AnimatePresence initial={false}>
                <motion.img key={index} src={photos[index]} alt="" className="absolute inset-0 m-auto max-h-full max-w-full rounded-xl object-contain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} />
              </AnimatePresence>
            </div>
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 sm:left-6"><ChevronLeft className="h-6 w-6" /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 sm:right-6"><ChevronRight className="h-6 w-6" /></button>
              </>
            )}
          </div>
          {photos.length > 1 && (() => {
            const n = photos.length
            const shown = Math.min(n, fit)
            const next = Array.from({ length: shown }, (_, k) => (n <= fit ? k : (index + k) % n))
            const nav = 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 active:scale-95'
            return (
              <div className="flex items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={nav}><ChevronLeft className="h-5 w-5" /></button>
                <div ref={measure} className="grid min-w-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${fit}, minmax(0, 1fr))` }}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {next.map((i, k) => (
                      <motion.button
                        key={i}
                        layout
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
                        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                        type="button"
                        onClick={() => onChange(i)}
                        aria-label={`Photo ${i + 1}`}
                        aria-current={i === index ? 'true' : undefined}
                        className={`relative aspect-[4/3] overflow-hidden rounded-lg bg-white/5 ${i === index ? 'ring-2 ring-[#e8c97a] ring-offset-2 ring-offset-black' : ''}`}
                      >
                        <img src={sizedImage(photos[i], 256)} alt="" className={`h-full w-full object-cover object-left-bottom transition duration-300 ${i === index ? '' : 'opacity-50 hover:opacity-90'}`} loading={k < 10 ? 'eager' : 'lazy'} />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className={nav}><ChevronRight className="h-5 w-5" /></button>
              </div>
            )
          })()}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ---------------------------------------------------------------- the hero (photos + price + address)

/** The top of every detail page: the photos on the left and, beside them, a panel with the status,
 *  the price, the address and the key numbers (phones: the panel under the photos). `split` = the
 *  width it goes side by side at - "md" for narrow windows (the IDX quick look). */
export function PropertyHero({ home, extraBadges, actions, split = 'lg', className = '' }: {
  home: HomeView; extraBadges?: ReactNode
  /** The page's own buttons for this home (Showcase: Love / Pass + tour) - in the panel, under the numbers. */
  actions?: ReactNode
  split?: 'md' | 'lg'; className?: string
}) {
  return (
    <section className={`grid ${split === 'md' ? 'md:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)] md:gap-5' : `${HERO_COLS} lg:gap-x-6`} ${className}`}>
      <PropertyPhotos home={home} extraBadges={extraBadges} split={split} />
      <HeroPanel home={home} actions={actions} split={split} />
    </section>
  )
}

/** The hero's columns - pages use the same for the content + side column under it, so the side
 *  column lines up exactly under the price panel. */
export const HERO_COLS = 'lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]'

// The phone's one-line numbers: "4 bd | 3 ba | 2,450 sqft | 0.52 acres".
const STAT_LINE = new Map([['Bed', 'bd'], ['Beds', 'bd'], ['Bath', 'ba'], ['Baths', 'ba'], ['Sq Ft', 'sqft'], ['Acres', 'acres']])

function HeroPanel({ home, actions, split = 'lg' }: { home: HomeView; actions?: ReactNode; split?: 'md' | 'lg' }) {
  const serif = useSerif()
  const sold = /closed|sold/i.test(home.status || '')
  // (a sold home's price is what it sold for - selling under asking isn't a "price cut")
  const cut = !sold && home.originalPrice && home.price && home.originalPrice > home.price ? home.originalPrice - home.price : 0
  const dom = domText(home)
  const facts = [
    home.beds != null && { label: home.beds === 1 ? 'Bed' : 'Beds', value: num(home.beds) },
    home.baths != null && { label: home.baths === 1 ? 'Bath' : 'Baths', value: num(home.baths) },
    home.sqft != null && { label: 'Sq Ft', value: Math.round(home.sqft).toLocaleString() },
    home.acres != null && { label: 'Acres', value: home.acres < 1 ? home.acres.toFixed(2) : home.acres.toFixed(1) },
    home.yearBuilt != null && { label: 'Built', value: String(home.yearBuilt) },
    home.pricePerSqft != null && { label: '$ / Sq Ft', value: `$${Math.round(home.pricePerSqft).toLocaleString()}` },
  ].filter(Boolean).slice(0, 6) as { label: string; value: string }[]
  const meta = [home.mlsNumber ? `MLS# ${home.mlsNumber}` : '', home.listedAt && !sold ? `Listed ${shortDate(home.listedAt)}` : ''].filter(Boolean).join(' · ')
  const rise = (k: number) => ({ animationDelay: `${0.12 + k * 0.07}s` })
  return (
    <div className={`relative isolate z-10 flex min-w-0 flex-col overflow-hidden rounded-b-[22px] border border-t-0 border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] px-5 pb-5 pt-4 shadow-[0_24px_50px_-30px_rgba(17,24,39,.5)] sm:rounded-b-[26px] sm:px-6 sm:pb-6 ${split === 'md' ? 'md:mt-0 md:h-full md:justify-between md:rounded-[26px] md:border-t md:pt-6 md:shadow-[0_-12px_40px_-24px_rgba(17,24,39,.5),0_24px_50px_-28px_rgba(17,24,39,.55)]' : 'lg:mt-0 lg:h-full lg:justify-between lg:rounded-[26px] lg:border-t lg:pt-6 lg:shadow-[0_-12px_40px_-24px_rgba(17,24,39,.5),0_24px_50px_-28px_rgba(17,24,39,.55)]'}`}>
      <span aria-hidden className="pp-panel-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full opacity-70 blur-3xl" style={{ background: 'var(--pp-gold-wash)' }} />

      <div className={`pp-rise flex-wrap items-center gap-2 hidden ${split === 'md' ? 'md:flex' : 'lg:flex'}`} style={rise(0)}>
        <span className={split === 'md' ? 'hidden md:inline-flex' : 'hidden lg:inline-flex'}><StatusPill status={home.status} small /></span>
        {dom && <span className={`rounded-full border border-[color:var(--pp-gold-line)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${pp.muted} ${split === 'md' ? 'hidden md:inline' : 'hidden lg:inline'}`}>{dom}</span>}
        {home.openHouses.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600"><CalendarDays className="h-3 w-3" />Open {formatOpenHouse(home.openHouses[0])}</span>
        )}
      </div>

      {/* Phones (user, 10/19 - "just copy Zillow"): the price very big, a small line of numbers under it,
          then the address + town on one line; status and days on market sit on the photo. The side
          panel on a wide screen keeps its own layout (big price, address, the numbers grid). */}
      <div className={`pp-rise mt-1 ${split === 'md' ? 'md:hidden' : 'lg:hidden'}`} style={rise(1)}>
        <p className={`ohp-site-heading text-[2.1rem] font-black leading-none tracking-[-0.025em] ${pp.heading} ${serif}`}>
          {sold && home.price != null && <span className={`mr-1.5 align-middle text-[11px] font-black uppercase tracking-[0.2em] ${pp.faint}`}>{home.priceIsAsking ? 'Last asked' : 'Sold'}</span>}
          {home.price != null ? money(home.price) : 'Price on request'}
        </p>
        {facts.some(f => STAT_LINE.has(f.label)) && (
          <p className={`mt-2 text-[12px] font-semibold min-[360px]:text-[13px] ${pp.muted}`}>
            {facts.filter(f => STAT_LINE.has(f.label)).map((f, i) => (
              <span key={f.label} className="whitespace-nowrap">{i > 0 && <span className={`mx-1 min-[360px]:mx-1.5 ${pp.faint}`}>|</span>}<b className={`font-black ${pp.heading}`}>{f.value}</b> {STAT_LINE.get(f.label)}</span>
            ))}
          </p>
        )}
        <h1 className={`mt-1 text-[13px] font-semibold leading-snug ${pp.muted}`}>{[home.street || 'Address not available', home.place].filter(Boolean).join(', ')}</h1>
        {home.openHouses.length > 0 && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600"><CalendarDays className="h-3 w-3" />Open {formatOpenHouse(home.openHouses[0])}</span>
        )}
      </div>
      <div className={`pp-rise mt-4 hidden ${split === 'md' ? 'md:block' : 'lg:block'}`} style={rise(1)}>
        <p className={`text-[10px] font-black uppercase tracking-[0.28em] ${pp.faint}`}>{sold ? (home.priceIsAsking ? 'Last asking price' : 'Sold for') : 'Offered at'}</p>
        <p className={`ohp-site-heading mt-1 text-[2.5rem] font-black leading-none tracking-[-0.025em] ${pp.heading} ${serif}`}>
          {home.price != null ? money(home.price) : 'Price on request'}
        </p>
      </div>
      {cut > 0 && (
        <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-600">
          <TrendingDown className="h-3.5 w-3.5" /> {money(cut)} price cut <span className={`font-bold line-through ${pp.faint}`}>{money(home.originalPrice)}</span>
        </span>
      )}

      <div className={`pp-rise mt-4 hidden ${split === 'md' ? 'md:block' : 'lg:block'}`} style={rise(3)}>
        <span aria-hidden className="mb-3.5 block h-px bg-gradient-to-r from-[color:var(--pp-gold)] to-transparent opacity-50" />
        <h2 className={`ohp-site-heading text-[1.45rem] font-black leading-tight ${pp.heading} ${serif}`}>{home.street || 'Address not available'}</h2>
        {home.place && <p className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${pp.muted}`}><MapPin className="h-4 w-4 shrink-0 text-[color:var(--pp-gold)]" />{home.place}</p>}
      </div>

      {(facts.length > 0 || meta) && (
      <div className={`pp-rise mt-1 ${split === 'md' ? 'md:mt-4' : 'lg:mt-4'}`} style={rise(4)}>
      {facts.length > 0 && (
        // even rows: 4 facts as 2 x 2 (in threes one row was half empty, the gap filled in gold)
        <dl className={`${split === 'md' ? 'hidden md:grid' : 'hidden lg:grid'} ${facts.length === 4 || facts.length === 2 ? 'grid-cols-2' : facts.length === 1 ? 'grid-cols-1' : 'grid-cols-3'} gap-px overflow-hidden rounded-2xl border border-[color:var(--pp-gold-line)] bg-[color:var(--pp-gold-line)]`}>
          {facts.map(f => (
            <div key={f.label} className="bg-[var(--pp-card)] px-2 py-2.5 text-center">
              <dd className={`text-[1.1rem] font-black leading-none ${pp.heading} ${serif}`}>{f.value}</dd>
              <dt className={`mt-1 text-[9px] font-black uppercase tracking-[0.18em] ${pp.faint}`}>{f.label}</dt>
            </div>
          ))}
        </dl>
      )}
      {meta && <p className={`mt-2 text-[11px] font-semibold ${pp.faint}`}>{meta}</p>}
      </div>
      )}
      {actions && <div className="pp-rise mt-4" style={rise(6)}>{actions}</div>}
    </div>
  )
}

/** "Listing Source: Deborah E Dorsey of BHHS Fox & Roach-Rosemont (6105276400). Email: deb@... (MLS# PACT2134730)" */
export function listingSource(home: HomeView): string | null {
  const c = home.courtesy
  if (!c.agent && !c.office) return null
  const who = [c.agent, c.office].filter(Boolean).join(' of ')
  return `Listing Source: ${who}${c.phone ? ` (${c.phone})` : ''}.${c.email ? ` Email: ${c.email}.` : ''}${home.mlsNumber ? ` (MLS# ${home.mlsNumber})` : ''}`
}

/** The line between two sections: a gold hairline that fades out at both ends, with a small
 *  diamond in the middle. */
export function SectionDivider({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pp-divider flex items-center gap-3 py-7 sm:py-8 ${className}`}>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[color:var(--pp-gold-line)]" />
      <span className="h-1.5 w-1.5 rotate-45 bg-[var(--pp-gold)] opacity-70" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[color:var(--pp-gold-line)]" />
    </div>
  )
}

// ---------------------------------------------------------------- sections

export function AboutHome({ home, clampAt = 700, showFeatures = true }: { home: HomeView; clampAt?: number; showFeatures?: boolean }) {
  const [more, setMore] = useState(false)
  const long = home.description.length > clampAt
  const tags = [['Neighborhood', home.subdivision], ['Township', home.township], ['District', home.schoolDistrict]].filter(([, v]) => v) as [string, string][]
  return (
    <div>
      {tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--pp-gold-line)] bg-[var(--pp-gold-wash)] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[color:var(--pp-gold-text)]"><span className={pp.faint}>{k}</span>{v}</span>
          ))}
        </div>
      )}
      {home.description ? (
        <div className="relative mt-4">
          <p className={`whitespace-pre-line text-[17px] leading-[1.9] ${pp.text} first-letter:float-left first-letter:mr-2.5 first-letter:mt-1 first-letter:font-serif first-letter:text-[3.4rem] first-letter:font-black first-letter:leading-[0.8] first-letter:text-[color:var(--pp-gold)] ${long && !more ? 'line-clamp-[9]' : ''}`}>{home.description}</p>
          {long && (
            <button type="button" onClick={() => setMore(m => !m)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[color:var(--pp-gold-text)]">
              {more ? 'Show less' : 'Read the full description'} <ChevronRight className={`h-3.5 w-3.5 transition-transform ${more ? '-rotate-90' : 'rotate-90'}`} />
            </button>
          )}
        </div>
      ) : (
        <p className={`mt-6 italic ${pp.faint}`}>No description was provided for this listing.</p>
      )}
      {/* Bright: the listing brokerage on every detail page - quiet, but the same size as the
          listing data (not fine print). */}
      {listingSource(home) && <p className={`mt-7 text-sm italic leading-relaxed ${pp.faint}`}>{listingSource(home)}</p>}
      {showFeatures && home.features.length > 0 && (
        <div className={`mt-10 p-6 sm:p-8 ${pp.card}`}>
          <p className={pp.kicker}>Features & amenities</p>
          <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {home.features.map((f, i) => (
              <li key={i} className={`flex items-start gap-2.5 text-[14px] font-semibold ${pp.text}`}>
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--pp-gold-wash)] text-[color:var(--pp-gold)]"><Check className="h-3 w-3" /></span>{f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** The whole MLS record: one full-width card per group, its rows in two even columns, so the
 *  cards stack in a straight line instead of one column running far below the other. */
export function EveryDetail({ home }: { home: HomeView; columns?: 1 | 2 }) {
  const serif = useSerif()
  const groups = useMemo(() => detailGroups(home), [home])
  if (!groups.length) return null
  return (
    <>
      <div className="mt-7 space-y-5">
        {groups.map(grp => (
          <div key={grp.id} className={`overflow-hidden ${pp.card}`}>
            <div className="flex items-center gap-3 border-b border-[color:var(--pp-gold-line)] px-5 py-4" style={{ background: 'linear-gradient(90deg, var(--pp-gold-wash), transparent)' }}>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--pp-ink)] text-[color:var(--pp-gold)]"><grp.icon className="h-4 w-4" /></span>
              <p className={`text-lg font-black ${pp.heading} ${serif}`}>{grp.title}</p>
              <span className={`ml-auto text-[10px] font-black uppercase tracking-widest ${pp.faint}`}>{grp.rows.length} {grp.rows.length === 1 ? 'item' : 'items'}</span>
            </div>
            <dl className="grid px-5 md:grid-cols-2 md:gap-x-10">
              {grp.rows.map(([k, v], i) => (
                <div key={k} className={`grid grid-cols-[118px_1fr] gap-3 py-3 text-sm sm:grid-cols-[132px_1fr] ${i ? 'border-t border-[color:var(--pp-line)]' : ''} ${i === 1 ? 'md:border-t-0' : ''}`}>
                  <dt className={`font-bold ${pp.faint}`}>{k}</dt>
                  <dd className={`break-words font-semibold ${pp.heading}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {home.record.Directions && (
        <p className={`rounded-2xl border border-[color:var(--pp-line)] bg-[var(--pp-card)] p-4 text-sm ${pp.muted}`}><span className={`font-black ${pp.heading}`}>Directions: </span>{home.record.Directions}</p>
      )}
    </>
  )
}

export function hasDetails(home: HomeView) { return detailGroups(home).length > 0 }

/** One line of a home's price history (backend price_history_service.get_history). */
export type PriceEvent = { date: string | null; event: string; price?: number | null; change?: number | null; change_pct?: number | null; rental?: boolean }

const EVENT_DOT: Record<string, string> = {
  'Sold': 'bg-[var(--pp-gold)]', 'Price reduced': 'bg-emerald-500', 'Price increased': 'bg-rose-500',
  'Under contract': 'bg-sky-500', 'Pending': 'bg-sky-500', 'Back on market': 'bg-amber-500',
  'Temporarily off market': 'bg-gray-400', 'Taken off market': 'bg-gray-400', 'Listing removed': 'bg-gray-400', 'Rented': 'bg-gray-400', 'Listed for rent': 'bg-gray-400',
}

/** Every listing this home has had - listed, price cuts, under contract, sold - newest first. Uses
 *  `events` when the page already has them (IDX pages, the shared listing page); otherwise fetches
 *  them (Showcases). With no history beyond this one listing, falls back to the listing's own
 *  listed/changed summary. */
export function PriceHistory({ home, events: given }: { home: HomeView; events?: PriceEvent[] | null }) {
  const serif = useSerif()
  const [events, setEvents] = useState<PriceEvent[] | null>(given ?? null)
  useEffect(() => {
    if (given !== undefined) { setEvents(given ?? null); return }
    if (!home.key) return
    let live = true
    fetch(`${API_BASE_URL}/api/properties/price-history/${encodeURIComponent(home.key)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live && Array.isArray(d?.price_history)) setEvents(d.price_history) })
      .catch(() => {})
    return () => { live = false }
  }, [given, home.key])

  const rows = (events || []).filter(e => e.date)
  // Nothing beyond the listing's own "listed" line - the original summary says it best.
  if (rows.length < 2) return <PriceHistoryFromListing home={home} />

  // The change since this listing went on the market: the logged cuts after its "Listed" line.
  let sinceListed = 0
  for (const e of rows) {
    if (/^(Listed|Coming soon)/.test(e.event)) break
    if (e.change) sinceListed += e.change
  }
  return (
    <div className={`p-6 sm:p-7 ${pp.card}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={pp.kicker}>Current price</p>
          {home.price != null && <p className={`mt-2 text-3xl font-black leading-none ${pp.heading} ${serif}`}>{money(home.price)}</p>}
        </div>
        {sinceListed !== 0 && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${sinceListed < 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
            {sinceListed < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {money(Math.abs(sinceListed))} since listed
          </span>
        )}
      </div>
      <ol className="mt-5 divide-y divide-[color:var(--pp-line)]">
        {rows.map((e, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]">
            <span className={`order-2 col-span-2 text-xs font-semibold sm:order-none sm:col-span-1 ${pp.faint}`}>{shortDate(e.date)}</span>
            <span className={`flex items-center gap-2 text-sm font-black ${pp.heading}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${EVENT_DOT[e.event] || 'bg-[var(--pp-ink)]'}`} />{e.event}
            </span>
            <span className="text-right">
              <span className={`block text-sm font-black ${pp.heading}`}>{e.price != null ? money(e.price) : <span className={pp.faint}>-</span>}</span>
              {e.change != null && e.change !== 0 && (
                <span className={`block text-[11px] font-bold ${e.change < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {e.change < 0 ? '-' : '+'}{money(Math.abs(e.change))}{e.change_pct != null ? ` (${Math.abs(e.change_pct)}%)` : ''}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className={`mt-3 text-[11px] ${pp.faint}`}>From the MLS listing record{rows.some(e => e.price == null) ? ' - a dash means the MLS didn’t share that price' : ''}.</p>
    </div>
  )
}

/** Listed -> changed -> now. Only real changes show: a "change" to the same price isn't one. The
 *  feed often has the change date without the earlier price - then the listing row has no price
 *  (we don't know it) and the change row says what it is now. */
function PriceHistoryFromListing({ home }: { home: HomeView }) {
  const serif = useSerif()
  if (home.price == null) return null
  const prev = nz(home.record.PreviousListPrice)
  const start = home.originalPrice ?? null
  const delta = start != null && start !== home.price ? home.price - start : 0
  const pct = delta && start ? (delta / start) * 100 : 0
  // A change date with no earlier price at all (and no difference we can see).
  const unknownChange = !delta && start == null && !!home.priceChangedAt
  const steps: { when: string; what: string; amount: string; tone?: 'down' | 'up' }[] = []
  if (home.listedAt || start != null) steps.push({ when: shortDate(home.listedAt) || 'Listed', what: 'Listed for sale', amount: start != null ? money(start) : unknownChange ? '' : money(home.price) })
  if (delta && prev != null && prev !== start && prev !== home.price) steps.push({ when: 'Earlier', what: prev > (start ?? 0) ? 'Price increased' : 'Price reduced', amount: money(prev) })
  if (delta) steps.push({ when: shortDate(home.priceChangedAt) || 'Recently', what: delta < 0 ? 'Price reduced' : 'Price increased', amount: money(home.price), tone: delta < 0 ? 'down' : 'up' })
  else if (unknownChange) steps.push({ when: shortDate(home.priceChangedAt), what: 'Price changed to', amount: money(home.price) })
  return (
    <div className={`p-6 sm:p-7 ${pp.card}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={pp.kicker}>{delta ? 'Now' : 'Current price'}</p>
          <p className={`mt-2 text-3xl font-black leading-none ${pp.heading} ${serif}`}>{money(home.price)}</p>
        </div>
        {delta !== 0 && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${delta < 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
            {delta < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
            {money(Math.abs(delta))} ({Math.abs(pct).toFixed(1)}%)
          </span>
        )}
      </div>
      {steps.length > 1 || delta ? (
        <ol className="relative mt-6 space-y-5 border-l border-[color:var(--pp-gold-line)] pl-6">
          {steps.map((s, i) => (
            <li key={i} className="relative">
              <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-[color:var(--pp-card)] ${i === steps.length - 1 ? 'bg-[var(--pp-gold)]' : 'bg-[var(--pp-faint)]'}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className={`text-sm font-black ${pp.heading}`}>{s.what}</p>
                {s.amount && <p className={`text-sm font-black ${s.tone === 'down' ? 'text-emerald-600' : s.tone === 'up' ? 'text-rose-600' : pp.heading}`}>{s.amount}</p>}
              </div>
              <p className={`text-xs font-semibold ${pp.faint}`}>{s.when}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className={`mt-4 text-sm font-semibold ${pp.muted}`}>
          {home.listedAt ? `Listed ${shortDate(home.listedAt)} - ` : ''}no price changes since it hit the market.
        </p>
      )}
      {unknownChange && <p className={`mt-4 text-[11px] italic ${pp.faint}`}>The MLS shows a price change on {shortDate(home.priceChangedAt)} but doesn&apos;t include the earlier price.</p>}
    </div>
  )
}

export function LocationBlock({ home, map, children, mapClassName = 'h-[360px]' }: { home: HomeView; map: ReactNode; children?: ReactNode; mapClassName?: string }) {
  if (home.lat == null || home.lng == null) return null
  return (
    <>
      <div className={`mt-6 w-full overflow-hidden rounded-[26px] border border-[color:var(--pp-gold-line)] shadow-[0_30px_60px_-40px_rgba(0,0,0,.6)] ${mapClassName}`}>{map}</div>
      <a href={`https://www.google.com/maps/search/?api=1&query=${home.lat},${home.lng}`} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition hover:text-[color:var(--pp-gold-text)] ${pp.faint}`}>
        <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
      </a>
      {children}
    </>
  )
}

/** The price panel's buttons on a page where the visitor isn't rating homes (Listing Page, IDX):
 *  book a showing (gold, shining) and ask a question. */
export function HeroActions({ onShowing, onAsk, showingLabel = 'Schedule a showing' }: { onShowing: () => void; onAsk: () => void; showingLabel?: string }) {
  return (
    <div className="space-y-2">
      <motion.button type="button" onClick={onShowing} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
        className={`${pp.goldBtn} pp-shine h-11 w-full !py-0`}>
        <CalendarDays className="h-4 w-4" /> {showingLabel}
      </motion.button>
      <motion.button type="button" onClick={onAsk} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
        className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--pp-gold-line)] text-[11px] font-black uppercase tracking-widest transition-colors hover:border-[color:var(--pp-gold)] hover:text-[color:var(--pp-gold-text)] ${pp.heading}`}>
        <MessageCircle className="h-4 w-4" /> Ask a question
      </motion.button>
    </div>
  )
}

/** The price panel's buttons on pages whose side card already books showings and takes questions:
 *  share the home (the phone's share sheet, else copy the link) and directions to it. */
export function HeroShareActions({ home, url: shareUrl, row = false }: {
  home: HomeView
  /** What Share sends - default this page's own address; null hides Share (only Directions). */
  url?: string | null
  /** Side by side (under the Showcase's Love / Pass) instead of stacked. */
  row?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = shareUrl || window.location.href
    const title = [home.street, home.place].filter(Boolean).join(', ')
    try {
      if (navigator.share) { await navigator.share({ title, url }); return }
    } catch { /* closed the share sheet - fall through to copying */ }
    try { await copyText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }
  // The seller kept the address private (Bright "address display: no") - nothing to navigate to.
  const withheld = Boolean((home.record as any)?.address_withheld) || /address available on request/i.test(home.street || '')
  const directions = home.lat != null && home.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${home.lat},${home.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(home.fullAddress)}`
  const btn = `inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-colors`
  return (
    <div className={row ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
      {shareUrl !== null && <motion.button type="button" onClick={share} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
        className={`${btn} ${copied ? 'border-emerald-500 bg-emerald-500 text-white' : `border-[color:var(--pp-gold-line)] hover:border-[color:var(--pp-gold)] hover:text-[color:var(--pp-gold-text)] ${pp.heading}`}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={copied ? 'c' : 's'} className="inline-flex items-center gap-2" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.15 }}>
            {copied ? <><Check className="h-4 w-4" strokeWidth={3} /> Link copied</> : <><Share2 className="h-4 w-4" /> Share</>}
          </motion.span>
        </AnimatePresence>
      </motion.button>}
      {!withheld && <motion.a href={directions} target="_blank" rel="noopener noreferrer" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
        className={`${btn} border-[color:var(--pp-gold-line)] hover:border-[color:var(--pp-gold)] hover:text-[color:var(--pp-gold-text)] ${pp.heading} ${row && shareUrl === null ? 'col-span-2' : ''}`}>
        <Navigation className="h-4 w-4" /> Directions
      </motion.a>}
    </div>
  )
}

/** The dark card that holds a page's own actions (tour, message, Like/Pass...): the home's photo
 *  glowing faintly behind it, a moving gold edge and a few rising sparks. */
export function AgentPanel({ kicker, agent, backdrop, children, className = '' }: {
  kicker: string
  agent?: { name?: string | null; line?: string | null; photo?: string | null } | null
  /** The home's photo, faint behind the card. */
  backdrop?: string | null
  children?: ReactNode
  className?: string
}) {
  const serif = useSerif()
  return (
    <div className={`pp-panel relative isolate overflow-hidden rounded-[30px] bg-[var(--pp-ink)] p-6 text-white shadow-[0_44px_90px_-44px_rgba(0,0,0,.8)] ring-1 ring-white/10 ${className}`}>
      {backdrop && <img src={backdrop} alt="" aria-hidden className="pp-panel-ken absolute inset-0 -z-20 h-full w-full object-cover opacity-30" />}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_srgb,var(--pp-gold)_40%,transparent),transparent_58%),linear-gradient(180deg,color-mix(in_srgb,var(--pp-ink)_55%,transparent),var(--pp-ink)_78%)]" />
      <span aria-hidden className="pp-panel-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
      {[['12%', '20%', 0], ['84%', '14%', 1.5], ['78%', '58%', 2.7]].map(([l, t, d], k) => (
        <span key={k} aria-hidden className="pp-panel-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
      ))}
      {kicker && <p className="relative text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--pp-gold)]">{kicker}</p>}
      {agent?.name && (
        <div className={`relative flex items-center gap-3.5 ${kicker ? 'mt-4' : ''}`}>
          {agent.photo && <img src={agent.photo} alt={agent.name} className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-[color:var(--pp-gold)] ring-offset-2 ring-offset-[color:var(--pp-ink)]" />}
          <div className="min-w-0">
            <p className={`text-xl font-black leading-tight ${serif}`}>{agent.name}</p>
            {agent.line && <p className="truncate text-xs font-semibold text-white/55">{agent.line}</p>}
          </div>
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}

/** A section inside the dark agent card: a gold icon tile, a serif title and a short line. */
function PanelHead({ icon, title, sub, className = '' }: { icon: ReactNode; title: string; sub?: string; className?: string }) {
  const serif = useSerif()
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:color-mix(in_srgb,var(--pp-gold)_15%,transparent)] text-[color:var(--pp-gold)] ring-1 ring-[color:color-mix(in_srgb,var(--pp-gold)_30%,transparent)]">{icon}</span>
      <div className="min-w-0">
        <p className={`text-lg font-black leading-tight text-white ${serif}`}>{title}</p>
        {sub && <p className="mt-0.5 text-xs font-semibold text-white/50">{sub}</p>}
      </div>
    </div>
  )
}

/** "Schedule a showing": the next few days as one-tap chips over the big gold button - all open
 *  the page's showing flow. */
export function ShowingPicker({ onOpen, label = 'Schedule a showing', status, onAsk, availableFrom }: {
  onOpen: () => void; label?: string
  /** The listing's MLS status - a Coming Soon home can't be shown before it goes active (Bright
   *  rule, fines from $500), but a showing can be requested for a day on or after that. */
  status?: string | null
  /** Coming Soon with no known date: where "Tell me when showings open" goes (the question box). */
  onAsk?: () => void
  /** Coming Soon: Bright's Expected On Market Date - the first day it may be shown. */
  availableFrom?: string | null
}) {
  const comingSoon = /coming\s*soon/i.test(status || '')
  const opens = useMemo(() => {
    if (!comingSoon || !availableFrom) return null
    const d = new Date(`${String(availableFrom).slice(0, 10)}T12:00:00`)
    return Number.isNaN(d.getTime()) || d.getTime() < Date.now() - 86400000 ? null : d
  }, [comingSoon, availableFrom])
  const days = useMemo(() => {
    const tomorrow = Date.now() + 86400000
    const start = opens ? Math.max(tomorrow, opens.getTime()) : tomorrow
    return Array.from({ length: 4 }, (_, i) => new Date(start + i * 86400000))
  }, [opens])
  if (comingSoon && opens) {
    // Requests for a day once it's on the market are fine - the agent books it when showings open.
    const when = opens.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return (
      <div className="mt-5">
        <PanelHead icon={<CalendarDays className="h-5 w-5" />} title={`Showings start ${when}`} sub="Coming soon - pick a day on or after it, then the time." />
        <div className="mt-3.5 grid grid-cols-4 gap-1.5">
          {days.map((d, i) => (
            <motion.button key={i} type="button" onClick={onOpen}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
              whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }}
              className="flex flex-col items-center rounded-2xl border border-white/[0.12] bg-white/[0.06] py-2 transition-colors hover:border-[color:var(--pp-gold)] hover:bg-white/[0.1]">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/55">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="text-lg font-black leading-tight">{d.getDate()}</span>
            </motion.button>
          ))}
        </div>
        <motion.button type="button" onClick={onOpen} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className={`${pp.goldBtn} pp-shine mt-2.5 w-full`}>
          <CalendarDays className="h-4 w-4" /> Request a showing
        </motion.button>
      </div>
    )
  }
  if (comingSoon) {
    return (
      <div className="mt-5">
        <PanelHead icon={<CalendarDays className="h-5 w-5" />} title="Coming soon" sub="Showings open the day it goes active - be first in line." />
        <motion.button type="button" onClick={onAsk || onOpen} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className={`${pp.goldBtn} pp-shine mt-3.5 w-full`}>
          <CalendarDays className="h-4 w-4" /> Tell me when showings open
        </motion.button>
      </div>
    )
  }
  return (
    <div className="mt-5">
      <PanelHead icon={<CalendarDays className="h-5 w-5" />} title="Book a showing" sub="Pick a day - you'll choose the time next." />
      <div className="mt-3.5 grid grid-cols-4 gap-1.5">
        {days.map((d, i) => (
          <motion.button key={i} type="button" onClick={onOpen}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06 }}
            whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }}
            className="flex flex-col items-center rounded-2xl border border-white/[0.12] bg-white/[0.06] py-2 transition-colors hover:border-[color:var(--pp-gold)] hover:bg-white/[0.1]">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/55">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            <span className="text-lg font-black leading-tight">{d.getDate()}</span>
          </motion.button>
        ))}
      </div>
      <motion.button type="button" onClick={onOpen} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className={`${pp.goldBtn} pp-shine mt-2.5 w-full`}>
        <CalendarDays className="h-4 w-4" /> {label}
      </motion.button>
    </div>
  )
}

export function OpenHouseList({ home }: { home: HomeView }) {
  if (!home.openHouses.length) return null
  return (
    <div className="mt-5 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--pp-gold)]">Open house{home.openHouses.length > 1 ? 's' : ''}</p>
      <ul className="mt-2 space-y-1.5">
        {home.openHouses.slice(0, 3).map(oh => <li key={`${oh.date}-${oh.start || ''}`} className="flex items-center gap-2 text-sm font-semibold text-white/85"><CalendarDays className="h-3.5 w-3.5 text-[color:var(--pp-gold)]" />{formatOpenHouse(oh)}</li>)}
      </ul>
    </div>
  )
}

/** Required attribution for the listing brokerage - small print, not a contact card. */
export function Courtesy({ home, className = 'mt-12' }: { home: HomeView; className?: string }) {
  const line = listingSource(home)
  if (!line) return null
  return <p className={`border-t border-[color:var(--pp-gold-line)] pt-6 text-xs leading-relaxed ${pp.faint} ${className}`}>{line}</p>
}

/** Bright MLS IDX display rules for one home: the brokerage courtesy line, when the data last
 *  updated, "deemed reliable", the IDX program notice and the Bright copyright. `short` leaves the
 *  long notice to a full MLSComplianceFooter the page already renders under itself. */
export function BrightNotice({ home, updatedAt, short = false, className = 'mt-12' }: { home: HomeView; updatedAt?: string | null; short?: boolean; className?: string }) {
  const stamp = updatedAt || home.record.ModificationTimestamp || home.record.updated_at || null
  const when = stamp && !Number.isNaN(new Date(stamp).getTime()) ? new Date(stamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : null
  return (
    <div className={`border-t border-[color:var(--pp-gold-line)] pt-6 ${className}`}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold ${pp.faint}`}>
        {when && <span>Listing data last updated {when}</span>}
        {when && <span aria-hidden>·</span>}
        <span>Information deemed reliable but not guaranteed.</span>
      </div>
      {!short && (
        <>
          <p className={`mt-3 text-[11px] leading-relaxed ${pp.faint}`}>
            The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms, and is provided by BRIGHT through a licensing agreement. The information provided is for the personal, non-commercial use of consumers and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Some properties may no longer be available because they are under contract, have closed or are no longer being offered for sale.
          </p>
          <p className={`mt-3 text-[10px] font-black uppercase tracking-[0.2em] ${pp.muted}`}>© {new Date().getFullYear()} Bright MLS · All rights reserved</p>
        </>
      )}
    </div>
  )
}

/** The quick "Ask a question" box: name, phone, email (one of the two is enough) and the question.
 *  `onSend` delivers it (a lead + follow-up for the agent) and says whether it went. */
export function AskForm({ id, title, sub, agentFirst, agent, initial, onSend, embedded = false, className = '' }: {
  id?: string
  /** Inside the agent's showing card (AgentPanel): no card of its own and no second agent photo -
   *  just a divider and the form. */
  embedded?: boolean
  title: string
  sub?: string
  agentFirst?: string
  /** The agent's name + photo for the card's header. */
  agent?: { name?: string | null; photo?: string | null } | null
  initial?: { name?: string; email?: string; phone?: string; message?: string }
  onSend: (v: { name: string; email: string; phone: string; message: string }) => Promise<boolean>
  className?: string
}) {
  const serif = useSerif()
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [message, setMessage] = useState(initial?.message || '')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [problem, setProblem] = useState('')
  useEffect(() => { if (initial?.message) { setMessage(initial.message); setSent(false) } }, [initial?.message])
  // Who they are can arrive after the form opened (Google sign-in on the agent's site) - fill only empty boxes.
  useEffect(() => { if (initial?.name) setName(n => n || initial.name || '') }, [initial?.name])
  useEffect(() => { if (initial?.email) setEmail(e => e || initial.email || '') }, [initial?.email])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setProblem('Please add your name.')
    if (!email.trim() && !phone.trim()) return setProblem('Please add a phone number or an email so we can reply.')
    if (!message.trim()) return setProblem('Please type your question.')
    setProblem('')
    setBusy(true)
    const ok = await onSend({ name: name.trim(), email: email.trim(), phone: phone.trim(), message: message.trim() }).catch(() => false)
    setBusy(false)
    if (ok) { setSent(true); setMessage('') } else setProblem('That didn’t go through - please try again.')
  }
  const field = 'w-full rounded-2xl border border-white/[0.12] bg-white/[0.06] px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/35 focus:border-[color:var(--pp-gold)] focus:ring-4 focus:ring-white/10'
  const initials = String(agent?.name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
  return (
    <div id={id} className={embedded ? `relative scroll-mt-24 ${className}` : `relative isolate scroll-mt-24 overflow-hidden rounded-[26px] bg-[var(--pp-ink)] p-5 text-white shadow-[0_34px_70px_-40px_rgba(0,0,0,.85)] ring-1 ring-white/10 sm:p-6 ${className}`}>
      {embedded ? (
        <PanelHead className="mt-6 border-t border-white/10 pt-5" icon={<MessageCircle className="h-5 w-5" />} title="Ask a question" sub={`Goes straight to ${agentFirst || 'the agent'} - a phone or email is enough.`} />
      ) : (
        <>
          <span aria-hidden className="pp-panel-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-[var(--pp-gold)] opacity-25 blur-3xl" />
        </>
      )}
      {embedded ? null : agent?.name ? (
        <div className="flex items-center gap-3">
          <span className="relative h-12 w-12 shrink-0">
            {agent.photo
              ? <img src={agent.photo} alt={agent.name} className="h-full w-full rounded-full object-cover ring-2 ring-[color:var(--pp-gold)] ring-offset-2 ring-offset-[color:var(--pp-ink)]" />
              : <span className="grid h-full w-full place-items-center rounded-full bg-[var(--pp-gold)] text-base font-black text-[color:var(--pp-ink)]">{initials}</span>}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[color:var(--pp-ink)]" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--pp-gold)]">Questions about this home?</p>
            <p className={`truncate text-lg font-black leading-tight ${serif}`}>{agent.name}</p>
          </div>
        </div>
      ) : (
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--pp-gold)]">Questions about this home?</p>
      )}
      {!embedded && <h2 className={`mt-4 text-[1.35rem] font-black leading-tight ${serif}`}>{title}</h2>}
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mt-5 rounded-2xl bg-emerald-500/15 p-5 text-center ring-1 ring-emerald-400/25">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} className="inline-block"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" /></motion.span>
            <p className="mt-2 text-sm font-black">Sent - thank you!</p>
            <p className="mt-1 text-xs font-semibold text-white/60">{agentFirst ? `${agentFirst} will` : 'We’ll'} get back to you shortly.</p>
            <button type="button" onClick={() => setSent(false)} className="mt-3 text-[11px] font-black uppercase tracking-widest text-[color:var(--pp-gold)] hover:underline">Ask another question</button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!embedded && sub && <p className="mt-1 text-xs font-semibold text-white/50">{sub}</p>}
            <form onSubmit={submit} className="mt-4 space-y-2.5" noValidate>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className={field} autoComplete="name" />
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" aria-label="Phone" className={field} autoComplete="tel" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" aria-label="Email" className={field} autoComplete="email" />
              </div>
              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="What would you like to know about this home?" aria-label="Your question" className={`${field} min-h-[88px] resize-none`} />
              {problem && <p className="text-xs font-bold text-rose-300">{problem}</p>}
              <motion.button type="submit" disabled={busy} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                className="pp-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--pp-gold)] py-3.5 text-xs font-black uppercase tracking-widest text-[color:var(--pp-ink)] shadow-md disabled:opacity-50">
                <Send className="h-3.5 w-3.5" /> {busy ? 'Sending...' : 'Send question'}
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Phones: the page's main actions ride along at the bottom. */
export function PhoneBar({ photo, children }: { photo?: string | null; children: ReactNode }) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-2 rounded-2xl bg-[var(--pp-ink)] p-2 shadow-[0_20px_40px_-12px_rgba(0,0,0,.5)] ring-1 ring-white/10 lg:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      {photo && <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-full max-[379px]:hidden object-cover ring-2 ring-[color:var(--pp-gold)]" />}
      {children}
    </div>
  )
}

const PP_CSS = `
.pp{--pp-bg:#faf9f7;--pp-card:#fff;--pp-text:#111827;--pp-soft:#4b5563;--pp-muted:#6b7280;--pp-faint:#9ca3af;--pp-line:rgba(17,24,39,.07);--pp-heading:#111827;
--pp-gold-line:color-mix(in srgb,var(--pp-gold) 24%,transparent);--pp-gold-wash:color-mix(in srgb,var(--pp-gold) 12%,transparent);--pp-gold-text:color-mix(in srgb,var(--pp-gold) 78%,#3d2f12);color:var(--pp-text)}
.dark .pp[data-surface="app"]{--pp-bg:#0b0b0b;--pp-card:#151517;--pp-text:#f4f1ea;--pp-soft:#d9d5cc;--pp-muted:#a09c93;--pp-faint:#77736b;--pp-line:rgba(255,255,255,.08);--pp-heading:#fff;--pp-gold-text:var(--pp-gold);--pp-gold-line:color-mix(in srgb,var(--pp-gold) 20%,transparent)}
.pp[data-surface="site"]{--pp-bg:var(--site-bg);--pp-card:var(--site-surface);--pp-text:var(--site-ink);--pp-soft:var(--site-ink-soft);--pp-muted:var(--site-muted);--pp-faint:var(--site-faint);--pp-line:var(--site-line);--pp-heading:var(--site-heading)}
.ohp-site[data-mode="dark"] .pp[data-surface="site"]{--pp-gold-text:var(--pp-gold)}
.pp-in{animation:ppIn .9s cubic-bezier(.16,1,.3,1) both}
@keyframes ppIn{from{opacity:0;transform:translateY(14px) scale(.995)}to{opacity:1;transform:none}}
.pp-photo{animation:ppPhoto .45s ease both}
@keyframes ppPhoto{from{opacity:.35}to{opacity:1}}
/* The side column stays pinned only when all of it fits on the screen (else Send could sit below the fold). */
@media (min-width:1024px) and (min-height:900px){.pp-stick{position:sticky;top:6rem}}
@media (min-width:1024px) and (min-height:720px){.pp-stick-short{position:sticky;top:1.5rem}}
.pp-rise{animation:ppRise .7s .08s cubic-bezier(.16,1,.3,1) both}
@keyframes ppRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.pp-panel-ken{animation:ppKen 18s ease-out both}
@keyframes ppKen{from{transform:scale(1.15)}to{transform:scale(1.02)}}
.pp-panel-edge{background:linear-gradient(90deg,transparent 10%,var(--pp-gold) 50%,transparent 90%);background-size:200% 100%;animation:ppEdge 6s ease-in-out infinite}
@keyframes ppEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.pp-panel-spark{width:4px;height:4px;border-radius:999px;background:var(--pp-gold);box-shadow:0 0 10px 2px var(--pp-gold);opacity:0;animation:ppSpark 7s ease-in-out infinite}
@keyframes ppSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.pp-shine{position:relative;overflow:hidden}
.pp-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-100%);animation:ppShine 3.4s ease-in-out infinite}
@keyframes ppShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.pp-sheen{position:relative;overflow:hidden}
.pp-sheen::after{content:"";position:absolute;inset:0;transform:translateX(-120%);background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transition:transform .9s ease}
.pp-sheen:hover::after{transform:translateX(120%)}
@media (prefers-reduced-motion: reduce){.pp-in,.pp-rise,.pp-panel-ken,.pp-panel-edge,.pp-panel-spark,.pp-shine::after{animation:none}.pp-sheen::after{display:none}}
`
