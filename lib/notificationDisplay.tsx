import { SlidersHorizontal,
  Calendar, CalendarClock, Eye, Home, FileText, FileCheck, Inbox, CheckCircle2, XCircle, MessageSquareText,
  MessageCircle, Megaphone, UserCheck, Mail, TrendingUp, ThumbsUp, ThumbsDown, Send, UserPlus, HelpCircle, Film,
  MailOpen, MailX, Star, Newspaper, Bell, CreditCard, ClipboardList,
} from 'lucide-react'

// Shared per-type display metadata for Notification.type - used by both the bell dropdown
// (NotificationDropdown) and the full-history Activity page, so the two never drift apart.
export const NOTIFICATION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; className: string }> = {
  OPEN_HOUSE_SIGN_IN: { icon: Home, label: 'New Visitor', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  TOUR_REQUEST: { icon: Calendar, label: 'Tour Request', className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' },
  // Generic fallback within PROPERTY_INTERACTION - getNotificationMeta below branches liked/disliked
  // to their own icon+color using the notification's message text (there's no separate type for
  // each - see property_interactions_service.py). This entry only fires for the rare case where
  // neither prefix matches.
  PROPERTY_INTERACTION: { icon: ThumbsUp, label: 'Property Activity', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  PROPERTY_COMMENT: { icon: MessageCircle, label: 'Showcase Comment', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  PROPERTY_INQUIRY: { icon: Mail, label: 'Property Inquiry', className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  // The 4:30 PM roll-up of every new match + price drop across the agent's Showcases (one a day).
  SHOWCASE_DIGEST: { icon: TrendingUp, label: "Today's Showcase Update", className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  PROPERTY_SYNC_UPDATE: { icon: TrendingUp, label: 'Showcase Update', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  FORM_SUBMISSION: { icon: FileText, label: 'Form Submission', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  OPEN_HOUSE_SECOND_VISIT: { icon: CalendarClock, label: 'Second Visit Request', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  OPEN_HOUSE_DISCLOSURE: { icon: FileCheck, label: 'Disclosure Request', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  HOST_REQUEST_RECEIVED: { icon: Inbox, label: 'Host Request', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  HOST_REQUEST_APPROVED: { icon: CheckCircle2, label: 'Request Approved', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  HOST_REQUEST_DECLINED: { icon: XCircle, label: 'Request Declined', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
  // A new time was proposed on your request - not resolved yet, so amber (needs a decision) rather
  // than green/red like the final approve/decline outcomes above.
  HOST_REQUEST_COUNTERED: { icon: CalendarClock, label: 'Time Proposed', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  // Covers both "accepted" and "declined" outcomes to your own counter-proposal (see
  // open_house_manager_service.py) - kept neutral gold rather than green/red since it's one type
  // for both outcomes.
  HOST_REQUEST_COUNTER_RESPONSE: { icon: Calendar, label: 'Counter-Proposal Response', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  // The agent's own Gmail/Outlook stopped letting us send guest emails (OpenHousePal sends them meanwhile).
  MAILBOX_DISCONNECTED: { icon: Mail, label: 'Reconnect Your Email', className: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30' },
  REFINE_SEARCH_REQUEST: { icon: MessageSquareText, label: 'Search Request', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  SHOWCASE_SEARCH_CHANGED: { icon: SlidersHorizontal, label: 'Search Changed', className: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30' },
  // "X needs a host" - a request going out to the team, still needs someone to respond.
  TEAM_BROADCAST_RECEIVED: { icon: Megaphone, label: 'Team Broadcast', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  // "X can host" - someone on the team volunteered, a positive resolution.
  TEAM_BROADCAST_RESPONSE: { icon: UserCheck, label: 'Broadcast Response', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  // A team-wide broadcast sent to exactly one agent instead of the whole team - same "needs a
  // response" amber treatment as TEAM_BROADCAST_RECEIVED, distinct type only so it can't be
  // mistaken for HOST_REQUEST_RECEIVED (which always means "someone wants MY listing," the
  // opposite direction).
  DIRECT_HOST_REQUEST_RECEIVED: { icon: Send, label: 'Direct Request', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  // Someone claimed a team-wide (or direct) broadcast outright - a positive, already-resolved
  // outcome, same treatment as TEAM_BROADCAST_RESPONSE.
  TEAM_BROADCAST_CLAIMED: { icon: UserCheck, label: 'Open House Claimed', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  TEAM_INVITE_RECEIVED: { icon: UserPlus, label: 'Team Invite', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  TEAM_INVITE_ACCEPTED: { icon: CheckCircle2, label: 'Invite Accepted', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  TEAM_INVITE_DECLINED: { icon: XCircle, label: 'Invite Declined', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
  TEAM_NEW_LISTING: { icon: Home, label: 'New Listing', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  SUPPORT_TICKET_REPLY: { icon: HelpCircle, label: 'Support Reply', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  // AI Property Media video finished rendering in the background (can take up to ~15 min) - see
  // _notify_video_done in studio_media_service.py.
  STUDIO_MEDIA_VIDEO_READY: { icon: Film, label: 'AI Video Ready', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' },
  STUDIO_MEDIA_VIDEO_FAILED: { icon: XCircle, label: 'AI Video Failed', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
  // A client opened / clicked one of your emails (one row per person per day - client_email_service).
  EMAIL_ACTIVITY: { icon: MailOpen, label: 'Email Opened', className: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30' },
  // Automatic emails to a client went weekly / stopped / came back on (the inbox-protection rules).
  EMAIL_STATUS: { icon: MailX, label: 'Email Sending', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  NEW_REVIEW: { icon: Star, label: 'New Review', className: 'bg-[#C9A24D]/15 dark:bg-[#C9A24D]/20 text-[#8b7355] dark:text-[#d7b974] border-[#C9A24D]/30' },
  PORTAL_LEAD: { icon: Inbox, label: 'Portal Lead', className: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30' },
  LEAD: { icon: Newspaper, label: 'Blog Question', className: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30' },
  TASK_REMINDER: { icon: Bell, label: 'Follow-up Reminder', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  TRIAL_ENDING_SOON: { icon: CreditCard, label: 'Trial Ending', className: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30' },
  OPEN_HOUSE_FORM_REQUEST: { icon: ClipboardList, label: 'Open House Request', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
}

// AI Property Media video alerts are a one-time "it's ready, go look" nudge, not a useful
// permanent history entry the way a lead or tour request is - once the agent has actually seen
// it (opened the bell/Activity page, clicked it, or viewed the finished video in AI Media
// itself), it should disappear from both the bell and Activity entirely rather than just gray
// out like every other notification type (see NotificationBell.tsx / app/activity/page.tsx /
// app/studio/media/page.tsx for the three "seen" triggers that mark these read).
export const AUTO_HIDE_WHEN_READ_TYPES = new Set(['STUDIO_MEDIA_VIDEO_READY', 'STUDIO_MEDIA_VIDEO_FAILED'])

export function visibleNotifications<T extends { type: string; isRead: boolean }>(list: T[]): T[] {
  return list.filter(n => !(AUTO_HIDE_WHEN_READ_TYPES.has(n.type) && n.isRead))
}

const LIKED_META = { icon: ThumbsUp, label: 'Liked a Property', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' }
const DISLIKED_META = { icon: ThumbsDown, label: 'Disliked a Property', className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800' }

const FALLBACK_META = { icon: Eye, label: 'Activity', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700' }

// message is optional so existing callers that only have the type still work - but PROPERTY_INTERACTION
// needs it to tell a like from a dislike (see property_interactions_service.py, which always titles
// the message "Liked ..."/"Disliked ..."; collections_service.py's own unread-count logic already
// branches on this exact same prefix).
const EMAIL_CLICKED_META = { icon: MailOpen, label: 'Opened + Clicked', className: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30' }
const EMAIL_BACK_META = { icon: Mail, label: 'Emails Back On', className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800' }
const EMAIL_OFF_META = { icon: MailX, label: 'Emails Stopped', className: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30' }

export function getNotificationMeta(type: string, message?: string | null, title?: string | null) {
  if (type === 'EMAIL_ACTIVITY' && title?.includes('clicked')) return EMAIL_CLICKED_META
  if (type === 'EMAIL_STATUS' && title) {
    if (title.includes('back to daily')) return EMAIL_BACK_META
    if (title.includes('stopped')) return EMAIL_OFF_META
  }
  if (type === 'PROPERTY_INTERACTION' && message) {
    if (message.startsWith('Liked')) return LIKED_META
    if (message.startsWith('Disliked')) return DISLIKED_META
  }
  return NOTIFICATION_META[type] || FALLBACK_META
}
