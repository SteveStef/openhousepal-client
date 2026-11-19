import { Bell, Check, Clock, Globe, Heart, Home, Inbox, Layers, Palette, QrCode, Search, UserRound } from 'lucide-react'

// Small pictures for the About page (owner 11/18: fewer words, more visuals). Sketches only.
const Bar = ({ w, c = 'bg-white/30', h = 'h-1.5' }: { w: string; c?: string; h?: string }) => <span className={`block ${h} rounded ${c}`} style={{ width: w }} />

export function PartArt({ kind }: { kind: 'oh' | 'leads' | 'clients' | 'marketing' | 'site' }) {
  const box = 'relative h-[78px] w-[104px] shrink-0 sm:h-[86px] sm:w-[118px]'
  if (kind === 'oh') return (
    <div aria-hidden className={box}>
      <span className="br-float absolute left-0 top-1 grid h-[62px] w-[62px] place-items-center rounded-2xl bg-white text-[#111827] shadow-xl ring-1 ring-[#C9A24D]/50"><QrCode className="h-9 w-9" /></span>
      <span className="br-float absolute bottom-0 right-0 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] px-2.5 py-1 text-[10px] font-black text-[#111827] shadow-lg" style={{ animationDelay: '1s' }}><Check className="h-3 w-3" strokeWidth={3} /> Signed in</span>
    </div>
  )
  if (kind === 'leads') return (
    <div aria-hidden className={box}>
      <div className="absolute inset-x-0 top-1 space-y-1.5 rounded-2xl bg-white/[0.07] p-2 ring-1 ring-white/15">
        {['bg-emerald-400', 'bg-[#e8c97a]', 'bg-sky-400'].map((c, i) => <span key={c} className="flex items-center gap-1.5"><i className={`h-2 w-2 shrink-0 rounded-full ${c}`} /><Bar w={['75%', '60%', '68%'][i]} /></span>)}
      </div>
      <span className="br-float absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-lg"><Bell className="h-4 w-4" /></span>
    </div>
  )
  if (kind === 'clients') return (
    <div aria-hidden className={box}>
      <div className="absolute left-0 top-0 w-[68px] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-[#C9A24D]/50">
        <span className="relative block h-9 bg-gradient-to-br from-[#9fb3c8] via-[#5f7590] to-[#2c3a4d]"><Heart className="absolute right-1 top-1 h-3.5 w-3.5 fill-rose-400 text-rose-400" /></span>
        <span className="block p-1.5"><Bar w="80%" c="bg-gray-700/70" /></span>
      </div>
      <span className="br-float absolute bottom-0 right-0 flex h-12 items-end gap-1 rounded-xl bg-white/[0.08] px-2 pb-1.5 pt-2 ring-1 ring-white/15" style={{ animationDelay: '.8s' }}>
        {[14, 24, 19, 30].map((h, i) => <i key={i} className="w-2 rounded-sm bg-gradient-to-t from-[#8b6a2b] to-[#e8c97a]" style={{ height: h }} />)}
      </span>
    </div>
  )
  if (kind === 'marketing') return (
    <div aria-hidden className={box}>
      <span className="absolute left-1 top-2 block h-[70px] w-[52px] -rotate-6 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-[#C9A24D]/40"><span className="block h-8 bg-gradient-to-br from-[#c9b79a] to-[#4b3e2c]" /><span className="block p-1"><Bar w="80%" c="bg-gray-700/70" /></span></span>
      <span className="br-float absolute right-1 top-0 block h-[70px] w-[52px] rotate-6 overflow-hidden rounded-lg bg-[#111827] shadow-xl ring-1 ring-[#C9A24D]/60"><span className="block h-8 bg-gradient-to-br from-[#b9c6a6] to-[#3d4a2e]" /><span className="block p-1"><Bar w="70%" c="bg-[#e8c97a]/80" /></span><span className="mx-1 block rounded bg-[#C9A24D] py-0.5 text-center text-[6px] font-black text-[#111827]">JUST SOLD</span></span>
    </div>
  )
  return (
    <div aria-hidden className={box}>
      <div className="absolute inset-x-0 top-1 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-[#C9A24D]/50">
        <span className="flex gap-1 bg-[#f4f2ee] px-2 py-1.5">{['bg-[#ff5f57]', 'bg-[#febc2e]', 'bg-[#28c840]'].map(c => <i key={c} className={`h-1.5 w-1.5 rounded-full ${c}`} />)}</span>
        <span className="block bg-[#111827] px-2 py-2"><span className="flex items-center gap-1 rounded bg-white px-1.5 py-1"><Search className="h-2.5 w-2.5 text-[#C9A24D]" /><Bar w="60%" c="bg-gray-300" h="h-1" /></span></span>
        <span className="grid grid-cols-3 gap-1 p-1.5">{[0, 1, 2].map(i => <i key={i} className="h-4 rounded bg-gradient-to-br from-[#c9b79a] to-[#8f7a5c]" />)}</span>
      </div>
      <span className="br-float absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-lg" style={{ animationDelay: '.6s' }}><Globe className="h-3.5 w-3.5" /></span>
    </div>
  )
}

export function BeliefArt({ kind }: { kind: 'one' | 'less' | 'brand' }) {
  if (kind === 'one') return (
    <div aria-hidden className="relative mx-auto h-24 w-24 sm:h-28 sm:w-28">
      <span className="absolute inset-3 rounded-full border border-dashed border-[#C9A24D]/50" />
      <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827] shadow-xl"><Layers className="h-5 w-5" /></span>
      {[[Home, 'left-1/2 top-0 -translate-x-1/2'], [Inbox, 'right-0 top-1/2 -translate-y-1/2'], [Palette, 'bottom-0 left-1/2 -translate-x-1/2'], [Globe, 'left-0 top-1/2 -translate-y-1/2']].map(([I, pos], i) => {
        const Icon = I as typeof Home
        return <span key={i} className={`br-float absolute grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[#e8c97a] ring-1 ring-white/20 ${pos as string}`} style={{ animationDelay: `${i * 0.5}s` }}><Icon className="h-3.5 w-3.5" /></span>
      })}
    </div>
  )
  if (kind === 'less') return (
    <div aria-hidden className="relative mx-auto w-36 space-y-1.5">
      {['Sign-in sheet', 'Reminder', 'Flyer'].map(t => (
        <span key={t} className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-2 py-1.5 text-[10px] font-black text-gray-200 ring-1 ring-white/10">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e8c97a] to-[#C9A24D] text-[#111827]"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></span>{t}
        </span>
      ))}
      <span className="br-float absolute -right-5 -top-4 grid h-8 w-8 place-items-center rounded-full bg-white text-[#111827] shadow-lg"><Clock className="h-4 w-4" /></span>
    </div>
  )
  return (
    <div aria-hidden className="relative mx-auto w-28 rounded-2xl bg-white p-2.5 shadow-xl ring-1 ring-[#C9A24D]/50 sm:w-32">
      <span className="flex items-center gap-1.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] text-[#111827]"><UserRound className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 space-y-1"><Bar w="90%" c="bg-gray-800/80" h="h-2" /><Bar w="60%" c="bg-gray-300" /></span>
      </span>
      <span className="mt-2 flex items-center justify-between"><span className="text-[10px] font-black text-[#111827]">You</span><span className="text-[7px] font-bold text-gray-300">OpenHousePal</span></span>
    </div>
  )
}
