// What the Open House Cheat Sheet shows - worked out once, here, for both the printed PDF
// (lib/pdfs.tsx OpenHouseCheatSheetDocument) and the Guest Pass's web version of it
// (components/guest-pass/CheatSheetView.tsx), so the two can never drift apart. Input is the
// open house's saved cheat_sheet_snapshot (property + amenities), which the agent's kit edits keep
// up to date.
import { normalizeImageUrl } from '@/lib/utils'

export interface CheatSheetPhoto { url: string; x?: number; y?: number }
export interface AmenityPlace { name: string; address?: string | null; distance_miles?: number | null; place_type?: string | null }
export interface CheatSheetAmenities {
  schools: AmenityPlace[]
  private_schools: AmenityPlace[]
  grocery_stores: AmenityPlace[]
  medical_care: AmenityPlace[]
  parks: AmenityPlace[]
  downtown_areas: AmenityPlace[]
  airports: AmenityPlace[]
  available: boolean
}

export type CheatSheetIcon =
  | 'bed' | 'bath' | 'ruler' | 'calendar' | 'landPlot' | 'droplet' | 'waves' | 'dollar'
  | 'snowflake' | 'gradCap' | 'flame' | 'house' | 'squareCheck'
export interface CheatSheetFact { icon: CheatSheetIcon; label: string; value: string; wide?: boolean }

export const toTitleCase = (str: string): string => {
  if (!str) return ''
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

/** MLS addresses often arrive in capitals ("239 WINDHAM DR, WAYNE, PA 19087"). Title-case only a
 *  string with no lowercase at all, keeping 2-letter state codes ("PA") as they are. */
export const tidyAllCaps = (str?: string | null): string => {
  if (!str) return ''
  if (/[a-z]/.test(str)) return str
  const parts = str.split(/(\s+|,)/)
  return parts.map((w, i) => {
    // A 2-letter word after a comma is a state code - leave it.
    if (/^[A-Z]{2}$/.test(w) && parts.slice(0, i).includes(',')) return w
    return w.charAt(0) + w.slice(1).toLowerCase()
  }).join('')
}

export const formatStreetCity = (street: string, city: string): string => `${toTitleCase(street)}, ${toTitleCase(city)}`

export const formatCurrencyCompact = (value?: number | string | null) => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return ''
  return `$${num.toLocaleString()}`
}

export const joinField = (val?: string[] | string | null): string => {
  if (!val) return '—'
  if (Array.isArray(val)) return val.length ? val.join(', ') : '—'
  return val
}

export const truncateAtSentence = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  const truncated = text.slice(0, maxLength)
  const sentenceEnd = Math.max(truncated.lastIndexOf('. '), truncated.lastIndexOf('! '), truncated.lastIndexOf('? '))
  // Only cut at the sentence boundary if it doesn't throw away too much of the target length -
  // otherwise (e.g. one long run-on sentence) fall back to a clean word break instead.
  if (sentenceEnd > maxLength * 0.5) return truncated.slice(0, sentenceEnd + 1)
  const wordBoundary = truncated.lastIndexOf(' ')
  return `${truncated.slice(0, wordBoundary > 0 ? wordBoundary : maxLength)}…`
}

export const cleanSchoolName = (value?: string | null): string => {
  if (!value) return ''
  return value
    .replace(/\b(elementary|middle|junior|senior|high)\s+school\b/gi, '')
    .replace(/\bschool\b/gi, '')
    .replace(/\btownship\b/gi, '')
    .replace(/\s+(elementary|middle|junior|senior|high)$/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,/-])/g, '$1')
    .replace(/([,/-])\s+/g, '$1 ')
    .trim()
}

export const cleanDistrictTownshipName = (value?: string | null): string => {
  if (!value) return ''
  return value.replace(/\bschool\s+district\b/gi, '').replace(/\btownship\b/gi, '').replace(/\s{2,}/g, ' ').trim()
}

export const truncateAtCleanSentence = (text: string, maxLength: number): string => {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  const truncated = cleaned.slice(0, maxLength)
  const sentenceEndPattern = /[.!?](?=\s|$)/g
  let lastSentenceEnd: number | undefined
  let match = sentenceEndPattern.exec(truncated)
  while (match) {
    lastSentenceEnd = match.index
    match = sentenceEndPattern.exec(truncated)
  }
  if (lastSentenceEnd != null) return truncated.slice(0, lastSentenceEnd + 1).trim()
  const firstSentenceEnd = cleaned.search(/[.!?](?=\s|$)/)
  if (firstSentenceEnd > -1 && firstSentenceEnd <= maxLength + 120) return cleaned.slice(0, firstSentenceEnd + 1).trim()
  const wordBoundary = truncated.lastIndexOf(' ')
  return `${truncated.slice(0, wordBoundary > 0 ? wordBoundary : maxLength).trim()}...`
}

