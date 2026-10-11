'use client'

import { scrollRowByCard } from '@/lib/rowScroll'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/token'
import api from '@/lib/api-service'
import { PublicBlogSummary, PublicFormSummary } from '@/types'
import RecentSalesCarousel from '@/components/agent-hub/RecentSalesCarousel'
import HubItemCarousel from '@/components/agent-hub/HubItemCarousel'
import {
  Calendar,
  ChevronRight,
  DollarSign,
  ExternalLink,
  Facebook,
  Globe,
  Home,
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

const sales = [
  ['$2,850,000', 'Bryn Mawr', 'Sold'],
  ['$1,200,000', 'Gladwyne', 'Active'],
  ['$1,950,000', 'Wayne', 'Sold'],
]

const videos = [
  ['Main Line Market Update', '2.4K views'],
  ['Luxury Home Tour: Bryn Mawr', '5.1K views'],
  ['5 Tips for Sellers', '8.3K views'],
]

const blogs = [
  ['Spring 2026 Market Trends on the Main Line', 'May 5, 2026'],
  ['5 Home Staging Tips That Actually Work', 'Apr 22, 2026'],
]

const defaultVisibleSectionIds = ['sales', 'videos', 'tours', 'blogs']
const defaultLayoutSections = defaultVisibleSectionIds.map(id => ({ id, visible: true }))
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
type HubItem = { id: string; title: string; description?: string; image?: string; link?: string }
type AgentSale = { id: string; address: string; city: string; state: string; zipcode?: string; price?: number; status?: string; image?: string; sold_date?: string; visible?: boolean }

const getYoutubeThumbnail = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : ''
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

const isEligibleSaleStatus = (status?: string) => ['sold', 'active', 'pending', 'under contract'].includes(formatSaleStatus(status).toLowerCase())

const normalizeAgentSale = (sale: AgentSale): AgentSale => ({
  ...sale,
  visible: sale.visible ?? true,
})

const getEligibleSales = (sales: AgentSale[]) => sales.filter(sale => isEligibleSaleStatus(sale.status) && (sale.price || 0) >= 100000).map(normalizeAgentSale)

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

const recordAgentHubEvent = (event: Omit<AgentHubEvent, 'timestamp'>) => {
  if (getToken()) return

  try {
    const saved = localStorage.getItem('agentHubAnalyticsEvents')
    const events: AgentHubEvent[] = saved ? JSON.parse(saved) : []
    events.push({ ...event, timestamp: new Date().toISOString() })
    localStorage.setItem('agentHubAnalyticsEvents', JSON.stringify(events.slice(-1000)))
  } catch {
    localStorage.setItem('agentHubAnalyticsEvents', JSON.stringify([{ ...event, timestamp: new Date().toISOString() }]))
  }
}

export default function PublicAgentHubPage() {
  const pathname = usePathname()
  const agentHubBasePath = pathname.split('/').slice(0, 3).join('/') || '/AgentHub/sarah-johnson'
  const agentSlug = agentHubBasePath.split('/').pop() || 'sarah-johnson'
  const salesPath = `${agentHubBasePath}/sales`
  const blogsPath = `${agentHubBasePath}/blogs`
  const [visibleSectionIds, setVisibleSectionIds] = useState(defaultVisibleSectionIds)
  const [layoutSections, setLayoutSections] = useState(defaultLayoutSections)
  const [profile, setProfile] = useState(defaultProfile)
  const [contact, setContact] = useState(defaultContact)
  const [socialLinks, setSocialLinks] = useState<SavedSocialLink[]>([])
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('/home.jpg')
  const [recentSales, setRecentSales] = useState<AgentSale[]>([])
  const [showSalesStats, setShowSalesStats] = useState(true)
  const [salesCarousel, setSalesCarousel] = useState(false)
  const [videosCarousel, setVideosCarousel] = useState(false)
  const [toursCarousel, setToursCarousel] = useState(false)
  const [blogsCarousel, setBlogsCarousel] = useState(false)
  const [salesAutoScroll, setSalesAutoScroll] = useState(true)
  const [videosAutoScroll, setVideosAutoScroll] = useState(true)
  const [toursAutoScroll, setToursAutoScroll] = useState(true)
  const [blogsAutoScroll, setBlogsAutoScroll] = useState(true)
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [videoLinks, setVideoLinks] = useState<HubItem[]>([])
  const [videoChannelUrl, setVideoChannelUrl] = useState('')
  const [houseTourLinks, setHouseTourLinks] = useState<HubItem[]>([])
  const [houseTourUrl, setHouseTourUrl] = useState('')
  const [blogCards, setBlogCards] = useState<HubItem[]>([])
  const [publicForms, setPublicForms] = useState<PublicFormSummary[]>([])
  const [publicBlogs, setPublicBlogs] = useState<PublicBlogSummary[]>([])
  const [hubStatus, setHubStatus] = useState<'loading' | 'found' | 'not-found'>('loading')
  // Which shelf currently "owns" auto-scroll motion, when more than one section has it enabled -
  // see autoScrollSequence below for how sections take turns, in layout order.
  const [activeAutoScrollId, setActiveAutoScrollId] = useState<string | null>(null)
  const [autoScrollStep, setAutoScrollStep] = useState<{ id: string; nonce: number } | null>(null)
  const autoScrollStartedRef = useRef(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  const applyHubConfig = (parsed: any) => {
    if (parsed.profile) setProfile({ ...defaultProfile, ...parsed.profile })
    if (parsed.contact) setContact({ ...defaultContact, ...parsed.contact })
    if (parsed.profilePhotoUrl) setProfilePhotoUrl(parsed.profilePhotoUrl)
    if (Array.isArray(parsed.socialLinks)) setSocialLinks(parsed.socialLinks)
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
    if (Array.isArray(parsed.houseTourLinks)) setHouseTourLinks(parsed.houseTourLinks)
    if (typeof parsed.houseTourUrl === 'string') setHouseTourUrl(parsed.houseTourUrl)
    if (Array.isArray(parsed.blogCards)) setBlogCards(parsed.blogCards)
    if (Array.isArray(parsed.layoutSections)) {
      const normalized = normalizeLayoutSections(parsed.layoutSections)
      setLayoutSections(normalized)
      setVisibleSectionIds(normalized.filter((section: { visible: boolean }) => section.visible).map((section: { id: string }) => section.id))
    }
  }

  useEffect(() => {
    let cancelled = false
    api.public.checkAgentHub(agentSlug).then(response => {
      if (cancelled) return
      setHubStatus(response.success ? 'found' : 'not-found')
      // The database config (set via the editor's Save button, hitting PUT /agent-hub/me/config)
      // is what every real visitor should see, regardless of whose browser they're on. Only fall
      // back to this browser's localStorage draft below if nothing's been saved to the backend yet.
      if (response.success && response.data?.config && Object.keys(response.data.config).length > 0) {
        applyHubConfig(response.data.config)
      } else {
        loadLocalFallback()
      }
    })
    return () => { cancelled = true }
  }, [agentSlug])

  useEffect(() => {
    api.public.getPublicForms(agentSlug).then(response => {
      if (response.success && response.data) setPublicForms(response.data)
    })
  }, [agentSlug])

  useEffect(() => {
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

  // Fallback for when nothing's been saved to the backend yet for this slug (e.g. the owner
  // previewing their own still-unpublished draft in the same browser as the editor).
  const loadLocalFallback = () => {
    const savedHub = localStorage.getItem('agentHubSavedData')
    if (savedHub) {
      try {
        applyHubConfig(JSON.parse(savedHub))
        return
      } catch {
        setProfile(defaultProfile)
      }
    }

    const savedTourUrl = localStorage.getItem('agentHubHouseTourUrl')
    if (savedTourUrl) setHouseTourUrl(savedTourUrl)
    const savedVisitorDarkMode = localStorage.getItem('agentHubVisitorDarkMode')
    if (savedVisitorDarkMode) setVisitorDarkMode(JSON.parse(savedVisitorDarkMode))

    const saved = localStorage.getItem('agentHubVisibleSections')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setVisibleSectionIds(parsed)
      } catch {
        setVisibleSectionIds(defaultVisibleSectionIds)
      }
    }

    const savedLayout = localStorage.getItem('agentHubLayoutSections')
    if (savedLayout) {
      try {
        const parsedLayout = JSON.parse(savedLayout)
        if (Array.isArray(parsedLayout)) {
          const normalized = normalizeLayoutSections(parsedLayout)
          setLayoutSections(normalized)
          setVisibleSectionIds(normalized.filter(section => section.visible).map(section => section.id))
        }
      } catch {
        setLayoutSections(defaultLayoutSections)
      }
    }

    const savedProfile = localStorage.getItem('agentHubProfile')
    if (savedProfile) {
      try {
        setProfile({ ...defaultProfile, ...JSON.parse(savedProfile) })
      } catch {
        setProfile(defaultProfile)
      }
    }

    const savedContact = localStorage.getItem('agentHubContact')
    if (savedContact) {
      try {
        setContact({ ...defaultContact, ...JSON.parse(savedContact) })
      } catch {
        setContact(defaultContact)
      }
    }

    const savedSocialLinks = localStorage.getItem('agentHubSocialLinks')
    if (savedSocialLinks) {
      try {
        const parsedSocialLinks = JSON.parse(savedSocialLinks)
        if (Array.isArray(parsedSocialLinks)) setSocialLinks(parsedSocialLinks)
      } catch {
        setSocialLinks([])
      }
    }

    const savedPhoto = localStorage.getItem('agentHubProfilePhotoUrl')
    if (savedPhoto) setProfilePhotoUrl(savedPhoto)
  }

  useEffect(() => {
    recordAgentHubEvent({ type: 'visit' })

    if (!getToken()) {
      const isFromQrCode = new URLSearchParams(window.location.search).get('src') === 'qr'
      api.public.trackAgentHubEvent(agentSlug, isFromQrCode ? 'qr_scan' : 'visit')
    }
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
  const visibleOrderedSections = layoutSections.filter(section => section.visible && isVisible(section.id) && sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, effectiveBlogCards))

  // Sections eligible to take a turn auto-scrolling, in the same top-to-bottom order they're
  // actually laid out on the page. Carousel is mobile-only; desktop still renders shelves and
  // should auto-scroll those shelves when the auto-scroll toggle is on.
  const autoScrollSequence = visibleOrderedSections
    .map(section => section.id)
    .filter(id => {
      if (id === 'sales') return salesAutoScroll && !(salesCarousel && isMobileViewport) && getEligibleSales(recentSales).length >= 2
      if (id === 'videos') return videosAutoScroll && !(videosCarousel && isMobileViewport) && videoLinks.filter(item => item.link?.trim()).length >= 2
      if (id === 'tours') return toursAutoScroll && !(toursCarousel && isMobileViewport) && houseTourLinks.filter(item => item.link?.trim()).length >= 2
      if (id === 'blogs') return blogsAutoScroll && !(blogsCarousel && isMobileViewport) && effectiveBlogCards.filter(item => item.title.trim()).length >= 2
      return false
    })

  useEffect(() => {
    setActiveAutoScrollId(current => {
      if (autoScrollSequence.length === 0) return null
      if (current && autoScrollSequence.includes(current)) return current
      return autoScrollSequence[0]
    })
    // Deliberately keyed off the sequence's contents (order/membership), not its array identity -
    // this recomputes fresh every render otherwise, which would spuriously reset progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScrollSequence.join('|')])

  const advanceAutoScroll = (sectionId: string) => {
    setActiveAutoScrollId(() => {
      const seq = autoScrollSequence
      if (seq.length === 0) return null
      const idx = seq.indexOf(sectionId)
      if (idx === -1) return seq[0]
      return seq[(idx + 1) % seq.length]
    })
  }

  useEffect(() => {
    if (!activeAutoScrollId || autoScrollSequence.length === 0) {
      autoScrollStartedRef.current = false
      return
    }
    const delay = autoScrollStartedRef.current ? (autoScrollSequence.length === 2 ? 3000 : 2000) : 3000
    const timer = setTimeout(() => {
      const currentId = autoScrollSequence.includes(activeAutoScrollId) ? activeAutoScrollId : autoScrollSequence[0]
      autoScrollStartedRef.current = true
      setAutoScrollStep({ id: currentId, nonce: Date.now() })
      advanceAutoScroll(currentId)
    }, delay)
    return () => clearTimeout(timer)
    // Deliberately keyed off the sequence's contents, not its array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAutoScrollId, autoScrollSequence.join('|')])

  const enabledSocialLinks = socialLinks.filter(link => link.enabled && link.url.trim())
  const enabledContacts: { key: string; href: string; icon: LucideIcon; label: string }[] = [
    contact.call.trim() && { key: 'call', href: `tel:${contact.call}`, icon: Phone, label: 'Call' },
    contact.text.trim() && { key: 'text', href: `sms:${contact.text}`, icon: MessageSquare, label: 'Text' },
    contact.email.trim() && { key: 'email', href: `mailto:${contact.email}`, icon: Mail, label: 'Email' },
  ].filter(Boolean) as { key: string; href: string; icon: LucideIcon; label: string }[]
  const totalIconCount = enabledContacts.length + enabledSocialLinks.length
  const iconBoxSize = totalIconCount <= 4 ? 'h-10 w-10 lg:h-12 lg:w-12' : totalIconCount <= 6 ? 'h-11 w-11 lg:h-11 lg:w-11' : totalIconCount <= 8 ? 'h-10 w-10 lg:h-10 lg:w-10' : 'h-9 w-9 lg:h-9 lg:w-9'
  const iconGlyphSize = totalIconCount <= 4 ? 'h-4 w-4 lg:h-5 lg:w-5' : totalIconCount <= 6 ? 'h-[18px] w-[18px] lg:h-[18px] lg:w-[18px]' : totalIconCount <= 8 ? 'h-4 w-4 lg:h-4 lg:w-4' : 'h-[14px] w-[14px] lg:h-[14px] lg:w-[14px]'
  const iconGap = totalIconCount <= 4 ? 'gap-3' : totalIconCount <= 6 ? 'gap-2.5' : totalIconCount <= 8 ? 'gap-2' : 'gap-1.5'
  const saleSummary = getSalesSummary(recentSales)
  const renderStatsSection = () => showSalesStats && (
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
      if (salesCarousel && isMobileViewport) {
        return (
          <section key={id} className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">My Recent Sales</h2>
              <Link href={salesPath} onClick={() => recordAgentHubEvent({ type: 'click', label: 'My Recent Sales: View All' })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">View All &rsaquo;</Link>
            </div>
            <RecentSalesCarousel sales={eligibleSales} linkHref={salesPath} autoScroll={salesAutoScroll} />
          </section>
        )
      }
      return (
        <div key={id}>
          <HubShelf title="My Recent Sales" action="View All" actionHref={salesPath} sameTab itemCount={eligibleSales.length} autoScroll={salesAutoScroll} scrollPulse={autoScrollStep?.id === id ? autoScrollStep.nonce : 0}>
            {eligibleSales.map((sale) => (
              <Link key={sale.id} href={salesPath} onClick={() => recordAgentHubEvent({ type: 'click', label: `Recent Sale: ${sale.address}` })} className="relative h-[118px] w-[172px] shrink-0 snap-start overflow-hidden rounded-[14px] bg-cover bg-center shadow-sm lg:h-[148px]" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                <div className="absolute bottom-2 left-2 right-2 text-white"><p className="text-xl font-black leading-none">{sale.price ? `$${sale.price.toLocaleString()}` : 'Price'}</p><p className="truncate text-xs font-bold">{getSaleLocation(sale)}</p></div>
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
          {eligibleVideos.map((item) => (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `Video: ${item.title || 'YouTube Video'}` })} className="w-[162px] shrink-0 snap-start">
              <div className="relative h-[102px] overflow-hidden rounded-[14px] bg-cover bg-center shadow-sm lg:h-[132px]" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
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
          {eligibleTours.map((item) => (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `House Tour: ${item.title || 'House Tour'}` })} className="w-[180px] shrink-0 snap-start">
              <div className="relative h-[112px] overflow-hidden rounded-[14px] bg-cover bg-center shadow-sm lg:h-[140px]" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
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
                    <div className="flex-1 bg-cover bg-center dark:brightness-90" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
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
            return (
              <a key={item.id} href={href} target={item.link && !isInternal ? '_blank' : undefined} rel={item.link && !isInternal ? 'noreferrer' : undefined} onClick={() => item.link && recordAgentHubEvent({ type: 'click', label: `Blog: ${item.title}` })} className={`w-[198px] shrink-0 snap-start overflow-hidden rounded-[14px] bg-white shadow-sm dark:bg-[#151517] dark:shadow-none ${item.link ? '' : 'pointer-events-none'}`}>
                <div className="h-[92px] bg-cover bg-center dark:brightness-90" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
                <div className="bg-white p-3 dark:bg-[#1A1A1C]">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-black leading-4 text-[#111827] dark:text-white">{item.title}</h3>
                </div>
              </a>
            )
          })}
        </HubShelf>
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
    <div className={visitorDarkMode ? 'dark' : ''}>
    <main className="agent-hub-public relative min-h-screen overflow-hidden bg-[#f7f5f1] text-[#101827] dark:bg-[#0B0B0B] dark:text-[#F3F4F6]">
      {visitorDarkMode && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_18%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-10" />
        </div>
      )}
      <section className="relative mx-auto grid w-full max-w-6xl gap-4 px-5 pb-10 pt-3 lg:grid-cols-[360px_1fr] lg:gap-8 lg:px-8 lg:pt-6">
        <aside className="h-fit lg:sticky lg:top-6">
          <div className="rounded-[28px] border border-gray-200 bg-[#fbfaf7] px-5 pb-3 pt-5 text-center shadow-sm dark:border-gray-800 dark:bg-[#151517] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:px-7 lg:py-7">
          <div className="mx-auto h-[92px] w-[92px] rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B]">
            <div className="h-full w-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePhotoUrl})` }} />
          </div>
          <div className="-mt-5 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">
            {profile.brokerage}
          </div>
          <h1 className="mt-4 font-serif text-[30px] font-black leading-none tracking-tight text-[#111827] dark:text-white">{profile.name}</h1>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
          <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[#778093] dark:text-gray-300">
            <MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}
          </p>
          {renderStatsSection()}
        </div>

        <section className={`mt-2.5 flex w-full flex-wrap items-center justify-center lg:mt-6 ${iconGap}`}>
          {enabledContacts.map(({ key, href, icon, label }) => (
            <IconContact key={key} href={href} icon={icon} label={label} iconSize={iconBoxSize} glyphSize={iconGlyphSize} />
          ))}
          {enabledContacts.length > 0 && enabledSocialLinks.length > 0 && (
            <span className="mx-1 h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:mx-1.5" />
          )}
          {enabledSocialLinks.map(link => (
            <SocialIcon key={link.id} href={link.url} icon={socialIconMap[link.id] || Globe} id={link.id} label={link.label} iconSize={iconBoxSize} glyphSize={iconGlyphSize} />
          ))}
        </section>

        <div className="mt-4 lg:mt-6">
          <section className="grid grid-cols-2 gap-2.5 lg:gap-3">
            <Link
              href={buyingForm ? `${agentHubBasePath}/${buyingForm.slug}` : '#'}
              onClick={() => recordAgentHubEvent({ type: 'form', label: buyingForm?.title || "I'm Buying" })}
              className={`flex h-11 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-sm font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white lg:h-12 lg:text-base ${buyingForm ? '' : 'pointer-events-none opacity-50'}`}
            >
              <Home className="h-4 w-4 lg:h-5 lg:w-5" /> {buyingForm?.title || "I'm Buying"}
            </Link>
            <Link
              href={sellingForm ? `${agentHubBasePath}/${sellingForm.slug}` : '#'}
              onClick={() => recordAgentHubEvent({ type: 'form', label: sellingForm?.title || "I'm Selling" })}
              className={`flex h-11 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-sm font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white lg:h-12 lg:text-base ${sellingForm ? '' : 'pointer-events-none opacity-50'}`}
            >
              <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5" /> {sellingForm?.title || "I'm Selling"}
            </Link>
          </section>
          <Link
            href={homeValueForm ? `${agentHubBasePath}/${homeValueForm.slug}` : '#'}
            onClick={() => recordAgentHubEvent({ type: 'form', label: homeValueForm?.title || "What's My Home Worth?" })}
            className={`mt-3 flex min-h-[48px] items-center justify-center gap-3 rounded-[14px] border border-[#d7b974] bg-white px-4 py-2.5 text-center text-sm font-black leading-tight text-[#111827] shadow-sm dark:border-[#d7b974]/60 dark:bg-[#151517] dark:text-white lg:mt-4 lg:min-h-[56px] lg:py-3 lg:text-base ${homeValueForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <DollarSign className="h-4 w-4 shrink-0 text-[#caa65e] lg:h-5 lg:w-5" /> <span>{homeValueForm?.title || "What's My Home Worth?"}</span> <span className="shrink-0 text-[#9aa2af]">&rsaquo;</span>
          </Link>
          <Link
            href={showingForm ? `${agentHubBasePath}/${showingForm.slug}` : '#'}
            onClick={() => recordAgentHubEvent({ type: 'form', label: showingForm?.title || 'Schedule a Showing' })}
            className={`mt-3 flex h-[46px] items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] text-sm font-black text-[#111827] shadow-lg shadow-[#d2b16f]/30 dark:bg-[#caa65e] dark:text-white lg:mt-4 lg:h-[52px] lg:text-base ${showingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <Calendar className="h-4 w-4 lg:h-5 lg:w-5" /> {showingForm?.title || 'Schedule a Showing'}
          </Link>
        </div>
        {profile.about?.trim() && (
          <section className="mt-6 hidden rounded-[18px] border border-[#d8c08a]/50 bg-white/75 p-5 text-left shadow-sm dark:border-[#d8c08a]/25 dark:bg-[#151517] lg:block">
            <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-xl font-black text-[#111827] dark:text-white">About Me</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[#5f6673] dark:text-gray-300">{profile.about}</p>
          </section>
        )}
        </aside>

        <div className="min-w-0 mt-1.5 lg:mt-0 [&>section:first-child]:!mt-0 [&>div:first-child>section]:!mt-0">
        {visibleOrderedSections.map(section => renderSection(section.id))}

        <footer className="mt-6 border-t border-gray-200 py-5 text-center text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
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

function IconContact({ href, icon: Icon, label, iconSize = 'h-[45px] w-[45px]', glyphSize = 'h-5 w-5' }: { href: string; icon: LucideIcon; label: string; iconSize?: string; glyphSize?: string }) {
  return (
    <a href={href} onClick={() => recordAgentHubEvent({ type: 'click', label })} aria-label={label} className="block shrink-0">
      <span className={`mx-auto flex ${iconSize} items-center justify-center rounded-full bg-[#111827] text-white shadow-sm dark:bg-[#1A1A1C] dark:text-white dark:ring-1 dark:ring-white/10`}>
        <Icon className={glyphSize} />
      </span>
    </a>
  )
}

function SocialIcon({ href, icon: Icon, id, label, iconSize, glyphSize }: { href: string; icon: LucideIcon; id: string; label: string; iconSize: string; glyphSize: string }) {
  return (
    <a href={href.startsWith('http') ? href : `https://${href}`} onClick={() => recordAgentHubEvent({ type: 'click', label })} aria-label={label} className={`flex ${iconSize} shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white`}>
      <Icon className={`${glyphSize} ${getSocialBrandClass(id)}`} />
    </a>
  )
}

function HubShelf({ title, action, actionHref, sameTab = false, children, itemCount = 0, autoScroll = false, scrollPulse = 0 }: { title: string; action: string; actionHref?: string; sameTab?: boolean; children: React.ReactNode; itemCount?: number; autoScroll?: boolean; scrollPulse?: number }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [autoScrollPaused, setAutoScrollPaused] = useState(false)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Measures the real width of one card (plus its gap) from the DOM instead of a
  // guessed pixel constant, so a "next" scroll always lands exactly on a card
  // boundary instead of overshooting/undershooting and clipping the next card.
  const getStepWidth = () => {
    const el = rowRef.current
    if (!el) return 178
    const first = el.firstElementChild as HTMLElement | null
    if (!first) return el.clientWidth || 178
    const gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || '0') || 0
    return first.getBoundingClientRect().width + gap
  }

  const scrollPrevious = () => {
    // Without pausing first, the auto-scroll rAF loop keeps setting scrollLeft every frame and
    // fights this smooth-scroll animation - the arrow click "sometimes" barely moves anything,
    // depending on exactly when the click lands relative to the loop's next tick.
    pauseAutoScroll()
    scrollRowByCard(rowRef.current, -1)
    resumeAutoScrollSoon()
  }

  const scrollNext = () => {
    pauseAutoScroll()
    scrollRowByCard(rowRef.current, 1)
    resumeAutoScrollSoon()
  }

  const pauseAutoScroll = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    setAutoScrollPaused(true)
  }
  const resumeAutoScrollSoon = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => setAutoScrollPaused(false), 1500)
  }
  useEffect(() => () => { if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current) }, [])

  // Desktop/tablet shelves stay in the normal row layout. The parent sends one pulse at a time,
  // so multiple sections never animate simultaneously.
  useEffect(() => {
    if (!autoScroll || !scrollPulse || autoScrollPaused || itemCount < 2) return
    const row = rowRef.current
    if (!row) return
    // Card-aligned step (lib/rowScroll.ts): always lands the next card flush at the row start.
    scrollRowByCard(row, 1, true)
  }, [autoScroll, scrollPulse, autoScrollPaused, itemCount])

  return (
    <section className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">{title}</h2>
        <a href={actionHref ? (sameTab || actionHref.startsWith('/') ? actionHref : actionHref.startsWith('http') ? actionHref : `https://${actionHref}`) : '#'} target={actionHref && !sameTab && !actionHref.startsWith('/') ? '_blank' : undefined} rel={actionHref && !sameTab && !actionHref.startsWith('/') ? 'noreferrer' : undefined} onClick={() => recordAgentHubEvent({ type: 'click', label: `${title}: ${action}` })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">{action} &rsaquo;</a>
      </div>
      <div className="agent-hub-shelf-window relative -mx-5 px-5 lg:mx-0 lg:px-10">
        <div
          ref={rowRef}
          className="agent-hub-desktop-trio scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth"
          onTouchStart={pauseAutoScroll}
          onTouchEnd={resumeAutoScrollSoon}
          onTouchCancel={resumeAutoScrollSoon}
        >
          {children}
        </div>
          <button
          type="button"
          onClick={scrollPrevious}
          className="absolute left-1 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm dark:border-gray-700 dark:bg-white/[0.04] dark:text-white lg:flex"
          aria-label={`Previous ${title}`}
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          className="absolute right-1 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm dark:border-gray-700 dark:bg-white/[0.04] dark:text-white lg:flex"
          aria-label={`Next ${title}`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
