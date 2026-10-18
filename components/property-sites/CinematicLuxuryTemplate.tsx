'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Cormorant_Garamond, Inter_Tight } from 'next/font/google'
import {
  ArrowRight, ArrowUpRight, Box, CalendarDays, Check, Download, Expand,
  FileText, GraduationCap, Grid3x3, Home, Mail, MapPin, Menu, Navigation, Phone, Play, Quote,
  Share2, Sparkles, Star, Trees, Users, X,
} from 'lucide-react'
import ExploreNearby from '@/components/website-public/ExploreNearby'
import MlsDisclaimer from '@/components/property-sites/MlsDisclaimer'
import SpotlightViewBeacon from '@/components/property-sites/SpotlightViewBeacon'
import FormQrCode from '@/components/forms/FormQrCode'
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
import { groupSpecs, prettyFeature, splitFeatures } from './spotlight/features'
import { AddToCalendar, AgentActions, MobileActionBar, SpotlightJsonLd } from './spotlight/Widgets'
import {
  buildSpotlight, excerpt, fitLine, fmtCompactMoney, fmtPhone, fmtDay, fmtMoney, fmtNumber, fmtTimeRange, openLeadForm, parseDay,
  scrollToId, STATUS_COLORS, type PropertySiteAgent, type PropertySiteChapter, type SpotlightModel,
} from './spotlight/model'
import { onAccent, usableAccent } from './spotlight/tone'

// Types + helpers now live in ./spotlight/model (shared with EditorialEstateTemplate); re-exported
// here because the public site renderer imports the resolve type from this module.
export type {
  PropertySiteAgent, PropertySiteChapter, PropertySiteResolveResponse,
} from './spotlight/model'
import type { PropertySiteResolveResponse } from './spotlight/model'

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600'], style: ['normal', 'italic'], variable: '--font-cl-display' })
const sans = Inter_Tight({ subsets: ['latin'], variable: '--font-cl-sans' })

const GOLD = '#C9A24D'

interface NavItem { id: string; label: string; show: boolean }

// Luxe (template id cinematic_luxury) - the dark, full-bleed, film-title-sequence Spotlight
// template dressed in the OpenHousePal Luxe language: a gold frame that draws itself around the
// header, a light leak and drifting sparks on entry, a gold glint through the street name, gold
// seams between sections and a gold reading line along the top. Every section
// below only renders when the listing actually has content for it (see buildSpotlight's `has`),
// so a manual listing with three photos and no description still reads as a finished page.
export default function CinematicLuxuryTemplate({ data, publicUrl }: { data: PropertySiteResolveResponse; publicUrl: string }) {
  const m = useMemo(() => buildSpotlight(data), [data])
  const { p, has } = m
  const accent = usableAccent(data.brand_kit?.secondary_color, GOLD, 'dark')
  const rootRef = useRef<HTMLDivElement>(null)
  const heroImgRef = useRef<HTMLDivElement>(null)
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number; title: string } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const closeShare = useCallback(() => setShareOpen(false), [])
  const openPhotos = useCallback((index = 0, photos = m.photos, title = p.address) => {
    if (photos.length) setLightbox({ photos, index, title })
  }, [m.photos, p.address])

  useCinematicMotion(rootRef, heroImgRef)

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'photos', label: 'Photos', show: has.gallery },
    { id: 'features', label: 'Features', show: has.features },
    { id: 'video', label: 'Film', show: has.video },
    { id: 'tour', label: '3D Tour', show: has.tour },
    { id: 'floor-plans', label: 'Floor Plans', show: has.floorPlans },
    { id: 'details', label: 'Details', show: has.details },
    { id: 'town', label: 'The Town', show: has.town },
    { id: 'location', label: 'Location', show: has.location },
    { id: 'open-houses', label: 'Open House', show: has.openHouses },
    { id: 'contact', label: 'Contact', show: true },
  ]
  const allowTour = !m.status || m.status.forSale

  return (
    <div
      ref={rootRef}
      className={`cl ${display.variable} ${sans.variable} bg-[#0A0A0A] text-white`}
      style={{ ['--sp-accent' as string]: accent, ['--sp-on-accent' as string]: onAccent(accent) }}
    >
      <style>{CL_CSS}</style>
      <ScrollGoldLine />
      <SpotlightViewBeacon siteId={data.site_id} />
      <SpotlightJsonLd m={m} url={publicUrl} />

      <NavBar items={navItems} m={m} logoUrl={data.brand_kit?.logo_url} onShare={() => setShareOpen(true)} allowTour={allowTour} />
      <Hero m={m} imgRef={heroImgRef} onPhotos={() => openPhotos(0)} allowTour={allowTour} />
      {has.openHouses && m.nextOpenHouse && <OpenHouseRibbon m={m} url={publicUrl} />}

      {has.story && <StorySection m={m} />}
      <AtAGlance m={m} />
      {has.gallery && <GallerySection m={m} onOpen={openPhotos} />}
      {has.features && <FeaturesSection m={m} />}
      {has.chapters && <ChaptersSection chapters={m.chapters} onOpen={(photos, i, title) => openPhotos(i, photos, title)} />}
      {has.video && data.video?.url && <VideoSection url={data.video.url} poster={m.heroImage} />}
      {has.tour && <VirtualTourSection url={m.tourUrl} poster={m.photos[2] || m.heroImage} />}
      {has.floorPlans && <FloorPlansSection plans={m.floorPlans} onZoom={(i) => openPhotos(i, m.floorPlans.map(f => f.image_url), 'Floor plans')} />}
      {has.details && <DetailsSection m={m} />}
      {has.town && <TownSection m={m} />}
      {has.location && <LocationSection m={m} />}
      {has.nearby && m.p.latitude != null && m.p.longitude != null && (
        // Dark variant so it sits in the page's own palette - collapses to nothing (see .cl-nearby
        // in CL_CSS) when Explore Nearby decides it's unavailable and renders null.
        <section className="cl-nearby">
          <ExploreNearby
            siteId={data.site_id}
            kind="property_site"
            title="The Neighborhood"
            originLabel={p.address}
            origin={{ lat: m.p.latitude, lng: m.p.longitude }}
            theme={{ primary_color: '#111111', secondary_color: accent, heading_font: 'serif', body_font: 'sans', logo_url: data.brand_kit?.logo_url || null }}
            variant="dark"
          />
        </section>
      )}
      {has.payment && p.price && <PaymentSection m={m} />}
      {has.openHouses && <OpenHousesSection m={m} url={publicUrl} />}
      {has.documents && <DocumentsSection documents={m.documents} />}
      {has.agents && <AgentsSection m={m} url={publicUrl} signatureSlug={has.signature ? data.signature_hub_slug || null : null} />}
      {m.show('guest_tools') && <GuestTools m={m} siteId={data.site_id} url={publicUrl} tone="dark" />}
      <ContactSection m={m} siteId={data.site_id} url={publicUrl} onShare={() => setShareOpen(true)} allowTour={allowTour} />
      <SiteFooter m={m} navItems={navItems} />

      <MobileActionBar agent={m.agent} price={p.price} tone="dark" allowTour={allowTour} />
      <Lightbox
        photos={lightbox?.photos || []}
        index={lightbox ? lightbox.index : null}
        title={lightbox?.title || p.address}
        onClose={() => setLightbox(null)}
        onIndex={(i) => setLightbox(l => (l ? { ...l, index: i } : l))}
      />
      <ShareSheet open={shareOpen} onClose={closeShare} url={publicUrl} title={m.fullAddress} tone="dark" />
    </div>
  )
}

// ---------- motion ----------

