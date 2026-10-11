'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, Monitor, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react'
import HeroMedia, { DEFAULT_FRAME, placePhoto } from '@/components/property-sites/spotlight/HeroMedia'
import type { HeaderMode, HeaderMotion, HeroFrame } from '@/components/property-sites/spotlight/model'

// "Frame your photo" in the Spotlight editor's Header step: the whole photo with the part a
// computer and a phone will show, a dot to drag onto the home (that spot stays centered and the
// slow zoom runs around it), how far the zoom travels, and both headers playing live. The MLS
// badge corner is handled automatically (see placePhoto) - shown here so the agent knows.

const DESKTOP = { W: 1600, H: 1000 }
const PHONE = { W: 390, H: 760 }
const ZOOMS: { v: number; label: string }[] = [
  { v: 1.06, label: 'Subtle' },
  { v: 1.12, label: 'Medium' },
  { v: 1.2, label: 'Strong' },
]

export default function HeroFramer({ photo, frame, onChange, motion: mo, mode }: {
  photo: string
  frame: HeroFrame | null
  onChange: (next: HeroFrame | null) => void
  motion: HeaderMotion
  mode: HeaderMode
}) {
  const f = { ...DEFAULT_FRAME, ...(frame || {}) }
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

  // Replay the previews a moment after the framing settles.
  const settle = useRef<number>(0)
  useEffect(() => {
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => setReplay(r => r + 1), 350)
    return () => window.clearTimeout(settle.current)
  }, [f.x, f.y, f.zoom])

  const windowOf = (W: number, H: number) => {
    if (!nat) return null
    const p = placePhoto(W, H, nat.w, nat.h, f.x / 100, f.y / 100)
    const u0 = -p.L / (nat.w * p.k), v0 = -p.T / (nat.h * p.k)
    return { left: u0 * 100, top: v0 * 100, width: (W / (nat.w * p.k)) * 100, height: (H / (nat.h * p.k)) * 100 }
  }
  const desk = windowOf(DESKTOP.W, DESKTOP.H)
  const phone = windowOf(PHONE.W, PHONE.H)

  const setFrom = (clientX: number, clientY: number) => {
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return
    const x = Math.round(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)))
    const y = Math.round(Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)))
    onChange({ ...f, x, y })
  }
  const frameMoved = useRef(0)
  const move = (e: React.PointerEvent) => {
    if (!dragging) return
    const { clientX, clientY } = e
    if (!frameMoved.current) frameMoved.current = requestAnimationFrame(() => { frameMoved.current = 0; setFrom(clientX, clientY) })
  }

  const centered = Math.abs(f.x - 50) < 1 && Math.abs(f.y - 50) < 1

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#151517]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]"><Crosshair className="h-3.5 w-3.5" /> Frame your photo</p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Drag the dot onto the home - it stays in view and the zoom moves around it.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => onChange(frame ? { ...f, x: 50, y: 50 } : null)} disabled={centered}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500 transition hover:border-[#C9A24D] hover:text-[#111827] disabled:opacity-40 dark:border-white/10 dark:text-gray-300">
            <Crosshair className="h-3 w-3" /> Center it
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => setReplay(r => r + 1)}
            className="inline-flex items-center gap-1 rounded-full bg-[#111827] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827]">
            <RotateCcw className="h-3 w-3" /> Play again
          </motion.button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* the whole photo: what each screen shows, and the dot */}
        <div>
          <div ref={boxRef}
            className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
            style={{ aspectRatio: nat ? `${nat.w} / ${nat.h}` : '4 / 3' }}
            onPointerDown={e => { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); setDragging(true); setFrom(e.clientX, e.clientY) }}
            onPointerMove={move}
            onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
            <img src={photo} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
            {desk && (
              <span className="pointer-events-none absolute rounded-[3px] border-2 border-white shadow-[0_0_0_9999px_rgba(10,10,12,.55)] transition-all duration-200"
                style={{ left: `${desk.left}%`, top: `${desk.top}%`, width: `${desk.width}%`, height: `${desk.height}%` }}>
                <span className="absolute -top-px left-1.5 -translate-y-full rounded-t bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#111827]"><Monitor className="mr-0.5 inline h-2.5 w-2.5" />Computer</span>
              </span>
            )}
            {phone && (
              <span className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-[#e8c97a] transition-all duration-200"
                style={{ left: `${phone.left}%`, top: `${phone.top}%`, width: `${phone.width}%`, height: `${phone.height}%` }}>
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#e8c97a] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#111827]"><Smartphone className="mr-0.5 inline h-2.5 w-2.5" />Phone</span>
              </span>
            )}
            {/* the MLS badge corner - always kept off screen */}
            <span className="pointer-events-none absolute bottom-0 left-0 flex items-end p-1" style={{ width: '18%', height: '10%', backgroundImage: 'repeating-linear-gradient(45deg, rgba(239,68,68,.35) 0 4px, transparent 4px 8px)' }}>
              <span className="whitespace-nowrap rounded bg-red-500 px-1 text-[8px] font-black uppercase text-white">MLS badge</span>
            </span>
            <motion.span className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              animate={{ left: `${f.x}%`, top: `${f.y}%`, scale: dragging ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 600, damping: 40 }}>
              <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#C9A24D]/40" />
              <span className="relative grid h-7 w-7 place-items-center rounded-full border-[3px] border-white bg-[#C9A24D] shadow-lg"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>
            </motion.span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> The Bright MLS badge in the corner is kept off screen automatically, with as little crop as possible.
          </p>
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">How much it zooms {mo === 'none' ? '(no movement picked)' : ''}</p>
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

        {/* both headers, playing */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400"><Monitor className="h-3 w-3" /> Computer</p>
            <div className="relative overflow-hidden rounded-lg bg-black shadow" style={{ aspectRatio: `${DESKTOP.W} / ${DESKTOP.H}` }}>
              <HeroMedia key={`d${replay}`} hero={photo} photos={[]} mode="photo" motion={mo} frame={f} alt="" />
            </div>
          </div>
          <div className="w-[34%] max-w-[120px] shrink-0">
            <p className="mb-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-400"><Smartphone className="h-3 w-3" /> Phone</p>
            <div className="relative overflow-hidden rounded-xl bg-black shadow ring-2 ring-[#111827] dark:ring-white/20" style={{ aspectRatio: `${PHONE.W} / ${PHONE.H}` }}>
              <HeroMedia key={`p${replay}`} hero={photo} photos={[]} mode="photo" motion={mo} frame={f} alt="" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
