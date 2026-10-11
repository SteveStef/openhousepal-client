// Everything a touch point captured (form answers, picked showing times, their message), as
// readable label/value rows for a lead's Activity timeline: dates as "Sat, Oct 3, 2026", times as
// "2:00 PM" (never 24-hour), a form's date + time question pair merged into "1st choice".

export type DetailRow = { label: string; value: string; long?: boolean }

const ORDINAL = ['1st', '2nd', '3rd', '4th']

function localDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d)
}

function niceDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function niceClock(h: number, min: number): string {
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** One answer value, as people read it. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString('en-US', { maximumFractionDigits: 2 })  // 2400 -> "2,400"
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ')
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(formatValue).filter(Boolean).join(', ')
  let s = String(value).trim()
  let m: RegExpMatchArray | null
  // 2026-10-03
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return niceDate(localDate(+m[1], +m[2], +m[3]))
  // 2026-10-03T14:00:00(Z) - a full timestamp
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return `${niceDate(d)} at ${niceClock(d.getHours(), d.getMinutes())}`
  }
  // 14:00 / 14:00:00 - a time question
  if ((m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)) && +m[1] < 24) return niceClock(+m[1], +m[2])
  // "10/03/2026 at 2:00 PM" (Showcase tour picks) - a friendlier date in front
  s = s.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/, (_, mo, d, y) => niceDate(localDate(+y, +mo, +d)))
  // "Sat, Oct 3 at 14:00" in a short value - only clearly 24-hour clocks (13:00-23:59 or a leading
  // zero), never a person's "call me at 5:30" in a message, which could be either.
  if (s.length <= 40) s = s.replace(/\b(0\d|1[3-9]|2[0-3]):([0-5]\d)(?::\d{2})?\b(?!\s*[AaPp][Mm])/g, (_, h, min) => niceClock(+h, +min))
  return s
}

/** "6105550100" / "+16105550100" -> "(610) 555-0100"; anything else as typed. */
export function formatPhone(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : (phone || '')
}

type Answer = { questionId?: string; label?: string; value?: unknown; type?: string }

const TOUR_TYPE: Record<string, string> = { in_person: 'In person', virtual: 'Virtual', video: 'Video' }

/** All the detail rows for one activity event. */
export function eventDetails(snapshot: Record<string, unknown> | null | undefined, sourceType?: string): DetailRow[] {
  if (!snapshot || typeof snapshot !== 'object') return []
  // Tied to an open house (its own request forms, or a scan of its Similar Homes QR): what they
  // wrote reads as an "Open House Note".
  const cameFrom = snapshot.came_from as { src?: string } | undefined
  const noteLabel = (sourceType || '').startsWith('open_house_') || cameFrom?.src === 'similar_qr' ? 'Open House Note' : null
  const rows: DetailRow[] = []
  const answers = Array.isArray(snapshot.answers) ? (snapshot.answers as Answer[]).filter(a => a && typeof a === 'object') : []

  // A date question + a time question for the same choice ("First choice - date" / "- time",
  // questionIds preferred_date_1 / preferred_time_1) -> one "1st choice" row.
  const slotOf = (a: Answer): { n: number; part: 'date' | 'time' } | null => {
    const id = a.questionId || ''
    let m = id.match(/^preferred_(date|time)_(\d)$/)
    if (m) return { n: +m[2], part: m[1] as 'date' | 'time' }
    m = String(a.label || '').match(/^(first|second|third)\s+choice\s*-\s*(date|time)$/i)
    if (m) return { n: ['first', 'second', 'third'].indexOf(m[1].toLowerCase()) + 1, part: m[2].toLowerCase() as 'date' | 'time' }
    return null
  }
  const slots = new Map<number, { date?: unknown; time?: unknown }>()
  for (const a of answers) {
    const s = slotOf(a)
    if (s && a.value) slots.set(s.n, { ...slots.get(s.n), [s.part]: a.value })
  }

  let slotsDone = false
  for (const a of answers) {
    const slot = slotOf(a)
    if (slot) {
      if (!slotsDone) {
        slotsDone = true
        for (const n of Array.from(slots.keys()).sort()) {
          const { date, time } = slots.get(n)!
          const value = [date && formatValue(date), time && formatValue(time)].filter(Boolean).join(' at ')
          if (value) rows.push({ label: `${ORDINAL[n - 1] || `#${n}`} choice`, value })
        }
      }
      continue
    }
    const value = a.type === 'currency' && typeof a.value === 'number'
      ? `$${a.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`  // 600000 -> "$600,000"
      : formatValue(a.value)
    if (!value) continue
    // "Preferred Time 1" (Showcase tour request) reads like the form's choices.
    const tour = String(a.label || '').match(/^preferred time (\d)$/i)
    const label = tour ? `${ORDINAL[+tour[1] - 1]} choice` : String(a.label || a.questionId || 'Answer')
    rows.push({ label, value, long: value.length > 48 })
  }

  // A review's stars.
  if (sourceType === 'review_left' && typeof snapshot.rating === 'number') {
    const stars = Math.max(0, Math.min(5, snapshot.rating))
    rows.push({ label: 'Rating', value: '★'.repeat(stars) + '☆'.repeat(5 - stars) })
  }
  // Touch points that aren't forms keep their details as top-level fields.
  const messageLabel = sourceType === 'showcase_refine' ? 'What they asked for'
    : sourceType === 'review_left' ? 'Their review'
    : sourceType === 'property_website_inquiry' || sourceType === 'property_page_inquiry' ? 'Their question'
    : noteLabel || 'Their message'
  const extra: [string, string][] = [
    ['tour_type', 'Tour'], ['requested_date', 'Requested day'], ['preferred_time', 'Preferred time'],
    ['message', messageLabel], ['content', 'Their comment'], ['notes', noteLabel || 'Their note'], ['comment', 'Their comment'],
  ]
  for (const [key, label] of extra) {
    // A Spotlight "Follow this home" tap carries a message we wrote for them - not their words.
    if (key === 'message' && snapshot.alerts) continue
    const raw = snapshot[key]
    if (raw === null || raw === undefined || raw === '') continue
    const value = key === 'tour_type' ? (TOUR_TYPE[String(raw)] || formatValue(raw)) : formatValue(raw)
    if (value && !rows.some(r => r.value === value)) rows.push({ label, value, long: value.length > 48 })
  }
  return rows
}