function useCinematicMotion(rootRef: React.RefObject<HTMLDivElement | null>, heroImgRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    // React (Strict Mode, dev only) mounts -> cleans up -> mounts again synchronously, but these
    // dynamic imports resolve on a later microtask. `cancelled` makes the stale (first) mount's
    // callback bail before ever creating its context - otherwise both mounts register a full
    // duplicate set of ScrollTriggers on the same nodes and fight each other.
    let cancelled = false
    let ctx: any
    let removeLoad: (() => void) | undefined
    let io: IntersectionObserver | undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = rootRef.current
    if (!root) return
    if (reduced) { root.classList.add('cl-static'); return }
    import('gsap').then(async ({ default: gsap }) => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)
      ctx = gsap.context(() => {
        if (heroImgRef.current) {
          gsap.fromTo(heroImgRef.current, { scale: 1, yPercent: 0 }, {
            scale: 1.12, yPercent: 8, ease: 'none',
            scrollTrigger: { trigger: heroImgRef.current.parentElement, start: 'top top', end: 'bottom top', scrub: 0.5 },
          })
          gsap.to('.cl-hero-copy', {
            opacity: 0, y: -60, ease: 'none',
            scrollTrigger: { trigger: heroImgRef.current.parentElement, start: '30% top', end: '85% top', scrub: 0.5 },
          })
        }
        // Explicit end values (fromTo, not from): the CTA buttons carry a CSS opacity transition,
        // so a .from() could read a half-faded value as the "end" and leave them invisible.
        const shown = { opacity: 1, y: 0, clearProps: 'opacity,transform' }
        gsap.timeline({ defaults: { ease: 'power3.out' } })
          .fromTo('.cl-hero-chip', { opacity: 0, y: 14 }, { ...shown, duration: 0.7, stagger: 0.08 }, 0.2)
          .fromTo('.cl-hero-line', { opacity: 0, yPercent: 60 }, { opacity: 1, yPercent: 0, clearProps: 'opacity,transform', duration: 1.1, stagger: 0.1 }, 0.3)
          .fromTo('.cl-hero-rule', { scaleX: 0 }, { scaleX: 1, transformOrigin: '0% 50%', duration: 1.4, ease: 'power3.inOut' }, 0.6)
          .fromTo('.cl-hero-facts > *', { opacity: 0, y: 18 }, { ...shown, duration: 0.7, stagger: 0.06 }, 0.8)

        // Reveals fire from an IntersectionObserver, not ScrollTrigger start points: those are
        // measured once, and lazy photos loading later shift the page, which left whole sections
        // (e.g. Features) stuck invisible. The observer always sees the element's real position.
        const reveal = (el: Element) => {
          if (el.classList.contains('cl-stagger')) gsap.to(el.children, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.07 })
          else gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' })
        }
        io = new IntersectionObserver(entries => entries.forEach(e => {
          if (!e.isIntersecting) return
          io?.unobserve(e.target)
          reveal(e.target)
        }), { rootMargin: '0px 0px -10% 0px' })
        gsap.utils.toArray<HTMLElement>('.cl-reveal').forEach(el => { gsap.set(el, { opacity: 0, y: 40 }); io!.observe(el) })
        gsap.utils.toArray<HTMLElement>('.cl-stagger').forEach(el => { gsap.set(el.children, { opacity: 0, y: 28 }); io!.observe(el) })
        gsap.utils.toArray<HTMLElement>('.cl-parallax').forEach(el => {
          gsap.fromTo(el, { yPercent: -6, scale: 1.1 }, {
            yPercent: 6, scale: 1.02, ease: 'none',
            scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
          })
        })
        gsap.utils.toArray<HTMLElement>('.cl-wipe').forEach(el => {
          gsap.fromTo(el, { clipPath: 'inset(12% 8% 12% 8%)' }, {
            clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: 0.6 },
          })
        })
      }, root)
      // Remote photos can still be decoding when ScrollTrigger first measures section heights -
      // refresh once everything has loaded so triggers below a tall image aren't computed stale.
      const onLoad = () => ScrollTrigger.refresh()
      window.addEventListener('load', onLoad)
      // ...and again whenever the page's height changes (lazy photos, fonts), debounced.
      let t: ReturnType<typeof setTimeout> | undefined
      const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(onLoad, 150) })
      ro.observe(root)
      removeLoad = () => { window.removeEventListener('load', onLoad); ro.disconnect(); clearTimeout(t) }
      if (document.readyState === 'complete') setTimeout(onLoad, 200)
    })
    return () => {
      cancelled = true
      removeLoad?.()
      io?.disconnect()
      ctx?.revert?.()
    }
  }, [rootRef, heroImgRef])
}

// ---------- chrome ----------

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  const key = ids.join('|')
  useEffect(() => {
    const els = key.split('|').map(id => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) })
    }, { rootMargin: '-40% 0px -55% 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [key])
  return active
}

function Monogram({ agent, size = 36 }: { agent?: PropertySiteAgent; size?: number }) {
  const initials = (agent?.name || 'Listing').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  if (agent?.photo_url) {
    return <img src={agent.photo_url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover ring-1 ring-white/25" />
  }
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.34 }} className="sp-display flex shrink-0 items-center justify-center rounded-full border border-[color:var(--sp-accent)] text-[color:var(--sp-accent)]">
      {initials}
    </span>
  )
}

