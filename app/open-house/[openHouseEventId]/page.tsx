'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import SimilarHomesIntro from '@/components/open-house/SimilarHomesIntro'
import OpenHouseSignInForm from '@/components/OpenHouseSignInForm'
import { Property, SignInFormData } from '@/types'
import api from '@/lib/api-service'
import { enqueueSignIn, queueCount, startQueueFlusher } from '@/lib/kioskQueue'
import { formVisitContext } from '@/lib/formTracking'
import OhpLoader from '@/components/brand/OhpLoader'
import { useQrDataUrl } from '@/lib/qr'
import { MlsUpdatedText } from '@/components/MLSComplianceFooter'
import { setQrOwner } from '@/lib/qr'

// Auto-reset delay after a guest submits, before Kiosk mode clears back to a blank form for
// the next one.
const KIOSK_RESET_MS = 6000
// How long the thank-you shows before a guest is taken to the host's Spotlight for this home.
const SPOTLIGHT_REDIRECT_MS = 2200
// How long the discreet corner button must be held to actually exit Kiosk mode - long enough
// that a curious/idle guest tap can't trigger it by accident.
const KIOSK_EXIT_HOLD_MS = 1500

// Small always-present affordance so the agent (not a guest) can get back out of Kiosk mode -
// press-and-hold rather than a single tap, on purpose.
function KioskExitHandle({ onExit }: { onExit: () => void }) {
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holding, setHolding] = useState(false)

  const startHold = () => {
    setHolding(true)
    holdTimeoutRef.current = setTimeout(onExit, KIOSK_EXIT_HOLD_MS)
  }
  const cancelHold = () => {
    setHolding(false)
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
  }

  return (
    <button
      type="button"
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Exit Kiosk mode (press and hold)"
      title="Press and hold to exit Kiosk mode"
      className="fixed bottom-3 left-3 z-[100] h-9 w-9 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 overflow-hidden transition-colors"
    >
      {holding && (
        <motion.div
          className="absolute inset-0 rounded-full bg-[#C9A24D]/70"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: KIOSK_EXIT_HOLD_MS / 1000, ease: 'linear' }}
        />
      )}
    </button>
  )
}

