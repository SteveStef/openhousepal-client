/**
 * The link preview for an Invite (/i/<code>) - what people see in iMessage, WhatsApp, Facebook...
 * when the agent shares it: the cover photo on the left, and on the right a paper invitation in the
 * invite's own design colours - "You're invited" eyebrow, the title, the day and time, the place,
 * and who's hosting. Satori rules apply (flexbox only, see lib/og/shared.tsx).
 */
import { ImageResponse } from 'next/og'
import { OG_SIZE, ogFetch, imgToDataUri, ogFonts } from './shared'
import { AgentPill, MlsSafePhoto } from './cards'
import { cardTitle, teaserDays, teaserEvent, tidyCaps } from '@/lib/inviteTitle'

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

const METAL: Record<string, [string, string, string]> = { gold: ['#8b6a2b', '#e8c97a', '#C9A24D'], silver: ['#6b717a', '#e3e7ec', '#A9AFB7'], bronze: ['#6e4426', '#dba47c', '#A9714B'] }
const FRAME: Record<string, string> = { classic: '#fbf7ee', garden: '#f6f3ea', midnight: '#0e1118', modern: '#ffffff' }

/** Round 4 (owner, 10/24): the home's photo across the whole card with the details ON it, like the
 *  property link previews - inside a frame in the invite's own style (its paper colour + an accent
 *  line, or the Luxe metal). No half-photo / half-panel, so no photo ever needs centring. */
