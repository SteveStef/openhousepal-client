'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowUpDown, Bath, Bed, Calculator, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronUp, Copy, Home, LandPlot, LayoutGrid, Layers, Loader2, Map as MapIcon, MapPin, Plus, Ruler,
  Save, Search, Share2, Sparkles, Trash2, X,
} from 'lucide-react'
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  CmaAiEstimate, CmaComparable, CmaCompCandidate, CmaCompStatus, CmaCompStrength, CmaImprovement, CmaMode,
  CmaPricing, CmaQualityAssessment, CmaReport, CmaSubjectProperty, MyListingItem,
} from '@/types'
import {
  CMA_STATUS_STYLES, COMP_STATUS_BADGE_STYLE, COMP_STATUS_LABEL, QUALITY_LABELS, STRENGTH_LABEL, STRENGTH_STYLES,
  average, computeMarketMetrics, formatDate, formatMoney, formatMoneyRange, formatNumber, median, pricePerSqft,
  primaryPlusStrong, sortComparables, suggestedValueRange,
} from '@/lib/cma'
import { CmaPresentationDocument } from '@/lib/pdfs'
import { acresToSqft, getMatchScore, sqftToAcres } from '@/lib/matchScore'
import { normalizeImageUrl } from '@/lib/utils'
import CompsMapView from '@/components/CompsMapView'

type StepId = 'subject' | 'comps' | 'analysis' | 'pricing' | 'summary'

const STEPS: { id: StepId, label: string, shortLabel?: string }[] = [
  { id: 'subject', label: 'Subject Property', shortLabel: 'Subject' },
  { id: 'comps', label: 'Find Comparables', shortLabel: 'Comps' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'summary', label: 'Summary & Share' },
]

