'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bath, BedDouble, Check, ChevronDown, Home, KeyRound, LandPlot, Loader2, LucideIcon, MapPin, Ruler, Sparkles, ThumbsDown, ThumbsUp, TrendingDown, TrendingUp } from 'lucide-react'
import { FormQuestion, LinkedProperty } from '@/types'
import GooglePlacesAutocomplete from '@/components/GooglePlacesAutocomplete'
import MultiSelectDatabaseInput from '@/components/MultiSelectDatabaseInput'
import ListingAddressInput from '@/components/forms/ListingAddressInput'
import SearchableSelect from '@/components/forms/SearchableSelect'
import api from '@/lib/api-service'
import { formatNumberWithCommas, sanitizeNumericInput, stripCommas } from '@/lib/utils'
import { FORM_LOOK_CSS, formLookClass, formLookVars, formPaint, type FormLook } from '@/lib/formLook'

export interface FormRunnerBranding {
  title: string
  subtitle?: string | null
  accentColor?: string | null
  showBranding?: boolean
  agentName: string
  agentBrokerage: string
  agentPhotoUrl?: string | null
  agentTitle?: string | null
  agentMarket?: string | null
}

interface FormRunnerProps {
  /** The form's id - lets the "which home?" question put the agent's own listings first. */
  formId?: string
  questions: FormQuestion[]
  branding: FormRunnerBranding
  successHeading: string
  successMessage?: string | null
  linkedProperty?: LinkedProperty | null
  propertyPhotoCarousel?: boolean
  // redirectUrl (showcase_request only) is set when the submission auto-built a Showcase - the
  // visitor gets sent straight there instead of just seeing the thank-you screen.
  onSubmit: (answers: { questionId: string; value: unknown }[]) => Promise<{ success: boolean; message?: string; redirectUrl?: string }>
  // Fires once when the intro is shown (stepIndex 0) and again each time the visitor advances to
  // a new question, plus once more with completed:true right after a successful submit - feeds
  // the per-form Stats view/completion-rate/drop-off funnel. Not called in the builder preview
  // (no focusBlockId/onProgress passed there). `answers` = everything answered so far (non-empty
  // only), also re-sent a moment after they type and when they leave the page - so a half-finished
  // form still shows the agent what was filled in (Stats -> Unfinished).
  onProgress?: (stepIndex: number, questionId: string | null, completed?: boolean, answers?: Record<string, unknown>) => void
  // When this changes (e.g. the builder's selected block), jump the preview to that block: 'welcome', 'thankyou', or a question id.
  focusBlockId?: string | null
  agentHubRedirect?: { enabled: boolean; url: string } | null
  // Opened in a window over another page (the signature card's form buttons): called a moment
  // after the thank-you screen shows so the host can close the window, instead of redirecting.
  onComplete?: () => void
  // Answers the page already knows, by question id (e.g. the home a showing is being asked for) -
  // filled in before the visitor starts, never over anything they typed.
  prefill?: Record<string, string>
  redirectDelayMs?: number
  redirectTarget?: '_self' | '_top'
  forceLightMode?: boolean
  backgroundEffects?: boolean
  welcomeTextEffects?: boolean
  // 'top'/'bottom'/'split'/'split_reverse' only matter when both agent branding and a linked
  // property are shown together on question pages: 'top' = combined block above the question,
  // 'bottom' = combined block below it, 'split' = property header above / agent footer below,
  // 'split_reverse' = agent header above / property footer below. Meaningless (ignored) with just
  // one of the two. 'integrated' is a different rendering mode entirely (applies regardless of
  // whether one or both of branding/property are present): the whole flow — property info, agent
  // branding, progress, and the current question — renders as one boxed card, matching the Open
  // House guest sign-in widget's look.
  brandingLayout?: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated'
  // Shows a small "what you'll get" mock-up of the personalized property Showcase on the welcome
  // screen, right where the visitor decides whether to bother starting - only meaningful for the
  // showcase_request form, so callers pass this explicitly rather than it being inferred here.
  showcasePreview?: boolean
  // A few of the agent's real recent sales, used to illustrate that preview with actual homes
  // instead of placeholder tiles. Only relevant when showcasePreview is true.
  exampleProperties?: { address: string; city?: string | null; price?: number | null; image?: string | null }[] | null
  /** The form's look (Classic colour / Luxe finish, lib/formLook) - absent = the plain accent colour. */
  look?: FormLook | null
}

type AnswerValue = string | string[]
type AnswersState = Record<string, AnswerValue>

type NumericTextMeta = {
  id?: string
  label?: string
  placeholder?: string | null
  unit?: string | null
  section_title?: string | null
  helper_text?: string | null
}

const NUMERIC_TEXT_FIELD_RE = /\b(price|budget|value|worth|sq\s*ft|sqft|square\s*(foot|feet|footage)|footage)\b/i

function shouldFormatNumericText(field: NumericTextMeta): boolean {
  return NUMERIC_TEXT_FIELD_RE.test([
    field.id,
    field.label,
    field.placeholder,
    field.unit,
    field.section_title,
    field.helper_text,
  ].filter(Boolean).join(' '))
}

function stripCommasFromNumericText(value: string): string {
  return value.replace(/(\d),(?=\d)/g, '$1')
}

function formatNumericTextWithCommas(value: string): string {
  return value.replace(/\d[\d,]*(?:\.\d*)?/g, token => {
    const raw = stripCommas(token)
    if (!raw || raw.endsWith('.') || isNaN(Number(raw))) return token
    return formatNumberWithCommas(raw)
  })
}

// MLS feeds in this app occasionally suffix the raw status with the source name (e.g. "Active-Bright") — normalize it.
function formatPropertyStatus(status?: string | null) {
  const clean = String(status || '').replace(/-BRIGHT/gi, '').replace(/_/g, ' ').trim()
  const lower = clean.toLowerCase()
  if (lower.includes('under contract')) return 'Under Contract'
  if (lower.includes('active')) return 'Active'
  if (lower.includes('pending')) return 'Pending'
  if (lower.includes('closed') || lower.includes('sold')) return 'Sold'
  if (lower.includes('off market') || lower.includes('off-market')) return 'Off Market'
  if (lower.includes('coming soon')) return 'Coming Soon'
  return clean
}

function getPropertyStatusClass(status?: string | null) {
  const clean = formatPropertyStatus(status).toLowerCase()
  if (clean === 'active') return 'bg-emerald-100 text-emerald-700'
  if (clean === 'coming soon') return 'bg-[#111827] text-white'
  if (clean === 'pending' || clean === 'under contract') return 'bg-yellow-400 text-[#111827]'
  if (clean === 'off market') return 'bg-gray-500 text-white'
  if (clean === 'sold') return 'bg-rose-500 text-white'
  return 'bg-white/95 text-[#111827]'
}

