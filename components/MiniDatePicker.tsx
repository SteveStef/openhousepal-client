'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react'

// A small, self-contained calendar-popover date field. Used in place of <input type="date"> so the
// picker looks and behaves the same in every browser (Safari renders the native one as bare
// steppers) and so past days are visibly greyed out rather than just rejected on submit.

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

interface MiniDatePickerProps {
  value: string // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void
  disabled?: boolean
  /** Earliest selectable day. Defaults to today - earlier days render greyed and can't be picked. */
  minDate?: Date
  id?: string
  placeholder?: string
  className?: string
}

export default function MiniDatePicker({
  value,
  onChange,
  disabled,
  minDate,
  id,
  placeholder = 'Select a date',
  className = '',
}: MiniDatePickerProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const min = useMemo(() => {
    const base = minDate ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), base.getDate())
  }, [minDate])
  const today = useMemo(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  }, [])

  const selected = parseYmd(value)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = selected || min
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  useEffect(() => {
    const s = parseYmd(value)
    if (s) setViewMonth(new Date(s.getFullYear(), s.getMonth(), 1))
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const firstDow = viewMonth.getDay()
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))
  while (cells.length % 7 !== 0) cells.push(null)

  const canPrev = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1) > new Date(min.getFullYear(), min.getMonth(), 1)

  const label = selected
    ? selected.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all disabled:opacity-60 ${
          open ? 'border-[#C9A24D] ring-4 ring-[#C9A24D]/10' : 'border-gray-200 hover:border-[#C9A24D]/30 dark:border-gray-700'
        } bg-white text-[#0B0B0B] dark:bg-[#0B0B0B] dark:text-white`}
      >
        <CalIcon size={15} className="shrink-0 text-[#C9A24D]" />
        <span className={selected ? '' : 'text-gray-400 dark:text-gray-600'}>{label}</span>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-[17rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-[#151517]">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => canPrev && setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              disabled={!canPrev}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-xs font-black uppercase tracking-wide text-[#0B0B0B] dark:text-white">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {DOW.map(d => (
              <div key={d} className="py-1 text-center text-[9px] font-black uppercase text-gray-400">{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const past = d < min
              const isSel = !!selected && ymd(d) === ymd(selected)
              const isToday = ymd(d) === ymd(today)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={past}
                  onClick={() => { onChange(ymd(d)); setOpen(false) }}
                  className={`aspect-square rounded-lg text-xs font-bold transition-colors ${
                    isSel
                      ? 'bg-[#C9A24D] text-[#111827]'
                      : past
                        ? 'cursor-not-allowed text-gray-300 dark:text-gray-700'
                        : 'text-[#0B0B0B] hover:bg-[#C9A24D]/15 dark:text-gray-200'
                  } ${isToday && !isSel ? 'ring-1 ring-inset ring-[#C9A24D]/50' : ''}`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
