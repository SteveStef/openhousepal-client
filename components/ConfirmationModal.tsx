'use client'

import { ReactNode } from 'react'
import OhSheet from '@/components/open-house-manager/OhSheet'

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
  /** Extra content rendered between the message and the action buttons - e.g. the IDX domain
   * notice on a "switch to IDX" confirmation, so it doesn't need its own separate modal. */
  children?: ReactNode
}

/** "Are you sure?" - a sheet that slides up on a phone (scrolls inside, buttons pinned above the home
 *  bar, pull down to close) and a centred window on a computer (owner, 11/11: the Cancel Plan window
 *  couldn't scroll on an iPhone). Same props as before, so every caller gets it. */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'bg-[#111827] hover:bg-[#C9A24D] text-white shadow-lg hover:shadow-[#C9A24D]/30',
  isLoading = false,
  children
}: ConfirmationModalProps) {
  const close = () => { if (!isLoading) onClose() }
  return (
    <OhSheet open={isOpen} onClose={close} width="max-w-lg" zClass="z-[130]"
      title={<span className="block whitespace-normal leading-snug">{title}</span>}
      footer={
        <div className="flex gap-3 max-sm:flex-col-reverse">
          <button
            onClick={close}
            disabled={isLoading}
            className="min-h-[48px] flex-1 rounded-2xl border border-gray-200 bg-white px-5 text-sm font-bold uppercase tracking-widest text-[#6B7280] shadow-sm transition-colors hover:bg-gray-50 hover:text-[#111827] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`min-h-[48px] flex-1 rounded-2xl px-5 text-sm font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${confirmButtonClass}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-white/80" />
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      }>
      <p className="text-base font-medium leading-relaxed text-[#6B7280] dark:text-gray-300">{message}</p>
      {children && <div className="mt-4">{children}</div>}
    </OhSheet>
  )
}
