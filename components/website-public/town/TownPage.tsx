import {
  TownSectionNav, TownLiving, TownInsights, TownCommute, TownMap, TownWalk, ExploreNearby,
} from '@/components/website-public/LazySiteParts'
import {
  AlertTriangle, ArrowRight, Bell, Building2, ChevronDown, Coffee, ExternalLink, GraduationCap, HeartPulse,
  Home, MapPin, MessageCircle, Plus, School, ShoppingBag, ShoppingBasket, Sparkles, Train, Trees, Users, Utensils,
} from 'lucide-react'
import { buildTownFaq, daysOnMarketStat, firstSentences } from '@/components/website-public/townGuide'
import MarketTrendsSection from '@/components/website-public/MarketTrendsSection'
import CinematicHeroBackground from '@/components/website-public/CinematicHeroBackground'
import ClassicPageHero from '@/components/website-public/ClassicPageHero'
import { cleanStreet, formatCompactPrice, formatStatus, statusBadgeColor } from '@/components/website-public/listingFormat'
import HomeCard from '@/components/website-public/HomeCard'
import SpotlightChip from '@/components/website-public/SpotlightChip'
import SitePhoto from '@/components/website-public/SitePhoto'
import MapsLink from '@/components/website-public/MapsLink'
import { fontClass } from '@/components/website-public/blocks/fontClass'
import { resolveMediaUrl } from '@/lib/api-service'
import { tidyAllCaps } from '@/lib/cheatSheetContent'
import { IMG, sizedBg, sizedImage } from '@/lib/siteImage'

// The IDX town page - moved here unchanged from the public site route so the admin's town preview
// can draw the very same page (see TownPageView below). Server-safe: no hooks, no browser APIs;
// the interactive pieces come from LazySiteParts like everywhere else on the public site.

// Legacy raw-Places/NCES keys - still shown for an area that hasn't been re-researched under the
// AI pipeline yet (see CURATED_CATEGORY_META below for the categories that replace these once a
// MarketArea has real `research_version`/curated data - see area_research_service.py).
const FACT_SECTION_LABELS: Record<string, string> = {
  schools: 'Schools',
  parks: 'Parks',
  transportation: 'Transportation',
  downtown_areas: 'Downtown & Nearby Centers',
  amenities: 'Shops & Restaurants',
}

const SOURCE_LABELS: Record<string, string> = {
  google_places: 'Google Places',
  nces: 'U.S. Dept. of Education (NCES)',
  census_acs5: 'U.S. Census Bureau',
  ohp_local: 'OpenHousePal listing data',
  ai_research: 'AI-researched, web-sourced',
}

function FactSource({ source }: { source?: string }) {
  if (!source) return null
  return <span className="ml-1.5 text-[10px] font-semibold normal-case tracking-normal text-gray-400">via {SOURCE_LABELS[source] || source}</span>
}

// The AI-curated categories (see area_research_service.py RESEARCH_CATEGORIES) - each stored as
// { entities: [{name, relationship, city, distance_miles, source_url, source_type, confidence,
// description}], notes?, _meta }. Deliberately excludes public_schools (its own dedicated,
// richer section below - "highest level of care" per the enrichment plan) and market_context
// (its own section, clearly separated from live MLS stats).
export const CURATED_CATEGORY_META: Record<string, { label: string; icon: any }> = {
  private_schools: { label: 'Private Schools', icon: School },
  grocery: { label: 'Grocery', icon: ShoppingBasket },
  parks: { label: 'Parks & Recreation', icon: Trees },
  restaurants: { label: 'Restaurants', icon: Utensils },
  shopping: { label: 'Shopping', icon: ShoppingBag },
  downtown_centers: { label: 'Downtown & Town Centers', icon: Building2 },
  medical: { label: 'Medical & Hospitals', icon: HeartPulse },
  transportation: { label: 'Transportation', icon: Train },
}

export function categoryEntities(data: any): CuratedEntity[] {
  return Array.isArray(data?.entities) ? data.entities : []
}

function categoryHasContent(facts: Record<string, any>, categoryKey: string) {
  return categoryEntities(facts[categoryKey]).length > 0
}

function entityMeta(e: CuratedEntity) {
  return [
    e.category,
    // A city neighborhood's places say where they are: "In Bella Vista" / "Nearby in Fairmount".
    e.where || e.city,
    typeof e.distance_miles === 'number' ? `${e.distance_miles.toFixed(e.distance_miles < 1 ? 1 : 0)} mi` : e.access_note,
  ].filter(Boolean).join(' · ')
}

export interface CuratedEntity {
  name: string
  category?: string
  relationship?: string
  city?: string
  where?: string
  access_note?: string
  distance_miles?: number
  source_url?: string
  source_type?: string
  description?: string
  confidence?: number
}

const FACT_SECTION_ICONS: Record<string, any> = {
  schools: GraduationCap,
  parks: Trees,
  transportation: Train,
  downtown_areas: Building2,
  amenities: Coffee,
  demographics: Users,
}

