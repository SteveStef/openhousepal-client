'use client'

import LuxeMotionBackdrop from './LuxeMotionBackdrop'
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
import WhenPicker, { WhenField, WhenSheet, emptyWhen } from '@/components/ui/WhenPicker'
import { AreaPicker, ShowcaseCard, ShowcaseTrail, WHEEL_CSS, WheelPicker, emptyLabelOf, isAreaField, pickerKindOf, pickerOptions, questionHasAnswer, showcaseStepOf, stateNameOf, useCoarsePointer } from '@/components/forms/FormRunnerParts'

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
  /** The state the agent serves ("PA") - a form's State answer starts there. */
  agentState?: string | null
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

// Short answers sit two to a row even on a phone (owner, 11/03: "Garage / Yard" each on its own long
// row wasted the screen); longer ones get a row each until the screen is wide enough.
const choiceGrid = (options?: string[] | null) => ((options || []).length > 1 && (options || []).every(o => o.length <= 20)
  ? 'grid-cols-2' : 'min-[420px]:grid-cols-2')

// First and last name always share a line (owner, 11/04: "waste of space").
const isNameField = (f: { id: string; label: string }, part: 'first' | 'last') => new RegExp(`${part}[ _]?name`, 'i').test(`${f.id} ${f.label}`)
function contactRows<T extends { id: string; label: string }>(fields: T[]): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < fields.length; i++) {
    if (isNameField(fields[i], 'first') && fields[i + 1] && isNameField(fields[i + 1], 'last')) rows.push([fields[i], fields[++i]])
    else rows.push([fields[i]])
  }
  return rows
}

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
function PropertyHeroCard({ property, size = 'default', showCheckmark = false, cyclePhotos = false }: { property: LinkedProperty; size?: 'default' | 'large'; showCheckmark?: boolean; cyclePhotos?: boolean }) {
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
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl ring-4 ring-white/90"
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

// The picture behind every form (owner, 11/04): a quiet street of homes under a soft sky, in the
// form's own color - evening windows and stars on a dark form. Scenery only: no words, numbers or
// cards, so nobody reads it as part of the form. Moves on the graphics chip (CSS transforms and
// opacity, no blur), and it stays low on the page so it never sits behind the questions.
const STREET_FAR: [number, number, number, number][] = [ // x, width, wall height, roof height
  [20, 120, 70, 44], [150, 96, 92, 38], [262, 140, 62, 50], [420, 104, 84, 40], [540, 132, 66, 48],
  [690, 110, 96, 40], [816, 138, 64, 50], [972, 100, 86, 38], [1090, 128, 68, 46], [1236, 112, 92, 40], [1364, 136, 64, 50], [1516, 104, 80, 40],
]
const STREET_NEAR: { x: number; w: number; h: number; r: number; chimney?: boolean; porch?: boolean }[] = [
  { x: 96, w: 190, h: 96, r: 66, chimney: true }, { x: 370, w: 230, h: 84, r: 76, porch: true }, { x: 690, w: 200, h: 104, r: 68, chimney: true },
  { x: 985, w: 236, h: 86, r: 78, porch: true }, { x: 1310, w: 196, h: 98, r: 66, chimney: true },
]
const STREET_TREES: [number, number][] = [[42, 58], [326, 72], [640, 62], [938, 74], [1262, 60], [1552, 70]]
const SKY_STARS: [number, number, number][] = [[9, 12, 0], [21, 26, 1.4], [34, 9, 0.7], [47, 21, 2.1], [61, 11, 1.1], [73, 28, 0.3], [86, 14, 1.8], [93, 31, 0.9], [15, 41, 2.4], [80, 44, 1.6]]
const BACKDROP_CSS = String.raw`
.fr-bk { --bk-sky: color-mix(in srgb, var(--bk) 12%, transparent); --bk-cloud: #fff;
  --bk-far: color-mix(in srgb, var(--bk) 8%, #fff); --bk-wall: color-mix(in srgb, var(--bk) 13%, #fff); --bk-roof: color-mix(in srgb, var(--bk) 32%, #fff); --bk-trim: color-mix(in srgb, var(--bk) 42%, #fff);
  --bk-door: color-mix(in srgb, var(--bk) 48%, #fff); --bk-pane: color-mix(in srgb, var(--bk) 26%, #fff); --bk-win: #fff; --bk-tree: color-mix(in srgb, var(--bk) 22%, #fff); --bk-ground: color-mix(in srgb, var(--bk) 11%, #fff); }
.dark .fr-bk:not(.fr-bk-day) { --bk-sky: color-mix(in srgb, var(--bk) 13%, transparent); --bk-cloud: rgba(255,255,255,.055);
  --bk-far: color-mix(in srgb, var(--bk) 7%, #0d0d10); --bk-wall: color-mix(in srgb, var(--bk) 12%, #0d0d10); --bk-roof: color-mix(in srgb, var(--bk) 24%, #0d0d10); --bk-trim: color-mix(in srgb, var(--bk) 30%, #0d0d10);
  --bk-door: color-mix(in srgb, var(--bk) 32%, #0d0d10); --bk-pane: color-mix(in srgb, var(--bk) 20%, #0d0d10); --bk-win: #f6d68a; --bk-tree: color-mix(in srgb, var(--bk) 15%, #0d0d10); --bk-ground: color-mix(in srgb, var(--bk) 9%, #0d0d10); }
@keyframes frDriftA { from { transform: translate3d(-18vw,0,0); } to { transform: translate3d(112vw,0,0); } }
@keyframes frSway { 0%, 100% { transform: translate3d(-10px,0,0); } 50% { transform: translate3d(10px,0,0); } }
@keyframes frSwayFar { 0%, 100% { transform: translate3d(6px,0,0); } 50% { transform: translate3d(-6px,0,0); } }
@keyframes frGlow { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes frTwinkle { 0%, 100% { opacity: .2; } 50% { opacity: .95; } }
@keyframes frSun { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
.fr-cloud { animation: frDriftA linear infinite; will-change: transform; }
.fr-near { animation: frSway 26s ease-in-out infinite; will-change: transform; }
.fr-far { animation: frSwayFar 34s ease-in-out infinite; will-change: transform; }
.fr-win { animation: frGlow 7s ease-in-out infinite; }
.fr-star { animation: frTwinkle 5s ease-in-out infinite; }
.fr-sun { animation: frSun 12s ease-in-out infinite; transform-origin: center; }
@media (prefers-reduced-motion: reduce) { .fr-cloud, .fr-near, .fr-far, .fr-win, .fr-star, .fr-sun { animation: none; } .fr-cloud { transform: translate3d(30vw,0,0); } }
`

function BackdropCloud({ className, style }: { className: string; style: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 220 70" aria-hidden className={`fr-cloud absolute left-0 ${className}`} style={{ fill: 'var(--bk-cloud)', ...style }}>
      <path d="M34 62c-15 0-26-9-26-21 0-11 10-20 23-20 3-11 15-19 29-19 13 0 24 6 29 16 5-3 11-5 18-5 15 0 28 9 30 22 3-1 7-2 11-2 17 0 31 9 31 20 0 7-6 9-14 9z" />
    </svg>
  )
}

export function WelcomeMotionBackdrop({ accent, light = false, look }: { accent: string; light?: boolean; intro?: boolean; look?: FormLook | null }) {
  // Luxe has its own, grander scene (owner, 11/05); Classic keeps this street.
  if (look?.theme === 'luxe') return <LuxeMotionBackdrop metal={look.metal} light={light} />
  // Forced light (an IDX site page): the outer page can still carry the app's `dark` class, so
  // fr-bk-day keeps the daytime colours and the night sky stays off.
  // -z-10 (not just "absolute", which leaves z-index:auto) - a positioned element with z-index:
  // auto still paints ABOVE plain non-positioned siblings regardless of DOM order (the progress
  // bar/top bar/question content below are all plain non-positioned divs), which was letting this
  // decorative backdrop render on top of the real form content instead of behind it.
  // The sky fades out before the very top, so the page's edge is exactly its plain background - the
  // colour a phone shows when you pull past it (user, 10/18: a line there).
  const skyFade = 'linear-gradient(to bottom, transparent 0, #000 170px)'
  const groundFade = 'linear-gradient(to bottom, #000 calc(100% - 22px), transparent 100%)'
  return (
    <div className={`fr-bk pointer-events-none absolute inset-0 -z-10 overflow-hidden ${light ? 'fr-bk-day' : ''}`} style={{ ['--bk' as string]: accent }} aria-hidden>
      <style dangerouslySetInnerHTML={{ __html: BACKDROP_CSS }} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="absolute inset-x-0 top-0 h-[58%]"
        style={{ background: 'linear-gradient(180deg, var(--bk-sky), transparent)', maskImage: skyFade, WebkitMaskImage: skyFade }}
      />

      {/* A low sun by day, a moon and stars at night */}
      <div className={`fr-sun absolute right-[9%] top-[7%] h-14 w-14 rounded-full sm:h-20 sm:w-20 ${light ? '' : 'dark:hidden'}`} style={{ background: '#fbe6ae', boxShadow: '0 0 0 16px rgba(251,230,174,.3)' }} />
      {!light && (
        <div className="hidden dark:block">
          {SKY_STARS.map(([x, y, delay]) => (
            <span key={`${x}-${y}`} className="fr-star absolute h-[3px] w-[3px] rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }} />
          ))}
          <svg viewBox="0 0 64 64" className="absolute right-[8%] top-[6%] h-12 w-12 sm:h-16 sm:w-16" style={{ fill: 'var(--bk-roof)' }}>
            <path d="M42 6a27 27 0 1 0 16 41A23 23 0 0 1 42 6z" />
          </svg>
        </div>
      )}
      <BackdropCloud className="top-[9%] w-36 sm:w-56" style={{ animationDuration: '95s', animationDelay: '-30s' }} />
      <BackdropCloud className="top-[21%] w-24 sm:w-40" style={{ opacity: 0.8, animationDuration: '130s', animationDelay: '-85s' }} />
      <BackdropCloud className="top-[3%] hidden w-32 sm:block" style={{ opacity: 0.7, animationDuration: '160s', animationDelay: '-120s' }} />

      {/* The street. A short screen (a phone turned sideways) has no room for it. */}
      <div className="absolute inset-x-0 bottom-0 h-[clamp(112px,20vh,230px)] [@media(max-height:620px)]:hidden" style={{ maskImage: groundFade, WebkitMaskImage: groundFade }}>
        <svg viewBox="0 0 1640 280" preserveAspectRatio="xMidYMax slice" className="fr-far absolute -inset-x-4 bottom-0 h-full w-[calc(100%+32px)] max-w-none">
          <g style={{ fill: 'var(--bk-far)' }}>
            {STREET_FAR.map(([x, w, h, r]) => <path key={x} d={`M${x} 280V${280 - h}L${x + w / 2} ${280 - h - r}L${x + w} ${280 - h}V280Z`} />)}
          </g>
        </svg>
        <svg viewBox="0 0 1640 280" preserveAspectRatio="xMidYMax slice" className="fr-near absolute -inset-x-4 bottom-0 h-full w-[calc(100%+32px)] max-w-none">
          {STREET_TREES.map(([x, r]) => (
            <g key={x} style={{ fill: 'var(--bk-tree)' }}>
              <rect x={x - 3} y={250 - r} width="6" height={r} rx="3" style={{ fill: 'var(--bk-trim)' }} />
              <circle cx={x} cy={236 - r} r={r * 0.5} />
              <circle cx={x - r * 0.3} cy={250 - r} r={r * 0.34} />
              <circle cx={x + r * 0.3} cy={250 - r} r={r * 0.34} />
            </g>
          ))}
          {STREET_NEAR.map(({ x, w, h, r, chimney, porch }, n) => {
            const base = 256, top = base - h, door = x + w * 0.5 - 14
            return (
              <g key={x}>
                {chimney && <rect x={x + w * 0.72} y={top - r * 0.9} width="18" height={r * 0.8} style={{ fill: 'var(--bk-trim)' }} />}
                <rect x={x} y={top} width={w} height={h} style={{ fill: 'var(--bk-wall)' }} />
                <path d={`M${x - 14} ${top + 3}L${x + w / 2} ${top - r}L${x + w + 14} ${top + 3}Z`} style={{ fill: 'var(--bk-roof)' }} />
                <rect x={door} y={base - 50} width="28" height="50" rx="3" style={{ fill: 'var(--bk-door)' }} />
                {porch && <path d={`M${door - 18} ${base - 56}H${door + 46}`} strokeWidth="5" strokeLinecap="round" style={{ stroke: 'var(--bk-trim)' }} />}
                {[x + w * 0.16, x + w * 0.7].map((wx, k) => (
                  <g key={wx}>
                    <rect x={wx} y={top + 18} width="30" height="30" rx="2" style={{ fill: 'var(--bk-pane)' }} />
                    <rect x={wx} y={top + 18} width="30" height="30" rx="2" className="fr-win" style={{ fill: 'var(--bk-win)', animationDelay: `${(n * 2 + k) * 1.3}s` }} />
                    <path d={`M${wx + 15} ${top + 18}v30M${wx} ${top + 33}h30`} strokeWidth="1.5" style={{ stroke: 'var(--bk-trim)' }} />
                  </g>
                ))}
              </g>
            )
          })}
          <path d="M0 280V254C260 240 520 262 820 254S1380 240 1640 254V280Z" style={{ fill: 'var(--bk-ground)' }} />
        </svg>
      </div>
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
      {/* Street + price + chips must fit the 72px card - with gap-1.5/p-2 they ran ~4px over and the
          street was cut in half at the top (11/02) */}
      <div className="flex h-full min-w-0 flex-col justify-center gap-1 px-2 py-1.5 text-left">
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

// A follow-up's parent: a question, or the contact screen holding that field. Undefined = the id
// isn't on the form.
function forkParentOf(parentId: string, questions: FormQuestion[]) {
  return questions.find(q => q.id === parentId) || questions.find(q => (q.fields || []).some(field => field.id === parentId))
}

// A question hides when its parent is hidden, not just when its parent's answer doesn't match: an
// answer left behind on a path they backed out of opens nothing (buy -> No agent -> Back -> sell).
// A loop of follow-ups never shows. Same rule on the server: forms_service.question_is_visible.
function isQuestionVisible(question: FormQuestion, answers: AnswersState, questions: FormQuestion[], seen: string[] = []): boolean {
  const dependsOn = question.depends_on
  if (!dependsOn) return true
  if (seen.includes(question.id)) return false
  const parent = forkParentOf(dependsOn.question_id, questions)
  if (parent && !isQuestionVisible(parent, answers, questions, [...seen, question.id])) return false
  const dependValue = answers[dependsOn.question_id]
  if (dependValue === undefined) return false
  if (Array.isArray(dependValue)) {
    return dependsOn.values.some(value => dependValue.includes(value))
  }
  return dependsOn.values.includes(dependValue)
}

// Showing now, or waiting on an answer from a parent that could itself still show.
function couldStillShow(question: FormQuestion, answers: AnswersState, questions: FormQuestion[], passed: string[] = [], seen: string[] = []): boolean {
  if (isQuestionVisible(question, answers, questions)) return true
  const dependsOn = question.depends_on
  // `passed`: questions they've already gone past. One they skipped will never open its follow-ups.
  if (!dependsOn || seen.includes(question.id) || answers[dependsOn.question_id] !== undefined || passed.includes(dependsOn.question_id)) return false
  const parent = forkParentOf(dependsOn.question_id, questions)
  return Boolean(parent) && couldStillShow(parent!, answers, questions, passed, [...seen, question.id])
}

// Same rule as the server's forms_service._EMAIL_RE.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

// What's wrong with an email / phone on this screen, in plain words - '' when it's fine. Blank is
// fine here: a required answer is already held back by the Next button.
function contactProblem(question: FormQuestion, answers: AnswersState): string {
  const items: { id: string; type: string }[] = question.type === 'contact_group' ? question.fields || [] : [question]
  for (const item of items) {
    const value = answers[item.id]
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) continue
    if (item.type === 'email' && !EMAIL_RE.test(text)) return 'That email doesn\u2019t look right. Please check it, like name@example.com.'
    if (item.type === 'phone' && text.replace(/\D/g, '').length < 10) return 'That phone number looks too short. Please enter all 10 digits.'
  }
  return ''
}

// The input control for a single question, shared by every layout so none of them duplicate
// per-question-type rendering.
type FieldOpts = {
  /** A single-choice answer was tapped - move on to the next question. */
  onChoose?: (questionId: string) => void
  /** Phones: never focus a text box by itself (it pops the keyboard and shifts the page). */
  noAutoFocus?: boolean
  /** A home-search question in the Showcase builder look (chips instead of full-width rows). */
  showcase?: boolean
}

function renderQuestionField(question: FormQuestion, answers: AnswersState, setAnswer: (questionId: string, value: AnswerValue) => void, accent: string, opts: FieldOpts = {}) {
  const value = answers[question.id]
  const textValue = typeof value === 'string' ? value : ''
  const arrayValue = Array.isArray(value) ? value : []

  if (question.type === 'contact_group') {
    const fields = question.fields || []
    // "Where are you looking?" - towns OR school districts OR counties, each picked in a sheet.
    if (fields.some(field => isAreaField(field.type))) {
      return (
        <AreaPicker
          fields={fields.map(field => ({ id: field.id, type: field.type, label: field.label, options: field.options }))}
          answers={answers}
          setAnswer={setAnswer}
          accent={accent}
          apiFor={type => type === 'city_multiselect' ? api.properties.citiesPublic : type === 'school_district_multiselect' ? api.properties.schoolDistrictsPublic : api.properties.countiesPublic}
        />
      )
    }
    // When every field in the group is a plain number/currency (price, beds, acres, sqft, build
    // year - everything except the location screen), one chip clears them all at once instead of
    // making the visitor blank out each input by hand - and moves on, like any single choice.
    const isAllNumeric = fields.length > 0 && fields.every(field => field.type === 'number' || field.type === 'currency')
    const isAnySelected = isAllNumeric && fields.every(field => !answers[field.id] || answers[field.id] === '')
    const wheels = fields.filter(field => pickerKindOf(field))
    // Min / max side by side: two wheels in one row.
    const wheelPair = isAllNumeric && wheels.length === fields.length && fields.length === 2
    const wheelOf = (field: (typeof fields)[number]) => {
      const kind = pickerKindOf(field)!
      const current = typeof answers[field.id] === 'string' ? (answers[field.id] as string) : ''
      return (
        <WheelPicker
          options={pickerOptions(kind, field, emptyLabelOf(field, true), current)}
          value={current}
          onChange={next => setAnswer(field.id, next)}
          accent={accent}
          label={field.label}
          compact={wheels.length >= 3}
        />
      )
    }
    const oneField = (field: (typeof fields)[number]) => {
          if (pickerKindOf(field)) {
            return (
              <div key={field.id}>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                  {field.label}{field.required && <span style={{ color: accent }}> *</span>}
                </p>
                <div className="mx-auto max-w-[260px]">{wheelOf(field)}</div>
              </div>
            )
          }
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
{field.type === 'date' || field.type === 'time' ? (
                <div className="mt-1.5"><WhenAnswerField mode={field.type} value={fieldValue} onChange={next => setAnswer(field.id, next)} accent={accent} label={field.label} /></div>
              ) : isHomeQuestion(field) ? (
                <HomeQuestionInput id={`ff-${field.id}`} value={fieldValue} onChange={next => setAnswer(field.id, next)} accent={accent} className="mt-1.5 w-full border-b-2 border-gray-200 bg-transparent px-1 py-2.5 text-lg font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white" />
              ) : (
              <input
                id={`ff-${field.id}`}
                // Lets the phone fill name / email / phone from the visitor's own contact card.
                autoComplete={fieldAutoComplete(field)}
                type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                value={formatAsNumericText ? formatNumericTextWithCommas(fieldValue) : fieldValue}
                onChange={event => setAnswer(field.id, formatAsNumericText ? stripCommasFromNumericText(event.target.value) : event.target.value)}
                placeholder="Type your answer..."
                className="mt-1.5 w-full border-b-2 border-gray-200 bg-transparent px-1 py-2.5 text-lg font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white"
              />
              )}
            </div>
          )
            }
    return (
      <div className={`${wheelPair ? 'space-y-4' : 'space-y-5'} text-left`}>
        {isAllNumeric && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => { fields.forEach(field => setAnswer(field.id, '')); opts.onChoose?.(question.id) }}
            className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-black transition-colors ${isAnySelected ? '' : 'border-gray-200 bg-white text-[#374151] hover:border-gray-300 dark:border-white/15 dark:bg-[#151517] dark:text-gray-100'}`}
            style={isAnySelected ? { borderColor: accent, backgroundColor: `${accent}1A`, color: accent } : undefined}
          >
            {isAnySelected && <Check className="h-3.5 w-3.5" />} Any / No preference
          </motion.button>
        )}
        {wheelPair ? (
          <div className="grid grid-cols-2 gap-3">
            {fields.map(field => (
              <div key={field.id}>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{field.label}</p>
                {wheelOf(field)}
              </div>
            ))}
          </div>
        ) : contactRows(fields).map(row => (row.length > 1
          ? <div key={row[0].id} className="grid grid-cols-2 gap-3">{row.map(oneField)}</div>
          : oneField(row[0])))}
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
      <div className={`grid gap-2.5 ${choiceGrid(question.options)}`}>
        {(question.options || []).map((option, optionIndex) => {
          const selected = textValue === option
          return (
            <motion.button
              key={`${question.id}-${optionIndex}`}
              type="button"
              whileTap={{ scale: 0.97 }}
              // One tap answers it and moves on - no Continue needed for a single choice.
              onClick={() => { setAnswer(question.id, option); opts.onChoose?.(question.id) }}
              className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-bold transition-colors ${
                selected
                  ? 'text-[#0B0B0B] dark:text-white'
                  : 'border-gray-200 bg-white text-[#0B0B0B] hover:border-gray-300 dark:border-gray-700 dark:bg-[#151517] dark:text-white'
              }`}
              style={selected ? { borderColor: accent, backgroundColor: `${accent}1A` } : undefined}
            >
              {option}
              {selected && <Check className="h-4 w-4 shrink-0" style={{ color: accent }} />}
            </motion.button>
          )
        })}
      </div>
    )
  }

  // Pick-all-that-apply as chips that wrap (the Showcase creator's look) - a long list of short
  // options (key features: 10) fits on a phone screen with no scrolling inside the question.
  if (question.type === 'multi_select' && (opts.showcase || ((question.options || []).length >= 6 && (question.options || []).every(o => o.length <= 26)))) {
    return (
      <div className="flex flex-wrap gap-2">
        {(question.options || []).map((option, optionIndex) => {
          const selected = arrayValue.includes(option)
          return (
            <motion.button
              key={`${question.id}-${optionIndex}`}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setAnswer(question.id, selected ? arrayValue.filter(item => item !== option) : [...arrayValue, option])}
              className={`inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-colors ${selected ? 'text-[#0B0B0B] dark:text-white' : 'border-gray-200 bg-white text-[#374151] hover:border-gray-300 dark:border-white/15 dark:bg-[#151517] dark:text-gray-100'}`}
              style={selected ? { borderColor: accent, backgroundColor: `${accent}1F` } : undefined}
            >
              <AnimatePresence initial={false}>
                {selected && (
                  <motion.span key="c" initial={{ width: 0, opacity: 0, scale: 0 }} animate={{ width: 'auto', opacity: 1, scale: 1 }} exit={{ width: 0, opacity: 0, scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="inline-flex">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: accent }} />
                  </motion.span>
                )}
              </AnimatePresence>
              {option}
            </motion.button>
          )
        })}
      </div>
    )
  }

  if (question.type === 'multi_select') {
    return (
      <div className={`grid gap-2.5 ${choiceGrid(question.options)}`}>
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
              className={`flex items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-bold transition-all ${
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
        autoFocus={!opts.noAutoFocus}
        rows={4}
        value={textValue}
        onChange={event => setAnswer(question.id, event.target.value)}
        placeholder={question.placeholder || 'Type your answer...'}
        className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-base font-medium text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:bg-[#151517] dark:text-white"
        style={{ caretColor: accent }}
      />
    )
  }

  // Date / time questions (user, 10/22): big day tiles + "Pick your own day" calendar, and
  // Morning / Afternoon / Evening -> times - easier than the phone's tiny native wheels. The answer
  // is stored exactly as before: YYYY-MM-DD / HH:MM.
  if (question.type === 'date') {
    return (
      <div className="text-left">
        <WhenPicker key={question.id} mode="date" minDate={null} accent={accent}
          value={{ ...emptyWhen, date: /^\d{4}-\d{2}-\d{2}$/.test(textValue) ? textValue : null }}
          onChange={v => setAnswer(question.id, v.date || '')} />
      </div>
    )
  }

  if (question.type === 'time') {
    return (
      <div className="text-left">
        <WhenPicker key={question.id} mode="time" accent={accent}
          value={{ ...emptyWhen, time: /^\d{2}:\d{2}$/.test(textValue) ? textValue : null }}
          onChange={v => setAnswer(question.id, v.time || '')} />
      </div>
    )
  }

  // Price / bedrooms / baths / square feet / lot / build year on their own: one scroll wheel, no keyboard.
  const soloKind = pickerKindOf(question)
  if (soloKind) {
    return (
      <div className="mx-auto max-w-[280px]">
        <WheelPicker options={pickerOptions(soloKind, question, emptyLabelOf(question, false), textValue)} value={textValue}
          onChange={next => setAnswer(question.id, next)} accent={accent} label={question.label} />
      </div>
    )
  }

  if (question.type === 'currency') {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute bottom-3 left-1 text-xl font-bold text-gray-400">$</span>
        <input
          autoFocus={!opts.noAutoFocus}
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
          autoFocus={!opts.noAutoFocus}
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
        autoFocus={!opts.noAutoFocus}
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

// A date / time field inside a group of questions: one big tap field that opens the picker.
function WhenAnswerField({ mode, value, onChange, accent, label }: { mode: 'date' | 'time'; value: string; onChange: (v: string) => void; accent: string; label: string }) {
  const [open, setOpen] = useState(false)
  const when = { ...emptyWhen, date: mode === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null, time: mode === 'time' && /^\d{2}:\d{2}$/.test(value) ? value : null }
  return (
    <>
      <WhenField mode={mode} value={when} accent={accent} placeholder={mode === 'date' ? 'Pick a day' : 'Pick a time'} onOpen={() => setOpen(true)} onClear={() => onChange('')} />
      <WhenSheet open={open} onClose={() => setOpen(false)} mode={mode} minDate={null} value={when} accent={accent} title={label || (mode === 'date' ? 'Pick a day' : 'Pick a time')} kicker={mode === 'date' ? 'Pick a day' : 'Pick a time'}
        onDone={v => { onChange((mode === 'date' ? v.date : v.time) || ''); setOpen(false) }} />
    </>
  )
}
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
function QuestionNavButtons({ isLastStep, canAdvance, submitting, submitError, onNext, onBack, accent, tapToAnswer = false, canSkip = false }: {
  isLastStep: boolean
  canAdvance: boolean
  submitting: boolean
  submitError: string
  onNext: () => void
  onBack: () => void
  accent: string
  /** A single choice: tapping an answer moves on, so there's no Next - just Back (and Skip when it's optional). */
  tapToAnswer?: boolean
  canSkip?: boolean
}) {
  if (tapToAnswer && !isLastStep) {
    return (
      <div className="mt-7 flex items-center gap-5">
        <button type="button" onClick={onBack} disabled={submitting} className="text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          Back
        </button>
        {canSkip && (
          <button type="button" onClick={onNext} className="inline-flex items-center gap-1 text-sm font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            Skip <ChevronDown className="h-4 w-4 -rotate-90" />
          </button>
        )}
      </div>
    )
  }
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
  // Showcase Request's welcome screen (branding + title + animation + button) can run taller
  // than a short phone viewport - rather than letting it scroll, it's scaled down to fit.
  const introScrollAreaRef = useRef<HTMLDivElement>(null)
  const introContentRef = useRef<HTMLDivElement>(null)
  const [introScale, setIntroScale] = useState(1)
  const [introShrink, setIntroShrink] = useState(0)

  // Prefill address-style fields from a linked property (and anything the host page passed in
  // `prefill`), without clobbering anything the visitor already typed.
  // The home search's State starts as the state the agent serves (Peter -> Pennsylvania).
  const agentStateName = stateNameOf(branding.agentState)
  const hasStatePick = questions.some(question => (question.fields || []).some(field => field.id === 'state' && field.type === 'select'))
  useEffect(() => {
    if (!linkedProperty && !prefill && !(agentStateName && hasStatePick)) return
    const prefillMap: Record<string, string | null | undefined> = {
      ...(agentStateName && hasStatePick ? { state: agentStateName } : {}),
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
  }, [linkedProperty, prefill, questions, agentStateName])

  const visibleQuestions = useMemo(() => questions.filter(question => isQuestionVisible(question, answers, questions)), [questions, answers])
  const totalQuestions = visibleQuestions.length
  // What the "Question 3 of 13" counter + progress bar show: also counts follow-up questions whose
  // deciding answer hasn't been given yet, so the total doesn't jump from 5 to 13 mid-form. It can
  // only shrink (an answer that hides questions), never grow. A follow-up under a parent that can't
  // show any more doesn't count.
  const displayTotal = useMemo(() => {
    const passed = visibleQuestions.slice(0, Math.max(step - 1, 0)).map(q => q.id)
    return questions.filter(q => couldStillShow(q, answers, questions, passed)).length
  }, [questions, answers, visibleQuestions, step])
  const currentQuestion = step >= 1 && step <= totalQuestions ? visibleQuestions[step - 1] : null

  // Progress tracking (Stats view/drop-off funnel) - fires once for the intro (step 0 = "view")
  // and again each time the visitor advances to a new question. Not called for the success step
  // (totalQuestions + 1) - that's reported separately, alongside the submit result, as `completed`.
  const answersSnapshot = () => {
    const out: Record<string, unknown> = {}
    const idsOf = (q: FormQuestion) => (q.type === 'contact_group' ? (q.fields || []).map(field => field.id) : [q.id])
    const formIds = new Set(questions.flatMap(idsOf))
    const shownIds = new Set(visibleQuestions.flatMap(idsOf))
    for (const [id, value] of Object.entries(answers)) {
      if (value === undefined || value === null) continue
      // the agent's own state, filled in for them - not something this visitor told us
      if (id === 'state' && value === agentStateName) continue
      // On a path they left: null tells the server to take it out of what the agent sees in
      // Unfinished. Only ids in this visit's answers - it can't touch what was saved before a reload.
      if (formIds.has(id) && !shownIds.has(id)) { out[id] = null; continue }
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
  // Where they are right now: a tap moves on after 320ms, so by the time this timer fires the step
  // it started on is old, and sending that would log them as back on the previous question.
  const whereNow = useRef({ step, total: totalQuestions, questionId: currentQuestion?.id ?? null })
  whereNow.current = { step, total: totalQuestions, questionId: currentQuestion?.id ?? null }
  useEffect(() => {
    if (!onProgress || step < 1 || step > totalQuestions) return
    const snapshot = answersSnapshot()
    const key = JSON.stringify(snapshot)
    if (key === lastSent.current || key === '{}') return
    const timer = setTimeout(() => {
      const now = whereNow.current
      if (now.step < 1 || now.step > now.total) return
      lastSent.current = key
      onProgress(now.step, now.questionId, false, snapshot)
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
      const available = areaEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const needed = contentEl.scrollHeight
      if (available > 0 && needed > available) {
        const s = Math.max(0.68, available / needed)
        setIntroScale(s)
        // a scaled box still takes its full height - give back the difference so there's nothing
        // left to scroll into below the Start button
        setIntroShrink(Math.round(needed * (1 - s)))
      } else {
        setIntroScale(1)
        setIntroShrink(0)
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
  }, [isIntro, showcasePreview])

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
    setSubmitError('')
  }

  const goToStep = (nextStep: number, dir: 1 | -1) => {
    setDirection(dir)
    setStep(nextStep)
    setSubmitError('')
    // A long question scrolled down to its Next button would otherwise open the next one
    // part-way down, its title hidden above the fold (phones) - and a page the keyboard nudged
    // down goes back to the top, so the progress bar + branding are always in full view.
    introScrollAreaRef.current?.scrollTo({ top: 0 })
    if (typeof document !== 'undefined') {
      const active = document.activeElement as HTMLElement | null
      if (active?.matches?.('input, textarea')) active.blur()
      if (window.scrollY !== 0 && !focusBlockId) window.scrollTo(0, 0)
    }
  }

  // A single choice (or "Any / No preference") was tapped: once the answer is in, move on - a
  // short beat later, so the tick on the picked answer is seen first.
  const [chosen, setChosen] = useState<{ id: string; n: number } | null>(null)
  const choose = (questionId: string) => setChosen(c => ({ id: questionId, n: (c?.n || 0) + 1 }))

  const handleNext = async () => {
    if (!canAdvance || submitting) return
    // A dead end stays a dead end: Back is the only way out, never Enter.
    if (currentQuestion?.terminal) return
    const problem = currentQuestion ? contactProblem(currentQuestion, answers) : ''
    if (problem) {
      setSubmitError(problem)
      return
    }

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

  useEffect(() => {
    if (!chosen || currentQuestion?.id !== chosen.id) return
    // The last question still waits for its Submit - never sent by a single tap.
    if (step === totalQuestions && displayTotal === totalQuestions) return
    const t = setTimeout(() => handleNext(), 320)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen])

  const coarse = useCoarsePointer()
  const fieldOpts = (q: FormQuestion): FieldOpts => ({ onChoose: choose, noAutoFocus: coarse || focusBlockId !== undefined, showcase: !!showcaseStepOf(q) })
  // Single choice = tap to answer: no Next button (Back, plus Skip when it's optional).
  const tapToAnswer = (q: FormQuestion) => q.type === 'select' && !q.searchable
  // The home-search questions that build the visitor's Showcase, in order (for its trail).
  const showcaseSteps = visibleQuestions.filter(q => showcaseStepOf(q))
  const currentShowcaseStep = showcaseStepOf(currentQuestion)

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter') return
    const target = event.target as HTMLElement
    if (target.tagName === 'TEXTAREA' && !(event.metaKey || event.ctrlKey)) return
    // Google's address suggestions are open: Enter picks one, it doesn't move to the next question.
    if (Array.from(document.querySelectorAll<HTMLElement>('.pac-container')).some(el => el.offsetParent !== null && el.querySelector('.pac-item'))) return
    event.preventDefault()
    if (isIntro) goToStep(1, 1)
    else if (currentQuestion && !currentQuestion.terminal) handleNext()
  }

  // Nothing has focus when the welcome screen opens, so a keydown never reaches handleKeyDown above -
  // "Press Enter" has to work from the page itself. Not in the editor's preview: Enter there is the
  // agent's. Focus on anything else (a box, a link) keeps Enter for that.
  useEffect(() => {
    if (!isIntro || focusBlockId !== undefined) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return
      const active = document.activeElement
      if (active && active !== document.body) return
      event.preventDefault()
      goToStep(1, 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntro, focusBlockId])

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
      className={`fr-root relative z-0 flex h-full min-h-[min(560px,100dvh)] w-full flex-col overflow-hidden bg-[#FAFAF7] transition-colors duration-300 ${forceLightMode ? 'ohp-force-light' : 'dark:bg-[#0B0B0B]'} ${look ? formLookClass(look) : ''}`}
      style={look ? (formLookVars(look) as React.CSSProperties) : undefined}
    >
      {look && <style dangerouslySetInnerHTML={{ __html: FORM_LOOK_CSS }} />}
      {backgroundEffects && <WelcomeMotionBackdrop accent={accent} light={forceLightMode} intro={isIntro} look={look} />}
      {isSuccess && <ConfettiBurst />}

      <style dangerouslySetInnerHTML={{ __html: `${WHEEL_CSS}.fr-scroll{scrollbar-width:none}.fr-scroll::-webkit-scrollbar{display:none}` }} />
      {!isIntro && !isSuccess && !useIntegratedLayout && (
        <div className="h-1.5 w-full shrink-0 bg-gray-100 dark:bg-white/10">
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
          <div className="mx-auto w-full max-w-xl pb-2">
            <QuestionBrandBar branding={topBarBranding} property={topBarProperty} accent={accent} />
          </div>
        </div>
      )}

      {/* The page's one scroll area - only scrolls when a step really is taller than the screen
          (never sideways: the veil below reaches past the edges). On a question, two spacers
          centre it a little above the middle; they shrink to nothing before the step would ever
          have to scroll (the old fixed bottom padding made short phones scroll for no reason). */}
      <div ref={introScrollAreaRef} data-fr-scroll="" className={`fr-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-hidden overscroll-contain px-6 ${currentQuestion ? 'py-6 sm:py-8' : 'py-8'}`}>
        {currentQuestion && <div aria-hidden style={{ flex: '1 1 0px' }} />}
        <div
          className={`w-full max-w-xl shrink-0 ${currentQuestion ? '' : isIntro && showcasePreview ? '' : isIntro || isSuccess ? 'my-auto pb-14 sm:pb-20' : 'my-auto'}`}
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
                    style={showcasePreview ? { transform: `scale(${introScale})`, transformOrigin: 'top center', marginBottom: introShrink ? -introShrink : undefined } : undefined}
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
                    {/* Hidden by CSS, not by a check in code: the server can't know it's a phone, and a page that differs from it gets rebuilt. */}
                    <motion.p variants={welcomeTextEffects ? introItemVariants : introStaticItemVariants} className="mt-4 text-xs font-bold text-gray-500 dark:text-gray-400 [@media(pointer:coarse)]:hidden">
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
                            {renderQuestionField(currentQuestion, answers, setAnswer, accent, fieldOpts(currentQuestion))}
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
                            tapToAnswer={tapToAnswer(currentQuestion)}
                            canSkip={!currentQuestion.required}
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
                ) : currentShowcaseStep ? (
                  // A home-search question: the Showcase creator's look, right in the form - the
                  // builder trail on top, the question as one of the creator's criteria cards.
                  <>
                    <ShowcaseTrail steps={showcaseSteps} currentId={currentQuestion.id} answers={answers} accent={accent} />
                    <ShowcaseCard step={currentShowcaseStep} title={currentQuestion.label} set={questionHasAnswer(currentQuestion, answers)} accent={accent} hint={currentQuestion.required ? undefined : 'optional'}>
                      {renderQuestionField(currentQuestion, answers, setAnswer, accent, fieldOpts(currentQuestion))}
                      {currentQuestion.helper_text && (
                        <p className="mt-2 text-xs font-medium text-gray-400">{currentQuestion.helper_text}</p>
                      )}
                    </ShowcaseCard>
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

                <div className="mt-7">
                  {renderQuestionField(currentQuestion, answers, setAnswer, accent, fieldOpts(currentQuestion))}
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
                  tapToAnswer={tapToAnswer(currentQuestion)}
                  canSkip={!currentQuestion.required}
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
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
                  >
                    <Check className="h-8 w-8" />
                  </motion.div>
                )}

                <div className={linkedProperty ? '' : 'mt-6'}>
                  <AgentProfileBlock branding={branding} accent={accent} />
                </div>

                {linkedProperty && (
                  <div className="mx-auto mt-6 flex justify-center">
                    <PropertyHeroCard property={linkedProperty} size="large" showCheckmark />
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
        {currentQuestion && <div aria-hidden style={{ flex: `1 1 ${(isSmUp ? 72 : 40) + topBarHeight}px` }} />}
      </div>

      {currentQuestion && showBottomBar && (
        <div className="px-6 pb-4">
          <div className="mx-auto w-full max-w-xl pt-2">
            <QuestionBrandBar branding={bottomBarBranding} property={bottomBarProperty} accent={accent} />
          </div>
        </div>
      )}
    </div>
    </FormIdContext.Provider>
  )
}
