'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { backdropMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

// One window for every Open House Manager / Discovery panel (user, 10/22): on a phone it's a sheet
// that slides up from the bottom and pulls down to close - you never leave the page you were on; on
// a computer it's a centred window ('center') or a panel from the right edge ('side').

const SIDE_IN = {
  initial: { x: '100%' },
  animate: { x: 0, transition: { type: 'spring', stiffness: 380, damping: 40, mass: 0.9 } },
  exit: { x: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
} as const

export default function OhSheet({ open, onClose, variant = 'center', width = 'max-w-2xl', title, subtitle, icon, image, badge, children, footer }: {
  open: boolean
  onClose: () => void
  variant?: 'center' | 'side'
  /** Desktop width (Tailwind max-w class). */
  width?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** A small icon tile beside the title (or `image` - the listing photo). */
  icon?: React.ReactNode
  image?: string | null
  badge?: React.ReactNode
  children: React.ReactNode
  /** Pinned under the content (a phone keeps it above the home bar). */
  footer?: React.ReactNode
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  const release = usePagePin(open)
  if (!host) return null
  return createPortal(
    <AnimatePresence onExitComplete={release}>
      {open && (
        <Sheet key="oh-sheet" {...{ onClose, variant, width, title, subtitle, icon, image, badge, footer }}>{children}</Sheet>
      )}
    </AnimatePresence>,
    host,
  )
}

function Sheet({ onClose, variant, width, title, subtitle, icon, image, badge, footer, children }: Omit<Parameters<typeof OhSheet>[0], 'open'>) {
  const phone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone)
  useEscapeToClose(onClose)
  const side = variant === 'side' && !phone
  return (
    <motion.div {...backdropMotion} data-scroll-lock="off" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className={`fixed inset-0 z-[60] flex bg-[#0b0b0c]/55 ${phone ? 'items-end' : side ? 'justify-end' : 'items-center justify-center p-6'}`}>
      <motion.div ref={sheetRef} {...(side ? SIDE_IN : sheetMotion)} style={phone ? { y } : undefined}
        className={`relative flex w-full flex-col overflow-hidden bg-[#FAFAF7] shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#0d0d0f] ${
          phone ? 'max-h-[92dvh] rounded-t-[28px]' : side ? 'h-full max-w-md' : `max-h-[min(900px,calc(100dvh-3rem))] ${width} rounded-[28px]`}`}>
        {phone && <span aria-hidden className="absolute left-1/2 top-2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-gray-300 dark:bg-white/20" />}
        <div className={`flex items-center gap-3 border-b border-black/[0.06] bg-white px-5 dark:border-white/[0.07] dark:bg-[#141416] ${phone ? 'pb-4 pt-6' : 'py-4'}`}>
          {image !== undefined ? (
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] shadow-sm">
              {image && <img src={image} alt="" className="h-full w-full object-cover" />}
            </span>
          ) : icon ? (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-sm">{icon}</span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate font-serif text-xl font-black leading-tight text-[#111827] dark:text-white">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-[#111827] dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15">
            <X className="h-4 w-4" />
          </motion.button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
        {footer && (
          <div className="border-t border-black/[0.06] bg-white px-4 py-3 dark:border-white/[0.07] dark:bg-[#141416] sm:px-6" style={{ paddingBottom: phone ? 'max(0.75rem, env(safe-area-inset-bottom))' : undefined }}>
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

/** Four at a time with a centred switcher underneath - long lists (opens, history, hosts) never
 *  turn into one endless scroll. Pages slide in the direction you move. */
export function FourPager<T>({ items, render, size = 4, empty, resetKey }: {
  items: T[]
  render: (item: T, index: number) => React.ReactNode
  size?: number
  empty?: React.ReactNode
  /** Changing it goes back to page 1 (e.g. a new listing). */
  resetKey?: unknown
}) {
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / size))
  useEffect(() => { setPage(0) }, [resetKey])
  useEffect(() => { if (page > pages - 1) setPage(pages - 1) }, [page, pages])
  if (!items.length) return <>{empty ?? null}</>
  const go = (n: number) => { setDir(n > page ? 1 : -1); setPage(n) }
  const shown = items.slice(page * size, page * size + size)
  return (
    <div>
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={page} custom={dir}
            initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 36 } }}
            exit={{ opacity: 0, x: dir * -30, transition: { duration: 0.15 } }}
            className="space-y-2">
            {shown.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 380, damping: 30 }}>
                {render(item, page * size + i)}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous"
            className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-[#C9A24D] disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: pages }, (_, n) => (
              <button key={n} type="button" onClick={() => go(n)} aria-label={`Page ${n + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${n === page ? 'w-6 bg-[#C9A24D]' : 'w-2 bg-gray-300 hover:bg-gray-400 dark:bg-white/20'}`} />
            ))}
          </div>
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => go(page + 1)} disabled={page === pages - 1} aria-label="Next"
            className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-[#C9A24D] disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        </div>
      )}
      {pages > 1 && <p className="mt-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 tabular-nums">{page * size + 1}–{Math.min(items.length, page * size + size)} of {items.length}</p>}
    </div>
  )
}

/** A row that opens to show more, with a smooth height animation. Each one owns its own open
 *  state, so opening one never opens another (two opens from one reusable kit share an id). */
export function Unfold({ head, children, defaultOpen = false, tone = 'plain' }: {
  head: (open: boolean) => React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  tone?: 'plain' | 'gold'
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition-colors dark:bg-[#141416] ${open ? 'border-[#C9A24D]/50 shadow-[0_14px_30px_-24px_rgba(201,162,77,.9)]' : tone === 'gold' ? 'border-[#C9A24D]/30' : 'border-gray-100 dark:border-white/[0.07]'}`}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left sm:p-3.5">
        <div className="min-w-0 flex-1">{head(open)}</div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${open ? 'bg-[#C9A24D] text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>
          <ChevronRight className="h-4 w-4 rotate-90" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: 'spring', stiffness: 320, damping: 34 }, opacity: { duration: 0.18 } }}>
            <div className="border-t border-gray-100 bg-[#FAFAF7] p-3 dark:border-white/[0.06] dark:bg-[#0f0f11] sm:p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
