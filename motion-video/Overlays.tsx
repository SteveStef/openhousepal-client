// Everything drawn over the moving photos: opening title, room captions, stats, the closing card
// and the agent badge - in two looks:
//   classic (the default): ivory type, Cormorant serif + Montserrat, the agent's accent colour
//   luxe: black, ivory & metal (gold / silver / bronze) - centred, framed, metal sheen
// Only opacity / transform animations (no blur filters) so phones preview it smoothly.
import React, { useEffect, useState } from 'react'
import { AbsoluteFill, Easing, Img, continueRender, delayRender, interpolate, staticFile } from 'remotion'
import { LUXE_METALS } from '../lib/luxeMetals'
import { situationPreset } from './presets'
import { isBuiltIn, type MotionProps } from './types'

export const resolveSrc = (s: string) => (isBuiltIn(s) ? staticFile(s.slice(1)) : s)

export const SERIF = 'OHP Motion Serif'
export const SANS = 'OHP Motion Sans'
const IVORY = '#f6f1e7'

let fontsPromise: Promise<void> | null = null
function loadFonts(): Promise<void> {
  if (typeof window === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve()
  if (fontsPromise) return fontsPromise
  const faces: [string, string, FontFaceDescriptors][] = [
    [SERIF, 'fonts/cormorant-garamond-normal-300-700.woff2', { weight: '300 700', style: 'normal' }],
    [SERIF, 'fonts/cormorant-garamond-italic-300-700.woff2', { weight: '300 700', style: 'italic' }],
    [SANS, 'fonts/montserrat-v31-latin-regular.ttf', { weight: '400' }],
    [SANS, 'fonts/montserrat-v31-latin-700.woff', { weight: '600 700' }],
  ]
  fontsPromise = Promise.all(faces.map(async ([family, path, desc]) => {
    try {
      const f = new FontFace(family, `url(${staticFile(path)})`, desc)
      await f.load()
      ;(document as unknown as { fonts: FontFaceSet }).fonts.add(f)
    } catch { /* system serif / sans fallback */ }
  })).then(() => undefined)
  return fontsPromise
}

export function useMotionFonts() {
  const [handle] = useState(() => delayRender('fonts'))
  useEffect(() => { loadFonts().then(() => continueRender(handle)) }, [handle])
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOut = Easing.bezier(0.2, 0.7, 0.2, 1)
const smooth = Easing.bezier(0.45, 0, 0.55, 1)
const ruleEase = Easing.bezier(0.3, 0, 0.1, 1)
const serif = `"${SERIF}", Georgia, serif`
const sans = `"${SANS}", Arial, sans-serif`

export type Look = {
  luxe: boolean
  accent: string
  /** Metal palette (luxe) - also used for small accents. */
  m: { base: string; light: string; deep: string; pale: string }
  u: number        // size unit (1 at 1080)
  W: number; H: number
  tall: boolean    // portrait / vertical
  bar: number      // letterbox bar height (landscape only)
}

/** The accent colour as WORDS on a dark background: a dark accent (navy, burgundy) is mixed toward
 *  ivory until it reads (QA 11/12: a navy "OFFER ACCEPTED" vanished on the closing card). */
export function readableOnDark(hex: string): string {
  const h = (hex || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(h)) return hex
  const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  const ivory = [246, 241, 231]
  const lum = (v: number[]) => { const l = v.map(x => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] }
  for (let k = 0; k <= 1.0001; k += 0.1) {
    const mix = c.map((x, i) => Math.round(x + (ivory[i] - x) * k))
    if (lum(mix) >= 0.28) return `rgb(${mix.join(',')})`
  }
  return `rgb(${ivory.join(',')})`
}

export function lookOf(props: MotionProps, W: number, H: number): Look {
  const m = LUXE_METALS[props.metal || 'gold'] || LUXE_METALS.gold
  // Owner 11/12: wide videos showed too little of each photo - no letterbox bars (they hid 11% of it).
  const bar = 0
  return { luxe: props.theme === 'luxe', accent: props.accent || '#C9A24D', m, u: Math.min(W, H) / 1080, W, H, tall: H > W * 1.05, bar }
}

/** Metal text with a slow sheen moving across it. */
function metalText(look: Look, t: number): React.CSSProperties {
  const { m } = look
  return {
    backgroundImage: `linear-gradient(100deg, ${m.base} 0%, ${m.light} 28%, ${m.pale} 46%, ${m.light} 62%, ${m.base} 100%)`,
    backgroundSize: '260% 100%',
    backgroundPosition: `${(100 - ((t * 9) % 100)).toFixed(2)}% 50%`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  }
}

/** Letter-by-letter rise. */
const Reveal: React.FC<{ text: string; t: number; at: number; step?: number; dur?: number; style: React.CSSProperties; sheen?: React.CSSProperties }> = ({ text, t, at, step = 0.045, dur = 0.9, style, sheen }) => (
  // Words stay whole and wrap onto a new line when a caption is long (tall formats).
  <div style={{ ...style, whiteSpace: 'normal', overflowWrap: 'normal' }}>
    {(() => {
      let i = 0
      return text.split(/(\s+)/).map((word, w) => {
        if (/^\s+$/.test(word)) { i += word.length; return <span key={w}>{' '}</span> }
        return (
          <span key={w} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
            {word.split('').map((ch) => {
              const e = easeOut(clamp01((t - at - i++ * step) / dur))
              return <span key={i} style={{ display: 'inline-block', opacity: e, transform: `translateY(${(1 - e) * 0.32}em)`, ...sheen }}>{ch}</span>
            })}
          </span>
        )
      })
    })()}
  </div>
)

const fadeOut = (t: number, end: number, len = 0.7) =>
  interpolate(t, [end - len, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: smooth })

// ------------------------------------------------------------------ opening title

export const OpeningTitle: React.FC<{ props: MotionProps; look: Look; t: number; end: number }> = ({ props, look, t, end }) => {
  if (t > end) return null
  const { u, luxe, accent } = look
  const sit = situationPreset(props.situation)
  const kickerBase = (props.copy.kicker || (props.situation === 'custom' && props.copy.title) || (luxe ? sit.luxeKicker : sit.kicker)).trim()
  const city = props.facts.cityLine
  const out = fadeOut(t, end, 0.9)
  const rule = ruleEase(clamp01((t - 2.3) / 1.2))
  const sub = clamp01((t - 2.9) / 1.0)
  const addr = props.facts.address || 'Your listing'
  // Fit the width (QA 11/12: "4205 Michener Rd" left "Rd" alone on a second line in Square). Shrinks
  // to one line down to ~62% of the normal size; longer addresses wrap in two balanced lines.
  const base = (look.tall ? 104 : 132) * u * Math.min(1, 16 / Math.max(10, addr.length))
  const availW = look.W - 2 * (luxe ? 80 : 70) * u
  const big = Math.max(base * 0.62, Math.min(base, availW / (addr.length * (luxe ? 0.74 / 0.78 : 0.5))))
  if (luxe) {
    const frame = ruleEase(clamp01((t - 0.3) / 1.6))
    const inset = 46 * u
    return (
      <AbsoluteFill style={{ opacity: out, alignItems: 'center', justifyContent: 'center' }}>
        <svg width={look.W} height={look.H} style={{ position: 'absolute', inset: 0 }}>
          {[0, 9 * u].map((k, i) => {
            const w = look.W - 2 * (inset + k), h = look.H - 2 * (inset + k + look.bar), per = 2 * (w + h)
            return <rect key={i} x={inset + k} y={inset + k + look.bar} width={w} height={h} fill="none" stroke={look.m.base} strokeOpacity={i ? 0.35 : 0.75} strokeWidth={1.2 * u}
              strokeDasharray={per} strokeDashoffset={per * (1 - frame)} />
          })}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `0 ${80 * u}px`, textAlign: 'center' }}>
          <Reveal text={kickerBase.toUpperCase()} t={t} at={0.6} step={0.03} style={{ fontFamily: sans, fontWeight: 600, fontSize: 18 * u, letterSpacing: '0.52em', marginBottom: 30 * u }} sheen={metalText(look, t)} />
          <Reveal text={addr.toUpperCase()} t={t} at={1.1} step={0.05} dur={1.1} style={{ fontFamily: serif, fontWeight: 400, fontSize: big * 0.78, letterSpacing: '0.08em', color: IVORY, lineHeight: 1.05, textWrap: 'balance' } as React.CSSProperties} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 * u, margin: `${28 * u}px 0 ${22 * u}px` }}>
            <div style={{ width: 120 * u * rule, height: 1, background: look.m.base }} />
            <div style={{ width: 7 * u, height: 7 * u, transform: 'rotate(45deg)', background: look.m.light, opacity: rule }} />
            <div style={{ width: 120 * u * rule, height: 1, background: look.m.base }} />
          </div>
          {city && <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 15 * u, letterSpacing: '0.42em', color: IVORY, opacity: 0.8 * sub }}>{city.toUpperCase()}</div>}
          {props.copy.tagline && <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34 * u, color: IVORY, opacity: sub * 0.92, marginTop: 18 * u, transform: `translateY(${(1 - sub) * 10 * u}px)` }}>{props.copy.tagline}</div>}
        </div>
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ opacity: out, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: `0 ${70 * u}px`, transform: `translateY(${-(t * 4 * u)}px)` }}>
        <Reveal text={[kickerBase, city].filter(Boolean).join('  ·  ').toUpperCase()} t={t} at={0.7} step={0.025} style={{ fontFamily: sans, fontWeight: 600, fontSize: 19 * u, letterSpacing: '0.4em', color: IVORY, opacity: 0.9, marginBottom: 26 * u }} />
        <Reveal text={addr} t={t} at={1.15} step={0.06} dur={1.1} style={{ fontFamily: serif, fontWeight: 300, fontSize: big, color: IVORY, letterSpacing: '0.01em', lineHeight: 1, textShadow: '0 2px 30px rgba(0,0,0,0.35)', textWrap: 'balance' } as React.CSSProperties} />
        <div style={{ width: 220 * u * rule, height: 2 * u, background: accent, marginTop: 30 * u, marginBottom: 24 * u, opacity: 0.95 }} />
        {props.copy.tagline && <div style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, fontSize: 36 * u, color: IVORY, opacity: sub * 0.92, transform: `translateY(${(1 - sub) * 10 * u}px)` }}>{props.copy.tagline}</div>}
      </div>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ shading behind words
