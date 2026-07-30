'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import { useAuth } from '@/contexts/AuthContext'
import api, { API_BASE_URL } from '@/lib/api-service'
import QRCode from 'qrcode'
import FormResultsModal from '@/components/forms/FormResultsModal'
import FormBuilderModal from '@/components/forms/FormBuilderModal'
import PropertyLinkPicker from '@/components/forms/PropertyLinkPicker'
import ConfirmationModal from '@/components/ConfirmationModal'
import WarningConfirmModal from '@/components/WarningConfirmModal'
import RecentSalesCarousel from '@/components/agent-hub/RecentSalesCarousel'
import HubItemCarousel from '@/components/agent-hub/HubItemCarousel'
import { AgentFormConfig, FormQuestion, FormQuestionType, FormSubmissionListItem, LinkedProperty } from '@/types'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  Copy,
  Download,
  Facebook,
  FileText,
  Globe,
  Home,
  Image as ImageIcon,
  Info,
  Instagram,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Music2,
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
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight,
  GripVertical,
  DollarSign,
  TrendingUp,
  Youtube,
  Loader2,
  Pencil,
  LayoutGrid,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

type HubStatus = 'Draft' | 'Published' | 'Unpublished'
type PreviewSize = 'mobile' | 'tablet' | 'desktop'
type HubItem = { id: string; title: string; description?: string; image?: string; link?: string }
type AgentSale = { id: string; address: string; city: string; state: string; zipcode?: string; price?: number; status?: string; image?: string; sold_date?: string; visible?: boolean; source?: 'bright' | 'manual' }
type AgentHubEvent = { type: 'visit' | 'click' | 'form' | 'qr'; label?: string; timestamp: string }
type SavedSocialLink = { id: string; label: string; url: string; enabled: boolean }
type SavedAgentHubData = {
  profile: { name: string; title: string; brokerage: string; market: string; licenseNumber: string; about?: string }
  contact: { call: string; text: string; email: string }
  socialLinks: SavedSocialLink[]
  recentSales?: AgentSale[]
  showSalesStats?: boolean
  salesCarousel?: boolean
  videosCarousel?: boolean
  toursCarousel?: boolean
  blogsCarousel?: boolean
  salesAutoScroll?: boolean
  videosAutoScroll?: boolean
  toursAutoScroll?: boolean
  blogsAutoScroll?: boolean
  visitorDarkMode?: boolean
  videoLinks?: HubItem[]
  videoChannelUrl?: string
  houseTourLinks?: HubItem[]
  houseTourUrl?: string
  blogCards?: HubItem[]
  profilePhotoUrl: string
  layoutSections: typeof sections
  visibleSectionIds: string[]
  savedAt: string
}
type SocialLink = {
  id: string
  label: string
  url: string
  enabled: boolean
  icon: React.ComponentType<{ className?: string }>
}

const sections = [
  { id: 'sales', label: 'Recent Sales', status: 'Complete', visible: true, count: '6 selected' },
  { id: 'videos', label: 'Videos', status: 'Complete', visible: true, count: '3 videos' },
  { id: 'tours', label: 'House Tours', status: 'Complete', visible: true, count: '0 tours' },
  { id: 'blogs', label: 'Blogs', status: 'Complete', visible: true, count: '4 posts' },
]

const normalizeLayoutSections = (savedSections: typeof sections) => {
  const savedById = new Map(savedSections.map(section => [section.id, section]))
  const orderedSaved = savedSections
    .filter(section => sections.some(defaultSection => defaultSection.id === section.id))
    .map(section => ({ ...sections.find(defaultSection => defaultSection.id === section.id)!, visible: section.visible }))
  const missing = sections.filter(section => !savedById.has(section.id))
  return [...orderedSaved, ...missing]
}

