'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// How long each photo stays on screen while cycling (owner asked for ~4s, 10/07).
export const ROTATE_MS = 4000
// How long the crossfade itself takes.
const FADE_DURATION_S = 1.4
// A soft "expo out" curve (fast start, long gentle settle) instead of plain easeInOut - reads as
// a more deliberate, cinematic dissolve rather than a basic fade.
const FADE_EASE = [0.16, 1, 0.3, 1] as const
// Only a slow zoom in or a slow zoom out, alternating per photo - no side-to-side or diagonal
// drift (owner's call, 10/07). Small scale range over the photo's whole time on screen, so the
// move is gentle and unhurried.
const PHOTO_EFFECTS = ['zoom-in', 'zoom-out'] as const
const ZOOM_SMALL = 1.01
const ZOOM_BIG = 1.08

// Module-scope (not redefined on every render) - AnimatePresence needs a stable component
// identity across re-renders to actually run exit animations, same reasoning as the open house
// kiosk sign-in sheet's PhotoLayer this is adapted from (see app/open-house/[id]/page.tsx).
function PhotoFrame({ photos, photoIndex, effectOffset }: { photos: string[]; photoIndex: number; effectOffset: number }) {
  const zoomDuration = ROTATE_MS / 1000 + FADE_DURATION_S * 2
  const zoomOut = PHOTO_EFFECTS[(photoIndex + effectOffset) % PHOTO_EFFECTS.length] === 'zoom-out'
  return (
    <AnimatePresence mode="sync">
      <motion.div
        key={photoIndex}
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${photos[photoIndex]})`, transformOrigin: '50% 50%' }}
        initial={{ opacity: 0, scale: zoomOut ? ZOOM_BIG : ZOOM_SMALL }}
        animate={{ opacity: 1, scale: zoomOut ? ZOOM_SMALL : ZOOM_BIG }}
        exit={{ opacity: 0 }}
        transition={{
          opacity: { duration: FADE_DURATION_S, ease: FADE_EASE },
          scale: { duration: zoomDuration, ease: 'linear' },
        }}
      />
    </AnimatePresence>
  )
}

// A hover-only version of the open house kiosk sign-in sheet's rotating photo display (slow Ken
// Burns pans/zooms cycling through a listing's real photos) - see app/open-house/[id]/page.tsx's
// PhotoLayer, which this is adapted from. Deliberately gated to `active` (hover) rather than
// always-on: at rest, every card just shows a plain static cover photo (cheap, calm); the
// cinematic cycling is a discovery moment reserved for a visitor actually engaging with a card,
// not constant motion across a page full of them.
export default function KioskPhotoLayer({ photos, active, effectOffset = 0 }: { photos: string[]; active: boolean; effectOffset?: number }) {
  const [index, setIndex] = useState(0)
  const [loaded, setLoaded] = useState<Set<number>>(new Set())

  // Preload every photo (not gated on `active` - by the time a hover-only hero card actually
  // needs one, it should already be sitting in the browser's cache) so the rotation below can
  // wait for a full decode instead of ever swapping to a URL the browser is still fetching -
  // that's what causes a photo to visibly pop in blurry/low-res and sharpen a moment later.
  useEffect(() => {
    let cancelled = false
    setLoaded(new Set())
    photos.forEach((url, i) => {
      const img = new window.Image()
      img.onload = () => {
        if (cancelled) return
        setLoaded(prev => (prev.has(i) ? prev : new Set(prev).add(i)))
      }
      img.src = url
    })
    return () => { cancelled = true }
  }, [photos])

  useEffect(() => {
    if (!active || photos.length < 2) return
    const id = setInterval(() => {
      // Only actually advance once the next photo has finished loading - otherwise hold the
      // current one for another tick and try again, rather than reveal a half-loaded image.
      // Prefers a slightly longer hold over ever showing that blurry-then-sharp pop.
      setIndex(i => {
        const next = (i + 1) % photos.length
        return loaded.has(next) ? next : i
      })
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [active, photos.length, loaded])

  useEffect(() => {
    if (!active) setIndex(0)
  }, [active])

  if (photos.length === 0) return null
  if (!active) {
    // The hero card's hover state - deliberately just a slow, plain zoom on the ONE cover photo,
    // not a photo swap. A long duration (not the usual snappy hover transition) is what makes it
    // read as a considered, cinematic zoom rather than a quick UI hover effect.
    return <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[4000ms] ease-out group-hover:scale-110" style={{ backgroundImage: `url(${photos[0]})` }} />
  }
  return <PhotoFrame photos={photos} photoIndex={index} effectOffset={effectOffset} />
}
