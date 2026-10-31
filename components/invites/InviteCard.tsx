'use client'

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { resolveMediaUrl } from '@/lib/api-service'
import { sizedImage } from '@/lib/siteImage'
import { accentOf, allDays, clockRange, initialsOf, mix, onAccent, parseDay, type InviteDay, type InviteDesign, type InviteDraft } from '@/lib/invites'
import { LUXE_METALS } from '@/lib/luxeMetals'
import { cardTitle, tidyCaps } from '@/lib/inviteTitle'
import { SERIF } from './inviteFonts'

// The invitation itself - a paper card drawn at a fixed 360 x 504 (5:7, like a printed invite) and
// scaled to whatever width it's shown at, so the type keeps its proportions on a phone, in the
// creation flow's preview and on the agent's list. Four designs, all tinted by the agent's colour.
// No blur anywhere (snappy on phones) - only transforms and opacity move.

export const CARD_W = 360
export const CARD_H = 504

export type InviteCardData = Pick<InviteDraft, 'invite_type' | 'title' | 'event_date' | 'start_time' | 'end_time' | 'place_name' | 'address' | 'cover_image_url' | 'linked_property' | 'design' | 'accent_color'>
  & Partial<Pick<InviteDraft, 'extra_dates' | 'luxe_metal' | 'cover_position' | 'motion' | 'subtitle'>> & {
  hostName?: string | null
  hostBrokerage?: string | null
  hostPhoto?: string | null
  /** Service area (the profile's market), shown with the brokerage under the agent's name. */
  hostArea?: string | null
}

const EYEBROW: Record<string, string> = { open_house: 'Open House', brokers_open: "Broker's Open", client_event: "You're invited", custom: "You're invited" }

/** The exact box each design crops the cover photo into (card pixels, 360 x 504 card) - the builder's
 *  "drag to adjust" shows the photo in this same frame so what the agent sets is what guests see
 *  (owner, 10/24 round 7). Keep in step with the four designs below. */
export function coverFrame(d: InviteCardData): { w: number; h: number; radius: string; fade?: boolean } {
  const multi = allDays(d).length > 1
  const host = !!d.hostName
  switch (d.design) {
    case 'garden': return { w: host ? 240 : 252, h: host ? (multi ? 112 : 132) : (multi ? 150 : 168), radius: '18px' }
    case 'midnight': return { w: CARD_W, h: multi ? 200 : 230, radius: '0px', fade: true }
    case 'modern': return { w: CARD_W, h: host ? 254 : 292, radius: '0px' }
    default: return { w: 196, h: host ? (multi ? 104 : 120) : (multi ? 120 : 138), radius: '98px 98px 10px 10px' }
  }
}

/** What line 2 says when the agent hasn't typed their own (round 8) - the builder pre-fills it:
 *  the town under an address title, else "street, town" (or the place's address). */
export function autoLineTwo(d: Pick<InviteDraft, 'title' | 'invite_type' | 'place_name' | 'address'>): string {
  const ct = cardTitle(d.title, d.invite_type)
  const parts = (d.address || '').split(',').map(x => x.trim()).filter(Boolean)
  if (d.place_name) return tidyCaps(parts.slice(0, 2).join(', '))
  if (ct.isAddress) return tidyCaps(parts.slice(1, 3).join(', '))
  return tidyCaps(parts.slice(0, 2).join(', '))
}

export function coverOf(d: Pick<InviteDraft, 'cover_image_url' | 'linked_property'>): string {
  const lp = d.linked_property
  const src = d.cover_image_url || (lp && !lp.no_cover ? lp.image || lp.photos?.[0] : '') || ''
  return src ? resolveMediaUrl(src) : ''
}

function parts(d: InviteCardData) {
  const dt = d.event_date ? parseDay(d.event_date) : null
  const street = (d.place_name || d.address || '').split(',')[0]
  const ct = cardTitle(d.title, d.invite_type)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const rest = d.place_name ? (d.address || '').split(',')[0] : (d.address || '').split(',').slice(1, 3).join(',').trim()
  const days = allDays(d)
  const metal = d.luxe_metal ? LUXE_METALS[d.luxe_metal] : null
  const own2 = d.subtitle === null || d.subtitle === undefined ? null : d.subtitle.trim()
  const auto2 = own2 === null && !ct.isAddress && !d.place_name && ct.text ? autoLineTwo(d) : ''
  return {
    days,
    multi: days.length > 1,
    sameHours: new Set(days.map(x => `${x.start}|${x.end}`)).size <= 1,
    metal,
    /** A Luxe metal colour paints these like foil (a gradient) instead of a flat colour. */
    foil: metal ? `linear-gradient(115deg, ${metal.deep} 0%, ${metal.light} 28%, ${metal.pale} 46%, ${metal.base} 62%, ${metal.deep} 100%)` : null,
    /** The same foil for ink on a LIGHT card (no near-white glint - silver would vanish on ivory). */
    foilInk: metal ? `linear-gradient(115deg, ${mix(metal.deep, "#000000", 0.25)} 0%, ${metal.deep} 30%, ${metal.mid} 50%, ${metal.deep} 70%, ${mix(metal.deep, "#000000", 0.25)} 100%)` : null,
    coverPos: d.cover_position ? `${d.cover_position.x}% ${d.cover_position.y}%` : '50% 50%',
    /** The home's numbers (beds · baths · sq ft) - Midnight shows them under the date. */
    facts: [
      d.linked_property?.beds ? { v: String(d.linked_property.beds), l: 'Beds' } : null,
      d.linked_property?.baths ? { v: String(d.linked_property.baths), l: 'Baths' } : null,
      d.linked_property?.sqft ? { v: Math.round(Number(d.linked_property.sqft)).toLocaleString('en-US'), l: 'Sq Ft' } : null,
    ].filter(Boolean) as { v: string; l: string }[],
    weekday: dt ? dt.toLocaleDateString('en-US', { weekday: 'long' }) : 'Date to come',
    wk: dt ? dt.toLocaleDateString('en-US', { weekday: 'short' }) : '',
    monthDay: dt ? dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '',
    mon: dt ? dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '',
    dayNum: dt ? String(dt.getDate()).padStart(2, '0') : '',
    time: clockRange(d.start_time, d.end_time),
    street, rest,
    eyebrow: EYEBROW[d.invite_type] || "You're invited",
    title: ct.text,
    titleIsAddress: ct.isAddress,
    /** The street line at the bottom - not when the big title already IS that street, and not when
     *  the agent wrote their own line 2 (round 8 - they chose what the card says). */
    showStreet: own2 === null && !auto2 && !(ct.isAddress && norm(ct.text) === norm(street)),
    /** Line 2 under the title: the agent's own words exactly as typed; else the town under an address
     *  title; else (a title the agent wrote) the address - "street, town", the same words the builder's
     *  Line 2 box shows (round 8). */
    cityUnder: own2 !== null ? own2 : ct.isAddress && norm(ct.text) === norm(street) ? tidyCaps(rest) : auto2,
    ownLine2: own2 !== null || !!auto2,
    cover: coverOf(d),
    accent: accentOf(d.accent_color),
  }
}

