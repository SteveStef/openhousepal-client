// The Email Tracker button's number on Leads: people the rules just slowed down, until the agent has
// looked (owner, 11/07: it stayed on after looking and never said what it counted).
const KEY = 'ohp_email_slowed_seen'

export function slowedSeen(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(KEY) || '[]'))
  } catch {
    return new Set()
  }
}

export function markSlowedSeen(emails: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(emails.map(e => e.toLowerCase())))
  } catch { /* private window: the number just stays */ }
}

export const isSlowed = (code?: string | null) => code === 'unopened_days' || code === 'weekly_unopened'
