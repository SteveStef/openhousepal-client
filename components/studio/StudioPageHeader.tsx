'use client'

import type { LucideIcon } from 'lucide-react'
import PageHeader from '@/components/PageHeader'

// Thin Studio-flavored wrapper around the shared PageHeader (the luxe header) - defaults the
// back-link to "Tools" (the nav hub every Studio sub-page lives under, at /studio), but a page that
// no longer needs that back-link can opt out with backHref={null}.
export default function StudioPageHeader({
  icon, title, subtitle, actions, backHref = '/studio', backLabel = 'Tools', kicker, tabs, asideClassName, badge,
}: {
  icon: LucideIcon
  title: React.ReactNode
  subtitle: string
  actions?: React.ReactNode
  backHref?: string | null
  backLabel?: string
  kicker?: string
  tabs?: React.ReactNode
  asideClassName?: string
  /** Small pills beside the kicker (e.g. live stats). */
  badge?: React.ReactNode
}) {
  return (
    <PageHeader
      icon={icon}
      kicker={kicker}
      title={title}
      subtitle={subtitle}
      actions={actions}
      tabs={tabs}
      asideClassName={asideClassName}
      badge={badge}
      backHref={backHref ?? undefined}
      backLabel={backLabel}
    />
  )
}