type CoverPos = { x: number; y: number }
type CardProps = {
  data: InviteCardData; width?: number; className?: string; shine?: boolean
  /** The builder (owner, 10/31): the cover photo is dragged right here on the card - inside the
   *  design's own frame - and this gets the new position (% like object-position). */
  onCoverMove?: (p: CoverPos) => void
  /** Whether the photo has room to move inside its frame (sideways / up-down) - null = no photo. */
  onCoverRoom?: (r: { x: boolean; y: boolean } | null) => void
}

/** How far (card pixels) the cover photo hangs past its frame each way - object-fit: cover. */
function roomOf(box: HTMLElement, img: HTMLImageElement) {
  const bw = box.offsetWidth, bh = box.offsetHeight
  const k = Math.max(bw / img.naturalWidth, bh / img.naturalHeight)
  return { sx: img.naturalWidth * k - bw, sy: img.naturalHeight * k - bh }
}

/** Scales the 360px card to the box it sits in. */
function InviteCardBase({ data, width, className = '', shine = true, onCoverMove, onCoverRoom }: CardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(width || CARD_W)
  useEffect(() => {
    if (width) { setW(width); return }
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth || CARD_W))
    ro.observe(el)
    setW(el.clientWidth || CARD_W)
    return () => ro.disconnect()
  }, [width])
  const s = w / CARD_W
  const drag = useRef<{ px: number; py: number; x: number; y: number; sx: number; sy: number; raf: number; next: CoverPos | null } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [room, setRoom] = useState<{ x: boolean; y: boolean } | null>(null)
  const cover = coverOf(data)
  const frameKey = JSON.stringify(coverFrame(data))
  // Measure the photo's room once it has loaded (and again for a new photo / design / frame).
  useEffect(() => {
    if (!onCoverMove && !onCoverRoom) return
    const box = ref.current?.querySelector<HTMLElement>('[data-invite-cover]')
    const img = box?.querySelector('img')
    if (!box || !img || !cover) { setRoom(null); onCoverRoom?.(null); return }
    const measure = () => {
      if (!img.naturalWidth) return
      const r = roomOf(box, img)
      const next = { x: r.sx > 1, y: r.sy > 1 }
      setRoom(next); onCoverRoom?.(next)
    }
    if (img.complete) measure()
    img.addEventListener('load', measure)
    return () => img.removeEventListener('load', measure)
  }, [cover, data.design, frameKey, !!onCoverMove]) // eslint-disable-line react-hooks/exhaustive-deps
  const canDrag = !!onCoverMove && !!room && (room.x || room.y)
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * 10) / 10))
  const end = () => {
    const d = drag.current
    if (d) { cancelAnimationFrame(d.raf); if (d.next) onCoverMove?.(d.next) }
    drag.current = null; setDragging(false)
  }
  return (
    <div ref={ref} className={`relative ${canDrag ? `ic-drag ${dragging ? 'ic-dragging' : ''}` : ''} ${className}`} style={{ width: width || '100%', height: (width || w) * (CARD_H / CARD_W) }}
      data-testid={onCoverMove ? 'invite-card-draggable' : undefined}
      onPointerDown={canDrag ? e => {
        const box = (e.target as HTMLElement).closest<HTMLElement>('[data-invite-cover]')
        const img = box?.querySelector('img')
        if (!box || !img || !img.naturalWidth || !ref.current?.contains(box)) return
        const r = roomOf(box, img)
        const pos = data.cover_position || { x: 50, y: 50 }
        drag.current = { px: e.clientX, py: e.clientY, x: pos.x ?? 50, y: pos.y ?? 50, sx: r.sx, sy: r.sy, raf: 0, next: null }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
        setDragging(true)
      } : undefined}
      onPointerMove={canDrag ? e => {
        const d = drag.current
        if (!d) return
        // screen pixels -> the card's own pixels -> % of the room the photo has to move
        const dx = (e.clientX - d.px) / s, dy = (e.clientY - d.py) / s
        d.next = { x: d.sx > 1 ? clamp(d.x - (dx / d.sx) * 100) : d.x, y: d.sy > 1 ? clamp(d.y - (dy / d.sy) * 100) : d.y }
        if (!d.raf) d.raf = requestAnimationFrame(() => { const cur = drag.current; if (!cur) return; cur.raf = 0; if (cur.next) onCoverMove?.(cur.next) })
      } : undefined}
      onPointerUp={canDrag ? end : undefined} onPointerCancel={canDrag ? end : undefined}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: CARD_W, height: CARD_H, transform: `scale(${s})` }}>
        <CardFace data={data} shine={shine} flat={w < 150} imgW={Math.max(256, Math.round((width || w) * 2))} />
      </div>
    </div>
  )
}

