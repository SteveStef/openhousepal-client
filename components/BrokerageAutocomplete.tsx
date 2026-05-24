'use client'

import { useState, useRef, useEffect } from 'react'
import api from '@/lib/api-service'

interface BrokerageAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onValidationChange?: (isValid: boolean) => void
  error?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function BrokerageAutocomplete({
  value,
  onChange,
  onBlur,
  onValidationChange,
  error = false,
  placeholder = 'Search brokerage...',
  className = '',
  disabled = false
}: BrokerageAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  
  // Use Refs for the source of truth
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const lastSelectedRef = useRef(value)
  const suggestionsCacheRef = useRef<string[]>([])

  // Keep internal input value in sync with external value
  useEffect(() => {
    setInputValue(value)
    // If the value was set externally (e.g. from a valid selection), update our ref
    if (value && (suggestionsCacheRef.current.includes(value) || value === lastSelectedRef.current)) {
      lastSelectedRef.current = value
      if (onValidationChange) onValidationChange(true)
    }
  }, [value, onValidationChange])

  // Fetch suggestions from our internal API
  useEffect(() => {
    const fetchSuggestions = async () => {
      const query = inputValue.trim()
      if (query.length < 1 || !showSuggestions) {
        setSuggestions([])
        suggestionsCacheRef.current = []
        return
      }

      setIsLoading(true)
      try {
        const response = await api.properties.brokerages(query)
        if (response.success && response.data) {
          const results = response.data.results as unknown as string[]
          setSuggestions(results)
          suggestionsCacheRef.current = results
          
          // Check if the current input is valid (matches a suggestion)
          const isValid = results.some(s => s.toLowerCase() === query.toLowerCase()) || 
                         !!(lastSelectedRef.current && lastSelectedRef.current.toLowerCase() === query.toLowerCase())
          if (onValidationChange) onValidationChange(isValid)
        }
      } catch (err) {
        console.error('Failed to fetch brokerages:', err)
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchSuggestions, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [inputValue, showSuggestions, onValidationChange])

  const selectBrokerage = (name: string) => {
    onChange(name)
    setInputValue(name)
    lastSelectedRef.current = name
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedIndex(-1)
    if (onValidationChange) onValidationChange(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setShowSuggestions(true)
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      if (showSuggestions && selectedIndex >= 0) {
        e.preventDefault()
        selectBrokerage(suggestions[selectedIndex])
      } else if (showSuggestions && suggestions.length > 0 && inputValue) {
        const exactMatch = suggestions.find(s => s.toLowerCase() === inputValue.toLowerCase())
        if (exactMatch) {
          e.preventDefault()
          selectBrokerage(exactMatch)
        }
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) && 
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleBlur = () => {
    // Delay slightly to see if a click was just made on a suggestion
    setTimeout(() => {
      const currentVal = inputRef.current?.value || ''
      const trimmedInput = currentVal.trim()
      
      if (trimmedInput) {
        // Find if there is a case-insensitive match in our cache or last selected
        const match = suggestionsCacheRef.current.find(s => s.toLowerCase() === trimmedInput.toLowerCase()) || 
                     (lastSelectedRef.current && lastSelectedRef.current.toLowerCase() === trimmedInput.toLowerCase() ? lastSelectedRef.current : null)
        
        if (match) {
          // It's a valid match! 
          // If the casing is different, standardize it now.
          if (match !== currentVal) {
            setInputValue(match)
            onChange(match)
            lastSelectedRef.current = match
          }
          if (onValidationChange) onValidationChange(true)
        } else {
          // Not a match in current cache, but it might be valid if it matches the parent 'value'
          const isValid = !!(lastSelectedRef.current && lastSelectedRef.current.toLowerCase() === trimmedInput.toLowerCase())
          if (onValidationChange) onValidationChange(isValid)
        }
      }
      
      if (onBlur) onBlur()
      setShowSuggestions(false)
    }, 250)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            const newVal = e.target.value
            setInputValue(newVal)
            onChange(newVal)
            setShowSuggestions(true)
            
            // Proactively check if it's already a match
            const isValid = suggestionsCacheRef.current.some(s => s.toLowerCase() === newVal.toLowerCase().trim()) ||
                           !!(lastSelectedRef.current && lastSelectedRef.current.toLowerCase() === newVal.toLowerCase().trim())
            if (onValidationChange) onValidationChange(isValid)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`block w-full px-3 py-2.5 bg-[#FAFAF7] dark:bg-[#0B0B0B] border focus:bg-white dark:focus:bg-[#111827] rounded-xl text-[#0B0B0B] dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 font-medium text-sm ${
            error 
              ? 'border-red-300 focus:ring-red-200 focus:border-red-400 bg-red-50/30' 
              : 'border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-[#111827] hover:border-[#C9A24D]/30'
          }`}
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-[#C9A24D]"></div>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-[100] w-full mt-1 bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
        >
          {suggestions.map((name, index) => (
            <div
              key={name}
              onMouseDown={(e) => {
                // Prevent the input from blurring before we can select
                e.preventDefault()
                selectBrokerage(name)
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`
                px-4 py-3 cursor-pointer text-sm transition-colors
                ${index === selectedIndex ? 'bg-[#C9A24D]/10 text-[#C9A24D]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1A1A1C]'}
              `}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
