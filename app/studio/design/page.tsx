'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Copy, Download, Image as ImageIcon, LayoutGrid, Loader2, Palette, PenLine, Plus, Printer, Search, Trash2, X } from 'lucide-react'
import { useDesignSaver } from '@/lib/studio/designDownload'
import OhSheet from '@/components/open-house-manager/OhSheet'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { BrandKit, DesignColorMode, DesignProject, DesignStatus, DesignStyleId, LinkedProperty, MarketingMoments, StudioPick } from '@/types'
import { fetchLinkedProperty } from '@/components/studio/PropertySelector'
import { getDesignFormat } from '@/lib/studio/designFormats'
import { DesignSituationId, getSituation } from '@/lib/studio/designSituations'
import { getTemplate } from '@/lib/studio/designTemplates'
import { designAgentFrom, DesignAgentInfo, SAMPLE_DESIGN_AGENT } from '@/lib/studio/designAgent'
import DesignCreateFlow from '@/components/studio/design/DesignCreateFlow'
import SituationCards from '@/components/studio/design/SituationCards'
import { DesignPreview } from '@/components/studio/design/StyleThumbnail'
import BrowseGallery, { BrowsePick } from '@/components/studio/design/BrowseGallery'
import StudioPageHeader from '@/components/studio/StudioPageHeader'
import StorageMeter from '@/components/StorageMeter'
import ConfirmationModal from '@/components/ConfirmationModal'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'

const STATUS_TABS: (DesignStatus | 'ALL')[] = ['ALL', 'DRAFT', 'READY', 'EXPORTED', 'PUBLISHED', 'ARCHIVED']
const CARD_ACTION = 'inline-flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-black text-gray-500 transition hover:bg-gray-100 hover:text-[#111827] disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white lg:flex-row lg:gap-1.5 lg:px-2 lg:text-[11px]'

export default function DesignStudioDashboard() {
  return (
    <AuthGuard>
      <SubscriptionGuard requireStudioDesignAccess>
        <Suspense fallback={null}>
          <DesignStudioDashboardInner />
        </Suspense>
      </SubscriptionGuard>
    </AuthGuard>
  )
}

function DesignStudioDashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null)
  const [hub, setHub] = useState<{ slug?: string | null; config?: Record<string, any> | null } | null>(null)
  useEffect(() => {
    api.studio.getBrandKit().then(res => { if (res.success && res.data) setBrandKit(res.data) })
    api.agentHub.getMine().then(res => { if (res.success && res.data) setHub(res.data) })
  }, [])
  const agent: DesignAgentInfo = useMemo(() => {
    const real = designAgentFrom(user, hub)
    return real.agentName ? real : SAMPLE_DESIGN_AGENT
  }, [user, hub])
  const [designs, setDesigns] = useState<DesignProject[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<DesignStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [libraryTab, setLibraryTab] = useState<'mine' | 'browse'>('mine')
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [justCopiedId, setJustCopiedId] = useState<string | null>(null)
  const [pendingSeed, setPendingSeed] = useState<{ situationId?: DesignSituationId; designType?: string; templateId?: string; styleId?: DesignStyleId; colorMode?: DesignColorMode; property?: LinkedProperty | null; photo?: string } | null>(null)
  // "Fresh from the MLS": the agent's newest listing + latest sale, one tap into the right design.
  const [moments, setMoments] = useState<MarketingMoments | null>(null)
  const [openingShortcut, setOpeningShortcut] = useState<string | null>(null)
  useEffect(() => {
    api.agentHub.marketingMoments().then(res => { if (res.success && res.data) setMoments(res.data) })
  }, [])
  const listingSituation = (status?: string | null): DesignSituationId => {
    const up = String(status || '').toUpperCase()
    if (up.includes('COMING SOON')) return 'coming_soon'
    if (up.includes('CONTRACT') || up.includes('PENDING')) return 'under_contract'
    return 'just_listed'
  }
  // Recent listings + sales that still need their post (older backends only send the two singles).
  const [picks, setPicks] = useState<StudioPick[]>([])
  const [showAllPicks, setShowAllPicks] = useState(false)
  useEffect(() => {
    if (!moments) return
    if (moments.studio_picks) { setPicks(moments.studio_picks); return }
    const fallback: StudioPick[] = []
    if (moments.newest_listing) fallback.push({ ...moments.newest_listing, kind: 'listing', key: moments.newest_listing.listing_key })
    if (moments.latest_sale) fallback.push({ ...moments.latest_sale, kind: 'sale', key: moments.latest_sale.id })
    setPicks(fallback)
  }, [moments])
  // The pick a design is being made from - retired for good once that design is created.
  const [pickInProgress, setPickInProgress] = useState<string | null>(null)
  const dismissPick = (key: string) => {
    setPicks(list => list.filter(p => p.key !== key))
    void api.agentHub.markMomentDone(key)
  }
  const openPick = async (item: StudioPick) => {
    setOpeningShortcut(item.key)
    const sale = item.kind === 'sale' ? { id: item.id, address: item.address, city: item.city, state: item.state, price: item.price ?? undefined, image: item.image ?? undefined, sold_date: item.sold_date ?? undefined, beds: item.beds ?? undefined, baths: item.baths ?? undefined, sqft: item.sqft ?? undefined } : undefined
    const full = item.kind === 'listing' ? [item.address, item.city, item.state].filter(Boolean).join(', ') : item.address
    const { property } = await fetchLinkedProperty(full, sale)
    setOpeningShortcut(null)
    setPickInProgress(item.key)
    setPendingSeed({
      situationId: item.kind === 'sale' ? 'just_sold' : listingSituation(item.status),
      property: property || null,
    })
    setShowCreate(true)
  }

  const loadDesigns = () => {
    setLoading(true)
    api.designs.getMine().then(response => {
      if (response.success && response.data) setDesigns(response.data)
      setLoading(false)
    })
  }

  useEffect(() => { loadDesigns() }, [])

  const openSituation = (situationId: DesignSituationId) => {
    setPendingSeed({ situationId })
    setShowCreate(true)
  }

  const openBrowseCard = (card: BrowsePick) => {
    setPendingSeed({ situationId: card.situationId, designType: card.designType, templateId: card.templateId, styleId: card.styleId, colorMode: card.colorMode })
    setShowCreate(true)
  }

  useEffect(() => {
    // From AI Media's "Design in Studio": that edited photo leads the new design (and its listing
    // comes along when there is one).
    const photo = searchParams.get('photo')
    if (photo) {
      const address = searchParams.get('address')
      const open = (property: LinkedProperty | null) => { setPendingSeed({ photo, property }); setShowCreate(true) }
      if (address) fetchLinkedProperty(address).then(r => open(r.property)).catch(() => open(null))
      else open(null)
      return
    }
    if (searchParams.get('new') === '1') setShowCreate(true)
  }, [searchParams])

  const filtered = useMemo(() => {
    return [...designs].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).filter(design => {
      if (statusTab !== 'ALL' && design.status !== statusTab) return false
      if (search.trim() && !design.name.toLowerCase().includes(search.trim().toLowerCase()) && !design.linked_property?.address?.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [designs, statusTab, search])

  const handleDuplicate = async (id: string) => {
    setDuplicatingId(id)
    const response = await api.designs.duplicate(id)
    setDuplicatingId(null)
    if (response.success && response.data) {
      // The copy lands first in the grid, briefly highlighted.
      setDesigns(list => [response.data!, ...list])
      setJustCopiedId(response.data.id)
      window.setTimeout(() => setJustCopiedId(null), 2400)
    }
  }

  // Download from the list: a social post saves its image; a print piece asks PDF or image first.
  const saver = useDesignSaver()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [printChoice, setPrintChoice] = useState<DesignProject | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const runDownload = async (design: DesignProject, kind: 'png' | 'pdf') => {
    setDownloadingId(design.id)
    const r = await saver.save(design.id, design.name, kind, design.updated_at || null)
    setDownloadingId(null)
    if (r === 'error') { setSavedNote("That file couldn't be made just now - try again in a moment."); return }
    if (r === 'cancelled') return
    if (design.status === 'DRAFT') {
      const res = await api.designs.updateStatus(design.id, 'EXPORTED')
      if (res.success && res.data) setDesigns(list => list.map(d => (d.id === design.id ? { ...d, status: res.data!.status } : d)))
    }
    if (r !== 'waiting') { setSavedNote(r === 'shared' ? 'Saved' : 'Downloaded'); window.setTimeout(() => setSavedNote(null), 2200) }
  }
  const startDownload = (design: DesignProject) => {
    if (getDesignFormat(design.design_type)?.isPrint) {
      setPrintChoice(design)
      // phones: both files start now, so the choice below can open the Share sheet right away
      saver.prebuild(design.id, 'pdf', design.updated_at || null)
      saver.prebuild(design.id, 'png', design.updated_at || null)
      return
    }
    void runDownload(design, 'png')
  }

  // A native browser confirm() dialog read as a jarring "Chrome warning" mid-flow - swapped for
  // the same styled ConfirmationModal used elsewhere in Studio (e.g. AI Property Media's delete).
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const confirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    const response = await api.designs.delete(pendingDeleteId)
    setDeleting(false)
    setPendingDeleteId(null)
    if (response.success) loadDesigns()
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      {/* Phones: the header sits right under the nav bar (owner 10/24: dead space above it). */}
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5 sm:py-10">
        <StudioPageHeader
          icon={Palette}
          kicker="Studio"
          title={<>Marketing <em>in minutes.</em></>}
          subtitle="Flyers, social posts, brochures & campaigns from your listing data."
          asideClassName="w-full lg:w-auto lg:max-w-[560px] lg:self-center lg:-translate-y-3"
          actions={
            // Phones: storage and Create share one row (owner 10/24) - the storage bar gives way.
            <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto sm:gap-3">
              <div className="min-w-0 flex-1 sm:w-64 sm:flex-none"><StorageMeter variant="inline" compact stretch /></div>
              <button
                onClick={() => { setPendingSeed(null); setShowCreate(true) }}
                className="group relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-3.5 py-2.5 text-[13px] font-black sm:gap-2 sm:px-5 sm:py-3 sm:text-sm text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <Plus className="relative h-4 w-4 transition-transform duration-300 group-hover:rotate-90" /> <span className="relative">Create a Design</span>
              </button>
            </div>
          }
        />

        {/* What am I creating marketing for? - the situation is the first choice, not the format,
            so an agent never has to browse hundreds of format/style thumbnails before landing on
            something relevant to what they're actually trying to make. */}
        {/* Fresh from the MLS: each recent listing and sale that still needs its post. Making the
            design (or dismissing it) retires it for good - Studio only nudges for the minimum. One
            fills the row, two share it, three fill it; more wait behind "more". */}
        {picks.length > 0 && (() => {
          const shown = showAllPicks ? picks : picks.slice(0, 3)
          const extra = picks.length - 3
          const solo = picks.length === 1
          return (
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">Fresh from the MLS</p>
              <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/40 to-transparent" />
              {extra > 0 && (
                <button onClick={() => setShowAllPicks(v => !v)} className="group/more inline-flex shrink-0 items-center gap-1 rounded-full border border-[#C9A24D]/40 bg-white/80 px-3 py-1 text-[11px] font-black text-[#8b6a2b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] active:scale-95 dark:bg-white/[0.06] dark:text-[#e8c97a]">
                  {showAllPicks ? 'Show less' : `${extra} more`}
                  <ArrowRight className={`h-3.5 w-3.5 transition-transform duration-300 ${showAllPicks ? '-rotate-90' : 'group-hover/more:translate-x-0.5'}`} />
                </button>
              )}
            </div>
            {/* Phones: compact cards, two to a row. Wider screens: a horizontal card - photo on the
                left, the home and its button on the right, the button well clear of the town line
                (user, 10/17: the hover lift used to cover the city). */}
            <div className={`grid grid-cols-2 gap-2.5 sm:gap-4 ${solo ? 'sm:grid-cols-1' : picks.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
              <AnimatePresence initial={false}>
              {shown.map((item, i) => {
                const sit = getSituation(item.kind === 'sale' ? 'just_sold' : listingSituation(item.status))
                const busy = openingShortcut === item.key
                return (
                  <motion.div
                    key={item.key}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
                    className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#e8c97a]/80 via-[#C9A24D]/25 to-[#C9A24D]/70 p-px shadow-[0_20px_44px_-34px_rgba(139,115,85,.9)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_28px_56px_-30px_rgba(201,162,77,.85)] dark:from-[#C9A24D]/50 dark:via-white/5 dark:to-[#C9A24D]/40 sm:rounded-3xl ${solo ? 'col-span-2 sm:col-span-1' : ''}`}
                  >
                    <div className={`relative flex h-full overflow-hidden rounded-[15px] bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#fffdf8,#fbf6ec)] dark:bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(140deg,#0b0f0e,#111827_60%,#1d1810)] sm:rounded-[23px] ${solo ? 'flex-row' : 'flex-col sm:flex-row'}`}>
                      <div className={`relative shrink-0 overflow-hidden bg-gray-100 dark:bg-white/5 ${solo ? 'w-[42%] sm:w-[40%]' : 'aspect-[16/10] sm:aspect-auto sm:w-[42%]'} sm:min-h-[168px]`}>
                        {item.image ? <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-[1.4s] ease-out [scale:1.1] [transform-origin:78%_14%] group-hover:scale-[1.07]" /> : <Palette className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-gray-300" />}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/10" />
                        <span className={`absolute left-2 top-2 inline-flex cursor-default items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wide shadow sm:text-[9px] ${item.kind === 'sale' ? 'bg-rose-600 text-white' : 'bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[#111827]'}`}>{item.kind === 'sale' ? 'Just sold' : sit?.label || 'New listing'}</span>
                        {item.price ? <span className="absolute bottom-2 left-2.5 font-serif text-sm font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.5)] sm:text-lg">${Number(item.price).toLocaleString()}</span> : null}
                      </div>
                      <button
                        onClick={() => dismissPick(item.key)}
                        title="Not now - don't suggest this one again"
                        aria-label="Dismiss"
                        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white/90 transition hover:bg-black/70 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className={`relative flex min-w-0 flex-1 flex-col ${solo ? 'justify-center p-4 sm:p-6' : 'p-2.5 sm:p-5'}`}>
                        <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
                        <p className="hidden text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a] sm:block">{item.kind === 'sale' ? 'Your latest sale' : 'Your new listing'}</p>
                        <p className={`line-clamp-2 font-serif font-black leading-tight sm:mt-1 text-[#111827] dark:text-white ${solo ? 'text-lg sm:text-2xl' : 'text-[13px] sm:text-lg'}`}>{item.address}</p>
                        <p className={`truncate font-bold text-gray-500 dark:text-white/55 ${solo ? 'mt-1 text-xs sm:text-sm' : 'mt-0.5 text-[11px] sm:text-[12px]'}`}>{[item.city, item.state].filter(Boolean).join(', ')}</p>
                        <button
                          onClick={() => openPick(item)}
                          disabled={!!openingShortcut}
                          className={`lx-shine relative mt-auto inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] font-black text-[#111827] shadow-md shadow-[#C9A24D]/25 transition-[box-shadow,filter] duration-300 hover:shadow-[0_12px_26px_-10px_rgba(201,162,77,.9)] hover:brightness-105 active:scale-[0.97] disabled:opacity-70 ${solo ? 'mt-4 self-start px-5 py-2.5 text-sm' : 'mt-3 w-full px-2 py-2 text-[11px] sm:mt-4 sm:text-[12px]'}`}
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />} <span className="truncate">{sit?.label || 'Design'} post</span>
                          <ArrowRight className="hidden h-3.5 w-3.5 sm:block" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              </AnimatePresence>
            </div>
          </div>
          )
        })()}

        <div className="mt-8">
          <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">What are you creating marketing for?</h2>
          <p className="mb-5 mt-1 text-sm font-semibold text-gray-500 dark:text-white/55">Pick the moment. Studio matches the right sizes, layouts and words.</p>
          <SituationCards onPick={openSituation} />
        </div>

        {/* Your designs / Browse - designs first; Browse is one click away when you want ideas. */}
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#C9A24D]/25 bg-[radial-gradient(120%_160%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(140deg,#fffdf8,#fbf6ec)] p-2 shadow-[0_18px_40px_-34px_rgba(139,115,85,.6)] dark:border-white/[0.08] dark:bg-[linear-gradient(140deg,#0b0f0e,#111827_60%,#1d1810)]">
            <div className="flex gap-1">
              {([['mine', 'Your designs', designs.length], ['browse', 'Browse designs', null]] as const).map(([id, label, count]) => {
                const on = libraryTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setLibraryTab(id)}
                    className={`relative inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-serif text-base font-black transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-white/55 dark:hover:text-white'}`}
                  >
                    {on && <motion.span layoutId="studio-library-tab" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-2xl bg-[#111827] shadow-lg shadow-[#111827]/20 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]" />}
                    <span className="relative flex items-center gap-2">
                      {id === 'mine' ? <Palette className={`h-4 w-4 ${on ? 'text-[#e8c97a] dark:text-[#111827]' : ''}`} /> : <LayoutGrid className={`h-4 w-4 ${on ? 'text-[#e8c97a] dark:text-[#111827]' : ''}`} />}
                      {label}
                      {count !== null && count > 0 && <span className={`rounded-full px-2 py-0.5 font-sans text-[10px] font-black ${on ? 'bg-white/15 text-[#e8c97a] dark:bg-black/10 dark:text-[#111827]' : 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8c97a]'}`}>{count}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            {libraryTab === 'mine' && (
              <div className="relative w-full sm:mr-1 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search designs or properties..."
                  className="w-full rounded-xl border border-gray-200 bg-white/90 py-2.5 pl-9 pr-4 text-sm font-semibold outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/10 dark:border-gray-700 dark:bg-[#151517] dark:text-white"
                />
              </div>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
          {libraryTab === 'browse' ? (
            <motion.div key="browse" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mt-5">
              <BrowseGallery brandKit={brandKit} agent={agent} onPick={openBrowseCard} />
            </motion.div>
          ) : (
            <motion.div key="mine" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              <div className="mt-4 inline-flex flex-wrap gap-1 rounded-full border border-gray-200 bg-white/80 p-1 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                {STATUS_TABS.map(tab => {
                  const on = statusTab === tab
                  return (
                    <button
                      key={tab}
                      onClick={() => setStatusTab(tab)}
                      className={`relative rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'}`}
                    >
                      {on && <motion.span layoutId="studio-status-pill" transition={{ type: 'spring', stiffness: 460, damping: 34 }} className="absolute inset-0 rounded-full bg-[#111827] dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a]" />}
                      <span className="relative">{tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {loading && (
                  <div className="col-span-full flex items-center justify-center gap-2 py-16 text-sm font-bold text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading designs...
                  </div>
                )}
                {!loading && filtered.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-14 text-center dark:border-gray-700">
                    <Palette className="h-8 w-8 text-gray-300" />
                    <p className="font-black text-gray-500 dark:text-gray-400">{designs.length ? 'No designs match' : 'No designs yet'}</p>
                    <p className="text-sm font-semibold text-gray-400">Pick a situation above to start - or browse designs for ideas.</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]">Create a design</button>
                      <button onClick={() => setLibraryTab('browse')} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-black text-gray-500 hover:text-[#111827] dark:border-gray-700 dark:text-gray-300">Browse designs</button>
                    </div>
                  </div>
                )}
                <AnimatePresence mode="popLayout" initial={false}>
                {!loading && filtered.map((design, di) => {
                  const format = getDesignFormat(design.design_type)
                  const situation = design.situation ? getSituation(design.situation) : null
                  return (
                    <motion.div
                      key={design.id}
                      layout
                      initial={{ opacity: 0, y: 14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32, delay: Math.min(di * 0.03, 0.25) }}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-[border-color,box-shadow] duration-300 hover:shadow-[0_22px_44px_-26px_rgba(201,162,77,.7)] dark:bg-[#151517] ${justCopiedId === design.id ? 'border-[#C9A24D] ring-4 ring-[#C9A24D]/20' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`}
                    >
                      <Link href={`/studio/design/${design.id}`} className="block">
                        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[radial-gradient(100%_100%_at_50%_0%,#fbf6ec,#f1ece3)] p-3 dark:bg-white/[0.03]">
                          {format ? (
                            <div className="w-full shadow-[0_6px_18px_rgba(0,0,0,0.18)] transition-transform duration-500 group-hover:scale-[1.04]" style={{ maxWidth: format.aspectRatio < 1 ? `${format.aspectRatio * 100}%` : '100%' }}>
                              <SavedDesignPreview design={design} brandKit={brandKit} agent={agent} />
                            </div>
                          ) : (
                            <Palette className="h-6 w-6 text-gray-300" />
                          )}
                          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">{justCopiedId === design.id ? 'copy' : design.status.toLowerCase()}</span>
                        </div>
                        <div className="px-3 pt-2.5">
                          <p className="truncate text-sm font-black text-[#111827] dark:text-white">{design.name}</p>
                          <p className="truncate text-xs font-semibold text-gray-400">{situation ? situation.label : format?.label || design.design_type}{situation && format ? ` · ${format.label}` : ''}</p>
                        </div>
                      </Link>
                      {/* Edit / Copy / Download (owner 10/24) - phones stack each icon over its word
                          so all three fit a half-width card; Download is the Share sheet there. */}
                      <div className="mt-auto grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-0.5 px-1.5 pb-2 pt-2 sm:gap-1 sm:px-2">
                        <Link href={`/studio/design/${design.id}`} className={CARD_ACTION}>
                          <PenLine className="h-3.5 w-3.5" /> Edit
                        </Link>
                        <button onClick={() => handleDuplicate(design.id)} disabled={duplicatingId === design.id} className={CARD_ACTION}>
                          {duplicatingId === design.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Copy
                        </button>
                        <button onClick={() => startDownload(design)} disabled={saver.busy !== null && downloadingId === design.id} data-testid="design-card-download" className={CARD_ACTION}>
                          {saver.busy && downloadingId === design.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
                        </button>
                        <button onClick={() => setPendingDeleteId(design.id)} title="Delete" aria-label="Delete" className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
      {showCreate && (
        <DesignCreateFlow
          key="create-flow"
          onClose={() => { setShowCreate(false); setPendingSeed(null); setPickInProgress(null); router.replace('/studio/design'); loadDesigns() }}
          onCreated={() => { setLibraryTab('mine'); setStatusTab('ALL'); if (pickInProgress) { dismissPick(pickInProgress); setPickInProgress(null) } }}
          initialSituationId={pendingSeed?.situationId}
          initialDesignType={pendingSeed?.designType}
          initialTemplateId={pendingSeed?.templateId}
          initialStyleId={pendingSeed?.styleId}
          initialColorMode={pendingSeed?.colorMode}
          initialProperty={pendingSeed?.property}
          initialPhoto={pendingSeed?.photo}
        />
      )}
      </AnimatePresence>

      <OhSheet open={!!printChoice} onClose={() => setPrintChoice(null)} width="max-w-md" title="Download" subtitle={printChoice?.name} icon={<Download className="h-5 w-5" />}>
        <div className="space-y-2 p-4">
          {([['pdf', Printer, 'Print-ready PDF', 'Exact size for your printer'], ['png', ImageIcon, 'Image', 'For email, texts or screens']] as const).map(([kind, Icon, label, sub]) => (
            <button key={kind} type="button" data-testid={`design-download-${kind}`}
              onClick={() => { const d = printChoice; setPrintChoice(null); if (d) void runDownload(d, kind) }}
              className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-left transition hover:border-[#C9A24D] active:scale-[0.99] dark:border-white/10 dark:bg-white/5">
              <Icon className="h-5 w-5 shrink-0 text-[#8b7355]" />
              <span><span className="block text-sm font-black text-[#111827] dark:text-white">{label}</span><span className="block text-[11px] font-semibold text-gray-400">{sub}</span></span>
            </button>
          ))}
          <p className="rounded-xl bg-[#fffaf0] px-3 py-2.5 text-[11px] font-semibold leading-snug text-gray-600 dark:bg-white/5 dark:text-gray-300">Before it goes out: if your brokerage reviews marketing, get their OK first.</p>
        </div>
      </OhSheet>
      {saver.sheet}
      <AnimatePresence>
        {savedNote && (
          <motion.div key="saved-note" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-xl dark:bg-white dark:text-[#111827]">
            {savedNote}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={confirmDelete}
        isLoading={deleting}
        title="Delete this design?"
        message="This removes it from your projects for good. This cannot be undone."
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/30"
      />
    </div>
  )
}

// A saved design exactly as it renders in the editor - its own blocks, style, color and layout.
function SavedDesignPreview({ design, brandKit, agent }: { design: DesignProject; brandKit: BrandKit | null; agent: DesignAgentInfo }) {
  const format = getDesignFormat(design.design_type)
  if (!format) return null
  const template = design.template_id ? getTemplate(design.template_id) : undefined
  return (
    <DesignPreview
      rounded={false}
      blocks={design.blocks}
      ctx={{
        format,
        styleId: design.style_id as DesignStyleId,
        colorMode: (design.color_mode || 'light') as DesignColorMode,
        composition: template?.composition,
        layoutHints: template?.layoutHints,
        situation: design.situation || null,
        property: design.linked_property || null,
        ...agent,
        brandKit,
        brandingMode: design.branding_mode,
      }}
    />
  )
}
