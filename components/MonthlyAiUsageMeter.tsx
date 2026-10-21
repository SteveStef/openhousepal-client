'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import api from '@/lib/api-service'
import type { MonthlyAiUsage } from '@/types'
import { useAiActivity } from '@/lib/aiActivity'

/**
 * "RPM gauge" icon standing in for the plain lucide <Gauge/> - a literal little car-tachometer:
 * an arc, a red-line zone near the top, and a needle. At rest the needle just sits low-left. While
 * `active` (an AI generation is actually in flight - see useAiActivity()/lib/aiActivity.ts) the
 * needle sweeps up toward the red line, hesitates/stutters right at it, eases back down, and
 * repeats - the `animate-rpm-needle` keyframe in tailwind.config.js. Pure `currentColor` SVG so it
 * always matches whatever text-color class the caller already applies (pctColor below).
 */
function AiGaugeIcon({ className = '', active = false }: { className?: string; active?: boolean }) {
  // Drawn on lucide's own Gauge geometry (full-size arc, 2px currentColor stroke, round caps) so
  // at rest it reads as the same weight/size/color family as StorageMeter's HardDrive icon beside
  // it - explicit ask: the old half-arc at 30% opacity with a red zone looked "super small" and
  // "too different". Only the needle moves, and only while an AI generation is in flight.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      {/* Needle - pivots at the hub (12,14); idle rest angle matches the animation's 0%/100% so
          toggling `active` never makes it visibly jump. */}
      <g
        className={active ? 'animate-rpm-needle' : ''}
        style={{ transformOrigin: '12px 14px', transform: active ? undefined : 'rotate(-55deg)' }}
      >
        <line x1="12" y1="14" x2="12" y2="7.5" />
      </g>
      <circle cx="12" cy="14" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * Animates a displayed integer smoothly from its previous value to `target` (ease-out, ~750ms) -
 * used for both meters' percent readout so a value increase counts up instead of silently
 * snapping to the new number. Returns [displayValue, didIncrease] - `didIncrease` pulses true for
 * one render pass right when a genuine increase starts, for the caller to trigger an icon pulse.
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
 * "Monthly AI Usage" meter - one number per agent, spanning every AI tool combined (photo &
 * video generation, CMA analysis, assistant chat, ...), shown as a 0-100% bar like Claude's
 * own usage readout. The underlying dollar budget is deliberately NOT shown to the agent.
 *
 * Renders nothing when the plan tier has no configured monthly AI budget (percent === null).
 *
 * `refreshKey` - bump from the parent (e.g. after a generation finishes) to refetch.
 * `variant`   - 'card' (self-contained bordered box) | 'inline' (bar only, for an existing strip).
 * `showSpend` - append the exact month-to-date dollar figure as faint sub-text. Defaults OFF -
 *               the permanent UI is percentage-only; opt in per-placement only if truly needed.
 * `onDark`    - light text + translucent track, for placing on a dark/navy surface (e.g. a hero).
 * `compact`   - 'inline' only: icon + label + a small bar + percent all on one row (a tight
 *               header cluster), instead of the label/percent row sitting above the bar.
 *
 * Value changes (a genuine increase in `percent`, including the very first load) animate: the bar
 * fills to its new width, the percent counts up from its previous value, and the gauge icon does a
 * quick scale-pulse - see useCountUp() above. While an AI generation is actually in flight anywhere
 * in the app (useAiActivity(), fed by AiWriteButton.tsx's Write/Polish and Fair-Housing check -
 * the only AI-cost call sites this meter's own file can see), the gauge's needle sweeps and
 * hesitates like a tachometer instead of sitting still.
 */
export default function MonthlyAiUsageMeter({
  refreshKey,
  variant = 'card',
  showSpend = false,
  onDark = false,
  compact = false,
  stretch = false,
  className = '',
}: {
  refreshKey?: number | string
  variant?: 'card' | 'inline' | 'chip'
  showSpend?: boolean
  onDark?: boolean
  compact?: boolean
  /** compact inline only: fill the container's width (the bar grows), e.g. inside a header card. */
  stretch?: boolean
  className?: string
}) {
  const [data, setData] = useState<MonthlyAiUsage | null>(null)
  const [why, setWhy] = useState(false)
  const aiActive = useAiActivity()

  const load = useCallback(() => {
    api.ai.monthlyUsage().then(r => { if (r.success && r.data) setData(r.data) })
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const rawPct = data && data.percent !== null ? Math.max(0, Math.min(100, data.percent)) : null
  const { display: pct, pulsing } = useCountUp(rawPct)

  if (!data || data.percent === null) return null

  // The last hour's spend is its own slice at the right end of the fill (red), so what the agent
  // just made is visible against the rest of the month (gold).
  const recent = Math.max(0, Math.min(pct, data.recent_percent ?? 0))
  const older = Math.max(0, pct - recent)
  const recentNote = recent > 0 ? `+${recent}% in the last hour` : ''

  const exhausted = data.exhausted || pct >= 100
  const warning = !exhausted && (data.near_limit || pct >= 80)

  const barColor = exhausted ? 'bg-red-700' : warning ? 'bg-amber-400' : 'bg-[#C9A24D]'
  const fill = (
    <>
      <div className={`h-full ${barColor} transition-[width] duration-500 ease-out ${recent ? 'rounded-l-full' : 'rounded-full'}`} style={{ width: `${older}%` }} />
      {recent > 0 && <div className={`h-full bg-red-500 transition-[width] duration-500 ease-out ${older ? 'rounded-r-full' : 'rounded-full'}`} style={{ width: `${recent}%` }} title={recentNote} />}
    </>
  )
  const recentColor = onDark ? 'text-red-300' : 'text-red-600 dark:text-red-400'
  const pctColor = exhausted
    ? (onDark ? 'text-red-300' : 'text-red-600 dark:text-red-400')
    : warning
      ? (onDark ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400')
      : (onDark ? 'text-[#C9A24D]' : 'text-[#8b7355] dark:text-[#d7b974]')
  const labelColor = onDark ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
  const trackColor = onDark ? 'bg-white/15' : 'bg-gray-200 dark:bg-gray-700'
  const spendColor = onDark ? 'text-white/55' : 'text-gray-400 dark:text-gray-500'
  const pulseCls = pulsing ? 'animate-meter-pulse drop-shadow-[0_0_6px_currentColor]' : ''

  const bar = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide ${labelColor}`}>
          <AiGaugeIcon className={`h-3.5 w-3.5 ${pctColor} ${pulseCls}`} active={aiActive} /> Monthly AI Usage
        </span>
        <span className={`text-xs font-black tabular-nums ${pctColor}`}>{pct}%</span>
      </div>
      <div className={`mt-1.5 flex h-2 w-full overflow-hidden rounded-full ${trackColor}`}>
        {fill}
      </div>
      {recentNote && <p className={`mt-1 text-[10px] font-black ${recentColor}`}>{recentNote}</p>}
      {exhausted ? (
        <p className={`mt-1.5 flex items-center gap-1 text-[11px] font-bold ${onDark ? 'text-red-300' : 'text-red-600 dark:text-red-400'}`}>
          <AlertTriangle className="h-3 w-3" /> You&apos;ve reached this month&apos;s AI limit — it resets on the 1st.
        </p>
      ) : warning ? (
        <p className={`mt-1.5 text-[11px] font-bold ${onDark ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400'}`}>
          You&apos;re close to this month&apos;s AI limit.
        </p>
      ) : null}
      {(data.breakdown?.length || 0) > 0 && (
        <div className="mt-1.5">
          <button type="button" onClick={() => setWhy(v => !v)} className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide ${labelColor} hover:opacity-80`}>
            What used it <ChevronDown className={`h-3 w-3 transition-transform ${why ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {why && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-1 space-y-0.5 overflow-hidden">
                {data.breakdown!.map(r => (
                  <li key={r.label} className={`flex items-center justify-between gap-3 text-[11px] font-bold ${labelColor}`}>
                    <span className="truncate">{r.label}</span>
                    <span className={`shrink-0 tabular-nums ${pctColor}`}>{r.percent == null ? '' : r.percent < 1 ? '<1%' : `${Math.round(r.percent)}%`}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
      {showSpend && (
        <p className={`mt-1 text-[10px] font-bold ${spendColor}`}>
          ${data.used_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} used this month
        </p>
      )}
    </>
  )

  if (variant === 'chip') {
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-black uppercase tracking-wide ${labelColor} ${className}`}>
        <AiGaugeIcon className={`h-3.5 w-3.5 shrink-0 ${pctColor} ${pulseCls}`} active={aiActive} />
        Monthly AI Usage
        <span className={`tabular-nums ${pctColor}`}>{pct}%</span>
        {recent > 0 && <span className={`tabular-nums ${recentColor}`}>(+{recent}% last hour)</span>}
      </span>
    )
  }

  if (variant === 'inline' && compact) {
    const cardTone = exhausted
      ? (onDark ? 'border-red-400/40 bg-red-500/15' : 'border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20')
      : warning
        ? (onDark ? 'border-amber-400/40 bg-amber-400/15' : 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20')
        : (onDark ? 'border-white/15 bg-white/[0.07]' : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-[#1c1c1e]')
    return (
      <div className={`${stretch ? 'flex w-full py-1.5' : 'inline-flex py-2'} flex-col gap-1 rounded-xl border ${cardTone} px-3 ${className}`}>
        <div className="flex items-center gap-2">
          <AiGaugeIcon className={`h-3.5 w-3.5 shrink-0 ${pctColor} ${pulseCls}`} active={aiActive} />
          <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide ${labelColor}`}>AI Usage</span>
          <div className={`flex h-1.5 ${stretch ? 'min-w-0 flex-1' : 'w-14 shrink-0 sm:w-28'} overflow-hidden rounded-full ${trackColor}`}>
            {fill}
          </div>
          <span className={`shrink-0 text-xs font-black tabular-nums ${pctColor}`}>{pct}%</span>
          {recentNote && <span className={`hidden shrink-0 whitespace-nowrap text-[9px] font-black sm:inline ${recentColor}`} title={recentNote}>+{recent}% last hr</span>}
        </div>
        {/* On a phone the pill is too narrow for the bar, the % and this note on one row - the note
            pushed past the pill's edge (10/20) - so it gets its own line there. */}
        {recentNote && <p className={`whitespace-nowrap text-[9px] font-black leading-tight sm:hidden ${recentColor}`}>+{recent}% in the last hour</p>}
        {exhausted ? (
          <p className={`flex items-center gap-1 whitespace-nowrap text-[9px] font-bold leading-tight ${onDark ? 'text-red-300' : 'text-red-600 dark:text-red-400'}`}>
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" /> Limit reached — resets the 1st.
          </p>
        ) : warning ? (
          <p className={`whitespace-nowrap text-[9px] font-bold leading-tight ${onDark ? 'text-amber-300' : 'text-amber-600 dark:text-amber-400'}`}>
            Close to this month&apos;s limit.
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
