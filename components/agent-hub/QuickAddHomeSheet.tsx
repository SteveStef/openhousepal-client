'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Home, ImagePlus, MapPin, Sparkles, X } from 'lucide-react'
import OhSheet from '@/components/open-house-manager/OhSheet'
import api, { resolveMediaUrl } from '@/lib/api-service'

// Quick-add for a home the agent types in themselves (No-MLS plans add every sale and listing this
// way; Bright plans use it for anything the MLS doesn't have). One window, three short steps -
// Where / Details / Photos - a pull-up sheet on phones (drag down to close), a centred window on a
// computer. Saves into the same Agent Hub lists (Recent Sales / My Listings) that feed the public
// hub, email signature, Brag Sheet and Studio's property picker.

export type QuickHomeKind = 'sale' | 'listing'

export type QuickHome = {
  street: string; city: string; state: string; zipcode: string
  price: string; date: string; status: string
  beds: string; baths: string; sqft: string
  photos: string[]
}

const EMPTY: QuickHome = { street: '', city: '', state: '', zipcode: '', price: '', date: '', status: 'Active', beds: '', baths: '', sqft: '', photos: [] }
const LISTING_STATUSES = ['Active', 'Coming Soon', 'Pending', 'Under Contract']
const BEDS = ['1', '2', '3', '4', '5', '6']
const BATHS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '5']
const STEPS = ['Where', 'Details', 'Photos'] as const
const MAX_PHOTOS = 8

