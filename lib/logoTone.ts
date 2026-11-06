'use client'

import { useEffect, useState } from 'react'

// A logo can be any color, and the bar it sits on can be light or dark (owner, 11/05: Peter's white
// Compass logo vanished on a light top bar). A logo is never recolored (owner, 11/06: do what's
// standard - nobody changes a logo, and brokerages' brand rules forbid it). The page reads it once,
// and one that would vanish sits on a small backing:
//   light  a see-through logo that's almost entirely light: a dark backing on a light background
//   dark   any other see-through logo: a white backing on a dark background
//   plain  no see-through background (a JPG, a logo on its own box): shown as it is
export type LogoTone = 'light' | 'dark' | 'plain'

const known = new Map<string, LogoTone>()
const reading = new Set<Promise<unknown>>()

/** A design's print page waits for this, so an export never captures a logo before it's been read. */
export const logoTonesRead = () => Promise.all(Array.from(reading))

function measure(url: string): Promise<LogoTone | null> {
  return new Promise(done => {
    const img = new Image()
    img.onerror = () => done(null)
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx || !w || !h) return done(null)
        ctx.drawImage(img, 0, 0)
        const px = ctx.getImageData(0, 0, w, h).data
        let clear = 0, solid = 0, light = 0
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 32) { clear++; continue }
          if (px[i + 3] <= 128) continue
          solid++
          if ((0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255 >= 0.72) light++
        }
        if (!solid || clear / (w * h) < 0.08) return done('plain')
        // Share of the logo itself, so a white badge with dark words is never taken for a white logo.
        done(light / solid >= 0.9 ? 'light' : 'dark')
      } catch { done(null) }
    }
    // Through this site's own image route: the photo host doesn't let pages read a file's pixels directly.
    img.src = `/_next/image?url=${encodeURIComponent(url)}&w=64&q=75`
  })
}

export function useLogoTone(url?: string | null): LogoTone | undefined {
  const [tone, setTone] = useState<LogoTone | undefined>(() => (url ? known.get(url) : undefined))
  useEffect(() => {
    if (!url) return
    const had = known.get(url)
    if (had) { setTone(had); return }
    let live = true
    const job = Promise.race([measure(url), new Promise<null>(done => setTimeout(() => done(null), 4000))])
      .then(t => { if (t) known.set(url, t); if (live && t) setTone(t) })
      .finally(() => { reading.delete(job) })
    reading.add(job)
    return () => { live = false }
  }, [url])
  return tone
}
