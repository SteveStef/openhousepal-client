// Where a visitor came from, kept for their visit to one Spotlight / listing page and sent along
// with their message or tour request (backend services/visit_source.py describes it for the agent).
//
// Links we hand out carry `?src=` (+ `oh=` for an open house): the per-home QR codes on an open
// house's Similar Homes sheet (src=similar_qr&oh=<id>), the Agent Hub (src=hub), the email
// signature (src=email). No tag -> the referring site's host (Google, Facebook...), else {} for a
// link opened directly. Remembered in sessionStorage, so browsing around the page before writing
// in doesn't lose it.

export type CameFrom = { src?: string; oh?: string; ref?: string }

const key = (scope: string) => `ohp:came_from:${scope}`

export function visitSource(scope: string): CameFrom {
  if (typeof window === 'undefined') return {}
  try {
    const params = new URLSearchParams(window.location.search)
    const src = params.get('src') || undefined
    if (src) {
      const oh = params.get('oh') || undefined
      const tagged: CameFrom = oh ? { src, oh } : { src }
      sessionStorage.setItem(key(scope), JSON.stringify(tagged))
      return tagged
    }
    const saved = sessionStorage.getItem(key(scope))
    if (saved) return JSON.parse(saved) as CameFrom
    let ref: string | undefined
    try {
      const host = document.referrer ? new URL(document.referrer).hostname : ''
      if (host && host !== window.location.hostname) ref = host
    } catch { /* no / odd referrer */ }
    const found: CameFrom = ref ? { ref } : {}
    sessionStorage.setItem(key(scope), JSON.stringify(found))
    return found
  } catch {
    return {}
  }
}
