// The sign-in page -> Guest Pass handoff (user, 10/24): the moment a guest answers the last sign-in
// question, the sign-in page plays the Guest Pass opening (GuestPassIntro) over itself and holds it
// on the home's photo + "Welcome, {name}" until their pass link is back; the pass page then opens
// on that same held frame and parts the curtain as soon as its data is in - one unbroken opening,
// no loader, no logo. In memory first (a client-side navigation: readable on the very first
// render, so no flash), sessionStorage as the fallback (a full page load).

export type PassHandoff = {
  firstName: string
  street: string
  photo?: string
  coverPosition?: { x: number; y: number } | null
  accent?: string
  /** When the opening began (Date.now()) - the pass page carries on from that moment. */
  startedAt?: number
}

const mem = new Map<string, PassHandoff>()
const key = (token: string) => `gp-handoff:${token}`

export function setPassHandoff(token: string, h: PassHandoff) {
  mem.set(token, h)
  try { sessionStorage.setItem(key(token), JSON.stringify(h)) } catch { /* private mode */ }
}

/** Safe during render: only the in-memory copy (empty on the server and on a fresh page load). */
export function peekPassHandoff(token: string): PassHandoff | null {
  return mem.get(token) || null
}

/** After mount: the in-memory copy, else the sessionStorage one. */
export function readPassHandoff(token: string): PassHandoff | null {
  const m = mem.get(token)
  if (m) return m
  try {
    const raw = sessionStorage.getItem(key(token))
    return raw ? (JSON.parse(raw) as PassHandoff) : null
  } catch { return null }
}

export function clearPassHandoff(token: string) {
  mem.delete(token)
  try { sessionStorage.removeItem(key(token)) } catch { /* private mode */ }
}

/** The token at the end of a Guest Pass link (/open-house/<id>/pass/<token>). */
export function passTokenOf(url: string): string | null {
  const m = /\/pass\/([^/?#]+)/.exec(url)
  return m ? decodeURIComponent(m[1]) : null
}
