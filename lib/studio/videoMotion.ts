// Animated video designs for AI Media - one canvas renderer used for BOTH the live preview (a
// canvas laid over the <video>) and the export (each video frame + this drawn on top, recorded in
// the browser), so what the agent sees while editing is exactly what downloads.
//
// Every situation (Just Listed, Open House, ...) comes in two looks:
//   - default: modern - the situation's own accent color, bold sans, wipe reveals, a counting price
//   - luxe:    editorial - black, ivory & gold, serif, letterbox bars, drawn hairlines, a gold sheen
// Layers (all optional): intro title (first seconds), a corner tag (whole video), a closing agent
// card (last seconds) and the agent's branding badge.

import type { BrandingOptions, LayerTiming, LinkedProperty, TitleCardOptions, TitleCardPreset } from '@/types'
import { LUXE_METALS, metalOf } from '@/lib/luxeMetals'

export type MotionStyle = 'default' | 'luxe'

export type SituationDef = {
  id: TitleCardPreset
  label: string
  title: string
  kicker: string
  luxeKicker: string
  accent: string
  /** Asks for a date/time line (Open House) or a "was" price (Price Improved). */
  event?: 'when' | 'was'
  showPrice?: boolean
  blurb: string
}

export const SITUATIONS: SituationDef[] = [
  { id: 'just_listed', label: 'Just Listed', title: 'Just Listed', kicker: 'New to the market', luxeKicker: 'Introducing', accent: '#C9A24D', showPrice: true, blurb: 'Announce a brand-new listing' },
  { id: 'open_house', label: 'Open House', title: 'Open House', kicker: 'You’re invited', luxeKicker: 'The pleasure of your company', accent: '#E0745A', event: 'when', blurb: 'Day & time, front and center' },
  { id: 'coming_soon', label: 'Coming Soon', title: 'Coming Soon', kicker: 'Sneak peek', luxeKicker: 'Privately previewing', accent: '#5E96DB', blurb: 'Build buzz before it hits' },
  { id: 'price_improved', label: 'Price Improved', title: 'Price Improved', kicker: 'New price', luxeKicker: 'A refined offering', accent: '#E3A33A', event: 'was', showPrice: true, blurb: 'Old price crossed, new price counts in' },
  { id: 'under_contract', label: 'Under Contract', title: 'Under Contract', kicker: 'Offer accepted', luxeKicker: 'Under contract', accent: '#8B6CF0', blurb: 'Celebrate the accepted offer' },
  { id: 'just_sold', label: 'Just Sold', title: 'Just Sold', kicker: 'Another one home', luxeKicker: 'Successfully represented', accent: '#3FAE6B', blurb: 'Close the story in style' },
  { id: 'back_on_market', label: 'Back on Market', title: 'Back on Market', kicker: 'Second chance', luxeKicker: 'Available once more', accent: '#14A89A', blurb: 'Bring it back with energy' },
  { id: 'new_construction', label: 'New Construction', title: 'New Construction', kicker: 'Brand-new build', luxeKicker: 'Newly crafted', accent: '#2F9BD8', blurb: 'Fresh, crisp, modern' },
  { id: 'custom', label: 'Custom', title: 'Your Title', kicker: 'Featured property', luxeKicker: 'Featured residence', accent: '#C9A24D', blurb: 'Your words, any moment' },
]
export const situationOf = (id?: TitleCardPreset | string | null) => SITUATIONS.find(s => s.id === id) || SITUATIONS[0]

export const INTRO_SECONDS = 5.5
export const OUTRO_SECONDS = 4.2

// Luxe's metal - gold by default, or the agent's silver / bronze. Set by drawMotion for the frame
// being drawn (drawing is synchronous, so one frame never sees another's tone).
let GOLD = '#C9A24D'
let GOLD_LIGHT = '#F1D58B'
let GOLD_RGB = '201,162,77'
let GOLD_LIGHT_RGB = '241,213,139'
function setMetal(cfg: TitleCardOptions) {
  const m = metalOf(cfg.metal)
  if (m === 'gold') { GOLD = '#C9A24D'; GOLD_LIGHT = '#F1D58B'; GOLD_RGB = '201,162,77'; GOLD_LIGHT_RGB = '241,213,139'; return }
  const p = LUXE_METALS[m]
  GOLD = p.base; GOLD_LIGHT = p.light; GOLD_RGB = p.rgb; GOLD_LIGHT_RGB = p.lightRgb
}

/** Signature colors an agent can pick instead of the situation's own. */
export const SIGNATURE_COLORS: { color: string; label: string }[] = [
  { color: '#C9A24D', label: 'Gold' },
  { color: '#E0745A', label: 'Coral' },
  { color: '#E5484D', label: 'Red' },
  { color: '#EC4899', label: 'Pink' },
  { color: '#8B6CF0', label: 'Violet' },
  { color: '#5E96DB', label: 'Sky' },
  { color: '#2563EB', label: 'Blue' },
  { color: '#1E3A5F', label: 'Navy' },
  { color: '#14A89A', label: 'Teal' },
  { color: '#3FAE6B', label: 'Green' },
  { color: '#E3A33A', label: 'Amber' },
  { color: '#111827', label: 'Charcoal' },
]

