'use client'

// "Your video, in order" (owner 11/17: "seeing what is title pictures to ensure the right one is there and
// you can move and drag each title section, and what comes next on one line then the next line"). The
// picked photos as the video plays them, room by room: one numbered card per room in reading order (left
// to right, then the next row). Each card shows the room's opening photo - the one its name shows over -
// big, with the room's other photos under it (tap one to open the room with it instead). Drag a card (or
// its handle on a phone) to move the whole room; on a keyboard, the handle moves with the arrow keys.
import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, GripVertical, Type } from 'lucide-react'
import { thumbOf, type MotionPhotoSetting, type MotionSettings } from '@/lib/studio/cinematic'
import { roomOption, kindLabel } from '@/motion-video/presets'

export type RoomRun = { key: string; room: string | null; label: string; photos: MotionPhotoSetting[] }

/** The shown photos as runs of the same room, in video order. */
export function runsOf(s: MotionSettings): RoomRun[] {
  const roomOf = new Map((s.pool || []).map(it => [it.source, it.room as string | null | undefined]))
  const out: RoomRun[] = []
  const seen = new Map<string, number>()
  for (const p of s.photos) {
    if (p.hidden) continue
    const r = (roomOf.get(p.source) ?? p.room ?? null) as string | null
    const last = out[out.length - 1]
    if (last && last.room === r) { last.photos.push(p); continue }
    const n = (seen.get(String(r)) || 0) + 1
    seen.set(String(r), n)
    let label = 'Other photos'
    try { label = (r && r !== 'skip' && roomOption(r as never)?.label) || p.label || kindLabel(p.kind).label } catch { label = p.label || 'Photo' }
    out.push({ key: `${r}-${n}`, room: r, label, photos: [p] })
  }
  return out
}

/** Moves a whole room (run) from one place to another. Taken-out photos stay at the end. */
export function moveRun(d: MotionSettings, from: number, to: number): MotionSettings {
  const runs = runsOf(d)
  if (from === to || !runs[from] || to < 0 || to >= runs.length) return d
  const [m] = runs.splice(from, 1)
  runs.splice(to, 0, m)
  return { ...d, photos: [...runs.flatMap(r => r.photos), ...d.photos.filter(p => p.hidden)] }
}

/** Makes this photo the room's opening photo (first of its run). */
export function openWith(d: MotionSettings, photoId: string): MotionSettings {
  const runs = runsOf(d)
  const run = runs.find(r => r.photos.some(p => p.id === photoId))
  if (!run || run.photos[0].id === photoId) return d
  const ph = run.photos.find(p => p.id === photoId)!
  run.photos = [ph, ...run.photos.filter(p => p.id !== photoId)]
  return { ...d, photos: [...runs.flatMap(r => r.photos), ...d.photos.filter(p => p.hidden)] }
}

