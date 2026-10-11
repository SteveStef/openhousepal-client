'use client'

import type { LucideIcon } from 'lucide-react'
import LuxeHero from '@/components/ui/LuxeHero'

// Shared top-of-page header for every OpenHousePal tab - now the luxe "alive" header (LuxeHero):
// the small gold kicker line, a serif title (wrap the last words in <em> for the gold italics), the
// subtitle, and the page's own buttons/stats on the right. Every tool page that used the old plain
// header picks this up automatically.
export default function PageHeader({
  icon, title, badge, subtitle, actions, backHref, backLabel, noMargin, kicker, tabs, asideClassName, subtitleClassName, kickerNote,
}: {
  icon: LucideIcon
  title: React.ReactNode
  badge?: React.ReactNode
  subtitle: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
  // Kept for older callers - the luxe header sizes itself the same way everywhere.
  compact?: boolean
  // Drops the default mb-5 - for a caller that spaces the header itself.
  noMargin?: boolean
  subtitleClassName?: string
  /** The small gold line above the title (defaults to the title when it's plain text). */
  kicker?: string
  /** A LuxeTabs bar built into the bottom of the header. */
  tabs?: React.ReactNode
  /** Width/position of the right-hand column (buttons/stats) on desktop. */
  asideClassName?: string
  /** Small inline note/chip right after the kicker. */
  kickerNote?: React.ReactNode
}) {
  return (
    <LuxeHero
      compact
      className={noMargin ? '' : 'mb-5'}
      kicker={kicker || (typeof title === 'string' ? title : '')}
      icon={icon}
      title={title}
      subtitle={subtitle}
      badge={badge}
      kickerNote={kickerNote}
      backHref={backHref}
      backLabel={backLabel}
      tabs={tabs}
      subtitleClassName={subtitleClassName}
      aside={actions ? <div className="flex w-full flex-wrap items-center justify-center gap-2 lg:justify-end">{actions}</div> : undefined}
      asideClassName={asideClassName || 'w-full lg:w-auto lg:max-w-[560px] lg:self-center'}
    />
  )
}
