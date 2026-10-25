'use client'

import { useEffect, useRef, useState } from 'react'
import { Apple, CalendarDays, CalendarPlus, ChevronDown, Contact, Mail, MessageSquare, Phone } from 'lucide-react'
import { useIsPhone } from '@/components/ui/windowMotion'
import { downloadAgentVcard, downloadOpenHouseIcs, googleCalendarUrl, telHref } from './actions'
import { openLeadForm, fmtDay, fmtMoney, fmtTimeRange, type PropertySiteAgent, type PropertySiteOpenHouse, type SpotlightModel } from './model'
import { TONE, type Tone } from './tone'
import SpotSheet from './SpotSheet'

// ---------- Add to calendar ----------

// Apple Calendar (an .ics the iPhone / Mac opens straight into Calendar), Google Calendar and
// Outlook - offered everywhere an open house can be saved (user, 10/24). A small menu on a
// computer; on a phone the three choices slide up from the bottom (drag down to close).
export function AddToCalendar({
  openHouse, address, fullAddress, url, agentName, tone, className = '', compact = false, sheetTone, align = 'left',
}: {
  openHouse: PropertySiteOpenHouse
  address: string
  fullAddress: string
  url: string
  agentName?: string
  tone: Tone
  className?: string
  /** A small round calendar button (the open-house rows under the header). */
  compact?: boolean
  /** The phone sheet's look when it differs from the button's (Editorial's dark band -> paper sheet). */
  sheetTone?: Tone
  align?: 'left' | 'right'
}) {
  const t = TONE[tone]
  const phone = useIsPhone()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || phone) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open, phone])

  const details = {
    title: `Open House: ${address}`,
    location: fullAddress,
    description: `Open house${agentName ? ` hosted by ${agentName}` : ''}. Full listing, photos and details:`,
    url,
  }
  const google = googleCalendarUrl(openHouse, details)
  const when = [fmtDay(openHouse.date), fmtTimeRange(openHouse.start_time, openHouse.end_time)].filter(Boolean).join(' · ')
  const close = () => setOpen(false)
  const ics = () => { downloadOpenHouseIcs(openHouse, details); close() }
  const st = sheetTone || tone
  const s = TONE[st]

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      {compact ? (
        <button
          type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={`Add ${when} to your calendar`}
          className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-3 text-[11px] font-semibold transition sm:px-3.5 ${t.ghostBtn}`}
        >
          <CalendarPlus className="h-4 w-4" /><span className="hidden min-[400px]:inline">Add</span>
        </button>
      ) : (
        <button
          type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu"
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition ${t.ghostBtn}`}
        >
          <CalendarPlus className="h-3.5 w-3.5" /> Add to calendar <ChevronDown className={`h-3 w-3 transition ${open && !phone ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && !phone && (
        <div role="menu" className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-30 mt-2 w-56 overflow-hidden p-1.5 ${t.menu}`}>
          <button role="menuitem" type="button" onClick={ics} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm ${t.menuItem}`}>
            <Apple className="h-4 w-4 opacity-70" /> Apple Calendar
          </button>
          {google && (
            <a role="menuitem" href={google} target="_blank" rel="noreferrer" onClick={close} className={`flex items-center gap-2.5 px-3 py-2.5 text-sm ${t.menuItem}`}>
              <CalendarDays className="h-4 w-4 opacity-70" /> Google Calendar
            </a>
          )}
          <button role="menuitem" type="button" onClick={ics} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm ${t.menuItem}`}>
            <Mail className="h-4 w-4 opacity-70" /> Outlook / other (.ics)
          </button>
        </div>
      )}
      {phone && (
        <SpotSheet open={open} onClose={close} tone={st} kicker="Add to your calendar" title={fmtDay(openHouse.date) || 'Open house'}>
          {fmtTimeRange(openHouse.start_time, openHouse.end_time) && (
            <p className={`-mt-2 text-sm ${s.muted}`}>{fmtTimeRange(openHouse.start_time, openHouse.end_time)} · {address}</p>
          )}
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={ics} className={`flex items-center gap-3 px-4 py-3.5 text-left text-[15px] font-semibold ${s.chip}`}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#ff5f6d] to-[#ff9966] text-white"><Apple className="h-4 w-4" /></span> Apple Calendar
            </button>
            {google && (
              <a href={google} target="_blank" rel="noreferrer" onClick={close} className={`flex items-center gap-3 px-4 py-3.5 text-[15px] font-semibold ${s.chip}`}>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#1a73e8] ring-1 ring-black/10"><CalendarDays className="h-4 w-4" /></span> Google Calendar
              </a>
            )}
            <button type="button" onClick={ics} className={`flex items-center gap-3 px-4 py-3.5 text-left text-[15px] font-semibold ${s.chip}`}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0a64ad] text-white"><Mail className="h-4 w-4" /></span> Outlook / other
            </button>
          </div>
        </SpotSheet>
      )}
    </div>
  )
}

