export function formatEventDate(dateStr?: string | null) {
  if (!dateStr) return 'Unknown date'
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(timeStr?: string | null) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
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
