'use client'

import MotionModal from '@/components/ui/MotionModal'
import { useLastValue } from '@/components/ui/windowMotion'
import { Collection } from '@/types'
import { X, AlertTriangle } from 'lucide-react'

interface DeleteConfirmationModalProps {
  collection: Collection | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
  // Open follow-ups that only exist because of this Showcase - they go with it.
  alsoRemoves?: string[] | null
}

export default function DeleteConfirmationModal({
  collection: collectionProp,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  alsoRemoves = null
}: DeleteConfirmationModalProps) {
  const collection = useLastValue(collectionProp)
  if (!collection) return null

  return (
    <MotionModal open={isOpen && !!collectionProp}>
      <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-800 max-w-md w-full transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/60 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Delete Showcase</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors p-2 hover:bg-gray-100/50 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Collection Info */}
            <div className="bg-gray-50/60 dark:bg-[#0B0B0B] rounded-xl p-4 border border-gray-200/40 dark:border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {collection.customer.firstName.charAt(0)}{collection.customer.lastName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {collection.customer.firstName} {collection.customer.lastName}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{collection.customer.email}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Properties:</span>
                  <span className="text-gray-900 dark:text-white ml-2">{collection.stats.totalProperties}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`ml-2 ${
                    collection.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {collection.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="text-center space-y-2">
              <p className="text-gray-900 dark:text-white font-medium">
                Are you sure you want to delete this Showcase?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Its homes, likes, comments and search will be permanently removed. {collection.customer.firstName} stays in your Leads.
              </p>
            </div>
            {!!alsoRemoves?.length && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-3 text-sm text-amber-900 dark:text-amber-300">
                <p className="font-semibold">
                  This also removes {alsoRemoves.length === 1 ? '1 open follow-up' : `${alsoRemoves.length} open follow-ups`} about their Showcase:
                </p>
                <ul className="mt-1 list-disc pl-5 text-[13px]">
                  {alsoRemoves.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
                <p className="mt-1 text-[12px] text-amber-800/80 dark:text-amber-400/80">Their other follow-ups stay.</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200/60 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-lg transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Showcase</span>
            )}
          </button>
        </div>
      </div>
    </MotionModal>
  )
}