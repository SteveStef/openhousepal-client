'use client'

import { useEffect, useRef, useState } from 'react'
import { resolveMediaUrl } from '@/lib/api-service'
import { accentOf, clockRange, initialsOf, mix, onAccent, parseDay, type InviteDesign, type InviteDraft } from '@/lib/invites'
import { SERIF } from './inviteFonts'

// The invitation itself - a paper card drawn at a fixed 360 x 504 (5:7, like a printed invite) and
// scaled to whatever width it's shown at, so the type keeps its proportions on a phone, in the
// creation flow's preview and on the agent's list. Four designs, all tinted by the agent's colour.
// No blur anywhere (snappy on phones) - only transforms and opacity move.

export const CARD_W = 360
export const CARD_H = 504

export type InviteCardData = Pick<InviteDraft, 'invite_type' | 'title' | 'event_date' | 'start_time' | 'end_time' | 'place_name' | 'address' | 'cover_image_url' | 'linked_property' | 'design' | 'accent_color'> & {
  hostName?: string | null
  hostBrokerage?: string | null
  hostPhoto?: string | null
}

const EYEBROW: Record<string, string> = { open_house: 'Open House', brokers_open: "Broker's Open", client_event: "You're invited", custom: "You're invited" }

export function coverOf(d: Pick<InviteDraft, 'cover_image_url' | 'linked_property'>): string {
  const lp = d.linked_property
  const src = d.cover_image_url || (lp && !lp.no_cover ? lp.image || lp.photos?.[0] : '') || ''
  return src ? resolveMediaUrl(src) : ''
}

function parts(d: InviteCardData) {
  const dt = d.event_date ? parseDay(d.event_date) : null
  const street = (d.place_name || d.address || '').split(',')[0]
  const rest = d.place_name ? (d.address || '').split(',')[0] : (d.address || '').split(',').slice(1, 3).join(',').trim()
  return {
    weekday: dt ? dt.toLocaleDateString('en-US', { weekday: 'long' }) : 'Date to come',
    wk: dt ? dt.toLocaleDateString('en-US', { weekday: 'short' }) : '',
    monthDay: dt ? dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '',
    mon: dt ? dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : '',
    dayNum: dt ? String(dt.getDate()).padStart(2, '0') : '',
    time: clockRange(d.start_time, d.end_time),
    street, rest,
    eyebrow: EYEBROW[d.invite_type] || "You're invited",
    cover: coverOf(d),
    accent: accentOf(d.accent_color),
  }
}

/** Scales the 360px card to the box it sits in. */
export default function InviteCard({ data, width, className = '', shine = true }: { data: InviteCardData; width?: number; className?: string; shine?: boolean }) {
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
  return (
    <div ref={ref} className={`relative ${className}`} style={{ width: width || '100%', height: (width || w) * (CARD_H / CARD_W) }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: CARD_W, height: CARD_H, transform: `scale(${s})` }}>
        <CardFace data={data} shine={shine} />
      </div>
    </div>
  )
}

export function CardFace({ data, shine = true }: { data: InviteCardData; shine?: boolean }) {
  const design: InviteDesign = (['classic', 'garden', 'midnight', 'modern'] as const).includes(data.design) ? data.design : 'classic'
  const p = parts(data)
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[14px] shadow-[0_30px_60px_-30px_rgba(0,0,0,.55),0_2px_6px_rgba(0,0,0,.08)]" style={{ fontFamily: 'inherit' }}>
      <style>{CARD_CSS}</style>
      {design === 'classic' && <Classic d={data} p={p} shine={shine} />}
      {design === 'garden' && <Garden d={data} p={p} />}
      {design === 'midnight' && <Midnight d={data} p={p} shine={shine} />}
      {design === 'modern' && <Modern d={data} p={p} />}
    </div>
  )
}

type P = ReturnType<typeof parts>

function Monogram({ name, accent, size, dark = false }: { name?: string | null; accent: string; size: number; dark?: boolean }) {
  return (
    <div className="grid place-items-center rounded-full" style={{ width: size, height: size, background: dark ? '#141821' : mix(accent, '#ffffff', 0.86), border: `1.5px solid ${accent}` }}>
      <span style={{ fontFamily: SERIF, fontSize: size * 0.36, fontWeight: 700, color: dark ? mix(accent, '#ffffff', 0.35) : mix(accent, '#000000', 0.25), letterSpacing: 1 }}>{initialsOf(name)}</span>
    </div>
  )
}

