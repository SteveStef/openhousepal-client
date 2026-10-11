'use client'

import { useEffect, useRef, useState } from 'react'
import { Home, MapPin } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'

type Suggestion = { address: string; price?: number | null; status?: string | null; photo?: string | null; mine?: boolean }

// "Which home would you like to see?" (Schedule a Showing): as the visitor types, suggestions from
// every on-market MLS listing - buyers ask about other agents' listings all the time - with the
// agent's own listings first. Picking one fills in the exact address; typing anything else still
// works (an off-market home, a FSBO, "the blue house on Oak").
export default function ListingAddressInput({ value, onChange, formId, className = '', placeholder = 'Start typing an address...', accent = '#C9A24D', id }: {
  value: string
  onChange: (next: string) => void
  formId?: string
  className?: string
  placeholder?: string
  accent?: string
  id?: string
}) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const picked = useRef<string | null>(null)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 2 || q === picked.current) { setItems([]); return }
    let cancelled = false
    const t = window.setTimeout(async () => {
      const r = await api.properties.addressesPublic(q, formId)
      if (cancelled) return
      const list = r.success && r.data ? r.data.results : []
      setItems(list)
      setHi(-1)
      setOpen(list.length > 0)
    }, 220)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [value, formId])

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const choose = (s: Suggestion) => {
    picked.current = s.address
    onChange(s.address)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={e => { picked.current = null; onChange(e.target.value) }}
        onFocus={() => items.length && setOpen(true)}
        onKeyDown={e => {
          if (!open || !items.length) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, items.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, -1)) }
          else if (e.key === 'Escape') { setOpen(false) }
          else if (e.key === 'Enter' && hi >= 0) {
            // Picks the suggestion - must not also reach the form's "Enter = next question".
            e.preventDefault(); e.stopPropagation(); choose(items[hi])
          }
        }}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && items.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-1.5 text-left shadow-[0_24px_50px_-20px_rgba(17,24,39,.35)] dark:border-gray-700 dark:bg-[#151517]">
          {items.map((s, i) => (
            <li key={s.address} role="option" aria-selected={i === hi}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); choose(s) }}
                onMouseEnter={() => setHi(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${i === hi ? 'bg-gray-100 dark:bg-white/[0.06]' : ''}`}
              >
                <span className="grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-gray-100 dark:bg-white/[0.06]">
                  {s.photo ? <img src={resolveMediaUrl(s.photo) || s.photo} alt="" className="h-full w-full object-cover" /> : <Home className="h-4 w-4 text-gray-400" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#111827] dark:text-white">{s.address}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {s.price ? <span>${Math.round(s.price).toLocaleString()}</span> : null}
                    {s.mine && <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white" style={{ backgroundColor: accent }}>My listing</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-semibold text-gray-400"><MapPin className="h-3 w-3" /> Not listed here? Just type the address.</li>
        </ul>
      )}
    </div>
  )
}
