// One random id per Guest Pass visit (kept for the tab's life, so a refresh is the same visit) -
// groups what a guest does on their pass into visits for the agent's activity log (Visitors window).
export function passSessionId(token: string): string {
  const key = `gp-visit:${token}`
  try {
    const have = sessionStorage.getItem(key)
    if (have) return have
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    sessionStorage.setItem(key, id)
    return id
  } catch {
    return 'nostore-' + token.slice(0, 8)
  }
}
