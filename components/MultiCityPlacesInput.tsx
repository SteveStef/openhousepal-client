'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import CityTag from './CityTag'
import '../types'

interface MultiCityPlacesInputProps {
  cities: string[]
  onChange: (cities: string[]) => void
  placeholder?: string
  maxCities?: number
  className?: string
  disabled?: boolean
}

export default function MultiCityPlacesInput({
  cities,
  onChange,
  placeholder = 'Type city name and press Enter...',
  maxCities = 10,
  className = '',
  disabled = false
}: MultiCityPlacesInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

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
          // Initialize the autocomplete for cities
          autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['(cities)'],
            fields: ['formatted_address', 'address_components', 'place_id'],
            componentRestrictions: { country: 'us' }
          })

          // Listen for place selection
          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current?.getPlace()
            if (place && place.address_components) {
              // Extract city name and state from address components
              let cityName = ''
              let stateAbbr = ''

              // Extract city/locality name
              for (const component of place.address_components) {
                if (component.types.includes('locality') ||
                    component.types.includes('sublocality') ||
                    component.types.includes('administrative_area_level_3')) {
                  cityName = component.long_name
                  break
                }
              }

              // Extract state abbreviation
              for (const component of place.address_components) {
                if (component.types.includes('administrative_area_level_1')) {
                  stateAbbr = component.short_name
                  break
                }
              }

              // Fallback to the first component if no city found
              if (!cityName && place.address_components.length > 0) {
                cityName = place.address_components[0].long_name
              }

              // Format as "City, State" or just "City" if no state available
              let formattedName = cityName
              if (cityName && stateAbbr) {
                formattedName = `${cityName}, ${stateAbbr}`
              }

              if (formattedName) {
                addCity(formattedName)
              }

              setInputValue('')
            }
          })
        }
      } catch (err) {
        console.error('Failed to load Google Maps API:', err)
        setError('Failed to load city suggestions')
      }
    }

    if (!disabled) {
      initializeAutocomplete()
    }

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [disabled, onChange])

  const addCity = (cityName: string) => {
    const trimmedCity = cityName.trim()
    setError(null)

    // Basic validation
    if (!trimmedCity || trimmedCity.length < 2) {
      setError('Please enter a valid city name')
      return
    }

    // Check for duplicates (case insensitive)
    if (cities.some(city => city.toLowerCase() === trimmedCity.toLowerCase())) {
      setError('This city is already in your list')
      return
    }

    // Check max cities limit
    if (cities.length >= maxCities) {
      setError(`You can add a maximum of ${maxCities} cities`)
      return
    }

    // Add the city
    const newCities = [...cities, trimmedCity]
    onChange(newCities)
    setInputValue('')
  }

  const removeCity = (cityToRemove: string) => {
    const newCities = cities.filter(city => city !== cityToRemove)
    onChange(newCities)
    setError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = inputValue.trim()

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (value) {
        addCity(value)
      }
    } else if (e.key === 'Backspace' && !inputValue && cities.length > 0) {
      // Remove last city if input is empty and backspace is pressed
      removeCity(cities[cities.length - 1])
    } else if (e.key === 'Escape') {
      setInputValue('')
      setError(null)
    }
  }

  const handleContainerClick = () => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }

  return (
    <div className={className}>
      <div
        onClick={handleContainerClick}
        className={`
          min-h-[42px] w-full px-3 py-2 border border-gray-300 rounded-lg
          focus-within:outline-none focus-within:ring-2 focus-within:ring-[#8b7355] focus-within:border-[#8b7355]
          transition-all duration-300 cursor-text relative
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
          ${error ? 'border-red-300 focus-within:ring-red-500 focus-within:border-red-500' : ''}
        `}
      >
        {/* Cities Tags */}
        <div className="flex flex-wrap gap-2 mb-2">
          {cities.map((city, index) => (
            <CityTag
              key={`${city}-${index}`}
              city={city}
              onRemove={removeCity}
            />
          ))}
        </div>

        {/* Input Field with Google Places */}
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={cities.length === 0 ? placeholder : 'Add another city...'}
            disabled={disabled}
            className="w-full border-none outline-none bg-transparent text-gray-900 placeholder-gray-400 min-w-[200px] pr-8"
          />
          
          {/* Loading/Status Indicator */}
          {!disabled && (
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
              {!isLoaded && !error && (
                <div className="animate-spin rounded-full h-3 w-3 border-b border-[#8b7355]" title="Loading suggestions..."></div>
              )}
              
              {error && (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <title>{error}</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              
              {isLoaded && !error && (
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <title>Powered by Google</title>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {/* Helper Text */}
      {!error && (
        <p className="mt-1 text-sm text-gray-500">
          {cities.length > 0 
            ? `${cities.length}/${maxCities} cities selected. Type city names for suggestions or press Enter to add.`
            : isLoaded 
              ? 'Start typing city names to see suggestions from Google Places.'
              : 'Type city names and press Enter or comma to add them.'
          }
        </p>
      )}
    </div>
  )
}
