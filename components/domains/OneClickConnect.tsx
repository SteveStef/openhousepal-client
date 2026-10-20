'use client'

// "GoDaddy/Cloudflare/... can do this for you" - Domain Connect (backend domain_connect_service).
// Only shows when the agent's own domain company has switched on our template; otherwise nothing
// renders and the step-by-step guide below it is the way.
import { useEffect, useState } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import api from '@/lib/api-service'
import type { OneClick } from '@/lib/domainShop'

export default function OneClickConnect({ domainId, back = 'website' }: { domainId: string; back?: string }) {
  const [info, setInfo] = useState<OneClick | null>(null)
  const [going, setGoing] = useState(false)
  useEffect(() => {
    api.sites.getOneClick(domainId, back).then(r => { if (r.success && r.data) setInfo(r.data) })
  }, [domainId, back])
  if (!info?.supported || !info.url) return null
  return (
    <div className="mt-3 rounded-2xl border-2 border-[#C9A24D] bg-gradient-to-br from-[#fffdf8] to-[#f6ecd6] p-3.5 shadow-sm dark:from-[#1a1710] dark:to-[#111827]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">The easy way</p>
      <p className="mt-1 text-[13.5px] font-black text-[#111827] dark:text-white">{info.company || 'Your domain company'} can connect it for you</p>
      <p className="mt-0.5 text-[12px] font-semibold leading-snug text-gray-600 dark:text-white/60">
        Click below, sign in to {info.company || 'your domain company'}, and press Connect. They add everything for you and send you back here - no typing.
      </p>
      <button
        type="button"
        onClick={() => { setGoing(true); window.location.href = info.url! }}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-3 text-xs font-black uppercase tracking-wide text-[#111827] shadow-md shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        {going ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Connect automatically
      </button>
      <p className="mt-2 text-center text-[11px] font-semibold text-gray-400">Rather do it by hand? The steps are below.</p>
    </div>
  )
}
