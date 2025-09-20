'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import "../types"

interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (address: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
}

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  placeholder = "123 Main Street, City, State, ZIP",
  className = "",
  disabled = false,
  required = false,
  id = "address",
  name = "address"
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string>('')

  // Format address without country
  const formatAddressWithoutCountry = (place: google.maps.places.PlaceResult): string => {
    if (!place.address_components) {
      return place.formatted_address || ''
    }

    const components: string[] = []

    // Define the order we want the components to appear
    const componentOrder = [
      'street_number',
      'route',
      'subpremise', // apartment, suite, etc.
      'locality', // city
      'administrative_area_level_1', // state
      'postal_code'
    ]

    // Extract components in the desired order
    for (const type of componentOrder) {
      const component = place.address_components.find(comp =>
        comp.types.includes(type)
      )
      if (component) {
        // Use short_name for state and long_name for others
        const value = type === 'administrative_area_level_1'
          ? component.short_name
          : component.long_name
        components.push(value)
      }
    }

    // Join components with appropriate separators
    if (components.length === 0) {
      // Fallback to formatted_address but remove country
      return place.formatted_address?.replace(/, USA$/, '') || ''
    }

    // Format: "123 Main St, Springfield, IL 62701"
    const addressParts: string[] = []

    // Street address (number + route + subpremise)
    const streetParts = components.slice(0, 3).filter(Boolean)
    if (streetParts.length > 0) {
      addressParts.push(streetParts.join(' '))
    }

    // City
    if (components[3]) {
      addressParts.push(components[3])
    }

    // State and ZIP together
    const stateZipParts = components.slice(4).filter(Boolean)
    if (stateZipParts.length > 0) {
      addressParts.push(stateZipParts.join(' '))
    }

    return addressParts.join(', ')
  }

  useEffect(() => {
    const initializeAutocomplete = async () => {
      if (!process.env.NEXT_PUBLIC_GOOGLE_API_KEY) {
        setError('Google API key not configured')
        return
      }

      try {
        const loader = new Loader({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
          version: 'weekly',
          libraries: ['places']
        })

        await loader.load()
        setIsLoaded(true)

        if (inputRef.current) {
          // Initialize the autocomplete with legacy API
          autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['address'],
            fields: ['formatted_address', 'address_components', 'geometry'],
            componentRestrictions: { country: 'us' }
          })

          // Listen for place selection
          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current?.getPlace()
            if (place && (place.formatted_address || place.address_components)) {
              // Format address without country
              const formattedAddress = formatAddressWithoutCountry(place)
              // Update the React state
              onChange(formattedAddress)
              // Also directly update the input field to ensure visual sync
              if (inputRef.current) {
                inputRef.current.value = formattedAddress
              }
            }
          })
        }
      } catch (err) {
        console.error('Failed to load Google Maps API:', err)
        setError('Failed to load address suggestions')
      }
    }

    initializeAutocomplete()

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [onChange])

  // Handle manual input changes (typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        required={required}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white/80 border border-gray-200/50 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 focus:border-[#8b7355]/60 transition-all duration-300 shadow-sm ${className}`}
        placeholder={placeholder}
      />
      
      {!isLoaded && !error && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#8b7355]"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2" title={error}>
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      )}
      
      {isLoaded && !error && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2" title="Powered by Google">
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
      )}
    </div>
  )
}
