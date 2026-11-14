'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Pause, Play } from 'lucide-react'
import { DESIGNS, type Clip, type Shot, type Visual } from './pitchData'

// The results shown on the right of a feature slide: devices playing a scrolling capture or a film
// of the real page, the kit sheets, the before/after photos and the design wall.
// Anything that plays (a scroll or a film) pauses while the mouse is over it and can be dragged to
// any moment with the slider under it (Scrubber) - both go through one small controller (Ctrl).

export type Ctrl = {
  /** 0..1 - how far through it is. */
  get: () => number
  seek: (v: number) => void
  toggle: () => void
  paused: () => boolean
  hover: (over: boolean) => void
}
export type CtrlRef = React.MutableRefObject<Ctrl | null>
export type Open = (tab: number) => void

/** Which results play, and so get the slider. */
export function plays(v: Visual): boolean {
  return ['phone', 'phoneFilm', 'scan', 'laptop', 'laptopFilm', 'screen', 'tablet'].includes(v.type)
}

/** A tall capture of a real page, gliding down and back. Driven by hand (not a CSS animation) so it can pause and be dragged. */
function ScrollShot({ shot, w, h, speed = 46, active, delay = 0.9, ctrl }: { shot: Shot; w: number; h: number; speed?: number; active: boolean; delay?: number; ctrl?: CtrlRef }) {
  const img = useRef<HTMLImageElement>(null)
  const st = useRef({ t: 0, paused: false, hover: false })
  const travel = Math.max(0, (w * shot.h) / shot.w - h)
  const dur = Math.max(10, travel / speed)
  useEffect(() => {
    if (!active || travel < 40) return
    let raf = 0
    let last = 0
    const start = performance.now() + delay * 1000
    const pos = () => { const c = (st.current.t % (2 * dur)) / dur; return c <= 1 ? c : 2 - c }
    const tick = (now: number) => {
      const s = st.current
      if (last && now > start && !s.paused && !s.hover) s.t += Math.min(0.1, (now - last) / 1000)
      last = now
      const p = pos()
      if (img.current) img.current.style.transform = `translate3d(0,${-(p * p * (3 - 2 * p)) * travel}px,0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    if (ctrl) ctrl.current = { get: pos, seek: v => { st.current.t = v * dur }, toggle: () => { st.current.paused = !st.current.paused }, paused: () => st.current.paused, hover: o => { st.current.hover = o } }
    return () => { cancelAnimationFrame(raf); if (ctrl) ctrl.current = null }
  }, [active, travel, dur, delay, ctrl])
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} src={shot.src} alt="" draggable={false} decoding="async" className="pd-shot" />
}

/** A film of the real page being used (typing, tapping, booking a tour). */
function FilmView({ film, active, ctrl, loop = true, onEnded }: { film: Clip; active: boolean; ctrl?: CtrlRef; loop?: boolean; onEnded?: (el: HTMLVideoElement) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const st = useRef({ paused: false, hover: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => { if (active && !st.current.paused && !st.current.hover) el.play().catch(() => {}); else el.pause() }
    el.playbackRate = film.rate || 1
    sync()
    if (ctrl) {
      ctrl.current = {
        get: () => (el.duration ? el.currentTime / el.duration : 0),
        seek: v => { if (el.duration) el.currentTime = Math.min(el.duration - 0.05, v * el.duration) },
        toggle: () => { st.current.paused = !st.current.paused; sync() },
        paused: () => st.current.paused,
        hover: o => { st.current.hover = o; sync() },
      }
    }
    return () => { el.pause(); if (ctrl) ctrl.current = null }
  }, [active, film.rate, ctrl])
  return (
    <video ref={ref} src={film.src} poster={film.poster} muted playsInline loop={loop} preload="auto" className="block h-full w-full object-cover"
      onLoadedMetadata={e => { e.currentTarget.playbackRate = film.rate || 1 }} onEnded={e => onEnded?.(e.currentTarget)} />
  )
}

/** Play / pause + a slider to drag the result to any moment. */
export function Scrubber({ ctrl, big = false }: { ctrl: CtrlRef; big?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const dragging = useRef(false)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const c = ctrl.current
      if (c) {
        if (input.current && !dragging.current) input.current.value = String(Math.round(c.get() * 1000))
        const p = c.paused()
        setPaused(was => (was === p ? was : p))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ctrl])
  const size = big ? 46 : 36
  return (
    <div data-nonav className="pd-scrub" style={{ height: size + 10, padding: `0 ${big ? 20 : 16}px 0 5px`, gap: big ? 14 : 12 }}>
      <button type="button" aria-label={paused ? 'Play' : 'Pause'} onClick={() => ctrl.current?.toggle()} style={{ width: size, height: size }}>
        {paused ? <Play style={{ width: size * 0.42, height: size * 0.42, marginLeft: 2 }} fill="currentColor" /> : <Pause style={{ width: size * 0.42, height: size * 0.42 }} fill="currentColor" />}
      </button>
      <input ref={input} type="range" min={0} max={1000} defaultValue={0} aria-label="Move through it" style={{ width: big ? 340 : 280 }}
        onPointerDown={() => { dragging.current = true }} onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}
        onInput={e => { const c = ctrl.current; if (!c) return; if (!c.paused()) c.toggle(); c.seek(Number(e.currentTarget.value) / 1000) }} />
    </div>
  )
}

/** A piece of a result that opens the look-closer view when clicked (never moves to the next slide), and pauses what plays inside it while the mouse is over it. */
function Zoom({ n, open, ctrl, children, className = '', style }: { n: number; open: Open; ctrl?: CtrlRef; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div data-nonav role="button" title="Click to look closer" onClick={() => open(n)} className={`pd-zoom ${className}`} style={style}
      onMouseEnter={() => ctrl?.current?.hover(true)} onMouseLeave={() => ctrl?.current?.hover(false)}>{children}</div>
  )
}

function Phone({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  return <div className="pd-phone" style={{ width: w, height: h }}><div className="pd-screen">{children}<span className="pd-glare" /></div></div>
}

function Laptop({ w, children }: { w: number; children: React.ReactNode }) {
  return (
    <div className="pd-laptop" style={{ width: w + 24 }}>
      <div className="pd-lid"><div className="pd-screen" style={{ width: w, height: Math.round(w * 0.625) }}>{children}<span className="pd-glare" /></div></div>
      <div className="pd-base" style={{ margin: '0 -34px' }} />
    </div>
  )
}

/** Sign In: the phone points at the printed sheet's code, then the real sign-in plays through to the Guest Pass, and it starts over. */
function ScanFilm({ film, active, open, ctrl }: { film: Clip; active: boolean; open: Open; ctrl: CtrlRef }) {
  const [scan, setScan] = useState(true)
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (!active) return
    setScan(true)
    const t = setTimeout(() => setScan(false), 3000)
    return () => clearTimeout(t)
  }, [active, round])
  return (
    <div className="relative" style={{ width: 760, height: 700 }}>
      <Zoom n={1} open={open} className="absolute" style={{ left: 6, top: 150, width: 300, height: 388, transform: 'rotate(-5deg)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pitch/kit-flyer.jpg" alt="" draggable={false} className="block h-full w-full rounded-md object-cover shadow-[0_30px_60px_-18px_rgba(0,0,0,.8)]" />
        <span className="pd-qr" data-on={scan ? 1 : 0} style={{ left: '77.5%', top: '74.5%' }} />
      </Zoom>
      <div className="absolute grid place-items-center rounded-full bg-[#C9A24D] text-[#111827]" style={{ left: 338, top: 318, width: 48, height: 48, zIndex: 2, boxShadow: '0 0 0 8px rgba(201,162,77,.18)' }}><ArrowRight style={{ width: 24, height: 24 }} strokeWidth={3} /></div>
      <Zoom n={0} open={open} ctrl={ctrl} className="absolute" style={{ right: 26, top: 22 }}>
        <Phone w={302} h={655}>
          <FilmView film={film} active={active && !scan} ctrl={ctrl} loop={false} onEnded={el => { el.currentTime = 0; setRound(r => r + 1) }} />
          <div className="pd-scan" data-on={scan ? 1 : 0}>
            <div className="absolute inset-0" style={{ backgroundImage: 'url(/pitch/kit-flyer-lg.jpg)', backgroundSize: '330%', backgroundPosition: '89.4% 99.7%' }} />
            <div className="absolute inset-0 bg-black/35" />
            <span className="pd-frame"><i /><b /></span>
            <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 font-black text-[#f3dfa8]" style={{ top: 78, fontSize: 15, padding: '9px 18px' }}>Camera: scan to sign in</span>
          </div>
        </Phone>
      </Zoom>
    </div>
  )
}

function KitFan({ open }: { open: Open }) {
  const sheets = [
    { src: '/pitch/kit-flyer.jpg', x: -252, y: 10, r: -7, name: 'Sign-In Sheet' },
    { src: '/pitch/kit-cheat.jpg', x: -84, y: -22, r: -2.5, name: 'Cheat Sheet' },
    { src: '/pitch/kit-brag.jpg', x: 84, y: -22, r: 2.5, name: 'Brag Sheet' },
    { src: '/pitch/kit-similar.jpg', x: 252, y: 10, r: 7, name: 'Similar Homes' },
  ]
  return (
    <div className="relative" style={{ width: 800, height: 700 }}>
      {sheets.map((s, i) => (
        <div key={s.src} data-nonav role="button" title="Click to look closer" onClick={() => open(i)} className="pd-sheet pd-zoom" style={{ width: 272, height: 352, marginTop: -40, zIndex: i, ['--x' as string]: `${s.x}px`, ['--y' as string]: `${s.y}px`, ['--r' as string]: `${s.r}deg`, ['--sd' as string]: `${i * 110}ms` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} alt="" draggable={false} className="block h-full w-full object-cover" />
        </div>
      ))}
      <div className="absolute inset-x-0 flex justify-center gap-3" style={{ bottom: 74 }}>
        {sheets.map((s, i) => <button key={s.name} type="button" data-nonav onClick={() => open(i)} className="pd-tag pd-zoom" style={{ fontSize: 15, padding: '9px 16px' }}>{s.name}</button>)}
      </div>
    </div>
  )
}

function Compare() {
  const rows = [
    { before: '/demos/media-lab/twilight-before.jpg', after: '/demos/media-lab/twilight-after.jpg', a: 'Day', b: 'Twilight', wd: '.5s' },
    { before: '/demos/media-lab/staging-before.jpg', after: '/demos/media-lab/staging-after.jpg', a: 'Empty', b: 'Staged', wd: '2.2s' },
  ]
  return (
    <div className="flex flex-col" style={{ gap: 26 }}>
      {rows.map(r => (
        <div key={r.b} className="pd-cmp" style={{ width: 540, height: 360, ['--wd' as string]: r.wd }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.before} alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.after} alt="" draggable={false} className="pd-after" />
          <span className="pd-bar" />
          <span className="pd-lab text-white/80" style={{ left: 14, fontSize: 12, padding: '7px 13px' }}>{r.a}</span>
          <span className="pd-lab text-[#f3dfa8]" style={{ right: 14, fontSize: 12, padding: '7px 13px' }}>{r.b}</span>
        </div>
      ))}
    </div>
  )
}

function Wall() {
  // All three columns drift (left and right up, middle down), close to the same pace.
  const cols: [string[], string, boolean][] = [[DESIGNS.a, '46s', false], [DESIGNS.b, '52s', true], [DESIGNS.c, '40s', false]]
  return (
    <div className="pd-wall flex" style={{ width: 760, height: 740, gap: 18 }}>
      {cols.map(([list, dur, rev], i) => (
        <div key={i} style={{ width: 241, flex: 'none' }}>
          <div className="pd-col" data-rev={rev ? 1 : 0} style={{ ['--dur' as string]: dur }}>
            {[...list, ...list].map((d, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={k} src={`/pitch/design-${d}.jpg`} alt="" draggable={false} style={{ marginBottom: 18 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function VisualView({ v, open, active, ctrl }: { v: Visual; open: Open; active: boolean; ctrl: CtrlRef }) {
  switch (v.type) {
    case 'phone': return <Zoom n={0} open={open} ctrl={ctrl}><Phone w={340} h={708}><ScrollShot shot={v.shot} w={340} h={708} active={active} ctrl={ctrl} /></Phone></Zoom>
    case 'phoneFilm': return <Zoom n={0} open={open} ctrl={ctrl}><Phone w={322} h={698}><FilmView film={v.film} active={active} ctrl={ctrl} /></Phone></Zoom>
    case 'scan': return <ScanFilm film={v.film} active={active} open={open} ctrl={ctrl} />
    case 'twoPhones':
      return (
        <div className="relative" style={{ width: 720, height: 700 }}>
          <Zoom n={0} open={open} className="absolute" style={{ left: 30, top: 14 }}><Phone w={296} h={640}><ScrollShot shot={v.a} w={296} h={640} active={false} /></Phone></Zoom>
          <div className="absolute grid place-items-center rounded-full bg-[#C9A24D] text-[#111827]" style={{ left: 336, top: 300, width: 48, height: 48, zIndex: 2, boxShadow: '0 0 0 8px rgba(201,162,77,.18)' }}><ArrowRight style={{ width: 24, height: 24 }} strokeWidth={3} /></div>
          <Zoom n={1} open={open} className="absolute" style={{ right: 30, top: 46 }}><Phone w={296} h={640}><ScrollShot shot={v.b} w={296} h={640} active={false} /></Phone></Zoom>
        </div>
      )
    case 'laptop': return <Zoom n={0} open={open} ctrl={ctrl}><Laptop w={700}><ScrollShot shot={v.shot} w={700} h={438} speed={56} active={active} ctrl={ctrl} /></Laptop></Zoom>
    case 'laptopFilm': return <Zoom n={0} open={open} ctrl={ctrl}><Laptop w={712}><FilmView film={v.film} active={active} ctrl={ctrl} /></Laptop></Zoom>
    case 'screen':
      return <Zoom n={0} open={open} ctrl={ctrl}><div className="pd-cmp" style={{ width: 768, height: 432 }}><FilmView film={v.film} active={active} ctrl={ctrl} /></div></Zoom>
    case 'tablet':
      return (
        <Zoom n={0} open={open} ctrl={ctrl}><div className="pd-tablet" style={{ width: 510, height: 690 }}>
          <div className="pd-screen"><ScrollShot shot={v.shot} w={510} h={690} speed={52} active={active} ctrl={ctrl} /><span className="pd-glare" /></div>
        </div></Zoom>
      )
    case 'kit': return <KitFan open={open} />
    case 'compare': return <Zoom n={0} open={open}><Compare /></Zoom>
    case 'wall': return <Zoom n={0} open={open}><Wall /></Zoom>
  }
}

export function shotsOf(v: Visual): string[] {
  switch (v.type) {
    case 'phone': case 'tablet': case 'laptop': return [v.shot.src]
    case 'phoneFilm': case 'laptopFilm': case 'screen': return [v.film.poster]
    case 'scan': return [v.film.poster, '/pitch/kit-flyer.jpg', '/pitch/kit-flyer-lg.jpg']
    case 'twoPhones': return [v.a.src, v.b.src]
    case 'kit': return ['flyer', 'cheat', 'brag', 'similar'].map(k => `/pitch/kit-${k}.jpg`)
    case 'compare': return ['twilight-before', 'twilight-after', 'staging-before', 'staging-after'].map(k => `/demos/media-lab/${k}.jpg`)
    case 'wall': return [...DESIGNS.a, ...DESIGNS.b, ...DESIGNS.c].map(d => `/pitch/design-${d}.jpg`)
  }
}
