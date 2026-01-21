'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#1a1614] text-white py-12 border-t border-[#8b7355]/20 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <Image
                src="/logo.png"
                alt="OpenHousePal Logo"
                width={48}
                height={27}
                className="h-10 w-auto"
              />
              <span className="text-xl font-bold tracking-tight">OpenHousePal</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Empowering real estate agents with next-generation lead capture and automated follow-up tools.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h5 className="font-bold text-sm mb-4 text-[#8b7355] uppercase tracking-wider">Platform</h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/#how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/#faq" className="hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h5 className="font-bold text-sm mb-4 text-[#8b7355] uppercase tracking-wider">Legal</h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} OpenHousePal. All rights reserved.
          </p>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Platform Active</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
