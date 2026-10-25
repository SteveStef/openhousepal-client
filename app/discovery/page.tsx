'use client'

import { OhpSpinner } from '@/components/brand/OhpLoader'
import React, { useState, memo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import OhSheet from '@/components/open-house-manager/OhSheet'
import PageReveal from '@/components/ui/PageReveal'
import ExpandOnFocus from '@/components/ui/ExpandOnFocus'
import { useImagesReady } from '@/hooks/useImagesReady'
import { clockRange, dayShort } from '@/components/open-house-manager/HostFlowParts'
import EmailHostFlow from '@/components/open-house-manager/EmailHostFlow'
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

// Below lg (phones, phone landscape, small tablets) the filters live in one pull-up sheet that
// drags down to close (user, 10/24) - the inline pill row needs a wide screen.
function useBelowLg(): boolean {
  const [below, setBelow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const on = () => setBelow(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return below
}

function SheetOr({ sheet, open, onClose, footer, children }: { sheet: boolean; open: boolean; onClose: () => void; footer: React.ReactNode; children: React.ReactNode }) {
  if (!sheet) return <>{children}</>
  return (
    <OhSheet open={open} onClose={onClose} title="Filters & Sort" subtitle="Narrow the homes you can host" icon={<Filter className="h-5 w-5" />} footer={footer}>
      {children}
    </OhSheet>
  )
}

// One filter's options: on a computer a menu that springs open under its pill (and drops away on
// close); inside the phone sheet it unfolds in place with a smooth height animation.
function DropPanel({ open, sheet, className = 'w-64', children }: { open: boolean; sheet: boolean; className?: string; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (sheet ? (
        <motion.div key="sheet-panel" className="overflow-hidden"
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ height: { type: 'spring', stiffness: 320, damping: 34 }, opacity: { duration: 0.18 } }}>
          <div className="mt-1.5 overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-[#1A1A1C]">{children}</div>
        </motion.div>
      ) : (
        <motion.div key="menu-panel" style={{ transformOrigin: 'top left' }}
          initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className={`absolute left-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl dark:border-gray-800 dark:bg-[#1A1A1C] ${className}`}>
          {children}
        </motion.div>
      ))}
    </AnimatePresence>
  )
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
const DiscoveryPropertyRow = memo(function DiscoveryPropertyRow({ property, openHouseSchedule, isNewAndUnseen, onRequestToHost, onViewDetail, requestedDates, busyDates, eager = false }: { eager?: boolean, requestedDates?: string[], busyDates?: string[], property: any, openHouseSchedule?: { status: string, scheduled_date?: string | null, scheduled_start_time?: string | null, scheduled_end_time?: string | null, scheduled_opens?: { scheduled_date: string | null, scheduled_start_time: string | null, scheduled_end_time: string | null, hosting_agent_id?: string | null }[] }, isNewAndUnseen: boolean, onRequestToHost: (p: any, prefillDate?: string) => void, onViewDetail: (p: any) => void }) {
  const { user } = useAuth()
  const isOpenHouseScheduled = openHouseSchedule?.status === 'scheduled'
  const upcomingOpens = openHouseSchedule?.scheduled_opens || []
  // The next open on the calendar, for the "Open house Sat, Oct 25 · 1 - 3 PM" line.
  const todayIso = new Date().toLocaleDateString('en-CA')
  const datedUpcoming = upcomingOpens.filter(o => o.scheduled_date && String(o.scheduled_date) >= todayIso)
    .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)))
  const nextOpen = datedUpcoming[0]
  const laterOpens = Math.max(0, datedUpcoming.length - 1)
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
      <div className="relative w-full md:w-[188px] aspect-[4/3] md:self-start xl:self-stretch xl:aspect-auto xl:h-auto shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-[#0B0B0B]">
        <Image
          // No photo yet: the site's own placeholder. Prefixing it with the API address pointed it at
          // a host next/image doesn't allow, which crashed the whole page on a photo-less listing.
          src={property.Image ? normalizeImageUrl(property.Image) : '/placeholder.jpg'}
          alt={property.Street}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 188px"
          priority={eager}
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
          // Always top-middle of the photo, between "New" (left) and the days-on-market tag
          // (right) - user, 10/24. On the narrow computer thumbnail next to "New" it folds onto
          // two short lines so the three never touch.
          <div className="pointer-events-none absolute inset-x-0 top-2.5 flex justify-center">
            <div className={`flex items-center gap-1 rounded-lg border border-white/10 bg-emerald-500 px-2 py-1 text-white shadow-lg ${isNewAndUnseen ? 'md:ml-11 md:gap-0 md:px-1.5 md:py-[3px]' : ''}`}>
              <Check size={10} strokeWidth={3.5} className={isNewAndUnseen ? 'md:hidden' : ''} />
              <span className={`whitespace-nowrap text-[9px] font-black uppercase leading-none tracking-widest ${isNewAndUnseen ? 'md:flex md:flex-col md:items-center md:gap-[2px] md:text-[7.5px] md:tracking-[0.12em]' : ''}`}>
                <span>Open</span>{isNewAndUnseen ? <span className="md:hidden">&nbsp;</span> : ' '}<span>Scheduled</span>
              </span>
            </div>
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

        {/* Phones / smaller screens (user, 10/24): when it has an open house, say when, plus the
            same small day cards the wide screen shows - open days to ask for vs taken ones. Tap
            an open day to ask to host it. (Wide screens keep the big cards in their own column.) */}
        {(isOpenHouseScheduled || upcomingOpens.length > 0) && nextOpen && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-black text-emerald-700 dark:text-emerald-400 xl:hidden">
            <Calendar size={12} className="shrink-0" />
            <span className="truncate">Open house {dayShort(String(nextOpen.scheduled_date))}{nextOpen.scheduled_start_time && nextOpen.scheduled_end_time ? ` · ${clockRange(String(nextOpen.scheduled_start_time).slice(0, 5), String(nextOpen.scheduled_end_time).slice(0, 5))}` : ''}</span>
            {laterOpens > 0 && <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">+{laterOpens} more</span>}
          </p>
        )}
        <div className={`${isOpenHouseScheduled ? 'block' : 'hidden md:block'} mt-1 xl:hidden`}>
          <WeekendCalendarCards
            opens={upcomingOpens}
            size="md"
            filledClickable={false}
            emptyCellTitle="Tap to ask to host this day"
            filledCellTitle="Already scheduled"
            emptyCellLabel="Open"
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

      {/* Weekend mini calendar - same "which of the next 2 weekends still needs a host" glance as
          the listing agent's own property cards on Manager, but clicking an empty cell here jumps
          straight into Request to Host with that date already filled in instead of prefilling a
          direct request. An already-booked cell isn't actionable for a viewer here (they can't
          request an already-taken slot), so it renders read-only. Sized up ("lg") from Manager's
          own cards since this is the row's only path into Request to Host now - no separate button
          underneath - so the time needs to read clearly at a glance. Desktop only - mobile keeps
          the "Open Scheduled" checkmark on the photo instead, there's no room for a 4-cell grid there. */}
      <div className="hidden xl:flex w-[430px] shrink-0 flex-col">
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
  const sheetMode = useBelowLg()
  const pageRef = useRef<HTMLElement>(null)
  const pageReady = useImagesReady(pageRef, !isLoading, { count: 4 })

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
  const filterTabBase = 'flex items-center justify-start lg:justify-center gap-2 px-4 py-3.5 lg:py-2.5 rounded-xl text-[11px] lg:text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.96] w-full lg:w-auto max-lg:border max-lg:border-gray-100 max-lg:dark:border-gray-800 max-lg:bg-white max-lg:dark:bg-[#151517]'
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
            {/* Opening (user, 10/24): the house loader until the listings AND the first photos
                are in, then the page rises into place - never half-drawn. */}
            <PageReveal ready={pageReady} label="Finding homes to host" className="flex flex-grow flex-col">
            <main ref={pageRef} className="flex-grow container mx-auto px-4 py-4 sm:py-6 max-w-7xl text-[#111827] dark:text-[#F3F4F6]">
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

                    {/* Address Search - on a phone, tapping it lifts it to the top, full width and
                        bigger, so a long address reads in full while typing (user, 10/24). */}
                    <ExpandOnFocus className="flex-1 min-w-0 md:ml-2" openClassName="bg-[#172536]" label="Search from an address or landmark">
                    <div className="relative flex items-center min-w-0 bg-white/5 border border-white/10 rounded-2xl">
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
                    </ExpandOnFocus>

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
                <div className={sheetMode ? 'contents' : 'p-4'}>
                  {/* Below lg: the same pills in a pull-up sheet that drags down to close; each
                      pill unfolds its options in place. Wide screens: the inline row. */}
                  <SheetOr sheet={sheetMode} open={showMobileFiltersSheet} onClose={closeMobileFiltersSheet}
                    footer={
                      <div className="flex items-center gap-2">
                        <button onClick={resetAllFiltersMobile}
                          className="flex-1 py-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 active:scale-[0.97] transition-all">
                          Reset All
                        </button>
                        <button onClick={closeMobileFiltersSheet}
                          className="flex-1 py-3 rounded-xl bg-[#C9A24D] text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#C9A24D]/30 active:scale-[0.97] transition-all">
                          Show {filteredListings.length} {filteredListings.length === 1 ? 'Result' : 'Results'}
                        </button>
                      </div>
                    }>
                  <div className={sheetMode
                    ? 'flex flex-col gap-1.5'
                    : 'flex flex-row flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-[#151517]'}>

                    <div className="relative shrink-0 w-full lg:w-auto" ref={dropdownRef}>
                      <button
                        onClick={() => setShowBrokerageDropdown(!showBrokerageDropdown)}
                        className={`${filterTabBase} ${showBrokerageDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        Brokerages
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.brokerages?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto lg:ml-0 transition-transform duration-200 ${showBrokerageDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      <DropPanel open={showBrokerageDropdown} sheet={sheetMode}>
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search brokerages..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs max-lg:py-3 max-lg:text-[15px] font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={brokerageSearch}
                                onChange={(e) => setBrokerageSearch(e.target.value)}
                                autoFocus={!sheetMode}
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
                        </DropPanel>
                    </div>

                    <div className="relative shrink-0 w-full lg:w-auto" ref={agentDropdownRef}>
                      <button
                        onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                        className={`${filterTabBase} ${showAgentDropdown ? agentAccent.pillActive : filterTabInactive}`}
                      >
                        {isAgentIncludeMode ? 'Only Agents' : 'Exclude Agents'}
                        <span className={`${agentAccent.badge} text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none`}>
                          {preferences?.excluded_agents?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto lg:ml-0 transition-transform duration-200 ${showAgentDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      <DropPanel open={showAgentDropdown} sheet={sheetMode}>
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
                                className={`w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs max-lg:py-3 max-lg:text-[15px] font-bold placeholder:text-gray-400 focus:ring-1 ${agentAccent.ring} transition-all outline-none`}
                                value={agentSearch}
                                onChange={(e) => setAgentSearch(e.target.value)}
                                autoFocus={!sheetMode}
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
                        </DropPanel>
                    </div>

                    <div className="relative shrink-0 w-full lg:w-auto" ref={cityDropdownRef}>
                      <button
                        onClick={() => setShowCityDropdown(!showCityDropdown)}
                        className={`${filterTabBase} ${showCityDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        Cities
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.cities?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto lg:ml-0 transition-transform duration-200 ${showCityDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      <DropPanel open={showCityDropdown} sheet={sheetMode}>
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search cities..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs max-lg:py-3 max-lg:text-[15px] font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={citySearch}
                                onChange={(e) => setCitySearch(e.target.value)}
                                autoFocus={!sheetMode}
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
                        </DropPanel>
                    </div>

                    <div className="relative shrink-0 w-full lg:w-auto" ref={districtDropdownRef}>
                      <button
                        onClick={() => setShowDistrictDropdown(!showDistrictDropdown)}
                        className={`${filterTabBase} ${showDistrictDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        Districts
                        <span className="bg-[#C9A24D] text-white text-[8px] px-1.5 py-0.5 rounded-md leading-none">
                          {preferences?.school_districts?.length || 0}
                        </span>
                        <ChevronDown size={12} className={`ml-auto lg:ml-0 transition-transform duration-200 ${showDistrictDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      <DropPanel open={showDistrictDropdown} sheet={sheetMode}>
                          <div className="p-3 border-b border-gray-50 dark:border-gray-800/50">
                            <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input 
                                type="text"
                                placeholder="Search districts..."
                                className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2 pl-9 pr-4 text-xs max-lg:py-3 max-lg:text-[15px] font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
                                value={districtSearch}
                                onChange={(e) => setDistrictSearch(e.target.value)}
                                autoFocus={!sheetMode}
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
                        </DropPanel>
                    </div>
                    <div className="relative shrink-0 w-full lg:w-auto" ref={stateDropdownRef}>
                      <button
                        onClick={() => setShowStateDropdown(!showStateDropdown)}
                        className={`${filterTabBase} ${showStateDropdown ? filterTabActive : filterTabInactive}`}
                      >
                        State: {preferences?.state || 'Any'}
                        <ChevronDown size={12} className={`ml-auto lg:ml-0 transition-transform duration-200 ${showStateDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      <DropPanel open={showStateDropdown} sheet={sheetMode} className="w-32">
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
                        </DropPanel>
                    </div>

                    {/* Only shown once the agent is actually on at least one team - otherwise
                        there's nothing for it to filter to. */}
                    {myTeams.length > 0 && (
                      <div className="relative shrink-0 w-full lg:w-auto" ref={teamDropdownRef}>
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
                          <ChevronDown size={12} className={`ml-auto lg:ml-0 transition-transform duration-200 ${showTeamDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        <DropPanel open={showTeamDropdown} sheet={sheetMode}>
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
                          </DropPanel>
                      </div>
                    )}

                    <div className="w-px h-6 bg-gray-100 dark:bg-gray-800 mx-1 hidden lg:block"></div>

                    <div className="relative shrink-0 w-full lg:w-auto" ref={filterDropdownRef}>
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

                      <DropPanel open={showFilterDropdown} sheet={sheetMode} className="w-72">
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
                                    className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2.5 px-3 text-xs max-lg:py-3 max-lg:text-[15px] font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
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
                                    className="w-full bg-gray-50 dark:bg-[#0B0B0B] border-none rounded-xl py-2.5 px-3 text-xs max-lg:py-3 max-lg:text-[15px] font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-[#C9A24D]/30 transition-all outline-none"
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
                        </DropPanel>
                    </div>
                    <div className="relative shrink-0 w-full lg:w-auto" ref={sortDropdownRef}>
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

                      <DropPanel open={showSortDropdown} sheet={sheetMode} className="w-52">
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
                        </DropPanel>
                    </div>

                  </div>
                  </SheetOr>
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
                          eager={currentPage === 1 && idx < 4}
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
                    // Empty: one calm card that says what to do next (user, 10/22 - the old two
                    // grey lines looked broken), not just "no results".
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 26 }}
                      className="relative mx-auto flex max-w-lg flex-col items-center overflow-hidden rounded-[2rem] border border-[#C9A24D]/25 bg-white px-6 py-12 text-center shadow-[0_30px_70px_-50px_rgba(17,24,39,.6)] dark:bg-[#111113] sm:py-14">
                      <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(201,162,77,.22),transparent)]" />
                      <div className="relative grid h-20 w-20 place-items-center">
                        {[0, 1].map(i => (
                          <motion.span key={i} aria-hidden className="absolute inset-0 rounded-full border border-[#C9A24D]/40"
                            animate={{ scale: [1, 1.6], opacity: [0.7, 0] }} transition={{ duration: 2.6, repeat: Infinity, delay: i * 1.3, ease: 'easeOut' }} />
                        ))}
                        <span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#111827] to-[#2a2218] text-[#e8c97a] shadow-lg">
                          <Home size={26} />
                        </span>
                      </div>
                      <h3 className="relative mt-6 font-serif text-2xl font-black text-[#111827] dark:text-white">No homes to show yet</h3>
                      <p className="relative mt-2 max-w-sm text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400">
                        Nothing matches your area and filters right now. Try a bigger distance, type a town or address above, or clear your filters.
                      </p>
                      <div className="relative mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <button type="button" onClick={resetAllFiltersMobile}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#111827] px-6 text-[11px] font-black uppercase tracking-widest text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
                          <Filter size={14} /> Clear my filters
                        </button>
                        <button type="button" onClick={() => setIsMyRequestsOpen(true)}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-gray-200 px-6 text-[11px] font-black uppercase tracking-widest text-gray-600 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:text-gray-300">
                          <Inbox size={14} /> My requests
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </main>
            </PageReveal>

            <Footer />
          </div>

          {selectedPropertyForRequest && (
            <RequestToHostModal
              property={selectedPropertyForRequest}
              initialDate={requestPrefillDate || undefined}
              scheduledOpens={listingStatuses[selectedPropertyForRequest.ListingKey]?.scheduled_opens || []}
              requestedDates={myRequests.filter((r: any) => r.listing_key === selectedPropertyForRequest.ListingKey && (r.status === 'pending' || r.status === 'countered')).map((r: any) => String(r.requested_date))}
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
            // The listing agent isn't on OpenHousePal: the same slide-up step window, by email.
            <EmailHostFlow
              key={emailFallbackProperty.ListingKey}
              property={emailFallbackProperty}
              user={user}
              onClose={() => setEmailFallbackProperty(null)}
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