const getSaleSummary = (sales: AgentSale[]) => {
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

const FORM_TYPE_META: Record<string, { icon: typeof Home; description: string }> = {
  buying: { icon: Home, description: 'Quickly collect the basic information needed from a new buyer lead.' },
  selling: { icon: TrendingUp, description: 'Quickly collect the basic information needed from a potential seller lead.' },
  home_value: { icon: DollarSign, description: 'Collect a homeowner’s property information so you can prepare a home-value estimate.' },
  seller_onboarding: { icon: FileText, description: 'A fuller intake once a seller becomes a client - what you need to prep, market, and list.' },
  buyer_onboarding: { icon: FileText, description: 'A fuller intake once a buyer becomes a client - what you need to start representing them.' },
  showing: { icon: Calendar, description: 'A quick form for someone requesting to tour a specific property.' },
  how_can_i_help: { icon: HelpCircle, description: 'A general lead form for all leads - typically used in bios, YouTube descriptions, etc.' },
  showcase_request: { icon: QrCode, description: 'A lead form for open house guests who want their own personalized property showcase - reached via a QR code on your Brag Sheet.' },
  custom: { icon: FileText, description: 'Custom form for your own use case' },
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

const getRecentStats = (events: AgentHubEvent[], type: AgentHubEvent['type']) => {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const currentStart = now - (30 * day)
  const previousStart = now - (60 * day)
  const typed = events.filter(event => event.type === type)
  const current = typed.filter(event => new Date(event.timestamp).getTime() >= currentStart).length
  const previous = typed.filter(event => {
    const time = new Date(event.timestamp).getTime()
    return time >= previousStart && time < currentStart
  }).length

  const percent = previous === 0
    ? current > 0 ? 100 : 0
    : Math.round(((current - previous) / previous) * 100)

  return { current, previous, percent }
}

const formatPercentChange = (percent: number) => {
  if (percent === 0) return '0%'
  return `${percent > 0 ? '+' : ''}${percent}%`
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
  if (clean === 'pending' || clean === 'coming soon') return 'bg-amber-500 text-white'
  if (clean === 'off market') return 'bg-gray-500 text-white'
  if (clean === 'sold') return 'bg-rose-500 text-white'
  return 'bg-[#8b7355] text-white'
}

const getSaleLocation = (sale: AgentSale) => [sale.city, sale.state].filter(Boolean).join(', ') || getStreetOnly(sale.address)

const isEligibleSaleStatus = (status?: string) => ['sold', 'active', 'pending', 'under contract'].includes(formatSaleStatus(status).toLowerCase())

const isEligibleSale = (sale: AgentSale) => isEligibleSaleStatus(sale.status) && (sale.price || 0) >= 100000

const shouldAutoShowSale = (sale: AgentSale) => isEligibleSale(sale)

const normalizeAgentSale = (sale: AgentSale): AgentSale => ({
  ...sale,
  visible: sale.visible ?? shouldAutoShowSale(sale),
})

const getEligibleSales = (sales: AgentSale[]) => sales.filter(isEligibleSale).map(normalizeAgentSale)

const sectionHasContent = (id: string, recentSales: AgentSale[], videoLinks: HubItem[], houseTourLinks: HubItem[], houseTourUrl: string, blogCards: HubItem[]) => {
  if (id === 'sales') return getEligibleSales(recentSales).some(sale => sale.visible)
  if (id === 'videos') return videoLinks.some(item => item.link?.trim())
  if (id === 'tours') return Boolean(houseTourUrl.trim()) || houseTourLinks.some(item => item.link?.trim())
  if (id === 'blogs') return blogCards.some(item => item.link?.trim() || item.title.trim())
  return true
}

const getStreetOnly = (address?: string) => {
  const firstLine = String(address || '').split(',')[0]?.trim() || 'Address unavailable'
  return firstLine.replace(/\s+(#|apt\.?|unit|suite|ste\.?|fl\.?|floor)\s*[\w-]+.*$/i, '').trim() || firstLine
}

const EDITOR_SECTION_THEME: Record<string, { subtitle: string; wash: string; iconChip: string; ring: string; border: string; shadow: string; topBorder: string }> = {
  Profile: {
    subtitle: 'Your name, photo, and how you\'re introduced to visitors',
    wash: 'from-[#C9A24D]/12 via-white to-white dark:from-[#C9A24D]/10 dark:via-[#151517] dark:to-[#151517]',
    iconChip: 'bg-gradient-to-br from-[#C9A24D]/30 to-[#C9A24D]/10 text-[#8b7355]',
    ring: 'ring-[#C9A24D]/30',
    border: 'border-[#C9A24D]/50',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(201,162,77,0.45)]',
    topBorder: 'border-[#C9A24D]/20',
  },
  Contact: {
    subtitle: 'Where visitors can call, text, or email you directly',
    wash: 'from-teal-500/10 via-white to-white dark:from-teal-500/10 dark:via-[#151517] dark:to-[#151517]',
    iconChip: 'bg-gradient-to-br from-teal-500/30 to-teal-500/10 text-teal-700 dark:text-teal-400',
    ring: 'ring-teal-500/30',
    border: 'border-teal-400/50',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(20,184,166,0.45)]',
    topBorder: 'border-teal-400/20',
  },
  'Social Links': {
    subtitle: 'Connect the accounts you want visitors to find',
    wash: 'from-violet-500/10 via-white to-white dark:from-violet-500/10 dark:via-[#151517] dark:to-[#151517]',
    iconChip: 'bg-gradient-to-br from-violet-500/30 to-violet-500/10 text-violet-700 dark:text-violet-400',
    ring: 'ring-violet-500/30',
    border: 'border-violet-400/50',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(139,92,246,0.45)]',
    topBorder: 'border-violet-400/20',
  },
}

const editorGroups = [
  {
    title: 'Profile',
    icon: User,
    fields: [
      ['Profile photo', 'Change Photo'],
      ['Brokerage name', ''],
      ['Agent name', ''],
      ['Professional title', ''],
      ['Market or service area', ''],
      ['About me', ''],
      ['RE License number', ''],
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

function CarouselRow({ children, step = 180, showArrows = false, shellClass = 'relative px-5' }: { children: React.ReactNode; step?: number; showArrows?: boolean; shellClass?: string }) {
  const rowRef = useRef<HTMLDivElement>(null)

  const scrollPrevious = () => {
    rowRef.current?.scrollBy({ left: -step, behavior: 'smooth' })
  }

  const scrollNext = () => {
    rowRef.current?.scrollBy({ left: step, behavior: 'smooth' })
  }

  return (
    <div className={shellClass}>
      <div ref={rowRef} className="scrollbar-hide flex gap-3 overflow-x-auto scroll-smooth lg:overflow-hidden">
        {children}
      </div>
      <button
        type="button"
        onClick={scrollPrevious}
        className={`absolute left-1 top-1/2 h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm backdrop-blur ${showArrows ? 'hidden lg:flex' : 'hidden'}`}
        aria-label="Previous"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        className={`absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm backdrop-blur ${showArrows ? 'hidden lg:flex' : 'hidden'}`}
        aria-label="Next"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function PublicPreview({
  size,
  compact = false,
  socialLinks,
  contact,
  profilePhotoUrl,
  layoutSections,
  profile,
  recentSales,
  showSalesStats,
  salesCarousel,
  visitorDarkMode,
  videoLinks,
  videoChannelUrl,
  videosCarousel,
  houseTourLinks,
  houseTourUrl,
  toursCarousel,
  blogCards,
  blogsCarousel,
  agentForms,
  agentHubPublicPath,
}: {
  size: PreviewSize
  compact?: boolean
  socialLinks: SocialLink[]
  contact: { call: string; text: string; email: string }
  profilePhotoUrl: string
  layoutSections: typeof sections
  profile: { name: string; title: string; brokerage: string; market: string; about?: string }
  recentSales: AgentSale[]
  showSalesStats: boolean
  salesCarousel: boolean
  visitorDarkMode: boolean
  videoLinks: HubItem[]
  videoChannelUrl: string
  videosCarousel: boolean
  houseTourLinks: HubItem[]
  houseTourUrl: string
  toursCarousel: boolean
  blogCards: HubItem[]
  blogsCarousel: boolean
  agentForms: AgentFormConfig[]
  agentHubPublicPath: string
}) {
  const width = compact ? 'w-full max-w-full' : size === 'mobile' ? 'max-w-[360px]' : size === 'tablet' ? 'max-w-[620px]' : 'max-w-4xl'
  const shellPadding = compact ? 'px-4 pb-4 pt-4' : 'px-6 pb-6 pt-5'
  const enabledSocialLinks = socialLinks.filter(link => link.enabled && link.url.trim())
  const visibleLayoutSections = layoutSections.filter(section => section.visible && sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, blogCards))
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
  const iconBoxSize = totalIconCount <= 4 ? (isCompactPreview ? 'h-10 w-10' : 'h-12 w-12') : totalIconCount <= 6 ? (isCompactPreview ? 'h-9 w-9' : 'h-11 w-11') : totalIconCount <= 8 ? (isCompactPreview ? 'h-7 w-7' : 'h-10 w-10') : (isCompactPreview ? 'h-6 w-6' : 'h-9 w-9')
  const iconGlyphSize = totalIconCount <= 4 ? (isCompactPreview ? 'h-4 w-4' : 'h-5 w-5') : totalIconCount <= 6 ? (isCompactPreview ? 'h-4 w-4' : 'h-[18px] w-[18px]') : totalIconCount <= 8 ? (isCompactPreview ? 'h-3.5 w-3.5' : 'h-4 w-4') : (isCompactPreview ? 'h-3 w-3' : 'h-[14px] w-[14px]')
  const iconGap = totalIconCount <= 4 ? 'gap-3' : totalIconCount <= 6 ? (isCompactPreview ? 'gap-1.5' : 'gap-2.5') : totalIconCount <= 8 ? (isCompactPreview ? 'gap-1' : 'gap-2') : 'gap-1'
  const saleSummary = getSaleSummary(recentSales)
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

  const renderSection = (id: string) => {
    if (id === 'sales') {
      return (
        <div key={id} className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Recent Sales</h3>
            <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">View All &rsaquo;</span>
          </div>
          {salesCarousel && size === 'mobile' ? (
            <RecentSalesCarousel sales={getEligibleSales(recentSales).filter(sale => sale.visible).slice(0, 8)} compact />
          ) : (
            <CarouselRow step={170} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
              {getEligibleSales(recentSales).filter(sale => sale.visible).slice(0, 6).map((sale) => (
                <div key={sale.id} className="relative h-[108px] w-[172px] shrink-0 overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
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
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/30 text-white shadow-sm backdrop-blur-[1px]">
                    <Play className="ml-1 h-6 w-6 fill-white/80 text-white/90" />
                  </span>
                </a>
              )}
            />
          ) : (
            <CarouselRow step={162} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
              {eligibleVideos.map((item) => (
                <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="w-[162px] shrink-0">
                  <div className="relative h-[92px] overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                    <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm backdrop-blur-[1px]">
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
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/30 text-white shadow-sm backdrop-blur-[1px]">
                    <Play className="ml-1 h-6 w-6 fill-white/80 text-white/90" />
                  </span>
                </a>
              )}
            />
          ) : (
            <CarouselRow step={180} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
              {eligibleTours.map((item) => (
                <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="w-[180px] shrink-0">
                  <div className="relative h-[102px] overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                    <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm backdrop-blur-[1px]">
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
                <a href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'} target={item.link ? '_blank' : undefined} rel={item.link ? 'noreferrer' : undefined} className={`flex h-full w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-sm dark:bg-[#151517] ${item.link ? '' : 'pointer-events-none'}`}>
                  <div className="flex-1 bg-cover bg-center" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
                  <div className="bg-white p-4 pb-6 dark:bg-[#1A1A1C]">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                    <h4 className="mt-1 line-clamp-2 text-sm font-black leading-4 text-[#111827] dark:text-white">{item.title}</h4>
                  </div>
                </a>
              )}
            />
          ) : (
            <CarouselRow step={198} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
              {eligibleBlogs.map((item) => (
                <a key={item.id} href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'} target={item.link ? '_blank' : undefined} rel={item.link ? 'noreferrer' : undefined} className={`w-[198px] shrink-0 overflow-hidden rounded-[14px] bg-white shadow-sm dark:bg-[#151517] dark:shadow-none ${item.link ? '' : 'pointer-events-none'}`}>
                  <div className="h-[92px] bg-cover bg-center" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
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

  return (
    <div className={visitorDarkMode ? 'dark' : ''}>
    <div className={`${width} ${compact ? 'mx-0' : 'mx-auto'} relative overflow-hidden rounded-[28px] border border-gray-200 bg-[#f7f5f1] dark:border-gray-800 dark:bg-[#0B0B0B] ${shellPadding} shadow-xl`}>
      {visitorDarkMode && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_18%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-10" />
        </div>
      )}
      <div className="relative text-center">
        <div className="mx-auto h-[92px] w-[92px] rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B]">
          <div className="h-full w-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePhotoUrl})` }} />
        </div>
        <div className="-mt-5 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">{profile.brokerage}</div>
        <h2 className="mt-4 font-serif text-[30px] font-black leading-none text-[#111827] dark:text-white">{profile.name}</h2>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
        <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[#778093] dark:text-gray-300"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}</p>
        {size !== 'desktop' && renderSalesStats()}
      </div>
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
      <div className="mt-6">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={buyingForm ? `${agentHubPublicPath}/${buyingForm.slug}` : '#'}
            target="_blank"
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white ${buyingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <Home className="h-5 w-5" /> {buyingForm?.title || "I'm Buying"}
          </Link>
          <Link
            href={sellingForm ? `${agentHubPublicPath}/${sellingForm.slug}` : '#'}
            target="_blank"
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white ${sellingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <TrendingUp className="h-5 w-5" /> {sellingForm?.title || "I'm Selling"}
          </Link>
        </div>
        <Link
          href={homeValueForm ? `${agentHubPublicPath}/${homeValueForm.slug}` : '#'}
          target="_blank"
          className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#d7b974] bg-white px-4 py-3 text-center font-black leading-tight dark:border-[#d7b974]/60 dark:bg-[#151517] dark:text-white ${homeValueForm ? '' : 'pointer-events-none opacity-50'}`}
        >
          <DollarSign className="h-5 w-5 shrink-0 text-[#caa65e]" /> <span>{homeValueForm?.title || "What's My Home Worth?"}</span> <span className="shrink-0 text-[#9aa2af]">&rsaquo;</span>
        </Link>
        <Link
          href={showingForm ? `${agentHubPublicPath}/${showingForm.slug}` : '#'}
          target="_blank"
          className={`mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] font-black text-[#111827] shadow-lg shadow-[#d2b16f]/30 dark:text-white ${showingForm ? '' : 'pointer-events-none opacity-50'}`}
        >
          <Calendar className="h-5 w-5" /> {showingForm?.title || 'Schedule a Showing'}
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
    </div>
    </div>
  )
}

export default function AgentHubPage() {
  return (
    <AuthGuard>
      <BrokerAuthorizationGuard>
        <SubscriptionGuard requiredPlan="BASIC">
          <AgentHubContent />
        </SubscriptionGuard>
      </BrokerAuthorizationGuard>
    </AuthGuard>
  )
}

function AgentHubContent() {
  const { user } = useAuth()
  const [created, setCreated] = useState(true)
  const [status, setStatus] = useState<HubStatus>('Draft')
  const [saveStatus, setSaveStatus] = useState('Unsaved Changes')
  const hasUnsavedChanges = saveStatus !== 'Saved'
  const [lastSavedHub, setLastSavedHub] = useState<SavedAgentHubData | null>(null)
  const [editorSectionStatus, setEditorSectionStatus] = useState<Record<string, 'Complete' | 'Incomplete'>>({
    Profile: 'Incomplete',
    Contact: 'Incomplete',
    'Social Links': 'Incomplete',
  })
  const [activeTab, setActiveTab] = useState('Overview')
  const [previewSize, setPreviewSize] = useState<PreviewSize>('mobile')
  const [openEditorSection, setOpenEditorSection] = useState('')
  const [layoutSections, setLayoutSections] = useState(sections)
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)
  const [isLayoutSectionsOpen, setIsLayoutSectionsOpen] = useState(false)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('/home.jpg')
  const [profile, setProfile] = useState({
    name: '',
    title: '',
    brokerage: '',
    market: '',
    licenseNumber: '',
    about: '',
  })
  const [contact, setContact] = useState({
    call: '',
    text: '',
    email: '',
  })
  const [analyticsEvents, setAnalyticsEvents] = useState<AgentHubEvent[]>([])
  const [agentHubSlug, setAgentHubSlug] = useState('sarah-johnson')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'saved' | 'error'>('idle')
  const [slugMessage, setSlugMessage] = useState('Check availability before saving.')
  const initializedSlugRef = useRef(false)
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([
    { id: 'instagram', label: 'Instagram', url: '', enabled: false, icon: Instagram },
    { id: 'facebook', label: 'Facebook', url: '', enabled: false, icon: Facebook },
    { id: 'youtube', label: 'YouTube', url: '', enabled: false, icon: Youtube },
    { id: 'tiktok', label: 'TikTok', url: '', enabled: false, icon: Music2 },
    { id: 'website', label: 'Website', url: '', enabled: false, icon: Globe },
  ])
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
  const [showSalesStats, setShowSalesStats] = useState(true)
  const [salesCarousel, setSalesCarousel] = useState(false)
  const [videosCarousel, setVideosCarousel] = useState(false)
  const [toursCarousel, setToursCarousel] = useState(false)
  const [blogsCarousel, setBlogsCarousel] = useState(false)
  const [salesAutoScroll, setSalesAutoScroll] = useState(false)
  const [videosAutoScroll, setVideosAutoScroll] = useState(false)
  const [toursAutoScroll, setToursAutoScroll] = useState(false)
  const [blogsAutoScroll, setBlogsAutoScroll] = useState(false)
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [videoLinks, setVideoLinks] = useState<HubItem[]>([{ id: 'video-1', title: 'YouTube Video', link: '' }])
  const [videoChannelUrl, setVideoChannelUrl] = useState('')
  const [houseTourLinks, setHouseTourLinks] = useState<HubItem[]>([{ id: 'tour-1', title: 'House Tour', link: '' }])
  const [houseTourUrl, setHouseTourUrl] = useState('')
  const [blogCards, setBlogCards] = useState<HubItem[]>(blogs.map(([title, date], index) => ({ id: `blog-${index}`, title, description: date, image: '', link: '' })))

  const [agentForms, setAgentForms] = useState<AgentFormConfig[]>([])
  const [formsLoading, setFormsLoading] = useState(true)
  const [formSubmissionsByFormId, setFormSubmissionsByFormId] = useState<Record<string, FormSubmissionListItem[]>>({})
  const [submissionsLoadingByFormId, setSubmissionsLoadingByFormId] = useState<Record<string, boolean>>({})
  const [resultsModalFormId, setResultsModalFormId] = useState<string>('')
  const [formEditorOpenId, setFormEditorOpenId] = useState('')
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [formSaveStatus, setFormSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})
  const [formSlugDrafts, setFormSlugDrafts] = useState<Record<string, string>>({})
  const [formSlugStatus, setFormSlugStatus] = useState<Record<string, 'idle' | 'checking' | 'available' | 'taken' | 'saved' | 'error'>>({})
  const [formSlugMessage, setFormSlugMessage] = useState<Record<string, string>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [newFormTitle, setNewFormTitle] = useState('')
  const [creatingForm, setCreatingForm] = useState(false)
  const [deleteFormTarget, setDeleteFormTarget] = useState<AgentFormConfig | null>(null)
  const [deletingForm, setDeletingForm] = useState(false)
  const [deleteSubmissionTarget, setDeleteSubmissionTarget] = useState<FormSubmissionListItem | null>(null)
  const [showAgentHubUrlWarning, setShowAgentHubUrlWarning] = useState(false)
  const [pendingFormSlugSave, setPendingFormSlugSave] = useState<AgentFormConfig | null>(null)
  const [deletingSubmission, setDeletingSubmission] = useState(false)
  const [editingSlugFormId, setEditingSlugFormId] = useState('')
  const initializedFormsRef = useRef(false)
  const qrDownloadFns = useRef<Record<string, () => void>>({})

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
  }, [user])

  const applySavedHubData = (parsed: any) => {
    if (parsed.profile || parsed.contact) {
      setProfile({
        name: parsed.profile?.name || '',
        title: parsed.profile?.title || '',
        brokerage: parsed.profile?.brokerage || '',
        market: parsed.profile?.market || '',
        licenseNumber: parsed.profile?.licenseNumber || parsed.contact?.licenseNumber || '',
        about: parsed.profile?.about || '',
      })
    }
    if (parsed.contact) setContact({ call: '', text: '', email: '', ...parsed.contact })
    if (parsed.profilePhotoUrl) setProfilePhotoUrl(parsed.profilePhotoUrl)
    if (Array.isArray(parsed.layoutSections)) setLayoutSections(normalizeLayoutSections(parsed.layoutSections))
    if (Array.isArray(parsed.socialLinks)) {
      setSocialLinks(current => current.map(link => {
        const saved = parsed.socialLinks.find((item: SavedSocialLink) => item.id === link.id)
        return saved ? { ...link, url: saved.url, enabled: saved.enabled } : link
      }))
    }
    if (Array.isArray(parsed.recentSales)) setRecentSales(getEligibleSales(parsed.recentSales))
    if (typeof parsed.showSalesStats === 'boolean') setShowSalesStats(parsed.showSalesStats)
    if (typeof parsed.salesCarousel === 'boolean') setSalesCarousel(parsed.salesCarousel)
    if (typeof parsed.videosCarousel === 'boolean') setVideosCarousel(parsed.videosCarousel)
    if (typeof parsed.toursCarousel === 'boolean') setToursCarousel(parsed.toursCarousel)
    if (typeof parsed.blogsCarousel === 'boolean') setBlogsCarousel(parsed.blogsCarousel)
    if (typeof parsed.salesAutoScroll === 'boolean') setSalesAutoScroll(parsed.salesAutoScroll)
    if (typeof parsed.videosAutoScroll === 'boolean') setVideosAutoScroll(parsed.videosAutoScroll)
    if (typeof parsed.toursAutoScroll === 'boolean') setToursAutoScroll(parsed.toursAutoScroll)
    if (typeof parsed.blogsAutoScroll === 'boolean') setBlogsAutoScroll(parsed.blogsAutoScroll)
    if (typeof parsed.visitorDarkMode === 'boolean') setVisitorDarkMode(parsed.visitorDarkMode)
    if (Array.isArray(parsed.videoLinks)) setVideoLinks(parsed.videoLinks)
    if (typeof parsed.videoChannelUrl === 'string') setVideoChannelUrl(parsed.videoChannelUrl)
    if (typeof parsed.houseTourUrl === 'string') setHouseTourUrl(parsed.houseTourUrl)
    if (Array.isArray(parsed.houseTourLinks)) setHouseTourLinks(parsed.houseTourLinks)
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
      if (cancelled || !response.success || !response.data) return

      const config = response.data.config
      if (config && Object.keys(config).length > 0) {
        applySavedHubData(config)
        return
      }

      const savedHub = localStorage.getItem('agentHubSavedData')
      if (!savedHub) return
      try {
        const parsed = JSON.parse(savedHub)
        await api.agentHub.saveConfig(parsed)
      } catch {}
    }

    syncBackendConfig()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    const loadAnalytics = async () => {
      const response = await api.agentHub.getAnalytics()
      if (response.success && response.data) setAnalyticsEvents(response.data)
    }

    loadAnalytics()
    window.addEventListener('focus', loadAnalytics)
    return () => window.removeEventListener('focus', loadAnalytics)
  }, [])

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
        sorted.forEach(form => refreshFormSubmissions(form.id))
      }
      setFormsLoading(false)
    }

    loadAgentForms()
  }, [user])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const tabParam = url.searchParams.get('tab')
    const formIdParam = url.searchParams.get('formId')
    if (tabParam) setActiveTab(tabParam)
    if (formIdParam) setResultsModalFormId(formIdParam)
  }, [])

  useEffect(() => {
    if (user?.photo_url) {
      setProfilePhotoUrl(user.photo_url.startsWith('http') ? user.photo_url : `${API_BASE_URL}${user.photo_url}`)
    }
  }, [user?.photo_url])

  const visitorStats = getRecentStats(analyticsEvents, 'visit')
  const formStats = getRecentStats(analyticsEvents, 'form')
  const qrStats = getRecentStats(analyticsEvents, 'qr')
  const agentHubPublicPath = `/${agentHubSlug || 'sarah-johnson'}`
  const agentHubPublicUrl = `openhousepal.com${agentHubPublicPath}`
  const isFormsTabGroup = ['My Forms', 'Share Forms', 'Forms Results'].includes(activeTab)
  const AGENT_HUB_SUBTABS = ['Editor', 'Layout', 'Public URL']
  const FORMS_SUBTABS: { id: string; label: string }[] = [
    { id: 'My Forms', label: 'Forms' },
    { id: 'Share Forms', label: 'Share' },
    { id: 'Forms Results', label: 'Results' },
  ]
  const activeNavGroup: 'Overview' | 'Agent Hub' | 'Forms' = activeTab === 'Overview' ? 'Overview' : isFormsTabGroup ? 'Forms' : 'Agent Hub'
  const formGroups = agentForms.map(form => ({
    label: form.title,
    formId: form.id,
    formType: form.form_type,
    submissions: formSubmissionsByFormId[form.id] || [],
  }))
  const ONBOARDING_FORM_TYPES = new Set(['seller_onboarding', 'buyer_onboarding'])
  const premadeForms = agentForms.filter(form => form.form_type !== 'custom' && !ONBOARDING_FORM_TYPES.has(form.form_type))
  const onboardingForms = agentForms.filter(form => ONBOARDING_FORM_TYPES.has(form.form_type))
  const customForms = agentForms.filter(form => form.form_type === 'custom')

  const renderFormCard = (form: AgentFormConfig, options?: { big?: boolean }) => {
    const meta = FORM_TYPE_META[form.form_type] || FORM_TYPE_META.custom
    const MetaIcon = meta.icon
    const big = options?.big
    return (
      <div
        key={form.id}
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.06)] transition hover:border-[#C9A24D]/60 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.1)] dark:border-gray-800 dark:bg-[#151517]"
      >
        {/* Dedicated strip (not a border) so its color isn't in a specificity contest with the
            border-gray-200/dark:border-gray-800 classes above - a plain background-color always wins. */}
        <div
          className="absolute inset-y-0 left-0 w-1 [background-color:var(--form-accent)] dark:[background-color:var(--form-accent-dark)]"
          style={{ '--form-accent': form.accent_color || '#816937', '--form-accent-dark': form.accent_color || '#d7b974' } as React.CSSProperties}
        />
        <div className={`flex items-center gap-3 ${big ? 'p-5' : 'p-4'}`}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
            style={{ backgroundColor: form.accent_color || '#816937' }}
          >
            <MetaIcon className="h-4 w-4" />
          </div>
          <button onClick={() => { setFormEditorOpenId(form.id); setIsBuilderOpen(true) }} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black tracking-tight dark:text-white">{form.title}</p>
                {form.form_type === 'custom' && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">Custom</span>
                )}
              </div>
              <p className={`mt-1 text-xs font-medium leading-snug text-gray-500 dark:text-gray-400 ${big ? '' : 'line-clamp-2'}`}>{form.description || meta.description}</p>
              <p className="mt-1 truncate text-xs font-semibold text-gray-400 dark:text-gray-500">{form.questions.length} questions</p>
            </div>
          </button>
          {form.form_type === 'custom' && (
            <button onClick={() => setDeleteFormTarget(form)} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete form">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => { setFormEditorOpenId(form.id); setIsBuilderOpen(true) }} className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-[#C9A24D]/10 hover:text-[#8b7355]" aria-label={`Edit ${form.title}`}>
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  const renderShareCard = (form: AgentFormConfig) => {
    const meta = FORM_TYPE_META[form.form_type] || FORM_TYPE_META.custom
    const slugDraft = getFormSlugDraft(form)
    const status = formSlugStatus[form.id] || 'idle'
    const message = formSlugMessage[form.id] || 'Check availability before saving.'
    const publicUrl = `${agentHubPublicUrl}/${form.slug}`
    const isEditingSlug = editingSlugFormId === form.id
    return (
      <div key={form.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#C9A24D]/60 hover:shadow-md dark:border-gray-800 dark:bg-[#151517]">
        <div className="flex items-center gap-3">
          <FormQrCode url={`https://${publicUrl}`} size={48} onDownloadReady={(fn) => { qrDownloadFns.current[form.id] = fn }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black leading-tight dark:text-white">{form.title}</p>
            <p className="mt-1 text-xs font-medium leading-snug text-gray-500 line-clamp-2 dark:text-gray-400">{form.description || meta.description}</p>
            <p className="mt-1 text-xs font-semibold text-gray-400">{form.questions.length} questions</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setEditingSlugFormId(isEditingSlug ? '' : form.id)}
            className="flex-1 rounded-lg border border-gray-200 bg-[#fbfaf7] px-3 py-2 text-xs font-black text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300"
          >
            {isEditingSlug ? 'Close' : 'Edit URL'}
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${agentHubPublicPath}/${form.slug}`)}
            className="shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white transition hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
            aria-label="Copy link"
            title="Copy link"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => qrDownloadFns.current[form.id]?.()}
            className="shrink-0 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white transition hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
            aria-label="Download QR code"
            title="Download QR code"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>

        {isEditingSlug && (
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B]">
              <span className="flex max-w-[75%] shrink-0 items-center truncate border-r border-gray-200 bg-gray-50 px-2 py-2 text-[10px] font-black text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400">{agentHubPublicUrl}/</span>
              <input
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs font-semibold outline-none dark:text-white"
                value={slugDraft}
                onChange={(event) => {
                  setFormSlugDrafts(current => ({ ...current, [form.id]: event.target.value.toLowerCase() }))
                  setFormSlugStatus(current => ({ ...current, [form.id]: 'idle' }))
                  setFormSlugMessage(current => ({ ...current, [form.id]: 'Check availability before saving.' }))
                }}
              />
            </div>
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

  const renderResultsCard = ({ label, formId, submissions }: { label: string; formId: string; formType: string; submissions: FormSubmissionListItem[] }) => {
    const pending = submissions.filter(submission => !submission.is_reviewed).length
    return (
      <button key={formId} onClick={() => setResultsModalFormId(formId)} className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-[#C9A24D]/60 hover:shadow-md dark:border-gray-800 dark:bg-[#151517]">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-black leading-tight dark:text-white">{label}</h3>
          {pending > 0 && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{pending} new</span>}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{submissions.length === 0 ? 'No submissions yet' : `Latest: ${new Date(submissions[0].created_at).toLocaleDateString()}`}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-xs font-black text-[#8b7355]">{submissions.length} total</span>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </div>
      </button>
    )
  }

  const moveDraggedSection = (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId) return

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
  }

  const handleSaveAgentHubChanges = (overrides?: Partial<Pick<SavedAgentHubData, 'recentSales' | 'showSalesStats' | 'salesCarousel' | 'videosCarousel' | 'toursCarousel' | 'blogsCarousel' | 'salesAutoScroll' | 'videosAutoScroll' | 'toursAutoScroll' | 'blogsAutoScroll' | 'videoLinks' | 'videoChannelUrl' | 'houseTourLinks' | 'houseTourUrl' | 'blogCards'>>) => {
    const savedSocialLinks: SavedSocialLink[] = socialLinks.map(({ id, label, url, enabled }) => ({
      id,
      label,
      url,
      enabled,
    }))
    const salesToSave = getEligibleSales(overrides?.recentSales || recentSales)
    const showSalesStatsToSave = overrides?.showSalesStats ?? showSalesStats
    const salesCarouselToSave = overrides?.salesCarousel ?? salesCarousel
    const videosCarouselToSave = overrides?.videosCarousel ?? videosCarousel
    const toursCarouselToSave = overrides?.toursCarousel ?? toursCarousel
    const blogsCarouselToSave = overrides?.blogsCarousel ?? blogsCarousel
    const salesAutoScrollToSave = overrides?.salesAutoScroll ?? salesAutoScroll
    const videosAutoScrollToSave = overrides?.videosAutoScroll ?? videosAutoScroll
    const toursAutoScrollToSave = overrides?.toursAutoScroll ?? toursAutoScroll
    const blogsAutoScrollToSave = overrides?.blogsAutoScroll ?? blogsAutoScroll
    const videosToSave = overrides?.videoLinks || videoLinks
    const videoChannelUrlToSave = overrides?.videoChannelUrl ?? videoChannelUrl
    const houseToursToSave = overrides?.houseTourLinks || houseTourLinks
    const houseTourUrlToSave = houseTourUrl
    const blogsToSave = overrides?.blogCards || blogCards

    const savedHub: SavedAgentHubData = {
      profile,
      contact,
      socialLinks: savedSocialLinks,
      recentSales: salesToSave,
      showSalesStats: showSalesStatsToSave,
      salesCarousel: salesCarouselToSave,
      videosCarousel: videosCarouselToSave,
      toursCarousel: toursCarouselToSave,
      blogsCarousel: blogsCarouselToSave,
      salesAutoScroll: salesAutoScrollToSave,
      videosAutoScroll: videosAutoScrollToSave,
      toursAutoScroll: toursAutoScrollToSave,
      blogsAutoScroll: blogsAutoScrollToSave,
      visitorDarkMode,
      videoLinks: videosToSave,
      videoChannelUrl: videoChannelUrlToSave,
      houseTourLinks: houseToursToSave,
      houseTourUrl: houseTourUrlToSave,
      blogCards: blogsToSave,
      profilePhotoUrl,
      layoutSections,
      visibleSectionIds,
      savedAt: new Date().toISOString(),
    }
    const nextEditorSectionStatus: Record<string, 'Complete' | 'Incomplete'> = {
      Profile: profile.name.trim() && profile.brokerage.trim() && profile.title.trim() && profile.market.trim() && profile.licenseNumber.trim() ? 'Complete' : 'Incomplete',
      Contact: contact.call.trim() && contact.text.trim() && contact.email.trim() ? 'Complete' : 'Incomplete',
      'Social Links': socialLinks.some(link => link.enabled && link.url.trim()) ? 'Complete' : 'Incomplete',
    }

    api.agentHub.updateProfile({ title: profile.title, market: profile.market }).catch(() => {})
    api.agentHub.saveConfig(savedHub).catch(() => {})

    localStorage.setItem('agentHubSavedData', JSON.stringify(savedHub))
    localStorage.setItem('agentHubEditorSectionStatus', JSON.stringify(nextEditorSectionStatus))
    localStorage.setItem('agentHubProfile', JSON.stringify(profile))
    localStorage.setItem('agentHubContact', JSON.stringify(contact))
    localStorage.setItem('agentHubSocialLinks', JSON.stringify(savedSocialLinks))
    localStorage.setItem('agentHubRecentSales', JSON.stringify(salesToSave))
    localStorage.setItem('agentHubShowSalesStats', JSON.stringify(showSalesStatsToSave))
    localStorage.setItem('agentHubSalesCarousel', JSON.stringify(salesCarouselToSave))
    localStorage.setItem('agentHubVideosCarousel', JSON.stringify(videosCarouselToSave))
    localStorage.setItem('agentHubToursCarousel', JSON.stringify(toursCarouselToSave))
    localStorage.setItem('agentHubBlogsCarousel', JSON.stringify(blogsCarouselToSave))
    localStorage.setItem('agentHubSalesAutoScroll', JSON.stringify(salesAutoScrollToSave))
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
    localStorage.setItem('agentHubVisibleSections', JSON.stringify(visibleSectionIds))
    localStorage.setItem('agentHubLayoutSections', JSON.stringify(layoutSections))
    setLastSavedHub(savedHub)
    setEditorSectionStatus(nextEditorSectionStatus)
    const isAutoPublished = nextEditorSectionStatus.Profile === 'Complete' && nextEditorSectionStatus.Contact === 'Complete' && nextEditorSectionStatus['Social Links'] === 'Complete'
    setStatus(isAutoPublished ? 'Published' : 'Draft')
    setSaveStatus('Saved')
  }

  const handleCancelAgentHubChanges = () => {
    if (!lastSavedHub) return

    setProfile({ ...lastSavedHub.profile, about: lastSavedHub.profile.about || '', licenseNumber: lastSavedHub.profile.licenseNumber || '' })
    setContact(lastSavedHub.contact)
    setProfilePhotoUrl(lastSavedHub.profilePhotoUrl)
    setLayoutSections(normalizeLayoutSections(lastSavedHub.layoutSections))
    setRecentSales(lastSavedHub.recentSales || [])
    setShowSalesStats(lastSavedHub.showSalesStats ?? true)
    setSalesCarousel(lastSavedHub.salesCarousel ?? false)
    setVideosCarousel(lastSavedHub.videosCarousel ?? false)
    setToursCarousel(lastSavedHub.toursCarousel ?? false)
    setBlogsCarousel(lastSavedHub.blogsCarousel ?? false)
    setSalesAutoScroll(lastSavedHub.salesAutoScroll ?? false)
    setVideosAutoScroll(lastSavedHub.videosAutoScroll ?? false)
    setToursAutoScroll(lastSavedHub.toursAutoScroll ?? false)
    setBlogsAutoScroll(lastSavedHub.blogsAutoScroll ?? false)
    setVisitorDarkMode(lastSavedHub.visitorDarkMode ?? false)
    setVideoLinks(lastSavedHub.videoLinks || [{ id: 'video-1', title: 'YouTube Video', link: '' }])
    setVideoChannelUrl(lastSavedHub.videoChannelUrl || '')
    setHouseTourLinks(lastSavedHub.houseTourLinks || [{ id: 'tour-1', title: 'House Tour', link: '' }])
    setHouseTourUrl(lastSavedHub.houseTourUrl || '')
    setBlogCards(lastSavedHub.blogCards || blogs.map(([title, date], index) => ({ id: `blog-${index}`, title, description: date, image: '', link: '' })))
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

  const toggleSectionVisibility = (id: string) => {
    setLayoutSections(current => current.map(section => section.id === id ? { ...section, visible: !section.visible } : section))
    setSaveStatus('Unsaved Changes')
  }

  const updateProfileField = (label: string, value: string) => {
    const fieldMap: Record<string, keyof typeof profile> = {
      'Agent name': 'name',
      'Professional title': 'title',
      'Brokerage name': 'brokerage',
      'Market or service area': 'market',
      'About me': 'about',
      'RE License number': 'licenseNumber',
    }
    const key = fieldMap[label]
    if (!key) return

    setProfile(current => ({ ...current, [key]: value }))
    setEditorSectionStatus(current => ({ ...current, Profile: 'Incomplete' }))
    setSaveStatus('Unsaved Changes')
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
    await navigator.clipboard?.writeText(`${window.location.origin}${agentHubPublicPath}`)
    setSlugMessage('Public URL copied.')
  }

  const handleOpenPublicPage = () => {
    window.open(agentHubPublicPath, '_blank', 'noopener,noreferrer')
  }

  const handleSharePublicUrl = async () => {
    const shareUrl = `${window.location.origin}${agentHubPublicPath}`
    if (navigator.share) {
      await navigator.share({ title: `${profile.name || 'Agent'} Agent Hub`, url: shareUrl })
      return
    }
    await navigator.clipboard?.writeText(shareUrl)
    setSlugMessage('Public URL copied for sharing.')
  }

  const handleProfilePhotoChange = async (file?: File) => {
    if (!file) return
    setPhotoUploading(true)
    setPhotoError('')
    const response = await api.agentHub.uploadPhoto(file)
    if (response.success && response.data) {
      const url = response.data.photo_url.startsWith('http') ? response.data.photo_url : `${API_BASE_URL}${response.data.photo_url}`
      setProfilePhotoUrl(url)
      setEditorSectionStatus(current => ({ ...current, Profile: 'Incomplete' }))
      setSaveStatus('Unsaved Changes')
    } else {
      setPhotoError(response.error || 'Unable to upload photo. Please try a JPG, PNG, or WEBP under 5MB.')
    }
    setPhotoUploading(false)
  }

  const updateFormField = (formId: string, field: 'title' | 'headline' | 'subtitle' | 'description' | 'success_heading' | 'success_message' | 'accent_color', value: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, [field]: value } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
  }

  const toggleFormBranding = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, show_branding: !form.show_branding } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
  }

  const toggleFormDarkMode = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, dark_mode: !form.dark_mode } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
  }

  const toggleFormRedirect = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, redirect_to_agent_hub: !form.redirect_to_agent_hub } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
  }

  const toggleFormPropertyPhotoCarousel = (formId: string) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, property_photo_carousel: !form.property_photo_carousel } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
  }

  const updateFormBrandingLayout = (formId: string, layout: 'top' | 'bottom' | 'split' | 'split_reverse' | 'integrated') => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, branding_layout: layout } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
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
  }

  const updateFormLinkedProperty = (formId: string, property: LinkedProperty | null) => {
    setAgentForms(current => current.map(form => form.id === formId ? { ...form, linked_property: property } : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
  }

  const updateFormQuestion = (formId: string, questionId: string, updates: Partial<FormQuestion>) => {
    setAgentForms(current => current.map(form => form.id === formId
      ? { ...form, questions: form.questions.map(question => question.id === questionId ? { ...question, ...updates } : question) }
      : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
  }

  const removeFormQuestion = (formId: string, questionId: string) => {
    setAgentForms(current => current.map(form => form.id === formId
      ? { ...form, questions: form.questions.filter(question => question.locked || question.id !== questionId) }
      : form))
    setFormSaveStatus(current => ({ ...current, [formId]: 'idle' }))
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
      redirect_to_agent_hub: form.redirect_to_agent_hub,
      property_photo_carousel: form.property_photo_carousel,
      branding_layout: form.branding_layout,
      linked_property: form.linked_property ?? null,
    })

    if (response.success && response.data) {
      setAgentForms(current => current.map(item => item.id === formId ? response.data! : item))
      setFormSaveStatus(current => ({ ...current, [formId]: 'saved' }))
    } else {
      setFormSaveStatus(current => ({ ...current, [formId]: 'error' }))
    }
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
    const title = newFormTitle.trim()
    if (!title || creatingForm) return

    setCreatingForm(true)
    const response = await api.forms.createForm(title)
    if (response.success && response.data) {
      setAgentForms(current => [...current, response.data!].sort((a, b) => a.order_index - b.order_index))
      setNewFormTitle('')
      setFormEditorOpenId(response.data.id)
    }
    setCreatingForm(false)
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

  return (
    <main className="agent-hub-admin min-h-screen bg-[#faf9f7] text-[#111827] dark:bg-[#0B0B0B] dark:text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-[28px] border border-[#C9A24D]/20 bg-gradient-to-br from-white via-[#fdfbf5] to-[#f6ecd6] px-6 py-7 shadow-[0_20px_50px_-20px_rgba(201,162,77,0.35)] dark:border-white/5 dark:from-[#17181b] dark:via-[#131315] dark:to-[#0d0d0f] dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] md:flex-row md:items-start md:justify-between">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#C9A24D] via-[#e8cf8a] to-[#C9A24D]" />
          {isFormsTabGroup ? (
            <div className="relative flex items-start gap-4 text-center md:text-left">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#111827] text-[#C9A24D] shadow-lg ring-4 ring-[#C9A24D]/10 sm:flex dark:bg-white dark:text-[#8b7355] dark:ring-white/10">
                <FileText className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-[#111827] dark:text-white">Forms</h1>
                <p className="mt-3 max-w-md text-sm text-gray-600 dark:text-gray-400">Create and edit lead-capture forms tailored for real estate agents.</p>
              </div>
            </div>
          ) : (
            <div className="relative flex items-start gap-4 text-center md:text-left">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#111827] text-[#C9A24D] shadow-lg ring-4 ring-[#C9A24D]/10 sm:flex dark:bg-white dark:text-[#8b7355] dark:ring-white/10">
                <Globe className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-[#111827] dark:text-white">Agent Hub</h1>
                <p className="mt-3 max-w-md text-sm text-gray-600 dark:text-gray-400">Manage &amp; customize your public agent hub.</p>
              </div>
            </div>
          )}

          <div className="relative flex flex-col items-center gap-2">
            <div className="grid w-64 grid-cols-3 gap-1 rounded-2xl border border-gray-300 bg-white p-1 shadow-lg ring-1 ring-[#C9A24D]/15 dark:border-gray-600 dark:bg-[#0B0B0B] dark:ring-white/10 sm:w-72">
              {([
                ['Overview', 'Overview', () => setActiveTab('Overview')],
                ['Agent Hub', 'Agent Hub', () => setActiveTab(AGENT_HUB_SUBTABS[0])],
                ['Forms', 'Forms', () => setActiveTab(FORMS_SUBTABS[0].id)],
              ] as [string, typeof activeNavGroup, () => void][]).map(([label, group, onSelect]) => (
                <button
                  key={group}
                  onClick={onSelect}
                  className={`relative flex w-full items-center justify-center whitespace-nowrap rounded-xl px-1.5 py-2 text-center text-[11px] font-black transition-colors sm:px-3 sm:py-2.5 sm:text-sm ${activeNavGroup === group ? 'text-white dark:text-[#111827]' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {activeNavGroup === group && (
                    <motion.span
                      layoutId="agentHubMainNavPill"
                      className="absolute inset-0 rounded-xl bg-[#111827] shadow-sm dark:bg-[#C9A24D] dark:shadow-[0_0_14px_rgba(201,162,77,0.55)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              ))}
            </div>

            {activeNavGroup === 'Agent Hub' && (
              <div className="grid w-64 grid-cols-3 gap-1 rounded-full border border-gray-200 bg-white/70 p-1 dark:border-gray-700 dark:bg-white/5 sm:w-72">
                {AGENT_HUB_SUBTABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative flex w-full items-center justify-center whitespace-nowrap rounded-full px-1 py-1.5 text-center text-[9px] font-black uppercase transition-colors sm:px-2 sm:py-2 sm:text-[10px] ${activeTab === tab ? 'text-[#8b7355] dark:text-[#e8cf8a]' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                  >
                    {activeTab === tab && (
                      <motion.span
                        layoutId="agentHubSubNavPill"
                        className="absolute inset-0 rounded-full bg-[#C9A24D]/15"
                        transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                      />
                    )}
                    <span className="relative z-10">{tab}</span>
                  </button>
                ))}
              </div>
            )}

            {activeNavGroup === 'Forms' && (
              <div className="grid w-64 grid-cols-3 gap-1 rounded-full border border-gray-200 bg-white/70 p-1 dark:border-gray-700 dark:bg-white/5 sm:w-72">
                {FORMS_SUBTABS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`relative flex w-full items-center justify-center whitespace-nowrap rounded-full px-1 py-1.5 text-center text-[9px] font-black uppercase transition-colors sm:px-2 sm:py-2 sm:text-[10px] ${activeTab === id ? 'text-[#8b7355] dark:text-[#e8cf8a]' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                  >
                    {activeTab === id && (
                      <motion.span
                        layoutId="agentHubSubNavPill"
                        className="absolute inset-0 rounded-full bg-[#C9A24D]/15"
                        transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
        <motion.section
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-6 space-y-6"
        >
            {activeTab === 'Overview' && (
              <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbfaf3] p-5 shadow-sm dark:border-gray-800 dark:from-[#151517] dark:to-[#111113]">
                    <div className="relative flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white dark:text-[#8b7355]">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-tight dark:text-white">Agent Hub Overview</h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Last 30 days, compared with the prior 30.</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {[
                      { label: 'Visitors', value: visitorStats.current.toString(), note: formatPercentChange(visitorStats.percent), Icon: User },
                      { label: 'Filled Forms', value: formStats.current.toString(), note: formatPercentChange(formStats.percent), Icon: FileText },
                      { label: 'QR Scans', value: qrStats.current.toString(), note: formatPercentChange(qrStats.percent), Icon: QrCode },
                    ].map(({ label, value, note, Icon: StatIcon }) => {
                      const percent = Number(String(note).replace('%', ''))
                      const tone = percent > 0 ? 'text-emerald-600 dark:text-emerald-400' : percent < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'

                      return (
                      <div key={label} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-[#C9A24D]/40 hover:shadow-md dark:border-gray-800 dark:bg-[#151517] sm:p-5">
                        <div className="flex items-start gap-1.5 sm:items-center sm:gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#C9A24D]/15 text-[#8b7355] sm:h-8 sm:w-8">
                            <StatIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </div>
                          <p className="min-w-0 text-[10px] font-black uppercase leading-tight tracking-tight text-gray-400 sm:text-xs sm:tracking-widest">{label}</p>
                        </div>
                        <p className="mt-2 text-xl font-black dark:text-white sm:mt-3 sm:text-4xl">{value}</p>
                        <p className={`mt-1 text-xs font-black sm:mt-2 sm:text-sm ${tone}`}>{note}</p>
                      </div>
                    )})}
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                    <h3 className="text-lg font-black dark:text-white">Form Results</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Buying, Selling, and home-value form submissions from the last 30 days.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
                      {formGroups.map(({ label, formId, submissions }) => {
                        const pending = submissions.filter(submission => !submission.is_reviewed).length
                        return (
                        <button key={formId} onClick={() => setResultsModalFormId(formId)} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-[#C9A24D]/60 hover:shadow-md dark:border-gray-800 dark:bg-[#0B0B0B] sm:p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-black leading-tight dark:text-white">{label}</h4>
                            {pending > 0 && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{pending} new</span>}
                          </div>
                          <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
                            {submissions.length === 0 ? 'No submissions yet' : `Latest: ${new Date(submissions[0].created_at).toLocaleDateString()}`}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="rounded-full bg-[#C9A24D]/15 px-2.5 py-1 text-xs font-black text-[#8b7355]">{submissions.length} total</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                          </div>
                        </button>
                      )})}
                    </div>
                  </div>
              </div>
            )}

            {activeTab === 'Layout' && (
              <div className="grid gap-6 md:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]">
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbfaf3] shadow-sm dark:border-gray-800 dark:from-[#151517] dark:to-[#111113]">
                    <button
                      type="button"
                      onClick={() => setIsLayoutSectionsOpen(current => !current)}
                      className="relative flex w-full items-center justify-between gap-3 p-5 text-left"
                      aria-label={`${isLayoutSectionsOpen ? 'Collapse' : 'Expand'} Agent Hub Layout`}
                    >
                      <div className="relative flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white dark:text-[#8b7355]">
                          <LayoutGrid className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-lg font-black tracking-tight dark:text-white">Agent Hub Layout</h2>
                          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Drag sections into the order visitors should see them on your public page, and use the toggle to show or hide each one.</p>
                        </div>
                      </div>
                      <span className="rounded-xl border border-gray-200 p-3 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        <ChevronDown className={`h-5 w-5 transition ${isLayoutSectionsOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </button>

                    {isLayoutSectionsOpen && (
                      <div className="space-y-3 border-t border-gray-100 p-5 dark:border-gray-800">
                        {layoutSections.map((section, index) => (
                          (() => {
                            const hasContent = sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, blogCards)
                            const isShowing = section.visible && hasContent
                            return (
                          <div
                            key={section.id}
                            draggable
                            onDragStart={() => setDraggedSectionId(section.id)}
                            onDragOver={(event) => {
                              event.preventDefault()
                              moveDraggedSection(section.id)
                            }}
                            onDragEnd={() => setDraggedSectionId(null)}
                            className={`flex cursor-grab flex-col gap-3 rounded-2xl border p-4 shadow-sm transition active:cursor-grabbing sm:flex-row sm:flex-wrap sm:items-center ${
                              draggedSectionId === section.id
                                ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-md'
                                : 'border-gray-200 bg-white hover:border-[#C9A24D]/60 hover:shadow-md dark:border-gray-700 dark:bg-[#0B0B0B]'
                            }`}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <GripVertical className="h-5 w-5 shrink-0 text-gray-400" />
                              <div className="min-w-0 flex-1">
                                <p className="font-black dark:text-white">{index + 1}. {section.label}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{hasContent ? (isShowing ? 'Showing on public page' : 'Hidden from public page') : 'Empty - toggled off until content is added'}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toggleSectionVisibility(section.id)}
                              disabled={!hasContent}
                              className={`flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition sm:w-auto sm:justify-start ${
                                isShowing
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-400'
                                  : 'border-gray-200 bg-gray-100 text-gray-500 disabled:opacity-70 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-400'
                              }`}
                              aria-label={`${section.visible ? 'Hide' : 'Show'} ${section.label}`}
                              title={`${section.visible ? 'Hide' : 'Show'} ${section.label}`}
                            >
                              <span>{isShowing ? 'On' : 'Off'}</span>
                              <span className={`relative h-5 w-9 shrink-0 rounded-full ${isShowing ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-700'}`}>
                                <span className={`absolute top-1 h-3 w-3 rounded-full bg-white transition ${isShowing ? 'left-5' : 'left-1'}`} />
                              </span>
                            </button>
                          </div>
                            )
                          })()
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {layoutSections.map(section => {
                      if (section.id === 'sales') return <RecentSalesPanel key={section.id} reLicenseNumber={profile.licenseNumber} agentSales={recentSales} setAgentSales={setRecentSales} showStats={showSalesStats} setShowStats={setShowSalesStats} carousel={salesCarousel} setCarousel={setSalesCarousel} autoScroll={salesAutoScroll} setAutoScroll={setSalesAutoScroll} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'videos') return <VideoLinksPanel key={section.id} items={videoLinks} setItems={setVideoLinks} channelUrl={videoChannelUrl} setChannelUrl={setVideoChannelUrl} carousel={videosCarousel} setCarousel={setVideosCarousel} autoScroll={videosAutoScroll} setAutoScroll={setVideosAutoScroll} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'tours') return <HouseToursPanel key={section.id} items={houseTourLinks} setItems={setHouseTourLinks} houseTourUrl={houseTourUrl} setHouseTourUrl={setHouseTourUrl} carousel={toursCarousel} setCarousel={setToursCarousel} autoScroll={toursAutoScroll} setAutoScroll={setToursAutoScroll} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'blogs') return <BlogCardsPanel key={section.id} items={blogCards} setItems={setBlogCards} carousel={blogsCarousel} setCarousel={setBlogsCarousel} autoScroll={blogsAutoScroll} setAutoScroll={setBlogsAutoScroll} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      return null
                    })}
                  </div>
                </div>
                <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black dark:text-white">Live public preview</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Reflects draft changes before publication.</p>
                  </div>
                  <div className="mt-4 overflow-hidden">
                    <PublicPreview size="mobile" compact socialLinks={socialLinks} contact={contact} profilePhotoUrl={profilePhotoUrl} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} salesCarousel={salesCarousel} visitorDarkMode={visitorDarkMode} videosCarousel={videosCarousel} toursCarousel={toursCarousel} blogsCarousel={blogsCarousel} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={blogCards} agentForms={agentForms} agentHubPublicPath={agentHubPublicPath} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Editor' && (
              <div className="grid gap-6 md:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px]">
                <div className="space-y-5">
                  {editorGroups.map(group => {
                    const isSectionOpen = openEditorSection === group.title
                    const theme = EDITOR_SECTION_THEME[group.title]
                    return (
                    <div key={group.title} className={`overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-300 dark:bg-[#151517] ${isSectionOpen ? `${theme.border} ${theme.shadow}` : 'border-gray-200 shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800'}`}>
                      <button
                        onClick={() => setOpenEditorSection(isSectionOpen ? '' : group.title)}
                        className={`flex w-full items-center justify-between gap-3 bg-gradient-to-br p-5 text-left transition ${theme.wash}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-1 ${theme.iconChip} ${theme.ring}`}>
                            <group.icon className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black tracking-tight dark:text-white">{group.title}</h3>
                            <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{theme.subtitle}</p>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              <StatusPill status={getEditorSectionStatus(group.title)} />
                            </div>
                          </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wide shadow-sm transition dark:bg-[#0B0B0B] dark:text-white ${isSectionOpen ? theme.border : 'border-gray-200 dark:border-gray-700'}`}>
                          {isSectionOpen ? 'Close' : 'Edit'}
                          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition ${isSectionOpen ? 'rotate-180' : ''}`} />
                        </span>
                      </button>
                      {openEditorSection === group.title && (
                        <div className={`border-t bg-gradient-to-b p-5 dark:from-transparent ${theme.topBorder} from-[#fbfaf7]/50 to-transparent dark:border-gray-800`}>
                          {group.title === 'Social Links' && (
                            <div className="space-y-3">
                              {socialLinks.map(({ id, label, url, enabled, icon: Icon }) => (
                                <div key={id} className={`rounded-xl border p-3 transition ${enabled ? 'border-gray-200 bg-[#fbfaf7] dark:border-gray-700 dark:bg-[#0B0B0B]' : 'border-gray-100 bg-gray-50 opacity-75 dark:border-gray-800 dark:bg-[#111113]'}`}>
                                  <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#111827] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                                      <Icon className={`h-4 w-4 ${getSocialBrandClass(id)}`} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-black dark:text-white">{label}</p>
                                      <input
                                        value={url}
                                        disabled={!enabled}
                                        onChange={(event) => updateSocialLink(id, { url: event.target.value })}
                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-[#151517] dark:text-white dark:disabled:bg-[#0B0B0B] dark:disabled:text-gray-600"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateSocialLink(id, { enabled: !enabled })}
                                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                                      aria-label={`${enabled ? 'Turn off' : 'Turn on'} ${label}`}
                                    >
                                      <span className={`absolute top-1 h-5 w-5 rounded-full transition ${enabled ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                                    </button>
                                  </div>
                                  <p className="mt-2 pl-[52px] text-xs font-bold text-gray-500 dark:text-gray-400">
                                    {enabled ? 'Showing on public Agent Hub' : 'Hidden from public Agent Hub'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                          {group.title !== 'Social Links' && (
                          <div className="grid gap-3 md:grid-cols-2">
                              {group.fields.map(([label, value]) => (
                                <label key={label} className={`block ${label === 'Profile photo' ? 'md:col-span-2' : ''}`}>
                                  <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gray-400">
                                    {label}
                                    {((group.title === 'Contact') || (group.title === 'Profile' && label !== 'About me')) && <span className="text-red-500">*</span>}
                                    {label === 'RE License number' && (
                                      <span className="group relative inline-flex">
                                        <Info className="h-3.5 w-3.5 cursor-help text-gray-400" />
                                        <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-48 -translate-x-1/2 rounded-lg bg-[#111827] px-3 py-2 text-center text-xs font-bold normal-case tracking-normal text-white shadow-lg group-hover:block">
                                          This isn't shared publicly.
                                        </span>
                                      </span>
                                    )}
                                  </span>
                                  {label === 'Profile photo' ? (
                                    <div className="mt-2 flex items-center gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-[#0B0B0B]">
                                      <div className="h-16 w-16 rounded-full bg-cover bg-center ring-2 ring-[#C9A24D]/30" style={{ backgroundImage: `url(${profilePhotoUrl})` }} />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Current profile photo</p>
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          disabled={photoUploading}
                                          onChange={(event) => handleProfilePhotoChange(event.target.files?.[0])}
                                          className="mt-2 block w-full text-sm font-semibold file:mr-3 file:rounded-lg file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-sm file:font-black file:text-white disabled:opacity-50 dark:text-gray-300 dark:file:bg-white dark:file:text-[#111827]"
                                        />
                                        {photoUploading && <p className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</p>}
                                        {photoError && <p className="mt-2 text-xs font-bold text-red-600">{photoError}</p>}
                                      </div>
                                    </div>
                                  ) : label === 'About me' ? (
                                    <textarea
                                      value={getProfileFieldValue(label, value)}
                                      onChange={(event) => updateProfileField(label, event.target.value)}
                                      placeholder="Add a short, helpful introduction for your public Agent Hub"
                                      rows={5}
                                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                                    />
                                  ) : (
                                    <input
                                      value={group.title === 'Profile' ? getProfileFieldValue(label, value) : getContactFieldValue(label, value)}
                                      onChange={(event) => group.title === 'Profile' ? updateProfileField(label, event.target.value) : updateContactField(label, event.target.value)}
                                      placeholder={group.title === 'Profile' && (label === 'Agent name' || label === 'Brokerage name') ? 'Filled from your account when available' : 'Add details'}
                                      required={group.title === 'Contact' || (group.title === 'Profile' && label !== 'About me')}
                                      className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
                                    />
                                  )}
                                  {label === 'RE License number' && (
                                    <div className="mt-3 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4 dark:border-gray-700 dark:bg-[#0B0B0B]">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <label className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-gray-400">
                                            Visitor dark mode
                                            <span className="group relative inline-flex">
                                              <Info className="h-3.5 w-3.5 cursor-help text-gray-400" />
                                              <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-52 -translate-x-1/2 rounded-lg bg-[#111827] px-3 py-2 text-center text-xs font-bold normal-case tracking-normal text-white shadow-lg group-hover:block">
                                                Makes the Agent Hub and sales page dark mode for that agent&apos;s visitors.
                                              </span>
                                            </span>
                                          </label>
                                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Applies to the public hub and sales page for visitors.</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setVisitorDarkMode(current => !current)
                                            setSaveStatus('Unsaved Changes')
                                          }}
                                          className={`relative h-7 w-12 shrink-0 rounded-full transition ${visitorDarkMode ? 'bg-[#111827] dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                                          aria-label={visitorDarkMode ? 'Turn off visitor dark mode' : 'Turn on visitor dark mode'}
                                          title={visitorDarkMode ? 'Turn off visitor dark mode' : 'Turn on visitor dark mode'}
                                        >
                                          <span className={`absolute top-1 h-5 w-5 rounded-full transition ${visitorDarkMode ? 'left-6 bg-white dark:bg-[#111827]' : 'left-1 bg-white'}`} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </label>
                              ))}
                          </div>
                          )}
                          <div className="mt-6 flex justify-end">
                            <button
                              onClick={() => {
                                handleSaveAgentHubChanges()
                                setOpenEditorSection('')
                              }}
                              className="rounded-xl bg-[#111827] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
                            >
                              <Save className="mr-1.5 inline h-4 w-4" /> Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
                <div className="sticky top-4 h-fit min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black dark:text-white">Live public preview</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Updates as you edit profile, contact, and social links.</p>
                  </div>
                  <div className="mt-4 overflow-hidden">
                    <PublicPreview size="mobile" compact socialLinks={socialLinks} contact={contact} profilePhotoUrl={profilePhotoUrl} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} salesCarousel={salesCarousel} visitorDarkMode={visitorDarkMode} videosCarousel={videosCarousel} toursCarousel={toursCarousel} blogsCarousel={blogsCarousel} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={blogCards} agentForms={agentForms} agentHubPublicPath={agentHubPublicPath} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'My Forms' && (
              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-2xl border-2 border-[#C9A24D] bg-gradient-to-br from-white to-[#fbfaf3] p-5 shadow-sm dark:border-[#C9A24D] dark:from-[#151517] dark:to-[#111113]">
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3 sm:max-w-[15rem] lg:max-w-xs">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white dark:text-[#8b7355]">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-black tracking-tight dark:text-white">New Form</h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Name it, then customize the questions in the builder.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-1 sm:flex-nowrap">
                      <input
                        value={newFormTitle}
                        onChange={(event) => setNewFormTitle(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') handleCreateForm() }}
                        placeholder="New form name, e.g. Rental Inquiry"
                        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white sm:min-w-[220px]"
                      />
                      <button
                        onClick={handleCreateForm}
                        disabled={!newFormTitle.trim() || creatingForm}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
                      >
                        {creatingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create Form
                      </button>
                    </div>
                  </div>
                </div>

                {formsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
                ) : (
                  <>
                    <div>
                      <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Premade Forms</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {premadeForms.map(form => renderFormCard(form))}
                      </div>
                      {onboardingForms.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {onboardingForms.map(form => renderFormCard(form, { big: true }))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Custom Forms</h3>
                      {customForms.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No custom forms yet - create one above.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {customForms.map(form => renderFormCard(form))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'Share Forms' && (
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbfaf3] p-5 shadow-sm dark:border-gray-800 dark:from-[#151517] dark:to-[#111113]">
                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white dark:text-[#8b7355]">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight dark:text-white">Share</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Copy a link or download a QR code for each form.</p>
                  </div>
                </div>
                {formsLoading ? (
                  <div className="relative mt-5 flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
                ) : (
                  <div className="relative mt-5 space-y-6">
                    <div>
                      <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Premade Forms</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {premadeForms.map(form => renderShareCard(form))}
                      </div>
                      {onboardingForms.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {onboardingForms.map(form => renderShareCard(form))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Custom Forms</h3>
                      {customForms.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No custom forms yet.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {customForms.map(form => renderShareCard(form))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Forms Results' && (
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbfaf3] p-5 shadow-sm dark:border-gray-800 dark:from-[#151517] dark:to-[#111113]">
                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white dark:text-[#8b7355]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight dark:text-white">Results</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Review submissions from each form.</p>
                  </div>
                </div>
                {formsLoading ? (
                  <div className="relative mt-5 flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
                ) : (
                  <div className="relative mt-5 space-y-6">
                    <div>
                      <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Premade Forms</h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {formGroups.filter(group => group.formType !== 'custom' && !ONBOARDING_FORM_TYPES.has(group.formType)).map(group => renderResultsCard(group))}
                      </div>
                      {formGroups.filter(group => ONBOARDING_FORM_TYPES.has(group.formType)).length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {formGroups.filter(group => ONBOARDING_FORM_TYPES.has(group.formType)).map(group => renderResultsCard(group))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Custom Forms</h3>
                      {formGroups.filter(group => group.formType === 'custom').length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No custom forms yet.</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {formGroups.filter(group => group.formType === 'custom').map(group => renderResultsCard(group))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Public URL' && (
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-[#fbfaf3] p-5 shadow-sm dark:border-gray-800 dark:from-[#151517] dark:to-[#111113]">
                <div className="relative flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] shadow-sm dark:bg-white dark:text-[#8b7355]">
                    <LinkIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight dark:text-white">Public URL</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Letters, numbers, and hyphens only. No spaces or unsupported symbols.</p>
                  </div>
                </div>

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
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <button onClick={handleCopyPublicUrl} className="rounded-xl border border-gray-200 px-4 py-3 font-bold transition hover:border-gray-300 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:border-gray-600"><Copy className="inline h-4 w-4" /> Copy URL</button>
                  <button onClick={handleOpenPublicPage} className="rounded-xl border border-gray-200 px-4 py-3 font-bold transition hover:border-gray-300 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:border-gray-600"><Globe className="inline h-4 w-4" /> Open Public Page</button>
                  <button onClick={handleSharePublicUrl} className="rounded-xl border border-gray-200 px-4 py-3 font-bold transition hover:border-gray-300 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:border-gray-600"><Share2 className="inline h-4 w-4" /> Share URL</button>
                </div>
              </div>
            )}

            {activeTab === 'Preview' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">Preview Agent Hub</h2>
                    <p className="mt-1 text-gray-600">Draft changes are shown here before saving.</p>
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
                <div className="mt-6 overflow-auto rounded-2xl bg-[#f2efe8] p-4">
                  <PublicPreview size={previewSize} socialLinks={socialLinks} contact={contact} profilePhotoUrl={profilePhotoUrl} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} salesCarousel={salesCarousel} visitorDarkMode={visitorDarkMode} videosCarousel={videosCarousel} toursCarousel={toursCarousel} blogsCarousel={blogsCarousel} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={blogCards} agentForms={agentForms} agentHubPublicPath={agentHubPublicPath} />
                </div>
              </div>
            )}
        </motion.section>
        </AnimatePresence>
      </div>

      <FormResultsModal
        isOpen={Boolean(resultsModalFormId)}
        onClose={() => setResultsModalFormId('')}
        form={agentForms.find(form => form.id === resultsModalFormId) || null}
        submissions={formSubmissionsByFormId[resultsModalFormId] || []}
        isLoading={Boolean(submissionsLoadingByFormId[resultsModalFormId])}
        onToggleReviewed={async (submissionId, isReviewed) => {
          await api.forms.markReviewed(submissionId, isReviewed)
          if (resultsModalFormId) refreshFormSubmissions(resultsModalFormId)
        }}
        onDeleteSubmission={(submission) => setDeleteSubmissionTarget(submission)}
      />

      <FormBuilderModal
        isOpen={isBuilderOpen}
        form={agentForms.find(form => form.id === formEditorOpenId) || null}
        onClose={() => setIsBuilderOpen(false)}
        onUpdateField={(field, value) => updateFormField(formEditorOpenId, field, value)}
        onToggleBranding={() => toggleFormBranding(formEditorOpenId)}
        onToggleDarkMode={() => toggleFormDarkMode(formEditorOpenId)}
        onToggleRedirectToAgentHub={() => toggleFormRedirect(formEditorOpenId)}
        onTogglePropertyPhotoCarousel={() => toggleFormPropertyPhotoCarousel(formEditorOpenId)}
        onUpdateBrandingLayout={(layout) => updateFormBrandingLayout(formEditorOpenId, layout)}
        onUpdateLinkedProperty={(property) => updateFormLinkedProperty(formEditorOpenId, property)}
        onUpdateQuestion={(questionId, updates) => updateFormQuestion(formEditorOpenId, questionId, updates)}
        onAddQuestion={(type) => addFormQuestion(formEditorOpenId, type)}
        onRemoveQuestion={(questionId) => removeFormQuestion(formEditorOpenId, questionId)}
        onReorderQuestions={(draggedId, targetId) => reorderFormQuestions(formEditorOpenId, draggedId, targetId)}
        onSave={() => saveForm(formEditorOpenId)}
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

function FormQrCode({ url, size = 168, onDownloadReady }: { url: string; size?: number; onDownloadReady?: (fn: () => void) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compact = size < 100

  useEffect(() => {
    if (!canvasRef.current) return
    const qrUrl = `${url}${url.includes('?') ? '&' : '?'}src=qr`
    QRCode.toCanvas(canvasRef.current, qrUrl, { width: size, margin: 1, color: { dark: '#111827', light: '#ffffff' } }).catch(() => {})
  }, [url, size])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = 'form-qr-code.png'
      link.click()
      URL.revokeObjectURL(objectUrl)
    })
  }

  useEffect(() => {
    onDownloadReady?.(handleDownload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDownloadReady])

  if (compact) {
    return (
      <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-white">
        <canvas ref={canvasRef} className="rounded" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4">
      <canvas ref={canvasRef} className="rounded-lg" />
      <button onClick={handleDownload} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black">
        <Download className="h-4 w-4" /> Download QR
      </button>
    </div>
  )
}

function RecentSalesPanel({ reLicenseNumber, agentSales, setAgentSales, showStats, setShowStats, carousel, setCarousel, autoScroll, setAutoScroll, onChange, onSave }: { agentSales: AgentSale[]; reLicenseNumber: string; setAgentSales: React.Dispatch<React.SetStateAction<AgentSale[]>>; showStats: boolean; setShowStats: React.Dispatch<React.SetStateAction<boolean>>; carousel: boolean; setCarousel: React.Dispatch<React.SetStateAction<boolean>>; autoScroll: boolean; setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'recentSales' | 'showSalesStats' | 'salesCarousel' | 'salesAutoScroll'>>) => void }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [sortMode, setSortMode] = useState<'recent' | 'price-high' | 'price-low'>('recent')
  const [page, setPage] = useState(1)
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [manualSaleDraft, setManualSaleDraft] = useState({
    street: '',
    city: '',
    state: '',
    zipcode: '',
    price: '',
    closedDate: '',
    image: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pageSize = 6
  const eligibleAgentSales = getEligibleSales(agentSales)
  const sortedSales = useMemo(() => {
    const sortable = [...eligibleAgentSales]
    if (sortMode === 'price-high') return sortable.sort((a, b) => (b.price || 0) - (a.price || 0))
    if (sortMode === 'price-low') return sortable.sort((a, b) => (a.price || 0) - (b.price || 0))
    return sortable.sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))
  }, [eligibleAgentSales, sortMode])
  const totalPages = Math.max(1, Math.ceil(sortedSales.length / pageSize))
  const visibleCount = eligibleAgentSales.filter(sale => sale.visible).length
  const pagedSales = sortedSales.slice((page - 1) * pageSize, page * pageSize)
  const pageNumbers = useMemo(() => {
    const maxButtons = 4
    const start = Math.min(Math.max(1, page - 1), Math.max(1, totalPages - maxButtons + 1))
    return Array.from({ length: Math.min(maxButtons, totalPages) }, (_, index) => start + index)
  }, [page, totalPages])

  const loadSales = async () => {
    setIsLoading(true)
    const response = await api.agentHub.getRecentSales(reLicenseNumber)
    const fetchedSales = getEligibleSales(response.success && response.data ? response.data : [])
    const currentById = new Map(agentSales.map(sale => [sale.id, sale]))
    const mergedFetched = fetchedSales.map(sale => ({
      ...sale,
      source: 'bright' as const,
      visible: currentById.get(sale.id)?.visible ?? shouldAutoShowSale(sale),
    }))
    const nextSales = mergedFetched.sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))
    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
    setPage(1)
    setIsLoading(false)
  }

  useEffect(() => {
    if (!getEligibleSales(agentSales).length) loadSales()
  }, [reLicenseNumber])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleSale = (id: string) => {
    const nextSales = getEligibleSales(agentSales).map(sale => sale.id === id ? { ...sale, visible: !sale.visible } : sale)
    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
  }

  const deleteManualSale = (id: string) => {
    const nextSales = getEligibleSales(agentSales).filter(sale => sale.id !== id)
    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
    setPage(1)
  }

  const updateManualDraft = (field: keyof typeof manualSaleDraft, value: string) => {
    setManualSaleDraft(current => ({ ...current, [field]: value }))
    onChange()
  }

  const handleManualPhoto = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      updateManualDraft('image', String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const addManualSale = () => {
    const street = manualSaleDraft.street.trim()
    const city = manualSaleDraft.city.trim()
    const state = manualSaleDraft.state.trim().toUpperCase()
    const zipcode = manualSaleDraft.zipcode.trim()
    const price = Number(String(manualSaleDraft.price).replace(/[^0-9.]/g, ''))
    const closedDate = manualSaleDraft.closedDate.trim()
    if (!street || !city || !state || !zipcode || !price || !closedDate || !manualSaleDraft.image.trim()) return

    const address = `${street}, ${city}, ${state} ${zipcode}`
    const nextSale: AgentSale = {
      id: `manual-${Date.now()}`,
      address,
      city,
      state,
      zipcode,
      price,
      status: 'Sold',
      image: manualSaleDraft.image,
      sold_date: closedDate,
      visible: true,
      source: 'manual',
    }

    const nextSales = [...getEligibleSales(agentSales), nextSale].sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))
    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
    setManualSaleDraft({ street: '', city: '', state: '', zipcode: '', price: '', closedDate: '', image: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
    setManualAddOpen(false)
    setPage(1)
  }

  return (
    <section className={`overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-300 dark:bg-[#151517] ${isOpen ? 'border-emerald-400/50 shadow-[0_18px_44px_-18px_rgba(16,185,129,0.45)]' : 'border-gray-200 shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800'}`}>
      <div className="grid w-full grid-cols-[1fr_auto] items-start gap-4 bg-gradient-to-br from-emerald-500/10 via-white to-white p-5 dark:from-emerald-500/10 dark:via-[#151517] dark:to-[#151517]">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 text-emerald-700 shadow-inner ring-1 ring-emerald-500/30 dark:text-emerald-400">
            <DollarSign className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-xl font-black dark:text-white">Recent Sales</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Pulled from your listing data based on your agent profile.</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300">{visibleCount}/{eligibleAgentSales.length}</span>
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 bg-white p-3 text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400" aria-label={`${isOpen ? 'Collapse' : 'Expand'} Recent Sales`}>
            <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-gray-100 bg-[#fbfaf7] p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-300">Choose which sales appear on your public Agent Hub.</p>
            <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <button type="button" className="text-gray-400 dark:text-gray-300" title="Will display your homes sold, avg price, and volume.">
                    <Info className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Show stats</span>
                  <button
                    onClick={() => {
                      setShowStats(current => !current)
                      onSave({ showSalesStats: !showStats, recentSales: agentSales })
                      onChange()
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${showStats ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={showStats ? 'Hide sales stats' : 'Show sales stats'}
                    title={showStats ? 'Hide sales stats' : 'Show sales stats'}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${showStats ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <button type="button" className="text-gray-400 dark:text-gray-300" title="Auto-swipes through one large sale at a time instead of a scrolling row. Mobile view only.">
                    <Info className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Carousel view</span>
                  <button
                    onClick={() => {
                      setCarousel(current => !current)
                      onSave({ salesCarousel: !carousel, recentSales: agentSales })
                      onChange()
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${carousel ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={carousel ? 'Turn off carousel view' : 'Turn on carousel view'}
                    title={carousel ? 'Turn off carousel view' : 'Turn on carousel view'}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${carousel ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800">
                  <button type="button" className="text-gray-400 dark:text-gray-300" title="Auto scrolls through sales, my videos, tours and blogs if at least 5 are linked.">
                    <Info className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Auto scroll</span>
                  <button
                    onClick={() => {
                      setAutoScroll(current => !current)
                      onSave({ salesAutoScroll: !autoScroll, recentSales: agentSales })
                      onChange()
                    }}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${autoScroll ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={autoScroll ? 'Turn off auto scroll' : 'Turn on auto scroll'}
                    title={autoScroll ? 'Turn off auto scroll' : 'Turn on auto scroll'}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${autoScroll ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <select value={sortMode} onChange={event => { setSortMode(event.target.value as 'recent' | 'price-high' | 'price-low'); setPage(1) }} className="rounded-xl border border-gray-200 bg-[#fbfaf7] px-3 py-2.5 text-sm font-black text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="recent">Newest</option>
                  <option value="price-high">Price High</option>
                  <option value="price-low">Price Low</option>
                </select>
                <button onClick={() => setManualAddOpen(current => !current)} className={`rounded-xl border px-3.5 py-2.5 text-sm font-black shadow-sm ${manualAddOpen ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355]' : 'border-gray-200 bg-[#fbfaf7] text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white'}`}>
                  Manually Add
                </button>
                <button onClick={loadSales} disabled={isLoading} className="rounded-xl bg-[#111827] px-3.5 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-60">{isLoading ? 'Refreshing...' : 'Refresh Sales'}</button>
              </div>
            </div>
          </div>

          {manualAddOpen && (
            <div className="mt-4 rounded-2xl border border-[#C9A24D]/30 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Street Address</span>
                  <input
                    value={manualSaleDraft.street}
                    onChange={(event) => updateManualDraft('street', event.target.value)}
                    placeholder="123 Main Street"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">City</span>
                  <input
                    value={manualSaleDraft.city}
                    onChange={(event) => updateManualDraft('city', event.target.value)}
                    placeholder="Dover"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">State</span>
                  <input
                    value={manualSaleDraft.state}
                    onChange={(event) => updateManualDraft('state', event.target.value)}
                    placeholder="PA"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold uppercase outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Zip</span>
                  <input
                    value={manualSaleDraft.zipcode}
                    onChange={(event) => updateManualDraft('zipcode', event.target.value)}
                    placeholder="19000"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Price</span>
                  <input
                    inputMode="decimal"
                    value={manualSaleDraft.price}
                    onChange={(event) => updateManualDraft('price', event.target.value)}
                    placeholder="1,000,000"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Date Closed</span>
                  <input
                    type="date"
                    value={manualSaleDraft.closedDate}
                    onChange={(event) => updateManualDraft('closedDate', event.target.value)}
                    placeholder="mm/dd/yyyy"
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">Photo</span>
                  <div className="mt-2 flex items-center gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-gray-800">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-cover bg-center" style={{ backgroundImage: manualSaleDraft.image ? `url(${manualSaleDraft.image})` : 'none' }} />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleManualPhoto(event.target.files?.[0])}
                      className="block w-full text-sm font-semibold file:mr-3 file:rounded-lg file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-sm file:font-black file:text-white"
                    />
                  </div>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addManualSale}
                  className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow-sm"
                >
                  Add Sold Property
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualAddOpen(false)
                    setManualSaleDraft({ street: '', city: '', state: '', zipcode: '', price: '', closedDate: '', image: '' })
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mt-4 max-h-[640px] space-y-2 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {isLoading ? (
              <div className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500">Finding your recent sales...</div>
            ) : eligibleAgentSales.length ? (
              pagedSales.map(sale => (
                <div key={sale.id} className={`grid grid-cols-[56px_1fr_100px] items-center gap-2 rounded-xl border p-2.5 sm:grid-cols-[68px_1fr_118px] sm:gap-3 ${sale.visible ? 'border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900' : 'border-dashed border-gray-300 bg-gray-100 shadow-inner dark:border-gray-700 dark:bg-gray-950'}`}>
                  <div className={`h-14 w-14 shrink-0 rounded-lg bg-cover bg-center sm:w-[68px] ${sale.visible ? '' : 'grayscale opacity-60'}`} style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }} />
                  <div className="min-w-0 self-center">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                      {sale.source === 'manual' && <span className="rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355]">Manual</span>}
                    </div>
                    <p className={`truncate text-sm font-black leading-snug ${sale.visible ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{getStreetOnly(sale.address)}</p>
                    <p className={`mt-1 truncate text-sm font-semibold ${sale.visible ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>{[sale.city, sale.state].filter(Boolean).join(', ') || 'Location unavailable'}</p>
                  </div>
                  <div className="self-center text-right">
                    <p className={`text-sm font-black ${sale.visible ? 'text-[#8b7355]' : 'text-gray-400 dark:text-gray-500'}`}>{sale.price ? `$${sale.price.toLocaleString()}` : 'No price'}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                      {sale.source === 'manual' && (
                        <button
                          type="button"
                          onClick={() => deleteManualSale(sale.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700"
                          aria-label="Delete manual sale"
                          title="Delete manual sale"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleSale(sale.id)}
                        className={`rounded-lg border px-3 py-2 text-xs font-black ${sale.visible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-300 bg-gray-200 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'}`}
                      >
                        {sale.visible ? 'Shown' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500">
                {reLicenseNumber.trim() ? 'No matching sales or listings found for this RE License number yet.' : 'Enter your RE License number in Profile, then sales and listings will populate here.'}
              </div>
            )}
          </div>

          {eligibleAgentSales.length > pageSize && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <span className="min-w-[96px] whitespace-nowrap leading-6">Page {page} of {totalPages}</span>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700" aria-label="Previous sales page">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
                {pageNumbers[0] > 1 && <span className="px-1 text-gray-400">...</span>}
                {pageNumbers.map(pageNumber => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={`min-w-10 rounded-lg border px-3 py-2 ${pageNumber === page ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355]' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                  >
                    {pageNumber}
                  </button>
                ))}
                {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="px-1 text-gray-400">...</span>}
                <button onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700" aria-label="Next sales page">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function VideoLinksPanel({ items, setItems, channelUrl, setChannelUrl, carousel, setCarousel, autoScroll, setAutoScroll, onChange, onSave }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; channelUrl: string; setChannelUrl: React.Dispatch<React.SetStateAction<string>>; carousel: boolean; setCarousel: React.Dispatch<React.SetStateAction<boolean>>; autoScroll: boolean; setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'videoLinks' | 'videoChannelUrl' | 'videosCarousel' | 'videosAutoScroll'>>) => void }) {
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
    onSave({ videoLinks: items, videoChannelUrl: channelUrl })
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
      setItems(response.data.videos)
      onSave({ videoLinks: response.data.videos, videoChannelUrl: draftChannelUrl })
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
      accent="bg-gradient-to-br from-rose-500/30 to-rose-500/10 text-rose-700 dark:text-rose-400"
      wash="from-rose-500/10 via-white to-white dark:from-rose-500/10 dark:via-[#151517] dark:to-[#151517]"
      ring="ring-rose-500/30"
      openBorder="border-rose-400/50"
      openShadow="shadow-[0_18px_44px_-18px_rgba(244,63,94,0.45)]"
      onAdd={addVideo}
      summary="Connect a YouTube channel and paste individual YouTube links."
      carousel={carousel}
      onToggleCarousel={() => { setCarousel(current => !current); onSave({ videosCarousel: !carousel, videoLinks: items, videoChannelUrl: channelUrl }); onChange() }}
      autoScroll={autoScroll}
      onToggleAutoScroll={() => { setAutoScroll(current => !current); onSave({ videosAutoScroll: !autoScroll, videoLinks: items, videoChannelUrl: channelUrl }); onChange() }}
    >
      <div className={`rounded-2xl border bg-white p-4 shadow-sm ${channelIsSaved ? 'border-emerald-200' : 'border-red-100'}`}>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">YouTube channel link</span>
          <input value={draftChannelUrl} onChange={event => setDraftChannelUrl(event.target.value)} placeholder="https://www.youtube.com/@example" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
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
              <button onClick={() => deleteVideo(item.id)} className="w-full rounded-xl border border-red-200 bg-white py-2 text-sm font-black text-red-600">
                <Trash2 className="inline h-4 w-4" /> Delete
              </button>
            </div>
          </motion.div>
          )
        })}
      </div>
    </EditableContentPanel>
  )
}

function HouseToursPanel({ items, setItems, houseTourUrl, setHouseTourUrl, carousel, setCarousel, autoScroll, setAutoScroll, onSave }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; houseTourUrl: string; setHouseTourUrl: React.Dispatch<React.SetStateAction<string>>; carousel: boolean; setCarousel: React.Dispatch<React.SetStateAction<boolean>>; autoScroll: boolean; setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'houseTourLinks' | 'houseTourUrl' | 'toursCarousel' | 'toursAutoScroll'>>) => void }) {
  const [isOpen, setIsOpen] = useState(false)
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
    onSave({ houseTourLinks: items, houseTourUrl })
  }

  const addTour = () => {
    const newId = `tour-${Date.now()}`
    saveItems([...items, { id: newId, title: 'House Tour', link: '' }])
    setIsOpen(true)
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
      setItems(response.data.videos)
      setHouseTourUrl(draftHouseTourUrl)
      setSavedHouseTourUrl(draftHouseTourUrl)
      onSave({ houseTourLinks: response.data.videos, houseTourUrl: draftHouseTourUrl })
      setPlaylistMessage(`Loaded ${response.data.videos.length} recent tours.`)
    } else {
      setPlaylistMessage(response.error || 'Could not load videos from this playlist.')
    }
    setIsLoadingPlaylist(false)
  }

  return (
    <section className={`overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-300 dark:bg-[#151517] ${isOpen ? 'border-sky-400/50 shadow-[0_18px_44px_-18px_rgba(14,165,233,0.45)]' : 'border-gray-200 shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800'}`}>
      <div className="grid w-full grid-cols-[1fr_auto] items-start gap-4 bg-gradient-to-br from-sky-500/10 via-white to-white p-5 dark:from-sky-500/10 dark:via-[#151517] dark:to-[#151517]">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/30 to-sky-500/10 text-sky-700 shadow-inner ring-1 ring-sky-500/30 dark:text-sky-400">
            <Play className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h3 className="text-xl font-black dark:text-white">House Tours</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">Paste individual YouTube tour links.</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300">{visibleItems.length} tours</span>
          {isOpen && (
            <button onClick={addTour} className="hidden items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-[#111827] sm:inline-flex">
              <Plus className="h-4 w-4" /> Add Tour
            </button>
          )}
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 bg-white p-3 text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400" aria-label={`${isOpen ? 'Collapse' : 'Expand'} House Tours`}>
            <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="space-y-3 border-t border-gray-100 bg-[#fbfaf7] p-5">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <button type="button" className="text-gray-400" title="Auto-swipes through one large tour at a time instead of a scrolling row. Mobile view only.">
                <Info className="h-4 w-4" />
              </button>
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">Carousel view</span>
              <button
                onClick={() => { setCarousel(current => !current); onSave({ toursCarousel: !carousel, houseTourLinks: items, houseTourUrl }) }}
                className={`relative h-6 w-11 rounded-full transition ${carousel ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                aria-label={carousel ? 'Turn off carousel view' : 'Turn on carousel view'}
                title={carousel ? 'Turn off carousel view' : 'Turn on carousel view'}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${carousel ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <button type="button" className="text-gray-400" title="Auto scrolls through sales, my videos, tours and blogs if at least 5 are linked.">
                <Info className="h-4 w-4" />
              </button>
              <span className="text-xs font-black uppercase tracking-widest text-gray-500">Auto scroll</span>
              <button
                onClick={() => { setAutoScroll(current => !current); onSave({ toursAutoScroll: !autoScroll, houseTourLinks: items, houseTourUrl }) }}
                className={`relative h-6 w-11 rounded-full transition ${autoScroll ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                aria-label={autoScroll ? 'Turn off auto scroll' : 'Turn on auto scroll'}
                title={autoScroll ? 'Turn off auto scroll' : 'Turn on auto scroll'}
              >
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${autoScroll ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <button onClick={addTour} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white sm:hidden">
              <Plus className="h-4 w-4" /> Add Tour
            </button>
          </div>
          <div className={`rounded-2xl border bg-white p-4 shadow-sm ${houseTourIsSaved ? 'border-emerald-200' : 'border-[#C9A24D]/30'}`}>
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
                  <button onClick={() => deleteTour(item.id)} className="w-full rounded-xl border border-red-200 bg-white py-2 text-sm font-black text-red-600">
                    <Trash2 className="inline h-4 w-4" /> Delete
                  </button>
                </div>
              </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function BlogCardsPanel({ items, setItems, carousel, setCarousel, autoScroll, setAutoScroll, onChange, onSave }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; carousel: boolean; setCarousel: React.Dispatch<React.SetStateAction<boolean>>; autoScroll: boolean; setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'blogCards' | 'blogsCarousel' | 'blogsAutoScroll'>>) => void }) {
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

  return (
    <EditableContentPanel
      title="Blogs"
      action="Add Blog"
      count={`${items.filter(item => item.link?.trim() || item.title.trim()).length} blogs`}
      icon={BookOpen}
      accent="bg-gradient-to-br from-[#C9A24D]/30 to-[#C9A24D]/10 text-[#8b7355]"
      wash="from-[#C9A24D]/12 via-white to-white dark:from-[#C9A24D]/10 dark:via-[#151517] dark:to-[#151517]"
      ring="ring-[#C9A24D]/30"
      openBorder="border-[#C9A24D]/50"
      openShadow="shadow-[0_18px_44px_-18px_rgba(201,162,77,0.45)]"
      onAdd={addBlog}
      summary="Paste a blog link. The title and image will be pulled from the link."
      carousel={carousel}
      onToggleCarousel={() => { setCarousel(current => !current); onSave({ blogsCarousel: !carousel, blogCards: items }); onChange() }}
      autoScroll={autoScroll}
      onToggleAutoScroll={() => { setAutoScroll(current => !current); onSave({ blogsAutoScroll: !autoScroll, blogCards: items }); onChange() }}
    >
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
              <div className="aspect-video w-full rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
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

function EditableContentPanel({ title, action, count, icon: Icon, accent, wash, ring, openBorder, openShadow, summary, onAdd, carousel, onToggleCarousel, autoScroll, onToggleAutoScroll, children }: { title: string; action?: string; count?: string; icon: React.ComponentType<{ className?: string }>; accent: string; wash: string; ring: string; openBorder: string; openShadow: string; summary: string; onAdd?: () => void; carousel?: boolean; onToggleCarousel?: () => void; autoScroll?: boolean; onToggleAutoScroll?: () => void; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className={`overflow-hidden rounded-[1.75rem] border bg-white transition-all duration-300 dark:bg-[#151517] ${isOpen ? `${openBorder} ${openShadow}` : 'border-gray-200 shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800'}`}>
      <div className={`grid w-full grid-cols-[1fr_auto] items-start gap-4 bg-gradient-to-br p-5 ${wash}`}>
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-1 ${accent} ${ring}`}><Icon className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h3 className="text-xl font-black dark:text-white">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">{summary}</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {count && <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300">{count}</span>}
          {isOpen && action && onAdd && <button onClick={onAdd} className="hidden items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-[#111827] sm:inline-flex"><Plus className="h-4 w-4" /> {action}</button>}
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 bg-white p-3 text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400" aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}>
            <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="space-y-3 border-t border-gray-100 bg-[#fbfaf7] p-5 dark:border-gray-800 dark:bg-[#0B0B0B]">
          {(onToggleCarousel || onToggleAutoScroll || (action && onAdd)) && (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {onToggleCarousel && (
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-[#151517]">
                  <button type="button" className="text-gray-400 dark:text-gray-300" title="Auto-swipes through one large item at a time instead of a scrolling row. Mobile view only.">
                    <Info className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Carousel view</span>
                  <button
                    onClick={onToggleCarousel}
                    className={`relative h-6 w-11 rounded-full transition ${carousel ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={carousel ? 'Turn off carousel view' : 'Turn on carousel view'}
                    title={carousel ? 'Turn off carousel view' : 'Turn on carousel view'}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${carousel ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              )}
              {onToggleAutoScroll && (
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-[#151517]">
                  <button type="button" className="text-gray-400 dark:text-gray-300" title="Auto scrolls through sales, my videos, tours and blogs if at least 5 are linked.">
                    <Info className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-300">Auto scroll</span>
                  <button
                    onClick={onToggleAutoScroll}
                    className={`relative h-6 w-11 rounded-full transition ${autoScroll ? 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                    aria-label={autoScroll ? 'Turn off auto scroll' : 'Turn on auto scroll'}
                    title={autoScroll ? 'Turn off auto scroll' : 'Turn on auto scroll'}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${autoScroll ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              )}
              {action && onAdd && <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-[#111827] sm:hidden"><Plus className="h-4 w-4" /> {action}</button>}
            </div>
          )}
          {children}
        </div>
      )}
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
