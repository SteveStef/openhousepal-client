'use client'

import { homeSlug, showcaseLinkPath } from '@/lib/showcaseLink'
import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { Calendar, Copy, Check, ArrowUpDown, Mail, MapPin, MessageSquareText, Phone, Share2, User, SlidersHorizontal, X } from 'lucide-react'
import PropertyGrid, { SHOWCASE_TABS } from '@/components/PropertyGrid'
import ShowcaseRadiusContextLine from '@/components/ShowcaseRadiusContextLine'
import PropertyDetailsModal, { type HomeMove } from '@/components/PropertyDetailsModal'
import QuickCommentModal from '@/components/QuickCommentModal'
import EditShowcaseCriteriaModal from '@/components/EditShowcaseCriteriaModal'
import { Collection, Property, Comment, Site, SiteDomain } from '@/types'
import { isPropertyAvailableStatus } from '@/lib/utils'
import { inSoldFolder } from '@/lib/showcaseStatus'
import { openHousePalPublicUrl, websitePublicUrl } from '@/lib/publicResourceLinks'
import { computeMatchScore } from '@/lib/matchScore'
import { copyText } from '@/lib/copyText'
import LuxeSelect from '@/components/ui/LuxeSelect'
import { SHOWCASE_MAX_HOMES } from '@/lib/showcaseLimit'
import ShowcaseLimitNote from '@/components/showcases/ShowcaseLimitNote'

interface DetailViewProps {
  selectedCollection: Collection;
  matchedProperties: Property[];
  activeTab: 'all' | 'liked' | 'disliked' | 'sold_removed';
  setActiveTab: (tab: 'all' | 'liked' | 'disliked' | 'sold_removed') => void;
  tabCounts: { all: number, liked: number, disliked: number, soldRemoved: number };
  sortBy: string;
  setSortBy: (sort: any) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  onBack: () => void;
  onEditShowcase: () => void;
  /** No public link yet: open the share window (it turns the link on). */
  onShare?: () => void;
  /** The quick "Comparing to" / "how far" windows (the same ones the buyer gets) - saves just those fields. */
  onQuickSave: (preferences: Partial<import('@/types').CollectionPreferences>) => Promise<{ added: number; removed: number } | void>;
  onDismissRefineRequest: () => void;
  onStatusToggle: (id: string) => void;
  onNotificationToggle: (id: string, type: 'visitor' | 'agent') => void;
  onViewTours: () => void;
  // Property Actions
  onPropertyLike: (id: string | number, liked: boolean) => void;
  onPropertyDislike: (id: string | number, disliked: boolean) => void;
  /** "I recommend this home for you" on one home (or taking it back). */
  onRecommend?: (property: Property) => void;
  /** An off-the-market home's "Move to Sold/Removed" (filed=false: back out of the folder). */
  onMoveToSold?: (property: Property, filed: boolean) => void;
  onPropertyClick: (property: Property) => void;
  onAddComment: (id: string | number, comment: string) => void;
  // Modal States
  selectedProperty: Property | null;
  // ?comments=1 - opened from a "Reply to Comment" alert (see PropertyDetailsModal)
  focusComments?: boolean;
  isModalOpen: boolean;
  onCloseModal: () => void;
  isLoadingDetails: boolean;
  detailsError: string | null;
  isLoadingComments: boolean;
  commentsError: string | null;
  // Quick Comment Modal
  onCommentClick: (property: Property) => void;
  quickCommentProperty: Property | null;
  isQuickCommentOpen: boolean;
  onCloseQuickComment: () => void;
  isLoadingQuickComments: boolean;
  // Deep-linked from a "new match" alert (?focus=first) - see PropertyGrid's own doc comment.
  highlightFirstProperty?: boolean;
  // IDX site + domains, so the share link defaults to the agent's own branded domain when they
  // have a published site, same as the Showcases list page's share icon.
  idxSite?: Site | null;
  idxDomains?: SiteDomain[];
}

