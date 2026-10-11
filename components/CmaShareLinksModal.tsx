'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink, Share2, X } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { copyText } from '@/lib/copyText'

interface CmaShareLinksModalProps {
  isOpen: boolean
  onClose: () => void
  openHousePalUrl: string | null
  websiteUrl?: string | null
}

export default function CmaShareLinksModal({ isOpen, onClose, openHousePalUrl, websiteUrl }: CmaShareLinksModalProps) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState<'ohp' | 'website' | null>(null)

  if (!isOpen || !openHousePalUrl) return null

  const copy = async (url: string, key: 'ohp' | 'website') => {
    await copyText(url)
    setCopied(key)
    showToast('Link copied', 'success')
    setTimeout(() => setCopied(current => (current === key ? null : current)), 1800)
  }

  const rows = [
    { key: 'ohp' as const, label: 'OpenHousePal Link', url: openHousePalUrl },
    ...(websiteUrl ? [{ key: 'website' as const, label: 'Website / IDX Link', url: websiteUrl }] : []),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-[#C9A24D] dark:bg-white">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-[#111827] dark:text-white">Share CMA</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-400">Use your OpenHousePal link or your published IDX website link.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 bg-[#faf9f7] p-6 dark:bg-[#0B0B0B]">
          {rows.map(row => (
            <div key={row.key} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{row.label}</p>
                <p className="mt-1 break-all font-mono text-[13px] text-[#111827] dark:text-white">{row.url}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => window.open(row.url, '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-3 text-xs font-black uppercase tracking-widest text-[#111827] transition hover:border-[#C9A24D] dark:border-gray-700 dark:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </button>
                <button
                  onClick={() => copy(row.url, row.key)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                    copied === row.key
                      ? 'bg-green-600 text-white'
                      : row.key === 'website'
                        ? 'bg-[#C9A24D] text-[#111827] hover:bg-[#d7b974]'
                        : 'bg-[#111827] text-white hover:bg-black dark:bg-white dark:text-[#111827]'
                  }`}
                >
                  {copied === row.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 p-5 dark:border-gray-800">
          <button onClick={onClose} className="w-full rounded-xl bg-gray-100 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-200 hover:text-[#111827] dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
