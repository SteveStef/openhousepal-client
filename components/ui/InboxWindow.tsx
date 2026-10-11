'use client'

import type { ComponentType, ReactNode } from 'react'
import { Inbox, X } from 'lucide-react'
import { useEscapeToClose } from '@/components/ui/windowMotion'

// One look for every page's "mailbox": a header button with a count, and a window listing what
// came in - newest first, new ones highlighted, a tap opens the thing itself. (Showcases has its
// own two: Tours + Activity.)

export type InboxItem = {
  id: string
  title: string
  /** Second line - what happened / where. */
  subtitle?: string | null
  at: string
  unread?: boolean
  icon: ComponentType<{ size?: number; className?: string }>
  /** Tailwind bg-* for the little icon badge. */
  tone?: string
  photo?: string | null
  onOpen: () => void
}

export function InboxButton({ label, count, onClick, title, tone = 'gold', idle = 'plain' }: {
  label: string; count: number; onClick: () => void; title?: string; tone?: 'gold' | 'red'
  idle?: 'plain' | 'gold' // how it looks with nothing in it - 'gold' = calm, "all clear"
}) {
  const on = count > 0
  const onCls = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300'
    : 'border-[#C9A24D]/50 bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`relative flex min-w-[58px] flex-col items-center justify-center gap-0.5 self-stretch rounded-xl border-2 px-2 py-1.5 shadow-sm transition-all hover:-translate-y-px ${
        on ? onCls : idle === 'gold' ? 'border-[#C9A24D]/50 bg-[#C9A24D]/10 text-[#8b7355] hover:border-[#C9A24D] dark:text-[#e8c97a]' : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D]/50 hover:text-[#111827] dark:border-gray-800 dark:bg-[#151517] dark:text-gray-400 dark:hover:text-white'
      }`}
    >
      <Inbox size={15} />
      <span className="text-[8.5px] font-black uppercase leading-none tracking-wide">{label}</span>
      {on && (
        <span className={`absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full px-1 text-center text-[10px] font-black leading-[18px] text-white ring-2 ring-white dark:ring-[#151517] ${tone === 'red' ? 'bg-red-500' : 'bg-[#C9A24D]'}`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

export default function InboxWindow({ isOpen, onClose, title, subtitle, items, empty, footer }: {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  items: InboxItem[]
  empty: string
  footer?: ReactNode
}) {
  useEscapeToClose(onClose, isOpen)
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#151517]">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-[#111827] p-2 shadow-sm dark:bg-white">
              <Inbox className="text-white dark:text-[#111827]" size={16} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-[#111827] dark:text-white">{title}</h2>
              {subtitle && <p className="text-[11px] font-medium text-[#6B7280] dark:text-gray-400">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-[#111827] dark:hover:bg-gray-800 dark:hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#FAFAF7] p-3 dark:bg-[#0B0B0B]">
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-[#151517]">
                <Inbox className="h-6 w-6 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-xs text-[#6B7280] dark:text-gray-400">{empty}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={item.onOpen}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all hover:border-[#C9A24D]/40 hover:shadow-sm ${
                      item.unread ? 'border-[#C9A24D]/30 bg-[#C9A24D]/[0.06] dark:bg-[#C9A24D]/[0.08]' : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-[#151517]'
                    }`}
                  >
                    <div className="relative h-11 w-11 flex-shrink-0">
                      {item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photo} alt="" className="h-11 w-11 rounded-lg object-cover" />
                      ) : (
                        <div className="grid h-11 w-11 place-items-center rounded-lg bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a]">
                          <Icon size={16} />
                        </div>
                      )}
                      {item.photo && (
                        <span className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-white ring-2 ring-white dark:ring-[#151517] ${item.tone || 'bg-[#C9A24D]'}`}>
                          <Icon size={10} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-[#111827] dark:text-white">{item.title}</p>
                      {item.subtitle && <p className="truncate text-[11px] text-[#6B7280] dark:text-gray-400">{item.subtitle}</p>}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className="whitespace-nowrap text-[10px] font-medium text-gray-400">{ago(item.at)}</span>
                      {item.unread && <span className="h-2 w-2 rounded-full bg-[#C9A24D]" aria-label="New" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {footer && <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#151517]">{footer}</div>}
      </div>
    </div>
  )
}
