'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Home, Mail, MapPin, TrendingUp } from 'lucide-react'
import api from '@/lib/api-service'
import { HubAgentPhoto, HubLuxeDecor, HubLuxeStyles, hubLuxeMetalClass, isHubPhotoSet } from '@/components/agent-hub/HubLuxeTheme'
import { HUB_CLASSIC_DEFAULT_ACCENT, HubClassicStyles, hubAccentOf, hubAccentStyle, hubClassicClass } from '@/components/agent-hub/HubClassicTheme'
import ListingFeatureCard from '@/components/agent-hub/ListingFeatureCard'
import HubHomeGridCard from '@/components/agent-hub/HubHomeGridCard'
import useHubColorMode from '@/components/agent-hub/useHubColorMode'
import Pager from '@/components/Pager'
import { AgentSale, isEligibleListing, isEligibleSale } from '@/lib/agentSales'
import { type MlsOpenHouse } from '@/lib/mlsOpenHouses'
import { PublicFormSummary } from '@/types'
import { OhpWordmark } from '@/components/brand/OhpBrand'

// The agent's Sales page: what's on the market right now up top, everything they've sold below.
// (There used to be a separate Listings page - one home on it looked like no experience at all.)
//   - One current listing fills the row as a feature; two share it; three or more grid up.
//   - Past sales page four rows at a time (1 / 2 / 3 per row by screen), so the page never runs long.

type HubListing = AgentSale & { open_houses?: MlsOpenHouse[] }

const defaultProfile = { name: '', title: '', brokerage: '', market: '' }
const defaultContact = { call: '', text: '', email: '' }
const ROWS_PER_PAGE = 4

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

/** How many cards share a row at the current width - the page size is four of those rows. */
function useGridColumns() {
  const [cols, setCols] = useState(3)
  useEffect(() => {
    const lg = window.matchMedia('(min-width: 1024px)')
    const sm = window.matchMedia('(min-width: 640px)')
    const update = () => setCols(lg.matches ? 3 : sm.matches ? 2 : 1)
    update()
    lg.addEventListener('change', update)
    sm.addEventListener('change', update)
    return () => { lg.removeEventListener('change', update); sm.removeEventListener('change', update) }
  }, [])
  return cols
}

