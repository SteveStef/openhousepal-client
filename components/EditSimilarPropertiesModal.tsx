'use client'

import React, { useState, useCallback } from 'react'
import { OpenHouse, SearchPreferences } from '@/types'
import { SimilarPropertiesPreferencesView, SimilarPropertiesSelectionView } from '@/app/open-houses/components/CreateOpenHouseWizard'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'

interface EditSimilarPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  openHouse: OpenHouse;
  onSuccess: () => void;
}

export function EditSimilarPropertiesModal({
  isOpen,
  onClose,
  openHouse,
  onSuccess
}: EditSimilarPropertiesModalProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<'PREFERENCES' | 'SELECTION'>('PREFERENCES')
  const [preferences, setPreferences] = useState<SearchPreferences>({
    minPrice: Math.max(0, Math.floor((openHouse.price || 0) * 0.8 / 10000) * 10000),
    maxPrice: Math.ceil((openHouse.price || 0) * 1.2 / 10000) * 10000,
    minBeds: Math.max(0, (openHouse.bedrooms || 0) - 1),
    minBaths: Math.max(0, (openHouse.bathrooms || 0) - 1),
    radius: 5
  })
  const [similarProperties, setSimilarProperties] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(
    openHouse.similarPropertiesSnapshot?.map((p: any) => p.ListingKey || p.listingKey || p.id) || []
  )

  const handleFindProperties = useCallback(async (newPrefs: SearchPreferences) => {
    setPreferences(newPrefs)
    setIsLoading(true)
    setStep('SELECTION')
    
    const payload: any = {
      listingKey: openHouse.listing_key,
      city: openHouse.city,
      state: openHouse.state,
      zipcode: openHouse.zipcode,
      price: openHouse.price,
      bedrooms: openHouse.bedrooms,
      lat: openHouse.latitude,
      lng: openHouse.longitude,
      ...newPrefs
    }

    const { success, data } = await api.properties.findSimilar(payload)
    if (success && data?.properties) {
      setSimilarProperties(data.properties)
    }
    setIsLoading(false)
  }, [openHouse])

  const handleSave = useCallback(async (newSelectedIds: (string | number)[]) => {
    const selectedSnapshot = similarProperties.filter(p => {
      const pId = String(p.ListingKey || p.listingKey || p.id);
      return newSelectedIds.map(sid => String(sid)).includes(pId);
    })

    const { success, error } = await api.openHouses.updateSnapshot(openHouse.id, selectedSnapshot)
    
    if (success) {
      showToast('Successfully updated similar properties snapshot', 'success')
      onSuccess()
      onClose()
    } else {
      showToast(error || 'Failed to update snapshot', 'error')
    }
  }, [openHouse.id, similarProperties, showToast, onSuccess, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className={`relative w-full max-w-7xl flex flex-col overflow-hidden animate-fadeIn transition-all duration-300 ${
        step === 'PREFERENCES' ? 'h-auto max-h-[70vh]' : 'h-[85vh]'
      }`}>
        {step === 'PREFERENCES' ? (
          <SimilarPropertiesPreferencesView
            preferences={preferences}
            address={openHouse.address}
            onFindProperties={handleFindProperties}
            onBack={onClose}
          />
        ) : (
          <SimilarPropertiesSelectionView
            properties={similarProperties}
            isLoading={isLoading}
            initialSelectedIds={selectedIds}
            onNext={handleSave}
            onBack={() => setStep('PREFERENCES')}
          />
        )}
      </div>
    </div>
  )
}
