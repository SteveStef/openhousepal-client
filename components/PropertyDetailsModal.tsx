'use client'

import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { useState, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useIsPhone, useLastValue, useSwipeToClose } from '@/components/ui/windowMotion'
import { PropertyDetailResponse } from '@/types'
import { CalendarCheck, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Heart, Hourglass, Loader2, MapPin, MessageCircle, RefreshCw, Send, X } from 'lucide-react'
import { normalizeImageUrl } from '@/lib/utils'
import { tourState, tourWhen, type TourLike } from '@/components/TourStatusWindow'
import PropertyMap from './PropertyMap'
import {
  AboutHome, BrightNotice, EveryDetail, LocationBlock, PriceHistory,
  HERO_COLS, HeroShareActions, PropertyHero, PropertySurface, SectionDivider, SectionTitle, hasDetails, homeFromMls, pp, shortDate,
} from '@/components/property/PropertyKit'
import { copyText } from '@/lib/copyText'
import ShowcaseMembership from '@/components/property/ShowcaseMembership'

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
  /** Agent side only: the bar under the photos - which of their Showcases have this home + Add to a Showcase. */
  showcaseTools?: boolean
  /** Previous / next home in the list the window was opened from (arrows in the header, the phone
   *  bar, beside the window on a wide screen, and the keyboard's arrow keys). */
  nav?: HomeNav | null
  /** How the last home change happened - which way the next home slides in, and a Pass sends the
   *  passed home off to the side. */
  move?: HomeMove | null
}

export type HomeNav = { index: number; total: number; onPrev?: (() => void) | null; onNext?: (() => void) | null }
export type HomeMove = { dir: 1 | -1; kind: 'nav' | 'pass'; seq: number }

const GOLD = '#C9A24D'
const INK = '#111827'
const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 } as const
const SHEET_SPRING = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } as const

// Moving between homes: the next one glides in from the side it's coming from; a passed home
// slides away to the left, shrinking a touch, before the next one arrives.
const PASS_EASE = [0.4, 0, 1, 1] as const
const FADE_LATE = [0.7, 0, 0.84, 0] as const // stays visible while it moves, then fades
const SLIDE_HOME: Variants = {
  enter: (m: HomeMove | null) => ({ opacity: 0, x: (m?.dir ?? 1) * 64, scale: 1 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 340, damping: 34, mass: 0.9 } },
  exit: (m: HomeMove | null) => m?.kind === 'pass'
    ? { opacity: 0, x: -200, scale: 0.94, transition: { x: { duration: 0.3, ease: [0.45, 0, 0.2, 1] }, scale: { duration: 0.3 }, opacity: { duration: 0.3, ease: FADE_LATE } } }
    : { opacity: 0, x: -(m?.dir ?? 1) * 72, transition: { x: { duration: 0.2, ease: PASS_EASE }, opacity: { duration: 0.2, ease: FADE_LATE } } },
}
const FADE_HOME: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

/** A round previous / next arrow (the header pill, or the dark phone bar). Dimmed at either end. */
function NavButton({ dir, onClick, dark = false }: { dir: -1 | 1; onClick?: (() => void) | null; dark?: boolean }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight
  return (
    <motion.button
      type="button"
      whileTap={onClick ? { scale: 0.86, x: dir * 2 } : undefined}
      onClick={onClick || undefined}
      disabled={!onClick}
      aria-label={dir < 0 ? 'Previous home' : 'Next home'}
      title={dir < 0 ? 'Previous home' : 'Next home'}
      className={dark
        ? 'grid h-[42px] w-9 shrink-0 place-items-center rounded-xl text-white/85 transition-colors hover:bg-white/10 disabled:opacity-25'
        : `grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--pp-gold-wash)] disabled:opacity-30 ${pp.heading}`}
    >
      <Icon size={dark ? 20 : 18} strokeWidth={2.5} />
    </motion.button>
  )
}

