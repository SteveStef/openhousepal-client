'use client'

import { useMemo, memo } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Property } from '@/types'
import { formatOpenHouse, formatOpenHouseDay, upcomingOpenHouses } from '@/lib/mlsOpenHouses'
import { ThumbsUp, ThumbsDown, MessageCircle, Calendar, Eye, Bed, Bath, Square, Home, MapPin, School, Trees, Navigation, Star, FolderInput, Undo2 } from 'lucide-react'
import { cleanAddress, formatMlsStatus, formatPropertyFeature, isPropertyAvailableStatus, normalizeImageUrl, haversineMiles, googleMapsDirectionsUrl } from '@/lib/utils'
import { statusNotice, type StatusTone } from '@/lib/showcaseStatus'
import CardPhotoSwiper from '@/components/property/CardPhotoSwiper'

// "Lower Merion Township School District" -> "Lower Merion": the words that only make the pill
// longer (Township, School District, Schools, Public...) come off.
const shortDistrict = (name?: string | null) =>
  String(name || '')
    .replace(/\b(public|school(s)?|district|township|twp\.?|area|unified|consolidated|regional)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,-]+$/, '')
    .trim() || (name || '')

interface PropertyCardProps {
  property: Property
  onLike?: (propertyId: string | number, liked: boolean) => void
  onDislike?: (propertyId: string | number, disliked: boolean) => void
  onPropertyClick?: (property: Property) => void
  onScheduleTour?: (property: Property) => void
  onCommentClick?: (property: Property) => void
  showDetailedViewCount?: boolean // If true, shows "X views", if false shows just "Viewed"
  showNewForUnviewed?: boolean // If true, shows NEW badge when viewCount === 0, if false uses property.is_new
  // Showcase search address/coordinates - see PropertyGrid's destination prop.
  destination?: { address?: string | null; lat?: number | null; lng?: number | null }
  // "X% Match" badge - same treatment as PropertyRecommendationCard's Similar Properties badge
  // (lib/matchScore.ts), shown when a Showcase has a "compare against" property and the agent
  // hasn't turned it off. Absent (not 0) whenever there's nothing to compare against.
  matchScore?: number | null
  // The onScheduleTour button reads differently for the two callers: a visitor requesting a
  // tour for themselves ("Schedule Tour") vs. the agent reviewing everyone's requests for this
  // property ("Tour Requests", with a count badge - property.tourCount is a collection-wide
  // total, which would leak other visitors' activity if ever shown on the public page, so this
  // defaults to the visitor-safe 'schedule' variant and only DetailView.tsx opts into 'requests'.
  tourButtonVariant?: 'schedule' | 'requests'
  /** Agent's Showcase view: the photo sits a little closer in, so Bright's corner badge falls outside the card. */
  cropMlsBadge?: boolean
  /** Agent's Showcase view: the "I recommend this home" star (left of the chat button). */
  onRecommend?: (property: Property) => void
  /** Who recommends it, for the gold banner ("Peter recommends this home"). */
  recommendedBy?: string | null
  /** Showcase (buyer + agent): a home that's off the market becomes the short "what happened" card
   *  - big status notice, photo / price / address / beds-baths-sqft, Like - and nothing else. */
  offMarketNotice?: boolean
  /** Its "Move to Sold/Removed" button (filed=false: "Move back" from inside the folder). */
  onMoveToSold?: (property: Property, filed: boolean) => void
}

const NOTICE_TONE: Record<StatusTone, string> = {
  sold: 'bg-rose-600 text-white',
  contract: 'bg-amber-400 text-[#111827]',
  off: 'bg-[#111827] text-white',
}

