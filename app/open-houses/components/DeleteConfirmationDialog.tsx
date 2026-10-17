'use client'

import { memo } from 'react'
import { OpenHouse } from '@/types'

interface DeleteConfirmationDialogProps {
  openHouse: OpenHouse
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

export const DeleteConfirmationDialog = memo(function DeleteConfirmationDialog({
  openHouse,
  onConfirm,
  onCancel,
  isDeleting
}: DeleteConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 sm:p-4" onTouchMove={e => e.stopPropagation()}>
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/50 bg-[#FAFAF7] shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
        <div className="border-b border-gray-200/50 bg-white/50 p-5 sm:p-8 dark:border-gray-800 dark:bg-[#0B0B0B]/50">
          <div className="flex items-center">
            <div className="mr-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-100 sm:mr-5 sm:h-12 sm:w-12 bg-red-50 shadow-sm dark:border-red-900/30 dark:bg-red-900/20">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-[#0B0B0B] sm:text-2xl dark:text-white">Remove Listing</h3>
              <p className="mt-1 text-sm font-medium tracking-tight text-[#6B7280] dark:text-gray-400">This removes it from the Open House tab</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-8">
          <div className="mb-5 sm:mb-8">
            <p className="mb-2 inline-block rounded-xl border border-gray-100 bg-white px-4 py-2 text-base font-bold text-[#0B0B0B] shadow-sm dark:border-gray-800 dark:bg-[#0B0B0B] dark:text-white">
              {openHouse.address}
            </p>
            <p className="mt-4 text-sm font-light leading-relaxed text-[#6B7280] dark:text-gray-400">
              This listing will be removed from your Open House tab. Visitor contacts, sign-in history, notes, QR links, and similar-property pages stay saved.
            </p>
          </div>

          <div className="mb-5 sm:mb-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm dark:border-emerald-900/30 dark:bg-emerald-900/10 max-sm:p-4">
            <div className="flex items-start">
              <div className="mr-3 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/20">
                <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">Lead Data Is Preserved</h4>
                <ul className="space-y-2 text-sm font-medium text-emerald-800/80 dark:text-emerald-500/80">
                  <li>- Visitor contact cards remain in Leads</li>
                  <li>- Notes stay attached to the matching lead</li>
                  <li>- This open house remains available as a past-open filter in Leads</li>
                  <li>- QR links and similar-property pages keep working for visitors</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-5 sm:mb-8 rounded-2xl border border-red-100 bg-red-50/70 p-6 shadow-sm dark:border-red-900/30 dark:bg-red-900/10 max-sm:p-4">
            <div className="flex items-start">
              <div className="mr-3 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20">
                <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-wider text-red-900 dark:text-red-400">Open House Tab Data Loss</h4>
                <ul className="space-y-2 text-sm font-medium text-red-800/80 dark:text-red-500/80">
                  <li>- The listing card will be removed from the Open House tab.</li>
                  <li>- Open house kit PDFs will be removed from this tab.</li>
                  <li>- Recreate the open house if you need a new editable kit.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-row gap-3 border-t border-gray-200/60 bg-[#FAFAF7] p-4 dark:border-gray-800 dark:bg-[#151517] sm:static sm:m-0 sm:border-0 sm:bg-transparent sm:p-0 sm:dark:bg-transparent">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-6 py-3.5 font-bold text-[#111827] transition-all duration-200 active:scale-95 disabled:opacity-50 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white dark:hover:bg-[#151515]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-red-600 px-6 py-3.5 font-bold text-white shadow-[0_10px_20px_-5px_rgba(220,38,38,0.2)] transition-all duration-300 active:scale-95 disabled:opacity-50 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Removing...
                </div>
              ) : (
                'Remove Listing'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})