export default function VideoOrder({ s, cols, onMove, onOpenWith }: {
  s: MotionSettings
  cols: number
  onMove: (from: number, to: number) => void
  onOpenWith: (photoId: string) => void
}) {
  const runs = useMemo(() => runsOf(s), [s])
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
  const dragRef = useRef<{ from: number; over: number } | null>(null)
  const start = useRef<{ x: number; y: number; i: number; id: number; active: boolean } | null>(null)
  // the grid's places, measured when a drag starts: the cards slide between them, the places stay put
  const slots = useRef<DOMRect[]>([])
  const scroll0 = useRef<number | null>(null)
  const setD = (v: { from: number; over: number } | null) => { dragRef.current = v; setDrag(v) }

  // what's shown while dragging: the room lifted out of its place and dropped where the pointer is
  const shown = useMemo(() => {
    const idx = runs.map((_, i) => i)
    if (!drag) return idx
    const [m] = idx.splice(drag.from, 1)
    idx.splice(drag.over, 0, m)
    return idx
  }, [runs, drag])

  const down = (i: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('[data-nodrag]')) return
    if (e.pointerType === 'mouse' ? e.button !== 0 : !t.closest('[data-grip]')) return   // a finger drags by the handle (the card still scrolls the page)
    start.current = { x: e.clientX, y: e.clientY, i, id: e.pointerId, active: false }
    scroll0.current = window.scrollY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = start.current
    if (!st || st.id !== e.pointerId) return
    if (!st.active) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return
      st.active = true
      slots.current = Array.from(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-run]') || [])
        .sort((a, b) => Number(a.dataset.run) - Number(b.dataset.run)).map(el => el.getBoundingClientRect())
      setD({ from: st.i, over: st.i })
    }
    // the place nearest the pointer (the page may have scrolled: places move with it)
    const dy = window.scrollY - (scroll0.current ?? window.scrollY)
    let j = -1, best = Infinity
    slots.current.forEach((r, k) => {
      const cx = r.left + r.width / 2, cy = r.top - dy + r.height / 2
      const d2 = (e.clientX - cx) ** 2 + (e.clientY - cy) ** 2
      if (d2 < best) { best = d2; j = k }
    })
    if (j >= 0 && dragRef.current && dragRef.current.over !== j) setD({ ...dragRef.current, over: j })
  }
  const up = () => {
    const st = start.current
    start.current = null
    const d = dragRef.current
    if (st?.active && d && d.over !== d.from) onMove(d.from, d.over)
    setD(null)
  }
  const key = (i: number) => (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0
    if (!dir) return
    e.preventDefault()
    const j = i + dir
    if (j < 0 || j >= runs.length) return
    onMove(i, j)
    requestAnimationFrame(() => (document.querySelector(`[data-grip-i="${j}"]`) as HTMLElement | null)?.focus())
  }

  if (!runs.length) return null
  return (
    <div className="grid gap-x-5 gap-y-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} data-testid="video-order">
      {shown.map((ri, pos) => {
        const run = runs[ri]
        const cover = run.photos[0]
        const lifted = drag?.from === ri
        const lastInRow = pos % cols === cols - 1 || pos === shown.length - 1
        const opening = pos === 0 && s.sections?.opening !== false
        return (
          <motion.div key={run.key} layout transition={{ type: 'spring', stiffness: 520, damping: 40 }} data-run={pos}
            onPointerDown={down(pos)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            className={`relative select-none ${drag ? '' : 'cursor-grab'} ${lifted ? 'z-10 cursor-grabbing' : ''}`} data-testid={`order-run-${pos}`}>
            <div className={`overflow-hidden rounded-2xl border-2 bg-white transition-shadow dark:bg-[#151517] ${lifted ? 'scale-[1.03] border-[#C9A24D] shadow-2xl shadow-[#C9A24D]/25' : 'border-gray-200 shadow-sm dark:border-gray-800'}`}>
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbOf(cover.clean || cover.source) || cover.source} alt={run.label} draggable={false} className="pointer-events-none h-full w-full object-cover" />
                <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#C9A24D] px-1.5 text-[11px] font-black text-[#111827] shadow">{pos + 1}</span>
                <div data-grip data-grip-i={pos} tabIndex={0} aria-label={`Move ${run.label} - room ${pos + 1} of ${runs.length}. Use the arrow keys`} onKeyDown={key(pos)}
                  className="touch-none absolute right-1.5 top-1.5 flex h-8 w-8 cursor-grab items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-0 outline-none ring-[#C9A24D] focus-visible:ring-2">
                  <GripVertical className="h-4 w-4" />
                </div>
                {cover.showLabel !== false && cover.label && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-1.5 pt-5 font-serif text-[11px] italic text-white">{cover.label}</span>
                )}
                {opening && <span className="pointer-events-none absolute left-2 top-9 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-white"><Type className="h-2.5 w-2.5" /> Opening title</span>}
              </div>
              <div className="px-2.5 pb-2.5 pt-2">
                <p className="truncate text-xs font-black text-[#111827] dark:text-white">{run.label}{run.photos.length > 1 && <span className="font-bold text-gray-400"> · {run.photos.length} photos</span>}</p>
                {run.photos.length > 1 && (
                  <div className="mt-1.5 flex gap-1 overflow-x-auto" data-nodrag>
                    {run.photos.map((p, k) => (
                      <button key={p.id} type="button" data-nodrag onClick={() => onOpenWith(p.id)} disabled={k === 0}
                        title={k === 0 ? 'Opens the room' : 'Open the room with this photo'} aria-label={k === 0 ? `${run.label}: opening photo` : `Open ${run.label} with photo ${k + 1}`}
                        className={`relative h-9 w-12 shrink-0 overflow-hidden rounded-md border-2 transition ${k === 0 ? 'border-[#C9A24D]' : 'border-transparent opacity-80 hover:border-[#C9A24D]/60 hover:opacity-100'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbOf(p.clean || p.source) || p.source} alt="" draggable={false} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {!lastInRow && !drag && (
              <span className="pointer-events-none absolute -right-[18px] top-[34%] z-[1] flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#C9A24D] shadow ring-1 ring-black/5 dark:bg-[#1f1f22]">
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
