'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, HardDrive } from 'lucide-react'
import api from '@/lib/api-service'

/**
 * Animates a displayed integer smoothly from its previous value to `target` (ease-out, ~750ms) -
 * so a used-storage increase counts up instead of silently snapping to the new number. Mirrors the
 * identical helper in MonthlyAiUsageMeter.tsx (kept as a separate small copy here rather than a
 * shared import, so each meter file stays fully self-contained). `pulsing` is true for one brief
 * window right when a genuine increase starts, for the caller to trigger an icon pulse.
 */
function useCountUp(target: number | null) {
  const [display, setDisplay] = useState(target ?? 0)
  const [pulsing, setPulsing] = useState(false)
  const prevRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (target === null) return
    const start = prevRef.current ?? 0
    if (start === target) { setDisplay(target); return }

    if (target > start) {
      setPulsing(true)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = setTimeout(() => setPulsing(false), 650)
    }

    const duration = 750
    const startTime = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const step = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(start + (target - start) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        prevRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return { display, pulsing }
}

/**
 * Per-agent media storage across the whole app (AI Media, Design Studio, Blogs, brand logos,
 * manual listing photos, agent & sale photos). Backed by GET /studio/storage. Renders nothing
 * until data loads.
 *
 * Deliberately percentage-only - the raw MB/GB figures are never shown, and the percent uses the
 * exact same colour thresholds as <MonthlyAiUsageMeter /> so the two read as one matched pair.
 *
 * `variant`    - 'card' (bordered box) | 'inline' (label + bar) | 'chip' (single-line label + %).
 * `onDark`     - light text, for placing on a dark/navy surface (e.g. the Settings header).
 * `refreshKey` - bump to refetch after an upload/delete.
 * `compact`    - 'inline' only: icon + label + a small bar + percent all on one row, matching
 *                <MonthlyAiUsageMeter compact />.
 *
 * A genuine increase in `percent` (including the very first load) animates the bar filling to its
 * new width, the percent counting up from its previous value, and a quick scale-pulse on the
 * HardDrive icon - see useCountUp() above, same pattern as MonthlyAiUsageMeter.
 */
export default function StorageMeter({
  refreshKey,
  variant = 'card',
  onDark = false,
  compact = false,
  stretch = false,
  className = '',
}: {
  refreshKey?: number | string
  variant?: 'card' | 'inline' | 'chip'
  onDark?: boolean
  compact?: boolean
  /** compact inline only: fill the container's width (the bar grows), e.g. inside a header card. */
  stretch?: boolean
  className?: string
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.studio.getStorage>>['data'] | null>(null)

  useEffect(() => {
    let alive = true
    api.studio.getStorage().then(r => { if (alive && r.success && r.data) setData(r.data) })
    return () => { alive = false }
  }, [refreshKey])

  const rawPct = data ? Math.max(data.used_bytes > 0 ? 1 : 0, Math.min(100, data.percent)) : null
  const { display: pct, pulsing } = useCountUp(rawPct)

  if (!data) return null

  const exhausted = pct >= 100
  const warning = !exhausted && pct >= 80

  // Same palette as MonthlyAiUsageMeter.
  const barColor = exhausted ? 'bg-red-500' : warning ? 'bg-amber-400' : 'bg-[#C9A24D]'
  const pctColor = exhausted
    ? (onDark ? 'text-red-300' : 'text-red-600 dark:text-red-400')
    : warning
      ? (onDark ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400')
      : (onDark ? 'text-[#C9A24D]' : 'text-[#8b7355] dark:text-[#d7b974]')
  const labelColor = onDark ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
  const trackColor = onDark ? 'bg-white/15' : 'bg-gray-200 dark:bg-gray-700'
  const pulseCls = pulsing ? 'animate-meter-pulse drop-shadow-[0_0_6px_currentColor]' : ''

  if (variant === 'chip') {
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-black uppercase tracking-wide ${labelColor} ${className}`}>
        <HardDrive className={`h-3.5 w-3.5 shrink-0 ${pctColor} ${pulseCls}`} />
        Media Storage
        <span className={`tabular-nums ${pctColor}`}>{pct}%</span>
      </span>
    )
  }

  const bar = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide ${labelColor}`}>
          <HardDrive className={`h-3.5 w-3.5 ${pctColor} ${pulseCls}`} /> Media Storage
        </span>
        <span className={`text-xs font-black tabular-nums ${pctColor}`}>{pct}%</span>
      </div>
      <div className={`mt-1.5 h-2 w-full overflow-hidden rounded-full ${trackColor}`}>
        <div className={`h-full rounded-full ${barColor} transition-[width] duration-500 ease-out`} style={{ width: `${pct}%` }} />
      </div>
      {exhausted && (
        <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold ${onDark ? 'text-red-300' : 'text-red-600 dark:text-red-400'}`}>
          <AlertTriangle className="h-3 w-3" /> Storage is full — delete some photos or videos to free space.
        </p>
      )}
    </>
  )

  if (variant === 'inline' && compact) {
    const cardTone = exhausted
      ? (onDark ? 'border-red-400/40 bg-red-500/15' : 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20')
      : warning
        ? (onDark ? 'border-amber-400/40 bg-amber-400/15' : 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20')
        : (onDark ? 'border-white/15 bg-white/[0.07]' : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-[#1c1c1e]')
    return (
      <div className={`${stretch ? 'flex w-full py-1.5' : 'inline-flex py-2'} flex-col gap-1 rounded-xl border ${cardTone} px-3 ${className}`}>
        <div className="flex items-center gap-2">
          <HardDrive className={`h-3.5 w-3.5 shrink-0 ${pctColor} ${pulseCls}`} />
          <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${labelColor}`}>Storage</span>
          <div className={`h-1.5 ${stretch ? 'min-w-0 flex-1' : 'w-14 shrink-0 sm:w-28'} overflow-hidden rounded-full ${trackColor}`}>
            <div className={`h-full rounded-full ${barColor} transition-[width] duration-500 ease-out`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`shrink-0 text-xs font-black tabular-nums ${pctColor}`}>{pct}%</span>
        </div>
        {exhausted ? (
          <p className={`flex items-center gap-1 whitespace-nowrap text-[9px] font-bold leading-tight ${onDark ? 'text-red-300' : 'text-red-600 dark:text-red-400'}`}>
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> Storage full.
          </p>
        ) : warning ? (
          <p className={`whitespace-nowrap text-[9px] font-bold leading-tight ${onDark ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400'}`}>
            Almost full.
          </p>
        ) : null}
      </div>
    )
  }

  if (variant === 'inline') return <div className={className}>{bar}</div>

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-[#151517] ${className}`}>
      {bar}
    </div>
  )
}
