'use client'

import { memo, ReactNode } from 'react'
import { Check, Info, X } from 'lucide-react'
import ThemeSwitch from '@/components/ThemeSwitch'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useEscapeToClose } from '@/components/ui/windowMotion'
import { useAuth } from '@/contexts/AuthContext'
import { planHasBragSheet } from '@/lib/bragSheetData'
import { hasMlsAccess, hasShowcaseAccess } from '@/lib/navAccess'

interface OpenHouse {
  id: string;
  address: string;
  cover_image_url?: string;
  similarPropertiesSnapshot?: any[];
  listingKey?: string;
  cheatSheetSnapshot?: any;
}

interface ViewPDFsModalProps {
  openHouse: OpenHouse;
  onClose: () => void;
  onViewFlyer: () => void;
  // The paper backup sheet (pencil sign-in, same questions) - a row on the Sign In card, not its own card.
  onViewPaperSignIn?: () => void;
  onViewRecommendations: () => void;
  onEditRecommendations?: () => void;
  // This open house's Similar Homes switch (the sheet here + the similar homes on the Guest Pass).
  // Off = the card shows as off with a switch to include it again; the picked homes are kept.
  similarHomes?: boolean;
  onToggleSimilarHomes?: () => void;
  // This open house's Showcases switch - off drops the Brag Sheet's Showcase pitch page.
  showcasesOn?: boolean;
  onViewBragSheet: () => void;
  onViewCheatSheet: () => void;
  onEditCheatSheet?: () => void;
  onReloadFlyerPrice?: () => void;
  isReloadingFlyerPrice?: boolean;
  onReloadBragSheet?: () => void;
  isReloadingBragSheet?: boolean;
  onReloadCheatSheet?: () => void;
  isReloadingCheatSheet?: boolean;
  // Swaps the truncated MLS description for a short AI-written "Highlights of [address]"
  // paragraph on the Cheat Sheet's Open House Guide page - same toggle as inside the full preview,
  // shared so switching it here or there stays in sync. Requires the Cheat Sheet to have been
  // opened at least once already (needs its saved description) - see the parent's toast if not.
  showCheatSheetSummary?: boolean;
  isSummarizingCheatSheet?: boolean;
  onToggleCheatSheetSummary?: () => void;
  // Re-checks each property currently shown against our MLS mirror: refreshes its price and
  // drops it if it's sold/no longer active.
  onReloadRecommendations?: () => void;
  isReloadingRecommendations?: boolean;
  // Similar Homes only - shows/hides the "X% Match" badge on each card, shared with the same
  // toggle inside the full preview so switching it here or there stays in sync.
  showMatchScore?: boolean;
  onToggleMatchScore?: () => void;
  // Local override for the Brag Sheet's "Sold/Volume/Avg" stats block - lets the agent hide it
  // for this print run without touching their Agent Hub "Show stats" setting.
  showBragSheetStats?: boolean;
  onToggleBragSheetStats?: () => void;
  // Default theme (light/dark) for the on-screen Sign-In Sheet/Kiosk this open house's QR code
  // leads to. Persisted server-side (unlike the Brag Sheet toggle above) since it's read by a
  // guest's own device, not just this print run.
  qrDarkMode?: boolean;
  onToggleQrDarkMode?: () => void;
  // Sign-In flyer "Brand" upgrade - hosting-agent pill (photo, name, brokerage) over the photo.
  flyerBrand?: boolean;
  onToggleFlyerBrand?: () => void;
}