const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1).trimEnd()}…` : v)
// First + last initial, the same as the card's initialsOf()
const initials = (name: string) => { const w = name.split(/\s+/).filter(Boolean); return w.length ? ((w[0][0] || '') + (w.length > 1 ? w[w.length - 1][0] || '' : '')).toUpperCase() : '?' }

export function InvitePhotoOgCard({ photo, title, town, eyebrow, when, facts, agentName, agentBrokerage, agentArea = null, agentPhoto, accent, design, metal }: {
  photo: string | null; title: string; town: string; eyebrow: string; when: string; facts: string
  agentName: string; agentBrokerage: string | null; agentArea?: string | null; agentPhoto: string | null; accent: string; design: string; metal: string | null
}) {
  // The agent at the foot (owner, 10/24 round 5): round photo (initials without one), the name in
  // the display font, then service area + brokerage on one quiet line - missing pieces left out.
  const quiet = clip([agentArea, agentBrokerage].map(x => (x || '').trim()).filter(Boolean).join('  ·  '), 64)
  const m = metal ? METAL[metal] : null
  // Frame = the style's colour: its accent for the light styles, deep navy + an accent line for Midnight.
  const frame = design === 'midnight' ? FRAME.midnight : accent
  const B = 18
  const W = 1200 - B * 2, H = 630 - B * 2
  const light = m ? m[1] : mix(accent, '#ffffff', 0.55)
  const fit = title.length > 30 ? 56 : title.length > 22 ? 66 : 76
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope',
      backgroundColor: frame, ...(m ? { backgroundImage: `linear-gradient(120deg, ${m[0]} 0%, ${m[1]} 30%, ${m[2]} 55%, ${m[1]} 75%, ${m[0]} 100%)` } : {}) }}>
      {!m ? <div style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, display: 'flex', border: `2px solid ${design === 'midnight' ? accent : 'rgba(255,255,255,0.55)'}`, borderRadius: 14 }} /> : null}
      <div style={{ position: 'absolute', top: B, left: B, width: W, height: H, display: 'flex', overflow: 'hidden', borderRadius: 10, backgroundColor: '#111' }}>
        {photo ? <MlsSafePhoto src={photo} w={W} h={H} /> : <div style={{ display: 'flex', width: W, height: H, backgroundImage: `linear-gradient(135deg, ${accent}, ${mix(accent, '#000000', 0.55)})` }} />}
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex',
          backgroundImage: 'linear-gradient(0deg, rgba(8,7,6,0.96) 0%, rgba(8,7,6,0.78) 48%, rgba(8,7,6,0.15) 80%, rgba(8,7,6,0.3) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex', flexDirection: 'column', padding: '34px 50px 32px', color: '#fff' }}>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, fontWeight: 900, letterSpacing: 7, textTransform: 'uppercase', color: light, textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
              <div style={{ display: 'flex', width: 38, height: 2, backgroundColor: light }} />
              {eyebrow}
            </div>
            <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: fit, lineHeight: 1.02, letterSpacing: -1, marginTop: 10, maxWidth: W - 100 }}>{title}</div>
            {town ? <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.86)', marginTop: 6 }}>{town}</div> : null}
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 18, flexWrap: 'wrap' }}>
              {when ? <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, color: '#fff', padding: '8px 18px', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', border: `2px solid ${light}` }}>{when}</div> : null}
              {facts ? <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{facts}</div> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 20, paddingTop: 18, borderTop: '1.5px solid rgba(255,255,255,0.22)' }}>
              {agentPhoto
                ? <img src={agentPhoto} width={60} height={60} style={{ width: 60, height: 60, borderRadius: 30, objectFit: 'cover', border: `2.5px solid ${light}` }} />
                : <div style={{ display: 'flex', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', border: `2.5px solid ${light}`,
                    backgroundColor: 'rgba(255,255,255,0.12)', fontFamily: 'Playfair', fontWeight: 900, fontSize: 24, color: light }}>{initials(agentName)}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: W - 200 }}>
                <div style={{ display: 'flex', fontFamily: 'Playfair', fontWeight: 900, fontSize: 30, lineHeight: 1.1, color: '#fff' }}>{clip(agentName, 40)}</div>
                {quiet ? <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{quiet}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ round 6: the private teaser
// Owner, 10/24 round 6: the preview must NOT give the property away - no house photo, street, town
// or beds/baths. A stationery card in the invite's own look, lifting out of its envelope: "You're
// invited", the kind of event, when, and who it's from (photo or initials, name, service area,
// brokerage). The guest page is unchanged.

type Look = {
  scene: string; envelope: string; envelopeLine: string; paper: string; ink: string; sub: string; label: string
  rule: string; serifTitle: boolean; radius: number; border: string; seal: string; sealInk: string; foil: string | null
}

function lookOf(design: string, accent: string, metal: string | null): Look {
  const m = metal ? METAL[metal] : null
  const foil = m ? `linear-gradient(120deg, ${m[0]} 0%, ${m[1]} 32%, ${m[2]} 56%, ${m[1]} 78%, ${m[0]} 100%)` : null
  const metalInk = m ? m[2] : null
  if (design === 'midnight') return {
    scene: m ? 'linear-gradient(160deg, #15171d 0%, #07080b 100%)' : `linear-gradient(160deg, ${mix(accent, '#0b0d12', 0.7)} 0%, #06070a 100%)`,
    envelope: '#1a1d26', envelopeLine: 'rgba(255,255,255,0.10)', paper: '#10131a', ink: '#f5f0e6', sub: '#a8a296',
    label: metalInk ? m![1] : mix(accent, '#ffffff', 0.35), rule: metalInk ? m![2] : mix(accent, '#ffffff', 0.2),
    serifTitle: true, radius: 18, border: metalInk ? m![2] : mix(accent, '#ffffff', 0.2), seal: foil || mix(accent, '#ffffff', 0.15), sealInk: '#15130f', foil,
  }
  if (design === 'garden') {
    const leaf = mix(accent, '#4f6f52', 0.35)
    return {
      scene: m ? 'linear-gradient(160deg, #2a2f2a 0%, #141714 100%)' : `linear-gradient(160deg, ${mix(leaf, '#ffffff', 0.55)} 0%, ${mix(leaf, '#ffffff', 0.2)} 100%)`,
      envelope: '#ebe6d8', envelopeLine: 'rgba(60,70,60,0.18)', paper: '#f7f4ec', ink: '#26302a', sub: '#6d756e',
      label: metalInk || leaf, rule: metalInk || mix(leaf, '#ffffff', 0.3), serifTitle: true, radius: 40, border: metalInk || mix(leaf, '#ffffff', 0.35),
      seal: foil || leaf, sealInk: m ? '#1b1a16' : '#ffffff', foil,
    }
  }
  if (design === 'modern') return {
    scene: m ? 'linear-gradient(160deg, #1d1d20 0%, #0b0b0d 100%)' : `linear-gradient(135deg, ${accent} 0%, ${mix(accent, '#000000', 0.45)} 100%)`,
    envelope: '#f1f2f4', envelopeLine: 'rgba(17,24,39,0.12)', paper: '#ffffff', ink: '#111827', sub: '#6b7280',
    label: metalInk || accent, rule: metalInk || accent, serifTitle: false, radius: 28, border: metalInk || '#e5e7eb',
    seal: foil || accent, sealInk: m ? '#1b1a16' : '#ffffff', foil,
  }
  return {  // classic
    scene: m ? 'linear-gradient(160deg, #1c1a17 0%, #0c0b0a 100%)' : `linear-gradient(160deg, ${mix(accent, '#000000', 0.25)} 0%, ${mix(accent, '#000000', 0.6)} 100%)`,
    envelope: '#efe8d8', envelopeLine: 'rgba(80,60,30,0.16)', paper: '#fbf7ee', ink: '#1f1b16', sub: '#6b6257',
    label: metalInk || accent, rule: metalInk || accent, serifTitle: true, radius: 10, border: metalInk || accent,
    seal: foil || accent, sealInk: m ? '#1b1a16' : '#ffffff', foil,
  }
}

