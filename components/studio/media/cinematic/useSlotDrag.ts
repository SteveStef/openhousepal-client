'use client'

// Drag-to-reorder for the video boards (Cinematic "Your video, in order" and Fast Cut "Your shots"): cards sit in
// places on a grid (or several grids); a mouse drags a whole card, a finger drags by the card's handle (so the page
// still scrolls), and the handle moves with the arrow keys. The places are measured when a drag starts - the cards
// slide between them, the places stay put - and the nearest place to the pointer is where the card goes.
import { useEffect, useMemo, useRef, useState } from 'react'

export type SlotDrag = { from: number; over: number } | null

export function useSlotDrag(count: number, onMove: (from: number, to: number) => void) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<SlotDrag>(null)
  const dragRef = useRef<SlotDrag>(null)
  const start = useRef<{ x: number; y: number; i: number; id: number; active: boolean } | null>(null)
  const slots = useRef<DOMRect[]>([])
  const top0 = useRef(0)
  const setD = (v: SlotDrag) => { dragRef.current = v; setDrag(v) }
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove
  // While a drag is on, the pointer is followed on the whole page: the card it started on slides to new places
  // (and can be re-placed in the page), which loses a finger's hold on it (found 11/17 on the Fast Cut board).
  const listening = useRef<null | (() => void)>(null)

  /** shown[k] = which card sits in place k right now (the dragged one lifted out and dropped where the pointer is). */
  const shown = useMemo(() => {
    const idx = Array.from({ length: count }, (_, i) => i)
    if (!drag || drag.from >= count) return idx
    const [m] = idx.splice(drag.from, 1)
    idx.splice(Math.min(drag.over, count - 1), 0, m)
    return idx
  }, [count, drag])

  const rootTop = () => rootRef.current?.getBoundingClientRect().top ?? 0

  const down = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    const t = e.target as HTMLElement
    if (t.closest('[data-nodrag]')) return
    if (e.pointerType === 'mouse' ? e.button !== 0 : !t.closest('[data-grip]')) return
    start.current = { x: e.clientX, y: e.clientY, i, id: e.pointerId, active: false }
    listening.current?.()
    const mv = (ev: PointerEvent) => move(ev)
    const end = () => up()
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    listening.current = () => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      listening.current = null
    }
  }
  const move = (e: PointerEvent) => {
    const st = start.current
    if (!st || st.id !== e.pointerId) return
    if (!st.active) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return
      st.active = true
      slots.current = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-slot]') || [])
        .sort((a, b) => Number(a.dataset.slot) - Number(b.dataset.slot)).map(el => el.getBoundingClientRect())
      top0.current = rootTop()
      setD({ from: st.i, over: st.i })
    }
    // the board may have scrolled (the page, or the chat it sits in): the places moved with it
    const dy = rootTop() - top0.current
    let j = -1, best = Infinity
    slots.current.forEach((r, k) => {
      const d2 = (e.clientX - (r.left + r.width / 2)) ** 2 + (e.clientY - (r.top + dy + r.height / 2)) ** 2
      if (d2 < best) { best = d2; j = k }
    })
    if (j >= 0 && dragRef.current && dragRef.current.over !== j) setD({ ...dragRef.current, over: j })
  }
  const up = () => {
    listening.current?.()
    const st = start.current
    start.current = null
    const d = dragRef.current
    if (st?.active && d && d.over !== d.from) onMoveRef.current(d.from, d.over)
    if (dragRef.current) setD(null)
  }
  const key = (i: number) => (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0
    if (!dir) return
    e.preventDefault()
    const j = i + dir
    if (j < 0 || j >= count) return
    onMove(i, j)
    requestAnimationFrame(() => (rootRef.current?.querySelector(`[data-grip-i="${j}"]`) as HTMLElement | null)?.focus())
  }
  useEffect(() => () => listening.current?.(), [])
  /** Everything a card needs: its place number, the pointer handlers. */
  const bind = (pos: number) => ({ 'data-slot': pos, onPointerDown: down(pos) })
  return { rootRef, drag, shown, bind, key }
}
