'use client'

import { motion } from 'framer-motion'
import HomeAreaMap from '@/components/maps/HomeAreaMap'

// The Open House Cheat Sheet as a web page - the same content as the printed sheet (both built by
// lib/cheatSheetContent.ts from the open house's saved Cheat Sheet, so an edit to the kit shows up
// here too), laid out for a phone: the home up top, its key facts, the guide, what's nearby, the
// printed QR codes as one-tap buttons, and the host at the bottom.
import {
  ArrowLeft, ArrowUpRight, Bath, Bed, Building2, Calendar, CalendarCheck, DollarSign, Droplet, Flame, GraduationCap, House,
  Hospital, LandPlot, Mail, MapPin, Phone, Plane, Ruler, ScanSearch, School, ShoppingBasket, Snowflake, SquareCheck, Trees, UserRound, Waves,
} from 'lucide-react'
import { buildCheatSheetContent, cityFromAddress, tidyAllCaps, type AmenityPlace, type CheatSheetFact, type CheatSheetIcon } from '@/lib/cheatSheetContent'
import { Avatar } from './GuestPass'
import { GuestPassData, RequestKind, RequestState, cityLine, formatPhone, img, streetOf } from './shared'

const ICON: Record<CheatSheetIcon, any> = {
  bed: Bed, bath: Bath, ruler: Ruler, calendar: Calendar, landPlot: LandPlot, droplet: Droplet, waves: Waves,
  dollar: DollarSign, snowflake: Snowflake, gradCap: GraduationCap, flame: Flame, house: House, squareCheck: SquareCheck,
}

const card = 'rounded-[24px] border border-black/[0.06] bg-white shadow-[0_14px_40px_-30px_rgba(0,0,0,0.45)] dark:border-white/[0.07] dark:bg-[#141416]'
const tint = { backgroundColor: 'color-mix(in srgb, var(--gp) 13%, transparent)' }
// Each section has its own quiet accent (user, 10/24 - "tasteful, still professional"): the open
// house's colour for the home itself, blue for schools, the place colours for what's nearby.
const tintOf = (c: string) => ({ backgroundColor: `color-mix(in srgb, ${c} 13%, transparent)`, color: c })
const SCHOOL_BLUE = '#2563EB'
const NEARBY_LOOK: Record<string, { icon: any; color: string }> = {
  'Nearby Private Schools': { icon: School, color: '#2563EB' },
  'Grocery Stores Nearby': { icon: ShoppingBasket, color: '#15803D' },
  'Parks Nearby': { icon: Trees, color: '#0F766E' },
  'Medical Care Nearby': { icon: Hospital, color: '#DC2626' },
  'Airports Nearby': { icon: Plane, color: '#475569' },
  'Nearby Downtown Areas': { icon: Building2, color: '#7C3AED' },
}

// Each block rises in as the guest scrolls to it.
const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
})

function SectionLabel({ children, color = 'var(--gp)' }: { children: React.ReactNode; color?: string }) {
  return (
    <p className="mb-3 mt-9 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em]" style={{ color }}>
      <span className="h-px w-5" style={{ background: color }} />{children}
    </p>
  )
}

