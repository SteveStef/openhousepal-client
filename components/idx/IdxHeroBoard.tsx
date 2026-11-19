import { Bath, Bed, Globe, Lock, MapPin, Search, Star } from 'lucide-react'

// The IDX Websites page's hero picture (owner 11/18: as rich as the Brokerages page): a sketch of an
// agent's IDX website - address bar, search, homes, a town card and a lead landing in Leads. An
// illustration, not real listings (no prices or addresses that could be mistaken for real homes).
const HOMES = [
  { tone: 'from-[#c9b79a] via-[#8f7a5c] to-[#4b3e2c]', tag: 'New', beds: 4, baths: 3 },
  { tone: 'from-[#9fb3c8] via-[#5f7590] to-[#2c3a4d]', tag: 'Open Sun', beds: 3, baths: 2 },
  { tone: 'from-[#b9c6a6] via-[#7b8c63] to-[#3d4a2e]', tag: 'Featured', beds: 5, baths: 4 },
]

export default function IdxHeroBoard() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]" aria-hidden>
      <span className="br-orb absolute -right-10 -top-10 -z-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.35),transparent_70%)]" />
      <div className="br-float overflow-hidden rounded-[22px] bg-white shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-[#C9A24D]/40">
        {/* browser bar */}
        <div className="flex items-center gap-2 border-b border-gray-200 bg-[#f4f2ee] px-3 py-2.5">
          <span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" /></span>
          <span className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-500 ring-1 ring-gray-200">
            <Lock className="h-3 w-3 shrink-0 text-emerald-600" /><span className="truncate">yourname.com</span>
          </span>
        </div>
        {/* site hero */}
        <div className="relative bg-[radial-gradient(120%_120%_at_20%_0%,#1f2a3d_0%,#111827_60%)] px-5 pb-5 pt-6 text-white">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">Your name · Your brokerage</p>
          <p className="mt-1.5 font-serif text-[22px] font-black leading-tight">Find your next home <span className="mk-gold italic">here</span></p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-gray-400">
            <Search className="h-3.5 w-3.5 text-[#C9A24D]" /> City, ZIP or address
            <span className="ml-auto rounded-lg bg-[#C9A24D] px-2 py-1 text-[10px] font-black text-[#111827]">Search</span>
          </div>
        </div>
        {/* homes */}
        <div className="grid grid-cols-3 gap-2 bg-white p-3">
          {HOMES.map((h, i) => (
            <div key={i} className="overflow-hidden rounded-xl ring-1 ring-gray-200">
              <div className={`relative h-16 bg-gradient-to-br ${h.tone}`}>
                <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-black text-[#111827]">{h.tag}</span>
                <span className="absolute inset-x-3 bottom-0 h-7 rounded-t-md bg-white/25" />
              </div>
              <div className="px-2 py-1.5">
                <span className="block h-2 w-3/4 rounded bg-gray-800/80" />
                <span className="mt-1.5 flex gap-2 text-[8.5px] font-bold text-gray-500"><span className="inline-flex items-center gap-0.5"><Bed className="h-2.5 w-2.5" />{h.beds}</span><span className="inline-flex items-center gap-0.5"><Bath className="h-2.5 w-2.5" />{h.baths}</span></span>
              </div>
            </div>
          ))}
        </div>
        {/* town + map strip */}
        <div className="grid grid-cols-[1.2fr_1fr] gap-2 bg-white px-3 pb-3">
          <div className="rounded-xl bg-[#fbf6ec] p-2.5 ring-1 ring-[#C9A24D]/30">
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#8b6a2b]"><MapPin className="h-3 w-3" /> Town guide</p>
            <span className="mt-1.5 block h-2 w-2/3 rounded bg-gray-800/70" />
            <span className="mt-1 block h-1.5 w-5/6 rounded bg-gray-300" />
            <span className="mt-1 block h-1.5 w-1/2 rounded bg-gray-300" />
          </div>
          <div className="relative overflow-hidden rounded-xl bg-[#e8eef3] ring-1 ring-gray-200">
            <span className="absolute inset-0 bg-[linear-gradient(rgba(17,24,39,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,.06)_1px,transparent_1px)] bg-[size:14px_14px]" />
            {[['22%', '30%'], ['60%', '22%'], ['44%', '62%'], ['76%', '58%']].map(([l, t]) => (
              <span key={l + t} className="absolute grid h-4 w-4 place-items-center rounded-full bg-[#111827] text-[#e8c97a]" style={{ left: l, top: t }}><span className="h-1.5 w-1.5 rounded-full bg-[#e8c97a]" /></span>
            ))}
          </div>
        </div>
      </div>
      {/* a lead landing in Leads */}
      <div className="br-float absolute -bottom-6 -left-4 w-[230px] rounded-2xl bg-[#111827] p-3 text-white shadow-2xl ring-1 ring-[#C9A24D]/40 sm:-left-8" style={{ animationDelay: '1.6s' }}>
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#e8c97a]"><span className="relative grid h-2 w-2 place-items-center"><span className="br-pulse absolute h-2 w-2 rounded-full bg-emerald-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></span> New lead · from your website</p>
        <p className="mt-1 text-[12.5px] font-bold">&ldquo;Can I see this home Saturday?&rdquo;</p>
        <p className="mt-0.5 text-[10.5px] font-semibold text-gray-400">Showing request · in your Leads</p>
      </div>
      <div className="br-float absolute -right-3 top-[52%] hidden rounded-2xl bg-white px-3 py-2 shadow-xl ring-1 ring-[#C9A24D]/40 sm:block" style={{ animationDelay: '.8s' }}>
        <p className="flex items-center gap-1 text-[10px] font-black text-[#111827]"><Globe className="h-3 w-3 text-[#C9A24D]" /> On Google</p>
        <p className="mt-0.5 flex gap-0.5 text-[#C9A24D]">{[0, 1, 2, 3, 4].map(i => <Star key={i} className="h-2.5 w-2.5 fill-current" />)}</p>
      </div>
    </div>
  )
}
