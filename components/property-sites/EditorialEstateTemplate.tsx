'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Playfair_Display, DM_Mono, Manrope } from 'next/font/google'
import {
  ArrowRight, ArrowUpRight, Box, ChevronDown, Expand, FileText, Menu, Navigation, Play, Share2, X,
} from 'lucide-react'
import ExploreNearby from '@/components/website-public/ExploreNearby'
import MlsDisclaimer from '@/components/property-sites/MlsDisclaimer'
import SpotlightViewBeacon from '@/components/property-sites/SpotlightViewBeacon'
import Lightbox from './spotlight/Lightbox'
import LeadForm from './spotlight/LeadForm'
import SignatureSiteCard from '@/components/studio/blogs/SignatureSiteCard'
import PaymentEstimator from './spotlight/PaymentEstimator'
import ShareSheet from './spotlight/ShareSheet'
import PhotoShow from './spotlight/PhotoShow'
import HeroMedia from './spotlight/HeroMedia'
import GuestTools from './spotlight/GuestTools'
import RoomChapters from './spotlight/RoomChapters'
import OpenHouseChip from './spotlight/OpenHouseChip'
import TownFeature from './spotlight/TownSection'
import PresentedByPill from './spotlight/PresentedByPill'
import { groupSpecs, prettyFeature, splitFeatures } from './spotlight/features'
import { AddToCalendar, AgentActions, MobileActionBar, SpotlightJsonLd } from './spotlight/Widgets'
import {
  buildSpotlight, excerpt, fitLine, fmtCompactMoney, fmtDay, fmtMoney, fmtNumber, fmtPhone, fmtTimeRange, openLeadForm, parseDay,
  scrollToId, type PropertySiteChapter, type PropertySiteResolveResponse, type SpotlightModel,
} from './spotlight/model'
import { onAccent, usableAccent } from './spotlight/tone'
import NearbyMap from '@/components/maps/NearbyMap'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500'], style: ['normal', 'italic'], variable: '--font-ee-display' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ee-mono' })
const manrope = Manrope({ subsets: ['latin'], variable: '--font-ee-sans' })

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

// Decimal degrees -> a "36° 15′ 12″ N" flourish computed from this listing's own real
// coordinates - never a placeholder value.
function toDMS(value: number, pos: string, neg: string): string {
  const abs = Math.abs(value)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = Math.round((minFloat - min) * 60)
  return `${deg}° ${min}′ ${sec}″ ${value >= 0 ? pos : neg}`
}

function street(address: string) { return address.split(',')[0] }

function Reveal({ children, className = '', as: Tag = 'div', id }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'figure'; id?: string }) {
  return <Tag id={id} className={`ee-reveal ${className}`}>{children}</Tag>
}

function Kicker({ n, children }: { n?: string; children: ReactNode }) {
  return (
    <p className="sp-mono flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[color:color-mix(in_srgb,var(--sp-accent)_60%,#172522)]">
      {n && <span className="tabular-nums">{n}</span>}{n && <span className="h-px w-6 bg-current opacity-60" />}{children}
    </p>
  )
}

interface NavItem { id: string; label: string; show: boolean }

// Editorial Estate - the paper-light, magazine-spread Spotlight template: a cover, an index of
// facts, the listing written up as an article, a photo essay with numbered plates. Shares all of
// its data decisions and interactive pieces with Cinematic Luxury (./spotlight/*) so the two can
// never disagree about what a listing has - only how it's presented.
export default function EditorialEstateTemplate({ data, publicUrl }: { data: PropertySiteResolveResponse; publicUrl: string }) {
  const m = useMemo(() => buildSpotlight(data), [data])
  const { p, has } = m
  const accent = usableAccent(data.brand_kit?.secondary_color, '#8d7548', 'light')
  const rootRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; title: string } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const closeShare = useCallback(() => setShareOpen(false), [])
  const openPhotos = useCallback((index = 0, photos = m.photos, title = p.address) => {
    if (photos.length) setLightbox({ photos, index, title })
  }, [m.photos, p.address])
  const allowTour = !m.status || m.status.forSale

  useEditorialMotion(rootRef)

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Cover', show: true },
    { id: 'story', label: 'The house', show: has.story },
    { id: 'photos', label: 'Photographs', show: has.gallery },
    { id: 'features', label: 'Features', show: has.features },
    { id: 'film', label: 'Film', show: has.video || has.tour },
    { id: 'floor-plans', label: 'Plans', show: has.floorPlans },
    { id: 'details', label: 'Details', show: has.details },
    { id: 'town', label: 'The town', show: has.town },
    { id: 'location', label: 'Location', show: has.location },
    { id: 'open-houses', label: 'Open house', show: has.openHouses },
    { id: 'contact', label: 'Contact', show: true },
  ]
  let chapterNo = 0
  const next = () => String(++chapterNo).padStart(2, '0')

  return (
    <div
      ref={rootRef}
      className={`ee ${playfair.variable} ${dmMono.variable} ${manrope.variable}`}
      style={{ ['--sp-accent' as string]: accent, ['--sp-on-accent' as string]: onAccent(accent) }}
    >
      <style>{EE_CSS}</style>
      <SpotlightViewBeacon siteId={data.site_id} />
      <SpotlightJsonLd m={m} url={publicUrl} />
      <div className="ee-progress" aria-hidden />

      <Masthead items={navItems} m={m} onShare={() => setShareOpen(true)} allowTour={allowTour} />
      <Cover m={m} onPhotos={() => openPhotos(0)} allowTour={allowTour} />
      <IndexBand m={m} />
      {has.openHouses && m.nextOpenHouse && <OpenHouseNotice m={m} url={publicUrl} />}

      {has.story && <Article m={m} n={next()} />}
      {has.gallery && <PhotoEssay m={m} n={next()} onOpen={openPhotos} />}
      {has.chapters && <Chapters chapters={m.chapters} onOpen={(photos, i, title) => openPhotos(i, photos, title)} />}
      {m.photos.length >= 4 && <Aperture m={m} />}
      {has.features && <Features m={m} n={next()} />}
      {(has.video || has.tour) && <FilmAndTour m={m} n={next()} videoUrl={data.video?.url} />}
      {has.floorPlans && <FloorPlans m={m} n={next()} onZoom={(i) => openPhotos(i, m.floorPlans.map(f => f.image_url), 'Floor plans')} />}
      {has.details && <Details m={m} n={next()} />}
      {has.town && <Town m={m} n={next()} />}
      {has.location && <Location m={m} n={next()} siteId={data.site_id} />}
      {/* Explore Nearby lives on the Location map (NearbyMap); on its own only when that section is hidden. */}
      {has.nearby && !(has.location && m.hasCoords) && p.latitude != null && p.longitude != null && (
        <section className="ee-paper pb-4 pt-2">
          <ExploreNearby
            siteId={data.site_id}
            kind="property_site"
            title="The Neighborhood"
            originLabel={p.address}
            origin={{ lat: p.latitude, lng: p.longitude }}
            theme={{ primary_color: '#172522', secondary_color: accent, heading_font: 'serif', body_font: 'sans', logo_url: data.brand_kit?.logo_url || null }}
          />
        </section>
      )}
      {has.payment && p.price && <Payment m={m} n={next()} />}
      {has.openHouses && <OpenHouses m={m} n={next()} url={publicUrl} />}
      {has.documents && <Documents m={m} n={next()} />}
      {has.agents && m.agent && <PresentedBy m={m} url={publicUrl} signatureSlug={has.signature ? data.signature_hub_slug || null : null} />}
      {m.show('guest_tools') && <GuestTools m={m} siteId={data.site_id} url={publicUrl} tone="paper" />}
      <Visit m={m} siteId={data.site_id} url={publicUrl} onShare={() => setShareOpen(true)} allowTour={allowTour} />
      <Footer m={m} navItems={navItems} onShare={() => setShareOpen(true)} />

      <MobileActionBar agent={m.agent} price={p.price} tone="light" allowTour={allowTour} />
      <Lightbox
        photos={lightbox?.photos || []}
        index={lightbox ? lightbox.index : null}
        title={lightbox?.title || p.address}
        onClose={() => setLightbox(null)}
        onIndex={(i) => setLightbox(l => (l ? { ...l, index: i } : l))}
      />
      <ShareSheet open={shareOpen} onClose={closeShare} url={publicUrl} title={m.fullAddress} tone="light" />
    </div>
  )
}

