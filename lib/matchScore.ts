// Shared deterministic continuous relevance used by every "X% Match" badge. The raw relevance
// retains ranking/weight meaning; a monotonic presentation calibration makes the visible percent
// intuitive. CMA generation persists both values from its immutable evidence snapshot.

export function sqftToAcres(sqft?: number | null): number {
  return sqft ? Number((sqft / 43560).toFixed(2)) : 0
}

export function acresToSqft(acres?: number | null): number {
  return acres ? Math.round(acres * 43560) : 0
}

const COMPONENT_WEIGHTS = {
  proximity: 22,
  marketArea: 16,
  size: 20,
  propertyType: 12,
  lot: 9,
  ageStyle: 10,
  recency: 7,
  dataReliability: 4,
} as const

const getNum = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const value = obj?.[key]
    if (value !== undefined && value !== null && value !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

const getStr = (obj: any, keys: string[]): string => {
  for (const key of keys) {
    const value = obj?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return ''
}

const normalize = (value?: string | null) => (value || '').trim().toLowerCase().replace(/[_-]/g, ' ')
const halfLifeDecay = (delta: number, halfLife: number) => halfLife > 0 ? Math.pow(0.5, Math.abs(delta) / halfLife) : 0

const haversineMiles = (lat: number, lng: number, subjectLat: number, subjectLng: number) => {
  if (!lat || !lng || !subjectLat || !subjectLng) return null
  const toRad = (value: number) => value * Math.PI / 180
  const dLat = toRad(lat - subjectLat)
  const dLng = toRad(lng - subjectLng)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(subjectLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CONDO_HINTS = ['condo', 'unit', 'flat', 'apartment', 'penthouse']
const ATTACHED_HINTS = ['townhouse', 'townhome', 'row', 'twin', 'attached']
const DETACHED_HINTS = ['single family', 'singlefamily', 'detached', 'farm']
function typeFamily(raw?: string | null): 'condo' | 'attached' | 'detached' | null {
  const value = normalize(raw)
  if (!value) return null
  if (CONDO_HINTS.some(token => value.includes(token))) return 'condo'
  if (ATTACHED_HINTS.some(token => value.includes(token))) return 'attached'
  if (DETACHED_HINTS.some(token => value.includes(token))) return 'detached'
  return null
}

function styleFamily(raw?: string | null): string | null {
  const value = normalize(raw)
  if (!value) return null
  const families: Array<[string, string[]]> = [
    ['colonial traditional', ['colonial', 'traditional', 'georgian', 'federal']],
    ['modern', ['modern', 'contemporary', 'mid century']],
    ['tudor', ['tudor']],
    ['ranch', ['ranch', 'split level', 'bi level']],
    ['cape', ['cape cod', 'cape']],
    ['victorian', ['victorian', 'queen anne']],
    ['craftsman', ['craftsman', 'arts and crafts']],
    ['farmhouse', ['farmhouse']],
    ['mediterranean', ['mediterranean', 'spanish', 'mission']],
  ]
  return families.find(([, tokens]) => tokens.some(token => value.includes(token)))?.[0] || value
}

function lotSqft(property: any): number {
  return getNum(property, ['lot_size_sqft', 'LotSizeSquareFeet', 'lotSizeSquareFeet', 'lot_size', 'lotSize'])
    || getNum(property, ['acres', 'LotSizeAcres', 'lotSizeAcres', 'lot_size_acres']) * 43560
}

function distanceMiles(property: any, subject: any): number | null {
  const provided = property?.distanceMiles ?? property?.distance_miles
  if (provided !== undefined && provided !== null && Number.isFinite(Number(provided))) return Number(provided)
  return haversineMiles(
    getNum(property, ['Latitude', 'latitude']), getNum(property, ['Longitude', 'longitude']),
    getNum(subject, ['Latitude', 'latitude']), getNum(subject, ['Longitude', 'longitude']),
  )
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

const DEFAULT_PROXIMITY_HALF_LIFE = 2.5
const MIN_DENSITY_REFERENCES = 10
const DENSITY_RECENCY_WINDOWS_DAYS = [365, 548, 730, 1095, 1825]
export const MATCH_DISPLAY_CALIBRATION_VERSION = 'match-display-v1'
const MATCH_DISPLAY_CALIBRATION_EXPONENT = 0.70

export function calibrateMatchPercentage(rawRelevance: number): number {
  const raw = Math.max(0, Math.min(1, Number.isFinite(rawRelevance) ? rawRelevance : 0))
  return Math.max(1, Math.min(100, Math.round(100 * Math.pow(raw, MATCH_DISPLAY_CALIBRATION_EXPONENT))))
}

export function storedMatchPercentage(matchScore: number | null | undefined, details?: any): number | null {
  if (typeof matchScore !== 'number') return null
  if (details?.display_calibration_version === MATCH_DISPLAY_CALIBRATION_VERSION) return matchScore
  if (String(details?.version || '').startsWith('continuous-relevance')) {
    const raw = Number(
      details?.raw_relevance_score
      ?? (typeof details?.final_similarity_score === 'number' ? details.final_similarity_score / 100 : NaN),
    )
    if (Number.isFinite(raw)) return calibrateMatchPercentage(raw)
  }
  return matchScore
}

export interface MatchScoreDetails {
  score: number
  rawRelevanceScore: number
  displayCalibrationVersion: string
  baseRelevanceScore: number
  productModifier: number
  candidateDistanceMiles: number | null
  localMarketHalfLifeMiles: number
  densityReferenceCount: number
  densityDistancesUsedMiles: number[]
  densityFallbackUsed: boolean
  componentScores: Record<string, number>
  componentPoints: Record<string, number>
  availableComponentWeight: number
}

function suppliedDensityContext(property: any, subject: any): any | null {
  return property?.similarity_context
    || property?.similarity_details?.density_context
    || subject?.similarity_context
    || subject?.similarity_details?.density_context
    || null
}

function localDensityContext(subject: any, comparisonSet: any[], property?: any) {
  const supplied = suppliedDensityContext(property, subject)
  const suppliedHalfLife = Number(supplied?.distance_half_life_miles ?? supplied?.local_market_half_life_miles)
  if (Number.isFinite(suppliedHalfLife) && suppliedHalfLife > 0) {
    return {
      halfLife: Math.max(0.5, Math.min(5, suppliedHalfLife)),
      referenceCount: Number(supplied?.reference_count || 0),
      distancesUsed: Array.isArray(supplied?.density_distances_used_miles)
        ? supplied.density_distances_used_miles.map(Number).filter(Number.isFinite)
        : [],
      fallbackUsed: Boolean(supplied?.fallback_used),
    }
  }

  // Offline/manual fallback mirrors the server policy. Production search results carry the
  // stable MLS-local context above, so changing filters or comp order cannot change the scale.
  const subjectFamily = typeFamily(getStr(subject, ['PropertyType', 'property_type', 'home_type', 'homeType', 'StructureDesignType']))
  const subjectSqft = getNum(subject, ['AboveGradeFinishedArea', 'above_grade_finished_area', 'above_grade_sqft', 'LivingArea', 'livingArea', 'squareFeet', 'living_area', 'sqft'])
  const subjectLot = lotSqft(subject)
  const subjectYear = getNum(subject, ['YearBuilt', 'year_built', 'yearBuilt'])
  const seen = new Set<string>()
  const references = comparisonSet.flatMap((reference) => {
    const family = typeFamily(getStr(reference, ['PropertyType', 'property_type', 'home_type', 'homeType', 'StructureDesignType']))
    if (subjectFamily && family !== subjectFamily) return []
    const sqft = getNum(reference, ['AboveGradeFinishedArea', 'above_grade_finished_area', 'above_grade_sqft', 'LivingArea', 'livingArea', 'squareFeet', 'living_area', 'sqft'])
    if (subjectSqft && (!sqft || sqft < subjectSqft * 0.75 || sqft > subjectSqft * 1.25)) return []
    if (subjectFamily === 'detached') {
      const referenceLot = lotSqft(reference)
      if (subjectLot && (!referenceLot || referenceLot < subjectLot * 0.5 || referenceLot > subjectLot * 2)) return []
      const referenceYear = getNum(reference, ['YearBuilt', 'year_built', 'yearBuilt'])
      if (subjectYear && (!referenceYear || Math.abs(referenceYear - subjectYear) > 40)) return []
    }
    const distance = distanceMiles(reference, subject)
    if (distance === null || distance <= 0.01) return []
    const key = normalize([
      getStr(reference, ['street_address', 'StreetAddress', 'address']),
      getStr(reference, ['city', 'City']), getStr(reference, ['state', 'State']),
      getStr(reference, ['zipcode', 'PostalCode']),
    ].join('|')) || `${getNum(reference, ['latitude', 'Latitude']).toFixed(5)}|${getNum(reference, ['longitude', 'Longitude']).toFixed(5)}`
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [{ distance, reference }]
  })
  const isCurrent = (reference: any) => {
    const status = normalize(getStr(reference, ['status', 'home_status', 'StandardStatus', 'standardStatus']))
    return status.startsWith('active') || status.startsWith('pending')
      || status.startsWith('coming soon') || status === 'under contract' || status === 'contract'
  }
  const closeTimestamp = (reference: any) => Date.parse(
    getStr(reference, ['close_date', 'sale_date', 'CloseDate']),
  )
  const lifecycleKnown = references.some(({ reference }) => isCurrent(reference) || Number.isFinite(closeTimestamp(reference)))
  let selected = references
  if (lifecycleKnown) {
    for (const maxDays of DENSITY_RECENCY_WINDOWS_DAYS) {
      const cutoff = Date.now() - maxDays * 86400000
      const recent = references.filter(({ reference }) => (
        isCurrent(reference) || closeTimestamp(reference) >= cutoff
      ))
      selected = recent
      if (recent.length >= MIN_DENSITY_REFERENCES) break
    }
    if (selected.length < MIN_DENSITY_REFERENCES) selected = references
  }
  const distances = selected.map(({ distance }) => distance).sort((a, b) => a - b)
  const used = distances.length >= MIN_DENSITY_REFERENCES ? distances.slice(7, 12) : []
  const observed = median(used)
  return {
    halfLife: observed === null ? DEFAULT_PROXIMITY_HALF_LIFE : Math.max(0.5, Math.min(5, observed)),
    referenceCount: distances.length,
    distancesUsed: used,
    fallbackUsed: distances.length < MIN_DENSITY_REFERENCES,
  }
}

function marketAreaScore(property: any, subject: any): number | null {
  const fields: Array<[string[], number]> = [
    [['SchoolDistrictName', 'schoolDistrictName', 'school_district_name', 'schoolDistrict', 'school_district'], 0.35],
    [['township', 'Township', 'municipality', 'Municipality'], 0.25],
    [['subdivision_name', 'subdivisionName', 'SubdivisionName', 'neighborhood', 'neighborhood_name'], 0.25],
    [['City', 'city'], 0.15],
  ]
  const pieces = fields.flatMap(([keys, weight]) => {
    const subjectValue = normalize(getStr(subject, keys))
    const propertyValue = normalize(getStr(property, keys))
    return subjectValue && propertyValue ? [{ score: subjectValue === propertyValue ? 1 : 0, weight }] : []
  })
  const denominator = pieces.reduce((sum, piece) => sum + piece.weight, 0)
  return denominator ? pieces.reduce((sum, piece) => sum + piece.score * piece.weight, 0) / denominator : null
}

function recencyScore(property: any): number | null {
  const status = normalize(getStr(property, ['status', 'StandardStatus', 'standardStatus']))
  if (status !== 'sold' && status !== 'closed') return null
  const raw = getStr(property, ['close_date', 'sale_date', 'CloseDate'])
  const timestamp = Date.parse(raw)
  if (!Number.isFinite(timestamp)) return null
  const days = Math.max(0, (Date.now() - timestamp) / 86400000)
  return Math.max(0.15, Math.pow(0.5, days / 183))
}

function dataReliabilityScore(property: any, subject: any): number {
  const status = normalize(getStr(property, ['status', 'StandardStatus', 'standardStatus']))
  const sold = status === 'sold' || status === 'closed'
  const price = sold
    ? getNum(property, ['sale_price', 'close_price', 'ClosePrice'])
    : getNum(property, ['list_price', 'ListPrice', 'price'])
  const verifiedPrice = Boolean(price && (!sold || property?.price_verified !== false))
  const sqft = getNum(property, ['LivingArea', 'livingArea', 'squareFeet', 'living_area', 'sqft'])
  const hasDistance = distanceMiles(property, subject) !== null
  const hasDate = !sold || recencyScore(property) !== null
  const hasType = Boolean(typeFamily(getStr(property, ['PropertyType', 'property_type', 'home_type', 'homeType', 'StructureDesignType'])))
  return (verifiedPrice ? 0.35 : 0) + (sqft ? 0.20 : 0) + (hasDistance ? 0.15 : 0)
    + (hasDate ? 0.15 : 0) + (hasType ? 0.10 : 0) + (lotSqft(property) ? 0.05 : 0)
}

function factBlob(property: any): string {
  const values = [
    property?.public_remarks, property?.PublicRemarks, property?.amenities, property?.features,
    property?.interior_features, property?.exterior_features, property?.pool_features,
    property?.other_structures, property?.architectural_style,
  ]
  return normalize(values.flatMap(value => Array.isArray(value) ? value : [value]).filter(Boolean).join(' '))
}

function hasDocumentedFeature(blob: string, pattern: RegExp): boolean {
  const matches = new RegExp(pattern.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = matches.exec(blob)) !== null) {
    const prefix = blob.slice(Math.max(0, match.index - 70), match.index)
    if (/(?:\bno\b|\bwithout\b|\blacks?\b|does not have)\s+(?:an?\s+|the\s+)?$/.test(prefix)) continue
    // Future conversion potential is not an existing property feature. This distinction matters
    // for product modifiers: a garage "plumbed for a guest suite" is not a guest suite.
    if (/(?:potential|opportunity|option|plans?|proposed|possible|future|ready|roughed|plumbed|wired)\s+(?:in\s+place\s+)?(?:for|to\s+(?:add|create|build|convert))\s+(?:an?\s+|the\s+)?$/.test(prefix)) continue
    if (/(?:could|can|may)\s+be\s+(?:used|finished|converted|developed)\s+(?:as|into)\s+(?:an?\s+|the\s+)?$/.test(prefix)) continue
    return true
  }
  return false
}

function productModifier(property: any, subject: any): number {
  let modifier = 1
  const subjectType = typeFamily(getStr(subject, ['PropertyType', 'property_type', 'home_type', 'homeType', 'StructureDesignType']))
  const propertyType = typeFamily(getStr(property, ['PropertyType', 'property_type', 'home_type', 'homeType', 'StructureDesignType']))
  if (subjectType && propertyType && subjectType !== propertyType) modifier *= 0.55

  const subjectFacts = factBlob(subject)
  const propertyFacts = factBlob(property)
  if (subjectFacts && propertyFacts) {
    const pool = /\b(pool|swimming pool|in ground|in-ground)\b/i
    const accessory = /\b(guest (house|suite|wing|apartment)|in law|in-law|adu|accessory dwelling|carriage house|apartment (?:above|over))\b/i
    if (hasDocumentedFeature(subjectFacts, pool) !== hasDocumentedFeature(propertyFacts, pool)) modifier *= 0.90
    if (hasDocumentedFeature(subjectFacts, accessory) !== hasDocumentedFeature(propertyFacts, accessory)) modifier *= 0.82
  }
  return Math.max(0.50, Math.min(1, modifier))
}

/**
 * Continuous deterministic relevance plus its user-facing percentage. Physical/location
 * relevance is the raw base; condition and renovation are intentionally excluded. Documented
 * major product mismatches are bounded modifiers. Missing factors are omitted, not scored zero.
 */
export function computeMatchScoreDetails(property: any, subject: any, comparisonSet: any[] = []): MatchScoreDetails {
  const subjectSqft = getNum(subject, ['AboveGradeFinishedArea', 'above_grade_finished_area', 'above_grade_sqft', 'LivingArea', 'livingArea', 'squareFeet', 'living_area', 'sqft'])
  const propertySqft = getNum(property, ['AboveGradeFinishedArea', 'above_grade_finished_area', 'above_grade_sqft', 'LivingArea', 'livingArea', 'squareFeet', 'living_area', 'sqft'])
  const subjectLot = lotSqft(subject)
  const propertyLot = lotSqft(property)
  const subjectYear = getNum(subject, ['YearBuilt', 'yearBuilt', 'year_built'])
  const propertyYear = getNum(property, ['YearBuilt', 'yearBuilt', 'year_built'])
  const subjectType = typeFamily(getStr(subject, ['PropertyType', 'property_type', 'home_type', 'homeType', 'StructureDesignType']))
  const propertyType = typeFamily(getStr(property, ['PropertyType', 'property_type', 'home_type', 'homeType', 'StructureDesignType']))
  const subjectStyle = styleFamily(getStr(subject, ['ArchitecturalStyle', 'architectural_style', 'structure_type']))
  const propertyStyle = styleFamily(getStr(property, ['ArchitecturalStyle', 'architectural_style', 'structure_type']))
  const distance = distanceMiles(property, subject)
  const density = localDensityContext(subject, comparisonSet, property)

  const components: Array<{ name: keyof typeof COMPONENT_WEIGHTS; weight: number; score: number }> = []
  if (distance !== null) components.push({ name: 'proximity', weight: COMPONENT_WEIGHTS.proximity, score: halfLifeDecay(distance, density.halfLife) })
  const area = marketAreaScore(property, subject)
  if (area !== null) components.push({ name: 'marketArea', weight: COMPONENT_WEIGHTS.marketArea, score: area })
  if (subjectSqft && propertySqft) components.push({ name: 'size', weight: COMPONENT_WEIGHTS.size, score: halfLifeDecay(propertySqft - subjectSqft, Math.max(subjectSqft * 0.22, 400)) })
  if (subjectType && propertyType) components.push({ name: 'propertyType', weight: COMPONENT_WEIGHTS.propertyType, score: subjectType === propertyType ? 1 : 0 })
  if (subjectLot && propertyLot) components.push({ name: 'lot', weight: COMPONENT_WEIGHTS.lot, score: halfLifeDecay(propertyLot - subjectLot, Math.max(subjectLot * 0.4, 10890)) })

  const ageStyle: Array<{ score: number; weight: number }> = []
  if (subjectYear && propertyYear) ageStyle.push({ score: halfLifeDecay(propertyYear - subjectYear, 22), weight: 0.65 })
  if (subjectStyle && propertyStyle) ageStyle.push({ score: subjectStyle === propertyStyle ? 1 : 0.55, weight: 0.35 })
  if (ageStyle.length) {
    const denominator = ageStyle.reduce((sum, item) => sum + item.weight, 0)
    components.push({ name: 'ageStyle', weight: COMPONENT_WEIGHTS.ageStyle, score: ageStyle.reduce((sum, item) => sum + item.score * item.weight, 0) / denominator })
  }
  const recency = recencyScore(property)
  if (recency !== null) components.push({ name: 'recency', weight: COMPONENT_WEIGHTS.recency, score: recency })
  components.push({ name: 'dataReliability', weight: COMPONENT_WEIGHTS.dataReliability, score: dataReliabilityScore(property, subject) })

  const denominator = components.reduce((sum, component) => sum + component.weight, 0)
  if (!denominator) {
    return {
      score: calibrateMatchPercentage(0.5), rawRelevanceScore: 0.5,
      displayCalibrationVersion: MATCH_DISPLAY_CALIBRATION_VERSION,
      baseRelevanceScore: 0.5, productModifier: 1,
      candidateDistanceMiles: distance, localMarketHalfLifeMiles: density.halfLife,
      densityReferenceCount: density.referenceCount, densityDistancesUsedMiles: density.distancesUsed,
      densityFallbackUsed: density.fallbackUsed, componentScores: {}, componentPoints: {},
      availableComponentWeight: 0,
    }
  }
  const base = components.reduce((sum, component) => sum + component.score * component.weight, 0) / denominator
  const modifier = productModifier(property, subject)
  const rawRelevanceScore = base * modifier
  return {
    score: calibrateMatchPercentage(rawRelevanceScore),
    rawRelevanceScore,
    displayCalibrationVersion: MATCH_DISPLAY_CALIBRATION_VERSION,
    baseRelevanceScore: base,
    productModifier: modifier,
    candidateDistanceMiles: distance,
    localMarketHalfLifeMiles: density.halfLife,
    densityReferenceCount: density.referenceCount,
    densityDistancesUsedMiles: density.distancesUsed,
    densityFallbackUsed: density.fallbackUsed,
    componentScores: Object.fromEntries(components.map(component => [component.name, component.score])),
    componentPoints: Object.fromEntries(components.map(component => [component.name, component.score * component.weight])),
    availableComponentWeight: denominator,
  }
}

export function computeMatchScore(property: any, subject: any, comparisonSet: any[] = []): number {
  return computeMatchScoreDetails(property, subject, comparisonSet).score
}

export function isSameSchoolDistrict(property: any, subject: any): boolean {
  const keys = ['SchoolDistrictName', 'schoolDistrictName', 'school_district_name', 'schoolDistrict', 'school_district']
  const school = normalize(getStr(property, keys))
  const subjectSchool = normalize(getStr(subject, keys))
  return Boolean(school && subjectSchool && school === subjectSchool)
}

export function getMatchScore(subject: any, candidate: any, comparisonSet: any[] = []): number {
  return computeMatchScore(candidate, subject, comparisonSet)
}
