'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'

export default function InfoTooltip({ text, className = '' }: { text: string; className?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('click', handleClickAway)
    return () => document.removeEventListener('click', handleClickAway)
  }, [isOpen])

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          setIsOpen(v => !v)
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition hover:text-[#C9A24D]"
        aria-label="More info"
      >
        <Info size={13} />
      </button>
      {isOpen && (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1f] p-3 text-left text-[11px] font-semibold normal-case leading-relaxed text-gray-600 dark:text-gray-300 shadow-xl">
          {text}
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1c1c1f]" />
        </div>
      )}
    </div>
  )
}
