'use client'

// Tiny looping previews for the Cinematic Video pickers - what a theme, an animation style or a
// transition broadly looks like. Pure CSS (transform + opacity only, no blur) on small sample
// photos, so a page full of them stays smooth on a phone and costs nothing to serve.
import React from 'react'
import { LUXE_METALS } from '@/lib/luxeMetals'
import type { MotionMetal, MotionStyleId, MotionTheme, TransitionId } from '@/motion-video/types'

const SM = (n: string) => `/motion/example/sm/${n}.jpg`
export const MOTION_SERIF = '"OHP Motion Serif", "Cormorant Garamond", Georgia, serif'
export const MOTION_SANS = '"OHP Motion Sans", Montserrat, Arial, sans-serif'

/** @font-face for the video's own fonts (so the pickers and the video use the same type). */
export const MOTION_FONT_CSS = `
@font-face { font-family: 'OHP Motion Serif'; src: url('/fonts/cormorant-garamond-normal-300-700.woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: swap; }
@font-face { font-family: 'OHP Motion Serif'; src: url('/fonts/cormorant-garamond-italic-300-700.woff2') format('woff2'); font-weight: 300 700; font-style: italic; font-display: swap; }
@font-face { font-family: 'OHP Motion Sans'; src: url('/fonts/montserrat-v31-latin-regular.ttf'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'OHP Motion Sans'; src: url('/fonts/montserrat-v31-latin-700.woff') format('woff'); font-weight: 600 700; font-display: swap; }
`

export const MINI_CSS = `
.cvm { position: relative; overflow: hidden; background: #0b0b0c; }
.cvm img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; will-change: transform, opacity; }
.cvm .cvm-leak { position: absolute; inset: 0; mix-blend-mode: screen; opacity: 0; pointer-events: none;
  background: radial-gradient(ellipse 60% 90% at 40% 45%, rgba(255,200,135,.95), rgba(255,140,60,.35) 45%, rgba(0,0,0,0) 75%); }
.cvm-drift { animation: cvmDrift 3.6s linear infinite; }
@keyframes cvmDrift { from { transform: scale(1.04) translateX(1.5%); } to { transform: scale(1.1) translateX(-1.5%); } }

/* transitions: A -> B, 3.6s loop */
.cvt-cut .a { animation: cvtCutA 3.6s steps(1, end) infinite; } .cvt-cut .b { animation: cvtCutB 3.6s steps(1, end) infinite; }
@keyframes cvtCutA { 0% { opacity: 1 } 50% { opacity: 0 } 100% { opacity: 1 } }
@keyframes cvtCutB { 0% { opacity: 0 } 50% { opacity: 1 } 100% { opacity: 0 } }
.cvt-crossfade .b { animation: cvtFade 3.6s ease-in-out infinite; }
@keyframes cvtFade { 0%, 40% { opacity: 0 } 62%, 96% { opacity: 1 } 100% { opacity: 0 } }
.cvt-dip .a { animation: cvtDipA 3.6s ease-in-out infinite; } .cvt-dip .b { animation: cvtDipB 3.6s ease-in-out infinite; }
@keyframes cvtDipA { 0%, 40% { opacity: 1 } 51%, 100% { opacity: 0 } }
@keyframes cvtDipB { 0%, 51% { opacity: 0 } 64%, 96% { opacity: 1 } 100% { opacity: 0 } }
.cvt-light .b { animation: cvtFade 3.6s ease-in-out infinite; } .cvt-light .cvm-leak { animation: cvtLeak 3.6s ease-in-out infinite; }
@keyframes cvtLeak { 0%, 38% { opacity: 0; transform: translateX(-30%) } 52% { opacity: .9 } 68%, 100% { opacity: 0; transform: translateX(30%) } }
.cvt-whip .a { animation: cvtWhipA 3.6s cubic-bezier(.55,0,.45,1) infinite; } .cvt-whip .b { animation: cvtWhipB 3.6s cubic-bezier(.55,0,.45,1) infinite; }
@keyframes cvtWhipA { 0%, 44% { transform: translateX(0) } 56%, 100% { transform: translateX(-105%) } }
@keyframes cvtWhipB { 0%, 44% { transform: translateX(105%) } 56%, 98% { transform: translateX(0) } 100% { transform: translateX(105%) } }
.cvt-zoom .a { animation: cvtZoomA 3.6s ease-in infinite; } .cvt-zoom .b { animation: cvtZoomB 3.6s ease-out infinite; }
@keyframes cvtZoomA { 0%, 40% { transform: scale(1.05); opacity: 1 } 55% { transform: scale(1.7); opacity: 0 } 100% { transform: scale(1.7); opacity: 0 } }
@keyframes cvtZoomB { 0%, 47% { transform: scale(1.35); opacity: 0 } 62% { transform: scale(1.05); opacity: 1 } 97% { opacity: 1 } 100% { opacity: 0 } }

/* animation styles: 3 rooms in a loop */
.cvs img { opacity: 0; }
.cvs-cinematic img { animation: cvsCut 6.6s steps(1, end) infinite, cvsSlide 2.2s linear infinite; }
.cvs-glide img { animation: cvsGlide 7.8s ease-in-out infinite, cvsFloat 2.6s ease-in-out infinite; }
.cvs-bold img { animation: cvsCut 3.6s steps(1, end) infinite, cvsPunch 1.2s cubic-bezier(.2,.7,.2,1) infinite; }
@keyframes cvsCut { 0% { opacity: 1 } 33.33% { opacity: 0 } 100% { opacity: 0 } }
@keyframes cvsGlide { 0% { opacity: 0 } 6% { opacity: 1 } 33% { opacity: 1 } 40% { opacity: 0 } 100% { opacity: 0 } }
@keyframes cvsSlide { from { transform: scale(1.1) translateX(3%) } to { transform: scale(1.1) translateX(-3%) } }
@keyframes cvsFloat { from { transform: scale(1.05) } to { transform: scale(1.11) } }
@keyframes cvsPunch { from { transform: scale(1.02) } to { transform: scale(1.16) } }
@media (prefers-reduced-motion: reduce) { .cvm img, .cvm .cvm-leak { animation: none !important; } .cvs img:first-child, .cvm img.a { opacity: 1 !important; } }
`

