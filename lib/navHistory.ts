'use client'

// In-app navigation history, so back arrows go to the page the agent actually came from (e.g.
// Follow-ups opened from Dash returns to Dash, not Leads) and only fall back to a fixed parent page
// when there's nothing in-app to return to (fresh tab, shared link). sessionStorage = per tab.

const KEY = 'ohp-nav-stack'
const MAX = 40

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX)))
  } catch {}
}

/** Called on every route change (NavHistoryTracker). Pops when this is a step back. */
export function recordNav(url: string) {
  const stack = read()
  if (stack[stack.length - 1] === url) return
  if (stack[stack.length - 2] === url) stack.pop()
  else stack.push(url)
  write(stack)
}

/** True when there's an earlier in-app page this tab can step back to. */
export function hasInAppBack(): boolean {
  return read().length >= 2 && typeof window !== 'undefined' && window.history.length > 1
}

/** Back to the real previous in-app page, else to `fallbackHref`. */
export function smartBack(router: { back: () => void; push: (href: string) => void }, fallbackHref: string) {
  if (hasInAppBack()) router.back()
  else router.push(fallbackHref)
}

/** onClick for a <Link href={fallback}>: steps back in-app instead when it can. */
export function smartBackClick(router: { back: () => void }) {
  return (e: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault: () => void }) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    if (hasInAppBack()) {
      e.preventDefault()
      router.back()
    }
  }
}

/** The most recent in-app page this tab visited that isn't under `skipPrefix` (e.g. where the
 *  agent was right before opening Help, so a bug report knows where it happened). */
export function lastInAppPage(skipPrefix: string): string | null {
  const stack = read()
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!stack[i].startsWith(skipPrefix)) return stack[i]
  }
  return null
}
