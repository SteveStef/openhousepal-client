'use client'

import { useState } from 'react'
import { Building2, Calendar, CalendarClock, ClipboardList, Copy, Globe2, Heart, Home, Mail, MessageSquare, Phone, ShieldAlert, ThumbsDown, Trash2, Users } from 'lucide-react'
import { Lead, LeadSourceFilter, LeadSourceType, LeadStatus } from '@/types'
import { formatRelativeDay } from '@/lib/relativeDays'
import { useToast } from '@/contexts/ToastContext'
import api from '@/lib/api-service'

const SOURCE_META: Record<LeadSourceFilter, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  all: { label: 'Lead', icon: Users },
  open_house: { label: 'Open House', icon: Home },
  form: { label: 'Form', icon: ClipboardList },
  showcase: { label: 'Showcase', icon: Building2 },
  tour: { label: 'Tour', icon: CalendarClock },
  website: { label: 'Website', icon: Globe2 },
}

// Short, human labels for the lead's most recent event - matches how the Leads tab's own
// Activity timeline names these same event types (Showing Request, Showcase, Form, ...).
const ACTIVITY_LABELS: Record<LeadSourceType, string> = {
  open_house_visitor: 'Signed In',
  form_submission: 'Form Submitted',
  property_tour: 'Showing Request',
  property_comment: 'Left a Comment',
  collection_visitor: 'Showcase',
  open_house_second_visit: 'Second Visit Request',
  open_house_disclosure: 'Disclosure Request',
}

// property_address on a lead is normally a full "street, city, state zip" string (see
// property_tour_service.py's tour_address, open_houses_routes.py, etc). Take just the first two
// comma segments so the card shows street + city without the state/zip tail - independent of
// whether lead.property (only populated from open-house events) has anything on it.
function streetAndCity(address?: string | null): string {
  if (!address) return ''
  return address.split(',').map(part => part.trim()).filter(Boolean).slice(0, 2).join(', ')
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
  contacted: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  in_talks: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300',
  signed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
  hidden: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
  qualified: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300',
  converted: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
  archived: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  in_talks: 'In Talks',
  signed: 'Signed',
  hidden: 'Hidden',
  qualified: 'In Talks',
  converted: 'Signed',
  archived: 'Hidden',
}

const normalizedStatus = (lead: Lead): LeadStatus => {
  if (lead.hidden_at) return 'hidden'
  if (lead.status === 'qualified') return 'in_talks'
  if (lead.status === 'converted') return 'signed'
  if (lead.status === 'archived') return 'hidden'
  return lead.status
}

// Always "First L." (not just once a name gets long) - a full "First Last" would otherwise still
// occasionally fight the fixed status/no-agent pills in the top-right corner, or the tags below,
// for space at this card's width. The full name is still in the title attribute for a hover.
function abbreviateName(name?: string | null): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return 'Unnamed Lead'
  const parts = trimmed.split(/\s+/)
  if (parts.length < 2) return trimmed
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

