'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LUXE_METALS, type LuxeMetal, type MetalPalette } from '@/lib/luxeMetals'
import { initialsOf, mix } from '@/lib/invites'
import InviteCard, { CARD_H, CARD_W, type InviteCardData } from './InviteCard'
import { SERIF } from './inviteFonts'

// The Luxe opening (user, 10/24: "way over the top - stunning, next-level"). A black-lacquer
// envelope edged in foil floats in a dark room lit by slow metallic light; "You're invited"
// writes itself in foil, letter by letter; the medallion seal (the host's initials, embossed)
// turns in the light. Then the seal cracks in two with a shockwave and a burst of foil, the flap
// swings open on a glowing liner, light rays bloom and the card rises out turning in 3D, a sheen
// running over its face - and the page takes over.
// Only transforms, opacity and gradients move (no blur filters) so it stays smooth on phones.
// `frame` = play inside a box (the builder's preview) instead of over the whole screen.

type Phase = 'idle' | 'crack' | 'flap' | 'rise' | 'free' | 'out'

export function metalOfInvite(data: Pick<InviteCardData, 'luxe_metal' | 'accent_color'>): MetalPalette {
  if (data.luxe_metal) return LUXE_METALS[data.luxe_metal as LuxeMetal]
  // A Classic colour on the Luxe animation: a metal built from it (light / deep tones of the colour).
  const a = data.accent_color || '#C9A24D'
  return { label: 'Custom', base: a, light: mix(a, '#ffffff', 0.45), deep: mix(a, '#000000', 0.4), mid: mix(a, '#000000', 0.15), pale: mix(a, '#ffffff', 0.8),
    rgb: hexRgb(a), lightRgb: hexRgb(mix(a, '#ffffff', 0.45)), deepRgb: hexRgb(mix(a, '#000000', 0.4)), paleRgb: hexRgb(mix(a, '#ffffff', 0.8)) }
}
function hexRgb(h: string) { const n = parseInt(h.replace('#', ''), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` }
export const foilOf = (m: MetalPalette, angle = 115) => `linear-gradient(${angle}deg, ${m.deep} 0%, ${m.light} 22%, ${m.pale} 38%, ${m.base} 55%, ${m.light} 72%, ${m.deep} 100%)`

// Deterministic "random" so the server render and the phone agree (and the preview loops the same).
const rnd = (i: number, k = 1) => { const x = Math.sin(i * 12.9898 * k + 78.233) * 43758.5453; return x - Math.floor(x) }

export default function InviteLuxeOpening({ data, hostName, onOpened, autoMs = 1900, frame, loopKey }: {
  data: InviteCardData
  hostName?: string | null
  onOpened: () => void
  autoMs?: number
  /** Play inside a box this size (builder preview) instead of fixed over the screen. */
  frame?: { w: number; h: number }
  loopKey?: number
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [win, setWin] = useState({ w: 390, h: 844 })
  const done = useRef(false)
  const timers = useRef<number[]>([])
  const m = metalOfInvite(data)
  const foil = foilOf(m)

  useEffect(() => {
    if (frame) return
    const fit = () => setWin({ w: window.innerWidth, h: window.innerHeight })
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [frame])

  useEffect(() => {
    done.current = false
    setPhase('idle')
    if (!frame && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }
    const tap = !frame && new URLSearchParams(window.location.search).has('tap')
    const t = tap ? 0 : window.setTimeout(open, autoMs)
    return () => { window.clearTimeout(t); timers.current.forEach(x => window.clearTimeout(x)); timers.current = [] }
  }, [loopKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    if (done.current) return
    done.current = true
    onOpened()
  }
  function later(ms: number, fn: () => void) { timers.current.push(window.setTimeout(fn, ms)) }
  function open() {
    setPhase(p => {
      if (p !== 'idle') return p
      later(380, () => setPhase('flap'))
      later(950, () => setPhase('rise'))
      later(1950, () => setPhase('free'))
      later(3300, () => setPhase('out'))
      later(3850, finish)
      return 'crack'
    })
  }

  const W = frame ? frame.w : win.w
  const H = frame ? frame.h : win.h
  const small = W < 520
  const envW = Math.round(frame ? W * 0.8 : Math.min(W - 44, small ? 360 : 460))
  const envH = Math.round(envW * 0.64)
  const cardW = Math.round(envW * 0.84)
  const cardH = Math.round(cardW * (CARD_H / CARD_W))
  const opened = phase !== 'idle' && phase !== 'crack'
  const rise = phase === 'rise' || phase === 'free' || phase === 'out'
  const free = phase === 'free' || phase === 'out'
  const cracked = phase !== 'idle'
  const seal = Math.max(frame ? 34 : 62, Math.round(envW * 0.17))
  const scale = frame ? W / 390 : 1
  // "You're invited" sits ABOVE the envelope, never under it (owner, 10/31: in the builder's small
  // preview the envelope covered the words). The words and the envelope are one block centred on
  // the screen: the words' real height, a gap that clears the envelope's float-in and bob, then the
  // envelope.
  const fromSize = Math.max(7, 10 * scale)
  const wordSize = (small ? 40 : 52) * scale
  const wordsH = fromSize * 1.5 + 4 + wordSize * 1.15 + 12 * scale + 1
  const gap = Math.max(12, (small ? 34 : 44) * scale)
  const wordsTop = Math.max(frame ? 14 : 24, (H - (wordsH + gap + envH)) / 2 - (frame ? 6 : 0))
  const envTop = wordsTop + wordsH + gap
  // Where the card sits inside: just under the pocket's V (fully hidden until the flap opens).
  const cardTop = envH * 0.7
  // 1) it rises half out of the envelope; 2) the envelope drops away below it (the card held still
  //    against the drop) and the card glides to the middle of the screen, a little bigger.
  const liftA = -cardH * 0.56
  const drop = envH + H * 0.35
  const centerShift = (H - cardH * 1.06) / 2 - (envTop + cardTop + liftA)
  const cardY = free ? liftA - drop + centerShift : rise ? liftA : 0
  const ease = [0.45, 0, 0.2, 1] as const
  const dust = useMemo(() => Array.from({ length: frame ? 14 : 30 }, (_, i) => ({
    left: rnd(i) * 100, top: rnd(i, 2) * 100, size: 1 + Math.round(rnd(i, 3) * 2.4), delay: rnd(i, 4) * 7, dur: 7 + rnd(i, 5) * 8,
  })), [frame])
  const burst = useMemo(() => Array.from({ length: frame ? 18 : 40 }, (_, i) => {
    const ang = (i / (frame ? 18 : 40)) * Math.PI * 2 + rnd(i, 6) * 0.5
    const dist = (0.5 + rnd(i, 7) * 0.75) * envW * 0.75
    return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist * 0.8 - envH * 0.15, s: 3 + rnd(i, 8) * 6, r: rnd(i, 9) * 540, diamond: i % 3 === 0, delay: rnd(i, 10) * 0.12 }
  }), [envW, envH, frame])
  const word = "You're invited"
  const css = `
    .lxo-aur{position:absolute;width:140%;height:140%;left:-20%;top:-20%;pointer-events:none}
    .lxo-a1{background:radial-gradient(38% 34% at 30% 35%, rgba(${m.rgb},.30), transparent 70%);animation:lxoA1 16s ease-in-out infinite alternate}
    .lxo-a2{background:radial-gradient(34% 30% at 72% 68%, rgba(${m.lightRgb},.22), transparent 70%);animation:lxoA2 19s ease-in-out infinite alternate}
    .lxo-a3{background:radial-gradient(50% 40% at 50% 110%, rgba(${m.deepRgb},.45), transparent 70%)}
    @keyframes lxoA1{0%{transform:translate(-4%,-3%) scale(1)}100%{transform:translate(6%,5%) scale(1.12)}}
    @keyframes lxoA2{0%{transform:translate(5%,4%) scale(1.08)}100%{transform:translate(-6%,-5%) scale(.96)}}
    .lxo-dust{position:absolute;border-radius:9999px;background:${m.pale};box-shadow:0 0 6px 1px rgba(${m.lightRgb},.8);opacity:0;animation:lxoDust var(--d) linear infinite}
    @keyframes lxoDust{0%{opacity:0;transform:translateY(0)}15%{opacity:.9}55%{opacity:.25}75%{opacity:.85}100%{opacity:0;transform:translateY(-120px)}}
    .lxo-foil{background-size:220% 100%;animation:lxoFoil 3.2s ease-in-out infinite}
    @keyframes lxoFoil{0%{background-position:100% 0}100%{background-position:-120% 0}}
    .lxo-sweep{position:absolute;top:-30%;bottom:-30%;width:28%;background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,.0) 20%,rgba(255,255,255,.22) 50%,rgba(255,255,255,0) 80%,transparent 100%);transform:translateX(-160%) skewX(-18deg);animation:lxoSweep 3.4s cubic-bezier(.6,.05,.3,1) infinite 0.6s}
    @keyframes lxoSweep{0%{transform:translateX(-200%) skewX(-18deg)}55%,100%{transform:translateX(520%) skewX(-18deg)}}
    .lxo-ring{animation:lxoSpin 14s linear infinite}
    @keyframes lxoSpin{to{transform:rotate(360deg)}}
    .lxo-rays{animation:lxoSpin 26s linear infinite}
    @media (prefers-reduced-motion:reduce){.lxo-a1,.lxo-a2,.lxo-dust,.lxo-foil,.lxo-sweep,.lxo-ring,.lxo-rays{animation:none}}
  `

  return (
    <motion.div className={`${frame ? 'absolute' : 'fixed'} inset-0 z-[80] overflow-hidden`} style={{ background: '#050506', perspective: 1400 }}
      initial={{ opacity: 1 }} animate={{ opacity: phase === 'out' ? 0 : 1 }} transition={{ duration: 0.6, delay: phase === 'out' ? 0.15 : 0 }}
      onClick={open} role="button" aria-label="Open the invitation" data-testid="invite-luxe-opening">
      <style>{css}</style>
      {/* the room: slow metallic light + dust in the air */}
      <div aria-hidden className="lxo-aur lxo-a1" />
      <div aria-hidden className="lxo-aur lxo-a2" />
      <div aria-hidden className="lxo-aur lxo-a3" />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(75% 60% at 50% 50%, transparent 40%, rgba(0,0,0,.75) 100%)' }} />
      {dust.map((d, i) => (
        <span key={i} aria-hidden className="lxo-dust" style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, animationDelay: `${d.delay}s`, ['--d' as any]: `${d.dur}s` }} />
      ))}

      {/* light rays that bloom when it opens */}
      <motion.div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2" style={{ width: Math.max(W, H) * 1.6, height: Math.max(W, H) * 1.6, marginLeft: -Math.max(W, H) * 0.8, marginTop: -Math.max(W, H) * 0.8 }}
        initial={false} animate={{ opacity: rise ? 0.9 : opened ? 0.35 : 0, scale: rise ? 1 : 0.6 }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
        <div className="lxo-rays absolute inset-0" style={{ background: `repeating-conic-gradient(from 0deg, rgba(${m.lightRgb},.16) 0deg 4deg, transparent 4deg 14deg)`, WebkitMaskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,.5) 22%, transparent 55%)', maskImage: 'radial-gradient(circle, #000 0%, rgba(0,0,0,.5) 22%, transparent 55%)' }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle, rgba(${m.paleRgb},.35) 0%, rgba(${m.rgb},.14) 16%, transparent 40%)` }} />
      </motion.div>

      {/* "You're invited", written in foil */}
      <div className="pointer-events-none absolute inset-x-0 text-center" style={{ top: wordsTop }} data-testid="luxe-opening-words">
        <motion.p className="font-black uppercase" style={{ fontSize: fromSize, lineHeight: 1.5, letterSpacing: `${0.5 * scale}em`, color: `rgba(${m.lightRgb},.75)` }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: cracked ? 0 : 1, y: 0 }} transition={{ delay: cracked ? 0 : 0.25, duration: 0.6 }}>
          {hostName ? `From ${hostName}` : 'A private invitation'}
        </motion.p>
        <motion.h2 className="mt-1" style={{ fontFamily: SERIF, fontSize: wordSize, lineHeight: 1.15, fontStyle: 'italic', fontWeight: 400, whiteSpace: 'nowrap' }}
          animate={{ opacity: cracked ? 0 : 1, y: cracked ? -14 : 0 }} transition={{ duration: 0.45 }}>
          {word.split('').map((ch, i) => (
            <motion.span key={i} className="lxo-foil inline-block" style={{ backgroundImage: foil, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', whiteSpace: 'pre' }}
              initial={{ opacity: 0, y: 18 * scale, rotateX: -80 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.35 + i * 0.045, type: 'spring', stiffness: 220, damping: 18 }}>
              {ch}
            </motion.span>
          ))}
        </motion.h2>
        <motion.div className="mx-auto" style={{ marginTop: 12 * scale, height: 1, width: 120 * scale, background: `linear-gradient(90deg, transparent, ${m.light}, transparent)` }}
          initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: cracked ? 0 : 1, opacity: cracked ? 0 : 1 }} transition={{ delay: cracked ? 0 : 1.05, duration: 0.7 }} />
      </div>

      {/* the envelope */}
      {/* (no preserve-3d here - the layers must stack by z-index: back, card, pocket, flap, seal) */}
      <motion.div className="absolute left-1/2" style={{ width: envW, height: envH, marginLeft: -envW / 2, top: envTop }}
        initial={{ y: 70, opacity: 0, rotateX: 28 }}
        animate={free ? { y: drop, opacity: 1, rotateX: 0 } : rise ? { y: 0, opacity: 1, rotateX: 0 } : cracked ? { y: 0, opacity: 1, rotateX: 0 } : { y: [0, -7, 0], opacity: 1, rotateX: 0 }}
        transition={free ? { y: { duration: 0.95, ease } } : cracked ? { type: 'spring', stiffness: 140, damping: 20 } : { y: { duration: 4, repeat: Infinity, ease: 'easeInOut' }, rotateX: { type: 'spring', stiffness: 120, damping: 15 }, opacity: { duration: 0.8 } }}>
        {/* (it settles flat and full size: a grow-in or an endless tilt keeps it redrawn soft-edged,
            owner 10/31 "why do the edges look so blurry") */}
        {/* the foil edge + the lacquer back (fades as the envelope drops away) */}
        <motion.div className="absolute inset-0 rounded-[12px]" style={{ background: foil, padding: 1.5, boxShadow: `0 26px 34px -24px rgba(0,0,0,.95), 0 0 0 1px rgba(0,0,0,.4), 0 0 40px -18px rgba(${m.rgb},.5)` }}
          initial={false} animate={{ opacity: free ? 0 : 1 }} transition={{ duration: 0.7, delay: free ? 0.2 : 0 }}>
          <div className="relative h-full w-full overflow-hidden rounded-[11px]" style={{ background: 'linear-gradient(150deg,#1b1b1f 0%,#0b0b0d 55%,#141417 100%)' }}>
            <div aria-hidden className="absolute inset-0 opacity-[0.35]" style={{ background: `repeating-linear-gradient(135deg, rgba(${m.rgb},.08) 0 1px, transparent 1px 7px)` }} />
            {/* the liner glows when the flap opens */}
            <motion.div aria-hidden className="absolute inset-x-[5%] top-[4%]" style={{ height: '58%', borderRadius: 8, background: `linear-gradient(180deg, rgba(${m.paleRgb},.55), rgba(${m.rgb},.25) 45%, transparent)` }}
              initial={false} animate={{ opacity: opened ? 1 : 0 }} transition={{ duration: 0.6 }} />
          </div>
        </motion.div>

        {/* the card inside: rises half out turning in 3D, then - as the envelope drops away below
            it - glides to the middle of the screen. Clipped at the envelope's bottom edge, which
            slides down with it and uncovers the rest of the card. */}
        {/* (clipped a few px inside the bottom edge - the lacquer front stops 1.5px short of it and
            a sliver of the card used to show under the envelope, owner 10/31) */}
        <div className="pointer-events-none absolute overflow-hidden" style={{ left: -800, right: -800, bottom: 6, top: -4000, zIndex: 3 }}>
          <motion.div className="absolute left-1/2" style={{ width: cardW, height: cardH, marginLeft: -cardW / 2, top: 4000 + cardTop, transformPerspective: 1100 }}
            initial={false}
            animate={free ? { y: cardY, scale: 1.06, rotateY: 0, rotateX: 0 } : rise ? { y: cardY, scale: 1.02, rotateY: [-24, 7, 0], rotateX: [12, -3, 0] } : { y: 0, scale: 1, rotateY: 0, rotateX: 0 }}
            transition={free ? { y: { duration: 0.95, ease }, scale: { duration: 1.2, ease: [0.22, 1, 0.36, 1] } }
              : rise ? { y: { type: 'spring', stiffness: 75, damping: 16 }, scale: { duration: 1 }, rotateY: { duration: 1.3, ease: 'easeOut' }, rotateX: { duration: 1.3, ease: 'easeOut' } } : { duration: 0 }}>
            <div className="relative h-full w-full" style={{ boxShadow: rise ? `0 40px 80px -30px rgba(0,0,0,.9), 0 0 60px -10px rgba(${m.rgb},.6)` : 'none', borderRadius: 14 }}>
              <InviteCard data={data} width={cardW} shine={false} />
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]">
                {free && <motion.div className="absolute -inset-y-1/4 w-1/3" style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.6), transparent)', skewX: -18 }}
                  initial={{ x: '-160%' }} animate={{ x: '420%' }} transition={{ delay: 0.45, duration: 1.05, ease: [0.6, 0.05, 0.3, 1] }} />}
              </div>
            </div>
          </motion.div>
        </div>

        {/* the front pocket */}
        <motion.svg className="absolute inset-0" width={envW} height={envH} viewBox={`0 0 ${envW} ${envH}`} style={{ zIndex: 4 }} aria-hidden
          initial={false} animate={{ opacity: free ? 0 : 1 }} transition={{ duration: 0.7, delay: free ? 0.2 : 0 }}>
          <defs>
            <linearGradient id={`lxo-edge-${loopKey ?? 0}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor={m.deep} /><stop offset=".35" stopColor={m.light} /><stop offset=".5" stopColor={m.pale} /><stop offset=".65" stopColor={m.light} /><stop offset="1" stopColor={m.deep} />
            </linearGradient>
            <linearGradient id={`lxo-lac-${loopKey ?? 0}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#17171a" /><stop offset="1" stopColor="#0a0a0c" />
            </linearGradient>
          </defs>
          <path d={`M1.5 ${envH * 0.32} L${envW / 2} ${envH * 0.68} L${envW - 1.5} ${envH * 0.32} L${envW - 1.5} ${envH - 12} Q${envW - 1.5} ${envH - 1.5} ${envW - 12} ${envH - 1.5} L12 ${envH - 1.5} Q1.5 ${envH - 1.5} 1.5 ${envH - 12} Z`} fill={`url(#lxo-lac-${loopKey ?? 0})`} />
          <path d={`M1.5 ${envH * 0.32} L${envW / 2} ${envH * 0.68} L${envW - 1.5} ${envH * 0.32}`} fill="none" stroke={`url(#lxo-edge-${loopKey ?? 0})`} strokeWidth="1.4" opacity=".9" />
          <path d={`M2 ${envH - 3} L${envW / 2} ${envH * 0.62} L${envW - 2} ${envH - 3}`} fill="none" stroke={`rgba(${m.rgb},.18)`} strokeWidth="1" />
        </motion.svg>
        {/* a light sweep across the lacquer while it waits */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[12px]" style={{ zIndex: 6, opacity: cracked ? 0 : 1, transition: 'opacity .3s' }}><span className="lxo-sweep" /></div>

        {/* the flap, foil-edged, swinging open */}
        <motion.div className="absolute inset-x-0 top-0" style={{ height: envH * 0.64, transformOrigin: '50% 0%', zIndex: opened ? 1 : 5, transformPerspective: 900 }}
          initial={false} animate={{ rotateX: opened ? 178 : 0, opacity: free ? 0 : 1 }} transition={{ rotateX: { duration: 0.7, ease: [0.5, 0, 0.2, 1] }, opacity: { duration: 0.5 } }}>
          <svg width={envW} height={envH * 0.64} viewBox={`0 0 ${envW} ${envH * 0.64}`} className="absolute inset-0" aria-hidden>
            <path d={`M1.5 10 Q1.5 1.5 10 1.5 L${envW - 10} 1.5 Q${envW - 1.5} 1.5 ${envW - 1.5} 10 L${envW / 2 + 16} ${envH * 0.62 - 9} Q${envW / 2} ${envH * 0.64} ${envW / 2 - 16} ${envH * 0.62 - 9} Z`} fill="#1a1a1e" />
            <path d={`M2 6 L${envW / 2 - 14} ${envH * 0.62 - 10} Q${envW / 2} ${envH * 0.635} ${envW / 2 + 14} ${envH * 0.62 - 10} L${envW - 2} 6`} fill="none" stroke={`url(#lxo-edge-${loopKey ?? 0})`} strokeWidth="1.6" />
          </svg>
        </motion.div>

        {/* the medallion seal: embossed initials in metal, a turning ring of light */}
        <div className="absolute left-1/2" style={{ top: envH * 0.62 - seal / 2, marginLeft: -seal / 2, width: seal, height: seal, zIndex: 7 }}>
          {!cracked && (
            <motion.span aria-hidden className="absolute rounded-full" style={{ inset: -seal * 0.22, border: `1px solid rgba(${m.lightRgb},.55)` }}
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0, 0.7] }} transition={{ duration: 2.2, repeat: Infinity, delay: 1 }} />
          )}
          {[0, 1].map(half => (
            <motion.div key={half} className="absolute inset-0" style={{ clipPath: half ? 'inset(0 0 0 50%)' : 'inset(0 50% 0 0)' }}
              initial={{ scale: 0, rotate: -60 }}
              animate={cracked ? { x: half ? seal * 0.9 : -seal * 0.9, y: seal * 0.5, rotate: half ? 70 : -70, opacity: 0, scale: 1 } : { scale: 1, rotate: 0, opacity: 1, x: 0, y: 0 }}
              transition={cracked ? { duration: 0.7, ease: [0.3, 0, 0.2, 1] } : { type: 'spring', stiffness: 200, damping: 13, delay: 0.55 }}>
              <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 210deg, ${m.deep}, ${m.light}, ${m.pale}, ${m.base}, ${m.deep}, ${m.light}, ${m.deep})`, boxShadow: `0 10px 24px -8px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.25)` }} />
              <div className="lxo-ring absolute rounded-full" style={{ inset: seal * 0.08, border: `1px dashed rgba(0,0,0,.35)` }} />
              <div className="absolute grid place-items-center rounded-full" style={{ inset: seal * 0.16, background: `radial-gradient(circle at 35% 30%, ${m.light}, ${m.base} 55%, ${m.deep})`, boxShadow: 'inset 0 2px 4px rgba(255,255,255,.35), inset 0 -3px 6px rgba(0,0,0,.35)' }}>
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: seal * 0.28, color: mix(m.deep, '#000000', 0.35), textShadow: `0 1px 0 rgba(255,255,255,.45)`, letterSpacing: 1 }}>{initialsOf(hostName)}</span>
              </div>
            </motion.div>
          ))}
          {/* shockwave */}
          {cracked && (
            <motion.span aria-hidden className="absolute inset-0 rounded-full" style={{ border: `2px solid ${m.pale}` }}
              initial={{ scale: 0.6, opacity: 0.95 }} animate={{ scale: 7, opacity: 0 }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          )}
          {cracked && (
            <motion.span aria-hidden className="absolute rounded-full" style={{ inset: -seal * 0.5, background: `radial-gradient(circle, rgba(${m.paleRgb},.95), rgba(${m.lightRgb},.35) 35%, transparent 65%)` }}
              initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
          )}
          {/* the burst of foil */}
          {cracked && burst.map((b, i) => (
            <motion.span key={i} aria-hidden className="absolute left-1/2 top-1/2" style={{ width: b.s, height: b.diamond ? b.s : b.s * 0.55, marginLeft: -b.s / 2, marginTop: -b.s / 2,
              background: i % 4 === 0 ? m.pale : i % 4 === 1 ? m.light : i % 4 === 2 ? m.base : foil, borderRadius: b.diamond ? 1 : 2, transform: b.diamond ? 'rotate(45deg)' : undefined }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{ x: b.x, y: [0, b.y, b.y + envH * 0.5], opacity: [1, 1, 0], rotate: b.r, scale: [1, 1, 0.5] }}
              transition={{ duration: 1.6, delay: b.delay, ease: [0.15, 0.6, 0.35, 1], times: [0, 0.55, 1] }} />
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {phase === 'idle' && (
          <motion.p key="hint" className="pointer-events-none absolute inset-x-0 text-center font-black uppercase" style={{ top: envTop + envH + (frame ? 14 : 44) * scale, fontSize: Math.max(7, 10.5 * scale), letterSpacing: '0.34em', color: `rgba(${m.lightRgb},.7)` }}
            initial={{ opacity: 0 }} animate={{ opacity: [0.35, 1, 0.35] }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 2, repeat: Infinity, delay: 1.2 }}>
            Tap to open
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
