'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { backdropMotion, useEscapeToClose, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'

// Phones (owner, 10/22: a Preview button that only opened a new tab was unclear): "Preview my page"
// slides the real page up right here, full screen, at phone size - exactly what a buyer's phone
// shows. Pull the top bar down (or tap Close) to go back to the editor. Computers keep the new tab.
export default function PhonePagePreview({ open, src, label, onClose }: { open: boolean; src: string; label: string; onClose: () => void }) {
  const sheet = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, open)
  const release = usePagePin(open)
  useEscapeToClose(onClose, open)
  const [loaded, setLoaded] = useState(false)
  return (
    <AnimatePresence onExitComplete={() => { setLoaded(false); release() }}>
      {open && (
        <motion.div key="pp" className="fixed inset-0 z-[80] flex flex-col" data-scroll-lock="off" role="dialog" aria-modal="true" aria-label="Your page, as a phone shows it">
          <motion.div {...backdropMotion} className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div ref={sheetRef} {...sheet} style={{ y }}
            className="relative mt-[max(env(safe-area-inset-top),10px)] flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[22px] bg-[#0B0B0B] shadow-[0_-20px_50px_-20px_rgba(0,0,0,.8)] ring-1 ring-[#C9A24D]/30">
            {/* The bar you pull down - the page itself scrolls normally underneath. */}
            <div className="relative shrink-0 bg-gradient-to-b from-[#1a1712] to-[#111113] px-3 pb-2 pt-2">
              <span aria-hidden className="mx-auto mb-1.5 block h-1 w-10 rounded-full bg-white/25" />
              <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a]/70 to-transparent" />
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1 pl-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#e8c97a]">Your page · on a phone</p>
                  <p className="truncate font-mono text-[11px] text-white/60">{label}</p>
                </div>
                <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={onClose}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 text-[13px] font-black text-white ring-1 ring-white/15 transition active:bg-white/20">
                  <X className="h-4 w-4" /> Close
                </motion.button>
              </div>
            </div>
            <div className="relative min-h-0 flex-1 bg-black">
              <AnimatePresence>
                {!loaded && (
                  <motion.div key="ld" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }} className="absolute inset-0 grid place-items-center">
                    <span className="flex items-center gap-2 text-xs font-bold text-white/60"><Loader2 className="h-4 w-4 animate-spin text-[#C9A24D]" /> Opening your page…</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.iframe src={src} title="Your page" onLoad={() => setLoaded(true)}
                initial={{ opacity: 0 }} animate={{ opacity: loaded ? 1 : 0 }} transition={{ duration: 0.35 }}
                className="absolute inset-0 h-full w-full border-0 bg-black" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