const sameData = (a: InviteCardData, b: InviteCardData) => {
  if (a === b) return true
  const ka = Object.keys(a) as (keyof InviteCardData)[]
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k])
}

/** Re-draws only when something on the card changed (the builder re-renders on every key). */
const InviteCard = memo(InviteCardBase, (a, b) => a.width === b.width && a.className === b.className && a.shine === b.shine
  && a.onCoverMove === b.onCoverMove && a.onCoverRoom === b.onCoverRoom && sameData(a.data, b.data))
export default InviteCard

/** imgW: about how many real pixels wide the card is drawn - the cover and the agent's photo come
 *  resized to that (WebP, lib/siteImage) instead of the full-size upload (owner, 10/31 - a page of
 *  invite thumbnails was decoding dozens of full-size photos). */
export function CardFace({ data, shine = true, flat = false, imgW }: { data: InviteCardData; shine?: boolean; flat?: boolean; imgW?: number }) {
  const design: InviteDesign = (['classic', 'garden', 'midnight', 'modern'] as const).includes(data.design) ? data.design : 'classic'
  const base = parts(data)
  const p = imgW ? { ...base, cover: sizedImage(base.cover, imgW, 75) } : base
  const d = imgW && data.hostPhoto ? { ...data, hostPhoto: sizedImage(resolveMediaUrl(data.hostPhoto), 128, 75) } : data
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[14px] ${flat ? '' : 'shadow-[0_30px_60px_-30px_rgba(0,0,0,.55),0_2px_6px_rgba(0,0,0,.08)]'}`} style={{ fontFamily: 'inherit' }}>
      {/* one copy in the page however many cards there are (React hoists + de-dupes it) */}
      <style href="ohp-invite-card" precedence="medium">{CARD_CSS}</style>
      {design === 'classic' && <Classic d={d} p={p} shine={shine} />}
      {design === 'garden' && <Garden d={d} p={p} />}
      {design === 'midnight' && <Midnight d={d} p={p} shine={shine} />}
      {design === 'modern' && <Modern d={d} p={p} />}
    </div>
  )
}

type P = ReturnType<typeof parts>

const NUM_WORD = ['', 'One day', 'Two days', 'Three days', 'Four days', 'Five days', 'Six days', 'Seven days']

/** Text painted with the Luxe metal (a foil gradient), or a flat colour. */
function foilText(p: P, fallback: string, onLight = false): React.CSSProperties {
  const g = onLight ? p.foilInk : p.foil
  return g ? { backgroundImage: g, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: fallback }
}

/** Several days on the card (10/24): each day on its own line - with its hours when they differ,
 *  one shared time underneath when they're the same. Up to three, then "+ 2 more days". */
function DaysList({ p, color, sub, size = 19, italic = true, serif = true, align = 'center' }: {
  p: P; color: string; sub: string; size?: number; italic?: boolean; serif?: boolean; align?: 'center' | 'left'
}) {
  const shown = p.days.slice(0, 3)
  const more = p.days.length - shown.length
  const long = p.days.length <= 2
  return (
    <div className={`flex flex-col ${align === 'center' ? 'items-center text-center' : 'items-start text-left'}`} style={{ gap: 1 }}>
      {shown.map((x: InviteDay) => {
        const dt = parseDay(x.date)
        const name = dt.toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', month: long ? 'long' : 'short', day: 'numeric' })
        return (
          <p key={x.date} style={{ fontFamily: serif ? SERIF : undefined, fontStyle: italic ? 'italic' : 'normal', fontSize: size, color, lineHeight: 1.2, fontWeight: serif ? 400 : 800, whiteSpace: 'nowrap' }}>
            {name}
            {/* Two days with different hours: each date's time on its own bold line under it (round 4 - bigger, easier to read) */}
            {!p.sameHours && x.start ? (long
              ? <span style={{ display: 'block', fontFamily: 'Inter, system-ui, sans-serif', fontStyle: 'normal', fontSize: Math.max(13, Math.round(size * 0.68)), fontWeight: 800, color: sub, lineHeight: 1.25, marginBottom: 4 }}>{clockRange(x.start, x.end)}</span>
              : <span style={{ fontFamily: 'inherit', fontStyle: 'normal', fontSize: Math.round(size * 0.64), fontWeight: 700, color: sub }}> · {clockRange(x.start, x.end)}</span>) : null}
          </p>
        )
      })}
      {more > 0 && <p style={{ fontSize: 10, fontWeight: 800, color: sub, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 2 }}>+ {more} more day{more > 1 ? 's' : ''}</p>}
      {p.sameHours && p.time && <p style={{ fontSize: Math.max(13, Math.round(size * 0.72)), fontWeight: 800, color, marginTop: 4, fontFamily: 'inherit', fontStyle: 'normal' }}>{p.time}</p>}
    </div>
  )
}

function Monogram({ name, accent, size, dark = false }: { name?: string | null; accent: string; size: number; dark?: boolean }) {
  return (
    <div className="grid place-items-center rounded-full" style={{ width: size, height: size, background: dark ? '#141821' : mix(accent, '#ffffff', 0.86), border: `1.5px solid ${accent}` }}>
      <span style={{ fontFamily: SERIF, fontSize: size * 0.36, fontWeight: 700, color: dark ? mix(accent, '#ffffff', 0.35) : mix(accent, '#000000', 0.25), letterSpacing: 1 }}>{initialsOf(name)}</span>
    </div>
  )
}

const photoSet = (u?: string | null) => !!u && u.trim() !== '' && u.trim() !== '/home.jpg'

/** The agent at the foot of every invite (owner, 10/24 rounds 5-6): the photo centred on top (initials
 *  when there's none), then three centred lines - the name in the invite's display font, the service
 *  area, the brokerage. A missing line is left out entirely. Long words step the type down a little
 *  and only a very long line ends in "...". */
function Host({ d, color, sub, ring, font = SERIF, italic = false, weight = 600, dark = false, size = 15, maxW = 296, plate }: {
  d: InviteCardData; color: string; sub: string; ring: string; font?: string; italic?: boolean; weight?: number; dark?: boolean; size?: number; align?: 'center' | 'left'; maxW?: number
  /** Garden: a soft nameplate behind the footer so the corner sprig can pass behind it */
  plate?: string
}) {
  if (!d.hostName) return null
  const inner = maxW - (plate ? 28 : 8)
  const fitTo = (text: string, max: number, min: number, k: number) => Math.max(min, Math.min(max, inner / Math.max(1, text.length * k)))
  const nameSize = fitTo(d.hostName, size, 11.5, weight >= 700 ? 0.56 : 0.5)
  const lines = [d.hostArea, d.hostBrokerage].map(x => (x || '').trim()).filter(Boolean)
  const P = 40
  return (
    <div className="mx-auto flex min-w-0 flex-col items-center text-center" data-invite-host=""
      style={{ maxWidth: maxW, ...(plate ? { background: plate, borderRadius: 18, padding: '6px 14px 6px', boxShadow: '0 6px 16px -10px rgba(0,0,0,.25)' } : {}) }}>
      {photoSet(d.hostPhoto)
        ? <img src={(d.hostPhoto as string).startsWith('/_next/image') ? d.hostPhoto as string : resolveMediaUrl(d.hostPhoto as string)} alt="" className="shrink-0 rounded-full object-cover" style={{ width: P, height: P, boxShadow: `0 0 0 1.5px ${ring}, 0 0 0 3.5px ${dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.9)'}` }} />
        : <span className="grid shrink-0 place-items-center rounded-full" style={{ width: P, height: P, background: dark ? '#1a1e27' : mix(ring, '#ffffff', 0.86), boxShadow: `0 0 0 1.5px ${ring}`, fontFamily: SERIF, fontSize: 14, fontWeight: 700, color: dark ? mix(ring, '#ffffff', 0.35) : mix(ring, '#000000', 0.3), letterSpacing: 0.5 }}>{initialsOf(d.hostName)}</span>}
      <p className="mt-1.5 w-full truncate" title={d.hostName} style={{ fontFamily: font, fontStyle: italic ? 'italic' : 'normal', fontSize: nameSize, fontWeight: weight, color, lineHeight: 1.15 }}>{d.hostName}</p>
      {lines.map(x => (
        <p key={x} className="w-full truncate" title={x} style={{ fontSize: fitTo(x, 10, 8.5, 0.53), fontWeight: 600, color: sub, marginTop: 1.5, lineHeight: 1.25 }}>{x}</p>
      ))}
    </div>
  )
}

