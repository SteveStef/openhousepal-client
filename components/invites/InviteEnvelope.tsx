'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { initialsOf, mix, onAccent } from '@/lib/invites'
import InviteCard, { CARD_H, CARD_W, type InviteCardData } from './InviteCard'
import { SERIF } from './inviteFonts'

// Opening the invitation, like a real one: a sealed envelope floats in, the wax seal (the agent's
// initials) pops, the flap swings open and the card slides up out of it - then the page takes over.
// Tap to open, or it opens by itself after a moment. Only transforms and opacity animate (no blur),
// so it stays smooth on older phones. Skipped for people with "reduce motion" on.

type Phase = 'idle' | 'seal' | 'flap' | 'rise' | 'out'

export default function InviteEnvelope({ data, hostName, stageBg, onOpened, autoMs = 1700, frame, loopKey }: {
  data: InviteCardData
  hostName?: string | null
  /** The page colour behind the envelope. */
  stageBg: string
  onOpened: () => void
  autoMs?: number
  /** Play inside a box this size (the builder's animation preview) instead of over the screen. */
  frame?: { w: number; h: number }
  loopKey?: number
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [w, setW] = useState(frame ? Math.round(frame.w * 0.8) : 340)
  const [vh, setVh] = useState(frame ? frame.h : 844)
  const done = useRef(false)
  const timers = useRef<number[]>([])
  const accent = data.accent_color || '#C9A24D'
  const dark = data.design === 'midnight'
  const paper = dark ? '#1b202b' : mix(accent, '#ffffff', 0.84)
  const paperDeep = dark ? '#151922' : mix(accent, '#ffffff', 0.72)
  const liner = dark ? mix(accent, '#000000', 0.35) : mix(accent, '#ffffff', 0.45)

  useEffect(() => {
    done.current = false
    setPhase('idle')
    if (frame) {
      setW(Math.round(frame.w * 0.8)); setVh(frame.h)
      const t = window.setTimeout(open, autoMs)
      return () => { window.clearTimeout(t); timers.current.forEach(x => window.clearTimeout(x)); timers.current = [] }
    }
    // Bigger on a computer - the envelope is the whole stage there, not a phone graphic.
    const fit = () => { setW(Math.min(window.innerWidth - 40, window.innerWidth >= 1024 ? 480 : 380)); setVh(window.innerHeight) }
    fit()
    window.addEventListener('resize', fit)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return () => window.removeEventListener('resize', fit) }
    // ?tap = wait for a tap (screenshots / a slow walkthrough); otherwise it opens by itself.
    const t = new URLSearchParams(window.location.search).has('tap') ? 0 : window.setTimeout(open, autoMs)
    return () => { window.clearTimeout(t); window.removeEventListener('resize', fit); timers.current.forEach(x => window.clearTimeout(x)); timers.current = [] }
  }, [loopKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    if (done.current) return
    done.current = true
    onOpened()
  }
  function open() {
    setPhase(p => {
      if (p !== 'idle') return p
      timers.current.push(window.setTimeout(() => setPhase('flap'), 280))
      timers.current.push(window.setTimeout(() => setPhase('rise'), 820))
      timers.current.push(window.setTimeout(() => setPhase('out'), 1750))
      timers.current.push(window.setTimeout(finish, 2150))
      return 'seal'
    })
  }

  const envW = w
  const envH = Math.round(w * 0.66)
  const cardW = Math.round(envW * 0.86)
  const cardH = Math.round(cardW * (CARD_H / CARD_W))
  const opened = phase === 'flap' || phase === 'rise' || phase === 'out'
  const rise = phase === 'rise' || phase === 'out'
  // How far the card lifts so it ends up near the top of the screen, whatever its size: the
  // envelope starts centred (a little above, for the line under it) and drops by 0.55 of its height.
  const envTop = (vh - envH) / 2 - (frame ? 10 : 40)
  const seal = Math.max(frame ? 30 : 60, Math.round(envW * 0.15))
  const liftTo = Math.min(-cardH * 0.6, (frame ? 8 : 28) - envTop - envH * 1.19)

  return (
    <motion.div className={`${frame ? 'absolute' : 'fixed'} inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden`} style={{ background: stageBg }}
      initial={{ opacity: 1 }} animate={{ opacity: phase === 'out' ? 0 : 1 }} transition={{ duration: 0.4, delay: phase === 'out' ? 0.05 : 0 }}
      onClick={open} role="button" aria-label="Open the invitation" data-testid="invite-envelope">
      {/* a soft spotlight - a gradient, not a blur */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 45% at 50% 48%, ${dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.75)'} 0%, transparent 70%)` }} />

      <motion.div className="relative" style={{ width: envW, height: envH, perspective: 1200 }}
        initial={{ y: 60, opacity: 0, rotate: -3, scale: 0.92 }}
        animate={rise ? { y: envH * 0.55, opacity: 1, rotate: 0, scale: 1 } : { y: [0, -6, 0], opacity: 1, rotate: 0, scale: 1 }}
        transition={rise ? { type: 'spring', stiffness: 120, damping: 20 } : { y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.5 }, rotate: { type: 'spring', stiffness: 140, damping: 14 }, scale: { type: 'spring', stiffness: 140, damping: 14 } }}>

        {/* back of the envelope + its liner */}
        <div className="absolute inset-0 rounded-[10px]" style={{ background: paperDeep, boxShadow: '0 40px 70px -35px rgba(0,0,0,.55)' }} />
        <div className="absolute inset-x-[6px] top-[6px] rounded-t-[8px]" style={{ height: envH * 0.6, background: `repeating-linear-gradient(45deg, ${liner} 0 6px, ${mix(liner, '#ffffff', 0.2)} 6px 12px)`, opacity: 0.55 }} />

        {/* the card, tucked inside, then rising out */}
        {/* clipped only at the envelope's bottom edge, so the card's lower half stays inside the
            envelope until it rises out of the top */}
        <div className="pointer-events-none absolute overflow-hidden" style={{ left: -400, right: -400, bottom: 0, top: -3000, zIndex: 3 }}>
          <motion.div className="absolute left-1/2" style={{ width: cardW, height: cardH, marginLeft: -cardW / 2, top: 3000 + envH * 0.64 }}
            initial={false} animate={rise ? { y: liftTo, scale: 1.04 } : { y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 90, damping: 17, mass: 0.9 }}>
            <InviteCard data={data} width={cardW} shine={false} />
          </motion.div>
        </div>

        {/* front pocket (the V) */}
        <svg className="absolute inset-0" width={envW} height={envH} viewBox={`0 0 ${envW} ${envH}`} style={{ zIndex: 4 }} aria-hidden>
          <path d={`M0 ${envH * 0.3} L${envW / 2} ${envH * 0.66} L${envW} ${envH * 0.3} L${envW} ${envH - 10} Q${envW} ${envH} ${envW - 10} ${envH} L10 ${envH} Q0 ${envH} 0 ${envH - 10} Z`} fill={paper} />
          <path d={`M0 ${envH - 2} L${envW / 2} ${envH * 0.58} L${envW} ${envH - 2}`} fill="none" stroke={dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'} strokeWidth="1.5" />
        </svg>

        {/* the flap - swings open on its top edge */}
        <motion.div className="absolute inset-x-0 top-0" style={{ height: envH * 0.62, transformOrigin: '50% 0%', zIndex: opened ? 1 : 5, transformStyle: 'preserve-3d' }}
          initial={false} animate={{ rotateX: opened ? 178 : 0 }} transition={{ duration: 0.55, ease: [0.45, 0, 0.2, 1] }}>
          <svg width={envW} height={envH * 0.62} viewBox={`0 0 ${envW} ${envH * 0.62}`} className="absolute inset-0" aria-hidden>
            <path d={`M0 6 Q0 0 8 0 L${envW - 8} 0 Q${envW} 0 ${envW} 6 L${envW / 2 + 14} ${envH * 0.6 - 8} Q${envW / 2} ${envH * 0.62} ${envW / 2 - 14} ${envH * 0.6 - 8} Z`} fill={mix(paper, dark ? '#000000' : '#ffffff', 0.06)} />
            <path d={`M2 4 L${envW / 2} ${envH * 0.6} L${envW - 2} 4`} fill="none" stroke={dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)'} strokeWidth="1" />
          </svg>
        </motion.div>

        {/* the wax seal */}
        <AnimatePresence>
          {(phase === 'idle' || phase === 'seal') && (
            <motion.div key="seal" className="absolute left-1/2 grid place-items-center" style={{ top: envH * 0.6 - seal / 2, marginLeft: -seal / 2, width: seal, height: seal, zIndex: 7 }}
              initial={{ scale: 0, rotate: -40 }} animate={phase === 'seal' ? { scale: 1.35, opacity: 0, rotate: 12 } : { scale: 1, rotate: 0, opacity: 1 }}
              exit={{ opacity: 0 }} transition={phase === 'seal' ? { duration: 0.28, ease: 'easeOut' } : { type: 'spring', stiffness: 260, damping: 14, delay: 0.35 }}>
              <svg viewBox="0 0 60 60" className="absolute inset-0" aria-hidden>
                <path d="M30 2c4 0 5 3 8 4s6-1 8 2 0 6 2 8 5 3 5 7-3 5-3 8 3 5 1 8-6 2-8 4-1 6-5 7-5-2-8-2-4 3-8 2-3-4-6-5-6 1-7-3 1-6-1-8-5-3-5-7 3-5 3-8-3-5-1-8 6-2 8-4 1-6 4-7 5 1 8 0 4-4 8-4z" fill={accent} />
                <circle cx="30" cy="30" r="19" fill="none" stroke={mix(accent, '#000000', 0.25)} strokeWidth="1.2" opacity=".6" />
                <circle cx="24" cy="21" r="7" fill="#ffffff" opacity=".18" />
              </svg>
              <span className="relative" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: seal * 0.3, color: onAccent(accent), letterSpacing: 0.5 }}>{initialsOf(hostName)}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* a little burst when it opens */}
        {opened && Array.from({ length: 14 }).map((_, i) => {
          const ang = (i / 14) * Math.PI * 2
          return (
            <motion.span key={i} aria-hidden className="absolute left-1/2 rounded-full" style={{ top: envH * 0.3, width: i % 3 ? 5 : 7, height: i % 3 ? 5 : 7, background: i % 2 ? accent : (dark ? '#ffffff' : mix(accent, '#ffffff', 0.4)), zIndex: 8 }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(ang) * (envW * 0.55), y: Math.sin(ang) * (envH * 0.7) - 30, opacity: 0, scale: 0.4 }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }} />
          )
        })}
      </motion.div>

      <motion.p className={`relative text-center font-black uppercase ${frame ? "mt-4 text-[7px] tracking-[0.24em]" : "mt-12 text-[11px] tracking-[0.32em]"}`} style={{ color: dark ? 'rgba(255,255,255,.7)' : 'rgba(17,24,39,.55)' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: phase === 'idle' ? [0.45, 1, 0.45] : 0, y: 0 }}
        transition={phase === 'idle' ? { opacity: { duration: 1.8, repeat: Infinity }, y: { delay: 0.5 } } : { duration: 0.2 }}>
        {hostName ? `From ${hostName} · tap to open` : 'Tap to open'}
      </motion.p>
    </motion.div>
  )
}
