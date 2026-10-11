// Browser-side "take it with you" actions for a Listing Spotlight: save an open house to a
// calendar, save the agent as a phone contact. Both are generated from data already on the page -
// no extra network call, and nothing here ever leaves the visitor's own device.
import { parseDay, type PropertySiteAgent, type PropertySiteOpenHouse } from './model'

function pad(n: number) { return String(n).padStart(2, '0') }

// Floating local times (no Z / TZID): an open house at "1:00 PM" is 1:00 PM wherever the home is,
// which is where a visitor planning to attend is too - every calendar app reads a floating time
// as the viewer's own local clock.
function stamp(date: Date, time?: string | null): string {
  const base = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  if (!time) return base
  const [h, m] = time.split(':')
  return `${base}T${pad(parseInt(h, 10) || 0)}${pad(parseInt(m, 10) || 0)}00`
}

interface CalendarDetails { title: string; location: string; description: string; url: string }

function eventRange(oh: PropertySiteOpenHouse): { start: string; end: string; allDay: boolean } | null {
  const day = parseDay(oh.date)
  if (!day) return null
  if (!oh.start_time) {
    const next = new Date(day); next.setDate(next.getDate() + 1)
    return { start: stamp(day), end: stamp(next), allDay: true }
  }
  let end = oh.end_time
  if (!end) {
    const [h, m] = oh.start_time.split(':')
    end = `${pad(Math.min(23, (parseInt(h, 10) || 0) + 2))}:${m || '00'}`
  }
  return { start: stamp(day, oh.start_time), end: stamp(day, end), allDay: false }
}

export function googleCalendarUrl(oh: PropertySiteOpenHouse, d: CalendarDetails): string | null {
  const range = eventRange(oh)
  if (!range) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: d.title, dates: `${range.start}/${range.end}`,
    details: `${d.description}\n\n${d.url}`, location: d.location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function icsEscape(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

export function downloadOpenHouseIcs(oh: PropertySiteOpenHouse, d: CalendarDetails) {
  const range = eventRange(oh)
  if (!range) return
  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OpenHousePal//Listing Spotlight//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${(oh.id || range.start)}-${Math.random().toString(36).slice(2, 8)}@openhousepal.com`,
    `DTSTAMP:${dtstamp}`,
    range.allDay ? `DTSTART;VALUE=DATE:${range.start}` : `DTSTART:${range.start}`,
    range.allDay ? `DTEND;VALUE=DATE:${range.end}` : `DTEND:${range.end}`,
    `SUMMARY:${icsEscape(d.title)}`,
    `LOCATION:${icsEscape(d.location)}`,
    `DESCRIPTION:${icsEscape(`${d.description}\n\n${d.url}`)}`,
    `URL:${d.url}`,
    'END:VEVENT', 'END:VCALENDAR',
  ]
  saveBlob(lines.join('\r\n'), 'text/calendar;charset=utf-8', `open-house-${oh.date}.ics`)
}

function vcardEscape(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, ' ')
}

export function downloadAgentVcard(agent: PropertySiteAgent, listing: { address: string; url: string }) {
  const parts = agent.name.trim().split(/\s+/)
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:${vcardEscape(last)};${vcardEscape(first)};;;`,
    `FN:${vcardEscape(agent.name)}`,
    agent.brokerage ? `ORG:${vcardEscape(agent.brokerage)}` : '',
    agent.title ? `TITLE:${vcardEscape(agent.title)}` : '',
    agent.phone ? `TEL;TYPE=CELL,VOICE:${agent.phone}` : '',
    agent.email ? `EMAIL;TYPE=INTERNET:${agent.email}` : '',
    agent.hub_url ? `URL:${agent.hub_url}` : agent.website ? `URL:${agent.website}` : '',
    `NOTE:${vcardEscape(`Listing agent for ${listing.address} - ${listing.url}`)}`,
    'END:VCARD',
  ].filter(Boolean)
  const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'
  saveBlob(lines.join('\r\n'), 'text/vcard;charset=utf-8', `${slug}.vcf`)
}

function saveBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// tel:/sms: links want digits only (plus a leading +) - a formatted "(410) 555-0100" works on
// most phones but not all.
export function telHref(phone: string, scheme: 'tel' | 'sms' = 'tel') {
  const digits = phone.replace(/[^\d+]/g, '')
  return `${scheme}:${digits}`
}
