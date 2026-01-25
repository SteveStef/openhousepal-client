'use client'

import { useState } from 'react'
import { Collection } from '@/types'
import { X, Copy, Share2, Check, RefreshCw, Globe, ShieldCheck } from 'lucide-react'

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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-50 bg-white">
          <div className="flex items-center space-x-4">
            <div className="bg-[#111827] p-3 rounded-2xl shadow-md">
              <Share2 size={24} className="text-[#C9A24D]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#0B0B0B] tracking-tight">Share Showcase</h2>
              <p className="text-[#6B7280] font-medium text-sm mt-0.5">
                Client: <span className="text-[#111827] font-bold">{collection.customer.firstName} {collection.customer.lastName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#111827] transition-all p-2 hover:bg-gray-50 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-[#FAFAF7]">
          {/* Status Alert */}
          {collection.isPublic ? (
            <div className="bg-white border border-green-100 rounded-2xl p-6 shadow-sm flex items-start space-x-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-green-700 uppercase tracking-widest mb-1">Link is Active</h4>
                <p className="text-sm text-[#6B7280] font-medium leading-relaxed">
                  Anyone with the link can view and interact with this personalized property collection. Interactions will sync to your dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-start space-x-4">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-[#6B7280] uppercase tracking-widest mb-1">Link Inactive</h4>
                <p className="text-sm text-[#6B7280] font-medium leading-relaxed mb-4">
                  Enable public access to generate a secure share link for this customer.
                </p>
                <button
                  onClick={handleTogglePublic}
                  className="px-4 py-2 bg-[#111827] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#C9A24D] transition-all shadow-md"
                >
                  Enable Access
                </button>
              </div>
            </div>
          )}

          {/* Share Link Input */}
          {collection.isPublic && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0B0B0B] uppercase tracking-[0.2em] ml-1">Secure Share Link</h3>
              
              {shareUrl ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch gap-3">
                    <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3.5 shadow-sm group hover:border-[#C9A24D]/30 transition-all">
                      <p className="text-[#111827] text-sm font-mono break-all">{shareUrl}</p>
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className={`px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg ${
                        copied
                          ? 'bg-green-600 text-white'
                          : 'bg-[#111827] text-white hover:bg-[#C9A24D] hover:scale-[1.02]'
                      }`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-[#6B7280] font-medium italic">
                      Share this link via text or email to engage your client.
                    </p>
                    <button 
                      onClick={handleRegenerateLink}
                      disabled={isGenerating}
                      className="text-[10px] font-black text-[#6B7280] hover:text-[#111827] uppercase tracking-widest transition-colors flex items-center"
                    >
                      <RefreshCw size={10} className={`mr-1.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      Regenerate Link
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="px-8 py-4 bg-[#111827] text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 flex items-center space-x-2 mx-auto shadow-lg hover:bg-[#C9A24D] hover:scale-[1.02]"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Share2 size={16} />
                        <span>Generate Active Link</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Feature Box */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h4 className="text-[10px] font-black text-[#0B0B0B] uppercase tracking-[0.2em] mb-4">How Showcases Work</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                'Instant access (no login required)',
                'Personalized recommendations',
                'Real-time interaction sync',
                'Engagement tracking metrics'
              ].map((text, i) => (
                <div key={i} className="flex items-center text-xs text-[#6B7280] font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C9A24D] mr-2"></div>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-50 p-6 sm:p-8 bg-white sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full px-6 py-4 bg-gray-50 text-[#6B7280] hover:text-[#111827] hover:bg-gray-100 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
