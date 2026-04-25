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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-[2rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-white/50 dark:border-gray-800">
        <div className="p-8 border-b border-gray-200/50 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/50">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mr-5 border border-red-100 dark:border-red-900/30 shadow-sm">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Remove Listing</h3>
              <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-1 font-medium tracking-tight">This action is permanent and cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-8">
            <p className="text-base font-bold text-[#0B0B0B] dark:text-white mb-2 px-4 py-2 bg-white dark:bg-[#0B0B0B] rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm inline-block">
              {openHouse.address}
            </p>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mt-4 font-light leading-relaxed">
              This listing and all associated visitor data will be removed from your dashboard.
            </p>
          </div>

          <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mr-3 mt-0.5 border border-red-100 dark:border-red-900/30">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-900 dark:text-red-400 mb-2 uppercase tracking-wider">Data Loss Warning</h4>
                <ul className="text-sm text-red-800/80 dark:text-red-500/80 space-y-2 font-medium">
                  <li>• Visitor logs will be permanently deleted</li>
                  <li>• QR codes will stop working</li>
                  <li>• This action cannot be reversed</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-6 py-3.5 bg-white dark:bg-[#0B0B0B] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#151515] transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-6 py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transform transition-all duration-300 shadow-[0_10px_20px_-5px_rgba(220,38,38,0.2)] active:scale-95 disabled:opacity-50"
            >
              {isDeleting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
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
