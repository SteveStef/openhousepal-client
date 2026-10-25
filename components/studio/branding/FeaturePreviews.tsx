'use client'

// Branding center - a small, live picture of each feature painted in the agent's brand look
// (Studio -> Branding). Pure drawings at a fixed size, scaled into whatever box they sit in, so a
// color change repaints every one of them at once (colors ease over - see .bc-tint in
// BrandingCenter). The Studio design tile is the real design renderer in its "Brand" theme.
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, Mail, MapPin, Phone as PhoneIcon, Search } from 'lucide-react'
import type { BrandKit } from '@/types'
import type { BrandLook } from '@/lib/brandKit'
import { LUXE_METALS } from '@/lib/luxeMetals'
import { formPaint } from '@/lib/formLook'
import { resolveMediaUrl } from '@/lib/api-service'
import { BrandLookPreview } from '@/components/studio/BrandLookPicker'
import InviteCard from '@/components/invites/InviteCard'
import { DesignPreview } from '@/components/studio/design/StyleThumbnail'
import { getDesignFormat, PLACEHOLDER_PROPERTY } from '@/lib/studio/designFormats'
import { getTemplatesFor } from '@/lib/studio/designTemplates'
import type { DesignAgentInfo } from '@/lib/studio/designAgent'

export type FeatureId = 'hub' | 'idx' | 'forms' | 'signature' | 'invites' | 'spotlight' | 'designs'
export type Person = { name: string; title: string; brokerage: string; photo: string | null; phone: string; email: string }

const PHOTO = PLACEHOLDER_PROPERTY.photos![0]
const PHOTO2 = PLACEHOLDER_PROPERTY.photos![1]
const PHOTO3 = PLACEHOLDER_PROPERTY.photos![3]

/** The colors one look paints with - the same rules the real features use (lib/formLook). */
export function paintOf(look: BrandLook) {
  const luxe = look.theme === 'luxe'
  const m = LUXE_METALS[look.metal]
  const p = formPaint({ theme: luxe ? 'luxe' : 'classic', accent: look.accent, metal: look.metal, dark: look.dark })
  const dark = look.dark
  return {
    luxe, dark, m,
    /** the brand color as one flat tone (Luxe: the metal) */
    color: luxe ? m.base : look.accent,
    fill: p.fill, fillInk: p.ink, text: p.text, rgb: p.rgb,
    page: luxe
      ? (dark ? `radial-gradient(120% 80% at 90% -10%, rgba(${m.rgb},.30), transparent 60%), linear-gradient(180deg,#0c0c0e,#141318)` : `radial-gradient(120% 80% at 90% -10%, rgba(${m.rgb},.24), transparent 60%), linear-gradient(180deg,#fffdf8,#f6efe1)`)
      : (dark ? '#0B0B0B' : '#FAFAF7'),
    ink: dark ? '#FFFFFF' : '#111827',
    sub: dark ? 'rgba(255,255,255,.58)' : 'rgba(17,24,39,.52)',
    line: dark ? 'rgba(255,255,255,.10)' : 'rgba(17,24,39,.08)',
    card: dark ? 'rgba(255,255,255,.05)' : '#FFFFFF',
    tint: luxe ? `rgba(${m.rgb},.14)` : `rgba(${p.rgb},.12)`,
    serif: luxe ? 'var(--font-serif, Georgia, serif)' : undefined,
  }
}