// Drawn as part of the photo (MotionFilm's Shot), so it arrives and leaves with the photo itself and
// is already in place before any words appear - never a dimming that "kicks in" mid-shot.
export type ScrimKind = 'opening' | 'caption' | 'stats'
// Strong enough that ivory words stay readable over a white kitchen or bathroom; tall formats put
// the words higher up, so their shading reaches higher too.
export const ShotScrim: React.FC<{ kind: ScrimKind; luxe: boolean; tall?: boolean }> = ({ kind, luxe, tall }) => {
  const c = luxe ? '4,4,4' : '8,6,4'
  const g = (stops: [number, number][]) => `linear-gradient(to top, ${stops.map(([a, at]) => `rgba(${c},${a}) ${at}%`).join(', ')})`
  const bg = kind === 'opening'
    ? (luxe ? `radial-gradient(ellipse ${tall ? '90% 34%' : '66% 50%'} at 50% 50%, rgba(5,5,5,0.72), rgba(5,5,5,0.3) 55%, rgba(5,5,5,0) 80%)`
            : `radial-gradient(ellipse ${tall ? '90% 32%' : '64% 48%'} at 50% 50%, rgba(10,8,6,0.66), rgba(10,8,6,0.26) 55%, rgba(10,8,6,0) 80%)`)
    : kind === 'stats'
      ? (tall ? g([[0.86, 0], [0.74, 28], [0.38, 50], [0, 68]]) : g([[0.84, 0], [0.6, 30], [0.2, 52], [0, 64]]))
      : (tall ? g([[0.8, 0], [0.62, 18], [0.3, 34], [0, 50]]) : g([[0.76, 0], [0.5, 20], [0.16, 36], [0, 48]]))
  return <AbsoluteFill style={{ background: bg }} />
}

