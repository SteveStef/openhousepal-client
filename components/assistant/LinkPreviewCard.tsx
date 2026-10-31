'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { copyText } from '@/lib/copyText'

type Preview = { title: string | null; description: string | null; image: string | null; site: string | null }

// A link the helper made, shown the way it lands in Messages - the gray bubble with the big preview
// picture (owner, 10/31: "makes it look more like the AI sent it to you"). The picture and title are
// the page's own link preview (app/api/link-preview reads its og: tags), so it matches what the client sees.
export default function LinkPreviewCard({ url, preview }: { url: string; preview?: string }) {
  const [data, setData] = useState<Preview | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let live = true
    fetch(`/api/link-preview?u=${encodeURIComponent(preview || url)}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (live) setData(d) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [url, preview])
  const host = url.replace(/^https?:\/\//, '').split('/')[0]
  return (
    <div className="mt-2.5" data-testid="ai-link-preview">
      <a href={url} target="_blank" rel="noopener"
        className="ohp-ai-card-in group block w-[86%] max-w-[300px] overflow-hidden rounded-[18px] rounded-bl-md bg-[#e9e9eb] text-left transition-transform active:scale-[0.98] dark:bg-[#26252a]">
        <div className="relative aspect-[1200/630] w-full bg-gradient-to-br from-[#f6efe0] to-[#e9dcc0] dark:from-[#1d1a14] dark:to-[#2a2218]">
          {data?.image
            ? <img src={data.image} alt="" loading="lazy" className="ohp-ai-reveal absolute inset-0 h-full w-full object-cover" />
            : !failed && <span className="ohp-skeleton absolute inset-0" />}
        </div>
        <div className="px-3 py-2">
          <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-[#111827] dark:text-white">{data?.title || (failed ? host : ' ')}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500 dark:text-gray-400">
            {host} <ExternalLink className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
          </p>
        </div>
      </a>
      <button type="button" onClick={() => { copyText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }}
        className="ohp-ai-press mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-bold text-[#8b7355] hover:bg-[#8b7355]/10 dark:text-[#C9A24D] dark:hover:bg-[#C9A24D]/10">
        {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
      </button>
    </div>
  )
}
