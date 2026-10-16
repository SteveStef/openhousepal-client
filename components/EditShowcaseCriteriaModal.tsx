'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { backdropMotion, panelMotion, useEscapeToClose } from '@/components/ui/windowMotion'
import {
  X, Send, CheckCircle2, Mail, Phone, Search, MapPin, Copy, Check, Crosshair, DollarSign, BedDouble, Bath,
  Scale, SlidersHorizontal, MessageSquareText, Sparkles, Loader2, Target, ArrowRight, Home, Ruler, RotateCcw,
} from 'lucide-react'
import { CollectionPreferences } from '@/types'
import GooglePlacesAutocomplete, { GooglePlacesAutocompleteRef } from './GooglePlacesAutocomplete'
import MultiSelectDatabaseInput from './MultiSelectDatabaseInput'
import api from '@/lib/api-service'
import { formatNumberWithCommas, stripCommas } from '@/lib/utils'
import { copyText } from '@/lib/copyText'

// Visitor-facing "refine my search" for a public showcase - a deliberately narrow subset of
// EditPreferencesModal.tsx (the agent-side equivalent in Studio) for what a visitor can actually
// EDIT themselves (address/radius, price, beds/baths, towns, school districts) - property type
// flags, townships, and special features stay agent-only to change, but ARE shown read-only below
// so the visitor can see the complete picture of what's being searched, not just their own slice.
//
// Three ways in (`focus`):
//   - 'all'     the full Refine menu (Edit it myself / Ask my agent)
//   - 'compare' a small window that only asks "compare my matches to which home?"
//   - 'radius'  a small window that only asks "how far from the address?"
// All three save through the same handleSave, so the rules below hold everywhere.
//
// Address is never required here. A showcase can be entirely area-based (agent picked cities/
// townships/school districts, no address at all) - forcing an address before ANY save would make
// it impossible for a visitor to refine an area-based showcase at all. Towns/school districts are
// mutually exclusive with address, same rule EditPreferencesModal enforces agent-side.
interface EditShowcaseCriteriaModalProps {
  preferences: CollectionPreferences | null
  isOpen: boolean
  onClose: () => void
  /** Saves; may report how the matches changed so the window can say "+6 new · 3 gone". */
  onSave: (preferences: Partial<CollectionPreferences>) => Promise<void | SaveOutcome>
  /** Live, unsaved count + positions of what the window's current settings would match. */
  preview?: (preferences: Partial<CollectionPreferences>) => Promise<MatchPreview | null>
  // Optional - lets a visitor send a free-text message to their agent instead of editing the
  // criteria form themselves. Omitted entirely (e.g. no known collection yet) hides that tab.
  onSendMessage?: (message: string) => Promise<void>
  agent?: { name?: string | null; email?: string | null; phone?: string | null; photoUrl?: string | null }
  // Whatever property the showcase is actually comparing its matches against right now - an
  // explicit override (preferences.compare_property_listing_key) if one is set, otherwise the
  // implicit open-house property it was auto-created from.
  // touredListingKey = the open house home they actually toured (null when the Showcase didn't
  // come from one) - the home card only says "The home you toured" for that one.
  currentCompareProperty?: { listingKey?: string | null; touredListingKey?: string | null; address?: string | null; city?: string | null; state?: string | null; image?: string | null } | null
  // Whether currentCompareProperty is an explicit override vs. just the implicit open-house
  // default - changes what clearing it actually does (see handleSave).
  hasExplicitCompareOverride?: boolean
  /** Which question this window asks - see the top of the file. */
  focus?: 'all' | 'compare' | 'radius'
  /** "Refine my search further" at the bottom of the compare / radius windows - the visitor's full
   *  Refine menu, or (agent) the full search editor. */
  onRefineFurther?: () => void
  /** Who's editing: the buyer ("your search") or their agent (the agent's own Showcase view). */
  audience?: 'client' | 'agent'
}

export type SaveOutcome = { added: number; removed: number }
export type MatchPreview = { count: number; points: { id: string; lat: number; lng: number }[] }

type FormState = Pick<CollectionPreferences,
  'address' | 'lat' | 'long' | 'diameter' | 'min_price' | 'max_price' | 'min_beds' | 'max_beds' | 'min_baths' | 'max_baths' | 'cities' | 'school_districts'>

const EMPTY_FORM: FormState = {
  address: '', lat: null, long: null, diameter: null,
  min_price: null, max_price: null, min_beds: null, max_beds: null, min_baths: null, max_baths: null,
  cities: [], school_districts: [],
}

type Suggestion = { listingKey: string; address: string; city?: string | null; lat: number; lng: number; image?: string | null; price?: number | null; beds?: number | null; baths?: number | null; squareFeet?: number | null }

const RADII = [0.5, 1, 2, 3, 5, 10, 15]
const BEDS = [null, 1, 2, 3, 4, 5]
const BATHS = [null, 1, 1.5, 2, 3, 4]
// Dots on the distance picker: never more than this, and always the same ones for the same homes.
const MAX_DOTS = 24
const dotRank = (id: string) => { let h = 2166136261; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const fmtMi = (n?: number | null) => (n == null ? '' : `${Number.isInteger(n) ? n : n.toFixed(1)} mi`)

const GOLD_CSS = `
.rf-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);background-size:200% 100%;animation:rfEdge 6s ease-in-out infinite}
@keyframes rfEdge{0%{background-position:150% 0}100%{background-position:-50% 0}}
.rf-spark{width:4px;height:4px;border-radius:999px;background:#e8c97a;box-shadow:0 0 10px 2px #e8c97a;opacity:0;animation:rfSpark 7s ease-in-out infinite}
@keyframes rfSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-14px) scale(1)}100%{opacity:0;transform:translateY(-50px) scale(.5)}}
.rf-shine{position:relative;overflow:hidden}
.rf-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);transform:translateX(-100%);animation:rfShine 3.4s ease-in-out infinite}
@keyframes rfShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.rf-pulse{animation:rfPulse 2.4s ease-out infinite}
@keyframes rfPulse{0%{transform:scale(.6);opacity:.55}100%{transform:scale(1.25);opacity:0}}
.rf-aurora{position:absolute;inset:-40%;background:radial-gradient(35% 45% at 20% 30%,rgba(201,162,77,.38),transparent 70%),radial-gradient(30% 40% at 80% 20%,rgba(232,201,122,.22),transparent 70%),radial-gradient(40% 50% at 60% 90%,rgba(120,90,40,.35),transparent 70%);animation:rfAurora 14s ease-in-out infinite alternate;z-index:-1}
@keyframes rfAurora{0%{transform:translate(-4%,-2%) rotate(0deg)}100%{transform:translate(5%,4%) rotate(8deg)}}
.rf-ring{position:absolute;inset:-3px;border-radius:18px;background:conic-gradient(from 0deg,transparent,#e8c97a,transparent 40%);animation:rfSpin 3.2s linear infinite;z-index:-1}
@keyframes rfSpin{to{transform:rotate(360deg)}}
.rf-radar{background:conic-gradient(from 0deg,rgba(201,162,77,.0),rgba(201,162,77,.32) 18%,rgba(201,162,77,0) 22%);animation:rfSpin 4.5s linear infinite}
.ys-range{position:absolute;inset:0;width:100%;height:100%;margin:0;background:transparent;-webkit-appearance:none;appearance:none;pointer-events:none}
.ys-range::-webkit-slider-runnable-track{background:transparent;height:100%}
.ys-range::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:24px;height:24px;margin-top:2px;border-radius:999px;background:#fff;border:3px solid #C9A24D;box-shadow:0 3px 8px rgba(0,0,0,.25);cursor:grab}
.ys-range::-moz-range-track{background:transparent}
.ys-range::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:999px;background:#fff;border:3px solid #C9A24D;box-shadow:0 3px 8px rgba(0,0,0,.25);cursor:grab}
.ys-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 5px rgba(201,162,77,.3)}
.rf-lift{transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s}
.rf-lift:hover{transform:translateY(-2px);box-shadow:0 22px 40px -28px rgba(17,24,39,.55)}
@media (prefers-reduced-motion:reduce){.rf-edge,.rf-spark,.rf-shine:after,.rf-pulse,.rf-aurora,.rf-ring,.rf-radar{animation:none}}
`

// The window's body eases to the height of whatever screen is showing (one element animates its
// height - no scaling, no blur), so moving between screens never jumps.
function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | 'auto'>('auto')
  // Clip only while the height moves - at rest a dropdown (school districts, towns) near the bottom
  // must be able to spill past the edge, or it gets cut off. Set on the element directly (a state
  // change here would re-render the whole window mid-animation and drop frames).
  const outer = useRef<HTMLDivElement>(null)
  const clip = (on: boolean) => { if (outer.current) outer.current.style.overflow = on ? 'hidden' : 'visible' }
  useEffect(() => {
    const el = inner.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <motion.div ref={outer} animate={{ height: h }} initial={false} transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }}
      onAnimationStart={() => clip(true)} onAnimationComplete={() => clip(false)} style={{ overflow: 'visible' }}>
      <div ref={inner} className="relative">{children}</div>
    </motion.div>
  )
}

const SCREEN_DEPTH: Record<string, number> = { choose: 0, edit: 1, ask: 1, pick: 2 }
// Screens slide + fade (transform and opacity only - smooth on phones, no blur).
const screenSlide = {
  enter: (dir: number) => ({ x: dir * 44, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.8 } },
  exit: (dir: number) => ({ x: dir * -44, opacity: 0, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] as const } }),
}

