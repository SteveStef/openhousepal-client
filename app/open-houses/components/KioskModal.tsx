'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import OhpLoader from '@/components/brand/OhpLoader'
import { backdropMotion, panelMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

interface KioskModalProps {
  /** Rendered all the time and toggled with `open`, so it can animate away when closed. */
  open?: boolean
  url: string
  onClose: () => void
}

// In-screen popup for the Kiosk mode chooser - same modal chrome as clicking into a property
// (PropertyDetailsModal), with an iframe standing in for the page content instead of navigating
// away. Only the "Choose Sign-In Mode" screen actually runs inside this popup/iframe - picking a
// mode there hands off to a real, separate browser tab, fullscreened immediately (see
// startKiosk() in the kiosk page itself), which then posts back here to close this popup.
export function KioskModal({ open = true, url, onClose }: KioskModalProps) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  const release = usePagePin(open)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'openhousepal:kiosk-launched') onClose()
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onClose])
  if (!host) return null
  return createPortal(
    <AnimatePresence onExitComplete={release}>
      {open && <KioskWindow key="kiosk" url={url} onClose={onClose} />}
    </AnimatePresence>,
    host,
  )
}

// Phones (user, 10/24 - "the opening looked strange"): one smooth slide up from the bottom edge as
// a tall sheet (pull the top strip down to close), the house loader inside until the kiosk screen
// has actually loaded, then it fades in - no grow-from-the-middle, no white flash. Computers keep
// the centred window.
function KioskWindow({ url, onClose }: { url: string; onClose: () => void }) {
  const phone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone)
  useEscapeToClose(onClose)
  const [loaded, setLoaded] = useState(false)
  return (
    <motion.div
      {...backdropMotion}
      data-scroll-lock="off"
      className={`fixed inset-0 z-50 flex justify-center bg-[#0B0B0B]/80 overscroll-none ${phone ? 'items-end' : 'items-center p-4'}`}
      onClick={onClose}
    >
      <motion.div
        ref={sheetRef}
        {...(phone ? sheetMotion : panelMotion)}
        style={phone ? { y } : undefined}
        className={`relative w-full overflow-hidden bg-white shadow-2xl dark:bg-[#0B0B0B] ${phone ? 'flex h-[94dvh] flex-col rounded-t-[28px]' : 'h-[min(85vh,720px)] max-w-2xl rounded-3xl'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {phone && (
          // The strip you pull down (touches inside the kiosk screen itself stay with it).
          <div className="absolute inset-x-0 top-0 z-[2] flex h-8 items-center justify-center">
            <span aria-hidden className="h-1.5 w-10 rounded-full bg-gray-400/60 shadow-[0_0_0_1px_rgba(255,255,255,.35)]" />
          </div>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          aria-label="Close Kiosk"
          title="Close Kiosk"
          className={`absolute z-10 grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white/80 transition-colors hover:bg-black/45 hover:text-white ${phone ? 'right-3 top-4' : 'right-4 top-4'}`}
        >
          <X size={18} />
        </motion.button>
        <div className="relative min-h-0 flex-1 h-full">
          <AnimatePresence>
            {!loaded && (
              <motion.div key="kiosk-loading" initial={false} exit={{ opacity: 0, transition: { duration: 0.25 } }}
                className="absolute inset-0 z-[1] grid place-items-center bg-white dark:bg-[#0B0B0B]">
                <OhpLoader fullScreen={false} label="Opening the kiosk" />
              </motion.div>
            )}
          </AnimatePresence>
          <iframe
            src={url}
            title="Open House Kiosk"
            allow="fullscreen"
            onLoad={() => setLoaded(true)}
            className={`h-full w-full border-0 transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
