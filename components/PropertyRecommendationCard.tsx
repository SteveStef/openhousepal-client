"use client";

import Image from "next/image";
import { Bath, BedDouble, LandPlot, Ruler, Eye } from "lucide-react";
import { formatPropertyFeature, normalizeImageUrl } from "@/lib/utils";
import { useHoverPhotoCycle } from "@/lib/useHoverPhotoCycle";
import { useQrDataUrl } from '@/lib/qr'

interface PropertyCardProps {
  image: string;
  streetAddress: string;
  town?: string;
  price?: number;
  beds: number;
  baths: number;
  sqft: number;
  city: string;
  state?: string;
  zipcode?: string;
  acres: number;
  yearBuilt: number;
  dom: number;
  id?: string | number; // Unique ID for QR code link
  agentId?: string; // Agent ID for the QR code link
  qrLink?: string; // Optional custom link for the QR code
  hideQr?: boolean;
  isCompact?: boolean;
  selected?: boolean; // New prop for selection state
  selectionTone?: 'brand' | 'green';
  matchScore?: number;
  sameSchool?: boolean;
  elevated?: boolean;
  property?: any;
  // Renders one combined "123 Main St, Ardmore, PA" heading instead of a separate bold street-address
  // line plus a second all-caps city/state/zip line underneath.
  combinedAddressLine?: boolean;
  // City (top-left), days-on-market (top-right), and price (bottom-left) rendered directly on the
  // photo instead of in the text block below it - there isn't room for both the full "123 Main
  // St, Ardmore, PA" line and the specs row to each stay on one line otherwise. The heading below
  // the photo is street-address-only and price drops out of the stats row since both are already
  // on the photo.
  photoOverlays?: boolean;
  // When provided, shows a small "view details" button on the photo (separate from the card's own
  // click, which parents typically use for selection-toggling) - only meaningful where a caller
  // actually wants to open the full property details modal, e.g. the Similar Properties picker.
  // Omitted everywhere else (print/brag-sheet usages), so nothing changes there.
  onViewDetails?: () => void;
  /** A labelled square "View details" button instead of the small round eye (kit Similar Homes picker). */
  viewDetailsButton?: boolean;
}

