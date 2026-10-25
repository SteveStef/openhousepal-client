'use client'

import Link from 'next/link'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import { MlsUpdatedText } from '@/components/MLSComplianceFooter'
import { useOptionalAuth } from '@/contexts/AuthContext'
import { hasMlsAccess } from '@/lib/navAccess'

export default function Footer() {
  // A signed-in No-MLS agent never sees Bright data in the app, so the Bright notice would only
  // confuse them (and implies a Bright connection they don't have). Everyone else keeps it.
  const user = useOptionalAuth()?.user
  const noMlsAgent = !!user?.plan_tier && !hasMlsAccess(user.plan_tier) && !user.is_admin
  return (
    <footer className="relative isolate mt-auto overflow-hidden bg-[#0B0B0B] py-16 text-white">
      {/* gold edge, soft gold light and a faint grid - the same language as the page headers */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A24D]/80 to-transparent" />
      <div className="ohp-foot-sweep pointer-events-none absolute inset-x-0 top-0 h-px" />
      <div className="pointer-events-none absolute -top-40 left-1/4 h-80 w-[36rem] rounded-full bg-[#C9A24D]/[0.09] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-[#C9A24D]/[0.06] blur-3xl" />
      <div className="ohp-foot-grid pointer-events-none absolute inset-0" />
      <style>{`.ohp-foot-sweep{background:linear-gradient(90deg,transparent 30%,#f1d58b 50%,transparent 70%);background-size:220% 100%;animation:ohpFootSweep 8s ease-in-out infinite}@keyframes ohpFootSweep{0%{background-position:160% 0}100%{background-position:-60% 0}}.ohp-foot-grid{background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:38px 38px;-webkit-mask-image:radial-gradient(60% 70% at 20% 0%,#000,transparent 75%);mask-image:radial-gradient(60% 70% at 20% 0%,#000,transparent 75%)}@media (prefers-reduced-motion:reduce){.ohp-foot-sweep{animation:none}}`}</style>
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center space-x-3">
              <OhpWordmark onDark className="text-[28px] text-white" />
            </div>
            <div className="h-px w-16 bg-gradient-to-r from-[#C9A24D] to-transparent" />
            <p className="text-gray-400 text-base leading-relaxed max-w-sm">
              The all-in-one platform for real estate agents - open houses, CMAs, client showcases, your Agent Hub, blog, and a full IDX website, with lead capture and follow-ups handled for you.
            </p>
          </div>

          {/* Links Section - kept side by side even on the narrowest phones (there's room for two
              short columns), instead of stacking Platform on top of Legal. */}
          <div className="lg:col-span-7 flex flex-row gap-12 sm:gap-20 md:gap-24 lg:justify-end">
            <div className="flex flex-col space-y-6">
              <h5 className="flex items-center gap-2 font-bold text-xs text-[#C9A24D] uppercase tracking-[0.25em]"><span className="h-px w-5 bg-[#C9A24D]/60" />Platform</h5>
              <ul className="space-y-4 text-sm text-gray-400">
                <li><Link href="/?view=marketing#tools" className="group/fl relative inline-flex items-center transition-colors hover:text-white"><span className="absolute -left-3 h-1 w-1 rounded-full bg-[#C9A24D] opacity-0 transition-all duration-300 group-hover/fl:-left-2.5 group-hover/fl:opacity-100" /><span className="bg-gradient-to-r from-[#C9A24D] to-[#C9A24D] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/fl:bg-[length:100%_1px]">Features</span></Link></li>
                <li><Link href="/?view=marketing#pricing" className="group/fl relative inline-flex items-center transition-colors hover:text-white"><span className="absolute -left-3 h-1 w-1 rounded-full bg-[#C9A24D] opacity-0 transition-all duration-300 group-hover/fl:-left-2.5 group-hover/fl:opacity-100" /><span className="bg-gradient-to-r from-[#C9A24D] to-[#C9A24D] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/fl:bg-[length:100%_1px]">Pricing</span></Link></li>
                <li><Link href="/?view=marketing#faq" className="group/fl relative inline-flex items-center transition-colors hover:text-white"><span className="absolute -left-3 h-1 w-1 rounded-full bg-[#C9A24D] opacity-0 transition-all duration-300 group-hover/fl:-left-2.5 group-hover/fl:opacity-100" /><span className="bg-gradient-to-r from-[#C9A24D] to-[#C9A24D] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/fl:bg-[length:100%_1px]">FAQ</span></Link></li>
              </ul>
            </div>

            <div className="flex flex-col space-y-6">
              <h5 className="flex items-center gap-2 font-bold text-xs text-[#C9A24D] uppercase tracking-[0.25em]"><span className="h-px w-5 bg-[#C9A24D]/60" />Legal</h5>
              <ul className="space-y-4 text-sm text-gray-400">
                <li><Link href="/privacy" className="group/fl relative inline-flex items-center transition-colors hover:text-white"><span className="absolute -left-3 h-1 w-1 rounded-full bg-[#C9A24D] opacity-0 transition-all duration-300 group-hover/fl:-left-2.5 group-hover/fl:opacity-100" /><span className="bg-gradient-to-r from-[#C9A24D] to-[#C9A24D] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/fl:bg-[length:100%_1px]">Privacy Policy</span></Link></li>
                <li><Link href="/terms" className="group/fl relative inline-flex items-center transition-colors hover:text-white"><span className="absolute -left-3 h-1 w-1 rounded-full bg-[#C9A24D] opacity-0 transition-all duration-300 group-hover/fl:-left-2.5 group-hover/fl:opacity-100" /><span className="bg-gradient-to-r from-[#C9A24D] to-[#C9A24D] bg-[length:0%_1px] bg-left-bottom bg-no-repeat pb-0.5 transition-[background-size] duration-300 group-hover/fl:bg-[length:100%_1px]">Terms of Service</span></Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bright MLS Compliance Section */}
        {!noMlsAgent && <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 text-[10px] uppercase tracking-widest leading-loose text-gray-500 font-medium">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-400 mb-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                © {new Date().getFullYear()} Bright MLS • All Rights Reserved
              </span>
              <span className="text-[#C9A24D] font-black">Information Deemed Reliable But Not Guaranteed</span>
            </div>
            
            <p className="normal-case tracking-normal leading-relaxed text-xs opacity-80">
              The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms, and is provided by BRIGHT through a licensing agreement.
            </p>
            
            <p className="normal-case tracking-normal leading-relaxed text-xs opacity-80">
              The information provided by this website is for the personal, non-commercial use of consumers and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Some properties which appear for sale on this website may no longer be available because they are under contract, have Closed or are no longer being offered for sale.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 text-gray-600">
              <p className="normal-case italic">
                <MlsUpdatedText />
              </p>
              <p className="normal-case max-w-sm sm:text-right">
                Some real estate firms do not participate in IDX and their listings do not appear on this website. 
              </p>
            </div>
          </div>
        </div>}
      </div>
    </footer>
  )
}