export default function QuickAddHomeSheet({ open, onClose, kind, initial, onSave, zClass }: {
  open: boolean
  zClass?: string
  onClose: () => void
  kind: QuickHomeKind
  initial?: Partial<QuickHome> | null
  onSave: (home: QuickHome) => void | Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [h, setH] = useState<QuickHome>(EMPTY)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const photosRef = useRef<string[]>([])
  photosRef.current = h.photos

  // Fresh each time it opens (or the home being edited).
  useEffect(() => {
    if (!open) return
    setStep(0); setDir(1); setError(''); setSaving(false)
    setH({ ...EMPTY, ...(initial || {}), photos: initial?.photos || [] })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<QuickHome>) => { setH(cur => ({ ...cur, ...patch })); setError('') }
  const isSale = kind === 'sale'

  const stepMissing = (i: number): string => {
    if (i === 0) {
      if (!h.street.trim()) return 'Add the street address'
      if (!h.city.trim()) return 'Add the city'
      if (!/^[A-Za-z]{2}$/.test(h.state.trim())) return 'Add the state (2 letters)'
      if (!/^\d{5}$/.test(h.zipcode.trim())) return 'Add the 5-digit ZIP'
    }
    if (i === 1) {
      if (!(Number(h.price) > 0)) return isSale ? 'Add the sold price' : 'Add the list price'
      if (isSale && Number(h.price) < 100000) return 'Sales under $100k aren\'t shown'
      if (isSale && !h.date) return 'Add the closing date'
    }
    if (i === 2) {
      if (uploading) return 'Photos are still uploading'
      if (!h.photos.length) return 'Add at least one photo'
    }
    return ''
  }
  const missing = stepMissing(step)

  const go = (next: number) => { setDir(next > step ? 1 : -1); setStep(next) }
  const advance = async () => {
    if (missing) { setError(missing); return }
    if (step < STEPS.length - 1) { go(step + 1); return }
    setSaving(true)
    try { await onSave({ ...h, state: h.state.trim().toUpperCase() }) } finally { setSaving(false) }
  }

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files).slice(0, Math.max(0, MAX_PHOTOS - h.photos.length))
    setUploading(n => n + list.length)
    for (const file of list) {
      try {
        const res = await api.agentHub.uploadSalePhoto(file)
        if (res.success && res.data?.photo_url) {
          const next = [...photosRef.current, resolveMediaUrl(res.data.photo_url)]
          photosRef.current = next
          setH(cur => ({ ...cur, photos: next }))
        } else setError(res.error || 'A photo didn\'t upload - try a JPG under 5MB.')
      } catch { setError('A photo didn\'t upload - try a JPG under 5MB.') }
      setUploading(n => n - 1)
    }
  }

  const input = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base font-semibold text-[#0B0B0B] placeholder-gray-400 shadow-sm transition focus:border-[#C9A24D] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:placeholder-gray-500 sm:text-sm'
  const label = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400'
  const chip = (on: boolean) => `h-11 rounded-xl border px-2 text-sm font-black transition active:scale-95 ${on ? 'border-[#111827] bg-[#111827] text-white shadow-md dark:border-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]' : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-200'}`
  const money = (v: string) => (v ? Number(v).toLocaleString() : '')

  return (
    <OhSheet
      open={open}
      onClose={onClose}
      zClass={zClass}
      width="max-w-xl"
      icon={isSale ? <Sparkles className="h-5 w-5" /> : <Home className="h-5 w-5" />}
      title={initial?.street ? (isSale ? 'Edit this sale' : 'Edit this listing') : (isSale ? 'Add a sale' : 'Add a listing')}
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
      footer={
        <div className="flex items-center gap-2">
          {step > 0 ? (
            <button type="button" onClick={() => go(step - 1)} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gray-200 bg-white text-gray-600 transition active:scale-95 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={onClose} className="h-12 shrink-0 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-black text-gray-600 transition active:scale-95 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300">Cancel</button>
          )}
          <div className="flex flex-1 items-center justify-center gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <motion.span key={s} className="h-1.5 rounded-full bg-[#C9A24D]" initial={false}
                animate={{ width: i === step ? 22 : 8, opacity: i <= step ? 1 : 0.3 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
            ))}
          </div>
          <button type="button" onClick={advance} disabled={saving}
            className={`flex h-12 shrink-0 items-center gap-1.5 rounded-2xl px-5 text-sm font-black shadow-lg transition active:scale-95 ${missing ? 'bg-gray-200 text-gray-500 dark:bg-white/10 dark:text-gray-400' : 'bg-[#111827] text-white dark:bg-[#e8c97a] dark:text-[#111827]'}`}>
            {step < STEPS.length - 1 ? <>Next <ArrowRight className="h-4 w-4" /></> : saving ? 'Saving...' : <>{initial?.street ? 'Save' : isSale ? 'Add sale' : 'Add listing'} <Check className="h-4 w-4" strokeWidth={3} /></>}
          </button>
        </div>
      }
    >
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={step} custom={dir}
            initial={{ opacity: 0, x: dir * 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -36 }}
            transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}>
            {step === 0 && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 font-serif text-lg font-black text-[#111827] dark:text-white"><MapPin className="h-4 w-4 text-[#C9A24D]" /> Where is it?</p>
                <div>
                  <label className={label} htmlFor="qa-street">Street address</label>
                  <input id="qa-street" value={h.street} onChange={e => set({ street: e.target.value })} placeholder="123 Main St" autoComplete="address-line1" className={input} />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_6rem] gap-2.5">
                  <div className="min-w-0">
                    <label className={label} htmlFor="qa-city">City</label>
                    <input id="qa-city" value={h.city} onChange={e => set({ city: e.target.value })} placeholder="Wayne" autoComplete="address-level2" className={input} />
                  </div>
                  <div>
                    <label className={label} htmlFor="qa-state">State</label>
                    <input id="qa-state" value={h.state} onChange={e => set({ state: e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() })} placeholder="PA" autoComplete="address-level1" className={`${input} uppercase`} />
                  </div>
                  <div>
                    <label className={label} htmlFor="qa-zip">ZIP</label>
                    <input id="qa-zip" value={h.zipcode} onChange={e => set({ zipcode: e.target.value.replace(/\D/g, '').slice(0, 5) })} placeholder="19087" inputMode="numeric" autoComplete="postal-code" className={input} />
                  </div>
                </div>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={label} htmlFor="qa-price">{isSale ? 'Sold price' : 'List price'}</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400 sm:text-sm">$</span>
                      <input id="qa-price" value={money(h.price)} onChange={e => set({ price: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="625,000" inputMode="numeric" className={`${input} pl-7`} />
                    </div>
                  </div>
                  {isSale ? (
                    <div>
                      <label className={label} htmlFor="qa-date">Closed on</label>
                      <input id="qa-date" type="date" value={h.date} max={new Date().toISOString().slice(0, 10)} onChange={e => set({ date: e.target.value })} className={input} />
                    </div>
                  ) : (
                    <div>
                      <label className={label} htmlFor="qa-sqft">Square feet</label>
                      <input id="qa-sqft" value={money(h.sqft)} onChange={e => set({ sqft: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="2,400" inputMode="numeric" className={input} />
                    </div>
                  )}
                </div>
                {!isSale && (
                  <div>
                    <p className={label}>Status</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {LISTING_STATUSES.map(s => <button key={s} type="button" onClick={() => set({ status: s })} className={chip(h.status === s)}>{s}</button>)}
                    </div>
                  </div>
                )}
                <div>
                  <p className={label}>Bedrooms <span className="normal-case tracking-normal text-gray-400">· optional</span></p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {BEDS.map(b => <button key={b} type="button" onClick={() => set({ beds: h.beds === b ? '' : b })} className={chip(h.beds === b)}>{b === '6' ? '6+' : b}</button>)}
                  </div>
                </div>
                <div>
                  <p className={label}>Bathrooms <span className="normal-case tracking-normal text-gray-400">· optional</span></p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                    {BATHS.map(b => <button key={b} type="button" onClick={() => set({ baths: h.baths === b ? '' : b })} className={chip(h.baths === b)}>{b === '5' ? '5+' : b}</button>)}
                  </div>
                </div>
                {isSale && (
                  <div className="max-w-[12rem]">
                    <label className={label} htmlFor="qa-sqft">Square feet <span className="normal-case tracking-normal text-gray-400">· optional</span></label>
                    <input id="qa-sqft" value={money(h.sqft)} onChange={e => set({ sqft: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="2,400" inputMode="numeric" className={input} />
                  </div>
                )}
              </div>
            )}
            {step === 2 && (
              <div>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 font-serif text-lg font-black text-[#111827] dark:text-white"><ImagePlus className="h-4 w-4 text-[#C9A24D]" /> Photos</p>
                  <p className="text-[11px] font-bold text-gray-400">{h.photos.length ? 'First = cover' : 'At least one'}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <AnimatePresence initial={false}>
                    {h.photos.map((url, i) => (
                      <motion.div key={url} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className={`relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-black ${i === 0 ? 'ring-[3px] ring-[#C9A24D]' : ''}`}>
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        {i === 0
                          ? <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#111827]">Cover</span>
                          : <button type="button" onClick={() => set({ photos: [url, ...h.photos.filter(p => p !== url)] })} className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Make cover</button>}
                        <button type="button" onClick={() => set({ photos: h.photos.filter(p => p !== url) })} aria-label="Remove photo" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" /></button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {Array.from({ length: uploading }).map((_, i) => (
                    <div key={`u${i}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/5">
                      <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#C9A24D]/30 border-t-[#C9A24D]" />
                    </div>
                  ))}
                  {h.photos.length + uploading < MAX_PHOTOS && (
                    <label className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#C9A24D]/45 bg-[#C9A24D]/[0.04] text-[#8b7355] transition hover:border-[#C9A24D] active:scale-[0.98] dark:text-[#e8c97a] ${h.photos.length ? 'aspect-square' : 'col-span-3 h-36'}`}>
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-[11px] font-black uppercase tracking-widest">{h.photos.length ? 'Add more' : 'Add photos'}</span>
                      {!h.photos.length && <span className="text-[11px] font-semibold text-gray-400">JPG under 5MB · pick several at once</span>}
                      <input type="file" accept="image/jpeg" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-center text-sm font-bold text-red-500">{error}</motion.p>
          )}
        </AnimatePresence>
      </div>
    </OhSheet>
  )
}

/** A quick-add result as an Agent Hub list entry (Recent Sales / My Listings). */
export function quickHomeToEntry(h: QuickHome, kind: QuickHomeKind, id?: string) {
  const address = `${h.street.trim()}, ${h.city.trim()}, ${h.state.trim().toUpperCase()} ${h.zipcode.trim()}`
  return {
    id: id || `manual-${Date.now()}`,
    address,
    city: h.city.trim(),
    state: h.state.trim().toUpperCase(),
    zipcode: h.zipcode.trim(),
    price: Number(h.price),
    status: kind === 'sale' ? 'Sold' : h.status,
    image: h.photos[0],
    photos: h.photos.length > 1 ? h.photos : undefined,
    ...(kind === 'sale' ? { sold_date: h.date } : {}),
    beds: h.beds ? Number(h.beds) : undefined,
    baths: h.baths ? Number(h.baths) : undefined,
    sqft: h.sqft ? Number(h.sqft) : undefined,
    visible: true,
    source: 'manual' as const,
  }
}