function FactCard({ label, source, icon: Icon, theme, children }: { label: string; source?: string; icon?: any; theme: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${theme.secondary_color}1a`, color: theme.secondary_color }}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
          {label}<FactSource source={source} />
        </h3>
      </div>
      <div className="mt-3 text-sm text-gray-600">{children}</div>
    </div>
  )
}

// The core reusable property card - used for community inventory, agent sales/similar homes,
// and anywhere else a real MLS-backed listing needs a consistent, premium presentation.
// `dateLabel` (open houses) renders a date/time pill instead of a status badge; when neither a
// listing_key nor a usable id exists, the card renders as a plain non-clickable div rather than
// ever generating a dead /properties/{undefined} link.
export function ListingCard({ item, theme, basePrefix, showStatus = true, dateLabel }: { item: any; theme: any; basePrefix: string; showStatus?: boolean; dateLabel?: string | null }) {
  const key = item.listing_key
  const badge = statusBadgeColor(item.status)
  const statLine = [
    item.bedrooms != null ? `${item.bedrooms} bd` : null,
    item.bathrooms != null ? `${item.bathrooms} ba` : null,
    item.living_area != null ? `${item.living_area.toLocaleString()} sqft` : null,
  ].filter(Boolean).join(' · ')

  const inner = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <SitePhoto src={item.photo} widths={IMG.card} className="ohp-mls-crop h-full w-full transition-transform duration-700 ease-out group-hover:scale-110 object-cover" />
        {dateLabel ? (
          // A sold date wears Sold red (statusBadgeColor), not the site's accent - user, 10/27.
          <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm" style={String(item.status || '').toUpperCase().includes('CLOSED') ? { backgroundColor: badge.bg, color: badge.fg } : { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            {dateLabel}
          </span>
        ) : (
          showStatus && item.status && (
            <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide shadow-sm" style={{ backgroundColor: badge.bg, color: badge.fg }}>
              {formatStatus(item.status)}
            </span>
          )
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
        {item.price != null && (
          <span className={`absolute bottom-3 left-4 text-[28px] font-black leading-none text-white [text-shadow:0_2px_14px_rgba(0,0,0,.6)] ohp-site-heading ${fontClass(theme.heading_font, 'font-serif')}`}>
            ${item.price.toLocaleString()}
          </span>
        )}
        {item.spotlight_url ? (
          <SpotlightChip url={item.spotlight_url} className="absolute right-3 top-3" />
        ) : key && (
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-400 opacity-0 shadow-sm transition group-hover:opacity-100">
            <ArrowRight className="h-3.5 w-3.5 -rotate-45" />
          </span>
        )}
      </div>
      <div className="p-5">
        {/* "Street, Town" once - the town the same size in a softer colour, no state / ZIP (the
            address used to carry them, then the town and state again after it) - facts below. */}
        <p className="truncate text-[16px] font-bold" style={{ color: 'var(--site-heading)' }}>
          {cleanStreet(item.address, item.city) || 'Address on request'}
          {item.city && <span className="font-semibold" style={{ color: 'var(--site-muted)' }}>, {item.city}</span>}
        </p>
        {statLine && <p className="mt-1.5 flex items-center gap-2 truncate text-xs font-semibold text-gray-500"><span className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: theme.secondary_color }} />{statLine}</p>}
        {item.list_office_name && <p className="mt-2 truncate text-[10px] font-medium" style={{ color: 'var(--site-muted)' }}>Courtesy of {item.list_office_name}</p>}
      </div>
    </>
  )

  const className = "ohp-card group overflow-hidden rounded-[26px] bg-white shadow-[0_2px_24px_rgba(17,24,39,0.08)] ring-1 ring-black/[0.04] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_50px_-24px_rgba(17,24,39,0.35)] hover:ring-[var(--site-gold)]/50"
  if (!key) return <div className={className}>{inner}</div>
  return <a href={`${basePrefix}/properties/${encodeURIComponent(key)}`} className={className}>{inner}</a>
}

export interface CommunityHomesParams {
  homes?: string
  sort?: string
  min_price?: string
  max_price?: string
}

// ---- Town (neighborhood) page pieces. Everything is themed through the site's CSS vars, so the
// same page reads right in Classic and Luxe, light and dark.

const TOWN_CARD_STYLE = { backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', boxShadow: 'var(--site-shadow)' }

function TownSection({ id, alt = false, children }: { id: string; alt?: boolean; children: React.ReactNode }) {
  return (
    <section id={id} className="ohp-town-section scroll-mt-32 px-5 py-14 sm:px-6 sm:py-20" style={alt ? { backgroundColor: 'var(--site-bg-alt)' } : undefined}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  )
}

function TownHeading({ eyebrow, title, sub, luxe, right }: { eyebrow: string; title: string; sub?: React.ReactNode; luxe: boolean; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--site-accent-text)' }}>
          {luxe && <span className="h-px w-7" style={{ backgroundColor: 'var(--site-accent)' }} />}{eyebrow}
        </p>
        <h2 className={`ohp-site-heading mt-2 text-[1.75rem] font-black leading-[1.1] sm:text-[2.4rem] ${luxe ? 'tracking-tight' : 'tracking-[-0.02em]'}`} style={{ color: 'var(--site-heading)' }}>{title}</h2>
        {sub && <p className="mt-2.5 text-sm leading-relaxed sm:text-[15px]" style={{ color: 'var(--site-muted)' }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

function TownSubheading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h3 className="flex items-center gap-2 text-lg font-black sm:text-xl" style={{ color: 'var(--site-heading)' }}>
      {children}
      {count != null && <span className="rounded-full px-2 py-0.5 text-[11px] font-black" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}>{count}</span>}
    </h3>
  )
}

/** "See all" folds - plain <details>, so long lists stay out of the way and need no JavaScript. */
function TownMore({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group/more mt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black transition hover:-translate-y-0.5 [&::-webkit-details-marker]:hidden"
        style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
        <span className="group-open/more:hidden">{label}</span><span className="hidden group-open/more:inline">Show less</span>
        <ChevronDown className="h-3.5 w-3.5 transition group-open/more:rotate-180" />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  )
}

function TownPlaceRow({ e, state }: { e: CuratedEntity; state?: string | null }) {
  const meta = entityMeta(e)
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      {/* The place itself on the map - not the website it was researched on (often wrong, user 10/27) */}
      <MapsLink place={e.name} near={[e.city, state]} className="text-[15px] font-bold hover:underline" style={{ color: 'var(--site-heading)' }}>{e.name}</MapsLink>
      {meta && <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>{meta}</p>}
      {e.description && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{e.description}</p>}
    </li>
  )
}

// One "Living here" / "Getting around" card - the researched summary in a sentence or two, the
// top three places, and the rest folded away.
function TownPlaceCard({ categoryKey, data, luxe, label, state }: { categoryKey: string; data: any; luxe: boolean; label?: string; state?: string | null }) {
  const meta = CURATED_CATEGORY_META[categoryKey]
  const items = categoryEntities(data)
  if (!meta || !items.length) return null
  const Icon = meta.icon
  return (
    <div className={`border p-5 sm:p-6 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-black" style={{ color: 'var(--site-heading)' }}>{label || meta.label}</h3>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>{items.length} {items.length === 1 ? 'place' : 'places'}</p>
        </div>
      </div>
      {data?.notes && <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{firstSentences(data.notes, 2)}</p>}
      <ul className="mt-4 divide-y border-t pt-4" style={{ borderColor: 'var(--site-line)' }}>
        {items.slice(0, 3).map((e, i) => <TownPlaceRow key={i} e={e} state={state} />)}
      </ul>
      {items.length > 3 && (
        <TownMore label={`See all ${items.length}`}>
          <ul className="divide-y" style={{ borderColor: 'var(--site-line)' }}>
            {items.slice(3).map((e, i) => <TownPlaceRow key={i} e={e} state={state} />)}
          </ul>
        </TownMore>
      )}
    </div>
  )
}

