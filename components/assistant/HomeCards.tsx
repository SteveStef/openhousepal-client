'use client'

import { useState } from 'react'
import { Home } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'

// Their own listings / sales under a reply as small cards (owner, 11/01, second pass: "all we need to
// show is the street address" and its Active / Pending / Sold on the little photo, top middle - like the
// Opens address search). A long list shows the newest five; "+N more" opens five more at a time.
export type ChatHome = {
  listing_key?: string | null; address: string; city?: string; price?: number | null; beds?: number | null; baths?: number | null
  sqft?: number | null; status?: string; date?: string | null; photo?: string | null
}

const STEP = 5

export default function HomeCards({ homes, title }: { homes: ChatHome[]; title?: string | null }) {
  const [shown, setShown] = useState(STEP)
  const left = homes.length - shown
  return (
    <div className="mt-2 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" data-testid="ai-home-cards">
      {title && <p className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] dark:text-[#C9A24D]">{title}</p>}
      <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
        {homes.slice(0, shown).map((h, i) => {
          const st = (h.status || '').toLowerCase()
          const pill = st.includes('sold') || st.includes('closed') ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-600 dark:text-white dark:border-red-400'
            : st.includes('pending') || st.includes('contract') ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500 dark:text-[#111827] dark:border-yellow-300'
            : st.includes('active') || st.includes('coming') ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-600 dark:text-white dark:border-emerald-400'
            : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-700 dark:text-white dark:border-zinc-500'
          return (
            <li key={`${h.listing_key || h.address}-${i}`} className="ohp-ai-card-in flex items-center gap-3 px-1.5 py-1.5" style={{ ['--i' as string]: i % STEP }} data-testid="ai-home-card">
              <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5 dark:bg-zinc-800">
                {h.photo
                  ? <img src={resolveMediaUrl(h.photo)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  : <span className="grid h-full w-full place-items-center text-gray-400"><Home className="h-4 w-4" /></span>}
                {h.status && (
                  <span className="absolute inset-x-0 top-1 flex justify-center px-1">
                    <span className={`max-w-full truncate rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase leading-none shadow-sm ${pill}`}>{h.status}</span>
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#111827] dark:text-white">{h.address}</span>
            </li>
          )
        })}
      </ul>
      {homes.length > STEP && (
        <button type="button" onClick={() => setShown(s => (left > 0 ? s + STEP : STEP))} data-testid="ai-home-more"
          className="ohp-ai-press mt-1 w-full rounded-xl py-1.5 text-[11.5px] font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#e8c97a]">
          {left > 0 ? `+${left} more` : 'Show fewer'}
        </button>
      )}
    </div>
  )
}
