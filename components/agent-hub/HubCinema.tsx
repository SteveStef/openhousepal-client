'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// The Agent Hub's one-at-a-time carousel (phones, and the editor's phone preview), shared by Recent
// Sales, My Listings, Videos, House Tours and Blogs. Instead of sliding sideways, each home arrives
// like a film cut: a seam of light sweeps across and reveals the new photo behind it while the old
// one dims away; the photo itself then holds still (no drifting or zooming - that read as the
// photos "doing animations"); the words rise in one after another; thin segments along the bottom
// fill toward the next slide. Swipe to move, hold or hover to pause, and it rests while
// off-screen. Luxe wraps it in the metal frame and tints the seam and segments with the metal.

export type CinemaSlide = {
  id: string
  image?: string
  href?: string | null
  onClick?: () => void
  /** The slide's own words (price, address...), revealed again each time it lands. */
  overlay?: ReactNode
  /** A fully custom slide (videos, blogs) in place of photo + overlay. */
  custom?: ReactNode
}

type CinemaState = { index: number; prev: number | null; nonce: number }

export default function HubCinema({
  slides, height, aspectRatio = '16 / 9', intervalMs = 4500, autoScroll = true, luxe = false, staticOverlay, showProgress = true, progressTone = 'light', className = '',
}: {
  slides: CinemaSlide[]
  height?: number
  aspectRatio?: string
  intervalMs?: number
  autoScroll?: boolean
  luxe?: boolean
  /** Words that stay put while only the photos change (one listing's own photos). */
  staticOverlay?: ReactNode
  showProgress?: boolean
  progressTone?: 'light' | 'dark'
  className?: string
}) {
  const count = slides.length
  const [state, setState] = useState<CinemaState>({ index: 0, prev: null, nonce: 0 })
  const [paused, setPaused] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const rootRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const swiped = useRef(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const step = (dir: 1 | -1) => setState(s => (count < 2 ? s : { index: (s.index + dir + count) % count, prev: s.index, nonce: s.nonce + 1 }))
  const jump = (to: number) => setState(s => (to === s.index || to < 0 || to >= count ? s : { index: to, prev: s.index, nonce: s.nonce + 1 }))

  useEffect(() => { if (state.index >= count && count > 0) setState({ index: 0, prev: null, nonce: 0 }) }, [count, state.index])

  useEffect(() => {
    if (!autoScroll || count <= 1 || paused || !onScreen) return
    const t = setInterval(() => step(1), intervalMs)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, count, paused, onScreen, intervalMs])

  // Rest while scrolled off-screen (no timers burning on a long page).
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current) }, [])

  const holdPause = () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); setPaused(true) }
  const resumeSoon = (after = 2500) => { if (resumeTimer.current) clearTimeout(resumeTimer.current); resumeTimer.current = setTimeout(() => setPaused(false), after) }

  const onPointerDown = (e: React.PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY, moved: false }
    if (e.pointerType !== 'mouse') holdPause()
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointer.current
    if (!p) return
    if (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10) p.moved = true
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const p = pointer.current
    pointer.current = null
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swiped.current = true
      setTimeout(() => { swiped.current = false }, 350)
      step(dx < 0 ? 1 : -1)
    }
    if (e.pointerType !== 'mouse') resumeSoon()
  }

  if (!count) return null
  const active = slides[Math.min(state.index, count - 1)]
  const sizing: CSSProperties = height ? { height } : { aspectRatio }
  const stageRadius = luxe ? 18.5 : 18

  return (
    <div
      ref={rootRef}
      className={`hc-root relative w-full overflow-hidden ${luxe ? 'hub-lx-card is-luxe rounded-[20px] p-[1.5px]' : 'rounded-[18px] ring-1 ring-black/5 dark:ring-white/10'} ${className}`}
      style={sizing}
      onMouseEnter={holdPause}
      onMouseLeave={() => resumeSoon(400)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { pointer.current = null; resumeSoon() }}
    >
      <style>{CINEMA_CSS}</style>
      {luxe && <span aria-hidden className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-[var(--m-cream)] via-[rgba(var(--m-rgb),0.45)] to-[var(--m-deep)]" />}
      <div className="hc-stage" style={{ borderRadius: stageRadius }}>
        {slides.map((s, i) => {
          const cls = i === state.index ? (state.nonce === 0 ? 'in first' : 'in') : i === state.prev ? 'out' : ''
          return (
            <div key={s.id} className={`hc-slide ${cls} ${luxe ? 'is-luxe' : ''}`} aria-hidden={i !== state.index}>
              {s.custom ? (
                <div className="absolute inset-0">{s.custom}</div>
              ) : (
                <>
                  <span className="hc-photo" style={{ backgroundImage: `url(${s.image || '/placeholder.jpg'})` }} />
                  <span className="hc-scrim" />
                </>
              )}
              {i === state.index && state.nonce > 0 && <span key={`seam-${state.nonce}`} className="hc-seam" aria-hidden />}
              {i === state.index && !staticOverlay && s.overlay && <div key={`ov-${state.nonce}`} className="hc-overlay">{s.overlay}</div>}
            </div>
          )
        })}
        {staticOverlay && <div className="hc-overlay z-[4]">{staticOverlay}</div>}
        {active.href ? (
          <Link
            href={active.href}
            aria-label="Open"
            className="absolute inset-0 z-[5] block"
            onClick={e => { if (swiped.current) { e.preventDefault(); return } active.onClick?.() }}
          />
        ) : null}
        {showProgress && count > 1 && (
          <div className={`hc-prog ${progressTone === 'dark' ? 'is-dark' : ''}`}>
            {slides.map((s, i) => (
              <button key={s.id} type="button" aria-label={`Show ${i + 1} of ${count}`} onClick={e => { e.preventDefault(); e.stopPropagation(); jump(i); holdPause(); resumeSoon(4000) }}>
                {i === state.index && <i key={`p-${state.nonce}`} style={{ animationDuration: `${intervalMs}ms`, animationPlayState: paused || !autoScroll || !onScreen ? 'paused' : 'running' }} />}
                {i < state.index && <span className="done" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** A word/line of the overlay that rises in when its slide lands (delay in seconds). */
export function Rise({ delay = 0, className = '', children, as: Tag = 'div', still = false }: { delay?: number; className?: string; children: ReactNode; as?: 'div' | 'p' | 'span'; still?: boolean }) {
  return <Tag className={`${still ? '' : 'hc-rise'} ${className}`} style={still ? undefined : { animationDelay: `${delay}s` }}>{children}</Tag>
}

/** The sales / listings overlay: status, a short rule, the price, the place, an optional detail line. */
export function HomeOverlay({ luxe = false, status, statusClass, price, title, sub, badge, compact = false, still = false }: {
  luxe?: boolean; status: string; statusClass: string; price: string; title: string; sub?: string; badge?: ReactNode; compact?: boolean; still?: boolean
}) {
  const sold = status.toLowerCase() === 'sold'
  const pill = sold
    ? (luxe ? 'hub-lx-sold rounded-[9px] px-3 py-1.5 text-[10px]' : 'rounded-full bg-gradient-to-br from-[#c0392b] to-[#8e1e1e] px-3 py-1 text-[10px] text-white shadow-[0_8px_18px_-8px_rgba(140,30,30,.9)]')
    : `rounded-full px-2.5 py-1 text-[10px] shadow ${statusClass}`
  return (
    <>
      <Rise as="span" still={still} delay={0.4} className={`absolute left-3 top-3 inline-flex items-center font-black uppercase tracking-wide ${pill}`}>
        {sold && luxe && <span className="hub-lx-sold-dot" />}<span className="relative">{status}</span>
      </Rise>
      <div className={`absolute inset-x-4 ${compact ? 'bottom-4' : 'bottom-6'}`}>
        {badge && <Rise still={still} delay={0.45} className="mb-2 flex">{badge}</Rise>}
        <Rise as="span" still={still} delay={0.5} className={`block h-px w-10 bg-gradient-to-r ${luxe ? 'from-[var(--m-light)]' : 'from-[#e8c97a]'} to-transparent`}>{''}</Rise>
        <Rise as="p" still={still} delay={0.6} className={`mt-2 leading-none ${luxe ? 'hub-lx-price' : 'font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.35)]'} ${compact ? 'text-[22px]' : 'text-[28px]'}`}>{price}</Rise>
        <Rise as="p" still={still} delay={0.74} className={`mt-1.5 truncate font-serif font-bold text-white/90 ${compact ? 'text-[13px]' : 'text-[15px]'}`}>{title}</Rise>
        {sub && <Rise as="p" still={still} delay={0.86} className="mt-0.5 truncate text-[11px] font-semibold text-white/60">{sub}</Rise>}
      </div>
    </>
  )
}

const CINEMA_CSS = `
.hc-stage { position: relative; height: 100%; width: 100%; overflow: hidden; background: #0b0f0e; }
.hc-slide { position: absolute; inset: 0; opacity: 0; z-index: 0; will-change: transform, opacity; }
.hc-slide.in { opacity: 1; z-index: 2; animation: hcReveal 1.15s cubic-bezier(.65,0,.35,1) both; }
.hc-slide.in.first { animation: none; }
.hc-slide.out { opacity: 1; z-index: 1; animation: hcRecede 1.4s cubic-bezier(.22,.61,.36,1) forwards; }
@keyframes hcReveal { from { clip-path: polygon(0 0, -6% 0, -30% 100%, 0 100%); } to { clip-path: polygon(0 0, 130% 0, 106% 100%, 0 100%); } }
@keyframes hcRecede { 0% { filter: brightness(1); opacity: 1; } 70% { opacity: 1; } 100% { filter: brightness(.5); opacity: 0; } }
.hc-photo { position: absolute; inset: 0; background-size: cover; background-position: center; }
.hc-scrim { position: absolute; inset: 0; background: linear-gradient(to top, rgba(11,15,14,.92) 0%, rgba(11,15,14,.38) 40%, rgba(0,0,0,.06) 100%); }
.hc-seam { position: absolute; top: -25%; bottom: -25%; left: -34%; width: 34%; z-index: 3; pointer-events: none; mix-blend-mode: screen; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.10) 42%, rgba(255,255,255,.88) 50%, rgba(255,255,255,.10) 58%, transparent 100%); transform: skewX(-13deg) translateX(0); animation: hcSeam 1.15s cubic-bezier(.65,0,.35,1) both; }
.hc-slide.is-luxe .hc-seam { background: linear-gradient(90deg, transparent 0%, rgba(var(--m-pale-rgb),.12) 42%, rgba(var(--m-pale-rgb),.92) 50%, rgba(var(--m-pale-rgb),.12) 58%, transparent 100%); }
@keyframes hcSeam { to { transform: skewX(-13deg) translateX(440%); } }
.hc-overlay { position: absolute; inset: 0; }
.hc-rise { opacity: 0; animation: hcRise .75s cubic-bezier(.22,.61,.36,1) forwards; }
@keyframes hcRise { from { opacity: 0; transform: translateY(12px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
.hc-prog { position: absolute; left: 14px; right: 14px; bottom: 9px; z-index: 10; display: flex; gap: 4px; }
.hc-prog button { position: relative; display: block; height: 3px; flex: 1; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.22); padding: 0; border: 0; }
.hc-prog button::before { content: ""; position: absolute; left: 0; right: 0; top: -8px; bottom: -8px; }
.hc-prog i { position: absolute; inset: 0; transform-origin: left; transform: scaleX(0); border-radius: 999px; background: #fff; animation: hcProg linear forwards; }
.hc-prog .done { position: absolute; inset: 0; border-radius: 999px; background: rgba(255,255,255,.6); }
.hc-root.is-luxe .hc-prog i { background: linear-gradient(90deg, var(--m-deep), var(--m-light), var(--m-pale)); }
.hc-root.is-luxe .hc-prog .done { background: rgba(var(--m-light-rgb),.6); }
.hc-prog.is-dark button { background: rgba(17,24,39,.18); }
.hc-prog.is-dark i { background: #111827; }
.hc-prog.is-dark .done { background: rgba(17,24,39,.5); }
@keyframes hcProg { to { transform: scaleX(1); } }
@media (prefers-reduced-motion: reduce) {
  .hc-slide.in, .hc-slide.out, .hc-seam, .hc-rise, .hc-prog i { animation: none !important; }
  .hc-slide.out { opacity: 0; } .hc-rise { opacity: 1; }
}
`