// --- HELPERS ---
const formatAddress = (address: string) => {
  if (!address) return "";
  const parts = address.split(',');

  // Usually address is: Street, City, State Zip, County
  // We want to keep everything before the Zip, and the Zip itself, but remove County if it follows.

  // If it's a typical full address with many commas
  if (parts.length > 2) {
    const street = parts[0].trim();
    const city = parts[1].trim();
    const stateZip = parts[2].trim(); // This might contain "PA 19087 Delaware"

    // Clean up StateZip to remove anything after the 5-digit zip code
    const zipMatch = stateZip.match(/^([A-Z]{2}\s+\d{5})/);
    const cleanedStateZip = zipMatch ? zipMatch[1] : stateZip;

    const rawAddress = `${street}, ${city}, ${cleanedStateZip}`;
    return rawAddress
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Fallback for shorter addresses
  const rawAddress = parts.length > 1
    ? `${parts[0].trim()}, ${parts[1].trim()}`
    : parts[0].trim();

  return rawAddress
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// A generic ordered footer action - a card can stack several of these (e.g. Brag Sheet has a
// Sold Stats toggle above a Reload button; Similar Homes has Edit above Reload). Order is
// controlled entirely by the array each caller passes in, so each card can put whichever action
// belongs on top without the shared component hard-coding a fixed slot order.
type CardAction = {
  key: string;
  label: string;
  hint: string;
  onClick: () => void;
  loading?: boolean;
  icon?: 'reload' | 'edit' | 'moon' | 'sun' | 'print';
  // When set, renders as an on/off toggle - a solid green check + green underline when on, a small
  // grey X when off - instead of an icon row.
  active?: boolean;
  // Adds a small info glyph at the end of the row - for a toggle whose effect isn't obvious from
  // the label alone (the hover `hint` already covers that on desktop; this makes the same detail
  // discoverable on touch devices with no hover).
  showInfo?: boolean;
  // Optical nudge (px) for a row whose content only has an icon on one side (nothing balancing
  // it on the other) - the icon+label group is mathematically centered in the button but reads
  // as sitting left of center next to a fuller sibling (e.g. Similar Homes' Edit next to Score,
  // which has both a leading dot and a trailing info glyph). Shifts just the icon+label, not the
  // whole button, so hover/click target width is unaffected.
  nudge?: number;
};

function ActionButton({ action }: { action: CardAction }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        action.onClick();
      }}
      disabled={action.loading}
      title={action.hint}
      className={`flex flex-1 items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] transition-colors duration-150 disabled:opacity-60 sm:gap-1.5 sm:px-1.5 sm:py-2 sm:text-[9px] sm:tracking-[0.1em] md:py-2.5 ${
        action.active !== undefined
          ? action.active
            ? 'bg-emerald-50/70 text-emerald-700 shadow-[inset_0_-2px_0_0_#10b981] hover:bg-emerald-50 dark:bg-emerald-500/[0.07] dark:text-emerald-300 dark:shadow-[inset_0_-2px_0_0_rgba(52,211,153,0.85)] dark:hover:bg-emerald-500/[0.12]'
            : 'bg-[#faf9f7] text-gray-400 hover:bg-gray-100 dark:bg-[#0B0B0B] dark:hover:bg-gray-800'
          : 'bg-[#faf9f7] text-gray-500 hover:bg-[#8b7355]/10 hover:text-[#8b7355] dark:bg-[#0B0B0B] dark:text-gray-400 dark:hover:bg-[#C9A24D]/10 dark:hover:text-[#C9A24D]'
      }`}
    >
      <span
        className="flex items-center gap-1 sm:gap-1.5"
        style={action.nudge ? { transform: `translateX(${action.nudge}px)` } : undefined}
      >
        {action.active !== undefined ? (
          action.active ? (
            <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white sm:h-3.5 sm:w-3.5">
              <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5" strokeWidth={4} />
            </span>
          ) : (
            <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500 sm:h-3.5 sm:w-3.5">
              <X className="h-2 w-2 sm:h-2.5 sm:w-2.5" strokeWidth={3.5} />
            </span>
          )
        ) : action.icon === 'moon' || action.icon === 'sun' ? (
          <ThemeSwitch dark={action.icon === 'moon'} small />
        ) : (
          <svg className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${action.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {action.icon === 'print' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            ) : action.icon === 'edit' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            )}
          </svg>
        )}
        {/* The theme button's half-width slot can't fit switch + word + info - the lit side of
            the switch (on a button colored like that theme) says it, the word stays for screen readers. */}
        <span className={action.icon === 'moon' || action.icon === 'sun' ? 'sr-only' : 'truncate'}>{action.loading ? 'Working...' : action.label}</span>
      </span>
      {action.showInfo && <Info className="h-2.5 w-2.5 shrink-0 opacity-60 sm:h-3 sm:w-3" />}
    </button>
  );
}

