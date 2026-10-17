'use client'

import { OhpSpinner } from '@/components/brand/OhpLoader'
import React, { useState, memo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Home, Bed, Bath,
  MapPin, Calendar, CalendarX, Inbox,
  CheckCircle2, MessageSquare,
  Clock, User, Layers, Ruler, SortDesc, Check,
  Copy, X, Mail, Ban, UsersRound
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import AuthGuard from '@/components/AuthGuard'
import SubscriptionGuard from '@/components/SubscriptionGuard'
import BrokerAuthorizationGuard from '@/components/BrokerAuthorizationGuard'
import Footer from '@/components/Footer'
import LuxeHero, { LuxeStats } from '@/components/ui/LuxeHero'
import api from "@/lib/api-service";
import { normalizeImageUrl } from '@/lib/utils'
import GooglePlacesAutocomplete, { GooglePlacesAutocompleteRef } from '@/components/GooglePlacesAutocomplete'
import RequestToHostModal from '@/components/open-house-manager/RequestToHostModal'
import MyRequestsPanel from '@/components/open-house-manager/MyRequestsPanel'
import PropertyQuickViewModal from '@/components/PropertyQuickViewModal'
import { useOpenHouseActionCounts } from '@/hooks/useOpenHouseActionCount'
import { IncomingBroadcast, TeamMembership } from '@/types'
import WeekendCalendarCards from '@/components/open-house-manager/WeekendCalendarCards'
import { copyText } from '@/lib/copyText'

const US_STATES = [
  'PA', 'NJ', 'DE', 'MD', 'DC', 'VA', 'NY'
]

// A 3+ word listing agent name ("John Michael Smith") was wrapping the card's agent/office row
// onto a second line, which also pushed into the calendar cards below it. Dropping the middle
// name(s) covers the common case; the row itself also gets a hard nowrap+truncate below as a
// safety net for a genuinely long first/last name on its own.
function compactAgentName(fullName: string | null | undefined): string {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 2) return fullName
  return `${parts[0]} ${parts[parts.length - 1]}`
}

