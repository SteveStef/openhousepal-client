'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bath, Bed, ChevronLeft, ChevronRight, MapPin, Maximize, Play, X } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { glideRowByCard } from '@/lib/rowScroll'

// The closing "pitch" an agent picks in the AI writer's Finish step: a gliding row of their own recent
// sales or listings in the article's area, or a set of videos about the area. Real data only -
// snapshots of the agent's Agent Hub sales / live listings / Agent Hub videos at the time they
// were added.

export type ShowcaseProperty = {
  id?: string; address: string; city?: string | null; state?: string | null; price?: number | null
  beds?: number | null; baths?: number | null; sqft?: number | null; status?: string | null; sold_date?: string | null; image_url?: string | null
}
export type ShowcaseVideo = { id?: string; url: string; title?: string; image?: string | null }

// Full price, like the Agent Hub's cards ($1,535,000 - not $1.54M).
const money = (n?: number | null) => (n ? `$${Math.round(n).toLocaleString()}` : '')
const titleCase = (v?: string | null) => {
  const t = String(v || '').trim()
  return t && t === t.toUpperCase() ? t.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()) : t
}
const placeOf = (p: ShowcaseProperty) => [titleCase(p.city), (p.state || '').toUpperCase()].filter(Boolean).join(', ')
const soldMonth = (d?: string | null) => {
  if (!d) return ''
  const t = Date.parse(d.length === 10 ? `${d}T12:00:00` : d)
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Same badge colors as the Agent Hub's sales and listings (lib/agentSales getSaleStatusClass) - a
// sold home wears the hub's rose "Sold", not gold.
function statusBadge(kind: 'sales' | 'listings', status?: string | null) {
  const s = (status || '').toLowerCase()
  if (kind === 'sales' || s.includes('sold') || s.includes('closed')) return { label: 'Sold', cls: 'bg-gradient-to-br from-[#c0392b] to-[#8e1e1e] text-white shadow-[0_8px_18px_-8px_rgba(140,30,30,.9)]' }
  if (s.includes('coming')) return { label: 'Coming Soon', cls: 'bg-[#111827] text-white' }
  if (s.includes('pending') || s.includes('contract')) return { label: s.includes('contract') ? 'Under Contract' : 'Pending', cls: 'bg-yellow-400 text-[#111827]' }
  return { label: 'For Sale', cls: 'bg-emerald-500 text-white' }
}

// "Recent Sales in Bryn Mawr", not "My recent sales" - reads as what's selling in the area, not a
// short list of everything the agent ever sold. Older articles saved the old wording; it's
// re-labelled when shown.
function showcaseTitle(kind: 'sales' | 'listings', title?: string) {
  const t = (title || '').trim()
  if (kind === 'sales') {
    const m = t.match(/^my recent sales(?:\s+in\s+(.+))?$/i)
    if (!t || m) return m?.[1] ? `Recent Sales in ${m[1]}` : 'Recent Sales in the Area'
    return t
  }
  const m = t.match(/^my (?:current )?listings(?:\s+in\s+(.+))?$/i)
  if (!t || m) return m?.[1] ? `Homes for Sale in ${m[1]}` : 'Homes for Sale'
  return t
}

export function youtubeIdOf(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)
  return m ? m[1] : null
}

function Eyebrow({ text, accent }: { text: string; accent: string }) {
  return <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: accent }}><span className="h-px w-8" style={{ backgroundColor: accent }} /> {text}</p>
}

/** The agent's sales (or listings) as one row of cards that glides along by itself, like the Agent
 *  Hub's Recent Sales shelf - pauses while a reader hovers or touches it, arrows on desktop. */
export function PropertyShowcase({ title, kind, properties, accent = '#C9A24D' }: { title?: string; kind: 'sales' | 'listings'; properties: ShowcaseProperty[]; accent?: string }) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null)
  const list = properties || []
  // Three or fewer sit still, side by side - gliding back and forth over so few looks silly.
  const glide = list.length > 3
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [list.length])
  useEffect(() => {
    const el = rowRef.current
    if (!el || paused || !inView || !glide) return
    const t = window.setInterval(() => { if (el.scrollWidth > el.clientWidth + 4) glideRowByCard(el, 1, true) }, 4500)
    return () => window.clearInterval(t)
  }, [paused, inView, list.length])
  useEffect(() => () => { if (resume.current) clearTimeout(resume.current) }, [])
  if (!list.length) return null
  const pause = () => { if (resume.current) clearTimeout(resume.current); setPaused(true) }
  const resumeSoon = (ms = 1500) => { if (resume.current) clearTimeout(resume.current); resume.current = setTimeout(() => setPaused(false), ms) }
  const nudge = (d: 1 | -1) => { pause(); glideRowByCard(rowRef.current, d, true, 800); resumeSoon() }
  const arrow = 'absolute top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-[#111827] shadow-md transition hover:scale-110 hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#151517]/90 dark:text-white sm:flex'
  return (
    <section className="not-prose my-10">
      <Eyebrow text={kind === 'sales' ? 'Recently sold nearby' : 'On the market'} accent={accent} />
      <h3 className="mt-2 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{showcaseTitle(kind, title)}</h3>
      {glide ? (
        <div className="relative mt-5">
          <div
            ref={rowRef}
            className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-3 [scrollbar-width:none]"
            onMouseEnter={pause} onMouseLeave={() => resumeSoon(600)}
            onTouchStart={pause} onTouchEnd={() => resumeSoon()} onTouchCancel={() => resumeSoon()}
          >
            {list.map((p, i) => <HomeCard key={p.id || `${p.address}-${i}`} p={p} i={i} kind={kind} accent={accent} className="w-[260px] shrink-0 snap-start sm:w-[280px]" />)}
          </div>
          <button type="button" onClick={() => nudge(-1)} aria-label="Previous" className={`${arrow} -left-3`}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => nudge(1)} aria-label="Next" className={`${arrow} -right-3`}><ChevronRight className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className={`mt-5 grid gap-4 ${list.length === 3 ? 'sm:grid-cols-3' : list.length === 2 ? 'sm:grid-cols-2' : 'sm:max-w-sm'}`}>
          {list.map((p, i) => <HomeCard key={p.id || `${p.address}-${i}`} p={p} i={i} kind={kind} accent={accent} />)}
        </div>
      )}
    </section>
  )
}

