'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Drop-in replacement for <input type="date"> that visually crosses out (and disables) dates
// already taken for this listing, so an agent never picks a date only to find out afterward it's
// spoken for.
export default function TakenDatesPicker({
  value,
  onChange,
  takenDates,
  minDate,
  placeholder = 'Select a date',
  buttonClassName,
}: {
  value: string
  onChange: (date: string) => void
  takenDates: Set<string>
  minDate?: string
  placeholder?: string
  // Override the trigger button's sizing/text classes to match whatever sibling inputs it sits
  // next to - the calendar popover itself always looks the same.
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(`${value}T00:00:00`) : new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const min = minDate ? new Date(`${minDate}T00:00:00`) : today

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const displayLabel = value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={buttonClassName || 'flex w-full items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] px-3 py-2 text-left text-xs font-semibold outline-none focus:border-[#C9A24D] dark:text-white'}
      >
        <Calendar size={13} className="shrink-0 text-gray-400" />
        <span className={`truncate ${value ? '' : 'text-gray-400'}`}>{displayLabel}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#151517] p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Previous month">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-black text-[#111827] dark:text-white">{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Next month">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase text-gray-400">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const iso = toIso(d)
              const isTaken = takenDates.has(iso)
              const isPast = d < min
              const isSelected = value === iso
              const disabled = isTaken || isPast
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(iso); setOpen(false) }}
                  className={`h-7 rounded-lg text-[11px] font-bold transition ${
                    isSelected
                      ? 'bg-[#C9A24D] text-white'
                      : isTaken
                        ? 'cursor-not-allowed text-gray-300 line-through dark:text-gray-700'
                        : isPast
                          ? 'cursor-not-allowed text-gray-200 dark:text-gray-800'
                          : 'text-gray-700 hover:bg-[#C9A24D]/10 dark:text-gray-200'
                  }`}
                  title={isTaken ? 'Already scheduled' : undefined}
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
