import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { styledQrSvgString, type QrCenter } from './qrStyle'

// ---- What goes in the middle of every QR (user, 10/17): the OpenHousePal house logo by default;
// IDX agents can pick their Brand Kit logo or initials (backend qr_brand_routes). The page tells us
// whose code it is drawing - the signed-in agent (AuthContext) or, on a guest page, the agent who
// owns it - and every code drawn afterwards uses that agent's choice.
let activeOwner: string | null = null
let activeCenter: QrCenter = { kind: 'ohp' }
let activeLoad: Promise<QrCenter> = Promise.resolve(activeCenter)
const centerByOwner = new Map<string, Promise<QrCenter>>()
const listeners = new Set<() => void>()
const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

export function setQrOwner(ownerId: string | null | undefined, opts: { refresh?: boolean } = {}): void {
  if (!ownerId) return
  if (ownerId === activeOwner && !opts.refresh) return
  activeOwner = ownerId
  if (opts.refresh) centerByOwner.delete(ownerId)
  let p = centerByOwner.get(ownerId)
  if (!p) {
    p = fetch(`${API}/qr-brand/${encodeURIComponent(ownerId)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((b): QrCenter => b?.kind === 'logo' && b.logo ? { kind: 'logo', logo: b.logo }
        : b?.kind === 'initials' && b.initials ? { kind: 'initials', initials: b.initials } : { kind: 'ohp' })
      .catch((): QrCenter => ({ kind: 'ohp' }))
    centerByOwner.set(ownerId, p)
  }
  activeLoad = p.then(c => {
    if (activeOwner === ownerId) { activeCenter = c; cache.clear(); listeners.forEach(f => f()) }
    return c
  })
}
/** The centre in use right now (synchronous - for SVG drawn inline, e.g. Studio designs). */
export function currentQrCenter(): QrCenter { return activeCenter }
/** Re-render when the centre changes (a hook-friendly subscribe). */
export function onQrCenterChange(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f) } }
/** Wait (briefly) for the agent's choice before drawing - never longer than `ms`. */
export function qrCenterReady(ms = 2500): Promise<QrCenter> { return centerReady(ms) }
function centerReady(ms = 1500): Promise<QrCenter> {
  return Promise.race([activeLoad, new Promise<QrCenter>(r => setTimeout(() => r(activeCenter), ms))])
}
export function useQrCenter(): QrCenter {
  const [c, setC] = useState<QrCenter>(activeCenter)
  useEffect(() => onQrCenterChange(() => setC(activeCenter)), [])
  return c
}

// Every QR code the app draws (printed kits, kiosk, Similar Homes cards) is generated right here
// in the browser - never by an outside QR website, so a kit can't print without its code because
// someone else's service was slow, down or rate-limiting us.

export type QrOptions = {
  size?: number
  /** Quiet-zone width in modules. Most of our codes already sit on a white tile, so 1 is enough. */
  margin?: number
  /** Error correction - 'H' when a logo is laid over the middle of the code. */
  ecc?: 'L' | 'M' | 'Q' | 'H'
  dark?: string
  light?: string
  /** Corner-eye + centre-mark colour for the house style (default deep bronze). */
  eye?: string
  /** false = the plain square code (no rounded dots, no centre mark). */
  styled?: boolean
}

// The house style (lib/qrStyle) drawn to a PNG through a canvas - browser only; anywhere without a
// DOM (or if drawing fails) falls back to the plain code so a kit never prints without one.
async function styledPng(text: string, o: QrOptions): Promise<string> {
  const center = await centerReady()
  const svg = styledQrSvgString(text, { dot: o.dark, eye: o.eye, margin: o.margin ?? 1, light: o.light, center })
  if (!svg || typeof document === 'undefined') throw new Error('no dom')
  const size = o.size ?? 300
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const cv = document.createElement('canvas')
        cv.width = size; cv.height = size
        const ctx = cv.getContext('2d')
        if (!ctx) return reject(new Error('no ctx'))
        ctx.drawImage(img, 0, 0, size, size)
        resolve(cv.toDataURL('image/png'))
      } catch (e) { reject(e) }
    }
    img.onerror = reject
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  })
}

const cache = new Map<string, Promise<string>>()

/** PNG data URL for `text`. Cached, so re-rendering a document doesn't re-encode the same code. */
export function qrDataUrl(text: string, o: QrOptions = {}): Promise<string> {
  const key = JSON.stringify([text, o.size, o.margin, o.ecc, o.dark, o.light, o.eye, o.styled, activeOwner])
  let p = cache.get(key)
  if (!p) {
    const plain = () => QRCode.toDataURL(text, {
      width: o.size ?? 300,
      margin: o.margin ?? 1,
      errorCorrectionLevel: o.ecc ?? 'M',
      color: { dark: o.dark ?? '#000000', light: o.light ?? '#ffffff' },
    })
    p = o.styled === false ? plain() : styledPng(text, o).catch(plain)
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

/** For a react-pdf <Image src>: react-pdf awaits a function source before laying out the page. */
export function qrPdfSrc(text: string, o: QrOptions = {}) {
  return () => qrDataUrl(text, o)
}

/** For a plain <img>: '' until the code is ready (a moment on first render). */
export function useQrDataUrl(text: string | null | undefined, o: QrOptions = {}): string {
  const [src, setSrc] = useState('')
  const center = useQrCenter()
  const key = JSON.stringify([text, o.size, o.margin, o.ecc, o.dark, o.light, o.eye, o.styled, center.kind, center.kind === 'logo' ? center.logo.length : center.kind === 'initials' ? center.initials : ''])
  useEffect(() => {
    let live = true
    if (!text) { setSrc(''); return }
    qrDataUrl(text, o).then(u => { if (live) setSrc(u) }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return src
}