function Sprig({ color, flip }: { color: string; flip: boolean }) {
  const leaf = (x: number, y: number, r: number) => <ellipse cx={x} cy={y} rx={9} ry={4} transform={`rotate(${r} ${x} ${y})`} fill={color} />
  const one = (flip: boolean) => (
    <div style={{ position: 'absolute', display: 'flex', width: 150, height: 150, left: flip ? 900 - 150 : 0, top: flip ? 548 - 150 : 0 }}>
      <svg width={150} height={150} viewBox="0 0 150 150">
        <g transform={flip ? 'rotate(180 75 75)' : undefined}>
          <path d="M8 8 C 50 30, 90 60, 130 125" stroke={color} strokeWidth={2.5} fill="none" />
          {leaf(30, 24, 30)}{leaf(44, 22, -20)}{leaf(52, 40, 35)}{leaf(68, 40, -15)}{leaf(74, 60, 45)}{leaf(90, 62, -5)}{leaf(94, 84, 55)}{leaf(110, 90, 5)}
        </g>
      </svg>
    </div>
  )
  return one(flip)
}

export function InviteTeaserOgCard({ design, accent, metal, label, custom, line2 = '', days, agentName, agentArea, agentBrokerage, agentPhoto }: {
  design: string; accent: string; metal: string | null; label: string; custom: boolean; line2?: string
  days: { day: string; long: string; time: string }[]
  agentName: string; agentArea: string | null; agentBrokerage: string | null; agentPhoto: string | null
}) {
  const L = lookOf(design, accent, metal)
  const titleFont = L.serifTitle ? 'Playfair' : 'Manrope'
  const fit = label.length > 34 ? 46 : label.length > 24 ? 56 : label.length > 16 ? 66 : 78
  const same = days.every(x => x.time === days[0]?.time)
  const CW = 900, CH = 548, top = 46
  const ruleEl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', width: 90, height: 2, backgroundColor: L.rule }} />
      <div style={{ display: 'flex', width: 10, height: 10, backgroundColor: L.rule, transform: 'rotate(45deg)' }} />
      <div style={{ display: 'flex', width: 90, height: 2, backgroundColor: L.rule }} />
    </div>
  )
  const lines = [agentArea, agentBrokerage].map(x => clip((x || '').trim(), 52)).filter(Boolean)
  return (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', fontFamily: 'Manrope', backgroundImage: L.scene, alignItems: 'flex-start', justifyContent: 'center' }}>
      {/* the envelope it came out of - its back and open flap peek around the card */}
      <svg width={1120} height={630} viewBox="0 0 1120 630" style={{ position: 'absolute', left: 40, top: 0 }}>
        <polygon points="0,232 560,30 1120,232" fill={L.envelope} />
        <polyline points="0,232 560,30 1120,232" fill="none" stroke={L.envelopeLine} strokeWidth={3} />
        <rect x={0} y={230} width={1120} height={420} rx={14} fill={L.envelope} />
        <polyline points="0,232 560,480 1120,232" fill="none" stroke={L.envelopeLine} strokeWidth={3} />
        <polyline points="0,630 470,440" fill="none" stroke={L.envelopeLine} strokeWidth={3} />
        <polyline points="1120,630 650,440" fill="none" stroke={L.envelopeLine} strokeWidth={3} />
      </svg>
      {/* the card - framed in the Luxe metal when there is one */}
      <div style={{ display: 'flex', position: 'absolute', top, left: (1200 - CW) / 2, width: CW, height: CH, padding: L.foil ? 7 : 0, borderRadius: L.radius + (L.foil ? 7 : 0),
        ...(L.foil ? { backgroundImage: L.foil } : {}), boxShadow: '0 30px 60px -20px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', position: 'relative', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', backgroundColor: L.paper, borderRadius: L.radius, overflow: 'hidden', padding: '40px 50px 30px' }}>
          {design === 'classic' ? <div style={{ position: 'absolute', top: 14, left: 14, right: 14, bottom: 14, display: 'flex', border: `2px solid ${L.border}`, borderRadius: 4 }} /> : null}
          {design === 'classic' ? <div style={{ position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, display: 'flex', border: `1px solid ${L.border}`, borderRadius: 2 }} /> : null}
          {design === 'garden' ? <Sprig color={L.border} flip={false} /> : null}
          {design === 'garden' ? <Sprig color={L.border} flip /> : null}
          {design === 'midnight' ? <div style={{ position: 'absolute', top: 18, left: 18, width: 40, height: 40, display: 'flex', borderTop: `2px solid ${L.border}`, borderLeft: `2px solid ${L.border}` }} /> : null}
          {design === 'midnight' ? <div style={{ position: 'absolute', top: 18, right: 18, width: 40, height: 40, display: 'flex', borderTop: `2px solid ${L.border}`, borderRight: `2px solid ${L.border}` }} /> : null}
          {design === 'midnight' ? <div style={{ position: 'absolute', bottom: 18, left: 18, width: 40, height: 40, display: 'flex', borderBottom: `2px solid ${L.border}`, borderLeft: `2px solid ${L.border}` }} /> : null}
          {design === 'midnight' ? <div style={{ position: 'absolute', bottom: 18, right: 18, width: 40, height: 40, display: 'flex', borderBottom: `2px solid ${L.border}`, borderRight: `2px solid ${L.border}` }} /> : null}
          {design === 'modern' ? <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, display: 'flex', ...(L.foil ? { backgroundImage: L.foil } : { backgroundColor: L.label }) }} /> : null}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, width: '100%' }}>
          <div style={{ display: 'flex', fontSize: 21, fontWeight: 900, letterSpacing: 9, textTransform: 'uppercase', color: L.label }}>You&apos;re invited</div>
          <div style={{ display: 'flex', fontFamily: titleFont, fontWeight: 900, fontSize: fit, lineHeight: 1.05, color: L.ink, marginTop: 8, textAlign: 'center', maxWidth: CW - 120, letterSpacing: L.serifTitle ? 0 : -1.5 }}>
            {custom ? label : `to ${/^[AEIOU]/i.test(label) ? 'an' : 'a'} ${label}`}
          </div>
          {line2 ? <div style={{ display: 'flex', fontSize: line2.length > 40 ? 22 : 26, fontWeight: 400, color: L.sub, marginTop: 8, textAlign: 'center', maxWidth: CW - 140 }}>{line2}</div> : null}
          {ruleEl}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 16 }}>
            {days.length === 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', fontFamily: titleFont, fontWeight: L.serifTitle ? 400 : 900, fontSize: 44, color: L.ink, lineHeight: 1.1 }}>{days[0].long}</div>
                {days[0].time ? <div style={{ display: 'flex', fontSize: 30, fontWeight: 900, color: L.ink, marginTop: 8 }}>{days[0].time}</div> : null}
              </div>
            ) : days.length > 1 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {days.slice(0, 3).map(x => (
                <div key={x.day} style={{ display: 'flex', alignItems: 'baseline', gap: 14, lineHeight: 1.2 }}>
                  <div style={{ display: 'flex', fontFamily: titleFont, fontWeight: L.serifTitle ? 400 : 900, fontSize: days.length > 2 ? 30 : 36, color: L.ink }}>{x.long}</div>
                  {!same && x.time ? <div style={{ display: 'flex', fontSize: days.length > 2 ? 22 : 25, fontWeight: 900, color: L.sub }}>{x.time}</div> : null}
                </div>
              ))}
              {same && days[0].time ? <div style={{ display: 'flex', fontSize: 28, fontWeight: 900, color: L.ink, marginTop: 6 }}>{days[0].time}</div> : null}
              </div>
            ) : <div style={{ display: 'flex', fontFamily: titleFont, fontSize: 34, color: L.sub }}>Tap to see the details</div>}
          </div>
          </div>
          {/* who it's from */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 10 }}>
            {agentPhoto
              ? <img src={agentPhoto} width={74} height={74} style={{ width: 74, height: 74, borderRadius: 37, objectFit: 'cover', border: `3px solid ${L.rule}` }} />
              : <div style={{ display: 'flex', width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', border: `3px solid ${L.rule}`,
                  ...(L.foil ? { backgroundImage: L.foil } : { backgroundColor: L.seal }), fontFamily: 'Playfair', fontWeight: 900, fontSize: 28, color: L.sealInk }}>{initials(agentName)}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: CW - 260 }}>
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', color: L.sub }}>From</div>
              <div style={{ display: 'flex', fontFamily: titleFont, fontWeight: 900, fontSize: 30, lineHeight: 1.1, color: L.ink }}>{clip(agentName, 38)}</div>
              {lines.map(x => <div key={x} style={{ display: 'flex', fontSize: 18, fontWeight: 400, color: L.sub, marginTop: 2 }}>{x}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function shortDay(s: string) {
  const d = parseDay(s)
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''
}

export async function renderInviteCard(code: string, fonts: Fonts): Promise<ImageResponse> {
  const IR = (node: React.ReactElement) => new ImageResponse(node, { ...OG_SIZE, fonts })
  try {
    const data = await ogFetch<any>(`/invites/public/${encodeURIComponent(code)}`, 120)
    if (!data) throw new Error('missing')
    // Round 6 (owner, 10/24): a private teaser - no house photo, no street, no town, no beds/baths.
    const ph = String(data.agent?.photo_url || '').trim()
    const agentPhoto = ph && ph !== '/home.jpg' ? await imgToDataUri(ph, 3500) : null
    const ev = teaserEvent(data.title, data.invite_type, data.address)
    return IR(
      <InviteTeaserOgCard design={String(data.design || 'classic')} accent={hex(data.accent_color, '#C9A24D')}
        metal={data.motion === 'luxe' ? (data.luxe_metal || 'gold') : null} label={ev.text} custom={ev.custom} days={teaserDays(data)}
        line2={typeof data.subtitle === 'string' ? data.subtitle.trim() : ''}
        agentName={data.agent?.name || 'Your host'} agentArea={data.agent?.market || null} agentBrokerage={data.agent?.brokerage || null} agentPhoto={agentPhoto} />,
    )
  } catch {
    return IR(<InviteTeaserOgCard design="classic" accent="#C9A24D" metal={null} label="Special Event" custom={false} days={[]} agentName="Your host" agentArea={null} agentBrokerage={null} agentPhoto={null} />)
  }
}

/** Round 4-5 photo preview, kept for reference only - no longer used (round 6 privacy rule). */
export async function renderInvitePhotoCardUnused(code: string, fonts: Fonts): Promise<ImageResponse> {
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
    // Automatic "Open House at <street>" titles show just the street (the gold label says the rest),
    // so the place line under it is the town, not the street again (owner, 10/24 round 3).
    const ct = cardTitle(data.title, data.invite_type)
    const place = ct.isAddress && !data.place_name ? tidyCaps(String(data.address || '').split(',').slice(1).join(',').trim()) : [data.place_name, data.address].filter(Boolean).join(', ')
    // Round 4 (owner, 10/24): full photo with the details on it, like the property link previews.
    const extra = Array.isArray(data.extra_dates) ? data.extra_dates.filter((x: any) => x && x.date) : []
    const when = !dt ? '' : extra.length
      ? [shortDay(data.event_date), ...extra.map((x: any) => shortDay(x.date))].filter(Boolean).slice(0, 3).join('  ·  ')
        + (data.start_time && extra.every((x: any) => (x.start || data.start_time) === data.start_time && (x.end || data.end_time) === data.end_time) ? `  ·  ${timeRange(data.start_time, data.end_time)}` : '')
      : `${dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}${data.start_time ? `  ·  ${timeRange(data.start_time, data.end_time)}` : ''}`
    const facts = [
      lp.beds ? `${lp.beds} Beds` : '', lp.baths ? `${lp.baths} Baths` : '',
      lp.sqft ? `${Math.round(Number(lp.sqft)).toLocaleString('en-US')} Sq Ft` : '',
    ].filter(Boolean).join('  ·  ')
    return IR(
      <InvitePhotoOgCard photo={photo} title={ct.text || "You're invited"} town={place} eyebrow={EYEBROW[data.invite_type] || "You're invited"}
        when={when} facts={facts}
        agentName={data.agent?.name || 'Your host'} agentBrokerage={data.agent?.brokerage || null} agentArea={data.agent?.market || null} agentPhoto={agentPhoto}
        accent={hex(data.accent_color, '#C9A24D')} design={String(data.design || 'classic')}
        metal={data.motion === 'luxe' ? (data.luxe_metal || 'gold') : null} />,
    )
  } catch {
    return IR(<InvitePhotoOgCard photo={null} title="You're invited" town="" eyebrow="Invitation" when="" facts="" agentName="Your host" agentBrokerage={null} agentPhoto={null} accent="#C9A24D" design="classic" metal={null} />)
  }
}
