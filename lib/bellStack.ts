// A calmer bell (owner, 11/13): small, same-day things of one kind combine into one row -
// "Jake, Emma and Jim opened your email · Frank also clicked your link", "Jake liked 3 homes and
// disliked 1", "Olivia, Sam, Ana, Lee + 20 more signed in at 12 Oak St", "3 new Buyer Intake
// submissions". Important things stay on their own: requests, comments, tours, questions,
// reviews, follow-up reminders, someone opening the same email again (LEAD_INTEREST)... and any
// row that is alone in its group. Tapping a combined row opens the Activity page, which still
// lists every one of them one by one. Bell only - the Activity page never combines.
import type { Notification } from '@/types'

export type BellItem =
  | { kind: 'one'; key: string; n: Notification }
  | { kind: 'stack'; key: string; type: string; items: Notification[]; title: string; message: string; timestamp: string; isRead: boolean }

const dayOf = (iso: string) => new Date(iso).toDateString()

const first = (name?: string | null) => (name || '').trim().split(/\s+/)[0] || ''

// "Bob opened your email" / "New sign-in: Olivia Park" -> the person, when visitorName is missing.
function personOf(n: Notification): string {
  if (n.visitorName) return n.visitorName.trim()
  const afterColon = n.title.split(':')[1]
  if (afterColon) return afterColon.trim()
  return n.title.split(' ')[0] || 'Someone'
}

/** "Jake", "Jake and Emma", "Jake, Emma and Jim", "Jake, Emma, Jim, Frank + 20 more". */
export function nameList(names: string[], max = 4): string {
  const u = Array.from(new Set(names.filter(Boolean)))
  if (u.length === 0) return 'Someone'
  if (u.length === 1) return u[0]
  if (u.length <= max) return `${u.slice(0, -1).join(', ')} and ${u[u.length - 1]}`
  return `${u.slice(0, max).join(', ')} + ${u.length - max} more`
}

// Someone opened / clicked more than once today - worth its own row.
const REPEAT_EMAIL = /\b(opened|clicked) ([2-9]|\d{2,})\b/i

/** The group a notification can combine into (same day), or null = always on its own. */
function groupKey(n: Notification): string | null {
  switch (n.type) {
    case 'EMAIL_ACTIVITY':
      return REPEAT_EMAIL.test(n.message || '') ? null : 'email'
    case 'PROPERTY_INTERACTION':
      return `likes:${personOf(n).toLowerCase()}`
    case 'OPEN_HOUSE_SIGN_IN':
      return `signin:${(n.propertyAddress || '').toLowerCase()}`
    case 'FORM_SUBMISSION':
      return `form:${n.title.toLowerCase()}`
    case 'PROPERTY_SYNC_UPDATE':
      return `sync:${(n.title.split(':')[0] || '').toLowerCase()}`
    case 'INVITE_RSVP':
      return 'rsvp'
    case 'GUEST_PASS_ACTIVITY':
      return 'guestpass'
    default:
      return null
  }
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function describe(type: string, items: Notification[]): { title: string; message: string } {
  const street = (s?: string | null) => (s || '').split(',')[0]
  switch (type) {
    case 'EMAIL_ACTIVITY': {
      const clickers = items.filter(n => /click/i.test(n.title)).map(n => first(personOf(n)))
      const openers = items.filter(n => !/click/i.test(n.title)).map(n => first(personOf(n)))
      if (!openers.length) return { title: `${nameList(clickers)} opened and clicked your email`, message: `${plural(items.length, 'person', 'people')} today` }
      return {
        title: `${nameList(openers)} opened your email${clickers.length ? ` · ${nameList(clickers, 2)} also clicked your link` : ''}`,
        message: `${plural(items.length, 'person', 'people')} today`,
      }
    }
    case 'PROPERTY_INTERACTION': {
      const who = first(personOf(items[0]))
      const liked = items.filter(n => /\bliked\b/i.test(n.title) && !/disliked/i.test(n.title)).length
      const disliked = items.filter(n => /disliked/i.test(n.title)).length
      const other = items.length - liked - disliked
      const bits = [liked && `liked ${plural(liked, 'home', 'homes')}`, disliked && `disliked ${disliked}`, other && `looked at ${plural(other, 'home', 'homes')}`].filter(Boolean)
      const homes = items.map(n => street(n.propertyAddress) || (n.message || '').replace(/^(Liked|Disliked|Interacted with)\s+/i, '')).filter(Boolean)
      return { title: `${who} ${bits.join(' and ')}`, message: nameList(homes, 3) }
    }
    case 'OPEN_HOUSE_SIGN_IN': {
      const where = street(items[0].propertyAddress)
      return { title: `${nameList(items.map(n => personOf(n)))} signed in${where ? ` at ${where}` : ''}`, message: `${plural(items.length, 'sign-in', 'sign-ins')} today` }
    }
    case 'FORM_SUBMISSION': {
      const form = items[0].title.replace(/^New\s+/i, '').replace(/\s+submission$/i, '')
      return { title: `${items.length} new ${form} submissions`, message: `From ${nameList(items.map(n => personOf(n)))}` }
    }
    case 'PROPERTY_SYNC_UPDATE': {
      const what = items[0].title.split(':')[0] || 'Showcase update'
      return { title: `${what} for ${nameList(items.map(n => first(personOf(n))))}`, message: `${plural(items.length, 'Showcase', 'Showcases')} today` }
    }
    case 'INVITE_RSVP':
      return { title: `${items.length} RSVP updates`, message: `From ${nameList(items.map(n => personOf(n)))}` }
    case 'GUEST_PASS_ACTIVITY':
      return { title: `${items.length} Guest Pass visits`, message: nameList(items.map(n => first(personOf(n)))) }
    default:
      return { title: `${items.length} updates`, message: '' }
  }
}

/** Newest-first notifications -> bell rows (newest first), combining same-day small things. */
export function stackNotifications(list: Notification[]): BellItem[] {
  const buckets = new Map<string, Notification[]>()
  for (const n of list) {
    const g = groupKey(n)
    if (!g) continue
    const k = `${g}|${dayOf(n.timestamp)}`
    const b = buckets.get(k)
    if (b) b.push(n); else buckets.set(k, [n])
  }
  const out: BellItem[] = []
  const placed = new Set<string>()
  for (const n of list) {
    const g = groupKey(n)
    const k = g ? `${g}|${dayOf(n.timestamp)}` : ''
    const bucket = k ? buckets.get(k) : undefined
    if (!bucket || bucket.length < 2) { out.push({ kind: 'one', key: n.id, n }); continue }
    if (placed.has(k)) continue   // the row sits where its newest one is
    placed.add(k)
    const { title, message } = describe(n.type, bucket)
    out.push({ kind: 'stack', key: k, type: n.type, items: bucket, title, message, timestamp: bucket[0].timestamp, isRead: bucket.every(x => x.isRead) })
  }
  return out
}