/** Line 2 under the big title - small caps; longer agent-typed words step down and wrap to two lines. */
function LineTwo({ text, color }: { text: string; color: string }) {
  const long = text.length > 30
  return (
    <p className="mt-1 text-center" style={{ fontSize: long ? 9 : 10, letterSpacing: long ? 1.3 : 2.4, fontWeight: 700, color, textTransform: 'uppercase', lineHeight: 1.35,
      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text}</p>
  )
}

function Title({ text, size, color, italic = false, lines = 2 }: { text: string; size: number; color: string; italic?: boolean; lines?: number }) {
  const fit = text.length > 44 ? size * 0.72 : text.length > 30 ? size * 0.84 : size
  return (
    <h1 className="text-center" style={{ fontFamily: SERIF, fontSize: fit, lineHeight: 1.08, fontWeight: italic ? 400 : 700, fontStyle: italic ? 'italic' : 'normal', color,
      display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden', letterSpacing: -0.2 }}>
      {text || 'Your event'}
    </h1>
  )
}

/** The home's beds · baths · sq ft between thin rules, centred in the card's free space (light designs). */
function FactsBand({ p, color, sub, rule, serifItalic = false }: { p: P; color: string; sub: string; rule: string; serifItalic?: boolean }) {
  if (!p.facts.length || p.days.length > 2) return null
  return (
    <div className="flex w-full flex-1 items-center justify-center" style={{ minHeight: 0, paddingTop: 6, paddingBottom: 8 }}>
      {p.facts.map((f, i) => (
        <div key={f.l} className="flex flex-col items-center" style={{ padding: '0 14px', borderLeft: i ? `1px solid ${rule}` : undefined }}>
          <span style={{ fontFamily: SERIF, fontSize: 18, lineHeight: 1.1, fontWeight: 700, fontStyle: serifItalic ? 'italic' : 'normal', ...(p.foilInk ? { backgroundImage: p.foilInk, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color }) }}>{f.v}</span>
          <span style={{ fontSize: 8.5, letterSpacing: 2.2, fontWeight: 800, color: sub, textTransform: 'uppercase', marginTop: 2 }}>{f.l}</span>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Classic - ivory, fine border

function Classic({ d, p, shine }: { d: InviteCardData; p: P; shine: boolean }) {
  const a = p.accent
  const ink = '#1f1b16'
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#fdfbf6 0%,#f7f1e4 100%)' }}>
      <div className="absolute" style={{ inset: 10, border: `1.5px solid ${a}`, borderRadius: 8 }} />
      <div className="absolute" style={{ inset: 15, border: `0.75px solid ${mix(a, '#ffffff', 0.35)}`, borderRadius: 5 }} />
      <div className="absolute inset-0 flex flex-col items-center px-9 pb-7 pt-9">
        {p.cover ? (
          <div className="relative overflow-hidden" data-invite-cover="" style={{ width: coverFrame(d).w, height: coverFrame(d).h, borderRadius: '98px 98px 10px 10px', boxShadow: `0 0 0 3px #fdfbf6, 0 0 0 4px ${a}` }}>
            <img src={p.cover} alt="" className="h-full w-full object-cover" style={{ objectPosition: p.coverPos }} />
          </div>
        ) : <Monogram name={d.hostName} accent={a} size={p.multi ? 80 : 92} />}
        <p className={p.multi ? 'mt-4' : 'mt-5'} style={{ fontSize: 10, letterSpacing: 4, fontWeight: 800, textTransform: 'uppercase', ...foilText(p, a, true) }}>{p.eyebrow}</p>
        <div className="mt-2 w-full"><Title text={p.title} size={p.multi ? 25 : 27} color={ink} /></div>
        {p.cityUnder && <LineTwo text={p.cityUnder} color="#7a7064" />}
        <div className={`${p.multi ? 'my-2.5' : 'my-3'} flex w-full items-center justify-center gap-2`}>
          <span className={shine ? 'ic-foil' : ''} style={{ height: 1, width: 56, background: p.foilInk || a }} />
          <span style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: p.foilInk || a }} />
          <span className={shine ? 'ic-foil' : ''} style={{ height: 1, width: 56, background: p.foilInk || a }} />
        </div>
        {/* The date(s), large, in the card's open middle (owner, 10/24 round 4: dates, not the home's numbers) */}
        <div className="flex w-full flex-1 flex-col items-center justify-center" style={{ minHeight: 0 }}>
          {p.multi ? (
            <>
              <p style={{ fontSize: 10, letterSpacing: 3, fontWeight: 800, color: '#6b6257', textTransform: 'uppercase', marginBottom: 3 }}>{NUM_WORD[p.days.length] || `${p.days.length} days`}</p>
              <DaysList p={p} color={ink} sub="#7a7064" size={p.days.length > 2 ? 17 : 21} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 11, letterSpacing: 3.2, fontWeight: 800, color: '#6b6257', textTransform: 'uppercase' }}>{p.weekday}</p>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 37, color: ink, lineHeight: 1.15 }}>{p.monthDay}</p>
              {p.time && <p style={{ fontSize: 17, fontWeight: 800, color: ink, marginTop: 3 }}>{p.time}</p>}
            </>
          )}
        </div>
        <div className="mt-auto w-full text-center">
          {p.street && p.showStreet && <p className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: ink }}>{p.street}</p>}
          {p.rest && !p.cityUnder && !p.ownLine2 && <p className="truncate" style={{ fontSize: 10.5, color: '#7a7064' }}>{p.rest}</p>}
          <div className="mt-2.5"><Host d={d} color={ink} sub="#8b8174" ring={a} weight={700} /></div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Garden - soft botanicals

function Sprig({ color, flip = false, style }: { color: string; flip?: boolean; style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 120" className="absolute" style={{ ...style, transform: flip ? 'scale(-1,-1)' : undefined }} aria-hidden>
      <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 6c30 8 52 26 66 58" />
        <path d="M20 12c-2 10 2 18 12 22M34 20c-1 11 3 19 13 23M48 32c0 10 4 17 13 21M60 46c1 9 4 15 11 19" />
      </g>
      <g fill={color} opacity=".55">
        <ellipse cx="22" cy="24" rx="7" ry="3.4" transform="rotate(40 22 24)" />
        <ellipse cx="37" cy="32" rx="7.5" ry="3.6" transform="rotate(45 37 32)" />
        <ellipse cx="51" cy="43" rx="7" ry="3.4" transform="rotate(52 51 43)" />
        <ellipse cx="63" cy="56" rx="6.4" ry="3.1" transform="rotate(60 63 56)" />
        <ellipse cx="13" cy="16" rx="5" ry="2.6" transform="rotate(25 13 16)" />
      </g>
      <circle cx="74" cy="66" r="3.2" fill={color} />
    </svg>
  )
}

function Garden({ d, p }: { d: InviteCardData; p: P }) {
  const a = p.accent
  const leaf = mix(a, '#4f6f52', 0.35)
  const ink = '#26302a'
  return (
    <div className="absolute inset-0" style={{ background: `radial-gradient(120% 80% at 50% 0%, ${mix(a, '#ffffff', 0.9)} 0%, #f6f3ea 60%)` }}>
      <Sprig color={leaf} style={{ left: -6, top: -6, width: 130, height: 130 }} />
      {/* A little smaller when the agent's footer is there (round 5) - it tucks behind the footer's nameplate */}
      <Sprig color={leaf} flip style={d.hostName ? { right: -10, bottom: -10, width: 104, height: 104 } : { right: -6, bottom: -6, width: 130, height: 130 }} />
      <div className="absolute inset-0 flex flex-col items-center px-10 pb-8 pt-10">
        {/* A wide soft-cornered frame (round 4: the circle cut off too much of the house) - a home
            photo fits it as taken, no dragging needed. */}
        {p.cover ? (
          <div className="relative overflow-hidden" data-invite-cover="" style={{ width: coverFrame(d).w, height: coverFrame(d).h, borderRadius: 18, boxShadow: `0 0 0 6px #ffffff, 0 0 0 7px ${mix(a, '#ffffff', 0.45)}, 0 18px 30px -16px rgba(0,0,0,.45)` }}>
            <img src={p.cover} alt="" className="h-full w-full object-cover" style={{ objectPosition: p.coverPos }} />
          </div>
        ) : <Monogram name={d.hostName} accent={a} size={p.multi ? 88 : 104} />}
        <p className={p.multi ? 'mt-4' : 'mt-5'} style={{ fontSize: 9.5, letterSpacing: 4, fontWeight: 800, textTransform: 'uppercase', ...foilText(p, leaf, true) }}>{p.eyebrow}</p>
        <div className="mt-1.5 w-full"><Title text={p.title} size={p.multi ? 28 : 31} color={ink} italic /></div>
        {p.cityUnder && <LineTwo text={p.cityUnder} color="#6d756e" />}
        <div className="flex w-full flex-1 flex-col items-center justify-center" style={{ minHeight: 0 }}>
        {p.multi ? (
          <div className="w-full rounded-2xl px-3 py-2.5" style={{ border: `1px solid ${mix(a, '#ffffff', 0.4)}`, background: 'rgba(255,255,255,.55)' }}>
            <DaysList p={p} color={ink} sub="#6d756e" size={p.days.length > 2 ? 16 : 19} />
          </div>
        ) : (
        <div className="flex w-full items-stretch justify-center" style={{ color: ink }}>
          <div className="flex flex-1 flex-col items-end justify-center pr-3.5" style={{ borderRight: `1px solid ${a}` }}>
            <span style={{ fontSize: 12, letterSpacing: 2.5, fontWeight: 800, textTransform: 'uppercase' }}>{p.wk || 'Soon'}</span>
          </div>
          <div className="flex flex-col items-center px-3.5">
            <span style={{ fontSize: 11, letterSpacing: 2.5, fontWeight: 800, color: a }}>{p.mon}</span>
            <span style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1, fontWeight: 700 }}>{p.dayNum || '--'}</span>
          </div>
          <div className="flex flex-1 flex-col items-start justify-center pl-3.5" style={{ borderLeft: `1px solid ${a}` }}>
            <span style={{ fontSize: 13, letterSpacing: 0.6, fontWeight: 800, whiteSpace: 'nowrap' }}>{p.time || 'Time TBA'}</span>
          </div>
        </div>
        )}
        </div>
        <div className="mt-auto w-full text-center">
          {p.street && p.showStreet && <p className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: ink }}>{p.street}</p>}
          {p.rest && !p.cityUnder && !p.ownLine2 && <p className="truncate" style={{ fontSize: 10.5, color: '#6d756e' }}>{p.rest}</p>}
          <div className="mt-2.5" style={{ marginLeft: -20, marginRight: -20 }}><Host d={d} color={ink} sub="#7d857e" ring={leaf} italic weight={500} size={16} maxW={318} plate="rgba(255,255,255,.86)" /></div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Midnight - dark, metallic

