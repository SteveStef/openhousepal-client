'use client'

import { AlertTriangle, X } from 'lucide-react'

interface WarningConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
}

export default function WarningConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Yes, change it",
  cancelText = 'Cancel',
  isLoading = false,
}: WarningConfirmModalProps) {
  if (!isOpen) return null

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={handleBackdropClick}>
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-red-100 bg-white shadow-2xl dark:border-red-900/30 dark:bg-[#151517]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-red-500/10" />
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute right-5 top-5 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative p-7">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 shadow-sm dark:bg-red-900/20 dark:text-red-400">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h3 className="mt-5 text-xl font-black tracking-tight text-[#111827] dark:text-white">{title}</h3>
          <p className="mt-3 text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">{message}</p>

          <div className="mt-7 flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300 dark:hover:border-gray-600"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                </span>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