export const DetailView = memo(function DetailView({
  selectedCollection,
  matchedProperties,
  activeTab,
  setActiveTab,
  tabCounts,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  onBack,
  onEditShowcase,
  onShare,
  onQuickSave,
  onDismissRefineRequest,
  onStatusToggle,
  onNotificationToggle,
  onViewTours,
  onPropertyLike,
  onPropertyDislike,
  onRecommend,
  onMoveToSold,
  onPropertyClick,
  onAddComment,
  selectedProperty,
  focusComments = false,
  isModalOpen,
  onCloseModal,
  isLoadingDetails,
  detailsError,
  isLoadingComments,
  commentsError,
  onCommentClick,
  quickCommentProperty,
  isQuickCommentOpen,
  onCloseQuickComment,
  isLoadingQuickComments,
  highlightFirstProperty,
  idxSite,
  idxDomains
}: DetailViewProps) {
  // The agent's own photo + name brand the questions box in the home window.
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  // Which quick window is open over the Showcase: what the matches compare to, or how far to look.
  const [quickFocus, setQuickFocus] = useState<'compare' | 'radius' | null>(null)
  const [quickKey, setQuickKey] = useState<'compare' | 'radius'>('compare')
  const openQuick = (f: 'compare' | 'radius') => { setQuickKey(f); setQuickFocus(f) }

  // The agent's own IDX site link when they have a published one, otherwise the OpenHousePal link.
  const shareUrl = selectedCollection.shareToken
    ? websitePublicUrl(idxSite, idxDomains, showcaseLinkPath(selectedCollection)) || openHousePalPublicUrl(showcaseLinkPath(selectedCollection))
    : null

  const handleCopyLink = async () => {
    if (shareUrl) {
      try {
        await copyText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy link:', err)
      }
    }
  }

  // Share from inside the Showcase (user, 10/15): a phone opens its own share sheet (Messages,
  // email, WhatsApp...); a computer copies the link. No public link yet -> the share window.
  const [shared, setShared] = useState(false)
  const handleShare = async () => {
    if (!shareUrl || !selectedCollection.isPublic) { onShare?.(); return }
    const name = selectedCollection.customer.firstName
    const phone = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    if (phone && typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: `${name}'s Showcase`, text: `Here are the homes I picked for you, ${name}:`, url: shareUrl }); return } catch { /* closed the sheet - fall through to copy */ return }
    }
    try { await copyText(shareUrl); setShared(true); setTimeout(() => setShared(false), 2000) } catch { onShare?.() }
  }

  const handleCopyField = async (field: string, value: string) => {
    if (!value) return
    try {
      await copyText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(current => (current === field ? null : current)), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const pricePerSqft = (property: Property) =>
    property.LivingArea ? (property.ListPrice || 0) / property.LivingArea : 0

  const compareProperty = (selectedCollection.preferences as any)?.show_match_score !== false
    ? selectedCollection.originalProperty || undefined
    : undefined
  const radiusSearchPreferences = selectedCollection.preferences && 'diameter' in selectedCollection.preferences && selectedCollection.preferences.address && selectedCollection.preferences.diameter
    ? selectedCollection.preferences
    : null
  const customerFullName = [selectedCollection.customer.firstName, selectedCollection.customer.lastName].filter(Boolean).join(' ')
  const customerInitials = [selectedCollection.customer.firstName?.[0], selectedCollection.customer.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase()

  const filteredProperties = matchedProperties.filter(property => {
    // Only homes moved into Sold/Removed (by the client or by you) live there. One that just went
    // under contract / sold / off the market stays in its tab with a notice (lib/showcaseStatus).
    const filed = inSoldFolder(property)
    if (activeTab === 'sold_removed') return filed
    if (filed) return false
    if (activeTab === 'liked') return property.liked
    if (activeTab === 'disliked') return property.disliked
    // Matches tab: everything else - disliked properties only live in their own tab now.
    return !property.disliked
  }).sort((a, b) => {
    let comparison = 0
    if (sortBy === 'price') comparison = (a.ListPrice || 0) - (b.ListPrice || 0)
    else if (sortBy === 'pricePerSqft') comparison = pricePerSqft(a) - pricePerSqft(b)
    else if (sortBy === 'beds') comparison = (a.BedroomsTotal || 0) - (b.BedroomsTotal || 0)
    else if (sortBy === 'baths') comparison = (a.BathroomsTotal || 0) - (b.BathroomsTotal || 0)
    else if (sortBy === 'squareFeet') comparison = (a.LivingArea || 0) - (b.LivingArea || 0)
    else if (sortBy === 'acres') comparison = (a.LotSizeAcres || 0) - (b.LotSizeAcres || 0)
    else if (sortBy === 'yearBuilt') comparison = (a.YearBuilt || 0) - (b.YearBuilt || 0)
    else if (sortBy === 'daysOnMarket') comparison = (a.DaysOnMarket || 0) - (b.DaysOnMarket || 0)
    else if (sortBy === 'lastUpdated') comparison = new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime()
    // Inverted (b - a, not a - b) so the default ascending toggle state - the same one every
    // other field here starts in - shows the highest score first without the agent also having
    // to flip the direction arrow the moment they pick "Best Match".
    else if (sortBy === 'bestMatch' && compareProperty) comparison = computeMatchScore(b, compareProperty, matchedProperties) - computeMatchScore(a, compareProperty, matchedProperties)
    // The agent's recommended homes always lead, whatever the sort (user, 10/18).
    const rec = (p: Property) => (p.agentRecommended && !p.disliked ? 1 : 0)
    if (rec(a) !== rec(b)) return rec(b) - rec(a)
    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Previous / next home in the open details window - the list on screen, in its order.
  // Off-the-market cards don't open the window, so its arrows skip them too.
  const [homeMove, setHomeMove] = useState<HomeMove | null>(null)
  const navList = filteredProperties.filter(p => isPropertyAvailableStatus(p.MlsStatus))
  const navIndex = selectedProperty ? navList.findIndex(p => String(p.id) === String(selectedProperty.id)) : -1
  const stepTo = (k: number, dir: 1 | -1) => {
    const p = navList[k]
    if (!p) return null
    return () => { setHomeMove(m => ({ dir, kind: 'nav', seq: (m?.seq || 0) + 1 })); onPropertyClick(p) }
  }
  const detailsNav = isModalOpen && navIndex >= 0 && navList.length > 1
    ? { index: navIndex, total: navList.length, onPrev: stepTo(navIndex - 1, -1), onNext: stepTo(navIndex + 1, 1) }
    : null

  const formatAddressForTitle = (property: Property) => {
    // Street address + city only - no state/zip.
    const rawAddress = [property.FullStreetAddress, property.City].filter(Boolean).join(', ');
    return rawAddress.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Same card the visitor sees on their own showcase (photo + address/city/specs, no baths) -
  // clicking it opens the same preferences editor Edit Showcase does (ShowcaseMapEditor, which
  // already has its own compare-property picker), so this is a real shortcut, not just a mirror.
  const compareInfoNode = compareProperty ? (
    <motion.button
      type="button"
      onClick={() => openQuick('compare')}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      title="Click to change what these matches are compared to"
      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] py-1.5 pl-1.5 pr-4 text-left transition-colors hover:border-[#C9A24D]/60 hover:bg-[#C9A24D]/5 hover:shadow-[0_14px_30px_-20px_rgba(201,162,77,.8)] dark:border-gray-800 dark:bg-[#0B0B0B]"
    >
      {compareProperty.ListPictureURL && (
        <img src={compareProperty.ListPictureURL} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      )}
      <div className="min-w-0 text-xs leading-tight">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A24D]">Comparing to</p>
        <p className="mt-0.5 font-black text-[#0B0B0B] dark:text-white truncate">{compareProperty.FullStreetAddress}</p>
        {compareProperty.City && (
          <p className="text-[#6B7280] dark:text-gray-400 font-semibold truncate">{compareProperty.City}</p>
        )}
        <p className="mt-0.5 text-gray-400 dark:text-gray-500 font-semibold truncate">
          {[
            compareProperty.BedroomsTotal != null && `${compareProperty.BedroomsTotal} bd`,
            compareProperty.LivingArea != null && `${compareProperty.LivingArea.toLocaleString()} sqft`,
            compareProperty.ListPrice != null && `$${compareProperty.ListPrice.toLocaleString()}`,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
    </motion.button>
  ) : null
  const radiusContextNode = activeTab === 'all' && radiusSearchPreferences ? (
    <ShowcaseRadiusContextLine address={radiusSearchPreferences.address} radiusMiles={radiusSearchPreferences.diameter} onClick={() => openQuick('radius')} />
  ) : null
  // The agent's search, in one compact bar (user, 10/18: the stacked "Comparing to" + "6 miles
  // from" cards were too much on a phone): the home it's compared to (tap to change) and the
  // radius chip (tap to change).
  const radiusPrefs = activeTab === 'all' ? radiusSearchPreferences : null
  const matchedPropertiesHeaderInfoNode = compareProperty || radiusPrefs ? (
    <div className="flex w-full items-center gap-2.5 rounded-2xl border border-gray-200 bg-white p-1.5 pr-2 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
      <button type="button" onClick={() => openQuick(compareProperty ? 'compare' : 'radius')} title="Change what these homes are compared to"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-0.5 text-left transition hover:bg-[#C9A24D]/5">
        {compareProperty?.ListPictureURL
          ? <img src={compareProperty.ListPictureURL} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D]/12 text-[#C9A24D]"><MapPin size={18} /></span>}
        <span className="min-w-0">
          <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-[#C9A24D]">{compareProperty ? 'Comparing to' : 'Searching around'}</span>
          <span className="block truncate text-[13px] font-black text-[#0B0B0B] dark:text-white">
            {compareProperty ? formatAddressForTitle(compareProperty) : radiusPrefs?.address}
          </span>
        </span>
      </button>
      {radiusPrefs && (
        <button type="button" onClick={() => openQuick('radius')} title="Change how far out the search goes"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-3 py-1.5 text-[11px] font-black text-[#8b7355] transition hover:bg-[#C9A24D]/20 dark:text-[#e8cf8a]">
          <MapPin size={12} /> {radiusPrefs.diameter} mi
        </button>
      )}
    </div>
  ) : null

  const TABS = [
    { key: 'all', label: 'Matches', count: tabCounts.all },
    { key: 'liked', label: 'Liked', count: tabCounts.liked },
    { key: 'disliked', label: 'Disliked', count: tabCounts.disliked },
    { key: 'sold_removed', label: 'Sold/Removed', short: 'Sold', count: tabCounts.soldRemoved }
  ] as const

  const activeTabLabel = TABS.find(t => t.key === activeTab)?.label || 'Matches'

  return (
    <div className="flex-1 px-4 pt-3 pb-20 sm:px-6 sm:pt-4 sm:pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 mb-6 relative overflow-hidden">
          {/* Subtle Accent Bar - top edge only, not a left rail */}
          <div className="absolute left-0 right-0 top-0 h-1 bg-[#C9A24D]" />

          <div className="px-4 pt-3 pb-3 sm:px-6 sm:pt-4 sm:pb-4">
            <div className="-mt-2 mb-3 overflow-x-auto pb-3 pt-2 pr-1 border-b border-gray-200 dark:border-gray-800 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-full items-center justify-between gap-2 sm:min-w-0 sm:flex-1 sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-3">
                  <button
                    onClick={onBack}
                    title="Back to Showcases"
                    className="group inline-flex shrink-0 items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-black pr-2 border-r border-gray-200 dark:border-gray-800 sm:pr-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 flex items-center justify-center group-hover:border-gray-300 dark:group-hover:border-gray-700 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                    </div>
                  </button>
                  <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 font-black text-gray-900 dark:text-white sm:flex-none sm:shrink" title={customerFullName}>
                    <User size={14} className="shrink-0 text-[#C9A24D]" />
                  <span className="truncate">{customerFullName || customerInitials}</span>
                </span>
                {selectedCollection.customer.email && (
                  <>
                  <button
                    onClick={() => handleCopyField('email', selectedCollection.customer.email)}
                    className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-[#C9A24D] transition-colors hover:border-[#C9A24D]/50 dark:border-gray-800 dark:bg-white/5 lg:hidden"
                    title={`Copy ${selectedCollection.customer.email}`}
                    aria-label="Copy email"
                  >
                    {copiedField === 'email' ? <Check size={15} className="text-emerald-500" /> : <Mail size={15} />}
                  </button>
                  <span className="hidden items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium lg:inline-flex">
                    <Mail size={14} className="text-[#C9A24D]" />
                    {selectedCollection.customer.email}
                    <button
                      onClick={() => handleCopyField('email', selectedCollection.customer.email)}
                      className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-[#C9A24D] transition-colors"
                      title="Copy email"
                    >
                      {copiedField === 'email' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </span>
                  </>
                )}
                {selectedCollection.customer.phone && (
                  <>
                  <button
                    onClick={() => handleCopyField('phone', selectedCollection.customer.phone)}
                    className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-[#C9A24D] transition-colors hover:border-[#C9A24D]/50 dark:border-gray-800 dark:bg-white/5 lg:hidden"
                    title={`Copy ${selectedCollection.customer.phone}`}
                    aria-label="Copy phone"
                  >
                    {copiedField === 'phone' ? <Check size={15} className="text-emerald-500" /> : <Phone size={15} />}
                  </button>
                  <span className="hidden items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium lg:inline-flex">
                    <Phone size={14} className="text-[#C9A24D]" />
                    {selectedCollection.customer.phone}
                    <button
                      onClick={() => handleCopyField('phone', selectedCollection.customer.phone)}
                      className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-[#C9A24D] transition-colors"
                      title="Copy phone"
                    >
                      {copiedField === 'phone' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </span>
                  </>
                )}
                </div>
                <div className="ml-auto hidden shrink-0 items-center gap-1 sm:flex sm:gap-2">
                <button
                  onClick={onViewTours}
                  title="View tours"
                  className="relative inline-flex h-7 items-center justify-center gap-1 rounded-full bg-[#151517] px-2.5 text-[9px] font-black uppercase tracking-widest text-white shadow-sm transition-all hover:shadow-md dark:bg-white dark:text-[#111827]"
                >
                  <Calendar size={12} />
                  <span className="hidden min-[430px]:inline">Tours</span>
                  {!!selectedCollection.stats.tourRequestedCount && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black border-2 border-white dark:border-[#151517]">
                      {selectedCollection.stats.tourRequestedCount}
                    </span>
                  )}
                </button>
                <div className="flex shrink-0 items-center gap-1 text-xs bg-gray-50/50 dark:bg-white/5 py-1 px-1.5 rounded-lg border border-gray-200 dark:border-gray-800/50 sm:gap-1.5 sm:px-2">
                  <span className="text-[8px] font-black uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap min-[430px]:text-[9px]">Emails</span>
                  <span className="h-3.5 w-px bg-gray-200 dark:bg-gray-700" />
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold min-[430px]:text-[10px] ${selectedCollection.isBlacklisted ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
                      <span className="min-[430px]:hidden">V</span>
                      <span className="hidden min-[430px]:inline">Visitor</span>
                    </span>
                    <button
                      onClick={() => !selectedCollection.isBlacklisted && onNotificationToggle(selectedCollection.id, 'visitor')}
                      disabled={selectedCollection.isBlacklisted}
                      title={selectedCollection.isBlacklisted ? 'This visitor unsubscribed from update emails' : (selectedCollection.notifyVisitor ? 'Click to disable their update emails' : 'Click to enable their update emails')}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-inner transition-colors duration-200 ease-in-out focus:outline-none ${selectedCollection.isBlacklisted ? 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed' : (selectedCollection.notifyVisitor ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700')}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${(selectedCollection.notifyVisitor && !selectedCollection.isBlacklisted) ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-800 pl-1.5">
                    <span className="text-[9px] font-bold text-gray-500 dark:text-gray-400 min-[430px]:text-[10px]">
                      <span className="min-[430px]:hidden">A</span>
                      <span className="hidden min-[430px]:inline">Agent</span>
                    </span>
                    <button
                      onClick={() => onNotificationToggle(selectedCollection.id, 'agent')}
                      title={selectedCollection.notifyAgent ? 'Click to stop getting emailed about this showcase' : 'Click to get emailed about this showcase'}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent shadow-inner transition-colors duration-200 ease-in-out focus:outline-none ${selectedCollection.notifyAgent ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${selectedCollection.notifyAgent ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </div>

            {selectedCollection.refineRequestMessage && (
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#C9A24D]/30 bg-[#C9A24D]/10 p-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#e8cf8a]">
                  <MessageSquareText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">
                    {selectedCollection.customer.firstName} asked you to refine their search
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#0B0B0B] dark:text-white">&ldquo;{selectedCollection.refineRequestMessage}&rdquo;</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={onEditShowcase}
                    className="rounded-full border border-[#C9A24D]/40 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] transition hover:bg-[#C9A24D]/15 dark:border-[#C9A24D]/30 dark:bg-transparent dark:text-[#e8cf8a]"
                  >
                    Edit Search
                  </button>
                  <button
                    onClick={onDismissRefineRequest}
                    title="Dismiss"
                    className="rounded-full p-1.5 text-[#8b7355] hover:bg-[#C9A24D]/15 dark:text-[#e8cf8a]"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* One tight row: title block (left, subtitle shows what this is curated from) and
                the remaining agent controls (right) - Edit Showcase and View Tours. Turn On/Off
                and the dual Visitor/Agent alert toggles moved up onto the contact-info row above.
                The reference property and Sort both moved down onto the "Matched Properties" row
                (see PropertyGrid's compareInfo/sortControl below), and the status tabs are now a
                bar built into the bottom edge of this card, exactly like the visitor's showcase
                page. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                    {selectedCollection.customer.firstName} {selectedCollection.customer.lastName}'s Showcase
                  </h1>
                </div>
                {selectedCollection.originalProperty && (
                  <div className="mt-0.5 flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 truncate" title={selectedCollection.originalProperty.FullStreetAddress}>
                    <MapPin size={12} className="mr-1 shrink-0 text-[#C9A24D]" />
                    <span className="truncate">Curated from {formatAddressForTitle(selectedCollection.originalProperty)}</span>
                  </div>
                )}
              </div>
              <div className="grid shrink-0 grid-cols-4 items-stretch gap-1.5 sm:flex sm:items-center sm:gap-2">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={handleShare}
                  title={shareUrl ? 'Share this Showcase' : 'Turn on the link and share it'}
                  className={`inline-flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9.5px] font-black uppercase tracking-wider transition-all sm:flex-row sm:gap-2 sm:rounded-lg sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-widest ${shared ? 'bg-emerald-500 text-white' : 'bg-[#111827] text-white hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D]'}`}
                >
                  {shared ? <Check size={13} className="sm:h-3.5 sm:w-3.5" /> : <Share2 size={13} className="sm:h-3.5 sm:w-3.5" />}
                  {shared ? 'Copied' : 'Share'}
                </motion.button>
                <button
                  onClick={onEditShowcase}
                  className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-1 py-2 text-[9.5px] font-black uppercase tracking-wider text-[#8b7355] transition-all hover:border-[#C9A24D] hover:bg-[#C9A24D]/15 dark:text-[#e8cf8a] sm:flex-row sm:gap-2 sm:rounded-lg sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-widest"
                >
                  <SlidersHorizontal size={13} className="sm:h-3.5 sm:w-3.5" />
                  Edit
                </button>
                {/* Tours - on phones it sits in this row (bigger screens have it up top) */}
                <button
                  onClick={onViewTours}
                  className="relative inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-1 py-2 text-[9.5px] font-black uppercase tracking-wider text-[#111827] transition-all dark:border-gray-800 dark:bg-white/5 dark:text-white sm:hidden"
                >
                  <Calendar size={13} />
                  Tours
                  {!!selectedCollection.stats.tourRequestedCount && (
                    <span className="absolute -right-1 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-black text-white dark:border-[#151517]">
                      {selectedCollection.stats.tourRequestedCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => onStatusToggle(selectedCollection.id)}
                  className={`inline-flex shrink-0 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl border px-1 py-2 text-[9.5px] font-black uppercase tracking-wider transition-all hover:shadow-md sm:flex-row sm:gap-2 sm:rounded-lg sm:px-4 sm:py-2.5 sm:text-xs sm:tracking-widest ${
                    selectedCollection.status === 'ACTIVE'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900 hover:bg-green-100 dark:hover:bg-green-900/30'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedCollection.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'}`} />
                  {selectedCollection.status === 'ACTIVE' ? 'Turn Off' : 'Turn On'}
                </button>
              </div>
            </div>

            {/* Phones: who gets emailed, in plain words (the "V / A" switches up top were unreadable). */}
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03] sm:hidden">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Emails</span>
              <label className={`flex items-center gap-2 text-[11px] font-bold ${selectedCollection.isBlacklisted ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                To {selectedCollection.customer.firstName || 'client'}
                <button type="button" aria-label="Emails to the client" disabled={selectedCollection.isBlacklisted}
                  onClick={() => !selectedCollection.isBlacklisted && onNotificationToggle(selectedCollection.id, 'visitor')}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${selectedCollection.isBlacklisted ? 'cursor-not-allowed bg-gray-200 dark:bg-gray-800' : (selectedCollection.notifyVisitor ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700')}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${selectedCollection.notifyVisitor && !selectedCollection.isBlacklisted ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </label>
              <label className="flex items-center gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                To me
                <button type="button" aria-label="Emails to me" onClick={() => onNotificationToggle(selectedCollection.id, 'agent')}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${false ? 'cursor-not-allowed bg-gray-200 dark:bg-gray-800' : (selectedCollection.notifyAgent ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-gray-700')}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${selectedCollection.notifyAgent ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </label>
            </div>
          </div>

          {/* Property Status Tabs - full-width bar built into the bottom edge of the card,
              identical to the visitor's showcase page. Every tab gets the gold top line while
              active, not just Matches - drawn with an inset box-shadow (not a border-collapse
              -mt-px overlap trick) so it can never depend on pixel-rounding across grid columns. */}
          <div className="-mx-px -mb-px grid grid-cols-4 divide-x divide-gray-200 border-t border-gray-200 bg-gray-50/70 dark:divide-gray-800 dark:border-gray-800 dark:bg-white/[0.03]">
            {TABS.map((tab) => (
              <motion.button
                key={tab.key}
                whileTap={{ scale: 0.96 }}
                onClick={() => setActiveTab(tab.key as any)}
                className={`relative flex min-w-0 items-center justify-center gap-1.5 py-2.5 text-[11px] sm:text-sm font-bold transition-colors duration-200 ${
                  activeTab === tab.key
                    ? 'text-[#0B0B0B] dark:text-white'
                    : 'text-[#6B7280] hover:bg-white/60 dark:text-gray-400 dark:hover:bg-white/5'
                }`}
              >
                {activeTab === tab.key && (
                  <motion.span layoutId="agent-showcase-tab" className="absolute inset-0 bg-white shadow-[inset_0_3px_0_0_#C9A24D] dark:bg-[#151517]" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                )}
                <span className="relative truncate">{'short' in tab ? <><span className="sm:hidden">{tab.short}</span><span className="hidden sm:inline">{tab.label}</span></> : tab.label}</span>
                <motion.span key={tab.count} initial={{ scale: 0.6, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                  className={`relative shrink-0 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] ${
                  activeTab === tab.key
                    ? 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8cf8a]'
                    : 'bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400'
                }`}>
                  {tab.key === 'all' && selectedCollection.stats?.atLimit ? `${SHOWCASE_MAX_HOMES}+` : tab.count}
                </motion.span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Holding the most homes a Showcase can (lib/showcaseLimit): ask for a tighter search. */}
        <ShowcaseLimitNote show={activeTab === 'all' && !!selectedCollection.stats?.atLimit} className="mb-4" />

        {/* Professional Separator */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-[#faf9f7] dark:bg-[#0B0B0B] px-4 text-gray-500 dark:text-gray-500 font-medium uppercase tracking-widest text-xs">
              {activeTabLabel}
            </span>
          </div>
        </div>

        <PropertyGrid
          properties={filteredProperties}
          title="Matched Properties"
          onLike={onPropertyLike}
          onDislike={onPropertyDislike}
          onPropertyClick={onPropertyClick}
          onCommentClick={onCommentClick}
          // Opens the same View Tours modal as the header button - there's no per-property
          // "agent creates a tour" flow (tours are visitor-initiated requests, see PropertyTour),
          // so this just gets the agent straight to reviewing/confirming requests for this
          // showcase instead of making them hunt for the header button.
          onScheduleTour={() => onViewTours()}
          tourButtonVariant="requests"
          cropMlsBadge
          highlightFirst={highlightFirstProperty}
          showDetailedViewCount={true}
          destination={radiusSearchPreferences ? { address: radiusSearchPreferences.address, lat: radiusSearchPreferences.lat, lng: radiusSearchPreferences.long } : undefined}
          animationKey={activeTab}
          animationOrder={SHOWCASE_TABS}
          compareProperty={
            (selectedCollection.preferences as any)?.show_match_score !== false
              ? selectedCollection.originalProperty || undefined
              : undefined
          }
          compareInfo={matchedPropertiesHeaderInfoNode}
          compactHeader
          onRecommend={onRecommend}
          recommendedBy={user?.first_name || null}
          offMarketNotice
          onMoveToSold={onMoveToSold}
          sortControl={
            <div className="flex items-center gap-2">
              {/* The app's own menu (a pull-up sheet on phones that drags down to close - user,
                  10/24) instead of the browser's native picker. */}
              <LuxeSelect
                className="w-44 [&>button]:rounded-full [&>button]:py-2 [&>button]:shadow-sm"
                ariaLabel="Sort homes"
                sheetOnPhone
                sheetTitle="Sort the homes"
                icon={<ArrowUpDown size={13} />}
                value={String(sortBy)}
                onChange={(v) => setSortBy(v)}
                options={[
                  ...(compareProperty ? [{ value: 'bestMatch', label: 'Best Match' }] : []),
                  { value: 'daysOnMarket', label: 'Days on Market' },
                  { value: 'lastUpdated', label: 'Last Updated' },
                  { value: 'price', label: 'Price' },
                  { value: 'pricePerSqft', label: 'Price per Sq Ft' },
                  { value: 'squareFeet', label: 'Square Feet' },
                  { value: 'acres', label: 'Lot Size (Acres)' },
                  { value: 'beds', label: 'Bedrooms' },
                  { value: 'baths', label: 'Bathrooms' },
                  { value: 'yearBuilt', label: 'Year Built' },
                ]}
              />
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={sortOrder === 'asc' ? 'Low to high' : 'High to low'}
                aria-label={sortOrder === 'asc' ? 'Sort ascending, click for descending' : 'Sort descending, click for ascending'}
                className="shrink-0 p-2 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-full text-gray-500 dark:text-gray-400 hover:text-[#C9A24D] hover:border-[#C9A24D]/40 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/5 transition-all shadow-sm"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>
          }
        />

        <PropertyDetailsModal
          viewer="agent"
          showcaseTools
          agent={{ name: [user?.first_name, user?.last_name].filter(Boolean).join(' '), photoUrl: user?.photo_url ? resolveMediaUrl(user.photo_url) : null }}
          property={selectedProperty}
          isOpen={isModalOpen}
          onClose={onCloseModal}
          onLike={onPropertyLike}
          onDislike={onPropertyDislike}
          onAddComment={onAddComment}
          isLoadingDetails={isLoadingDetails}
          detailsError={detailsError}
          onRetryDetails={() => onPropertyClick(selectedProperty!)}
          isLoadingComments={isLoadingComments}
          commentsError={commentsError}
          shareUrl={shareUrl ? `${shareUrl}/${homeSlug(selectedProperty?.FullStreetAddress) || ''}`.replace(/\/$/, '') : null}
          focusComments={focusComments}
          nav={detailsNav}
          move={homeMove}
        />

        <EditShowcaseCriteriaModal
          audience="agent"
          focus={quickKey}
          preferences={selectedCollection.preferences && 'diameter' in selectedCollection.preferences ? selectedCollection.preferences : null}
          isOpen={quickFocus !== null}
          onClose={() => setQuickFocus(null)}
          onSave={onQuickSave}
          currentCompareProperty={compareProperty?.FullStreetAddress
            ? { listingKey: compareProperty.ListingKey, address: compareProperty.FullStreetAddress, city: compareProperty.City, image: compareProperty.ListPictureURL }
            : null}
          hasExplicitCompareOverride={!!(selectedCollection.preferences as any)?.compare_property_listing_key}
          onRefineFurther={() => { setQuickFocus(null); window.setTimeout(onEditShowcase, 180) }}
          preview={async (prefs) => {
            const { id: _id, collection_id: _c, created_at: _a, updated_at: _u, ...saved } = (selectedCollection.preferences || {}) as any
            const { success, data } = await api.collections.previewMatches({ ...saved, ...prefs })
            if (!success || !data) return null
            return {
              count: data.count,
              at_limit: data.at_limit,
              points: (data.properties || [])
                .filter((p: any) => p.Latitude != null && p.Longitude != null)
                .map((p: any) => ({ id: String(p.ListingKey || p.id), lat: p.Latitude, lng: p.Longitude })),
            }
          }}
        />

        <QuickCommentModal
          property={quickCommentProperty}
          isOpen={isQuickCommentOpen}
          onClose={onCloseQuickComment}
          onAddComment={onAddComment}
          isLoading={isLoadingQuickComments}
        />
      </div>
    </div>
  )
})
