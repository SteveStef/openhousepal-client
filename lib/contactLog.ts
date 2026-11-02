import type { ContactLogEntry } from '@/types'

// How the agent already reached a lead, in words (owner, 11/02): "Texted · Showcase pitch",
// "Emailed", "Followed up · Open house sign-in follow-up" (a follow-up checked off without its
// Text / Email button). Shared by the Leads list, the lead page and the Visitors list.

const VIA: Record<string, string> = { text: 'Texted', email: 'Emailed', call: 'Called' }

export function contactLabel(e: ContactLogEntry): string {
  const how = (e.via && VIA[e.via]) || 'Followed up'
  return e.what ? `${how} · ${e.what}` : how
}

/** The newest entry, or null. */
export function lastContact(log?: ContactLogEntry[] | null): ContactLogEntry | null {
  return log && log.length ? log[log.length - 1] : null
}

export function contactWhen(at: string): string {
  const d = new Date(at)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? `today, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}
