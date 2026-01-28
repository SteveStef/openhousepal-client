'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#0B0B0B] text-white py-16 border-t border-white/5 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center space-x-3">
              <Image
                src="/logo.png"
                alt="OpenHousePal Logo"
                width={48}
                height={27}
                className="h-10 w-auto"
              />
              <span className="text-2xl font-black tracking-tight uppercase">OpenHousePal</span>
            </div>
            <p className="text-gray-400 text-base leading-relaxed max-w-sm">
              Empowering real estate agents with next-generation lead capture and automated follow-up tools. Built for the modern professional.
            </p>
            <div className="flex items-center space-x-3 text-xs font-bold uppercase tracking-widest text-[#C9A24D]">
              <div className="w-2 h-2 bg-[#C9A24D] rounded-full animate-pulse"></div>
              <span>System Operational</span>
            </div>
          </div>

          {/* Links Section */}
          <div className="lg:col-span-7 flex flex-col md:flex-row lg:justify-end gap-12 md:gap-24">
            <div className="flex flex-col space-y-6">
              <h5 className="font-bold text-xs text-white uppercase tracking-widest">Platform</h5>
              <ul className="space-y-4 text-sm text-gray-400">
                <li><Link href="/#how-it-works" className="hover:text-[#C9A24D] transition-colors">How It Works</Link></li>
                <li><Link href="/#pricing" className="hover:text-[#C9A24D] transition-colors">Pricing</Link></li>
                <li><Link href="/#faq" className="hover:text-[#C9A24D] transition-colors">FAQ</Link></li>
              </ul>
            </div>

            <div className="flex flex-col space-y-6">
              <h5 className="font-bold text-xs text-white uppercase tracking-widest">Legal</h5>
              <ul className="space-y-4 text-sm text-gray-400">
                <li><Link href="/privacy" className="hover:text-[#C9A24D] transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-[#C9A24D] transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bright MLS Compliance Section */}
        <div className="pt-12 border-t border-white/10">
          <div className="grid grid-cols-1 gap-6 max-w-5xl text-[10px] uppercase tracking-widest leading-loose text-gray-500 font-medium">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-400 mb-2">
              <span className="bg-white/5 px-2 py-1 rounded border border-white/10">
                © {new Date().getFullYear()} Bright MLS
              </span>
              <span>All Rights Reserved</span>
              <span className="text-[#C9A24D] font-black">Information Deemed Reliable But Not Guaranteed</span>
            </div>
            
            <p className="normal-case tracking-normal leading-relaxed text-xs opacity-80">
              The data relating to real estate for sale on this website appears in part through the BRIGHT Internet Data Exchange program, a voluntary cooperative exchange of property listing data between licensed real estate brokerage firms in which participates, and is provided by BRIGHT through a licensing agreement.
            </p>
            
            <p className="normal-case tracking-normal leading-relaxed text-xs opacity-80">
              The information provided by this website is for the personal, non-commercial use of consumers and may not be used for any purpose other than to identify prospective properties consumers may be interested in purchasing. Some properties which appear for sale on this website may no longer be available because they are under contract, have Closed or are no longer being offered for sale.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 text-gray-600">
              <p className="normal-case italic">
                Data last updated: {new Date().toLocaleDateString()}
              </p>
              <p className="normal-case max-w-sm sm:text-right">
                Some real estate firms do not participate in IDX and their listings do not appear on this website. 
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}