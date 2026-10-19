'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight, CalendarDays, ChevronRight, DollarSign, Facebook, Globe, Home as HomeIcon, Instagram, KeyRound, Linkedin, Mail, MapPin, Menu, MessageSquare,
  Moon, Music2, Newspaper, Phone, Search, Sparkles, Star, Sun, User, X, Youtube, type LucideIcon,
} from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { siteModeStorageKey, siteLuxeMetal } from '@/lib/siteTheme'
import SignatureSiteCard from '@/components/studio/blogs/SignatureSiteCard'
import { SitePage, SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import { useVisitor } from '@/lib/visitor'
import { IdxNotice } from '@/components/MLSComplianceFooter'

// The visitor's light/dark switch. Flips data-mode on the nearest .ohp-site root (the public
// SiteShell, or the editor's preview box) and remembers the choice per site, which SiteShell's
// inline script re-applies before paint on the next visit.
export function ModeToggle({ siteKey, initialMode = 'light', className = '', light = false, inert = false }: { siteKey?: string; initialMode?: 'light' | 'dark'; className?: string; light?: boolean; inert?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [mode, setMode] = useState<'light' | 'dark'>(initialMode)
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('.ohp-site')
    if (root) setMode(root.getAttribute('data-mode') === 'dark' ? 'dark' : 'light')
  }, [])
  // The editor's preview keeps the button visible (so the agent sees where visitors switch) but
  // the default mode is chosen on the Design tab, which drives the preview's data-mode itself.
  useEffect(() => { if (inert) setMode(initialMode) }, [inert, initialMode])
  const toggle = () => {
    if (inert) return
    const next = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    ref.current?.closest<HTMLElement>('.ohp-site')?.setAttribute('data-mode', next)
    if (siteKey) { try { window.localStorage.setItem(siteModeStorageKey(siteKey), next) } catch {} }
  }
  return (
    <button ref={ref} type="button" onClick={toggle} aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={inert ? 'Visitors switch light / dark here' : mode === 'dark' ? 'Light mode' : 'Dark mode'}
      className={`ohp-mode-toggle ${light ? 'border-white/25 text-white' : ''} ${className}`}>
      {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

const NAV_ICONS: Record<string, LucideIcon> = {
  home: HomeIcon,
  properties: Search,
  blog: Newspaper,
  about: User,
}

function navIconFor(label: string): LucideIcon {
  return NAV_ICONS[label.toLowerCase()] || MapPin
}

export interface HeaderProfile {
  name?: string
  photo_url?: string
  title?: string
  brokerage?: string
  phone?: string
  email?: string
  rating?: { count: number; average: number | null } | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const telOf = (phone?: string) => (phone ? phone.replace(/[^\d+]/g, '') : '')

// The quick-start lead buttons (phone menu, footer) - each opens the agent's matching form in a
// window over the page (SiteFormLauncher reads data-ohp-form); /contact is the no-JS fallback.
const QUICK_FORMS: { form: string; label: string; sub: string; icon: LucideIcon }[] = [
  { form: 'buying', label: 'Find a home', sub: 'Tell me what you want', icon: KeyRound },
  { form: 'selling', label: 'Sell my home', sub: 'Get a selling plan', icon: Sparkles },
  { form: 'home_value', label: 'Home value', sub: "What's mine worth?", icon: DollarSign },
  { form: 'showing', label: 'Book a showing', sub: 'Pick a day and time', icon: CalendarDays },
]

/** The agent's face - opens their Agent Hub (the About page) wherever it appears. */
function AgentAvatar({ profile, siteName, href, size = 'h-9 w-9', ring = 'ring-white/50', round = true, onDark = false, theme }: {
  profile?: HeaderProfile; siteName: string; href: string; size?: string; ring?: string; round?: boolean; onDark?: boolean; theme: SiteTheme
}) {
  const shape = round ? 'rounded-full' : 'rounded-lg'
  const first = (profile?.name || '').split(' ')[0]
  return (
    <a href={href} aria-label={first ? `Meet ${first}` : 'About'} title={first ? `Meet ${first} - my Agent Hub` : 'About'} className="group relative block shrink-0">
      {profile?.photo_url ? (
        <img src={resolveMediaUrl(profile.photo_url)} alt={profile.name || siteName} className={`${size} ${shape} object-cover ring-2 ${ring} transition duration-500 group-hover:scale-105`} />
      ) : (
        <span className={`flex ${size} ${shape} items-center justify-center text-[11px] font-black ring-2 ${ring}`} style={onDark ? { backgroundColor: 'rgba(255,255,255,.12)', color: '#fff' } : { backgroundColor: theme.secondary_color, color: 'var(--site-on-accent)' }}>
          {initials(profile?.name || siteName)}
        </span>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" aria-hidden />
    </a>
  )
}

// "{first}'s Showcase" - the one tab that's theirs: a soft glow, a slowly turning ring in the site's
// colour, and a sparkle, so it reads as special at a glance.
function MineTab({ href, label, active, onDark, classic }: { href: string; label: string; active: boolean; onDark: boolean; classic: boolean }) {
  return (
    <a href={href} className={`ohp-mine-tab group relative mx-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 transition hover:-translate-y-0.5 ${classic ? 'text-[13.5px] font-extrabold' : 'text-[11px] font-black uppercase tracking-[0.13em]'}`}
      style={{ color: onDark ? '#fff' : 'var(--site-heading)', ...(active ? { ['--mine-fill' as any]: 'rgba(var(--site-accent-rgb),.22)' } : {}) }}>
      <Sparkles className="ohp-mine-spark h-3.5 w-3.5" style={{ color: onDark ? '#fff' : 'var(--site-accent)' }} />
      {label}
    </a>
  )
}

export const MINE_TAB_CSS = `
.ohp-mine-tab{isolation:isolate;background:var(--mine-fill,rgba(var(--site-accent-rgb),.12));box-shadow:0 0 0 1px rgba(var(--site-accent-rgb),.35),0 6px 22px -8px rgba(var(--site-accent-rgb),.75)}
.ohp-mine-tab::before{content:"";position:absolute;inset:-1.5px;z-index:-1;border-radius:9999px;padding:1.5px;background:conic-gradient(from var(--mine-a,0deg),var(--site-accent),transparent 30%,var(--site-accent) 55%,transparent 80%,var(--site-accent));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:ohpMineSpin 4s linear infinite}
@property --mine-a{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes ohpMineSpin{to{--mine-a:360deg}}
.ohp-mine-spark{animation:ohpMineTwinkle 2.4s ease-in-out infinite}
@keyframes ohpMineTwinkle{50%{transform:scale(1.25) rotate(18deg);opacity:.75}}
.ohp-mine-dot{box-shadow:0 0 0 0 rgba(var(--site-accent-rgb),.6);animation:ohpMinePulse 2.4s ease-out infinite}
@keyframes ohpMinePulse{0%{box-shadow:0 0 0 0 rgba(var(--site-accent-rgb),.55)}100%{box-shadow:0 0 0 12px rgba(var(--site-accent-rgb),0)}}
.ohp-mine-card{box-shadow:0 18px 36px -18px rgba(var(--site-accent-rgb),.95)}
.ohp-mine-card::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-120%);animation:ohpMineShine 3.4s ease-in-out 1s infinite}
@keyframes ohpMineShine{60%,100%{transform:translateX(120%)}}
@media (prefers-reduced-motion:reduce){.ohp-mine-tab::before,.ohp-mine-spark,.ohp-mine-dot,.ohp-mine-card::after{animation:none}}
`

// Global header/footer for every public site page - built from the site's own pages + the
// reserved sections (Search, Featured, Neighborhoods, Media, Reviews, About). While the visitor is
// over a dark hero the header is transparent with white text; past it, a solid bar.
// The agent's photo opens their Agent Hub (the About page); "Let's talk" opens their general
// contact form in a window (SiteFormLauncher).
export function SiteHeader({
  theme, pages, siteName, basePrefix = '', hasCommunities = false, agentProfile, hasDarkHero = false, preview = false, siteKey, hasReviews = false,
}: {
  theme: SiteTheme; pages: SitePage[]; siteName: string; basePrefix?: string; hasCommunities?: boolean; agentProfile?: HeaderProfile; hasDarkHero?: boolean; preview?: boolean
  /** Which site the visitor's light/dark choice is remembered for (the subdomain slug). */
  siteKey?: string
  /** The agent switched "Show on my IDX website" on (Studio -> Reviews) and has reviews to show. */
  hasReviews?: boolean
}) {
  const showModeToggle = theme.allow_mode_toggle !== false
  // Contact (the header has its own "Let's talk" button) and About (the agent's photo + the fixed
  // About link) aren't repeated from the page list.
  const navPages = pages.filter(p => !p.is_home && p.slug !== 'contact' && p.slug !== 'about')
  // Preview mode renders inside a scrollable panel (the editor) - always the solid header there.
  const [isScrolled, setIsScrolled] = useState(preview)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (preview) return
    if (!hasDarkHero) { setIsScrolled(true); return }
    const sentinel = document.getElementById('site-hero-sentinel')
    if (!sentinel) {
      const onScroll = () => setIsScrolled(window.scrollY > 64)
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }
    const observer = new IntersectionObserver(([entry]) => setIsScrolled(!entry.isIntersecting), { rootMargin: '-64px 0px 0px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [preview, hasDarkHero, pathname])

  useEffect(() => { setMobileOpen(false) }, [pathname])
  // The phone menu covers the page - don't let the page scroll underneath it.
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobileOpen])

  // A visitor the site knows (signed in with Google, built or opened their Showcase): their own
  // glowing "{first}'s Showcase" tab takes Search's place (user, 10/18) - search stays one tap away
  // inside it, in the phone menu, the footer and the home page.
  const visitor = useVisitor()
  const mine = !preview && visitor ? { href: `${basePrefix}/my-showcase`, label: visitor.firstName || visitor.name?.split(' ')[0] ? `${visitor.firstName || visitor.name.split(' ')[0]}'s Showcase` : 'My Showcase' } : null
  const navLinks: { href: string; label: string; icon: LucideIcon; form?: string }[] = [
    { href: `${basePrefix}/search`, label: 'Search', icon: Search },
    { href: `${basePrefix}/properties`, label: 'Featured', icon: HomeIcon },
    ...(hasCommunities ? [{ href: `${basePrefix}/neighborhoods`, label: 'Neighborhoods', icon: MapPin }] : []),
    { href: `${basePrefix}/blog`, label: 'Media', icon: Newspaper },
    ...(hasReviews ? [{ href: `${basePrefix}/testimonials`, label: 'Reviews', icon: Star }] : []),
    ...navPages.map(p => ({ href: `${basePrefix}/${p.slug}`, label: p.title, icon: navIconFor(p.title) })),
    { href: `${basePrefix}/about`, label: 'About', icon: User },
  ]

  const dark = hasDarkHero && !isScrolled
  const classic = theme.template === 'default'
  const aboutHref = `${basePrefix}/about`
  const rating = agentProfile?.rating && agentProfile.rating.average != null && agentProfile.rating.count > 0 ? agentProfile.rating : null
  const tel = telOf(agentProfile?.phone)
  // A logo that fails to load (moved / deleted file) falls back to the house mark.
  const [logoOk, setLogoOk] = useState(true)
  const logoRef = useRef<HTMLImageElement>(null)
  // The image may have failed before the page hydrated (onError then never fires) - check once.
  useEffect(() => { const img = logoRef.current; if (img && img.complete && img.naturalWidth === 0) setLogoOk(false) }, [])
  const showLogo = !!theme.logo_url && logoOk
  const isActive = (href: string) => !!pathname && (pathname === href || pathname.endsWith(href.replace(basePrefix, '') || '/__none'))

  return (
    <header
      className={`${preview ? 'sticky' : 'fixed inset-x-0'} top-0 z-50 transition-all duration-500 ${
        dark
          ? 'border-b border-transparent bg-transparent'
          : classic ? 'border-b border-[var(--site-line)] bg-[var(--site-bg)]/95 ' : 'border-b border-[var(--site-gold)]/15 bg-[var(--site-cream)] shadow-[0_1px_20px_rgba(17,24,39,0.08)]'
      }`}
    >
      {mine && <style>{MINE_TAB_CSS}</style>}
      {/* Luxe: a thin metal line glides across the top edge. */}
      {!classic && <span aria-hidden className="ohp-head-sweep pointer-events-none absolute inset-x-0 top-0 h-px" />}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <a href={`${basePrefix}/`} aria-label="Home" data-ohp-spot="logo" className="flex shrink-0 items-center gap-3">
          {showLogo ? (
            <img ref={logoRef} src={resolveMediaUrl(theme.logo_url)} alt={siteName} onError={() => setLogoOk(false)} className={`h-10 w-auto max-w-[150px] object-contain ${dark ? 'brightness-0 invert' : ''}`} />
          ) : (
            <span
              className={`flex h-11 w-11 items-center justify-center transition-transform duration-300 hover:scale-105 ${classic ? 'rounded-xl' : 'rounded-xl ring-1 ring-[var(--site-gold)]/30'}`}
              style={classic ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : { backgroundColor: theme.primary_color, color: theme.secondary_color }}
            >
              <HomeIcon className="h-5 w-5" />
            </span>
          )}
          {agentProfile?.name && !showLogo && (
            <span className="hidden leading-tight xl:block">
              <span className={`block text-[15px] transition-colors duration-500 ${classic ? 'font-extrabold tracking-tight' : `font-black ${fontClass(theme.heading_font, 'font-serif')}`} ${dark ? 'text-white' : classic ? 'text-[color:var(--site-heading)]' : 'text-[#111827]'}`}>{agentProfile.name}</span>
              <span className={`block text-[9px] font-black uppercase tracking-[0.25em] transition-colors duration-500 ${dark ? 'text-white/60' : ''}`} style={dark ? undefined : { color: classic ? 'var(--site-muted)' : theme.secondary_color }}>{agentProfile.brokerage || 'Real Estate'}</span>
            </span>
          )}
        </a>

        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          {mine && <MineTab href={mine.href} label={mine.label} active={isActive(mine.href)} onDark={dark} classic={classic} />}
          {navLinks.filter(link => !(mine && link.label === 'Search')).map(link => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <a
                key={link.href}
                href={link.href}
                data-ohp-spot={`nav-${link.label.toLowerCase()}`}
                className={`group relative flex items-center gap-1.5 px-3 py-2 transition-colors duration-500 xl:px-3.5 ${classic ? 'rounded-lg text-[14px] font-semibold' : 'text-[11px] font-bold uppercase tracking-[0.15em]'} ${
                  dark ? 'text-white/80 hover:text-white' : classic ? `${active ? 'bg-[rgba(var(--site-accent-rgb),.08)] text-[color:var(--site-heading)]' : 'text-[color:var(--site-ink-soft)]'} hover:text-[color:var(--site-heading)]` : active ? 'text-[#111827]' : 'text-gray-500 hover:text-[#111827]'
                }`}
              >
                {!classic && <Icon className="h-3.5 w-3.5" />}
                {link.label}
                {!classic && (
                  <span
                    className={`absolute inset-x-3 -bottom-0.5 h-0.5 origin-left transition-transform duration-300 group-hover:scale-x-100 ${active ? 'scale-x-100' : 'scale-x-0'}`}
                    style={{ backgroundColor: theme.secondary_color }}
                  />
                )}
              </a>
            )
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
          {showModeToggle && <span data-ohp-spot="mode-toggle" className="inline-flex"><ModeToggle siteKey={siteKey} initialMode={theme.mode === 'dark' ? 'dark' : 'light'} light={dark} inert={preview} /></span>}
          {rating && (
            <a href={`${basePrefix}/testimonials`} className={`hidden items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-black transition 2xl:inline-flex ${dark ? 'bg-white/10 text-white' : classic ? 'bg-[rgba(var(--site-accent-rgb),.08)] text-[color:var(--site-heading)]' : 'bg-[var(--site-gold-soft)] text-[#111827]'}`}>
              <Star className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)', fill: 'var(--site-accent)' }} />{rating.average!.toFixed(1)}
            </a>
          )}
          <AgentAvatar profile={agentProfile} siteName={siteName} href={aboutHref} theme={theme} round={!classic} ring={dark ? 'ring-white/40' : classic ? 'ring-[color:var(--site-line-strong)]' : 'ring-[var(--site-gold)]/50'} onDark={dark} />
          <a
            href={`${basePrefix}/contact`}
            data-ohp-form="how_can_i_help"
            data-ohp-form-title="Let's talk"
            className={`inline-flex items-center gap-2 px-5 py-2.5 shadow-sm transition-all duration-500 hover:-translate-y-0.5 ${classic ? 'rounded-xl text-sm font-bold' : 'rounded-full text-[11px] font-black uppercase tracking-[0.14em]'} ${
              dark ? 'border border-white/25 bg-white/10 text-white hover:bg-white/20' : classic ? '' : 'ohp-gold-sheen text-white'
            }`}
            style={dark ? undefined : classic ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : { backgroundColor: theme.primary_color }}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Let&apos;s talk
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {mine && (
            <a href={mine.href} aria-label={mine.label} className="ohp-mine-dot relative grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
              <Sparkles className="h-[18px] w-[18px]" />
            </a>
          )}
          {showModeToggle && <ModeToggle siteKey={siteKey} initialMode={theme.mode === 'dark' ? 'dark' : 'light'} light={dark} inert={preview} />}
          <AgentAvatar profile={agentProfile} siteName={siteName} href={aboutHref} theme={theme} size="h-9 w-9" round={!classic} ring={dark ? 'ring-white/40' : 'ring-[var(--site-gold)]/40'} onDark={dark} />
          <button
            onClick={() => setMobileOpen(v => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-500 ${dark ? 'text-white' : 'text-[color:var(--site-heading)]'}`}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Phone menu: the agent, every page, one-tap forms, and call / text / email. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[calc(100dvh-64px)] overflow-y-auto border-t px-5 pb-8 pt-4 lg:hidden"
            style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-line)', color: 'var(--site-ink)' }}
          >
            <a href={aboutHref} className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)' }}>
              {agentProfile?.photo_url
                ? <img src={resolveMediaUrl(agentProfile.photo_url)} alt="" className={`h-12 w-12 object-cover ${classic ? 'rounded-xl' : 'rounded-full ring-2 ring-[var(--site-gold)]/50'}`} />
                : <span className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>{initials(agentProfile?.name || siteName)}</span>}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-base font-black ${classic ? '' : fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>{agentProfile?.name || siteName}</span>
                <span className="block truncate text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>
                  {rating ? <><Star className="mr-0.5 inline h-3 w-3 align-[-2px]" style={{ color: 'var(--site-accent)', fill: 'var(--site-accent)' }} />{rating.average!.toFixed(1)} ({rating.count}) · </> : null}
                  {[agentProfile?.title, agentProfile?.brokerage].filter(Boolean).join(' · ') || 'My Agent Hub'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--site-faint)' }} />
            </a>

            {mine && (
              <motion.a href={mine.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
                className="ohp-mine-card relative mt-3 flex items-center gap-3 overflow-hidden rounded-2xl p-3.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20"><Sparkles className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[17px] font-black ${classic ? '' : fontClass(theme.heading_font, 'font-serif')}`}>{mine.label}</span>
                  <span className="block truncate text-xs font-semibold opacity-80">Your homes, picked for you</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0" />
              </motion.a>
            )}
            <div className="mt-3 divide-y" style={{ borderColor: 'var(--site-line)' }}>
              {navLinks.map((link, i) => {
                const Icon = link.icon
                return (
                  <motion.a key={link.href} href={link.href} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}
                    className="flex items-center gap-3 py-3.5 text-[15px] font-bold" style={{ borderColor: 'var(--site-line)', color: 'var(--site-heading)' }}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.1)', color: 'var(--site-accent-deep)' }}><Icon className="h-4 w-4" /></span>
                    {link.label}
                    <ChevronRight className="ml-auto h-4 w-4" style={{ color: 'var(--site-faint)' }} />
                  </motion.a>
                )
              })}
            </div>

            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-faint)' }}>How can I help?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {QUICK_FORMS.map(q => (
                <a key={q.form} href={`${basePrefix}/contact`} data-ohp-form={q.form} data-ohp-form-title={q.label}
                  className="rounded-2xl border p-3 transition active:scale-[.98]" style={{ borderColor: 'var(--site-line)', backgroundColor: 'var(--site-surface)' }}>
                  <q.icon className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />
                  <span className="mt-2 block text-sm font-black" style={{ color: 'var(--site-heading)' }}>{q.label}</span>
                  <span className="block text-[11px] font-semibold" style={{ color: 'var(--site-muted)' }}>{q.sub}</span>
                </a>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {tel && <a href={`tel:${tel}`} className="flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Phone className="h-4 w-4" />Call</a>}
              {tel && <a href={`sms:${tel}`} className="flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-black" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><MessageSquare className="h-4 w-4" />Text</a>}
              {agentProfile?.email && <a href={`mailto:${agentProfile.email}`} className="flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs font-black" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}><Mail className="h-4 w-4" />Email</a>}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

interface FooterArea {
  slug: string
  name: string
  state: string
}

interface FooterProfile {
  name?: string
  /** false once the agent's sales volume passes $50M - "Sold" instead of "Recently Sold". */
  sales_recent?: boolean
  phone?: string
  email?: string
  brokerage?: string
  photo_url?: string
  title?: string
  market?: string
  license_number?: string
  social_links?: { id?: string; label?: string; url: string }[]
  rating?: { count: number; average: number | null } | null
  // The agent's Email Signature card source (plan has signatures + one saved); the footer shows
  // it as the centerpiece when theme.footer_signature isn't off.
  signature_hub_slug?: string | null
}

const SOCIAL_ICONS: Record<string, LucideIcon> = { instagram: Instagram, facebook: Facebook, youtube: Youtube, tiktok: Music2, linkedin: Linkedin, website: Globe }

function FooterColumn({ title, children, classic, delay = 0 }: { title: string; children: React.ReactNode; classic: boolean; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}>
      {classic ? (
        <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--site-heading)' }}>{title}</p>
      ) : (
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: 'var(--site-accent)' }}>
          <span className="h-px w-5" style={{ backgroundColor: 'var(--site-accent)' }} />{title}
        </p>
      )}
      <ul className={`mt-4 space-y-2.5 text-sm ${classic ? 'ohp-classic-foot-links' : 'text-white/65'}`}>{children}</ul>
    </motion.div>
  )
}

