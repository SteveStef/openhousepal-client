import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'

// One person's "mark as done" link from a calendar event - never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Every follow-up link page (mark as done, tap-to-text) opens in the phone's browser from a calendar
// event or a text - with no way back into the app once it's done (user, 10/25: "I keep finding myself
// completing it and not finding a way to go back to OpenHousePal"). One bar, every page. A plain <a>,
// not <Link>: these are visitor pages (no sign-in wrapper), and a client-side Link would carry that
// layout into the dashboard.
export default function DoneLinkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0B0B]">
      <nav className="sticky top-0 z-40 flex items-center bg-[#0B0B0B] px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <a href="/dash"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-black text-white transition active:scale-95 hover:border-[#C9A24D]/60 hover:text-[#e8c97a]">
          <ArrowLeft className="h-4 w-4" /> Back to OpenHousePal
        </a>
      </nav>
      {children}
    </div>
  )
}