function Midnight({ d, p, shine }: { d: InviteCardData; p: P; shine: boolean }) {
  const a = p.accent
  const metal = p.foil || `linear-gradient(120deg, ${mix(a, '#ffffff', 0.55)} 0%, ${a} 45%, ${mix(a, '#000000', 0.2)} 70%, ${mix(a, '#ffffff', 0.4)} 100%)`
  const corner = (pos: React.CSSProperties, rot: number) => (
    <span className="absolute" style={{ ...pos, width: 26, height: 26, borderTop: `1.5px solid ${a}`, borderLeft: `1.5px solid ${a}`, transform: `rotate(${rot}deg)` }} />
  )
  const top = p.cover ? (p.multi ? 150 : 176) : (p.multi ? 50 : 70)
  return (
    <div className="absolute inset-0" style={{ background: '#0e1118' }}>
      {p.cover && (
        <div className="absolute inset-x-0 top-0" data-invite-cover="" style={{ height: coverFrame(d).h }}>
          <img src={p.cover} alt="" className="h-full w-full object-cover" style={{ opacity: 0.85, objectPosition: p.coverPos }} />
          <div className="absolute inset-x-0 top-0" style={{ height: 'calc(100% + 3px)', background: 'linear-gradient(180deg, rgba(11,13,18,.15) 0%, rgba(14,17,24,.6) 55%, #0e1118 88%, #0e1118 100%)' }} />
        </div>
      )}
      {corner({ left: 12, top: 12 }, 0)}{corner({ right: 12, top: 12 }, 90)}{corner({ right: 12, bottom: 12 }, 180)}{corner({ left: 12, bottom: 12 }, 270)}
      <div className="absolute inset-0 flex flex-col items-center px-9 pb-8" style={{ paddingTop: top }}>
        {!p.cover && <div className={p.multi ? 'mb-4' : 'mb-6'}><Monogram name={d.hostName} accent={a} size={p.multi ? 76 : 92} dark /></div>}
        <p className={shine ? 'ic-metal-text' : ''} style={{ fontSize: 10, letterSpacing: 4.5, fontWeight: 800, textTransform: 'uppercase', backgroundImage: metal, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', backgroundSize: '200% 100%' }}>{p.eyebrow}</p>
        <div className="mt-2 w-full"><Title text={p.title} size={p.multi ? 26 : 29} color="#f6f1e7" /></div>
        {p.cityUnder && <LineTwo text={p.cityUnder} color="#a8a296" />}
        <span className={p.multi ? 'my-3' : 'my-3.5'} style={{ height: 1.5, width: 90, backgroundImage: metal }} />
        {/* The date(s), large, in the card's open middle (owner, 10/24 round 4) */}
        <div className="flex w-full flex-1 flex-col items-center justify-center" style={{ minHeight: 0 }}>
          {p.multi ? (
            <>
              <p style={{ fontSize: 10, letterSpacing: 3, fontWeight: 800, color: '#a8a296', textTransform: 'uppercase', marginBottom: 3 }}>{NUM_WORD[p.days.length] || `${p.days.length} days`}</p>
              <DaysList p={p} color={mix(a, '#ffffff', 0.3)} sub="#a8a296" italic={false} size={p.days.length > 2 ? 17 : 21} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 11, letterSpacing: 3.2, fontWeight: 800, color: '#a8a296', textTransform: 'uppercase' }}>{p.weekday}</p>
              <p style={{ fontFamily: SERIF, fontSize: 38, color: mix(a, '#ffffff', 0.3), lineHeight: 1.15 }}>{p.monthDay}</p>
              {p.time && <p style={{ fontSize: 17, fontWeight: 800, color: '#e9e4da', marginTop: 3 }}>{p.time}</p>}
            </>
          )}
        </div>
        <div className="mt-auto w-full text-center">
          {p.street && p.showStreet && <p className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: '#f2ede3' }}>{p.street}</p>}
          {p.rest && !p.cityUnder && !p.ownLine2 && <p className="truncate" style={{ fontSize: 10.5, color: '#9a958b' }}>{p.rest}</p>}
          <div className="mt-2.5"><Host d={d} color="#f2ede3" sub="#9a958b" ring={mix(a, '#ffffff', 0.15)} dark /></div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Modern - big photo, bold type