function DocumentCard({
  icon,
  title,
  subtitle,
  onView,
  showViewHint = true,
  actions = [],
  off = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onView: () => void;
  showViewHint?: boolean;
  // Switched off for this open house: dimmed, and its first action row is the switch back on.
  off?: boolean;
  // A plain CardAction renders as its own full-width row; a nested CardAction[] renders as a
  // shared row split evenly between its members (e.g. Edit + Match Score side by side).
  actions?: (CardAction | CardAction[])[];
}) {
  return (
    // Phones (user, 10/17): one document per row - a wide bar (icon, name, what it is, a ">"), with
    // all its options in one roomy strip underneath - instead of two cramped tiles per row.
    <div className="group relative flex w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-800 dark:bg-[#1c1c1e] sm:min-h-[184px] sm:w-auto sm:min-w-0 sm:max-w-[12.5rem] sm:flex-1 sm:basis-0">
      <button
        onClick={onView}
        className="flex flex-1 flex-row items-center justify-start gap-3 p-3.5 text-left active:scale-[0.99] sm:flex-col sm:justify-center sm:gap-2.5 sm:p-3.5 sm:text-center md:gap-3 md:p-4"
      >
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-[#faf9f7] shadow-sm transition-all duration-150 dark:border-gray-800 dark:bg-[#0B0B0B] sm:h-12 sm:w-12 md:h-14 md:w-14 ${off ? 'opacity-40 grayscale' : ''}`}>
          <div className="h-6 w-6 text-[#8b7355] dark:text-[#C9A24D] md:h-7 md:w-7">{icon}</div>
        </div>
        <div className="min-w-0 flex-1 sm:flex-none">
          <h4 className={`text-[15px] font-black leading-tight sm:text-sm sm:font-bold md:text-base ${off ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>{title}</h4>
          <p className={`mt-0.5 text-[10px] font-bold uppercase leading-snug tracking-wider sm:mt-1 sm:text-[9px] sm:leading-relaxed sm:tracking-widest ${off ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 sm:hidden md:block'}`}>{subtitle}</p>
        </div>
        <svg className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#8b7355] sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
        {showViewHint && !off && (
          <div className="hidden items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-gray-300 transition-colors group-hover:text-[#8b7355] dark:group-hover:text-[#C9A24D] sm:mt-1 sm:flex">
            View
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </button>

      {actions.length > 0 && (
        <div className="flex divide-x divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800 sm:hidden">
          {actions.flat().map(action => <ActionButton key={action.key} action={action} />)}
        </div>
      )}
      {actions.map((entry, index) =>
        Array.isArray(entry) ? (
          <div key={entry.map(a => a.key).join('+')} className="hidden divide-x divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800 sm:flex">
            {entry.map(action => <ActionButton key={action.key} action={action} />)}
          </div>
        ) : (
          <div key={entry.key} className="hidden border-t border-gray-100 dark:border-gray-800 sm:flex">
            <ActionButton action={entry} />
          </div>
        )
      )}
    </div>
  );
}

export const ViewPDFsModal = memo(function ViewPDFsModal({
  openHouse,
  onClose,
  onViewFlyer,
  onViewPaperSignIn,
  onViewRecommendations,
  onEditRecommendations,
  similarHomes,
  onToggleSimilarHomes,
  showcasesOn,
  onViewBragSheet,
  onViewCheatSheet,
  onEditCheatSheet,
  onReloadFlyerPrice,
  isReloadingFlyerPrice,
  onReloadBragSheet,
  isReloadingBragSheet,
  onReloadCheatSheet,
  isReloadingCheatSheet,
  showCheatSheetSummary,
  isSummarizingCheatSheet,
  onToggleCheatSheetSummary,
  onReloadRecommendations,
  isReloadingRecommendations,
  showMatchScore,
  onToggleMatchScore,
  showBragSheetStats,
  onToggleBragSheetStats,
  qrDarkMode,
  onToggleQrDarkMode,
  flyerBrand,
  onToggleFlyerBrand,
}: ViewPDFsModalProps) {
  // Wheel/touch over the window must not scroll the Open Houses page behind it.
  useBodyScrollLock(true);
  useEscapeToClose(onClose);
  const { user } = useAuth();
  const hasComps = Boolean(openHouse.similarPropertiesSnapshot && openHouse.similarPropertiesSnapshot.length > 0);
  // With the switch wired, the Similar Homes card always shows for an MLS-linked home (on, off, or
  // on with nothing picked yet) - without it, only when there are homes to show.
  const similarSwitchable = Boolean(onToggleSimilarHomes && openHouse.listingKey && hasMlsAccess(user?.plan_tier));
  const similarOn = similarHomes !== false;
  // The Cheat Sheet is built from Bright MLS data, so it only exists for an MLS-linked open house
  // on an MLS plan - never for the No-MLS plans' manually entered homes.
  const hasCheatSheet = Boolean(openHouse.listingKey) && hasMlsAccess(user?.plan_tier);
  const canRefreshCheatSheet = hasCheatSheet;
  // The Brag Sheet only exists on plans with a sales source, and its Showcase pitch page only on
  // Showcase plans - the card's subtitle says exactly what this agent's copy contains.
  const hasBragSheet = planHasBragSheet(user?.plan_tier);
  // The pitch (page 2) needs Showcases on AND a Similar Homes sheet with homes (lib/bragSheetData).
  const bragSheetSubtitle = hasShowcaseAccess(user?.plan_tier) && showcasesOn !== false && similarOn && hasComps ? 'Bio, Your Sales, & Showcase Pitch' : 'Bio & Your Recent Sales';
  const canReloadFlyerPrice = Boolean(onReloadFlyerPrice && openHouse.listingKey);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 print:hidden animate-fadeIn">
      <div className="bg-[#FAFAF7] dark:bg-[#151517] rounded-3xl sm:rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[88dvh] overflow-y-auto overscroll-contain border border-white/50 dark:border-gray-800 transform transition-all relative">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#8b7355] via-[#C9A24D] to-[#8b7355]" />

        {/* Header */}
        <div className="pt-6 pb-4 px-5 text-center border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-[#0B0B0B]/30 sm:pt-8 sm:pb-5 sm:px-8">
          <h3 className="font-serif text-xl font-bold text-gray-900 dark:text-white tracking-tight sm:text-3xl">Documents</h3>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="h-px w-4 bg-[#C9A24D]/40" />
            <p className="text-[#6B7280] dark:text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] sm:text-xs">{formatAddress(openHouse.address)}</p>
            <span className="h-px w-4 bg-[#C9A24D]/40" />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 p-3.5 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3 sm:p-6 md:flex-nowrap md:gap-4">
          <DocumentCard
            onView={onViewFlyer}
            title="Sign In"
            subtitle="Branded QR Sign in Sheet"
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4h6v6H4V4zm2 2v2h2V6H6zm8-2h6v6h-6V4zm2 2v2h2V6h-2zM4 14h6v6H4v-6zm2 2v2h2v-2H6zm8-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2z" /></svg>
            }
            actions={[
              ...((onToggleFlyerBrand || onToggleQrDarkMode) ? [[
                ...(onToggleFlyerBrand ? [{
                  key: 'brand',
                  label: 'Brand',
                  active: Boolean(flyerBrand),
                  showInfo: true,
                  hint: 'Adds your branding to the printed flyer: your photo, name, and brokerage (from your Settings profile) in a pill across the top of the photo - the same look as the top of the Sign-In Sheet guests see on screen.',
                  onClick: onToggleFlyerBrand,
                }] : []),
                ...(onToggleQrDarkMode ? [{
                  key: 'qr-theme',
                  // Shows the CURRENT theme (moon = dark, sun = light); tap to switch.
                  label: qrDarkMode ? 'Midnight' : 'Ivory',
                  icon: (qrDarkMode ? 'moon' : 'sun') as 'moon' | 'sun',
                  showInfo: true,
                  hint: `Sign-in screen theme: ${qrDarkMode ? 'MIDNIGHT' : 'IVORY'} (tap to switch). Sets the look of the on-screen Sign-In Sheet/Kiosk guests see when they scan this QR code or use the tablet. Does NOT affect the printed flyer.`,
                  onClick: onToggleQrDarkMode,
                }] : []),
              ]] : []),
              // Clipboard (the pencil sign-in sheet) and Refresh share one row.
              ...((onViewPaperSignIn || canReloadFlyerPrice) ? [[
                ...(onViewPaperSignIn ? [{
                  key: 'paper',
                  label: 'Clipboard',
                  hint: 'Clipboard: a printable pencil sign-in sheet for this home - the same questions as the QR sign-in (name, email, phone, agent). One tap to print.',
                  onClick: onViewPaperSignIn,
                  icon: 'print' as const,
                }] : []),
                ...(canReloadFlyerPrice ? [{
                  key: 'reload',
                  label: 'Refresh',
                  showInfo: true,
                  hint: 'Refresh: pulls the latest listing price from the database onto the flyer. Does NOT touch the QR code, cover photo, or anything else.',
                  onClick: onReloadFlyerPrice!,
                  loading: isReloadingFlyerPrice,
                  icon: 'reload' as const,
                }] : []),
              ]] : []),
            ]}
          />

          {(hasComps || similarSwitchable) && (
            <DocumentCard
              onView={!similarOn ? onToggleSimilarHomes! : hasComps ? onViewRecommendations : (onEditRecommendations || onViewRecommendations)}
              title="Similar Homes"
              subtitle={!similarOn ? 'Off for this open house' : hasComps ? 'Similar Active Listings' : 'No homes picked yet'}
              off={!similarOn}
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              }
              actions={!similarOn ? [{
                key: 'include',
                label: 'Include',
                active: false,
                showInfo: true,
                hint: 'Similar Homes is OFF for this open house: no Similar Homes sheet, and no similar homes on guests’ Guest Pass - guests stay focused on this home. Tap to include it again (your picked homes are kept).',
                onClick: onToggleSimilarHomes!,
              }] : [
                ...(!hasComps && onEditRecommendations ? [{
                  key: 'choose',
                  label: 'Choose Homes',
                  hint: 'Pick the similar active listings for this open house’s Similar Homes sheet and Guest Pass.',
                  onClick: onEditRecommendations,
                  icon: 'edit' as const,
                }] : []),
                ...(hasComps && (onEditRecommendations || onToggleMatchScore) ? [[
                  ...(onEditRecommendations ? [{
                    key: 'edit',
                    label: 'Edit',
                    hint: 'Does: let you pick different similar listings to show. Does NOT auto-refresh anything on its own.',
                    onClick: onEditRecommendations,
                    icon: 'edit' as const,
                    nudge: 3,
                  }] : []),
                  ...(onToggleMatchScore ? [{
                    key: 'match-score',
                    label: 'Match %',
                    showInfo: true,
                    hint: 'Shows/hides the "X% Match" badge on each card, and sorts by best match first when on.',
                    onClick: onToggleMatchScore,
                    active: Boolean(showMatchScore),
                  }] : []),
                ]] : []),
                // The on/off sits next to Refresh (not up with Edit and Match %) - user, 10/16.
                ...((similarSwitchable || (hasComps && onReloadRecommendations)) ? [[
                  ...(similarSwitchable ? [{
                    key: 'include',
                    label: 'Include',
                    active: true,
                    showInfo: true,
                    hint: 'Similar Homes is ON: the Similar Homes sheet prints with your kit, and guests see these homes on their Guest Pass. Tap to turn it off for this open house (e.g. sitting your own listing).',
                    onClick: onToggleSimilarHomes!,
                  }] : []),
                  ...(hasComps && onReloadRecommendations ? [{
                    key: 'reload',
                    label: 'Refresh',
                    hint: 'Does: re-checks each listing shown here against the database - updates its price if changed, and removes it automatically if it has sold or is no longer active.',
                    onClick: onReloadRecommendations,
                    loading: isReloadingRecommendations,
                    icon: 'reload' as const,
                  }] : []),
                ]] : []),
              ]}
            />
          )}

          {hasBragSheet && (
          <DocumentCard
            onView={onViewBragSheet}
            title="Brag Sheet"
            subtitle={bragSheetSubtitle}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            }
            actions={[
              ...(onToggleBragSheetStats ? [{
                key: 'stats',
                label: 'Sold Stats',
                active: Boolean(showBragSheetStats),
                showInfo: true,
                hint: 'Shows/hides the Sold/Volume/Avg stats block on the Brag Sheet for this print run.',
                onClick: onToggleBragSheetStats,
              }] : []),
              ...(onReloadBragSheet ? [{
                key: 'reload',
                label: 'Resync Sales',
                hint: 'Does: pulls your latest profile info and recent sales from Settings / Agent Hub.',
                onClick: onReloadBragSheet,
                loading: isReloadingBragSheet,
                icon: 'reload' as const,
              }] : []),
            ]}
          />
          )}

          {hasCheatSheet && (
            <DocumentCard
              onView={onViewCheatSheet}
              title="Cheat Sheet"
              subtitle="Facts, Description & Nearby"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              }
              actions={[
                ...((onEditCheatSheet || onToggleCheatSheetSummary) ? [[
                  ...(onEditCheatSheet ? [{
                    key: 'edit',
                    label: 'Edit',
                    hint: 'Does: let you pick different photos (or re-drag their crop) for the Cheat Sheet. Does NOT auto-refresh price or MLS stats.',
                    onClick: onEditCheatSheet,
                    icon: 'edit' as const,
                    nudge: 3,
                  }] : []),
                  ...(onToggleCheatSheetSummary ? [{
                    key: 'summarize',
                    label: 'Recap',
                    active: Boolean(showCheatSheetSummary),
                    loading: isSummarizingCheatSheet,
                    showInfo: true,
                    hint: 'Swaps the full MLS description for a short "Highlights of [address]" paragraph the AI writes from it - the home’s top selling points in 2-4 tight sentences, capped to 3 printed lines.',
                    onClick: onToggleCheatSheetSummary,
                  }] : []),
                ]] : []),
                ...(onReloadCheatSheet && canRefreshCheatSheet ? [{
                  key: 'reload',
                  label: 'Refresh Data',
                  hint: 'Does: re-pull price, beds/baths/sqft and the listing description from the MLS (the Recap is rewritten only if the description changed). Does NOT change nearby places or photos.',
                  onClick: onReloadCheatSheet,
                  loading: isReloadingCheatSheet,
                  icon: 'reload' as const,
                }] : []),
              ]}
            />
          )}
        </div>

        <div className="px-5 pb-5 flex flex-col items-center sm:px-8 sm:pb-10">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl sm:rounded-2xl font-bold hover:bg-[#8b7355] dark:hover:bg-[#C9A24D] hover:text-white transition-all duration-300 shadow-lg sm:py-4"
          >
            Close
          </button>
          <p className="mt-4 text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] sm:mt-6 sm:text-[10px]">Tap a document to open its print preview</p>
        </div>
      </div>
    </div>
  )
})
