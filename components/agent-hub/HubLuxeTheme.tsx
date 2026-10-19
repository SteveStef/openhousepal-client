'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { MapPin, Play } from 'lucide-react'
import BlogCoverArt from '@/components/BlogCoverArt'
import { sizedBg } from '@/lib/siteImage'

// OpenHousePal Luxe - the Agent Hub's second theme (IDX only; other plans can preview it). Same
// sections, links and data as Classic; Luxe re-dresses all of it in the Listing Spotlight / IDX
// language and goes further: a cinematic entry (a gold ring draws around the agent's photo, their
// name glints in, then the curtain parts on a gold seam), an ivory-and-gold page with drifting
// gold, emerald and champagne light, custom jewel-toned boxes for the lead buttons, gold-rimmed
// medallions for contact, and its own cards for listings, sales, videos and articles. Applied by
// adding `hub-luxe` to the hub's root (the public page and the editor's live preview both do).
// Everything animated stops under reduced motion.

export const HUB_THEMES = [
  { id: 'classic', label: 'Classic', blurb: 'Clean and bright - the original hub.' },
  { id: 'luxe', label: 'Luxe', blurb: 'Gold light, cinematic entry, the Spotlight look.' },
] as const
export type HubThemeId = (typeof HUB_THEMES)[number]['id']

// Profile header layouts - used on phones and desktop.
export const HUB_MOBILE_HEADERS = [
  { id: 'centered', label: 'Centered', blurb: 'Photo on top, everything centered.' },
  { id: 'split', label: 'Side by side', blurb: 'Photo beside your name and details, stats below.' },
] as const
export type HubMobileHeaderId = (typeof HUB_MOBILE_HEADERS)[number]['id']

const SPARKS: [string, string, number][] = [['8%', '14%', 0], ['32%', '6%', 1.4], ['58%', '18%', 2.9], ['82%', '10%', 0.7], ['91%', '44%', 2.2], ['18%', '52%', 3.6], ['64%', '62%', 1.9], ['40%', '84%', 3.1]]

export function HubLuxeDecor() {
  return (
    <div aria-hidden className="hub-lx-decor">
      <div className="hub-lx-grid" />
      <div className="hub-lx-aurora hub-lx-aurora-a" />
      <div className="hub-lx-aurora hub-lx-aurora-b" />
      <div className="hub-lx-aurora hub-lx-aurora-c" />
      <div className="hub-lx-aurora hub-lx-aurora-d" />
      <div className="hub-lx-aurora hub-lx-aurora-e" />
      <div className="hub-lx-silk" />
      <div className="hub-lx-beam" />
      {SPARKS.map((sp, k) => <span key={k} className="hub-lx-spark" style={{ left: sp[0], top: sp[1], animationDelay: `${sp[2]}s` }} />)}
      <svg className="hub-lx-motif" style={{ right: '4%', top: '9%', width: 150, height: 150 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth=".6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /><path d="M16 6V4h2v3.6" /></svg>
      <svg className="hub-lx-motif hub-lx-motif-b" style={{ left: '3%', top: '62%', width: 96, height: 96 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth=".7" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 6l2 2M15 8l2 2" /></svg>
      <svg className="hub-lx-motif hub-lx-motif-c" style={{ left: '44%', top: '34%', width: 120, height: 120 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth=".5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 21h20" /><path d="M4 21V10l5-4 5 4v11" /><path d="M14 21V7l4-3 4 3v14" /><path d="M7 13h4M7 17h4M17 10h2M17 14h2" /></svg>
      <div className="hub-lx-edge" />
      <svg className="hub-lx-skyline" viewBox="0 0 1440 90" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M0 88h70V60l30-24 30 24v28h52V44h40v44h50V52l38-32 38 32v36h64V36h26V16h18v20h26v52h56V60l34-28 34 28v28h50V48h46v40h56V56l42-34 42 34v32h46V40h34v48h60V60l30-24 30 24v28h70V44h40v44h50V52l38-32 38 32v36h64V36h26V16h18v20h26v52h80" /></svg>
    </div>
  )
}

export function HubLuxeStyles() {
  return <style>{CSS}</style>
}

const BURST = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2
  const r = 90 + (i % 3) * 40
  return { dx: `${Math.round(Math.cos(a) * r)}px`, dy: `${Math.round(Math.sin(a) * r)}px`, d: `${(i % 4) * 0.04}s` }
})

// The entry: midnight curtain, a gold ring drawing around the photo, the name glinting in, a
// burst of gold sparks, then the curtain parts top and bottom along a gold seam. ~2.3s, and a
// tap skips it. `contained` keeps it inside the editor's preview frame instead of the screen.
export function HubLuxeIntro({ name, kicker, photoUrl, photoPosition, contained = false, onDone }: {
  name: string; kicker?: string; photoUrl?: string; photoPosition?: { x: number; y: number }; contained?: boolean; onDone: () => void
}) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onDone(); return }
    const a = window.setTimeout(() => setLeaving(true), 1550)
    const b = window.setTimeout(onDone, 2350)
    return () => { window.clearTimeout(a); window.clearTimeout(b) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      aria-hidden
      onClick={onDone}
      className={`hub-lx-intro ${contained ? 'absolute inset-x-0 top-0 h-[min(100%,680px)]' : 'fixed inset-0'} z-[200] cursor-pointer overflow-hidden ${leaving ? 'is-leaving' : ''}`}
    >
      <div className="hub-lx-intro-half hub-lx-intro-top" />
      <div className="hub-lx-intro-half hub-lx-intro-bot" />
      <div className="hub-lx-intro-seam" />
      <div className="hub-lx-intro-center">
        <div className="relative h-[124px] w-[124px]">
          <svg viewBox="0 0 124 124" className="absolute inset-0 h-full w-full -rotate-90">
            <defs>
              <linearGradient id="hubLxRing" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--m-deep)' }} /><stop offset="45%" style={{ stopColor: 'var(--m-light)' }} /><stop offset="60%" style={{ stopColor: 'var(--m-pale)' }} /><stop offset="100%" style={{ stopColor: 'var(--m-base)' }} />
              </linearGradient>
            </defs>
            <circle cx="62" cy="62" r="59" fill="none" stroke="rgba(232,201,122,.18)" strokeWidth="1" />
            <circle className="hub-lx-intro-ring" cx="62" cy="62" r="59" fill="none" stroke="url(#hubLxRing)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} />
          </svg>
          {isHubPhotoSet(photoUrl) && <span className="hub-lx-intro-photo absolute inset-[9px] rounded-full bg-cover" style={{ backgroundImage: sizedBg(photoUrl, 384), backgroundPosition: `${photoPosition?.x ?? 50}% ${photoPosition?.y ?? 50}%` }} />}
          {BURST.map((b, k) => <span key={k} className="hub-lx-intro-burst" style={{ ['--dx' as string]: b.dx, ['--dy' as string]: b.dy, animationDelay: `calc(.95s + ${b.d})` }} />)}
        </div>
        {kicker && <p className="hub-lx-intro-kicker">{kicker}</p>}
        <p className="hub-lx-intro-name font-serif">{name}</p>
      </div>
    </div>
  )
}

// ---------- Luxe cards (the shelves) ----------
// Each is the inside of the caller's own <Link>/<a> (which keeps its href, tracking and target);
// pair it with the matching wrapper class.

export const LUXE_HOME_CARD = 'hub-lx-card group/lx relative block h-[178px] w-[204px] shrink-0 snap-start overflow-hidden rounded-[20px] p-[1.5px] lg:h-[198px] lg:w-[222px]'
export function LuxeHomeCardBody({ image, price, location, status, statusClass, cta, badge }: { image?: string; price: string; location: string; status: string; statusClass: string; cta?: string; badge?: React.ReactNode }) {
  const sold = status.toLowerCase() === 'sold'
  return (
    <>
      <span aria-hidden className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-[var(--m-cream)] via-[rgba(var(--m-rgb),0.45)] to-[var(--m-deep)]" />
      <span className="relative block h-full w-full overflow-hidden rounded-[18.5px] bg-[#111827]">
        <span className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.4s] ease-out group-hover/lx:scale-110" style={{ backgroundImage: sizedBg(image || '/placeholder.jpg', 640) }} />
        <span className="absolute inset-0 bg-gradient-to-t from-[#0b0f0e] via-[#0b0f0e]/20 to-black/10" />
        <span aria-hidden className="hub-lx-sweep absolute inset-y-0 left-0 w-1/3" />
        {/* status with the open house (badge) right beside it - never stacked on the price */}
        <span className="absolute left-2.5 right-2.5 top-2.5 flex items-center gap-1">
          <span className={`inline-flex shrink-0 items-center font-black uppercase ${sold ? 'hub-lx-sold rounded-[9px] px-3 py-1.5 text-[10px]' : `rounded-full px-2 py-0.5 text-[9px] shadow ${statusClass}`}`}>{sold && <span className="hub-lx-sold-dot" />}<span className="relative">{status}</span></span>
          {badge && <span className="flex min-w-0">{badge}</span>}
        </span>
        <span className="absolute inset-x-0 bottom-0 p-3 text-left">
          <span className="block h-px w-8 bg-gradient-to-r from-[var(--m-light)] to-transparent" />
          <span className="hub-lx-price mt-1.5 block text-[22px] leading-none">{price}</span>
          <span className="mt-1 block truncate text-[11px] font-bold text-white/80">{location}</span>
          {cta && <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--m-light)] transition-transform duration-300 group-hover/lx:translate-x-0.5">{cta} &rarr;</span>}
        </span>
      </span>
    </>
  )
}

