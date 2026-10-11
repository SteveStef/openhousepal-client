'use client'

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import "../types"

interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (address: string) => void
  onCoordinatesChange?: (lat: number, lng: number, address: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
}

export interface GooglePlacesAutocompleteRef {
  resolveAddress: () => Promise<{address: string, lat: number, lng: number} | null>;
}

// Helper function moved outside component to avoid recreation and dependency issues
const formatAddressWithoutCountry = (place: google.maps.places.PlaceResult): string => {
  if (!place.address_components) {
    return place.formatted_address || ''
  }

  const components: string[] = []

  const componentOrder = [
    'street_number',
    'route',
    'subpremise',
    'locality',
    'administrative_area_level_1',
    'postal_code'
  ]

  for (const type of componentOrder) {
    const component = place.address_components.find(comp =>
      comp.types.includes(type)
    )
    if (component) {
      const value = type === 'administrative_area_level_1'
        ? component.short_name
        : component.long_name
      components.push(value)
    }
  }

  if (components.length === 0) {
    return place.formatted_address?.replace(/, USA$/, '') || ''
  }

  const addressParts: string[] = []

  const streetParts = components.slice(0, 3).filter(Boolean)
  if (streetParts.length > 0) {
    addressParts.push(streetParts.join(' '))
  }

  if (components[3]) {
    addressParts.push(components[3])
  }

  const stateZipParts = components.slice(4).filter(Boolean)
  if (stateZipParts.length > 0) {
    addressParts.push(stateZipParts.join(' '))
  }

  return addressParts.join(', ')
}

const GooglePlacesAutocomplete = forwardRef<GooglePlacesAutocompleteRef, GooglePlacesAutocompleteProps>(({
  value,
  onChange,
  onCoordinatesChange,
  placeholder = "123 Main Street, City, State, ZIP",
  className = "",
  disabled = false,
  required = false,
  id = "address",
  name = "address"
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string>('')
  
  // Internal state to manage the display value to prevent "snap-back" issues
  // between React's controlled state and Google's DOM manipulation
  const [displayValue, setDisplayValue] = useState(value)

  // Sync internal state with external value prop
  useEffect(() => {
    if (value !== displayValue) {
      setDisplayValue(value)
    }
  }, [value])

  // Refs to hold the latest callback functions
  const onChangeRef = useRef(onChange)
  const onCoordinatesChangeRef = useRef(onCoordinatesChange)

  // Update refs when props change
  useEffect(() => {
    onChangeRef.current = onChange
    onCoordinatesChangeRef.current = onCoordinatesChange
  }, [onChange, onCoordinatesChange])

  // Logic to resolve the best match for the current text
  const resolveAddress = async (): Promise<{address: string, lat: number, lng: number} | null> => {
    const currentValue = inputRef.current?.value.trim() || displayValue.trim();
    if (!currentValue) return null;

    try {
      const autocompleteService = new google.maps.places.AutocompleteService();
      const predictions = await autocompleteService.getPlacePredictions({
        input: currentValue,
        types: ['address'],
        componentRestrictions: { country: 'us' }
      });

      if (predictions.predictions && predictions.predictions.length > 0) {
        const topMatch = predictions.predictions[0];
        const placesService = new google.maps.places.PlacesService(document.createElement('div'));
        
        return new Promise((resolve) => {
          placesService.getDetails({
            placeId: topMatch.place_id,
            fields: ['address_components', 'formatted_address', 'geometry']
          }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry?.location) {
              const formattedAddress = formatAddressWithoutCountry(place);
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              
              // Sync local UI
              setDisplayValue(formattedAddress);
              onChangeRef.current(formattedAddress);
              if (onCoordinatesChangeRef.current) {
                onCoordinatesChangeRef.current(lat, lng, formattedAddress);
              }
              if (inputRef.current) {
                inputRef.current.value = formattedAddress;
              }

              resolve({ address: formattedAddress, lat, lng });
            } else {
              resolve(null);
            }
          });
        });
      }
    } catch (err) {
      console.error("Manual address resolution failed:", err);
    }
    return null;
  };

  // Expose resolveAddress to parent components
  useImperativeHandle(ref, () => ({
    resolveAddress
  }));

  useEffect(() => {
    const initializeAutocomplete = async () => {
      if (!process.env.NEXT_PUBLIC_GOOGLE_API_KEY) {
        setError('Google API key not configured')
        return
      }

      try {
        await googleMapsLoader.load()
        setIsLoaded(true)

        if (inputRef.current) {
          autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['address'],
            fields: ['formatted_address', 'address_components', 'geometry'],
            componentRestrictions: { country: 'us' }
          })

          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current?.getPlace()
            if (!place) return

            // Format the address
            const formattedAddress = formatAddressWithoutCountry(place)

            // Update internal state immediately
            setDisplayValue(formattedAddress)
            
            // Send formatted address to parent
            onChangeRef.current(formattedAddress)

            // Update input visually
            if (inputRef.current) {
              inputRef.current.value = formattedAddress
            }

            // Send coordinates to parent
            if (onCoordinatesChangeRef.current && place.geometry?.location) {
              const lat = place.geometry.location.lat()
              const lng = place.geometry.location.lng()
              onCoordinatesChangeRef.current(lat, lng, formattedAddress)
            }
          })
        }
      } catch (err) {
        console.error('Failed to load Google Maps API:', err)
        setError('Failed to load address suggestions')
      }
    }

    initializeAutocomplete()

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, []) // Empty dependency array ensures this only runs once

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setDisplayValue(newValue)
    onChange(newValue)
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value.trim()
      if (!value) return
      
      e.preventDefault()
      // Automatically resolve to first match on Enter
      await resolveAddress()
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        required={required}
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full px-4 py-3 bg-white/80 dark:bg-[#0B0B0B] border border-gray-200/50 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#8b7355]/60 dark:focus:ring-[#C9A24D]/20 focus:border-[#8b7355]/60 dark:focus:border-[#C9A24D] transition-all duration-300 shadow-sm ${className}`}
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
      
    </div>
  )
})

GooglePlacesAutocomplete.displayName = 'GooglePlacesAutocomplete'

export default GooglePlacesAutocomplete
