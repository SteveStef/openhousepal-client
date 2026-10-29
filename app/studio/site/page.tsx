'use client'

import { salesAreRecent, salesWords } from '@/lib/salesWording'
import { LeaveReviewButton, orderReviews, ProfileRatingChip, ProfileReviewButton, ReviewsBigCarousel, ReviewsDeskCard, ReviewsSummary, ReviewsTwoUp, type HubReviewsData } from '@/components/agent-hub/HubReviews'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { toJpeg } from '@/components/setup/SetupUi'
import api, { API_BASE_URL, resolveMediaUrl } from '@/lib/api-service'
import FormResultsModal from '@/components/forms/FormResultsModal'
import InvitesPanel from '@/components/invites/InvitesPanel'
import { FormsInvitesSwitch, InvitesHeaderStats, InvitesNewChips, PLAYFUL_FORM_CARD, PlayfulFormCard } from '@/components/invites/FormsInvitesChrome'
import { GoldLastWord } from '@/components/ui/LuxeSurface'
import FormStatsModal from '@/components/forms/FormStatsModal'
import FormBuilderModal from '@/components/forms/FormBuilderModal'
import FormPlacementsNotice from '@/components/forms/FormPlacementsNotice'
import FormLookPicker from '@/components/forms/FormLookPicker'
import { AfterSubmitSettings, EffectsSettings, RevertButton, SaveFormButton } from '@/components/forms/FormSettingsBits'
import { hasAgentHubAccess } from '@/lib/navAccess'
import { formLookOf, type FormLookFields } from '@/lib/formLook'
import { brandFormLook, brandHubPatch, brandColorName, modeLabel, useBrandKit } from '@/lib/brandKit'
import FormQrCode from '@/components/forms/FormQrCode'
import FormTypeArt, { hasFormTypeArt } from '@/components/forms/FormTypeArt'
import InboxWindow, { InboxButton } from '@/components/ui/InboxWindow'
import FormCampaignsModal from '@/components/forms/FormCampaignsModal'
import { refreshFormsActionCount } from '@/hooks/useFormsActionCount'
import { ShowcaseFormBadge, ShowcaseFormInfoBlock } from '@/components/forms/ShowcaseFormInfo'
import PropertyLinkPicker from '@/components/forms/PropertyLinkPicker'
import { OpenHouseFormRequestsPanel } from '@/components/OpenHouseFormRequestsPanel'
import ConfirmationModal from '@/components/ConfirmationModal'
import WarningConfirmModal from '@/components/WarningConfirmModal'
import RecentSalesCarousel from '@/components/agent-hub/RecentSalesCarousel'
import ListingHeroCarousel from '@/components/agent-hub/ListingHeroCarousel'
import HubItemCarousel from '@/components/agent-hub/HubItemCarousel'
import BlogCard from '@/components/studio/blogs/BlogCard'
import RecentSalesPanel, { SettingToggleRow } from '@/components/agent-hub/RecentSalesPanel'
import { scrollRowByCard } from '@/lib/rowScroll'
import { HUB_ICON, HUB_ICON_TILE, HUB_TOGGLE_OFF, HUB_TOGGLE_ON, HubCollapse, HubPanelMemory, hubCardClass, useHubPanelOpen, useSmoothToggle } from '@/components/agent-hub/HubPanelChrome'
import OhpSwitch from '@/components/ui/OhpSwitch'
import MyListingsPanel from '@/components/agent-hub/MyListingsPanel'
import { HUB_MOBILE_HEADERS, HUB_THEMES, HubLuxeDecor, HubLuxeIntro, HubLuxeStyles, HubSplitHeader, HubAgentPhoto, isHubPhotoSet, LUXE_BLOG_CARD, LUXE_HOME_CARD, LUXE_VIDEO_CARD, LuxeBlogCardBody, LuxeHomeCardBody, LuxeVideoCardBody, type HubMobileHeaderId, type HubThemeId, hubLuxeMetalClass } from '@/components/agent-hub/HubLuxeTheme'
import { HUB_CLASSIC_ACCENTS, HUB_CLASSIC_DEFAULT_ACCENT, HubClassicStyles, hubAccentOf, hubAccentStyle, hubClassicClass } from '@/components/agent-hub/HubClassicTheme'
import { pinnedFirst } from '@/lib/hubPins'
import LuxeUpgradePitch from '@/components/ui/LuxeUpgradePitch'
import { LUXE_METALS, LUXE_METAL_ORDER, metalOf, type LuxeMetal } from '@/lib/luxeMetals'
import SocialLinksEditor, { SocialLink, defaultSocialLinks, getSocialBrandClass, type WebsiteAuto } from '@/components/agent-hub/SocialLinksEditor'
import DraggableAvatarPhoto from '@/components/agent-hub/DraggableAvatarPhoto'
import ContactCardPanel, { ContactCardFields, ContactCardPreview, defaultContactCardFields, mergeContactCardFields } from '@/components/agent-hub/ContactCardPanel'
import { AgentSale, applySalesDisplay, formatSaleStatus, getEligibleListings, getEligibleSales, getSaleLocation, getSaleStatusClass, getSaleSummary, getStreetOnly, type SalesSort } from '@/lib/agentSales'
import { openHousePalPublicUrl, websitePublicBaseUrl, websitePublicUrl, websitePublicHostname } from '@/lib/publicResourceLinks'
import { AgentFormConfig, BlogListItem, FormQuestion, FormQuestionType, FormSubmissionListItem, LinkedProperty, Site, SiteDomain, StatSummary } from '@/types'
import StatCard from '@/components/stats/StatCard'
import PageHeader from '@/components/PageHeader'
import { LuxeTabs } from '@/components/ui/LuxeHero'
import { hasMlsAccess, hasShowcaseAccess } from '@/lib/navAccess'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  ClipboardList as ClipboardListIcon,
  Copy,
  CopyPlus,
  Download,
  FileText,
  Globe,
  Home,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Phone,
  Play,
  Plus,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  Send,
  Share2,
  Smartphone,
  Star,
  Tablet,
  Trash2,
  User,
  Video,
  Newspaper,
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight,
  GripVertical,
  DollarSign,
  TrendingUp,
  Loader2,
  Lock,
  Pencil,
  LayoutGrid,
  PenLine,
  AlertTriangle,
  Eye,
  EyeOff,
  ExternalLink,
  MousePointerClick,
  Sparkles,
  Zap,
  BarChart3,
  HandCoins,
  IdCard,
  Moon,
  Sun,
  Palette,
  type LucideIcon,
} from 'lucide-react'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import OhpLoader from '@/components/brand/OhpLoader'
import { copyText } from '@/lib/copyText'
import { upgradeHubPhones } from '@/lib/hubPhones'

type HubStatus = 'Draft' | 'Published' | 'Unpublished'
type PreviewSize = 'mobile' | 'tablet' | 'desktop'
type HubItem = { id: string; title: string; description?: string; image?: string; link?: string; pinned?: boolean }
type SavedSocialLink = { id: string; label: string; url: string; enabled: boolean }
// One on/off row (Layout -> Reviews, Profile -> Star Rating).
function HubSwitchRow({ on, onClick, title, sub, testId }: { on: boolean; onClick: () => void; title: string; sub: string; testId?: string }) {
  // Flips at once, saves after the knob lands - no lag on phones (useSmoothToggle).
  const [shown, flip] = useSmoothToggle(on, () => onClick())
  return (
    <button type="button" role="switch" aria-checked={shown} onClick={flip} data-testid={testId}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 text-left transition hover:border-[#C9A24D]/50 active:scale-[0.99] dark:border-gray-700 dark:bg-[#0B0B0B]">
      <span><span className="block text-sm font-black text-[#111827] dark:text-white">{title}</span><span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">{sub}</span></span>
      <OhpSwitch on={shown} size="sm" as="span" />
    </button>
  )
}

type SavedAgentHubData = {
  profile: { name: string; title: string; brokerage: string; market: string; licenseNumber: string; about?: string; team?: string }
  contact: { call: string; text: string; email: string }
  socialLinks: SavedSocialLink[]
  contactCard?: { fields: ContactCardFields }
  recentSales?: AgentSale[]
  myListings?: AgentSale[]
  salesMinPrice?: number
  showSalesStats?: boolean
  salesCarousel?: boolean
  listingsCarousel?: boolean
  videosCarousel?: boolean
  toursCarousel?: boolean
  blogsCarousel?: boolean
  salesAutoScroll?: boolean
  listingsAutoScroll?: boolean
  videosAutoScroll?: boolean
  toursAutoScroll?: boolean
  blogsAutoScroll?: boolean
  reviewsCarousel?: boolean
  reviewsAutoScroll?: boolean
  reviewsOnProfile?: boolean
  reviewsProfileButton?: boolean
  visitorDarkMode?: boolean
  videoLinks?: HubItem[]
  videoChannelUrl?: string
  houseTourLinks?: HubItem[]
  houseTourUrl?: string
  blogCards?: HubItem[]
  profilePhotoUrl: string
  profilePhotoPosition?: { x: number; y: number }
  layoutSections: typeof sections
  /** The agent dragged the sections into their own order - until then My Listings leads. */
  layoutCustomized?: boolean
  visibleSectionIds: string[]
  savedAt: string
}
const sections = [
  { id: 'listings', label: 'My Listings', status: 'Complete', visible: true, count: '0 listings' },
  { id: 'sales', label: 'Recent Sales', status: 'Complete', visible: true, count: '6 selected' },
  { id: 'videos', label: 'Videos', status: 'Complete', visible: true, count: '3 videos' },
  { id: 'tours', label: 'House Tours', status: 'Complete', visible: true, count: '0 tours' },
  { id: 'blogs', label: 'Blogs', status: 'Complete', visible: true, count: '4 posts' },
  // Shown when reviews are switched on for the hub (Reviews page) and there's at least one. On a
  // computer they sit under About Me; this order is where they go on phones.
  { id: 'reviews', label: 'Reviews', status: 'Complete', visible: true, count: '' },
]

// Same rule as the public page: My Listings leads until the agent reorders the sections by hand.
const listingsFirst = <T extends { id: string }>(list: T[]) => {
  const i = list.findIndex(s => s.id === 'listings')
  return i <= 0 ? list : [list[i], ...list.slice(0, i), ...list.slice(i + 1)]
}
const normalizeLayoutSections = (savedSections: typeof sections) => {
  const savedById = new Map(savedSections.map(section => [section.id, section]))
  const result = savedSections
    .filter(section => sections.some(defaultSection => defaultSection.id === section.id))
    .map(section => ({ ...sections.find(defaultSection => defaultSection.id === section.id)!, visible: section.visible }))

  // A section introduced after this agent last saved (e.g. My Listings) is "missing" from their
  // saved data - drop it in right after wherever its default-order predecessor ended up, instead
  // of always tacking it onto the very end regardless of where it belongs (sales, *then* listings).
  const missing = sections.filter(section => !savedById.has(section.id))
  missing.forEach(missingSection => {
    const defaultIndex = sections.findIndex(section => section.id === missingSection.id)
    let insertAt = 0
    for (let i = defaultIndex - 1; i >= 0; i--) {
      const anchorIndex = result.findIndex(section => section.id === sections[i].id)
      if (anchorIndex !== -1) {
        insertAt = anchorIndex + 1
        break
      }
    }
    result.splice(insertAt, 0, missingSection)
  })

  return result
}

const formatCompactMoney = (value: number) => {
  if (!value) return '$0'
  if (value >= 1000000) {
    const millions = value / 1000000
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10
    return `$${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}M`
  }
  if (value >= 1000) return `$${Math.round(value / 1000)}K`
  return `$${value.toLocaleString()}`
}

const FORM_TYPE_META: Record<string, { icon: typeof Home; description: string }> = {
  buying: { icon: Home, description: 'Quickly collect the basic information needed from a new buyer lead.' },
  selling: { icon: TrendingUp, description: 'Quickly collect the basic information needed from a potential seller lead.' },
  home_value: { icon: DollarSign, description: 'Collect a homeowner’s property information so you can prepare a home-value estimate.' },
  seller_onboarding: { icon: FileText, description: 'A fuller intake once a seller becomes a client - what you need to prep, market, and list.' },
  buyer_onboarding: { icon: FileText, description: 'A fuller intake once a buyer becomes a client - what you need to start representing them.' },
  showing: { icon: Calendar, description: 'A quick form for someone requesting to tour a specific property.' },
  how_can_i_help: { icon: HelpCircle, description: 'A general lead form for all leads - typically used in bios, YouTube descriptions, etc.' },
  showcase_request: { icon: QrCode, description: 'A lead form for open house guests who want their own personalized property showcase - reached via a QR code on your Brag Sheet.' },
  make_me_sell: { icon: HandCoins, description: "A seller lead-gen form for mailers - asks a homeowner what it would take to get them to sell, so you can follow up on whether their number is realistic." },
  custom: { icon: FileText, description: 'Custom form for your own use case' },
}

const formsTabFromParam = (tab?: string | null) => {
  if (tab === 'share') return 'Share Forms'
  if (tab === 'results') return 'Forms Results'
  if (tab === 'editor' || tab === 'forms') return 'My Forms'
  return null
}

// Property-linking only makes sense for forms tied to a specific listing - not the generic lead-capture defaults.
const PROPERTY_LINK_DISABLED_TYPES = new Set(['buying', 'selling', 'home_value', 'seller_onboarding', 'buyer_onboarding', 'how_can_i_help', 'showcase_request'])

const actionButtons = [
  ['Buying a Home', 'Start your search with a local plan', Home],
  ['Selling a Home', 'Pricing, prep, and marketing strategy', Star],
  ["What's My Home Worth?", 'Request a market valuation', RefreshCcw],
  ['Book an Appointment', 'Schedule a buyer or seller consult', Calendar],
  ['View My Listings', 'Browse active homes', Globe],
  ['View My Open Houses', 'See upcoming events', Home],
  ['Contact Me', 'Send a quick question', MessageSquare],
]

const blogs = [
  ['Spring Market Guide', 'Jul 18, 2026', 'What buyers and sellers should know this month.'],
  ['How to Prep for Photos', 'Jun 29, 2026', 'Small fixes that make listings feel polished.'],
  ['Choosing a Neighborhood', 'Jun 4, 2026', 'A practical guide to comparing lifestyle fit.'],
]

const videos = [
  ['2026 Buyer Strategy', 'A quick guide to timing, offers, and inspections.'],
  ['Seller Prep Walkthrough', 'How I help homes launch with confidence.'],
  ['Neighborhood Spotlight', 'Favorite blocks, parks, and commute notes.'],
]

const sales = [
  ['$825,000', '1428 Linden Ave', 'Bethesda', 'Sold Jun 2026'],
  ['$702,500', '88 Parker Row', 'Rockville', 'Sold May 2026'],
  ['$1,120,000', '604 Grant Place', 'Chevy Chase', 'Sold Apr 2026'],
  ['$689,000', '219 Cedar Lane', 'Silver Spring', 'Sold Mar 2026'],
]

const toItems = (items: string[]): HubItem[] =>
  items.map((title, index) => ({ id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`, title }))

const toAgentHubSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const getYoutubeThumbnail = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : ''
}

const getYoutubeTitle = async (url: string) => {
  if (!getYoutubeThumbnail(url)) return ''

  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
    if (!response.ok) return ''
    const data = await response.json()
    return typeof data.title === 'string' ? data.title : ''
  } catch {
    return ''
  }
}

// Note: the `blogCards` param here should be passed the merged `effectiveBlogCards` (manual
// cards, or real published Studio blog posts when the agent has any) - not the raw manual-only
// `blogCards` state - so this "does the section have anything to show" check agrees with what
// actually renders on the public page. Passing raw `blogCards` was the bug behind the Layout
// tab's Blogs toggle staying stuck disabled ("Empty - toggled off until content is added") for
// agents whose blogs live entirely in Studio > Blogs.
const sectionHasContent = (id: string, recentSales: AgentSale[], videoLinks: HubItem[], houseTourLinks: HubItem[], houseTourUrl: string, blogCards: HubItem[], myListings: AgentSale[] = []) => {
  if (id === 'sales') return getEligibleSales(recentSales).some(sale => sale.visible)
  if (id === 'listings') return getEligibleListings(myListings).some(listing => listing.visible)
  if (id === 'videos') return videoLinks.some(item => item.link?.trim())
  if (id === 'tours') return Boolean(houseTourUrl.trim()) || houseTourLinks.some(item => item.link?.trim())
  if (id === 'blogs') return blogCards.some(item => item.link?.trim() || item.title.trim())
  return true
}

// Subtitle per Editor-tab card. The per-section wash/icon-chip/ring/glow colors that used to live
// here are gone - every card now uses the shared neutral HubPanelChrome look (explicit ask: no
// colors or glows, one clean OpenHousePal style).
const EDITOR_SECTION_THEME: Record<string, { subtitle: string }> = {
  Profile: { subtitle: "Your name, photo, and how you're introduced to visitors" },
  Contact: { subtitle: 'Where visitors can call, text, or email you directly' },
  'Social Links': { subtitle: 'Connect the accounts you want visitors to find' },
  'Contact Card': { subtitle: 'What people get when they tap Save Contact' },
}

const editorGroups = [
  {
    title: 'Profile',
    icon: User,
    fields: [
      ['Profile photo', 'Change Photo'],
      ['RE License number', ''],
      ['Agent name', ''],
      ['Professional title', ''],
      ['Brokerage name', ''],
      ['Team name', ''],
      ['Market or service area', ''],
      ['About me', ''],
    ],
  },
  {
    title: 'Contact',
    icon: Phone,
    fields: [
      ['Call button', ''],
      ['Text button', ''],
      ['Email button', ''],
    ],
  },
  {
    title: 'Social Links',
    icon: LinkIcon,
    fields: [
      ['Instagram', ''],
      ['Facebook', ''],
      ['LinkedIn', ''],
      ['YouTube', ''],
      ['Personal website', ''],
    ],
  },
  {
    title: 'Contact Card',
    icon: IdCard,
    fields: [],
  },
]

function StatusPill({ status }: { status: string }) {
  const isPositive = status === 'Complete' || status === 'Published' || status === 'Saved'
  const isWarning = status === 'Incomplete' || status === 'Unsaved Changes'
  const tone = isPositive
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40'
    : isWarning
      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40'
      : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${tone}`}>
      {isPositive ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {status}
    </span>
  )
}

function MiniQr() {
  return (
    <div className="grid h-32 w-32 grid-cols-5 grid-rows-5 gap-1 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      {Array.from({ length: 25 }).map((_, index) => (
        <div
          key={index}
          className={`rounded-sm ${[0, 1, 3, 4, 5, 8, 10, 11, 13, 16, 18, 20, 21, 22, 24].includes(index) ? 'bg-[#111827]' : 'bg-[#C9A24D]/20'}`}
        />
      ))}
    </div>
  )
}

