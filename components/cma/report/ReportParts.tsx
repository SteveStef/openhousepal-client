'use client'

// The building blocks of the CMA report (client page + Review editor): headings, fact tiles, the subject card,
// a comp's card, the details pop-up, the overview table, the bar charts and the live map.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bath, BedDouble, Building2, Calendar, Car, ChevronLeft, ChevronRight, DollarSign, Droplets, Gauge, ImageIcon, LandPlot, Layers, MapPin, Maximize2, Plus, Ruler, Waves, X } from 'lucide-react'
import { CmaComparable, CmaPublicResponse, CmaQualityAssessment, CmaSubjectProperty } from '@/types'
import {
  AREA_TIERS, COMP_STATUS_BADGE_STYLE, COMP_STATUS_HEX, COMP_STATUS_LABEL, CmaGuidanceSection, QUALITY_LABELS, QUALITY_TIER_STYLES,
  STRENGTH_LABEL, STRENGTH_SCALE_STYLES, STRENGTH_STYLES, basementDisplay, bathsText, buildCompLocationMapUrl, cleanUtilityList,
  clientCompStrength, compDisplayPrice, compPriceCaption, compPricePerSqft, compSoldDate, compStatusBadgeText, formatAcresFromSqft,
  formatDate, formatMlsStatusLabel, formatMoney, formatNumber, materialIssuesText, subjectPricePerSqft,
} from '@/lib/cma'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import { HomeAreaOverlay } from '@/components/maps/HomeAreaMap'
import MapPopup from '@/components/maps/MapPopup'
import MapPropertyCard, { mapCardSpecs } from '@/components/maps/MapPropertyCard'
import { normalizeImageUrl } from '@/lib/utils'
import PhotoFlip, { PhotoThumbs, usePhotoList } from './PhotoFlip'
import { EditableText } from './Editable'
import type { CmaEditHooks, EditorComp } from './editTypes'

export function formatUtilityValue(raw?: string[] | string | null) {
  const value = cleanUtilityList(raw)
  if (!value) return '-'
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '-'
  return value
}

// ---- Headings and small tiles ---------------------------------------------------------------------------------

export function SectionHeading({ eyebrow, title, onTitle }: { eyebrow: string, title: string, onTitle?: (v: string) => void }) {
  const cls = 'mt-1 font-serif text-2xl font-black text-[#111827] dark:text-white print:text-black sm:text-3xl'
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">{eyebrow}</p>
      {onTitle
        ? <EditableText as="h2" multiline={false} value={title} onChange={onTitle} placeholder="Section title" label="Section title" className={cls} />
        : <h2 className={cls}>{title}</h2>}
    </div>
  )
}

// Same bordered-card language as MiniFact/PopupFact elsewhere on the report, instead of bare stacked text.
export function Fact({ label, value }: { label: string, value: string | number | null | undefined }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white px-3 py-4 text-center shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] print:border-gray-200 print:bg-white print:shadow-none">
      <p className="text-lg font-black text-[#111827] dark:text-white print:text-black">{value ?? '—'}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  )
}

export function MiniFact({ icon: Icon, label, value, className = '' }: { icon: any, label: string, value: string | number, className?: string }) {
  return (
    <div className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-gray-100 bg-[#faf9f7] px-1 py-2 text-center dark:border-gray-800 dark:bg-[#0B0B0B] sm:px-2 sm:py-2.5 ${className}`}>
      <Icon className="h-3.5 w-3.5 text-[#C9A24D]" />
      <span className="max-w-full break-words text-center text-[11px] font-black leading-tight text-[#111827] dark:text-white">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  )
}

export function WideCompFact({ icon: Icon, label, value, compact = false, className = '' }: { icon: any, label: string, value: string | number, compact?: boolean, className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-2xl border border-gray-100 bg-[#faf9f7] px-4 dark:border-gray-800 dark:bg-[#0B0B0B] ${compact ? 'py-2.5' : 'py-3'} ${className}`}>
      <span className={`${compact ? 'h-8 w-8' : 'h-9 w-9'} flex shrink-0 items-center justify-center rounded-full bg-white text-[#C9A24D] shadow-sm dark:bg-[#151517]`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[9px] font-black uppercase tracking-wide text-gray-400">{label}</span>
        <span className="block break-words text-sm font-black leading-snug text-[#111827] dark:text-white">{value}</span>
      </span>
    </div>
  )
}

export function PopupFact({ icon: Icon, label, value, className = '' }: { icon: any, label: string, value: string | number, className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-[#faf9f7] px-2 py-3 text-center dark:border-gray-800 dark:bg-[#0B0B0B] ${className}`}>
      <Icon className="h-4 w-4 text-[#C9A24D]" />
      <span className="max-w-full break-words text-sm font-black leading-tight text-[#111827] dark:text-white">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  )
}

// ---- Wording: read, and typed in place -------------------------------------------------------------------------

type Tone = 'dark' | 'light'
const guidanceTitleCls = (tone: Tone) => `mb-1 text-[10px] font-black uppercase tracking-wide ${tone === 'dark' ? 'text-[#C9A24D] print:text-black' : 'text-[#8b7355] dark:text-[#d7b974] print:text-black'}`
const guidanceBodyCls = (tone: Tone) => `text-sm font-medium leading-relaxed ${tone === 'dark' ? 'text-gray-200 print:text-gray-800' : 'text-gray-700 dark:text-gray-300 print:text-gray-800'}`

export function GuidanceSections({ sections, tone = 'dark' }: { sections: CmaGuidanceSection[], tone?: Tone }) {
  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div key={`${section.title}-${index}`}>
          {section.title && <p className={guidanceTitleCls(tone)}>{section.title}</p>}
          <p className={`whitespace-pre-line ${guidanceBodyCls(tone)}`}>{section.body}</p>
        </div>
      ))}
    </div>
  )
}

/** The same titled paragraphs, typed in place. Keeps its own copy while mounted (so a save coming back never
 *  moves the caret); `version` going up means "take the report's wording again" (a reset). */
