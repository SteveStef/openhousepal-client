'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Check, ChevronLeft, ChevronRight, Clapperboard, Loader2, Moon, MousePointer2, Sofa, Video } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { PLACEHOLDER_PROPERTY } from '@/lib/studio/designFormats'
import { DEMO_PLACEHOLDER_PHOTOS } from './realData'

// Every image/video here is a REAL Media Lab output, served as web-sized copies from
// public/demos/media-lab (the originals are 1-2MB PNGs / 60MB 1440p video - far too heavy for a
// homepage demo, and the old in-browser downscale of the 1440p clip looked soft):
// - twilight-after: gpt-image-2 twilight of the 412 Ridgemont exterior (asset e3943be9, 2026-09-06)
// - staging-after: gpt-image-2 virtual staging (living room, luxury) of an empty Unsplash room
//   (asset 55a0513f, 2026-09-26, Peter's account)
// - reel-v2.mp4 (renamed from reel.mp4 so browsers holding the old cut can't replay it): Peter's own AI Video Maker walkthrough (asset 93a3e0d6, 2026-09-06), re-encoded to
//   960x540 / faststart, with its first (aerial-through-the-trees) clip cut - the 2 interior clips
//   that remain were made from reel-photo-1/2.jpg, which are copies of those exact listing photos
//   (847 Lesley Rd), kept here so the demo never depends on the MLS still hosting them
// Each before/after pair is the exact same 1200x800 frame, so the compare slider lines up.
const MEDIA = '/demos/media-lab'
const TWILIGHT = { before: `${MEDIA}/twilight-before.jpg`, after: `${MEDIA}/twilight-after.jpg` }
const STAGING = { before: `${MEDIA}/staging-before.jpg`, after: `${MEDIA}/staging-after.jpg` }
const REEL = {
  src: `${MEDIA}/reel-v2.mp4`, poster: `${MEDIA}/reel-v2-poster.jpg`, ms: 11750,
  photos: [`${MEDIA}/reel-photo-1.jpg`, `${MEDIA}/reel-photo-2.jpg`],
}

const property = { ...PLACEHOLDER_PROPERTY, image_url: DEMO_PLACEHOLDER_PHOTOS[0], photos: DEMO_PLACEHOLDER_PHOTOS }

// The 4 real photo effects from the actual product (app/studio/media/page.tsx's EFFECTS array).
const EFFECTS = [
  { id: 'twilight', label: 'Twilight', blurb: 'Daytime exterior → high-end dusk, lights on' },
  { id: 'lights_on', label: 'Lights On', blurb: 'Turn the visible lights on' },
  { id: 'virtual_staging', label: 'Virtual Stage', blurb: 'Furnish an empty room' },
  { id: 'enhance', label: 'Enhance', blurb: 'Grass, sky, lighting & polish' },
]

// Three chapters - Twilight, Virtual Staging, Video - each opened by an "up next" card that says
// what's about to be made, so the whole walkthrough reads as one story instead of three cuts.
type Phase =
  | 'tw-intro' | 'tw-select' | 'tw-effect' | 'tw-generating' | 'tw-result'
  | 'vs-intro' | 'vs-effect' | 'vs-generating' | 'vs-result'
  | 'vid-intro' | 'vid-photos' | 'vid'
const PHASES: Phase[] = [
  'tw-intro', 'tw-select', 'tw-effect', 'tw-generating', 'tw-result',
  'vs-intro', 'vs-effect', 'vs-generating', 'vs-result',
  'vid-intro', 'vid-photos', 'vid',
]
// The opening title + each chapter's "Up next" card hold long enough to read their line.
const TITLE_MS = 5500
const INTRO_MS = 3000
const DURATIONS: Record<Phase, number> = {
  'tw-intro': INTRO_MS, 'tw-select': 2600, 'tw-effect': 2600, 'tw-generating': 1700, 'tw-result': 4600,
  'vs-intro': INTRO_MS, 'vs-effect': 2800, 'vs-generating': 1700, 'vs-result': 4800,
  'vid-intro': INTRO_MS, 'vid-photos': 3400, 'vid': REEL.ms,
}
const CHAPTER: Record<Phase, 1 | 2 | 3> = {
  'tw-intro': 1, 'tw-select': 1, 'tw-effect': 1, 'tw-generating': 1, 'tw-result': 1,
  'vs-intro': 2, 'vs-effect': 2, 'vs-generating': 2, 'vs-result': 2,
  'vid-intro': 3, 'vid-photos': 3, 'vid': 3,
}
// Outer progress bar: title + one continuously-filling segment per chapter.
const TOTAL_SLIDES = 4
const CHAPTER_MS = [1, 2, 3].map(c => PHASES.filter(p => CHAPTER[p] === c).reduce((s, p) => s + DURATIONS[p], 0))

