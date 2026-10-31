import type { InviteDraft } from '@/lib/invites'

// Invite drafts (owner, 10/31: "clicking outside closes it and I lose everything"). The maker saves
// what's been filled in as it goes - in this browser, per login - so closing it any way (outside
// click, Escape, X, a reload) keeps the invite, and the Invites page offers "Continue" / "Discard".
// A new invite gets its own draft id; unsaved changes to an existing invite use "edit:<id>" and are
// only offered back while that invite hasn't changed since (base = its updated_at).

export type InviteDraftSave = {
  id: string
  /** The saved invite these are changes to (null = a new invite). */
  inviteId: string | null
  base: string | null
  draft: InviteDraft
  step: number
  touched: { title: boolean; message: boolean; address: boolean }
  at: number
}

export const DRAFTS_EVENT = 'ohp-invite-drafts'
const MAX = 8
const key = (uid: string) => `ohp-invite-drafts:${uid}`

export function readDrafts(uid?: string | null): InviteDraftSave[] {
  if (!uid) return []
  try {
    const list = JSON.parse(localStorage.getItem(key(uid)) || '[]')
    return Array.isArray(list) ? (list as InviteDraftSave[]).filter(d => d && d.id && d.draft).sort((a, b) => b.at - a.at) : []
  } catch { return [] }
}

function write(uid: string, list: InviteDraftSave[]) {
  try { localStorage.setItem(key(uid), JSON.stringify(list.slice(0, MAX))) } catch { /* private mode / full - the maker still works */ }
  try { window.dispatchEvent(new Event(DRAFTS_EVENT)) } catch { /* no window */ }
}

export function putDraft(uid: string | null | undefined, d: InviteDraftSave) {
  if (!uid) return
  write(uid, [d, ...readDrafts(uid).filter(x => x.id !== d.id)])
}

export function dropDraft(uid: string | null | undefined, id: string) {
  if (!uid) return
  const list = readDrafts(uid)
  if (list.some(x => x.id === id)) write(uid, list.filter(x => x.id !== id))
}

export const newDraftId = () => `new:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** "just now", "5 min ago", "2 hours ago", "Oct 30". */
export function savedAgo(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) { const h = Math.round(s / 3600); return `${h} hour${h === 1 ? '' : 's'} ago` }
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