// Welcome / Thank You screen treatment: a modern card — photo with just address + price overlaid, everything else below it.
// When cyclePhotos is on, flips through up to the first 10 listing photos, 4s each, looping.
function PropertyHeroCard({ property, size = 'default', showCheckmark = false, accent, cyclePhotos = false }: { property: LinkedProperty; size?: 'default' | 'large'; showCheckmark?: boolean; accent?: string; cyclePhotos?: boolean }) {
  const location = [property.city, property.state].filter(Boolean).join(', ')
  const statusLabel = formatPropertyStatus(property.status)
  const isLarge = size === 'large'
  const photos = useMemo(() => {
    const list = (property.photos && property.photos.length > 0 ? property.photos : property.image_url ? [property.image_url] : []).slice(0, 10)
    return list.length > 0 ? list : ['/placeholder.jpg']
  }, [property.photos, property.image_url])
  const [photoIndex, setPhotoIndex] = useState(0)

  useEffect(() => {
    setPhotoIndex(0)
    if (!cyclePhotos || photos.length <= 1) return
    const interval = setInterval(() => {
      setPhotoIndex(current => (current + 1) % photos.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [cyclePhotos, photos])

  return (
    <div className={`mt-5 w-full overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517] ${isLarge ? 'max-w-md' : 'max-w-sm'}`}>
      <div className={`relative w-full overflow-hidden ${isLarge ? 'h-[240px]' : 'h-[200px]'}`}>
        <AnimatePresence>
          <motion.div
            key={photoIndex}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${photos[photoIndex]})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/5" />
        {property.status && (
          <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${getPropertyStatusClass(property.status)}`}>
            {statusLabel}
          </span>
        )}
        {showCheckmark && (
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-xl ring-4 ring-white/90"
              data-fill="" style={{ backgroundColor: accent }}
            >
              <Check className="h-8 w-8" />
            </div>
          </motion.div>
        )}
        <div className={`absolute inset-x-0 bottom-0 text-left text-white ${isLarge ? 'px-6 pt-6 pb-4' : 'px-5 pt-5 pb-3'}`}>
          <p className={`font-black leading-none tracking-tight ${isLarge ? 'text-3xl' : 'text-2xl'}`}>
            {property.price ? `$${Number(property.price).toLocaleString()}` : 'Price upon request'}
          </p>
          <p className="mt-1.5 truncate text-sm font-bold text-white/90">{property.address}</p>
        </div>
      </div>
      {(property.beds || property.baths || property.sqft || location) && (
        <div className={`flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-wide text-[#6B7280] dark:text-gray-400 ${isLarge ? 'px-6 py-4' : 'px-5 py-3.5'}`}>
          <div className="flex min-w-0 items-center gap-3">
            {property.beds ? <span className="shrink-0">{property.beds} bd</span> : null}
            {property.baths ? <span className="shrink-0">{property.baths} ba</span> : null}
            {property.sqft ? <span className="shrink-0">{Number(property.sqft).toLocaleString()} sqft</span> : null}
          </div>
          {location && (
            <span className="truncate normal-case tracking-normal text-[#8b7355] dark:text-[#d7b974]">{location}</span>
          )}
        </div>
      )}
    </div>
  )
}

const CONFETTI_COLORS = ['#d2b16f', '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#816937']

const EDGE_FADE = 'linear-gradient(to bottom, transparent 0, #000 72px, #000 calc(100% - 72px), transparent 100%)'

export function WelcomeMotionBackdrop({ accent, light = false, intro = false }: { accent: string; light?: boolean; intro?: boolean }) {
  // Forced light (an IDX site page): the outer page can still carry the app's `dark` class, so
  // every dark: style here is dropped instead of rendering dark panels on a light form.
  const lt = (c: string) => (light ? c.split(/\s+/).filter(x => !x.startsWith('dark:')).join(' ') : c)
  const particles = [
    { className: 'left-[7%] top-[10%] h-44 w-44', delay: 0, x: 18, y: -18 },
    { className: 'right-[7%] top-[18%] h-52 w-52', delay: 0.3, x: -22, y: -16 },
    { className: 'bottom-[8%] left-[16%] h-56 w-56', delay: 0.6, x: 20, y: 18 },
  ]
  // Spread clear of the two big panels below (top-left listing card, bottom-right route card) and
  // of each other - these used to cluster in the same corners as those panels (e.g. "Tour Ready"
  // sat right on top of the route card's own corner), which read as one jumbled smudge instead of
  // separate floating pieces.
  // `phone`: where it sits on a phone - only on the welcome screen, in the space kept clear above
  // the title (so nothing overlaps the content); null = desktop only.
  const floatingCards = [
    { className: 'sm:left-[2%] sm:bottom-[6%]', phone: 'max-sm:left-3 max-sm:top-3', delay: 0.15, label: 'New Match', value: '$825K', icon: Home },
    { className: 'sm:right-[4%] sm:top-[6%]', phone: null, delay: 0.45, label: 'Near Parks', value: '0.4 mi', icon: MapPin },
    { className: 'sm:left-[calc(50%-66px)] sm:top-[3%]', phone: 'max-sm:right-3 max-sm:top-3', delay: 0.75, label: 'Tour Ready', value: 'Today', icon: Sparkles },
  ]
  // Panel fills/strokes are strong enough to read on both the light theme's near-white backdrop
  // and the dark theme's near-black one - the old sketch panels here used a white/30-35 fill,
  // which is essentially invisible against the light theme's own near-white background.
  const panelShell = lt('border border-white/80 bg-white/85 shadow-[0_24px_70px_rgba(17,24,39,0.10)] dark:border-white/10 dark:bg-[#171719]/75')
  const lineStroke = lt('border-[#111827]/25 dark:border-white/20')
  const lineStrokeSvg = lt('stroke-[#111827]/25 dark:stroke-white/20')

  // -z-10 (not just "absolute", which leaves z-index:auto) - a positioned element with z-index:
  // auto still paints ABOVE plain non-positioned siblings regardless of DOM order (the progress
  // bar/top bar/question content below are all plain non-positioned divs), which was letting this
  // decorative backdrop render on top of the real form content instead of behind it.
  // The tint + grid fade out at the very top and bottom, so the page's edges are exactly its plain
  // background - the colour a phone shows when you pull past them (user, 10/18: a line there).
  const edgeFade = { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 22% 18%, ${accent}2E, transparent 32%), radial-gradient(circle at 82% 22%, ${accent}26, transparent 30%), radial-gradient(circle at 50% 92%, ${accent}1C, transparent 38%), linear-gradient(180deg, ${accent}12, transparent 52%)`,
          ...edgeFade,
        }}
      />
      <div className={lt('absolute inset-0 bg-[linear-gradient(90deg,rgba(17,24,39,0.055)_1px,transparent_1px),linear-gradient(180deg,rgba(17,24,39,0.055)_1px,transparent_1px)] bg-[size:44px_44px] opacity-80 dark:opacity-25')} style={edgeFade} />

      {/* Listing card: a little house with a warm glinting window and a rising-value tag */}
      <motion.div
        aria-hidden
        className={`absolute -left-6 top-28 hidden h-64 w-60 rounded-[2rem] p-5 sm:block ${panelShell}`}
        initial={{ opacity: 0, rotate: -6, y: 18 }}
        animate={{ opacity: 1, rotate: [-6, -3, -6], y: [0, -10, 0] }}
        transition={{ opacity: { duration: 0.8 }, rotate: { duration: 9, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 9, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1F`, color: accent }}>
            <Home className="h-4 w-4" />
          </span>
          <span className={lt('text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400')}>For Sale</span>
        </div>
        <div className="relative mx-auto mt-5 h-24 w-32">
          <div className={`absolute inset-x-2 bottom-0 h-14 rounded-t-sm border-2 ${lineStroke}`} />
          <div className={`absolute left-1/2 top-0 h-12 w-12 -translate-x-1/2 rotate-45 border-l-2 border-t-2 ${lineStroke}`} />
          <div className="absolute bottom-0 left-[40%] h-7 w-5 rounded-t-sm" data-fill="" style={{ backgroundColor: accent }} />
          <motion.span
            className="absolute bottom-8 right-[26%] h-2.5 w-2.5 rounded-[2px]"
            data-fill="" style={{ backgroundColor: accent }}
            animate={{ opacity: [0.25, 0.9, 0.25] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className={lt('text-sm font-black text-[#111827] dark:text-white')}>$825,000</span>
          <span className={lt('flex items-center gap-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400')}>
            <TrendingUp className="h-3 w-3" /> 4.2%
          </span>
        </div>
      </motion.div>

      {/* Nearby/route card: a pin at the end of an animated route across a mini map */}
      <motion.div
        aria-hidden
        className={`absolute -right-8 bottom-6 hidden h-52 w-64 rounded-[2rem] p-5 sm:block ${panelShell}`}
        initial={{ opacity: 0, rotate: 6, y: 20 }}
        animate={{ opacity: 1, rotate: [6, 3, 6], y: [0, 12, 0] }}
        transition={{ opacity: { duration: 0.8, delay: 0.2 }, rotate: { duration: 10, repeat: Infinity, ease: 'easeInOut' }, y: { duration: 10, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1F`, color: accent }}>
            <MapPin className="h-4 w-4" />
          </span>
          <span className={lt('text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400')}>Nearby &amp; Ready</span>
        </div>
        <svg viewBox="0 0 200 90" className="mt-2 h-20 w-full" fill="none">
          <motion.path
            d="M8 76 C 60 20, 120 88, 192 18"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="7 8"
            className={lineStrokeSvg}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2.2, delay: 0.4, repeat: Infinity, repeatDelay: 1, ease: 'easeInOut' }}
          />
          <circle cx="8" cy="76" r="4" fill={accent} />
          <motion.circle
            cx="192" cy="18" r="5" fill={accent}
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
        <div className="mt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-gray-400">
          <span>0.4 mi to park</span>
          <span className={lt('text-[#111827] dark:text-white')}>A+ schools</span>
        </div>
      </motion.div>

      {particles.map((particle, index) => (
        <motion.span
          key={index}
          className={`absolute rounded-full blur-3xl ${particle.className}`}
          style={{ backgroundColor: `${accent}34` }}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: [0.28, 0.48, 0.28], scale: [0.92, 1.08, 0.92], x: [0, particle.x, 0], y: [0, particle.y, 0] }}
          transition={{ duration: 8, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {floatingCards.map(card => {
        const Icon = card.icon
        const onPhone = intro && card.phone
        return (
          <motion.div
            key={card.label}
            className={lt(`absolute ${onPhone ? `block ${card.phone}` : 'hidden'} min-w-[118px] rounded-2xl border border-white/80 bg-white/80 p-2.5 text-left shadow-[0_18px_50px_rgba(17,24,39,0.12)] dark:border-white/10 dark:bg-[#171719]/80 sm:block sm:min-w-[132px] sm:p-3 ${card.className}`)}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: [0, -9, 0], scale: 1 }}
            transition={{ opacity: { duration: 0.55, delay: card.delay }, y: { duration: 5.8, delay: card.delay, repeat: Infinity, ease: 'easeInOut' }, scale: { duration: 0.55, delay: card.delay } }}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}1F`, color: accent }}>
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-[10px] font-black uppercase tracking-widest text-gray-400">{card.label}</span>
                <span className={lt('block text-sm font-black text-[#111827] dark:text-white')}>{card.value}</span>
              </span>
            </div>
          </motion.div>
        )
      })}
      {/* Sits in the gap between the top-left listing panel and the bottom-left "New Match" card,
          instead of on top of the listing panel like before. */}
      <motion.div
        className={lt('absolute left-[3%] top-[58%] hidden h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/80 shadow-lg dark:border-white/10 dark:bg-white/10 sm:flex')}
        initial={{ opacity: 0, y: 12, rotate: -8 }}
        animate={{ opacity: 1, y: [0, -8, 0], rotate: [-8, -2, -8] }}
        transition={{ opacity: { duration: 0.7, delay: 0.25 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <Sparkles className="h-5 w-5" style={{ color: accent }} />
      </motion.div>
      {/* Sits in the gap between the top-right "Near Parks" card and the bottom-right route panel,
          instead of stacked on either. */}
      <motion.div
        className={lt('absolute right-[5%] top-[46%] hidden h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/80 shadow-lg dark:border-white/10 dark:bg-white/10 sm:flex')}
        initial={{ opacity: 0, y: 16, rotate: 8 }}
        animate={{ opacity: 1, y: [0, 10, 0], rotate: [8, 3, 8] }}
        transition={{ opacity: { duration: 0.7, delay: 0.45 }, y: { duration: 6, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <KeyRound className="h-5 w-5" style={{ color: accent }} />
      </motion.div>
    </div>
  )
}

// One-shot celebratory burst shown on the thank-you screen.
function ConfettiBurst() {
  const pieces = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2.4 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 140,
    rotate: 180 + Math.random() * 540,
    size: 6 + Math.random() * 5,
    round: i % 3 === 0,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  })), [])
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {pieces.map(piece => (
        <motion.span
          key={piece.id}
          className={piece.round ? 'absolute rounded-full' : 'absolute rounded-sm'}
          style={{ left: `${piece.left}%`, top: -20, width: piece.size, height: piece.round ? piece.size : piece.size * 0.4, backgroundColor: piece.color }}
          initial={{ y: 0, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '105vh', x: piece.drift, opacity: [1, 1, 0], rotate: piece.rotate }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}

// Question pages: agent identity and property info. Shown alone, each keeps its own shape (agent
// stays a pill, property stays a rectangle). When both are on, they merge into a single rectangle
// split by a divider so they read as one connected block instead of two separate shapes.
function QuestionBrandBar({ branding, property, accent }: { branding?: FormRunnerBranding | null; property?: LinkedProperty | null; accent: string }) {
  const showBranding = Boolean(branding && branding.showBranding !== false)
  const showProperty = Boolean(property)
  if (!showBranding && !showProperty) return null
  const combined = showBranding && showProperty
  const statusLabel = property ? formatPropertyStatus(property.status) : ''
  const priceDrop = property && property.original_price && property.price && property.original_price > property.price
    ? property.original_price - property.price
    : 0
  const isChip = (chip: { icon: LucideIcon; label: string } | null): chip is { icon: LucideIcon; label: string } => Boolean(chip)
  // Numbers only, no unit letters (bd/ba/sqft/ac) - the icon itself communicates the unit, which
  // keeps all four stats short enough to sit on one row without pushing the card wider.
  const statChips = property ? [
    property.beds ? { icon: BedDouble, label: `${property.beds}` } : null,
    property.baths ? { icon: Bath, label: `${property.baths}` } : null,
    property.sqft ? { icon: Ruler, label: `${Number(property.sqft).toLocaleString()}` } : null,
    property.acres ? { icon: LandPlot, label: `${property.acres}` } : null,
  ].filter(isChip) : []
  const cardHeight = 'h-[72px]'

  const agentContent = branding && (
    <>
      {branding.agentPhotoUrl ? (
        <img src={branding.agentPhotoUrl} alt={branding.agentName} className="aspect-square h-[80%] shrink-0 rounded-full object-cover shadow-sm" />
      ) : (
        <div className="flex aspect-square h-[80%] shrink-0 items-center justify-center rounded-full text-base font-black text-white shadow-sm" data-fill="" style={{ backgroundColor: accent }}>
          {getInitials(branding.agentName)}
        </div>
      )}
      <div className="min-w-0 text-left">
        <p className="truncate font-serif text-base font-black leading-tight text-[#0B0B0B] dark:text-white">{branding.agentName}</p>
        <p className="mt-1 truncate text-[11px] font-black uppercase tracking-wide dark:!text-[#d7b974]" style={{ color: accent }}>
          {[branding.agentBrokerage, branding.agentTitle].filter(Boolean).join(' · ')}
        </p>
        {branding.agentMarket && (
          <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold text-gray-500 dark:!text-gray-300">
            <MapPin className="h-3 w-3 shrink-0" style={{ color: accent }} /> <span className="truncate">{branding.agentMarket}</span>
          </p>
        )}
      </div>
    </>
  )

  const propertyContent = property && (
    <>
      <div className="relative h-full w-24 shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800">
        {property.image_url ? (
          <img src={property.image_url} alt={property.address} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white" data-fill="" style={{ backgroundColor: accent }}>
            <Home className="h-5 w-5" />
          </div>
        )}
        {property.status && (
          <span className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide shadow-sm ${getPropertyStatusClass(property.status)}`}>
            {statusLabel}
          </span>
        )}
        {property.city && (
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1 pb-1 pt-3"
          >
            <MapPin className="h-2.5 w-2.5 shrink-0 text-white" />
            <span className="truncate text-[9px] font-black uppercase tracking-wide text-white">{property.city}</span>
          </motion.div>
        )}
      </div>
      <div className="flex h-full min-w-0 flex-col justify-center gap-1.5 p-2 text-left">
        <p className="truncate text-xs font-black leading-tight text-[#0B0B0B] dark:text-white">{property.address}</p>
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <p className="text-base font-black leading-none tracking-tight text-[#0B0B0B] dark:!text-white">
            {property.price ? `$${Number(property.price).toLocaleString()}` : 'Price upon request'}
          </p>
          {priceDrop > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-rose-600 dark:!text-rose-400">
              <TrendingDown className="h-2.5 w-2.5" /> ${priceDrop.toLocaleString()}
            </span>
          )}
        </div>
        {statChips.length > 0 && (
          <div className="flex items-center gap-1.5">
            {statChips.map(({ icon: StatIcon, label }, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-black text-[#111827] dark:bg-white/10 dark:!text-white"
              >
                <StatIcon className="h-2.5 w-2.5" /> {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  )

  if (combined) {
    // Side-by-side splits the width in half, which cuts off agent/property text on mobile - so
    // when both are on, stack them instead: agent as a header row, property as a footer row, each
    // keeping its own full-width row. The content group within each row is centered (not pinned to
    // the left edge) so a full-width row doesn't read as lopsided.
    return (
      <div className="mx-auto flex w-full max-w-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
        <div className={`flex ${cardHeight} min-w-0 items-center justify-center px-4`}>
          <div className="flex h-full min-w-0 items-center gap-3">{agentContent}</div>
        </div>
        <div className="h-px w-full shrink-0 bg-gray-100 dark:bg-gray-800" />
        <div className={`flex ${cardHeight} min-w-0 items-center justify-center`}>
          <div className="flex h-full min-w-0 items-stretch">{propertyContent}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {showBranding && (
        <div className={`mx-auto flex ${cardHeight} w-fit max-w-full min-w-0 items-center gap-3 rounded-full border border-gray-100 bg-white py-2 pl-2 pr-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]`}>
          {agentContent}
        </div>
      )}
      {showProperty && (
        <div className={`mx-auto flex ${cardHeight} w-fit max-w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]`}>
          {propertyContent}
        </div>
      )}
    </div>
  )
}

// Property card for the 'integrated' layout's question-page header — centered under the agent bio
// (not a full-width bar), with the city/location overlay on the photo and beds/baths/sqft/acres as icon chips.
function IntegratedPropertyCard({ property, accent }: { property: LinkedProperty; accent: string }) {
  const statusLabel = formatPropertyStatus(property.status)
  const statChips = [
    property.beds ? { icon: BedDouble, label: `${property.beds}` } : null,
    property.baths ? { icon: Bath, label: `${property.baths}` } : null,
    property.sqft ? { icon: Ruler, label: `${Number(property.sqft).toLocaleString()}` } : null,
    property.acres ? { icon: LandPlot, label: `${property.acres}` } : null,
  ].filter((chip): chip is { icon: LucideIcon; label: string } => Boolean(chip))

  return (
    <div className="mx-auto flex h-28 w-fit max-w-full items-stretch overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <div className="relative h-full w-28 shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800">
        {property.image_url ? (
          <img src={property.image_url} alt={property.address} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white" data-fill="" style={{ backgroundColor: accent }}>
            <Home className="h-6 w-6" />
          </div>
        )}
        {property.status && (
          <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide shadow-sm ${getPropertyStatusClass(property.status)}`}>
            {statusLabel}
          </span>
        )}
        {property.city && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1 pb-1.5 pt-4">
            <MapPin className="h-3 w-3 shrink-0 text-white" />
            <span className="truncate text-[10px] font-black uppercase tracking-wide text-white">{property.city}</span>
          </div>
        )}
      </div>
      <div className="flex h-full min-w-0 flex-col justify-center gap-2 p-4 text-left">
        <p className="truncate text-sm font-black leading-tight text-[#0B0B0B] dark:text-white">{property.address}</p>
        <p className="text-lg font-black leading-none tracking-tight text-[#0B0B0B] dark:!text-white">
          {property.price ? `$${Number(property.price).toLocaleString()}` : 'Price upon request'}
        </p>
        {statChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {statChips.map(({ icon: StatIcon, label }, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-black text-[#111827] dark:bg-white/10 dark:!text-white"
              >
                <StatIcon className="h-3 w-3" /> {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Rich, centered agent identity block — used on the welcome screen and the thank-you screen so both match.
// `tight` (used only for the Showcase Request welcome screen) keeps every field but shrinks the
// photo/fonts/gaps so the whole block takes noticeably less vertical room.
export function AgentProfileBlock({ branding, accent, tight = false }: { branding: FormRunnerBranding; accent: string; tight?: boolean }) {
  if (branding.showBranding === false) return null

  const photoSize = tight ? 'h-11 w-11' : 'h-16 w-16'
  return (
    <div>
      {branding.agentPhotoUrl ? (
        <img
          src={branding.agentPhotoUrl}
          alt={branding.agentName}
          className={`mx-auto ${photoSize} rounded-full border-2 object-cover p-1 shadow-sm`}
          style={{ borderColor: accent }}
        />
      ) : (
        <div
          className={`mx-auto flex ${photoSize} items-center justify-center rounded-full border-2 font-black text-white shadow-sm ${tight ? 'text-sm' : 'text-lg'}`}
          data-fill="" style={{ borderColor: accent, backgroundColor: accent }}
        >
          {getInitials(branding.agentName)}
        </div>
      )}
      {branding.agentBrokerage && (
        <div className={`inline-flex rounded-full border border-gray-200 bg-white font-black uppercase tracking-wide text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974] ${tight ? '-mt-1 px-2 py-0.5 text-[8px]' : '-mt-1.5 px-2.5 py-0.5 text-[10px]'}`}>
          {branding.agentBrokerage}
        </div>
      )}
      <h2 className={`font-serif font-black leading-none tracking-tight text-[#111827] dark:text-white ${tight ? 'mt-1 text-lg sm:text-xl' : 'mt-3 text-2xl sm:text-[26px]'}`}>
        {branding.agentName}
      </h2>
      {branding.agentTitle && (
        <p className={`font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974] ${tight ? 'mt-0.5 text-[9px]' : 'mt-1.5 text-[11px]'}`}>
          {branding.agentTitle}
        </p>
      )}
      {branding.agentMarket && (
        <p className={`flex items-center justify-center gap-1 text-[#778093] dark:text-gray-300 ${tight ? 'mt-1 text-[10px]' : 'mt-2 text-xs'}`}>
          <MapPin className={tight ? 'h-3 w-3' : 'h-3.5 w-3.5'} style={{ color: accent }} /> {branding.agentMarket}
        </p>
      )}
    </div>
  )
}

// A phone-frame mock-up of the personalized property Showcase this form builds - shown on the
// welcome screen so a visitor sees what answering a few questions actually gets them, before they
// commit to starting. Tile styling deliberately matches the "What A Showcase Looks Like" preview
// on the Brag Sheet PDF (2x2 grid, photo, New Match badge, price/address footer, like/dislike +
// View More row, "N Homes Matched" bar) so the two illustrations of the same feature look like the
// same product. Uses the agent's own real recent sales as example photos/prices when available
// (exampleProperties, cycled to fill all 4 tiles same as the PDF), falling back to generic
// placeholder tiles only when the agent has none on record yet.
// Same stock property photo the homepage's mobile mockup uses (/home.jpg) - a blank gradient
// tile read as broken/empty, and a real (if repeated) photo sells the feature far better.
const SHOWCASE_EXPECTATION_FALLBACK_TILES = [
  { address: '412 Maple Ridge Dr', price: '$685,000', image: '/home.jpg' as string | null },
  { address: '88 Harbor View Ln', price: '$1,240,000', image: '/home.jpg' as string | null },
  { address: '2210 Sycamore Ct', price: '$542,000', image: '/home.jpg' as string | null },
  { address: '19 Fieldstone Way', price: '$915,000', image: '/home.jpg' as string | null },
]

function ShowcaseExpectationPreview({ accent, exampleProperties }: { accent: string; exampleProperties?: { address: string; city?: string | null; price?: number | null; image?: string | null }[] | null }) {
  const source = exampleProperties && exampleProperties.length > 0
    ? exampleProperties.map(prop => ({
        address: (prop.address || '').split(',')[0].trim() || 'New Match',
        price: prop.price ? `$${Number(prop.price).toLocaleString()}` : 'Price TBD',
        // MLS photo URLs come back as plain http:// - a page served over https blocks that as
        // mixed content and the <img> just silently fails, which read as "no real photos" even
        // though real data was flowing through.
        image: prop.image ? prop.image.replace(/^http:\/\//i, 'https://') : null,
      }))
    : SHOWCASE_EXPECTATION_FALLBACK_TILES
  const tiles = [0, 1, 2, 3].map(i => source[i % source.length])

  // A slower, staged reveal: the frame itself settles in first, then the header fades in, then
  // the tiles cascade in one by one, then the match bar - "dragged out" on purpose so it reads as
  // a little show rather than everything popping in at once.
  const frameTransition = { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const }
  const tileBaseDelay = 0.7

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={frameTransition}
      className="mx-auto mt-5 w-[340px]"
    >
      <div className="relative rounded-[2rem] bg-[#111827] p-2.5 shadow-xl">
        <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-[#111827]" />
        <div className="overflow-hidden rounded-[1.6rem] bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease: 'easeOut' }}
            className="flex items-center justify-between px-4 pb-2 pt-5"
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Your Showcase</span>
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[7px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
              Live
            </span>
          </motion.div>
          <div className="grid grid-cols-2 gap-2 px-3">
            {tiles.map((tile, index) => (
              <motion.div
                key={`${tile.address}-${index}`}
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, delay: tileBaseDelay + index * 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-white/5"
              >
                <div className="relative h-20 w-full overflow-hidden" style={!tile.image ? { background: `linear-gradient(135deg, ${accent}30, ${accent}0D)` } : undefined}>
                  {tile.image ? (
                    <img src={tile.image} alt={tile.address} className="h-full w-full object-cover" />
                  ) : (
                    <Home className="absolute inset-0 m-auto h-5 w-5" style={{ color: accent, opacity: 0.55 }} />
                  )}
                  {index < 2 && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-emerald-500 px-1.5 py-[2px] text-[6px] font-black uppercase tracking-wide text-white">New Match</span>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-[9px] font-black text-[#0B0B0B] dark:text-white">{tile.price}</p>
                  <p className="truncate text-[6.5px] font-bold uppercase tracking-wide text-gray-400">{tile.address}</p>
                  <div className="mt-1.5 flex items-center justify-between border-t border-gray-100 pt-1.5 dark:border-white/10">
                    <div className="flex items-center gap-1">
                      <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-200 dark:border-white/10">
                        <ThumbsUp className="h-[8px] w-[8px] text-gray-700 dark:text-gray-300" />
                      </span>
                      <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-200 dark:border-white/10">
                        <ThumbsDown className="h-[8px] w-[8px] text-gray-400" />
                      </span>
                    </div>
                    <span className="text-[6px] font-black uppercase tracking-wide" style={{ color: accent }}>View More</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: tileBaseDelay + 4 * 0.22, ease: 'easeOut' }}
            className="mx-3 my-3 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5"
          >
            <span className="text-[8px] font-bold text-[#0B0B0B] dark:text-white">12 Homes Matched</span>
            <span className="text-[6.5px] font-bold uppercase tracking-wide text-gray-400">Updated Live</span>
          </motion.div>
        </div>
      </div>
      <p className="mt-3 whitespace-nowrap text-center text-[11px] font-semibold text-gray-400">Updates automatically as new matches appear.</p>
    </motion.div>
  )
}

const DEFAULT_ACCENT = '#816937'

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function isAnswerFilled(value: AnswerValue | undefined) {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value && value.trim() !== '')
}

function isQuestionVisible(question: FormQuestion, answers: AnswersState): boolean {
  const dependsOn = question.depends_on
  if (!dependsOn) return true
  const dependValue = answers[dependsOn.question_id]
  if (dependValue === undefined) return false
  if (Array.isArray(dependValue)) {
    return dependsOn.values.some(value => dependValue.includes(value))
  }
  return dependsOn.values.includes(dependValue)
}

// The input control for a single question, shared by every layout so none of them duplicate
// per-question-type rendering.
function renderQuestionField(question: FormQuestion, answers: AnswersState, setAnswer: (questionId: string, value: AnswerValue) => void, accent: string) {
  const value = answers[question.id]
  const textValue = typeof value === 'string' ? value : ''
  const arrayValue = Array.isArray(value) ? value : []

  if (question.type === 'contact_group') {
    const fields = question.fields || []
    // When every field in the group is a plain number/currency (price, beds, acres, sqft, build
    // year - everything except the location screen), one chip clears them all at once instead of
    // making the visitor blank out each input by hand.
    const isAllNumeric = fields.length > 0 && fields.every(field => field.type === 'number' || field.type === 'currency')
    const isAnySelected = isAllNumeric && fields.every(field => !answers[field.id] || answers[field.id] === '')
    return (
      <div className="space-y-5 text-left">
        {isAllNumeric && (
          <button
            type="button"
            onClick={() => fields.forEach(field => setAnswer(field.id, ''))}
            className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-xs font-black transition-all"
            style={isAnySelected ? { borderColor: accent, backgroundColor: `${accent}1A`, color: accent } : { borderColor: '#e5e7eb' }}
          >
            {isAnySelected && <Check className="h-3.5 w-3.5" />} Any / No preference
          </button>
        )}
        {fields.map(field => {
          if (field.type === 'city_multiselect' || field.type === 'school_district_multiselect' || field.type === 'county_multiselect') {
            const fieldValues = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : []
            const apiMethod = field.type === 'city_multiselect' ? api.properties.citiesPublic : field.type === 'school_district_multiselect' ? api.properties.schoolDistrictsPublic : api.properties.countiesPublic
            const placeholder = field.type === 'city_multiselect' ? 'Type a city or town...' : field.type === 'school_district_multiselect' ? 'Type a school district...' : 'Type a county...'
            return (
              <div key={field.id}>
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  {field.label}
                  {field.required && <span style={{ color: accent }}> *</span>}
                </label>
                <MultiSelectDatabaseInput
                  values={fieldValues}
                  onChange={next => setAnswer(field.id, next)}
                  apiMethod={apiMethod}
                  placeholder={placeholder}
                  className="mt-1.5"
                />
              </div>
            )
          }
          const fieldValue = typeof answers[field.id] === 'string' ? (answers[field.id] as string) : ''
          if (field.type === 'select') {
            return (
              <div key={field.id}>
                <label className="text-xs font-black uppercase tracking-widest text-gray-400">
                  {field.label}
                  {field.required && <span style={{ color: accent }}> *</span>}
                </label>
                <div className="mt-1.5">
                  {field.searchable ? (
                    <SearchableSelect
                      value={fieldValue}
                      onChange={next => setAnswer(field.id, next)}
                      options={field.options || []}
                      placeholder="Type to search..."
                      accent={accent}
                    />
                  ) : (
                    <div className="grid gap-2 min-[420px]:grid-cols-2">
                      {(field.options || []).map(option => {
                        const selected = fieldValue === option
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setAnswer(field.id, option)}
                            className={`rounded-xl border-2 px-3 py-2 text-left text-sm font-bold transition-all ${selected ? 'text-[#0B0B0B] dark:text-white' : 'border-gray-200 bg-white text-[#0B0B0B] dark:border-gray-700 dark:bg-[#151517] dark:text-white'}`}
                            style={selected ? { borderColor: accent, backgroundColor: `${accent}1A` } : undefined}
                          >
                            {option}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          }
          if (field.type === 'number' || field.type === 'currency') {
            return (
              <div key={field.id}>
                <label htmlFor={`ff-${field.id}`} className="text-xs font-black uppercase tracking-widest text-gray-400">
                  {field.label}
                  {field.required && <span style={{ color: accent }}> *</span>}
                </label>
                <div className="relative">
                  {field.type === 'currency' && (
                    <span className="pointer-events-none absolute bottom-2.5 left-1 text-lg font-bold text-gray-400">$</span>
                  )}
                  <input
                    id={`ff-${field.id}`}
                    type="text"
                    inputMode="decimal"
                    value={formatNumberWithCommas(fieldValue)}
                    onChange={event => setAnswer(field.id, stripCommas(sanitizeNumericInput(event.target.value)))}
                    placeholder="0"
                    className={`mt-1.5 w-full border-b-2 border-gray-200 bg-transparent px-1 py-2.5 text-lg font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white ${field.type === 'currency' ? 'pl-6' : ''}`}
                  />
                </div>
              </div>
            )
          }
          const formatAsNumericText = field.type === 'short_text' && shouldFormatNumericText(field)
          return (
            <div key={field.id}>
              <label htmlFor={`ff-${field.id}`} className="text-xs font-black uppercase tracking-widest text-gray-400">
                {field.label}
                {field.required && <span style={{ color: accent }}> *</span>}
              </label>
{isHomeQuestion(field) ? (
                <HomeQuestionInput id={`ff-${field.id}`} value={fieldValue} onChange={next => setAnswer(field.id, next)} accent={accent} className="mt-1.5 w-full border-b-2 border-gray-200 bg-transparent px-1 py-2.5 text-lg font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white" />
              ) : (
              <input
                id={`ff-${field.id}`}
                // Lets the phone fill name / email / phone from the visitor's own contact card.
                autoComplete={fieldAutoComplete(field)}
                type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
                value={formatAsNumericText ? formatNumericTextWithCommas(fieldValue) : fieldValue}
                onChange={event => setAnswer(field.id, formatAsNumericText ? stripCommasFromNumericText(event.target.value) : event.target.value)}
                placeholder="Type your answer..."
                className="mt-1.5 w-full border-b-2 border-gray-200 bg-transparent px-1 py-2.5 text-lg font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white"
              />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (question.type === 'select' && question.searchable) {
    return (
      <SearchableSelect
        value={textValue}
        onChange={next => setAnswer(question.id, next)}
        options={question.options || []}
        placeholder={question.placeholder || 'Type to search...'}
        accent={accent}
      />
    )
  }

  if (question.type === 'select') {
    return (
      <div className="grid gap-2.5 min-[420px]:grid-cols-2">
        {(question.options || []).map((option, optionIndex) => {
          const selected = textValue === option
          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              onClick={() => setAnswer(question.id, option)}
              className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left text-sm font-bold transition-all ${
                selected
                  ? 'text-[#0B0B0B] dark:text-white'
                  : 'border-gray-200 bg-white text-[#0B0B0B] hover:border-gray-300 dark:border-gray-700 dark:bg-[#151517] dark:text-white'
              }`}
              style={selected ? { borderColor: accent, backgroundColor: `${accent}1A` } : undefined}
            >
              {option}
              {selected && <Check className="h-4 w-4 shrink-0" style={{ color: accent }} />}
            </button>
          )
        })}
      </div>
    )
  }

  if (question.type === 'multi_select') {
    return (
      <div className="grid gap-2.5 min-[420px]:grid-cols-2">
        {(question.options || []).map((option, optionIndex) => {
          const selected = arrayValue.includes(option)
          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              onClick={() => {
                const next = selected ? arrayValue.filter(item => item !== option) : [...arrayValue, option]
                setAnswer(question.id, next)
              }}
              className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 text-left text-sm font-bold transition-all ${
                selected
                  ? 'text-[#0B0B0B] dark:text-white'
                  : 'border-gray-200 bg-white text-[#0B0B0B] hover:border-gray-300 dark:border-gray-700 dark:bg-[#151517] dark:text-white'
              }`}
              style={selected ? { borderColor: accent, backgroundColor: `${accent}1A` } : undefined}
            >
              {option}
              {selected && <Check className="h-4 w-4 shrink-0" style={{ color: accent }} />}
            </button>
          )
        })}
      </div>
    )
  }

  if (question.type === 'long_text') {
    return (
      <textarea
        autoFocus
        rows={4}
        value={textValue}
        onChange={event => setAnswer(question.id, event.target.value)}
        placeholder={question.placeholder || 'Type your answer...'}
        className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-base font-medium text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:bg-[#151517] dark:text-white"
        style={{ caretColor: accent }}
      />
    )
  }

  if (question.type === 'date') {
    return (
      <input
        autoFocus
        type="date"
        value={textValue}
        onChange={event => setAnswer(question.id, event.target.value)}
        className="w-full border-b-2 border-gray-200 bg-transparent px-1 py-3 text-xl font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white"
      />
    )
  }

  if (question.type === 'time') {
    return (
      <input
        autoFocus
        type="time"
        value={textValue}
        onChange={event => setAnswer(question.id, event.target.value)}
        className="w-full border-b-2 border-gray-200 bg-transparent px-1 py-3 text-xl font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white"
      />
    )
  }

  if (question.type === 'currency') {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute bottom-3 left-1 text-xl font-bold text-gray-400">$</span>
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={formatNumberWithCommas(textValue)}
          onChange={event => setAnswer(question.id, stripCommas(sanitizeNumericInput(event.target.value)))}
          placeholder={question.placeholder || '0.00'}
          className="w-full border-b-2 border-gray-200 bg-transparent py-3 pl-6 pr-1 text-xl font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white"
        />
      </div>
    )
  }

  if (question.type === 'address_autocomplete') {
    return (
      <GooglePlacesAutocomplete
        value={textValue}
        onChange={address => setAnswer(question.id, address)}
        placeholder={question.placeholder || '123 Main Street, City, State, ZIP'}
        id={question.id}
        name={question.id}
      />
    )
  }

  if (question.type === 'number') {
    return (
      <div className="relative">
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={formatNumberWithCommas(textValue)}
          onChange={event => setAnswer(question.id, stripCommas(sanitizeNumericInput(event.target.value)))}
          placeholder={question.placeholder || '0'}
          className={`w-full border-b-2 border-gray-200 bg-transparent px-1 py-3 text-xl font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white ${question.unit ? 'pr-20' : ''}`}
        />
        {question.unit && (
          <span className="pointer-events-none absolute bottom-3 right-1 text-sm font-bold text-gray-400">{question.unit}</span>
        )}
      </div>
    )
  }

  const formatAsNumericText = question.type === 'short_text' && shouldFormatNumericText(question)

  return (
    <div className="relative">
      <input
        autoFocus
        autoComplete={fieldAutoComplete(question)}
        type={question.type === 'email' ? 'email' : question.type === 'phone' ? 'tel' : 'text'}
        value={formatAsNumericText ? formatNumericTextWithCommas(textValue) : textValue}
        onChange={event => setAnswer(question.id, formatAsNumericText ? stripCommasFromNumericText(event.target.value) : event.target.value)}
        placeholder={question.placeholder || 'Type your answer...'}
        className={`w-full border-b-2 border-gray-200 bg-transparent px-1 py-3 text-xl font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white ${question.unit ? 'pr-20' : ''}`}
      />
      {question.unit && (
        <span className="pointer-events-none absolute bottom-3 right-1 text-sm font-bold text-gray-400">{question.unit}</span>
      )}
    </div>
  )
}

// The form being filled, so the "which home?" question can rank the agent's own listings first.
const FormIdContext = createContext<string | undefined>(undefined)
// Schedule a Showing's "What property are you interested in seeing?" - gets MLS address suggestions.
const isHomeQuestion = (q: { id: string }) => q.id === 'property_of_interest'
function HomeQuestionInput(props: { id?: string; value: string; onChange: (v: string) => void; accent: string; className: string }) {
  const formId = useContext(FormIdContext)
  return <ListingAddressInput {...props} formId={formId} />
}

// Browser autofill hint for a contact field (name / email / phone / address), by its id or type.
function fieldAutoComplete(field: { id: string; type: string; label?: string }): string | undefined {
  const k = `${field.id} ${field.label || ''}`.toLowerCase()
  if (field.type === 'email' || /email/.test(k)) return 'email'
  if (field.type === 'phone' || /phone|mobile|cell/.test(k)) return 'tel'
  if (/first/.test(k)) return 'given-name'
  if (/last/.test(k)) return 'family-name'
  if (/^full_name|\bname\b/.test(k)) return 'name'
  if (/street|address/.test(k)) return 'street-address'
  return undefined
}

// Submit-error message + Next/Back controls, shared by every layout.
function QuestionNavButtons({ isLastStep, canAdvance, submitting, submitError, onNext, onBack, accent }: {
  isLastStep: boolean
  canAdvance: boolean
  submitting: boolean
  submitError: string
  onNext: () => void
  onBack: () => void
  accent: string
}) {
  return (
    <>
      {submitError && (
        <p className="mt-4 text-sm font-bold text-red-600">{submitError}</p>
      )}
      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance || submitting}
          className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          data-fill="" style={{ backgroundColor: accent }}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
            </>
          ) : isLastStep ? (
            'Submit'
          ) : (
            <>
              Next <ChevronDown className="h-4 w-4 -rotate-90" />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          Back
        </button>
      </div>
    </>
  )
}

// Answers the page that opened the form hands over that aren't questions the visitor sees - sent
// along with the submission. search_area = an area drawn on the IDX map ("Save this search"), so
// the Showcase it builds follows that exact shape (collections_service).
const HIDDEN_PREFILL_IDS = ['search_area']

export default function FormRunner({ questions, branding, successHeading, successMessage, linkedProperty, propertyPhotoCarousel, onSubmit, onProgress, focusBlockId, agentHubRedirect, onComplete, prefill, redirectDelayMs = 5000, redirectTarget = '_self', forceLightMode = false, backgroundEffects = true, welcomeTextEffects = true, brandingLayout = 'split', showcasePreview = false, exampleProperties, formId, look }: FormRunnerProps) {
  // With a look, inline accents are the look's readable colour and every fill ([data-fill]) is
  // repainted by FORM_LOOK_CSS (Luxe: the metal gradient).
  const accent = look ? formPaint(look).text : branding.accentColor || DEFAULT_ACCENT
  // step 0 = intro, 1..totalQuestions = questions, totalQuestions + 1 = success
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<AnswersState>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [redirectProgress, setRedirectProgress] = useState(0)
  const [postSubmitRedirectUrl, setPostSubmitRedirectUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)
  const [topBarHeight, setTopBarHeight] = useState(0)
  const [isSmUp, setIsSmUp] = useState(false)
  // Room kept above the welcome content for the floating cards (phones: the two small cards; desktop: "Tour Ready").
  const introTopPad = backgroundEffects ? (isSmUp ? 76 : 64) : 0
  // Showcase Request's welcome screen (branding + title + animation + button) can run taller
  // than a short phone viewport - rather than letting it scroll, it's scaled down to fit.
  const introScrollAreaRef = useRef<HTMLDivElement>(null)
  const introContentRef = useRef<HTMLDivElement>(null)
  const [introScale, setIntroScale] = useState(1)

  // Prefill address-style fields from a linked property (and anything the host page passed in
  // `prefill`), without clobbering anything the visitor already typed.
  useEffect(() => {
    if (!linkedProperty && !prefill) return
    const prefillMap: Record<string, string | null | undefined> = {
      ...(linkedProperty ? { address_line1: linkedProperty.address, city: linkedProperty.city, state: linkedProperty.state, zip: linkedProperty.zipcode } : {}),
      ...(prefill || {}),
    }
    // Top-level questions and the fields inside grouped questions (a showing form's "property"
    // box often lives inside a group) can both be filled in.
    const knownIds = new Set(questions.flatMap(question => [question.id, ...((question.fields || []).map(field => field.id))]))
    setAnswers(current => {
      let changed = false
      const next = { ...current }
      for (const [id, value] of Object.entries(prefillMap)) {
        if (value && (knownIds.has(id) || HIDDEN_PREFILL_IDS.includes(id)) && !next[id]) {
          next[id] = value
          changed = true
        }
      }
      return changed ? next : current
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedProperty, prefill, questions])

  const visibleQuestions = useMemo(() => questions.filter(question => isQuestionVisible(question, answers)), [questions, answers])
  const totalQuestions = visibleQuestions.length
  // What the "Question 3 of 13" counter + progress bar show: also counts follow-up questions whose
  // deciding answer hasn't been given yet, so the total doesn't jump from 5 to 13 mid-form. It can
  // only shrink (an answer that hides questions), never grow.
  const displayTotal = useMemo(() => questions.filter(q => isQuestionVisible(q, answers) || (q.depends_on && answers[q.depends_on.question_id] === undefined)).length, [questions, answers])
  const currentQuestion = step >= 1 && step <= totalQuestions ? visibleQuestions[step - 1] : null

  // Progress tracking (Stats view/drop-off funnel) - fires once for the intro (step 0 = "view")
  // and again each time the visitor advances to a new question. Not called for the success step
  // (totalQuestions + 1) - that's reported separately, alongside the submit result, as `completed`.
  const answersSnapshot = () => {
    const out: Record<string, unknown> = {}
    for (const [id, value] of Object.entries(answers)) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value) ? value.length === 0 : String(value).trim() === '') continue
      out[id] = value
    }
    return out
  }
  useEffect(() => {
    if (!onProgress || step > totalQuestions) return
    onProgress(step, currentQuestion?.id ?? null, false, answersSnapshot())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Autosave what they've typed/picked on the current question (debounced), so someone who
  // enters their email and then closes the tab still shows up with it.
  const lastSent = useRef('')
  useEffect(() => {
    if (!onProgress || step < 1 || step > totalQuestions) return
    const snapshot = answersSnapshot()
    const key = JSON.stringify(snapshot)
    if (key === lastSent.current || key === '{}') return
    const timer = setTimeout(() => {
      lastSent.current = key
      onProgress(step, currentQuestion?.id ?? null, false, snapshot)
    }, 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers])

  // Leaving the page mid-question: send what's there right away (the ping uses keepalive).
  const flushRef = useRef<() => void>(() => {})
  flushRef.current = () => {
    if (!onProgress || step < 1 || step > totalQuestions) return
    const snapshot = answersSnapshot()
    const key = JSON.stringify(snapshot)
    if (key === lastSent.current) return
    lastSent.current = key
    onProgress(step, currentQuestion?.id ?? null, false, snapshot)
  }
  useEffect(() => {
    if (!onProgress) return
    const onHide = () => { if (document.visibilityState === 'hidden') flushRef.current() }
    const onPageHide = () => flushRef.current()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [onProgress])

  useEffect(() => {
    if (focusBlockId === undefined || focusBlockId === null) return
    if (focusBlockId === 'welcome') { setStep(0); return }
    if (focusBlockId === 'thankyou') { setStep(totalQuestions + 1); return }
    const index = visibleQuestions.findIndex(question => question.id === focusBlockId)
    if (index >= 0) setStep(index + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBlockId])
  const isIntro = step === 0
  const isSuccess = step === totalQuestions + 1
  const showBrandingBlock = branding.showBranding !== false
  const showPropertyBlock = Boolean(linkedProperty)

  // The placement choice only means something when both are on - with just one, it always sits at
  // the top like before. Default ('split') puts the property up top as a header and the agent down
  // at the bottom as a footer.
  const bothBlocksShown = showBrandingBlock && showPropertyBlock
  const useIntegratedLayout = brandingLayout === 'integrated'
  const effectiveLayout = useIntegratedLayout ? 'integrated' : (bothBlocksShown ? brandingLayout : 'top')
  let topBarBranding: FormRunnerBranding | null = null
  let topBarProperty: LinkedProperty | null = null
  let bottomBarBranding: FormRunnerBranding | null = null
  let bottomBarProperty: LinkedProperty | null = null
  if (useIntegratedLayout) {
    // The integrated card draws its own header (agent + property) inline around the question, so
    // the pinned top/bottom bar used by every other layout stays off entirely.
  } else if (!bothBlocksShown) {
    topBarBranding = showBrandingBlock ? branding : null
    topBarProperty = showPropertyBlock && linkedProperty ? linkedProperty : null
  } else if (effectiveLayout === 'top') {
    topBarBranding = branding
    topBarProperty = linkedProperty || null
  } else if (effectiveLayout === 'bottom') {
    bottomBarBranding = branding
    bottomBarProperty = linkedProperty || null
  } else if (effectiveLayout === 'split_reverse') {
    topBarBranding = branding
    bottomBarProperty = linkedProperty || null
  } else {
    topBarProperty = linkedProperty || null
    bottomBarBranding = branding
  }
  const showTopBar = Boolean(topBarBranding || topBarProperty)
  const showBottomBar = Boolean(bottomBarBranding || bottomBarProperty)

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)')
    const update = () => setIsSmUp(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // Scale the welcome screen down to fit whenever its natural height exceeds the visible area -
  // e.g. a short phone viewport - so the visitor never has to scroll to find the Start button.
  useEffect(() => {
    if (!isIntro || !showcasePreview) {
      setIntroScale(1)
      return
    }
    const contentEl = introContentRef.current
    const areaEl = introScrollAreaRef.current
    if (!contentEl || !areaEl) return

    const recalc = () => {
      const cs = getComputedStyle(areaEl)
      const available = areaEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - introTopPad
      const needed = contentEl.scrollHeight
      if (available > 0 && needed > available) {
        setIntroScale(Math.max(0.68, available / needed))
      } else {
        setIntroScale(1)
      }
    }

    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(contentEl)
    ro.observe(areaEl)
    window.addEventListener('resize', recalc)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recalc)
    }
  }, [isIntro, showcasePreview, introTopPad])

  // Measure the pinned agent/property row so the question below it can be raised by exactly that much —
  // the question should land in the same spot whether or not branding/property is shown.
  useEffect(() => {
    if (!currentQuestion || !topBarRef.current) {
      setTopBarHeight(0)
      return
    }
    const el = topBarRef.current
    const update = () => setTopBarHeight(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [currentQuestion, showTopBar])

  useEffect(() => {
    // A just-built Showcase takes priority over the generic Agent Hub redirect - it's the more
    // specific, more useful place to land a visitor who just answered these exact questions.
    const redirectUrl = postSubmitRedirectUrl || (agentHubRedirect?.enabled ? agentHubRedirect.url : null)
    if (!isSuccess) return
    if (onComplete) {
      // In a window: let the thank-you land, then hand control back to the page underneath.
      const t = setTimeout(onComplete, 1600)
      return () => clearTimeout(t)
    }
    if (!redirectUrl) return
    const start = Date.now()
    const duration = redirectDelayMs
    let frame: number
    const tick = () => {
      const elapsed = Date.now() - start
      const percent = Math.min(100, (elapsed / duration) * 100)
      setRedirectProgress(percent)
      if (percent < 100) {
        frame = requestAnimationFrame(tick)
      } else {
        try {
          const targetWindow = redirectTarget === '_top' && window.top ? window.top : window
          targetWindow.location.href = redirectUrl
        } catch {
          window.location.href = redirectUrl
        }
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, postSubmitRedirectUrl, agentHubRedirect?.enabled, agentHubRedirect?.url, redirectDelayMs, redirectTarget, onComplete])

  const currentValue = currentQuestion ? answers[currentQuestion.id] : undefined

  const canAdvance = useMemo(() => {
    if (!currentQuestion) return true
    if (currentQuestion.type === 'contact_group') {
      return (currentQuestion.fields || []).every(field => !field.required || isAnswerFilled(answers[field.id]))
    }
    if (!currentQuestion.required) return true
    return isAnswerFilled(currentValue)
  }, [currentQuestion, currentValue, answers])

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers(current => ({ ...current, [questionId]: value }))
  }

  const goToStep = (nextStep: number, dir: 1 | -1) => {
    setDirection(dir)
    setStep(nextStep)
    setSubmitError('')
    // A long question scrolled down to its Next button would otherwise open the next one
    // part-way down, its title hidden above the fold (phones).
    introScrollAreaRef.current?.scrollTo({ top: 0 })
  }

  const handleNext = async () => {
    if (!canAdvance || submitting) return

    if (step < totalQuestions) {
      goToStep(step + 1, 1)
      return
    }

    if (step === totalQuestions) {
      setSubmitting(true)
      setSubmitError('')
      try {
        const payload = visibleQuestions.flatMap(question => {
          if (question.type === 'statement') return []
          if (question.type === 'contact_group') {
            return (question.fields || []).map(field => ({ questionId: field.id, value: answers[field.id] ?? '' }))
          }
          return [{ questionId: question.id, value: answers[question.id] ?? (question.type === 'multi_select' ? [] : '') }]
        }).concat(HIDDEN_PREFILL_IDS.filter(id => answers[id]).map(id => ({ questionId: id, value: answers[id] })))
        const result = await onSubmit(payload)
        if (result.success) {
          onProgress?.(totalQuestions, currentQuestion?.id ?? null, true, answersSnapshot())
          if (result.redirectUrl) setPostSubmitRedirectUrl(result.redirectUrl)
          goToStep(totalQuestions + 1, 1)
        } else {
          setSubmitError(result.message || "Something went wrong. Please try again.")
        }
      } catch {
        setSubmitError("Something went wrong. Please try again.")
      } finally {
        setSubmitting(false)
      }
    }
  }

  const handleBack = () => {
    if (submitting) return
    if (step > 0) goToStep(step - 1, -1)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter') return
    const target = event.target as HTMLElement
    if (target.tagName === 'TEXTAREA' && !(event.metaKey || event.ctrlKey)) return
    // Google's address suggestions are open: Enter picks one, it doesn't move to the next question.
    if (Array.from(document.querySelectorAll<HTMLElement>('.pac-container')).some(el => el.offsetParent !== null && el.querySelector('.pac-item'))) return
    event.preventDefault()
    if (isIntro) goToStep(1, 1)
    else if (currentQuestion) handleNext()
  }

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24, scale: 0.98 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24, scale: 0.98 }),
  }
  const introShellVariants = {
    enter: { opacity: 0, y: 28, scale: 0.98 },
    center: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { staggerChildren: 0.09, delayChildren: 0.08 },
    },
    exit: { opacity: 0, y: -18, scale: 0.98 },
  }
  const introItemVariants = {
    enter: { opacity: 0, y: 18, scale: 0.98 },
    center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1] as const } },
    exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.22, ease: 'easeInOut' as const } },
  }
  const introStaticShellVariants = {
    enter: { opacity: 1, y: 0, scale: 1 },
    center: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 1, y: 0, scale: 1 },
  }
  const introStaticItemVariants = {
    enter: { opacity: 1, y: 0, scale: 1 },
    center: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 1, y: 0, scale: 1 },
  }
  // Shared spring for every question transition below - popLayout removes the exiting card from
  // the flow immediately (rather than mode="wait", which held its space and paused before the
  // next one entered), and layout smooths out the height change between differently-sized
  // questions, so switching questions reads as one continuous motion instead of a jump-cut.
  const stepTransition = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.9 }
  const layoutTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }

  return (
    <FormIdContext.Provider value={formId}>
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      // z-0 (not just "relative") - relative positioning alone, with no z-index, does NOT
      // establish a new stacking context, so the backdrop's -z-10 below would otherwise compare
      // against ancestors far up the page tree instead of just its siblings here, and could end
      // up hidden behind an unrelated opaque background elsewhere on the page.
      className={`fr-root relative z-0 flex h-full min-h-[560px] w-full flex-col overflow-hidden bg-[#FAFAF7] transition-colors duration-300 ${forceLightMode ? 'ohp-force-light' : 'dark:bg-[#0B0B0B]'} ${look ? formLookClass(look) : ''}`}
      style={look ? (formLookVars(look) as React.CSSProperties) : undefined}
    >
      {look && <style dangerouslySetInnerHTML={{ __html: FORM_LOOK_CSS }} />}
      {backgroundEffects && <WelcomeMotionBackdrop accent={accent} light={forceLightMode} intro={isIntro} />}
      {isSuccess && <ConfettiBurst />}

      {!isIntro && !isSuccess && !useIntegratedLayout && (
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800">
          <motion.div
            className="h-full"
            data-fill="" style={{ backgroundColor: accent }}
            initial={false}
            animate={{ width: `${(step / displayTotal) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}

      {currentQuestion && showTopBar && (
        <div ref={topBarRef} className="px-6 pt-3">
          <div className="mx-auto w-full max-w-xl border-b border-gray-100 pb-5 dark:border-gray-800">
            <QuestionBrandBar branding={topBarBranding} property={topBarProperty} accent={accent} />
          </div>
        </div>
      )}

      <div ref={introScrollAreaRef} className="flex flex-1 justify-center overflow-y-auto px-6 py-8">
        <div
          className={`w-full max-w-xl ${isIntro && showcasePreview ? '' : isIntro || isSuccess ? 'my-auto pb-14 sm:pb-20' : 'my-auto'}`}
          style={currentQuestion ? { paddingBottom: `${(isSmUp ? 72 : 40) + topBarHeight}px` } : isIntro && introTopPad ? { paddingTop: `${introTopPad}px` } : undefined}
        >
          {/* Readability veil: an edgeless fade of the page colour right behind the questions (no
              box, border or shadow), so the animated backdrop never runs under the text but still
              shows around it. Only when that backdrop is on. */}
          <div className="relative isolate">
          {backgroundEffects && (
            <div
              aria-hidden
              className={`fr-veil pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 ${forceLightMode ? 'text-[#FAFAF7]' : 'text-[#FAFAF7] dark:text-[#0B0B0B]'}`}
              style={{ background: 'radial-gradient(closest-side, currentColor 62%, transparent 100%)', opacity: 0.92 }}
            />
          )}
          <AnimatePresence mode="popLayout" custom={direction} initial={welcomeTextEffects}>
            {isIntro && (
              <motion.div
                key="intro"
                layout
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ ...stepTransition, layout: layoutTransition }}
              >
                {/* Scaled down (not just re-flowed) when the natural content is taller than the
                    available viewport - keeps everything visible without a scrollbar on short
                    phone screens instead of just letting it overflow. Framer's own transform
                    (entrance slide/fade) lives on the motion.div above; this scale lives on a
                    plain nested div so the two transforms don't fight each other. */}
                <motion.div
                  variants={welcomeTextEffects ? introShellVariants : introStaticShellVariants}
                  className="relative z-10"
                >
                  <div
                    ref={introContentRef}
                    className="flex flex-col items-center text-center"
                    style={showcasePreview ? { transform: `scale(${introScale})`, transformOrigin: 'top center' } : undefined}
                  >
                    <motion.div variants={welcomeTextEffects ? introItemVariants : introStaticItemVariants}>
                      <AgentProfileBlock branding={branding} accent={accent} tight={showcasePreview} />
                    </motion.div>

                    {linkedProperty && (
                      <motion.div variants={welcomeTextEffects ? introItemVariants : introStaticItemVariants} className="flex w-full justify-center">
                        <PropertyHeroCard property={linkedProperty} cyclePhotos={propertyPhotoCarousel} />
                      </motion.div>
                    )}

                    <motion.div variants={welcomeTextEffects ? introItemVariants : introStaticItemVariants} className="mt-6 flex flex-col items-center">
                      <h1 className={`fr-title font-black leading-tight tracking-tight text-[#0B0B0B] dark:text-white ${showcasePreview ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>
                        {branding.title}
                      </h1>
                      {branding.subtitle && (
                        <p className={`mx-auto max-w-md text-base font-medium leading-relaxed text-[#5f6673] dark:text-gray-300 ${showcasePreview ? 'mt-3' : 'mt-4'}`}>
                          {branding.subtitle}
                        </p>
                      )}
                    </motion.div>
                    {showcasePreview && (
                      <motion.div variants={welcomeTextEffects ? introItemVariants : introStaticItemVariants}>
                        <ShowcaseExpectationPreview accent={accent} exampleProperties={exampleProperties} />
                      </motion.div>
                    )}
                    <motion.button
                      type="button"
                      variants={welcomeTextEffects ? introItemVariants : introStaticItemVariants}
                      onClick={() => goToStep(1, 1)}
                      whileHover={{ y: -2, scale: 1.025 }}
                      whileTap={{ scale: 0.96 }}
                      className={`group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl ${showcasePreview ? 'mt-5' : 'mt-8'}`}
                      data-fill="" style={{ backgroundColor: accent }}
                    >
                      {welcomeTextEffects && (
                        <motion.span
                          aria-hidden
                          // Inline colour, not a bg-white class: the Agent Hub / Forms pages repaint every
                          // bg-white* element dark in dark mode, which turned this light stripe into a black bar.
                          className="absolute inset-y-0 -left-10 w-10 skew-x-[-18deg]"
                          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.34), transparent)' }}
                          animate={{ x: [0, 220] }}
                          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                        />
                      )}
                      <span className="relative">Start</span>
                      <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </motion.button>
                    <motion.p variants={welcomeTextEffects ? introItemVariants : introStaticItemVariants} className="mt-4 text-xs font-bold text-gray-400">
                      Press Enter
                    </motion.p>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                layout
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ ...stepTransition, layout: layoutTransition }}
                className={!useIntegratedLayout && currentQuestion.type === 'statement' ? 'text-center' : undefined}
              >
                {useIntegratedLayout ? (
                  <div className="mx-auto w-full max-w-lg overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:border-gray-800 dark:bg-[#151517]">
                    {(showBrandingBlock || showPropertyBlock) && (
                      <div className="flex flex-col items-center gap-5 border-b border-gray-100 bg-[#FAFAF7] p-6 dark:border-gray-800 dark:bg-[#1A1A1C]">
                        {showBrandingBlock && (
                          <div className="flex flex-col items-center text-center">
                            {branding.agentPhotoUrl ? (
                              <img src={branding.agentPhotoUrl} alt={branding.agentName} className="h-14 w-14 rounded-full object-cover shadow-sm" />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-full text-base font-black text-white shadow-sm" data-fill="" style={{ backgroundColor: accent }}>
                                {getInitials(branding.agentName)}
                              </div>
                            )}
                            <p className="mt-2 font-serif text-base font-black leading-tight text-[#0B0B0B] dark:text-white">{branding.agentName}</p>
                            {(branding.agentBrokerage || branding.agentTitle) && (
                              <p className="mt-0.5 text-[11px] font-black uppercase tracking-wide dark:!text-[#d7b974]" style={{ color: accent }}>
                                {[branding.agentBrokerage, branding.agentTitle].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        )}

                        {showPropertyBlock && linkedProperty && (
                          <IntegratedPropertyCard property={linkedProperty} accent={accent} />
                        )}
                      </div>
                    )}

                    <div className="p-8">
                      {currentQuestion.type === 'statement' ? (
                        <div className="text-center">
                          <h1 className="text-2xl font-black leading-tight tracking-tight text-[#0B0B0B] dark:text-white">
                            {currentQuestion.label}
                          </h1>
                          {currentQuestion.helper_text && (
                            <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-[#5f6673] dark:text-gray-300">
                              {currentQuestion.helper_text}
                            </p>
                          )}
                          {/* Terminal (e.g. disqualifying) statement - a dead end, not a step
                              toward the form's success screen, so there's no Continue/Submit here -
                              just Back, in case this was a misclick. */}
                          <div className="mt-6 flex items-center justify-center gap-4">
                            {currentQuestion.terminal ? (
                              <button
                                type="button"
                                onClick={handleBack}
                                className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                              >
                                Back
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={handleNext}
                                  className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
                                  data-fill="" style={{ backgroundColor: accent }}
                                >
                                  Continue
                                </button>
                                <button
                                  type="button"
                                  onClick={handleBack}
                                  disabled={submitting}
                                  className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                  Back
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {currentQuestion.section_title && (
                            <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: accent }}>
                              {currentQuestion.section_title}
                            </p>
                          )}
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <h3 className="text-lg font-black leading-snug tracking-tight text-[#0B0B0B] dark:text-white">
                              {currentQuestion.label}
                              {currentQuestion.required && currentQuestion.type !== 'contact_group' && <span style={{ color: accent }}> *</span>}
                            </h3>
                            <span className="shrink-0 rounded-full border border-gray-100 bg-[#FAFAF7] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#6B7280] dark:border-gray-800 dark:bg-[#1A1A1C] dark:text-gray-400">
                              {displayTotal === totalQuestions ? `${step} of ${displayTotal}` : `${step}`}
                            </span>
                          </div>
                          <div className="mt-4 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              data-fill="" style={{ width: `${(step / displayTotal) * 100}%`, backgroundColor: accent }}
                            />
                          </div>

                          <div className="mt-6">
                            {renderQuestionField(currentQuestion, answers, setAnswer, accent)}
                            {currentQuestion.helper_text && (
                              <p className="mt-2 text-xs font-medium text-gray-400">{currentQuestion.helper_text}</p>
                            )}
                          </div>

                          <QuestionNavButtons
                            isLastStep={step === totalQuestions && displayTotal === totalQuestions}
                            canAdvance={canAdvance}
                            submitting={submitting}
                            submitError={submitError}
                            onNext={handleNext}
                            onBack={handleBack}
                            accent={accent}
                          />
                        </>
                      )}
                    </div>
                  </div>
                ) : currentQuestion.type === 'statement' ? (
                  <>
                    <h1 className="text-3xl font-black leading-tight tracking-tight text-[#0B0B0B] dark:text-white sm:text-4xl">
                      {currentQuestion.label}
                    </h1>
                    {currentQuestion.helper_text && (
                      <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-[#5f6673] dark:text-gray-300">
                        {currentQuestion.helper_text}
                      </p>
                    )}
                    <div className="mt-8 flex items-center justify-center gap-4">
                      {currentQuestion.terminal ? (
                        <button
                          type="button"
                          onClick={handleBack}
                          className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          Back
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={handleNext}
                            className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
                            data-fill="" style={{ backgroundColor: accent }}
                          >
                            Continue
                          </button>
                          <button
                            type="button"
                            onClick={handleBack}
                            disabled={submitting}
                            className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            Back
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                {currentQuestion.section_title && (
                  <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: accent }}>
                    {currentQuestion.section_title}
                  </p>
                )}
                <p className="mt-1 text-xs font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">
                  Question {displayTotal === totalQuestions ? `${step} of ${displayTotal}` : `${step}`}
                </p>
                <h2 className="mt-3 text-2xl font-black leading-snug tracking-tight text-[#0B0B0B] dark:text-white sm:text-3xl">
                  {currentQuestion.label}
                  {currentQuestion.required && currentQuestion.type !== 'contact_group' && <span style={{ color: accent }}> *</span>}
                </h2>

                <div className="mt-8">
                  {renderQuestionField(currentQuestion, answers, setAnswer, accent)}
                  {currentQuestion.helper_text && (
                    <p className="mt-2 text-xs font-medium text-gray-400">{currentQuestion.helper_text}</p>
                  )}
                </div>

                <QuestionNavButtons
                  isLastStep={step === totalQuestions && displayTotal === totalQuestions}
                  canAdvance={canAdvance}
                  submitting={submitting}
                  submitError={submitError}
                  onNext={handleNext}
                  onBack={handleBack}
                  accent={accent}
                />
                  </>
                )}
              </motion.div>
            )}

            {isSuccess && (
              <motion.div
                key="success"
                layout
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ ...stepTransition, layout: layoutTransition }}
                className="text-center"
              >
                {!linkedProperty && (
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg"
                    data-fill="" style={{ backgroundColor: accent }}
                  >
                    <Check className="h-8 w-8" />
                  </motion.div>
                )}

                <div className={linkedProperty ? '' : 'mt-6'}>
                  <AgentProfileBlock branding={branding} accent={accent} />
                </div>

                {linkedProperty && (
                  <div className="mx-auto mt-6 flex justify-center">
                    <PropertyHeroCard property={linkedProperty} size="large" showCheckmark accent={accent} />
                  </div>
                )}

                <h1 className="fr-title mt-6 text-3xl font-black tracking-tight text-[#0B0B0B] dark:text-white">{successHeading}</h1>
                {successMessage && (
                  <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-[#5f6673] dark:text-gray-300">
                    {successMessage}
                  </p>
                )}

                {!onComplete && (postSubmitRedirectUrl || agentHubRedirect?.enabled) && (
                  <div className="mx-auto mt-8 flex flex-col items-center gap-2">
                    <p className="text-xs font-bold text-gray-400">{postSubmitRedirectUrl ? 'Opening your Showcase...' : 'Redirecting...'}</p>
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-full" data-fill="" style={{ width: `${redirectProgress}%`, backgroundColor: accent }} />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>

      {currentQuestion && showBottomBar && (
        <div className="px-6 pb-4">
          <div className="mx-auto w-full max-w-xl border-t border-gray-100 pt-5 dark:border-gray-800">
            <QuestionBrandBar branding={bottomBarBranding} property={bottomBarProperty} accent={accent} />
          </div>
        </div>
      )}
    </div>
    </FormIdContext.Provider>
  )
}
