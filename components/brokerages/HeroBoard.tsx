import { CalendarClock, Inbox, Layout, QrCode, Send } from 'lucide-react'

// The hero's picture: what happens on its own after one visitor signs in at an agent's open house.
// Pure CSS loop (opacity + transform), no script. Generic wording only, no made-up people or numbers.
const ROWS = [
  { icon: QrCode, title: 'Visitor signed in', note: 'On their own phone, no app' },
  { icon: Inbox, title: 'Added to Leads', note: 'Tagged with this open house' },
  { icon: CalendarClock, title: 'Follow-up scheduled', note: 'Tomorrow morning, message written' },
  { icon: Send, title: 'Sent to the CRM', note: 'With the lead source' },
  { icon: Layout, title: 'Showcase ready', note: 'Similar homes to share' },
]

export default function HeroBoard() {
  return (
    <div className="relative mx-auto w-full max-w-[440px]">
      <div aria-hidden className="br-orb absolute -left-10 -top-10 -z-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.35),transparent_68%)]" />
      <div aria-hidden className="br-orb absolute -bottom-12 -right-8 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(90,120,190,.28),transparent_68%)]" style={{ animationDelay: '-6s' }} />
      <div className="br-float rounded-[28px] bg-gradient-to-br from-[#f3dfa8]/60 via-[#C9A24D]/25 to-transparent p-px shadow-[0_40px_80px_-40px_rgba(0,0,0,.9)]">
        <div className="rounded-[27px] bg-[#0f1219] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#e8c97a]">At every open house</p>
              <p className="mt-1 truncate font-serif text-xl font-black text-white">Saturday, 1 to 3 PM</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-black text-emerald-300">
              <span className="relative grid h-2 w-2 place-items-center"><span className="br-pulse absolute h-2 w-2 rounded-full bg-emerald-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></span>
              Live
            </span>
          </div>
          <ol className="mt-5 space-y-2.5">
            {ROWS.map((r, i) => (
              <li key={r.title} className="br-row flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3" style={{ ['--rd' as string]: `${i * 0.85}s` }}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><r.icon className="h-[18px] w-[18px]" strokeWidth={2.4} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-black text-white">{r.title}</span>
                  <span className="block truncate text-[13px] font-medium text-gray-400">{r.note}</span>
                </span>
                <span aria-hidden className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[13px] font-black text-emerald-300">&#10003;</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-center text-[12px] font-semibold text-gray-500">Runs on its own once it&apos;s set up. Showcases come with Premium and IDX.</p>
        </div>
      </div>
    </div>
  )
}
