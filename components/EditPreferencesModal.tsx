'use client'

import { useState, useEffect } from 'react'
import { Collection, CollectionPreferences } from '@/types'
import { collectionPreferencesApi } from '@/lib/api'
import { X } from 'lucide-react'
import MultiCityPlacesInput from './MultiCityPlacesInput'
import MultiTownshipPlacesInput from './MultiTownshipPlacesInput'
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete'

interface EditPreferencesModalProps {
  collection: Collection | null
  isOpen: boolean
  onClose: () => void
  onSave: (collectionId: string, preferences: CollectionPreferences) => void
}


export default function EditPreferencesModal({ 
  collection, 
  isOpen, 
  onClose, 
  onSave 
}: EditPreferencesModalProps) {
  const [formData, setFormData] = useState<CollectionPreferences>({
    min_beds: null,
    max_beds: null,
    min_baths: null,
    max_baths: null,
    min_price: null,
    max_price: null,
    min_year_built: null,
    max_year_built: null,
    lat: null,
    long: null,
    address: '',
    cities: [],
    townships: [],
    diameter: null,
    special_features: '',
    is_town_house: false,
    is_lot_land: false,
    is_condo: false,
    is_multi_family: false,
    is_single_family: false,
    is_apartment: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false)
  const [validationErrors, setValidationErrors] = useState({
    location: '',
    propertyTypes: ''
  })

  // Validation helper functions
  const validatePropertyTypes = () => {
    const hasPropertyType = formData.is_single_family || formData.is_condo || formData.is_town_house || 
                           formData.is_apartment || formData.is_multi_family || formData.is_lot_land
    return hasPropertyType
  }

  const validateLocationPreferences = () => {
    const hasAddress = formData.address && formData.address.trim()
    const hasAreaFilters = (formData.cities && formData.cities.length > 0) || 
                          (formData.townships && formData.townships.length > 0)
    
    // If address is provided, diameter must be provided
    if (hasAddress && !formData.diameter) {
      return { isValid: false, error: 'Search diameter is required when using address-based search' }
    }
    
    // Must have either address or area filters
    if (!hasAddress && !hasAreaFilters) {
      return { isValid: false, error: 'Please specify either an address with search diameter OR select cities/townships' }
    }
    
    return { isValid: true, error: '' }
  }

  const isUsingAddressSearch = () => {
    return !!(formData.address && formData.address.trim())
  }

  const isUsingAreaSearch = () => {
    return (formData.cities && formData.cities.length > 0) || 
           (formData.townships && formData.townships.length > 0)
  }

  // Helper to format number with commas
  const formatNumberWithCommas = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return ''
    const stringValue = value.toString().replace(/,/g, '')
    if (isNaN(Number(stringValue))) return stringValue
    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // Helper to remove commas for state/processing
  const stripCommas = (value: string) => {
    return value.replace(/,/g, '')
  }

  // Fetch and populate form when modal opens
  useEffect(() => {
    if (isOpen && collection) {
      const loadPreferences = async () => {
        setIsLoadingPreferences(true)
        try {
          // First try to use preferences from collection object if they're the detailed type
          if (collection.preferences && 'min_beds' in collection.preferences) {
            const prefs = collection.preferences as CollectionPreferences
            // Handle migration from single city to cities array
            let cities: string[] = []
            if (prefs.cities && Array.isArray(prefs.cities)) {
              cities = prefs.cities
            } else if (prefs.city) {
              cities = [prefs.city]
            }
            
            // Handle migration from single township to townships array
            let townships: string[] = []
            if (prefs.townships && Array.isArray(prefs.townships)) {
              townships = prefs.townships
            } else if (prefs.township) {
              townships = [prefs.township]
            }
            
            setFormData({
              min_beds: prefs.min_beds || null,
              max_beds: prefs.max_beds || null,
              min_baths: prefs.min_baths || null,
              max_baths: prefs.max_baths || null,
              min_price: prefs.min_price || null,
              max_price: prefs.max_price || null,
              min_year_built: prefs.min_year_built || null,
              max_year_built: prefs.max_year_built || null,
              lat: prefs.lat || null,
              long: prefs.long || null,
              address: prefs.address || '',
              city: prefs.city || null,
              cities: cities,
              township: prefs.township || null,
              townships: townships,
              diameter: prefs.diameter ? Math.round(prefs.diameter / 1.8 * 10) / 10 : null,
              special_features: prefs.special_features || '',
              is_town_house: prefs.is_town_house || false,
              is_lot_land: prefs.is_lot_land || false,
              is_condo: prefs.is_condo || false,
              is_multi_family: prefs.is_multi_family || false,
              is_single_family: prefs.is_single_family || false,
              is_apartment: prefs.is_apartment || false,
              visiting_reason: prefs.visiting_reason || null,
              has_agent: prefs.has_agent || null
            })
          } else {
            // Fetch preferences from API
            const response = await collectionPreferencesApi.get(collection.id)
            if (response.success && response.data) {
              const prefs = response.data
              // Handle migration from single city to cities array
              let cities: string[] = []
              if (prefs.cities && Array.isArray(prefs.cities)) {
                cities = prefs.cities
              } else if (prefs.city) {
                cities = [prefs.city]
              }
              
              // Handle migration from single township to townships array
              let townships: string[] = []
              if (prefs.townships && Array.isArray(prefs.townships)) {
                townships = prefs.townships
              } else if (prefs.township) {
                townships = [prefs.township]
              }
              
              setFormData({
                min_beds: prefs.min_beds || null,
                max_beds: prefs.max_beds || null,
                min_baths: prefs.min_baths || null,
                max_baths: prefs.max_baths || null,
                min_price: prefs.min_price || null,
                max_price: prefs.max_price || null,
                min_year_built: prefs.min_year_built || null,
                max_year_built: prefs.max_year_built || null,
                lat: prefs.lat || null,
                long: prefs.long || null,
                address: prefs.address || '',
                city: prefs.city || null,
                cities: cities,
                township: prefs.township || null,
                townships: townships,
                diameter: prefs.diameter ? Math.round(prefs.diameter / 1.8 * 10) / 10 : null,
                special_features: prefs.special_features || '',
                is_town_house: prefs.is_town_house || false,
                is_lot_land: prefs.is_lot_land || false,
                is_condo: prefs.is_condo || false,
                is_multi_family: prefs.is_multi_family || false,
                is_single_family: prefs.is_single_family || false,
                is_apartment: prefs.is_apartment || false,
                visiting_reason: prefs.visiting_reason || null,
                has_agent: prefs.has_agent || null
              })
            } else {
              // No preferences found, use defaults
              setFormData({
                min_beds: null,
                max_beds: null,
                min_baths: null,
                max_baths: null,
                min_price: null,
                max_price: null,
                min_year_built: null,
                max_year_built: null,
                lat: null,
                long: null,
                address: '',
                city: null,
                cities: [],
                township: null,
                townships: [],
                diameter: null,
                special_features: '',
                is_town_house: false,
                is_lot_land: false,
                is_condo: false,
                is_multi_family: false,
                is_single_family: false,
                is_apartment: false,
                visiting_reason: null,
                has_agent: null
              })
            }
          }
        } catch (error) {
          console.error('Error loading preferences:', error)
          // Use defaults on error
          setFormData({
            min_beds: null,
            max_beds: null,
            min_baths: null,
            max_baths: null,
            min_price: null,
            max_price: null,
            min_year_built: null,
            max_year_built: null,
            lat: null,
            long: null,
            address: '',
            city: null,
            cities: [],
            township: null,
            townships: [],
            diameter: null,
            special_features: '',
            is_town_house: false,
            is_lot_land: false,
            is_condo: false,
            is_multi_family: false,
            is_single_family: false,
            is_apartment: false,
            visiting_reason: null,
            has_agent: null
          })
        } finally {
          setIsLoadingPreferences(false)
        }
      }

      loadPreferences()
    }
  }, [isOpen, collection])

  const handleInputChange = (field: keyof CollectionPreferences, value: string | number | boolean | null | string[]) => {
    // Use functional state update to avoid stale closure issues
    setFormData(prevFormData => {
      let updatedFormData = { ...prevFormData, [field]: value }

      // Handle location field conflicts
      if (field === 'address') {
        // If address is being filled and we have area filters, clear them
        if (value && (prevFormData.cities?.length || prevFormData.townships?.length)) {
          updatedFormData = {
            ...updatedFormData,
            cities: [],
            townships: []
          }
        }
      } else if (field === 'cities' || field === 'townships') {
        // If area filters are being used and we have an address, clear it
        const newValue = value as string[]
        if (newValue.length > 0 && prevFormData.address) {
          updatedFormData = {
            ...updatedFormData,
            address: ''
          }
        }
      }

      return updatedFormData
    })

    // Clear validation errors when relevant fields change
    if ((field === 'address' || field === 'diameter' || field === 'cities' || field === 'townships') && validationErrors.location) {
      setValidationErrors(prev => ({ ...prev, location: '' }))
    }

    if ((field === 'is_single_family' || field === 'is_condo' || field === 'is_town_house' ||
         field === 'is_apartment' || field === 'is_multi_family' || field === 'is_lot_land') && validationErrors.propertyTypes) {
      setValidationErrors(prev => ({ ...prev, propertyTypes: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collection) return

    // Validate form
    const locationValidation = validateLocationPreferences()
    const hasValidPropertyTypes = validatePropertyTypes()
    
    let hasErrors = false
    const errors = { location: '', propertyTypes: '' }
    
    if (!locationValidation.isValid) {
      errors.location = locationValidation.error
      hasErrors = true
    }
    
    if (!hasValidPropertyTypes) {
      errors.propertyTypes = 'Please select at least one property type'
      hasErrors = true
    }
    
    if (hasErrors) {
      setValidationErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSave(collection.id, formData)
      onClose()
    } catch (error) {
      console.error('Error saving preferences:', error)
    } finally {
      setIsSubmitting(false)
    }
  }
  console.log(formData.townships)

  if (!isOpen || !collection) return null

  return (
    <div className="fixed inset-0 bg-[#111827]/60 z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 dark:border-gray-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all">
        <div className="p-8 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/95 dark:bg-[#151517]/95 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Edit Collection Preferences</h3>
              <p className="text-sm font-medium text-[#6B7280] dark:text-gray-400 mt-1">
                Customize search criteria for <span className="text-[#C9A24D] font-bold">{collection.customer.firstName} {collection.customer.lastName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="group p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={24} className="text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {isLoadingPreferences ? (
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8b7355]"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading preferences...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 space-y-10">
            {/* Property Criteria */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
                <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Property Criteria</h4>
              </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Minimum Bedrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.min_beds || ''}
                  onChange={(e) => handleInputChange('min_beds', e.target.value ? parseInt(e.target.value) : null)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Maximum Bedrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.max_beds || ''}
                  onChange={(e) => handleInputChange('max_beds', e.target.value ? parseInt(e.target.value) : null)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Minimum Bathrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={formData.min_baths || ''}
                  onChange={(e) => handleInputChange('min_baths', e.target.value ? parseFloat(e.target.value) : null)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Maximum Bathrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={formData.max_baths || ''}
                  onChange={(e) => handleInputChange('max_baths', e.target.value ? parseFloat(e.target.value) : null)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Minimum Price ($)
                </label>
                <input
                  type="text"
                  value={formatNumberWithCommas(formData.min_price)}
                  onChange={(e) => {
                    const rawValue = stripCommas(e.target.value)
                    if (rawValue === '' || /^\d+$/.test(rawValue)) {
                      handleInputChange('min_price', rawValue ? parseInt(rawValue) : null)
                    }
                  }}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Maximum Price ($)
                </label>
                <input
                  type="text"
                  value={formatNumberWithCommas(formData.max_price)}
                  onChange={(e) => {
                    const rawValue = stripCommas(e.target.value)
                    if (rawValue === '' || /^\d+$/.test(rawValue)) {
                      handleInputChange('max_price', rawValue ? parseInt(rawValue) : null)
                    }
                  }}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Minimum Year Built
                </label>
                <input
                  type="number"
                  min="1800"
                  max="2100"
                  value={formData.min_year_built || ''}
                  onChange={(e) => handleInputChange('min_year_built', e.target.value ? parseInt(e.target.value) : null)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Maximum Year Built
                </label>
                <input
                  type="number"
                  min="1800"
                  max="2100"
                  value={formData.max_year_built || ''}
                  onChange={(e) => handleInputChange('max_year_built', e.target.value ? parseInt(e.target.value) : null)}
                  className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                  placeholder="Any"
                />
              </div>
            </div>
          </div>

          {/* Location Criteria */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
              <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Location Preferences</h4>
            </div>
            
            <p className="text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-4 bg-gray-50 dark:bg-[#151517] p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <span className="font-bold text-[#111827] dark:text-white">Note:</span> Choose either address-based search OR city/township filtering (not both).
            </p>
            
            {/* Address-Based Search */}
            <div className={`p-6 rounded-2xl border transition-all duration-300 ${isUsingAddressSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] dark:bg-[#0B0B0B] shadow-md' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] hover:border-gray-300 dark:hover:border-gray-700'}`}>
              <div className="flex items-center justify-between mb-6">
                <h5 className={`text-md font-black uppercase tracking-wide flex items-center ${isUsingAddressSearch() ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`p-2 rounded-full mr-3 ${isUsingAddressSearch() ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  Address-Based Search
                </h5>
                {formData.address && (
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('address', '')
                      handleInputChange('diameter', null)
                      handleInputChange('lat', null)
                      handleInputChange('long', null)
                    }}
                    className="text-xs font-bold text-[#C9A24D] hover:text-[#111827] dark:hover:text-white uppercase tracking-widest transition-colors py-2 px-3 hover:bg-[#C9A24D]/10 rounded-lg"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Address
                  </label>
                  <GooglePlacesAutocomplete
                    value={formData.address || ''}
                    onChange={(address) => handleInputChange('address', address)}
                    disabled={isUsingAreaSearch()}
                        onCoordinatesChange={(lat, lng) => {
                          handleInputChange('lat', lat)
                          handleInputChange('long', lng)
                        }}
                    className={`block w-full px-4 py-3.5 border rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 font-medium ${
                      isUsingAreaSearch()
                        ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-gray-700 text-[#0B0B0B] dark:text-white focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] hover:border-[#C9A24D]/30'
                    }`}
                    placeholder={isUsingAreaSearch() ? 'Disabled - using city/township search' : '123 Main Street, City, State'}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Search Diameter (miles) {formData.address ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="50"
                    step="0.1"
                    value={formData.diameter || ''}
                    onChange={(e) => handleInputChange('diameter', e.target.value ? parseFloat(e.target.value) : null)}
                    disabled={isUsingAreaSearch()}
                    className={`block w-full px-4 py-3.5 border rounded-xl placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-200 font-medium ${
                      isUsingAreaSearch()
                        ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'bg-white dark:bg-[#0B0B0B] border-gray-200 dark:border-gray-700 text-[#0B0B0B] dark:text-white focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] hover:border-[#C9A24D]/30'
                    }`}
                    placeholder="2.0"
                  />
                  {formData.address && (
                    <p className="text-xs font-medium text-[#C9A24D] mt-2 ml-1">* Required when using address search</p>
                  )}
                </div>
              </div>
            </div>

            {/* Area-Based Search */}
            <div className={`p-6 rounded-2xl border transition-all duration-300 ${isUsingAreaSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] dark:bg-[#0B0B0B] shadow-md' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151517] hover:border-gray-300 dark:hover:border-gray-700'}`}>
              <div className="flex items-center justify-between mb-6">
                <h5 className={`text-md font-black uppercase tracking-wide flex items-center ${isUsingAreaSearch() ? 'text-[#111827] dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                  <div className={`p-2 rounded-full mr-3 ${isUsingAreaSearch() ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  City/Township Search
                </h5>
                {((formData.cities?.length || 0) + (formData.townships?.length || 0)) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('cities', [])
                      handleInputChange('townships', [])
                    }}
                    className="text-xs font-bold text-[#C9A24D] hover:text-[#111827] dark:hover:text-white uppercase tracking-widest transition-colors py-2 px-3 hover:bg-[#C9A24D]/10 rounded-lg"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Cities
                  </label>
                  <MultiCityPlacesInput
                    cities={formData.cities || []}
                    maxCities={5 - ((formData.townships || []).length)}
                    onChange={(cities) => {
                      setFormData(prev => {
                        // Clear address if cities are being added
                        if (cities.length > 0 && prev.address) {
                          return { ...prev, cities, address: '' }
                        }
                        return { ...prev, cities }
                      })
                      // Clear validation errors
                      if (validationErrors.location) {
                        setValidationErrors(prev => ({ ...prev, location: '' }))
                      }
                    }}
                    placeholder={isUsingAddressSearch() ? 'Disabled - using address search' : 'Type city names and press Enter...'}
                    className="mb-4"
                    disabled={isUsingAddressSearch()}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                    Townships
                  </label>
                  <MultiTownshipPlacesInput
                    townships={formData.townships || []}
                    maxTownships={5 - ((formData.cities || []).length)}
                    onChange={(townships) => {
                      setFormData(prev => {
                        // Clear address if townships are being added
                        if (townships.length > 0 && prev.address) {
                          return { ...prev, townships, address: '' }
                        }
                        return { ...prev, townships }
                      })
                      // Clear validation errors
                      if (validationErrors.location) {
                        setValidationErrors(prev => ({ ...prev, location: '' }))
                      }
                    }}
                    placeholder={isUsingAddressSearch() ? 'Disabled - using address search' : 'Type township names and press Enter...'}
                    className="mb-4"
                    disabled={isUsingAddressSearch()}
                  />
                </div>
              </div>
            </div>

            {/* Location Validation Error */}
            {validationErrors.location && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center shadow-sm">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full mr-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{validationErrors.location}</p>
              </div>
            )}
          </div>

          {/* Special Features */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
              <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Special Features</h4>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                Special features they're looking for
              </label>
              <textarea
                value={formData.special_features || ''}
                onChange={(e) => handleInputChange('special_features', e.target.value)}
                rows={3}
                className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30"
                placeholder="e.g., pool, garage, modern kitchen, hardwood floors..."
              />
            </div>
          </div>

          {/* Home Type Preferences */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
              <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Home Type Preferences</h4>
            </div>
            
            <p className="text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest ml-1">Select at least one property type *</p>
            
            <div className={`p-6 rounded-2xl border transition-all duration-300 ${validationErrors.propertyTypes ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 bg-[#FAFAF7] dark:bg-[#0B0B0B]'}`}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_single_family || false}
                      onChange={(e) => handleInputChange('is_single_family', e.target.checked)}
                      className="w-5 h-5 text-[#111827] dark:text-white border-gray-300 dark:border-gray-600 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                    />
                  </div>
                  <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Single Family</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_condo || false}
                      onChange={(e) => handleInputChange('is_condo', e.target.checked)}
                      className="w-5 h-5 text-[#111827] dark:text-white border-gray-300 dark:border-gray-600 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                    />
                  </div>
                  <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Condo</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_town_house || false}
                      onChange={(e) => handleInputChange('is_town_house', e.target.checked)}
                      className="w-5 h-5 text-[#111827] dark:text-white border-gray-300 dark:border-gray-600 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                    />
                  </div>
                  <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Townhouse</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_apartment || false}
                      onChange={(e) => handleInputChange('is_apartment', e.target.checked)}
                      className="w-5 h-5 text-[#111827] dark:text-white border-gray-300 dark:border-gray-600 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                    />
                  </div>
                  <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Apartment</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_multi_family || false}
                      onChange={(e) => handleInputChange('is_multi_family', e.target.checked)}
                      className="w-5 h-5 text-[#111827] dark:text-white border-gray-300 dark:border-gray-600 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                    />
                  </div>
                  <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Multi-Family</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_lot_land || false}
                      onChange={(e) => handleInputChange('is_lot_land', e.target.checked)}
                      className="w-5 h-5 text-[#111827] dark:text-white border-gray-300 dark:border-gray-600 rounded focus:ring-[#C9A24D] focus:ring-offset-0 transition-all duration-200"
                    />
                  </div>
                  <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors">Lot/Land</span>
                </label>
              </div>
            </div>

            {/* Property Type Validation Error */}
            {validationErrors.propertyTypes && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center shadow-sm">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full mr-3">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{validationErrors.propertyTypes}</p>
              </div>
            )}
          </div>

          {/* Visitor Information */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
              <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Visitor Information</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Visiting Reason
                </label>
                <div className="relative">
                  <select
                    value={formData.visiting_reason || ''}
                    onChange={(e) => handleInputChange('visiting_reason', e.target.value || null)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30 appearance-none cursor-pointer"
                  >
                    <option value="">Not specified</option>
                    <option value="BUYING_SOON">Buying soon</option>
                    <option value="BROWSING">Just browsing</option>
                    <option value="NEIGHBORHOOD">Exploring the neighborhood</option>
                    <option value="INVESTMENT">Investment opportunity</option>
                    <option value="CURIOUS">Just curious</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Has Agent
                </label>
                <div className="relative">
                  <select
                    value={formData.has_agent || ''}
                    onChange={(e) => handleInputChange('has_agent', e.target.value || null)}
                    className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium hover:bg-white dark:hover:bg-[#151515] hover:border-[#C9A24D]/30 appearance-none cursor-pointer"
                  >
                    <option value="">Not specified</option>
                    <option value="YES">Yes</option>
                    <option value="NO">No</option>
                    <option value="LOOKING">Looking for one</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-4 pt-8 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#2c241b] text-[#6B7280] dark:text-gray-400 font-bold rounded-xl transition-all duration-300 uppercase tracking-wide text-xs shadow-sm hover:shadow"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3.5 bg-[#111827] dark:bg-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] font-black rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white dark:text-[#111827]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : 'Save Preferences'}
            </button>
          </div>
          </form>
        )}
      </div>
    </div>
  )
}
