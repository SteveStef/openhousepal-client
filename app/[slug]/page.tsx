'use client'

import { glideRowByCard } from '@/lib/rowScroll'
import ListingFeatureCard from '@/components/agent-hub/ListingFeatureCard'
import BlogCoverArt from '@/components/BlogCoverArt'
import { HubLuxeDecor, HubLuxeIntro, HubLuxeStyles, HubSplitHeader, HubAgentPhoto, isHubPhotoSet, LUXE_BLOG_CARD, LUXE_HOME_CARD, LUXE_VIDEO_CARD, LuxeBlogCardBody, LuxeHomeCardBody, LuxeVideoCardBody, hubLuxeMetalClass } from '@/components/agent-hub/HubLuxeTheme'
import { HUB_CLASSIC_DEFAULT_ACCENT, HubClassicStyles, hubAccentOf, hubAccentStyle, hubClassicClass } from '@/components/agent-hub/HubClassicTheme'
import { pinnedFirst } from '@/lib/hubPins'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement } from 'react'
import api, { API_BASE_URL } from '@/lib/api-service'
import { PublicFormSummary, PublicBlogSummary } from '@/types'
import RecentSalesCarousel from '@/components/agent-hub/RecentSalesCarousel'
import ListingHeroCarousel from '@/components/agent-hub/ListingHeroCarousel'
import OpenHouseChip from '@/components/OpenHouseChip'
import type { MlsOpenHouse } from '@/lib/mlsOpenHouses'
import HubItemCarousel from '@/components/agent-hub/HubItemCarousel'
import SignedInToast from '@/components/SignedInToast'
import {
  Calendar,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Facebook,
  Globe,
  Home,
  IdCard,
  Instagram,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Play,
  Star,
  TrendingUp,
  Music2,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import { publicWebUrl } from '@/lib/webUrl'
import { LeaveReviewButton, orderReviews, ProfileRatingChip, ProfileReviewButton, ReviewsBigCarousel, ReviewsDeskCard, ReviewsSummary, ReviewsTwoUp, useHubReviews } from '@/components/agent-hub/HubReviews'

// 'reviews' is shown when the agent switched reviews on (Settings -> Reviews / Layout) and has some.
const defaultVisibleSectionIds = ['listings', 'sales', 'videos', 'tours', 'blogs', 'reviews']
const defaultLayoutSections = defaultVisibleSectionIds.map(id => ({ id, visible: true }))
// Until the agent drags the sections into their own order (the editor saves layoutCustomized the
// first time they do), My Listings leads whenever it's shown - a home for sale is the most
// current thing on the page.
const listingsFirst = <T extends { id: string }>(sections: T[]) => {
  const i = sections.findIndex(s => s.id === 'listings')
  return i <= 0 ? sections : [sections[i], ...sections.slice(0, i), ...sections.slice(i + 1)]
}
const normalizeLayoutSections = (sections: unknown) => {
  if (!Array.isArray(sections)) return defaultLayoutSections
  const normalized = sections
    .filter((section): section is { id: string; visible?: boolean } => Boolean(section) && typeof section.id === 'string' && defaultVisibleSectionIds.includes(section.id))
    .map(section => ({ id: section.id, visible: section.visible !== false }))
  const seen = new Set(normalized.map(section => section.id))
  return [
    ...normalized,
    ...defaultLayoutSections.filter(section => !seen.has(section.id)),
  ]
}
const defaultProfile = {
  name: '',
  title: '',
  brokerage: '',
  market: '',
  licenseNumber: '',
  about: '',
}
const defaultContact = { call: '', text: '', email: '' }

const socialIconMap: Record<string, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: Music2,
  website: Globe,
}

const getSocialBrandClass = (id: string) => {
  const classes: Record<string, string> = {
    instagram: 'text-[#E4405F]',
    facebook: 'text-[#1877F2]',
    youtube: 'text-[#FF0000]',
    tiktok: 'text-[#111827] dark:text-white',
    website: 'text-[#C9A24D]',
  }

  return classes[id] || 'text-[#111827]'
}

type AgentHubEvent = { type: 'visit' | 'click' | 'form' | 'qr'; label?: string; timestamp: string }
type SavedSocialLink = { id: string; label: string; url: string; enabled: boolean }
type HubItem = { id: string; title: string; description?: string; image?: string; link?: string; pinned?: boolean }
type AgentSale = { id: string; address: string; city: string; state: string; zipcode?: string; price?: number; status?: string; image?: string; photos?: string[]; sold_date?: string; visible?: boolean; beds?: number; baths?: number; sqft?: number; source?: string; listingLinkUrl?: string | null; open_houses?: MlsOpenHouse[] }

const getYoutubeThumbnail = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return match ? `https://i.ytimg.com/vi/${match[1]}/hq720.jpg` : ''
}

const formatSaleStatus = (status?: string) => {
  const clean = String(status || 'Sold').replace(/-BRIGHT/gi, '').replace(/_/g, ' ').trim()
  const lower = clean.toLowerCase()
  if (lower.includes('under contract')) return 'Under Contract'
  if (lower.includes('active')) return 'Active'
  if (lower.includes('pending')) return 'Pending'
  if (lower.includes('closed') || lower.includes('sold')) return 'Sold'
  if (lower.includes('off market') || lower.includes('off-market')) return 'Off Market'
  if (lower.includes('coming soon')) return 'Coming Soon'
  return clean || 'Sold'
}

const getSaleStatusClass = (status?: string) => {
  const clean = formatSaleStatus(status).toLowerCase()
  if (clean === 'active') return 'bg-emerald-100 text-emerald-700'
  if (clean === 'coming soon') return 'bg-[#111827] text-white'
  if (clean === 'pending' || clean === 'under contract') return 'bg-yellow-400 text-[#111827]'
  if (clean === 'off market') return 'bg-gray-500 text-white'
  if (clean === 'sold') return 'bg-rose-500 text-white'
  return 'bg-[#8b7355] text-white'
}

const getSaleLocation = (sale: AgentSale) => [sale.city, sale.state].filter(Boolean).join(', ') || getStreetOnly(sale.address)

const isEligibleSaleStatus = (status?: string) => formatSaleStatus(status).toLowerCase() === 'sold'

const normalizeAgentSale = (sale: AgentSale): AgentSale => ({
  ...sale,
  visible: sale.visible ?? true,
})

const getEligibleSales = (sales: AgentSale[]) => sales.filter(sale => isEligibleSaleStatus(sale.status) && (sale.price || 0) >= 100000).map(normalizeAgentSale)

// "My Listings" mirrors Recent Sales but for everything currently on the market rather than sold.
const isEligibleListingStatus = (status?: string) => ['active', 'pending', 'under contract', 'coming soon'].includes(formatSaleStatus(status).toLowerCase())

const getEligibleListings = (listings: AgentSale[]) => listings.filter(listing => isEligibleListingStatus(listing.status)).map(normalizeAgentSale)

const sectionHasContent = (id: string, recentSales: AgentSale[], videoLinks: HubItem[], houseTourLinks: HubItem[], houseTourUrl: string, blogCards: HubItem[], myListings: AgentSale[] = []) => {
  if (id === 'sales') return getEligibleSales(recentSales).some(sale => sale.visible)
  if (id === 'listings') return getEligibleListings(myListings).some(listing => listing.visible)
  if (id === 'videos') return videoLinks.some(item => item.link?.trim())
  if (id === 'tours') return Boolean(houseTourUrl.trim()) || houseTourLinks.some(item => item.link?.trim())
  if (id === 'blogs') return blogCards.some(item => item.link?.trim() || item.title.trim())
  return true
}

