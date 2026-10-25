// What an invitation shows as its big title (owner, 10/24 round 3: "it says OPEN HOUSE, then
// 'Open House at <address>' - don't be repetitive"). The automatic titles the builder writes
// ("Open House at 239 Windham Dr", "Broker's Open at 1150 Groff Ln") show just the address under
// the gold "Open House" / "Broker's Open" label. A title the agent wrote themselves shows as written.
// Used by the invitation card (every design), the invite lists, the link preview image and the
// printable invite. Plain text elsewhere (emails, calendar, link text) keeps the full title.

const AUTO = /^\s*(open\s+house|broker['’]?s\s+open)\s+at\s+/i

export const tidyCaps = (s: string) =>
  s && s === s.toUpperCase() && /[A-Z]{2}/.test(s)
    ? s.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, x) => n + x.toLowerCase())
      .replace(/, ([A-Za-z]{2})\b/g, (_, st) => `, ${st.toUpperCase()}`)  // ", PA 19341" stays a state code
    : s

export function cardTitle(title: string | null | undefined, inviteType?: string | null): { text: string; isAddress: boolean } {
  const t = (title || '').trim()
  if ((inviteType === 'open_house' || inviteType === 'brokers_open') && AUTO.test(t)) {
    const rest = t.replace(AUTO, '').trim()
    if (rest) return { text: tidyCaps(rest), isAddress: true }
  }
  return { text: t, isAddress: false }
}

// ---------------------------------------------------------------- the link-preview teaser
// Owner, 10/24 round 6: a texted / posted invite link must NOT give the property away - no photo,
// no street, no town, no beds/baths. The preview says "You're invited" + the kind of event, who
// it's from and when. Used by the preview image (lib/og/inviteCard.tsx) and the og:title /
// og:description text (app/i/[code]/layout.tsx). The guest page itself is unchanged.

export const TEASER_LABEL: Record<string, string> = { open_house: 'Open House', brokers_open: "Broker's Open", client_event: 'Client Dinner', custom: 'Special Event' }


/** The event's name for the preview. An automatic title ("Open House at 239 Windham Dr") or no title
 *  becomes just the kind of event - no address. A title the agent typed themselves shows EXACTLY as
 *  typed, nothing stripped (owner, 10/24 round 7: "whatever the agent types, they won't want a
 *  portion of their custom title hidden"). */
export function teaserEvent(title: string | null | undefined, inviteType: string | null | undefined, _address?: string | null): { text: string; custom: boolean } {
  const label = TEASER_LABEL[inviteType || ''] || 'Special Event'
  const ct = cardTitle(title, inviteType)
  if (!ct.text || ct.isAddress) return { text: label, custom: false }
  return { text: ct.text, custom: true }
}

const pDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)) }
const clk = (v?: string | null) => {
  if (!v) return ''
  const [h, m] = v.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
export function teaserTime(a?: string | null, b?: string | null) {
  if (!a) return ''
  if (!b) return clk(a)
  const x = clk(a), y = clk(b)
  return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)} - ${y}` : `${x} - ${y}`
}

/** Every day of the invite as { day: "Sun, Oct 25", long: "Sunday, October 25", time: "1 - 3 PM" }. */
export function teaserDays(d: { event_date?: string | null; start_time?: string | null; end_time?: string | null; extra_dates?: { date: string; start?: string | null; end?: string | null }[] | null }) {
  if (!d.event_date) return []
  const all = [{ date: d.event_date, start: d.start_time, end: d.end_time }, ...((d.extra_dates || []).filter(x => x && x.date))]
  return all.map(x => {
    const dt = pDay(x.date)
    return {
      day: dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
      long: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }),
      time: teaserTime(x.start || d.start_time, x.end || d.end_time),
    }
  })
}

/** The link's text: "Quinn Reviewer invited you to an Open House" / "Sun, Oct 25 · 1 - 3 PM - tap to RSVP." */
export function teaserText(d: any): { title: string; description: string } {
  const host = (d?.agent?.name || '').trim()
  const ev = teaserEvent(d?.title, d?.invite_type, d?.address)
  const what = ev.custom ? `“${ev.text}”` : `${/^[AEIOU]/i.test(ev.text) ? 'an' : 'a'} ${ev.text}`
  const title = host ? `${host} invited you to ${what}` : `You're invited to ${what}`
  const days = teaserDays(d || {})
  const same = days.every(x => x.time === days[0]?.time)
  const when = !days.length ? '' : same
    ? `${days.map(x => x.day).join(' & ')}${days[0].time ? ` · ${days[0].time}` : ''}`
    : days.map(x => `${x.day}${x.time ? ` · ${x.time}` : ''}`).join(' & ')
  // the agent's own line 2 (round 8) rides along exactly as typed
  const line2 = typeof d?.subtitle === 'string' ? d.subtitle.trim() : ''
  return { title, description: `${line2 ? `${line2} · ` : ''}${when ? `${when} - ` : ''}tap to RSVP.` }
}