function TownSchoolColumn({ label, schools }: { label: string; schools: { name: string; district?: string; source_url?: string; note?: string; plan_note?: string }[] }) {
  if (!schools.length) return null
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-muted)' }}>{label}</p>
      <ul className="mt-2 space-y-2">
        {schools.map((s, i) => (
          <li key={i} className="text-sm font-semibold leading-snug" style={{ color: 'var(--site-ink)' }}>
            {s.source_url ? <a href={s.source_url} target="_blank" rel="noreferrer" className="hover:underline">{s.name}</a> : s.name}
            {/* Philadelphia: the district's zone - grades and the share of homes zoned for it */}
            {(s.note || s.district) && <span className="block text-[11px] font-medium" style={{ color: 'var(--site-muted)' }}>{s.note || s.district}</span>}
            {s.plan_note && <span className="block text-[11px] font-medium text-amber-600">{s.plan_note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Schools - the researched districts and schools by level (or the raw NCES list for a town not
// researched yet), private schools, and the always-on "confirm with the district" note.
function TownSchools({ facts, name, luxe, state }: { facts: Record<string, any>; name: string; luxe: boolean; state?: string | null }) {
  const ps = facts.public_schools || {}
  const districts: { name: string; source_url?: string; share?: number }[] = ps.districts || []
  const raw: any[] = Array.isArray(facts.schools) ? facts.schools : (facts.schools?.items || [])
  const byLevel = (level: string) => raw.filter(s => String(s.level || '').toLowerCase().startsWith(level)).map(s => ({ name: tidyAllCaps(s.name) }))
  const elementary = ps.elementary_schools || byLevel('elem')
  const middle = ps.middle_schools || byLevel('mid')
  const high = ps.high_schools || byLevel('high')
  const privateSchools = categoryEntities(facts.private_schools)
  if (!districts.length && !elementary.length && !middle.length && !high.length) return null
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className={`border p-5 sm:p-7 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
        {districts.length > 0 && (
          <>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-muted)' }}>{districts.length > 1 ? `${districts.length} public school districts serve ${name}` : 'Public school district'}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {districts.map((d, i) => (
                <a key={i} href={d.source_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-black ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                  <GraduationCap className="h-3.5 w-3.5" /> {d.name}
                  {districts.length > 1 && d.share ? <span className="ml-0.5 rounded-full bg-black/15 px-1.5 py-0.5 text-[10px] font-black">{d.share}% of homes</span> : null}
                </a>
              ))}
            </div>
          </>
        )}
        {(ps.crosses_district_boundary || ps.assignment_depends_on_exact_address) && ps.boundary_caveat && (
          <div className="mt-4 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed" style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: 'var(--site-ink)' }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>{ps.boundary_caveat}</p>
          </div>
        )}
        <div className={`grid grid-cols-1 gap-5 sm:grid-cols-3 ${districts.length ? 'mt-6 border-t pt-6' : ''}`} style={{ borderColor: 'var(--site-line)' }}>
          <TownSchoolColumn label="Elementary" schools={elementary} />
          <TownSchoolColumn label="Middle" schools={middle} />
          <TownSchoolColumn label="High school" schools={high} />
        </div>
        <p className="mt-6 border-t pt-4 text-[11px] leading-relaxed" style={{ borderColor: 'var(--site-line)', color: 'var(--site-muted)' }}>
          School assignment depends on the exact address and can change - confirm the schools for any specific home with {districts.length === 1 ? `${/^school district/i.test(districts[0].name) ? 'the ' : ''}${districts[0].name}` : 'the school district'}.
        </p>
      </div>
      {privateSchools.length > 0 ? (
        <TownPlaceCard categoryKey="private_schools" data={facts.private_schools} luxe={luxe} label="Private & independent schools" state={state} />
      ) : <div className="hidden lg:block" />}
    </div>
  )
}

/** Which local governments the town's homes sit in - one row and share bar each (biggest four,
 * the rest as "Other"), instead of one run-on "A 40% · B 22% · ..." line. */
function TownGovShares({ label, items }: { label: string; items: { name: string; share: number }[] }) {
  const sorted = [...items].sort((a, b) => (b.share || 0) - (a.share || 0))
  const top = sorted.slice(0, 4)
  const other = sorted.slice(4).reduce((n, m) => n + (m.share || 0), 0)
  const rows = other > 0 ? [...top, { name: `Other (${sorted.length - 4})`, share: other }] : top
  return (
    <div className="mt-5">
      <p className="text-[13px] font-semibold" style={{ color: 'var(--site-muted)' }}>{label}</p>
      <ul className="mt-2.5 space-y-2.5">
        {rows.map(m => (
          <li key={m.name}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-bold" style={{ color: 'var(--site-heading)' }}>{m.name}</span>
              {rows.length > 1 && <span className="shrink-0 font-black tabular-nums" style={{ color: 'var(--site-heading)' }}>{Math.round(m.share)}%</span>}
            </div>
            {rows.length > 1 && (
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, m.share))}%`, background: 'linear-gradient(90deg, var(--site-accent-deep), var(--site-accent))' }} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function TownGlanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-[13px] font-semibold" style={{ color: 'var(--site-muted)' }}>{label}</dt>
      <dd className="text-right text-[15px] font-black" style={{ color: 'var(--site-heading)' }}>{value}</dd>
    </div>
  )
}

/** What the Homes list asks for (how many, the order, the price range) - from the page's own
 * address, so "Show more homes" and the price filter work without any JavaScript. */
export function townHomesQuery(homesParams: CommunityHomesParams) {
  const homesLimit = Math.min(Math.max(parseInt(homesParams.homes || '9', 10) || 9, 9), 48)
  const sort = ['newest', 'price_desc', 'price_asc'].includes(homesParams.sort || '') ? homesParams.sort! : 'newest'
  const listingsQs = new URLSearchParams({ limit: String(homesLimit), sort })
  if (homesParams.min_price) listingsQs.set('min_price', homesParams.min_price)
  if (homesParams.max_price) listingsQs.set('max_price', homesParams.max_price)
  return { homesLimit, sort, listingsQs }
}

/** The IDX town (neighborhood) page itself, drawn from data already loaded: the public site route
 * (app/(sitepublic)/ohp-site-render/.../page.tsx - CommunityPage) and the admin's town preview
 * (app/admin/town-preview/[areaId]) both draw it here, so the preview is the real page.
 * `selfPath` / `keepParams` are only for the preview: where the page's own links (price filter,
 * "Show more homes") point, and what they carry along. */
export function TownPageView({ area, listingsRes, profile, areaList, siteId, slug, theme, basePrefix, homesParams, selfPath = `${basePrefix}/${slug}`, keepParams = {} }: {
  area: any; listingsRes: any; profile: any; areaList: any; siteId: string; slug: string; theme: any; basePrefix: string
  homesParams: CommunityHomesParams; selfPath?: string; keepParams?: Record<string, string>
}) {
  const { homesLimit, sort } = townHomesQuery(homesParams)
  const inventory = listingsRes?.listings || []
  const inventoryTotal: number = listingsRes?.total || 0

  const facts = area.facts || {}
  const demographics = facts.demographics as Record<string, any> | undefined
  const marketStats = facts.market_stats as Record<string, any> | undefined
  // Prefers the AI-curated public_schools section (real district/school counts) once an area has
  // been researched under the new pipeline; falls back to the old raw NCES list for an area that
  // hasn't been re-researched yet, so the hero/quick-facts stat never just disappears.
  const curatedSchools = facts.public_schools
  const schoolCount = curatedSchools
    ? (curatedSchools.elementary_schools?.length || 0) + (curatedSchools.middle_schools?.length || 0) + (curatedSchools.high_schools?.length || 0)
    : (Array.isArray(facts.schools) ? facts.schools.length : (facts.schools?.items?.length || 0))
  // Whether this area has been researched under the new AI pipeline at all (see
  // area_research_service.py) - if not, the "Everything You Need to Know" grid below falls back
  // to the old raw Places/NCES cards instead of rendering an empty curated grid.
  const hasCuratedResearch = Object.keys(CURATED_CATEGORY_META).some(k => (facts[k]?.entities?.length || 0) > 0) || !!curatedSchools
  const photo = facts.photos?.items?.[0]
  // The header rotates through real homes in this town (the same photo the Neighborhoods card
  // uses first, then current listings) - the researched place photo only when there are none.
  const listPhoto = ((areaList || []) as any[]).find(a => a.slug === slug)?.photo as string | undefined
  const heroPhotos = Array.from(new Set([listPhoto, ...inventory.map((i: any) => i.photo), photo?.url ? resolveMediaUrl(photo.url) : null].filter(Boolean))).slice(0, 6) as string[]
  // Every county the town's homes sit in ("Montgomery and Delaware counties"), or an independent
  // city (Charlottesville, VA is in no county) - backend town_map_service.county_label.
  const countyLabel: string | null = (typeof facts.county_label === 'string' && facts.county_label) || area.county || null
  const countyIsCity = !!countyLabel && /independent city/i.test(countyLabel)
  const areaDescriptor = [
    area.parent_area_name,
    countyLabel === 'Independent city' ? null : countyLabel,
    area.state,
  ].filter(Boolean).join(', ')
  const guideLabel = 'Neighborhood Guide'
  const currentHref = (extra: Record<string, string>) => {
    const merged: Record<string, string> = { ...keepParams, ...(homesParams.homes ? { homes: homesParams.homes } : {}), ...(homesParams.sort ? { sort: homesParams.sort } : {}), ...(homesParams.min_price ? { min_price: homesParams.min_price } : {}), ...(homesParams.max_price ? { max_price: homesParams.max_price } : {}), ...extra }
    return `${selfPath}?${new URLSearchParams(merged).toString()}`
  }

  // ---- What this town actually has, so the menu and page only show real sections.
  const luxe = theme.template !== 'default'
  const townLabel = [area.name, area.state].filter(Boolean).join(', ')
  const prefill = JSON.stringify({ property_of_interest: townLabel })
  // "Get alerts" on a town page (owner, 10/24): straight into the normal Showcase builder, already
  // on the towns step with this town ticked (the agent's other towns + "add a town" still there) -
  // no separate mini flow. Same builder + form pipeline = the same follow-up as every Showcase.
  const townShowcaseHref = `${basePrefix}/create-showcase?town=${encodeURIComponent(townLabel)}`
  const trends = area.market_trends || {}
  const faq = buildTownFaq(area, inventoryTotal)
  const summary = String(area.narrative?.summary || '').trim()
  const summaryLead = firstSentences(summary, 3)
  const summaryRest = summary.slice(summaryLead.length).trim()
  const livingKeys = ['downtown_centers', 'restaurants', 'shopping', 'grocery', 'parks'].filter(k => categoryHasContent(facts, k))
  const legacyFacts = hasCuratedResearch ? [] : Object.entries(FACT_SECTION_LABELS).filter(([key]) => {
    const fact = facts[key]
    const items = fact?.items || (key === 'schools' ? fact : null)
    return key !== 'schools' && Array.isArray(items) && items.length > 0
  })
  const aroundKeys = ['transportation', 'medical'].filter(k => categoryHasContent(facts, k))
  const hasMarket = !!(trends.series?.length && (trends.closed_count || trends.active_count)) || (facts.market_context?.stats?.length || 0) > 0 || !!(area.insights?.gauge || area.insights?.taxes || area.insights?.money_buys)
  const hasSchools = !!facts.public_schools?.districts?.length || schoolCount > 0
  const hasAround = aroundKeys.length > 0 || (livingKeys.length === 0 && !!area.explore_origin) || !!facts.commute?.destinations?.length || !!facts.walk?.rows?.length
  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'homes', label: 'Homes' },
    hasMarket ? { id: 'market', label: 'Market' } : null,
    hasSchools ? { id: 'schools', label: 'Schools' } : null,
    livingKeys.length || legacyFacts.length ? { id: 'living', label: 'Living here' } : null,
    hasAround ? { id: 'around', label: 'Getting around' } : null,
    faq.length ? { id: 'faq', label: 'FAQ' } : null,
  ].filter(Boolean) as { id: string; label: string }[]

  const goodToKnow = [
    facts.downtown_centers?.notes ? { icon: Building2, label: area.area_type === 'neighborhood' ? 'Neighborhood center' : 'Town center', text: firstSentences(facts.downtown_centers.notes, 1) } : null,
    facts.transportation?.notes ? { icon: Train, label: 'Commute', text: firstSentences(facts.transportation.notes, 1) } : null,
    facts.parks?.notes ? { icon: Trees, label: 'Outdoors', text: firstSentences(facts.parks.notes, 1) } : null,
    facts.public_schools?.districts?.length ? { icon: GraduationCap, label: 'Schools', text: `Served by ${facts.public_schools.districts.map((d: any) => /^school district/i.test(d.name) ? `the ${d.name}` : d.name).join(', ')}.` } : null,
  ].filter(Boolean) as { icon: any; label: string; text: string }[]

  const d = demographics || {}
  // A mailing-address town can span townships (Haverford: Lower Merion + Haverford) - say so plainly.
  // At a glance = three tidy parts (user, 10/27 - it was one long list with a run-on townships line):
  // the home numbers as a 2x2 grid, the local governments as share bars, then the place facts.
  const municipalities = ((area.municipalities || []) as { name: string; share: number }[]).filter(m => m?.name)
  const glanceGovLabel = municipalities.length && municipalities.every(m => /township$/i.test(m.name)) ? (municipalities.length > 1 ? 'Townships' : 'Township') : 'Local government'
  const glanceStats = ([
    marketStats?.median_price != null ? ['Median list price', formatCompactPrice(marketStats.median_price)] : null,
    inventoryTotal > 0 ? ['For sale now', String(inventoryTotal)] : null,
    trends.median_sold_price ? ['Median sold · 1 yr', formatCompactPrice(trends.median_sold_price)] : null,
    // Shorter label for the small grid tile
    ((dom) => dom && [/listed/i.test(dom[0]) ? 'Days listed (now)' : 'Days on market', dom[1]])(daysOnMarketStat(marketStats, trends)),
  ].filter(Boolean) as [string, string][])
  const glance = ([
    // Says which area the count is for - "Malvern borough" is far smaller than the Malvern mailing area this page covers.
    // A city neighborhood isn't a town of its own (grader 10/27: the Philadelphia pages read as towns).
    area.area_type === 'neighborhood' && area.parent_area_name ? ['Neighborhood of', `${area.parent_area_name}, ${area.state}`] : null,
    d.population?.value ? [d.population.label ? `Population (${d.population.label})` : 'Population', Math.round(d.population.value).toLocaleString()] : null,
    // No age / income / who-owns rows - describing residents is off-limits under Fair Housing.
    countyLabel ? [countyIsCity ? (countyLabel === 'Independent city' ? 'Local government' : 'County / city') : / and |counties$/i.test(countyLabel) ? 'Counties' : 'County', countyLabel] : null,
    facts.walk?.level ? ['Walkability', String(facts.walk.level)] : null,
    // A sample of the area's homes against FEMA's high-risk zones - not any one home's risk.
    facts.flood?.homes_checked ? ['In a FEMA high-risk flood zone', `${facts.flood.high_risk_pct}% of ${Number(facts.flood.homes_checked).toLocaleString()} homes checked`] : null,
  ].filter(Boolean) as [string, string][])
  const hasGlance = glanceStats.length > 0 || glance.length > 0 || municipalities.length > 0

  const faqJsonLd = faq.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  } : null

  const sold = (area.market_sales || []) as any[]
  const soldCard = (item: any) => (
    <ListingCard key={item.listing_key} item={{ ...item, price: item.sold_price ?? item.price, status: 'CLOSED' }} theme={theme} basePrefix={basePrefix} dateLabel={item.sold_date ? `Sold ${new Date(`${String(item.sold_date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Sold'} />
  )
  const btnRound = luxe ? 'rounded-full' : 'rounded-xl'
  const inputStyle = { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-surface)', color: 'var(--site-ink)' }

  return (
    <main>
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }} />}
      {!luxe ? (
        <ClassicPageHero
          eyebrow={guideLabel}
          title={area.name}
          titleTag={areaDescriptor || undefined}
          accent=""
          subtitle={summary ? <span className="line-clamp-3 block">{firstSentences(summary, 1)}</span> : undefined}
          photos={heroPhotos}
          breadcrumb={<><a href={`${basePrefix}/`} className="hover:underline">Home</a> / <a href={`${basePrefix}/neighborhoods`} className="hover:underline">Neighborhoods</a> / <span style={{ color: 'var(--site-ink-soft)' }}>{area.name}</span></>}
          stats={([
            marketStats?.median_price != null ? ['Median list price', `$${Math.round(marketStats.median_price).toLocaleString()}`] : null,
            inventoryTotal > 0 ? ['Homes for sale', String(inventoryTotal)] : null,
            daysOnMarketStat(marketStats, trends),
            schoolCount > 0 ? ['Schools', String(schoolCount)] : null,
          ].filter(Boolean) as [string, string][]).map(([label, value]) => ({ label, value }))}
        >
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#homes" className="inline-flex rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm transition hover:-translate-y-0.5" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>See homes for sale</a>
            <a href={townShowcaseHref}
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-3.5 text-sm font-bold transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)', backgroundColor: 'var(--site-surface)' }}>
              <Bell className="h-4 w-4" style={{ color: 'var(--site-accent)' }} /> Get new-listing alerts
            </a>
          </div>
        </ClassicPageHero>
      ) : (
      <div className="relative flex min-h-[78vh] items-end overflow-hidden bg-gray-900 px-6 pb-12 pt-32 text-white sm:pb-14" style={{ backgroundColor: theme.primary_color }}>
        <CinematicHeroBackground photos={heroPhotos} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${theme.secondary_color}, transparent)` }} />
        <div className="relative mx-auto w-full max-w-6xl">
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            <a href={`${basePrefix}/`} className="hover:text-white">Home</a> /
            <a href={`${basePrefix}/neighborhoods`} className="hover:text-white">Neighborhoods</a> /
            <span className="text-white/85">{area.name}</span>
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0" style={{ color: theme.secondary_color }} />
            <span className="h-px w-8" style={{ backgroundColor: theme.secondary_color }} />
            <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: theme.secondary_color }}>{guideLabel}</span>
          </div>
          {/* The county / state rides on the town's own line, small - not a second line under it. */}
          <h1 className={`ohp-site-heading mt-4 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight sm:text-8xl ${fontClass(theme.heading_font, 'font-serif')}`}>
            <span className="ohp-text-shimmer">{area.name}</span>
            {areaDescriptor && <span className="ml-4 inline-flex items-center gap-1.5 align-middle font-sans text-sm font-bold uppercase tracking-[0.18em] text-white/70 sm:text-base"><MapPin className="h-4 w-4" style={{ color: theme.secondary_color }} />{areaDescriptor}</span>}
          </h1>
          {summary && <p className="mt-5 line-clamp-3 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">{firstSentences(summary, 1)}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#homes" className="ohp-gold-sheen inline-flex rounded-full px-7 py-3.5 text-xs font-black uppercase tracking-widest shadow-xl transition hover:-translate-y-0.5" style={{ backgroundColor: theme.secondary_color, color: theme.primary_color }}>
              See homes for sale
            </a>
            <a href={townShowcaseHref}
              className="inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3.5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-white/10">
              <Bell className="h-3.5 w-3.5" /> Get new-listing alerts
            </a>
          </div>
          {glance.length > 0 && (
            <dl className="mt-10 grid grid-cols-2 overflow-hidden rounded-[22px] border border-white/15 bg-white/[0.07] sm:flex sm:divide-x sm:divide-white/10">
              {([
                marketStats?.median_price != null ? ['Median list price', `$${Math.round(marketStats.median_price).toLocaleString()}`] : null,
                inventoryTotal > 0 ? ['Homes for sale', String(inventoryTotal)] : null,
                daysOnMarketStat(marketStats, trends),
                schoolCount > 0 ? ['Schools', String(schoolCount)] : null,
              ].filter(Boolean) as [string, string][]).map(([label, value]) => (
                <div key={label} className="flex-1 px-5 py-4">
                  <dd className={`text-2xl font-black leading-none sm:text-[1.7rem] ${fontClass(theme.heading_font, 'font-serif')}`}>{value}</dd>
                  <dt className="mt-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/55">{label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
        {/* See SiteChrome's IntersectionObserver - marks exactly where this hero ends. */}
        <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </div>
      )}

      <TownSectionNav sections={sections} luxe={luxe} />

      {/* Overview - the town in a few sentences, what's good to know, the numbers at a glance and
          the agent who knows it. */}
      <TownSection id="overview">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.45fr_1fr]">
          <div className="min-w-0">
            <TownHeading luxe={luxe} eyebrow="Overview" title={`Living in ${area.name}`} />
            {summaryLead ? (
              <>
                <p className="ohp-site-body mt-5 text-[17px] leading-[1.75]" style={{ color: 'var(--site-ink-soft)' }}>{summaryLead}</p>
                {summaryRest && (
                  <TownMore label="Keep reading">
                    <p className="ohp-site-body text-[17px] leading-[1.75]" style={{ color: 'var(--site-ink-soft)' }}>{summaryRest}</p>
                  </TownMore>
                )}
              </>
            ) : (
              <p className="mt-5 text-[15px] leading-relaxed" style={{ color: 'var(--site-muted)' }}>A full guide to {area.name} is on its way - in the meantime, ask me anything about living here.</p>
            )}
            {goodToKnow.length > 0 && (
              <div className="mt-8">
                <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-muted)' }}>Good to know</p>
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {goodToKnow.map(g => (
                    <li key={g.label} className={`flex gap-3 border p-4 ${luxe ? 'rounded-[20px]' : 'rounded-xl'}`} style={TOWN_CARD_STYLE}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}><g.icon className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black" style={{ color: 'var(--site-heading)' }}>{g.label}</p>
                        <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>{g.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <aside className="min-w-0 space-y-5">
            {hasGlance && (
              <div className={`border p-6 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
                <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--site-accent-text)' }}>{area.name} at a glance</p>
                {glanceStats.length > 0 && (
                  <div className={`mt-4 grid grid-cols-2 gap-px overflow-hidden ${luxe ? 'rounded-2xl' : 'rounded-xl'}`} style={{ backgroundColor: 'var(--site-line)' }}>
                    {glanceStats.map(([label, value]) => (
                      <div key={label} className="px-3 py-3" style={{ backgroundColor: 'var(--site-surface)' }}>
                        <p className={`text-xl font-black leading-none ${fontClass(theme.heading_font, 'font-serif')}`} style={{ color: 'var(--site-heading)' }}>{value}</p>
                        <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: 'var(--site-faint)' }}>{label}</p>
                      </div>
                    ))}
                  </div>
                )}
                {municipalities.length > 0 && <TownGovShares label={glanceGovLabel} items={municipalities} />}
                {glance.length > 0 && (
                  <dl className="mt-4 divide-y" style={{ borderColor: 'var(--site-line)' }}>
                    {glance.map(([label, value]) => <TownGlanceRow key={label} label={label} value={value} />)}
                  </dl>
                )}
                <p className="mt-4 text-[10px] font-semibold leading-relaxed" style={{ color: 'var(--site-muted)' }}>Home numbers update live from the MLS. People numbers: U.S. Census (ACS).</p>
              </div>
            )}
            {profile?.name && (
              <div className={`flex items-center gap-4 border p-5 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
                {profile.photo_url && <img src={sizedImage(resolveMediaUrl(profile.photo_url), 128)} loading="lazy" decoding="async" alt={profile.name} className="h-14 w-14 shrink-0 rounded-full object-cover" style={{ boxShadow: '0 0 0 3px var(--site-surface), 0 0 0 4px var(--site-accent)' }} />}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold" style={{ color: 'var(--site-muted)' }}>Your {area.name} expert</p>
                  <p className="truncate text-[15px] font-black" style={{ color: 'var(--site-heading)' }}>{profile.name}</p>
                  <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title={`Ask about ${area.name}`} data-ohp-prefill={prefill}
                    className="mt-1 inline-flex items-center gap-1 text-[13px] font-black" style={{ color: 'var(--site-accent-text)' }}>
                    <MessageCircle className="h-3.5 w-3.5" /> Ask me about {area.name}
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>
        <TownMap data={facts.boundaries} town={area.name} luxe={luxe} />
      </TownSection>

      {/* Homes - the agent's own listings, everything for sale (live, full MLS), open houses and
          what recently sold. */}
      <TownSection id="homes" alt>
        <TownHeading
          luxe={luxe}
          eyebrow="Homes"
          title={`Homes for sale in ${area.name}`}
          sub={inventoryTotal > 0 ? `${inventoryTotal} on the market right now - updated live from the MLS.` : 'Updated live from the MLS.'}
          right={
            <form method="GET" action={`${selfPath}#homes`} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {Object.entries(keepParams).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <input type="hidden" name="homes" value={String(homesLimit)} />
              <input type="text" inputMode="numeric" name="min_price" defaultValue={homesParams.min_price || ''} placeholder="Min $" aria-label="Minimum price" className={`w-[5.5rem] flex-1 border px-3 py-2.5 text-xs font-semibold outline-none sm:flex-none ${btnRound}`} style={inputStyle} />
              <input type="text" inputMode="numeric" name="max_price" defaultValue={homesParams.max_price || ''} placeholder="Max $" aria-label="Maximum price" className={`w-[5.5rem] flex-1 border px-3 py-2.5 text-xs font-semibold outline-none sm:flex-none ${btnRound}`} style={inputStyle} />
              <select name="sort" defaultValue={sort} aria-label="Sort" className={`flex-1 border px-3 py-2.5 text-xs font-semibold outline-none sm:flex-none ${btnRound}`} style={inputStyle}>
                <option value="newest">Newest</option>
                <option value="price_desc">Price: high to low</option>
                <option value="price_asc">Price: low to high</option>
              </select>
              <button type="submit" className={`px-5 py-2.5 text-xs font-black ${btnRound}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Apply</button>
            </form>
          }
        />

        {area.my_listings?.length > 0 && (
          <div className="mt-10">
            <TownSubheading count={area.my_listings.length}>{profile?.name ? `Listed by ${profile.name}` : 'My listings'}</TownSubheading>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {area.my_listings.map((item: any) => <HomeCard key={item.listing_key} listing={item} theme={theme} basePrefix={basePrefix} />)}
            </div>
          </div>
        )}

        <div className="mt-10">
          {area.my_listings?.length > 0 && <TownSubheading count={inventoryTotal}>Everything for sale</TownSubheading>}
          {inventory.length > 0 ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {inventory.map((item: any) => <HomeCard key={item.listing_key} listing={item} theme={theme} basePrefix={basePrefix} />)}
              </div>
              <div className="mt-8 flex flex-col items-center gap-3">
                {homesLimit < 48 && inventoryTotal > homesLimit && (
                  <a href={`${currentHref({ homes: String(Math.min(homesLimit + 12, 48)) })}#homes`} className={`inline-flex border-2 px-8 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ borderColor: 'var(--site-heading)', color: 'var(--site-heading)' }}>
                    Show more homes ({inventoryTotal - homesLimit} more)
                  </a>
                )}
                {homesLimit >= 48 && inventoryTotal > 48 && (
                  <p className="text-center text-xs" style={{ color: 'var(--site-muted)' }}>Showing 48 of {inventoryTotal} homes - narrow the price above, or <a href={`${basePrefix}/search?city=${encodeURIComponent(area.name)}`} className="font-bold underline">search them all on the map</a>.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-6 text-sm" style={{ color: 'var(--site-muted)' }}>Nothing matches these filters right now - get an alert the moment something does.</p>
          )}
        </div>

        {/* Alerts - the reason to come back. */}
        <div className={`mt-10 flex flex-col items-start gap-4 border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
          <div className="flex items-start gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center ${luxe ? 'rounded-full' : 'rounded-xl'}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}><Bell className="h-5 w-5" /></span>
            <div>
              <p className="text-lg font-black" style={{ color: 'var(--site-heading)' }}>Be first to see new homes in {area.name}</p>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--site-muted)' }}>Tell me what you want - matching homes come to you the day they list, in your own private Showcase.</p>
            </div>
          </div>
          <a href={townShowcaseHref}
            className={`inline-flex shrink-0 items-center gap-2 px-6 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            Set up my alerts <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {area.open_houses?.length > 0 && (
          <div className="mt-12">
            <TownSubheading count={area.open_houses.length}>Upcoming open houses</TownSubheading>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {area.open_houses.map((item: any) => (
                <ListingCard key={item.id} item={item} theme={theme} basePrefix={basePrefix} dateLabel={item.scheduled_date ? new Date(item.scheduled_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined} />
              ))}
            </div>
          </div>
        )}

        {sold.length > 0 && (
          <div className="mt-12">
            <TownSubheading>Recently sold</TownSubheading>
            <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>What homes here really sell for - the latest closed sales across the MLS.</p>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{sold.slice(0, 3).map(soldCard)}</div>
            {sold.length > 3 && (
              <TownMore label={`See ${sold.length - 3} more sales`}>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{sold.slice(3).map(soldCard)}</div>
              </TownMore>
            )}
          </div>
        )}

        {area.sales?.length > 0 && (
          <div className="mt-12">
            {/* "Recent" only under $50M in sales (sales_wording) - same rule as the Agent Hub. */}
            <TownSubheading count={area.sales.length}>{profile?.sales_recent === false ? `My sales in ${area.name}` : `My recent sales in ${area.name}`}</TownSubheading>
            {profile?.name && <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>Homes {profile.name.split(' ')[0]} sold right here.</p>}
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {area.sales.slice(0, 3).map((item: any) => <ListingCard key={item.id} item={item} theme={theme} basePrefix={basePrefix} />)}
            </div>
            {/* More than 3: "View all" opens the Agent Hub's sales page inside the site (/sales),
                filtered to this town, with a Back that returns here (user, 10/27). */}
            {area.sales.length > 3 && profile?.agent_hub_slug ? (
              <a href={`${basePrefix}/sales?town=${encodeURIComponent(area.name)}&from=${encodeURIComponent(selfPath)}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black transition hover:-translate-y-0.5"
                style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
                View all my sales in {area.name} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : area.sales.length > 3 && (
              <TownMore label={`See ${area.sales.length - 3} more`}>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {area.sales.slice(3).map((item: any) => <ListingCard key={item.id} item={item} theme={theme} basePrefix={basePrefix} />)}
                </div>
              </TownMore>
            )}
          </div>
        )}
      </TownSection>

      {/* Market - a year of closed sales, then outside research folded away. */}
      {hasMarket && (
        <TownSection id="market">
          <TownHeading luxe={luxe} eyebrow="Market" title={`What homes in ${area.name} sell for`}
            right={profile?.name ? (
              <a href={`${basePrefix}/contact`} data-ohp-form="home_value" data-ohp-form-title={`What's my ${area.name} home worth?`} data-ohp-prefill={prefill}
                className={`inline-flex items-center gap-2 border px-5 py-2.5 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>
                <Home className="h-4 w-4" style={{ color: 'var(--site-accent)' }} /> What&apos;s my home worth?
              </a>
            ) : undefined} />
          {/* Thin MLS coverage (Charlottesville): the sales numbers are off - say why, plainly. */}
          {area.market_coverage?.note && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--site-muted)' }}>{area.market_coverage.note}</p>
          )}
          <TownInsights data={area.insights} town={area.name} luxe={luxe} />
          <div className="mt-6"><MarketTrendsSection trends={area.market_trends} theme={theme} areaName={area.name} bare /></div>
          {(facts.market_context?.stats?.length || 0) > 0 && (
            <TownMore label={`What outside research says (${facts.market_context.stats.length})`}>
              <p className="text-xs" style={{ color: 'var(--site-muted)' }}>From outside sources, not live MLS data - each figure has its own source and date.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {facts.market_context.stats.map((s: any, i: number) => (
                  <div key={i} className={`border p-5 ${luxe ? 'rounded-[20px]' : 'rounded-xl'}`} style={TOWN_CARD_STYLE}>
                    <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>{s.label}</p>
                    <p className="mt-1 text-2xl font-black" style={{ color: 'var(--site-heading)' }}>{s.value}</p>
                    <p className="mt-2 text-[11px]" style={{ color: 'var(--site-muted)' }}>{s.geography} · {s.time_period}</p>
                    {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--site-accent-text)' }}>Source <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                ))}
              </div>
            </TownMore>
          )}
        </TownSection>
      )}

      {hasSchools && (
        <TownSection id="schools" alt>
          <TownHeading luxe={luxe} eyebrow="Schools" title={`Schools in ${area.name}`} sub="Public districts and schools by level, plus private options nearby." />
          <TownSchools facts={facts} name={area.name} luxe={luxe} state={area.state} />
        </TownSection>
      )}

      {(livingKeys.length > 0 || legacyFacts.length > 0) && (
        <TownSection id="living">
          <TownHeading luxe={luxe} eyebrow="Living here" title={`Day-to-day life in ${area.name}`} sub="Where people eat, shop, get groceries and get outside." />
          {livingKeys.length > 0 && (
            <TownLiving town={area.name} state={area.state} luxe={luxe}
              map={area.explore_origin ? { siteId, slug, origin: area.explore_origin, accent: theme.secondary_color || '#C9A24D' } : null}
              categories={livingKeys.map(k => ({
              key: k, label: CURATED_CATEGORY_META[k]?.label || k, notes: facts[k]?.notes || null,
              items: categoryEntities(facts[k]).map(e => ({ name: e.name, category: e.category, city: e.where || e.city, distance_miles: e.distance_miles, description: e.description, source_url: e.source_url })),
            }))} />
          )}
          <div className="mt-8 gap-5 lg:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
            {legacyFacts.map(([key, label]) => {
              const items = facts[key]?.items || []
              return (
                <FactCard key={key} label={label} source={facts[key]?.source} icon={FACT_SECTION_ICONS[key]} theme={theme}>
                  <ul className="space-y-1">{items.slice(0, 6).map((item: any, i: number) => <li key={i}>{item.name}</li>)}</ul>
                </FactCard>
              )
            })}
          </div>
        </TownSection>
      )}

      {hasAround && (
        <section id="around" className="ohp-town-section scroll-mt-32 px-5 py-14 sm:px-6 sm:py-20" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
          {(aroundKeys.length > 0 || facts.commute?.destinations?.length > 0) && (
            <div className="mx-auto max-w-6xl">
              <TownHeading luxe={luxe} eyebrow="Getting around" title="Commute, transit & care" sub={`How people get to work from ${area.name}, and the hospitals and doctors close by.`} />
              <TownCommute data={facts.commute} town={area.name} luxe={luxe} />
              <TownWalk data={facts.walk} town={area.name} luxe={luxe} />
              <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {aroundKeys.map(k => <TownPlaceCard key={k} categoryKey={k} data={facts[k]} luxe={luxe} state={area.state} />)}
              </div>
            </div>
          )}
          {/* The amenity map lives in Day-to-day life now (TownLiving's map) - this box only for a
              town with no day-to-day research to hang it on. */}
          {livingKeys.length === 0 && <div className={`mx-auto max-w-6xl ${aroundKeys.length ? 'mt-6' : ''}`}>
            <ExploreNearby
              siteId={siteId}
              kind="area"
              slug={slug}
              title={`Explore around ${area.name}`}
              originLabel={area.name}
              origin={area.explore_origin}
              theme={theme}
              embedded
            />
          </div>}
        </section>
      )}

      {faq.length > 0 && (
        <TownSection id="faq">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <TownHeading luxe={luxe} eyebrow="FAQ" title={`${area.name} questions, answered`} sub="The things people ask most before moving here." />
              <a href={`${basePrefix}/contact`} data-ohp-form="how_can_i_help" data-ohp-form-title={`Ask about ${area.name}`} data-ohp-prefill={prefill}
                className={`mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                <MessageCircle className="h-4 w-4" /> Ask your own question
              </a>
            </div>
            <div className="divide-y border-y" style={{ borderColor: 'var(--site-line)' }}>
              {faq.map((f, i) => (
                <details key={f.q} className="group/faq py-1" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-black sm:text-base [&::-webkit-details-marker]:hidden" style={{ color: 'var(--site-heading)' }}>
                    {f.q}
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center transition group-open/faq:rotate-45 ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'rgba(var(--site-accent-rgb),0.12)', color: 'var(--site-accent)' }}><Plus className="h-4 w-4" /></span>
                  </summary>
                  <div className="pb-5 pr-10 text-[15px] leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>
                    <p>{f.a}</p>
                    {f.source && (f.source.url
                      ? <a href={f.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--site-accent-text)' }}>Source: {f.source.name} <ExternalLink className="h-3 w-3" /></a>
                      : <p className="mt-2 text-xs font-bold" style={{ color: 'var(--site-muted)' }}>Source: {f.source.name}</p>)}
                    {i === faq.length - 1 && (
                      <a href={townShowcaseHref}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-black" style={{ color: 'var(--site-accent-text)' }}>
                        Set up my alerts <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </TownSection>
      )}

      {/* Nearby towns - each with a one-tap side-by-side compare. */}
      {area.related_areas?.length > 0 && (
        <TownSection id="nearby" alt>
          <TownHeading luxe={luxe} eyebrow="Nearby" title={`Also near ${area.name}`} sub="Weighing a few towns? Compare any two side by side." />
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {area.related_areas.map((related: any) => (
              <div key={related.slug} className={`group overflow-hidden border transition hover:-translate-y-1 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'}`} style={TOWN_CARD_STYLE}>
                <a href={`${basePrefix}/${related.slug}`} className="block">
                  <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    <SitePhoto src={resolveMediaUrl(related.photo)} widths={IMG.card} className="ohp-mls-crop h-full w-full transition-transform duration-700 group-hover:scale-105 object-cover" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <p className="absolute bottom-3 left-4 text-xl font-black text-white">{related.name}{related.state ? `, ${related.state}` : ''}</p>
                  </div>
                </a>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs font-bold" style={{ color: 'var(--site-muted)' }}>{related.median_price != null ? `$${related.median_price.toLocaleString()} median` : 'Neighborhood guide'}</span>
                  <a href={`${basePrefix}/neighborhoods/compare?areas=${encodeURIComponent(`${slug},${related.slug}`)}`} className="text-xs font-black" style={{ color: 'var(--site-accent-text)' }}>Compare →</a>
                </div>
              </div>
            ))}
          </div>
        </TownSection>
      )}

      {/* Close - the agent, and the three things a guest might want next. */}
      <section id="contact" className="scroll-mt-32 px-5 py-16 sm:px-6 sm:py-20">
        <div className={`relative mx-auto max-w-6xl overflow-hidden p-7 sm:p-12 ${luxe ? 'rounded-[28px]' : 'rounded-3xl'}`} style={{ backgroundColor: luxe ? theme.primary_color : 'var(--site-accent-deep)' }}>
          {heroPhotos[0] && <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.16]" style={{ backgroundImage: sizedBg(heroPhotos[0], 1920) }} />}
          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: luxe ? theme.secondary_color : 'rgba(255,255,255,0.7)' }}>Thinking about {area.name}?</p>
              <h2 className={`ohp-site-heading mt-2 text-3xl font-black leading-tight text-white sm:text-[2.6rem] ${luxe ? fontClass(theme.heading_font, 'font-serif') : ''}`}>Let&apos;s find your place here</h2>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/75">Buying or selling in {area.name}, I&apos;ll walk you through the streets, the schools and the numbers - no pressure.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href={`${basePrefix}/contact`} data-ohp-form="buying" data-ohp-form-title={`Buying in ${area.name}`} data-ohp-prefill={prefill}
                  className={`inline-flex px-6 py-3 text-sm font-black transition hover:-translate-y-0.5 ${btnRound} ${luxe ? 'ohp-gold-sheen' : ''}`} style={luxe ? { backgroundColor: theme.secondary_color, color: theme.primary_color } : { backgroundColor: '#ffffff', color: 'var(--site-accent-deep)' }}>I&apos;m buying</a>
                <a href={`${basePrefix}/contact`} data-ohp-form="selling" data-ohp-form-title={`Selling in ${area.name}`} data-ohp-prefill={prefill}
                  className={`inline-flex border border-white/40 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10 ${btnRound}`}>I&apos;m selling</a>
                {profile?.phone && <a href={`tel:${profile.phone}`} className={`inline-flex border border-white/40 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10 ${btnRound}`}>Call {profile.phone}</a>}
              </div>
            </div>
            {profile?.name && (
              <div className="flex items-center gap-4 lg:justify-end">
                {profile.photo_url && <img src={sizedImage(resolveMediaUrl(profile.photo_url), 256)} loading="lazy" decoding="async" alt={profile.name} className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white/20" />}
                <div className="min-w-0">
                  <p className="text-lg font-black text-white">{profile.name}</p>
                  {profile.brokerage && <p className="text-xs font-semibold text-white/60">{profile.brokerage}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
