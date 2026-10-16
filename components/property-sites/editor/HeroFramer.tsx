'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Crosshair, Monitor, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react'
import HeroMedia, { DEFAULT_FRAME, placePhoto, spotFor } from '@/components/property-sites/spotlight/HeroMedia'
import type { HeaderMode, HeaderMotion, HeroFrame } from '@/components/property-sites/spotlight/model'

// "Frame your photo" in the Spotlight editor's Header step. A computer header is wide and a phone
// header is tall, so one spot rarely suits both (user, 10/15): a Computer tab and a Phone tab,
// each with the whole photo, the part that screen shows, and a dot to drag onto the home (that
// spot stays centered and the slow zoom runs around it). The agent has to pick both - each tab
// says "Needs you" until it's set (frameIsSet). Both headers play live beside it. The MLS badge
// corner is handled automatically (see placePhoto) - shown here so the agent knows.

const DESKTOP = { W: 1600, H: 1000 }
const PHONE = { W: 390, H: 760 }
const ZOOMS: { v: number; label: string }[] = [
  { v: 1.06, label: 'Subtle' },
  { v: 1.12, label: 'Medium' },
  { v: 1.2, label: 'Strong' },
]
type Device = 'desk' | 'phone'

/** Both spots picked - the editor won't leave the Header step (or publish) until they are. */
export function frameIsSet(frame: HeroFrame | null | undefined) {
  return !!frame?.desk_set && !!frame?.phone_set
}

