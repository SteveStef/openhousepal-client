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

export function normalizeImageUrl(url?: string) {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
};

