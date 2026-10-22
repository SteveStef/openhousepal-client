/**
 * The link preview for an Invite (/i/<code>) - what people see in iMessage, WhatsApp, Facebook...
 * when the agent shares it: the cover photo on the left, and on the right a paper invitation in the
 * invite's own design colours - "You're invited" eyebrow, the title, the day and time, the place,
 * and who's hosting. Satori rules apply (flexbox only, see lib/og/shared.tsx).
 */
import { ImageResponse } from 'next/og'
import { OG_SIZE, ogFetch, imgToDataUri, ogFonts } from './shared'
import { AgentPill, MlsSafePhoto } from './cards'

type Fonts = ReturnType<typeof ogFonts>

const hex = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d)
function mix(a: string, b: string, t: number) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16)
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t)
  return `#${[16, 8, 0].map(s => c(s).toString(16).padStart(2, '0')).join('')}`
}
const EYEBROW: Record<string, string> = { open_house: 'Open House', brokers_open: "Broker's Open", client_event: "You're invited", custom: "You're invited" }

function parseDay(s?: string | null) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}
function clock(v?: string | null) {
  if (!v) return ''
  const [h, m] = v.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
function timeRange(a?: string | null, b?: string | null) {
  if (!a) return ''
  if (!b) return clock(a)
  const x = clock(a), y = clock(b)
  return x.slice(-2) === y.slice(-2) ? `${x.slice(0, -3)} - ${y}` : `${x} - ${y}`
}

export function InviteOgCard({ photo, title, eyebrow, day, date, time, place, agentName, agentBrokerage, agentPhoto, accent, dark }: {
  photo: string | null; title: string; eyebrow: string; day: string; date: string; time: string; place: string
  agentName: string; agentBrokerage: string | null; agentPhoto: string | null; accent: string; dark: boolean
}) {
  const paper = dark ? '#10131a' : '#fbf7ee'
  const ink = dark ? '#f5f0e6' : '#1f1b16'
  const sub = dark ? '#a8a296' : '#6b6257'
  const fit = title.length > 46 ? 48 : title.length > 30 ? 58 : 68
  const PW = photo ? 520 : 0
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: paper, fontFamily: 'Manrope', position: 'relative' }}>
      {photo ? (
        <div style={{ display: 'flex', position: 'relative', width: PW, height: 630 }}>
          <MlsSafePhoto src={photo} w={PW} h={630} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 6, height: 630, display: 'flex', backgroundColor: accent }} />
        </div>
      ) : null}
      <div style={{ display: 'flex', position: 'relative', flexDirection: 'column', flex: 1, padding: '56px 64px 52px', color: ink }}>
        <div style={{ position: 'absolute', top: 22, left: 22, right: 22, bottom: 22, display: 'flex', border: `2px solid ${accent}`, borderRadius: 14 }} />
        <div style={{ position: 'absolute', top: 30, left: 30, right: 30, bottom: 30, display: 'flex', border: `1px solid ${mix(accent, dark ? '#000000' : '#ffffff', 0.35)}`, borderRadius: 10 }} />
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 900, letterSpacing: 7, textTransform: 'uppercase', color: accent }}>{eyebrow}</div>
        <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: fit, lineHeight: 1.04, letterSpacing: -1, marginTop: 14, maxWidth: photo ? 560 : 1000 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
          <div style={{ display: 'flex', width: 70, height: 2, backgroundColor: accent }} />
          <div style={{ display: 'flex', width: 10, height: 10, backgroundColor: accent, transform: 'rotate(45deg)' }} />
          <div style={{ display: 'flex', width: 70, height: 2, backgroundColor: accent }} />
        </div>
        {date ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 900, letterSpacing: 5, textTransform: 'uppercase', color: sub }}>{day}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair', fontSize: 46, fontWeight: 400, color: ink }}>{date}</div>
              {time ? <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, color: ink }}>{time}</div> : null}
            </div>
          </div>
        ) : null}
        {place ? <div style={{ display: 'flex', fontSize: 24, color: sub, marginTop: 8, maxWidth: photo ? 560 : 1000 }}>{place}</div> : null}
        <div style={{ display: 'flex', marginTop: 'auto' }}>
          <AgentPill name={agentName} brokerage={agentBrokerage} photo={agentPhoto} accent={accent} tone={dark ? 'dark' : 'light'} scale={0.78} />
        </div>
      </div>
    </div>
  )
}

export async function renderInviteCard(code: string, fonts: Fonts): Promise<ImageResponse> {
  const IR = (node: React.ReactElement) => new ImageResponse(node, { ...OG_SIZE, fonts })
  try {
    const data = await ogFetch<any>(`/invites/public/${encodeURIComponent(code)}`, 120)
    if (!data) throw new Error('missing')
    const lp = data.linked_property || {}
    const [photo, agentPhoto] = await Promise.all([
      imgToDataUri(data.cover_image_url || (lp.no_cover ? null : lp.image || (Array.isArray(lp.photos) ? lp.photos[0] : null)), 4500),
      imgToDataUri(data.agent?.photo_url, 3500),
    ])
    const dt = parseDay(data.event_date)
    const place = [data.place_name, data.address].filter(Boolean).join(', ')
    return IR(
      <InviteOgCard photo={photo} title={data.title || "You're invited"} eyebrow={EYEBROW[data.invite_type] || "You're invited"}
        day={dt ? dt.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) : ''}
        date={dt ? dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }) : ''}
        time={timeRange(data.start_time, data.end_time)} place={place}
        agentName={data.agent?.name || 'Your host'} agentBrokerage={data.agent?.brokerage || null} agentPhoto={agentPhoto}
        accent={hex(data.accent_color, '#C9A24D')} dark={data.design === 'midnight'} />,
    )
  } catch {
    return IR(<InviteOgCard photo={null} title="You're invited" eyebrow="Invitation" day="" date="" time="" place="" agentName="Your host" agentBrokerage={null} agentPhoto={null} accent="#C9A24D" dark={false} />)
  }
}
