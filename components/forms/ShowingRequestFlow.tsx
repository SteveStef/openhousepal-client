'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, BedDouble, Bath, CalendarDays, Check, ChevronRight, Hourglass, Loader2, MapPin, Ruler, Search, X } from 'lucide-react'
import ScheduleTourModal from '@/components/ScheduleTourModal'
import TourStatusWindow, { tourState } from '@/components/TourStatusWindow'
import api, { resolveMediaUrl, type PublicHomeSuggestion } from '@/lib/api-service'
import type { Property, PublicFormConfig, ShowingStatus, TourRequest } from '@/types'

// Schedule a Showing, as its own flow instead of question-by-question: (1) find the home - our
// listings with their photos as they type, (2) the same "Private showing" window the Showcase
// uses (pick up to 3 times, your details), (3) the same Pending screen. The request is remembered
// on this device, so coming back to the link shows it as Pending - or Confirmed once the agent
// confirms a time (Forms -> Results). Still a real form submission underneath (lead, stats, email).

type Home = {
  address: string
  street: string
  place: string
  photo?: string | null
  listingKey?: string | null
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  mine?: boolean
}

// The question ids this flow answers - a showing form with anything else on it keeps the classic
// one-question-at-a-time runner (see canUseShowingFlow).
const FLOW_QUESTION_IDS = new Set(['property_of_interest', 'preferred_times', 'contact_info'])
export function canUseShowingFlow(form: PublicFormConfig) {
  if (form.formType !== 'showing') return false
  const asked = form.questions.filter(q => q.type !== 'statement')
  return asked.some(q => q.id === 'property_of_interest') && asked.every(q => FLOW_QUESTION_IDS.has(q.id))
}

const storeKey = (formId: string) => `ohp-showings:${formId}`
const readIds = (formId: string): string[] => {
  try { const v = JSON.parse(localStorage.getItem(storeKey(formId)) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] }
}
const writeIds = (formId: string, ids: string[]) => {
  try { localStorage.setItem(storeKey(formId), JSON.stringify(ids.slice(0, 10))) } catch { /* private mode */ }
}

const titleCase = (v?: string | null) => {
  const t = String(v || '').trim()
  return t && t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, c) => a + c.toUpperCase()) : t
}
const money = (n?: number | null) => (n ? `$${Math.round(n).toLocaleString()}` : '')
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('')

