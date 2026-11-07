'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import { MousePointer2 } from 'lucide-react'

// One step of a demo's pointer script: `at` ms into the beat, head for `target` (a selector, or
// null to fade out) and/or start or stop the `click` ripple. Anything left out stays as it was.
export type CursorCue = { at: number; target?: string | null; click?: boolean }
type CursorState = { key: string | number | null; target: string | null; click: boolean }
const applyCue = (s: CursorState, c: CursorCue): CursorState => ({ ...s, target: c.target === undefined ? s.target : c.target, click: c.click ?? s.click })

// Plays one beat's cues. `key` changes when the beat changes; the pointer keeps whatever the last
// beat left it doing, which is how a move started on one beat lands on the next. `at: 0` cues apply
// in the same render as the new beat, so a stale click or target never shows for a frame.
export function useCursorCues(key: string | number, cues: CursorCue[]): { target: string | null; click: boolean } {
  const [state, setState] = useState<CursorState>({ key: null, target: null, click: false })
  let now = state
  if (state.key !== key) {
    now = cues.filter(c => c.at === 0).reduce(applyCue, { ...state, key })
    setState(now)
  }
  useEffect(() => {
    const timers = cues.filter(c => c.at > 0).map(c => setTimeout(() => setState(s => applyCue(s, c)), c.at))
    return () => timers.forEach(clearTimeout)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return now
}

// A mouse pointer that really travels to the element it "clicks": `target` is a CSS selector
// (e.g. [data-cursor="approve"]) inside `container`, measured from the real layout, so the click
// always lands on the button you see. The container must be `relative`. Click ripple when `click`.
// `moveKey`: change it to re-measure when a new screen reuses the same selector.
// `travelMs`: how long the glide takes. Leave it alone unless a beat is too short for the default.
// `painted`: measure the box as drawn instead of by layout. Needed when the target sits under CSS
// zoom or a scaled or scrolled box, which the layout walk can't see. Point it at something that has
// finished animating in - a drawn box still moving would send the pointer to the wrong spot.
export default function DemoCursor({ container, target, click = false, moveKey, travelMs = 850, painted = false }: { container: RefObject<HTMLElement | null>; target: string | null; click?: boolean; moveKey?: string | number; travelMs?: number; painted?: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    if (!target) return
    const measure = () => {
      const root = container.current // read here: on first mount the parent's ref isn't set yet
      if (!root) return
      if (painted) {
        const el = root.querySelector(target)
        if (!el) return
        const box = el.getBoundingClientRect(), frame = root.getBoundingClientRect()
        const s = frame.width / root.offsetWidth || 1 // the root itself may sit in a scaled frame
        setPos({ x: (box.left - frame.left + box.width * 0.55) / s - root.clientLeft, y: (box.top - frame.top + box.height * 0.55) / s - root.clientTop })
        return
      }
      const el = root.querySelector<HTMLElement>(target)
      if (!el) return
      // Walk offsetParents up to the container - layout pixels, unaffected by CSS scale/zoom.
      let x = el.offsetWidth * 0.55, y = el.offsetHeight * 0.55
      let n: HTMLElement | null = el
      while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent as HTMLElement | null }
      if (n === root) setPos({ x, y })
    }
    measure()
    const t = setTimeout(measure, 120) // after enter animations settle
    return () => clearTimeout(t)
  }, [container, target, moveKey, painted])

  const shown = !!target && !!pos
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{
        transform: `translate(${pos?.x ?? 0}px, ${pos?.y ?? 0}px)`,
        opacity: shown ? 1 : 0,
        transition: `transform ${travelMs}ms cubic-bezier(.45,.05,.35,1), opacity 300ms ease`,
      }}
    >
      {click && shown && (
        <>
          <span className="absolute -left-3 -top-3 h-7 w-7 animate-ping rounded-full bg-[#C9A24D]/45" />
          <span className="absolute -left-1.5 -top-1.5 h-4 w-4 rounded-full bg-[#C9A24D]/40" />
        </>
      )}
      <MousePointer2 className={`relative h-5 w-5 text-[#111827] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)] transition-transform duration-150 dark:text-white ${click ? 'scale-90' : ''}`} fill="currentColor" strokeWidth={1.5} />
    </span>
  )
}
