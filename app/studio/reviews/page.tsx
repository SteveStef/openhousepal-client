'use client'

import ReviewImporter from '@/components/reviews/ReviewImporter'
import OhpLoader from '@/components/brand/OhpLoader'

// Standalone Reviews page - extracted out of Settings (where it used to be a tab, gated to
// Premium/IDX/Pro No-MLS) so it gets a full page's breathing room. Same real logic/API calls as
// before (share link, show-on-Agent-Hub toggle, Google review import, Google/Zillow destination
// links, and the received-reviews list with publish/hide/delete), laid out with a plain-language
// explainer up top and calmer spacing for someone who has never set up a review funnel before.

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Check, Copy, ExternalLink, Eye, EyeOff, Globe, LayoutTemplate, Link2, Loader2, Mail, MessageCircle, MessageSquareQuote, RefreshCw, Send, ShieldCheck, Sparkles, Star, ThumbsUp, Trash2,
} from 'lucide-react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import AnimatedNumber from '@/components/ui/AnimatedNumber'
import { LuxeSectionHeader, LuxeSurface } from '@/components/ui/LuxeSurface'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import StudioPageHeader from '@/components/studio/StudioPageHeader'
import { copyText } from '@/lib/copyText'
import ZillowLinkHelp, { ZILLOW_REVIEW_PLACEHOLDER } from '@/components/reviews/ZillowLinkHelp'

// Matches the backend's REVIEWS_ACCESS_TIERS - Premium / IDX / Pro No-MLS only.
const REVIEWS_TIERS = ['PREMIUM', 'IDX', 'PRO_NO_MLS']

// A small pill/switch toggle - same look as Settings' Toggle.
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 ${on ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

export default function ReviewsPage() {
  return (
    <AuthGuard>
      <SubscriptionGuard>
        <ReviewsTierGate />
      </SubscriptionGuard>
    </AuthGuard>
  )
}

// Reviews isn't covered by any of SubscriptionGuard's existing named gates (it's a specific
// Premium/IDX/Pro No-MLS set), so this mirrors the same tier check + redirect the old Settings tab
// filter did, sending anyone else to the same upgrade prompt every other gated tool uses.
function ReviewsTierGate() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading || !user) return
    if (user.is_admin) return
    if (!REVIEWS_TIERS.includes(user.plan_tier || '')) {
      // Each track upsells to its own next plan (plain No-MLS -> No-MLS Premium, not Bright Premium).
      router.push(`/upgrade-required?tier=${user.plan_tier === 'NO_MLS' ? 'PRO_NO_MLS' : 'PREMIUM'}&feature=${encodeURIComponent('Client Reviews')}`)
    }
  }, [isLoading, user, router])

  if (isLoading || !user) {
    return (
      <OhpLoader />
    )
  }
  if (!user.is_admin && !REVIEWS_TIERS.includes(user.plan_tier || '')) return null

  return <ReviewsPageInner />
}