function Host({ d, color, sub }: { d: InviteCardData; color: string; sub: string }) {
  if (!d.hostName) return null
  return (
    <p className="text-center" style={{ fontSize: 9.5, letterSpacing: 1.6, color, textTransform: 'uppercase', fontWeight: 700 }}>
      Hosted by {d.hostName}{d.hostBrokerage ? <span style={{ color: sub, fontWeight: 600 }}> · {d.hostBrokerage}</span> : null}
    </p>
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
          <div className="relative overflow-hidden" style={{ width: 196, height: 138, borderRadius: '98px 98px 10px 10px', boxShadow: `0 0 0 3px #fdfbf6, 0 0 0 4px ${a}` }}>
            <img src={p.cover} alt="" className="h-full w-full object-cover" />
          </div>
        ) : <Monogram name={d.hostName} accent={a} size={92} />}
        <p className="mt-5" style={{ fontSize: 10, letterSpacing: 4, fontWeight: 800, color: a, textTransform: 'uppercase' }}>{p.eyebrow}</p>
        <div className="mt-2 w-full"><Title text={d.title} size={27} color={ink} /></div>
        <div className="my-3 flex w-full items-center justify-center gap-2">
          <span className={shine ? 'ic-foil' : ''} style={{ height: 1, width: 56, background: a }} />
          <span style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: a }} />
          <span className={shine ? 'ic-foil' : ''} style={{ height: 1, width: 56, background: a }} />
        </div>
        <p style={{ fontSize: 10, letterSpacing: 3, fontWeight: 800, color: '#6b6257', textTransform: 'uppercase' }}>{p.weekday}</p>
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 25, color: ink, lineHeight: 1.2 }}>{p.monthDay}</p>
        {p.time && <p style={{ fontSize: 12.5, fontWeight: 700, color: ink, marginTop: 2 }}>{p.time}</p>}
        <div className="mt-auto w-full text-center">
          {p.street && <p className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: ink }}>{p.street}</p>}
          {p.rest && <p className="truncate" style={{ fontSize: 10.5, color: '#7a7064' }}>{p.rest}</p>}
          <div className="mt-2.5"><Host d={d} color={a} sub="#8b8174" /></div>
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
      <Sprig color={leaf} flip style={{ right: -6, bottom: -6, width: 130, height: 130 }} />
      <div className="absolute inset-0 flex flex-col items-center px-10 pb-8 pt-10">
        {p.cover ? (
          <div className="overflow-hidden rounded-full" style={{ width: 142, height: 142, boxShadow: `0 0 0 6px #ffffff, 0 0 0 7px ${mix(a, '#ffffff', 0.45)}, 0 18px 30px -16px rgba(0,0,0,.45)` }}>
            <img src={p.cover} alt="" className="h-full w-full object-cover" />
          </div>
        ) : <Monogram name={d.hostName} accent={a} size={104} />}
        <p className="mt-5" style={{ fontSize: 9.5, letterSpacing: 4, fontWeight: 800, color: leaf, textTransform: 'uppercase' }}>{p.eyebrow}</p>
        <div className="mt-1.5 w-full"><Title text={d.title} size={31} color={ink} italic /></div>
        <div className="mt-4 flex w-full items-stretch justify-center" style={{ color: ink }}>
          <div className="flex flex-1 flex-col items-end justify-center pr-3" style={{ borderRight: `1px solid ${a}` }}>
            <span style={{ fontSize: 10, letterSpacing: 2.5, fontWeight: 800, textTransform: 'uppercase' }}>{p.wk || 'Soon'}</span>
          </div>
          <div className="flex flex-col items-center px-3">
            <span style={{ fontSize: 9.5, letterSpacing: 2.5, fontWeight: 800, color: a }}>{p.mon}</span>
            <span style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1, fontWeight: 700 }}>{p.dayNum || '--'}</span>
          </div>
          <div className="flex flex-1 flex-col items-start justify-center pl-3" style={{ borderLeft: `1px solid ${a}` }}>
            <span style={{ fontSize: 10, letterSpacing: 1.2, fontWeight: 800 }}>{p.time || 'Time TBA'}</span>
          </div>
        </div>
        <div className="mt-auto w-full text-center">
          {p.street && <p className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: ink }}>{p.street}</p>}
          {p.rest && <p className="truncate" style={{ fontSize: 10.5, color: '#6d756e' }}>{p.rest}</p>}
          <div className="mt-2.5"><Host d={d} color={leaf} sub="#7d857e" /></div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Midnight - dark, metallic

