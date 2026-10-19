'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronLeft, ChevronRight, Clapperboard, Home, Newspaper, Play, Sparkles, X, Youtube } from 'lucide-react'
import BlogCoverArt from '@/components/BlogCoverArt'
import { resolveMediaUrl } from '@/lib/api-service'
import type { SiteTheme } from './types'
import { fontClass } from './blocks/fontClass'
import Reveal from './Reveal'
import SitePhoto from '@/components/website-public/SitePhoto'
import { IMG, sizedBg } from '@/lib/siteImage'

// The website's Media page - a streaming-style hub for everything the agent publishes:
//   - a cinematic "now showing" hero with their newest video, played right here in a window;
//   - tabs: All / Videos / House Tours / Articles;
//   - rows that glide sideways (arrows on computers, swipe on phones);
//   - articles as a featured story + cards (the footer's closing band carries the forms).
// Videos and tours are the Agent Hub's own (AgentHub.config videoLinks/houseTourLinks); articles
// are the agent's published blogs.

export interface MediaItem { id?: string; title?: string; image?: string | null; link: string }
export interface MediaPost { id: string; slug: string; title: string; subtitle?: string | null; cover_image_url?: string | null; category?: string | null; published_at?: string | null; has_video?: boolean }

// Some YouTube titles arrive double-encoded ("Americaâ€™s") - put the punctuation back.
const fixText = (t?: string | null) => String(t || '')
  .replace(/â€™/g, '’').replace(/â€˜/g, '‘').replace(/â€œ/g, '“').replace(/â€\u009d|â€\x9d/g, '”').replace(/â€"/g, '—').replace(/â€“/g, '–').replace(/â€¦/g, '…').replace(/Â /g, ' ').replace(/â€/g, '”')

function youtubeId(link: string): string | null {
  const m = link.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}
const thumb = (item: MediaItem) => {
  const id = youtubeId(item.link)
  return item.image ? resolveMediaUrl(item.image) : id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

// A video's picture at its real 16:9 shape. YouTube's "hqdefault" is 4:3 with black bars baked in,
// so filling a 16:9 tile with it crops in (it looked zoomed). maxresdefault / mqdefault are true
// 16:9; maxres is missing on some videos (YouTube then sends a 120px grey stand-in), so fall back.
function VideoThumb({ item, className = '' }: { item: MediaItem; className?: string }) {
  const id = youtubeId(item.link)
  const sources = id ? [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/mqdefault.jpg`] : [thumb(item)].filter(Boolean) as string[]
  const [i, setI] = useState(0)
  const src = item.image ? resolveMediaUrl(item.image) : sources[i]
  if (!src) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" draggable={false}
      onLoad={e => { if (!item.image && (e.currentTarget.naturalWidth <= 120) && i < sources.length - 1) setI(i + 1) }}
      onError={() => { if (i < sources.length - 1) setI(i + 1) }}
      className={`absolute inset-0 h-full w-full object-cover ${className}`} />
  )
}
const bigThumb = (item: MediaItem) => {
  const id = youtubeId(item.link)
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : thumb(item)
}
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')

function Player({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])
  if (!host) return null
  const id = item ? youtubeId(item.link) : null
  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/85 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            onClick={e => e.stopPropagation()} className="relative w-full max-w-5xl">
            <button type="button" onClick={onClose} aria-label="Close video" className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><X className="h-5 w-5" /></button>
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
              {id
                ? <iframe title={fixText(item.title) || 'Video'} src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full border-0" />
                : <a href={item.link} target="_blank" rel="noreferrer" className="flex h-full w-full items-center justify-center text-white">Open the video</a>}
            </div>
            {item.title && <p className="mt-4 text-center text-base font-bold text-white/90">{fixText(item.title)}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  )
}

/** A row that glides sideways - exactly 4 tiles across on computers (3 on tablets), never a
 * half-cut one; the arrows move a whole row and wrap back to the start at the end. */
function Rail({ title, icon: Icon, count, children, luxe, serif }: { title: string; icon: typeof Play; count: number; children: React.ReactNode; luxe: boolean; serif: string }) {
  const row = useRef<HTMLDivElement>(null)
  const go = (d: number) => {
    const el = row.current
    if (!el) return
    const step = el.clientWidth + 16
    const max = el.scrollWidth - el.clientWidth
    const atEnd = el.scrollLeft >= max - 4
    const atStart = el.scrollLeft <= 4
    if (d > 0 && atEnd) el.scrollTo({ left: 0, behavior: 'smooth' })
    else if (d < 0 && atStart) el.scrollTo({ left: max, behavior: 'smooth' })
    else el.scrollBy({ left: d * step, behavior: 'smooth' })
  }
  return (
    <Reveal as="section" className="mt-14 first:mt-0">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className={`flex items-center gap-2.5 text-2xl sm:text-3xl ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`} style={{ color: 'var(--mh-heading)' }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.14)', color: 'var(--site-accent)' }}><Icon className="h-[18px] w-[18px]" /></span>
          {title}<span className="text-sm font-bold" style={{ color: 'var(--mh-faint)' }}>{count}</span>
        </h2>
        {count > 3 && (
          <div className="hidden gap-2 sm:flex">
            <button type="button" onClick={() => go(-1)} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border transition hover:-translate-y-0.5" style={{ borderColor: 'var(--mh-line)', color: 'var(--mh-heading)' }}><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => go(1)} aria-label="More" className="flex h-10 w-10 items-center justify-center rounded-full border transition hover:-translate-y-0.5" style={{ borderColor: 'var(--mh-line)', color: 'var(--mh-heading)' }}><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <div ref={row} className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-3 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0">{children}</div>
    </Reveal>
  )
}

function VideoTile({ item, kind, onPlay, luxe, serif }: { item: MediaItem; kind: 'video' | 'tour'; onPlay: () => void; luxe: boolean; serif: string }) {
  return (
    <button type="button" onClick={onPlay}
      className={`ohp-media-tile group relative w-[80%] shrink-0 snap-start overflow-hidden text-left sm:w-[calc((100%-16px)/2)] md:w-[calc((100%-32px)/3)] lg:w-[calc((100%-48px)/4)] ${luxe ? 'rounded-[20px]' : 'rounded-2xl'}`}
      style={{ backgroundColor: 'var(--mh-card)', boxShadow: '0 20px 40px -26px rgba(0,0,0,.6)' }}>
      <span className="relative block aspect-video overflow-hidden bg-black">
        <VideoThumb item={item} className="transition duration-700 group-hover:scale-[1.04]" />
        <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
        {/* Small and low - never over the video's own title art in the middle of the picture. */}
        <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[10px] font-black uppercase tracking-wider shadow-[0_6px_16px_rgba(0,0,0,.35)] transition duration-300 group-hover:pr-3.5"
          style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/15"><Play className="ml-px h-2.5 w-2.5 fill-current" /></span>
          {kind === 'tour' ? 'Tour' : 'Watch'}
        </span>
      </span>
      <span className="block px-3.5 pb-3.5 pt-3">
        <span className={`line-clamp-2 text-[13px] leading-snug ${luxe ? `font-black ${serif}` : 'font-bold'}`} style={{ color: 'var(--mh-heading)' }}>{fixText(item.title) || (kind === 'tour' ? 'House tour' : 'Video')}</span>
      </span>
    </button>
  )
}

function ArticleCard({ post, basePrefix, luxe, serif, big = false }: { post: MediaPost; basePrefix: string; luxe: boolean; serif: string; big?: boolean }) {
  return (
    <a href={`${basePrefix}/blog/${post.slug}`} className={`group relative flex flex-col overflow-hidden border transition duration-500 hover:-translate-y-1 ${luxe ? 'rounded-[24px]' : 'rounded-2xl'} ${big ? 'lg:col-span-2 lg:flex-row' : ''}`}
      style={{ backgroundColor: 'var(--mh-card)', borderColor: 'var(--mh-line)', boxShadow: '0 24px 50px -36px rgba(0,0,0,.55)' }}>
      <span className={`relative block overflow-hidden ${big ? 'aspect-[16/10] lg:aspect-auto lg:w-[55%]' : 'aspect-[16/10]'}`}>
        {post.cover_image_url
          ? <SitePhoto src={resolveMediaUrl(post.cover_image_url)} widths={IMG.card} className="absolute inset-0 transition duration-700 group-hover:scale-105 object-cover h-full w-full" />
          : <span className="absolute inset-0"><BlogCoverArt category={post.category} title={post.title} tone="site" showWord={false} /></span>}
        {post.category && <span className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>{post.category}</span>}
        {post.has_video && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-black text-white "><Play className="h-3 w-3 fill-current" />Video</span>}
      </span>
      <span className={`flex flex-1 flex-col p-5 ${big ? 'lg:justify-center lg:p-9' : ''}`}>
        <span className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--site-accent-text)' }}>{fmtDate(post.published_at)}</span>
        <span className={`mt-2 leading-tight ${big ? 'text-2xl sm:text-3xl' : 'text-lg'} ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`} style={{ color: 'var(--mh-heading)' }}>{post.title}</span>
        {post.subtitle && <span className={`mt-2 text-sm leading-relaxed ${big ? '' : 'line-clamp-2'}`} style={{ color: 'var(--mh-muted)' }}>{post.subtitle}</span>}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-black transition group-hover:gap-2.5" style={{ color: 'var(--mh-heading)' }}>Read the story <ArrowRight className="h-3.5 w-3.5" /></span>
      </span>
    </a>
  )
}

type Tab = 'all' | 'videos' | 'tours' | 'articles'

export default function MediaHub({ theme, basePrefix, posts, videos, tours, agentName, channelUrl }: {
  theme: SiteTheme; basePrefix: string; posts: MediaPost[]; videos: MediaItem[]; tours: MediaItem[]; agentName?: string | null; channelUrl?: string | null
}) {
  const luxe = theme.template !== 'default'
  const serif = fontClass(theme.heading_font, 'font-serif')
  const [tab, setTab] = useState<Tab>('all')
  const [playing, setPlaying] = useState<MediaItem | null>(null)
  const heroItem = videos[0] || tours[0] || null
  const [heroIdx, setHeroIdx] = useState(0)
  const heroPool = useMemo(() => [...videos.slice(0, 4), ...tours.slice(0, 2)], [videos, tours])
  useEffect(() => {
    if (heroPool.length < 2) return
    const id = setInterval(() => setHeroIdx(i => (i + 1) % heroPool.length), 8000)
    return () => clearInterval(id)
  }, [heroPool.length])
  const hero = heroPool[heroIdx % Math.max(1, heroPool.length)] || heroItem
  const first = (agentName || '').split(' ')[0]

  const tabs: { id: Tab; label: string; icon: typeof Play; n: number }[] = [
    { id: 'all', label: 'All', icon: Sparkles, n: videos.length + tours.length + posts.length },
    ...(videos.length ? [{ id: 'videos' as Tab, label: 'Videos', icon: Clapperboard, n: videos.length }] : []),
    ...(tours.length ? [{ id: 'tours' as Tab, label: 'House tours', icon: Home, n: tours.length }] : []),
    ...(posts.length ? [{ id: 'articles' as Tab, label: 'Articles', icon: Newspaper, n: posts.length }] : []),
  ]
  // Page colors - Luxe is a dark cinema, Classic stays bright.
  const vars = luxe
    ? { '--mh-bg': theme.primary_color, '--mh-card': 'rgba(255,255,255,.05)', '--mh-heading': '#ffffff', '--mh-muted': 'rgba(255,255,255,.62)', '--mh-faint': 'rgba(255,255,255,.6)', '--mh-line': 'rgba(255,255,255,.12)' }
    : { '--mh-bg': 'var(--site-bg)', '--mh-card': 'var(--site-surface)', '--mh-heading': 'var(--site-heading)', '--mh-muted': 'var(--site-muted)', '--mh-faint': 'var(--site-faint)', '--mh-line': 'var(--site-line-strong)' }

  return (
    <main style={{ ...(vars as any), backgroundColor: 'var(--mh-bg)' }} data-testid="media-hub">
      {/* Now showing */}
      {hero ? (
        <section className="relative isolate overflow-hidden">
          <AnimatePresence>
            <motion.div key={hero.link} initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.4 }}
              className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${bigThumb(hero)})` }} />
          </AnimatePresence>
          <div className="absolute inset-0 -z-10" style={{ background: luxe ? `linear-gradient(90deg, ${theme.primary_color} 8%, rgba(0,0,0,.55) 55%, rgba(0,0,0,.25)), linear-gradient(0deg, ${theme.primary_color}, transparent 45%)` : 'linear-gradient(90deg, rgba(10,12,18,.88) 10%, rgba(10,12,18,.45) 60%, rgba(10,12,18,.15)), linear-gradient(0deg, rgba(10,12,18,.6), transparent 40%)' }} />
          <div className="mx-auto flex min-h-[620px] max-w-7xl flex-col justify-end px-5 pb-14 pt-32 sm:min-h-[680px] sm:px-6 sm:pb-20">
            <Reveal>
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent-light)' }}>
                <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-70" /><span className="relative h-2 w-2 rounded-full bg-red-500" /></span>
                Now showing{first ? ` · from ${first}` : ''}
              </p>
              <h1 className={`mt-4 max-w-3xl text-4xl leading-[1.05] text-white sm:text-6xl ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`}>{fixText(hero.title) || 'Watch the latest'}</h1>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setPlaying(hero)} className={`inline-flex items-center gap-2.5 px-7 py-4 text-sm font-black transition hover:-translate-y-0.5 ${luxe ? 'ohp-gold-sheen rounded-full' : 'rounded-xl'}`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                  <Play className="h-4 w-4 fill-current" /> Watch now
                </button>
                {channelUrl && (
                  <a href={channelUrl} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 border border-white/25 bg-white/10 px-6 py-4 text-sm font-black text-white transition hover:bg-white/20 ${luxe ? 'rounded-full' : 'rounded-xl'}`}>
                    <Youtube className="h-4 w-4" /> Subscribe
                  </a>
                )}
              </div>
              {heroPool.length > 1 && (
                <div className="mt-10 flex gap-2">
                  {heroPool.map((h, i) => (
                    <button key={h.link} type="button" onClick={() => setHeroIdx(i)} aria-label={`Show ${fixText(h.title) || 'video'}`} className="h-1.5 overflow-hidden rounded-full bg-white/25 transition-all" style={{ width: i === heroIdx % heroPool.length ? 44 : 14 }}>
                      {i === heroIdx % heroPool.length && <span key={heroIdx} className="ohp-hero-progress block h-full w-full" style={{ backgroundColor: 'var(--site-accent)', animationDuration: '8000ms' }} />}
                    </button>
                  ))}
                </div>
              )}
            </Reveal>
          </div>
          <div id="site-hero-sentinel" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
        </section>
      ) : (
        <section className="px-5 pb-10 pt-32 text-center sm:px-6">
          <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--site-accent-text)' }}>{agentName ? `From ${agentName}` : 'Media'}</p>
          <h1 className={`mt-3 text-4xl sm:text-6xl ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`} style={{ color: 'var(--mh-heading)' }}>Market insights &amp; local stories</h1>
        </section>
      )}

      {/* Tabs */}
      <div className="sticky top-[64px] z-20 border-b " style={{ borderColor: 'var(--mh-line)', backgroundColor: luxe ? `${theme.primary_color}e6` : 'color-mix(in srgb, var(--site-bg) 90%, transparent)' }}>
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-3 [scrollbar-width:none] sm:px-6">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`relative inline-flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-black transition-colors duration-300 ${luxe ? 'rounded-full' : 'rounded-lg'}`}
              style={{ color: tab === t.id ? 'var(--site-on-accent)' : 'var(--mh-muted)' }}>
              {tab === t.id && <motion.span layoutId="ohp-media-tab" className={`absolute inset-0 ${luxe ? 'rounded-full' : 'rounded-lg'}`} style={{ backgroundColor: 'var(--site-accent)' }} transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
              <span className="relative inline-flex items-center gap-2"><t.icon className="h-4 w-4" />{t.label}<span className="text-xs opacity-60">{t.n}</span></span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-7xl px-5 py-14 sm:px-6 sm:py-16">
        {(tab === 'all' || tab === 'videos') && videos.length > 0 && (tab === 'all'
          ? <Rail title="Latest videos" icon={Clapperboard} count={videos.length} luxe={luxe} serif={serif}>{videos.map(v => <VideoTile key={v.link} item={v} kind="video" onPlay={() => setPlaying(v)} luxe={luxe} serif={serif} />)}</Rail>
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{videos.map((v, i) => <Reveal key={v.link} delay={(i % 3) * 70}><VideoTileGrid item={v} kind="video" onPlay={() => setPlaying(v)} luxe={luxe} serif={serif} /></Reveal>)}</div>)}

        {(tab === 'all' || tab === 'tours') && tours.length > 0 && (tab === 'all'
          ? <Rail title="House tours" icon={Home} count={tours.length} luxe={luxe} serif={serif}>{tours.map(v => <VideoTile key={v.link} item={v} kind="tour" onPlay={() => setPlaying(v)} luxe={luxe} serif={serif} />)}</Rail>
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{tours.map((v, i) => <Reveal key={v.link} delay={(i % 3) * 70}><VideoTileGrid item={v} kind="tour" onPlay={() => setPlaying(v)} luxe={luxe} serif={serif} /></Reveal>)}</div>)}

        {(tab === 'all' || tab === 'articles') && posts.length > 0 && (
          <Reveal as="section" className={tab === 'all' ? 'mt-16' : ''}>
            {tab === 'all' && (
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 className={`flex items-center gap-2.5 text-2xl sm:text-3xl ${luxe ? `font-black ${serif}` : 'font-extrabold tracking-tight'}`} style={{ color: 'var(--mh-heading)' }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.14)', color: 'var(--site-accent)' }}><Newspaper className="h-[18px] w-[18px]" /></span>
                  Articles &amp; guides<span className="text-sm font-bold" style={{ color: 'var(--mh-faint)' }}>{posts.length}</span>
                </h2>
              </div>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p, i) => <ArticleCard key={p.id} post={p} basePrefix={basePrefix} luxe={luxe} serif={serif} big={i === 0 && posts.length > 2} />)}
            </div>
          </Reveal>
        )}

      </motion.div>
      </AnimatePresence>

      <Player item={playing} onClose={() => setPlaying(null)} />
    </main>
  )
}

function VideoTileGrid(props: { item: MediaItem; kind: 'video' | 'tour'; onPlay: () => void; luxe: boolean; serif: string }) {
  return <div className="[&>button]:!w-full"><VideoTile {...props} /></div>
}
