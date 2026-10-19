'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Bath, Bed, Check, Eye, ExternalLink, Globe, Home, Inbox, Loader2, Maximize, Plus, Sparkles, Trash2, Users, X,
} from 'lucide-react'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import PageHeader from '@/components/PageHeader'
import ConfirmationModal from '@/components/ConfirmationModal'
import ListingPhotoSearch from '@/components/studio/media/ListingPhotoSearch'
import api from '@/lib/api-service'
import { propertyWebsitePublicUrl } from '@/lib/publicResourceLinks'
import { getEligibleSales } from '@/lib/agentSales'
import LuxeHero, { LuxeStats, luxePill } from '@/components/ui/LuxeHero'
import type { LinkedProperty, MarketingListing, PropertyWebsite, PropertyWebsiteAnalytics } from '@/types'
import { statusInfo, STATUS_COLORS } from '@/components/property-sites/spotlight/model'
import { motion } from 'framer-motion'
import SpotlightPicks from '@/components/property-sites/SpotlightPicks'

const EMPTY_STATS: { unique_visitors: number; total_views: number; leads?: number } = { unique_visitors: 0, total_views: 0 }

function PropertySitesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sites, setSites] = useState<PropertyWebsite[]>([])
  const [analytics, setAnalytics] = useState<PropertyWebsiteAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [picked, setPicked] = useState<LinkedProperty | null>(null)
  // Listings with no Spotlight yet (a new listing leads) - featured above the pages.
  const [ready, setReady] = useState<MarketingListing[]>([])
  useEffect(() => {
    api.agentHub.marketingMoments().then(res => { if (res.success && res.data) setReady(res.data.needs_spotlight) })
  }, [])
  // Recommendations: brand-new listings first, then the most recently listed (SpotlightPicks lays them out).
  const picks = useMemo(() => ready
    .filter(l => !sites.some(s => s.listing_key === l.listing_key))
    .sort((a, b) => Number(b.is_new) - Number(a.is_new) || (a.days_on_market ?? 9999) - (b.days_on_market ?? 9999)), [ready, sites])
  const startFor = (l: MarketingListing) => {
    setPicked({
      listing_key: l.listing_key, address: l.address, city: l.city, state: l.state, zipcode: l.zipcode || undefined,
      price: l.price ?? undefined, beds: l.beds ?? undefined, baths: l.baths ?? undefined, sqft: l.sqft ?? undefined,
      image_url: l.image || undefined, photos: l.photos || undefined, status: l.status || undefined,
    } as LinkedProperty)
    setShowCreate(true)
  }
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PropertyWebsite | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    const [list, stats] = await Promise.all([api.propertySites.list(), api.propertySites.analytics()])
    if (list.success && list.data) setSites(list.data)
    if (stats.success && stats.data) setAnalytics(stats.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  // The header flips through the agent's own homes: their current listings when they have any,
  // otherwise their recent sales (the list they curate in Agent Hub), then their pages' photos.
  const [covers, setCovers] = useState<string[]>([])
  useEffect(() => {
    ;(async () => {
      const res = await api.openHouseManager.getMyListings()
      const active = (res.success && res.data ? res.data.listings : [])
        .filter(l => !/closed|sold|expired|withdrawn|cancel/i.test(l.status || ''))
        .map(l => l.image || l.photos?.[0])
        .filter((u): u is string => !!u)
      if (active.length) { setCovers(active.slice(0, 6)); return }
      const mine = await api.agentHub.getMine()
      const config: any = (mine.success && mine.data?.config) || {}
      let list = getEligibleSales(Array.isArray(config.recentSales) ? config.recentSales : [])
      if (!list.length) {
        const r = await api.agentHub.getRecentSales()
        list = getEligibleSales(Array.isArray(r.data) ? (r.data as any[]) : [])
      }
      setCovers(list
        .filter(x => x.visible !== false && x.image)
        .sort((x, y) => String(y.sold_date || '').localeCompare(String(x.sold_date || '')))
        .slice(0, 6)
        .map(x => x.image as string))
    })()
  }, [])

  const totals = analytics?.totals ?? EMPTY_STATS
  const statsFor = (siteId: string) => analytics?.sites?.[siteId] ?? EMPTY_STATS

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    setShowCreate(true)
    // From an open house card's "Make Spotlight" - the listing arrives already picked.
    const listing = searchParams.get('listing')
    if (listing) {
      const num = (k: string) => { const v = Number(searchParams.get(k)); return Number.isFinite(v) && v > 0 ? v : null }
      setPicked({
        listing_key: listing,
        address: searchParams.get('address') || '',
        city: searchParams.get('city'), state: searchParams.get('state'), zipcode: searchParams.get('zipcode'),
        price: num('price'), beds: num('beds'), baths: num('baths'), sqft: num('sqft'),
        image_url: searchParams.get('image'),
      })
    }
  }, [searchParams])

  const already = useMemo(() => new Set(sites.map(s => s.listing_key).filter(Boolean)), [sites])
  const pickedAlreadyHasSite = !!picked?.listing_key && already.has(picked.listing_key)

  const closeCreate = () => {
    setShowCreate(false)
    setPicked(null)
    setError('')
    router.replace('/studio/property-sites')
  }

  const create = async () => {
    if (!picked) return
    setCreating(true)
    setError('')
    // Only the agent's own current listings can be picked (the server checks it too).
    const { success, data, error: e } = await api.propertySites.create(
      picked.listing_key
        ? { listing_key: picked.listing_key, template_id: 'cinematic_luxury' }
        : { manual_property: picked as unknown as Record<string, unknown>, template_id: 'cinematic_luxury' }
    )
    setCreating(false)
    if (success && data) {
      router.push(`/studio/property-sites/${data.id}?new=1&story=short`)
    } else {
      setError(e || 'Could not create that site. Try again in a moment.')
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    const { success } = await api.propertySites.remove(pendingDelete.id)
    setDeleting(false)
    setPendingDelete(null)
    if (success) setSites(prev => prev.filter(s => s.id !== pendingDelete.id))
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <style>{CARD_CSS}</style>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <SpotlightHero
          covers={covers.length ? covers : sites.map(x => x.draft_data?.hero_image || x.property_snapshot.photos?.[0]).filter((u): u is string => !!u).slice(0, 5)}
          stats={sites.length ? [
            { label: 'Visitors', value: totals.unique_visitors, icon: Users },
            { label: 'Leads', value: totals.leads ?? 0, icon: Inbox },
            { label: 'Live pages', value: sites.filter(x => x.status === 'PUBLISHED').length, icon: Globe },
          ] : []}
          onCreate={() => setShowCreate(true)}
        />

        <SpotlightPicks picks={picks} onStart={startFor} />

        {loading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
        ) : sites.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-[#151517]">
            <Home className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 font-serif text-lg font-black text-[#111827] dark:text-white">No Listing Spotlight pages yet</p>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">Pick one of your listings and we'll build the first draft automatically.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-black text-white dark:bg-white dark:text-[#111827]">
              <Plus className="h-4 w-4" /> Create your first site
            </button>
          </div>
        ) : (
          <>
          <div className="mb-3 mt-8 flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-[#C9A24D]" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">Your Spotlight pages</p>
            <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/40 to-transparent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site, i) => {
              const p = site.property_snapshot
              const cover = site.draft_data?.hero_image || p.photos?.[0]
              const s = statsFor(site.id)
              const live = site.status === 'PUBLISHED'
              const st = statusInfo(p.status)
              const col = st ? STATUS_COLORS[st.kind] : null
              return (
                <motion.div
                  key={site.id}
                  initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.06, duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
                  className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#e8c97a]/70 via-[#C9A24D]/15 to-[#C9A24D]/60 p-px shadow-[0_24px_50px_-34px_rgba(139,115,85,.9)] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_34px_64px_-30px_rgba(201,162,77,.8)] dark:from-[#C9A24D]/45 dark:via-white/5 dark:to-[#C9A24D]/35"
                >
                  <div className="relative overflow-hidden rounded-[23px] bg-[#fffdf8] dark:bg-[#121214]">
                    <button onClick={() => router.push(`/studio/property-sites/${site.id}`)} className="block w-full text-left">
                      <div className="relative aspect-[16/11] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {cover ? <img src={cover} alt="" className="sp-crop absolute inset-0 h-full w-full object-cover transition duration-[1.6s] ease-out group-hover:scale-[1.08]" /> : <div className="flex h-full items-center justify-center text-gray-300"><Home className="h-8 w-8" /></div>}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25" />
                        <span aria-hidden className="sp-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide shadow ${live ? 'bg-emerald-500/90 text-white' : 'bg-white/85 text-[#111827]'}`}>
                          {live && <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-80" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>}
                          {live ? 'Live' : 'Draft'}
                        </span>
                        {st && col && <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide shadow" style={{ background: col.bg, color: col.fg }}>{st.label}</span>}
                        <div className="absolute inset-x-0 bottom-0 p-4">
                          {p.price ? <p className="font-serif text-xl font-black leading-none text-[#f3dfa8] drop-shadow">${Number(p.price).toLocaleString()}</p> : null}
                          <p className="mt-1.5 truncate whitespace-nowrap font-serif text-lg font-black leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.5)]">{p.address}</p>
                          <div className="mt-1.5 flex items-center gap-3 text-[11px] font-bold text-white/75">
                            {p.city ? <span className="truncate">{p.city}</span> : null}
                            {p.beds ? <span className="inline-flex items-center gap-1"><Bed className="h-3 w-3" />{p.beds}</span> : null}
                            {p.baths ? <span className="inline-flex items-center gap-1"><Bath className="h-3 w-3" />{p.baths}</span> : null}
                            {p.sqft ? <span className="inline-flex items-center gap-1"><Maximize className="h-3 w-3" />{Number(p.sqft).toLocaleString()}</span> : null}
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="relative grid grid-cols-3 divide-x divide-[#C9A24D]/20 border-b border-[#C9A24D]/15 bg-[radial-gradient(120%_200%_at_100%_0%,rgba(201,162,77,.12),transparent_60%)] py-3 dark:divide-white/[0.06] dark:border-white/[0.06]">
                      <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
                      {[
                        { label: 'Visitors', value: s.unique_visitors, icon: Users, title: 'Unique visitors - distinct browsers, your own visits excluded' },
                        { label: 'Visits', value: s.total_views, icon: Eye, title: 'Total visits' },
                        { label: 'Leads', value: s.leads ?? 0, icon: Inbox, title: 'Leads from this page' },
                      ].map(m => (
                        <span key={m.label} title={m.title} className="flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center gap-1 font-serif text-lg font-black leading-none text-[#111827] dark:text-white"><m.icon className="h-3.5 w-3.5 text-[#C9A24D]" />{m.value.toLocaleString()}</span>
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7355]/80 dark:text-white/45">{m.label}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                      {live ? (
                        <a href={`${propertyWebsitePublicUrl(site.slug)}?ohp_owner=1`} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/[0.08] px-2.5 py-1 text-[11px] font-bold text-[#8b6a2b] transition hover:border-[#C9A24D] dark:text-[#e8c97a]">
                          <Globe className="h-3 w-3 shrink-0" /> <span className="truncate">{site.slug}.openhousepal.com</span> <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-[11px] font-semibold text-gray-400">Not published yet</span>
                      )}
                      <button onClick={() => setPendingDelete(site)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label="Delete page">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
          </>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75">
          <div className="mx-auto min-h-full max-w-4xl px-3 py-4 sm:px-4 sm:py-8">
            <div className="sp-pop rounded-3xl bg-white shadow-2xl dark:bg-[#151517]">
              <div className="relative overflow-hidden rounded-t-3xl bg-gradient-to-br from-[#0f1a17] via-[#111827] to-[#3a2c14] px-6 pb-6 pt-6 text-white sm:px-8">
                <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#C9A24D]/30 blur-3xl" />
                <button onClick={closeCreate} className="absolute right-4 top-4 rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
                <p className="relative text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">New Listing Spotlight</p>
                <h2 className="relative mt-2 font-serif text-3xl font-black leading-tight sm:text-4xl">Which home gets the spotlight?</h2>
                <ol className="relative mt-5 grid grid-cols-3 gap-2 text-[11px] font-bold">
                  {[['1', 'Pick the home', true], ['2', 'Design & header', false], ['3', 'Publish & share', false]].map(([n, t, on]) => (
                    <li key={String(n)} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 ${on ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${on ? 'bg-[#C9A24D] text-[#111827]' : 'bg-white/10'}`}>{n}</span>
                      <span className="truncate">{t}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="min-h-[380px] p-5 sm:p-7">
                {/* Same picker Media Lab uses, limited to the agent's own current listings (user,
                    10/19 - a Spotlight is only for your own listing: no sold homes, no address search). */}
                {/* No inner scroll box - every home shows at once and the window itself scrolls,
                    so the address search's dropdown is never clipped either. */}
                <ListingPhotoSearch value={picked} onChange={setPicked} tab="mine" fullHeight currentListingsOnly />
                {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
              </div>

              <div className="sticky bottom-0 rounded-b-3xl border-t border-gray-100 bg-white/95 p-4 dark:border-gray-800 dark:bg-[#151517]/95 sm:px-7">
                {picked ? (
                  <div className="sp-pop flex flex-wrap items-center gap-4">
                    <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 shadow">
                      {(picked.image_url || picked.photos?.[0]) && <img src={picked.image_url || picked.photos?.[0] || ''} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-lg font-black text-[#111827] dark:text-white">{picked.address}</p>
                      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
                        {[picked.city, picked.price ? `$${Number(picked.price).toLocaleString()}` : null, picked.beds ? `${picked.beds} bd` : null, picked.baths ? `${picked.baths} ba` : null].filter(Boolean).join(' · ')}
                      </p>
                      {pickedAlreadyHasSite && <p className="text-[11px] font-black text-amber-600">This home already has a Spotlight page - you can still make another.</p>}
                    </div>
                    <button onClick={create} disabled={creating}
                      className="sp-shine relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-7 py-3.5 text-sm font-black text-[#111827] shadow-xl shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 disabled:opacity-60 sm:w-auto">
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {creating ? 'Setting it up…' : 'Start building'}
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-xs font-bold text-gray-400">Pick a home above - we&apos;ll set up the whole page, then you choose the design one step at a time.</p>
                )}
              </div>
            </div>
          </div>
          <style>{SP_CSS}</style>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this property website?"
        message={`This removes the site at ${pendingDelete?.slug}.openhousepal.com permanently. This can't be undone.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 text-white"
        isLoading={deleting}
      />
    </div>
  )
}

// Listing cards: MLS photos carry the brokerage watermark in the bottom-left corner - a slight
// zoom anchored top-right crops it out. A gold-white light sweeps across on hover.
const CARD_CSS = `
.sp-crop{scale:1.12;transform-origin:78% 14%}
.sp-chip{transition:transform .3s cubic-bezier(.22,.61,.36,1),box-shadow .3s;pointer-events:auto;cursor:default}
.group:hover .sp-chip{transform:translateY(-1px)}
.group .sp-chip:hover{transform:translateY(-1px) scale(1.12);box-shadow:0 6px 16px -4px rgba(0,0,0,.45)}
.sp-sweep{transform:translateX(-120%) skewX(-12deg)}
.group:hover .sp-sweep{transition:transform 1s cubic-bezier(.22,.61,.36,1);transform:translateX(360%) skewX(-12deg)}
`

const SP_CSS = `
.sp-pop{animation:spPop .45s cubic-bezier(.2,.8,.2,1) both}
@keyframes spPop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
.sp-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-100%);animation:spShine 3.2s ease-in-out infinite}
@keyframes spShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.sp-ken{animation:spKen 18s ease-in-out infinite alternate}
@keyframes spKen{from{transform:scale(1.04)}to{transform:scale(1.16)}}
@media (prefers-reduced-motion: reduce){.sp-pop,.sp-shine:after,.sp-ken{animation:none}}
`

// The top of the Listing Spotlight Pages screen: the agent's own homes drifting behind a bold
// headline, one big gold button, and the numbers that matter as glass tiles that count up.
// Listing Spotlight's header - the shared LuxeHero (light ivory in light mode, deep dark in dark
// mode) with the agent's own homes drifting behind it, the page stats and the create button.
function SpotlightHero({ covers, stats, onCreate }: { covers: string[]; stats: { label: string; value: number; icon: typeof Users }[]; onCreate: () => void }) {
  return (
    <LuxeHero
      backHref="/studio"
      backLabel="Tools"
      kicker="Listing Spotlight"
      title={<>Every listing deserves<br /><em>its own stage.</em></>}
      subtitle="A cinematic website for every listing - built for you in seconds."
      covers={covers}
      aside={
        stats.length > 0 ? (
          <>
            <LuxeStats
              large
              stats={stats.map(st => ({ label: st.label, value: <Count to={st.value} />, icon: st.icon }))}
            />
            <button onClick={onCreate} className={`${luxePill(true)} mt-4`}>
              <Plus className="h-4 w-4" /> New Spotlight page
            </button>
          </>
        ) : (
          // No pages yet: how it works, then the button - instead of a lone button floating in space.
          <div className="w-full rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8b7355] dark:text-[#e8c97a]">Your first page in 3 steps</p>
            <ol className="mt-3 space-y-2.5">
              {([
                [Home, 'Pick your listing', 'Any home you have on the market.'],
                [Sparkles, 'We build the page', 'Photos, story and the town - written for you.'],
                [Globe, 'Publish and share', 'One link for texts, emails and social.'],
              ] as const).map(([Icon, title, text], i) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#b8913f] text-[#111827] shadow-sm">
                    <Icon className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#111827] text-[9px] font-black text-white dark:bg-white dark:text-[#111827]">{i + 1}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-black text-[#111827] dark:text-white">{title}</span>
                    <span className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <button onClick={onCreate} className={`${luxePill(true)} mt-4 w-full justify-center`}>
              <Plus className="h-4 w-4" /> New Spotlight page
            </button>
          </div>
        )
      }
    />
  )
}

function Count({ to }: { to: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1200)
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{n.toLocaleString()}</>
}

function OverallStat({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className={`inline-flex items-center gap-1.5 text-xl font-black ${accent ? 'text-[#8b7355] dark:text-[#d7b974]' : 'text-[#111827] dark:text-white'}`}>
        <Icon className="h-4 w-4" /> {value.toLocaleString()}
      </span>
      <span className="text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  )
}

export default function PropertySitesPageGuarded() {
  return (
    <AuthGuard>
      <SubscriptionGuard requiredTier="IDX">
        <PropertySitesPage />
      </SubscriptionGuard>
    </AuthGuard>
  )
}
