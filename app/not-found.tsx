'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function NotFound() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#FAFAF7] dark:bg-[#0B0B0B] flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-300">
      {/* Background Architecture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-[#C9A24D]/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#111827]/5 dark:bg-[#C9A24D]/5 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-light.png')] opacity-[0.03] dark:opacity-[0.05] mix-blend-overlay dark:mix-blend-soft-light"></div>
      </div>

      <div className="relative z-10 max-w-md w-full px-6 text-center">
        {/* 404 Display */}
        <div className="relative mb-8">
          <h1 className="text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-br from-[#111827] via-[#3a2f25] to-[#C9A24D] dark:from-white dark:via-[#e5e7eb] dark:to-[#C9A24D] leading-none select-none opacity-20 dark:opacity-10">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="text-3xl font-black text-[#0B0B0B] dark:text-white tracking-tight">
              Page Not Found
            </h2>
          </div>
        </div>

        <p className="text-[#6B7280] dark:text-gray-400 text-lg mb-10 font-medium leading-relaxed">
          I think you're lost. Let's get you back to where the leads are.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-3.5 bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-xl font-bold hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95"
          >
            Return Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="px-8 py-3.5 bg-white dark:bg-[#151517] text-[#111827] dark:text-white rounded-xl font-bold border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#2c241b] transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            Go Back
          </button>
        </div>

        {/* Decorative Element */}
        <div className="mt-16 flex justify-center">
          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent opacity-30 rounded-full"></div>
        </div>
      </div>
    </div>
  )
}
