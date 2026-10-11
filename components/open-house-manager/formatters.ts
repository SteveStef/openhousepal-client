export function formatEventDate(dateStr?: string | null) {
  if (!dateStr) return 'Unknown date'
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// Compact "Aug 15" form - for small chips where the full weekday/year is too long.
export function formatShortDate(dateStr?: string | null) {
  if (!dateStr) return 'TBD'
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// "Sat, Sep 5" - same as formatShortDate but with the weekday, so an agent scanning a list of
// already-taken dates doesn't have to look up what day of the week each one falls on.
export function formatShortDateWithDay(dateStr?: string | null) {
  if (!dateStr) return 'TBD'
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatTime(timeStr?: string | null) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// Fixed 30-minute-interval time slots for the whole day (00:00, 00:30, ... 23:30) - used for
// Start/End time <select> pickers so an agent can only ever pick a value on the 30-minute grid,
// unlike a native <input type="time">, which lets typed input ignore its `step`.
export const TIME_SLOT_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return { value, label: `${hour12}:${String(m).padStart(2, '0')} ${period}` }
})

// End-time options for a given start time - every 30-minute slot after `startTime` up to 5 hours
// later (capped at the last slot of the day), so open houses can't be scheduled longer than that.
export function endTimeOptionsFor(startTime?: string | null): { value: string; label: string }[] {
  if (!startTime) return TIME_SLOT_OPTIONS
  const [h, m] = startTime.split(':').map(Number)
  const startMinutes = h * 60 + m
  const maxMinutes = Math.min(startMinutes + 5 * 60, 23 * 60 + 30)
  return TIME_SLOT_OPTIONS.filter(opt => {
    const [oh, om] = opt.value.split(':').map(Number)
    const optMinutes = oh * 60 + om
    return optMinutes > startMinutes && optMinutes <= maxMinutes
  })
}

// "9:53-10:54 AM" instead of "9:53 AM-10:54 AM" when both ends share the same AM/PM - the weekend
// mini calendars need the whole range on one line and the repeated period was the widest part of
// the string for no added information.
export function formatTimeRangeCompact(startTime?: string | null, endTime?: string | null) {
  // Also drops ":00" for on-the-hour times ("4:00 PM" -> "4 PM") - only here, not in formatTime
  // itself, since full displays elsewhere (Already Scheduled, Host Notes) should keep it. A range
  // with a differing AM/PM on each end (so the shared-period collapse below doesn't apply) is the
  // longest case these mini calendar cells have to fit, and this alone was often enough on its own
  // to push it over the edge - e.g. "11:30 AM-4:00 PM" -> "11:30 AM-4 PM".
  const compact = (t?: string | null) => formatTime(t)?.replace(':00 ', ' ') || null
  const start = compact(startTime)
  const end = compact(endTime)
  if (!start) return null
  if (!end) return start
  const startPeriod = start.slice(-2)
  const endPeriod = end.slice(-2)
  return startPeriod === endPeriod ? `${start.slice(0, -3)}-${end}` : `${start}-${end}`
}

export function formatDuration(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return null
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const minutes = (eh * 60 + em) - (sh * 60 + sm)
  if (minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours === 0) return `${remaining} min`
  if (remaining === 0) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${hours} hr ${remaining} min`
}
