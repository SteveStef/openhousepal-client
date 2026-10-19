// Right-sized photos for the agent's public pages (IDX site first). MLS photos arrive as full
// 1440-2048px JPEGs (300-450 KB each) and a single home page showed ~30 of them - 10-15 MB per
// visit on a phone (10/19 sweep). Next's built-in optimizer (/_next/image, already allowed for
// these hosts in next.config.js remotePatterns and running on the live server) re-encodes them to
// WebP/AVIF at the width actually shown: a 640px card photo is ~60-80 KB.
//
// Works on every address the site answers on - proxy.ts never rewrites /_next/image.
// Anything not from an allowed host (data:, blob:, local /demos, unknown CDNs) passes through
// untouched, so these helpers are always safe to wrap around a URL.

// Mirrors next.config.js images.remotePatterns (only hosts that serve real photos).
const OPTIMIZABLE = [
  /(^|\.)brightmls\.com$/i,
  /(^|\.)cloudfront\.net$/i,
  /^openhousepal-images\.s3\.us-east-1\.amazonaws\.com$/i,
  /^images\.unsplash\.com$/i,
  /(^|\.)hdpcdn\.com$/i,
]

// Next only answers widths from its configured lists (images.deviceSizes + images.imageSizes,
// defaults) - anything else is a 400.
const ALLOWED_WIDTHS = [64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048]

function canOptimize(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  try {
    const host = new URL(url).hostname
    return OPTIMIZABLE.some(re => re.test(host))
  } catch {
    return false
  }
}

function snapWidth(w: number): number {
  return ALLOWED_WIDTHS.find(a => a >= w) || ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]
}

/** The photo at (about) `width` CSS-independent pixels, as WebP/AVIF - or the URL unchanged. */
export function sizedImage(url: string | null | undefined, width: number, quality = 70): string {
  if (!url) return ''
  if (!canOptimize(url)) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=${snapWidth(width)}&q=${quality}`
}

/** srcset across `widths` (browser picks by layout width x screen density). Empty when not optimizable. */
export function sizedSrcSet(url: string | null | undefined, widths: number[] = [384, 640, 828, 1080], quality = 70): string {
  if (!url || !canOptimize(url)) return ''
  return widths.map(w => `${sizedImage(url, w, quality)} ${snapWidth(w)}w`).join(', ')
}

/** CSS background-image value for a photo shown about `width` px wide (one size for every screen). */
export function sizedBg(url: string | null | undefined, width: number, quality = 70): string | undefined {
  if (!url) return undefined
  return `url("${sizedImage(url, width, quality)}")`
}

/** Presets: card photo (grid / row), half-screen photo, and full-bleed hero. */
export const IMG = {
  card: [256, 384, 640, 828],
  half: [640, 828, 1080, 1200],
  hero: [640, 828, 1080, 1200, 1920],
} as const
