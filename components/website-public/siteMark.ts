// The agent's monogram for the site's loading mark (SiteLoader) - shared by the server (SiteShell)
// and the browser, so it lives outside the 'use client' file.
export function initialsOf(name?: string | null) {
  const words = String(name || '').replace(/[0-9_.,()&@#"!?/]+/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}
