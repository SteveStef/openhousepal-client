// Upcoming open houses a listing has scheduled in Bright MLS, as the public endpoints send them
// (Agent Hub listings, IDX listing cards + property detail) - soonest first, see
// backend app/services/mls_open_houses.py open_houses_payload. Times are "HH:MM" (24h).
export type MlsOpenHouse = { date: string; start?: string | null; end?: string | null }

const parseDate = (date: string) => new Date(`${date}T00:00:00`)

// "1 PM", "1:30 PM" - drops ":00" so a chip stays short.
function clock(time?: string | null) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h)) return null
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return { text: m ? `${hour12}:${String(m).padStart(2, '0')}` : `${hour12}`, period }
}

// "1–3 PM", "11 AM–1 PM", "1 PM" (no end), "" (no time at all).
export function formatOpenHouseTime(start?: string | null, end?: string | null) {
  const s = clock(start)
  const e = clock(end)
  if (!s) return ''
  if (!e) return `${s.text} ${s.period}`
  return s.period === e.period ? `${s.text}–${e.text} ${e.period}` : `${s.text} ${s.period}–${e.text} ${e.period}`
}

// "Sat, Oct 4" ("Sat 10/4" when short, for tight cards)
export function formatOpenHouseDay(date: string, short = false) {
  const d = parseDate(date)
  if (short) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// "Sat, Oct 4 · 1–3 PM"
export function formatOpenHouse(oh: MlsOpenHouse, short = false) {
  const time = formatOpenHouseTime(oh.start, oh.end)
  return time ? `${formatOpenHouseDay(oh.date, short)} · ${time}` : formatOpenHouseDay(oh.date, short)
}

// Still-upcoming ones only (the page may have been cached since the backend filtered them),
// soonest first. Uses the viewer's local date - the same calendar day the listing shows.
export function upcomingOpenHouses(list?: MlsOpenHouse[] | null) {
  if (!Array.isArray(list)) return []
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return list
    .filter(oh => oh && typeof oh.date === 'string' && oh.date >= today)
    .sort((a, b) => `${a.date} ${a.start || ''}`.localeCompare(`${b.date} ${b.start || ''}`))
}
