'use client'

import { LucideIcon } from 'lucide-react'

export default function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 py-12 px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C9A24D]/10 text-[#C9A24D]">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm font-black text-[#111827] dark:text-white">{title}</p>
        <p className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
      </div>
    </div>
  )
}
