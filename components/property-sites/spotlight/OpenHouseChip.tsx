'use client'

import { useEffect, useState } from 'react'
import { fmtDay, fmtTimeRange, type PropertySiteOpenHouse } from './model'

// The open house next to the listing status at the top of both templates - read live (Open
// House Manager + the MLS, refreshed on every page load), and aware of the clock: "Open house
// now" with a live dot while it's on, "today" earlier that day, the date before that, and
// nothing once it has ended.
type State = 'now' | 'today' | 'later' | 'over'

function minutes(t?: string | null): number | null {
  if (!t) return null
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return Number.isFinite(h) ? h * 60 + (m || 0) : null
}

export function openHouseState(oh: PropertySiteOpenHouse, now = new Date()): State {
  const day = (oh.date || '').slice(0, 10)
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (day > today) return 'later'
  if (day < today) return 'over'
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const start = minutes(oh.start_time)
  const end = minutes(oh.end_time)
  if (end != null && nowMin >= end) return 'over'
  if (start != null && nowMin >= start) return 'now'
  return 'today'
}

// dateOnly: the header pill (user, 10/24) - just the day, no hours; the times are one tap away in
// the open-house rows right under the header.
export default function OpenHouseChip({ oh, className, onClick, dateOnly = false }: { oh: PropertySiteOpenHouse; className: string; onClick?: () => void; dateOnly?: boolean }) {
  // Server render shows the date; the live state settles in on the visitor's own clock.
  const [state, setState] = useState<State>('later')
  useEffect(() => {
    const tick = () => setState(openHouseState(oh))
    tick()
    const t = window.setInterval(tick, 60_000)
    return () => window.clearInterval(t)
  }, [oh])
  if (state === 'over') return null
  const time = dateOnly ? null : fmtTimeRange(oh.start_time, oh.end_time)
  const end = dateOnly ? null : fmtTimeRange(oh.end_time, null)
  return (
    <button onClick={onClick} className={`${className} ohc ${state === 'now' ? 'is-now' : ''}`}>
      <style>{`.ohc{display:inline-flex;align-items:center;gap:7px}.ohc i{position:relative;display:inline-block;width:7px;height:7px;border-radius:999px;background:#22c55e}.ohc i:after{content:"";position:absolute;inset:-4px;border-radius:999px;background:#22c55e;opacity:.5;animation:ohcPing 1.6s ease-out infinite}@keyframes ohcPing{from{transform:scale(.4);opacity:.6}to{transform:scale(1.6);opacity:0}}@media(prefers-reduced-motion:reduce){.ohc i:after{animation:none}}`}</style>
      {state === 'now' ? (
        <><i aria-hidden />Open house now{end ? ` · until ${end}` : ''}</>
      ) : state === 'today' ? (
        <><i aria-hidden style={{ background: '#f59e0b' }} />Open house today{time ? ` · ${time}` : ''}</>
      ) : (
        <>Open house · {fmtDay(oh.date, 'short')}{time ? ` · ${time}` : ''}</>
      )}
    </button>
  )
}
