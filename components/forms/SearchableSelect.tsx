'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  accent?: string
}

// Typeable/filterable single-select combobox for long static option lists (e.g. US states) -
// filters `options` locally as you type, no backend call needed. Used in place of FormRunner's
// default button-grid rendering for 'select' questions marked `searchable: true`.
export default function SearchableSelect({ value, onChange, options, placeholder = 'Type to search...', accent = '#816937' }: SearchableSelectProps) {
  const [query, setQuery] = useState(value || '')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  const filtered = query.trim()
    ? options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setQuery(value || '')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  const selectOption = (option: string) => {
    onChange(option)
    setQuery(option)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex(prev => Math.max(prev - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (highlightedIndex >= 0 && filtered[highlightedIndex]) {
        selectOption(filtered[highlightedIndex])
      } else if (filtered.length === 1) {
        selectOption(filtered[0])
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setQuery(value || '')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={event => {
            setQuery(event.target.value)
            setIsOpen(true)
            setHighlightedIndex(-1)
            if (event.target.value === '') onChange('')
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 pr-11 text-base font-bold text-[#0B0B0B] outline-none transition-all focus:border-current dark:border-gray-700 dark:bg-[#151517] dark:text-white"
          style={{ caretColor: accent }}
        />
        <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-[100] mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
          {filtered.map((option, index) => {
            const selected = option === value
            return (
              <div
                key={option}
                onMouseDown={event => {
                  event.preventDefault()
                  selectOption(option)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex cursor-pointer items-center justify-between px-4 py-3 text-left text-sm font-bold transition-colors ${
                  index === highlightedIndex ? 'bg-gray-50 dark:bg-[#1A1A1C]' : ''
                } text-gray-700 dark:text-gray-300`}
                style={selected ? { color: accent } : undefined}
              >
                {option}
                {selected && <Check className="h-4 w-4 shrink-0" style={{ color: accent }} />}
              </div>
            )
          })}
        </div>
      )}

      {isOpen && filtered.length === 0 && (
        <div className="absolute z-[100] mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-400 shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
          No matches
        </div>
      )}
    </div>
  )
}
