'use client'

import { useState, useEffect, useRef } from 'react'
import { Collection, CollectionPreferences } from '@/types'
import api from '@/lib/api-service'
import { X } from 'lucide-react'
import MultiCityPlacesInput from './MultiCityPlacesInput'
import MultiTownshipPlacesInput from './MultiTownshipPlacesInput'
import MultiSchoolDistrictInput from './MultiSchoolDistrictInput'
import GooglePlacesAutocomplete, { GooglePlacesAutocompleteRef } from './GooglePlacesAutocomplete'

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
  const googleAutocompleteRef = useRef<GooglePlacesAutocompleteRef>(null)
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
    school_districts: [],
    diameter: null,
    special_features: '',
    is_town_house: false,
    is_lot_land: false,
    is_condo: false,
    is_multi_family: false,
    is_single_family: false,
    is_apartment: false,
    is_commercial: false,
    is_farm: false
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
                           formData.is_apartment || formData.is_multi_family || formData.is_lot_land ||
                           formData.is_commercial || formData.is_farm
    return hasPropertyType
  }

  const validateLocationPreferences = () => {
    const hasAddress = formData.address && formData.address.trim()
    const hasAreaFilters = (formData.cities && formData.cities.length > 0) || 
                          (formData.townships && formData.townships.length > 0) ||
                          (formData.school_districts && formData.school_districts.length > 0)
    
    // If address is provided, diameter must be provided
    if (hasAddress && !formData.diameter) {
      return { isValid: false, error: 'Search diameter is required when using address-based search' }
    }
    
    // Must have either address or area filters
    if (!hasAddress && !hasAreaFilters) {
      return { isValid: false, error: 'Please specify either an address with search diameter OR select cities/townships/school districts' }
    }
    
    return { isValid: true, error: '' }
  }

  const isUsingAddressSearch = () => {
    return !!(formData.address && formData.address.trim())
  }

  const isUsingAreaSearch = () => {
    return (formData.cities && formData.cities.length > 0) || 
           (formData.townships && formData.townships.length > 0) ||
           (formData.school_districts && formData.school_districts.length > 0)
  }

  // Helper to format number with commas
  const formatNumberWithCommas = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return ''
    const stringValue = value.toString().replace(/,/g, '')
    if (isNaN(Number(stringValue))) return stringValue
    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const stripCommas = (value: string) => {
    return value.replace(/,/g, '')
  }

  useEffect(() => {
    if (isOpen && collection) {
      // Use local collection data as immediate fallback
      if (collection.preferences) {
        setFormData(prev => ({ ...prev, ...collection.preferences }));
      }
      fetchPreferences()
    }
  }, [isOpen, collection])

  const fetchPreferences = async () => {
    if (!collection) return
    setIsLoadingPreferences(true)
    try {
      const { success, data } = await api.collections.getPreferences(collection.id)
      if (success && data) {
        // Backend returns preferences nested or direct, handle both
        const prefs = data.preferences || data;
        setFormData(prev => ({ ...prev, ...prefs }));
      }
    } catch (error) {
      console.error('Error fetching preferences:', error)
    } finally {
      setIsLoadingPreferences(false)
    }
  }

  const handleSave = async () => {
    if (!collection) return

    setIsSubmitting(true)
    
    // Silent Resolution: If address search is used but coordinates are missing, try to resolve before submitting
    let finalPreferences = { ...formData }
    if (isUsingAddressSearch() && (!formData.lat || !formData.long)) {
      const resolved = await googleAutocompleteRef.current?.resolveAddress()
      if (resolved) {
        finalPreferences.address = resolved.address
        finalPreferences.lat = resolved.lat
        finalPreferences.long = resolved.lng
      }
    }

    const locationValidation = validateLocationPreferences()
    const hasValidPropertyTypes = validatePropertyTypes()
    
    if (!locationValidation.isValid || !hasValidPropertyTypes) {
      setValidationErrors({
        location: locationValidation.isValid ? '' : locationValidation.error,
        propertyTypes: hasValidPropertyTypes ? '' : 'Please select at least one property type'
      })
      setIsSubmitting(false)
      return
    }

    onSave(collection.id, finalPreferences)
    setIsSubmitting(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-[#111827]/60 flex items-center justify-center z-50 p-4 transition-all duration-300 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all animate-scaleIn">
        <div className="p-8 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/95 dark:bg-[#151517]/95 backdrop-blur-md z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Edit Search Preferences</h3>
              <p className="text-sm font-medium text-[#6B7280] dark:text-gray-400 mt-1">Refine what listings are shown to {collection?.customer?.firstName}.</p>
            </div>
            <button 
              onClick={onClose}
              className="group p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-6 h-6 text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>
        
        {isLoadingPreferences ? (
          <div className="p-20 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b7355]"></div>
            <p className="text-gray-500 font-medium">Loading current preferences...</p>
          </div>
        ) : (
          <div className="p-8 space-y-10">
            {/* Search Criteria Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
                <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Search Criteria</h4>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2 ml-1">Min Beds</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.min_beds || ''}
                    onChange={(e) => setFormData({ ...formData, min_beds: parseInt(e.target.value) || null })}
                    className="block w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2 ml-1">Max Beds</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.max_beds || ''}
                    onChange={(e) => setFormData({ ...formData, max_beds: parseInt(e.target.value) || null })}
                    className="block w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-bold"
                    placeholder="Any"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2 ml-1">Min Baths</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.5"
                    value={formData.min_baths || ''}
                    onChange={(e) => setFormData({ ...formData, min_baths: parseFloat(e.target.value) || null })}
                    className="block w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2 ml-1">Max Baths</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.5"
                    value={formData.max_baths || ''}
                    onChange={(e) => setFormData({ ...formData, max_baths: parseFloat(e.target.value) || null })}
                    className="block w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-bold"
                    placeholder="Any"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2 ml-1">Min Price ($)</label>
                  <input 
                    type="text" 
                    value={formatNumberWithCommas(formData.min_price)}
                    onChange={(e) => setFormData({ ...formData, min_price: parseInt(stripCommas(e.target.value)) || null })}
                    className="block w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2 ml-1">Max Price ($)</label>
                  <input 
                    type="text" 
                    value={formatNumberWithCommas(formData.max_price)}
                    onChange={(e) => setFormData({ ...formData, max_price: parseInt(stripCommas(e.target.value)) || null })}
                    className="block w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-bold"
                    placeholder="No limit"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className={`p-6 rounded-2xl border-2 transition-all ${isUsingAddressSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] dark:bg-[#0B0B0B] shadow-md' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517]'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h5 className="text-md font-black text-[#0B0B0B] dark:text-white uppercase tracking-tight">Address-Based Search</h5>
                    {isUsingAddressSearch() && <div className="px-3 py-1 bg-[#C9A24D] rounded-full text-[10px] font-black text-white uppercase tracking-widest">Active</div>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-widest ml-1">Central Address</label>
                      <GooglePlacesAutocomplete
                        ref={googleAutocompleteRef}
                        value={formData.address || ''}
                        onChange={(addr) => {
                          setFormData({ ...formData, address: addr, cities: [], townships: [], school_districts: [] })
                        }}
                        onCoordinatesChange={(lat, long) => {
                          setFormData({ ...formData, lat, long })
                        }}
                        placeholder="Search near address"
                        disabled={isUsingAreaSearch()}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-[#6B7280] dark:text-gray-500 uppercase tracking-widest ml-1">Search Radius (miles)</label>
                      <input 
                        type="number" 
                        min="0.1"
                        step="0.1"
                        value={formData.diameter || ''}
                        onChange={(e) => setFormData({ ...formData, diameter: parseFloat(e.target.value) || null })}
                        className="block w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-bold"
                        placeholder="Radius in miles"
                        disabled={isUsingAreaSearch()}
                      />
                    </div>
                  </div>
                  {validationErrors.location && isUsingAddressSearch() && (
                    <p className="mt-4 text-xs text-red-500 font-bold flex items-center animate-fadeIn">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {validationErrors.location}
                    </p>
                  )}
                </div>

                <div className={`p-6 rounded-2xl border-2 transition-all ${isUsingAreaSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] dark:bg-[#0B0B0B] shadow-md' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-[#151517]'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <h5 className="text-md font-black text-[#0B0B0B] dark:text-white uppercase tracking-tight">Area-Based Search</h5>
                    {isUsingAreaSearch() && <div className="px-3 py-1 bg-[#C9A24D] rounded-full text-[10px] font-black text-white uppercase tracking-widest">Active</div>}
                  </div>
                  <div className="space-y-4">
                    <MultiCityPlacesInput 
                      cities={formData.cities || []} 
                      onChange={(cities) => setFormData({ ...formData, cities, address: '', lat: null, long: null, diameter: null })}
                      disabled={isUsingAddressSearch()}
                    />
                    <MultiTownshipPlacesInput 
                      townships={formData.townships || []} 
                      onChange={(townships) => setFormData({ ...formData, townships, address: '', lat: null, long: null, diameter: null })}
                      disabled={isUsingAddressSearch()}
                    />
                    <MultiSchoolDistrictInput 
                      schoolDistricts={formData.school_districts || []} 
                      onChange={(school_districts) => setFormData({ ...formData, school_districts, address: '', lat: null, long: null, diameter: null })}
                      disabled={isUsingAddressSearch()}
                    />
                  </div>
                  {validationErrors.location && isUsingAreaSearch() && (
                    <p className="mt-4 text-xs text-red-500 font-bold flex items-center animate-fadeIn">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {validationErrors.location}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Property Types Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
                <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Home Types</h4>
              </div>
              
              <div className="p-6 bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-2xl border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { id: 'is_single_family', label: 'Single Family' },
                    { id: 'is_condo', label: 'Condo' },
                    { id: 'is_town_house', label: 'Townhouse' },
                    { id: 'is_apartment', label: 'Rentals' },
                    { id: 'is_multi_family', label: 'Multi-Family' },
                    { id: 'is_lot_land', label: 'Lot/Land' },
                    { id: 'is_commercial', label: 'Commercial' },
                    { id: 'is_farm', label: 'Farm' }
                  ].map((type) => (
                    <label key={type.id} className="flex items-center space-x-3 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={(formData as any)[type.id]}
                        onChange={(e) => setFormData({ ...formData, [type.id]: e.target.checked })}
                        className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D]"
                      />
                      <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {validationErrors.propertyTypes && (
                <p className="text-xs text-red-500 font-bold flex items-center animate-fadeIn pl-1">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {validationErrors.propertyTypes}
                </p>
              )}
            </div>

            {/* Special Features Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div>
                <h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Special Features</h4>
              </div>
              <textarea 
                value={formData.special_features || ''}
                onChange={(e) => setFormData({ ...formData, special_features: e.target.value })}
                rows={3}
                className="block w-full px-4 py-4 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-medium"
                placeholder="e.g., Finished basement, large pool, cul-de-sac only..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-8 border-t border-gray-100 dark:border-gray-800">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-3.5 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold transition-colors uppercase text-xs tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-10 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-black rounded-xl shadow-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all uppercase text-xs tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white dark:border-[#111827]"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Preferences'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
