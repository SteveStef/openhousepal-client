// "Email them" links for the tap-to-text page (user, 10/25). Phones open their default mail app
// (mailto - iPhone and Android both honour the chosen default). Computers often have no mail app
// behind mailto, so they pick Gmail / Outlook on the web / the default app / copy - remembered per
// device. Gmail and Outlook compose links break past ~2,000 characters, so the body is trimmed to
// fit (the sign-off and the link at the bottom are always kept).
import { mailHref } from '@/lib/smsLink'

export type MailChoice = 'gmail' | 'outlook' | 'default' | 'copy'

export const MAIL_CHOICE_LABEL: Record<MailChoice, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  default: 'Default mail app',
  copy: 'Copy message',
}

const MAX_URL = 1900
const KEY = 'ohp:mail-choice'

export function savedMailChoice(): MailChoice | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'gmail' || v === 'outlook' || v === 'default' || v === 'copy' ? v : null
  } catch { return null }
}

export function saveMailChoice(c: MailChoice) {
  try { localStorage.setItem(KEY, c) } catch { /* private mode */ }
}

const enc = encodeURIComponent
const crlf = (s: string) => s.replace(/\r?\n/g, '\r\n')

export function gmailUrl(to: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`
}

export function outlookUrl(to: string, subject: string, body: string): string {
  return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(crlf(body))}`
}

/** The body, shortened (whole sentences first, then words) until `build(body)` fits - keeping the
 *  last blocks (the "Your Showcase: link" line and the sign-off) intact. */
export function fitBody(body: string, build: (b: string) => string, max = MAX_URL): string {
  if (build(body).length <= max) return body
  const blocks = body.split('\n\n')
  const keepFrom = blocks.findIndex(b => /^(Your Showcase|Here's the link):|^Best regards,/.test(b))
  const head = (keepFrom > 0 ? blocks.slice(0, keepFrom) : blocks).join('\n\n')
  const tail = keepFrom > 0 ? blocks.slice(keepFrom).join('\n\n') : ''
  let cut = head
  while (cut.length > 40) {
    const sentenceEnd = Math.max(cut.lastIndexOf('. ', cut.length - 3), cut.lastIndexOf('\n'))
    cut = sentenceEnd > 40 ? cut.slice(0, sentenceEnd + 1) : cut.slice(0, cut.lastIndexOf(' ', cut.length - 2))
    const candidate = `${cut.trimEnd()} …${tail ? `\n\n${tail}` : ''}`
    if (build(candidate).length <= max) return candidate
  }
  return tail || head.slice(0, 200)
}

export function composeHref(choice: Exclude<MailChoice, 'copy'>, to: string, subject: string, body: string): string {
  if (choice === 'gmail') return gmailUrl(to, subject, fitBody(body, b => gmailUrl(to, subject, b)))
  if (choice === 'outlook') return outlookUrl(to, subject, fitBody(body, b => outlookUrl(to, subject, b)))
  return mailHref(to, subject, fitBody(body, b => mailHref(to, subject, b)))
}

// ---- phone apps (10/25): open the app itself, falling back to its web compose / mailto ----
const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

/** The app link for a phone pick + where to go if the app isn't installed (or null = no fallback needed). */
export function phoneAppLinks(choice: Exclude<MailChoice, 'copy'>, to: string, subject: string, body: string): { href: string; fallback: string | null } {
  if (choice === 'gmail') {
    const web = gmailUrl(to, subject, fitBody(body, b => gmailUrl(to, subject, b)))
    const b = fitBody(body, x => `googlegmail://co?to=${enc(to)}&subject=${enc(subject)}&body=${enc(x)}`)
    const q = `to=${enc(to)}&subject=${enc(subject)}&body=${enc(b)}`
    // Android: an intent that opens Gmail, or its web compose when Gmail isn't installed.
    if (isAndroid()) return { href: `intent://co?${q}#Intent;scheme=googlegmail;package=com.google.android.gm;S.browser_fallback_url=${enc(web)};end`, fallback: null }
    return { href: `googlegmail://co?${q}`, fallback: web }
  }
  if (choice === 'outlook') {
    const web = outlookUrl(to, subject, fitBody(body, b => outlookUrl(to, subject, b)))
    const b = fitBody(body, x => `ms-outlook://compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(x)}`)
    return { href: `ms-outlook://compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(b)}`, fallback: web }
  }
  return { href: mailHref(to, subject, fitBody(body, b => mailHref(to, subject, b))), fallback: null }
}

/** Opens a phone app link; if the page is still showing ~1.5s later (app not installed), goes to
 *  the fallback instead. Leaving the page (the app opened) cancels the fallback. */
export function openWithFallback(href: string, fallback: string | null, wait = 1500) {
  // Kept for checking what was opened (tests / support) - nothing reads it in the app.
  ;(window as unknown as { __ohpMailOpen?: unknown }).__ohpMailOpen = { href, fallback }
  if (!fallback) { window.location.href = href; return }
  let left = false
  const gone = () => { left = true }
  document.addEventListener('visibilitychange', gone, { once: true })
  window.addEventListener('pagehide', gone, { once: true })
  window.addEventListener('blur', gone, { once: true })
  window.location.href = href
  window.setTimeout(() => {
    document.removeEventListener('visibilitychange', gone)
    window.removeEventListener('pagehide', gone)
    window.removeEventListener('blur', gone)
    if (!left && document.visibilityState === 'visible') window.location.href = fallback
  }, wait)
}

export const PHONE_MAIL_LABEL: Record<MailChoice, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  default: 'Default mail app',
  copy: 'Copy message',
}

/** The chooser's order: the mailbox they connected for send-as-agent first. */
export function mailChoices(connected?: 'gmail' | 'outlook' | null): MailChoice[] {
  const web: MailChoice[] = connected === 'outlook' ? ['outlook', 'gmail'] : ['gmail', 'outlook']
  return [...web, 'default', 'copy']
}
