'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { PropertyDetailResponse } from '@/types'
import { ArrowLeft, CalendarCheck, CalendarDays, Check, Copy, Heart, Hourglass, Loader2, MapPin, MessageCircle, RefreshCw, Send, X } from 'lucide-react'
import { normalizeImageUrl } from '@/lib/utils'
import { tourState, tourWhen, type TourLike } from '@/components/TourStatusWindow'
import PropertyMap from './PropertyMap'
import {
  AboutHome, BrightNotice, EveryDetail, LocationBlock, PriceHistory,
  HERO_COLS, HeroShareActions, PropertyHero, PropertySurface, SectionDivider, SectionTitle, hasDetails, homeFromMls, pp, shortDate,
} from '@/components/property/PropertyKit'
import { copyText } from '@/lib/copyText'

interface PropertyDetailsModalProps {
  property: PropertyDetailResponse | null
  isOpen: boolean
  onClose: () => void
  onLike?: (propertyId: string, liked: boolean) => void
  onDislike?: (propertyId: string, disliked: boolean) => void
  onAddComment?: (propertyId: string, comment: string) => void
  /** The buyer's "Schedule a tour" (public Showcase) - opens the tour window over this one. */
  onScheduleTour?: (property: PropertyDetailResponse) => void
  isLoadingDetails?: boolean
  detailsError?: string | null
  onRetryDetails?: () => void
  isLoadingComments?: boolean
  commentsError?: string | null
  shareUrl?: string | null
  // Overlay stacking - default matches the modal's own z-50. Only needs overriding when mounted
  // inside another modal that already sits at a higher z-index (e.g. EditSimilarPropertiesModal's
  // z-[110]), so this one isn't rendered behind it.
  zIndex?: number
  // False hides Like/Pass and the Comments panel - for browsing contexts like Discovery, where
  // the viewer is another agent previewing a colleague's listing, not a buyer/visitor interacting
  // with a showcase. Defaults to true so every existing showcase caller keeps its current behavior.
  showVisitorActions?: boolean
  /** The Showcase's agent - their photo and name brand the questions box and their replies. */
  agent?: { name?: string | null; photoUrl?: string | null } | null
  // Opened from a "Reply to Comment" alert (?comments=1): scroll to the thread, glow it, cursor in the reply box.
  focusComments?: boolean
  /** Who's reading: their own messages sit on the right, the other side's on the left. */
  viewer?: 'client' | 'agent'
  /** The buyer's latest showing request for this home - the tour button shows its status. */
  tourRequest?: TourLike | null
}

const GOLD = '#C9A24D'
const INK = '#111827'
const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const