/** Wide screens only: a big round arrow just outside the window's left / right edge. */
function SideArrow({ dir, onClick }: { dir: -1 | 1; onClick?: (() => void) | null }) {
  const Icon = dir < 0 ? ChevronLeft : ChevronRight
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: dir * -10 }}
      animate={{ opacity: onClick ? 1 : 0.25, x: 0, transition: { delay: 0.15, duration: 0.3 } }}
      exit={{ opacity: 0 }}
      whileHover={onClick ? { scale: 1.06, x: dir * 3 } : undefined}
      whileTap={onClick ? { scale: 0.92 } : undefined}
      onClick={e => { e.stopPropagation(); onClick?.() }}
      disabled={!onClick}
      aria-label={dir < 0 ? 'Previous home' : 'Next home'}
      title={dir < 0 ? 'Previous home (←)' : 'Next home (→)'}
      className="absolute top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#111827] shadow-[0_18px_40px_-14px_rgba(0,0,0,.7)] ring-1 ring-black/5 transition-colors hover:bg-white disabled:cursor-default min-[1320px]:grid"
      style={dir < 0 ? { left: 'calc(50% - 576px - 76px)' } : { right: 'calc(50% - 576px - 76px)' }}
    >
      <Icon size={26} strokeWidth={2.4} />
    </motion.button>
  )
}

