'use client'

import { useRef, useState } from 'react'
import { Eraser, Undo2 } from 'lucide-react'

// "Circle what to remove" (AI Media -> Enhance -> Remove cars / Remove furniture). The agent
// draws a loop around each thing that should go, with a finger or the mouse. The AI only edits
// inside those loops, and the original photo is pasted back everywhere else (backend
// studio_media_service._masked_removal_pass) - so nothing outside them (a garage door opener,
// trim, a light) can change. Shapes are stored as fractions of the photo (0-1), so they fit the
// real photo at any size. Optional: with no circles, removal works as before (AI finds them).
export type RemoveAreas = number[][][]

export default function RemoveAreaPainter({ photoUrl, value, onChange }: {
  photoUrl: string
  value: RemoveAreas
  onChange: (next: RemoveAreas) => void
}) {
  const [live, setLive] = useState<number[][] | null>(null)
  const drawing = useRef(false)

  const at = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    setLive([at(e)])
  }
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return
    const p = at(e)
    setLive(prev => {
      if (!prev) return [p]
      const last = prev[prev.length - 1]
      return Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.006 ? prev : [...prev, p]
    })
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    const shape = live || []
    setLive(null)
    if (shape.length < 6) return // a tap, not a circle
    const step = Math.max(1, Math.ceil(shape.length / 150))
    onChange([...value, shape.filter((_, i) => i % step === 0)].slice(-12))
  }
  const pts = (shape: number[][]) => shape.map(([x, y]) => `${(x * 100).toFixed(2)},${(y * 100).toFixed(2)}`).join(' ')

  return (
    <div className="rounded-2xl border-2 border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/[0.05] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-[#111827] dark:text-white">Remove large objects - circle them <span className="font-semibold text-gray-400">(car, chairs, furniture · optional, recommended)</span></p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Draw a loop around each large object that should go. Everything outside your circles stays exactly as it is. Loose circles are fine. Leaves & sticks are separate - if you checked that, they're cleaned up everywhere on their own.</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => onChange(value.slice(0, -1))} disabled={!value.length}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
          <button type="button" onClick={() => onChange([])} disabled={!value.length}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-black text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"><Eraser className="h-3.5 w-3.5" /> Clear</button>
        </div>
      </div>
      <div className="relative mx-auto mt-3 w-fit max-w-full select-none overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" draggable={false} className="block max-h-[460px] w-auto max-w-full" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full cursor-crosshair" style={{ touchAction: 'none' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {value.map((shape, i) => (
            <polygon key={i} points={pts(shape)} fill="rgba(239,68,68,0.32)" stroke="#ef4444" strokeWidth={0.5} vectorEffect="non-scaling-stroke" strokeDasharray="2 1.5" />
          ))}
          {live && live.length > 1 && <polyline points={pts(live)} fill="rgba(239,68,68,0.18)" stroke="#ef4444" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
        </svg>
        {!value.length && !live && (
          <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-black text-white">Draw around the car or chair</span>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] font-black text-[#8b7355] dark:text-[#d7b974]">
        {value.length ? `${value.length} ${value.length === 1 ? 'area' : 'areas'} marked - only ${value.length === 1 ? 'it' : 'they'} will change` : 'Nothing circled - the AI will find what to remove on its own'}
      </p>
    </div>
  )
}
