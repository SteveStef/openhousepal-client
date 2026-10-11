'use client'

// The signature's two looks behind one switch - the same pair the Studio signature editor shows:
//   Site Version  - the animated card that closes the agent's website footer, blog articles,
//                   Listing Spotlights, CMA web view and Guest Pass (built right here in the
//                   browser from the same inputs, so it changes the instant a setting does).
//   Email Version - the real install HTML from the server (exactly what Copy pastes into Gmail,
//                   Outlook or Apple Mail), re-fetched whenever `emailVersion` goes up (after a save).
// Both are laid out at the card's full width and scaled down as a whole on narrow screens, never
// re-flowed - so a phone shows the same card, just smaller.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Sparkles } from 'lucide-react'
import api from '@/lib/api-service'
import { bustImageCache, wrapRealHtmlForPreview } from '@/lib/signatureConfig'

const WIDE = 740

export default function SignatureDualPreview({ siteHtml, emailVersion }: { siteHtml: string; emailVersion: number }) {
  const [mode, setMode] = useState<'site' | 'email'>('site')
  const [siteH, setSiteH] = useState(190)
  const [emailH, setEmailH] = useState(200)
  const [email, setEmail] = useState<{ html: string; version: number } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailErr, setEmailErr] = useState(false)
  const [emailReady, setEmailReady] = useState(false)
  const siteFrame = useRef<HTMLIFrameElement>(null)
  const emailFrame = useRef<HTMLIFrameElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState(WIDE)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'signature-preview-height' && e.source === siteFrame.current?.contentWindow && typeof e.data.height === 'number') setSiteH(Math.ceil(e.data.height))
      if (e.data?.type === 'signature-real-preview-height' && e.source === emailFrame.current?.contentWindow && typeof e.data.height === 'number') setEmailH(Math.ceil(e.data.height))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // The Email Version is the server's real install HTML - fetched when it's showing and stale.
  // Only the newest request counts - an older one finishing late is dropped.
  const fetchSeq = useRef(0)
  useEffect(() => {
    if (mode !== 'email' || (email && email.version === emailVersion)) return
    const seq = ++fetchSeq.current
    const version = emailVersion
    setEmailLoading(true)
    setEmailErr(false)
    api.emailSignature.getHtml().then(r => {
      if (seq !== fetchSeq.current) return
      if (r.success && r.data?.html) { setEmailReady(false); setEmail({ html: wrapRealHtmlForPreview(bustImageCache(r.data.html)), version }) }
      else setEmailErr(true)
      setEmailLoading(false)
    }).catch(() => { if (seq === fetchSeq.current) { setEmailErr(true); setEmailLoading(false) } })
  }, [mode, emailVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Switching to the site look replays its entrance, like the editor does on a tab switch.
  useEffect(() => { if (mode === 'site') siteFrame.current?.contentWindow?.postMessage({ type: 'signature-preview-replay' }, '*') }, [mode])

  const scale = Math.min(1, boxW / WIDE)
  const h = mode === 'site' ? siteH : emailH
  const showEmail = mode === 'email' && !!email && !emailLoading && emailReady

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#e7dfcf] to-[#e7dfcf] dark:via-white/10 dark:to-white/10" />
        <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#C9A24D]/30 bg-[#C9A24D]/10 p-1 text-[11px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]">
          {([['site', Sparkles, 'Site Version'], ['email', Mail, 'Email Version']] as const).map(([m, Icon, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} data-testid={`sig-preview-${m}`}
              className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors duration-300 ${mode === m ? 'text-white' : 'opacity-70 hover:opacity-100'}`}>
              {mode === m && <motion.span layoutId="setup-signature-preview-mode" className="absolute inset-0 rounded-full bg-[#C9A24D]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="relative flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</span>
            </button>
          ))}
        </div>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#e7dfcf] to-[#e7dfcf] dark:via-white/10 dark:to-white/10" />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
          className="mx-auto mt-2 max-w-xl text-center text-[13px] font-medium leading-snug text-gray-500 dark:text-gray-400">
          {mode === 'site'
            ? 'How it shows on your website, blog articles, Listing Spotlights and CMA reports - with full motion.'
            : 'Exactly what gets pasted into Gmail, Outlook or Apple Mail. Inboxes can’t play animations, so this one is calmer - that’s normal.'}
        </motion.p>
      </AnimatePresence>

      <div ref={wrap} className="relative mx-auto mt-4 w-full max-w-[740px] overflow-hidden transition-[height] duration-300" style={{ height: Math.max(120, h * scale) }}>
        <iframe ref={siteFrame} title="Signature - site version" srcDoc={siteHtml} sandbox="allow-scripts"
          className={`absolute left-0 top-0 block border-0 bg-transparent transition-opacity duration-300 ${mode === 'site' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          style={{ width: WIDE, height: siteH, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left', colorScheme: 'light' }} />
        {email && (
          <iframe ref={emailFrame} title="Signature - email version" srcDoc={email.html} sandbox="allow-scripts" onLoad={() => setEmailReady(true)}
            className={`absolute left-0 top-0 block border-0 bg-transparent transition-opacity duration-300 ${showEmail ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            style={{ width: WIDE, height: emailH, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'top left', colorScheme: 'light' }} />
        )}
        {mode === 'email' && !showEmail && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            {emailErr
              ? <p className="text-[14px] font-bold text-rose-600">Couldn&apos;t load the email version - check your connection.</p>
              : <>
                  <span className="relative grid h-12 w-12 place-items-center">
                    <span className="absolute inset-0 animate-spin rounded-full border-2 border-[#C9A24D]/15 border-t-[#C9A24D] [animation-duration:1.1s]" />
                    <Mail className="h-5 w-5 text-[#C9A24D]" />
                  </span>
                  <p className="text-[13px] font-black text-[#111827] dark:text-white">Building your email version</p>
                </>}
          </div>
        )}
      </div>
    </div>
  )
}