export function EditableSections({ sections, version, onChange, tone = 'dark', placeholder, label }: {
  sections: CmaGuidanceSection[], version: number, onChange: (next: CmaGuidanceSection[]) => void, tone?: Tone, placeholder: string, label: string,
}) {
  const withIds = (list: CmaGuidanceSection[]) => (list.length ? list : [{ title: '', body: '' }]).map((s, i) => ({ ...s, id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}` }))
  const [rows, setRows] = useState(() => withIds(sections))
  const seen = useRef(version)
  useEffect(() => {
    if (seen.current === version) return
    seen.current = version
    setRows(withIds(sections))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])
  const push = (next: typeof rows) => { setRows(next); onChange(next.map(({ title, body }) => ({ title, body }))) }
  const patch = (id: string, p: Partial<CmaGuidanceSection>) => push(rows.map(r => (r.id === id ? { ...r, ...p } : r)))
  const remove = (id: string) => { if (rows.length > 1) push(rows.filter(r => r.id !== id)) }
  return (
    <div className="space-y-4">
      {rows.map(row => (
        <div key={row.id} className="group/para relative">
          <EditableText multiline={false} value={row.title} onChange={v => patch(row.id, { title: v })} placeholder="Heading (optional)" label={`${label} heading`} className={guidanceTitleCls(tone)} />
          <EditableText value={row.body} onChange={v => patch(row.id, { body: v })} placeholder={placeholder} label={label} className={guidanceBodyCls(tone)}
            onEmptyBackspace={() => { if (!row.title.trim()) remove(row.id) }} />
          {rows.length > 1 && (
            <button type="button" onClick={() => remove(row.id)} title="Remove this paragraph" aria-label="Remove this paragraph"
              className={`absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-500 hover:text-white [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/para:opacity-100 [@media(hover:hover)]:group-focus-within/para:opacity-100 ${tone === 'dark' ? 'bg-white/10' : 'bg-black/5 dark:bg-white/10'}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => push([...rows, { title: '', body: '', id: `${Date.now()}-new` }])}
        className={`inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition hover:border-[#C9A24D] hover:text-[#C9A24D] ${tone === 'dark' ? 'border-white/25 text-gray-400' : 'border-gray-300 text-gray-400 dark:border-gray-700'}`}>
        <Plus className="h-3 w-3" /> Add a paragraph
      </button>
    </div>
  )
}

// ---- The subject ------------------------------------------------------------------------------------------------

function subjectStatusBadgeClass(statusLabel: string) {
  const normalized = statusLabel.toLowerCase()
  if (normalized.includes('sold') || normalized.includes('closed')) return 'bg-red-600'
  if (normalized.includes('active') || normalized.includes('coming soon')) return 'bg-emerald-600'
  if (normalized.includes('pending') || normalized.includes('contract')) return 'bg-amber-500 text-[#111827]'
  return 'bg-gray-700'
}

function SubjectStat({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 px-1.5 py-2.5 text-center text-white">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#C9A24D] sm:h-4 sm:w-4" />
      <p className="max-w-full break-words text-xs font-black leading-tight sm:text-base">{value}</p>
      <p className="text-[7px] font-black uppercase tracking-wide text-white/55 sm:text-[8px]">{label}</p>
    </div>
  )
}

/** "Make this the main photo" - shown to the agent while a photo other than the first is up. */
function LeadPhotoButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick() }}
      className="absolute bottom-2.5 left-2.5 z-[3] inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 active:scale-95">
      <ImageIcon className="h-3 w-3" /> Make this the main photo
    </button>
  )
}

