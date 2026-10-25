'use client'

import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ChevronDown, MapPin, MonitorPlay, Plus, Sparkles, Tablet, Ticket, Trash2 } from 'lucide-react'
import { AfterSignin, GuestSettingsPatch, OpenHouse } from '@/types'

interface OpenHouseCardProps {
  // React 19: a plain prop - AnimatePresence (popLayout) measures the card through it.
  ref?: React.Ref<HTMLDivElement>;
  openHouse: OpenHouse;
  index: number;
  onViewVisitors: (openHouse: OpenHouse) => void;
  onViewPDF: (openHouse: OpenHouse) => void;
  onDelete: (openHouse: OpenHouse) => void;
  onAddNote: (openHouse: OpenHouse) => void;
  onOpenKiosk: (openHouse: OpenHouse) => void;
  onGuestSettings: (openHouse: OpenHouse, patch: GuestSettingsPatch) => void;
  formatAddress: (address: string) => string;
}

export const OpenHouseCard = memo(function OpenHouseCard({
  ref,
  openHouse,
  index,
  onViewVisitors,
  onViewPDF,
  onDelete,
  onAddNote,
  onOpenKiosk,
  onGuestSettings,
  formatAddress
}: OpenHouseCardProps) {
  const showcasesOn = openHouse.autoShowcase !== false
  // After signing in: Bright MLS plans -> the Guest Pass (on/off). No-MLS Pro (no Guest Pass - no
  // Similar Homes / Cheat Sheet / Showcases there) -> their Agent Hub or nothing. A choice that's
  // no longer possible shows as "Nothing", which is also what the sign-in page does with it.
  const passAvailable = !!openHouse.guestPassAvailable
  const passOn = openHouse.guestPass !== false
  // Similar Homes (the kit's sheet + the Guest Pass's similar homes): MLS-linked homes on Bright plans.
  const similarAvailable = passAvailable && !!openHouse.listingKey
  const similarOn = openHouse.similarHomes !== false
  const hubOk = !!(openHouse.hubAvailable && openHouse.hubReady)
  const opens: AfterSignin = openHouse.afterSignin === 'hub' && hubOk ? 'hub' : 'none'
  const showOpens = !passAvailable && !!openHouse.hubAvailable
  const makeSpotlightHref = openHouse.spotlightDraftId
    ? `/studio/property-sites/${openHouse.spotlightDraftId}`
    : `/studio/property-sites?${new URLSearchParams(Object.entries({
        new: '1', listing: openHouse.listingKey || '',
        address: openHouse.address || '', city: openHouse.city || '', state: openHouse.state || '', zipcode: openHouse.zipcode || '',
        price: String(openHouse.price ?? ''), beds: String(openHouse.bedrooms ?? ''), baths: String(openHouse.bathrooms ?? ''),
        sqft: String(openHouse.livingArea ?? ''), image: openHouse.coverImageUrl || '',
      }).filter(([, v]) => v)).toString()}`
  const cityLabel = openHouse.city || (openHouse as any).city
  const street = formatAddress(openHouse.address).split(',')[0]
  const visitorCount = openHouse.visitorCount ?? (openHouse as any).visitor_count ?? (openHouse as any).visitors?.length ?? 0
  // The API only sends this while a guest-hosted open is still upcoming - its presence is what
  // flips "Notes" to "Notes & Info" (the listing agent's access info for this open).
  const hasHostInfo = !!(openHouse.listingHostNotes || (openHouse as any).listing_host_notes)

  // The guest switches share one row inside a fixed card. When they don't fit (two cards per row on
  // a laptop, phones) they step down instead of the last one getting cut off: 0 = icon + label,
  // 1 = label only with a smaller switch, 2 = icon + switch (name and what it does on hover).
  // They step back up as soon as there's room again.
  const switchRow = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<0 | 1 | 2>(0)
  const needAt = useRef<number[]>([])
  useLayoutEffect(() => {
    const row = switchRow.current
    if (!row) return
    const check = () => {
      if (row.scrollWidth > row.clientWidth + 1 && fit < 2) {
        needAt.current[fit] = row.scrollWidth
        setFit((fit + 1) as 1 | 2)
      } else if (fit > 0 && needAt.current[fit - 1] && row.clientWidth >= needAt.current[fit - 1]) {
        setFit((fit - 1) as 0 | 1)
      }
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(row)
    return () => ro.disconnect()
  }, [fit])
  const compact = fit === 2

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      // Removed: fades, then folds its height (and its spacing) away IN PLACE, so the cards and the
      // sections under it glide up with it - nothing below jumps (user, 10/24).
      exit={{ opacity: 0, scale: 0.96, height: 0, marginBottom: 0, transition: { opacity: { duration: 0.18 }, scale: { duration: 0.22 }, height: { duration: 0.34, delay: 0.1, ease: [0.4, 0, 0.2, 1] }, marginBottom: { duration: 0.34, delay: 0.1, ease: [0.4, 0, 0.2, 1] } } }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3), ease: [0.22, 1, 0.36, 1], layout: { type: 'spring', stiffness: 340, damping: 34 } }}
      onClick={() => onViewVisitors(openHouse)}
      className="group relative mb-4 sm:mb-6 flex flex-col sm:flex-row bg-white dark:bg-[#151517] rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-[#C9A24D]/60 hover:shadow-[0_26px_48px_-28px_rgba(139,115,85,.75)] dark:hover:border-[#C9A24D]/40 overflow-hidden cursor-pointer h-auto isolate transform-gpu"
    >
      {/* gold edge that lights up on hover */}
      <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {/* Photo with the address + town on it (user, 10/24 - no separate title line, no beds/baths/
          sqft row, so the card is much shorter). On sm+ it stretches to the content column's height. */}
      <div className="relative h-36 sm:h-auto sm:min-h-[132px] w-full sm:w-56 flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-[#202022]">
        <Image
          src={openHouse.coverImageUrl || (openHouse as any).cover_image_url || "/placeholder.svg"}
          alt={`Property at ${openHouse.address}`}
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          priority={index < 2}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3 pt-8">
          <h3
            className="truncate font-serif text-[17px] font-black leading-tight text-white drop-shadow-[0_1px_6px_rgba(0,0,0,.45)] sm:text-base"
            title={openHouse.address}
          >
            {street}
          </h3>
          {cityLabel && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/80">
              <MapPin className="h-3 w-3 shrink-0 text-[#e8c97a]" />
              <span className="truncate">{cityLabel}</span>
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(openHouse)
          }}
          className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white/85 ring-1 ring-white/20 transition-colors hover:bg-red-600 hover:text-white active:scale-95"
          title="Delete"
          aria-label="Delete this open house"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Right Side: Content */}
      <div className="flex-1 flex flex-col p-3 sm:p-3.5 min-w-0">

        {/* What happens when a guest signs in - per open house, one row. Each piece only shows when
            the plan includes it (the API decides): Showcases (Premium / IDX), the Guest Pass (Basic /
            Premium / IDX), "Opens Hub / Nothing" (No-MLS Pro), and "+ Spotlight" when it's their own
            listing on IDX with no Spotlight yet (once published it's featured on the Guest Pass). */}
        {(openHouse.showcasesAvailable || passAvailable || showOpens || openHouse.canMakeSpotlight) && (
        <div ref={switchRow} className={`flex flex-nowrap overflow-hidden ${fit === 0 ? 'gap-1' : 'gap-[3px]'}`}>
          {openHouse.showcasesAvailable && (
          <GuestSwitch
            on={showcasesOn}
            icon={<Sparkles className="h-3 w-3" />}
            label="Guest Showcases"
            shortLabel="Showcases"
            fit={fit}
            hint={showcasesOn
              ? 'ON - everyone who signs in without an agent gets their own Showcase of similar homes (and a Showcase button on their Guest Pass). Starts OFF when it\'s your own listing, so guests aren\'t sent shopping other homes.'
              : 'OFF - guests who sign in here don\'t get a Showcase, and their Guest Pass doesn\'t offer one. (Someone who scans "See more homes like these" on a printed Similar Homes sheet asked for one, so they still get it.)'}
            onToggle={() => onGuestSettings(openHouse, { autoShowcase: !showcasesOn })}
          />
          )}
          {/* Similar Homes on/off lives in the kit flow and on the Documents screen (next to Refresh),
              not on this card (user, 10/16) - leaves room for every switch's full name. */}
          {passAvailable && (
            <GuestSwitch
              on={passOn}
              icon={<Ticket className="h-3 w-3" />}
              label="Guest Pass"
              shortLabel="Guest Pass"
              fit={fit}
              hint={passOn
                ? 'ON - right after signing in, each guest\'s phone opens their Guest Pass: this home, ' + (similarAvailable && similarOn ? 'your Similar Homes + ' : 'your ') + 'Cheat Sheet as web pages, one-tap seller disclosure / second tour requests' + (openHouse.showcasesAvailable && showcasesOn ? ', their Showcase' : '') + (openHouse.ownSpotlightUrl ? ', and your Spotlight up top' : '') + '. (Not on a Kiosk tablet - it stays ready for the next guest.)'
                : 'OFF - guests just see the thank-you screen after signing in.'}
              onToggle={() => onGuestSettings(openHouse, { guestPass: !passOn })}
            />
          )}
          {/* The Signature Footer switch is gone from the card (user, 10/24) - the Guest Pass keeps
              using the saved per-open-house setting (on by default). */}
          {showOpens && (
            <label
              onClick={(e) => e.stopPropagation()}
              title={`After a guest signs in, their phone opens: ${opens === 'hub' ? 'your Agent Hub' : 'nothing - just the thank-you screen'}. (Never on a Kiosk tablet - it stays ready for the next guest.)`}
              className={`relative flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border py-1 pl-2 pr-1.5 text-[10px] font-black uppercase tracking-normal sm:tracking-wide transition-colors ${
                opens !== 'none'
                  ? 'border-[#C9A24D]/40 bg-[#C9A24D]/10 text-[#8b7355] dark:border-[#C9A24D]/35 dark:bg-[#C9A24D]/10 dark:text-[#C9A24D]'
                  : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-500'
              }`}
            >
              <MonitorPlay className={compact ? 'h-3 w-3' : 'hidden h-3 w-3 sm:block'} />
              {compact ? (opens === 'hub' ? 'Hub' : 'Off') : `Opens ${opens === 'hub' ? 'Hub' : 'Nothing'}`}
              <ChevronDown className="h-3 w-3" />
              <select
                aria-label="After sign-in, open"
                value={opens}
                onChange={(e) => onGuestSettings(openHouse, { afterSignin: e.target.value as AfterSignin })}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                {openHouse.hubAvailable && (
                  <option value="hub" disabled={!hubOk}>{hubOk ? 'After sign-in: open my Agent Hub' : 'Agent Hub (finish setting it up first)'}</option>
                )}
                <option value="none">After sign-in: nothing (thank-you screen)</option>
              </select>
            </label>
          )}
          {openHouse.canMakeSpotlight && (
            <Link
              href={makeSpotlightHref}
              onClick={(e) => e.stopPropagation()}
              title={openHouse.spotlightDraftId
                ? 'You started a Spotlight for this home - finish and publish it, and it\'s featured at the top of every guest\'s Guest Pass.'
                : 'Make a Spotlight for your listing (it\'s already picked) - once it\'s published it\'s featured at the top of every guest\'s Guest Pass.'}
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-[#C9A24D]/60 py-1 ${fit >= 1 ? 'px-1.5' : 'pl-1.5 pr-2'} text-[10px] font-black uppercase tracking-normal sm:tracking-wide text-[#8b7355] transition-colors hover:bg-[#C9A24D]/10 dark:text-[#C9A24D]`}
            >
              <Plus className="h-3 w-3" />
              {fit >= 1 ? <Sparkles className="h-3 w-3" aria-label={openHouse.spotlightDraftId ? 'Finish Spotlight' : 'Make a Spotlight'} /> : (openHouse.spotlightDraftId ? 'Finish Spotlight' : 'Spotlight')}
            </Link>
          )}
        </div>
        )}

        {/* Action Row - a 2x2 mini grid (Visitors, Kit / Kiosk, Note) instead of 3-across-plus-
            one-full-width, so all four actions read as one consistent set of equal-weight buttons
            in a clear left-to-right, top-to-bottom order. */}
        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewVisitors(openHouse)
            }}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-2 py-2.5 text-[10px] font-black uppercase tracking-wide text-white shadow-md shadow-[#111827]/20 transition-all active:scale-95 hover:-translate-y-0.5 hover:shadow-lg dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827] sm:min-h-9 sm:py-2"
          >
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-md bg-[#C9A24D] px-1.5 text-[#111827] dark:bg-[#111827] dark:text-[#e8c97a]">{visitorCount}</span>
            {visitorCount === 1 ? 'Visitor' : 'Visitors'}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onViewPDF(openHouse) }}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-[10px] font-black uppercase tracking-wide text-[#111827] shadow-sm transition-all active:scale-95 hover:-translate-y-0.5 hover:border-[#C9A24D] hover:bg-[#C9A24D]/5 dark:border-white/10 dark:bg-[#1A1A1C] dark:text-white dark:hover:bg-[#C9A24D]/10 sm:min-h-9 sm:py-2"
            title="Open Kit"
          >
            <svg className="h-4 w-4 shrink-0 text-[#C9A24D] sm:h-3 sm:w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Kit
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenKiosk(openHouse) }}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-[10px] font-black uppercase tracking-wide text-[#111827] shadow-sm transition-all active:scale-95 hover:-translate-y-0.5 hover:border-[#C9A24D] hover:bg-[#C9A24D]/5 dark:border-white/10 dark:bg-[#1A1A1C] dark:text-white dark:hover:bg-[#C9A24D]/10 sm:min-h-9 sm:py-2"
            title="Open Kiosk sign-in - leave this running on a tablet: sign-in kiosk or a no-printer-needed sign-in sheet"
          >
            <Tablet className="h-4 w-4 shrink-0 text-[#C9A24D] sm:h-3 sm:w-3" />
            Kiosk
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onAddNote(openHouse) }}
            className={`relative flex min-h-11 items-center justify-center gap-1.5 rounded-xl border bg-white px-2 py-2.5 text-[10px] font-black uppercase tracking-wide leading-tight shadow-sm transition-all active:scale-95 hover:-translate-y-0.5 dark:bg-[#1A1A1C] dark:text-white sm:min-h-9 sm:py-2 ${
              hasHostInfo
                ? 'border-amber-400/60 text-amber-800 hover:border-amber-500 hover:bg-amber-50 dark:border-amber-400/40 dark:text-amber-300 dark:hover:bg-amber-500/10'
                : 'border-gray-200 text-[#111827] hover:border-[#C9A24D] hover:bg-[#C9A24D]/5 dark:border-white/10 dark:hover:bg-[#C9A24D]/10'
            }`}
            title={hasHostInfo ? 'Notes & Info from the listing agent (this open only)' : 'Add Note'}
          >
            {hasHostInfo && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />}
            <svg className={`h-4 w-4 shrink-0 sm:h-3 sm:w-3 ${hasHostInfo ? 'text-amber-500' : 'text-[#C9A24D]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            {hasHostInfo ? 'Notes & Info' : 'Notes'}
          </button>
        </div>
      </div>
    </motion.div>
  )
})

function GuestSwitch({ on, icon, label, shortLabel, short, fit = 0, hint, onToggle }: {
  on: boolean; icon: ReactNode; label: string; shortLabel: string; short?: boolean; fit?: 0 | 1 | 2; hint: string; onToggle: () => void
}) {
  const compact = fit === 2
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={`${label}: ${hint}`}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-label={label}
      className={`flex shrink-0 items-center whitespace-nowrap rounded-full border py-1 pr-1 text-[10px] font-black uppercase transition-colors ${fit === 0 ? 'gap-1.5 pl-2 tracking-normal sm:tracking-wide' : fit === 1 ? 'gap-1 pl-1.5 tracking-normal' : 'gap-1 pl-1.5'} ${
        on
          ? 'border-[#C9A24D]/40 bg-[#C9A24D]/10 text-[#8b7355] dark:border-[#C9A24D]/35 dark:bg-[#C9A24D]/10 dark:text-[#C9A24D]'
          : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-500'
      }`}
    >
      <span className={compact ? 'contents' : fit === 1 ? 'hidden' : 'hidden sm:contents'}>{icon}</span>
      {fit === 0 && <span>{short ? shortLabel : label}</span>}
      {fit === 1 && <span>{shortLabel}</span>}
      <span className={`relative ml-0.5 inline-flex h-3.5 shrink-0 rounded-full transition-colors ${fit === 0 ? 'w-6' : 'w-5'} ${on ? 'bg-[#C9A24D]' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${on ? (fit === 0 ? 'left-3' : 'left-2') : 'left-0.5'}`} />
      </span>
    </button>
  )
}
