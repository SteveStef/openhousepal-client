'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { HeaderMode, HeaderMotion, HeroFrame } from './model'

// The moving picture behind a Spotlight page's header - shared by both templates. Three modes the
// agent picks in the editor:
//   photo - the main photo, fading in with a slow zoom (in, out, both = drifts back and forth)
//   cycle - a slideshow of the listing photos, each dissolving into the next while it zooms
//   video - the AI "living photo" loop (poster = the photo, so there's never a blank frame)
// Reduced motion always gets the still main photo.
//
// Framing: every picture is placed by placePhoto() - centered on the agent's chosen spot (the
// middle by default) at the smallest size that fills the header AND keeps the MLS badge (bottom-
// left of every MLS photo) out of view: a small nudge first, a little more zoom only if a nudge
// isn't enough. The slow zoom then runs around that same spot, so it never re-reveals the badge.

export const DEFAULT_FRAME: HeroFrame = { x: 50, y: 50, zoom: 1.12 }

/** A header taller than this (width / height) is a phone header - it uses the phone's own spot. */
export const PHONE_RATIO = 0.85
/** The spot to keep centered for a header this shape (0-100 of the photo). */
export function spotFor(frame: HeroFrame, phone: boolean): { x: number; y: number } {
  return phone ? { x: frame.px ?? frame.x, y: frame.py ?? frame.y } : { x: frame.x, y: frame.y }
}

/** The Bright MLS badge's corner of the photo, as fractions of the photo (with a little margin). */
const BADGE = { w: 0.18, h: 0.1 }

export type Placement = { k: number; L: number; T: number; ox: number; oy: number }

/** Where a w×h photo sits in a W×H header: scale k, top-left (L, T) and the zoom's anchor (ox, oy),
 *  all in header pixels. fx / fy = the spot to keep centered, 0..1 of the photo. */
export function placePhoto(W: number, H: number, w: number, h: number, fx: number, fy: number, hideBadge = true): Placement {
  const cover = Math.max(W / w, H / h)
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const at = (k: number) => ({ L: clamp(W / 2 - fx * w * k, W - w * k, 0), T: clamp(H / 2 - fy * h * k, H - h * k, 0) })
  const done = (k: number, L: number, T: number): Placement => ({
    k, L, T,
    ox: clamp(L + fx * w * k, 0, W),
    oy: clamp(T + fy * h * k, 0, H),
  })
  if (!hideBadge) { const p = at(cover); return done(cover, p.L, p.T) }
  for (let k = cover; k <= cover * 1.4; k *= 1.004) {
    const { L, T } = at(k)
    const leftEdge = -L / k            // first photo column on screen
    const bottomEdge = (H - T) / k     // last photo row on screen
    if (leftEdge >= BADGE.w * w || bottomEdge <= (1 - BADGE.h) * h) return done(k, L, T)
    const nudges: { L: number; T: number; cost: number }[] = []
    const needL = -BADGE.w * w * k     // slide the photo left until the badge's column is off screen
    if (needL >= W - w * k) nudges.push({ L: Math.min(L, needL), T, cost: Math.abs(Math.min(L, needL) - L) / W })
    const needT = H - (1 - BADGE.h) * h * k // or up until its row is
    if (needT <= 0) nudges.push({ L, T: Math.max(T, needT), cost: Math.abs(Math.max(T, needT) - T) / H })
    const best = nudges.sort((a, b) => a.cost - b.cost)[0]
    if (best && best.cost <= 0.2) return done(k, best.L, best.T)
  }
  const k = cover * 1.4
  const p = at(k)
  return done(k, p.L, p.T)
}

/** The header's size, kept current. */
function useBox(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState<{ W: number; H: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => { if (el.clientWidth && el.clientHeight) setBox({ W: el.clientWidth, H: el.clientHeight }) }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

export default function HeroMedia({ hero, photos, mode, motion, videoUrl, videoPoster, alt, className = '', frame }: {
  hero: string | null
  photos: string[]
  mode: HeaderMode
  motion: HeaderMotion
  videoUrl?: string | null
  videoPoster?: string | null
  alt: string
  className?: string
  /** Where the main photo is centered and how far the zoom travels (default: the middle). */
  frame?: HeroFrame | null
}) {
  const [reduced, setReduced] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])
  const wrap = useRef<HTMLDivElement>(null)
  const box = useBox(wrap)
  const f = { ...DEFAULT_FRAME, ...(frame || {}) }

  if (!hero) return null
  const useVideo = mode === 'video' && !!videoUrl && !videoFailed && !reduced
  return (
    <div ref={wrap} className={`hm ${className}`} aria-hidden={false}>
      <style>{HM_CSS}</style>
      {useVideo ? (
        <Placed kind="video" src={videoUrl!} poster={videoPoster || hero} box={box} frame={f} motionClass="hm-fade" alt={alt} onError={() => setVideoFailed(true)} />
      ) : mode === 'cycle' && !reduced && photos.length > 1 ? (
        <HeroCycle photos={[hero, ...photos.filter(u => u !== hero)].slice(0, 8)} motion={motion} alt={alt} box={box} frame={f} />
      ) : (
        <Placed kind="img" src={hero} box={box} frame={f} motionClass={`hm-fade ${reduced ? '' : `hm-photo-${motion}`}`} alt={alt} priority />
      )}
    </div>
  )
}

/** One photo (or the living-photo video) placed by placePhoto - invisible until it's measured, so
 *  it never flashes a badly cropped frame first. */