export default function AgentHubSalesPage() {
  const params = useParams<{ slug: string }>()
  const agentSlug = params.slug
  // An IDX site opens the hub with ?idx_light=1 - always light there, like the hub page itself.
  const forceLightMode = useSearchParams().get('idx_light') === '1'
  const agentHubBasePath = `/${agentSlug}`
  const [profile, setProfile] = useState(defaultProfile)
  const [contact, setContact] = useState(defaultContact)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [listings, setListings] = useState<HubListing[]>([])
  const [sales, setSales] = useState<AgentSale[]>([])
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [luxe, setLuxe] = useState(false)
  const [luxeMetal, setLuxeMetal] = useState('gold')
  const [hubAccent, setHubAccent] = useState(HUB_CLASSIC_DEFAULT_ACCENT)
  const [publicForms, setPublicForms] = useState<PublicFormSummary[]>([])
  const [hubStatus, setHubStatus] = useState<'loading' | 'found' | 'not-found'>('loading')

  useEffect(() => {
    if (!agentSlug) return
    let cancelled = false
    // Same database config the profile page reads (set via the editor's Save button) - the
    // single source of truth for every real visitor, not this browser's localStorage draft.
    api.public.checkAgentHub(agentSlug).then(response => {
      if (cancelled) return
      setHubStatus(response.success ? 'found' : 'not-found')
      const config = response.data?.config
      if (config) {
        if (config.profile) setProfile({ ...defaultProfile, ...config.profile })
        if (config.contact) setContact({ ...defaultContact, ...config.contact })
        if (isHubPhotoSet(config.profilePhotoUrl)) setProfilePhotoUrl(config.profilePhotoUrl)
        if (Array.isArray(config.myListings)) setListings(config.myListings)
        if (Array.isArray(config.recentSales)) setSales(config.recentSales)
        if (typeof config.visitorDarkMode === 'boolean') setVisitorDarkMode(config.visitorDarkMode)
        setLuxe(config.hubTheme === 'luxe')
        if (typeof config.hubLuxeMetal === 'string') setLuxeMetal(config.hubLuxeMetal)
        setHubAccent(hubAccentOf(config.hubAccent))
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

  const visibleListings = useMemo(() => listings.filter(listing => listing.visible !== false && isEligibleListing(listing)), [listings])
  const visibleSales = useMemo(
    () => sales.filter(sale => sale.visible !== false && isEligibleSale(sale)).sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || ''))),
    [sales],
  )
  const eligibleSales = useMemo(() => sales.filter(sale => isEligibleSale(sale)), [sales])
  const totalVolume = eligibleSales.reduce((sum, sale) => sum + (sale.price || 0), 0)

  // Past sales, four rows at a time.
  const cols = useGridColumns()
  const pageSize = cols * ROWS_PER_PAGE
  const totalPages = Math.max(1, Math.ceil(visibleSales.length / pageSize))
  const [page, setPage] = useState(1)
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const pagedSales = visibleSales.slice((page - 1) * pageSize, page * pageSize)
  const salesHeadingRef = useRef<HTMLDivElement>(null)
  const changePage = (next: number) => {
    setPage(next)
    salesHeadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // The Sales page follows THE HUB'S light/dark choice (it was going dark for app users in dark mode).
  useHubColorMode(visitorDarkMode && !forceLightMode, hubStatus === 'found')

  const buyingForm = publicForms.find(form => form.formType === 'buying')
  const sellingForm = publicForms.find(form => form.formType === 'selling')
  const showingForm = publicForms.find(form => form.formType === 'showing')
  const showingHref = showingForm ? `${agentHubBasePath}/${showingForm.slug}` : undefined

  if (hubStatus === 'not-found') {
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

  if (hubStatus === 'loading') {
    return <div className="min-h-screen bg-[#f7f5f1] dark:bg-[#0B0B0B]" />
  }

  const headingCls = 'border-l-4 border-[#d2b16f] pl-3 font-serif text-3xl font-black text-[#111827] dark:text-white'
  const countPill = (text: string) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${luxe ? 'border border-[rgba(var(--m-rgb),.45)] bg-white/60 text-[var(--m-mid)] dark:bg-white/[0.06] dark:text-[var(--m-light)]' : 'border border-gray-200 bg-white text-[#8b7355] dark:border-gray-700 dark:bg-[#151517] dark:text-[#d7b974]'}`}>{text}</span>
  )

  const dark = visitorDarkMode && !forceLightMode
  return (
    <div className={dark ? 'dark' : ''}>
    <main className={`relative min-h-screen overflow-hidden bg-[#f7f5f1] text-[#101827] dark:bg-[#0B0B0B] dark:text-[#F3F4F6] ${luxe ? `hub-luxe ${hubLuxeMetalClass(luxeMetal)}` : hubClassicClass('classic', hubAccent)}`} style={luxe ? undefined : hubAccentStyle(hubAccent)}>
      {luxe ? <><HubLuxeStyles /><HubLuxeDecor /></> : <HubClassicStyles />}
      {dark && !luxe && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_18%,transparent_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-10" />
        </div>
      )}
      <section className="relative mx-auto max-w-5xl px-5 pb-12 pt-6">
        <Link href={agentHubBasePath} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <header className="hub-lx-panel mt-6 overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col items-center gap-5 p-6 text-center lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:text-left">
            <div className="mx-auto h-24 w-24 rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B] lg:mx-0">
              <HubAgentPhoto url={profilePhotoUrl} name={profile.name} className="rounded-full bg-center" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">{profile.brokerage}</div>
              <h1 className="mt-3 font-serif text-[30px] font-black leading-none text-[#111827] dark:text-white lg:text-4xl">{profile.name || 'Sales'}</h1>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
              {profile.market && <p className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-[#778093] dark:text-gray-300 lg:justify-start"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}</p>}
            </div>
            {eligibleSales.length > 0 && <div className="grid w-full max-w-[24rem] grid-cols-3 gap-2 text-center lg:w-[27rem] lg:max-w-none">
              {([['Sold', String(eligibleSales.length)], ['Volume', formatCompactMoney(totalVolume)], ['Avg', formatCompactMoney(eligibleSales.length ? Math.round(totalVolume / eligibleSales.length) : 0)]] as const).map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-2xl border border-gray-200 bg-white px-2 py-2.5 shadow-sm dark:border-gray-700 dark:bg-[#0f0f0f] md:px-3 md:py-3 lg:px-4 lg:py-4">
                  <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974] md:text-[11px]">{label}</p>
                  <p className="mt-1 truncate text-sm font-black text-[#111827] dark:text-white md:text-lg lg:text-xl">{value}</p>
                </div>
              ))}
            </div>}
          </div>
        </header>

        {visibleListings.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className={headingCls}>Current Listings</h2>
                  {countPill(visibleListings.length === 1 ? '1 home' : `${visibleListings.length} homes`)}
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">On the market right now.</p>
              </div>
            </div>
            {visibleListings.length === 1 ? (
              <div className="mt-5">
                <ListingFeatureCard listing={visibleListings[0]} luxe={luxe} href={visibleListings[0].listingLinkUrl || undefined} showingHref={showingHref} />
              </div>
            ) : (
              <section className={`mt-5 grid gap-5 sm:grid-cols-2 ${visibleListings.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
                {visibleListings.map((listing, i) => <HubHomeGridCard key={listing.id} home={listing} kind="listing" luxe={luxe} href={listing.listingLinkUrl || undefined} index={i} />)}
              </section>
            )}
          </>
        )}

        <div ref={salesHeadingRef} className="mt-8 flex flex-wrap items-end justify-between gap-3 scroll-mt-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className={headingCls}>Past Sales</h2>
              {visibleSales.length > 0 && countPill(visibleSales.length === 1 ? '1 sold' : `${visibleSales.length} sold`)}
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">A closer look at homes this agent has represented.</p>
          </div>
          {totalPages > 1 && <p className="text-[11px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">Page {page} of {totalPages}</p>}
        </div>

        {visibleSales.length === 1 ? (
          <div className="mt-5">
            <ListingFeatureCard listing={visibleSales[0]} luxe={luxe} />
          </div>
        ) : (
          <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pagedSales.map((sale, i) => <HubHomeGridCard key={sale.id} home={sale} kind="sale" luxe={luxe} index={i} />)}
          </section>
        )}

        {!visibleSales.length && (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center font-bold text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
            No past sales to show yet - check back soon.
          </div>
        )}

        <Pager page={page} totalPages={totalPages} onChange={changePage} className="mt-7" />

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link
            href={sellingForm ? `${agentHubBasePath}/${sellingForm.slug}` : '#'}
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white ${sellingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <TrendingUp className="h-5 w-5" /> {sellingForm?.title || "I'm Selling"}
          </Link>
          <a
            href={contact.email ? `mailto:${contact.email}` : '#'}
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] font-black text-white shadow-lg shadow-[#d2b16f]/30 ${contact.email ? '' : 'pointer-events-none opacity-50'}`}
          >
            <Mail className="h-5 w-5" /> Contact Agent
          </a>
          <Link
            href={buyingForm ? `${agentHubBasePath}/${buyingForm.slug}` : '#'}
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white ${buyingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <Home className="h-5 w-5" /> {buyingForm?.title || "I'm Buying"}
          </Link>
        </section>
      </section>
    </main>
    </div>
  )
}
