'use client'

import { Collection } from '@/types'
import { X, AlertTriangle } from 'lucide-react'

interface DeleteConfirmationModalProps {
  collection: Collection | null
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
}

export default function DeleteConfirmationModal({
  collection,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false
}: DeleteConfirmationModalProps) {
  if (!isOpen || !collection) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/60 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Delete Collection</h2>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100/50 rounded-lg disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            {/* Collection Info */}
            <div className="bg-gray-50/60 rounded-xl p-4 border border-gray-200/40">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {collection.customer.firstName.charAt(0)}{collection.customer.lastName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {collection.customer.firstName} {collection.customer.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{collection.customer.email}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Properties:</span>
                  <span className="text-gray-900 ml-2">{collection.stats.totalProperties}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span className={`ml-2 ${
                    collection.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {collection.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="text-center space-y-2">
              <p className="text-gray-900 font-medium">
                Are you sure you want to delete this collection?
              </p>
              <p className="text-sm text-gray-600">
                All associated data including property interactions, comments, and preferences will be permanently removed.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 disabled:opacity-50"
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
              <span>Delete Collection</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}