// One home, dressed like the Agent Hub's sale cards: the photo in a thin accent frame, the status
// badge, and the full price with the town and state on the photo; the street, sold month and facts
// underneath.
function HomeCard({ p, i, kind, accent, className = '' }: { p: ShowcaseProperty; i: number; kind: 'sales' | 'listings'; accent: string; className?: string }) {
  const badge = statusBadge(kind, p.status)
  const place = placeOf(p)
  return (
    <motion.article initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: Math.min(i, 5) * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden rounded-[22px] p-[1.5px] shadow-[0_26px_50px_-34px_rgba(17,24,39,.6)] transition hover:-translate-y-1 hover:shadow-[0_32px_60px_-32px_rgba(17,24,39,.65)] ${className}`}
      style={{ background: `linear-gradient(135deg, ${accent}, ${accent}2e 45%, ${accent}aa)` }}>
      <div className="relative overflow-hidden rounded-[20.5px] bg-white dark:bg-[#111316]">
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-white/5">
          {p.image_url && <img src={resolveMediaUrl(p.image_url)} alt={p.address} loading="lazy" className="h-full w-full object-cover transition duration-[1.2s] ease-out group-hover:scale-[1.06]" />}
          <span className="absolute inset-0 bg-gradient-to-t from-[#0b0f0e]/90 via-[#0b0f0e]/15 to-transparent" />
          <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badge.cls}`}>{badge.label}</span>
          <span className="absolute inset-x-0 bottom-0 p-4">
            <span className="block h-px w-10" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            {p.price ? <span className="mt-2 block text-[1.6rem] font-black leading-none tracking-tight text-white drop-shadow">{money(p.price)}</span> : null}
            {place && <span className="mt-1.5 flex items-center gap-1 text-xs font-bold text-white/85"><MapPin className="h-3.5 w-3.5" style={{ color: accent }} />{place}</span>}
          </span>
        </div>
        <div className="px-4 pb-4 pt-3">
          <p className="truncate font-serif text-[15px] font-black text-[#111827] dark:text-white">{p.address}</p>
          {kind === 'sales' && soldMonth(p.sold_date) && <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>Sold {soldMonth(p.sold_date)}</p>}
          {(p.beds || p.baths || p.sqft) ? (
            <p className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-gray-500 dark:text-gray-400">
              {p.beds ? <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{p.beds} bd</span> : null}
              {p.baths ? <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{p.baths} ba</span> : null}
              {p.sqft ? <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{Number(p.sqft).toLocaleString()} sqft</span> : null}
            </p>
          ) : null}
        </div>
      </div>
    </motion.article>
  )
}

export function VideoShowcase({ title, videos, accent = '#C9A24D', onPlay }: { title?: string; videos: ShowcaseVideo[]; accent?: string; onPlay?: (url: string) => void }) {
  const [playing, setPlaying] = useState<ShowcaseVideo | null>(null)
  const list = (videos || []).filter(v => youtubeIdOf(v.url))
  if (!list.length) return null
  return (
    <section className="not-prose my-10">
      <Eyebrow text="Watch" accent={accent} />
      <h3 className="mt-2 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{title || 'Videos about the area'}</h3>
      <div className={`mt-5 grid gap-4 ${list.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {list.map((v, i) => {
          const id = youtubeIdOf(v.url)!
          return (
            <motion.button key={v.id || v.url} type="button" onClick={() => { setPlaying(v); onPlay?.(v.url) }}
              initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.5, delay: Math.min(i, 5) * 0.06 }} whileTap={{ scale: 0.98 }}
              className="group relative block overflow-hidden rounded-2xl text-left shadow-[0_24px_50px_-34px_rgba(0,0,0,.7)]">
              <div className="relative aspect-video bg-black">
                <img src={v.image || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={v.title || 'Video'} loading="lazy" className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.05] group-hover:opacity-100" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111827] shadow-xl transition group-hover:scale-110" style={{ boxShadow: `0 0 0 6px ${accent}55` }}>
                  <Play className="ml-0.5 h-6 w-6 fill-current" />
                </span>
                {v.title && <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-black text-white">{v.title}</span>}
              </div>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence>
        {playing && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPlaying(null)}>
            <motion.div initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }} className="relative w-full max-w-4xl" onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => setPlaying(null)} aria-label="Close video" className="absolute -top-11 right-0 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                <iframe src={`https://www.youtube.com/embed/${youtubeIdOf(playing.url)}?autoplay=1`} title={playing.title || 'Video'} allow="autoplay; encrypted-media; fullscreen" allowFullScreen className="absolute inset-0 h-full w-full" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
