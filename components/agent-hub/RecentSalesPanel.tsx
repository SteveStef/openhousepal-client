'use client'

import { HUB_ICON, HUB_ICON_TILE, HubCollapse, hubCardClass, useHubPanelOpen } from './HubPanelChrome'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, ChevronDown, ChevronRight, DollarSign, Pencil, Trash2 } from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { AgentSale, formatSaleStatus, getEligibleSales, getSaleStatusClass, getStreetOnly, SALES_ROTATION_POOL_SIZE, shouldAutoShowSale } from '@/lib/agentSales'

type ManualSaleDraft = { street: string; city: string; state: string; zipcode: string; price: string; closedDate: string; image: string }

// The Add/Edit manual-sale form - a single definition used both for the top "Manually Add" form
// and for an in-place edit expanded right at that sale's own spot in the list, so the two never
// drift out of sync with each other.
function ManualSaleForm({ editing, draft, onFieldChange, formatPriceInput, fileInputRef, uploading, uploadError, onPhotoChange, onSave, onCancel }: {
  editing: boolean
  draft: ManualSaleDraft
  onFieldChange: (field: keyof ManualSaleDraft, value: string) => void
  formatPriceInput: (raw: string) => string
  fileInputRef: React.RefObject<HTMLInputElement | null>
  uploading: boolean
  uploadError: string
  onPhotoChange: (file?: File) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-2xl border border-[#C9A24D]/30 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-3 text-sm font-black text-gray-800 dark:text-white">{editing ? 'Edit Sold Property' : 'Add Sold Property'}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Street Address</span>
          <input
            value={draft.street}
            onChange={(event) => onFieldChange('street', event.target.value)}
            placeholder="123 Main Street"
            className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <div className="grid grid-cols-3 gap-3 md:col-span-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">City</span>
            <input
              value={draft.city}
              onChange={(event) => onFieldChange('city', event.target.value)}
              placeholder="Dover"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">State</span>
            <input
              value={draft.state}
              onChange={(event) => onFieldChange('state', event.target.value)}
              placeholder="PA"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold uppercase outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Zip</span>
            <input
              value={draft.zipcode}
              onChange={(event) => onFieldChange('zipcode', event.target.value)}
              placeholder="19000"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Price</span>
            <input
              inputMode="decimal"
              value={formatPriceInput(draft.price)}
              onChange={(event) => onFieldChange('price', event.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="1,000,000"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Date Closed</span>
            <input
              type="date"
              value={draft.closedDate}
              onChange={(event) => onFieldChange('closedDate', event.target.value)}
              placeholder="mm/dd/yyyy"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-[#fbfaf7] px-4 py-3 text-sm font-semibold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>
        <label className="block md:col-span-2">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">Photo</span>
          {/* No preview box (and no gap for it) until there's actually a photo - it used to
              reserve an empty 80px slot to the file input's left even with nothing to show,
              which read as a layout bug. Once a photo exists it gets a bit of breathing room. */}
          <div className={`mt-2 flex items-center rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-gray-800 ${draft.image ? 'gap-4' : ''}`}>
            {draft.image && (
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${draft.image})` }} />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg"
              disabled={uploading}
              onChange={(event) => onPhotoChange(event.target.files?.[0])}
              className="block w-full cursor-pointer text-sm font-semibold transition-transform active:scale-[0.98] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#111827] file:px-3 file:py-2 file:text-sm file:font-black file:text-white file:transition-colors file:duration-150 hover:file:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {uploading && <p className="mt-1 text-xs font-semibold text-gray-400">Uploading photo...</p>}
          {uploadError && <p className="mt-1 text-xs font-semibold text-rose-500">{uploadError}</p>}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <motion.button
          type="button"
          onClick={onSave}
          disabled={uploading}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl bg-[#111827] px-4 py-3 text-sm font-black text-white shadow-sm transition-colors duration-150 hover:bg-black hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {editing ? 'Save Changes' : 'Add Sold Property'}
        </motion.button>
        <motion.button
          type="button"
          onClick={onCancel}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Cancel
        </motion.button>
      </div>
    </div>
  )
}

// Shared by both the Agent Hub editor (Studio > Site) and Settings - same component, same
// save path (onSave writes into the same Agent Hub config blob), so edits in either place
// are immediately reflected in the other the next time that page loads fresh data.
const MIN_PRICE_OPTIONS = [0, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000]

const formatMinPriceOption = (value: number) => value === 0 ? 'All' : `$${value / 1_000_000 >= 1 ? `${value / 1_000_000}M` : `${value / 1000}K`}+`

// A plain toggle row (label + always-visible description + switch) - replaces the earlier tight
// row of icon-chip toggles, which crammed onto one line on desktop but stacked into a cramped,
// hard-to-scan column on mobile with the description hidden behind a hover-only tooltip nobody on
// a phone could ever see.
export function SettingToggleRow({ label, hint, checked, onChange, accent = 'gold' }: { label: string; hint: string; checked: boolean; onChange: (next: boolean) => void; accent?: 'gold' | 'emerald' }) {
  // One gold "on" state for every hub toggle, no glow - `accent` kept only so older callers still
  // type-check (explicit ask: no colored/glowing toggles, one clean OpenHousePal style).
  void accent
  const onClass = 'bg-[#C9A24D]'
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wide text-gray-700 dark:text-gray-200">{label}</p>
        <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-400">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? onClass : 'bg-gray-300 dark:bg-gray-600'}`}
        aria-label={checked ? `Turn off ${label}` : `Turn on ${label}`}
        title={checked ? `Turn off ${label}` : `Turn on ${label}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

export default function RecentSalesPanel({ reLicenseNumber, agentSales, setAgentSales, showStats, setShowStats, carousel, setCarousel, autoScroll, setAutoScroll, minPrice, setMinPrice, onChange, onSave, plain = false, ready = true, incomplete }: {
  agentSales: AgentSale[]
  reLicenseNumber: string
  setAgentSales: React.Dispatch<React.SetStateAction<AgentSale[]>>
  showStats: boolean
  setShowStats: React.Dispatch<React.SetStateAction<boolean>>
  carousel: boolean
  setCarousel: React.Dispatch<React.SetStateAction<boolean>>
  autoScroll: boolean
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>
  // Minimum sold price a sale must clear to appear on the Agent Hub or rotate through the email
  // signature - independent of (and on top of) the per-sale Shown/Hidden toggle below. Lives on
  // the same shared Agent Hub config as everything else here, so it's the same value whether it's
  // edited from Settings or Studio > Site.
  minPrice: number
  setMinPrice: React.Dispatch<React.SetStateAction<number>>
  onChange: () => void
  onSave: (overrides?: { recentSales?: AgentSale[]; showSalesStats?: boolean; salesCarousel?: boolean; salesAutoScroll?: boolean; salesMinPrice?: number }) => void
  // Settings uses the plain look so this card matches the other white/bordered settings cards
  // instead of its own gold-gradient Studio > Site styling.
  plain?: boolean
  // False only while the parent's real saved Agent Hub config is still loading (Studio > Site
  // renders this panel immediately, before that async fetch resolves). Blocks the auto-load-if-
  // empty effect below from firing on a still-blank `agentSales` and saving that incomplete list
  // over whatever the agent actually has saved - see the caller for the full race description.
  // Settings pre-loads its config and only renders this panel afterward, so it defaults to true.
  ready?: boolean
  // When defined (Settings `plain` mode), shows the same Complete / Incomplete badge the other
  // settings cards use, right on this one large card. Undefined elsewhere = no badge.
  incomplete?: boolean
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useHubPanelOpen('sales')
  const [sortMode, setSortMode] = useState<'recent' | 'price-high' | 'price-low'>('recent')
  const [page, setPage] = useState(1)
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)
  const [manualSaleDraft, setManualSaleDraft] = useState({
    street: '',
    city: '',
    state: '',
    zipcode: '',
    price: '',
    closedDate: '',
    image: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [manualPhotoUploading, setManualPhotoUploading] = useState(false)
  const [manualPhotoError, setManualPhotoError] = useState('')
  const pageSize = 6
  const eligibleAgentSales = getEligibleSales(agentSales)
  const sortedSales = useMemo(() => {
    const sortable = [...eligibleAgentSales]
    if (sortMode === 'price-high') return sortable.sort((a, b) => (b.price || 0) - (a.price || 0))
    if (sortMode === 'price-low') return sortable.sort((a, b) => (a.price || 0) - (b.price || 0))
    return sortable.sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))
  }, [eligibleAgentSales, sortMode])
  const totalPages = Math.max(1, Math.ceil(sortedSales.length / pageSize))
  const visibleCount = eligibleAgentSales.filter(sale => sale.visible).length
  const pagedSales = sortedSales.slice((page - 1) * pageSize, page * pageSize)
  const pageNumbers = useMemo(() => {
    const maxButtons = 4
    const start = Math.min(Math.max(1, page - 1), Math.max(1, totalPages - maxButtons + 1))
    return Array.from({ length: Math.min(maxButtons, totalPages) }, (_, index) => start + index)
  }, [page, totalPages])

  const loadSales = async () => {
    setIsLoading(true)
    const salesResponse = await api.agentHub.getRecentSales(reLicenseNumber)
    const fetchedSales = getEligibleSales(salesResponse.success && salesResponse.data ? salesResponse.data : [])
    const currentById = new Map(agentSales.map(sale => [sale.id, sale]))
    const mergedFetched = fetchedSales.map(sale => ({
      ...sale,
      source: 'bright' as const,
      visible: currentById.get(sale.id)?.visible ?? shouldAutoShowSale(sale),
    }))

    // Manual entries are never re-fetched from anywhere - preserve them across every refresh.
    const manualSales = getEligibleSales(agentSales).filter(sale => sale.source === 'manual')

    const nextSales = [...manualSales, ...mergedFetched].sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))
    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
    setPage(1)
    setIsLoading(false)
  }

  useEffect(() => {
    if (ready && !getEligibleSales(agentSales).length) loadSales()
  }, [reLicenseNumber, ready])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const toggleSale = (id: string) => {
    const nextSales = getEligibleSales(agentSales).map(sale => sale.id === id ? { ...sale, visible: !sale.visible } : sale)
    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
  }

  const deleteManualSale = (id: string) => {
    const nextSales = getEligibleSales(agentSales).filter(sale => sale.id !== id)
    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
    if (editingSaleId === id) {
      setEditingSaleId(null)
      setManualAddOpen(false)
    }
    setPage(1)
  }

  const editManualSale = (sale: AgentSale) => {
    // Inline-edits in place at this card's own position in the list (see the AnimatePresence
    // swap per row below) rather than popping the shared "Add" form open at the top - that form
    // is reserved for adding a brand new sale, so make sure it's closed here.
    setManualAddOpen(false)
    setEditingSaleId(sale.id)
    setManualSaleDraft({
      street: getStreetOnly(sale.address),
      city: sale.city,
      state: sale.state,
      zipcode: sale.zipcode || '',
      price: sale.price ? String(sale.price) : '',
      closedDate: sale.sold_date || '',
      image: sale.image || '',
    })
  }

  const cancelManualForm = () => {
    setManualAddOpen(false)
    setEditingSaleId(null)
    setManualSaleDraft({ street: '', city: '', state: '', zipcode: '', price: '', closedDate: '', image: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const updateManualDraft = (field: keyof typeof manualSaleDraft, value: string) => {
    setManualSaleDraft(current => ({ ...current, [field]: value }))
    onChange()
  }

  // manualSaleDraft.price is kept as a clean digit string (see the price input's onChange) -
  // this only adds thousands commas for display, same live-formatting the price shows once saved.
  const formatPriceInput = (raw: string) => {
    if (!raw) return ''
    const [whole, decimal] = raw.split('.')
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return decimal !== undefined ? `${withCommas}.${decimal}` : withCommas
  }

  const handleManualPhoto = async (file?: File) => {
    if (!file) return
    setManualPhotoUploading(true)
    setManualPhotoError('')
    // Uploaded to the server rather than inlined as base64 - a data URI here would blow past
    // the Agent Hub config's 300KB save limit after just one or two photos, which silently
    // fails to save (the sale would look "added" in this editor but never actually persist).
    const response = await api.agentHub.uploadSalePhoto(file)
    if (response.success && response.data) {
      updateManualDraft('image', resolveMediaUrl(response.data.photo_url))
    } else {
      setManualPhotoError(response.error || 'Unable to upload photo. Please try a JPG under 5MB.')
    }
    setManualPhotoUploading(false)
  }

  const saveManualSale = () => {
    const street = manualSaleDraft.street.trim()
    const city = manualSaleDraft.city.trim()
    const state = manualSaleDraft.state.trim().toUpperCase()
    const zipcode = manualSaleDraft.zipcode.trim()
    const price = Number(String(manualSaleDraft.price).replace(/[^0-9.]/g, ''))
    const closedDate = manualSaleDraft.closedDate.trim()
    if (!street || !city || !state || !zipcode || !price || !closedDate || !manualSaleDraft.image.trim()) return

    const address = `${street}, ${city}, ${state} ${zipcode}`
    const eligibleSales = getEligibleSales(agentSales)
    const nextSales = (editingSaleId
      ? eligibleSales.map(sale => sale.id === editingSaleId
        ? { ...sale, address, city, state, zipcode, price, image: manualSaleDraft.image, sold_date: closedDate }
        : sale)
      : [...eligibleSales, {
          id: `manual-${Date.now()}`,
          address,
          city,
          state,
          zipcode,
          price,
          status: 'Sold',
          image: manualSaleDraft.image,
          sold_date: closedDate,
          visible: true,
          source: 'manual' as const,
        }]
    ).sort((a, b) => String(b.sold_date || '').localeCompare(String(a.sold_date || '')))

    setAgentSales(nextSales)
    onSave({ recentSales: nextSales })
    setManualSaleDraft({ street: '', city: '', state: '', zipcode: '', price: '', closedDate: '', image: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
    setManualAddOpen(false)
    setEditingSaleId(null)
    setPage(1)
  }

  return (
    <section className={plain
      ? `overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors duration-300 dark:bg-[#151517] ${incomplete ? 'border-red-300 dark:border-red-900/60' : 'border-gray-200 dark:border-gray-800'}`
      : hubCardClass(isOpen)}>
      {plain ? (
        <button type="button" onClick={() => setIsOpen(!isOpen)} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-xl font-black text-[#111827] dark:text-white">Recent Sales</h2>
              {incomplete !== undefined && (
                incomplete ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" /> Incomplete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Complete
                  </span>
                )
              )}
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:bg-gray-800 dark:text-gray-400">{visibleCount}/{eligibleAgentSales.length} shown</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">Pulled from your listing data based on your agent profile.</p>
          </div>
          <ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
      <div className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 p-5">
        <button onClick={() => setIsOpen(!isOpen)} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className={HUB_ICON_TILE}>
            <DollarSign className={HUB_ICON} />
          </span>
          <div>
            <h3 className="font-serif text-xl font-black text-[#111827] dark:text-white">Recent Sales</h3>
            <p className="mt-1 text-sm font-semibold text-gray-500 dark:text-gray-400">Pulled from your listing data based on your agent profile.</p>
          </div>
        </button>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-black text-gray-600 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300">{visibleCount}/{eligibleAgentSales.length}</span>
          <button onClick={() => setIsOpen(!isOpen)} className="rounded-xl border border-gray-200 bg-white p-3 text-gray-500 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-400" aria-label={`${isOpen ? 'Collapse' : 'Expand'} Recent Sales`}>
            <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      )}

      <HubCollapse open={isOpen}>
        <div className={plain ? 'border-t border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-[#151517] sm:p-6' : 'border-t border-gray-100 bg-[#fbfaf7] p-5 dark:border-gray-700 dark:bg-gray-800'}>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-300">Choose which sales appear on your public Agent Hub and rotate through your email signature.</p>

            <div className="mt-3 space-y-2">
              <SettingToggleRow
                label="Sold-price stats"
                hint="Shows your homes sold, total volume, and average price."
                checked={showStats}
                onChange={next => { setShowStats(next); onSave({ showSalesStats: next, recentSales: agentSales }); onChange() }}
              />
              <SettingToggleRow
                label="Carousel view"
                hint="On mobile, auto-swipes through one large sale at a time instead of a scrolling row."
                checked={carousel}
                onChange={next => { setCarousel(next); onSave({ salesCarousel: next, recentSales: agentSales }); onChange() }}
              />
              <SettingToggleRow
                label="Auto scroll"
                hint="Luxe theme only: the row glides on its own, taking turns with your other sections, when the page sits idle. Classic keeps the sales still."
                checked={autoScroll}
                onChange={next => { setAutoScroll(next); onSave({ salesAutoScroll: next, recentSales: agentSales }); onChange() }}
              />
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-[#fbfaf7] p-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-700 dark:text-gray-200">Min price to display</p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-400">
                    Hides any sale below this price, even if it's marked Shown - handy if you'd rather only show off your bigger sales. Your email signature rotates through your {SALES_ROTATION_POOL_SIZE} most recent sales that clear this price (or your active listing, if you have one).
                  </p>
                </div>
                <select
                  value={minPrice}
                  onChange={event => {
                    const next = Number(event.target.value)
                    setMinPrice(next)
                    onSave({ salesMinPrice: next, recentSales: agentSales })
                    onChange()
                  }}
                  className="ohp-select shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-black text-gray-800 shadow-sm outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                >
                  {MIN_PRICE_OPTIONS.map(value => (
                    <option key={value} value={value}>{formatMinPriceOption(value)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select value={sortMode} onChange={event => { setSortMode(event.target.value as 'recent' | 'price-high' | 'price-low'); setPage(1) }} className="ohp-select rounded-xl border bg-white px-4 py-2.5 text-sm font-black text-gray-800 shadow-sm dark:bg-[#0B0B0B] dark:text-white">
                <option value="recent">Newest</option>
                <option value="price-high">Price High</option>
                <option value="price-low">Price Low</option>
              </select>
              <button
                onClick={() => {
                  if (manualAddOpen) {
                    setManualAddOpen(false)
                  } else {
                    setEditingSaleId(null)
                    setManualSaleDraft({ street: '', city: '', state: '', zipcode: '', price: '', closedDate: '', image: '' })
                    setManualAddOpen(true)
                  }
                }}
                className={`rounded-xl border px-3.5 py-2.5 text-sm font-black shadow-sm ${manualAddOpen ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355]' : 'border-gray-200 bg-[#fbfaf7] text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-white'}`}
              >
                Manually Add
              </button>
              <button onClick={loadSales} disabled={isLoading} className="rounded-xl bg-[#111827] px-3.5 py-2.5 text-sm font-black text-white shadow-sm disabled:opacity-60">{isLoading ? 'Refreshing...' : 'Refresh Sales'}</button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {manualAddOpen && (
              <motion.div
                key="add-form"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.18 } }}
                className="mt-4 overflow-hidden"
              >
                <ManualSaleForm
                  editing={false}
                  draft={manualSaleDraft}
                  onFieldChange={updateManualDraft}
                  formatPriceInput={formatPriceInput}
                  fileInputRef={fileInputRef}
                  uploading={manualPhotoUploading}
                  uploadError={manualPhotoError}
                  onPhotoChange={handleManualPhoto}
                  onSave={saveManualSale}
                  onCancel={cancelManualForm}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* No inner max-height / scroll here on purpose - it trapped the mouse wheel so the
              page wouldn't scroll while hovering this list. Pagination (6 per page) keeps it short. */}
          <div className="mt-4 space-y-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {isLoading ? (
              <div className="rounded-2xl border border-gray-200 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500">Finding your recent sales...</div>
            ) : eligibleAgentSales.length ? (
              pagedSales.map(sale => (
                // Editing a manual sale expands the edit form right at this card's own position
                // in the list (AnimatePresence height/opacity swap) instead of popping a form open
                // elsewhere on the page - it was hard to tell anything had happened when it did.
                <AnimatePresence key={sale.id} mode="wait" initial={false}>
                  {editingSaleId === sale.id ? (
                    <motion.div
                      key="edit"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.18 } }}
                      className="overflow-hidden rounded-xl ring-2 ring-[#C9A24D]/50"
                    >
                      <ManualSaleForm
                        editing
                        draft={manualSaleDraft}
                        onFieldChange={updateManualDraft}
                        formatPriceInput={formatPriceInput}
                        fileInputRef={fileInputRef}
                        uploading={manualPhotoUploading}
                        uploadError={manualPhotoError}
                        onPhotoChange={handleManualPhoto}
                        onSave={saveManualSale}
                        onCancel={cancelManualForm}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`grid grid-cols-[56px_1fr_auto] items-center gap-2 rounded-xl border p-2.5 sm:grid-cols-[68px_1fr_auto] sm:gap-3 ${sale.visible ? 'border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900' : 'border-dashed border-gray-300 bg-gray-100 shadow-inner dark:border-gray-700 dark:bg-gray-950'}`}
                    >
                      <div className={`h-14 w-14 shrink-0 rounded-lg bg-cover bg-center sm:w-[68px] ${sale.visible ? '' : 'grayscale opacity-60'}`} style={{ backgroundImage: `url(${sale.image || '/placeholder.jpg'})` }} />
                      <div className="min-w-0 self-center">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${getSaleStatusClass(sale.status)}`}>{formatSaleStatus(sale.status)}</span>
                          {sale.source === 'manual' && <span className="rounded-full border border-[#C9A24D]/40 bg-[#C9A24D]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355]">Manual</span>}
                        </div>
                        <p className={`truncate text-sm font-black leading-snug ${sale.visible ? 'text-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{getStreetOnly(sale.address)}</p>
                        <p className={`mt-1 truncate text-sm font-semibold ${sale.visible ? 'text-gray-500 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>{[sale.city, sale.state].filter(Boolean).join(', ') || 'Location unavailable'}</p>
                      </div>
                      <div className="self-center text-right">
                        <p className={`whitespace-nowrap text-sm font-black ${sale.visible ? 'text-[#8b7355]' : 'text-gray-400 dark:text-gray-500'}`}>{sale.price ? `$${sale.price.toLocaleString()}` : 'No price'}</p>
                        <div className="mt-1 flex flex-nowrap items-center justify-end gap-2">
                          {sale.source === 'manual' && (
                            <>
                              <button
                                type="button"
                                onClick={() => editManualSale(sale)}
                                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-transform active:scale-90 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                aria-label="Edit manual sale"
                                title="Edit manual sale"
                              >
                                <Pencil className="ohp-icon-draw h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteManualSale(sale.id)}
                                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-transform active:scale-90"
                                aria-label="Delete manual sale"
                                title="Delete manual sale"
                              >
                                <Trash2 className="ohp-icon-draw h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleSale(sale.id)}
                            className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-black transition-transform active:scale-95 ${sale.visible ? 'border-[#C9A24D]/30 bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-300 bg-gray-200 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'}`}
                          >
                            {sale.visible ? 'Shown' : 'Hidden'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-[#fbfaf7] p-5 text-sm font-bold text-gray-500">
                {reLicenseNumber.trim() ? 'No matching sales or listings found for this RE License number yet.' : 'Add your RE License number first (Profile, or the License step in Setup) - then your sales and listings show up here.'}
              </div>
            )}
          </div>

          {eligibleAgentSales.length > pageSize && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-black text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              <span className="min-w-[96px] whitespace-nowrap leading-6">Page {page} of {totalPages}</span>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700" aria-label="Previous sales page">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
                {pageNumbers[0] > 1 && <span className="px-1 text-gray-400">...</span>}
                {pageNumbers.map(pageNumber => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    className={`min-w-10 rounded-lg border px-3 py-2 ${pageNumber === page ? 'border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b7355]' : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'}`}
                  >
                    {pageNumber}
                  </button>
                ))}
                {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="px-1 text-gray-400">...</span>}
                <button onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-40 dark:border-gray-700" aria-label="Next sales page">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </HubCollapse>
    </section>
  )
}
