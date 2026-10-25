'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import AutoHeight from '@/components/ui/AutoHeight'
import { backdropMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import { COMPACT_QUERY } from './model'

// The Spotlight's own small window, in the page's look: on a phone a sheet that slides up from the
// bottom and pulls down to close (calendar choice, Follow this home...); on a computer a small
// centred card. Its height glides when what's inside changes (AutoHeight). tone: 'dark' =
// Cinematic Luxury, 'light' = Editorial Estate's paper.
export type SheetTone = 'dark' | 'light'

/** A phone, upright or on its side (model.COMPACT_QUERY) - where forms become buttons + sheets. */
export function useCompactScreen(): boolean {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY)
    const on = () => setCompact(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return compact
}

const LOOK: Record<SheetTone, { card: string; grab: string; close: string; kicker: string; title: string }> = {
  dark: {
    card: 'bg-[#121212] text-white border border-white/10',
    grab: 'bg-white/25',
    close: 'bg-white/10 text-white/80 hover:bg-white/20',
    kicker: 'text-[color:var(--sp-accent,#C9A24D)]',
    title: 'text-white',
  },
  light: {
    card: 'bg-[#f7f3ea] text-[#172522] border border-[#172522]/10',
    grab: 'bg-[#172522]/20',
    close: 'bg-[#172522]/[0.06] text-[#172522]/70 hover:bg-[#172522]/[0.12]',
    kicker: 'text-[color:color-mix(in_srgb,var(--sp-accent,#8d7548)_75%,#172522)]',
    title: 'text-[#172522]',
  },
}

export default function SpotSheet({ open, onClose, tone, kicker, title, children, width = 'sm:max-w-[420px]', fontClass = '' }: {
  open: boolean
  onClose: () => void
  tone: SheetTone
  kicker?: ReactNode
  title?: ReactNode
  children: ReactNode
  /** Desktop width (Tailwind sm:max-w class). */
  width?: string
  /** The template's display font class for the title. */
  fontClass?: string
}) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  // Inside the template's own root (data-spotlight-root) so the page's fonts and accent colour
  // (--sp-accent, .sp-display) carry into the window; the body only as a fallback.
  useEffect(() => { setHost(document.querySelector<HTMLElement>('[data-spotlight-root]') || document.body) }, [])
  const release = usePagePin(open)
  if (!host) return null
  return createPortal(
    <AnimatePresence onExitComplete={release}>
      {open && <Sheet key="spot-sheet" {...{ onClose, tone, kicker, title, width, fontClass }}>{children}</Sheet>}
    </AnimatePresence>,
    host,
  )
}

function Sheet({ onClose, tone, kicker, title, width, fontClass, children }: {
  onClose: () => void; tone: SheetTone; kicker?: ReactNode; title?: ReactNode; width: string; fontClass: string; children: ReactNode
}) {
  const phone = useIsPhone()
  const motionProps = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone)
  useEscapeToClose(onClose)
  const L = LOOK[tone]
  return (
    <motion.div
      {...backdropMotion}
      data-scroll-lock="off"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className={`fixed inset-0 z-[160] flex bg-black/60 ${phone ? 'items-end' : 'items-center justify-center p-6'}`}
    >
      <motion.div
        ref={sheetRef}
        {...motionProps}
        style={phone ? { y } : undefined}
        role="dialog"
        aria-modal="true"
        className={`relative w-full overflow-hidden shadow-[0_-20px_60px_-20px_rgba(0,0,0,.6)] ${L.card} ${phone ? 'max-h-[92dvh] rounded-t-[24px] border-b-0' : `${width} max-h-[min(760px,calc(100dvh-3rem))] rounded-[22px]`}`}
      >
        {phone && <span aria-hidden className={`absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full ${L.grab}`} />}
        <div className={`flex items-start justify-between gap-4 px-5 ${phone ? 'pt-6' : 'pt-5'} sm:px-6`}>
          <div className="min-w-0">
            {kicker && <p className={`text-[10px] font-semibold uppercase tracking-[0.28em] ${L.kicker}`}>{kicker}</p>}
            {title && <h2 className={`sp-display ${fontClass} mt-1 text-[1.65rem] leading-tight ${L.title}`}>{title}</h2>}
          </div>
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={onClose} aria-label="Close"
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${L.close}`}>
            <X className="h-4 w-4" />
          </motion.button>
        </div>
        <div className="max-h-[calc(92dvh-5rem)] overflow-y-auto overscroll-contain" style={{ paddingBottom: phone ? 'max(1.25rem, env(safe-area-inset-bottom))' : '1.5rem' }}>
          <AutoHeight innerClassName="px-5 pt-4 sm:px-6">{children}</AutoHeight>
        </div>
      </motion.div>
    </motion.div>
  )
}
