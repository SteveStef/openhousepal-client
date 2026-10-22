'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { readVisitor, visitorPrefill } from '@/lib/visitor'
import { backdropMotion, useIsPhone, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

// One of the agent's forms, opened in a window over the current page instead of leaving it. The
// form page runs embedded (`embed=1`: no decorative backdrop, no redirect) and posts
// `ohp-form-complete` when the visitor finishes, which closes this window. `prefill` is what the
// page already knows (the home's address, for a showing request) - sent as `prefill_<questionId>`
// and filled in before the visitor starts.
//
// Phones (user, 10/22 - "things that slide up when they should"): a nearly full-height sheet that
// slides up from the bottom, with a grab bar you can pull down to close it - one slim bar on top of
// the form, not a second header. Computers keep the centred window.
export default function FormWindow({ url, title, prefill, onClose }: {
  url: string | null
  title?: string
  prefill?: Record<string, string | undefined | null>
  onClose: () => void
}) {
  useEffect(() => {
    if (!url) return
    const onMessage = (e: MessageEvent) => { if (e.data?.type === 'ohp-form-complete') onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('message', onMessage)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('message', onMessage); window.removeEventListener('keydown', onKey) }
  }, [url, onClose])

  // Rendered at the end of <body>: a card with a CSS filter or transform (the hub's Luxe cards)
  // would otherwise trap this "fixed" window inside its own box.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  const phone = useIsPhone()
  const sheetMotion = useSheetMotion()
  // The pull works on the bar above the form (touches inside the form's frame stay the form's).
  const { sheetRef, y } = useSwipeToClose(onClose, phone && !!url)

  const src = (() => {
    if (!url) return ''
    const params = new URLSearchParams()
    params.set('embed', '1')
    // A visitor who signed in with Google on the agent's site (lib/visitor) gets their name + email filled in.
    for (const [k, v] of Object.entries({ ...visitorPrefill(readVisitor()), ...(prefill || {}) })) if (v) params.set(`prefill_${k}`, String(v))
    return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`
  })()

  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {url && (
        <motion.div key="fw" {...backdropMotion} className="fixed inset-0 z-[95] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-6" onClick={onClose}>
          <motion.div ref={sheetRef} {...sheetMotion} style={phone ? { y } : undefined}
            onClick={e => e.stopPropagation()}
            className="relative flex h-[calc(100dvh-12px)] w-full max-w-xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:h-[82vh] sm:rounded-3xl dark:bg-[#111]">
            {phone ? (
              <div className="relative flex h-11 shrink-0 items-center justify-center" style={{ touchAction: 'none' }}>
                <span aria-hidden className="h-1.5 w-11 rounded-full bg-black/15 dark:bg-white/20" />
                <button type="button" onClick={onClose} aria-label="Close" className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-gray-500 active:bg-black/5 dark:text-white/70"><X className="h-5 w-5" /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between border-b border-black/5 px-5 py-3 dark:border-white/10">
                <p className="truncate text-sm font-black text-[#111827] dark:text-white">{title || 'Contact'}</p>
                <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-black/5 p-1.5 text-gray-500 transition hover:bg-black/10 dark:bg-white/10 dark:text-white/70"><X className="h-4 w-4" /></button>
              </div>
            )}
            <iframe title={title || 'Form'} src={src} className="w-full flex-1 border-0" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  )
}
