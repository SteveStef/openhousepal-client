// Day-granularity relative time ("Today" / "Yesterday" / "N days ago") for contact/lead cards.
// Deliberately never falls back to an absolute calendar date - exact timestamps belong in the
// full activity history, not the card.
export function formatRelativeDay(dateString?: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86400000)
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

// Exact date + time (e.g. "Aug 6, 2:15 PM") for activity feeds/timelines where "2 days ago" isn't
// specific enough to know exactly when something happened.
export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Today as "YYYY-MM-DD" in the viewer's own time zone. Never `new Date().toISOString().slice(0, 10)`
 * - that's London time, so after 8 PM Eastern it already says tomorrow. */
export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