// ---------------------------------------------------------------- timing

/** Where the clip changes are: the video is one equal-length clip per photo, joined end to end. */
export function clipCuts(duration: number, clipCount?: number | null): number[] {
  const n = Math.max(1, Math.round(clipCount || 1))
  return Array.from({ length: n - 1 }, (_, i) => (duration * (i + 1)) / n)
}

export type Exit = 'animate' | 'cut'
export type ResolvedTiming = {
  title: { start: number; end: number; exit: Exit }
  tag: { start: number; end: number; exit: Exit }
  brand: { start: number; end: number; exit: Exit }
  /** Closing card: from `start` to the end of the video (only when it's on and the video is long enough). */
  outro: { on: boolean; start: number }
}

export const MIN_LAYER_SECONDS = { title: 2.5, tag: 1, brand: 1, outro: 3 }

/** Each layer's start/end/exit - the agent's own timing where set, otherwise the defaults (the
 *  opening title lasts until the first clip change near 5.5s, the tag follows it, the branding
 *  stays on, the closing card takes the last ~4s). */
export function resolveTiming(cfg: TitleCardOptions, duration: number, clipCount?: number | null): ResolvedTiming {
  const D = Math.max(0.5, duration || 0)
  const cuts = clipCuts(D, clipCount)
  const tm = cfg.timing || {}
  const fix = (v: LayerTiming | undefined | null, start: number, end: number, exit: Exit, min: number) => {
    const s = clamp(v?.start ?? start, 0, Math.max(0, D - min))
    const e = v ? (v.end == null ? D : clamp(v.end, Math.min(D, s + min), D)) : clamp(end, Math.min(D, s + min), D)
    return { start: s, end: e, exit: (v?.exit ?? exit) as Exit }
  }
  const nearCut = cuts.find(c => c >= 4 && c <= 8)
  const title = fix(tm.title, 0, nearCut ?? Math.min(INTRO_SECONDS, D), 'animate', MIN_LAYER_SECONDS.title)
  const outroOn = !!cfg.end_card && D >= 8
  const outroStart = outroOn
    ? clamp(tm.outro?.start ?? Math.max(INTRO_SECONDS + 0.5, D - OUTRO_SECONDS), 0, D - MIN_LAYER_SECONDS.outro)
    : D
  const tag = fix(tm.tag, cfg.enabled ? Math.max(0, title.end - 0.6) : 0.2, D, outroOn ? 'animate' : 'cut', MIN_LAYER_SECONDS.tag)
  const brand = fix(tm.brand, 0, D, 'cut', MIN_LAYER_SECONDS.brand)
  // the closing card covers the frame - nothing else runs under it
  if (outroOn) for (const l of [tag, brand, title]) { if (l.end > outroStart) l.end = Math.max(l.start, outroStart) }
  return { title, tag, brand, outro: { on: outroOn, start: outroStart } }
}

const HOLD_AT = 4.2 // the moment in the opening's own clock when everything has landed
/** Maps real time to the opening title's own 0..INTRO_SECONDS clock: plays in, holds, and plays
 *  out right before `end` (or just stops there for a hard cut). */
function introClock(t: number, s: number, e: number, exit: Exit): number | null {
  if (t < s || t >= e) return null
  const local = t - s, d = e - s
  if (exit === 'cut') return Math.min(local, HOLD_AT)
  if (d <= INTRO_SECONDS) return (local * INTRO_SECONDS) / d
  if (local < HOLD_AT) return local
  const outLen = INTRO_SECONDS - HOLD_AT
  if (t < e - outLen) return HOLD_AT
  return INTRO_SECONDS - (e - t)
}
const IVORY = '#F6F0E2'
const INK = '#0B0B0C'
export const SANS = 'OHP Sans'
export const SERIF = 'OHP Serif'

// ---------------------------------------------------------------- fonts & images

let fontsReady: Promise<void> | null = null
/** Montserrat + Playfair Display from /public/fonts, under our own family names (so they never
 *  depend on what the page itself loaded). Safe to call often. */
export function loadMotionFonts(): Promise<void> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve()
  if (fontsReady) return fontsReady
  const faces: [string, string, string][] = [
    [SANS, '/fonts/montserrat-v31-latin-regular.ttf', '400'],
    [SANS, '/fonts/montserrat-v31-latin-700.woff', '700'],
    [SANS, '/fonts/montserrat-v31-latin-900.ttf', '900'],
    [SERIF, '/fonts/playfair-display-v40-latin-regular.ttf', '400'],
    [SERIF, '/fonts/playfair-display-v40-latin-700.woff', '700'],
    [SERIF, '/fonts/playfair-display-v40-latin-900.ttf', '900'],
  ]
  fontsReady = Promise.all(faces.map(async ([family, url, weight]) => {
    try {
      const f = new FontFace(family, `url(${url})`, { weight })
      await f.load()
      ;(document as any).fonts.add(f)
    } catch { /* falls back to the system font */ }
  })).then(() => undefined)
  return fontsReady
}

