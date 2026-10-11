'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bus, GraduationCap, Home, MapPin, Store, Trees, TrendingUp } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'

// "Town Spotlight" - a cinematic section about one town inside an article, built from the same
// verified Areas research + live Bright MLS numbers the IDX community pages use (snapshotted into
// the block with an as-of date): a drifting photo with the town name, the live market numbers,
// school districts and what's nearby, and the photo credits.

export type AreaCard = {
  slug: string; name: string; state?: string; county?: string | null
  photo?: string | null; photos?: { url: string; credit?: string }[]
  summary?: string | null; median_price?: number | null; active_count?: number | null; min_price?: number | null; max_price?: number | null
  school_districts?: ({ name?: string } | string)[]
  nearby?: { market?: string[]; downtown?: string[]; parks?: string[]; restaurants_shopping?: string[]; transportation?: string[]; standout?: string[] }
  as_of?: string
}

const money = (n?: number | null) => (n ? (n >= 1_000_000 ? `$${(Math.round(n / 100_000) / 10).toString()}M` : `$${Math.round(n / 1000)}K`) : null)

export default function AreaSpotlightSection({ area, accent = '#C9A24D' }: { area: AreaCard; accent?: string }) {
  const photos = (area.photos?.length ? area.photos : area.photo ? [{ url: area.photo }] : []).map(p => ({ ...p, url: resolveMediaUrl(p.url) }))
  const [i, setI] = useState(0)
  const n = area.nearby || {}
  const schools = (area.school_districts || []).map(d => (typeof d === 'string' ? d : d?.name || '')).filter(Boolean)
  const stats = [
    { icon: TrendingUp, label: 'Median list price', value: money(area.median_price) },
    { icon: Home, label: 'Homes for sale now', value: area.active_count != null ? String(area.active_count) : null },
    { icon: TrendingUp, label: 'Price range', value: area.min_price && area.max_price && area.min_price >= 50_000 ? `${money(area.min_price)} - ${money(area.max_price)}` : null },
  ].filter(s => s.value)
  const nearby = [
    { icon: Store, label: 'Downtown', items: n.downtown },
    { icon: Trees, label: 'Parks', items: n.parks },
    { icon: Bus, label: 'Getting around', items: n.transportation },
    { icon: Store, label: 'Dining & shopping', items: n.restaurants_shopping },
  ].filter(x => x.items && x.items.length)

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="not-prose my-10 overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_40px_80px_-50px_rgba(17,24,39,.6)] dark:border-white/10 dark:bg-[#121214]">
      <style>{SPOT_CSS}</style>
      {/* Photo + name */}
      <div className="relative aspect-[16/8] overflow-hidden bg-[#111827]">
        <AnimatePresence initial={false}>
          {photos.length > 0 && (
            <motion.img key={photos[i]?.url} src={photos[i]?.url} alt={`${area.name}, ${area.state}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }} className="spot-ken absolute inset-0 h-full w-full object-cover" />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-[radial-gradient(90%_100%_at_100%_0%,rgba(201,162,77,.32),transparent_55%),linear-gradient(180deg,rgba(11,15,14,.15)_0%,rgba(11,15,14,.35)_45%,rgba(11,15,14,.92)_100%)]" />
        <span aria-hidden className="spot-edge absolute inset-x-0 top-0 h-px" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.34em]" style={{ color: '#e8c97a' }}><span className="h-px w-8 bg-[#e8c97a]" /> Town spotlight</p>
          <p className="mt-2 font-serif text-4xl font-black leading-none text-white sm:text-5xl">{area.name}<span className="font-light italic text-[#e8c97a]">{area.state ? `, ${area.state}` : ''}</span></p>
          {area.county && <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white/70"><MapPin className="h-3.5 w-3.5" /> {area.county} County</p>}
        </div>
        {photos.length > 1 && (
          <div className="absolute bottom-4 right-5 flex gap-1.5">
            {photos.map((_, k) => <button key={k} type="button" onClick={() => setI(k)} aria-label={`Photo ${k + 1}`} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-[#e8c97a]' : 'w-1.5 bg-white/50 hover:bg-white/80'}`} />)}
          </div>
        )}
      </div>

      <div className="p-6 sm:p-8">
        {area.summary && <p className="text-[17px] leading-[1.8] text-[#1f2937] dark:text-gray-200">{area.summary}</p>}

        {stats.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {stats.map((s, k) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 + k * 0.08 }}
                className="rounded-2xl border p-4 transition hover:-translate-y-0.5" style={{ borderColor: `${accent}55`, background: `linear-gradient(160deg, ${accent}14, transparent)` }}>
                <s.icon className="h-4 w-4" style={{ color: accent }} />
                <p className="mt-2 font-serif text-2xl font-black text-[#111827] dark:text-white">{s.value}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50">{s.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {(schools.length > 0 || nearby.length > 0) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {schools.length > 0 && (
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.03]">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50"><GraduationCap className="h-3.5 w-3.5" style={{ color: accent }} /> School districts</p>
                <p className="mt-1.5 text-sm font-semibold text-[#111827] dark:text-white">{schools.join(' · ')}</p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Districts can differ by address - verify any specific home with the district.</p>
              </div>
            )}
            {nearby.map(x => (
              <div key={x.label} className="rounded-2xl bg-gray-50 p-4 dark:bg-white/[0.03]">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-white/50"><x.icon className="h-3.5 w-3.5" style={{ color: accent }} /> {x.label}</p>
                <p className="mt-1.5 text-sm font-semibold text-[#111827] dark:text-white">{x.items!.slice(0, 3).join(' · ')}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 text-[10px] font-semibold leading-relaxed text-gray-400">
          Market numbers from Bright MLS{area.as_of ? `, as of ${area.as_of}` : ''}; local details from public sources.
          {photos[i]?.credit ? ` Photo: ${photos[i].credit}.` : ''}
        </p>
      </div>
    </motion.section>
  )
}

const SPOT_CSS = `
.spot-ken{animation:spotKen 14s ease-in-out infinite alternate}
@keyframes spotKen{from{transform:scale(1.03)}to{transform:scale(1.12)}}
.spot-edge{background:linear-gradient(90deg,transparent 15%,#e8c97a 50%,transparent 85%);background-size:200% 100%;animation:spotEdge 7s ease-in-out infinite}
@keyframes spotEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
@media (prefers-reduced-motion:reduce){.spot-ken,.spot-edge{animation:none}}
`
