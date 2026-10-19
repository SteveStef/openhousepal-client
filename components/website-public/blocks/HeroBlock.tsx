'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bath, BedDouble, DollarSign, KeyRound, MapPin, Mouse, Ruler, Search, Sparkles, TrendingUp } from 'lucide-react'
import { SiteTheme } from '../types'
import { fontClass } from './fontClass'
import { cleanStreet, fullPrice, listedAgo } from '../listingFormat'
import SitePhoto from '../SitePhoto'
import { IMG, sizedBg } from '@/lib/siteImage'

interface ResolvedArea {
  slug: string
  name: string
  state: string
}

export interface HeroHome {
  listing_key: string
  photo?: string | null
  photos?: string[] | null
  price?: number | null
  address?: string | null
  city?: string | null
  state?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  living_area?: number | null
  days_on_market?: number | null
  status?: string | null
  spotlight_url?: string | null
}

// Luxe-only: slow sparks over the hero photo (same motif as the product's own Luxe surfaces).
const SPARKS: [string, string, number][] = [['12%', '28%', 0], ['82%', '22%', 1.4], ['68%', '72%', 2.6], ['24%', '78%', 3.3], ['50%', '14%', 4.1], ['90%', '60%', 1.9]]
const ROTATE_MS = 7000

// The three lead buttons - each opens the agent's matching form in a window (SiteFormLauncher).
const QUICK = [
  { form: 'buying', label: 'Buying', icon: KeyRound },
  { form: 'selling', label: 'Selling', icon: TrendingUp },
  { form: 'home_value', label: "What's my home worth?", icon: DollarSign, primary: true },
]

const facts = (h: HeroHome) => [
  h.bedrooms ? { icon: BedDouble, v: `${h.bedrooms} bd` } : null,
  h.bathrooms ? { icon: Bath, v: `${h.bathrooms} ba` } : null,
  h.living_area ? { icon: Ruler, v: `${Math.round(h.living_area).toLocaleString('en-US')} sqft` } : null,
].filter(Boolean) as { icon: typeof Bath; v: string }[]

