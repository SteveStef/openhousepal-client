'use client'

import { useState } from 'react'
import { Collection } from '@/types'
import { X, Copy, Share2, Check, RefreshCw } from 'lucide-react'

interface ShareCollectionModalProps {
  collection: Collection | null
  isOpen: boolean
  onClose: () => void
  onGenerateShareLink?: (collectionId: string) => void
  onRegenerateShareLink?: (collectionId: string) => void
  onUpdateShareSettings?: (collectionId: string, isPublic: boolean) => void
}

export default function ShareCollectionModal({
  collection,
  isOpen,
  onClose,
  onGenerateShareLink,
  onRegenerateShareLink,
  onUpdateShareSettings
}: ShareCollectionModalProps) {
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  if (!isOpen || !collection) return null

  const shareUrl = collection.shareToken 
    ? `${window.location.origin}/showcase/${collection.shareToken}`
    : null

  const handleCopyLink = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy link:', err)
      }
    }
  }

  const handleGenerateLink = async () => {
    setIsGenerating(true)
    try {
      onGenerateShareLink?.(collection.id)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerateLink = async () => {
    setIsGenerating(true)
    try {
      onRegenerateShareLink?.(collection.id)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTogglePublic = () => {
    onUpdateShareSettings?.(collection.id, !collection.isPublic)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not shared yet'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200/60 max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200/60">
          <div className="flex items-center space-x-3">
            <Share2 size={24} className="text-[#8b7355]" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Share Collection</h2>
              <p className="text-gray-600 text-sm">
                {collection.customer.firstName} {collection.customer.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100/50 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Collection Summary */}

          {/* Share Settings */}
          <div className="space-y-4">

            {collection.isPublic && (
              <div className="bg-[#8b7355]/20 border border-[#8b7355]/30 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Collection is publicly accessible</span>
                </div>
                <p className="text-gray-700 text-sm">
                  Customers can view their property collection, interact with properties (like/dislike/favorite), 
                  and add comments using the share link below.
                </p>
              </div>
            )}
          </div>

          {/* Share Link */}
          {collection.isPublic && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Share Link</h3>
              
              {shareUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <p className="text-gray-700 text-sm font-mono break-all">{shareUrl}</p>
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                        copied
                          ? 'bg-green-600 text-white'
                          : 'bg-[#8b7355] hover:bg-[#7a6549] text-white'
                      }`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Share this link with {collection.customer.firstName} to let them view their collection
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No share link generated yet</p>
                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-[#8b7355] hover:bg-[#7a6549] text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Share2 size={16} />
                        <span>Generate Share Link</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {!collection.isPublic && (
            <div className="bg-gray-50/60 border border-gray-200/60 rounded-xl p-4 text-center">
              <p className="text-gray-600">
                Enable public access to generate a share link for this collection
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-50/60 rounded-xl p-4 border border-gray-200/40">
            <h4 className="text-gray-900 font-medium mb-2">How it works</h4>
            <ul className="text-gray-700 text-sm space-y-1">
              <li>• Customer clicks the share link (no login required)</li>
              <li>• They can view their personalized property collection</li>
              <li>• Customer can like/dislike properties and add comments</li>
              <li>• All interactions sync back to your collections dashboard</li>
              <li>• Perfect for follow-up and engagement tracking</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200/60 p-6">
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Close
            </button>
            {collection.isPublic && shareUrl && (
              <button
                onClick={handleCopyLink}
                className="px-6 py-2 bg-[#8b7355] hover:bg-[#7a6549] text-white rounded-lg font-medium transition-all duration-200"
              >
                Copy Share Link
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