// The big card for the full Sales / Listings pages on Luxe: photo in a metal frame, serif address,
// the white-glint price, the Luxe status badge, staggered entry, lift + light sweep on hover.
export function LuxeGridHomeCard({ image, price, address, location, status, statusClass, date, index = 0, href, badge, below }: {
  image?: string; price: string; address: string; location: string; status: string; statusClass: string; date?: string; index?: number; href?: string; badge?: React.ReactNode
  /** Under the town (e.g. the listing's open house times). */
  below?: React.ReactNode
}) {
  const sold = status.toLowerCase() === 'sold'
  const Tag = href ? 'a' : 'article'
  return (
    <Tag {...(href ? { href } : {})} className="hub-lx-card hub-lx-gcard group/lx relative block overflow-hidden rounded-[22px] p-[1.5px]" style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}>
      <span aria-hidden className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-[var(--m-cream)] via-[rgba(var(--m-rgb),0.45)] to-[var(--m-deep)]" />
      <span className="relative block overflow-hidden rounded-[20.5px] bg-[#111827]">
        <span className="relative block aspect-[4/3] overflow-hidden">
          <span className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.4s] ease-out group-hover/lx:scale-110" style={{ backgroundImage: sizedBg(image || '/placeholder.jpg', 640) }} />
          <span className="absolute inset-0 bg-gradient-to-t from-[#0b0f0e] via-[#0b0f0e]/25 to-black/5" />
          <span aria-hidden className="hub-lx-sweep absolute inset-y-0 left-0 w-1/3" />
          <span className={`absolute left-3 top-3 font-black uppercase ${sold ? 'hub-lx-sold rounded-[10px] px-3.5 py-2 text-[11px]' : `rounded-full px-2.5 py-1 text-[10px] shadow ${statusClass}`}`}>{sold && <span className="hub-lx-sold-dot" />}<span className="relative">{status}</span></span>
          <span className="absolute inset-x-0 bottom-0 p-4">
            {badge && <span className="mb-2 flex">{badge}</span>}
            <span className="block h-px w-10 bg-gradient-to-r from-[var(--m-light)] to-transparent" />
            <span className="hub-lx-price mt-2 block text-[28px] leading-none">{price}</span>
          </span>
        </span>
        <span className="block px-4 pb-4 pt-3">
          <span className="block truncate font-serif text-lg font-black text-white">{address}</span>
          <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-white/65"><MapPin className="h-3.5 w-3.5 text-[var(--m-light)]" /> {location}</span>
          {below}
          {date && <span className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--m-light)]"><span>{date}</span><span className="text-white/45">{status}</span></span>}
        </span>
      </span>
    </Tag>
  )
}

/** The class that applies a Luxe finish (gold is the default, no class needed). */
export const hubLuxeMetalClass = (metal?: string) => metal === 'silver' ? 'hub-lx-m-silver' : metal === 'bronze' ? 'hub-lx-m-bronze' : ''

export const LUXE_VIDEO_CARD = 'hub-lx-card group/lx block w-[212px] shrink-0 snap-start text-left lg:w-[236px]'
export function LuxeVideoCardBody({ thumb, title, kicker }: { thumb: string; title: string; kicker: string }) {
  return (
    <>
      <span className="hub-lx-frame relative block aspect-video overflow-hidden rounded-[16px] p-[1.5px]">
        <span aria-hidden className="absolute inset-0 rounded-[16px] bg-gradient-to-br from-[var(--m-cream)] via-[rgba(var(--m-rgb),0.4)] to-[var(--m-deep)]" />
        <span className="relative block h-full w-full overflow-hidden rounded-[14.5px] bg-[#111827]">
          <span className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.2s] ease-out group-hover/lx:scale-110" style={{ backgroundImage: sizedBg(thumb || '/placeholder.jpg', 640) }} />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
          <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
            <span aria-hidden className="hub-lx-pulse absolute inset-0 rounded-full border border-[var(--m-light)]" />
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--m-cream)] via-[var(--m-base)] to-[var(--m-deep)] shadow-[0_0_22px_rgba(var(--m-rgb),.7)] transition-transform duration-300 group-hover/lx:scale-110">
              <Play className="ml-0.5 h-4 w-4 fill-[#111827] text-[#111827]" />
            </span>
          </span>
        </span>
      </span>
      <span className="mt-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-[var(--m-mid)] dark:text-[var(--m-light)]"><span className="h-px w-4 bg-[var(--m-base)]" />{kicker}</span>
      <span className="mt-0.5 line-clamp-2 block font-serif text-[15px] font-black leading-[1.15] text-[#111827] dark:text-white">{title}</span>
    </>
  )
}

// An article as a cover: the photo fills the card, the title is set on it in serif over a deep
// gradient, the category sits top-left as a metal-edged chip, and the metal frame runs around it.
export const LUXE_BLOG_CARD = 'hub-lx-card group/lx relative block h-[232px] w-[222px] shrink-0 snap-start overflow-hidden rounded-[20px] p-[1.5px] text-left lg:h-[248px] lg:w-[244px]'
export function LuxeBlogCardBody({ image, category, title }: { image?: string; category: string; title: string }) {
  return (
    <>
      <span aria-hidden className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-[var(--m-cream)] via-[rgba(var(--m-rgb),0.45)] to-[var(--m-deep)]" />
      <span className="relative block h-full w-full overflow-hidden rounded-[18.5px] bg-[#0f1420]">
        {image ? <span className="absolute inset-0 bg-cover bg-center transition-transform duration-[1.6s] ease-out group-hover/lx:scale-[1.07]" style={{ backgroundImage: sizedBg(image, 640) }} /> : <span className="absolute inset-0 block"><BlogCoverArt category={category} title={title} showWord={false} /></span>}
        <span className="absolute inset-0 bg-gradient-to-t from-[#070a0f] via-[#070a0f]/55 to-black/10" />
        <span aria-hidden className="hub-lx-sweep absolute inset-y-0 left-0 w-1/3" />
        <span className="absolute left-3 top-3 rounded-full border border-[rgba(var(--m-light-rgb),0.55)] bg-black/35 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--m-cream)] ">{category}</span>
        <span className="absolute inset-x-0 bottom-0 p-4">
          <span className="block h-px w-9 bg-gradient-to-r from-[var(--m-light)] to-transparent" />
          <span className="mt-2.5 line-clamp-3 block font-serif text-[17px] font-black leading-[1.18] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.4)]">{title}</span>
          <span className="mt-2.5 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.24em] text-[var(--m-light)] transition-transform duration-300 group-hover/lx:translate-x-1">Read the story <span aria-hidden>&rarr;</span></span>
        </span>
      </span>
    </>
  )
}

