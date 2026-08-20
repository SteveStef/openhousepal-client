'use client'

import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

// Shared top-of-page header for every OpenHousePal tab - icon chip, title, subtitle, and an
// optional back-link/actions row. Matches the Studio hub / Settings look, which is the style
// every tab should converge on instead of each page rolling its own header.
export default function PageHeader({
  icon: Icon, title, badge, subtitle, actions, backHref, backLabel, compact,
}: {
  icon: LucideIcon
  title: string
  badge?: React.ReactNode
  subtitle: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
  // Smaller title on mobile only (sm: and up are untouched) - for pages like Dash that pack a
  // lot above the fold on a small screen. Off by default so every other page's header is unchanged.
  compact?: boolean
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2.5">
        {backHref && (
          <Link
            href={backHref}
            title={backLabel ? `Back to ${backLabel}` : undefined}
            className="shrink-0 rounded-full border border-gray-100 bg-white p-2 text-gray-500 shadow-sm transition-all hover:border-gray-200 hover:text-[#111827] dark:border-gray-800 dark:bg-[#151517] dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-white"
          >
            <ArrowLeft size={16} />
          </Link>
        )}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#C9A24D]/10 text-[#C9A24D]">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={`font-black leading-tight tracking-tight text-[#111827] dark:text-white ${compact ? 'text-2xl sm:text-4xl' : 'text-3xl sm:text-4xl'}`}>{title}</h1>
            {badge}
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
