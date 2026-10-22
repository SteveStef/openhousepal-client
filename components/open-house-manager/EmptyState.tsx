'use client'

import { LucideIcon } from 'lucide-react'

export default function EmptyState({ icon: Icon, title, description, compact }: { icon: LucideIcon; title: string; description: string; compact?: boolean }) {
  // Compact: a single row instead of a tall centered block - for empty states that live inside an
  // already-crowded stack of sections (e.g. Manage Hosts), where the full-size version ate up far
  // more space than "nothing here yet" warrants.
  // A soft lit tile with the title on its own line - the old dashed box ran the title and the
  // sentence together and read like two stray grey lines (user, 10/22).
  if (compact) {
    return (
      <div className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#fbf6ea] via-white to-white px-4 py-3.5 text-left ring-1 ring-[#C9A24D]/15 dark:from-[#C9A24D]/[0.08] dark:via-transparent dark:to-transparent dark:ring-white/[0.06]">
        <span aria-hidden className="pointer-events-none absolute -left-6 -top-8 h-20 w-20 rounded-full bg-[radial-gradient(circle,rgba(201,162,77,.18),transparent_65%)]" />
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-[0_8px_18px_-10px_rgba(17,24,39,.8)]">
          <Icon size={17} />
        </div>
        <div className="relative min-w-0">
          <p className="text-[13px] font-black leading-tight text-[#111827] dark:text-white">{title}</p>
          <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-gray-500 dark:text-gray-400">{description}</p>
        </div>
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