function CopyIconButton({ icon: Icon, onClick, title }: { icon: React.ComponentType<{ className?: string }>; onClick: (event: React.MouseEvent) => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-1 text-gray-500 transition hover:bg-[#C9A24D]/15 hover:text-[#8b7355] dark:bg-gray-800 dark:text-gray-400"
    >
      <Icon className="h-2.5 w-2.5" />
      <Copy className="h-2 w-2 opacity-60" />
    </button>
  )
}

// Same icon/color language the Showcases dashboard uses for these exact interaction types
// (frontend/app/showcases/components/DashboardView.tsx) - reused here so a lead who engaged with
// their showcase reads consistently wherever an agent sees it.
function InteractionIcon({ icon: Icon, color, title }: { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; title: string }) {
  return (
    <span title={title} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${color}`}>
      <Icon size={9} />
    </span>
  )
}

export default function DashLeadCard({ lead, onOpenLead }: { lead: Lead; onOpenLead: () => void }) {
  const { showToast } = useToast()
  const [dismissed, setDismissed] = useState(false)
  const SourceIcon = SOURCE_META[lead.primary_source].icon
  const status = normalizedStatus(lead)
  const flagged = lead.needs_attention && !dismissed
  // Open house / showcase are the two obvious, common origins - the icon+label tag on the photo
  // already says it clearly enough. Anything else (form, tour, website) is less obvious from an
  // icon alone, so it gets spelled out as its own line instead.
  const showSourceLine = lead.primary_source !== 'open_house' && lead.primary_source !== 'showcase'
  const activityAddress = streetAndCity(lead.property_address)

  const copy = (event: React.MouseEvent, text: string, label: string) => {
    event.preventDefault()
    event.stopPropagation()
    navigator.clipboard.writeText(text)
    showToast(`${label} copied to clipboard!`, 'success')
  }

  const dismissAttention = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDismissed(true)
    // Same call the lead detail view makes on open (GET /leads/{id} marks it viewed) - the
    // next dashboard poll (see POLL_INTERVAL_MS in app/dash/page.tsx) picks up the real state.
    api.leads.get(lead.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenLead}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onOpenLead() }}
      className={`group relative flex min-w-0 cursor-pointer items-stretch gap-3 overflow-hidden rounded-xl border bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C9A24D]/40 hover:shadow-md dark:bg-[#151517] ${
        flagged
          ? 'border-2 border-red-400 shadow-lg shadow-red-500/40 ring-1 ring-red-300/60 dark:border-red-600 dark:shadow-red-900/40 dark:ring-red-900/50'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      {/* Fixed top-right corner, one line - always the same spot regardless of name/contact length */}
      <div className="absolute right-2 top-2 z-10 flex shrink-0 items-center gap-1">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
        {lead.represented !== 'yes' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <ShieldAlert className="h-2.5 w-2.5" /> No Agent
          </span>
        )}
      </div>

      {/* overflow-hidden lives on the inner wrap (clips the photo to its rounded corners) so the
          "!" badge, on the outer wrap, can poke past that edge instead of being clipped with it. */}
      <div className="relative h-16 w-16 shrink-0 sm:h-20 sm:w-20">
        <div className="h-full w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          {lead.property?.image ? (
            <img src={lead.property.image} alt="" className="h-full w-full object-cover" />
          ) : lead.form_title ? (
            // No property photo to match against (see backend's _fill_missing_property_photos) -
            // the form's own title is still more useful here than a bare icon, since it says what
            // this lead actually came in through ("What's My Home Worth?", "I'm Buying", ...).
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-100 p-1 text-center dark:bg-gray-800">
              <SourceIcon className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
              <span className="line-clamp-3 text-[7px] font-black leading-tight text-gray-500 dark:text-gray-400 sm:text-[8px]">{lead.form_title}</span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300 dark:text-gray-700">
              <SourceIcon className="h-6 w-6" />
            </div>
          )}
          <span className="absolute left-1 top-1 inline-flex max-w-[calc(100%-8px)] items-center gap-0.5 whitespace-nowrap rounded-full bg-black/70 px-1 py-0.5 text-[7px] font-black uppercase leading-none text-white">
            <SourceIcon className="h-2 w-2 shrink-0" /> {SOURCE_META[lead.primary_source].label}
          </span>
          {!!lead.showcase_new_matches && (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500 px-1 py-0.5 text-[7px] font-black uppercase leading-none text-white shadow-sm">
              {lead.showcase_new_matches} New {lead.showcase_new_matches === 1 ? 'Match' : 'Matches'}
            </span>
          )}
        </div>
        {flagged && (
          <button
            type="button"
            onClick={dismissAttention}
            title="Dismiss - mark as reviewed"
            className="absolute -right-1 -top-1 z-10 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-red-500 text-[9px] font-black leading-none text-white ring-2 ring-white dark:ring-[#151517]"
          >
            !
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5 pr-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 pr-28 sm:pr-32">
          <p title={lead.name || 'Unnamed Lead'} className="min-w-0 truncate text-sm font-black text-[#111827] dark:text-white">{abbreviateName(lead.name)}</p>
          {lead.email && <CopyIconButton icon={Mail} title="Click to copy email" onClick={event => copy(event, lead.email!, 'Email')} />}
          {lead.phone && <CopyIconButton icon={Phone} title="Click to copy phone number" onClick={event => copy(event, lead.phone!, 'Phone number')} />}
        </div>

        {showSourceLine && (
          <p className="mt-1 truncate text-[10px] font-semibold text-gray-400">
            <span className="font-black text-[#8b7355]">Source:</span> {SOURCE_META[lead.primary_source].label}
          </p>
        )}

        {lead.last_event_source_type && (
          <p className="mt-0.5 truncate text-[10px] font-semibold text-gray-400">
            <span className="font-black text-[#8b7355]">Activity:</span> {ACTIVITY_LABELS[lead.last_event_source_type]}
            {activityAddress && <> ({activityAddress})</>}
          </p>
        )}

        {lead.last_event_at && (
          <p className="mt-0.5 text-[10px] font-semibold text-gray-400">
            <span className="font-black text-[#8b7355]">Active:</span> {formatRelativeDay(lead.last_event_at)}
          </p>
        )}

        {(lead.has_tour_request || lead.has_liked_property || lead.has_disliked_property || lead.has_commented) && (
          <div className="mt-1 flex items-center gap-1">
            {lead.has_tour_request && <InteractionIcon icon={Calendar} color="bg-red-500" title="Requested a tour" />}
            {lead.has_liked_property && <InteractionIcon icon={Heart} color="bg-green-500" title="Liked a property" />}
            {lead.has_disliked_property && <InteractionIcon icon={ThumbsDown} color="bg-red-500" title="Disliked a property" />}
            {lead.has_commented && <InteractionIcon icon={MessageSquare} color="bg-blue-500" title="Left a comment" />}
          </div>
        )}

        {(lead.has_second_visit_request || lead.showcase_deleted) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {lead.has_second_visit_request && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <CalendarClock className="h-2.5 w-2.5" /> 2nd Visit
              </span>
            )}
            {lead.showcase_deleted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <Trash2 className="h-2.5 w-2.5" /> Showcase Deleted
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
