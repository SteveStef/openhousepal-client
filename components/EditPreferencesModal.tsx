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
  const formatNumberWithCommas = (value: string | number | null) => {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Edit Collection Preferences</h3>
              <p className="text-sm text-gray-600 mt-1">
                {collection.customer.firstName} {collection.customer.lastName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {isLoadingPreferences ? (
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8b7355]"></div>
            <span className="ml-3 text-gray-600">Loading preferences...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Property Criteria */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Property Criteria</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Bedrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.min_beds || ''}
                  onChange={(e) => handleInputChange('min_beds', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Bedrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.max_beds || ''}
                  onChange={(e) => handleInputChange('max_beds', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Bathrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={formData.min_baths || ''}
                  onChange={(e) => handleInputChange('min_baths', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Bathrooms
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={formData.max_baths || ''}
                  onChange={(e) => handleInputChange('max_baths', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Year Built
                </label>
                <input
                  type="number"
                  min="1800"
                  max="2100"
                  value={formData.min_year_built || ''}
                  onChange={(e) => handleInputChange('min_year_built', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Year Built
                </label>
                <input
                  type="number"
                  min="1800"
                  max="2100"
                  value={formData.max_year_built || ''}
                  onChange={(e) => handleInputChange('max_year_built', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
            </div>
          </div>

          {/* Location Criteria */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Location Preferences</h4>
            <p className="text-sm text-gray-600 mb-4">
              Choose either address-based search OR city/township filtering (not both)
            </p>
            
            {/* Address-Based Search */}
            <div className={`p-4 rounded-lg border-2 ${isUsingAddressSearch() ? 'border-[#8b7355] bg-[#8b7355]/5' : 'border-gray-200 bg-gray-50/50'}`}>
              <h5 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Address-Based Search
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className={`${
                      isUsingAreaSearch()
                        ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'border-gray-300'
                    }`}
                    placeholder={isUsingAreaSearch() ? 'Disabled - using city/township search' : '123 Main Street, City, State'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355] ${
                      isUsingAreaSearch()
                        ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'border-gray-300'
                    }`}
                    placeholder="2.0"
                  />
                  {formData.address && (
                    <p className="text-xs text-gray-600 mt-1">* Required when using address search</p>
                  )}
                </div>
              </div>
            </div>

            {/* Area-Based Search */}
            <div className={`p-4 rounded-lg border-2 ${isUsingAreaSearch() ? 'border-[#8b7355] bg-[#8b7355]/5' : 'border-gray-200 bg-gray-50/50'}`}>
              <h5 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                City/Township Search
              </h5>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{validationErrors.location}</p>
              </div>
            )}
          </div>

          {/* Special Features */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Special Features</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special features they're looking for
              </label>
              <textarea
                value={formData.special_features || ''}
                onChange={(e) => handleInputChange('special_features', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                placeholder="e.g., pool, garage, modern kitchen, hardwood floors..."
              />
            </div>
          </div>

          {/* Home Type Preferences */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Home Type Preferences</h4>
            <p className="text-sm text-gray-600">Select at least one property type *</p>
            
            <div className={`p-4 rounded-lg border-2 ${validationErrors.propertyTypes ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-gray-50/50'}`}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_single_family || false}
                    onChange={(e) => handleInputChange('is_single_family', e.target.checked)}
                    className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Single Family</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_condo || false}
                    onChange={(e) => handleInputChange('is_condo', e.target.checked)}
                    className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Condo</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_town_house || false}
                    onChange={(e) => handleInputChange('is_town_house', e.target.checked)}
                    className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Townhouse</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_apartment || false}
                    onChange={(e) => handleInputChange('is_apartment', e.target.checked)}
                    className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Apartment</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_multi_family || false}
                    onChange={(e) => handleInputChange('is_multi_family', e.target.checked)}
                    className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Multi-Family</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_lot_land || false}
                    onChange={(e) => handleInputChange('is_lot_land', e.target.checked)}
                    className="w-4 h-4 text-[#8b7355] border-gray-300 rounded focus:ring-[#8b7355] focus:ring-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Lot/Land</span>
                </label>
              </div>
            </div>

            {/* Property Type Validation Error */}
            {validationErrors.propertyTypes && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{validationErrors.propertyTypes}</p>
              </div>
            )}
          </div>

          {/* Visitor Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Visitor Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visiting Reason
                </label>
                <select
                  value={formData.visiting_reason || ''}
                  onChange={(e) => handleInputChange('visiting_reason', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                >
                  <option value="">Not specified</option>
                  <option value="BUYING_SOON">Buying soon</option>
                  <option value="BROWSING">Just browsing</option>
                  <option value="NEIGHBORHOOD">Exploring the neighborhood</option>
                  <option value="INVESTMENT">Investment opportunity</option>
                  <option value="CURIOUS">Just curious</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Has Agent
                </label>
                <select
                  value={formData.has_agent || ''}
                  onChange={(e) => handleInputChange('has_agent', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                >
                  <option value="">Not specified</option>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                  <option value="LOOKING">Looking for one</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-[#8b7355] to-[#7a6549] text-white rounded-lg hover:shadow-lg hover:shadow-[#8b7355]/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
          </form>
        )}
      </div>
    </div>
  )
}
