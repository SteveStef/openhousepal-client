'use client'

// Fast Cut "Your shots" as a board (owner 11/17: "the cinematic and fast cut flows should have the same amazing
// features"): the AI editor's plan in the parts of the song - Opening, Build-up, Address shot, Quick flashes, The
// drop, Ending - each with its title, the shots as numbered cards in reading order (left to right, then the next
// row). The cards in the build-up and the drop can be dragged anywhere among those runs (across parts too); the
// opening, the address shot, the flashes and the ending keep their places on the song, so they show a lock.
// Same dragging as the Cinematic board (useSlotDrag): a mouse drags the card, a finger the handle, keys move it.
import { useEffect, useMemo, useState } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { ChevronRight, Flame, GripVertical, Lock, Sunset, Type, X } from 'lucide-react'
import { thumbOf, type MotionPhotoSetting } from '@/lib/studio/cinematic'
import type { FastPlan, FastPlanRow } from './FastCut'
import { useSlotDrag } from './useSlotDrag'

type PartKey = 'opening' | 'build' | 'address' | 'flashes' | 'drop' | 'run' | 'ending' | 'shots'
const PARTS: Record<PartKey, { title: string; note: string; locked: boolean }> = {
  opening: { title: 'Opening', note: 'The front of the home, under your title', locked: true },
  build: { title: 'Build-up', note: 'Quick cuts as the music builds - drag to reorder', locked: false },
  address: { title: 'Address shot', note: 'A slow, calm shot while the address shows', locked: true },
  flashes: { title: 'Quick flashes', note: 'Four fast flashes on the beat - the AI editor picks these', locked: true },
  drop: { title: 'The drop', note: 'Where the song hits - drag to reorder', locked: false },
  run: { title: 'More of the home', note: 'The second run - drag to reorder', locked: false },
  ending: { title: 'Ending', note: 'Price, address and your name', locked: true },
  shots: { title: 'Shots', note: 'Drag to reorder', locked: false },
}

function partOf(r: FastPlanRow, i: number, n: number): PartKey {
  if (r.role === 'opening' || i === 0) return 'opening'
  if (r.role === 'closing' || i === n - 1) return 'ending'
  switch (r.section) {
    case 'hook': return 'build'
    case 'calm': case 'calm2': return 'address'
    case 'quick': return 'flashes'
    case 'drop': return 'drop'
    case 'run': return 'run'
    default: return r.movable ? 'shots' : 'address'
  }
}

