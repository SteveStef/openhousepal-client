// A social/website link as a working absolute URL: " instagram.com/x" -> "https://instagram.com/x".
// Anything that isn't a web address ("aw", a stray word) -> null, so it never becomes a dead link.
// Same rule as the backend's content_adapters.public_web_url.
const WEB_URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i

export function publicWebUrl(value?: string | null): string | null {
  const v = (value || '').trim()
  if (!v || !WEB_URL_RE.test(v)) return null
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}
