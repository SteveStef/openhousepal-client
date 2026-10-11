import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { styledQrSvgString } from './qrStyle'

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
function styledPng(text: string, o: QrOptions): Promise<string> {
  const svg = styledQrSvgString(text, { dot: o.dark, eye: o.eye, margin: o.margin ?? 1, light: o.light })
  if (!svg || typeof document === 'undefined') return Promise.reject(new Error('no dom'))
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
  const key = JSON.stringify([text, o.size, o.margin, o.ecc, o.dark, o.light, o.eye, o.styled])
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
  const key = JSON.stringify([text, o.size, o.margin, o.ecc, o.dark, o.light, o.eye, o.styled])
  useEffect(() => {
    let live = true
    if (!text) { setSrc(''); return }
    qrDataUrl(text, o).then(u => { if (live) setSrc(u) }).catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return src
}
