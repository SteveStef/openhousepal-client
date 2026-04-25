'use client'

import { memo } from 'react'
import { OpenHouse } from '@/types'

interface OpenHouseNoteModalProps {
  isOpen: boolean
  onClose: () => void
  openHouse: OpenHouse | null
  notes: string
  onNotesChange: (notes: string) => void
  onSave: () => void
}

export const OpenHouseNoteModal = memo(function OpenHouseNoteModal({
  isOpen,
  onClose,
  openHouse,
  notes,
  onNotesChange,
  onSave
}: OpenHouseNoteModalProps) {
  if (!isOpen || !openHouse) return null

  return (
    <div className="fixed inset-0 bg-[#111827]/60 z-50 flex items-center justify-center p-4 transition-all duration-300 print:hidden">
      <div className="bg-white dark:bg-[#151517] rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-lg w-full overflow-hidden transform transition-all">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#faf9f7] dark:bg-[#0B0B0B]">
          <div>
            <h3 className="text-lg font-black text-[#0B0B0B] dark:text-white tracking-tight">Open House Note</h3>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              For {openHouse.address}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1">
              Note Content
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="block w-full px-4 py-3 bg-[#faf9f7] dark:bg-[#0B0B0B] border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-[#C9A24D]/10 focus:border-[#C9A24D] transition-all duration-200 resize-none font-medium"
              rows={6}
              placeholder="Enter notes about this open house (e.g., weather, turnout, specific feedback)..."
              autoFocus
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white dark:bg-transparent border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl transition-all duration-200 text-xs uppercase tracking-wide"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-6 py-2.5 bg-[#151517] dark:bg-white hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] text-white dark:text-[#111827] font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 text-xs uppercase tracking-wide"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
