'use client'

// The phone plan switcher under the pricing audience toggle (owner, 10/24: switching plans should
// feel smooth). One ink pill that glides to the picked plan - measured, so it fits any label
// width - instead of the old instant colour swap. Plain CSS transitions.
import { useLayoutEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'

export type PlanPill = { id: string; label: string; better?: boolean; shimmer?: boolean }

export default function PlanPills({ items, value, onChange }: { items: PlanPill[]; value: string; onChange: (id: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const btns = useRef<Record<string, HTMLButtonElement | null>>({})
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const measure = () => {
      const b = btns.current[value]
      if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth })
    }
    measure()
    // first placement without a slide, every later change glides
    const t = requestAnimationFrame(() => setReady(true))
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(t); window.removeEventListener('resize', measure) }
  }, [value, items.length])
  return (
    <div ref={wrap} className="relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-gray-200 bg-white p-1 shadow-sm [scrollbar-width:none] dark:border-gray-800 dark:bg-[#151517]">
      {pill && (
        <span aria-hidden className="absolute inset-y-1 rounded-full bg-[#111827] shadow-md shadow-[#111827]/20 dark:bg-[#C9A24D]"
          style={{ left: pill.left, width: pill.width, transition: ready ? 'left 420ms cubic-bezier(.22,1,.36,1), width 420ms cubic-bezier(.22,1,.36,1)' : 'none' }} />
      )}
      {items.map(it => {
        const on = it.id === value
        return (
          <button key={it.id} ref={el => { btns.current[it.id] = el }} type="button" onClick={() => onChange(it.id)} aria-pressed={on}
            className={`relative flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-[color,transform] duration-300 active:scale-95 ${on ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#0B0B0B] dark:text-gray-400 dark:hover:text-white'}`}>
            {it.shimmer && !on && <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 animate-card-shimmer bg-gradient-to-r from-transparent via-[#C9A24D]/40 to-transparent" />}
            <span className="relative">{it.label}</span>
            {it.better && <Sparkles className="relative h-3 w-3 text-[#C9A24D]" />}
          </button>
        )
      })}
    </div>
  )
}
