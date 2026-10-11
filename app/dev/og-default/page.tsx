import { OhpHouse, OhpWordmark } from '@/components/brand/OhpBrand'

// Dev-only: the 1200x630 picture public/og-image.png is captured from (the default link preview
// for openhousepal.com pages). Re-capture it if the logo or tagline changes.
const CHIPS = ['Open Houses', 'Showcases', 'IDX Website', 'AI CMAs', 'AI Media', 'Lead Pipeline']

export default function OgDefault() {
  return (
    <div id="og" className="dark relative flex h-[630px] w-[1200px] flex-col items-center justify-center overflow-hidden bg-[#0B0B0B] text-white"
      style={{ backgroundImage: 'radial-gradient(760px 420px at 85% 0%, rgba(201,162,77,.32), transparent 70%), radial-gradient(640px 380px at 0% 100%, rgba(201,162,77,.18), transparent 70%)' }}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(70% 70% at 50% 45%,#000,transparent 80%)' }} />
      <OhpHouse onDark className="pointer-events-none absolute -right-16 -bottom-24 h-[520px] text-white opacity-[0.03]" />
      <div className="absolute inset-[22px] rounded-[6px] border border-[#e8c97a]/30" />
      <p className="relative mb-7 flex items-center gap-4 text-[17px] font-black uppercase tracking-[0.42em] text-[#e8c97a]"><span className="h-px w-12 bg-[#C9A24D]" />For real estate agents<span className="h-px w-12 bg-[#C9A24D]" /></p>
      <OhpWordmark onDark className="relative text-[118px] text-white" />
      <p className="relative mt-7 font-serif text-[40px] font-black tracking-tight text-white/90">The tools agents <em className="font-light text-[#e8c97a]">actually</em> need.</p>
      <div className="relative mt-9 flex gap-3">
        {CHIPS.map(c => <span key={c} className="rounded-full border border-[#C9A24D]/40 bg-white/[0.05] px-5 py-2 text-[17px] font-black text-white/85">{c}</span>)}
      </div>
    </div>
  )
}
