'use client'

import { useState } from 'react'
import { Collection } from '@/types'
import { X, Copy, Share2, Check, RefreshCw } from 'lucide-react'

interface ShareCollectionModalProps {
  collection: Collection | null
  isOpen: boolean
  onClose: () => void
  onGenerateShareLink?: (collectionId: number) => void
  onUpdateShareSettings?: (collectionId: number, isPublic: boolean) => void
}

export default function ShareCollectionModal({
  collection,
  isOpen,
  onClose,
  onGenerateShareLink,
  onUpdateShareSettings
}: ShareCollectionModalProps) {
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  if (!isOpen || !collection) return null

  const shareUrl = collection.shareToken 
    ? `${window.location.origin}/collection/${collection.shareToken}`
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800/60 max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/40">
          <div className="flex items-center space-x-3">
            <Share2 size={24} className="text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Share Collection</h2>
              <p className="text-zinc-400 text-sm">
                {collection.customer.firstName} {collection.customer.lastName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800/50 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Collection Summary */}
          <div className="bg-zinc-800/20 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-white mb-3">Collection Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-400">Properties:</span>
                <span className="text-white ml-2">{collection.stats.totalProperties}</span>
              </div>
              <div>
                <span className="text-zinc-400">Status:</span>
                <span className={`ml-2 ${
                  collection.status === 'ACTIVE' ? 'text-green-400' : 
                  collection.status === 'PAUSED' ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {collection.status}
                </span>
              </div>
              <div>
                <span className="text-zinc-400">Last Activity:</span>
                <span className="text-white ml-2">
                  {collection.stats.lastActivity 
                    ? new Date(collection.stats.lastActivity).toLocaleDateString()
                    : 'Never'
                  }
                </span>
              </div>
              <div>
                <span className="text-zinc-400">Shared:</span>
                <span className="text-white ml-2">{formatDate(collection.sharedAt)}</span>
              </div>
            </div>
          </div>

          {/* Share Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Public Access</h3>
                <p className="text-zinc-400 text-sm">Allow customer to view their collection via share link</p>
              </div>
              <button
                onClick={handleTogglePublic}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
                  collection.isPublic ? 'bg-blue-600' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    collection.isPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {collection.isPublic && (
              <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400 text-sm font-medium">Collection is publicly accessible</span>
                </div>
                <p className="text-zinc-300 text-sm">
                  Customers can view their property collection, interact with properties (like/dislike/favorite), 
                  and add comments using the share link below.
                </p>
              </div>
            )}
          </div>

          {/* Share Link */}
          {collection.isPublic && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Share Link</h3>
              
              {shareUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2">
                      <p className="text-zinc-300 text-sm font-mono break-all">{shareUrl}</p>
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                        copied
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">
                      Share this link with {collection.customer.firstName} to let them view their collection
                    </span>
                    <button
                      onClick={handleGenerateLink}
                      disabled={isGenerating}
                      className="text-blue-400 hover:text-blue-300 transition-colors flex items-center space-x-1"
                    >
                      <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-zinc-400 mb-4">No share link generated yet</p>
                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto"
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
            <div className="bg-zinc-800/20 border border-zinc-700/30 rounded-xl p-4 text-center">
              <p className="text-zinc-400">
                Enable public access to generate a share link for this collection
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-zinc-800/20 rounded-xl p-4">
            <h4 className="text-white font-medium mb-2">How it works</h4>
            <ul className="text-zinc-300 text-sm space-y-1">
              <li>• Customer clicks the share link (no login required)</li>
              <li>• They can view their personalized property collection</li>
              <li>• Customer can like/dislike properties and add comments</li>
              <li>• All interactions sync back to your collections dashboard</li>
              <li>• Perfect for follow-up and engagement tracking</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800/40 p-6">
          <div className="flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
            {collection.isPublic && shareUrl && (
              <button
                onClick={handleCopyLink}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200"
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