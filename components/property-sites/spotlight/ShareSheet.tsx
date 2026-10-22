'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Download, Facebook, Link2, Linkedin, Mail, MessageCircle, Share2, X } from 'lucide-react'
import FormQrCode from '@/components/forms/FormQrCode'
import { TONE, type Tone } from './tone'
import { usePresence } from './motion'

// "Send this home to someone" - copy link, the phone's native share sheet when it has one, the
// usual social/email/text targets, and a scannable (downloadable) QR code for print pieces.
export default function ShareSheet({
  open, onClose, url, title, tone,
}: {
  open: boolean
  onClose: () => void
  url: string
  title: string
  tone: Tone
}) {
  const t = TONE[tone]
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [downloadQr, setDownloadQr] = useState<(() => void) | null>(null)
  const handleQrReady = useCallback((fn: () => void) => setDownloadQr(() => fn), [])
  const closeRef = useRef<HTMLButtonElement>(null)
  const { show, closing } = usePresence(open, 220)

  // `navigator` doesn't exist during SSR - decided after hydration so the first client render
  // matches the server's.
  useEffect(() => { if (typeof navigator !== 'undefined' && 'share' in navigator) setCanNativeShare(true) }, [])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!show) return null

  const copy = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800) }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(() => {})
    else {
      const ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); done() } catch { /* nothing else to try */ }
      ta.remove()
    }
  }
  const enc = encodeURIComponent
  const targets = [
    { label: 'Email', icon: Mail, href: `mailto:?subject=${enc(title)}&body=${enc(`Take a look at this home: ${url}`)}` },
    { label: 'Text', icon: MessageCircle, href: `sms:?&body=${enc(`${title} — ${url}`)}` },
    { label: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'LinkedIn', icon: Linkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { label: 'X', icon: XLogo, href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(title)}` },
  ]

  return (
    <div className={`sp-sheet-bg fixed inset-0 z-[190] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6 ${closing ? 'is-closing pointer-events-none' : ''}`} onClick={onClose} role="presentation">
      <div
        role="dialog" aria-modal="true" aria-label="Share this home" onClick={e => e.stopPropagation()}
        className={`sp-sheet relative w-full max-w-lg p-6 sm:p-8 ${t.modal} rounded-b-none sm:rounded-b-[inherit]`}
      >
        <button ref={closeRef} onClick={onClose} className={`absolute right-4 top-4 rounded-full p-2 transition ${t.menuItem}`} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <p className={t.label}>Share this home</p>
        <p className={`${t.heading} mt-2 pr-8 text-3xl leading-tight`}>{title}</p>

        <div className={`mt-6 flex items-center gap-2 border p-1.5 pl-4 ${t.divider} ${tone === 'dark' ? 'rounded-full' : 'rounded-[2px]'}`}>
          <span className={`min-w-0 flex-1 truncate text-sm ${t.muted}`}>{url.replace(/^https?:\/\//, '')}</span>
          <button onClick={copy} className={`inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-xs font-semibold ${t.primaryBtn}`}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {canNativeShare && (
            <button
              onClick={() => (navigator as Navigator).share({ title, url }).catch(() => {})}
              className={`flex flex-col items-center gap-1.5 py-3 text-[11px] font-medium ${t.chip}`}
            >
              <Share2 className="h-4 w-4" /> More
            </button>
          )}
          {targets.map(({ label, icon: Icon, href }) => (
            <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
              className={`flex flex-col items-center gap-1.5 py-3 text-[11px] font-medium ${t.chip}`}>
              <Icon className="h-4 w-4" /> {label}
            </a>
          ))}
        </div>

        <div className={`mt-6 flex items-center gap-5 border-t pt-6 ${t.divider}`}>
          <div className="h-[106px] w-[106px] shrink-0 overflow-hidden">
            <FormQrCode url={url} size={96} onDownloadReady={handleQrReady} />
          </div>
          <div>
            <p className="text-sm font-semibold">Scan to open on a phone</p>
            <p className={`mt-1 text-xs leading-relaxed ${t.muted}`}>Great for flyers, postcards and the sign in the yard.</p>
            {downloadQr && (
              <button onClick={() => downloadQr()} className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-4`}>
                <Download className="h-3.5 w-3.5" /> Download QR code
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spSheetIn { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none } }
        @keyframes spSheetBg { from { opacity: 0 } to { opacity: 1 } }
        @keyframes spSheetBgOut { to { opacity: 0 } }
        @keyframes spSheetOut { to { opacity: 0; transform: translateY(24px) } }
        .sp-sheet-bg { animation: spSheetBg .22s ease both }
        .sp-sheet-bg.is-closing { animation: spSheetBgOut .22s ease .02s both }
        .sp-sheet { animation: spSheetIn .35s cubic-bezier(.2,.8,.2,1) both }
        .is-closing > .sp-sheet { animation: spSheetOut .2s cubic-bezier(.4,0,1,1) both }
        @media (max-width: 639px) {
          @keyframes spSheetUp { from { transform: translateY(100%) } to { transform: none } }
          @keyframes spSheetDown { to { transform: translateY(100%) } }
          .sp-sheet { animation: spSheetUp .42s cubic-bezier(.2,.8,.2,1) both }
          .is-closing > .sp-sheet { animation: spSheetDown .24s cubic-bezier(.4,0,1,1) both }
        }
        @media (prefers-reduced-motion: reduce) { .sp-sheet, .sp-sheet-bg, .is-closing > .sp-sheet { animation: none } }
      `}</style>
    </div>
  )
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}
