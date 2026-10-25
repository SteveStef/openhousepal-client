'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, HelpCircle, RotateCcw, X } from 'lucide-react'
import { accentOf, mix, onAccent } from '@/lib/invites'
import InviteCard, { type InviteCardData } from './InviteCard'
import InviteEnvelope from './InviteEnvelope'
import InviteLuxeOpening, { foilOf, metalOfInvite } from './InviteLuxeOpening'
import { SERIF } from './inviteFonts'

// The builder's little animation preview (user, 10/24: "when picking the colour, show a small
// preview of the animation - from the envelope, to it opening, to the actual page - so they see
// how the colour looks animated"). A phone-shaped window that plays the real opening (Normal or
// Luxe) at preview size, then the page it lands on, then starts again. Replays whenever the
// colour / design / animation changes.

export const pageBg = (design: string) => (design === 'midnight' ? '#090b10' : design === 'garden' ? '#eceadf' : design === 'modern' ? '#efefec' : '#efe8db')

export default function InviteMotionPreview({ data, hostName, width = 184 }: { data: InviteCardData; hostName?: string | null; width?: number }) {
  const h = Math.round(width * 1.86)
  const [loop, setLoop] = useState(0)
  const [stage, setStage] = useState<'opening' | 'page'>('opening')
  const timer = useRef<number | null>(null)
  const key = `${data.design}|${data.accent_color}|${data.luxe_metal}|${data.motion}|${data.cover_image_url}`
  // Something changed - play it from the top.
  useEffect(() => { setStage('opening'); setLoop(n => n + 1) }, [key])
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  const opened = () => {
    setStage('page')
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { setStage('opening'); setLoop(n => n + 1) }, 3200)
  }
  const luxe = data.motion === 'luxe'
  const replay = () => { if (timer.current) window.clearTimeout(timer.current); setStage('opening'); setLoop(n => n + 1) }
  return (
    <div className="flex flex-col items-center" data-testid="invite-motion-preview">
      <div className="relative overflow-hidden rounded-[26px] bg-black p-[5px] shadow-[0_26px_50px_-24px_rgba(0,0,0,.75)] ring-1 ring-black/10 dark:ring-white/10" style={{ width: width + 10, isolation: "isolate" }}>
        <div className="relative overflow-hidden rounded-[21px]" style={{ width, height: h, background: luxe ? "#050506" : pageBg(data.design), WebkitMaskImage: "-webkit-radial-gradient(white, black)", isolation: "isolate" }}>
          <span aria-hidden className="absolute left-1/2 top-1.5 z-[90] h-[5px] w-12 -translate-x-1/2 rounded-full bg-black/80" />
          <AnimatePresence mode="wait" initial={false}>
            {stage === 'opening' ? (
              <motion.div key={`o${loop}`} className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {luxe
                  ? <InviteLuxeOpening data={data} hostName={hostName} onOpened={opened} frame={{ w: width, h }} loopKey={loop} autoMs={1500} />
                  : <InviteEnvelope data={data} hostName={hostName} stageBg={pageBg(data.design)} onOpened={opened} frame={{ w: width, h }} loopKey={loop} autoMs={1100} />}
              </motion.div>
            ) : (
              <motion.div key={`p${loop}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                <MiniPage data={data} width={width} luxe={luxe} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <button type="button" onClick={replay} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[10px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">
        <RotateCcw className="h-3 w-3" /> Play again
      </button>
    </div>
  )
}

/** The page the guest lands on, in miniature: the card, then the RSVP. */
function MiniPage({ data, width, luxe }: { data: InviteCardData; width: number; luxe: boolean }) {
  const a = accentOf(data.accent_color)
  const dark = luxe || data.design === 'midnight'
  const m = metalOfInvite(data)
  const foil = foilOf(m)
  const s = width / 184
  const ink = dark ? '#f3efe6' : '#1f1b16'
  const btn = luxe ? { background: foil, color: '#17140f' } : { background: a, color: onAccent(a) }
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: luxe ? '#050506' : pageBg(data.design) }}>
      {luxe && <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(70% 40% at 30% 10%, rgba(${m.rgb},.35), transparent 70%), radial-gradient(60% 40% at 80% 90%, rgba(${m.lightRgb},.18), transparent 70%)` }} />}
      <motion.div className="relative mx-auto" style={{ width: width * 0.66, marginTop: 22 * s }}
        initial={{ y: -20, scale: 0.92, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 150, damping: 18 }}>
        <div style={{ boxShadow: luxe ? `0 14px 30px -12px rgba(${m.rgb},.6)` : '0 14px 28px -16px rgba(0,0,0,.5)', borderRadius: 8 }}>
          <InviteCard data={data} width={Math.round(width * 0.66)} shine={false} />
        </div>
      </motion.div>
      <motion.div className="relative mx-3 rounded-2xl p-2.5" style={{ marginTop: 10 * s, background: dark ? 'rgba(255,255,255,.06)' : '#ffffff', border: `1px solid ${luxe ? `rgba(${m.rgb},.45)` : mix(a, dark ? '#000000' : '#ffffff', 0.4)}` }}
        initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 160, damping: 20 }}>
        <p className="text-[7px] font-black uppercase tracking-[0.24em]" style={luxe ? { backgroundImage: foil, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: a }}>RSVP</p>
        <p style={{ fontFamily: SERIF, fontSize: 12 * s, fontWeight: 700, color: ink, fontStyle: luxe ? 'italic' : 'normal' }}>Will you be there?</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {[Check, HelpCircle, X].map((Icon, i) => (
            <motion.span key={i} className="grid h-6 place-items-center rounded-lg" style={i === 0 ? btn : { background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)', color: ink }}
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}>
              <Icon className="h-3 w-3" strokeWidth={3} />
            </motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