// The Showcase detail window (also Discovery's "View Details", the open house wizard's preview and
// the agent's own Showcase view). Built from the shared property design (components/property/
// PropertyKit) so a home looks the same here as on the Listing Page and the IDX site. Its own
// extras: the header with Back + Copy Share Link, the buyer's Love / Pass + Schedule a tour, and
// their comment thread with the agent (a sticky panel beside the home), and the MLS notice.
// Kept light so scrolling stays smooth: no backdrop blur behind the window (it re-blurred the
// animating page underneath on every frame) and no sticky jump bar.
export default function PropertyDetailsModal({
  property: propertyProp,
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
  showcaseTools = false,
  nav = null,
  move = null,
}: PropertyDetailsModalProps) {
  // Keep the home on screen while the window animates closed (pages clear it the moment they close).
  const property = useLastValue(propertyProp)
  const phone = useIsPhone()
  const reduce = useReducedMotion()
  const { sheetRef, y: sheetY } = useSwipeToClose(onClose, phone && isOpen)
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

  // Each home opens at the top, not wherever the last one was scrolled to - reset once the old home
  // has slid away (see the content's AnimatePresence), so it never jumps while leaving.
  const resetScroll = () => { scrollRef.current?.scrollTo({ top: 0 }); setBarOn(false) }

  // The page behind can't scroll while the window is open: it's pinned in place (position: fixed at
  // its current scroll) and put back at exactly the same spot once the window has finished closing.
  // Laid down before the first paint (useLayoutEffect) so the page never scrolls a frame first.
  // The overlay opts out of the site-wide ScrollLockWatcher (data-scroll-lock="off") - two locks
  // fighting over <body> is what made a phone jump to the top and back when details closed (10/19).
  const unlockRef = useRef<(() => void) | null>(null)
  const isOpenRef = useRef(isOpen)
  isOpenRef.current = isOpen
  useLayoutEffect(() => {
    if (!isOpen || unlockRef.current) return // reopened mid-close: the page is still pinned
    const body = document.body
    const html = document.documentElement
    if (body.style.position === 'fixed') return // something else already pinned it
    const scrollY = window.scrollY
    const saved = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width, html: html.style.overflow }
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    html.style.overflow = 'hidden'
    unlockRef.current = () => {
      unlockRef.current = null
      body.style.overflow = saved.overflow
      body.style.position = saved.position
      body.style.top = saved.top
      body.style.left = saved.left
      body.style.right = saved.right
      body.style.width = saved.width
      html.style.overflow = saved.html
      // Same frame, no smooth scrolling: the page is back exactly where it was, no jump or flash.
      const behavior = html.style.scrollBehavior
      html.style.scrollBehavior = 'auto'
      window.scrollTo(0, scrollY)
      html.style.scrollBehavior = behavior
    }
  }, [isOpen])
  // Normally released by the close animation finishing (onExitComplete below); this is the backstop
  // for a close with nothing left to animate.
  useEffect(() => {
    if (isOpen) return
    const t = window.setTimeout(() => { if (!isOpenRef.current) unlockRef.current?.() }, 700)
    return () => window.clearTimeout(t)
  }, [isOpen])
  useEffect(() => () => unlockRef.current?.(), [])

  // Wide screens: the keyboard's arrow keys step through the homes (not while typing; the photo
  // viewer catches its own arrows first).
  useEffect(() => {
    if (!isOpen || !nav) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowRight' && nav.onNext) { e.preventDefault(); nav.onNext() }
      if (e.key === 'ArrowLeft' && nav.onPrev) { e.preventDefault(); nav.onPrev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, nav])

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

  // Phone: a sheet that slides up from the bottom edge and back down (also when pulled down).
  // Wider screens keep the centred window that rises and settles. Reduced motion: fades only.
  const off = typeof window !== 'undefined' ? window.innerHeight : 900
  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.16 } }, exit: { opacity: 0, transition: { duration: 0.14 } } }
    : phone
      ? { initial: { y: off }, animate: { y: 0, transition: SHEET_SPRING }, exit: { y: off, transition: { duration: 0.26, ease: [0.32, 0, 0.67, 0] as const } } }
      : { initial: { opacity: 0, y: 48, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1, transition: SPRING }, exit: { opacity: 0, y: 36, scale: 0.98, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } } }
  const hasNav = !!nav && nav.total > 1 && !!(nav.onPrev || nav.onNext)

  return (
    <AnimatePresence onExitComplete={() => { if (!isOpenRef.current) unlockRef.current?.() }}>
      {isOpen && (
        <motion.div
          key="sc-window"
          data-scroll-lock="off"
          className="fixed inset-0 flex items-end justify-center overscroll-none sm:items-center sm:p-6"
          style={{ zIndex }}
          onClick={onClose}
        >
          {/* The dimmed page behind fades on its own, so the sheet itself stays solid as it slides. */}
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[#0B0B0B]/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } }}
            exit={{ opacity: 0, transition: { duration: phone ? 0.26 : 0.2, delay: phone ? 0 : 0.04 } }}
          />
          {/* Wide screens: big arrows either side of the window for the previous / next home. */}
          {hasNav && (
            <>
              <SideArrow dir={-1} onClick={nav!.onPrev} />
              <SideArrow dir={1} onClick={nav!.onNext} />
            </>
          )}
          <motion.div
            ref={sheetRef}
            {...sheetMotion}
            className="relative flex h-[calc(100%-2.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-t-[26px] shadow-2xl sm:h-[88vh] sm:rounded-[28px]"
            style={{ overscrollBehavior: 'contain', y: phone && !reduce ? sheetY : undefined }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={home.street || 'Home details'}
          >
            <PropertySurface surface="app" gold={GOLD} ink={INK} className="flex min-h-0 flex-1 flex-col bg-[var(--pp-bg)]">
              {/* header - on a phone also the handle you pull down to close */}
              <div className="z-40 border-b border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] px-4 pb-2.5 pt-1.5 sm:px-6 sm:py-3">
                <div aria-hidden className="mx-auto mb-1.5 h-[5px] w-10 rounded-full bg-[color:var(--pp-gold-line)] sm:hidden" />
                <div className="relative flex items-center justify-between gap-2 sm:gap-3">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={String(property.id)}
                      className="min-w-0 flex-1 leading-tight"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.14 } }}
                    >
                      <p className={`truncate font-serif text-[15px] font-black sm:text-base ${pp.heading}`}>{home.street}</p>
                      {home.place && <p className={`flex items-center gap-1 truncate text-[11px] font-semibold ${pp.muted}`}><MapPin className="h-3 w-3 shrink-0 text-[color:var(--pp-gold)]" />{home.place}</p>}
                    </motion.div>
                  </AnimatePresence>
                  {shareUrl && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCopyLink}
                      className={`hidden shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors sm:inline-flex ${copied ? 'border-emerald-600 bg-emerald-600 text-white' : `border-[color:var(--pp-gold-line)] bg-[var(--pp-card)] hover:border-[color:var(--pp-gold)] ${pp.heading}`}`}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} className="text-[color:var(--pp-gold)]" />}
                      {copied ? 'Copied!' : 'Copy Share Link'}
                    </motion.button>
                  )}
                  {shareUrl && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleCopyLink} aria-label="Copy share link"
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors sm:hidden ${copied ? 'border-emerald-600 bg-emerald-600 text-white' : `border-[color:var(--pp-gold-line)] ${pp.heading}`}`}>
                      {copied ? <Check size={15} /> : <Copy size={15} className="text-[color:var(--pp-gold)]" />}
                    </motion.button>
                  )}
                  {/* Previous / next home - up top too, since the phone bar only shows once you scroll. */}
                  {hasNav && (
                    <div className="flex shrink-0 items-center rounded-full border border-[color:var(--pp-gold-line)] bg-[var(--pp-card)]">
                      <NavButton dir={-1} onClick={nav!.onPrev} />
                      {nav!.index >= 0 && (
                        <span className={`min-w-[2.6rem] select-none text-center text-[11px] font-black tabular-nums ${pp.muted}`}>
                          {nav!.index + 1}<span className="opacity-50">/</span>{nav!.total}
                        </span>
                      )}
                      <NavButton dir={1} onClick={nav!.onNext} />
                    </div>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                    onClick={onClose}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--pp-gold-wash)] transition-colors hover:bg-[color:var(--pp-gold-line)] ${pp.heading}`}
                    title="Close"
                    aria-label="Close"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </motion.button>
                </div>
              </div>

              <div ref={scrollRef} onScroll={e => { const on = e.currentTarget.scrollTop > 640; if (on !== barOn) setBarOn(on) }} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                {/* One home at a time: the next one slides in from the side it came from; a passed
                    home slides off to the left and the next takes its place. */}
                <AnimatePresence mode="wait" initial={false} custom={move} onExitComplete={resetScroll}>
                <motion.div
                  key={String(property.id)}
                  custom={move}
                  variants={reduce ? FADE_HOME : SLIDE_HOME}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  style={{ transformOrigin: '50% 0%' }}
                  className="px-4 pb-28 pt-4 sm:px-7 sm:pt-6 lg:pb-10"
                >
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
                  {showcaseTools && <ShowcaseMembership propertyId={property.id} listingKey={property.ListingKey} street={home.street} zIndex={zIndex + 20} />}
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
                                  className="block w-full resize-none rounded-2xl border border-white/[0.12] bg-white/[0.06] py-3 pl-4 pr-14 text-sm font-medium text-white outline-none transition placeholder:text-white/35 focus:border-[color:var(--pp-gold)] focus:ring-4 focus:ring-white/10"
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
                </motion.div>
                </AnimatePresence>
              </div>

              {/* Phones: Love / Pass / tour / message ride along once you've scrolled past the price
                  panel - flush with the bottom edge (no gap above the browser's own bar), clear of
                  the iPhone home indicator, with the previous / next home either side. */}
              <AnimatePresence>
              {showVisitorActions && barOn && (
                <motion.div
                  key="phone-bar"
                  initial={reduce ? { opacity: 0 } : { y: '105%' }}
                  animate={reduce ? { opacity: 1 } : { y: 0, transition: SPRING }}
                  exit={reduce ? { opacity: 0 } : { y: '105%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
                  className="absolute inset-x-0 bottom-0 z-30 rounded-t-[22px] bg-[var(--pp-ink)] px-2 pt-2 shadow-[0_-16px_40px_-18px_rgba(0,0,0,.6)] ring-1 ring-white/10 lg:hidden"
                  style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                >
                  <div className="flex items-center gap-1.5">
                    {hasNav && <NavButton dir={-1} onClick={nav!.onPrev} dark />}
                    <div className="min-w-0 flex-1">
                      <TakeButtons compact liked={!!property.liked} disliked={!!property.disliked}
                        onLike={() => onLike?.(property.id!, !property.liked)} onPass={() => onDislike?.(property.id!, !property.disliked)} />
                    </div>
                    {tour && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={tour} aria-label="Schedule a tour"
                        className={`grid h-[42px] w-11 shrink-0 place-items-center rounded-xl ${tourState(tourRequest) === 'confirmed' ? 'bg-emerald-500 text-white' : tourState(tourRequest) === 'pending' || property.hasTourScheduled ? 'bg-amber-400 text-[#111827]' : 'bg-white/10 text-white'}`}>
                        {tourState(tourRequest) === 'confirmed' ? <CalendarCheck size={17} /> : tourState(tourRequest) === 'pending' || property.hasTourScheduled ? <Hourglass size={17} /> : <CalendarDays size={17} />}
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={toComments} aria-label="Message your agent" className="relative grid h-[42px] w-11 shrink-0 place-items-center rounded-xl bg-[var(--pp-gold)] text-[color:var(--pp-ink)]">
                      <MessageCircle size={17} />
                      {comments.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 text-[9px] font-black text-[#111827]">{comments.length}</span>}
                    </motion.button>
                    {hasNav && <NavButton dir={1} onClick={nav!.onNext} dark />}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
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
