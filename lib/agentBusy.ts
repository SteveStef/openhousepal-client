// The agent's busy blocks (from their connected Google / Outlook calendar) as the client's time
// pickers use them: a suggested time is crossed out when a showing then would overlap something
// already on the agent's calendar (user, 10/18 - "showings only offered when the agent is free").

export type BusyBlock = { start: string; end: string }

/** "2:00 PM" on a given day (the visitor's own clock) -> Date. */
export function atTime(day: Date | string, label: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim())
  if (!m) return null
  let h = Number(m[1]) % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  const d = typeof day === 'string' ? new Date(`${day}T00:00:00`) : new Date(day)
  d.setHours(h, Number(m[2]), 0, 0)
  return d
}

/** True when a showing starting then (default 1 hour) overlaps one of the agent's busy blocks. */
export function busyAt(busy: BusyBlock[] | null | undefined, start: Date | null, minutes = 60): boolean {
  if (!busy?.length || !start) return false
  const s = start.getTime(), e = s + minutes * 60_000
  return busy.some(b => {
    const bs = Date.parse(b.start), be = Date.parse(b.end)
    return Number.isFinite(bs) && Number.isFinite(be) && bs < e && be > s
  })
}