function ReviewsPageInner() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.agentHub.listReviews>>['data'] | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleUrl, setGoogleUrl] = useState('')
  const [zillowUrl, setZillowUrl] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [showOnHub, setShowOnHub] = useState(false)
  const [showOnIdx, setShowOnIdx] = useState(false)
  const [minRating, setMinRating] = useState(1)
  // Only IDX plans have a website to show reviews on.
  const { user } = useAuth()
  const hasIdx = user?.plan_tier === 'IDX' || Boolean(user?.is_admin)
  const [savingDests, setSavingDests] = useState(false)
  const [savedDests, setSavedDests] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [filter, setFilter] = useState<'all' | 'public' | 'private' | 'imported'>('all')
  // Opened from a "new review" notification ("?review=...") - that review glows and scrolls into view.
  const focusReviewId = useSearchParams().get('review')
  const scrolledToReview = useRef(false)
  useEffect(() => {
    if (!focusReviewId || scrolledToReview.current) return
    const el = document.getElementById(`review-${focusReviewId}`)
    if (!el) return
    scrolledToReview.current = true
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })

  const load = () => {
    api.agentHub.listReviews().then(r => {
      if (r.success && r.data) {
        setData(r.data)
        setGoogleUrl(r.data.settings.google_review_url || '')
        setZillowUrl(r.data.settings.zillow_review_url || '')
        setPlaceId(r.data.settings.google_place_id || '')
        setShowOnHub(!!r.data.settings.show_on_hub)
        setShowOnIdx(!!r.data.settings.show_on_idx)
        setMinRating(r.data.settings.min_rating ?? 1)
      }
      setLoading(false)
    })
  }
  useEffect(() => { load(); api.agentHub.getMine().then(r => setSlug(r.success && r.data ? r.data.slug : null)) }, [])

  const shareUrl = slug ? `${(typeof window !== 'undefined' ? window.location.origin : '')}/${slug}/review` : ''

  const saveDests = async () => {
    setSavingDests(true)
    const r = await api.agentHub.updateReviewSettings({ google_review_url: googleUrl.trim(), zillow_review_url: zillowUrl.trim(), google_place_id: placeId.trim() })
    setSavingDests(false)
    if (r.success) { setSavedDests(true); setTimeout(() => setSavedDests(false), 1800) }
  }

  const toggleHub = async () => {
    const next = !showOnHub
    setShowOnHub(next)
    await api.agentHub.updateReviewSettings({ show_on_hub: next })
  }
  const toggleIdx = async () => {
    const next = !showOnIdx
    setShowOnIdx(next)
    await api.agentHub.updateReviewSettings({ show_on_idx: next })
  }
  const toggleMinRating = async () => {
    const next = minRating >= 4 ? 1 : 4
    setMinRating(next)
    await api.agentHub.updateReviewSettings({ min_rating: next })
  }

  const importGoogle = async () => {
    setImporting(true); setImportMsg('')
    if (placeId.trim() && placeId.trim() !== (data?.settings.google_place_id || '')) await saveDests()
    const r = await api.agentHub.importGoogleReviews()
    setImporting(false)
    if (r.success && r.data) {
      const { imported, skipped, available, note } = r.data
      setImportMsg(
        available === 0 ? 'Google returned no reviews for that Place ID.'
        : imported === 0 ? `Already up to date — all ${available} Google review${available === 1 ? '' : 's'} are imported.`
        : `Imported ${imported} review${imported === 1 ? '' : 's'} from Google${skipped ? ` (${skipped} already here)` : ''}.${note ? ' ' + note : ''}`,
      )
      load()
    } else {
      setImportMsg(r.error || 'Import failed. Check your Place ID.')
    }
  }

  const setStatus = async (id: string, status: 'published' | 'hidden') => {
    setBusyId(id); await api.agentHub.setReviewStatus(id, status); load(); setBusyId(null)
  }
  const del = async (id: string) => {
    if (!confirm('Delete this review permanently?')) return
    setBusyId(id); await api.agentHub.deleteReview(id); load(); setBusyId(null)
  }

  const avg = data?.summary.average
  const reviews = data?.reviews || []
  const publicCount = reviews.filter(r => r.status !== 'hidden').length
  // What visitors actually see (public, and 4-5 stars only when that's switched on).
  const shownCount = reviews.filter(r => r.status !== 'hidden' && r.rating >= minRating).length
  const privateCount = reviews.filter(r => r.status === 'hidden' && (r.source || 'direct') === 'direct' && r.rating <= 3).length
  const reposted = reviews.filter(r => r.posted_google_at || r.posted_zillow_at).length
  const filtered = reviews.filter(r =>
    filter === 'all' ? true
    : filter === 'public' ? r.status !== 'hidden'
    : filter === 'private' ? r.status === 'hidden' && (r.source || 'direct') === 'direct' && r.rating <= 3
    : (r.source || 'direct') !== 'direct')
  const destsDirty = googleUrl.trim() !== (data?.settings.google_review_url || '') || zillowUrl.trim() !== (data?.settings.zillow_review_url || '')
  const inputCls = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:border-[#C9A24D] focus:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
  const smsHref = `sms:?&body=${encodeURIComponent(`Thank you for letting me help with your move! If you have a minute, a quick review would mean the world: ${shareUrl}`)}`
  const mailHref = `mailto:?subject=${encodeURIComponent('Would you leave me a quick review?')}&body=${encodeURIComponent(`Thank you for letting me help with your move! If you have a minute, a quick review would mean the world:\n\n${shareUrl}`)}`

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6">
        <StudioPageHeader
          icon={Star}
          kicker="Reviews"
          title={<>Five stars, <em>on repeat.</em></>}
          subtitle="Collect client reviews, and turn your best ones into Google & Zillow reviews."
        />

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} className="space-y-5">
            {/* Stats */}
            <motion.div variants={rise} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Average rating" icon={Star} highlight>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-serif text-3xl font-black">{avg != null ? <AnimatedNumber value={Number(avg.toFixed(1))} /> : '—'}</span>
                  <span className="flex">{[1, 2, 3, 4, 5].map(n => <Star key={n} className={`h-3 w-3 ${avg != null && avg >= n - 0.25 ? 'fill-[#C9A24D] text-[#C9A24D]' : 'text-[#C9A24D]/30'}`} />)}</span>
                </span>
              </StatTile>
              <StatTile label="Reviews" icon={MessageSquareQuote}><span className="font-serif text-3xl font-black"><AnimatedNumber value={reviews.length} /></span></StatTile>
              <StatTile label="Shown publicly" icon={Eye}><span className="font-serif text-3xl font-black"><AnimatedNumber value={publicCount} /></span></StatTile>
              <StatTile label="Posted to Google / Zillow" icon={Send}><span className="font-serif text-3xl font-black"><AnimatedNumber value={reposted} /></span></StatTile>
            </motion.div>

            {/* How it works - the funnel as a picture, not a paragraph */}
            <motion.div variants={rise} className="overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <LuxeSectionHeader icon={Sparkles} kicker="How it works" title={<>One link, <em>two paths.</em></>} subtitle="Happy clients go public. Unhappy ones come to you first." />
              <div className="grid gap-px bg-[#C9A24D]/15 sm:grid-cols-3 dark:bg-white/[0.06]">
                {[
                  { icon: Link2, t: 'You send your link', d: 'Text or email it after closing - it takes them 30 seconds.' },
                  { icon: ThumbsUp, t: '4-5 stars go public', d: 'Shown on your Agent Hub, and they post it to Google & Zillow in one tap.' },
                  { icon: ShieldCheck, t: '1-3 stars come to you', d: 'Private feedback only you see - never posted anywhere.' },
                ].map((st, i) => (
                  <motion.div key={st.t} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.12 }}
                    className="group relative bg-white p-5 transition hover:bg-[#fffaf0] dark:bg-[#121214] dark:hover:bg-white/[0.03]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C9A24D]/12 text-[#8b7355] transition group-hover:-translate-y-0.5 group-hover:bg-[#C9A24D] group-hover:text-[#111827] dark:text-[#e8c97a]"><st.icon className="h-[18px] w-[18px]" /></span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A24D]">Step {i + 1}</span>
                    </div>
                    <p className="mt-3 text-sm font-black text-[#111827] dark:text-white">{st.t}</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">{st.d}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Share link + Agent Hub switch */}
            <motion.div variants={rise} className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <LuxeSurface icon={Link2} className="rounded-3xl border border-[#C9A24D]/30 p-5 text-[#111827] shadow-[0_24px_50px_-34px_rgba(139,115,85,.55)] dark:border-white/[0.07] dark:text-white sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">Your review link</p>
                <p className="lx-title mt-1 font-serif text-xl font-black">Send it after <em>every closing.</em></p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-xl border border-[#C9A24D]/30 bg-white/80 px-3.5 py-3 text-xs font-bold text-[#6b5a45] outline-none dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70" />
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => { copyText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1600) }}
                    className="lx-shine relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-5 py-3 text-xs font-black uppercase tracking-wide text-[#111827] shadow-md shadow-[#C9A24D]/30 transition hover:-translate-y-0.5">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span key={copied ? 'c' : 'n'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="relative inline-flex items-center gap-1.5">
                        {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={smsHref} className={shareChip}><MessageCircle className="h-3.5 w-3.5" /> Text it</a>
                  <a href={mailHref} className={shareChip}><Mail className="h-3.5 w-3.5" /> Email it</a>
                  {slug && <a href={`/${slug}/review`} target="_blank" rel="noreferrer" className={shareChip}><ExternalLink className="h-3.5 w-3.5" /> See what clients see</a>}
                </div>
              </LuxeSurface>

              <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#121214] sm:p-6" data-testid="reviews-where-shown">
                {([
                  { key: 'hub', on: showOnHub, onClick: toggleHub, icon: LayoutTemplate, title: 'Show on my Agent Hub', sub: 'Adds a Client Reviews section to your public page.', locked: false },
                  { key: 'idx', on: showOnIdx && hasIdx, onClick: toggleIdx, icon: Globe, title: 'Show on my IDX website', sub: hasIdx ? 'Adds a Reviews page (and menu link) to your website.' : 'Comes with the IDX plan (your own website).', locked: !hasIdx },
                  { key: 'min', on: minRating >= 4, onClick: toggleMinRating, icon: Star, title: 'Only show 4 and 5 stars', sub: 'Lower ones stay saved here, just not shown publicly.', locked: false },
                ] as const).map(row => (
                  <div key={row.key} className={`flex items-start justify-between gap-4 ${row.locked ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${row.on ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}><row.icon className="h-[18px] w-[18px]" /></span>
                      <div>
                        <p className="text-sm font-black text-[#111827] dark:text-white">{row.title}</p>
                        <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{row.sub}</p>
                      </div>
                    </div>
                    {row.locked
                      ? <span className="mt-1 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:bg-white/5 dark:text-white/50">IDX plan</span>
                      : <Toggle on={row.on} onClick={row.onClick} label={row.title} />}
                  </div>
                ))}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p key={`${showOnHub}-${showOnIdx}-${minRating}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${showOnHub || (showOnIdx && hasIdx) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-white/50'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${showOnHub || (showOnIdx && hasIdx) ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {showOnHub || (showOnIdx && hasIdx)
                      ? (shownCount ? `Live on ${[showOnHub && 'Agent Hub', showOnIdx && hasIdx && 'website'].filter(Boolean).join(' + ')} - ${shownCount} review${shownCount === 1 ? '' : 's'} showing` : 'On - shows once you have a review')
                      : 'Not shown anywhere public'}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Where 4-5 star reviews get re-posted */}
            <motion.div variants={rise} className="overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <LuxeSectionHeader icon={Send} kicker="Where happy clients post" title={<>Google &amp; <em>Zillow</em></>} subtitle="Paste each review link once - no account connection needed."
                aside={(
                  <motion.button whileTap={{ scale: 0.96 }} onClick={saveDests} disabled={savingDests || (!destsDirty && !savedDests)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide transition ${savedDests ? 'bg-emerald-500 text-white' : destsDirty ? 'bg-[#111827] text-white hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]' : 'bg-white/70 text-gray-400 dark:bg-white/5'}`}>
                    {savingDests ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedDests ? <Check className="h-3.5 w-3.5" /> : null}
                    {savedDests ? 'Saved' : destsDirty ? 'Save links' : 'All saved'}
                  </motion.button>
                )} />
              <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
                <DestinationCard name="Google" mark={<GoogleMark />} value={googleUrl} onChange={setGoogleUrl}
                  placeholder="https://g.page/r/…"
                  how={<>Open your <a href="https://business.google.com/reviews" target="_blank" rel="noreferrer" className="font-black text-[#8b7355] hover:underline dark:text-[#e8c97a]">Google Business Profile</a> → <b>Ask for reviews</b> → copy the short link.</>} inputCls={inputCls} />
                <DestinationCard name="Zillow" mark={<span className="flex h-full w-full items-center justify-center rounded-lg bg-[#006AFF] text-sm font-black text-white">Z</span>} value={zillowUrl} onChange={setZillowUrl}
                  placeholder={ZILLOW_REVIEW_PLACEHOLDER}
                  how={<><span className="block">Use the link behind the <b>Write a review</b> button on your Zillow profile - clients land right on the review form.</span><ZillowLinkHelp value={zillowUrl} compact /></>} inputCls={inputCls} />
              </div>
            </motion.div>

            {/* Import from Google */}
            <motion.div variants={rise} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#121214] sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex items-start gap-3 lg:w-[38%]">
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-2 dark:border-white/10"><GoogleMark /></span>
                  <div>
                    <p className="text-sm font-black text-[#111827] dark:text-white">Bring in your Google reviews</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">So your page isn&apos;t empty on day one. Google shares up to 5.</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <input value={placeId} onChange={e => setPlaceId(e.target.value)} placeholder="Google Place ID (starts with ChIJ…)" className={inputCls} />
                    {placeId.trim() && <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                  </div>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={importGoogle} disabled={importing || !placeId.trim()}
                    className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:-translate-y-0.5 disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                    {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" />} Import
                  </motion.button>
                </div>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-gray-400 lg:pl-[calc(38%+1rem)]">
                Don&apos;t know it? Search your business in Google&apos;s <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="font-bold text-[#8b7355] hover:underline dark:text-[#e8c97a]">Place ID Finder</a> and copy the ID.
              </p>
              <AnimatePresence>
                {importMsg && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden rounded-xl border border-[#C9A24D]/25 bg-[#C9A24D]/[0.06] px-3 py-2 text-xs font-semibold text-[#6b5a45] dark:text-white/70">{importMsg}</motion.p>}
              </AnimatePresence>
            </motion.div>

            {/* Bring reviews over from Zillow / Google / Realtor.com (paste, or one by hand) */}
            <motion.div variants={rise}><ReviewImporter inputCls={inputCls} onImported={load} /></motion.div>

            {/* Received reviews */}
            <motion.div variants={rise} className="overflow-hidden rounded-3xl border border-[#C9A24D]/25 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#121214]">
              <LuxeSectionHeader icon={MessageSquareQuote} kicker="Received" title={<>Your <em>reviews</em></>} subtitle={reviews.length ? 'Hide any you don’t want on your Agent Hub, or delete them.' : 'They’ll show up here the moment a client submits.'} />
              {reviews.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-5 py-3 dark:border-white/[0.06] sm:px-6">
                  {([['all', 'All', reviews.length], ['public', 'Public', publicCount], ['private', 'Private feedback', privateCount], ['imported', 'From other sites', reviews.filter(r => (r.source || 'direct') !== 'direct').length]] as const).map(([k, label, n]) => (
                    <button key={k} onClick={() => setFilter(k)} className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-black transition ${filter === k ? 'text-[#111827]' : 'text-gray-500 hover:text-[#111827] dark:text-white/50 dark:hover:text-white'}`}>
                      {filter === k && <motion.span layoutId="rv-filter" className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a]" transition={{ type: 'spring', stiffness: 420, damping: 32 }} />}
                      <span className="relative">{label} <span className="opacity-60">{n}</span></span>
                    </button>
                  ))}
                </div>
              )}
              <div className="p-5 sm:p-6">
                {reviews.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-[#C9A24D]/25 py-10 text-center">
                    <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}><Star className="h-8 w-8 fill-[#C9A24D]/20 text-[#C9A24D]" /></motion.div>
                    <p className="mt-2 text-sm font-black text-[#111827] dark:text-white">No reviews yet</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">Copy your link above and send it to your last happy client.</p>
                  </div>
                ) : (
                  <motion.div layout className="grid gap-3 md:grid-cols-2">
                    <AnimatePresence initial={false}>
                      {filtered.map(rv => {
                        const hidden = rv.status === 'hidden'
                        const isPrivate = hidden && (rv.source || 'direct') === 'direct' && rv.rating <= 3
                        return (
                          <motion.div key={rv.id} id={`review-${rv.id}`} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.22 }}
                            className={`group flex flex-col rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-22px_rgba(139,115,85,.6)] ${focusReviewId === rv.id ? 'ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-[#faf9f7] dark:ring-offset-[#0B0B0B] ' : ''}${isPrivate ? 'border-amber-200 bg-amber-50/40 dark:border-amber-400/20 dark:bg-amber-400/[0.04]' : hidden ? 'border-gray-200 bg-gray-50/70 dark:border-white/[0.06] dark:bg-white/[0.02]' : 'border-gray-200 bg-white hover:border-[#C9A24D]/50 dark:border-white/[0.08] dark:bg-[#151517]'}`}>
                            <div className="flex items-start gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#8b6a2b] text-[11px] font-black text-white">{(rv.reviewer_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-black text-[#111827] dark:text-white">{rv.reviewer_name}</span>
                                  {rv.source && rv.source !== 'direct' && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">{({ google: 'Google', zillow: 'Zillow', realtor: 'Realtor.com', homes: 'Homes.com', facebook: 'Facebook' } as Record<string, string>)[rv.source] || 'Imported'}</span>}
                                  {isPrivate && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Private feedback</span>}
                                  {!isPrivate && hidden && <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-gray-600 dark:bg-white/10 dark:text-white/60">Hidden</span>}
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <span className="flex">{[1, 2, 3, 4, 5].map(n => <Star key={n} className={`h-3 w-3 ${rv.rating >= n ? 'fill-[#C9A24D] text-[#C9A24D]' : 'text-gray-300 dark:text-gray-600'}`} />)}</span>
                                  <span className="text-[10px] font-semibold text-gray-400">{new Date(rv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                              </div>
                            </div>
                            <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600 dark:text-gray-300">“{rv.body}”</p>
                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                              <div className="flex flex-wrap gap-1">
                                {rv.posted_google_at && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Check className="h-2.5 w-2.5" /> On Google</span>}
                                {rv.posted_zillow_at && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Check className="h-2.5 w-2.5" /> On Zillow</span>}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button onClick={() => setStatus(rv.id, hidden ? 'published' : 'hidden')} disabled={busyId === rv.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-black text-gray-600 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-white/10 dark:text-white/60 dark:hover:text-white">
                                  {hidden ? <><Eye className="h-3 w-3" /> Show</> : <><EyeOff className="h-3 w-3" /> Hide</>}
                                </button>
                                <button onClick={() => del(rv.id)} disabled={busyId === rv.id} title="Delete permanently"
                                  className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                                  {busyId === rv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                    {filtered.length === 0 && <p className="col-span-full py-6 text-center text-xs font-bold text-gray-400">Nothing in this view.</p>}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

const rise: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } } }
const shareChip = 'inline-flex items-center gap-1.5 rounded-full border border-[#C9A24D]/30 bg-white/80 px-3 py-1.5 text-[11px] font-black text-[#6b5a45] transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/75'

function StatTile({ label, icon: Icon, children, highlight }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 ${highlight ? 'border-[#C9A24D]/40 bg-gradient-to-br from-[#fffaf0] to-[#f6ead2] dark:from-[#C9A24D]/15 dark:to-transparent' : 'border-gray-200 bg-white dark:border-white/[0.07] dark:bg-[#121214]'}`}>
      <Icon className="absolute -right-2 -top-2 h-14 w-14 text-[#C9A24D]/[0.08] transition group-hover:rotate-12" />
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">{label}</p>
      <div className="mt-1 text-[#111827] dark:text-white">{children}</div>
    </div>
  )
}

function DestinationCard({ name, mark, value, onChange, placeholder, how, inputCls }: {
  name: string; mark: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string; how: React.ReactNode; inputCls: string
}) {
  const set = !!value.trim()
  return (
    <div className={`rounded-2xl border p-4 transition ${set ? 'border-emerald-300/60 bg-emerald-50/30 dark:border-emerald-400/20 dark:bg-emerald-400/[0.03]' : 'border-gray-200 dark:border-white/[0.08]'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="h-9 w-9 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 dark:border-white/10">{mark}</span>
          <p className="text-sm font-black text-[#111827] dark:text-white">{name}</p>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={String(set)} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${set ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-white/50'}`}>
            {set ? <><Check className="h-2.5 w-2.5" /> Ready</> : 'Not set'}
          </motion.span>
        </AnimatePresence>
      </div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} mt-3`} />
      <div className="mt-2 text-[11px] font-semibold leading-relaxed text-gray-500 dark:text-gray-400">{how}</div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