// ------------------------------------------------------------------ room captions

export const Caption: React.FC<{ look: Look; t: number; start: number; end: number; kicker?: string; line: string }> = ({ look, t, start, end, kicker, line }) => {
  if (t < start || t > end) return null
  const { u, luxe, accent, tall } = look
  const out = fadeOut(t, end, 0.6)
  const rule = ruleEase(clamp01((t - start) / 0.9))
  const bottom = tall ? look.H * 0.16 : 96 * u
  if (luxe) {
    return (
      <AbsoluteFill style={{ opacity: out }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: `0 ${60 * u}px` }}>
          {kicker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 * u, marginBottom: 12 * u }}>
              <div style={{ width: 46 * u * rule, height: 1, background: look.m.base }} />
              <Reveal text={kicker.toUpperCase()} t={t} at={start + 0.2} step={0.02} dur={0.7} style={{ fontFamily: sans, fontWeight: 600, fontSize: 15 * u, letterSpacing: '0.46em' }} sheen={metalText(look, t)} />
              <div style={{ width: 46 * u * rule, height: 1, background: look.m.base }} />
            </div>
          )}
          <Reveal text={line} t={t} at={start + 0.45} step={0.022} dur={0.8} style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, fontSize: (tall ? 58 : 52) * u, color: IVORY, textShadow: '0 2px 18px rgba(0,0,0,0.45)' }} />
        </div>
      </AbsoluteFill>
    )
  }
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={tall
        ? { position: 'absolute', left: 0, right: 0, bottom, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: `0 ${60 * u}px` }
        : { position: 'absolute', left: 110 * u, bottom, maxWidth: look.W * 0.62 }}>
        <div style={{ width: 56 * u * rule, height: 2 * u, background: accent, marginBottom: 18 * u }} />
        {kicker && <Reveal text={kicker.toUpperCase()} t={t} at={start + 0.2} step={0.018} dur={0.7} style={{ fontFamily: sans, fontWeight: 600, fontSize: 17 * u, letterSpacing: '0.36em', color: IVORY, opacity: 0.92, marginBottom: 10 * u, textShadow: '0 1px 12px rgba(0,0,0,0.6)' }} />}
        <Reveal text={line} t={t} at={start + 0.45} step={0.022} dur={0.8} style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, fontSize: (tall ? 58 : 52) * u, color: IVORY, textShadow: '0 2px 18px rgba(0,0,0,0.4)' }} />
      </div>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ stats

