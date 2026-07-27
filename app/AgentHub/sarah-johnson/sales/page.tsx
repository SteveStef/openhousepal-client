'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Home, MapPin, Phone, TrendingUp } from 'lucide-react'

type AgentSale = { id: string; address: string; city: string; state: string; zipcode?: string; price?: number; status?: string; image?: string; sold_date?: string; visible?: boolean }

const defaultProfile = {
  name: '',
  title: '',
  brokerage: '',
  market: '',
}

const formatSaleStatus = (status?: string) => {
  const clean = String(status || 'Sold').replace(/-BRIGHT/gi, '').replace(/_/g, ' ').trim().toLowerCase()
  if (clean.includes('under contract')) return 'Under Contract'
  if (clean.includes('pending')) return 'Pending'
  if (clean.includes('active')) return 'Active'
  if (clean.includes('closed') || clean.includes('sold')) return 'Sold'
  return 'Sold'
}

const isEligibleSale = (sale: AgentSale) => ['Sold', 'Active', 'Pending', 'Under Contract'].includes(formatSaleStatus(sale.status)) && (sale.price || 0) >= 100000

const getStreetOnly = (address?: string) => {
  const firstLine = String(address || '').split(',')[0]?.trim() || 'Address unavailable'
  return firstLine.replace(/\s+(#|apt\.?|unit|suite|ste\.?|fl\.?|floor)\s*[\w-]+.*$/i, '').trim() || firstLine
}

const getSaleLocation = (sale: AgentSale) => [sale.city, sale.state].filter(Boolean).join(', ')

const formatDate = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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

export default function AgentHubSalesPage() {
  const pathname = usePathname()
  const agentHubBasePath = pathname.replace(/\/sales\/?$/, '') || '/AgentHub/sarah-johnson'
  const [profile, setProfile] = useState(defaultProfile)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('/home.jpg')
  const [sales, setSales] = useState<AgentSale[]>([])
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)

  useEffect(() => {
    try {
      const savedHub = localStorage.getItem('agentHubSavedData')
      if (savedHub) {
        const parsed = JSON.parse(savedHub)
        if (parsed.profile) setProfile({ ...defaultProfile, ...parsed.profile })
        if (parsed.profilePhotoUrl) setProfilePhotoUrl(parsed.profilePhotoUrl)
        if (Array.isArray(parsed.recentSales)) setSales(parsed.recentSales)
        if (typeof parsed.visitorDarkMode === 'boolean') setVisitorDarkMode(parsed.visitorDarkMode)
        return
      }

      const savedProfile = localStorage.getItem('agentHubProfile')
      const savedPhoto = localStorage.getItem('agentHubProfilePhotoUrl')
      const savedSales = localStorage.getItem('agentHubRecentSales')
      const savedVisitorDarkMode = localStorage.getItem('agentHubVisitorDarkMode')
      if (savedProfile) setProfile({ ...defaultProfile, ...JSON.parse(savedProfile) })
      if (savedPhoto) setProfilePhotoUrl(savedPhoto)
      if (savedSales) setSales(JSON.parse(savedSales))
      if (savedVisitorDarkMode) setVisitorDarkMode(JSON.parse(savedVisitorDarkMode))
    } catch {
      setSales([])
    }
  }, [])

  const visibleSales = useMemo(
    () => sales.filter(sale => sale.visible !== false && isEligibleSale(sale)).sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || ''))),
    [sales]
  )
  const eligibleSales = useMemo(
    () => sales.filter(sale => isEligibleSale(sale)),
    [sales]
  )
  const totalVolume = eligibleSales.reduce((sum, sale) => sum + (sale.price || 0), 0)

  return (
    <div className={visitorDarkMode ? 'dark' : ''}>
    <main className="relative min-h-screen overflow-hidden bg-[#f7f5f1] text-[#101827] dark:bg-[#0B0B0B] dark:text-[#F3F4F6]">
      {visitorDarkMode && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_18%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-10" />
        </div>
      )}
      <section className="relative mx-auto max-w-5xl px-5 pb-12 pt-6">
        <Link href={agentHubBasePath} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Agent Hub
        </Link>

        <header className="mt-6 overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col items-center gap-5 p-6 text-center lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:text-left">
            <div className="mx-auto h-24 w-24 rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B] lg:mx-0">
              <div className="h-full w-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePhotoUrl})` }} />
            </div>
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">{profile.brokerage}</div>
              <h1 className="mt-3 font-serif text-[30px] font-black leading-none text-[#111827] dark:text-white lg:text-4xl">{profile.name || 'Recent Sales'}</h1>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
              <p className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-[#778093] dark:text-gray-300 lg:justify-start"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}</p>
            </div>
            <div className="grid w-full max-w-[24rem] grid-cols-3 gap-2 text-center lg:w-[27rem] lg:max-w-none">
              <div className="min-w-0 rounded-2xl border border-gray-200 bg-white px-2 py-2.5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] md:px-3 md:py-3 lg:px-4 lg:py-4">
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974] md:text-[11px]">Sold</p>
                <p className="mt-1 truncate text-sm font-black text-[#111827] dark:text-white md:text-lg lg:text-xl">{eligibleSales.length}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-gray-200 bg-white px-2 py-2.5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] md:px-3 md:py-3 lg:px-4 lg:py-4">
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974] md:text-[11px]">Volume</p>
                <p className="mt-1 truncate text-sm font-black text-[#111827] dark:text-white md:text-lg lg:text-xl">{formatCompactMoney(totalVolume)}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-gray-200 bg-white px-2 py-2.5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] md:px-3 md:py-3 lg:px-4 lg:py-4">
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974] md:text-[11px]">Avg</p>
                <p className="mt-1 truncate text-sm font-black text-[#111827] dark:text-white md:text-lg lg:text-xl">{formatCompactMoney(eligibleSales.length ? Math.round(totalVolume / eligibleSales.length) : 0)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="border-l-4 border-[#d2b16f] pl-3 font-serif text-3xl font-black text-[#111827] dark:text-white">Past Sales</h2>
            <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">A closer look at homes this agent has represented.</p>
          </div>
        </div>

        <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSales.map(sale => (
            <article key={sale.id} className="overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
              <div className="relative aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-3 py-1 text-xs font-black uppercase text-white">{formatSaleStatus(sale.status)}</span>
                <p className="absolute bottom-3 left-3 text-2xl font-black text-white">{sale.price ? `$${sale.price.toLocaleString()}` : 'Price unavailable'}</p>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-black leading-tight text-[#111827] dark:text-white">{getStreetOnly(sale.address)}</h3>
                <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-gray-500 dark:text-gray-300"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {getSaleLocation(sale)}</p>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm font-bold text-gray-500 dark:border-gray-700 dark:text-gray-300">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(sale.sold_date) || 'Recent sale'}</span>
                  <span>{formatSaleStatus(sale.status)}</span>
                </div>
              </div>
            </article>
          ))}
        </section>

        {!visibleSales.length && (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center font-bold text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
            Recent sales will appear here after they are added to this Agent Hub.
          </div>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <a href="#" className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white">
            <TrendingUp className="h-5 w-5" /> Selling
          </a>
          <a href="#" className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] font-black text-white shadow-lg shadow-[#d2b16f]/30">
            <Phone className="h-5 w-5" /> Contact Agent
          </a>
          <Link href={agentHubBasePath} className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white">
            <Home className="h-5 w-5" /> Buying
          </Link>
        </section>
      </section>
    </main>
    </div>
  )
}
