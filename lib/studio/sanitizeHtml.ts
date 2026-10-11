// Minimal, dependency-free sanitizer for the inline rich text produced by the blog editor's
// contentEditable blocks (document.execCommand output: <b>/<i>/<u>/<strike>/<a href>). Content is
// authored by the agent themselves, but it's still rendered on a public page via
// dangerouslySetInnerHTML, so anything outside this whitelist (script tags, event handler
// attributes, arbitrary style attributes) is stripped rather than trusted.
//
// String-based (no DOMParser) so it gives the exact same result on the server and in the browser:
// public articles are server-rendered, and the old browser-only version returned '' on the
// server - search engines saw empty paragraphs and React flagged a hydration mismatch.
const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'a', 'br'])

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function sanitizeInlineHtml(html: string): string {
  if (!html) return ''
  let s = String(html)
  // Drop comments and anything that should never render, contents included.
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template)\b[^>]*\/?>/gi, '')
  // Every remaining tag: keep it (minus attributes) if allowed, otherwise unwrap it (text stays).
  // Then any "<" that isn't one of the rebuilt allowed tags (an unclosed "<img onerror=..." with
  // no ">") becomes text, so nothing half-formed ever reaches the browser's HTML parser.
  return s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawName: string, attrs: string) => {
    const name = rawName.toLowerCase()
    if (!ALLOWED_TAGS.has(name)) return ''
    const closing = full.startsWith('</')
    if (closing) return name === 'br' ? '' : `</${name}>`
    if (name === 'br') return '<br>'
    if (name === 'a') {
      const m = attrs.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const href = (m ? (m[2] ?? m[3] ?? m[4] ?? '') : '').trim()
      const safe = /^(https?:|mailto:)/i.test(href) ? ` href="${escapeAttr(href)}"` : ''
      return `<a${safe} target="_blank" rel="noreferrer">`
    }
    return `<${name}>`
  }).replace(/<(?!\/?(?:b|strong|i|em|u|s|strike|a|br)\b[^<>]*>)/gi, '&lt;')
}
