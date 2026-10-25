'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, Pause, Play } from 'lucide-react'

// The photo show both Spotlight templates open their gallery with: every photograph drifts - the
// first with a long slow zoom-out, the rest alternating a gentle zoom in / zoom out - and each next
// one dissolves in over the last while it's still moving, while a "next up" strip underneath fills
// its progress bar. Plays only while it's on screen (hovering doesn't stop it - only the pause
// button does) and is fully manual under reduced motion.
export default function PhotoShow({ photos, alt, onOpen, tone, fontClass = '' }: {
  photos: string[]
  alt: string
  onOpen: (index: number) => void
  tone: 'light' | 'dark'
  fontClass?: string // the template's label font (mono / sans) for the counter + strip
}) {
  const shown = photos.slice(0, 14)
  const [index, setIndex] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [inView, setInView] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  // Bumped each time a slide becomes the active one, so its drift restarts from the beginning.
  const starts = useRef<Record<number, number>>({})
  // 30% quicker than before (user, 10/24: was 7.6s / 5.2s a photo).
  const firstDuration = 5320
  const duration = 3640
  const playing = inView && !userPaused && !reduced && shown.length > 1
  const ms = index === 0 ? firstDuration : duration

  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const go = (next: number) => {
    const n = (next + shown.length) % shown.length
    if (n === index) return
    starts.current[n] = (starts.current[n] || 0) + 1
    setPrev(index)
    setIndex(n)
  }
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => go(index + 1), ms)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, ms])
  // Keep the active thumbnail in view in the strip.
  useEffect(() => {
    const strip = stripRef.current
    const el = strip?.querySelector<HTMLElement>(`[data-i="${index}"]`)
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [index])

  if (shown.length === 0) return null
  const dark = tone === 'dark'
  const nextIndex = (index + 1) % shown.length
  return (
    <div ref={rootRef} className={`ps ${dark ? 'ps-dark' : 'ps-light'} ${inView ? '' : 'is-off'}`}>
      <style>{PS_CSS}</style>
      <div
        className="ps-stage"
        // Phones: a sideways swipe on the show moves to the next / previous photo.
        onTouchStart={e => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={e => {
          const s = swipe.current
          swipe.current = null
          if (!s) return
          const dx = e.changedTouches[0].clientX - s.x
          const dy = e.changedTouches[0].clientY - s.y
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) go(index + (dx < 0 ? 1 : -1))
        }}
      >
        {shown.map((src, i) => {
          const state = i === index ? 'is-active' : i === prev ? 'is-prev' : ''
          // Same shorthand while active and while fading out underneath the next one, so the
          // drift carries on through the dissolve instead of snapping back.
          const drift = state && !reduced
            ? (i === 0 ? `psZoomOut ${firstDuration + 1200}ms cubic-bezier(.16,.6,.3,1) both` : `${i % 2 ? 'psDriftIn' : 'psDriftOut'} ${duration + 1200}ms linear both`)
            : undefined
          return (
            <button
              key={src + i}
              type="button"
              tabIndex={i === index ? 0 : -1}
              aria-hidden={i !== index}
              onClick={() => onOpen(i)}
              className={`ps-slide ${state} ${i === 0 ? 'is-first' : ''} ${reduced ? 'is-reduced' : ''}`}
              aria-label={`Open photograph ${i + 1} full screen`}
            >
              <img key={starts.current[i] || 0} src={src} alt={`${alt} - photograph ${i + 1}`} loading={i < 2 ? 'eager' : 'lazy'} draggable={false} style={{ animation: drift }} />
            </button>
          )
        })}
        <div className="ps-shade" aria-hidden />
        <div className={`ps-hud ${fontClass}`}>
          <span className="ps-count">
            <b>{String(index + 1).padStart(2, '0')}</b><i>/</i>{String(shown.length).padStart(2, '0')}
          </span>
          <span className="ps-controls">
            {shown.length > 1 && <button type="button" onClick={() => go(index - 1)} aria-label="Previous photograph"><ChevronLeft className="h-4 w-4" /></button>}
            {shown.length > 1 && !reduced && (
              <button type="button" onClick={() => setUserPaused(p => !p)} aria-label={userPaused ? 'Play the photo show' : 'Pause the photo show'}>
                {userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            )}
            {shown.length > 1 && <button type="button" onClick={() => go(index + 1)} aria-label="Next photograph"><ChevronRight className="h-4 w-4" /></button>}
            <button type="button" onClick={() => onOpen(index)} aria-label="Open full screen"><Expand className="h-3.5 w-3.5" /></button>
          </span>
        </div>
        {shown.length > 1 && (
          <div className="ps-progress" aria-hidden>
            <span key={`${index}-${playing}`} style={{ animationDuration: `${ms}ms`, animationPlayState: playing ? 'running' : 'paused' }} />
          </div>
        )}
      </div>

      {shown.length > 1 && (
        <div className={`ps-strip ${fontClass}`} ref={stripRef}>
          {shown.map((src, i) => (
            <button key={src + i} data-i={i} type="button" onClick={() => go(i)} className={`ps-thumb ${i === index ? 'is-active' : ''} ${i === nextIndex ? 'is-next' : ''}`} aria-label={`Show photograph ${i + 1}`}>
              <img src={src} alt="" loading="lazy" draggable={false} />
              {i === nextIndex && <em>Next</em>}
              {i === index && <span className="ps-thumb-bar"><span key={`${index}-${playing}`} style={{ animationDuration: `${ms}ms`, animationPlayState: playing ? 'running' : 'paused' }} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const PS_CSS = `
.ps-stage{position:relative;overflow:hidden;aspect-ratio:4/3;background:#0b0b0b}
@media(min-width:768px){.ps-stage{aspect-ratio:16/9}}
.ps-light .ps-stage{background:#d8cdb9}
.ps-slide{position:absolute;inset:0;display:block;width:100%;height:100%;padding:0;border:0;cursor:zoom-in;opacity:0;z-index:0;transition:opacity .9s ease}
/* Speed pass 10/22: only the two photos actually on screen (the active one and the one fading out
   under it) get their own GPU layer - "will-change" on all 14 kept 14 full-size photos in graphics
   memory, which is what made phones stutter here. Off screen, the slow drift pauses. */
.ps-slide img{width:100%;height:100%;object-fit:cover;display:block;user-select:none;transform-origin:50% 55%}
.ps-slide.is-prev img,.ps-slide.is-active img{will-change:transform}
.ps.is-off .ps-slide img{animation-play-state:paused!important}
.ps-slide.is-prev{opacity:1;z-index:1;transition:none}
.ps-slide.is-active{opacity:1;z-index:2;transition:opacity 1.2s cubic-bezier(.4,0,.2,1)}
@keyframes psZoomOut{from{transform:scale(1.2)}to{transform:scale(1)}}
@keyframes psDriftIn{from{transform:scale(1.02)}to{transform:scale(1.13)}}
@keyframes psDriftOut{from{transform:scale(1.13)}to{transform:scale(1.02)}}
.ps-slide.is-reduced,.ps-slide.is-reduced.is-active{transition:opacity .4s ease}
.ps-shade{position:absolute;inset:auto 0 0 0;height:34%;z-index:3;pointer-events:none;background:linear-gradient(0deg,rgba(0,0,0,.55),transparent)}
.ps-hud{position:absolute;z-index:4;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:18px 20px 22px;color:#fff;pointer-events:none}
@media(min-width:768px){.ps-hud{padding:26px 30px 30px}}
.ps-count{font-size:12px;letter-spacing:.2em;text-transform:uppercase;display:flex;align-items:baseline;gap:6px}
.ps-count b{font-weight:500;font-size:26px;letter-spacing:.02em}
.ps-count i{opacity:.5;font-style:normal}
.ps-controls{display:flex;gap:8px;pointer-events:auto}
.ps-controls button{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.25);color:#fff;transition:background .25s,border-color .25s,transform .25s}
.ps-controls button:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.7);transform:translateY(-1px)}
.ps-progress{position:absolute;z-index:4;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.18)}
.ps-progress span,.ps-thumb-bar span{display:block;height:100%;width:100%;transform-origin:0 50%;background:var(--sp-accent,#C9A24D);animation-name:psFill;animation-timing-function:linear;animation-fill-mode:both}
@keyframes psFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.ps-strip{display:flex;gap:10px;margin-top:12px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;padding-bottom:2px}
.ps-strip::-webkit-scrollbar{display:none}
.ps-thumb{position:relative;flex:0 0 auto;width:108px;aspect-ratio:4/3;overflow:hidden;padding:0;border:0;cursor:pointer;opacity:.55;transition:opacity .35s,transform .35s;scroll-snap-align:center}
@media(min-width:768px){.ps-thumb{width:136px}}
.ps-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ps-thumb:hover{opacity:.9}
.ps-thumb.is-active{opacity:1}
.ps-thumb.is-next{opacity:.85}
.ps-thumb em{position:absolute;left:6px;top:6px;font-style:normal;font-size:9px;letter-spacing:.18em;text-transform:uppercase;padding:3px 6px;background:rgba(0,0,0,.55);color:#fff;animation:psNextIn .6s ease both}
@keyframes psNextIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.ps-thumb-bar{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.25)}
.ps-light .ps-thumb.is-active{outline:1px solid #172522;outline-offset:3px}
.ps-dark .ps-thumb.is-active{outline:1px solid var(--sp-accent,#C9A24D);outline-offset:3px}
@media(prefers-reduced-motion:reduce){.ps-slide,.ps-slide.is-active{transition:opacity .3s ease}.ps-slide img{animation:none!important}.ps-progress span,.ps-thumb-bar span,.ps-thumb em{animation:none}}
`
