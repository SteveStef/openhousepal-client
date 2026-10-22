'use client'

// CMA step 1 "Search Address" box (10/21 rebuild). The old box searched the typed text as one
// substring with a 350ms wait and no index, so "1420 Locust #23H" (stored "1420 LOCUST ST #23H")
// never came up and each keystroke took 1-3 seconds. This one calls GET
// /api/properties/address/search (backend address_search_service.py), which understands unit
// numbers in any format, St/Street spellings and a town/ZIP after the street, returns one row per
// home with its listing key, and answers in a few milliseconds.
//
// - waits 220ms after the last keystroke; a slower, older answer never replaces a newer one
// - the last list stays up while the next one loads (no flicker); a spinner shows in the box
// - arrow keys / Enter / Escape; the list closes on click-away
// - a home whose only listings are rentals shows greyed: "Rental listing - a CMA values a sale"

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Home, Loader2, Search } from 'lucide-react'
import api, { type HomeSearchResult } from '@/lib/api-service'
import { formatMlsStatusLabel, formatMoney } from '@/lib/cma'
import { normalizeImageUrl } from '@/lib/utils'

const DEBOUNCE_MS = 220
const MIN_CHARS = 3

function badgeClass(status?: string | null): string {
  const label = formatMlsStatusLabel(status)
  if (label === 'Sold') return 'bg-red-600'
  if (label === 'Active' || label === 'Coming Soon') return 'bg-emerald-600'
  if (label === 'Pending' || label === 'Active Under Contract') return 'bg-amber-500'
  return 'bg-gray-500'
}