// The Showcase detail window (also Discovery's "View Details", the open house wizard's preview and
// the agent's own Showcase view). Built from the shared property design (components/property/
// PropertyKit) so a home looks the same here as on the Listing Page and the IDX site. Its own
// extras: the header with Back + Copy Share Link, the buyer's Love / Pass + Schedule a tour, and
// their comment thread with the agent (a sticky panel beside the home), and the MLS notice.
// Kept light so scrolling stays smooth: no backdrop blur behind the window (it re-blurred the
// animating page underneath on every frame) and no sticky jump bar.
export default function PropertyDetailsModal({
  property,
  isOpen,
  onClose,
  onLike,
  onDislike,
  onAddComment,
  onScheduleTour,
  isLoadingDetails = false,
  detailsError = null,
  onRetryDetails,
  isLoadingComments = false,
  commentsError = null,
  shareUrl = null,
  zIndex = 50,
  showVisitorActions = true,
  agent = null,
  viewer = 'client',
  tourRequest = null,
  focusComments = false,
}: PropertyDetailsModalProps) {
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [copied, setCopied] = useState(false)
  // Phones: the sticky Love / Pass bar only rides along once the price panel's own buttons have
  // scrolled away (never two sets on screen at once).
  const [barOn, setBarOn] = useState(false)
  const commentsContainerRef = useRef<HTMLDivElement>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const [commentsGlow, setCommentsGlow] = useState(false)
  const focusedFor = useRef<string | null>(null)
  const focusTimers = useRef<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const home = useMemo(() => (property ? homeFromMls(property, { photo: u => (u === '/placeholder.jpg' ? u : normalizeImageUrl(u)) }) : null), [property])

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await copyText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  // Each home opens at the top, not wherever the last one was scrolled to.
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); setBarOn(false) }, [property?.id])

  // Prevent background scroll when modal is open. Applied via useLayoutEffect (fires
  // synchronously before the browser paints) rather than useEffect - otherwise the browser
  // paints at least one frame of the modal's fading-in backdrop over a still-unlocked,
  // still-scrolling background first, which reads as the background "scrolling" messily right
  // as the modal opens (most visible if the agent was scrolled deep into a showcase's grid).
  const scrollRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useLayoutEffect(() => {
    if (isOpen) {
      // Cancel any pending restore left over from a just-closed instance so a quick reopen
      // doesn't get its lock pulled out from under it a moment later by a stale timer.
      if (scrollRestoreTimeoutRef.current) {
        clearTimeout(scrollRestoreTimeoutRef.current)
        scrollRestoreTimeoutRef.current = null
      }
      const scrollY = window.scrollY
      const originalBodyOverflow = document.body.style.overflow
      const originalBodyPosition = document.body.style.position
      const originalBodyTop = document.body.style.top
      const originalBodyWidth = document.body.style.width
      const originalHtmlOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.documentElement.style.overflow = 'hidden'
      return () => {
        // Restore once the closing animation is done, not the instant isOpen flips false -
        // restoring immediately jumps the page back while the window is still sliding out.
        scrollRestoreTimeoutRef.current = setTimeout(() => {
          document.body.style.overflow = originalBodyOverflow
          document.body.style.position = originalBodyPosition
          document.body.style.top = originalBodyTop
          document.body.style.width = originalBodyWidth
          document.documentElement.style.overflow = originalHtmlOverflow
          window.scrollTo(0, scrollY)
          scrollRestoreTimeoutRef.current = null
        }, 260)
      }
    }
  }, [isOpen])

  // Escape closes the window (the photo viewer catches its own Escape first).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const comments = property?.comments || []
  // A new comment slides into view at the bottom of the thread.
  useEffect(() => {
    const el = commentsContainerRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [comments.length])

  // From a comment alert: once this home and its thread are in, bring the thread into view, glow it
  // for a moment and put the cursor in the reply box - once per home.
  useEffect(() => {
    if (!isOpen || !focusComments || !property?.id || isLoadingComments || focusedFor.current === String(property.id)) return
    focusedFor.current = String(property.id)
    // Timers live in a ref: the thread finishing loading re-runs this effect, and a cleanup here
    // would cancel them before they fire (the once-per-home guard then stops a second try).
    const timers = focusTimers.current
    timers.push(window.setTimeout(() => {
      document.getElementById('sc-comments')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setCommentsGlow(true)
      timers.push(window.setTimeout(() => setCommentsGlow(false), 2600))
    }, 500))
    // The reply box can re-render while the thread loads - keep putting the cursor there until it sticks.
    let tries = 0
    const focusReply = () => {
      const el = replyRef.current
      if (el && document.activeElement !== el) el.focus({ preventScroll: true })
      if (++tries < 6 && document.activeElement !== el) timers.push(window.setTimeout(focusReply, 400))
    }
    timers.push(window.setTimeout(focusReply, 700))
  }, [isOpen, focusComments, property?.id, isLoadingComments])
  useEffect(() => {
    if (isOpen) return
    focusTimers.current.forEach(window.clearTimeout)
    focusTimers.current = []
    focusedFor.current = null
  }, [isOpen])
  useEffect(() => () => focusTimers.current.forEach(window.clearTimeout), [])

  if (!property || !home) return null

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !property.id) return
    setIsSubmittingComment(true)
    try {
      onAddComment?.(property.id, newComment.trim())
      setNewComment('')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const showDetails = isLoadingDetails || !!detailsError || hasDetails(home)
  const toComments = () => document.getElementById('sc-comments')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const tour = onScheduleTour ? () => onScheduleTour(property) : undefined

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="sc-window"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.04 } }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 flex items-end justify-center overscroll-none bg-[#0B0B0B]/80 sm:items-center sm:p-6"
          style={{ zIndex }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 48, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING }}
            exit={{ opacity: 0, y: 36, scale: 0.98, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[26px] shadow-2xl sm:h-[88vh] sm:rounded-[28px]"
            style={{ overscrollBehavior: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          >
            <PropertySurface surface="app" gold={GOLD} ink={INK} className="flex min-h-0 flex-1 flex-col bg-[var(--pp-bg)]">
              {/* header */}
              <div className="z-40 flex items-center justify-between gap-3 border-b border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-2">
                  <motion.button whileHover={{ x: -2 }} whileTap={{ scale: 0.9 }} onClick={onClose} className={`-ml-1 shrink-0 rounded-full p-2 transition-colors hover:bg-[var(--pp-gold-wash)] ${pp.muted}`} title="Back" aria-label="Back">
                    <ArrowLeft size={20} />
                  </motion.button>
                  <div className="min-w-0 leading-tight">
                    <p className={`truncate font-serif text-[15px] font-black sm:text-base ${pp.heading}`}>{home.street}</p>
                    {home.place && <p className={`flex items-center gap-1 truncate text-[11px] font-semibold ${pp.muted}`}><MapPin className="h-3 w-3 shrink-0 text-[color:var(--pp-gold)]" />{home.place}</p>}
                  </div>
                </div>
                {shareUrl && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyLink}
                    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors ${copied ? 'border-emerald-600 bg-emerald-600 text-white' : `border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] hover:border-[color:var(--pp-gold)] ${pp.heading}`}`}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} className="text-[color:var(--pp-gold)]" />}
                    {copied ? 'Copied!' : 'Copy Share Link'}
                  </motion.button>
                )}
              </div>

              <div ref={scrollRef} onScroll={e => { const on = e.currentTarget.scrollTop > 640; if (on !== barOn) setBarOn(on) }} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                <div className="px-4 pb-10 pt-4 sm:px-7 sm:pt-6">
                  {/* The photos take the whole top; the buyer's Love / Pass, tour and comments ride beside the rest. */}
                  <PropertyHero
                    home={home}
                    actions={showVisitorActions ? (
                      <div className="space-y-2">
                        <TakeButtons tone="light" liked={!!property.liked} disliked={!!property.disliked}
                          onLike={() => onLike?.(property.id!, !property.liked)} onPass={() => onDislike?.(property.id!, !property.disliked)} />
                        {viewer === 'agent' && <HeroShareActions home={home} url={shareUrl} row />}
                        {tour && <TourButton scheduled={!!property.hasTourScheduled} request={tourRequest} onClick={tour} className="w-full" />}
                      </div>
                    ) : undefined}
                  />
                  {/* Same columns as the hero, so the questions box sits exactly under the price panel. */}
                  <div className={`mt-9 grid gap-x-6 gap-y-5 ${showVisitorActions ? HERO_COLS : ''}`}>
                    <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                      <Reveal root={scrollRef} id="sc-overview">
                        <SectionTitle kicker="Overview" title="About this home" />
                        <AboutHome home={home} />
                      </Reveal>

                      {showDetails && (
                        <Reveal root={scrollRef} id="sc-details">
                          <SectionDivider />
                          {isLoadingDetails ? (
                            <p className={`flex items-center gap-2 text-sm font-bold ${pp.muted}`}><Loader2 className="h-4 w-4 animate-spin text-[color:var(--pp-gold)]" /> Loading the full listing details...</p>
                          ) : detailsError ? (
                            <div className={`flex flex-wrap items-center justify-between gap-3 p-5 ${pp.card}`}>
                              <p className={`text-sm font-semibold ${pp.muted}`}>The full listing details didn&apos;t load.</p>
                              {onRetryDetails && (
                                <button type="button" onClick={onRetryDetails} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pp-ink)] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white"><RefreshCw className="h-3.5 w-3.5" /> Try again</button>
                              )}
                            </div>
                          ) : (
                            <>
                              <SectionTitle kicker="Details" title="Every detail" sub="Straight from the listing record." />
                              <EveryDetail home={home} />
                            </>
                          )}
                        </Reveal>
                      )}

                      {home.price != null && (
                        <Reveal root={scrollRef} id="sc-price">
                          <SectionDivider />
                          <SectionTitle kicker="Price" title="Price history" />
                          <div className="mt-6"><PriceHistory home={home} /></div>
                        </Reveal>
                      )}

                      {home.lat != null && home.lng != null && (
                        <Reveal root={scrollRef} id="sc-location">
                          <SectionDivider />
                          <SectionTitle kicker="Location" title="On the map" sub={home.fullAddress || undefined} />
                          <LocationBlock home={home} mapClassName="h-[300px]" map={<PropertyMap latitude={home.lat} longitude={home.lng} address={property.FullStreetAddress} />} />
                        </Reveal>
                      )}
                    </div>

                    {/* The buyer's side: love it or pass, book a tour, and talk to the agent about it. */}
                    {showVisitorActions && (
                      <aside className="lg:col-start-2 lg:row-start-1">
                        <motion.div
                          initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING, delay: 0.12 }}
                          className="space-y-4 lg:sticky lg:top-2"
                        >
                          <div id="sc-comments" className={`relative isolate overflow-hidden rounded-[26px] bg-[var(--pp-ink)] p-5 text-white shadow-[0_34px_70px_-40px_rgba(0,0,0,.85)] ring-1 transition-shadow duration-700 ${commentsGlow ? 'ring-2 ring-[color:var(--pp-gold)] shadow-[0_0_0_6px_rgba(201,162,77,.25),0_34px_70px_-40px_rgba(0,0,0,.85)]' : 'ring-white/10'}`}>
                            <span aria-hidden className="pp-panel-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
                            <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-[var(--pp-gold)] opacity-25 blur-3xl" />
                            {[['14%', '18%', 0], ['86%', '30%', 1.8]].map(([l, t, d], k) => (
                              <span key={k} aria-hidden className="pp-panel-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
                            ))}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <AgentAvatar agent={agent} size={48} />
                                <div className="min-w-0">
                                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--pp-gold)]">{viewer === 'agent' ? 'You' : 'Your agent'}</p>
                                  <p className="truncate font-serif text-lg font-black leading-tight">{agent?.name || 'Ask your agent'}</p>
                                </div>
                              </div>
                              {comments.length > 0 && (
                                <motion.span key={comments.length} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                                  className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-[var(--pp-gold)] px-2 text-[11px] font-black text-[color:var(--pp-ink)]">{comments.length}</motion.span>
                              )}
                            </div>
                            <h3 className="mt-4 font-serif text-[1.35rem] font-black leading-tight">{viewer === 'agent' ? 'Questions on this home' : 'Curious about this home?'}</h3>
                            <p className="mt-0.5 text-xs font-semibold text-white/50">{viewer === 'agent' ? 'Reply here - they see it under this home in their Showcase.' : <>Ask anything - {agent?.name ? `${agent.name.split(' ')[0]} answers` : 'the answer lands'} right here.</>}</p>
                            <div ref={commentsContainerRef} className="scrollbar-hide -mx-1.5 mt-3 max-h-[300px] space-y-2.5 overflow-y-auto px-1.5 pb-2 pt-1.5">
                              {isLoadingComments && !comments.length ? (
                                <p className="flex items-center gap-2 py-4 text-xs font-bold text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
                              ) : comments.length > 0 ? (
                                <AnimatePresence initial={false}>
                                  {comments.map(comment => {
                                    // Saved with the comment: did the agent write it?
                                    const fromAgent = !!comment.isAgent
                                    const right = viewer === 'agent' ? fromAgent : !fromAgent
                                    return (
                                      <motion.div
                                        key={comment.id}
                                        layout="position"
                                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                                        className={`flex items-end gap-2 ${right ? 'flex-row-reverse' : ''}`}
                                      >
                                        {!right && (fromAgent
                                          ? <AgentAvatar agent={agent} size={28} />
                                          : <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-black text-white">{String(comment.author || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}</span>)}
                                        <div className={`min-w-0 max-w-[85%] px-3.5 py-2.5 ${fromAgent ? 'bg-[color:color-mix(in_srgb,var(--pp-gold)_15%,transparent)] ring-1 ring-[color:color-mix(in_srgb,var(--pp-gold)_25%,transparent)]' : 'bg-white/[0.08] ring-1 ring-white/[0.06]'} ${right ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'}`}>
                                          <div className="mb-0.5 flex items-center justify-between gap-3">
                                            <span className={`truncate text-[11px] font-black ${fromAgent ? 'text-[color:var(--pp-gold)]' : 'text-white/80'}`}>{right ? 'You' : fromAgent ? (agent?.name || comment.author) : comment.author}</span>
                                            <span className="shrink-0 text-[10px] font-bold text-white/40">{shortDate(comment.createdAt)}</span>
                                          </div>
                                          <p className="text-sm font-medium leading-relaxed text-white/85">{comment.content}</p>
                                        </div>
                                      </motion.div>
                                    )
                                  })}
                                </AnimatePresence>
                              ) : (
                                <div className="scrollbar-hide flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                                  {([['Any offers yet?', 'Any offers yet?'], ['Send disclosure', "Could you please send the seller's disclosure?"], ['CMA request', 'Hey, could you make a CMA for this one?']] as const).map(([q, text], k) => (
                                    <motion.button key={q} type="button" onClick={() => setNewComment(text)}
                                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + k * 0.07 }}
                                      whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
                                      className="shrink-0 whitespace-nowrap rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/75 transition-colors hover:border-[color:var(--pp-gold)] hover:text-white">
                                      {q}
                                    </motion.button>
                                  ))}
                                </div>
                              )}
                              {commentsError && <p className="text-xs font-semibold text-rose-300">{commentsError}</p>}
                            </div>
                            <form onSubmit={handleSubmitComment} className="mt-4">
                              <div className="relative">
                                <textarea
                                  ref={replyRef}
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(e as any) } }}
                                  placeholder={viewer === 'agent' ? 'Write your reply...' : 'Type your question...'}
                                  className="block w-full resize-none rounded-2xl border border-white/12 bg-white/[0.06] py-3 pl-4 pr-14 text-sm font-medium text-white outline-none transition placeholder:text-white/35 focus:border-[color:var(--pp-gold)] focus:ring-4 focus:ring-white/10"
                                  rows={2}
                                  disabled={isSubmittingComment}
                                />
                                <motion.button
                                  type="submit"
                                  aria-label="Send"
                                  disabled={!newComment.trim() || isSubmittingComment}
                                  whileTap={{ scale: 0.88 }}
                                  animate={{ scale: newComment.trim() ? 1 : 0.9, opacity: newComment.trim() ? 1 : 0.45 }}
                                  className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-[var(--pp-gold)] text-[color:var(--pp-ink)] shadow-md"
                                >
                                  {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </motion.button>
                              </div>
                            </form>
                          </div>
                        </motion.div>
                      </aside>
                    )}
                  </div>

                  <BrightNotice home={home} updatedAt={property.updated_at} className="mt-12" />
                </div>

                {/* Phones: Love / Pass / tour / message ride along once you've scrolled past the price panel. */}
                <AnimatePresence>
                {showVisitorActions && barOn && (
                  <motion.div
                    key="phone-bar"
                    initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: SPRING }} exit={{ y: 90, opacity: 0, transition: { duration: 0.2 } }}
                    className="sticky bottom-3 z-30 mx-3 mb-3 flex items-center gap-2 rounded-2xl bg-[var(--pp-ink)] p-2 shadow-[0_20px_40px_-12px_rgba(0,0,0,.55)] ring-1 ring-white/10 lg:hidden"
                  >
                    <div className="min-w-0 flex-1">
                      <TakeButtons compact liked={!!property.liked} disliked={!!property.disliked}
                        onLike={() => onLike?.(property.id!, !property.liked)} onPass={() => onDislike?.(property.id!, !property.disliked)} />
                    </div>
                    {tour && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={tour} aria-label="Schedule a tour"
                        className={`grid h-[42px] w-12 place-items-center rounded-xl ${tourState(tourRequest) === 'confirmed' ? 'bg-emerald-500 text-white' : tourState(tourRequest) === 'pending' || property.hasTourScheduled ? 'bg-amber-400 text-[#111827]' : 'bg-white/10 text-white'}`}>
                        {tourState(tourRequest) === 'confirmed' ? <CalendarCheck size={17} /> : tourState(tourRequest) === 'pending' || property.hasTourScheduled ? <Hourglass size={17} /> : <CalendarDays size={17} />}
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={toComments} aria-label="Message your agent" className="relative grid h-[42px] w-12 place-items-center rounded-xl bg-[var(--pp-gold)] text-[color:var(--pp-ink)]">
                      <MessageCircle size={17} />
                      {comments.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 text-[9px] font-black text-[#111827]">{comments.length}</span>}
                    </motion.button>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </PropertySurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** The agent's photo (gold ring, green "here" dot), or their initials. */
function AgentAvatar({ agent, size }: { agent: PropertyDetailsModalProps['agent']; size: number }) {
  const initials = String(agent?.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      {agent?.photoUrl
        ? <img src={agent.photoUrl} alt={agent.name || 'Your agent'} className="h-full w-full rounded-full object-cover ring-2 ring-[color:var(--pp-gold)] ring-offset-2 ring-offset-[color:var(--pp-ink)]" />
        : <span className="grid h-full w-full place-items-center rounded-full bg-[var(--pp-gold)] font-black text-[color:var(--pp-ink)]" style={{ fontSize: size * 0.36 }}>{initials || <MessageCircle className="h-1/2 w-1/2" />}</span>}
      {size > 32 && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[color:var(--pp-ink)]" />}
    </span>
  )
}

/** A section that rises in the first time it scrolls into the window. */
function Reveal({ root, id, className = '', children }: { root: RefObject<HTMLElement | null>; id: string; className?: string; children: ReactNode }) {
  return (
    <motion.section
      id={id}
      className={`scroll-mt-20 ${className}`}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, root: root as RefObject<Element>, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  )
}

/** Love / Pass as one segmented control: the chosen side lights up (a sliding pill - green for
 *  Love, red for Pass) and its icon pops. `tone` = the surface it sits on. */
export function TakeButtons({ liked, disliked, onLike, onPass, compact = false, tone = 'dark' }: {
  liked: boolean; disliked: boolean; onLike: () => void; onPass: () => void; compact?: boolean; tone?: 'dark' | 'light'
}) {
  const h = compact ? 'h-[42px]' : 'h-11'
  const light = tone === 'light'
  const base = `relative isolate flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors ${h}`
  const love = liked ? 'text-white' : light ? 'border border-emerald-500/35 bg-emerald-500/[0.07] text-emerald-700 hover:border-emerald-500 dark:text-emerald-400' : 'text-white/80 hover:text-emerald-300'
  const pass = disliked ? 'text-white' : light ? 'border border-rose-500/35 bg-rose-500/[0.07] text-rose-600 hover:border-rose-500 dark:text-rose-400' : 'text-white/80 hover:text-rose-300'
  return (
    <div className={`flex items-stretch ${light ? 'gap-2' : 'gap-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10'}`}>
      <motion.button type="button" whileTap={{ scale: 0.94 }} whileHover={light ? { y: -1 } : undefined} onClick={onLike} aria-pressed={liked} className={`${base} ${love}`}>
        <AnimatePresence>{liked && <motion.span key="fill" className="absolute inset-0 -z-10 rounded-xl bg-emerald-500" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 30 }} />}</AnimatePresence>
        <motion.span key={liked ? 'on' : 'off'} initial={liked ? { scale: 0.4 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 700, damping: 12 }} className="relative">
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          {liked && <Burst color="bg-emerald-200" />}
        </motion.span>
        {liked ? 'Loved' : 'Love it'}
      </motion.button>
      {!light && <span aria-hidden className="my-2.5 w-px bg-white/15" />}
      <motion.button type="button" whileTap={{ scale: 0.94 }} whileHover={light ? { y: -1 } : undefined} onClick={onPass} aria-pressed={disliked} className={`${base} ${pass}`}>
        <AnimatePresence>{disliked && <motion.span key="fill" className="absolute inset-0 -z-10 rounded-xl bg-rose-500" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 30 }} />}</AnimatePresence>
        <motion.span key={disliked ? 'on' : 'off'} initial={disliked ? { rotate: -90, scale: 0.5 } : false} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 16 }}>
          <X size={15} strokeWidth={3} />
        </motion.span>
        {disliked ? 'Passed' : 'Pass'}
      </motion.button>
    </div>
  )
}