/** Same-origin image (through the app's image proxy) so drawing it never taints the export canvas. */
export function loadMotionImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url || typeof window === 'undefined') return Promise.resolve(null)
  const src = /^(data:|blob:)/.test(url) || url.startsWith('/') ? url : `/api/pdf-image?url=${encodeURIComponent(url)}`
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// ---------------------------------------------------------------- what gets drawn

export type MotionAgent = { name: string; brokerage: string; phone?: string; photo?: HTMLImageElement | null }

export type MotionScene = {
  title: TitleCardOptions
  branding: BrandingOptions
  listing: LinkedProperty | null
  agent: MotionAgent
  /** How many clips the video is made of - lines the default timing up with the clip changes. */
  clipCount?: number | null
}

function fields(cfg: TitleCardOptions, listing: LinkedProperty | null) {
  const manual = cfg.manual || {}
  const pick = (show: boolean, typed: string | undefined, fallback: string) => (show ? ((typed || '').trim() || fallback || '') : '')
  const address = pick(cfg.show_address, manual.address, listing?.address || '')
  const location = pick(cfg.show_location, manual.location, [listing?.city, listing?.state].filter(Boolean).join(', '))
  const beds = pick(cfg.show_beds, manual.beds, listing?.beds != null ? String(listing.beds) : '')
  const baths = pick(cfg.show_baths, manual.baths, listing?.baths != null ? String(listing.baths) : '')
  const sqft = pick(cfg.show_sqft, manual.sqft, listing?.sqft ? listing.sqft.toLocaleString() : '')
  const priceRaw = pick(cfg.show_price, manual.price, listing?.price ? Math.round(listing.price).toLocaleString() : '')
  const priceNum = Number(String(priceRaw).replace(/[^0-9.]/g, '')) || 0
  const price = priceRaw ? (priceRaw.startsWith('$') ? priceRaw : `$${priceRaw}`) : ''
  const stats: { v: string; l: string }[] = []
  if (beds) stats.push({ v: beds, l: Number(beds) === 1 ? 'Bed' : 'Beds' })
  if (baths) stats.push({ v: baths, l: Number(baths) === 1 ? 'Bath' : 'Baths' })
  if (sqft) stats.push({ v: sqft, l: 'Sq Ft' })
  return { address: titleCase(address), location, price, priceNum, stats }
}

const titleCase = (v: string) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, c) => a + c.toUpperCase()) : v)

// ---------------------------------------------------------------- easing

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const easeBack = (p: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) }
/** In over [a,b], out over [c,d] - 0..1. */
const life = (t: number, a: number, b: number, c: number, d: number) => (t < c ? easeOut(prog(t, a, b)) : 1 - easeInOut(prog(t, c, d)))

function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function font(ctx: CanvasRenderingContext2D, family: string, weight: number, px: number, spacing = 0) {
  ctx.font = `${weight} ${px}px "${family}", ${family === SERIF ? 'Georgia, serif' : 'Arial, sans-serif'}`
  if ('letterSpacing' in ctx) (ctx as any).letterSpacing = `${spacing}px`
}

/** Shrinks a line until it fits maxW. */
function fitText(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, px: number, maxW: number, spacing = 0) {
  let size = px
  font(ctx, family, weight, size, spacing * (size / px))
  while (size > 8 && ctx.measureText(text).width > maxW) {
    size *= 0.94
    font(ctx, family, weight, size, spacing * (size / px))
  }
  return size
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function circleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null | undefined, cx: number, cy: number, r: number, initials: string, ring: string, ringW: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.save()
  ctx.clip()
  if (img) {
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height)
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s)
  } else {
    ctx.fillStyle = ring
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    font(ctx, SANS, 900, r * 0.8)
    ctx.fillStyle = INK
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials, cx, cy + r * 0.04)
  }
  ctx.restore()
  ctx.lineWidth = ringW
  ctx.strokeStyle = ring
  ctx.stroke()
  ctx.restore()
}

const initialsOf = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '•'

// ---------------------------------------------------------------- the whole frame

/** Draws every enabled layer for time `t` (seconds) of a `duration`-second video onto a w×h canvas. */
export function drawMotion(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, duration: number, scene: MotionScene) {
  const style: MotionStyle = scene.title.style === 'luxe' ? 'luxe' : 'default'
  const base = situationOf(scene.title.preset)
  const sit: SituationDef = style === 'default' && scene.title.accent ? { ...base, accent: scene.title.accent } : base
  setMetal(scene.title)
  const tm = resolveTiming(scene.title, duration, scene.clipCount)
  // seconds until a layer goes; Infinity = it cuts away instantly (or, at the very end, just stays)
  const left = (l: { end: number; exit: Exit }) => (l.exit === 'cut' ? Infinity : l.end - t)
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  if (scene.title.enabled) {
    const lt = introClock(t, tm.title.start, tm.title.end, tm.title.exit)
    if (lt != null) {
      if (style === 'luxe') drawLuxeIntro(ctx, w, h, lt, scene, sit)
      else drawDefaultIntro(ctx, w, h, lt, scene, sit)
    }
  }
  if (scene.title.corner_tag && t >= tm.tag.start && t < tm.tag.end) drawCornerTag(ctx, w, h, t - tm.tag.start, left(tm.tag), style, sit, scene.title)
  if (scene.branding.enabled && t >= tm.brand.start && t < tm.brand.end) drawBranding(ctx, w, h, t - tm.brand.start, left(tm.brand), style, scene)
  if (tm.outro.on && t >= tm.outro.start) drawOutro(ctx, w, h, t - tm.outro.start, duration - tm.outro.start, style, sit, scene)
  ctx.restore()
}