// Freely navigable step progress - this is a workspace, not a locked wizard. `stretch` lets the
// connecting segments grow to fill the row (desktop, or the mobile row which gets its own full
// line); `showLabels` forces the word labels on even at narrow widths, for that mobile line.
function CmaStepper({ step, setStep, className = '', stretch = false, showLabels = false }: {
  step: StepId, setStep: (s: StepId) => void, className?: string, stretch?: boolean, showLabels?: boolean
}) {
  const currentIndex = STEPS.findIndex(x => x.id === step)
  return (
    <div className={`items-center px-3 ${stretch ? 'flex-1' : ''} ${className}`}>
      {STEPS.map((s, i) => {
        const isDone = i < currentIndex
        const isCurrent = s.id === step
        return (
          <div key={s.id} className={`flex items-center ${stretch ? 'flex-1 last:flex-none' : ''}`}>
            <button onClick={() => setStep(s.id)} className="group flex shrink-0 flex-col items-center gap-1">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-black transition ${
                isCurrent ? 'border-[#C9A24D] bg-[#C9A24D] text-white shadow-sm'
                  : isDone ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#C9A24D]'
                  : 'border-gray-200 bg-white text-gray-400 group-hover:border-[#C9A24D]/40 dark:border-gray-700 dark:bg-[#151517]'
              }`}>
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-[8px] font-black uppercase tracking-wide ${showLabels ? 'block' : 'hidden xl:block'} ${isCurrent ? 'text-[#111827] dark:text-white' : 'text-gray-400'}`}>
                {showLabels ? (s.shortLabel || s.label) : s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 shrink-0 rounded transition ${stretch ? 'flex-1' : 'w-6'} ${isDone ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// Maps an AI-proposed estimate into the real pricing fields the presentation/PDF actually reads -
// listing mode gets the recommended range + most-likely value, buyer mode gets the fair-value
// estimate instead. Never called automatically; only from an explicit agent "Apply" click.
function applyAiEstimateToPricing(pricing: CmaPricing, estimate: CmaAiEstimate, mode: CmaMode): CmaPricing {
  if (mode === 'buyer') {
    return { ...pricing, estimated_fair_value: estimate.value, offer_strategy_commentary: estimate.methodology_summary }
  }
  return {
    ...pricing,
    most_likely_value: estimate.value,
    recommended_min: estimate.range_min,
    recommended_max: estimate.range_max,
    pricing_commentary: estimate.methodology_summary,
  }
}

export default function CmaWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()
  const [report, setReport] = useState<CmaReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<StepId>('subject')
  const initialStepSet = useRef(false)

  const load = useCallback(() => {
    setLoading(true)
    api.cma.get(id).then(response => {
      if (response.success && response.data) {
        setReport(response.data)
        if (!initialStepSet.current) {
          initialStepSet.current = true
          if (!response.data.subject?.street_address) setStep('subject')
          else if (response.data.comparables.length === 0) setStep('comps')
          else setStep('analysis')
        }
      } else {
        showToast(response.error || 'Could not load this CMA.', 'error')
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => { load() }, [load])

  const save = useCallback(async (patch: Partial<CmaReport>, opts: { silent?: boolean } = {}) => {
    if (!report) return
    setSaving(true)
    const response = await api.cma.update(report.id, patch as any)
    setSaving(false)
    if (response.success && response.data) {
      setReport(response.data)
      if (!opts.silent) showToast('Saved', 'success')
    } else {
      showToast(response.error || 'Could not save changes.', 'error')
    }
  }, [report, showToast])

  // For results the server already fully computed and persisted itself (AI generation) - just
  // syncs local state, no redundant PATCH back to the same data.
  const applyReport = useCallback((updated: CmaReport) => setReport(updated), [])

  if (loading || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B]">
        <Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Row 1: back arrow + subject/client, and on mobile the status pill sits top-right here.
            On desktop the step progress stretches inline in this same row, ahead of the status pill. */}
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/studio/cma" title="All CMAs" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-gray-700 dark:text-gray-500 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D]/10 text-[#C9A24D]"><Calculator className="h-4.5 w-4.5" /></div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg font-black leading-tight text-[#111827] dark:text-white sm:text-xl">
                {report.subject?.street_address || 'New CMA'}
              </h1>
              <p className="truncate text-xs font-semibold text-gray-400">
                {report.client_name ? `For ${report.client_name} · ` : ''}{report.mode === 'buyer' ? 'Buyer Valuation' : 'Listing / Seller'}
              </p>
            </div>
          </div>

          {/* Step progress - desktop only here, stretches to fill the rest of the row */}
          <CmaStepper step={step} setStep={setStep} className="hidden lg:flex" stretch />

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            {saving && <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>}
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${CMA_STATUS_STYLES[report.status]}`}>{report.status.toLowerCase()}</span>
          </div>
        </div>

        {/* Row 2: step progress on mobile - full width, with labels, own line */}
        <CmaStepper step={step} setStep={setStep} className="mt-5 flex lg:hidden" stretch showLabels />

        <div className="mt-6">
          {step === 'subject' && <SubjectStep report={report} onSave={save} onNext={() => setStep('comps')} />}
          {step === 'comps' && <CompsStep report={report} onSave={save} onNext={() => setStep('analysis')} />}
          {step === 'analysis' && <AnalysisStep report={report} onSave={save} onReportUpdated={applyReport} onNext={() => setStep('pricing')} />}
          {step === 'pricing' && <PricingStep report={report} onSave={save} onNext={() => setStep('summary')} />}
          {step === 'summary' && <SummaryStep report={report} onSave={save} onJump={setStep} onDeleted={() => router.push('/studio/cma')} />}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Shared small UI pieces
// ============================================================================

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-400">{children}</label>
}

function TextField({ label, value, onChange, type = 'text', placeholder }: {
  label: string, value: string | number | null | undefined, onChange: (v: string) => void, type?: string, placeholder?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
      />
    </div>
  )
}

function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T, label: string }[], value: T | null | undefined, onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
            value === opt.value ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SectionCard({ title, subtitle, children, right }: { title: string, subtitle?: string, children: React.ReactNode, right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-black text-[#111827] dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-semibold text-gray-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function NextButton({ onClick, label = 'Continue' }: { onClick: () => void, label?: string }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]"
      >
        {label} <ArrowLeft className="h-4 w-4 rotate-180" />
      </button>
    </div>
  )
}

// ============================================================================
// Step 1: Subject Property
// ============================================================================

function SubjectStep({ report, onSave, onNext }: { report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => void, onNext: () => void }) {
  const [subject, setSubject] = useState<CmaSubjectProperty>(report.subject)
  const [mode, setMode] = useState<'search' | 'mine' | 'manual'>('search')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [myListings, setMyListings] = useState<MyListingItem[]>([])
  const hasSubject = Boolean(subject.street_address)

  useEffect(() => { setSubject(report.subject) }, [report.id])

  useEffect(() => {
    if (mode !== 'mine' || myListings.length > 0) return
    api.openHouseManager.getMyListings().then(r => {
      if (r.success && r.data) setMyListings(r.data.listings)
    })
  }, [mode, myListings.length])

  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 4) { setSuggestions([]); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(() => {
      api.properties.address(query.trim()).then(r => {
        if (cancelled) return
        if (r.success && r.data) setSuggestions(r.data.results || [])
        setSearching(false)
      })
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, mode])

  const selectAddress = async (address: string) => {
    setSearching(true)
    const response = await api.properties.lookup(address)
    setSearching(false)
    if (response.success && response.data) {
      const p = response.data
      setSubject(mapPropertyToSubject(p))
      setSuggestions([])
      setQuery('')
    }
  }

  const selectMyListing = (listing: MyListingItem) => {
    setSubject({
      listing_key: listing.listing_key,
      source: 'mls',
      photo_url: listing.image || null,
      street_address: listing.address,
      city: listing.city,
      state: listing.state,
      zipcode: listing.zipcode,
      list_price: listing.price ?? null,
      beds: listing.bedrooms ?? null,
      baths: listing.bathrooms ?? null,
      sqft: listing.living_area ?? null,
      lot_size: null,
      year_built: null,
      property_type: null,
      garage: null,
      basement: null,
      days_on_market: listing.days_on_market ?? null,
      mls_status: listing.status ?? null,
      last_sale_date: null,
      last_sale_price: null,
    })
  }

  const startManual = () => {
    setMode('manual')
    setSubject(s => s.street_address ? s : { source: 'manual', beds: null, baths: null, sqft: null, lot_size: null, year_built: null } as CmaSubjectProperty)
  }

  const handleContinue = () => {
    onSave({ subject })
    onNext()
  }

  return (
    <div className="space-y-5">
      {!hasSubject && (
        <SectionCard title="Select the Subject Property" subtitle="Search by address, pick one of your listings, or enter it manually.">
          <div className="flex flex-wrap gap-1.5">
            <SegmentedControl
              options={[{ value: 'search', label: 'Search Address' }, { value: 'mine', label: 'My Listings' }, { value: 'manual', label: 'Enter Manually' }]}
              value={mode}
              onChange={v => v === 'manual' ? startManual() : setMode(v)}
            />
          </div>

          {mode === 'search' && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Start typing an address..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-[#151517]">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => selectAddress(s.address)}
                      className="flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 hover:bg-[#C9A24D]/10 dark:border-gray-800"
                    >
                      {s.image ? <img src={normalizeImageUrl(s.image || undefined)} alt="" className="h-10 w-12 shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{s.address}</p>
                        {s.price && <p className="text-xs font-semibold text-gray-400">{formatMoney(s.price)}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'mine' && (
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {myListings.length === 0 && <p className="py-6 text-center text-sm font-semibold text-gray-400">No active listings found.</p>}
              {myListings.map(listing => (
                <button
                  key={listing.listing_key}
                  onClick={() => selectMyListing(listing)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-2.5 text-left transition hover:border-[#C9A24D]/40 dark:border-gray-800"
                >
                  {listing.image ? <img src={normalizeImageUrl(listing.image || undefined)} alt="" className="h-12 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{listing.address}</p>
                    <p className="text-xs font-semibold text-gray-400">{listing.price ? formatMoney(listing.price) : ''} {listing.bedrooms ? `· ${listing.bedrooms} bd` : ''} {listing.bathrooms ? `· ${listing.bathrooms} ba` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {hasSubject && (
        <SectionCard
          title="Subject Property"
          subtitle="Edit any fact that isn't quite right."
          right={<button onClick={() => setSubject({ source: 'manual' } as CmaSubjectProperty)} className="text-xs font-black text-gray-400 hover:text-[#111827] dark:hover:text-white">Change Property</button>}
        >
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 sm:w-44">
              {subject.photo_url ? <img src={normalizeImageUrl(subject.photo_url || undefined)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3"><TextField label="Street Address" value={subject.street_address} onChange={v => setSubject(s => ({ ...s, street_address: v }))} /></div>
              <TextField label="City" value={subject.city} onChange={v => setSubject(s => ({ ...s, city: v }))} />
              <TextField label="State" value={subject.state} onChange={v => setSubject(s => ({ ...s, state: v }))} />
              <TextField label="Zip" value={subject.zipcode} onChange={v => setSubject(s => ({ ...s, zipcode: v }))} />
              <TextField label="List Price" type="number" value={subject.list_price} onChange={v => setSubject(s => ({ ...s, list_price: v ? Number(v) : null }))} />
              <TextField label="Beds" type="number" value={subject.beds} onChange={v => setSubject(s => ({ ...s, beds: v ? Number(v) : null }))} />
              <TextField label="Baths" type="number" value={subject.baths} onChange={v => setSubject(s => ({ ...s, baths: v ? Number(v) : null }))} />
              <TextField label="Sq Ft" type="number" value={subject.sqft} onChange={v => setSubject(s => ({ ...s, sqft: v ? Number(v) : null }))} />
              <TextField label="Lot Size (sqft)" type="number" value={subject.lot_size} onChange={v => setSubject(s => ({ ...s, lot_size: v ? Number(v) : null }))} />
              <TextField label="Year Built" type="number" value={subject.year_built} onChange={v => setSubject(s => ({ ...s, year_built: v ? Number(v) : null }))} />
              <TextField label="Property Type" value={subject.property_type} onChange={v => setSubject(s => ({ ...s, property_type: v }))} />
              <TextField label="Garage" value={subject.garage} onChange={v => setSubject(s => ({ ...s, garage: v }))} placeholder="e.g. 2 Car Attached" />
              <TextField label="Basement" value={subject.basement} onChange={v => setSubject(s => ({ ...s, basement: v }))} placeholder="e.g. Finished" />
              <TextField label="Days on Market" type="number" value={subject.days_on_market} onChange={v => setSubject(s => ({ ...s, days_on_market: v ? Number(v) : null }))} />
              <TextField label="Current Status" value={subject.mls_status} onChange={v => setSubject(s => ({ ...s, mls_status: v }))} />
              <TextField label="Last Sale Date" type="date" value={subject.last_sale_date} onChange={v => setSubject(s => ({ ...s, last_sale_date: v }))} />
              <TextField label="Last Sale Price" type="number" value={subject.last_sale_price} onChange={v => setSubject(s => ({ ...s, last_sale_price: v ? Number(v) : null }))} />
            </div>
          </div>
        </SectionCard>
      )}

      {hasSubject && (
        <div className="flex justify-end gap-2">
          <button onClick={() => onSave({ subject }, { silent: true })} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button onClick={handleContinue} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
            Find Comparables <ArrowLeft className="h-4 w-4 rotate-180" />
          </button>
        </div>
      )}
    </div>
  )
}

function mapPropertyToSubject(p: any): CmaSubjectProperty {
  return {
    listing_key: p.ListingKey || null,
    source: 'mls',
    photo_url: p.ListPictureURL || (Array.isArray(p.photos) ? p.photos[0] : null) || null,
    street_address: p.FullStreetAddress || null,
    city: p.City || null,
    state: p.StateOrProvince || null,
    zipcode: p.PostalCode || null,
    latitude: p.Latitude ?? null,
    longitude: p.Longitude ?? null,
    list_price: p.ListPrice ?? null,
    beds: p.BedroomsTotal ?? null,
    baths: p.BathroomsTotal ?? null,
    sqft: p.LivingArea ?? null,
    lot_size: p.LotSizeSquareFeet ?? null,
    year_built: p.YearBuilt ?? null,
    property_type: p.PropertyType || null,
    garage: p.GarageYN ? (p.GarageSpaces ? `${p.GarageSpaces} Car` : 'Yes') : (p.GarageYN === false ? 'None' : null),
    basement: Array.isArray(p.basement) && p.basement.length ? p.basement.join(', ') : (p.has_basement === false ? 'None' : null),
    days_on_market: p.DaysOnMarket ?? null,
    mls_status: p.MlsStatus || null,
    last_sale_date: null,
    last_sale_price: null,
    school_district: p.SchoolDistrictName || null,
    annual_taxes: p.TaxAnnualAmount ?? null,
  }
}

function candidateToComparable(c: CmaCompCandidate): CmaComparable {
  return {
    id: newId(),
    listing_key: c.listing_key,
    source: 'mls',
    is_included: true,
    order_index: 0,
    status: c.status,
    photo_url: c.photo_url,
    photos: c.photos || [],
    street_address: c.street_address,
    city: c.city,
    state: c.state,
    zipcode: c.zipcode,
    latitude: c.latitude,
    longitude: c.longitude,
    distance_miles: c.distance_miles,
    sale_price: c.sale_price,
    list_price: c.list_price,
    sale_date: c.sale_date,
    days_on_market: c.days_on_market,
    sqft: c.sqft,
    lot_size: c.lot_size,
    beds: c.beds,
    baths: c.baths,
    year_built: c.year_built,
    garage: c.garage,
    basement: c.basement,
    price_per_sqft: c.price_per_sqft,
    annual_taxes: c.annual_taxes,
    quality: {},
    strength: null,
    commentary: null,
  }
}

// ============================================================================
// Step 2: Comparable Search
// ============================================================================

const COMP_STATUS_OPTIONS: { value: CmaCompStatus, label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'active_under_contract', label: 'Active Under Contract' },
  { value: 'pending', label: 'Pending' },
  { value: 'sold', label: 'Sold' },
]

const SOLD_DAYS_STEPS = [100, 200, 300, 400, 500, 600, 700, 750]

// Same "pop" as the Showcases fact chips (components/PropertyDetailsModal.tsx's FactChip) -
// icon on top, bold value, small caps label - just sized down to fit inside a card footer.
function CmaFactChip({ icon: Icon, value, label }: { icon: any, value: string | number, label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-2 text-center dark:border-gray-800 dark:bg-[#0B0B0B]">
      <Icon className="h-3.5 w-3.5 text-[#C9A24D]" />
      <span className="text-sm font-black leading-none text-[#111827] dark:text-white">{value}</span>
      <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">{label}</span>
    </div>
  )
}

function CompsStep({ report, onSave, onNext }: { report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => void, onNext: () => void }) {
  const { showToast } = useToast()
  const [comparables, setComparables] = useState<CmaComparable[]>(report.comparables)
  const [statuses, setStatuses] = useState<CmaCompStatus[]>(['sold'])
  const [radius, setRadius] = useState(5)
  // Same autofill rule as the Similar Properties sheet (CreateOpenHouseWizard) - seed the price
  // and beds range from the subject itself so the very first search already returns real comps,
  // not an unbounded dump of every property in the radius.
  const [minPrice, setMinPrice] = useState(() => {
    const price = report.subject.list_price || 0
    return price ? String(Math.max(0, Math.floor(price * 0.8 / 10000) * 10000)) : ''
  })
  const [maxPrice, setMaxPrice] = useState(() => {
    const price = report.subject.list_price || 0
    return price ? String(Math.ceil(price * 1.2 / 10000) * 10000) : ''
  })
  const [minBeds, setMinBeds] = useState(() => {
    const beds = report.subject.beds || 0
    if (!beds) return 0
    return Math.max(0, beds - (beds >= 8 ? 2 : 1))
  })
  const [minAcres, setMinAcres] = useState(0)
  const [minSqft, setMinSqft] = useState('')
  const [maxSqft, setMaxSqft] = useState('')
  const [minYearBuilt, setMinYearBuilt] = useState('')
  // Defaults to a year-ish window and widens itself (100 -> 200 -> 300 ... -> 750) whenever a
  // sold search comes back with fewer than 5 matches, so a quiet market still surfaces comps
  // instead of an empty result. Stops auto-widening the moment the agent edits it by hand.
  const [soldWithinDays, setSoldWithinDays] = useState('100')
  const autoSoldDaysRef = useRef(true)
  const [results, setResults] = useState<CmaCompCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid')
  const [popup, setPopup] = useState<{ type: 'subject' } | { type: 'candidate', candidate: CmaCompCandidate } | null>(null)
  // Guards against out-of-order responses - the sold-days auto-widen can fire several searches
  // back to back, and without this a slower earlier response can land after a faster later one
  // and clobber it with stale/smaller results.
  const searchSeqRef = useRef(0)

  // Only ever auto-picks comps once per report - if this report already had comps saved (a
  // return visit), the ref starts true and auto-select never runs, so it can never clobber an
  // agent's own picks. Once it HAS run (whether it found anything or not), it never runs again
  // either, even if the agent later removes everything - at that point they're in manual control.
  const autoSelectedRef = useRef(report.comparables.length > 0)
  useEffect(() => {
    autoSelectedRef.current = report.comparables.length > 0
    setComparables(report.comparables)
  }, [report.id])

  const addedKeys = useMemo(() => new Set(comparables.map(c => c.listing_key).filter(Boolean)), [comparables])

  const subject = report.subject
  const subjectAcres = sqftToAcres(subject.lot_size)

  const runSearch = useCallback(() => {
    if (statuses.length === 0) {
      setResults([])
      return
    }
    if (!report.subject.latitude || !report.subject.longitude) {
      showToast('This subject property is missing location coordinates - try re-selecting it from the address search on the previous step.', 'error')
      return
    }
    setSearching(true)
    setSearched(true)
    const seq = ++searchSeqRef.current
    const saleDateFrom = soldWithinDays
      ? new Date(Date.now() - Number(soldWithinDays) * 86400000).toISOString().slice(0, 10)
      : undefined
    api.cma.searchComparables({
      listing_key: report.subject.listing_key || undefined,
      latitude: report.subject.latitude,
      longitude: report.subject.longitude,
      radius_miles: radius,
      statuses,
      sale_date_from: saleDateFrom,
      min_price: minPrice ? Number(minPrice) : undefined,
      max_price: maxPrice ? Number(maxPrice) : undefined,
      min_sqft: minSqft ? Number(minSqft) : undefined,
      max_sqft: maxSqft ? Number(maxSqft) : undefined,
      min_lot_size: minAcres ? acresToSqft(minAcres) : undefined,
      min_year_built: minYearBuilt ? Number(minYearBuilt) : undefined,
      min_beds: minBeds ? minBeds : undefined,
    }).then(r => {
      if (seq !== searchSeqRef.current) return
      setSearching(false)
      if (r.success && r.data) {
        setResults(r.data)
        if (statuses.includes('sold') && autoSoldDaysRef.current && r.data.length < 5) {
          const currentIndex = SOLD_DAYS_STEPS.indexOf(Number(soldWithinDays))
          const next = currentIndex >= 0 ? SOLD_DAYS_STEPS[currentIndex + 1] : undefined
          if (next) setSoldWithinDays(String(next))
        }
      } else {
        showToast(r.error || 'Search failed.', 'error')
      }
    })
  }, [report.subject, radius, statuses, soldWithinDays, minPrice, maxPrice, minSqft, maxSqft, minAcres, minYearBuilt, minBeds, showToast])

  // Auto-pulls from the database as filters change - no manual search trigger, debounced the
  // same way the Similar Properties sheet debounces its preference changes.
  useEffect(() => {
    const timeout = setTimeout(() => { runSearch() }, 350)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses.join(','), radius, minPrice, maxPrice, minBeds, minAcres, minSqft, maxSqft, minYearBuilt, soldWithinDays, report.subject.latitude, report.subject.longitude])

  const toggleStatus = (value: CmaCompStatus) => {
    setStatuses(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value])
  }

  // Same "Same School" badge as the Similar Properties sheet - case-insensitive district match.
  const subjectSchool = (subject.school_district || '').trim().toLowerCase()
  const isSameSchool = (candidate: CmaCompCandidate) => {
    const school = (candidate.school_district || '').trim().toLowerCase()
    return Boolean(school && subjectSchool && school === subjectSchool)
  }

  const toggleAdd = (candidate: CmaCompCandidate) => {
    if (addedKeys.has(candidate.listing_key)) {
      setComparables(cs => cs.filter(c => c.listing_key !== candidate.listing_key))
    } else {
      setComparables(cs => [...cs, { ...candidateToComparable(candidate), order_index: cs.length, match_score: scoreFor(candidate) }])
    }
  }

  const removeComp = (id: string) => setComparables(cs => cs.filter(c => c.id !== id))

  // Same matching system as the Similar Properties feature (frontend/lib/matchScore.ts) - not
  // reinvented for CMA, just applied against whichever comps the status/filter search returns.
  const scoreFor = useCallback((candidate: CmaCompCandidate) => getMatchScore(
    { sqft: report.subject.sqft, lotSizeAcres: sqftToAcres(report.subject.lot_size), beds: report.subject.beds, baths: report.subject.baths, price: report.subject.list_price, city: report.subject.city },
    { sqft: candidate.sqft, lotSizeAcres: sqftToAcres(candidate.lot_size), beds: candidate.beds, baths: candidate.baths, price: candidate.sale_price ?? candidate.list_price, city: candidate.city, distanceMiles: candidate.distance_miles },
  ), [report.subject])

  const sortedResults = useMemo(() => [...results].sort((a, b) => scoreFor(b) - scoreFor(a)), [results, scoreFor])

  // Auto-suggests the top matches the first time a fresh search comes back - always the top 3,
  // extended to 4-5 only while score stays >=70%, so a 5th slot never gets filled by a weak match
  // just to hit a round number. A default the agent sees and can freely override (toggleAdd/
  // removeComp below still work exactly as before), not a lock.
  useEffect(() => {
    if (autoSelectedRef.current || sortedResults.length === 0) return
    autoSelectedRef.current = true
    const picks = sortedResults.filter((c, i) => i < 3 || (i < 5 && scoreFor(c) >= 70))
    if (picks.length > 0) {
      setComparables(picks.map((c, i) => ({ ...candidateToComparable(c), order_index: i, match_score: scoreFor(c) })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedResults])

  const handleContinue = () => {
    onSave({ comparables })
    onNext()
  }

  const popupProps: PropertyPopupData | null = useMemo(() => {
    if (!popup) return null
    if (popup.type === 'subject') {
      return {
        photos: subject.photo_url ? [subject.photo_url] : [],
        address: subject.street_address || 'Subject Property',
        cityState: [subject.city, subject.state].filter(Boolean).join(', '),
        price: subject.list_price,
        priceLabel: 'List Price',
        status: null,
        matchScore: null,
        distanceMiles: null,
        stats: [
          { icon: Bed, label: 'Beds', value: subject.beds ?? '-' },
          { icon: Bath, label: 'Baths', value: subject.baths ?? '-' },
          { icon: Ruler, label: 'Sq Ft', value: subject.sqft ? formatNumber(subject.sqft) : '-' },
          { icon: LandPlot, label: 'Acres', value: subjectAcres ? subjectAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-' },
        ],
        extra: [
          subject.year_built ? { label: 'Year Built', value: String(subject.year_built) } : null,
          subject.garage ? { label: 'Garage', value: subject.garage } : null,
          subject.basement ? { label: 'Basement', value: subject.basement } : null,
          subject.school_district ? { label: 'School District', value: subject.school_district } : null,
        ].filter((x): x is { label: string, value: string } => !!x),
        description: null,
        sameSchool: false,
      }
    }
    const c = popup.candidate
    return {
      photos: c.photos && c.photos.length > 0 ? c.photos : (c.photo_url ? [c.photo_url] : []),
      address: c.street_address || 'Comparable Property',
      cityState: [c.city, c.state].filter(Boolean).join(', '),
      price: c.sale_price ?? c.list_price,
      priceLabel: c.sale_price ? 'Sale Price' : 'List Price',
      status: c.status,
      matchScore: scoreFor(c),
      distanceMiles: c.distance_miles,
      sameSchool: isSameSchool(c),
      stats: [
        { icon: Bed, label: 'Beds', value: c.beds ?? '-' },
        { icon: Bath, label: 'Baths', value: c.baths ?? '-' },
        { icon: Ruler, label: 'Sq Ft', value: c.sqft ? formatNumber(c.sqft) : '-' },
        { icon: LandPlot, label: 'Acres', value: c.lot_size ? sqftToAcres(c.lot_size).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-' },
      ],
      extra: [
        c.year_built ? { label: 'Year Built', value: String(c.year_built) } : null,
        c.sale_date ? { label: 'Sale Date', value: formatDate(c.sale_date) } : null,
        c.days_on_market != null ? { label: 'Days on Market', value: String(c.days_on_market) } : null,
        c.garage ? { label: 'Garage', value: c.garage } : null,
        c.basement ? { label: 'Basement', value: c.basement } : null,
        c.price_per_sqft ? { label: '$ / Sq Ft', value: `$${c.price_per_sqft}` } : null,
        c.school_district ? { label: 'School District', value: c.school_district } : null,
      ].filter((x): x is { label: string, value: string } => !!x),
      description: c.public_remarks || null,
    }
  }, [popup, subject, subjectAcres, scoreFor])

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-[#faf9f7] p-4 shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] sm:p-5">
        <div className="-m-4 mb-4 flex items-center justify-center rounded-t-2xl border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-[#151517] sm:-m-5 sm:mb-5 sm:px-5">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">
            <Layers className="h-3.5 w-3.5" /> Find Comparables
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">Refine Your Search</h2>
            <p className="mt-1 truncate text-sm font-semibold text-gray-500 dark:text-gray-400">
              Comps near <span className="font-black text-gray-900 dark:text-white">{subject.street_address || 'the subject property'}</span>
            </p>

            <button
              type="button"
              onClick={() => setPopup({ type: 'subject' })}
              className="mt-4 w-full overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition hover:border-[#C9A24D]/50 dark:border-gray-800 dark:bg-[#151517]"
            >
              <div className="relative h-48 w-full bg-gray-100 dark:bg-gray-800 sm:h-56">
                {subject.photo_url ? (
                  <img src={normalizeImageUrl(subject.photo_url || undefined)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Home className="h-8 w-8 text-gray-300" /></div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-black text-[#111827] dark:text-white">{subject.street_address || 'Subject Property'}</p>
                  {!!subject.list_price && (
                    <p className="shrink-0 text-lg font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(subject.list_price)}</p>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wide text-gray-400">{[subject.city, subject.state].filter(Boolean).join(', ') || '—'}</p>
                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  <CmaFactChip icon={Bed} value={subject.beds || '-'} label="Beds" />
                  <CmaFactChip icon={Bath} value={subject.baths || '-'} label="Baths" />
                  <CmaFactChip icon={Ruler} value={subject.sqft ? formatNumber(subject.sqft) : '-'} label="Sqft" />
                  <CmaFactChip icon={LandPlot} value={subjectAcres ? subjectAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'} label="Acres" />
                </div>
              </div>
            </button>
          </div>

          <div className="grid gap-3">
            <div>
              <FieldLabel>Status</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {COMP_STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleStatus(opt.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                      statuses.includes(opt.value) ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Price</label>
                <input type="text" inputMode="numeric" value={minPrice ? Number(minPrice).toLocaleString() : ''} onChange={e => setMinPrice(e.target.value.replace(/\D/g, ''))} placeholder="0" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
              </div>
              <div>
                <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Max Price</label>
                <input type="text" inputMode="numeric" value={maxPrice ? Number(maxPrice).toLocaleString() : ''} onChange={e => setMaxPrice(e.target.value.replace(/\D/g, ''))} placeholder="No Max" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Beds</label>
                <select value={minBeds} onChange={e => setMinBeds(Number(e.target.value))} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                  {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Acres</label>
                <select value={minAcres} onChange={e => setMinAcres(Number(e.target.value))} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                  {[0, 0.1, 0.25, 0.5, 0.75, 1].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Max Sq Ft</label>
                <input type="number" value={maxSqft} onChange={e => setMaxSqft(e.target.value)} placeholder="Any" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-[#151517]">
              <input type="range" min="1" max="25" step="1" value={radius} onChange={e => setRadius(Number(e.target.value))} className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-[#C9A24D] dark:bg-gray-700" />
              <div className="min-w-[70px] text-right"><span className="text-base font-black text-gray-900 dark:text-white">{radius}</span><span className="ml-1 text-[9px] font-bold uppercase text-gray-500">Miles</span></div>
            </div>

            <div className={`grid gap-3 ${statuses.includes('sold') ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TextField label="Min Sq Ft" type="number" value={minSqft} onChange={setMinSqft} placeholder="Any" />
              {statuses.includes('sold') && (
                <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Sold In The Last</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={soldWithinDays} onChange={e => { autoSoldDaysRef.current = false; setSoldWithinDays(e.target.value) }} placeholder="Any time" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" />
                    <span className="shrink-0 text-[10px] font-bold uppercase text-gray-500">Days</span>
                  </div>
                </div>
              )}
              <TextField label="Min Year Built" type="number" value={minYearBuilt} onChange={setMinYearBuilt} placeholder="Any" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-[#f1f3f5] p-4 shadow-inner dark:border-gray-800 dark:bg-transparent sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Property Selection</h3>
            <p className="text-xs font-semibold text-gray-400">OpenHousePal suggests candidates near the subject - you decide what actually belongs in the CMA.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center self-start rounded-2xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-[#0B0B0B]">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                  viewMode === 'grid' ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                  viewMode === 'map' ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" /> Map
              </button>
            </div>
            <div className="inline-flex items-center self-start rounded-2xl border border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-[#0B0B0B]">
              <span className="mr-2 text-[10px] font-black uppercase tracking-wide text-gray-400">Results</span>
              <span className="text-lg font-black text-[#111827] dark:text-white">{results.length}</span>
            </div>
            <div className="inline-flex items-center self-start rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 dark:border-emerald-900/30 dark:bg-emerald-900/10">
              <span className="mr-2 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Added</span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{comparables.length}</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
          Top matches auto-selected (70%+ match score) - add or remove any of them below.
        </p>

        {searching ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-12 text-sm font-bold text-gray-400 dark:border-gray-800">
            <Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /> Searching...
          </div>
        ) : statuses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
            <p className="text-sm font-black text-gray-500 dark:text-gray-400">Select at least one status</p>
            <p className="mt-1 text-xs font-semibold text-gray-400">Choose Active, Active Under Contract, Pending, and/or Sold above.</p>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
            <Search className="mx-auto mb-3 h-6 w-6 text-gray-300" />
            <p className="text-sm font-black text-gray-500 dark:text-gray-400">No matching properties yet</p>
            <p className="mt-1 text-xs font-semibold text-gray-400">Try widening the radius or price range.</p>
          </div>
        ) : viewMode === 'map' ? (
          <CompsMapView
            subject={subject}
            candidates={sortedResults}
            addedKeys={addedKeys}
            radiusMiles={radius}
            onRadiusChange={setRadius}
            onToggleAdd={toggleAdd}
            onOpenDetails={candidate => setPopup({ type: 'candidate', candidate })}
          />
        ) : (
          <div className="grid max-h-[900px] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map(candidate => (
              <CompCandidateCard
                key={candidate.listing_key}
                candidate={candidate}
                matchScore={scoreFor(candidate)}
                added={addedKeys.has(candidate.listing_key)}
                sameSchool={isSameSchool(candidate)}
                onToggle={() => toggleAdd(candidate)}
                onOpenDetails={() => setPopup({ type: 'candidate', candidate })}
              />
            ))}
          </div>
        )}
      </div>

      <PropertyPopupModal open={!!popup} onClose={() => setPopup(null)} data={popupProps} />

      {comparables.length > 0 && (
        <SectionCard title={`Added Comparables (${comparables.length})`}>
          <div className="space-y-2">
            {comparables.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5 dark:border-gray-800">
                {c.photo_url ? <img src={normalizeImageUrl(c.photo_url || undefined)} alt="" className="h-10 w-12 shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{c.street_address}</p>
                  <p className="text-xs font-semibold text-gray-400">{formatMoney(c.sale_price ?? c.list_price)} {c.distance_miles != null ? `· ${c.distance_miles} mi` : ''}</p>
                </div>
                <button onClick={() => removeComp(c.id)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={() => onSave({ comparables }, { silent: true })} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400">
          <Save className="h-3.5 w-3.5" /> Save
        </button>
        <button
          onClick={handleContinue}
          disabled={comparables.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827]"
        >
          Continue to Analysis <ArrowLeft className="h-4 w-4 rotate-180" />
        </button>
      </div>
    </div>
  )
}

function CompCandidateCard({ candidate, matchScore, added, sameSchool, onToggle, onOpenDetails }: { candidate: CmaCompCandidate, matchScore?: number, added: boolean, sameSchool: boolean, onToggle: () => void, onOpenDetails: () => void }) {
  const psf = candidate.price_per_sqft ?? pricePerSqft(candidate.sale_price ?? candidate.list_price, candidate.sqft)
  const candidateAcres = sqftToAcres(candidate.lot_size)
  const cityState = [candidate.city, candidate.state].filter(Boolean).join(', ')
  const photos = candidate.photos && candidate.photos.length > 0 ? candidate.photos : (candidate.photo_url ? [candidate.photo_url] : [])
  const [photoIndex, setPhotoIndex] = useState(0)
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRotate = () => {
    if (photos.length < 2 || rotateRef.current) return
    rotateRef.current = setInterval(() => setPhotoIndex(i => (i + 1) % photos.length), 3000)
  }
  const stopRotate = () => {
    if (rotateRef.current) { clearInterval(rotateRef.current); rotateRef.current = null }
    setPhotoIndex(0)
  }
  useEffect(() => () => { if (rotateRef.current) clearInterval(rotateRef.current) }, [])

  return (
    <div className={`overflow-hidden rounded-2xl border-2 transition ${added ? 'border-emerald-500 ring-4 ring-emerald-500/15' : 'border-gray-100 dark:border-gray-800'}`}>
      <button type="button" onClick={onOpenDetails} onMouseEnter={startRotate} onMouseLeave={stopRotate} className="relative block h-48 w-full bg-gray-100 text-left dark:bg-gray-800 sm:h-56">
        {photos.length > 0 ? <img src={normalizeImageUrl(photos[photoIndex])} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Home className="h-6 w-6 text-gray-300" /></div>}
        {typeof matchScore === 'number' && (
          <div className={`absolute left-2 top-2 rounded-full px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg ${matchScore >= 70 ? 'bg-emerald-600' : 'bg-gray-500'}`}>
            {matchScore}% Match
          </div>
        )}
        {candidate.status && (
          <span className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[candidate.status] || 'bg-gray-800'}`}>
            {COMP_STATUS_LABEL[candidate.status] || candidate.status}
          </span>
        )}
        {sameSchool && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-lg ring-1 ring-black/5">
            Same School
          </span>
        )}
        {candidate.distance_miles != null && (
          <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">{candidate.distance_miles} mi</span>
        )}
        {added && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/20">
            <div className="rounded-full bg-emerald-600 p-2 text-white shadow-lg"><Check className="h-5 w-5" /></div>
          </div>
        )}
      </button>
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-black text-[#111827] dark:text-white">{candidate.street_address}</p>
          <span className="shrink-0 text-sm font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(candidate.sale_price ?? candidate.list_price)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-gray-400">{cityState || '—'}</p>
          {psf && <span className="shrink-0 text-[10px] font-bold text-gray-400">${psf}/sqft</span>}
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          <CmaFactChip icon={Bed} value={candidate.beds ?? '-'} label="Beds" />
          <CmaFactChip icon={Bath} value={candidate.baths ?? '-'} label="Baths" />
          <CmaFactChip icon={Ruler} value={candidate.sqft ? formatNumber(candidate.sqft) : '-'} label="Sqft" />
          <CmaFactChip icon={LandPlot} value={candidateAcres > 0 ? candidateAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'} label="Acres" />
        </div>
        <button
          onClick={onToggle}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide transition ${
            added ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-300'
          }`}
        >
          {added ? <><Check className="h-3.5 w-3.5" /> Added to CMA</> : <><Plus className="h-3.5 w-3.5" /> Add to CMA</>}
        </button>
      </div>
    </div>
  )
}

interface PropertyPopupData {
  photos: string[]
  address?: string | null
  cityState?: string | null
  price?: number | null
  priceLabel?: string
  status?: string | null
  matchScore?: number | null
  distanceMiles?: number | null
  sameSchool: boolean
  stats: { icon: any, label: string, value: string | number }[]
  extra: { label: string, value: string }[]
  description?: string | null
}

// Same pop-open, click-to-zoom pattern as the Showcases property detail view
// (components/PropertyDetailsModal.tsx) - photo + filmstrip picture-selector below it, then the
// full fact set - a lighter version scoped to what a CMA comp actually has.
function PropertyPopupModal({ open, onClose, data }: { open: boolean, onClose: () => void, data: PropertyPopupData | null }) {
  const [index, setIndex] = useState(0)
  useEffect(() => { if (open) setIndex(0) }, [open, data])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (data && data.photos.length > 1) {
        if (e.key === 'ArrowRight') setIndex(i => (i + 1) % data.photos.length)
        if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + data.photos.length) % data.photos.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, data])

  if (!open || !data) return null
  const pics = data.photos.length > 0 ? data.photos : []

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"><X className="h-4 w-4" /></button>
        <div className="shrink-0 overflow-y-auto">
          {/* aspect-[4/3] matches real MLS photo proportions - a fixed short/wide box was forcing
              heavy object-cover crops that read as "zoomed in" and too wide. */}
          <div className="relative aspect-[4/3] max-h-[420px] w-full bg-gray-100 dark:bg-gray-800">
            {pics.length > 0 ? (
              <img src={normalizeImageUrl(pics[index])} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><Home className="h-10 w-10 text-gray-300" /></div>
            )}
            {data.status && (
              <span className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[data.status] || 'bg-gray-800'}`}>
                {COMP_STATUS_LABEL[data.status] || data.status}
              </span>
            )}
            {typeof data.matchScore === 'number' && (
              <span className="absolute bottom-3 left-3 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg">{data.matchScore}% Match</span>
            )}
            {data.sameSchool && (
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-lg ring-1 ring-black/5">Same School</span>
            )}
            {pics.length > 1 && (
              <>
                <button onClick={() => setIndex(i => (i - 1 + pics.length) % pics.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => setIndex(i => (i + 1) % pics.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"><ChevronRight className="h-5 w-5" /></button>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white">{index + 1} / {pics.length}</span>
              </>
            )}
          </div>

          {/* Picture selector filmstrip, same treatment as Showcases */}
          {pics.length > 1 && (
            <div className="flex items-center gap-2 border-b border-gray-100 bg-white p-2.5 dark:border-gray-800 dark:bg-[#151517]">
              <button onClick={() => setIndex(i => (i - 1 + pics.length) % pics.length)} className="shrink-0 rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-[#C9A24D] hover:text-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B]"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <div className="scrollbar-hide flex flex-1 gap-1.5 overflow-x-auto">
                {pics.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${i === index ? 'border-[#C9A24D]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={normalizeImageUrl(p)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <button onClick={() => setIndex(i => (i + 1) % pics.length)} className="shrink-0 rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-[#C9A24D] hover:text-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B]"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[#111827] dark:text-white">{data.address}</p>
              {data.cityState && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{data.cityState}</p>}
            </div>
            {data.price != null && (
              <div className="shrink-0 text-right">
                <p className="text-xl font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(data.price)}</p>
                {data.priceLabel && <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">{data.priceLabel}</p>}
              </div>
            )}
          </div>
          {data.distanceMiles != null && (
            <p className="mt-1 text-xs font-bold text-gray-400">{data.distanceMiles} miles from the subject property</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-[#faf9f7] py-3 dark:border-gray-800 dark:bg-[#0B0B0B]">
                <s.icon className="h-4 w-4 text-[#C9A24D]" />
                <span className="text-sm font-black text-[#111827] dark:text-white">{s.value}</span>
                <span className="text-[8px] font-black uppercase tracking-wide text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
          {data.extra.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 dark:border-gray-800">
              {data.extra.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wide text-gray-400">{e.label}</span>
                  <span className="font-black text-[#111827] dark:text-white">{e.value}</span>
                </div>
              ))}
            </div>
          )}
          {data.description && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#C9A24D]">Description</p>
              <p className="text-xs font-medium leading-relaxed text-gray-600 dark:text-gray-400">{data.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Step 3: Analysis - reorder, side-by-side table, quality/strength/commentary, metrics, charts
// ============================================================================

const QUALITY_5: { value: string, label: string }[] = [
  { value: 'significantly_below', label: 'Sig. Below' },
  { value: 'below', label: 'Below' },
  { value: 'similar', label: 'Similar' },
  { value: 'above', label: 'Above' },
  { value: 'significantly_above', label: 'Sig. Above' },
]
const QUALITY_3: { value: string, label: string }[] = [
  { value: 'below', label: 'Below' },
  { value: 'similar', label: 'Similar' },
  { value: 'above', label: 'Above' },
]
const LOCATION_3: { value: string, label: string }[] = [
  { value: 'inferior', label: 'Inferior' },
  { value: 'similar', label: 'Similar' },
  { value: 'superior', label: 'Superior' },
]
const STRENGTH_OPTIONS: { value: CmaCompStrength, label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'strong', label: 'Strong' },
  { value: 'supporting', label: 'Supporting' },
  { value: 'weak', label: 'Weak' },
]

function AnalysisStep({ report, onSave, onReportUpdated, onNext }: {
  report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => void,
  onReportUpdated: (r: CmaReport) => void, onNext: () => void,
}) {
  const { showToast } = useToast()
  const [comparables, setComparables] = useState<CmaComparable[]>(sortComparables(report.comparables))
  const [activeId, setActiveId] = useState<string | null>(sortComparables(report.comparables)[0]?.id || null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { setComparables(sortComparables(report.comparables)) }, [report.id])
  useEffect(() => {
    if (!comparables.some(c => c.id === activeId)) setActiveId(comparables[0]?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparables])

  // Merges the AI's per-comp notes into the local comparables copy (rather than replacing it
  // wholesale from the server response) so any commentary/quality the agent already typed this
  // session, but hasn't hit Save on yet, is never lost by a generation running mid-edit.
  const handleGenerate = async (forceRegenerate = false) => {
    setGenerating(true)
    const response = await api.cma.generateAiAnalysis(report.id, { force_regenerate: forceRegenerate })
    setGenerating(false)
    if (response.success && response.data) {
      const updated = response.data
      const notesById = new Map(updated.comparables.map(c => [c.id, c.ai_commentary]))
      setComparables(cs => cs.map(c => notesById.has(c.id) ? { ...c, ai_commentary: notesById.get(c.id) } : c))
      onReportUpdated(updated)
      showToast('AI analysis generated', 'success')
    } else {
      showToast(response.error || 'Could not generate the AI analysis.', 'error')
    }
  }

  const active = comparables.find(c => c.id === activeId) || comparables[0] || null
  const activeIndex = active ? comparables.findIndex(c => c.id === active.id) : -1

  const included = useMemo(() => comparables.filter(c => c.is_included), [comparables])
  const metricsAll = useMemo(() => computeMarketMetrics(included), [included])
  const metricsWeighted = useMemo(() => computeMarketMetrics(primaryPlusStrong(comparables)), [comparables])

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= comparables.length) return
    const next = [...comparables]
    ;[next[index], next[target]] = [next[target], next[index]]
    const reindexed = next.map((c, i) => ({ ...c, order_index: i }))
    setComparables(reindexed)
  }

  const updateComp = (id: string, patch: Partial<CmaComparable>) => {
    setComparables(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const updateQuality = (id: string, key: keyof CmaQualityAssessment, value: string) => {
    setComparables(cs => cs.map(c => c.id === id ? { ...c, quality: { ...c.quality, [key]: value } } : c))
  }

  const toggleIncluded = (id: string) => {
    setComparables(cs => cs.map(c => c.id === id ? { ...c, is_included: !c.is_included } : c))
  }

  const handleContinue = () => {
    onSave({ comparables })
    onNext()
  }

  if (comparables.length === 0) {
    return (
      <SectionCard title="No comparables yet" subtitle="Head back to Find Comparables to add a few before analyzing.">
        <p className="text-sm font-semibold text-gray-400">Nothing to compare yet.</p>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top bar - always-visible progress + continue, so the agent doesn't have to scroll to move on */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#151517]">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> {included.length} of {comparables.length} Added
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleGenerate(!!report.ai_analysis)}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl border border-[#C9A24D]/50 bg-[#C9A24D]/10 px-4 py-2 text-xs font-black text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/15 disabled:opacity-60 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a]"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? 'Analyzing photos and comps…' : report.ai_analysis ? 'Regenerate AI Analysis' : 'Generate AI Analysis'}
          </button>
          <button onClick={() => onSave({ comparables }, { silent: true })} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button onClick={handleContinue} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
            Continue to Pricing <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>
        {generating && (
          <p className="w-full text-[10px] font-bold text-gray-400">This can take up to 30 seconds - it's reading each comp's photos.</p>
        )}
        {!generating && report.ai_analysis && (
          <p className="w-full text-[10px] font-bold text-gray-400">
            Generated {new Date(report.ai_analysis.generated_at || '').toLocaleString()} · ${(report.ai_analysis.cost_usd || 0).toFixed(4)} · {report.ai_analysis.model}
            {!!report.ai_analysis.warnings?.length && <span className="text-amber-600 dark:text-amber-400"> · {report.ai_analysis.warnings.join('; ')}</span>}
          </p>
        )}
      </div>

      {report.pricing?.ai_estimate && (
        <AiEstimateCard estimate={report.pricing.ai_estimate} onApply={() => onSave({ pricing: applyAiEstimateToPricing(report.pricing, report.pricing!.ai_estimate!, report.mode) })} />
      )}

      <SubjectLargeCard subject={report.subject} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px] lg:items-start">
        <div className="min-w-0 space-y-5">
          {active && (
            <SideBySidePanel
              subject={report.subject}
              comp={active}
              index={activeIndex}
              total={comparables.length}
              onUpdate={patch => updateComp(active.id, patch)}
              onUpdateQuality={(key, value) => updateQuality(active.id, key, value)}
              onToggleIncluded={() => toggleIncluded(active.id)}
              onPrev={() => setActiveId(comparables[Math.max(0, activeIndex - 1)]?.id || active.id)}
              onNext={() => setActiveId(comparables[Math.min(comparables.length - 1, activeIndex + 1)]?.id || active.id)}
            />
          )}

          <SectionCard title="Side-by-Side Comparison" subtitle="Major differences at a glance.">
            <ComparisonTable subject={report.subject} comparables={included} />
          </SectionCard>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="Quick Market Metrics" subtitle="All included comps, plus Primary + Strong only.">
              <MarketMetricsPanel labelAll="All Included Comps" metricsAll={metricsAll} labelWeighted="Primary + Strong Comps" metricsWeighted={metricsWeighted} />
            </SectionCard>
            <SectionCard title="Price Per Square Foot" subtitle="Low, middle, and high end of the comparable market.">
              <PsfChart subject={report.subject} comparables={included} />
            </SectionCard>
          </div>

          <SectionCard title="Comparable Sale Prices" subtitle="Where the subject sits relative to the comp set.">
            <SalePriceChart subject={report.subject} comparables={included} />
          </SectionCard>
        </div>

        <CompOrderRail
          comparables={comparables}
          activeId={active?.id || null}
          onSelect={setActiveId}
          onMoveUp={i => move(i, -1)}
          onMoveDown={i => move(i, 1)}
          onToggleIncluded={toggleIncluded}
        />
      </div>
    </div>
  )
}

const AI_CONFIDENCE_STYLES: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  high: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
}

function AiEstimateCard({ estimate, onApply }: { estimate: CmaAiEstimate, onApply: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-[#C9A24D]/40 bg-[#C9A24D]/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3.5 w-3.5" /> AI Estimated Value</p>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${AI_CONFIDENCE_STYLES[estimate.confidence] || AI_CONFIDENCE_STYLES.low}`}>{estimate.confidence} confidence</span>
        </div>
        <button onClick={onApply} className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A24D] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-[#b8923f]">
          Apply to Pricing →
        </button>
      </div>
      <p className="mt-2 text-2xl font-black text-[#111827] dark:text-white">{formatMoney(estimate.value)}</p>
      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{formatMoneyRange(estimate.range_min, estimate.range_max)}</p>
      <p className="mt-2 text-xs font-medium leading-relaxed text-gray-600 dark:text-gray-300">{estimate.methodology_summary}</p>
    </div>
  )
}

function SubjectLargeCard({ subject }: { subject: CmaSubjectProperty }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-[#C9A24D]/40 bg-[#C9A24D]/5 p-4 sm:flex-row sm:items-center">
      {subject.photo_url ? <img src={normalizeImageUrl(subject.photo_url || undefined)} alt="" className="aspect-[4/3] w-full shrink-0 rounded-xl object-cover sm:h-28 sm:w-36" /> : <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center rounded-xl bg-white sm:h-28 sm:w-36 dark:bg-gray-800"><Home className="h-6 w-6 text-gray-300" /></div>}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">Subject Property</p>
        <p className="truncate text-lg font-black text-[#111827] dark:text-white">{subject.street_address}</p>
        <p className="text-xs font-semibold text-gray-400">{[subject.city, subject.state].filter(Boolean).join(', ')}</p>
        {subject.list_price != null && <p className="mt-1 text-xl font-black text-[#8b7355] dark:text-[#d7b974]">{formatMoney(subject.list_price)}</p>}
      </div>
      <div className="grid shrink-0 grid-cols-4 gap-2 sm:w-64">
        <CmaFactChip icon={Bed} value={subject.beds ?? '—'} label="Beds" />
        <CmaFactChip icon={Bath} value={subject.baths ?? '—'} label="Baths" />
        <CmaFactChip icon={Ruler} value={subject.sqft ? formatNumber(subject.sqft) : '—'} label="Sqft" />
        <CmaFactChip icon={LandPlot} value={subject.lot_size ? formatNumber(subject.lot_size) : '—'} label="Lot" />
      </div>
    </div>
  )
}

function CompOrderRail({ comparables, activeId, onSelect, onMoveUp, onMoveDown, onToggleIncluded }: {
  comparables: CmaComparable[], activeId: string | null, onSelect: (id: string) => void,
  onMoveUp: (index: number) => void, onMoveDown: (index: number) => void, onToggleIncluded: (id: string) => void,
}) {
  return (
    <div className="lg:sticky lg:top-6">
      <SectionCard title="Comparable Order" subtitle="Click one to compare it side-by-side with the subject.">
        <div className="space-y-2">
          {comparables.map((c, i) => {
            const isActive = c.id === activeId
            return (
              <div key={c.id} className={`flex items-center gap-2 rounded-xl border-2 p-2 transition ${isActive ? 'border-[#C9A24D] bg-[#C9A24D]/5' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/40'} ${!c.is_included ? 'opacity-50' : ''}`}>
                <div className="flex shrink-0 flex-col items-center gap-0.5">
                  <button onClick={() => onMoveUp(i)} disabled={i === 0} className="rounded p-0.5 text-gray-400 hover:text-[#111827] disabled:opacity-20 dark:hover:text-white"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onMoveDown(i)} disabled={i === comparables.length - 1} className="rounded p-0.5 text-gray-400 hover:text-[#111827] disabled:opacity-20 dark:hover:text-white"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <button onClick={() => onSelect(c.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${isActive ? 'bg-[#C9A24D] text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>{i + 1}</span>
                  {c.photo_url ? <img src={normalizeImageUrl(c.photo_url || undefined)} alt="" className="h-9 w-11 shrink-0 rounded-lg object-cover" /> : <div className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-3.5 w-3.5 text-gray-300" /></div>}
                  <span className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-[#111827] dark:text-white">{c.street_address}</p>
                    <p className="text-[10px] font-bold text-gray-400">{formatMoney(c.sale_price ?? c.list_price)}</p>
                  </span>
                </button>
                <button onClick={() => onToggleIncluded(c.id)} title={c.is_included ? 'Exclude from CMA' : 'Include in CMA'} className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  {c.is_included ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5" />}
                </button>
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

function SideBySidePanel({ subject, comp, index, total, onUpdate, onUpdateQuality, onToggleIncluded, onPrev, onNext }: {
  subject: CmaSubjectProperty, comp: CmaComparable, index: number, total: number, onUpdate: (p: Partial<CmaComparable>) => void,
  onUpdateQuality: (key: keyof CmaQualityAssessment, value: string) => void, onToggleIncluded: () => void,
  onPrev: () => void, onNext: () => void,
}) {
  const psf = comp.price_per_sqft ?? pricePerSqft(comp.sale_price ?? comp.list_price, comp.sqft)
  const subjectPsf = subject.list_price && subject.sqft ? pricePerSqft(subject.list_price, subject.sqft) : null
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#151517]">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <p className="text-sm font-black text-[#111827] dark:text-white">Comparing Subject vs. Comp #{index + 1}</p>
        <div className="flex items-center gap-1">
          <button onClick={onPrev} disabled={index <= 0} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-[#111827] disabled:opacity-30 dark:border-gray-700 dark:hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-1 text-[10px] font-black text-gray-400">{index + 1} / {total}</span>
          <button onClick={onNext} disabled={index >= total - 1} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-[#111827] disabled:opacity-30 dark:border-gray-700 dark:hover:text-white"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-gray-800">
        <div className="p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">Subject · {subject.street_address}</p>
          {subject.photo_url ? <img src={normalizeImageUrl(subject.photo_url || undefined)} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" /> : <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800"><Home className="h-6 w-6 text-gray-300" /></div>}
          <p className="mt-3 text-lg font-black text-[#111827] dark:text-white">{formatMoney(subject.list_price)}</p>
          {subjectPsf && <p className="text-xs font-bold text-gray-400">${subjectPsf}/sqft</p>}
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <CmaFactChip icon={Bed} value={subject.beds ?? '—'} label="Beds" />
            <CmaFactChip icon={Bath} value={subject.baths ?? '—'} label="Baths" />
            <CmaFactChip icon={Ruler} value={subject.sqft ? formatNumber(subject.sqft) : '—'} label="Sqft" />
            <CmaFactChip icon={LandPlot} value={subject.lot_size ? formatNumber(subject.lot_size) : '—'} label="Lot" />
          </div>
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Comp #{index + 1} · {comp.street_address}</p>
            <button onClick={onToggleIncluded} title={comp.is_included ? 'Exclude from CMA' : 'Include in CMA'} className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              {comp.is_included ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5" />}
            </button>
          </div>
          {comp.photo_url ? <img src={normalizeImageUrl(comp.photo_url || undefined)} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" /> : <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800"><Home className="h-6 w-6 text-gray-300" /></div>}
          <p className="mt-3 text-lg font-black text-[#111827] dark:text-white">{formatMoney(comp.sale_price ?? comp.list_price)}</p>
          {psf && <p className="text-xs font-bold text-gray-400">${psf}/sqft</p>}
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            <CmaFactChip icon={Bed} value={comp.beds ?? '—'} label="Beds" />
            <CmaFactChip icon={Bath} value={comp.baths ?? '—'} label="Baths" />
            <CmaFactChip icon={Ruler} value={comp.sqft ? formatNumber(comp.sqft) : '—'} label="Sqft" />
            <CmaFactChip icon={LandPlot} value={comp.lot_size ? formatNumber(comp.lot_size) : '—'} label="Lot" />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 bg-[#fbfaf7] p-4 dark:border-gray-800 dark:bg-[#0B0B0B]">
        <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Comparable Strength</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {STRENGTH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ strength: opt.value })}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${comp.strength === opt.value ? STRENGTH_STYLES[opt.value] : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-gray-400">Agent Quality Assessment</p>
        <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QualityRow label="Overall Finish Quality" options={QUALITY_5} value={comp.quality.finish_quality} onChange={v => onUpdateQuality('finish_quality', v)} />
          <QualityRow label="Interior" options={QUALITY_3} value={comp.quality.interior} onChange={v => onUpdateQuality('interior', v)} />
          <QualityRow label="Exterior / Curb Appeal" options={QUALITY_3} value={comp.quality.exterior} onChange={v => onUpdateQuality('exterior', v)} />
          <QualityRow label="Lot / Land" options={QUALITY_3} value={comp.quality.lot} onChange={v => onUpdateQuality('lot', v)} />
          <QualityRow label="Amenities" options={QUALITY_3} value={comp.quality.amenities} onChange={v => onUpdateQuality('amenities', v)} />
          <QualityRow label="Layout / Usable Space" options={QUALITY_3} value={comp.quality.layout} onChange={v => onUpdateQuality('layout', v)} />
          <QualityRow label="Location" options={LOCATION_3} value={comp.quality.location} onChange={v => onUpdateQuality('location', v)} />
        </div>

        {comp.ai_commentary && (
          <div className="mt-4 rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3 w-3" /> AI Suggested Note</p>
              <button
                onClick={() => onUpdate({ commentary: comp.ai_commentary })}
                className="shrink-0 rounded-lg bg-[#C9A24D] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-[#b8923f]"
              >
                Use this →
              </button>
            </div>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-gray-600 dark:text-gray-300">{comp.ai_commentary}</p>
          </div>
        )}

        <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-gray-400">Agent Analysis</p>
        <textarea
          value={comp.commentary || ''}
          onChange={e => onUpdate({ commentary: e.target.value })}
          placeholder="Why is this a strong or weak comp? Renovations, finish quality, land, functional vs. wasted space, what the sale demonstrates about the market..."
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white"
        />
      </div>
    </div>
  )
}

function QualityRow({ label, options, value, onChange }: { label: string, options: { value: string, label: string }[], value?: string | null, onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-gray-600 dark:text-gray-300">{label}</p>
      <SegmentedControl options={options} value={value} onChange={onChange} />
    </div>
  )
}

const COMPARISON_ROWS: { key: keyof CmaComparable | 'psf', label: string, format: (c: any) => string }[] = [
  { key: 'sale_price', label: 'Sale Price', format: v => formatMoney(v.sale_price ?? v.list_price) },
  { key: 'psf', label: 'Price / Sq Ft', format: v => { const p = v.price_per_sqft ?? pricePerSqft(v.sale_price ?? v.list_price, v.sqft); return p ? `$${p}` : '—' } },
  { key: 'sqft', label: 'Square Footage', format: v => formatNumber(v.sqft) },
  { key: 'lot_size', label: 'Lot Size', format: v => formatNumber(v.lot_size) },
  { key: 'beds', label: 'Beds', format: v => v.beds ?? '—' },
  { key: 'baths', label: 'Baths', format: v => v.baths ?? '—' },
  { key: 'year_built', label: 'Year Built', format: v => v.year_built ?? '—' },
  { key: 'garage', label: 'Garage', format: v => v.garage || '—' },
  { key: 'basement', label: 'Basement', format: v => v.basement || '—' },
  { key: 'days_on_market', label: 'Days on Market', format: v => v.days_on_market ?? '—' },
  { key: 'distance_miles', label: 'Distance', format: v => v.distance_miles != null ? `${v.distance_miles} mi` : '—' },
  { key: 'sale_date', label: 'Sale Date', format: v => formatDate(v.sale_date) },
]

function ComparisonTable({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white p-2 text-left text-[10px] font-black uppercase tracking-wide text-gray-400 dark:bg-[#151517]"></th>
            <th className="p-2 text-left text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">Subject</th>
            {comparables.map((c, i) => (
              <th key={c.id} className="p-2 text-left text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">#{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map(row => (
            <tr key={row.label} className="border-t border-gray-100 dark:border-gray-800">
              <td className="sticky left-0 bg-white p-2 text-xs font-bold text-gray-500 dark:bg-[#151517] dark:text-gray-400">{row.label}</td>
              <td className="p-2 text-xs font-black text-[#111827] dark:text-white">{row.format(subject)}</td>
              {comparables.map(c => (
                <td key={c.id} className="p-2 text-xs font-semibold text-gray-600 dark:text-gray-300">{row.format(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-[#fbfaf7] px-3 py-2.5 dark:border-gray-800 dark:bg-[#0B0B0B]">
      <p className="text-sm font-black text-[#111827] dark:text-white">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  )
}

function MarketMetricsPanel({ labelAll, metricsAll, labelWeighted, metricsWeighted }: {
  labelAll: string, metricsAll: ReturnType<typeof computeMarketMetrics>, labelWeighted: string, metricsWeighted: ReturnType<typeof computeMarketMetrics>,
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-400">{labelAll} ({metricsAll.count})</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricStat label="Sale Range" value={formatMoneyRange(metricsAll.saleMin, metricsAll.saleMax)} />
          <MetricStat label="Avg Sale Price" value={formatMoney(metricsAll.saleAvg)} />
          <MetricStat label="Median Sale Price" value={formatMoney(metricsAll.saleMedian)} />
          <MetricStat label="Avg $/Sqft" value={metricsAll.psfAvg ? `$${Math.round(metricsAll.psfAvg)}` : '—'} />
          <MetricStat label="Median $/Sqft" value={metricsAll.psfMedian ? `$${Math.round(metricsAll.psfMedian)}` : '—'} />
          <MetricStat label="$/Sqft Range" value={metricsAll.psfMin && metricsAll.psfMax ? `$${metricsAll.psfMin} – $${metricsAll.psfMax}` : '—'} />
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">{labelWeighted} ({metricsWeighted.count})</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricStat label="Sale Range" value={formatMoneyRange(metricsWeighted.saleMin, metricsWeighted.saleMax)} />
          <MetricStat label="Avg Sale Price" value={formatMoney(metricsWeighted.saleAvg)} />
          <MetricStat label="Median $/Sqft" value={metricsWeighted.psfMedian ? `$${Math.round(metricsWeighted.psfMedian)}` : '—'} />
        </div>
      </div>
    </div>
  )
}

function PsfChart({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  const bars = comparables.map((c, i) => ({
    label: `#${i + 1}`,
    value: c.price_per_sqft ?? pricePerSqft(c.sale_price ?? c.list_price, c.sqft) ?? 0,
  }))
  const subjectPsf = subject.list_price && subject.sqft ? pricePerSqft(subject.list_price, subject.sqft) : null
  const max = Math.max(...bars.map(b => b.value), subjectPsf || 0, 1)
  return (
    <div className="space-y-2">
      {subjectPsf && (
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-black uppercase text-[#8b7355] dark:text-[#d7b974]">Subject</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#111827] dark:bg-white" style={{ width: `${(subjectPsf / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-black text-[#111827] dark:text-white">${subjectPsf}</span>
        </div>
      )}
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-bold text-gray-400">{b.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#C9A24D]" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs font-bold text-gray-600 dark:text-gray-300">{b.value ? `$${b.value}` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function SalePriceChart({ subject, comparables }: { subject: CmaSubjectProperty, comparables: CmaComparable[] }) {
  const bars = comparables.map((c, i) => ({ label: `#${i + 1}`, value: c.sale_price ?? c.list_price ?? 0 }))
  const max = Math.max(...bars.map(b => b.value), subject.list_price || 0, 1)
  return (
    <div className="space-y-2">
      {subject.list_price != null && (
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-black uppercase text-[#8b7355] dark:text-[#d7b974]">Subject</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#111827] dark:bg-white" style={{ width: `${(subject.list_price / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-black text-[#111827] dark:text-white">{formatMoney(subject.list_price, { compact: true })}</span>
        </div>
      )}
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-bold text-gray-400">{b.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-[#C9A24D]" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-bold text-gray-600 dark:text-gray-300">{b.value ? formatMoney(b.value, { compact: true }) : '—'}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Step 4: Pricing Conclusion (+ Market Context + Improvements)
// ============================================================================

function MoneyField({ label, value, onChange }: { label: string, value?: number | null, onChange: (v: number | null) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? value.toLocaleString() : ''}
          onChange={e => {
            const digits = e.target.value.replace(/\D/g, '')
            onChange(digits ? Number(digits) : null)
          }}
          className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-6 pr-3 text-sm font-black text-[#111827] outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
        />
      </div>
    </div>
  )
}

function PricingStep({ report, onSave, onNext }: { report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => void, onNext: () => void }) {
  const [mode, setMode] = useState<CmaMode>(report.mode)
  const [pricing, setPricing] = useState<CmaPricing>(report.pricing)
  const [improvements, setImprovements] = useState<CmaImprovement[]>(report.improvements)
  const [subjectNotes, setSubjectNotes] = useState(report.subject.agent_notes || '')

  useEffect(() => {
    setMode(report.mode)
    setPricing(report.pricing)
    setImprovements(report.improvements)
    setSubjectNotes(report.subject.agent_notes || '')
  }, [report.id])

  const suggested = useMemo(() => suggestedValueRange(report.subject.sqft, report.comparables.filter(c => c.is_included)), [report.subject.sqft, report.comparables])

  const patch = (p: Partial<CmaPricing>) => setPricing(prev => ({ ...prev, ...p }))

  const addImprovement = () => setImprovements(prev => [...prev, { id: newId(), type: '', description: '', approx_size: '', estimated_value_context: '', agent_notes: '' }])
  const updateImprovement = (id: string, p: Partial<CmaImprovement>) => setImprovements(prev => prev.map(i => i.id === id ? { ...i, ...p } : i))
  const removeImprovement = (id: string) => setImprovements(prev => prev.filter(i => i.id !== id))

  const subjectPatch = { subject: { ...report.subject, agent_notes: subjectNotes } }

  const handleContinue = () => {
    onSave({ mode, pricing, improvements, ...subjectPatch })
    onNext()
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Comparable Data Suggests" subtitle="A starting point from the comps you rated Primary/Strong - never a substitute for your own judgment.">
        <div className="flex items-center gap-3 rounded-xl bg-[#C9A24D]/10 px-4 py-3">
          <Sparkles className="h-5 w-5 shrink-0 text-[#C9A24D]" />
          <p className="font-serif text-xl font-black text-[#111827] dark:text-white">{formatMoneyRange(suggested.min, suggested.max)}</p>
        </div>
      </SectionCard>

      <SectionCard title="This CMA Is For A..." subtitle="Switches the pricing conclusion fields below.">
        <SegmentedControl
          options={[{ value: 'listing', label: 'Seller / Listing' }, { value: 'buyer', label: 'Buyer / Offer' }]}
          value={mode}
          onChange={setMode}
        />
      </SectionCard>

      {pricing.ai_estimate && (
        <AiEstimateCard estimate={pricing.ai_estimate} onApply={() => patch(applyAiEstimateToPricing(pricing, pricing.ai_estimate!, mode))} />
      )}

      {mode === 'listing' ? (
        <SectionCard title="Pricing Conclusion" subtitle="Your numbers override anything suggested above.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MoneyField label="Recommended Min" value={pricing.recommended_min} onChange={v => patch({ recommended_min: v })} />
            <MoneyField label="Recommended Max" value={pricing.recommended_max} onChange={v => patch({ recommended_max: v })} />
            <MoneyField label="Most Likely Market Value" value={pricing.most_likely_value} onChange={v => patch({ most_likely_value: v })} />
            <MoneyField label="Recommended List Price" value={pricing.recommended_list_price} onChange={v => patch({ recommended_list_price: v })} />
          </div>
          <div className="mt-4">
            <FieldLabel>Agent Pricing Analysis</FieldLabel>
            <textarea
              value={pricing.pricing_commentary || ''}
              onChange={e => patch({ pricing_commentary: e.target.value })}
              placeholder="Where the property sits within the comp set, finish quality, renovations, scarcity, market conditions, which comps deserve more or less weight, risk of pricing too aggressively..."
              rows={5}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
            />
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="Buyer Valuation / Offer Analysis" subtitle="Your numbers override anything suggested above.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MoneyField label="Estimated Fair Market Value" value={pricing.estimated_fair_value} onChange={v => patch({ estimated_fair_value: v })} />
            <MoneyField label="Suggested Offer Min" value={pricing.suggested_offer_min} onChange={v => patch({ suggested_offer_min: v })} />
            <MoneyField label="Suggested Offer Max" value={pricing.suggested_offer_max} onChange={v => patch({ suggested_offer_max: v })} />
            <MoneyField label="Strong Offer" value={pricing.strong_offer} onChange={v => patch({ strong_offer: v })} />
          </div>
          <div className="mt-4">
            <FieldLabel>Agent Offer Strategy</FieldLabel>
            <textarea
              value={pricing.offer_strategy_commentary || ''}
              onChange={e => patch({ offer_strategy_commentary: e.target.value })}
              placeholder="e.g. $500,000 could be a strong opening offer, $512,000 may still be supported, less resale protection above that level, keep inspections in place..."
              rows={5}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
            />
          </div>
        </SectionCard>
      )}

      <SectionCard title="Major Improvements" subtitle="Optional - explains why the property may deserve a premium, not a dollar-for-dollar add.">
        <div className="space-y-3">
          {improvements.map(imp => (
            <div key={imp.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  <TextField label="Type" value={imp.type} onChange={v => updateImprovement(imp.id, { type: v })} placeholder="e.g. Renovated Kitchen" />
                  <TextField label="Approx. Size" value={imp.approx_size} onChange={v => updateImprovement(imp.id, { approx_size: v })} placeholder="e.g. 400 sqft" />
                  <div className="col-span-2"><TextField label="Description" value={imp.description} onChange={v => updateImprovement(imp.id, { description: v })} /></div>
                </div>
                <button onClick={() => removeImprovement(imp.id)} className="mt-5 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <TextField label="Estimated Cost / Value Context" value={imp.estimated_value_context} onChange={v => updateImprovement(imp.id, { estimated_value_context: v })} />
                <TextField label="Agent Notes" value={imp.agent_notes} onChange={v => updateImprovement(imp.id, { agent_notes: v })} />
              </div>
            </div>
          ))}
          <button onClick={addImprovement} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-xs font-black text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
            <Plus className="h-3.5 w-3.5" /> Add Improvement
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Agent's Notes on the Subject Property" subtitle="Now that you've reviewed the comps and know where this property really sits - your closing take.">
        <textarea
          value={subjectNotes}
          onChange={e => setSubjectNotes(e.target.value)}
          placeholder="Now that you've seen how this property stacks up against the comps - condition, standout features, how it should really be positioned - what's your final read on it?"
          rows={4}
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
        />
      </SectionCard>

      <div className="flex justify-end gap-2">
        <button onClick={() => onSave({ mode, pricing, improvements, ...subjectPatch }, { silent: true })} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400">
          <Save className="h-3.5 w-3.5" /> Save
        </button>
        <button onClick={handleContinue} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-6 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827]">
          Continue to Summary <ArrowLeft className="h-4 w-4 rotate-180" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Step 5: Summary & Share
// ============================================================================

function SummaryStep({ report, onSave, onJump, onDeleted }: {
  report: CmaReport, onSave: (p: Partial<CmaReport>, o?: { silent?: boolean }) => void, onJump: (s: StepId) => void, onDeleted: () => void,
}) {
  const { showToast } = useToast()
  const { user } = useAuth()
  const [agent, setAgent] = useState<any>(null)
  const [showPdf, setShowPdf] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    api.studio.getBrandKit().then(brandRes => {
      const brand = brandRes.success ? brandRes.data : null
      setAgent({
        name: user ? `${user.first_name} ${user.last_name}` : '',
        headshot_url: user?.photo_url || null,
        brokerage: user?.brokerage || null,
        email: user?.email || null,
        logo_url: brand?.personal_logo_url || brand?.brokerage_logo_url || null,
        primary_color: brand?.primary_color || '#111827',
        secondary_color: brand?.secondary_color || '#C9A24D',
      })
    })
  }, [user])

  const included = report.comparables.filter(c => c.is_included)
  const weighted = primaryPlusStrong(report.comparables)
  const metrics = computeMarketMetrics(included)
  const suggested = suggestedValueRange(report.subject.sqft, included)

  const [presentation, setPresentation] = useState(report.presentation)
  useEffect(() => { setPresentation(report.presentation) }, [report.id])

  const toggleSection = (key: string) => {
    setPresentation(p => {
      const hidden = new Set(p.hidden_sections)
      hidden.has(key) ? hidden.delete(key) : hidden.add(key)
      const next = { ...p, hidden_sections: Array.from(hidden) }
      onSave({ presentation: next }, { silent: true })
      return next
    })
  }
  const toggleComp = (id: string) => {
    setPresentation(p => {
      const hidden = new Set(p.hidden_comp_ids)
      hidden.has(id) ? hidden.delete(id) : hidden.add(id)
      const next = { ...p, hidden_comp_ids: Array.from(hidden) }
      onSave({ presentation: next }, { silent: true })
      return next
    })
  }

  const markReady = () => onSave({ status: 'READY' })

  const handleShare = async () => {
    const response = await api.cma.share(report.id)
    if (response.success && response.data) {
      onSave({}, { silent: true })
      setShowShare(true)
    } else {
      showToast(response.error || 'Could not create a share link.', 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this CMA? This cannot be undone.')) return
    setIsDeleting(true)
    const response = await api.cma.remove(report.id)
    setIsDeleting(false)
    if (response.success) onDeleted()
    else showToast(response.error || 'Could not delete this CMA.', 'error')
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Review" subtitle="Everything below feeds the client-facing presentation.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button onClick={() => onJump('subject')} className="rounded-xl border border-gray-100 p-3 text-left hover:border-[#C9A24D]/40 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Subject</p>
            <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{report.subject.street_address}</p>
            <p className="text-xs font-semibold text-gray-400">{report.subject.list_price ? formatMoney(report.subject.list_price) : 'No list price set'}</p>
          </button>
          <button onClick={() => onJump('comps')} className="rounded-xl border border-gray-100 p-3 text-left hover:border-[#C9A24D]/40 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Comparable Set</p>
            <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{included.length} comps ({weighted.length} primary/strong)</p>
            <p className="text-xs font-semibold text-gray-400">{formatMoneyRange(metrics.saleMin, metrics.saleMax)}</p>
          </button>
          <button onClick={() => onJump('analysis')} className="rounded-xl border border-gray-100 p-3 text-left hover:border-[#C9A24D]/40 dark:border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Comparable $/Sqft Range</p>
            <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">{metrics.psfMin && metrics.psfMax ? `$${metrics.psfMin} – $${metrics.psfMax}` : '—'}</p>
          </button>
          <button onClick={() => onJump('pricing')} className="rounded-xl border border-[#C9A24D]/40 bg-[#C9A24D]/5 p-3 text-left">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">
              {report.mode === 'buyer' ? 'Estimated Fair Value' : 'Recommended Value Range'}
            </p>
            <p className="mt-1 font-serif text-lg font-black text-[#111827] dark:text-white">
              {report.mode === 'buyer'
                ? formatMoney(report.pricing.estimated_fair_value) || formatMoneyRange(suggested.min, suggested.max)
                : formatMoneyRange(report.pricing.recommended_min, report.pricing.recommended_max) !== '—'
                  ? formatMoneyRange(report.pricing.recommended_min, report.pricing.recommended_max)
                  : formatMoneyRange(suggested.min, suggested.max)}
            </p>
          </button>
        </div>

        {(report.pricing.pricing_commentary || report.pricing.offer_strategy_commentary) && (
          <div className="mt-4 rounded-xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
            <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Agent Conclusion</p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">
              {report.pricing.pricing_commentary || report.pricing.offer_strategy_commentary}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Presentation" subtitle="Hide anything that shouldn't appear in the client-facing CMA. Changes save immediately.">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'subject', label: 'Subject Property' },
            { key: 'comparison_table', label: 'Comparable Overview' },
            { key: 'location', label: 'Location Context' },
            { key: 'comparables', label: 'Individual Comparables' },
            { key: 'market_context', label: 'Market Context' },
            { key: 'charts', label: 'Market Analysis' },
            { key: 'pricing', label: 'Agent Final Analysis' },
          ].map(s => {
            const isHidden = presentation.hidden_sections.includes(s.key)
            return (
              <button
                key={s.key}
                onClick={() => toggleSection(s.key)}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${isHidden ? 'bg-gray-100 text-gray-400 line-through dark:bg-gray-800' : 'bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#d7b974]'}`}
              >
                {s.label}
              </button>
            )
          })}
        </div>

        {report.comparables.length > 0 && (
          <div className="mt-4">
            <FieldLabel>Comparables Shown</FieldLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortComparables(report.comparables).map((c, i) => {
                const isHidden = presentation.hidden_comp_ids.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleComp(c.id)}
                    className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition ${isHidden ? 'border-gray-100 opacity-50 dark:border-gray-800' : 'border-[#C9A24D]/30 bg-[#C9A24D]/5'}`}
                  >
                    {c.photo_url ? (
                      <img src={normalizeImageUrl(c.photo_url)} alt="" className="h-10 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Home className="h-4 w-4 text-gray-300" /></div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-black ${isHidden ? 'text-gray-400 line-through' : 'text-[#111827] dark:text-white'}`}>#{i + 1} {c.street_address}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{isHidden ? 'Hidden' : 'Shown in CMA'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Generate & Share">
        <div className="flex flex-wrap gap-2">
          <button onClick={markReady} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:text-gray-400">
            <Check className="h-3.5 w-3.5" /> Mark Ready
          </button>
          <button
            onClick={() => setShowPdf(true)}
            disabled={!agent}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#C9A24D]/40 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-[#8b7355] transition hover:border-[#C9A24D] disabled:opacity-50 dark:text-[#d7b974]"
          >
            <Layers className="h-4 w-4" /> Generate CMA
          </button>
          <button onClick={handleShare} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A24D] px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition hover:brightness-105">
            <Share2 className="h-4 w-4" /> Share CMA
          </button>
          <button onClick={handleDelete} disabled={isDeleting} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete CMA
          </button>
        </div>
      </SectionCard>

      {showPdf && agent && (
        <CmaPdfModal report={report} agent={agent} onClose={() => setShowPdf(false)} />
      )}
      {showShare && report.share_slug && (
        <ShareLinkModal slug={report.share_slug} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}

function CmaPdfModal({ report, agent, onClose }: { report: CmaReport, agent: any, onClose: () => void }) {
  const fileName = `CMA-${(report.subject.street_address || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70">
      <div className="flex items-center justify-between bg-[#111827] px-5 py-3">
        <p className="text-sm font-black text-white">CMA Presentation Preview</p>
        <div className="flex items-center gap-2">
          <PDFDownloadLink document={<CmaPresentationDocument report={report} agent={agent} />} fileName={fileName}>
            {({ loading }) => (
              <span className="inline-flex items-center gap-2 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black uppercase tracking-wide text-white">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Download PDF
              </span>
            )}
          </PDFDownloadLink>
          <button onClick={onClose} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="flex-1">
        <PDFViewer width="100%" height="100%" showToolbar={false}>
          <CmaPresentationDocument report={report} agent={agent} />
        </PDFViewer>
      </div>
    </div>
  )
}

function ShareLinkModal({ slug, onClose }: { slug: string, onClose: () => void }) {
  const { showToast } = useToast()
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/cma/${slug}` : `/cma/${slug}`
  const copy = () => {
    navigator.clipboard.writeText(publicUrl)
    showToast('Link copied', 'success')
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-[#111827] dark:text-white">CMA Shared</p>
            <p className="text-xs font-semibold text-gray-400">Mobile-friendly link - keep editing anytime, it updates automatically.</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] p-2 dark:border-gray-700 dark:bg-[#0B0B0B]">
          <MapPin className="ml-1 h-4 w-4 shrink-0 text-gray-400" />
          <input readOnly value={publicUrl} className="flex-1 truncate bg-transparent text-xs font-semibold text-gray-600 outline-none dark:text-gray-300" />
          <button onClick={copy} className="shrink-0 rounded-lg bg-[#111827] p-2 text-white dark:bg-white dark:text-[#111827]"><Copy className="h-3.5 w-3.5" /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`mailto:?subject=Your Comparative Market Analysis&body=${encodeURIComponent(publicUrl)}`} className="rounded-xl border border-gray-200 py-2.5 text-center text-xs font-black text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300">Email</a>
          <a href={`sms:?body=${encodeURIComponent(publicUrl)}`} className="rounded-xl border border-gray-200 py-2.5 text-center text-xs font-black text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300">Text</a>
        </div>
      </div>
    </div>
  )
}