// ---------- Agent contact actions ----------

export function AgentActions({
  agent, address, url, tone, className = '', siteId,
}: {
  agent: PropertySiteAgent
  address: string
  url: string
  tone: Tone
  className?: string
  /** The live Spotlight's id: Save contact then comes from the server with the agent's photo in it. */
  siteId?: string
}) {
  const t = TONE[tone]
  const btn = `inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition ${t.ghostBtn}`
  // A plain link to the server-built card (user, 10/24: the contact came without the agent's
  // photo) - a phone opens it straight into "Create New Contact". The editor's previews and the
  // sample page build a simple card here instead.
  const live = !!siteId && siteId !== 'preview'
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {agent.phone && <a href={telHref(agent.phone)} className={btn}><Phone className="h-3.5 w-3.5" /> Call</a>}
      {(agent.text_phone || agent.phone) && <a href={telHref(agent.text_phone || agent.phone || '', 'sms')} className={btn}><MessageSquare className="h-3.5 w-3.5" /> Text</a>}
      {agent.email && <a href={`mailto:${agent.email}?subject=${encodeURIComponent(address)}`} className={btn}><Mail className="h-3.5 w-3.5" /> Email</a>}
      {(agent.phone || agent.email) && (live ? (
        <a href={`/api/website-property-sites/${encodeURIComponent(siteId!)}/vcard`} className={btn}
          onClick={e => { if (window.location.pathname.startsWith('/spotlight-preview')) { e.preventDefault(); downloadAgentVcard(agent, { address, url }) } }}>
          <Contact className="h-3.5 w-3.5" /> Save contact
        </a>
      ) : (
        <button type="button" onClick={() => downloadAgentVcard(agent, { address, url })} className={btn}>
          <Contact className="h-3.5 w-3.5" /> Save contact
        </button>
      ))}
    </div>
  )
}

// ---------- Mobile sticky action bar ----------

