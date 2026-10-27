'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe2, Loader2, MapPin, Plus, Trash2 } from 'lucide-react'
import api from '@/lib/api-service'
import { AgentMarketArea } from '@/types'
import { PopupPortal, useAnchoredStyle } from '@/components/ui/AnchoredPopup'

const STATUS_META: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Queued...', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
  RESEARCHING: { label: 'Researching...', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
  ENRICHED: { label: 'Ready', className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300' },
  PARTIAL: { label: 'Ready', className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300' },
  FAILED: { label: 'Couldn\'t research this town', className: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' },
}

type AddMode = 'city' | 'neighborhood'
const MAX_SERVED_AREAS = 15
const AREA_LIMIT_MESSAGE = 'You can add up to 15 cities, towns, neighborhoods, or market areas to your website.'

// Shared, reusable town records - the same Villanova, PA record every agent who serves it
// reuses, rather than each agent researching it from scratch (see backend
// area_enrichment_service.get_or_create_market_area). `onChange` fires after a successful add
// or remove - these mutate served-area rows directly server-side, outside the draft_data this
// panel's parent (WebsiteEditorShell) otherwise tracks, so the parent has no other way to know
// its live preview (which resolves the Communities block from these same rows) is now stale.
export default function AreasPanel({ onChange }: { onChange?: (what?: { added?: string; removed?: string }) => void }) {
  const [areas, setAreas] = useState<AgentMarketArea[]>([])
  const [loading, setLoading] = useState(true)
  // Two distinct add flows sharing name/state fields: 'city' is the original MLS-city-backed
  // autocomplete (unchanged). 'neighborhood' is for a named market with no formal municipal
  // boundary - Rittenhouse Square, Main Line, Fishtown - resolved server-side against Google
  // Places (canonical name + parent city + centroid) rather than matched against our own MLS
  // city list, since these places usually aren't a `Property.city` value at all.
  const [mode, setMode] = useState<AddMode>('city')
  const [name, setName] = useState('')
  const [state, setState] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Town suggestions as you type - same database-backed city search Showcase preferences use
  // (api.properties.cities), not Google, since these have to be real cities our MLS mirror knows
  // about. Results come back as "CITY NAME, ST" - split straight into the two fields below. Only
  // relevant in 'city' mode - a neighborhood name won't be in this list at all.
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  // The town list floats on top of the page under the box - on phones it slid behind the live
  // preview below this panel (owner, 10/26).
  const listOpen = mode === 'city' && showSuggestions && suggestions.length > 0
  const listStyle = useAnchoredStyle(nameInputRef, suggestionsRef, listOpen, { maxHeight: 240, gap: 4 })
  const selectedAreaCount = areas.length
  const atAreaLimit = selectedAreaCount >= MAX_SERVED_AREAS

  useEffect(() => {
    if (mode !== 'city' || atAreaLimit) {
      setSuggestions([])
      return
    }
    const query = name.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    const timeoutId = setTimeout(() => {
      api.properties.cities(query).then(res => {
        if (res.success && res.data) setSuggestions(res.data.results)
      })
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [name, mode, atAreaLimit])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
        nameInputRef.current && !nameInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectSuggestion = (raw: string) => {
    const [cityPart, statePart] = raw.split(',').map(s => s.trim())
    const titleCased = cityPart.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    setName(titleCased)
    setState((statePart || '').toUpperCase())
    setSuggestions([])
    setShowSuggestions(false)
  }

  const load = () => {
    api.sites.getAreas(true).then(res => {
      if (res.success && res.data) setAreas(res.data)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const hasPending = areas.some(a => a.area.enrichment_status === 'PENDING' || a.area.enrichment_status === 'RESEARCHING')
    if (hasPending && !pollRef.current) {
      // Also notifies the preview on each poll tick, not just on add/remove - a newly-added
      // area starts PENDING (no photo/facts yet) and the preview should pick up its real content
      // the moment enrichment finishes, not stay stuck on the placeholder until something else
      // happens to refresh it.
      pollRef.current = setInterval(() => { load(); onChange?.() }, 4000)
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas])

  const switchMode = (next: AddMode) => {
    setMode(next)
    setName('')
    setState('')
    setError(null)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleAdd = async () => {
    if (atAreaLimit) {
      setError(AREA_LIMIT_MESSAGE)
      return
    }
    const trimmedName = name.trim()
    const trimmedState = state.trim().toUpperCase()
    if (!trimmedName || trimmedState.length !== 2) {
      setError(mode === 'city' ? 'Enter a town name and 2-letter state (e.g. Villanova, PA).' : 'Enter a market/neighborhood name and 2-letter state (e.g. Rittenhouse Square, PA).')
      return
    }
    setAdding(true)
    setError(null)
    const res = await api.sites.addArea(trimmedName, trimmedState, mode)
    if (res.success) {
      setName('')
      setState('')
      load()
      onChange?.({ added: trimmedName })
    } else {
      setError(res.error || 'Could not add that area.')
    }
    setAdding(false)
  }

  const handleRemove = async (linkId: string) => {
    if (!confirm('Stop serving this area? Its community page will no longer appear on your site.')) return
    const gone = areas.find(a => a.id === linkId)?.area?.name
    await api.sites.removeArea(linkId)
    load()
    onChange?.({ removed: gone || 'that area' })
  }

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 dark:border-gray-800">
        <span className="text-xs font-black text-[#111827] dark:text-white">
          {selectedAreaCount} of {MAX_SERVED_AREAS} areas selected
        </span>
        <span className="text-[10px] font-semibold text-gray-400">
          {AREA_LIMIT_MESSAGE}
        </span>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {areas.map(link => {
            const meta = STATUS_META[link.area.enrichment_status] || STATUS_META.PENDING
            const displayName = link.area.parent_area_name
              ? `${link.area.name}, ${link.area.parent_area_name}`
              : link.area.name
            return (
              <div key={link.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 p-2.5 dark:border-gray-800">
                <div className="flex min-w-0 items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                  <span className="truncate text-sm font-bold text-[#111827] dark:text-white">{displayName}, {link.area.state}</span>
                  {link.area.area_type === 'neighborhood' && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Neighborhood
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${meta.className}`}>
                    {link.area.enrichment_status === 'PENDING' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    {meta.label}
                  </span>
                  <button onClick={() => handleRemove(link.id)} className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-[#0B0B0B]">
        <button
          onClick={() => switchMode('city')}
          disabled={atAreaLimit}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
            mode === 'city' ? 'bg-white text-[#111827] shadow-sm dark:bg-[#1A1A1C] dark:text-white' : 'text-gray-400'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          City / Town
        </button>
        <button
          onClick={() => switchMode('neighborhood')}
          disabled={atAreaLimit}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
            mode === 'neighborhood' ? 'bg-white text-[#111827] shadow-sm dark:bg-[#1A1A1C] dark:text-white' : 'text-gray-400'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          + Market Area / Neighborhood
        </button>
      </div>
      {atAreaLimit && (
        <p className="mt-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
          Remove an existing area to add another.
        </p>
      )}
      {mode === 'neighborhood' && (
        <p className="mt-1.5 text-[10px] font-semibold text-gray-400">
          For a named area that isn&apos;t its own city or town - e.g. Rittenhouse Square, Center City, Main Line, Fishtown.
        </p>
      )}

      <div className="mt-2 grid grid-cols-[1fr_60px_auto] items-center gap-2">
        <div className="relative">
          <input
            ref={nameInputRef}
            value={name}
            onChange={e => { setName(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={mode === 'city' ? 'Town name' : 'Rittenhouse Square, Main Line...'}
            autoComplete="off"
            disabled={atAreaLimit}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
          />
          {listOpen && (
            <PopupPortal from={nameInputRef}>
            <div
              ref={suggestionsRef}
              style={listStyle}
              className="overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]"
            >
              {suggestions.map(raw => (
                <div
                  key={raw}
                  onMouseDown={e => { e.preventDefault(); selectSuggestion(raw) }}
                  className="cursor-pointer px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-[#1A1A1C]"
                >
                  {raw.split(',').map(s => s.trim()).join(', ')}
                </div>
              ))}
            </div>
            </PopupPortal>
          )}
        </div>
        <input
          value={state}
          onChange={e => setState(e.target.value)}
          placeholder="PA"
          maxLength={2}
          disabled={atAreaLimit}
          className="rounded-xl border border-gray-200 px-2 py-2 text-sm uppercase outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white"
        />
        <button
          onClick={handleAdd}
          disabled={adding || atAreaLimit}
          aria-label="Add this area"
          title="Add this area"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-red-500">{error}</p>}
    </div>
  )
}
