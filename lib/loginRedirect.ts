// Sending a signed-out agent to the login page and back (user, 10/24): an agent who clicks a link in
// an OpenHousePal email while signed out must land on THAT page after signing in - the whole link,
// query and #anchor included (/leads/tasks?task=..., /showcases?showcase=...&property=...), not just
// its path or the Dash.

/** The page we're on now, as a path that can be sent back to after login. */
export function currentPathForLogin(): string {
  if (typeof window === 'undefined') return '/dash'
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}

/** /login?redirect=<this page> */
export function loginUrlForHere(path: string = currentPathForLogin()): string {
  return `/login?redirect=${encodeURIComponent(path)}`
}

/** Where to go after a successful login: the ?redirect= path when it's one of ours, else the Dash.
 *  Only same-site paths ("/..." but never "//host" or "/\\host") - no sending people off-site. */
export function safeRedirect(raw: string | null | undefined, fallback = '/dash'): string {
  const v = (raw || '').trim()
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback
  if (v.startsWith('/login') || v.startsWith('/register')) return fallback
  return v
}
