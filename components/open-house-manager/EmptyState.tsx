'use client'

import { LucideIcon } from 'lucide-react'

export default function EmptyState({ icon: Icon, title, description, compact }: { icon: LucideIcon; title: string; description: string; compact?: boolean }) {
  // Compact: a single row instead of a tall centered block - for empty states that live inside an
  // already-crowded stack of sections (e.g. Manage Hosts), where the full-size version ate up far
  // more space than "nothing here yet" warrants.
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 py-3 px-3.5 text-left">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C9A24D]/10 text-[#C9A24D]">
          <Icon size={13} />
        </div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          <span className="font-black text-[#111827] dark:text-white">{title}.</span> {description}
        </p>
      </div>
    )
  }

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
