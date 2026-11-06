'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, DoorOpen, Home, KeyRound, MapPin, Signpost, Trees, type LucideIcon } from 'lucide-react'
import { LUXE_METALS, type LuxeMetal } from '@/lib/luxeMetals'

// The Luxe forms' background (owner, 11/06: "form should still be center piece"). A plain page with
// stars that shine around the form, one soft glow along the bottom and nowhere else, and now and then
// a small real estate icon drifting by at the edge.
//
// Everything that keeps moving is opacity or transform on its own layer, so the phone's graphics chip
// does the work: no blur, nothing repainted.

const CSS = String.raw`
.lx-bk { --lx-glow: rgba(var(--lx-rgb),.34); --lx-dust: rgb(var(--lx-deep-rgb)); --lx-icon: rgb(var(--lx-deep-rgb)); --lx-peak: .5; animation: lxfIn 1.8s ease-out both; }
.dark .lx-bk:not(.lx-bk-day) { --lx-glow: rgba(var(--lx-light-rgb),.24); --lx-dust: rgb(var(--lx-light-rgb)); --lx-icon: rgb(var(--lx-light-rgb)); --lx-peak: .6; }
@keyframes lxfIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes lxfBreathe { 0%, 100% { opacity: .78; } 50% { opacity: 1; } }
@keyframes lxfTwinkle { 0%, 100% { opacity: .15; } 50% { opacity: 1; } }
@keyframes lxfFloat { 0% { opacity: 0; transform: translate3d(0,16px,0) rotate(-6deg); } 7%, 13% { opacity: var(--lx-peak); } 20%, 100% { opacity: 0; transform: translate3d(0,-22px,0) rotate(5deg); } }
.lx-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 44%; background: radial-gradient(75% 100% at 50% 100%, var(--lx-glow), transparent 100%); animation: lxfBreathe 9s ease-in-out infinite; will-change: opacity; }
.lx-dot { position: absolute; left: 0; top: 0; width: 2px; height: 2px; border-radius: 50%; color: var(--lx-dust); animation: lxfTwinkle 7s ease-in-out infinite; will-change: opacity; }
.lx-float { position: absolute; left: var(--dx); top: var(--dy); width: 30px; height: 30px; color: var(--lx-icon); opacity: 0; animation: lxfFloat 56s ease-in-out infinite; will-change: transform, opacity; }
@media (max-width: 767px) { .lx-float { left: var(--mx); top: var(--my); width: 26px; height: 26px; } }
@media (prefers-reduced-motion: reduce) {
  .lx-bk, .lx-floor, .lx-dot { animation: none; }
  .lx-float { display: none; }
}
`

// Icon, then where it floats on a computer and on a phone: beside the form, or under it on a phone.
const FLOATS: [LucideIcon, string, string, string, string][] = [
  [Home, '9%', '24%', '8%', '84%'],
  [KeyRound, '88%', '56%', '80%', '78%'],
  [MapPin, '13%', '72%', '42%', '89%'],
  [DoorOpen, '85%', '20%', '10%', '16%'],
  [Trees, '7%', '46%', '84%', '88%'],
  [Building2, '91%', '78%', '28%', '80%'],
  [Signpost, '15%', '12%', '62%', '84%'],
]

/** One group of stars as one dot with many shadows, kept clear of where the form sits. */
function starsFor(w: number, h: number, seed: number): string {
  const half = Math.min(w * 0.46, 330), cx = w / 2, top = h * 0.2, bottom = h * 0.74
  let s = seed
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const out: string[] = []
  const tries = Math.max(36, Math.min(70, Math.round((w * h) / 18000)))
  for (let i = 0; i < tries; i++) {
    const x = 6 + rnd() * (w - 12), y = 6 + rnd() * (h - 12), kind = rnd()
    if (Math.abs(x - cx) < half && y > top && y < bottom) continue
    // A few shine brighter than the rest.
    out.push(`${Math.round(x)}px ${Math.round(y)}px ${kind > 0.88 ? '3px 1px' : kind > 0.6 ? '0 .6px' : '0 0'} currentColor`)
  }
  return out.join(',')
}

const SEEDS = [11, 29, 47]

export default function LuxeMotionBackdrop({ metal, light = false }: { metal: LuxeMetal; light?: boolean }) {
  const m = LUXE_METALS[metal]
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const read = () => setSize(old => (old && old.w === el.clientWidth && old.h === el.clientHeight ? old : { w: el.clientWidth, h: el.clientHeight }))
    read()
    const sized = new ResizeObserver(read)
    sized.observe(el)
    return () => sized.disconnect()
  }, [])

  const vars = { ['--lx-rgb' as string]: m.rgb, ['--lx-light-rgb' as string]: m.lightRgb, ['--lx-deep-rgb' as string]: m.deepRgb } as React.CSSProperties
  return (
    <div ref={box} className={`lx-bk pointer-events-none absolute inset-0 -z-10 overflow-hidden ${light ? 'lx-bk-day' : ''}`} style={vars} aria-hidden data-testid="luxe-backdrop">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lx-floor" />
      {size && SEEDS.map((seed, i) => <span key={seed} className="lx-dot" style={{ boxShadow: starsFor(size.w, size.h, seed), animationDelay: `${-i * 2.35}s` }} />)}
      {FLOATS.map(([Icon, dx, dy, mx, my], i) => (
        <Icon key={i} className="lx-float" strokeWidth={1.25} style={{ ['--dx' as string]: dx, ['--dy' as string]: dy, ['--mx' as string]: mx, ['--my' as string]: my, animationDelay: `${i * 8 - 4}s` } as React.CSSProperties} />
      ))}
    </div>
  )
}
