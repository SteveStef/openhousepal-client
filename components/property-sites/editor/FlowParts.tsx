'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Laptop, Loader2, MousePointer2, Smartphone, Sparkles, X } from 'lucide-react'
import HeroMedia from '@/components/property-sites/spotlight/HeroMedia'
import type { HeaderMode, HeaderMotion, HeroFrame } from '@/components/property-sites/spotlight/model'
import type { PropertyWebsiteTemplateId } from '@/types'

// Real example for the "living photo" header: a front-elevation photo of Peter Stefanatos' sale
// at 5829 Ridgeview Dr (Doylestown) and the AI clip made from it (Media Lab asset eff1fea6,
// 2026-09-06), played forward-then-back exactly like a live header (see
// spotlight_header_service.build_boomerang). Web-sized copies in public/demos/spotlight.
// The living-photo example: a real Spotlight header made 2026-09-30 through the normal Media
// Lab pipeline (asset 91270e0c, slow push-in + day to dusk), boomerang loop re-encoded to 1280px.
// Shown with no agent name or card - it's another agent's listing (Compass), not ours.
// The AI living photo header is paused ("Coming soon") until the video quality is there - the
// whole flow below still works; backend twin: spotlight_header_service.LIVING_PHOTO_ENABLED.
export const LIVING_PHOTO_ENABLED = false

export const HEADER_DEMO = {
  photo: '/demos/spotlight/old-gulph-photo.jpg',
  loop: '/demos/spotlight/old-gulph-loop.mp4',
  address: '26 Old Gulph Rd',
  place: 'Gladwyne, PA',
  price: '$7,495,000',
  stats: ['8 Beds', '10.5 Baths', '19,382 Sq Ft'],
}
// A plain Media Lab clip for comparison - the living-room shot from the homepage reel, with the
// exact photo it was made from (public/demos/media-lab/reel-photo-1.jpg).
export const MEDIA_LAB_DEMO = {
  clip: '/demos/spotlight/media-lab-living-room.mp4',
  photo: '/demos/spotlight/media-lab-living-room.jpg',
}