function soldWhen(date?: string | null): string {
  if (!date) return ''
  const d = new Date(`${date.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

/** Worth asking the server: 3+ characters with a street word, or a house number of 3+ digits. */
export function searchable(q: string): boolean {
  const t = q.trim()
  if (t.length < MIN_CHARS) return false
  return /[a-z]{2,}/i.test(t) || /^\d{3,}/.test(t)
}

export default function SubjectAddressSearch({ onPick, onEnterManually, autoFocus, placeholder = 'Start typing an address...' }: {
  /** Load the picked home as the subject (the parent fetches the full Bright record by listingKey). */
  onPick: (home: HomeSearchResult) => Promise<unknown> | unknown
  /** Shown when nothing matches: switch to Enter Manually with what they typed. */
  onEnterManually?: (typed: string) => void
  autoFocus?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HomeSearchResult[]>([])
  const [resultsFor, setResultsFor] = useState('')   // the query the visible list answers
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [picking, setPicking] = useState<string | null>(null)
  const seq = useRef(0)
  const cache = useRef(new Map<string, HomeSearchResult[]>())
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const firstSelectable = (rows: HomeSearchResult[]) => rows.findIndex(r => r.selectable)

  const show = useCallback((q: string, rows: HomeSearchResult[]) => {
    setResults(rows)
    setResultsFor(q)
    setActive(firstSelectable(rows))
  }, [])

  useEffect(() => {
    const q = query.trim().replace(/\s+/g, ' ')
    if (!searchable(q)) {
      seq.current++            // anything still in flight is now stale
      setLoading(false)
      setFailed(false)
      setResults([])
      setResultsFor('')
      return
    }
    const key = q.toLowerCase()
    const hit = cache.current.get(key)
    if (hit) {                 // backspacing over something already searched: instant
      seq.current++
      setLoading(false)
      setFailed(false)
      show(q, hit)
      return
    }
    const mine = ++seq.current
    setLoading(true)
    const t = setTimeout(async () => {
      const r = await api.properties.searchHomes(q, { limit: 8 })
      if (mine !== seq.current) return   // a newer keystroke owns the list now
      setLoading(false)
      if (r.success && r.data) {
        const rows = r.data.results || []
        cache.current.set(key, rows)
        if (cache.current.size > 60) cache.current.delete(cache.current.keys().next().value as string)
        setFailed(false)
        show(q, rows)
      } else {
        setFailed(true)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, show])

  // Click-away closes the list.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const pick = async (home: HomeSearchResult) => {
    if (!home.selectable || picking) return
    setPicking(home.listingKey)
    try {
      await onPick(home)
      setOpen(false)
    } finally {
      setPicking(null)
    }
  }

  const move = (dir: 1 | -1) => {
    if (!results.length) return
    let i = active
    for (let n = 0; n < results.length; n++) {
      i = (i + dir + results.length) % results.length
      if (results[i].selectable) { setActive(i); return }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); move(-1) }
    else if (e.key === 'Enter') {
      if (open && active >= 0 && results[active]) { e.preventDefault(); pick(results[active]) }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setOpen(false) }
    }
  }

  const typed = query.trim()
  const settled = !loading && searchable(typed) && resultsFor.toLowerCase() === typed.replace(/\s+/g, ' ').toLowerCase()
  const showList = open && searchable(typed) && (results.length > 0 || settled || failed)

  return (
    <div ref={boxRef} className="relative mt-4">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-10 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-label="Searching" />}

      {showList && (
        <div
          id={listId}
          role="listbox"
          className={`absolute z-20 mt-1 max-h-[26rem] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl transition-opacity dark:border-gray-800 dark:bg-[#151517] ${loading && results.length ? 'opacity-70' : 'opacity-100'}`}
        >
          {results.map((s, i) => {
            const sold = s.statusTier === 'sold'
            const price = s.price ?? s.listPrice
            const facts = [s.beds != null ? `${s.beds} bd` : '', s.baths != null ? `${s.baths} ba` : '', s.sqft ? `${Math.round(s.sqft).toLocaleString()} sqft` : ''].filter(Boolean).join(' · ')
            const place = [s.city, [s.state, s.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
            return (
              <button
                key={s.listingKey}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                aria-disabled={!s.selectable}
                disabled={!s.selectable}
                onMouseDown={e => e.preventDefault()}  // keep focus in the box
                onMouseEnter={() => s.selectable && setActive(i)}
                onClick={() => pick(s)}
                className={`flex w-full items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left last:border-0 dark:border-gray-800 ${
                  !s.selectable ? 'cursor-not-allowed opacity-55' : i === active ? 'bg-[#C9A24D]/10' : 'hover:bg-[#C9A24D]/10'
                }`}
              >
                <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                  {s.image
                    ? <img src={normalizeImageUrl(s.image)} alt="" loading="lazy" className={`h-full w-full object-cover ${!s.selectable ? 'grayscale' : ''}`} />
                    : <div className="flex h-full w-full items-center justify-center"><Home className="h-4 w-4 text-gray-300" /></div>}
                  {s.status && (
                    <div className="absolute inset-x-0 bottom-1 flex justify-center px-1">
                      <span className={`max-w-full truncate rounded-full px-1.5 py-0.5 text-[7px] font-black uppercase leading-none text-white shadow-sm ${s.isRental ? 'bg-gray-500' : badgeClass(s.status)}`}>
                        {s.isRental ? 'Rental' : formatMlsStatusLabel(s.status)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#111827] dark:text-white">{s.street}</p>
                  <p className="truncate text-[11px] font-semibold text-gray-500 dark:text-gray-400">{place}{facts ? ` · ${facts}` : ''}</p>
                  {s.note ? (
                    <p className="mt-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">{s.note}</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {price ? (
                        <span className="inline-flex items-center rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-2 py-0.5 text-[10px] font-black text-[#8b7355] dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/15 dark:text-[#d7b974]">
                          {sold ? `Sold ${formatMoney(price)}${soldWhen(s.closeDate) ? ` · ${soldWhen(s.closeDate)}` : ''}` : formatMoney(price)}
                        </span>
                      ) : null}
                      {s.otherRecords > 0 && (
                        <span className="text-[10px] font-semibold text-gray-400">+{s.otherRecords} other listing{s.otherRecords === 1 ? '' : 's'} of this home</span>
                      )}
                    </div>
                  )}
                </div>
                {picking === s.listingKey && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#C9A24D]" />}
              </button>
            )
          })}

          {results.length === 0 && (
            <div className="px-3 py-3 text-sm">
              <p className="font-semibold text-gray-600 dark:text-gray-300">
                {failed ? 'Search is not answering right now - try again in a moment.' : 'No homes on the MLS match that address.'}
              </p>
              {!failed && <p className="mt-0.5 text-[11px] text-gray-400">Try just the house number and street, e.g. &quot;1420 Locust&quot;.</p>}
              {onEnterManually && !failed && (
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => onEnterManually(typed)}
                  className="mt-2 text-[12px] font-black text-[#8b7355] underline-offset-2 hover:underline dark:text-[#d7b974]"
                >
                  Not on the MLS? Enter it manually
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