/** Modern's address headline (owner, 10/24 round 7): street and city on ONE line ("239 Windham Dr,
 *  Exton"), stepping the type down from 34px to fit but never under 22px. Still too long at 22px (a
 *  very long address) - two balanced lines, sized so neither is huge. Measured in the card's own
 *  pixels, so it's the same on the guest page, the builder, the invites window and the print. */
function FitHeadline({ text, style }: { text: string; style: React.CSSProperties }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const [fit, setFit] = useState<{ size: number; wrap: boolean }>({ size: 34, wrap: false })
  const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect
  useIso(() => {
    const el = ref.current
    if (!el) return
    const run = () => {
      const keep = { ws: el.style.whiteSpace, fs: el.style.fontSize, d: el.style.display }
      el.style.display = 'block'; el.style.whiteSpace = 'nowrap'
      // the text's own width (an inline probe - layout pixels, so the card's scaling doesn't matter)
      const probe = document.createElement('span')
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0'
      probe.textContent = text
      el.appendChild(probe)
      for (let sz = 34; sz >= 22; sz -= 1) {
        el.style.fontSize = `${sz}px`
        if (probe.offsetWidth <= el.clientWidth - 3) { probe.remove(); Object.assign(el.style, { whiteSpace: keep.ws, fontSize: keep.fs, display: keep.d }); setFit({ size: sz, wrap: false }); return }
      }
      probe.remove()
      el.style.whiteSpace = 'normal'
      let best = 18
      for (let sz = 28; sz >= 18; sz -= 1) {
        el.style.fontSize = `${sz}px`
        if (el.scrollHeight <= sz * 1.08 * 2 + 2) { best = sz; break }
      }
      Object.assign(el.style, { whiteSpace: keep.ws, fontSize: keep.fs, display: keep.d })
      setFit({ size: best, wrap: true })
    }
    run()
    let off = false
    document.fonts?.ready.then(() => { if (!off) run() })
    return () => { off = true }
  }, [text])
  return (
    <h1 ref={ref} data-invite-headline="" style={{ ...style, fontSize: fit.size, lineHeight: fit.wrap ? 1.08 : 1.02, whiteSpace: fit.wrap ? 'normal' : 'nowrap', overflow: 'hidden',
      ...(fit.wrap ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textWrap: 'balance' } as React.CSSProperties : { display: 'block', textOverflow: 'ellipsis' }) }}>{text}</h1>
  )
}

