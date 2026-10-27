import type { Metadata } from 'next'
import { LayoutDashboard } from 'lucide-react'
import { OhpWordmark } from '@/components/brand/OhpBrand'

// One person's "mark as done" link from a calendar event - never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Every follow-up link page (mark as done, tap-to-text) opens in the phone's browser from a calendar
// event or a text - with no way back into the app once it's done (user, 10/25: "I keep finding myself
// completing it and not finding a way to go back to OpenHousePal"). The OpenHousePal logo top left,
// like every app page - and here it goes to the Dashboard, not the home page (owner, 10/27). Plain
// <a>s, not <Link>: these are visitor pages (no sign-in wrapper), and a client-side Link would carry
// that layout into the dashboard.
export default function DoneLinkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      <style>{`@keyframes dnNav{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}.dn-nav{animation:dnNav .5s cubic-bezier(.22,1,.36,1) both}@media (prefers-reduced-motion:reduce){.dn-nav{animation:none}}`}</style>
      <nav className="dn-nav sticky top-0 z-40 flex items-center justify-between gap-3 bg-[#0B0B0B]/95 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),12px)]">
        <a href="/dash" aria-label="OpenHousePal - go to your Dashboard" className="inline-flex items-center rounded-lg py-1 transition active:scale-95 hover:opacity-90">
          <OhpWordmark animate onDark className="text-[21px] text-white" />
        </a>
        <a href="/dash"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95 hover:border-[#C9A24D]/60 hover:text-[#e8c97a]">
          <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
        </a>
      </nav>
      {children}
    </div>
  )
}