const PropertyCard = memo(function PropertyCard({ property, onLike, onDislike, onPropertyClick, onScheduleTour, onCommentClick, showDetailedViewCount = false, showNewForUnviewed = false, destination, matchScore, tourButtonVariant = 'schedule', cropMlsBadge = false, onRecommend, recommendedBy, offMarketNotice = false, onMoveToSold }: PropertyCardProps) {
  // The agent's pick (user, 10/18) - impossible to miss on both sides; gone once the client passes on it.
  const recommended = !!property.agentRecommended && !property.disliked
  // Memoize visitor interaction counts to avoid redundant filtering on every render
  const interactionCounts = useMemo(() => {
    if (!property.visitorInteractions) {
      return { liked: 0, disliked: 0 }
    }
    return {
      liked: property.visitorInteractions.filter(vi => vi.liked).length,
      disliked: property.visitorInteractions.filter(vi => vi.disliked).length
    }
  }, [property.visitorInteractions])

  // Helper function to determine if property is available (clickable)
  const isPropertyAvailable = useMemo(() => isPropertyAvailableStatus(property.MlsStatus), [property.MlsStatus])

  // Helper function to format status display
  const formatStatus = (status: string) => {
    return formatMlsStatus(status);
  }

  const formatPrice = (price?: number) => {
    return price ? price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }) : 'Price Available Upon Request'
  }

  const available = isPropertyAvailable
  const status = property.MlsStatus

  const isViewed = property.viewCount !== undefined && property.viewCount > 0
  // An upcoming open house outranks the "New" tag next to the price until its day has passed.
  const nextOpenHouse = upcomingOpenHouses(property.open_houses)[0]

  // Straight-line distance from the showcase's search address - pure local math (see
  // lib/utils.ts), recomputed on every render so it's always in sync with the current
  // destination, never a stale server-fetched value.
  const distanceMiles = useMemo(() => {
    if (destination?.lat == null || destination?.lng == null || property.Latitude == null || property.Longitude == null) return null
    return haversineMiles(destination.lat, destination.lng, property.Latitude, property.Longitude)
  }, [destination?.lat, destination?.lng, property.Latitude, property.Longitude])

  const directionsUrl = useMemo(() => {
    if (!destination || distanceMiles === null) return null
    const propertyAddress = [property.FullStreetAddress, property.City, property.StateOrProvince, property.PostalCode].filter(Boolean).join(', ')
    return googleMapsDirectionsUrl(
      { address: destination.address, lat: destination.lat, lng: destination.lng },
      { address: propertyAddress, lat: property.Latitude, lng: property.Longitude }
    )
  }, [destination, distanceMiles, property.FullStreetAddress, property.City, property.StateOrProvince, property.PostalCode, property.Latitude, property.Longitude])

  const isRecentPriceChange = useMemo(() => {
    if (!property.PriceChangeTimestamp) return false
    try {
      const changeDate = new Date(property.PriceChangeTimestamp)
      const today = new Date()
      const diffTime = Math.abs(today.getTime() - changeDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 14
    } catch (e) {
      return false
    }
  }, [property.PriceChangeTimestamp])

  // ---- Off the market, in a Showcase (user, 10/21) ----
  // What happened, big, on the photo; under it only what still matters - price (the sold price
  // once it's sold), address and beds / baths / sq ft - plus Like (the client can still tell their
  // agent they loved it) and the chat. No details window, tour, pass or DOM: none of it applies
  // now. Until someone moves it, the bottom button files it into Sold/Removed.
  // The card's photos to flip through (Showcase homes carry up to 10 as Photos; the first is the cover).
  const cardPhotos = (((property as any).Photos || property.photos || []) as string[]).filter(Boolean).slice(0, 10).map(u => normalizeImageUrl(u))
  const notice = offMarketNotice ? statusNotice(property) : null
  if (notice) {
    const soldPrice = notice.tone === 'sold' && property.ClosePrice ? property.ClosePrice : null
    const filed = !!property.soldFiled
    return (
      <div data-status-notice={notice.label} className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:border-gray-800 dark:bg-[#151517]">
        <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-[#0B0B0B]">
          {property.ListPictureURL ? (
            <Image
              src={normalizeImageUrl(property.ListPictureURL)}
              alt={property.FullStreetAddress}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className={`object-cover grayscale-[45%] ${cropMlsBadge ? 'origin-top-right scale-[1.13]' : ''}`}
              loading="lazy"
              quality={85}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Home className="h-12 w-12 text-gray-300 dark:text-gray-800" />
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-black/80 via-black/55 to-black/35 px-5 text-center">
            <span className={`rounded-xl px-5 py-2 text-[22px] font-black uppercase leading-none tracking-[0.12em] shadow-2xl ring-2 ring-white/40 sm:text-[26px] ${NOTICE_TONE[notice.tone]}`}>
              {notice.label}
            </span>
            <p className="mt-3 max-w-[19rem] text-[13px] font-semibold leading-snug text-white">{notice.line}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="min-w-0">
                {soldPrice ? (
                  <>
                    <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-rose-600">Sold for</span>
                    <span className="text-lg font-black leading-none tracking-tight text-[#111827] dark:text-white">{formatPrice(soldPrice)}</span>
                    {property.ListPrice ? <span className="ml-2 text-[11px] font-bold text-gray-400">Listed {formatPrice(property.ListPrice)}</span> : null}
                  </>
                ) : (
                  <span className="text-lg font-black leading-none tracking-tight text-[#111827] dark:text-white">{formatPrice(property.ListPrice)}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center space-x-1.5">
                <motion.button
                  whileTap={{ scale: 0.82 }}
                  aria-label="Messages"
                  onClick={(e) => { e.stopPropagation(); onCommentClick?.(property) }}
                  className={`relative rounded-lg p-1.5 transition-colors before:absolute before:-inset-1.5 before:content-[''] ${property.unreadCommentCount ? 'bg-[#C9A24D]/10 text-[#C9A24D]' : 'text-gray-300 hover:text-[#C9A24D]'}`}
                >
                  <MessageCircle size={18} fill={property.unreadCommentCount ? 'currentColor' : 'none'} />
                  {!!property.unreadCommentCount && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-white bg-[#C9A24D] px-0.5 text-[9px] font-black text-white dark:border-[#151517]">
                      {property.unreadCommentCount}
                    </span>
                  )}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.78 }}
                  aria-label={property.liked ? 'Loved' : 'Love it'}
                  aria-pressed={!!property.liked}
                  onClick={(e) => { e.stopPropagation(); if (property.id !== undefined) onLike?.(property.id, !property.liked) }}
                  className={`relative rounded-lg p-1.5 transition-colors before:absolute before:-inset-1.5 before:content-[''] ${property.liked ? 'bg-green-500/10 text-green-500' : 'text-gray-300 hover:text-green-500'}`}
                >
                  <motion.span key={property.liked ? 'on' : 'off'} initial={property.liked ? { scale: 0.3, rotate: -20 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 700, damping: 12 }} className="block">
                    <ThumbsUp size={18} fill={property.liked ? 'currentColor' : 'none'} />
                  </motion.span>
                </motion.button>
              </div>
            </div>

            <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-[#111827] dark:text-white" title={cleanAddress(property.FullStreetAddress, property.City)}>
              {cleanAddress(property.FullStreetAddress, property.City).split(',')[0]}
            </h3>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              <MapPin size={12} className="shrink-0 text-[#C9A24D]" />
              <span className="truncate">{[property.City ? String(property.City).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '', [property.StateOrProvince, property.PostalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {([
                [Bed, formatPropertyFeature(property.BedroomsTotal), 'Beds'],
                [Bath, formatPropertyFeature(property.BathroomsTotal), 'Baths'],
                [Square, formatPropertyFeature(property.LivingArea, true), 'Sq Ft'],
              ] as [typeof Bed, string, string][]).map(([Icon, value, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] font-bold text-gray-500 ring-1 ring-gray-100 dark:bg-white/[0.04] dark:text-gray-400 dark:ring-white/[0.06]">
                  <Icon size={13} className="shrink-0 text-[#C9A24D]" />
                  <span className="font-black text-[#111827] dark:text-white">{value}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {onMoveToSold && (
            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              {filed ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMoveToSold(property, false) }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-colors hover:bg-gray-50 hover:text-[#111827] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <Undo2 size={14} /> {property.disliked ? 'Move back to Disliked' : 'Move back to Matches'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMoveToSold(property, true) }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:bg-[#C9A24D] hover:shadow-lg active:scale-[0.97] dark:bg-white/10"
                >
                  <FolderInput size={14} /> Move to Sold/Removed
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => onPropertyClick?.(property)}
      className={`bg-white dark:bg-[#151517] rounded-2xl overflow-hidden border-2 transition-[border-color,box-shadow,transform] duration-300 ease-out flex flex-col h-full group hover:-translate-y-1 hover:border-[#C9A24D] dark:hover:border-[#C9A24D] hover:shadow-[0_24px_44px_-16px_rgba(0,0,0,0.22)] active:translate-y-0 active:scale-[0.99] cursor-pointer ${
        recommended ? 'border-[#C9A24D] shadow-[0_0_0_3px_rgba(201,162,77,.18),0_22px_44px_-20px_rgba(201,162,77,.75)]' : 'border-gray-200 dark:border-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
      } ${
        !available ? 'opacity-75' : ''
      }`}
    >
      {recommended && (
        <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#8b6a2b] via-[#C9A24D] to-[#8b6a2b] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#111827]">
          <Star size={13} className="fill-[#111827]" />
          {recommendedBy ? `${recommendedBy} recommends this home` : 'Your agent recommends this home'}
        </div>
      )}
      {/* 70% Height - Rectangle Image (Landscape) */}
      <div className="relative bg-gray-100 dark:bg-[#0B0B0B] aspect-video overflow-hidden flex-[7]">
        {property.ListPictureURL || cardPhotos.length ? (
          // Flip through the photos right on the card - swipe on a phone, arrows on a computer
          // (user, 10/27). Tapping still opens the home.
          <CardPhotoSwiper
            photos={cardPhotos.length ? cardPhotos : [normalizeImageUrl(property.ListPictureURL!)]}
            alt={property.FullStreetAddress}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            imgClassName="duration-700 ease-out group-hover:scale-[1.04]"
            dotsClassName={shortDistrict(property.SchoolDistrictName) ? 'bottom-11' : 'bottom-3'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-12 h-12 text-gray-300 dark:text-gray-800" />
          </div>
        )}

        {/* Top row: match score (left), DOM (right), and the open house tag centred in the space
            BETWEEN them - not the centre of the photo, where a wide badge could overlap it. The
            distance / directions moved off the photo into the details below (user, 10/15). */}
        <div className="absolute inset-x-3 top-3 z-10 flex items-start gap-2">
          <div className="flex shrink-0 flex-col items-stretch gap-2">
          {/* Same badge treatment as the Similar Properties picker (PropertyRecommendationCard) -
              rounded-full pill, text-xs, no border - not the smaller boxier style used elsewhere
              on this card. */}
          {typeof matchScore === 'number' && (
            <span className="rounded-full bg-emerald-600 px-2.5 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow-lg text-center">
              {matchScore}% Match
            </span>
          )}
          {!available && status && (
            <span className="bg-gray-900/90 text-white font-black px-2.5 py-1 rounded-lg text-[8px] uppercase tracking-widest border border-white/10 text-center">
              {formatStatus(status)}
            </span>
          )}
        </div>
          <div className="flex min-w-0 flex-1 justify-center">
            {nextOpenHouse && (
              <span title={upcomingOpenHouses(property.open_houses).map(oh => `Open house: ${formatOpenHouse(oh)}`).join('\n')}
                className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white shadow-lg ring-1 ring-white/25">
                <span aria-hidden className="relative flex h-1.5 w-1.5 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
                <span className="truncate">Open House {formatOpenHouseDay(nextOpenHouse.date, true)}</span>
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Days on Market */}
          {property.DaysOnMarket !== undefined && property.DaysOnMarket !== null && (
            <span className="bg-white/90 dark:bg-[#151517]/90 text-[#111827] dark:text-white font-bold px-2.5 py-1.5 rounded-lg text-[9px] uppercase tracking-wider shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-1">
              <span className="text-xs font-black text-[#C9A24D]">{property.DaysOnMarket}</span>
              <span>DOM</span>
            </span>
          )}

        </div>
        </div>

        {/* Interaction Indicators (Bottom Right) */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex gap-1.5">
          {isViewed && (
            <div className="bg-[#111827]/90 text-white px-2.5 py-1 rounded-lg border border-white/10 flex items-center space-x-1.5 shadow-xl">
              <Eye size={10} className="text-[#C9A24D]" />
              <span className="text-[9px] font-black uppercase tracking-widest">
                {showDetailedViewCount ? `${property.viewCount} Views` : 'Viewed'}
              </span>
            </div>
          )}
          {interactionCounts.liked > 0 && (
            <div className="bg-green-500/90 text-white p-1.5 rounded-lg border border-white/10 shadow-xl">
              <ThumbsUp size={10} fill="currentColor" />
            </div>
          )}
        </div>

        {/* School District - bottom-center of the photo itself, in a soft rounded pill so it
            stays readable over any photo underneath. */}
        {shortDistrict(property.SchoolDistrictName) && (
          <div className={`pointer-events-none absolute bottom-3 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-[#111827]/75 px-3 py-1 shadow-lg ${
            isViewed || interactionCounts.liked > 0 ? 'left-3 max-w-[calc(100%-8rem)]' : 'left-1/2 max-w-[75%] -translate-x-1/2'
          }`}>
            <School size={12} className="shrink-0 text-[#C9A24D]" />
            <span className="truncate text-[11px] font-bold text-white" title={property.SchoolDistrictName}>
              {shortDistrict(property.SchoolDistrictName)}
            </span>
          </div>
        )}
      </div>

      {/* 30% Height - Details Section */}
      <div className="p-4 flex flex-col flex-[3] justify-between">
        <div>
          <div className="flex justify-between items-center gap-2 mb-1">
            {/* Wraps instead of sliding under the buttons: on a narrow phone card a long price +
                "New" used to run beneath the star (user, 10/24). */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="shrink-0 text-lg font-black text-[#111827] dark:text-white tracking-tight leading-none group-hover:text-[#C9A24D] transition-colors">
                {formatPrice(property.ListPrice)}
              </span>
              {/* Moved off the photo (was a flashing badge there - distracting) and next to the
                  price instead, since the match score badge already owns the photo's top-left
                  corner. No animation - a still pill draws the eye without being annoying. */}
              {/* A recent price change sits by the price (it's about the price), in the same green
                  pill as the open house tag; otherwise "New". The open house lives on the photo. */}
              {isRecentPriceChange ? (
                <span title={`Price changed ${new Date(property.PriceChangeTimestamp as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-sm">
                  <span aria-hidden className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
                  Price change
                </span>
              ) : (showNewForUnviewed ? !isViewed && property.is_new !== false : property.is_new) && (
                <span className="bg-green-500 text-white font-black px-2 py-1 rounded-full text-[9px] uppercase tracking-widest shadow-sm">
                  New
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center space-x-1.5">
              {onRecommend && (
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  whileHover={{ y: -1 }}
                  title={recommended ? 'You recommend this home - tap to take it back' : 'Recommend this home to your client'}
                  aria-label={recommended ? 'Recommended' : 'Recommend this home'}
                  aria-pressed={recommended}
                  onClick={(e) => { e.stopPropagation(); onRecommend(property) }}
                  className={`relative p-1.5 rounded-lg transition-colors before:absolute before:-inset-1.5 before:content-[''] ${recommended ? 'text-[#C9A24D] bg-[#C9A24D]/15' : 'text-gray-300 hover:text-[#C9A24D]'}`}
                >
                  <motion.span key={recommended ? 'on' : 'off'} initial={recommended ? { scale: 0.3, rotate: -30 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 700, damping: 12 }} className="block">
                    <Star size={18} fill={recommended ? 'currentColor' : 'none'} />
                  </motion.span>
                </motion.button>
              )}
              {/* Message button - always visible; only highlighted while there's an unread
                  reply from the other side, and dims back down once it's actually been read */}
              <motion.button
                whileTap={{ scale: 0.82 }}
                whileHover={{ y: -1 }}
                aria-label="Messages"
                onClick={(e) => {
                  e.stopPropagation();
                  onCommentClick?.(property);
                }}
                className={`relative p-1.5 rounded-lg transition-colors before:absolute before:-inset-1.5 before:content-[''] ${
                  property.unreadCommentCount && property.unreadCommentCount > 0
                    ? 'text-[#C9A24D] bg-[#C9A24D]/10'
                    : 'text-gray-300 hover:text-[#C9A24D]'
                }`}
              >
                <MessageCircle size={18} fill={property.unreadCommentCount && property.unreadCommentCount > 0 ? 'currentColor' : 'none'} />
                {property.unreadCommentCount !== undefined && property.unreadCommentCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-[#C9A24D] text-white text-[9px] font-black rounded-full border-2 border-white dark:border-[#151517]">
                    {property.unreadCommentCount}
                  </span>
                )}
              </motion.button>

              <div className="w-px h-4 bg-gray-200 dark:bg-gray-800" />

              {/* Interaction Actions */}
              <motion.button
                whileTap={{ scale: 0.78 }}
                whileHover={{ y: -1 }}
                aria-label={property.liked ? 'Loved' : 'Love it'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (property.id !== undefined) {
                    onLike?.(property.id, !property.liked);
                  }
                }}
                className={`relative p-1.5 rounded-lg transition-colors before:absolute before:-inset-1.5 before:content-[''] ${
                  property.liked
                    ? 'text-green-500 bg-green-500/10'
                    : 'text-gray-300 hover:text-green-500'
                }`}
              >
                <motion.span key={property.liked ? 'on' : 'off'} initial={property.liked ? { scale: 0.3, rotate: -20 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 700, damping: 12 }} className="block">
                  <ThumbsUp size={18} fill={property.liked ? "currentColor" : "none"} />
                </motion.span>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.78 }}
                whileHover={{ y: -1 }}
                aria-label={property.disliked ? 'Passed' : 'Pass'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (property.id !== undefined) {
                    onDislike?.(property.id, !property.disliked);
                  }
                }}
                className={`relative p-1.5 rounded-lg transition-colors before:absolute before:-inset-1.5 before:content-[''] ${
                  property.disliked
                    ? 'text-red-500 bg-red-500/10'
                    : 'text-gray-300 hover:text-red-500'
                }`}
              >
                <motion.span key={property.disliked ? 'on' : 'off'} initial={property.disliked ? { scale: 0.3, rotate: 20 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 700, damping: 12 }} className="block">
                  <ThumbsDown size={18} fill={property.disliked ? "currentColor" : "none"} />
                </motion.span>
              </motion.button>

              {/* Status Indicators */}
              {!onScheduleTour && property.tourCount !== undefined && property.tourCount > 0 && (
                <>
                  <div className="w-px h-3 bg-gray-200 dark:bg-gray-800 mx-1" />
                  <div className="flex items-center text-[#111827] dark:text-white">
                    <Calendar size={12} />
                    <span className="text-[10px] font-black ml-1">{property.tourCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-[#111827] dark:text-white" title={cleanAddress(property.FullStreetAddress, property.City)}>
            {cleanAddress(property.FullStreetAddress, property.City).split(',')[0]}
          </h3>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
            <MapPin size={12} className="shrink-0 text-[#C9A24D]" />
            <span className="truncate">{[property.City ? String(property.City).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '', [property.StateOrProvince, property.PostalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
            {distanceMiles !== null && (directionsUrl ? (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Get directions in Google Maps"
                className="relative ml-auto inline-flex shrink-0 items-center gap-1 rounded-full before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] border border-gray-200 px-2 py-0.5 text-[10px] font-black text-[#8b7355] transition-colors hover:border-[#C9A24D] dark:border-gray-700 dark:text-[#e8cf8a]">
                <Navigation size={10} /> {distanceMiles.toFixed(1)} mi
              </a>
            ) : (
              <span className="ml-auto shrink-0 text-[10px] font-black text-gray-400">{distanceMiles.toFixed(1)} mi away</span>
            ))}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {([
              [Bed, formatPropertyFeature(property.BedroomsTotal), 'Beds'],
              [Bath, formatPropertyFeature(property.BathroomsTotal), 'Baths'],
              [Square, formatPropertyFeature(property.LivingArea, true), 'Sq Ft'],
              ...(property.LotSizeAcres ? [[Trees, property.LotSizeAcres.toFixed(property.LotSizeAcres < 1 ? 2 : 1), 'Acres']] : []),
            ] as [typeof Bed, string, string][]).map(([Icon, value, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-1.5 text-[11px] font-bold text-gray-500 ring-1 ring-gray-100 dark:bg-white/[0.04] dark:text-gray-400 dark:ring-white/[0.06]">
                <Icon size={13} className="shrink-0 text-[#C9A24D]" />
                <span className="font-black text-[#111827] dark:text-white">{value}</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          {/* Both actions when a tour handler is given - Tour used to replace View Details
              outright, but the card is still clickable through to details either way, so hiding
              the explicit button just made it less discoverable for no reason. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPropertyClick?.(property);
            }}
            className={`py-3 bg-gray-900 dark:bg-white/10 text-white dark:text-white hover:bg-[#C9A24D] dark:hover:bg-[#C9A24D] rounded-xl text-[10px] font-black uppercase tracking-widest transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97] ${onScheduleTour ? 'flex-1' : 'w-full'}`}
          >
             View Details
          </button>
          {onScheduleTour && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onScheduleTour?.(property);
              }}
              className={`relative flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-[background-color,color,box-shadow,transform] duration-200 hover:-translate-y-0.5 active:scale-[0.97] ${
                property.tourStatus === 'confirmed' || property.tourStatus === 'done'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                  : property.hasTourScheduled
                  ? 'bg-amber-400 text-[#111827] shadow-lg shadow-amber-400/25'
                  : 'bg-[#C9A24D]/15 text-[#8b7355] dark:text-[#e8cf8a] hover:bg-[#C9A24D] hover:text-white hover:shadow-lg'
              }`}
            >
              {tourButtonVariant === 'requests' ? 'Tour Requests' : property.tourStatus === 'confirmed' ? 'Confirmed' : property.tourStatus === 'done' ? 'Toured' : property.hasTourScheduled ? 'Pending' : 'Tour'}
              {tourButtonVariant === 'requests' && !!property.tourCount && (
                <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white border-2 border-white dark:border-[#151517]">
                  {property.tourCount > 9 ? '9+' : property.tourCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default PropertyCard
