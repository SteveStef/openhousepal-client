'use client'

// A price range you tap instead of type (owner, 10/22): a few ready-made ranges, plus "Custom"
// with a two-handle slider. Used by the setup flow ("The homes your website shows") and by the
// website editor's Featured tab, on the same saved values (min/max in dollars, null = no limit),
// so whichever one changes it, the other shows it.
import { useEffect, useRef, useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'

export const PRICE_PRESETS: { id: string; label: string; min: number | null; max: number | null }[] = [
  { id: 'any', label: 'Any price', min: null, max: null },
  { id: 'u250', label: 'Up to $250K', min: null, max: 250_000 },
  { id: '250-1m', label: '$250K – $1M', min: 250_000, max: 1_000_000 },
  { id: '500-2m', label: '$500K – $2M', min: 500_000, max: 2_000_000 },
  { id: '3m', label: '$3M and up', min: 3_000_000, max: null },
]

// Slider stops: 0 = no minimum, the last one = no maximum.
const STOPS = [
  0, 100_000, 150_000, 200_000, 250_000, 300_000, 350_000, 400_000, 450_000, 500_000, 600_000, 700_000, 800_000, 900_000,
  1_000_000, 1_250_000, 1_500_000, 1_750_000, 2_000_000, 2_500_000, 3_000_000, 4_000_000, 5_000_000, 7_500_000, 10_000_000, Infinity,
]
const LAST = STOPS.length - 1

export function money(n: number): string {
  if (n >= 1_000_000) return `$${parseFloat((n / 1_000_000).toFixed(2))}M`
  return `$${Math.round(n / 1000)}K`
}
export function priceLabel(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min && min > 0 ? min : null
  const hi = max && max > 0 ? max : null
  const preset = PRICE_PRESETS.find(p => p.min === lo && p.max === hi)
  if (preset) return preset.label
  if (lo && hi) return `${money(lo)} – ${money(hi)}`
  if (lo) return `${money(lo)} and up`
  if (hi) return `Up to ${money(hi)}`
  return 'Any price'
}
const nearest = (v: number | null, fallback: number) => {
  if (v == null || v <= 0) return fallback
  let best = 0
  STOPS.forEach((s, i) => { if (Math.abs(s - v) < Math.abs(STOPS[best] - v)) best = i })
  return best
}

export default function PricePicker({ min, max, onChange, compact = false }: {
  min: number | null | undefined
  max: number | null | undefined
  onChange: (min: number | null, max: number | null) => void
  /** the website editor's smaller look */
  compact?: boolean
}) {
  const lo = min && min > 0 ? min : null
  const hi = max && max > 0 ? max : null
  const preset = PRICE_PRESETS.find(p => p.min === lo && p.max === hi)
  const [custom, setCustom] = useState(!preset)
  // the slider's own positions while dragging; saved a moment after they let go
  const [range, setRange] = useState<[number, number]>([nearest(lo, 0), nearest(hi, LAST)])
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => { setRange([nearest(lo, 0), nearest(hi, LAST)]) }, [lo, hi])
  useEffect(() => { if (!preset) setCustom(true) }, [preset])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const commit = (a: number, b: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onChange(a === 0 ? null : STOPS[a], b === LAST ? null : STOPS[b]), 450)
  }
  const move = (which: 0 | 1, i: number) => {
    const next: [number, number] = which === 0 ? [Math.min(i, range[1] - 1), range[1]] : [range[0], Math.max(i, range[0] + 1)]
    setRange(next)
    commit(next[0], next[1])
  }
  const pick = (p: typeof PRICE_PRESETS[number]) => { setCustom(false); window.clearTimeout(timer.current); onChange(p.min, p.max) }
  const openCustom = () => {
    setCustom(true)
    if (preset && preset.id === 'any') { setRange([nearest(300_000, 0), nearest(800_000, LAST)]); onChange(300_000, 800_000) }
  }
  const shown = `${range[0] === 0 ? 'Any' : money(STOPS[range[0]])} – ${range[1] === LAST ? 'No limit' : money(STOPS[range[1]])}`
  const pct = (i: number) => (i / LAST) * 100

  const chip = compact
    ? 'inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-black transition'
    : 'inline-flex min-h-[48px] items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border-2 px-3 py-2.5 text-[14px] font-black transition sm:px-4 sm:text-[15px]'
  const on = compact ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-[#C9A24D] bg-gradient-to-b from-[#fffaf0] to-white text-[#111827] shadow-[0_14px_28px_-22px_rgba(139,106,43,.9)] dark:from-[#1d1912] dark:to-[#141416] dark:text-white'
  const off = compact ? 'border-gray-200 text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300' : 'border-[#ece5d6] bg-white text-[#111827] hover:border-[#C9A24D]/60 dark:border-white/10 dark:bg-[#141416] dark:text-white'

  return (
    <div data-testid="price-picker">
      <div role="radiogroup" aria-label="Price range" className={compact ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-2 gap-2.5 sm:grid-cols-3'}>
        {PRICE_PRESETS.map(p => {
          const sel = !custom && preset?.id === p.id
          return (
            <button key={p.id} type="button" role="radio" aria-checked={sel} onClick={() => pick(p)} className={`${chip} ${sel ? on : off}`}>
              {sel && <Check className={compact ? 'h-3 w-3' : 'h-4 w-4 text-[#C9A24D]'} strokeWidth={3} />}{p.label}
            </button>
          )
        })}
        <button type="button" role="radio" aria-checked={custom} onClick={openCustom} className={`${chip} ${custom ? on : off}`}>
          {custom ? <Check className={compact ? 'h-3 w-3' : 'h-4 w-4 text-[#C9A24D]'} strokeWidth={3} /> : <SlidersHorizontal className={compact ? 'h-3 w-3' : 'h-4 w-4'} />}Custom range
        </button>
      </div>
      {custom && (
        <div className={compact ? 'mt-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800' : 'mt-4 rounded-[22px] border-2 border-[#C9A24D]/35 bg-[#fffdf8] px-5 pb-5 pt-4 dark:bg-[#1a1712]'}>
          <p className={compact ? 'text-center text-sm font-black text-[#111827] dark:text-white' : 'text-center font-serif text-[24px] font-black text-[#111827] dark:text-white'}>{shown}</p>
          <div className={`ohp-price-range relative ${compact ? 'mt-2 h-8' : 'mt-3 h-11'}`}>
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-[#C9A24D]/15" />
            <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#a8803a] via-[#C9A24D] to-[#e8c97a]" style={{ left: `${pct(range[0])}%`, right: `${100 - pct(range[1])}%` }} />
            <input type="range" min={0} max={LAST} step={1} value={range[0]} onChange={e => move(0, Number(e.target.value))} aria-label="Lowest price" aria-valuetext={range[0] === 0 ? 'Any' : money(STOPS[range[0]])} />
            <input type="range" min={0} max={LAST} step={1} value={range[1]} onChange={e => move(1, Number(e.target.value))} aria-label="Highest price" aria-valuetext={range[1] === LAST ? 'No limit' : money(STOPS[range[1]])} />
          </div>
          <div className={`flex justify-between font-bold text-gray-400 ${compact ? 'text-[10px]' : 'text-[12px]'}`}><span>Any</span><span>$1M</span><span>No limit</span></div>
          {!compact && <p className="mt-2 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">Slide the two dots to set the lowest and highest price.</p>}
          <style>{`.ohp-price-range input[type=range]{position:absolute;inset:0;width:100%;height:100%;margin:0;background:transparent;pointer-events:none;-webkit-appearance:none;appearance:none}
.ohp-price-range input[type=range]::-webkit-slider-runnable-track{background:transparent;height:100%}
.ohp-price-range input[type=range]::-moz-range-track{background:transparent}
.ohp-price-range input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:${compact ? 22 : 30}px;height:${compact ? 22 : 30}px;margin-top:calc((${compact ? '2rem' : '2.75rem'} - ${compact ? 22 : 30}px)/2);border-radius:9999px;background:#fff;border:3px solid #C9A24D;box-shadow:0 6px 16px -6px rgba(17,24,39,.55);cursor:grab}
.ohp-price-range input[type=range]::-moz-range-thumb{pointer-events:auto;width:${compact ? 18 : 26}px;height:${compact ? 18 : 26}px;border-radius:9999px;background:#fff;border:3px solid #C9A24D;box-shadow:0 6px 16px -6px rgba(17,24,39,.55);cursor:grab}
.ohp-price-range input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 5px rgba(201,162,77,.3)}`}</style>
        </div>
      )}
    </div>
  )
}
