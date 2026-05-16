'use client'

import { useState, useRef, useEffect } from 'react'
import CityTag from './CityTag'
import { ApiResponse } from '@/types'

interface MultiSelectDatabaseInputProps {
  values: string[]
  onChange: (values: string[]) => void
  apiMethod: (query: string) => Promise<ApiResponse<{ results: string[] }>>
  placeholder?: string
  maxItems?: number
  className?: string
  disabled?: boolean
}

export default function MultiSelectDatabaseInput({
  values,
  onChange,
  apiMethod,
  placeholder = 'Type to search...',
  maxItems = 50,
  className = '',
  disabled = false
}: MultiSelectDatabaseInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Helper to convert "UPPERCASE NAME, ST" to "Title Case Name, ST" for the UI tags
  const formatDisplayName = (name: string) => {
    if (!name) return ''
    const parts = name.split(',')
    const mainName = parts[0].toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    const state = parts[1] ? `, ${parts[1].trim().toUpperCase()}` : ''
    return `${mainName}${state}`
  }

  // Fetch suggestions from the provided API method
  useEffect(() => {
    const fetchSuggestions = async () => {
      const query = inputValue.trim()
      if (query.length < 2) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      try {
        const response = await apiMethod(query)
        if (response.success && response.data) {
          // Filter out already selected items
          const filtered = response.data.results.filter((item: string) => !values.includes(item))
          setSuggestions(filtered)
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err)
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchSuggestions, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [inputValue, values, apiMethod])

  const addItem = (name: string) => {
    if (!values.includes(name) && values.length < maxItems) {
      onChange([...values, name])
    }
    setInputValue('')
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  const removeItem = (nameToRemove: string) => {
    onChange(values.filter(v => v !== nameToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0) {
        addItem(suggestions[selectedIndex])
      } else if (suggestions.length > 0) {
        addItem(suggestions[0])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      removeItem(values[values.length - 1])
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

  return (
    <div className={`relative ${className}`}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={`
          min-h-[42px] w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl
          focus-within:outline-none focus-within:ring-2 focus-within:ring-[#8b7355] dark:focus-within:ring-[#C9A24D]/20 focus-within:border-[#8b7355] dark:focus-within:border-[#C9A24D]
          transition-all duration-300 cursor-text relative
          ${disabled ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : 'bg-white dark:bg-[#0B0B0B] hover:border-gray-400 dark:hover:border-gray-600'}
        `}
      >
        <div className="flex flex-wrap gap-2 mb-1">
          {values.map((val, index) => (
            <CityTag
              key={`${val}-${index}`}
              city={formatDisplayName(val)}
              onRemove={() => removeItem(val)}
            />
          ))}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          placeholder={values.length === 0 ? placeholder : 'Add another...'}
          disabled={disabled}
          className="w-full border-none outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 min-w-[200px]"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-[#8b7355]"></div>
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
                e.preventDefault() // Prevent blur before selection
                addItem(name)
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`
                px-4 py-3 text-left cursor-pointer text-sm transition-colors
                ${index === selectedIndex ? 'bg-[#8b7355]/10 dark:bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#C9A24D]' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1A1A1C]'}
              `}
            >
              {formatDisplayName(name)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