// A small browser window showing a Spotlight header - the photo/slideshow/video with the page's
// own address, price and stats laid over it, in the chosen design's look.
export function HeroPreviewFrame({ template, hero, photos, mode, motion, videoUrl, videoPoster, address, place, price, stats, className = '', label, frame }: {
  template: PropertyWebsiteTemplateId
  frame?: HeroFrame | null
  hero: string | null
  photos: string[]
  mode: HeaderMode
  motion: HeaderMotion
  videoUrl?: string | null
  videoPoster?: string | null
  address: string
  place?: string | null
  price?: string | null
  stats: string[]
  className?: string
  label?: string
}) {
  const cinematic = template === 'cinematic_luxury'
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-[#1c1c1e]">
        <span className="h-2 w-2 rounded-full bg-red-400" /><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 text-[9px] font-semibold text-gray-400 dark:bg-black/30">{label || 'your-listing.openhousepal.com'}</span>
      </div>
      <div className={`relative aspect-[16/10] overflow-hidden ${cinematic ? 'bg-[#0A0A0A]' : 'bg-[#091513]'}`}>
        <HeroMedia hero={hero} photos={photos} mode={mode} motion={motion} videoUrl={videoUrl} videoPoster={videoPoster} frame={frame} alt={address} />
        <div className={`absolute inset-0 ${cinematic ? 'bg-[linear-gradient(180deg,rgba(0,0,0,.45)_0%,rgba(0,0,0,0)_35%,rgba(0,0,0,.2)_60%,rgba(10,10,10,.92)_100%)]' : 'bg-[linear-gradient(180deg,rgba(9,21,19,.5)_0%,rgba(9,21,19,0)_35%,rgba(9,21,19,.25)_60%,rgba(9,21,19,.9)_100%)]'}`} />
        <div className="absolute inset-x-3 top-2.5 flex items-center justify-between text-white">
          <span className="h-1.5 w-10 rounded-full bg-white/70" />
          <span className={`h-3 w-12 ${cinematic ? 'rounded-full bg-[#C9A24D]' : 'border border-white/70'}`} />
        </div>
        <div className={`absolute inset-x-3 ${cinematic ? 'bottom-9' : 'bottom-3'} text-white`}>
          {place && <p className="text-[7px] font-semibold uppercase tracking-[0.35em] text-white/70">{place}</p>}
          <p className={`mt-0.5 truncate font-serif leading-none ${cinematic ? 'text-[22px] font-light' : 'text-[24px] tracking-tight'}`}>
            {cinematic ? address : <><i>{address.split(' ')[0]}</i> {address.split(' ').slice(1).join(' ')}</>}
          </p>
          <div className={`mt-2 flex items-end gap-3 border-t pt-1.5 ${cinematic ? 'border-[#C9A24D]/60' : 'border-white/30'}`}>
            {price && <span className="font-serif text-[13px] leading-none">{price}</span>}
            {stats.map(s => <span key={s} className="text-[7px] font-semibold uppercase tracking-[0.2em] text-white/70">{s}</span>)}
          </div>
        </div>
        {cinematic && (
          <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-white/10 bg-black/50 py-1 ">
            <div className="flex w-max animate-marquee-x gap-6 text-[7px] font-semibold uppercase tracking-[0.3em] text-white/80">
              {[...stats, ...stats, ...stats, ...stats].map((s, i) => <span key={i}>{s} ◆</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// The homepage-style walkthrough of the living photo: the agent's photo gets picked, the AI
// works on it, then the finished loop plays as the page's header.
export function HeaderVideoDemo({ template }: { template: PropertyWebsiteTemplateId }) {
  const [phase, setPhase] = useState<'pick' | 'make' | 'live'>('pick')
  useEffect(() => {
    const ms = phase === 'pick' ? 2200 : phase === 'make' ? 2600 : 10500
    const t = window.setTimeout(() => setPhase(phase === 'pick' ? 'make' : phase === 'make' ? 'live' : 'pick'), ms)
    return () => window.clearTimeout(t)
  }, [phase])
  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
        {(['pick', 'make', 'live'] as const).map((p, i) => (
          <span key={p} className={`flex items-center gap-1.5 transition ${phase === p ? 'text-[#8b7355] dark:text-[#d7b974]' : ''}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${phase === p ? 'bg-[#C9A24D] text-white' : 'bg-gray-200 text-gray-500 dark:bg-white/10'}`}>{i + 1}</span>
            {p === 'pick' ? 'Your photo' : p === 'make' ? 'AI brings it to life' : 'Your page header'}
          </span>
        ))}
      </div>
      {phase === 'live' ? (
        <HeroPreviewFrame
          key="live" template={template} hero={HEADER_DEMO.photo} photos={[]} mode="video" motion="none"
          videoUrl={HEADER_DEMO.loop} videoPoster={HEADER_DEMO.photo}
          address={HEADER_DEMO.address} place={HEADER_DEMO.place} price={HEADER_DEMO.price} stats={HEADER_DEMO.stats}
          label="5829-ridgeview-dr.openhousepal.com" className="hvd-in"
        />
      ) : (
        <div className="relative aspect-[16/11] overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-[#1c1c1e]">
          <img src={HEADER_DEMO.photo} alt="" className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${phase === 'make' ? 'scale-[1.03] brightness-75' : 'scale-100'}`} />
          {phase === 'pick' && (
            <>
              <span className="hvd-ring absolute inset-2 rounded-lg ring-[3px] ring-[#C9A24D]" />
              <span className="hvd-check absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#C9A24D] text-white shadow"><Check className="h-3.5 w-3.5" /></span>
              <MousePointer2 className="hvd-cursor absolute h-6 w-6 fill-white text-[#111827] drop-shadow" />
            </>
          )}
          {phase === 'make' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
              <span className="hvd-shimmer absolute inset-0" />
              <span className="relative flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-black ">
                <Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> Bringing your photo to life…
              </span>
            </div>
          )}
        </div>
      )}
      <style>{`
        .hvd-in{animation:hvdIn .6s ease both}
        @keyframes hvdIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
        .hvd-cursor{left:62%;top:70%;animation:hvdCursor 2.2s ease both}
        @keyframes hvdCursor{0%{transform:translate(60px,50px);opacity:0}35%{opacity:1}60%{transform:none}70%{transform:scale(.85)}80%,100%{transform:none}}
        .hvd-ring{opacity:0;animation:hvdPop .3s 1.5s ease both}.hvd-check{opacity:0;animation:hvdPop .3s 1.6s ease both}
        @keyframes hvdPop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
        .hvd-shimmer{background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.28) 50%,transparent 70%);background-size:220% 100%;animation:hvdShim 1.3s linear infinite}
        @keyframes hvdShim{from{background-position:120% 0}to{background-position:-120% 0}}
        @media (prefers-reduced-motion: reduce){.hvd-cursor,.hvd-shimmer{animation:none}.hvd-ring,.hvd-check{opacity:1;animation:none}}
      `}</style>
    </div>
  )
}

// What we recommend for the header photo - shown right where the agent picks it.
export function HeaderPhotoTips({ video }: { video: boolean }) {
  const tips = [
    'The front of the house or an aerial of the whole property',
    'Shot in great light - blue sky, sunset or twilight',
    'Wide (landscape) and level, with the house near the middle',
    'Nothing moving in the shot - no people, cars or signs',
    ...(video ? ['For the living photo: sky and trees give the nicest gentle motion; skip interiors and close-ups'] : []),
  ]
  return (
    <div className="rounded-xl border border-[#C9A24D]/30 bg-[#C9A24D]/5 p-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-black text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3.5 w-3.5" /> What makes a great header photo</p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {tips.map(t => (
          <li key={t} className="flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-gray-600 dark:text-gray-300">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" /> {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Full-screen preview of a design: the finished sample home (one of Peter's sales) or the
// agent's own draft, on a laptop- or phone-sized screen.
export function PreviewOverlay({ template, siteId, names, onClose, onUse, initialSource = 'sample' }: {
  template: PropertyWebsiteTemplateId
  siteId: string
  names: Record<string, string>
  onClose: () => void
  onUse?: (t: PropertyWebsiteTemplateId) => void
  initialSource?: 'sample' | 'mine'
}) {
  const [source, setSource] = useState<'sample' | 'mine'>(initialSource)
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop')
  const [loaded, setLoaded] = useState(false)
  const src = `/spotlight-preview/${template}${source === 'mine' ? `?site=${siteId}` : ''}`
  useEffect(() => { setLoaded(false) }, [src])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])
  const seg = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black transition ${on ? 'bg-white text-[#111827] shadow-sm' : 'text-white/70 hover:text-white'}`
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b0b0c]/95" role="dialog" aria-modal="true" aria-label="Design preview">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <p className="mr-2 font-serif text-base font-black text-white">{names[template] || 'Preview'}</p>
        <div className="inline-flex rounded-xl bg-white/10 p-1">
          <button className={seg(source === 'sample')} onClick={() => setSource('sample')}>Sample home</button>
          <button className={seg(source === 'mine')} onClick={() => setSource('mine')}>My home</button>
        </div>
        <div className="inline-flex rounded-xl bg-white/10 p-1">
          <button className={seg(device === 'desktop')} onClick={() => setDevice('desktop')} aria-label="Computer size"><Laptop className="h-3.5 w-3.5" /></button>
          <button className={seg(device === 'phone')} onClick={() => setDevice('phone')} aria-label="Phone size"><Smartphone className="h-3.5 w-3.5" /></button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onUse && (
            <button onClick={() => onUse(template)} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e0b85f] px-4 py-2 text-xs font-black text-[#111827]">
              <Check className="h-3.5 w-3.5" /> Use this design
            </button>
          )}
          <button onClick={onClose} className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close preview"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative flex flex-1 items-start justify-center overflow-hidden p-3 sm:p-5">
        {!loaded && <Loader2 className="absolute top-1/3 h-7 w-7 animate-spin text-[#C9A24D]" />}
        <iframe
          key={src}
          src={src}
          title="Spotlight preview"
          onLoad={() => setLoaded(true)}
          className={`h-full rounded-xl border border-white/10 bg-black shadow-2xl transition-all duration-500 ${device === 'phone' ? 'w-[390px] max-w-full' : 'w-full max-w-[1440px]'} ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      {source === 'sample' && <p className="pb-3 text-center text-[10px] font-semibold text-white/40">Sample home: one of Peter Stefanatos&apos; sales - your page uses your listing, your photos and your contact card.</p>}
    </div>
  )
}

// The real page, shrunk: a 1440px-wide iframe of the preview route scaled to fit its box, so
// what the agent sees in the editor is exactly what visitors get. Loads once it scrolls near.
//
// Phones (user, 10/17 - an iPhone showed "A problem repeatedly occurred" on a Spotlight draft):
// a 1440px page drawn at 3x is a ~4300px-wide layer per preview, and the Design step shows
// several at once - more than iOS Safari allows a tab, so it crashed, reloaded and crashed again.
// On a phone each preview is the phone-width page instead (what a visitor's phone shows anyway),
// only ONE preview is live at a time, and after a crash the editor opens with tap-to-load previews.
//
// 10/24 (owner): scrolling past a preview on a phone reloaded it, flickered between the two designs
// and showed black boxes. Now each preview shows a still of the home's own photo until it's really
// on screen (half of it showing), then the live page fades in over it - and a loaded preview STAYS
// loaded (up to two at a time, enough for the Design step's two designs), so scrolling back never
// starts it over. A third one only bumps the one used longest ago.
const PHONE_LIVE_MAX = 2
const livePhonePreviews: ((v: boolean) => void)[] = []
function claimPhonePreview(set: (v: boolean) => void) {
  const at = livePhonePreviews.indexOf(set)
  if (at >= 0) livePhonePreviews.splice(at, 1)
  livePhonePreviews.push(set)
  while (livePhonePreviews.length > PHONE_LIVE_MAX) livePhonePreviews.shift()?.(false)
}
function releasePhonePreview(set: (v: boolean) => void) {
  const at = livePhonePreviews.indexOf(set)
  if (at >= 0) livePhonePreviews.splice(at, 1)
}
const phoneScreen = () => typeof window !== 'undefined' && window.innerWidth < 768
export function spotlightLiteMode(): boolean {
  try { return typeof window !== 'undefined' && sessionStorage.getItem('sp-lite') === '1' } catch { return false }
}
export const ScaledPreview = forwardRef<HTMLIFrameElement, {
  src: string
  aspect?: number // height / width of the visible box (0.625 = 16:10)
  className?: string
  label?: string
  onLoad?: () => void
  /** A still shown until the live page is in (the home's main photo) - never a black box. */
  poster?: string | null
}>(function ScaledPreview({ src, aspect = 0.625, className = '', label, onLoad, poster }, ref) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [near, setNear] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [phone] = useState(phoneScreen)
  const [lite] = useState(() => phoneScreen() && spotlightLiteMode())
  const [tapped, setTapped] = useState(false)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    // Phones: starts once half of it is on screen, then stays (see claimPhonePreview).
    const io = new IntersectionObserver(([e]) => {
      if (!phone) { if (e.isIntersecting) { setNear(true); io.disconnect() } return }
      if (e.intersectionRatio >= 0.5) { claimPhonePreview(setNear); setNear(true) }
    }, { rootMargin: phone ? '0px' : '300px', threshold: phone ? [0, 0.5, 1] : 0 })
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect(); releasePhonePreview(setNear) }
  }, [phone])
  useEffect(() => { setLoaded(false) }, [src])
  useEffect(() => { if (!near) setLoaded(false) }, [near])
  // On a phone the box is phone-shaped too (user, 10/17: a short, wide box made the phone page
  // look squished and tiny) - what a visitor's phone actually shows.
  const base = phone ? 390 : 1440
  if (phone) aspect = 1.9
  const scale = w / base
  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 bg-[#0b0b0c] shadow-lg dark:border-white/10 ${phone ? 'mx-auto w-full max-w-[300px] rounded-[1.6rem]' : ''} ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-[#1c1c1e]">
        <span className="h-2 w-2 rounded-full bg-red-400" /><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="ml-2 truncate rounded-md bg-white px-2 py-0.5 text-[9px] font-semibold text-gray-400 dark:bg-black/30">{label || 'your-listing.openhousepal.com'}</span>
      </div>
      <div ref={boxRef} className="relative overflow-hidden" style={{ height: w ? w * aspect : undefined, aspectRatio: w ? undefined : `${1 / aspect}` }}>
        {poster && (
          <div aria-hidden className={`absolute inset-0 transition-opacity duration-700 ${loaded ? 'opacity-0' : 'opacity-100'}`}>
            <img src={poster} alt="" className={`h-full w-full object-cover ${phone ? 'object-[50%_30%]' : ''}`} />
            <span className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/55" />
          </div>
        )}
        {near && w > 0 && (!lite || tapped) && (
          <iframe
            ref={ref}
            key={src}
            src={src}
            title="Page preview"
            tabIndex={-1}
            onLoad={() => { setLoaded(true); onLoad?.() }}
            className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-500"
            // +3 css px of overscan so a rounding gap never shows a sliver under the page
            style={{ width: base, height: (w * aspect) / scale + 3, transform: `scale(${scale})`, opacity: loaded ? 1 : 0 }}
          />
        )}
        {lite && !tapped && (
          <button type="button" onClick={() => setTapped(true)} className={`absolute inset-0 z-[1] flex items-center justify-center text-[11px] font-black uppercase tracking-wide text-white/90 ${poster ? 'bg-black/35' : 'bg-[#0b0b0c]'}`}>
            <span className="rounded-full bg-black/60 px-3 py-1.5">Tap to load the preview</span>
          </button>
        )}
        {!loaded && !(lite && !tapped) && (poster ? (
          // The still stays calm - just a small "loading" chip once the live page is on its way.
          near && <span className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#e8c97a]" /></span>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="fp-shimmer absolute inset-0" />
            <Loader2 className="relative h-5 w-5 animate-spin text-[#C9A24D]" />
          </div>
        ))}
      </div>
      <style>{`.fp-shimmer{background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.08) 50%,transparent 70%);background-size:220% 100%;animation:fpShim 1.4s linear infinite}@keyframes fpShim{from{background-position:120% 0}to{background-position:-120% 0}}`}</style>
    </div>
  )
})

// A progress bar that always looks alive: moving stripes while working, and when a job runs
// past its usual time it switches to a sweeping "still working" bar instead of sitting frozen.
export function WorkingBar({ pct, overdue = false, done = false }: { pct: number; overdue?: boolean; done?: boolean }) {
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-[#C9A24D]/15">
      {overdue && !done ? (
        <span className="wb-sweep absolute inset-y-0 w-1/3 rounded-full bg-[#C9A24D]" />
      ) : (
        <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ${done ? 'bg-emerald-500' : 'wb-stripes bg-[#C9A24D]'}`} style={{ width: `${done ? 100 : pct}%` }} />
      )}
      <style>{`
        .wb-stripes{background-image:linear-gradient(45deg,rgba(255,255,255,.35) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.35) 50%,rgba(255,255,255,.35) 75%,transparent 75%);background-size:16px 16px;animation:wbMove .8s linear infinite}
        @keyframes wbMove{from{background-position:0 0}to{background-position:16px 0}}
        .wb-sweep{animation:wbSweep 1.4s cubic-bezier(.4,0,.2,1) infinite}
        @keyframes wbSweep{from{left:-35%}to{left:100%}}
        @media (prefers-reduced-motion: reduce){.wb-stripes,.wb-sweep{animation:none}}
      `}</style>
    </div>
  )
}

// "Keep going" - a pulsing pointer toward the Next button while something works in the background.
// The quiet version for inside a card: centered text, no pill and no arrow (the real Next button
// with its own arrow sits right below it).
export function KeepGoingNote({ text }: { text: string }) {
  return <p className="mt-2 text-center text-[11px] font-bold text-[#8b7355] dark:text-[#d7b974]">{text}</p>
}

export function KeepGoing({ text }: { text: string }) {
  return (
    <span className="kg inline-flex items-center gap-2 rounded-full bg-[#C9A24D] px-3.5 py-2 text-[11px] font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30">
      {text} <ArrowRight className="kg-arrow h-4 w-4" />
      <style>{`.kg{animation:kgPulse 1.8s ease-in-out infinite}@keyframes kgPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,162,77,.55)}50%{box-shadow:0 0 0 10px rgba(201,162,77,0)}}.kg-arrow{animation:kgNudge 1s ease-in-out infinite}@keyframes kgNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}@media (prefers-reduced-motion: reduce){.kg,.kg-arrow{animation:none}}`}</style>
    </span>
  )
}
