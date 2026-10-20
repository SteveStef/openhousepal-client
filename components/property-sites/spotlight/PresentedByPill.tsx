import type { PropertySiteAgent } from './model'

/**
 * The Spotlight footer's "Presented by" row as the agent pill from the link-preview cards (user,
 * 10/19): their real headshot at 84px (initials when there's none) in a ring of the page's accent,
 * "Presented by", the name, and the brokerage in the accent - the same thing a texted link shows.
 * `tone` = the footer it sits on (Cinematic Luxury's black, Editorial Estate's deep green).
 */
export default function PresentedByPill({ agent, tone = 'dark', className = '' }: { agent: PropertySiteAgent; tone?: 'dark' | 'light'; className?: string }) {
  const initials = agent.name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const dark = tone === 'dark'
  return (
    <div
      data-presented-by
      className={`inline-flex max-w-full items-center gap-4 rounded-full border py-2 pl-2 pr-6 ${dark ? 'bg-black/45 text-white' : 'bg-white/75 text-[#16130e] shadow-[0_14px_30px_-18px_rgba(22,19,14,.45)]'} ${className}`}
      style={{ borderColor: 'color-mix(in srgb, var(--sp-accent) 45%, transparent)' }}
    >
      {agent.photo_url ? (
        <img src={agent.photo_url} alt={agent.name} loading="lazy" width={84} height={84} className="h-[84px] w-[84px] shrink-0 rounded-full border-[3px] object-cover" style={{ borderColor: 'color-mix(in srgb, var(--sp-accent) 70%, white)' }} />
      ) : (
        <span className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full text-[28px] font-black" style={{ background: 'var(--sp-accent)', color: 'var(--sp-on-accent)' }}>{initials}</span>
      )}
      <span className="flex min-w-0 flex-col text-left">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-60">Presented by</span>
        <span className="mt-1 truncate text-[22px] font-black normal-case leading-tight tracking-normal sm:text-[26px]">{agent.name}</span>
        {agent.brokerage && (
          <span className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: dark ? 'color-mix(in srgb, var(--sp-accent) 55%, white)' : 'color-mix(in srgb, var(--sp-accent) 70%, #16130e)' }}>{agent.brokerage}</span>
        )}
      </span>
    </div>
  )
}
