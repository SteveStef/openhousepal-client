'use client'

import React, { useState, memo, useCallback, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'
import { PropertyRecommendationCard } from '@/components/PropertyRecommendationCard'
import PropertyDetailsModal, { type HomeMove } from '@/components/PropertyDetailsModal'
import { OhpSpinner } from '@/components/brand/OhpLoader'
import MonthlyAiUsageMeter from '@/components/MonthlyAiUsageMeter'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { buildBragSheetData, buildCheatSheetAgentData, planHasBragSheet } from '@/lib/bragSheetData'
import { cheatSheetSqft } from '@/lib/cheatSheetContent'
import { hasAgentHubAccess, hasMlsAccess, hasShowcaseAccess } from '@/lib/navAccess'
import { useOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import { computeMatchScore, isSameSchoolDistrict } from '@/lib/matchScore'
import { formatPropertyFeature, normalizeImageUrl, roundedPriceRange } from '@/lib/utils'
import { useIsPhone, useSwipeToClose } from '@/components/ui/windowMotion'
import { createPortal } from 'react-dom'
import { readPrintPref, syncPrintPrefs, writePrintPref, type PrintPref } from '@/lib/printPrefs'
import KitReviewDialog, { type KitDocMode } from './KitReviewDialog'
import KitFlowShell, { useKitFlowDock, useKitFlowScrollTop, type KitFlowStepId } from './KitFlowShell'
import FlowDock from '@/components/ui/FlowDock'
import {
  OpenHouse,
  PropertyImage,
  SearchPreferences,
  OpenHouseWizardStep,
  User,
  PropertyDetailResponse
} from '@/types'
import { Bed, Bath, BoxSelect, Building2, Check, DollarSign, DoorOpen, Eye, LandPlot, Layout, QrCode, Sparkles, MapPin, Search, Layers, ArrowRight, Upload, Loader2, ImageOff, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react'
import LuxeHero from '@/components/ui/LuxeHero'
import { useQrDataUrl } from '@/lib/qr'


interface CreateOpenHouseWizardProps {
  currentUser: User | null;
  onSuccess: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
  triggerPreview: (type: 'flyer' | 'recommendations' | 'bragSheet' | 'cheatSheet', id?: string, customData?: any) => void;
  formatAddress: (address: string) => string;
  /** Fill the address box (e.g. "Build kit" on an open you're confirmed to host). */
  prefill?: { address: string; nonce: number } | null;
}

export function CreateOpenHouseWizard({
  currentUser,
  onSuccess,
  showToast,
  triggerPreview,
  formatAddress,
  prefill = null,
}: CreateOpenHouseWizardProps) {
  const { listingAgentCount, hostCount } = useOpenHouseActionCounts()

  // No-MLS agents have no Bright data to search - the ADDRESS step becomes a manual entry form
  // instead, and the PREFERENCES step (nearby similar properties, entirely Bright-driven) is
  // skipped altogether since there's nothing to compare against.
  // BOTH No-MLS tiers (NO_MLS and PRO_NO_MLS) - neither may touch Bright MLS data.
  const isNoMls = !hasMlsAccess(currentUser?.plan_tier)
  const bragSheetAvailable = planHasBragSheet(currentUser?.plan_tier)

  // Wizard State
  const [currentStep, setCurrentStep] = useState<OpenHouseWizardStep>('ADDRESS')
  // Kit print choices asked on the Review step - pre-filled with whatever the agent picked last
  // time (lib/printPrefs), and every change is remembered for next time.
  const [kitPrefs, setKitPrefs] = useState<Record<PrintPref, boolean>>({ flyerBrand: true, qrDark: true, matchScore: true, recap: true, bragStats: true })
  // What happens when a guest signs in - same switches as each open house card, picked up front.
  const [guestPrefs, setGuestPrefs] = useState<{ autoShowcase: boolean; guestPass: boolean; afterSignin: 'hub' | 'none'; followupsMode: 'on' | 'no_calendar' | 'off' }>({ autoShowcase: true, guestPass: true, afterSignin: 'none', followupsMode: 'on' })
  // You're this home's listing agent: Showcases + Similar Homes start off (guests stay focused on
  // your listing instead of being sent to shop other homes). Set from the server once a home is picked.
  const [ownListing, setOwnListing] = useState(false)
  // The account's saved kit choices (lib/printPrefs) - pulled once when the kit maker opens.
  useEffect(() => { syncPrintPrefs() }, [])
  useEffect(() => {
    if (currentStep !== 'REVIEW') return
    setKitPrefs({ flyerBrand: readPrintPref('flyerBrand'), qrDark: readPrintPref('qrDark'), matchScore: readPrintPref('matchScore'), recap: readPrintPref('recap'), bragStats: readPrintPref('bragStats') })
  }, [currentStep])
  const setKitPref = useCallback((pref: PrintPref, on: boolean) => {
    writePrintPref(pref, on)
    setKitPrefs(prev => ({ ...prev, [pref]: on }))
  }, [])
  
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
    bragSheet: bragSheetAvailable,
    // No Cheat Sheet on the No-MLS plans: it's built from Bright MLS data (facts, schools, taxes,
    // price history, nearby places) that those plans don't have.
    cheatSheet: !isNoMls
  })
  // currentUser can arrive after mount - keep the kit's documents matched to the real plan.
  useEffect(() => {
    setSelectedFeatures(prev => (prev.bragSheet === bragSheetAvailable && prev.cheatSheet === !isNoMls
      ? prev
      : { ...prev, bragSheet: bragSheetAvailable, cheatSheet: !isNoMls }))
  }, [bragSheetAvailable, isNoMls])

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

  // Builds one kit document's data - used by "Preview PDF" (the full preview window) and by the
  // Review step's live preview, so both always show the same page.
  const buildKitDocData = async (mode: KitDocMode, opts: { brand?: boolean } = {}): Promise<any | null> => {
    if (mode === 'flyer') {
      const flyerData = {
        address: formatStreetAndCity(address, propertyData?.city || propertyData?.City),
        price: propertyData?.ListPrice || 0,
        beds: propertyData?.BedroomsTotal || 0,
        baths: propertyData?.BathroomsTotal || 0,
        sqft: propertyData?.LivingArea || propertyData?.livingArea || cheatSheetSqft({ aboveGradeSqft: propertyData?.AboveGradeFinishedArea, belowGradeSqft: propertyData?.BelowGradeFinishedArea }) || 0,
        schoolDistrict: propertyData?.SchoolDistrictName || propertyData?.school_district_name || undefined,
        // The Review step's Brand choice (same remembered setting as the Documents window's).
        brand: (opts.brand ?? kitPrefs.flyerBrand) ? await buildCheatSheetAgentData(currentUser) : null,
        coverImage: selectedImage?.url,
        coverImagePosition: { x: selectedImage?.x ?? 50, y: selectedImage?.y ?? 50 },
        openHouseUrl: `${window.location.origin}/open-house/${generatedOpenHouseId}`
      };
      return flyerData;
    } else if (mode === 'recommendations') {
      const selectedSimilarProps = pickedSimilar();
      const currentSimilarProps = selectedSimilarProps.map(p => ({
        ...p,
        matchScore: computeMatchScore(p, propertyData, selectedSimilarProps),
      }));

      return {
        address: formatStreetAndCity(address, propertyData?.city || propertyData?.City),
        properties: currentSimilarProps,
        openHouseEventId: generatedOpenHouseId,
      };
    } else if (mode === 'bragSheet') {
      const currentSimilarPropsForBragSheet = pickedSimilar();
      const { data, error: bragSheetError } = await buildBragSheetData(currentUser, selectedFeatures.similarProperties ? currentSimilarPropsForBragSheet : [], { showcases: guestPrefs.autoShowcase });
      if (!data) {
        showToast(bragSheetError || 'Unable to build your Brag Sheet right now.', 'error');
        return null;
      }
      return { ...data, showSalesStats: kitPrefs.bragStats };
    } else if (mode === 'cheatSheet') {
      const listingKey = propertyData?.ListingKey || propertyData?.listing_key;
      const [amenitiesRes, cheatSheetAgent] = await Promise.all([
        listingKey ? api.properties.getNearbyAmenities(listingKey) : Promise.resolve(null),
        buildCheatSheetAgentData(currentUser),
      ]);
      return {
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
      };
    }
    return null
  }
  const handleTriggerPreview = async (mode: KitDocMode) => {
    const data = await buildKitDocData(mode)
    if (data) triggerPreview(mode, undefined, data)
  }

  // "Build kit" from an approved open: drop its address in and bring the box into view - the
  // suggestion list then shows the home, and Generate Kit picks it.
  React.useEffect(() => {
    if (!prefill?.address) return
    setCurrentStep('ADDRESS')
    setAddress(prefill.address)
    setCoordinates(null)
    setShowAddressSuggestions(true)
    const el = document.getElementById('address') as HTMLInputElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => el?.focus(), 350)
  }, [prefill?.nonce])

  // Fetch internal address suggestions
  React.useEffect(() => {
    // No-MLS plans never search Bright - the address they type is simply what they entered.
    if (isNoMls) return
    const fetchSuggestions = async () => {
      const query = address.trim()
      if (query.length < 3) {
        setAddressSuggestions([])
        return
      }

      setIsLoadingSuggestions(true)
      // Kits are for for-sale homes - Active or Coming Soon - never rentals or anything
      // pending/under contract/closed/off-market.
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
        // Starting Showcases / Similar Homes for this home (both off at your own listing).
        const defaults = await api.openHouses.guestDefaults(data.ListingKey || data.listing_key)
        const own = !!(defaults.success && defaults.data?.own_listing)
        setOwnListing(own)
        setGuestPrefs(prev => ({ ...prev, autoShowcase: !own }))
        setSelectedFeatures(prev => ({ ...prev, similarProperties: !own }))
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

  const handleManualPropertyComplete = (manualPropertyData: any, fullAddress: string) => {
    setAddress(fullAddress)
    setPropertyData(manualPropertyData)
    setCoordinates(null)
    // No Bright data to compare against - skip the similar-properties step and toggle entirely,
    // and the Cheat Sheet (also MLS-built).
    setSelectedFeatures(prev => ({ ...prev, similarProperties: false, cheatSheet: false }))
    setManualOpen(false)
    setCurrentStep('COVER_IMAGE')
  }

  // No-MLS: the address typed in the header opens the kit window on its "Home details" step
  // (the same window, step bar and phone flow bar as the Bright flow - only this step differs).
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDraft, setManualDraft] = useState<ManualDraft | null>(null)
  const openManualDetails = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const typed = address.trim()
    if (typed.length < 3) {
      setError('Type the home\'s street address to start.')
      return
    }
    setManualDraft(prev => prev && prev.typed === typed ? prev : { ...parseTypedAddress(typed), typed })
    setManualOpen(true)
  }

  const fetchSimilarProperties = async (data: any, autoSelect = false, preferences?: SearchPreferences) => {
    const seq = ++similarSeq.current
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
    // A newer search started while this one ran (typing a price) - its answer wins, not this one.
    if (seq !== similarSeq.current) return []

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
      if (seq !== similarSeq.current) return []
      normalizedProperties.forEach((p: any) => similarPool.current.set(String(p.ListingKey || p.listingKey || p.id), p))
      setSimilarProperties(normalizedProperties)

      if (autoSelect) {
        const topIds = normalizedProperties.slice(0, 12).map((p: any) => p.listingKey || p.ListingKey || p.id)
        setSelectedSimilarPropertyIds(topIds)
      }
      setIsLoadingNeighbors(false)
      return normalizedProperties
    }
    
    // Refused (e.g. a max price below the min) - no matches, rather than the old list lingering.
    setSimilarProperties([])
    setIsLoadingNeighbors(false)
    return []
  }
  const similarSeq = useRef(0)
  const similarPool = useRef(new Map<string, any>())
  // The picked homes, even ones the current filters hide (they stay in the kit).
  const pickedSimilar = () => selectedSimilarPropertyIds
    .map(id => similarPool.current.get(String(id)) || similarProperties.find(p => String(p.ListingKey || p.listingKey || p.id) === String(id)))
    .filter(Boolean)

  // Similar Homes switched on from Review & Save with nothing picked: after picking, go straight
  // back to Review instead of redoing the cover photo / Cheat Sheet steps.
  const returnToReview = useRef(false)
  const handleSimilarPropertiesComplete = (selectedIds: (string | number)[]) => {
    setSelectedSimilarPropertyIds(selectedIds)
    if (returnToReview.current && selectedImage) {
      returnToReview.current = false
      setCurrentStep('REVIEW')
      return
    }
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
    // The sign-in link the kit's QR codes point at (the codes themselves are drawn locally - lib/qr).
    setQrCode(formUrl)

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

    const selectedSnapshot = pickedSimilar()
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

    const { success, error, data: created } = await api.openHouses.create({
      address: String(address || ''),
      property_data: propertyData,
      coverImageUrl: String(selectedImage.url || ''),
      coverImagePosition: { x: selectedImage.x ?? 50, y: selectedImage.y ?? 50 },
      openHouseEventId: String(generatedOpenHouseId || ''),
      similarPropertiesSnapshot: selectedSnapshot,
      cheatSheetPhotos: selectedFeatures.cheatSheet ? savedCheatSheetPhotos : undefined,
      cheatSheetSnapshot: cheatSheetSnapshot,
      qrDarkMode: kitPrefs.qrDark,
      // The guest settings picked in the wizard (the picked Similar Homes are saved either way, so
      // switching Similar Homes on later on the card brings them back).
      autoShowcase: guestPrefs.autoShowcase,
      similarHomes: !isNoMls && selectedFeatures.similarProperties,
      ...(!isNoMls ? { guestPass: guestPrefs.guestPass } : {}),
    })

    if (success) {
      // No-MLS Pro's "after sign-in" choice is its own setting.
      const createdId = (created as any)?.id
      if (createdId) {
        const patch: Record<string, unknown> = {}
        if (isNoMls && guestPrefs.afterSignin === 'hub') patch.after_signin = 'hub'
        // Follow-ups for this open house: off entirely, or kept off the calendar (kit Review step 2).
        if (guestPrefs.followupsMode !== 'on') patch.followups_mode = guestPrefs.followupsMode
        if (Object.keys(patch).length) await api.openHouses.updateGuestSettings(createdId, patch as any)
      }
      await onSuccess()

      // Reset local state
      setAddress('')
      setPropertyData(null)
      setSelectedImage(null)
      setQrCode('')
      setGeneratedOpenHouseId('')
      setSelectedFeatures({ signinSheet: true, similarProperties: true, bragSheet: bragSheetAvailable, cheatSheet: !isNoMls })
      setGuestPrefs({ autoShowcase: true, guestPass: true, afterSignin: 'none', followupsMode: 'on' })
      setOwnListing(false)
      setSelectedSimilarPropertyIds([])
      setCheatSheetPhotos([])
      setCurrentStep('ADDRESS')
      
      showToast('🎉 Open House created successfully!', 'success')
    } else {
      console.error('Error saving open house:', error)
      showToast(error || 'Failed to save open house. Please try again.', 'error')
    }
  }

  // Everything after the address happens in one pop-out window (KitFlowShell).
  const inFlow = currentStep !== 'ADDRESS' || (isNoMls && manualOpen)
  const [reviewStep, setReviewStep] = useState<1 | 2>(1)
  useEffect(() => { if (currentStep !== 'REVIEW') setReviewStep(1) }, [currentStep])
  const flowSteps: KitFlowStepId[] = [...(isNoMls ? ['details' as const] : ['similar' as const]), 'cover', ...(selectedFeatures.cheatSheet ? ['cheat' as const] : []), 'kit', 'guests']
  const flowCurrent: KitFlowStepId = currentStep === 'ADDRESS' ? 'details' : currentStep === 'PREFERENCES' ? 'similar' : currentStep === 'COVER_IMAGE' ? 'cover' : currentStep === 'CHEAT_SHEET_PHOTOS' ? 'cheat' : reviewStep === 2 ? 'guests' : 'kit'
  const flowTitle = { details: 'Tell us about the home', similar: 'Pick similar homes', cover: 'Choose the cover photo', cheat: 'Cheat Sheet photos', kit: 'Review your kit', guests: 'After a guest signs in' }[flowCurrent]
  const flowPhoto = currentStep === 'ADDRESS' ? (manualDraft?.photos?.[0] || null) : (selectedImage?.url || propertyData?.ListPictureURL || (Array.isArray(propertyData?.photos) ? propertyData.photos[0] : null))
  const leaveFlow = () => {
    setManualOpen(false)
    returnToReview.current = false
    setSelectedImage(null)
    setSelectedSimilarPropertyIds([])
    setCheatSheetPhotos([])
    setCurrentStep('ADDRESS')
  }
  const onReviewStep = useCallback((st: 1 | 2) => setReviewStep(st), [])

  return (
    <div className="w-full">
      {isNoMls ? (
        // No-MLS: the same luxe Opens header and address bar as the Bright plans - minus Discovery /
        // Manager (Bright-only) and the address suggestions (Bright search). Generate Kit opens the
        // kit window on the "Home details" step instead of pulling the listing.
        <LuxeHero
          compact
          centered
          kicker="Open Houses"
          icon={DoorOpen}
          titleClassName="text-[2.1rem] sm:text-5xl"
          title={<>Create your <br className="sm:hidden" /><em className="whitespace-nowrap">Open House Kit.</em></>}
          subtitle="Type the home's address, add its details and photos, and get a QR sign-in sheet and flyer in a minute."
          actions={
            <form onSubmit={openManualDetails} className="relative z-20 mx-auto w-full max-w-2xl">
              <div className="flex w-full flex-col items-stretch gap-1.5 rounded-2xl border-2 border-[#C9A24D]/25 bg-white/90 p-1.5 shadow-sm transition-all duration-300 focus-within:border-[#C9A24D] focus-within:shadow-[0_0_25px_rgba(201,162,77,0.12)] dark:border-white/10 dark:bg-black/40 sm:flex-row sm:gap-0 sm:rounded-full">
                <div className="group relative w-full flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 transition-colors group-focus-within:text-[#C9A24D]">
                    <MapPin size={20} />
                  </div>
                  <input id="address" name="address" type="text" autoComplete="street-address" value={address}
                    onChange={(e) => { setAddress(e.target.value); if (error) setError('') }}
                    placeholder="Enter property address..."
                    className="block w-full rounded-xl bg-transparent py-3.5 pl-11 pr-4 text-base font-medium text-[#0B0B0B] placeholder-gray-400 transition-all duration-300 focus:outline-none dark:text-white dark:placeholder-gray-500 sm:py-3" />
                </div>
                <button type="submit"
                  className="lx-shine group/btn relative flex w-full items-center justify-center overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-8 py-3.5 text-xs font-black uppercase tracking-widest text-[#111827] shadow-md shadow-[#C9A24D]/25 transition-all duration-300 hover:shadow-lg hover:shadow-[#C9A24D]/40 hover:brightness-105 active:scale-[0.98] sm:w-auto sm:min-w-[160px] sm:rounded-full sm:py-3">
                  <span>Generate Kit</span>
                  <Sparkles size={14} className="ml-2 text-[#111827] transition-transform group-hover/btn:rotate-12" />
                </button>
              </div>
              {error && !inFlow && <p className="mt-3 animate-fadeIn text-center text-sm font-medium text-red-500">{error}</p>}
              <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#8b7355]/80 dark:text-[#d7b974]/70">No Bright MLS needed</p>
            </form>
          }
        />
      ) : (
        <div className="space-y-6 sm:space-y-8 w-full">
          {/* The Opens header - the shared luxe header: the address bar is the main action,
              Discovery + Manager sit on the right, and what's in a kit is listed under the bar. */}
          <LuxeHero
            compact
            centered
            kicker="Open Houses"
            icon={DoorOpen}
            titleClassName="text-[2.1rem] sm:text-5xl"
            title={<>Create your <br className="sm:hidden" /><em className="whitespace-nowrap">Open House Kit.</em></>}
            subtitle="Enter a property address to instantly generate a QR code, professional PDF flyer, and sign-in form."
            actions={
              // Find Open Houses | address search | Manager - one row, so the header stays short.
              <div className="grid w-full max-w-6xl grid-cols-2 items-stretch gap-3 lg:grid-cols-[230px_minmax(0,1fr)_230px] lg:items-end lg:gap-5">
              <OpensToolBlock
                href="/discovery"
                className="order-2 lg:order-1 lg:-mt-24"
                icon={<Search size={20} strokeWidth={2.4} className="ohp-icon-draw ohp-icon-assemble-search" />}
                title="Find Open Houses"
                blurb="Discover brokerage listings near you"
                count={hostCount}
              />
              <div className="order-1 col-span-2 flex flex-col items-center justify-center lg:order-2 lg:col-span-1">
              <form onSubmit={generateQRCode} className="relative z-20 w-full max-w-2xl">
                <div className="flex flex-col sm:flex-row items-stretch w-full rounded-2xl sm:rounded-full bg-white/90 dark:bg-black/40 border-2 border-[#C9A24D]/25 dark:border-white/10 focus-within:border-[#C9A24D] shadow-sm focus-within:shadow-[0_0_25px_rgba(201,162,77,0.12)] transition-all duration-300 p-1.5 gap-1.5 sm:gap-0">
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
                    className="lx-shine relative overflow-hidden w-full sm:w-auto px-8 py-3.5 sm:py-3 bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[#111827] rounded-xl sm:rounded-full font-black text-xs uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#C9A24D]/25 hover:shadow-lg hover:shadow-[#C9A24D]/40 hover:brightness-105 active:scale-[0.98] flex items-center justify-center whitespace-nowrap sm:min-w-[160px] group/btn"
                  >
                    {isGenerating || isLoadingProperty ? (
                      <OhpSpinner size={20} />
                    ) : (
                      <div className="flex items-center">
                        <span>Generate Kit</span>
                        <Sparkles size={14} className="ml-2 text-[#111827] group-hover/btn:scale-120 group-hover/btn:rotate-12 transition-transform" />
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
              </div>
              <OpensToolBlock
                href="/open-houses/my-listings"
                className="order-3 lg:-mt-24"
                icon={<Building2 size={20} strokeWidth={2.2} className="ohp-icon-draw" />}
                title="Manager"
                blurb="Manage hosts & view insights"
                count={listingAgentCount}
                delay={1.6}
              />
              </div>
            }
          />
        </div>
      )}

      {/* The next step's photos, loaded ahead (Similar Homes -> cover photo; the Cheat Sheet step
          uses the same photos, so they're ready by then). */}
      {currentStep === 'PREFERENCES' && propertyData && (
        <KitPhotoPreload urls={(propertyData.photos && propertyData.photos.length > 0 ? propertyData.photos : [propertyData.ListPictureURL]).filter(isRealPhotoUrl).slice(0, 12)} />
      )}
      <AnimatePresence>
        {inFlow && (
          <KitFlowShell
            steps={flowSteps}
            current={flowCurrent}
            contentKey={currentStep}
            title={flowTitle}
            address={formatAddress(address)}
            photo={flowPhoto}
            onClose={leaveFlow}
          >
            {currentStep === 'ADDRESS' && isNoMls ? (
              <ManualDetailsStep
                draft={manualDraft}
                onDraftChange={setManualDraft}
                onBack={leaveFlow}
                onComplete={handleManualPropertyComplete}
              />
            ) : currentStep === 'PREFERENCES' ? (
              <SimilarPropertiesPreferencesView
                bare
                keepHiddenSelections
                preferences={searchPreferences}
                address={address}
                subjectProperty={propertyData}
                properties={similarProperties}
                isLoading={isLoadingNeighbors}
                selectedIds={selectedSimilarPropertyIds}
                onSelectionChange={setSelectedSimilarPropertyIds}
                onPreferencesChange={handleSimilarPreferencesChange}
                onNext={() => handleSimilarPropertiesComplete(selectedSimilarPropertyIds)}
                include={selectedFeatures.similarProperties}
                onIncludeChange={(on: boolean) => setSelectedFeatures(prev => ({ ...prev, similarProperties: on }))}
                ownListing={ownListing}
                onBack={() => {
                  // Came here from Review to pick homes - backing out leaves Similar Homes off.
                  if (returnToReview.current && selectedImage) {
                    returnToReview.current = false
                    setSelectedFeatures(prev => ({ ...prev, similarProperties: false }))
                    setCurrentStep('REVIEW')
                    return
                  }
                  leaveFlow()
                }}
              />
            ) : currentStep === 'COVER_IMAGE' ? (
              <ImageSelectionView
                bare
                initial={selectedImage}
                propertyData={propertyData}
                address={formatStreetAndCity(address, propertyData?.city || propertyData?.City)}
                onImageSelect={handleImageSelect}
                onBack={() => {
                  if (!isNoMls) { setCurrentStep('PREFERENCES'); return }
                  // Back to Home details with everything they typed still there.
                  setManualOpen(true)
                  setCurrentStep('ADDRESS')
                }}
              />
            ) : currentStep === 'CHEAT_SHEET_PHOTOS' ? (
              <CheatSheetPhotoSelectionView
                bare
                propertyData={propertyData}
                address={formatStreetAndCity(address, propertyData?.city || propertyData?.City)}
                currentUser={currentUser}
                initialSelected={cheatSheetPhotos}
                onNext={handleCheatSheetPhotosComplete}
                onBack={() => setCurrentStep('COVER_IMAGE')}
                recapOn={kitPrefs.recap}
              />
            ) : currentStep === 'REVIEW' ? (
              <KitReviewDialog
                embedded
                onStepChange={onReviewStep}
                address={formatAddress(address)}
                street={formatStreetAndCity(address, propertyData?.city || propertyData?.City).split(',')[0]}
                selectedImage={selectedImage}
                onSave={saveOpenHouse}
                onCancel={() => setCurrentStep(selectedFeatures.cheatSheet ? 'CHEAT_SHEET_PHOTOS' : 'COVER_IMAGE')}
                onPreview={handleTriggerPreview}
                buildDocData={buildKitDocData}
                hasRecommendations={selectedFeatures.similarProperties}
                hasBragSheet={selectedFeatures.bragSheet}
                hasCheatSheet={selectedFeatures.cheatSheet}
                kitPrefs={kitPrefs}
                onKitPrefChange={setKitPref}
                guestPrefs={guestPrefs}
                onGuestPrefChange={(k, v) => setGuestPrefs(prev => ({ ...prev, [k]: v }))}
                showcasesAvailable={hasShowcaseAccess(currentUser?.plan_tier)}
                guestPassAvailable={!isNoMls}
                afterSigninAvailable={isNoMls && hasAgentHubAccess(currentUser?.plan_tier)}
                similarAvailable={!isNoMls}
                ownListing={ownListing}
                onSimilarChange={(on: boolean) => {
                  if (!on) {
                    setSelectedFeatures(prev => ({ ...prev, similarProperties: false }))
                    return
                  }
                  // Including it again always goes back to the Similar Homes step to pick the homes
                  // again (never silently re-adds the old picks) - Next there returns here.
                  setSelectedFeatures(prev => ({ ...prev, similarProperties: true }))
                  returnToReview.current = true
                  setCurrentStep('PREFERENCES')
                }}
              />
            ) : null}
          </KitFlowShell>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- SUB-COMPONENTS (Wizard Views) ---

// Similar Homes results per page (a handful of short pages instead of one endless grid).
const RESULTS_PAGE_SIZE = 9
// Min Acres choices (owner, 10/24: no .75; 2+, 3+ and 5+ added).
const ACRE_STEPS = [0, 0.1, 0.25, 0.5, 1, 2, 3, 5]
// Price picker steps - Zillow's increments: $50k steps to $1M, $250k to $3M, $500k to $5M, then $1M.
const PRICE_STEPS: number[] = [
  ...Array.from({ length: 20 }, (_, i) => (i + 1) * 50_000),
  ...Array.from({ length: 8 }, (_, i) => 1_250_000 + i * 250_000),
  3_500_000, 4_000_000, 4_500_000, 5_000_000,
  ...Array.from({ length: 5 }, (_, i) => 6_000_000 + i * 1_000_000),
  12_500_000, 15_000_000, 20_000_000,
]
const shortPrice = (n: number) => n >= 1_000_000
  ? `$${(n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
  : `$${Math.round(n / 1000).toLocaleString()}k`

// The miles slider: a rounded track that fills in orange up to the knob, with a matching knob.
const KIT_RANGE_CSS = `
.kit-range{background:linear-gradient(90deg,#e8a33d 0%,#C9A24D var(--kit-fill),var(--kit-track) var(--kit-fill),var(--kit-track) 100%);outline:none}
.kit-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;height:22px;width:22px;border-radius:9999px;background:#fff;border:3px solid #C9A24D;box-shadow:0 4px 10px -3px rgba(139,106,43,.6);cursor:pointer;transition:transform .15s}
.kit-range:active::-webkit-slider-thumb{transform:scale(1.12)}
.kit-range::-moz-range-thumb{height:18px;width:18px;border-radius:9999px;background:#fff;border:3px solid #C9A24D;box-shadow:0 4px 10px -3px rgba(139,106,43,.6);cursor:pointer}
.kit-range::-moz-range-progress{background:#C9A24D;height:8px;border-radius:9999px}
.kit-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px rgba(201,162,77,.3)}
`

const PULL_UP_H = 'min(42vh, 330px)'

// Phones: nudge the scrolling window so a price box sits above the pull-up (both boxes stay tappable).
function keepAbovePullUp(el: HTMLElement) {
  const sheet = Math.min(window.innerHeight * 0.42, 330)
  const r = el.getBoundingClientRect()
  const limit = window.innerHeight - sheet - 20
  let scroller: HTMLElement | null = el.parentElement
  while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement
  const by = r.bottom > limit ? r.bottom - limit : r.top < 70 ? r.top - 70 : 0
  if (by) (scroller || document.scrollingElement || document.documentElement).scrollBy({ top: by, behavior: 'smooth' })
}

// The price choices for one box: "No min"/"No max", then the steps that still make sense next to
// the other box (a min never above the max). The value already set stays listed even when it's
// not a step (e.g. the starting range from the home's own price).
function priceOptions(field: 'minPrice' | 'maxPrice', prefs: SearchPreferences) {
  const other = field === 'minPrice' ? prefs.maxPrice : prefs.minPrice
  const steps = PRICE_STEPS.filter(n => !other || (field === 'minPrice' ? n <= other : n >= other))
  const cur = prefs[field]
  if (cur && !steps.includes(cur)) steps.push(cur)
  return [0, ...steps.sort((a, b) => a - b)]
}

function PriceList({ field, prefs, onPick, desktop = false }: { field: 'minPrice' | 'maxPrice'; prefs: SearchPreferences; onPick: (field: 'minPrice' | 'maxPrice', v: number) => void; desktop?: boolean }) {
  const listRef = useRef<HTMLDivElement>(null)
  const cur = prefs[field]
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-on="true"]')
    if (el && listRef.current) listRef.current.scrollTop = el.offsetTop - listRef.current.clientHeight / 2 + el.clientHeight / 2
  }, [field])
  const opts = priceOptions(field, prefs)
  const list = (
    <div ref={listRef} role="listbox" aria-label={field === 'minPrice' ? 'Min price' : 'Max price'} data-no-sheet-drag
      className={`overflow-y-auto overscroll-contain ${desktop ? 'max-h-64 p-1.5' : 'h-full px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'}`}>
      {opts.map(n => {
        const on = n === cur
        return (
          <button key={n} type="button" role="option" aria-selected={on} data-on={on} onClick={() => onPick(field, n)}
            className={`flex w-full items-center justify-between rounded-xl px-3 text-left font-black transition-colors ${desktop ? 'py-2 text-sm' : 'py-3 text-[15px]'} ${on ? 'bg-[#C9A24D]/15 text-[#8b6a2b] dark:text-[#e8c97a]' : 'text-gray-800 hover:bg-gray-50 active:bg-gray-100 dark:text-gray-100 dark:hover:bg-white/5'}`}>
            <span>{n === 0 ? (field === 'minPrice' ? 'No Min' : 'No Max') : `$${n.toLocaleString()}`}</span>
            {n > 0 && <span className={`text-[11px] font-bold ${on ? '' : 'text-gray-400'}`}>{on ? <Check className="h-4 w-4" strokeWidth={3} /> : shortPrice(n)}</span>}
          </button>
        )
      })}
    </div>
  )
  if (!desktop) return list
  return (
    <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.16 }}
      data-price-popover className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_24px_50px_-20px_rgba(17,24,39,.45)] dark:border-gray-700 dark:bg-[#151517]">
      {list}
    </motion.div>
  )
}

// Phones: a low pull-up with the price list. No dimmed backdrop - the price boxes above stay
// tappable, and tapping the other one moves this pull-up to it. Drag down (or tap outside) to close.
function PricePullUp({ field, prefs, onPick, onClose }: { field: 'minPrice' | 'maxPrice' | null; prefs: SearchPreferences; onPick: (field: 'minPrice' | 'maxPrice', v: number) => void; onClose: () => void }) {
  const { sheetRef, y } = useSwipeToClose(onClose, !!field)
  const boxRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!field) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || boxRef.current?.contains(t) || t.closest('[data-price-field]')) return
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [field, onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {field && (
        <motion.div key="price-pull" ref={el => { boxRef.current = el; sheetRef(el) }}
          initial={{ y: '100%' }} animate={{ y: 0, transition: { type: 'spring', stiffness: 420, damping: 38 } }} exit={{ y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          style={{ height: PULL_UP_H, y }}
          className="fixed inset-x-0 bottom-0 z-[140] flex flex-col rounded-t-[24px] border-t border-gray-200 bg-white shadow-[0_-22px_50px_-24px_rgba(0,0,0,.55)] dark:border-gray-800 dark:bg-[#151517]">
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-full bg-gray-300 dark:bg-white/20" />
          <div className="flex shrink-0 items-center justify-between px-5 pb-1.5 pt-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p key={field} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}
                className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">{field === 'minPrice' ? 'Min price' : 'Max price'}</motion.p>
            </AnimatePresence>
            <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-[12px] font-black text-gray-500 active:bg-gray-100 dark:text-gray-300 dark:active:bg-white/10">Done</button>
          </div>
          <div className="min-h-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={field} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                <PriceList field={field} prefs={prefs} onPick={onPick} />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

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
  include = true,
  onIncludeChange,
  ownListing = false,
  bare = false,
  keepHiddenSelections = false,
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
  // The kit wizard's Similar Homes switch (the Edit Similar Homes window leaves these out).
  include?: boolean,
  onIncludeChange?: (on: boolean) => void,
  ownListing?: boolean,
  // Inside the kit flow's window: no card of its own, and the window does the scrolling.
  bare?: boolean,
  // Picked homes stay picked when a filter hides them (the kit keeps them) instead of being dropped.
  keepHiddenSelections?: boolean,
}) {
  const [prefs, setPrefs] = useState<SearchPreferences>(initialPreferences)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollFlowTop = useKitFlowScrollTop()
  const kitDock = useKitFlowDock()
  const isPhone = useIsPhone()

  // "View details" for a similar-property card - fetches the full listing (these cards only carry
  // lightweight search-result data) and reuses the same PropertyDetailsModal every other property
  // view surface in the app uses, so this picker gets the same map/listing-agent experience.
  const [viewDetailsProperty, setViewDetailsProperty] = useState<PropertyDetailResponse | null>(null)
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false)
  const [isLoadingViewDetails, setIsLoadingViewDetails] = useState(false)
  // Which result the details window is on (it can step through every result with its arrows), how
  // it got there (which way the next home slides in), and the home to glow once it closes.
  const [viewIndex, setViewIndex] = useState(-1)
  const [viewMove, setViewMove] = useState<HomeMove | null>(null)
  const [glowId, setGlowId] = useState<string | null>(null)
  const detailsSeq = useRef(0)
  const openDetailsAt = async (index: number, dir: 1 | -1 = 1) => {
    const property = sortedProperties[index]
    const listingKey = property?.ListingKey || property?.listingKey
    if (!listingKey) return
    const seq = ++detailsSeq.current
    setViewIndex(index)
    setViewMove(m => ({ dir, kind: 'nav', seq: (m?.seq || 0) + 1 }))
    setIsViewDetailsOpen(true)
    setIsLoadingViewDetails(true)
    // The arrows feel instant: the home's search-result facts + photos show right away, the full
    // listing replaces them a moment later.
    setViewDetailsProperty({ ...property, id: listingKey } as PropertyDetailResponse)
    const { success, data } = await api.properties.lookup({ listingKey })
    if (seq !== detailsSeq.current) return
    if (success && data) setViewDetailsProperty({ ...data, id: listingKey })
    setIsLoadingViewDetails(false)
  }
  const handleViewDetails = (property: any) => {
    const id = String(property.ListingKey || property.listingKey || property.id)
    openDetailsAt(sortedProperties.findIndex(p => String(p.ListingKey || p.listingKey || p.id) === id))
  }
  // Closing: back on the results page that home is on, scrolled to it, with a short glow on it.
  const closeDetails = () => {
    setIsViewDetailsOpen(false)
    setViewDetailsProperty(null)
    const home = sortedProperties[viewIndex]
    if (!home) return
    const id = String(home.ListingKey || home.listingKey || home.id)
    setResultsPage(Math.floor(viewIndex / RESULTS_PAGE_SIZE) + 1)
    setGlowId(id)
    window.setTimeout(() => {
      document.querySelector(`[data-kit-home="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 320)
    window.setTimeout(() => setGlowId(g => (g === id ? null : g)), 2600)
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
  const getMatchScore = (property: any) => computeMatchScore(property, subject, properties)
  const isSameSchool = (property: any) => isSameSchoolDistrict(property, subject)
  const getPropertyAcres = (property: any) => {
    const explicitAcres = getNum(property, ['acres', 'LotSizeAcres', 'lotSizeAcres', 'lot_size_acres'])
    if (explicitAcres) return explicitAcres
    const squareFeet = getNum(property, ['LotSizeSquareFeet', 'lotSizeSquareFeet', 'lot_size', 'lotSize'])
    return squareFeet ? Number((squareFeet / 43560).toFixed(2)) : 0
  }
  const sortedProperties = [...properties].sort((a, b) => getMatchScore(b) - getMatchScore(a))

  // Paginated instead of one long scrolling grid - with a big radius/loose filters this list can
  // run into dozens of matches, which turned "Refine Your Search" into an endless scroll where the
  // mouse had to land exactly on the page's edge scrollbar to move at all. A handful of pages of a
  // few rows each keeps every page short and scroll-free.
  const [resultsPage, setResultsPage] = useState(1)
  useEffect(() => { setResultsPage(1) }, [properties])
  const resultsTotalPages = Math.max(1, Math.ceil(sortedProperties.length / RESULTS_PAGE_SIZE))
  // A new results page starts at the top of the RESULTS (not the top of the window), like turning a page.
  const resultsRef = useRef<HTMLDivElement>(null)
  const goToPage = (n: number) => {
    setResultsPage(n)
    if (resultsRef.current) resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else if (scrollFlowTop) scrollFlowTop()
  }
  const shownIds = new Set(properties.map(p => String(p.ListingKey || p.listingKey || p.id)))
  const hiddenPicks = selectedIdStrings.filter(id => !shownIds.has(id)).length
  const priceBackwards = prefs.maxPrice > 0 && prefs.minPrice > 0 && prefs.maxPrice < prefs.minPrice
  const pagedProperties = sortedProperties.slice((resultsPage - 1) * RESULTS_PAGE_SIZE, resultsPage * RESULTS_PAGE_SIZE)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === "minPrice" || name === "maxPrice") {
      setPrefs(prev => ({ ...prev, [name]: parsePriceFromDisplay(value) }))
    } else {
      setPrefs(prev => ({ ...prev, [name]: Number(value) }))
    }
  }

  // Price picker: one at a time; tapping the other price box moves the picker over to it.
  const [pricePick, setPricePick] = useState<'minPrice' | 'maxPrice' | null>(null)
  const togglePricePick = (key: 'minPrice' | 'maxPrice', el: HTMLElement) => {
    const next = pricePick === key ? null : key
    setPricePick(next)
    // Phones: keep both price boxes in view above the pull-up (it covers the bottom ~40%).
    if (next && isPhone) window.setTimeout(() => keepAbovePullUp(el), 30)
  }
  const pickPrice = (key: 'minPrice' | 'maxPrice', value: number) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
    setPricePick(null)
  }
  const closePricePick = useCallback(() => setPricePick(null), [])
  // Computers: a click anywhere else closes the price list.
  useEffect(() => {
    if (!pricePick || isPhone) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('[data-price-popover], [data-price-field]')) return
      setPricePick(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [pricePick, isPhone])

  useEffect(() => {
    const timeout = setTimeout(() => {
      onPreferencesChange(prefs)
    }, 350)
    return () => clearTimeout(timeout)
  }, [prefs, onPreferencesChange])

  useEffect(() => {
    if (keepHiddenSelections || properties.length === 0) return
    const currentPropertyIds = properties.map(p => String(p.ListingKey || p.listingKey || p.id))
    const nextSelectedIds = selectedIds.filter(id => currentPropertyIds.includes(String(id)))
    const changed = nextSelectedIds.length !== selectedIds.length || nextSelectedIds.some((id, index) => String(id) !== String(selectedIds[index]))
    if (changed) onSelectionChange(nextSelectedIds)
  }, [properties, selectedIds, onSelectionChange, keepHiddenSelections])

  const toggleProperty = (id: string | number) => {
    const stringId = String(id)
    if (selectedIdStrings.includes(stringId)) {
      onSelectionChange(selectedIds.filter(selectedId => String(selectedId) !== stringId))
    } else {
      onSelectionChange([...selectedIds, stringId])
    }
  }

  return (
    <div ref={rootRef} className={bare ? 'flex scroll-mt-4 flex-col' : 'bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 transition-colors max-w-7xl mx-auto animate-fadeIn h-full flex flex-col overflow-hidden'}>
      <style>{KIT_RANGE_CSS}</style>
      {/* overscrollBehavior: 'auto' overrides a global rule (globals.css: any .overflow-y-auto
          gets overscroll-behavior: contain, so a modal's internal scroll doesn't chain into the
          page behind it). That rule assumes this element is always its own fully self-contained
          scroll region, but this one isn't - the Property Selection grid below deliberately has
          no scroll cap of its own and expects wheel input to fall through to the real page scroll
          once this panel's own content fits (see the "No height cap/inner scroll here on purpose"
          comment further down). With the global "contain" behavior in force, once wheel input
          fails to scroll this element internally, the browser refuses to hand it up to the page
          at all - so scrolling worked only once the cursor left this panel entirely (the actual
          "have to reach the edge of the page" bug). Only this specific container needs the
          override; it's inline so it beats the class-based rule regardless of stylesheet order. */}
      <div className={bare ? 'px-4 pb-6 sm:px-8 sm:pb-8' : 'flex-1 overflow-y-auto px-5 pb-5 sm:px-8 sm:pb-8'} style={bare ? undefined : { overscrollBehavior: 'auto' }}>
        {onIncludeChange && <SimilarIncludeBar include={include} ownListing={ownListing} onChange={onIncludeChange} />}
        {!include ? (
          <SimilarOffPanel address={formatSubjectAddress(subjectAddress)} ownListing={ownListing} onBack={onBack} onNext={onNext} onTurnOn={() => onIncludeChange?.(true)} docked={!!kitDock} />
        ) : (<>
        <div className={`mb-5 rounded-2xl border border-gray-100 bg-[#faf9f7] p-4 shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] sm:p-5 ${onIncludeChange ? 'mt-4' : 'mt-5 sm:mt-8'}`}>
          <div className="-m-4 mb-4 flex items-center justify-center rounded-t-2xl border-b border-gray-200 bg-gradient-to-r from-[#faf6ec] via-white to-[#faf6ec] px-4 py-2.5 dark:border-gray-800 dark:from-[#1c1710] dark:via-[#151517] dark:to-[#1c1710] sm:-m-5 sm:mb-5 sm:px-5">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A24D]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#8b7355] ring-1 ring-[#C9A24D]/25 dark:text-[#d7b974]">
              <Layers className="h-3.5 w-3.5" /> Similar Homes Sheet
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="min-w-0">
              <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">Refine Your Search</h2>
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
              {/* Prices are picked from a list (Zillow's steps), never typed - no keyboard popping up.
                  Phones: a low pull-up, so the other price box stays tappable above it. */}
              <div className="grid grid-cols-2 gap-3">
                {(['minPrice', 'maxPrice'] as const).map(key => (
                  <div key={key}>
                    <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{key === 'minPrice' ? 'Min Price' : 'Max Price'}</label>
                    <div className="relative">
                      <button type="button" data-price-field={key} onClick={e => togglePricePick(key, e.currentTarget)} aria-haspopup="listbox" aria-expanded={pricePick === key}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-left text-base text-gray-900 transition-all sm:text-sm dark:bg-[#151517] dark:text-white ${pricePick === key ? 'border-[#C9A24D] ring-2 ring-[#C9A24D]' : key === 'maxPrice' && priceBackwards ? 'border-red-300 dark:border-red-500/50' : 'border-gray-200 dark:border-gray-700'}`}>
                        <span className={prefs[key] ? '' : 'text-gray-400'}>{prefs[key] ? `$${formatPriceForDisplay(prefs[key])}` : key === 'minPrice' ? 'No Min' : 'No Max'}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${pricePick === key ? 'rotate-180 text-[#C9A24D]' : ''}`} />
                      </button>
                      {!isPhone && (
                        <AnimatePresence>
                          {pricePick === key && (
                            <PriceList field={key} prefs={prefs} onPick={pickPrice} desktop />
                          )}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {isPhone && <PricePullUp field={pricePick} prefs={prefs} onPick={pickPrice} onClose={closePricePick} />}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Beds</label>
                  <select name="minBeds" value={prefs.minBeds} onChange={handleChange} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 transition-all sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                    {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+ Beds</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Acres</label>
                  <select name="minAcres" value={prefs.minAcres || 0} onChange={handleChange} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 transition-all sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                    {(ACRE_STEPS.includes(prefs.minAcres || 0) ? ACRE_STEPS : [...ACRE_STEPS, prefs.minAcres || 0].sort((a, b) => a - b)).map(n => <option key={n} value={n}>{n === 0 ? 'Any' : `${n}+`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-[9px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Min Baths</label>
                  <select name="minBaths" value={prefs.minBaths} onChange={handleChange} className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 transition-all sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A24D] dark:border-gray-700 dark:bg-[#151517] dark:text-white">
                    {[0, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => <option key={n} value={n}>{n}+ Baths</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-[#151517]">
                {/* The bar fills in orange up to the knob (kit-range in KIT_RANGE_CSS). */}
                <input type="range" name="radius" min="1" max="20" step="1" value={prefs.radius} onChange={handleChange} aria-label="Search radius in miles"
                  className="kit-range h-2 flex-1 cursor-pointer appearance-none rounded-full [--kit-track:#e5e7eb] dark:[--kit-track:#374151]"
                  style={{ ['--kit-fill' as string]: `${((prefs.radius - 1) / 19) * 100}%` }} />
                <div className="min-w-[70px] text-right"><span className="text-base font-black text-gray-900 dark:text-white">{prefs.radius}</span><span className="ml-1 text-[9px] font-bold uppercase text-gray-500">Miles</span></div>
              </div>
              <p className={`min-h-[14px] text-[9px] font-medium ${priceBackwards ? 'font-bold text-red-500' : 'text-gray-400'}`}>{priceBackwards ? 'Max price is below the min price - no home can match.' : 'Search area centered on this home.'}</p>
            </div>
          </div>
        </div>

        {/* Phones: no box-in-a-box - the homes run edge to edge under a slim sticky count bar. */}
        <div ref={resultsRef} className="scroll-mt-0 sm:rounded-2xl sm:border sm:border-gray-200 sm:bg-[#f1f3f5] sm:p-5 sm:shadow-inner sm:dark:border-gray-800 sm:dark:bg-transparent">
          {/* Sticky so the Continue button (and the result counts) stay on screen while only the
              property cards below scroll under it - the whole panel is one scroll region, and
              before this the header scrolled away with everything else. Negative margins bleed the
              bar to the container edges and cover its rounded top corners; the parent scroll
              container's top padding was moved onto its children so top-0 pins flush. */}
          <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-gray-200/70 bg-[#FAFAF7] px-4 py-2.5 dark:border-gray-800 dark:bg-[#151517] sm:-mx-5 sm:-mt-5 sm:mb-4 sm:rounded-t-2xl sm:bg-[#f1f3f5] sm:px-5 sm:pb-3 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black text-gray-900 dark:text-white sm:text-lg">Property Selection</h3>
              <p className="text-xs font-semibold text-gray-400 max-sm:hidden">Results update automatically as you refine filters.</p>
              <p className="text-[11.5px] font-semibold text-gray-400 sm:hidden">Tap homes to add them</p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
              <button onClick={onBack} className={`${kitDock ? 'max-sm:hidden ' : ''}inline-flex items-center justify-center self-stretch rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-black sm:self-start sm:px-4 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-[#0B0B0B] dark:text-gray-400 dark:hover:bg-gray-800`}>Back</button>
              <div className="inline-flex items-center justify-center self-stretch rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 sm:self-start sm:rounded-2xl sm:px-4 sm:py-2 dark:border-gray-800 dark:bg-[#0B0B0B]">
                <span className="mr-1.5 text-[9px] sm:mr-2 sm:text-[10px] font-black uppercase tracking-wide text-gray-400">Results</span>
                <span className="inline-flex min-w-[1.5rem] items-center justify-center text-base font-black sm:text-lg text-[#111827] dark:text-white">{isLoading ? <OhpSpinner size={16} /> : properties.length}</span>
              </div>
              <div className="inline-flex items-center justify-center self-stretch rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 sm:self-start sm:rounded-2xl sm:px-4 sm:py-2 dark:border-emerald-900/30 dark:bg-emerald-900/10">
                <span className="mr-1.5 text-[9px] sm:mr-2 sm:text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Selected</span>
                <motion.span key={selectedIds.length} initial={{ scale: 1.5, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} className="inline-block text-base font-black text-emerald-700 dark:text-emerald-300 sm:text-lg">{selectedIds.length}</motion.span>
              </div>
              <button onClick={onNext} disabled={selectedIds.length === 0} className={`${kitDock ? 'max-sm:hidden ' : ''}max-sm:w-full inline-flex items-center justify-center self-start rounded-2xl border border-transparent bg-[#111827] dark:bg-white px-5 py-2 text-sm font-black uppercase tracking-widest text-white dark:text-[#111827] shadow-lg transition-all duration-200 hover:bg-[#8b7355] hover:text-white dark:hover:bg-[#C9A24D] disabled:cursor-not-allowed disabled:opacity-50`}>Continue ({selectedIds.length})</button>
            </div>
          </div>
          {/* Picked homes the current filters hide: their own full-width line under the counts (on a
              phone it used to squeeze in beside them and crush "Tap homes to add them"). */}
          <AnimatePresence initial={false}>
            {keepHiddenSelections && hiddenPicks > 0 && (
              <motion.div key="hidden-picks" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 0.61, 0.36, 1] }} className="overflow-hidden">
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold leading-snug text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span><span className="font-black">{hiddenPicks} picked {hiddenPicks === 1 ? 'home isn’t' : 'homes aren’t'} in these results</span> - {hiddenPicks === 1 ? 'it stays' : 'they stay'} in your kit.</span>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          </div>

          <div className="relative min-h-[460px]">
          {properties.length === 0 && isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#0B0B0B]">
                  <div className="aspect-[4/3] animate-pulse bg-gray-200/70 dark:bg-white/5" style={{ animationDelay: `${i * 90}ms` }} />
                  <div className="space-y-2 p-4"><div className="h-3 w-2/3 animate-pulse rounded-full bg-gray-200/80 dark:bg-white/5" /><div className="h-3 w-1/3 animate-pulse rounded-full bg-gray-200/80 dark:bg-white/5" /></div>
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-gray-800">
              <Search className="mx-auto mb-3 h-6 w-6 text-gray-300" />
              <p className="text-sm font-black text-gray-500 dark:text-gray-400">{priceBackwards ? 'Max price is below the min price' : 'No homes match these filters'}</p>
              <p className="mt-1 text-xs font-semibold text-gray-400">{priceBackwards ? 'Raise the max price or lower the min.' : 'Try widening the radius or the price range.'}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 select-none sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {pagedProperties.map((property) => {
                  const propertyId = String(property.ListingKey || property.listingKey || property.id)
                  const isSelected = selectedIdStrings.includes(propertyId)
                  return (
                    <motion.div key={propertyId} data-kit-home={propertyId} onClick={() => toggleProperty(propertyId)} className="relative cursor-pointer scroll-mt-28"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(pagedProperties.indexOf(property), 8) * 0.035, ease: [0.22, 0.61, 0.36, 1] }}>
                      {/* The home the details window was on when it closed: a short gold glow. */}
                      <AnimatePresence>
                        {glowId === propertyId && (
                          <motion.span key="glow" aria-hidden initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.55, 1] }} exit={{ opacity: 0, transition: { duration: 0.6 } }} transition={{ duration: 1.1 }}
                            className={`pointer-events-none absolute -inset-1 z-10 ${isPhone ? 'rounded-[20px]' : 'rounded-[28px]'} ring-[3px] ring-[#C9A24D] shadow-[0_0_0_7px_rgba(201,162,77,.22),0_18px_40px_-16px_rgba(201,162,77,.8)]`} />
                        )}
                      </AnimatePresence>
                      {isPhone ? (
                        <KitHomeRow property={property} selected={isSelected} matchScore={getMatchScore(property)} sameSchool={isSameSchool(property)}
                          acres={getPropertyAcres(property)} onViewDetails={() => handleViewDetails(property)} />
                      ) : (
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
                        viewDetailsButton
                        onViewDetails={() => handleViewDetails(property)}
                      />
                      )}
                    </motion.div>
                  )
                })}
              </div>
              {resultsTotalPages > 1 && (
                <div className="mt-5 flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => goToPage(Math.max(1, resultsPage - 1))}
                    disabled={resultsPage === 1}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: resultsTotalPages }, (_, i) => i + 1).map(n => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => goToPage(n)}
                      className={`h-8 min-w-[2rem] rounded-lg px-2 text-xs font-black transition ${
                        n === resultsPage ? 'bg-[#C9A24D] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => goToPage(Math.min(resultsTotalPages, resultsPage + 1))}
                    disabled={resultsPage === resultsTotalPages}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-white dark:hover:bg-gray-800 disabled:opacity-30"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
          {isLoading && properties.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-[#f1f3f5]/55 transition-opacity dark:bg-[#151517]/55">
              <div className="sticky top-24 flex justify-center pt-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-black text-[#8b7355] shadow-lg dark:bg-[#0B0B0B] dark:text-[#e8c97a]">
                  <OhpSpinner size={15} /> Updating results
                </span>
              </div>
            </div>
          )}
          </div>
        </div>
        </>)}
      </div>

      {/* Phones, inside the kit window: the flow bar - the same onBack / onNext as the buttons above
          (Continue needs a picked home unless Similar Homes is switched off). */}
      {kitDock && (
        <FlowDock step={kitDock.step} total={kitDock.total} onBack={kitDock.step > 1 ? onBack : undefined}
          onContinue={onNext} disabled={include && selectedIds.length === 0}
          note={include ? `${selectedIds.length} picked` : 'Sheet off'} />
      )}

      {/* zIndex above EditSimilarPropertiesModal's z-[110] wrapper (harmless when reached from the
          plain wizard step instead, which has no competing high z-index). */}
      <PropertyDetailsModal
        property={viewDetailsProperty}
        isOpen={isViewDetailsOpen}
        onClose={closeDetails}
        isLoadingDetails={isLoadingViewDetails}
        zIndex={130}
        // The agent picking homes: no buyer Love / Pass or "Ask your agent" - just Select, with the
        // arrows stepping through every result (all pages).
        showVisitorActions={false}
        picker={viewIndex >= 0 && sortedProperties[viewIndex] ? (() => {
          const id = String(sortedProperties[viewIndex].ListingKey || sortedProperties[viewIndex].listingKey || sortedProperties[viewIndex].id)
          return { selected: selectedIdStrings.includes(id), onToggle: () => toggleProperty(id) }
        })() : null}
        nav={viewIndex >= 0 ? {
          index: viewIndex,
          total: sortedProperties.length,
          onPrev: viewIndex > 0 ? () => openDetailsAt(viewIndex - 1, -1) : null,
          onNext: viewIndex < sortedProperties.length - 1 ? () => openDetailsAt(viewIndex + 1, 1) : null,
        } : null}
        move={viewMove}
      />
    </div>
  )
})

// Phones: a home in the Similar Homes picker as one slim row - photo left, the facts right, a green
// check when it's in - so a page of results is a quick scan, not a long scroll of full-width photos
// (owner, 10/22). Computers keep the big cards.
function KitHomeRow({ property, selected, matchScore, sameSchool, acres, onViewDetails }: {
  property: any; selected: boolean; matchScore?: number; sameSchool?: boolean; acres?: number; onViewDetails: () => void
}) {
  const street = String(property.FullStreetAddress || property.address || 'Address not available').split(',')[0].trim()
    .toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
  const town = String(property.City || property.city || '').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
  const state = property.StateOrProvince || property.state || ''
  const price = Number(property.ListPrice || property.price) || 0
  const beds = property.BedroomsTotal ?? property.bedrooms ?? property.beds
  const baths = property.BathroomsTotal ?? property.bathrooms ?? property.baths
  const sqft = Number(property.LivingArea || property.sqft) || 0
  const img = normalizeImageUrl(property.ListPictureURL || property.imageUrl || property.imgSrc || property.image) || '/placeholder.svg'
  const facts = [
    beds ? `${formatPropertyFeature(beds)} bd` : null,
    baths ? `${formatPropertyFeature(baths)} ba` : null,
    sqft ? `${sqft.toLocaleString()} sqft` : null,
    acres ? `${acres.toLocaleString(undefined, { maximumFractionDigits: 2 })} ac` : null,
  ].filter(Boolean).join(' · ')
  return (
    <div className={`relative flex items-stretch gap-3 rounded-2xl border-2 p-1.5 pr-[4.25rem] transition-all duration-300 ${selected
      ? 'border-emerald-500 bg-emerald-50/70 shadow-[0_14px_26px_-18px_rgba(5,150,105,.9)] dark:bg-emerald-500/10'
      : 'border-transparent bg-white shadow-[0_8px_22px_-18px_rgba(17,24,39,.55)] ring-1 ring-black/[0.06] dark:bg-[#0B0B0B] dark:ring-white/10'}`}>
      <div className="relative h-[92px] w-[100px] shrink-0 overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-800">
        <img src={img} alt="" draggable={false} loading="lazy" className={`h-full w-full object-cover transition duration-300 ${selected ? 'brightness-90' : ''}`} />
        {typeof matchScore === 'number' && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-black text-white shadow">{matchScore}%</span>
        )}
        <AnimatePresence>
          {selected && (
            <motion.span key="on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-emerald-600/25">
              <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white shadow-lg"><Check className="h-4 w-4" strokeWidth={3.5} /></motion.span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
        <p className="truncate text-[15px] font-black leading-tight text-[#111827] dark:text-white">{street}</p>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-gray-500 dark:text-gray-400">
          {[town, state].filter(Boolean).join(', ')}{sameSchool && <span className="font-black text-[#8b7355] dark:text-[#e8c97a]"> · Same school</span>}
        </p>
        <p className="mt-1.5 text-[15px] font-black leading-none text-[#8b7355] dark:text-[#e8c97a]">{price ? `$${price.toLocaleString()}` : 'Price N/A'}</p>
        {facts && <p className="mt-1 truncate text-[11.5px] font-bold text-gray-500 dark:text-gray-400">{facts}</p>}
      </div>
      {/* A big, square "View details" button (owner, 10/24) - tapping the rest of the row picks the home. */}
      <button type="button" onClick={e => { e.stopPropagation(); onViewDetails() }} aria-label="View details"
        className="absolute bottom-1.5 right-1.5 top-1.5 flex w-[54px] flex-col items-center justify-center gap-1 rounded-xl bg-[#faf6ec] text-[#8b7355] ring-1 ring-[#C9A24D]/25 transition active:scale-95 active:bg-[#C9A24D]/15 dark:bg-white/[0.06] dark:text-[#e8c97a] dark:ring-white/10">
        <Eye className="h-[19px] w-[19px]" />
        <span className="text-center text-[9px] font-black uppercase leading-[1.05] tracking-wide">View<br />details</span>
      </button>
    </div>
  )
}

// The Similar Homes step's switch: include a Similar Homes sheet (+ similar homes on the Guest
// Pass) or not. Starts off when it's your own listing - the bar says why.
function SimilarIncludeBar({ include, ownListing, onChange }: { include: boolean; ownListing: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className={`mt-5 flex flex-col gap-3 rounded-2xl border p-4 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${include ? 'border-[#C9A24D]/30 bg-[#fbf6ea] dark:border-[#C9A24D]/25 dark:bg-[#C9A24D]/[0.06]' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#0B0B0B]'}`}>
      {/* Phones: the icon sits in the title line so the description runs the full width (it used to
          leave a big empty gap under the icon). */}
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${include ? 'bg-[#111827] text-[#e8c97a]' : 'bg-gray-100 text-gray-400 dark:bg-white/10'}`}><Layers className="h-5 w-5" /></span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-black text-gray-900 dark:text-white">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:hidden ${include ? 'bg-[#111827] text-[#e8c97a]' : 'bg-gray-100 text-gray-400 dark:bg-white/10'}`}><Layers className="h-4 w-4" /></span>
            Similar Homes
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-gray-500 dark:text-gray-400 sm:mt-0.5">
            A printed sheet of similar homes for sale, and the same homes on each guest&apos;s Guest Pass.
            {ownListing && !include && <span className="mt-1 block font-bold text-[#8b7355] dark:text-[#e8c97a]">You&apos;re the listing agent here, so this starts off - guests stay focused on your listing.</span>}
          </p>
        </div>
      </div>
      {/* Off: no switch here - "Pick similar homes instead" right under Back already turns it on. */}
      {include && <button
        type="button"
        role="switch"
        aria-checked={include}
        aria-label="Include Similar Homes"
        onClick={() => onChange(!include)}
        className={`inline-flex shrink-0 items-center gap-2 self-start rounded-full border py-1.5 pl-3 pr-1.5 text-xs font-black uppercase tracking-wide transition-colors sm:self-center ${include ? 'border-[#C9A24D]/50 bg-white text-[#8b7355] dark:bg-[#151517] dark:text-[#e8c97a]' : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-400'}`}
      >
        {include ? 'Included' : 'Off'}
        <span className={`relative h-6 w-11 rounded-full transition-colors ${include ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${include ? 'left-[22px]' : 'left-0.5'}`} />
        </span>
      </button>}
    </div>
  )
}

// Shown instead of the home picker while Similar Homes is off.
function SimilarOffPanel({ address, ownListing, onBack, onNext, onTurnOn, docked = false }: { address: string; ownListing: boolean; onBack: () => void; onNext: () => void; onTurnOn: () => void; docked?: boolean }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-[#faf9f7] px-5 py-10 text-center dark:border-gray-800 dark:bg-[#0B0B0B] sm:px-10 sm:py-14">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#C9A24D] shadow-sm dark:bg-[#151517]"><DoorOpen className="h-7 w-7" /></span>
      <h3 className="mt-4 font-serif text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">All eyes on {address || 'this home'}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400">
        No Similar Homes sheet in this kit, and guests won&apos;t see other homes on their Guest Pass.
        {`${ownListing ? ' Perfect for sitting your own listing.' : ''} You can turn it on any time from this open house’s card.`}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <button type="button" onClick={onBack} className={`${docked ? 'max-sm:hidden ' : ''}w-full rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-[#151517] dark:text-gray-300 sm:w-auto`}>Back</button>
        <button type="button" onClick={onTurnOn} className="w-full rounded-2xl border border-[#C9A24D]/50 bg-white px-5 py-2.5 text-sm font-black text-[#8b7355] transition-colors hover:bg-[#C9A24D]/10 dark:bg-[#151517] dark:text-[#e8c97a] sm:w-auto">Pick similar homes instead</button>
        <button type="button" onClick={onNext} className={`${docked ? 'max-sm:hidden ' : ''}w-full rounded-2xl bg-[#111827] px-6 py-2.5 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-colors hover:bg-[#8b7355] dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:w-auto`}>Continue</button>
      </div>
    </div>
  )
}

// MLS media occasionally mislabels a builder's virtual-tour page or a hosted video (e.g. Lennar
// virtual-tour pages, Aryeo "/videos/..." links) as MediaCategory=Photo - it's a webpage or video,
// not an image file, and next/image hard-errors on it (unconfigured host or non-image response),
// crashing the whole picker. Filter those out rather than trying to allowlist every tour/video host.
const isRealPhotoUrl = (url: any): url is string =>
  typeof url === 'string' &&
  url.length > 0 &&
  !/virtual-?tour|\/videos?\//i.test(url) &&
  !/\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url)

// --- No-MLS: the kit window's "Home details" step ---------------------------------------------
// No Bright listing to pull from, so the agent enters what the Bright flow would have filled in:
// address, price / beds / baths / size and the photos (the cover-photo step after this picks from
// them). Same window, step bar, phone flow bar and live Sign-In Sheet preview as every other step.
type ManualDraft = { typed: string; street: string; city: string; state: string; zip: string; price?: string; beds?: string; baths?: string; sqft?: string; photos?: string[] }

// "123 Main St, Bryn Mawr, PA 19010" -> its parts (anything missing is simply left blank).
function parseTypedAddress(typed: string): Omit<ManualDraft, 'typed'> {
  const parts = typed.split(',').map(s => s.trim()).filter(Boolean)
  const street = parts[0] || ''
  let city = parts[1] || ''
  let state = '', zip = ''
  const tail = (parts[2] || '').toUpperCase()
  const m = tail.match(/^([A-Z]{2})\s*(\d{5})?/)
  if (m) { state = m[1]; zip = m[2] || '' }
  else if (!parts[2] && city) {
    // "Bryn Mawr PA 19010" typed without the last comma
    const m2 = city.match(/^(.*?)\s+([A-Za-z]{2})\s*(\d{5})?$/)
    if (m2) { city = m2[1]; state = m2[2].toUpperCase(); zip = m2[3] || '' }
  }
  return { street, city, state, zip, photos: [] }
}

const BED_CHOICES = ['1', '2', '3', '4', '5', '6']
const BATH_CHOICES = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '5']
const MAX_MANUAL_PHOTOS = 20

function ManualDetailsStep({ draft, onDraftChange, onBack, onComplete }: {
  draft: ManualDraft | null
  onDraftChange: (d: ManualDraft) => void
  onBack: () => void
  onComplete: (propertyData: any, fullAddress: string) => void
}) {
  const d: ManualDraft = draft || { typed: '', street: '', city: '', state: '', zip: '', photos: [] }
  const set = (patch: Partial<ManualDraft>) => onDraftChange({ ...d, ...patch })
  const photos = d.photos || []
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [previewPos, setPreviewPos] = useState({ x: 50, y: 50 })
  const kitDock = useKitFlowDock()
  // Latest photo list for uploads that finish one after another.
  const photosRef = useRef(photos)
  photosRef.current = photos
  const draftRef = useRef(d)
  draftRef.current = d

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return
    setError('')
    const list = Array.from(files).slice(0, Math.max(0, MAX_MANUAL_PHOTOS - photos.length))
    setUploading(n => n + list.length)
    for (const file of list) {
      try {
        const res = await api.studio.uploadMedia(file)
        if (res.success && res.data?.url) {
          const next = [...photosRef.current, resolveMediaUrl(res.data.url)]
          photosRef.current = next
          onDraftChange({ ...draftRef.current, photos: next })
        } else setError(res.error || 'A photo didn\'t upload - try it again.')
      } catch { setError('A photo didn\'t upload - try it again.') }
      setUploading(n => n - 1)
    }
  }
  const removePhoto = (url: string) => set({ photos: photos.filter(p => p !== url) })
  const makeCover = (url: string) => set({ photos: [url, ...photos.filter(p => p !== url)] })

  // Kept short - it also sits under the step counter in the phone flow bar.
  const missing = !d.street.trim() ? 'Add the street' : !d.city.trim() ? 'Add the city' : !/^[A-Za-z]{2}$/.test(d.state.trim()) ? 'Add the state' : !photos.length ? 'Add a photo' : ''
  const fullAddress = `${d.street.trim()}, ${d.city.trim()}, ${d.state.trim().toUpperCase()}${d.zip.trim() ? ' ' + d.zip.trim() : ''}`
  const propertyData = {
    FullStreetAddress: d.street.trim(),
    City: d.city.trim(),
    StateOrProvince: d.state.trim().toUpperCase(),
    PostalCode: d.zip.trim() || undefined,
    ListPrice: d.price ? Number(d.price) : undefined,
    BedroomsTotal: d.beds ? Number(d.beds) : undefined,
    BathroomsTotal: d.baths ? Number(d.baths) : undefined,
    LivingArea: d.sqft ? Number(d.sqft) : undefined,
    MlsStatus: 'ACTIVE',
    ListingKey: '',
    photos,
    ListPictureURL: photos[0],
  }
  const next = () => {
    if (missing || uploading) { setError(missing || 'Hang on - photos are still uploading.'); return }
    onComplete(propertyData, fullAddress)
  }

  const input = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base font-semibold text-[#0B0B0B] placeholder-gray-400 shadow-sm transition focus:border-[#C9A24D] focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:placeholder-gray-500 sm:text-sm'
  const label = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400'
  const section = 'rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-[0_14px_34px_-28px_rgba(17,24,39,.55)] dark:border-gray-800 dark:bg-white/[0.03] sm:p-5'
  const chip = (on: boolean) => `relative h-11 min-w-[2.75rem] flex-1 rounded-xl border px-2 text-sm font-black transition active:scale-95 ${on ? 'border-[#111827] bg-[#111827] text-white shadow-md dark:border-[#e8c97a] dark:bg-[#e8c97a] dark:text-[#111827]' : 'border-gray-200 bg-white text-gray-700 hover:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-200'}`
  const rise = (i: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.38, delay: 0.06 * i, ease: [0.22, 0.61, 0.36, 1] as const } })

  return (
    <div className="px-4 pb-6 sm:px-8 sm:pb-8">
      <div className={`${kitDock ? 'max-sm:hidden ' : ''}sticky top-0 z-20 -mx-4 mb-5 flex flex-col gap-3 border-b border-gray-200/60 bg-[#FAFAF7] px-4 py-3 sm:-mx-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:border-gray-800 dark:bg-[#151517]`}>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Add what guests will see on the Sign-In Sheet - no Bright MLS needed.</p>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          <button type="button" onClick={onBack} className="flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:flex-none">Cancel</button>
          <button type="button" onClick={next} disabled={!!missing || uploading > 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all duration-300 hover:bg-[#8b7355] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:flex-none">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <motion.section {...rise(0)} className={section}>
            <p className="mb-3 flex items-center gap-2 font-serif text-lg font-black text-[#0B0B0B] dark:text-white"><MapPin className="h-4 w-4 text-[#C9A24D]" /> Where is it?</p>
            <label className={label} htmlFor="manual-street">Street address</label>
            <input id="manual-street" value={d.street} onChange={e => set({ street: e.target.value })} placeholder="123 Main St" autoComplete="address-line1" className={input} />
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4.5rem_6rem] gap-2.5 sm:grid-cols-[minmax(0,1fr)_5rem_7rem]">
              <div className="min-w-0">
                <label className={label} htmlFor="manual-city">City</label>
                <input id="manual-city" value={d.city} onChange={e => set({ city: e.target.value })} placeholder="Bryn Mawr" autoComplete="address-level2" className={input} />
              </div>
              <div>
                <label className={label} htmlFor="manual-state">State</label>
                <input id="manual-state" value={d.state} onChange={e => set({ state: e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() })} placeholder="PA" autoComplete="address-level1" className={`${input} uppercase`} />
              </div>
              <div>
                <label className={label} htmlFor="manual-zip">ZIP</label>
                <input id="manual-zip" value={d.zip} onChange={e => set({ zip: e.target.value.replace(/[^0-9]/g, '').slice(0, 5) })} placeholder="19010" inputMode="numeric" autoComplete="postal-code" className={input} />
              </div>
            </div>
          </motion.section>

          <motion.section {...rise(1)} className={section}>
            <p className="mb-3 flex items-center gap-2 font-serif text-lg font-black text-[#0B0B0B] dark:text-white"><Sparkles className="h-4 w-4 text-[#C9A24D]" /> The basics <span className="font-sans text-[11px] font-bold text-gray-400">optional</span></p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={label} htmlFor="manual-price"><DollarSign size={11} className="-mt-0.5 mr-0.5 inline" />Price</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400 sm:text-sm">$</span>
                  <input id="manual-price" value={d.price ? Number(d.price).toLocaleString() : ''} onChange={e => set({ price: e.target.value.replace(/[^0-9]/g, '').slice(0, 9) })} placeholder="450,000" inputMode="numeric" className={`${input} pl-7`} />
                </div>
              </div>
              <div>
                <label className={label} htmlFor="manual-sqft"><LandPlot size={11} className="-mt-0.5 mr-0.5 inline" />Square feet</label>
                <input id="manual-sqft" value={d.sqft ? Number(d.sqft).toLocaleString() : ''} onChange={e => set({ sqft: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} placeholder="1,800" inputMode="numeric" className={input} />
              </div>
            </div>
            <p className={`${label} mt-4`}><Bed size={11} className="-mt-0.5 mr-0.5 inline" />Bedrooms</p>
            <div className="flex gap-1.5">
              {BED_CHOICES.map(b => <button key={b} type="button" onClick={() => set({ beds: d.beds === b ? '' : b })} className={chip(d.beds === b)}>{b === '6' ? '6+' : b}</button>)}
            </div>
            <p className={`${label} mt-4`}><Bath size={11} className="-mt-0.5 mr-0.5 inline" />Bathrooms</p>
            <div className="grid grid-cols-4 gap-1.5 sm:flex">
              {BATH_CHOICES.map(b => <button key={b} type="button" onClick={() => set({ baths: d.baths === b ? '' : b })} className={chip(d.baths === b)}>{b === '5' ? '5+' : b}</button>)}
            </div>
          </motion.section>

          <motion.section {...rise(2)} className={section}>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="flex items-center gap-2 font-serif text-lg font-black text-[#0B0B0B] dark:text-white"><Upload className="h-4 w-4 text-[#C9A24D]" /> Photos</p>
              <p className="text-[11px] font-bold text-gray-400">{photos.length ? `${photos.length} added · first = cover` : 'At least one'}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              <AnimatePresence initial={false}>
                {photos.map((url, i) => (
                  <motion.div key={url} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.22 }}
                    className={`group relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-[#0B0B0B] ${i === 0 ? 'ring-[3px] ring-[#C9A24D]' : ''}`}>
                    <Image src={url} alt={`Photo ${i + 1}`} fill sizes={KIT_PHOTO_SIZES} className="object-cover" />
                    {i === 0
                      ? <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[#C9A24D] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#111827]">Cover</span>
                      : <button type="button" onClick={() => makeCover(url)} className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-sm">Make cover</button>}
                    <button type="button" onClick={() => removePhoto(url)} aria-label="Remove photo" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white transition active:scale-90"><X className="h-3.5 w-3.5" /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {Array.from({ length: uploading }).map((_, i) => (
                <div key={`up-${i}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/5"><OhpSpinner size={26} /></div>
              ))}
              {photos.length + uploading < MAX_MANUAL_PHOTOS && (
                <label className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#C9A24D]/45 bg-[#C9A24D]/[0.04] text-[#8b7355] transition hover:border-[#C9A24D] hover:bg-[#C9A24D]/10 active:scale-[0.98] dark:text-[#e8c97a] ${photos.length ? 'aspect-square' : 'col-span-3 h-32 sm:col-span-4'}`}>
                  <Upload className="h-5 w-5" />
                  <span className="text-[11px] font-black uppercase tracking-widest">{photos.length ? 'Add more' : 'Add photos'}</span>
                  {!photos.length && <span className="text-[11px] font-semibold text-gray-400">JPG or PNG · pick several at once</span>}
                  <input type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
                </label>
              )}
            </div>
          </motion.section>
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center text-sm font-bold text-red-500">{error}</motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="max-sm:hidden">
          <SignInSheetLivePreview propertyData={propertyData} address={d.street ? fullAddress : ''}
            pending={photos[0] ? { url: photos[0], ...previewPos } : null} onPhotoPositionChange={(_: number, p: { x: number; y: number }) => setPreviewPos(p)} />
        </div>
      </div>
      {kitDock && (
        <FlowDock step={kitDock.step} total={kitDock.total} onBack={onBack} backDisabled={false}
          onContinue={next} disabled={!!missing || uploading > 0} busy={uploading > 0}
          note={missing || undefined} />
      )}
    </div>
  )
}

// The photo grids' image sizes - KitPhotoPreload asks for the very same files ahead of time.
const KIT_PHOTO_SIZES = '(max-width: 768px) 34vw, (max-width: 1280px) 25vw, 320px'
const KIT_FIRST_SCREEN = 9

// A photo step shows its grid once the first screenful of photos has loaded (or after 2.5s at most),
// then the tiles rise in - never a grid of half-loaded grey squares.
function useGridReady(total: number) {
  const need = Math.min(KIT_FIRST_SCREEN, total)
  const [ready, setReady] = useState(need === 0)
  const loaded = useRef(0)
  useEffect(() => {
    if (ready) return
    const t = window.setTimeout(() => setReady(true), 2500)
    return () => window.clearTimeout(t)
  }, [ready])
  const onTileLoad = useCallback(() => {
    loaded.current += 1
    if (loaded.current >= need) setReady(true)
  }, [need])
  return { ready, onTileLoad }
}

// One step ahead: while the agent is on a step, the NEXT step's photos load quietly in the
// background (the same image files the next step's grid asks for), so it opens fully drawn.
function KitPhotoPreload({ urls }: { urls: string[] }) {
  const [go, setGo] = useState(false)
  // Wait a moment so the current step's own images go first.
  useEffect(() => { const t = window.setTimeout(() => setGo(true), 1200); return () => window.clearTimeout(t) }, [])
  if (!go || !urls.length) return null
  return (
    <div aria-hidden className="pointer-events-none fixed -left-[200vw] top-0 h-px w-px overflow-hidden opacity-0">
      {urls.map(u => (
        <div key={u} className="relative h-px w-px"><Image src={u} alt="" fill sizes={KIT_PHOTO_SIZES} quality={88} loading="eager" fetchPriority="low" /></div>
      ))}
    </div>
  )
}

const ImageSelectionView = memo(function ImageSelectionView({ propertyData, address, onImageSelect, onBack, bare = false, initial = null }: any) {
  const availableImages = (propertyData?.photos && propertyData.photos.length > 0 ? propertyData.photos : [propertyData?.ListPictureURL]).filter(isRealPhotoUrl)
  // Picking a thumbnail doesn't advance the wizard right away - it stages the photo so its crop
  // position can be dragged into place first, mirrored live in the preview pane on the right.
  // Coming back to this step keeps the photo (and crop) picked before.
  const [pending, setPending] = useState<{ url: string; x: number; y: number } | null>(initial ? { url: initial.url, x: initial.x ?? 50, y: initial.y ?? 50 } : null)
  const kitDock = useKitFlowDock()
  // The photos show once the first screenful has loaded (preloaded on the step before - see KitPhotoPreload).
  const { ready: gridReady, onTileLoad } = useGridReady(availableImages.length)

  const updatePendingPosition = (_: number, position: { x: number; y: number }) => {
    setPending(current => current ? { ...current, ...position } : current)
  }

  return (
    <div className={bare ? 'px-4 pb-6 sm:px-8 sm:pb-8' : 'bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 transition-colors animate-fadeIn'}>
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${bare ? `${kitDock ? 'max-sm:hidden ' : ''}sticky top-0 z-20 -mx-4 mb-5 border-b border-gray-200/60 bg-[#FAFAF7] px-4 py-3 sm:-mx-8 sm:px-8 dark:border-gray-800 dark:bg-[#151517]` : 'mb-6'}`}>
        <div>
          {!bare && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Cover Image for Sign-in Sheet</h2>}
          <p className={`text-sm ${bare ? 'font-bold text-gray-700 dark:text-gray-200' : 'mt-1 text-gray-600 dark:text-gray-400'}`}>{bare ? (pending ? 'Drag the photo on the right to frame it, then continue.' : 'Pick the photo for the top of your Sign-In Sheet.') : <>{address}{pending ? ' · Drag the preview photo to adjust the crop.' : ' · Choose a photo below to preview the Sign-In Sheet.'}</>}</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0">
          <button onClick={onBack} className={`${kitDock ? 'max-sm:hidden ' : ''}flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors duration-200 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:flex-none`}><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back</button>
          <button
            onClick={() => pending && onImageSelect({ url: pending.url, width: 400, height: 300, x: pending.x, y: pending.y })}
            disabled={!pending}
            className={`${kitDock ? 'max-sm:hidden ' : ''}flex flex-1 items-center justify-center rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all duration-300 hover:bg-[#8b7355] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:flex-none`}
          >
            Continue
          </button>
        </div>
      </div>
      {kitDock && (
        <PhoneFramer label="Sign-In Sheet photo" hint={pending ? 'Drag to frame it' : 'Tap a photo below'}>
          <DraggablePreviewPhoto photo={pending} slotIndex={0} aspectRatio="612 / 330" onPhotoPositionChange={updatePendingPosition} />
        </PhoneFramer>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`relative grid auto-rows-min grid-cols-3 items-start gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-3 ${bare ? '' : 'max-h-[560px] overflow-y-auto pr-1'}`}>
          {!gridReady && <div className="pointer-events-none absolute inset-x-0 top-10 z-[2] flex justify-center"><OhpSpinner size={34} label="Loading photos" /></div>}
          {availableImages.map((imageUrl: string, index: number) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }} animate={gridReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }} transition={{ duration: 0.35, delay: Math.min(index, 11) * 0.03 }}
              className={`relative aspect-square bg-gray-100 dark:bg-[#0B0B0B] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 group ${pending?.url === imageUrl ? 'shadow-[0_14px_30px_-14px_rgba(139,115,85,.9)]' : 'hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'}`}
              onClick={() => setPending({ url: imageUrl, x: 50, y: 50 })}
            >
              <Image src={imageUrl} alt={`Property view ${index + 1}`} fill sizes={KIT_PHOTO_SIZES} quality={88} className="object-cover" onLoad={onTileLoad} onError={onTileLoad} />
              {pending?.url === imageUrl && <span aria-hidden className="pointer-events-none absolute inset-0 z-[1] rounded-xl ring-[3px] ring-inset ring-[#C9A24D]" />}
              <div className={`absolute inset-0 transition-colors duration-200 flex items-center justify-center ${pending?.url === imageUrl ? 'bg-black/10' : 'bg-black/0 group-hover:bg-black/10'}`}>
                <div className={`rounded-full p-2 transition-all duration-300 ${pending?.url === imageUrl ? 'scale-100 bg-[#C9A24D] text-[#111827] opacity-100' : 'scale-75 bg-white/90 text-[#8b7355] opacity-0 group-hover:scale-100 group-hover:opacity-100 dark:bg-[#151517]/90 dark:text-[#C9A24D]'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className={kitDock ? 'max-sm:hidden' : ''}>
          <SignInSheetLivePreview propertyData={propertyData} address={address} pending={pending} onPhotoPositionChange={updatePendingPosition} />
        </div>
      </div>
      {/* Phones, inside the kit window: the flow bar - same onBack / Continue as the buttons above. */}
      {kitDock && (
        <FlowDock step={kitDock.step} total={kitDock.total} onBack={kitDock.step > 1 ? onBack : undefined}
          onContinue={() => { if (pending) onImageSelect({ url: pending.url, width: 400, height: 300, x: pending.x, y: pending.y }) }}
          disabled={!pending} />
      )}
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
    <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-gray-200 bg-[#f3f4f6] p-4 shadow-inner dark:border-gray-800 dark:bg-[#0B0B0B]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Live Sign-In Sheet Preview</p>
        {pending && <p className="text-[10px] font-bold text-[#8b7355] dark:text-[#C9A24D]">Drag Photo</p>}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
        {/* 612/330 matches the real flyer's LETTER-page hero (FLYER_HERO_H in lib/pdfs.tsx) so this crop preview isn't misleadingly short */}
        <DraggablePreviewPhoto photo={pending} slotIndex={0} aspectRatio="612 / 330" onPhotoPositionChange={onPhotoPositionChange} />
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

export const CheatSheetPhotoSelectionView = memo(function CheatSheetPhotoSelectionView({ propertyData, address, currentUser, initialSelected, onNext, onBack, recapOn = true, bare = false }: any) {
  // The Cheat Sheet's AI Recap (a short "Highlights of..." paragraph) is the AI this step leads to -
  // show roughly what it uses before the agent continues.
  const descLength = String(propertyData?.PublicRemarks || propertyData?.description || '').trim().length
  const [recapPct, setRecapPct] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    if (!recapOn || !descLength) return
    let alive = true
    api.ai.copywriteEstimate('cheat_sheet_highlights', descLength).then(r => { if (alive && r.success && r.data) setRecapPct(r.data.percent) })
    return () => { alive = false }
  }, [recapOn, descLength])
  const continueCost = !recapOn || !descLength
    ? 'Continue uses no AI'
    : recapPct === undefined ? 'Checking AI cost...'
      : recapPct === null ? 'Continue: AI Recap - under a cent'
        : recapPct < 1 ? `Continue: AI Recap - under 1% of your monthly AI`
          : `Continue: AI Recap - about ${Math.round(recapPct)}% of your monthly AI`
  const availableImages: string[] = (propertyData?.photos && propertyData.photos.length > 0 ? propertyData.photos : [propertyData?.ListPictureURL]).filter(isRealPhotoUrl)
  const [selected, setSelected] = useState<any[]>(initialSelected && initialSelected.length > 0 ? initialSelected.map(normalizeCheatSheetPhoto) : availableImages.slice(0, 1).map(normalizeCheatSheetPhoto))
  const kitDock = useKitFlowDock()
  const { ready: gridReady, onTileLoad } = useGridReady(availableImages.length)
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
    <div className={bare ? 'px-4 pb-6 sm:px-8 sm:pb-8' : 'bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 transition-colors animate-fadeIn'}>
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${bare ? `${kitDock ? 'max-sm:static max-sm:mb-0 max-sm:border-b-0 max-sm:pb-1 ' : ''}sticky top-0 z-20 -mx-4 mb-5 border-b border-gray-200/60 bg-[#FAFAF7] px-4 py-3 sm:-mx-8 sm:px-8 dark:border-gray-800 dark:bg-[#151517]` : 'mb-6'}`}>
        <div>
          {!bare && <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Photos for the Open House Cheat Sheet</h2>}
          <p className={`text-sm ${bare ? 'font-bold text-gray-700 dark:text-gray-200' : 'mt-1 text-gray-600 dark:text-gray-400'}`}>{bare ? <>Pick up to {MAX_CHEAT_SHEET_PHOTOS} photos in the order they should print - drag each one <span className={kitDock ? 'max-sm:hidden' : ''}>on the right</span>{kitDock && <span className="sm:hidden">in the little page on the right</span>} to frame it.</> : <>{address} &middot; Choose up to {MAX_CHEAT_SHEET_PHOTOS} photos, in the order you'd like them to appear.</>}</p>
        </div>
        <div className={`${kitDock ? 'max-sm:hidden ' : ''}flex w-full flex-col gap-2 sm:w-auto sm:shrink-0`}>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <MonthlyAiUsageMeter variant="inline" compact className="w-full sm:w-auto" />
            <button onClick={onBack} className={`${kitDock ? 'max-sm:hidden ' : ''}flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors duration-200 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 sm:flex-none`}><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back</button>
            <button onClick={() => onNext(selected)} disabled={selected.length === 0} className={`${kitDock ? 'max-sm:hidden ' : ''}flex flex-1 items-center justify-center rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all duration-300 hover:bg-[#8b7355] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D] sm:flex-none`}>Continue</button>
          </div>
          <p className="text-center text-xs font-bold text-gray-500 dark:text-gray-400 sm:text-right">
            <span className="uppercase tracking-widest">{selected.length} of {MAX_CHEAT_SHEET_PHOTOS} selected</span>
            <span className="mx-1.5 text-gray-300">·</span>
            <span className="text-[#8b7355] dark:text-[#d7b974]">{continueCost}</span>
          </p>
        </div>
      </div>
      {/* Phones: AI usage + picks on the left, the first page as paper on the right (drag a photo
          right there to frame it), pinned while the photos scroll under it (owner, 10/24). */}
      {kitDock && (
        <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-gray-200/70 bg-[#FAFAF7] px-4 pb-3 pt-2.5 shadow-[0_16px_24px_-24px_rgba(17,24,39,.7)] dark:border-gray-800 dark:bg-[#151517] sm:hidden">
          <div className="flex items-stretch gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="rounded-2xl border border-[#C9A24D]/25 bg-gradient-to-br from-[#fffaf0] to-white p-2.5 shadow-[0_12px_26px_-22px_rgba(139,106,43,.9)] dark:from-[#1d1912] dark:to-[#141416]">
                <MonthlyAiUsageMeter variant="inline" compact stretch className="!border-0 !bg-transparent !px-0 !py-0" />
                <div className="mt-2 flex items-start gap-1.5 border-t border-[#C9A24D]/15 pt-2">
                  <Sparkles className="mt-[1px] h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />
                  <p className="text-[11.5px] font-bold leading-snug text-[#8b7355] dark:text-[#d7b974]">{continueCost}</p>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-[#0B0B0B]">
                <motion.span key={selected.length} initial={{ scale: 1.4, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="font-serif text-[1.7rem] font-black leading-none text-[#111827] dark:text-white">{selected.length}<span className="text-[15px] text-gray-400">/{MAX_CHEAT_SHEET_PHOTOS}</span></motion.span>
                <p className="text-[10px] font-black uppercase leading-tight tracking-[0.14em] text-gray-500 dark:text-gray-400">Photos<br />picked</p>
              </div>
            </div>
            <div className="w-[128px] shrink-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={selected.length ? 'drag' : 'tap'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
                  className="mb-1.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-[#8b7355] dark:text-[#e8c97a]">
                  {selected.length ? '↕ Drag to frame' : 'Tap photos below'}
                </motion.p>
              </AnimatePresence>
              <CheatSheetMiniPaper agent={agentData} selectedPhotos={selected} onPhotoPositionChange={updatePhotoPosition} />
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`relative grid auto-rows-min grid-cols-3 items-start gap-2 sm:gap-4 md:grid-cols-4 lg:grid-cols-3 ${bare ? '' : 'max-h-[560px] overflow-y-auto pr-1'}`}>
          {!gridReady && <div className="pointer-events-none absolute inset-x-0 top-10 z-[2] flex justify-center"><OhpSpinner size={34} label="Loading photos" /></div>}
          {availableImages.map((imageUrl: string, index: number) => {
            const selectedIndex = selected.findIndex(photo => photo.url === imageUrl)
            const isSelected = selectedIndex !== -1
            const full = !isSelected && selected.length >= MAX_CHEAT_SHEET_PHOTOS
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }} animate={gridReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }} transition={{ duration: 0.35, delay: Math.min(index, 11) * 0.03 }}
                className={`relative aspect-square bg-gray-100 dark:bg-[#0B0B0B] rounded-xl overflow-hidden transition-all duration-300 group ${full ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${isSelected ? 'shadow-[0_14px_30px_-14px_rgba(139,115,85,.9)]' : full ? '' : 'hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600'}`}
                onClick={() => toggleImage(imageUrl)}
                title={full ? `Up to ${MAX_CHEAT_SHEET_PHOTOS} photos - tap a picked one to swap it out` : undefined}
              >
                <Image src={imageUrl} alt={`Property view ${index + 1}`} fill sizes={KIT_PHOTO_SIZES} quality={88} className="object-cover" onLoad={onTileLoad} onError={onTileLoad} />
                <div className={`absolute inset-0 transition-colors duration-200 ${isSelected ? 'bg-black/10' : 'bg-black/0 group-hover:bg-black/10'}`} />
                {/* the picked border sits INSIDE the tile, so it can never be cut off at the screen edge */}
                {isSelected && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl ring-[3px] ring-inset ring-[#C9A24D]" />}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div key={selectedIndex} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                      className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#C9A24D] text-xs font-black text-[#111827] shadow-lg ring-2 ring-white">
                      {selectedIndex + 1}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
        <div className={kitDock ? 'max-sm:hidden' : ''}>
          <CheatSheetLivePreview propertyData={propertyData} address={address} agent={agentData} selectedPhotos={selected} onPhotoPositionChange={updatePhotoPosition} />
        </div>
      </div>
      {/* Phones, inside the kit window: the flow bar - same onBack / onNext(selected) as above. */}
      {kitDock && (
        <FlowDock step={kitDock.step} total={kitDock.total} onBack={kitDock.step > 1 ? onBack : undefined}
          onContinue={() => onNext(selected)} disabled={selected.length === 0}
          note={`${selected.length} of ${MAX_CHEAT_SHEET_PHOTOS} picked`} />
      )}
    </div>
  )
})

const CheatSheetLivePreview = memo(function CheatSheetLivePreview({ address, agent, selectedPhotos, onPhotoPositionChange }: any) {
  const hubQr = useQrDataUrl(agent?.hubUrl, { size: 160 })
  const brokerage = agent?.brokerage || 'Brokerage'
  const agentName = agent?.name || 'Agent Name'
  const title = agent?.title || 'Real Estate Professional'
  const phone = agent?.phone
  const email = agent?.email
  const agentPhoto = agent?.photoUrl

  const initials = agentName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()

  return (
    <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-gray-200 bg-[#f3f4f6] p-4 shadow-inner dark:border-gray-800 dark:bg-[#0B0B0B]">
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
            {agentPhoto ? <Image src={resolveMediaUrl(agentPhoto)} alt={agentName} fill sizes="48px" className="object-cover" unoptimized /> : <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#8b7355] dark:text-[#C9A24D]">{initials}</div>}
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
          {agent?.hubUrl && hubQr && (
            <div className="hidden h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[#C9A24D]/40 bg-white p-1 sm:block dark:bg-[#0B0B0B]">
              <div className="relative h-full w-full">
                <Image
                  src={hubQr}
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

// Phones: the Cheat Sheet's first page as a little sheet of paper (8.5 x 11) - brokerage line, the
// three photos as they'll print (drag one to frame it) and the agent strip.
function CheatSheetMiniPaper({ agent, selectedPhotos, onPhotoPositionChange }: { agent: any; selectedPhotos: any[]; onPhotoPositionChange: (slot: number, pos: { x: number; y: number }) => void }) {
  const agentName = agent?.name || 'Agent Name'
  const agentPhoto = agent?.photoUrl
  return (
    <div className="aspect-[8.5/11] w-full overflow-hidden rounded-[6px] bg-white p-[7px] shadow-[0_14px_28px_-14px_rgba(17,24,39,.55)] ring-1 ring-black/10">
      <p className="truncate text-center font-serif text-[6.5px] font-black uppercase tracking-[0.22em] text-gray-900">{agent?.brokerage || 'Brokerage'}</p>
      <div className="mx-auto mb-[5px] mt-[3px] h-[1.5px] w-5 rounded-full bg-[#C9A24D]" />
      <DraggablePreviewPhoto photo={selectedPhotos[0]} slotIndex={0} heightClass="h-[50px] !rounded-[3px]" onPhotoPositionChange={onPhotoPositionChange} />
      <div className="mt-[4px] grid grid-cols-2 gap-[4px]">
        <DraggablePreviewPhoto photo={selectedPhotos[1]} slotIndex={1} heightClass="h-[30px] !rounded-[3px]" onPhotoPositionChange={onPhotoPositionChange} />
        <DraggablePreviewPhoto photo={selectedPhotos[2]} slotIndex={2} heightClass="h-[30px] !rounded-[3px]" onPhotoPositionChange={onPhotoPositionChange} />
      </div>
      <div className="mt-[6px] space-y-[3px]" aria-hidden>
        {[92, 70].map(w => <div key={w} className="h-[2.5px] rounded-full bg-gray-200" style={{ width: `${w}%` }} />)}
      </div>
      <div className="mt-[6px] flex items-center gap-[5px] rounded-[4px] border border-gray-200 bg-[#faf9f7] p-[4px]">
        <span className="relative h-[15px] w-[15px] shrink-0 overflow-hidden rounded-full bg-[#C9A24D]/30">
          {agentPhoto && <Image src={resolveMediaUrl(agentPhoto)} alt="" fill sizes="16px" className="object-cover" unoptimized />}
        </span>
        <span className="min-w-0 truncate font-serif text-[6.5px] font-black text-gray-900">{agentName}</span>
      </div>
    </div>
  )
}

// Phones, in the kit window: a slim viewfinder pinned to the top of the photo steps - the picked
// photo(s) exactly as they'll print, dragged right there to frame - so a photo picked far down the
// grid never means scrolling back up to a preview at the bottom (owner, 10/22).
function PhoneFramer({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-gray-200/70 bg-[#FAFAF7] px-4 pb-3 pt-2.5 shadow-[0_16px_24px_-24px_rgba(17,24,39,.7)] dark:border-gray-800 dark:bg-[#151517] sm:hidden">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">{label}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={hint} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}
            className="text-[11px] font-bold text-gray-400">{hint}</motion.p>
        </AnimatePresence>
      </div>
      {children}
    </div>
  )
}

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

// Discovery / Manager tiles either side of the Opens address search - squares with a slow gold
// halo, a floating icon and a sheen on hover. The red badge counts what needs attention.
function OpensToolBlock({ href, icon, title, blurb, count, className = '', delay = 0 }: {
  href: string
  icon: React.ReactNode
  title: string
  blurb: string
  count: number
  className?: string
  delay?: number
}) {
  return (
    <Link
      href={href}
      className={`ohp-otb group relative isolate flex min-h-[108px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-3xl border border-[#C9A24D]/30 bg-gradient-to-b from-white/95 to-[#fbf3df]/90 px-3 py-3 text-center shadow-[0_18px_40px_-28px_rgba(139,115,85,.8)] transition-all duration-300 hover:-translate-y-1 hover:border-[#C9A24D] hover:shadow-[0_26px_50px_-24px_rgba(201,162,77,.75)] dark:border-white/10 dark:from-white/[0.07] dark:to-[#C9A24D]/[0.08] dark:hover:border-[#e8c97a]/60 ${className}`}
      style={{ '--otb-d': `${delay}s` } as React.CSSProperties}
    >
      <style>{`.ohp-otb .otb-halo{animation:otbSpin 9s linear infinite;animation-delay:calc(var(--otb-d) * -1)}.ohp-otb .otb-icon{animation:otbFloat 4.2s ease-in-out infinite;animation-delay:var(--otb-d)}@keyframes otbSpin{to{transform:rotate(360deg)}}@keyframes otbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@media (prefers-reduced-motion:reduce){.ohp-otb .otb-halo,.ohp-otb .otb-icon{animation:none}}`}</style>
      <span className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#C9A24D]/15 blur-2xl transition-opacity duration-500 group-hover:opacity-100 dark:bg-[#C9A24D]/20" />
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-1000 group-hover:translate-x-full dark:via-white/10" />
      {count > 0 && (
        <span className="absolute right-2.5 top-2.5 z-10 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white shadow-lg shadow-red-500/40 ring-2 ring-white dark:ring-[#0b0f0e]">
          {count > 9 ? '9+' : count}
        </span>
      )}
      <span className="relative grid h-12 w-12 place-items-center">
        <span className="otb-halo absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#C9A24D,#f1d58b,transparent_40%,#C9A24D_70%,#8b6a2b)] opacity-70 blur-[3px]" />
        <span className="otb-icon relative grid h-[44px] w-[44px] place-items-center rounded-[14px] bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-lg transition-transform duration-300 group-hover:scale-105">
          {icon}
        </span>
      </span>
      <span className="relative">
        <span className="flex items-center justify-center gap-1 font-serif text-[15px] font-black leading-tight text-[#111827] dark:text-white">{title}<ArrowRight size={13} strokeWidth={2.5} className="-mr-4 w-0 shrink-0 text-[#C9A24D] opacity-0 transition-all duration-300 group-hover:mr-0 group-hover:w-[13px] group-hover:opacity-100" /></span>
        <span className="mt-0.5 block text-[10.5px] font-semibold leading-snug text-gray-500 dark:text-white/55">{blurb}</span>
      </span>
    </Link>
  )
}
