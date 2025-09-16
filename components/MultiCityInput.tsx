'use client'

import { useState, KeyboardEvent, useRef } from 'react'
import CityTag from './CityTag'

interface MultiCityInputProps {
  cities: string[]
  onChange: (cities: string[]) => void
  placeholder?: string
  maxCities?: number
  className?: string
  disabled?: boolean
}

export default function MultiCityInput({
  cities,
  onChange,
  placeholder = 'Type city name and press Enter...',
  maxCities = 10,
  className = '',
  disabled = false
}: MultiCityInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateCityName = (city: string): boolean => {
    // Basic validation: non-empty, letters/spaces/hyphens only, reasonable length
    const trimmed = city.trim()
    if (!trimmed) return false
    if (trimmed.length < 2 || trimmed.length > 50) return false
    if (!/^[a-zA-Z\s\-'\.]+$/.test(trimmed)) return false
    return true
  }

  const addCity = (cityName: string) => {
    const trimmedCity = cityName.trim()
    setError(null)

    // Validate city name
    if (!validateCityName(trimmedCity)) {
      setError('Please enter a valid city name (letters, spaces, and hyphens only)')
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
          transition-all duration-300 cursor-text
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

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={cities.length === 0 ? placeholder : 'Add another city...'}
          disabled={disabled}
          className="w-full border-none outline-none bg-transparent text-gray-900 placeholder-gray-400 min-w-[200px]"
        />
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
            ? `${cities.length}/${maxCities} cities selected. Press Enter or comma to add cities.`
            : 'Type city names and press Enter or comma to add them.'
          }
        </p>
      )}
    </div>
  )
}