// ---------- Side-by-side mobile header ----------
// One rectangle, like the signature card: the photo on the left, brokerage, name, title and
// service area beside it, the sales stats as a ruled row underneath (and without stats it's simply
// the top part). The photo is kept small so the text, not the photo, sets the row's height.
// Agent headshot for the hub card/header - the agent's initials on a soft gold disc when no
// photo is set ('/home.jpg' was the editor's old placeholder and is treated as no photo).
export const isHubPhotoSet = (url?: string | null) => !!url && url.trim() !== '' && url.trim() !== '/home.jpg'
export function HubAgentPhoto({ url, position, name, className = '' }: { url?: string | null; position?: { x: number; y: number }; name?: string; className?: string }) {
  if (isHubPhotoSet(url)) return <div className={`h-full w-full bg-cover ${className}`} style={{ backgroundImage: sizedBg(url, 384), backgroundPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%` }} />
  const initials = (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
  return <div className={`flex h-full w-full items-center justify-center bg-[#f3ead8] font-serif text-[28px] font-black text-[#8b7355] dark:bg-[#1f1b14] dark:text-[#d7b974] ${className}`}>{initials}</div>
}

export function HubSplitHeader({ profile, photoUrl, photoPosition, stats, className = '', large = false, rating, reviewAction, photoBadge }: {
  profile: { name: string; title: string; brokerage: string; market: string }
  photoUrl: string
  photoPosition?: { x: number; y: number }
  stats?: [string, string][] | null
  className?: string
  /** Desktop sidebar (360px) - a touch bigger photo and name. Phones stay as before. */
  large?: boolean
  /** Star-rating chip, on the brokerage line's right end. */
  rating?: ReactNode
  /** "Review" button, on the title line's right end. Both are pulled up (-my) so the card never grows. */
  reviewAction?: ReactNode
  /** Star rating + review pencil, right under the photo (the photo sits a little higher to make room). */
  photoBadge?: ReactNode
}) {
  const lg = (cls: string) => (large ? cls : '')
  return (
    <div className={`hub-split relative overflow-hidden rounded-[28px] border border-gray-200 bg-[#fbfaf7] text-left shadow-sm dark:border-gray-800 dark:bg-[#151517] ${className}`}>
      <div className={`flex items-center gap-3.5 p-4 ${lg('lg:gap-4 lg:p-5')}`}>
        <div className={`flex shrink-0 flex-col items-center ${photoBadge ? '-mt-1 self-start' : ''}`}>
          <div className={`hub-split-photo relative h-[96px] w-[86px] ${lg('lg:h-[124px] lg:w-[108px]')} shrink-0 overflow-hidden rounded-[18px] border-2 border-[#cdaa64] bg-white p-[3px] shadow-sm dark:bg-[#0B0B0B]`}>
            <HubAgentPhoto url={photoUrl} position={photoPosition} name={profile.name} className="rounded-[14px]" />
          </div>
          {photoBadge && <div className="relative z-[1] -mb-1 mt-2 flex justify-center">{photoBadge}</div>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {(profile.brokerage || rating) && (
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#d7b974]">{profile.brokerage}</p>
              {rating && <span className="-my-1.5 flex shrink-0">{rating}</span>}
            </div>
          )}
          <h1 className={`hub-name mt-1 font-serif text-[26px] ${lg('lg:text-[30px]')} font-black leading-[1.02] tracking-tight text-[#111827] dark:text-white`}>{profile.name}</h1>
          {(profile.title || reviewAction) && (
            <div className="mt-1.5 flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#d7b974]">{profile.title}</p>
              {reviewAction && <span className="-my-1.5 flex shrink-0">{reviewAction}</span>}
            </div>
          )}
          {profile.market && <p className="mt-1.5 flex items-start gap-1 text-[12.5px] font-semibold leading-snug text-[#778093] dark:text-gray-300"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d0ad65]" /> <span className="min-w-0">{profile.market}</span></p>}
        </div>
      </div>
      {stats && stats.length > 0 && (
        <div className="hub-split-stats grid border-t border-[#d8c08a]/40 dark:border-white/10" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map(([label, value], i) => (
            <div key={label} className={`min-w-0 px-2 py-2.5 text-center ${i ? 'border-l border-[#d8c08a]/40 dark:border-white/10' : ''}`}>
              <p className="truncate font-serif text-[17px] font-black leading-none text-[#111827] dark:text-white">{value}</p>
              <p className="mt-1 truncate text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7355] dark:text-[#d7b974]">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CSS = `

/* Luxe finish - gold (default), silver or bronze. Every gold tone below reads these. */
.hub-luxe, .hub-lx-metal { --m-base:#C9A24D; --m-light:#e8c97a; --m-deep:#8b6a2b; --m-mid:#a8803a; --m-pale:#fff3cf; --m-cream:#f3dfa8; --m-rgb:201,162,77; --m-light-rgb:232,201,122; --m-deep-rgb:139,106,43; --m-pale-rgb:255,243,207;
  --m-wash0:#fbf6ec; --m-wash1:#fbf3df; --m-wash2:#f6e7c4; --m-wash3:#f4ead7; --m-night:#2a2218; --m-night2:#1d1810; --m-night3:#17150f;
  --j1-rgb:18,112,88; --j2-rgb:44,74,150; --j3-rgb:172,78,98; --m-ink0:#07110e; --m-ink1:#0d1626; }
.hub-lx-m-silver { --m-base:#A9AFB7; --m-light:#e3e7ec; --m-deep:#6b717a; --m-mid:#8c939c; --m-pale:#ffffff; --m-cream:#eef1f4; --m-rgb:169,175,183; --m-light-rgb:227,231,236; --m-deep-rgb:107,113,122; --m-pale-rgb:255,255,255;
  --m-wash0:#f6f7f8; --m-wash1:#f1f3f5; --m-wash2:#e6e9ed; --m-wash3:#e9ecef; --m-night:#1e2228; --m-night2:#1a1d22; --m-night3:#15181c;
  --j1-rgb:62,104,178; --j2-rgb:122,98,186; --j3-rgb:70,150,168; --m-ink0:#080b14; --m-ink1:#121428; }
.hub-lx-m-bronze { --m-base:#A9714B; --m-light:#dba47c; --m-deep:#6e4426; --m-mid:#8c5a37; --m-pale:#f6d9c2; --m-cream:#f0cdb3; --m-rgb:169,113,75; --m-light-rgb:219,164,124; --m-deep-rgb:110,68,38; --m-pale-rgb:246,217,194;
  --m-wash0:#fbf3ec; --m-wash1:#f7e8dc; --m-wash2:#f0dccb; --m-wash3:#f2e1d3; --m-night:#2a1c14; --m-night2:#20150e; --m-night3:#1a120c;
  --j1-rgb:22,118,116; --j2-rgb:122,62,104; --j3-rgb:196,104,76; --m-ink0:#071010; --m-ink1:#1a1020; }

/* Real-estate motifs drifting in the background (house, key, a line of rooftops that draws itself). */
.hub-lx-motif { position: absolute; color: rgba(var(--m-rgb),.12); animation: hubLxFloat 14s ease-in-out infinite alternate; }
.dark .hub-lx-motif { color: rgba(var(--m-light-rgb),.07); }
.hub-lx-motif-b { animation-duration: 18s; animation-direction: alternate-reverse; }
.hub-lx-motif-c { animation-duration: 22s; }
@keyframes hubLxFloat { from { transform: translateY(0) rotate(-5deg); } to { transform: translateY(-18px) rotate(3deg); } }
.hub-lx-skyline { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 90px; color: rgba(var(--m-rgb),.16); -webkit-mask-image: linear-gradient(180deg, #000 62%, transparent 97%); mask-image: linear-gradient(180deg, #000 62%, transparent 97%); }
/* iPhone (user, 10/18): pulling past the top or the footer showed a hard line - the glows, grid and
   gradient were still changing colour right at the page's edges, so no single colour past them could
   match. The page now settles into one solid colour (--hub-edge) at its very top and bottom, and
   ThemeColorSync paints the area past the edges (html, body, browser bar) in that same colour. */
.hub-luxe { --hub-edge: var(--m-wash1); }
.dark .hub-luxe { --hub-edge: var(--m-ink1); }
.hub-lx-edge { position: absolute; inset: 0; background: linear-gradient(180deg, var(--hub-edge) 0, transparent 150px), linear-gradient(0deg, var(--hub-edge) 0, var(--hub-edge) 24px, transparent 230px); }
.dark .hub-lx-skyline { color: rgba(var(--m-light-rgb),.09); }
.hub-lx-skyline path { stroke-dasharray: 3200; stroke-dashoffset: 3200; animation: hubLxDraw 6s 1.2s ease-out forwards; }
@keyframes hubLxDraw { to { stroke-dashoffset: 0; } }

/* Prices: white (ink on ivory) with a metal glint passing through - a proper serif weight (it read
   thin at 500 next to the bold sans around it). */
.hub-lx-price { font-family: ui-serif, Georgia, serif; font-weight: 700; letter-spacing: -.012em; line-height: 1.12 !important; padding-bottom: .06em; margin-bottom: -.06em; background-image: linear-gradient(100deg, #fff 0%, #fff 38%, var(--m-light) 47%, var(--m-pale) 50%, var(--m-light) 53%, #fff 62%, #fff 100%); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: 0 2px 14px rgba(0,0,0,.25); animation: hubLxPriceGlint 5.5s ease-in-out infinite; }
@keyframes hubLxPriceGlint { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0 0; } }

/* (The Sold tablet itself now lives in app/globals.css so Classic hubs get the same red.)
   Status badges on Luxe: Sold = a matte red tablet (rounded rectangle, no gloss) that fades in,
   a soft shimmer passing through it now and then, a thin light edge, and a breathing white dot.
   No texture and no scaling (both made the small text read blurry). Others keep their color. */
.hub-lx-card:hover .hub-lx-sold { transform: translateY(-1px); box-shadow: inset 0 0 0 1px rgba(255,255,255,.22), inset 0 -6px 12px rgba(0,0,0,.16), 0 14px 26px -10px rgba(110,20,20,.95) !important; }

/* Alive on hover - socials, contact medallions and every lead button respond, like the signature card. */
.hub-luxe [class*="rounded-xl"][class*="border-gray-200"][class*="shrink-0"] { transition: transform .3s cubic-bezier(.22,.61,.36,1), box-shadow .3s, border-color .3s; }
.hub-luxe [class*="rounded-xl"][class*="border-gray-200"][class*="shrink-0"]:hover { transform: translateY(-3px) scale(1.12); border-color: var(--m-base) !important; box-shadow: 0 10px 22px -8px rgba(var(--m-deep-rgb),.7), 0 0 0 3px rgba(var(--m-rgb),.15) !important; }
.hub-luxe [class*="grid-cols-3"] > [class*="rounded-2xl"] { transition: transform .3s cubic-bezier(.22,.61,.36,1); }
.hub-luxe [class*="grid-cols-3"] > [class*="rounded-2xl"]:hover { transform: translateY(-3px); }

/* Luxe grid cards (full Sales / Listings pages) */
.hub-lx-gcard { animation: hubLxCardIn .7s cubic-bezier(.22,.61,.36,1) both; }
@keyframes hubLxCardIn { from { opacity: 0; transform: translateY(18px) scale(.97); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
.hub-luxe .hub-lx-panel { position: relative; overflow: hidden; background: radial-gradient(110% 130% at 100% 0%, rgba(var(--m-rgb),.24), transparent 55%), linear-gradient(135deg, #fffdf8 0%, var(--m-wash0) 55%, var(--m-wash3) 100%) !important; border-color: rgba(var(--m-rgb),.45) !important; box-shadow: 0 30px 60px -40px rgba(var(--m-deep-rgb),.8), inset 0 1px 0 rgba(255,255,255,.8) !important; }
.dark .hub-luxe .hub-lx-panel { background: radial-gradient(120% 140% at 100% 0%, rgba(var(--m-rgb),.22), transparent 55%), linear-gradient(135deg, #0b0f0e 0%, #111827 55%, var(--m-night2) 100%) !important; border-color: rgba(var(--m-light-rgb),.24) !important; }
.hub-luxe .hub-lx-panel::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1.5px; background: linear-gradient(90deg, transparent 20%, var(--m-light) 50%, transparent 80%); background-size: 200% 100%; animation: hubLxEdge 7s ease-in-out infinite; }
/* The page: ivory silk lit by the agent's metal, with three jewel tones that suit it washing
   through (gold: emerald, sapphire, garnet; silver: sapphire, amethyst, ice; bronze: teal, plum,
   terracotta). Dark mode is the same light on a deep jewel night instead of flat black. */
.hub-luxe { background:
  radial-gradient(60% 42% at 100% 0%, rgba(var(--m-rgb),.42), transparent 70%),
  radial-gradient(55% 38% at 0% 30%, rgba(var(--j1-rgb),.24), transparent 72%),
  radial-gradient(50% 36% at 100% 62%, rgba(var(--j2-rgb),.19), transparent 72%),
  radial-gradient(60% 34% at 15% 100%, rgba(var(--j3-rgb),.18), transparent 72%),
  radial-gradient(40% 30% at 55% 45%, rgba(var(--m-light-rgb),.18), transparent 70%),
  linear-gradient(160deg, #fffdf8 0%, var(--m-wash1) 42%, var(--m-wash2) 100%) var(--m-wash1) !important; }
.dark .hub-luxe { background:
  radial-gradient(60% 42% at 100% 0%, rgba(var(--m-rgb),.26), transparent 70%),
  radial-gradient(55% 40% at 0% 30%, rgba(var(--j1-rgb),.30), transparent 72%),
  radial-gradient(50% 36% at 100% 62%, rgba(var(--j2-rgb),.26), transparent 72%),
  radial-gradient(60% 34% at 15% 100%, rgba(var(--j3-rgb),.20), transparent 72%),
  linear-gradient(160deg, var(--m-ink0) 0%, var(--m-ink1) 55%, var(--m-night2) 100%) var(--m-ink1) !important; }
.hub-luxe > *:not(.hub-lx-decor):not(.hub-lx-intro) { position: relative; z-index: 1; }
.hub-lx-decor { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 0; border-radius: inherit; }
.hub-lx-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(var(--m-deep-rgb),.08) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--m-deep-rgb),.08) 1px, transparent 1px); background-size: 40px 40px; -webkit-mask-image: radial-gradient(70% 55% at 80% 0%, #000, transparent 75%); mask-image: radial-gradient(70% 55% at 80% 0%, #000, transparent 75%); }
.dark .hub-lx-grid { background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); }
.hub-lx-aurora { position: absolute; border-radius: 999px; filter: blur(64px); }
.hub-lx-aurora-a { left: -80px; top: 280px; width: 380px; height: 380px; background: rgba(var(--m-rgb),.26); animation: hubLxDriftA 18s ease-in-out infinite alternate; }
.hub-lx-aurora-b { right: -60px; top: -100px; width: 480px; height: 320px; background: rgba(var(--m-light-rgb),.42); animation: hubLxDriftB 22s ease-in-out infinite alternate; }
.hub-lx-aurora-c { left: 30%; top: 55%; width: 420px; height: 300px; background: rgba(var(--j1-rgb),.24); animation: hubLxDriftA 26s ease-in-out -6s infinite alternate-reverse; }
.hub-lx-aurora-d { right: 8%; top: 32%; width: 340px; height: 280px; background: rgba(var(--j2-rgb),.20); animation: hubLxDriftB 24s ease-in-out -4s infinite alternate; }
.hub-lx-aurora-e { left: 4%; top: 12%; width: 300px; height: 240px; background: rgba(var(--j3-rgb),.18); animation: hubLxDriftA 30s ease-in-out -12s infinite alternate; }
.dark .hub-lx-aurora-a { background: rgba(var(--m-rgb),.22); }
.dark .hub-lx-aurora-b { background: rgba(var(--m-deep-rgb),.30); }
.dark .hub-lx-aurora-c { background: rgba(var(--j1-rgb),.30); }
.dark .hub-lx-aurora-d { background: rgba(var(--j2-rgb),.28); }
.dark .hub-lx-aurora-e { background: rgba(var(--j3-rgb),.20); }
/* a slow satin sheen folding across the page */
.hub-lx-silk { position: absolute; inset: -20%; background: conic-gradient(from 210deg at 70% 30%, transparent 0deg, rgba(var(--m-pale-rgb),.30) 40deg, transparent 90deg, rgba(var(--j1-rgb),.06) 170deg, transparent 230deg, rgba(var(--m-light-rgb),.18) 300deg, transparent 360deg); filter: blur(30px); animation: hubLxSilk 40s ease-in-out infinite alternate; }
.dark .hub-lx-silk { background: conic-gradient(from 210deg at 70% 30%, transparent 0deg, rgba(var(--m-light-rgb),.08) 40deg, transparent 90deg, rgba(var(--j2-rgb),.10) 170deg, transparent 230deg, rgba(var(--m-rgb),.08) 300deg, transparent 360deg); }
@keyframes hubLxSilk { from { transform: rotate(-4deg) scale(1); } to { transform: rotate(6deg) scale(1.08); } }
.hub-lx-beam { position: absolute; top: -20%; left: -30%; width: 40%; height: 140%; background: linear-gradient(100deg, transparent, rgba(var(--m-pale-rgb),.28), transparent); transform: rotate(12deg) translateX(-60%); animation: hubLxBeam 14s ease-in-out 2.6s infinite; }
.dark .hub-lx-beam { background: linear-gradient(100deg, transparent, rgba(var(--m-light-rgb),.07), transparent); }
@keyframes hubLxBeam { 0% { transform: rotate(12deg) translateX(-60%); } 45%, 100% { transform: rotate(12deg) translateX(420%); } }
@keyframes hubLxDriftA { from { transform: translate(0,0) scale(1); } to { transform: translate(90px,-50px) scale(1.15); } }
@keyframes hubLxDriftB { from { transform: translate(0,0) scale(1); } to { transform: translate(-120px,40px) scale(.9); } }
.hub-lx-spark { position: absolute; width: 3px; height: 3px; border-radius: 999px; background: var(--m-light); box-shadow: 0 0 8px 2px rgba(var(--m-light-rgb),.65); opacity: 0; animation: hubLxSpark 5.5s ease-in-out infinite; }
@keyframes hubLxSpark { 0%,100% { opacity: 0; transform: scale(.4) translateY(0); } 45% { opacity: .9; transform: scale(1) translateY(-10px); } 60% { opacity: 0; transform: scale(.6) translateY(-16px); } }

/* ---- Entry ---- */
.hub-lx-intro-half { position: absolute; left: 0; right: 0; height: 50.5%; background: radial-gradient(90% 120% at 50% 100%, rgba(var(--m-rgb),.28), transparent 60%), linear-gradient(180deg, #0b0f0e, #111827 70%, var(--m-night2)); transition: transform .8s cubic-bezier(.76,0,.24,1); }
.hub-lx-intro-top { top: 0; }
.hub-lx-intro-bot { bottom: 0; transform-origin: bottom; background: radial-gradient(90% 120% at 50% 0%, rgba(var(--m-rgb),.28), transparent 60%), linear-gradient(0deg, #0b0f0e, #111827 70%, var(--m-night2)); }
.hub-lx-intro.is-leaving .hub-lx-intro-top { transform: translateY(-101%); }
.hub-lx-intro.is-leaving .hub-lx-intro-bot { transform: translateY(101%); }
.hub-lx-intro-seam { position: absolute; left: 50%; top: 50%; width: 70%; height: 1.5px; margin-top: -.75px; background: linear-gradient(90deg, transparent, var(--m-light), var(--m-pale), var(--m-light), transparent); box-shadow: 0 0 18px 2px rgba(var(--m-light-rgb),.7); transform: translateX(-50%) scaleX(0); opacity: 0; transition: transform .5s cubic-bezier(.65,0,.35,1), opacity .5s; }
.hub-lx-intro.is-leaving .hub-lx-intro-seam { transform: translateX(-50%) scaleX(1.5); opacity: 0; transition: transform .7s cubic-bezier(.65,0,.35,1), opacity .7s .2s; }
.hub-lx-intro:not(.is-leaving) .hub-lx-intro-seam { animation: hubLxSeam .5s 1.15s forwards; }
@keyframes hubLxSeam { to { transform: translateX(-50%) scaleX(1); opacity: 1; } }
.hub-lx-intro-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 24px; text-align: center; transition: opacity .35s, transform .6s cubic-bezier(.65,0,.35,1); }
.hub-lx-intro.is-leaving .hub-lx-intro-center { opacity: 0; transform: scale(1.06); }
.hub-lx-intro-ring { stroke-dasharray: 1; stroke-dashoffset: 1; animation: hubLxRing 1.1s .1s cubic-bezier(.65,0,.35,1) forwards; filter: drop-shadow(0 0 6px rgba(var(--m-light-rgb),.7)); }
@keyframes hubLxRing { to { stroke-dashoffset: 0; } }
.hub-lx-intro-photo { opacity: 0; transform: scale(.85); animation: hubLxPhoto .8s .35s cubic-bezier(.22,.61,.36,1) forwards; }
@keyframes hubLxPhoto { to { opacity: 1; transform: none; } }
.hub-lx-intro-burst { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 999px; background: radial-gradient(circle, var(--m-pale), var(--m-base) 60%, transparent 70%); box-shadow: 0 0 10px 2px rgba(var(--m-light-rgb),.75); opacity: 0; animation: hubLxBurst .9s cubic-bezier(.16,1,.3,1) forwards; }
@keyframes hubLxBurst { 0% { opacity: 0; transform: translate(0,0) scale(.4); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1); } }
.hub-lx-intro-kicker { margin-top: 22px; font-size: 10px; font-weight: 900; letter-spacing: .34em; text-transform: uppercase; color: var(--m-light); opacity: 0; animation: hubLxRise .7s .55s cubic-bezier(.22,.61,.36,1) forwards; }
.hub-lx-intro-name { margin-top: 8px; font-size: clamp(28px, 7vw, 46px); font-weight: 900; line-height: 1.05; letter-spacing: -.01em; background-image: linear-gradient(100deg, #fff 0%, #fff 40%, var(--m-light) 48%, var(--m-pale) 52%, var(--m-light) 56%, #fff 64%, #fff 100%); background-size: 260% 100%; background-position: 100% 0; -webkit-background-clip: text; background-clip: text; color: transparent; opacity: 0; animation: hubLxRise .8s .7s cubic-bezier(.22,.61,.36,1) forwards, hubLxNameGlint 1.4s .9s ease-in-out forwards; }
@keyframes hubLxRise { from { opacity: 0; transform: translateY(14px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes hubLxNameGlint { to { background-position: 0% 0; } }
.hub-luxe.hub-lx-intro-on .hub-enter { animation: none !important; opacity: 0; }
.hub-luxe .hub-enter { animation-name: hubLxEnter; animation-duration: 1.15s; }
@keyframes hubLxEnter { from { opacity: 0; transform: translateY(26px) scale(.97); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }

/* ---- Profile card ---- */
.hub-luxe [class*="rounded-[28px]"][class*="bg-[#fbfaf7]"] { position: relative; overflow: hidden; background: radial-gradient(110% 130% at 100% 0%, rgba(var(--m-rgb),.24), transparent 55%), radial-gradient(80% 80% at 0% 100%, rgba(var(--j1-rgb),.08), transparent 60%), radial-gradient(70% 70% at 100% 100%, rgba(var(--j3-rgb),.06), transparent 60%), linear-gradient(135deg, #fffdf8 0%, var(--m-wash0) 55%, var(--m-wash3) 100%) !important; border-color: rgba(var(--m-rgb),.45) !important; box-shadow: 0 30px 60px -40px rgba(var(--m-deep-rgb),.8), inset 0 1px 0 rgba(255,255,255,.8) !important; }
.dark .hub-luxe [class*="rounded-[28px]"][class*="bg-[#fbfaf7]"] { background: radial-gradient(120% 140% at 100% 0%, rgba(var(--m-rgb),.22), transparent 55%), radial-gradient(90% 90% at 0% 100%, rgba(var(--j1-rgb),.18), transparent 60%), linear-gradient(135deg, var(--m-ink0) 0%, var(--m-ink1) 55%, var(--m-night2) 100%) !important; border-color: rgba(var(--m-light-rgb),.24) !important; }
.hub-luxe [class*="rounded-[28px]"][class*="bg-[#fbfaf7]"]::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1.5px; background: linear-gradient(90deg, transparent 20%, var(--m-light) 50%, transparent 80%); background-size: 200% 100%; animation: hubLxEdge 7s ease-in-out infinite; z-index: 2; }
.hub-luxe [class*="rounded-[28px]"][class*="bg-[#fbfaf7]"]::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 40%, rgba(255,255,255,.45) 50%, transparent 60%); transform: translateX(-100%); animation: hubLxCardShine 9s ease-in-out 3s infinite; pointer-events: none; }
.dark .hub-luxe [class*="rounded-[28px]"][class*="bg-[#fbfaf7]"]::after { background: linear-gradient(110deg, transparent 40%, rgba(var(--m-light-rgb),.10) 50%, transparent 60%); }
@keyframes hubLxCardShine { 0%, 70% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
@keyframes hubLxEdge { 0% { background-position: 150% 0; } 100% { background-position: -50% 0; } }
/* the photo: a slowly turning gold ring */
.hub-luxe [class*="rounded-full"][class*="border-[#cdaa64]"] { position: relative; border-color: transparent !important; background: conic-gradient(from var(--hub-lx-a, 0deg), var(--m-deep), var(--m-light), var(--m-pale), var(--m-base), var(--m-deep), var(--m-light), var(--m-deep)) !important; box-shadow: 0 0 0 4px rgba(var(--m-rgb),.14), 0 14px 30px -14px rgba(var(--m-deep-rgb),.8) !important; animation: hubLxSpin 8s linear infinite; }
.hub-luxe .hub-split-photo { border-color: transparent !important; background: conic-gradient(from var(--hub-lx-a, 0deg), var(--m-deep), var(--m-light), var(--m-pale), var(--m-base), var(--m-deep), var(--m-light), var(--m-deep)) !important; box-shadow: 0 14px 30px -14px rgba(var(--m-deep-rgb),.8) !important; animation: hubLxSpin 8s linear infinite; }
@property --hub-lx-a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes hubLxSpin { to { --hub-lx-a: 360deg; } }
/* brokerage chip */
.hub-luxe [class*="-mt-5"][class*="inline-flex"][class*="rounded-full"] { background: linear-gradient(135deg, #111827, var(--m-night)) !important; color: var(--m-cream) !important; border-color: rgba(var(--m-rgb),.6) !important; box-shadow: 0 8px 18px -10px rgba(17,24,39,.8) !important; position: relative; z-index: 2; }

/* The agent's name - serif, with a slow gold glint passing through it. */
.hub-luxe .font-serif[class*="text-[30px]"], .hub-luxe .hub-name { background-image: linear-gradient(100deg, #111827 0%, #111827 40%, var(--m-mid) 50%, var(--m-light) 55%, var(--m-mid) 60%, #111827 70%, #111827 100%); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent !important; animation: hubLxGlint 6s ease-in-out infinite; }
.dark .hub-luxe .font-serif[class*="text-[30px]"], .dark .hub-luxe .hub-name { background-image: linear-gradient(100deg, #fff 0%, #fff 40%, var(--m-base) 50%, var(--m-pale) 55%, var(--m-base) 60%, #fff 70%, #fff 100%); }
@keyframes hubLxGlint { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0% 0; } }

/* Stats - gold-edged tiles with serif numbers */
.hub-luxe [class*="grid-cols-3"] > [class*="rounded-2xl"][class*="border-gray-200"] { background: linear-gradient(160deg, #fffdf8, var(--m-wash1)) !important; border-color: rgba(var(--m-rgb),.4) !important; box-shadow: 0 10px 20px -16px rgba(var(--m-deep-rgb),.8) !important; }
.dark .hub-luxe [class*="grid-cols-3"] > [class*="rounded-2xl"][class*="border-gray-200"] { background: linear-gradient(160deg, var(--m-night3), var(--m-night)) !important; border-color: rgba(var(--m-light-rgb),.25) !important; }
.hub-luxe [class*="grid-cols-3"] > [class*="rounded-2xl"] > p:last-child { font-family: ui-serif, Georgia, serif; font-size: 16px; }
.hub-luxe .hub-split-stats { background: linear-gradient(90deg, rgba(var(--m-rgb),.08), rgba(var(--m-rgb),.16), rgba(var(--m-rgb),.08)); border-color: rgba(var(--m-rgb),.4) !important; }

/* Section headings - a gold rule instead of the side bar; "View all" becomes a gold pill. */
.hub-luxe h2[class*="border-l-4"], .hub-luxe h3[class*="border-l-4"] { border-left: 0 !important; padding-left: 0 !important; display: flex; align-items: center; gap: 10px; letter-spacing: -.01em; }
.hub-luxe h2[class*="border-l-4"]::before, .hub-luxe h3[class*="border-l-4"]::before { content: ""; width: 26px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, var(--m-deep), var(--m-light)); box-shadow: 0 0 8px rgba(var(--m-rgb),.6); flex-shrink: 0; }
.hub-luxe h2[class*="border-l-4"] + a, .hub-luxe h2[class*="border-l-4"] + span, .hub-luxe h3[class*="border-l-4"] + a, .hub-luxe h3[class*="border-l-4"] + span { border-radius: 999px; padding: 4px 11px; background: linear-gradient(135deg, #111827, var(--m-night)); color: var(--m-cream) !important; box-shadow: 0 8px 16px -10px rgba(17,24,39,.8); letter-spacing: .14em; font-size: 9.5px !important; }

/* Contact - gold-rimmed midnight medallions; socials as gold-edged glass */
.hub-luxe [aria-label] > span[class*="rounded-full"][class*="bg-[#111827]"] { background: radial-gradient(120% 120% at 30% 0%, var(--m-night), #111827 60%) !important; color: var(--m-cream) !important; box-shadow: 0 0 0 1.5px rgba(var(--m-rgb),.65), 0 10px 22px -10px rgba(17,24,39,.8) !important; transition: transform .3s, box-shadow .3s; }
.hub-luxe a[aria-label]:hover > span[class*="rounded-full"] { transform: translateY(-2px) scale(1.05); box-shadow: 0 0 0 1.5px var(--m-light), 0 0 18px rgba(var(--m-rgb),.55) !important; }
.hub-luxe [class*="rounded-xl"][class*="border-gray-200"][class*="shrink-0"] { border-color: rgba(var(--m-rgb),.45) !important; background: linear-gradient(160deg, #fffdf8, var(--m-wash1)) !important; box-shadow: 0 8px 18px -12px rgba(var(--m-deep-rgb),.8) !important; }
.dark .hub-luxe [class*="rounded-xl"][class*="border-gray-200"][class*="shrink-0"] { background: linear-gradient(160deg, var(--m-night3), var(--m-night)) !important; }

/* Lead buttons - one family in the agent's metal. Save Contact is solid metal; the three form
   buttons are ivory (night in dark mode) with a metal edge; Schedule a Showing is its own thing -
   an appointment card: a midnight band (ivory in dark mode) with a metal calendar tile, the label
   with "Pick a day & time" under it, and an arrow that walks forward on hover. */
.hub-luxe .hub-btn-save, .hub-luxe a[href*="/vcard"] { position: relative; background: linear-gradient(135deg, var(--m-mid) 0%, var(--m-base) 45%, var(--m-light) 100%) !important; color: #111827 !important; border-color: rgba(var(--m-deep-rgb),.35) !important; box-shadow: 0 0 0 0 rgba(var(--m-rgb),0), 0 14px 28px -16px rgba(var(--m-deep-rgb),.8), inset 0 1px 0 rgba(255,255,255,.35) !important; }
.dark .hub-luxe .hub-btn-save, .dark .hub-luxe a[href*="/vcard"] { background: linear-gradient(135deg, var(--m-base), var(--m-light)) !important; border-color: rgba(var(--m-light-rgb),.5) !important; }
/* Save Contact hover: the button rises, a soft metal halo opens around it, and the contact-card
   icon turns over once like a card being handed across - same colours throughout, no shine. */
.hub-luxe .hub-btn-save svg { transition: transform .6s cubic-bezier(.34,1.56,.64,1); }
.hub-luxe .hub-btn-save:hover svg { transform: perspective(80px) rotateY(360deg) scale(1.12); }
.hub-luxe .hub-btn-save { letter-spacing: 0; transition: transform .3s cubic-bezier(.22,.61,.36,1), box-shadow .35s, letter-spacing .35s !important; }
.hub-luxe .hub-btn-save:hover { transform: translateY(-3px); letter-spacing: .02em; box-shadow: 0 0 0 4px rgba(var(--m-rgb),.20), 0 22px 34px -18px rgba(var(--m-deep-rgb),.9), inset 0 1px 0 rgba(255,255,255,.35) !important; }
.dark .hub-luxe .hub-btn-save:hover { box-shadow: 0 0 0 4px rgba(var(--m-light-rgb),.18), 0 22px 34px -18px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.35) !important; }
.hub-luxe .hub-btn-save:active { transform: translateY(0) scale(.985); }
.hub-luxe .hub-btn-buy, .hub-luxe .hub-btn-sell { background: radial-gradient(120% 160% at 0% 0%, rgba(var(--m-rgb),.16), transparent 60%), linear-gradient(135deg, #fffdf8, var(--m-wash1)) !important; color: #111827 !important; border-color: rgba(var(--m-rgb),.55) !important; box-shadow: 0 12px 24px -18px rgba(var(--m-deep-rgb),.75) !important; }
.dark .hub-luxe .hub-btn-buy, .dark .hub-luxe .hub-btn-sell { background: radial-gradient(120% 160% at 0% 0%, rgba(var(--m-rgb),.22), transparent 60%), linear-gradient(135deg, var(--m-night3), var(--m-night)) !important; color: var(--m-cream) !important; border-color: rgba(var(--m-light-rgb),.35) !important; }
.hub-luxe .hub-btn-buy svg, .hub-luxe .hub-btn-sell svg { color: var(--m-mid); }
.dark .hub-luxe .hub-btn-buy svg, .dark .hub-luxe .hub-btn-sell svg { color: var(--m-light); }
.hub-luxe .hub-btn-worth { position: relative; overflow: hidden; background: radial-gradient(120% 160% at 100% 0%, rgba(var(--m-rgb),.3), transparent 55%), linear-gradient(135deg, #fffdf8, var(--m-wash2)) !important; border-color: var(--m-base) !important; color: #111827 !important; box-shadow: 0 16px 30px -18px rgba(var(--m-rgb),.95) !important; }
.dark .hub-luxe .hub-btn-worth { background: radial-gradient(120% 160% at 100% 0%, rgba(var(--m-rgb),.3), transparent 55%), linear-gradient(135deg, var(--m-night3), var(--m-night)) !important; color: var(--m-cream) !important; }

.hub-luxe [class*="bg-[#d2b16f]"]:not(.hub-btn-show) { background: linear-gradient(135deg, var(--m-mid) 0%, var(--m-base) 40%, var(--m-light) 100%) !important; color: #111827 !important; box-shadow: 0 18px 34px -16px rgba(var(--m-rgb),.9) !important; }
.hub-luxe .hub-btn-show { position: relative; overflow: hidden; height: auto !important; min-height: 60px; justify-content: flex-start !important; gap: 12px !important; padding: 9px 12px 9px 9px; text-align: left; border: 1px solid rgba(var(--m-rgb),.6); background: radial-gradient(90% 180% at 0% 50%, rgba(var(--m-rgb),.30), transparent 55%), linear-gradient(135deg, #111827 0%, var(--m-night) 100%) !important; color: var(--m-cream) !important; box-shadow: 0 18px 34px -18px rgba(17,24,39,.85), inset 0 1px 0 rgba(var(--m-light-rgb),.18) !important; }
.dark .hub-luxe .hub-btn-show { background: radial-gradient(90% 180% at 0% 50%, rgba(var(--m-rgb),.24), transparent 55%), linear-gradient(135deg, #fffdf8 0%, var(--m-wash1) 100%) !important; color: #111827 !important; border-color: rgba(var(--m-light-rgb),.7); box-shadow: 0 18px 34px -18px rgba(0,0,0,.9), inset 0 1px 0 #fff !important; }
.hub-luxe .hub-btn-show::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1.5px; background: linear-gradient(90deg, transparent 10%, var(--m-light) 50%, transparent 90%); opacity: .8; }
.hub-luxe .hub-show-tile { position: relative; flex-shrink: 0; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: 11px; overflow: hidden; color: #111827; background: linear-gradient(160deg, var(--m-light) 0%, var(--m-base) 55%, var(--m-mid) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 6px 14px -6px rgba(0,0,0,.6); transition: transform .45s cubic-bezier(.34,1.56,.64,1); }
.hub-luxe .hub-show-tile::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 9px; background: rgba(var(--m-deep-rgb),.55); }
.hub-luxe .hub-show-tile svg { position: relative; margin-top: 4px; width: 19px !important; height: 19px !important; }
.hub-luxe .hub-show-label { flex: 1 1 auto; min-width: 0; line-height: 1.15; }
.hub-luxe .hub-show-label::after { content: "Pick a day & time"; display: block; margin-top: 3px; font-size: 9.5px; font-weight: 900; letter-spacing: .2em; text-transform: uppercase; color: var(--m-light); opacity: .85; }
.dark .hub-luxe .hub-show-label::after { color: var(--m-mid); }
.hub-luxe .hub-show-go { display: inline-flex !important; flex-shrink: 0; width: 30px; height: 30px; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid rgba(var(--m-light-rgb),.55); color: var(--m-light); font-size: 15px; transition: transform .35s cubic-bezier(.22,.61,.36,1); }
.dark .hub-luxe .hub-show-go { border-color: rgba(var(--m-rgb),.6); color: var(--m-mid); }
.hub-luxe .hub-btn-show:hover .hub-show-go { transform: translateX(4px); }
.hub-luxe .hub-btn-show:hover .hub-show-tile { transform: rotate(-6deg) scale(1.06); }

.hub-luxe .hub-btn-buy, .hub-luxe .hub-btn-sell, .hub-luxe .hub-btn-worth, .hub-luxe .hub-btn-show { transition: transform .25s cubic-bezier(.22,.61,.36,1), box-shadow .25s; }
.hub-luxe .hub-btn-buy:hover, .hub-luxe .hub-btn-sell:hover, .hub-luxe .hub-btn-worth:hover { transform: translateY(-2px); box-shadow: 0 20px 34px -18px rgba(var(--m-deep-rgb),.85) !important; }
.hub-luxe .hub-btn-show:hover { transform: translateY(-2px); box-shadow: 0 24px 38px -18px rgba(17,24,39,.9), inset 0 1px 0 rgba(var(--m-light-rgb),.18) !important; }
.hub-luxe .hub-btn-buy:active, .hub-luxe .hub-btn-sell:active, .hub-luxe .hub-btn-worth:active, .hub-luxe .hub-btn-show:active { transform: translateY(0) scale(.985); }

@keyframes hubLxShine { 0%, 55% { transform: translateX(-100%); } 85%, 100% { transform: translateX(100%); } }

/* About - ivory paper with a gold edge */
.hub-luxe [class*="rounded-[18px]"][class*="border-[#d8c08a]"] { background: linear-gradient(135deg, rgba(255,253,248,.95), rgba(251,243,223,.88)) !important; border-color: rgba(var(--m-rgb),.45) !important; box-shadow: 0 20px 40px -30px rgba(var(--m-deep-rgb),.8) !important; }
.dark .hub-luxe [class*="rounded-[18px]"][class*="border-[#d8c08a]"] { background: linear-gradient(135deg, #151517, var(--m-night2)) !important; }

/* Luxe cards */
/* Card shadows are box-shadows on the rounded shape itself - a drop-shadow filter inside a
   scrolling row painted a pale box behind the whole row. */
.hub-lx-card { transition: transform .45s cubic-bezier(.22,.61,.36,1); }
.hub-lx-card[class*="rounded-[20px]"], .hub-lx-card .hub-lx-frame { box-shadow: none !important; }
.hub-lx-card:hover { transform: translateY(-4px); }
.hub-lx-sweep { background: linear-gradient(90deg, transparent, rgba(var(--m-pale-rgb),.35), transparent); transform: translateX(-130%) skewX(-12deg); }
.hub-lx-card:hover .hub-lx-sweep { transition: transform 1s cubic-bezier(.22,.61,.36,1); transform: translateX(380%) skewX(-12deg); }
.hub-lx-pulse { animation: hubLxPulse 2.4s ease-out infinite; }
@keyframes hubLxPulse { 0% { transform: scale(.9); opacity: .9; } 100% { transform: scale(1.55); opacity: 0; } }
/* Carousels (mobile) and reviews - gold edges */
.hub-luxe [class*="rounded-[18px]"][class*="bg-cover"], .hub-luxe [class*="rounded-[22px]"][class*="overflow-hidden"] { box-shadow: 0 0 0 1.5px rgba(var(--m-rgb),.55) !important; }
.hub-luxe [class*="rounded-2xl"][class*="border-gray-200"][class*="p-3.5"] { background: linear-gradient(160deg, #fffdf8, var(--m-wash1)) !important; border-color: rgba(var(--m-rgb),.4) !important; }
.hub-luxe footer { border-color: rgba(var(--m-rgb),.30) !important; }
/* Carousel edge fades - off on Luxe (they read as an odd shadow beside the arrows). */
.hub-luxe .agent-hub-shelf-window::before, .hub-luxe .agent-hub-shelf-window::after { display: none !important; }
.hub-luxe .agent-hub-desktop-trio, .hub-luxe .agent-hub-desktop-duo { padding: 16px 18px 20px; margin: -16px -18px -20px; scroll-padding-inline: 18px; }
/* That 18px of shadow room let ~6px of the neighbouring cards peek in at both ends - trim the
   sides to just under the 12px gap so exactly 3 (or 2) cards show, shadows still breathing. */
@media (min-width: 1024px) { .hub-luxe .agent-hub-desktop-trio, .hub-luxe .agent-hub-desktop-duo { clip-path: inset(0 7px); } }
/* No drop shadows on anything that slides (rows, one-at-a-time sliders): a scrolling row clips a
   card's shadow into a pale box around the whole row as it moves. The gold frame does the work. */
.hub-luxe .agent-hub-shelf-window *, .hub-luxe .hc-root, .hub-luxe .hc-root .hc-slide > div > * { box-shadow: none; }
.hub-luxe .agent-hub-shelf-window [class*="rounded-[22px]"][class*="overflow-hidden"], .hub-luxe .agent-hub-shelf-window [class*="rounded-[18px]"][class*="bg-cover"] { box-shadow: 0 0 0 1.5px rgba(var(--m-rgb),.55) !important; }
.hub-luxe .agent-hub-shelf-window > button { box-shadow: none !important; }
.hub-luxe .agent-hub-shelf-window > button { border-color: rgba(var(--m-rgb),.55) !important; background: linear-gradient(135deg, #111827, var(--m-night)) !important; color: var(--m-cream) !important; }

@media (prefers-reduced-motion: reduce) {
  .hub-lx-motif, .hub-lx-price, .hub-lx-sold, .hub-lx-sold::after, .hub-lx-sold-dot, .hub-lx-gcard { animation: none; } .hub-lx-skyline path { animation: none; stroke-dashoffset: 0; }
  .hub-lx-aurora, .hub-lx-silk, .hub-lx-spark, .hub-lx-beam, .hub-lx-pulse, .hub-luxe .font-serif[class*="text-[30px]"], .hub-luxe .hub-name, .hub-luxe .hub-btn-save svg, .hub-luxe .hub-show-tile, .hub-luxe .hub-show-go, .hub-luxe [class*="rounded-[28px]"][class*="bg-[#fbfaf7]"]::before, .hub-luxe [class*="rounded-[28px]"][class*="bg-[#fbfaf7]"]::after, .hub-luxe [class*="rounded-full"][class*="border-[#cdaa64]"], .hub-luxe .hub-split-photo { animation: none; }
  .hub-luxe .hub-enter { animation: none; }
}
`
