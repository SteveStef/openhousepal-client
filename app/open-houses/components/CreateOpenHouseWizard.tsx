'use client'

import React, { useState, memo, useCallback, useRef } from 'react'
import Image from 'next/image'
import { v4 as uuidv4 } from 'uuid'
import { PropertyRecommendationCard } from '@/components/PropertyRecommendationCard'
import api from '@/lib/api-service'
import { 
  OpenHouse, 
  PropertyImage, 
  SearchPreferences, 
  OpenHouseWizardStep,
  User
} from '@/types'
import { Bed, Bath, BoxSelect, DollarSign, Layout, QrCode, Sparkles, MapPin } from 'lucide-react'

interface CreateOpenHouseWizardProps {
  currentUser: User | null;
  onSuccess: () => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
  triggerPreview: (type: 'flyer' | 'recommendations', id?: string, customData?: any) => void;
  formatAddress: (address: string) => string;
}

export function CreateOpenHouseWizard({
  currentUser,
  onSuccess,
  showToast,
  triggerPreview,
  formatAddress
}: CreateOpenHouseWizardProps) {
  // Wizard State
  const [currentStep, setCurrentStep] = useState<OpenHouseWizardStep>('ADDRESS')
  
  // Data State
  const [address, setAddress] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<{ address: string, lat: number, lng: number }[]>([])
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
  const [selectedFeatures, setSelectedFeatures] = useState({
    signinSheet: true,
    similarProperties: false
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

  // --- HANDLERS ---

  const handleTriggerPreview = (mode: 'flyer' | 'recommendations') => {
    if (mode === 'flyer') {
      const flyerData = {
        address: formatStreetAndCity(address, propertyData?.city || propertyData?.City),
        price: propertyData?.ListPrice || 0,
        beds: propertyData?.BedroomsTotal || 0,
        baths: propertyData?.BathroomsTotal || 0,
        sqft: propertyData?.LivingArea || propertyData?.livingArea || 0,
        coverImage: selectedImage?.url,
        openHouseUrl: `${window.location.origin}/open-house/${generatedOpenHouseId}`
      };
      triggerPreview('flyer', undefined, flyerData);
    } else {
      const currentSimilarProps = similarProperties.filter(p => {
        const pId = String(p.ListingKey || p.listingKey || p.id);
        return selectedSimilarPropertyIds.map(sid => String(sid)).includes(pId);
      });
      
      triggerPreview('recommendations', undefined, {
        address: formatStreetAndCity(address, propertyData?.city || propertyData?.City),
        properties: currentSimilarProps
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
      const { success, data } = await api.properties.address(query)
      if (success && data?.results) {
        setAddressSuggestions(data.results)
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
        setCurrentStep('FEATURES')
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
      payload.radius = preferences.radius
    }

    if (coordinates) {
      payload.lat = coordinates.lat
      payload.lng = coordinates.lng
    }

    const { success, data: responseData } = await api.properties.findSimilar(payload)

    if (success && responseData?.properties) {
      setSimilarProperties(responseData.properties)
      
      if (autoSelect) {
        const topIds = responseData.properties.slice(0, 12).map((p: any) => p.listingKey || p.id)
        setSelectedSimilarPropertyIds(topIds)
      }
      setIsLoadingNeighbors(false)
      return responseData.properties
    }
    
    setIsLoadingNeighbors(false)
    return []
  }

  const handleFeatureSelectionComplete = (features: { signinSheet: boolean; similarProperties: boolean }) => {
    setSelectedFeatures(features)
    if (features.similarProperties) {
      const price = propertyData?.ListPrice || 0
      const beds = propertyData?.BedroomsTotal || 0
      const baths = propertyData?.BathroomsTotal || 0
      
      const initialPrefs = {
        minPrice: Math.max(0, Math.floor(price * 0.8 / 10000) * 10000),
        maxPrice: Math.ceil(price * 1.2 / 10000) * 10000,
        minBeds: Math.max(0, beds - 1),
        minBaths: Math.max(0, baths - 1),
        radius: 5
      }
      setSearchPreferences(initialPrefs)
      setCurrentStep('PREFERENCES')
    } else {
      setCurrentStep('COVER_IMAGE')
    }
  }

  const handleSimilarPropertiesComplete = (selectedIds: (string | number)[]) => {
    setSelectedSimilarPropertyIds(selectedIds)
    setCurrentStep('COVER_IMAGE')
  }

  const handleImageSelect = (image: PropertyImage) => {
    setSelectedImage(image)
    
    const newEventId = uuidv4()
    setGeneratedOpenHouseId(newEventId)
    
    const baseUrl = window.location.origin
    const formUrl = `${baseUrl}/open-house/${newEventId}`
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formUrl)}&bgcolor=ffffff&color=1a1a1a`
    setQrCode(qrCodeUrl)
    
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

    const { success, error } = await api.openHouses.create({
      address: address,
      property_data: propertyData,
      coverImageUrl: selectedImage.url,
      openHouseEventId: generatedOpenHouseId,
      similarPropertiesSnapshot: selectedSnapshot
    })

    if (success) {
      await onSuccess()
      
      // Reset local state
      setAddress('')
      setPropertyData(null)
      setSelectedImage(null)
      setQrCode('')
      setGeneratedOpenHouseId('')
      setSelectedFeatures({ signinSheet: true, similarProperties: false })
      setSelectedSimilarPropertyIds([])
      setCurrentStep('ADDRESS')
      
      showToast('🎉 Open House created successfully!', 'success')
    } else {
      console.error('Error saving open house:', error)
      showToast(error || 'Failed to save open house. Please try again.', 'error')
    }
  }

  return (
    <div className="w-full">
      {currentStep === 'ADDRESS' ? (
        <div className="space-y-6 sm:space-y-8 w-full">
          <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200/60 dark:border-gray-800 p-5 sm:p-8 text-center relative transition-colors w-full">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl sm:rounded-3xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A24D]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#111827]/5 dark:bg-white/5 rounded-full blur-3xl -ml-32 -mb-32"></div>
            </div>

            <div className="relative z-10 max-w-3xl mx-auto w-full">
              <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-[#8b7355] to-gray-900 dark:from-white dark:via-[#C9A24D] dark:to-gray-200 tracking-tight mb-2 sm:mb-4 leading-tight py-1">
                Create Your Open House Kit
              </h1>
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 font-light">
                Enter a property address to instantly generate a QR code, professional PDF flyer, and sign-in form.
              </p>

              <form onSubmit={generateQRCode} className="relative max-w-2xl mx-auto w-full">
                <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full">
                  <div className="relative flex-1 group w-full">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#C9A24D] transition-colors">
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
                      className="block w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#0B0B0B] border-2 border-gray-100 dark:border-gray-800 focus:border-[#C9A24D] rounded-2xl text-base font-medium text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:shadow-[0_0_20px_rgba(201,162,77,0.1)] focus:outline-none transition-all duration-300"
                    />

                    {/* Internal Address Suggestions Dropdown */}
                    {showAddressSuggestions && addressSuggestions.length > 0 && (
                      <div 
                        ref={suggestionsRef}
                        className="absolute z-[100] w-full mt-1 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto animate-fadeIn"
                      >
                        {addressSuggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setAddress(suggestion.address)
                              setCoordinates({ lat: suggestion.lat, lng: suggestion.lng })
                              setShowAddressSuggestions(false)
                            }}
                            className="px-4 py-3 cursor-pointer text-sm transition-colors hover:bg-[#8b7355]/10 dark:hover:bg-[#C9A24D]/10 text-gray-700 dark:text-gray-300 hover:text-[#8b7355] dark:hover:text-[#C9A24D] border-b border-gray-50 dark:border-gray-800 last:border-0"
                          >
                            <div className="font-bold">
                              {suggestion.address.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isGenerating || isLoadingProperty}
                    className="px-8 py-4 sm:py-0 bg-white dark:bg-[#1A1A1C] text-[#111827] dark:text-white border-2 border-gray-100 dark:border-[#C9A24D]/20 hover:border-[#C9A24D] rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-[0_0_20px_rgba(201,162,77,0.1)] flex items-center justify-center whitespace-nowrap min-w-[160px] group/btn"
                  >
                    {isGenerating || isLoadingProperty ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <div className="flex items-center">
                        <span>Generate Kit</span>
                        <Sparkles size={14} className="ml-2 text-[#C9A24D] group-hover/btn:scale-120 transition-transform" />
                      </div>
                    )}
                  </button>
                </div>
                
                {/* Kit Components Preview */}
                <div className="mt-6 flex items-center justify-center space-x-6 sm:space-x-10">
                  <div className="flex items-center space-x-2.5 group cursor-default">
                    <div className="p-2 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-lg text-gray-400 group-hover:text-[#C9A24D] group-hover:border-[#C9A24D]/30 transition-all">
                      <Layout size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">PDF Flyer</span>
                  </div>
                  <div className="flex items-center space-x-2.5 group cursor-default">
                    <div className="p-2 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-lg text-gray-400 group-hover:text-[#C9A24D] group-hover:border-[#C9A24D]/30 transition-all">
                      <QrCode size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">Digital Sign-in</span>
                  </div>
                  <div className="flex items-center space-x-2.5 group cursor-default">
                    <div className="p-2 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-lg text-gray-400 group-hover:text-[#C9A24D] group-hover:border-[#C9A24D]/30 transition-all">
                      <Sparkles size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">Active COMPS</span>
                  </div>
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
          </div>
        </div>
      ) : currentStep === 'FEATURES' ? (
        <FeatureSelectionView
          address={address}
          onNext={handleFeatureSelectionComplete}
          onBack={() => {
            setCurrentStep('ADDRESS')
            setAddress('')
            setPropertyData(null)
            setCoordinates(null)
          }}
        />
      ) : currentStep === 'PREFERENCES' ? (
        <SimilarPropertiesPreferencesView
          preferences={searchPreferences}
          address={address}
          onFindProperties={async (prefs) => {
            setSearchPreferences(prefs)
            const properties = await fetchSimilarProperties(propertyData, false, prefs)
            if (properties && properties.length > 0) {
              setCurrentStep('SIMILAR_PROPS')
            } else {
              showToast('No properties found with these filters. Please try broadening your search.', 'error')
            }
          }}
          onBack={() => setCurrentStep('FEATURES')}
        />
      ) : currentStep === 'SIMILAR_PROPS' ? (
        <SimilarPropertiesSelectionView
          properties={similarProperties}
          isLoading={isLoadingNeighbors}
          initialSelectedIds={selectedSimilarPropertyIds}
          onNext={handleSimilarPropertiesComplete}
          onBack={() => setCurrentStep('PREFERENCES')}
        />
      ) : currentStep === 'COVER_IMAGE' ? (
         <ImageSelectionView
          propertyData={propertyData}
          address={address}
          onImageSelect={handleImageSelect}
          onBack={() => {
            if (selectedFeatures.similarProperties) {
              setCurrentStep('SIMILAR_PROPS')
            } else {
              setCurrentStep('FEATURES')
            }
          }}
        />
      ) : null}

      {/* Review Step Dialog */}
      {currentStep === 'REVIEW' && (
        <SaveOpenHouseDialog
          address={address}
          selectedImage={selectedImage}
          qrCode={qrCode}
          onSave={saveOpenHouse}
          onCancel={() => setCurrentStep('COVER_IMAGE')}
          onPreviewFlyer={() => handleTriggerPreview('flyer')}
          onPreviewRecommendations={() => handleTriggerPreview('recommendations')}
          hasRecommendations={selectedFeatures.similarProperties}
          formatAddress={formatAddress}
        />
      )}
    </div>
  )
}

// --- SUB-COMPONENTS (Wizard Views) ---

const FeatureSelectionView = memo(function FeatureSelectionView({ address, onNext, onBack }: { address: string, onNext: (features: any) => void, onBack: () => void }) {
  const [features, setFeatures] = useState({ signinSheet: true, similarProperties: false })

  const toggleFeature = (key: 'similarProperties') => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-5 sm:p-12 transition-colors max-w-4xl mx-auto animate-fadeIn">
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white mb-3 sm:mb-4 tracking-tight">What materials do you need?</h2>
        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-light">For <span className="font-medium text-gray-900 dark:text-white truncate block sm:inline">{address}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
        <div className="rounded-2xl p-6 sm:p-8 border-2 border-[#8b7355] bg-[#faf9f7] dark:bg-[#1c1c1e] shadow-md flex flex-col items-center text-center gap-4 sm:gap-6 relative overflow-hidden">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center bg-[#8b7355] text-white shadow-lg shadow-[#8b7355]/30">
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
          </div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
              <h3 className="text-lg sm:text-xl font-bold text-[#8b7355] dark:text-[#C9A24D]">Sign-in Sheet</h3>
              <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">Required</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Professional flyer with unique QR code for visitor registration.</p>
          </div>
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-[#8b7355] bg-[#8b7355] text-white flex items-center justify-center">
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
        </div>

        <div
          onClick={() => toggleFeature('similarProperties')}
          className={`cursor-pointer rounded-2xl p-6 sm:p-8 border-2 transition-all duration-300 flex flex-col items-center text-center gap-4 sm:gap-6 group relative overflow-hidden ${
            features.similarProperties 
              ? 'border-[#8b7355] bg-[#faf9f7] dark:bg-[#1c1c1e] shadow-lg scale-[1.02]' 
              : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-[#151517]'
          }`}
        >
          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-colors duration-300 ${
            features.similarProperties 
              ? 'bg-[#8b7355] text-white shadow-lg shadow-[#8b7355]/30' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
          }`}>
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" /></svg>
          </div>
          <div>
            <h3 className={`text-lg sm:text-xl font-bold mb-1 sm:mb-2 ${features.similarProperties ? 'text-[#8b7355] dark:text-[#C9A24D]' : 'text-gray-900 dark:text-white'}`}>Similar Listings</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Supplemental flyer showcasing active similar listings nearby.</p>
          </div>
          <div className={`absolute top-3 right-3 sm:top-4 sm:right-4 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
            features.similarProperties 
              ? 'border-[#8b7355] bg-[#8b7355] text-white' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            {features.similarProperties && <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3">
        <button onClick={onBack} className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm">Back</button>
        <button onClick={() => onNext(features)} className="w-full sm:w-auto px-8 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transform hover:-translate-y-0.5 transition-all duration-300 active:scale-95 text-sm">Continue</button>
      </div>
    </div>
  )
})

const SimilarPropertiesPreferencesView = memo(function SimilarPropertiesPreferencesView({ 
  preferences: initialPreferences, 
  address,
  onFindProperties, 
  onBack 
}: { 
  preferences: SearchPreferences, 
  address: string,
  onFindProperties: (prefs: SearchPreferences) => void, 
  onBack: () => void 
}) {
  const [prefs, setPrefs] = useState<SearchPreferences>(initialPreferences)
  const formatPriceForDisplay = (val: number) => val === 0 ? "" : val.toLocaleString()
  const parsePriceFromDisplay = (val: string) => Number(val.replace(/\D/g, ""))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === "minPrice" || name === "maxPrice") {
      setPrefs(prev => ({ ...prev, [name]: parsePriceFromDisplay(value) }))
    } else {
      setPrefs(prev => ({ ...prev, [name]: Number(value) }))
    }
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-5 sm:p-12 transition-colors max-w-4xl mx-auto animate-fadeIn">
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white mb-3 sm:mb-4 tracking-tight">Refine Your Search</h2>
        <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 font-light truncate px-4">Find properties similar to <span className="font-medium text-gray-900 dark:text-white">{address}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 sm:mb-12">
        <div className="space-y-4 bg-[#faf9f7] dark:bg-[#1c1c1e] p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-[#8b7355] dark:text-[#C9A24D] uppercase tracking-widest flex items-center"><DollarSign className="w-4 h-4 mr-2" /> Price Range</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Min Price</label>
              <input type="text" name="minPrice" value={formatPriceForDisplay(prefs.minPrice)} onChange={handleChange} className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Max Price</label>
              <input type="text" name="maxPrice" value={formatPriceForDisplay(prefs.maxPrice)} onChange={handleChange} className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all" placeholder="No Max" />
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-[#faf9f7] dark:bg-[#1c1c1e] p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-[#8b7355] dark:text-[#C9A24D] uppercase tracking-widest flex items-center"><BoxSelect className="w-4 h-4 mr-2" /> Property Details</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Min Beds</label>
              <select name="minBeds" value={prefs.minBeds} onChange={handleChange} className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all appearance-none">
                {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+ Beds</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Min Baths</label>
              <select name="minBaths" value={prefs.minBaths} onChange={handleChange} className="w-full px-4 py-3 bg-white dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C9A24D] transition-all appearance-none">
                {[0, 1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => <option key={n} value={n}>{n}+ Baths</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4 bg-[#faf9f7] dark:bg-[#1c1c1e] p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-[#8b7355] dark:text-[#C9A24D] uppercase tracking-widest flex items-center"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Search Radius</h3>
          <div className="flex items-center gap-6">
            <input type="range" name="radius" min="1" max="20" step="1" value={prefs.radius} onChange={handleChange} className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#C9A24D]" />
            <div className="bg-white dark:bg-[#0B0B0B] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 min-w-[100px] text-center"><span className="text-lg font-black text-gray-900 dark:text-white">{prefs.radius}</span><span className="text-[10px] font-bold text-gray-500 uppercase ml-1">Miles</span></div>
          </div>
          <p className="text-[10px] text-gray-400 font-medium">Search area centered on the property coordinates captured from address entry.</p>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3">
        <button onClick={onBack} className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm">Back</button>
        <button onClick={() => onFindProperties(prefs)} className="w-full sm:w-auto px-10 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transform hover:-translate-y-0.5 transition-all duration-300 active:scale-95 text-sm uppercase tracking-widest">Find Properties</button>
      </div>
    </div>
  )
})

const SimilarPropertiesSelectionView = memo(function SimilarPropertiesSelectionView({ properties, isLoading, initialSelectedIds = [], onNext, onBack }: { properties: any[], isLoading: boolean, initialSelectedIds?: (string | number)[], onNext: (selectedIds: (string | number)[]) => void, onBack: () => void }) {
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>(initialSelectedIds)
  const toggleProperty = (id: string | number) => {
    const stringId = String(id);
    setSelectedIds(prev => {
      const stringPrev = prev.map(p => String(p));
      return stringPrev.includes(stringId) ? stringPrev.filter(pid => pid !== stringId) : [...stringPrev, stringId];
    });
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 sm:p-12 text-center transition-colors max-w-7xl mx-auto animate-fadeIn">
        <div className="py-12 sm:py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355] dark:border-[#C9A24D] mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Finding similar properties...</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Searching Bright MLS for active neighbor listings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl sm:rounded-3xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-4 sm:p-12 transition-colors max-w-7xl mx-auto animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
         <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-1 sm:mb-2 tracking-tight">Select similar properties</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Choose listings for your supplemental flyer.</p>
         </div>
         <div className="flex items-baseline sm:text-right">
           <span className="text-3xl sm:text-4xl font-black text-[#8b7355] dark:text-[#C9A24D]">{selectedIds.length}</span>
           <span className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-2">Selected</span>
         </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8 sm:mb-12 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
                {properties.map((property) => {
                  const propertyId = String(property.ListingKey || property.listingKey || property.id);
                  const isSelected = selectedIds.map(sid => String(sid)).includes(propertyId);
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
                        acres={property.LotSizeSquareFeet ? Number((property.LotSizeSquareFeet / 43560).toFixed(2)) : (property.acres || 0)}
                        yearBuilt={property.YearBuilt || property.yearBuilt || property.year_built}
                        dom={property.DaysOnMarket || property.daysOnMarket || property.dom}
                        hideQr={true}
                        isCompact={true}
                        selected={isSelected}
                      />
                    </div>
                  );
                })}
      </div>

      <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 border-t border-gray-100 dark:border-gray-800 pt-6 sm:pt-8">
        <button onClick={onBack} className="w-full sm:w-auto px-6 py-3.5 bg-white dark:bg-transparent text-gray-600 dark:text-gray-400 font-bold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 text-sm">Back</button>
        <button onClick={() => onNext(selectedIds)} disabled={selectedIds.length === 0} className="w-full sm:w-auto px-8 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-sm">Continue ({selectedIds.length})</button>
      </div>
    </div>
  )
})

const ImageSelectionView = memo(function ImageSelectionView({ propertyData, address, onImageSelect, onBack }: any) {
  const availableImages = propertyData?.photos && propertyData.photos.length > 0 ? propertyData.photos : [propertyData?.ListPictureURL].filter(Boolean)
  return (
    <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-xl border border-gray-200/60 dark:border-gray-800 p-6 transition-colors animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div><h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Cover Image for Sign-in Sheet</h2><p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{address}</p></div>
        <button onClick={onBack} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg transition-colors duration-200 flex items-center"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {availableImages.map((imageUrl: string, index: number) => (
          <div key={index} className="relative aspect-square bg-gray-100 dark:bg-[#0B0B0B] rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#8b7355] dark:hover:ring-[#C9A24D] transition-shadow duration-200 group" onClick={() => onImageSelect({ url: imageUrl, width: 400, height: 300 })}>
            <Image src={imageUrl} alt={`Property view ${index + 1}`} fill sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center"><div className="bg-white/90 dark:bg-[#151517]/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"><svg className="w-5 h-5 text-[#8b7355] dark:text-[#C9A24D]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div></div>
          </div>
        ))}
      </div>
    </div>
  )
})

const SaveOpenHouseDialog = memo(function SaveOpenHouseDialog({ address, selectedImage, qrCode, onSave, onCancel, onPreviewFlyer, onPreviewRecommendations, hasRecommendations, formatAddress }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50"><h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Review & Save</h3><p className="text-[#6B7280] dark:text-gray-400 text-sm mt-2 font-medium">{formatAddress(address)}</p></div>
        <div className="p-8">
          <div className="flex items-center space-x-5 mb-8">
            <div className="w-24 h-24 bg-white dark:bg-[#0B0B0B] rounded-2xl overflow-hidden relative shadow-inner border border-gray-100 dark:border-gray-800">{selectedImage && <Image src={selectedImage.url} alt="Selected cover" fill className="object-cover" />}</div>
            <div className="flex-1"><p className="text-base font-bold text-[#0B0B0B] dark:text-white">Kit Ready to Generate</p><p className="text-sm text-[#6B7280] dark:text-gray-400 mt-1 font-light leading-relaxed">Includes Sign-in Flyer {hasRecommendations && '& Active COMPS'}.</p></div>
          </div>
          <div className="bg-white/80 dark:bg-[#0B0B0B]/80 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-800 shadow-sm"><h4 className="text-sm font-bold text-[#C9A24D] uppercase tracking-wider mb-3">Your Kit Includes</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700"><div className="flex items-center"><span className="text-[#C9A24D] mr-3 font-bold">✓</span><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sign-in Flyer</span></div><button onClick={onPreviewFlyer} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">Preview PDF</button></div>
              {hasRecommendations && <div className="flex items-center justify-between p-3 bg-[#faf9f7] dark:bg-[#1a1a1c] rounded-lg border border-gray-100 dark:border-gray-700"><div className="flex items-center"><span className="text-[#C9A24D] mr-3 font-bold">✓</span><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active COMPS</span></div><button onClick={onPreviewRecommendations} className="text-xs font-bold text-[#111827] dark:text-white underline hover:text-[#8b7355] transition-colors">Preview PDF</button></div>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={onCancel} className="flex-1 px-6 py-3.5 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95">Back</button>
            <button onClick={onSave} className="flex-[2] px-6 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transform transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(17,24,39,0.2)] active:scale-95">Save & Finish</button>
          </div>
        </div>
      </div>
    </div>
  )
})
