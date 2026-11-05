'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Link2, Mail, MessageSquareText, Share2 } from 'lucide-react'
import { copyText } from '@/lib/copyText'
import { mailHref } from '@/lib/smsLink'

type Preview = { title: string | null; description: string | null; image: string | null; site: string | null }

// A link the helper made, shown the way it lands in Messages - the gray bubble with the big preview
// picture (owner, 10/31: "makes it look more like the AI sent it to you"). The picture and title are
// the page's own link preview (app/api/link-preview reads its og: tags), so it matches what the client sees.
// Copy and Share sit right under it on every finished card, so it can go out straight away (owner, 11/04).
export default function LinkPreviewCard({ url, preview }: { url: string; preview?: string }) {
  const [data, setData] = useState<Preview | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [ways, setWays] = useState(false)
  useEffect(() => {
    let live = true
    fetch(`/api/link-preview?u=${encodeURIComponent(preview || url)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (live) setData(d) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [url, preview])
  const host = url.replace(/^https?:\/\//, '').split('/')[0]
  const title = data?.title || ''
  const copy = async () => {
    if (await copyText(url)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800) }
  }
  // The phone's own share sheet (Messages, Mail, AirDrop...); a computer without one gets Email / Text.
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ ...(title ? { title } : {}), url }) } catch { /* closed the sheet */ }
      return
    }
    setWays(v => !v)
  }
  const btn = 'ohp-ai-press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-black'
  const way = 'ohp-ai-press inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white text-[12px] font-bold text-[#111827] ring-1 ring-black/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10'
  return (
    <div className="mt-2.5 max-w-[320px]" data-testid="ai-link-preview">
      <a href={url} target="_blank" rel="noopener"
        className="ohp-ai-card-in group block w-full overflow-hidden rounded-[18px] rounded-bl-md bg-[#e9e9eb] text-left transition-transform active:scale-[0.98] dark:bg-[#26252a]">
        {/* No picture to show: a plain link row, never an empty box */}
        {failed || (data && !data.image) ? (
          <span className="flex items-center gap-2 px-3 pt-2.5 text-[#8b7355] dark:text-[#C9A24D]" data-testid="ai-link-plain"><Link2 className="h-4 w-4 shrink-0" /></span>
        ) : (
          <div className="relative aspect-[1200/630] w-full bg-gradient-to-br from-[#f6efe0] to-[#e9dcc0] dark:from-[#1d1a14] dark:to-[#2a2218]">
            {data?.image
              ? <img src={data.image} alt="" loading="lazy" data-testid="ai-link-image" className="ohp-ai-reveal absolute inset-0 h-full w-full object-cover" />
              : <span className="ohp-skeleton absolute inset-0" />}
          </div>
        )}
        <div className="px-3 py-2">
          <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">{title || (failed ? 'Your link is ready' : ' ')}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500 dark:text-gray-400">
            {host} <ExternalLink className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
          </p>
        </div>
      </a>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={copy} data-testid="ai-link-copy" className={`${btn} bg-white text-[#111827] ring-1 ring-black/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10`}>
          {copied ? <><Check className="h-4 w-4 text-emerald-600" strokeWidth={3} /> Copied</> : <><Copy className="h-4 w-4" /> Copy link</>}
        </button>
        <button type="button" onClick={share} aria-expanded={ways} data-testid="ai-link-share" className={`${btn} bg-[#111827] text-white dark:bg-[#C9A24D] dark:text-[#111827]`}>
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
      {ways && (
        <div className="mt-1.5 flex gap-2" data-testid="ai-link-ways">
          <a href={mailHref('', title || 'A link for you', url)} className={way}><Mail className="h-4 w-4 text-[#C9A24D]" /> Email</a>
          <a href={`sms:?&body=${encodeURIComponent(url)}`} className={way}><MessageSquareText className="h-4 w-4 text-[#C9A24D]" /> Text</a>
        </div>
      )}
    </div>
  )
}
