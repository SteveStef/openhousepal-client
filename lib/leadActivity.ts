// One place that says what each kind of lead activity is called, how it looks, and where a lead
// came in from - shared by the Leads list, a lead's detail view and the Dash lead cards.
import {
  Building2, Calendar, CalendarClock, ClipboardList, Eye, FileText, Globe2, Heart, Home, Mail, MailOpen, MailX, MessageSquare, MousePointerClick,
  MessageSquareText, Newspaper, PencilLine, SlidersHorizontal, Star, ThumbsDown, Inbox, Users, type LucideIcon,
} from 'lucide-react'
import type { LeadOriginGroup, LeadSourceType, LeadTodo } from '@/types'

export type ActivityTone = 'gold' | 'emerald' | 'rose' | 'sky' | 'violet' | 'amber' | 'slate'

export const ACTIVITY_META: Record<LeadSourceType, { label: string; icon: LucideIcon; tone: ActivityTone }> = {
  open_house_visitor: { label: 'Open house sign-in', icon: Home, tone: 'emerald' },
  open_house_second_visit: { label: 'Second visit request', icon: CalendarClock, tone: 'amber' },
  open_house_disclosure: { label: 'Disclosure request', icon: FileText, tone: 'amber' },
  form_submission: { label: 'Form', icon: ClipboardList, tone: 'gold' },
  form_partial: { label: 'Unfinished form', icon: ClipboardList, tone: 'slate' },
  collection_visitor: { label: 'Showcase', icon: Building2, tone: 'violet' },
  property_tour: { label: 'Showing request', icon: Calendar, tone: 'amber' },
  property_comment: { label: 'Showcase comment', icon: MessageSquareText, tone: 'violet' },
  property_website_inquiry: { label: 'Spotlight', icon: Globe2, tone: 'sky' },
  property_website_tour_request: { label: 'Spotlight showing request', icon: Calendar, tone: 'amber' },
  property_page_inquiry: { label: 'Listing question', icon: MessageSquare, tone: 'sky' },
  property_page_tour_request: { label: 'Listing showing request', icon: Calendar, tone: 'amber' },
  portal_lead: { label: 'Portal lead', icon: Inbox, tone: 'sky' },
  blog_inquiry: { label: 'Blog question', icon: Newspaper, tone: 'sky' },
  showcase_like: { label: 'Liked a home', icon: Heart, tone: 'rose' },
  showcase_dislike: { label: 'Passed on a home', icon: ThumbsDown, tone: 'slate' },
  showcase_view: { label: 'Looked at a home', icon: Eye, tone: 'slate' },
  showcase_refine: { label: 'Search change request', icon: SlidersHorizontal, tone: 'amber' },
  showcase_search_changed: { label: 'Changed their search', icon: PencilLine, tone: 'violet' },
  showcase_emails_off: { label: 'Showcase emails off', icon: MailX, tone: 'slate' },
  showcase_emails_on: { label: 'Showcase emails on', icon: Mail, tone: 'slate' },
  email_unsubscribed: { label: 'Unsubscribed', icon: MailX, tone: 'slate' },
  review_left: { label: 'Review', icon: Star, tone: 'gold' },
  email_opened: { label: 'Opened your email', icon: MailOpen, tone: 'sky' },
  email_clicked: { label: 'Clicked your email', icon: MousePointerClick, tone: 'sky' },
  email_weekly: { label: 'Emails now weekly', icon: CalendarClock, tone: 'amber' },
  email_paused: { label: 'Automatic emails stopped', icon: MailX, tone: 'rose' },
  email_resumed: { label: 'Emails back on', icon: Mail, tone: 'emerald' },
}

export function activityMeta(type?: string | null) {
  return ACTIVITY_META[type as LeadSourceType] || { label: 'Activity', icon: Users, tone: 'slate' as ActivityTone }
}

export const TONE_CLASSES: Record<ActivityTone, string> = {
  gold: 'bg-[#C9A24D]/15 text-[#8b7355] dark:bg-[#C9A24D]/15 dark:text-[#e8c97a]',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  slate: 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400',
}

/** Where a lead came in - the Leads page's "Came in from" filter. */
export const ORIGIN_META: Record<LeadOriginGroup, { label: string; icon: LucideIcon }> = {
  open_house: { label: 'Open houses', icon: Home },
  showcase: { label: 'Showcases', icon: Building2 },
  forms: { label: 'Forms', icon: ClipboardList },
  listings: { label: 'Spotlights & listings', icon: Globe2 },
  website: { label: 'Website & blog', icon: Newspaper },
  portal: { label: 'Zillow & portals', icon: Inbox },
  review: { label: 'Reviews', icon: Star },
  other: { label: 'Other', icon: Users },
}

/** "Just now" / "12m ago" / "3h ago" / "Yesterday" / "Tue" / "Oct 3" / "Oct 3, 2025". */
export function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const mins = Math.round((now.getTime() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (days === 0) return `${Math.round(mins / 60)}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, d.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Oct 3, 2026 · 2:15 PM" - the exact moment, for the timeline. */
export function exactTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

/** A to-do's "when" - "Overdue", "Today", "Tomorrow", "Thu, Oct 9", or nothing. */
export function todoWhen(t: LeadTodo): string {
  if (t.kind !== 'followup') return ''
  if (t.bucket === 'overdue') return 'Overdue'
  if (t.bucket === 'today') return 'Today'
  if (!t.due_at) return t.bucket === 'someday' ? 'No date' : ''
  const d = new Date(t.due_at)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Phone digits for tel:/sms: links. */
export function dialable(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.length === 10 ? `+1${digits}` : digits ? `+${digits}` : ''
}
