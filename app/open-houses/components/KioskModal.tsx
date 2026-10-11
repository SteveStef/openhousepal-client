'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

interface KioskModalProps {
  url: string
  onClose: () => void
}

// In-screen popup for the Kiosk mode chooser - same modal chrome as clicking into a property
// (PropertyDetailsModal), with an iframe standing in for the page content instead of navigating
// away. Only the "Choose Sign-In Mode" screen actually runs inside this popup/iframe - picking a
// mode there hands off to a real, separate browser tab, fullscreened immediately (see
// startKiosk() in the kiosk page itself), which then posts back here to close this popup.
export function KioskModal({ url, onClose }: KioskModalProps) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'openhousepal:kiosk-launched') onClose()
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="fixed inset-0 bg-[#0B0B0B]/80 z-50 flex items-center justify-center p-2 sm:p-4 overscroll-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative h-[min(85vh,720px)] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl dark:bg-[#0B0B0B]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Kiosk"
            title="Close Kiosk"
            className="absolute top-4 right-4 z-10 rounded-full bg-black/20 p-3 text-white/70 transition-all hover:bg-black/40 hover:text-white"
          >
            <X size={18} />
          </button>
          <iframe
            src={url}
            title="Open House Kiosk"
            allow="fullscreen"
            className="h-full w-full border-0"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