// Discreet light/dark switch for whoever is minding the kiosk - guests filling out the form
// don't need it, but an agent setting up in a bright or dim room does. Deliberately NOT wired to
// next-themes/the app's global theme (that's shared per-origin via localStorage, and this page
// can run in an iframe on the same origin as the agent's own OpenHousePal dashboard) - toggling
// it must only affect this Sign-In Sheet/Kiosk page, never the agent's own app theme. `dark` and
// `onToggle` are fully local state owned by the page. `variant="large"` is a prominent, labeled,
// non-fixed button for the mode-chooser screen (sits centered under the two option cards); the
// default "corner" variant is the small always-present icon used on every other kiosk screen.
function KioskThemeToggle({ dark, onToggle, variant = 'corner' }: { dark: boolean; onToggle: () => void; variant?: 'corner' | 'large' }) {
  if (variant === 'large') {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-[#151517]"
      >
        {dark ? <Sun className="h-6 w-6 text-[#C9A24D]" /> : <Moon className="h-6 w-6 text-[#C9A24D]" />}
        <span className="text-base font-black text-[#0B0B0B] dark:text-white">
          {dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      className="fixed bottom-3 right-3 z-[100] flex h-9 w-9 items-center justify-center rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
    >
      {dark ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-[#111827]" />}
    </button>
  )
}

// Small device-frame mockups on the mode-chooser cards so "Kiosk" vs "Sheet" reads at a glance
// - each frame's own orientation matches how that mode actually gets used on the tablet:
// landscape for the interactive form (typed input is easier propped up wide), portrait for the
// sheet display (matches the printed flyer it's standing in for).
// `dark` is the mode-chooser's own local kioskDark toggle. Only the actual mocked-up "screen"
// content changes with it (matching what really changes in the real light/dark Sign-In
// Kiosk/Sheet) - the device bezel around it stays fixed, it's not part of what the toggle affects.
function KioskModePreview({ dark }: { dark: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[240px] rounded-2xl border-[3px] border-[#111827]/15 bg-[#111827]/5 p-1.5">
      <div className={`flex aspect-video w-full flex-col justify-center gap-1.5 rounded-lg border border-[#C9A24D]/25 p-3 ${dark ? 'bg-[#1A1A1C]' : 'bg-[#fbfaf3]'}`}>
        <div className={`h-2 w-2/5 rounded-full ${dark ? 'bg-white/70' : 'bg-[#111827]/70'}`} />
        <div className={`mt-1 h-2.5 w-full rounded-full ${dark ? 'bg-white/10' : 'bg-[#111827]/10'}`} />
        <div className={`h-2.5 w-full rounded-full ${dark ? 'bg-white/10' : 'bg-[#111827]/10'}`} />
        <div className="mt-1.5 flex justify-end gap-1.5">
          <div className={`h-4 w-9 rounded-full ${dark ? 'bg-white/10' : 'bg-[#111827]/10'}`} />
          <div className="h-4 w-9 rounded-full bg-[#C9A24D]" />
        </div>
      </div>
    </div>
  )
}

function SheetModePreview({ dark }: { dark: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[150px] rounded-2xl border-[3px] border-[#111827]/15 bg-[#111827]/5 p-1.5">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-[#C9A24D]/25 bg-gradient-to-br from-[#4a4030] via-[#211d17] to-black">
        <div className="absolute inset-x-2.5 top-2.5">
          <div className="h-1.5 w-3/5 rounded-full bg-white/70" />
          <div className="mt-1 h-2 w-4/5 rounded-full bg-white/90" />
        </div>
        {/* The real Sign-In Sheet's info/QR strip sits on this light/dark card background - the
            photo above it and the QR code itself both stay the same either way, so this bottom
            strip is the one part of the mockup that actually changes with the toggle. */}
        <div className={`absolute inset-x-0 bottom-0 h-11 ${dark ? 'bg-[#0B0B0B]' : 'bg-[#FAFAF7]'}`} />
        <div className="absolute bottom-2.5 left-1/2 h-9 w-9 -translate-x-1/2 rounded-md bg-white/95 p-1 grid grid-cols-3 grid-rows-3 gap-[1px]">
          {[0, 2, 4, 6, 8].map(i => (
            <div key={i} className="rounded-[1px] bg-black" style={{ gridArea: `${Math.floor(i / 3) + 1} / ${(i % 3) + 1}` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function getAgentInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

// How long each rotating photo stays on screen in Sign-In Sheet mode.
const SHEET_PHOTO_ROTATE_MS = 9000
// How long the crossfade itself takes.
const FADE_DURATION_S = 1.6
// A soft "expo out" curve (fast start, long gentle settle) instead of plain easeInOut - reads as
// a more deliberate, cinematic dissolve rather than a basic fade.
const FADE_EASE = [0.16, 1, 0.3, 1] as const
// Corners the slow Ken Burns pan drifts toward, cycled per photo so consecutive slides don't
// all pan the same direction.
const KEN_BURNS_ORIGINS = ['20% 20%', '80% 20%', '20% 80%', '80% 80%']
// Rotation of motion styles applied to the rotating photos, cycled by photo index.
const PHOTO_EFFECTS = ['pan-corner', 'zoom-in', 'pan-horizontal', 'zoom-out'] as const
// Each photo is drawn larger than its frame (extra mostly off the bottom + left, where MLS photo
// tags like "Bright MLS" are stamped) so the tag never shows - scaling only ever pushes the image's
// edges further out, so this holds at every point of every motion style.
const PHOTO_OVERSCAN_STYLE = { top: '-4%', bottom: '-10%', left: '-8%', right: '-4%' } as const
function PhotoFill({ url }: { url: string }) {
  return <div className="absolute bg-cover bg-center" style={{ ...PHOTO_OVERSCAN_STYLE, backgroundImage: `url(${url})` }} />
}

// Module-scope (NOT defined inside SignInSheetDisplay's render body) - AnimatePresence needs a
// stable component identity across re-renders to actually run exit animations. Redefining this
// as a fresh inline function on every parent render made React treat each version as a different
// component type, force-unmounting the outgoing photo instantly (no fade) instead of letting
// AnimatePresence crossfade it - every rotation flashed to black before the next photo faded up.
// withBottomGradient (portrait only) is rendered AS A CHILD of the photo's own motion.div so it
// crossfades together with it rather than as an independent, always-on overlay.
function PhotoLayer({ photos, photoIndex, withBottomGradient }: { photos: string[]; photoIndex: number; withBottomGradient?: boolean }) {
  // Cycle through a few different motion styles instead of the same pan every time, so a sheet
  // that sits running for hours doesn't feel repetitive: an off-center "Ken Burns" corner pan, a
  // centered zoom-in, a side-to-side horizontal pan, a centered zoom-out.
  const zoomDuration = SHEET_PHOTO_ROTATE_MS / 1000 + FADE_DURATION_S
  const effect = PHOTO_EFFECTS[photoIndex % PHOTO_EFFECTS.length]
  const bottomGradient = withBottomGradient
    ? <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white dark:from-[#151517] to-transparent" />
    : null

  if (effect === 'pan-horizontal') {
    // Scaled up so there's room to slide left<->right without ever showing an edge, direction
    // alternates so consecutive slides don't all drift the same way. A slight scale settle (1.24
    // -> 1.2) plus a soft blur-in/out layered on top of the pan and fade gives the crossfade more
    // depth than a flat opacity dissolve - closer to a film-style transition than a slideshow one.
    const panRight = photoIndex % 2 === 0
    return (
      <AnimatePresence mode="sync">
        {photos.length > 0 && (
          <motion.div
            key={photoIndex}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.24, x: panRight ? '-4%' : '4%' }}
            animate={{ opacity: 1, scale: 1.2, x: panRight ? '4%' : '-4%' }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: FADE_DURATION_S, ease: FADE_EASE },
              filter: { duration: FADE_DURATION_S, ease: FADE_EASE },
              scale: { duration: FADE_DURATION_S, ease: FADE_EASE },
              x: { duration: zoomDuration, ease: 'linear' },
            }}
          >
            <PhotoFill url={photos[photoIndex]} />
            {bottomGradient}
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  const zoomOut = effect === 'zoom-out'
  const origin = effect === 'pan-corner' ? KEN_BURNS_ORIGINS[photoIndex % KEN_BURNS_ORIGINS.length] : '50% 50%'
  return (
    <AnimatePresence mode="sync">
      {photos.length > 0 && (
        <motion.div
          key={photoIndex}
          className="absolute inset-0"
          style={{ transformOrigin: origin }}
          // A soft blur-in/out layered on top of the fade (rather than a flat opacity dissolve)
          // reads as a more deliberate, cinematic transition. Overscan margin (1.03/1.18 floor)
          // still guards against sub-pixel rounding revealing the container's black edge.
          initial={{ opacity: 0, scale: zoomOut ? 1.2 : 1.03 }}
          animate={{ opacity: 1, scale: zoomOut ? 1.03 : 1.2 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: FADE_DURATION_S, ease: FADE_EASE },
            filter: { duration: FADE_DURATION_S, ease: FADE_EASE },
            scale: { duration: zoomDuration, ease: 'linear' },
          }}
        >
          <PhotoFill url={photos[photoIndex]} />
          {bottomGradient}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Screen-only stand-in for a printed sign-in sheet - left running on a tablet next to the
// property, showing rotating photos and a QR code guests scan with their own phone. Renders two
// distinct, purpose-built layouts (not one squeezed into both shapes) and switches between them
// live via CSS orientation media queries, so physically rotating the tablet just works.
function SignInSheetDisplay({ property, signInUrl }: { property: Property; signInUrl: string }) {
  // The QR's centre is the hosting agent's choice (OpenHousePal house, or IDX: their logo / initials).
  if (property.agentId) setQrOwner(property.agentId)
  const photos = property.photos?.length ? property.photos : (property.ListPictureURL ? [property.ListPictureURL] : [])
  const [photoIndex, setPhotoIndex] = useState(0)

  useEffect(() => {
    if (photos.length <= 1) return
    const timer = setInterval(() => setPhotoIndex(i => (i + 1) % photos.length), SHEET_PHOTO_ROTATE_MS)
    return () => clearInterval(timer)
  }, [photos.length])

  const qrUrl = useQrDataUrl(signInUrl, { size: 600 })
  const formatPrice = (price?: number) => price ? `$${price.toLocaleString()}` : 'Price Available Upon Request'

  // Every size here scales with the screen (clamp + vw/vh) instead of fixed pixels - a kiosk runs
  // on anything from an iPad mini to a 13" iPad Pro, portrait or landscape, and nothing may spill
  // off the edge. `compact` = the narrow landscape side column.
  const InfoBlock = ({ compact }: { compact?: boolean }) => (
    <div className="min-w-0">
      <p className="font-black uppercase tracking-[0.3em] text-[#C9A24D]" style={{ fontSize: 'clamp(0.7rem, 1.1vw, 0.875rem)' }}>Welcome</p>
      <h1 className="mt-1 font-black leading-[1.05] tracking-tight text-[#0B0B0B] dark:text-white" style={{ fontSize: compact ? 'clamp(2rem, 3.6vw, 3rem)' : 'clamp(2.25rem, 5.4vw, 3.75rem)' }}>Open House</h1>
      <div className="mt-3 h-1.5 w-16 rounded-full bg-[#C9A24D]" />

      <p className="mt-[2.2vh] font-bold uppercase tracking-widest text-gray-400" style={{ fontSize: 'clamp(0.65rem, 1vw, 0.875rem)' }}>Property Address</p>
      {/* Address and city as separate block-level lines (not one run-on string) so a long
          address never wraps mid-way and drags half the city onto the address's own line - city
          always lands cleanly on its own line underneath instead. */}
      <p className="mt-1 break-words font-black leading-tight text-[#0B0B0B] dark:text-white" style={{ fontSize: compact ? 'clamp(1.35rem, 2.3vw, 1.875rem)' : 'clamp(1.5rem, 3.6vw, 2.25rem)' }}>
        {property.FullStreetAddress}
      </p>
      {property.City && (
        <p className="font-bold leading-tight text-gray-400 dark:text-gray-500" style={{ fontSize: compact ? 'clamp(1rem, 1.6vw, 1.25rem)' : 'clamp(1.05rem, 2.4vw, 1.5rem)' }}>
          {property.City}
        </p>
      )}

      {/* Wraps onto a second line on narrow screens rather than running off the edge. */}
      <div className="mt-[2.2vh] flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[#0B0B0B] dark:text-white">
        {([[property.BedroomsTotal || 0, 'Beds'], [property.BathroomsTotal || 0, 'Baths'], [Number(property.LivingArea || 0).toLocaleString(), 'Sq Ft']] as const).map(([v, label]) => (
          <div key={label} className="whitespace-nowrap">
            <span className="font-black" style={{ fontSize: compact ? 'clamp(1.35rem, 2.3vw, 1.875rem)' : 'clamp(1.5rem, 3.4vw, 2.25rem)' }}>{v}</span>
            <span className="ml-1.5 text-xs font-bold uppercase tracking-widest text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      <p className="mt-[2.2vh] font-black leading-none text-[#C9A24D]" style={{ fontSize: compact ? 'clamp(2rem, 3.6vw, 3rem)' : 'clamp(2.25rem, 5.4vw, 3.75rem)' }}>{formatPrice(property.ListPrice)}</p>
    </div>
  )

  const QRBlock = ({ size }: { size: string }) => (
    <div className="flex min-w-0 flex-col items-center gap-[1.6vh] text-center">
      <div className="min-w-0">
        <p className="font-black uppercase tracking-widest text-gray-400" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 1rem)' }}>Instant Check-In</p>
        <h2 className="mt-1 font-black leading-tight text-[#0B0B0B] dark:text-white" style={{ fontSize: 'clamp(1.5rem, 3.4vw, 3rem)' }}>Scan to Sign In</h2>
      </div>
      <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-lg dark:border-gray-800">
        {qrUrl
          ? <img src={qrUrl} alt="Scan to sign in" style={{ height: size, width: size }} className="block" />
          : <div style={{ height: size, width: size }} />}
      </div>
      <div>
        <p className="font-black uppercase tracking-widest text-[#C9A24D]" style={{ fontSize: 'clamp(0.7rem, 1.2vw, 1rem)' }}>Quick &amp; Easy</p>
        <p className="font-medium text-gray-400" style={{ fontSize: 'clamp(0.75rem, 1.2vw, 1rem)' }}>Takes less than 30 seconds to complete</p>
      </div>
    </div>
  )

  // Hosting agent's identity - floats as a frosted pill over the top-center of the rotating
  // photo (photo on the left, name/brokerage stacked to its right). Dark translucent glass +
  // white text since it has to stay legible over whatever photo happens to be showing, not tied
  // to the page's own light/dark styling.
  const AgentBranding = () => {
    if (!property.agentName) return null
    return (
      <div className="absolute inset-x-0 top-5 z-10 flex justify-center px-4">
        <div className="inline-flex items-center gap-4 rounded-full border border-white/20 bg-black/40 py-2 pl-2 pr-6 shadow-xl ">
          {property.agentPhotoUrl ? (
            <img
              src={property.agentPhotoUrl}
              alt={property.agentName}
              className="h-14 w-14 shrink-0 rounded-full border-2 object-cover shadow-md"
              style={{ borderColor: '#C9A24D' }}
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-lg font-black text-white shadow-md"
              style={{ borderColor: '#C9A24D', backgroundColor: '#C9A24D' }}
            >
              {getAgentInitials(property.agentName)}
            </div>
          )}
          <div className="text-left">
            <p className="font-serif text-lg font-black leading-tight text-white">{property.agentName}</p>
            {property.agentBrokerage && (
              <p className="mt-0.5 text-[11px] font-bold uppercase leading-tight tracking-wide text-white/70">
                {property.agentBrokerage}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Portrait - hero photo on top (its own landscape shape crops far less than stretching it
          to fill a whole portrait screen), info and QR side by side below. Mirrors the printed
          Sign-In Flyer's own hero-photo-then-two-column structure. */}
      {/* CSS Grid rows (not flex-col with flex-[3]/flex-[2] basis-0) - flexbox's fractional
          flex-grow split can leave a 1px sub-pixel gap between the two rows at some viewport
          heights, showing as a thin black line right under the photo; grid track sizing doesn't
          have that rounding gap. */}
      <div className="hidden portrait:grid h-screen w-full grid-rows-[3fr_2fr] overflow-hidden bg-[#FAFAF7] dark:bg-[#0B0B0B]">
        <div className="relative overflow-hidden bg-black">
          {/* Fades into the SAME color as the row below (white/#151517, not the page's own
              #FAFAF7/#0B0B0B) - the right column below is a white "card" already, so matching the
              gradient to the page background instead of the row it actually sits on left a
              visible seam right at this boundary. */}
          <PhotoLayer photos={photos} photoIndex={photoIndex} withBottomGradient />
          <AgentBranding />
        </div>
        <div className="flex items-stretch divide-x divide-gray-200 dark:divide-gray-800 bg-white dark:bg-[#151517]">
          {/* Both columns start from the same top padding (no vertical centering) so the "Open
              House" and "Scan to Sign In" headers land at the same height, regardless of how
              much shorter/taller one column's content is than the other's. */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-[4vw] pt-[4vh] pb-[2vh]">
            <InfoBlock />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center overflow-hidden px-[3vw] pt-[4vh] pb-[2vh]">
            <QRBlock size="min(224px, 28vw, 19vh)" />
          </div>
        </div>
      </div>

      {/* Landscape - a wide screen doesn't suit a stacked top/bottom split (both halves end up
          too short to read comfortably); hero photo takes the left column full-height instead,
          info and QR stack on the right where there's room to breathe. */}
      <div className="hidden landscape:flex h-screen w-full overflow-hidden bg-[#FAFAF7] dark:bg-[#0B0B0B]">
        <div className="relative w-[60%] xl:w-[64%] h-full overflow-hidden bg-black">
          <PhotoLayer photos={photos} photoIndex={photoIndex} />
          <AgentBranding />
        </div>
        {/* my-auto (not justify-center) so a tall column scrolls from its top instead of
            cutting the heading off above the screen. */}
        <div className="flex w-[40%] xl:w-[36%] h-full flex-col overflow-y-auto bg-white dark:bg-[#151517] px-[3vw] py-[4vh]">
          <div className="my-auto flex flex-col gap-[4vh]">
            <InfoBlock compact />
            <div className="flex items-center justify-center border-t border-gray-100 dark:border-gray-800 pt-[3.5vh]">
              <QRBlock size="min(210px, 17vw, 27vh)" />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const ComplianceFooter = () => (
  <div className="mt-12 text-center max-w-3xl mx-auto pb-4 px-4">
    <p className="text-[10px] text-gray-400 font-medium leading-relaxed uppercase tracking-wider">
      © BRIGHT, All Rights Reserved | Information Deemed Reliable But Not Guaranteed. Some properties which appear for sale may no longer be available.
      <span className="block sm:inline ml-0 sm:ml-1"><MlsUpdatedText /></span>
    </p>
  </div>
)

export default function OpenHouseSignInPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  // Local-only dark mode for this page - see KioskThemeToggle for why this deliberately isn't
  // wired to next-themes/the app's global theme.
  const [kioskDark, setKioskDark] = useState(false)
  const toggleKioskDark = useCallback(() => setKioskDark(d => !d), [])
  // The mode-chooser's own chrome (title/cards/background - everything except the two preview
  // graphics, which show what guests will actually see and are driven by kioskDark/qrDarkMode
  // instead) should still feel like part of the agent's own app when they're the one opening this
  // popup from their dashboard. Read directly from localStorage once on mount rather than via
  // next-themes/useTheme, so it can't re-trigger the exact leak this page otherwise guards against.
  const [agentTheme, setAgentTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    try {
      if (localStorage.getItem('theme') === 'dark') setAgentTheme('dark')
    } catch {
      // Storage access can be blocked (e.g. strict privacy settings) - default to light.
    }
  }, [])
  useEffect(() => {
    // The app's global ThemeProvider still wraps this route too and applies whatever theme is in
    // localStorage to this document's <html> on mount - and can re-apply it again after this
    // effect runs (it's an ancestor, so its own mount effect can fire after this one) since this
    // route is same-origin and shares that localStorage key with the main app, including when
    // loaded inside the Kiosk preview iframe on the Open Houses page. A MutationObserver (not just
    // a one-time removal) keeps it permanently stripped for as long as this page is mounted, so
    // dark/light here is driven only by the local `kioskDark` wrapper above, never by whatever
    // theme the agent's own dashboard happens to be in.
    const html = document.documentElement
    html.classList.remove('dark')
    const observer = new MutationObserver(() => {
      if (html.classList.contains('dark')) html.classList.remove('dark')
    })
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [goingTo, setGoingTo] = useState<{ kind: string; url: string } | null>(null)
  const goingToSpotlight = !!goingTo
  // Sign-ins that couldn't reach the server yet (offline / hiccup) and are waiting to sync.
  const [queuedCount, setQueuedCount] = useState(0)

  const openHouseEventId = params.openHouseEventId as string

  // Background flusher: retries any queued sign-ins whenever the connection comes back (and on a
  // 30s interval). Runs on this page whether or not it's in kiosk mode.
  useEffect(() => {
    setQueuedCount(queueCount())
    const stop = startQueueFlusher(setQueuedCount)
    return stop
  }, [])

  // Kiosk mode: an agent leaves this page open on a tablet at the property. Two flavors -
  // "interactive" (guests tap through the sign-in form themselves) and "sheet" (a screen-only
  // stand-in for a printed sign-in sheet, for agents without a printer handy: rotating property
  // photos plus a QR code guests scan with their own phone, same as the printed Sign-In Flyer).
  const isKiosk = searchParams.get('kiosk') === '1'
  // Reached from a Similar Properties handout's QR code (not the open house sign-in sheet) -
  // same form, same submit path, auto-showcase and follow-up email all unchanged, just framed
  // as "want to see more like this" instead of "sign in."
  const wantsSimilar = searchParams.get('intent') === 'similar'
  // Those guests first get a screen that says back what they tapped (SimilarHomesIntro), then the
  // same sign-in steps.
  const [similarStarted, setSimilarStarted] = useState(false)
  // Their answer to "Do you have an agent?" - picks the thank-you a Similar Homes guest sees.
  const [saidHasAgent, setSaidHasAgent] = useState(false)
  // Where the host wants the guest's phone to go after signing in: their Spotlight for this home or
  // their Agent Hub (the API only sends it when that's their choice and their plan includes it).
  const afterSignin: { kind: 'spotlight' | 'hub'; url: string } | undefined = (property as any)?.afterSignin || undefined
  const spotlightUrl = afterSignin?.url
  const [kioskMode, setKioskMode] = useState<'interactive' | 'sheet' | null>(null)
  // Forces OpenHouseSignInForm to remount with fresh internal state for the next guest - it's
  // an uncontrolled multi-step form, so this is simpler and safer than threading a reset API
  // through its props.
  const [formInstanceKey, setFormInstanceKey] = useState(0)
  const wakeLockRef = useRef<any>(null)

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch {
      // Best-effort only - unsupported/denied on some browsers (notably older iPadOS Safari).
      // Kiosk mode still works, the screen just isn't guaranteed to stay awake.
    }
  }, [])

  const startKiosk = useCallback((mode: 'interactive' | 'sheet') => {
    // Picking a mode inside the small "Choose Sign-In Mode" popup on the Open Houses page (an
    // iframe) hands off to a real, separate browser tab - that's what actually needs to run for a
    // guest, not something squeezed into the popup's preview card. A plain new tab (no
    // width/height/popup window features) rather than a stripped-down popup window, fullscreened
    // immediately once it loads (see the mode-param effect below). window.open must be called
    // synchronously here (not after an await) or the browser's popup blocker silently kills it.
    if (window.self !== window.top) {
      const url = `${window.location.pathname}?kiosk=1&mode=${mode}`
      const kioskWindow = window.open(url, '_blank')
      if (kioskWindow) {
        // Tell the parent Open Houses page to close this chooser popup now that the real kiosk
        // window is up.
        window.parent.postMessage({ type: 'openhousepal:kiosk-launched' }, window.location.origin)
      }
      return
    }

    // Standalone (this device loaded the kiosk URL directly, or is the new window opened above) -
    // fullscreen must be requested directly inside a click handler, not after an await, or the
    // browser silently refuses it as no longer being a user gesture.
    ;(async () => {
      try {
        await document.documentElement.requestFullscreen?.()
      } catch {
        // Not available/allowed on every device - kiosk mode still works without true fullscreen.
      }
      requestWakeLock()
      window.history.pushState(null, '', window.location.href)
      setKioskMode(mode)
    })()
  }, [requestWakeLock])

  // The tab opened by startKiosk() above loads with ?kiosk=1&mode=X already in the URL - skip the
  // chooser entirely and start that mode (including an immediate fullscreen attempt) as soon as
  // this fresh tab mounts. Best-effort: this fires on load rather than a click, so some browsers
  // block auto-fullscreen here; the corner exit handle still lets the agent fall back to the
  // chooser and pick again from a genuine click if that happens.
  useEffect(() => {
    if (!isKiosk || kioskMode) return
    const modeParam = searchParams.get('mode')
    if (modeParam !== 'interactive' && modeParam !== 'sheet') return
    document.documentElement.requestFullscreen?.().catch(() => {})
    requestWakeLock()
    // Strip ?mode= from the URL once consumed - otherwise pressing the exit-hold button (which
    // sets kioskMode back to null) would immediately re-trigger this same effect and snap right
    // back into kiosk mode instead of actually exiting to the chooser.
    window.history.replaceState(null, '', `${window.location.pathname}?kiosk=1`)
    setKioskMode(modeParam)
  }, [isKiosk, kioskMode, searchParams, requestWakeLock])

  const exitKiosk = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release?.().catch(() => {})
      wakeLockRef.current = null
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
    setKioskMode(null)
    setSuccess(false)
    setFormInstanceKey(k => k + 1)
  }, [])

  // Re-acquire the wake lock if it was released when the tablet's screen locked/backgrounded
  // and the agent then wakes it back up.
  useEffect(() => {
    if (!kioskMode) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current == null) {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [kioskMode, requestWakeLock])

  // Traps the browser back gesture/button while Kiosk mode is running, so a guest can't
  // accidentally (or curiously) navigate away from the sign-in station.
  useEffect(() => {
    if (!kioskMode) return
    const trapBack = () => window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', trapBack)
    return () => window.removeEventListener('popstate', trapBack)
  }, [kioskMode])

  // Auto-reset: once a guest's submission succeeds in interactive mode, clear back to a blank
  // form after a short pause so the tablet is immediately ready for the next guest with no one
  // having to touch it. Sheet mode never sets `success` - guests scan and fill it out on their
  // own phone, not on this device.
  useEffect(() => {
    if (!isKiosk || kioskMode !== 'interactive' || !success) return
    const timer = setTimeout(() => {
      setSuccess(false)
      setFormInstanceKey(k => k + 1)
    }, KIOSK_RESET_MS)
    return () => clearTimeout(timer)
  }, [isKiosk, kioskMode, success])

  // Tracks the "Completion %" stat's denominator - fires once each time a fresh, blank sign-in
  // form is actually shown to a person: the normal one-off guest visit, or each new instance in
  // interactive Kiosk mode (formInstanceKey changes on every auto-reset). Deliberately excludes
  // the mode-chooser screen and Sign-In Sheet mode, since no one is looking at the form itself
  // on this device in either of those.
  // Sign-in timing (admin Insights): from the guest's first tap or keystroke on the form to Sign in.
  // Starting at first touch, not page load, so a Kiosk tablet waiting for the next guest doesn't count.
  const viewIdRef = useRef<string | null>(null)
  const firstTouchRef = useRef<number | null>(null)
  const markFirstTouch = () => { if (firstTouchRef.current == null) firstTouchRef.current = Date.now() }
  const trackedInstanceRef = useRef<number | null>(null)
  useEffect(() => {
    if (!property || isLoading || error) return
    if (isKiosk && kioskMode !== 'interactive') return
    if (trackedInstanceRef.current === formInstanceKey) return
    trackedInstanceRef.current = formInstanceKey
    viewIdRef.current = null
    firstTouchRef.current = null
    api.public.trackSignInView(openHouseEventId, isKiosk ? 'kiosk' : 'phone', formVisitContext().device)
      .then(r => { if (r.success && r.data?.view_id && trackedInstanceRef.current === formInstanceKey) viewIdRef.current = r.data.view_id })
      .catch(() => {})
  }, [property, isLoading, error, isKiosk, kioskMode, formInstanceKey, openHouseEventId])

  useEffect(() => {
    // Fetch property data from open house event by ID
    const fetchData = async () => {
      setIsLoading(true)
      const { success, data, error, qrDarkMode }: any = await api.public.getOpenHouseProperty(openHouseEventId)

      if (success && data) {
        setProperty(data)
        setError(null)
        // Default this page's own local theme to the agent's configured "QR Dark Mode" setting.
        setKioskDark(Boolean(qrDarkMode))
      } else {
        setError(error || 'Failed to load property information. Please try again.')
      }
      setIsLoading(false)
    }

    if (openHouseEventId) {
      fetchData()
    }
  }, [openHouseEventId])

  const handleFormSubmit = async (formData: SignInFormData) => {
    setSaidHasAgent(formData.hasAgent === 'YES')
    const payload = {
      full_name: formData.fullName,
      email: formData.email,
      phone: formData.phone ?? '',
      has_agent: formData.hasAgent,
      open_house_event_id: openHouseEventId,
      interested_in_similar: !!formData.interestedInSimilar,
      ...(wantsSimilar ? { intent: 'similar' } : {}),
      ...(viewIdRef.current ? { signin_view_id: viewIdRef.current } : {}),
      ...(firstTouchRef.current != null ? { signin_seconds: Math.round((Date.now() - firstTouchRef.current) / 100) / 10 } : {}),
      signin_mode: (isKiosk ? 'kiosk' : 'phone') as 'kiosk' | 'phone',
      signin_device: formVisitContext().device,
    }
    // Going straight on to the Guest Pass / Agent Hub - keep the button spinning until it opens.
    let leaving = false
    try {
      setIsSubmitting(true)
      setError(null)

      let ok = false
      let passUrl: string | undefined
      try {
        const { success, data } = await api.public.submitSignIn(payload) as { success: boolean; data?: any }
        ok = !!success
        passUrl = data?.guestPassUrl || undefined
      } catch {
        ok = false
      }

      // If it didn't go through (offline / server hiccup), stash it locally instead of losing
      // it. startQueueFlusher (below) sends it the moment the connection is back.
      if (!ok) {
        enqueueSignIn(payload)
        setQueuedCount(queueCount())
      }

      // Straight on to the Guest Pass (Bright MLS plans - the sign-in hands back its signed link) or
      // the Agent Hub (No-MLS Pro, when the agent chose it) - no thank-you screen in between; both
      // pages thank the guest themselves. Not on a Kiosk tablet (it resets for the next guest), not
      // for a Similar Homes QR guest (they asked to see other homes), and not while offline (the
      // page wouldn't load) - those get the normal thank-you.
      const next = passUrl || spotlightUrl
      if (ok && !isKiosk && !wantsSimilar && next) {
        leaving = true
        setGoingTo({ kind: passUrl ? 'pass' : (afterSignin?.kind || 'hub'), url: next })
        window.location.assign(next)
        return
      }
      setSuccess(true)
    } catch (err) {
      console.error('Error submitting form:', err)
      enqueueSignIn(payload)
      setQueuedCount(queueCount())
      setSuccess(true)
    } finally {
      if (!leaving) setIsSubmitting(false)
    }
  }

  if (isKiosk && !kioskMode) {
    return (
      <div className={agentTheme === 'dark' ? 'dark' : undefined}>
      {/* justify-center (not top-anchored with a big pt-*) - this screen is only ever a couple of
          cards plus a toggle, so centering it vertically avoids a big block of dead space
          underneath on both the in-page modal (a fixed, shorter box) and a real tablet screen. */}
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] p-4 sm:p-6 transition-colors duration-300">
        <div className="w-full max-w-2xl text-center mb-6">
          <h1 className="text-2xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">Choose Sign-In Mode</h1>
          <p className="text-[#6B7280] dark:text-gray-400 font-medium">How should this device be set up?</p>
        </div>
        <div className="w-full max-w-2xl grid grid-cols-2 gap-3 sm:gap-5">
          <button
            type="button"
            onClick={() => startKiosk('interactive')}
            className="w-full bg-white dark:bg-[#151517] rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 p-5 sm:p-7 text-left active:scale-[0.98] transition-transform flex flex-col gap-3 sm:gap-4"
          >
            <div className="flex flex-1 items-center justify-center py-1">
              <KioskModePreview dark={kioskDark} />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 shrink-0 bg-[#C9A24D]/10 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.5 14.5 12 17l7-7M12 3a9 9 0 100 18 9 9 0 000-18z"></path>
                </svg>
              </div>
              <h2 className="text-base sm:text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">Sign-In Kiosk</h2>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-gray-400 leading-relaxed">
              Guests fill out the form right here on this device. Resets automatically after each guest.
            </p>
          </button>

          <button
            type="button"
            onClick={() => startKiosk('sheet')}
            className="w-full bg-white dark:bg-[#151517] rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 p-5 sm:p-7 text-left active:scale-[0.98] transition-transform flex flex-col gap-3 sm:gap-4"
          >
            <div className="flex flex-1 items-center justify-center py-1">
              <SheetModePreview dark={kioskDark} />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 shrink-0 bg-[#C9A24D]/10 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16v16H4z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4-4 3 3 5-6 4 5"></path>
                </svg>
              </div>
              <h2 className="text-base sm:text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">Sign-In Sheet</h2>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-gray-400 leading-relaxed">
              No printer needed. Rotating property photos plus a QR code guests scan on their own phone.
            </p>
          </button>
        </div>

        <div className="mt-6 flex w-full max-w-2xl justify-center">
          <KioskThemeToggle dark={kioskDark} onToggle={toggleKioskDark} variant="large" />
        </div>
      </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={kioskDark ? 'dark' : undefined}>
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] p-4 transition-colors duration-300">
        {isKiosk && kioskMode && <KioskExitHandle onExit={exitKiosk} />}
        {isKiosk && kioskMode && <KioskThemeToggle dark={kioskDark} onToggle={toggleKioskDark} />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <OhpLoader guest fullScreen={false} className="!py-0" label="Opening the home" />
          </div>
        </div>
        <ComplianceFooter />
      </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={kioskDark ? 'dark' : undefined}>
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 p-4 transition-colors duration-300">
        {isKiosk && kioskMode && <KioskExitHandle onExit={exitKiosk} />}
        {isKiosk && kioskMode && <KioskThemeToggle dark={kioskDark} onToggle={toggleKioskDark} />}
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-white dark:bg-[#151517] rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100 dark:border-gray-800">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">This link isn't working</h2>
            <p className="text-[#6B7280] dark:text-gray-400 mb-8 leading-relaxed">{error}</p>
            <div className="space-y-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-[#111827] dark:bg-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] dark:hover:text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02]"
              >
                Try Again
              </button>
              <p className="text-gray-400 dark:text-gray-500 text-xs">
                If this problem persists, please contact the property agent directly.
              </p>
            </div>
          </div>
        </div>
        <ComplianceFooter />
      </div>
      </div>
    )
  }

  if (kioskMode === 'sheet') {
    if (!property) {
      return (
        <div className={kioskDark ? 'dark' : undefined}>
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 transition-colors duration-300">
          <KioskExitHandle onExit={exitKiosk} />
          <KioskThemeToggle dark={kioskDark} onToggle={toggleKioskDark} />
          <div className="max-w-md w-full bg-white dark:bg-[#151517] rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">Property Not Found</h2>
            <p className="text-[#6B7280] dark:text-gray-400 leading-relaxed">
              This property listing may have been removed or is no longer available.
            </p>
          </div>
        </div>
        </div>
      )
    }
    return (
      <div className={kioskDark ? 'dark' : undefined}>
        <KioskExitHandle onExit={exitKiosk} />
        <KioskThemeToggle dark={kioskDark} onToggle={toggleKioskDark} />
        <SignInSheetDisplay property={property} signInUrl={`${process.env.NEXT_PUBLIC_CLIENT_URL || 'https://openhousepal.com'}/open-house/${openHouseEventId}`} />
      </div>
    )
  }

  if (!success && !property) {
    return (
      <div className={kioskDark ? 'dark' : undefined}>
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] dark:bg-[#0B0B0B] px-4 transition-colors duration-300">
        {isKiosk && kioskMode === 'interactive' && <KioskExitHandle onExit={exitKiosk} />}
        {isKiosk && kioskMode === 'interactive' && <KioskThemeToggle dark={kioskDark} onToggle={toggleKioskDark} />}
        <div className="max-w-md w-full bg-white dark:bg-[#151517] rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100 dark:border-gray-800">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1"></path>
            </svg>
          </div>
          <h2 className="text-xl font-black text-[#0B0B0B] dark:text-white mb-2 tracking-tight">Property Not Found</h2>
          <p className="text-[#6B7280] dark:text-gray-400 mb-6 leading-relaxed">
            This property listing may have been removed or is no longer available.
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-xs">
            Please check the QR code or contact the agent directly for assistance.
          </p>
        </div>
      </div>
      </div>
    )
  }

  // success and the fresh-form state below share one crossfade so the auto-reset (a guest
  // submits -> "Thank You" -> KIOSK_RESET_MS later, back to a blank form for the next guest)
  // is an actual transition instead of a hard cut. mode="wait" lets the Thank You card finish
  // fading out before the new form fades in, rather than crossing over mid-animation - reads as
  // more deliberate for a "your turn is over, next guest" handoff than a simultaneous swap would.
  return (
    <div className={kioskDark ? 'dark' : undefined}>
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col items-center justify-center p-4 transition-colors duration-300">
      {isKiosk && kioskMode === 'interactive' && <KioskExitHandle onExit={exitKiosk} />}
      {isKiosk && kioskMode === 'interactive' && <KioskThemeToggle dark={kioskDark} onToggle={toggleKioskDark} />}
      {queuedCount > 0 && (
        <div className="fixed bottom-3 left-3 z-50 rounded-lg bg-amber-500/90 px-2.5 py-1.5 text-[11px] font-black text-white shadow-lg">
          {queuedCount} sign-in{queuedCount === 1 ? '' : 's'} waiting to sync
        </div>
      )}
      <div className="flex-1 flex items-center justify-center w-full">
        <AnimatePresence mode="wait" initial={false}>
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-md w-full"
            >
              <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-8 text-center border border-gray-100 dark:border-gray-800">
                <div className="w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h2 className="text-3xl font-black text-[#0B0B0B] dark:text-white mb-3 tracking-tight">{wantsSimilar && saidHasAgent ? 'Thanks for stopping by!' : 'Thank You!'}</h2>
                <p className="text-[#6B7280] dark:text-gray-400 mb-8 leading-relaxed font-medium">
                  {wantsSimilar && saidHasAgent
                    ? `Since you're already working with an agent, ${(property as any)?.agentName || 'the host'} isn't able to help with your home search - as Realtors, we don't step in on another agent's client. Your agent can set up a search of homes just like this one for you. Best of luck finding the one!`
                    : wantsSimilar
                    ? "You're all set! Your Showcase of homes like this one is being built right now - the link is on its way to your email."
                    : goingToSpotlight
                      ? goingTo?.kind === 'pass'
                        ? `You're signed in. Opening your Guest Pass - this home's details${(property as any)?.similarHomes === false ? ', the neighborhood' : ', similar homes'} and more...`
                        : `You're signed in. Taking you to ${(property as any)?.agentName ? `${(property as any).agentName}'s` : "your host's"} page...`
                      : 'Your information has been submitted successfully.'}
                </p>

                {isKiosk && kioskMode === 'interactive' ? (
                  <div className="space-y-3">
                    <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-widest font-bold">
                      Ready for the next guest
                    </p>
                    <div className="h-1 w-full max-w-[180px] mx-auto bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        key={formInstanceKey}
                        className="h-full bg-[#C9A24D] rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: KIOSK_RESET_MS / 1000, ease: 'linear' }}
                      />
                    </div>
                  </div>
                ) : goingTo ? (
                  <div className="space-y-3">
                    <div className="h-1 w-full max-w-[180px] mx-auto bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#C9A24D] rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: SPOTLIGHT_REDIRECT_MS / 1000, ease: 'linear' }}
                      />
                    </div>
                    <a href={goingTo.url} className="inline-block text-xs font-bold text-[#C9A24D] underline underline-offset-2">
                      Open it now
                    </a>
                  </div>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 text-xs">
                    You can close this page now or continue browsing.
                  </p>
                )}
              </div>
            </motion.div>
          ) : wantsSimilar && !isKiosk && !similarStarted ? (
            <motion.div
              key="similar-intro"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full max-w-lg justify-center"
            >
              <SimilarHomesIntro property={property!} onStart={() => setSimilarStarted(true)} />
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-lg"
            >
              {/* Guaranteed non-null here: the (!success && !property) branch above already
                  returned when neither was true, so success===false means property is set. */}
              <div onPointerDownCapture={markFirstTouch} onKeyDownCapture={markFirstTouch}>
              <OpenHouseSignInForm
                key={formInstanceKey}
                property={property!}
                onSubmit={handleFormSubmit}
                isLoading={isSubmitting}
                headline={wantsSimilar ? 'Start Your Showcase' : undefined}
              />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Compliance Footer */}
      <div className="mt-12 text-center max-w-3xl mx-auto pb-4">
        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium leading-relaxed uppercase tracking-wider">
          © BRIGHT, All Rights Reserved | Information Deemed Reliable But Not Guaranteed. Some properties which appear for sale may no longer be available.
          <span className="block sm:inline ml-0 sm:ml-1"><MlsUpdatedText /></span>
        </p>
      </div>
    </div>
    </div>
  )
}
