'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, History, Loader2 } from 'lucide-react'
import api, { type OldLinksPayload } from '@/lib/api-service'

// Pages from the website that used to live on the agent's own domain - Google still lists them.
// The scan (backend old_links_service) finds them in the Internet Archive and sends each one to the
// matching page here, all by itself. Kept to one plain line with nothing to set (user, 10/20: "keep
// it extremely simple") - the per-page list and dropdowns were taken out.
export default function OldLinksPanel() {
  const [data, setData] = useState<OldLinksPayload | null>(null)
  const polls = useRef(0)

  useEffect(() => { api.sites.getOldLinks().then(res => { if (res.success && res.data) setData(res.data) }) }, [])

  // While a scan runs (a minute or two), check back every few seconds.
  const running = data?.scan?.status === 'running' || (data !== null && !data.scan && !!data.domain)
  useEffect(() => {
    if (!running) { polls.current = 0; return }
    const t = setInterval(() => {
      polls.current += 1
      if (polls.current > 60) { clearInterval(t); return }
      api.sites.getOldLinks().then(res => { if (res.success && res.data) setData(res.data) })
    }, 4000)
    return () => clearInterval(t)
  }, [running])

  if (!data?.domain) return null
  const working = data.redirects.filter(r => r.is_enabled && r.target_path).length
  // A failed lookup or an old site we found nothing for needs no words - nothing for them to do.
  if (!running && !working) return null

  return (
    <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#FAFAF7] p-2.5 text-[12px] font-semibold leading-snug text-gray-600 dark:bg-white/[0.04] dark:text-white/60">
      {running
        ? <><Loader2 className="mt-px h-3.5 w-3.5 shrink-0 animate-spin text-[#C9A24D]" /> Checking for pages from your old website...</>
        : <><History className="mt-px h-3.5 w-3.5 shrink-0 text-[#C9A24D]" /> {working} {working === 1 ? 'page' : 'pages'} from your old website now {working === 1 ? 'goes' : 'go'} to the matching page here. Nothing for you to do. <Check className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" /></>}
    </p>
  )
}