/** Modern (round 8, owner: "a little bland"): clean and bold - the photo with an accent label pill,
 *  the address big on it, then a white sheet that curves up over the photo's edge holding the date as
 *  a ticket (one day) or one tile per day side by side, each with its own hours (two or three days). */
function Modern({ d, p }: { d: InviteCardData; p: P }) {
  const a = p.accent
  const on = onAccent(a)
  const ink = '#111827'
  const deep = mix(a, '#000000', 0.25)
  const tint = mix(a, '#ffffff', 0.9)
  const fill = p.foil || a
  const fillInk = p.foil ? '#17140f' : on
  const H = coverFrame(d).h
  const LIP = 22  // how far the white sheet curves up over the photo
  // Line 1 / line 2 (round 8). Default: "239 Windham Dr, Exton" on one line (round 7). The agent's
  // own line 2 sits under line 1 exactly as typed ('' = none).
  const city = d.place_name ? '' : tidyCaps((p.rest || '').split(',')[0].trim())
  const own2 = p.ownLine2 ? p.cityUnder : null
  const line1 = p.titleIsAddress && own2 === null ? [p.title, city].filter(Boolean).join(', ') : (p.title || 'Your event')
  const line2 = own2 !== null ? own2 : p.titleIsAddress ? '' : d.place_name ? (p.street || '') : [p.showStreet ? tidyCaps(p.street || '') : '', city].filter(Boolean).join(', ')
  const days = p.days.slice(0, 3)
  const more = p.days.length - days.length
  const dayWord = (s: string, o: Intl.DateTimeFormatOptions) => parseDay(s).toLocaleDateString('en-US', o)
  return (
    <div className="absolute inset-0 bg-white">
      <div className="absolute inset-x-0 top-0 overflow-hidden" data-invite-cover="" style={{ height: H }}>
        {p.cover ? <img src={p.cover} alt="" className="h-full w-full object-cover" style={{ objectPosition: p.coverPos }} /> : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${a} 0%, ${mix(a, '#000000', 0.35)} 100%)` }}>
            <svg viewBox="0 0 360 300" className="h-full w-full opacity-20" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => <circle key={i} cx={300} cy={40} r={30 + i * 34} fill="none" stroke="#fff" strokeWidth="1" />)}
            </svg>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,.08) 42%, rgba(0,0,0,.62) 70%, rgba(0,0,0,.9) 100%)' }} />
        {/* the label as an accent pill, top left */}
        <span className="absolute left-5 top-5 inline-flex items-center rounded-full" style={{ padding: '6px 12px 6px 10px', background: fill, color: fillInk, boxShadow: '0 8px 18px -8px rgba(0,0,0,.55)' }}>
          <span className="mr-1.5 inline-block rounded-full" style={{ width: 6, height: 6, background: fillInk, opacity: 0.85 }} />
          <span style={{ fontSize: 10, letterSpacing: 2.6, fontWeight: 900, textTransform: 'uppercase' }}>{p.eyebrow}</span>
        </span>
        <div className="absolute inset-x-0 px-6" style={{ bottom: LIP + 14 }}>
          <span className="block rounded-full" style={{ width: 28, height: 3, background: fill, marginBottom: 8 }} />
          <FitHeadline text={line1} style={{ fontWeight: 900, color: '#ffffff', letterSpacing: -0.8 }} />
          {line2 && <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.88)', marginTop: 4, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{line2}</p>}
          {p.facts.length > 0 && (
            <div className="flex items-center" style={{ marginTop: 9, gap: 10 }}>
              {p.facts.map((f, i) => (
                <span key={f.l} className="inline-flex items-center" style={{ gap: 10 }}>
                  {i > 0 && <span className="inline-block rounded-full" style={{ width: 3, height: 3, background: 'rgba(255,255,255,.55)' }} />}
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', whiteSpace: 'nowrap' }}>{f.v} <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5, color: 'rgba(255,255,255,.72)', textTransform: 'uppercase' }}>{f.l}</span></span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* the white sheet over the photo's edge */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col bg-white px-6 pb-4" style={{ top: H - LIP, borderRadius: '26px 26px 0 0', paddingTop: 18, boxShadow: '0 -10px 24px -18px rgba(0,0,0,.6)' }}>
        <div className="flex flex-1 items-center" style={{ minHeight: 0 }}>
          {p.days.length <= 1 ? (
            // one day: a ticket - the date block in the accent, the day and hours beside it
            <div className="flex w-full overflow-hidden rounded-[18px]" style={{ height: 84, background: tint, boxShadow: `inset 0 0 0 1px ${mix(a, '#ffffff', 0.75)}` }}>
              <div className="flex shrink-0 flex-col items-center justify-center" style={{ width: 84, background: fill, color: fillInk }}>
                <span style={{ fontSize: 11, letterSpacing: 2.5, fontWeight: 900 }}>{p.mon || 'DATE'}</span>
                <span style={{ fontSize: 38, lineHeight: 0.95, fontWeight: 900, letterSpacing: -1.5 }}>{p.dayNum || '--'}</span>
              </div>
              <div className="relative flex min-w-0 flex-1 flex-col justify-center" style={{ paddingLeft: 16 }}>
                <span className="absolute inset-y-3 left-0 border-l-2 border-dashed" style={{ borderColor: mix(a, '#ffffff', 0.55) }} />
                <span style={{ fontSize: 11, letterSpacing: 2.2, fontWeight: 900, color: deep, textTransform: 'uppercase' }}>{p.weekday}</span>
                {p.time && <span style={{ fontSize: 24, fontWeight: 900, color: ink, letterSpacing: -0.6, lineHeight: 1.1, marginTop: 2 }}>{p.time}</span>}
              </div>
            </div>
          ) : (
            // two or three days: one tile each, side by side, each with ITS OWN hours
            <div className="w-full">
              <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gap: days.length > 2 ? 8 : 12 }}>
                {days.map(x => (
                  <div key={x.date} className="flex flex-col items-center overflow-hidden rounded-[16px] text-center" style={{ background: tint, boxShadow: `inset 0 0 0 1px ${mix(a, '#ffffff', 0.75)}` }}>
                    <span className="w-full" style={{ background: fill, color: fillInk, fontSize: 10, letterSpacing: 2.4, fontWeight: 900, padding: '5px 0 4px' }}>{dayWord(x.date, { weekday: 'short' }).toUpperCase()}</span>
                    <span style={{ fontSize: days.length > 2 ? 18 : 23, fontWeight: 900, color: ink, letterSpacing: -0.6, lineHeight: 1.05, marginTop: 7 }}>{dayWord(x.date, { month: 'short', day: 'numeric' })}</span>
                    <span style={{ fontSize: days.length > 2 ? 11 : 13.5, fontWeight: 800, color: deep, marginTop: 3, marginBottom: 9, whiteSpace: 'nowrap' }}>{x.start ? clockRange(x.start, x.end) : ''}</span>
                  </div>
                ))}
              </div>
              {more > 0 && <p className="text-center" style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 5 }}>+ {more} more day{more > 1 ? 's' : ''}</p>}
            </div>
          )}
        </div>
        <div className="mt-auto pt-3" style={{ borderTop: '1px solid #eef0f3' }}>
          <Host d={d} color={ink} sub="#6b7280" ring={a} font="inherit" weight={800} size={14} maxW={312} />
        </div>
      </div>
    </div>
  )
}

// Midnight's metal label shimmers a few times and rests (owner, 10/31 - nothing runs forever).
// .ic-drag: the builder's card - the photo box takes the drag (and never scrolls the page under a
// finger); a "drag" pill sits on the photo until it's grabbed.
const CARD_CSS = `
.ic-foil{background-size:200% 100% !important}
.ic-metal-text{animation:icMetal 5s ease-in-out 3}
@keyframes icMetal{0%,100%{background-position:0% 0}50%{background-position:100% 0}}
.ic-drag [data-invite-cover]{touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}
.ic-drag [data-invite-cover] img{pointer-events:none;-webkit-user-drag:none}
.ic-drag.ic-dragging [data-invite-cover]{cursor:grabbing}
.ic-drag [data-invite-cover]::after{content:"Drag to center";position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font:900 13px/1 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;pointer-events:none;transition:opacity .2s}
.ic-drag.ic-dragging [data-invite-cover]::after{opacity:0}
@media (prefers-reduced-motion:reduce){.ic-metal-text{animation:none}}
`
