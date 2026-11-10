// The one address every resized photo is served from: /pimg/<width>/<quality>/p.webp?u=<photo>.
//
// Why not Next's own /_next/image?url=...: Cloudflare (in front of the live server) only stores
// files whose address ends in a picture extension. /_next/image has none, so every visitor's
// every photo was re-shrunk by our own small server (11/10 check: cf-cache-status DYNAMIC). Ending
// the address in .webp lets Cloudflare keep each size after the first visitor - free, no
// dashboard setting. next.config.js rewrites /pimg/... straight back to /_next/image, so the
// resizing itself is unchanged (WebP when the browser takes it, the photo's own format if not -
// Cloudflare doesn't care what the extension says, it only uses it to decide to keep the file).
export function pimg(src: string, width: number, quality = 75): string {
  return `/pimg/${width}/${quality}/p.webp?u=${encodeURIComponent(src)}`
}