export function PropertyRecommendationCard({
  image,
  streetAddress,
  city,
  state,
  zipcode,
  price,
  beds,
  baths,
  sqft,
  acres,
  dom,
  id,
  agentId,
  qrLink,
  hideQr = false,
  isCompact = false,
  selected = false,
  selectionTone = 'brand',
  matchScore,
  sameSchool = false,
  elevated = false,
  property,
  combinedAddressLine = false,
  photoOverlays = false,
  onViewDetails,
  viewDetailsButton = false,
}: PropertyCardProps) {
  const selectedClasses = selectionTone === 'green'
    ? 'border-emerald-500 ring-4 ring-emerald-500/15 bg-emerald-50/40'
    : 'border-[#8b7355] ring-4 ring-[#8b7355]/10'
  const selectedOverlayClasses = selectionTone === 'green' ? 'bg-emerald-500/20' : 'bg-[#8b7355]/15'
  const selectedIconClasses = selectionTone === 'green' ? 'bg-emerald-600' : 'bg-[#8b7355]'
  // Extract only the street address (first part before comma)
  const streetOnly = (streetAddress || 'Address Not Available').split(',')[0].trim();
  
  const cleanAddress = streetOnly
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const cleanCity = (city || '')
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const cityStateZip = [cleanCity, [state, zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  // "Ardmore, PA" - no zip, appended after the street address for the combined-line format.
  const cityStateOnly = [cleanCity, state].filter(Boolean).join(', ');

  // Use the provided qrLink, or fallback to the auto-generated one based on the unique ID and Agent ID
  const destinationUrl = qrLink || `https://openhousepal.com/property/${id || 'listing'}/${agentId || 'agent'}`;
  
  const qrUrl = useQrDataUrl(destinationUrl, { size: 120, dark: '#1a1a1a' });
  const getNumeric = (...values: any[]) => {
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      const numericValue = Number(value);
      if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
    }
    return 0;
  };
  const explicitAcres = getNumeric(
    acres,
    property?.LotSizeAcres,
    property?.lotSizeAcres,
    property?.lot_size_acres,
    property?.acres
  );
  const squareFeet = getNumeric(
    property?.LotSizeSquareFeet,
    property?.lotSizeSquareFeet,
    property?.lot_size,
    property?.lotSize
  );
  const displayAcres = explicitAcres || (squareFeet ? Number((squareFeet / 43560).toFixed(2)) : 0);

  // Hover-to-cycle through the property's photos (0.5s to the first flip, 3s each after), with a
  // progress bar across the top of the photo. Falls back to just `image` when there's no photo
  // array on the property, and no-ops on a single photo.
  const cyclePhotos: string[] = Array.isArray(property?.photos) && property.photos.length > 0
    ? property.photos
    : [image];
  const { index: photoIndex, hovering: photoHovering, slotMs: photoSlotMs, onEnter: onPhotoEnter, onLeave: onPhotoLeave } = useHoverPhotoCycle(cyclePhotos.length);
  const shownImage = cyclePhotos[photoIndex] ?? image;

  return (
    <article
      onMouseEnter={onPhotoEnter}
      onMouseLeave={onPhotoLeave}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border-2 transition-all duration-300 ${
      selected
        ? selectedClasses
        : 'border-transparent hover:border-gray-200'
    } ${elevated ? 'bg-white shadow-lg ring-1 ring-gray-300 hover:shadow-xl hover:shadow-[#C9A24D]/10 dark:ring-0 dark:shadow-sm' : 'bg-white shadow-md hover:shadow-lg'} ${isCompact ? '' : ''}`}>

      {/* Property Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-200 dark:bg-gray-800">
        {/* draggable=false - a click-drag across several cards to multi-select (this image is most
            of each card's clickable area) was instead starting the browser's native "drag this
            image" ghost, which - like text selection - only auto-scrolls once the cursor reaches
            the real viewport edge, not this grid's own edge. select-none on the grid (see
            CreateOpenHouseWizard) stops text selection but not image drag, which needs its own
            opt-out. */}
        <Image
          key={shownImage}
          src={normalizeImageUrl(shownImage) || "/placeholder.svg"}
          alt={cleanAddress}
          fill
          priority
          draggable={false}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.045] ${selected ? 'grayscale-[25%] brightness-90' : 'brightness-[1.04] saturate-[1.1]'}`}
          quality={92}
        />

        {photoHovering && cyclePhotos.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-black/25">
            <div key={`${photoIndex}-${photoSlotMs}`} className="ohp-photo-cycle-bar h-full bg-[#C9A24D]" style={{ animationDuration: `${photoSlotMs}ms` }} />
          </div>
        )}

        {/* Soft bottom scrim - gives every overlay (price/city/DOM badges, or just the photo on
            its own) something richer to sit on than flat photo, without darkening the image itself. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 via-black/0 to-transparent" />

        {onViewDetails && viewDetailsButton && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewDetails() }}
            aria-label="View details"
            className="absolute right-2.5 top-2.5 z-10 flex h-[58px] w-[64px] flex-col items-center justify-center gap-1 rounded-2xl bg-white/95 text-[#111827] shadow-[0_10px_24px_-10px_rgba(0,0,0,.55)] ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-white print:hidden"
          >
            <Eye className="h-[18px] w-[18px] text-[#8b7355]" />
            <span className="text-center text-[9.5px] font-black uppercase leading-[1.05] tracking-wide">View<br />details</span>
          </button>
        )}
        {onViewDetails && !viewDetailsButton && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewDetails() }}
            title="View details"
            aria-label="View details"
            className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#111827] shadow-md transition hover:bg-white hover:scale-105 print:hidden"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}

        {typeof matchScore === 'number' && (
          <div className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-900/20">
            {matchScore}% Match
          </div>
        )}

        {sameSchool && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wide text-[#111827] shadow-lg ring-1 ring-black/5">
            Same School
          </div>
        )}

        {photoOverlays && (
          <>
            {cleanCity && (
              <div className="absolute left-2 top-2 max-w-[65%] truncate rounded-lg border border-white/10 bg-[#111827]/90 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ">
                {cleanCity}
              </div>
            )}
            {!!dom && dom > 0 && (
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-lg border border-gray-200 bg-white/90 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#111827] shadow-sm ">
                <span className="text-xs font-black text-[#C9A24D]">{dom}</span> DOM
              </div>
            )}
            <div className="absolute bottom-2 left-2 rounded-lg border border-white/10 bg-[#111827]/90 px-2.5 py-1 text-sm font-black text-white shadow-lg ">
              {price ? `$${price.toLocaleString()}` : 'Price N/A'}
            </div>
          </>
        )}

        {/* Selection Overlay Indicator */}
        {selected && (
          <div className={`absolute inset-0 flex items-center justify-center ${selectedOverlayClasses}`}>
            <div className={`${selectedIconClasses} text-white p-2 rounded-full shadow-lg transform animate-fadeIn`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-1 flex-col ${isCompact ? 'p-4' : 'p-5'} print:bg-white print:p-3`}>

        {/* Top: Address & City/State/Zip Row */}
        <div className="mb-3 print:mb-2">
          {photoOverlays ? (
            <h3 className={`font-black tracking-tight leading-tight text-[#111827] print:text-black ${isCompact ? 'text-base' : 'text-xl'} print:text-[11pt] line-clamp-1`}>
              {cleanAddress}
            </h3>
          ) : combinedAddressLine ? (
            <h3 className={`font-black tracking-tight leading-tight text-[#111827] print:text-black ${isCompact ? 'text-base' : 'text-xl'} print:text-[11pt] line-clamp-1`}>
              {cleanAddress}
              {cityStateOnly && <span className="font-semibold text-[#111827] print:text-black">, {cityStateOnly}</span>}
            </h3>
          ) : (
            <>
              <h3 className={`font-black tracking-tight leading-tight text-[#111827] print:text-black ${isCompact ? 'text-base' : 'text-xl'} print:text-[11pt] line-clamp-1`}>
                {cleanAddress}
              </h3>
              <p className="mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest print:text-black print:text-[8pt] line-clamp-1">
                {cityStateZip || 'Location unavailable'}
              </p>
            </>
          )}
        </div>

        {/* Bottom Row: Stats (incl. price) & QR Code */}
        <div className="mt-auto flex items-end justify-between gap-2 print:gap-2">

          {/* Stats Row - price leads (unless it's already shown on the photo), then specs.
              flex-nowrap on purpose from tablet up: specs dropping to a second line looks worse than
              them staying tight on one. Phones wrap instead of running the numbers into each other. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 overflow-hidden print:gap-2 min-w-0 sm:flex-nowrap">
            {!photoOverlays && (
              <div className="flex items-center whitespace-nowrap rounded-lg bg-gradient-to-r from-[#C9A24D]/20 to-[#C9A24D]/5 px-2.5 py-1 text-sm font-black text-[#8b7355] ring-1 ring-[#C9A24D]/20 print:bg-transparent print:p-0 print:text-black print:ring-0">
                {price ? `$${price.toLocaleString()}` : 'Price N/A'}
              </div>
            )}

            <div className="flex items-center gap-1 whitespace-nowrap">
              <BedDouble className="h-3 w-3 text-gray-400" />
              <span className="text-sm font-black text-[#111827] print:text-black">{formatPropertyFeature(beds)}</span>
            </div>

            <div className="flex items-center gap-1 whitespace-nowrap">
              <Bath className="h-3 w-3 text-gray-400" />
              <span className="text-sm font-black text-[#111827] print:text-black">{formatPropertyFeature(baths)}</span>
            </div>

            <div className="flex items-center gap-1 whitespace-nowrap min-w-0">
              <Ruler className="h-3 w-3 shrink-0 text-gray-400" />
              <span className="text-sm font-black text-[#111827] print:text-black">
                {formatPropertyFeature(sqft, true)}
              </span>
            </div>

            <div className="flex items-center gap-1 whitespace-nowrap min-w-0">
              <LandPlot className="h-3 w-3 shrink-0 text-gray-400" />
              <span className="text-sm font-black text-[#111827] print:text-black">
                {displayAcres ? displayAcres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
              </span>
            </div>
          </div>

          {/* QR Code */}
          {!hideQr && (
            <div className="shrink-0 print:block ml-2">
              <div className="relative h-10 w-10 sm:h-12 sm:w-12 overflow-hidden rounded-md bg-white p-1 shadow-sm border border-gray-100 print:h-14 print:w-14 print:border-gray-200 print:rounded-none">
                 <Image
                  src={qrUrl || "/placeholder.svg"}
                  alt="Scan"
                  fill
                  priority
                  draggable={false}
                  sizes="(max-width: 640px) 40px, 48px"
                  className="object-contain p-0.5"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
