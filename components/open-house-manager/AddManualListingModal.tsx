'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Plus, ImagePlus } from 'lucide-react'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'

export default function AddManualListingModal({ isOpen, onClose, onAdded }: { isOpen: boolean; onClose: () => void; onAdded: () => void }) {
  const { showToast } = useToast()
  const [draft, setDraft] = useState({ street: '', city: '', state: '', zipcode: '', price: '', beds: '', baths: '', sqft: '' })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Revoke the previous preview's object URL whenever it's replaced or the modal unmounts - these
  // aren't garbage-collected on their own like a data URL string would be.
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }, [])

  if (!isOpen) return null

  const update = (field: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [field]: value }))

  const handlePhoto = (file?: File) => {
    if (!file) return
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setPhotoFile(file)
    setPhotoPreviewUrl(url)
  }

  const reset = () => {
    setDraft({ street: '', city: '', state: '', zipcode: '', price: '', beds: '', baths: '', sqft: '' })
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
  }

  const handleSubmit = async () => {
    const address = draft.street.trim()
    const city = draft.city.trim()
    const state = draft.state.trim().toUpperCase()
    if (!address || !city || !state) {
      showToast('Address, city, and state are required.', 'error')
      return
    }
    setIsSaving(true)

    // Photo goes to S3 first (if provided) - image_url on the listing itself only ever accepts
    // the resulting S3 URL, never a raw file, so this upload has to complete before create.
    let imageUrl: string | undefined
    if (photoFile) {
      const uploadResult = await api.openHouseManager.uploadManualListingPhoto(photoFile)
      if (!uploadResult.success || !uploadResult.data) {
        setIsSaving(false)
        showToast(uploadResult.error || 'Unable to upload that photo.', 'error')
        return
      }
      imageUrl = uploadResult.data.photo_url
    }

    const { success, error } = await api.openHouseManager.addManualListing({
      address,
      city,
      state,
      zipcode: draft.zipcode.trim() || undefined,
      price: draft.price ? Number(String(draft.price).replace(/[^0-9.]/g, '')) : undefined,
      bedrooms: draft.beds ? Number(draft.beds) : undefined,
      bathrooms: draft.baths ? Number(draft.baths) : undefined,
      living_area: draft.sqft ? Number(String(draft.sqft).replace(/[^0-9.]/g, '')) : undefined,
      image_url: imageUrl,
    })
    setIsSaving(false)

    if (!success) {
      showToast(error || 'Unable to add this listing right now.', 'error')
      return
    }

    showToast('Listing added.', 'success')
    reset()
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#1A1A1C] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-gray-50 bg-gray-50/50 p-6 dark:border-gray-800/50 dark:bg-[#0B0B0B]/50">
          <h3 className="text-lg font-black uppercase tracking-tight text-[#111827] dark:text-white">Add a Listing</h3>
          <button onClick={onClose} className="shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/5" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Street address*</span>
            <input value={draft.street} onChange={e => update('street', e.target.value)} placeholder="123 Main St" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">City*</span>
              <input value={draft.city} onChange={e => update('city', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">State*</span>
              <input value={draft.state} onChange={e => update('state', e.target.value)} maxLength={2} placeholder="MD" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold uppercase outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">ZIP</span>
              <input value={draft.zipcode} onChange={e => update('zipcode', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Price</span>
            <input value={draft.price} onChange={e => update('price', e.target.value)} placeholder="750,000" className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Beds</span>
              <input value={draft.beds} onChange={e => update('beds', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Baths</span>
              <input value={draft.baths} onChange={e => update('baths', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sqft</span>
              <input value={draft.sqft} onChange={e => update('sqft', e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Photo</span>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 bg-cover bg-center dark:bg-gray-800" style={{ backgroundImage: photoPreviewUrl ? `url(${photoPreviewUrl})` : 'none' }}>
                {!photoPreviewUrl && <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-600"><ImagePlus size={18} /></div>}
              </div>
              <input type="file" accept="image/jpeg" onChange={e => handlePhoto(e.target.files?.[0])} className="flex-1 text-xs font-semibold text-gray-500 dark:text-gray-400" />
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-50 bg-gray-50/50 p-6 dark:border-gray-800/50 dark:bg-[#0B0B0B]/50">
          <button onClick={onClose} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 transition hover:text-gray-700 dark:hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C9A24D] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-[#C9A24D]/30 transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Listing
          </button>
        </div>
      </div>
    </div>
  )
}