// Phones get a persistent Call / Tour bar once the hero scrolls away - the two things a buyer on
// a phone actually wants - and it steps aside while the contact form itself is on screen.
export function MobileActionBar({ agent, price, tone, allowTour }: { agent?: PropertySiteAgent; price?: number | null; tone: Tone; allowTour: boolean }) {
  const t = TONE[tone]
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    let contactInView = false
    const update = () => setVisible(window.scrollY > window.innerHeight * 0.8 && !contactInView)
    const contact = document.getElementById('contact')
    const io = contact ? new IntersectionObserver(([entry]) => { contactInView = entry.isIntersecting; update() }, { threshold: 0.15 }) : null
    if (contact && io) io.observe(contact)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => { window.removeEventListener('scroll', update); io?.disconnect() }
  }, [])

  // Solid (user, 10/18: the page's words showed through it - its '/92' see-through colour was never
  // actually generated, so the bar had no background at all).
  const bar = tone === 'dark'
    ? 'border-t border-white/10 bg-[#0b0b0b] text-white shadow-[0_-12px_30px_-12px_rgba(0,0,0,.8)]'
    : 'border-t border-[#172522]/15 bg-[#f3efe6] text-[#172522] shadow-[0_-12px_30px_-14px_rgba(23,37,34,.35)]'
  const icon = `inline-flex h-10 w-10 shrink-0 items-center justify-center ${t.ghostBtn}`
  const textTo = agent?.text_phone || agent?.phone
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[80] transition-transform duration-500 lg:hidden ${bar} ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5 min-[400px]:gap-2 min-[400px]:px-4">
        <div className="min-w-0 flex-1">
          {fmtMoney(price) && <p className="truncate text-base font-semibold leading-tight tabular-nums">{fmtMoney(price)}</p>}
          {agent?.name && <p className={`truncate text-[11px] ${t.muted}`}>{agent.name}</p>}
        </div>
        {/* Call · Text · Email - whichever the agent has */}
        {agent?.phone && (
          <a href={telHref(agent.phone)} className={icon} aria-label={`Call ${agent.name}`} tabIndex={visible ? 0 : -1}>
            <Phone className="h-4 w-4" />
          </a>
        )}
        {textTo && (
          <a href={telHref(textTo, 'sms')} className={icon} aria-label={`Text ${agent?.name || 'the agent'}`} tabIndex={visible ? 0 : -1}>
            <MessageSquare className="h-4 w-4" />
          </a>
        )}
        {agent?.email && (
          <a href={`mailto:${agent.email}`} className={icon} aria-label={`Email ${agent.name}`} tabIndex={visible ? 0 : -1}>
            <Mail className="h-4 w-4" />
          </a>
        )}
        <button
          type="button" onClick={() => openLeadForm(allowTour ? 'tour' : 'info')} tabIndex={visible ? 0 : -1}
          className={`inline-flex h-10 shrink-0 items-center justify-center px-3.5 text-[13px] font-semibold min-[400px]:px-4 ${t.primaryBtn}`}
        >
          {allowTour ? 'Book a tour' : 'Contact'}
        </button>
      </div>
    </div>
  )
}

// ---------- structured data ----------

// schema.org markup so search engines understand this page is one specific home for sale (and
// list its open houses as events). Real fields only.
export function SpotlightJsonLd({ m, url }: { m: SpotlightModel; url: string }) {
  const p = m.p
  const address = {
    '@type': 'PostalAddress', streetAddress: p.address, addressLocality: p.city || undefined,
    addressRegion: p.state || undefined, postalCode: p.zipcode || undefined, addressCountry: 'US',
  }
  const listing: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: m.fullAddress,
    url,
    image: m.photos.slice(0, 6),
    description: m.description ? m.description.slice(0, 500) : undefined,
    datePosted: p.listed_at || undefined,
    about: {
      '@type': 'SingleFamilyResidence',
      address,
      numberOfBedrooms: p.beds ?? undefined,
      numberOfBathroomsTotal: p.baths ?? undefined,
      floorSize: p.sqft ? { '@type': 'QuantitativeValue', value: p.sqft, unitCode: 'FTK' } : undefined,
      yearBuilt: p.year_built ?? undefined,
      ...(m.hasCoords ? { geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } } : {}),
    },
    ...(p.price && m.status?.forSale !== false ? {
      offers: { '@type': 'Offer', price: p.price, priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    } : {}),
    ...(m.agent ? {
      provider: {
        '@type': 'RealEstateAgent', name: m.agent.name, telephone: m.agent.phone || undefined,
        email: m.agent.email || undefined, image: m.agent.photo_url || undefined,
        ...(m.agent.brokerage ? { parentOrganization: { '@type': 'Organization', name: m.agent.brokerage } } : {}),
      },
    } : {}),
  }
  const events = m.has.openHouses ? m.openHouses.map(oh => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `Open House: ${p.address}`,
    startDate: oh.start_time ? `${oh.date}T${oh.start_time}` : oh.date,
    endDate: oh.end_time ? `${oh.date}T${oh.end_time}` : undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: p.address, address },
    image: m.photos.slice(0, 1),
    url,
  })) : []
  const json = JSON.stringify([listing, ...events]).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
