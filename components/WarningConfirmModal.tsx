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
  showCloseButton?: boolean
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
  showCloseButton = true,
}: WarningConfirmModalProps) {
  if (!isOpen) return null

  const handleClose = (event?: React.MouseEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!isLoading) onClose()
  }

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) handleClose(event)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={handleBackdropClick}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl dark:border-red-900/30 dark:bg-[#151517]">
        <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-red-500/10" />
        {showCloseButton && (
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="absolute right-3 top-3 z-10 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="relative p-5">
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 shadow-sm dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black tracking-tight text-[#111827] dark:text-white">{title}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium leading-relaxed text-gray-600 dark:text-gray-300">{message}</p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300 dark:hover:border-gray-600"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
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
