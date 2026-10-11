'use client'

import { useEffect, useState } from 'react'
import { OpenHouse } from '@/types'
import { CheatSheetPhotoSelectionView } from '@/app/open-houses/components/CreateOpenHouseWizard'
import api from '@/lib/api-service'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

interface EditCheatSheetPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  openHouse: OpenHouse;
  onSuccess: () => void;
}

// Reuses the exact same photo-picker/re-drag view the creation wizard uses (CheatSheetPhotoSelectionView),
// so editing an already-created open house's Cheat Sheet photos is literally "open that editor
// again," not a second implementation that could drift from it.
export function EditCheatSheetPhotosModal({ isOpen, onClose, openHouse, onSuccess }: EditCheatSheetPhotosModalProps) {
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [propertyData, setPropertyData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setIsLoading(true)
    const listingKey = openHouse.listingKey || (openHouse as any).ListingKey
    if (!listingKey) {
      setPropertyData(null)
      setIsLoading(false)
      return
    }
    api.properties.lookup({ listingKey }).then(({ success, data }) => {
      if (cancelled) return
      setPropertyData(success && data ? data : null)
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [isOpen, openHouse.listingKey])

  const handleSave = async (selected: any[]) => {
    const { success, error } = await api.openHouses.updateCheatSheetPhotos(openHouse.id, selected)
    if (success) {
      showToast('Cheat Sheet photos updated', 'success')
      onSuccess()
      onClose()
    } else {
      showToast(error || 'Failed to update Cheat Sheet photos', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 " onClick={onClose} />

      <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col overflow-y-auto animate-fadeIn transition-all duration-300">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl bg-white p-16 dark:bg-[#151517]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C9A24D] border-t-transparent" />
          </div>
        ) : !propertyData ? (
          <div className="rounded-2xl bg-white p-10 text-center dark:bg-[#151517]">
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">This listing isn't linked to an MLS record, so its photos can't be edited here.</p>
            <button onClick={onClose} className="mt-4 rounded-xl bg-[#111827] px-4 py-2 text-sm font-black text-white dark:bg-white dark:text-[#111827]">Close</button>
          </div>
        ) : (
          <CheatSheetPhotoSelectionView
            propertyData={propertyData}
            address={openHouse.address}
            currentUser={currentUser}
            initialSelected={openHouse.cheatSheetPhotos}
            onNext={handleSave}
            onBack={onClose}
          />
        )}
      </div>
    </div>
  )
}