function Midnight({ d, p, shine }: { d: InviteCardData; p: P; shine: boolean }) {
  const a = p.accent
  const metal = `linear-gradient(120deg, ${mix(a, '#ffffff', 0.55)} 0%, ${a} 45%, ${mix(a, '#000000', 0.2)} 70%, ${mix(a, '#ffffff', 0.4)} 100%)`
  const corner = (pos: React.CSSProperties, rot: number) => (
    <span className="absolute" style={{ ...pos, width: 26, height: 26, borderTop: `1.5px solid ${a}`, borderLeft: `1.5px solid ${a}`, transform: `rotate(${rot}deg)` }} />
  )
  return (
    <div className="absolute inset-0" style={{ background: '#0e1118' }}>
      {p.cover && (
        <div className="absolute inset-x-0 top-0" style={{ height: 230 }}>
          <img src={p.cover} alt="" className="h-full w-full object-cover" style={{ opacity: 0.85 }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,13,18,.15) 0%, rgba(14,17,24,.6) 55%, #0e1118 90%, #0e1118 100%)' }} />
        </div>
      )}
      {corner({ left: 12, top: 12 }, 0)}{corner({ right: 12, top: 12 }, 90)}{corner({ right: 12, bottom: 12 }, 180)}{corner({ left: 12, bottom: 12 }, 270)}
      <div className="absolute inset-0 flex flex-col items-center px-9 pb-8" style={{ paddingTop: p.cover ? 176 : 70 }}>
        {!p.cover && <div className="mb-6"><Monogram name={d.hostName} accent={a} size={92} dark /></div>}
        <p className={shine ? 'ic-metal-text' : ''} style={{ fontSize: 10, letterSpacing: 4.5, fontWeight: 800, textTransform: 'uppercase', backgroundImage: metal, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', backgroundSize: '200% 100%' }}>{p.eyebrow}</p>
        <div className="mt-2 w-full"><Title text={d.title} size={29} color="#f6f1e7" /></div>
        <span className="my-3.5" style={{ height: 1.5, width: 90, backgroundImage: metal }} />
        <p style={{ fontSize: 10, letterSpacing: 3, fontWeight: 800, color: '#a8a296', textTransform: 'uppercase' }}>{p.weekday}</p>
        <p style={{ fontFamily: SERIF, fontSize: 26, color: mix(a, '#ffffff', 0.3), lineHeight: 1.2 }}>{p.monthDay}</p>
        {p.time && <p style={{ fontSize: 12.5, fontWeight: 700, color: '#e9e4da', marginTop: 2 }}>{p.time}</p>}
        <div className="mt-auto w-full text-center">
          {p.street && <p className="truncate" style={{ fontSize: 11.5, fontWeight: 700, color: '#f2ede3' }}>{p.street}</p>}
          {p.rest && <p className="truncate" style={{ fontSize: 10.5, color: '#9a958b' }}>{p.rest}</p>}
          <div className="mt-2.5"><Host d={d} color={mix(a, '#ffffff', 0.25)} sub="#8f8a80" /></div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Modern - big photo, bold type

function Modern({ d, p }: { d: InviteCardData; p: P }) {
  const a = p.accent
  const on = onAccent(a)
  return (
    <div className="absolute inset-0 bg-white">
      <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: 300 }}>
        {p.cover ? <img src={p.cover} alt="" className="h-full w-full object-cover" /> : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${a} 0%, ${mix(a, '#000000', 0.35)} 100%)` }}>
            <svg viewBox="0 0 360 300" className="h-full w-full opacity-20" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => <circle key={i} cx={300} cy={40} r={30 + i * 34} fill="none" stroke="#fff" strokeWidth="1" />)}
            </svg>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 28%, rgba(0,0,0,.5) 60%, rgba(0,0,0,.86) 100%)' }} />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
          <p style={{ fontSize: 10, letterSpacing: 3.5, fontWeight: 800, color: mix(a, '#ffffff', 0.55), textTransform: 'uppercase' }}>{p.eyebrow}</p>
          <h1 style={{ fontSize: d.title.length > 34 ? 25 : 31, lineHeight: 1.02, fontWeight: 900, color: '#ffffff', letterSpacing: -0.8, marginTop: 4,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{d.title || 'Your event'}</h1>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col px-6 pb-6" style={{ top: 300 }}>
        <div className="mt-5 flex items-center gap-4">
          <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl" style={{ width: 74, height: 80, background: a, color: on }}>
            <span style={{ fontSize: 11, letterSpacing: 2.5, fontWeight: 800 }}>{p.mon || 'DATE'}</span>
            <span style={{ fontSize: 34, lineHeight: 1, fontWeight: 900, letterSpacing: -1 }}>{p.dayNum || '--'}</span>
          </div>
          <div className="min-w-0">
            <p style={{ fontSize: 15, fontWeight: 900, color: '#111827' }}>{p.weekday}</p>
            {p.time && <p style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{p.time}</p>}
            {p.street && <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginTop: 2 }}>{p.street}{p.rest ? `, ${p.rest}` : ''}</p>}
          </div>
        </div>
        <div className="mt-auto flex items-center gap-2.5 border-t pt-3" style={{ borderColor: '#eef0f3' }}>
          {d.hostPhoto ? <img src={resolveMediaUrl(d.hostPhoto)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-black" style={{ background: a, color: on }}>{initialsOf(d.hostName)}</span>}
          <div className="min-w-0">
            <p className="truncate" style={{ fontSize: 11.5, fontWeight: 800, color: '#111827' }}>{d.hostName ? `Hosted by ${d.hostName}` : 'Your host'}</p>
            {d.hostBrokerage && <p className="truncate" style={{ fontSize: 10.5, color: '#6b7280' }}>{d.hostBrokerage}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

const CARD_CSS = `
.ic-foil{background-size:200% 100% !important}
.ic-metal-text{animation:icMetal 5s ease-in-out infinite}
@keyframes icMetal{0%,100%{background-position:0% 0}50%{background-position:100% 0}}
@media (prefers-reduced-motion:reduce){.ic-metal-text{animation:none}}
`