/** Scales a fixed-size drawing to fit its box, centred. */
export function FitStage({ w, h, children, pad = 0.9 }: { w: number; h: number; children: React.ReactNode; pad?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [s, setS] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width && height) setS(Math.min(width / w, height / h) * pad)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h, pad])
  return (
    <div ref={ref} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div style={{ width: w, height: h, transform: `scale(${s})`, opacity: s ? 1 : 0, transition: 'opacity .3s ease', flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function Phone({ children, w = 150, h = 290 }: { children: React.ReactNode; w?: number; h?: number }) {
  return (
    <div style={{ width: w, height: h }} className="relative rounded-[26px] bg-[#111827] p-[5px] shadow-[0_24px_50px_-20px_rgba(0,0,0,.55)] ring-1 ring-black/40">
      <div className="absolute left-1/2 top-[7px] z-10 h-[14px] w-[48px] -translate-x-1/2 rounded-full bg-[#111827]" />
      <div className="relative h-full w-full overflow-hidden rounded-[21px]">{children}</div>
    </div>
  )
}

function Avatar({ person, size, ring }: { person: Person; size: number; ring: string }) {
  return (
    <span className="block shrink-0 rounded-full p-[2px]" style={{ width: size, height: size, background: ring }}>
      <span className="block h-full w-full rounded-full bg-cover bg-center" style={{ backgroundColor: '#d9d4ca', backgroundImage: person.photo ? `url(${resolveMediaUrl(person.photo)})` : undefined }}>
        {!person.photo && <span className="flex h-full w-full items-center justify-center text-[9px] font-black text-white/80">{person.name.split(' ').map(s => s[0]).join('').slice(0, 2)}</span>}
      </span>
    </span>
  )
}

// ---------- Agent Hub ----------
function HubMock({ look, person }: { look: BrandLook; person: Person }) {
  const p = paintOf(look)
  return (
    <Phone>
      <div className="h-full pt-5" style={{ background: p.page }}>
        <div className="-mt-5 h-full [&>div]:rounded-none [&>div]:border-0">
          <BrandLookPreview look={look} compact name={person.name} photoUrl={person.photo ? resolveMediaUrl(person.photo) : null} />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-2.5 pb-3">
        <p className="mb-1 text-[6.5px] font-black uppercase tracking-[0.18em]" style={{ color: p.text }}>Recent sales</p>
        <div className="flex gap-1">
          {[PHOTO, PHOTO2].map(src => (
            <div key={src} className="relative h-12 flex-1 overflow-hidden rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${src})` }}>
              <span className="absolute bottom-0.5 left-0.5 rounded px-1 text-[5.5px] font-black" style={{ background: p.fill, color: p.fillInk }}>SOLD</span>
            </div>
          ))}
        </div>
      </div>
    </Phone>
  )
}

// ---------- IDX website ----------
function IdxMock({ look, person }: { look: BrandLook; person: Person }) {
  const p = paintOf(look)
  const slug = (person.name || 'yourname').toLowerCase().replace(/[^a-z]+/g, '')
  return (
    <div style={{ width: 360, height: 236, background: p.page }} className="overflow-hidden rounded-xl shadow-[0_24px_50px_-24px_rgba(0,0,0,.5)] ring-1 ring-black/10">
      <div className="flex items-center gap-1.5 bg-[#ECEAE5] px-2.5 py-1.5 dark:bg-[#ECEAE5]">
        {['#ff5f57', '#febc2e', '#28c840'].map(c => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}
        <span className="ml-2 flex-1 truncate rounded-full bg-white px-2 py-0.5 text-[7px] font-bold text-gray-500">{slug}.openhousepal.com</span>
      </div>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: `1px solid ${p.line}` }}>
        <span className="text-[9px] font-black" style={{ color: p.ink, fontFamily: p.luxe ? 'Georgia, serif' : undefined }}>{person.name}</span>
        <span className="flex items-center gap-2 text-[6.5px] font-bold" style={{ color: p.sub }}>
          <span>Buy</span><span>Sell</span><span>Towns</span>
          <span className="rounded-full px-1.5 py-0.5 font-black" style={{ background: p.fill, color: p.fillInk }}>Contact</span>
        </span>
      </div>
      <div className="relative mx-2.5 mt-2 h-[86px] overflow-hidden rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${PHOTO2})` }}>
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
        <div className="absolute left-3 top-3">
          <p className="text-[6px] font-black uppercase tracking-[0.2em]" style={{ color: p.luxe ? p.m.light : '#fff' }}>Main Line homes</p>
          <p className="mt-0.5 text-[14px] font-black leading-tight text-white" style={{ fontFamily: 'Georgia, serif' }}>Find your next home</p>
          <div className="mt-1.5 flex w-[170px] items-center gap-1 rounded-full bg-white py-0.5 pl-2 pr-0.5">
            <Search className="h-2 w-2 text-gray-400" /><span className="flex-1 text-[6px] font-semibold text-gray-400">Town, ZIP or address</span>
            <span className="rounded-full px-1.5 py-0.5 text-[6px] font-black" style={{ background: p.fill, color: p.fillInk }}>Search</span>
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 px-2.5">
        {[PHOTO, PHOTO3, PHOTO2].map((src, i) => (
          <div key={i} className="overflow-hidden rounded-md" style={{ background: p.card, border: `1px solid ${p.line}` }}>
            <div className="h-9 bg-cover bg-center" style={{ backgroundImage: `url(${src})` }} />
            <div className="px-1 py-0.5">
              <p className="text-[7px] font-black" style={{ color: p.text }}>${['1,295,000', '849,000', '2,150,000'][i]}</p>
              <p className="text-[5px] font-semibold" style={{ color: p.sub }}>4 bd · 3 ba</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Forms ----------
function FormMock({ look }: { look: BrandLook }) {
  const p = paintOf(look)
  return (
    <Phone>
      <div className="flex h-full flex-col px-3 pb-4 pt-8" style={{ background: p.page }}>
        <div className="flex gap-1">{[1, 1, 0, 0].map((on, i) => <span key={i} className="h-[3px] flex-1 rounded-full" style={{ background: on ? p.fill : p.line }} />)}</div>
        <p className="mt-4 text-[6.5px] font-black uppercase tracking-[0.2em]" style={{ color: p.text }}>Home value</p>
        <p className="mt-1 text-[13px] font-black leading-tight" style={{ color: p.ink, fontFamily: 'Georgia, serif' }}>When are you thinking of selling?</p>
        <div className="mt-3 space-y-1.5">
          {['In the next 3 months', '3 to 6 months', 'Just curious'].map((o, i) => (
            <div key={o} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[8px] font-bold"
              style={i === 0 ? { border: `1.5px solid ${p.color}`, background: p.tint, color: p.ink } : { border: `1px solid ${p.line}`, background: p.card, color: p.sub }}>
              {o}{i === 0 && <span className="grid h-3 w-3 place-items-center rounded-full" style={{ background: p.fill }}><Check className="h-2 w-2" style={{ color: p.fillInk }} strokeWidth={4} /></span>}
            </div>
          ))}
        </div>
        <div className="mt-auto rounded-full py-1.5 text-center text-[8px] font-black uppercase tracking-wide" style={{ background: p.fill, color: p.fillInk, boxShadow: p.luxe ? `0 8px 16px -8px rgba(${p.m.rgb},.9)` : undefined }}>Next</div>
      </div>
    </Phone>
  )
}

// ---------- Email signature ----------
function SignatureMock({ look, person }: { look: BrandLook; person: Person }) {
  const p = paintOf(look)
  const ring = p.luxe ? `conic-gradient(${p.m.deep}, ${p.m.light}, ${p.m.base}, ${p.m.pale}, ${p.m.deep})` : p.color
  return (
    <div style={{ width: 340, height: 196 }} className="overflow-hidden rounded-xl bg-white shadow-[0_24px_50px_-24px_rgba(0,0,0,.45)] ring-1 ring-black/10">
      <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
        <Mail className="h-3 w-3 text-gray-400" />
        <span className="text-[8px] font-bold text-gray-500">Re: 412 Ridgemont Drive</span>
      </div>
      <div className="space-y-1 px-3 pt-2.5">
        <span className="block h-1.5 w-[86%] rounded-full bg-gray-100" />
        <span className="block h-1.5 w-[72%] rounded-full bg-gray-100" />
        <span className="block h-1.5 w-[40%] rounded-full bg-gray-100" />
      </div>
      {/* the signature itself - Ivory / Midnight like the real one */}
      <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl p-3" style={{ background: p.dark ? (p.luxe ? p.page : '#111113') : (p.luxe ? p.page : '#FFFFFF'), border: `1px solid ${p.line}` }}>
        <Avatar person={person} size={46} ring={ring} />
        <span className="h-12 w-[2px] shrink-0 rounded-full" style={{ background: p.fill }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black leading-tight" style={{ color: p.ink, fontFamily: p.luxe ? 'Georgia, serif' : undefined }}>{person.name}</p>
          <p className="truncate text-[7px] font-black uppercase tracking-[0.14em]" style={{ color: p.text }}>{person.title} · {person.brokerage}</p>
          <p className="mt-1 flex items-center gap-2 text-[7px] font-semibold" style={{ color: p.sub }}><span className="inline-flex items-center gap-0.5"><PhoneIcon className="h-2 w-2" />{person.phone}</span></p>
          <div className="mt-1.5 flex gap-1">
            <span className="rounded-full px-2 py-0.5 text-[6.5px] font-black" style={{ background: p.fill, color: p.fillInk }}>Schedule a showing</span>
            <span className="rounded-full px-2 py-0.5 text-[6.5px] font-black" style={{ background: p.tint, color: p.text, border: `1px solid ${p.color}55` }}>Home value</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Invites ----------
function InviteMock({ look, person }: { look: BrandLook; person: Person }) {
  const p = paintOf(look)
  const date = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
    return d.toISOString().slice(0, 10)
  }, [])
  return (
    <div className="rotate-[-2deg]" style={{ width: 170 }}>
      <InviteCard width={170} shine={false} data={{
        invite_type: 'open_house', title: 'Open House', event_date: date, start_time: '13:00', end_time: '15:00',
        place_name: null, address: '412 Ridgemont Drive, Bryn Mawr, PA', cover_image_url: PHOTO, linked_property: null,
        design: p.dark ? 'midnight' : 'classic', accent_color: p.color, hostName: person.name, hostBrokerage: person.brokerage, hostPhoto: person.photo,
      }} />
    </div>
  )
}

// ---------- Listing Spotlight ----------
function SpotlightMock({ look }: { look: BrandLook }) {
  const p = paintOf(look)
  return (
    <div style={{ width: 360, height: 236 }} className="relative overflow-hidden rounded-xl bg-[#0d0d0f] shadow-[0_24px_50px_-24px_rgba(0,0,0,.6)] ring-1 ring-black/20">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${PHOTO})` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2">
        <span className="text-[7px] font-black uppercase tracking-[0.24em] text-white/80">Spotlight</span>
        <span className="flex gap-2 text-[6.5px] font-bold text-white/70"><span>Photos</span><span>Tour</span><span>Area</span></span>
      </div>
      <div className="absolute bottom-3 left-3 right-3">
        <span className="inline-block rounded-full px-2 py-0.5 text-[6.5px] font-black uppercase tracking-[0.18em]" style={{ background: p.color, color: p.fillInk }}>Just listed</span>
        <p className="mt-1 text-[17px] font-black leading-none text-white" style={{ fontFamily: 'Georgia, serif' }}>412 Ridgemont Drive</p>
        <p className="mt-1 flex items-center gap-1 text-[7px] font-semibold text-white/70"><MapPin className="h-2 w-2" /> Bryn Mawr, PA · 5 bd · 4.5 ba · 5,200 sq ft</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[15px] font-black" style={{ color: p.luxe ? p.m.light : p.color, textShadow: '0 1px 8px rgba(0,0,0,.4)' }}>$3,495,000</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[7px] font-black" style={{ background: p.fill, color: p.fillInk }}><CalendarDays className="h-2 w-2" /> Book a tour</span>
        </div>
      </div>
    </div>
  )
}

// ---------- Studio designs (the real renderer, "Brand" theme) ----------
function DesignMock({ kit, agent }: { kit: BrandKit | null; agent: DesignAgentInfo }) {
  const format = getDesignFormat('instagram_post')
  const template = useMemo(() => getTemplatesFor('just_listed', 'instagram_post')[0], [])
  const blocks = useMemo(() => (template ? template.buildBlocks(PLACEHOLDER_PROPERTY, undefined, {}) : []), [template])
  if (!format || !template) return null
  return (
    <div style={{ width: 230 }} className="overflow-hidden shadow-[0_24px_50px_-20px_rgba(0,0,0,.5)]">
      <DesignPreview rounded={false} blocks={blocks} ctx={{
        format, styleId: 'modern_luxury', colorMode: 'brand', composition: template.composition, layoutHints: template.layoutHints,
        situation: 'just_listed', property: PLACEHOLDER_PROPERTY, ...agent, brandKit: kit, brandingMode: 'personal',
      }} />
    </div>
  )
}

export const PREVIEW_SIZE: Record<FeatureId, [number, number]> = {
  hub: [150, 290], idx: [360, 236], forms: [150, 290], signature: [340, 196], invites: [176, 250], spotlight: [360, 236], designs: [230, 230],
}

export function FeaturePreview({ id, look, kit, person, agent }: { id: FeatureId; look: BrandLook; kit: BrandKit | null; person: Person; agent: DesignAgentInfo }) {
  switch (id) {
    case 'hub': return <HubMock look={look} person={person} />
    case 'idx': return <IdxMock look={look} person={person} />
    case 'forms': return <FormMock look={look} />
    case 'signature': return <SignatureMock look={look} person={person} />
    case 'invites': return <InviteMock look={look} person={person} />
    case 'spotlight': return <SpotlightMock look={look} />
    case 'designs': return <DesignMock kit={kit} agent={agent} />
  }
}


