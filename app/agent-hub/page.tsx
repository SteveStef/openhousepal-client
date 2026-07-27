'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api-service'
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  Facebook,
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
  Send,
  Share2,
  Smartphone,
  Star,
  Tablet,
  Trash2,
  User,
  Video,
  X,
  ChevronDown,
  ChevronRight,
  GripVertical,
  DollarSign,
  TrendingUp,
  Youtube,
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

const getFormSlug = (form: string) => {
  if (form === "What's My Home Worth?") return 'home-value'
  return form.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

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
  if (clean === 'active') return 'bg-emerald-500'
  if (clean === 'pending' || clean === 'coming soon') return 'bg-amber-500'
  if (clean === 'off market') return 'bg-gray-500'
  if (clean === 'sold') return 'bg-rose-500'
  return 'bg-[#8b7355]'
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
  const tone = status === 'Complete' || status === 'Published' || status === 'Saved'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'Incomplete' || status === 'Unsaved Changes'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-gray-50 text-gray-700 border-gray-200'

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${tone}`}>{status}</span>
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
  profilePhotoUrl,
  layoutSections,
  profile,
  recentSales,
  showSalesStats,
  visitorDarkMode,
  videoLinks,
  videoChannelUrl,
  houseTourLinks,
  houseTourUrl,
  blogCards,
}: {
  size: PreviewSize
  compact?: boolean
  socialLinks: SocialLink[]
  profilePhotoUrl: string
  layoutSections: typeof sections
  profile: { name: string; title: string; brokerage: string; market: string; about?: string }
  recentSales: AgentSale[]
  showSalesStats: boolean
  visitorDarkMode: boolean
  videoLinks: HubItem[]
  videoChannelUrl: string
  houseTourLinks: HubItem[]
  houseTourUrl: string
  blogCards: HubItem[]
}) {
  const width = compact ? 'w-full max-w-full' : size === 'mobile' ? 'max-w-[360px]' : size === 'tablet' ? 'max-w-[620px]' : 'max-w-4xl'
  const shellPadding = compact ? 'px-4 pb-4 pt-4' : 'px-6 pb-6 pt-5'
  const enabledSocialLinks = socialLinks.filter(link => link.enabled && link.url.trim())
  const visibleLayoutSections = layoutSections.filter(section => section.visible && sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, blogCards))
  const socialIconSize = enabledSocialLinks.length <= 2 ? 'h-12 w-12' : enabledSocialLinks.length <= 3 ? 'h-11 w-11' : 'h-10 w-10'
  const socialGlyphSize = enabledSocialLinks.length <= 2 ? 'h-5 w-5' : 'h-[18px] w-[18px]'
  const saleSummary = getSaleSummary(recentSales)
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
        <div key={id} className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Recent Sales</h3>
            <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">View All &rsaquo;</span>
          </div>
          <CarouselRow step={170} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
            {getEligibleSales(recentSales).filter(sale => sale.visible).slice(0, 6).map((sale) => (
              <div key={sale.id} className="relative h-[108px] w-[172px] shrink-0 overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase text-white ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                <div className="absolute bottom-2 left-2 right-2 text-white"><p className="text-xl font-black leading-none">{sale.price ? `$${sale.price.toLocaleString()}` : 'Price'}</p><p className="truncate text-xs font-bold">{getSaleLocation(sale)}</p></div>
              </div>
            ))}
          </CarouselRow>
        </div>
      )
    }

    if (id === 'videos') {
      return (
        <div key={id} className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Videos</h3>
            {videoChannelUrl ? <a href={videoChannelUrl.startsWith('http') ? videoChannelUrl : `https://${videoChannelUrl}`} target="_blank" rel="noreferrer" className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">YouTube &rsaquo;</a> : <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">YouTube &rsaquo;</span>}
          </div>
          <CarouselRow step={162} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
            {videoLinks.filter(item => item.link?.trim()).map((item) => (
              <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="w-[162px] shrink-0">
                <div className="relative h-[92px] overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                  <div className="absolute inset-0 bg-black/10" />
                  <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm backdrop-blur-[1px]">
                    <Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" />
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'YouTube Video'}</p>
              </a>
            ))}
          </CarouselRow>
        </div>
      )
    }

    if (id === 'tours') {
      return (
        <div key={id} className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">House Tours</h3>
            <a href={houseTourUrl ? (houseTourUrl.startsWith('http') ? houseTourUrl : `https://${houseTourUrl}`) : (houseTourLinks.find(item => item.link?.trim())?.link ? (houseTourLinks.find(item => item.link?.trim())!.link!.startsWith('http') ? houseTourLinks.find(item => item.link?.trim())!.link! : `https://${houseTourLinks.find(item => item.link?.trim())!.link!}`) : '#')} target={(houseTourUrl || houseTourLinks.find(item => item.link?.trim())?.link) ? '_blank' : undefined} rel={(houseTourUrl || houseTourLinks.find(item => item.link?.trim())?.link) ? 'noreferrer' : undefined} className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">Watch &rsaquo;</a>
          </div>
          <CarouselRow step={180} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
            {houseTourLinks.filter(item => item.link?.trim()).map((item) => (
              <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" className="w-[180px] shrink-0">
                <div className="relative h-[102px] overflow-hidden rounded-[14px] bg-cover bg-center" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                  <div className="absolute inset-0 bg-black/10" />
                  <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm backdrop-blur-[1px]">
                    <Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" />
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'House Tour'}</p>
              </a>
            ))}
          </CarouselRow>
        </div>
      )
    }

    if (id === 'blogs') {
      return (
        <div key={id} className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Blogs</h3>
            <span className="text-[11px] font-black uppercase text-[#caa65e] dark:text-[#d7b974]">Read All &rsaquo;</span>
          </div>
          <CarouselRow step={198} showArrows={size === 'desktop'} shellClass={compact ? 'relative' : size === 'desktop' ? 'relative px-5 lg:px-10' : 'relative px-5'}>
            {(blogCards.filter(item => item.title.trim()).length ? blogCards.filter(item => item.title.trim()) : blogs.slice(0, 2).map(([title, date], index): HubItem => ({ id: `fallback-blog-${index}`, title, description: date, image: '', link: '' }))).map((item) => (
              <a key={item.id} href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'} target={item.link ? '_blank' : undefined} rel={item.link ? 'noreferrer' : undefined} className={`w-[198px] shrink-0 overflow-hidden rounded-[14px] bg-white shadow-sm dark:bg-[#151517] dark:shadow-none ${item.link ? '' : 'pointer-events-none'}`}>
                <div className="h-[92px] bg-cover bg-center" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
                <div className="bg-white p-3 dark:bg-[#1A1A1C]">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                  <h4 className="mt-1 line-clamp-2 text-sm font-black leading-4 text-[#111827] dark:text-white">{item.title}</h4>
                </div>
              </a>
            ))}
          </CarouselRow>
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
        <div className="-mt-2 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">{profile.brokerage}</div>
        <h2 className="mt-4 font-serif text-[30px] font-black leading-none text-[#111827] dark:text-white">{profile.name}</h2>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
        <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[#778093] dark:text-gray-300"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}</p>
        {size !== 'desktop' && renderSalesStats()}
      </div>
      <div className="mt-6 flex justify-center gap-4 text-center">
        {[
          ['Call', Phone],
          ['Text', MessageSquare],
          ['Email', Mail],
        ].map(([label, Icon]) => (
          <div key={label as string} aria-label={label as string}>
            <span className="mx-auto flex h-[45px] w-[45px] items-center justify-center rounded-full bg-[#111827] text-white dark:bg-[#1A1A1C] dark:ring-1 dark:ring-white/10"><Icon className="h-5 w-5" /></span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {enabledSocialLinks.map(({ id, icon: Icon, label }) => (
          <span key={id} aria-label={label} className={`flex ${socialIconSize} items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#151517]`}>
            <Icon className={`${socialGlyphSize} ${getSocialBrandClass(id)}`} />
          </span>
        ))}
      </div>
      <div className="mt-6">
        <div className="grid grid-cols-2 gap-3">
          <button className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white"><Home className="h-5 w-5" /> Buying</button>
          <button className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black dark:border-gray-700 dark:bg-[#151517] dark:text-white"><TrendingUp className="h-5 w-5" /> Selling</button>
        </div>
        <button className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] border border-[#d7b974] bg-white px-4 py-3 text-center font-black leading-tight dark:border-[#d7b974]/60 dark:bg-[#151517] dark:text-white"><DollarSign className="h-5 w-5 shrink-0 text-[#caa65e]" /> <span>What's My Home Worth?</span> <span className="shrink-0 text-[#9aa2af]">&rsaquo;</span></button>
        <button className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] font-black text-white shadow-lg shadow-[#d2b16f]/30"><Calendar className="h-5 w-5" /> Book Appointment or Call</button>
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
      {visibleLayoutSections.map(section => renderSection(section.id))}
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
  const [isPublicOrderOpen, setIsPublicOrderOpen] = useState(false)
  const [layoutSections, setLayoutSections] = useState(sections)
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null)
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
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [videoLinks, setVideoLinks] = useState<HubItem[]>([{ id: 'video-1', title: 'YouTube Video', link: '' }])
  const [videoChannelUrl, setVideoChannelUrl] = useState('')
  const [houseTourLinks, setHouseTourLinks] = useState<HubItem[]>([{ id: 'tour-1', title: 'House Tour', link: '' }])
  const [houseTourUrl, setHouseTourUrl] = useState('')
  const [blogCards, setBlogCards] = useState<HubItem[]>(blogs.map(([title, date], index) => ({ id: `blog-${index}`, title, description: date, image: '', link: '' })))

  const visibleSectionIds = useMemo(() => layoutSections.filter(section => section.visible).map(section => section.id), [layoutSections])

  useEffect(() => {
    if (!user) return

    const accountName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    setProfile(current => ({
      ...current,
      name: current.name || accountName,
      brokerage: current.brokerage || user.brokerage || '',
    }))
  }, [user])

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
      if (typeof parsed.visitorDarkMode === 'boolean') setVisitorDarkMode(parsed.visitorDarkMode)
      if (Array.isArray(parsed.videoLinks)) setVideoLinks(parsed.videoLinks)
      if (typeof parsed.videoChannelUrl === 'string') setVideoChannelUrl(parsed.videoChannelUrl)
      if (typeof parsed.houseTourUrl === 'string') setHouseTourUrl(parsed.houseTourUrl)
      if (Array.isArray(parsed.houseTourLinks)) setHouseTourLinks(parsed.houseTourLinks)
      if (Array.isArray(parsed.blogCards)) setBlogCards(parsed.blogCards)
      setLastSavedHub(parsed)
      const savedStatus = localStorage.getItem('agentHubEditorSectionStatus')
      if (savedStatus) setEditorSectionStatus(JSON.parse(savedStatus))
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
    } catch {
      setSaveStatus('Unsaved Changes')
    }
  }, [])

  useEffect(() => {
    const loadAnalytics = () => {
      try {
        const saved = localStorage.getItem('agentHubAnalyticsEvents')
        setAnalyticsEvents(saved ? JSON.parse(saved) : [])
      } catch {
        setAnalyticsEvents([])
      }
    }

    loadAnalytics()
    window.addEventListener('storage', loadAnalytics)
    window.addEventListener('focus', loadAnalytics)
    return () => {
      window.removeEventListener('storage', loadAnalytics)
      window.removeEventListener('focus', loadAnalytics)
    }
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

  const visitorStats = getRecentStats(analyticsEvents, 'visit')
  const formStats = getRecentStats(analyticsEvents, 'form')
  const qrStats = getRecentStats(analyticsEvents, 'qr')
  const agentHubPublicPath = `/${agentHubSlug || 'sarah-johnson'}`
  const agentHubPublicUrl = `openhousepal.com${agentHubPublicPath}`
  const formSubmissions = useMemo(() => {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000)
    return analyticsEvents
      .filter(event => event.type === 'form' && new Date(event.timestamp).getTime() >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [analyticsEvents])
  const formGroups = ['Buying', 'Selling', "What's My Home Worth?"].map(label => ({
    label,
    submissions: formSubmissions.filter(event => event.label === label),
  }))

  const moveDraggedSection = (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId) return

    setLayoutSections(current => {
      const dragged = current.find(section => section.id === draggedSectionId)
      if (!dragged) return current

      const withoutDragged = current.filter(section => section.id !== draggedSectionId)
      const targetIndex = withoutDragged.findIndex(section => section.id === targetId)
      const next = [...withoutDragged]
      next.splice(targetIndex, 0, dragged)
      return next
    })
    setSaveStatus('Unsaved Changes')
  }

  const updateSocialLink = (id: string, updates: Partial<SocialLink>) => {
    setSocialLinks(current => current.map(link => link.id === id ? { ...link, ...updates } : link))
    setEditorSectionStatus(current => ({ ...current, 'Social Links': 'Incomplete' }))
    setSaveStatus('Unsaved Changes')
  }

  const handleSaveAgentHubChanges = (overrides?: Partial<Pick<SavedAgentHubData, 'recentSales' | 'showSalesStats' | 'videoLinks' | 'videoChannelUrl' | 'houseTourLinks' | 'houseTourUrl' | 'blogCards'>>) => {
    const savedSocialLinks: SavedSocialLink[] = socialLinks.map(({ id, label, url, enabled }) => ({
      id,
      label,
      url,
      enabled,
    }))
    const salesToSave = getEligibleSales(overrides?.recentSales || recentSales)
    const showSalesStatsToSave = overrides?.showSalesStats ?? showSalesStats
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

    localStorage.setItem('agentHubSavedData', JSON.stringify(savedHub))
    localStorage.setItem('agentHubEditorSectionStatus', JSON.stringify(nextEditorSectionStatus))
    localStorage.setItem('agentHubProfile', JSON.stringify(profile))
    localStorage.setItem('agentHubContact', JSON.stringify(contact))
    localStorage.setItem('agentHubSocialLinks', JSON.stringify(savedSocialLinks))
    localStorage.setItem('agentHubRecentSales', JSON.stringify(salesToSave))
    localStorage.setItem('agentHubShowSalesStats', JSON.stringify(showSalesStatsToSave))
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

  const handleProfilePhotoChange = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setProfilePhotoUrl(reader.result)
      setEditorSectionStatus(current => ({ ...current, Profile: 'Incomplete' }))
      setSaveStatus('Unsaved Changes')
    }
    reader.readAsDataURL(file)
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
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight">Agent Hub</h1>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <Globe className="h-4 w-4 text-[#8b7355]" />
              <span className="font-semibold">{agentHubPublicUrl}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleCopyPublicUrl} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black shadow-sm"><Copy className="h-4 w-4" />Copy Link</button>
            <Link href={agentHubPublicPath} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black shadow-sm"><Eye className="h-4 w-4" />Preview Page</Link>
            <button onClick={handleSharePublicUrl} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black shadow-sm"><Share2 className="h-4 w-4" />Share</button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <nav className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
              <button
                onClick={() => setActiveTab('Overview')}
                className={`agent-hub-tab flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-black ${activeTab === 'Overview' ? 'agent-hub-tab-active bg-[#111827] text-white' : 'agent-hub-tab-idle text-gray-600 hover:bg-gray-50'}`}
              >
                Overview
              </button>
              <div className="my-3 border-t border-gray-100"></div>
              <p className="mx-3 mb-2 border-b-2 border-[#C9A24D]/60 px-1 pb-2 text-[11px] font-black uppercase tracking-widest text-[#8b7355]">Agent Hub</p>
              {['Editor', 'Layout', 'Public URL'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`agent-hub-tab flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-black ${activeTab === tab ? 'agent-hub-tab-active bg-[#111827] text-white' : 'agent-hub-tab-idle text-gray-600 hover:bg-gray-50'}`}
                >
                  {tab}
                </button>
              ))}
              <div className="my-3 border-t border-gray-100"></div>
              <p className="mx-3 mb-2 border-b-2 border-[#C9A24D]/60 px-1 pb-2 text-[11px] font-black uppercase tracking-widest text-[#8b7355]">Forms</p>
              {['Forms Layout', 'Forms Editor', 'Form Links', 'Forms Results', 'Forms Preview'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`agent-hub-tab flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-black ${activeTab === tab ? 'agent-hub-tab-active bg-[#111827] text-white' : 'agent-hub-tab-idle text-gray-600 hover:bg-gray-50'}`}
                >
                  {tab.replace('Forms ', '')}
                </button>
              ))}
            </nav>
          </aside>

          <section className="space-y-6">
            {activeTab === 'Overview' && (
              <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h2 className="text-2xl font-black">Agent Hub Overview</h2>
                    <p className="mt-2 text-gray-600">Last 30 days, compared with the prior 30. Logged-in agent visits are excluded.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      ['Visitors', visitorStats.current.toString(), formatPercentChange(visitorStats.percent)],
                      ['Filled Forms', formStats.current.toString(), formatPercentChange(formStats.percent)],
                      ['QR Scans', qrStats.current.toString(), formatPercentChange(qrStats.percent)],
                    ].map(([label, value, note]) => {
                      const percent = Number(String(note).replace('%', ''))
                      const tone = percent > 0 ? 'text-emerald-600' : percent < 0 ? 'text-red-600' : 'text-gray-500'

                      return (
                      <div key={label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</p>
                        <p className="mt-3 text-4xl font-black">{value}</p>
                        <p className={`mt-2 text-sm font-black ${tone}`}>{note}</p>
                      </div>
                    )})}
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-black">Form Results</h3>
                    <p className="mt-1 text-sm text-gray-600">Buying, Selling, and home-value form submissions from the last 30 days.</p>
                    <div className="mt-4 space-y-3">
                      {formGroups.map(({ label, submissions }) => (
                        <button key={label} className="w-full rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4 text-left shadow-sm transition hover:border-[#C9A24D] hover:bg-white">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <h4 className="text-lg font-black">{label}</h4>
                              <p className="mt-1 text-sm font-semibold text-gray-500">
                                {submissions.length === 0
                                  ? 'No submissions yet'
                                  : `Latest: ${new Date(submissions[0].timestamp).toLocaleString()}`}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="rounded-full bg-[#C9A24D]/15 px-3 py-1 text-sm font-black text-[#8b7355]">{submissions.length}</span>
                              <span className="text-xl font-black text-[#caa65e]">&rsaquo;</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
              </div>
            )}

            {activeTab === 'Layout' && (
              <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div>
                      <h2 className="text-2xl font-black">Agent Hub Layout</h2>
                      <p className="mt-2 text-gray-600">Drag sections and content into the order you want. Use the eye to show or hide a section.</p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <button onClick={() => setIsPublicOrderOpen(!isPublicOrderOpen)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
                      <div>
                        <h3 className="text-lg font-black">Public Page Order</h3>
                        <p className="mt-1 text-sm text-gray-600">Drag these sections into the order visitors should see them. Toggle sections on or off.</p>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition ${isPublicOrderOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isPublicOrderOpen && (
                    <div className="space-y-3 border-t border-gray-100 bg-[#fbfaf7] p-5">
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
                          className={`flex cursor-grab flex-wrap items-center gap-3 rounded-2xl border p-4 transition active:cursor-grabbing ${
                            draggedSectionId === section.id
                              ? 'border-[#C9A24D] bg-[#C9A24D]/10 shadow-md'
                              : 'border-gray-200 bg-[#fbfaf7]'
                          }`}
                        >
                          <GripVertical className="h-5 w-5 shrink-0 text-gray-400" />
                          <div className="min-w-0 flex-1">
                            <p className="font-black">{index + 1}. {section.label}</p>
                            <p className="text-sm text-gray-500">{hasContent ? (isShowing ? 'Showing on public page' : 'Hidden from public page') : 'Empty - toggled off until content is added'}</p>
                          </div>
                          <button
                            onClick={() => toggleSectionVisibility(section.id)}
                            disabled={!hasContent}
                            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${
                              isShowing
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 bg-gray-100 text-gray-500 disabled:opacity-70'
                            }`}
                            aria-label={`${section.visible ? 'Hide' : 'Show'} ${section.label}`}
                            title={`${section.visible ? 'Hide' : 'Show'} ${section.label}`}
                          >
                            <span>{isShowing ? 'On' : 'Off'}</span>
                            <span className={`relative h-5 w-9 rounded-full ${isShowing ? 'bg-emerald-500' : 'bg-gray-300'}`}>
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
                      if (section.id === 'sales') return <RecentSalesPanel key={section.id} reLicenseNumber={profile.licenseNumber} agentSales={recentSales} setAgentSales={setRecentSales} showStats={showSalesStats} setShowStats={setShowSalesStats} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'videos') return <VideoLinksPanel key={section.id} items={videoLinks} setItems={setVideoLinks} channelUrl={videoChannelUrl} setChannelUrl={setVideoChannelUrl} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'tours') return <HouseToursPanel key={section.id} items={houseTourLinks} setItems={setHouseTourLinks} houseTourUrl={houseTourUrl} setHouseTourUrl={setHouseTourUrl} onSave={handleSaveAgentHubChanges} />
                      if (section.id === 'blogs') return <BlogCardsPanel key={section.id} items={blogCards} setItems={setBlogCards} onChange={() => setSaveStatus('Unsaved Changes')} onSave={handleSaveAgentHubChanges} />
                      return null
                    })}
                  </div>
                </div>
                <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black">Live public preview</h2>
                    <p className="text-sm text-gray-600">Reflects draft changes before publication.</p>
                  </div>
                  <div className="mt-4 overflow-hidden">
                    <PublicPreview size="mobile" compact socialLinks={socialLinks} profilePhotoUrl={profilePhotoUrl} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} visitorDarkMode={visitorDarkMode} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={blogCards} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Editor' && (
              <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                <div className="space-y-5">
                <div className="sticky top-4 z-20 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-2xl font-black">Editing Agent Hub</h2>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">Open one section, make changes, then save.</p>
                      </div>
                      <div className="flex gap-2">
                        {hasUnsavedChanges && (
                          <button onClick={handleCancelAgentHubChanges} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-black">Cancel</button>
                        )}
                        <button
                          onClick={hasUnsavedChanges ? () => handleSaveAgentHubChanges() : undefined}
                          disabled={!hasUnsavedChanges}
                          className={`rounded-xl px-4 py-3 text-sm font-black ${
                            hasUnsavedChanges
                              ? 'bg-[#111827] text-white'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <Save className="inline h-4 w-4" /> {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {editorGroups.map(group => (
                    <div key={group.title} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                      <button
                        onClick={() => setOpenEditorSection(openEditorSection === group.title ? '' : group.title)}
                        className="flex w-full items-center justify-between gap-3 p-5 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C9A24D]/15 text-[#8b7355]">
                            <group.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-black">{group.title}</h3>
                            <div className="mt-1 flex gap-2"><StatusPill status={getEditorSectionStatus(group.title)} /></div>
                          </div>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-gray-400 transition ${openEditorSection === group.title ? 'rotate-180' : ''}`} />
                      </button>
                      {openEditorSection === group.title && (
                        <div className="border-t border-gray-100 p-5">
                          {group.title === 'Social Links' ? (
                            <div className="space-y-3">
                              {socialLinks.map(({ id, label, url, enabled, icon: Icon }) => (
                                <div key={id} className={`rounded-xl border p-3 ${enabled ? 'border-gray-200 bg-[#fbfaf7]' : 'border-gray-100 bg-gray-50 opacity-75'}`}>
                                  <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#111827]">
                                      <Icon className={`h-4 w-4 ${getSocialBrandClass(id)}`} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-black">{label}</p>
                                      <input
                                        value={url}
                                        disabled={!enabled}
                                        onChange={(event) => updateSocialLink(id, { url: event.target.value })}
                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] disabled:bg-gray-100 disabled:text-gray-400"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updateSocialLink(id, { enabled: !enabled })}
                                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? 'bg-[#111827]' : 'bg-gray-300'}`}
                                      aria-label={`${enabled ? 'Turn off' : 'Turn on'} ${label}`}
                                    >
                                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-1'}`} />
                                    </button>
                                  </div>
                                  <p className="mt-2 pl-[52px] text-xs font-bold text-gray-500">
                                    {enabled ? 'Showing on public Agent Hub' : 'Hidden from public Agent Hub'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
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
                                    <div className="mt-2 flex items-center gap-4 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3">
                                      <div className="h-16 w-16 rounded-full bg-cover bg-center ring-2 ring-[#C9A24D]/30" style={{ backgroundImage: `url(${profilePhotoUrl})` }} />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-gray-700">Current profile photo</p>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(event) => handleProfilePhotoChange(event.target.files?.[0])}
                                          className="mt-2 block w-full text-sm font-semibold file:mr-3 file:rounded-lg file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-sm file:font-black file:text-white"
                                        />
                                      </div>
                                    </div>
                                  ) : label === 'About me' ? (
                                    <textarea
                                      value={getProfileFieldValue(label, value)}
                                      onChange={(event) => updateProfileField(label, event.target.value)}
                                      placeholder="Add a short, helpful introduction for your public Agent Hub"
                                      rows={5}
                                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#C9A24D]"
                                    />
                                  ) : (
                                    <input
                                      value={group.title === 'Profile' ? getProfileFieldValue(label, value) : getContactFieldValue(label, value)}
                                      onChange={(event) => group.title === 'Profile' ? updateProfileField(label, event.target.value) : updateContactField(label, event.target.value)}
                                      placeholder={group.title === 'Profile' && (label === 'Agent name' || label === 'Brokerage name') ? 'Filled from your account when available' : 'Add details'}
                                      required={group.title === 'Contact' || (group.title === 'Profile' && label !== 'About me')}
                                      className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]"
                                    />
                                  )}
                                  {label === 'RE License number' && (
                                    <div className="mt-3 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4">
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
                                          <p className="mt-1 text-sm text-gray-500">Applies to the public hub and sales page for visitors.</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setVisitorDarkMode(current => !current)
                                            setSaveStatus('Unsaved Changes')
                                          }}
                                          className={`relative h-7 w-12 shrink-0 rounded-full transition ${visitorDarkMode ? 'bg-[#111827]' : 'bg-gray-300'}`}
                                          aria-label={visitorDarkMode ? 'Turn off visitor dark mode' : 'Turn on visitor dark mode'}
                                          title={visitorDarkMode ? 'Turn off visitor dark mode' : 'Turn on visitor dark mode'}
                                        >
                                          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${visitorDarkMode ? 'left-6' : 'left-1'}`} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="sticky top-4 h-fit min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black">Live public preview</h2>
                    <p className="text-sm text-gray-600">Updates as you edit profile, contact, and social links.</p>
                  </div>
                  <div className="mt-4 overflow-hidden">
                    <PublicPreview size="mobile" compact socialLinks={socialLinks} profilePhotoUrl={profilePhotoUrl} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} visitorDarkMode={visitorDarkMode} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={blogCards} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Forms Layout' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">Forms Layout</h2>
                <p className="mt-2 text-gray-600">Choose the order forms appear in Agent Hub form areas.</p>
                <div className="mt-5 space-y-3">
                  {['Buying', 'Selling', "What's My Home Worth?"].map((form, index) => (
                    <div key={form} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4">
                      <GripVertical className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-black">{index + 1}. {form}</p>
                        <p className="text-sm text-gray-500">Visible on Agent Hub</p>
                      </div>
                      <Eye className="h-5 w-5 text-emerald-600" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Forms Editor' && (
              <div className="space-y-4">
                {['Buying', 'Selling', "What's My Home Worth?"].map((form) => (
                  <div key={form} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <h2 className="text-xl font-black">{form}</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label>
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Button label</span>
                        <input defaultValue={form} className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 font-semibold outline-none focus:border-[#C9A24D]" />
                      </label>
                      <label>
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Success message</span>
                        <input defaultValue="Thanks. I will follow up shortly." className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 font-semibold outline-none focus:border-[#C9A24D]" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'Form Links' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">Form Links</h2>
                <p className="mt-2 text-gray-600">Copy direct links for each form.</p>
                <div className="mt-5 space-y-3">
                  {['Buying', 'Selling', "What's My Home Worth?"].map((form) => (
                    <div key={form} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-black">{form}</p>
                        <p className="truncate text-sm text-gray-500">{agentHubPublicUrl}/{getFormSlug(form)}</p>
                      </div>
                      <button className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white"><Copy className="inline h-4 w-4" /> Copy</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Forms Results' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">Forms Results</h2>
                <p className="mt-2 text-gray-600">Submissions from the last 30 days.</p>
                <div className="mt-5 space-y-3">
                  {formGroups.map(({ label, submissions }) => (
                    <button key={label} className="w-full rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4 text-left shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-black">{label}</h3>
                          <p className="mt-1 text-sm text-gray-500">{submissions.length === 0 ? 'No submissions yet' : `Latest: ${new Date(submissions[0].timestamp).toLocaleString()}`}</p>
                        </div>
                        <span className="rounded-full bg-[#C9A24D]/15 px-3 py-1 text-sm font-black text-[#8b7355]">{submissions.length}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Forms Preview' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">Forms Preview</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {['Buying', 'Selling', "What's My Home Worth?"].map((form) => (
                    <div key={form} className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-5">
                      <h3 className="font-black">{form}</h3>
                      <input className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Name" />
                      <input className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm" placeholder="Email" />
                      <button className="mt-3 w-full rounded-xl bg-[#111827] px-4 py-3 font-black text-white">Submit</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Public URL' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black">Public URL</h2>
                <p className="mt-2 text-gray-600">Letters, numbers, and hyphens only. No spaces or unsupported symbols.</p>
                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <label className="text-sm font-black text-gray-700">Custom URL ending</label>
                    <div className="mt-2 flex overflow-hidden rounded-xl border border-gray-200 bg-[#fbfaf7] focus-within:border-[#C9A24D]">
                      <span className="flex items-center border-r border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-500">openhousepal.com/</span>
                      <input
                        className="min-w-0 flex-1 bg-transparent px-4 py-3 font-semibold outline-none"
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
                    <p className={`mt-2 text-sm font-bold ${
                      slugStatus === 'available' || slugStatus === 'saved'
                        ? 'text-emerald-700'
                        : slugStatus === 'taken' || slugStatus === 'error'
                          ? 'text-red-600'
                          : 'text-gray-500'
                    }`}>
                      {slugMessage}
                    </p>
                  </div>
                  <div className="flex gap-2 self-end">
                    <button onClick={handleCheckSlug} disabled={slugStatus === 'checking'} className="rounded-xl border border-gray-200 px-5 py-3 font-black">
                      {slugStatus === 'checking' ? 'Checking...' : 'Check'}
                    </button>
                    <button onClick={handleSaveSlug} disabled={slugStatus === 'checking' || slugStatus === 'taken'} className="rounded-xl bg-[#111827] px-5 py-3 font-black text-white disabled:opacity-50">
                      Save URL
                    </button>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                  Changing your Agent Hub URL may affect links or QR codes you have already shared.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={handleCopyPublicUrl} className="rounded-xl border border-gray-200 px-4 py-3 font-bold"><Copy className="inline h-4 w-4" /> Copy URL</button>
                  <button onClick={handleOpenPublicPage} className="rounded-xl border border-gray-200 px-4 py-3 font-bold"><Globe className="inline h-4 w-4" /> Open Public Page</button>
                  <button onClick={handleSharePublicUrl} className="rounded-xl border border-gray-200 px-4 py-3 font-bold"><Share2 className="inline h-4 w-4" /> Share URL</button>
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
                  <PublicPreview size={previewSize} socialLinks={socialLinks} profilePhotoUrl={profilePhotoUrl} layoutSections={layoutSections} profile={profile} recentSales={recentSales} showSalesStats={showSalesStats} visitorDarkMode={visitorDarkMode} videoLinks={videoLinks} videoChannelUrl={videoChannelUrl} houseTourLinks={houseTourLinks} houseTourUrl={houseTourUrl} blogCards={blogCards} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

    </main>
  )
}

function RecentSalesPanel({ reLicenseNumber, agentSales, setAgentSales, showStats, setShowStats, onChange, onSave }: { agentSales: AgentSale[]; reLicenseNumber: string; setAgentSales: React.Dispatch<React.SetStateAction<AgentSale[]>>; showStats: boolean; setShowStats: React.Dispatch<React.SetStateAction<boolean>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'recentSales' | 'showSalesStats'>>) => void }) {
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
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="grid w-full grid-cols-[1fr_auto] items-start gap-4 p-5">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <DollarSign className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-xl font-black">Recent Sales</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500">Pulled from your listing data based on your agent profile.</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <span className="rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1 text-xs font-black text-gray-600">{visibleCount}/{eligibleAgentSales.length}</span>
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 p-3 text-gray-500" aria-label={`${isOpen ? 'Collapse' : 'Expand'} Recent Sales`}>
            <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-gray-100 bg-[#fbfaf7] p-5 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-300">Choose which sales appear on your public Agent Hub.</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-[#fbfaf7] px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
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
                  className={`relative h-6 w-11 rounded-full transition ${showStats ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  aria-label={showStats ? 'Hide sales stats' : 'Show sales stats'}
                  title={showStats ? 'Hide sales stats' : 'Show sales stats'}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${showStats ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <select value={sortMode} onChange={event => { setSortMode(event.target.value as 'recent' | 'price-high' | 'price-low'); setPage(1) }} className="rounded-xl border border-gray-200 bg-[#fbfaf7] px-3 py-3 text-sm font-black text-gray-800 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                <option value="recent">Newest</option>
                <option value="price-high">Price High</option>
                <option value="price-low">Price Low</option>
              </select>
              <button onClick={() => setManualAddOpen(current => !current)} className={`rounded-xl border px-4 py-3 text-sm font-black shadow-sm ${manualAddOpen ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355]' : 'border-gray-200 bg-[#fbfaf7] text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white'}`}>
                Manually Add
              </button>
              <button onClick={loadSales} disabled={isLoading} className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">{isLoading ? 'Refreshing...' : 'Refresh Sales'}</button>
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
                <div key={sale.id} className={`grid gap-3 rounded-xl border p-2.5 sm:grid-cols-[68px_1fr_118px] ${sale.visible ? 'border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900' : 'border-dashed border-gray-300 bg-gray-100 shadow-inner dark:border-gray-700 dark:bg-gray-950'}`}>
                  <div className={`h-14 w-full rounded-lg bg-cover bg-center sm:w-[68px] ${sale.visible ? '' : 'grayscale opacity-60'}`} style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }} />
                  <div className="min-w-0 self-center">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase text-white ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                      {sale.source === 'manual' && <span className="rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355]">Manual</span>}
                    </div>
                    <p className={`truncate text-sm font-black leading-snug ${sale.visible ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{getStreetOnly(sale.address)}</p>
                    <p className={`mt-1 text-sm font-semibold ${sale.visible ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>{[sale.city, sale.state].filter(Boolean).join(', ') || 'Location unavailable'}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 self-center sm:block sm:text-right">
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

function VideoLinksPanel({ items, setItems, channelUrl, setChannelUrl, onChange, onSave }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; channelUrl: string; setChannelUrl: React.Dispatch<React.SetStateAction<string>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'videoLinks' | 'videoChannelUrl'>>) => void }) {
  const [isLoadingChannel, setIsLoadingChannel] = useState(false)
  const [channelMessage, setChannelMessage] = useState('')
  const [draftChannelUrl, setDraftChannelUrl] = useState(channelUrl)
  const [savedChannelUrl, setSavedChannelUrl] = useState(channelUrl)
  const [channelLoaded, setChannelLoaded] = useState(false)
  const channelIsSaved = Boolean(draftChannelUrl.trim()) && draftChannelUrl.trim() === savedChannelUrl.trim()

  useEffect(() => {
    setDraftChannelUrl(channelUrl)
    setSavedChannelUrl(channelUrl)
  }, [channelUrl])

  const addVideo = () => {
    const nextItems = [...items, { id: `video-${Date.now()}`, title: 'New YouTube Video', link: '' }]
    setItems(nextItems)
    onSave({ videoLinks: nextItems, videoChannelUrl: channelUrl })
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
    <EditableContentPanel title="Videos" action="Add Video" count={`${items.filter(item => item.link?.trim()).length} videos`} icon={Video} accent="bg-red-50 text-red-600" onAdd={addVideo} summary="Connect a YouTube channel and paste individual YouTube links.">
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
      {items.map(item => (
        <div key={item.id} className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4">
          <div className="flex items-end gap-3">
            <label className="block min-w-0 flex-1">
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">YouTube link</span>
              <input value={item.link || ''} onChange={event => updateVideoLink(item.id, event.target.value)} onPaste={event => { const pasted = event.clipboardData.getData('text'); if (pasted) setTimeout(() => updateVideoLink(item.id, pasted), 0) }} placeholder="https://youtube.com/watch?v=..." className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
            </label>
            <button onClick={() => deleteVideo(item.id)} className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600">
              <Trash2 className="inline h-4 w-4" /> Delete
            </button>
          </div>
        </div>
      ))}
    </EditableContentPanel>
  )
}

function HouseToursPanel({ items, setItems, houseTourUrl, setHouseTourUrl, onSave }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; houseTourUrl: string; setHouseTourUrl: React.Dispatch<React.SetStateAction<string>>; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'houseTourLinks' | 'houseTourUrl'>>) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftHouseTourUrl, setDraftHouseTourUrl] = useState(houseTourUrl)
  const [savedHouseTourUrl, setSavedHouseTourUrl] = useState(houseTourUrl)
  const houseTourIsSaved = Boolean(draftHouseTourUrl.trim()) && draftHouseTourUrl.trim() === savedHouseTourUrl.trim()
  const visibleItems = items.filter(item => item.link?.trim())

  useEffect(() => {
    setDraftHouseTourUrl(houseTourUrl)
    setSavedHouseTourUrl(houseTourUrl)
  }, [houseTourUrl])

  const saveItems = (nextItems: HubItem[]) => {
    setItems(nextItems)
    onSave({ houseTourLinks: nextItems, houseTourUrl })
  }

  const addTour = () => {
    saveItems([...items, { id: `tour-${Date.now()}`, title: 'House Tour', link: '' }])
    setIsOpen(true)
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

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex w-full flex-wrap items-start justify-between gap-4 p-5">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <Play className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-xl font-black">House Tours</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500">Paste individual YouTube tour links.</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1 text-xs font-black text-gray-600">{visibleItems.length} tours</span>
          {isOpen && (
            <button onClick={addTour} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white">
              <Plus className="h-4 w-4" /> Add Tour
            </button>
          )}
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 p-3 text-gray-500" aria-label={`${isOpen ? 'Collapse' : 'Expand'} House Tours`}>
            <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="space-y-3 border-t border-gray-100 bg-[#fbfaf7] p-5">
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
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveHouseTourUrl} disabled={!draftHouseTourUrl.trim()} className={`rounded-xl px-4 py-3 text-sm font-black ${houseTourIsSaved ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-gray-200 bg-[#fbfaf7] text-gray-700'}`}>
                <Check className="mr-1 inline h-4 w-4" /> Save Link
              </button>
            </div>
            <p className="mt-2 text-xs font-bold text-gray-500">This link powers the Watch button on your public hub.</p>
          </div>
          {items.map(item => (
            <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-end gap-3">
                <label className="block min-w-0 flex-1">
                  <span className="text-xs font-black uppercase tracking-widest text-gray-400">YouTube tour link</span>
                  <input value={item.link || ''} onChange={event => updateTourLink(item.id, event.target.value)} placeholder="https://youtube.com/watch?v=..." className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
                </label>
                <button onClick={() => deleteTour(item.id)} className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600">
                  <Trash2 className="inline h-4 w-4" /> Delete
                </button>
              </div>
              {item.title && <p className="mt-3 text-sm font-black text-gray-700">{item.title}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function BlogCardsPanel({ items, setItems, onChange, onSave }: { items: HubItem[]; setItems: React.Dispatch<React.SetStateAction<HubItem[]>>; onChange: () => void; onSave: (overrides?: Partial<Pick<SavedAgentHubData, 'blogCards'>>) => void }) {
  const [savedRows, setSavedRows] = useState<Record<string, boolean>>({})

  const addBlog = () => {
    setItems(current => [...current, { id: `blog-${Date.now()}`, title: '', image: '', link: '' }])
    onChange()
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
    setItems(current => current.filter(item => item.id !== id))
    onChange()
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
    <EditableContentPanel title="Blogs" action="Add Blog" count={`${items.filter(item => item.link?.trim() || item.title.trim()).length} blogs`} icon={BookOpen} accent="bg-[#C9A24D]/15 text-[#8b7355]" onAdd={addBlog} summary="Paste a blog link. The title and image will be pulled from the link.">
      {items.map(item => (
        <div key={item.id} className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-4">
          <div className="grid gap-3 md:grid-cols-[140px_1fr]">
            <div className="h-28 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
            <div className="space-y-3">
              <input value={item.title} onChange={event => updateItem(item.id, { title: event.target.value })} placeholder="Blog title" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
              <input value={item.link || ''} onChange={event => updateItem(item.id, { link: event.target.value })} onBlur={event => loadBlogPreview(item.id, event.target.value)} placeholder="Paste blog link" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D]" />
              <div className="flex justify-end gap-2">
                <button onClick={() => saveBlog(item.id)} className={`rounded-xl border px-4 py-3 text-sm font-black ${savedRows[item.id] ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                  <Check className="inline h-4 w-4" /> {savedRows[item.id] ? 'Saved' : 'Save'}
                </button>
                <button onClick={() => deleteBlog(item.id)} className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-black text-red-600">
                  <Trash2 className="inline h-4 w-4" /> Delete Blog
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </EditableContentPanel>
  )
}

function EditableContentPanel({ title, action, count, icon: Icon, accent, summary, onAdd, children }: { title: string; action?: string; count?: string; icon: React.ComponentType<{ className?: string }>; accent: string; summary: string; onAdd?: () => void; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent}`}><Icon className="h-6 w-6" /></span>
          <div>
            <h3 className="text-xl font-black">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-gray-500">{summary}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {count && <span className="rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1 text-xs font-black text-gray-600">{count}</span>}
          {isOpen && action && onAdd && <button onClick={onAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white"><Plus className="h-4 w-4" /> {action}</button>}
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 p-3 text-gray-500" aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}>
            <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {isOpen && <div className="space-y-3 border-t border-gray-100 bg-[#fbfaf7] p-5">{children}</div>}
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