// --- Email Template Modal ---
const EmailModal = ({ property, user, onClose, showToast }: { property: any, user: any, onClose: () => void, showToast: any }) => {
  // First name only ("Hi Thomas", not "Hi Thomas S Dilsheimer"), and the MLS's ALL CAPS street/town in normal case.
  const agentFirstName = (property.ListAgentFullName || '').trim().split(/\s+/)[0] || 'there'
  const titleCase = (v?: string) => (v && v === v.toUpperCase() ? v.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()) : v || '')
  const emailSubject = `Hosting an Open House for ${titleCase(property.Street)}`;
  const emailBody = `Hi ${agentFirstName},\n\nMy name is ${user?.first_name} ${user?.last_name} from ${user?.brokerage}. I saw your listing at ${titleCase(property.Street)} in ${titleCase(property.City)} and would love to help you host an open house this upcoming weekend.\n\nBest regards,\n\n${user?.first_name} ${user?.last_name}\n${user?.phone || ''}`;
  const bannerText = `${property.ListAgentFullName || 'This listing agent'} doesn't have OpenHousePal, so you'll need to email them directly using the template below.`;

  const copyToClipboard = (text: string, label: string) => {
    copyText(text);
    showToast(`${label} copied to clipboard!`, 'success');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A1A1C] w-full max-w-2xl rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-50 dark:border-gray-800/50 flex items-center justify-between bg-gray-50/50 dark:bg-[#0B0B0B]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C9A24D]/10 rounded-2xl text-[#C9A24D]">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#111827] dark:text-white uppercase tracking-tight">Request to Host</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Example Outreach Email</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5">
            <Mail size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">
              {bannerText}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recipient</label>
              <button
                onClick={() => copyToClipboard(property.ListingAgentEmail || '', 'Email')}
                className="flex items-center gap-1 text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
              >
                <Copy size={10} />
                Copy
              </button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800 text-sm font-bold text-[#111827] dark:text-white">
              {property.ListingAgentEmail}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</label>
              <button 
                onClick={() => copyToClipboard(emailSubject, 'Subject')}
                className="flex items-center gap-1 text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
              >
                <Copy size={10} />
                Copy
              </button>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800 text-sm font-bold text-[#111827] dark:text-white">
              {emailSubject}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message Body</label>
              <button 
                onClick={() => copyToClipboard(emailBody, 'Email body')}
                className="flex items-center gap-1 text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
              >
                <Copy size={10} />
                Copy Body
              </button>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-[#0B0B0B] rounded-2xl border border-gray-100 dark:border-gray-800 text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-medium">
              {emailBody}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50/50 dark:bg-[#0B0B0B]/50 border-t border-gray-50 dark:border-gray-800/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Dashboard Stat Card ---
// Each stat gets its own accent tied to what it means (gold=headline total, amber=needs
// action, blue=in progress, emerald=success) instead of one uniform gray box repeated 4x -
// gives the mobile 2x2 grid some visual hierarchy instead of reading like spreadsheet cells.
const STAT_ACCENTS = {
  neutral: { bg: 'bg-white dark:bg-[#151517] border-gray-200 dark:border-gray-800', iconBg: 'bg-gray-50 dark:bg-gray-800', icon: 'text-gray-400 dark:text-gray-500' },
  gold: { bg: 'bg-[#FCF9F1] dark:bg-[#C9A24D]/5 border-[#C9A24D]/30 dark:border-[#C9A24D]/20', iconBg: 'bg-[#C9A24D]/10 dark:bg-[#C9A24D]/20', icon: 'text-[#C9A24D]' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20', iconBg: 'bg-amber-100 dark:bg-amber-500/20', icon: 'text-amber-600 dark:text-amber-400' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20', iconBg: 'bg-blue-100 dark:bg-blue-500/20', icon: 'text-blue-600 dark:text-blue-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20', iconBg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: 'text-emerald-600 dark:text-emerald-400' },
} as const

const StatCard = ({ title, value, icon: Icon, accent = 'neutral' }: { title: string, value: string | number, icon: any, accent?: keyof typeof STAT_ACCENTS }) => {
  const c = STAT_ACCENTS[accent]
  // Deliberately identical in shape to the Open House Manager's summary tiles
  // (components/open-house-manager/SummaryMetricCard): icon in a rounded chip next to the number
  // on the top line, the label uppercase underneath.
  return (
    <div className={`rounded-xl border p-2.5 shadow-sm sm:p-4 ${c.bg}`}>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg sm:h-7 sm:w-7 ${c.iconBg}`}>
          <Icon size={13} className={`${c.icon} sm:h-[15px] sm:w-[15px]`} />
        </span>
        <p className="text-lg font-black leading-none text-[#111827] dark:text-white sm:text-2xl">{value}</p>
      </div>
      <p className="mt-1 text-[8px] font-bold uppercase leading-tight tracking-tight text-gray-500 dark:text-gray-400 sm:text-[11px] sm:tracking-widest">{title}</p>
    </div>
  )
}

// --- Dashboard Property Row ---
const DiscoveryPropertyRow = memo(function DiscoveryPropertyRow({ property, openHouseSchedule, isNewAndUnseen, onRequestToHost, onViewDetail, requestedDates, busyDates }: { requestedDates?: string[], busyDates?: string[], property: any, openHouseSchedule?: { status: string, scheduled_date?: string | null, scheduled_start_time?: string | null, scheduled_end_time?: string | null, scheduled_opens?: { scheduled_date: string | null, scheduled_start_time: string | null, scheduled_end_time: string | null, hosting_agent_id?: string | null }[] }, isNewAndUnseen: boolean, onRequestToHost: (p: any, prefillDate?: string) => void, onViewDetail: (p: any) => void }) {
  const { user } = useAuth()
  const isOpenHouseScheduled = openHouseSchedule?.status === 'scheduled'
  const upcomingOpens = openHouseSchedule?.scheduled_opens || []
  return (
    <div
      className="bg-white dark:bg-[#1A1A1C] border-2 border-gray-200 dark:border-gray-800 rounded-3xl p-3.5 flex flex-col md:flex-row md:items-start gap-2 md:gap-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-[#C9A24D] dark:hover:border-[#C9A24D] hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.12)] dark:hover:shadow-black/30 transition-all duration-300 group"
    >
      {/* Image + Middle Content paired in their own stretch group, so the image's height tracks
          just the address-to-"Days on Market" text block next to it - not whatever the tallest
          column in the whole row happens to be (e.g. a wide Scheduled Opens block), which is what
          made the photo balloon in height whenever a listing had a lot of opens. */}
      <div className="flex flex-col md:flex-row md:items-stretch flex-1 min-w-0 gap-2 md:gap-5">
      {/* Image Section - a 4:3 aspect ratio on mobile (matches Bright MLS listing photo
          dimensions) rather than the fixed-height square crop the /open-houses kit cards use;
          city overlaid on the photo itself with a MapPin, same treatment as the open house
          page cards. */}
      <div className="relative w-full md:w-[188px] aspect-[4/3] md:aspect-auto md:h-auto shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-[#0B0B0B]">
        <Image
          // No photo yet: the site's own placeholder. Prefixing it with the API address pointed it at
          // a host next/image doesn't allow, which crashed the whole page on a photo-less listing.
          src={property.Image ? normalizeImageUrl(property.Image) : '/placeholder.jpg'}
          alt={property.Street}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 188px"
        />

        {/* Price overlay - mobile only, bottom-left over a gradient scrim (city moved into the
            address line instead). */}
        <div className="md:hidden absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 pb-2.5 pt-8">
          <span className="text-lg font-black text-white tracking-tight">{property.Price}</span>
        </div>

        {isNewAndUnseen && (
          <div className="absolute top-2.5 left-2.5">
            <span className="bg-[#C9A24D] text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg border border-white/10">
              New
            </span>
          </div>
        )}
        {isOpenHouseScheduled && (
          // Centered when it's the only badge on the photo - stacked directly under "New" (same
          // left edge, not centered) when both show, since a centered badge on a narrow thumbnail
          // overlaps "New" pinned top-left. Stacking guarantees no overlap regardless of exact
          // badge widths, unlike trying to share the top row side by side.
          <div className={`absolute flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-lg shadow-lg border border-white/10 whitespace-nowrap ${
            isNewAndUnseen ? 'left-2.5 top-9' : 'left-1/2 -translate-x-1/2 top-2.5'
          }`}>
            <Check size={10} strokeWidth={3.5} />
            <span className="text-[9px] font-black uppercase tracking-widest leading-none">Open Scheduled</span>
          </div>
        )}
        {/* Days on Market - top-right of the photo on mobile; desktop keeps its own text row below. */}
        <div className="md:hidden absolute top-2.5 right-2.5">
          <span className="flex items-center gap-1 bg-black/60 text-white text-[9px] font-bold px-2 py-1 rounded-lg border border-white/10 whitespace-nowrap">
            <Clock size={10} />
            {property.DaysOnMarket === 0 ? 'New' : `${property.DaysOnMarket}d`}
          </span>
        </div>
        {property.DistanceFromLandmark && (
          <div className="absolute bottom-2.5 right-2.5">
            <div className="bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10">
              {property.DistanceFromLandmark.toFixed(1)} mi
            </div>
          </div>
        )}
      </div>

      {/* Middle Content */}
      <div className="flex-grow min-w-0 md:py-0.5 flex flex-col md:justify-center gap-1.5 md:gap-2">
        <div>
          <h3 className="text-lg font-black text-[#111827] dark:text-white leading-tight mb-0.5 truncate group-hover:text-[#C9A24D] transition-colors">
            {property.Street}<span className="md:hidden">, {property.City}</span>
          </h3>
          <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 font-semibold">{property.City}, {property.State} {property.Zipcode}</p>
        </div>

        {/* Identical to the Open House Manager listing card's stat row (components/open-house-
            manager/ListingCard): icon, number, then the word, all inline on one line. */}
        <div className="flex items-center gap-4 text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-1.5">
            <Bed size={13} />
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{property.Beds}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Beds</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bath size={13} />
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{property.Baths}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Baths</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Ruler size={13} />
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{property.SquareFeet?.toLocaleString()}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider">Sqft</span>
          </div>
        </div>

        <div className="flex flex-nowrap items-center gap-2.5 overflow-hidden">
          <div className="flex min-w-0 shrink items-center gap-1.5">
            {/* Real headshot for an agent already on OpenHousePal instead of the generic
                placeholder icon - AgentOnPlatform listings have ListAgentPhotoUrl set whenever
                that agent has uploaded one. */}
            {property.AgentOnPlatform && property.ListAgentPhotoUrl ? (
              <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
                <Image src={normalizeImageUrl(property.ListAgentPhotoUrl)} alt={property.ListAgentFullName} fill className="object-cover" sizes="20px" />
              </div>
            ) : (
              <div className="w-5 h-5 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center shrink-0">
                <User size={9} className="text-gray-400 dark:text-gray-500" />
              </div>
            )}
            <span className="truncate text-[11px] font-bold text-gray-800 dark:text-gray-200">{compactAgentName(property.ListAgentFullName)}</span>
          </div>
          <span className="shrink-0 text-gray-300 dark:text-gray-700">•</span>
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{property.ListOfficeName}</span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-nowrap">
          <Clock size={11} />
          {property.DaysOnMarket === 0 ? 'Just Listed' : `${property.DaysOnMarket} Days on Market`}
        </div>
      </div>

      {/* Weekend mini calendar - same "which of the next 2 weekends still needs a host" glance as
          the listing agent's own property cards on Manager, but clicking an empty cell here jumps
          straight into Request to Host with that date already filled in instead of prefilling a
          direct request. An already-booked cell isn't actionable for a viewer here (they can't
          request an already-taken slot), so it renders read-only. Sized up ("lg") from Manager's
          own cards since this is the row's only path into Request to Host now - no separate button
          underneath - so the time needs to read clearly at a glance. Desktop only - mobile keeps
          the "Open Scheduled" checkmark on the photo instead, there's no room for a 4-cell grid there. */}
      <div className="hidden md:flex w-[430px] shrink-0 flex-col">
        <WeekendCalendarCards
          opens={upcomingOpens}
          size="lg"
          filledClickable={false}
          emptyCellTitle="Click to request hosting this date"
          filledCellTitle="Already scheduled"
          onCellClick={(cell, open) => { if (!open) onRequestToHost(property, cell.date) }}
          viewerId={user?.id}
          othersMuted
          hostingWindow={{ hosting_blocked: property.HostingBlocked, hosts_from: property.HostsFrom }}
          pendingDates={requestedDates}
          pendingLabel="Requested"
          pendingTitle="You asked to host this day - waiting on the listing agent"
          busyDates={busyDates}
        />
      </div>
      </div>

      {/* Right Content / Actions - price and buttons clustered together and vertically centered
          in this column (not pinned to opposite ends), so a tall row - e.g. a listing with a
          full Scheduled Opens block next to it - doesn't leave a dead gap between them. Full-width
          button row on mobile (both buttons real, tappable sizes) instead of squeezing a stack of
          tiny buttons next to the price. Desktop keeps the narrow stacked sidebar. */}
      <div className="flex flex-col justify-center items-stretch md:items-center gap-2 md:gap-3 md:w-44 shrink-0 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 pt-1.5 md:pt-0 md:pl-5">
        <span className="hidden md:block text-xl font-black text-[#111827] dark:text-white tracking-tight shrink-0">
          {property.Price}
        </span>

        <div className="flex flex-row md:flex-col gap-1.5 w-full">
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail(property) }}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-2 md:py-1.5 rounded-xl md:rounded-[1.25rem] text-[10px] md:text-[9px] font-black uppercase tracking-wide hover:border-[#C9A24D] hover:text-[#C9A24D] active:scale-95 transition-all whitespace-nowrap"
          >
            View Details
          </button>
          {property.AgentOnPlatform && property.HostRequestEligible === false ? (
            <div
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl md:rounded-[1.25rem] border border-red-200 bg-red-50 px-2 py-2 md:py-2.5 text-center text-[10px] md:text-[9px] font-black uppercase leading-tight tracking-wide text-red-600 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400"
              title="This listing agent isn't accepting host requests from you right now"
            >
              <Ban size={12} className="shrink-0" />
              <span>Not Accepting Host Requests</span>
            </div>
          ) : property.HostingBlocked ? (
            // Coming Soon with no go-live date yet: Bright allows no showings, so no open house.
            <div
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-xl md:rounded-[1.25rem] border border-gray-200 bg-gray-50 px-2 py-2 md:py-2.5 text-center text-[10px] md:text-[9px] font-black uppercase leading-tight tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400"
              title="Coming Soon - Bright allows no showings until it goes active"
            >
              <Clock size={12} className="shrink-0" />
              <span>Coming Soon · Hosting once it&apos;s active</span>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestToHost(property) }}
              className="flex-1 md:flex-none flex items-center justify-center gap-1.5 bg-[#C9A24D] text-white py-2 md:py-2.5 rounded-xl md:rounded-[1.25rem] text-[10px] md:text-[9px] font-black uppercase tracking-wide shadow-lg shadow-[#C9A24D]/30 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
            >
              <Calendar size={12} className="shrink-0" />
              Request to Host
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default function OpenHouseDiscovery() {
  const { showToast } = useToast()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const { hostCount } = useOpenHouseActionCounts()
  const [address, setAddress] = useState('')
  const [miles, setMiles] = useState<string>('10')
  const [listings, setListings] = useState<any[]>([])
  const [preferences, setPreferences] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Modal State
  const [selectedPropertyForRequest, setSelectedPropertyForRequest] = useState<any>(null)
  // Set when the agent got here by clicking an empty weekend-calendar cell on a listing row -
  // prefills Request to Host's date so they don't have to look it up again, mirroring the same
  // click-to-prefill behavior Manager's own property cards already have.
  const [requestPrefillDate, setRequestPrefillDate] = useState<string | null>(null)
  const [emailFallbackProperty, setEmailFallbackProperty] = useState<any>(null)
  const [quickViewListingKey, setQuickViewListingKey] = useState<string | null>(null)
  const [isMyRequestsOpen, setIsMyRequestsOpen] = useState(false)

  // Open House Manager stats: my own outgoing requests + which browsed listings already have an open house
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [listingStatuses, setListingStatuses] = useState<Record<string, { status: string, scheduled_date?: string | null, scheduled_start_time?: string | null, scheduled_end_time?: string | null, scheduled_opens?: { scheduled_date: string | null, scheduled_start_time: string | null, scheduled_end_time: string | null }[] }>>({})
  // Open "my team needs a host" asks the current viewer is eligible to respond to - surfaced
  // inline on Request to Host for whichever listing they belong to instead of only in My Requests.
  const [incomingBroadcasts, setIncomingBroadcasts] = useState<IncomingBroadcast[]>([])

  // Dropdown States
  const [showBrokerageDropdown, setShowBrokerageDropdown] = useState(false)
  const [brokerageSearch, setBrokerageSearch] = useState('')
  const [searchedBrokerages, setSearchedBrokerages] = useState<string[]>([])
  const [isSearchingBrokerages, setIsSearchingBrokerages] = useState(false)

  // Agent exclude filter - opposite of Brokerages (hides rather than includes). There's no
  // dedicated "all agents" reference table like Brokerage/City/Township, so the picker searches
  // the listing agents already present in the current discovery results instead.
  const [showAgentDropdown, setShowAgentDropdown] = useState(false)
  const [agentSearch, setAgentSearch] = useState('')

  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [citySearch, setCitySearch] = useState('')
  const [searchedCities, setSearchedCities] = useState<string[]>([])
  const [isSearchingCities, setIsSearchingCities] = useState(false)

  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false)
  const [districtSearch, setDistrictSearch] = useState('')
  const [searchedDistricts, setSearchedDistricts] = useState<string[]>([])
  const [isSearchingDistricts, setIsSearchingDistricts] = useState(false)

  // Team filter - every OTHER agent's Open House Team the current agent is an accepted member of
  // (an agent can be on any number of teams at once). Empty selection means no team filtering at
  // all, same "nothing selected = unrestricted" convention as every other filter here; picking one
  // or more narrows results to just those teams' listings.
  const [myTeams, setMyTeams] = useState<TeamMembership[]>([])
  const [selectedTeamOwnerIds, setSelectedTeamOwnerIds] = useState<string[]>([])
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)

  // Client-side UI Filters
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [minBeds, setMinBeds] = useState<number | ''>('')
  const [minBaths, setMinBaths] = useState<number | ''>('')
  const [minSqft, setMinSqft] = useState<number | ''>('')
  const [minPrice, setMinPrice] = useState<number | ''>('')

  // Sort State
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'dom_asc' | 'dom_desc' | 'distance_asc' | 'distance_desc'>('dom_asc')
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const [showStateDropdown, setShowStateDropdown] = useState(false)

  // Mobile: all 7 filter/sort pills live behind one "Filters & Sort" button that opens a bottom
  // sheet, instead of a horizontally-scrolling pill row - same pills, just re-homed.
  const [showMobileFiltersSheet, setShowMobileFiltersSheet] = useState(false)

  // Results pagination - client-side, since Discovery already caps results server-side.
  const [resultsPerPage, setResultsPerPage] = useState(12)
  const [currentPage, setCurrentPage] = useState(1)
  const [listingsFadeKey, setListingsFadeKey] = useState(0)
  // Page-change scrolls back to the results header (not the very top of the page - the filter
  // bar above stays put) with a smooth animation, and re-keys the grid so it fades the new page's
  // cards in rather than just snapping to different content.
  const goToPage = (page: number) => {
    setCurrentPage(page)
    setListingsFadeKey(k => k + 1)
    document.getElementById('discovery-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const changeResultsPerPage = (size: number) => {
    setResultsPerPage(size)
    setListingsFadeKey(k => k + 1)
  }

  // Flat "tab" look for the filter/sort trigger buttons - same recipe as the flat action segments
  // on Open House Manager's header card (no pill/border of their own, just background + text
  // color, all living inside one shared bordered toolbar card instead).
  const filterTabBase = 'flex items-center justify-start md:justify-center gap-2 px-4 py-3 md:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.96] w-full md:w-auto'
  const filterTabActive = 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]'
  const filterTabInactive = 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'

  const dropdownRef = useRef<HTMLDivElement>(null)
  const agentDropdownRef = useRef<HTMLDivElement>(null)
  const cityDropdownRef = useRef<HTMLDivElement>(null)
  const districtDropdownRef = useRef<HTMLDivElement>(null)
  const filterDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const stateDropdownRef = useRef<HTMLDivElement>(null)
  const teamDropdownRef = useRef<HTMLDivElement>(null)
  const addressRef = useRef<GooglePlacesAutocompleteRef>(null)

  const handleDiscoveryResponse = (data: any) => {
    if (!data) return;
    setListings(data.data || []);
    setPreferences(data.preferences);
    
    // Sync address and miles if they exist
    if (data.preferences?.landmark_address) {
      setAddress(data.preferences.landmark_address);
    }
    if (data.preferences?.miles) {
      setMiles(data.preferences.miles.toString());
    }

    // Sync local numeric filters if present in preferences
    if (data.preferences?.min_bedrooms !== undefined) {
      const val = data.preferences.min_bedrooms;
      setMinBeds(val === null || val === undefined ? '' : val);
    }
    if (data.preferences?.min_bathrooms !== undefined) {
      const val = data.preferences.min_bathrooms;
      setMinBaths(val === null || val === undefined ? '' : val);
    }
    if (data.preferences?.min_square_feet !== undefined) {
      const val = data.preferences.min_square_feet;
      setMinSqft(val === null || val === undefined ? '' : val);
    }
    if (data.preferences?.min_price !== undefined) {
      const val = data.preferences.min_price;
      setMinPrice(val === null || val === undefined ? '' : val);
    }
  };

  const updateCriteria = async (updates: any) => {
    if (!preferences) return;
    
    // Optimistic Update
    setPreferences({ ...preferences, ...updates });
    
    try {
      const { success, data, error } = await api.discovery.patchPreferences(updates);
      if (success && data) {
        handleDiscoveryResponse(data);
      } else {
        showToast(error || "Couldn't save that filter - try again.", 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update discovery preferences:', err);
      showToast("Couldn't save that filter - try again.", 'error');
      setPreferences(preferences);
    }
  };

  const toggleBrokerage = async (brokerage: string) => {
    if (!preferences) return;
    const current = preferences.brokerages || [];
    const isSelected = current.includes(brokerage);
    const updated = isSelected ? current.filter((b: string) => b !== brokerage) : [...current, brokerage];
    
    setPreferences({ ...preferences, brokerages: updated });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ brokerages: updated });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update brokerage preference:', err);
      showToast("Couldn't save that filter - try again.", 'error');
      setPreferences(preferences);
    }
  };

  const toggleAgent = async (agent: string) => {
    if (!preferences) return;
    const current = preferences.excluded_agents || [];
    const isSelected = current.includes(agent);
    const updated = isSelected ? current.filter((a: string) => a !== agent) : [...current, agent];

    setPreferences({ ...preferences, excluded_agents: updated });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ excluded_agents: updated });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update excluded agent preference:', err);
      showToast("Couldn't save that filter - try again.", 'error');
      setPreferences(preferences);
    }
  };

  // Flip the agent picker between hiding the picked agents (default) and showing ONLY the
  // picked agents (opposite behavior, same underlying excluded_agents list).
  const setAgentFilterMode = async (mode: 'exclude' | 'include') => {
    if (!preferences) return;
    setPreferences({ ...preferences, agent_filter_mode: mode });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ agent_filter_mode: mode });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update agent filter mode:', err);
      showToast("Couldn't save that filter - try again.", 'error');
      setPreferences(preferences);
    }
  };

  const toggleCity = async (city: string) => {
    if (!preferences) return;
    const current = preferences.cities || [];
    const isSelected = current.includes(city);
    const updated = isSelected ? current.filter((c: string) => c !== city) : [...current, city];
    
    setPreferences({ ...preferences, cities: updated });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ cities: updated });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update city preference:', err);
      showToast("Couldn't save that filter - try again.", 'error');
      setPreferences(preferences);
    }
  };

  const toggleDistrict = async (district: string) => {
    if (!preferences) return;
    const current = preferences.school_districts || [];
    const isSelected = current.includes(district);
    const updated = isSelected ? current.filter((d: string) => d !== district) : [...current, district];
    
    setPreferences({ ...preferences, school_districts: updated });
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ school_districts: updated });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update district preference:', err);
      showToast("Couldn't save that filter - try again.", 'error');
      setPreferences(preferences);
    }
  };

  const handleStateSelect = async (state: string) => {
    if (!preferences) return;
    
    setPreferences({ ...preferences, state });
    setShowStateDropdown(false);
    
    try {
      const { success, data, error } = await api.discovery.patchPreferences({ state });
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error');
        setPreferences(preferences);
      }
    } catch (err) {
      console.error('Failed to update state preference:', err);
      showToast("Couldn't save that filter - try again.", 'error');
      setPreferences(preferences);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowBrokerageDropdown(false);
      }
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(target)) {
        setShowAgentDropdown(false);
      }
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(target)) {
        setShowCityDropdown(false);
      }
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(target)) {
        setShowDistrictDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(target)) {
        setShowFilterDropdown(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setShowSortDropdown(false);
      }
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(target)) {
        setShowStateDropdown(false);
      }
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(target)) {
        setShowTeamDropdown(false);
      }
    }

    document.addEventListener("mouseup", handleClickOutside);
    return () => document.removeEventListener("mouseup", handleClickOutside);
  }, []);

  // Loaded once, not per-search - which teams you're on doesn't depend on the current search area.
  useEffect(() => {
    api.openHouseManager.getMyTeamMemberships().then(({ success, data }) => {
      if (success && data) setMyTeams(data)
    })
  }, []);

  const toggleTeamOwner = (ownerId: string) => {
    setSelectedTeamOwnerIds(prev => prev.includes(ownerId) ? prev.filter(id => id !== ownerId) : [...prev, ownerId]);
  };

  // Agent picker options - deduped listing agents seen in the current discovery results, since
  // there's no dedicated "all agents" table to search against.
  const knownAgents = Array.from(new Set(
    listings.map((p: any) => p.ListAgentFullName).filter((name: string) => name && name !== 'Unknown')
  )) as string[]
  const searchedAgents = agentSearch
    ? knownAgents.filter(name => name.toLowerCase().includes(agentSearch.toLowerCase()))
    : knownAgents
  const isAgentIncludeMode = preferences?.agent_filter_mode === 'include'
  const agentAccent = isAgentIncludeMode
    ? { border: 'border-emerald-400', pillActive: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', hoverBorder: 'hover:border-emerald-300', ring: 'focus:ring-emerald-300', selected: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500 border-emerald-500', badge: 'bg-emerald-500' }
    : { border: 'border-rose-400', pillActive: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400', hoverBorder: 'hover:border-rose-300', ring: 'focus:ring-rose-300', selected: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500 border-rose-500', badge: 'bg-rose-500' }

  // Filter and Sort properties based on UI controls
  const filteredListings = [...listings]
    .filter(property => {
      if (minBeds && property.Beds < minBeds) return false;
      if (minBaths && property.Baths < minBaths) return false;
      if (minSqft && property.SquareFeet < minSqft) return false;
      if (minPrice) {
        const priceNum = parseInt(property.Price.replace(/[$,]/g, ''));
        if (priceNum < minPrice) return false;
      }
      if (selectedTeamOwnerIds.length > 0 && !selectedTeamOwnerIds.includes(property.OnPlatformAgentId)) return false;
      return true;
    })
    .sort((a, b) => {
      const priceA = parseInt(a.Price.replace(/[$,]/g, ''));
      const priceB = parseInt(b.Price.replace(/[$,]/g, ''));
      // Listings with no distance (no landmark address searched) sort to the bottom either way.
      const distA = a.DistanceFromLandmark ?? Infinity;
      const distB = b.DistanceFromLandmark ?? Infinity;

      switch (sortBy) {
        case 'price_asc': return priceA - priceB;
        case 'price_desc': return priceB - priceA;
        case 'dom_asc': return a.DaysOnMarket - b.DaysOnMarket;
        case 'dom_desc': return b.DaysOnMarket - a.DaysOnMarket;
        case 'distance_asc': return distA - distB;
        case 'distance_desc': {
          // Farthest first, but listings with no distance (no landmark searched) still sink to
          // the bottom instead of jumping to the top just because Infinity sorts "biggest".
          if (distA === Infinity && distB === Infinity) return 0;
          if (distA === Infinity) return 1;
          if (distB === Infinity) return -1;
          return distB - distA;
        }
        default: return 0;
      }
    });

  // Closest/Farthest sort only makes sense once an address+radius search is active.
  const hasLandmarkSearch = listings.some((p: any) => p.DistanceFromLandmark != null);
  const activeFilterCount = (minBeds ? 1 : 0) + (minBaths ? 1 : 0) + (minSqft ? 1 : 0) + (minPrice ? 1 : 0);

  // Combined count across every filter category, used on the mobile "Filters & Sort" trigger
  // badge so agents can see at a glance whether anything is narrowing their results.
  const totalActiveFilterCount =
    (preferences?.brokerages?.length || 0) +
    (preferences?.excluded_agents?.length || 0) +
    (preferences?.cities?.length || 0) +
    (preferences?.school_districts?.length || 0) +
    (preferences?.state ? 1 : 0) +
    activeFilterCount +
    (sortBy !== 'dom_asc' ? 1 : 0) +
    selectedTeamOwnerIds.length;

  const resetAllFiltersMobile = () => {
    setMinBeds(''); setMinBaths(''); setMinSqft(''); setMinPrice('');
    setSortBy('dom_asc');
    setSelectedTeamOwnerIds([]);
    updateCriteria({
      brokerages: [],
      excluded_agents: [],
      cities: [],
      school_districts: [],
      state: null,
      min_bedrooms: null,
      min_bathrooms: null,
      min_square_feet: null,
      min_price: null,
    });
  };

  const closeMobileFiltersSheet = () => {
    setShowMobileFiltersSheet(false);
    // Also collapse any pill that was expanded inside the sheet, so it doesn't reopen
    // already-expanded next time.
    setShowBrokerageDropdown(false);
    setShowAgentDropdown(false);
    setShowCityDropdown(false);
    setShowDistrictDropdown(false);
    setShowFilterDropdown(false);
    setShowSortDropdown(false);
    setShowStateDropdown(false);
  };

  // Pagination - slice the already-filtered/sorted list client-side.
  const totalPages = Math.max(1, Math.ceil(filteredListings.length / resultsPerPage));
  const paginatedListings = filteredListings.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);

  // Jump back to page 1 whenever the underlying result set or its ordering changes, so the user
  // never lands on a now-empty page.
  useEffect(() => {
    setCurrentPage(1);
  }, [listings, minBeds, minBaths, minSqft, minPrice, sortBy, resultsPerPage]);

  // Deep link from a notification (e.g. "your request was declined") - see the ?myRequests=1
  // link= values in open_house_manager_service.py.
  useEffect(() => {
    if (searchParams.get('myRequests') === '1') setIsMyRequestsOpen(true)
  }, [searchParams]);

  // Deep link from the Dashboard's "Open House Discovery" shortcut panel - clicking an open
  // calendar date there lands here with the request-to-host modal already open for that listing,
  // instead of just dropping the agent on the full unfiltered list to find it themselves.
  useEffect(() => {
    const key = searchParams.get('listingKey')
    if (!key || listings.length === 0) return
    const match = listings.find((p: any) => p.ListingKey === key)
    if (match) setSelectedPropertyForRequest(match)
  }, [searchParams, listings]);

  // Debounced Searches
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!brokerageSearch) { setSearchedBrokerages([]); return; }
      setIsSearchingBrokerages(true)
      try {
        const { success, data } = await api.properties.brokerages(brokerageSearch);
        if (success && data?.results) setSearchedBrokerages(data.results)
      } catch (err) { console.error('Failed to search brokerages:', err) } finally { setIsSearchingBrokerages(false) }
    }, 300)
    return () => clearTimeout(searchTimer)
  }, [brokerageSearch])

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!citySearch) { setSearchedCities([]); return; }
      setIsSearchingCities(true)
      try {
        const { success, data } = await api.properties.cities(citySearch);
        if (success && data?.results) setSearchedCities(data.results)
      } catch (err) { console.error('Failed to search cities:', err) } finally { setIsSearchingCities(false) }
    }, 300)
    return () => clearTimeout(searchTimer)
  }, [citySearch])

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!districtSearch) { setSearchedDistricts([]); return; }
      setIsSearchingDistricts(true)
      try {
        const { success, data } = await api.properties.searchSchoolDistricts(districtSearch);
        if (success && data?.results) setSearchedDistricts(data.results)
      } catch (err) { console.error('Failed to search districts:', err) } finally { setIsSearchingDistricts(false) }
    }, 300)
    return () => clearTimeout(searchTimer)
  }, [districtSearch])

  useEffect(() => {
    async function getDiscoveryProperties() {
      setIsLoading(true)
      const { success, data, error } = await api.discovery.get();
      if (success && data) {
        handleDiscoveryResponse(data);
      } else if (error) {
        showToast(error, 'error')
      }
      setIsLoading(false)
    }
    getDiscoveryProperties()
  }, [showToast])

  const refreshMyRequests = async () => {
    const { success, data } = await api.openHouseManager.getMyRequests()
    if (success && data) setMyRequests(data)
  }

  const refreshIncomingBroadcasts = async () => {
    const { success, data } = await api.openHouseManager.getIncomingBroadcasts()
    if (success && data) setIncomingBroadcasts(data)
  }

  useEffect(() => {
    refreshMyRequests()
    refreshIncomingBroadcasts()
    // Keeps the "My Requests" badge live if a listing agent proposes/approves/declines a time
    // while this page is open, instead of only updating on next load.
    const handleFocus = () => { refreshMyRequests(); refreshIncomingBroadcasts() }
    window.addEventListener('focus', handleFocus)
    const interval = setInterval(() => { refreshMyRequests(); refreshIncomingBroadcasts() }, 8000)
    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const listingKeys = (listings || []).map((p: any) => p.ListingKey).filter(Boolean)
    if (listingKeys.length === 0) {
      setListingStatuses({})
      return
    }
    const refreshStatuses = () => {
      api.openHouseManager.getListingStatuses(listingKeys).then(({ success, data }) => {
        if (success && data) setListingStatuses(data)
      })
    }
    refreshStatuses()
    // Same live-refresh pattern as refreshMyRequests/refreshIncomingBroadcasts above (and what
    // Manager's my-listings page already does on window focus) - without this, a slot someone
    // else just claimed kept showing as open here until a manual reload.
    const handleFocus = () => refreshStatuses()
    window.addEventListener('focus', handleFocus)
    const interval = setInterval(refreshStatuses, 8000)
    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [listings])

  // Closest/Farthest only means anything while an address search is active - fall back to
  // Newest if the address gets cleared out from under an active distance sort.
  useEffect(() => {
    const stillHasDistance = listings.some((p: any) => p.DistanceFromLandmark != null)
    if (!stillHasDistance && (sortBy === 'distance_asc' || sortBy === 'distance_desc')) {
      setSortBy('dom_asc')
    }
  }, [listings, sortBy])

  // "New" listings the agent has already had appear on this page before - the badge should only
  // grab attention the first time a listing shows up here, not forever just because it's still
  // within the backend's 3-day New window. Persisted client-side per agent since there's no
  // dedicated backend concept for this yet; simply having it render in the list counts as "seen"
  // (no click required) - the badge still shows for THIS visit, and is suppressed on the next one.
  const [seenNewKeys, setSeenNewKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(`discovery_seen_new_${user.id}`)
      setSeenNewKeys(new Set(raw ? JSON.parse(raw) : []))
    } catch {
      setSeenNewKeys(new Set())
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const newKeys = listings.filter((p: any) => p.New).map((p: any) => p.ListingKey)
    if (newKeys.length === 0) return
    try {
      const raw = localStorage.getItem(`discovery_seen_new_${user.id}`)
      const existing: string[] = raw ? JSON.parse(raw) : []
      const merged = Array.from(new Set([...existing, ...newKeys]))
      localStorage.setItem(`discovery_seen_new_${user.id}`, JSON.stringify(merged))
    } catch {
      // Best-effort only - worst case the New badge just keeps showing on repeat visits.
    }
  }, [listings, user?.id])

  return (
    <AuthGuard>
      <SubscriptionGuard requireMlsAccess>
        <BrokerAuthorizationGuard>
          <div className="min-h-screen bg-[#fafafb] dark:bg-[#0B0B0B] flex flex-col">
            <main className="flex-grow container mx-auto px-4 py-4 sm:py-6 max-w-7xl text-[#111827] dark:text-[#F3F4F6]">
              {/* Header + Stats - same bordered-card recipe as the Open House Manager header
                  (PageHeader noMargin on the left, stat cards on the right, one shared shadow/
                  border) instead of the two floating unboxed halves this had before, which was
                  the actual gap behind "copy the Manager header." */}
              <LuxeHero
                compact
                className="mb-4"
                kicker="Discovery"
                icon={Search}
                backHref="/open-houses"
                backLabel="Open Houses"
                title={<>Find homes <em>to host.</em></>}
                subtitle="Find brokerage listings you may be able to host and request approval in one place."
                asideClassName="w-full lg:w-[620px] lg:-mt-[18px]"
                aside={
                  <LuxeStats
                    large
                    stats={[
                      { label: 'Listings', value: listings.length, icon: Home, alert: true },
                      { label: 'No opens', value: listings.filter((p: any) => listingStatuses[p.ListingKey]?.status === 'needs_host').length, icon: CalendarX },
                      { label: 'Pending', value: myRequests.filter(r => r.status === 'pending').length, icon: Inbox },
                      { label: 'Accepted', value: myRequests.filter(r => r.status === 'approved').length, icon: CheckCircle2 },
                    ]}
                  />
                }
              />

              {/* Main Search/Listing Panel - one tapered-corner rectangle: the navy search bar is
                  now flush with the card's own top edge (no inset gray margin around it, sharing
                  its rounded corners directly) and the lighter filters section sits directly
                  below it, separated by a real divider line - reads as one connected card with
                  two distinct sections instead of a dark pill floating inside a second card. */}
              <div className="bg-[#f4f3f1] dark:bg-[#151517] rounded-[2.5rem] border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden mb-5">

                {/* Unified Command Center Search Bar - stays a dark, standout pill in both themes */}
                <div className="bg-[#172536] dark:bg-[#1A1A1C] p-4 sm:p-5 flex flex-col lg:flex-row items-center gap-2 text-white border-b border-white/5 dark:border-gray-800 shadow-xl shadow-black/10">
                  <div className="hidden lg:flex items-center gap-3 w-full lg:w-auto px-5 py-2">
                    <div className="p-2 bg-white/5 rounded-xl">
                      <Layers size={18} className="text-[#C9A24D]" />
                    </div>
                    <span className="text-sm font-black uppercase tracking-widest text-white/90">Listings</span>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4 flex-grow w-full px-1 sm:px-2">
                    {/* Distance Pill */}
                    <div className="flex items-center bg-white/5 dark:bg-white/[0.03] border border-white/10 dark:border-white/5 rounded-2xl px-3 sm:px-4 py-2 hover:bg-white/10 active:bg-white/10 transition-colors group shrink-0">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-8 sm:w-10 bg-transparent text-sm font-black text-[#C9A24D] outline-none placeholder:text-[#C9A24D]/50 text-center"
                        value={miles}
                        onChange={(e) => setMiles(e.target.value)}
                        onBlur={() => {
                          const val = parseFloat(miles);
                          if (!isNaN(val)) updateCriteria({ miles: val });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseFloat(miles);
                            if (!isNaN(val)) updateCriteria({ miles: val });
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <span className="text-[9px] sm:text-[10px] font-black text-white/40 uppercase tracking-widest ml-1 pointer-events-none group-hover:text-white/60 transition-colors">
                        <span className="sm:hidden">mi</span>
                        <span className="hidden sm:inline">miles</span>
                      </span>
                    </div>

                    <span className="text-[9px] sm:text-[10px] font-black text-white/30 uppercase tracking-widest sm:tracking-[0.2em] shrink-0">from</span>

                    {/* Address Search */}
                    <div className="relative flex-1 md:ml-2 flex items-center min-w-0 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="flex-1 min-w-0">
                        <GooglePlacesAutocomplete
                          ref={addressRef}
                          value={address}
                          onChange={setAddress}
                          onCoordinatesChange={(lat, lng, addr) => {
                            updateCriteria({ landmark_address: addr, latitude: lat, longitude: lng });
                          }}
                          placeholder="Enter address or landmark"
                          className="w-full !bg-transparent !border-none !shadow-none outline-none text-sm placeholder:!text-white/30 font-bold py-2 !text-white focus:!ring-0 focus:!border-transparent px-4"
                        />
                      </div>

                      {(address || miles !== '10') && (
                        <button
                          onClick={() => {
                            setAddress('');
                            setMiles('10');
                            updateCriteria({ landmark_address: '', latitude: null, longitude: null, miles: 10 });
                          }}
                          className="p-2 hover:bg-white/10 rounded-xl text-white/40 hover:text-[#C9A24D] transition-all mr-2 group shrink-0"
                          title="Clear search"
                        >
                          <X size={16} className="group-active:scale-90 transition-transform" />
                        </button>
                      )}
                    </div>

                    {/* Find - same row as the search bar on every breakpoint, including mobile. */}
                    <button
                      onClick={() => addressRef.current?.resolveAddress()}
                      className="flex flex-none items-center justify-center gap-1.5 bg-[#C9A24D] text-white px-4 py-3.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-[#C9A24D]/30 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
                    >
                      <Search size={13} />
                      Find
                    </button>
                  </div>

                  {/* My Requests + (mobile) Filters & Sort trigger - paired on their own row. */}
                  <div className="flex items-center gap-2 w-full lg:w-auto px-2">
                    <button
                      onClick={() => setShowMobileFiltersSheet(true)}
                      className="lg:hidden flex flex-1 items-center justify-center gap-2 px-4 py-3.5 rounded-[1.25rem] border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/10 active:scale-[0.97] text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap"
                    >
                      <Filter size={14} />
                      Filters
                      {totalActiveFilterCount > 0 && (
                        <span className="bg-[#C9A24D] text-white text-[9px] px-1.5 py-0.5 rounded-md leading-none">{totalActiveFilterCount}</span>
                      )}
                    </button>
                    <button
                      onClick={() => setIsMyRequestsOpen(true)}
                      className="relative flex flex-1 items-center justify-center gap-2 bg-white/5 hover:bg-white/10 active:bg-white/10 active:scale-[0.97] border border-white/10 text-white px-4 py-3.5 rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap"
                    >
                      <Inbox size={14} />
                      <span>My Requests</span>
                      {hostCount > 0 && (
                        <span className="absolute -right-2 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-black text-white ring-2 ring-red-300 shadow-lg shadow-red-500/50 dark:ring-red-500/50">
                          {hostCount > 9 ? '9+' : hostCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Filter Row - on mobile/tablet (< lg, matching the search bar's own collapse
                    point) the pills collapse into the "Filters" trigger above (opens a bottom
                    sheet with the same pills, just re-homed) instead of a scrolling row; desktop
                    keeps the normal inline wrapping row. */}
                <div className="p-3 md:p-4">
                  {showMobileFiltersSheet && (
                    <div
                      className="md:hidden fixed inset-0 z-[90] bg-black/60 animate-in fade-in duration-200"
                      onClick={closeMobileFiltersSheet}
                    />
                  )}

                  <div className={`${
                    showMobileFiltersSheet
                      ? 'fixed inset-x-0 bottom-0 z-[95] max-h-[80vh] overflow-y-auto bg-white dark:bg-[#1A1A1C] rounded-t-3xl p-4 pb-6 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom duration-300'
                      : 'hidden'
                  } md:static md:flex md:flex-row md:flex-wrap md:items-center md:justify-center md:max-h-none md:overflow-visible md:rounded-2xl md:border md:border-gray-100 md:dark:border-gray-800 md:bg-white md:dark:bg-[#151517] md:shadow-sm md:p-2 md:z-auto md:gap-1.5`}>
                    {showMobileFiltersSheet && (
                      <div className="md:hidden sticky top-0 -mx-4 -mt-4 px-4 pt-4 pb-3 mb-1 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1A1A1C]">
                        <span className="text-sm font-black uppercase tracking-wide text-[#111827] dark:text-white">Filters &amp; Sort</span>
                        <button
                          onClick={closeMobileFiltersSheet}
                          className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 active:scale-90 text-gray-400 transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    )}

                    <div className="relative shrink-0 w-full md:w-auto" ref={dropdownRef}>
                      <button
                        onClick={() => setShowBrokerageDropdown(!showBrokerageDropdown)}
                        className={`${filterTabBase} ${showBrokerageDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        Brokerages
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.brokerages?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto md:ml-0 transition-transform duration-200 ${showBrokerageDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showBrokerageDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search brokerages..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={brokerageSearch}
                                onChange={(e) => setBrokerageSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2">
                            {isSearchingBrokerages ? (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#C9A24D] mb-2"></div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Searching...</p>
                              </div>
                            ) : (!brokerageSearch && preferences?.brokerages?.length > 0) ? (
                              preferences.brokerages.map((brokerage: string, idx: number) => (
                                <button 
                                  key={idx}
                                  onClick={() => toggleBrokerage(brokerage)}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]"
                                >
                                  <div className="w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all bg-[#C9A24D] border-[#C9A24D]">
                                    <Check size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                  <span className="truncate">{brokerage}</span>
                                </button>
                              ))
                            ) : searchedBrokerages.length > 0 ? (
                              searchedBrokerages.map((brokerage, idx) => {
                                const isSelected = preferences?.brokerages?.includes(brokerage);
                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => toggleBrokerage(brokerage)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${
                                      isSelected 
                                        ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                      isSelected 
                                        ? 'bg-[#C9A24D] border-[#C9A24D]' 
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                    }`}>
                                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="truncate">{brokerage}</span>
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-3 py-6 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {brokerageSearch ? 'No matches found' : 'Start typing to search'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative shrink-0 w-full md:w-auto" ref={agentDropdownRef}>
                      <button
                        onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                        className={`${filterTabBase} ${showAgentDropdown ? agentAccent.pillActive : filterTabInactive}`}
                      >
                        {isAgentIncludeMode ? 'Only Agents' : 'Exclude Agents'}
                        <span className={`${agentAccent.badge} text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none`}>
                          {preferences?.excluded_agents?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto md:ml-0 transition-transform duration-200 ${showAgentDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showAgentDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 dark:bg-[#0B0B0B] p-1">
                              <button
                                onClick={() => setAgentFilterMode('exclude')}
                                className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                                  !isAgentIncludeMode
                                    ? 'bg-white dark:bg-[#1A1A1C] text-rose-600 dark:text-rose-400 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                              >
                                Exclude
                              </button>
                              <button
                                onClick={() => setAgentFilterMode('include')}
                                className={`rounded-lg py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${
                                  isAgentIncludeMode
                                    ? 'bg-white dark:bg-[#1A1A1C] text-emerald-600 dark:text-emerald-400 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                }`}
                              >
                                Only Show
                              </button>
                            </div>
                            <p className="mb-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                              {isAgentIncludeMode ? 'Only show listings from these agents' : 'Hide listings from these agents'}
                            </p>
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Search agents..."
                                className={`w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-gray-400 focus:ring-1 ${agentAccent.ring} transition-all outline-none`}
                                value={agentSearch}
                                onChange={(e) => setAgentSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2">
                            {(!agentSearch && preferences?.excluded_agents?.length > 0) && (
                              <>
                                {preferences.excluded_agents.map((agent: string, idx: number) => (
                                  <button
                                    key={`excluded-${idx}`}
                                    onClick={() => toggleAgent(agent)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${agentAccent.selected}`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${agentAccent.dot}`}>
                                      <Check size={10} className="text-white" strokeWidth={4} />
                                    </div>
                                    <span className="truncate">{agent}</span>
                                  </button>
                                ))}
                                <div className="my-1 border-t border-gray-50 dark:border-gray-800/50" />
                              </>
                            )}
                            {searchedAgents.filter(agent => !preferences?.excluded_agents?.includes(agent)).length > 0 ? (
                              searchedAgents.filter(agent => !preferences?.excluded_agents?.includes(agent)).map((agent, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => toggleAgent(agent)}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                                >
                                  <div className="w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]" />
                                  <span className="truncate">{agent}</span>
                                </button>
                              ))
                            ) : (!preferences?.excluded_agents?.length) && (
                              <div className="px-3 py-6 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {agentSearch ? 'No matches found' : knownAgents.length === 0 ? 'No agents in current results yet' : 'Start typing to search'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative shrink-0 w-full md:w-auto" ref={cityDropdownRef}>
                      <button
                        onClick={() => setShowCityDropdown(!showCityDropdown)}
                        className={`${filterTabBase} ${showCityDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        Cities
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.cities?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto md:ml-0 transition-transform duration-200 ${showCityDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showCityDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search cities..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={citySearch}
                                onChange={(e) => setCitySearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2">
                            {isSearchingCities ? (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#C9A24D] mb-2"></div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Searching...</p>
                              </div>
                            ) : (!citySearch && preferences?.cities?.length > 0) ? (
                              preferences.cities.map((city: string, idx: number) => (
                                <button 
                                  key={idx}
                                  onClick={() => toggleCity(city)}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]"
                                >
                                  <div className="w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all bg-[#C9A24D] border-[#C9A24D]">
                                    <Check size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                  <span className="truncate">{city}</span>
                                </button>
                              ))
                            ) : searchedCities.length > 0 ? (
                              searchedCities.map((city, idx) => {
                                const isSelected = preferences?.cities?.includes(city);
                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => toggleCity(city)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${
                                      isSelected 
                                        ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                      isSelected 
                                        ? 'bg-[#C9A24D] border-[#C9A24D]' 
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                    }`}>
                                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="truncate">{city}</span>
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-3 py-6 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {citySearch ? 'No matches found' : 'Start typing to search'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative shrink-0 w-full md:w-auto" ref={districtDropdownRef}>
                      <button
                        onClick={() => setShowDistrictDropdown(!showDistrictDropdown)}
                        className={`${filterTabBase} ${showDistrictDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        Districts
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.school_districts?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto md:ml-0 transition-transform duration-200 ${showDistrictDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showDistrictDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search districts..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={districtSearch}
                                onChange={(e) => setDistrictSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto p-2">
                            {isSearchingDistricts ? (
                              <div className="flex flex-col items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#C9A24D] mb-2"></div>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Searching...</p>
                              </div>
                            ) : (!districtSearch && preferences?.school_districts?.length > 0) ? (
                              preferences.school_districts.map((district: string, idx: number) => (
                                <button 
                                  key={idx}
                                  onClick={() => toggleDistrict(district)}
                                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]"
                                >
                                  <div className="w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all bg-[#C9A24D] border-[#C9A24D]">
                                    <Check size={10} className="text-white" strokeWidth={4} />
                                  </div>
                                  <span className="truncate">{district}</span>
                                </button>
                              ))
                            ) : searchedDistricts.length > 0 ? (
                              searchedDistricts.map((district, idx) => {
                                const isSelected = preferences?.school_districts?.includes(district);
                                return (
                                  <button 
                                    key={idx}
                                    onClick={() => toggleDistrict(district)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${
                                      isSelected 
                                        ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                      isSelected 
                                        ? 'bg-[#C9A24D] border-[#C9A24D]' 
                                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                    }`}>
                                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="truncate">{district}</span>
                                  </button>
                                )
                              })
                            ) : (
                              <div className="px-3 py-6 text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                  {districtSearch ? 'No matches found' : 'Start typing to search'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative shrink-0 w-full md:w-auto" ref={stateDropdownRef}>
                      <button
                        onClick={() => setShowStateDropdown(!showStateDropdown)}
                        className={`${filterTabBase} ${showStateDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        State: {preferences?.state || 'Any'}
                        <ChevronDown size={12} className={`ml-auto md:ml-0 transition-transform duration-200 ${showStateDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showStateDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-32 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2">
                            {US_STATES.map((state) => (
                              <button
                                key={state}
                                onClick={() => handleStateSelect(state)}
                                className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-between transition-colors ${
                                  preferences?.state === state 
                                    ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                              >
                                {state}
                                {preferences?.state === state && <Check size={10} strokeWidth={4} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Only shown once the agent is actually on at least one team - otherwise
                        there's nothing for it to filter to. */}
                    {myTeams.length > 0 && (
                      <div className="relative shrink-0 w-full md:w-auto" ref={teamDropdownRef}>
                        <button
                          onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                          className={`${filterTabBase} ${showTeamDropdown || selectedTeamOwnerIds.length > 0 ? filterTabActive : filterTabInactive}`}
                        >
                          <UsersRound size={12} />
                          Team
                          {selectedTeamOwnerIds.length > 0 && (
                            <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                              {selectedTeamOwnerIds.length}
                            </span>
                          )}
                          <ChevronDown size={12} className={`ml-auto md:ml-0 transition-transform duration-200 ${showTeamDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showTeamDropdown && (
                          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="max-h-72 overflow-y-auto p-2">
                              <button
                                onClick={() => setSelectedTeamOwnerIds(selectedTeamOwnerIds.length === myTeams.length ? [] : myTeams.map(t => t.owner_id))}
                                className="w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 mb-1 border-b border-gray-50 dark:border-gray-800/50"
                              >
                                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center shrink-0 transition-all ${
                                  selectedTeamOwnerIds.length === myTeams.length ? 'bg-[#C9A24D] border-[#C9A24D]' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                }`}>
                                  {selectedTeamOwnerIds.length === myTeams.length && <Check size={10} className="text-white" strokeWidth={4} />}
                                </div>
                                All Teams
                              </button>
                              {myTeams.map(team => {
                                const isSelected = selectedTeamOwnerIds.includes(team.owner_id);
                                return (
                                  <button
                                    key={team.owner_id}
                                    onClick={() => toggleTeamOwner(team.owner_id)}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-colors ${
                                      isSelected
                                        ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center shrink-0 transition-all ${
                                      isSelected ? 'bg-[#C9A24D] border-[#C9A24D]' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0B0B0B]'
                                    }`}>
                                      {isSelected && <Check size={10} className="text-white" strokeWidth={4} />}
                                    </div>
                                    <span className="truncate">{team.owner_name}{team.owner_brokerage ? ` · ${team.owner_brokerage}` : ''}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-1 hidden sm:block"></div>

                    <div className="relative shrink-0 w-full md:w-auto" ref={filterDropdownRef}>
                      <button
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className={`${filterTabBase} ${showFilterDropdown || activeFilterCount > 0 ? filterTabActive : filterTabInactive}`}
                      >
                        <Filter size={12} />
                        Filter
                        {activeFilterCount > 0 && (
                          <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none ml-1">
                            {activeFilterCount}
                          </span>
                        )}
                      </button>

                      {showFilterDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-4 space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Bedrooms</label>
                                {minBeds && (
                                  <button 
                                    onClick={() => {
                                      setMinBeds('');
                                      updateCriteria({ min_bedrooms: null });
                                    }}
                                    className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map(num => (
                                  <button 
                                    key={num}
                                    onClick={() => {
                                      const newVal = minBeds === num ? '' : num;
                                      setMinBeds(newVal);
                                      updateCriteria({ min_bedrooms: newVal || null });
                                    }}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                      minBeds === num 
                                        ? 'bg-[#C9A24D] border-[#C9A24D] text-white shadow-lg shadow-[#C9A24D]/20' 
                                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:border-[#C9A24D]/30'
                                    }`}
                                  >
                                    {num}+
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Bathrooms</label>
                                {minBaths && (
                                  <button 
                                    onClick={() => {
                                      setMinBaths('');
                                      updateCriteria({ min_bathrooms: null });
                                    }}
                                    className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {[1, 2, 3, 4].map(num => (
                                  <button 
                                    key={num}
                                    onClick={() => {
                                      const newVal = minBaths === num ? '' : num;
                                      setMinBaths(newVal);
                                      updateCriteria({ min_bathrooms: newVal || null });
                                    }}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                      minBaths === num 
                                        ? 'bg-[#C9A24D] border-[#C9A24D] text-white shadow-lg shadow-[#C9A24D]/20' 
                                        : 'border-gray-100 dark:border-gray-800 text-gray-500 hover:border-[#C9A24D]/30'
                                    }`}
                                  >
                                    {num}+
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Sqft</label>
                                  {minSqft && (
                                    <button 
                                      onClick={() => {
                                        setMinSqft('');
                                        updateCriteria({ min_square_feet: null });
                                      }}
                                      className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="2,000"
                                    className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2.5 px-3 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                    value={minSqft ? minSqft.toLocaleString() : ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMinSqft(val ? parseInt(val) : '');
                                    }}
                                    onBlur={() => updateCriteria({ min_square_feet: minSqft || null })}
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Min Price</label>
                                  {minPrice && (
                                    <button 
                                      onClick={() => {
                                        setMinPrice('');
                                        updateCriteria({ min_price: null });
                                      }}
                                      className="text-[9px] font-black text-[#C9A24D] uppercase hover:underline"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="500,000"
                                    className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2.5 px-3 text-xs font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                    value={minPrice ? minPrice.toLocaleString() : ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9]/g, '');
                                      setMinPrice(val ? parseInt(val) : '');
                                    }}
                                    onBlur={() => updateCriteria({ min_price: minPrice || null })}
                                  />
                                </div>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                setMinBeds('');
                                setMinBaths('');
                                setMinSqft('');
                                setMinPrice('');
                                updateCriteria({
                                  min_bedrooms: null,
                                  min_bathrooms: null,
                                  min_square_feet: null,
                                  min_price: null
                                });
                              }}
                              className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-[#C9A24D] hover:border-[#C9A24D]/50 transition-all"
                            >
                              Reset All Filters
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative shrink-0 w-full md:w-auto" ref={sortDropdownRef}>
                      <button
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className={`${filterTabBase} ${showSortDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        <SortDesc size={12} />
                        Sort: {[
                          { label: 'Newest', value: 'dom_asc' },
                          { label: 'Oldest', value: 'dom_desc' },
                          { label: 'Price: Low', value: 'price_asc' },
                          { label: 'Price: High', value: 'price_desc' },
                          { label: 'Closest', value: 'distance_asc' },
                          { label: 'Farthest', value: 'distance_desc' },
                        ].find(opt => opt.value === sortBy)?.label}
                      </button>

                      {showSortDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-[#1A1A1C] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2">
                            {[
                              { label: 'Newest Listed', value: 'dom_asc' },
                              { label: 'Oldest Listed', value: 'dom_desc' },
                              { label: 'Price: Low to High', value: 'price_asc' },
                              { label: 'Price: High to Low', value: 'price_desc' },
                              ...(hasLandmarkSearch ? [
                                { label: 'Closest to Address', value: 'distance_asc' },
                                { label: 'Farthest from Address', value: 'distance_desc' },
                              ] : []),
                            ].map((option) => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  setSortBy(option.value as any);
                                  setShowSortDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-between transition-colors ${
                                  sortBy === option.value 
                                    ? 'bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]' 
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                              >
                                {option.label}
                                {sortBy === option.value && <Check size={10} strokeWidth={4} />}
                              </button>
                            ))}
                            {!hasLandmarkSearch && (
                              <p className="px-3 pt-2 pb-1 text-[9px] font-bold text-gray-400 leading-relaxed">
                                Enter an address above to sort by closest / farthest
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {showMobileFiltersSheet && (
                      <div className="md:hidden sticky bottom-0 -mx-4 -mb-6 px-4 pt-3 pb-4 mt-2 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1A1A1C]">
                        <button
                          onClick={resetAllFiltersMobile}
                          className="flex-1 py-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 active:scale-[0.97] transition-all"
                        >
                          Reset All
                        </button>
                        <button
                          onClick={closeMobileFiltersSheet}
                          className="flex-1 py-3 rounded-xl bg-[#C9A24D] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#C9A24D]/30 active:scale-[0.97] transition-all"
                        >
                          Show Results
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Listings Section */}
                <div id="discovery-results" className="p-4 md:p-8 space-y-4 scroll-mt-4">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="mb-4"><OhpSpinner size={34} /></div>
                      <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Searching for listings...</p>
                    </div>
                  ) : (Array.isArray(filteredListings) && filteredListings.length > 0) ? (
                    <motion.div key={listingsFadeKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                      {paginatedListings.map((property, idx) => (
                        <DiscoveryPropertyRow
                          key={idx}
                          property={property}
                          openHouseSchedule={listingStatuses[property.ListingKey]}
                          // Days you already asked for here read "Requested"; days you're hosting a
                          // different home read "Busy" - so the calendar never invites a second ask.
                          requestedDates={myRequests.filter((r: any) => r.listing_key === property.ListingKey && (r.status === 'pending' || r.status === 'countered')).map((r: any) => String(r.requested_date))}
                          busyDates={myRequests.filter((r: any) => r.listing_key !== property.ListingKey && r.status === 'approved').map((r: any) => String(r.requested_date))}
                          isNewAndUnseen={Boolean(property.New) && !seenNewKeys.has(property.ListingKey)}
                          onViewDetail={(p) => setQuickViewListingKey(p.ListingKey)}
                          onRequestToHost={(p, prefillDate) => {
                            // Skip straight to the email template if we already know this listing
                            // agent has no OpenHousePal account - no point making the agent fill
                            // out a date/time form first just to get bounced to email after submit.
                            if (p.AgentOnPlatform) {
                              setSelectedPropertyForRequest(p)
                              setRequestPrefillDate(prefillDate || null)
                            } else {
                              setEmailFallbackProperty(p)
                            }
                          }}
                        />
                      ))}

                      {/* Pagination */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Show</span>
                          {[12, 24, 48].map(size => (
                            <button
                              key={size}
                              onClick={() => changeResultsPerPage(size)}
                              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black transition-all active:scale-95 ${
                                resultsPerPage === size
                                  ? 'border-[#C9A24D] bg-[#FCF9F1] dark:bg-[#C9A24D]/10 text-[#C9A24D]'
                                  : 'border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-[#C9A24D]/50'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Results</span>
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => goToPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className="p-2 rounded-lg border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#C9A24D]/50 active:scale-95 transition-all"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                              <button
                                key={pageNum}
                                onClick={() => goToPage(pageNum)}
                                className={`w-8 h-8 rounded-lg text-xs font-black transition-all active:scale-95 ${
                                  currentPage === pageNum
                                    ? 'bg-[#C9A24D] text-white shadow-md shadow-[#C9A24D]/30'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                                }`}
                              >
                                {pageNum}
                              </button>
                            ))}
                            <button
                              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className="p-2 rounded-lg border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#C9A24D]/50 active:scale-95 transition-all"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="text-center py-20">
                      <Home size={40} className="mx-auto text-gray-300 mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No listings found</h3>
                      <p className="text-gray-500 max-w-xs mx-auto">Try adjusting your search criteria or broadening your location.</p>
                    </div>
                  )}
                </div>
              </div>
            </main>
            
            <Footer />
          </div>

          {selectedPropertyForRequest && (
            <RequestToHostModal
              property={selectedPropertyForRequest}
              initialDate={requestPrefillDate || undefined}
              scheduledOpens={listingStatuses[selectedPropertyForRequest.ListingKey]?.scheduled_opens || []}
              teamBroadcasts={incomingBroadcasts.filter(b => b.listing_key === selectedPropertyForRequest.ListingKey)}
              onBroadcastHandled={refreshIncomingBroadcasts}
              onClose={() => { setSelectedPropertyForRequest(null); setRequestPrefillDate(null) }}
              onSent={() => {
                setSelectedPropertyForRequest(null)
                setRequestPrefillDate(null)
                refreshMyRequests()
              }}
              onFallbackToEmail={() => {
                setEmailFallbackProperty(selectedPropertyForRequest)
                setSelectedPropertyForRequest(null)
              }}
            />
          )}

          {emailFallbackProperty && (
            <EmailModal
              property={emailFallbackProperty}
              user={user}
              onClose={() => setEmailFallbackProperty(null)}
              showToast={showToast}
            />
          )}

          <PropertyQuickViewModal
            listingKey={quickViewListingKey}
            agentId={user?.id || ''}
            onClose={() => setQuickViewListingKey(null)}
          />

          <MyRequestsPanel isOpen={isMyRequestsOpen} onClose={() => setIsMyRequestsOpen(false)} onActionComplete={refreshMyRequests} focusRequestId={searchParams.get('request')} />
        </BrokerAuthorizationGuard>
      </SubscriptionGuard>
    </AuthGuard>
  )
}
