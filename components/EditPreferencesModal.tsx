'use client'

import { useState, useEffect } from 'react'
import { Collection, CollectionPreferences } from '@/types'
import { collectionPreferencesApi } from '@/lib/api'
import { X } from 'lucide-react'

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
    lat: null,
    long: null,
    diameter: 2.0,
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

  // Fetch and populate form when modal opens
  useEffect(() => {
    if (isOpen && collection) {
      const loadPreferences = async () => {
        setIsLoadingPreferences(true)
        try {
          // First try to use preferences from collection object if they're the detailed type
          if (collection.preferences && 'min_beds' in collection.preferences) {
            const prefs = collection.preferences as CollectionPreferences
            setFormData({
              min_beds: prefs.min_beds || null,
              max_beds: prefs.max_beds || null,
              min_baths: prefs.min_baths || null,
              max_baths: prefs.max_baths || null,
              min_price: prefs.min_price || null,
              max_price: prefs.max_price || null,
              lat: prefs.lat || null,
              long: prefs.long || null,
              diameter: prefs.diameter || 2.0,
              special_features: prefs.special_features || '',
              is_town_house: prefs.is_town_house || false,
              is_lot_land: prefs.is_lot_land || false,
              is_condo: prefs.is_condo || false,
              is_multi_family: prefs.is_multi_family || false,
              is_single_family: prefs.is_single_family || false,
              is_apartment: prefs.is_apartment || false,
              timeframe: prefs.timeframe || null,
              visiting_reason: prefs.visiting_reason || null,
              has_agent: prefs.has_agent || null
            })
          } else {
            // Fetch preferences from API
            const response = await collectionPreferencesApi.get(collection.id)
            if (response.success && response.data) {
              const prefs = response.data
              setFormData({
                min_beds: prefs.min_beds || null,
                max_beds: prefs.max_beds || null,
                min_baths: prefs.min_baths || null,
                max_baths: prefs.max_baths || null,
                min_price: prefs.min_price || null,
                max_price: prefs.max_price || null,
                lat: prefs.lat || null,
                long: prefs.long || null,
                diameter: prefs.diameter || 2.0,
                special_features: prefs.special_features || '',
                is_town_house: prefs.is_town_house || false,
                is_lot_land: prefs.is_lot_land || false,
                is_condo: prefs.is_condo || false,
                is_multi_family: prefs.is_multi_family || false,
                is_single_family: prefs.is_single_family || false,
                is_apartment: prefs.is_apartment || false,
                timeframe: prefs.timeframe || null,
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
                lat: null,
                long: null,
                diameter: 2.0,
                special_features: '',
                is_town_house: false,
                is_lot_land: false,
                is_condo: false,
                is_multi_family: false,
                is_single_family: false,
                is_apartment: false,
                timeframe: null,
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
            lat: null,
            long: null,
            diameter: 2.0,
            special_features: '',
            is_town_house: false,
            is_lot_land: false,
            is_condo: false,
            is_multi_family: false,
            is_single_family: false,
            is_apartment: false,
            timeframe: null,
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

  const handleInputChange = (field: keyof CollectionPreferences, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collection) return

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
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.min_price || ''}
                  onChange={(e) => handleInputChange('min_price', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Price ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.max_price || ''}
                  onChange={(e) => handleInputChange('max_price', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="Any"
                />
              </div>
            </div>
          </div>

          {/* Location Criteria */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Location Preferences</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.lat || ''}
                  onChange={(e) => handleInputChange('lat', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="39.9526"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.long || ''}
                  onChange={(e) => handleInputChange('long', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="-75.1652"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Diameter (miles)
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={formData.diameter}
                  onChange={(e) => handleInputChange('diameter', e.target.value ? parseFloat(e.target.value) : 2.0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                  placeholder="2.0"
                />
              </div>
            </div>
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

          {/* Visitor Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Visitor Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Timeframe
                </label>
                <select
                  value={formData.timeframe || ''}
                  onChange={(e) => handleInputChange('timeframe', e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b7355] focus:border-[#8b7355]"
                >
                  <option value="">Not specified</option>
                  <option value="IMMEDIATELY">Immediately</option>
                  <option value="1_3_MONTHS">1-3 months</option>
                  <option value="3_6_MONTHS">3-6 months</option>
                  <option value="6_12_MONTHS">6-12 months</option>
                  <option value="OVER_YEAR">Over a year</option>
                  <option value="NOT_SURE">Not sure</option>
                </select>
              </div>
              
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
