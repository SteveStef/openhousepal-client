'use client'

import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'

export default function ComingSoon({ feature, description, icon: Icon }: {
  feature: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-5 dark:bg-[#0B0B0B]">
      <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm grayscale dark:border-gray-800 dark:bg-[#151517]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800">
          <Icon className="h-6 w-6" />
        </div>
        <p className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <Sparkles className="h-3.5 w-3.5" /> Coming Soon
        </p>
        <h1 className="mt-3 font-serif text-2xl font-black text-gray-500 dark:text-gray-400">{feature}</h1>
        <p className="mt-2 text-sm font-semibold text-gray-400 dark:text-gray-500">{description}</p>
        <Link
          href="/studio"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] dark:hover:bg-gray-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Studio
        </Link>
      </div>
    </div>
  )
}