function FooterLink({ href, children, form, spot }: { href: string; children: React.ReactNode; form?: string; spot?: string }) {
  return (
    <li>
      <a href={href} data-ohp-form={form} data-ohp-spot={spot} className="group inline-flex items-center gap-1.5 transition-colors hover:text-white">
        <span className="h-1 w-1 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-100" />
        {children}
        <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </a>
    </li>
  )
}

// Site-wide footer:
//   1. one row: the site's links on the left (Homes + Neighborhoods) and right (Explore + Get in
//      touch), with the closing "let's talk" band and its one-tap form buttons between them;
//   2. the agent alone at the center underneath - their Email Signature card when they have one
//      (theme.footer_signature), otherwise a plain agent card;
//   3. the MLS notice and the legal line.
// Phones: the band, then the links two across, then the agent.
export function SiteFooter({
  theme, siteName, areas, hasSoldPage, profile, basePrefix = '', showCta = true, signatureSlug, idxNotice = true, hasReviews = false,
}: {
  theme: SiteTheme; siteName: string; areas?: FooterArea[]; hasSoldPage?: boolean; profile?: FooterProfile; basePrefix?: string
  /** Adds "Client Reviews" (the Reviews page) under Explore. */
  hasReviews?: boolean
  /** The closing "let's talk" band - off when the page already ends with its own contact section. */
  showCta?: boolean
  /** Overrides profile.signature_hub_slug (the editor preview passes the agent's own). */
  signatureSlug?: string | null
  /** Bright's IDX notice - off only where the page already shows the full one (a home's page). */
  idxNotice?: boolean
}) {
  const name = profile?.name || siteName
  const first = name.split(' ')[0]
  const serif = fontClass(theme.heading_font, 'font-serif')
  const tel = telOf(profile?.phone)
  // Off unless the agent switched it on (user, 10/18 - the footer already has the agent's details).
  const sigSlug = theme.footer_signature !== true ? null : (signatureSlug ?? profile?.signature_hub_slug ?? null)
  const classic = theme.template === 'default'
  const rating = profile?.rating && profile.rating.average != null && profile.rating.count > 0 ? profile.rating : null
  // The signature card takes the site's colors: Luxe's metal, Classic's accent.
  const sigMatch = classic ? { accent: theme.secondary_color } : { metal: siteLuxeMetal(theme) }
  const muted = classic ? 'var(--site-muted)' : 'rgba(255,255,255,.6)'
  const head = classic ? 'var(--site-heading)' : '#fff'

  const agentCard = (
    <div className={`mx-auto w-full max-w-[520px] rounded-[28px] border p-7 text-center ${classic ? '' : ''}`}
      style={classic ? { backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' } : { backgroundColor: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.1)' }}>
      <a href={`${basePrefix}/about`} className="inline-block">
        {profile?.photo_url
          ? <img src={resolveMediaUrl(profile.photo_url)} alt={name} className={`mx-auto h-24 w-24 object-cover ${classic ? 'rounded-2xl' : 'rounded-full'} ring-4`} style={{ ['--tw-ring-color' as any]: 'rgba(var(--site-accent-rgb),.45)' }} />
          : <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full text-2xl font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>{initials(name)}</span>}
      </a>
      <p className={`mt-4 text-2xl font-black leading-tight ${classic ? 'tracking-tight' : serif}`} style={{ color: head }}>{name}</p>
      {(profile?.title || profile?.brokerage) && <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-accent)' }}>{[profile?.title, profile?.brokerage].filter(Boolean).join(' · ')}</p>}
      {rating && (
        <a href={`${basePrefix}/testimonials`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: muted }}>
          {[1, 2, 3, 4, 5].map(n => <Star key={n} className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)', fill: n <= Math.round(rating.average!) ? 'var(--site-accent)' : 'none' }} />)}
          <span className="ml-1">{rating.average!.toFixed(1)} · {rating.count} reviews</span>
        </a>
      )}
      {profile?.market && <p className="mt-2 flex items-center justify-center gap-1.5 text-sm" style={{ color: muted }}><MapPin className="h-3.5 w-3.5" />{profile.market}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {tel && <a href={`tel:${tel}`} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Phone className="h-3.5 w-3.5" /> Call</a>}
        {tel && <a href={`sms:${tel}`} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black" style={{ borderColor: classic ? 'var(--site-line-strong)' : 'rgba(255,255,255,.2)', color: head }}><MessageSquare className="h-3.5 w-3.5" /> Text</a>}
        {profile?.email && <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black" style={{ borderColor: classic ? 'var(--site-line-strong)' : 'rgba(255,255,255,.2)', color: head }}><Mail className="h-3.5 w-3.5" /> Email</a>}
        <a href={`${basePrefix}/about`} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black" style={{ borderColor: classic ? 'var(--site-line-strong)' : 'rgba(255,255,255,.2)', color: head }}><User className="h-3.5 w-3.5" /> My Agent Hub</a>
      </div>
    </div>
  )

  const socials = (profile?.social_links || []).filter(l => l.url).slice(0, 6)
  const leftCols = (
    <>
      <FooterColumn title="Homes" classic={classic}>
        <FooterLink href={`${basePrefix}/search`}>Search Homes</FooterLink>
        <FooterLink href={`${basePrefix}/properties`}>Featured Listings</FooterLink>
        {hasSoldPage && <FooterLink href={`${basePrefix}/sold`}>{profile?.sales_recent === false ? 'Sold' : 'Recently Sold'}</FooterLink>}
        <FooterLink href={`${basePrefix}/create-showcase?site_chrome=1`}>Create My Showcase</FooterLink>
        <FooterLink href={`${basePrefix}/contact`} form="home_value">What&apos;s My Home Worth?</FooterLink>
      </FooterColumn>
      {areas && areas.length > 0 && (
        <FooterColumn title="Neighborhoods" classic={classic} delay={0.08}>
          {areas.slice(0, 6).map(a => (
            <FooterLink key={a.slug} href={`${basePrefix}/${a.slug}`}>{a.name}</FooterLink>
          ))}
          {areas.length > 6 && <FooterLink href={`${basePrefix}/neighborhoods`}>All neighborhoods</FooterLink>}
        </FooterColumn>
      )}
    </>
  )
  const rightCols = (
    <>
      <FooterColumn title="Explore" classic={classic} delay={0.12}>
        <FooterLink href={`${basePrefix}/blog`}>Articles &amp; Media</FooterLink>
        {hasReviews && <FooterLink href={`${basePrefix}/testimonials`} spot="foot-reviews">Client Reviews</FooterLink>}
        <FooterLink href={`${basePrefix}/about`}>About {first}</FooterLink>
        <FooterLink href={`${basePrefix}/contact`}>Contact</FooterLink>
      </FooterColumn>
      <FooterColumn title="Get in touch" classic={classic} delay={0.18}>
        {profile?.phone && <li><a href={`tel:${tel}`} className="inline-flex items-center gap-2 transition-colors hover:text-white"><Phone className="h-3.5 w-3.5" style={{ color: 'var(--site-accent)' }} />{profile.phone}</a></li>}
        {profile?.email && <li><a href={`mailto:${profile.email}`} title={profile.email} className="inline-flex max-w-full items-center gap-2 whitespace-nowrap text-[13px] transition-colors hover:text-white"><Mail className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--site-accent)' }} /><span className="truncate">{profile.email}</span></a></li>}
        {socials.length > 0 && (
          <li className="flex flex-wrap gap-2 pt-1">
            {socials.map(link => {
              const Icon = SOCIAL_ICONS[(link.id || '').toLowerCase()] || Globe
              return (
                <a key={link.id || link.url} href={link.url.startsWith('http') ? link.url : `https://${link.url}`} target="_blank" rel="noreferrer" aria-label={link.label || link.id || 'Link'}
                  className="flex h-9 w-9 items-center justify-center rounded-full border transition hover:-translate-y-0.5" style={{ borderColor: classic ? 'var(--site-line-strong)' : 'rgba(255,255,255,.18)' }}>
                  <Icon className="h-4 w-4" />
                </a>
              )
            })}
          </li>
        )}
      </FooterColumn>
    </>
  )

  return (
    <footer className={`ohp-site-footer relative overflow-hidden ${classic ? 'ohp-classic-foot border-t' : 'text-white'}`} style={classic ? { backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-ink)', borderColor: 'var(--site-line)' } : { backgroundColor: theme.primary_color }}>
      <style>{`.ohp-classic-foot-links{color:var(--site-muted)}.ohp-classic-foot-links a:hover{color:var(--site-heading)}
.ohp-foot-sweep{background:linear-gradient(90deg,transparent 30%,var(--site-accent) 50%,transparent 70%);background-size:220% 100%;animation:ohpSiteFootSweep 7s ease-in-out infinite}
@keyframes ohpSiteFootSweep{0%{background-position:160% 0}100%{background-position:-60% 0}}
.ohp-foot-glow{animation:ohpFootGlow 14s ease-in-out infinite alternate}
@keyframes ohpFootGlow{from{transform:translate(0,0) scale(1)}to{transform:translate(60px,-30px) scale(1.15)}}
@media (prefers-reduced-motion:reduce){.ohp-foot-sweep,.ohp-foot-glow{animation:none}}`}</style>
      {!classic ? (<>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--site-accent), transparent)' }} />
        <div className="ohp-foot-sweep pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="ohp-foot-glow pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full opacity-20 blur-3xl" style={{ backgroundColor: 'var(--site-accent)' }} />
        <div className="ohp-foot-glow pointer-events-none absolute -bottom-48 -right-24 h-96 w-96 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: 'var(--site-accent-light)', animationDelay: '-7s' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(70%_60%_at_50%_30%,#000,transparent_75%)]" />
      </>) : (
        <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.07)' }} />
      )}

      {/* 1. Links | closing band | links - one row */}
      <div className={`relative mx-auto grid max-w-7xl grid-cols-1 gap-x-10 gap-y-12 px-5 pt-16 sm:px-6 sm:pt-20 md:grid-cols-2 ${showCta ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)_minmax(0,1fr)] xl:items-start xl:gap-x-12' : ''}`}>
        {showCta && (
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-center md:col-span-2 xl:order-2 xl:col-span-1">
            <p className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: 'var(--site-accent)' }}>Ready when you are</p>
            <h2 className={`mx-auto mt-3 max-w-3xl text-3xl leading-[1.08] sm:text-[2.6rem] ${classic ? 'font-extrabold tracking-tight' : `font-black ${serif}`}`} style={{ color: head }}>
              Let&apos;s talk about your <span className={classic ? '' : 'ohp-text-shimmer'} style={classic ? { color: 'var(--site-accent)' } : undefined}>next move.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm" style={{ color: muted }}>Buying, selling, or just curious what your home is worth - pick one and I&apos;ll take it from there.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {[
                { form: 'home_value', label: "What's my home worth?", icon: DollarSign, primary: true },
                { form: 'buying', label: 'Start my home search', icon: KeyRound },
                { form: 'how_can_i_help', label: 'Book a consultation', icon: CalendarDays },
              ].map(b => (
                <a key={b.form} href={`${basePrefix}/contact`} data-ohp-form={b.form} data-ohp-form-title={b.label}
                  className={`inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 ${classic ? 'rounded-xl' : 'rounded-full'} ${b.primary ? (classic ? 'shadow-md' : 'ohp-gold-sheen shadow-lg') : 'border'}`}
                  style={b.primary ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : { borderColor: classic ? 'var(--site-line-strong)' : 'rgba(255,255,255,.22)', color: head, backgroundColor: classic ? 'var(--site-surface)' : 'rgba(255,255,255,.04)' }}>
                  <b.icon className="h-4 w-4" /> {b.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
        <div className={`grid grid-cols-2 gap-x-10 gap-y-6 [&_a]:whitespace-nowrap ${showCta ? 'xl:order-1' : ''}`}>{leftCols}</div>
        <div className={`grid grid-cols-2 gap-6 md:text-right [&_ul]:md:flex [&_ul]:md:flex-col [&_ul]:md:items-end [&_p]:md:justify-end ${showCta ? 'xl:order-3 xl:grid-cols-1 xl:gap-8' : ''}`}>{rightCols}</div>
      </div>

      {/* 2. The agent, alone at the center */}
      <div className="relative mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16" data-ohp-spot="footer-agent">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          {sigSlug
            ? <div className={classic ? '' : 'dark'}><SignatureSiteCard hubSlug={sigSlug} towns={(areas || []).map(a => a.name)} fallback={agentCard} match={sigMatch} /></div>
            : agentCard}
        </motion.div>
      </div>

      {/* 3. MLS notice + legal */}
      {idxNotice && (
        <div className={`relative mx-auto max-w-7xl border-t px-5 py-6 sm:px-6 ${classic ? 'border-[color:var(--site-line)] text-[color:var(--site-faint)]' : 'border-white/10 text-white/45'}`}>
          <IdxNotice brokerage={profile?.brokerage} />
        </div>
      )}
      <div className={`relative mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 border-t px-5 py-6 text-center text-[11px] sm:flex-row sm:px-6 sm:text-left ${classic ? 'border-[color:var(--site-line)] text-[color:var(--site-faint)]' : 'border-white/10 text-white/40'}`}>
        <p className={fontClass(theme.body_font)}>&copy; {new Date().getFullYear()} {name}{profile?.brokerage ? ` · ${profile.brokerage}` : ''}. All rights reserved.{profile?.license_number ? ` License #${profile.license_number}.` : ''}</p>
        <p className="flex items-center gap-1.5">Equal Housing Opportunity · Powered by <span className={`font-bold ${classic ? 'text-[color:var(--site-muted)]' : 'text-white/60'}`}><OhpWordmark className="text-[1.15em] align-[-0.15em]" /></span></p>
      </div>
    </footer>
  )
}
