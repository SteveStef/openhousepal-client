'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bath, BedDouble, Check, ChevronDown, Home, LandPlot, Loader2, LucideIcon, MapPin, Ruler, TrendingDown } from 'lucide-react'
import { FormQuestion, LinkedProperty } from '@/types'

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
  questions: FormQuestion[]
  branding: FormRunnerBranding
  successHeading: string
  successMessage?: string | null
  linkedProperty?: LinkedProperty | null
  propertyPhotoCarousel?: boolean
  onSubmit: (answers: { questionId: string; value: unknown }[]) => Promise<{ success: boolean; message?: string }>
  // When this changes (e.g. the builder's selected block), jump the preview to that block: 'welcome', 'thankyou', or a question id.
  focusBlockId?: string | null
  agentHubRedirect?: { enabled: boolean; url: string } | null
  // 'top'/'bottom'/'split'/'split_reverse' only matter when both agent branding and a linked
  // property are shown together on question pages: 'top' = combined block above the question,
  // 'bottom' = combined block below it, 'split' = property header above / agent footer below,
  // 'split_reverse' = agent header above / property footer below. Meaningless (ignored) with just
  // one of the two. 'integrated' is a different rendering mode entirely (applies regardless of
  // whether one or both of branding/property are present): the whole flow — property info, agent
  // branding, progress, and the current question — renders as one boxed card, matching the Open
  // House guest sign-in widget's look.
  brandingLayout?: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated'
}

