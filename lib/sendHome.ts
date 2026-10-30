// "Send" a home (or several) from the agent's view of a client's Showcase (user, 10/30). The
// agent's own phone / computer sends it: Messages (sms:) or their email app, already written. The
// link is that home inside the client's own Showcase (/showcase/dana-k7q2/732-buck-ln), which
// previews as the one-home Showcase card (lib/og/cards ShowcaseHomeCard). No agent footer.
import type { Property } from '@/types'
import { homeSlug, showcaseHomesLabel } from '@/lib/showcaseLink'
import { smsHref, isPhoneDevice } from '@/lib/smsLink'
import { composeHref, phoneAppLinks, openWithFallback, MAIL_CHOICE_LABEL } from '@/lib/mailCompose'
import { cleanAddress } from '@/lib/utils'

export type SendMethod = 'text' | 'email'
export type SendMailApp = 'gmail' | 'outlook' | 'default'

/** The intro every agent starts with. {client} / {agent} are filled with first names. */
export const DEFAULT_SEND_MESSAGE = "Hey {client}, it's {agent}! I found a property that might interest you."

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The saved message with this client's and agent's first names in it. */
export function fillSendMessage(template: string | null | undefined, client: string, agent: string): string {
  return (template || DEFAULT_SEND_MESSAGE)
    .replace(/\{client\}/g, client || 'there')
    .replace(/\{agent\}/g, agent || 'your agent')
}

/** The message as the agent edited it, turned back into a message for every client: this client's
 *  and the agent's first names become {client} / {agent} again. */
export function toSendTemplate(text: string, client: string, agent: string): string {
  let t = text.trim()
  if (client) t = t.replace(new RegExp(`\\b${esc(client)}\\b`, 'g'), '{client}')
  if (agent) t = t.replace(new RegExp(`\\b${esc(agent)}\\b`, 'g'), '{agent}')
  return t
}

/** The agent's message plus how many homes the client's Showcase holds right now ("You have 12
 *  homes in your Showcase.") - added at send time, never saved into the agent's own message. */
export function withShowcaseCount(text: string, homeCount: number): string {
  const t = text.trim()
  if (!t || homeCount <= 0) return t
  return `${/[.!?]$/.test(t) ? t : `${t}.`} You have ${showcaseHomesLabel(homeCount)} in your Showcase.`
}

/** A home's own address inside the client's Showcase. */
export function sendHomeLink(showcaseUrl: string, p: Property): string {
  const slug = homeSlug(p.FullStreetAddress)
  return slug ? `${showcaseUrl.replace(/\/$/, '')}/${slug}` : `${showcaseUrl}?property=${encodeURIComponent(String(p.id))}`
}

/** What goes after /showcase/<token>/ for a home - the og card's ?home=. */
export function sendHomeKey(p: Property): string {
  return homeSlug(p.FullStreetAddress) || String(p.id)
}

const titleCase = (s?: string | null) => {
  const t = String(s || '').trim()
  return t && t === t.toUpperCase() ? t.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : t
}
export const homeStreet = (p: Property) => titleCase(cleanAddress(p.FullStreetAddress, p.City).split(',')[0]) || 'A home'
const money = (n?: number | null) => (n ? `$${Math.round(n).toLocaleString('en-US')}` : '')

/** "732 Buck Ln, Malvern - $725,000 · 4 bd · 3 ba" (an email's line for one home). */
function homeLine(p: Property): string {
  const facts = [money(p.ListPrice), p.BedroomsTotal ? `${p.BedroomsTotal} bd` : '', p.BathroomsTotal ? `${p.BathroomsTotal} ba` : ''].filter(Boolean).join(' · ')
  return [[homeStreet(p), titleCase(p.City)].filter(Boolean).join(', '), facts].filter(Boolean).join(' - ')
}

/** A text: the message (when ticked), then each link on its own line - each one previews as its
 *  own home card. */
export function sendTextBody(message: string | null, links: string[]): string {
  return [message?.trim(), ...links].filter(Boolean).join('\n\n')
}

export function sendEmailSubject(homes: Property[]): string {
  return homes.length === 1 ? `A home for you: ${homeStreet(homes[0])}` : `${homes.length} homes for you`
}

/** An email: the message, then each home - its street, price and beds / baths over its link. Too
 *  long for a Gmail / Outlook compose link: just the links. */
export function sendEmailBody(message: string | null, homes: Property[], links: string[], compact = false): string {
  const list = homes.map((p, i) => (compact ? links[i] : `${homeLine(p)}\n${links[i]}`))
  return [message?.trim(), ...list].filter(Boolean).join('\n\n')
}

const MAX_URL = 1900

/** The email body that fits the app's compose link, and how many homes made it in. */
export function fitSendEmail(app: SendMailApp, to: string, message: string | null, homes: Property[], links: string[]): { body: string; count: number } {
  const subject = sendEmailSubject(homes)
  const fits = (b: string) => composeHref(app, to, subject, b).length <= MAX_URL
  const full = sendEmailBody(message, homes, links)
  if (fits(full)) return { body: full, count: homes.length }
  const compact = sendEmailBody(message, homes, links, true)
  if (fits(compact)) return { body: compact, count: homes.length }
  for (let n = homes.length - 1; n >= 1; n--) {
    const b = sendEmailBody(message, homes.slice(0, n), links.slice(0, n), true)
    if (fits(b)) return { body: b, count: n }
  }
  return { body: compact, count: homes.length }
}

export const SEND_APP_LABEL: Record<SendMailApp, string> = {
  gmail: MAIL_CHOICE_LABEL.gmail,
  outlook: MAIL_CHOICE_LABEL.outlook,
  default: 'Mail app',
}

/** Remembers what was opened (tests / support) - nothing in the app reads it. */
function note(href: string, extra?: Record<string, unknown>) {
  ;(window as unknown as { __ohpSendOpen?: unknown }).__ohpSendOpen = { href, ...extra }
}

/** Opens Messages with the text written (and the client's number, when there is one). */
export function openSendText(phone: string | null | undefined, body: string) {
  const href = phone ? smsHref(phone, body) : `sms:${/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`
  note(href, { body })
  window.location.href = href
}

/** Opens the agent's email app with the email written. Phones open the app itself (its web compose
 *  if it isn't installed); computers open Gmail / Outlook on the web in a new tab, or the mail app. */
export function openSendEmail(app: SendMailApp, to: string, subject: string, body: string) {
  if (isPhoneDevice()) {
    const { href, fallback } = phoneAppLinks(app, to, subject, body)
    note(href, { app, subject, body, fallback })
    openWithFallback(href, fallback)
    return
  }
  const href = composeHref(app, to, subject, body)
  note(href, { app, subject, body })
  if (app === 'default') window.location.href = href
  else window.open(href, '_blank', 'noopener')
}
