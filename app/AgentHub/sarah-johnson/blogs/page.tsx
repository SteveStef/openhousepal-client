'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calendar, Home, MapPin, Phone, TrendingUp } from 'lucide-react'
import api from '@/lib/api-service'
import { PublicFormSummary } from '@/types'

type HubItem = { id: string; title: string; description?: string; image?: string; link?: string }

const defaultProfile = {
  name: '',
  title: '',
  brokerage: '',
  market: '',
}

const blogs = [
  ['Spring 2026 Market Trends on the Main Line', 'May 5, 2026'],
  ['5 Home Staging Tips That Actually Work', 'Apr 22, 2026'],
]

export default function AgentHubBlogsPage() {
  const pathname = usePathname()
  const agentHubBasePath = pathname.replace(/\/blogs\/?$/, '') || '/AgentHub/sarah-johnson'
  const agentSlug = agentHubBasePath.split('/').pop() || 'sarah-johnson'
  const [profile, setProfile] = useState(defaultProfile)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('/home.jpg')
  const [blogCards, setBlogCards] = useState<HubItem[]>([])
  const [visitorDarkMode, setVisitorDarkMode] = useState(false)
  const [publicForms, setPublicForms] = useState<PublicFormSummary[]>([])
  const [hubStatus, setHubStatus] = useState<'loading' | 'found' | 'not-found'>('loading')

  useEffect(() => {
    let cancelled = false
    api.public.checkAgentHub(agentSlug).then(response => {
      if (!cancelled) setHubStatus(response.success ? 'found' : 'not-found')
    })
    return () => { cancelled = true }
  }, [agentSlug])

  useEffect(() => {
    api.public.getPublicForms(agentSlug).then(response => {
      if (response.success && response.data) setPublicForms(response.data)
    })
  }, [agentSlug])

  useEffect(() => {
    try {
      const savedHub = localStorage.getItem('agentHubSavedData')
      if (savedHub) {
        const parsed = JSON.parse(savedHub)
        if (parsed.profile) setProfile({ ...defaultProfile, ...parsed.profile })
        if (parsed.profilePhotoUrl) setProfilePhotoUrl(parsed.profilePhotoUrl)
        if (Array.isArray(parsed.blogCards)) setBlogCards(parsed.blogCards)
        if (typeof parsed.visitorDarkMode === 'boolean') setVisitorDarkMode(parsed.visitorDarkMode)
        return
      }

      const savedProfile = localStorage.getItem('agentHubProfile')
      const savedPhoto = localStorage.getItem('agentHubProfilePhotoUrl')
      const savedBlogCards = localStorage.getItem('agentHubBlogCards')
      const savedVisitorDarkMode = localStorage.getItem('agentHubVisitorDarkMode')
      if (savedProfile) setProfile({ ...defaultProfile, ...JSON.parse(savedProfile) })
      if (savedPhoto) setProfilePhotoUrl(savedPhoto)
      if (savedBlogCards) setBlogCards(JSON.parse(savedBlogCards))
      if (savedVisitorDarkMode) setVisitorDarkMode(JSON.parse(savedVisitorDarkMode))
    } catch {
      setBlogCards([])
    }
  }, [])

  const eligibleBlogs = useMemo(() => {
    const cards = blogCards.filter(item => item.title.trim())
    return cards.length ? cards : blogs.map(([title, date], index): HubItem => ({ id: `fallback-blog-${index}`, title, description: date, image: '', link: '' }))
  }, [blogCards])
  const buyingForm = publicForms.find(form => form.formType === 'buying')
  const sellingForm = publicForms.find(form => form.formType === 'selling')

  if (hubStatus === 'not-found') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f5f1] px-6 text-center dark:bg-[#0B0B0B]">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">OpenHousePal</p>
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
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <header className="mt-6 overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col items-center gap-5 p-6 text-center lg:grid lg:grid-cols-[auto_1fr] lg:items-center lg:text-left">
            <div className="mx-auto h-24 w-24 rounded-full border-2 border-[#cdaa64] bg-white p-1 shadow-sm dark:bg-[#0B0B0B] lg:mx-0">
              <div className="h-full w-full rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${profilePhotoUrl})` }} />
            </div>
            <div className="min-w-0">
              <div className="inline-flex rounded-full border border-gray-200 bg-[#fbfaf7] px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#8b7355] dark:border-gray-700 dark:bg-[#1A1A1C] dark:text-[#d7b974]">{profile.brokerage}</div>
              <h1 className="mt-3 font-serif text-[30px] font-black leading-none text-[#111827] dark:text-white lg:text-4xl">{profile.name || 'My Blogs'}</h1>
              <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
              <p className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-[#778093] dark:text-gray-300 lg:justify-start"><MapPin className="h-4 w-4 text-[#d0ad65]" /> {profile.market}</p>
            </div>
          </div>
        </header>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="border-l-4 border-[#d2b16f] pl-3 font-serif text-3xl font-black text-[#111827] dark:text-white">All Blog Posts</h2>
            <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Every article this agent has published.</p>
          </div>
        </div>

        <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {eligibleBlogs.map(item => (
            <a
              key={item.id}
              href={item.link ? (item.link.startsWith('http') ? item.link : `https://${item.link}`) : '#'}
              target={item.link ? '_blank' : undefined}
              rel={item.link ? 'noreferrer' : undefined}
              className={`overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517] ${item.link ? '' : 'pointer-events-none'}`}
            >
              <div className="relative aspect-[4/3] bg-cover bg-center" style={{ backgroundImage: `url(${item.image || '/placeholder.jpg'})` }} />
              <div className="p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#d0ad65] dark:text-[#d7b974]">{item.description || 'Blog'}</p>
                <h3 className="mt-2 text-lg font-black leading-tight text-[#111827] dark:text-white">{item.title}</h3>
              </div>
            </a>
          ))}
        </section>

        {!eligibleBlogs.length && (
          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center font-bold text-gray-500 dark:border-gray-700 dark:bg-[#151517] dark:text-gray-300">
            Blog posts will appear here after they are added to this Agent Hub.
          </div>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link
            href={sellingForm ? `${agentHubBasePath}/${sellingForm.slug}` : '#'}
            className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border border-gray-200 bg-white font-black text-[#111827] shadow-sm dark:border-gray-700 dark:bg-[#151517] dark:text-white ${sellingForm ? '' : 'pointer-events-none opacity-50'}`}
          >
            <TrendingUp className="h-5 w-5" /> {sellingForm?.title || "I'm Selling"}
          </Link>
          <a href="#" className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#d2b16f] font-black text-white shadow-lg shadow-[#d2b16f]/30">
            <Phone className="h-5 w-5" /> Contact Agent
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