// The AI "Highlights of [address]" paragraph, capped so it never grows past ~3 printed lines.
// `prefixChars` is the "Highlights of [address]: " heading's own length (they share the budget).
const CHEAT_SHEET_HIGHLIGHTS_MAX_TOTAL_CHARS = 400

export const normalizeHighlightsParagraph = (value: string | string[] | null | undefined): string => {
  const raw = Array.isArray(value) ? value.join('. ') : (value || '')
  return raw.replace(/^[\s\-*•]+/gm, '').replace(/\s+/g, ' ').trim()
}

export const fitHighlightsParagraph = (paragraph: string, prefixChars: number): string =>
  truncateAtCleanSentence(paragraph, Math.max(80, CHEAT_SHEET_HIGHLIGHTS_MAX_TOTAL_CHARS - prefixChars))

export const cityFromAddress = (address?: string | null) => {
  if (!address) return ''
  const parts = address.split(',').map(part => part.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

const numberFrom = (...values: unknown[]): number | null => {
  for (const value of values) {
    const num = Number(value)
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(num)) return num
  }
  return null
}

export const photoAt = (photos: (string | CheatSheetPhoto)[] | undefined, index: number): CheatSheetPhoto | null => {
  if (!photos || photos.length === 0) return null
  const photo = photos[index % photos.length]
  if (typeof photo === 'string') return { url: normalizeImageUrl(photo), x: 50, y: 50 }
  return { ...photo, url: normalizeImageUrl(photo.url), x: photo.x ?? 50, y: photo.y ?? 50 }
}

export const staticMapUrlFor = (property: any, size = '640x210'): string | null => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
  const lat = numberFrom(property.googleRooftopLatitude, property.google_rooftop_latitude, property.latitude, property.lat)
  const lng = numberFrom(property.googleRooftopLongitude, property.google_rooftop_longitude, property.longitude, property.lng)
  if (!apiKey || lat == null || lng == null) return null
  const marker = encodeURIComponent(`color:red|${lat},${lng}`)
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=${size}&scale=2&maptype=roadmap&markers=${marker}&key=${apiKey}`
}

export function buildCheatSheetContent(property: any, amenities?: CheatSheetAmenities | null) {
  const coverPhoto = photoAt(property.photos, 0)
  const detailPhotoOne = photoAt(property.photos, 1)
  const detailPhotoTwo = photoAt(property.photos, 2)
  const heroAddress = formatStreetCity(property.address, property.city || '')
  const staticMapUrl = staticMapUrlFor(property)
  // Only worth its own tile if it tells guests something the total Sq Ft (shown in Basic Info) doesn't already.
  const hasBelowGrade = !!property.belowGradeSqft && property.belowGradeSqft > 0
  const hasDistinctAboveGrade = !!property.aboveGradeSqft && property.sqft != null && property.aboveGradeSqft !== property.sqft
  const showSqftSplit = hasBelowGrade || hasDistinctAboveGrade
  const sqftSplit = [
    property.aboveGradeSqft ? `${Number(property.aboveGradeSqft).toLocaleString()} above` : null,
    property.belowGradeSqft ? `${Number(property.belowGradeSqft).toLocaleString()} below` : null,
  ].filter(Boolean).join(' / ')
  const hasHoaIncludes = Array.isArray(property.hoaIncludes) ? property.hoaIncludes.length > 0 : !!property.hoaIncludes

  const basicInfo: CheatSheetFact[] = [
    { icon: 'bed', label: 'Beds', value: property.beds != null ? String(property.beds) : '—' },
    { icon: 'bath', label: 'Baths', value: property.baths != null ? String(property.baths) : '—' },
    { icon: 'ruler', label: 'Sq Ft', value: property.sqft ? Number(property.sqft).toLocaleString() : '—' },
    { icon: 'calendar', label: 'Build Year', value: property.yearBuilt ? String(property.yearBuilt) : '—' },
    { icon: 'landPlot', label: 'Acres', value: property.acres ? String(property.acres) : '—' },
  ]
  const hoaFeeValue = property.hoaFee
    ? `$${Number(property.hoaFee).toLocaleString()}${property.hoaFeeFrequency ? ` / ${property.hoaFeeFrequency}` : ''}`
    : '—'

  const schoolTownship = [property.schoolDistrict, property.township].filter(Boolean).join(' / ') || '—'
  const hasSchoolTownship = Boolean(property.schoolDistrict || property.township)
  // Backend sends final assigned schools only: Bright MLS first per level, then NCES attendance
  // boundaries for missing levels. It never uses nearest-school guessing.
  const assignedSchool = (level: string) => amenities?.schools?.find(s => s.place_type === level)?.name
  const assignedSchools = [
    property.elementarySchool || assignedSchool('Elementary School'),
    property.middleSchool || assignedSchool('Middle School'),
    property.highSchool || assignedSchool('High School'),
  ].filter(Boolean).map(school => cleanSchoolName(school))
  const hasAssignedSchools = assignedSchools.length > 0
  const cleanedSchoolTownship = [cleanDistrictTownshipName(property.schoolDistrict), cleanDistrictTownshipName(property.township)].filter(Boolean).join(' / ') || schoolTownship
  const canPairSchoolTiles = hasAssignedSchools && hasSchoolTownship
  // Pre-truncated at a word boundary with an ellipsis (react-pdf's numberOfLines clips mid-word).
  const publicSchoolsDisplayValue = truncateAtSentence(assignedSchools.join(' / '), canPairSchoolTiles ? 85 : 290)

  const heatingValue = joinField(property.heating)
  const heatingFuelValue = joinField(property.heatingFuel)
  const heatingCombined = [heatingValue !== '—' ? heatingValue : null, heatingFuelValue !== '—' ? heatingFuelValue : null].filter(Boolean).join(' / ') || '—'

  const propertyInfoLine: CheatSheetFact[] = [
    { icon: 'droplet', label: 'Water Source', value: joinField(property.waterSource) },
    { icon: 'waves', label: 'Sewer', value: joinField(property.sewer) },
    { icon: 'dollar', label: 'Annual Taxes', value: property.taxAnnualAmount ? `$${Number(property.taxAnnualAmount).toLocaleString()}${property.taxYear ? ` (${property.taxYear})` : ''}` : '—' },
    { icon: 'snowflake', label: 'Cooling', value: joinField(property.cooling) },
  ]
  const propertyInfo: CheatSheetFact[] = [
    ...(showSqftSplit ? [{ icon: 'ruler' as const, label: 'Sq Ft Split (Abv / Blw Grade)', value: sqftSplit }] : []),
    { icon: 'flame' as const, label: 'Heating/Fuel Source', value: heatingCombined },
    ...(property.hoaFee ? [{ icon: 'house' as const, label: 'HOA Fee', value: hoaFeeValue }] : []),
    // Pairs on the same row as HOA Fee (default half-width tile).
    ...(hasHoaIncludes ? [{ icon: 'squareCheck' as const, label: 'HOA Covers', value: joinField(property.hoaIncludes) }] : []),
  ]

  // Defensive against an older-shaped amenities payload missing a key entirely.
  const amenityLists = amenities ? [
    amenities.private_schools, amenities.grocery_stores, amenities.medical_care,
    amenities.parks, amenities.downtown_areas, amenities.airports,
  ] : []
  const hasAmenities = !!amenities?.available && amenityLists.some(list => (list?.length ?? 0) > 0)
  // The printed sheet must fit exactly 2 pages: 3 items per "What's Nearby" category, 2 once more
  // than 4 categories have data.
  const populatedAmenityCategories = amenityLists.filter(list => (list?.length ?? 0) > 0).length
  const amenityItemCap = populatedAmenityCategories > 4 ? 2 : 3

  // "Highlights of <address>: ..." (AI paragraph) when there is one, else the MLS description.
  let highlights: { prefix: string; body: string } | null = null
  let descriptionText: string | null = null
  if (property.descriptionHighlights && property.descriptionHighlights.length > 0) {
    const prefix = `Highlights of ${heroAddress}: `
    highlights = { prefix, body: fitHighlightsParagraph(normalizeHighlightsParagraph(property.descriptionHighlights), prefix.length) }
  } else if (property.description) {
    descriptionText = truncateAtCleanSentence(property.description, hasAmenities ? 300 : 460)
  }

  return {
    coverPhoto, detailPhotoOne, detailPhotoTwo, heroAddress, staticMapUrl,
    priceText: formatCurrencyCompact(property.price) || 'Available',
    basicInfo, propertyInfoLine, propertyInfo, highlights, descriptionText,
    hasAssignedSchools, hasSchoolTownship, canPairSchoolTiles, publicSchoolsDisplayValue, cleanedSchoolTownship,
    hasAmenities, amenityItemCap,
  }
}
