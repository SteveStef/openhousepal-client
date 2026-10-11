/**
 * Cleans up a property address string for display.
 * Extracts the most relevant parts (usually street and city) and applies Title Case. Handles cases where the address might start with State/County info.
 */
export const cleanAddress = (address: string, city?: string): string => {
  if (!address) return 'Address Not Available';

  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length === 0) return 'Address Not Available';

  // If the first part is a state abbreviation or full state name, it's likely a malformed string
  // where the street is missing or at the end.
  const stateRegex = /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC|Pennsylvania|Delaware|Maryland|New Jersey|Virginia)$/i;

  let streetIndex = 0;
  // Skip parts that look like just a state or a generic location without a number
  // but only if there are more parts available
  while (streetIndex < parts.length - 1 && (stateRegex.test(parts[streetIndex]) || !anyDigit(parts[streetIndex]))) {
    streetIndex++;
  }

  // Take the street and the next part (usually city) if available in the same string
  const streetPart = parts[streetIndex];
  const cityInAddress = parts.length > streetIndex + 1 ? parts[streetIndex + 1] : '';

  // Use the provided city if the address string didn't seem to contain one
  const finalCity = cityInAddress || city || '';

  const rawAddress = (finalCity && !streetPart.toLowerCase().includes(finalCity.toLowerCase())) 
    ? `${streetPart}, ${finalCity}` 
    : streetPart;

  return rawAddress
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Standardizes MLS Status strings for display.
 * Renames "ACTIVE-BRIGHT" to "FOR SALE" and "COMING SOON-BRIGHT" to "COMING SOON".
 */
export const formatMlsStatus = (status: string | null | undefined): string => {
  if (!status) return 'Active';
  
  const s = status.toUpperCase().trim();
  
  if (s.includes('ACTIVE-BRIGHT') || s === 'ACTIVE') {
    return 'FOR SALE';
  }
  
  if (s.includes('COMING SOON')) {
    return 'COMING SOON';
  }
  
  // Default to the original but cleaned up
  return s;
};

/**
 * Whether an MLS status means the property can still be bought (Active/Coming Soon variants).
 * Anything else - Sold, Under Contract, Pending, Withdrawn, etc. - is not available.
 */
export const isPropertyAvailableStatus = (status: string | null | undefined): boolean => {
  if (!status) return true; // Assume available if no status
  const normalized = status.toLowerCase().replace(/[_\s-]/g, '');
  const allowed = ['active', 'activebright', 'comingsoon', 'comingsoonbright'];
  return allowed.includes(normalized);
};

/**
 * Formats property type strings for display.
 * Replaces underscores with spaces (e.g., "SINGLE_FAMILY" -> "SINGLE FAMILY").
 */
export const formatPropertyType = (type: string | null | undefined): string => {
  if (!type) return 'N/A';
  return type.replace(/_/g, ' ').toUpperCase();
};

/**
 * Formats property features like beds, baths, and sqft.
 * Displays a dash (-) if the value is null, undefined, or 0.
 */
export const formatPropertyFeature = (value: number | string | null | undefined, isSqFt: boolean = false): string => {
  if (value === null || value === undefined || value === 0 || value === '0' || value === '') {
    return '-';
  }
  
  if (isSqFt) {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
    if (isNaN(numValue)) return '-';
    return numValue.toLocaleString();
  }
  
  return String(value);
};

const anyDigit = (s: string) => /\d/.test(s);

/**
 * Adds thousands-separator commas to a numeric string/number for display (e.g. 450000 -> "450,000").
 * Returns the input unchanged (minus commas) if it isn't a valid number - e.g. while the user is
 * still mid-typing a decimal like "450.".
 */
export const formatNumberWithCommas = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null || value === '') return '';
  const stringValue = value.toString().replace(/,/g, '');
  if (isNaN(Number(stringValue))) return stringValue;
  const [whole, decimal] = stringValue.split('.');
  const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined ? `${wholeWithCommas}.${decimal}` : wholeWithCommas;
};

export const stripCommas = (value: string): string => value.replace(/,/g, '');

/**
 * Strips a raw keystroke value down to digits-only-plus-one-decimal-point, for number/currency
 * inputs that should reject any other character (letters, multiple dots, etc).
 */
export const sanitizeNumericInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDotIndex = cleaned.indexOf('.');
  if (firstDotIndex === -1) return cleaned;
  return cleaned.slice(0, firstDotIndex + 1) + cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
};

// Default min/max search range from a subject property's price (used to seed the Similar
// Properties sheet) - rounds outward to a clean increment instead of leaving oddly precise numbers
// like $620,000-$930,000 on screen. The increment widens for expensive homes so a multi-million
// dollar listing gets a sensibly coarse range instead of a false-precision one.
export function roundedPriceRange(price: number): { minPrice: number; maxPrice: number } {
  if (!price) return { minPrice: 0, maxPrice: 0 };
  const increment = price >= 3_000_000 ? 250_000 : price >= 1_000_000 ? 100_000 : 50_000;
  const minPrice = Math.max(0, Math.floor((price * 0.8) / increment) * increment);
  const maxPrice = Math.ceil((price * 1.2) / increment) * increment;
  return { minPrice, maxPrice };
}

// Straight-line (haversine) distance in miles - purely local math, no API call. Used for showcase
// "X mi from your destination" badges: cheap enough to recompute on every render, so distances stay
// in sync the instant a visitor changes their destination/search address, with no extra round trip.
const EARTH_RADIUS_MILES = 3958.7613;

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type MapPoint = { address?: string | null; lat?: number | null; lng?: number | null };

// Standard cross-platform Google Maps directions deep link (docs.google.com/maps "Get directions"
// URL scheme) - opening it hands off entirely to Google Maps for the actual route/traffic/travel
// time, we're just constructing the link, never calling a routing API ourselves. Prefers a clean
// address for each end (better UX in Maps - shows a real place name); falls back to "lat,lng" only
// when no address string is available.
export function googleMapsDirectionsUrl(origin: MapPoint, destination: MapPoint): string | null {
  const encodePoint = (point: MapPoint): string | null => {
    if (point.address && point.address.trim()) return encodeURIComponent(point.address.trim());
    if (point.lat != null && point.lng != null) return `${point.lat},${point.lng}`;
    return null;
  };
  const originParam = encodePoint(origin);
  const destinationParam = encodePoint(destination);
  if (!originParam || !destinationParam) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destinationParam}&travelmode=driving`;
}

export function normalizeImageUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('/')) {
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${url}`;
  }
  // Force https for real remote links (avoids mixed-content blocking against MLS-sourced http
  // URLs) - but leave localhost alone, since dev's own backend only ever serves plain http.
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) return url;
  return url.replace(/^http:\/\//i, 'https://');
};

