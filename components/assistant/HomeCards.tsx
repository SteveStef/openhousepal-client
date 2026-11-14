'use client'

import { useMemo, useState } from 'react'
import { Bath, BedDouble, Home, Maximize } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import PropertyQuickViewModal from '@/components/PropertyQuickViewModal'
import type { HomeMove } from '@/components/PropertyDetailsModal'
import ChatPager from './ChatPager'

// Homes under a reply as real property cards (owner, 11/09: "combine these all on a nice property card"):
// photo with its Active / Pending / Sold, price, street address and beds / baths / size. Six at a time
// with pages (page 2 is a new page, not a longer list). Tapping one opens the home in the same window
// Showcases use, right over the chat, with Next / Previous through every home in the list.
export type ChatHome = {
  listing_key?: string | null; address: string; city?: string; price?: number | null; beds?: number | null; baths?: number | null
  sqft?: number | null; status?: string; date?: string | null; photo?: string | null
}

export const HOMES_PER_PAGE = 6

const money = (n?: number | null) => (n ? (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M` : `$${Math.round(n).toLocaleString()}`) : '')
const pillTone = (status?: string) => {
  const st = (status || '').toLowerCase()
  return st.includes('sold') || st.includes('closed') ? 'bg-red-600 text-white'
    : st.includes('pending') || st.includes('contract') ? 'bg-yellow-400 text-[#111827]'
    : st.includes('active') || st.includes('coming') ? 'bg-emerald-600 text-white'
    : 'bg-gray-700 text-white'
}

export default function HomeCards({ homes, title }: { homes: ChatHome[]; title?: string | null }) {
  const { user } = useAuth()
  const [page, setPage] = useState(0)
  const [viewing, setViewing] = useState<string | null>(null)
  const [move, setMove] = useState<HomeMove | null>(null)
  const pages = Math.max(1, Math.ceil(homes.length / HOMES_PER_PAGE))
  const shown = homes.slice(page * HOMES_PER_PAGE, (page + 1) * HOMES_PER_PAGE)
  const openable = useMemo(() => homes.filter(h => h.listing_key).map(h => String(h.listing_key)), [homes])
  const at = viewing ? openable.indexOf(viewing) : -1
  const go = (dir: 1 | -1) => {
    const next = openable[at + dir]
    if (!next) return
    setMove(m => ({ dir, kind: 'nav', seq: (m?.seq || 0) + 1 }))
    setViewing(next)
    // the page under the window follows along, so closing it lands on the home they were on
    const i = homes.findIndex(h => h.listing_key === next)
    if (i >= 0) setPage(Math.floor(i / HOMES_PER_PAGE))
  }
  const from = page * HOMES_PER_PAGE + 1
  const to = Math.min(homes.length, (page + 1) * HOMES_PER_PAGE)

  return (
    <div className="ohp-ai-card-in mt-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" data-testid="ai-home-cards">
      <div className="flex items-center gap-2 px-1 pb-2 pt-0.5">
        <p className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">
          {title || `${homes.length} home${homes.length === 1 ? '' : 's'}`}
        </p>
        {pages > 1 && <span className="shrink-0 text-[10.5px] font-bold text-gray-400" data-testid="ai-home-range">{from}-{to} of {homes.length}</span>}
      </div>
      <div key={page} className="grid grid-cols-2 gap-2 chatwide:grid-cols-3" data-testid="ai-home-page" data-page={page + 1}>
        {shown.map((h, i) => {
          const can = !!h.listing_key
          const facts = [
            h.beds != null && <span key="b" className="inline-flex items-center gap-0.5"><BedDouble className="h-3 w-3" />{h.beds}</span>,
            h.baths != null && <span key="t" className="inline-flex items-center gap-0.5"><Bath className="h-3 w-3" />{h.baths}</span>,
            h.sqft ? <span key="s" className="inline-flex items-center gap-0.5"><Maximize className="h-3 w-3" />{Number(h.sqft).toLocaleString()}</span> : null,
          ].filter(Boolean)
          return (
            <button key={`${h.listing_key || h.address}-${i}`} type="button" disabled={!can}
              onClick={() => { setMove(null); setViewing(String(h.listing_key)) }}
              className="ohp-ai-card-in group min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-[0_10px_24px_-20px_rgba(17,24,39,.7)] transition enabled:hover:-translate-y-0.5 enabled:hover:border-[#C9A24D]/50 disabled:cursor-default dark:border-zinc-800 dark:bg-zinc-950"
              style={{ ['--i' as string]: i }} data-testid="ai-home-card" data-key={h.listing_key || ''}>
              <span className="relative block aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-zinc-800">
                {h.photo
                  ? <img src={resolveMediaUrl(h.photo)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-enabled:group-hover:scale-[1.04]" />
                  : <span className="grid h-full w-full place-items-center text-gray-400"><Home className="h-6 w-6" /></span>}
                {h.status && (
                  <span className={`absolute left-1.5 top-1.5 max-w-[80%] truncate rounded-full px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wide shadow ${pillTone(h.status)}`}>{h.status}</span>
                )}
                {h.price ? (
                  <span className="absolute bottom-1.5 left-1.5 rounded-lg bg-[#111827]/85 px-2 py-0.5 text-[12px] font-black text-white">{money(h.price)}</span>
                ) : null}
              </span>
              <span className="block px-2 pb-2 pt-1.5">
                <span className="block truncate text-[12.5px] font-black text-[#111827] dark:text-white" data-testid="ai-home-address">{h.address}</span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[10.5px] font-bold text-gray-500 dark:text-zinc-400">
                  {h.city && <span className="hidden min-w-0 truncate chatwide:inline">{h.city}</span>}
                  {facts}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <ChatPager page={page} pages={pages} onPage={setPage} testid="ai-home-pager" />
      {user && (
        <PropertyQuickViewModal listingKey={viewing} agentId={user.id} onClose={() => setViewing(null)} move={move}
          nav={viewing && openable.length > 1 ? { index: at, total: openable.length, onPrev: at > 0 ? () => go(-1) : null, onNext: at < openable.length - 1 ? () => go(1) : null } : null} />
      )}
    </div>
  )
}
