import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const runtime = 'nodejs'

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Security pass (11/18): this proxy used to fetch ANY address it was given, so anyone could make our
// server reach inside its own network (the backend, Docker services, the cloud metadata address).
// It still loads pictures from any PUBLIC site - MLS listing photos live on many hosts (Bright's CDN,
// listing companies' own sites), plus our CloudFront/S3, Unsplash, Wikimedia... - but never from a
// private, loopback, link-local or otherwise reserved address, re-checked on every redirect hop.
// Same rule as the backend's app/utils/safe_fetch.py. Our own API (relative "/..." paths and the
// API_URL host) stays allowed: in development uploaded files are served from it.
const MAX_BYTES = 25 * 1024 * 1024
const MAX_REDIRECTS = 5
const TIMEOUT_MS = 15000

// Our own API - its exact origin (host AND port), so a trusted host can't be used to reach other
// services on the same machine.
function trustedOrigins(): Set<string> {
  const origins = new Set<string>()
  for (const raw of [process.env.INTERNAL_API_URL, process.env.NEXT_PUBLIC_API_URL, process.env.API_URL]) {
    try { if (raw) origins.add(new URL(raw).origin.toLowerCase()) } catch { /* not a URL */ }
  }
  return origins
}

function blockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return blockedIp(v.slice(7))
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9')
    || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff')
}

function isTrusted(url: URL): boolean {
  return trustedOrigins().has(url.origin.toLowerCase())
}

// `trustOwn`: our own API only counts while every hop so far was our own API - an outside site
// redirecting to the API's inside address is refused like any other inside address.
async function isPublic(url: URL, self: string, trustOwn: boolean): Promise<boolean> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (trustOwn && isTrusted(url)) return true
  // A development server's own pages (the Spotlight fact sheet sends "<this site>/..." photos). On
  // the live server this site is a public address and passes the normal check below.
  if (process.env.NODE_ENV !== 'production' && url.origin.toLowerCase() === self) return true
  if (isIP(host)) return !blockedIp(host)
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false
  try {
    const addrs = await lookup(host, { all: true })
    return addrs.length > 0 && addrs.every(a => !blockedIp(a.address))
  } catch {
    return false
  }
}

function resolveImageUrl(raw: string): URL | null {
  try {
    if (raw.startsWith('/') && !raw.startsWith('//')) return new URL(raw, INTERNAL_API_URL)
    // "//host/photo.jpg" (no scheme) = an https link; it still goes through the public-address check.
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url') || ''
  let url = resolveImageUrl(raw)
  if (!url) return NextResponse.json({ detail: 'Invalid image URL.' }, { status: 400 })

  // Follow redirects ourselves so every hop gets the same public-address check.
  let upstream: Response | null = null
  let trustOwn = true
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    trustOwn = trustOwn && isTrusted(url as URL)
    if (!(await isPublic(url, request.nextUrl.origin.toLowerCase(), trustOwn))) return NextResponse.json({ detail: 'Image could not be loaded.' }, { status: 400 })
    try {
      upstream = await fetch((url as URL).toString(), { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch {
      return NextResponse.json({ detail: 'Image could not be loaded.' }, { status: 502 })
    }
    const loc: string | null = upstream.status >= 300 && upstream.status < 400 ? upstream.headers.get('location') : null
    if (!loc) break
    try { url = new URL(loc, url) } catch { return NextResponse.json({ detail: 'Image could not be loaded.' }, { status: 502 }) }
    upstream = null
  }
  if (!upstream) return NextResponse.json({ detail: 'Too many redirects.' }, { status: 502 })
  if (!upstream.ok) return NextResponse.json({ detail: 'Image could not be loaded.' }, { status: upstream.status })

  const contentType = upstream.headers.get('content-type') || 'image/jpeg'
  if (!contentType.toLowerCase().startsWith('image/')) {
    return NextResponse.json({ detail: 'URL did not return an image.' }, { status: 415 })
  }
  const declared = Number(upstream.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) return NextResponse.json({ detail: 'Image is too large.' }, { status: 413 })

  const body = await upstream.arrayBuffer()
  if (body.byteLength > MAX_BYTES) return NextResponse.json({ detail: 'Image is too large.' }, { status: 413 })
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