// ---------------------------------------------------------------- default (modern) intro

function drawDefaultIntro(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scene: MotionScene, sit: SituationDef) {
  const cfg = scene.title
  const accent = sit.accent
  const f = fields(cfg, scene.listing)
  const u = Math.min(w, h) / 100 // one "unit"
  const pos = cfg.position || 'bottom'
  const out0 = INTRO_SECONDS - 0.75, out1 = INTRO_SECONDS
  const pad = w * 0.065

  // scrim
  const sA = life(t, 0, 0.45, out0 + 0.2, out1)
  const bandH = h * (pos === 'middle' ? 1 : 0.62)
  const g = pos === 'top' ? ctx.createLinearGradient(0, 0, 0, bandH) : pos === 'bottom' ? ctx.createLinearGradient(0, h, 0, h - bandH) : null
  ctx.globalAlpha = sA
  if (g) {
    g.addColorStop(0, 'rgba(5,7,12,0.9)')
    g.addColorStop(0.55, 'rgba(5,7,12,0.5)')
    g.addColorStop(1, 'rgba(5,7,12,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, pos === 'top' ? 0 : h - bandH, w, bandH)
  } else {
    ctx.fillStyle = 'rgba(5,7,12,0.42)'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.globalAlpha = 1

  // measure the block bottom-up
  const titleText = (cfg.title || sit.title).trim()
  const kicker = (cfg.kicker ?? sit.kicker).trim()
  const titlePx = fitText(ctx, titleText, SANS, 900, u * 13, w - pad * 2)
  const kickPx = u * 3.1
  const subPx = u * 3.6
  const pricePx = u * 7.2
  const chipPx = u * 3
  const sub = [f.address, f.location].filter(Boolean).join('  ·  ')
  const event = (cfg.event_line || '').trim()
  const lines: number[] = [kickPx * 2.2, titlePx * 1.02, u * 2.2]
  if (event) lines.push(subPx * 1.9)
  if (sub) lines.push(subPx * 1.6)
  if (f.price) lines.push(pricePx * 1.25)
  if (f.stats.length) lines.push(chipPx * 3.2)
  const blockH = lines.reduce((a, b) => a + b, 0)
  let y = pos === 'top' ? h * 0.09 : pos === 'middle' ? (h - blockH) / 2 : h - h * 0.08 - blockH
  const center = pos === 'middle'
  const x0 = center ? w / 2 : pad
  ctx.textAlign = center ? 'center' : 'left'

  // kicker in a sweeping accent block
  {
    const a = life(t, 0.1, 0.55, out0 + 0.15, out1 - 0.05)
    font(ctx, SANS, 900, kickPx, kickPx * 0.28)
    const kw = ctx.measureText(kicker.toUpperCase()).width + kickPx * 1.6
    const bw = kw * easeOut(prog(t, 0.05, 0.5))
    const bx = center ? w / 2 - kw / 2 : x0
    ctx.globalAlpha = a
    ctx.fillStyle = accent
    roundRect(ctx, bx, y, bw, kickPx * 1.85, kickPx * 0.35)
    ctx.fill()
    ctx.save()
    ctx.beginPath(); ctx.rect(bx, y, bw, kickPx * 1.85); ctx.clip()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.fillText(kicker.toUpperCase(), bx + kickPx * 0.8, y + kickPx * 1.3)
    ctx.restore()
    ctx.textAlign = center ? 'center' : 'left'
    y += kickPx * 2.2
  }

  // title - wipe reveal + rise
  {
    const p = easeOut(prog(t, 0.3, 0.95))
    const o = 1 - easeInOut(prog(t, out0, out1 - 0.1))
    font(ctx, SANS, 900, titlePx, -titlePx * 0.01)
    const tw = ctx.measureText(titleText).width
    const left = center ? w / 2 - tw / 2 : x0
    ctx.save()
    ctx.beginPath()
    ctx.rect(left - 4, y - titlePx * 0.05, (tw + 8) * p, titlePx * 1.15)
    ctx.clip()
    ctx.globalAlpha = o
    ctx.fillStyle = '#fff'
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = u * 2
    ctx.fillText(titleText, x0, y + titlePx * 0.86 + (1 - p) * u * 3)
    ctx.restore()
    y += titlePx * 1.02
    // accent rule grows
    const rp = easeOut(prog(t, 0.7, 1.2)) * o
    ctx.fillStyle = accent
    const rw = Math.min(tw, w * 0.22) * rp
    roundRect(ctx, center ? w / 2 - rw / 2 : x0, y + u * 0.3, rw, u * 0.7, u * 0.35)
    ctx.fill()
    y += u * 2.2
  }

  const fadeLine = (start: number, draw: (alpha: number, dy: number) => void) => {
    const a = life(t, start, start + 0.45, out0 - 0.1 + (start - 0.9) * 0.2, out1 - 0.25)
    draw(a, (1 - a) * u * 2.5)
  }

  if (event) {
    fadeLine(0.95, (a, dy) => {
      ctx.globalAlpha = a
      font(ctx, SANS, 900, subPx * 1.15, subPx * 0.05)
      ctx.fillStyle = sit.event === 'was' ? 'rgba(255,255,255,0.7)' : accent
      const txt = sit.event === 'was' ? `Was ${event.startsWith('$') ? event : `$${event}`}` : event
      ctx.fillText(txt, x0, y + subPx * 1.2 + dy)
      if (sit.event === 'was') { // strike-through draws across
        const tw = ctx.measureText(txt).width
        const sp = easeOut(prog(t, 1.25, 1.7))
        ctx.fillStyle = accent
        const sx = center ? w / 2 - tw / 2 : x0
        ctx.fillRect(sx, y + subPx * 0.8 + dy, tw * sp, Math.max(2, u * 0.45))
      }
    })
    y += subPx * 1.9
  }
  if (sub) {
    fadeLine(1.05, (a, dy) => {
      ctx.globalAlpha = a
      font(ctx, SANS, 700, subPx)
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.fillText(sub, x0, y + subPx * 1.1 + dy, w - pad * 2)
    })
    y += subPx * 1.6
  }
  if (f.price) {
    fadeLine(1.2, (a, dy) => {
      ctx.globalAlpha = a
      const cp = easeOut(prog(t, 1.2, 2.2))
      const shown = f.priceNum ? `$${Math.round(f.priceNum * cp).toLocaleString()}` : f.price
      font(ctx, SANS, 900, pricePx, -pricePx * 0.01)
      ctx.fillStyle = accent === GOLD ? GOLD_LIGHT : '#fff'
      ctx.shadowColor = hexA(accent, 0.6)
      ctx.shadowBlur = u * 3
      ctx.fillText(shown, x0, y + pricePx * 0.95 + dy)
      ctx.shadowBlur = 0
    })
    y += pricePx * 1.25
  }
  if (f.stats.length) {
    font(ctx, SANS, 900, chipPx, chipPx * 0.08)
    const widths = f.stats.map(s => ctx.measureText(`${s.v} ${s.l.toUpperCase()}`).width + chipPx * 2.2)
    const gap = chipPx * 0.7
    const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1)
    let cx = center ? w / 2 - total / 2 : x0
    f.stats.forEach((s, i) => {
      const st = 1.45 + i * 0.14
      const a = life(t, st, st + 0.35, out0 - 0.15 - i * 0.05, out1 - 0.35)
      const sc = 0.6 + 0.4 * easeBack(prog(t, st, st + 0.4))
      const cw = widths[i], ch = chipPx * 2.3
      ctx.save()
      ctx.globalAlpha = a
      ctx.translate(cx + cw / 2, y + ch / 2)
      ctx.scale(sc, sc)
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      roundRect(ctx, -cw / 2, -ch / 2, cw, ch, ch / 2)
      ctx.fill()
      ctx.lineWidth = Math.max(1.5, u * 0.35)
      ctx.strokeStyle = accent
      ctx.stroke()
      ctx.textAlign = 'center'
      font(ctx, SANS, 900, chipPx, chipPx * 0.08)
      ctx.fillStyle = '#fff'
      ctx.fillText(`${s.v} ${s.l.toUpperCase()}`, 0, chipPx * 0.36)
      ctx.restore()
      cx += cw + gap
    })
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------- luxe intro

function drawLuxeIntro(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scene: MotionScene, sit: SituationDef) {
  const cfg = scene.title
  const f = fields(cfg, scene.listing)
  const u = Math.min(w, h) / 100
  const pos = cfg.position || 'middle'
  const out0 = INTRO_SECONDS - 0.9, out1 = INTRO_SECONDS

  // cinematic letterbox + vignette
  const bars = life(t, 0, 0.7, out0 + 0.2, out1)
  const barH = h * 0.085 * bars
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, barH)
  ctx.fillRect(0, h - barH, w, barH)
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, `rgba(0,0,0,${0.62 * bars})`)
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)
  const veil = pos === 'middle' ? 0.38 : 0.2
  ctx.fillStyle = `rgba(6,5,3,${veil * bars})`
  ctx.fillRect(0, 0, w, h)

  const titleText = (cfg.title || sit.title).trim()
  const kicker = (cfg.kicker ?? sit.luxeKicker).trim()
  const kickPx = u * 2.6
  const titlePx = fitText(ctx, titleText, SERIF, 400, u * 14, w * 0.84)
  const subPx = u * 2.7
  const pricePx = u * 6
  const statPx = u * 2.5
  const sub = [f.address, f.location].filter(Boolean).join('   |   ')
  const event = (cfg.event_line || '').trim()
  const blockH = kickPx * 3 + titlePx * 1.15 + u * 5 + (event ? subPx * 2.2 : 0) + (sub ? subPx * 2.2 : 0) + (f.price ? pricePx * 1.4 : 0) + (f.stats.length ? statPx * 2.4 : 0)
  let y = pos === 'top' ? h * 0.14 : pos === 'bottom' ? h - h * 0.12 - blockH : (h - blockH) / 2
  const cx = w / 2
  ctx.textAlign = 'center'

  // kicker - tracking tightens as it fades in
  {
    const a = life(t, 0.35, 1.1, out0, out1 - 0.2)
    const spread = 1 - easeOut(prog(t, 0.35, 1.4))
    font(ctx, SANS, 700, kickPx, kickPx * (0.55 + spread * 0.9))
    ctx.globalAlpha = a
    ctx.fillStyle = GOLD_LIGHT
    ctx.fillText(kicker.toUpperCase(), cx, y + kickPx)
    y += kickPx * 3
  }

  // title with a gold sheen sweeping across
  {
    const a = life(t, 0.55, 1.5, out0 + 0.05, out1 - 0.1)
    font(ctx, SERIF, 400, titlePx, titlePx * 0.01)
    const tw = ctx.measureText(titleText).width
    ctx.globalAlpha = a
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = u * 2.5
    ctx.fillStyle = IVORY
    ctx.fillText(titleText, cx, y + titlePx * 0.85 + (1 - a) * u * 2)
    ctx.shadowBlur = 0
    const sweep = prog(t, 1.4, 3)
    if (sweep > 0 && sweep < 1) {
      const sx = cx - tw / 2 - tw * 0.3 + (tw * 1.6) * sweep
      const sg = ctx.createLinearGradient(sx - tw * 0.18, 0, sx + tw * 0.18, 0)
      sg.addColorStop(0, `rgba(${GOLD_LIGHT_RGB},0)`)
      sg.addColorStop(0.5, `rgba(${GOLD_LIGHT_RGB},0.95)`)
      sg.addColorStop(1, `rgba(${GOLD_LIGHT_RGB},0)`)
      ctx.save()
      ctx.globalCompositeOperation = 'source-atop'
      ctx.restore()
      ctx.save()
      ctx.fillStyle = sg
      ctx.globalAlpha = a * 0.85
      ctx.fillText(titleText, cx, y + titlePx * 0.85)
      ctx.restore()
    }
    y += titlePx * 1.15
  }

  // hairlines drawing out from a diamond
  {
    const p = easeInOut(prog(t, 0.9, 1.9)) * (1 - easeInOut(prog(t, out0, out1 - 0.15)))
    const half = Math.min(w * 0.22, u * 30) * p
    const ly = y + u * 1.8
    ctx.globalAlpha = 1
    ctx.strokeStyle = GOLD
    ctx.lineWidth = Math.max(1, u * 0.18)
    ctx.beginPath()
    ctx.moveTo(cx - u * 1.6, ly); ctx.lineTo(cx - u * 1.6 - half, ly)
    ctx.moveTo(cx + u * 1.6, ly); ctx.lineTo(cx + u * 1.6 + half, ly)
    ctx.stroke()
    const d = u * 0.85 * clamp(p * 1.5)
    ctx.fillStyle = GOLD
    ctx.beginPath()
    ctx.moveTo(cx, ly - d); ctx.lineTo(cx + d, ly); ctx.lineTo(cx, ly + d); ctx.lineTo(cx - d, ly)
    ctx.closePath(); ctx.fill()
    y += u * 5
  }

  const line = (start: number, draw: (a: number) => void, adv: number) => {
    const a = life(t, start, start + 0.7, out0 - 0.1, out1 - 0.3)
    ctx.globalAlpha = a
    draw(a)
    y += adv
  }
  if (event) line(1.5, () => {
    font(ctx, SERIF, 400, subPx * 1.25)
    const txt = sit.event === 'was' ? `Previously ${event.startsWith('$') ? event : `$${event}`}` : event
    ctx.fillStyle = sit.event === 'was' ? 'rgba(246,240,226,0.6)' : GOLD_LIGHT
    ctx.fillText(txt, cx, y + subPx * 1.2)
    if (sit.event === 'was') {
      const tw = ctx.measureText(txt).width
      ctx.fillStyle = GOLD
      ctx.fillRect(cx - tw / 2, y + subPx * 0.82, tw * easeOut(prog(t, 1.8, 2.4)), Math.max(1, u * 0.18))
    }
  }, subPx * 2.2)
  if (sub) line(1.7, () => {
    font(ctx, SANS, 700, subPx, subPx * 0.32)
    ctx.fillStyle = 'rgba(246,240,226,0.9)'
    ctx.fillText(sub.toUpperCase(), cx, y + subPx * 1.1, w * 0.9)
  }, subPx * 2.2)
  if (f.price) line(1.95, () => {
    font(ctx, SERIF, 400, pricePx, pricePx * 0.02)
    ctx.fillStyle = GOLD_LIGHT
    ctx.shadowColor = `rgba(${GOLD_RGB},0.45)`
    ctx.shadowBlur = u * 3
    ctx.fillText(f.price, cx, y + pricePx * 0.95)
    ctx.shadowBlur = 0
  }, pricePx * 1.4)
  if (f.stats.length) line(2.2, () => {
    font(ctx, SANS, 700, statPx, statPx * 0.35)
    ctx.fillStyle = 'rgba(246,240,226,0.85)'
    ctx.fillText(f.stats.map(s => `${s.v} ${s.l}`.toUpperCase()).join('   ·   '), cx, y + statPx * 1.2, w * 0.92)
  }, statPx * 2.4)

  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------- corner tag (whole video)

function drawCornerTag(ctx: CanvasRenderingContext2D, w: number, h: number, since: number, left: number, style: MotionStyle, sit: SituationDef, cfg: TitleCardOptions) {
  const u = Math.min(w, h) / 100
  const label = ((cfg.title || sit.title) || '').trim().toUpperCase()
  const a = easeOut(clamp(since / 0.6)) * clamp(left / 0.5)
  const m = u * 4
  if (style === 'luxe') {
    font(ctx, SERIF, 400, u * 2.9, u * 0.55)
    const tw = ctx.measureText(label).width
    const bw = tw + u * 5, bh = u * 6.2
    const x = w - m - bw, y = m + (1 - a) * -u * 2
    ctx.globalAlpha = a
    ctx.fillStyle = 'rgba(8,7,5,0.62)'
    ctx.fillRect(x, y, bw, bh)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = Math.max(1, u * 0.16)
    ctx.strokeRect(x + u * 0.6, y + u * 0.6, bw - u * 1.2, bh - u * 1.2)
    ctx.fillStyle = GOLD_LIGHT
    ctx.textAlign = 'center'
    ctx.fillText(label, x + bw / 2, y + bh * 0.64)
    // a slow sheen every few seconds
    const cyc = (since % 4.5) / 1.2
    if (cyc < 1) {
      const sx = x + bw * cyc
      const g = ctx.createLinearGradient(sx - u * 4, 0, sx + u * 4, 0)
      g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,0.28)'); g.addColorStop(1, 'rgba(255,240,200,0)')
      ctx.fillStyle = g
      ctx.fillRect(x, y, bw, bh)
    }
  } else {
    font(ctx, SANS, 900, u * 2.7, u * 0.35)
    const tw = ctx.measureText(label).width
    const bh = u * 6, bw = tw + u * 7.5
    const x = w - m - bw * a, y = m
    ctx.globalAlpha = a
    ctx.fillStyle = sit.accent
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = u * 2
    roundRect(ctx, x, y, bw, bh, bh / 2)
    ctx.fill()
    ctx.shadowBlur = 0
    const pulse = 0.55 + 0.45 * Math.sin(since * 4)
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * pulse})`
    ctx.beginPath(); ctx.arc(x + u * 2.6, y + bh / 2, u * 0.8, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.fillText(label, x + u * 4.3, y + bh * 0.66)
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------- branding badge (whole video)

function drawBranding(ctx: CanvasRenderingContext2D, w: number, h: number, since: number, left: number, style: MotionStyle, scene: MotionScene) {
  const u = Math.min(w, h) / 100
  const { agent } = scene
  if (!agent.name) return
  const a = easeOut(clamp(since / 0.8)) * clamp(left / 0.5)
  const pos = scene.branding.position || 'top-left'
  const r = u * 3.6
  const nameFam = style === 'luxe' ? SERIF : SANS
  font(ctx, nameFam, style === 'luxe' ? 700 : 900, u * 2.9)
  const nw = ctx.measureText(agent.name).width
  font(ctx, SANS, 700, u * 1.9, u * 0.2)
  const bw2 = agent.brokerage ? ctx.measureText(agent.brokerage.toUpperCase()).width : 0
  const pw = r * 2 + u * 3 + Math.max(nw, bw2) + u * 3
  const ph = r * 2 + u * 1.4
  const m = u * 4
  const x = pos === 'top-middle' ? (w - pw) / 2 : m
  const y = pos === 'bottom-left' ? h - m - ph : m
  ctx.globalAlpha = a
  ctx.fillStyle = style === 'luxe' ? 'rgba(8,7,5,0.6)' : 'rgba(8,10,16,0.62)'
  roundRect(ctx, x, y, pw, ph, ph / 2)
  ctx.fill()
  if (style === 'luxe') { ctx.strokeStyle = hexA(GOLD, 0.8); ctx.lineWidth = Math.max(1, u * 0.15); ctx.stroke() }
  circleImage(ctx, agent.photo, x + u * 0.7 + r, y + ph / 2, r, initialsOf(agent.name), GOLD, Math.max(1.5, u * 0.3))
  const tx = x + u * 0.7 + r * 2 + u * 1.6
  font(ctx, nameFam, style === 'luxe' ? 700 : 900, u * 2.9)
  ctx.fillStyle = style === 'luxe' ? IVORY : '#fff'
  ctx.textAlign = 'left'
  ctx.fillText(agent.name, tx, y + ph / 2 + (agent.brokerage ? -u * 0.1 : u * 1))
  if (agent.brokerage) {
    font(ctx, SANS, 700, u * 1.9, u * 0.2)
    ctx.fillStyle = style === 'luxe' ? GOLD_LIGHT : 'rgba(255,255,255,0.72)'
    ctx.fillText(agent.brokerage.toUpperCase(), tx, y + ph / 2 + u * 2.4)
  }
  ctx.globalAlpha = 1
}

// ---------------------------------------------------------------- closing agent card

function drawOutro(ctx: CanvasRenderingContext2D, w: number, h: number, since: number, total: number, style: MotionStyle, sit: SituationDef, scene: MotionScene) {
  const u = Math.min(w, h) / 100
  const { agent } = scene
  const cta = (scene.title.end_cta || (sit.id === 'just_sold' ? 'Thinking of selling? Let’s talk.' : sit.id === 'open_house' ? 'See you there' : 'Schedule your private tour')).trim()
  const a = easeOut(clamp(since / 0.7))
  const cx = w / 2
  ctx.textAlign = 'center'
  if (style === 'luxe') {
    ctx.fillStyle = `rgba(5,4,2,${0.82 * a})`
    ctx.fillRect(0, 0, w, h)
    // a gold frame drawing itself around the card
    const fp = easeInOut(clamp((since - 0.2) / 1.2))
    const fx = w * 0.08, fy = h * 0.1, fw = w * 0.84, fh = h * 0.8
    ctx.strokeStyle = GOLD
    ctx.lineWidth = Math.max(1, u * 0.18)
    const per = 2 * (fw + fh)
    ctx.setLineDash([per * fp, per])
    ctx.strokeRect(fx, fy, fw, fh)
    ctx.setLineDash([])
    const r = u * 9
    const py = h * 0.36
    ctx.globalAlpha = easeOut(clamp((since - 0.35) / 0.7))
    circleImage(ctx, agent.photo, cx, py, r, initialsOf(agent.name), GOLD, Math.max(2, u * 0.35))
    font(ctx, SANS, 700, u * 2.1, u * 0.7)
    ctx.fillStyle = GOLD_LIGHT
    ctx.fillText('PRESENTED BY', cx, py + r + u * 5)
    ctx.globalAlpha = easeOut(clamp((since - 0.55) / 0.7))
    fitText(ctx, agent.name || 'Your Agent', SERIF, 400, u * 7, w * 0.75)
    ctx.fillStyle = IVORY
    ctx.fillText(agent.name || 'Your Agent', cx, py + r + u * 12)
    font(ctx, SANS, 700, u * 2.2, u * 0.5)
    ctx.fillStyle = 'rgba(246,240,226,0.75)'
    if (agent.brokerage) ctx.fillText(agent.brokerage.toUpperCase(), cx, py + r + u * 16.5, w * 0.8)
    ctx.globalAlpha = easeOut(clamp((since - 0.8) / 0.7))
    ctx.fillStyle = GOLD
    ctx.fillRect(cx - u * 6, py + r + u * 19.5, u * 12, Math.max(1, u * 0.18))
    font(ctx, SERIF, 400, u * 3.4)
    ctx.fillStyle = IVORY
    ctx.fillText(cta, cx, py + r + u * 25, w * 0.8)
    if (agent.phone) { font(ctx, SANS, 700, u * 2.6, u * 0.3); ctx.fillStyle = GOLD_LIGHT; ctx.fillText(agent.phone, cx, py + r + u * 30) }
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, `rgba(8,10,16,${0.55 * a})`)
    g.addColorStop(1, `rgba(8,10,16,${0.9 * a})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const r = u * 9.5
    const py = h * 0.36
    const sc = 0.5 + 0.5 * easeBack(clamp((since - 0.15) / 0.55))
    ctx.save()
    ctx.globalAlpha = clamp((since - 0.15) / 0.3)
    ctx.translate(cx, py); ctx.scale(sc, sc)
    circleImage(ctx, agent.photo, 0, 0, r, initialsOf(agent.name), sit.accent, Math.max(3, u * 0.7))
    ctx.restore()
    ctx.globalAlpha = easeOut(clamp((since - 0.4) / 0.5))
    fitText(ctx, agent.name || 'Your Agent', SANS, 900, u * 6.5, w * 0.8)
    ctx.fillStyle = '#fff'
    ctx.fillText(agent.name || 'Your Agent', cx, py + r + u * 9 + (1 - ctx.globalAlpha) * u * 2)
    font(ctx, SANS, 700, u * 2.4, u * 0.3)
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    if (agent.brokerage) ctx.fillText(agent.brokerage.toUpperCase(), cx, py + r + u * 13.5, w * 0.85)
    const pa = easeOut(clamp((since - 0.7) / 0.5))
    ctx.globalAlpha = pa
    font(ctx, SANS, 900, u * 3, u * 0.12)
    const cw = ctx.measureText(cta).width + u * 7
    const ch = u * 7
    ctx.fillStyle = sit.accent
    roundRect(ctx, cx - (cw * (0.85 + 0.15 * pa)) / 2, py + r + u * 17, cw * (0.85 + 0.15 * pa), ch, ch / 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.fillText(cta, cx, py + r + u * 17 + ch * 0.64)
    if (agent.phone) { font(ctx, SANS, 900, u * 3, u * 0.1); ctx.fillStyle = '#fff'; ctx.fillText(agent.phone, cx, py + r + u * 30) }
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}
