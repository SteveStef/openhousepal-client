'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { getToken } from '@/lib/token'
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
  if (clean === 'active') return 'bg-emerald-500'
  if (clean === 'pending' || clean === 'coming soon') return 'bg-amber-500'
  if (clean === 'off market') return 'bg-gray-500'
  if (clean === 'sold') return 'bg-rose-500'
  return 'bg-[#8b7355]'
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
  const salesPath = `${agentHubBasePath}/sales`
  const [visibleSectionIds, setVisibleSectionIds] = useState(defaultVisibleSectionIds)
  const [layoutSections, setLayoutSections] = useState(defaultLayoutSections)
  const [profile, setProfile] = useState(defaultProfile)
  const [contact, setContact] = useState(defaultContact)
  const [socialLinks, setSocialLinks] = useState<SavedSocialLink[]>([])
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('/home.jpg')
  const [recentSales, setRecentSales] = useState<AgentSale[]>([])
  const [showSalesStats, setShowSalesStats] = useState(true)
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [videoLinks, setVideoLinks] = useState<HubItem[]>([])
  const [videoChannelUrl, setVideoChannelUrl] = useState('')
  const [houseTourLinks, setHouseTourLinks] = useState<HubItem[]>([])
  const [houseTourUrl, setHouseTourUrl] = useState('')
  const [blogCards, setBlogCards] = useState<HubItem[]>([])

  useEffect(() => {
    recordAgentHubEvent({ type: 'visit' })

    const savedHub = localStorage.getItem('agentHubSavedData')
    if (savedHub) {
      try {
        const parsed = JSON.parse(savedHub)
        if (parsed.profile) setProfile({ ...defaultProfile, ...parsed.profile })
        if (parsed.contact) setContact({ ...defaultContact, ...parsed.contact })
        if (parsed.profilePhotoUrl) setProfilePhotoUrl(parsed.profilePhotoUrl)
        if (Array.isArray(parsed.socialLinks)) setSocialLinks(parsed.socialLinks)
        if (Array.isArray(parsed.recentSales)) setRecentSales(getEligibleSales(parsed.recentSales))
        if (typeof parsed.showSalesStats === 'boolean') setShowSalesStats(parsed.showSalesStats)
        if (typeof parsed.visitorDarkMode === 'boolean') setVisitorDarkMode(parsed.visitorDarkMode)
        if (Array.isArray(parsed.videoLinks)) setVideoLinks(parsed.videoLinks)
        if (typeof parsed.videoChannelUrl === 'string') setVideoChannelUrl(parsed.videoChannelUrl)
        if (Array.isArray(parsed.houseTourLinks)) setHouseTourLinks(parsed.houseTourLinks)
        if (typeof parsed.houseTourUrl === 'string') setHouseTourUrl(parsed.houseTourUrl)
        if (Array.isArray(parsed.blogCards)) setBlogCards(parsed.blogCards)
        if (Array.isArray(parsed.layoutSections)) {
          const normalized = parsed.layoutSections.filter((section: { id: string }) => defaultVisibleSectionIds.includes(section.id))
          setLayoutSections(normalized)
          setVisibleSectionIds(normalized.filter((section: { visible: boolean }) => section.visible).map((section: { id: string }) => section.id))
        }
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
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) setVisibleSectionIds(parsed)
    } catch {
      setVisibleSectionIds(defaultVisibleSectionIds)
    }

    const savedLayout = localStorage.getItem('agentHubLayoutSections')
    if (savedLayout) {
      try {
        const parsedLayout = JSON.parse(savedLayout)
        if (Array.isArray(parsedLayout)) setLayoutSections(parsedLayout.filter((section: { id: string }) => defaultVisibleSectionIds.includes(section.id)))
      } catch {
        setLayoutSections(defaultLayoutSections)
      }
    }

    const savedProfile = localStorage.getItem('agentHubProfile')
    if (savedProfile) {
      try {
        const parsedProfile = JSON.parse(savedProfile)
        setProfile({ ...defaultProfile, ...parsedProfile })
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
  }, [])

  const isVisible = (id: string) => visibleSectionIds.includes(id)
  const visibleOrderedSections = layoutSections.filter(section => section.visible && isVisible(section.id) && sectionHasContent(section.id, recentSales, videoLinks, houseTourLinks, houseTourUrl, blogCards))
  const enabledSocialLinks = socialLinks.filter(link => link.enabled && link.url.trim())
  const socialIconSize = enabledSocialLinks.length <= 2 ? 'h-12 w-12' : enabledSocialLinks.length <= 3 ? 'h-11 w-11' : 'h-10 w-10'
  const socialGlyphSize = enabledSocialLinks.length <= 2 ? 'h-5 w-5' : 'h-[18px] w-[18px]'
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
      return (
        <div key={id}>
          <HubShelf title="My Recent Sales" action="View All" actionHref={salesPath} sameTab>
            {getEligibleSales(recentSales).filter(sale => sale.visible).map((sale) => (
              <Link key={sale.id} href={salesPath} onClick={() => recordAgentHubEvent({ type: 'click', label: `Recent Sale: ${sale.address}` })} className="relative h-[108px] w-[172px] shrink-0 overflow-hidden rounded-[14px] bg-cover bg-center shadow-sm" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase text-white ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                <div className="absolute bottom-2 left-2 right-2 text-white"><p className="text-xl font-black leading-none">{sale.price ? `$${sale.price.toLocaleString()}` : 'Price'}</p><p className="truncate text-xs font-bold">{getSaleLocation(sale)}</p></div>
              </Link>
            ))}
          </HubShelf>
        </div>
      )
    }

    if (id === 'videos') {
      return (
        <HubShelf key={id} title="My Videos" action="YouTube" actionHref={videoChannelUrl}>
          {videoLinks.filter(item => item.link?.trim()).map((item) => (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `Video: ${item.title || 'YouTube Video'}` })} className="w-[162px] shrink-0">
              <div className="relative h-[92px] overflow-hidden rounded-[14px] bg-cover bg-center shadow-sm" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-black/10" />
                <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm backdrop-blur-[1px]"><Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" /></span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'YouTube Video'}</p>
            </a>
          ))}
        </HubShelf>
      )
    }

    if (id === 'tours') {
      const tourActionHref = houseTourUrl || houseTourLinks.find(item => item.link?.trim())?.link || ''
      return (
        <HubShelf key={id} title="House Tours" action="Watch" actionHref={tourActionHref}>
          {houseTourLinks.filter(item => item.link?.trim()).map((item) => (
            <a key={item.id} href={item.link?.startsWith('http') ? item.link : `https://${item.link}`} target="_blank" rel="noreferrer" onClick={() => recordAgentHubEvent({ type: 'click', label: `House Tour: ${item.title || 'House Tour'}` })} className="w-[180px] shrink-0">
              <div className="relative h-[102px] overflow-hidden rounded-[14px] bg-cover bg-center shadow-sm" style={{ backgroundImage: `url(${getYoutubeThumbnail(item.link || '') || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-black/10" />
                <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/45 bg-black/20 text-white shadow-sm backdrop-blur-[1px]"><Play className="ml-0.5 h-4 w-4 fill-white/70 text-white/80" /></span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-bold leading-4 text-[#111827] dark:text-white">{item.title || 'House Tour'}</p>
            </a>
          ))}
        </HubShelf>
      )
    }

    if (id === 'blogs') {
      return (
        <HubShelf key={id} title="My Blogs" action="Read All">
          {(blogCards.filter(item => item.title.trim()).length ? blogCards.filter(item => item.title.trim()) : blogs.map(([title, date], index): HubItem => ({ id: `fallback-blog-${index}`, title, description: date, image: '', link: '' }))).map((item) => (
            <a key={item.id} href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'} target={item.link ? '_blank' : undefined} rel={item.link ? 'noreferrer' : undefined} onClick={() => item.link && recordAgentHubEvent({ type: 'click', label: `Blog: ${item.title}` })} className={`w-[198px] shrink-0 overflow-hidden rounded-[14px] bg-white shadow-sm dark:bg-[#151517] dark:shadow-none ${item.link ? '' : 'pointer-events-none'}`}>
              <div className="h-[92px] bg-cover bg-center dark:brightness-90" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
              <div className="bg-white p-3 dark:bg-[#1A1A1C]">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                <h3 className="mt-1 line-clamp-2 text-sm font-black leading-4 text-[#111827] dark:text-white">{item.title}</h3>
              </div>
            </a>
          ))}
        </HubShelf>
      )
    }

    return null
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
      <section className="relative mx-auto grid w-full max-w-6xl gap-8 px-5 pb-10 pt-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <aside className="h-fit lg:sticky lg:top-6">
          <div className="rounded-[28px] border border-gray-200 bg-[#fbfaf7] px-7 py-7 text-center shadow-sm dark:border-gray-800 dark:bg-[#151517] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="mx-auto h-[92px] w-[92px] rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B]">
            <div className="h-full w-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePhotoUrl})` }} />
          </div>
          <div className="-mt-2 inline-flex rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] shadow-sm dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">
            {profile.brokerage}
          </div>
          <h1 className="mt-4 font-serif text-[30px] font-black leading-none tracking-tight text-[#111827] dark:text-white">{profile.name}</h1>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
          <p className="mt-3 flex items-center justify-center gap-1 text-sm text-[#778093] dark:text-gray-300">
            <MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}
          </p>
          {renderStatsSection()}
        </div>

        <section className="mt-5 flex justify-center gap-4 text-center">
          <IconContact href={contact.call ? `tel:${contact.call}` : '#'} icon={Phone} label="Call" disabled={!contact.call} />
          <IconContact href={contact.text ? `sms:${contact.text}` : '#'} icon={MessageSquare} label="Text" disabled={!contact.text} />
          <IconContact href={contact.email ? `mailto:${contact.email}` : '#'} icon={Mail} label="Email" disabled={!contact.email} />
        </section>

        <section className="mt-4 flex justify-center gap-3">
          {enabledSocialLinks.map(link => (
            <SocialIcon key={link.id} href={link.url} icon={socialIconMap[link.id] || Globe} id={link.id} label={link.label} iconSize={socialIconSize} glyphSize={socialGlyphSize} />
          ))}
        </section>

        <div className="mt-6">
          <section className="grid grid-cols-2 gap-3">
            <a href="#" onClick={() => recordAgentHubEvent({ type: 'form', label: 'Buying' })} className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-base font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white">
              <Home className="h-5 w-5" /> Buying
            </a>
            <a href="#" onClick={() => recordAgentHubEvent({ type: 'form', label: 'Selling' })} className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white text-base font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white">
              <TrendingUp className="h-5 w-5" /> Selling
            </a>
          </section>
          <a href="#" onClick={() => recordAgentHubEvent({ type: 'form', label: "What's My Home Worth?" })} className="mt-4 flex min-h-[56px] items-center justify-center gap-3 rounded-[14px] border border-[#d7b974] bg-white px-4 py-3 text-center font-black leading-tight text-[#111827] shadow-sm dark:border-[#d7b974]/60 dark:bg-[#151517] dark:text-white">
            <DollarSign className="h-5 w-5 shrink-0 text-[#caa65e]" /> <span>What's My Home Worth?</span> <span className="shrink-0 text-[#9aa2af]">&rsaquo;</span>
          </a>
          <a href="#" onClick={() => recordAgentHubEvent({ type: 'click', label: 'Book Appointment or Call' })} className="mt-4 flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] text-base font-black text-white shadow-lg shadow-[#d2b16f]/30 dark:bg-[#caa65e]">
            <Calendar className="h-5 w-5" /> Book Appointment or Call
          </a>
        </div>
        {profile.about?.trim() && (
          <section className="mt-6 hidden rounded-[18px] border border-[#d8c08a]/50 bg-white/75 p-5 text-left shadow-sm dark:border-[#d8c08a]/25 dark:bg-[#151517] lg:block">
            <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-xl font-black text-[#111827] dark:text-white">About Me</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[#5f6673] dark:text-gray-300">{profile.about}</p>
          </section>
        )}
        </aside>

        <div className="min-w-0">
        {visibleOrderedSections.map(section => renderSection(section.id))}

        <footer className="mt-6 border-t border-gray-200 py-5 text-center text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Powered by <Link href="/" className="font-black text-[#111827] dark:text-white">OpenHousePal</Link>
        </footer>
        </div>
      </section>
    </main>
    </div>
  )
}

function IconContact({ href, icon: Icon, label, disabled = false }: { href: string; icon: LucideIcon; label: string; disabled?: boolean }) {
  return (
    <a href={href} onClick={() => !disabled && recordAgentHubEvent({ type: 'click', label })} className={`block ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <span className="mx-auto flex h-[45px] w-[45px] items-center justify-center rounded-full bg-[#111827] text-white shadow-sm dark:bg-[#1A1A1C] dark:text-white dark:ring-1 dark:ring-white/10">
        <Icon className="h-5 w-5" />
      </span>
    </a>
  )
}

function SocialIcon({ href, icon: Icon, id, label, iconSize, glyphSize }: { href: string; icon: LucideIcon; id: string; label: string; iconSize: string; glyphSize: string }) {
  return (
    <a href={href.startsWith('http') ? href : `https://${href}`} onClick={() => recordAgentHubEvent({ type: 'click', label })} aria-label={label} className={`flex ${iconSize} items-center justify-center rounded-xl border border-gray-200 bg-white text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white`}>
      <Icon className={`${glyphSize} ${getSocialBrandClass(id)}`} />
    </a>
  )
}

function HubShelf({ title, action, actionHref, sameTab = false, children }: { title: string; action: string; actionHref?: string; sameTab?: boolean; children: React.ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null)

  const scrollPrevious = () => {
    rowRef.current?.scrollBy({ left: -178, behavior: 'smooth' })
  }

  const scrollNext = () => {
    rowRef.current?.scrollBy({ left: 178, behavior: 'smooth' })
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="border-l-4 border-[#d2b16f] pl-2 font-serif text-[22px] font-black text-[#111827] dark:text-white">{title}</h2>
        <a href={actionHref ? (sameTab || actionHref.startsWith('/') ? actionHref : actionHref.startsWith('http') ? actionHref : `https://${actionHref}`) : '#'} target={actionHref && !sameTab && !actionHref.startsWith('/') ? '_blank' : undefined} rel={actionHref && !sameTab && !actionHref.startsWith('/') ? 'noreferrer' : undefined} onClick={() => recordAgentHubEvent({ type: 'click', label: `${title}: ${action}` })} className="text-[11px] font-black uppercase tracking-wide text-[#caa65e] dark:text-[#d7b974]">{action} &rsaquo;</a>
      </div>
      <div className="relative -mx-5 px-5 lg:mx-0 lg:px-10">
        <div ref={rowRef} className="scrollbar-hide flex gap-3 overflow-x-auto scroll-smooth lg:overflow-hidden">
          {children}
        </div>
          <button
          type="button"
          onClick={scrollPrevious}
          className="absolute left-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm backdrop-blur dark:border-gray-700 dark:bg-white/[0.04] dark:text-white lg:flex"
          aria-label={`Previous ${title}`}
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          className="absolute right-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/85 text-[#111827] shadow-sm backdrop-blur dark:border-gray-700 dark:bg-white/[0.04] dark:text-white lg:flex"
          aria-label={`Next ${title}`}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
