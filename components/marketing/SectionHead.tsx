import type { ReactNode } from 'react'

// The Brokerages page's section heading, shared by the other marketing pages (owner 11/18: bring
// IDX Websites, About and Resources up to the Brokerages page's level). Needs BROKER_CSS on the page
// for the gold ink (br-ink-gold) and MarketingMotion for the reveal.
export default function SectionHead({ kicker, title, accent, lead, center = false }: { kicker: string; title: string; accent?: string; lead?: ReactNode; center?: boolean }) {
  const at = accent ? title.lastIndexOf(accent) : -1
  return (
    <div data-reveal="" className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8b7355] dark:text-[#e8c97a]">{kicker}</p>
      <h2 className="mt-2 font-serif text-[2rem] font-black leading-[1.05] tracking-tight text-[#0B0B0B] dark:text-white sm:text-5xl">
        {at >= 0 ? <>{title.slice(0, at)}<em className="br-ink-gold font-serif italic">{accent}</em>{title.slice(at + (accent?.length || 0))}</> : title}
      </h2>
      <span aria-hidden className={`mt-4 block h-1 w-14 rounded-full bg-gradient-to-r from-[#C9A24D] to-[#f3dfa8] ${center ? 'mx-auto' : ''}`} />
      {lead && <div className={`mt-4 text-base font-medium leading-relaxed text-[#6B7280] dark:text-gray-400 sm:text-lg ${center ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}>{lead}</div>}
    </div>
  )
}
