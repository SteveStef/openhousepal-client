'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bath, Bed, CalendarDays, ChevronLeft, ChevronRight, Home, MapPin, Maximize, Plus } from 'lucide-react'
import type { MarketingListing } from '@/types'
import { statusInfo, STATUS_COLORS } from '@/components/property-sites/spotlight/model'

// "Ready for a Spotlight" on the Listing Spotlight page - the agent's listings with no page yet.
//   1 home  -> the wide feature card (photo left, details right).
//   2 homes -> two smaller versions of that same card, side by side.
//   3+      -> those cards in a slider, two at a time (one on phones), switching on its own with
//              arrows and dots - like the Agent Hub's blog shelf - instead of a wall of cards.

const listedLine = (dom?: number | null) =>
  dom == null ? '' : dom === 0 ? 'Listed today' : dom === 1 ? 'Listed yesterday' : `Listed ${dom} days ago`

function Facts({ l, size }: { l: MarketingListing; size: 'lg' | 'sm' }) {
  const chip = `inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/25 bg-[#C9A24D]/[0.08] font-black text-[#6b5320] dark:border-[#e8c97a]/20 dark:bg-white/[0.06] dark:text-[#e8c97a] ${size === 'lg' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10.5px]'}`
  const icon = size === 'lg' ? 'h-3 w-3' : 'h-2.5 w-2.5'
  if (!l.beds && !l.baths && !l.sqft) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${size === 'lg' ? 'mt-3' : 'mt-2.5'}`}>
      {l.beds ? <span className={chip}><Bed className={icon} />{l.beds} bd</span> : null}
      {l.baths ? <span className={chip}><Bath className={icon} />{l.baths} ba</span> : null}
      {l.sqft ? <span className={chip}><Maximize className={icon} />{Number(l.sqft).toLocaleString()} sq ft</span> : null}
    </div>
  )
}

function PickCard({ l, solo, index, onStart }: { l: MarketingListing; solo: boolean; index: number; onStart: (l: MarketingListing) => void }) {
  const st = statusInfo(l.status)
  const col = st ? STATUS_COLORS[st.kind] : null
  const cityLine = [l.city, l.state].filter(Boolean).join(', ')
  const listed = listedLine(l.days_on_market)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: index * 0.07, duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
      className="group relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#e8c97a]/80 via-[#C9A24D]/25 to-[#C9A24D]/70 p-px shadow-[0_24px_50px_-34px_rgba(139,115,85,.9)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(201,162,77,.85)] dark:from-[#C9A24D]/50 dark:via-white/5 dark:to-[#C9A24D]/40"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[23px] bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.16),transparent_55%),linear-gradient(140deg,#fffdf8,#fbf6ec)] sm:flex-row dark:bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.14),transparent_55%),linear-gradient(140deg,#0b0f0e,#111827_60%,#1d1810)]">
        <div className={`relative shrink-0 overflow-hidden bg-gray-100 dark:bg-white/5 ${solo ? 'aspect-[16/9] sm:aspect-auto sm:min-h-[200px] sm:w-[46%]' : 'aspect-[16/9] sm:aspect-auto sm:min-h-[214px] sm:w-[44%]'}`}>
          {l.image ? <img src={l.image} alt="" className="sp-crop absolute inset-0 h-full w-full object-cover transition duration-[1.4s] ease-out group-hover:scale-[1.07]" /> : <Home className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-gray-300" />}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/10" />
          <span aria-hidden className="sp-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            {l.is_new && <span className="sp-chip whitespace-nowrap rounded-full bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-2 py-0.5 text-[9px] font-black uppercase leading-none tracking-wide text-[#111827] shadow">New</span>}
            {st && col && <span className="sp-chip whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black uppercase leading-none tracking-wide shadow" style={{ background: col.bg, color: col.fg }}>{st.label}</span>}
          </div>
          {l.price ? <span className={`absolute bottom-2.5 left-3 font-serif font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.5)] ${solo ? 'text-lg' : 'text-xl'}`}>${Number(l.price).toLocaleString()}</span> : null}
        </div>
        <div className={`relative flex min-w-0 flex-1 flex-col ${solo ? 'justify-center p-5 sm:p-7' : 'p-4 sm:p-5'}`}>
          <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
          <p className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.26em] text-[#8b7355] dark:text-[#e8c97a]">
            <span className="h-px w-6 bg-[#C9A24D]" />{solo ? 'Your newest listing' : l.is_new ? 'New listing' : 'No Spotlight yet'}
          </p>
          <p className={`font-serif font-black leading-tight text-[#111827] dark:text-white ${solo ? 'truncate text-2xl sm:text-3xl' : 'line-clamp-2 text-[19px]'}`}>{l.address}</p>
          {cityLine && (
            <p className={`mt-1 flex items-center gap-1 truncate font-bold text-gray-500 dark:text-white/60 ${solo ? 'text-sm' : 'text-[12.5px]'}`}>
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" /><span className="truncate">{cityLine}</span>
            </p>
          )}
          <Facts l={l} size={solo ? 'lg' : 'sm'} />
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${solo ? 'mt-5' : 'mt-auto pt-4'}`}>
            <motion.button
              onClick={() => onStart(l)}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              className={`lx-shine group/sb relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 transition-shadow hover:shadow-[0_14px_30px_-10px_rgba(201,162,77,.95)] ${solo ? 'px-6 py-3 text-sm' : 'px-4 py-2.5 text-[12.5px]'}`}
            >
              <Plus className="h-4 w-4 transition-transform duration-300 group-hover/sb:rotate-90" /> Make its Spotlight
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/sb:translate-x-1" />
            </motion.button>
            {listed && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 dark:text-white/45">
                <CalendarDays className="h-3.5 w-3.5" />{listed}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function SpotlightPicks({ picks, onStart }: { picks: MarketingListing[]; onStart: (l: MarketingListing) => void }) {
  const slider = picks.length > 2
  const [perView, setPerView] = useState(2)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setPerView(mq.matches ? 2 : 1)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const pages = slider ? Math.max(1, picks.length - perView + 1) : 1
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => { if (at > pages - 1) setAt(0) }, [at, pages])
  useEffect(() => {
    if (!slider || paused || pages < 2) return
    const t = setTimeout(() => setAt(i => (i + 1) % pages), 6000)
    return () => clearTimeout(t)
  }, [slider, paused, pages, at])
  const touchX = useRef<number | null>(null)
  const go = (d: number) => setAt(i => (i + d + pages) % pages)

  if (!picks.length) return null
  return (
    <section className="mt-6" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A24D] opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#C9A24D]" /></span>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#e8c97a]">Ready for a Spotlight</p>
        {picks.length > 1 && <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[10px] font-black text-[#8b6a2b] dark:text-[#e8c97a]">{picks.length}</span>}
        <span className="h-px flex-1 bg-gradient-to-r from-[#C9A24D]/40 to-transparent" />
        {slider && pages > 1 && (
          <div className="flex shrink-0 items-center gap-1.5">
            {[[-1, ChevronLeft, 'Previous'], [1, ChevronRight, 'Next']].map(([d, Icon, label]) => {
              const I = Icon as typeof ChevronLeft
              return (
                <button key={label as string} type="button" aria-label={label as string} onClick={() => go(d as number)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C9A24D]/40 bg-white/85 text-[#8b6a2b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D] dark:bg-white/[0.06] dark:text-[#e8c97a]">
                  <I className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!slider ? (
        <div className={`grid gap-3 sm:gap-4 ${picks.length === 2 ? 'lg:grid-cols-2' : ''}`}>
          {picks.map((l, i) => <PickCard key={l.listing_key} l={l} solo={picks.length === 1} index={i} onStart={onStart} />)}
        </div>
      ) : (
        <>
          <div className="-my-3 overflow-hidden py-3"
            onTouchStart={e => { touchX.current = e.touches[0].clientX; setPaused(true) }}
            onTouchEnd={e => { const s = touchX.current; touchX.current = null; setPaused(false); if (s == null) return; const dx = e.changedTouches[0].clientX - s; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1) }}>
            <div className="-mx-1.5 flex transition-transform duration-700 sm:-mx-2 ease-[cubic-bezier(.22,.61,.36,1)]" style={{ transform: `translateX(-${(100 / perView) * at}%)` }}>
              {picks.map((l, i) => (
                <div key={l.listing_key} className="shrink-0 px-1.5 sm:px-2" style={{ width: `${100 / perView}%` }}>
                  <PickCard l={l} solo={false} index={Math.min(i, perView)} onStart={onStart} />
                </div>
              ))}
            </div>
          </div>
          {pages > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {Array.from({ length: pages }).map((_, i) => (
                <button key={i} type="button" aria-label={`Show listing ${i + 1}`} onClick={() => setAt(i)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === at ? 'w-6 bg-[#C9A24D]' : 'w-1.5 bg-[#C9A24D]/30 hover:bg-[#C9A24D]/60'}`} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