export function SubjectShowcaseCard({ subject, onPickPhoto, days, fee }: {
  subject: CmaSubjectProperty, onPickPhoto?: (url: string) => void, days?: number | null,
  /** The subject's association fee per month as text ("$325/mo"), when it has one. */
  fee?: string | null,
}) {
  const photos = usePhotoList(subject.photos, subject.photo_url)
  const [index, setIndex] = useState(0)
  const [showDetails, setShowDetails] = useState(false)
  useEffect(() => { setIndex(0) }, [photos[0], photos.length])   // eslint-disable-line react-hooks/exhaustive-deps
  const subjectPsf = subjectPricePerSqft(subject)
  const dom = days ?? subject.days_on_market
  const stats = [
    subject.beds != null ? { icon: BedDouble, label: 'Beds', value: String(subject.beds) } : null,
    subject.baths != null ? { icon: Bath, label: 'Baths', value: bathsText(subject) } : null,
    subject.sqft != null ? { icon: Ruler, label: 'Sq Ft', value: formatNumber(subject.sqft) } : null,
    subjectPsf != null ? { icon: DollarSign, label: '/ Sq Ft', value: `$${subjectPsf}` } : null,
    subject.year_built != null ? { icon: Calendar, label: 'Built', value: String(subject.year_built) } : null,
    dom != null ? { icon: Calendar, label: 'Days on market', value: String(dom) } : null,
    subject.lot_size != null ? { icon: LandPlot, label: 'Acres', value: formatAcresFromSqft(subject.lot_size).replace(' ac', '') } : null,
    subject.annual_taxes ? { icon: DollarSign, label: 'Annual Taxes', value: formatMoney(subject.annual_taxes) } : null,   // 0 = not assessed yet
  ].filter(Boolean) as { icon: any, label: string, value: string }[]
  // The facts that used to sit only inside "View details" - on the card now, so the home's whole picture is up front.
  const more = [
    fee ? { icon: DollarSign, label: 'HOA / Condo Fee', value: fee } : null,
    subject.school_district ? { icon: Building2, label: 'School District', value: subject.school_district } : null,
    subject.garage ? { icon: Car, label: 'Garage', value: subject.garage } : null,
    basementDisplay(subject) && basementDisplay(subject) !== '-' && basementDisplay(subject) !== '—' ? { icon: Layers, label: 'Basement', value: basementDisplay(subject) } : null,
    formatUtilityValue(subject.water_source) !== '-' || formatUtilityValue(subject.sewer) !== '-' ? { icon: Droplets, label: 'Water / Sewer', value: `${formatUtilityValue(subject.water_source)} / ${formatUtilityValue(subject.sewer)}` } : null,
  ].filter(Boolean) as { icon: any, label: string, value: string }[]
  const statusLabel = formatMlsStatusLabel(subject.mls_status)
  const hasStatus = statusLabel && statusLabel !== '—'
  const cols = stats.length >= 8 ? 'grid-cols-4 lg:grid-cols-8' : stats.length >= 6 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-4'

  return (
    <>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#111827] shadow-[0_8px_28px_rgba(17,24,39,0.14)] ring-1 ring-black/[0.06] print:shadow-none">
        <PhotoFlip photos={photos} index={index} onIndex={i => setIndex(i)} hideBadge counter onOpen={() => setShowDetails(true)}
          alt={subject.street_address || 'Subject property'} className="h-[clamp(240px,34vw,430px)] w-full">
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/[0.72] via-black/[0.12] to-transparent" />
          <div className="pointer-events-none absolute left-4 top-4 z-[2] flex max-w-[70%] flex-wrap gap-2">
            {hasStatus && <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow ${subjectStatusBadgeClass(statusLabel)}`}>{statusLabel}</span>}
            {dom != null && <span className="rounded-full bg-black/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow">{dom} DOM</span>}
          </div>
          <span className="pointer-events-none absolute right-4 top-4 z-[2] inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-lg print:hidden">
            <Maximize2 className="h-3 w-3" /> View Details
          </span>
          {subject.list_price != null && (
            <span className={`pointer-events-none absolute left-4 z-[2] inline-block rounded-xl bg-white px-4 py-2 font-serif text-2xl font-black leading-none text-[#111827] shadow-lg sm:left-5 sm:text-3xl ${onPickPhoto && index > 0 ? 'bottom-12' : 'bottom-4 sm:bottom-5'}`}>
              {formatMoney(subject.list_price)}
            </span>
          )}
          {onPickPhoto && index > 0 && photos[index] && <LeadPhotoButton onClick={() => { onPickPhoto(photos[index]); setIndex(0) }} />}
        </PhotoFlip>
        {photos.length > 1 && <PhotoThumbs photos={photos} index={index} onPick={setIndex} className="bg-black/40 px-3 py-2" />}
        {stats.length > 0 && (
          <div className={`grid divide-x divide-white/10 border-t border-white/15 bg-black/35 ${cols}`}>
            {stats.map(stat => <SubjectStat key={stat.label} {...stat} />)}
          </div>
        )}
        {more.length > 0 && (
          <div className={`grid grid-cols-1 gap-px border-t border-white/15 bg-white/10 sm:grid-cols-2 ${more.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            {more.map(m => (
              <div key={m.label} className="flex min-w-0 items-center gap-2.5 bg-[#111827] px-4 py-2.5">
                <m.icon className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
                <span className="min-w-0">
                  <span className="block text-[8px] font-black uppercase tracking-wide text-white/50">{m.label}</span>
                  <span className="block truncate text-xs font-black text-white" title={m.value}>{m.value}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {showDetails && <HomeDetailsPopup kind="subject" home={subject} startIndex={index} onClose={() => setShowDetails(false)} />}
    </>
  )
}

// ---- The details pop-up (subject, a comp, a home on the market) -------------------------------------------------

type PopupHome = (CmaSubjectProperty | CmaComparable) & { agent_notes?: string | null }

export function HomeDetailsPopup({ kind, home, subject, mapRef, note, startIndex = 0, onClose, onPrev, onNext, position }: {
  kind: 'subject' | 'comp' | 'market'
  home: PopupHome
  subject?: CmaPublicResponse['subject']
  mapRef?: string | null
  /** The comp's analysis note, as the report shows it. */
  note?: string | null
  startIndex?: number
  onClose: () => void
  /** Step to the previous / next home of the same list (a comp to the next comp). */
  onPrev?: () => void
  onNext?: () => void
  /** "2 of 5" */
  position?: string
}) {
  const [photoIndex, setPhotoIndex] = useState(startIndex)
  const comp = kind === 'subject' ? null : (home as CmaComparable)
  const homeKey = `${kind}-${(home as CmaComparable).id || home.street_address}`
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } setPhotoIndex(0) }, [homeKey])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pics = usePhotoList(home.photos, home.photo_url)
  const cityState = [home.city, home.state].filter(Boolean).join(', ')
  const price = comp ? compDisplayPrice(comp).value : (home as CmaSubjectProperty).list_price
  const psf = comp ? (kind === 'market' ? (comp.price_per_sqft ?? null) : compPricePerSqft(comp)) : subjectPricePerSqft(home as CmaSubjectProperty)
  // Zoomed in on just this home - close enough to read the street layout: cul-de-sac, corner lot, highway frontage.
  const locationMapUrl = kind === 'comp' && comp ? buildCompLocationMapUrl(comp, '700x320', 17, mapRef) : null
  const tag = kind === 'subject' ? 'Subject Property' : kind === 'market' ? 'On the market' : 'Comparable'

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 sm:items-center sm:p-6" onClick={onClose}>
      <div className="cma-pop-in relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-[#151517] sm:max-h-[92vh] sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-full bg-black/55 p-2 text-white hover:bg-black/75"><X className="h-4 w-4" /></button>
        <PhotoFlip photos={pics} index={photoIndex} onIndex={i => setPhotoIndex(i)} resetKey={homeKey} counter className="aspect-[4/3] max-h-[44dvh] w-full shrink-0 sm:max-h-[420px]">
          <div className="pointer-events-none absolute left-3 top-3 z-[2] flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#111827] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">{tag}</span>
            {comp && kind === 'comp' && (
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[comp.status] || 'bg-gray-800'}`}>{compStatusBadgeText(comp)}</span>
            )}
            {home.days_on_market != null && <span className="rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">{home.days_on_market} DOM</span>}
          </div>
        </PhotoFlip>
        <PhotoThumbs photos={pics} index={photoIndex} onPick={setPhotoIndex} className="shrink-0 border-b border-gray-100 bg-[#faf9f7] px-4 py-2 dark:border-gray-800 dark:bg-[#0B0B0B]" />
        <div className="overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-[#111827] dark:text-white">{home.street_address}</p>
              {cityState && <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{cityState}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xl font-black text-[#8b7355] dark:text-[#d7b974]">{price != null ? formatMoney(price) : '-'}</p>
              {psf ? <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">${psf}/sqft{kind === 'comp' ? ' above grade' : ''}</p> : null}
              {comp && kind === 'comp' && compPriceCaption(comp) && <p className={`text-[9px] font-black uppercase tracking-wide text-gray-400 ${compDisplayPrice(comp).unverified ? 'text-amber-700 dark:text-amber-300' : ''}`}>{compPriceCaption(comp)}</p>}
              {comp && kind === 'market' && <p className="text-[9px] font-black uppercase tracking-wide text-gray-400">List price</p>}
              {comp && (comp.material_issues || []).length > 0 && <p className="mt-1 text-[10px] font-black text-red-700 dark:text-red-300">Note: {materialIssuesText(comp)}</p>}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PopupFact icon={BedDouble} label="Beds" value={home.beds ?? '-'} />
            <PopupFact icon={Bath} label="Baths" value={bathsText(home)} />
            <PopupFact icon={Ruler} label="Sqft" value={home.sqft ? formatNumber(home.sqft) : '-'} />
            <PopupFact icon={LandPlot} label="Acres" value={formatAcresFromSqft(home.lot_size)} />
            <PopupFact icon={Building2} label="Built" value={home.year_built ?? '-'} />
            <PopupFact icon={Calendar} label="DOM" value={home.days_on_market ?? '-'} />
            <PopupFact icon={DollarSign} label="Taxes" value={home.annual_taxes ? formatMoney(home.annual_taxes) : '-'} />
            {comp
              ? <PopupFact icon={MapPin} label="Distance" value={comp.distance_miles != null ? `${comp.distance_miles} Miles` : '-'} />
              : <PopupFact icon={Car} label="Garage" value={home.garage || '-'} />}
            <PopupFact icon={Droplets} label="Water" value={formatUtilityValue(home.water_source)} />
            <PopupFact icon={Building2} label="School" value={home.school_district || '-'} className="sm:col-span-2" />
            <PopupFact icon={Waves} label="Sewer" value={formatUtilityValue(home.sewer)} />
            {!comp && <PopupFact icon={Layers} label="Basement" value={basementDisplay(home)} />}
          </div>
          {home.public_remarks && (
            <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Original Listing Description</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">{home.public_remarks}</p>
            </div>
          )}
          {kind === 'subject' && home.agent_notes && (
            <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Agent Notes</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">{home.agent_notes}</p>
            </div>
          )}
          {locationMapUrl && comp && (
            <div className="mt-4">
              <div className="relative overflow-hidden rounded-xl">
                <img src={locationMapUrl} alt="Map of this comparable's location" loading="lazy" className="h-40 w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-[#111827]/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">Map</span>
              </div>
              {comp.distance_miles != null && <p className="mt-1.5 text-xs font-bold text-gray-400">{comp.distance_miles} miles from {subject?.street_address || 'the subject property'}</p>}
            </div>
          )}
          {note && (
            <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-4 dark:bg-[#0B0B0B]">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Comparable Analysis</p>
              <p className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300">{note}</p>
            </div>
          )}
        </div>
        {(onPrev || onNext) && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-[#151517]">
            <button type="button" onClick={onPrev} disabled={!onPrev} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-200 px-4 text-[11px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] hover:text-[#8b7355] active:scale-95 disabled:opacity-30 dark:border-gray-700 dark:text-white">
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            {position && <span className="text-[11px] font-black tabular-nums text-gray-400">{position}</span>}
            <button type="button" onClick={onNext} disabled={!onNext} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-200 px-4 text-[11px] font-black uppercase tracking-wide text-[#111827] transition hover:border-[#C9A24D] hover:text-[#8b7355] active:scale-95 disabled:opacity-30 dark:border-gray-700 dark:text-white">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- A comp's card ----------------------------------------------------------------------------------------------

// The 3-position scale every quality dimension is rated on, left-to-right - same tiers and ordering as the
// agent's own editor in the Analysis step, so a client sees exactly where the score landed on the same scale.
const QUALITY_TIERS = ['below', 'similar', 'above'] as const
// Weaker | Strong | Supporting - same left/middle/right order as the Analysis step (Strong sits in the middle).
const STRENGTH_TIERS = ['weak', 'strong', 'supporting'] as const

function QualityScaleRow({ label, tiers, tier, styles, onPick }: {
  label: string, tiers: readonly string[], tier?: string | null, styles: Record<string, string>, onPick?: (value: string) => void
}) {
  if (!tier && !onPick) return null
  return (
    <div className="flex items-center gap-3 py-1.5 first:pt-0 last:pb-0">
      <span className="w-24 shrink-0 text-[9px] font-black uppercase leading-tight tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      {tier === 'n_a' ? (
        // a condo's Lot - it has no lot of its own
        <div className="flex-1 rounded-md bg-gray-50 py-1.5 text-center text-[9px] font-black uppercase tracking-wide text-gray-400 dark:bg-gray-800/40">N/A</div>
      ) : (
        <div className="grid flex-1 grid-cols-3 gap-1">
          {tiers.map(t => {
            const cls = `rounded-md py-1.5 text-center text-[9px] font-black uppercase tracking-wide transition ${t === tier ? styles[t] : 'bg-gray-50 text-gray-300 dark:bg-gray-800/40 dark:text-gray-600'}`
            if (!onPick) return <div key={t} className={cls}>{t === tier ? QUALITY_LABELS[t] : '—'}</div>
            return (
              <button key={t} type="button" aria-pressed={t === tier} title={QUALITY_LABELS[t]} onClick={() => onPick(t)}
                className={`${cls} cursor-pointer outline-none hover:ring-2 hover:ring-[#C9A24D]/60 focus-visible:ring-2 focus-visible:ring-[#C9A24D] active:scale-95 ${t === tier ? '' : 'hover:text-gray-500'}`}>
                {t === tier ? QUALITY_LABELS[t] : <span className="opacity-70">{QUALITY_LABELS[t]}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const QUALITY_ROWS: { key: keyof CmaQualityAssessment, label: string, tiers: readonly string[] }[] = [
  { key: 'finish_quality', label: 'Finish Quality', tiers: QUALITY_TIERS },
  { key: 'interior', label: 'Interior', tiers: QUALITY_TIERS },
  // Kitchen and Bathrooms are descriptive only and always optional: shown when rated, left off when blank.
  { key: 'kitchen', label: 'Kitchen', tiers: QUALITY_TIERS },
  { key: 'bathrooms', label: 'Bathrooms', tiers: QUALITY_TIERS },
  { key: 'exterior', label: 'Exterior', tiers: QUALITY_TIERS },
  { key: 'lot', label: 'Lot', tiers: QUALITY_TIERS },
  { key: 'amenities', label: 'Amenities', tiers: QUALITY_TIERS },
  { key: 'layout', label: 'Layout', tiers: QUALITY_TIERS },
  { key: 'area', label: 'Area', tiers: AREA_TIERS },
  { key: 'street_context', label: 'Street', tiers: QUALITY_TIERS },
]

// How the agent (or the AI) scored this comp against the subject - not just the free-text note.
function ComparableQualitySection({ comp, edit }: { comp: CmaComparable, edit?: CmaEditHooks }) {
  const q = comp.quality || {}
  const displayedStrength = clientCompStrength(comp)
  const hasAny = !!(displayedStrength || QUALITY_ROWS.some(r => q[r.key]))
  // In the editor the rows are pickable only until the AI has written the report; after that they read as the
  // client sees them (owner, 11/17: ratings lock with the comps).
  const canRate = !!edit && !edit.ratingsLocked
  if (!hasAny && !canRate) return null
  return (
    <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-[#151517] print:border-gray-300">
      <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Compared With the Subject</p>
      <p className="mb-3 text-[10px] font-semibold text-gray-400">Each row describes this comp relative to the subject — &ldquo;Comp Superior&rdquo; means the comp is the better one; &ldquo;Comp Inferior&rdquo; means the subject is. These ratings are weighed in the final value review; they are not separate dollar adjustments.{(q.kitchen || q.bathrooms || canRate) ? ' Kitchen and Bathrooms describe those rooms only and are not part of the value.' : ''}</p>
      {/* Comp Weight asks how much weight this comp carries overall, not how one attribute compares - so it
          gets its own bracketed callout instead of sitting in the same divided list. */}
      {(displayedStrength || canRate) && (
        <div className="mb-3 -mx-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[#C9A24D] bg-gradient-to-br from-[#C9A24D]/10 via-white to-white px-3 py-2 shadow-[0_6px_18px_-10px_rgba(201,162,77,0.6)] dark:border-[#C9A24D]/60 dark:from-[#C9A24D]/10 dark:via-[#0B0B0B] dark:to-[#0B0B0B]">
          <span className="text-[10px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">Valuation Classification</span>
          {edit && canRate ? (
            <span className="flex gap-1">
              {STRENGTH_TIERS.map(t => (
                <button key={t} type="button" aria-pressed={displayedStrength === t} onClick={() => edit.setCompStrength(comp.id, t)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide outline-none transition hover:ring-2 hover:ring-[#C9A24D]/60 focus-visible:ring-2 focus-visible:ring-[#C9A24D] active:scale-95 ${displayedStrength === t ? (STRENGTH_SCALE_STYLES[t] || 'bg-slate-100 text-slate-600') : 'bg-gray-50 text-gray-400 dark:bg-gray-800/40'}`}>
                  {STRENGTH_LABEL[t] || t}
                </button>
              ))}
            </span>
          ) : displayedStrength ? (
            <span className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wide ${STRENGTH_SCALE_STYLES[displayedStrength] || 'bg-slate-100 text-slate-600'}`}>
              {STRENGTH_LABEL[displayedStrength] || displayedStrength}
            </span>
          ) : null}
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {QUALITY_ROWS.map(r => (
          <QualityScaleRow key={r.key} label={r.label} tiers={r.tiers} tier={q[r.key]} styles={QUALITY_TIER_STYLES}
            onPick={edit && canRate && q[r.key] !== 'n_a' ? v => edit.setCompQuality(comp.id, r.key, v) : undefined} />
        ))}
      </div>
    </div>
  )
}

export function ComparableSection({ comp, index, note, onOpen, mapRef, edit, bar, muted }: {
  comp: CmaComparable | EditorComp
  /** Its number on the report (0-based); null for a comp the client doesn't see (hidden / removed, editor only). */
  index: number | null
  /** The note as the report shows it (comp numbers already right). */
  note: string
  onOpen: () => void
  mapRef?: string | null
  edit?: CmaEditHooks
  /** The editor's bar for this comp. */
  bar?: React.ReactNode
  /** Greyed: not on the client's report. */
  muted?: boolean
}) {
  const photos = usePhotoList(comp.photos, comp.photo_url)
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => { setPhotoIndex(0) }, [comp.id, photos[0], photos.length])   // eslint-disable-line react-hooks/exhaustive-deps
  const psf = compPricePerSqft(comp)
  const displayedStrength = clientCompStrength(comp)
  const cityOnly = comp.city || ''
  const locationMapUrl = buildCompLocationMapUrl(comp, '700x320', 17, mapRef)
  const statusLabel = COMP_STATUS_LABEL[comp.status] || comp.status
  const statusBadgeText = compSoldDate(comp) ? `${statusLabel} • ${compSoldDate(comp)}` : compStatusBadgeText(comp)
  const numberTag = (
    <span className="rounded-lg bg-gradient-to-br from-[#C9A24D] to-[#a9832f] px-3.5 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-md">
      {index != null ? `Comp #${index + 1}` : 'Not on the report'}
    </span>
  )
  const strengthTag = displayedStrength && <span className={`rounded-lg px-3.5 py-2 text-[11px] font-black uppercase tracking-wide shadow-md ${STRENGTH_STYLES[displayedStrength]}`}>{STRENGTH_LABEL[displayedStrength]}</span>
  const priceBlock = (align: string) => (
    <div className={`shrink-0 ${align}`}>
      <p className="text-xl font-black leading-none text-[#8b7355] dark:text-[#d7b974]">{formatMoney(compDisplayPrice(comp).value)}</p>
      {psf && <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400">${psf}/sqft above grade</p>}
      {compPriceCaption(comp) && <p className={`mt-1 text-[10px] font-black uppercase tracking-wide text-gray-400 ${compDisplayPrice(comp).unverified ? 'text-amber-700 dark:text-amber-300' : ''}`}>{compPriceCaption(comp)}</p>}
      {(comp.material_issues || []).length > 0 && <p className="mt-1 text-[10px] font-black text-red-700 dark:text-red-300">Note: {materialIssuesText(comp)}</p>}
    </div>
  )
  return (
    <div className={`overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517] print:break-inside-avoid print:border-gray-300 print:shadow-none ${muted ? 'opacity-60 grayscale-[0.5]' : ''}`}>
      {bar}
      <div className="p-4">
        <div className="mb-4 lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">{numberTag}{strengthTag}</div>
          <div className="mt-3 flex flex-col gap-2.5 min-[430px]:flex-row min-[430px]:items-start min-[430px]:justify-between min-[430px]:gap-3">
            <div className="min-w-0">
              <p className="text-lg font-black leading-tight text-[#111827] dark:text-white print:text-black">{comp.street_address}</p>
              {cityOnly && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{cityOnly}</p>}
            </div>
            {priceBlock('min-[430px]:text-right')}
          </div>
        </div>
        <div className="grid items-stretch gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col">
            <PhotoFlip photos={photos} index={photoIndex} onIndex={i => setPhotoIndex(i)} onOpen={onOpen} counter className="aspect-[4/3] w-full rounded-2xl">
              {/* Status carries the sold date inline (Sold • Jun 2, 2025), DOM sits opposite it. */}
              <span className={`pointer-events-none absolute left-3 top-3 z-[2] max-w-[60%] truncate rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg ${COMP_STATUS_BADGE_STYLE[comp.status] || 'bg-gray-800'}`}>{statusBadgeText}</span>
              {comp.days_on_market != null && (
                <span className="pointer-events-none absolute right-3 top-3 z-[2] rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">{comp.days_on_market} DOM</span>
              )}
              {comp.distance_miles != null && !(edit && photoIndex > 0) && (
                <span className="pointer-events-none absolute bottom-3 left-3 z-[2] flex items-center gap-1 whitespace-nowrap rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                  <MapPin className="h-3 w-3 shrink-0" /> {comp.distance_miles} mi from subject
                </span>
              )}
              {edit && photoIndex > 0 && photos[photoIndex] && <LeadPhotoButton onClick={() => { edit.pickPhoto(comp.id, photos[photoIndex]); setPhotoIndex(0) }} />}
            </PhotoFlip>
            <PhotoThumbs photos={photos} index={photoIndex} onPick={setPhotoIndex} size="sm" className="mt-2 rounded-2xl bg-[#fbfaf7] p-2 dark:bg-[#0B0B0B]" />
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-3 sm:gap-2">
              <MiniFact icon={BedDouble} label="Beds" value={comp.beds ?? '-'} />
              <MiniFact icon={Bath} label="Baths" value={bathsText(comp)} />
              <MiniFact icon={LandPlot} label="Acres" value={formatAcresFromSqft(comp.lot_size)} />
              <MiniFact icon={Building2} label="Built" value={comp.year_built ?? '-'} />
              <MiniFact icon={Gauge} label="$/Sqft" value={psf ? `$${psf}` : '-'} />
              <MiniFact icon={Car} label="Garage" value={comp.garage || '-'} />
              <MiniFact icon={Droplets} label="Water / Sewer" value={`${formatUtilityValue(comp.water_source)} / ${formatUtilityValue(comp.sewer)}`} className="order-1 col-span-4 sm:hidden" />
              <MiniFact icon={Droplets} label="Water" value={formatUtilityValue(comp.water_source)} className="hidden sm:flex" />
              <MiniFact icon={DollarSign} label="Taxes" value={comp.annual_taxes ? formatMoney(comp.annual_taxes) : '-'} className="max-sm:col-span-2" />
              <MiniFact icon={Waves} label="Sewer" value={formatUtilityValue(comp.sewer)} className="hidden sm:flex" />
            </div>
            <div className="mt-2 flex flex-1 flex-col gap-2">
              <WideCompFact icon={Building2} label="School District" value={comp.school_district || '-'} compact className="flex-1 max-sm:justify-center max-sm:text-center" />
              <WideCompFact icon={Layers} label="Basement" value={basementDisplay(comp)} compact className="flex-1 max-sm:justify-center max-sm:text-center" />
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="hidden lg:block">
              <div className="flex flex-wrap items-center justify-between gap-2">{numberTag}{strengthTag}</div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-black text-[#111827] dark:text-white print:text-black">{comp.street_address}</p>
                  {cityOnly && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{cityOnly}</p>}
                </div>
                {priceBlock('text-right')}
              </div>
            </div>
            {/* Zoomed-in single-property map - close enough to read the street layout. */}
            {locationMapUrl && (
              <div className="relative mt-4 overflow-hidden rounded-xl">
                <img src={locationMapUrl} alt="Map of this comparable's location" loading="lazy" className="h-36 w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-full bg-[#111827]/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg">Map</span>
              </div>
            )}
            <ComparableQualitySection comp={comp} edit={edit} />
          </div>
        </div>

        {(note || edit) && (
          <div className="mt-4 rounded-2xl bg-[#fbfaf7] p-3 dark:bg-[#0B0B0B] print:bg-gray-50">
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Comparable Analysis</p>
            {edit
              ? <EditableText value={note} onChange={v => edit.setCompNote(comp.id, v)} placeholder="Why this sale matters for the value: how it compares in size, condition, location and timing." label={`Analysis of ${comp.street_address || 'this comp'}`} className="text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300 print:text-gray-800" />
              : <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300 print:text-gray-800">{note}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Overview table -----------------------------------------------------------------------------------------------

// Zebra striping plus a gold hover tint so tracking one stat across 5+ comp columns doesn't depend on a faint border.
export function OverviewRow({ index, label, subjectValue, comparables, get }: { index: number, label: string, subjectValue: string, comparables: CmaComparable[], get: (c: CmaComparable) => string }) {
  return (
    <tr className={`border-b border-gray-100 transition-colors hover:bg-[#C9A24D]/10 dark:border-gray-800 dark:hover:bg-[#C9A24D]/10 print:border-gray-200 ${index % 2 === 1 ? 'bg-black/[0.03] dark:bg-white/[0.03]' : ''}`}>
      <td className="sticky left-0 z-[1] w-[112px] whitespace-normal bg-[#faf9f7] py-2.5 pr-2 text-[12px] font-bold leading-tight text-gray-500 dark:bg-[#0B0B0B] sm:static sm:w-auto sm:truncate sm:bg-transparent sm:py-2 sm:text-xs sm:dark:bg-transparent">{label}</td>
      <td className="truncate py-2.5 pr-3 text-[12.5px] font-black text-[#111827] dark:text-white print:text-black sm:py-2 sm:pr-2 sm:text-xs" title={subjectValue}>{subjectValue}</td>
      {comparables.map(c => {
        const value = get(c)
        return <td key={c.id} className="truncate py-2.5 pr-3 text-[12.5px] font-semibold text-gray-700 dark:text-gray-300 sm:py-2 sm:pr-2 sm:text-xs" title={value}>{value}</td>
      })}
    </tr>
  )
}

// ---- Bar chart ----------------------------------------------------------------------------------------------------

export function BarChart({ title, subjectValue, bars, formatValue }: { title: string, subjectValue?: number | null, bars: { label: string, value: number }[], formatValue: (v: number) => string }) {
  const max = Math.max(...bars.map(b => b.value), subjectValue || 0, 1)
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] print:border-gray-200 print:bg-white print:shadow-none sm:p-5">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-2">
        {subjectValue != null && (
          <div className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-black uppercase text-[#6f5c3c] dark:text-[#d7b974]">Subj.</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full border border-gray-200 bg-[#ebe7df] dark:border-white/10 dark:bg-white/10"><div className="h-full rounded-full bg-[#111827] transition-[width] duration-500 dark:bg-[#d7b974]" style={{ width: `${(subjectValue / max) * 100}%` }} /></div>
            <span className="w-20 shrink-0 text-right text-[11px] font-black">{formatValue(subjectValue)}</span>
          </div>
        )}
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[10px] font-bold text-gray-400">{b.label}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full border border-gray-200 bg-[#ebe7df] dark:border-white/10 dark:bg-white/10"><div className="h-full rounded-full bg-[#8b7355] transition-[width] duration-500 dark:bg-[#a98d5d]" style={{ width: `${(b.value / max) * 100}%` }} /></div>
            <span className="w-20 shrink-0 text-right text-[11px] font-bold text-gray-600 dark:text-gray-300">{b.value ? formatValue(b.value) : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- The live map --------------------------------------------------------------------------------------------------

// A comp's card on the report map: tapping it opens the same details window as the comp cards below the map.
function PublicMapCompCard({ comp, index, layout, onOpen, onClose }: { comp: CmaComparable, index: number, layout: 'stack' | 'row', onOpen?: () => void, onClose: () => void }) {
  const price = compDisplayPrice(comp).value
  let note: string | null = comp.distance_miles != null ? `${comp.distance_miles} mi away` : null
  if (comp.status === 'sold' && comp.sale_price && comp.list_price) {
    const pct = Math.round(((comp.sale_price - comp.list_price) / comp.list_price) * 1000) / 10
    note = Math.abs(pct) < 0.1 ? 'Sold at asking' : `${Math.abs(pct)}% ${pct > 0 ? 'over' : 'under'} ask`
  }
  return (
    <MapPropertyCard
      layout={layout}
      photo={comp.photo_url ? normalizeImageUrl(comp.photo_url) : null}
      price={price ? formatMoney(price) : null}
      priceNote={note}
      status={{ label: comp.status === 'sold' && comp.sale_date ? `Sold ${formatDate(comp.sale_date)}` : (COMP_STATUS_LABEL[comp.status] || comp.status), bg: COMP_STATUS_HEX[comp.status] || '#374151' }}
      tag={{ label: `#${index + 1}`, bg: '#111827' }}
      street={comp.street_address || 'Comparable'}
      place={comp.city || [comp.state, comp.zipcode].filter(Boolean).join(' ')}
      specs={mapCardSpecs({ beds: comp.beds, baths: comp.baths, sqft: comp.sqft, acres: comp.lot_size ? comp.lot_size / 43560 : null })}
      onOpen={onOpen}
      onClose={onClose}
    />
  )
}

/** The subject and the comps ON THE REPORT, pinned and numbered as the report numbers them. A comp the agent
 *  hides or removes loses its pin the moment it leaves the list passed in (the pins are redrawn from it). */
export function CmaInteractiveMap({ subject, comparables, fallbackUrl, activeComparableId, onSelectComparable, onOpenComparable }: {
  subject: CmaPublicResponse['subject'],
  comparables: CmaComparable[],
  fallbackUrl: string,
  activeComparableId?: string | null,
  onSelectComparable?: (id: string | null) => void,
  onOpenComparable?: (comp: CmaComparable) => void,
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObjRef = useRef<google.maps.Map | null>(null)
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map())
  const [openCompId, setOpenCompId] = useState<string | null>(null)
  const lastOpenedCompIdRef = useRef<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [mapReadyKey, setMapReadyKey] = useState(0)
  const [mapObj, setMapObj] = useState<google.maps.Map | null>(null)
  const mapDataKey = useMemo(() => [
    subject.latitude, subject.longitude, subject.street_address,
    ...comparables.map(c => [c.id, c.latitude, c.longitude, c.street_address, c.city, c.state, c.zipcode, c.photo_url, c.status, c.sale_date, c.sale_price, c.list_price, c.sqft, c.price_per_sqft, c.distance_miles].join(':')),
  ].join('|'), [subject.latitude, subject.longitude, subject.street_address, comparables])
  // The callbacks are read through refs so a parent re-render (a new function each time) never rebuilds the map.
  const onSelectRef = useRef(onSelectComparable)
  onSelectRef.current = onSelectComparable

  useEffect(() => {
    let cancelled = false
    googleMapsLoader.load().then(() => {
      if (cancelled || !mapRef.current) return
      const points = [
        subject.latitude != null && subject.longitude != null
          ? { label: 'S', title: subject.street_address || 'Subject property', position: { lat: subject.latitude, lng: subject.longitude }, subject: true }
          : null,
        ...comparables
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.latitude != null && c.longitude != null)
          .map(({ c, i }) => ({ label: `#${i + 1}`, title: c.street_address || `Comparable #${i + 1}`, position: { lat: c.latitude as number, lng: c.longitude as number }, subject: false, comp: c, index: i })),
      ].filter(Boolean) as { label: string, title: string, position: google.maps.LatLngLiteral, subject: boolean, comp?: CmaComparable, index?: number }[]
      if (points.length === 0) { setLoadError(true); return }
      setLoadError(false)

      // The map itself is made once; a change to the comps only redraws the pins and re-frames them.
      let map = mapObjRef.current
      if (!map || map.getDiv() !== mapRef.current) {
        map = new google.maps.Map(mapRef.current, {
          center: points[0].position, zoom: points.length > 1 ? 13 : 15,
          mapTypeControl: false, streetViewControl: true, fullscreenControl: true, clickableIcons: false, zoomControl: true, gestureHandling: 'greedy',
        })
        mapObjRef.current = map
        setMapObj(map)
      }
      const bounds = new google.maps.LatLngBounds()
      markerRefs.current.forEach(marker => marker.setMap(null))
      markerRefs.current = new Map()
      points.forEach(point => {
        bounds.extend(point.position)
        const marker = new google.maps.Marker({
          map, position: point.position, title: point.title,
          label: { text: point.label, color: '#ffffff', fontWeight: '800', fontSize: point.subject ? '12px' : '11px' },
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: point.subject ? 13 : 11, fillColor: point.subject ? '#111827' : '#C9A24D', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
        })
        if (point.comp && point.index != null) {
          markerRefs.current.set(point.comp.id, marker)
          marker.addListener('click', () => {
            lastOpenedCompIdRef.current = point.comp!.id
            onSelectRef.current?.(point.comp!.id)
            setOpenCompId(point.comp!.id)
          })
        }
      })
      if (points.length > 1) map.fitBounds(bounds, 64)
      else { map.setCenter(points[0].position); map.setZoom(15) }
      setOpenCompId(id => (id && markerRefs.current.has(id) ? id : null))
      setMapReadyKey(key => key + 1)
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapDataKey])

  useEffect(() => () => {
    markerRefs.current.forEach(marker => marker.setMap(null))
    markerRefs.current = new Map()
    mapObjRef.current = null
  }, [])

  useEffect(() => {
    if (!activeComparableId) return
    if (lastOpenedCompIdRef.current === activeComparableId) return
    const map = mapObjRef.current
    const marker = markerRefs.current.get(activeComparableId)
    const comp = comparables.find(c => c.id === activeComparableId)
    const position = marker?.getPosition()
    if (!map || !marker || !comp || !position) return
    map.panTo(position)
    if ((map.getZoom() || 0) < 14) map.setZoom(14)
    setOpenCompId(comp.id)
    lastOpenedCompIdRef.current = activeComparableId
  }, [activeComparableId, comparables, mapReadyKey])

  if (loadError) {
    return <img src={normalizeImageUrl(fallbackUrl)} alt="Map of subject and comparable locations" className="h-full w-full object-cover" />
  }

  // The subject's township, the ones around it and its school district sit over the comparables,
  // without changing how the map frames them.
  const i = openCompId ? comparables.findIndex(c => c.id === openCompId) : -1
  const open = i >= 0 ? comparables[i] : null
  const close = () => { setOpenCompId(null); lastOpenedCompIdRef.current = null; onSelectRef.current?.(null) }
  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      <MapPopup map={mapObj} position={open && open.latitude != null && open.longitude != null ? { lat: open.latitude, lng: open.longitude } : null}
        anchor={{ above: 14, below: 14, side: 14 }} onClose={close} className="z-[45]">
        {space => open && <PublicMapCompCard comp={open} index={i} layout={space.height < 300 || space.width < 300 ? 'row' : 'stack'} onOpen={() => onOpenComparable?.(open)} onClose={close} />}
      </MapPopup>
      {subject.latitude != null && subject.longitude != null && (
        <HomeAreaOverlay map={mapObj} latitude={subject.latitude} longitude={subject.longitude} fit={false} />
      )}
    </div>
  )
}
