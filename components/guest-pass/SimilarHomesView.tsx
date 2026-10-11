'use client'

// The open house's Similar Homes sheet as a web page - the same homes, in the same order (best
// match first) with the same facts as the printed sheet (lib/pdfs.tsx SimilarPropertiesDocument),
// read live from the open house so an edited sheet shows up here too, and each home brought up to
// date from the MLS feed (guest_pass_service._live_similar: today's price, days on market, under
// contract, sold ones gone - the "Live" bar). Tapping a home opens its full details right inside
// the Guest Pass.
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowUpRight, Loader2 } from 'lucide-react'
import { computeMatchScore } from '@/lib/matchScore'
import LiveIndicator from '@/components/LiveIndicator'
import { ShowcaseCta } from './GuestPass'
import { GuestPassData, cityLine, img, money, possessive, streetOf } from './shared'

const num = (...values: any[]) => {
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

export const listingKeyOf = (p: any) => String(p.ListingKey || p.listingKey || p.id)

// The sheet's homes, best match first - shared by this page and the Guest Pass front page's
// Similar Homes card.
export function useScoredSimilar(data: GuestPassData) {
  const { home } = data
  return useMemo(() => {
    // Same subject + scoring the agent's printed sheet uses: the open house record's own fields,
    // shaped like the Open Houses page's copy of it (app/open-houses/page.tsx -> computeMatchScore).
    const subject = {
      address: home.address, city: home.city, state: home.state, zipcode: home.zipcode,
      latitude: home.latitude, longitude: home.longitude, livingArea: home.sqft, lotSize: home.lot_size,
      price: home.price, bedrooms: home.beds, bathrooms: home.baths,
    }
    const scored = data.similar.map(p => ({ ...p, matchScore: computeMatchScore(p, subject, data.similar) }))
    return scored.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
  }, [data.similar, home])
}

export default function SimilarHomesView({ data, onOpen, onBack, onShowcase, buildingShowcase, showcaseError }: {
  data: GuestPassData; onOpen: (listingKey: string) => void; onBack: () => void
  onShowcase: () => void; buildingShowcase: boolean; showcaseError: string | null
}) {
  const { home } = data
  const homes = useScoredSimilar(data)
  // A guest with a Showcase sees the best few here and the rest there: 5 homes then a faded 6th
  // that opens their Showcase (phones: 3, then the 4th). No Showcase = every home, as before.
  const teaser = !!data.showcase
  const shown = teaser ? homes.slice(0, 5) : homes
  const moreAfter = (n: number) => homes.length - n

  return (
    <div className="mx-auto max-w-6xl px-4 pb-4 pt-3 sm:pt-5">
      {/* One header: Back beside the title, and the live check + how many homes on the right. */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <motion.button
              type="button"
              onClick={onBack}
              whileTap={{ scale: 0.9 }}
              aria-label="Back"
              title="Back"
              className="group grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/[0.08] bg-white text-gray-700 shadow-sm transition-colors hover:border-[var(--gp)] hover:text-[var(--gp)] dark:border-white/[0.1] dark:bg-[#141416] dark:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </motion.button>
            <h1 className="min-w-0 text-[1.65rem] font-black leading-[1.05] tracking-[-0.02em] sm:text-4xl">
              Similar homes to <span className="text-[var(--gp)]">{streetOf(home.address)}</span>
            </h1>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400 sm:pl-[52px]">Tap any home for photos, details, a tour or a question. Prices, status and days on market update on their own.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:pb-1">
          <LiveIndicator checkedAt={data.live_at} className="min-w-0" />
          <span className="shrink-0 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--gp)]" style={{ backgroundColor: 'color-mix(in srgb, var(--gp) 12%, transparent)' }}>
            {homes.length} {homes.length === 1 ? 'home' : 'homes'}
          </span>
        </div>
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => {
          const key = listingKeyOf(p)
          const price = num(p.ListPrice, p.price)
          const sqft = num(p.LivingArea, p.sqft)
          const acres = num(p.LotSizeAcres, p.lotSizeAcres, p.lot_size_acres, p.acres) || (num(p.LotSizeSquareFeet, p.lotSizeSquareFeet, p.lot_size, p.lotSize) / 43560)
          const dom = p.DaysOnMarket ?? p.daysOnMarket ?? p.dom
          const stats = [
            { v: p.BedroomsTotal || p.beds || '-', l: 'Beds' },
            { v: p.BathroomsTotal || p.baths || '-', l: 'Baths' },
            { v: sqft ? sqft.toLocaleString() : '-', l: 'Sq Ft' },
            { v: acres > 0 ? acres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-', l: 'Acres' },
            { v: price && sqft ? `$${Math.round(price / sqft)}` : '-', l: '/ Sq Ft' },
            { v: p.YearBuilt || p.yearBuilt || p.year_built || '-', l: 'Built' },
          ]
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => onOpen(key)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              whileTap={{ scale: 0.98 }}
              className={`${teaser && i >= 3 ? 'hidden sm:block' : ''} group overflow-hidden rounded-[24px] border border-black/[0.06] bg-white text-left shadow-[0_14px_40px_-26px_rgba(0,0,0,0.45)] transition-colors hover:border-[var(--gp)] dark:border-white/[0.07] dark:bg-[#141416]`}
            >
              <div className="relative aspect-[16/11] overflow-hidden bg-gray-100 dark:bg-[#1c1c1f]">
                {(p.ListPictureURL || p.image) && (
                  <img src={img(p.ListPictureURL || p.image)} alt="" loading={i < 3 ? 'eager' : 'lazy'} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                )}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />
                {typeof p.matchScore === 'number' && (
                  <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white shadow">{p.matchScore}% Match</span>
                )}
                <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
                  {dom != null && <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black text-white ">{dom} DOM</span>}
                  {p.LiveStatus && <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-white shadow">{p.LiveStatus}</span>}
                  {p.PriceDrop > 0 && <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow">Price drop · {money(p.PriceDrop)}</span>}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                  <p className="text-2xl font-black tracking-tight">{money(price) || 'Price N/A'}</p>
                  <p className="truncate text-[13px] font-bold text-white/85">
                    {streetOf(p.FullStreetAddress || p.address)}{cityLine(p.City || p.city) ? `, ${cityLine(p.City || p.city)}` : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-6 divide-x divide-black/[0.05] py-3 dark:divide-white/[0.06]">
                {stats.map(s => (
                  <div key={s.l} className="flex flex-col items-center px-0.5">
                    <span className="text-[13px] font-black tracking-tight">{s.v}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider text-gray-400">{s.l}</span>
                  </div>
                ))}
              </div>
            </motion.button>
          )
        })}
        {teaser && moreAfter(3) > 0 && (
          <ShowcaseTeaser home={homes[3]} more={moreAfter(3)} data={data} onShowcase={onShowcase} building={buildingShowcase} className="sm:hidden" />
        )}
        {teaser && moreAfter(5) > 0 && (
          <ShowcaseTeaser home={homes[5]} more={moreAfter(5)} data={data} onShowcase={onShowcase} building={buildingShowcase} className="hidden sm:block" />
        )}
      </div>

      {data.showcase && (
        <div className="mt-8">
          <ShowcaseCta data={data} onShowcase={onShowcase} building={buildingShowcase} error={showcaseError} />
        </div>
      )}
    </div>
  )
}

// The faded last card (6th on wider screens, 4th on phones): the next home, greyed and blurred and
// fading out, with how many more are waiting - a nudge into the guest's own Showcase, where the
// rest of the homes live.
function ShowcaseTeaser({ home, more, data, onShowcase, building, className = '' }: {
  home: any; more: number; data: GuestPassData; onShowcase: () => void; building: boolean; className?: string
}) {
  const photo = home?.ListPictureURL || home?.image
  const has = !!data.showcase?.url
  return (
    <motion.button
      type="button"
      onClick={onShowcase}
      disabled={building}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.98 }}
      className={`${className} group relative text-left`}
    >
      <div aria-hidden className="pointer-events-none select-none overflow-hidden rounded-[24px] border border-black/[0.06] bg-white dark:border-white/[0.07] dark:bg-[#141416]"
        style={{ maskImage: 'linear-gradient(180deg, #000 45%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, #000 45%, transparent 100%)' }}>
        <div className="relative aspect-[16/11] overflow-hidden bg-gray-200 dark:bg-[#1c1c1f]">
          {photo && <img src={img(photo)} alt="" loading="lazy" className="h-full w-full scale-110 object-cover opacity-80 blur-[3px] grayscale transition duration-700 group-hover:blur-[2px] group-hover:grayscale-[50%]" />}
          <div className="absolute inset-0 bg-black/45" />
        </div>
        <div className="grid grid-cols-6 gap-2 px-3 py-4">
          {Array.from({ length: 6 }).map((_, k) => <span key={k} className="h-2.5 rounded-full bg-gray-200 dark:bg-white/10" />)}
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 flex aspect-[16/11] flex-col items-center justify-center px-5 text-center text-white">
        <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75">{possessive(data.guest.first_name)} Showcase</span>
        <span className="mt-1.5 text-[2.4rem] font-black leading-none tracking-tight">+{more}</span>
        <span className="mt-1 text-[13px] font-bold text-white/85">more similar {more === 1 ? 'home' : 'homes'} waiting</span>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#0B0B0B] shadow-lg transition-transform group-hover:-translate-y-0.5">
          {building ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building</> : <>{has ? 'See them all' : 'Unlock them'} <ArrowUpRight className="h-3.5 w-3.5" /></>}
        </span>
      </div>
    </motion.button>
  )
}
