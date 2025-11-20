'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import CityTag from './CityTag'

interface MultiTownshipPlacesInputProps {
  townships: string[]
  onChange: (townships: string[]) => void
  placeholder?: string
  maxTownships?: number
  className?: string
  disabled?: boolean
}

export default function MultiTownshipPlacesInput({
  townships,
  onChange,
  placeholder = 'Type township name and press Enter...',
  maxTownships = 10,
  className = '',
  disabled = false
}: MultiTownshipPlacesInputProps) {
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
          // Initialize the autocomplete for townships and administrative areas
          autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
            types: ['sublocality', 'administrative_area_level_3'], // Townships, neighborhoods, boroughs
            fields: ['formatted_address', 'address_components', 'place_id'],
            componentRestrictions: { country: 'us' }
          })

          // Listen for place selection
          autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current?.getPlace()
            if (place && place.address_components) {
              // Extract township name and state from address components
              let townshipName = ''
              let stateAbbr = ''

              // Extract township/administrative area name
              for (const component of place.address_components) {
                if (component.types.includes('administrative_area_level_3') ||
                    component.types.includes('sublocality') ||
                    component.types.includes('sublocality_level_1') ||
                    component.types.includes('neighborhood')) {
                  townshipName = component.long_name
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

              // Fallback to the first component if no township found
              if (!townshipName && place.address_components.length > 0) {
                townshipName = place.address_components[0].long_name
              }

              // Format as "Township, State" or just "Township" if no state available
              let formattedName = townshipName
              if (townshipName && stateAbbr) {
                formattedName = `${townshipName}, ${stateAbbr}`
              }

              if (formattedName) {
                addTownship(formattedName)
              }

              setInputValue('')
            }
          })
        }
      } catch (err) {
        console.error('Failed to load Google Maps API:', err)
        setError('Failed to load township suggestions')
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
  }, [disabled, townships])

  const addTownship = (townshipName: string) => {
    const trimmedTownship = townshipName.trim()
    setError(null)

    // Basic validation
    if (!trimmedTownship || trimmedTownship.length < 2) {
      setError('Please enter a valid township name')
      return
    }

    // Check for duplicates (case insensitive)
    if (townships.some(township => township.toLowerCase() === trimmedTownship.toLowerCase())) {
      setError('This township is already in your list')
      return
    }

    // Check max townships limit
    if (townships.length >= maxTownships) {
      setError(`You can add a maximum of ${maxTownships} townships`)
      return
    }

    // Add the township
    const newTownships = [...townships, trimmedTownship]
    onChange(newTownships)
    setInputValue('')
  }

  const removeTownship = (townshipToRemove: string) => {
    const newTownships = townships.filter(township => township !== townshipToRemove)
    onChange(newTownships)
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
        addTownship(value)
      }
    } else if (e.key === 'Backspace' && !inputValue && townships.length > 0) {
      // Remove last township if input is empty and backspace is pressed
      removeTownship(townships[townships.length - 1])
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
        {/* Township Tags */}
        <div className="flex flex-wrap gap-2 mb-2">
          {townships.map((township, index) => (
            <CityTag
              key={`${township}-${index}`}
              city={township}
              onRemove={removeTownship}
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
            placeholder={townships.length === 0 ? placeholder : 'Add another township...'}
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
          {townships.length > 0 
            ? `${townships.length}/${maxTownships} townships selected. Type township names for suggestions or press Enter to add.`
            : isLoaded 
              ? 'Start typing township names to see suggestions from Google Places.'
              : 'Type township names and press Enter or comma to add them.'
          }
        </p>
      )}
    </div>
  )
}