function Placed({ kind, src, poster, box, frame, motionClass, style, alt, priority, onError }: {
  kind: 'img' | 'video'
  src: string
  poster?: string
  box: { W: number; H: number } | null
  frame: HeroFrame
  motionClass?: string
  style?: React.CSSProperties
  alt: string
  priority?: boolean
  onError?: () => void
}) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [broken, setBroken] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  useEffect(() => {
    setNat(null)
    const el = img.current
    if (el && el.complete && el.naturalWidth) setNat({ w: el.naturalWidth, h: el.naturalHeight })
  }, [src])
  const spot = spotFor(frame, !!box && box.W / box.H < PHONE_RATIO)
  const p = useMemo(
    () => (box && nat ? placePhoto(box.W, box.H, nat.w, nat.h, spot.x / 100, spot.y / 100) : null),
    [box, nat, spot.x, spot.y],
  )
  // Couldn't measure (an error, an odd file): the plain cover fit, badge corner nudged away.
  const placed: React.CSSProperties = p && nat
    ? { left: p.L, top: p.T, width: nat.w * p.k, height: nat.h * p.k, transformOrigin: `${p.ox - p.L}px ${p.oy - p.T}px`, ['--z' as string]: frame.zoom, ...style }
    : broken ? { ...style } : { opacity: 0 }
  const cls = p ? `hm-placed ${motionClass || ''}` : broken ? `hm-fill hm-fallback ${motionClass || ''}` : 'hm-placed'
  if (kind === 'video') {
    return (
      <video className={cls} style={placed} src={src} poster={poster} autoPlay muted loop playsInline preload="auto" aria-label={alt}
        onLoadedMetadata={e => setNat({ w: e.currentTarget.videoWidth || 16, h: e.currentTarget.videoHeight || 9 })}
        onError={() => { setBroken(true); onError?.() }} />
    )
  }
  return (
    <img ref={img} src={src} alt={alt} fetchPriority={priority ? 'high' : undefined} className={cls} style={placed}
      onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
      onError={() => setBroken(true)} />
  )
}

function HeroCycle({ photos, motion, alt, box, frame }: { photos: string[]; motion: HeaderMotion; alt: string; box: { W: number; H: number } | null; frame: HeroFrame }) {
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const starts = useRef<Record<number, number>>({})
  const ms = 6500
  useEffect(() => {
    const t = window.setTimeout(() => {
      const n = (index + 1) % photos.length
      starts.current[n] = (starts.current[n] || 0) + 1
      setPrev(index)
      setIndex(n)
    }, ms)
    return () => window.clearTimeout(t)
  }, [index, photos.length])
  // Warm the next photo so the dissolve never shows a half-loaded frame.
  useEffect(() => { const img = new Image(); img.src = photos[(index + 1) % photos.length] }, [index, photos])
  return (
    <>
      {photos.map((src, i) => {
        const state = i === index ? 'is-on' : i === prev ? 'is-prev' : ''
        const dir = motion === 'both' ? (i % 2 ? 'in' : 'out') : motion
        // the main photo keeps the agent's framing; the rest are centered
        const fr = i === 0 ? frame : { ...DEFAULT_FRAME, zoom: frame.zoom }
        return (
          <Placed
            key={`${src}-${starts.current[i] || 0}`}
            kind="img" src={src} alt={i === index ? alt : ''} box={box} frame={fr}
            motionClass={`hm-slide ${state}`}
            style={state ? { animation: `hmReveal 1.9s cubic-bezier(.65,0,.35,1) both${dir !== 'none' ? `, ${dir === 'in' ? 'hmIn' : 'hmOut'} ${ms + 2000}ms linear both` : ''}` } : undefined}
          />
        )
      })}
    </>
  )
}

const HM_CSS = `
.hm{position:absolute;inset:0;overflow:hidden}
.hm-placed{position:absolute;max-width:none;max-height:none;display:block}
.hm-fill{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
/* only when a photo can't be measured: the old fit - zoomed a little toward the top-right so the
   badge in the bottom-left corner stays off screen */
.hm-fallback{object-position:60% 35%;scale:1.12;transform-origin:80% 12%}
.hm-fade{animation:hmFade 1.8s ease both}
.hm-photo-out{animation:hmFade 1.8s ease both,hmOut 18s cubic-bezier(.2,.6,.2,1) both}
.hm-photo-in{animation:hmFade 1.8s ease both,hmIn 22s cubic-bezier(.3,.1,.3,1) both}
.hm-photo-both{animation:hmFade 1.8s ease both,hmBoth 16s ease-in-out 1.8s infinite alternate both}
.hm-slide{opacity:0}
.hm-slide.is-on{opacity:1;z-index:2;-webkit-mask-image:linear-gradient(105deg,#000 42%,transparent 58%);mask-image:linear-gradient(105deg,#000 42%,transparent 58%);-webkit-mask-size:260% 100%;mask-size:260% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}
.hm-slide.is-prev{opacity:1;z-index:1}
@keyframes hmReveal{from{-webkit-mask-position:100% 0;mask-position:100% 0;filter:blur(8px) brightness(1.18)}60%{filter:blur(1px) brightness(1.05)}to{-webkit-mask-position:0 0;mask-position:0 0;filter:none}}
@keyframes hmFade{from{opacity:0;filter:brightness(.45)}to{opacity:1;filter:none}}
@keyframes hmOut{from{transform:scale(var(--z,1.12))}to{transform:scale(1)}}
@keyframes hmIn{from{transform:scale(1)}to{transform:scale(var(--z,1.12))}}
@keyframes hmBoth{from{transform:scale(1)}to{transform:scale(var(--z,1.12))}}
@media(prefers-reduced-motion:reduce){.hm-placed,.hm-fill{animation:none!important}}
`