export default function FastShotBoard({ plan, photos, busy, opening, onOrder, onRemove, canRemove }: {
  plan: FastPlan
  photos: Map<string, MotionPhotoSetting>
  busy: boolean
  /** The opening title is on. */
  opening: boolean
  onOrder: (order: string[]) => void
  onRemove: (photoId: string) => void
  canRemove: boolean
}) {
  const rows = plan.rows
  // the movable shots, in plan order (the cards that can be dragged)
  const movable = useMemo(() => rows.map((r, i) => ({ r, i })).filter(x => x.r.movable), [rows])
  // until the new plan arrives, the board keeps the agent's move (no snapping back)
  const [perm, setPerm] = useState<number[] | null>(null)
  useEffect(() => { setPerm(null) }, [plan])
  const base = perm && perm.length === movable.length ? perm : movable.map((_, k) => k)
  // where each movable shot sits in the AI editor's order list (that list also holds photos the planner places by
  // itself - only the dragged shots' places change, everything else stays exactly where the AI editor put it)
  const at = useMemo(() => {
    const used = new Set<number>()
    return movable.map(({ r }) => {
      const j = plan.order.findIndex((p, q) => p === r.photo && !used.has(q))
      if (j >= 0) used.add(j)
      return j
    })
  }, [movable, plan.order])
  const move = (from: number, to: number) => {
    const next = [...base]
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    setPerm(next)
    const order = [...plan.order]
    next.forEach((k, pos) => { if (at[pos] >= 0) order[at[pos]] = movable[k].r.photo })
    onOrder(order)
  }
  const { rootRef, drag, shown, bind, key } = useSlotDrag(movable.length, move)

  // how wide the board is decides the columns (phones and the small chat panel: 3, or 2 when very narrow)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el); setW(el.clientWidth)
    return () => ro.disconnect()
  }, [rootRef])
  const cols = w >= 560 ? 4 : w >= 300 ? 3 : 2

  // the parts, in order: each a run of consecutive shots of the same kind
  const parts = useMemo(() => {
    const out: { key: PartKey; at: number; items: { i: number; slot: number }[] }[] = []
    let slot = 0
    rows.forEach((r, i) => {
      const k = partOf(r, i, rows.length)
      const it = { i, slot: r.movable ? slot++ : -1 }
      const last = out[out.length - 1]
      if (last && last.key === k) last.items.push(it)
      else out.push({ key: k, at: i, items: [it] })
    })
    return out
  }, [rows])

  const fmt = (t: number) => `0:${String(Math.floor(t)).padStart(2, '0')}`

  return (
    <div ref={rootRef} className={`space-y-4 ${busy ? 'opacity-60' : ''}`} data-testid="fast-board">
      <LayoutGroup>
        {parts.map(part => {
          const meta = PARTS[part.key]
          const first = part.at + 1, last = part.at + part.items.length
          return (
            <section key={`${part.key}-${part.at}`} data-testid={`fast-part-${part.key}`}>
              <div className="mb-2">
                <p className="flex items-center gap-2">
                  <span className="whitespace-nowrap font-serif text-sm font-black text-[#111827] dark:text-white">{meta.title}</span>
                  <span className="whitespace-nowrap text-[10px] font-black tabular-nums text-gray-400">{first === last ? `shot ${first}` : `shots ${first}-${last}`}</span>
                  {meta.locked && <Lock className="h-3 w-3 shrink-0 text-gray-400" />}
                </p>
                <p className="text-[10.5px] font-semibold leading-snug text-gray-500">{meta.note}</p>
              </div>
              <div className="grid gap-x-3.5 gap-y-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {part.items.map((it, j) => {
                  // a movable place shows whichever shot sits there now (the agent's move, or the one being dragged)
                  const mk = it.slot >= 0 ? base[shown[it.slot]] : -1
                  const row = mk >= 0 ? movable[mk].r : rows[it.i]
                  const real = rows[it.i]
                  const ph = photos.get(row.photo)
                  const lifted = it.slot >= 0 && drag != null && drag.over === it.slot
                  const lastInRow = j % cols === cols - 1 || j === part.items.length - 1
                  const card = (
                    <div className={`overflow-hidden rounded-xl border-2 bg-white dark:bg-[#151517] ${lifted ? 'scale-[1.04] border-[#C9A24D] shadow-2xl shadow-[#C9A24D]/25' : 'border-gray-200 shadow-sm dark:border-gray-800'}`}>
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbOf(ph?.clean || ph?.source) || ph?.source || ''} alt={row.what || 'Shot'} draggable={false} loading="lazy" className="pointer-events-none h-full w-full object-cover" />
                        <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C9A24D] px-1 text-[10px] font-black text-[#111827] shadow">{it.i + 1}</span>
                        {it.slot >= 0 ? (
                          <div data-grip data-grip-i={it.slot} tabIndex={0} aria-label={`Move shot ${it.i + 1}. Use the arrow keys`} onKeyDown={key(it.slot)}
                            className="touch-none absolute right-1 top-1 flex h-7 w-7 cursor-grab items-center justify-center rounded-full bg-black/55 text-white outline-none ring-[#C9A24D] focus-visible:ring-2">
                            <GripVertical className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white/90" title="Keeps its place on the song"><Lock className="h-3 w-3" /></span>
                        )}
                        <span className="pointer-events-none absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white">{fmt(real.start)}</span>
                        {part.key === 'opening' && opening && <span className="pointer-events-none absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-white"><Type className="h-2.5 w-2.5" /> Title</span>}
                      </div>
                      <div className="flex items-start gap-1 px-2 pb-1.5 pt-1">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-black capitalize leading-tight text-[#111827] dark:text-white" title={row.what || undefined}>{row.what || 'Photo'}</span>
                          <span className="flex min-w-0 items-center gap-1.5 text-[9.5px] font-bold text-gray-500">
                            <span className="shrink-0">{real.seconds.toFixed(1)}s</span>
                            {row.stat && <span className="min-w-0 truncate font-black text-[#B8902F] dark:text-[#E8C98A]" title={`${row.stat.value} ${row.stat.label}`}>{row.stat.value} {row.stat.label}</span>}
                            {row.fire && <Flame className="h-3 w-3" aria-label="fire moves" />}
                            {real.dusk && <Sunset className="h-3 w-3" aria-label="turns to dusk" />}
                          </span>
                        </span>
                        {it.slot >= 0 && (
                          <button type="button" data-nodrag disabled={busy || !canRemove} onClick={() => onRemove(row.photo)} aria-label="Take this photo out"
                            className="-mr-1 shrink-0 p-1 text-gray-400 hover:text-red-600 disabled:opacity-20"><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </div>
                  )
                  return it.slot >= 0 ? (
                    <motion.div key={`m-${mk}-${row.photo}`} layoutId={`fast-shot-${mk}-${row.photo}`} transition={{ type: 'spring', stiffness: 520, damping: 40 }} {...bind(it.slot)}
                      className={`relative select-none ${drag ? '' : 'cursor-grab'} ${lifted ? 'z-10 cursor-grabbing' : ''}`} data-testid={`fast-shot-${it.i}`}>
                      {card}
                      {!lastInRow && !drag && <Arrow />}
                    </motion.div>
                  ) : (
                    <div key={`f-${it.i}`} className="relative" data-testid={`fast-shot-${it.i}`}>
                      {card}
                      {!lastInRow && <Arrow />}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </LayoutGroup>
    </div>
  )
}

function Arrow() {
  return (
    <span className="pointer-events-none absolute -right-[13px] top-[30%] z-[1] flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#C9A24D] shadow ring-1 ring-black/5 dark:bg-[#1f1f22]">
      <ChevronRight className="h-3 w-3" strokeWidth={3} />
    </span>
  )
}
