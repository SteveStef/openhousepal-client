'use client'

// Guest Pass demo (brokerages page, owner 11/18: "the sign in then the guest pass then the kits then
// showcases"). What a guest's phone opens right after they sign in (components/guest-pass/GuestPass):
// the home they're standing in, its Similar Homes and Cheat Sheet, and one-tap requests - we already
// have their details. Same real listing, homes and agent as the other demos (realData) - nothing invented.
import { useEffect, useState } from 'react'
import Image from '@/components/ui/CachedImage'
import { Check, FileText, Home, MessageSquare, RotateCcw, ScanSearch, Ticket, Sparkles } from 'lucide-react'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { AGENT, REAL_OPEN_HOUSE as OH, REAL_SIMILAR_HOMES as SIMILAR } from './realData'

type Step = 'title' | 'pass' | 'similar' | 'ask' | 'sent'
const ORDER: Step[] = ['title', 'pass', 'similar', 'ask', 'sent']
const HOLD: Record<Step, number> = { title: 4200, pass: 4200, similar: 4200, ask: 2600, sent: 3800 }
const money = (n: number) => `$${n.toLocaleString('en-US')}`
const first = AGENT.name.split(' ')[0]

export default function GuestPassDemo() {
  const [i, setI] = useState(0)
  const step = ORDER[i]
  useEffect(() => {
    const t = setTimeout(() => setI(n => (n + 1) % ORDER.length), HOLD[step])
    return () => clearTimeout(t)
  }, [step])

  if (step === 'title') {
    return <TitleSlide icon={Ticket} kicker="Right after they sign in" title="Guest Pass" body="The home they're standing in, on their phone." totalPages={ORDER.length} pageIndex={0} durationMs={HOLD.title} url="openhousepal.com" />
  }
  const url = 'openhousepal.com/open-house/pass'
  return (
    <BrowserFrame url={url} progress={{ pages: ORDER.length, current: i, durationMs: HOLD[step] }}>
      <div className="mx-auto w-full max-w-[360px] bg-[#FAFAF7] px-3 py-4 dark:bg-[#0d0d0f]" data-testid="guest-pass-demo">
        {step === 'pass' || step === 'ask' || step === 'sent' ? (
          <div key="pass" className="animate-fadeIn">
            <div className="relative overflow-hidden rounded-2xl">
              <div className="relative aspect-[2/1] w-full"><Image src={OH.photo} alt="" fill sizes="360px" className="object-cover" /></div>
              {step === 'sent' && (
                <div className="absolute inset-x-2 bottom-2 flex animate-fadeIn items-start gap-2 rounded-xl bg-emerald-600/95 p-2.5 text-[11.5px] font-bold text-white shadow-lg" data-testid="guest-pass-demo-sent">
                  <Check className="mt-px h-3.5 w-3.5 shrink-0" /> Sent to {first} - no forms, we already have your details.
                </div>
              )}
              <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#111827]/85 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#e8c97a]"><Ticket className="h-3 w-3" /> Your Guest Pass</span>
            </div>
            <p className="mt-3 font-serif text-[22px] font-black leading-none text-[#111827] dark:text-white">{money(OH.price)}</p>
            <p className="mt-1 text-[13px] font-bold text-[#111827] dark:text-white">{OH.address}, {OH.city}</p>
            <p className="text-[11.5px] font-semibold text-gray-500">{OH.beds} beds · {OH.baths} baths · {OH.sqft.toLocaleString('en-US')} sqft</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { icon: ScanSearch, label: 'Similar Homes' },
                { icon: FileText, label: 'Cheat Sheet' },
                { icon: Home, label: 'Seller disclosures', hot: step === 'ask' },
                { icon: RotateCcw, label: 'Second tour' },
              ].map(b => (
                <span key={b.label} className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11.5px] font-black transition ${b.hot
                  ? 'scale-[0.97] border-[#C9A24D] bg-[#C9A24D]/15 text-[#8b6a2b]'
                  : 'border-gray-200 bg-white text-[#111827] dark:border-white/10 dark:bg-white/[0.04] dark:text-white'}`}>
                  <b.icon className="h-3.5 w-3.5 shrink-0 text-[#C9A24D]" /> {b.label}
                </span>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-[11.5px] font-bold text-gray-500 dark:border-white/10 dark:bg-white/[0.04]">
              <MessageSquare className="h-3.5 w-3.5 text-[#C9A24D]" /> Ask {first} a question
            </div>
          </div>
        ) : (
          <div key="similar" className="animate-fadeIn">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#8b7355]"><Sparkles className="h-3.5 w-3.5" /> Similar homes nearby</p>
            <div className="mt-2 space-y-2">
              {SIMILAR.slice(0, 3).map(h => (
                <div key={h.address} className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg"><Image src={h.photo} alt="" fill sizes="64px" className="object-cover" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black text-[#111827] dark:text-white">{h.address}</p>
                    <p className="text-[11px] font-semibold text-gray-500">{money(h.price)} · {h.beds} bd · {h.baths} ba</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BrowserFrame>
  )
}