// Six little sparks flying out of the heart when a home is loved.
function Burst({ color = 'bg-emerald-200' }: { color?: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <motion.span key={i} className={`absolute h-1 w-1 rounded-full ${color}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 16, y: Math.sin(a) * 16, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.55, ease: 'easeOut' }} />
        )
      })}
    </span>
  )
}

/** "Schedule a tour" - then "Pending approval · requested Sat, Oct 4 · 2:00 PM" (amber) until the
 *  agent confirms, then "Tour confirmed · <the time>" (green). Tapping it after a request opens the
 *  request's details (the page decides - see onScheduleTour). */
export function TourButton({ scheduled, request = null, onClick, className = '' }: { scheduled: boolean; request?: TourLike | null; onClick: () => void; className?: string }) {
  const state = tourState(request) === 'none' && scheduled ? 'pending' : tourState(request)
  const look = state === 'confirmed' || state === 'done' ? 'bg-emerald-500 text-white' : state === 'pending' ? 'bg-amber-400 text-[#111827]' : 'bg-[var(--pp-gold)] text-[color:var(--pp-ink)]'
  const sub = state === 'pending' ? (request ? `Requested ${tourWhen(request.preferred_date, request.preferred_time)}` : 'Waiting for your agent')
    : state === 'confirmed' ? tourWhen(request?.confirmed_date, request?.confirmed_time) : ''
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={`pp-sheen inline-flex min-h-11 items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-4 py-2 shadow-lg transition-colors ${look} ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} className="inline-flex items-center gap-2.5"
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.18 }}>
          {state === 'pending'
            ? <motion.span animate={{ rotate: [0, 180, 180, 360] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} className="inline-flex"><Hourglass className="h-4 w-4" /></motion.span>
            : state === 'none' ? <CalendarDays className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[11px] font-black uppercase tracking-widest">
              {state === 'pending' ? 'Pending approval' : state === 'confirmed' ? 'Tour confirmed' : state === 'done' ? 'Toured' : 'Schedule a tour'}
            </span>
            {sub && <span className="text-[11px] font-bold normal-case tracking-normal opacity-80">{sub}</span>}
          </span>
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