// The home page's opening screen. It features the NEWEST homes for sale in the towns the agent
// picked (Featured tab -> "Your header"; default every town they serve), in their price range,
// refreshed on every visit (content_adapters.get_header_listings) - each one a real, clickable
// home with its price, address and how fresh it is. Plus a search box that drives the real
// full-MLS Search tab and the Buying / Selling / Home value forms (opened in a window).
//   luxe    - cinematic full-bleed photos, shimmering headline, a glass "just listed" card and
//             the next homes as thumbnails
//   default - a bright split: words + search on the left, the home on the right as a photo card
export default function HeroBlock({ data, theme, siteId, basePrefix = '' }: { data: Record<string, any>; theme: SiteTheme; siteId?: string; basePrefix?: string }) {
  const luxe = theme.template !== 'default'
  const headline = data.headline || 'Find Your Dream Home'
  const subheadline = data.subheadline || ''

  const homes: HeroHome[] = useMemo(() => (Array.isArray(data.resolved_homes) ? data.resolved_homes : []).filter((h: HeroHome) => h?.photo), [data.resolved_homes])
  const resolvedPhotos: string[] = Array.isArray(data.resolved_photos) ? data.resolved_photos : []
  const resolvedAreas: ResolvedArea[] = Array.isArray(data.resolved_areas) ? data.resolved_areas : []
  const resolvedSuggestions: string[] = Array.isArray(data.resolved_suggestions) ? data.resolved_suggestions : []
  const resolvedMarket = data.resolved_market as string | undefined
  const manualImage = data.image_url as string | undefined
  const manual = data.photo_source_mode === 'manual' && !!manualImage
  // Slides: the header homes (auto), else plain photos (older data / manual photo).
  const slides: { photo: string; home?: HeroHome }[] = manual
    ? [{ photo: manualImage! }]
    : homes.length ? homes.map(h => ({ photo: h.photo as string, home: h }))
      : (resolvedPhotos.length ? resolvedPhotos : manualImage ? [manualImage] : []).map(p => ({ photo: p }))

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  useEffect(() => {
    if (slides.length < 2 || paused) return
    const id = setInterval(() => setIndex(i => (i + 1) % slides.length), ROTATE_MS)
    return () => clearInterval(id)
  }, [slides.length, paused])
  useEffect(() => {
    if (resolvedSuggestions.length < 2) return
    const id = setInterval(() => setSuggestionIndex(i => (i + 1) % resolvedSuggestions.length), 4000)
    return () => clearInterval(id)
  }, [resolvedSuggestions.length])

  const eyebrowText = data.eyebrow || resolvedMarket || (resolvedAreas.length > 0 ? resolvedAreas.map(a => a.name).join(' · ') : 'Welcome Home')
  const activeSuggestion = resolvedSuggestions[suggestionIndex % Math.max(resolvedSuggestions.length, 1)]
  const headlineWords = headline.trim().split(/\s+/).filter(Boolean)
  const headlineGold = headlineWords.length > 2 ? headlineWords.slice(-2) : headlineWords
  const headlinePlain = headlineWords.length > 2 ? headlineWords.slice(0, -2) : []
  const serif = fontClass(theme.heading_font, 'font-serif')
  const showQuickActions = data.show_quick_actions !== 'false' && data.show_quick_actions !== false && !!siteId
  const showSearch = data.show_search !== 'false' && data.show_search !== false && !!siteId
  const current = slides[index % Math.max(slides.length, 1)]
  const home = current?.home
  const homeHref = (h: HeroHome) => h.spotlight_url || `${basePrefix}/properties/${encodeURIComponent(h.listing_key)}`
  const towns = resolvedAreas.slice(0, 5)
  // Only the photo on screen, the one fading out and the next one are in the page - the rest load
  // as their turn comes (it used to download every header photo up front).
  const nearSlide = (i: number) => slides.length < 4 || i === index || i === (index + 1) % slides.length || i === (index - 1 + slides.length) % slides.length
  const upcoming = slides.length > 1 ? [1, 2, 3].map(k => ({ k, s: slides[(index + k) % slides.length] })).filter(x => x.s.home && x.k < slides.length) : []

  const searchForm = (variant: 'luxe' | 'classic') => (
    <form action={`${basePrefix}/search`} method="GET" className={`group/search relative flex items-center gap-2 p-1.5 transition ${variant === 'luxe'
      ? 'rounded-full bg-white/95 shadow-[0_30px_60px_-20px_rgba(0,0,0,.6)] ring-1 ring-white/40 focus-within:ring-2 focus-within:ring-[var(--site-accent)]'
      : 'rounded-2xl border shadow-[0_24px_50px_-30px_rgba(17,24,39,.35)] focus-within:border-[color:var(--site-accent)]'}`}
      style={variant === 'classic' ? { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)' } : undefined}>
      <Search className="ml-3 h-5 w-5 shrink-0 text-gray-400" />
      <input type="text" name="q" placeholder={activeSuggestion || '4 bed homes in Gladwyne under $2M'} aria-label="Search every home for sale"
        className={`min-w-0 flex-1 bg-transparent px-1 py-3 text-[15px] outline-none placeholder:text-gray-400 ${variant === 'luxe' ? 'text-[#111827]' : ''}`} style={variant === 'classic' ? { color: 'var(--site-ink)' } : undefined} />
      <button type="submit" className={`flex shrink-0 items-center gap-2 px-5 py-3 text-sm font-black transition hover:brightness-110 ${variant === 'luxe' ? 'ohp-gold-sheen rounded-full text-white' : 'rounded-xl'}`}
        style={variant === 'luxe' ? { backgroundColor: theme.primary_color } : { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
        <span className="hidden sm:inline">Search</span><ArrowRight className="h-4 w-4" />
      </button>
    </form>
  )

  const townChips = (onDark: boolean) => towns.length > 0 && (
    <div className={`mt-3 flex flex-wrap items-center gap-1.5 ${onDark ? 'justify-center' : ''}`}>
      <span className={`mr-1 text-[11px] font-bold ${onDark ? 'text-white/55' : ''}`} style={onDark ? undefined : { color: 'var(--site-faint)' }}>Popular:</span>
      {towns.map(t => (
        <a key={t.slug} href={`${basePrefix}/search?q=${encodeURIComponent(t.name)}`}
          className={`rounded-full px-3 py-1 text-[12px] font-bold transition hover:-translate-y-0.5 ${onDark ? 'border border-white/20 bg-white/10 text-white/90 hover:bg-white/20' : 'border'}`}
          style={onDark ? undefined : { borderColor: 'var(--site-line-strong)', color: 'var(--site-ink-soft)', backgroundColor: 'var(--site-surface)' }}>{t.name}</a>
      ))}
    </div>
  )

  // ------------------------------------------------------------------ Classic
  if (!luxe) {
    return (
      <section className="relative overflow-hidden px-5 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14" style={{ backgroundColor: 'var(--site-bg)' }}>
        <div className="pointer-events-none absolute -left-40 top-10 h-[30rem] w-[30rem] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(var(--site-accent-rgb),0.08) 0%, rgba(var(--site-accent-rgb),0.08) 40%, transparent 100%)' }} />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-[22rem] w-[40rem] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(var(--site-accent-rgb),0.05) 0%, rgba(var(--site-accent-rgb),0.05) 40%, transparent 100%)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1.08fr] lg:gap-16">
          <div className="ohp-hero-rise">
            <span className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-ink-soft)', backgroundColor: 'var(--site-surface)' }}>
              <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ backgroundColor: 'var(--site-accent)' }} /><span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--site-accent)' }} /></span>
              {eyebrowText}
            </span>
            <h1 className="ohp-site-heading mt-6 text-[2.8rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.6rem]" style={{ color: 'var(--site-heading)' }}>
              {headlinePlain.length > 0 && <>{headlinePlain.join(' ')} </>}
              <span className="relative whitespace-nowrap" style={{ color: 'var(--site-accent)' }}>
                {headlineGold.join(' ')}
                <svg aria-hidden viewBox="0 0 300 12" className="ohp-hero-underline absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none"><path d="M2 9 C 80 2, 220 2, 298 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
              </span>
            </h1>
            {subheadline && <p className={`mt-6 max-w-lg text-lg leading-relaxed ${fontClass(theme.body_font)}`} style={{ color: 'var(--site-muted)' }}>{subheadline}</p>}
            {showSearch && <div className="mt-8 max-w-xl">{searchForm('classic')}{townChips(false)}</div>}
            {showQuickActions && (
              <div className="mt-7 flex flex-wrap gap-2.5">
                {QUICK.map(q => (
                  <a key={q.form} href={`${basePrefix}/contact`} data-ohp-form={q.form} data-ohp-form-title={q.label}
                    className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5 hover:shadow-md"
                    style={q.primary ? { backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)', borderColor: 'transparent' } : { borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)', backgroundColor: 'var(--site-surface)' }}>
                    <q.icon className="h-4 w-4" style={q.primary ? undefined : { color: 'var(--site-accent)' }} />{q.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {slides.length > 0 && (
            <div className="ohp-hero-rise relative" style={{ animationDelay: '.15s' }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              <div className="relative h-[420px] overflow-hidden rounded-[28px] shadow-[0_50px_90px_-45px_rgba(17,24,39,.6)] sm:h-[560px]">
                {slides.map((s, i) => nearSlide(i) && (
                  <SitePhoto key={`${s.photo}-${i}`} src={s.photo} widths={IMG.half} sizes="(min-width: 1024px) 52vw, 100vw" priority={i === 0}
                    className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1400ms] ${i === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'}`} style={{ objectPosition: 'center 40%' }} />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                {home && listedAgo(home.days_on_market) && (
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#111827] shadow">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{listedAgo(home.days_on_market)}
                  </span>
                )}
                {home && (
                  <a key={home.listing_key} href={homeHref(home)} className="ohp-hero-card-in absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 rounded-2xl p-4 shadow-xl sm:inset-x-5 sm:bottom-5 sm:p-5" style={{ backgroundColor: 'color-mix(in srgb, var(--site-surface) 92%, transparent)' }}>
                    <span className="min-w-0">
                      <span className="block text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: 'var(--site-heading)' }}>{fullPrice(home.price)}</span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-sm font-semibold" style={{ color: 'var(--site-muted)' }}><MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--site-accent)' }} />{cleanStreet(home.address, home.city)}{home.city ? `, ${home.city}` : ''}</span>
                      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold" style={{ color: 'var(--site-ink-soft)' }}>{facts(home).map(f => <span key={f.v} className="inline-flex items-center gap-1"><f.icon className="h-3.5 w-3.5" style={{ color: 'var(--site-faint)' }} />{f.v}</span>)}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold sm:inline-flex" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>View home <ArrowRight className="h-4 w-4" /></span>
                  </a>
                )}
                {slides.length > 1 && <span key={`p-${index}-${paused}`} className="ohp-hero-progress absolute inset-x-0 top-0 h-1" style={{ backgroundColor: 'var(--site-accent)', animationDuration: `${ROTATE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }} />}
              </div>
              {upcoming.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {upcoming.map(({ k, s }) => (
                    <button key={`${k}-${s.home!.listing_key}`} type="button" onClick={() => setIndex((index + k) % slides.length)} className="group relative h-20 overflow-hidden rounded-2xl text-left sm:h-24">
                      <span className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-110" style={{ backgroundImage: sizedBg(s.photo, 384) }} />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <span className="absolute bottom-2 left-2.5 text-[12px] font-extrabold text-white sm:text-sm">{fullPrice(s.home!.price)}</span>
                    </button>
                  ))}
                </div>
              )}
              {homes.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--site-faint)' }}><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />The newest homes for sale{towns.length ? ` in ${towns.slice(0, 3).map(t => t.name).join(', ')}` : ''} - updated live</p>}
            </div>
          )}
        </div>
      </section>
    )
  }

  // ------------------------------------------------------------------ Luxe
  return (
    <section
      className="relative flex min-h-[92vh] flex-col overflow-hidden text-white"
      style={slides.length > 0 ? { backgroundColor: theme.primary_color } : { background: `linear-gradient(135deg, ${theme.primary_color}, #05070c 65%, ${theme.primary_color})` }}
    >
      {slides.map((s, i) => nearSlide(i) && (
        <div key={`${s.photo}-${i}`} className={`absolute inset-0 overflow-hidden transition-opacity duration-[1600ms] ${i === index ? 'opacity-100' : 'opacity-0'}`}>
          <SitePhoto src={s.photo} widths={IMG.hero} sizes="100vw" priority={i === 0} className={`absolute inset-0 h-full w-full object-cover ${i === index ? 'ohp-hero-kenburns' : ''}`} style={{ objectPosition: 'center 35%' }} />
        </div>
      ))}
      {slides.length > 0 && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_25%,rgba(0,0,0,0.55)_100%)]" />
        </>
      )}
      <div className="ohp-lx-grid pointer-events-none absolute inset-0" />
      <div className="ohp-lx-aurora-a pointer-events-none absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(var(--site-accent-rgb),0.22) 0%, rgba(var(--site-accent-rgb),0.22) 40%, transparent 100%)' }} />
      <div className="ohp-lx-aurora-b pointer-events-none absolute -top-40 right-[12%] h-[22rem] w-[34rem] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(var(--site-accent-rgb),0.14) 0%, rgba(var(--site-accent-rgb),0.14) 40%, transparent 100%)' }} />
      {SPARKS.map((sp, k) => <span key={k} className="ohp-lx-spark pointer-events-none absolute" style={{ left: sp[0], top: sp[1], animationDelay: `${sp[2]}s` }} />)}

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pt-28 sm:px-6 sm:pt-32">
        <div className="ohp-hero-rise mx-auto my-auto w-full max-w-3xl text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Sparkles className="hidden h-4 w-4 shrink-0 sm:block" style={{ color: 'var(--site-accent-light)' }} />
            <span className="h-px w-6 shrink-0 sm:w-8" style={{ backgroundColor: 'var(--site-accent)' }} />
            <span className="text-[11px] font-black uppercase tracking-[0.26em] sm:text-xs sm:tracking-[0.3em]" style={{ color: 'var(--site-accent-light)' }}>{eyebrowText}</span>
            <span className="h-px w-6 shrink-0 sm:w-8" style={{ backgroundColor: 'var(--site-accent)' }} />
            <Sparkles className="hidden h-4 w-4 shrink-0 sm:block" style={{ color: 'var(--site-accent-light)' }} />
          </div>
          <h1 className={`mx-auto max-w-3xl text-[2.6rem] font-black leading-[1.05] sm:text-6xl lg:text-7xl ${serif}`}>
            {headlinePlain.length > 0 && <span className="block text-white">{headlinePlain.join(' ')}</span>}
            <span className="ohp-text-shimmer block">{headlineGold.join(' ')}</span>
          </h1>
          {subheadline && <p className={`mx-auto mt-5 max-w-xl text-lg text-white/80 sm:text-xl ${fontClass(theme.body_font)}`}>{subheadline}</p>}
          {showSearch && <div className="mx-auto mt-9 w-full max-w-[40rem]">{searchForm('luxe')}{townChips(true)}</div>}
          {showQuickActions && (
            <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
              {QUICK.map(q => (
                <a key={q.form} href={`${basePrefix}/contact`} data-ohp-form={q.form} data-ohp-form-title={q.label}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-[12px] font-black uppercase tracking-[0.12em] transition hover:-translate-y-0.5 ${q.primary ? 'ohp-gold-sheen' : 'border border-white/25 bg-white/10 text-white hover:bg-white/20'}`}
                  style={q.primary ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : undefined}>
                  <q.icon className="h-4 w-4" />{q.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* The home on screen right now + what's next */}
        <div className="mt-10 flex flex-col items-stretch gap-4 pb-10 sm:pb-12 lg:flex-row lg:items-end lg:justify-between" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          {home ? (
            <a key={home.listing_key} href={homeHref(home)} className="ohp-hero-card-in group relative w-full overflow-hidden rounded-3xl border border-white/15 bg-black/35 p-5 transition hover:border-white/30 lg:max-w-md">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent-light)' }}>
                <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>
                {listedAgo(home.days_on_market) || 'Newest on the market'}
              </span>
              <span className={`mt-2 block text-3xl font-black ${serif}`}>{fullPrice(home.price)}</span>
              <span className="mt-1 block truncate text-sm font-semibold text-white/75">{cleanStreet(home.address, home.city)}{home.city ? `, ${home.city}` : ''}</span>
              <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-white/70">
                {facts(home).map(f => <span key={f.v} className="inline-flex items-center gap-1.5"><f.icon className="h-3.5 w-3.5" style={{ color: 'var(--site-accent-light)' }} />{f.v}</span>)}
                <span className="ml-auto inline-flex items-center gap-1 text-white transition group-hover:translate-x-0.5">View home <ArrowRight className="h-3.5 w-3.5" /></span>
              </span>
              {slides.length > 1 && <span key={`p-${index}-${paused}`} className="ohp-hero-progress absolute inset-x-0 bottom-0 h-0.5" style={{ backgroundColor: 'var(--site-accent)', animationDuration: `${ROTATE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }} />}
            </a>
          ) : <span />}
          {upcoming.length > 0 && (
            <div className="hidden items-end gap-3 lg:flex">
              <span className="mr-1 pb-1 text-right text-[10px] font-black uppercase tracking-[0.24em] text-white/50">Up next</span>
              {upcoming.map(({ k, s }) => (
                <button key={`${k}-${s.home!.listing_key}`} type="button" onClick={() => setIndex((index + k) % slides.length)} className="group relative h-24 w-36 overflow-hidden rounded-2xl ring-1 ring-white/15 transition hover:-translate-y-1 hover:ring-white/40">
                  <span className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-110" style={{ backgroundImage: sizedBg(s.photo, 384) }} />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <span className="absolute bottom-2 left-2.5 text-left">
                    <span className="block text-[13px] font-black">{fullPrice(s.home!.price)}</span>
                    <span className="block max-w-[7.5rem] truncate text-[10px] font-semibold text-white/70">{s.home!.city}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {!home && slides.length > 0 && (
            <div className="flex flex-col items-center gap-1.5 self-center text-white/50">
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Scroll to Explore</span>
              <Mouse className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${theme.secondary_color}aa, transparent)` }} />
      {/* SiteHeader watches this to know when the hero has scrolled out of view. */}
      <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
    </section>
  )
}
