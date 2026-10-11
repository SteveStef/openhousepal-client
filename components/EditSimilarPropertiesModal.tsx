'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { OpenHouse, SearchPreferences } from '@/types'
import { SimilarPropertiesPreferencesView } from '@/app/open-houses/components/CreateOpenHouseWizard'
import api from '@/lib/api-service'
import { useToast } from '@/contexts/ToastContext'
import { roundedPriceRange } from '@/lib/utils'

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
  const bedOffset = (openHouse.bedrooms || 0) >= 8 ? 2 : 1
  const [preferences, setPreferences] = useState<SearchPreferences>({
    ...roundedPriceRange(openHouse.price || 0),
    minBeds: Math.max(0, (openHouse.bedrooms || 0) - bedOffset),
    // Never prefilled - baths vary too much within a genuinely comparable set of homes to guess a
    // sensible floor from the subject alone, same reasoning minAcres already gets left at "Any".
    minBaths: 0,
    minAcres: 0,
    radius: 5
  })
  const [similarProperties, setSimilarProperties] = useState<any[]>([])
  const [subjectProperty, setSubjectProperty] = useState<any>(openHouse)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(
    openHouse.similarPropertiesSnapshot?.map((p: any) => p.ListingKey || p.listingKey || p.id) || []
  )

  const handlePreferencesChange = useCallback(async (newPrefs: SearchPreferences) => {
    setPreferences(newPrefs)
    setIsLoading(true)
    
    const payload: any = {
      listingKey: openHouse.listingKey,
      city: openHouse.city,
      state: openHouse.state,
      zipcode: openHouse.zipcode,
      price: openHouse.price,
      bedrooms: openHouse.bedrooms,
      lat: openHouse.latitude,
      lng: openHouse.longitude,
      ...newPrefs
    }

    const getNormalizedAcres = (property: any) => {
      const explicitAcres = Number(
        property.LotSizeAcres
        ?? property.lotSizeAcres
        ?? property.lot_size_acres
        ?? property.acres
        ?? 0
      )
      const squareFeet = Number(
        property.LotSizeSquareFeet
        ?? property.lotSizeSquareFeet
        ?? property.lot_size
        ?? property.lotSize
        ?? 0
      )
      return explicitAcres || (squareFeet ? Number((squareFeet / 43560).toFixed(2)) : 0)
    }

    const normalizeSimilarProperty = (property: any) => {
      const acres = getNormalizedAcres(property)
      const squareFeet = Number(
        property.LotSizeSquareFeet
        ?? property.lotSizeSquareFeet
        ?? property.lot_size
        ?? property.lotSize
        ?? 0
      )

      return {
        ...property,
        LotSizeAcres: acres,
        lotSizeAcres: acres,
        LotSizeSquareFeet: squareFeet || (acres ? Math.round(acres * 43560) : undefined),
        lotSizeSquareFeet: squareFeet || (acres ? Math.round(acres * 43560) : undefined),
      }
    }

    const { success, data } = await api.properties.findSimilar(payload)
    if (success && data?.properties) {
      const normalizedProperties = await Promise.all(data.properties.map(async (property: any) => {
        const normalized = normalizeSimilarProperty(property)
        if (normalized.LotSizeAcres && (normalized.SchoolDistrictName || normalized.schoolDistrictName || normalized.school_district_name || normalized.schoolDistrict)) {
          return normalized
        }

        const listingKey = normalized.ListingKey || normalized.listingKey
        if (!listingKey) return normalized

        const { success: detailSuccess, data: detailData } = await api.properties.lookup({ listingKey })
        if (!detailSuccess || !detailData) return normalized

        return normalizeSimilarProperty({
          ...normalized,
          ...detailData,
          LotSizeAcres: detailData.LotSizeAcres ?? detailData.lotSizeAcres ?? detailData.lot_size_acres ?? normalized.LotSizeAcres,
          acres: detailData.LotSizeAcres ?? detailData.lotSizeAcres ?? detailData.lot_size_acres ?? normalized.acres,
          SchoolDistrictName: detailData.SchoolDistrictName ?? detailData.schoolDistrictName ?? detailData.school_district_name ?? normalized.SchoolDistrictName,
          schoolDistrictName: detailData.SchoolDistrictName ?? detailData.schoolDistrictName ?? detailData.school_district_name ?? normalized.schoolDistrictName,
          schoolDistrict: detailData.SchoolDistrictName ?? detailData.schoolDistrictName ?? detailData.school_district_name ?? normalized.schoolDistrict,
        })
      }))
      setSimilarProperties(normalizedProperties)
      setIsLoading(false)
      return normalizedProperties
    }
    setIsLoading(false)
    return []
  }, [openHouse])

  useEffect(() => {
    let cancelled = false
    const loadSubjectDetails = async () => {
      const listingKey = openHouse.listingKey || (openHouse as any).ListingKey
      if (!listingKey) {
        setSubjectProperty(openHouse)
        return
      }

      const { success, data } = await api.properties.lookup({ listingKey })
      if (cancelled) return
      const savedOpenHouse: any = openHouse

      setSubjectProperty({
        ...openHouse,
        ...(success && data ? data : {}),
        SchoolDistrictName: data?.SchoolDistrictName ?? data?.schoolDistrictName ?? data?.school_district_name ?? savedOpenHouse.schoolDistrict,
        schoolDistrictName: data?.SchoolDistrictName ?? data?.schoolDistrictName ?? data?.school_district_name ?? savedOpenHouse.schoolDistrict,
        schoolDistrict: data?.SchoolDistrictName ?? data?.schoolDistrictName ?? data?.school_district_name ?? savedOpenHouse.schoolDistrict,
        LotSizeAcres: data?.LotSizeAcres ?? data?.lotSizeAcres ?? data?.lot_size_acres ?? savedOpenHouse.acres,
        acres: data?.LotSizeAcres ?? data?.lotSizeAcres ?? data?.lot_size_acres ?? savedOpenHouse.acres,
      })
    }

    loadSubjectDetails()
    return () => {
      cancelled = true
    }
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
      <div className="absolute inset-0 bg-black/60 " onClick={onClose} />
      
      <div className="relative flex h-[85vh] w-full max-w-7xl flex-col overflow-hidden animate-fadeIn transition-all duration-300">
        <SimilarPropertiesPreferencesView
          preferences={preferences}
          address={openHouse.address}
          subjectProperty={subjectProperty}
          properties={similarProperties}
          isLoading={isLoading}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onPreferencesChange={handlePreferencesChange}
          onNext={() => handleSave(selectedIds)}
          onBack={onClose}
        />
      </div>
    </div>
  )
}
