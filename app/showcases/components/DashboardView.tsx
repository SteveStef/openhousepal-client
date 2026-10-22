'use client'

import { useState, useMemo, memo, forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Collection, Property } from '@/types'
import { Share2, Edit3, Trash2, Mail, Phone, Check, Copy, Users, Search, MapPin, X, Calendar, Heart, ThumbsDown, MessageSquare, Inbox, BedDouble, Bath, Ruler, Trees, Sparkles, Clock, Eye, Wallet, CheckCircle2, Home as HomeIcon, Star, Moon, ArrowUpDown } from 'lucide-react'
import { formatRelativeDay } from '@/lib/relativeDays'
import LuxeHero from '@/components/ui/LuxeHero'
import { copyText } from '@/lib/copyText'
import LuxeSelect, { type LuxeOption } from '@/components/ui/LuxeSelect'
import AnimatedNumber from '@/components/ui/AnimatedNumber'

// Icon + color per cycling activity type, matching the sentiment of each (green=positive,
// red=negative, blue=neutral/informational).
const ACTIVITY_STYLES: Record<string, { icon: typeof Heart; color: string }> = {
  LIKE: { icon: Heart, color: 'bg-green-500' },
  DISLIKE: { icon: ThumbsDown, color: 'bg-red-500' },
  PROPERTY_COMMENT: { icon: MessageSquare, color: 'bg-blue-500' },
}

const formatLocation = (name: string) => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Cities/counties picked via the Showcase Request form's autocomplete come back as "Name, ST"
// (e.g. "Ardmore, PA") since that's what disambiguates same-named places in the picker - but that
// state suffix doesn't belong in this card's location line, and showcases built other ways never
// had it in the first place, so strip it here rather than depending on every writer to omit it.
const stripStateSuffix = (name: string) => name.replace(/,\s*[A-Za-z]{2}$/, '').trim()

const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50',
    'bg-emerald-50 text-green-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50',
    'bg-violet-50 text-purple-700 border-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-900/50',
    'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50',
    'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50',
    'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-900/50',
    'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-900/50',
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
  }
}

// Most recent 4 new matches first (matching the same "new since dismissed" rule as the New
// Matches count), ranked within that by when they were actually added to this showcase -
// falling back to MLS list date for the original properties a showcase started with, which
// never get an AddedToCollectionAt stamp. Pads out with the next-most-recent properties so
// the strip stays full even when a showcase has fewer than 4 new matches.
const getPreviewProperties = (collection: Collection) => {
  const properties = collection.matchedProperties || []
  const recency = (p: Property) => {
    const added = p.AddedToCollectionAt ? new Date(p.AddedToCollectionAt).getTime() : 0
    const listed = p.MLSListDate ? new Date(p.MLSListDate).getTime() : 0
    return Math.max(added, listed)
  }
  return [...properties]
    .sort((a, b) => {
      const aNew = a.is_new ? 1 : 0
      const bNew = b.is_new ? 1 : 0
      if (aNew !== bNew) return bNew - aNew
      return recency(b) - recency(a)
    })
    .slice(0, 3)
}

// Beds/baths come from the visitor's stated preferences; sqft/acreage aren't stored as a
// preference range, so approximate them from the actual matched properties' specs instead.
// Search beds / baths: 0 means "no limit" (never "3-0" / "0.0"); a minimum alone reads "3+".
const formatRange = (min?: number | null, max?: number | null, decimals = 0) => {
  const lo = min || null, hi = max || null
  const f = (v: number) => (decimals && v % 1 ? v.toFixed(decimals) : String(v))
  if (lo == null && hi == null) return null
  if (lo != null && hi != null) return lo === hi ? f(lo) : `${f(lo)}-${f(hi)}`
  return lo != null ? `${f(lo)}+` : `Up to ${f(hi as number)}`
}

// "2500" -> "2,500" - sqft gets large enough that the comma is the difference between reading
// it and not.
// Compact once it's big (user, 10/17 - long numbers pushed the lot size off the card on phones):
// 13,062 -> "13K", 2,540 stays "2,540".
const formatSqftValue = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}K` : Math.round(v).toLocaleString())
const formatSqftRange = (min?: number | null, max?: number | null) => {
  if (min == null && max == null) return null
  // A range is always short: "2.5K-13K" (two full numbers never fit the chip on a phone).
  const k = (v: number) => (v >= 1000 ? `${v >= 10000 ? Math.round(v / 1000) : (v / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(Math.round(v)))
  if (min != null && max != null && min !== max) return `${k(min)}-${k(max)}`
  return formatSqftValue((min ?? max) as number)
}

// "0.05" -> ".05" and "1.00" -> "1" - trailing/leading zeros just add clutter at this scale.
// 1 decimal from 1 acre up ("1.44" -> "1.4"), 2 below it (".59").
const formatAcreValue = (v: number) => {
  const s = v >= 1 ? v.toFixed(v >= 10 ? 0 : 1) : v.toFixed(2)
  if (s.startsWith('0.')) return s.slice(1)
  return s.replace(/\.0+$/, '')
}
const formatAcreRange = (min?: number | null, max?: number | null) => {
  if (min == null && max == null) return null
  if (min != null && max != null && min !== max) return `${formatAcreValue(min)}-${formatAcreValue(max)}`
  return formatAcreValue((min ?? max) as number)
}