function EditShowcaseCriteriaWindow({ preferences, onClose, onSave, onSendMessage, agent, currentCompareProperty, hasExplicitCompareOverride, focus = 'all', onRefineFurther, audience = 'client', preview }: EditShowcaseCriteriaModalProps) {
  const their = audience === 'agent' ? 'their' : 'your'
  useEscapeToClose(onClose)
  const googleAutocompleteRef = useRef<GooglePlacesAutocompleteRef>(null)
  const [formData, setFormData] = useState<FormState>(() => ({
    address: preferences?.address || '',
    lat: preferences?.lat ?? null,
    long: preferences?.long ?? null,
    diameter: preferences?.diameter ?? null,
    min_price: preferences?.min_price ?? null,
    max_price: preferences?.max_price ?? null,
    min_beds: preferences?.min_beds ?? null,
    max_beds: preferences?.max_beds ?? null,
    min_baths: preferences?.min_baths ?? null,
    max_baths: preferences?.max_baths ?? null,
    cities: preferences?.cities || [],
    school_districts: preferences?.school_districts || [],
  } as FormState))
  const savedFormRef = useRef(formData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'edit' | 'ask'>('edit')
  const [askMessage, setAskMessage] = useState('')
  const [isSendingAsk, setIsSendingAsk] = useState(false)
  const [askSent, setAskSent] = useState(false)
  const [copiedAgentField, setCopiedAgentField] = useState<'phone' | 'email' | null>(null)

  // "Compare to a different property" - the visitor picks a new subject property to measure their
  // matches against (and re-centers the search there too), as if the showcase had been
  // auto-created from signing in at THAT property's open house instead.
  const [compareQuery, setCompareQuery] = useState('')
  const [compareSuggestions, setCompareSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedCompareProperty, setSelectedCompareProperty] = useState<{ listingKey: string; address: string; city?: string | null; image?: string | null; lat?: number; lng?: number; price?: number | null; beds?: number | null } | null>(
    () => (currentCompareProperty?.address ? { listingKey: currentCompareProperty.listingKey || '', address: currentCompareProperty.address, city: currentCompareProperty.city, image: currentCompareProperty.image } : null)
  )
  const [changingCompare, setChangingCompare] = useState(false)
  // Guests: picking "a different home" open.
  const [switchingHome, setSwitchingHome] = useState(false)
  const compareSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!compareQuery.trim() || compareQuery.trim().length < 3) { setCompareSuggestions([]); setSearching(false); return }
    setSearching(true)
    if (compareSearchTimer.current) clearTimeout(compareSearchTimer.current)
    compareSearchTimer.current = setTimeout(async () => {
      const { success, data } = await api.properties.addressPublic(compareQuery)
      if (success && data) setCompareSuggestions(data.results || [])
      setSearching(false)
    }, 300)
    return () => { if (compareSearchTimer.current) clearTimeout(compareSearchTimer.current) }
  }, [compareQuery])

  // Live preview of what these settings would match (debounced) - drives the count and the dots.
  const [live, setLive] = useState<MatchPreview | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const previewKey = JSON.stringify([formData, selectedCompareProperty?.listingKey])
  useEffect(() => {
    if (!preview) return
    let alive = true
    setLiveLoading(true)
    const t = window.setTimeout(async () => {
      const res = await preview({ ...formData }).catch(() => null)
      if (!alive) return
      if (res) setLive(res)
      setLiveLoading(false)
    }, 380)
    return () => { alive = false; window.clearTimeout(t) }
  }, [previewKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyAgentField = async (field: 'phone' | 'email', value: string) => {
    try {
      await copyText(value)
      setCopiedAgentField(field)
      setTimeout(() => setCopiedAgentField(current => (current === field ? null : current)), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleSelectCompareProperty = (p: Suggestion) => {
    if (audience !== 'agent') { applyHome(p); return }
    setSelectedCompareProperty({ listingKey: p.listingKey, address: p.address, city: p.city, image: p.image, lat: p.lat, lng: p.lng, price: p.price, beds: p.beds })
    // Re-centers the search on this property too - "compare to X" without also searching near X
    // would leave the matches unrelated to what's actually being compared against.
    setFormData(prev => ({
      ...prev,
      address: p.address,
      lat: p.lat,
      long: p.lng,
      diameter: prev.diameter && prev.diameter > 0 ? prev.diameter : 2,
      cities: [],
      school_districts: [],
    }))
    setCompareQuery('')
    setCompareSuggestions([])
    setChangingCompare(false)
  }

  // "Rebuild my search around this home" - the same starting search an open house sign-in builds
  // (collection_preferences_service): 6 mi around it, price within 20% either way, one bedroom
  // fewer and up. Nothing is saved until Save; Undo puts the previous search back.
  const [rebuilt, setRebuilt] = useState<{ prev: FormState; summary: string } | 'busy' | null>(null)
  useEffect(() => { setRebuilt(null) }, [selectedCompareProperty?.listingKey])

  const rebuildAround = async () => {
    const sel = selectedCompareProperty
    if (!sel) return
    setError('')
    let home: { lat?: number; lng?: number; price?: number | null; beds?: number | null; address: string } = sel
    if (home.price == null || home.lat == null || home.lng == null) {
      setRebuilt('busy')
      const { success, data } = await api.properties.addressPublic(sel.address).catch(() => ({ success: false, data: null }))
      const results: Suggestion[] = (success && data?.results) || []
      const hit = results.find(r => r.listingKey && r.listingKey === sel.listingKey) || results[0]
      if (hit) home = { ...home, lat: hit.lat, lng: hit.lng, price: hit.price, beds: hit.beds, address: hit.address || home.address }
    }
    if (home.lat == null || home.lng == null) {
      setRebuilt(null)
      setError("Couldn't find this home's details to rebuild from - try picking it again.")
      return
    }
    const round5k = (n: number) => Math.round(n / 5000) * 5000
    const next: FormState = {
      ...EMPTY_FORM,
      address: home.address,
      lat: home.lat,
      long: home.lng,
      diameter: 6,
      min_price: home.price ? round5k(home.price * 0.8) : null,
      max_price: home.price ? round5k(home.price * 1.2) : null,
      min_beds: home.beds && home.beds > 1 ? home.beds - 1 : null,
    }
    const k = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 0).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}k`)
    const summary = [
      next.min_price && next.max_price ? `${k(next.min_price)} – ${k(next.max_price)}` : '',
      next.min_beds ? `${next.min_beds}+ beds` : '',
      'Within 6 mi',
    ].filter(Boolean).join(' · ')
    setRebuilt({ prev: formData, summary })
    setFormData(next)
  }

  // ── The buyer's one "Your search" window: the home they toured (fixed - their agent changes it),
  // how far from it, price, bedrooms, and "more options". These hold its own bits of state.
  const [anchor, setAnchor] = useState<{ price?: number | null; beds?: number | null; lat?: number | null; lng?: number | null } | null>(null)
  const [customPrice, setCustomPrice] = useState(false)
  // The guest price slider's top end, fixed the first time it's known so the handles never jump
  // when the toured home's details finish loading.
  const priceScaleRef = useRef<number | null>(null)
  const [startedOver, setStartedOver] = useState<FormState | null>(null)
  // The buyer's window starts on one simple question ("what do you want to do?"), then shows just
  // that: their filters, a home picker, or a note to their agent. The small windows opened from a
  // specific line (compare / radius) go straight to the filters.
  const [step, setStep] = useState<'choose' | 'edit' | 'pick'>(audience !== 'agent' && focus === 'all' ? 'choose' : 'edit')
  const [pickFrom, setPickFrom] = useState<'choose' | 'edit'>('choose')
  const openPicker = (from: 'choose' | 'edit') => { setPickFrom(from); setStep('pick'); setError('') }
  const pickedHomeRef = useRef(false)   // picking a home moves forward to the filters
  const prevScreenRef = useRef<string>(audience !== 'agent' && focus === 'all' ? 'choose' : 'edit')
  const screenDirRef = useRef(1)
  // "Stop using a home": the search becomes just their filters (in the home's own town to start).
  // Nothing saves until Save; Undo puts the home back.
  const [removedHome, setRemovedHome] = useState<{ form: FormState; home: { listingKey: string; address: string; city?: string | null; image?: string | null; lat?: number; lng?: number; price?: number | null; beds?: number | null } | null; anchor: { price?: number | null; beds?: number | null; lat?: number | null; lng?: number | null } | null } | null>(null)
  useEffect(() => {
    if (audience === 'agent' || !currentCompareProperty?.address) return
    let alive = true
    api.properties.addressPublic(currentCompareProperty.address).then(({ success, data }) => {
      if (!alive || !success) return
      const results: Suggestion[] = data?.results || []
      const hit = results.find(r => r.listingKey && r.listingKey === currentCompareProperty.listingKey) || results[0]
      if (hit) { setAnchor({ price: hit.price, beds: hit.beds, lat: hit.lat, lng: hit.lng }); savedAnchorRef.current = { price: hit.price, beds: hit.beds, lat: hit.lat, lng: hit.lng } }
    }).catch(() => {})
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const undoRebuild = () => {
    if (rebuilt && rebuilt !== 'busy') setFormData(rebuilt.prev)
    setRebuilt(null)
  }

  // Guests' one way to change the home: pick any home and the search starts over around it exactly
  // like an open house sign-in there would (6 mi, price +-20%, one bedroom fewer and up) - and the
  // match % is measured against it too. Nothing saves until Save; Undo puts everything back.
  const [homeSwap, setHomeSwap] = useState<{ form: FormState; home: typeof selectedCompareProperty; anchor: typeof anchor } | null>(null)
  const applyHome = (p: Suggestion) => {
    const round5k = (n: number) => Math.round(n / 5000) * 5000
    setHomeSwap(prev => prev ?? { form: formData, home: selectedCompareProperty, anchor })
    setSelectedCompareProperty({ listingKey: p.listingKey, address: p.address, city: p.city, image: p.image, lat: p.lat, lng: p.lng, price: p.price, beds: p.beds })
    setAnchor({ price: p.price, beds: p.beds, lat: p.lat, lng: p.lng })
    priceScaleRef.current = null
    setCustomPrice(false)
    setStartedOver(null)
    setFormData({
      ...EMPTY_FORM, address: p.address, lat: p.lat, long: p.lng, diameter: 6,
      min_price: p.price ? round5k(p.price * 0.8) : null, max_price: p.price ? round5k(p.price * 1.2) : null,
      // One fewer and up, like a sign-in - capped at 5+, the highest choice guests can pick.
      min_beds: p.beds && p.beds > 1 ? Math.min(p.beds - 1, 5) : null,
    })
    setSwitchingHome(false)
    setCompareQuery('')
    setCompareSuggestions([])
    if (removedHome) { setHomeSwap(prev => prev && { ...prev, form: removedHome.form, home: removedHome.home, anchor: removedHome.anchor }); setRemovedHome(null) }
    pickedHomeRef.current = true
    setStep('edit')
  }
  const savedHomeRef = useRef(selectedCompareProperty)
  const savedAnchorRef = useRef<typeof anchor>(null)
  // Back = leave without saving: everything returns to the saved search.
  const resetToSaved = () => {
    setFormData(savedFormRef.current)
    setSelectedCompareProperty(savedHomeRef.current)
    setAnchor(savedAnchorRef.current)
    setHomeSwap(null)
    setRemovedHome(null)
    setStartedOver(null)
    setCustomPrice(false)
    priceScaleRef.current = null
    setError('')
  }
  // "Stop using a home" asks first, then saves straight away - so it's never shown as done when it
  // isn't (it used to wait for Save, and Back made it look applied while the page still had the home).
  const [confirmNoHome, setConfirmNoHome] = useState(false)
  const homeTown = (() => {
    const t = selectedCompareProperty?.city || currentCompareProperty?.city || ''
    return t ? t.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, c) => a + c.toUpperCase()) : ''
  })()
  const stopUsingHome = async () => {
    const st = currentCompareProperty?.state
    setIsSubmitting(true)
    setError('')
    try {
      const result = await onSave({
        address: '', lat: null, long: null, diameter: null, school_districts: [], remove_home: true,
        cities: homeTown ? [st ? `${homeTown}, ${st}` : homeTown] : (formData.cities || []),
        min_price: formData.min_price, max_price: formData.max_price, min_beds: formData.min_beds, max_beds: formData.max_beds,
        min_baths: formData.min_baths, max_baths: formData.max_baths,
      })
      setOutcome(result || null)
      setSaved(true)
      window.setTimeout(onClose, 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your search - please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  const removeHome = () => {
    const home = selectedCompareProperty
    setRemovedHome({ form: formData, home, anchor })
    const town = home?.city || currentCompareProperty?.city
    const st = currentCompareProperty?.state
    const niceTown = town ? town.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, c) => a + c.toUpperCase()) : ''
    setSelectedCompareProperty(null)
    setAnchor(null)
    setHomeSwap(null)
    setFormData(prev => ({ ...prev, address: '', lat: null, long: null, diameter: null, cities: niceTown ? [st ? `${niceTown}, ${st}` : niceTown] : prev.cities, school_districts: [] }))
    setStep('edit')
    setError('')
  }
  const undoRemoveHome = () => {
    if (!removedHome) return
    setFormData(removedHome.form)
    setSelectedCompareProperty(removedHome.home)
    setAnchor(removedHome.anchor)
    setRemovedHome(null)
  }
  const undoHomeSwap = () => {
    if (!homeSwap) return
    setFormData(homeSwap.form)
    setSelectedCompareProperty(homeSwap.home)
    setAnchor(homeSwap.anchor)
    priceScaleRef.current = null
    setHomeSwap(null)
  }
  // The rebuild offer only makes sense once a different home has been picked.
  const compareChanged = !!selectedCompareProperty && selectedCompareProperty.listingKey !== (currentCompareProperty?.listingKey || '')
  // Only the home they really toured is "the home you toured" - not one they rebuilt around later.
  const isTouredHome = currentCompareProperty && 'touredListingKey' in currentCompareProperty
    ? !!selectedCompareProperty?.listingKey && selectedCompareProperty.listingKey === currentCompareProperty.touredListingKey
    : !compareChanged

  const rebuildButton = (
    <AnimatePresence mode="wait" initial={false}>
      {rebuilt && rebuilt !== 'busy' ? (
        <motion.div key="done" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.07] p-3">
          <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 16 }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></motion.span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-black text-[#111827] dark:text-white">Rebuilt around this home</span>
            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">{rebuilt.summary}</span>
            <span className="mt-0.5 block text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Tap Save to keep it</span>
          </span>
          <motion.button type="button" onClick={undoRebuild} whileHover={{ y: -1 }} whileTap={{ scale: 0.92 }}
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white">Undo</motion.button>
        </motion.div>
      ) : (
        <motion.button key="offer" type="button" onClick={rebuildAround} disabled={rebuilt === 'busy'}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.16 } }} exit={{ opacity: 0, y: -8 }}
          whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
          className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-[#C9A24D]/60 p-3 text-left transition-colors hover:border-solid hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.07]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A24D]/15 text-[#a8843a] transition-colors group-hover:bg-[#C9A24D] group-hover:text-[#111827] dark:text-[#e8c97a]">
            {rebuilt === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12 group-hover:scale-110" />}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-black text-[#111827] dark:text-white">Rebuild {audience === 'agent' ? 'the' : 'my'} search around this home</span>
            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Sets price, bedrooms and area from this home</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )

  const handleSendAsk = async () => {
    if (!askMessage.trim() || !onSendMessage) return
    setIsSendingAsk(true)
    try {
      await onSendMessage(askMessage.trim())
      setAskSent(true)
      setAskMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send your message. Please try again.')
    } finally {
      setIsSendingAsk(false)
    }
  }

  // Towns replace the distance search; a school district only narrows it (distance AND district,
  // like Zillow/Redfin - property_service ANDs districts with every area), so it isn't one.
  const isUsingAreaSearch = () => !!(formData.cities && formData.cities.length > 0)
  const isUsingAddressSearch = () => !!formData.address

  const handleSave = async () => {
    setError('')
    let finalData = { ...formData }

    // If the address text changed but the autocomplete dropdown was never picked, force-resolve
    // it before submitting so we never send an address with no lat/long.
    if (finalData.address && (!finalData.lat || !finalData.long)) {
      const resolved = await googleAutocompleteRef.current?.resolveAddress()
      if (resolved) finalData = { ...finalData, address: resolved.address, lat: resolved.lat, long: resolved.lng }
    }
    if (finalData.address && (!finalData.lat || !finalData.long)) {
      setError('Please choose an address from the dropdown suggestions.')
      return
    }
    if (finalData.address && (!finalData.diameter || finalData.diameter <= 0)) {
      setError('Please pick a search radius.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Partial<CollectionPreferences> = { ...finalData }
      // A guest who built their search around a different home: that home is now the one the
      // match % is measured against (they can't turn comparison off - the server ignores that).
      if (audience !== 'agent' && compareChanged && selectedCompareProperty?.listingKey) {
        payload.compare_property_listing_key = selectedCompareProperty.listingKey
      }
      if (audience === 'agent') {
      // Always explicit (selected key, or null to clear) - never omitted, so removing an existing
      // comparison actually clears it server-side instead of leaving it as-is.
      payload.compare_property_listing_key = selectedCompareProperty ? selectedCompareProperty.listingKey : null
      if (selectedCompareProperty) {
        payload.show_match_score = true
      } else if (!hasExplicitCompareOverride) {
        // There was no override to revert to - what was showing was the implicit open-house
        // default, so turning comparison off entirely is the only way "stop comparing" does
        // something.
        payload.show_match_score = false
      }
      }
      if (audience !== 'agent' && removedHome && !selectedCompareProperty) payload.remove_home = true
      const result = await onSave(payload)
      setOutcome(result || null)
      setSaved(true)
      window.setTimeout(onClose, result && (result.added || result.removed) ? 2200 : 1100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update your search. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ---------------------------------------------------------------- shared bits

  const saveBar = (label: string, extra?: ReactNode) => (
    <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 bg-white/95 px-5 py-4 dark:border-white/[0.07] dark:bg-[#141416]/95 sm:px-7">
      <motion.button type="button" onClick={onClose} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
        className="h-12 rounded-2xl border-2 border-gray-300 bg-white px-5 text-[11px] font-black uppercase tracking-widest text-[#111827] transition-colors hover:border-[#111827] dark:border-white/25 dark:bg-transparent dark:text-white dark:hover:border-white">Cancel</motion.button>
      {/* The live "● 2 homes" count sits right beside Cancel; Undo + Save are on the right. */}
      {preview && !saved ? (
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 ring-1 ring-gray-200 dark:bg-white/[0.05] dark:ring-white/10 sm:inline-flex">
          {liveLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A24D]" /> : <span className="h-2 w-2 rounded-full bg-emerald-500" />}
          <span className="relative inline-flex h-5 overflow-hidden text-sm font-black tabular-nums text-[#111827] dark:text-white">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={live?.count ?? -1} className="block" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }}>{live ? live.count.toLocaleString() : '–'}</motion.span>
            </AnimatePresence>
          </span>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{live?.count === 1 ? 'home' : 'homes'}</span>
        </div>
      ) : null}
      <span className="hidden flex-1 sm:block" />
      {extra}
      <motion.button type="button" onClick={handleSave} disabled={isSubmitting || saved} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
        className={`rf-shine inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-xs font-black uppercase tracking-widest shadow-[0_16px_34px_-14px_rgba(17,24,39,.8)] transition-colors sm:flex-none sm:px-9 ${saved ? 'bg-emerald-500 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={saved ? 'done' : isSubmitting ? 'busy' : 'idle'} className="inline-flex items-center gap-2"
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.16 }}>
            {saved ? <><Check className="h-4 w-4" strokeWidth={3} /> {outcome && (outcome.added || outcome.removed) ? [outcome.added ? `+${outcome.added} new` : '', outcome.removed ? `${outcome.removed} removed` : ''].filter(Boolean).join(' · ') : 'Updated'}</> : isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating</> : <>{label}{preview && live && <span className="font-bold normal-case tracking-normal opacity-70 sm:hidden">· {live.count.toLocaleString()} {live.count === 1 ? 'home' : 'homes'}</span>}</>}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )

  const errorLine = (
    <AnimatePresence>
      {error && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400">{error}</motion.p>
      )}
    </AnimatePresence>
  )

  const compareCard = (p: { address: string; city?: string | null; image?: string | null }, big = false) => (
    <motion.div layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#C9A24D]/40 bg-gradient-to-r from-[#C9A24D]/12 to-transparent ${big ? 'p-3' : 'p-2.5'}`}>
      {p.image
        ? <img src={p.image} alt="" className={`${big ? 'h-16 w-16' : 'h-12 w-12'} shrink-0 rounded-xl object-cover shadow`} />
        : <span className={`${big ? 'h-16 w-16' : 'h-12 w-12'} grid shrink-0 place-items-center rounded-xl bg-white text-[#C9A24D] dark:bg-[#0b0b0c]`}><MapPin className="h-5 w-5" /></span>}
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#a8843a] dark:text-[#e8c97a]">Comparing to</p>
        <p className={`mt-0.5 truncate font-black text-[#111827] dark:text-white ${big ? 'text-base' : 'text-sm'}`}>{p.address}</p>
        {p.city && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{p.city}</p>}
      </div>
    </motion.div>
  )

  const compareSearch = (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          autoFocus={focus === 'compare' || changingCompare || switchingHome}
          type="text"
          value={compareQuery}
          onChange={(e) => setCompareQuery(e.target.value)}
          placeholder="Search any home's address..."
          className="block w-full rounded-2xl border border-gray-200 bg-[#FAFAF7] py-3.5 pl-11 pr-10 text-sm font-bold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white"
        />
        {searching && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#C9A24D]" />}
      </div>
      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        <AnimatePresence initial={false}>
          {compareSuggestions.map((s, i) => (
            <motion.button
              type="button"
              key={`${s.listingKey}-${i}`}
              onClick={() => handleSelectCompareProperty(s)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} exit={{ opacity: 0 }}
              whileHover={{ x: 3 }}
              className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition-colors hover:border-[#C9A24D]/40 hover:bg-[#C9A24D]/[0.07]"
            >
              {s.image
                ? <img src={s.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gray-100 text-gray-300 dark:bg-[#0b0b0c]"><MapPin className="h-4 w-4" /></span>}
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-black text-[#111827] dark:text-white">{s.address}</p>
                <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {[s.city, s.price != null && `$${s.price.toLocaleString()}`, s.beds && `${s.beds} bd`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
        {compareQuery.trim().length >= 3 && !searching && !compareSuggestions.length && (
          <p className="px-2 py-3 text-xs font-semibold text-gray-400">No homes found for that address.</p>
        )}
      </div>
    </div>
  )

  // How far from the address: chips + a slider, drawn as a ring that grows around the pin, with
  // the matching homes as little dots where they really are. At most MAX_DOTS (a steady sample, so
  // shrinking the ring visibly drops dots instead of reshuffling them).
  const radiusPicker = (center?: string | null) => {
    const d = formData.diameter || 0
    // % of a square the height of the box - 15 mi fills it edge to edge, and the common 1-5 mi
    // range stays big (1 mi ~51%, 3 mi ~68%, 5 mi ~77%).
    const ring = d ? Math.min(96, 30 + Math.log2(d * 2 + 1) * 13.5) : 22
    const lat0 = formData.lat, lng0 = formData.long
    const dots = live && d && lat0 != null && lng0 != null
      ? live.points
        .map(p => {
          const dx = (p.lng - lng0) * 69.17 * Math.cos((lat0 * Math.PI) / 180)
          const dy = (p.lat - lat0) * 69
          return { id: p.id, x: dx / d, y: dy / d }
        })
        .filter(p => Math.hypot(p.x, p.y) <= 0.97)
        .sort((a, b) => dotRank(a.id) - dotRank(b.id))
        .slice(0, MAX_DOTS)
      : []
    return (
      <div>
        <div className="relative mx-auto grid h-52 w-full max-w-sm place-items-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_center,rgba(201,162,77,.10),transparent_70%)]">
          <div className="relative grid aspect-square h-full place-items-center">
          {[0.35, 0.6, 0.85].map((o, k) => <span key={k} className="absolute rounded-full border border-dashed border-gray-200 dark:border-white/10" style={{ width: `${o * 100}%`, aspectRatio: '1' }} />)}
          <motion.span
            className="absolute rounded-full border-2 border-[#C9A24D] bg-[#C9A24D]/12"
            animate={{ width: `${ring}%` }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}
            style={{ aspectRatio: '1' }}
          />
          <motion.span className="rf-radar absolute rounded-full" animate={{ width: `${ring}%` }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} style={{ aspectRatio: '1' }} />
          {/* the homes */}
          <motion.span className="pointer-events-none absolute" animate={{ width: `${ring}%` }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} style={{ aspectRatio: '1' }}>
            <AnimatePresence>
              {dots.map((p, k) => (
                <motion.span key={p.id}
                  className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#111827] ring-2 ring-white shadow-[0_0_8px_rgba(201,162,77,.9)] dark:bg-[#e8c97a] dark:ring-[#141416]"
                  style={{ left: `${50 + p.x * 50}%`, top: `${50 - p.y * 50}%` }}
                  initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { delay: 0.04 * (k % 12), type: 'spring', stiffness: 520, damping: 18 } }}
                  exit={{ scale: 0, opacity: 0, transition: { duration: 0.25 } }} />
              ))}
            </AnimatePresence>
          </motion.span>
          <span className="rf-pulse absolute h-16 w-16 rounded-full bg-[#C9A24D]/40" />
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-[#111827] text-[#e8c97a] shadow-lg dark:bg-white dark:text-[#111827]"><MapPin className="h-4 w-4" /></span>
          </div>
        </div>
        <div className="mt-2 flex justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black text-[#111827] shadow ring-1 ring-black/5 dark:bg-[#1c1c1f] dark:text-white">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={d} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -6, opacity: 0 }} transition={{ duration: 0.15 }}>
                {d ? `Within ${fmtMi(d)}` : 'Pick a distance'}
              </motion.span>
            </AnimatePresence>
            {preview && d > 0 && (
              <>
                <span className="h-3 w-px bg-gray-200 dark:bg-white/15" />
                {liveLoading && !live ? <Loader2 className="h-3 w-3 animate-spin text-[#C9A24D]" /> : (
                  <span className="relative inline-flex h-4 items-center overflow-hidden text-[#a8843a] dark:text-[#e8c97a]">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={live?.count ?? 0} className="block tabular-nums" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: liveLoading ? 0.5 : 1 }} exit={{ y: -12, opacity: 0 }}>
                        {(live?.count ?? 0).toLocaleString()} {live?.count === 1 ? 'home' : 'homes'}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {center && <p className="mt-2 truncate text-center text-xs font-semibold text-gray-500 dark:text-gray-400">of {center}</p>}
        <div className="mt-4 grid grid-cols-7 gap-1">
          {RADII.map(r => {
            const on = d === r
            return (
              <motion.button key={r} type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.9 }} onClick={() => setFormData(prev => ({ ...prev, diameter: r }))}
                className={`relative min-w-0 whitespace-nowrap rounded-full px-0.5 py-2 text-[11px] font-black transition-colors ${on ? 'text-[#111827]' : 'text-gray-600 hover:text-[#111827] dark:text-gray-300 dark:hover:text-white'}`}>
                {on && <motion.span layoutId="rf-radius" className="absolute inset-0 rounded-full bg-[#C9A24D] shadow-[0_8px_18px_-8px_rgba(201,162,77,.9)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                {!on && <span className="absolute inset-0 rounded-full border border-gray-200 dark:border-white/10" />}
                <span className="relative">{fmtMi(r)}</span>
              </motion.button>
            )
          })}
        </div>
        <input type="range" min={0.5} max={25} step={0.5} value={d || 0.5}
          onChange={e => setFormData(prev => ({ ...prev, diameter: parseFloat(e.target.value) }))}
          className="mt-4 w-full accent-[#C9A24D]" aria-label="Search radius in miles" />
      </div>
    )
  }

  // What the search is right now, as chips under the title - they pop in/out as things change.
  const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}k`)
  const summaryChips = [
    formData.address && formData.diameter ? `Within ${fmtMi(formData.diameter)}` : '',
    ...(formData.cities || []).slice(0, 2).map(c => c.split(',')[0]),
    (formData.cities?.length || 0) > 2 ? `+${(formData.cities?.length || 0) - 2} towns` : '',
    ...(formData.school_districts || []).slice(0, 1),
    formData.min_price && formData.max_price ? `${money(formData.min_price)} – ${money(formData.max_price)}`
      : formData.max_price ? `Up to ${money(formData.max_price)}` : formData.min_price ? `${money(formData.min_price)}+` : '',
    formData.min_beds ? `${formData.min_beds}+ beds` : '',
    formData.min_baths ? `${formData.min_baths}+ baths` : '',
  ].filter(Boolean) as string[]

  const shell = (opts: { icon: ReactNode; kicker: string; title: string; sub?: string; wide?: boolean; xl?: boolean; summary?: boolean; children: ReactNode; footer?: ReactNode; headerExtra?: ReactNode; headerSide?: ReactNode }) => (
    <motion.div {...backdropMotion} className="fixed inset-0 z-50 flex items-end justify-center bg-[#0b0b0c]/60 sm:items-center sm:p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <style>{GOLD_CSS}</style>
      <motion.div {...panelMotion}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] ring-1 ring-black/5 dark:bg-[#141416] dark:ring-white/10 sm:rounded-[28px] ${opts.xl ? 'sm:max-h-[90dvh] sm:max-w-3xl' : opts.wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}>
        {/* lit header - a slow gold aurora drifting behind it */}
        <div className="relative isolate shrink-0 overflow-hidden bg-[#0b0b0c] px-5 pb-5 pt-5 text-white sm:px-7">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#0b0b0c,#141821_60%,#1d1810)]" />
          <div aria-hidden className="rf-aurora pointer-events-none" />
          <span aria-hidden className="rf-edge pointer-events-none absolute inset-x-0 bottom-0 h-px" />
          {[['70%', '30%', 0], ['88%', '70%', 1.6], ['55%', '75%', 3], ['30%', '85%', 4.2]].map(([l, t, dl], k) => (
            <span key={k} aria-hidden className="rf-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${dl}s` }} />
          ))}
          <div className="flex items-center justify-between gap-3 pr-9">
            <div className="flex min-w-0 items-center gap-3">
              <motion.span initial={{ scale: 0.5, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                className="relative isolate grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-[#111827] shadow-[0_12px_28px_-10px_rgba(201,162,77,.95)]">
                <span aria-hidden className="rf-ring" />
                <span aria-hidden className="absolute inset-[2px] -z-[1] rounded-[14px] bg-gradient-to-br from-[#e8c97a] to-[#C9A24D]" />
                {opts.icon}
              </motion.span>
              <div className="min-w-0">
                <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }} className="text-[10px] font-black uppercase tracking-[0.26em] text-[#e8c97a]">{opts.kicker}</motion.p>
                <h3 className={`whitespace-nowrap font-serif font-black leading-tight ${opts.wide || opts.xl ? 'text-[1.5rem]' : 'text-[clamp(1.05rem,4.4vw,1.4rem)]'}`}>
                  {opts.title.split(' ').map((w, k) => (
                    <motion.span key={k} className="inline-block" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + k * 0.05, type: 'spring', stiffness: 320, damping: 26 }}>
                      {w}{k < opts.title.split(' ').length - 1 ? '\u00a0' : ''}
                    </motion.span>
                  ))}
                </h3>
              </div>
            </div>
            {opts.headerSide}
            <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"><X className="h-4 w-4" /></motion.button>
          </div>
          {opts.sub && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-2 text-xs font-semibold text-white/60">{opts.sub}</motion.p>}
          {opts.headerExtra}
          {opts.summary && (
            <motion.div layout className="mt-3 flex min-h-[26px] flex-wrap gap-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {summaryChips.length ? summaryChips.map(c => (
                  <motion.span key={c} layout initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="rounded-full border border-white/15 bg-white/[0.08] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/85 ">
                    {c}
                  </motion.span>
                )) : (
                  <motion.span key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-semibold text-white/45">Everything that matches - tune it below.</motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{opts.children}</div>
        {opts.footer}
      </motion.div>
    </motion.div>
  )

  // Bottom of the compare / radius windows: the whole search, one tap away - with what's in there.
  const refineChips = audience === 'agent'
    ? [{ i: MapPin, l: 'Map' }, { i: Crosshair, l: 'Areas' }, { i: DollarSign, l: 'Price' }, { i: BedDouble, l: 'Beds' }, { i: Home, l: 'Type' }]
    : [{ i: DollarSign, l: 'Price' }, { i: BedDouble, l: 'Beds' }, { i: Bath, l: 'Baths' }, { i: MapPin, l: 'Towns' }, { i: Target, l: 'Distance' }]
  const refineFurther = onRefineFurther ? (
    <motion.button type="button" onClick={onRefineFurther}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 26 }}
      whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
      className="group relative isolate w-full overflow-hidden rounded-2xl bg-[#111827] p-3.5 text-left text-white shadow-[0_18px_36px_-20px_rgba(17,24,39,.9)] dark:bg-white/[0.07] dark:ring-1 dark:ring-white/10">
      <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(120%_140%_at_100%_0%,rgba(201,162,77,.28),transparent_60%)]" />
      <span aria-hidden className="absolute inset-0 -z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827] shadow-md"><SlidersHorizontal className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-sm font-black">{audience === 'agent' ? 'Refine the search further' : 'Refine my search further'}</span>
          <span className="block truncate text-xs font-semibold text-white/55">{audience === 'agent' ? 'The full editor - every filter' : 'Fine-tune what shows up for you'}</span>
        </span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[#e8c97a] transition-all group-hover:translate-x-0.5 group-hover:bg-[#C9A24D] group-hover:text-[#111827]"><ArrowRight className="h-4 w-4" /></span>
      </span>
      <span className="mt-3 flex flex-wrap gap-1">
        {refineChips.map((c, k) => (
          <motion.span key={c.l} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + k * 0.05 }}
            className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-1.5 py-1 text-[9.5px] font-black uppercase tracking-wide text-white/80 ring-1 ring-white/10">
            <c.i className="h-3 w-3 text-[#e8c97a]" /> {c.l}
          </motion.span>
        ))}
      </span>
    </motion.button>
  ) : null

  // What the match % actually is, as a picture: the home on the left, homes being scored on the
  // right (bars filling, percentages landing), and the five things compared underneath.
  const rawStreet = (selectedCompareProperty?.address || '').split(',')[0]
  const homeStreet = !rawStreet ? 'this home' : rawStreet === rawStreet.toUpperCase() ? rawStreet.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, c) => a + c.toUpperCase()) : rawStreet
  const matchExplainer = (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="relative overflow-hidden rounded-3xl border border-[#C9A24D]/30 bg-gradient-to-b from-[#C9A24D]/[0.09] to-transparent p-4">
      <div className="flex items-center gap-3">
        <div className="flex w-[92px] shrink-0 flex-col items-center text-center">
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            className="relative block h-[72px] w-[72px] overflow-hidden rounded-2xl ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-white shadow-lg dark:ring-offset-[#141416]">
            {selectedCompareProperty?.image
              ? <img src={selectedCompareProperty.image} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full w-full place-items-center bg-[#111827] text-[#e8c97a]"><Home className="h-6 w-6" /></span>}
          </motion.span>
          <p className="mt-2 w-full truncate text-[11px] font-black text-[#111827] dark:text-white">{homeStreet}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#a8843a] dark:text-[#e8c97a]">{audience === 'agent' ? 'Measured against' : isTouredHome ? 'The home you toured' : 'Built around'}</p>
        </div>
        <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="shrink-0 text-[#C9A24D]"><ArrowRight className="h-5 w-5" /></motion.span>
        <div className="min-w-0 flex-1 space-y-2">
          {[96, 82, 64].map((pct, k) => (
            <motion.div key={pct} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + k * 0.12 }}
              className="flex items-center gap-2 rounded-xl bg-white/90 p-1.5 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.05] dark:ring-white/[0.06]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-400 dark:bg-white/10"><Home className="h-3.5 w-3.5" /></span>
              <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                <motion.span className={`absolute inset-y-0 left-0 rounded-full ${k === 0 ? 'bg-emerald-500' : k === 1 ? 'bg-[#C9A24D]' : 'bg-gray-400'}`}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.45 + k * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
              </span>
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9 + k * 0.12, type: 'spring', stiffness: 500, damping: 18 }}
                className={`w-[52px] shrink-0 rounded-full px-1.5 py-0.5 text-center text-[10px] font-black text-white ${k === 0 ? 'bg-emerald-500' : k === 1 ? 'bg-[#C9A24D]' : 'bg-gray-400'}`}>
                {pct}%
              </motion.span>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
        {[{ i: DollarSign, l: 'Price' }, { i: BedDouble, l: 'Beds' }, { i: Bath, l: 'Baths' }, { i: Ruler, l: 'Size' }, { i: MapPin, l: 'Distance' }].map((f, k) => (
          <motion.span key={f.l} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 + k * 0.06 }}
            className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-1 text-[9.5px] font-black uppercase tracking-wide text-gray-600 ring-1 ring-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:ring-white/10">
            <f.i className="h-3 w-3 text-[#C9A24D]" /> {f.l}
          </motion.span>
        ))}
      </div>
      <p className="mt-3 text-center text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">
        Every home in {audience === 'agent' ? 'the' : 'your'} Showcase gets a <span className="font-black text-[#111827] dark:text-white">match %</span> - how close it is to <span className="font-black text-[#111827] dark:text-white">{homeStreet}</span> on these five things.
      </p>
    </motion.div>
  )

  // Clients don't change the home themselves - one tap asks their agent.
  const [askCompare, setAskCompare] = useState<'closed' | 'open' | 'sending' | 'sent'>('closed')
  const agentFirst = agent?.name?.split(' ')[0] || 'your agent'
  const [askCompareText, setAskCompareText] = useState(`Hi ${agentFirst}, could you compare my matches to a different home? I'm thinking of `)
  const sendAskCompare = async () => {
    if (!onSendMessage || !askCompareText.trim()) return
    setAskCompare('sending')
    try { await onSendMessage(askCompareText.trim()); setAskCompare('sent') } catch { setAskCompare('open'); setError('Could not send that - try again.') }
  }
  const askAgentCompare = onSendMessage ? (
    <AnimatePresence mode="wait" initial={false}>
      {askCompare === 'sent' ? (
        <motion.div key="sent" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.07] p-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
          <span className="text-sm font-black text-[#111827] dark:text-white">Sent to {agentFirst} - they&rsquo;ll update it for you.</span>
        </motion.div>
      ) : askCompare === 'closed' ? (
        <motion.button key="ask" type="button" onClick={() => setAskCompare('open')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.15 } }} exit={{ opacity: 0 }}
          whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
          className="group flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.03]">
          {agent?.photoUrl
            ? <img src={agent.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-[#C9A24D]/60" />
            : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#C9A24D]/15 text-[#a8843a]"><MessageSquareText className="h-4 w-4" /></span>}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-black text-[#111827] dark:text-white">Want it built around a different home?</span>
            <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Ask {agentFirst} - one tap</span>
          </span>
          <Send className="h-4 w-4 shrink-0 text-[#a8843a] transition-transform group-hover:translate-x-0.5 dark:text-[#e8c97a]" />
        </motion.button>
      ) : (
        <motion.div key="compose" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }} className="space-y-2 overflow-hidden">
          <textarea value={askCompareText} onChange={e => setAskCompareText(e.target.value)} rows={3} maxLength={2000} autoFocus
            className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
          <motion.button type="button" onClick={sendAskCompare} disabled={askCompare === 'sending' || !askCompareText.trim()} whileTap={{ scale: 0.97 }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white disabled:opacity-40 dark:bg-white dark:text-[#111827]">
            {askCompare === 'sending' ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> Send to {agentFirst}</>}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  ) : null

  const doneBar = (
    <div className="flex shrink-0 border-t border-gray-100 bg-white/95 px-5 py-4 dark:border-white/[0.07] dark:bg-[#141416]/95 sm:px-7">
      <motion.button type="button" onClick={onClose} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
        className="h-12 w-full rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-[#111827]">Got it</motion.button>
    </div>
  )

  // ---------------------------------------------------------------- one question: compare to

  if (focus === 'compare' && audience === 'agent') {
    return shell({
      icon: <Scale className="h-5 w-5" />, kicker: 'Match score', title: 'Compare to which home?',
      children: (
        <div className="space-y-3 px-5 py-5 sm:px-7">
          {!changingCompare && selectedCompareProperty && matchExplainer}
          <AnimatePresence mode="wait" initial={false}>
          {selectedCompareProperty && !changingCompare ? (
            <motion.div key={`chosen-${selectedCompareProperty.listingKey}`} className="space-y-4"
              initial={{ opacity: 0, x: -24, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 24, scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              <div className="grid grid-cols-2 gap-2">
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => setChangingCompare(true)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.08 } }}
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 text-[11px] font-black uppercase tracking-widest text-[#111827] transition-colors hover:border-[#C9A24D] hover:bg-[#C9A24D]/[0.06] dark:border-white/10 dark:text-white">
                  <Search className="h-4 w-4 transition-transform group-hover:-rotate-12 group-hover:scale-110" /> Pick another
                </motion.button>
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} type="button" onClick={() => setSelectedCompareProperty(null)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.12 } }}
                  className="group inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-500 transition-colors hover:border-rose-400 hover:bg-rose-500/[0.05] hover:text-rose-500 dark:border-white/10 dark:text-gray-400">
                  <X className="h-4 w-4 transition-transform group-hover:rotate-90" /> Stop comparing
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="search" className="space-y-3"
              initial={{ opacity: 0, x: 24, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -24, scale: 0.98 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
              {!selectedCompareProperty && !changingCompare && (
                <p className="rounded-2xl bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">Not comparing right now - search a home to score {their} matches against it.</p>
              )}
              {compareSearch}
              {changingCompare && selectedCompareProperty && (
                <button type="button" onClick={() => { setChangingCompare(false); setCompareQuery('') }} className="text-[11px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-[#111827] dark:hover:text-white">Keep {selectedCompareProperty.address.split(',')[0]}</button>
              )}
            </motion.div>
          )}
          </AnimatePresence>
          {errorLine}
          {refineFurther}
          {compareChanged && !changingCompare && rebuildButton}
        </div>
      ),
      footer: saveBar('Save'),
    })
  }

  // ---------------------------------------------------------------- one question: radius

  if (focus === 'radius' && audience === 'agent') {
    return shell({
      icon: <Target className="h-5 w-5" />, kicker: 'Search area', title: 'How far should we look?',
      children: (
        <div className="space-y-4 px-5 py-5 sm:px-7">
          {radiusPicker(formData.address)}
          {errorLine}
          {refineFurther}
        </div>
      ),
      footer: saveBar('Update search'),
    })
  }

  // ---------------------------------------------------------------- the full Refine menu

  // Read-only picture of what the agent configured that a visitor can't edit here.
  const areaFilters = preferences?.townships || []
  const yearBuiltRange = preferences?.min_year_built || preferences?.max_year_built
    ? `${preferences?.min_year_built || 'Any'}–${preferences?.max_year_built || 'Present'}`
    : null
  const specialFeatures = preferences?.special_features?.trim() || null
  const hasSummary = areaFilters.length > 0 || !!yearBuiltRange || !!specialFeatures
  const priceInput = 'block w-full rounded-2xl border border-gray-200 bg-[#FAFAF7] py-3 pl-8 pr-3 text-sm font-black text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white'

  const chipRow = (values: (number | null)[], current: number | null | undefined, set: (v: number | null) => void, id: string) => (
    <div className="flex flex-wrap gap-1.5">
      {values.map(v => {
        const on = (current ?? null) === v
        return (
          <motion.button key={String(v)} type="button" whileTap={{ scale: 0.92 }} onClick={() => set(v)}
            className={`relative min-w-[52px] rounded-xl px-3 py-2 text-xs font-black transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-gray-600 hover:text-[#111827] dark:text-gray-300 dark:hover:text-white'}`}>
            {on && <motion.span layoutId={id} className="absolute inset-0 rounded-xl bg-[#111827] dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            {!on && <span className="absolute inset-0 rounded-xl border border-gray-200 dark:border-white/10" />}
            <span className="relative">{v == null ? 'Any' : `${v}+`}</span>
          </motion.button>
        )
      })}
    </div>
  )

  const Section = ({ i, icon, title, hint, set, children }: { i: number; icon: ReactNode; title: string; hint?: string; set?: boolean; children: ReactNode }) => (
    <motion.section initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.08 + i * 0.06, type: 'spring', stiffness: 280, damping: 28 }}
      className={`rf-lift relative overflow-hidden rounded-3xl border bg-white p-4 shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] dark:bg-[#18181b] sm:p-5 ${set ? 'border-[#C9A24D]/45 dark:border-[#C9A24D]/30' : 'border-gray-100 dark:border-white/[0.07]'}`}>
      <AnimatePresence>{set && <motion.span key="bar" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} className="absolute inset-y-4 left-0 w-1 origin-top rounded-r-full bg-gradient-to-b from-[#e8c97a] to-[#C9A24D]" />}</AnimatePresence>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${set ? 'bg-[#C9A24D] text-[#111827]' : 'bg-[#C9A24D]/15 text-[#a8843a] dark:text-[#e8c97a]'}`}>{icon}</span>
        <p className="text-sm font-black text-[#111827] dark:text-white">{title}</p>
        <AnimatePresence>{set && <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }} className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></motion.span>}</AnimatePresence>
        {hint && <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-gray-400">{hint}</span>}
      </div>
      {children}
    </motion.section>
  )

  // ---------------------------------------------------------------- the buyer: one "Your search" window

  const askPane = (
    <>
              {askSent ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 15 }} className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_16px_34px_-12px_rgba(16,185,129,.8)]"><CheckCircle2 className="h-8 w-8" /></motion.span>
                  <p className="font-serif text-xl font-black text-[#111827] dark:text-white">Sent to {agent?.name?.split(' ')[0] || 'your agent'}</p>
                  <p className="max-w-xs text-xs font-medium text-gray-500 dark:text-gray-400">They&rsquo;ll update your search and new matches will show up here.</p>
                  <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-[#111827] px-6 py-3 text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-[#111827]">Done</button>
                </div>
              ) : (
                <>
                  {agent?.name && (
                    <div className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-gradient-to-r from-[#C9A24D]/10 to-transparent p-3 dark:border-white/[0.07]">
                      {agent.photoUrl
                        ? <img src={agent.photoUrl} alt={agent.name} className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-[#C9A24D] ring-offset-2 ring-offset-white dark:ring-offset-[#141416]" />
                        : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#C9A24D] text-sm font-black text-[#111827]">{agent.name.split(' ').map(p => p[0]).slice(0, 2).join('')}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#a8843a] dark:text-[#e8c97a]">Your agent</p>
                        <p className="truncate font-serif text-lg font-black text-[#111827] dark:text-white">{agent.name}</p>
                      </div>
                      {agent.phone && <a href={`tel:${agent.phone}`} title={`Call ${agent.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#a8843a] shadow-sm ring-1 ring-gray-200 transition hover:ring-[#C9A24D] dark:bg-[#1c1c1f] dark:ring-white/10"><Phone className="h-4 w-4" /></a>}
                      {agent.email && <a href={`mailto:${agent.email}`} title={`Email ${agent.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#a8843a] shadow-sm ring-1 ring-gray-200 transition hover:ring-[#C9A24D] dark:bg-[#1c1c1f] dark:ring-white/10"><Mail className="h-4 w-4" /></a>}
                    </div>
                  )}
                  {(agent?.phone || agent?.email) && (
                    <div className="flex flex-wrap gap-1.5">
                      {agent?.phone && <button type="button" onClick={() => handleCopyAgentField('phone', agent.phone!)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 transition hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">{copiedAgentField === 'phone' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}{copiedAgentField === 'phone' ? 'Copied!' : agent.phone}</button>}
                      {agent?.email && <button type="button" onClick={() => handleCopyAgentField('email', agent.email!)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-600 transition hover:border-[#C9A24D] dark:border-white/10 dark:text-gray-300">{copiedAgentField === 'email' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}{copiedAgentField === 'email' ? 'Copied!' : agent.email}</button>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {['Look closer to downtown', 'Raise my max price', 'I need a bigger yard', 'Only newer homes'].map((q, k) => (
                      <motion.button key={q} type="button" onClick={() => setAskMessage(m => (m ? `${m} ${q}.` : `${q}.`))}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + k * 0.05 }} whileTap={{ scale: 0.95 }}
                        className="rounded-full bg-[#C9A24D]/12 px-3 py-1.5 text-[11px] font-bold text-[#7a5f22] transition hover:bg-[#C9A24D]/25 dark:text-[#e8c97a]">
                        + {q}
                      </motion.button>
                    ))}
                  </div>
                  <textarea value={askMessage} onChange={(e) => setAskMessage(e.target.value)} rows={4} maxLength={2000}
                    placeholder="Tell your agent what to change - they'll update it for you..."
                    className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-sm font-medium text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white" />
                  {errorLine}
                  <motion.button onClick={handleSendAsk} disabled={isSendingAsk || !askMessage.trim()} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                    className="rf-shine inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white shadow-lg disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                    {isSendingAsk ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : <><Send className="h-4 w-4" /> Send to {agent?.name?.split(' ')[0] || 'my agent'}</>}
                  </motion.button>
                </>
              )}
    </>
  )

  if (audience !== 'agent') {
    const round5k = (n: number) => Math.round(n / 5000) * 5000
    const kFmt = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}k`)
    const band = (pct: number): [number, number] | null => anchor?.price ? [round5k(anchor.price * (1 - pct)), round5k(anchor.price * (1 + pct))] : null
    const b20 = band(0.2)
    const homeLat = anchor?.lat ?? (preferences?.address ? preferences?.lat : null)
    const homeLng = anchor?.lng ?? (preferences?.address ? preferences?.long : null)
    const homeAddress = selectedCompareProperty?.address || preferences?.address || ''
    // The search an open house sign-in starts them on (collection_preferences_service): 6 mi around
    // the home, its price give or take 20%, one bedroom fewer and up.
    const starting: FormState | null = selectedCompareProperty?.address && homeLat != null && homeLng != null ? {
      ...EMPTY_FORM, address: selectedCompareProperty.address, lat: homeLat, long: homeLng, diameter: 6,
      min_price: b20 ? b20[0] : null, max_price: b20 ? b20[1] : null,
      min_beds: anchor?.beds && anchor.beds > 1 ? anchor.beds - 1 : null,
    } : null
    const atStart = !!starting && formData.diameter === starting.diameter && formData.min_price === starting.min_price && formData.max_price === starting.max_price
      && (formData.min_beds ?? null) === starting.min_beds && !formData.min_baths && !formData.cities?.length && !formData.school_districts?.length
    const city = selectedCompareProperty?.city ? selectedCompareProperty.city.toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, c) => a + c.toUpperCase()) : ''
    const facts = [anchor?.price ? `$${anchor.price.toLocaleString()}` : '', anchor?.beds ? `${anchor.beds} bd` : ''].filter(Boolean).join(' · ')
    const card = (key: string, title: ReactNode, children: ReactNode, hint?: ReactNode, fill = false) => (
      <motion.section key={key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className={`rounded-3xl border bg-white p-4 shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] dark:bg-[#18181b] sm:p-5 ${fill ? 'flex h-full flex-col' : ''} ${(focus === 'radius' && key === 'where') ? 'border-[#C9A24D] ring-4 ring-[#C9A24D]/15' : 'border-gray-100 dark:border-white/[0.07]'}`}>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div className="min-w-0 text-[15px] font-black text-[#111827] dark:text-white">{title}</div>
          {hint && (typeof hint === 'string' ? <span className="text-[11px] font-bold text-gray-400">{hint}</span> : hint)}
        </div>
        {fill ? <div className="flex flex-1 flex-col justify-center">{children}</div> : children}
      </motion.section>
    )
    // One slim row at the top of the filters: the home it's built around (or none) + change it.
    const rowBtn = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-[11px] font-black uppercase tracking-widest text-[#111827] transition-colors hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04] dark:text-white'
    const homeRow = (
      <motion.section key="home" layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`flex flex-wrap items-center gap-3 rounded-3xl border p-3 shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] ${homeSwap || removedHome ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-[#C9A24D]/30 bg-white dark:bg-[#18181b]'}`}>
        {selectedCompareProperty?.address ? (selectedCompareProperty.image
          ? <img src={selectedCompareProperty.image} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#111827] text-[#e8c97a]"><Home className="h-5 w-5" /></span>)
          : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#C9A24D]/15 text-[#a8843a] dark:text-[#e8c97a]"><SlidersHorizontal className="h-5 w-5" /></span>}
        <div className="min-w-0 flex-1 leading-tight">
          <p className={`text-[10px] font-black uppercase tracking-widest ${homeSwap || removedHome ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#a8843a] dark:text-[#e8c97a]'}`}>
            {homeSwap ? 'New home - tap Save to keep it' : removedHome ? 'No home - tap Save to keep it' : selectedCompareProperty?.address ? (isTouredHome ? 'Built around the home you toured' : 'Built around') : 'Just your filters'}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-black text-[#111827] dark:text-white">{selectedCompareProperty?.address ? homeStreet : removedHome ? 'Showing homes that fit your filters' : 'Not built around a home'}</p>
          {selectedCompareProperty?.address && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{[city, facts].filter(Boolean).join(' · ')}</p>}
        </div>
        <div className="flex w-full gap-2">
          {(homeSwap || removedHome) && (
            <button type="button" onClick={homeSwap ? undoHomeSwap : undoRemoveHome} className={`${rowBtn} flex-1`}><RotateCcw className="h-3.5 w-3.5" /> Undo</button>
          )}
          <button type="button" onClick={() => openPicker('edit')} className={`${rowBtn} flex-1`}>
            <Home className="h-3.5 w-3.5" /> {selectedCompareProperty?.address ? 'Change home' : 'Use a home'}
          </button>
        </div>
      </motion.section>
    )

    const drawnArea = !!(preferences as { has_drawn_area?: boolean } | null)?.has_drawn_area && !formData.address && !formData.cities?.length
    const whereCard = !isUsingAreaSearch() && formData.address
      ? card('where', `How far from ${currentCompareProperty?.address ? homeStreet : 'the address'}?`, radiusPicker(), undefined, true)
      : card('where', drawnArea ? 'Where?' : 'Which towns?', (
        <div className="space-y-2">
          {drawnArea && (
            <p className="rounded-2xl bg-[#C9A24D]/10 px-3 py-2.5 text-[12px] font-semibold leading-snug text-[#5c4a30] dark:text-[#e8cf8a]">
              Right now: the area {agentFirst} drew on the map. Pick towns below to search those instead, or a school district to narrow it down.
            </p>
          )}
          <MultiSelectDatabaseInput values={formData.cities || []} apiMethod={api.properties.citiesPublic} placeholder="Search towns..."
            onChange={(cities) => setFormData(prev => ({ ...prev, cities, address: '', lat: null, long: null, diameter: null }))} />
          <MultiSelectDatabaseInput values={formData.school_districts || []} apiMethod={api.properties.schoolDistrictsPublic} placeholder="Search school districts..."
            onChange={(school_districts) => setFormData(prev => ({ ...prev, school_districts }))} />
          {/* Towns AND a school district = only homes in both (property_service stacks them). */}
          <AnimatePresence initial={false}>
            {!!formData.cities?.length && !!formData.school_districts?.length && (
              <motion.p key="both" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 overflow-hidden rounded-2xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold leading-snug text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Only homes that are in your town{formData.cities.length > 1 ? 's' : ''} <b>and</b> your school district{formData.school_districts.length > 1 ? 's' : ''} will show. Remove one to see more homes.</span>
              </motion.p>
            )}
          </AnimatePresence>
          {!removedHome && homeAddress && homeLat != null && homeLng != null && (
            <button type="button" onClick={() => setFormData(prev => ({ ...prev, cities: [], address: homeAddress, lat: homeLat!, long: homeLng!, diameter: prev.diameter || 6 }))}
              className="inline-flex items-center gap-1.5 text-[12px] font-black text-[#a8843a] hover:underline dark:text-[#e8c97a]">
              <Target className="h-3.5 w-3.5" /> Search by distance from {homeStreet} instead
            </button>
          )}
        </div>
      ), undefined, true)

    // One two-handle slider from $0 to ~2.5x the toured home's price (the top end = no max), plus
    // a Manual button for typing an exact range.
    // Scale = ~2.5x the home's price. Known right away from the saved range (built as the home's
    // price +-20%), else from the home itself once it loads; fixed from then on.
    if (priceScaleRef.current == null) {
      const basis = formData.max_price ? formData.max_price / 1.2 : formData.min_price ? formData.min_price / 0.8
        : anchor?.price ? anchor.price : currentCompareProperty?.address ? null : 1_000_000
      if (basis) priceScaleRef.current = Math.max(1_000_000, Math.ceil((basis * 2.5) / 250_000) * 250_000)
    }
    const pMax = Math.max(priceScaleRef.current ?? 3_000_000, formData.min_price ?? 0)
    const pStep = pMax > 3_000_000 ? 50_000 : 25_000
    const lo = Math.min(formData.min_price ?? 0, pMax)
    const hi = formData.max_price == null ? pMax : Math.min(formData.max_price, pMax)
    const pct = (v: number) => `${(v / pMax) * 100}%`
    const priceLabel = `${formData.min_price ? kFmt(formData.min_price) : 'Any'} – ${formData.max_price == null ? 'No max' : kFmt(formData.max_price)}`
    const manualBtn = (
      <button type="button" onClick={() => setCustomPrice(o => !o)}
        className={`rounded-full border px-3 py-1 text-[11px] font-black transition-colors ${customPrice ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D] dark:border-white/15 dark:text-gray-300'}`}>
        Manual
      </button>
    )
    const priceCard = card('price', (
      <span className="flex min-w-0 items-baseline gap-1.5">
        Price:
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={priceLabel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
            className="truncate text-[15px] font-black tabular-nums text-[#a8843a] dark:text-[#e8c97a]">{priceLabel}</motion.span>
        </AnimatePresence>
      </span>
    ), (
      <div className="space-y-2">
        <div className="relative mx-1 h-7">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-white/10" />
          <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#e8c97a] to-[#C9A24D]" style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }} />
          <input type="range" className="ys-range" min={0} max={pMax} step={pStep} value={lo} aria-label="Lowest price"
            onChange={e => { const v = Number(e.target.value); setFormData(prev => ({ ...prev, min_price: v <= 0 ? null : Math.min(v, hi - pStep) })) }} />
          <input type="range" className="ys-range" min={0} max={pMax} step={pStep} value={hi} aria-label="Highest price"
            onChange={e => { const v = Number(e.target.value); setFormData(prev => ({ ...prev, max_price: v >= pMax ? null : Math.max(v, lo + pStep) })) }} />
        </div>
        <AnimatePresence initial={false}>
          {customPrice && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 pt-1">
                {([['min_price', 'No min'], ['max_price', 'No max']] as const).map(([k2, ph], idx) => (
                  <label key={k2} className="relative block" style={{ gridColumn: idx === 0 ? 1 : 3, gridRow: 1 }}>
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
                    <input type="text" inputMode="numeric" value={formatNumberWithCommas(formData[k2])}
                      onChange={(e) => setFormData(prev => ({ ...prev, [k2]: parseInt(stripCommas(e.target.value)) || null }))}
                      className={priceInput} placeholder={ph} aria-label={k2 === 'min_price' ? 'Lowest price' : 'Highest price'} />
                  </label>
                ))}
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400" style={{ gridColumn: 2, gridRow: 1 }}>to</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    ), manualBtn)

    const bedsCard = card('beds', 'Bedrooms', (
      <div className="grid grid-cols-6 gap-1">
        {BEDS.map(v => {
          const on = (formData.min_beds ?? null) === v
          return (
            <motion.button key={String(v)} type="button" whileTap={{ scale: 0.92 }}
              onClick={() => setFormData(prev => ({ ...prev, min_beds: v, max_beds: prev.max_beds && v && prev.max_beds < v ? null : prev.max_beds }))}
              className={`relative min-w-0 rounded-xl py-2 text-xs font-black transition-colors ${on ? 'text-white dark:text-[#111827]' : 'text-gray-600 hover:text-[#111827] dark:text-gray-300 dark:hover:text-white'}`}>
              {on && <motion.span layoutId="ys-beds" className="absolute inset-0 rounded-xl bg-[#111827] dark:bg-white" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              {!on && <span className="absolute inset-0 rounded-xl border border-gray-200 dark:border-white/10" />}
              <span className="relative">{v == null ? 'Any' : `${v}+`}</span>
            </motion.button>
          )
        })}
      </div>
    ), 'at least')

    // Always open, one wide bar under everything: towns and school district side by side (they
    // replace the distance from the home), then anything else the agent set.
    const moreCard = !isUsingAreaSearch() || hasSummary ? (
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] dark:border-white/[0.07] dark:bg-[#18181b] sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[15px] font-black text-[#111827] dark:text-white">More options</p>
          {!isUsingAreaSearch() && <span className="text-[11px] font-bold text-gray-400">Towns replace the distance · a school district narrows it</span>}
        </div>
        {!isUsingAreaSearch() && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-500">Towns or cities <span className="font-semibold text-gray-400">(instead of the distance)</span></p>
              <MultiSelectDatabaseInput values={formData.cities || []} apiMethod={api.properties.citiesPublic} placeholder="Search towns..."
                onChange={(cities) => setFormData(prev => ({ ...prev, cities, address: '', lat: null, long: null, diameter: null }))} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black text-gray-500">School district <span className="font-semibold text-gray-400">(only homes in it)</span></p>
              <MultiSelectDatabaseInput values={formData.school_districts || []} apiMethod={api.properties.schoolDistrictsPublic} placeholder="Search school districts..."
                onChange={(school_districts) => setFormData(prev => ({ ...prev, school_districts }))} />
            </div>
          </div>
        )}
        {/* Distance AND a school district = only homes in both (property_service stacks them). */}
        <AnimatePresence initial={false}>
          {!isUsingAreaSearch() && !!formData.address && !!formData.diameter && !!formData.school_districts?.length && (
            <motion.p key="dist-both" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-start gap-2 overflow-hidden rounded-2xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold leading-snug text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Only homes within <b>{fmtMi(formData.diameter)}</b> of {homeStreet || 'the home'} <b>and</b> in {formData.school_districts.length > 1 ? 'these school districts' : <b>{formData.school_districts[0].split(',')[0].toLowerCase().replace(/(^|\s)([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase())}</b>}{formData.school_districts.length > 1 ? '' : ' schools'} will show.</span>
            </motion.p>
          )}
        </AnimatePresence>
        {hasSummary && (
          <div className={`space-y-1.5 ${!isUsingAreaSearch() ? 'mt-4 border-t border-gray-100 pt-4 dark:border-white/[0.07]' : ''}`}>
            <p className="text-xs font-black text-gray-500">Also set by your agent</p>
            {areaFilters.length > 0 && <div className="flex flex-wrap gap-1.5">{areaFilters.map(f => <span key={f} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">{f}</span>)}</div>}
            {yearBuiltRange && <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Year built: {yearBuiltRange}</p>}
            {specialFeatures && <p className="text-xs font-medium italic text-gray-500 dark:text-gray-400">&ldquo;{specialFeatures}&rdquo;</p>}
          </div>
        )}
      </motion.section>
    ) : null

    // Next to Save: puts the search back the way it started (6 mi around the toured home, a similar
    // price and size); tap again to bring their changes back.
    const startOver = starting && (!atStart || startedOver) ? (
      <motion.button type="button" whileTap={{ scale: 0.96 }}
        onClick={() => { if (startedOver) { setFormData(startedOver); setStartedOver(null) } else { setStartedOver(formData); setFormData(starting); setCustomPrice(false) } }}
        title={startedOver ? 'Bring my changes back' : `Go back to your original search - 6 mi around ${homeStreet}, a similar price and size`}
        className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-300 px-3.5 text-[11px] font-black uppercase tracking-widest text-gray-600 transition-colors hover:border-[#C9A24D] hover:text-[#111827] dark:border-white/20 dark:text-gray-300 dark:hover:text-white">
        <RotateCcw className={`h-4 w-4 text-[#C9A24D] ${startedOver ? '-scale-x-100' : ''}`} />
        <span className="hidden sm:inline">{startedOver ? 'Redo my changes' : 'Undo my changes'}</span>
      </motion.button>
    ) : null

    const messageAgent = onSendMessage && mode !== 'ask' ? (
      <motion.button type="button" onClick={() => { setMode('ask'); setError('') }} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
        title={`Rather just ask ${agentFirst}? Tell them what you want - they'll set it up for you`}
        className="flex min-w-0 shrink items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.07] p-1.5 pr-1.5 text-left transition-colors hover:border-[#e8c97a]/60 hover:bg-white/[0.11] sm:pr-2">
        {agent?.photoUrl
          ? <img src={agent.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover object-[50%_18%] ring-2 ring-[#e8c97a]/70" />
          : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#C9A24D] text-sm font-black text-[#111827]">{agentFirst[0]?.toUpperCase()}</span>}
        <span className="hidden min-w-0 md:block">
          <span className="block whitespace-nowrap text-[13px] font-black text-white">Rather just ask {agentFirst}?</span>
          <span className="block whitespace-nowrap text-[11px] font-semibold text-white/60">They&apos;ll set it up for you</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#e8c97a] to-[#C9A24D] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#111827]">
          <MessageSquareText className="h-3.5 w-3.5" /><span className="hidden sm:inline">Send a note</span>
        </span>
      </motion.button>
    ) : null

    // ---- screen 1: "What do you want to do?" - plain words, big buttons.
    const builtAround = !!selectedCompareProperty?.address
    const choice = (key: string, icon: ReactNode, title: string, line: string, onClick: () => void, k: number) => (
      <motion.button key={key} type="button" onClick={onClick}
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.08 + k * 0.05 } }}
        whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
        className="group flex w-full items-center gap-4 rounded-3xl border border-gray-200 bg-white p-4 text-left shadow-[0_14px_30px_-26px_rgba(17,24,39,.6)] transition-colors hover:border-[#C9A24D] dark:border-white/10 dark:bg-[#18181b]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#C9A24D]/15 text-[#a8843a] transition-colors group-hover:bg-[#C9A24D] group-hover:text-[#111827] dark:text-[#e8c97a]">{icon}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-base font-black text-[#111827] dark:text-white">{title}</span>
          <span className="mt-0.5 block text-sm font-semibold text-gray-500 dark:text-gray-400">{line}</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-[#a8843a] transition-transform group-hover:translate-x-0.5 dark:text-[#e8c97a]" />
      </motion.button>
    )
    const chooseBody = (
      <div className="space-y-3 bg-[#FAFAF7] px-4 py-5 dark:bg-[#0f0f11] sm:px-6">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 rounded-3xl border border-[#C9A24D]/30 bg-gradient-to-r from-[#C9A24D]/10 to-white p-4 dark:to-[#18181b]">
          {builtAround ? (selectedCompareProperty!.image
            ? <img src={selectedCompareProperty!.image} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow" />
            : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-[#111827] text-[#e8c97a]"><Home className="h-7 w-7" /></span>)
            : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#C9A24D]/20 text-[#a8843a] dark:text-[#e8c97a]"><SlidersHorizontal className="h-6 w-6" /></span>}
          <div className="min-w-0 flex-1">
            {builtAround ? (
              <p className="text-[15px] font-semibold leading-snug text-gray-700 dark:text-gray-200">
                Your search is built around <b className="text-[#111827] dark:text-white">{homeStreet}</b>{isTouredHome ? ', the home you toured' : ''}. We show you homes like it nearby.
              </p>
            ) : (
              <p className="text-[15px] font-semibold leading-snug text-gray-700 dark:text-gray-200">
                Your search shows every home that fits your filters.
              </p>
            )}
            {summaryChips.length > 0 && (
              <p className="mt-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">Right now: {summaryChips.join(' · ')}</p>
            )}
          </div>
        </motion.section>
        <AnimatePresence mode="wait" initial={false}>
        {confirmNoHome ? (
          <motion.div key="confirm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } }} exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
            className={`rounded-3xl border-2 p-5 ${saved ? 'border-emerald-500/50 bg-emerald-500/[0.07]' : 'border-amber-400/70 bg-amber-50 dark:bg-amber-500/10'}`}>
            {saved ? (
              <div className="flex items-center gap-3">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 16 }} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><Check className="h-5 w-5" strokeWidth={3} /></motion.span>
                <div className="leading-tight">
                  <p className="text-base font-black text-[#111827] dark:text-white">Done - your search doesn&apos;t use a home now</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-600 dark:text-gray-300">{homeTown ? `Showing homes in ${homeTown} that fit your filters.` : 'Showing homes that fit your filters.'}{outcome && (outcome.added || outcome.removed) ? ` ${[outcome.added ? `+${outcome.added} new` : '', outcome.removed ? `${outcome.removed} gone` : ''].filter(Boolean).join(', ')}.` : ''}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-lg font-black text-[#111827] dark:text-white">Stop using {homeStreet}?</p>
                <p className="mt-1.5 text-sm font-semibold leading-relaxed text-gray-700 dark:text-gray-200">
                  Your search will show homes {homeTown ? <>in <b>{homeTown}</b> </> : ''}that fit your price and bedrooms. Homes won&apos;t get a match % any more. You can pick a home again anytime.
                </p>
                {errorLine}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={() => setConfirmNoHome(false)} disabled={isSubmitting}
                    className="h-12 rounded-2xl border-2 border-gray-300 bg-white text-xs font-black uppercase tracking-widest text-[#111827] transition-colors hover:border-[#111827] disabled:opacity-50 dark:border-white/25 dark:bg-transparent dark:text-white">Keep the home</motion.button>
                  <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={stopUsingHome} disabled={isSubmitting}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white disabled:opacity-60 dark:bg-white dark:text-[#111827]">
                    {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving</> : 'Stop using it'}
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="choices" className="space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}>
        <p className="px-1 pt-1 text-xs font-black uppercase tracking-widest text-gray-400">What do you want to do?</p>
        {choice('filters', <SlidersHorizontal className="h-5 w-5" />, 'Change my filters', builtAround ? 'Price, bedrooms, or how far away' : 'Price, bedrooms, or where', () => setStep('edit'), 0)}
        {choice('home', <Home className="h-5 w-5" />, builtAround ? 'Pick a different home' : 'Use a home I like', builtAround ? 'Find homes like another home' : "We'll find homes like it", () => openPicker('choose'), 1)}
        {builtAround && choice('nohome', <X className="h-5 w-5" />, 'Stop using a home', 'Just show homes that fit my filters', () => { setConfirmNoHome(true); setError('') }, 2)}
        {onSendMessage && choice('ask', <MessageSquareText className="h-5 w-5" />, `Ask ${agentFirst} to change it`, 'Send a quick note', () => { setMode('ask'); setError('') }, builtAround ? 3 : 2)}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    )
    const back = (to: () => void) => (
      <button type="button" onClick={to} className="inline-flex items-center gap-1.5 text-[12px] font-black text-gray-500 hover:text-[#111827] dark:hover:text-white">
        <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back
      </button>
    )
    // ---- screen: pick a home
    const pickBody = (
      <div className="space-y-3 px-5 py-5 sm:px-7">
        {back(() => { setStep(pickFrom); setCompareQuery('') })}
        <p className="text-[15px] font-semibold leading-snug text-gray-700 dark:text-gray-200">Type the address of a home you like. We&apos;ll find homes like it nearby.</p>
        {compareSearch}
      </div>
    )
    const asking = mode === 'ask' && onSendMessage
    const screen = asking ? 'ask' : step
    const prevScreen = prevScreenRef.current
    if (prevScreen !== screen) {
      screenDirRef.current = pickedHomeRef.current || SCREEN_DEPTH[screen] > SCREEN_DEPTH[prevScreen] ? 1 : -1
      pickedHomeRef.current = false
      prevScreenRef.current = screen
    }
    const screenDir = screenDirRef.current

    return shell({
      xl: true,
      icon: <SlidersHorizontal className="h-5 w-5" />, kicker: 'Your Showcase', title: asking ? `Message ${agentFirst}` : step === 'choose' ? 'Change your search' : step === 'pick' ? 'Pick a home' : 'Your search',
      headerSide: step === 'edit' ? messageAgent : undefined,
      children: (
        <AutoHeight>
          <AnimatePresence mode="wait" initial={false} custom={screenDir}>
            <motion.div key={screen} custom={screenDir} variants={screenSlide} initial="enter" animate="center" exit="exit">
              {asking ? (
        <div className="space-y-4 px-5 py-5 sm:px-7">
          {!askSent && (
            <button type="button" onClick={() => setMode('edit')} className="inline-flex items-center gap-1.5 text-[12px] font-black text-gray-500 hover:text-[#111827] dark:hover:text-white">
              <ArrowRight className="h-3.5 w-3.5 rotate-180" /> Back
            </button>
          )}
          {askPane}
        </div>
      ) : step === 'choose' ? chooseBody : step === 'pick' ? pickBody : (
        <div className="space-y-4 bg-[#FAFAF7] px-4 py-5 dark:bg-[#0f0f11] sm:px-6">
          {focus === 'all' && back(() => { resetToSaved(); setStep('choose') })}
          {/* Phones: the home on top. Desktop: it sits above price, beside the distance picker
              (fills what was empty space under Bedrooms). */}
          <div className="md:hidden">{homeRow}</div>
          <div className="grid items-stretch gap-4 md:grid-cols-2">
            <div>{whereCard}</div>
            <div className="flex flex-col gap-4">
              <div className="hidden md:block">{homeRow}</div>
              {priceCard}
              {bedsCard}
            </div>
          </div>
          {moreCard}
          {errorLine}
        </div>
      )}
            </motion.div>
          </AnimatePresence>
        </AutoHeight>
      ),
      footer: (
        <AnimatePresence initial={false}>
          {!asking && step === 'edit' && (
            <motion.div key="save" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } }} exit={{ opacity: 0, y: 18, transition: { duration: 0.14 } }}>
              {saveBar('Save', startOver)}
            </motion.div>
          )}
        </AnimatePresence>
      ),
    })
  }

  return shell({
    wide: true, summary: true,
    icon: <SlidersHorizontal className="h-5 w-5" />, kicker: 'Your Showcase', title: 'Refine your search',
    children: (
      <div>
        {onSendMessage && (
          <div className="px-5 pt-4 sm:px-7">
            <div className="relative flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-white/[0.06]">
              {([['edit', 'Edit it myself', SlidersHorizontal], ['ask', 'Ask my agent', MessageSquareText]] as const).map(([k, label, Icon]) => (
                <button key={k} type="button" onClick={() => { setMode(k); setError('') }}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors ${mode === k ? 'text-[#111827] dark:text-white' : 'text-gray-500 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white'}`}>
                  {mode === k && <motion.span layoutId="rf-mode" className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-white/10" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                  <Icon className="relative h-3.5 w-3.5" /><span className="relative">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'ask' && onSendMessage ? (
            <motion.div key="ask" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="space-y-4 px-5 py-5 sm:px-7">
              {askPane}
            </motion.div>
          ) : (
            <motion.div key="edit" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="space-y-3 bg-[#FAFAF7] px-4 py-4 dark:bg-[#0f0f11] sm:px-6">
              {Section({
                i: 0, icon: <Scale className="h-4 w-4" />, title: audience === 'agent' ? 'Compare to' : 'Match % measured against', hint: audience === 'agent' ? 'optional' : undefined, set: !!selectedCompareProperty, children: audience !== 'agent' ? (
                  <div className="space-y-2">
                    {selectedCompareProperty
                      ? compareCard(selectedCompareProperty)
                      : <p className="rounded-2xl bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">No match % on this Showcase.</p>}
                    {askAgentCompare}
                    {selectedCompareProperty && rebuildButton}
                  </div>
                ) : (
                  <AnimatePresence mode="wait" initial={false}>
                  {selectedCompareProperty && !changingCompare ? (
                    <motion.div key={`chosen-${selectedCompareProperty.listingKey}`} className="space-y-2"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                      {compareCard(selectedCompareProperty)}
                      <div className="flex gap-2 px-1">
                        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} type="button" onClick={() => setChangingCompare(true)} className="rounded-full bg-[#C9A24D]/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-[#a8843a] transition-colors hover:bg-[#C9A24D]/25 dark:text-[#e8c97a]">Change</motion.button>
                        <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.94 }} type="button" onClick={() => setSelectedCompareProperty(null)} className="rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500">Stop comparing</motion.button>
                      </div>
                      {compareChanged && rebuildButton}
                    </motion.div>
                  ) : (
                    <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
                      {compareSearch}
                    </motion.div>
                  )}
                  </AnimatePresence>
                ),
              })}

              {Section({
                i: 1, icon: <Crosshair className="h-4 w-4" />, title: 'Where', set: !!(formData.address || formData.cities?.length || formData.school_districts?.length), children: (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Near an address</p>
                      <GooglePlacesAutocomplete
                        ref={googleAutocompleteRef}
                        value={formData.address || ''}
                        onChange={(addr) => setFormData(prev => ({ ...prev, address: addr, lat: null, long: null }))}
                        onCoordinatesChange={(lat, long) => setFormData(prev => ({ ...prev, lat, long }))}
                        placeholder={isUsingAreaSearch() ? 'Searching by town below' : 'Enter an address'}
                        disabled={isUsingAreaSearch()}
                      />
                      <AnimatePresence initial={false}>
                        {isUsingAddressSearch() && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="pt-3">{radiusPicker()}</div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-300 dark:text-gray-600"><span className="h-px flex-1 bg-current" />or<span className="h-px flex-1 bg-current" /></div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Towns &amp; school districts</p>
                        {(isUsingAreaSearch() || !!formData.school_districts?.length) && <button type="button" onClick={() => setFormData(prev => ({ ...prev, cities: [], school_districts: [] }))} className="text-[10px] font-black uppercase tracking-widest text-[#a8843a] hover:underline dark:text-[#e8c97a]">Clear</button>}
                      </div>
                      <MultiSelectDatabaseInput
                        values={formData.cities || []}
                        onChange={(cities) => setFormData(prev => ({ ...prev, cities, address: '', lat: null, long: null, diameter: null }))}
                        apiMethod={api.properties.citiesPublic}
                        placeholder="Search towns..."
                        disabled={isUsingAddressSearch()}
                      />
                      <MultiSelectDatabaseInput
                        values={formData.school_districts || []}
                        onChange={(school_districts) => setFormData(prev => ({ ...prev, school_districts }))}
                        apiMethod={api.properties.schoolDistrictsPublic}
                        placeholder={isUsingAddressSearch() ? 'Narrow to a school district...' : 'Search school districts...'}
                      />
                    </div>
                  </div>
                ),
              })}

              {Section({
                i: 2, icon: <DollarSign className="h-4 w-4" />, title: 'Price', set: !!(formData.min_price || formData.max_price), children: (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
                    {([['min_price', 'No min'], ['max_price', 'No max']] as const).map(([k, ph], idx) => (
                      <label key={k} className="relative block" style={{ gridColumn: idx === 0 ? 1 : 3, gridRow: 1 }}>
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">$</span>
                        <input type="text" inputMode="numeric" value={formatNumberWithCommas(formData[k])}
                          onChange={(e) => setFormData(prev => ({ ...prev, [k]: parseInt(stripCommas(e.target.value)) || null }))}
                          className={priceInput} placeholder={ph} aria-label={k === 'min_price' ? 'Minimum price' : 'Maximum price'} />
                      </label>
                    ))}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400" style={{ gridColumn: 2, gridRow: 1 }}>to</span>
                  </div>
                ),
              })}

              {Section({
                i: 3, icon: <BedDouble className="h-4 w-4" />, title: 'Bedrooms', hint: 'at least', set: !!formData.min_beds, children: (
                  chipRow(BEDS, formData.min_beds, v => setFormData(prev => ({ ...prev, min_beds: v, max_beds: prev.max_beds && v && prev.max_beds < v ? null : prev.max_beds })), 'rf-beds')
                ),
              })}

              {Section({
                i: 4, icon: <Bath className="h-4 w-4" />, title: 'Bathrooms', hint: 'at least', set: !!formData.min_baths, children: (
                  chipRow(BATHS, formData.min_baths, v => setFormData(prev => ({ ...prev, min_baths: v, max_baths: prev.max_baths && v && prev.max_baths < v ? null : prev.max_baths })), 'rf-baths')
                ),
              })}

              {hasSummary && Section({
                i: 5, icon: <Sparkles className="h-4 w-4" />, title: 'Also set by your agent', children: (
                  <div className="space-y-2">
                    {areaFilters.length > 0 && <div className="flex flex-wrap gap-1.5">{areaFilters.map(f => <span key={f} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">{f}</span>)}</div>}
                    {yearBuiltRange && <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Year built: {yearBuiltRange}</p>}
                    {specialFeatures && <p className="text-xs font-medium italic text-gray-500 dark:text-gray-400">&ldquo;{specialFeatures}&rdquo;</p>}
                  </div>
                ),
              })}
              {errorLine}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    ),
    footer: mode === 'edit' || !onSendMessage ? saveBar('Update search') : undefined,
  })
}

// Opens and closes with motion; starts from the current search each time it opens. Rendered at the
// end of <body> so an animated page around it can't trap the "fixed" window inside its own box.
export default function EditShowcaseCriteriaModal(props: EditShowcaseCriteriaModalProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return null
  return createPortal(
    <AnimatePresence>{props.isOpen && <EditShowcaseCriteriaWindow key={`adjust-search-${props.focus || 'all'}`} {...props} />}</AnimatePresence>,
    host,
  )
}