function homeFromSuggestion(s: PublicHomeSuggestion): Home {
  const parts = s.address.split(',').map(p => p.trim())
  const street = s.street || parts[0]
  const place = s.city ? [s.city, [s.state, s.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : parts.slice(1).join(', ')
  return {
    address: s.address, street: titleCase(street), place, photo: s.photo ? resolveMediaUrl(s.photo) || s.photo : null,
    listingKey: s.listing_key || null, price: s.price, beds: s.beds, baths: s.baths, sqft: s.sqft, mine: s.mine,
  }
}

function homeFromTyped(text: string): Home {
  const parts = text.split(',').map(p => p.trim()).filter(Boolean)
  return { address: text.trim(), street: titleCase(parts[0] || text.trim()), place: parts.slice(1).join(', ') }
}

// What ScheduleTourModal reads off a listing.
function toProperty(home: Home): Property {
  const placeParts = home.place.split(',').map(p => p.trim())
  const [state = '', zip = ''] = (placeParts[1] || '').split(/\s+/)
  return {
    id: home.listingKey || 'typed', ListingKey: home.listingKey || '', FullStreetAddress: home.street,
    City: placeParts[0] || '', StateOrProvince: state, PostalCode: zip, MlsStatus: 'Active',
    ListPictureURL: home.photo || undefined, BedroomsTotal: home.beds || undefined, BathroomsTotal: home.baths || undefined,
    LivingArea: home.sqft || undefined, ListPrice: home.price || undefined,
  } as unknown as Property
}

export default function ShowingRequestFlow({ form, agentSlug, formSlug, prefillAddress, onSubmitAnswers, onProgress, onComplete }: {
  form: PublicFormConfig
  agentSlug: string
  formSlug: string
  /** A page that already knows the home (e.g. a listing's "Schedule a showing" link). */
  prefillAddress?: string
  onSubmitAnswers: (answers: { questionId: string; value: unknown }[]) => Promise<{ success: boolean; message?: string; submissionId?: string }>
  onProgress?: (stepIndex: number, questionId: string | null, completed: boolean, answers: Record<string, unknown>) => void
  /** Embedded in another page's window: called once they're done. */
  onComplete?: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublicHomeSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState('')
  const [home, setHome] = useState<Home | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [status, setStatus] = useState<ShowingStatus | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const sentId = useRef<string | null>(null)
  const autoPick = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const agentFirst = (form.agentName || '').trim().split(' ')[0]

  const loadStatus = useCallback(async (id: string, open: boolean) => {
    const r = await api.public.getShowingStatus(agentSlug, formSlug, id)
    if (r.success && r.data) {
      setStatus(r.data)
      if (open) setStatusOpen(true)
      return true
    }
    // Deleted on the agent's side - forget it on this device.
    writeIds(form.formId, readIds(form.formId).filter(x => x !== id))
    return false
  }, [agentSlug, formSlug, form.formId])

  // Coming back to the link: their latest request opens as Pending / Confirmed.
  useEffect(() => {
    onProgress?.(0, null, false, {})
    const [latest] = readIds(form.formId)
    if (latest) loadStatus(latest, true)
    if (form.linkedProperty?.address) {
      const lp = form.linkedProperty
      setHome({
        address: [lp.address, lp.city, [lp.state, lp.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        street: titleCase(lp.address.split(',')[0]), place: [titleCase(lp.city), [lp.state, lp.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        photo: lp.image_url ? resolveMediaUrl(lp.image_url) || lp.image_url : null, listingKey: lp.listing_key || null,
        price: lp.price, beds: lp.beds, baths: lp.baths, sqft: lp.sqft,
      })
    } else if (prefillAddress) {
      // Opened from a home's own Tour / Showing button: that home is picked for them - they never
      // type an address OpenHousePal already knows (user, 10/18).
      autoPick.current = prefillAddress.trim()
      setQuery(prefillAddress)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Live suggestions while they type.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2 || home) { setResults([]); setSearched(''); return }
    let cancelled = false
    setSearching(true)
    const t = window.setTimeout(async () => {
      const r = await api.properties.addressesPublic(q, form.formId)
      if (cancelled) return
      const found = r.success && r.data ? r.data.results : []
      if (autoPick.current && autoPick.current === q) {
        autoPick.current = null
        const street = (q.split(',')[0] || '').trim().toLowerCase()
        const match = found.find(x => (x.street || x.address.split(',')[0] || '').trim().toLowerCase() === street) || (found.length === 1 ? found[0] : null)
        setSearching(false)
        choose(match ? homeFromSuggestion(match) : homeFromTyped(q))
        return
      }
      setResults(found)
      setSearched(q)
      setSearching(false)
    }, 200)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [query, home, form.formId])

  const choose = (h: Home) => {
    setHome(h)
    setResults([])
    onProgress?.(1, 'property_of_interest', false, { property_of_interest: h.address })
    // A beat to let the card land, then the window.
    window.setTimeout(() => setTourOpen(true), 260)
  }

  const changeHome = () => {
    setHome(null)
    setQuery('')
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const submit = async (d: TourRequest) => {
    if (!home) throw new Error('Pick a home first.')
    const answers = [
      { questionId: 'property_of_interest', value: home.address },
      { questionId: 'property_listing_key', value: home.listingKey || '' },
      { questionId: 'preferred_date_1', value: d.preferredDate },
      { questionId: 'preferred_time_1', value: d.preferredTime },
      { questionId: 'preferred_date_2', value: d.preferredDate2 || '' },
      { questionId: 'preferred_time_2', value: d.preferredTime2 || '' },
      { questionId: 'preferred_date_3', value: d.preferredDate3 || '' },
      { questionId: 'preferred_time_3', value: d.preferredTime3 || '' },
      { questionId: 'full_name', value: d.visitorName || '' },
      { questionId: 'email', value: d.visitorContact || '' },
      { questionId: 'phone', value: d.visitorPhone || '' },
      { questionId: 'showing_note', value: d.message || '' },
    ].filter(a => a.value !== '')
    const res = await onSubmitAnswers(answers)
    if (!res.success) throw new Error(res.message || 'That didn’t go through - please try again.')
    onProgress?.(3, 'contact_info', true, Object.fromEntries(answers.map(a => [a.questionId, a.value])))
    if (res.submissionId) {
      sentId.current = res.submissionId
      writeIds(form.formId, [res.submissionId, ...readIds(form.formId).filter(x => x !== res.submissionId)])
    }
  }

  const closeTour = () => {
    setTourOpen(false)
    const id = sentId.current
    if (!id) return
    sentId.current = null
    // The "sent" moment hands off to the same Pending screen they'll see if they come back.
    window.setTimeout(() => { loadStatus(id, true) }, 320)
  }

  const closeStatus = () => {
    setStatusOpen(false)
    if (onComplete) onComplete()
  }

  const requestAnother = () => {
    setStatusOpen(false)
    changeHome()
  }

  const facts = (h: Home) => [
    h.beds ? { icon: BedDouble, label: `${h.beds} bd` } : null,
    h.baths ? { icon: Bath, label: `${h.baths} ba` } : null,
    h.sqft ? { icon: Ruler, label: `${Number(h.sqft).toLocaleString()} sqft` } : null,
  ].filter(Boolean) as { icon: typeof BedDouble; label: string }[]

  const state = tourState(status)
  const statusHome = useMemo(() => status ? {
    photo: status.home.photo ? resolveMediaUrl(status.home.photo) || status.home.photo : null,
    street: titleCase(status.home.street || status.home.address.split(',')[0]),
    place: [status.home.city, [status.home.state, status.home.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') || status.home.address.split(',').slice(1).join(',').trim(),
  } : null, [status])

  const q = query.trim()
  const showTyped = !home && q.length >= 4 && searched === q && !searching

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden px-4 pb-20 pt-8 sm:pb-16 sm:pt-10">
      <style>{SHOWING_CSS}</style>
      {/* the lit backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="showing-orb absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.28),transparent)] dark:bg-[radial-gradient(closest-side,rgba(201,162,77,.2),transparent)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/70 to-transparent" />
      </div>

      {/* agent */}
      {form.showBranding && form.agentName && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5 rounded-full border border-black/[0.06] bg-white/80 py-1.5 pl-1.5 pr-4 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
          {form.agentPhotoUrl
            ? <img src={form.agentPhotoUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-[#C9A24D]" />
            : <span className="grid h-8 w-8 place-items-center rounded-full bg-[#C9A24D] text-[11px] font-black text-white">{initials(form.agentName)}</span>}
          <span className="leading-tight">
            <span className="block font-serif text-sm font-black text-[#111827] dark:text-white">{form.agentName}</span>
            {form.agentBrokerage && <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{form.agentBrokerage}</span>}
          </span>
        </motion.div>
      )}

      {/* their earlier request */}
      {status && !statusOpen && (
        <motion.button type="button" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} onClick={() => setStatusOpen(true)}
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] shadow-sm transition hover:-translate-y-0.5 ${state === 'pending' ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-emerald-600 text-white'}`}>
          {state === 'pending' ? <Hourglass className="h-3.5 w-3.5 text-amber-400 dark:text-amber-500" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          Your showing · {state === 'pending' ? 'Pending' : state === 'done' ? 'Toured' : 'Confirmed'}
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </motion.button>
      )}

      {/* headline */}
      <div className="mt-8 max-w-xl text-center sm:mt-12">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#a8843a] dark:text-[#e8c97a]">
          <CalendarDays className="h-3.5 w-3.5" /> Private showing
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 26 }}
          className="mt-3 font-serif text-4xl font-black leading-[1.05] tracking-tight text-[#111827] dark:text-white sm:text-5xl">
          {form.headline || form.title || 'Schedule a Showing'}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="mx-auto mt-3 max-w-md text-[15px] font-medium text-gray-500 dark:text-gray-400">
          {home ? 'Great choice. Pick a few times that work and you’re done.' : (form.subtitle || 'Find the home you’d like to see - it takes about a minute.')}
        </motion.p>
      </div>

      {/* step 1: the home */}
      <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, type: 'spring', stiffness: 240, damping: 28 }}
        className="mt-8 w-full max-w-xl">
        <AnimatePresence mode="wait" initial={false}>
          {!home ? (
            <motion.div key="find" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.18 }}
              className="rounded-[28px] border border-black/[0.06] bg-white p-2 shadow-[0_30px_80px_-40px_rgba(17,24,39,.45)] dark:border-white/[0.08] dark:bg-[#141416]">
              <label className="flex items-center gap-3 rounded-[22px] bg-[#FAFAF7] px-4 transition focus-within:ring-4 focus-within:ring-[#C9A24D]/20 dark:bg-[#0b0b0c]">
                <Search className="h-5 w-5 shrink-0 text-[#C9A24D]" />
                <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} autoFocus autoComplete="off"
                  onKeyDown={e => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); choose(homeFromSuggestion(results[0])) } }}
                  placeholder="Start typing the address…" aria-label="Which home would you like to see?"
                  className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] outline-none placeholder:font-medium placeholder:text-gray-400 dark:text-white sm:h-16 sm:text-lg" />
                {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" />}
                {!searching && q && <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Clear" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>}
              </label>

              <AnimatePresence initial={false}>
                {(results.length > 0 || showTyped) && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                    className="overflow-hidden" role="listbox">
                    <div className="space-y-1 px-1 pb-1 pt-2">
                      {results.map((s, i) => {
                        const h = homeFromSuggestion(s)
                        return (
                          <motion.li key={s.address} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                            <button type="button" onClick={() => choose(h)}
                              className="group flex w-full items-center gap-3.5 rounded-2xl p-2 text-left transition hover:bg-[#C9A24D]/[0.08] focus:bg-[#C9A24D]/[0.08] focus:outline-none">
                              <span className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.06] sm:h-16 sm:w-24">
                                {h.photo ? <img src={h.photo} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <MapPin className="absolute inset-0 m-auto h-5 w-5 text-gray-300" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-serif text-[16px] font-black leading-snug text-[#111827] [overflow-wrap:anywhere] dark:text-white sm:text-[17px]">{h.street}</span>
                                {h.place && <span className="block truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{h.place}</span>}
                                <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] font-black text-[#7a5f22] dark:text-[#e8c97a]">
                                  {money(h.price) && <span>{money(h.price)}</span>}
                                  {facts(h).map(f => <span key={f.label} className="font-bold text-gray-400">{f.label}</span>)}
                                </span>
                              </span>
                              <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#C9A24D]" />
                            </button>
                          </motion.li>
                        )
                      })}
                      {showTyped && (
                        <li>
                          <button type="button" onClick={() => choose(homeFromTyped(q))}
                            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-gray-200 px-3 py-3 text-left text-sm font-semibold text-gray-500 transition hover:border-[#C9A24D] hover:text-[#111827] dark:border-white/10 dark:text-gray-400 dark:hover:text-white">
                            <MapPin className="h-4 w-4 shrink-0 text-[#C9A24D]" />
                            <span className="min-w-0 flex-1 truncate">{results.length ? 'Not one of these? ' : 'Not listed here? '}Use <span className="font-black text-[#111827] dark:text-white">“{q}”</span></span>
                          </button>
                        </li>
                      )}
                    </div>
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key="chosen" initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_30px_80px_-40px_rgba(17,24,39,.55)] dark:border-white/[0.08] dark:bg-[#141416]">
              <div className="relative isolate aspect-[16/9] overflow-hidden bg-[#0b0b0c] text-white">
                {home.photo && <img src={home.photo} alt="" className="showing-ken absolute inset-0 -z-20 h-full w-full object-cover" />}
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.4),transparent_55%),linear-gradient(180deg,rgba(11,11,12,.05),rgba(11,11,12,.85))]" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] "><Check className="h-3 w-3" strokeWidth={3} /> Your home</span>
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="font-serif text-2xl font-black leading-tight sm:text-3xl">{home.street}</p>
                  {home.place && <p className="mt-0.5 text-sm font-semibold text-white/75">{home.place}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#e8c97a]">
                    {money(home.price) && <span>{money(home.price)}</span>}
                    {facts(home).map(f => <span key={f.label} className="inline-flex items-center gap-1 text-white/80"><f.icon className="h-3.5 w-3.5" />{f.label}</span>)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3">
                <button type="button" onClick={changeHome} className="rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">Change home</button>
                <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => setTourOpen(true)}
                  className="showing-shine relative ml-auto inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white shadow-[0_16px_34px_-14px_rgba(17,24,39,.9)] dark:bg-white dark:text-[#111827] sm:flex-none sm:px-9">
                  <CalendarDays className="h-4 w-4" /> Pick your times
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!home && (
          <motion.ol initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-6 flex items-center justify-center gap-1.5 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.1em] text-gray-400 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em]">
            {['Find the home', 'Pick your times', 'Get confirmed'].map((label, i) => (
              <li key={label} className="flex items-center gap-1.5 sm:gap-2">
                {i > 0 && <span className="hidden h-px w-5 bg-gray-300 dark:bg-white/15 sm:block" />}
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[9px] ${i === 0 ? 'bg-[#C9A24D] text-[#111827]' : 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>{i + 1}</span>
                <span className={i === 0 ? 'text-[#111827] dark:text-white' : ''}>{label}</span>
              </li>
            ))}
          </motion.ol>
        )}
      </motion.div>

      <ScheduleTourModal
        property={home ? toProperty(home) : null}
        isOpen={tourOpen}
        onClose={closeTour}
        onSubmit={submit}
        showContactFields
        contactStyle="full"
        // Only times the agent is free (their connected calendar) - user, 10/18.
        loadBusy={() => api.public.getHubBusy(agentSlug)}
      />
      <TourStatusWindow
        tour={statusOpen ? status : null}
        address={statusHome?.street}
        agentName={form.agentName}
        home={statusHome}
        onClose={closeStatus}
        onRequestAnother={requestAnother}
      />
    </div>
  )
}

const SHOWING_CSS = `
.showing-orb{animation:showingOrb 9s ease-in-out infinite alternate}
@keyframes showingOrb{from{transform:translateX(-50%) scale(1)}to{transform:translateX(-46%) scale(1.08)}}
.showing-ken{animation:showingKen 14s ease-out both}
@keyframes showingKen{from{transform:scale(1.12)}to{transform:scale(1.01)}}
.showing-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-100%);animation:showingShine 3.4s ease-in-out infinite}
@keyframes showingShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.showing-orb,.showing-ken,.showing-shine:after{animation:none}}
`