export const Stats: React.FC<{ props: MotionProps; look: Look; t: number; start: number; end: number }> = ({ props, look, t, start, end }) => {
  if (t < start || t > end) return null
  const { u, luxe, accent, tall } = look
  // A fact of "0" (MLS sends 0 acres for many townhomes and some lots) is left off, not shown as "0 Acres".
  const has = (v?: string) => !!v && Number(String(v).replace(/[^0-9.]/g, '')) > 0
  const f = Object.fromEntries(Object.entries(props.facts).map(([k, v]) => [k, ['beds', 'baths', 'sqft', 'acres'].includes(k) && !has(v as string) ? '' : v])) as typeof props.facts
  const items = [
    f.beds && { n: f.beds, label: Number(f.beds) === 1 ? 'Bedroom' : 'Bedrooms' },
    f.baths && { n: f.baths, label: Number(f.baths) === 1 ? 'Bath' : 'Baths' },
    f.sqft && { n: f.sqft, label: 'Square feet' },
    f.acres && { n: f.acres, label: Number(f.acres) === 1 ? 'Acre' : 'Acres' },
  ].filter(Boolean) as { n: string; label: string }[]
  if (!items.length) return null
  const out = fadeOut(t, end, 0.8)
  const colW = (tall ? 440 : 300) * u
  return (
    <AbsoluteFill style={{ opacity: out, justifyContent: 'flex-end', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', maxWidth: tall ? colW * 2 + 8 : undefined, marginBottom: (tall ? look.H * 0.12 : 120 * u) }}>
        {items.map((s, i) => {
          const e = easeOut(clamp01((t - start - 0.15 - i * 0.18) / 0.8))
          return (
            <div key={s.label} style={{ display: 'flex', alignItems: 'stretch', marginBottom: tall ? 40 * u : 0 }}>
              {i > 0 && !(tall && i % 2 === 0) && <div style={{ width: 1, background: luxe ? look.m.base : accent, opacity: 0.7 * e, margin: `${10 * u}px 0` }} />}
              <div style={{ width: colW, textAlign: 'center', opacity: e, transform: `translateY(${(1 - e) * 16 * u}px)` }}>
                <div style={{ fontFamily: serif, fontWeight: 300, fontSize: 96 * u, lineHeight: 1, ...(luxe ? metalText(look, t + i) : { color: IVORY, textShadow: '0 2px 26px rgba(0,0,0,0.55)' }) }}>{s.n}</div>
                <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 15 * u, letterSpacing: '0.34em', color: luxe ? IVORY : readableOnDark(accent), opacity: luxe ? 0.85 : 1, marginTop: 14 * u, textShadow: '0 1px 14px rgba(0,0,0,0.6)' }}>{s.label.toUpperCase()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ agent badge (like the sign-in sheet)

export const AgentBadge: React.FC<{ props: MotionProps; look: Look; t: number; start: number; end: number }> = ({ props, look, t, start, end }) => {
  if (t < start || t > end || !props.agent.name) return null
  const { u, luxe, accent, tall } = look
  const inA = easeOut(clamp01((t - start) / 0.8))
  const out = fadeOut(t, end, 0.6)
  const ring = luxe ? look.m.base : accent
  // Owner 11/12: larger, and with the agent's phone + email (like the sign-in sheet's header).
  const size = 84 * u
  const initials = props.agent.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const contact = [props.agent.phone, props.agent.email].filter(Boolean).join('   ·   ')
  const barTop = look.bar
  // Fit the frame (QA 11/12: a long name + brokerage ran off a vertical video). Widths are estimated
  // from character counts (average glyph widths of these fonts): name | brokerage on one line when
  // it fits, else the brokerage drops under the name; still too wide -> the whole badge scales down.
  const brokerage = props.agent.brokerage || ''
  const nameW = props.agent.name.length * 36 * u * 0.5
  const brokW = brokerage.length * 15 * u * 0.8
  const contactW = contact.length * 17 * u * 0.56
  const room = (tall ? look.W - 80 * u : look.W * 0.6) - (84 + 20 + 46) * u
  const inline = !brokerage || nameW + 30 * u + brokW <= room
  const textW = Math.max(inline ? nameW + (brokerage ? 30 * u + brokW : 0) : Math.max(nameW, brokW), contactW)
  const fit = Math.min(1, room / Math.max(1, textW))
  return (
    <div style={{
      // Luxe draws a thin metal frame 40u in from the edges - the badge sits just inside it
      position: 'absolute', top: barTop + (luxe ? 58 : 30) * u, ...(tall ? { left: 0, right: 0, display: 'flex', justifyContent: 'center' } : { left: (luxe ? 60 : 36) * u }),
      opacity: inA * out, transform: `translateY(${(1 - inA) * -12 * u}px)`,
    }}>
      <div style={{ transform: fit < 1 ? `scale(${fit})` : undefined, transformOrigin: tall ? 'top center' : 'top left', display: 'inline-flex', alignItems: 'center', gap: 20 * u, borderRadius: 999, border: `1px solid rgba(255,255,255,${luxe ? 0.14 : 0.2})`, background: luxe ? 'rgba(6,6,6,0.66)' : 'rgba(0,0,0,0.48)', padding: `${10 * u}px ${36 * u}px ${10 * u}px ${10 * u}px`, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        {props.agent.photo
          ? <Img src={resolveSrc(props.agent.photo)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `${3 * u}px solid ${ring}` }} />
          : <div style={{ width: size, height: size, borderRadius: '50%', background: ring, border: `${3 * u}px solid ${ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans, fontWeight: 700, fontSize: 30 * u, color: '#111' }}>{initials}</div>}
        <div style={{ textAlign: 'left' }}>
          {/* Owner 11/12: name | brokerage on one line, so it runs about as long as the contact line under it */}
          {inline ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 * u, whiteSpace: 'nowrap' }}>
              <span style={{ fontFamily: serif, fontWeight: 600, fontSize: 36 * u, lineHeight: 1.05, color: '#fff' }}>{props.agent.name}</span>
              {brokerage && <>
                <span style={{ width: 1.5 * u, height: 26 * u, background: ring, opacity: 0.85 }} />
                <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 15 * u, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.8)' }}>{brokerage.toUpperCase()}</span>
              </>}
            </div>
          ) : (
            <>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 36 * u, lineHeight: 1.05, color: '#fff', whiteSpace: 'nowrap' }}>{props.agent.name}</div>
              <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 15 * u, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.8)', marginTop: 4 * u, whiteSpace: 'nowrap' }}>{brokerage.toUpperCase()}</div>
            </>
          )}
          {contact && <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 17 * u, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.92)', marginTop: 6 * u, whiteSpace: 'nowrap' }}>{contact}</div>}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ closing card

export const EndCard: React.FC<{ props: MotionProps; look: Look; t: number; start: number; end: number; bgSrc?: string }> = ({ props, look, t, start, end, bgSrc }) => {
  if (t < start) return null
  const { u, luxe, accent, tall } = look
  const sit = situationPreset(props.situation)
  const f = props.facts
  const S = start
  const inA = smooth(clamp01((t - S) / 1.0))
  const finalBlack = interpolate(t, [end - 0.9, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const z = 1.08 + (t - S) * 0.01
  const rule = ruleEase(clamp01((t - S - 0.9) / 1.1))
  const bigText = sit.endBig(f)
  const showWas = props.situation === 'price_improved' && !!f.wasPrice
  const cta = (props.copy.cta || sit.cta).trim()
  const bigSize = (tall ? 120 : 140) * u * Math.min(1, 12 / Math.max(8, bigText.length))
  const agent = props.agent
  const metal = luxe ? look.m.base : accent
  return (
    <AbsoluteFill style={{ opacity: inA }}>
      <AbsoluteFill style={{ overflow: 'hidden', background: luxe ? '#050505' : '#0b0907' }}>
        {bgSrc && <Img src={resolveSrc(bgSrc)} style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z})`, opacity: luxe ? 0.22 : 0.4 }} />}
        <AbsoluteFill style={{ background: luxe ? 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(5,5,5,0.35), rgba(5,5,5,0.92))' : 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(11,9,7,0.35), rgba(11,9,7,0.88))' }} />
      </AbsoluteFill>
      {luxe && (
        <svg width={look.W} height={look.H} style={{ position: 'absolute', inset: 0 }}>
          <rect x={40 * u} y={40 * u + look.bar} width={look.W - 80 * u} height={look.H - 80 * u - 2 * look.bar} fill="none" stroke={look.m.base} strokeOpacity={0.55 * rule} strokeWidth={1.2 * u} />
        </svg>
      )}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: `0 ${70 * u}px` }}>
        <Reveal text={((props.situation === 'custom' && props.copy.title?.trim()) || sit.endKicker).toUpperCase()} t={t} at={S + 0.4} step={0.03} dur={0.7} style={{ fontFamily: sans, fontWeight: 600, fontSize: 18 * u, letterSpacing: '0.44em', marginBottom: 20 * u, color: luxe ? undefined : readableOnDark(metal) }} sheen={luxe ? metalText(look, t) : undefined} />
        {showWas && (
          <div style={{ position: 'relative', fontFamily: serif, fontWeight: 300, fontSize: 52 * u, color: IVORY, opacity: 0.55 * clamp01((t - S - 0.5) / 0.6), marginBottom: 6 * u }}>
            {f.wasPrice}
            <div style={{ position: 'absolute', left: -6 * u, right: -6 * u, top: '54%', height: 2 * u, background: metal, transform: `scaleX(${ruleEase(clamp01((t - S - 0.9) / 0.6))})`, transformOrigin: 'left' }} />
          </div>
        )}
        <Reveal text={bigText} t={t} at={S + 0.6} step={0.05} dur={1.0} style={{ fontFamily: serif, fontWeight: 300, fontSize: bigSize, lineHeight: 1, color: luxe ? undefined : IVORY }} sheen={luxe ? metalText(look, t) : undefined} />
        <div style={{ width: 260 * u * rule, height: luxe ? 1 : 2 * u, background: metal, margin: `${34 * u}px 0 ${26 * u}px`, opacity: 0.9 }} />
        {f.address && <Reveal text={[f.address, f.cityLine].filter(Boolean).join('  ·  ')} t={t} at={S + 1.3} step={0.012} dur={0.8} style={{ fontFamily: serif, fontStyle: 'italic', fontSize: (tall ? 40 : 40) * u, color: IVORY, opacity: 0.95 }} />}
        {cta && <Reveal text={cta.toUpperCase()} t={t} at={S + 1.9} step={0.015} dur={0.7} style={{ fontFamily: sans, fontWeight: 600, fontSize: 16 * u, letterSpacing: '0.34em', color: IVORY, opacity: 0.82, marginTop: 34 * u }} />}
        {agent.name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 * u, marginTop: 44 * u, opacity: easeOut(clamp01((t - S - 2.1) / 0.8)) }}>
            {agent.photo && <Img src={resolveSrc(agent.photo)} style={{ width: 74 * u, height: 74 * u, borderRadius: '50%', objectFit: 'cover', border: `${2 * u}px solid ${metal}` }} />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 30 * u, color: IVORY, lineHeight: 1.1 }}>{agent.name}</div>
              {agent.brokerage && <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 13 * u, letterSpacing: '0.14em', color: 'rgba(246,241,231,0.72)', marginTop: 5 * u }}>{agent.brokerage.toUpperCase()}</div>}
              {(agent.phone || agent.email) && (
                <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 17 * u, letterSpacing: '0.02em', color: 'rgba(246,241,231,0.9)', marginTop: 6 * u, whiteSpace: 'nowrap' }}>
                  {[agent.phone, agent.email].filter(Boolean).join('   ·   ')}
                </div>
              )}
            </div>
          </div>
        )}
      </AbsoluteFill>
      {f.courtesy && (
        <div style={{ position: 'absolute', bottom: (tall ? 70 : 46) * u + (luxe ? 14 * u : 0) + look.bar, width: '100%', textAlign: 'center', fontFamily: sans, fontSize: 12 * u, letterSpacing: '0.16em', color: IVORY, opacity: 0.5 * clamp01((t - S - 2.2) / 0.8) }}>
          {f.courtesy.toUpperCase()}
        </div>
      )}
      <AbsoluteFill style={{ background: '#000', opacity: finalBlack }} />
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ light leak (transition)

export const LightLeak: React.FC<{ t: number; at: number; len: number; W: number; H: number }> = ({ t, at, len, W, H }) => {
  const q = (t - (at - len / 2)) / len
  if (q < 0 || q > 1) return null
  const a = Math.sin(q * Math.PI)
  const x = (-0.2 + 1.4 * q) * W
  return (
    <AbsoluteFill style={{
      mixBlendMode: 'screen', opacity: 0.75 * a,
      background: `radial-gradient(ellipse 60% 90% at ${x}px ${H * 0.45}px, rgba(255,200,135,0.95), rgba(255,140,60,0.4) 45%, rgba(0,0,0,0) 75%)`,
    }} />
  )
}