const getStreetOnly = (address?: string) => {
  const firstLine = String(address || '').split(',')[0]?.trim() || 'Address unavailable'
  return firstLine.replace(/\s+(#|apt\.?|unit|suite|ste\.?|fl\.?|floor)\s*[\w-]+.*$/i, '').trim() || firstLine
}

const getSalesSummary = (sales: AgentSale[]) => {
  const eligibleSales = getEligibleSales(sales)
  const totalSold = eligibleSales.length
  const totalVolume = eligibleSales.reduce((sum, sale) => sum + (sale.price || 0), 0)
  const avgPrice = totalSold ? Math.round(totalVolume / totalSold) : 0
  return { totalSold, totalVolume, avgPrice }
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

// Anonymous per-browser id so the visits/interactions stats count unique visitors, not raw
// page-loads/clicks - persisted in localStorage so it's stable across a visitor's return trips.
function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const key = 'ohp_visitor_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return ''
  }
}

// Records that this (anonymous, deduped-by-visitor_id) visitor clicked something on the public
// page - module-level (not a hook) since it's called from several standalone components below
// that don't have the agent slug in scope, so it's read straight off the URL instead.
const recordAgentHubEvent = (_event: Omit<AgentHubEvent, 'timestamp'>) => {
  if (typeof window === 'undefined') return
  const slug = window.location.pathname.split('/').filter(Boolean)[0]
  if (!slug) return
  api.public.trackAgentHubEvent(slug, 'interaction', getOrCreateVisitorId())
}

export default function PublicAgentHubPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const agentSlug = params.slug
  const forceLightMode = searchParams.get('idx_light') === '1'
  const idxReturn = searchParams.get('idx_return')
  const agentHubBasePath = `/${agentSlug}`
  const idxLightSuffix = forceLightMode ? `?idx_light=1${idxReturn ? `&idx_return=${encodeURIComponent(idxReturn)}` : ''}` : ''
  const salesPath = `${agentHubBasePath}/sales`
  // Current listings lead the Sales page now (the separate Listings page redirects there).
  const listingsPath = `${agentHubBasePath}/sales`
  const blogsPath = `${agentHubBasePath}/blogs`
  const [visibleSectionIds, setVisibleSectionIds] = useState(defaultVisibleSectionIds)
  const [layoutSections, setLayoutSections] = useState(defaultLayoutSections)
  const [profile, setProfile] = useState(defaultProfile)
  const [contact, setContact] = useState(defaultContact)
  const [socialLinks, setSocialLinks] = useState<SavedSocialLink[]>([])
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [profilePhotoPosition, setProfilePhotoPosition] = useState({ x: 50, y: 50 })
  const [recentSales, setRecentSales] = useState<AgentSale[]>([])
  const [myListings, setMyListings] = useState<AgentSale[]>([])
  const [showSalesStats, setShowSalesStats] = useState(true)
  const [salesCarousel, setSalesCarousel] = useState(true)
  const [listingsCarousel, setListingsCarousel] = useState(true)
  const [videosCarousel, setVideosCarousel] = useState(false)
  const [toursCarousel, setToursCarousel] = useState(false)
  const [blogsCarousel, setBlogsCarousel] = useState(false)
  const [salesAutoScroll, setSalesAutoScroll] = useState(true)
  const [listingsAutoScroll, setListingsAutoScroll] = useState(true)
  const [videosAutoScroll, setVideosAutoScroll] = useState(true)
  const [toursAutoScroll, setToursAutoScroll] = useState(true)
  const [blogsAutoScroll, setBlogsAutoScroll] = useState(true)
  const [reviewsCarousel, setReviewsCarousel] = useState(true)
  const [reviewsAutoScroll, setReviewsAutoScroll] = useState(true)
  // Phones: the star-rating chip and the "Review" button on the profile card (Agent Hub -> Profile).
  const [reviewsOnProfile, setReviewsOnProfile] = useState(true)
  const [reviewsProfileButton, setReviewsProfileButton] = useState(true)
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [hubTheme, setHubTheme] = useState<'classic' | 'luxe'>('classic')
  const [mobileHeader, setMobileHeader] = useState<'centered' | 'split'>('centered')
  // Luxe's entry plays once per page load, then the sections cascade in.
  // The setup flow's preview frame (?preview=1) skips the entry so each change shows at once.
  const [luxeIntro, setLuxeIntro] = useState(() => searchParams.get('preview') !== '1')
  const [hubLuxeMetal, setHubLuxeMetal] = useState<string>('gold')
  const [hubAccent, setHubAccent] = useState<string>(HUB_CLASSIC_DEFAULT_ACCENT)
  const luxe = hubTheme === 'luxe'
  // Recent Sales moving on its own (the desktop glide, the phone cuts) is a Luxe feature - on by
  // default there (the agent can switch it off in the editor), never on Classic.
  const salesMotion = luxe && salesAutoScroll
  const [videoLinks, setVideoLinks] = useState<HubItem[]>([])
  const [videoChannelUrl, setVideoChannelUrl] = useState('')
  const [houseTourLinks, setHouseTourLinks] = useState<HubItem[]>([])
  const [houseTourUrl, setHouseTourUrl] = useState('')
  const [blogCards, setBlogCards] = useState<HubItem[]>([])
  const [publicForms, setPublicForms] = useState<PublicFormSummary[]>([])
  const [publicBlogs, setPublicBlogs] = useState<PublicBlogSummary[]>([])
  // Which shelf currently "owns" auto-scroll motion, when more than one section has it enabled -
  // see autoScrollSequence below for how sections take turns, in layout order. A ref (not state)
  // since nothing renders off this value directly - only the scheduler below reads/writes it.
  const activeAutoScrollIdRef = useRef<string | null>(null)
  const [autoScrollStep, setAutoScrollStep] = useState<{ id: string; nonce: number } | null>(null)
  const autoScrollStartedRef = useRef(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [hubStatus, setHubStatus] = useState<'loading' | 'found' | 'not-found'>('loading')

  useEffect(() => {
    if (forceLightMode) setVisitorDarkMode(false)
  }, [forceLightMode])

  // The hub follows ITS OWN light/dark choice, never the OpenHousePal app's: the app's dark mode puts
  // "dark" on <html> for this whole browser (same site), which turned a light hub dark for anyone who
  // uses the app in dark mode - and in the setup preview frame. Put the page's own choice on <html>
  // while the hub is open, and hand the app's back when leaving.
  // (The app's theme provider sets <html> after this page's effects run, and again whenever it
  // re-applies the theme - so keep watching and put the hub's choice back each time.)
  useEffect(() => {
    const root = document.documentElement
    const had = root.classList.contains('dark')
    const prevScheme = root.style.colorScheme
    const dark = visitorDarkMode && !forceLightMode
    const apply = () => {
      if (root.classList.contains('dark') !== dark) root.classList.toggle('dark', dark)
      if (root.style.colorScheme !== (dark ? 'dark' : 'light')) root.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    const watch = new MutationObserver(apply)
    watch.observe(root, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => { watch.disconnect(); root.classList.toggle('dark', had); root.style.colorScheme = prevScheme }
  }, [visitorDarkMode, forceLightMode])

  // The setup flow's preview frame (?preview=1): the look being picked arrives here the moment
  // it's tapped (same-origin parent only), so the phone changes at once instead of after a save
  // and a reload.
  useEffect(() => {
    if (searchParams.get('preview') !== '1' || window.parent === window) return
    const onLook = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.type !== 'ohp-hub-look') return
      const l = e.data.look || {}
      if (typeof l.visitorDarkMode === 'boolean') setVisitorDarkMode(forceLightMode ? false : l.visitorDarkMode)
      if (l.hubTheme === 'luxe' || l.hubTheme === 'classic') setHubTheme(l.hubTheme)
      if (typeof l.hubLuxeMetal === 'string') setHubLuxeMetal(l.hubLuxeMetal)
      if (typeof l.hubAccent === 'string') setHubAccent(hubAccentOf(l.hubAccent))
      if (l.mobileHeader === 'split' || l.mobileHeader === 'centered') setMobileHeader(l.mobileHeader)
    }
    window.addEventListener('message', onLook)
    window.parent.postMessage({ type: 'ohp-hub-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onLook)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyHubConfig = (parsed: any) => {
    if (parsed.profile) setProfile({ ...defaultProfile, ...parsed.profile })
    if (parsed.contact) setContact({ ...defaultContact, ...parsed.contact })
    if (isHubPhotoSet(parsed.profilePhotoUrl)) setProfilePhotoUrl(parsed.profilePhotoUrl)
    if (parsed.profilePhotoPosition?.x !== undefined) setProfilePhotoPosition({ x: Number(parsed.profilePhotoPosition.x) || 50, y: Number(parsed.profilePhotoPosition.y) || 50 })
    if (Array.isArray(parsed.socialLinks)) setSocialLinks(parsed.socialLinks)
    if (Array.isArray(parsed.recentSales)) setRecentSales(getEligibleSales(parsed.recentSales))
    if (Array.isArray(parsed.myListings)) setMyListings(getEligibleListings(parsed.myListings))
    if (typeof parsed.showSalesStats === 'boolean') setShowSalesStats(parsed.showSalesStats)
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
    if (typeof parsed.visitorDarkMode === 'boolean') setVisitorDarkMode(forceLightMode ? false : parsed.visitorDarkMode)
    setHubTheme(parsed.hubTheme === 'luxe' ? 'luxe' : 'classic')
    setHubLuxeMetal(typeof parsed.hubLuxeMetal === 'string' ? parsed.hubLuxeMetal : 'gold')
    setHubAccent(hubAccentOf(parsed.hubAccent))
    setMobileHeader(parsed.mobileHeader === 'split' ? 'split' : 'centered')
    if (Array.isArray(parsed.videoLinks)) setVideoLinks(pinnedFirst<HubItem>(parsed.videoLinks))
    if (typeof parsed.videoChannelUrl === 'string') setVideoChannelUrl(parsed.videoChannelUrl)
    if (Array.isArray(parsed.houseTourLinks)) setHouseTourLinks(pinnedFirst<HubItem>(parsed.houseTourLinks))
    if (typeof parsed.houseTourUrl === 'string') setHouseTourUrl(parsed.houseTourUrl)
    if (Array.isArray(parsed.blogCards)) setBlogCards(parsed.blogCards)
    if (Array.isArray(parsed.layoutSections)) {
      const saved = normalizeLayoutSections(parsed.layoutSections)
      const normalized = parsed.layoutCustomized === true ? saved : listingsFirst(saved)
      setLayoutSections(normalized)
      setVisibleSectionIds(normalized.filter((section: { visible: boolean }) => section.visible).map((section: { id: string }) => section.id))
    }
  }

  useEffect(() => {
    if (!agentSlug) return
    let cancelled = false
    api.public.checkAgentHub(agentSlug).then(response => {
      if (cancelled) return
      setHubStatus(response.success ? 'found' : 'not-found')
      // A hit via an old (rebranded-away-from) slug still resolves - see the backend's
      // previous_slugs fallback - but the URL bar should catch up to the canonical one so any
      // further in-page navigation (forms, blogs, sub-pages) hits the current slug too, not
      // just this one already-loaded page.
      if (response.success && response.data?.slug && response.data.slug !== agentSlug) {
        router.replace(`/${response.data.slug}`)
        return
      }
      // The database config (set via the editor's Save button, hitting PUT /agent-hub/me/config)
      // is the single source of truth for every real visitor, regardless of whose browser they're
      // on. If the agent hasn't published anything yet, the page just renders with the defaults
      // (empty profile, no sections) rather than fake demo content.
      if (response.success && response.data?.config && Object.keys(response.data.config).length > 0) {
        applyHubConfig(response.data.config)
      }
    })
    return () => { cancelled = true }
  }, [agentSlug])

  useEffect(() => {
    if (!agentSlug) return
    api.public.getPublicForms(agentSlug).then(response => {
      if (response.success && response.data) setPublicForms(response.data)
    })
  }, [agentSlug])

  // Real published blogs the agent has opted into showing on their Agent Hub (Studio -> Blogs ->
  // "Show on Agent Hub"/"Featured" toggles) - takes over the "My Blogs" shelf from the manually
  // curated blogCards list whenever at least one exists, same merge logic the site editor's
  // preview already uses (see effectiveBlogCards in studio/site/page.tsx).
  useEffect(() => {
    if (!agentSlug) return
    api.public.getPublicBlogs(agentSlug).then(response => {
      if (response.success && response.data) setPublicBlogs(response.data)
    })
  }, [agentSlug])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobileViewport(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!agentSlug) return
    // The backend decides whether this actually gets recorded - only fully anonymous
    // visits count (see get_current_user_optional in track_agent_hub_event).
    // ?preview=1 = the setup flow's live preview frame - not a visitor.
    if (new URLSearchParams(window.location.search).get('preview') === '1') return
    const isFromQrCode = new URLSearchParams(window.location.search).get('src') === 'qr'
    api.public.trackAgentHubEvent(agentSlug, isFromQrCode ? 'qr_scan' : 'visit', getOrCreateVisitorId())
  }, [agentSlug])

  const buyingForm = publicForms.find(form => form.formType === 'buying')
  const sellingForm = publicForms.find(form => form.formType === 'selling')
  const homeValueForm = publicForms.find(form => form.formType === 'home_value')
  const showingForm = publicForms.find(form => form.formType === 'showing')
  const visiblePublicBlogs = [...publicBlogs.filter(b => b.agentHubVisible)].sort((a, b) => (b.agentHubFeatured ? 1 : 0) - (a.agentHubFeatured ? 1 : 0))
  const effectiveBlogCards: HubItem[] = visiblePublicBlogs.length > 0
    ? visiblePublicBlogs.map(b => ({ id: b.slug, title: b.title, description: b.category || 'Blog', image: b.coverImageUrl || '', link: `${blogsPath}/${b.slug}` }))
    : blogCards
  const isVisible = (id: string) => visibleSectionIds.includes(id)
  // Reviews: on whenever the agent shows reviews on the hub and has at least one. On a computer
  // they live under About Me in the side column instead (ReviewsSideCard), so the main column skips them.
  const hubReviews = useHubReviews(agentSlug)
  const reviewsList = hubReviews ? orderReviews(hubReviews.reviews) : []
  const reviewsOn = Boolean(hubReviews?.show_on_hub && hubReviews.summary.count > 0 && reviewsList.length > 0)
  const reviewHref = `/${agentSlug}/review`
  // Profile card extras (phones only - computers have the reviews card right under the buttons).
  const profileRating = reviewsOn && reviewsOnProfile && hubReviews ? <ProfileRatingChip data={hubReviews} /> : null
  const profileReviewBtn = reviewsOn && reviewsProfileButton ? <ProfileReviewButton href={reviewHref} /> : null
  // Side-by-side header (phones AND computers): ONE chip under the photo - rating, count, then the
  // pencil (or just the pencil button).
  const splitRatingChip = reviewsOn && hubReviews && reviewsOnProfile
    ? <ProfileRatingChip data={hubReviews} reviewHref={reviewsProfileButton ? reviewHref : undefined} />
    : profileReviewBtn
  const visibleOrderedSections = layoutSections.filter(section => section.id === 'reviews'
    ? reviewsOn
    : section.visible && isVisible(section.id) && sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, effectiveBlogCards, myListings))

  // Sections eligible to take a turn auto-scrolling, in the same top-to-bottom order they're
  // actually laid out on the page. Carousel is mobile-only; desktop still renders shelves and
  // should auto-scroll those shelves when the auto-scroll toggle is on.
  const autoScrollSequence = visibleOrderedSections
    .map(section => section.id)
    .filter(id => {
      if (id === 'sales') return salesMotion && !(salesCarousel && isMobileViewport) && getEligibleSales(recentSales).filter(s => s.visible).length >= 2
      if (id === 'listings') return listingsAutoScroll && !(listingsCarousel && isMobileViewport) && getEligibleListings(myListings).filter(l => l.visible).length >= 2
      if (id === 'videos') return videosAutoScroll && !(videosCarousel && isMobileViewport) && videoLinks.filter(item => item.link?.trim()).length >= 2
      if (id === 'tours') return toursAutoScroll && !(toursCarousel && isMobileViewport) && houseTourLinks.filter(item => item.link?.trim()).length >= 2
      if (id === 'blogs') return blogsAutoScroll && !(blogsCarousel && isMobileViewport) && effectiveBlogCards.filter(item => item.title.trim()).length >= 2
      if (id === 'reviews') return reviewsAutoScroll && isMobileViewport && !reviewsCarousel && reviewsList.length >= 2
      return false
    })

  // One shelf alone moves every 4.5s; with more shelves taking turns, each waits its turn so no
  // single shelf moves more often than about every 6-10s (the glide itself takes ~1.1s).
  const autoScrollDelayMs = (count: number) => (count <= 1 ? 4500 : count === 2 ? 3000 : 2200)

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
      timer = setTimeout(tick, autoScrollDelayMs(seq.length))
    }
    timer = setTimeout(tick, 3000)
    return () => { cancelled = true; clearTimeout(timer) }
    // Deliberately keyed off the sequence's contents, not its array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScrollSequence.join('|')])

  // Only real web addresses become icons (a typo like "aw" would be a dead button), with https:// added.
  const enabledSocialLinks = socialLinks
    .filter(link => link.enabled && publicWebUrl(link.url))
    .map(link => ({ ...link, url: publicWebUrl(link.url) as string }))
  const enabledContacts: { key: string; href: string; icon: LucideIcon; label: string }[] = [
    contact.call.trim() && { key: 'call', href: `tel:${contact.call}`, icon: Phone, label: 'Call' },
    contact.text.trim() && { key: 'text', href: `sms:${contact.text}`, icon: MessageSquare, label: 'Text' },
    contact.email.trim() && { key: 'email', href: `mailto:${contact.email}`, icon: Mail, label: 'Email' },
  ].filter(Boolean) as { key: string; href: string; icon: LucideIcon; label: string }[]
  const totalIconCount = enabledContacts.length + enabledSocialLinks.length
  // Desktop sizes shrink one notch earlier than mobile (the sidebar column is a fixed 360px).
  const iconBoxSize = totalIconCount <= 4 ? 'h-10 w-10 lg:h-12 lg:w-12' : totalIconCount <= 6 ? 'h-11 w-11 lg:h-10 lg:w-10' : totalIconCount <= 8 ? 'h-10 w-10 lg:h-9 lg:w-9' : 'h-9 w-9 lg:h-8 lg:w-8'
  const iconGlyphSize = totalIconCount <= 4 ? 'h-4 w-4 lg:h-5 lg:w-5' : totalIconCount <= 6 ? 'h-[18px] w-[18px] lg:h-4 lg:w-4' : totalIconCount <= 8 ? 'h-4 w-4 lg:h-[15px] lg:w-[15px]' : 'h-[14px] w-[14px] lg:h-[13px] lg:w-[13px]'
  // Always ONE row, phones included: each icon is the size above, or smaller when that's what it
  // takes for every icon to fit across (100cqw = the row's own width - the row is a size container).
  const iconGapPx = totalIconCount <= 4 ? 12 : totalIconCount <= 6 ? 10 : totalIconCount <= 8 ? 8 : 6
  const iconMaxPx = totalIconCount <= 4 ? 44 : totalIconCount <= 6 ? 44 : totalIconCount <= 8 ? 40 : 36
  const hasIconDivider = enabledContacts.length > 0 && enabledSocialLinks.length > 0
  const iconRowGapsPx = iconGapPx * Math.max(0, totalIconCount - 1) + (hasIconDivider ? iconGapPx + 9 : 0)
  const iconFit = `min(${iconMaxPx}px, calc((100cqw - ${iconRowGapsPx}px) / ${Math.max(1, totalIconCount)}))`
  const iconBoxStyle = { width: iconFit, height: iconFit }
  const saleSummary = getSalesSummary(recentSales)
  // Hidden until there's at least one sale - a row of zeros makes a new agent look inactive.
  const showStats = showSalesStats && saleSummary.totalSold > 0
  const renderStatsSection = () => showStats && (
    <div className="mt-3 text-left">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Sold', saleSummary.totalSold.toString()],
          ['Volume', formatCompactMoney(saleSummary.totalVolume)],
          ['Avg', formatCompactMoney(saleSummary.avgPrice)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl border border-gray-200 bg-white px-2 py-2.5 text-center shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f]">
            <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">{label}</p>
            <p className="mt-1 truncate text-sm font-black text-[#111827] dark:text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSection = (id: string) => {
    if (id === 'sales') {
      const eligibleSales = getEligibleSales(recentSales).filter(sale => sale.visible)
      if (salesCarousel && isMobileViewport && eligibleSales.length !== 1) {
        return (
          <section key={id} className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Recent Sales</h2>
              <Link href={salesPath} onClick={() => recordAgentHubEvent({ type: 'click', label: 'My Recent Sales: View All' })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">View All &rsaquo;</Link>
            </div>
            <RecentSalesCarousel sales={eligibleSales} linkHref={salesPath} autoScroll={salesMotion} luxe={luxe} />
          </section>
        )
      }
      const soloSale = eligibleSales.length === 1 ? eligibleSales[0] : null
      return (
        <div key={id}>
          <HubShelf title="My Recent Sales" action="View All" actionHref={salesPath} sameTab itemCount={eligibleSales.length} autoScroll={salesMotion} sweep={luxe} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}
            feature={soloSale ? <ListingFeatureCard compact luxe={luxe} listing={soloSale} href={salesPath} onClick={() => recordAgentHubEvent({ type: 'click', label: `Recent Sale: ${soloSale.address}` })} /> : undefined}>
            {eligibleSales.map((sale) => luxe ? (
              <Link key={sale.id} href={salesPath} onClick={() => recordAgentHubEvent({ type: 'click', label: `Recent Sale: ${sale.address}` })} className={LUXE_HOME_CARD}>
                <LuxeHomeCardBody image={sale.image} price={sale.price ? `$${sale.price.toLocaleString()}` : 'Price'} location={getSaleLocation(sale)} status={formatSaleStatus(sale.status)} statusClass={getSaleStatusClass(sale.status)} />
              </Link>
            ) : (
              <Link key={sale.id} href={salesPath} onClick={() => recordAgentHubEvent({ type: 'click', label: `Recent Sale: ${sale.address}` })} className="relative h-[118px] w-[172px] shrink-0 snap-start overflow-hidden rounded-[14px] bg-cover bg-center lg:h-[148px]" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                <div className="absolute bottom-2 left-2 right-2 text-white"><p className="text-xl font-black leading-none">{sale.price ? `$${sale.price.toLocaleString()}` : 'Price'}</p><p className="truncate text-xs font-bold">{getSaleLocation(sale)}</p></div>
              </Link>
            ))}
          </HubShelf>
        </div>
      )
    }

    if (id === 'listings') {
      const eligibleListings = getEligibleListings(myListings).filter(listing => listing.visible)
      if (listingsCarousel && isMobileViewport && eligibleListings.length !== 1) {
        return (
          <section key={id} className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Listings</h2>
              <Link href={listingsPath} onClick={() => recordAgentHubEvent({ type: 'click', label: 'My Listings: View All' })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">View All &rsaquo;</Link>
            </div>
            <ListingHeroCarousel listings={eligibleListings} linkHref={listingsPath} autoScroll={listingsAutoScroll} luxe={luxe} />
          </section>
        )
      }
      const soloListing = eligibleListings.length === 1 ? eligibleListings[0] : null
      return (
        <div key={id}>
          <HubShelf title="My Listings" action="View All" actionHref={listingsPath} sameTab itemCount={eligibleListings.length} autoScroll={listingsAutoScroll} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}
            feature={soloListing ? <ListingFeatureCard compact luxe={luxe} listing={soloListing} href={soloListing.listingLinkUrl || listingsPath} showingHref={showingForm ? `${agentHubBasePath}/${showingForm.slug}${idxLightSuffix}` : undefined} onClick={() => recordAgentHubEvent({ type: 'click', label: `Listing: ${soloListing.address}` })} /> : undefined}>
            {eligibleListings.map((listing) => luxe ? (
              <Link key={listing.id} href={listing.listingLinkUrl || listingsPath} onClick={() => recordAgentHubEvent({ type: 'click', label: `Listing: ${listing.address}` })} className={LUXE_HOME_CARD}>
                <LuxeHomeCardBody image={listing.image} price={listing.price ? `$${listing.price.toLocaleString()}` : 'Price'} location={getSaleLocation(listing)} status={formatSaleStatus(listing.status)} statusClass={getSaleStatusClass(listing.status)} cta="View home" badge={<OpenHouseChip openHouses={listing.open_houses} variant="luxe" compact />} />
              </Link>
            ) : (
              // Each card links to ITS OWN "smart QR" destination when one resolved (the agent's
              // Listing Spotlight for this exact property, else the generic one-page property
              // view with a tour-request form - see resolve_listing_link on the backend) -
              // falling back to the general Listings page only when neither exists.
              <Link key={listing.id} href={listing.listingLinkUrl || listingsPath} onClick={() => recordAgentHubEvent({ type: 'click', label: `Listing: ${listing.address}` })} className="relative h-[118px] w-[172px] shrink-0 snap-start overflow-hidden rounded-[14px] bg-cover bg-center lg:h-[148px]" style={{ backgroundImage: `url(${listing.image || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(listing.status)}`}>{formatSaleStatus(listing.status)}</span>
                <div className="absolute bottom-2 left-2 right-2 text-white"><OpenHouseChip openHouses={listing.open_houses} compact className="mb-1" /><p className="text-xl font-black leading-none">{listing.price ? `$${listing.price.toLocaleString()}` : 'Price'}</p><p className="truncate text-xs font-bold">{getSaleLocation(listing)}</p></div>
              </Link>
            ))}
          </HubShelf>
        </div>
      )
    }

    if (id === 'videos') {
      const eligibleVideos = videoLinks.filter(item => item.link?.trim())
      if (videosCarousel && isMobileViewport) {
        return (
          <section key={id} className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Videos</h2>
              {videoChannelUrl ? <a href={videoChannelUrl.startsWith('http') ? videoChannelUrl : `https://${videoChannelUrl}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: 'My Videos: YouTube' })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">YouTube &rsaquo;</a> : <span className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">YouTube &rsaquo;</span>}
            </div>
            <HubItemCarousel
              items={eligibleVideos}
              showDots={false}
              autoScroll={videosAutoScroll}
              renderSlide={(item) => (
                <a href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `Video: ${item.title || 'YouTube Video'}` })} className="relative block h-full w-full overflow-hidden rounded-[18px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/30 text-white shadow-sm "><Play className="ml-1 h-6 w-6 fill-white/80 text-white/90" /></span>
                </a>
              )}
            />
          </section>
        )
      }
      return (
        <HubShelf key={id} title="My Videos" action="YouTube" actionHref={videoChannelUrl} itemCount={eligibleVideos.length} autoScroll={videosAutoScroll} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
          {eligibleVideos.map((item) => luxe ? (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `Video: ${item.title || 'YouTube Video'}` })} className={LUXE_VIDEO_CARD}>
              <LuxeVideoCardBody thumb={getYoutubeThumbnail(item.link || '')} title={item.title || 'YouTube Video'} kicker="Watch" />
            </a>
          ) : (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `Video: ${item.title || 'YouTube Video'}` })} className="w-[176px] shrink-0 snap-start lg:w-[210px]">
              <div className="relative aspect-video overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm "><Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" /></span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'YouTube Video'}</p>
            </a>
          ))}
        </HubShelf>
      )
    }

    if (id === 'tours') {
      const tourActionHref = houseTourUrl || houseTourLinks.find(item => item.link?.trim())?.link || ''
      const eligibleTours = houseTourLinks.filter(item => item.link?.trim())
      if (toursCarousel && isMobileViewport) {
        return (
          <section key={id} className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">House Tours</h2>
              <a href={tourActionHref ? (tourActionHref.startsWith('http') ? tourActionHref : `https://${tourActionHref}`) : '#'} target={tourActionHref ? '_blank' : undefined} rel={tourActionHref ? 'noreferrer' : undefined} onClick={() => recordAgentHubEvent({ type: 'click', label: 'House Tours: Watch' })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">Watch &rsaquo;</a>
            </div>
            <HubItemCarousel
              items={eligibleTours}
              showDots={false}
              autoScroll={toursAutoScroll}
              renderSlide={(item) => (
                <a href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `House Tour: ${item.title || 'House Tour'}` })} className="relative block h-full w-full overflow-hidden rounded-[18px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/30 text-white shadow-sm "><Play className="ml-1 h-6 w-6 fill-white/80 text-white/90" /></span>
                </a>
              )}
            />
          </section>
        )
      }
      return (
        <HubShelf key={id} title="House Tours" action="Watch" actionHref={tourActionHref} itemCount={eligibleTours.length} autoScroll={toursAutoScroll} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
          {eligibleTours.map((item) => luxe ? (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `House Tour: ${item.title || 'House Tour'}` })} className={LUXE_VIDEO_CARD}>
              <LuxeVideoCardBody thumb={getYoutubeThumbnail(item.link || '')} title={item.title || 'House Tour'} kicker="Tour" />
            </a>
          ) : (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `House Tour: ${item.title || 'House Tour'}` })} className="w-[188px] shrink-0 snap-start lg:w-[220px]">
              <div className="relative aspect-video overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm "><Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" /></span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'House Tour'}</p>
            </a>
          ))}
        </HubShelf>
      )
    }

    if (id === 'blogs') {
      const eligibleBlogs = effectiveBlogCards.filter(item => item.title.trim())
      // Real blog cards link internally (/{slug}/blogs/{blogSlug}) - manually-added cards link
      // externally. Treating an internal link like an external one (prefixing https:// onto it)
      // turned "/sarah-johnson/blogs/my-post" into the nonsense domain "https://sarah-johnson/...".
      const resolveBlogHref = (link?: string) => {
        if (!link) return { href: '#', isInternal: false }
        if (link.startsWith('/')) return { href: link, isInternal: true }
        return { href: link.startsWith('http') ? link : `https://${link}`, isInternal: false }
      }
      if (blogsCarousel && isMobileViewport) {
        return (
          <section key={id} className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Blogs</h2>
              <Link href={blogsPath} onClick={() => recordAgentHubEvent({ type: 'click', label: 'My Blogs: Read All' })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">Read All &rsaquo;</Link>
            </div>
            <HubItemCarousel
              items={eligibleBlogs}
              height={260}
              dotsTone="dark"
              showDots={false}
              autoScroll={blogsAutoScroll}
              renderSlide={(item) => {
                const { href, isInternal } = resolveBlogHref(item.link)
                return (
                  <a href={href} target={item.link && !isInternal ? '_blank' : undefined} rel={item.link && !isInternal ? 'noreferrer' : undefined} onClick={() => item.link && recordAgentHubEvent({ type: 'click', label: `Blog: ${item.title}` })} className={`flex h-full w-full flex-col overflow-hidden rounded-[18px] bg-white dark:bg-[#151517] ${item.link ? '' : 'pointer-events-none'}`}>
                    {item.image ? <div className="flex-1 bg-cover bg-center dark:brightness-90" style={{ backgroundImage: `url(${item.image})` }} /> : <div className="relative flex-1"><BlogCoverArt category={item.description} title={item.title} /></div>}
                    <div className="bg-white p-4 pb-6 dark:bg-[#1A1A1C]">
                      <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-black leading-4 text-[#111827] dark:text-white">{item.title}</h3>
                    </div>
                  </a>
                )
              }}
            />
          </section>
        )
      }
      return (
        <HubShelf key={id} title="My Blogs" action="Read All" actionHref={blogsPath} sameTab itemCount={eligibleBlogs.length} autoScroll={blogsAutoScroll} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
          {eligibleBlogs.map((item) => {
            const { href, isInternal } = resolveBlogHref(item.link)
            if (luxe) return (
              <a key={item.id} href={href} target={item.link && !isInternal ? '_blank' : undefined} rel={item.link && !isInternal ? 'noreferrer' : undefined} onClick={() => item.link && recordAgentHubEvent({ type: 'click', label: `Blog: ${item.title}` })} className={`${LUXE_BLOG_CARD} ${item.link ? '' : 'pointer-events-none'}`}>
                <LuxeBlogCardBody image={item.image} category={item.description || 'Blog'} title={item.title} />
              </a>
            )
            return (
              <a key={item.id} href={href} target={item.link && !isInternal ? '_blank' : undefined} rel={item.link && !isInternal ? 'noreferrer' : undefined} onClick={() => item.link && recordAgentHubEvent({ type: 'click', label: `Blog: ${item.title}` })} className={`group/blog relative block h-[212px] w-[208px] shrink-0 snap-start overflow-hidden rounded-[18px] bg-[#111827] shadow-sm transition-shadow duration-500 hover:shadow-[0_24px_48px_-28px_rgba(17,24,39,.55)] lg:h-[228px] lg:w-[228px] ${item.link ? '' : 'pointer-events-none'}`}>
                {item.image ? <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.6s] ease-out group-hover/blog:scale-[1.07]" style={{ backgroundImage: `url(${item.image})` }} /> : <div className="absolute inset-0"><BlogCoverArt category={item.description} title={item.title} showWord={false} /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a0f] via-[#070a0f]/50 to-black/10" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#111827] shadow-sm">{item.description || 'Blog'}</span>
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <span className="block h-px w-8 bg-gradient-to-r from-[#e8c97a] to-transparent" />
                  <h3 className="mt-2 line-clamp-3 font-serif text-[16px] font-black leading-[1.18] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.4)]">{item.title}</h3>
                  <span className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-[#e8c97a] transition-transform duration-300 group-hover/blog:translate-x-1">Read the story <span aria-hidden>&rarr;</span></span>
                </div>
              </a>
            )
          })}
        </HubShelf>
      )
    }

    if (id === 'reviews' && hubReviews) {
      const header = (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">Reviews</h2>
          <LeaveReviewButton href={reviewHref} size="sm" />
        </div>
      )
      // Computers show reviews in the side column (under Schedule a Showing) - this is the phone / tablet spot.
      if (reviewsCarousel) {
        return (
          <section key={id} id="reviews" data-testid="hub-reviews-section" className="mt-4 scroll-mt-4 lg:hidden">
            {header}
            <ReviewsSummary data={hubReviews} className="-mt-1 mb-3" />
            <ReviewsBigCarousel reviews={reviewsList} luxe={luxe} autoScroll={reviewsAutoScroll} />
          </section>
        )
      }
      // "Two cards": exactly two whole cards across, a page at a time.
      return (
        <section key={id} id="reviews" data-testid="hub-reviews-section" className="mt-4 scroll-mt-4 lg:hidden">
          {header}
          <ReviewsSummary data={hubReviews} className="-mt-1 mb-3" />
          <ReviewsTwoUp reviews={reviewsList} luxe={luxe} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0} />
        </section>
      )
    }

    return null
  }

  if (hubStatus === 'not-found') {
    return <AgentHubNotFound />
  }

  if (hubStatus === 'loading') {
    return <div className="min-h-screen bg-[#f7f5f1] dark:bg-[#0B0B0B]" />
  }

  return (
    <div className={visitorDarkMode && !forceLightMode ? 'dark' : ''}>
    <main className={`agent-hub-public relative min-h-screen overflow-hidden bg-[#f7f5f1] text-[#101827] dark:bg-[#0B0B0B] dark:text-[#F3F4F6] ${luxe ? `hub-luxe ${hubLuxeMetalClass(hubLuxeMetal)} ${luxeIntro ? 'hub-lx-intro-on' : ''}` : hubClassicClass(hubTheme, hubAccent)}`} style={luxe ? undefined : hubAccentStyle(hubAccent)}>
      {luxe ? <><HubLuxeStyles /><HubLuxeDecor /></> : <HubClassicStyles />}
      {luxe && luxeIntro && <HubLuxeIntro name={profile.name} kicker={[profile.title, profile.brokerage].filter(Boolean).join(' · ')} photoUrl={profilePhotoUrl} photoPosition={profilePhotoPosition} onDone={() => setLuxeIntro(false)} />}
      {/* Arrived straight from an open house sign-in (the sign-in link carries src=signin). */}
      <SignedInToast show={searchParams.get('src') === 'signin'} />
      {visitorDarkMode && !forceLightMode && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_18%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-10" />
        </div>
      )}
      <section className="relative mx-auto grid w-full max-w-6xl gap-4 px-5 pb-10 pt-3 lg:grid-cols-[360px_1fr] lg:gap-8 lg:px-8 lg:pt-6">
        <aside className="h-fit lg:sticky lg:top-6">
          {/* Side-by-side header (Agent Hub -> Layout) - phones AND desktop (it used to be phones only,
              so switching it changed nothing on a computer). */}
          {mobileHeader === 'split' && (
            <HubSplitHeader
              large
              className="hub-enter"
              profile={profile}
              photoUrl={profilePhotoUrl}
              photoPosition={profilePhotoPosition}
              stats={showStats ? [['Sold', saleSummary.totalSold.toString()], ['Volume', formatCompactMoney(saleSummary.totalVolume)], ['Avg', formatCompactMoney(saleSummary.avgPrice)]] : null}
              photoBadge={splitRatingChip}
            />
          )}
          <div className={`hub-enter relative rounded-[28px] border border-gray-200 bg-[#fbfaf7] px-5 pb-3 pt-5 text-center shadow-sm dark:border-gray-800 dark:bg-[#151517] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:px-7 lg:py-7 ${mobileHeader === 'split' ? 'hidden' : ''}`}>
          {/* Rating + Review sit in the card's empty top corners beside the photo - no added height. */}
          {profileRating && <div className="absolute left-3.5 top-3.5 lg:hidden">{profileRating}</div>}
          {profileReviewBtn && <div className="absolute right-3.5 top-3.5 lg:hidden">{profileReviewBtn}</div>}
          <div className="mx-auto h-[92px] w-[92px] rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B]">
            <HubAgentPhoto url={profilePhotoUrl} position={profilePhotoPosition} name={profile.name} className="rounded-full" />
          </div>
          <div className="-mt-5 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">
            {profile.brokerage}
          </div>
          <h1 className="hub-name mt-4 font-serif text-[30px] font-black leading-none tracking-tight text-[#111827] dark:text-white">{profile.name}</h1>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
          {profile.market && <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[#778093] dark:text-gray-300">
            <MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}
          </p>}
          {renderStatsSection()}
        </div>

        <section className="hub-enter mt-4 flex w-full flex-nowrap items-center justify-center lg:mt-6" style={{ animationDelay: '.12s', containerType: 'inline-size', gap: iconGapPx }}>
          {enabledContacts.map(({ key, href, icon, label }) => (
            <IconContact key={key} href={href} icon={icon} label={label} iconSize={iconBoxSize} glyphSize={iconGlyphSize} boxStyle={iconBoxStyle} />
          ))}
          {hasIconDivider && (
            <span className="mx-1 h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          )}
          {enabledSocialLinks.map(link => (
            <SocialIcon key={link.id} href={link.url} icon={socialIconMap[link.id] || Globe} id={link.id} label={link.label} iconSize={iconBoxSize} glyphSize={iconGlyphSize} boxStyle={iconBoxStyle} />
          ))}
        </section>

        <a
          href={`${API_BASE_URL}/agent-hub/public/${encodeURIComponent(agentSlug)}/vcard`}
          onClick={() => recordAgentHubEvent({ type: 'click', label: 'Save Contact' })}
          className="hub-enter hub-btn-save mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-[#111827] bg-white text-sm font-black text-[#111827] shadow-sm transition hover:bg-[#111827] hover:text-white dark:border-white dark:bg-transparent dark:text-white dark:hover:bg-white dark:hover:text-[#111827] lg:h-12 lg:text-base"
          style={{ animationDelay: '.2s' }}
        >
          <IdCard className="h-4 w-4 lg:h-5 lg:w-5" /> Save Contact
        </a>

        <div className="hub-enter mt-4 lg:mt-6" style={{ animationDelay: '.28s' }}>
          <section className="grid grid-cols-2 gap-2.5 lg:gap-3">
            <Link
              href={buyingForm ? `${agentHubBasePath}/${buyingForm.slug}${idxLightSuffix}` : '#'}
              onClick={() => recordAgentHubEvent({ type: 'form', label: buyingForm?.title || "I'm Buying" })}
              className={`hub-btn-buy flex h-11 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-sm font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white lg:h-12 lg:text-base ${buyingForm ? '' : 'pointer-events-none opacity-50'}`}
            >
              <Home className="h-4 w-4 lg:h-5 lg:w-5" /> {buyingForm?.title || "I'm Buying"}
            </Link>
            <Link
              href={sellingForm ? `${agentHubBasePath}/${sellingForm.slug}${idxLightSuffix}` : '#'}
              onClick={() => recordAgentHubEvent({ type: 'form', label: sellingForm?.title || "I'm Selling" })}
              className={`hub-btn-sell flex h-11 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-sm font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white lg:h-12 lg:text-base ${sellingForm ? '' : 'pointer-events-none opacity-50'}`}
            >
              <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5" /> {sellingForm?.title || "I'm Selling"}
            </Link>
          </section>
          <Link
            href={homeValueForm ? `${agentHubBasePath}/${homeValueForm.slug}${idxLightSuffix}` : '#'}
            onClick={() => recordAgentHubEvent({ type: 'form', label: homeValueForm?.title || "What's My Home Worth?" })}
            className={`hub-btn-worth mt-3 flex min-h-[48px] items-center justify-center gap-3 rounded-[14px] border border-[#d7b974] bg-white px-4 py-2.5 text-center text-sm font-black leading-tight text-[#111827] shadow-sm dark:border-[#d7b974]/60 dark:bg-[#151517] dark:text-white lg:mt-4 lg:min-h-[56px] lg:py-3 lg:text-base ${homeValueForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <DollarSign className="h-4 w-4 shrink-0 text-[#caa65e] lg:h-5 lg:w-5" /> <span>{homeValueForm?.title || "What's My Home Worth?"}</span> <span className="shrink-0 text-[#9aa2af]">&rsaquo;</span>
          </Link>
          <Link
            href={showingForm ? `${agentHubBasePath}/${showingForm.slug}${idxLightSuffix}` : '#'}
            onClick={() => recordAgentHubEvent({ type: 'form', label: showingForm?.title || 'Schedule a Showing' })}
            className={`hub-btn-show mt-3 flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] text-sm font-black text-[#111827] shadow-lg shadow-[#d2b16f]/30 dark:bg-[#caa65e] dark:text-white lg:mt-4 lg:h-[52px] lg:text-base ${showingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <span className="hub-show-tile inline-flex"><Calendar className="h-4 w-4 lg:h-5 lg:w-5" /></span> <span className="hub-show-label">{showingForm?.title || 'Schedule a Showing'}</span><span aria-hidden className="hub-show-go hidden">&rarr;</span>
          </Link>
          {/* Computers: one short reviews card right under Schedule a Showing. */}
          {reviewsOn && hubReviews && (
            <ReviewsDeskCard data={hubReviews} reviews={reviewsList} luxe={luxe} reviewHref={reviewHref} className="mt-4 hidden lg:block" />
          )}
        </div>
        {profile.about?.trim() && (
          <section className="hub-enter mt-6 hidden rounded-[18px] border border-[#d8c08a]/50 bg-white/75 p-5 text-left shadow-sm dark:border-[#d8c08a]/25 dark:bg-[#151517] lg:block" style={{ animationDelay: '.36s' }}>
            <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-xl font-black text-[#111827] dark:text-white">About Me</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[#5f6673] dark:text-gray-300">{profile.about}</p>
          </section>
        )}
        </aside>

        <div className="min-w-0 mt-1.5 lg:mt-0 [&>section:first-child]:!mt-0 [&>div:first-child>section]:!mt-0">
        {visibleOrderedSections.map((section, i) => (
          <div key={section.id} className="hub-enter" style={{ animationDelay: `${0.15 + Math.min(i, 4) * 0.12}s` }}>
            {renderSection(section.id)}
          </div>
        ))}

        <footer
          className="hub-enter mt-6 border-t border-gray-200 py-5 text-center text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400"
          style={{ animationDelay: `${0.15 + Math.min(visibleOrderedSections.length, 4) * 0.12 + 0.24}s` }}
        >
          Powered by <Link href="/" className="inline-flex align-[-0.15em] text-[#111827] dark:text-white"><OhpWordmark className="text-[1.15em]" /></Link>
        </footer>
        </div>
      </section>
    </main>
    </div>
  )
}

function AgentHubNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f5f1] px-6 text-center dark:bg-[#0B0B0B]">
      <OhpWordmark className="text-xl text-[#111827] dark:text-white" />
      <h1 className="mt-3 font-serif text-3xl font-black text-[#111827] dark:text-white">This link isn&apos;t active</h1>
      <p className="mt-2 max-w-sm text-sm font-medium text-[#5f6673] dark:text-gray-400">
        We couldn&apos;t find an Agent Hub at this address. Double-check the link, or ask your agent for their current page.
      </p>
      <Link href="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-sm dark:bg-white dark:text-[#111827]">
        Go to OpenHousePal
      </Link>
    </main>
  )
}

function IconContact({ href, icon: Icon, label, iconSize = 'h-[45px] w-[45px]', glyphSize = 'h-5 w-5', boxStyle }: { href: string; icon: LucideIcon; label: string; iconSize?: string; glyphSize?: string; boxStyle?: React.CSSProperties }) {
  return (
    <a href={href} onClick={() => recordAgentHubEvent({ type: 'click', label })} aria-label={label} className="block shrink-0">
      <span style={boxStyle} className={`mx-auto flex ${iconSize} items-center justify-center rounded-full bg-[#111827] text-white shadow-sm dark:bg-[#1A1A1C] dark:text-white dark:ring-1 dark:ring-white/10`}>
        <Icon className={glyphSize} />
      </span>
    </a>
  )
}

function SocialIcon({ href, icon: Icon, id, label, iconSize, glyphSize, boxStyle }: { href: string; icon: LucideIcon; id: string; label: string; iconSize: string; glyphSize: string; boxStyle?: React.CSSProperties }) {
  return (
    <a href={href.startsWith('http') ? href : `https://${href}`} onClick={() => recordAgentHubEvent({ type: 'click', label })} aria-label={label} style={boxStyle} className={`flex ${iconSize} shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white`}>
      <Icon className={`${glyphSize} ${getSocialBrandClass(id)}`} />
    </a>
  )
}

// The horizontal shelf (desktop, and phones not in Carousel view). Auto-advance is a hand-driven
// glide (lib/rowScroll glideRowByCard) with a band of light crossing the shelf as it moves, a small
// lift for the card that lands at the front. Hovering or touching the shelf pauses it. `feature` (one sale / one listing) takes
// the whole row - at every width - instead of a lone small card; two items share the row as wide
// cards on desktop.
function HubShelf({ title, action, actionHref, actionNode, sameTab = false, children, itemCount = 0, autoScroll = false, scrollPulse = 0, feature, sweep = false, summary }: {
  title: string; action: string; actionHref?: string; sameTab?: boolean; children: React.ReactNode; itemCount?: number; autoScroll?: boolean; scrollPulse?: number
  /** A line under the heading (the Reviews star rating). */
  summary?: React.ReactNode
  /** Replaces the small text link on the right of the title (e.g. Reviews' Leave a review button). */
  actionNode?: React.ReactNode
  /** The band of light that crosses the row as it glides (Recent Sales on Luxe only). */
  sweep?: boolean
  /** Replaces the row when there's exactly one item. */
  feature?: React.ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [autoScrollPaused, setAutoScrollPaused] = useState(false)
  const [lead, setLead] = useState<number | null>(null)
  const [sweepKey, setSweepKey] = useState(0)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pauseAutoScroll = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    setAutoScrollPaused(true)
  }
  const resumeAutoScrollSoon = (after = 1500) => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => setAutoScrollPaused(false), after)
  }
  useEffect(() => () => { if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current) }, [])

  const stepBy = (direction: 1 | -1, loop = false, duration = 1100) => {
    const landed = glideRowByCard(rowRef.current, direction, loop, duration)
    if (landed === null) return
    setLead(landed)
    setSweepKey(k => k + 1)
  }
  const scrollPrevious = () => { pauseAutoScroll(); stepBy(-1, false, 800); resumeAutoScrollSoon() }
  const scrollNext = () => { pauseAutoScroll(); stepBy(1, false, 800); resumeAutoScrollSoon() }

  // The parent sends one pulse at a time, so multiple sections never animate simultaneously.
  useEffect(() => {
    if (!autoScroll || !scrollPulse || autoScrollPaused || itemCount < 2) return
    stepBy(1, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll, scrollPulse, autoScrollPaused, itemCount])

  const cards = Children.map(children, (child, i) => {
    if (!isValidElement(child)) return child
    const el = child as ReactElement<{ className?: string }>
    return cloneElement(el, { className: `${el.props.className || ''}${lead === i ? ' hub-shelf-lead' : ''}` })
  })
  const rowLayout = itemCount === 2 ? 'agent-hub-desktop-duo' : 'agent-hub-desktop-trio'

  return (
    <section className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">{title}</h2>
        {actionNode ?? (<a href={actionHref ? (sameTab || actionHref.startsWith('/') ? actionHref : actionHref.startsWith('http') ? actionHref : `https://${actionHref}`) : '#'} target={actionHref && !sameTab && !actionHref.startsWith('/') ? '_blank' : undefined} rel={actionHref && !sameTab && !actionHref.startsWith('/') ? 'noreferrer' : undefined} onClick={() => recordAgentHubEvent({ type: 'click', label: `${title}: ${action}` })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">{action} &rsaquo;</a>)}
      </div>
      {summary}
      {feature ? <div>{feature}</div> : (
      <div className="agent-hub-shelf-window relative -mx-5 px-5 lg:mx-0 lg:px-10">
        <div
          ref={rowRef}
          className={`${rowLayout} scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth`}
          onTouchStart={pauseAutoScroll}
          onTouchEnd={() => resumeAutoScrollSoon()}
          onTouchCancel={() => resumeAutoScrollSoon()}
          onMouseEnter={pauseAutoScroll}
          onMouseLeave={() => resumeAutoScrollSoon(600)}
        >
          {cards}
        </div>
        {sweep && <span key={sweepKey} aria-hidden className={`hub-shelf-sweep hidden lg:block ${sweepKey ? 'is-on' : ''}`} />}
        <button
          type="button"
          onClick={scrollPrevious}
          className="absolute left-1 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm transition hover:scale-110 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-white/[0.04] dark:text-white lg:flex"
          aria-label={`Previous ${title}`}
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          className="absolute right-1 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm transition hover:scale-110 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-white/[0.04] dark:text-white lg:flex"
          aria-label={`Next ${title}`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      )}
    </section>
  )
}
