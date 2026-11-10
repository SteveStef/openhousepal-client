'use client'

import { pimg } from './photoUrl'

// Every <Image> from next/image (Showcase cards, open-house cards, Discovery, homepage demos)
// gets its resized copy from the Cloudflare-storable /pimg/... address (lib/photoUrl.ts) instead
// of /_next/image?url=... - same resizing, same sizes, same quality.
// Files Next's resizer won't take (SVG, data:, blob:) or hosts it isn't allowed to fetch go out
// as-is, the way next/image treats them on its own.
const ALLOWED_HOSTS = [
  /(^|\.)brightmls\.com$/i,
  /(^|\.)cloudfront\.net$/i,
  /^openhousepal-images\.s3\.us-east-1\.amazonaws\.com$/i,
  /^images\.unsplash\.com$/i,
  /(^|\.)hdpcdn\.com$/i,
  /^img\.freepik\.com$/i,
  /^maps\.googleapis\.com$/i,
  /^localhost$/i,
]

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  if (!src || /^(data:|blob:)/i.test(src) || /\.svg(\?|#|$)/i.test(src)) return src
  if (/^https?:\/\//i.test(src)) {
    try {
      if (!ALLOWED_HOSTS.some(re => re.test(new URL(src).hostname))) return src
    } catch {
      return src
    }
  }
  return pimg(src, width, quality || 75)
}