const INTROS = {
  1: { icon: Moon, title: 'Twilight', line: 'Day photo → dusk photo.' },
  2: { icon: Sofa, title: 'Virtual Staging', line: 'Empty room → furnished.' },
  3: { icon: Video, title: 'AI Video', line: 'Photos → a walkthrough video.' },
} as const

// Compare-slider sweep: all "before" -> all "after" -> settle mid-frame so both halves show.
const SWEEP: [number, number][] = [[0, 100], [500, 100], [2000, 0], [2700, 0], [3500, 52]]
function sweepAt(t: number): number {
  for (let k = 1; k < SWEEP.length; k++) {
    const [t1, v1] = SWEEP[k]
    const [t0, v0] = SWEEP[k - 1]
    if (t <= t1) {
      const p = (t - t0) / (t1 - t0)
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2 // easeInOutQuad
      return v0 + (v1 - v0) * e
    }
  }
  return SWEEP[SWEEP.length - 1][1]
}

function CompareSlider({ before, after, label }: { before: string; after: string; label: string }) {
  const [pos, setPos] = useState(100)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = now - start
      setPos(sweepAt(t))
      if (t < SWEEP[SWEEP.length - 1][0]) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl shadow-lg">
      <Image src={after} alt={`${label} result`} fill sizes="330px" className="object-cover" unoptimized />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image src={before} alt="Original photo" fill sizes="330px" className="object-cover" unoptimized />
      </div>
      <span className="absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-white" style={{ opacity: pos > 12 ? 1 : 0, transition: 'opacity .2s' }}>Before</span>
      <span className="absolute right-2 top-2 rounded bg-[#C9A24D] px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-[#111827]" style={{ opacity: pos < 88 ? 1 : 0, transition: 'opacity .2s' }}>After · {label}</span>
      {/* divider + handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" />
        <div className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
          <ChevronLeft className="-mr-1 h-3 w-3 text-[#111827]" strokeWidth={3} />
          <ChevronRight className="-ml-1 h-3 w-3 text-[#111827]" strokeWidth={3} />
        </div>
      </div>
    </div>
  )
}

function ClickCursor() {
  return (
    <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-10">
      <span className="absolute inset-0 rounded-full bg-[#C9A24D]/40 animate-ping" />
      <MousePointer2 className="relative h-3.5 w-3.5 text-[#111827] drop-shadow dark:text-white" fill="currentColor" />
    </span>
  )
}

function Generating({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 animate-fadeIn">
      <div className="relative aspect-[3/2] w-[200px] overflow-hidden rounded-xl shadow-lg">
        <Image src={src} alt="" fill sizes="200px" className="object-cover opacity-50" unoptimized />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      </div>
      <div className="h-1.5 w-[200px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full w-full" style={{ background: 'linear-gradient(90deg,#C9A24D,#f1d58b,#C9A24D)', backgroundSize: '200% 100%', animation: 'ohpDemoShimmer 1.4s linear infinite' }} />
      </div>
      <p className="text-[9.5px] font-black uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  )
}

function EffectList({ selected, clicking }: { selected: string; clicking: boolean }) {
  return (
    <div className="grid w-[128px] flex-shrink-0 grid-cols-1 content-start gap-1.5">
      {EFFECTS.map(e => {
        const on = e.id === selected
        return (
          <div key={e.id} className={`relative rounded-lg border-2 p-1.5 transition-all duration-150 ${on ? `border-[#C9A24D] bg-[#C9A24D]/10 ${clicking ? 'scale-95' : ''}` : 'border-gray-200 dark:border-gray-700'}`}>
            <p className="text-[9px] font-black leading-tight text-[#111827] dark:text-white">{e.label}</p>
            <p className="mt-0.5 text-[7px] font-semibold leading-snug text-gray-400 line-clamp-2">{e.blurb}</p>
            {on && clicking && <ClickCursor />}
          </div>
        )
      })}
    </div>
  )
}

export default function AiMediaDemo() {
  const [showTitle, setShowTitle] = useState(true)
  const [i, setI] = useState(0)
  const phase = PHASES[i]
  const chapter = CHAPTER[phase]
  const videoRef = useRef<HTMLVideoElement>(null)

  // A short "press" right after each selection screen appears, so choices read as clicks.
  const [clicking, setClicking] = useState(false)
  useEffect(() => {
    setClicking(false)
    if (showTitle) return
    const t = setTimeout(() => setClicking(true), Math.max(600, DURATIONS[phase] - 900))
    return () => clearTimeout(t)
  }, [i, phase, showTitle])

  useEffect(() => {
    if (!showTitle) return
    const t = setTimeout(() => setShowTitle(false), TITLE_MS)
    return () => clearTimeout(t)
  }, [showTitle])

  const advance = () => {
    if (i + 1 >= PHASES.length) {
      setI(0)
      setShowTitle(true) // loop back through the title slide like every other demo
    } else {
      setI(i + 1)
    }
  }

  // The video chapter advances when the real clip ends (with a fallback in case it never
  // loads); everything else is timed.
  useEffect(() => {
    if (showTitle) return
    const ms = phase === 'vid' ? REEL.ms + 1500 : DURATIONS[phase]
    const t = setTimeout(advance, ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase, showTitle])

  if (showTitle) {
    return <TitleSlide icon={Clapperboard} iconClassName="ohp-icon-assemble-clapper" kicker="Photo & Video" title="Media Lab" body="Twilight, staging & photo-to-video from your listing photos." nowrapBody ai durationMs={TITLE_MS} totalPages={TOTAL_SLIDES} pageIndex={0} url="app.openhousepal.com/studio/media" />
  }

  const isIntro = phase.endsWith('-intro')
  const intro = INTROS[chapter]
  const IntroIcon = intro.icon
  const headerTitle =
    phase === 'tw-select' ? 'Pick a listing photo'
      : phase === 'tw-effect' || phase === 'vs-effect' ? 'Choose a transformation'
        : phase.endsWith('generating') ? 'Generating...'
          : phase === 'vid-photos' ? 'Pick the photos to animate'
          : phase === 'vid' ? 'Your AI walkthrough video'
            : 'Your AI-generated result'

  return (
    <BrowserFrame
      url="app.openhousepal.com/studio/media"
      progress={{ pages: TOTAL_SLIDES, current: chapter, durationMs: CHAPTER_MS[chapter - 1] }}
    >
      <div className="flex h-[420px] items-center justify-center bg-black/45 p-3">
        <style>{`@keyframes ohpDemoShimmer{0%{background-position:-40% 0}100%{background-position:140% 0}}`}</style>
        <div className="flex max-h-full w-full max-w-[370px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
          {isIntro ? (
            /* "Up next" card - names what's about to be made before each chapter starts */
            <div key={phase} className="flex flex-col items-center px-6 py-9 text-center animate-fadeIn">
              <p className="text-[8.5px] font-black uppercase tracking-[0.2em] text-gray-400">Up next · {chapter} of 3</p>
              <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#8b6f2e] text-white shadow-lg animate-title-icon">
                <IntroIcon className="h-6 w-6" />
              </div>
              <h4 className="mt-3 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{intro.title}</h4>
              <p className="mt-1.5 max-w-[250px] text-[12.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{intro.line}</p>
            </div>
          ) : (
            <>
              <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">Media Lab &middot; {intro.title}</p>
                <h4 className="mt-0.5 font-serif text-sm font-black leading-tight text-[#111827] dark:text-white">{headerTitle}</h4>
              </div>

              <div className="flex-1 overflow-hidden p-4">
                {phase === 'tw-select' && (
                  <div key="tw-select" className="animate-fadeIn">
                    <p className="mb-2.5 text-[9.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Pulled straight from this listing&apos;s photos - no separate upload needed.</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {property.photos!.slice(0, 6).map((src, idx) => (
                        <div key={src + idx} className={`relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition-all duration-150 ${idx === 0 ? `border-[#C9A24D] ${clicking ? 'scale-95' : ''}` : 'border-transparent opacity-60'}`}>
                          <Image src={idx === 0 ? TWILIGHT.before : src} alt="" fill sizes="110px" className="object-cover" unoptimized />
                          {idx === 0 && clicking && (
                            <>
                              <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-2.5 w-2.5" /></div>
                              <ClickCursor />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {phase === 'tw-effect' && (
                  <div key="tw-effect" className="flex h-full gap-3 animate-fadeIn">
                    <EffectList selected="twilight" clicking={clicking} />
                    <div className="flex flex-1 items-center justify-center">
                      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg shadow-lg">
                        <Image src={TWILIGHT.before} alt="" fill sizes="180px" className="object-cover" unoptimized />
                      </div>
                    </div>
                  </div>
                )}

                {phase === 'vs-effect' && (
                  <div key="vs-effect" className="flex h-full gap-3 animate-fadeIn">
                    <EffectList selected="virtual_staging" clicking={clicking} />
                    <div className="flex flex-1 flex-col justify-center gap-2">
                      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg shadow-lg">
                        <Image src={STAGING.before} alt="Empty living room" fill sizes="180px" className="object-cover" unoptimized />
                      </div>
                      {/* the real Virtual Staging options: room type + style */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1 dark:border-gray-700">
                          <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">Room</span>
                          <span className="text-[8.5px] font-black text-[#111827] dark:text-white">Living Room</span>
                        </div>
                        <div className="flex gap-1">
                          {['Modern', 'Transitional', 'Luxury'].map(s => (
                            <span key={s} className={`flex-1 rounded-md border px-1 py-1 text-center text-[7.5px] font-black ${s === 'Luxury' ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8cf8a]' : 'border-gray-200 text-gray-400 dark:border-gray-700'}`}>{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {phase === 'tw-generating' && <Generating key="tw-gen" src={TWILIGHT.before} label="Generating twilight..." />}
                {phase === 'vs-generating' && <Generating key="vs-gen" src={STAGING.before} label="Staging your room..." />}

                {phase === 'tw-result' && (
                  <div key="tw-result" className="animate-fadeIn">
                    <CompareSlider before={TWILIGHT.before} after={TWILIGHT.after} label="Twilight" />
                    <p className="mt-2.5 text-center text-[9px] font-bold text-gray-500 dark:text-gray-400">Same photo, same house - now a dusk shot with the lights on.</p>
                  </div>
                )}
                {phase === 'vs-result' && (
                  <div key="vs-result" className="animate-fadeIn">
                    <CompareSlider before={STAGING.before} after={STAGING.after} label="Staged" />
                    <p className="mt-2.5 text-center text-[9px] font-bold text-gray-500 dark:text-gray-400">Same room, same window and floors - fully furnished in luxury style.</p>
                  </div>
                )}

                {phase === 'vid-photos' && (
                  <div key="vid-photos" className="animate-fadeIn">
                    <p className="mb-2.5 text-[9.5px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Two ordinary listing photos - each one becomes a moving shot.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {REEL.photos.map((src, idx) => (
                        <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-lg border-2 border-[#C9A24D] shadow-sm animate-fadeIn" style={{ animationDelay: `${idx * 120}ms` }}>
                          <Image src={src} alt={`Listing photo ${idx + 1}`} fill sizes="170px" className="object-cover" unoptimized />
                          <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[#111827]"><Check className="h-2.5 w-2.5" /></div>
                          <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-white">Photo {idx + 1}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <span className={`relative inline-flex items-center gap-1 rounded-lg bg-[#111827] px-3 py-1.5 text-[10px] font-black text-white transition-transform duration-150 dark:bg-white dark:text-[#111827] ${clicking ? 'scale-95' : ''}`}>
                        <Video className="h-3 w-3" /> Make Video
                        {clicking && <ClickCursor />}
                      </span>
                    </div>
                  </div>
                )}

                {phase === 'vid' && (
                  <div key="vid" className="animate-fadeIn">
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
                      <video
                        ref={videoRef}
                        src={REEL.src}
                        poster={REEL.poster}
                        autoPlay
                        muted
                        playsInline
                        preload="auto"
                        onEnded={advance}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    <p className="mt-2.5 text-center text-[9px] font-bold text-gray-500 dark:text-gray-400">A real walkthrough generated from those 2 listing photos - no filming needed.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </BrowserFrame>
  )
}