const getCriteriaStats = (collection: Collection) => {
  const prefs = collection.preferences as any
  const properties = collection.matchedProperties || []
  const sqftValues = properties.map(p => p.LivingArea).filter((v): v is number => !!v)
  const acreageValues = properties
    .map(p => (p.LotSizeSquareFeet ? p.LotSizeSquareFeet / 43560 : null))
    .filter((v): v is number => !!v)

  return {
    beds: formatRange(prefs?.min_beds, prefs?.max_beds),
    baths: formatRange(prefs?.min_baths, prefs?.max_baths, 1),
    sqft: sqftValues.length ? formatSqftRange(Math.min(...sqftValues), Math.max(...sqftValues)) : null,
    acreage: acreageValues.length ? formatAcreRange(Math.min(...acreageValues), Math.max(...acreageValues)) : null,
  }
}

interface DashboardViewProps {
  collections: Collection[];
  isLoading: boolean;
  onCreateClick: () => void;
  onCollectionClick: (collection: Collection) => void;
  onShare: (collection: Collection) => void;
  onEditPreferences: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
  onStatusToggle: (collectionId: string) => void;
  onFavoriteToggle: (collectionId: string) => void;
  onDismissNew: (collectionId: string) => void;
  onPropertyPreviewClick: (collection: Collection, property: Property) => void;
  onOpenTours: (collection: Collection) => void;
  onOpenComments: (collection: Collection) => void;
  formatPriceRange: (priceRange: string) => string;
  // Header inboxes: tour requests waiting on the agent (all Showcases) + unread client activity.
  pendingTourCount: number;
  unreadActivityCount: number;
  onOpenTourInbox: () => void;
  onOpenActivityInbox: () => void;
}

