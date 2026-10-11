'use client'

import { useEffect, useRef, useState } from 'react'
import { Ticket } from 'lucide-react'

// The Guest Pass opening, in the spirit of the Luxe Agent Hub's: a midnight curtain, a ring of the
// open house's accent color drawing around the home's photo while it slowly pushes in, "Welcome,
// {name}" glinting in over the address, a burst of sparks, then the curtain parts top and bottom
// along a glowing seam and the page rises in underneath. ~2.7s; a tap skips it. Colors all come
// from --gp (the open house's accent), so it matches that sign-in screen.
const BURST = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2
  const r = 120 + (i % 3) * 44
  return { dx: `${Math.round(Math.cos(a) * r)}px`, dy: `${Math.round(Math.sin(a) * r * 0.8)}px`, d: `${(i % 4) * 0.04}s` }
})

export default function GuestPassIntro({ firstName, street, photo, coverPosition, onReveal, onDone }: {
  firstName: string
  street: string
  photo?: string
  coverPosition?: { x: number; y: number } | null
  /** The curtain starts parting - the page underneath should animate in now. */
  onReveal: () => void
  onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  const ended = useRef(false)
  const timers = useRef<number[]>([])
  const finish = (fast: boolean) => {
    if (ended.current) return
    ended.current = true
    timers.current.forEach(t => window.clearTimeout(t))
    setLeaving(true)
    onReveal()
    timers.current = [window.setTimeout(onDone, fast ? 650 : 850)]
  }
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onReveal(); onDone(); return }
    document.body.style.overflow = 'hidden'
    timers.current = [window.setTimeout(() => finish(false), 1900)]
    return () => { timers.current.forEach(t => window.clearTimeout(t)); document.body.style.overflow = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { if (leaving) document.body.style.overflow = '' }, [leaving])

  return (
    <div aria-hidden onClick={() => finish(true)} className={`gp-intro fixed inset-0 z-[300] cursor-pointer overflow-hidden ${leaving ? 'is-leaving' : ''}`}>
      <style>{CSS}</style>
      <div className="gp-intro-half gp-intro-top" />
      <div className="gp-intro-half gp-intro-bot" />
      <div className="gp-intro-seam" />
      <div className="gp-intro-center">
        <div className="gp-intro-frame">
          <div className="gp-intro-photo-wrap">
            {photo
              ? <div className="gp-intro-photo" style={{ backgroundImage: `url(${photo})`, backgroundPosition: `${coverPosition?.x ?? 50}% ${coverPosition?.y ?? 50}%` }} />
              : <div className="gp-intro-photo gp-intro-photo-empty" />}
            <div className="gp-intro-sheen" />
          </div>
          <svg viewBox="0 0 240 160" className="gp-intro-ring-svg" preserveAspectRatio="none">
            <rect x="1.5" y="1.5" width="237" height="157" rx="24" fill="none" className="gp-intro-ring-track" />
            <rect x="1.5" y="1.5" width="237" height="157" rx="24" fill="none" className="gp-intro-ring" pathLength={1} />
          </svg>
          {BURST.map((b, k) => <span key={k} className="gp-intro-burst" style={{ ['--dx' as string]: b.dx, ['--dy' as string]: b.dy, animationDelay: `calc(1.1s + ${b.d})` }} />)}
        </div>
        <p className="gp-intro-kicker"><Ticket className="h-3.5 w-3.5" /> Your Guest Pass</p>
        <p className="gp-intro-name font-serif">Welcome, {firstName || 'friend'}</p>
        <p className="gp-intro-street">{street}</p>
      </div>
    </div>
  )
}