// Reveal-on-scroll + the cover's slow drift + the reading-progress hairline, all driven by one
// rAF-throttled scroll listener and an IntersectionObserver - no scroll-jacking, so the page
// always scrolls at the visitor's own pace on every device.
function useEditorialMotion(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target) } })
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
    root.querySelectorAll('.ee-reveal, .ee-aperture').forEach(el => (reduced ? el.classList.add('is-visible') : io.observe(el)))

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        const max = document.documentElement.scrollHeight - window.innerHeight
        root.style.setProperty('--ee-progress', String(max > 0 ? Math.min(1, y / max) : 0))
        if (!reduced) root.style.setProperty('--ee-cover', String(Math.min(1, y / window.innerHeight)))
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [rootRef])
}

// ---------- masthead + cover ----------

function Masthead({ items, m, onShare, allowTour }: { items: NavItem[]; m: SpotlightModel; onShare: () => void; allowTour: boolean }) {
  const [solid, setSolid] = useState(false)
  const [menu, setMenu] = useState(false)
  const [active, setActive] = useState('overview')
  const visible = items.filter(i => i.show)
  const key = visible.map(i => i.id).join('|')
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.85)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    const els = key.split('|').map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) }), { rootMargin: '-40% 0px -55% 0px' })
    els.forEach(el => io.observe(el))
    return () => { window.removeEventListener('scroll', onScroll); io.disconnect() }
  }, [key])
  useEffect(() => {
    if (!menu) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [menu])
  const go = (id: string) => { setMenu(false); scrollToId(id) }
  const initials = (m.agent?.name || 'Residence').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const agentPhoto = m.agent?.photo_url
  const links = visible.filter(i => i.id !== 'overview' && i.id !== 'contact').slice(0, 6)

  return (
    <>
      <header className={`ee-masthead ${solid ? 'is-solid' : ''}`}>
        <div className="flex h-16 w-full items-center justify-between gap-6 px-5 sm:px-10 xl:px-14">
          <button onClick={() => go('overview')} className="flex min-w-0 items-center gap-3 text-left" aria-label="Back to cover">
            {agentPhoto
              ? <img src={agentPhoto} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-current/30" />
              : <span className="sp-mono flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/40 text-[11px] tracking-[0.12em]">{initials}</span>}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="sp-display truncate text-[18px] italic">{m.agent?.name || street(m.p.address)}</span>
              {m.agent?.brokerage && <span className="sp-mono truncate text-[9px] uppercase tracking-[0.2em] opacity-70">{m.agent.brokerage}</span>}
            </span>
          </button>
          <nav className="hidden items-center gap-7 xl:flex" aria-label="Sections">
            {links.map(i => (
              <button key={i.id} onClick={() => go(i.id)} className={`ee-navlink sp-mono text-[10px] uppercase tracking-[0.18em] ${active === i.id ? 'is-active' : ''}`}>{i.label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={onShare} className="ee-iconbtn inline-flex" aria-label="Share this residence"><Share2 className="h-4 w-4" /></button>
            <button onClick={() => openLeadForm(allowTour ? 'tour' : 'info')} className="ee-cta sp-mono hidden text-[10px] uppercase tracking-[0.18em] sm:inline-flex">
              {allowTour ? 'Arrange a viewing' : 'Enquire'}
            </button>
            <button onClick={() => setMenu(true)} className="ee-iconbtn inline-flex xl:hidden" aria-label="Open menu" aria-expanded={menu}><Menu className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      {menu && (
        <div className="ee-menu fixed inset-0 z-[150] flex flex-col px-6 pb-8 pt-5" role="dialog" aria-modal="true" aria-label="Contents">
          <div className="flex items-center justify-between">
            <span className="sp-mono text-[10px] uppercase tracking-[0.2em] opacity-70">Contents</span>
            <button onClick={() => setMenu(false)} className="ee-iconbtn inline-flex" aria-label="Close menu"><X className="h-4 w-4" /></button>
          </div>
          <ol className="mt-10 flex-1 space-y-1 overflow-y-auto">
            {visible.map((i, n) => (
              <li key={i.id}>
                <button onClick={() => go(i.id)} className="flex w-full items-baseline gap-5 border-b border-[#f3efe6]/15 py-3 text-left">
                  <span className="sp-mono w-6 text-[10px] opacity-60">{String(n + 1).padStart(2, '0')}</span>
                  <span className={`sp-display text-3xl ${active === i.id ? 'italic text-[color:var(--ee-gold)]' : ''}`}>{i.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <button onClick={() => { setMenu(false); openLeadForm(allowTour ? 'tour' : 'info') }} className="sp-mono mt-6 w-full bg-[#f3efe6] py-4 text-[11px] uppercase tracking-[0.2em] text-[#172522]">
            {allowTour ? 'Arrange a viewing' : 'Enquire'}
          </button>
        </div>
      )}
    </>
  )
}

function Cover({ m, onPhotos, allowTour }: { m: SpotlightModel; onPhotos: () => void; allowTour: boolean }) {
  const { p } = m
  const title = street(p.address)
  const words = title.split(/\s+/)
  // Magazine-cover title: the house number sits on its own line in italic when there is one.
  const numbered = /^\d/.test(words[0] || '') && words.length > 1
  const first = numbered ? words[0] : null
  const rest = numbered ? words.slice(1).join(' ') : title
  const stats = [
    p.beds != null && `${fmtNumber(p.beds)} bd`,
    p.baths != null && `${fmtNumber(p.baths)} ba`,
    p.sqft && `${fmtNumber(p.sqft)} sq ft`,
    p.lot_size_acres && `${fmtNumber(p.lot_size_acres)} ac`,
  ].filter(Boolean) as string[]
  const oh = m.nextOpenHouse
  const hasPhoto = !!m.heroImage
  return (
    <section id="overview" className={`ee-cover ${hasPhoto ? 'has-photo' : 'no-photo'}`}>
      {hasPhoto && (
        <div className="ee-cover-media" aria-hidden={false}>
          <HeroMedia hero={m.heroImage} photos={m.photos} mode={m.header.mode} motion={m.header.motion} videoUrl={m.header.videoUrl} videoPoster={m.header.videoPoster} frame={m.header.frame} alt={m.fullAddress} />
        </div>
      )}
      <div className="ee-cover-inner flex h-full w-full flex-col justify-between px-5 pb-10 pt-24 sm:px-10 sm:pb-14 xl:px-14">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="sp-mono text-[10px] uppercase tracking-[0.22em] opacity-85">
            {[p.city, p.state].filter(Boolean).join(', ') || 'A private residence'}
            {m.status && <> &nbsp;·&nbsp; {m.status.label}</>}
          </p>
          <div className="flex flex-wrap gap-2">
            {m.reduction && <span className="ee-tag">Price improved {fmtCompactMoney(m.reduction)}</span>}
            {oh && <OpenHouseChip oh={oh} onClick={() => scrollToId('open-houses')} className="ee-tag" />}
          </div>
        </div>

        <div>
          {/* One line - sized to the address so a long street still fits across. */}
          <h1 className="sp-display ee-cover-title" style={{ fontSize: `clamp(1.3rem, ${Math.min(9.4, 132 / Math.max(title.length, 8)).toFixed(2)}vw, 9.4rem)` }}>
            <span className="whitespace-nowrap">{first && <i>{first} </i>}{rest}</span>
          </h1>
          <div className="ee-cover-rule mt-4 grid gap-3.5 pt-4 sm:mt-8 sm:gap-6 sm:pt-6 md:grid-cols-[auto_1fr_auto] md:items-end md:gap-10">
            {fmtMoney(p.price) && (
              <div>
                <p className="sp-mono text-[10px] uppercase tracking-[0.2em] opacity-70">{m.status?.kind === 'sold' ? 'Sold for' : 'Offered at'}</p>
                <p className="sp-display mt-1 text-[2rem] leading-none tabular-nums sm:text-5xl">{fmtMoney(p.price)}</p>
              </div>
            )}
            {stats.length > 0 && <p className="sp-mono text-[10px] uppercase tracking-[0.16em] opacity-85 sm:text-[11px] sm:tracking-[0.2em]">{stats.join('   /   ')}</p>}
            <div className="flex gap-2 sm:flex-wrap">
              <button onClick={() => openLeadForm(allowTour ? 'tour' : 'info')} className="ee-cover-btn is-primary sp-mono max-sm:!min-w-0 max-sm:!flex-1 max-sm:!justify-center max-sm:!whitespace-nowrap max-sm:!px-3">
                {allowTour ? 'Arrange a viewing' : 'Enquire'} <ArrowRight className="h-3.5 w-3.5" />
              </button>
              {m.photos.length > 1 && (
                <button onClick={onPhotos} className="ee-cover-btn sp-mono max-sm:!shrink-0 max-sm:!whitespace-nowrap max-sm:!px-3"><span className="sm:hidden">{m.photos.length} photos</span><span className="hidden sm:inline">{m.photos.length} photographs</span></button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function IndexBand({ m }: { m: SpotlightModel }) {
  const { p } = m
  const cells = [
    p.beds != null && { v: fmtNumber(p.beds), l: 'Bedrooms' },
    p.baths != null && { v: fmtNumber(p.baths), l: 'Bathrooms' },
    p.sqft && { v: fmtNumber(p.sqft), l: 'Interior sq ft' },
    p.lot_size_acres && { v: fmtNumber(p.lot_size_acres), l: 'Acres' },
    p.year_built && { v: String(p.year_built), l: 'Built' },
    p.garage_spaces && { v: fmtNumber(p.garage_spaces), l: 'Garage' },
  ].filter(Boolean) as { v: string; l: string }[]
  const facts = m.notableFacts
  if (cells.length === 0 && facts.length === 0) return <div id="index" />
  return (
    <section id="index" className="ee-sand border-b border-[#172522]/15">
      <div className="mx-auto max-w-[1500px] px-5 sm:px-10">
        {cells.length > 0 && (
          <div className={`ee-index grid grid-cols-2 sm:grid-cols-3 ${cells.length >= 5 ? 'lg:grid-cols-6' : cells.length === 4 ? 'lg:grid-cols-4' : ''}`}>
            {cells.map((c, i) => (
              <div key={c.l} className="ee-reveal py-8 sm:py-10" style={{ transitionDelay: `${i * 60}ms` }}>
                <p className="sp-display text-5xl leading-none tabular-nums sm:text-6xl">{c.v}</p>
                <p className="sp-mono mt-3 text-[10px] uppercase tracking-[0.18em] opacity-60">{c.l}</p>
              </div>
            ))}
          </div>
        )}
        {facts.length > 0 && (
          <p className="sp-mono flex flex-wrap gap-x-8 gap-y-2 border-t border-[#172522]/15 py-5 text-[11px] uppercase tracking-[0.18em]">
            {facts.map(f => <span key={f} className="inline-flex items-center gap-2"><span className="h-1 w-1 rotate-45 bg-[color:var(--sp-accent)]" />{f}</span>)}
          </p>
        )}
      </div>
    </section>
  )
}

function OpenHouseNotice({ m, url }: { m: SpotlightModel; url: string }) {
  const oh = m.nextOpenHouse!
  return (
    <div className="ee-deep">
      <div className="flex w-full flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10 xl:px-14">
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="sp-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ee-gold)]">Open house</span>
          <span className="sp-display text-2xl italic">{fmtDay(oh.date)}</span>
          {fmtTimeRange(oh.start_time, oh.end_time) && <span className="sp-mono text-[11px] uppercase tracking-[0.14em] opacity-75">{fmtTimeRange(oh.start_time, oh.end_time)}</span>}
        </p>
        <div className="ee-on-deep"><AddToCalendar openHouse={oh} address={m.p.address} fullAddress={m.fullAddress} url={url} agentName={m.agent?.name} tone="dark" /></div>
      </div>
    </div>
  )
}

// ---------- the article ----------

function SectionHead({ n, kicker, title, aside, id }: { n: string; kicker: string; title: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <Reveal className="ee-sectionhead mb-12 grid gap-6 border-b border-[#172522]/20 pb-6 md:mb-16 md:grid-cols-[1fr_auto] md:items-end">
      <div id={id}>
        <Kicker n={n}>{kicker}</Kicker>
        <h2 className="sp-display mt-4 text-[clamp(2.6rem,6vw,5.6rem)] leading-[0.92] tracking-[-0.03em]">{title}</h2>
      </div>
      {aside && <div className="sp-mono text-[11px] uppercase tracking-[0.16em] opacity-65 md:pb-3 md:text-right">{aside}</div>}
    </Reveal>
  )
}

function Article({ m, n }: { m: SpotlightModel; n: string }) {
  const [expanded, setExpanded] = useState(false)
  const text = m.description
  const long = text.length > 1100
  const pull = m.featureQuotes[0]
  const photo = m.storyPhoto
  return (
    <section id="story" className="ee-paper scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="The house" title={<>Made of <i>place.</i></>} aside={[m.p.year_built && `Built ${m.p.year_built}`, m.p.subdivision_name || m.p.county].filter(Boolean).join(' · ')} />
        <div className={`grid gap-12 ${photo ? 'lg:grid-cols-[1.5fr_1fr]' : ''} lg:gap-20`}>
          <Reveal>
            <div className={`relative ${long && !expanded ? 'max-h-[34rem] overflow-hidden' : ''}`}>
              <div className="ee-article whitespace-pre-line">{text}</div>
              {long && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f3efe6] to-transparent" />}
            </div>
            {long && (
              <button onClick={() => setExpanded(e => !e)} className="sp-mono mt-6 inline-flex items-center gap-2 border-b border-[#172522] pb-1 text-[10px] uppercase tracking-[0.18em]" aria-expanded={expanded}>
                {expanded ? 'Show less' : 'Continue reading'} <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </Reveal>
          {photo && (
            <Reveal as="figure" className="lg:sticky lg:top-24 lg:self-start">
              <div className="ee-frame aspect-[4/5]"><img src={photo} alt={`${m.p.address}`} loading="lazy" /></div>
              <figcaption className="sp-mono mt-3 flex justify-between text-[10px] uppercase tracking-[0.16em] opacity-60">
                <span>Plate I</span><span>{[m.p.city, m.p.state].filter(Boolean).join(', ')}</span>
              </figcaption>
            </Reveal>
          )}
        </div>
        {pull && (
          <Reveal className="mx-auto mt-20 max-w-4xl text-center">
            <p className="sp-display text-[clamp(1.8rem,3.6vw,3rem)] italic leading-[1.2]">&ldquo;{pull}&rdquo;</p>
            <span className="mx-auto mt-6 block h-px w-16 bg-[color:var(--sp-accent)]" />
          </Reveal>
        )}
      </div>
    </section>
  )
}

function PhotoEssay({ m, n, onOpen }: { m: SpotlightModel; n: string; onOpen: (i: number) => void }) {
  const photos = m.photos
  return (
    <section id="photos" className="ee-paper scroll-mt-16 px-5 pb-24 sm:px-10 sm:pb-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="A photo essay" title={<>In the right <i>light.</i></>} aside={`${photos.length} photograph${photos.length === 1 ? '' : 's'}`} />
        <Reveal>
          <PhotoShow photos={photos} alt={m.p.address} onOpen={onOpen} tone="light" fontClass="sp-mono" />
        </Reveal>
        {photos.length > 1 && (
          <div className="mt-10 flex justify-center">
            <button onClick={() => onOpen(0)} className="ee-linebtn sp-mono"><Expand className="h-3.5 w-3.5" /> View all {photos.length} photographs</button>
          </div>
        )}
      </div>
    </section>
  )
}

function Chapters({ chapters, onOpen }: { chapters: PropertySiteChapter[]; onOpen: (photos: string[], i: number, title: string) => void }) {
  return <RoomChapters chapters={chapters} onOpen={onOpen} tone="deep" labelClass="sp-mono" numerals={ROMAN} />
}

// A photographic interlude: the frame opens from a small aperture to full bleed as it scrolls in.
function Aperture({ m }: { m: SpotlightModel }) {
  const src = m.photos[3] || m.photos[2]
  const line = m.featureQuotes[1] || m.featureQuotes[0]
  return (
    <section className="ee-aperture ee-sand overflow-hidden px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto grid max-w-[1500px] items-center gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Kicker>Interlude</Kicker>
          <p className="sp-display mt-5 text-[clamp(2.6rem,5.5vw,5.4rem)] leading-[0.92] tracking-[-0.03em]">
            {line ? <i className="text-[clamp(1.8rem,3.4vw,3rem)] leading-[1.15]">&ldquo;{line}&rdquo;</i> : <>Small frame.<br /><i>Infinite room.</i></>}
          </p>
        </div>
        <div className="ee-aperture-window"><img src={src} alt={`${m.p.address}`} loading="lazy" /></div>
      </div>
    </section>
  )
}

const FEATURE_LABELS: [keyof SpotlightModel['features'], string][] = [
  ['interior', 'Interior'], ['exterior', 'Exterior'], ['lifestyle', 'Lifestyle'], ['community', 'Community'], ['other', 'Additional'],
]

function Features({ m, n }: { m: SpotlightModel; n: string }) {
  const split = splitFeatures(m.allFeatureTags, m.featured)
  // Whole rows only - 8, 6, 4, 3... - so the tile grid never ends in a gap.
  const fit = split.signature.length >= 8 ? 8 : split.signature.length >= 6 ? 6 : split.signature.length >= 4 ? 4 : split.signature.length
  const signature = split.signature.slice(0, fit)
  const spill = split.signature.slice(fit).map(s => s.label)
  const rest = new Set([...split.rest, ...spill].map(t => t.toLowerCase()))
  const groups = FEATURE_LABELS.map(([k, label]) => ({ k, label, items: m.features[k].filter(t => rest.has(t.toLowerCase())) })).filter(g => g.items.length)
  const total = m.allFeatureTags.length
  const quotes = m.featureQuotes.slice(1, 5)
  const cols = fit === 6 || fit === 3 ? 'lg:grid-cols-3' : fit === 2 ? 'lg:grid-cols-2' : fit === 1 ? '' : 'lg:grid-cols-4'
  return (
    <section id="features" className="ee-paper scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="Material inventory" title={<>Considered <i>elements.</i></>} aside={total ? `${total} details` : undefined} />
        {signature.length > 0 && (
          <div className={`mb-16 grid grid-cols-2 gap-px border border-[#172522]/15 bg-[#172522]/15 ${cols} [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1`}>
            {signature.map((f, i) => {
              const Icon = f.icon
              return (
                <Reveal key={f.label} className="ee-sig group bg-[#f3efe6] p-4 sm:p-9" >
                  <div className="flex items-start justify-between">
                    <span className="ee-sig-icon"><Icon className="h-5 w-5" strokeWidth={1.4} /></span>
                    <span className="sp-mono text-[10px] opacity-45">{ROMAN[i]}</span>
                  </div>
                  <p className="sp-display mt-6 text-[1.2rem] leading-[1.1] sm:mt-10 sm:text-[1.7rem]">{f.display}</p>
                </Reveal>
              )
            })}
          </div>
        )}
        {quotes.length > 0 && (
          <div className="mb-16 grid gap-px bg-[#172522]/15 md:grid-cols-2">
            {quotes.map((q, i) => (
              <Reveal key={q} className="bg-[#f3efe6] p-8 sm:p-10">
                <p className="sp-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--sp-accent)]">Note {ROMAN[i]}</p>
                <p className="sp-display mt-4 text-2xl italic leading-snug">{q}</p>
              </Reveal>
            ))}
          </div>
        )}
        {groups.length > 0 && (
          <Reveal>
            <p className="sp-mono mb-2 text-[10px] uppercase tracking-[0.2em] opacity-60">{signature.length ? 'Also in the house' : 'The inventory'}</p>
            {/* One flowing inventory in balanced columns - a 17-item Interior list and a 2-item
                Exterior list share the width instead of leaving one tall column beside a stub. */}
            <div className="ee-inventory">
              {groups.map(g => (
                <div key={g.k} className="ee-inv-group">
                  <p className="ee-inv-head"><span className="sp-display text-[1.35rem] italic">{g.label}</span><span className="sp-mono text-[10px] opacity-45">{String(g.items.length).padStart(2, '0')}</span></p>
                  <ul>{g.items.map(f => <li key={f}>{prettyFeature(f)}</li>)}</ul>
                </div>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function useEscapeModal(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open, onClose])
}

function FilmAndTour({ m, n, videoUrl }: { m: SpotlightModel; n: string; videoUrl?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const closeTour = useCallback(() => setTourOpen(false), [])
  useEscapeModal(tourOpen, closeTour)
  const showVideo = m.has.video && !!videoUrl
  return (
    <section id="film" className="ee-deep scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <Reveal className="mb-12 flex flex-col gap-4 border-b border-[#f3efe6]/20 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="sp-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ee-gold)]">{n} — {showVideo && m.has.tour ? 'Film & 3D tour' : showVideo ? 'The film' : '3D tour'}</p>
            <h2 className="sp-display mt-4 text-[clamp(2.6rem,6vw,5.6rem)] leading-[0.92] tracking-[-0.03em]">{showVideo ? <>A moving <i>portrait.</i></> : <>Walk it <i>yourself.</i></>}</h2>
          </div>
        </Reveal>
        <div className={`grid gap-6 ${showVideo && m.has.tour ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
          {showVideo && (
            <Reveal className="relative aspect-video overflow-hidden bg-black">
              <video ref={videoRef} src={videoUrl} poster={m.heroImage || undefined} controls={playing} playsInline preload="metadata" className="h-full w-full object-cover" onPlay={() => setPlaying(true)} suppressHydrationWarning />
              {!playing && (
                <button onClick={() => { setPlaying(true); videoRef.current?.play().catch(() => {}) }} className="group absolute inset-0 flex items-center justify-center bg-black/25" aria-label="Play the film">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full border border-[#f3efe6]/60 bg-[#f3efe6]/10 transition duration-500 group-hover:scale-110"><Play className="ml-1 h-7 w-7 fill-[#f3efe6] text-[#f3efe6]" /></span>
                </button>
              )}
            </Reveal>
          )}
          {m.has.tour && (
            <Reveal>
              <button onClick={() => setTourOpen(true)} className={`group relative flex w-full flex-col justify-end overflow-hidden bg-[#091513] p-8 text-left ${showVideo ? 'aspect-video lg:aspect-auto lg:h-full' : 'aspect-[21/9] min-h-[300px]'}`}>
                {(m.photos[2] || m.heroImage) && <img src={m.photos[2] || m.heroImage!} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-700 group-hover:scale-105 group-hover:opacity-55" />}
                <span className="absolute inset-0 bg-gradient-to-t from-[#091513] via-[#091513]/30 to-transparent" />
                <span className="relative">
                  <Box className="h-7 w-7 text-[color:var(--ee-gold)]" />
                  <span className="sp-display mt-4 block text-4xl">Enter the <i>3D tour</i></span>
                  <span className="sp-mono mt-3 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] opacity-80">Opens full screen <ArrowRight className="h-3 w-3" /></span>
                </span>
              </button>
            </Reveal>
          )}
        </div>
      </div>
      {tourOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#091513]" role="dialog" aria-modal="true" aria-label="3D tour">
          <div className="flex items-center justify-between px-4 py-3 text-[#f3efe6]">
            <a href={m.tourUrl} target="_blank" rel="noreferrer" className="sp-mono text-[10px] uppercase tracking-[0.2em] underline underline-offset-4">Open in new tab</a>
            <button onClick={closeTour} autoFocus className="rounded-full bg-white/10 p-2.5 hover:bg-white/20" aria-label="Close tour"><X className="h-4 w-4" /></button>
          </div>
          <iframe src={m.tourUrl} title="3D tour" className="w-full flex-1 border-0" allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen; vr" allowFullScreen />
        </div>
      )}
    </section>
  )
}

function FloorPlans({ m, n, onZoom }: { m: SpotlightModel; n: string; onZoom: (i: number) => void }) {
  const [active, setActive] = useState(0)
  const plan = m.floorPlans[active] || m.floorPlans[0]
  return (
    <section id="floor-plans" className="ee-paper scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="Plans" title={<>The <i>arrangement.</i></>} aside={m.p.sqft ? `${fmtNumber(m.p.sqft)} sq ft` : undefined} />
        {m.floorPlans.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-6" role="tablist">
            {m.floorPlans.map((pl, i) => (
              <button key={i} role="tab" aria-selected={active === i} onClick={() => setActive(i)}
                className={`ee-navlink sp-mono text-[11px] uppercase tracking-[0.18em] ${active === i ? 'is-active' : ''}`}>
                {pl.label || `Level ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        <Reveal>
          <button onClick={() => onZoom(active)} className="group relative block w-full cursor-zoom-in border border-[#172522]/15 bg-white p-6 sm:p-12" aria-label="Enlarge floor plan">
            <img src={plan.image_url} alt={plan.label || 'Floor plan'} className="mx-auto max-h-[72vh] w-auto object-contain" />
            <span className="sp-mono absolute right-4 top-4 inline-flex items-center gap-1.5 bg-[#172522] px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-[#f3efe6] opacity-80 group-hover:opacity-100"><Expand className="h-3 w-3" /> Enlarge</span>
          </button>
        </Reveal>
      </div>
    </section>
  )
}

function Details({ m, n }: { m: SpotlightModel; n: string }) {
  const groups = groupSpecs(m.keyFacts)
  return (
    <section id="details" className="ee-sand scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="Specifications" title={<>The <i>particulars.</i></>} aside={m.isMls && m.p.mls_number ? `MLS# ${m.p.mls_number}` : undefined} />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g, i) => {
            const Icon = g.icon
            return (
              <Reveal key={g.title} className="ee-spec group relative overflow-hidden border border-[#172522]/[0.12] bg-[#f3efe6]/70 p-7 transition duration-500 hover:bg-[#f3efe6] sm:p-9" >
                <div className="flex items-center justify-between">
                  <span className="ee-sig-icon"><Icon className="h-5 w-5" strokeWidth={1.4} /></span>
                  <span className="sp-mono text-[10px] opacity-45">{ROMAN[i]}</span>
                </div>
                <h3 className="sp-display mt-7 text-[2rem] leading-none">{g.title.split(' ').slice(0, -1).join(' ')} <i>{g.title.split(' ').slice(-1)}</i></h3>
                <dl className="mt-6">
                  {g.facts.map(f => (
                    <div key={f.label} className="flex items-baseline justify-between gap-6 border-t border-[#172522]/[0.12] py-3">
                      <dt className="sp-mono shrink-0 text-[10px] uppercase tracking-[0.16em] opacity-60">{f.label}</dt>
                      <dd className="text-right text-[15px] leading-snug">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// Life in <town> - short facts with graphics (see ./spotlight/TownSection).
function Town({ m, n }: { m: SpotlightModel; n: string }) {
  const t = m.town!
  return (
    <TownFeature
      tone="editorial"
      name={t.name}
      facts={t.facts}
      body={t.body}
      photo={t.photo}
      place={[['County', m.p.county], ['Township', m.p.township], ['School district', m.p.school_district_name]]}
      kicker={<p className="sp-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ee-gold)]">{n} — The town</p>}
      onExplore={m.has.nearby ? () => scrollToId('explore-nearby') : undefined}
    />
  )
}

function Location({ m, n, siteId }: { m: SpotlightModel; n: string; siteId: string }) {
  const { p } = m
  return (
    <section id="location" className="ee-paper scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="Location" title={p.city ? <>A private <i>latitude.</i></> : <>Where it <i>sits.</i></>}
          aside={m.hasCoords ? `${toDMS(p.latitude!, 'N', 'S')} / ${toDMS(p.longitude!, 'E', 'W')}` : [p.city, p.state].filter(Boolean).join(', ')} />
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          {m.hasCoords ? (
            <Reveal className="min-w-0">
              <NearbyMap latitude={p.latitude!} longitude={p.longitude!} address={m.fullAddress} accent="var(--sp-accent)" dark={false} tone="light"
                siteId={siteId} kind="property_site" nearbyOn={m.has.nearby} originLabel={p.address || 'the home'}
                boxClassName="relative aspect-[4/3] border border-[#172522]/15 sm:aspect-[16/11] lg:aspect-auto lg:h-[500px]" />
            </Reveal>
          ) : (
            <Reveal className="relative aspect-[16/11] border border-[#172522]/15 lg:aspect-auto lg:min-h-[500px]">
              <iframe title={`Map of ${m.fullAddress}`} src={m.mapEmbedUrl} loading="lazy" className="ee-map absolute inset-0 h-full w-full border-0" referrerPolicy="no-referrer-when-downgrade" />
            </Reveal>
          )}
          <Reveal>
            <p className="sp-display text-3xl leading-tight">{p.address}</p>
            <p className="sp-mono mt-2 text-[11px] uppercase tracking-[0.16em] opacity-65">{[p.city, [p.state, p.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
            <dl className="mt-8">
              {([['Neighborhood', p.subdivision_name], ['County', p.county], ['Township', p.township], ['School district', p.school_district_name]] as [string, string | null | undefined][]).filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className="flex justify-between gap-4 border-b border-[#172522]/15 py-3">
                  <dt className="sp-mono text-[10px] uppercase tracking-[0.16em] opacity-65">{l}</dt><dd className="text-right text-sm">{v}</dd>
                </div>
              ))}
            </dl>
            {m.schools.length > 0 && (
              <div className="mt-10">
                <p className="sp-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--sp-accent)]">Assigned schools</p>
                <ul className="mt-3">
                  {m.schools.map(s => (
                    <li key={s.level} className="flex items-baseline justify-between gap-4 border-b border-[#172522]/[0.12] py-3">
                      <span className="sp-display text-lg">{s.name}</span><span className="sp-mono text-[10px] uppercase tracking-[0.14em] opacity-55">{s.level}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-relaxed opacity-55">Per the MLS record; confirm enrollment with the district.</p>
              </div>
            )}
            <a href={m.directionsUrl} target="_blank" rel="noreferrer" className="ee-linebtn sp-mono mt-10"><Navigation className="h-3.5 w-3.5" /> Get directions</a>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Payment({ m, n }: { m: SpotlightModel; n: string }) {
  return (
    <section id="payment" className="ee-sand scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="The arithmetic" title={<>Monthly, <i>roughly.</i></>} />
        <Reveal className="border border-[#172522]/15 bg-[#f3efe6] p-6 sm:p-12">
          <PaymentEstimator price={m.p.price!} taxesMonthly={m.taxesMonthly} hoaMonthly={m.hoaMonthly} tone="light" />
        </Reveal>
      </div>
    </section>
  )
}

function OpenHouses({ m, n, url }: { m: SpotlightModel; n: string; url: string }) {
  return (
    <section id="open-houses" className="ee-paper scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="Viewing calendar" title={<>Open <i>house.</i></>} aside="No appointment needed" />
        <ol>
          {m.openHouses.map((oh, i) => {
            const d = parseDay(oh.date)!
            return (
              <Reveal key={oh.id || i}>
                <li className="grid items-center gap-4 border-b border-[#172522]/15 py-6 sm:grid-cols-[120px_1fr_auto] sm:gap-10">
                  <p className="sp-display text-6xl leading-none tabular-nums">{String(d.getDate()).padStart(2, '0')}<span className="sp-mono ml-2 align-top text-[10px] uppercase tracking-[0.16em] opacity-60">{d.toLocaleDateString('en-US', { month: 'short' })}</span></p>
                  <div>
                    <p className="sp-display text-3xl italic">{d.toLocaleDateString('en-US', { weekday: 'long' })}</p>
                    <p className="sp-mono mt-1 text-[11px] uppercase tracking-[0.14em] opacity-70">{fmtTimeRange(oh.start_time, oh.end_time) || 'Time to be announced'}</p>
                  </div>
                  <AddToCalendar openHouse={oh} address={m.p.address} fullAddress={m.fullAddress} url={url} agentName={m.agent?.name} tone="light" />
                </li>
              </Reveal>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

function Documents({ m, n }: { m: SpotlightModel; n: string }) {
  return (
    <section id="documents" className="ee-paper scroll-mt-16 px-5 pb-24 sm:px-10 sm:pb-32">
      <div className="mx-auto max-w-[1500px]">
        <SectionHead n={n} kicker="Supplements" title={<>For the <i>file.</i></>} />
        <ul className="grid gap-x-14 md:grid-cols-2">
          {m.documents.map((d, i) => (
            <li key={i}>
              <a href={d.url} target="_blank" rel="noreferrer" className="group flex items-center gap-4 border-b border-[#172522]/15 py-5">
                <FileText className="h-4 w-4 shrink-0 text-[color:var(--sp-accent)]" />
                <span className="sp-display flex-1 text-xl">{d.label || 'Document'}</span>
                <span className="sp-mono text-[10px] uppercase tracking-[0.16em] opacity-55">{/\.pdf($|\?)/i.test(d.url) ? 'PDF' : 'Open'}</span>
                <ArrowUpRight className="h-4 w-4 opacity-50 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function PresentedBy({ m, url, signatureSlug }: { m: SpotlightModel; url: string; signatureSlug?: string | null }) {
  const [primary, ...co] = m.agents
  const first = primary.name.split(' ')[0]
  return (
    <section id="agent" className="ee-paper scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto grid max-w-[1500px] items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-24">
        <Reveal as="figure" className="mx-auto w-full max-w-md">
          <div className="ee-frame relative aspect-[4/5] bg-[#7d9082]">
            {primary.photo_url
              ? <img src={primary.photo_url} alt={primary.name} loading="lazy" />
              : <span className="sp-display flex h-full w-full items-center justify-center text-[7rem] italic text-[#f3efe6]">{primary.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')}</span>}
          </div>
          <figcaption className="sp-mono mt-3 flex justify-between text-[10px] uppercase tracking-[0.16em] opacity-60">
            <span>Presented by</span><span>{primary.brokerage || 'Listing agent'}</span>
          </figcaption>
        </Reveal>
        <Reveal>
          <Kicker>Presented by</Kicker>
          <h2 className="sp-display mt-5 text-[clamp(3rem,6.4vw,6rem)] leading-[0.9] tracking-[-0.03em]">{primary.name}</h2>
          <p className="sp-mono mt-4 text-[11px] uppercase tracking-[0.16em] opacity-70">{[primary.title || 'Listing agent', primary.brokerage].filter(Boolean).join(' · ')}</p>
          {primary.license_number && <p className="sp-mono mt-1 text-[10px] uppercase tracking-[0.14em] opacity-50">Lic. #{primary.license_number}</p>}
          {primary.bio && <p className="mt-7 max-w-xl text-[16px] leading-[1.8] opacity-80">{excerpt(primary.bio, 3, 420)}</p>}
          <AgentActions agent={primary} address={m.p.address} url={url} tone="light" className="mt-8" />
          {primary.hub_url && (
            <a href={primary.hub_url} target="_blank" rel="noreferrer" className="ee-linebtn sp-mono mt-6">
              Visit {first}’s Agent Hub <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
          {co.length > 0 && (
            <ul className="mt-10 space-y-3 border-t border-[#172522]/15 pt-6">
              {co.map((a, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span><span className="sp-display text-xl">{a.name}</span> <span className="sp-mono text-[10px] uppercase tracking-[0.14em] opacity-60">{a.title || 'Co-listing agent'}</span></span>
                  <span className="sp-mono flex gap-4 text-[10px] uppercase tracking-[0.14em]">
                    {a.phone && <a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`} className="underline underline-offset-4">Call</a>}
                    {a.email && <a href={`mailto:${a.email}`} className="underline underline-offset-4">Email</a>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
      {signatureSlug && (
        <div className="mx-auto mt-16 max-w-3xl border-t border-[#172522]/15 pt-4"><SignatureSiteCard hubSlug={signatureSlug} towns={m.p.city ? [m.p.city] : []} /></div>
      )}
    </section>
  )
}

function Visit({ m, siteId, url, onShare, allowTour }: { m: SpotlightModel; siteId: string; url: string; onShare: () => void; allowTour: boolean }) {
  const a = m.agent
  return (
    <section id="contact" className="ee-sand scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto grid max-w-[1500px] gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <Reveal>
          <Kicker>{allowTour ? 'Private viewing' : 'Enquiries'}</Kicker>
          {/* The street always gets its own line. */}
          <h2 className="sp-display mt-5 text-[clamp(2.8rem,6vw,5.8rem)] leading-[0.92] tracking-[-0.03em] [container-type:inline-size]">
            {allowTour ? 'Come see' : 'Questions about'}<br /><i className="block" style={fitLine(street(m.p.address) + '.', '1em', 175)}>{street(m.p.address)}{allowTour ? '.' : '?'}</i>
          </h2>
          <p className="mt-6 max-w-md text-[16px] leading-[1.75] opacity-80">
            {allowTour
              ? `Private showings are arranged around your schedule - choose a day and ${a?.name?.split(' ')[0] || 'the listing agent'} will confirm personally.`
              : `Send a note and receive a personal reply from ${a?.name?.split(' ')[0] || 'the listing agent'}.`}
          </p>
          {a && (
            <div className="mt-10 flex items-center gap-4 border-t border-[#172522]/20 pt-8">
              {a.photo_url
                ? <img src={a.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" loading="lazy" />
                : <span className="sp-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#7d9082] text-xl italic text-[#f3efe6]">{a.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')}</span>}
              <div className="min-w-0">
                <p className="sp-display text-2xl leading-tight">{a.name}</p>
                <p className="sp-mono mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] opacity-75">
                  {a.phone && <a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`} className="underline underline-offset-4">{fmtPhone(a.phone)}</a>}
                  {a.email && <a href={`mailto:${a.email}`} className="underline underline-offset-4">Email</a>}
                  {a.hub_url && <a href={a.hub_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Agent Hub</a>}
                </p>
              </div>
            </div>
          )}
          <button onClick={onShare} className="ee-linebtn sp-mono mt-10"><Share2 className="h-3.5 w-3.5" /> Share this residence</button>
        </Reveal>
        <Reveal className="bg-[#f7f3ea] p-6 shadow-[0_40px_80px_-50px_rgba(16,32,30,.5)] sm:p-12">
          <p className="sp-mono mb-8 text-[10px] uppercase tracking-[0.2em] opacity-60">{allowTour ? 'Request a viewing or information' : 'Request information'}</p>
          <LeadForm siteId={siteId} address={m.p.address} tone="light" agent={m.agent} openHouses={m.has.openHouses ? m.openHouses : []} allowTour={allowTour} />
        </Reveal>
      </div>
    </section>
  )
}

function Footer({ m, navItems, onShare }: { m: SpotlightModel; navItems: NavItem[]; onShare: () => void }) {
  return (
    <footer className="ee-deep px-5 pb-28 pt-20 sm:px-10 lg:pb-12">
      <div className="mx-auto max-w-[1500px] [container-type:inline-size]">
        <p className="sp-display leading-[0.85] tracking-[-0.035em]" style={fitLine(street(m.p.address), '8.5rem', 170)}>{street(m.p.address)}</p>
        <div className="mt-10 flex flex-col gap-8 border-t border-[#f3efe6]/15 pt-8 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap gap-x-7 gap-y-3" aria-label="Footer">
            {navItems.filter(i => i.show).map(i => (
              <button key={i.id} onClick={() => scrollToId(i.id)} className="sp-mono text-[10px] uppercase tracking-[0.18em] opacity-70 transition hover:opacity-100">{i.label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={onShare} className="sp-mono inline-flex items-center gap-2 border border-[#f3efe6]/30 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] hover:border-[#f3efe6]"><Share2 className="h-3.5 w-3.5" /> Share</button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="sp-mono border border-[#f3efe6]/30 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] hover:border-[#f3efe6]">Back to cover</button>
          </div>
        </div>
        {/* the agent pill from this page's link preview (84px headshot) - not a line of small print */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {m.agent ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
              <PresentedByPill agent={m.agent} tone="dark" />
              {m.agent.hub_url && <a href={m.agent.hub_url} target="_blank" rel="noreferrer" className="sp-mono text-[10px] uppercase tracking-[0.14em] underline underline-offset-4 opacity-70 hover:opacity-100">Agent Hub</a>}
            </div>
          ) : <span />}
          <span className="sp-mono text-[10px] uppercase tracking-[0.14em] opacity-55">Equal Housing Opportunity · Powered by OpenHousePal</span>
        </div>
        {m.isMls && <div className="mt-6 border-t border-[#f3efe6]/10 pt-5"><MlsDisclaimer listOffice={m.p.list_office_name} mlsNumber={m.p.mls_number} /></div>}
      </div>
    </footer>
  )
}

const EE_CSS = `
.ee{--ink:#172522;--deep:#10201e;--paper:#f3efe6;--sand:#e7ddca;--ee-gold:#d9c38d;background:var(--paper);color:var(--ink);font-family:var(--font-ee-sans),Manrope,ui-sans-serif,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:clip}
.ee .sp-display{font-family:var(--font-ee-display),"Playfair Display",Georgia,serif;font-weight:400}
.ee .sp-mono{font-family:var(--font-ee-mono),"DM Mono",ui-monospace,monospace}
.ee ::selection{background:var(--ink);color:var(--paper)}
.ee i,.ee em{font-style:italic}
.ee-paper{background:var(--paper);color:var(--ink)}
.ee-sand{background:var(--sand);color:var(--ink)}
.ee-deep{background:var(--deep);color:var(--paper)}
.ee-progress{position:fixed;z-index:120;top:0;left:0;height:2px;width:100%;background:var(--sp-accent);transform-origin:0 50%;transform:scaleX(var(--ee-progress,0))}
.ee-masthead{position:fixed;inset:0 0 auto 0;z-index:90;color:var(--paper);transition:background .45s ease,color .45s ease,border-color .45s ease;border-bottom:1px solid rgba(243,239,230,.18);background:linear-gradient(180deg,rgba(9,21,19,.55),transparent)}
.ee-masthead.is-solid{background:rgba(243,239,230,.92);color:var(--ink);border-bottom-color:rgba(23,37,34,.14);}
.ee-navlink{position:relative;padding:6px 0;opacity:.72;transition:opacity .25s}.ee-navlink:hover,.ee-navlink.is-active{opacity:1}
.ee-navlink:after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.2,.7,.2,1)}.ee-navlink.is-active:after,.ee-navlink:hover:after{transform:scaleX(1)}
.ee-iconbtn{align-items:center;justify-content:center;width:40px;height:40px;border:1px solid currentColor;border-radius:999px;opacity:.85;transition:opacity .2s,background .2s}.ee-iconbtn:hover{opacity:1;background:rgba(127,127,127,.12)}
.ee-cta{align-items:center;height:40px;padding:0 18px}
.ee-cover-rule{border-top:1px solid color-mix(in srgb,currentColor 30%,transparent)}
.ee-masthead .ee-cta{background:var(--paper);color:var(--ink)}.ee-masthead.is-solid .ee-cta{background:var(--ink);color:var(--paper)}
.ee-menu{background:var(--deep);color:var(--paper);animation:eeFade .3s ease both}
@keyframes eeFade{from{opacity:0}to{opacity:1}}
.ee-cover{position:relative;height:100svh;min-height:660px;overflow:hidden}
.ee-cover.has-photo{background:#091513;color:var(--paper)}
.ee-cover.no-photo{background:var(--sand);color:var(--ink)}
.ee-cover.no-photo .ee-cover-title{font-size:clamp(3.4rem,11vw,11rem)}
.ee-cover-media{position:absolute;inset:0;overflow:hidden}
.ee-cover-media .hm{transform:scale(calc(1 + var(--ee-cover,0) * .08)) translateY(calc(var(--ee-cover,0) * 6%));filter:saturate(.85) contrast(1.04);will-change:transform}
@keyframes eeCoverIn{from{opacity:0;filter:saturate(.85) contrast(1.04) blur(6px)}to{opacity:1}}
.ee-cover.has-photo:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(9,21,19,.55) 0%,rgba(9,21,19,0) 30%,rgba(9,21,19,.2) 55%,rgba(9,21,19,.88) 100%);pointer-events:none}
.ee-cover-inner{position:relative;z-index:2}
.ee-cover-title{font-size:clamp(3.2rem,9.5vw,9.8rem);line-height:.9;letter-spacing:-.035em;animation:eeTitleIn 1.2s .2s cubic-bezier(.2,.7,.2,1) both}
@keyframes eeTitleIn{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
.ee-tag{font-family:var(--font-ee-mono),monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;padding:7px 12px;border:1px solid currentColor;background:rgba(9,21,19,.25);}
.ee-cover.no-photo .ee-tag{background:transparent}
.ee-cover-btn{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 20px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;border:1px solid currentColor;transition:background .25s,color .25s}
.ee-cover-btn:hover{background:rgba(243,239,230,.12)}
.ee-cover.has-photo .ee-cover-btn.is-primary{background:var(--paper);color:var(--ink);border-color:var(--paper)}
.ee-cover.no-photo .ee-cover-btn.is-primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.ee-scrollcue{position:absolute;z-index:3;right:2.5rem;bottom:2.5rem;display:none;align-items:center;gap:8px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--paper);opacity:.75;writing-mode:vertical-rl}
@media(min-width:1024px){.ee-scrollcue{display:flex}}
.ee-index>div{border-left:1px solid rgba(23,37,34,.15);padding-left:1.25rem}
.ee-index>div:nth-child(2n+1){border-left:0;padding-left:0}
@media(min-width:640px){.ee-index>div{padding-left:1.75rem}.ee-index>div:nth-child(2n+1){border-left:1px solid rgba(23,37,34,.15);padding-left:1.75rem}.ee-index>div:nth-child(3n+1){border-left:0;padding-left:0}}
@media(min-width:1024px){.ee-index>div:nth-child(3n+1){border-left:1px solid rgba(23,37,34,.15);padding-left:1.75rem}.ee-index>div:first-child{border-left:0;padding-left:0}}
.ee-article{font-size:clamp(1.02rem,1.25vw,1.14rem);line-height:1.9;color:rgba(23,37,34,.86)}
.ee-article:first-letter{font-family:var(--font-ee-display),serif;float:left;font-size:5.4em;line-height:.8;padding:.08em .12em 0 0;color:var(--ink)}
@media(min-width:1280px){.ee-article{columns:2;column-gap:3.5rem}}
.ee-frame{overflow:hidden;background:#d8cdb9;display:block}
.ee-frame.is-dark{background:#091513}
.ee-frame img{width:100%;height:100%;object-fit:cover;display:block}
.ee-pill{display:inline-flex;align-items:center;padding:9px 16px;font-size:11px;letter-spacing:.06em;border:1px solid rgba(23,37,34,.3);background:rgba(255,255,255,.35)}
.ee-linebtn{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 22px;border:1px solid var(--ink);font-size:10px;letter-spacing:.18em;text-transform:uppercase;transition:background .25s,color .25s}
.ee-linebtn:hover{background:var(--ink);color:var(--paper)}
.ee-leader{border-bottom:1px solid rgba(23,37,34,.12)}
.ee-dots{border-bottom:1px dotted rgba(23,37,34,.35);transform:translateY(-4px)}
.ee-map{filter:saturate(1.05)}
.ee-sig-icon{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:999px;border:1px solid color-mix(in srgb,var(--sp-accent) 55%,transparent);color:color-mix(in srgb,var(--sp-accent) 80%,#172522);transition:background .4s,color .4s,transform .5s cubic-bezier(.2,.7,.2,1)}
.ee-sig:hover .ee-sig-icon,.ee-spec:hover .ee-sig-icon{background:var(--sp-accent);color:var(--sp-on-accent);transform:rotate(-8deg) scale(1.06)}
@media(min-width:640px){.ee-sig-icon{width:46px;height:46px}}
.ee-sig{transition:background .4s}.ee-sig:hover{background:#fbf8f1}
.ee-inventory{columns:1;column-gap:3.5rem}
@media(min-width:768px){.ee-inventory{columns:2}}
@media(min-width:1280px){.ee-inventory{columns:3}}
.ee-inv-group{padding-top:1.25rem}
.ee-inv-head{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--ink);padding-bottom:.6rem;break-inside:avoid;break-after:avoid}
.ee-inv-group li{break-inside:avoid;border-bottom:1px solid rgba(23,37,34,.12);padding:.6rem 0;font-size:14.5px;line-height:1.35;color:rgba(23,37,34,.8)}
.ee-town-lede:first-letter{font-family:var(--font-ee-display),serif;float:left;font-size:4.6em;line-height:.8;padding:.06em .12em 0 0;color:var(--ee-gold)}
.ee-on-deep{color:var(--paper)}
.ee-aperture-window{position:relative;aspect-ratio:4/3;overflow:hidden;clip-path:inset(16% 22% 16% 22%);transform:scale(.9) rotate(-2deg);transition:clip-path 1.4s cubic-bezier(.16,.78,.18,1),transform 1.4s cubic-bezier(.16,.78,.18,1)}
.ee-aperture.is-visible .ee-aperture-window{clip-path:inset(0);transform:none}
.ee-aperture-window img{width:100%;height:100%;object-fit:cover;transform:scale(1.18);transition:transform 1.8s cubic-bezier(.16,.78,.18,1)}
.ee-aperture.is-visible .ee-aperture-window img{transform:scale(1)}
.ee-reveal{opacity:0;transform:translateY(28px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
.ee-reveal.is-visible{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.ee-reveal{opacity:1;transform:none;transition:none}.ee-cover-title,.ee-menu{animation:none}.ee-aperture-window{clip-path:none;transform:none}.ee-aperture-window img{transform:none}}
`
