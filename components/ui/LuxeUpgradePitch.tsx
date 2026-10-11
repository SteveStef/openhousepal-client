'use client'

import Link from 'next/link'
import { Crown, ArrowRight } from 'lucide-react'

// The one upgrade pitch every OpenHousePal Luxe option shows to a plan below IDX (Agent Hub
// theme, Luxe article theme): they can look at Luxe all they like, this is how they keep it.
export const LUXE_UPGRADE_HREF = (feature: string, tier = 'IDX') => `/upgrade-required?feature=${encodeURIComponent(feature)}&tier=${tier}`

export default function LuxeUpgradePitch({ feature, text, className = '', floating = false, tier = 'IDX', tierLabel = 'IDX' }: { feature: string; text?: string; className?: string; floating?: boolean; tier?: string; tierLabel?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_160%_at_100%_0%,rgba(201,162,77,.38),transparent_55%),linear-gradient(135deg,#0b0f0e,#111827_55%,#2a2218)] p-[1px] ${floating ? 'shadow-[0_24px_60px_-20px_rgba(0,0,0,.7)]' : 'shadow-[0_18px_40px_-26px_rgba(17,24,39,.9)]'} ${className}`}>
      <div className="relative flex flex-wrap items-center gap-3 rounded-[15px] px-4 py-3.5 text-white sm:flex-nowrap">
        <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e8c97a] to-transparent" />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f3dfa8] via-[#C9A24D] to-[#8b6a2b] shadow-[0_0_18px_rgba(201,162,77,.55)]">
          <Crown className="h-5 w-5 text-[#111827]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base font-black leading-tight">OpenHousePal <em className="font-light text-[#e8c97a]">Luxe</em> comes with {tierLabel}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-white/65">{text || `You can preview it here as much as you like - upgrade to ${tierLabel} to make it yours.`}</p>
        </div>
        <Link href={LUXE_UPGRADE_HREF(feature, tier)} className="lx-pitch-cta relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] px-4 py-2 text-xs font-black text-[#111827] shadow-[0_10px_24px_-10px_rgba(201,162,77,.9)] transition hover:-translate-y-0.5">
          Upgrade to {tierLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <style>{`.lx-pitch-cta:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);transform:translateX(-100%);animation:lxPitch 3.4s ease-in-out infinite}@keyframes lxPitch{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}@media (prefers-reduced-motion:reduce){.lx-pitch-cta:after{animation:none}}`}</style>
    </div>
  )
}