export default function CheatSheetView({ data, onRequest, sending, onBack }: {
  data: GuestPassData; onRequest: (k: RequestKind) => void; sending: RequestKind | null; onBack: () => void
}) {
  const { property, amenities } = data.cheat_sheet!
  const agent = data.agent
  const c = buildCheatSheetContent(property, amenities)
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property.address, property.city, property.state].filter(Boolean).join(', '))}`
  const photo = c.coverPhoto?.url || img(data.home.photos?.[0])
  const street = streetOf(property.address || data.home.address)
  const place = [cityLine(property.city || data.home.city, property.state || data.home.state), property.zipcode || data.home.zipcode].filter(Boolean).join(' ')
  const nearby: { title: string; places: AmenityPlace[]; showCity?: boolean }[] = amenities && c.hasAmenities ? [
    { title: 'Nearby Private Schools', places: amenities.private_schools },
    { title: 'Grocery Stores Nearby', places: amenities.grocery_stores, showCity: true },
    { title: 'Parks Nearby', places: amenities.parks, showCity: true },
    { title: 'Medical Care Nearby', places: amenities.medical_care },
    { title: 'Airports Nearby', places: amenities.airports },
    { title: 'Nearby Downtown Areas', places: amenities.downtown_areas },
  ].filter(n => (n.places?.length ?? 0) > 0) : []
  // Every property fact as one even grid of tiles (the short one-liners and the longer ones alike).
  const infoTiles: CheatSheetFact[] = [...c.propertyInfoLine, ...c.propertyInfo]
  // The assigned public schools, one bar each - High, Middle, Elementary (user, 10/24) - then the
  // district / township on its own line under them.
  const assigned = (level: string) => amenities?.schools?.find((s: AmenityPlace) => s.place_type === level)?.name
  const schoolBars = [
    { level: 'High school', name: property.highSchool || assigned('High School') },
    { level: 'Middle school', name: property.middleSchool || assigned('Middle School') },
    { level: 'Elementary school', name: property.elementarySchool || assigned('Elementary School') },
  ].filter(b => !!b.name).map(b => ({ ...b, name: tidyAllCaps(String(b.name)) }))
  const lat = data.home.latitude != null ? Number(data.home.latitude) : property.latitude != null ? Number(property.latitude) : null
  const lng = data.home.longitude != null ? Number(data.home.longitude) : property.longitude != null ? Number(property.longitude) : null

  return (
    <div className="mx-auto max-w-4xl px-4 pb-4 pt-5 sm:pt-8">
      <button
        type="button"
        onClick={onBack}
        className="group -ml-1 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-gray-700 transition-colors hover:text-[var(--gp)] dark:text-gray-200"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back
      </button>

      {/* The home */}
      <motion.div {...rise()} className="relative mt-3 overflow-hidden rounded-[30px] bg-[#0B0B0B] p-5 pb-9 text-white shadow-[0_30px_70px_-34px_rgba(0,0,0,0.7)] ring-1 ring-white/10 sm:p-7 sm:pb-11">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: 'var(--gp)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-60 w-60 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--gp)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80" style={{ background: 'linear-gradient(90deg, transparent, var(--gp), transparent)' }} />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--gp)]">Open House Guide</span>
          {agent.brokerage && <span className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-white/35">· {agent.brokerage}</span>}
        </div>
        <div className="relative mt-4 flex items-center gap-4">
          <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-2xl bg-white/10 ring-2 ring-white/15 sm:h-24 sm:w-24">
            {photo
              ? <img src={photo} alt={c.heroAddress} className="h-full w-full object-cover" style={c.coverPhoto ? { objectPosition: `${c.coverPhoto.x ?? 50}% ${c.coverPhoto.y ?? 50}%` } : undefined} />
              : <span className="flex h-full w-full items-center justify-center text-[var(--gp)]"><House className="h-8 w-8" /></span>}
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] font-black leading-[1.08] tracking-[-0.02em] sm:text-4xl">{street}</h1>
            {place && <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-white/60"><MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--gp)]" />{place}</p>}
          </div>
        </div>
        <div className="relative mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">Price</p>
            <p className="text-3xl font-black leading-none tracking-tight sm:text-4xl">{c.priceText}</p>
          </div>
          <a href={mapsLink} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-[#0B0B0B]">
            Map <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </motion.div>

      {/* Key facts, tucked under the home card */}
      <motion.div {...rise(0.05)} className={`${card} relative mx-3 -mt-5 grid grid-cols-5 divide-x divide-black/[0.06] px-1 py-3.5 dark:divide-white/[0.07] sm:mx-6`}>
        {c.basicInfo.map(f => {
          const Icon = ICON[f.icon]
          return (
            <div key={f.label} className="flex min-w-0 flex-col items-center px-1 text-center">
              <Icon className="h-4 w-4 text-[var(--gp)]" />
              <span className="mt-1 truncate text-[15px] font-black leading-tight">{f.value}</span>
              <span className="truncate text-[8px] font-black uppercase tracking-wider text-gray-400">{f.label}</span>
            </div>
          )
        })}
      </motion.div>

      {(c.highlights || c.descriptionText) && (
        <motion.p {...rise()} className="mt-7 text-[15px] font-medium leading-relaxed text-gray-700 dark:text-gray-300">
          {c.highlights
            ? <><span className="font-black text-[#0B0B0B] dark:text-white">{c.highlights.prefix}</span>{c.highlights.body}</>
            : c.descriptionText}
        </motion.p>
      )}

      {/* Property info - one even grid, every tile laid out (and centered) the same */}
      <SectionLabel>Property Info</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {infoTiles.map((f, i) => {
          const Icon = ICON[f.icon]
          return (
            <motion.div key={f.label} {...rise(Math.min(i * 0.03, 0.2))} className={`${card} flex flex-col items-center justify-center gap-1.5 p-4 text-center ${f.wide ? 'col-span-2 sm:col-span-3' : ''}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--gp)]" style={tint}><Icon className="h-4 w-4" /></span>
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">{f.label}</span>
              <span className="text-[13px] font-bold leading-snug">{f.value}</span>
            </motion.div>
          )
        })}
      </div>

      {(schoolBars.length > 0 || c.hasSchoolTownship) && (
        <>
          <SectionLabel color={SCHOOL_BLUE}>Schools</SectionLabel>
          <div className="space-y-2">
            {schoolBars.map((b, i) => <SchoolTile key={b.level} label={b.level} value={b.name} delay={i * 0.05} />)}
          </div>
          {c.hasSchoolTownship && (
            <p className="mt-3 flex items-start gap-2 px-1 text-[12.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: SCHOOL_BLUE }} />
              <span><span className="font-black text-[#0B0B0B] dark:text-white">School district / township: </span>{c.cleanedSchoolTownship}</span>
            </p>
          )}
          {schoolBars.length > 0 && (
            <p className="mt-2 px-1 text-[11px] font-medium text-gray-400">School assignments are based on available attendance-boundary data and should be verified with the local school district.</p>
          )}
        </>
      )}

      {nearby.length > 0 && (
        <>
          <SectionLabel>What&apos;s Nearby</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {nearby.map((n, i) => {
              const look = NEARBY_LOOK[n.title] || { icon: MapPin, color: 'var(--gp)' }
              return (
              <motion.div key={n.title} {...rise(Math.min(i * 0.04, 0.2))} className={`${card} p-4`}>
                <p className="flex items-center gap-2 text-xs font-black">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={tintOf(look.color)}><look.icon className="h-3.5 w-3.5" /></span>
                  {n.title}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {n.places.slice(0, c.amenityItemCap).map((pl, k) => (
                    <li key={`${pl.name}-${k}`} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        {pl.place_type && <span className="block text-[9px] font-black uppercase tracking-wider" style={{ color: look.color }}>{pl.place_type}</span>}
                        <span className="block truncate text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                          {n.showCity && cityFromAddress(pl.address) ? `${pl.name} - ${cityFromAddress(pl.address)}` : pl.name}
                        </span>
                      </span>
                      {pl.distance_miles != null && <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-black text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">{pl.distance_miles} mi</span>}
                    </li>
                  ))}
                </ul>
              </motion.div>
              )
            })}
          </div>
        </>
      )}

      {/* The map - tall and live (pan, zoom, the township / school district lines), not a picture. */}
      {lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && (
        <>
          <SectionLabel color="#0F766E">On the map</SectionLabel>
          <motion.div {...rise()} className="overflow-hidden rounded-[24px] border border-black/[0.06] shadow-[0_18px_50px_-30px_rgba(0,0,0,0.4)] dark:border-white/[0.07]">
            <HomeAreaMap latitude={lat} longitude={lng} address={c.heroAddress} accent={data.theme?.accentColor || '#C9A24D'} dark={!!data.theme?.darkMode}
              className="h-[440px] w-full sm:h-[520px]" rounded="" />
          </motion.div>
          <a href={mapsLink} target="_blank" rel="noopener" className="mt-2.5 inline-flex items-center gap-1 px-1 text-[10px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-[var(--gp)]">
            Open in Google Maps <ArrowUpRight className="h-3 w-3" />
          </a>
        </>
      )}

      {/* The printed sheet's bottom row: Documents QR / map / Visit Again QR - as one-tap buttons */}
      <SectionLabel color="#B45309">One Tap</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        <ActionCard eyebrow="Documents" title="Request Seller Disclosure" icon={ScanSearch}
          sending={sending === 'disclosure'} sent={data.requested.disclosure} onClick={() => onRequest('disclosure')}
          sentText={`Requested - ${agent.first_name} will send it`} idle="Tap to get the disclosure + property docs" />
        <ActionCard eyebrow="Visit Again" title="Schedule a Second Visit" icon={CalendarCheck}
          sending={sending === 'second_visit'} sent={data.requested.second_visit} onClick={() => onRequest('second_visit')}
          sentText={`Requested - ${agent.first_name} will reach out`} idle="Tap to request another showing" />
      </div>

      {/* The host, at the bottom */}
      <SectionLabel>Your Host</SectionLabel>
      <motion.div {...rise()} className={`${card} p-5`}>
        <div className="flex items-center gap-4">
          <Avatar agent={agent} size={58} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black leading-tight">{agent.name}</p>
            {(agent.title || agent.brokerage) && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{[agent.title, agent.brokerage].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {agent.phone && (
            <a href={`tel:${String(agent.phone).replace(/[^\d+]/g, '')}`} className="flex flex-col items-center gap-1 rounded-2xl border border-black/[0.08] py-3 text-[10px] font-black uppercase tracking-wider transition-colors hover:border-[var(--gp)] hover:text-[var(--gp)] dark:border-white/[0.1]">
              <Phone className="h-4 w-4 text-[var(--gp)]" /> Call
            </a>
          )}
          {agent.email && (
            <a href={`mailto:${agent.email}`} className="flex flex-col items-center gap-1 rounded-2xl border border-black/[0.08] py-3 text-[10px] font-black uppercase tracking-wider transition-colors hover:border-[var(--gp)] hover:text-[var(--gp)] dark:border-white/[0.1]">
              <Mail className="h-4 w-4 text-[var(--gp)]" /> Email
            </a>
          )}
          {agent.hub_url && (
            <a href={agent.hub_url} target="_blank" rel="noopener" className="flex flex-col items-center gap-1 rounded-2xl border border-black/[0.08] py-3 text-[10px] font-black uppercase tracking-wider transition-colors hover:border-[var(--gp)] hover:text-[var(--gp)] dark:border-white/[0.1]">
              <UserRound className="h-4 w-4 text-[var(--gp)]" /> Agent Hub
            </a>
          )}
        </div>
        {(agent.phone || agent.email) && (
          <p className="mt-3 truncate text-center text-[11px] font-semibold text-gray-400">{[formatPhone(agent.phone), agent.email].filter(Boolean).join('  ·  ')}</p>
        )}
      </motion.div>
    </div>
  )
}

function SchoolTile({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  return (
    <motion.div {...rise(delay)} className={`${card} flex items-center gap-3 px-4 py-3.5`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={tintOf(SCHOOL_BLUE)}>
        <GraduationCap className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: SCHOOL_BLUE }}>{label}</p>
        <p className="mt-0.5 truncate text-[14px] font-bold leading-snug">{value}</p>
      </div>
    </motion.div>
  )
}

function ActionCard({ eyebrow, title, icon: Icon, sending, sent, onClick, sentText, idle }: {
  eyebrow: string; title: string; icon: any; sending: boolean; sent: boolean; onClick: () => void; sentText: string; idle: string
}) {
  return (
    <motion.button type="button" onClick={onClick} disabled={sent || sending} whileTap={{ scale: 0.97 }}
      className={`${card} flex flex-col items-center p-4 text-center transition-[border-color,transform] duration-300 ${sent ? 'border-emerald-500/30' : 'hover:-translate-y-0.5 hover:border-[var(--gp)]'}`}>
      <span className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-400">{eyebrow}</span>
      <span className="my-3 flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--gp)]" style={tint}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="text-sm font-black leading-tight">{title}</span>
      <span className="mt-1 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">
        <RequestState sending={sending} sent={sent} sentText={sentText} idle={idle} />
      </span>
    </motion.button>
  )
}
