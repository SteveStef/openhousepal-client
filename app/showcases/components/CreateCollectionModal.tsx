'use client'

import { useState, useRef, memo } from 'react'
import GooglePlacesAutocomplete, { GooglePlacesAutocompleteRef } from '@/components/GooglePlacesAutocomplete'
import MultiSelectDatabaseInput from '@/components/MultiSelectDatabaseInput'
import api from '@/lib/api-service'

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const CreateCollectionModal = memo(function CreateCollectionModal({
  isOpen,
  onClose,
  onSubmit
}: CreateCollectionModalProps) {
  const googleAutocompleteRef = useRef<GooglePlacesAutocompleteRef>(null)
  const [formData, setFormData] = useState({
    showcaseName: '',
    fullName: '',
    email: '',
    phone: '',
    visitingReason: 'BUYING_SOON',
    hasAgent: 'NO',
    additionalComments: '',
    minBeds: '',
    maxBeds: '',
    minBaths: '',
    maxBaths: '',
    minPrice: '',
    maxPrice: '',
    minYearBuilt: '',
    maxYearBuilt: '',
    address: '',
    lat: null as number | null,
    long: null as number | null,
    cities: [] as string[],
    townships: [] as string[],
    schoolDistricts: [] as string[],
    diameter: '2',
    isTownHouse: false,
    isLotLand: false,
    isCondo: false,
    isMultiFamily: false,
    isSingleFamily: false,
    isApartment: false,
    isCommercial: false,
    isFarm: false
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState({
    location: '',
    propertyTypes: ''
  })

  const validatePropertyTypes = () => {
    return formData.isSingleFamily || formData.isCondo || formData.isTownHouse || 
           formData.isApartment || formData.isMultiFamily || formData.isLotLand ||
           formData.isCommercial || formData.isFarm
  }

  const validateLocationPreferences = () => {
    const hasAddress = formData.address && formData.address.trim()
    const hasAreaFilters = (formData.cities && formData.cities.length > 0) || 
                          (formData.townships && formData.townships.length > 0) ||
                          (formData.schoolDistricts && formData.schoolDistricts.length > 0)
    
    if (hasAddress && !formData.diameter) {
      return { isValid: false, error: 'Search diameter is required when using address-based search' }
    }
    if (!hasAddress && !hasAreaFilters) {
      return { isValid: false, error: 'Please specify either an address with search diameter OR select cities/townships/school districts' }
    }
    return { isValid: true, error: '' }
  }

  const isUsingAddressSearch = () => !!(formData.address && formData.address.trim())
  const isUsingAreaSearch = () => (formData.cities && formData.cities.length > 0) || 
                                 (formData.townships && formData.townships.length > 0) ||
                                 (formData.schoolDistricts && formData.schoolDistricts.length > 0)

  const formatNumberWithCommas = (value: string | number | undefined) => {
    if (!value && value !== 0) return ''
    const stringValue = value.toString().replace(/,/g, '')
    if (isNaN(Number(stringValue))) return stringValue
    return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const stripCommas = (value: string) => value.replace(/,/g, '')

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => {
      let updated = { ...prev, [field]: value }
      if (field === 'address' && value && (prev.cities?.length || prev.townships?.length || prev.schoolDistricts?.length)) {
        updated = { ...updated, cities: [], townships: [], schoolDistricts: [] }
      } else if ((field === 'cities' || field === 'townships' || field === 'schoolDistricts') && (value as string[]).length > 0 && prev.address) {
        updated = { ...updated, address: '' }
      }
      return updated
    })
    if (validationErrors.location) setValidationErrors(prev => ({ ...prev, location: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Silent Resolution: If address search is used but coordinates are missing, try to resolve before submitting
    let finalData = { ...formData }
    if (isUsingAddressSearch() && (!formData.lat || !formData.long)) {
      const resolved = await googleAutocompleteRef.current?.resolveAddress()
      if (resolved) {
        finalData.address = resolved.address
        finalData.lat = resolved.lat
        finalData.long = resolved.lng
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
    
    try {
      await onSubmit(finalData)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-[#111827]/60 flex items-center justify-center z-50 p-4 transition-all duration-300">
      <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all">
        <div className="p-8 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white/95 dark:bg-[#151517]/95 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Create New Showcase</h3>
              <p className="text-sm font-medium text-[#6B7280] dark:text-gray-400 mt-1">Create a personalized property collection for your client.</p>
            </div>
            <button onClick={onClose} className="group p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6 text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-10">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800"><div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div><h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Basic Information</h4></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Showcase Name *</label>
                <input type="text" required value={formData.showcaseName} onChange={(e) => handleInputChange('showcaseName', e.target.value)} className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-medium" placeholder="e.g., West Chester Family Showcase" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Full Name *</label>
                <input type="text" required value={formData.fullName} onChange={(e) => handleInputChange('fullName', e.target.value)} className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-medium" placeholder="Customer's full name" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Email *</label>
                <input type="email" required value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-medium" placeholder="customer@email.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all font-medium" placeholder="(555) 123-4567" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800"><div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div><h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Customer Preferences</h4></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Why are they visiting? *</label>
                <select value={formData.visitingReason} onChange={(e) => handleInputChange('visitingReason', e.target.value)} className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all appearance-none cursor-pointer" required>
                  <option value="BUYING_SOON">Looking to buy soon</option><option value="BROWSING">Just browsing</option><option value="NEIGHBORHOOD">Interested in area</option><option value="INVESTMENT">Investment opportunity</option><option value="CURIOUS">Curious about property</option><option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">Do they have an agent? *</label>
                <select value={formData.hasAgent} onChange={(e) => handleInputChange('hasAgent', e.target.value)} className="block w-full px-4 py-3.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all appearance-none cursor-pointer" required>
                  <option value="YES">Yes, they have an agent</option><option value="NO">No, they don't have an agent</option><option value="LOOKING">They're looking for an agent</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center space-x-3 pb-2 border-b border-gray-100 dark:border-gray-800"><div className="w-1 h-6 bg-[#C9A24D] rounded-full"></div><h4 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight uppercase">Search Criteria</h4></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div><label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2">Min Beds</label><input type="number" min="0" value={formData.minBeds} onChange={(e) => handleInputChange('minBeds', e.target.value)} className="w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white" placeholder="0" /></div>
              <div><label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2">Max Beds</label><input type="number" min="0" value={formData.maxBeds} onChange={(e) => handleInputChange('maxBeds', e.target.value)} className="w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white" placeholder="Any" /></div>
              <div><label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2">Min Baths</label><input type="number" min="0" step="0.5" value={formData.minBaths} onChange={(e) => handleInputChange('minBaths', e.target.value)} className="w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white" placeholder="0" /></div>
              <div><label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2">Max Baths</label><input type="number" min="0" step="0.5" value={formData.maxBaths} onChange={(e) => handleInputChange('maxBaths', e.target.value)} className="w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white" placeholder="Any" /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div><label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2">Min Price ($)</label><input type="text" value={formatNumberWithCommas(formData.minPrice)} onChange={(e) => handleInputChange('minPrice', stripCommas(e.target.value))} className="w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white" placeholder="0" /></div>
              <div><label className="block text-xs font-bold text-[#6B7280] dark:text-gray-400 uppercase mb-2">Max Price ($)</label><input type="text" value={formatNumberWithCommas(formData.maxPrice)} onChange={(e) => handleInputChange('maxPrice', stripCommas(e.target.value))} className="w-full px-4 py-3 bg-[#FAFAF7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-[#0B0B0B] dark:text-white" placeholder="No limit" /></div>
            </div>

            <div className="space-y-6">
              <div className={`p-6 rounded-2xl border transition-all ${isUsingAddressSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] dark:bg-[#0B0B0B]' : 'border-gray-200 dark:border-gray-800'}`}>
                <h5 className="text-md font-black uppercase mb-6">Address-Based Search</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <GooglePlacesAutocomplete 
                    ref={googleAutocompleteRef}
                    value={formData.address} 
                    onChange={(addr) => handleInputChange('address', addr)} 
                    onCoordinatesChange={(lat, lng) => { 
                      handleInputChange('lat', lat); 
                      handleInputChange('long', lng); 
                    }}
                    disabled={isUsingAreaSearch()} 
                    className="w-full px-4 py-3 border rounded-xl" 
                    placeholder="123 Main Street" 
                  />
                  <input type="number" min="0.1" step="0.1" value={formData.diameter} onChange={(e) => handleInputChange('diameter', e.target.value)} disabled={isUsingAreaSearch()} className="w-full px-4 py-3 border rounded-xl" placeholder="Radius (miles)" />
                </div>
              </div>

              <div className={`p-6 rounded-2xl border transition-all ${isUsingAreaSearch() ? 'border-[#C9A24D] bg-[#FAFAF7] dark:bg-[#0B0B0B]' : 'border-gray-200 dark:border-gray-800'}`}>
                <h5 className="text-md font-black uppercase mb-6">Area-Based Search</h5>
                <div className="space-y-4">
                  <MultiSelectDatabaseInput 
                    values={formData.cities} 
                    onChange={(v) => handleInputChange('cities', v)} 
                    apiMethod={api.properties.cities}
                    placeholder="Search cities..."
                    disabled={isUsingAddressSearch()} 
                  />
                  <MultiSelectDatabaseInput 
                    values={formData.townships} 
                    onChange={(v) => handleInputChange('townships', v)} 
                    apiMethod={api.properties.townships}
                    placeholder="Search townships..."
                    disabled={isUsingAddressSearch()} 
                  />
                  <MultiSelectDatabaseInput 
                    values={formData.schoolDistricts} 
                    onChange={(v) => handleInputChange('schoolDistricts', v)} 
                    apiMethod={api.properties.searchSchoolDistricts}
                    placeholder="Search school districts..."
                    disabled={isUsingAddressSearch()} 
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#FAFAF7] dark:bg-[#0B0B0B] rounded-2xl border border-gray-200 dark:border-gray-700">
               <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 {[
                   { id: 'isSingleFamily', label: 'Single Family' },
                   { id: 'isCondo', label: 'Condo' },
                   { id: 'isTownHouse', label: 'Townhouse' },
                   { id: 'isApartment', label: 'Rentals' },
                   { id: 'isMultiFamily', label: 'Multi-Family' },
                   { id: 'isLotLand', label: 'Lot/Land' },
                   { id: 'isCommercial', label: 'Commercial' },
                   { id: 'isFarm', label: 'Farm' }
                 ].map(type => (
                   <label key={type.id} className="flex items-center space-x-3 cursor-pointer group">
                     <input type="checkbox" checked={(formData as any)[type.id]} onChange={(e) => handleInputChange(type.id, e.target.checked)} className="w-5 h-5 text-[#111827] border-gray-300 rounded focus:ring-[#C9A24D]" />
                     <span className="text-sm font-bold text-[#6B7280] dark:text-gray-400 group-hover:text-[#111827] dark:group-hover:text-white">{type.label}</span>
                   </label>
                 ))}
               </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 pt-8 border-t border-gray-100 dark:border-gray-800">
            <button type="button" onClick={onClose} className="px-6 py-3.5 font-bold rounded-xl uppercase text-xs">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-black rounded-xl shadow-lg uppercase text-xs">{isSubmitting ? 'Creating...' : 'Create Showcase'}</button>
          </div>
        </form>
      </div>
    </div>
  )
})
