'use client'

import { showcaseLinkPath } from '@/lib/showcaseLink'
import MotionModal from '@/components/ui/MotionModal'
import { useLastValue } from '@/components/ui/windowMotion'
import { useState } from 'react'
import { Collection } from '@/types'
import { X, Copy, Share2, Check, RefreshCw, Globe, ShieldCheck } from 'lucide-react'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'
import { copyText } from '@/lib/copyText'

interface ShareCollectionModalProps {
  collection: Collection | null
  isOpen: boolean
  onClose: () => void
  openHousePalUrl?: string | null
  websiteUrl?: string | null
  onGenerateShareLink?: (collectionId: string) => void
  onUpdateShareSettings?: (collectionId: string, isPublic: boolean) => void
}

export default function ShareCollectionModal({
  collection: collectionProp,
  isOpen,
  onClose,
  openHousePalUrl,
  websiteUrl,
  onGenerateShareLink,
  onUpdateShareSettings
}: ShareCollectionModalProps) {
  const [copied, setCopied] = useState<'ohp' | 'website' | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const collection = useLastValue(collectionProp)
  if (!collection) return null

  const shareUrl = collection.shareToken
    ? openHousePalUrl || openHousePalPublicUrl(showcaseLinkPath(collection))
    : null

  const handleCopyLink = async (url: string, key: 'ohp' | 'website') => {
    if (url) {
      try {
        await copyText(url)
        setCopied(key)
        setTimeout(() => setCopied(current => (current === key ? null : current)), 2000)
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

  return (
    <MotionModal open={isOpen && !!collectionProp} className="bg-black/60">
      <div className="bg-white dark:bg-[#151517] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-50 dark:border-gray-800 bg-white dark:bg-[#151517]">
          <div className="flex items-center space-x-4">
            <div className="bg-[#111827] dark:bg-white p-3 rounded-2xl shadow-md">
              <Share2 size={24} className="text-[#C9A24D]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#0B0B0B] dark:text-white tracking-tight">Share Showcase</h2>
              <p className="text-[#6B7280] dark:text-gray-400 font-medium text-sm mt-0.5">
                Client: <span className="text-[#111827] dark:text-white font-bold">{collection.customer.firstName} {collection.customer.lastName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-[#111827] dark:hover:text-white transition-all p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 bg-[#FAFAF7] dark:bg-[#0B0B0B]">
          {/* Status Alert */}
          {collection.isPublic ? (
            <div className="bg-white dark:bg-[#151517] border border-green-100 dark:border-green-900/30 rounded-2xl p-6 shadow-sm flex items-start space-x-4">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="text-xs font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-1">Link is Active</h4>
                <p className="text-sm text-[#6B7280] dark:text-gray-400 font-medium leading-relaxed">
                  Anyone with the link can view and interact with this personalized property collection. Interactions will sync to your dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#151517] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex items-start space-x-4">
              <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-black text-[#6B7280] dark:text-gray-400 uppercase tracking-widest mb-1">Link Inactive</h4>
                <p className="text-sm text-[#6B7280] dark:text-gray-400 font-medium leading-relaxed mb-4">
                  Enable public access to generate a secure share link for this customer.
                </p>
                <button
                  onClick={handleTogglePublic}
                  className="px-4 py-2 bg-[#111827] dark:bg-white text-white dark:text-[#111827] text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] transition-all shadow-md"
                >
                  Enable Access
                </button>
              </div>
            </div>
          )}

          {/* Share Link Input */}
          {collection.isPublic && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0B0B0B] dark:text-white uppercase tracking-[0.2em] ml-1">Secure Share Links</h3>
              
              {shareUrl ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B7280] dark:text-gray-400">OpenHousePal Link</p>
                        <p className="mt-1 break-all font-mono text-[13px] text-[#111827] dark:text-white">{shareUrl}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                          className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-widest text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleCopyLink(shareUrl, 'ohp')}
                          className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                            copied === 'ohp'
                              ? 'bg-green-600 text-white'
                              : 'bg-[#111827] text-white hover:bg-[#C9A24D] dark:bg-white dark:text-[#111827] dark:hover:bg-[#C9A24D]'
                          }`}
                        >
                          {copied === 'ohp' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                    {websiteUrl && (
                      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B7280] dark:text-gray-400">Website Link</p>
                          <p className="mt-1 break-all font-mono text-[13px] text-[#111827] dark:text-white">{websiteUrl}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => window.open(websiteUrl, '_blank', 'noopener,noreferrer')}
                            className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-widest text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleCopyLink(websiteUrl, 'website')}
                            className={`rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                              copied === 'website'
                                ? 'bg-green-600 text-white'
                                : 'bg-[#C9A24D] text-[#111827] hover:bg-[#d7b974]'
                            }`}
                          >
                            {copied === 'website' ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-white dark:bg-[#151517] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <button
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="px-8 py-4 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-black uppercase tracking-widest text-xs transition-all duration-300 flex items-center space-x-2 mx-auto shadow-lg hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:scale-[1.02]"
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
          <div className="bg-white dark:bg-[#151517] rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
            <h4 className="text-[10px] font-black text-[#0B0B0B] dark:text-white uppercase tracking-[0.2em] mb-4">How Showcases Work</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                'Instant access (no login required)',
                'Personalized recommendations',
                'Real-time interaction sync',
                'Engagement tracking metrics'
              ].map((text, i) => (
                <div key={i} className="flex items-center text-xs text-[#6B7280] dark:text-gray-400 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C9A24D] mr-2"></div>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-50 dark:border-gray-800 p-6 sm:p-8 bg-white dark:bg-[#151517] sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-black uppercase tracking-widest text-xs transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </MotionModal>
  )
}