export default function HeroFramer({ photo, frame, onChange, motion: mo, nudge = 0 }: {
  photo: string
  frame: HeroFrame | null
  onChange: (next: HeroFrame | null) => void
  motion: HeaderMotion
  mode: HeaderMode
  /** Bumped by the editor when they try to move on without both spots - the tabs nudge. */
  nudge?: number
}) {
  const f: HeroFrame = { ...DEFAULT_FRAME, ...(frame || {}) }
  const [device, setDevice] = useState<Device>(frame?.desk_set && !frame?.phone_set ? 'phone' : 'desk')
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [replay, setReplay] = useState(0)
  const [dragging, setDragging] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNat(null)
    const img = new Image()
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = photo
  }, [photo])

  const spot = spotFor(f, device === 'phone')
  // Replay the previews a moment after the framing settles.
  const settle = useRef<number>(0)
  useEffect(() => {
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => setReplay(r => r + 1), 350)
    return () => window.clearTimeout(settle.current)
  }, [f.x, f.y, f.px, f.py, f.zoom])

  const size = device === 'phone' ? PHONE : DESKTOP
  const win = (() => {
    if (!nat) return null
    const p = placePhoto(size.W, size.H, nat.w, nat.h, spot.x / 100, spot.y / 100)
    const u0 = -p.L / (nat.w * p.k), v0 = -p.T / (nat.h * p.k)
    return { left: u0 * 100, top: v0 * 100, width: (size.W / (nat.w * p.k)) * 100, height: (size.H / (nat.h * p.k)) * 100 }
  })()

  // Moving the dot on a tab picks that screen's spot. The phone follows the computer until the
  // agent gives it its own.
  const setSpot = (x: number, y: number) => {
    if (device === 'phone') onChange({ ...f, px: x, py: y, phone_set: true })
    else onChange({ ...f, x, y, desk_set: true, ...(f.phone_set ? {} : { px: x, py: y }) })
  }
  const setFrom = (clientX: number, clientY: number) => {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return
    setSpot(
      Math.round(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100))),
      Math.round(Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100))),
    )
  }
  const frameMoved = useRef(0)
  const move = (e: React.PointerEvent) => {
    if (!dragging) return
    const { clientX, clientY } = e
    if (!frameMoved.current) frameMoved.current = requestAnimationFrame(() => { frameMoved.current = 0; setFrom(clientX, clientY) })
  }
  const confirmSpot = () => {
    setSpot(spot.x, spot.y)
    if (device === 'desk' && !f.phone_set) window.setTimeout(() => setDevice('phone'), 380)
  }

  const isSet = device === 'phone' ? !!f.phone_set : !!f.desk_set
  const centered = Math.abs(spot.x - 50) < 1 && Math.abs(spot.y - 50) < 1
  const tabs: { id: Device; label: string; icon: typeof Monitor; set: boolean }[] = [
    { id: 'desk', label: 'Computer', icon: Monitor, set: !!f.desk_set },
    { id: 'phone', label: 'Phone', icon: Smartphone, set: !!f.phone_set },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#151517]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]"><Crosshair className="h-3.5 w-3.5" /> Frame your photo</p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Set the center for a computer <b>and</b> a phone - drag the dot onto the home on each tab.</p>
        </div>
        <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => setReplay(r => r + 1)}
          className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827]">
          <RotateCcw className="h-3 w-3" /> Play again
        </motion.button>
      </div>

      {/* Computer / Phone - each says whether it's set */}
      <motion.div key={nudge} role="tablist" aria-label="Which screen" animate={nudge ? { x: [0, -9, 9, -6, 6, 0] } : undefined} transition={{ duration: 0.45 }}
        className={`mb-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06] ${nudge && !frameIsSet(frame) ? 'ring-2 ring-[#C9A24D]' : ''}`}>
        {tabs.map(t => {
          const on = device === t.id
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setDevice(t.id)}
              className={`relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-black transition-colors ${on ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
              {on && <motion.span layoutId="hf-device" className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <t.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{t.label}</span>
              <AnimatePresence mode="wait" initial={false}>
                {t.set ? (
                  <motion.span key="set" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                    className="relative inline-flex items-center gap-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /> Set</motion.span>
                ) : (
                  <motion.span key="need" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="relative rounded-full bg-[#C9A24D]/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#8b6a2b] dark:text-[#e8c97a]">Needs you</motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </motion.div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* the whole photo: what this screen shows, and the dot */}
        <div>
          <div ref={boxRef}
            className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
            style={{ aspectRatio: nat ? `${nat.w} / ${nat.h}` : '4 / 3' }}
            onPointerDown={e => { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); setDragging(true); setFrom(e.clientX, e.clientY) }}
            onPointerMove={move}
            onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
            <img src={photo} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
            {win && (
              <span className={`pointer-events-none absolute rounded-[3px] border-2 shadow-[0_0_0_9999px_rgba(10,10,12,.55)] transition-all duration-200 ${device === 'phone' ? 'border-[#e8c97a]' : 'border-white'}`}
                style={{ left: `${win.left}%`, top: `${win.top}%`, width: `${win.width}%`, height: `${win.height}%` }}>
                <span className={`absolute -top-px left-1.5 -translate-y-full whitespace-nowrap rounded-t px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#111827] ${device === 'phone' ? 'bg-[#e8c97a]' : 'bg-white'}`}>
                  {device === 'phone' ? <Smartphone className="mr-0.5 inline h-2.5 w-2.5" /> : <Monitor className="mr-0.5 inline h-2.5 w-2.5" />}{device === 'phone' ? 'Phone shows this' : 'Computer shows this'}
                </span>
              </span>
            )}
            {/* the MLS badge corner - always kept off screen */}
            <span className="pointer-events-none absolute bottom-0 left-0 flex items-end p-1" style={{ width: '18%', height: '10%', backgroundImage: 'repeating-linear-gradient(45deg, rgba(239,68,68,.35) 0 4px, transparent 4px 8px)' }}>
              <span className="whitespace-nowrap rounded bg-red-500 px-1 text-[8px] font-black uppercase text-white">MLS badge</span>
            </span>
            <motion.span className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              animate={{ left: `${spot.x}%`, top: `${spot.y}%`, scale: dragging ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 600, damping: 40 }}>
              {!isSet && <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#C9A24D]/40" />}
              <span className={`relative grid h-7 w-7 place-items-center rounded-full border-[3px] border-white shadow-lg ${isSet ? 'bg-emerald-500' : 'bg-[#C9A24D]'}`}>
                {isSet ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
            </motion.span>
          </div>

          {/* set this screen's spot */}
          <div className={`mt-2.5 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${isSet ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10' : 'border-[#C9A24D]/40 bg-[#fffaf0] dark:bg-[#1a1712]'}`}>
            <p className={`min-w-0 flex-1 text-[11.5px] font-bold ${isSet ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#8b6a2b] dark:text-[#e8c97a]'}`}>
              {isSet ? `${device === 'phone' ? 'Phone' : 'Computer'} center is set. Drag the dot any time to change it.`
                : `Drag the dot onto the home for a ${device === 'phone' ? 'phone' : 'computer'} - or keep it where it is.`}
            </p>
            {!isSet && (
              <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={confirmSpot}
                className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-white transition hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827]">
                <Check className="h-3 w-3" strokeWidth={3} /> Use this spot
              </motion.button>
            )}
            <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => setSpot(50, 50)} disabled={centered && isSet}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500 transition hover:border-[#C9A24D] hover:text-[#111827] disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-gray-300">
              <Crosshair className="h-3 w-3" /> Center it
            </motion.button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> The Bright MLS badge in the corner is kept off screen automatically, with as little crop as possible.
          </p>
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">How much it zooms {mo === 'none' ? '(no movement picked)' : '(both screens)'}</p>
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]">
              {ZOOMS.map(z => {
                const on = Math.abs(f.zoom - z.v) < 0.005
                return (
                  <button key={z.v} type="button" onClick={() => onChange({ ...f, zoom: z.v })} disabled={mo === 'none'}
                    className={`relative flex-1 rounded-lg py-1.5 text-[11px] font-black transition-colors disabled:opacity-40 ${on ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                    {on && <motion.span layoutId="hf-zoom" className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <span className="relative">{z.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* both headers, playing - the one being framed is lit up */}
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => setDevice('desk')} className={`min-w-0 flex-1 text-left transition-opacity ${device === 'desk' ? '' : 'opacity-60 hover:opacity-100'}`}>
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400"><Monitor className="h-3 w-3" /> Computer {f.desk_set && <Check className="h-3 w-3 text-emerald-500" strokeWidth={3} />}</p>
            <div className={`relative overflow-hidden rounded-lg bg-black shadow transition ${device === 'desk' ? 'ring-2 ring-[#C9A24D]' : ''}`} style={{ aspectRatio: `${DESKTOP.W} / ${DESKTOP.H}` }}>
              <HeroMedia key={`d${replay}`} hero={photo} photos={[]} mode="photo" motion={mo} frame={f} alt="" />
            </div>
          </button>
          <button type="button" onClick={() => setDevice('phone')} className={`w-[34%] max-w-[120px] shrink-0 text-left transition-opacity ${device === 'phone' ? '' : 'opacity-60 hover:opacity-100'}`}>
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400"><Smartphone className="h-3 w-3" /> Phone {f.phone_set && <Check className="h-3 w-3 text-emerald-500" strokeWidth={3} />}</p>
            <div className={`relative overflow-hidden rounded-xl bg-black shadow ring-2 transition ${device === 'phone' ? 'ring-[#C9A24D]' : 'ring-[#111827] dark:ring-white/20'}`} style={{ aspectRatio: `${PHONE.W} / ${PHONE.H}` }}>
              <HeroMedia key={`p${replay}`} hero={photo} photos={[]} mode="photo" motion={mo} frame={f} alt="" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
