'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Printer } from 'lucide-react'
import { useQrDataUrl } from '@/lib/qr'
import { daysText, invitesApi, placeText, type PublicInvite } from '@/lib/invites'
import InviteCard from '@/components/invites/InviteCard'
import { SERIF } from '@/components/invites/inviteFonts'

// The printable invite (user, 10/24: "make invites printable - a printable invite sheet with the QR
// code that opens the invite"): one letter-size page - the invitation card itself, big, and a QR
// that opens the RSVP page, with the short link written out for anyone without a camera.
// Opened from Share -> QR code -> Printable invite (a new tab - never the same one).
export default function PrintInvitePage() {
  const { code } = useParams<{ code: string }>()
  const [inv, setInv] = useState<PublicInvite | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    invitesApi.publicGet(code).then(r => { if (r.success) setInv(r.data); else setMissing(true) })
  }, [code])
  const link = inv ? inv.share_url : ''
  const qr = useQrDataUrl(link ? `${link}${link.includes('?') ? '&' : '?'}src=print` : null, { size: 900, dark: '#111827' })

  if (missing) return <div className="grid min-h-screen place-items-center bg-white text-sm font-bold text-gray-500">This invitation isn&apos;t available.</div>
  if (!inv) return <div className="grid min-h-screen place-items-center bg-[#f4f2ee]"><Loader2 className="h-6 w-6 animate-spin text-[#a8843a]" /></div>
  const card = { ...inv, hostName: inv.agent.name, hostBrokerage: inv.agent.brokerage, hostPhoto: inv.agent.photo_url, hostArea: inv.agent.market || null }
  const when = daysText(inv.dates || [])
  return (
    <div className="min-h-screen bg-[#f4f2ee] print:bg-white" data-testid="invite-print-page">
      <style>{'@page{size:letter;margin:0.45in}@media print{.no-print{display:none!important}.sheet{box-shadow:none!important;margin:0!important;width:auto!important;min-height:auto!important}}'}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/5 bg-white/95 px-4 py-3">
        <p className="min-w-0 truncate text-[13px] font-bold text-gray-600" style={{ fontFamily: 'system-ui, sans-serif' }}>Printable invite · {inv.title}</p>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#111827] px-4 text-[12px] font-black uppercase tracking-wider text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>
      <div className="sheet mx-auto my-6 flex w-[min(8.5in,100%-24px)] flex-col items-center bg-white px-6 py-8 shadow-[0_30px_70px_-40px_rgba(0,0,0,.5)] sm:px-12" style={{ minHeight: '10in' }}>
        <div className="w-full max-w-[380px]"><InviteCard data={card} shine={false} /></div>
        <div className="mt-8 flex w-full max-w-[560px] items-center gap-6 rounded-3xl border border-black/10 p-5">
          {qr ? <img src={qr} alt="QR code - scan to RSVP" className="h-36 w-36 shrink-0" /> : <span className="h-36 w-36 shrink-0 animate-pulse rounded-xl bg-gray-100" />}
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#a8843a]" style={{ fontFamily: 'system-ui, sans-serif' }}>Scan to RSVP</p>
            <p className="mt-1 text-[26px] font-bold leading-tight text-[#1f1b16]" style={{ fontFamily: SERIF }}>Point your camera here</p>
            <p className="mt-1 text-[13px] text-gray-600" style={{ fontFamily: 'system-ui, sans-serif' }}>{[when, placeText(inv)].filter(Boolean).join(' · ')}</p>
            <p className="mt-2 break-all text-[13px] font-bold text-[#1f1b16]" style={{ fontFamily: 'system-ui, sans-serif' }}>{link.replace(/^https?:\/\//, '')}</p>
          </div>
        </div>
        {inv.agent.name && (
          <p className="mt-6 text-center text-[12px] text-gray-500" style={{ fontFamily: 'system-ui, sans-serif' }}>
            Hosted by <b className="text-[#1f1b16]">{inv.agent.name}</b>{inv.agent.brokerage ? ` · ${inv.agent.brokerage}` : ''}{inv.agent.phone ? ` · ${inv.agent.phone}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