export const DashboardView = memo(function DashboardView({
  collections,
  isLoading,
  onCreateClick,
  onCollectionClick,
  onShare,
  onEditPreferences,
  onDelete,
  onStatusToggle,
  onFavoriteToggle,
  onDismissNew,
  onPropertyPreviewClick,
  onOpenTours,
  onOpenComments,
  formatPriceRange,
  pendingTourCount,
  unreadActivityCount,
  onOpenTourInbox,
  onOpenActivityInbox,
}: DashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  // Active = awake Showcases; Inactive = asleep (no new matches, no emails) - user, 10/22.
  const [tab, setTab] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE')
  const [newOnly, setNewOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('smart')
  const [budgetFilter, setBudgetFilter] = useState('ALL')
  const tabCounts = useMemo(() => ({
    ACTIVE: collections.filter(c => c.status === 'ACTIVE').length,
    INACTIVE: collections.filter(c => c.status !== 'ACTIVE').length,
  }), [collections])
  const newCount = useMemo(() => collections.filter(c => (c.status === 'ACTIVE') === (tab === 'ACTIVE') && c.stats.newProperties > 0).length, [collections, tab])
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleCopy = (e: React.MouseEvent, fieldKey: string, value: string) => {
    e.stopPropagation()
    if (!value) return
    copyText(value).then(() => {
      setCopiedField(fieldKey)
      setTimeout(() => setCopiedField(prev => (prev === fieldKey ? null : prev)), 1500)
    })
  }

  const filteredCollections = useMemo(() => {
    const query = searchTerm.toLowerCase().trim()
    return collections.filter(collection => {
      const prefs = collection.preferences as any

      // Location Filter Logic - cities/townships/school districts, falling back to a city
      // parsed out of the search-center address when none of those are explicitly set.
      let displayLocations: string[] = [
        ...(prefs?.cities || []),
        ...(prefs?.townships || []),
        ...(prefs?.school_districts || [])
      ].map(formatLocation)

      if (displayLocations.length === 0 && prefs?.address) {
        const address = prefs.address;
        const parts = address.split(',');
        if (parts.length >= 2) {
          const cityPart = parts[parts.length - 2].trim();
          if (cityPart) {
            if (cityPart.length === 2 && parts.length >= 3) {
              // We found a state code (e.g. "PA"), look at the segment before it
              const potentialCity = parts[parts.length - 3].trim();

              // If the segment is long (contains street info), take the last word
              if (potentialCity.split(' ').length > 2) {
                const words = potentialCity.split(' ');
                displayLocations = [formatLocation(words[words.length - 1])];
              } else {
                displayLocations = [formatLocation(potentialCity)];
              }
            } else {
              displayLocations = [formatLocation(cityPart)];
            }
          }
        }
      }

      // One unified search box covers visitor name/email, the property this showcase was
      // curated from, the search-center address, and location/school-district - instead of
      // separate "Search Visitor" and "Location" boxes.
      const matchesSearch = query === '' ||
        collection.customer.firstName.toLowerCase().includes(query) ||
        collection.customer.lastName.toLowerCase().includes(query) ||
        collection.customer.email.toLowerCase().includes(query) ||
        (collection.originalProperty?.FullStreetAddress || '').toLowerCase().includes(query) ||
        (prefs?.address || '').toLowerCase().includes(query) ||
        displayLocations.some((l: string) => l.toLowerCase().includes(query))

      // Status Filter
      const matchesStatus = (collection.status === 'ACTIVE') === (tab === 'ACTIVE') && (!newOnly || collection.stats.newProperties > 0)

      // Budget Filter Logic (Numeric Buckets)
      let matchesBudget = true
      if (budgetFilter !== 'ALL') {
        const minPrice = prefs?.min_price || 0
        const maxPrice = prefs?.max_price || Infinity

        if (budgetFilter === 'UNDER_500') {
          matchesBudget = minPrice < 500000
        } else if (budgetFilter === '500_1000') {
          // Overlaps with 500k-1M range
          matchesBudget = minPrice < 1000000 && maxPrice >= 500000
        } else if (budgetFilter === '1000_1500') {
          // Overlaps with 1M-1.5M range
          matchesBudget = minPrice < 1500000 && maxPrice >= 1000000
        } else if (budgetFilter === '1500_2500') {
          // Overlaps with 1.5M-2.5M range
          matchesBudget = minPrice < 2500000 && maxPrice >= 1500000
        } else if (budgetFilter === 'OVER_2500') {
          matchesBudget = maxPrice >= 2500000
        }
      }

      return matchesSearch && matchesStatus && matchesBudget
    })
    .sort((a, b) => {
      // Starred ones always lead (user, 10/22), whatever the sort.
      const fav = (b.favoritedAt ? 1 : 0) - (a.favoritedAt ? 1 : 0)
      if (fav) return fav
      // Recency on whichever is more recent - real visitor activity, or the showcase's own
      // creation. A showcase created today has to outrank one whose last activity was 3 days ago,
      // so this compares actual timestamps instead of "has activity at all" tiers.
      const recent = (c: Collection) => Math.max(c.stats.lastActivity ? new Date(c.stats.lastActivity).getTime() : 0, new Date(c.createdAt).getTime())
      const byRecent = recent(b) - recent(a)
      const byNew = b.stats.newProperties - a.stats.newProperties
      if (sortBy === 'new') return byNew || byRecent
      if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'slept') return new Date(b.inactiveAt || 0).getTime() - new Date(a.inactiveAt || 0).getTime() || byRecent
      // 'smart' (default): most recent client activity, then fresh unseen matches.
      return byRecent || byNew
    })
  }, [collections, searchTerm, tab, newOnly, sortBy, budgetFilter])

  return (
    <div className="flex-1 p-6 pb-20 sm:pb-32">
      <div className="max-w-7xl mx-auto">
        {/* Header - the shared luxe header: search, filters and Create on the right */}
        <LuxeHero
          compact
          className="mb-6"
          asideClassName="lg:w-[460px] lg:-mt-5"
          kicker="Showcases"
          icon={Users}
          title={<>Homes picked <em>for every buyer.</em></>}
          subtitle="Manage customer property showcases and preferences."
          aside={
            <div className="w-full">
            {/* Search + the two inboxes on one row: tour requests waiting on you, and client activity. */}
            <div className="flex w-full items-stretch gap-1.5">
            <div className="relative group min-w-0 flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                <Search size={15} />
              </div>
              <input
                type="text"
                placeholder="Search visitor, property, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-[#151517] border-2 border-gray-200 dark:border-gray-800 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 shadow-sm focus:outline-none focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 transition-all text-sm font-medium"
              />
              <AnimatePresence>
                {searchTerm && (
                  <motion.button type="button" onClick={() => setSearchTerm('')} title="Clear search"
                    initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
                    className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-[#C9A24D]/20 hover:text-[#8b6a2b] dark:bg-gray-800">
                    <X size={11} strokeWidth={3} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            {([
              { key: 'tours', label: 'Tours', icon: Calendar, count: pendingTourCount, onClick: onOpenTourInbox,
                title: 'Tour requests waiting on you, from every Showcase', on: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300', dot: 'bg-red-500' },
              { key: 'activity', label: 'Activity', icon: Inbox, count: unreadActivityCount, onClick: onOpenActivityInbox,
                title: 'Likes, comments, tour requests and search changes from your clients', on: 'border-[#C9A24D]/50 bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]', dot: 'bg-[#C9A24D]' },
            ] as const).map(({ key, label, icon: Icon, count, onClick, title, on, dot }) => (
              <motion.button
                key={key}
                onClick={onClick}
                title={title}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                className={`relative flex w-[52px] flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 shadow-sm transition-colors ${
                  count > 0 ? on : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D]/50 hover:text-[#111827] dark:border-gray-800 dark:bg-[#151517] dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span className="text-[8.5px] font-black uppercase leading-none tracking-wide">{label}</span>
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span key={count} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                      className={`absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full ${dot} px-1 text-center text-[10px] font-black leading-[18px] text-white ring-2 ring-white dark:ring-[#151517]`}>{count}</motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
            </div>
          {/* Filters + Create: same left + right edges as the search row above. */}
          <div className="mt-2 flex w-full flex-wrap items-stretch gap-2 sm:flex-nowrap">
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-[#C9A24D]/30 bg-white/70 px-2.5 py-1 text-[11px] font-black text-[#8b7355] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#e8c97a]">
              <AnimatedNumber value={filteredCollections.length} duration={500} /> {filteredCollections.length === 1 ? 'result' : 'results'}
            </span>
            <LuxeSelect
              className="w-[118px] flex-shrink-0"
              ariaLabel="Filter by budget"
              icon={<Wallet size={12} />}
              value={budgetFilter}
              placeholderValue="ALL"
              onChange={setBudgetFilter}
              menuWidth={210}
              options={BUDGET_OPTIONS}
            />
            <LuxeSelect
              className="w-[120px] flex-shrink-0"
              ariaLabel="Sort Showcases"
              icon={<ArrowUpDown size={12} />}
              value={sortBy}
              placeholderValue="smart"
              onChange={setSortBy}
              menuWidth={220}
              options={tab === 'INACTIVE' ? SORT_OPTIONS : SORT_OPTIONS.filter(o => o.value !== 'slept')}
            />

            {/* Same gradient CTA treatment as the flagship "View Tours" button elsewhere in
                Showcases (DetailView.tsx) - reads as the primary action, not just another filter
                control, while staying compact and in the app's own established theme. */}
            <motion.button
              onClick={onCreateClick}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="lx-shine group relative overflow-hidden basis-full sm:basis-auto sm:flex-1 justify-center px-4 py-2.5 rounded-xl text-[11px] font-black transition-shadow duration-300 flex items-center space-x-2 shadow-md shadow-[#C9A24D]/30 hover:shadow-lg bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[#111827] whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="tracking-widest uppercase">Create</span>
            </motion.button>
          </div>
            </div>
          }
        />

        {/* Active / Inactive (asleep) + new-matches filter */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
            {(['ACTIVE', 'INACTIVE'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); if (t === 'ACTIVE' && sortBy === 'slept') setSortBy('smart') }}
                className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-black transition-colors ${tab === t ? 'text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                {tab === t && <motion.span layoutId="showcase-tab" className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <span className="relative flex items-center gap-1.5">
                  {t === 'INACTIVE' && <Moon size={12} />}
                  {t === 'ACTIVE' ? 'Active' : 'Inactive'}
                  <span className={`rounded-full px-1.5 text-[10px] ${tab === t ? 'bg-white/60' : 'bg-gray-100 dark:bg-gray-800'}`}>{tabCounts[t]}</span>
                </span>
              </button>
            ))}
          </div>
          <button onClick={() => setNewOnly(v => !v)} aria-pressed={newOnly}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-black transition-colors ${newOnly ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-green-400 hover:text-green-700 dark:border-gray-800 dark:bg-[#151517] dark:text-gray-300'}`}>
            <Sparkles size={12} /> New matches
            <span className={`rounded-full px-1.5 text-[10px] ${newOnly ? 'bg-white/25' : 'bg-gray-100 dark:bg-gray-800'}`}>{newCount}</span>
          </button>
        </div>
        {tab === 'INACTIVE' && (
          <p className="-mt-2 mb-5 flex items-start gap-2 text-[12px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
            <Moon size={13} className="mt-0.5 shrink-0 text-[#C9A24D]" />
            Asleep: no new matches and no emails. A Showcase falls asleep when the client ignores 3 weekly emails in a row, or when you switch it off. It wakes up by itself if they open it again, or you can switch it back on.
          </p>
        )}

        {/* Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="overflow-hidden rounded-[22px] border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]">
                <div className="h-44 animate-pulse bg-gray-100 dark:bg-[#0B0B0B]" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCollections.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24 bg-white/50 dark:bg-[#151517]/50 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            {collections.length === 0 ? (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No Showcases yet</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Guests who sign in at your open houses get one automatically. You can also make one for any client.</p>
                <button onClick={onCreateClick} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black dark:bg-white dark:text-[#111827]">+ Create a Showcase</button>
              </>
            ) : tab === 'INACTIVE' && tabCounts.INACTIVE === 0 ? (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Nothing asleep</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Every Showcase is awake and updating.</p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No showcases found</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Try adjusting your filters.</p>
                <button onClick={() => { setSearchTerm(''); setBudgetFilter('ALL'); setNewOnly(false) }} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#C9A24D]/40 px-5 py-2.5 text-sm font-bold text-[#8b6a2b] transition hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">Clear filters</button>
              </>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnimatePresence initial={false} mode="popLayout">
              {filteredCollections.map((collection, index) => (
                <ShowcaseCard
                  key={collection.id}
                  collection={collection}
                  index={index}
                  onCollectionClick={onCollectionClick}
                  onShare={onShare}
                  onEditPreferences={onEditPreferences}
                  onDelete={onDelete}
                  onStatusToggle={onStatusToggle}
                  onFavoriteToggle={onFavoriteToggle}
                  onDismissNew={onDismissNew}
                  onPropertyPreviewClick={onPropertyPreviewClick}
                  onOpenTours={onOpenTours}
                  onOpenComments={onOpenComments}
                  formatPriceRange={formatPriceRange}
                  copiedField={copiedField}
                  onCopy={handleCopy}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
})

const BUDGET_OPTIONS: LuxeOption<string>[] = [
  { value: 'ALL', label: 'Budgets', hint: 'Every price range' },
  { value: 'UNDER_500', label: 'Under $500K' },
  { value: '500_1000', label: '$500K - $1M' },
  { value: '1000_1500', label: '$1M - $1.5M' },
  { value: '1500_2500', label: '$1.5M - $2.5M' },
  { value: 'OVER_2500', label: '$2.5M+' },
]

type SortKey = 'smart' | 'new' | 'created' | 'slept'
// Starred Showcases lead in every sort.
const SORT_OPTIONS: LuxeOption<SortKey>[] = [
  { value: 'smart', label: 'Activity', hint: 'Starred, then latest client activity, then new matches' },
  { value: 'new', label: 'New matches', hint: 'Most new homes first' },
  { value: 'created', label: 'Newest', hint: 'Most recently made' },
  { value: 'slept', label: 'Fell asleep', hint: 'Most recently asleep first' },
]

// "$1,250,000" -> "$1.25M", "$649,900" -> "$650K" - the photo tiles are small.
const shortPrice = (v?: number | null) => {
  if (!v) return null
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')}M`
  return `$${Math.round(v / 1000)}K`
}
const niceStreet = (s?: string | null) => {
  const street = (s || '').split(',')[0].trim()
  return street === street.toUpperCase() ? street.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : street
}

interface ShowcaseCardProps {
  collection: Collection;
  index: number;
  onCollectionClick: (collection: Collection) => void;
  onShare: (collection: Collection) => void;
  onEditPreferences: (collection: Collection) => void;
  onDelete: (collection: Collection) => void;
  onStatusToggle: (collectionId: string) => void;
  onFavoriteToggle: (collectionId: string) => void;
  onDismissNew: (collectionId: string) => void;
  onPropertyPreviewClick: (collection: Collection, property: Property) => void;
  onOpenTours: (collection: Collection) => void;
  onOpenComments: (collection: Collection) => void;
  formatPriceRange: (priceRange: string) => string;
  copiedField: string | null;
  onCopy: (e: React.MouseEvent, fieldKey: string, value: string) => void;
}

const ShowcaseCard = memo(forwardRef<HTMLElement, ShowcaseCardProps>(function ShowcaseCard({
  collection,
  index,
  onCollectionClick,
  onShare,
  onEditPreferences,
  onDelete,
  onStatusToggle,
  onFavoriteToggle,
  onDismissNew,
  onPropertyPreviewClick,
  onOpenTours,
  onOpenComments,
  formatPriceRange,
  copiedField,
  onCopy
}, ref) {
  const prefs = collection.preferences as any

  // A school district pick is more specific than a city/township list, so show that instead of
  // (not in addition to) cities/townships when one's set, rather than cramming both in.
  const hasSchoolDistricts = (prefs?.school_districts || []).length > 0
  let displayLocations: string[] = (
    hasSchoolDistricts
      ? prefs.school_districts
      : [...(prefs?.cities || []), ...(prefs?.townships || [])]
  ).map(stripStateSuffix).map(formatLocation)

  if (displayLocations.length === 0 && prefs?.address) {
    // Handle formats like "612 Radnor Valley Drive Villanova, PA, 19085": the city sits just
    // before the state, or is the last word of the street segment.
    const parts = prefs.address.split(',');
    if (parts.length >= 2) {
      const cityPart = parts[parts.length - 2].trim();
      if (cityPart) {
        if (cityPart.length === 2 && parts.length >= 3) {
          const potentialCity = parts[parts.length - 3].trim();
          if (potentialCity.split(' ').length > 2) {
            const words = potentialCity.split(' ');
            displayLocations = [formatLocation(words[words.length - 1])];
          } else {
            displayLocations = [formatLocation(potentialCity)];
          }
        } else {
          displayLocations = [formatLocation(cityPart)];
        }
      }
    }
  }

  const previewProperties = getPreviewProperties(collection)
  const criteria = getCriteriaStats(collection)
  const active = collection.status === 'ACTIVE'

  // Unread like/dislike/comment counts - shown together as icon+count badges, alongside the
  // tour-requested marker and the visitor's "refine my search" message.
  const activityCounts = collection.stats.activityCounts || {}
  const activityBadges = (['LIKE', 'DISLIKE', 'PROPERTY_COMMENT'] as const)
    .map((type) => ({ type, count: activityCounts[type] || 0, ...ACTIVITY_STYLES[type] }))
    .filter((a) => a.count > 0)

  // Showcases auto-built from the "Setup My Own Showcase" QR form get a small provenance tag -
  // "Updated" instead of "Created" if a later matching submission refreshed an existing one
  // (createdAt/updatedAt land within moments of each other on first creation, so a few seconds'
  // gap is enough to tell the two apart).
  const isFormSourced = collection.source === 'form'
  const isUpdatedViaForm = isFormSourced && collection.updatedAt && collection.createdAt &&
    (new Date(collection.updatedAt).getTime() - new Date(collection.createdAt).getTime() > 5000)

  const priceText = (collection.preferences && 'priceRange' in collection.preferences && collection.preferences.priceRange !== 'Not specified')
    ? formatPriceRange(collection.preferences.priceRange)
    : 'Not Specified'
  const needsYou = !!collection.refineRequestMessage || !!collection.stats.tourRequestedCount || activityBadges.length > 0 || collection.stats.newProperties > 0
  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }

  // One large photo + two stacked; with only one or two matches the photos share the space.
  const shownTiles = Math.max(1, Math.min(3, previewProperties.length))
  const span = (i: number) => (shownTiles === 3 && i === 0 ? 'col-span-2 row-span-2' : '')
  const big = (i: number) => i === 0 || shownTiles < 3
  const tile = (property: Property | undefined, i: number) => (
    <div
      key={property?.id ?? `empty-${i}`}
      onClick={property?.is_new ? (e) => { e.stopPropagation(); onPropertyPreviewClick(collection, property) } : undefined}
      className={`group/tile relative overflow-hidden bg-gray-100 dark:bg-[#0B0B0B] ${span(i)}`}
    >
      {property?.ListPictureURL ? (
        <img src={property.ListPictureURL} alt={property.FullStreetAddress || ''} loading="lazy" decoding="async"
          className="block h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-700"><HomeIcon size={big(i) ? 28 : 18} /></div>
      )}
      {property && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
          <div className="pointer-events-none absolute inset-x-2 bottom-1.5 flex items-end justify-between gap-1">
            <span className={`truncate font-bold text-white/90 ${big(i) ? 'text-[11px]' : 'text-[9px]'}`}>{big(i) ? niceStreet(property.FullStreetAddress) : ''}</span>
            {shortPrice(property.ListPrice) && (
              <span className={`shrink-0 rounded-md bg-white/95 font-black text-[#111827] shadow-sm ${big(i) ? 'px-1.5 py-0.5 text-[11px]' : 'px-1 py-px text-[9.5px]'}`}>{shortPrice(property.ListPrice)}</span>
            )}
          </div>
        </>
      )}
      {/* New and not opened by you yet - top middle, so it reads at a glance. */}
      {property?.is_new && (
        <motion.span initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.25 + i * 0.08 }}
          className="absolute left-1/2 top-2 -translate-x-1/2">
          <span className="ohp-new-badge relative flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-400 px-2 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,.9)]">
            <Sparkles size={9} strokeWidth={3} /> New
          </span>
        </motion.span>
      )}
    </div>
  )

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: active ? 1 : 0.72, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      // No lift or photo zoom on hover: a card that moves out from under the pointer flickers at its
      // edges, and a moving photo shows a hairline of the grid behind it. The border/shadow glow is the hover.
      whileHover={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(index * 0.045, 0.4) }}
      onClick={() => onCollectionClick(collection)}
      style={{ contain: 'layout paint' }}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[22px] border bg-white shadow-[0_1px_2px_rgba(17,24,39,.04),0_12px_32px_-20px_rgba(17,24,39,.35)] transition-[border-color,box-shadow] duration-300 hover:shadow-[0_2px_4px_rgba(17,24,39,.04),0_26px_50px_-24px_rgba(201,162,77,.55)] dark:bg-[#151517] ${
        needsYou ? 'border-[#C9A24D]/45 dark:border-[#C9A24D]/35' : 'border-gray-200 hover:border-[#C9A24D]/45 dark:border-gray-800'
      } ${active ? '' : 'grayscale-[0.6] hover:grayscale-0'}`}
    >
      {/* Photo mosaic - the 3 most recent new/added matches: one large, two stacked */}
      <div className="relative h-44 flex-shrink-0">
        {collection.stats.totalProperties > 0 ? (
          <div className={`grid h-full gap-0.5 bg-gray-100 dark:bg-[#0B0B0B] ${shownTiles === 1 ? 'grid-cols-1' : shownTiles === 2 ? 'grid-cols-2' : 'grid-cols-3 grid-rows-2'}`}>
            {previewProperties.slice(0, shownTiles).map((p, i) => tile(p, i))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-[radial-gradient(circle_at_50%_30%,rgba(201,162,77,.14),transparent_65%)] bg-gray-50 dark:bg-[#0B0B0B]">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-900/20"><HomeIcon size={18} /></span>
            <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest rounded border border-amber-100 dark:border-amber-900/30">No Matches</span>
            <span className="text-[10px] font-bold text-gray-400">Needs Update</span>
          </div>
        )}
        <motion.button whileTap={{ scale: 0.85 }} onClick={stop(() => onFavoriteToggle(collection.id))}
          aria-pressed={!!collection.favoritedAt} title={collection.favoritedAt ? 'Starred - click to unstar' : 'Star this Showcase (keeps it at the top)'}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full shadow-md backdrop-blur-0 transition-colors ${collection.favoritedAt ? 'bg-[#C9A24D] text-white' : 'bg-white/90 text-gray-400 hover:text-[#C9A24D] dark:bg-[#151517]/90'}`}>
          <Star size={15} fill={collection.favoritedAt ? 'currentColor' : 'none'} strokeWidth={2.5} />
        </motion.button>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Visitor */}
        <div className="flex items-center gap-3">
          <div className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border text-[13px] font-black ${getAvatarColor(collection.customer.firstName + collection.customer.lastName)}`}>
            {collection.customer.firstName.charAt(0)}{collection.customer.lastName.charAt(0)}
            {collection.stats.lastActivity && (Date.now() - new Date(collection.stats.lastActivity).getTime() < 86400000 * 2) && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-[#151517]" title="Active in the last 2 days" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="truncate text-[17px] font-black leading-tight text-[#0B0B0B] transition-colors group-hover:text-[#C9A24D] dark:text-white">
                {collection.customer.firstName} {collection.customer.lastName.charAt(0)}.
              </div>
              {/* Icon + copy only, no visible email/phone text - same compact pattern as the
                  Dashboard's lead cards (components/dash/DashLeadCard.tsx's CopyIconButton) */}
              {collection.customer.email && (
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => onCopy(e, `${collection.id}-email`, collection.customer.email)} title="Copy email"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-1 text-gray-500 transition hover:bg-[#C9A24D]/15 hover:text-[#8b7355] dark:bg-gray-800 dark:text-gray-400">
                  <Mail size={10} />
                  {copiedField === `${collection.id}-email` ? <Check size={9} className="text-green-600" /> : <Copy size={9} className="opacity-60" />}
                </motion.button>
              )}
              {collection.customer.phone && (
                <motion.button whileTap={{ scale: 0.88 }} onClick={(e) => onCopy(e, `${collection.id}-phone`, collection.customer.phone)} title="Copy phone"
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-1 text-gray-500 transition hover:bg-[#C9A24D]/15 hover:text-[#8b7355] dark:bg-gray-800 dark:text-gray-400">
                  <Phone size={10} />
                  {copiedField === `${collection.id}-phone` ? <Check size={9} className="text-green-600" /> : <Copy size={9} className="opacity-60" />}
                </motion.button>
              )}
            </div>
            {/* Always one line (never absent) so every card lands the same height. */}
            <div className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] font-bold text-gray-400">
              <Clock size={10} className="shrink-0" />
              {collection.stats.lastActivity ? `Active: ${formatRelativeDay(collection.stats.lastActivity)}` : 'Not Opened'}
              {collection.stats.viewedProperties > 0 && <span className="truncate">· <Eye size={10} className="-mt-px inline" /> {collection.stats.viewedProperties} viewed</span>}
              {collection.stats.likedProperties > 0 && <span className="truncate">· <Heart size={10} className="-mt-px inline" /> {collection.stats.likedProperties}</span>}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              {isFormSourced && (
                <span title={isUpdatedViaForm ? 'Updated via Form' : 'Created via Form'} className="whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-blue-600 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400">
                  {isUpdatedViaForm ? 'Form Update' : 'Via Form'}
                </span>
              )}
              <span className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest ${active ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-900/30 dark:text-green-400' : 'border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-400'}`} />
                {active ? 'Active' : 'Asleep'}
              </span>
            </div>
            {collection.stats.totalProperties > 0 && (
              <span className="text-[10.5px] font-bold text-[#6B7280] dark:text-gray-400">
                <span className="font-black text-[#0B0B0B] dark:text-white">{collection.stats.activeProperties}</span> {collection.stats.activeProperties === 1 ? 'Match' : 'Matches'}
              </span>
            )}
          </div>
        </div>

        {/* What they're looking for */}
        <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-[#FBFAF6] to-white p-3 dark:border-gray-800 dark:from-[#101012] dark:to-[#0B0B0B]">
          <div className="flex items-baseline justify-between gap-2">
            <div className="truncate text-[15px] font-black tracking-[-0.01em] text-[#C9A24D]">{priceText}</div>
            <div className="flex min-w-0 items-center gap-1 text-[10.5px] font-bold text-gray-400" title={displayLocations.join(', ')}>
              <MapPin size={10} className="flex-shrink-0 opacity-60" />
              <span className="truncate">
                {displayLocations.length > 0 ? displayLocations.slice(0, 2).join(', ') + (displayLocations.length > 2 ? ` +${displayLocations.length - 2}` : '') : 'Any'}
              </span>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-[1fr_1fr_1.7fr_1.15fr] gap-1.5">
            {([
              ['Beds', criteria.beds, BedDouble],
              ['Baths', criteria.baths, Bath],
              ['Sqft', criteria.sqft, Ruler],
              ['Acres', criteria.acreage, Trees],
            ] as const).map(([label, val, Icon]) => (
              <div key={label} title={label} className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-white px-1.5 py-2 shadow-[0_1px_0_rgba(17,24,39,.04)] ring-1 ring-gray-100 dark:bg-[#151517] dark:ring-gray-800">
                <Icon size={14} className="shrink-0 text-[#C9A24D]" />
                <span className={`truncate font-black text-[#0B0B0B] dark:text-white ${(val || '').length > 7 ? 'text-[11px]' : 'text-[14px]'}`}>{val || '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Why it's asleep / how often the client hears from you */}
        {!active ? (
          <div className="-mb-1 flex items-start gap-1.5 rounded-xl bg-gray-50 px-2.5 py-2 text-[10.5px] font-bold leading-snug text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
            <Moon size={11} className="mt-px shrink-0 text-[#C9A24D]" />
            <span>{collection.inactiveReason === 'no_response'
              ? `Fell asleep ${collection.inactiveAt ? formatRelativeDay(collection.inactiveAt).toLowerCase() : 'recently'} - ${collection.customer.firstName} ignored 3 weekly emails. Wakes up if they open it.`
              : collection.inactiveReason === 'agent'
                ? `Switched off by you${collection.inactiveAt ? ' ' + formatRelativeDay(collection.inactiveAt).toLowerCase() : ''} - no new matches, no emails.`
                : 'Switched off - no new matches, no emails.'}</span>
          </div>
        ) : collection.emailMode && collection.emailMode !== 'daily' && collection.customer.email ? (
          <div title={collection.emailModeReason || undefined}
            className={`-mb-1 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10.5px] font-bold ${collection.emailMode === 'weekly' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-gray-50 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400'}`}>
            <Mail size={11} className="shrink-0" />
            {collection.emailMode === 'weekly' ? 'Emails weekly - not opening them' : 'Emails off'}
          </div>
        ) : null}

        {/* Needs you: message / tours / likes / dislikes / comments / new matches */}
        <div className="flex min-h-[26px] flex-wrap items-center gap-1.5">
          <AnimatePresence initial={false}>
            {!!collection.refineRequestMessage && (
              <motion.span key="msg" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                className="flex items-center gap-1 rounded-full bg-[#C9A24D] px-2 py-1 text-[9.5px] font-black text-white shadow-sm"
                title={`Visitor asked to refine their search: "${collection.refineRequestMessage}"`}>
                <MessageSquare size={10} className="flex-shrink-0" /> Message
              </motion.span>
            )}
            {!!collection.stats.tourRequestedCount && (
              <motion.button key="tour" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} whileTap={{ scale: 0.92 }}
                onClick={stop(() => onOpenTours(collection))}
                className="relative flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[9.5px] font-black text-white shadow-sm transition-colors hover:bg-red-600"
                title="Tour request waiting on you - click to confirm it or mark it handled">
                <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
                <Calendar size={10} className="relative flex-shrink-0" /><span className="relative">{collection.stats.tourRequestedCount} Tour{collection.stats.tourRequestedCount === 1 ? '' : 's'}</span>
              </motion.button>
            )}
            {activityBadges.map(({ type, count, icon: Icon, color }) => type === 'PROPERTY_COMMENT' && collection.stats.commentPropertyId ? (
              // Opens the commented home's thread, not just the Showcase.
              <motion.button key={type} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} whileTap={{ scale: 0.92 }}
                onClick={stop(() => onOpenComments(collection))}
                className={`flex items-center gap-1 rounded-full px-2 py-1 ${color} text-[9.5px] font-black text-white shadow-sm transition hover:brightness-110`}
                title="New comment - click to open the conversation">
                <Icon size={10} className="flex-shrink-0" />{count}
              </motion.button>
            ) : (
              <motion.span key={type} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                className={`flex items-center gap-1 rounded-full px-2 py-1 ${color} text-[9.5px] font-black text-white shadow-sm`}
                title={type === 'LIKE' ? 'New likes' : type === 'DISLIKE' ? 'New dislikes' : 'New comments'}>
                <Icon size={10} className="flex-shrink-0" />{count}
              </motion.span>
            ))}
            {collection.stats.newProperties > 0 && (
              <motion.span key="new" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                className="flex items-center gap-1 rounded-full bg-green-500 py-1 pl-2 pr-1 text-[9.5px] font-black uppercase tracking-wide text-white shadow-sm">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white" />
                {collection.stats.newProperties} New
                <button onClick={stop(() => onDismissNew(collection.id))} className="rounded-full p-0.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white" title="Dismiss new matches">
                  <X size={10} strokeWidth={3} />
                </button>
              </motion.span>
            )}
            {!needsYou && (
              <motion.span key="clear" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-[10.5px] font-bold text-gray-400">
                <CheckCircle2 size={11} className="text-gray-300 dark:text-gray-600" /> All caught up
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="-ml-1.5 flex items-center gap-0.5">
            {([
              { label: 'Edit', title: 'Edit Preferences', icon: Edit3, onClick: () => onEditPreferences(collection), hover: 'hover:text-[#8b6a2b] hover:bg-[#C9A24D]/12 dark:hover:text-[#e8c97a]' },
              { label: 'Share', title: 'Share Showcase', icon: Share2, onClick: () => onShare(collection), hover: 'hover:text-[#111827] hover:bg-gray-100 dark:hover:text-white dark:hover:bg-gray-800' },
              { label: 'Delete', title: 'Delete', icon: Trash2, onClick: () => onDelete(collection), hover: 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' },
            ]).map(a => (
              <motion.button key={a.label} whileTap={{ scale: 0.9 }} onClick={stop(a.onClick)} title={a.title}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10.5px] font-black text-gray-400 transition-colors ${a.hover}`}>
                <a.icon size={13} /><span className="hidden min-[400px]:inline">{a.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Active switch */}
          <button
            onClick={stop(() => onStatusToggle(collection.id))}
            className="flex items-center gap-2 rounded-full py-1 pl-2 pr-1 text-[10px] font-black uppercase tracking-wider text-gray-400 transition-colors hover:text-[#111827] dark:hover:text-white"
            title={active ? 'Put to sleep: no new matches, no emails' : 'Wake up: catches up on new homes and emails start again'}
          >
            <span className={active ? 'text-green-600 dark:text-green-400' : ''}>{active ? 'On' : 'Off'}</span>
            <span className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ${active ? 'bg-green-500 shadow-[0_4px_12px_-4px_rgba(34,197,94,.8)]' : 'bg-gray-200 dark:bg-gray-700'}`}>
              <motion.span layout transition={{ type: 'spring', stiffness: 700, damping: 30 }} className={`h-4 w-4 rounded-full bg-white shadow ${active ? 'ml-auto' : ''}`} />
            </span>
          </button>
        </div>
      </div>
    </motion.article>
  )
}))