const CSS = `
.gp-intro { --gp-l: color-mix(in srgb, var(--gp) 62%, #fff); --gp-p: color-mix(in srgb, var(--gp) 22%, #fff); --gp-glow: color-mix(in srgb, var(--gp) 70%, transparent); }
.gp-intro-half { position: absolute; left: 0; right: 0; height: 50.5%; transition: transform .85s cubic-bezier(.76,0,.24,1); }
.gp-intro-top { top: 0; background: radial-gradient(90% 120% at 50% 100%, color-mix(in srgb, var(--gp) 26%, transparent), transparent 62%), linear-gradient(180deg, #07090c, #111827 72%, #15120c); }
.gp-intro-bot { bottom: 0; background: radial-gradient(90% 120% at 50% 0%, color-mix(in srgb, var(--gp) 26%, transparent), transparent 62%), linear-gradient(0deg, #07090c, #111827 72%, #15120c); }
.gp-intro.is-leaving .gp-intro-top { transform: translateY(-101%); }
.gp-intro.is-leaving .gp-intro-bot { transform: translateY(101%); }
.gp-intro-seam { position: absolute; left: 50%; top: 50%; width: 76%; height: 1.5px; margin-top: -.75px; background: linear-gradient(90deg, transparent, var(--gp-l), var(--gp-p), var(--gp-l), transparent); box-shadow: 0 0 20px 3px var(--gp-glow); transform: translateX(-50%) scaleX(0); opacity: 0; }
.gp-intro:not(.is-leaving) .gp-intro-seam { animation: gpSeam .5s 1.35s forwards; }
.gp-intro.is-leaving .gp-intro-seam { transform: translateX(-50%) scaleX(1.5); opacity: 0; transition: transform .7s cubic-bezier(.65,0,.35,1), opacity .7s .15s; }
.gp-intro-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 24px; text-align: center; transition: opacity .35s, transform .7s cubic-bezier(.65,0,.35,1); }
.gp-intro.is-leaving .gp-intro-center { opacity: 0; transform: scale(1.07); }
.gp-intro-frame { position: relative; width: min(78vw, 300px); aspect-ratio: 3 / 2; }
.gp-intro-photo-wrap { position: absolute; inset: 7px; overflow: hidden; border-radius: 19px; opacity: 0; transform: scale(.9); animation: gpPhotoIn .9s .3s cubic-bezier(.22,.61,.36,1) forwards; box-shadow: 0 30px 60px -20px rgba(0,0,0,.8); }
.gp-intro-photo { position: absolute; inset: 0; background-size: cover; transform: scale(1.18); animation: gpPush 2.6s .3s cubic-bezier(.22,.61,.36,1) forwards; }
.gp-intro-photo-empty { background: linear-gradient(135deg, #1f2937, #111827); }
.gp-intro-sheen { position: absolute; inset: -20%; background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.38) 50%, transparent 62%); transform: translateX(-80%); animation: gpSheen 1.1s 1.05s ease-in-out forwards; }
.gp-intro-ring-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.gp-intro-ring-track { stroke: color-mix(in srgb, var(--gp) 22%, transparent); stroke-width: 1; }
.gp-intro-ring { stroke: var(--gp-l); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: gpRing 1.15s .08s cubic-bezier(.65,0,.35,1) forwards; filter: drop-shadow(0 0 7px var(--gp-glow)); }
.gp-intro-burst { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 999px; background: radial-gradient(circle, var(--gp-p), var(--gp) 60%, transparent 70%); box-shadow: 0 0 10px 2px var(--gp-glow); opacity: 0; animation: gpBurst .95s cubic-bezier(.16,1,.3,1) forwards; }
.gp-intro-kicker { margin-top: 26px; display: inline-flex; align-items: center; gap: 7px; font-size: 10px; font-weight: 900; letter-spacing: .34em; text-transform: uppercase; color: var(--gp-l); opacity: 0; animation: gpRise .7s .55s cubic-bezier(.22,.61,.36,1) forwards; }
.gp-intro-name { margin-top: 10px; font-size: clamp(30px, 8vw, 50px); font-weight: 900; line-height: 1.04; letter-spacing: -.01em; background-image: linear-gradient(100deg, #fff 0%, #fff 40%, var(--gp-l) 48%, var(--gp-p) 52%, var(--gp-l) 56%, #fff 64%, #fff 100%); background-size: 260% 100%; background-position: 100% 0; -webkit-background-clip: text; background-clip: text; color: transparent; opacity: 0; animation: gpRise .8s .72s cubic-bezier(.22,.61,.36,1) forwards, gpGlint 1.5s .95s ease-in-out forwards; }
.gp-intro-street { margin-top: 10px; font-size: 13px; font-weight: 700; letter-spacing: .04em; color: rgba(255,255,255,.62); opacity: 0; animation: gpRise .7s .92s cubic-bezier(.22,.61,.36,1) forwards; }
@keyframes gpSeam { to { transform: translateX(-50%) scaleX(1); opacity: 1; } }
@keyframes gpRing { to { stroke-dashoffset: 0; } }
@keyframes gpPhotoIn { to { opacity: 1; transform: none; } }
@keyframes gpPush { to { transform: scale(1.02); } }
@keyframes gpSheen { to { transform: translateX(80%); } }
@keyframes gpBurst { 0% { opacity: 0; transform: translate(0,0) scale(.4); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1); } }
@keyframes gpRise { from { opacity: 0; transform: translateY(14px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes gpGlint { to { background-position: 0 0; } }
`