type AnswerValue = string | string[]
type AnswersState = Record<string, AnswerValue>

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
  if (clean === 'pending' || clean === 'coming soon') return 'bg-amber-500 text-white'
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
              style={{ backgroundColor: accent }}
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
        <div className="flex aspect-square h-[80%] shrink-0 items-center justify-center rounded-full text-base font-black text-white shadow-sm" style={{ backgroundColor: accent }}>
          {getInitials(branding.agentName)}
        </div>
      )}
      <div className="min-w-0 text-left">
        <p className="truncate font-serif text-base font-black leading-tight text-[#0B0B0B] dark:text-white">{branding.agentName}</p>
        <p className="mt-0.5 truncate text-[11px] font-black uppercase tracking-wide dark:!text-[#d7b974]" style={{ color: accent }}>
          {[branding.agentBrokerage, branding.agentTitle].filter(Boolean).join(' · ')}
        </p>
        {branding.agentMarket && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-gray-500 dark:!text-gray-300">
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
          <div className="flex h-full w-full items-center justify-center text-white" style={{ backgroundColor: accent }}>
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
      <div className="flex h-full min-w-0 flex-col justify-center gap-1 p-2 text-left">
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
          <div className="flex items-center gap-1">
            {statChips.map(({ icon: StatIcon, label }, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-black dark:!text-[#d7b974]"
                style={{ backgroundColor: `${accent}17`, color: accent }}
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
          <div className="flex h-full w-full items-center justify-center text-white" style={{ backgroundColor: accent }}>
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
      <div className="flex h-full min-w-0 flex-col justify-center gap-1.5 p-4 text-left">
        <p className="truncate text-sm font-black leading-tight text-[#0B0B0B] dark:text-white">{property.address}</p>
        <p className="text-lg font-black leading-none tracking-tight text-[#0B0B0B] dark:!text-white">
          {property.price ? `$${Number(property.price).toLocaleString()}` : 'Price upon request'}
        </p>
        {statChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {statChips.map(({ icon: StatIcon, label }, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-black dark:!text-[#d7b974]"
                style={{ backgroundColor: `${accent}17`, color: accent }}
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
function AgentProfileBlock({ branding, accent }: { branding: FormRunnerBranding; accent: string }) {
  if (branding.showBranding === false) return null
  return (
    <div>
      {branding.agentPhotoUrl ? (
        <img
          src={branding.agentPhotoUrl}
          alt={branding.agentName}
          className="mx-auto h-16 w-16 rounded-full border-2 object-cover p-1 shadow-sm"
          style={{ borderColor: accent }}
        />
      ) : (
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 text-lg font-black text-white shadow-sm"
          style={{ borderColor: accent, backgroundColor: accent }}
        >
          {getInitials(branding.agentName)}
        </div>
      )}
      {branding.agentBrokerage && (
        <div className="-mt-1.5 inline-flex rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">
          {branding.agentBrokerage}
        </div>
      )}
      <h2 className="mt-3 font-serif text-2xl font-black leading-none tracking-tight text-[#111827] dark:text-white sm:text-[26px]">
        {branding.agentName}
      </h2>
      {branding.agentTitle && (
        <p className="mt-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">
          {branding.agentTitle}
        </p>
      )}
      {branding.agentMarket && (
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-[#778093] dark:text-gray-300">
          <MapPin className="h-3.5 w-3.5" style={{ color: accent }} /> {branding.agentMarket}
        </p>
      )}
    </div>
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
    return (
      <div className="space-y-5 text-left">
        {(question.fields || []).map(field => (
          <div key={field.id}>
            <label className="text-xs font-black uppercase tracking-widest text-gray-400">
              {field.label}
              {field.required && <span style={{ color: accent }}> *</span>}
            </label>
            <input
              type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
              value={typeof answers[field.id] === 'string' ? (answers[field.id] as string) : ''}
              onChange={event => setAnswer(field.id, event.target.value)}
              placeholder="Type your answer..."
              className="mt-1.5 w-full border-b-2 border-gray-200 bg-transparent px-1 py-2.5 text-lg font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white"
            />
          </div>
        ))}
      </div>
    )
  }

  if (question.type === 'select') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(question.options || []).map(option => {
          const selected = textValue === option
          return (
            <button
              key={option}
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
      <div className="grid gap-3 sm:grid-cols-2">
        {(question.options || []).map(option => {
          const selected = arrayValue.includes(option)
          return (
            <button
              key={option}
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
          type="number"
          step="0.01"
          value={textValue}
          onChange={event => setAnswer(question.id, event.target.value)}
          placeholder={question.placeholder || '0.00'}
          className="w-full border-b-2 border-gray-200 bg-transparent py-3 pl-6 pr-1 text-xl font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white"
        />
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        autoFocus
        type={question.type === 'number' ? 'number' : question.type === 'email' ? 'email' : question.type === 'phone' ? 'tel' : 'text'}
        value={textValue}
        onChange={event => setAnswer(question.id, event.target.value)}
        placeholder={question.placeholder || 'Type your answer...'}
        className={`w-full border-b-2 border-gray-200 bg-transparent px-1 py-3 text-xl font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:text-white ${question.unit ? 'pr-20' : ''}`}
      />
      {question.unit && (
        <span className="pointer-events-none absolute bottom-3 right-1 text-sm font-bold text-gray-400">{question.unit}</span>
      )}
    </div>
  )
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
          style={{ backgroundColor: accent }}
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

export default function FormRunner({ questions, branding, successHeading, successMessage, linkedProperty, propertyPhotoCarousel, onSubmit, focusBlockId, agentHubRedirect, brandingLayout = 'split' }: FormRunnerProps) {
  const accent = branding.accentColor || DEFAULT_ACCENT
  // step 0 = intro, 1..totalQuestions = questions, totalQuestions + 1 = success
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<AnswersState>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [redirectProgress, setRedirectProgress] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)
  const [topBarHeight, setTopBarHeight] = useState(0)
  const [isSmUp, setIsSmUp] = useState(false)

  // Prefill address-style fields from a linked property, without clobbering anything the visitor already typed.
  useEffect(() => {
    if (!linkedProperty) return
    const prefillMap: Record<string, string | null | undefined> = {
      address_line1: linkedProperty.address,
      city: linkedProperty.city,
      state: linkedProperty.state,
      zip: linkedProperty.zipcode,
    }
    const knownIds = new Set(questions.map(question => question.id))
    setAnswers(current => {
      let changed = false
      const next = { ...current }
      for (const [id, value] of Object.entries(prefillMap)) {
        if (value && knownIds.has(id) && !next[id]) {
          next[id] = value
          changed = true
        }
      }
      return changed ? next : current
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedProperty, questions])

  const visibleQuestions = useMemo(() => questions.filter(question => isQuestionVisible(question, answers)), [questions, answers])
  const totalQuestions = visibleQuestions.length
  const currentQuestion = step >= 1 && step <= totalQuestions ? visibleQuestions[step - 1] : null

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
    if (!isSuccess || !agentHubRedirect?.enabled) return
    const start = Date.now()
    const duration = 5000
    let frame: number
    const tick = () => {
      const elapsed = Date.now() - start
      const percent = Math.min(100, (elapsed / duration) * 100)
      setRedirectProgress(percent)
      if (percent < 100) {
        frame = requestAnimationFrame(tick)
      } else {
        window.location.href = agentHubRedirect.url
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, agentHubRedirect?.enabled, agentHubRedirect?.url])

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
        })
        const result = await onSubmit(payload)
        if (result.success) {
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
    event.preventDefault()
    if (isIntro) goToStep(1, 1)
    else if (currentQuestion) handleNext()
  }

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 32 : -32 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -32 : 32 }),
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="relative flex h-full min-h-[560px] w-full flex-col overflow-hidden bg-[#FAFAF7] dark:bg-[#0B0B0B] transition-colors duration-300"
    >
      {isSuccess && <ConfettiBurst />}

      {!isIntro && !isSuccess && !useIntegratedLayout && (
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800">
          <motion.div
            className="h-full"
            style={{ backgroundColor: accent }}
            initial={false}
            animate={{ width: `${(step / totalQuestions) * 100}%` }}
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

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-8">
        <div
          className={`w-full max-w-xl ${isIntro || isSuccess ? '-mt-14 sm:-mt-20' : ''}`}
          style={currentQuestion ? { marginTop: `-${(isSmUp ? 88 : 56) + topBarHeight}px` } : undefined}
        >
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {isIntro && (
              <motion.div
                key="intro"
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex flex-col items-center text-center"
              >
                <AgentProfileBlock branding={branding} accent={accent} />

                {linkedProperty && <PropertyHeroCard property={linkedProperty} cyclePhotos={propertyPhotoCarousel} />}

                <div className="mt-6 flex flex-col items-center">
                  <h1 className="text-3xl font-black leading-tight tracking-tight text-[#0B0B0B] dark:text-white sm:text-4xl">
                    {branding.title}
                  </h1>
                  {branding.subtitle && (
                    <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-[#5f6673] dark:text-gray-300">
                      {branding.subtitle}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => goToStep(1, 1)}
                    className="mt-8 inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
                    style={{ backgroundColor: accent }}
                  >
                    Start
                  </button>
                  <p className="mt-4 text-xs font-bold text-gray-400">Press Enter ↵</p>
                </div>
              </motion.div>
            )}

            {currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeOut' }}
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
                              <div className="flex h-14 w-14 items-center justify-center rounded-full text-base font-black text-white shadow-sm" style={{ backgroundColor: accent }}>
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
                          <div className="mt-6 flex items-center justify-center gap-4">
                            <button
                              type="button"
                              onClick={handleNext}
                              className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
                              style={{ backgroundColor: accent }}
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
                              {step} of {totalQuestions}
                            </span>
                          </div>
                          <div className="mt-4 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${(step / totalQuestions) * 100}%`, backgroundColor: accent }}
                            />
                          </div>

                          <div className="mt-6">
                            {renderQuestionField(currentQuestion, answers, setAnswer, accent)}
                            {currentQuestion.helper_text && (
                              <p className="mt-2 text-xs font-medium text-gray-400">{currentQuestion.helper_text}</p>
                            )}
                          </div>

                          <QuestionNavButtons
                            isLastStep={step === totalQuestions}
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
                      <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
                        style={{ backgroundColor: accent }}
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
                  Question {step} of {totalQuestions}
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
                  isLastStep={step === totalQuestions}
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
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="text-center"
              >
                {!linkedProperty && (
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg"
                    style={{ backgroundColor: accent }}
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

                <h1 className="mt-6 text-3xl font-black tracking-tight text-[#0B0B0B] dark:text-white">{successHeading}</h1>
                {successMessage && (
                  <p className="mx-auto mt-4 max-w-md text-base font-medium leading-relaxed text-[#5f6673] dark:text-gray-300">
                    {successMessage}
                  </p>
                )}

                {agentHubRedirect?.enabled && (
                  <div className="mx-auto mt-8 flex flex-col items-center gap-2">
                    <p className="text-xs font-bold text-gray-400">Redirecting...</p>
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-full" style={{ width: `${redirectProgress}%`, backgroundColor: accent }} />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
  )
}
