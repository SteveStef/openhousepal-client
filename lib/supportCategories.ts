import { Bug, LifeBuoy, Sparkles, type LucideIcon } from 'lucide-react'
import type { SupportTicketCategory, SupportTicketDetails } from '@/types'

// One definition of the three ticket kinds (Contact support / Report a bug / Suggest a feature),
// shared by the agent's Help page and the admin Support inbox so labels, icons and colors never
// drift. The backend's matching labels live in support_routes.CATEGORY_LABELS.

export type SupportCategoryMeta = {
  id: SupportTicketCategory
  /** The choice card's title. */
  title: string
  /** Short name for badges and filters. */
  label: string
  /** One plain line under the title. */
  blurb: string
  icon: LucideIcon
  /** Icon tile gradient + glow. */
  tile: string
  glow: string
  /** Small pill used on list rows, thread headers and admin filters. */
  badge: string
  dot: string
  /** Card border/ring when hovered or picked. */
  ring: string
}

export const SUPPORT_CATEGORIES: SupportCategoryMeta[] = [
  {
    id: 'support',
    title: 'Contact support',
    label: 'Support',
    blurb: 'A question, account help, or anything you need a hand with.',
    icon: LifeBuoy,
    tile: 'from-[#f3d9a0] via-[#C9A24D] to-[#8b6a2b] text-[#111827]',
    glow: 'rgba(201,162,77,.55)',
    badge: 'bg-[#fbf3df] text-[#8b6a2b] ring-[#C9A24D]/40 dark:bg-[#C9A24D]/15 dark:text-[#e8c97a] dark:ring-[#C9A24D]/35',
    dot: 'bg-[#C9A24D]',
    ring: 'hover:border-[#C9A24D] data-[on=true]:border-[#C9A24D]',
  },
  {
    id: 'bug',
    title: 'Report a bug',
    label: 'Bug',
    blurb: 'Something broke, looks wrong, or didn’t do what it should.',
    icon: Bug,
    tile: 'from-[#fda4af] via-[#e11d48] to-[#9f1239] text-white',
    glow: 'rgba(225,29,72,.45)',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30',
    dot: 'bg-rose-500',
    ring: 'hover:border-rose-400 data-[on=true]:border-rose-400',
  },
  {
    id: 'feature',
    title: 'Suggest a feature',
    label: 'Feature idea',
    blurb: 'An idea that would make OpenHousePal work better for you.',
    icon: Sparkles,
    tile: 'from-[#c4b5fd] via-[#7c3aed] to-[#4c1d95] text-white',
    glow: 'rgba(124,58,237,.45)',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30',
    dot: 'bg-violet-500',
    ring: 'hover:border-violet-400 data-[on=true]:border-violet-400',
  },
]

export function supportCategory(id: string | null | undefined): SupportCategoryMeta {
  return SUPPORT_CATEGORIES.find(c => c.id === id) || SUPPORT_CATEGORIES[0]
}

export const URGENCY_OPTIONS: { id: NonNullable<SupportTicketDetails['urgency']>; label: string; hint: string }[] = [
  { id: 'low', label: 'Whenever', hint: 'No rush' },
  { id: 'normal', label: 'Soon', hint: 'Within a day or so' },
  { id: 'urgent', label: 'Urgent', hint: 'I’m stuck right now' },
]

// "Where did it happen?" for bug reports - pre-picked from the page the agent was on before
// opening Help (lib/navHistory.lastInAppPage), changeable with one tap.
export const APP_AREAS: { label: string; prefixes: string[] }[] = [
  { label: 'Dashboard', prefixes: ['/dash'] },
  { label: 'Open Houses', prefixes: ['/open-houses', '/open-house'] },
  { label: 'Showcases', prefixes: ['/showcases', '/showcase'] },
  { label: 'Leads', prefixes: ['/leads', '/activity'] },
  { label: 'CMA', prefixes: ['/studio/cma', '/cma'] },
  { label: 'Design Studio', prefixes: ['/studio/design', '/studio/media', '/studio/brand-kit'] },
  { label: 'Spotlight', prefixes: ['/studio/property-sites', '/spotlight-preview'] },
  { label: 'IDX Website', prefixes: ['/studio/site', '/studio/website', '/studio/blogs'] },
  { label: 'Agent Hub', prefixes: ['/agent-hub', '/AgentHub', '/studio/forms', '/studio/reviews', '/studio/email-signature'] },
  { label: 'Discovery', prefixes: ['/discovery'] },
  { label: 'Settings & billing', prefixes: ['/settings', '/checkout', '/setup', '/studio/integrations', '/studio/calendar'] },
  { label: 'Something else', prefixes: [] },
]

export function areaForPath(path: string | null): string {
  if (!path) return 'Something else'
  const clean = path.split('?')[0]
  const hit = APP_AREAS.find(a => a.prefixes.some(p => clean === p || clean.startsWith(p + '/')))
  return hit ? hit.label : 'Something else'
}

/** Browser / device facts for a bug report, read quietly from the browser - no permissions. */
export function captureDeviceDetails(): SupportTicketDetails {
  if (typeof window === 'undefined') return {}
  const ua = navigator.userAgent
  const browser =
    /Edg\//.test(ua) ? `Edge ${ua.match(/Edg\/(\d+)/)?.[1] ?? ''}`
    : /OPR\//.test(ua) ? `Opera ${ua.match(/OPR\/(\d+)/)?.[1] ?? ''}`
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1] ?? ''}`
    : /Firefox\//.test(ua) ? `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1] ?? ''}`
    : /Safari\//.test(ua) ? `Safari ${ua.match(/Version\/(\d+(\.\d+)?)/)?.[1] ?? ''}`
    : 'Other browser'
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Other'
  const device = /iPad|Tablet/.test(ua) ? 'Tablet' : /Mobi|iPhone|Android/.test(ua) ? 'Phone' : 'Computer'
  let timezone = ''
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone } catch {}
  return {
    browser: browser.trim(),
    os,
    device,
    screen: `${window.screen.width}×${window.screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    timezone,
    language: navigator.language,
    user_agent: ua,
  }
}
