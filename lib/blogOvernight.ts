// Save usage mode (owner 11/14) - the default way to write an article: the same researched, fact-checked article
// for about half the AI usage, because it is made in a slower, half-price line. The agent is alerted when it is
// ready. (First built as "overnight" - the code and the API still use that word; agents never see it.)

/** "9:40 PM", "tomorrow 6:10 AM" or "Sat 6:10 AM" - a ready time the way a person would say it. */
export function readyClock(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  const tomorrow = new Date(now.getTime() + 86_400_000)
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`
}

/** What a Save usage article uses, as a range: "2.6% to 4.9%" (the slower line answered every step, at best; the
 *  30-minute cap finished it the fast way, at worst), or just the one figure when there is no worst case to show. */
export function usageRange(low?: number | null, high?: number | null): string | null {
  const a = usagePct(low)
  const b = usagePct(high)
  if (!a) return null
  return b && b !== a ? `${a}% to ${b}%` : `${a}%`
}

/** A share of the month's AI usage as the agent reads it: "4.5", "2", "<0.1". Null when there is no allowance to compare with. */
export function usagePct(percent?: number | null): string | null {
  if (percent == null || Number.isNaN(percent)) return null
  if (percent < 0.1) return '<0.1'
  return percent < 10 ? percent.toFixed(1).replace(/\.0$/, '') : String(Math.round(percent))
}
