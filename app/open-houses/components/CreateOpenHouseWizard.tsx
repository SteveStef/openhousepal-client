'use client'

import React, { useState, memo, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { PropertyRecommendationCard } from '@/components/PropertyRecommendationCard'
import PropertyDetailsModal from '@/components/PropertyDetailsModal'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { buildBragSheetData, buildCheatSheetAgentData } from '@/lib/bragSheetData'
import { useOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import { computeMatchScore, isSameSchoolDistrict } from '@/lib/matchScore'
import { roundedPriceRange } from '@/lib/utils'
import {
  OpenHouse,
  PropertyImage,
  SearchPreferences,
  OpenHouseWizardStep,
  User,
  PropertyDetailResponse
} from '@/types'
import { Bed, Bath, BoxSelect, DollarSign, LandPlot, Layout, QrCode, Sparkles, MapPin, Search, Layers, ArrowRight } from 'lucide-react'


interface CreateOpenHouseWizardProps {
  currentUser: User | null;
  onSuccess: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
  triggerPreview: (type: 'flyer' | 'recommendations' | 'bragSheet' | 'cheatSheet', id?: string, customData?: any) => void;
  formatAddress: (address: string) => string;
}

export function CreateOpenHouseWizard({
  currentUser,
  onSuccess,
  showToast,
  triggerPreview,
  formatAddress
}: CreateOpenHouseWizardProps) {
  const { listingAgentCount, hostCount } = useOpenHouseActionCounts()

  // Wizard State
  const [currentStep, setCurrentStep] = useState<OpenHouseWizardStep>('ADDRESS')
  
  // Data State
  const [address, setAddress] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<{ address: string, lat: number, lng: number, image?: string | null, status?: string | null, price?: number | null }[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [coordinates, setCoordinates] = useState<{ lat: number, lng: number } | null>(null)
  const [propertyData, setPropertyData] = useState<any>(null)
  const [isLoadingProperty, setIsLoadingProperty] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Handle clicking outside to close suggestions
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Similar Properties State
  const [similarProperties, setSimilarProperties] = useState<any[]>([])
  const [selectedSimilarPropertyIds, setSelectedSimilarPropertyIds] = useState<(string | number)[]>([])
  const [isLoadingNeighbors, setIsLoadingNeighbors] = useState(false)
  const [searchPreferences, setSearchPreferences] = useState<SearchPreferences>({
    minPrice: 0,
    maxPrice: 0,
    minBeds: 0,
    minBaths: 0,
    radius: 5
  })

  // Final Output State
  const [qrCode, setQrCode] = useState('')
  const [generatedOpenHouseId, setGeneratedOpenHouseId] = useState('')
  const [selectedImage, setSelectedImage] = useState<PropertyImage | null>(null)
  const [cheatSheetPhotos, setCheatSheetPhotos] = useState<any[]>([])
  const [selectedFeatures, setSelectedFeatures] = useState({
    signinSheet: true,
    similarProperties: true,
    bragSheet: true,
    cheatSheet: true
  })

  // --- HELPERS ---
  const formatStreetAndCity = (addr: string, city?: string) => {
    if (!addr) return "";
    const parts = addr.split(',');
    const street = parts[0].trim();
    const targetCity = city || (parts.length >= 2 ? parts[1].trim() : "");
    if (targetCity && !street.toLowerCase().includes(targetCity.toLowerCase())) {
      return `${street}, ${targetCity}`.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return street.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatMlsStatus = (status?: string | null) => {
    if (!status) return 'Status N/A'
    const normalized = status.replace(/-BRIGHT$/i, '').replace(/_/g, ' ').trim()
    if (/off\s*market/i.test(normalized)) return 'OFF MKT'
    if (/coming\s*soon/i.test(normalized)) return 'SOON'
    return normalized.toLowerCase().split(/\s+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const getSuggestionStatusPriority = (status?: string | null) => {
    const normalized = (status || '').replace(/-BRIGHT$/i, '').replace(/_/g, ' ').trim().toUpperCase()
    if (normalized === 'ACTIVE' || normalized === 'COMING SOON') return 0
    if (normalized.includes('PENDING') || normalized.includes('UNDER CONTRACT') || normalized.includes('CONTRACT')) return 1
    if (normalized.includes('CLOSED') || normalized.includes('SOLD')) return 2
    return 3
  }

  const sortAddressSuggestions = (items: any[], query: string) => {
    const normalizedQuery = query.trim().toLowerCase()
    return [...items].sort((a, b) => {
      const aStatus = a.status || a.homeStatus || a.home_status || a.MlsStatus
      const bStatus = b.status || b.homeStatus || b.home_status || b.MlsStatus
      const statusDiff = getSuggestionStatusPriority(aStatus) - getSuggestionStatusPriority(bStatus)
      if (statusDiff !== 0) return statusDiff

      const aStarts = String(a.address || '').toLowerCase().startsWith(normalizedQuery) ? 0 : 1
      const bStarts = String(b.address || '').toLowerCase().startsWith(normalizedQuery) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts

      return 0
    })
  }

  const getStatusBadgeClass = (status?: string | null) => {
    const normalized = (status || '').toLowerCase()
    if (normalized.includes('active') || normalized.includes('coming soon')) return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-600 dark:text-white dark:border-emerald-400'
    if (normalized.includes('sold') || normalized.includes('closed')) return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-600 dark:text-white dark:border-red-400'
    if (normalized.includes('pending') || normalized.includes('under contract') || normalized.includes('contract')) return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500 dark:text-[#111827] dark:border-yellow-300'
    return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-white dark:border-gray-500'
  }

  const formatSuggestionPrice = (price?: number | string | null) => {
    if (price == null || price === '') return 'Price N/A'
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) return 'Price N/A'
    return numericPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }

  // --- HANDLERS ---

  const handleTriggerPreview = async (mode: 'flyer' | 'recommendations' | 'bragSheet' | 'cheatSheet') => {
    if (mode === 'flyer') {
      const flyerData = {
        address: formatStreetAndCity(address, propertyData?.city || propertyData?.City),
        price: propertyData?.ListPrice || 0,
        beds: propertyData?.BedroomsTotal || 0,
        baths: propertyData?.BathroomsTotal || 0,
        sqft: propertyData?.LivingArea || propertyData?.livingArea || 0,
        coverImage: selectedImage?.url,
        coverImagePosition: { x: selectedImage?.x ?? 50, y: selectedImage?.y ?? 50 },
        openHouseUrl: `${window.location.origin}/open-house/${generatedOpenHouseId}`
      };
      triggerPreview('flyer', undefined, flyerData);
    } else if (mode === 'recommendations') {
      const currentSimilarProps = similarProperties.filter(p => {
        const pId = String(p.ListingKey || p.listingKey || p.id);
        return selectedSimilarPropertyIds.map(sid => String(sid)).includes(pId);
      }).map(p => ({ ...p, matchScore: computeMatchScore(p, propertyData) }));

      triggerPreview('recommendations', undefined, {
        address: formatStreetAndCity(address, propertyData?.city || propertyData?.City),
        properties: currentSimilarProps,
        openHouseEventId: generatedOpenHouseId,
      });
    } else if (mode === 'bragSheet') {
      const currentSimilarPropsForBragSheet = similarProperties.filter(p => {
        const pId = String(p.ListingKey || p.listingKey || p.id);
        return selectedSimilarPropertyIds.map(sid => String(sid)).includes(pId);
      });
      const { data, error: bragSheetError } = await buildBragSheetData(currentUser, currentSimilarPropsForBragSheet);
      if (!data) {
        showToast(bragSheetError || 'Unable to build your Brag Sheet right now.', 'error');
        return;
      }
      triggerPreview('bragSheet', undefined, data);
    } else if (mode === 'cheatSheet') {
      const listingKey = propertyData?.ListingKey || propertyData?.listing_key;
      const [amenitiesRes, cheatSheetAgent] = await Promise.all([
        listingKey ? api.properties.getNearbyAmenities(listingKey) : Promise.resolve(null),
        buildCheatSheetAgentData(currentUser),
      ]);
      triggerPreview('cheatSheet', undefined, {
        property: {
          id: propertyData?.id || propertyData?.ListingKey || propertyData?.listing_key,
          openHouseEventId: String(generatedOpenHouseId || ''),
          listingKey: propertyData?.ListingKey || propertyData?.listing_key || propertyData?.id,
          address: propertyData?.FullStreetAddress || propertyData?.street_address || address,
          city: propertyData?.city || propertyData?.City,
          state: propertyData?.state || propertyData?.StateOrProvince,
          latitude: propertyData?.latitude || propertyData?.Latitude || coordinates?.lat,
          longitude: propertyData?.longitude || propertyData?.Longitude || coordinates?.lng,
          googleRooftopLatitude: propertyData?.google_rooftop_latitude || propertyData?.googleRooftopLatitude,
          googleRooftopLongitude: propertyData?.google_rooftop_longitude || propertyData?.googleRooftopLongitude,
          googleGeocodeLocationType: propertyData?.google_geocode_location_type || propertyData?.googleGeocodeLocationType,
          price: propertyData?.ListPrice,
          originalListPrice: propertyData?.OriginalListPrice || propertyData?.original_list_price,
          previousListPrice: propertyData?.PreviousListPrice || propertyData?.raw_mls_data?.PreviousListPrice,
          priceChangeTimestamp: propertyData?.PriceChangeTimestamp || propertyData?.price_change_timestamp,
          majorChangeTimestamp: propertyData?.MajorChangeTimestamp || propertyData?.raw_mls_data?.MajorChangeTimestamp,
          majorChangeType: propertyData?.MajorChangeType || propertyData?.raw_mls_data?.MajorChangeType,
          beds: propertyData?.BedroomsTotal,
          baths: propertyData?.BathroomsTotal,
          sqft: propertyData?.LivingArea,
          aboveGradeSqft: propertyData?.AboveGradeFinishedArea,
          belowGradeSqft: propertyData?.BelowGradeFinishedArea,
          acres: propertyData?.LotSizeAcres,
          township: propertyData?.MLSAreaMajor,
          schoolDistrict: propertyData?.SchoolDistrictName,
          elementarySchool: propertyData?.ElementarySchool,
          middleSchool: propertyData?.MiddleOrJuniorSchool,
          highSchool: propertyData?.HighSchool,
          taxAnnualAmount: propertyData?.TaxAnnualAmount,
          taxYear: propertyData?.TaxYear,
          yearBuilt: propertyData?.YearBuilt || propertyData?.year_built,
          waterSource: propertyData?.WaterSource || propertyData?.water_source,
          sewer: propertyData?.Sewer || propertyData?.sewer,
          heating: propertyData?.Heating || propertyData?.heating,
          heatingFuel: propertyData?.HeatingFuel || propertyData?.heating_fuel,
          cooling: propertyData?.Cooling || propertyData?.cooling,
          hoaFee: propertyData?.AssociationFee || propertyData?.association_fee,
          hoaFeeFrequency: propertyData?.AssociationFeeFrequency || propertyData?.association_fee_frequency,
          hoaIncludes: propertyData?.AssociationFeeIncludes || propertyData?.association_fee_includes,
          description: propertyData?.PublicRemarks || propertyData?.description,
          photos: cheatSheetPhotos.length > 0 ? cheatSheetPhotos : (propertyData?.photos || []).slice(0, 3),
        },
        agent: cheatSheetAgent,
        amenities: amenitiesRes?.success ? amenitiesRes.data : undefined,
      });
    }
  }

  // Fetch internal address suggestions
  React.useEffect(() => {
    const fetchSuggestions = async () => {
      const query = address.trim()
      if (query.length < 3) {
        setAddressSuggestions([])
        return
      }

      setIsLoadingSuggestions(true)
      // An open house can only be hosted for an active for-sale listing - excludes rentals and
      // anything pending/under contract/closed/off-market.
      const { success, data } = await api.properties.address(query, { activeOnly: true, excludeRentals: true })
      if (success && data?.results) {
        const baseResults = data.results
        const needsHydration = baseResults.some((item: any) => !(item.image || item.imgSrc || item.img_src || item.ListPictureURL) || !(item.status || item.homeStatus || item.home_status || item.MlsStatus) || !(item.price || item.ListPrice))
        if (needsHydration) {
          const hydratedResults = await Promise.all(baseResults.map(async (item: any) => {
            if ((item.image || item.imgSrc || item.img_src || item.ListPictureURL) && (item.status || item.homeStatus || item.home_status || item.MlsStatus) && (item.price || item.ListPrice)) {
              return item
            }
            const lookup = await api.properties.lookup(item.address)
            if (!lookup.success || !lookup.data) return item
            const p: any = lookup.data
            const image = item.image || item.imgSrc || item.img_src || item.ListPictureURL || p.ListPictureURL || p.img_src || p.imgSrc || p.image || (Array.isArray(p.photos) ? p.photos[0] : undefined)
            const status = item.status || item.homeStatus || item.home_status || item.MlsStatus || p.MlsStatus || p.home_status || p.homeStatus
              const price = item.price || item.ListPrice || p.ListPrice || p.price
              return { ...item, image, imgSrc: image, ListPictureURL: image, status, homeStatus: status, MlsStatus: status, price, ListPrice: price }
            }))
          setAddressSuggestions(sortAddressSuggestions(hydratedResults, query))
        } else {
          setAddressSuggestions(sortAddressSuggestions(baseResults, query))
        }
      }
      setIsLoadingSuggestions(false)
    }

    const timeoutId = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timeoutId)
  }, [address])

  const generateQRCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!address.trim()) {
      setError('Please enter a property address')
      return
    }

    setIsGenerating(true)
    setIsLoadingProperty(true)

    let searchAddress = address
    let searchCoords = coordinates

    // If no coordinates are set (user didn't click a suggestion), 
    // try to use the first suggestion from our internal list
    if (!searchCoords && addressSuggestions.length > 0) {
      const topMatch = addressSuggestions[0]
      searchAddress = topMatch.address
      searchCoords = { lat: topMatch.lat, lng: topMatch.lng }
      
      // Update local state so UI stays in sync
      setAddress(searchAddress)
      setCoordinates(searchCoords)
      setShowAddressSuggestions(false)
    }

    if (!searchAddress || !searchCoords) {
      setError('Please select a valid property from the suggestions.')
      setIsGenerating(false)
      setIsLoadingProperty(false)
      return
    }

    const { success, data, error } = await api.properties.lookup(searchAddress)
    
    if (success && data) {
      setPropertyData(data)
      const hasImages = (data.photos && data.photos.length > 0) || data.ListPictureURL
      if (hasImages) {
        const price = data.ListPrice || 0
        const beds = data.BedroomsTotal || 0
        const bedOffset = beds >= 8 ? 2 : 1

        setSearchPreferences({
          ...roundedPriceRange(price),
          minBeds: Math.max(0, beds - bedOffset),
          // Never prefilled - baths vary too much within a genuinely comparable set of homes to
          // guess a sensible floor from the subject alone, same reasoning minAcres is left at "Any".
          minBaths: 0,
          minAcres: 0,
          radius: 5
        })
        setCurrentStep('PREFERENCES')
      } else {
        setError('Cannot create an open house for this property. No images are available.')
      }
    } else {
      setError(`Failed to fetch property data: ${error || 'Unknown error'}`)
    }
    
    setIsGenerating(false)
    setIsLoadingProperty(false)
  }

  const fetchSimilarProperties = async (data: any, autoSelect = false, preferences?: SearchPreferences) => {
    setIsLoadingNeighbors(true)
    
    const payload: any = {
      listingKey: data.ListingKey || data.listing_key,
      city: data.City || data.city,
      state: data.StateOrProvince || data.state,
      zipcode: data.PostalCode || data.zipcode,
      price: data.ListPrice || data.price,
      bedrooms: data.BedroomsTotal || data.bedrooms
    }

    if (preferences) {
      payload.minPrice = preferences.minPrice
      payload.maxPrice = preferences.maxPrice
      payload.minBeds = preferences.minBeds
      payload.minBaths = preferences.minBaths
      payload.minAcres = preferences.minAcres
      payload.radius = preferences.radius
    }

    if (coordinates) {
      payload.lat = coordinates.lat
      payload.lng = coordinates.lng
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

    const { success, data: responseData } = await api.properties.findSimilar(payload)

    if (success && responseData?.properties) {
      const normalizedProperties = await Promise.all(responseData.properties.map(async (property: any) => {
        const normalized = normalizeSimilarProperty(property)
        if (normalized.LotSizeAcres) return normalized

        const listingKey = normalized.ListingKey || normalized.listingKey
        if (!listingKey) return normalized

        const { success: detailSuccess, data: detailData } = await api.properties.lookup({ listingKey })
        if (!detailSuccess || !detailData) return normalized

        return normalizeSimilarProperty({
          ...normalized,
          ...detailData,
          LotSizeAcres: detailData.LotSizeAcres ?? detailData.lotSizeAcres ?? detailData.lot_size_acres ?? normalized.LotSizeAcres,
          acres: detailData.LotSizeAcres ?? detailData.lotSizeAcres ?? detailData.lot_size_acres ?? normalized.acres,
        })
      }))
      setSimilarProperties(normalizedProperties)
      
      if (autoSelect) {
        const topIds = normalizedProperties.slice(0, 12).map((p: any) => p.listingKey || p.ListingKey || p.id)
        setSelectedSimilarPropertyIds(topIds)
      }
      setIsLoadingNeighbors(false)
      return normalizedProperties
    }
    
    setIsLoadingNeighbors(false)
    return []
  }

  const handleSimilarPropertiesComplete = (selectedIds: (string | number)[]) => {
    setSelectedSimilarPropertyIds(selectedIds)
    setCurrentStep('COVER_IMAGE')
  }

  const handleSimilarPreferencesChange = useCallback(async (prefs: SearchPreferences) => {
    setSearchPreferences(prefs)
    return await fetchSimilarProperties(propertyData, false, prefs)
  }, [propertyData, coordinates])

  const handleImageSelect = (image: PropertyImage) => {
    setSelectedImage(image)

    const newEventId = uuidv4()
    setGeneratedOpenHouseId(newEventId)

    const baseUrl = window.location.origin
    const formUrl = `${baseUrl}/open-house/${newEventId}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formUrl)}&bgcolor=ffffff&color=1a1a1a`
    setQrCode(qrCodeUrl)

    setCurrentStep(selectedFeatures.cheatSheet ? 'CHEAT_SHEET_PHOTOS' : 'REVIEW')
  }

  const handleCheatSheetPhotosComplete = (photos: any[]) => {
    setCheatSheetPhotos(photos)
    setCurrentStep('REVIEW')
  }

  const saveOpenHouse = async () => {
    if (!currentUser || !propertyData || !selectedImage || !qrCode || !generatedOpenHouseId) {
      showToast('Missing required information to save open house', 'error')
      return
    }

    const selectedSnapshot = similarProperties.filter(p => {
      const pId = String(p.ListingKey || p.listingKey || p.id);
      return selectedSimilarPropertyIds.map(sid => String(sid)).includes(pId);
    })
    const savedCheatSheetPhotos = normalizeCheatSheetPhotosForSave(cheatSheetPhotos)
    const listingKey = propertyData?.ListingKey || propertyData?.listing_key
    let cheatSheetSnapshot

    if (selectedFeatures.cheatSheet) {
      const [amenitiesRes, cheatSheetAgent] = await Promise.all([
        listingKey ? api.properties.getNearbyAmenities(listingKey) : Promise.resolve(null),
        buildCheatSheetAgentData(currentUser),
      ])

      cheatSheetSnapshot = {
        property: {
          id: propertyData?.id || propertyData?.ListingKey || propertyData?.listing_key,
          openHouseEventId: String(generatedOpenHouseId || ''),
          listingKey: propertyData?.ListingKey || propertyData?.listing_key || propertyData?.id,
          address: propertyData?.FullStreetAddress || propertyData?.street_address || address,
          city: propertyData?.city || propertyData?.City,
          state: propertyData?.state || propertyData?.StateOrProvince,
          latitude: propertyData?.latitude || propertyData?.Latitude || coordinates?.lat,
          longitude: propertyData?.longitude || propertyData?.Longitude || coordinates?.lng,
          googleRooftopLatitude: propertyData?.google_rooftop_latitude || propertyData?.googleRooftopLatitude,
          googleRooftopLongitude: propertyData?.google_rooftop_longitude || propertyData?.googleRooftopLongitude,
          googleGeocodeLocationType: propertyData?.google_geocode_location_type || propertyData?.googleGeocodeLocationType,
          price: propertyData?.ListPrice,
          originalListPrice: propertyData?.OriginalListPrice || propertyData?.original_list_price,
          previousListPrice: propertyData?.PreviousListPrice || propertyData?.raw_mls_data?.PreviousListPrice,
          priceChangeTimestamp: propertyData?.PriceChangeTimestamp || propertyData?.price_change_timestamp,
          majorChangeTimestamp: propertyData?.MajorChangeTimestamp || propertyData?.raw_mls_data?.MajorChangeTimestamp,
          majorChangeType: propertyData?.MajorChangeType || propertyData?.raw_mls_data?.MajorChangeType,
          beds: propertyData?.BedroomsTotal,
          baths: propertyData?.BathroomsTotal,
          sqft: propertyData?.LivingArea,
          aboveGradeSqft: propertyData?.AboveGradeFinishedArea,
          belowGradeSqft: propertyData?.BelowGradeFinishedArea,
          acres: propertyData?.LotSizeAcres,
          township: propertyData?.MLSAreaMajor,
          schoolDistrict: propertyData?.SchoolDistrictName,
          elementarySchool: propertyData?.ElementarySchool,
          middleSchool: propertyData?.MiddleOrJuniorSchool,
          highSchool: propertyData?.HighSchool,
          taxAnnualAmount: propertyData?.TaxAnnualAmount,
          taxYear: propertyData?.TaxYear,
          yearBuilt: propertyData?.YearBuilt || propertyData?.year_built,
          waterSource: propertyData?.WaterSource || propertyData?.water_source,
          sewer: propertyData?.Sewer || propertyData?.sewer,
          heating: propertyData?.Heating || propertyData?.heating,
          heatingFuel: propertyData?.HeatingFuel || propertyData?.heating_fuel,
          cooling: propertyData?.Cooling || propertyData?.cooling,
          hoaFee: propertyData?.AssociationFee || propertyData?.association_fee,
          hoaFeeFrequency: propertyData?.AssociationFeeFrequency || propertyData?.association_fee_frequency,
          hoaIncludes: propertyData?.AssociationFeeIncludes || propertyData?.association_fee_includes,
          description: propertyData?.PublicRemarks || propertyData?.description,
          photos: savedCheatSheetPhotos.length > 0 ? savedCheatSheetPhotos : (propertyData?.photos || []).slice(0, 3),
        },
        agent: cheatSheetAgent,
        amenities: amenitiesRes?.success ? amenitiesRes.data : undefined,
      }
    }

    const { success, error } = await api.openHouses.create({
      address: String(address || ''),
      property_data: propertyData,
      coverImageUrl: String(selectedImage.url || ''),
      coverImagePosition: { x: selectedImage.x ?? 50, y: selectedImage.y ?? 50 },
      openHouseEventId: String(generatedOpenHouseId || ''),
      similarPropertiesSnapshot: selectedSnapshot,
      cheatSheetPhotos: selectedFeatures.cheatSheet ? savedCheatSheetPhotos : undefined,
      cheatSheetSnapshot: cheatSheetSnapshot
    })

    if (success) {
      await onSuccess()

      // Reset local state
      setAddress('')
      setPropertyData(null)
      setSelectedImage(null)
      setQrCode('')
      setGeneratedOpenHouseId('')
      setSelectedFeatures({ signinSheet: true, similarProperties: true, bragSheet: true, cheatSheet: true })
      setSelectedSimilarPropertyIds([])
      setCheatSheetPhotos([])
      setCurrentStep('ADDRESS')
      
      showToast('🎉 Open House created successfully!', 'success')
    } else {
      console.error('Error saving open house:', error)
      showToast(error || 'Failed to save open house. Please try again.', 'error')
    }
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={currentStep}
        layout
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9, layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
      >
      {currentStep === 'ADDRESS' ? (
        <div className="space-y-6 sm:space-y-8 w-full">
          <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl shadow-[#C9A24D]/[0.07] dark:shadow-black/40 border border-gray-200/60 dark:border-gray-800 p-5 sm:p-8 text-center relative transition-colors w-full">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl sm:rounded-3xl">
              <div className="absolute top-0 right-0 w-72 h-72 bg-[#C9A24D]/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#111827]/5 dark:bg-white/5 rounded-full blur-3xl -ml-32 -mb-32"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-40 bg-[#C9A24D]/5 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-3xl mx-auto w-full">
              <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-[#8b7355] to-gray-900 dark:from-white dark:via-[#C9A24D] dark:to-gray-200 tracking-tight mb-2 sm:mb-4 leading-tight py-1">
                Create Your Open House Kit
              </h1>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 font-light">
                Enter a property address to instantly generate a QR code, professional PDF flyer, and sign-in form.
              </p>

              <form onSubmit={generateQRCode} className="relative max-w-2xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row items-stretch w-full rounded-2xl sm:rounded-full bg-gray-50 dark:bg-[#0B0B0B] border-2 border-gray-100 dark:border-gray-800 focus-within:border-[#C9A24D] shadow-sm focus-within:shadow-[0_0_25px_rgba(201,162,77,0.12)] transition-all duration-300 p-1.5 gap-1.5 sm:gap-0">
                  <div className="relative flex-1 group w-full">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
                      <MapPin size={20} />
                    </div>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      autoComplete="off"
                      required
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value)
                        setShowAddressSuggestions(true)
                      }}
                      onFocus={() => setShowAddressSuggestions(true)}
                      placeholder="Enter property address..."
                      className="block w-full pl-11 pr-4 py-3.5 sm:py-3 bg-transparent rounded-xl text-base font-medium text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-all duration-300"
                    />

                    {/* Internal Address Suggestions Dropdown */}
                    {showAddressSuggestions && addressSuggestions.length > 0 && (
                      <div 
                        ref={suggestionsRef}
                        className="absolute z-[100] w-full mt-1 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-fadeIn"
                      >
                        {addressSuggestions.map((suggestion, index) => {
                          const suggestionImage = suggestion.image || (suggestion as any).imgSrc || (suggestion as any).img_src || (suggestion as any).ListPictureURL
                          const suggestionStatus = suggestion.status || (suggestion as any).homeStatus || (suggestion as any).home_status || (suggestion as any).MlsStatus
                          const suggestionPrice = suggestion.price || (suggestion as any).ListPrice
                          return (
                            <div
                              key={index}
                              onClick={() => {
                                setAddress(suggestion.address)
                                setCoordinates({ lat: suggestion.lat, lng: suggestion.lng })
                                setShowAddressSuggestions(false)
                              }}
                              className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-[#8b7355]/10 dark:border-gray-800 dark:hover:bg-[#C9A24D]/10"
                            >
                              <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-[#0B0B0B]">
                                {suggestionImage ? (
                                  <Image src={suggestionImage} alt="" fill sizes="56px" className="object-cover" unoptimized />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                                    <MapPin size={16} />
                                  </div>
                                )}
                                <div className="absolute inset-x-0 bottom-1 flex justify-center px-1">
                                  <span className={`max-w-full truncate rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase leading-none shadow-sm ${getStatusBadgeClass(suggestionStatus)}`}>
                                    {formatMlsStatus(suggestionStatus)}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-black text-gray-800 dark:text-gray-100">
                                  {suggestion.address.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                </div>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="inline-flex max-w-full items-center rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#8b7355] dark:border-[#C9A24D]/40 dark:bg-[#C9A24D]/15 dark:text-[#C9A24D]">
                                    {formatSuggestionPrice(suggestionPrice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isGenerating || isLoadingProperty}
                    className="w-full sm:w-auto px-8 py-3.5 sm:py-3 bg-gradient-to-r from-[#C9A24D] to-[#b8923f] text-white rounded-xl sm:rounded-full font-black text-xs uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#C9A24D]/25 hover:shadow-lg hover:shadow-[#C9A24D]/40 hover:brightness-105 active:scale-[0.98] flex items-center justify-center whitespace-nowrap sm:min-w-[160px] group/btn"
                  >
                    {isGenerating || isLoadingProperty ? (
                      <div className="w-5 h-5 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className="flex items-center">
                        <span>Generate Kit</span>
                        <Sparkles size={14} className="ml-2 text-white group-hover/btn:scale-120 group-hover/btn:rotate-12 transition-transform" />
                      </div>
                    )}
                  </button>
                </div>
                {error && (
                  <div className="mt-3 text-center animate-fadeIn">
                    <p className="text-red-500 text-sm font-medium flex items-center justify-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {error}
                    </p>
                  </div>
                )}
              </form>

              {/* Quick Navigation */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <Link
                  href="/discovery"
                  className="group relative flex items-center gap-4 rounded-2xl border-2 border-[#C9A24D]/30 bg-gradient-to-br from-[#C9A24D]/10 via-white to-white dark:from-[#C9A24D]/15 dark:via-[#1A1A1C] dark:to-[#1A1A1C] p-4 sm:p-5 shadow-sm transition-all duration-300 hover:border-[#C9A24D] hover:shadow-lg hover:shadow-[#C9A24D]/15 hover:-translate-y-0.5"
                >
                  {/* Clipped separately from the card so it doesn't also clip the notification badge below, which pokes past this corner on purpose. */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#C9A24D]/10 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:bg-[#C9A24D]/20" />
                  </div>
                  {hostCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white ring-2 ring-white dark:ring-[#151517] shadow-lg shadow-red-500/40">
                      {hostCount > 9 ? '9+' : hostCount}
                    </span>
                  )}
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#b8923f] text-white shadow-md shadow-[#C9A24D]/25 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                    <Search size={22} strokeWidth={2.5} />
                  </div>
                  <div className="relative min-w-0 flex-1 text-left">
                    <div className="text-sm font-black text-gray-900 dark:text-white">Find Open Houses</div>
                    <div className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Discover brokerage listings near you</div>
                  </div>
                  <ArrowRight size={18} strokeWidth={2.5} className="relative hidden shrink-0 -translate-x-1 text-gray-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-[#C9A24D] group-hover:opacity-100 dark:text-gray-600 sm:block" />
                </Link>

                <Link
                  href="/open-houses/my-listings"
                  className="group relative flex items-center gap-4 rounded-2xl border-2 border-[#C9A24D]/30 bg-gradient-to-br from-[#C9A24D]/10 via-white to-white dark:from-[#C9A24D]/15 dark:via-[#1A1A1C] dark:to-[#1A1A1C] p-4 sm:p-5 shadow-sm transition-all duration-300 hover:border-[#C9A24D] hover:shadow-lg hover:shadow-[#C9A24D]/15 hover:-translate-y-0.5"
                >
                  {/* Clipped separately from the card so it doesn't also clip the notification badge below, which pokes past this corner on purpose. */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#C9A24D]/10 blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:bg-[#C9A24D]/20" />
                  </div>
                  {listingAgentCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white ring-2 ring-white dark:ring-[#151517] shadow-lg shadow-red-500/40">
                      {listingAgentCount > 9 ? '9+' : listingAgentCount}
                    </span>
                  )}
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#b8923f] text-white shadow-md shadow-[#C9A24D]/25 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
                    <Layers size={22} strokeWidth={2.5} />
                  </div>
                  <div className="relative min-w-0 flex-1 text-left">
                    <div className="text-sm font-black text-gray-900 dark:text-white">My Listings</div>
                    <div className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Manage hosts &amp; view insights</div>
                  </div>
                  <ArrowRight size={18} strokeWidth={2.5} className="relative hidden shrink-0 -translate-x-1 text-gray-300 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:text-[#C9A24D] group-hover:opacity-100 dark:text-gray-600 sm:block" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : currentStep === 'PREFERENCES' ? (
        <SimilarPropertiesPreferencesView
          preferences={searchPreferences}
          address={address}
          subjectProperty={propertyData}
          properties={similarProperties}
          isLoading={isLoadingNeighbors}
          selectedIds={selectedSimilarPropertyIds}
          onSelectionChange={setSelectedSimilarPropertyIds}
          onPreferencesChange={handleSimilarPreferencesChange}
          onNext={() => handleSimilarPropertiesComplete(selectedSimilarPropertyIds)}
          onBack={() => {
            setCurrentStep('ADDRESS')
            setAddress('')
            setPropertyData(null)
            setCoordinates(null)
          }}
        />
      ) : currentStep === 'COVER_IMAGE' ? (
         <ImageSelectionView
          propertyData={propertyData}
          address={formatStreetAndCity(address, propertyData?.city || propertyData?.City)}
          onImageSelect={handleImageSelect}
          onBack={() => setCurrentStep('PREFERENCES')}
        />
      ) : currentStep === 'CHEAT_SHEET_PHOTOS' ? (
        <CheatSheetPhotoSelectionView
          propertyData={propertyData}
          address={formatStreetAndCity(address, propertyData?.city || propertyData?.City)}
          currentUser={currentUser}
          initialSelected={cheatSheetPhotos}
          onNext={handleCheatSheetPhotosComplete}
          onBack={() => setCurrentStep('COVER_IMAGE')}
        />
      ) : null}
      </motion.div>
      </AnimatePresence>

      {/* Review Step Dialog */}
      {currentStep === 'REVIEW' && (
        <SaveOpenHouseDialog
          address={address}
          selectedImage={selectedImage}
          qrCode={qrCode}
          onSave={saveOpenHouse}
          onCancel={() => setCurrentStep(selectedFeatures.cheatSheet ? 'CHEAT_SHEET_PHOTOS' : 'COVER_IMAGE')}
          onPreviewFlyer={() => handleTriggerPreview('flyer')}
          onPreviewRecommendations={() => handleTriggerPreview('recommendations')}
          onPreviewBragSheet={() => handleTriggerPreview('bragSheet')}
          onPreviewCheatSheet={() => handleTriggerPreview('cheatSheet')}
          hasRecommendations={selectedFeatures.similarProperties}
          hasBragSheet={selectedFeatures.bragSheet}
          hasCheatSheet={selectedFeatures.cheatSheet}
          formatAddress={formatAddress}
        />
      )}
    </div>
  )
}

// --- SUB-COMPONENTS (Wizard Views) ---

export const SimilarPropertiesPreferencesView = memo(function SimilarPropertiesPreferencesView({
  preferences: initialPreferences,
  address,
  subjectProperty,
  properties,
  isLoading,
  selectedIds,
  onSelectionChange,
  onPreferencesChange,
  onNext,
  onBack,
}: {
  preferences: SearchPreferences,
  address: string,
  subjectProperty?: any,
  properties: any[],
  isLoading: boolean,
  selectedIds: (string | number)[],
  onSelectionChange: (selectedIds: (string | number)[]) => void,
  onPreferencesChange: (prefs: SearchPreferences) => Promise<any[]>,
  onNext: () => void,
  onBack: () => void,
}) {
  const [prefs, setPrefs] = useState<SearchPreferences>(initialPreferences)

  // "View details" for a similar-property card - fetches the full listing (these cards only carry
  // lightweight search-result data) and reuses the same PropertyDetailsModal every other property
  // view surface in the app uses, so this picker gets the same map/listing-agent experience.
  const [viewDetailsProperty, setViewDetailsProperty] = useState<PropertyDetailResponse | null>(null)
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false)
  const [isLoadingViewDetails, setIsLoadingViewDetails] = useState(false)
  const handleViewDetails = async (property: any) => {
    const listingKey = property.ListingKey || property.listingKey
    if (!listingKey) return
    setIsViewDetailsOpen(true)
    setIsLoadingViewDetails(true)
    const { success, data } = await api.properties.lookup({ listingKey })
    if (success && data) setViewDetailsProperty(data)
    setIsLoadingViewDetails(false)
  }

  const formatPriceForDisplay = (val: number) => val === 0 ? "" : val.toLocaleString()
  const parsePriceFromDisplay = (val: string) => Number(val.replace(/\D/g, ""))
  const selectedIdStrings = selectedIds.map(id => String(id))
  const getNum = (obj: any, keys: string[]) => {
    for (const key of keys) {
      const value = obj?.[key]
      if (value !== undefined && value !== null && value !== '') return Number(value)
    }
    return 0
  }
  const normalize = (value?: string | null) => (value || '').trim().toLowerCase()
  const subject = subjectProperty || {}
  const subjectCity = normalize(subject.City || subject.city)
  const subjectSqft = getNum(subject, ['LivingArea', 'livingArea', 'living_area'])
  const subjectBeds = getNum(subject, ['BedroomsTotal', 'bedrooms', 'beds'])
  const subjectBaths = getNum(subject, ['BathroomsTotal', 'bathrooms', 'baths'])
  const subjectPrice = getNum(subject, ['ListPrice', 'price'])
  const subjectAcres = getNum(subject, ['LotSizeAcres', 'lotSizeAcres', 'lot_size_acres', 'acres']) || (getNum(subject, ['LotSizeSquareFeet', 'lotSizeSquareFeet', 'lot_size', 'lotSize']) / 43560)
  const subjectImage = subject.ListPictureURL || subject.imageUrl || subject.imgSrc || subject.image || subject.coverImageUrl || subject.cover_image_url || '/placeholder.svg'
  const subjectAddress = subject.FullStreetAddress || subject.address || address
  const subjectState = subject.StateOrProvince || subject.state
  const formatSubjectAcres = (acres: number) => acres ? acres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'
  const formatSubjectAddress = (value: string) => (value || '').split(',')[0].trim().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

  // Shared with Showcases (lib/matchScore.ts) - same weighted algorithm, one implementation.
  const getMatchScore = (property: any) => computeMatchScore(property, subject)
  const isSameSchool = (property: any) => isSameSchoolDistrict(property, subject)
  const getPropertyAcres = (property: any) => {
    const explicitAcres = getNum(property, ['acres', 'LotSizeAcres', 'lotSizeAcres', 'lot_size_acres'])
    if (explicitAcres) return explicitAcres
    const squareFeet = getNum(property, ['LotSizeSquareFeet', 'lotSizeSquareFeet', 'lot_size', 'lotSize'])
    return squareFeet ? Number((squareFeet / 43560).toFixed(2)) : 0
  }
  const sortedProperties = [...properties].sort((a, b) => getMatchScore(b) - getMatchScore(a))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === "minPrice" || name === "maxPrice") {
      setPrefs(prev => ({ ...prev, [name]: parsePriceFromDisplay(value) }))
    } else {
      setPrefs(prev => ({ ...prev, [name]: Number(value) }))
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      onPreferencesChange(prefs)
    }, 350)
    return () => clearTimeout(timeout)
  }, [prefs, onPreferencesChange])

  useEffect(() => {
    if (properties.length === 0) return
    const currentPropertyIds = properties.map(p => String(p.ListingKey || p.listingKey || p.id))
    const nextSelectedIds = selectedIds.filter(id => currentPropertyIds.includes(String(id)))
    const changed = nextSelectedIds.length !== selectedIds.length || nextSelectedIds.some((id, index) => String(id) !== String(selectedIds[index]))
    if (changed) onSelectionChange(nextSelectedIds)
  }, [properties, selectedIds, onSelectionChange])

  const toggleProperty = (id: string | number) => {
    const stringId = String(id)
    if (selectedIdStrings.includes(stringId)) {
      onSelectionChange(selectedIds.filter(selectedId => String(selectedId) !== stringId))
    } else {
      onSelectionChange([...selectedIds, stringId])
    }
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 transition-colors max-w-7xl mx-auto animate-fadeIn h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-5 sm:p-8">
        <div className="mb-5 rounded-2xl border border-gray-100 bg-[#faf9f7] p-4 shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] sm:p-5">
          <div className="-m-4 mb-4 flex items-center justify-center rounded-t-2xl border-b border-gray-200 bg-gradient-to-r from-[#faf6ec] via-white to-[#faf6ec] px-4 py-2.5 dark:border-gray-800 dark:from-[#1c1710] dark:via-[#151517] dark:to-[#1c1710] sm:-m-5 sm:mb-5 sm:px-5">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] ring-1 ring-[#C9A24D]/25 dark:text-[#d7b974]">
              <Layers className="h-3.5 w-3.5" /> Similar Homes Sheet
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="min-w-0">
              <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">Refine Your Search</h2>
              <p className="mt-1 truncate text-sm font-semibold text-gray-500 dark:text-gray-400">
                Similar to <span className="font-black text-gray-900 dark:text-white">{formatSubjectAddress(subjectAddress)}</span>
              </p>

              <div className="mt-4 flex overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md dark:border-gray-800 dark:bg-[#151517]">
                <div className="relative h-32 w-36 shrink-0 bg-gray-100 dark:bg-gray-800">
                  <Image src={subjectImage} alt={subjectAddress} fill sizes="144px" className="object-cover" quality={92} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
                  <p className="truncate text-sm font-black text-[#111827] dark:text-white">{formatSubjectAddress(subjectAddress)}</p>
                  <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#C9A24D]">{[subjectCity, subjectState].filter(Boolean).join(', ')}</p>
                  {subjectPrice > 0 && <p className="mt-1 text-sm font-black text-[#111827] dark:text-white">${subjectPrice.toLocaleString()}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-black text-[#111827] dark:text-white">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf9f7] px-2 py-1 dark:bg-[#0B0B0B]"><Bed className="h-3 w-3 text-gray-400" /> {subjectBeds || '-'}</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf9f7] px-2 py-1 dark:bg-[#0B0B0B]"><Bath className="h-3 w-3 text-gray-400" /> {subjectBaths || '-'}</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf9f7] px-2 py-1 dark:bg-[#0B0B0B]"><BoxSelect className="h-3 w-3 text-gray-400" /> {subjectSqft ? subjectSqft.toLocaleString() : '-'}</span>
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#faf9f7] px-2 py-1 dark:bg-[#0B0B0B]"><LandPlot className="h-3 w-3 text-gray-400" /> {formatSubjectAcres(subjectAcres)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
              <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Price</label>
                  <input type="text" name="minPrice" value={formatPriceForDisplay(prefs.minPrice)} onChange={handleChange} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" placeholder="0" />
              </div>
              <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Max Price</label>
                  <input type="text" name="maxPrice" value={formatPriceForDisplay(prefs.maxPrice)} onChange={handleChange} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white" placeholder="No Max" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Beds</label>
                  <select name="minBeds" value={prefs.minBeds} onChange={handleChange} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                    {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+ Beds</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Acres</label>
                  <select name="minAcres" value={prefs.minAcres || 0} onChange={handleChange} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                    {[0, 0.1, 0.25, 0.5, 0.75, 1].map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Baths</label>
                  <select name="minBaths" value={prefs.minBaths} onChange={handleChange} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                    {[0, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => <option key={n} value={n}>{n}+ Baths</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-[#151517]">
                <input type="range" name="radius" min="1" max="20" step="1" value={prefs.radius} onChange={handleChange} className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-[#C9A24D] dark:bg-gray-700" />
                <div className="min-w-[70px] text-right"><span className="text-base font-black text-gray-900 dark:text-white">{prefs.radius}</span><span className="ml-1 text-[9px] font-bold uppercase text-gray-500">Miles</span></div>
              </div>
              <p className="text-[9px] font-medium text-gray-400">Search area centered on the property coordinates captured from address entry.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-[#f1f3f5] p-4 shadow-inner dark:border-gray-800 dark:bg-transparent sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Property Selection</h3>
              <p className="text-xs font-semibold text-gray-400">Results update automatically as you refine filters.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={onBack} className="inline-flex items-center self-start rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-[#0B0B0B] dark:text-gray-400 dark:hover:bg-gray-800">Back</button>
              <div className="inline-flex items-center self-start rounded-2xl border border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-[#0B0B0B]">
                <span className="mr-2 text-[10px] font-black uppercase tracking-wide text-gray-400">Results</span>
                <span className="text-lg font-black text-[#111827] dark:text-white">{properties.length}</span>
              </div>
              <div className="inline-flex items-center self-start rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                <span className="mr-2 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Selected</span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{selectedIds.length}</span>
              </div>
              <button onClick={onNext} disabled={selectedIds.length === 0} className="inline-flex items-center self-start rounded-2xl border border-transparent bg-[#111827] dark:bg-white px-5 py-2 text-sm font-black uppercase tracking-widest text-white dark:text-[#111827] shadow-lg transition-all duration-200 hover:bg-[#8b7355] hover:text-white dark:hover:bg-[#C9A24D] disabled:cursor-not-allowed disabled:opacity-50">Continue ({selectedIds.length})</button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 py-12 text-sm font-bold text-gray-400 dark:border-gray-800">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#C9A24D] border-t-transparent" />
              Updating results...
            </div>
          ) : properties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
              <Search className="mx-auto mb-3 h-6 w-6 text-gray-300" />
              <p className="text-sm font-black text-gray-500 dark:text-gray-400">No matching properties yet</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">Try widening the radius or price range.</p>
            </div>
          ) : (
            // No height cap/inner scroll here on purpose - this flows as part of the single
            // outer scroll region (the flex-1 overflow-y-auto wrapping the whole panel below), so
            // there's exactly one scrollable area for the page and no nested scroll container to
            // trap the mouse wheel depending on exactly where the cursor happens to be.
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {sortedProperties.map((property) => {
                  const propertyId = String(property.ListingKey || property.listingKey || property.id)
                  const isSelected = selectedIdStrings.includes(propertyId)
                  return (
                    <div key={propertyId} onClick={() => toggleProperty(propertyId)} className="relative cursor-pointer">
                      <PropertyRecommendationCard
                        image={property.ListPictureURL || property.imageUrl || property.imgSrc || property.image || "/placeholder.svg"}
                        streetAddress={property.FullStreetAddress || property.address}
                        town={property.City || property.city}
                        price={property.ListPrice || property.price}
                        beds={property.BedroomsTotal ?? property.bedrooms ?? property.beds ?? 0}
                        baths={property.BathroomsTotal ?? property.bathrooms ?? property.baths ?? 0}
                        sqft={property.LivingArea || property.sqft || 0}
                        acres={getPropertyAcres(property)}
                        property={property}
                        yearBuilt={property.YearBuilt || property.yearBuilt || property.year_built}
                        dom={property.DaysOnMarket || property.daysOnMarket || property.dom}
                        city={property.City || property.city}
                        state={property.StateOrProvince || property.state}
                        zipcode={property.PostalCode || property.zipcode || property.zip}
                        hideQr={true}
                        isCompact={true}
                        selected={isSelected}
                        selectionTone="green"
                        matchScore={getMatchScore(property)}
                        sameSchool={isSameSchool(property)}
                        combinedAddressLine
                        elevated
                        onViewDetails={() => handleViewDetails(property)}
                      />
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* zIndex above EditSimilarPropertiesModal's z-[110] wrapper (harmless when reached from the
          plain wizard step instead, which has no competing high z-index). */}
      <PropertyDetailsModal
        property={viewDetailsProperty}
        isOpen={isViewDetailsOpen}
        onClose={() => { setIsViewDetailsOpen(false); setViewDetailsProperty(null) }}
        isLoadingDetails={isLoadingViewDetails}
        zIndex={120}
      />
    </div>
  )
})

// MLS media occasionally mislabels a builder's virtual-tour page or a hosted video (e.g. Lennar
// virtual-tour pages, Aryeo "/videos/..." links) as MediaCategory=Photo - it's a webpage or video,
// not an image file, and next/image hard-errors on it (unconfigured host or non-image response),
// crashing the whole picker. Filter those out rather than trying to allowlist every tour/video host.
const isRealPhotoUrl = (url: any): url is string =>
  typeof url === 'string' &&
  url.length > 0 &&
  !/virtual-?tour|\/videos?\//i.test(url) &&
  !/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url)

const ImageSelectionView = memo(function ImageSelectionView({ propertyData, address, onImageSelect, onBack }: any) {
  const availableImages = (propertyData?.photos && propertyData.photos.length > 0 ? propertyData.photos : [propertyData?.ListPictureURL]).filter(isRealPhotoUrl)
  // Picking a thumbnail doesn't advance the wizard right away - it stages the photo so its crop
  // position can be dragged into place first, mirrored live in the preview pane on the right.
  const [pending, setPending] = useState<{ url: string; x: number; y: number } | null>(null)

  const updatePendingPosition = (_: number, position: { x: number; y: number }) => {
    setPending(current => current ? { ...current, ...position } : current)
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 transition-colors animate-fadeIn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Cover Image for Sign-in Sheet</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{address}{pending ? ' · Drag the preview photo to adjust the crop.' : ' · Choose a photo below to preview the Sign-In Sheet.'}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          <button onClick={onBack} className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors duration-200 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:flex-none"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back</button>
          <button
            onClick={() => pending && onImageSelect({ url: pending.url, width: 400, height: 300, x: pending.x, y: pending.y })}
            disabled={!pending}
            className="flex flex-1 items-center justify-center rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all duration-300 hover:bg-[#8b7355] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:flex-none"
          >
            Continue
          </button>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid max-h-[560px] auto-rows-min grid-cols-2 items-start gap-4 overflow-y-auto pr-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">
          {availableImages.map((imageUrl: string, index: number) => (
            <div
              key={index}
              className={`relative aspect-square bg-gray-100 dark:bg-[#0B0B0B] rounded-xl overflow-hidden cursor-pointer transition-shadow duration-200 group ${pending?.url === imageUrl ? 'ring-2 ring-[#8b7355] dark:ring-[#C9A24D]' : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'}`}
              onClick={() => setPending({ url: imageUrl, x: 50, y: 50 })}
            >
              <Image src={imageUrl} alt={`Property view ${index + 1}`} fill sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 180px" className="object-cover" />
              <div className={`absolute inset-0 transition-colors duration-200 flex items-center justify-center ${pending?.url === imageUrl ? 'bg-black/10' : 'bg-black/0 group-hover:bg-black/10'}`}>
                <div className={`bg-white/90 dark:bg-[#151517]/90 rounded-full p-2 transition-opacity duration-200 ${pending?.url === imageUrl ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <svg className="w-5 h-5 text-[#8b7355] dark:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
            </div>
          ))}
        </div>
        <SignInSheetLivePreview propertyData={propertyData} address={address} pending={pending} onPhotoPositionChange={updatePendingPosition} />
      </div>
    </div>
  )
})

const QR_MOCK_PATTERN = [
  [1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0],
  [1, 1, 1, 0, 1],
  [0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0],
]

// Mirrors OpenHouseFlyerDocument's layout (lib/pdfs.tsx) at wizard scale: hero photo, welcome
// heading, address, beds/baths/sqft stats, price, and the "Scan to Sign In" QR block.
const SignInSheetLivePreview = memo(function SignInSheetLivePreview({ propertyData, address, pending, onPhotoPositionChange }: any) {
  const beds = propertyData?.BedroomsTotal || 0
  const baths = propertyData?.BathroomsTotal || 0
  const sqft = propertyData?.LivingArea || propertyData?.livingArea || 0
  const price = propertyData?.ListPrice || 0

  return (
    <aside className="xl:sticky xl:top-6 h-fit rounded-2xl border border-gray-200 bg-[#f3f4f6] p-4 shadow-inner dark:border-gray-800 dark:bg-[#0B0B0B]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Live Sign-In Sheet Preview</p>
        {pending && <p className="text-[10px] font-bold text-[#8b7355] dark:text-[#C9A24D]">Drag Photo</p>}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
        {/* 612/320 matches the real flyer's LETTER-page hero (styles.heroSection in lib/pdfs.tsx) so this crop preview isn't misleadingly short */}
        <DraggablePreviewPhoto photo={pending} slotIndex={0} aspectRatio="612 / 320" onPhotoPositionChange={onPhotoPositionChange} />
        <div className="p-4">
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-400">Welcome</p>
          <p className="font-serif text-lg font-black uppercase tracking-wide text-gray-900 dark:text-white">Open House</p>
          <div className="my-2 h-px w-full bg-gray-200 dark:bg-gray-700" />
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">Property Address</p>
          <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{address || 'Address unavailable'}</p>

          <div className="mt-3 grid grid-cols-3 rounded-lg border border-gray-200 bg-[#faf9f7] py-2 dark:border-gray-800 dark:bg-[#1a1a1c]">
            <div className="text-center">
              <p className="text-sm font-black text-gray-900 dark:text-white">{beds}</p>
              <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Beds</p>
            </div>
            <div className="border-x border-gray-200 text-center dark:border-gray-700">
              <p className="text-sm font-black text-gray-900 dark:text-white">{baths}</p>
              <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Baths</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-gray-900 dark:text-white">{Number(sqft).toLocaleString()}</p>
              <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Sq Ft</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">Listing Price</p>
              <p className="truncate text-base font-black text-gray-900 dark:text-white">${Number(price).toLocaleString()}</p>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1 rounded-lg border border-gray-200 bg-[#faf9f7] px-3 py-2 dark:border-gray-800 dark:bg-[#1a1a1c]">
              <div className="grid h-10 w-10 grid-cols-5 gap-[1px] rounded bg-white p-1">
                {QR_MOCK_PATTERN.flat().map((cell, i) => <div key={i} className={cell ? 'bg-gray-900' : 'bg-transparent'} />)}
              </div>
              <p className="whitespace-nowrap text-[6px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Scan to Sign In</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">This mirrors the printed Sign-In Sheet guests will see, including the QR code for instant check-in.</p>
    </aside>
  )
})

const MAX_CHEAT_SHEET_PHOTOS = 3
const normalizeCheatSheetPhoto = (photo: any) => typeof photo === 'string' ? { url: photo, x: 50, y: 50 } : { url: photo.url, x: photo.x ?? 50, y: photo.y ?? 50 }
const normalizeCheatSheetPhotosForSave = (photos: any[]) => (photos || [])
  .map(photo => typeof photo === 'string' ? { url: photo, x: 50, y: 50 } : { url: String(photo?.url || ''), x: photo?.x ?? 50, y: photo?.y ?? 50 })
  .filter(photo => photo.url)

export const CheatSheetPhotoSelectionView = memo(function CheatSheetPhotoSelectionView({ propertyData, address, currentUser, initialSelected, onNext, onBack }: any) {
  const availableImages: string[] = (propertyData?.photos && propertyData.photos.length > 0 ? propertyData.photos : [propertyData?.ListPictureURL]).filter(isRealPhotoUrl)
  const [selected, setSelected] = useState<any[]>(initialSelected && initialSelected.length > 0 ? initialSelected.map(normalizeCheatSheetPhoto) : availableImages.slice(0, 1).map(normalizeCheatSheetPhoto))
  // The live preview's agent block needs the same Agent Hub-backed data (name/title/brokerage/
  // phone/photo) the real Cheat Sheet PDF uses - that data lives in the agent's Agent Hub config,
  // not on the raw currentUser object, so it has to be fetched rather than read off currentUser directly.
  const [agentData, setAgentData] = useState<any>(null)
  useEffect(() => {
    let cancelled = false
    buildCheatSheetAgentData(currentUser).then(data => { if (!cancelled) setAgentData(data) })
    return () => { cancelled = true }
  }, [currentUser])

  const toggleImage = (url: string) => {
    setSelected(prev => {
      if (prev.some(photo => photo.url === url)) return prev.filter(photo => photo.url !== url)
      if (prev.length >= MAX_CHEAT_SHEET_PHOTOS) return prev
      return [...prev, { url, x: 50, y: 50 }]
    })
  }

  const updatePhotoPosition = (slotIndex: number, position: { x: number; y: number }) => {
    setSelected(prev => prev.map((photo, index) => index === slotIndex ? { ...photo, ...position } : photo))
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 transition-colors animate-fadeIn">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Photos for the Open House Cheat Sheet</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{address} &middot; Choose up to {MAX_CHEAT_SHEET_PHOTOS} photos, in the order you'd like them to appear.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0">
          <div className="flex w-full gap-2 sm:w-auto">
            <button onClick={onBack} className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors duration-200 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:flex-none"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back</button>
            <button onClick={() => onNext(selected)} disabled={selected.length === 0} className="flex flex-1 items-center justify-center rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all duration-300 hover:bg-[#8b7355] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:flex-none">Continue</button>
          </div>
          <p className="text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest sm:text-right">{selected.length} of {MAX_CHEAT_SHEET_PHOTOS} selected</p>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid max-h-[560px] auto-rows-min grid-cols-2 items-start gap-4 overflow-y-auto pr-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">
          {availableImages.map((imageUrl: string, index: number) => {
            const selectedIndex = selected.findIndex(photo => photo.url === imageUrl)
            const isSelected = selectedIndex !== -1
            return (
              <div
                key={index}
                className={`relative aspect-square bg-gray-100 dark:bg-[#0B0B0B] rounded-xl overflow-hidden cursor-pointer transition-shadow duration-200 group ${isSelected ? 'ring-2 ring-[#8b7355] dark:ring-[#C9A24D]' : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'}`}
                onClick={() => toggleImage(imageUrl)}
              >
                <Image src={imageUrl} alt={`Property view ${index + 1}`} fill sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 180px" className="object-cover" />
                <div className={`absolute inset-0 transition-colors duration-200 ${isSelected ? 'bg-black/10' : 'bg-black/0 group-hover:bg-black/10'}`} />
                {isSelected && (
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#8b7355] dark:bg-[#C9A24D] text-white text-xs font-bold flex items-center justify-center shadow-lg">
                    {selectedIndex + 1}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <CheatSheetLivePreview propertyData={propertyData} address={address} agent={agentData} selectedPhotos={selected} onPhotoPositionChange={updatePhotoPosition} />
      </div>
    </div>
  )
})

const CheatSheetLivePreview = memo(function CheatSheetLivePreview({ address, agent, selectedPhotos, onPhotoPositionChange }: any) {
  const brokerage = agent?.brokerage || 'Brokerage'
  const agentName = agent?.name || 'Agent Name'
  const title = agent?.title || 'Real Estate Professional'
  const phone = agent?.phone
  const email = agent?.email
  const agentPhoto = agent?.photoUrl

  const initials = agentName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()

  return (
    <aside className="xl:sticky xl:top-6 h-fit rounded-2xl border border-gray-200 bg-[#f3f4f6] p-4 shadow-inner dark:border-gray-800 dark:bg-[#0B0B0B]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Live First Page Preview</p>
        <p className="text-[10px] font-bold text-[#8b7355] dark:text-[#C9A24D]">Drag Photos</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517]">
        <p className="truncate text-center font-serif text-sm font-black uppercase tracking-[0.25em] text-gray-900 dark:text-white">{brokerage}</p>
        <div className="mx-auto mt-2 mb-3 h-0.5 w-12 rounded-full bg-[#C9A24D]" />
        <DraggablePreviewPhoto photo={selectedPhotos[0]} slotIndex={0} heightClass="h-40" onPhotoPositionChange={onPhotoPositionChange} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <DraggablePreviewPhoto photo={selectedPhotos[1]} slotIndex={1} heightClass="h-28" onPhotoPositionChange={onPhotoPositionChange} />
          <DraggablePreviewPhoto photo={selectedPhotos[2]} slotIndex={2} heightClass="h-28" onPhotoPositionChange={onPhotoPositionChange} />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-[#faf9f7] p-3 dark:border-gray-800 dark:bg-[#1a1a1c]">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#0B0B0B]">
            {agentPhoto ? <Image src={resolveMediaUrl(agentPhoto)} alt={agentName} fill sizes="48px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#8b7355] dark:text-[#C9A24D]">{initials}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-black text-gray-900 dark:text-white">{agentName}</p>
            <p className="truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400">{title}</p>
            {phone && <p className="truncate text-[9px] font-semibold text-gray-500 dark:text-gray-400">{phone}</p>}
            {email && <p className="truncate text-[9px] font-semibold text-gray-500 dark:text-gray-400">{email}</p>}
          </div>
          {/* Mirrors the real Cheat Sheet PDF's QR exactly (same qrserver.com size/params - see
              styles.frontAgentQrImage usage in lib/pdfs.tsx) - omitted, not a blank placeholder, when
              the agent has no Agent Hub slug yet, same as the PDF itself omits it. */}
          {agent?.hubUrl && (
            <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#C9A24D]/40 bg-white p-1 sm:block dark:bg-[#0B0B0B]">
              <div className="relative h-full w-full">
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(agent.hubUrl)}`}
                  alt="Scan to view Agent Hub"
                  fill
                  sizes="56px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">Drag inside each selected photo frame to center the crop. Those positions save into the Cheat Sheet PDF.</p>
    </aside>
  )
})

const DraggablePreviewPhoto = memo(function DraggablePreviewPhoto({ photo, slotIndex, heightClass, aspectRatio, onPhotoPositionChange }: any) {
  const dragStart = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!dragStart.current || !photo) return
    const dx = clientX - dragStart.current.startX
    const dy = clientY - dragStart.current.startY
    const nextX = Math.max(0, Math.min(100, dragStart.current.x - dx * 0.35))
    const nextY = Math.max(0, Math.min(100, dragStart.current.y - dy * 0.35))
    onPhotoPositionChange(slotIndex, { x: Math.round(nextX), y: Math.round(nextY) })
  }

  return (
    <div
      className={`relative touch-none overflow-hidden rounded-lg bg-gray-100 dark:bg-[#0B0B0B] ${heightClass || ''} ${photo ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onPointerDown={(event) => {
        if (!photo) return
        dragStart.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: photo.x ?? 50, y: photo.y ?? 50 }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => updateFromPointer(event.clientX, event.clientY)}
      onPointerUp={() => { dragStart.current = null }}
      onPointerCancel={() => { dragStart.current = null }}
    >
      {photo ? (
        <>
          <Image src={photo.url} alt={`Cheat sheet photo ${slotIndex + 1}`} fill sizes="320px" className="select-none object-cover" style={{ objectPosition: `${photo.x ?? 50}% ${photo.y ?? 50}%` }} draggable={false} />
          <div className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1.5 text-[10px] font-black text-white">{slotIndex + 1}</div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] font-black uppercase tracking-widest text-gray-400">Photo {slotIndex + 1}</div>
      )}
    </div>
  )
})

const SaveOpenHouseDialog = memo(function SaveOpenHouseDialog({ address, selectedImage, qrCode, onSave, onCancel, onPreviewFlyer, onPreviewRecommendations, onPreviewBragSheet, onPreviewCheatSheet, hasRecommendations, hasBragSheet, hasCheatSheet, formatAddress }: any) {
  const kitLabel = ['Sign In', hasRecommendations && 'Similar Homes', hasBragSheet && 'Brag Sheet', hasCheatSheet && 'Cheat Sheet'].filter(Boolean).join(', ')
  const [isSaving, setIsSaving] = useState(false)
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave()
    } finally {
      setIsSaving(false)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50"><h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Review & Save</h3><p className="text-[#6B7280] dark:text-gray-400 text-sm mt-2 font-medium">{formatAddress(address)}</p></div>
        <div className="p-8">
          <div className="flex items-center space-x-5 mb-8">
            <div className="w-24 h-24 bg-white dark:bg-[#0B0B0B] rounded-2xl overflow-hidden relative shadow-inner border border-gray-100 dark:border-gray-800">{selectedImage && <Image src={selectedImage.url} alt="Selected cover" fill sizes="96px" className="object-cover" />}</div>
            <div className="flex-1"><p className="text-base font-bold text-[#0B0B0B] dark:text-white">Kit Ready to Generate</p><p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1 font-light leading-relaxed">Includes {kitLabel}.</p></div>
          </div>
          <div className="bg-white/80 dark:bg-[#0B0B0B]/80 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-800 shadow-sm"><h4 className="text-sm font-bold text-[#C9A24D] uppercase tracking-wider mb-3">Your Kit Includes</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700"><div className="flex items-center"><span className="text-[#C9A24D] mr-3 font-bold">✓</span><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sign In</span></div><button onClick={onPreviewFlyer} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">Preview PDF</button></div>
              {hasRecommendations && <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700"><div className="flex items-center"><span className="text-[#C9A24D] mr-3 font-bold">✓</span><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Similar Homes</span></div><button onClick={onPreviewRecommendations} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">Preview PDF</button></div>}
              {hasBragSheet && <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700"><div className="flex items-center"><span className="text-[#C9A24D] mr-3 font-bold">✓</span><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Brag Sheet</span></div><button onClick={onPreviewBragSheet} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">Preview PDF</button></div>}
              {hasCheatSheet && <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700"><div className="flex items-center"><span className="text-[#C9A24D] mr-3 font-bold">✓</span><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cheat Sheet</span></div><button onClick={onPreviewCheatSheet} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">Preview PDF</button></div>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={onCancel} disabled={isSaving} className="flex-1 px-6 py-3.5 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">Back</button>
            <button onClick={handleSave} disabled={isSaving} className="flex flex-[2] items-center justify-center gap-2 px-6 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transform transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] active:scale-95 disabled:opacity-80 disabled:cursor-wait disabled:hover:bg-[#111827] dark:disabled:hover:bg-white">
              {isSaving ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Generating Kit...
                </>
              ) : (
                'Save & Finish'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
