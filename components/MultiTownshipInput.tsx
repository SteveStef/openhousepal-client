'use client'

import { useState, KeyboardEvent, useRef } from 'react'
import CityTag from './CityTag'

interface MultiTownshipInputProps {
  townships: string[]
  onChange: (townships: string[]) => void
  placeholder?: string
  maxTownships?: number
  className?: string
  disabled?: boolean
}

export default function MultiTownshipInput({
  townships,
  onChange,
  placeholder = 'Type township name and press Enter...',
  maxTownships = 10,
  className = '',
  disabled = false
}: MultiTownshipInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateTownshipName = (township: string): boolean => {
    // Basic validation: non-empty, letters/spaces/hyphens only, reasonable length
    const trimmed = township.trim()
    if (!trimmed) return false
    if (trimmed.length < 2 || trimmed.length > 50) return false
    if (!/^[a-zA-Z\s\-'\.]+$/.test(trimmed)) return false
    return true
  }

  const addTownship = (townshipName: string) => {
    const trimmedTownship = townshipName.trim()
    setError(null)

    // Validate township name
    if (!validateTownshipName(trimmedTownship)) {
      setError('Please enter a valid township name (letters, spaces, and hyphens only)')
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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
          transition-all duration-300 cursor-text
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

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={townships.length === 0 ? placeholder : 'Add another township...'}
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
          {townships.length > 0 
            ? `${townships.length}/${maxTownships} townships selected. Press Enter or comma to add townships.`
            : 'Type township names and press Enter or comma to add them.'
          }
        </p>
      )}
    </div>
  )
}