function CarouselRow({ children, step = 180, showArrows = false, shellClass = 'relative px-5', rowClassName = '', autoScroll = false, intervalMs = 2600, scrollPulse = 0 }: { children: React.ReactNode; step?: number; showArrows?: boolean; shellClass?: string; rowClassName?: string; autoScroll?: boolean; intervalMs?: number; scrollPulse?: number }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  // Card-aligned (see lib/rowScroll.ts) - `step` is no longer used for distance, every move lands
  // the next card's left edge exactly at the row start instead of leaving half a card showing.
  void step
  const scrollForwardOrReset = () => scrollRowByCard(rowRef.current, 1, true)
  const scrollPrevious = () => scrollRowByCard(rowRef.current, -1)
  const scrollNext = () => scrollRowByCard(rowRef.current, 1)

  // Desktop/tablet row uses a horizontal shelf (not the single-slide fade carousel), so "auto
  // scroll" here means gently nudging it forward on a timer and looping back to the start once
  // it hits the end - rather than swapping slides.
  useEffect(() => {
    if (!autoScroll || scrollPulse || paused) return
    const timer = setInterval(scrollForwardOrReset, intervalMs)
    return () => clearInterval(timer)
  }, [autoScroll, paused, scrollPulse, step, intervalMs])

  useEffect(() => {
    if (!scrollPulse || paused) return
    scrollForwardOrReset()
  }, [scrollPulse, paused])

  return (
    <div className={shellClass} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div ref={rowRef} className={`scrollbar-hide flex gap-3 overflow-x-auto scroll-smooth lg:overflow-hidden ${rowClassName}`}>
        {children}
      </div>
      <button
        type="button"
        onClick={scrollPrevious}
        className={`absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm ${showArrows ? 'hidden lg:flex' : 'hidden'}`}
        aria-label="Previous"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        className={`absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm ${showArrows ? 'hidden lg:flex' : 'hidden'}`}
        aria-label="Next"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// Scales a fixed-design-width replica down to fit whatever container it's dropped into, instead
// of re-deriving smaller ad-hoc font sizes/paddings that never quite match the real page's actual
// proportions ("some sections a bit crushed" - explicit ask: "fit to scale so it previews exactly
// how the site really looks"). Measures the *container's* live width (ResizeObserver, since the
// editor's preview panel width varies - full editor column vs. the narrow sticky sidebar) and
// applies a single CSS transform: scale() to the inner node, which is laid out at its true design
// width so every element keeps its real, true-to-production proportions relative to each other.
// The outer wrapper's height is set to the scaled content height so it collapses to fit instead of
// leaving a tall blank gap (transform doesn't affect layout flow) or clipping overflow.
function ScaleFit({ designWidth, children }: { designWidth: number; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const update = () => {
      const containerWidth = outer.clientWidth
      const nextScale = containerWidth > 0 ? Math.min(1, containerWidth / designWidth) : 1
      setScale(nextScale)
      setHeight(inner.scrollHeight * nextScale)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [designWidth])

  return (
    <div ref={outerRef} style={{ width: '100%', height, overflow: 'hidden' }}>
      <div ref={innerRef} style={{ width: designWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  )
}

function PublicPreview({
  size,
  compact = false,
  salesMinPrice = 0,
  salesSort = 'newest',
  socialLinks,
  contact,
  profilePhotoUrl,
  profilePhotoPosition,
  layoutSections,
  profile,
  recentSales,
  showSalesStats,
  salesCarousel,
  salesAutoScroll,
  myListings,
  listingsCarousel,
  listingsAutoScroll,
  visitorDarkMode,
  hubTheme = 'classic',
  hubLuxeMetal = 'gold',
  hubAccent = HUB_CLASSIC_DEFAULT_ACCENT,
  mobileHeader = 'centered',
  introNonce = 0,
  videoLinks,
  videoChannelUrl,
  videosCarousel,
  videosAutoScroll,
  houseTourLinks,
  houseTourUrl,
  toursCarousel,
  toursAutoScroll,
  blogCards,
  blogsCarousel,
  blogsAutoScroll,
  agentForms,
  agentHubPublicPath,
  reviewsData = null,
  reviewsCarousel = true,
  reviewsAutoScroll = true,
  reviewsOnProfile = true,
  reviewsProfileButton = true,
}: {
  size: PreviewSize
  compact?: boolean
  /** The hub's sales choices - the preview shows exactly the sales visitors get (owner, 10/24). */
  salesMinPrice?: number
  salesSort?: SalesSort
  socialLinks: SocialLink[]
  contact: { call: string; text: string; email: string }
  profilePhotoUrl: string
  profilePhotoPosition?: { x: number; y: number }
  layoutSections: typeof sections
  profile: { name: string; title: string; brokerage: string; market: string; about?: string }
  recentSales: AgentSale[]
  showSalesStats: boolean
  salesCarousel: boolean
  salesAutoScroll: boolean
  myListings: AgentSale[]
  listingsCarousel: boolean
  listingsAutoScroll: boolean
  visitorDarkMode: boolean
  hubTheme?: HubThemeId
  hubLuxeMetal?: LuxeMetal
  hubAccent?: string
  mobileHeader?: HubMobileHeaderId
  introNonce?: number
  videoLinks: HubItem[]
  videoChannelUrl: string
  videosCarousel: boolean
  videosAutoScroll: boolean
  houseTourLinks: HubItem[]
  houseTourUrl: string
  toursCarousel: boolean
  toursAutoScroll: boolean
  blogCards: HubItem[]
  blogsCarousel: boolean
  blogsAutoScroll: boolean
  agentForms: AgentFormConfig[]
  agentHubPublicPath: string
  reviewsData?: HubReviewsData | null
  reviewsCarousel?: boolean
  reviewsAutoScroll?: boolean
  reviewsOnProfile?: boolean
  reviewsProfileButton?: boolean
}) {
  const width = compact ? 'w-full max-w-full' : size === 'mobile' ? 'max-w-[360px]' : size === 'tablet' ? 'max-w-[620px]' : 'max-w-4xl'
  const luxe = hubTheme === 'luxe'
  // Luxe's entry replays in the preview each time Luxe is picked.
  const [introOn, setIntroOn] = useState(false)
  useEffect(() => { if (introNonce > 0 && luxe) setIntroOn(true) }, [introNonce, luxe])
  const luxeIntro = luxe && introOn ? <HubLuxeIntro contained name={profile.name} kicker={[profile.title, profile.brokerage].filter(Boolean).join(' · ')} photoUrl={profilePhotoUrl} photoPosition={profilePhotoPosition} onDone={() => setIntroOn(false)} /> : null
  const shellPadding = compact ? 'px-4 pb-4 pt-4' : 'px-6 pb-6 pt-5'
  const enabledSocialLinks = socialLinks.filter(link => link.enabled && link.url.trim())
  const reviewsList = reviewsData ? orderReviews(reviewsData.reviews) : []
  const reviewsOn = Boolean(reviewsData?.show_on_hub && reviewsList.length > 0)
  const reviewHref = `${agentHubPublicPath}/review`
  // Profile card extras - phones only (the computer view has the reviews card under the buttons).
  const profileRating = reviewsOn && reviewsOnProfile && reviewsData ? <ProfileRatingChip data={reviewsData} href="#" /> : null
  const profileReviewBtn = reviewsOn && reviewsProfileButton ? <ProfileReviewButton href={reviewHref} newTab /> : null
  const splitRatingChip = reviewsOn && reviewsOnProfile && reviewsData
    ? <ProfileRatingChip data={reviewsData} href="#" reviewHref={reviewsProfileButton ? reviewHref : undefined} newTab />
    : profileReviewBtn
  const visibleLayoutSections = layoutSections.filter(section => section.id === 'reviews'
    ? reviewsOn
    : section.visible && sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, blogCards, myListings))
  // Ref, not state - nothing renders off this value directly, only the scheduler below reads it.
  const activeAutoScrollIdRef = useRef<string | null>(null)
  const [autoScrollStep, setAutoScrollStep] = useState<{ id: string; nonce: number } | null>(null)
  const autoScrollStartedRef = useRef(false)
  const autoScrollSequence = visibleLayoutSections
    .map(section => section.id)
    .filter(id => {
      if (id === 'sales') return luxe && salesAutoScroll && !(salesCarousel && size === 'mobile') && getEligibleSales(recentSales).filter(sale => sale.visible).length >= 2
      if (id === 'listings') return listingsAutoScroll && !(listingsCarousel && size === 'mobile') && getEligibleListings(myListings).filter(listing => listing.visible).length >= 2
      if (id === 'videos') return videosAutoScroll && !(videosCarousel && size === 'mobile') && videoLinks.filter(item => item.link?.trim()).length >= 2
      if (id === 'tours') return toursAutoScroll && !(toursCarousel && size === 'mobile') && houseTourLinks.filter(item => item.link?.trim()).length >= 2
      if (id === 'blogs') return blogsAutoScroll && !(blogsCarousel && size === 'mobile') && blogCards.filter(item => item.title.trim()).length >= 2
      if (id === 'reviews') return reviewsAutoScroll && size !== 'desktop' && !(reviewsCarousel && size === 'mobile') && reviewsList.length >= 2
      return false
    })
  const enabledContacts: [string, LucideIcon][] = [
    contact.call.trim() && ['Call', Phone],
    contact.text.trim() && ['Text', MessageSquare],
    contact.email.trim() && ['Email', Mail],
  ].filter(Boolean) as [string, LucideIcon][]
  const totalIconCount = enabledContacts.length + enabledSocialLinks.length
  const isCompactPreview = size === 'mobile'
  // The preview's "phone frame" is narrower than a real device viewport, so on higher
  // icon counts it needs to shrink more aggressively than the real site to still fit
  // everything on one line - it must never wrap to a second row.
  const iconBoxSize = totalIconCount <= 4 ? (isCompactPreview ? 'h-10 w-10' : 'h-12 w-12') : totalIconCount <= 6 ? (isCompactPreview ? 'h-9 w-9' : 'h-10 w-10') : totalIconCount <= 8 ? (isCompactPreview ? 'h-7 w-7' : 'h-9 w-9') : (isCompactPreview ? 'h-6 w-6' : 'h-8 w-8')
  const iconGlyphSize = totalIconCount <= 4 ? (isCompactPreview ? 'h-4 w-4' : 'h-5 w-5') : totalIconCount <= 6 ? (isCompactPreview ? 'h-4 w-4' : 'h-4 w-4') : totalIconCount <= 8 ? (isCompactPreview ? 'h-3.5 w-3.5' : 'h-[15px] w-[15px]') : (isCompactPreview ? 'h-3 w-3' : 'h-[13px] w-[13px]')
  const iconGap = totalIconCount <= 4 ? 'gap-3' : totalIconCount <= 6 ? (isCompactPreview ? 'gap-1.5' : 'gap-2') : totalIconCount <= 8 ? (isCompactPreview ? 'gap-1' : 'gap-1.5') : 'gap-1'
  const saleSummary = getSaleSummary(recentSales)
  const salesRecent = salesAreRecent(saleSummary.totalVolume)
  const buyingForm = agentForms.find(form => form.form_type === 'buying')
  const sellingForm = agentForms.find(form => form.form_type === 'selling')
  const homeValueForm = agentForms.find(form => form.form_type === 'home_value')
  const showingForm = agentForms.find(form => form.form_type === 'showing')
  const renderSalesStats = (className = '') => showSalesStats && (
    <div className={`mt-3 text-left ${className}`}>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Sold', saleSummary.totalSold.toString()],
          ['Volume', formatCompactMoney(saleSummary.totalVolume)],
          ['Avg', formatCompactMoney(saleSummary.avgPrice)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl border border-gray-200 bg-white px-2 py-2.5 text-center shadow-sm">
            <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#8b7355]">{label}</p>
            <p className="mt-1 truncate text-sm font-black text-[#111827]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // Self-scheduling: each tick calls setTimeout for the *next* tick itself, instead of relying on
  // activeAutoScrollId changing to re-trigger a dependent effect. That reschedule-on-state-change
  // approach silently died whenever the sequence had exactly one eligible section (e.g. every
  // other section in Carousel mode on mobile, leaving just one shelf) - advancing a length-1
  // sequence always lands back on the same id, React bails out of the no-op state update, and the
  // effect that would have scheduled the next timer never re-ran, so it fired once and stopped.
  useEffect(() => {
    autoScrollStartedRef.current = false
    if (autoScrollSequence.length === 0) {
      activeAutoScrollIdRef.current = null
      return
    }
    if (!activeAutoScrollIdRef.current || !autoScrollSequence.includes(activeAutoScrollIdRef.current)) {
      activeAutoScrollIdRef.current = autoScrollSequence[0]
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      if (cancelled) return
      const seq = autoScrollSequence
      const currentId = activeAutoScrollIdRef.current && seq.includes(activeAutoScrollIdRef.current)
        ? activeAutoScrollIdRef.current
        : seq[0]
      autoScrollStartedRef.current = true
      setAutoScrollStep({ id: currentId, nonce: Date.now() })
      const idx = seq.indexOf(currentId)
      activeAutoScrollIdRef.current = seq[(idx + 1) % seq.length]
      const delay = seq.length === 2 ? 3000 : 2000
      timer = setTimeout(tick, delay)
    }
    timer = setTimeout(tick, 3000)
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScrollSequence.join('|')])

  const renderSection = (id: string) => {
    if (id === 'sales') {
      return (
        <div key={id} className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">{salesWords('My Recent Sales', salesRecent)}</h3>
            <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">View All &rsaquo;</span>
          </div>
          {salesCarousel && size === 'mobile' ? (
            <RecentSalesCarousel sales={applySalesDisplay(getEligibleSales(recentSales).filter(sale => sale.visible), salesMinPrice, salesSort).slice(0, 8)} compact luxe={luxe} />
          ) : (
            <CarouselRow step={170} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'agent-hub-shelf-window relative px-5 lg:px-10' : 'relative px-5'} rowClassName={size === 'desktop' ? 'agent-hub-desktop-trio' : ''} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
              {applySalesDisplay(getEligibleSales(recentSales).filter(sale => sale.visible), salesMinPrice, salesSort).slice(0, 6).map((sale) => luxe ? (
                <div key={sale.id} className={LUXE_HOME_CARD}>
                  <LuxeHomeCardBody image={sale.image} price={sale.price ? `$${sale.price.toLocaleString()}` : 'Price'} location={getSaleLocation(sale)} status={formatSaleStatus(sale.status)} statusClass={getSaleStatusClass(sale.status)} />
                </div>
              ) : (
                <div key={sale.id} className="relative h-[118px] w-[210px] shrink-0 overflow-hidden rounded-[14px] bg-cover bg-center lg:h-[148px]" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                  <div className="absolute bottom-2 left-2 right-2 text-white"><p className="text-xl font-black leading-none">{sale.price ? `$${sale.price.toLocaleString()}` : 'Price'}</p><p className="truncate text-xs font-bold">{getSaleLocation(sale)}</p></div>
                </div>
              ))}
            </CarouselRow>
          )}
        </div>
      )
    }

    if (id === 'listings') {
      return (
        <div key={id} className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Listings</h3>
            <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">View All &rsaquo;</span>
          </div>
          {listingsCarousel && size === 'mobile' ? (
            <ListingHeroCarousel listings={getEligibleListings(myListings).filter(listing => listing.visible).slice(0, 8)} luxe={luxe} />
          ) : (
            <CarouselRow step={170} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'agent-hub-shelf-window relative px-5 lg:px-10' : 'relative px-5'} rowClassName={size === 'desktop' ? 'agent-hub-desktop-trio' : ''} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
              {getEligibleListings(myListings).filter(listing => listing.visible).slice(0, 6).map((listing) => luxe ? (
                <div key={listing.id} className={LUXE_HOME_CARD}>
                  <LuxeHomeCardBody image={listing.image} price={listing.price ? `$${listing.price.toLocaleString()}` : 'Price'} location={getSaleLocation(listing)} status={formatSaleStatus(listing.status)} statusClass={getSaleStatusClass(listing.status)} cta="View home" />
                </div>
              ) : (
                <div key={listing.id} className="relative h-[118px] w-[210px] shrink-0 overflow-hidden rounded-[14px] bg-cover bg-center lg:h-[148px]" style={{ backgroundImage: `url(${listing.image || '/placeholder.jpg'})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(listing.status)}`}>{formatSaleStatus(listing.status)}</span>
                  <div className="absolute bottom-2 left-2 right-2 text-white"><p className="text-xl font-black leading-none">{listing.price ? `$${listing.price.toLocaleString()}` : 'Price'}</p><p className="truncate text-xs font-bold">{getSaleLocation(listing)}</p></div>
                </div>
              ))}
            </CarouselRow>
          )}
        </div>
      )
    }

    if (id === 'videos') {
      const useCarousel = videosCarousel && size === 'mobile'
      const eligibleVideos = videoLinks.filter(item => item.link?.trim())
      return (
        <div key={id} className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Videos</h3>
            {videoChannelUrl ? <a href={videoChannelUrl.startsWith('http') ? videoChannelUrl : `https://${videoChannelUrl}`} target="_blank" rel="noreferrer" className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">YouTube &rsaquo;</a> : <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">YouTube &rsaquo;</span>}
          </div>
          {useCarousel ? (
            <HubItemCarousel
              items={eligibleVideos}
              showDots={false}
              renderSlide={(item) => (
                <a href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="relative block h-full w-full overflow-hidden rounded-[18px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/30 text-white shadow-sm ">
                    <Play className="ml-1 h-6 w-6 fill-white/80 text-white/90" />
                  </span>
                </a>
              )}
            />
          ) : (
            <CarouselRow step={162} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'agent-hub-shelf-window relative px-5 lg:px-10' : 'relative px-5'} rowClassName={size === 'desktop' ? 'agent-hub-desktop-trio' : ''} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
              {eligibleVideos.map((item) => luxe ? (
                <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className={LUXE_VIDEO_CARD}>
                  <LuxeVideoCardBody thumb={getYoutubeThumbnail(item.link || '')} title={item.title || 'YouTube Video'} kicker="Watch" />
                </a>
              ) : (
                <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="w-[162px] shrink-0">
                  <div className="relative h-[102px] overflow-hidden rounded-[14px] bg-cover bg-center lg:h-[132px]" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                    <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm ">
                      <Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" />
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'YouTube Video'}</p>
                </a>
              ))}
            </CarouselRow>
          )}
        </div>
      )
    }

    if (id === 'tours') {
      const useCarousel = toursCarousel && size === 'mobile'
      const eligibleTours = houseTourLinks.filter(item => item.link?.trim())
      return (
        <div key={id} className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">House Tours</h3>
            <a href={houseTourUrl ? (houseTourUrl.startsWith('http') ? houseTourUrl : `https://${houseTourUrl}`) : (houseTourLinks.find(item => item.link?.trim())?.link ? (houseTourLinks.find(item => item.link?.trim())!.link!.startsWith('http') ? houseTourLinks.find(item => item.link?.trim())!.link! : `https://${houseTourLinks.find(item => item.link?.trim())!.link!}`) : '#')} target={(houseTourUrl || houseTourLinks.find(item => item.link?.trim())?.link) ? '_blank' : undefined} rel={(houseTourUrl || houseTourLinks.find(item => item.link?.trim())?.link) ? 'noreferrer' : undefined} className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">Watch &rsaquo;</a>
          </div>
          {useCarousel ? (
            <HubItemCarousel
              items={eligibleTours}
              showDots={false}
              renderSlide={(item) => (
                <a href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="relative block h-full w-full overflow-hidden rounded-[18px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/30 text-white shadow-sm ">
                    <Play className="ml-1 h-6 w-6 fill-white/80 text-white/90" />
                  </span>
                </a>
              )}
            />
          ) : (
            <CarouselRow step={180} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'agent-hub-shelf-window relative px-5 lg:px-10' : 'relative px-5'} rowClassName={size === 'desktop' ? 'agent-hub-desktop-trio' : ''} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
              {eligibleTours.map((item) => luxe ? (
                <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className={LUXE_VIDEO_CARD}>
                  <LuxeVideoCardBody thumb={getYoutubeThumbnail(item.link || '')} title={item.title || 'House Tour'} kicker="Tour" />
                </a>
              ) : (
                <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="w-[180px] shrink-0">
                  <div className="relative h-[112px] overflow-hidden rounded-[14px] bg-cover bg-center lg:h-[140px]" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                    <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm ">
                      <Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" />
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'House Tour'}</p>
                </a>
              ))}
            </CarouselRow>
          )}
        </div>
      )
    }

    if (id === 'reviews') {
      // Computers: a short card under Schedule a Showing in the side column (ReviewsDeskCard), not in this column.
      if (!reviewsData || !reviewsOn || size === 'desktop') return null
      const header = (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">Reviews</h3>
          <LeaveReviewButton href={reviewHref} size="sm" newTab />
        </div>
      )
      return (
        <div key={id} className="mt-4">
          {header}
          <ReviewsSummary data={reviewsData} className="-mt-1 mb-3" />
          {reviewsCarousel && size === 'mobile' ? (
            <ReviewsBigCarousel reviews={reviewsList} luxe={luxe} autoScroll={reviewsAutoScroll} height={compact ? 210 : 240} />
          ) : (
            <ReviewsTwoUp reviews={reviewsList} luxe={luxe} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0} />
          )}
        </div>
      )
    }

    if (id === 'blogs') {
      const useCarousel = blogsCarousel && size === 'mobile'
      const eligibleBlogs = blogCards.filter(item => item.title.trim()).length ? blogCards.filter(item => item.title.trim()) : blogs.slice(0, 2).map(([title, date], index): HubItem => ({ id: `fallback-blog-${index}`, title, description: date, image: '', link: '' }))
      return (
        <div key={id} className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Blogs</h3>
            <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">Read All &rsaquo;</span>
          </div>
          {useCarousel ? (
            <HubItemCarousel
              items={eligibleBlogs}
              height={compact ? 200 : 260}
              dotsTone="dark"
              showDots={false}
              renderSlide={(item) => (
                <a href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'} target={item.link ? '_blank' : undefined} rel={item.link ? 'noreferrer' : undefined} className={`flex h-full w-full flex-col overflow-hidden rounded-[18px] bg-white dark:bg-[#151517] ${item.link ? '' : 'pointer-events-none'}`}>
                  <div className="flex-1 bg-cover bg-center" style={{ backgroundImage: item.image ? `url(${item.image})` : 'radial-gradient(120% 120% at 100% 0%, rgba(201,162,77,.45), transparent 55%), linear-gradient(135deg, #111827, #2a2218)' }} />
                  <div className="bg-white p-4 pb-6 dark:bg-[#1A1A1C]">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                    <h4 className="mt-1 line-clamp-2 text-sm font-black leading-4 text-[#111827] dark:text-white">{item.title}</h4>
                  </div>
                </a>
              )}
            />
          ) : (
            <CarouselRow step={198} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'agent-hub-shelf-window relative px-5 lg:px-10' : 'relative px-5'} rowClassName={size === 'desktop' ? 'agent-hub-desktop-trio' : ''} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
              {eligibleBlogs.map((item) => luxe ? (
                <a key={item.id} href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'} target={item.link ? '_blank' : undefined} rel={item.link ? 'noreferrer' : undefined} className={`${LUXE_BLOG_CARD} ${item.link ? '' : 'pointer-events-none'}`}>
                  <LuxeBlogCardBody image={item.image} category={item.description || 'Blog'} title={item.title} />
                </a>
              ) : (
                <a key={item.id} href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'} target={item.link ? '_blank' : undefined} rel={item.link ? 'noreferrer' : undefined} className={`w-[198px] shrink-0 overflow-hidden rounded-[14px] bg-white shadow-sm dark:bg-[#151517] dark:shadow-none ${item.link ? '' : 'pointer-events-none'}`}>
                  <div className="h-[92px] bg-cover bg-center" style={{ backgroundImage: item.image ? `url(${item.image})` : 'radial-gradient(120% 120% at 100% 0%, rgba(201,162,77,.45), transparent 55%), linear-gradient(135deg, #111827, #2a2218)' }} />
                  <div className="bg-white p-3 dark:bg-[#1A1A1C]">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                    <h4 className="mt-1 line-clamp-2 text-sm font-black leading-4 text-[#111827] dark:text-white">{item.title}</h4>
                  </div>
                </a>
              ))}
            </CarouselRow>
          )}
        </div>
      )
    }

    return null
  }

  // Desktop preview: a true-to-scale replica of the real two-column public page (aside profile
  // card sticky on the left, content shelves on the right - see app/[slug]/page.tsx's own
  // `lg:grid-cols-[360px_1fr]` layout), not the single stacked column below squeezed into a
  // narrower box. Laid out at the real page's actual design width (1152px, matching its own
  // `max-w-6xl`) using the exact same classes/breakpoint tiers as production, then scaled down as
  // a whole via ScaleFit to fit whatever width the editor panel actually gives it - proportional
  // shrinking instead of ad hoc smaller fonts/paddings that don't match the real site's proportions
  // (explicit ask: "fit to scale so it previews exactly how the site really looks").
  if (size === 'desktop' && !compact) {
    const desktopIconBoxSize = totalIconCount <= 4 ? 'h-12 w-12' : totalIconCount <= 6 ? 'h-10 w-10' : totalIconCount <= 8 ? 'h-9 w-9' : 'h-8 w-8'
    const desktopIconGlyphSize = totalIconCount <= 4 ? 'h-5 w-5' : totalIconCount <= 6 ? 'h-4 w-4' : totalIconCount <= 8 ? 'h-[15px] w-[15px]' : 'h-[13px] w-[13px]'
    const desktopIconGap = totalIconCount <= 4 ? 'gap-3' : totalIconCount <= 6 ? 'gap-2' : totalIconCount <= 8 ? 'gap-1.5' : 'gap-1'
    return (
      <div className={visitorDarkMode ? 'dark' : ''}>
        <ScaleFit designWidth={1152}>
          <div
            className={`relative mx-auto grid gap-8 overflow-hidden rounded-[28px] border border-gray-200 bg-[#f7f5f1] px-8 pb-10 pt-6 shadow-xl dark:border-gray-800 dark:bg-[#0B0B0B] lg:grid-cols-[360px_1fr] ${hubTheme === 'luxe' ? `hub-luxe ${hubLuxeMetalClass(hubLuxeMetal)}` : hubClassicClass(hubTheme, hubAccent)}`}
            style={{ width: 1152, ...(hubTheme === 'luxe' ? {} : hubAccentStyle(hubAccent)) }}
          >
            {hubTheme === 'luxe' ? <><HubLuxeStyles /><HubLuxeDecor /></> : <HubClassicStyles />}
            {luxeIntro}
            {visitorDarkMode && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_18%,transparent_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-10" />
              </div>
            )}
            <aside className="h-fit lg:sticky lg:top-6">
              {mobileHeader === 'split' ? (
                <HubSplitHeader
                  large
                  profile={profile}
                  photoUrl={profilePhotoUrl}
                  photoPosition={profilePhotoPosition}
                  stats={showSalesStats ? [['Sold', saleSummary.totalSold.toString()], ['Volume', formatCompactMoney(saleSummary.totalVolume)], ['Avg', formatCompactMoney(saleSummary.avgPrice)]] : null}
                  photoBadge={splitRatingChip}
                />
              ) : (
              <div className="rounded-[28px] border border-gray-200 bg-[#fbfaf7] px-7 py-7 text-center shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                <div className="mx-auto h-[92px] w-[92px] rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B]">
                  <HubAgentPhoto url={profilePhotoUrl} position={profilePhotoPosition} name={profile.name} className="rounded-full" />
                </div>
                <div className="-mt-5 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">{profile.brokerage}</div>
                <h2 className="mt-4 font-serif text-[30px] font-black leading-none text-[#111827] dark:text-white">{profile.name}</h2>
                <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
                {profile.market && <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[#778093] dark:text-gray-300"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}</p>}
                {renderSalesStats()}
              </div>
              )}

              <section className={`mt-6 flex w-full flex-wrap items-center justify-center ${desktopIconGap}`}>
                {enabledContacts.map(([label, Icon]) => (
                  <div key={label} aria-label={label} className="shrink-0">
                    <span className={`mx-auto flex ${desktopIconBoxSize} items-center justify-center rounded-full bg-[#111827] text-white dark:bg-[#1A1A1C] dark:ring-1 dark:ring-white/10`}><Icon className={desktopIconGlyphSize} /></span>
                  </div>
                ))}
                {enabledContacts.length > 0 && enabledSocialLinks.length > 0 && (
                  <span className="mx-1.5 h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
                )}
                {enabledSocialLinks.map(({ id, icon: Icon, label }) => (
                  <span key={id} aria-label={label} className={`flex ${desktopIconBoxSize} shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]`}>
                    <Icon className={`${desktopIconGlyphSize} ${getSocialBrandClass(id)}`} />
                  </span>
                ))}
              </section>

              <div className="hub-btn-save mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-[#111827] bg-white text-base font-black text-[#111827] shadow-sm dark:border-white dark:bg-transparent dark:text-white">
                <IdCard className="h-5 w-5" /> Save Contact
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={buyingForm ? `${agentHubPublicPath}/${buyingForm.slug}` : '#'}
                    target="_blank"
                    className={`hub-btn-buy flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-base font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white ${buyingForm ? '' : 'pointer-events-none opacity-50'}`}
                  >
                    <Home className="h-5 w-5" /> {buyingForm?.title || "I'm Buying"}
                  </Link>
                  <Link
                    href={sellingForm ? `${agentHubPublicPath}/${sellingForm.slug}` : '#'}
                    target="_blank"
                    className={`hub-btn-sell flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-base font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white ${sellingForm ? '' : 'pointer-events-none opacity-50'}`}
                  >
                    <TrendingUp className="h-5 w-5" /> {sellingForm?.title || "I'm Selling"}
                  </Link>
                </div>
                <Link
                  href={homeValueForm ? `${agentHubPublicPath}/${homeValueForm.slug}` : '#'}
                  target="_blank"
                  className={`hub-btn-worth mt-4 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#d7b974] bg-white px-4 py-3 text-center text-base font-black leading-tight dark:border-[#d7b974]/60 dark:bg-[#151517] dark:text-white ${homeValueForm ? '' : 'pointer-events-none opacity-50'}`}
                >
                  <DollarSign className="h-5 w-5 shrink-0 text-[#caa65e]" /> <span>{homeValueForm?.title || "What's My Home Worth?"}</span> <span className="shrink-0 text-[#9aa2af]">&rsaquo;</span>
                </Link>
                <Link
                  href={showingForm ? `${agentHubPublicPath}/${showingForm.slug}` : '#'}
                  target="_blank"
                  className={`hub-btn-show mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] text-base font-black text-[#111827] shadow-lg shadow-[#d2b16f]/30 dark:text-white ${showingForm ? '' : 'pointer-events-none opacity-50'}`}
                >
                  <span className="hub-show-tile inline-flex"><Calendar className="h-5 w-5" /></span> <span className="hub-show-label">{showingForm?.title || 'Schedule a Showing'}</span><span aria-hidden className="hub-show-go hidden">&rarr;</span>
                </Link>
                {reviewsOn && reviewsData && <ReviewsDeskCard data={reviewsData} reviews={reviewsList} luxe={luxe} reviewHref={reviewHref} newTab className="mt-4" />}
              </div>

              {profile.about?.trim() && (
                <section className="mt-6 rounded-[18px] border border-[#d8c08a]/50 bg-white/75 p-5 text-left shadow-sm dark:border-[#d8c08a]/25 dark:bg-[#151517]">
                  <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-xl font-black text-[#111827] dark:text-white">About Me</h2>
                  <p className="mt-3 text-sm font-medium leading-6 text-[#5f6673] dark:text-gray-300">{profile.about}</p>
                </section>
              )}
            </aside>

            <div className="min-w-0 [&>section:first-child]:!mt-0 [&>div:first-child>section]:!mt-0">
              {visibleLayoutSections.map(section => renderSection(section.id))}
              <footer className="mt-6 border-t border-gray-200 py-5 text-center text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Powered by <span className="inline-flex align-[-0.15em] text-[#111827] dark:text-white"><OhpWordmark className="text-[1.15em]" /></span>
              </footer>
            </div>
          </div>
        </ScaleFit>
      </div>
    )
  }

  return (
    <div className={visitorDarkMode ? 'dark' : ''}>
    <div className={`${width} ${compact ? 'mx-0' : 'mx-auto'} relative overflow-hidden rounded-[28px] border border-gray-200 bg-[#f7f5f1] dark:border-gray-800 dark:bg-[#0B0B0B] ${shellPadding} shadow-xl ${hubTheme === 'luxe' ? `hub-luxe ${hubLuxeMetalClass(hubLuxeMetal)}` : hubClassicClass(hubTheme, hubAccent)}`} style={hubTheme === 'luxe' ? undefined : hubAccentStyle(hubAccent)}>
      {hubTheme === 'luxe' ? <><HubLuxeStyles /><HubLuxeDecor /></> : <HubClassicStyles />}
      {luxeIntro}
      {visitorDarkMode && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_18%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-10" />
        </div>
      )}
      {mobileHeader === 'split' ? (
        <HubSplitHeader
          profile={profile}
          photoUrl={profilePhotoUrl}
          photoPosition={profilePhotoPosition}
          stats={showSalesStats ? [['Sold', saleSummary.totalSold.toString()], ['Volume', formatCompactMoney(saleSummary.totalVolume)], ['Avg', formatCompactMoney(saleSummary.avgPrice)]] : null}
          photoBadge={splitRatingChip}
        />
      ) : (
      <div className="relative text-center">
        {size !== 'desktop' && profileRating && <div className="absolute left-0 top-0">{profileRating}</div>}
        {size !== 'desktop' && profileReviewBtn && <div className="absolute right-0 top-0">{profileReviewBtn}</div>}
        <div className="mx-auto h-[92px] w-[92px] rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B]">
          <HubAgentPhoto url={profilePhotoUrl} position={profilePhotoPosition} name={profile.name} className="rounded-full" />
        </div>
        <div className="-mt-5 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">{profile.brokerage}</div>
        <h2 className="mt-4 font-serif text-[30px] font-black leading-none text-[#111827] dark:text-white">{profile.name}</h2>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
        {profile.market && <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[#778093] dark:text-gray-300"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}</p>}
        {size !== 'desktop' && renderSalesStats()}
      </div>
      )}
      <div className={`${isCompactPreview ? 'mt-3' : 'mt-6'} flex w-full flex-nowrap items-center justify-center ${iconGap}`}>
        {enabledContacts.map(([label, Icon]) => (
          <div key={label} aria-label={label} className="shrink-0">
            <span className={`mx-auto flex ${iconBoxSize} items-center justify-center rounded-full bg-[#111827] text-white dark:bg-[#1A1A1C] dark:ring-1 dark:ring-white/10`}><Icon className={iconGlyphSize} /></span>
          </div>
        ))}
        {enabledContacts.length > 0 && enabledSocialLinks.length > 0 && (
          <span className="mx-1 h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:mx-1.5" />
        )}
        {enabledSocialLinks.map(({ id, icon: Icon, label }) => (
          <span key={id} aria-label={label} className={`flex ${iconBoxSize} shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]`}>
            <Icon className={`${iconGlyphSize} ${getSocialBrandClass(id)}`} />
          </span>
        ))}
      </div>
      {/* Save Contact - the same real vCard download button the public Agent Hub shows (see
          app/[slug]/page.tsx), previously missing from this in-editor preview entirely. */}
      <div className={`hub-btn-save ${isCompactPreview ? 'mt-3' : 'mt-6'} flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-[#111827] bg-white text-sm font-black text-[#111827] shadow-sm dark:border-white dark:bg-transparent dark:text-white lg:h-12 lg:text-base`}>
        <IdCard className="h-4 w-4 lg:h-5 lg:w-5" /> Save Contact
      </div>
      <div className="mt-6">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={buyingForm ? `${agentHubPublicPath}/${buyingForm.slug}` : '#'}
            target="_blank"
            className={`hub-btn-buy flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white ${buyingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <Home className="h-5 w-5" /> {buyingForm?.title || "I'm Buying"}
          </Link>
          <Link
            href={sellingForm ? `${agentHubPublicPath}/${sellingForm.slug}` : '#'}
            target="_blank"
            className={`hub-btn-sell flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white ${sellingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <TrendingUp className="h-5 w-5" /> {sellingForm?.title || "I'm Selling"}
          </Link>
        </div>
        <Link
          href={homeValueForm ? `${agentHubPublicPath}/${homeValueForm.slug}` : '#'}
          target="_blank"
          className={`hub-btn-worth mt-4 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#d7b974] bg-white px-4 py-3 text-center font-black leading-tight dark:border-[#d7b974]/60 dark:bg-[#151517] dark:text-white ${homeValueForm ? '' : 'pointer-events-none opacity-50'}`}
        >
          <DollarSign className="h-5 w-5 shrink-0 text-[#caa65e]" /> <span>{homeValueForm?.title || "What's My Home Worth?"}</span> <span className="shrink-0 text-[#9aa2af]">&rsaquo;</span>
        </Link>
        <Link
          href={showingForm ? `${agentHubPublicPath}/${showingForm.slug}` : '#'}
          target="_blank"
          className={`hub-btn-show mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] font-black text-[#111827] shadow-lg shadow-[#d2b16f]/30 dark:text-white ${showingForm ? '' : 'pointer-events-none opacity-50'}`}
        >
          <span className="hub-show-tile inline-flex"><Calendar className="h-5 w-5" /></span> <span className="hub-show-label">{showingForm?.title || 'Schedule a Showing'}</span><span aria-hidden className="hub-show-go hidden">&rarr;</span>
        </Link>
      </div>
      {size === 'desktop' && (profile.about?.trim() || showSalesStats) && (
        <section className="mt-6 rounded-[18px] border border-[#d8c08a]/50 bg-white/75 p-5 text-left shadow-sm dark:border-gray-800 dark:bg-[#151517]">
          <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-xl font-black text-[#111827] dark:text-white">{profile.about?.trim() ? 'About Me' : 'Sales Snapshot'}</h3>
          {profile.about?.trim() && <p className="mt-3 text-sm font-medium leading-6 text-[#5f6673] dark:text-gray-300">{profile.about}</p>}
          {showSalesStats && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ['Sold', saleSummary.totalSold.toString()],
                ['Volume', formatCompactMoney(saleSummary.totalVolume)],
                ['Avg', formatCompactMoney(saleSummary.avgPrice)],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-2xl border border-gray-200 bg-white px-2 py-3 text-center dark:border-gray-700 dark:bg-[#1A1A1C]">
                  <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">{label}</p>
                  <p className="mt-1 truncate text-sm font-black text-[#111827]">{value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="[&>section:first-child]:!mt-2 [&>div:first-child>section]:!mt-2">
        {visibleLayoutSections.map(section => renderSection(section.id))}
      </div>
      {/* Same "Powered by OpenHousePal" footer every real visitor sees at the bottom of the page
          (app/[slug]/page.tsx) - previously missing from this preview entirely. */}
      <footer className="mt-6 border-t border-gray-200 py-5 text-center text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Powered by <span className="inline-flex align-[-0.15em] text-[#111827] dark:text-white"><OhpWordmark className="text-[1.15em]" /></span>
      </footer>
    </div>
    </div>
  )
}

export default function AgentHubPage() {
  // This single page shell serves both /studio/site (Agent Hub editor - PRO_NO_MLS/PREMIUM/IDX
  // only) and /studio/forms (Forms - universal, every active tier) via internal tabs, so the
  // capability gate has to branch on route rather than applying one rule to the whole page.
  const pathname = usePathname()
  const isFormsRoute = pathname === '/studio/forms'
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requireAgentHubAccess={!isFormsRoute}>
          <Suspense fallback={null}>
            <AgentHubContent />
          </Suspense>
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}

function AgentHubContent() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const isFormsRoute = pathname === '/studio/forms'
  const [created, setCreated] = useState(true)
  const [status, setStatus] = useState<HubStatus>('Draft')
  const [saveStatus, setSaveStatus] = useState('Unsaved Changes')
  const hasUnsavedChanges = saveStatus !== 'Saved'
  const [lastSavedHub, setLastSavedHub] = useState<SavedAgentHubData | null>(null)
  // "Saved ✓" feedback (owner, 10/24): every save - a click, a switch, a Save button - pops the
  // small Saved check (SavedToast) and the Save buttons morph to a tick (HubSaveButton).
  const [savedTick, setSavedTick] = useState(0)
  const [hubSaving, setHubSaving] = useState(false)
  const flashSaved = () => setSavedTick(t => t + 1)
  // Look/theme switches save straight to the config - same feedback as everything else.
  const saveHubConfig = async (config: Parameters<typeof api.agentHub.saveConfig>[0]) => {
    const res = await api.agentHub.saveConfig(config)
    if (res.success) flashSaved()
    else showToast(res.error || "Couldn't save that - try again.", 'error')
    return res
  }
  // Clicks/switches whose new value lives in state (social links on/off, contact-card fields):
  // save on the next render, once that state is in place - no Save button needed for them.
  const [saveRequest, setSaveRequest] = useState(0)
  const requestSave = () => setSaveRequest(n => n + 1)
  // Guards against a real data-loss race: the Recent Sales / My Listings panels each
  // auto-fetch-and-save on mount whenever their slice of local state is still empty (normal on a
  // fresh browser/session with no localStorage draft, before the backend config below has loaded).
  // Without this flag, that auto-save would fire handleSaveAgentHubChanges while profile/contact/
  // etc. are still at their blank initial defaults, and the full-replace PUT would wipe the
  // agent's real saved config. Sections stay stale-safe until the backend config fetch settles.
  const [agentHubDataReady, setAgentHubDataReady] = useState(false)
  const [editorSectionStatus, setEditorSectionStatus] = useState<Record<string, 'Complete' | 'Incomplete'>>({
    Profile: 'Incomplete',
    Contact: 'Incomplete',
    'Social Links': 'Incomplete',
  })
  const [activeTab, setActiveTab] = useState(() => formsTabFromParam(searchParams.get('tab')) || (isFormsRoute ? 'My Forms' : ({
    profile: 'Profile', contact: 'Contact', listings: 'Listings & Sales', sales: 'Listings & Sales', media: 'Media', videos: 'Media', tours: 'Media', blogs: 'Media', layout: 'Layout', link: 'Link', url: 'Link',
  } as Record<string, string>)[searchParams.get('tab') || ''] || 'Profile'))
  const [previewSize, setPreviewSize] = useState<PreviewSize>('mobile')
  const [openEditorSection, setOpenEditorSection] = useState('')
  const [layoutSections, setLayoutSections] = useState(sections)
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)
  // Set the first time the agent drags a section; until then My Listings leads (see listingsFirst).
  const layoutCustomizedRef = useRef(false)
  const [isLayoutSectionsOpen, setIsLayoutSectionsOpen] = useState(false)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [profilePhotoPosition, setProfilePhotoPosition] = useState({ x: 50, y: 50 })
  const [profile, setProfile] = useState({
    name: '',
    title: '',
    brokerage: '',
    market: '',
    licenseNumber: '',
    about: '',
    team: '',
  })
  const [contact, setContact] = useState({
    call: '',
    text: '',
    email: '',
  })
  const [statSummary, setStatSummary] = useState<StatSummary | null>(null)
  const [agentHubSlug, setAgentHubSlug] = useState('sarah-johnson')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'saved' | 'error'>('idle')
  const [slugMessage, setSlugMessage] = useState('Check availability before saving.')
  const initializedSlugRef = useRef(false)
  // Whether the agent (or their saved config) has ever explicitly set Sold Stats visibility -
  // once true, the sales-volume auto-default below never touches it again.
  const hasExplicitSalesStatsRef = useRef(false)
  const hasAppliedSalesStatsDefaultRef = useRef(false)
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(defaultSocialLinks)
  const [websiteAuto, setWebsiteAuto] = useState<WebsiteAuto>(null)
  const [contactCard, setContactCard] = useState<ContactCardFields>(defaultContactCardFields)
  const [recentSales, setRecentSales] = useState<AgentSale[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const savedHub = localStorage.getItem('agentHubSavedData')
      if (savedHub) {
        const parsed = JSON.parse(savedHub)
        if (Array.isArray(parsed.recentSales)) return getEligibleSales(parsed.recentSales)
      }
      const savedSales = localStorage.getItem('agentHubRecentSales')
      return savedSales ? getEligibleSales(JSON.parse(savedSales)) : []
    } catch {
      return []
    }
  })
  const [myListings, setMyListings] = useState<AgentSale[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const savedHub = localStorage.getItem('agentHubSavedData')
      if (savedHub) {
        const parsed = JSON.parse(savedHub)
        if (Array.isArray(parsed.myListings)) return getEligibleListings(parsed.myListings)
      }
      return []
    } catch {
      return []
    }
  })
  // Recent Sales / Listings default to carousel + auto-scroll on - a fresh Agent Hub should look
  // alive out of the box instead of a static grid. Stats defaults to off here; see the
  // sales-volume effect below, which turns it on automatically once the agent has enough sold
  // volume to make bragging about it worthwhile.
  const [showSalesStats, setShowSalesStats] = useState(false)
  const [salesMinPrice, setSalesMinPrice] = useState(0)
  const [salesSort, setSalesSort] = useState<SalesSort>('newest')
  const [salesCarousel, setSalesCarousel] = useState(true)
  const [listingsCarousel, setListingsCarousel] = useState(true)
  const [videosCarousel, setVideosCarousel] = useState(false)
  const [toursCarousel, setToursCarousel] = useState(false)
  const [blogsCarousel, setBlogsCarousel] = useState(false)
  const [salesAutoScroll, setSalesAutoScroll] = useState(true)
  const [listingsAutoScroll, setListingsAutoScroll] = useState(true)
  const [videosAutoScroll, setVideosAutoScroll] = useState(false)
  const [toursAutoScroll, setToursAutoScroll] = useState(false)
  const [blogsAutoScroll, setBlogsAutoScroll] = useState(false)
  const [reviewsCarousel, setReviewsCarousel] = useState(true)
  const [reviewsAutoScroll, setReviewsAutoScroll] = useState(true)
  const [reviewsOnProfile, setReviewsOnProfile] = useState(true)
  const [reviewsProfileButton, setReviewsProfileButton] = useState(true)
  // Published reviews + "show on hub" / "4 stars and up" (Reviews page) - the Layout panel's
  // switches and the preview use these. `reviews` holds every published one; the preview gets
  // only what the public page would show (shownReviewsData).
  const [reviewsData, setReviewsData] = useState<HubReviewsData | null>(null)
  useEffect(() => {
    api.agentHub.listReviews().then(r => {
      if (!r.success || !r.data) return
      setReviewsData({
        show_on_hub: r.data.settings.show_on_hub,
        min_rating: r.data.settings.min_rating ?? 1,
        summary: r.data.summary,
        reviews: r.data.reviews.filter(x => x.status === 'published').map(x => ({ id: x.id, reviewer_name: x.reviewer_name, rating: x.rating, body: x.body, created_at: x.created_at, source: x.source })),
      })
    })
  }, [])
  const shownReviewsData = useMemo<HubReviewsData | null>(() => {
    if (!reviewsData) return null
    const shown = reviewsData.reviews.filter(rv => rv.rating >= (reviewsData.min_rating ?? 1))
    const average = shown.length ? Math.round((shown.reduce((sum, rv) => sum + rv.rating, 0) / shown.length) * 100) / 100 : null
    return { ...reviewsData, reviews: shown, summary: { count: shown.length, average } }
  }, [reviewsData])
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [videoLinks, setVideoLinks] = useState<HubItem[]>([{ id: 'video-1', title: 'YouTube Video', link: '' }])
  const [videoChannelUrl, setVideoChannelUrl] = useState('')
  const [houseTourLinks, setHouseTourLinks] = useState<HubItem[]>([{ id: 'tour-1', title: 'House Tour', link: '' }])
  const [houseTourUrl, setHouseTourUrl] = useState('')
  const [blogCards, setBlogCards] = useState<HubItem[]>([])

  // Sold Stats defaults on automatically once real sales volume shows up (from a saved config or
  // a live "sync my sales" fetch) and crosses $10M - below that it stays off, since bragging about
  // stats only reads well at real volume. Never overrides an explicit choice (see
  // hasExplicitSalesStatsRef, set in applyHubConfig) and only ever applies once per page load, so
  // it doesn't fight the agent if they manually toggle it after adding/removing sales.
  useEffect(() => {
    if (hasExplicitSalesStatsRef.current || hasAppliedSalesStatsDefaultRef.current) return
    if (recentSales.length === 0) return
    hasAppliedSalesStatsDefaultRef.current = true
    const totalVolume = getSaleSummary(recentSales).totalVolume
    setShowSalesStats(totalVolume > 10_000_000)
  }, [recentSales])
  const [myBlogs, setMyBlogs] = useState<BlogListItem[]>([])
  const [myBlogsLoading, setMyBlogsLoading] = useState(true)

  const [agentForms, setAgentForms] = useState<AgentFormConfig[]>([])
  const [formsLoading, setFormsLoading] = useState(true)
  const [idxSite, setIdxSite] = useState<Site | null>(null)
  const [idxDomains, setIdxDomains] = useState<SiteDomain[]>([])
  // Open House Requests (disclosure/second-visit) still needing a "Sent"/"Scheduled" action -
  // when non-zero, that section jumps to the top of Forms Results instead of sitting last.
  const [openHouseRequestActionCount, setOpenHouseRequestActionCount] = useState(0)
  // Theme (accent color + dark mode) for the guest-facing "Request Seller Disclosure"/"Schedule a
  // Second Visit" pages reached from Cheat Sheet QR codes - those pages have no question system,
  // so this is the only thing about them that's editable.
  const [openHouseRequestTheme, setOpenHouseRequestTheme] = useState({ accentColor: '#C9A24D', darkMode: false })
  const [isEditingOpenHouseTheme, setIsEditingOpenHouseTheme] = useState(false)
  const [savingOpenHouseTheme, setSavingOpenHouseTheme] = useState(false)
  const [showOpenHouseStats, setShowOpenHouseStats] = useState(false)
  const [formSubmissionsByFormId, setFormSubmissionsByFormId] = useState<Record<string, FormSubmissionListItem[]>>({})
  const [submissionsLoadingByFormId, setSubmissionsLoadingByFormId] = useState<Record<string, boolean>>({})
  const [resultsModalFormId, setResultsModalFormId] = useState<string>('')
  // Set when the window opens onto one person (their chip, or a form's only new response).
  const [resultsFocusId, setResultsFocusId] = useState<string>('')
  // Header "Responses" mailbox - every form response, newest first.
  const [formsInboxOpen, setFormsInboxOpen] = useState(false)
  const [campaignsModalFormId, setCampaignsModalFormId] = useState<string>('')
  const [statsModalFormId, setStatsModalFormId] = useState<string>('')
  const [formEditorOpenId, setFormEditorOpenId] = useState('')
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  // Aesthetics-only forms (currently just showcase_request) skip FormBuilderModal entirely and
  // open this instead - same accent color + dark mode controls as the Cheat Sheet theme editor,
  // since the questions/copy on those forms drive automation and aren't meant to be touched.
  const [themeEditFormId, setThemeEditFormId] = useState('')
  const [formSaveStatus, setFormSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})
  const [themeReverting, setThemeReverting] = useState(false)
  const [themeRevertDone, setThemeRevertDone] = useState(false)
  // Tracks edits made since the last successful save/load, independent of formSaveStatus (which
  // starts at 'idle' whether or not anything's actually been touched) - lets closing the builder
  // warn only when there's something real to lose, instead of on every open/close.
  const [formIsDirty, setFormIsDirty] = useState<Record<string, boolean>>({})
  const [pendingDiscardFormId, setPendingDiscardFormId] = useState('')
  const lastSavedFormsRef = useRef<Record<string, AgentFormConfig>>({})
  const [formSlugDrafts, setFormSlugDrafts] = useState<Record<string, string>>({})
  const [formSlugStatus, setFormSlugStatus] = useState<Record<string, 'idle' | 'checking' | 'available' | 'taken' | 'saved' | 'error'>>({})
  const [formSlugMessage, setFormSlugMessage] = useState<Record<string, string>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [creatingForm, setCreatingForm] = useState(false)
  const [deleteFormTarget, setDeleteFormTarget] = useState<AgentFormConfig | null>(null)
  const [deletingForm, setDeletingForm] = useState(false)
  const [deleteSubmissionTarget, setDeleteSubmissionTarget] = useState<FormSubmissionListItem | null>(null)
  const [showAgentHubUrlWarning, setShowAgentHubUrlWarning] = useState(false)
  const [pendingFormSlugSave, setPendingFormSlugSave] = useState<AgentFormConfig | null>(null)
  const [deletingSubmission, setDeletingSubmission] = useState(false)
  const [editingSlugFormId, setEditingSlugFormId] = useState('')
  const initializedFormsRef = useRef(false)
  const autoCreateFormRef = useRef(false)
  const scrolledTabRef = useRef<string | null>(null)

  useEffect(() => {
    const formsTab = formsTabFromParam(searchParams.get('tab'))
    if (formsTab || isFormsRoute) {
      setActiveTab(formsTab || 'My Forms')
    }
    // The Forms sections all render on one page now (no tab switcher) - a ?tab= link (e.g. from
    // a notification, or Studio hub's "View Results") still needs to land the agent on the right
    // one, so scroll to it instead of swapping content. Share now lives inside My Forms.
    // Once per link - not again on every later address change (a Forms/Invites switch rewrites it).
    if (formsTab && isFormsRoute && scrolledTabRef.current !== searchParams.get('tab')) {
      scrolledTabRef.current = searchParams.get('tab')
      const sectionId = formsTab === 'Forms Results' ? 'forms-results' : 'my-forms'
      requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [isFormsRoute, searchParams])

  // Dash / Studio hub "Create Form" quick action links here with ?new=1 - without this the link
  // just landed on My Forms with nothing happening, since this page never read that param.
  useEffect(() => {
    if (autoCreateFormRef.current) return
    if (isFormsRoute && searchParams.get('new') === '1') {
      autoCreateFormRef.current = true
      handleCreateForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFormsRoute, searchParams])
  const visibleSectionIds = useMemo(() => layoutSections.filter(section => section.visible).map(section => section.id), [layoutSections])

  useEffect(() => {
    if (!user) return

    const accountName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    setProfile(current => ({
      ...current,
      name: current.name || accountName,
      brokerage: current.brokerage || user.brokerage || '',
      title: current.title || user.professional_title || '',
      market: current.market || user.market || '',
    }))
    setContact(current => ({
      ...current,
      email: current.email || user.email || '',
    }))
  }, [user])

  // Linked YouTube channel refreshes itself daily (backend agent_hub_video_sync) unless turned off.
  const [hubTheme, setHubTheme] = useState<HubThemeId>('classic')
  // Luxe is IDX only: any other plan can preview it (the live preview switches, with the upgrade
  // pitch under the picker) but the saved theme - and what visitors see - stays Classic.
  const hubLuxeAllowed = user?.plan_tier === 'IDX'
  const [luxePeek, setLuxePeek] = useState(false)
  const [hubIntroNonce, setHubIntroNonce] = useState(0)
  const shownHubTheme: HubThemeId = luxePeek ? 'luxe' : hubTheme === 'luxe' && !hubLuxeAllowed ? 'classic' : hubTheme
  // "My Brand Kit" (the default) or "Choose my own" (lib/brandKit, backend brand_look_service).
  // While on the Brand Kit, GET /agent-hub/me hands back the brand look in the config with
  // lookSource 'brand'; any pick below makes the hub's look its own.
  const brandKit = useBrandKit()
  const [hubLookSource, setHubLookSource] = useState<'brand' | 'own'>('own')
  const handleHubUseBrandKit = async () => {
    const look = brandKit.look
    const prev = { hubLookSource, hubTheme, hubAccent, hubLuxeMetal, visitorDarkMode }
    setHubLookSource('brand')
    setHubTheme(look.theme)
    setHubAccent(hubAccentOf(look.accent))
    setHubLuxeMetal(look.metal)
    setVisitorDarkMode(look.dark)
    setLuxePeek(false)
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    const res = await saveHubConfig({ ...config, ...brandHubPatch(look) } as any)
    if (!res.success) {
      setHubLookSource(prev.hubLookSource); setHubTheme(prev.hubTheme); setHubAccent(prev.hubAccent); setHubLuxeMetal(prev.hubLuxeMetal); setVisitorDarkMode(prev.visitorDarkMode)
    }
  }
  const handleHubChooseOwn = async () => {
    if (hubLookSource === 'own') return
    setHubLookSource('own')
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    // Starts from the look it has now (the Brand Kit's), so nothing changes until they pick.
    const res = await saveHubConfig({ ...config, lookSource: 'own' } as any)
    if (!res.success) setHubLookSource('brand')
  }
  const handleHubTheme = async (next: HubThemeId) => {
    if (next === 'luxe') setHubIntroNonce(n => n + 1)
    if (next === 'luxe' && !hubLuxeAllowed) { setLuxePeek(true); return }
    setLuxePeek(false)
    if (next === shownHubTheme && next === hubTheme && hubLookSource === 'own') return
    const prev = hubTheme
    setHubTheme(next)
    setHubLookSource('own')
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    const res = await saveHubConfig({ ...config, hubTheme: next, lookSource: 'own' } as any)
    if (!res.success) setHubTheme(prev)
  }
  // Luxe finish - gold (default), silver or bronze. Same Luxe look, the metal swapped everywhere.
  const [hubLuxeMetal, setHubLuxeMetal] = useState<LuxeMetal>('gold')
  const handleHubLuxeMetal = async (next: LuxeMetal) => {
    const prev = hubLuxeMetal
    setHubLuxeMetal(next)
    if (!hubLuxeAllowed) return
    setHubLookSource('own')
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    const res = await saveHubConfig({ ...config, hubLuxeMetal: next, lookSource: 'own' } as any)
    if (!res.success) setHubLuxeMetal(prev)
  }
  // Classic accent colour - every plan (the Luxe metals are Luxe's own).
  const [hubAccent, setHubAccent] = useState<string>(HUB_CLASSIC_DEFAULT_ACCENT)
  // What a form that matches the Agent Hub wears (lib/formLook) - follows the hub choices above live.
  const formHubLook = formLookOf({ theme: hubTheme === 'luxe' && hubLuxeAllowed ? 'luxe' : 'classic', accent: hubAccent, metal: hubLuxeMetal, dark: visitorDarkMode })
  // What a form on "My Brand Kit" wears (the default for forms).
  const formBrandLook = brandFormLook(brandKit.look, hubLuxeAllowed)
  const handleHubAccent = async (next: string) => {
    const prev = hubAccent
    setHubAccent(next)
    setHubLookSource('own')
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    const res = await saveHubConfig({ ...config, hubAccent: next, lookSource: 'own' } as any)
    if (!res.success) setHubAccent(prev)
  }
  // Visitor dark mode - saved the moment it's switched, like the theme (it used to wait for Save,
  // tucked under the license number, so switching it seemed to do nothing).
  const handleVisitorDarkMode = async (next: boolean) => {
    const prev = visitorDarkMode
    setVisitorDarkMode(next)
    setHubLookSource('own')
    try { localStorage.setItem('agentHubVisitorDarkMode', JSON.stringify(next)) } catch { /* private mode */ }
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    const res = await saveHubConfig({ ...config, visitorDarkMode: next, lookSource: 'own' } as any)
    if (!res.success) {
      setVisitorDarkMode(prev)
      try { localStorage.setItem('agentHubVisitorDarkMode', JSON.stringify(prev)) } catch { /* private mode */ }
    }
  }
  // Profile header layout (phones and desktop). Every plan.
  const [mobileHeader, setMobileHeader] = useState<HubMobileHeaderId>('centered')
  const handleMobileHeader = async (next: HubMobileHeaderId) => {
    const prev = mobileHeader
    setMobileHeader(next)
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    const res = await saveHubConfig({ ...config, mobileHeader: next } as any)
    if (!res.success) setMobileHeader(prev)
  }
  const [videoAutoSync, setVideoAutoSync] = useState(true)
  const [videoSyncedAt, setVideoSyncedAt] = useState<string | null>(null)
  const handleToggleVideoAutoSync = async (next: boolean) => {
    setVideoAutoSync(next)
    const latest = await api.agentHub.getMine()
    const config = (latest.success && latest.data?.config ? latest.data.config : {}) as Record<string, unknown>
    const res = await saveHubConfig({ ...config, videoAutoSync: next } as any)
    if (!res.success) setVideoAutoSync(!next)
  }

  const saveStatusRef = useRef(saveStatus)
  saveStatusRef.current = saveStatus
  useEffect(() => {
    if (!agentHubDataReady) return
    const onFocus = async () => {
      if (saveStatusRef.current !== 'Saved') return
      const response = await api.agentHub.getMine()
      if (response.success && response.data?.config && saveStatusRef.current === 'Saved') applySavedHubData(response.data.config)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentHubDataReady])

  const applySavedHubData = (raw: any) => {
    // Older configs kept the brokerage's number in the Save Contact office field - move it out first.
    const parsed = upgradeHubPhones(raw || {})
    setVideoAutoSync(parsed.videoAutoSync !== false)
    setHubTheme(parsed.hubTheme === 'luxe' ? 'luxe' : 'classic')
    setHubLuxeMetal(metalOf(parsed.hubLuxeMetal))
    setHubAccent(hubAccentOf(parsed.hubAccent))
    setHubLookSource(parsed.lookSource === 'brand' ? 'brand' : 'own')
    setMobileHeader(parsed.mobileHeader === 'split' ? 'split' : 'centered')
    setVideoSyncedAt(typeof parsed.videoSyncedAt === 'string' ? parsed.videoSyncedAt : null)
    if (parsed.profile || parsed.contact) {
      setProfile({
        name: parsed.profile?.name || '',
        title: parsed.profile?.title || '',
        brokerage: parsed.profile?.brokerage || '',
        market: parsed.profile?.market || '',
        licenseNumber: parsed.profile?.licenseNumber || parsed.contact?.licenseNumber || '',
        about: parsed.profile?.about || '',
        team: parsed.profile?.team || '',
      })
    }
    if (parsed.contact) setContact({ call: '', text: '', email: '', ...parsed.contact })
    if (isHubPhotoSet(parsed.profilePhotoUrl)) setProfilePhotoUrl(parsed.profilePhotoUrl)
    if (parsed.profilePhotoPosition?.x !== undefined) setProfilePhotoPosition({ x: Number(parsed.profilePhotoPosition.x) || 50, y: Number(parsed.profilePhotoPosition.y) || 50 })
    layoutCustomizedRef.current = parsed.layoutCustomized === true
    if (Array.isArray(parsed.layoutSections)) setLayoutSections(layoutCustomizedRef.current ? normalizeLayoutSections(parsed.layoutSections) : listingsFirst(normalizeLayoutSections(parsed.layoutSections)))
    setWebsiteAuto(parsed.websiteAuto || null)
    if (Array.isArray(parsed.socialLinks)) {
      setSocialLinks(current => current.map(link => {
        const saved = parsed.socialLinks.find((item: SavedSocialLink) => item.id === link.id)
        return saved ? { ...link, url: saved.url, enabled: saved.enabled } : link
      }))
    }
    if (parsed.contactCard?.fields) setContactCard(mergeContactCardFields(parsed.contactCard.fields))
    if (Array.isArray(parsed.recentSales)) setRecentSales(getEligibleSales(parsed.recentSales))
    if (Array.isArray(parsed.myListings)) setMyListings(getEligibleListings(parsed.myListings))
    if (typeof parsed.showSalesStats === 'boolean') { setShowSalesStats(parsed.showSalesStats); hasExplicitSalesStatsRef.current = true }
    if (typeof parsed.salesMinPrice === 'number') setSalesMinPrice(parsed.salesMinPrice)
    if (typeof parsed.salesCarousel === 'boolean') setSalesCarousel(parsed.salesCarousel)
    if (typeof parsed.listingsCarousel === 'boolean') setListingsCarousel(parsed.listingsCarousel)
    if (typeof parsed.videosCarousel === 'boolean') setVideosCarousel(parsed.videosCarousel)
    if (typeof parsed.toursCarousel === 'boolean') setToursCarousel(parsed.toursCarousel)
    if (typeof parsed.blogsCarousel === 'boolean') setBlogsCarousel(parsed.blogsCarousel)
    if (typeof parsed.salesAutoScroll === 'boolean') setSalesAutoScroll(parsed.salesAutoScroll)
    if (typeof parsed.listingsAutoScroll === 'boolean') setListingsAutoScroll(parsed.listingsAutoScroll)
    if (typeof parsed.videosAutoScroll === 'boolean') setVideosAutoScroll(parsed.videosAutoScroll)
    if (typeof parsed.toursAutoScroll === 'boolean') setToursAutoScroll(parsed.toursAutoScroll)
    if (typeof parsed.blogsAutoScroll === 'boolean') setBlogsAutoScroll(parsed.blogsAutoScroll)
    if (typeof parsed.reviewsCarousel === 'boolean') setReviewsCarousel(parsed.reviewsCarousel)
    if (typeof parsed.reviewsAutoScroll === 'boolean') setReviewsAutoScroll(parsed.reviewsAutoScroll)
    if (typeof parsed.reviewsOnProfile === 'boolean') setReviewsOnProfile(parsed.reviewsOnProfile)
    if (typeof parsed.reviewsProfileButton === 'boolean') setReviewsProfileButton(parsed.reviewsProfileButton)
    if (typeof parsed.visitorDarkMode === 'boolean') setVisitorDarkMode(parsed.visitorDarkMode)
    if (Array.isArray(parsed.videoLinks)) setVideoLinks(pinnedFirst(parsed.videoLinks))
    if (typeof parsed.videoChannelUrl === 'string') setVideoChannelUrl(parsed.videoChannelUrl)
    if (typeof parsed.houseTourUrl === 'string') setHouseTourUrl(parsed.houseTourUrl)
    if (Array.isArray(parsed.houseTourLinks)) setHouseTourLinks(pinnedFirst(parsed.houseTourLinks))
    if (Array.isArray(parsed.blogCards)) setBlogCards(parsed.blogCards)
    setLastSavedHub(parsed)
    const isAutoPublished = Boolean(
      (parsed.profile?.name || '').trim() &&
      (parsed.profile?.brokerage || '').trim() &&
      (parsed.profile?.title || '').trim() &&
      (parsed.profile?.market || '').trim() &&
      (parsed.contact?.call || '').trim() &&
      (parsed.contact?.text || '').trim() &&
      (parsed.contact?.email || '').trim() &&
      (parsed.profile?.licenseNumber || parsed.contact?.licenseNumber || '').trim() &&
      Array.isArray(parsed.socialLinks) &&
      parsed.socialLinks.some((link: SavedSocialLink) => link.enabled && link.url.trim())
    )
    setStatus(isAutoPublished ? 'Published' : 'Draft')
    setSaveStatus('Saved')
  }

  useEffect(() => {
    const savedHub = localStorage.getItem('agentHubSavedData')
    if (!savedHub) {
      const savedSales = localStorage.getItem('agentHubRecentSales')
      if (savedSales) {
        try {
          const parsedSales = JSON.parse(savedSales)
          if (Array.isArray(parsedSales)) setRecentSales(parsedSales)
        } catch {}
      }
      return
    }

    try {
      const parsed = JSON.parse(savedHub)
      applySavedHubData(parsed)
      const savedStatus = localStorage.getItem('agentHubEditorSectionStatus')
      if (savedStatus) setEditorSectionStatus(JSON.parse(savedStatus))
    } catch {
      setSaveStatus('Unsaved Changes')
    }
  }, [])

  // The database (AgentHub.config) is the real source of truth - it's what public visitors on
  // any device actually see. Once it loads, it overrides whatever the localStorage pass above
  // set, except when the backend has nothing saved yet, in which case we push the local draft up
  // so it finally becomes visible to real visitors instead of staying stuck in this one browser.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    const syncBackendConfig = async () => {
      const response = await api.agentHub.getMine()
      if (cancelled) return
      if (!response.success || !response.data) {
        // Couldn't confirm what's really saved (e.g. 403 on a tier without Agent Hub access, or a
        // network error) - don't flip to "ready", since that would greenlight the auto-save race
        // below into overwriting real data with an empty/incomplete guess.
        return
      }

      const config = response.data.config
      if (config && Object.keys(config).length > 0) {
        applySavedHubData(config)
        setAgentHubDataReady(true)
        return
      }

      const savedHub = localStorage.getItem('agentHubSavedData')
      if (!savedHub) {
        setAgentHubDataReady(true)
        return
      }
      try {
        const parsed = JSON.parse(savedHub)
        await api.agentHub.saveConfig(parsed)
      } catch {}
      if (!cancelled) setAgentHubDataReady(true)
    }

    syncBackendConfig()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    api.stats.getSummary().then(response => {
      if (response.success && response.data) setStatSummary(response.data)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    api.agentHub.getMine().then(response => {
      const theme = response.success ? response.data?.config?.openHouseRequestTheme : null
      if (theme) setOpenHouseRequestTheme({ accentColor: theme.accentColor || '#C9A24D', darkMode: Boolean(theme.darkMode) })
    })
  }, [user])

  const handleSaveOpenHouseTheme = async () => {
    setSavingOpenHouseTheme(true)
    try {
      const response = await api.agentHub.updateOpenHouseRequestTheme({
        accent_color: openHouseRequestTheme.accentColor,
        dark_mode: openHouseRequestTheme.darkMode,
      })
      if (response.success) setIsEditingOpenHouseTheme(false)
    } finally {
      setSavingOpenHouseTheme(false)
    }
  }

  useEffect(() => {
    const loadAgentHub = async () => {
      if (initializedSlugRef.current || !user) return
      initializedSlugRef.current = true

      const response = await api.agentHub.getMine()
      if (response.success && response.data?.slug) {
        setAgentHubSlug(response.data.slug)
        setSlugStatus('saved')
        setSlugMessage('This URL is reserved for your Agent Hub.')
        return
      }

      const nameSlug = toAgentHubSlug(`${user?.first_name || ''} ${user?.last_name || ''}`)
      if (!nameSlug) return

      for (let index = 0; index < 10; index += 1) {
        const candidate = index === 0 ? nameSlug : `${nameSlug}-${index + 1}`
        const check = await api.agentHub.checkSlug(candidate)
        if (check.success && check.data?.available) {
          setAgentHubSlug(candidate)
          setSlugStatus('available')
          setSlugMessage(index === 0 ? 'This URL is available.' : `${nameSlug} is taken, so this URL is available.`)
          return
        }
      }

      setAgentHubSlug(nameSlug)
      setSlugStatus('taken')
      setSlugMessage('This name is already taken. Choose a different URL ending.')
    }

    loadAgentHub()
  }, [user])

  const refreshFormSubmissions = async (formId: string) => {
    setSubmissionsLoadingByFormId(current => ({ ...current, [formId]: true }))
    const response = await api.forms.getSubmissions(formId)
    if (response.success && response.data) {
      setFormSubmissionsByFormId(current => ({ ...current, [formId]: response.data! }))
    }
    setSubmissionsLoadingByFormId(current => ({ ...current, [formId]: false }))
  }

  useEffect(() => {
    const loadAgentForms = async () => {
      if (initializedFormsRef.current || !user) return
      initializedFormsRef.current = true

      setFormsLoading(true)
      const response = await api.forms.getMine()
      if (response.success && response.data) {
        const sorted = [...response.data].sort((a, b) => a.order_index - b.order_index)
        setAgentForms(sorted)
        lastSavedFormsRef.current = Object.fromEntries(sorted.map(form => [form.id, form]))
        sorted.forEach(form => refreshFormSubmissions(form.id))
      }
      setFormsLoading(false)
    }

    loadAgentForms()
  }, [user])

  // A response that comes in while this page is open gets its red count on its form card too - the
  // page used to load responses once and never look again, so a new one stayed hidden until a full
  // reload (user, 10/28). One cheap count every minute / on coming back to the tab / when the bell
  // refreshes; only when it differs from what's shown does each form's list reload.
  const unreviewedShownRef = useRef(0)
  unreviewedShownRef.current = Object.values(formSubmissionsByFormId).reduce((n, subs) => n + subs.filter(s => !s.is_reviewed).length, 0)
  const agentFormIdsRef = useRef<string[]>([])
  agentFormIdsRef.current = agentForms.map(form => form.id)
  useEffect(() => {
    if (!user) return
    const check = async () => {
      if (document.hidden || !agentFormIdsRef.current.length) return
      const r = await api.forms.getUnreadSubmissionsCount()
      if (r.success && r.data && r.data.count !== unreviewedShownRef.current) agentFormIdsRef.current.forEach(id => refreshFormSubmissions(id))
    }
    const t = window.setInterval(check, 60000)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    window.addEventListener('leads-notification-count:refresh', check)
    return () => {
      window.clearInterval(t); document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check); window.removeEventListener('leads-notification-count:refresh', check)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user) return
    Promise.all([api.sites.getMine(), api.sites.getDomains()])
      .then(([siteResponse, domainsResponse]) => {
        if (siteResponse.success && siteResponse.data) setIdxSite(siteResponse.data)
        if (domainsResponse.success && domainsResponse.data) setIdxDomains(domainsResponse.data)
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user) return
    setMyBlogsLoading(true)
    api.blogs.getMine('PUBLISHED').then(response => {
      if (response.success && response.data) setMyBlogs(response.data)
      setMyBlogsLoading(false)
    })
  }, [user])

  const handleToggleBlogHubVisibility = async (blogId: string) => {
    const target = myBlogs.find(b => b.id === blogId)
    if (!target) return
    setMyBlogs(current => current.map(b => b.id === blogId ? { ...b, agent_hub_visible: !b.agent_hub_visible } : b))
    const response = await api.blogs.updateHubVisibility(blogId, { agent_hub_visible: !target.agent_hub_visible })
    if (!response.success) setMyBlogs(current => current.map(b => b.id === blogId ? { ...b, agent_hub_visible: target.agent_hub_visible } : b))
  }

  const handleToggleBlogFeatured = async (blogId: string) => {
    const target = myBlogs.find(b => b.id === blogId)
    if (!target) return
    setMyBlogs(current => current.map(b => b.id === blogId ? { ...b, agent_hub_featured: !b.agent_hub_featured } : b))
    const response = await api.blogs.updateHubVisibility(blogId, { agent_hub_featured: !target.agent_hub_featured })
    if (!response.success) setMyBlogs(current => current.map(b => b.id === blogId ? { ...b, agent_hub_featured: target.agent_hub_featured } : b))
  }

  useEffect(() => {
    const formIdParam = searchParams.get('formId')
    if (!formIdParam) return
    // ?view=unfinished (from a lead added out of an unfinished form) opens that form's
    // Results -> Unfinished list instead of the submissions modal.
    if (searchParams.get('view') === 'unfinished') setCampaignsModalFormId(formIdParam)
    else setResultsModalFormId(formIdParam)
  }, [searchParams])

  useEffect(() => {
    if (user?.photo_url) {
      setProfilePhotoUrl(user.photo_url.startsWith('http') ? user.photo_url : `${API_BASE_URL}${user.photo_url}`)
    }
  }, [user?.photo_url])

  const agentHubPublicPath = `/${agentHubSlug || 'sarah-johnson'}`
  // Links follow one rule: openhousepal.com, or the agent's own connected domain when they have
  // one (then the hub is <domain>/hub and forms <domain>/forms/<slug>) - see lib/ownDomainLinks.
  const ownDomainBase = websitePublicBaseUrl(idxSite, idxDomains)
  const agentHubShareUrl = ownDomainBase ? `${ownDomainBase}/hub` : openHousePalPublicUrl(agentHubPublicPath)
  const contactCardSource = {
    displayName: profile.name,
    jobTitle: profile.title,
    company: profile.brokerage,
    team: profile.team || '',
    mobilePhone: contact.call,
    email: contact.email,
    website: socialLinks.find(link => link.id === 'website' && link.enabled)?.url || '',
    instagram: socialLinks.find(link => link.id === 'instagram' && link.enabled)?.url || '',
    facebook: socialLinks.find(link => link.id === 'facebook' && link.enabled)?.url || '',
    youtube: socialLinks.find(link => link.id === 'youtube' && link.enabled)?.url || '',
    agentHubUrl: agentHubShareUrl,
    headshotUrl: profilePhotoUrl,
  }
  // The live preview pane shows the saved contact card while the agent is working on it, and goes
  // back to the hub as soon as they touch anything else in the editor.
  const [sidePreview, setSidePreview] = useState<'hub' | 'contact'>('hub')
  useEffect(() => {
    const onDown = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (!t?.closest) return
      if (t.closest('[data-contact-card-editor]')) setSidePreview('contact')
      else if (!t.closest('[data-hub-side-preview]')) setSidePreview('hub')
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('focusin', onDown, true)
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('focusin', onDown, true) }
  }, [])
  const visibleMyBlogs = [...myBlogs.filter(b => b.agent_hub_visible)].sort((a, b) => (b.agent_hub_featured ? 1 : 0) - (a.agent_hub_featured ? 1 : 0))
  const effectiveBlogCards: HubItem[] = visibleMyBlogs.length > 0
    ? visibleMyBlogs.map(b => ({ id: b.id, title: b.title, description: b.category || 'Blog', image: resolveMediaUrl(b.cover_image_url || b.preview_image_url), link: `${agentHubPublicPath}/blogs/${b.slug}` }))
    : blogCards
  const agentHubPublicUrl = openHousePalPublicUrl(agentHubPublicPath)
  const agentHubWebsiteUrl = websitePublicUrl(idxSite, idxDomains, '/hub')
  const isFormsTabGroup = ['My Forms', 'Share Forms', 'Forms Results'].includes(activeTab)
  // Forms & Invites: the page's two halves (?view=invites opens Invites - the bell and a lead's
  // "View RSVP" link there). Switching only rewrites the address bar, the page doesn't reload.
  const [formsView, setFormsView] = useState<'forms' | 'invites'>(() => (searchParams.get('view') === 'invites' ? 'invites' : 'forms'))
  useEffect(() => { if (searchParams.get('view') === 'invites') setFormsView('invites') }, [searchParams])
  // A link that opened one form's results (?formId=...&submission=... / ?view=unfinished) is used
  // once - left in the address it re-opened that result on every tab switch (user, 10/24).
  const clearOpenedResult = (q: URLSearchParams) => { q.delete('formId'); q.delete('submission'); if (q.get('view') === 'unfinished') q.delete('view') }
  const switchFormsView = (next: 'forms' | 'invites') => {
    // The page never moves on a switch - the new half is just there under the switch (user, 10/28:
    // it used to land you at the bottom). Hold the switch where it was on screen (or just under the
    // header if you'd scrolled past it) while the halves swap and the new one loads.
    const sw = () => document.getElementById('forms-invites-switch')
    const at = Math.max(sw()?.getBoundingClientRect().top ?? 0, 72)
    const pin = () => {
      const d = (sw()?.getBoundingClientRect().top ?? at) - at
      if (Math.abs(d) > 1) window.scrollTo({ top: window.scrollY + d, behavior: 'instant' })
    }
    requestAnimationFrame(pin); [80, 200, 400].forEach(ms => window.setTimeout(pin, ms))
    setFormsView(next)
    const q = new URLSearchParams(window.location.search)
    clearOpenedResult(q)
    if (next === 'invites') q.set('view', 'invites'); else { q.delete('view'); q.delete('invite'); q.delete('newInvite') }
    window.history.replaceState(null, '', `${pathname}${q.toString() ? `?${q.toString()}` : ''}`)
  }
  const forgetOpenedResult = () => {
    const q = new URLSearchParams(window.location.search)
    if (!q.has('formId') && !q.has('submission')) return
    clearOpenedResult(q)
    window.history.replaceState(null, '', `${pathname}${q.toString() ? `?${q.toString()}` : ''}`)
  }
  // The Agent Hub editor's categories - each tab opens straight to its own panels.
  const AGENT_HUB_SUBTABS = ['Profile', 'Contact', 'Listings & Sales', 'Media', 'Layout', 'Link']
  const AGENT_HUB_TAB_ICON: Record<string, LucideIcon> = {
    Profile: User, Contact: Phone, 'Listings & Sales': Home, Media: Video, Blogs: Newspaper, Layout: LayoutGrid, Link: LinkIcon,
  }
  // Which content panels (Layout section ids) each content tab holds.
  const HUB_TAB_SECTIONS: Record<string, string[]> = { 'Listings & Sales': ['listings', 'sales'], Media: ['videos', 'tours', 'blogs'] }
  const activeNavGroup: 'Agent Hub' | 'Forms' = isFormsTabGroup ? 'Forms' : 'Agent Hub'
  const ONBOARDING_FORM_TYPES = new Set(['seller_onboarding', 'buyer_onboarding'])
  // Forms reached via a printed QR code (currently just showcase_request - "Setup My Own
  // Showcase") get their own full-width section at the bottom instead of sitting in the general
  // premade grid, and their URL can't be edited (the QR would break) - mirrors
  // URL_LOCKED_FORM_TYPES in forms_routes.py. Everything else about them (questions, copy,
  // theme) is normal agent-editable content.
  const URL_LOCKED_FORM_TYPES = new Set(['showcase_request'])
  const premadeForms = agentForms.filter(form => form.form_type !== 'custom' && !ONBOARDING_FORM_TYPES.has(form.form_type) && !URL_LOCKED_FORM_TYPES.has(form.form_type))
  const onboardingForms = agentForms.filter(form => ONBOARDING_FORM_TYPES.has(form.form_type))
  const contentLockedForms = agentForms.filter(form => URL_LOCKED_FORM_TYPES.has(form.form_type))
  const customForms = agentForms.filter(form => form.form_type === 'custom')
  // Forms with responses not reviewed yet - the Forms header's "New" shortcuts.
  const newResultForms = agentForms
    .map(form => ({ form, count: (formSubmissionsByFormId[form.id] || []).filter(submission => !submission.is_reviewed).length }))
    .filter(entry => entry.count > 0)
  // ...one chip per person, newest first - a tap opens straight onto their answers.
  const newResultPeople = agentForms
    .flatMap(form => (formSubmissionsByFormId[form.id] || []).filter(submission => !submission.is_reviewed).map(submission => ({ form, submission })))
    .sort((a, b) => new Date(b.submission.created_at).getTime() - new Date(a.submission.created_at).getTime())
  const openResults = (formId: string, submissionId = '') => { setResultsFocusId(submissionId); setResultsModalFormId(formId) }
  const qrDownloadFns = useRef<Record<string, () => void>>({})

  // Copy link / Download QR are fire-and-forget with no other state change, so without this the
  // click looks like it did nothing - flash a checkmark on the clicked form's button briefly.
  // Only the untouched aesthetics-only card below still needs this.
  const [justClickedFormAction, setJustClickedFormAction] = useState<string>('')
  const flashFormAction = (key: string) => {
    setJustClickedFormAction(key)
    setTimeout(() => setJustClickedFormAction(current => current === key ? '' : current), 1200)
  }

  const renderFormCard = (form: AgentFormConfig, options?: { big?: boolean }) => {
    const meta = FORM_TYPE_META[form.form_type] || FORM_TYPE_META.custom
    const big = options?.big
    const openHousePalFormUrl = `${agentHubPublicUrl}/${form.slug}`
    const isShowcaseRequest = form.form_type === 'showcase_request'
    const websiteFormUrl = websitePublicUrl(idxSite, idxDomains, isShowcaseRequest ? '/create-showcase' : `/forms/${form.slug}`)
    // The real hostname (custom domain if one's set, else the default {slug}.openhousepal.com
    // subdomain) - unlike websiteFormUrl, this is never the local-dev /ohp-site-render/... proxy
    // path, so it's what to show as a clean label.
    const websiteHostname = websitePublicHostname(idxSite, idxDomains)
    // The QR code follows the agent's own domain when they have one.
    const qrUrl = websiteFormUrl || openHousePalFormUrl
    const submissions = formSubmissionsByFormId[form.id] || []
    const pendingSubmissions = submissions.filter(submission => !submission.is_reviewed).length
    const isAestheticsOnly = URL_LOCKED_FORM_TYPES.has(form.form_type)
    // Forms Campaigns scope - mirrors CAMPAIGN_ELIGIBLE_FORM_TYPES in forms_routes.py.
    const isCampaignEligible = form.form_type !== 'custom' && !ONBOARDING_FORM_TYPES.has(form.form_type) && !isAestheticsOnly
    // Premade forms wear their own animated medallion; custom forms keep showing their QR code.
    // The Download QR buttons still need the code, so it's drawn off-screen at print size.
    const registerQr = (fn: () => void) => { qrDownloadFns.current[form.id] = fn }
    const formMedia = hasFormTypeArt(form.form_type) ? (
      <>
        <FormTypeArt formType={form.form_type} size={big ? 62 : 56} />
        <span className="hidden"><FormQrCode bare url={qrUrl} size={600} onDownloadReady={registerQr} /></span>
      </>
    ) : <FormQrCode url={qrUrl} size={48} onDownloadReady={registerQr} />

    // Aesthetics-only (currently just Showcase Request) is left exactly as it's always been -
    // its own QR-driven automation, not part of the simplified click-through card below.
    if (isAestheticsOnly) {
      return (
        <div
          key={form.id}
          className={PLAYFUL_FORM_CARD}
        >
          <div
            className="absolute inset-x-0 top-0 h-[3px] [background:linear-gradient(90deg,transparent,var(--form-accent),transparent)] dark:[background:linear-gradient(90deg,transparent,var(--form-accent-dark),transparent)]"
            style={{ '--form-accent': form.accent_color || '#816937', '--form-accent-dark': form.accent_color || '#d7b974' } as React.CSSProperties}
          />
          <PlayfulFormCard seed={form.title.length + form.questions.length} />
          {pendingSubmissions > 0 && (
            <span className="absolute right-3 top-3 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-sm">
              {pendingSubmissions > 9 ? '9+' : pendingSubmissions}
            </span>
          )}
          {/* words first, starting at the top; the form's picture on the right (like the Studio cards) */}
          <div className={`flex items-start gap-3 ${big ? 'p-5' : 'p-4'}`}>
            <button onClick={() => setThemeEditFormId(form.id)} className="order-1 flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <p className="truncate font-serif text-[17px] font-black leading-tight tracking-tight text-[#111827] dark:text-white"><GoldLastWord text={form.title} /></p>
                <p className={`mt-1 text-xs font-medium leading-snug text-gray-500 dark:text-gray-400 ${big ? '' : 'line-clamp-2'}`}>{form.description || meta.description}</p>
                {/* question count and Showcase badge: one row, the same pill size */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex h-5 items-center rounded-full bg-[#C9A24D]/10 px-2 text-[10px] font-black uppercase leading-none tracking-wider text-[#8b7355] ring-1 ring-[#C9A24D]/20 dark:bg-[#C9A24D]/15 dark:text-[#e8cf8a]">{form.questions.length} questions</span>
                  <ShowcaseFormBadge formType={form.form_type} />
                </div>
              </div>
            </button>
            <span className="order-2 shrink-0">{formMedia}</span>
            <div className="order-3 flex shrink-0 items-center gap-1">
              <button onClick={() => handleDuplicateForm(form)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Duplicate" aria-label="Duplicate form">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className={`flex gap-2 px-4 pb-4 ${big ? 'px-5 pb-5' : ''}`}>
            <button
              onClick={() => setThemeEditFormId(form.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#C9A24D]/50 bg-[#C9A24D]/10 px-3 py-2 text-xs font-black text-[#8b7355] transition active:scale-95 hover:border-[#C9A24D] hover:bg-[#C9A24D]/15 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a]"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Theme
            </button>
            <button
              onClick={() => { qrDownloadFns.current[form.id]?.(); flashFormAction(`${form.id}-qr`) }}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition active:scale-95 ${
                justClickedFormAction === `${form.id}-qr`
                  ? 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-[#111827]'
                  : 'bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200'
              }`}
              aria-label="Download QR code"
              title="Download QR code"
            >
              {justClickedFormAction === `${form.id}-qr` ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setStatsModalFormId(form.id)}
              className="shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white transition active:scale-95 hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
              aria-label="View stats"
              title="View stats"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className={`space-y-2 border-t border-gray-100 px-4 py-3 text-xs dark:border-gray-800 ${big ? 'px-5' : ''}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">OpenHousePal Showcase Creator Link</p>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => { window.open(openHousePalFormUrl, '_blank', 'noopener,noreferrer') }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Open OpenHousePal link" aria-label="Open OpenHousePal link">
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { copyText(openHousePalFormUrl); flashFormAction(`${form.id}-ohp-row-copy`) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy OpenHousePal link" aria-label="Copy OpenHousePal link">
                  {justClickedFormAction === `${form.id}-ohp-row-copy` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {websiteFormUrl && (
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {websiteHostname || 'Website'} Showcase Creator Link
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => { window.open(websiteFormUrl, '_blank', 'noopener,noreferrer') }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Open website link" aria-label="Open website link">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { copyText(websiteFormUrl); flashFormAction(`${form.id}-website-row-copy`) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy website link" aria-label="Copy website link">
                    {justClickedFormAction === `${form.id}-website-row-copy` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { const fresh = submissions.filter(submission => !submission.is_reviewed); openResults(form.id, fresh.length === 1 ? fresh[0].id : '') }}
            className="mt-auto flex w-full items-center justify-between gap-2 border-t border-gray-300 bg-[#fbfaf7] px-4 py-2.5 text-left text-xs font-black text-gray-700 transition hover:border-[#C9A24D]/50 hover:bg-[#f4f1e8] dark:border-gray-800 dark:bg-white/5 dark:text-gray-300 dark:hover:border-[#C9A24D]/50 dark:hover:bg-white/10"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-[#8b7355]" />
              <span className="truncate">
                {pendingSubmissions === 0
                  ? 'No new responses yet'
                  : `${pendingSubmissions} new response${pendingSubmissions === 1 ? '' : 's'} · latest ${new Date((submissions.find(submission => !submission.is_reviewed) || submissions[0]).created_at).toLocaleDateString()}`}
              </span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>
        </div>
      )
    }

    // Custom and Onboarding forms can't have Campaigns, so there's no detail page worth sending
    // them to - everything stays right on the card, exactly as it's always been.
    if (!isCampaignEligible) {
      const slugDraft = getFormSlugDraft(form)
      const status = formSlugStatus[form.id] || 'idle'
      const message = formSlugMessage[form.id] || 'Check availability before saving.'
      const websiteBaseUrl = websitePublicBaseUrl(idxSite, idxDomains)
      const websiteDraftUrl = websiteBaseUrl ? `${websiteBaseUrl}/forms/${slugDraft || form.slug}` : websiteFormUrl
      const isEditingSlug = editingSlugFormId === form.id
      const openEditor = () => { setFormEditorOpenId(form.id); setIsBuilderOpen(true) }
      return (
        <div
          key={form.id}
          className={PLAYFUL_FORM_CARD}
        >
          <div
            className="absolute inset-x-0 top-0 h-[3px] [background:linear-gradient(90deg,transparent,var(--form-accent),transparent)] dark:[background:linear-gradient(90deg,transparent,var(--form-accent-dark),transparent)]"
            style={{ '--form-accent': form.accent_color || '#816937', '--form-accent-dark': form.accent_color || '#d7b974' } as React.CSSProperties}
          />
          <PlayfulFormCard seed={form.title.length + form.questions.length} />
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
            {form.form_type === 'custom' && (
              <button onClick={() => setDeleteFormTarget(form)} className="rounded-lg bg-white/90 p-1.5 text-gray-400 shadow-sm hover:bg-red-50 hover:text-red-600 dark:bg-[#151517]/90" aria-label="Delete form">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {pendingSubmissions > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-sm">
                {pendingSubmissions > 9 ? '9+' : pendingSubmissions}
              </span>
            )}
          </div>
          {/* words first, starting at the top; the form's picture (or QR) on the right, clear of the corner buttons */}
          <div className={`flex items-start gap-3 ${big ? 'p-5' : 'p-4'}`}>
            <span className={`order-2 shrink-0 ${form.form_type === 'custom' || pendingSubmissions > 0 ? 'mr-8' : ''}`}>{formMedia}</span>
            <button onClick={openEditor} className="order-1 flex min-w-0 flex-1 items-center gap-3 text-left">
              <div className="min-w-0">
                <p className="truncate font-serif text-[17px] font-black leading-tight tracking-tight text-[#111827] dark:text-white"><GoldLastWord text={form.title} /></p>
                <p className={`mt-1 text-xs font-medium leading-snug text-gray-500 dark:text-gray-400 ${big ? '' : 'line-clamp-2'}`}>{form.description || meta.description}</p>
                {/* question count and Showcase badge: one row, the same pill size */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex h-5 items-center rounded-full bg-[#C9A24D]/10 px-2 text-[10px] font-black uppercase leading-none tracking-wider text-[#8b7355] ring-1 ring-[#C9A24D]/20 dark:bg-[#C9A24D]/15 dark:text-[#e8cf8a]">{form.questions.length} questions</span>
                  <ShowcaseFormBadge formType={form.form_type} />
                </div>
              </div>
            </button>
          </div>

          <div className={`flex gap-2 px-4 pb-4 ${big ? 'px-5 pb-5' : ''}`}>
            <button
              onClick={openEditor}
              className="flex-1 rounded-lg border border-gray-300 bg-[#fbfaf7] px-3 py-2 text-xs font-black text-gray-600 transition active:scale-95 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300 dark:hover:border-[#C9A24D] dark:hover:text-[#e8cf8a]"
            >
              <Pencil className="mr-1.5 inline h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => setEditingSlugFormId(isEditingSlug ? '' : form.id)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-black transition active:scale-95 ${
                isEditingSlug
                  ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:border-[#C9A24D] dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a]'
                  : 'border-gray-300 bg-[#fbfaf7] text-gray-600 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300 dark:hover:border-[#C9A24D] dark:hover:text-[#e8cf8a]'
              }`}
            >
              <LinkIcon className="mr-1.5 inline h-3.5 w-3.5" /> {isEditingSlug ? 'Close' : 'Edit URL'}
            </button>
            <button
              onClick={() => handleDuplicateForm(form)}
              className="shrink-0 rounded-lg border border-[#C9A24D]/50 bg-[#C9A24D]/10 px-3 py-2 text-xs font-black text-[#8b7355] transition active:scale-95 hover:border-[#C9A24D] hover:bg-[#C9A24D]/15 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a]"
              title="Duplicate this form into an editable copy"
              aria-label="Duplicate this form into an editable copy"
            >
              <CopyPlus className="mr-1.5 inline h-3.5 w-3.5" /> Duplicate
            </button>
            <button
              onClick={() => { qrDownloadFns.current[form.id]?.(); flashFormAction(`${form.id}-qr`) }}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition active:scale-95 ${
                justClickedFormAction === `${form.id}-qr`
                  ? 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-[#111827]'
                  : 'bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200'
              }`}
              aria-label="Download QR code"
              title="Download QR code"
            >
              {justClickedFormAction === `${form.id}-qr` ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setStatsModalFormId(form.id)}
              className="shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white transition active:scale-95 hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
              aria-label="View stats"
              title="View stats"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className={`space-y-2 border-t border-gray-100 px-4 py-3 text-xs dark:border-gray-800 ${big ? 'px-5' : ''}`}>
            <div className={`-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors duration-500 ${justClickedFormAction === `${form.id}-ohp-row-copy` ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
              <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">OpenHousePal Link</p>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => { window.open(openHousePalFormUrl, '_blank', 'noopener,noreferrer') }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Open OpenHousePal link" aria-label="Open OpenHousePal link">
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { copyText(openHousePalFormUrl); flashFormAction(`${form.id}-ohp-row-copy`) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy OpenHousePal link" aria-label="Copy OpenHousePal link">
                  {justClickedFormAction === `${form.id}-ohp-row-copy` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {websiteFormUrl && (
              <div className={`-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1 transition-colors duration-500 ${justClickedFormAction === `${form.id}-website-row-copy` ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {websiteHostname || 'Website'} Link
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => { window.open(websiteFormUrl, '_blank', 'noopener,noreferrer') }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Open website link" aria-label="Open website link">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => { copyText(websiteFormUrl); flashFormAction(`${form.id}-website-row-copy`) }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy website link" aria-label="Copy website link">
                    {justClickedFormAction === `${form.id}-website-row-copy` ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { const fresh = submissions.filter(submission => !submission.is_reviewed); openResults(form.id, fresh.length === 1 ? fresh[0].id : '') }}
            className="mt-auto flex w-full items-center justify-between gap-2 border-t border-gray-300 bg-[#fbfaf7] px-4 py-2.5 text-left text-xs font-black text-gray-700 transition hover:border-[#C9A24D]/50 hover:bg-[#f4f1e8] dark:border-gray-800 dark:bg-white/5 dark:text-gray-300 dark:hover:border-[#C9A24D]/50 dark:hover:bg-white/10"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-[#8b7355]" />
              <span className="truncate">
                {pendingSubmissions === 0
                  ? 'No new responses yet'
                  : `${pendingSubmissions} new response${pendingSubmissions === 1 ? '' : 's'} · latest ${new Date((submissions.find(submission => !submission.is_reviewed) || submissions[0]).created_at).toLocaleDateString()}`}
              </span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          </button>

          {isEditingSlug && (
            <div className={`space-y-2 border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-800 ${big ? 'px-5 pb-5' : ''}`}>
              <div className="flex min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B]">
                <span className="flex max-w-[75%] shrink-0 items-center truncate border-r border-gray-200 bg-gray-50 px-2 py-2 text-[10px] font-black text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400">{agentHubPublicUrl}/</span>
                <input
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs font-semibold outline-none dark:text-white"
                  value={slugDraft}
                  onChange={(event) => {
                    // Cleaned as they type - spaces become hyphens, symbols drop - so the box shows the
                    // exact link that will be saved (Check/Save clean it the same way).
                    setFormSlugDrafts(current => ({ ...current, [form.id]: event.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-') }))
                    setFormSlugStatus(current => ({ ...current, [form.id]: 'idle' }))
                    setFormSlugMessage(current => ({ ...current, [form.id]: 'Check availability before saving.' }))
                  }}
                />
              </div>
              {websiteDraftUrl && (
                <div className="rounded-lg border border-gray-100 bg-[#fbfaf7] px-3 py-2 dark:border-gray-800 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Website Link will use the same ending</p>
                  {/* Same text-[10px] as the OpenHousePal prefix above it, and wraps (rather than
                      truncating with an ellipsis) so the full URL is readable even for the longer
                      local-dev /ohp-site-render/... proxy path. */}
                  <p className="mt-1 break-all text-[10px] font-semibold text-gray-600 dark:text-gray-300">{websiteDraftUrl}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => handleCheckFormSlug(form)} disabled={status === 'checking'} className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-black dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white">
                  {status === 'checking' ? 'Checking...' : 'Check'}
                </button>
                <button onClick={() => setPendingFormSlugSave(form)} disabled={status === 'checking' || status === 'taken'} className="flex-1 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
                  Save
                </button>
              </div>
              <p className={`text-xs font-bold ${
                status === 'available' || status === 'saved'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : status === 'taken' || status === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-500 dark:text-gray-400'
              }`}>
                {message}
              </p>
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        key={form.id}
        className={PLAYFUL_FORM_CARD}
      >
        {/* Dedicated strip (not a border) so its color isn't in a specificity contest with the
            border-gray-200/dark:border-gray-800 classes above - a plain background-color always wins. */}
        <div
          className="absolute inset-x-0 top-0 h-[3px] [background:linear-gradient(90deg,transparent,var(--form-accent),transparent)] dark:[background:linear-gradient(90deg,transparent,var(--form-accent-dark),transparent)]"
          style={{ '--form-accent': form.accent_color || '#816937', '--form-accent-dark': form.accent_color || '#d7b974' } as React.CSSProperties}
        />
        <PlayfulFormCard seed={form.title.length + form.questions.length} />
        {/* Just the form and what it's for - everything else (Edit, Duplicate, Campaigns, Stats,
            Results, and the link/Share info) lives on its detail page now, one click away. Custom
            and Onboarding forms never reach here - they're not Campaign-eligible, so they keep
            everything on the card itself (the branch above).
            Laid out like the Studio cards (user, 10/24): the words start at the top and use the
            card's full width, the form's picture sits on the right, the chips + arrow underneath. */}
        <button onClick={() => setCampaignsModalFormId(form.id)} className={`flex flex-1 flex-col text-left ${big ? 'p-5' : 'p-4'}`}>
          <span className="flex w-full items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-[17px] font-black leading-tight tracking-tight text-[#111827] dark:text-white"><GoldLastWord text={form.title} /></span>
              <span className={`mt-1 text-xs font-medium leading-snug text-gray-500 dark:text-gray-400 ${big ? 'block' : 'line-clamp-2'}`}>{form.description || meta.description}</span>
            </span>
            <span className="relative shrink-0">
              {formMedia}
              {pendingSubmissions > 0 && (
                <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white dark:ring-[#151517]">
                  {pendingSubmissions > 9 ? '9+' : pendingSubmissions}
                </span>
              )}
            </span>
          </span>
          <span className="mt-auto flex w-full items-end justify-between gap-2 pt-2.5">
            <span className="min-w-0">
              {/* question count and Showcase badge: one row, the same pill size */}
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex h-5 items-center rounded-full bg-[#C9A24D]/10 px-2 text-[10px] font-black uppercase leading-none tracking-wider text-[#8b7355] ring-1 ring-[#C9A24D]/20 dark:bg-[#C9A24D]/15 dark:text-[#e8cf8a]">{form.questions.length} questions</span>
                <ShowcaseFormBadge formType={form.form_type} />
              </span>
              {form.additional_campaign_count > 0 && (
                <span className="mt-1 block truncate text-[11px] font-bold text-[#8b7355] dark:text-[#e8cf8a]">
                  General + {form.additional_campaign_count} more campaign{form.additional_campaign_count === 1 ? '' : 's'}
                </span>
              )}
            </span>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#C9A24D]/25 text-[#8b7355] transition group-hover:translate-x-0.5 group-hover:border-[#C9A24D] group-hover:bg-[#C9A24D] group-hover:text-white dark:text-[#e8cf8a]">
              <ChevronRight className="h-4 w-4" />
            </span>
          </span>
        </button>
      </div>
    )
  }

  const moveDraggedSection = (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId) return
    layoutCustomizedRef.current = true

    setLayoutSections(current => {
      const dragged = current.find(section => section.id === draggedSectionId)
      if (!dragged) return current

      const withoutDragged = current.filter(section => section.id !== draggedSectionId)
      const targetIndex = withoutDragged.findIndex(section => section.id === targetId)
      const next = [...withoutDragged]
      next.splice(targetIndex, 0, dragged)
      // onDragOver fires continuously while hovering, not just once per target change -
      // return the same array reference when nothing actually moved to skip a re-render.
      const changed = next.some((section, index) => section.id !== current[index]?.id)
      return changed ? next : current
    })
    setSaveStatus('Unsaved Changes')
  }

  const updateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    setSocialLinks(current => current.map(link => link.id === id ? { ...link, ...updates } : link))
    setEditorSectionStatus(current => ({ ...current, 'Social Links': 'Incomplete' }))
    setSaveStatus('Unsaved Changes')
    if ('enabled' in updates) requestSave()  // a switch saves right away; links save with Save / on leaving the box
  }

  const updateContactCardField = (key: string, updates: Partial<ContactCardFields[string]>) => {
    setContactCard(current => ({ ...current, [key]: { ...current[key], ...updates } }))
    setSaveStatus('Unsaved Changes')
    if ('include' in updates) requestSave()  // switches save right away; typed labels/values with Save
  }

  const handleSaveAgentHubChanges = async (overrides?: Partial<Pick<SavedAgentHubData, 'recentSales' | 'myListings' | 'showSalesStats' | 'salesMinPrice' | 'salesCarousel' | 'listingsCarousel' | 'videosCarousel' | 'toursCarousel' | 'blogsCarousel' | 'salesAutoScroll' | 'listingsAutoScroll' | 'videosAutoScroll' | 'toursAutoScroll' | 'blogsAutoScroll' | 'reviewsCarousel' | 'reviewsAutoScroll' | 'reviewsOnProfile' | 'reviewsProfileButton' | 'videoLinks' | 'videoChannelUrl' | 'houseTourLinks' | 'houseTourUrl' | 'blogCards' | 'layoutSections' | 'visibleSectionIds'>>) => {
    // This function always sends the FULL current in-memory state as the new config (the backend
    // does a full replace, not a merge - see PUT /agent-hub/me/config). If it ran before the real
    // saved config has finished loading from the backend, profile/contact/etc. would still be at
    // their blank initial defaults and this would permanently wipe the agent's real data. The
    // Recent Sales and My Listings panels both auto-fetch-and-call-this on mount whenever their
    // slice of state is empty (the normal case before that load completes), so refuse to save
    // until agentHubDataReady confirms the real config is in state.
    if (!agentHubDataReady) return
    const savedSocialLinks: SavedSocialLink[] = socialLinks.map(({ id, label, url, enabled }) => ({
      id,
      label,
      url,
      enabled,
    }))
    // Strip any leftover base64 image (from the old inline-photo bug, pre-upload-endpoint) so a
    // stale draft can't permanently block every future save by itself blowing the config's size cap.
    const salesToSave = getEligibleSales(overrides?.recentSales || recentSales).map(sale =>
      sale.image?.startsWith('data:') ? { ...sale, image: undefined } : sale
    )
    const listingsToSave = getEligibleListings(overrides?.myListings || myListings).map(listing =>
      listing.image?.startsWith('data:') ? { ...listing, image: undefined } : listing
    )
    const showSalesStatsToSave = overrides?.showSalesStats ?? showSalesStats
    const salesMinPriceToSave = overrides?.salesMinPrice ?? salesMinPrice
    const salesCarouselToSave = overrides?.salesCarousel ?? salesCarousel
    const listingsCarouselToSave = overrides?.listingsCarousel ?? listingsCarousel
    const videosCarouselToSave = overrides?.videosCarousel ?? videosCarousel
    const toursCarouselToSave = overrides?.toursCarousel ?? toursCarousel
    const blogsCarouselToSave = overrides?.blogsCarousel ?? blogsCarousel
    const salesAutoScrollToSave = overrides?.salesAutoScroll ?? salesAutoScroll
    const listingsAutoScrollToSave = overrides?.listingsAutoScroll ?? listingsAutoScroll
    const videosAutoScrollToSave = overrides?.videosAutoScroll ?? videosAutoScroll
    const toursAutoScrollToSave = overrides?.toursAutoScroll ?? toursAutoScroll
    const blogsAutoScrollToSave = overrides?.blogsAutoScroll ?? blogsAutoScroll
    const reviewsCarouselToSave = overrides?.reviewsCarousel ?? reviewsCarousel
    const reviewsAutoScrollToSave = overrides?.reviewsAutoScroll ?? reviewsAutoScroll
    const reviewsOnProfileToSave = overrides?.reviewsOnProfile ?? reviewsOnProfile
    const reviewsProfileButtonToSave = overrides?.reviewsProfileButton ?? reviewsProfileButton
    const videosToSave = overrides?.videoLinks || videoLinks
    const videoChannelUrlToSave = overrides?.videoChannelUrl ?? videoChannelUrl
    const houseToursToSave = overrides?.houseTourLinks || houseTourLinks
    const houseTourUrlToSave = houseTourUrl
    const blogsToSave = overrides?.blogCards || blogCards
    const layoutSectionsToSave = overrides?.layoutSections || layoutSections
    const visibleSectionIdsToSave = overrides?.visibleSectionIds || visibleSectionIds

    const savedHub: SavedAgentHubData = {
      profile,
      contact,
      socialLinks: savedSocialLinks,
      contactCard: { fields: contactCard },
      recentSales: salesToSave,
      myListings: listingsToSave,
      showSalesStats: showSalesStatsToSave,
      salesMinPrice: salesMinPriceToSave,
      salesCarousel: salesCarouselToSave,
      listingsCarousel: listingsCarouselToSave,
      videosCarousel: videosCarouselToSave,
      toursCarousel: toursCarouselToSave,
      blogsCarousel: blogsCarouselToSave,
      salesAutoScroll: salesAutoScrollToSave,
      listingsAutoScroll: listingsAutoScrollToSave,
      videosAutoScroll: videosAutoScrollToSave,
      toursAutoScroll: toursAutoScrollToSave,
      blogsAutoScroll: blogsAutoScrollToSave,
      reviewsCarousel: reviewsCarouselToSave,
      reviewsAutoScroll: reviewsAutoScrollToSave,
      reviewsOnProfile: reviewsOnProfileToSave,
      reviewsProfileButton: reviewsProfileButtonToSave,
      visitorDarkMode,
      videoLinks: videosToSave,
      videoChannelUrl: videoChannelUrlToSave,
      houseTourLinks: houseToursToSave,
      houseTourUrl: houseTourUrlToSave,
      blogCards: blogsToSave,
      profilePhotoUrl,
      profilePhotoPosition,
      layoutSections: layoutSectionsToSave,
      layoutCustomized: layoutCustomizedRef.current,
      visibleSectionIds: visibleSectionIdsToSave,
      savedAt: new Date().toISOString(),
    }
    const nextEditorSectionStatus: Record<string, 'Complete' | 'Incomplete'> = {
      Profile: profile.name.trim() && profile.brokerage.trim() && profile.title.trim() && profile.market.trim() && profile.licenseNumber.trim() ? 'Complete' : 'Incomplete',
      Contact: contact.call.trim() && contact.text.trim() && contact.email.trim() ? 'Complete' : 'Incomplete',
      'Social Links': socialLinks.some(link => link.enabled && link.url.trim()) ? 'Complete' : 'Incomplete',
    }

    setHubSaving(true)
    api.agentHub.updateProfile({ title: profile.title, market: profile.market, name: profile.name, brokerage: profile.brokerage }).catch(() => {})
    // Merge onto the latest saved copy: Settings edits the same Agent Hub config, and keys this
    // editor doesn't manage (the hub's theme, video auto-update, ...) must never be wiped by a save here.
    const latest = await api.agentHub.getMine().catch(() => null)
    const baseConfig = upgradeHubPhones((latest && latest.success && latest.data?.config) ? latest.data.config as Record<string, unknown> : {})
    // profile is merged, not replaced - Settings keeps fields this editor doesn't have (team).
    const baseProfile = (baseConfig.profile && typeof baseConfig.profile === 'object') ? baseConfig.profile as Record<string, unknown> : {}
    const configSaveResult = await api.agentHub.saveConfig({ ...baseConfig, ...savedHub, profile: { ...baseProfile, ...savedHub.profile } } as SavedAgentHubData).catch(() => ({ success: false as const, error: 'Network error' }))
    setHubSaving(false)
    if (configSaveResult.success) flashSaved()
    if (!configSaveResult.success) {
      // Don't mark this saved (and don't touch localStorage as if it were) - the editor would
      // otherwise show "Saved" with a full Recent Sales list that never actually reached the
      // server, which is exactly what silently broke the Brag Sheet/public page before this fix.
      showToast(configSaveResult.error || 'Unable to save your Agent Hub changes. Please try again.', 'error')
      setSaveStatus('Unsaved Changes')
      return
    }

    localStorage.setItem('agentHubSavedData', JSON.stringify(savedHub))
    localStorage.setItem('agentHubEditorSectionStatus', JSON.stringify(nextEditorSectionStatus))
    localStorage.setItem('agentHubProfile', JSON.stringify(profile))
    localStorage.setItem('agentHubContact', JSON.stringify(contact))
    localStorage.setItem('agentHubSocialLinks', JSON.stringify(savedSocialLinks))
    localStorage.setItem('agentHubRecentSales', JSON.stringify(salesToSave))
    localStorage.setItem('agentHubMyListings', JSON.stringify(listingsToSave))
    localStorage.setItem('agentHubShowSalesStats', JSON.stringify(showSalesStatsToSave))
    localStorage.setItem('agentHubSalesCarousel', JSON.stringify(salesCarouselToSave))
    localStorage.setItem('agentHubListingsCarousel', JSON.stringify(listingsCarouselToSave))
    localStorage.setItem('agentHubVideosCarousel', JSON.stringify(videosCarouselToSave))
    localStorage.setItem('agentHubToursCarousel', JSON.stringify(toursCarouselToSave))
    localStorage.setItem('agentHubBlogsCarousel', JSON.stringify(blogsCarouselToSave))
    localStorage.setItem('agentHubSalesAutoScroll', JSON.stringify(salesAutoScrollToSave))
    localStorage.setItem('agentHubListingsAutoScroll', JSON.stringify(listingsAutoScrollToSave))
    localStorage.setItem('agentHubVideosAutoScroll', JSON.stringify(videosAutoScrollToSave))
    localStorage.setItem('agentHubToursAutoScroll', JSON.stringify(toursAutoScrollToSave))
    localStorage.setItem('agentHubBlogsAutoScroll', JSON.stringify(blogsAutoScrollToSave))
    localStorage.setItem('agentHubVisitorDarkMode', JSON.stringify(visitorDarkMode))
    localStorage.setItem('agentHubVideoLinks', JSON.stringify(videosToSave))
    localStorage.setItem('agentHubVideoChannelUrl', videoChannelUrlToSave)
    localStorage.setItem('agentHubHouseTourLinks', JSON.stringify(houseToursToSave))
    localStorage.setItem('agentHubHouseTourUrl', houseTourUrlToSave)
    localStorage.setItem('agentHubBlogCards', JSON.stringify(blogsToSave))
    localStorage.setItem('agentHubProfilePhotoUrl', profilePhotoUrl)
    localStorage.setItem('agentHubVisibleSections', JSON.stringify(visibleSectionIdsToSave))
    localStorage.setItem('agentHubLayoutSections', JSON.stringify(layoutSectionsToSave))
    setRecentSales(salesToSave)
    setMyListings(listingsToSave)
    setLayoutSections(layoutSectionsToSave)
    setLastSavedHub(savedHub)
    setEditorSectionStatus(nextEditorSectionStatus)
    const isAutoPublished = nextEditorSectionStatus.Profile === 'Complete' && nextEditorSectionStatus.Contact === 'Complete' && nextEditorSectionStatus['Social Links'] === 'Complete'
    setStatus(isAutoPublished ? 'Published' : 'Draft')
    setSaveStatus('Saved')
  }

  useEffect(() => {
    if (saveRequest) handleSaveAgentHubChanges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequest])

  // Text boxes save with their Save button, or when you leave the box - never on every letter.
  const saveTextIfChanged = () => {
    if (saveStatusRef.current !== 'Saved' && !hubSaving) handleSaveAgentHubChanges()
  }

  const handleCancelAgentHubChanges = () => {
    if (!lastSavedHub) return

    setProfile({ ...lastSavedHub.profile, about: lastSavedHub.profile.about || '', licenseNumber: lastSavedHub.profile.licenseNumber || '', team: lastSavedHub.profile.team || '' })
    setContact(lastSavedHub.contact)
    setProfilePhotoUrl(lastSavedHub.profilePhotoUrl)
    setProfilePhotoPosition(lastSavedHub.profilePhotoPosition || { x: 50, y: 50 })
    setLayoutSections(normalizeLayoutSections(lastSavedHub.layoutSections))
    setRecentSales(lastSavedHub.recentSales || [])
    setMyListings(lastSavedHub.myListings || [])
    setShowSalesStats(lastSavedHub.showSalesStats ?? true)
    setSalesCarousel(lastSavedHub.salesCarousel ?? true)
    setListingsCarousel(lastSavedHub.listingsCarousel ?? true)
    setVideosCarousel(lastSavedHub.videosCarousel ?? false)
    setToursCarousel(lastSavedHub.toursCarousel ?? false)
    setBlogsCarousel(lastSavedHub.blogsCarousel ?? false)
    setSalesAutoScroll(lastSavedHub.salesAutoScroll ?? true)
    setListingsAutoScroll(lastSavedHub.listingsAutoScroll ?? true)
    setVideosAutoScroll(lastSavedHub.videosAutoScroll ?? false)
    setToursAutoScroll(lastSavedHub.toursAutoScroll ?? false)
    setBlogsAutoScroll(lastSavedHub.blogsAutoScroll ?? false)
    setVisitorDarkMode(lastSavedHub.visitorDarkMode ?? false)
    setVideoLinks(lastSavedHub.videoLinks || [{ id: 'video-1', title: 'YouTube Video', link: '' }])
    setVideoChannelUrl(lastSavedHub.videoChannelUrl || '')
    setHouseTourLinks(lastSavedHub.houseTourLinks || [{ id: 'tour-1', title: 'House Tour', link: '' }])
    setHouseTourUrl(lastSavedHub.houseTourUrl || '')
    setBlogCards(lastSavedHub.blogCards || [])
    setSocialLinks(current => current.map(link => {
      const saved = lastSavedHub.socialLinks.find(item => item.id === link.id)
      return saved ? { ...link, url: saved.url, enabled: saved.enabled } : link
    }))

    try {
      const savedShowStats = localStorage.getItem('agentHubShowSalesStats')
      if (savedShowStats) setShowSalesStats(JSON.parse(savedShowStats))
      const savedSalesCarousel = localStorage.getItem('agentHubSalesCarousel')
      if (savedSalesCarousel) setSalesCarousel(JSON.parse(savedSalesCarousel))
      const savedVideosCarousel = localStorage.getItem('agentHubVideosCarousel')
      if (savedVideosCarousel) setVideosCarousel(JSON.parse(savedVideosCarousel))
      const savedToursCarousel = localStorage.getItem('agentHubToursCarousel')
      if (savedToursCarousel) setToursCarousel(JSON.parse(savedToursCarousel))
      const savedBlogsCarousel = localStorage.getItem('agentHubBlogsCarousel')
      if (savedBlogsCarousel) setBlogsCarousel(JSON.parse(savedBlogsCarousel))
      const savedStatus = localStorage.getItem('agentHubEditorSectionStatus')
      if (savedStatus) setEditorSectionStatus(JSON.parse(savedStatus))
      const savedVisitorDarkMode = localStorage.getItem('agentHubVisitorDarkMode')
      if (savedVisitorDarkMode) setVisitorDarkMode(JSON.parse(savedVisitorDarkMode))
    } catch {
      setEditorSectionStatus({
        Profile: 'Incomplete',
        Contact: 'Incomplete',
        'Social Links': 'Incomplete',
      })
    }

    const isAutoPublished = Boolean(
      (lastSavedHub.profile.name || '').trim() &&
      (lastSavedHub.profile.brokerage || '').trim() &&
      (lastSavedHub.profile.title || '').trim() &&
      (lastSavedHub.profile.market || '').trim() &&
      (lastSavedHub.profile.licenseNumber || '').trim() &&
      (lastSavedHub.contact.call || '').trim() &&
      (lastSavedHub.contact.text || '').trim() &&
      (lastSavedHub.contact.email || '').trim() &&
      lastSavedHub.socialLinks.some(link => link.enabled && link.url.trim())
    )
    setStatus(isAutoPublished ? 'Published' : 'Draft')
    setSaveStatus('Saved')
  }

  const toggleReviewsOnHub = async () => {
    if (!reviewsData) return
    const on = !reviewsData.show_on_hub
    setReviewsData({ ...reviewsData, show_on_hub: on })
    const r = await api.agentHub.updateReviewSettings({ show_on_hub: on })
    if (!r.success) setReviewsData(d => d ? { ...d, show_on_hub: !on } : d)
  }

  // 4 and 5 stars only, everywhere public (Agent Hub + IDX website) - the same switch as Studio -> Reviews.
  const toggleReviewsMinRating = async () => {
    if (!reviewsData) return
    const next = (reviewsData.min_rating ?? 1) >= 4 ? 1 : 4
    const prev = reviewsData.min_rating ?? 1
    setReviewsData({ ...reviewsData, min_rating: next })
    const r = await api.agentHub.updateReviewSettings({ min_rating: next })
    if (!r.success) setReviewsData(d => d ? { ...d, min_rating: prev } : d)
  }

  const toggleSectionVisibility = (id: string) => {
    if (id === 'reviews') { toggleReviewsOnHub(); return }
    const next = layoutSections.map(section => section.id === id ? { ...section, visible: !section.visible } : section)
    setLayoutSections(next)
    setSaveStatus('Unsaved Changes')
    handleSaveAgentHubChanges({ layoutSections: next, visibleSectionIds: next.filter(section => section.visible).map(section => section.id) })
  }

  // Profile/Contact fields feed things read straight from the backend elsewhere (e.g. the Open
  // House Cheat Sheet, which fetches the saved Agent Hub config fresh each time it's built) - so
  // unlike the rest of this page, edits here need to reach the backend without waiting on the
  // user to notice and click the top "Save Changes" button, or those consumers stay stale.
  const profileAutosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleProfileAutosave = () => {
    if (profileAutosaveTimeout.current) clearTimeout(profileAutosaveTimeout.current)
    profileAutosaveTimeout.current = setTimeout(() => { handleSaveAgentHubChanges() }, 1200)
  }

  const updateProfileField = (label: string, value: string) => {
    const fieldMap: Record<string, keyof typeof profile> = {
      'Agent name': 'name',
      'Professional title': 'title',
      'Brokerage name': 'brokerage',
      'Market or service area': 'market',
      'About me': 'about',
      'RE License number': 'licenseNumber',
      'Team name': 'team',
    }
    const key = fieldMap[label]
    if (!key) return

    setProfile(current => ({ ...current, [key]: value }))
    setEditorSectionStatus(current => ({ ...current, Profile: 'Incomplete' }))
    setSaveStatus('Unsaved Changes')
    // No save per letter (owner, 10/24) - Save button, or leaving the box (saveTextIfChanged).
  }

  const updateContactField = (label: string, value: string) => {
    const fieldMap: Record<string, keyof typeof contact> = {
      'Call button': 'call',
      'Text button': 'text',
      'Email button': 'email',
    }
    const key = fieldMap[label]
    if (!key) return

    setContact(current => ({ ...current, [key]: value }))
    setEditorSectionStatus(current => ({ ...current, Contact: 'Incomplete' }))
    setSaveStatus('Unsaved Changes')
  }

  const getProfileFieldValue = (label: string, fallback: string) => {
    const fieldMap: Record<string, keyof typeof profile> = {
      'Agent name': 'name',
      'Professional title': 'title',
      'Brokerage name': 'brokerage',
      'Market or service area': 'market',
      'About me': 'about',
      'RE License number': 'licenseNumber',
      'Team name': 'team',
    }
    const key = fieldMap[label]
    return key ? profile[key] : fallback
  }

  const getContactFieldValue = (label: string, fallback: string) => {
    const fieldMap: Record<string, keyof typeof contact> = {
      'Call button': 'call',
      'Text button': 'text',
      'Email button': 'email',
    }
    const key = fieldMap[label]
    return key ? contact[key] : fallback
  }

  const getEditorSectionStatus = (title: string) => {
    if (title === 'Contact Card') return 'Complete'
    return editorSectionStatus[title] || 'Incomplete'
  }

  const handleCheckSlug = async () => {
    const normalizedSlug = toAgentHubSlug(agentHubSlug)
    setAgentHubSlug(normalizedSlug)
    setSlugStatus('checking')
    setSlugMessage('Checking URL...')
    const response = await api.agentHub.checkSlug(normalizedSlug)

    if (!response.success || !response.data) {
      setSlugStatus('error')
      setSlugMessage(response.error || 'Unable to check URL right now.')
      return
    }

    if (response.data.available) {
      setSlugStatus('available')
      setSlugMessage(response.data.owned_by_current_user ? 'This URL is already yours.' : 'This URL is available.')
    } else {
      setSlugStatus('taken')
      setSlugMessage('This URL is already being used.')
    }
  }

  const handleSaveSlug = async () => {
    const normalizedSlug = toAgentHubSlug(agentHubSlug)
    setAgentHubSlug(normalizedSlug)
    setSlugStatus('checking')
    setSlugMessage('Saving URL...')
    const check = await api.agentHub.checkSlug(normalizedSlug)
    if (!check.success || !check.data?.available) {
      setSlugStatus(check.data?.available === false ? 'taken' : 'error')
      setSlugMessage(check.error || 'This URL is already being used.')
      return
    }
    const response = await api.agentHub.updateSlug(normalizedSlug)

    if (response.success && response.data) {
      setAgentHubSlug(response.data.slug)
      setSlugStatus('saved')
      setSlugMessage('This URL is reserved for your Agent Hub.')
      setSaveStatus('Saved')
      return
    }

    setSlugStatus(response.error?.includes('already') ? 'taken' : 'error')
    setSlugMessage(response.error || 'Unable to save URL right now.')
  }

  const handleCopyPublicUrl = async () => {
    await copyText(agentHubShareUrl)
    setSlugMessage('Public URL copied.')
  }

  const handleOpenPublicPage = () => {
    window.open(agentHubShareUrl, '_blank', 'noopener,noreferrer')
  }

  const handleSharePublicUrl = async () => {
    const shareUrl = agentHubShareUrl
    if (navigator.share) {
      await navigator.share({ title: `${profile.name || 'Agent'} Agent Hub`, url: shareUrl })
      return
    }
    await copyText(shareUrl)
    setSlugMessage('Public URL copied for sharing.')
  }

  const handleProfilePhotoChange = async (file?: File) => {
    if (!file) return
    setPhotoUploading(true)
    setPhotoError('')
    // Any phone photo (PNG, WebP, a big camera shot) becomes a right-sized JPG first - same as
    // Settings and the setup flow.
    let jpg: File = file
    try {
      if (!(file.type === 'image/jpeg' && file.size < 4.5 * 1024 * 1024)) jpg = await toJpeg(file)
    } catch {
      setPhotoError('That photo couldn’t be read - please try a JPG or PNG.')
      setPhotoUploading(false)
      return
    }
    const response = await api.agentHub.uploadPhoto(jpg)
    if (response.success && response.data) {
      const url = response.data.photo_url.startsWith('http') ? response.data.photo_url : `${API_BASE_URL}${response.data.photo_url}`
      setProfilePhotoUrl(url)
      setProfilePhotoPosition({ x: 50, y: 50 })
      setEditorSectionStatus(current => ({ ...current, Profile: 'Incomplete' }))
      setSaveStatus('Unsaved Changes')
    } else {
      setPhotoError(response.error || 'Unable to upload photo. Please try a JPG under 5MB.')
    }
    setPhotoUploading(false)
  }

  const updateFormField = (formId: string, field: 'title' | 'headline' | 'subtitle' | 'description' | 'success_heading' | 'success_message' | 'accent_color', value: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, [field]: value } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const toggleFormBranding = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, show_branding: !form.show_branding } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const toggleFormDarkMode = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, dark_mode: !form.dark_mode } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  // A form's look: the Agent Hub's (default) or its own from the hub's choices (lib/formLook).
  const updateFormLook = (formId: string, patch: FormLookFields) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, ...patch } as AgentFormConfig : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }
  // "Use this look on all my forms" - saved straight away for every form (this one included).
  const applyFormLookToAll = async (formId: string) => {
    const form = agentForms.find(item => item.id === formId)
    if (!form) return false
    const res = await api.forms.updateAllLook({
      look_mode: form.look_mode === 'custom' ? 'custom' : form.look_mode === 'brand' ? 'brand' : 'hub',
      look_theme: form.look_theme || 'classic', accent_color: form.accent_color || undefined, luxe_metal: form.luxe_metal || 'gold', dark_mode: !!form.dark_mode,
    })
    if (!res.success || !res.data) return false
    const byId = new Map(res.data.map(item => [item.id, item]))
    // only the look fields - unsaved edits to the open form's questions/copy stay as they are
    setAgentForms(current => current.map(item => {
      const saved = byId.get(item.id)
      return saved ? { ...item, look_mode: saved.look_mode, look_theme: saved.look_theme, luxe_metal: saved.luxe_metal, accent_color: saved.accent_color, dark_mode: saved.dark_mode } : item
    }))
    for (const saved of res.data) {
      const prev = lastSavedFormsRef.current[saved.id]
      if (prev) lastSavedFormsRef.current[saved.id] = { ...prev, look_mode: saved.look_mode, look_theme: saved.look_theme, luxe_metal: saved.luxe_metal, accent_color: saved.accent_color, dark_mode: saved.dark_mode }
    }
    return true
  }

  const toggleFormRedirect = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, redirect_to_agent_hub: !form.redirect_to_agent_hub } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const toggleFormShowcaseRedirect = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, redirect_to_showcase: form.redirect_to_showcase === false } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const toggleFormPropertyPhotoCarousel = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, property_photo_carousel: !form.property_photo_carousel } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const toggleFormBackgroundEffects = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, background_effects: !(form.background_effects !== false) } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const toggleFormWelcomeTextEffects = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, welcome_text_effects: !(form.welcome_text_effects !== false) } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const updateFormBrandingLayout = (formId: string, layout: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated') => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, branding_layout: layout } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const reorderFormQuestions = (formId: string, draggedQuestionId: string, targetQuestionId: string) => {
    if (draggedQuestionId === targetQuestionId) return
    setAgentForms(current => current.map(form => {
      if (form.id !== formId) return form
      const questions = [...form.questions]
      const fromIndex = questions.findIndex(question => question.id === draggedQuestionId)
      const toIndex = questions.findIndex(question => question.id === targetQuestionId)
      if (fromIndex === -1 || toIndex === -1) return form
      const [moved] = questions.splice(fromIndex, 1)
      questions.splice(toIndex, 0, moved)
      return { ...form, questions }
    }))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const updateFormLinkedProperty = (formId: string, property: LinkedProperty | null) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, linked_property: property } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const updateFormQuestion = (formId: string, questionId: string, updates: Partial<FormQuestion>) => {
    setAgentForms(current => current.map(form => form.id === formId
      ? { ...form, questions: form.questions.map(question => question.id === questionId ? { ...question, ...updates } : question) }
      : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const removeFormQuestion = (formId: string, questionId: string) => {
    setAgentForms(current => current.map(form => form.id === formId
      ? { ...form, questions: form.questions.filter(question => question.locked || question.id !== questionId) }
      : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
  }

  const addFormQuestion = (formId: string, type: FormQuestion['type'] = 'short_text') => {
    const newId = `custom-${Date.now()}`
    setAgentForms(current => current.map(form => {
      if (form.id !== formId) return form
      const newQuestion: FormQuestion = { id: newId, type, label: 'New question', required: false, locked: false }
      if (type === 'select' || type === 'multi_select') newQuestion.options = ['Choice 1', 'Choice 2']
      return { ...form, questions: [...form.questions, newQuestion] }
    }))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
    setFormIsDirty(current => ({ ...current, [formId]: true }))
    return newId
  }

  const saveForm = async (formId: string) => {
    const form = agentForms.find(item => item.id === formId)
    if (!form) return

    setFormSaveStatus(current => ({ ...current, [formId]: 'saving' }))
    const cleanedQuestions = form.questions.map(question =>
      question.type === 'select' || question.type === 'multi_select'
        ? { ...question, options: (question.options || []).map(option => option.trim()).filter(Boolean) }
        : question
    )
    const response = await api.forms.updateForm(formId, {
      title: form.title,
      headline: form.headline,
      subtitle: form.subtitle,
      questions: cleanedQuestions,
      success_heading: form.success_heading,
      success_message: form.success_message,
      accent_color: form.accent_color,
      show_branding: form.show_branding,
      dark_mode: form.dark_mode,
      look_mode: form.look_mode || 'hub',
      look_theme: form.look_theme || undefined,
      luxe_metal: form.luxe_metal || undefined,
      redirect_to_agent_hub: form.redirect_to_agent_hub,
      redirect_to_showcase: form.redirect_to_showcase !== false,
      property_photo_carousel: form.property_photo_carousel,
      background_effects: form.background_effects !== false,
      welcome_text_effects: form.welcome_text_effects !== false,
      branding_layout: form.branding_layout,
      linked_property: form.linked_property ?? null,
    })

    if (response.success && response.data) {
      setAgentForms(current => current.map(item => item.id === formId ? response.data! : item))
      lastSavedFormsRef.current[formId] = response.data
      setFormSaveStatus(current => ({ ...current, [formId]: 'saved' }))
      setFormIsDirty(current => ({ ...current, [formId]: false }))
    } else {
      setFormSaveStatus(current => ({ ...current, [formId]: 'error' }))
    }
  }

  const handleResetFormToDefault = async (formId: string) => {
    const response = await api.forms.resetToDefault(formId)
    if (response.success && response.data) {
      setAgentForms(current => current.map(item => item.id === formId ? response.data! : item))
      lastSavedFormsRef.current[formId] = response.data
      setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
      setFormIsDirty(current => ({ ...current, [formId]: false }))
    }
  }

  const handleRequestCloseFormBuilder = () => {
    if (formIsDirty[formEditorOpenId]) {
      setPendingDiscardFormId(formEditorOpenId)
      return
    }
    setIsBuilderOpen(false)
  }

  const handleCloseThemeEditor = () => {
    const snapshot = lastSavedFormsRef.current[themeEditFormId]
    if (snapshot) {
      setAgentForms(current => current.map(item => item.id === themeEditFormId ? snapshot : item))
    }
    setFormIsDirty(current => ({ ...current, [themeEditFormId]: false }))
    setFormSaveStatus(current => ({ ...current, [themeEditFormId]: 'idle' }))
    setThemeEditFormId('')
  }

  const handleSaveThemeEditor = async () => {
    const id = themeEditFormId
    await saveForm(id)
    // let the button's "Saved" tick land before the window closes
    window.setTimeout(() => setThemeEditFormId(current => current === id ? '' : current), 750)
  }

  const handleConfirmDiscardFormChanges = () => {
    const snapshot = lastSavedFormsRef.current[pendingDiscardFormId]
    if (snapshot) {
      setAgentForms(current => current.map(item => item.id === pendingDiscardFormId ? snapshot : item))
    }
    setFormIsDirty(current => ({ ...current, [pendingDiscardFormId]: false }))
    setFormSaveStatus(current => ({ ...current, [pendingDiscardFormId]: 'idle' }))
    setPendingDiscardFormId('')
    setIsBuilderOpen(false)
  }

  const getFormSlugDraft = (form: AgentFormConfig) => formSlugDrafts[form.id] ?? form.slug

  const handleCheckFormSlug = async (form: AgentFormConfig) => {
    const normalized = toAgentHubSlug(getFormSlugDraft(form))
    setFormSlugDrafts(current => ({ ...current, [form.id]: normalized }))
    setFormSlugStatus(current => ({ ...current, [form.id]: 'checking' }))
    setFormSlugMessage(current => ({ ...current, [form.id]: 'Checking link...' }))
    const response = await api.forms.checkSlug(form.id, normalized)

    if (!response.success || !response.data) {
      setFormSlugStatus(current => ({ ...current, [form.id]: 'error' }))
      setFormSlugMessage(current => ({ ...current, [form.id]: response.error || 'Unable to check this link right now.' }))
      return
    }

    if (response.data.available) {
      setFormSlugStatus(current => ({ ...current, [form.id]: 'available' }))
      setFormSlugMessage(current => ({ ...current, [form.id]: 'This link is available.' }))
    } else {
      setFormSlugStatus(current => ({ ...current, [form.id]: 'taken' }))
      setFormSlugMessage(current => ({ ...current, [form.id]: "You're already using this link for another form." }))
    }
  }

  const handleSaveFormSlug = async (form: AgentFormConfig) => {
    const normalized = toAgentHubSlug(getFormSlugDraft(form))
    setFormSlugStatus(current => ({ ...current, [form.id]: 'checking' }))
    setFormSlugMessage(current => ({ ...current, [form.id]: 'Saving link...' }))
    const response = await api.forms.updateSlug(form.id, normalized)

    if (response.success && response.data) {
      setAgentForms(current => current.map(item => item.id === form.id ? response.data! : item))
      setFormSlugDrafts(current => ({ ...current, [form.id]: response.data!.slug }))
      setFormSlugStatus(current => ({ ...current, [form.id]: 'saved' }))
      setFormSlugMessage(current => ({ ...current, [form.id]: 'This link is live.' }))
      return
    }

    setFormSlugStatus(current => ({ ...current, [form.id]: response.error?.includes('already') ? 'taken' : 'error' }))
    setFormSlugMessage(current => ({ ...current, [form.id]: response.error || 'Unable to save this link right now.' }))
  }

  const handleCreateForm = async () => {
    if (creatingForm) return

    setCreatingForm(true)
    const response = await api.forms.createForm('Untitled Form')
    if (response.success && response.data) {
      setAgentForms(current => [...current, response.data!].sort((a, b) => a.order_index - b.order_index))
      lastSavedFormsRef.current[response.data.id] = response.data
      setFormEditorOpenId(response.data.id)
      setIsBuilderOpen(true)
    }
    setCreatingForm(false)
  }

  const handleDuplicateForm = async (form: AgentFormConfig) => {
    const response = await api.forms.duplicate(form.id)
    if (response.success && response.data) {
      setAgentForms(current => [...current, response.data!].sort((a, b) => a.order_index - b.order_index))
      lastSavedFormsRef.current[response.data.id] = response.data
      showToast(form.form_type === 'custom' ? 'Form duplicated' : 'Copy created in Custom Forms', 'success')
    } else {
      showToast(response.error || 'Unable to duplicate this form. Please try again.', 'error')
    }
  }

  const handleConfirmDeleteForm = async () => {
    if (!deleteFormTarget) return
    setDeletingForm(true)
    const response = await api.forms.deleteForm(deleteFormTarget.id)
    if (response.success) {
      setAgentForms(current => current.filter(form => form.id !== deleteFormTarget.id))
      setFormSubmissionsByFormId(current => {
        const next = { ...current }
        delete next[deleteFormTarget.id]
        return next
      })
      setDeleteFormTarget(null)
    }
    setDeletingForm(false)
  }

  const handleConfirmDeleteSubmission = async () => {
    if (!deleteSubmissionTarget) return
    setDeletingSubmission(true)
    const response = await api.forms.deleteSubmission(deleteSubmissionTarget.id)
    if (response.success) {
      setFormSubmissionsByFormId(current => ({
        ...current,
        [deleteSubmissionTarget.form_id]: (current[deleteSubmissionTarget.form_id] || []).filter(submission => submission.id !== deleteSubmissionTarget.id),
      }))
      setDeleteSubmissionTarget(null)
    }
    setDeletingSubmission(false)
  }

  if (!created) {
    return (
      <main className="agent-hub-admin min-h-screen bg-[#faf9f7] px-4 py-10 dark:bg-[#0B0B0B]">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C9A24D]/15 text-[#8b7355]">
            <Globe className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-[#111827]">Create your Agent Hub</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-gray-600">
            Create your personal real estate page to share your contact information, recent sales, videos, blogs, services, and more.
          </p>
          <button onClick={() => setCreated(true)} className="mt-8 rounded-2xl bg-[#111827] px-6 py-4 font-black text-white shadow-lg">
            Create My Agent Hub
          </button>
        </div>
      </main>
    )
  }

  // Forms & Invites (user, 10/24 - "sometimes glitches"): the house loader stays up until the forms
  // are in, then the page arrives in one piece - no half-built page with a spinner in the middle.
  if (isFormsTabGroup && formsLoading) return <OhpLoader label="Loading your forms" />

  return (
    <main className={`agent-hub-admin min-h-screen bg-[#faf9f7] text-[#111827] dark:bg-[#0B0B0B] dark:text-white ${isFormsTabGroup ? 'forms-page-in' : ''}`}>
      {isFormsTabGroup && <style dangerouslySetInnerHTML={{ __html: '.forms-page-in{animation:formsPageIn .5s ease-out backwards}@keyframes formsPageIn{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.forms-page-in{animation:none}}' }} />}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        {isFormsTabGroup ? (
          <>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <PageHeader
                icon={FileText}
                kicker="Forms & Invites"
                title={formsView === 'invites' ? <>Invite them in, <em>in style</em></> : <>Capture every lead, <em>your way</em></>}
                subtitle={formsView === 'invites'
                  ? 'Beautiful invitations for open houses, broker’s opens and client dinners - one link, every RSVP in one place.'
                  : 'Create and share lead-capture forms, then track responses and open house requests right here.'}
                subtitleClassName="xl:max-w-none xl:whitespace-nowrap"
                backHref="/studio"
                backLabel="Tools"
                asideClassName="w-full lg:w-auto lg:-mt-5"
                tabs={formsView === 'invites' ? <InvitesNewChips /> : (
                  // New results, as one-tap shortcuts: a form's chip opens its responses; the
                  // Cheat Sheet one jumps to the Open House Requests section.
                  <div className="flex min-h-[36px] items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none]">
                    <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">
                      <span className="relative flex h-2 w-2">
                        {newResultForms.length + (openHouseRequestActionCount > 0 ? 1 : 0) > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />}
                        <span className={`relative inline-flex h-2 w-2 rounded-full ${newResultForms.length + (openHouseRequestActionCount > 0 ? 1 : 0) > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      </span>
                      New
                    </span>
                    {openHouseRequestActionCount > 0 && (
                      <button
                        onClick={() => document.getElementById('forms-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-red-400 hover:shadow-md dark:border-red-500/30 dark:bg-white/[0.06] dark:text-white"
                      >
                        <Zap className="h-3.5 w-3.5 text-[#C9A24D]" /> Cheat Sheet request
                        <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{openHouseRequestActionCount > 9 ? '9+' : openHouseRequestActionCount}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
                    {newResultPeople.map(({ form, submission }) => (
                      <button
                        key={submission.id}
                        onClick={() => openResults(form.id, submission.id)}
                        className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#C9A24D]/40 bg-white px-3 py-1.5 text-xs font-black text-[#111827] shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] hover:shadow-md dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
                        title={`Open ${submission.contact_name || 'this'} response to ${form.title || 'your form'}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        {submission.contact_name || 'New response'}
                        <span className="font-semibold text-gray-400">· {form.title || 'Form'}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                    {newResultForms.length === 0 && openHouseRequestActionCount === 0 && (
                      <span className="text-xs font-semibold text-gray-500 dark:text-white/50">{hasMlsAccess(user?.plan_tier) ? 'All caught up - new form leads and Cheat Sheet requests show up here.' : 'All caught up - new form leads and invite replies show up here.'}</span>
                    )}
                  </div>
                )}
                actions={formsView === 'invites' ? <InvitesHeaderStats /> :
                  <div className="flex w-full items-stretch gap-2">
                    {statSummary && (
                      <div className="grid flex-1 grid-cols-3 gap-2 sm:min-w-[340px] lg:min-w-[400px]">
                        <StatCard metric="form_views" label="Form Views" shortLabel="Views" icon={ClipboardListIcon} entry={statSummary.form_views} />
                        <StatCard metric="form_fills" label="Forms Filled" shortLabel="Filled" icon={ClipboardListIcon} entry={statSummary.form_fills} />
                        <StatCard metric="form_completion" label="Completion Rate" shortLabel="Rate" icon={ClipboardListIcon} entry={statSummary.form_completion} isPercent />
                      </div>
                    )}
                    <InboxButton label="Inbox" count={newResultPeople.length + openHouseRequestActionCount} onClick={() => setFormsInboxOpen(true)}
                      title="Every form response and Cheat Sheet request, newest first" />
                  </div>
                }
              />
            </motion.div>

            <div id="forms-invites-switch"><FormsInvitesSwitch view={formsView} onChange={switchFormsView} formBadge={newResultPeople.length + openHouseRequestActionCount} /></div>

            <AnimatePresence mode="popLayout">
            {formsView === 'invites' ? (
              // The same entrance as the Forms side (user, 10/24: the Invites tab glitched).
              <motion.section key="invites" initial={{ opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }} className="mt-6">
                <InvitesPanel />
              </motion.section>
            ) : (
            <motion.section
              key="forms"
              layout
              initial={{ opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9, layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
              className="mt-6 space-y-6"
            >
            {(() => {
              const openHouseRequestsBlock = (
                <div id="forms-results" key="forms-results" className="scroll-mt-6 space-y-4">
                  {/* The "Setup My Own Showcase" form only works on Showcase plans (its public link
                      refuses otherwise - a guest would never get the Showcase it promises). Basic
                      sees it as a locked upsell; the No-MLS track has no Showcases, so it's hidden. */}
                  {contentLockedForms.length > 0 && hasShowcaseAccess(user?.plan_tier) && (
                    <div className="w-full overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#C9A24D]/[0.07] via-white to-white p-5 dark:from-[#C9A24D]/10 dark:via-[#151517] dark:to-[#151517] sm:p-6">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">
                        <Sparkles className="h-3 w-3" /> Automated
                      </span>
                      <h3 className="mb-3 mt-2 text-lg font-black tracking-tight text-[#111827] dark:text-white">Showcase Request</h3>
                      {contentLockedForms.map(form => renderFormCard(form, { big: true }))}
                    </div>
                  )}
                  {contentLockedForms.length > 0 && user?.plan_tier === 'BASIC' && (
                    <Link
                      href="/upgrade-required?feature=Showcases&tier=PREMIUM"
                      className="group flex w-full items-center gap-4 overflow-hidden rounded-3xl border border-dashed border-[#C9A24D]/40 bg-[#C9A24D]/[0.04] p-5 transition-colors hover:border-[#C9A24D] sm:p-6"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                        <Lock className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">Premium</p>
                        <h3 className="text-base font-black tracking-tight text-[#111827] dark:text-white">Showcase Request</h3>
                        <p className="mt-0.5 text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">A QR code guests scan to build their own personalized Showcase of matching homes, with instant alerts. Upgrade to Premium to turn it on.</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#C9A24D]" />
                    </Link>
                  )}

                  <div className="grid items-start gap-4 sm:grid-cols-2">
                    {/* Cheat Sheets only exist on MLS plans, so their request inbox does too. */}
                    <div className={`w-full overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#C9A24D]/[0.07] via-white to-white p-5 dark:from-[#C9A24D]/10 dark:via-[#151517] dark:to-[#151517] sm:p-6 ${hasMlsAccess(user?.plan_tier) ? '' : 'hidden'}`}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">
                          <Zap className="h-3 w-3" /> From Cheat Sheets
                        </span>
                        {openHouseRequestActionCount > 0 && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-red-200 dark:ring-red-900/40">
                            {openHouseRequestActionCount > 9 ? '9+' : openHouseRequestActionCount}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-black tracking-tight text-[#111827] dark:text-white">Open House Requests</h3>
                      <p className="mb-4 mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">"Request Seller Disclosure" and "Schedule a Second Visit" scans from your Cheat Sheets - no setup, they just show up here.</p>
                      <div className="mb-4 flex gap-2">
                        <button
                          onClick={() => setIsEditingOpenHouseTheme(true)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#C9A24D]/50 bg-[#C9A24D]/10 px-3 py-2 text-xs font-black text-[#8b7355] transition active:scale-95 hover:border-[#C9A24D] hover:bg-[#C9A24D]/15 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a]"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit Theme
                        </button>
                        <button
                          onClick={() => setShowOpenHouseStats(current => !current)}
                          className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black transition active:scale-95 ${
                            showOpenHouseStats
                              ? 'bg-emerald-500 text-white dark:bg-emerald-400 dark:text-[#111827]'
                              : 'bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200'
                          }`}
                          aria-label="Toggle stats"
                          title="Toggle stats"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <OpenHouseFormRequestsPanel variant="inline" showStats={showOpenHouseStats} onActionNeededChange={setOpenHouseRequestActionCount} />
                    </div>

                    <div className="w-full overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#C9A24D]/[0.07] via-white to-white p-5 dark:from-[#C9A24D]/10 dark:via-[#151517] dark:to-[#151517] sm:p-6">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#e8cf8a]">
                        <QrCode className="h-3 w-3" /> From Similar Properties Sheets
                      </span>
                      <h3 className="mt-2 text-lg font-black tracking-tight text-[#111827] dark:text-white">Similar Listings QR</h3>
                      <p className="mb-4 mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                        Every Similar Properties handout gets a "See more like this?" QR code - scanning it builds the visitor a free Showcase automatically.
                      </p>
                      {/* Same destination page as the Open House Requests QR codes (/open-house/{id}), so it shares
                          that same openHouseRequestTheme - no separate theme to store or an editor to build. */}
                      <button
                        onClick={() => setIsEditingOpenHouseTheme(true)}
                        className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#C9A24D]/50 bg-[#C9A24D]/10 px-3 py-2 text-xs font-black text-[#8b7355] transition active:scale-95 hover:border-[#C9A24D] hover:bg-[#C9A24D]/15 dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/10 dark:text-[#e8cf8a]"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit Theme
                      </button>
                      {/* This QR builds the Showcase automatically on scan - there's never anything for the agent
                          to approve/decline, so unlike Open House Requests this stays empty by design. */}
                      <p className="text-sm text-gray-500 dark:text-gray-400">No requests yet.</p>
                    </div>
                  </div>
                </div>
              )

              const formsBlock = formsLoading ? (
                <div key="forms-grids" className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
              ) : (
                <div key="forms-grids" className="space-y-6">
                  <div>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]"><Sparkles className="h-3 w-3" /> Ready to share</p>
                        <h3 className="mt-1 font-serif text-2xl font-black tracking-tight text-[#111827] dark:text-white">Premade forms</h3>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Built for every situation - share the link or QR and every answer lands in Results.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {premadeForms.map(form => renderFormCard(form))}
                    </div>
                    {onboardingForms.length > 0 && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {onboardingForms.map(form => renderFormCard(form, { big: true }))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]"><PenLine className="h-3 w-3" /> Yours</p>
                        <h3 className="mt-1 font-serif text-2xl font-black tracking-tight text-[#111827] dark:text-white">Custom forms</h3>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Your own questions, your own link and QR code.</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {customForms.map(form => renderFormCard(form))}
                      {/* Always present (not just when there are zero custom forms yet) - this is
                          the one place to create a new custom form, now that the header's own
                          "+ New" button (redundant with this) has been removed. */}
                      <button
                        onClick={handleCreateForm}
                        disabled={creatingForm}
                        className="group flex min-h-[196px] w-full flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-[#C9A24D]/35 bg-gradient-to-b from-[#fffdf8] to-[#fbf6ec] text-center transition duration-300 hover:-translate-y-1 hover:border-[#C9A24D] hover:shadow-[0_24px_44px_-30px_rgba(139,115,85,.9)] disabled:opacity-60 dark:border-white/15 dark:from-[#151517] dark:to-[#121214] dark:hover:border-[#C9A24D]"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-md ring-1 ring-[#C9A24D]/35 transition group-hover:rotate-90">
                          {creatingForm ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                        </span>
                        <span className="font-serif text-base font-black text-[#111827] dark:text-white">New custom form</span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Start from scratch - any questions you like</span>
                      </button>
                    </div>
                  </div>
                </div>
              )

              // Always the same order: premade forms, then your own, then the automated ones. New
              // results don't reshuffle the page - the header's "New" bar links straight to them.
              return (
                <div id="my-forms" className="scroll-mt-6 space-y-6">
                  {formsBlock}{openHouseRequestsBlock}
                </div>
              )
            })()}
            </motion.section>
            )}
            </AnimatePresence>
          </>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] md:items-start">
            <div className="min-w-0">
              <SavedToast tick={savedTick} />
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <PageHeader
                  icon={Globe}
                  kicker="Agent Hub"
                  title={<>One link, <em>all of you</em></>}
                  subtitle="Your profile, listings, sales and stories - one page that's always current."
                  backHref="/studio"
                  backLabel="Tools"
                  noMargin
                  badge={statSummary && (
                    <div className="flex flex-nowrap items-center gap-1.5">
                      <StatCard chip metric="agent_hub_visits" label="Views" icon={Eye} entry={statSummary.agent_hub_visits} />
                      <StatCard chip metric="agent_hub_interactions" label="Interacted" icon={MousePointerClick} entry={statSummary.agent_hub_interactions} />
                    </div>
                  )}
                  tabs={
                    <LuxeTabs
                      label="Agent Hub sections"
                      active={activeTab as string}
                      onChange={(t) => setActiveTab(t as typeof activeTab)}
                      items={AGENT_HUB_SUBTABS.map(t => ({ id: t, label: t, icon: AGENT_HUB_TAB_ICON[t] || PenLine }))}
                    />
                  }
                />
              </motion.div>

              <AnimatePresence mode="wait">
              <motion.section
                key={activeTab}
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.99 }}
                transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
                className="mt-6 space-y-6"
              >
            <HubPanelMemory.Provider value="agentHubEditor">
            {activeTab === 'Layout' && (
              <div className="space-y-6">
                <HubFold id="layout-theme">{(open, toggle) => (
<div className={hubCardClass(open)}>
                  <HubPanelHead icon={Sparkles} kicker="Look" title="Agent Hub theme" subtitle="Same layout and sections - pick how it's dressed. Changes go live right away." open={open} onToggle={toggle} />
<HubCollapse open={open}>
                  <div className="grid grid-cols-2 gap-2 px-5 pt-5" role="radiogroup" aria-label="Where the look comes from">
                    {([['brand', 'My Brand Kit', `${brandKit.look.theme === 'luxe' && hubLuxeAllowed ? `Luxe · ${LUXE_METALS[brandKit.look.metal].label}` : `Classic · ${brandColorName(brandKit.look.accent) || 'Custom color'}`} · ${modeLabel(brandKit.look.dark)}`], ['own', 'Choose my own', 'Pick a look just for your hub below.']] as const).map(([id, name, blurb]) => {
                      const on = hubLookSource === id
                      return (
                        <button key={id} type="button" role="radio" aria-checked={on} data-testid={`hub-look-${id}`} onClick={() => (id === 'brand' ? handleHubUseBrandKit() : handleHubChooseOwn())}
                          className={`rounded-2xl border-2 px-3 py-2.5 text-left transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06]' : 'border-gray-200 hover:border-[#C9A24D]/60 dark:border-white/10'}`}>
                          <span className="flex items-center gap-1.5 text-sm font-black text-[#111827] dark:text-white">{id === 'brand' ? <Sparkles className="h-3.5 w-3.5 text-[#C9A24D]" /> : <Palette className="h-3.5 w-3.5 text-gray-400" />}{name}{on && <Check className="ml-auto h-4 w-4 text-[#C9A24D]" />}</span>
                          <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{blurb}</span>
                        </button>
                      )
                    })}
                  </div>
                  {hubLookSource === 'brand' && <p className="px-5 pt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">Your hub follows your <Link href="/studio/brand-kit" className="font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#e8c97a]">Branding</Link> - change it there and your hub changes too. Picking anything below gives your hub its own look.</p>}
                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    {HUB_THEMES.map(t => {
                      const on = shownHubTheme === t.id
                      const luxe = t.id === 'luxe'
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleHubTheme(t.id)}
                          className={`group relative overflow-hidden rounded-2xl border-2 p-2.5 text-left transition-all duration-300 ${on ? 'border-[#C9A24D] shadow-[0_18px_36px_-24px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-white/10'}`}
                        >
                          {/* mini hub swatch */}
                          <div className="relative h-24 overflow-hidden rounded-xl" style={{ background: luxe ? 'radial-gradient(120% 90% at 100% 0%, rgba(201,162,77,.32), transparent 55%), linear-gradient(160deg,#fffdf8,#fbf6ec 45%,#f4ead7)' : '#f7f5f1' }}>
                            {luxe && <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />}
                            <div className={`absolute left-3 top-3 h-[72px] w-[58px] rounded-lg border ${luxe ? 'border-[#C9A24D]/50 bg-gradient-to-br from-[#fffdf8] to-[#f4ead7]' : 'border-gray-200 bg-[#fbfaf7]'}`}>
                              <span className={`mx-auto mt-2 block h-5 w-5 rounded-full border ${luxe ? 'border-[#C9A24D] shadow-[0_0_0_2px_rgba(201,162,77,.18)]' : 'border-[#cdaa64]'} bg-gray-300`} />
                              <span className={`mx-auto mt-1.5 block h-1.5 w-9 rounded-full ${luxe ? 'bg-gradient-to-r from-[#111827] via-[#C9A24D] to-[#111827]' : 'bg-[#111827]'}`} />
                              <span className={`mx-auto mt-2 block h-2.5 w-11 rounded ${luxe ? 'bg-gradient-to-r from-[#111827] to-[#2a2218]' : 'border border-[#111827] bg-white'}`} />
                              <span className={`mx-auto mt-1 block h-2.5 w-11 rounded ${luxe ? 'bg-gradient-to-r from-[#b8913f] to-[#e8c97a]' : 'bg-[#d2b16f]'}`} />
                            </div>
                            <div className="absolute left-[78px] right-3 top-4 space-y-2">
                              <span className={`flex items-center gap-1.5`}>{luxe && <span className="h-px w-3 bg-[#C9A24D]" />}<span className={`h-1.5 w-12 rounded-full ${luxe ? 'bg-[#8b7355]' : 'border-l-2 border-[#d2b16f] bg-[#111827]'}`} /></span>
                              <span className="grid grid-cols-3 gap-1">{[0, 1, 2].map(k => <span key={k} className={`h-8 rounded ${luxe ? 'bg-gradient-to-br from-[#111827] to-[#2a2218] ring-1 ring-[#C9A24D]/40' : 'bg-gray-300'}`} />)}</span>
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center gap-2 px-1">
                            <p className="font-serif text-base font-black text-[#111827] dark:text-white">{t.label}</p>
                            {luxe && <span className="rounded-full bg-[#111827] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#e8c97a]">{hubLuxeAllowed ? 'IDX' : 'IDX · Preview'}</span>}
                            {on && <Check className="ml-auto h-4 w-4 text-[#C9A24D]" />}
                          </div>
                          <p className="px-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{t.blurb}</p>
                        </button>
                      )
                    })}
                  </div>
                  <AnimatePresence initial={false}>
                    {shownHubTheme === 'luxe' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="px-5 pb-5">
                          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Luxe finish <span className="normal-case tracking-normal">- same Luxe look, your metal</span></p>
                          <div className="grid grid-cols-3 gap-2">
                            {LUXE_METAL_ORDER.map(m => {
                              const mp = LUXE_METALS[m]
                              const active = hubLuxeMetal === m
                              return (
                                <motion.button key={m} type="button" whileTap={{ scale: 0.95 }} onClick={() => handleHubLuxeMetal(m)}
                                  className={`group relative flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 ${active ? 'shadow-[0_10px_24px_-14px_rgba(0,0,0,.45)]' : 'border-gray-200 dark:border-white/10'}`}
                                  style={active ? { borderColor: mp.base } : undefined}>
                                  <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10" style={{ background: `linear-gradient(135deg, ${mp.deep}, ${mp.base} 40%, ${mp.pale} 55%, ${mp.light} 70%, ${mp.deep})` }}>
                                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                                  </span>
                                  <span className="text-xs font-black text-[#111827] dark:text-white">{mp.label}</span>
                                  {active && <motion.span layoutId="hub-metal-check" className="ml-auto flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: mp.base }}><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></motion.span>}
                                </motion.button>
                              )
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence initial={false}>
                    {shownHubTheme === 'classic' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="px-5 pb-5">
                          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400"><Palette className="h-3.5 w-3.5" /> Classic color <span className="normal-case tracking-normal">- your buttons, headings and accents</span></p>
                          <div className="flex flex-wrap items-center gap-2">
                            {HUB_CLASSIC_ACCENTS.map(a => {
                              const active = hubAccent.toLowerCase() === a.color.toLowerCase()
                              return (
                                <button
                                  key={a.color}
                                  type="button"
                                  onClick={() => handleHubAccent(a.color)}
                                  className={`relative h-8 w-8 shrink-0 rounded-full border-2 ring-1 ring-inset ring-black/10 transition hover:-translate-y-0.5 active:scale-95 ${active ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                                  style={{ backgroundColor: a.color }}
                                  title={a.label}
                                  aria-label={`${a.label}${active ? ' (selected)' : ''}`}
                                >
                                  {active && <Check className="absolute inset-0 m-auto h-3.5 w-3.5" strokeWidth={3.5} style={{ color: (hubAccentStyle(a.color) as Record<string, string>)['--hub-accent-ink'] }} />}
                                </button>
                              )
                            })}
                            <span className="ml-1 text-xs font-bold text-gray-500 dark:text-gray-400">{HUB_CLASSIC_ACCENTS.find(a => a.color.toLowerCase() === hubAccent.toLowerCase())?.label}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {luxePeek && (
                    <div className="px-5 pb-5">
                      <LuxeUpgradePitch feature="Agent Hub Luxe" text="The live preview shows your hub in Luxe. Upgrade to IDX to publish it - visitors see Classic until then." />
                    </div>
                  )}
                </HubCollapse>
</div>
)}</HubFold>
                <HubFold id="layout-dark">{(open, toggle) => (
<div className={hubCardClass(open)}>
                  <HubPanelHead icon={visitorDarkMode ? Moon : Sun} kicker="Look" title="Ivory or Midnight" subtitle="What visitors see on your Agent Hub and Sales page. Changes go live right away." open={open} onToggle={toggle} />
<HubCollapse open={open}>
                  <div className="grid grid-cols-2 gap-3 p-5">
                    {([false, true] as const).map(dark => {
                      const on = visitorDarkMode === dark
                      return (
                        <button
                          key={dark ? 'dark' : 'light'}
                          type="button"
                          onClick={() => handleVisitorDarkMode(dark)}
                          aria-pressed={on}
                          className={`group relative overflow-hidden rounded-2xl border-2 p-2.5 text-left transition-all duration-300 ${on ? 'border-[#C9A24D] shadow-[0_18px_36px_-24px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-white/10'}`}
                        >
                          <div className={`flex h-20 items-center justify-center gap-2 rounded-xl ${dark ? 'bg-[#0B0B0B]' : 'bg-[#f7f5f1]'}`}>
                            <span className={`h-12 w-10 rounded-lg border ${dark ? 'border-white/10 bg-[#151517]' : 'border-gray-200 bg-white'}`}>
                              <span className="mx-auto mt-1.5 block h-3.5 w-3.5 rounded-full border border-[#cdaa64] bg-gray-400" />
                              <span className={`mx-auto mt-1.5 block h-1 w-6 rounded-full ${dark ? 'bg-white' : 'bg-[#111827]'}`} />
                              <span className="mx-auto mt-1.5 block h-1.5 w-7 rounded" style={{ background: shownHubTheme === 'luxe' ? 'linear-gradient(90deg,#a8803a,#e8c97a)' : hubAccent }} />
                            </span>
                            <span className="space-y-1.5">
                              <span className={`block h-6 w-14 rounded ${dark ? 'bg-white/10' : 'bg-gray-300'}`} />
                              <span className={`block h-1.5 w-10 rounded-full ${dark ? 'bg-white/30' : 'bg-gray-400'}`} />
                            </span>
                          </div>
                          <div className="mt-2.5 flex items-center gap-2 px-1">
                            {dark ? <Moon className="h-4 w-4 text-gray-500" /> : <Sun className="h-4 w-4 text-gray-500" />}
                            <p className="font-serif text-base font-black text-[#111827] dark:text-white">{dark ? 'Midnight' : 'Ivory'}</p>
                            {on && <Check className="ml-auto h-4 w-4 text-[#C9A24D]" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </HubCollapse>
</div>
)}</HubFold>
                <HubFold id="layout-header">{(open, toggle) => (
<div className={hubCardClass(open)}>
                  <HubPanelHead icon={Smartphone} kicker="Look" title="Profile header" subtitle="How the top of your hub reads - on phones and on desktop." open={open} onToggle={toggle} />
<HubCollapse open={open}>
                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    {HUB_MOBILE_HEADERS.map(h => {
                      const on = mobileHeader === h.id
                      const split = h.id === 'split'
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => handleMobileHeader(h.id)}
                          className={`group relative overflow-hidden rounded-2xl border-2 p-2.5 text-left transition-all duration-300 ${on ? 'border-[#C9A24D] shadow-[0_18px_36px_-24px_rgba(201,162,77,.9)]' : 'border-gray-200 hover:-translate-y-0.5 hover:border-[#C9A24D]/60 dark:border-white/10'}`}
                        >
                          <div className="flex h-24 items-center justify-center rounded-xl bg-[#f2efe8] dark:bg-white/[0.04]">
                            <div className="w-[132px] rounded-lg border border-gray-200 bg-[#fbfaf7] p-2 shadow-sm dark:border-white/10 dark:bg-[#151517]">
                              {split ? (
                                <>
                                  <div className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <span className="block h-1 w-8 rounded-full bg-[#C9A24D]/70" />
                                      <span className="block h-2 w-16 rounded bg-[#111827] dark:bg-white" />
                                      <span className="block h-1 w-10 rounded-full bg-[#8b7355]/60" />
                                      <span className="block h-1 w-12 rounded-full bg-gray-300 dark:bg-white/20" />
                                    </div>
                                    <span className="h-11 w-9 shrink-0 rounded-md border-2 border-[#cdaa64] bg-gray-300" />
                                  </div>
                                  <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-[#d8c08a]/50 pt-1.5">{[0, 1, 2].map(k => <span key={k} className="mx-auto block h-1.5 w-6 rounded bg-[#111827]/70 dark:bg-white/60" />)}</div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="h-6 w-6 rounded-full border-2 border-[#cdaa64] bg-gray-300" />
                                  <span className="block h-2 w-16 rounded bg-[#111827] dark:bg-white" />
                                  <span className="block h-1 w-10 rounded-full bg-[#8b7355]/60" />
                                  <div className="mt-0.5 grid w-full grid-cols-3 gap-1">{[0, 1, 2].map(k => <span key={k} className="h-3 rounded border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5" />)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center gap-2 px-1">
                            <p className="font-serif text-base font-black text-[#111827] dark:text-white">{h.label}</p>
                            {on && <Check className="ml-auto h-4 w-4 text-[#C9A24D]" />}
                          </div>
                          <p className="px-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{h.blurb}</p>
                        </button>
                      )
                    })}
                  </div>
                </HubCollapse>
</div>
)}</HubFold>
                <HubFold id="layout-reviews">{(open, toggle) => (
<div className={hubCardClass(open)}>
                    <HubPanelHead icon={Star} kicker="Social proof" title="Reviews" subtitle="Your star rating and client reviews. Phones: where you put them in the order below. Computers: one short card under Schedule a Showing." open={open} onToggle={toggle} />
<HubCollapse open={open}>
                    <div className="space-y-4 border-t border-gray-100 p-5 dark:border-gray-800" data-testid="hub-reviews-settings">
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                        {reviewsData ? (reviewsData.summary.count ? <><b>{reviewsData.summary.count}</b> review{reviewsData.summary.count === 1 ? '' : 's'}{reviewsData.summary.average != null ? <> · <b>{reviewsData.summary.average.toFixed(1)}</b> stars</> : null}</> : 'No reviews yet.') : 'Loading…'}
                        {' '}<Link href="/studio/reviews" className="font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#e8c97a]">Add, import or hide reviews →</Link>
                      </p>
                      <HubSwitchRow testId="hub-reviews-show" on={Boolean(reviewsData?.show_on_hub)} onClick={toggleReviewsOnHub}
                        title="Show reviews on my Agent Hub" sub="Off hides the Reviews section, the computer card and the profile-card rating" />
                      <HubSwitchRow testId="hub-reviews-min4" on={(reviewsData?.min_rating ?? 1) >= 4} onClick={toggleReviewsMinRating}
                        title="Only show 4 and 5 star reviews" sub="Also on your IDX website. Your star rating counts only the reviews shown" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([[true, 'One big card', 'Same size as Recent Sales, one review at a time'], [false, 'Two cards', 'Two whole cards side by side, swipe for more']] as const).map(([big, title, sub]) => (
                          <button key={String(big)} type="button" onClick={() => { setReviewsCarousel(big); handleSaveAgentHubChanges({ reviewsCarousel: big }) }}
                            className={`rounded-2xl border p-3.5 text-left transition ${reviewsCarousel === big ? 'border-[#C9A24D] bg-[#C9A24D]/10' : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 dark:border-gray-700 dark:bg-[#0B0B0B]'}`}>
                            <p className="text-sm font-black text-[#111827] dark:text-white">On phones: {title}</p>
                            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{sub}</p>
                          </button>
                        ))}
                      </div>
                      <HubSwitchRow on={reviewsAutoScroll} onClick={() => { setReviewsAutoScroll(!reviewsAutoScroll); handleSaveAgentHubChanges({ reviewsAutoScroll: !reviewsAutoScroll }) }}
                        title="Move on their own (phones)" sub="Reviews take turns every few seconds (the computer card always does)" />
                    </div>
</HubCollapse>
</div>
)}</HubFold>
                <HubFold id="layout-order">{(open, toggle) => (
<div className={hubCardClass(open)}>
                    <HubPanelHead icon={LayoutGrid} kicker="Page order" title="Agent Hub Layout" subtitle="Drag sections into the order visitors see them, and switch each one on or off." open={open} onToggle={toggle} />
<HubCollapse open={open}>

                    <div>
                      <div className="space-y-3 border-t border-gray-100 p-5 dark:border-gray-800">
                        {layoutSections.map((section, index) => (
                          (() => {
                            const isReviews = section.id === 'reviews'
                            const hasContent = isReviews ? (shownReviewsData?.reviews.length ?? 0) > 0 : sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, effectiveBlogCards, myListings)
                            const isShowing = isReviews ? Boolean(reviewsData?.show_on_hub) && hasContent : section.visible && hasContent
                            return (
                          <div
                            key={section.id}
                            draggable
                            onDragStart={() => setDraggedSectionId(section.id)}
                            onDragOver={(event) => {
                              event.preventDefault()
                              moveDraggedSection(section.id)
                            }}
                            onDragEnd={() => {
                              setDraggedSectionId(null)
                              handleSaveAgentHubChanges({ layoutSections, visibleSectionIds: layoutSections.filter(section => section.visible).map(section => section.id) })
                            }}
                            className={`flex cursor-grab flex-row items-center gap-3 rounded-2xl border p-4 shadow-sm transition active:cursor-grabbing sm:flex-wrap ${
                              draggedSectionId === section.id
                                ? 'border-gray-400 bg-gray-50 shadow-md dark:border-gray-600 dark:bg-[#151517]'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-[#0B0B0B]'
                            }`}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <GripVertical className="h-5 w-5 shrink-0 text-gray-400" />
                              <div className="min-w-0 flex-1">
                                <p className="font-black dark:text-white">{index + 1}. {section.label}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{isReviews && !hasContent
                                  ? <>No reviews yet - <Link href="/studio/reviews" className="font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#e8c97a]">add or import them</Link></>
                                  : hasContent ? (isShowing ? (isReviews ? 'Showing - under Schedule a Showing on computers' : 'Showing on public page') : 'Hidden from public page') : 'Empty - toggled off until content is added'}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleSectionVisibility(section.id)}
                              disabled={!hasContent}
                              className={`flex w-auto shrink-0 items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
                                isShowing
                                  ? 'border-gray-200 bg-white text-[#111827] dark:border-gray-700 dark:bg-[#151517] dark:text-white'
                                  : 'border-gray-200 bg-gray-100 text-gray-500 disabled:opacity-70 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400'
                              }`}
                              aria-label={`${isShowing ? 'Hide' : 'Show'} ${section.label}`}
                              title={`${section.visible ? 'Hide' : 'Show'} ${section.label}`}
                            >
                              <span>{isShowing ? 'On' : 'Off'}</span>
                              <OhpSwitch on={isShowing} size="sm" as="span" />
                            </button>
                          </div>
                            )
                          })()
                        ))}
                      </div>
                    </div>
                  </HubCollapse>
</div>
)}</HubFold>
                </div>
            )}

            {HUB_TAB_SECTIONS[activeTab] && (
                  <div className="space-y-5">
                    {layoutSections.filter(section => HUB_TAB_SECTIONS[activeTab].includes(section.id)).map(section => {
                      if (section.id === 'sales') return <RecentSalesPanel key={section.id} ready={agentHubDataReady} reLicenseNumber={profile.licenseNumber} agentSales={recentSales} setAgentSales={setRecentSales} showStats={showSalesStats} setShowStats={setShowSalesStats} carousel={salesCarousel} setCarousel={setSalesCarousel} autoScroll={salesAutoScroll} setAutoScroll={setSalesAutoScroll} minPrice={salesMinPrice} setMinPrice={setSalesMinPrice} onSortChange={setSalesSort} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'listings') return <MyListingsPanel key={section.id} ready={agentHubDataReady} listings={myListings} setListings={setMyListings} carousel={listingsCarousel} setCarousel={setListingsCarousel} autoScroll={listingsAutoScroll} setAutoScroll={setListingsAutoScroll} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'videos') return <VideoLinksPanel key={section.id} autoSync={videoAutoSync} syncedAt={videoSyncedAt} onToggleAutoSync={handleToggleVideoAutoSync} items={videoLinks} setItems={setVideoLinks} channelUrl={videoChannelUrl} setChannelUrl={setVideoChannelUrl} carousel={videosCarousel} setCarousel={setVideosCarousel} autoScroll={videosAutoScroll} setAutoScroll={setVideosAutoScroll} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'tours') return <HouseToursPanel key={section.id} items={houseTourLinks} setItems={setHouseTourLinks} houseTourUrl={houseTourUrl} setHouseTourUrl={setHouseTourUrl} carousel={toursCarousel} setCarousel={setToursCarousel} autoScroll={toursAutoScroll} setAutoScroll={setToursAutoScroll} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'blogs') return (
                        <BlogCardsPanel
                          key={section.id}
                          items={blogCards}
                          setItems={setBlogCards}
                          carousel={blogsCarousel}
                          setCarousel={setBlogsCarousel}
                          autoScroll={blogsAutoScroll}
                          setAutoScroll={setBlogsAutoScroll}
                          onChange={() => setSaveStatus('Unsaved Changes')}
                          onSave={handleSaveAgentHubChanges}
                          studioBlogs={myBlogs}
                          studioBlogsLoading={myBlogsLoading}
                          onToggleStudioBlogVisible={handleToggleBlogHubVisibility}
                          onToggleStudioBlogFeatured={handleToggleBlogFeatured}
                        />
                      )
                      return null
                    })}
                  </div>
            )}

            {(activeTab === 'Profile' || activeTab === 'Contact' || activeTab === 'Link') && (
              <div className="space-y-5">
                  {editorGroups.filter(group => (activeTab === 'Profile' ? group.title === 'Profile' : activeTab === 'Contact' && group.title !== 'Profile')).map(group => {
                    const theme = EDITOR_SECTION_THEME[group.title]
                    return (
                    <HubFold key={group.title} id={`group-${group.title}`} alwaysOpen={group.title === 'Profile'}>{(open, toggle) => (
<div className={hubCardClass(open)}>
                      <HubPanelHead
                        icon={group.icon}
                        kicker={group.title === 'Profile' ? 'About you' : group.title === 'Contact' ? 'Reach me' : group.title === 'Social Links' ? 'Follow along' : 'Save Contact'}
                        title={group.title}
                        subtitle={theme.subtitle}
                        status={<StatusPill status={getEditorSectionStatus(group.title)} />}
                        action={<HubSaveButton dirty={hasUnsavedChanges} saving={hubSaving} savedTick={savedTick} onSave={() => handleSaveAgentHubChanges()} />}
                        open={open} onToggle={toggle} />
<HubCollapse open={open}>
                      <div>
                        {/* Leaving a text box saves it (only if something changed) - no save per letter. */}
                        <div className="border-t border-gray-100 p-5 dark:border-gray-800" onBlur={saveTextIfChanged}>
                          {group.title === 'Social Links' && (
                            <SocialLinksEditor socialLinks={socialLinks} onChange={updateSocialLink} websiteAuto={websiteAuto} />
                          )}
                          {group.title === 'Contact Card' && (
                            <div data-contact-card-editor>
                              <ContactCardPanel fields={contactCard} onChange={updateContactCardField} source={contactCardSource} showPreview={false} />
                            </div>
                          )}
                          {group.title !== 'Social Links' && group.title !== 'Contact Card' && (
                          <div className="grid gap-3 md:grid-cols-2">
                              {group.fields.map(([label, value]) => (
                                (() => { const FieldWrap = label === 'Profile photo' ? 'div' : 'label'; return (<FieldWrap key={label} className={`block ${label === 'About me' || label === 'Market or service area' ? 'md:col-span-2' : ''} ${label === 'Profile photo' || label === 'RE License number' ? 'flex flex-col' : ''}`}>
                                  <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gray-400">
                                    {label}
                                    {((group.title === 'Contact') || (group.title === 'Profile' && label !== 'About me' && label !== 'Team name')) && <span className="text-red-500">*</span>}
                                    {label === 'RE License number' && (
                                      <span className="group relative inline-flex">
                                        <Info className="h-3.5 w-3.5 cursor-help text-gray-400" />
                                        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-[#111827] px-3 py-2 text-center text-xs font-bold normal-case tracking-normal text-white shadow-lg group-hover:block">
                                          This isn't shared publicly. Locked to match your MLS ID - contact support in Settings to change it.
                                        </span>
                                      </span>
                                    )}
                                  </span>
                                  {label === 'RE License number' ? (
                                    <div className="mt-2 flex w-full flex-1 flex-col justify-center gap-1.5 rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 dark:border-gray-700 dark:bg-[#0B0B0B]">
                                      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                                        {getProfileFieldValue(label, value) ? <span>{getProfileFieldValue(label, value)}</span> : <Link href="/setup?step=license" className="font-black text-[#8b6a2b] underline-offset-2 hover:underline dark:text-[#e8c97a]">Not set - add it</Link>}
                                        <Lock className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
                                      </span>
                                      <span className="text-xs font-semibold leading-snug text-gray-400 dark:text-gray-500">Private - never shown on your hub. It's how your closed sales are matched to you.</span>
                                    </div>
                                  ) : label === 'Profile photo' ? (
                                    <div className="mt-2 flex flex-1 items-center gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-[#0B0B0B]">
                                      <DraggableAvatarPhoto url={profilePhotoUrl} position={profilePhotoPosition} onPositionChange={(pos) => { setProfilePhotoPosition(pos); setSaveStatus('Unsaved Changes') }} onDragEnd={requestSave} size={64} uploading={photoUploading} />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Current profile photo</p>
                                        <p className="text-xs font-semibold text-gray-400">Drag the circle to reposition if it looks off-centered.</p>
                                        <label className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827] ${photoUploading ? 'pointer-events-none opacity-50' : ''}`}>
                                          <ImageIcon className="h-3.5 w-3.5 text-[#e8c97a] dark:text-[#111827]" /> Upload a new photo
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            disabled={photoUploading}
                                            onChange={(event) => handleProfilePhotoChange(event.target.files?.[0])}
                                            className="sr-only"
                                          />
                                        </label>
                                        {photoUploading && <p className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</p>}
                                        {photoError && <p className="mt-2 text-xs font-bold text-red-600">{photoError}</p>}
                                      </div>
                                    </div>
                                  ) : label === 'About me' ? (
                                    <textarea
                                      value={getProfileFieldValue(label, value)}
                                      onChange={(event) => updateProfileField(label, event.target.value)}
                                      placeholder="Add a short, helpful introduction for your public Agent Hub"
                                      rows={4}
                                      className="mt-2 w-full flex-1 resize-none rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                                    />
                                  ) : (
                                    <input
                                      value={group.title === 'Profile' ? getProfileFieldValue(label, value) : getContactFieldValue(label, value)}
                                      onChange={(event) => group.title === 'Profile' ? updateProfileField(label, event.target.value) : updateContactField(label, event.target.value)}
                                      placeholder={group.title === 'Profile' && (label === 'Agent name' || label === 'Brokerage name') ? 'Filled from your account when available' : label === 'Team name' ? 'Only if you are on a team' : 'Add details'}
                                      required={group.title === 'Contact' || (group.title === 'Profile' && label !== 'About me' && label !== 'Team name')}
                                      className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                                    />
                                  )}
                                </FieldWrap>) })()
                              ))}
                          </div>
                          )}
                        </div>
                      </div>
                    </HubCollapse>
</div>
)}</HubFold>
                    )
                  })}

                  {activeTab === 'Profile' && (
                    <HubFold id="profile-rating">{(open, toggle) => (
<div className={hubCardClass(open)}>
                      <HubPanelHead icon={Star} kicker="Social proof" title="Star Rating" subtitle="Your rating and a review pencil on your profile card - in the top corners (centered header, phones) or right under your photo (side-by-side header)." open={open} onToggle={toggle} />
<HubCollapse open={open}>
                      <div className="space-y-3 border-t border-gray-100 p-5 dark:border-gray-800" data-testid="hub-profile-rating-settings">
                        {!(reviewsData?.show_on_hub && (shownReviewsData?.reviews.length ?? 0) > 0) && (
                          <p className="rounded-xl bg-[#C9A24D]/10 px-3 py-2 text-xs font-semibold text-[#8b7355] dark:text-[#e8c97a]">
                            {reviewsData?.show_on_hub ? 'Shows once you have a review.' : 'Reviews are off - switch them on in Layout → Reviews.'}
                          </p>
                        )}
                        <HubSwitchRow testId="hub-profile-rating-toggle" on={reviewsOnProfile} onClick={() => { setReviewsOnProfile(!reviewsOnProfile); handleSaveAgentHubChanges({ reviewsOnProfile: !reviewsOnProfile }) }}
                          title="Star rating on my profile card" sub="★ 4.9 (31) - tapping it jumps to your reviews" />
                        <HubSwitchRow testId="hub-profile-review-toggle" on={reviewsProfileButton} onClick={() => { setReviewsProfileButton(!reviewsProfileButton); handleSaveAgentHubChanges({ reviewsProfileButton: !reviewsProfileButton }) }}
                          title="Review button on my profile card" sub="Clients can leave you a review in one tap" />
                      </div>
</HubCollapse>
</div>
)}</HubFold>
                  )}
                  {activeTab === 'Link' && (
                  <HubFold id="link">{(open, toggle) => (
                  <div className="relative overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-gradient-to-br from-white to-[#fbf6ec] p-5 shadow-[0_18px_40px_-34px_rgba(139,115,85,.7)] dark:border-white/[0.08] dark:from-[#151517] dark:to-[#111113]">
                    <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#C9A24D]/15 blur-3xl" />
                    <div className="relative flex items-center gap-3">
                      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className={HUB_ICON_TILE}>
                        <LinkIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">Your link</p>
                        <h2 className="font-serif text-xl font-black tracking-tight text-[#111827] dark:text-white">Public URL</h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Letters, numbers, and hyphens only. No spaces or unsupported symbols.</p>
                      </div>
                      </button>
                      <button type="button" onClick={toggle} className="shrink-0 rounded-xl border border-gray-200 bg-white p-3 text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400" aria-label={`${open ? 'Collapse' : 'Expand'} Public URL`}>
                        <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    <HubCollapse open={open}>

                    <div className="relative mt-5">
                      <label className="text-sm font-black text-gray-700 dark:text-gray-300">Custom URL ending</label>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                        <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-[#fbfaf7] focus-within:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B]">
                          <span className="flex items-center border-r border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400">openhousepal.com/</span>
                          <input
                            className="min-w-0 flex-1 bg-transparent px-4 py-3 font-semibold outline-none dark:text-white"
                            value={agentHubSlug}
                            onChange={(event) => {
                              setAgentHubSlug(event.target.value.toLowerCase())
                              setSlugStatus('idle')
                              setSlugMessage('Check availability before saving.')
                              setSaveStatus('Unsaved Changes')
                            }}
                            placeholder="John-Doe"
                          />
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button onClick={handleCheckSlug} disabled={slugStatus === 'checking'} className="flex-1 rounded-xl border border-gray-200 px-5 py-3 font-black transition hover:border-gray-300 disabled:opacity-50 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:border-gray-600 sm:flex-none">
                            {slugStatus === 'checking' ? 'Checking...' : 'Check'}
                          </button>
                          <button onClick={() => setShowAgentHubUrlWarning(true)} disabled={slugStatus === 'checking' || slugStatus === 'taken'} className="flex-1 rounded-xl bg-[#111827] px-5 py-3 font-black text-white shadow-sm transition hover:bg-black disabled:opacity-50 dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200 sm:flex-none">
                            Save URL
                          </button>
                        </div>
                      </div>
                      <p className={`mt-2 text-sm font-bold ${
                        slugStatus === 'available' || slugStatus === 'saved'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : slugStatus === 'taken' || slugStatus === 'error'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {slugMessage}
                      </p>
                    </div>
                    <div className="relative mt-4 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                      <button onClick={handleCopyPublicUrl} className="rounded-xl border border-gray-200 px-2 py-2.5 text-xs font-bold transition hover:border-gray-300 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:border-gray-600 sm:px-4 sm:py-3 sm:text-base"><Copy className="inline h-4 w-4" /> <span className="sm:hidden">Copy</span><span className="hidden sm:inline">Copy URL</span></button>
                      <button onClick={handleOpenPublicPage} className="rounded-xl border border-gray-200 px-2 py-2.5 text-xs font-bold transition hover:border-gray-300 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:border-gray-600 sm:px-4 sm:py-3 sm:text-base"><Globe className="inline h-4 w-4" /> <span className="sm:hidden">Open</span><span className="hidden sm:inline">Open Public Page</span></button>
                      <button onClick={handleSharePublicUrl} className="rounded-xl border border-gray-200 px-2 py-2.5 text-xs font-bold transition hover:border-gray-300 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:border-gray-600 sm:px-4 sm:py-3 sm:text-base"><Share2 className="inline h-4 w-4" /> <span className="sm:hidden">Share</span><span className="hidden sm:inline">Share URL</span></button>
                    </div>
                    <div className="relative mt-4 grid gap-2 text-xs">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-[#0B0B0B]">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">OpenHousePal Link</p>
                          <p className="truncate font-semibold text-gray-700 dark:text-gray-300">{agentHubPublicUrl}</p>
                        </div>
                        <button onClick={handleCopyPublicUrl} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy OpenHousePal link" aria-label="Copy OpenHousePal link">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {agentHubWebsiteUrl && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-[#0B0B0B]">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Website Link</p>
                            <p className="truncate font-semibold text-gray-700 dark:text-gray-300">{agentHubWebsiteUrl}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button onClick={() => window.open(agentHubWebsiteUrl, '_blank', 'noopener,noreferrer')} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Open website link" aria-label="Open website link">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => { copyText(agentHubWebsiteUrl); setSlugMessage('Website URL copied.') }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" title="Copy website link" aria-label="Copy website link">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    </HubCollapse>
                  </div>
                  )}</HubFold>
                  )}
                </div>
            )}
            </HubPanelMemory.Provider>

            {activeTab === 'Preview' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">Preview Agent Hub</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Updates live as you edit</p>
                      <div className="flex items-center gap-1">
                        <button onClick={handleCopyPublicUrl} title="Copy URL" aria-label="Copy URL" className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={handleOpenPublicPage} title="Open Public Page" aria-label="Open Public Page" className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white">
                          <Globe className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={handleSharePublicUrl} title="Share URL" aria-label="Share URL" className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white">
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex rounded-xl border border-gray-200 bg-[#fbfaf7] p-1">
                    {[
                      ['mobile', Smartphone],
                      ['tablet', Tablet],
                      ['desktop', Monitor],
                    ].map(([size, Icon]) => (
                      <button key={size as string} onClick={() => setPreviewSize(size as PreviewSize)} className={`rounded-lg px-3 py-2 ${previewSize === size ? 'bg-white shadow-sm' : ''}`} aria-label={`${size} preview`}>
                        <Icon className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                </div>
                {/* View only (owner, 10/24) - scrolls, but nothing in it can be clicked; "Open" is for that. */}
                <div className="mt-6 overflow-auto rounded-2xl bg-[#f2efe8] p-4">
                  <div inert className="pointer-events-none select-none" data-hub-preview-viewonly>
                  <PublicPreview size={previewSize} salesMinPrice={salesMinPrice} salesSort={salesSort} socialLinks={socialLinks} contact={contact} profilePhotoUrl={profilePhotoUrl} profilePhotoPosition={profilePhotoPosition} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} salesCarousel={salesCarousel} salesAutoScroll={salesAutoScroll} myListings={myListings} listingsCarousel={listingsCarousel} listingsAutoScroll={listingsAutoScroll} visitorDarkMode={visitorDarkMode} hubTheme={shownHubTheme} hubLuxeMetal={hubLuxeMetal} hubAccent={hubAccent} mobileHeader={mobileHeader} introNonce={hubIntroNonce} videosCarousel={videosCarousel} videosAutoScroll={videosAutoScroll} toursCarousel={toursCarousel} toursAutoScroll={toursAutoScroll} blogsCarousel={blogsCarousel} blogsAutoScroll={blogsAutoScroll} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={effectiveBlogCards} agentForms={agentForms} agentHubPublicPath={agentHubPublicPath} reviewsData={shownReviewsData} reviewsCarousel={reviewsCarousel} reviewsAutoScroll={reviewsAutoScroll} reviewsOnProfile={reviewsOnProfile} reviewsProfileButton={reviewsProfileButton} />
                  </div>
                </div>
              </div>
            )}
              </motion.section>
              </AnimatePresence>
            </div>

            {/* isolate: creates its own stacking context so nothing inside PublicPreview's own
                mocked-up nav bar/overlays (which can carry a high z-index to sit above ITS OWN
                scrolling preview content) can ever escape this box and paint over real page chrome
                outside it - explicit ask: "the dropdown from tools always overlap anything on page
                and have priority" but on the IDX/Site editor page the preview was winning instead. */}
            <div data-hub-side-preview className="sticky top-4 z-0 isolate flex h-[min(820px,calc(100vh-2rem))] min-w-0 flex-col overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white p-5 shadow-[0_26px_50px_-36px_rgba(139,115,85,.75)] dark:border-white/[0.08] dark:bg-[#151517]">
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
                    Live preview
                  </p>
                  <h2 className="mt-1 font-serif text-xl font-black text-[#111827] dark:text-white">{sidePreview === 'contact' ? 'Your Contact Card' : 'Your Agent Hub'}</h2>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{sidePreview === 'contact' ? 'What visitors save when they tap Save Contact.' : 'Updates as you edit - view only. Use Open to click around.'}</p>
                </div>
                <button onClick={handleOpenPublicPage} title="Open your public page" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#C9A24D]/40 bg-[#fbf6ec] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#8b7355] transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:bg-white/[0.06] dark:text-[#e8c97a]">
                  Open <ExternalLink className="h-3 w-3" />
                </button>
              </div>
              <div className="relative mt-3 flex rounded-full border border-[#C9A24D]/30 bg-[#fbf6ec] p-0.5 text-[10px] font-black uppercase tracking-widest dark:border-white/10 dark:bg-white/[0.04]">
                {([['hub', 'Agent Hub'], ['contact', 'Contact Card']] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setSidePreview(id)} className={`relative flex-1 rounded-full px-3 py-1.5 transition-colors ${sidePreview === id ? 'text-white dark:text-[#111827]' : 'text-[#8b7355] hover:text-[#111827] dark:text-[#e8c97a]'}`}>
                    {sidePreview === id && <motion.span layoutId="hub-side-preview-pill" className="absolute inset-0 rounded-full bg-[#111827] dark:bg-[#e8c97a]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
              <div className="relative mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[28px] [scrollbar-width:thin] [scrollbar-color:rgba(201,162,77,.45)_transparent]">
                <AnimatePresence mode="wait" initial={false}>
                  {sidePreview === 'contact' ? (
                    <motion.div key="contact" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[340px] py-2">
                      <ContactCardPreview fields={contactCard} source={contactCardSource} />
                    </motion.div>
                  ) : (
                    <motion.div key="hub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
                      // View only (owner, 10/24): it scrolls, but no link or button inside works - "Open" does that.
                      inert className="pointer-events-none select-none" data-hub-preview-viewonly>
                      <PublicPreview size="mobile" compact salesMinPrice={salesMinPrice} salesSort={salesSort} socialLinks={socialLinks} contact={contact} profilePhotoUrl={profilePhotoUrl} profilePhotoPosition={profilePhotoPosition} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} salesCarousel={salesCarousel} salesAutoScroll={salesAutoScroll} myListings={myListings} listingsCarousel={listingsCarousel} listingsAutoScroll={listingsAutoScroll} visitorDarkMode={visitorDarkMode} hubTheme={shownHubTheme} hubLuxeMetal={hubLuxeMetal} hubAccent={hubAccent} mobileHeader={mobileHeader} introNonce={hubIntroNonce} videosCarousel={videosCarousel} videosAutoScroll={videosAutoScroll} toursCarousel={toursCarousel} toursAutoScroll={toursAutoScroll} blogsCarousel={blogsCarousel} blogsAutoScroll={blogsAutoScroll} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={effectiveBlogCards} agentForms={agentForms} agentHubPublicPath={agentHubPublicPath} reviewsData={shownReviewsData} reviewsCarousel={reviewsCarousel} reviewsAutoScroll={reviewsAutoScroll} reviewsOnProfile={reviewsOnProfile} reviewsProfileButton={reviewsProfileButton} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      <InboxWindow
        isOpen={formsInboxOpen}
        onClose={() => setFormsInboxOpen(false)}
        title="Forms Inbox"
        subtitle="Every response to your forms - newest first"
        empty="No responses yet - they'll land here the moment someone fills out a form."
        items={agentForms
          .flatMap(form => (formSubmissionsByFormId[form.id] || []).map(submission => ({ form, submission })))
          .sort((a, b) => new Date(b.submission.created_at).getTime() - new Date(a.submission.created_at).getTime())
          .slice(0, 80)
          .map(({ form, submission }) => ({
            id: submission.id,
            title: `${submission.contact_name || 'Anonymous'} · ${form.title || 'Form'}`,
            subtitle: submission.property_address || submission.contact_email || submission.contact_phone || null,
            at: submission.created_at,
            unread: !submission.is_reviewed,
            icon: FileText,
            onOpen: () => { setFormsInboxOpen(false); openResults(form.id, submission.id) },
          }))}
        footer={openHouseRequestActionCount > 0 ? (
          <button
            onClick={() => { setFormsInboxOpen(false); setTimeout(() => document.getElementById('forms-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120) }}
            className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:border-red-300 dark:border-red-900/40 dark:bg-red-900/15 dark:text-red-300"
          >
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> {openHouseRequestActionCount} Cheat Sheet request{openHouseRequestActionCount === 1 ? '' : 's'} waiting on you</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : undefined}
      />

      <FormResultsModal
        isOpen={Boolean(resultsModalFormId)}
        onClose={() => { setResultsModalFormId(''); setResultsFocusId(''); forgetOpenedResult() }}
        form={agentForms.find(form => form.id === resultsModalFormId) || null}
        submissions={formSubmissionsByFormId[resultsModalFormId] || []}
        initialSubmissionId={resultsFocusId || (searchParams.get('formId') === resultsModalFormId ? searchParams.get('submission') || undefined : undefined)}
        isLoading={Boolean(submissionsLoadingByFormId[resultsModalFormId])}
        onToggleReviewed={async (submissionId, isReviewed) => {
          // Update in place instead of refetching the whole list - a full refetch flips the
          // modal's isLoading flag, which briefly swaps the entire list for a spinner and looks
          // like a glitch for what should be an instant toggle.
          const formId = resultsModalFormId
          setFormSubmissionsByFormId(current => ({
            ...current,
            [formId]: (current[formId] || []).map(submission => submission.id === submissionId ? { ...submission, is_reviewed: isReviewed } : submission),
          }))
          const response = await api.forms.markReviewed(submissionId, isReviewed)
          if (!response.success) {
            setFormSubmissionsByFormId(current => ({
              ...current,
              [formId]: (current[formId] || []).map(submission => submission.id === submissionId ? { ...submission, is_reviewed: !isReviewed } : submission),
            }))
          }
          refreshFormsActionCount()
        }}
        onDeleteSubmission={(submission) => setDeleteSubmissionTarget(submission)}
      />

      {statsModalFormId && (
        <FormStatsModal
          formId={statsModalFormId}
          title={agentForms.find(form => form.id === statsModalFormId)?.title || ''}
          onClose={() => setStatsModalFormId('')}
        />
      )}

      <AnimatePresence>
      {campaignsModalFormId && (() => {
        const campaignsModalForm = agentForms.find(form => form.id === campaignsModalFormId)
        if (!campaignsModalForm) return null
        return (
          <FormCampaignsModal
            key={`campaigns-${campaignsModalForm.id}`}
            form={campaignsModalForm}
            initialView={searchParams.get('view') === 'unfinished' && searchParams.get('formId') === campaignsModalForm.id ? 'unfinished' : undefined}
            onClose={() => { setCampaignsModalFormId(''); forgetOpenedResult() }}
            onReviewedChange={(submissionId, isReviewed) => {
              // Keep this page's copy in step, so the card's red count drops the moment it's
              // marked - not on the next reload.
              setFormSubmissionsByFormId(current => ({
                ...current,
                [campaignsModalForm.id]: (current[campaignsModalForm.id] || []).map(submission => submission.id === submissionId ? { ...submission, is_reviewed: isReviewed } : submission),
              }))
            }}
            onEdit={() => {
              setCampaignsModalFormId('')
              setFormEditorOpenId(campaignsModalForm.id)
              setIsBuilderOpen(true)
            }}
            onDuplicate={() => { setCampaignsModalFormId(''); handleDuplicateForm(campaignsModalForm) }}
          />
        )
      })()}
      </AnimatePresence>

      <AnimatePresence>
      {isBuilderOpen && (
      <FormBuilderModal
        key="form-builder"
        isOpen={isBuilderOpen}
        form={agentForms.find(form => form.id === formEditorOpenId) || null}
        onClose={handleRequestCloseFormBuilder}
        onUpdateField={(field, value) => updateFormField(formEditorOpenId, field, value)}
        onToggleBranding={() => toggleFormBranding(formEditorOpenId)}
        onToggleDarkMode={() => toggleFormDarkMode(formEditorOpenId)}
        hubLook={formHubLook}
        brandLook={formBrandLook}
        luxeAllowed={hubLuxeAllowed}
        onUpdateLook={(patch) => updateFormLook(formEditorOpenId, patch)}
        onApplyLookToAll={() => applyFormLookToAll(formEditorOpenId)}
        onToggleRedirectToAgentHub={() => toggleFormRedirect(formEditorOpenId)}
        onToggleRedirectToShowcase={() => toggleFormShowcaseRedirect(formEditorOpenId)}
        isDirty={!!formIsDirty[formEditorOpenId]}
        onTogglePropertyPhotoCarousel={() => toggleFormPropertyPhotoCarousel(formEditorOpenId)}
        onToggleBackgroundEffects={() => toggleFormBackgroundEffects(formEditorOpenId)}
        onToggleWelcomeTextEffects={() => toggleFormWelcomeTextEffects(formEditorOpenId)}
        onUpdateBrandingLayout={(layout) => updateFormBrandingLayout(formEditorOpenId, layout)}
        onUpdateLinkedProperty={(property) => updateFormLinkedProperty(formEditorOpenId, property)}
        onUpdateQuestion={(questionId, updates) => updateFormQuestion(formEditorOpenId, questionId, updates)}
        onAddQuestion={(type) => addFormQuestion(formEditorOpenId, type)}
        onRemoveQuestion={(questionId) => removeFormQuestion(formEditorOpenId, questionId)}
        onReorderQuestions={(draggedId, targetId) => reorderFormQuestions(formEditorOpenId, draggedId, targetId)}
        onSave={() => saveForm(formEditorOpenId)}
        onResetToDefault={() => handleResetFormToDefault(formEditorOpenId)}
        saveStatus={formSaveStatus[formEditorOpenId] || 'idle'}
        showPropertyLink={!PROPERTY_LINK_DISABLED_TYPES.has(agentForms.find(form => form.id === formEditorOpenId)?.form_type || '')}
        defaultDescription={(FORM_TYPE_META[agentForms.find(form => form.id === formEditorOpenId)?.form_type || ''] || FORM_TYPE_META.custom).description}
        branding={{
          agentName: profile.name || 'Your Name',
          agentBrokerage: profile.brokerage || 'Your Brokerage',
          agentPhotoUrl: profilePhotoUrl,
          agentTitle: profile.title,
          agentMarket: profile.market,
        }}
      />
      )}
      </AnimatePresence>

      <WarningConfirmModal
        isOpen={Boolean(pendingDiscardFormId)}
        onClose={() => setPendingDiscardFormId('')}
        onConfirm={handleConfirmDiscardFormChanges}
        title="Discard unsaved changes?"
        message="You have unsaved changes on this form. If you exit now without clicking Save, they'll be lost."
        confirmText="Discard changes"
      />

      {isEditingOpenHouseTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
            <p className="text-lg font-black tracking-tight text-[#111827] dark:text-white">Open House Requests Theme</p>
            <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Applies to both "Request Seller Disclosure" and "Schedule a Second Visit" guest pages.</p>

            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Accent color</span>
              <input
                type="color"
                value={openHouseRequestTheme.accentColor}
                onChange={(event) => setOpenHouseRequestTheme(current => ({ ...current, accentColor: event.target.value }))}
                className="mt-2 h-[46px] w-full rounded-xl border border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-[#0B0B0B]"
              />
            </label>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#0B0B0B]">
              <p className="text-sm font-black text-[#111827] dark:text-white">Midnight</p>
              <button
                type="button"
                onClick={() => setOpenHouseRequestTheme(current => ({ ...current, darkMode: !current.darkMode }))}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${openHouseRequestTheme.darkMode ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                aria-label={`${openHouseRequestTheme.darkMode ? 'Turn off' : 'Turn on'} dark mode`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full transition ${openHouseRequestTheme.darkMode ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
              </button>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setIsEditingOpenHouseTheme(false)}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOpenHouseTheme}
                disabled={savingOpenHouseTheme}
                className="flex-1 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white disabled:opacity-60 dark:bg-white dark:text-[#111827]"
              >
                {savingOpenHouseTheme ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {themeEditFormId && (() => {
        const themeEditForm = agentForms.find(item => item.id === themeEditFormId)
        if (!themeEditForm) return null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
              <p className="text-lg font-black tracking-tight text-[#111827] dark:text-white">{themeEditForm.title} Theme</p>
              <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">Its questions are locked so the automation behind it always works, but you can still change its color and dark mode.</p>
              <div className="mt-4"><ShowcaseFormInfoBlock formType={themeEditForm.form_type} compact /></div>
              <FormPlacementsNotice formType={themeEditForm.form_type} planTier={user?.plan_tier} className="mt-4" />

              <div className="mt-5">
                <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Look</p>
                <FormLookPicker value={themeEditForm} hubLook={formHubLook} brandLook={formBrandLook} luxeAllowed={hubLuxeAllowed}
                  onChange={(patch) => updateFormLook(themeEditFormId, patch)} onApplyAll={() => applyFormLookToAll(themeEditFormId)} />
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#0B0B0B]">
                <div>
                  <p className="text-sm font-black text-[#111827] dark:text-white">Agent branding</p>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">Your photo, name, and title on the welcome screen.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFormBranding(themeEditFormId)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${themeEditForm.show_branding ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                  aria-label={`${themeEditForm.show_branding ? 'Hide' : 'Show'} agent branding`}
                >
                  <span className={`absolute top-1 h-5 w-5 rounded-full transition ${themeEditForm.show_branding ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                </button>
              </div>

              {/* Its effects and where visitors go after submitting are the agent's call too (user, 10/24). */}
              <div className="mt-3">
                <EffectsSettings form={themeEditForm} onToggleBackground={() => toggleFormBackgroundEffects(themeEditFormId)} onToggleWelcome={() => toggleFormWelcomeTextEffects(themeEditFormId)} />
              </div>
              <div className="mt-4">
                <AfterSubmitSettings form={themeEditForm} hubAvailable={hasAgentHubAccess(user?.plan_tier)} onToggleHub={() => toggleFormRedirect(themeEditFormId)} onToggleShowcase={() => toggleFormShowcaseRedirect(themeEditFormId)} />
              </div>
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
                <p className="text-sm font-black text-[#111827] dark:text-white">Revert to default</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Back to OpenHousePal's look and settings for this form: your Brand Kit look, effects on, opens their Showcase.</p>
                <RevertButton busy={themeReverting} done={themeRevertDone} onClick={async () => {
                  setThemeReverting(true)
                  try { await handleResetFormToDefault(themeEditFormId); setThemeRevertDone(true); window.setTimeout(() => setThemeRevertDone(false), 2600) } finally { setThemeReverting(false) }
                }} />
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={handleCloseThemeEditor}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300"
                >
                  Cancel
                </button>
                <SaveFormButton status={formSaveStatus[themeEditFormId] || 'idle'} dirty={!!formIsDirty[themeEditFormId]} onClick={handleSaveThemeEditor} className="flex-1" />
              </div>
            </div>
          </div>
        )
      })()}

      <ConfirmationModal
        isOpen={Boolean(deleteFormTarget)}
        onClose={() => setDeleteFormTarget(null)}
        onConfirm={handleConfirmDeleteForm}
        title="Delete this form?"
        message={`"${deleteFormTarget?.title}" and all of its submissions will be permanently deleted. This can't be undone.`}
        confirmText="Delete Form"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg"
        isLoading={deletingForm}
      />

      <ConfirmationModal
        isOpen={Boolean(deleteSubmissionTarget)}
        onClose={() => setDeleteSubmissionTarget(null)}
        onConfirm={handleConfirmDeleteSubmission}
        title="Delete this submission?"
        message={`This submission from ${deleteSubmissionTarget?.contact_name || 'this visitor'} will be permanently deleted. This can't be undone.`}
        confirmText="Delete Submission"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg"
        isLoading={deletingSubmission}
      />

      <WarningConfirmModal
        isOpen={showAgentHubUrlWarning}
        onClose={() => setShowAgentHubUrlWarning(false)}
        onConfirm={() => { setShowAgentHubUrlWarning(false); handleSaveSlug() }}
        title="Change your Agent Hub URL?"
        message="Think carefully before changing this. Your current link stops working the moment you save a new one — anywhere you've put it (business cards, your email signature, social media bios, past texts and emails) will lead to a dead page instead of your Agent Hub. Your old link also becomes available for someone else to claim as their own. Only change this if you haven't shared your link yet, or you're prepared to update it everywhere it's been posted."
        confirmText="Yes, change my URL"
        isLoading={slugStatus === 'checking'}
      />

      <WarningConfirmModal
        isOpen={Boolean(pendingFormSlugSave)}
        onClose={() => setPendingFormSlugSave(null)}
        onConfirm={() => {
          if (pendingFormSlugSave) handleSaveFormSlug(pendingFormSlugSave)
          setPendingFormSlugSave(null)
        }}
        title="Change this form's link?"
        message="Changing this link breaks the QR code above and any link you've already shared — it'll lead to a dead page, and someone else could claim your old one. Only change it if you haven't shared this form yet."
        confirmText="Yes, change the link"
      />
    </main>
  )
}

function VideoLinksPanel({ items, setItems, channelUrl, setChannelUrl, carousel, setCarousel, autoScroll, setAutoScroll, onChange, onSave, autoSync = true, syncedAt, onToggleAutoSync }: { autoSync?: boolean; syncedAt?: string | null; onToggleAutoSync?: (next: boolean) => void; items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; channelUrl: string; setChannelUrl: React.Dispatch<React.SetStateAction<string>>; carousel: boolean; setCarousel: React.Dispatch<React.SetStateAction<boolean>>; autoScroll: boolean; setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'videoLinks' | 'videoChannelUrl' | 'videosCarousel' | 'videosAutoScroll'>>) => void }) {
  const [isLoadingChannel, setIsLoadingChannel] = useState(false)
  const [channelMessage, setChannelMessage] = useState('')
  const [draftChannelUrl, setDraftChannelUrl] = useState(channelUrl)
  const [savedChannelUrl, setSavedChannelUrl] = useState(channelUrl)
  const [channelLoaded, setChannelLoaded] = useState(false)
  const channelIsSaved = Boolean(draftChannelUrl.trim()) && draftChannelUrl.trim() === savedChannelUrl.trim()
  const [newestItemId, setNewestItemId] = useState<string | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)

  const moveDraggedItem = (targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) return
    const dragged = items.find(item => item.id === draggedItemId)
    if (!dragged) return
    const withoutDragged = items.filter(item => item.id !== draggedItemId)
    // Index must come from the original (pre-removal) array, not the filtered one - removing the
    // dragged item first shifts every later index down by one, so a forward drag always landed one
    // slot short of the hovered card (had to overshoot past it to compensate) while backward drags
    // happened to work by coincidence (nothing before the target shifts when removing an item after it).
    const targetIndex = items.findIndex(item => item.id === targetId)
    const next = [...withoutDragged]
    next.splice(targetIndex, 0, dragged)
    // onDragOver fires continuously while hovering (many times/sec), not just once per
    // target change - skip the state update (and its layout animation) unless the order
    // actually changed, otherwise every tick re-renders and re-saves for nothing, causing
    // the lag that gets worse on the 2nd+ drag as unfinished renders pile up.
    const changed = next.length !== items.length || next.some((item, index) => item.id !== items[index]?.id)
    if (changed) setItems(next)
  }

  const finishDraggingItem = () => {
    setDraggedItemId(null)
    const ordered = pinnedFirst(items)
    setItems(ordered)
    onSave({ videoLinks: ordered, videoChannelUrl: channelUrl })
  }

  const togglePinned = (id: string) => {
    const nextItems = pinnedFirst(items.map(item => item.id === id ? { ...item, pinned: !item.pinned } : item))
    setItems(nextItems)
    onSave({ videoLinks: nextItems, videoChannelUrl: channelUrl })
  }

  useEffect(() => {
    setDraftChannelUrl(channelUrl)
    setSavedChannelUrl(channelUrl)
  }, [channelUrl])

  useEffect(() => {
    if (newestItemId && itemRefs.current[newestItemId]) {
      itemRefs.current[newestItemId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNewestItemId(null)
    }
  }, [newestItemId, items])

  const addVideo = () => {
    const newId = `video-${Date.now()}`
    const nextItems = [...items, { id: newId, title: 'New YouTube Video', link: '' }]
    setItems(nextItems)
    onSave({ videoLinks: nextItems, videoChannelUrl: channelUrl })
    setNewestItemId(newId)
  }

  const saveChannelUrl = () => {
    setChannelUrl(draftChannelUrl)
    setSavedChannelUrl(draftChannelUrl)
    setChannelLoaded(false)
    setChannelMessage(draftChannelUrl.trim() ? 'Channel saved.' : '')
    onSave({ videoLinks: items, videoChannelUrl: draftChannelUrl })
  }

  const updateVideoLink = async (id: string, link: string) => {
    const title = await getYoutubeTitle(link)
    const nextItems = items.map(item => item.id === id ? { ...item, link, title: title || item.title } : item)
    setItems(nextItems)
    onSave({ videoLinks: nextItems, videoChannelUrl: channelUrl })
  }

  const deleteVideo = (id: string) => {
    const nextItems = items.filter(item => item.id !== id)
    setItems(nextItems)
    onSave({ videoLinks: nextItems, videoChannelUrl: channelUrl })
  }

  const loadChannelVideos = async () => {
    if (!draftChannelUrl.trim()) return
    setIsLoadingChannel(true)
    setChannelMessage('')
    const response = await api.agentHub.getYoutubeChannelVideos(draftChannelUrl)
    if (response.success && response.data?.videos?.length) {
      // Favourites stay on top; the channel's newest uploads fill in after them.
      const pins = items.filter(item => item.pinned)
      const loaded = [...pins, ...response.data.videos.filter((v: HubItem) => !pins.some(p => p.link === v.link))]
      setItems(loaded)
      onSave({ videoLinks: loaded, videoChannelUrl: draftChannelUrl })
      setSavedChannelUrl(draftChannelUrl)
      setChannelLoaded(true)
      setChannelMessage(`Loaded ${response.data.videos.length} recent videos.`)
    } else {
      setChannelLoaded(false)
      setChannelMessage(response.error || 'Could not load videos from this channel.')
    }
    setIsLoadingChannel(false)
  }

  return (
    <EditableContentPanel
      title="Videos"
      action="Add Video"
      count={`${items.filter(item => item.link?.trim()).length} videos`}
      icon={Video}
      noun="video"
      settingsIntro="Choose how your videos appear on your public Agent Hub."
      onAdd={addVideo}
      summary="Connect a YouTube channel and paste individual YouTube links."
      carousel={carousel}
      onToggleCarousel={() => { setCarousel(current => !current); onSave({ videosCarousel: !carousel, videoLinks: items, videoChannelUrl: channelUrl }); onChange() }}
      autoScroll={autoScroll}
      onToggleAutoScroll={() => { setAutoScroll(current => !current); onSave({ videosAutoScroll: !autoScroll, videoLinks: items, videoChannelUrl: channelUrl }); onChange() }}
    >
      <div className={`rounded-2xl border bg-white p-4 shadow-sm border-gray-200 dark:border-gray-700`}>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">YouTube channel link</span>
          <input value={draftChannelUrl} onChange={event => setDraftChannelUrl(event.target.value)} placeholder="https://www.youtube.com/@example" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
          <span className="mt-1.5 block text-[11px] font-semibold leading-snug text-gray-500">Your channel&apos;s address, not one video: on YouTube tap your profile picture → <b>View your channel</b> and copy the link (it looks like youtube.com/@yourname). The blog writer suggests these videos for your articles too.</span>
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={saveChannelUrl} disabled={!draftChannelUrl.trim()} className={`rounded-xl px-4 py-3 text-sm font-black ${channelIsSaved ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-gray-200 bg-[#fbfaf7] text-gray-700'}`}>
            <Check className="mr-1 inline h-4 w-4" /> Save Channel
          </button>
          <button onClick={loadChannelVideos} disabled={isLoadingChannel || !draftChannelUrl.trim()} className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            {isLoadingChannel ? 'Loading...' : 'Load Recent Videos'}
          </button>
        </div>
        {channelMessage && <p className="mt-3 text-sm font-bold text-gray-600">{channelMessage}</p>}
        {onToggleAutoSync && (
          <div className="mt-3">
            <SettingToggleRow
              label="Auto-update from channel"
              hint={`New uploads from your channel appear here on their own, checked once a day, after your starred favorites. Videos you add by hand stay.${autoSync && syncedAt ? ` Last checked ${new Date(syncedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : ''}`}
              checked={autoSync}
              onChange={onToggleAutoSync}
            />
          </div>
        )}
      </div>
      <div className="pt-2 text-xs font-black uppercase tracking-widest text-gray-400">Video links</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(item => {
          const thumbnail = getYoutubeThumbnail(item.link || '')
          return (
          <motion.div
            key={item.id}
            layout
            transition={{ layout: { type: 'spring', stiffness: 500, damping: 34 } }}
            ref={el => { itemRefs.current[item.id] = el }}
            draggable
            onDragStart={() => setDraggedItemId(item.id)}
            onDragOver={(event) => { event.preventDefault(); moveDraggedItem(item.id) }}
            onDragEnd={finishDraggingItem}
            className={`group relative cursor-grab overflow-hidden rounded-2xl border bg-[#fbfaf7] transition-all duration-200 active:cursor-grabbing ${draggedItemId === item.id ? 'z-10 border-[#C9A24D] shadow-xl' : 'border-gray-200 hover:border-[#C9A24D]/50'}`}
          >
            <div className="flex items-center justify-center gap-1.5 border-b border-gray-200 bg-gray-100 py-1.5 text-gray-400 transition-colors group-hover:bg-[#C9A24D]/10 group-hover:text-[#8b7355] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
              <GripVertical className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Drag to reorder</span>
            </div>
            {thumbnail && <div className="aspect-video w-full bg-cover bg-center" style={{ backgroundImage: `url(${thumbnail})` }} />}
            <div className="space-y-2 p-3">
              {item.title && <p className="text-sm font-black leading-tight text-gray-700">{item.title}</p>}
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] font-black uppercase tracking-widest text-gray-400">Link:</span>
                <input value={item.link || ''} onChange={event => updateVideoLink(item.id, event.target.value)} onPaste={event => { const pasted = event.clipboardData.getData('text'); if (pasted) setTimeout(() => updateVideoLink(item.id, pasted), 0) }} placeholder="https://youtube.com/watch?v=..." className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
              </div>
              <div className="flex gap-2">
                <PinButton pinned={!!item.pinned} onClick={() => togglePinned(item.id)} />
                <button onClick={() => deleteVideo(item.id)} className="flex-1 rounded-xl border border-red-200 bg-white py-2 text-sm font-black text-red-600">
                  <Trash2 className="inline h-4 w-4" /> Delete
                </button>
              </div>
            </div>
            {item.pinned && <span className="pointer-events-none absolute right-2 top-10 inline-flex items-center gap-1 rounded-full bg-[#111827]/85 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#e8c97a]"><Star className="h-3 w-3 fill-current" /> Always first</span>}
          </motion.div>
          )
        })}
      </div>
    </EditableContentPanel>
  )
}

// Star a video or house tour: it always shows first on the Agent Hub (and the IDX Media page).
function PinButton({ pinned, onClick }: { pinned: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={pinned ? 'Remove from favorites' : 'Favorite - always show first'}
      aria-label={pinned ? 'Remove from favorites' : 'Favorite - always show first'}
      aria-pressed={pinned}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition ${pinned ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D]/60 dark:border-gray-700 dark:bg-[#151517]'}`}
    >
      <Star className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} /> Favorite
    </button>
  )
}

function HouseToursPanel({ items, setItems, houseTourUrl, setHouseTourUrl, carousel, setCarousel, autoScroll, setAutoScroll, onSave }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; houseTourUrl: string; setHouseTourUrl: React.Dispatch<React.SetStateAction<string>>; carousel: boolean; setCarousel: React.Dispatch<React.SetStateAction<boolean>>; autoScroll: boolean; setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'houseTourLinks' | 'houseTourUrl' | 'toursCarousel' | 'toursAutoScroll'>>) => void }) {
  const [draftHouseTourUrl, setDraftHouseTourUrl] = useState(houseTourUrl)
  const [savedHouseTourUrl, setSavedHouseTourUrl] = useState(houseTourUrl)
  const houseTourIsSaved = Boolean(draftHouseTourUrl.trim()) && draftHouseTourUrl.trim() === savedHouseTourUrl.trim()
  const visibleItems = items.filter(item => item.link?.trim())
  const [newestItemId, setNewestItemId] = useState<string | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false)
  const [playlistMessage, setPlaylistMessage] = useState('')
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)

  useEffect(() => {
    setDraftHouseTourUrl(houseTourUrl)
    setSavedHouseTourUrl(houseTourUrl)
  }, [houseTourUrl])

  useEffect(() => {
    if (newestItemId && itemRefs.current[newestItemId]) {
      itemRefs.current[newestItemId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNewestItemId(null)
    }
  }, [newestItemId, items])

  const saveItems = (nextItems: HubItem[]) => {
    setItems(nextItems)
    onSave({ houseTourLinks: nextItems, houseTourUrl })
  }

  const moveDraggedItem = (targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) return
    const dragged = items.find(item => item.id === draggedItemId)
    if (!dragged) return
    const withoutDragged = items.filter(item => item.id !== draggedItemId)
    // Index must come from the original (pre-removal) array, not the filtered one - removing the
    // dragged item first shifts every later index down by one, so a forward drag always landed one
    // slot short of the hovered card (had to overshoot past it to compensate) while backward drags
    // happened to work by coincidence (nothing before the target shifts when removing an item after it).
    const targetIndex = items.findIndex(item => item.id === targetId)
    const next = [...withoutDragged]
    next.splice(targetIndex, 0, dragged)
    // onDragOver fires continuously while hovering, not just once per target change -
    // skip the state update (and its layout animation) unless the order actually changed.
    const changed = next.length !== items.length || next.some((item, index) => item.id !== items[index]?.id)
    if (changed) setItems(next)
  }

  const finishDraggingItem = () => {
    setDraggedItemId(null)
    const ordered = pinnedFirst(items)
    setItems(ordered)
    onSave({ houseTourLinks: ordered, houseTourUrl })
  }

  const togglePinned = (id: string) => {
    saveItems(pinnedFirst(items.map(item => item.id === id ? { ...item, pinned: !item.pinned } : item)))
  }

  const addTour = () => {
    const newId = `tour-${Date.now()}`
    saveItems([...items, { id: newId, title: 'House Tour', link: '' }])
    setNewestItemId(newId)
  }

  const updateTourLink = async (id: string, link: string) => {
    const title = await getYoutubeTitle(link)
    const nextItems = items.map(item => item.id === id ? { ...item, link, title: title || item.title } : item)
    saveItems(nextItems)
  }

  const deleteTour = (id: string) => {
    saveItems(items.filter(item => item.id !== id))
  }

  const saveHouseTourUrl = () => {
    setHouseTourUrl(draftHouseTourUrl)
    setSavedHouseTourUrl(draftHouseTourUrl)
    onSave({ houseTourLinks: items, houseTourUrl: draftHouseTourUrl })
  }

  const loadPlaylistTours = async () => {
    if (!draftHouseTourUrl.trim()) return
    setIsLoadingPlaylist(true)
    setPlaylistMessage('')
    const response = await api.agentHub.getYoutubePlaylistVideos(draftHouseTourUrl)
    if (response.success && response.data?.videos?.length) {
      const pins = items.filter(item => item.pinned)
      const loaded = [...pins, ...response.data.videos.filter((v: HubItem) => !pins.some(p => p.link === v.link))]
      setItems(loaded)
      setHouseTourUrl(draftHouseTourUrl)
      setSavedHouseTourUrl(draftHouseTourUrl)
      onSave({ houseTourLinks: loaded, houseTourUrl: draftHouseTourUrl })
      setPlaylistMessage(`Loaded ${response.data.videos.length} recent tours.`)
    } else {
      setPlaylistMessage(response.error || 'Could not load videos from this playlist.')
    }
    setIsLoadingPlaylist(false)
  }

  return (
    <EditableContentPanel
      title="House Tours"
      action="Add Tour"
      count={`${visibleItems.length} tours`}
      icon={Play}
      noun="tour"
      settingsIntro="Choose how your house tours appear on your public Agent Hub."
      onAdd={addTour}
      summary="Paste individual YouTube tour links."
      carousel={carousel}
      onToggleCarousel={() => { setCarousel(current => !current); onSave({ toursCarousel: !carousel, houseTourLinks: items, houseTourUrl }) }}
      autoScroll={autoScroll}
      onToggleAutoScroll={() => { setAutoScroll(current => !current); onSave({ toursAutoScroll: !autoScroll, houseTourLinks: items, houseTourUrl }) }}
    >
          <div className={`rounded-2xl border bg-white p-4 shadow-sm border-gray-200 dark:border-gray-700`}>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Home Tour Playlist Link</span>
              <input
                value={draftHouseTourUrl}
                onChange={event => setDraftHouseTourUrl(event.target.value)}
                placeholder="https://www.youtube.com/playlist?list=..."
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={saveHouseTourUrl} disabled={!draftHouseTourUrl.trim()} className={`rounded-xl px-4 py-3 text-sm font-black ${houseTourIsSaved ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-gray-200 bg-[#fbfaf7] text-gray-700'}`}>
                <Check className="mr-1 inline h-4 w-4" /> Save Link
              </button>
              <button onClick={loadPlaylistTours} disabled={isLoadingPlaylist || !draftHouseTourUrl.trim()} className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                {isLoadingPlaylist ? 'Loading...' : 'Load Recent Tours'}
              </button>
            </div>
            <p className="mt-2 text-xs font-bold text-gray-500">This link powers the Watch button on your public hub. &quot;Load Recent Tours&quot; auto-syncs up to 15 videos from this playlist.</p>
            {playlistMessage && <p className="mt-2 text-sm font-bold text-gray-600">{playlistMessage}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(item => {
              const thumbnail = getYoutubeThumbnail(item.link || '')
              return (
              <motion.div
                key={item.id}
                layout
                transition={{ layout: { type: 'spring', stiffness: 500, damping: 34 } }}
                ref={el => { itemRefs.current[item.id] = el }}
                draggable
                onDragStart={() => setDraggedItemId(item.id)}
                onDragOver={(event) => { event.preventDefault(); moveDraggedItem(item.id) }}
                onDragEnd={finishDraggingItem}
                className={`group relative cursor-grab overflow-hidden rounded-2xl border bg-white transition-all duration-200 active:cursor-grabbing ${draggedItemId === item.id ? 'z-10 border-[#C9A24D] shadow-xl' : 'border-gray-200 hover:border-[#C9A24D]/50'}`}
              >
                <div className="flex items-center justify-center gap-1.5 border-b border-gray-200 bg-gray-100 py-1.5 text-gray-400 transition-colors group-hover:bg-[#C9A24D]/10 group-hover:text-[#8b7355] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
                  <GripVertical className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Drag to reorder</span>
                </div>
                {thumbnail && <div className="aspect-video w-full bg-cover bg-center" style={{ backgroundImage: `url(${thumbnail})` }} />}
                <div className="space-y-2 p-3">
                  {item.title && <p className="text-sm font-black leading-tight text-gray-700">{item.title}</p>}
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[11px] font-black uppercase tracking-widest text-gray-400">Link:</span>
                    <input value={item.link || ''} onChange={event => updateTourLink(item.id, event.target.value)} placeholder="https://youtube.com/watch?v=..." className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
                  </div>
                  <div className="flex gap-2">
                    <PinButton pinned={!!item.pinned} onClick={() => togglePinned(item.id)} />
                    <button onClick={() => deleteTour(item.id)} className="flex-1 rounded-xl border border-red-200 bg-white py-2 text-sm font-black text-red-600">
                      <Trash2 className="inline h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
                {item.pinned && <span className="pointer-events-none absolute right-2 top-10 inline-flex items-center gap-1 rounded-full bg-[#111827]/85 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#e8c97a]"><Star className="h-3 w-3 fill-current" /> Always first</span>}
              </motion.div>
              )
            })}
          </div>
    </EditableContentPanel>
  )
}


function BlogCardsPanel({ items, setItems, carousel, setCarousel, autoScroll, setAutoScroll, onChange, onSave, studioBlogs, studioBlogsLoading, onToggleStudioBlogVisible, onToggleStudioBlogFeatured }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; carousel: boolean; setCarousel: React.Dispatch<React.SetStateAction<boolean>>; autoScroll: boolean; setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'blogCards' | 'blogsCarousel' | 'blogsAutoScroll'>>) => void; studioBlogs: BlogListItem[]; studioBlogsLoading: boolean; onToggleStudioBlogVisible: (id: string) => void; onToggleStudioBlogFeatured: (id: string) => void }) {
  const [savedRows, setSavedRows] = useState<Record<string, boolean>>({})
  const [newestItemId, setNewestItemId] = useState<string | null>(null)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)

  useEffect(() => {
    if (newestItemId && itemRefs.current[newestItemId]) {
      itemRefs.current[newestItemId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setNewestItemId(null)
    }
  }, [newestItemId, items])

  const moveDraggedItem = (targetId: string) => {
    if (!draggedItemId || draggedItemId === targetId) return
    const dragged = items.find(item => item.id === draggedItemId)
    if (!dragged) return
    const withoutDragged = items.filter(item => item.id !== draggedItemId)
    // Index must come from the original (pre-removal) array, not the filtered one - removing the
    // dragged item first shifts every later index down by one, so a forward drag always landed one
    // slot short of the hovered card (had to overshoot past it to compensate) while backward drags
    // happened to work by coincidence (nothing before the target shifts when removing an item after it).
    const targetIndex = items.findIndex(item => item.id === targetId)
    const next = [...withoutDragged]
    next.splice(targetIndex, 0, dragged)
    // onDragOver fires continuously while hovering, not just once per target change -
    // skip the state update (and its layout animation) unless the order actually changed.
    const changed = next.length !== items.length || next.some((item, index) => item.id !== items[index]?.id)
    if (changed) setItems(next)
  }

  const finishDraggingItem = () => {
    setDraggedItemId(null)
    onSave({ blogCards: items })
  }

  const addBlog = () => {
    const newId = `blog-${Date.now()}`
    const nextItems = [...items, { id: newId, title: '', image: '', link: '' }]
    setItems(nextItems)
    onSave({ blogCards: nextItems })
    setNewestItemId(newId)
  }

  const updateItem = (id: string, updates: Partial<HubItem>) => {
    setItems(current => current.map(item => item.id === id ? { ...item, ...updates } : item))
    setSavedRows(current => ({ ...current, [id]: false }))
    onChange()
  }

  const loadBlogPreview = async (id: string, link: string) => {
    if (!link.trim()) return null
    const response = await api.agentHub.getLinkPreview(link)
    if (response.success && response.data) {
      const preview = {
        title: response.data.title || items.find(item => item.id === id)?.title || '',
        image: response.data.image || items.find(item => item.id === id)?.image || '',
      }
      updateItem(id, preview)
      return preview
    }
    return null
  }

  const deleteBlog = (id: string) => {
    const nextItems = items.filter(item => item.id !== id)
    setItems(nextItems)
    onSave({ blogCards: nextItems })
  }

  const saveBlog = async (id: string) => {
    const item = items.find(item => item.id === id)
    const preview = item?.link ? await loadBlogPreview(id, item.link) : null
    const nextItems = items.map(item => item.id === id ? { ...item, ...(preview || {}) } : item)
    setItems(nextItems)
    onSave({ blogCards: nextItems })
    setSavedRows(current => ({ ...current, [id]: true }))
  }

  const manualCount = items.filter(item => item.link?.trim() || item.title.trim()).length
  const totalCount = studioBlogs.length + manualCount

  return (
    <EditableContentPanel
      title="Blogs"
      action="Add Blog"
      count={`${totalCount} blog${totalCount === 1 ? '' : 's'}`}
      icon={BookOpen}
      noun="article"
      settingsIntro="Choose how your blogs appear on your public Agent Hub."
      onAdd={addBlog}
      summary="Articles you publish in Studio show up here automatically. You can also paste a manual blog link below."
      carousel={carousel}
      onToggleCarousel={() => { setCarousel(current => !current); onSave({ blogsCarousel: !carousel, blogCards: items }); onChange() }}
      autoScroll={autoScroll}
      onToggleAutoScroll={() => { setAutoScroll(current => !current); onSave({ blogsAutoScroll: !autoScroll, blogCards: items }); onChange() }}
    >
      {studioBlogsLoading && <p className="text-sm font-semibold text-gray-400">Loading your Studio articles...</p>}
      {!studioBlogsLoading && studioBlogs.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-gray-400">From Studio · auto-synced</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...studioBlogs].sort((a, b) => (b.agent_hub_featured ? 1 : 0) - (a.agent_hub_featured ? 1 : 0)).map(blog => (
              // A column: the card fills what's left of the row height, the buttons sit under it (the
              // card used to take the whole cell, pushing its buttons under the next row's cards).
              <div key={blog.id} className={`flex flex-col ${blog.agent_hub_visible ? '' : 'opacity-60'}`}>
                <div className="flex-1"><BlogCard title={blog.title} subtitle={blog.subtitle} category={blog.category} publishedAt={blog.published_at} viewCount={blog.view_count} /></div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => onToggleStudioBlogVisible(blog.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black ${blog.agent_hub_visible ? 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-200' : 'border-[#C9A24D]/40 bg-[#C9A24D]/10 text-[#8b7355]'}`}
                  >
                    {blog.agent_hub_visible ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show</>}
                  </button>
                  <PinButton pinned={!!blog.agent_hub_featured} onClick={() => onToggleStudioBlogFeatured(blog.id)} />
                </div>
                <Link href={`/studio/blogs/${blog.id}`} className="mt-1.5 block text-center text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Manage in Studio</Link>
              </div>
            ))}
          </div>
        </div>
      )}
      {!studioBlogsLoading && studioBlogs.length === 0 && (
        <Link href="/studio/blogs?new=1" className="flex items-center justify-between rounded-xl border border-dashed border-gray-300 p-4 text-sm font-bold text-gray-400 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700">
          No published Studio articles yet <span>Write one in Studio &rsaquo;</span>
        </Link>
      )}
      {studioBlogs.length > 0 && manualCount > 0 && (
        <p className="px-1 pt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">Manual links</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(item => (
          <motion.div
            key={item.id}
            layout
            transition={{ layout: { type: 'spring', stiffness: 500, damping: 34 } }}
            ref={el => { itemRefs.current[item.id] = el }}
            draggable
            onDragStart={() => setDraggedItemId(item.id)}
            onDragOver={(event) => { event.preventDefault(); moveDraggedItem(item.id) }}
            onDragEnd={finishDraggingItem}
            className={`group relative cursor-grab overflow-hidden rounded-2xl border bg-[#fbfaf7] transition-all duration-200 active:cursor-grabbing ${draggedItemId === item.id ? 'z-10 border-[#C9A24D] shadow-xl' : 'border-gray-200 hover:border-[#C9A24D]/50'}`}
          >
            <div className="flex items-center justify-center gap-1.5 border-b border-gray-200 bg-gray-100 py-1.5 text-gray-400 transition-colors group-hover:bg-[#C9A24D]/10 group-hover:text-[#8b7355] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
              <GripVertical className="h-3.5 w-3.5" />
              <span className="text-[10px] font-black uppercase tracking-widest">Drag to reorder</span>
            </div>
            <div className="p-4">
              <div className="aspect-video w-full rounded-xl bg-cover bg-center" style={{ backgroundImage: item.image ? `url(${item.image})` : 'radial-gradient(120% 120% at 100% 0%, rgba(201,162,77,.45), transparent 55%), linear-gradient(135deg, #111827, #2a2218)' }} />
              <div className="mt-3 space-y-3">
                <input value={item.title} onChange={event => updateItem(item.id, { title: event.target.value })} placeholder="Blog title" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
                <input value={item.link || ''} onChange={event => updateItem(item.id, { link: event.target.value })} onBlur={event => loadBlogPreview(item.id, event.target.value)} placeholder="Paste blog link" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
                <div className="flex items-center gap-2">
                  <button onClick={() => saveBlog(item.id)} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black ${savedRows[item.id] ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                    <Check className="inline h-4 w-4" /> {savedRows[item.id] ? 'Saved' : 'Save'}
                  </button>
                  <button onClick={() => deleteBlog(item.id)} className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600">
                    <Trash2 className="inline h-4 w-4" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </EditableContentPanel>
  )
}

function EditableContentPanel({ title, action, count, icon: Icon, summary, settingsIntro, noun, onAdd, carousel, onToggleCarousel, autoScroll, onToggleAutoScroll, children }: { title: string; action?: string; count?: string; icon: React.ComponentType<{ className?: string }>; summary: string; settingsIntro?: string; noun: string; onAdd?: () => void; carousel?: boolean; onToggleCarousel?: () => void; autoScroll?: boolean; onToggleAutoScroll?: () => void; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useHubPanelOpen(`content-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)

  return (
    <section className={hubCardClass(isOpen)}>
      <div className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 p-5">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
          <span className={HUB_ICON_TILE}><Icon className={HUB_ICON} /></span>
          <div className="min-w-0">
            <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white">{title}</h3>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">{summary}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {count && <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300">{count}</span>}
          {isOpen && action && onAdd && <button onClick={onAdd} className="hidden items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-[#111827] sm:inline-flex"><Plus className="h-4 w-4" /> {action}</button>}
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 bg-white p-3 text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400" aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}>
            <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      <HubCollapse open={isOpen}>
        <div className="space-y-3 border-t border-gray-100 bg-[#fbfaf7] p-5 dark:border-gray-800 dark:bg-[#0B0B0B]">
          {/* Same settings box + labeled toggle rows as Recent Sales (explicit ask: Videos/House
              Tours/Blogs should present these settings "the same way" - a sentence of context and
              a plain-language hint under each toggle, not a strip of tiny unlabeled chips). */}
          {(onToggleCarousel || onToggleAutoScroll) && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              {settingsIntro && <p className="text-sm font-semibold text-gray-500 dark:text-gray-300">{settingsIntro}</p>}
              <div className="mt-3 space-y-2">
                {onToggleCarousel && (
                  <SettingToggleRow
                    label="Carousel view"
                    hint={`On mobile, auto-swipes through one large ${noun} at a time instead of a scrolling row.`}
                    checked={!!carousel}
                    onChange={() => onToggleCarousel()}
                  />
                )}
                {onToggleAutoScroll && (
                  <SettingToggleRow
                    label="Auto scroll"
                    hint="Scrolls this row on its own, taking turns with your other sections, when the page sits idle."
                    checked={!!autoScroll}
                    onChange={() => onToggleAutoScroll()}
                  />
                )}
              </div>
            </div>
          )}
          {action && onAdd && <button onClick={onAdd} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-[#111827] sm:hidden"><Plus className="h-4 w-4" /> {action}</button>}
          {children}
        </div>
      </HubCollapse>
    </section>
  )
}

function ManagementPanel({
  title,
  button,
  initialItems,
  onChange,
  icon: Icon,
  accent,
}: {
  title: string
  button: string
  initialItems: HubItem[]
  onChange: () => void
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  const [items, setItems] = useState(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const updateItems = (next: HubItem[]) => {
    setItems(next)
    onChange()
  }

  const addItem = () => {
    const base = button.replace('Add ', '').replace('Find ', 'Sale')
    const newItem = {
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
      title: `New ${base}`,
    }
    updateItems([...items, newItem])
    setEditingId(newItem.id)
    setIsOpen(true)
  }

  const editItem = (id: string, titleValue: string) => {
    updateItems(items.map(item => item.id === id ? { ...item, title: titleValue } : item))
  }

  const deleteItem = (id: string) => {
    updateItems(items.filter(item => item.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-[#C9A24D]/50 hover:shadow-md">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-black">{title}</h3>
                <span className="rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1 text-xs font-black text-gray-600">{items.length} items</span>
              </span>
              <span className="mt-2 block text-sm font-semibold text-gray-500">
                {isOpen ? 'Edit names and remove anything you do not need.' : 'Open to edit, add, or delete items.'}
              </span>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={addItem} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white" aria-label={button}>
              <Plus className="h-4 w-4" /> {button}
            </button>
            <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 p-3 text-gray-500" aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}>
              <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        {!isOpen && (
          <div className="mt-5 flex flex-wrap gap-2 sm:pl-16">
            {items.slice(0, 4).map(item => (
              <span key={item.id} className="rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1.5 text-xs font-bold text-gray-600">{item.title}</span>
            ))}
            {items.length > 4 && (
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black text-gray-500">+{items.length - 4} more</span>
            )}
          </div>
        )}
      </div>
      {isOpen && (
        <div className="border-t border-gray-100 bg-[#fbfaf7] p-5">
          <div className="grid gap-3 md:grid-cols-2">
            {items.map(item => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-[#C9A24D]/60"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {editingId === item.id ? (
                      <input
                        value={item.title}
                        onChange={(event) => editItem(item.id, event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-[#C9A24D]"
                        autoFocus
                      />
                    ) : (
                      <p className="font-black">{item.title}</p>
                    )}
                    <p className="mt-1 text-xs font-semibold text-gray-500">Edit or remove this item</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                  <button
                    onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700"
                  >
                    {editingId === item.id ? 'Done' : 'Edit'}
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-red-600"
                  >
                    <Trash2 className="inline h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="mt-4 w-full rounded-2xl border border-dashed border-[#C9A24D] bg-white px-4 py-4 font-black text-[#8b7355]">
            <Plus className="inline h-4 w-4" /> {button}
          </button>
        </div>
      )}
    </div>
  )
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="rounded-xl border border-gray-200 p-2" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// The header every Agent Hub editor panel opens with - gold kicker, serif title, the panel's status
// and its Save button. Static (no Edit/Close) - each tab shows its panels already open.
// One editor panel that folds: starts closed the first time, then remembers how the agent left
// it (useHubPanelOpen). `alwaysOpen` panels (Profile) never fold.
function HubFold({ id, alwaysOpen = false, children }: { id: string; alwaysOpen?: boolean; children: (open: boolean, toggle?: () => void) => React.ReactNode }) {
  const [stored, setStored] = useHubPanelOpen(id)
  if (alwaysOpen) return <>{children(true)}</>
  return <>{children(stored, () => setStored(!stored))}</>
}

function HubPanelHead({ icon: Icon, kicker, title, subtitle, status, action, open = true, onToggle }: { icon: LucideIcon; kicker: string; title: string; subtitle?: string; status?: React.ReactNode; action?: React.ReactNode; open?: boolean; onToggle?: () => void }) {
  const text = (
    <>
      <span className={`${HUB_ICON_TILE} max-sm:hidden`}><Icon className={HUB_ICON} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">{kicker}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-xl font-black tracking-tight text-[#111827] dark:text-white">{title}</h3>
          {status}
        </div>
        {subtitle && <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </>
  )
  return (
    <div className={`group relative flex flex-nowrap items-center gap-3 overflow-hidden bg-gradient-to-r from-[#fffdf8] via-white to-white p-4 sm:gap-4 sm:p-5 dark:from-[#1a1712] dark:via-[#151517] dark:to-[#151517] ${open ? 'border-b border-[#C9A24D]/15 dark:border-white/[0.06]' : ''}`}>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/60 to-transparent" />
      {onToggle ? <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-4 text-left">{text}</button> : text}
      {open && action}
      {onToggle && (
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onToggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:border-[#C9A24D]/60 hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400 sm:h-11 sm:w-11" aria-label={`${open ? 'Collapse' : 'Expand'} ${title}`}>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 420, damping: 26 }} className="grid place-items-center"><ChevronDown className="h-5 w-5" /></motion.span>
        </motion.button>
      )}
    </div>
  )
}

/** The Save button on text panels (owner, 10/24: clicking Save gave no feedback). Gold dot while
 *  something is unsaved, a spinner while saving, then it morphs into a green "Saved ✓" for a moment.
 *  Phones get a round icon button so it never takes a whole line in the panel header. */
function HubSaveButton({ dirty, saving, savedTick, onSave }: { dirty: boolean; saving: boolean; savedTick: number; onSave: () => void }) {
  const [justSaved, setJustSaved] = useState(false)
  const firstTick = useRef(savedTick)
  useEffect(() => {
    if (savedTick === firstTick.current) return
    setJustSaved(true)
    const t = setTimeout(() => setJustSaved(false), 1600)
    return () => clearTimeout(t)
  }, [savedTick])
  const state = saving ? 'saving' : justSaved && !dirty ? 'saved' : dirty ? 'dirty' : 'clean'
  return (
    <motion.button
      type="button"
      // keep focus in the text box - its blur-save and this click would otherwise both save
      onMouseDown={e => e.preventDefault()}
      onClick={onSave}
      disabled={saving}
      whileTap={{ scale: 0.92 }}
      layout
      title={state === 'clean' ? 'All changes saved' : 'Save changes'}
      aria-label={state === 'saved' || state === 'clean' ? 'Saved' : 'Save changes'}
      className={`relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full text-xs font-black shadow-sm transition-colors max-sm:w-10 sm:px-4 ${
        state === 'saved' ? 'bg-emerald-500 text-white'
          : state === 'clean' ? 'border border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-[#0B0B0B]'
          : 'bg-[#111827] text-white hover:bg-black dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]'}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'saving' ? (
          <motion.span key="saving" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="inline-flex items-center gap-1.5">
            <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" /><span className="max-sm:hidden">Saving</span>
          </motion.span>
        ) : state === 'saved' || state === 'clean' ? (
          <motion.span key="saved" initial={{ opacity: 0, scale: 0.4, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }} className="inline-flex items-center gap-1.5">
            <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" strokeWidth={3.2} /><span className="max-sm:hidden">Saved</span>
          </motion.span>
        ) : (
          <motion.span key="save" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="inline-flex items-center gap-1.5">
            <Save className="h-4 w-4 sm:h-3.5 sm:w-3.5" /><span className="max-sm:hidden">Save</span>
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#e8c97a] ring-2 ring-[#111827] sm:static sm:ring-0" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/** The small "Saved ✓" that pops up after any save - switches, clicks and Save buttons alike. */
function SavedToast({ tick }: { tick: number }) {
  const [shown, setShown] = useState(0)
  const first = useRef(tick)
  // Rendered into <body> - an animated (transformed) parent would otherwise pin "fixed" to itself.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  useEffect(() => {
    if (tick === first.current) return
    setShown(tick)
    const t = setTimeout(() => setShown(0), 1500)
    return () => clearTimeout(t)
  }, [tick])
  if (!host) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[70] flex justify-center sm:bottom-6 sm:justify-end sm:pr-6">
      <AnimatePresence>
        {shown > 0 && (
          <motion.div key={shown} role="status" aria-live="polite"
            initial={{ opacity: 0, y: 18, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 30 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#111827] py-2 pl-2 pr-4 text-[13px] font-black text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,.55)] ring-1 ring-[#C9A24D]/40 dark:bg-white dark:text-[#111827]">
            <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18, delay: 0.05 }}
              className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
            </motion.span>
            Saved
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    host,
  )
}
