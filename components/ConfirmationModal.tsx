'use client'

import { X } from 'lucide-react'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmButtonClass?: string
  isLoading?: boolean
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'bg-[#111827] hover:bg-[#C9A24D] text-white shadow-lg hover:shadow-[#C9A24D]/30',
  isLoading = false
}: ConfirmationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#111827]/40 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#FAFAF7] rounded-[2rem] shadow-2xl max-w-lg w-full p-8 border border-white">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-6 right-6 text-gray-400 hover:text-[#111827] transition-colors disabled:opacity-50 p-2 hover:bg-white rounded-full shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h3 className="text-2xl font-black text-[#111827] mb-4 pr-8 tracking-tight">
          {title}
        </h3>

        {/* Message */}
        <p className="text-[#6B7280] mb-8 font-medium leading-relaxed text-base">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-6 py-4 bg-white border border-gray-200 text-[#6B7280] rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-50 hover:text-[#111827] hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-6 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${confirmButtonClass}`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/80"></div>
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}