export function TransitionMini({ id, className = '' }: { id: TransitionId; className?: string }) {
  return (
    <div className={`cvm cvt-${id} ${className}`}>
      <div className="absolute inset-0 cvm-drift"><img className="a" src={SM('front')} alt="" loading="lazy" /></div>
      <div className="absolute inset-0"><img className="b" src={SM('living')} alt="" loading="lazy" /></div>
      {id === 'light' && <div className="cvm-leak" />}
    </div>
  )
}

const STYLE_SECONDS: Record<MotionStyleId, number> = { cinematic: 6.6, glide: 7.8, bold: 3.6 }
export function StyleMini({ id, className = '' }: { id: MotionStyleId; className?: string }) {
  const total = STYLE_SECONDS[id]
  return (
    <div className={`cvm cvs cvs-${id} ${className}`}>
      {['facade', 'living', 'aerial'].map((n, i) => (
        <img key={n} src={SM(n)} alt="" loading="lazy" style={{ animationDelay: `${-((3 - i) % 3) * (total / 3)}s, 0s` }} />
      ))}
    </div>
  )
}

/** A still of the opening title in each look. */
export function ThemeMini({ theme, accent, metal, address = '847 Lesley Road', kicker = 'Just listed', luxeKicker = 'Introducing', className = '' }: {
  theme: MotionTheme; accent: string; metal: MotionMetal; address?: string; kicker?: string; luxeKicker?: string; className?: string
}) {
  const m = LUXE_METALS[metal] || LUXE_METALS.gold
  const luxe = theme === 'luxe'
  const metalText: React.CSSProperties = { backgroundImage: `linear-gradient(100deg, ${m.base}, ${m.light} 30%, ${m.pale} 48%, ${m.light} 62%, ${m.base})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
  return (
    <div className={`cvm ${className}`} style={{ containerType: 'inline-size' } as React.CSSProperties}>
      <img src={SM('front')} alt="" loading="lazy" style={{ filter: luxe ? 'brightness(0.62)' : 'brightness(0.82)' }} />
      {luxe && <div className="absolute inset-[7%] border" style={{ borderColor: `${m.base}aa` }} />}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[8%] text-center" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,0,0,.45), rgba(0,0,0,0) 72%)' }}>
        <div style={{ fontFamily: MOTION_SANS, fontWeight: 600, fontSize: 'max(7px, 3.4cqw)', letterSpacing: '0.4em', color: '#f6f1e7', ...(luxe ? metalText : {}) }}>
          {(luxe ? luxeKicker : kicker).toUpperCase()}
        </div>
        <div style={{ fontFamily: MOTION_SERIF, fontWeight: luxe ? 400 : 300, fontSize: luxe ? '9cqw' : '11cqw', lineHeight: 1.05, marginTop: '3cqw', color: '#f6f1e7', letterSpacing: luxe ? '0.08em' : '0.01em', textTransform: luxe ? 'uppercase' : 'none' }}>
          {address}
        </div>
        {luxe ? (
          <div className="flex items-center" style={{ gap: '2cqw', marginTop: '3cqw' }}>
            <span style={{ width: '12cqw', height: 1, background: m.base }} />
            <span style={{ width: '1.4cqw', height: '1.4cqw', background: m.light, transform: 'rotate(45deg)' }} />
            <span style={{ width: '12cqw', height: 1, background: m.base }} />
          </div>
        ) : (
          <span style={{ width: '22cqw', height: 2, marginTop: '3.2cqw', background: accent }} />
        )}
      </div>
    </div>
  )
}