function NavBar({ items, m, logoUrl, onShare, allowTour }: { items: NavItem[]; m: SpotlightModel; logoUrl?: string | null; onShare: () => void; allowTour: boolean }) {
  const [solid, setSolid] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const visible = items.filter(i => i.show)
  const active = useScrollSpy(visible.map(i => i.id))
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [menuOpen])
  const goTo = (id: string) => { setMenuOpen(false); scrollToId(id) }
  const desktopItems = visible.filter(i => i.id !== 'overview').slice(0, 7)

  return (
    <>
      <nav className={`fixed inset-x-0 top-0 z-[90] transition-all duration-500 ${solid ? 'border-b border-white/[0.07] bg-[#0A0A0A]/80 ' : 'bg-gradient-to-b from-black/60 to-transparent'}`}>
        <div className={`flex w-full items-center justify-between gap-4 px-5 transition-all duration-500 sm:px-10 xl:px-14 ${solid ? 'h-16' : 'h-20'}`}>
          <button onClick={() => goTo('overview')} className="flex min-w-0 items-center gap-3 text-left" aria-label="Back to top">
            {/* The agent - photo, name, brokerage - on every screen (user, 10/17: phones showed only
                a logo). A brokerage logo sits beside them on big screens. */}
            <Monogram agent={m.agent} size={38} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium leading-tight">{m.agent?.name || p0(m.p.address)}</span>
              {m.agent?.brokerage && <span className="truncate text-[11px] leading-tight text-white/55">{m.agent.brokerage}</span>}
            </span>
            {logoUrl && <img src={logoUrl} alt={m.agent?.brokerage || ''} className="ml-2 hidden h-7 max-w-[120px] shrink-0 border-l border-white/15 pl-4 object-contain brightness-0 invert lg:block" />}
          </button>

          <div className="hidden items-center gap-0.5 xl:flex">
            {desktopItems.map(i => (
              <button
                key={i.id} onClick={() => goTo(i.id)}
                className={`relative rounded-full px-3.5 py-2 text-[12px] font-medium tracking-wide transition ${active === i.id ? 'text-white' : 'text-white/60 hover:text-white'}`}
              >
                {i.label}
                <span className={`absolute inset-x-3.5 -bottom-0.5 h-px bg-[color:var(--sp-accent)] transition-transform duration-300 ${active === i.id ? 'scale-x-100' : 'scale-x-0'}`} />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onShare} className="rounded-full border border-white/15 p-2.5 text-white/80 transition hover:border-white/40 hover:text-white" aria-label="Share this home">
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => openLeadForm(allowTour ? 'tour' : 'info')}
              className="hidden rounded-full bg-[color:var(--sp-accent)] px-5 py-2.5 text-[12px] font-semibold tracking-wide text-[color:var(--sp-on-accent)] transition hover:brightness-110 sm:inline-flex"
            >
              {allowTour ? 'Book a tour' : 'Contact agent'}
            </button>
            <button onClick={() => setMenuOpen(true)} className="rounded-full border border-white/15 p-2.5 xl:hidden" aria-label="Open menu" aria-expanded={menuOpen}>
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {menuOpen && (
        <div className="cl-menu fixed inset-0 z-[150] flex flex-col bg-[#0A0A0A]/[0.98] px-6 pb-10 pt-5" role="dialog" aria-modal="true" aria-label="Site menu">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">{m.cityState || 'Menu'}</span>
            <button onClick={() => setMenuOpen(false)} className="rounded-full border border-white/15 p-2.5" aria-label="Close menu"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-10 flex flex-1 flex-col gap-1 overflow-y-auto">
            {visible.map((i, n) => (
              <button key={i.id} onClick={() => goTo(i.id)} className="group flex items-baseline gap-4 py-2 text-left">
                <span className="w-6 text-[11px] tabular-nums text-white/35">{String(n + 1).padStart(2, '0')}</span>
                <span className={`sp-display text-4xl leading-tight transition ${active === i.id ? 'text-[color:var(--sp-accent)]' : 'text-white group-hover:text-[color:var(--sp-accent)]'}`}>{i.label}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {m.agent?.phone ? (
              <a href={`tel:${m.agent.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 py-3.5 text-sm font-medium"><Phone className="h-4 w-4" /> Call</a>
            ) : (
              <button onClick={() => { setMenuOpen(false); onShare() }} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 py-3.5 text-sm font-medium"><Share2 className="h-4 w-4" /> Share</button>
            )}
            <button onClick={() => { setMenuOpen(false); openLeadForm(allowTour ? 'tour' : 'info') }} className="rounded-full bg-[color:var(--sp-accent)] py-3.5 text-sm font-semibold text-[color:var(--sp-on-accent)]">
              {allowTour ? 'Book a tour' : 'Contact'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function p0(address: string) { return address.split(',')[0] }

function StatusPill({ m }: { m: SpotlightModel }) {
  if (!m.status) return null
  const c = STATUS_COLORS[m.status.kind]
  return (
    <span className="cl-hero-chip inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] ">
      <span className="relative flex h-2 w-2">
        {m.status.kind === 'active' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: c.dot }} />}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: c.dot }} />
      </span>
      {m.status.label}
    </span>
  )
}

// ---------- luxe layer ----------

// Thin gold line along the very top that fills as the visitor reads down the page.
function ScrollGoldLine() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = 0
      const el = ref.current
      if (!el) return
      const max = document.documentElement.scrollHeight - window.innerHeight
      el.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick) }
    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])
  return <div ref={ref} aria-hidden className="cl-progress pointer-events-none fixed inset-x-0 top-0 z-[95] h-[2px] origin-left" style={{ transform: 'scaleX(0)' }} />
}

const LUXE_SPARKS: [string, string, number, number][] = [
  ['12%', '62%', 0, 7], ['24%', '38%', 1.6, 9], ['41%', '70%', 3.1, 8], ['58%', '30%', 0.8, 10],
  ['72%', '58%', 2.4, 7.5], ['86%', '40%', 4.2, 9], ['93%', '72%', 1.1, 8.5], ['6%', '28%', 3.6, 9.5],
]

// The entry: a gold frame draws itself around the header, a warm light leak sweeps across
// once, and a few gold sparks drift up through the photo. All decorative, all pointer-free.
function LuxeHeroDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
      <div className="cl-leak absolute inset-0" />
      <div className="cl-frame absolute inset-3 sm:inset-5">
        <span className="cl-frame-t" /><span className="cl-frame-r" /><span className="cl-frame-b" /><span className="cl-frame-l" />
        <span className="cl-corner left-0 top-0 border-l border-t" /><span className="cl-corner right-0 top-0 border-r border-t" />
        <span className="cl-corner bottom-0 left-0 border-b border-l" /><span className="cl-corner bottom-0 right-0 border-b border-r" />
      </div>
      {LUXE_SPARKS.map(([l, t, d, dur], k) => (
        <span key={k} className="cl-spark absolute" style={{ left: l, top: t, animationDelay: `${d + 1.2}s`, animationDuration: `${dur}s` }} />
      ))}
      <div className="cl-vignette absolute inset-0" />
    </div>
  )
}

// ---------- hero ----------

function Hero({ m, imgRef, onPhotos, allowTour }: { m: SpotlightModel; imgRef: React.RefObject<HTMLDivElement | null>; onPhotos: () => void; allowTour: boolean }) {
  const { p } = m
  const facts = [
    p.beds != null && { v: fmtNumber(p.beds), l: p.beds === 1 ? 'Bed' : 'Beds' },
    p.baths != null && { v: fmtNumber(p.baths), l: p.baths === 1 ? 'Bath' : 'Baths' },
    p.sqft && { v: fmtNumber(p.sqft), l: 'Sq Ft' },
    p.lot_size_acres && { v: fmtNumber(p.lot_size_acres), l: 'Acres' },
  ].filter(Boolean) as { v: string; l: string }[]
  // The street always stays on one line - sized to its length (fitLine) rather than wrapping.
  const street = p0(p.address)
  const oh = m.nextOpenHouse
  return (
    <section id="overview" className="relative flex h-[100svh] min-h-[640px] w-full flex-col overflow-hidden bg-[#0A0A0A]">
      <div ref={imgRef} className="absolute inset-0 will-change-transform">
        {m.heroImage ? (
          <HeroMedia hero={m.heroImage} photos={m.photos} mode={m.header.mode} motion={m.header.motion} videoUrl={m.header.videoUrl} videoPoster={m.header.videoPoster} frame={m.header.frame} alt={m.fullAddress} />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_30%_20%,#2a2419_0%,#0A0A0A_60%)]" />
        )}
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.55)_0%,rgba(0,0,0,.05)_28%,rgba(0,0,0,.15)_55%,rgba(10,10,10,.96)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_100%,rgba(0,0,0,.55),transparent_60%)]" />
      <LuxeHeroDecor />

      <div className="cl-hero-copy relative flex w-full flex-1 flex-col justify-end px-5 pb-8 [container-type:inline-size] sm:px-10 sm:pb-10 xl:px-14">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill m={m} />
          {m.reduction && (
            <span className="cl-hero-chip inline-flex items-center gap-1.5 rounded-full bg-[color:var(--sp-accent)] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sp-on-accent)]">
              Price improved {fmtCompactMoney(m.reduction)}
            </span>
          )}
          {oh && <OpenHouseChip oh={oh} onClick={() => scrollToId('open-houses')} className="cl-hero-chip rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:bg-white/20" />}
        </div>
        {m.cityState && <p className="cl-hero-chip mt-3 text-[10px] font-medium sm:mt-6 sm:text-[11px] uppercase tracking-[0.42em] text-white/70">{[p.city, p.state, p.zipcode].filter(Boolean).join(' · ')}</p>}
        <h1 className="sp-display mt-3 font-light leading-[0.9] tracking-[-0.02em]" style={fitLine(street, '8.4rem', 185)}>
          <span className="block overflow-hidden pb-[0.06em]"><span className="cl-hero-line cl-glint block">{street}</span></span>
        </h1>

        <div className="relative mt-4 flex flex-col gap-3.5 pt-4 sm:mt-8 sm:gap-6 sm:pt-6 lg:flex-row lg:items-end lg:justify-between">
          <span className="cl-hero-rule absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color:var(--sp-accent)] via-white/25 to-white/5" />
          <div className="cl-hero-facts flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:gap-x-8">
            {fmtMoney(p.price) && (
              <div>
                {/* Sold: the status pill above already says it (user, 10/18: two "Sold"s). */}
                {m.status?.kind !== 'sold' && <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/50">Offered at</p>}
                <p className="cl-gold-text sp-display mt-1 text-[2rem] font-normal leading-none tabular-nums sm:text-5xl">{fmtMoney(p.price)}</p>
              </div>
            )}
            {facts.length > 0 && (
              // Phones: one quiet line under the price, so the address can sit low over the photo
              // (user, 10/17: the big spread-out numbers pushed everything up).
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/75 sm:hidden">
                {facts.map(f => `${f.v} ${f.l}`).join('  ·  ')}
              </p>
            )}
            {facts.length > 0 && (
              // Wider: each stat after the price, ruled off.
              <div className="hidden sm:flex sm:gap-x-8">
                {facts.map((f, i) => (
                  <div key={f.l} className={`border-white/15 sm:border-l sm:pl-8 ${i ? 'border-l pl-3' : ''}`}>
                    <p className="sp-display text-[1.4rem] leading-none tabular-nums sm:text-4xl"><CountUp value={f.v} /></p>
                    <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.22em] text-white/55 sm:text-[10px] sm:tracking-[0.28em]">{f.l}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="cl-hero-facts flex gap-2 sm:flex-wrap sm:gap-2.5">
            <button onClick={() => openLeadForm(allowTour ? 'tour' : 'info')} className="cl-cta group relative inline-flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-[color:var(--sp-accent)] px-4 py-3 text-[13px] font-semibold sm:flex-none sm:px-6 sm:py-3.5 sm:text-sm text-[color:var(--sp-on-accent)] shadow-[0_18px_40px_-14px_color-mix(in_srgb,var(--sp-accent)_80%,transparent)] transition hover:-translate-y-0.5 hover:brightness-110">
              {allowTour ? 'Book a private tour' : 'Ask about this home'} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
            {m.photos.length > 1 && (
              <button onClick={onPhotos} className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/25 bg-black/20 px-4 py-3 text-[13px] font-medium transition hover:border-white/60 sm:px-6 sm:py-3.5 sm:text-sm">
                <Grid3x3 className="h-4 w-4" /> {m.photos.length} photos
              </button>
            )}
          </div>
        </div>
      </div>
      <StatsMarquee m={m} />
    </section>
  )
}

// Rolls a hero stat up from zero once the intro has started ("8,468" keeps its commas, "8.5" its
// decimal). Server-rendered as the real value, so no-JS / reduced-motion visitors see it as is.
function CountUp({ value, delay = 900, ms = 1600 }: { value: string; delay?: number; ms?: number }) {
  const target = Number(value.replace(/,/g, ''))
  const decimals = (value.split('.')[1] || '').length
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (!Number.isFinite(target) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    setShown(fmt(0))
    let raf = 0
    const t = window.setTimeout(() => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms)
        setShown(fmt(target * (1 - Math.pow(1 - k, 4))))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => { clearTimeout(t); cancelAnimationFrame(raf) }
  }, [target, decimals, delay, ms])
  return <>{shown}</>
}

function OpenHouseRibbon({ m, url }: { m: SpotlightModel; url: string }) {
  const oh = m.nextOpenHouse!
  return (
    <div className="relative z-10 border-y border-[color:color-mix(in_srgb,var(--sp-accent)_30%,transparent)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--sp-accent)_22%,#0A0A0A),#0A0A0A_70%)]">
      <div className="flex w-full flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10 xl:px-14">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[color:var(--sp-accent)]">Open house</span>
          <span className="sp-display text-2xl leading-none">{fmtDay(oh.date)}</span>
          {fmtTimeRange(oh.start_time, oh.end_time) && <span className="text-sm text-white/70">{fmtTimeRange(oh.start_time, oh.end_time)}</span>}
          {m.openHouses.length > 1 && <button onClick={() => scrollToId('open-houses')} className="text-xs text-white/50 underline underline-offset-4 hover:text-white">+{m.openHouses.length - 1} more date{m.openHouses.length > 2 ? 's' : ''}</button>}
        </p>
        <AddToCalendar openHouse={oh} address={m.p.address} fullAddress={m.fullAddress} url={url} agentName={m.agent?.name} tone="dark" />
      </div>
    </div>
  )
}

// Two-row ambient ticker: Row 1 is hard structured facts (never a placeholder), Row 2 the agent's
// own highlights. Pure CSS loop (see .animate-marquee-x-slow in globals.css).
function StatsMarquee({ m }: { m: SpotlightModel }) {
  const row1 = m.marqueeFacts
  // Row 2 is the agent's own highlights - without any, a lone repeated place name reads as filler.
  const row2 = m.highlights.length ? [...m.highlights, ...(m.p.city ? [[m.p.city, m.p.county].filter(Boolean).join(' · ')] : [])] : []
  if (row1.length < 3) return null
  return (
    // Solid bottom edge + 1px overlap: a blurred bar touching the hero's bottom let a hairline of the
    // photo bleed through under it (worst in the shrunk editor previews).
    <div className="cl-mq relative z-10 -mb-px w-full shrink-0 overflow-hidden border-b-2 border-b-[#0A0A0A] bg-[#0A0A0A] py-2.5 sm:bg-transparent sm:bg-gradient-to-b sm:from-black/45 sm:to-black/70 sm:py-4" aria-hidden>
      <span className="cl-mq-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
      <div className="cl-mq-a">
        <div className="flex w-max animate-marquee-x-slow will-change-transform">
          {[...row1, ...row1, ...row1, ...row1].map((item, i) => (
            <span key={i} className="flex shrink-0 items-center whitespace-nowrap px-5 text-[10px] font-medium uppercase tracking-[0.28em] text-white/85 sm:px-7 sm:text-[11px] sm:tracking-[0.3em]">
              {item}<span className="ml-10 h-1 w-1 sm:ml-14 rotate-45 bg-[color:var(--sp-accent)]" />
            </span>
          ))}
        </div>
      </div>
      {row2.length > 0 && (
        <div className="cl-mq-b mt-1 sm:mt-2">
          <div className="flex w-max animate-marquee-x-reverse-slow will-change-transform">
            {[...row2, ...row2, ...row2, ...row2].map((item, i) => (
              <span key={i} className="sp-display shrink-0 whitespace-nowrap px-5 text-[15px] italic sm:px-6 sm:text-lg text-[color:color-mix(in_srgb,var(--sp-accent)_80%,white)]">{item}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- sections ----------

function Section({ id, eyebrow, title, intro, children, className = '', wide = false }: {
  id?: string; eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; children: React.ReactNode; className?: string; wide?: boolean
}) {
  return (
    <section id={id} className={`scroll-mt-16 px-5 py-24 sm:px-10 sm:py-32 ${className}`}>
      <div className={`mx-auto ${wide ? 'max-w-[1440px]' : 'max-w-6xl'}`}>
        <div className="cl-reveal mb-12 grid gap-5 sm:mb-16 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-[color:var(--sp-accent)]">
              <span className="cl-rule h-px w-8 bg-[color:var(--sp-accent)]" /> {eyebrow}
            </p>
            <h2 className="sp-display mt-4 text-[clamp(2.4rem,5vw,4.4rem)] font-light leading-[0.98] tracking-[-0.015em]">{title}</h2>
          </div>
          {intro && <div className="text-[15px] leading-relaxed text-white/55 lg:pb-2">{intro}</div>}
        </div>
        {children}
      </div>
    </section>
  )
}

// Long MLS descriptions arrive as one block - regroup them into short paragraphs for reading.
function storyParagraphs(text: string): string[] {
  const given = text.split(/\n\s*\n|\n/).map(t => t.trim()).filter(Boolean)
  if (given.length > 1) return given
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(t => t.trim()).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (const sn of sentences) {
    if (cur && (cur.length + sn.length > 420)) { out.push(cur); cur = '' }
    cur = cur ? `${cur} ${sn}` : sn
  }
  if (cur) out.push(cur)
  return out
}

// The first sentence or two - never more than a short paragraph.
function storyExcerpt(text: string): string {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).filter(Boolean)
  let out = ''
  for (const sn of sentences) {
    if (out && out.length + sn.length > 300) break
    out = out ? `${out} ${sn}` : sn
  }
  if (out.length > 340) out = `${out.slice(0, 320).replace(/\s+\S*$/, '')}…`
  return out
}

function StorySection({ m }: { m: SpotlightModel }) {
  const [reading, setReading] = useState(false)
  const close = useCallback(() => setReading(false), [])
  useModalLock(reading, close)
  const excerpt = storyExcerpt(m.description)
  const more = m.description.replace(/\s+/g, ' ').length > excerpt.length + 20
  const paragraphs = useMemo(() => storyParagraphs(m.description), [m.description])
  const minutes = Math.max(1, Math.round(m.description.split(/\s+/).length / 220))
  const photo = m.storyPhoto
  const street = p0(m.p.address)
  return (
    <section id="story" className="relative scroll-mt-16 overflow-hidden px-5 py-24 sm:px-10 sm:py-32">
      <div className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--sp-accent)_10%,transparent),transparent_70%)]" />
      <div className={`relative mx-auto grid max-w-[1440px] items-center gap-12 ${photo ? 'lg:grid-cols-12 lg:gap-20' : ''}`}>
        <div className={`cl-reveal ${photo ? 'lg:col-span-5' : 'max-w-3xl'}`}>
          <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-[color:var(--sp-accent)]">
            <span className="h-px w-8 bg-[color:var(--sp-accent)]" /> The residence
          </p>
          {/* "Inside" on its own line and the street kept whole beneath it - it used to break
              mid-address ("Inside 239 / Windham Dr."). */}
          <h2 className="sp-display mt-5 font-light leading-[1.02] tracking-[-0.015em]">
            <span className="block text-[clamp(1.6rem,2.6vw,2.4rem)] text-white/60">Inside</span>
            <em className="mt-1 block text-balance text-[clamp(2.3rem,4.2vw,4rem)] italic text-white/90">{street}.</em>
          </h2>
          <p className="cl-prose mt-7 text-[17px] leading-[1.8] text-white/70 sm:text-[18px]">{excerpt}</p>
          {more && (
            <button onClick={() => setReading(true)} className="group mt-8 inline-flex items-center gap-3 text-sm font-medium text-white">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--sp-accent)] text-[color:var(--sp-accent)] transition group-hover:bg-[color:var(--sp-accent)] group-hover:text-[color:var(--sp-on-accent)]">
                <ArrowRight className="h-4 w-4" />
              </span>
              <span>Read the full story <span className="ml-1 text-white/40">· {minutes} min</span></span>
            </button>
          )}
        </div>
        {photo && (
          <figure className="cl-reveal lg:col-span-7">
            <div className="cl-wipe relative aspect-[4/3] overflow-hidden">
              <img src={photo} alt={m.p.address} loading="lazy" className="cl-parallax h-full w-full object-cover" />
            </div>
            {m.cityState && (
              <figcaption className="mt-4 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.35em] text-white/40">
                <span className="h-px w-10 bg-[color:var(--sp-accent)]" /> {m.cityState}
              </figcaption>
            )}
          </figure>
        )}
      </div>

      {reading && (
        <div className="fixed inset-0 z-[120] flex justify-end" role="dialog" aria-modal="true" aria-label="The full story">
          <button className="cl-menu absolute inset-0 bg-black/70 " onClick={close} aria-label="Close" />
          <article className="cl-drawer relative h-full w-full max-w-[640px] overflow-y-auto bg-[#0d0d0d] shadow-[-40px_0_80px_-20px_rgba(0,0,0,.8)]">
            {photo && (
              <div className="relative h-56 overflow-hidden sm:h-72">
                <img src={photo} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] to-transparent" />
              </div>
            )}
            <button onClick={close} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:border-white/60" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <div className="px-6 pb-16 sm:px-12">
              <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-[color:var(--sp-accent)]">
                <span className="h-px w-8 bg-[color:var(--sp-accent)]" /> The full story
              </p>
              <h3 className="sp-display mt-4 text-4xl font-light leading-none">{street}</h3>
              <div className="mt-8 space-y-6 text-[16px] leading-[1.85] text-white/70">
                {paragraphs.map((para, i) => (
                  <p key={i} className={i === 0 ? 'cl-prose text-white/80' : ''}>{para}</p>
                ))}
              </div>
              <button onClick={() => { close(); openLeadForm('info') }} className="mt-10 inline-flex items-center gap-2 rounded-full bg-[color:var(--sp-accent)] px-6 py-3.5 text-sm font-semibold text-[color:var(--sp-on-accent)] transition hover:brightness-110">
                Ask about this home <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}

function AtAGlance({ m }: { m: SpotlightModel }) {
  const { p } = m
  const stats = [
    p.beds != null && { v: fmtNumber(p.beds), l: 'Bedrooms' },
    p.baths != null && { v: fmtNumber(p.baths), l: 'Bathrooms' },
    p.sqft && { v: fmtNumber(p.sqft), l: 'Square feet' },
    p.lot_size_acres && { v: fmtNumber(p.lot_size_acres), l: 'Acres' },
    p.year_built && { v: String(p.year_built), l: 'Year built' },
    p.garage_spaces && { v: fmtNumber(p.garage_spaces), l: 'Garage spaces' },
  ].filter(Boolean) as { v: string; l: string }[]
  if (stats.length < 2) return null
  return (
    <section id="glance" className="border-y border-white/[0.07] bg-[#0d0d0d]">
      <div className={`cl-stagger mx-auto grid max-w-[1440px] grid-cols-2 gap-px bg-white/[0.07] sm:grid-cols-3 ${stats.length === 6 ? 'lg:grid-cols-6' : stats.length === 4 ? 'lg:grid-cols-4' : stats.length === 5 ? 'lg:grid-cols-5' : ''}`}>
        {stats.map(s => (
          <div key={s.l} className="bg-[#0d0d0d] px-4 py-10 sm:px-8 sm:py-14">
            <p className="sp-display text-5xl font-light leading-none tabular-nums sm:text-6xl">{s.v}</p>
            <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.3em] text-white/45">{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function GallerySection({ m, onOpen }: { m: SpotlightModel; onOpen: (i: number) => void }) {
  const photos = m.photos
  return (
    <section id="photos" className="scroll-mt-16 px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="cl-reveal mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-[color:var(--sp-accent)]">
              <span className="h-px w-8 bg-[color:var(--sp-accent)]" /> The gallery
            </p>
            <h2 className="sp-display mt-4 text-[clamp(2rem,4.4vw,3.6rem)] font-light leading-none tracking-[-0.015em] lg:whitespace-nowrap">
              Every room, <em className="italic text-white/80">in its best light.</em>
            </h2>
          </div>
          {photos.length > 1 && <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-white/45">{photos.length} photographs</p>}
        </div>
        <div className="cl-reveal">
          <PhotoShow photos={photos} alt={m.p.address} onOpen={onOpen} tone="dark" />
        </div>
        {photos.length > 1 && (
          <div className="mt-8 flex justify-center">
            <button onClick={() => onOpen(0)} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-medium transition hover:border-[color:var(--sp-accent)] hover:text-[color:var(--sp-accent)]">
              <Expand className="h-4 w-4" /> View all {photos.length} photos
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

const FEATURE_GROUPS: { key: keyof SpotlightModel['features']; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'interior', label: 'Interior', icon: Home },
  { key: 'exterior', label: 'Exterior', icon: Trees },
  { key: 'lifestyle', label: 'Lifestyle', icon: Sparkles },
  { key: 'community', label: 'Community', icon: Users },
  { key: 'other', label: 'Additional', icon: Star },
]

function FeaturesSection({ m }: { m: SpotlightModel }) {
  const split = splitFeatures(m.allFeatureTags, m.featured)
  const fit = split.signature.length >= 8 ? 8 : split.signature.length >= 6 ? 6 : split.signature.length >= 4 ? 4 : split.signature.length
  const signature = split.signature.slice(0, fit)
  const rest = [...split.rest, ...split.signature.slice(fit).map(x => x.label)]
  const total = m.allFeatureTags.length
  const cols = fit === 6 || fit === 3 ? 'lg:grid-cols-3' : fit === 2 ? 'lg:grid-cols-2' : fit === 1 ? '' : 'lg:grid-cols-4'
  return (
    <Section id="features" eyebrow="Features & amenities" title={<>Crafted <em className="italic text-white/80">in detail.</em></>}
      intro={total > 0 ? <><span className="sp-display mr-2 text-3xl text-[color:var(--sp-accent)]">{total}</span>details that set this home apart.</> : undefined}>
      {signature.length > 0 && (
        <div className={`cl-stagger mb-14 grid grid-cols-2 gap-2.5 sm:gap-3 ${cols} [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1`}>
          {signature.map(f => {
            const Icon = f.icon
            return (
              <div key={f.label} className="cl-sig group relative overflow-hidden rounded-[2px] border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-4 transition duration-500 hover:border-[color:color-mix(in_srgb,var(--sp-accent)_45%,transparent)] sm:p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--sp-accent)_45%,transparent)] text-[color:var(--sp-accent)] transition duration-500 group-hover:bg-[color:var(--sp-accent)] group-hover:text-[color:var(--sp-on-accent)] sm:h-12 sm:w-12"><Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.5} /></span>
                <p className="sp-display mt-5 text-[1.2rem] font-light leading-[1.1] text-white sm:mt-8 sm:text-[1.55rem]">{f.display}</p>
                <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-[color:var(--sp-accent)] transition duration-700 group-hover:scale-x-100" />
              </div>
            )
          })}
        </div>
      )}
      {m.featureQuotes.length > 0 && (
        <div className="cl-stagger mb-14 grid gap-4 md:grid-cols-2">
          {m.featureQuotes.slice(0, 4).map(h => (
            <figure key={h} className="group relative overflow-hidden rounded-[2px] border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-7 transition duration-500 hover:border-[color:color-mix(in_srgb,var(--sp-accent)_40%,transparent)]">
              <Quote className="absolute -right-2 -top-2 h-20 w-20 text-white/[0.04] transition duration-500 group-hover:text-[color:color-mix(in_srgb,var(--sp-accent)_10%,transparent)]" />
              <blockquote className="sp-display relative text-2xl font-light italic leading-snug text-white/90">&ldquo;{h}&rdquo;</blockquote>
            </figure>
          ))}
        </div>
      )}
      {rest.length > 0 && <FeatureRiver items={rest} />}
    </Section>
  )
}

// Everything beyond the signature items, shown nine at a time and slowly rotating through the
// rest (a soft staggered fade), so a visitor sees the whole list without a "+9 more" button.
// Pauses on hover; under reduced motion it's a plain full list.
function FeatureRiver({ items }: { items: string[] }) {
  const PAGE = 9
  const pages = Math.ceil(items.length / PAGE)
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [asList, setAsList] = useState(false)
  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])
  useEffect(() => {
    if (pages <= 1 || paused || reduced || asList) return
    const t = window.setTimeout(() => setPage(p => (p + 1) % pages), 4800)
    return () => window.clearTimeout(t)
  }, [page, pages, paused, reduced, asList])
  const shown = pages <= 1 || reduced || asList ? items : items.slice(page * PAGE, page * PAGE + PAGE)
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <ul key={asList ? 'all' : page} className="grid min-h-[168px] content-start gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((f, i) => (
          <li key={f} className="cl-feat-in flex items-start gap-2.5 border-b border-white/[0.06] pb-3 text-[15px] leading-snug text-white/80" style={{ animationDelay: `${i * 70}ms` }}>
            <span className="mt-2 h-1 w-1 shrink-0 rotate-45 bg-[color:var(--sp-accent)]" /> {prettyFeature(f)}
          </li>
        ))}
      </ul>
      {pages > 1 && !reduced && (
        <div className="mt-6 flex items-center gap-4">
          {!asList && (
            <div className="flex items-center gap-2" aria-hidden>
              {Array.from({ length: pages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`h-1 rounded-full transition-all duration-500 ${i === page ? 'w-10 bg-[color:var(--sp-accent)]' : 'w-4 bg-white/20 hover:bg-white/40'}`} tabIndex={-1} />
              ))}
            </div>
          )}
          <button onClick={() => setAsList(v => !v)} className="text-xs font-medium text-[color:var(--sp-accent)] hover:brightness-125">
            {asList ? 'Back to the rotating view' : `See all ${items.length} at once`}
          </button>
        </div>
      )}
    </div>
  )
}

// Agent-mapped room chapters - alternating full-height photo / copy spreads. Only enabled
// chapters with at least one photo reach here (see buildSpotlight).
function ChaptersSection({ chapters, onOpen }: { chapters: PropertySiteChapter[]; onOpen: (photos: string[], i: number, title: string) => void }) {
  return <RoomChapters chapters={chapters} onOpen={onOpen} tone="dark" labelClass="" />
}

function VideoSection({ url, poster }: { url: string; poster?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  return (
    <Section id="video" eyebrow="The film" title={<>See it <em className="italic text-white/80">in motion.</em></>} wide>
      <div className="cl-reveal relative aspect-video w-full overflow-hidden rounded-[2px] bg-black">
        {/* suppressHydrationWarning: some browser extensions inject attributes onto <video>. */}
        <video
          ref={ref} src={url} poster={poster || undefined} controls={playing} playsInline preload="metadata"
          className="h-full w-full object-cover" onPlay={() => setPlaying(true)} suppressHydrationWarning
        />
        {!playing && (
          <button onClick={() => { setPlaying(true); ref.current?.play().catch(() => {}) }} className="group absolute inset-0 flex items-center justify-center bg-black/30 transition hover:bg-black/20" aria-label="Play property film">
            <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-white/40 bg-white/10 transition duration-500 group-hover:scale-110">
              <span className="absolute inset-0 animate-ping rounded-full border border-white/20" />
              <Play className="ml-1 h-8 w-8 fill-white" />
            </span>
          </button>
        )}
      </div>
    </Section>
  )
}

function useModalLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [open, onClose])
}

function VirtualTourSection({ url, poster }: { url: string; poster?: string | null }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useModalLock(open, close)
  return (
    <Section id="tour" eyebrow="3D virtual tour" title={<>Walk through, <em className="italic text-white/80">from anywhere.</em></>} wide>
      <button onClick={() => setOpen(true)} className="cl-reveal group relative flex aspect-[21/9] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-[2px] bg-[#111]">
        {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-50 blur-[2px] transition duration-700 group-hover:scale-100 group-hover:opacity-60 group-hover:blur-0" />}
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
        <span className="relative flex flex-col items-center gap-4">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--sp-accent)] text-[color:var(--sp-on-accent)] shadow-2xl transition duration-500 group-hover:scale-110"><Box className="h-8 w-8" /></span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.35em]">Launch the tour</span>
        </span>
      </button>
      <p className="mt-4 text-center text-xs text-white/40">
        Opens full screen. <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-white">Open in a new tab</a>
      </p>
      {open && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="3D virtual tour">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs uppercase tracking-[0.3em] text-white/60">3D tour</span>
            <button onClick={close} className="rounded-full bg-white/10 p-2.5 hover:bg-white/20" aria-label="Close tour" autoFocus><X className="h-4 w-4" /></button>
          </div>
          <iframe src={url} title="3D virtual tour" className="w-full flex-1 border-0" allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen; vr" allowFullScreen />
        </div>
      )}
    </Section>
  )
}

function FloorPlansSection({ plans, onZoom }: { plans: { label: string; image_url: string }[]; onZoom: (i: number) => void }) {
  const [active, setActive] = useState(0)
  const plan = plans[active] || plans[0]
  return (
    <Section id="floor-plans" eyebrow="Floor plans" title={<>Every level, <em className="italic text-white/80">laid out.</em></>}>
      {plans.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2" role="tablist">
          {plans.map((pl, i) => (
            <button key={i} role="tab" aria-selected={active === i} onClick={() => setActive(i)}
              className={`rounded-full border px-5 py-2.5 text-xs font-medium tracking-wide transition ${active === i ? 'border-[color:var(--sp-accent)] bg-[color:var(--sp-accent)] text-[color:var(--sp-on-accent)]' : 'border-white/15 text-white/65 hover:border-white/40'}`}>
              {pl.label || `Level ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      <button onClick={() => onZoom(active)} className="cl-reveal group relative block w-full overflow-hidden rounded-[2px] bg-[#f5f3ee] p-6 sm:p-12" aria-label="Enlarge floor plan">
        <img src={plan.image_url} alt={plan.label || 'Floor plan'} className="mx-auto max-h-[70vh] w-auto object-contain mix-blend-multiply" />
        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white opacity-80 transition group-hover:opacity-100"><Expand className="h-3 w-3" /> Enlarge</span>
      </button>
    </Section>
  )
}

function DetailsSection({ m }: { m: SpotlightModel }) {
  const groups = groupSpecs(m.keyFacts)
  return (
    <Section id="details" eyebrow="Property details" title={<>The <em className="italic text-white/80">particulars.</em></>} wide
      intro={m.isMls ? 'Straight from the MLS record for this home.' : undefined}>
      <div className="cl-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(g => {
          const Icon = g.icon
          return (
            <div key={g.title} className="group rounded-[2px] border border-white/[0.08] bg-[#0f0f0f] p-7 transition duration-500 hover:border-[color:color-mix(in_srgb,var(--sp-accent)_35%,transparent)]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--sp-accent)_40%,transparent)] text-[color:var(--sp-accent)]"><Icon className="h-4 w-4" strokeWidth={1.6} /></span>
                <p className="sp-display text-2xl font-light">{g.title}</p>
              </div>
              <dl className="mt-5">
                {g.facts.map(f => (
                  <div key={f.label} className="flex items-baseline justify-between gap-6 border-t border-white/[0.07] py-3">
                    <dt className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.22em] text-white/45">{f.label}</dt>
                    <dd className="text-right text-[15px] text-white/90">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function TownSection({ m }: { m: SpotlightModel }) {
  const t = m.town!
  return (
    <TownFeature
      tone="cinematic"
      name={t.name}
      facts={t.facts}
      body={t.body}
      photo={t.photo}
      place={[['County', m.p.county], ['Township', m.p.township], ['School district', m.p.school_district_name]]}
      kicker={<p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-[color:var(--sp-accent)]"><span className="h-px w-8 bg-[color:var(--sp-accent)]" /> The town</p>}
      onExplore={m.has.nearby ? () => scrollToId('explore-nearby') : undefined}
    />
  )
}

function LocationSection({ m }: { m: SpotlightModel }) {
  const { p } = m
  return (
    <Section id="location" eyebrow="Location" title={<>{m.has.town ? <>On the <em className="italic text-white/80">map.</em></> : p.city ? <>Life in <em className="italic text-white/80">{p.city}.</em></> : 'Where you’ll live.'}</>} wide>
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="cl-reveal relative aspect-[16/11] overflow-hidden rounded-[2px] border border-white/[0.08] lg:aspect-auto lg:min-h-[480px]">
          <iframe title={`Map of ${m.fullAddress}`} src={m.mapEmbedUrl} loading="lazy" className="cl-map absolute inset-0 h-full w-full border-0" referrerPolicy="no-referrer-when-downgrade" />
        </div>
        <div className="cl-reveal flex flex-col">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-[color:var(--sp-accent)]" />
            <div>
              <p className="sp-display text-2xl leading-tight">{p.address}</p>
              <p className="mt-1 text-sm text-white/55">{[p.city, [p.state, p.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
            </div>
          </div>
          <dl className="mt-8 space-y-0">
            {[['Neighborhood', p.subdivision_name], ['County', p.county], ['Township', p.township], ['School district', p.school_district_name]].filter(([, v]) => v).map(([l, v]) => (
              <div key={l as string} className="flex justify-between gap-4 border-b border-white/[0.08] py-3.5">
                <dt className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">{l}</dt>
                <dd className="text-right text-sm text-white/85">{v}</dd>
              </div>
            ))}
          </dl>
          {m.schools.length > 0 && (
            <div className="mt-8">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/45"><GraduationCap className="h-3.5 w-3.5" /> Assigned schools</p>
              <ul className="mt-3 space-y-2.5">
                {m.schools.map(s => (
                  <li key={s.level} className="flex items-baseline justify-between gap-4 text-sm">
                    <span className="text-white/85">{s.name}</span><span className="shrink-0 text-xs text-white/40">{s.level}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-white/35">School assignments per the MLS; confirm enrollment with the district.</p>
            </div>
          )}
          <a href={m.directionsUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-medium transition hover:border-[color:var(--sp-accent)] hover:text-[color:var(--sp-accent)]">
            <Navigation className="h-4 w-4" /> Get directions
          </a>
        </div>
      </div>
    </Section>
  )
}

function PaymentSection({ m }: { m: SpotlightModel }) {
  return (
    <Section id="payment" eyebrow="Affordability" title={<>What it could <em className="italic text-white/80">cost monthly.</em></>} className="bg-[#0d0d0d]">
      <div className="cl-reveal rounded-[2px] border border-white/[0.08] bg-[#0A0A0A] p-6 sm:p-10">
        <PaymentEstimator price={m.p.price!} taxesMonthly={m.taxesMonthly} hoaMonthly={m.hoaMonthly} tone="dark" />
      </div>
    </Section>
  )
}

function OpenHousesSection({ m, url }: { m: SpotlightModel; url: string }) {
  return (
    <Section id="open-houses" eyebrow="Open house" title={<>Come see it <em className="italic text-white/80">in person.</em></>}
      intro="No appointment needed - just stop by. Can't make it? Book a private tour instead.">
      <div className="cl-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {m.openHouses.map((oh, i) => {
          const d = parseDay(oh.date)!
          return (
            <div key={oh.id || i} className="flex flex-col rounded-[2px] border border-white/[0.08] bg-[#0f0f0f] p-6">
              <div className="flex items-start gap-5">
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--sp-accent)]">{d.toLocaleDateString('en-US', { month: 'short' })}</p>
                  <p className="sp-display text-6xl font-light leading-none">{d.getDate()}</p>
                </div>
                <div className="pt-1">
                  <p className="sp-display text-2xl leading-tight">{d.toLocaleDateString('en-US', { weekday: 'long' })}</p>
                  <p className="mt-1 text-sm text-white/60">{fmtTimeRange(oh.start_time, oh.end_time) || 'Time to be announced'}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
                <AddToCalendar openHouse={oh} address={m.p.address} fullAddress={m.fullAddress} url={url} agentName={m.agent?.name} tone="dark" />
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function DocumentsSection({ documents }: { documents: { label: string; url: string }[] }) {
  return (
    <Section id="documents" eyebrow="Documents" title={<>Brochures &amp; <em className="italic text-white/80">disclosures.</em></>}>
      <div className="cl-stagger grid gap-3 sm:grid-cols-2">
        {documents.map((d, i) => (
          <a key={i} href={d.url} target="_blank" rel="noreferrer" className="group flex items-center gap-4 rounded-[2px] border border-white/[0.08] bg-[#0f0f0f] px-5 py-5 transition hover:border-[color:color-mix(in_srgb,var(--sp-accent)_50%,transparent)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 text-[color:var(--sp-accent)]"><FileText className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{d.label || 'Document'}</span>
              <span className="text-xs text-white/40">{/\.pdf($|\?)/i.test(d.url) ? 'PDF' : 'Opens in a new tab'}</span>
            </span>
            <Download className="h-4 w-4 text-white/35 transition group-hover:text-[color:var(--sp-accent)]" />
          </a>
        ))}
      </div>
    </Section>
  )
}

function AgentsSection({ m, url, signatureSlug }: { m: SpotlightModel; url: string; signatureSlug?: string | null }) {
  const [primary, ...co] = m.agents
  return (
    <section id="agent" className="scroll-mt-16 border-t border-white/[0.07] px-5 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="cl-reveal relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[2px] bg-[#141414]">
          {primary.photo_url ? (
            <img src={primary.photo_url} alt={primary.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#1f1f1f,#0d0d0d)]">
              <span className="sp-display text-[7rem] font-light text-[color:color-mix(in_srgb,var(--sp-accent)_70%,transparent)]">{primary.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')}</span>
            </div>
          )}
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
        </div>
        <div className="cl-reveal">
          <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-[color:var(--sp-accent)]"><span className="h-px w-8 bg-[color:var(--sp-accent)]" /> Presented by</p>
          <h2 className="sp-display mt-4 text-[clamp(2.6rem,5vw,4.2rem)] font-light leading-none">{primary.name}</h2>
          <p className="mt-3 text-sm text-white/55">{[primary.title, primary.brokerage].filter(Boolean).join(' · ')}</p>
          {primary.bio && <p className="mt-6 max-w-xl text-[15px] leading-[1.8] text-white/65">{excerpt(primary.bio, 3, 420)}</p>}
          <AgentActions agent={primary} address={m.p.address} url={url} tone="dark" className="mt-8" />
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/40">
            {primary.phone && <span>{fmtPhone(primary.phone)}</span>}
            {primary.email && <span>{primary.email}</span>}
            {primary.license_number && <span>Lic. #{primary.license_number}</span>}
          </div>
          {primary.hub_url && (
            <a href={primary.hub_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--sp-accent)_55%,transparent)] px-5 py-3 text-sm font-medium text-[color:var(--sp-accent)] transition hover:bg-[color:var(--sp-accent)] hover:text-[color:var(--sp-on-accent)]">
              Visit {primary.name.split(' ')[0]}’s Agent Hub <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
          {co.length > 0 && (
            <div className="mt-10 grid gap-3 border-t border-white/[0.08] pt-8 sm:grid-cols-2">
              {co.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Monogram agent={a} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="truncate text-xs text-white/45">{a.title || a.brokerage || 'Co-listing agent'}</p>
                    <div className="mt-1 flex gap-3 text-xs text-[color:var(--sp-accent)]">
                      {a.phone && <a href={`tel:${a.phone.replace(/[^\d+]/g, '')}`} className="hover:underline">Call</a>}
                      {a.email && <a href={`mailto:${a.email}`} className="hover:underline">Email</a>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {signatureSlug && (
        <div className="dark mx-auto mt-16 max-w-3xl border-t border-white/[0.07] pt-4"><SignatureSiteCard hubSlug={signatureSlug} towns={m.p.city ? [m.p.city] : []} /></div>
      )}
    </section>
  )
}

function ContactSection({ m, siteId, url, onShare, allowTour }: { m: SpotlightModel; siteId: string; url: string; onShare: () => void; allowTour: boolean }) {
  const bg = m.photos[m.photos.length > 3 ? 3 : 0]
  return (
    <section id="contact" className="relative scroll-mt-16 overflow-hidden px-5 py-24 sm:px-10 sm:py-32">
      {bg && <img src={bg} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-[0.14] blur-sm" />}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-[#0A0A0A]/85 to-[#0A0A0A]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div className="cl-reveal min-w-0 [container-type:inline-size]">
          <p className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.4em] text-[color:var(--sp-accent)]"><span className="cl-rule h-px w-8 bg-[color:var(--sp-accent)]" /> {allowTour ? 'Private showings' : 'Get in touch'}</p>
          <h2 className="sp-display mt-4 text-[clamp(2.6rem,5.2vw,4.6rem)] font-light leading-[0.98]">
            {allowTour ? 'See it for yourself' : 'Questions about'}
            <em className="cl-gold-text block italic" style={fitLine(p0(m.p.address) + '.', '1em', 175)}>{p0(m.p.address)}{allowTour ? '.' : '?'}</em>
          </h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/60">
            {allowTour
              ? `Pick a day that works and ${m.agent?.name?.split(' ')[0] || 'the listing agent'} will confirm your private showing - or send a question and get a personal reply.`
              : 'Send a note and get a personal reply from the listing agent.'}
          </p>
          {m.agent && (
            <div className="mt-10 flex items-center gap-4 border-t border-white/[0.08] pt-8">
              <Monogram agent={m.agent} size={56} />
              <div className="min-w-0">
                <p className="sp-display text-2xl leading-tight">{m.agent.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/60">
                  {m.agent.phone && <a href={`tel:${m.agent.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-white"><Phone className="h-3.5 w-3.5" /> {fmtPhone(m.agent.phone)}</a>}
                  {m.agent.email && <a href={`mailto:${m.agent.email}`} className="inline-flex items-center gap-1.5 hover:text-white"><Mail className="h-3.5 w-3.5" /> Email</a>}
                  {m.agent.hub_url && <a href={m.agent.hub_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-white"><ArrowUpRight className="h-3.5 w-3.5" /> Agent Hub</a>}
                </div>
              </div>
            </div>
          )}
          <div className="mt-8 flex items-center gap-4 rounded-[2px] border border-white/[0.08] bg-black/40 p-4 ">
            {/* Fixed box: the canvas is 300px wide until QRCode draws into it after hydration. */}
            <div className="h-[86px] w-[86px] shrink-0 overflow-hidden"><FormQrCode url={url} size={76} /></div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Share this home</p>
              <p className="mt-0.5 text-xs text-white/45">Scan, or send the link to someone who should see it.</p>
              <button onClick={onShare} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--sp-accent)] hover:brightness-125"><Share2 className="h-3.5 w-3.5" /> Share options</button>
            </div>
          </div>
        </div>
        <div className="cl-reveal cl-goldcard min-w-0 rounded-[2px] border border-white/10 bg-[#0f0f0f]/90 p-5 shadow-[0_40px_120px_-40px_rgba(0,0,0,.9)] sm:p-10">
          <LeadForm siteId={siteId} address={m.p.address} tone="dark" agent={m.agent} openHouses={m.has.openHouses ? m.openHouses : []} allowTour={allowTour} />
        </div>
      </div>
    </section>
  )
}

function SiteFooter({ m, navItems }: { m: SpotlightModel; navItems: NavItem[] }) {
  return (
    <footer className="border-t border-white/[0.07] bg-[#070707] px-5 pb-28 pt-16 sm:px-10 lg:pb-12">
      <div className="mx-auto max-w-[1440px] [container-type:inline-size]">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="cl-glint sp-display font-light leading-none" style={fitLine(p0(m.p.address), '3rem', 150)}>{p0(m.p.address)}</p>
            <p className="mt-3 text-sm text-white/45">{[m.p.city, [m.p.state, m.p.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer">
            {navItems.filter(i => i.show).map(i => (
              <button key={i.id} onClick={() => scrollToId(i.id)} className="text-[11px] font-medium uppercase tracking-[0.25em] text-white/50 transition hover:text-white">{i.label}</button>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/[0.07] pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {m.agent ? <>Presented by {m.agent.name}{m.agent.brokerage ? `, ${m.agent.brokerage}` : ''}{m.agent.license_number ? ` · Lic. #${m.agent.license_number}` : ''}</> : null}
          </p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-white/35"><Sparkles className="h-3 w-3" /> Powered by OpenHousePal</span>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="rounded-full border border-white/15 px-3 py-1.5 hover:border-white/40 hover:text-white">Back to top</button>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] leading-relaxed text-white/30">Equal Housing Opportunity. All information should be independently verified.</p>
        {m.isMls && (
          <div className="mt-3">
            <MlsDisclaimer listOffice={m.p.list_office_name} mlsNumber={m.p.mls_number} />
          </div>
        )}
      </div>
    </footer>
  )
}

const CL_CSS = `
.cl{font-family:var(--font-cl-sans),ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:clip}
.cl .sp-display{font-family:var(--font-cl-display),Georgia,serif;letter-spacing:-.01em;font-variant-numeric:lining-nums}
.cl ::selection{background:var(--sp-accent);color:var(--sp-on-accent)}
.cl .cl-nearby:has(#explore-nearby){background:#0A0A0A;padding-top:2rem}
.cl .cl-map{filter:saturate(1.05) brightness(.97)}
.cl .animate-marquee-x-slow{animation-duration:170s}
.cl .animate-marquee-x-reverse-slow{animation-duration:190s}
.cl .cl-feat-in{animation:clFeatIn .7s cubic-bezier(.2,.7,.2,1) both}
@keyframes clFeatIn{from{opacity:0;transform:translateY(10px);filter:blur(3px)}to{opacity:1;transform:none;filter:none}}
.cl .cl-kenburns{animation:clHeroIn 1.8s ease both,clKen 14s cubic-bezier(.2,.6,.2,1) both}
@keyframes clHeroIn{from{opacity:0;filter:brightness(.4)}to{opacity:1;filter:none}}
@keyframes clKen{from{transform:scale(1.16)}to{transform:scale(1.02)}}
.cl .cl-mq-a{animation:clMqA 1.6s 1.1s cubic-bezier(.2,.7,.2,1) both}
.cl .cl-mq-b{animation:clMqB 1.6s 1.25s cubic-bezier(.2,.7,.2,1) both}
@keyframes clMqA{from{opacity:0;transform:translateX(12%)}to{opacity:1;transform:none}}
@keyframes clMqB{from{opacity:0;transform:translateX(-12%)}to{opacity:1;transform:none}}
.cl .cl-drawer{animation:clDrawer .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes clDrawer{from{transform:translateX(100%)}to{transform:none}}
.cl .cl-menu{animation:clFade .35s ease both}
@keyframes clFade{from{opacity:0}to{opacity:1}}
.cl .cl-prose::first-letter{font-family:var(--font-cl-display),Georgia,serif;font-size:1.45em;line-height:.9;color:var(--sp-accent);padding-right:.04em}
/* ---- Luxe layer ---- */
.cl .cl-progress{background:linear-gradient(90deg,#8b6a2b,var(--sp-accent) 40%,#fff3cf 70%,var(--sp-accent));box-shadow:0 0 12px color-mix(in srgb,var(--sp-accent) 70%,transparent);transition:transform .12s linear}
.cl .cl-frame{opacity:.9}
.cl .cl-frame>span:not(.cl-corner){position:absolute;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--sp-accent) 55%,transparent),transparent)}
.cl .cl-frame-t,.cl .cl-frame-b{left:0;right:0;height:1px;transform:scaleX(0);animation:clDrawX 1.8s .5s cubic-bezier(.65,0,.35,1) forwards}
.cl .cl-frame-t{top:0}.cl .cl-frame-b{bottom:0;animation-delay:.8s}
.cl .cl-frame-l,.cl .cl-frame-r{top:0;bottom:0;width:1px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--sp-accent) 45%,transparent),transparent)!important;transform:scaleY(0);animation:clDrawY 1.8s .65s cubic-bezier(.65,0,.35,1) forwards}
.cl .cl-frame-l{left:0}.cl .cl-frame-r{right:0}
.cl .cl-corner{position:absolute;width:22px;height:22px;border-color:var(--sp-accent);opacity:0;animation:clCorner .9s 1.9s ease forwards}
@keyframes clDrawX{to{transform:scaleX(1)}}
@keyframes clDrawY{to{transform:scaleY(1)}}
@keyframes clCorner{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.cl .cl-leak{background:linear-gradient(105deg,transparent 30%,color-mix(in srgb,var(--sp-accent) 38%,transparent) 45%,rgba(255,243,207,.35) 50%,color-mix(in srgb,var(--sp-accent) 30%,transparent) 55%,transparent 70%);mix-blend-mode:screen;transform:translateX(-110%);animation:clLeak 3.2s .9s cubic-bezier(.45,0,.2,1) forwards}
@keyframes clLeak{0%{transform:translateX(-110%);opacity:0}15%{opacity:1}100%{transform:translateX(110%);opacity:0}}
.cl .cl-vignette{background:radial-gradient(120% 90% at 50% 40%,transparent 55%,rgba(0,0,0,.35) 100%)}
.cl .cl-spark{width:4px;height:4px;border-radius:999px;background:radial-gradient(circle,#fff3cf,var(--sp-accent) 60%,transparent 70%);box-shadow:0 0 10px 2px color-mix(in srgb,var(--sp-accent) 60%,transparent);opacity:0;animation-name:clSpark;animation-timing-function:ease-in-out;animation-iteration-count:infinite}
@keyframes clSpark{0%{opacity:0;transform:translateY(0) scale(.5)}25%{opacity:.95;transform:translateY(-24px) scale(1)}70%{opacity:.5}100%{opacity:0;transform:translateY(-90px) scale(.6)}}
.cl .cl-glint{background-image:linear-gradient(100deg,#fff 0%,#fff 38%,color-mix(in srgb,var(--sp-accent) 85%,white) 47%,#fff3cf 50%,color-mix(in srgb,var(--sp-accent) 85%,white) 53%,#fff 62%,#fff 100%);background-size:260% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;color:transparent;animation:clGlint 7s 2.2s ease-in-out infinite}
@keyframes clGlint{0%{background-position:100% 0}40%,100%{background-position:0% 0}}
.cl .cl-gold-text{background-image:linear-gradient(100deg,color-mix(in srgb,var(--sp-accent) 75%,#6b4f1d),var(--sp-accent) 30%,#fff3cf 50%,var(--sp-accent) 70%,color-mix(in srgb,var(--sp-accent) 75%,#6b4f1d));background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:clGoldText 8s ease-in-out infinite}
@keyframes clGoldText{0%,100%{background-position:100% 0}50%{background-position:0% 0}}
.cl .cl-cta:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);transform:translateX(-100%);animation:clShine 3.6s 2.4s ease-in-out infinite}
@keyframes clShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.cl .cl-mq-edge{background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--sp-accent) 70%,transparent) 30%,#fff3cf 50%,color-mix(in srgb,var(--sp-accent) 70%,transparent) 70%,transparent)}
.cl .cl-mq:before,.cl .cl-mq:after{content:"";position:absolute;top:0;bottom:0;width:12%;z-index:2;pointer-events:none}
.cl .cl-mq:before{left:0;background:linear-gradient(90deg,rgba(10,10,10,.85),transparent)}
.cl .cl-mq:after{right:0;background:linear-gradient(270deg,rgba(10,10,10,.85),transparent)}
.cl .cl-rule{background:linear-gradient(90deg,transparent,var(--sp-accent))!important;box-shadow:0 0 8px color-mix(in srgb,var(--sp-accent) 60%,transparent)}
.cl h2 em{background-image:linear-gradient(100deg,color-mix(in srgb,var(--sp-accent) 70%,white),#fff3cf 50%,color-mix(in srgb,var(--sp-accent) 70%,white));-webkit-background-clip:text;background-clip:text;color:transparent}
.cl>section:not(#overview){position:relative}
.cl>section:not(#overview):before{content:"";position:absolute;left:15%;right:15%;top:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--sp-accent) 45%,transparent),transparent);pointer-events:none;z-index:1}
.cl .cl-goldcard{position:relative;border-color:color-mix(in srgb,var(--sp-accent) 30%,transparent)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--sp-accent) 12%,transparent),0 40px 120px -40px rgba(0,0,0,.9),0 0 80px -30px color-mix(in srgb,var(--sp-accent) 45%,transparent)!important}
.cl .cl-goldcard:before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent 10%,#fff3cf 50%,transparent 90%);background-size:200% 100%;animation:clEdge 6s ease-in-out infinite}
@keyframes clEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.cl #photos img,.cl #features img{transition:transform .9s cubic-bezier(.22,.61,.36,1),filter .6s}
.cl.cl-static .cl-kenburns,.cl.cl-static .cl-menu,.cl.cl-static .cl-mq-a,.cl.cl-static .cl-mq-b,.cl.cl-static .cl-drawer{animation:none}
.cl.cl-static .cl-frame-t,.cl.cl-static .cl-frame-b,.cl.cl-static .cl-frame-l,.cl.cl-static .cl-frame-r{animation:none;transform:none}
.cl.cl-static .cl-corner{animation:none;opacity:1}
.cl.cl-static .cl-leak,.cl.cl-static .cl-spark,.cl.cl-static .cl-glint,.cl.cl-static .cl-gold-text,.cl.cl-static .cl-cta:after,.cl.cl-static .cl-goldcard:before{animation:none}
@media(prefers-reduced-motion:reduce){.cl .cl-kenburns,.cl .cl-menu,.cl .cl-mq-a,.cl .cl-mq-b,.cl .cl-drawer{animation:none}.cl .animate-marquee-x-slow,.cl .animate-marquee-x-reverse-slow,.cl .cl-feat-in{animation:none}.cl .cl-leak,.cl .cl-spark,.cl .cl-glint,.cl .cl-gold-text,.cl .cl-cta:after,.cl .cl-goldcard:before{animation:none}.cl .cl-frame-t,.cl .cl-frame-b,.cl .cl-frame-l,.cl .cl-frame-r{animation:none;transform:none}.cl .cl-corner{animation:none;opacity:1}}
`
