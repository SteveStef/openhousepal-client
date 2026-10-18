import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  Svg,
  Path,
  Circle,
  pdf,
} from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { normalizeImageUrl } from '@/lib/utils';
import { buildCheatSheetContent, cityFromAddress, formatCurrencyCompact, truncateAtCleanSentence, type AmenityPlace, type CheatSheetAmenities, type CheatSheetPhoto } from '@/lib/cheatSheetContent';
import { fitBio } from '@/lib/agentBio';
import { CmaComparable, CmaFinalStatus, CmaReport, CmaSubjectProperty } from '@/types';

// @react-pdf/renderer's <Image> fetches its own src directly from the browser at PDF-generation
// time, with no fallback if that request is blocked or fails - and a script-driven fetch()/XHR to
// a remote CDN/S3 host is exactly the kind of request an ad blocker or privacy extension is prone
// to block, even though the same URL displays fine everywhere else in the app as a plain <img>.
// Routing it through this app's own same-origin /api/pdf-image proxy (which fetches the image
// server-side, no browser involved) sidesteps that entirely - this used to be CMA-only
// (cmaPdfImageUrl below), but the exact same failure mode applies to every remote image in every
// PDF here, so it's now the shared, general-purpose way to resolve any image src in this file.
function pdfImageUrl(url?: string | null): string {
  const normalized = normalizeImageUrl(url || undefined);
  if (!normalized || normalized.startsWith('data:') || normalized.startsWith('blob:')) return normalized;
  if (typeof window === 'undefined') return normalized;
  return `${window.location.origin}/api/pdf-image?url=${encodeURIComponent(normalized)}`;
}
import { CmaGuidanceSection, buildCmaStaticMapUrl, clientCompStrength, cmaGuidanceSections, resolveCmaMarketMetrics, formatAcresFromSqft, formatCompactMoneyRange, formatDate, formatMlsStatusLabel, formatMoney, formatMoneyRange, formatNumber, pricePerSqft, sortComparables, splitCmaBuyerGuidance, AREA_TIERS, COMP_STATUS_HEX, COMP_STATUS_LABEL, QUALITY_LABELS, QUALITY_TIER_HEX, STRENGTH_LABEL, STRENGTH_TIER_HEX, compDisplayPrice, effectiveCompPrice } from '@/lib/cma';
import { qrPdfSrc } from '@/lib/qr';
import { salesAreRecent, salesWords } from '@/lib/salesWording'

// 1. Register Fonts
Font.registerHyphenationCallback(word => [word]);

// Only the regular weight was ever registered here before - every fontWeight: 700/900 across
// this entire file was silently falling back to the regular face (no bold face registered for
// that weight), which is why text kept reading as "thin" no matter how bold the style said it
// was. Registering explicit 700/900 files fixes every bold declaration in this file at once, not
// just the Similar Homes cards.
Font.register({
  family: 'Montserrat',
  fonts: [
    { src: '/fonts/montserrat-v31-latin-regular.ttf', fontWeight: 400 },
    { src: '/fonts/montserrat-v31-latin-700.woff', fontWeight: 700 },
    { src: '/fonts/montserrat-v31-latin-900.ttf', fontWeight: 900 },
    // Italic (400) - registered so the Similar Homes header's address line can actually render
    // italic; without a real italic face react-pdf silently falls back to upright.
    { src: '/fonts/montserrat-v31-latin-italic.woff', fontWeight: 400, fontStyle: 'italic' },
  ],
});
Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: '/fonts/playfair-display-v40-latin-regular.ttf', fontWeight: 400 },
    { src: '/fonts/playfair-display-v40-latin-700.woff', fontWeight: 700 },
    // Black weight, added so the Similar Homes price can actually go bolder than 700 - before
    // this, asking for fontWeight 900 on Playfair Display silently fell back to the regular face
    // (no 900 was registered), which read as thinner, not bolder.
    { src: '/fonts/playfair-display-v40-latin-900.ttf', fontWeight: 900 },
  ],
});

const COLORS = {
  text: '#111827',
  subtext: '#6B7280',
  muted: '#9CA3AF',
  line: '#E5E7EB',
  panel: '#F8F7F4',
  white: '#FFFFFF',
  border: '#E7E5E4',
  accent: '#8b7355',
};

// Sign-In flyer's warm, print-light palette (solid hex only - react-pdf paints translucent border
// colors green).
const FLYER_WARM = {
  border: '#E6DDCF',
  divider: '#EEE7DC',
  cream: '#FAF6EF',
  panel: '#FBF9F5',
  deep: '#6B5740',
};

// Sign-In flyer's side margin. Agents slide the sheet into a stand holder that hides its edges, so
// the QR panel's gap to the right edge and the left column's start use this same distance. The
// bottom margin is deeper - the holder's lip covers more of the bottom - and the hero photo is
// kept short enough to leave the content (and a large QR) room above it.
const FLYER_INSET = 34;
const FLYER_BOTTOM = 54;
const FLYER_HERO_H = 330;

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: COLORS.line, width: '100%', marginVertical: 12 },
  label: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 2, color: COLORS.muted, marginBottom: 6 },

  // flyer - deliberately spare: no boxes/pills around the details or price, just typographic
  // hierarchy and thin rules, so it reads as a commanding luxury one-pager rather than a form.
  flyerPage: { flexDirection: 'column', backgroundColor: COLORS.white, fontFamily: 'Montserrat' },
  // Taller hero (was 286) - the photo is the page's star; objectFit cover trims more of the sides.
  heroSection: { height: FLYER_HERO_H, width: '100%', position: 'relative', overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%', objectFit: 'cover' },
  // Sign-In flyer only: the photo is drawn oversized (zoomed in ~12%) and clipped by the hero, with
  // the extra trimmed mostly off the bottom + left - where MLS photo tags ("Bright MLS") are stamped.
  flyerCoverImage: { position: 'absolute', top: '-4%', left: '-8%', width: '112%', height: '114%', objectFit: 'cover' },
  heroOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(17,24,39,0.12)' },

  // Left column: identity block up top (eyebrow -> address -> city), a hairline, the facts on
  // one line, then the price anchored to the bottom edge with its own rule. Per-element
  // margins set the rhythm - no forced even spread.
  flyerContent: { flexDirection: 'row', paddingHorizontal: FLYER_INSET, paddingTop: 16, paddingBottom: FLYER_BOTTOM, gap: 30, height: 792 - FLYER_HERO_H },
  // paddingBottom lifts the address, stats and price above the QR panel's bottom edge; "Open House"
  // stays put at the top.
  leftCol: { flex: 1.85, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingBottom: 12 },

  addressBlock: { marginTop: 0, width: '100%', display: 'flex', flexDirection: 'column' },
  welcomeLabel: { fontSize: 11, fontFamily: 'Playfair Display', textTransform: 'uppercase', letterSpacing: 4, color: COLORS.muted, marginBottom: 3 },
  mainHeading: { fontSize: 34, fontFamily: 'Playfair Display', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  // One eyebrow only - a short brass rule + the event name - then the address AS the headline.
  // On a property flyer the street is what should be large, not the words "Open House".
  flyerEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 22 },
  flyerEyebrowRule: { width: 22, height: 2, backgroundColor: COLORS.accent, borderRadius: 1 },
  flyerEyebrow: { fontSize: 9, fontFamily: 'Montserrat', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 3.2, color: COLORS.accent },
  // The headline. Playfair, large; a long street wraps, which is fine for a hero line.
  addressText: { fontSize: 21, fontFamily: 'Playfair Display', fontWeight: 700, lineHeight: 1.15, color: COLORS.text, hyphens: 'none' },
  // "Open House" is the headline - large black display type on the column's left edge, address as a
  // big second line under it (no brass rule between - it read as a stray mark).
  flyerOpenHouse: { fontSize: 48, fontFamily: 'Playfair Display', fontWeight: 700, lineHeight: 1.05, color: '#0B0B0B' },
  // Same hairline as the one above the price, splitting the headline from the address.
  flyerHeadlineRule: { height: 1, width: '100%', backgroundColor: FLYER_WARM.border, marginTop: 14, marginBottom: 16 },
  // Address + city + fact card sit low in the free space between the headline and the price: the
  // spacer above takes all of it, with a fixed short gap before the price - closes up when a long
  // two-line address needs the room, so the page never spills over.
  flyerMidGroup: {},
  flyerSpacerAbove: { flexGrow: 1 },
  flyerSpacerBelow: { height: 28 },
  flyerAddressBig: { fontSize: 34, fontFamily: 'Playfair Display', fontWeight: 700, lineHeight: 1.12, color: COLORS.text, hyphens: 'none' },
  // Beds / baths / sq ft as matching tiles, then one full-width centered school-district bar.
  // Stats + school district as ONE light "fact card" - a warm hairline frame, the three stats split
  // by thin vertical rules, and the school district as a cream strip along its bottom. Built for
  // print: hairlines and pale fills only, no solid dark blocks eating toner.
  flyerFactCard: { marginTop: 24, borderWidth: 1, borderColor: FLYER_WARM.border, borderStyle: 'solid', borderRadius: 12 },
  flyerFactRow: { flexDirection: 'row' },
  flyerFactCell: { flex: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 11 },
  flyerFactDivider: { width: 1, backgroundColor: FLYER_WARM.divider, marginVertical: 12 },
  flyerStatIcon: { marginBottom: 5 },
  flyerStatValue: { fontSize: 21, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text },
  flyerStatLabel: { fontSize: 6.5, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.8, marginTop: 3 },
  flyerSchoolStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: 1, borderTopColor: FLYER_WARM.divider, borderTopStyle: 'solid', backgroundColor: FLYER_WARM.cream, borderBottomLeftRadius: 11, borderBottomRightRadius: 11, paddingVertical: 8, paddingHorizontal: 12 },
  flyerSchoolText: { fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: FLYER_WARM.deep, textTransform: 'uppercase', letterSpacing: 1.8, textAlign: 'center', flexShrink: 1 },
  // Very long district names wrap to two centered lines; extra right padding equal to the icon +
  // gap keeps those lines on the strip's true center instead of shifted right by the icon.
  flyerSchoolStripBalanced: { paddingRight: 12 + 12 + 7 },
  // Brand upgrade: the SAME hosting-agent pill the on-screen Sign-In kiosk floats over its photo
  // (black/40 glass, white/20 hairline, gold-ringed headshot, heavy serif name, caps brokerage),
  // pinned bottom-left of the print's photo, sitting close to the photo's bottom edge.
  flyerBrandWrap: { position: 'absolute', bottom: 15, left: 30 },
  // react-pdf paints any translucent border color (rgba / 8-digit hex) solid green, so the white/20
  // hairline is a 1pt translucent-white ring (outer View) around the black glass (inner View).
  flyerBrandRing: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: 1 },
  flyerBrandPill: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 18 },
  flyerBrandPhoto: { width: 34, height: 34, borderRadius: 17, border: '2 solid #C9A24D', objectFit: 'cover' },
  flyerBrandInitialsWrap: { backgroundColor: '#C9A24D', alignItems: 'center', justifyContent: 'center' },
  flyerBrandInitials: { fontSize: 12, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.white },
  flyerBrandName: { fontSize: 15, fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.white, lineHeight: 1.15 },
  flyerBrandBrokerage: { fontSize: 7.5, fontFamily: 'Montserrat', fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },
  // City + state directly beneath, quiet - gentle tracking, not the old wide-spread caps.
  addressCityText: { fontSize: 9, fontFamily: 'Montserrat', fontWeight: 600, color: COLORS.accent, marginTop: 6, textTransform: 'uppercase', letterSpacing: 2.4 },
  // Short accent bar under the address instead of a full-width rule or a box.
  addressRule: { height: 2, width: 46, backgroundColor: COLORS.accent, borderRadius: 1, marginTop: 14 },
  // Full-width hairline that carries the eye from the address down to the facts.
  flyerRule: { height: 1, width: '100%', backgroundColor: COLORS.line, marginTop: 24, marginBottom: 24 },

  // The wide-tracked caps section labels ("PROPERTY ADDRESS", "PROPERTY DETAILS", "LISTING
  // PRICE") - opened up so they read as spaced small-caps, not cramped text.
  flyerCapLabel: { letterSpacing: 3.4, marginBottom: 9 },
  detailsTitle: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3.4, color: COLORS.muted, marginBottom: 14 },

  // No container and no dividers - the three stats sit left-aligned on the same left edge as
  // the address and the price above/below them (not centered across the column). Each is the
  // number, with its icon + word sitting together on the line beneath it.
  statsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 30 },
  statItem: { alignItems: 'flex-start' },
  statValue: { fontSize: 23, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text },
  statMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statIcon: { opacity: 0.7 },
  statLabel: { fontSize: 7.5, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.4 },

  // Facts on a single line - [icon] bold number + light word, three times - instead of a
  // "Property Details" label sitting over three big centered stat columns.
  detailsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 22 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailIcon: { opacity: 0.62 },
  detailNumber: { fontSize: 13.5, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text },
  detailWord: { fontSize: 8, fontFamily: 'Montserrat', fontWeight: 400, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.4 },

  // Price anchored to the bottom of the column (marginTop auto) with its own hairline above -
  // large figure in Montserrat, since Playfair is reserved for the address.
  priceBlock: { display: 'flex', flexDirection: 'column', paddingTop: 13, borderTopWidth: 1, borderTopColor: FLYER_WARM.border, borderTopStyle: 'solid' },
  priceLabel: { fontSize: 8, fontFamily: 'Montserrat', fontWeight: 600, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 6 },
  // Negative bottom margin drops the figure's baseline (not its empty descender space) onto the
  // column's bottom edge, so the price's visible bottom is measured from its digits.
  priceValue: { fontSize: 30, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text, marginBottom: -4 },

  rightCol: { flex: 1, backgroundColor: FLYER_WARM.panel, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: FLYER_WARM.border, borderStyle: 'solid', alignItems: 'center', justifyContent: 'flex-start' },
  qrHeader: { fontSize: 18, fontWeight: 700, marginTop: 5, marginBottom: 8, color: COLORS.text },
  qrDescription: { fontSize: 9, color: COLORS.subtext, textAlign: 'center', lineHeight: 1.4, paddingHorizontal: 8 },
  qrContainer: { backgroundColor: 'white', padding: 9, borderRadius: 12, border: `1 solid ${COLORS.line}`, marginTop: 16 },
  // Fills the space under the QR card and centers "Quick & Easy" in it. The negative bottom margin
  // cancels rightCol's 20pt padding so that space runs to the panel's actual bottom edge.
  qrFooterWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%', marginBottom: -20 },
  quickEasyText: { fontSize: 9, color: COLORS.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 },
  secondsText: { fontSize: 8, color: COLORS.muted, marginTop: 3 },

  // Recommendation styles
  recPage: {
    paddingHorizontal: 35,
    paddingVertical: 35,
    backgroundColor: COLORS.white,
    fontFamily: 'Montserrat',
    flexDirection: 'column',
    minHeight: '100%'
  },
  // Single line: title + "based on: {address}" + page number all together, with just a thin
  // rule underneath - the old two-line/20px-margin block ate space the footer needed to fit on
  // page 1.
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 7,
    borderBottom: `1.5 solid ${COLORS.accent}`,
    paddingBottom: 5
  },
  // "Similar Homes To:" label - Montserrat (same family as the card price / match / DOM text, per
  // direct feedback that this line shouldn't be in a different font from the rest of the sheet).
  recHeaderTitle: { fontSize: 13, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text },
  // The address itself: same size, but not bold and italic, so it reads as the subject of the
  // label rather than competing with it. Carries the state now too.
  recHeaderSubject: { fontFamily: 'Montserrat', fontSize: 13, fontWeight: 400, fontStyle: 'italic', color: COLORS.text },
  // "Want to see more like this?" CTA - last page only, pinned to the bottom via marginTop:
  // 'auto' on the flex-column recPage above. Compact (small QR, tight padding) so it reliably
  // fits under a full 6-card grid on page 1 instead of pushing a near-empty page 2 - the longer
  // 3-line subtitle needed trimming padding elsewhere on the page to still clear that bar.
  recFooter: { marginTop: 'auto', paddingTop: 6 },
  recFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.panel, borderRadius: 12, border: `1 solid ${COLORS.border}`, padding: 7 },
  recFooterQr: { width: 42, height: 42, borderRadius: 5, border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.white },
  recFooterTextWrap: { flex: 1 },
  recFooterEyebrow: { fontSize: 6, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 1 },
  recFooterTitle: { fontSize: 9.5, fontWeight: 700, color: COLORS.text },
  recFooterSubtitle: { fontSize: 6.2, lineHeight: 1.25, color: COLORS.subtext, marginTop: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  // Faithful to the reference: a hint of photo at the very top, then a dark panel covering most
  // of the card (photo still visible through it, not opaque) holding a big bold price, bold caps
  // address, muted caps city/state, a thin divider, and a 4-column stat grid (bold number over a
  // tiny muted label) - QR sits bottom-right as its own small badge, not a 5th stat column.
  // Photo (cardPhotoWrap) stays the same size it always was; stats moved off it entirely into
  // their own strip below (cardStatsSection) - there's headroom at the bottom of each card (and
  // the page has room before recFooter), so stats no longer have to compete with price/address
  // for the same cramped overlay space.
  card: {
    width: '48.5%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 3,
    backgroundColor: COLORS.white,
    position: 'relative',
  },
  // overflow: hidden of its own (not just relying on the outer card's) - cardImage is
  // deliberately oversized below, and without this the oversized bottom edge would bleed down
  // into cardStatsSection instead of getting clipped right at the photo's own bounds.
  cardPhotoWrap: { height: 172, position: 'relative', overflow: 'hidden' },
  // Sized to 110%/centered via negative insets rather than a CSS transform: scale - react-pdf's
  // style support has no `transform` property at all (checked its full type definitions), so this
  // is the only way to zoom a photo in react-pdf. A ~10% zoom crops a slice off all four edges,
  // which is what's actually pushing Bright MLS's watermark (bottom-left of the source photo)
  // outside the visible frame, not any per-photo cropping logic. Bumped from 5% - that only got it
  // about halfway cropped out, still leaving a sliver visible on some photos.
  cardImage: {
    position: 'absolute',
    top: '-5%',
    left: '-5%',
    width: '110%',
    height: '110%',
    objectFit: 'cover'
  },
  // Solid, not translucent - a see-through badge was letting busy photos underneath muddy the
  // green and made the score harder to read at a glance. Text ~20% larger than before (6.5 -> 7.8)
  // with a bit more padding to match - direct feedback that the match score / DOM read too small.
  cardMatchBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#059669', borderRadius: 20, paddingVertical: 3.5, paddingHorizontal: 8 },
  cardMatchBadgeText: { fontSize: 7.8, fontFamily: 'Montserrat', fontWeight: 900, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.3 },
  // Days on market - mirrors cardMatchBadge but top-right instead of top-left, so the two don't
  // collide when both are showing.
  cardDomBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#4B5563', borderRadius: 20, paddingVertical: 3.5, paddingHorizontal: 8 },
  cardDomBadgeText: { fontSize: 7.8, fontFamily: 'Montserrat', fontWeight: 900, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.3 },
  // No chip/box and no letter-outline anymore - the price/address sit as plain white text on a
  // soft bottom-up photo fade (PhotoBottomScrim), the same "barely there" gradient the Open House
  // cards use for their city label. That scrim is what carries legibility now, so the text itself
  // can drop back to a clean, un-bolded weight instead of the old stacked-stroke treatment that
  // read as a doubled/"fonky" font.
  // maxWidth pulled in from 76% -> 58% so the (now single-line) address can never run under the
  // QR badge that sits bottom-right of the card - see fitAddressLine, which also drops the state
  // then the city as the text gets longer rather than letting it wrap or shrink to nothing.
  cardTextGroup: { position: 'absolute', left: 0, bottom: 0, maxWidth: '58%', paddingLeft: 8, paddingBottom: 7 },
  // Bold again, just not the old Black (900) - 700 over the bottom scrim reads as a confident
  // price without the doubled/"fonky" look the stacked outline gave it.
  cardPriceOnPhoto: { fontSize: 17, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.white },
  // One line (street + city, collapsed by fitAddressLine, no state); the fontSize is set inline
  // per card from the final string length. 700 (not 900).
  cardAddressOnPhoto: { fontSize: 8, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.2, marginTop: 2 },
  cardCityOnPhoto: { fontSize: 7.5, fontWeight: 700, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 },
  // Light panel (COLORS.panel, same warm off-white used for panels elsewhere in this doc), not a
  // dark fill - by far the biggest-area element on the card (full width x 6 cards/page), so this
  // is where print ink use actually adds up. Dark text instead of white now that the background's
  // light. Columns no longer flex:1-stretched across the full row - sized to their own content and
  // clustered together on the left (gap, no flex) instead of spread edge to edge. Taller than
  // before to give the bigger cardQrBadge below room to still land its center right on this
  // strip's top edge.
  cardStatsSection: { height: 34, backgroundColor: COLORS.panel, justifyContent: 'center', borderTop: `1 solid ${COLORS.border}` },
  // No school district column anymore (dropped - see PropertyPDFCard), so the 6 remaining columns
  // no longer need to be packed tight/clipped to leave it room. maxWidth capped just short of
  // where the QR badge starts (not overflow:hidden - with only 6 short values there's no longer
  // any realistic way for this row to actually reach that width) so they spread out and use the
  // freed-up space instead of clustering on the left.
  cardStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, maxWidth: 195 },
  cardStatCol: { alignItems: 'center' },
  // Bigger now that there's real room for it (8 -> 10.5 / 3.6 -> 4.4) - 700, not 900, so it still
  // reads calmer than the price rather than shouting as loud.
  cardStatValue: { fontSize: 10.5, fontWeight: 700, color: COLORS.text },
  cardStatLabel: { fontSize: 4.4, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1 },
  // Half on the photo, half on the stats strip below it - positioned on the outer card (not
  // inside either the photo or the strip) with a bottom offset of stripHeight minus half the
  // badge's own total height (header bar + QR), so its vertical center lands on the seam between
  // the two. Bigger than before, and carries its own "View Details" header bar so it's clear what
  // scanning it does instead of just being an unlabeled code. Header text bumped up from 3.6 to
  // 5.5 - anything under ~5pt in a PDF reads as blurry/fuzzy at normal viewing and print
  // resolution, it's not enough pixels for the hinting to look crisp.
  // No border - a light-grey border was invisible against the white QR section below but showed
  // up as a stray light line around the tan header bar's top/sides, where the contrast against it
  // is much more visible.
  cardQrBadge: { position: 'absolute', bottom: 1, right: 6, width: 54, backgroundColor: COLORS.white, borderRadius: 6, overflow: 'hidden' },
  cardQrHeaderBar: { backgroundColor: COLORS.accent, paddingVertical: 2.5, alignItems: 'center' },
  cardQrHeaderText: { fontSize: 5.5, fontWeight: 900, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.2 },
  cardQrImageBox: { padding: 3, alignItems: 'center' },
  cardQrImage: { width: 48, height: 48 },

  // Agent Brag Sheet + Open House Cheat Sheet (shared)
  sheetPage: { paddingHorizontal: 35, paddingVertical: 35, backgroundColor: COLORS.white, fontFamily: 'Montserrat' },
  sheetHeading: { fontSize: 22, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, marginBottom: 4 },
  sheetSubheading: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.muted, marginBottom: 16 },

  backHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  backHeaderPrice: { fontSize: 19, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.accent, marginBottom: 16 },

  agentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, paddingBottom: 20, borderBottom: `1 solid ${COLORS.line}` },
  agentHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  agentPhoto: { width: 72, height: 72, borderRadius: 36, objectFit: 'cover', border: `1 solid ${COLORS.border}` },
  agentPhotoPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.panel, border: `1 solid ${COLORS.border}`, alignItems: 'center', justifyContent: 'center' },
  agentPhotoInitials: { fontSize: 22, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.accent },
  agentName: { fontSize: 20, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text },
  agentSubline: { fontSize: 9, color: COLORS.subtext, marginTop: 3 },

  // Real estate stats (Sold / Volume / Avg) - top-right of the sheet, beside the agent header
  topStatsWrap: { flexShrink: 0, alignItems: 'center', alignSelf: 'flex-start' },
  topStatsEyebrow: { fontSize: 6, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6, textAlign: 'center' },
  topStatsCluster: { flexDirection: 'row', gap: 8 },
  topStatPill: { alignItems: 'center', backgroundColor: COLORS.panel, borderRadius: 12, border: `1 solid ${COLORS.border}`, paddingVertical: 9, paddingHorizontal: 12, minWidth: 54 },
  topStatValue: { fontSize: 14, fontWeight: 900, color: COLORS.text },
  topStatLabel: { fontSize: 5.5, color: COLORS.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 3 },

  bioText: { fontSize: 9, lineHeight: 1.6, color: COLORS.subtext, marginBottom: 20 },

  salesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  saleTile: { width: '31.5%', borderRadius: 8, border: `1 solid ${COLORS.line}`, overflow: 'hidden', marginBottom: 9, backgroundColor: COLORS.white },
  // Taller than before (86 -> 100) to sit closer to a real Bright MLS photo's native ~4:3 ratio at
  // this tile width - the old, shorter box was closer to 2:1, which read as an overly-wide crop
  // through the middle of the photo rather than the actual framing. City label moved off the dark
  // pill onto a stroke-outlined text directly on the photo (same technique as the Similar Homes
  // cards) - a plain rounded badge read as a heavier, less refined treatment than the rest of the
  // sheet now uses.
  saleTileImageWrap: { position: 'relative', width: '100%', height: 100 },
  saleTileImage: { width: '100%', height: '100%', objectFit: 'cover' },
  // City now sits in its own rounded, semi-opaque dark chip on the photo (not bare white text) so
  // it's legible against any photo - direct feedback asked for "a rounded rectangle to better see
  // the city". The row is just the centering track; the chip is what carries the fill.
  saleTileCityRow: { position: 'absolute', bottom: 5, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saleTileCityPill: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '92%', backgroundColor: 'rgba(17,24,39,0.72)', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 6 },
  saleTileCityText: { fontSize: 7.5, fontWeight: 700, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.4 },
  saleTileBody: { padding: 5 },
  // Montserrat (same family as every other number on this kit's sheets now) and only medium
  // weight - direct feedback that the old Playfair-black price read as a different, heavier font
  // than the rest. Price leads, address (street + city if it fits) underneath.
  saleTilePrice: { fontSize: 12.5, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text },
  saleTileAddress: { fontSize: 7.5, fontWeight: 400, color: COLORS.subtext, marginTop: 1 },

  adHeading: { fontSize: 26, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, textAlign: 'center', marginBottom: 6 },
  adSubheading: { fontSize: 10, color: COLORS.subtext, textAlign: 'center', marginBottom: 20, paddingHorizontal: 30, lineHeight: 1.5 },

  // Static mockup of the Showcase experience (like/dislike, tour request, comments) - illustrates
  // the pitch visually instead of relying on text bullets alone.
  mockupCol: { width: 208, flexShrink: 0 },
  mockupCard: { borderRadius: 14, border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.white, overflow: 'hidden' },
  mockupPhotoWrap: { position: 'relative', height: 118, backgroundColor: COLORS.panel, alignItems: 'center', justifyContent: 'center' },
  mockupPhotoImage: { width: '100%', height: '100%', objectFit: 'cover' },
  // New Match top-left, school district bottom-center - same plain white/bold + drop-shadow-style
  // treatment (no pill/scrim background) as the live Showcase card (components/PropertyCard.tsx),
  // not a boxed badge. No Days on Market badge anymore.
  mockupNewMatchBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#22c55e', borderRadius: 6, paddingVertical: 2.5, paddingHorizontal: 6 },
  mockupNewMatchText: { fontSize: 5.5, fontWeight: 900, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.2 },
  mockupSchoolBadgeWrap: { position: 'absolute', bottom: 5, left: 8, right: 8, alignItems: 'center', justifyContent: 'center' },
  mockupSchoolPill: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%', backgroundColor: 'rgba(17,24,39,0.72)', borderRadius: 5, paddingVertical: 1.5, paddingHorizontal: 5 },
  mockupSchoolText: { fontSize: 6, fontWeight: 700, color: COLORS.white, textTransform: 'uppercase' },
  mockupBody: { padding: 10 },
  mockupTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mockupPrice: { fontSize: 13, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text },
  mockupAddress: { fontSize: 6.5, color: COLORS.subtext, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  mockupFacts: { fontSize: 6, color: COLORS.muted, marginTop: 5, fontWeight: 400, letterSpacing: 0.3 },
  mockupReactRow: { flexDirection: 'row', gap: 4 },
  mockupReactCircle: { width: 20, height: 20, borderRadius: 6, border: `1 solid ${COLORS.border}`, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  mockupTourBtn: { marginTop: 9, backgroundColor: '#111827', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  mockupTourBtnText: { fontSize: 6.5, fontWeight: 700, color: COLORS.white, letterSpacing: 1 },
  mockupCommentsWrap: { borderTop: `1 solid ${COLORS.border}`, backgroundColor: COLORS.panel, padding: 9 },
  mockupCommentsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  mockupCommentsHeaderText: { fontSize: 6.5, fontWeight: 700, color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  mockupCommentBubble: { backgroundColor: COLORS.white, borderRadius: 8, border: `1 solid ${COLORS.line}`, padding: 6, marginBottom: 5 },
  mockupCommentName: { fontSize: 5.3, fontWeight: 700, color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.3 },
  mockupCommentText: { fontSize: 6, color: COLORS.subtext, marginTop: 2, lineHeight: 1.3 },
  // The agent's reply - same bubble shape as the guest's, just on the accent-tinted side with a
  // small avatar+name header instead of a plain uppercase name label, so it reads as "you"
  // responding rather than another guest.
  mockupCommentBubbleAgent: { backgroundColor: '#FBF6EC', borderRadius: 8, border: `1 solid ${COLORS.border}`, padding: 6, marginBottom: 5 },
  mockupCommentAgentHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mockupCommentAgentName: { fontSize: 5.3, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.3 },
  mockupCommentInput: { backgroundColor: COLORS.white, borderRadius: 8, border: `1 solid ${COLORS.line}`, padding: 6 },
  mockupCommentPlaceholder: { fontSize: 5.5, color: COLORS.muted },

  adQrBlock: { marginTop: 14, alignItems: 'center', backgroundColor: COLORS.panel, borderRadius: 20, padding: 20, border: `1 solid ${COLORS.border}` },
  adQrCta: { fontSize: 11, fontWeight: 700, color: COLORS.text, marginBottom: 10, textAlign: 'center' },
  adQrImage: { width: 96, height: 96 },
  adQrImageWrap: { position: 'relative' },
  // A small showcase icon centered on the QR - signals what scanning leads to (a Showcase)
  // without using an actual property photo. Generated at ECC level H so the overlay doesn't
  // hurt scannability.
  adQrLogoWrap: { position: 'absolute', borderRadius: 6, backgroundColor: COLORS.white, padding: 2, border: `1 solid ${COLORS.border}`, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  adQrLogoImage: { width: '100%', height: '100%', borderRadius: 4, objectFit: 'cover' },

  // Bottom band of page 1 (below Recent Sales): the "visit my Agent Hub" QR panel, pinned to the
  // bottom via this wrapper. The market/location pill that used to sit above it was dropped - it
  // duplicated the market line already shown in the page header and just ate vertical space.
  pageOneBottomWrap: { marginTop: 'auto', paddingTop: 16 },
  // Brag sheet page 1 budget (LETTER 792pt - 2x35 padding = 722pt): header ~101 + bio <=3 lines ~55 +
  // heading ~22 + 3 sale rows ~440 = ~618, inside a 626pt content box; the 78pt footer sits pinned
  // below it with room to spare, so nothing can push it to a second page.
  bragPageOneContent: { height: 626, overflow: 'hidden' },
  bragHeaderTight: { marginBottom: 14, paddingBottom: 14 },
  bragBio: { marginBottom: 12 },
  bragSalesHeading: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6, color: COLORS.text, marginBottom: 7 },
  bragSaleImageWrap: { height: 100 },
  bragFooterPinned: { position: 'absolute', left: 35, right: 35, bottom: 35 },
  pageOneQrRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: COLORS.panel, borderRadius: 14, borderTop: `1.5 solid ${COLORS.accent}`, padding: 10 },
  pageOneQrImageWrap: { position: 'relative', width: 54, height: 54 },
  pageOneQrImage: { width: 54, height: 54, borderRadius: 6, border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.white },
  // Small agent headshot centered over the QR - the code is generated at ECC level H (30%
  // redundancy) specifically so a logo this size can sit on top without hurting scannability.
  pageOneQrLogoWrap: { position: 'absolute', top: 15.5, left: 15.5, width: 23, height: 23, borderRadius: 11.5, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', padding: 1.5, border: `1 solid ${COLORS.border}` },
  pageOneQrTextWrap: { flex: 1 },
  pageOneQrEyebrow: { fontSize: 6, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2 },
  pageOneQrTitle: { fontSize: 10, fontWeight: 700, color: COLORS.text },
  pageOneQrSubtitle: { fontSize: 7, color: COLORS.subtext, marginTop: 2, lineHeight: 1.3 },

  // Page 2 top row: a mini "browse a Showcase" grid preview to the left of the untouched
  // single-property tour-request mockup, so the pitch shows both views of the same feature.
  adTopRow: { flexDirection: 'row', gap: 18, alignItems: 'flex-start', justifyContent: 'center' },
  // Bigger, bolder column titles than the tiny generic `label` style (7pt muted) - at that size
  // the heading over a fairly large preview box read as an afterthought rather than a title.
  adTopRowLabel: { fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.3, color: COLORS.text, textAlign: 'center', marginBottom: 9 },
  showcasePreviewCol: { width: 264, flexShrink: 0 },
  showcasePreviewCard: { borderRadius: 14, border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.panel, padding: 11 },
  showcasePreviewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  // Real property photos (comps from this open house when available, else the agent's own Recent
  // Sales) standing in for matched listings, styled like an actual Showcase match card - photo on
  // top, "New Match" badge, then a footer with price/address and like/dislike/view-more actions,
  // matching the real product instead of the old empty icon-only placeholder tiles.
  showcasePreviewTile: { width: '48%', borderRadius: 9, backgroundColor: COLORS.white, border: `1 solid ${COLORS.border}`, marginBottom: 9, overflow: 'hidden' },
  showcasePreviewTilePhoto: { position: 'relative', height: 76, width: '100%' },
  showcasePreviewTileImage: { width: '100%', height: '100%', objectFit: 'cover' },
  showcasePreviewTileNoImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.panel },
  showcasePreviewTileBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: '#22c55e', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 5 },
  showcasePreviewTileBadgeText: { fontSize: 5.2, fontWeight: 900, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.2 },
  // School district bottom-center, now inside a rounded semi-opaque dark chip (direct feedback:
  // "rounded rectangle to better see it") instead of bare white text on the photo.
  showcasePreviewTileSchoolScrim: { position: 'absolute', bottom: 3, left: 3, right: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  showcasePreviewTileSchoolPill: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '100%', backgroundColor: 'rgba(17,24,39,0.72)', borderRadius: 5, paddingVertical: 1.5, paddingHorizontal: 4 },
  showcasePreviewTileSchoolText: { fontSize: 4.6, fontWeight: 700, color: COLORS.white, textTransform: 'uppercase' },
  showcasePreviewTileFooter: { padding: 6.5 },
  showcasePreviewTilePrice: { fontSize: 8.5, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text },
  showcasePreviewTileAddress: { fontSize: 5.4, fontWeight: 400, color: COLORS.muted, marginTop: 1.5, textTransform: 'uppercase', letterSpacing: 0.2 },
  showcasePreviewTileActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, paddingTop: 5, borderTop: `1 solid ${COLORS.line}` },
  showcasePreviewTileReactGroup: { flexDirection: 'row', gap: 4 },
  showcasePreviewTileReactCircle: { width: 13, height: 13, borderRadius: 4, border: `1 solid ${COLORS.border}`, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  showcasePreviewTileViewMore: { fontSize: 5, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.2 },
  showcasePreviewPriceBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, borderRadius: 8, border: `1 solid ${COLORS.border}`, paddingVertical: 7, paddingHorizontal: 10, marginTop: 1 },
  showcasePreviewPriceText: { fontSize: 9, fontWeight: 700, color: COLORS.text },
  showcasePreviewCountText: { fontSize: 6.4, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Page 2 bottom band: feature cards flanking a centered "Create Your Own Showcase" QR CTA.
  // Pinned toward the bottom of the page (marginTop: 'auto', same technique as page 1's bottom
  // band) with its own section title above it, so the five cards read as one unified "why a
  // Showcase" block instead of three columns that just happen to be floating near each other.
  adBottomWrap: { marginTop: 'auto', paddingTop: 20 },
  adBottomLabel: { fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.3, color: COLORS.text, textAlign: 'center', marginBottom: 10 },
  adBottomRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  adFeatureCol: { flex: 1, gap: 8, justifyContent: 'center' },
  bulletCardCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.panel, borderRadius: 10, border: `1 solid ${COLORS.border}`, padding: 8 },
  bulletPhotoSquare: { width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.white, border: `1 solid ${COLORS.accent}`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bulletTextWrapCompact: { flex: 1 },
  bulletTitleCompact: { fontSize: 8.3, fontWeight: 700, color: COLORS.text, marginBottom: 2 },
  bulletBodyCompact: { fontSize: 6.5, lineHeight: 1.3, color: COLORS.subtext },

  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  photoHalf: { flex: 1, height: 215, borderRadius: 12, objectFit: 'cover' },
  heroWrap: { position: 'relative', marginBottom: 10 },
  heroPhoto: { width: '100%', height: 305, borderRadius: 14, objectFit: 'cover' },
  // Left-anchored nameplate (not a centered pill): flush-ish to the photo's lower-left with a
  // gold left rule and a single small radius, so it reads as an authoritative caption the way the
  // Areas template plates its headers.
  heroAddressBadge: { position: 'absolute', bottom: 14, left: 14, maxWidth: '80%', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(17,24,39,0.82)', borderLeft: `3 solid ${COLORS.accent}`, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 6 },
  heroAddressText: { fontSize: 10, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 1 },

  // Same typographic character as the page-2 address (sheetHeading): Playfair 700, title-case, no
  // wide all-caps tracking - just a touch of letter-spacing.
  brokerageMasthead: { fontSize: 17, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, textAlign: 'center', letterSpacing: 0.3, marginBottom: 8 },
  mastheadDivider: { height: 2, width: 56, backgroundColor: COLORS.accent, alignSelf: 'center', borderRadius: 1, marginBottom: 16 },

  frontAgentCard: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.panel, borderRadius: 10, border: `1 solid ${COLORS.border}`, borderLeft: `3 solid ${COLORS.accent}`, paddingVertical: 5, paddingHorizontal: 8, marginTop: 'auto' },
  frontAgentInfo: { flex: 1 },
  frontAgentName: { fontSize: 11.5, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, marginBottom: 0.5 },
  frontAgentDetail: { fontSize: 6.6, color: COLORS.subtext, marginTop: 0.2 },
  frontAgentQrCard: { alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 8, border: `1 solid ${COLORS.accent}`, padding: 4 },
  frontAgentQrImage: { width: 36, height: 36, borderRadius: 3 },
  frontAgentQrCaption: { fontSize: 4.2, color: COLORS.muted, marginTop: 1.5, textTransform: 'uppercase', letterSpacing: 0.25, textAlign: 'center', maxWidth: 46 },
  frontFactsRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch', marginBottom: 8 },
  frontPriceCard: { width: 118, justifyContent: 'center', backgroundColor: COLORS.panel, borderRadius: 10, border: `1 solid ${COLORS.border}`, borderLeft: `3 solid ${COLORS.accent}`, paddingVertical: 6, paddingHorizontal: 9 },
  frontPriceLabel: { fontSize: 5.5, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 1 },
  frontPriceValue: { fontSize: 13, fontFamily: 'Montserrat', fontWeight: 700, color: COLORS.text, marginTop: 2 },
  frontBasicInfo: { flex: 1 },
  pageTwoFlowContent: {},
  // In normal document flow (not pinned to the page bottom) so it sits right under whatever
  // content precedes it - if that content is short there's no big gap, and if it's long the row
  // still lands on page 2 instead of react-pdf auto-paginating it alone onto a near-empty page 3.
  pageTwoActionRow: { height: 148, flexDirection: 'row', gap: 9, alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 16 },
  areaMapCard: { position: 'relative', width: 174, height: 148, borderRadius: 10, overflow: 'hidden', border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.panel, flexGrow: 0, flexShrink: 0 },
  areaMapImage: { width: '100%', height: '100%', objectFit: 'cover' },
  areaMapFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 10 },
  areaMapFallbackText: { fontSize: 6.6, lineHeight: 1.25, color: COLORS.muted, textAlign: 'center' },
  // Card footprint is fixed (148 tall, matches the map card next to it) but the QR/text inside it
  // used to leave a lot of unused panel-grey margin - sized up to actually fill that space instead
  // of just adding padding around a small code.
  qrActionCard: { width: 174, height: 148, borderRadius: 10, border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.panel, padding: 9, alignItems: 'center', justifyContent: 'center', flexGrow: 0, flexShrink: 0 },
  qrActionEyebrow: { fontSize: 6, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.75, marginBottom: 4 },
  qrActionImage: { width: 80, height: 80, borderRadius: 4, backgroundColor: COLORS.white, border: `1 solid ${COLORS.line}` },
  qrActionLabel: { fontSize: 9.5, fontFamily: 'Playfair Display', fontWeight: 700, color: COLORS.text, textAlign: 'center', marginTop: 6 },
  qrActionHint: { fontSize: 6.4, color: COLORS.muted, textAlign: 'center', marginTop: 3, lineHeight: 1.2 },

  descriptionText: { fontSize: 8.8, lineHeight: 1.45, color: COLORS.subtext, marginBottom: 10 },
  highlightsParagraph: { marginBottom: 10 },
  highlightsParagraphLabel: { fontWeight: 700, color: COLORS.text },

  sectionLabel: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: COLORS.accent, marginTop: 8, marginBottom: 6, paddingLeft: 6, borderLeft: `3 solid ${COLORS.accent}` },
  sectionBlock: { marginBottom: 2 },

  basicInfoRow: { flexDirection: 'row', backgroundColor: COLORS.panel, borderRadius: 8, border: `1 solid ${COLORS.border}`, paddingVertical: 6, paddingHorizontal: 4, marginBottom: 4 },
  basicInfoItem: { flex: 1, alignItems: 'center' },
  basicInfoIconCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.white, border: `1 solid ${COLORS.accent}`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  basicInfoValue: { fontSize: 9.5, fontWeight: 400, color: COLORS.text, marginTop: 3 },
  basicInfoLabel: { fontSize: 5, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 0.5, textAlign: 'center' },

  factTileGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  factTile: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.panel, borderRadius: 12, border: `1 solid ${COLORS.border}`, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 8 },
  factTileWide: { width: '100%' },
  factIconCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.white, border: `1 solid ${COLORS.accent}`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  factTileText: { flex: 1 },
  factLabel: { fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.muted, marginBottom: 2 },
  factValue: { fontSize: 9.5, fontWeight: 400, color: COLORS.text },
  factValueTight: { fontSize: 8.4, lineHeight: 1.18, fontWeight: 400, color: COLORS.text },

  amenitiesSection: { marginTop: 4 },
  amenityCategory: { marginBottom: 6 },
  amenityCategoryLabel: { fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: COLORS.accent, marginBottom: 4 },
  amenityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  amenityName: { fontSize: 8, color: COLORS.text },
  amenityDistance: { fontSize: 8, color: COLORS.muted },
  amenityTypeTag: { fontSize: 6, fontWeight: 700, color: COLORS.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  schoolDisclaimer: { fontSize: 6.5, lineHeight: 1.25, color: COLORS.muted, marginTop: -2, marginBottom: 6 },
});

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Same first-line-of-address stripping as the web app's getStreetOnly (lib/agentSales.ts) -
// duplicated here rather than imported since pdfs.tsx is a client-only render module and this
// is a one-line pure string op, not worth a cross-file dependency for.
const getSaleStreetOnly = (address?: string): string => {
  const firstLine = String(address || '').split(',')[0]?.trim() || 'Address unavailable';
  return firstLine.replace(/\s+(#|apt\.?|unit|suite|ste\.?|fl\.?|floor)\s*[\w-]+.*$/i, '').trim() || firstLine;
};

// react-pdf has no text-measurement API, so "keep it on one line, and if it won't fit drop the
// least-important piece" is decided on character count - the thresholds are tuned by eye per card
// width at each call site. Returns the richest label (street, then + city, then + state) whose
// length stays within maxChars, falling back to street-only.
const fitAddressLine = (street: string, city?: string | null, state?: string | null, maxChars = 34): string => {
  const s = String(street || '').trim();
  const c = String(city || '').trim();
  const st = String(state || '').trim();
  const candidates = [
    [s, c, st].filter(Boolean).join(', '),
    [s, c].filter(Boolean).join(', '),
    s,
  ];
  return candidates.find(candidate => candidate.length <= maxChars) || s;
};

const formatCompactMoney = (value?: number): string => {
  const num = Number(value) || 0;
  if (!num) return '$0';
  if (num >= 1000000) {
    const millions = num / 1000000;
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `$${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}M`;
  }
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${num.toLocaleString()}`;
};

// A soft bottom-up dark fade over a photo, so plain white text laid low on it stays legible
// without a box behind it or an outline stroked around each letter - the same idea as the Open
// House cards' city-label fade. react-pdf's SVG gradients render inconsistently in this doc, so
// it's built from flat black layers of rising opacity stacked at the photo's bottom edge. Using
// many closely-spaced layers with a small per-layer opacity step keeps the seam between any two
// from showing as a band line - composited they read as one smooth, barely-there fade.
const SCRIM_LAYERS = [
  { h: 84, o: 0.045 }, { h: 74, o: 0.065 }, { h: 65, o: 0.09 }, { h: 56, o: 0.115 },
  { h: 47, o: 0.14 }, { h: 39, o: 0.17 }, { h: 31, o: 0.20 }, { h: 24, o: 0.235 },
  { h: 18, o: 0.27 }, { h: 12, o: 0.31 }, { h: 7, o: 0.36 }, { h: 3, o: 0.41 },
];
const PhotoBottomScrim = () => (
  <>
    {SCRIM_LAYERS.map((l, i) => (
      <View key={i} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: l.h, backgroundColor: `rgba(0,0,0,${l.o})` }} />
    ))}
  </>
);

// Photo carries the price + address low on it as plain white text over PhotoBottomScrim (a soft
// bottom fade), plus a match-score badge top-left and a days-on-market badge top-right. Stats
// (beds/baths/sqft/acres/$-per-sqft/year built) get their own light strip directly under the
// photo instead of squeezing onto it too. QR straddles the seam between photo and strip (half in
// each - see cardQrBadge).
const PropertyPDFCard = ({ item, agentId, showMatchScore, openHouseEventId }: { item: any; agentId?: string; showMatchScore?: boolean; openHouseEventId?: string }) => {
  // src/oh tag: a message or tour request sent from that page is tracked back to this open
  // house's sheet (frontend lib/visitSource.ts -> backend services/visit_source.py).
  const tag = openHouseEventId ? `?src=similar_qr&oh=${encodeURIComponent(openHouseEventId)}` : '';
  const url = `${process.env.NEXT_PUBLIC_CLIENT_URL || "https://openhousepal.com"}/property/${item.ListingKey || item.id}/${agentId || 'agent'}${tag}`;
  const qrUrl = qrPdfSrc(url, { size: 150 });
  const streetOnly = toTitleCase(getSaleStreetOnly(item.FullStreetAddress || item.address));
  const price = Number(item.ListPrice || item.price || 0);
  const matchScore = typeof item.matchScore === 'number' ? item.matchScore : null;
  const sqft = Number(item.LivingArea || item.sqft || 0);
  const pricePerSqft = price && sqft ? Math.round(price / sqft) : null;
  // Same field-name fallback chain as the web equivalent (PropertyRecommendationCard's
  // getNumeric) - this card was only checking LotSizeAcres/acres and LotSizeSquareFeet/lotSize,
  // missing the camelCase (lotSizeAcres/lotSizeSquareFeet) and snake_case (lot_size_acres/
  // lot_size) shapes the API actually returns depending on the source, so acres silently came
  // back 0/"-" on this sheet even though the web card showed it fine for the same listing.
  const getNumeric = (...values: any[]) => {
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      const numericValue = Number(value);
      if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
    }
    return 0;
  };
  const explicitAcres = getNumeric(item.LotSizeAcres, item.lotSizeAcres, item.lot_size_acres, item.acres);
  const lotSqft = getNumeric(item.LotSizeSquareFeet, item.lotSizeSquareFeet, item.lot_size, item.lotSize);
  const acres = explicitAcres || (lotSqft ? Number((lotSqft / 43560).toFixed(2)) : 0);
  const yearBuilt = item.YearBuilt || item.yearBuilt || item.year_built;
  const daysOnMarket = item.DaysOnMarket ?? item.daysOnMarket ?? item.dom;

  return (
    <View style={styles.card}>
      <View style={styles.cardPhotoWrap}>
        <Image src={normalizeImageUrl(item.ListPictureURL || item.image || '')} style={styles.cardImage} />
        <PhotoBottomScrim />
        {showMatchScore && matchScore != null && (
          <View style={styles.cardMatchBadge}>
            <Text style={styles.cardMatchBadgeText}>{matchScore}% Match</Text>
          </View>
        )}
        {daysOnMarket != null && (
          <View style={styles.cardDomBadge}>
            <Text style={styles.cardDomBadgeText}>{daysOnMarket} DOM</Text>
          </View>
        )}
        <View style={styles.cardTextGroup}>
          <Text style={styles.cardPriceOnPhoto}>{price ? `$${price.toLocaleString()}` : 'Price N/A'}</Text>
          {(() => {
            // One line: "Street, City" -> drops the city as it gets long (fitAddressLine), then a
            // final size step-down so a still-long street never wraps or hits the QR badge. No
            // state on the card (per direct feedback) - it's on the sheet header instead.
            const line = fitAddressLine(
              streetOnly,
              toTitleCase(item.City || item.city || ''),
              '',
              30,
            );
            const size = line.length <= 20 ? 8.4 : line.length <= 26 ? 7.4 : 6.6;
            return (
              <Text style={[styles.cardAddressOnPhoto, { fontSize: size }]} {...({ numberOfLines: 1 } as any)}>{line}</Text>
            );
          })()}
        </View>
      </View>
      <View style={styles.cardStatsSection}>
        <View style={styles.cardStatsRow}>
          <View style={styles.cardStatCol}>
            <Text style={styles.cardStatValue}>{item.BedroomsTotal || item.beds || 0}</Text>
            <Text style={styles.cardStatLabel}>Beds</Text>
          </View>
          <View style={styles.cardStatCol}>
            <Text style={styles.cardStatValue}>{item.BathroomsTotal || item.baths || 0}</Text>
            <Text style={styles.cardStatLabel}>Baths</Text>
          </View>
          <View style={styles.cardStatCol}>
            <Text style={styles.cardStatValue}>{sqft ? sqft.toLocaleString() : '-'}</Text>
            <Text style={styles.cardStatLabel}>Sq Ft</Text>
          </View>
          <View style={styles.cardStatCol}>
            <Text style={styles.cardStatValue}>{acres > 0 ? acres.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}</Text>
            <Text style={styles.cardStatLabel}>Acres</Text>
          </View>
          <View style={styles.cardStatCol}>
            <Text style={styles.cardStatValue}>{pricePerSqft ? `$${pricePerSqft}` : '-'}</Text>
            <Text style={styles.cardStatLabel}>/ Sq Ft</Text>
          </View>
          <View style={styles.cardStatCol}>
            <Text style={styles.cardStatValue}>{yearBuilt || '-'}</Text>
            <Text style={styles.cardStatLabel}>Built</Text>
          </View>
        </View>
      </View>
      {/* Positioned on the outer card, not inside cardPhotoWrap or cardStatsSection - see
          cardQrBadge's comment for why that's what lets it straddle the seam between the two. */}
      <View style={styles.cardQrBadge}>
        <View style={styles.cardQrHeaderBar}>
          <Text style={styles.cardQrHeaderText}>View Details</Text>
        </View>
        <View style={styles.cardQrImageBox}>
          <Image src={qrUrl} style={styles.cardQrImage} />
        </View>
      </View>
    </View>
  );
};

// Bright stores districts as one ALL-CAPS hyphenated word ("TREDYFFRIN-EASTTOWN"); react-pdf can't
// wrap that, so it ran into the next table column / got clipped in stat boxes. Readable case plus
// a break opportunity after the hyphen.
function pdfDistrict(v?: string | null): string | undefined {
  if (!v) return undefined
  const t = v === v.toUpperCase() ? v.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase()) : v
  return t.replace(/\s*-\s*/g, '- ')
}

export const OpenHouseFlyerDocument = ({ data }: { data: any }) => {
  const url = `${process.env.NEXT_PUBLIC_CLIENT_URL || "https://openhousepal.com"}${data.openHouseUrl}`;
  // No built-in quiet zone: the white QR card's padding (styles.qrContainer) is the code's margin,
  // so the code itself fills the card instead of floating in blank white.
  const qrUrl = qrPdfSrc(url, { size: 360, margin: 0 });
  const propertyAddress = data?.address || "Address Not Available";
  // Split "Street, City" into its own street line + a lighter city/state line below it.
  const [flyerStreetRaw, ...flyerRest] = String(propertyAddress).split(',');
  const flyerStreet = toTitleCase(flyerStreetRaw.trim()).replace(/\b(\d+)([a-z])\b/g, (_m, n, l) => n + l.toUpperCase());
  const flyerCityState = [toTitleCase(flyerRest.join(',').trim()), String(data?.state || '').trim()].filter(Boolean).join(', ');
  const stats = [
    { key: 'beds', icon: ICONS.bed, value: String(data.beds || 0), label: 'Beds' },
    { key: 'baths', icon: ICONS.bath, value: String(data.baths || 0), label: 'Baths' },
    { key: 'sqft', icon: ICONS.ruler, value: Number(data.sqft || 0).toLocaleString(), label: 'Sq Ft' },
  ];
  // Long streets step down so the address never takes more than two lines.
  const addressSize = flyerStreet.length > 30 ? 26 : flyerStreet.length > 22 ? 29 : flyerStreet.length > 16 ? 31 : 40;
  const schoolDistrictRaw = String(data?.schoolDistrict || '').trim();
  const schoolDistrict = schoolDistrictRaw && !/district/i.test(schoolDistrictRaw) ? `${schoolDistrictRaw} School District` : schoolDistrictRaw;
  // Steps down so the name stays on one line as long as it can (~36 chars at full size, ~46 and
  // ~54 at the smaller sizes); past that it wraps to two centered lines.
  const schoolLen = schoolDistrict.length;
  const schoolTextSize = schoolLen > 46 ? { fontSize: 6.5, letterSpacing: 0.8, lineHeight: 1.35 } : schoolLen > 36 ? { fontSize: 7, letterSpacing: 1.1 } : {};
  const schoolWraps = schoolLen > 54;
  // Optional "Brand" upgrade (Documents -> Sign In -> Brand): the same hosting-agent pill the
  // on-screen Sign-In Sheet/Kiosk floats over its photo - headshot, name, brokerage.
  const brand = data?.brand && data.brand.name ? data.brand : null;

  return (
    <Document>
      <Page size="LETTER" style={styles.flyerPage}>
        <View style={styles.heroSection}>
          <Image src={normalizeImageUrl(data.coverImage)} style={[styles.flyerCoverImage, { objectPosition: `${data.coverImagePosition?.x ?? 50}% ${data.coverImagePosition?.y ?? 50}%` }]} />
          <View style={styles.heroOverlay} />
          {brand && (
            <View style={styles.flyerBrandWrap}>
              <View style={styles.flyerBrandRing}>
              <View style={styles.flyerBrandPill}>
                {brand.photoUrl ? (
                  <Image src={pdfImageUrl(brand.photoUrl)} style={[styles.flyerBrandPhoto, { objectPosition: `${brand.photoPosition?.x ?? 50}% ${brand.photoPosition?.y ?? 50}%` }]} />
                ) : (
                  <View style={[styles.flyerBrandPhoto, styles.flyerBrandInitialsWrap]}>
                    <Text style={styles.flyerBrandInitials}>{getInitials(brand.name)}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.flyerBrandName}>{brand.name}</Text>
                  {brand.brokerage ? <Text style={styles.flyerBrandBrokerage}>{brand.brokerage}</Text> : null}
                </View>
              </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.flyerContent}>
          <View style={styles.leftCol}>
            <View style={styles.addressBlock}>
              <Text style={styles.flyerOpenHouse}>Open House</Text>
              <View style={styles.flyerHeadlineRule} />
            </View>

            <View style={styles.flyerSpacerAbove} />
            <View style={styles.flyerMidGroup}>
            <Text style={[styles.flyerAddressBig, { fontSize: addressSize }]}>{flyerStreet}</Text>
            {flyerCityState ? <Text style={styles.addressCityText}>{flyerCityState}</Text> : null}

            <View style={styles.flyerFactCard}>
              <View style={styles.flyerFactRow}>
                {stats.map((stat, i) => (
                  <React.Fragment key={stat.key}>
                    {i > 0 ? <View style={styles.flyerFactDivider} /> : null}
                    <View style={styles.flyerFactCell}>
                      <View style={styles.flyerStatIcon}>{stat.icon({ size: 16 })}</View>
                      <Text style={styles.flyerStatValue}>{stat.value}</Text>
                      <Text style={styles.flyerStatLabel}>{stat.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
              {schoolDistrict ? (
                <View style={schoolWraps ? [styles.flyerSchoolStrip, styles.flyerSchoolStripBalanced] : styles.flyerSchoolStrip}>
                  {ICONS.gradCap({ size: 12 })}
                  <Text style={[styles.flyerSchoolText, schoolTextSize]}>{schoolDistrict}</Text>
                </View>
              ) : null}
            </View>
            </View>

            <View style={styles.flyerSpacerBelow} />
            <View style={styles.priceBlock}>
              <Text style={styles.priceLabel}>Listing Price</Text>
              <Text style={styles.priceValue}>${Number(data.price || 0).toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.rightCol}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.label, styles.flyerCapLabel]}>Instant Check-In</Text>
              <Text style={styles.qrHeader}>Scan to Sign In</Text>
              <Text style={styles.qrDescription}>Complete our online sign-in form to register your visit.</Text>
            </View>
            <View style={styles.qrContainer}>
              <Image src={qrUrl} style={{ width: 155, height: 155 }} />
            </View>
            <View style={styles.qrFooterWrapper}>
              <Text style={styles.quickEasyText}>Quick & Easy</Text>
              <Text style={styles.secondsText}>Takes less than 30 seconds to complete</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// The paper backup for the QR sign-in: same questions guests answer on screen (name, email,
// phone, "do you have an active agreement with an agent?"), on a branded register for this home
// that guests fill in with a pencil. Opened from Documents -> Sign In -> Paper Sheet.
const PAPER_ROWS = 14;
const paper = StyleSheet.create({
  page: { backgroundColor: COLORS.white, fontFamily: 'Montserrat', paddingBottom: 22 },
  hero: { height: 138, position: 'relative', overflow: 'hidden', backgroundColor: '#0B0B0C' },
  heroImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  heroShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,11,12,0.58)' },
  heroGold: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: '#C9A24D' },
  heroInner: { position: 'absolute', left: 40, right: 40, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20 },
  eyebrow: { fontSize: 7, fontWeight: 700, color: '#E8C97A', letterSpacing: 2.6, textTransform: 'uppercase', marginBottom: 6 },
  street: { fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.white, lineHeight: 1.05 },
  place: { fontSize: 9, color: '#E5E7EB', marginTop: 10 },
  facts: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  fact: { fontSize: 7.5, fontWeight: 700, color: '#E8C97A', letterSpacing: 1.2, textTransform: 'uppercase' },
  factDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#8b7355', marginHorizontal: 7 },
  agentPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 14, marginLeft: 16 },
  agentPhoto: { width: 30, height: 30, borderRadius: 15, border: '1.5 solid #C9A24D', objectFit: 'cover' },
  agentInitials: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#C9A24D', alignItems: 'center', justifyContent: 'center' },
  agentName: { fontFamily: 'Playfair Display', fontWeight: 900, fontSize: 11.5, color: COLORS.white },
  agentBrokerage: { fontSize: 6, fontWeight: 700, color: '#D1D5DB', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 1.5 },
  welcome: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginHorizontal: 40, marginTop: 18, marginBottom: 12 },
  welcomeTitle: { fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 21, color: '#0B0B0B' },
  welcomeSub: { fontSize: 7.5, color: COLORS.subtext, marginTop: 3 },
  dateLabel: { fontSize: 6.5, fontWeight: 700, color: COLORS.muted, letterSpacing: 1.6, textTransform: 'uppercase', marginRight: 6 },
  dateLine: { width: 120, height: 1, backgroundColor: '#C9B79A', marginBottom: 2 },
  table: { marginHorizontal: 40, border: `1 solid ${FLYER_WARM.border}`, borderRadius: 10, overflow: 'hidden' },
  headRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', height: 30 },
  headCell: { fontSize: 6.5, fontWeight: 700, color: COLORS.white, letterSpacing: 1.4, textTransform: 'uppercase', paddingHorizontal: 8 },
  headSub: { fontSize: 5.5, color: '#E8C97A', letterSpacing: 0.4, marginTop: 1.5, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'stretch', height: 31.5, borderTop: `1 solid ${FLYER_WARM.divider}` },
  rowAlt: { backgroundColor: FLYER_WARM.panel },
  num: { fontSize: 7, fontWeight: 700, color: '#C9B79A', textAlign: 'center', paddingTop: 12 },
  cell: { borderLeft: `1 solid ${FLYER_WARM.divider}` },
  agentCell: { borderLeft: `1 solid ${FLYER_WARM.divider}`, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  box: { width: 9, height: 9, borderRadius: 2, border: '1 solid #B8A88E', marginRight: 3 },
  boxLabel: { fontSize: 6.5, fontWeight: 700, color: COLORS.subtext, marginRight: 9 },
  footer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 40, marginTop: 14, paddingTop: 12, borderTop: `1 solid ${FLYER_WARM.divider}` },
  qrWrap: { padding: 4, border: `1 solid ${FLYER_WARM.border}`, borderRadius: 8, marginRight: 10 },
  footHead: { fontSize: 6.5, fontWeight: 700, color: '#8b7355', letterSpacing: 1.6, textTransform: 'uppercase' },
  footText: { fontSize: 7.5, color: COLORS.subtext, marginTop: 2.5, lineHeight: 1.35 },
  footRight: { marginLeft: 'auto', alignItems: 'flex-end' },
  footName: { fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 11, color: '#0B0B0B' },
  footContact: { fontSize: 7, color: COLORS.subtext, marginTop: 2 },
});
// Column widths across the 532pt-wide table (letter page, 40pt margins).
const PAPER_COLS = { num: 24, name: 146, email: 160, phone: 100, agent: 102 };

export const PaperSignInSheetDocument = ({ data }: { data: any }) => {
  const [streetRaw, ...rest] = String(data?.address || 'Open House').split(',');
  const street = toTitleCase(streetRaw.trim()).replace(/\b(\d+)([a-z])\b/g, (_m, n, l) => n + l.toUpperCase());
  const place = [toTitleCase(rest.join(',').trim()), String(data?.state || '').trim()].filter(Boolean).join(', ');
  const streetSize = street.length > 30 ? 20 : street.length > 22 ? 23 : 27;
  const facts = [
    data?.price ? `$${Number(data.price).toLocaleString()}` : '',
    data?.beds ? `${data.beds} Beds` : '',
    data?.baths ? `${data.baths} Baths` : '',
    data?.sqft ? `${Number(data.sqft).toLocaleString()} Sq Ft` : '',
  ].filter(Boolean);
  const agent = data?.brand && data.brand.name ? data.brand : null;
  const signInUrl = data?.openHouseUrl ? `${process.env.NEXT_PUBLIC_CLIENT_URL || 'https://openhousepal.com'}${data.openHouseUrl}` : '';
  const qrUrl = signInUrl ? qrPdfSrc(signInUrl, { size: 240, margin: 0 }) : null;
  const contactLine = agent ? [agent.phone, agent.email].filter(Boolean).join('   ·   ') : '';

  return (
    <Document>
      <Page size="LETTER" style={paper.page}>
        <View style={paper.hero}>
          {data?.coverImage ? (
            <Image src={pdfImageUrl(data.coverImage)} style={[paper.heroImg, { objectPosition: `${data.coverImagePosition?.x ?? 50}% ${data.coverImagePosition?.y ?? 50}%` }]} />
          ) : null}
          <View style={paper.heroShade} />
          <View style={paper.heroGold} />
          <View style={paper.heroInner}>
            <View style={{ flex: 1 }}>
              <Text style={paper.eyebrow}>Open House  ·  Guest Register</Text>
              <Text style={[paper.street, { fontSize: streetSize }]}>{street}</Text>
              {place ? <Text style={paper.place}>{place}</Text> : null}
              {facts.length > 0 && (
                <View style={paper.facts}>
                  {facts.map((f, i) => (
                    <React.Fragment key={f}>
                      {i > 0 ? <View style={paper.factDot} /> : null}
                      <Text style={paper.fact}>{f}</Text>
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
            {agent && (
              <View style={paper.agentPill}>
                {agent.photoUrl ? (
                  <Image src={pdfImageUrl(agent.photoUrl)} style={[paper.agentPhoto, { objectPosition: `${agent.photoPosition?.x ?? 50}% ${agent.photoPosition?.y ?? 50}%` }]} />
                ) : (
                  <View style={paper.agentInitials}><Text style={{ fontSize: 10, fontWeight: 700, color: COLORS.white }}>{getInitials(agent.name)}</Text></View>
                )}
                <View style={{ marginLeft: 8 }}>
                  <Text style={paper.agentName}>{agent.name}</Text>
                  {agent.brokerage ? <Text style={paper.agentBrokerage}>{agent.brokerage}</Text> : null}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={paper.welcome}>
          <View>
            <Text style={paper.welcomeTitle}>Welcome - please sign in</Text>
            <Text style={paper.welcomeSub}>Kindly print clearly. One guest (or couple) per line - thank you for visiting.</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={paper.dateLabel}>Date</Text>
            <View style={paper.dateLine} />
          </View>
        </View>

        <View style={paper.table}>
          <View style={paper.headRow}>
            <Text style={[paper.headCell, { width: PAPER_COLS.num, paddingHorizontal: 0, textAlign: 'center' }]}>#</Text>
            <Text style={[paper.headCell, { width: PAPER_COLS.name }]}>Full Name</Text>
            <Text style={[paper.headCell, { width: PAPER_COLS.email }]}>Email Address</Text>
            <Text style={[paper.headCell, { width: PAPER_COLS.phone }]}>Phone Number</Text>
            <View style={{ width: PAPER_COLS.agent }}>
              <Text style={paper.headCell}>Have an Agent?</Text>
              <Text style={paper.headSub}>(active agreement)</Text>
            </View>
          </View>
          {Array.from({ length: PAPER_ROWS }).map((_, i) => (
            <View key={i} style={i % 2 === 1 ? [paper.row, paper.rowAlt] : paper.row} wrap={false}>
              <Text style={[paper.num, { width: PAPER_COLS.num }]}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={[paper.cell, { width: PAPER_COLS.name }]} />
              <View style={[paper.cell, { width: PAPER_COLS.email }]} />
              <View style={[paper.cell, { width: PAPER_COLS.phone }]} />
              <View style={[paper.agentCell, { width: PAPER_COLS.agent }]}>
                <View style={paper.box} /><Text style={paper.boxLabel}>Yes</Text>
                <View style={paper.box} /><Text style={[paper.boxLabel, { marginRight: 0 }]}>No</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={paper.footer}>
          {qrUrl ? (
            <View style={paper.qrWrap}><Image src={qrUrl} style={{ width: 44, height: 44 }} /></View>
          ) : null}
          <View style={{ maxWidth: 220 }}>
            <Text style={paper.footHead}>{qrUrl ? 'Prefer your phone?' : 'Thank you for visiting'}</Text>
            <Text style={paper.footText}>{qrUrl ? 'Scan to sign in instantly - it takes less than 30 seconds.' : 'We’ll follow up with anything you’d like to know about this home.'}</Text>
          </View>
          {agent && (
            <View style={paper.footRight}>
              <Text style={paper.footName}>{agent.name}</Text>
              {contactLine ? <Text style={paper.footContact}>{contactLine}</Text> : null}
              {agent.brokerage ? <Text style={[paper.footContact, { color: COLORS.muted }]}>{agent.brokerage}</Text> : null}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};

const getInitials = (name?: string) => {
  if (!name) return '';
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
};

const AgentPhoto = ({ url, name, size = 72, position }: { url?: string; name?: string; size?: number; position?: { x: number; y: number } }) => {
  const sizeOverride = size !== 72 ? { width: size, height: size, borderRadius: size / 2 } : null;
  if (url) return <Image src={pdfImageUrl(url)} style={[styles.agentPhoto, sizeOverride, { objectPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%` }].filter(Boolean) as any} />;
  return (
    <View style={sizeOverride ? [styles.agentPhotoPlaceholder, sizeOverride] : styles.agentPhotoPlaceholder}>
      <Text style={size !== 72 ? [styles.agentPhotoInitials, { fontSize: size * 0.3 }] : styles.agentPhotoInitials}>{getInitials(name) || '?'}</Text>
    </View>
  );
};

interface BragSheetAgent {
  name: string;
  title?: string;
  brokerage?: string;
  market?: string;
  photoUrl?: string;
  photoPosition?: { x: number; y: number };
  phone?: string;
  email?: string;
  bio?: string;
  hubUrl?: string | null;
}

interface BragSheetSale {
  id: string;
  address: string;
  city?: string;
  state?: string;
  price?: number;
  image?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  daysOnMarket?: number;
  schoolDistrict?: string;
}

export const AgentBragSheetDocument = ({ agent, recentSales, showcaseSampleProperties, showcaseQrUrl, showSalesStats, stats }: { agent: BragSheetAgent; recentSales: BragSheetSale[]; showcaseSampleProperties?: BragSheetSale[]; showcaseQrUrl?: string | null; showSalesStats?: boolean; stats?: { totalSold: number; totalVolume: number; avgPrice: number } }) => {
  const sortedSales = [...(recentSales || [])].sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 9);
  // "Recent" only under $50M in volume (lib/salesWording) - the same total the stats row shows.
  const salesRecent = salesAreRecent(stats?.totalVolume ?? (recentSales || []).reduce((t, s) => t + (s.price || 0), 0));
  // The "What A Showcase Looks Like" example uses this specific open house's saved comps (same
  // data as the Property Recommendations PDF) - never the agent's own Recent Sales, since those
  // are a different, unrelated set of homes and would misrepresent what this open house's guests
  // would actually be matched with. Falls back to icon placeholders (not Recent Sales) when a
  // Brag Sheet is generated without open-house context (e.g. from the Agent Hub page).
  const showcaseSamples = showcaseSampleProperties || [];
  // The "What Your Guest Will See" mock-up is a zoomed-in look at the exact same first tile shown
  // in the "What A Showcase Looks Like" grid (both index into showcaseSamples[0]) - pulling its
  // real price/address/facts here too, instead of the hardcoded placeholder listing this used to
  // show, which didn't match the photo it sat next to.
  const mainSample = showcaseSamples[0] || null;
  const mainSampleStreet = mainSample ? toTitleCase(getSaleStreetOnly(mainSample.address)) : '';
  const mainSampleCity = mainSample?.city ? toTitleCase(mainSample.city) : '';

  return (
    <Document>
      {/* Page 1 is a fixed layout that never spills onto a new page: the Agent Hub footer is pinned
          to the bottom, the content above it lives in a fixed-height box, and the bio is capped at
          BIO_MAX_CHARS (~3 lines; Settings caps typing at the same limit) - so header + bio + 3 rows of sales +
          footer always fit, and the Showcase page stays page 2. */}
      <Page size="LETTER" style={styles.sheetPage}>
        <View style={styles.bragPageOneContent}>
        <View style={[styles.agentHeader, styles.bragHeaderTight]}>
          <View style={styles.agentHeaderLeft}>
            <AgentPhoto url={agent.photoUrl} name={agent.name} position={agent.photoPosition} />
            <View>
              <Text style={styles.agentName}>{agent.name}</Text>
              <Text style={styles.agentSubline}>{[agent.title, agent.brokerage].filter(Boolean).join(' · ')}</Text>
              {agent.market && <Text style={styles.agentSubline}>{agent.market}</Text>}
            </View>
          </View>

          {showSalesStats && stats && (
            <View style={styles.topStatsWrap}>
              <Text style={styles.topStatsEyebrow}>{salesWords('Recent Sales Figures', salesRecent)}</Text>
              <View style={styles.topStatsCluster}>
                <View style={styles.topStatPill}>
                  <Text style={styles.topStatValue}>{stats.totalSold}</Text>
                  <Text style={styles.topStatLabel}>Sold</Text>
                </View>
                <View style={styles.topStatPill}>
                  <Text style={styles.topStatValue}>{formatCompactMoney(stats.totalVolume)}</Text>
                  <Text style={styles.topStatLabel}>Volume</Text>
                </View>
                <View style={styles.topStatPill}>
                  <Text style={styles.topStatValue}>{formatCompactMoney(stats.avgPrice)}</Text>
                  <Text style={styles.topStatLabel}>Avg</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {agent.bio && <Text style={[styles.bioText, styles.bragBio]}>{fitBio(agent.bio)}</Text>}

        {sortedSales.length > 0 && (
          <>
            <Text style={styles.bragSalesHeading}>{salesWords('Recent Sales', salesRecent)}</Text>
            <View style={styles.salesGrid}>
              {sortedSales.map(sale => {
                const streetAddress = toTitleCase(getSaleStreetOnly(sale.address));
                const cityLabel = toTitleCase(sale.city || '');
                return (
                  <View key={sale.id} style={styles.saleTile}>
                    <View style={[styles.saleTileImageWrap, styles.bragSaleImageWrap]}>
                      {sale.image ? <Image src={pdfImageUrl(sale.image)} style={styles.saleTileImage} /> : <View style={[styles.saleTileImage, { backgroundColor: COLORS.panel }]} />}
                      {cityLabel && (
                        <View style={styles.saleTileCityRow}>
                          <View style={styles.saleTileCityPill}>
                            <Svg width={7} height={9} viewBox="0 0 24 24">
                              <Path fill={COLORS.white} d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
                            </Svg>
                            <Text style={styles.saleTileCityText} {...({ numberOfLines: 1 } as any)}>{cityLabel}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={styles.saleTileBody}>
                      <Text style={styles.saleTilePrice}>${Number(sale.price || 0).toLocaleString()}</Text>
                      <Text style={styles.saleTileAddress} {...({ numberOfLines: 1 } as any)}>{fitAddressLine(streetAddress, cityLabel, undefined, 28)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        </View>

        {agent.hubUrl && (
          <View style={styles.bragFooterPinned}>
            {agent.hubUrl && (
              <View style={styles.pageOneQrRow} wrap={false}>
                <View style={styles.pageOneQrImageWrap}>
                  {/* The agent's initials sit in the code's own centre seal (lib/qrStyle) - not a badge
                      laid over the house logo, which drew a circle inside a circle. */}
                  <Image src={qrPdfSrc(agent.hubUrl, { size: 220, personal: getInitials(agent.name) ? { kind: 'initials', initials: getInitials(agent.name) } : undefined })} style={styles.pageOneQrImage} />
                </View>
                <View style={styles.pageOneQrTextWrap}>
                  <Text style={styles.pageOneQrEyebrow}>{agent.name?.split(' ')[0] ? `${agent.name.split(' ')[0]}'s Agent Hub` : 'Agent Hub'}</Text>
                  <Text style={styles.pageOneQrTitle}>Scan To See More From Me</Text>
                  <Text style={styles.pageOneQrSubtitle}>See all my listings, {salesRecent ? 'recent sales' : 'sales'}, and the easiest way to reach me — all in one place.</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </Page>

      {/* Page 2 (the Showcase pitch + "Create Your Own Showcase" QR) only exists for agents whose
          plan actually builds Showcases - buildBragSheetData only sets showcaseQrUrl for those.
          Printing it for anyone else would promise guests a Showcase that never arrives. */}
      {showcaseQrUrl && (
      <Page size="LETTER" style={styles.sheetPage}>
        <Text style={styles.adHeading}>Be The Most Informed Buyer</Text>
        <Text style={styles.adSubheading}>
          If you want the best odds of finding — and securing — the home you want, you need a Showcase: a private, evolving collection of homes matched to exactly what you're looking for, so you're never the last to know.
        </Text>

        {/* One centered label over both columns - they're both "what a showcase looks like" (the
            grid view and a zoomed-in single card), not two different, separately-labeled things. */}
        <Text style={styles.adTopRowLabel}>What A Showcase Looks Like</Text>
        <View style={styles.adTopRow}>
          <View style={styles.showcasePreviewCol}>
            <View style={styles.showcasePreviewCard}>
              <View style={styles.showcasePreviewGrid}>
                {[0, 1, 2, 3].map((i) => {
                  const sample = showcaseSamples.length > 0 ? showcaseSamples[i % showcaseSamples.length] : null;
                  const streetAddress = sample ? toTitleCase(getSaleStreetOnly(sample.address)) : '';
                  return (
                    <View key={i} style={styles.showcasePreviewTile}>
                      <View style={styles.showcasePreviewTilePhoto}>
                        {sample?.image ? (
                          <Image src={pdfImageUrl(sample.image)} style={styles.showcasePreviewTileImage} />
                        ) : (
                          <View style={styles.showcasePreviewTileNoImage}>
                            <FactIcon size={16} color={COLORS.border} paths={HOUSE_PATHS} />
                          </View>
                        )}
                        {i < 2 && (
                          <View style={styles.showcasePreviewTileBadge}>
                            <Text style={styles.showcasePreviewTileBadgeText}>New Match</Text>
                          </View>
                        )}
                        {sample?.schoolDistrict && (
                          <View style={styles.showcasePreviewTileSchoolScrim}>
                            <View style={styles.showcasePreviewTileSchoolPill}>
                              <SchoolIcon size={7} color={COLORS.white} />
                              <Text style={styles.showcasePreviewTileSchoolText} {...({ numberOfLines: 1 } as any)}>{sample.schoolDistrict}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <View style={styles.showcasePreviewTileFooter}>
                        <Text style={styles.showcasePreviewTilePrice}>{sample?.price ? `$${Number(sample.price).toLocaleString()}` : 'Price TBD'}</Text>
                        {streetAddress && <Text style={styles.showcasePreviewTileAddress} {...({ numberOfLines: 1 } as any)}>{fitAddressLine(streetAddress, sample?.city ? toTitleCase(sample.city) : '', undefined, 24)}</Text>}
                        <View style={styles.showcasePreviewTileActions}>
                          <View style={styles.showcasePreviewTileReactGroup}>
                            <View style={styles.showcasePreviewTileReactCircle}><FactIcon size={5.5} color={COLORS.text} paths={THUMB_UP_PATHS} /></View>
                            <View style={styles.showcasePreviewTileReactCircle}><FactIcon size={5.5} color={COLORS.muted} paths={THUMB_DOWN_PATHS} /></View>
                          </View>
                          <Text style={styles.showcasePreviewTileViewMore}>View More</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.showcasePreviewPriceBar}>
                <Text style={styles.showcasePreviewPriceText}>12 Homes Matched</Text>
                <Text style={styles.showcasePreviewCountText}>Updated Live</Text>
              </View>
            </View>
          </View>

          <View style={styles.mockupCol}>
            <View style={styles.mockupCard}>
              <View style={styles.mockupPhotoWrap}>
                {mainSample?.image ? (
                  <Image src={pdfImageUrl(mainSample.image)} style={styles.mockupPhotoImage} />
                ) : (
                  <FactIcon size={26} color={COLORS.border} paths={HOUSE_PATHS} />
                )}
                <View style={styles.mockupNewMatchBadge}>
                  <Text style={styles.mockupNewMatchText}>New Match</Text>
                </View>
                {mainSample?.schoolDistrict && (
                  <View style={styles.mockupSchoolBadgeWrap}>
                    <View style={styles.mockupSchoolPill}>
                      <SchoolIcon size={8} color={COLORS.white} />
                      <Text style={styles.mockupSchoolText} {...({ numberOfLines: 1 } as any)}>{mainSample.schoolDistrict}</Text>
                    </View>
                  </View>
                )}
              </View>
              <View style={styles.mockupBody}>
                <View style={styles.mockupTopRow}>
                  <View>
                    <Text style={styles.mockupPrice}>{mainSample?.price ? `$${Number(mainSample.price).toLocaleString()}` : 'Price TBD'}</Text>
                    <Text style={styles.mockupAddress} {...({ numberOfLines: 1 } as any)}>{fitAddressLine(mainSampleStreet, mainSampleCity, undefined, 30) || 'Address unavailable'}</Text>
                    <Text style={styles.mockupFacts}>
                      {[
                        mainSample?.beds != null && `${mainSample.beds} BD`,
                        mainSample?.baths != null && `${mainSample.baths} BA`,
                        mainSample?.sqft != null && `${Number(mainSample.sqft).toLocaleString()} SF`,
                      ].filter(Boolean).join('    ') || 'Details available in your Showcase'}
                    </Text>
                  </View>
                  <View style={styles.mockupReactRow}>
                    <View style={styles.mockupReactCircle}><FactIcon size={9} color={COLORS.text} paths={THUMB_UP_PATHS} /></View>
                    <View style={styles.mockupReactCircle}><FactIcon size={9} color={COLORS.muted} paths={THUMB_DOWN_PATHS} /></View>
                  </View>
                </View>
                <View style={styles.mockupTourBtn}><Text style={styles.mockupTourBtnText}>SCHEDULE TOUR</Text></View>
              </View>
              <View style={styles.mockupCommentsWrap}>
                <View style={styles.mockupCommentsHeaderRow}>
                  <FactIcon size={9} color={COLORS.accent} paths={MESSAGE_SQUARE_PATHS} />
                  <Text style={styles.mockupCommentsHeaderText}>Comments</Text>
                </View>
                <View style={styles.mockupCommentBubble}>
                  <Text style={styles.mockupCommentName}>Guest</Text>
                  <Text style={styles.mockupCommentText}>Can we visit this weekend?</Text>
                </View>
                <View style={styles.mockupCommentBubbleAgent}>
                  <View style={styles.mockupCommentAgentHeader}>
                    <AgentPhoto url={agent.photoUrl} name={agent.name} size={12} position={agent.photoPosition} />
                    <Text style={styles.mockupCommentAgentName}>{agent.name?.split(' ')[0] || 'You'}</Text>
                  </View>
                  <Text style={styles.mockupCommentText}>Of course! Would you like to see the seller's disclosure for it?</Text>
                </View>
                <View style={styles.mockupCommentInput}>
                  <Text style={styles.mockupCommentPlaceholder}>Type your message...</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.adBottomWrap}>
          <Text style={styles.adBottomLabel}>Your Best Chance At Staying Informed</Text>
          <View style={styles.adBottomRow} wrap={false}>
            <View style={styles.adFeatureCol}>
              {[
                { icon: 'heart' as const, title: 'Like, Dislike & Comment', body: 'React to every home and leave notes for me, right from your phone.' },
                { icon: 'calendar' as const, title: 'Request A Tour', body: 'See something you love? Request a showing with one tap.' },
              ].map(item => {
                const Icon = ICONS[item.icon];
                return (
                  <View key={item.title} style={styles.bulletCardCompact}>
                    <View style={styles.bulletPhotoSquare}><Icon size={14} /></View>
                    <View style={styles.bulletTextWrapCompact}>
                      <Text style={styles.bulletTitleCompact}>{item.title}</Text>
                      <Text style={styles.bulletBodyCompact}>{item.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {showcaseQrUrl && (
              <View style={[styles.adQrBlock, { padding: 12, marginTop: 0, width: 168, flexShrink: 0 }]}>
                <Text style={[styles.adQrCta, { fontSize: 9.5 }]}>Create Your Own Showcase</Text>
                <View style={[styles.adQrImageWrap, { width: 84, height: 84 }]}>
                  <Image src={qrPdfSrc(showcaseQrUrl, { size: 300, ecc: 'H' })} style={[styles.adQrImage, { width: 84, height: 84 }]} />
                  <View style={[styles.adQrLogoWrap, { top: 26, left: 26, width: 32, height: 32 }]}>
                    <FactIcon size={16} color={COLORS.accent} paths={SPARKLES_PATHS} />
                  </View>
                </View>
                <Text style={[styles.bulletBodyCompact, { textAlign: 'center', marginTop: 8 }]}>Scan and answer a few quick questions — your personalized Showcase builds itself.</Text>
              </View>
            )}

            <View style={styles.adFeatureCol}>
              {[
                { icon: 'house' as const, title: 'Matched To You', body: "Built around exactly what you're looking for — not a generic search." },
                { icon: 'bell' as const, title: 'Instant Alerts', body: 'Get notified the moment a new matching home or price drop appears.' },
              ].map(item => {
                const Icon = ICONS[item.icon];
                return (
                  <View key={item.title} style={styles.bulletCardCompact}>
                    <View style={styles.bulletPhotoSquare}><Icon size={14} /></View>
                    <View style={styles.bulletTextWrapCompact}>
                      <Text style={styles.bulletTitleCompact}>{item.title}</Text>
                      <Text style={styles.bulletBodyCompact}>{item.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Page>
      )}
    </Document>
  );
};

// Simple stroke-based fact icons (lucide-react path data, rendered via react-pdf's Svg primitives)
const FactIcon = ({ paths, size = 13, color = COLORS.accent }: { paths: string[]; size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {paths.map((d, i) => (
      <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </Svg>
);

const ICONS = {
  bed: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M2 4v16', 'M2 8h18a2 2 0 0 1 2 2v10', 'M2 17h20', 'M6 8v9']} />,
  bath: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M10 4 8 6', 'M17 19v2', 'M2 12h20', 'M7 19v2', 'M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5']} />,
  ruler: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z', 'm14.5 12.5 2-2', 'm11.5 9.5 2-2', 'm8.5 6.5 2-2', 'm17.5 15.5 2-2']} />,
  dollar: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M12 2v20', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']} />,
  mapPin: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z']} />,
  gradCap: ({ size, color }: { size?: number; color?: string } = {}) => <FactIcon size={size} color={color} paths={['M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z', 'M22 10v6', 'M6 12.5V16a6 3 0 0 0 12 0v-3.5']} />,
  calendar: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M8 2v4', 'M16 2v4', 'M3 4h18v18H3Z', 'M3 10h18']} />,
  droplet: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z']} />,
  waves: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1', 'M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1', 'M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1']} />,
  landPlot: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['m12 8 6-3-6-3v10', 'm8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12', 'm6.49 12.85 11.02 6.3', 'M17.51 12.85 6.5 19.15']} />,
  flame: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z']} />,
  snowflake: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['m10 20-1.25-2.5L6 18', 'M10 4 8.75 6.5 6 6', 'm14 20 1.25-2.5L18 18', 'm14 4 1.25 2.5L18 6', 'm17 21-3-6h-4', 'm17 3-3 6 1.5 3', 'M2 12h6.5L10 9', 'm20 10-1.5 2 1.5 2', 'M22 12h-6.5L14 15', 'm4 10 1.5 2L4 14', 'm7 21 3-6-1.5-3', 'm7 3 3 6h4']} />,
  house: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z']} />,
  squareCheck: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M3 3h18v18H3Z', 'm9 12 2 2 4-4']} />,
  bell: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M10.268 21a2 2 0 0 0 3.464 0', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326']} />,
  heart: ({ size }: { size?: number } = {}) => <FactIcon size={size} paths={['M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5']} />,
};

// Lucide's "School" icon (paths + the window circle) - the same symbol PropertyCard.tsx uses for
// the school-district badge on a real showcase's property photos, reused here so the Brag Sheet's
// mock-up actually matches instead of using the unrelated graduation-cap glyph.
const SCHOOL_PATHS = ['M14 21v-3a2 2 0 0 0-4 0v3', 'M18 5v16', 'm4 6 7.106-3.79a2 2 0 0 1 1.788 0L20 6', 'm6 11-3.52 2.147a1 1 0 0 0-.48.854V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a1 1 0 0 0-.48-.853L18 11', 'M6 5v16'];
const SchoolIcon = ({ size = 10, color = COLORS.white }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    {SCHOOL_PATHS.map((d, i) => (
      <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    ))}
    <Circle cx={12} cy={9} r={2} fill="none" stroke={color} strokeWidth={2} />
  </Svg>
);

const THUMB_UP_PATHS = ['M7 10v12', 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'];
const THUMB_DOWN_PATHS = ['M17 14V2', 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z'];
const MESSAGE_SQUARE_PATHS = ['M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z'];
const HOUSE_PATHS = ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'];
const SPARKLES_PATHS = ['M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z', 'M20 3v4', 'M22 5h-4', 'M4 17v2', 'M5 18H3'];

const InfoLineRow = ({ items }: { items: { icon: keyof typeof ICONS; label: string; value: string }[] }) => (
  <View style={styles.basicInfoRow} wrap={false}>
    {items.map(item => {
      const Icon = ICONS[item.icon];
      return (
        <View key={item.label} style={styles.basicInfoItem}>
          <View style={styles.basicInfoIconCircle}><Icon size={9} /></View>
          <Text style={styles.basicInfoValue} {...({ numberOfLines: 2 } as any)}>{item.value}</Text>
          <Text style={styles.basicInfoLabel}>{item.label}</Text>
        </View>
      );
    })}
  </View>
);

const FactTile = ({ icon, label, value, wide, tight, maxLines = 2, fit }: { icon: keyof typeof ICONS; label: string; value: string; wide?: boolean; tight?: boolean; maxLines?: number; fit?: CheatFit }) => {
  const Icon = ICONS[icon];
  const f = fit || CHEAT_FIT[0];
  const tile = { paddingVertical: f.tilePad, marginBottom: f.tileGap };
  const circle = { width: f.icon, height: f.icon, borderRadius: f.icon / 2 };
  const valueSize = { fontSize: tight ? f.value - 1.1 : f.value };
  return (
    <View style={wide ? [styles.factTile, styles.factTileWide, tile] : [styles.factTile, tile]} wrap={false}>
      <View style={[styles.factIconCircle, circle]}><Icon /></View>
      <View style={styles.factTileText}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={[tight ? styles.factValueTight : styles.factValue, valueSize]} {...({ numberOfLines: maxLines } as any)}>{value}</Text>
      </View>
    </View>
  );
};

// The Cheat Sheet is ALWAYS exactly 2 pages (user, 10/17: page 2's bottom printed onto a 3rd page -
// "this can never happen"). Four sizes, from roomy to compact: a little tighter tiles, a shorter
// description, fewer "What's Nearby" items, a smaller QR row. fitCheatSheetLevel() renders the
// sheet and uses the first size that comes out at 2 pages; on top of that, page 2 itself is locked
// to one page (its content area is a fixed height and the QR row always sits at its bottom), so even
// an unmeasured sheet can never spill onto a third page.
type CheatFit = { tilePad: number; tileGap: number; icon: number; value: number; desc: number; descChars: number | null; amenityDrop: number; actionH: number; qr: number; disclaimer: boolean; headGap: number };
const CHEAT_FIT: CheatFit[] = [
  { tilePad: 7, tileGap: 8, icon: 26, value: 9.5, desc: 8.8, descChars: null, amenityDrop: 0, actionH: 148, qr: 80, disclaimer: true, headGap: 16 },
  { tilePad: 5, tileGap: 6, icon: 22, value: 9, desc: 8.3, descChars: 260, amenityDrop: 0, actionH: 140, qr: 74, disclaimer: true, headGap: 12 },
  { tilePad: 4, tileGap: 5, icon: 20, value: 8.6, desc: 8, descChars: 210, amenityDrop: 1, actionH: 128, qr: 66, disclaimer: false, headGap: 10 },
  { tilePad: 3, tileGap: 4, icon: 18, value: 8.2, desc: 7.6, descChars: 150, amenityDrop: 2, actionH: 116, qr: 58, disclaimer: false, headGap: 8 },
];
const LETTER_H = 792;
const SHEET_PAD = 35;

interface CheatSheetProperty {
  id?: string | number | null;
  listingKey?: string | number | null;
  ListingKey?: string | number | null;
  // The specific Open House event this cheat sheet was built for - lets the "Request Seller
  // Disclosure" / "Schedule a Second Visit" QR codes land on that exact property's guest form
  // without the visitor having to type the address, same as the sign-in flow.
  openHouseEventId?: string | null;
  address: string;
  city?: string;
  state?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  googleRooftopLatitude?: number | string | null;
  googleRooftopLongitude?: number | string | null;
  google_rooftop_latitude?: number | string | null;
  google_rooftop_longitude?: number | string | null;
  googleGeocodeLocationType?: string | null;
  google_geocode_location_type?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  price?: number;
  priceHistory?: any[] | null;
  price_history?: any[] | null;
  PriceHistory?: any[] | null;
  originalListPrice?: number | string | null;
  OriginalListPrice?: number | string | null;
  previousListPrice?: number | string | null;
  PreviousListPrice?: number | string | null;
  priceChangeTimestamp?: string | null;
  PriceChangeTimestamp?: string | null;
  majorChangeTimestamp?: string | null;
  MajorChangeTimestamp?: string | null;
  majorChangeType?: string | null;
  MajorChangeType?: string | null;
  beds?: number;
  baths?: number;
  sqft?: number;
  aboveGradeSqft?: number;
  belowGradeSqft?: number;
  acres?: number;
  township?: string;
  schoolDistrict?: string;
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  taxAnnualAmount?: number;
  taxYear?: number;
  yearBuilt?: number;
  waterSource?: string[] | string | null;
  sewer?: string[] | string | null;
  heating?: string[] | string | null;
  heatingFuel?: string[] | string | null;
  cooling?: string[] | string | null;
  hoaFee?: number | null;
  hoaFeeFrequency?: string | null;
  hoaIncludes?: string[] | string | null;
  description?: string;
  // AI-condensed "Highlights of [address]" paragraph (2-4 sentences, see cheat_sheet_highlights
  // in ai_copywrite_service.py). When present + non-empty, the Cheat Sheet's Open House Guide page
  // shows it (prefixed with the address heading) instead of the truncated MLS description
  // paragraph. `string[]` is accepted too, only so an older bullet-list snapshot (pre-paragraph
  // format) still renders - normalizeHighlightsParagraph joins it into one paragraph.
  descriptionHighlights?: string | string[] | null;
  photos?: (string | CheatSheetPhoto)[];
}

interface CheatSheetAgent {
  id?: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  brokerage?: string;
  photoUrl?: string;
  photoPosition?: { x: number; y: number };
  hubUrl?: string | null;
}

const photoStyle = (photo: CheatSheetPhoto | null, baseStyle: any) => (
  photo ? [baseStyle, { objectPosition: `${photo.x ?? 50}% ${photo.y ?? 50}%` }] : baseStyle
);

const propertyActionUrl = (property: CheatSheetProperty, agent: CheatSheetAgent, action: 'tour' | 'disclosure') => {
  const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://openhousepal.com';
  // Preferred path: scoped to this specific Open House event, so the guest form already knows
  // the property (no address entry) - same pattern as the sign-in QR.
  if (property.openHouseEventId) {
    const openHousePath = action === 'disclosure' ? 'disclosure' : 'second-visit';
    return `${clientUrl}/open-house/${encodeURIComponent(String(property.openHouseEventId))}/${openHousePath}`;
  }
  // Fallback for cheat sheets built without an event id (shouldn't normally happen).
  const propertyId = property.listingKey || property.ListingKey || property.id || 'listing';
  const agentId = agent.id || 'agent';
  return `${clientUrl}/property/${encodeURIComponent(String(propertyId))}/${encodeURIComponent(agentId)}?action=${action}`;
};

const qrCodeUrl = (url: string, size = 140) => qrPdfSrc(url, { size });

const formatShortDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const priceHistoryRows = (property: CheatSheetProperty) => {
  const raw = property.priceHistory || property.price_history || property.PriceHistory || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: any) => {
      const price = row.price || row.ListPrice || row.list_price || row.amount || row.value;
      const date = row.date || row.Date || row.timestamp || row.ModificationTimestamp || row.change_date;
      const label = row.event || row.Event || row.status || row.MlsStatus || 'Price';
      const formattedPrice = formatCurrencyCompact(price);
      if (!formattedPrice) return '';
      return `${formatShortDate(date) || label}: ${formattedPrice}`;
    })
    .filter(Boolean)
    .slice(0, 4);
};

const priceHistoryFallbackRows = (property: CheatSheetProperty) => {
  const originalPrice = property.originalListPrice || property.OriginalListPrice;
  const previousPrice = property.previousListPrice || property.PreviousListPrice;
  const priceChangedAt = property.priceChangeTimestamp || property.PriceChangeTimestamp;
  const majorChangedAt = property.majorChangeTimestamp || property.MajorChangeTimestamp;
  const changeType = property.majorChangeType || property.MajorChangeType;
  if (originalPrice && Number(originalPrice) !== Number(property.price)) {
    return [
      `Original: ${formatCurrencyCompact(originalPrice)}`,
      ...(previousPrice && Number(previousPrice) !== Number(originalPrice) && Number(previousPrice) !== Number(property.price) ? [`Previous: ${formatCurrencyCompact(previousPrice)}`] : []),
      `Current: ${formatCurrencyCompact(property.price) || 'Available'}`,
      ...(priceChangedAt || majorChangedAt ? [`Changed: ${formatShortDate(priceChangedAt || majorChangedAt)}${changeType ? ` (${changeType})` : ''}`] : []),
    ];
  }
  if (previousPrice && Number(previousPrice) !== Number(property.price)) {
    return [
      `Previous: ${formatCurrencyCompact(previousPrice)}`,
      `Current: ${formatCurrencyCompact(property.price) || 'Available'}`,
      ...(priceChangedAt || majorChangedAt ? [`Changed: ${formatShortDate(priceChangedAt || majorChangedAt)}${changeType ? ` (${changeType})` : ''}`] : []),
    ];
  }
  if (priceChangedAt) {
    return [
      `Current: ${formatCurrencyCompact(property.price) || 'Available'}`,
      `Updated: ${formatShortDate(priceChangedAt)}`,
    ];
  }
  return ['No full Bright MLS price history stored.'];
};

const AmenityCategory = ({ label, places, maxItems, showCity }: { label: string; places: AmenityPlace[]; maxItems: number; showCity?: boolean }) => {
  if (!places || places.length === 0) return null;
  return (
    <View style={styles.amenityCategory} wrap={false}>
      <Text style={styles.amenityCategoryLabel}>{label}</Text>
      {places.slice(0, maxItems).map((place, i) => (
        <View key={`${place.name}-${i}`} style={styles.amenityRow}>
          <View style={{ flex: 1 }}>
            {place.place_type && <Text style={styles.amenityTypeTag}>{place.place_type}</Text>}
            <Text style={styles.amenityName} {...({ numberOfLines: 1 } as any)}>{showCity && cityFromAddress(place.address) ? `${place.name} - ${cityFromAddress(place.address)}` : place.name}</Text>
          </View>
          {place.distance_miles != null && <Text style={styles.amenityDistance}>{place.distance_miles} mi</Text>}
        </View>
      ))}
    </View>
  );
};

type PackTile = { icon: keyof typeof ICONS; label: string; value: string; wide?: boolean; tight?: boolean; maxLines?: number };
/** Two half-width tiles per row; a half tile that would sit alone (before a full-width tile, or last)
 *  becomes full width instead of leaving an empty half. */
function packFactTiles(tiles: PackTile[]): PackTile[] {
  const out = tiles.map(t => ({ ...t }));
  let run: number[] = [];
  const flush = () => { if (run.length % 2 === 1) out[run[run.length - 1]].wide = true; run = []; };
  out.forEach((t, i) => { if (t.wide) flush(); else run.push(i); });
  flush();
  return out;
}

type CheatSheetProps = { property: CheatSheetProperty; agent: CheatSheetAgent; amenities?: CheatSheetAmenities };

const pdfPageCount = async (el: React.ReactElement) => {
  const text = await (await pdf(el as any).toBlob()).text();
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
};

const fitCache = new WeakMap<object, Promise<number>>();
/** The roomiest Cheat Sheet size that prints on exactly 2 pages (0 = normal ... 3 = most compact). */
export function fitCheatSheetLevel(props: CheatSheetProps): Promise<number> {
  const key = props.property as object;
  const hit = key && fitCache.get(key);
  if (hit) return hit;
  const run = (async () => {
    for (let level = 0; level < CHEAT_FIT.length; level++) {
      try {
        if (await pdfPageCount(<OpenHouseCheatSheetDocument {...props} fit={level} measure />) <= 2) return level;
      } catch {
        return CHEAT_FIT.length - 1;
      }
    }
    return CHEAT_FIT.length - 1;
  })();
  if (key) fitCache.set(key, run);
  return run;
}

export const OpenHouseCheatSheetDocument = ({ property, agent, amenities, fit = 0, measure = false }: CheatSheetProps & {
  /** Size level (see CHEAT_FIT) - pick it with fitCheatSheetLevel(). */
  fit?: number
  /** Internal: lay page 2 out freely so fitCheatSheetLevel can see whether it spills. */
  measure?: boolean
}) => {
  const f = CHEAT_FIT[Math.max(0, Math.min(CHEAT_FIT.length - 1, fit))];
  // What the sheet shows is worked out in lib/cheatSheetContent.ts - shared with the Guest Pass's
  // web version of this same Cheat Sheet, so the two always match.
  const {
    coverPhoto, detailPhotoOne, detailPhotoTwo, heroAddress, staticMapUrl, basicInfo, propertyInfoLine, propertyInfo,
    highlights, descriptionText, hasAssignedSchools, hasSchoolTownship, canPairSchoolTiles, publicSchoolsDisplayValue,
    cleanedSchoolTownship, hasAmenities, amenityItemCap: baseAmenityCap,
  } = buildCheatSheetContent(property, amenities);
  const amenityItemCap = Math.max(1, baseAmenityCap - f.amenityDrop);
  const description = descriptionText && f.descChars ? truncateAtCleanSentence(descriptionText, f.descChars) : descriptionText;
  const descStyle = { fontSize: f.desc, lineHeight: f.desc < 8.5 ? 1.38 : 1.45 };
  // Page 2's content area: whatever the page holds above the QR row.
  const flowHeight = LETTER_H - SHEET_PAD * 2 - f.actionH - 16;
  const disclosureUrl = propertyActionUrl(property, agent, 'disclosure');
  const tourUrl = propertyActionUrl(property, agent, 'tour');

  return (
    <Document>
      <Page size="LETTER" style={styles.sheetPage}>
        {agent.brokerage && <Text style={styles.brokerageMasthead}>{agent.brokerage}</Text>}
        <View style={styles.mastheadDivider} />

        <View style={styles.heroWrap}>
          {coverPhoto ? <Image src={pdfImageUrl(coverPhoto.url)} style={photoStyle(coverPhoto, styles.heroPhoto)} /> : <View style={[styles.heroPhoto, { backgroundColor: COLORS.panel }]} />}
          <View style={styles.heroAddressBadge}>
            <Svg width={9} height={11} viewBox="0 0 24 24">
              <Path fill={COLORS.white} d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
            </Svg>
            <Text style={styles.heroAddressText} {...({ numberOfLines: 1 } as any)}>{heroAddress}</Text>
          </View>
        </View>

        <View style={styles.photoRow}>
          {detailPhotoOne ? <Image src={pdfImageUrl(detailPhotoOne.url)} style={photoStyle(detailPhotoOne, styles.photoHalf)} /> : <View style={[styles.photoHalf, { backgroundColor: COLORS.panel }]} />}
          {detailPhotoTwo ? <Image src={pdfImageUrl(detailPhotoTwo.url)} style={photoStyle(detailPhotoTwo, styles.photoHalf)} /> : <View style={[styles.photoHalf, { backgroundColor: COLORS.panel }]} />}
        </View>

        <View style={styles.frontFactsRow} wrap={false}>
          <View style={styles.frontPriceCard}>
            <Text style={styles.frontPriceLabel}>Price</Text>
            <Text style={styles.frontPriceValue}>{formatCurrencyCompact(property.price) || 'Available'}</Text>
          </View>
          <View style={styles.frontBasicInfo}>
            <InfoLineRow items={basicInfo} />
          </View>
        </View>

        <View style={styles.frontAgentCard}>
          <AgentPhoto url={agent.photoUrl} name={agent.name} size={34} position={agent.photoPosition} />
          <View style={styles.frontAgentInfo}>
            <Text style={styles.frontAgentName}>{agent.name}</Text>
            {agent.title && <Text style={styles.frontAgentDetail}>{agent.title}</Text>}
            {agent.phone && <Text style={styles.frontAgentDetail}>{agent.phone}</Text>}
            {agent.email && <Text style={styles.frontAgentDetail}>{agent.email}</Text>}
          </View>
          {agent.hubUrl && (
            <View style={styles.frontAgentQrCard}>
              <Image src={qrPdfSrc(agent.hubUrl, { size: 160 })} style={styles.frontAgentQrImage} />
              <Text style={styles.frontAgentQrCaption}>Agent Hub</Text>
            </View>
          )}
        </View>
      </Page>

      <Page size="LETTER" style={styles.sheetPage} wrap={measure}>
        <View style={measure ? styles.pageTwoFlowContent : [styles.pageTwoFlowContent, { height: flowHeight, overflow: 'hidden' }]}>
          <View style={styles.backHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetHeading}>{heroAddress}</Text>
              <Text style={[styles.sheetSubheading, { marginBottom: f.headGap }]}>Open House Guide</Text>
            </View>
            {!!property.price && <Text style={[styles.backHeaderPrice, { marginBottom: f.headGap }]}>${Number(property.price).toLocaleString()}</Text>}
          </View>

          {highlights ? (
            <Text style={[styles.descriptionText, styles.highlightsParagraph, descStyle]} wrap={false}>
              <Text style={styles.highlightsParagraphLabel}>{highlights.prefix}</Text>
              {highlights.body}
            </Text>
          ) : (
            description && <Text style={[styles.descriptionText, descStyle]} wrap={false}>{description}</Text>
          )}

          <View style={styles.sectionBlock} wrap={false}>
            <Text style={styles.sectionLabel}>Property Info</Text>
            <InfoLineRow items={propertyInfoLine} />
          </View>

          {/* Every fact tile in one grid, two to a row (user, 10/17 - 1330 N Avignon had no assigned
              schools, so the district tile sat alone in its own row with an empty half beside it, and
              HOA Covers was left alone under HOA Fee). A half-width tile that would end up alone on its
              row is stretched full width, so there is never a gap. */}
          <View style={[styles.factTileGrid, { marginTop: 10 }]} wrap={false}>
            {packFactTiles([
              ...(hasAssignedSchools ? [{ icon: 'gradCap' as const, label: 'Public Schools - (Elementary, Middle, High)', value: publicSchoolsDisplayValue, wide: !canPairSchoolTiles, tight: true, maxLines: canPairSchoolTiles ? 2 : 3 }] : []),
              ...(hasSchoolTownship ? [{ icon: 'gradCap' as const, label: 'School District / Township', value: cleanedSchoolTownship, tight: true, maxLines: 2 }] : []),
              ...propertyInfo.map(fact => ({ icon: fact.icon, label: fact.label, value: fact.value, wide: !!fact.wide })),
            ]).map(t => <FactTile key={t.label} icon={t.icon} label={t.label} value={t.value} wide={t.wide} tight={t.tight} maxLines={t.maxLines} fit={f} />)}
          </View>
          {hasAssignedSchools && f.disclaimer && (
            <Text style={styles.schoolDisclaimer}>
              School assignments are based on available attendance-boundary data and should be verified with the local school district.
            </Text>
          )}

          {hasAmenities && (
            <View style={styles.amenitiesSection}>
              <Text style={styles.sectionLabel}>What's Nearby</Text>
              <View style={[styles.salesGrid, { marginTop: 8 }]}>
                <View style={{ width: '48%' }}>
                  <AmenityCategory label="Nearby Private Schools" places={amenities!.private_schools} maxItems={amenityItemCap} />
                  <AmenityCategory label="Grocery Stores Nearby" places={amenities!.grocery_stores} maxItems={amenityItemCap} showCity />
                  <AmenityCategory label="Parks Nearby" places={amenities!.parks} maxItems={amenityItemCap} showCity />
                </View>
                <View style={{ width: '48%' }}>
                  <AmenityCategory label="Medical Care Nearby" places={amenities!.medical_care} maxItems={amenityItemCap} />
                  <AmenityCategory label="Major Airports Nearby" places={amenities!.airports} maxItems={amenityItemCap} />
                  <AmenityCategory label="Nearby Downtown Areas" places={amenities!.downtown_areas} maxItems={amenityItemCap} />
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.pageTwoActionRow, { height: f.actionH }]} wrap={false}>
          <View style={[styles.qrActionCard, { height: f.actionH }]}>
            <Text style={styles.qrActionEyebrow}>Documents</Text>
            <Image src={qrCodeUrl(disclosureUrl)} style={[styles.qrActionImage, { width: f.qr, height: f.qr }]} />
            <Text style={styles.qrActionLabel}>Request Seller Disclosure</Text>
            <Text style={styles.qrActionHint}>Scan for disclosure and property docs</Text>
          </View>
          <View style={[styles.areaMapCard, { height: f.actionH }]}>
            {staticMapUrl ? (
              <Image src={staticMapUrl} style={styles.areaMapImage} />
            ) : (
              <View style={styles.areaMapFallback}>
                <Text style={styles.areaMapFallbackText}>Map unavailable until Google Maps Static API is enabled.</Text>
              </View>
            )}
          </View>
          <View style={[styles.qrActionCard, { height: f.actionH }]}>
            <Text style={styles.qrActionEyebrow}>Visit Again</Text>
            <Image src={qrCodeUrl(tourUrl)} style={[styles.qrActionImage, { width: f.qr, height: f.qr }]} />
            <Text style={styles.qrActionLabel}>Schedule a Second Visit</Text>
            <Text style={styles.qrActionHint}>Scan to request another showing</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export const SimilarPropertiesDocument = ({ properties, agentId, address, openHouseEventId, showMatchScore = true }: any) => {
  if (!properties || properties.length === 0) return null;
  const chunkArray = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
  // When Match Score is on, lead with the best matches instead of whatever order they were
  // selected/fetched in.
  const orderedProperties = showMatchScore
    ? [...properties].sort((a: any, b: any) => (typeof b.matchScore === 'number' ? b.matchScore : -1) - (typeof a.matchScore === 'number' ? a.matchScore : -1))
    : properties;
  const propertyPages = chunkArray(orderedProperties, 6);
  // The `address` prop is "Street, City" with no state - the comps are all in the same area as
  // the subject, so borrow the state off the first one rather than threading it through the caller.
  const subjectState = String(orderedProperties[0]?.StateOrProvince || orderedProperties[0]?.state || '').trim();
  const headerSubject = address
    ? (subjectState && !/,\s*[A-Za-z]{2}\.?$/.test(address) ? `${address}, ${subjectState}` : address)
    : 'This Property';
  const similarRequestUrl = openHouseEventId
    ? `${process.env.NEXT_PUBLIC_CLIENT_URL || "https://openhousepal.com"}/open-house/${openHouseEventId}?intent=similar`
    : null;
  const similarRequestQrUrl = similarRequestUrl
    ? qrPdfSrc(similarRequestUrl, { size: 200 })
    : null;

  return (
    <Document>
      {propertyPages.map((pageItems, pageIndex) => {
        return (
          <Page key={pageIndex} size="LETTER" style={styles.recPage}>
            <View style={styles.recHeader}>
              <Text style={styles.recHeaderTitle}>
                Similar Homes To: <Text style={styles.recHeaderSubject}>{headerSubject}</Text>
              </Text>
              <Text style={{ fontSize: 7, color: COLORS.muted }}>Page {pageIndex + 1} of {propertyPages.length}</Text>
            </View>
            <View style={styles.grid}>
              {pageItems.map((item: any) => <PropertyPDFCard key={item.id} item={item} agentId={agentId} showMatchScore={showMatchScore} openHouseEventId={openHouseEventId} />)}
            </View>

            {similarRequestQrUrl && (
              <View style={styles.recFooter}>
                <View style={styles.recFooterRow}>
                  <Image src={similarRequestQrUrl} style={styles.recFooterQr} />
                  <View style={styles.recFooterTextWrap}>
                    <Text style={styles.recFooterEyebrow}>Scan to Get Started</Text>
                    <Text style={styles.recFooterTitle}>Want to see more homes like these?</Text>
                    <Text style={styles.recFooterSubtitle}>Scan to view them all, request tours, like or pass, compare favorites, and get updates when new matches arrive — all in your personalized Showcase.</Text>
                  </View>
                </View>
              </View>
            )}
          </Page>
        );
      })}
    </Document>
  );
};

// ============================================================================
// CMA Presentation Document
// ============================================================================

interface CmaPdfAgent {
  name: string;
  headshot_url?: string | null;
  photo_url?: string | null;
  profile_photo_url?: string | null;
  profile_image_url?: string | null;
  avatar_url?: string | null;
  avatar?: string | null;
  brokerage?: string | null;
  email?: string | null;
  phone?: string | null;
  service_area?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

const cma = StyleSheet.create({
  page: { paddingHorizontal: 34, paddingTop: 30, paddingBottom: 44, backgroundColor: COLORS.white, fontFamily: 'Montserrat' },
  // coverMetaRow (agent name / contact / date footer) is a normal last child in the column flow
  // with marginTop:'auto', so it sits flush to the bottom padding when content is short and
  // directly under the content when it's tall - never reserving a fixed block. The earlier
  // approach (absolute footer + large paddingBottom to "reserve" its space) subtracted ~100pt
  // from the usable page and pushed a tall subject block onto a blank 2nd page.
  coverPage: { position: 'relative', backgroundColor: COLORS.white, color: COLORS.text, fontFamily: 'Montserrat', flexDirection: 'column', justifyContent: 'flex-start', padding: 42 },
  coverHero: { position: 'relative', height: '100%', padding: 42 },
  coverImage: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' },
  coverScrim: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', backgroundColor: 'rgba(17,24,39,0.82)' },
  coverAccentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: '#C9A24D' },
  coverContent: { position: 'relative', flexGrow: 1, justifyContent: 'space-between' },
  coverLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 3.2, color: '#C9A24D', fontWeight: 900, marginBottom: 12 },
  coverWatermark: { position: 'absolute', top: 38, right: 38, fontSize: 72, fontFamily: 'Playfair Display', fontWeight: 900, color: '#F0F1F3', lineHeight: 1 },
  coverIntroRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: -4, marginBottom: 15 },
  coverAgentAvatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.panel, alignItems: 'center', justifyContent: 'center' },
  coverAgentPhoto: { width: 64, height: 64, borderRadius: 32, objectFit: 'cover' },
  coverSubjectBlock: { width: '100%', borderLeft: '5 solid #C9A24D', paddingLeft: 16, paddingVertical: 8, marginTop: 0 },
  coverSubjectPill: { alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 12, paddingVertical: 5, paddingHorizontal: 11, marginBottom: 12 },
  coverSubjectPillText: { fontSize: 7, color: COLORS.white, textTransform: 'uppercase', letterSpacing: 1.7, fontWeight: 900 },
  coverTitle: { fontSize: 27, fontFamily: 'Playfair Display', fontWeight: 900, lineHeight: 1.12, color: COLORS.text },
  coverLocation: { fontSize: 10, color: COLORS.subtext, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1.3, fontWeight: 700 },
  coverMetaRow: { paddingTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTop: `1 solid ${COLORS.line}` },
  coverAgentName: { fontSize: 12, fontWeight: 900, color: COLORS.text },
  coverAgentDetail: { fontSize: 8, color: COLORS.subtext, marginTop: 2 },
  coverDate: { fontSize: 8, color: COLORS.subtext, textAlign: 'right' },
  pageHeader: { backgroundColor: COLORS.white, marginHorizontal: -34, marginTop: -30, marginBottom: 18, paddingHorizontal: 34, paddingTop: 22, paddingBottom: 14, borderBottom: `1 solid ${COLORS.line}` },
  pageHeaderAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#C9A24D' },
  pageHeaderLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 2.4, color: '#C9A24D', fontWeight: 900, marginBottom: 5 },
  pageHeaderTitle: { fontSize: 21, fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.text, lineHeight: 1.12 },
  pageHeaderSub: { fontSize: 9, color: COLORS.subtext, marginTop: 5, lineHeight: 1.35 },
  subjectHeadshotMark: { position: 'absolute', right: 34, top: 20, width: 42, height: 42, borderRadius: 21, objectFit: 'cover', border: `1 solid ${COLORS.border}` },
  subjectInitialsMark: { position: 'absolute', right: 34, top: 20, width: 42, height: 42, borderRadius: 21, border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.panel, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 16, left: 34, right: 34, flexDirection: 'column', paddingTop: 8 },
  footerAccent: { height: 1.4, backgroundColor: '#C9A24D', opacity: 0.55, marginBottom: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7, color: COLORS.muted },
  footerPageNum: { fontSize: 7, color: COLORS.muted, fontWeight: 700 },
  // "Not an appraisal" disclaimer - on every page (fixed footer) and again, in full, on the cover.
  footerDisclaimer: { fontSize: 5.4, color: COLORS.muted, textAlign: 'left', marginTop: 3 },
  coverDisclaimer: { fontSize: 6.6, color: COLORS.muted, lineHeight: 1.4, marginTop: 12, paddingTop: 9, borderTop: `1 solid ${COLORS.line}` },
  sectionLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 2.2, color: '#8b7355', marginBottom: 6, fontWeight: 900 },
  h1: { fontSize: 24, fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.text, marginBottom: 4, lineHeight: 1.12 },
  h2: { fontSize: 16, fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.text, marginBottom: 10 },
  card: { backgroundColor: COLORS.white, borderRadius: 10, border: `1 solid ${COLORS.border}`, padding: 14 },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  factCell: { width: '25%', marginBottom: 11, paddingRight: 8 },
  factValue: { fontSize: 11, fontWeight: 700, color: COLORS.text, lineHeight: 1.15 },
  factLabel: { fontSize: 6.2, textTransform: 'uppercase', letterSpacing: 0.85, color: COLORS.muted, marginTop: 2 },
  subjectShowcaseWrap: { width: '100%', marginTop: 6, backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden', border: `1 solid ${COLORS.border}` },
  subjectMedia: { position: 'relative', height: 300, overflow: 'hidden', backgroundColor: '#111827' },
  subjectImage: { width: '100%', height: '100%', objectFit: 'cover' },
  // White pill / black price text (not the reverse) - a solid dark-filled pill on every comp and
  // the subject photo adds up to a lot of ink across a multi-page PDF; white with a thin border
  // reads just as clearly sitting on the photo's dark bottom overlay.
  subjectPriceBadge: { position: 'absolute', left: 18, bottom: 17, backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 8, border: '1 solid rgba(0,0,0,0.08)' },
  subjectPriceText: { fontSize: 22, fontFamily: 'Montserrat', fontWeight: 900, color: COLORS.text },
  subjectStatsPanel: { backgroundColor: COLORS.white, borderTop: `1 solid ${COLORS.border}`, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  // A single rounded pill enclosing the whole primary stats row, with thin dividers between
  // items - the bare row of floating cells (subjectStatsRow/subjectStatCell) it replaces here had
  // no visual container or separation between stats, which read as messy at a glance.
  subjectStatsPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 999, border: `1 solid ${COLORS.border}`, paddingVertical: 10, paddingHorizontal: 6, marginBottom: 8 },
  subjectStatsPillItem: { flex: 1, alignItems: 'center' },
  subjectStatsPillDivider: { width: 1, height: 22, backgroundColor: COLORS.line },
  compStatsPanel: { backgroundColor: COLORS.white, borderRadius: 10, border: `1 solid ${COLORS.border}`, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, marginBottom: 8 },
  subjectStatsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'stretch' },
  subjectStatCell: { width: '15%', marginHorizontal: 2.5, marginBottom: 10, alignItems: 'center', justifyContent: 'flex-start' },
  subjectStatValue: { fontSize: 10.6, fontWeight: 700, color: COLORS.text, lineHeight: 1.08, textAlign: 'center' },
  subjectStatLabel: { fontSize: 5.9, textTransform: 'uppercase', letterSpacing: 0.65, color: COLORS.muted, marginTop: 3, textAlign: 'center', lineHeight: 1.15 },
  subjectSecondaryStatCell: { width: '30%', marginHorizontal: 4, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 6, border: `1 solid ${COLORS.line}`, borderRadius: 8, backgroundColor: '#fbfaf7', alignItems: 'center' },
  subjectSecondaryStatValue: { fontSize: 9.2, fontWeight: 700, color: COLORS.text, lineHeight: 1.12, textAlign: 'center' },
  subjectSecondaryStatLabel: { fontSize: 5.6, textTransform: 'uppercase', letterSpacing: 0.65, color: COLORS.muted, marginTop: 3, textAlign: 'center', lineHeight: 1.15 },
  tableWrap: { backgroundColor: COLORS.white, border: `1 solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottom: `1 solid ${COLORS.line}`, paddingVertical: 7, paddingHorizontal: 8 },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  locationRow: { flexDirection: 'row', alignItems: 'center', borderBottom: `1 solid ${COLORS.line}`, paddingVertical: 8, paddingHorizontal: 9 },
  locationAddressBlock: { flexDirection: 'column', justifyContent: 'center' },
  locationStreet: { fontSize: 8, color: COLORS.text, lineHeight: 1.2 },
  locationCity: { fontSize: 6.4, color: COLORS.subtext, textTransform: 'uppercase', letterSpacing: 0.55, marginTop: 2 },
  tableHeadRow: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 8, paddingHorizontal: 8 },
  tableLabelCell: { width: '18%', fontSize: 7, fontWeight: 700, color: COLORS.subtext },
  tableCell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingHorizontal: 2, fontSize: 7.5, color: COLORS.text, textAlign: 'center' },
  tableHeadCell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingHorizontal: 2, fontSize: 6.4, fontWeight: 900, color: COLORS.white, textAlign: 'center', lineHeight: 1.25 },
  marketStatsPanel: { backgroundColor: COLORS.white, borderRadius: 12, border: `1 solid ${COLORS.border}`, paddingVertical: 12, paddingHorizontal: 11 },
  marketStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  marketFactPill: { width: '31%', minHeight: 48, borderRadius: 10, border: `1 solid ${COLORS.line}`, backgroundColor: '#fbfaf7', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 7 },
  marketFactValue: { fontSize: 10.8, fontWeight: 900, color: COLORS.text, lineHeight: 1.15, textAlign: 'center' },
  marketFactLabel: { fontSize: 5.8, textTransform: 'uppercase', letterSpacing: 0.75, color: COLORS.muted, marginTop: 3, textAlign: 'center', lineHeight: 1.15 },
  offerStatsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 18 },
  offerFactPill: { width: '24%', minHeight: 46, borderRadius: 10, border: `1 solid ${COLORS.line}`, backgroundColor: '#fbfaf7', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 5 },
  offerFactValue: { fontSize: 10, fontWeight: 900, color: COLORS.text, lineHeight: 1.1, textAlign: 'center' },
  offerFactLabel: { fontSize: 5.15, textTransform: 'uppercase', letterSpacing: 0.45, color: COLORS.muted, marginTop: 3, textAlign: 'center', lineHeight: 1.1 },
  chartGrid: { gap: 10 },
  chartCard: { backgroundColor: COLORS.white, borderRadius: 12, border: `1 solid ${COLORS.border}`, paddingVertical: 12, paddingHorizontal: 13 },
  chartTitle: { fontSize: 13.5, fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.text, marginBottom: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  barLabel: { width: 34, fontSize: 7.4, fontWeight: 900, color: COLORS.subtext },
  barTrack: { flex: 1, height: 12, backgroundColor: '#ebe7df', borderRadius: 6, overflow: 'hidden', marginLeft: 6, marginRight: 7 },
  barFill: { height: 12, backgroundColor: '#8b7355', borderRadius: 6 },
  barValue: { width: 52, fontSize: 8, fontWeight: 900, color: COLORS.text, textAlign: 'right' },
});

function CmaPageFooter({ agent }: { agent: CmaPdfAgent }) {
  return (
    <View style={cma.footer} fixed>
      <View style={cma.footerAccent} />
      <View style={cma.footerRow}>
        <Text style={cma.footerText}>{agent.name}{agent.brokerage ? ` · ${agent.brokerage}` : ''}</Text>
        <Text style={cma.footerPageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
      <Text style={cma.footerDisclaimer}>
        This comparative market analysis is an estimate of value prepared by a real estate agent, not a formal appraisal, and is for informational purposes only.
      </Text>
    </View>
  );
}

function CmaPdfHeader({ label, title, subtitle }: { label: string; title: string; subtitle?: string | null }) {
  return (
    <View style={cma.pageHeader}>
      <View style={cma.pageHeaderAccent} />
      <Text style={cma.pageHeaderLabel}>{label}</Text>
      <Text style={cma.pageHeaderTitle}>{title || 'Subject Property'}</Text>
      {subtitle ? <Text style={cma.pageHeaderSub}>{subtitle}</Text> : null}
    </View>
  );
}

function getCmaAgentPhotoUrl(agent: CmaPdfAgent): string | null {
  return agent.headshot_url || agent.photo_url || agent.profile_photo_url || agent.profile_image_url || agent.avatar_url || agent.avatar || null;
}

// Kept as its own name at CMA's call sites for clarity - just delegates to the shared helper now.
const cmaPdfImageUrl = pdfImageUrl;

function CmaAgentAvatar({ agent, size = 70, style }: { agent: CmaPdfAgent; size?: number; style?: any }) {
  const photoUrl = getCmaAgentPhotoUrl(agent);
  const radius = size / 2;
  if (photoUrl) {
    return (
      <Image
        src={cmaPdfImageUrl(photoUrl)}
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            objectFit: 'cover',
            border: `1 solid ${COLORS.border}`,
            backgroundColor: COLORS.panel,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View style={[
      {
        width: size,
        height: size,
        borderRadius: radius,
        border: `1 solid ${COLORS.border}`,
        backgroundColor: COLORS.panel,
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}>
      <Text style={{ fontSize: size * 0.3, fontFamily: 'Playfair Display', fontWeight: 900, color: '#8b7355' }}>
        {getInitials(agent.name) || '?'}
      </Text>
    </View>
  );
}

function CmaFact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={cma.factCell}>
      <Text style={cma.factValue}>{value ?? '—'}</Text>
      <Text style={cma.factLabel}>{label}</Text>
    </View>
  );
}

function CmaMarketFact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={cma.marketFactPill}>
      <Text style={cma.marketFactValue}>{value ?? '—'}</Text>
      <Text style={cma.marketFactLabel}>{label}</Text>
    </View>
  );
}

function CmaOfferFact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={cma.offerFactPill}>
      <Text style={cma.offerFactValue}>{value ?? '-'}</Text>
      <Text style={cma.offerFactLabel}>{label}</Text>
    </View>
  );
}

function PdfParagraphs({ text, style, spacing = 7 }: { text: string; style: Style; spacing?: number }) {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={index === 0 ? style : [style, { marginTop: spacing }]}>
          {paragraph}
        </Text>
      ))}
    </>
  );
}

function CmaGuidanceSections({ sections }: { sections: CmaGuidanceSection[] }) {
  return (
    <View>
      {sections.map((section, index) => (
        <View key={`${section.title}-${index}`} style={{ marginBottom: index === sections.length - 1 ? 0 : 11 }}>
          {section.title ? (
            <Text style={{ fontSize: 8.2, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.9, color: '#8b7355', marginBottom: 4 }}>
              {section.title}
            </Text>
          ) : null}
          <PdfParagraphs text={section.body} style={{ fontSize: 10, lineHeight: 1.55, color: COLORS.text }} />
        </View>
      ))}
    </View>
  );
}

function CmaFinalFact({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <View style={cma.factCell}>
      <Text style={[cma.factValue, { color: COLORS.white }]}>{value}</Text>
      <Text style={[cma.factLabel, { color: '#9CA3AF' }]}>{label}</Text>
    </View>
  );
}

function getCmaSubjectStats(s: CmaSubjectProperty, authoritativeStatus?: CmaFinalStatus | null) {
  const subjectPsf = s.list_price && s.sqft ? pricePerSqft(s.list_price, s.sqft) : null;
  // Issue #3 - one source for status: the final timeline/status object on ai_estimate when the
  // report has been analyzed; the raw subject.mls_status only as a pre-analysis fallback.
  const statusValue = authoritativeStatus?.label || (s.mls_status ? formatMlsStatusLabel(s.mls_status) : null);
  const activeMarketDays = authoritativeStatus?.active_market_days ?? s.days_on_market;
  return [
    s.beds != null ? { label: 'Beds', value: String(s.beds) } : null,
    s.baths != null ? { label: 'Baths', value: String(s.baths) } : null,
    s.sqft != null ? { label: 'Reported Finished Area', value: formatNumber(s.sqft) } : null,
    s.above_grade_finished_area != null ? { label: 'Above-Grade Finished Area', value: formatNumber(s.above_grade_finished_area) } : null,
    s.below_grade_finished_area != null ? { label: 'Below-Grade Finished Area', value: formatNumber(s.below_grade_finished_area) } : null,
    subjectPsf != null ? { label: '/ Sq Ft', value: `$${subjectPsf}` } : null,
    s.year_built != null ? { label: 'Year Built', value: String(s.year_built) } : null,
    s.lot_size != null ? { label: 'Acres', value: formatAcresFromSqft(s.lot_size).replace(' ac', '') } : null,
    s.school_district ? { label: 'School District', value: pdfDistrict(s.school_district) } : null,
    s.water_source ? { label: 'Water Source', value: formatCmaUtilityValue(s.water_source) } : null,
    s.sewer ? { label: 'Sewer / Septic', value: formatCmaUtilityValue(s.sewer) } : null,
    statusValue ? { label: 'Current Status', value: statusValue } : null,
    activeMarketDays != null ? { label: 'Days on Market', value: String(activeMarketDays) } : null,
    s.annual_taxes != null ? { label: 'Annual Taxes', value: formatMoney(s.annual_taxes) } : null,
    s.last_sale_date ? { label: 'Last Sale Date', value: formatDate(s.last_sale_date) } : null,
    s.last_sale_price != null ? { label: 'Last Sale Price', value: formatMoney(s.last_sale_price) } : null,
  ].filter(Boolean) as { label: string; value: string }[];
}

// `columns` (used for the comp page's half-width stats/quality split) puts every stat through
// the boxed secondary-card style chunked by that count, instead of the default 6-across unboxed
// row + 3-across boxed rows split - that unboxed row is sized for a full-width panel, and would
// overflow/wrap unpredictably squeezed into half the page width.
// react-pdf can't auto-fit text. Long stat values - school district names above all - were
// overflowing their fixed-width cells and drawing over the neighbouring stat. Step the value
// font down by length (paired with CLAMP_2_LINES on the value Text) so it always stays in its box.
function fitStatValue(value: string, base: number): number {
  const len = (value || '').length;
  if (len <= 10) return base;
  if (len <= 15) return base - 1.4;
  if (len <= 20) return base - 2.4;
  if (len <= 28) return base - 3.2;
  return Math.max(5.6, base - 4);
}
// react-pdf v4 reads maxLines off `style`, not as a prop, and @react-pdf/types doesn't declare
// it - so it's cast in here. Clamps a very long value to 2 lines instead of ballooning the row.
const CLAMP_2_LINES = { maxLines: 2, textOverflow: 'ellipsis' } as unknown as Style;

function CmaSubjectStatsPanel({ stats, standalone = false, columns }: { stats: { label: string; value: string }[]; standalone?: boolean; columns?: number }) {
  if (stats.length === 0) return null;
  if (columns) {
    const rows = Array.from({ length: Math.ceil(stats.length / columns) }, (_, index) => stats.slice(index * columns, index * columns + columns));
    const cellWidth = `${Math.floor(96 / columns)}%`;
    return (
      <View style={standalone ? cma.compStatsPanel : cma.subjectStatsPanel}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={cma.subjectStatsRow}>
            {row.map(stat => (
              <View key={stat.label} style={[cma.subjectSecondaryStatCell, { width: cellWidth }]}>
                <Text style={[cma.subjectSecondaryStatValue, { fontSize: fitStatValue(stat.value, 9.2) }, CLAMP_2_LINES]}>{stat.value}</Text>
                <Text style={cma.subjectSecondaryStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }
  const primarySubjectStats = stats.slice(0, 6);
  const secondarySubjectStats = stats.slice(6);
  const secondaryRows = Array.from(
    { length: Math.ceil(secondarySubjectStats.length / 3) },
    (_, index) => secondarySubjectStats.slice(index * 3, index * 3 + 3),
  );
  return (
    <View style={standalone ? cma.compStatsPanel : cma.subjectStatsPanel}>
      <View style={cma.subjectStatsPill}>
        {primarySubjectStats.map((stat, i) => (
          <React.Fragment key={stat.label}>
            {i > 0 && <View style={cma.subjectStatsPillDivider} />}
            <View style={cma.subjectStatsPillItem}>
              <Text style={[cma.subjectStatValue, { fontSize: fitStatValue(stat.value, 10.6) }, CLAMP_2_LINES]}>{stat.value}</Text>
              <Text style={cma.subjectStatLabel}>{stat.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      {secondaryRows.map((row, rowIndex) => (
        <View key={rowIndex} style={cma.subjectStatsRow}>
          {row.map(stat => (
            <View key={stat.label} style={cma.subjectSecondaryStatCell}>
              <Text style={[cma.subjectSecondaryStatValue, { fontSize: fitStatValue(stat.value, 9.2) }, CLAMP_2_LINES]}>{stat.value}</Text>
              <Text style={cma.subjectSecondaryStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function cleanCmaText(value?: string | null): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cmaCityStateZip(property: { city?: string | null; state?: string | null; zipcode?: string | null }): string {
  return [
    cleanCmaText(property.city),
    cleanCmaText(property.state),
    cleanCmaText(property.zipcode),
  ].filter(Boolean).join(', ');
}

function CmaCoverPage({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) {
  const subject = report.subject;
  const subjectStats = getCmaSubjectStats(subject, report.pricing?.ai_estimate?.status);
  const subjectAddress = cleanCmaText(subject.street_address) || 'Subject Property';
  const subjectLocation = cmaCityStateZip(subject);
  return (
    <Page size="LETTER" style={cma.coverPage} wrap={false}>
      <View style={cma.coverAccentLine} />
      <Text style={cma.coverWatermark}>CMA</Text>
      {/* wrap={false} guarantees the whole cover stays one page - it can never spill a sliver
          (or the footer) onto a blank page 2. flexGrow + space-between fills the page and pins
          the meta row to the bottom without a fixed reserve padding or an auto margin. */}
      <View wrap={false} style={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <View>
        <View style={cma.coverIntroRow}>
          <CmaAgentAvatar agent={agent} size={64} />
          <View>
            <Text style={[cma.coverLabel, { marginBottom: 5 }]}>Prepared CMA</Text>
            <Text style={{ fontSize: 7.2, color: COLORS.subtext, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 900 }}>
              Comparative Market Analysis
            </Text>
          </View>
        </View>
        <View style={cma.coverSubjectBlock}>
          <View style={cma.coverSubjectPill}>
            <Text style={cma.coverSubjectPillText}>Subject Property</Text>
          </View>
          <Text style={cma.coverTitle}>{subjectAddress}</Text>
          <Text style={cma.coverLocation}>{subjectLocation}</Text>
        </View>
        {cleanCmaText(report.client_name) && (
          <Text style={{ marginTop: 16, fontSize: 9, color: COLORS.subtext, textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Prepared for {cleanCmaText(report.client_name)}
          </Text>
        )}
      </View>

      <View style={[cma.subjectShowcaseWrap, { marginVertical: 12 }]}>
        <View style={[cma.subjectMedia, { height: 200 }]}>
          {subject.photo_url ? (
            <Image src={cmaPdfImageUrl(subject.photo_url)} style={cma.subjectImage} />
          ) : (
            <View style={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 700 }}>Subject Property</Text>
            </View>
          )}
          {subject.list_price != null && (
            <View style={cma.subjectPriceBadge}>
              <Text style={cma.subjectPriceText}>{formatMoney(subject.list_price)}</Text>
              <Text style={{ fontSize: 7, color: '#9CA3AF', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Current List Price</Text>
            </View>
          )}
        </View>
        <CmaSubjectStatsPanel stats={subjectStats} />
      </View>

      <View style={cma.coverMetaRow}>
        <View>
          <Text style={cma.coverAgentName}>{agent.name}</Text>
          {agent.brokerage ? <Text style={cma.coverAgentDetail}>{agent.brokerage}</Text> : null}
          {agent.email ? <Text style={cma.coverAgentDetail}>{agent.email}</Text> : null}
        </View>
        <Text style={cma.coverDate}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
      </View>

      <Text style={cma.coverDisclaimer}>
        This is a comparative market analysis (CMA), not a formal appraisal. It is an opinion of value
        based on comparable market data, prepared by a licensed real estate agent for informational
        purposes only, and should not be relied upon as a certified appraisal or a guarantee of the
        price at which the property will sell.
      </Text>
      </View>
    </Page>
  );
}

function CmaSubjectPage({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) {
  const s = report.subject;
  const subjectPsf = s.list_price && s.sqft ? pricePerSqft(s.list_price, s.sqft) : null;
  const statusValue = report.pricing?.ai_estimate?.status?.label || (s.mls_status ? formatMlsStatusLabel(s.mls_status) : null);
  const subjectStats = [
    s.beds != null ? { label: 'Beds', value: String(s.beds) } : null,
    s.baths != null ? { label: 'Baths', value: String(s.baths) } : null,
    s.sqft != null ? { label: 'Reported Finished Area', value: formatNumber(s.sqft) } : null,
    s.above_grade_finished_area != null ? { label: 'Above-Grade Finished Area', value: formatNumber(s.above_grade_finished_area) } : null,
    s.below_grade_finished_area != null ? { label: 'Below-Grade Finished Area', value: formatNumber(s.below_grade_finished_area) } : null,
    subjectPsf != null ? { label: '/ Sq Ft', value: `$${subjectPsf}` } : null,
    s.year_built != null ? { label: 'Year Built', value: String(s.year_built) } : null,
    s.lot_size != null ? { label: 'Acres', value: formatAcresFromSqft(s.lot_size).replace(' ac', '') } : null,
    s.school_district ? { label: 'School District', value: pdfDistrict(s.school_district) } : null,
    s.water_source ? { label: 'Water Source', value: formatCmaUtilityValue(s.water_source) } : null,
    s.sewer ? { label: 'Sewer / Septic', value: formatCmaUtilityValue(s.sewer) } : null,
    statusValue ? { label: 'Current Status', value: statusValue } : null,
    s.annual_taxes != null ? { label: 'Annual Taxes', value: formatMoney(s.annual_taxes) } : null,
    s.last_sale_date ? { label: 'Last Sale Date', value: formatDate(s.last_sale_date) } : null,
    s.last_sale_price != null ? { label: 'Last Sale Price', value: formatMoney(s.last_sale_price) } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  const primarySubjectStats = subjectStats.slice(0, 6);
  const secondarySubjectStats = subjectStats.slice(6);
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader
        label="The Property"
        title="Subject Property"
        subtitle={[s.street_address, [s.city, s.state, s.zipcode].filter(Boolean).join(', ')].filter(Boolean).join(' - ')}
      />
      <CmaAgentAvatar agent={agent} size={42} style={{ position: 'absolute', right: 34, top: 20 }} />

      <View style={cma.subjectShowcaseWrap}>
        <View style={cma.subjectMedia}>
          {s.photo_url ? (
            <Image src={cmaPdfImageUrl(s.photo_url)} style={cma.subjectImage} />
          ) : (
            <View style={{ height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: 700 }}>Subject Property</Text>
            </View>
          )}
          {s.list_price != null && (
            <View style={cma.subjectPriceBadge}>
              <Text style={cma.subjectPriceText}>{formatMoney(s.list_price)}</Text>
              <Text style={{ fontSize: 7, color: '#9CA3AF', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Current List Price</Text>
            </View>
          )}
        </View>

        {subjectStats.length > 0 && (
          <View style={cma.subjectStatsPanel}>
            <View style={cma.subjectStatsPill}>
              {primarySubjectStats.map((stat, i) => (
                <React.Fragment key={stat.label}>
                  {i > 0 && <View style={cma.subjectStatsPillDivider} />}
                  <View style={cma.subjectStatsPillItem}>
                    <Text style={cma.subjectStatValue}>{stat.value}</Text>
                    <Text style={cma.subjectStatLabel}>{stat.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
            {secondarySubjectStats.length > 0 && (
              <View style={cma.subjectStatsRow}>
                {secondarySubjectStats.map(stat => (
                  <View key={stat.label} style={cma.subjectStatCell}>
                    <Text style={cma.subjectStatValue}>{stat.value}</Text>
                    <Text style={cma.subjectStatLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function formatCmaUtilityValue(value?: string[] | string | null): string {
  if (!value) return '—';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—';
  return value;
}

function CmaLocationAddress({ street, city, state, zipcode, suffix, bold = false }: {
  street?: string | null; city?: string | null; state?: string | null; zipcode?: string | null; suffix?: string; bold?: boolean;
}) {
  const streetLine = cleanCmaText(street) || 'Address unavailable';
  const locationLine = cmaCityStateZip({ city, state, zipcode });
  return (
    <View style={cma.locationAddressBlock}>
      <Text style={[cma.locationStreet, bold ? { fontWeight: 900 } : {}]}>{streetLine}{suffix ? ` ${suffix}` : ''}</Text>
      {locationLine ? <Text style={cma.locationCity}>{locationLine}</Text> : null}
    </View>
  );
}

function CmaLocationPage({ report, comparables, agent }: { report: CmaReport; comparables: CmaComparable[]; agent: CmaPdfAgent }) {
  const mapUrl = buildCmaStaticMapUrl(report.subject, comparables, '900x420');
  if (!mapUrl && comparables.every(c => c.distance_miles == null)) return null;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Geography" title="Location Context" subtitle="Where the comparables sit relative to the subject property" />
      {mapUrl && <Image src={mapUrl} style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 12, backgroundColor: '#F3F4F6', marginBottom: 14 }} />}
      <View style={cma.tableWrap}>
        <View style={cma.locationRow}>
          <Text style={[cma.tableCell, { flex: 0.4, textAlign: 'left', fontWeight: 700, color: '#C9A24D' }]}>S</Text>
          <View style={{ flex: 3 }}>
            <CmaLocationAddress street={report.subject.street_address} city={report.subject.city} state={report.subject.state} zipcode={report.subject.zipcode} suffix="(Subject)" bold />
          </View>
          <Text style={[cma.tableCell, { flex: 1 }]}>—</Text>
        </View>
        {comparables.map((c, i) => (
          <View key={c.id} style={[cma.locationRow, i % 2 === 0 ? cma.tableRowAlt : {}]}>
            <Text style={[cma.tableCell, { flex: 0.4, textAlign: 'left', fontWeight: 700, color: '#C9A24D' }]}>{i + 1}</Text>
            <View style={{ flex: 3 }}>
              <CmaLocationAddress street={c.street_address} city={c.city} state={c.state} zipcode={c.zipcode} />
            </View>
            <Text style={[cma.tableCell, { flex: 1 }]}>{c.distance_miles != null ? `${c.distance_miles} miles` : '—'}</Text>
          </View>
        ))}
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaMarketSnapshotPage({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) {
  const mc = report.market_context;
  if (mc.hidden) return null;
  const hasStats = [mc.recent_sales_count, mc.median_sale_price, mc.median_price_per_sqft, mc.highest_recent_sale, mc.highest_price_per_sqft_sale, mc.avg_days_on_market].some(v => v != null);
  if (!hasStats && mc.highlight_statements.length === 0) return null;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Market Analysis" title="Local Market Context" subtitle="Recent activity and market signals around the subject" />
      {hasStats && (
        <View style={cma.card}>
          <View style={cma.factsGrid}>
            <CmaFact label="Recent Sales" value={mc.recent_sales_count} />
            <CmaFact label="Median Sale Price" value={mc.median_sale_price ? formatMoney(mc.median_sale_price) : null} />
            <CmaFact label="Median $/Sqft" value={mc.median_price_per_sqft ? `$${mc.median_price_per_sqft}` : null} />
            <CmaFact label="Highest Recent Sale" value={mc.highest_recent_sale ? formatMoney(mc.highest_recent_sale) : null} />
            <CmaFact label="Highest $/Sqft Sale" value={mc.highest_price_per_sqft_sale ? `$${mc.highest_price_per_sqft_sale}` : null} />
            <CmaFact label="Avg Days on Market" value={mc.avg_days_on_market} />
          </View>
        </View>
      )}
      {mc.highlight_statements.filter(Boolean).length > 0 && (
        <View style={{ marginTop: 16 }}>
          {mc.highlight_statements.filter(Boolean).map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#C9A24D', marginTop: 4, marginRight: 8 }} />
              <Text style={{ fontSize: 10, color: COLORS.text, flex: 1, lineHeight: 1.4 }}>{h}</Text>
            </View>
          ))}
        </View>
      )}
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaComparisonTablePage({ report, comparables, agent }: { report: CmaReport; comparables: CmaComparable[]; agent: CmaPdfAgent }) {
  const s = report.subject;
  const subjectHeader = `Subject\n(${s.street_address || 'Address unavailable'})`;
  const rows: { label: string; subject: string; comp: (c: CmaComparable) => string }[] = [
    { label: 'List / Sale Price', subject: formatMoney(s.list_price), comp: c => formatMoney(compDisplayPrice(c).value) },
    { label: 'List / Sale $/Sqft', subject: s.list_price && s.sqft ? `$${pricePerSqft(s.list_price, s.sqft)}` : '—', comp: c => { const p = pricePerSqft(effectiveCompPrice(c), c.sqft); return p ? `$${p}` : '—'; } },
    { label: 'Reported Finished Area', subject: formatNumber(s.sqft), comp: c => formatNumber(c.sqft) },
    ...([s, ...comparables].some(p => p.above_grade_finished_area != null) ? [{ label: 'Above-Grade Finished Area', subject: formatNumber(s.above_grade_finished_area), comp: (c: CmaComparable) => formatNumber(c.above_grade_finished_area) }] : []),
    ...([s, ...comparables].some(p => p.below_grade_finished_area != null) ? [{ label: 'Below-Grade Finished Area', subject: formatNumber(s.below_grade_finished_area), comp: (c: CmaComparable) => formatNumber(c.below_grade_finished_area) }] : []),
    { label: 'Lot Size', subject: formatAcresFromSqft(s.lot_size), comp: c => formatAcresFromSqft(c.lot_size) },
    { label: 'Beds', subject: String(s.beds ?? '—'), comp: c => String(c.beds ?? '—') },
    { label: 'Baths', subject: String(s.baths ?? '—'), comp: c => String(c.baths ?? '—') },
    { label: 'Year Built', subject: String(s.year_built ?? '—'), comp: c => String(c.year_built ?? '—') },
    { label: 'Garage', subject: s.garage || '—', comp: c => c.garage || '—' },
    { label: 'Basement', subject: s.basement || '—', comp: c => c.basement || '—' },
    { label: 'Annual Taxes', subject: s.annual_taxes ? formatMoney(s.annual_taxes) : '—', comp: c => c.annual_taxes ? formatMoney(c.annual_taxes) : '—' },
    { label: 'Days on Market', subject: String(s.days_on_market ?? '—'), comp: c => String(c.days_on_market ?? '—') },
    { label: 'Distance', subject: '—', comp: c => c.distance_miles != null ? `${c.distance_miles} miles` : '—' },
    { label: 'School District', subject: pdfDistrict(s.school_district) || '\u2014', comp: c => pdfDistrict(c.school_district) || '\u2014' },
    { label: 'Water Source', subject: formatCmaUtilityValue(s.water_source), comp: c => formatCmaUtilityValue(c.water_source) },
    { label: 'Sewer / Septic', subject: formatCmaUtilityValue(s.sewer), comp: c => formatCmaUtilityValue(c.sewer) },
  ];
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label={`${comparables.length} Comparable Sales`} title="Comparable Overview" subtitle="How the comps compare to the subject" />
      <View style={cma.tableWrap}>
        <View style={cma.tableHeadRow}>
          <Text style={[cma.tableLabelCell, { color: '#9CA3AF' }]}></Text>
          <Text style={[cma.tableHeadCell, { color: '#C9A24D' }]}>{subjectHeader}</Text>
          {comparables.map((c, i) => <Text key={c.id} style={cma.tableHeadCell}>{`#${i + 1}\n(${c.street_address || 'Address unavailable'})`}</Text>)}
        </View>
        {rows.map((row, index) => (
          <View key={row.label} style={[cma.tableRow, index % 2 === 1 ? cma.tableRowAlt : {}]}>
            <Text style={cma.tableLabelCell}>{row.label}</Text>
            <Text style={[cma.tableCell, { fontWeight: 700 }]}>{row.subject}</Text>
            {comparables.map(c => <Text key={c.id} style={cma.tableCell}>{row.comp(c)}</Text>)}
          </View>
        ))}
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

// The same 3-position scale as the public site's QualityScaleRow, redrawn with react-pdf
// primitives (no CSS grid/flexbox shorthand, hex colors instead of Tailwind classes) so a client
// sees the identical color language in the PDF as on the live report. Parameterized on
// `tiers`/`hexMap` since Comp Weight uses its own independent weak/supporting/strong scale
// (STRENGTH_TIER_HEX) rather than the quality dimensions' below/similar/above (QUALITY_TIER_HEX) -
// for a quality dimension either extreme is a weaker match (both red), but for Comp Weight strong
// is unambiguously the best outcome.
const CMA_QUALITY_TIERS = ['below', 'similar', 'above'] as const;
// Weaker | Strong | Supporting - same left/middle/right order as the studio editor's
// STRENGTH_OPTIONS and the public site's STRENGTH_TIERS (Strong in the middle). Only the
// selected position is colour-filled (see CmaQualityScaleRow).
const CMA_STRENGTH_TIERS = ['weak', 'strong', 'supporting'] as const;

// `divider` draws a thin rule under the row (skipped for Comp Weight, which already sits in its
// own bordered box - a rule right against that box's own bottom border would double up) so the
// label always has a clear line running to its result on the right, instead of relying on
// whitespace alone to keep a busy 8-row list lined up.
function CmaQualityScaleRow({ label, tiers, tier, displayLabel, hexMap, divider = true }: {
  label: string; tiers: readonly string[]; tier?: string | null; displayLabel?: string; hexMap: Record<string, { bg: string; text: string }>; divider?: boolean;
}) {
  if (!tier) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: divider ? 3 : 0, marginBottom: divider ? 3 : 0, borderBottom: divider ? `0.5 solid ${COLORS.line}` : undefined }}>
      <Text style={{ width: 62, fontSize: 6.4, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4, color: COLORS.subtext }}>{label}</Text>
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {tiers.map((t, i) => {
          const active = t === tier;
          const hex = hexMap[t];
          return (
            <View
              key={t}
              style={{
                flex: 1, marginLeft: i === 0 ? 0 : 3, borderRadius: 4, paddingVertical: 3, alignItems: 'center',
                backgroundColor: active ? hex.bg : '#F9FAFB',
              }}
            >
              <Text style={{ fontSize: 5.7, fontWeight: 900, textTransform: 'uppercase', color: active ? hex.text : '#D1D5DB' }}>
                {active ? (displayLabel || QUALITY_LABELS[t]) : '-'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Client-facing transparency into how the agent (or the AI) scored this comp against the subject
// - mirrors ComparableQualitySection on the public site (app/cma/[slug]/page.tsx). `area` is
// excluded from the color scale (a factual school-district/city comparison, not a strength
// judgment) and shown as a plain neutral line instead.
function CmaComparableQualitySection({ comp }: { comp: CmaComparable }) {
  const q = comp.quality || {};
  const displayedStrength = clientCompStrength(comp);
  const hasAny = !!(displayedStrength || q.finish_quality || q.interior || q.exterior || q.lot || q.amenities || q.layout || q.area || q.street_context);
  if (!hasAny) return null;
  return (
    // No flexGrow/height here - stretching this box to force-match the stats panel's height left
    // a big blank gap under the last row instead. Sized by its own content, condensed via the
    // tighter row spacing in CmaQualityScaleRow and the smaller margins/padding below.
    <View style={{ marginTop: 8, backgroundColor: COLORS.white, borderRadius: 10, padding: 8, border: `1 solid ${COLORS.border}` }}>
      <Text style={{ fontSize: 7.4, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.9, color: '#8b7355', marginBottom: 4 }}>Compared With the Subject</Text>
      {/* marginHorizontal cancels paddingHorizontal so "Comp Weight" still lines up with "Finish
          Quality" below it instead of sitting further right from the box's own inner padding. */}
      {displayedStrength && (
        <View style={{ marginBottom: 5, marginHorizontal: -6, borderRadius: 6, border: '1.5 solid #C9A24D', backgroundColor: '#FBF6E9', paddingVertical: 3, paddingHorizontal: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 6.4, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4, color: COLORS.subtext }}>Valuation Classification</Text>
          <Text style={{
            fontSize: 6, fontWeight: 900, textTransform: 'uppercase', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 5,
            backgroundColor: (STRENGTH_TIER_HEX[displayedStrength] || { bg: '#E2E8F0' }).bg,
            color: (STRENGTH_TIER_HEX[displayedStrength] || { text: '#475569' }).text,
          }}>
            {STRENGTH_LABEL[displayedStrength] || displayedStrength}
          </Text>
        </View>
      )}
      <CmaQualityScaleRow label="Finish Quality" tiers={CMA_QUALITY_TIERS} tier={q.finish_quality} hexMap={QUALITY_TIER_HEX} />
      <CmaQualityScaleRow label="Interior" tiers={CMA_QUALITY_TIERS} tier={q.interior} hexMap={QUALITY_TIER_HEX} />
      <CmaQualityScaleRow label="Exterior" tiers={CMA_QUALITY_TIERS} tier={q.exterior} hexMap={QUALITY_TIER_HEX} />
      <CmaQualityScaleRow label="Lot" tiers={CMA_QUALITY_TIERS} tier={q.lot} hexMap={QUALITY_TIER_HEX} />
      <CmaQualityScaleRow label="Amenities" tiers={CMA_QUALITY_TIERS} tier={q.amenities} hexMap={QUALITY_TIER_HEX} />
      <CmaQualityScaleRow label="Layout" tiers={CMA_QUALITY_TIERS} tier={q.layout} hexMap={QUALITY_TIER_HEX} />
      <CmaQualityScaleRow label="Area" tiers={AREA_TIERS} tier={q.area} hexMap={QUALITY_TIER_HEX} />
      <CmaQualityScaleRow label="Street" tiers={CMA_QUALITY_TIERS} tier={q.street_context} hexMap={QUALITY_TIER_HEX} divider={false} />
    </View>
  );
}

function CmaComparablePage({ comp, index, agent }: { comp: CmaComparable; index: number; agent: CmaPdfAgent }) {
  const psf = pricePerSqft(effectiveCompPrice(comp), comp.sqft);
  const note = comp.commentary || comp.ai_commentary;
  const cityState = [comp.city, comp.state].filter(Boolean).join(', ');
  const isLongNote = (note || '').length > 650;
  const q = comp.quality;
  const displayedStrength = clientCompStrength(comp);
  const hasQuality = !!(displayedStrength || q?.finish_quality || q?.interior || q?.exterior || q?.lot || q?.amenities || q?.layout || q?.area || q?.street_context);
  const compFacts = [
    { label: 'Beds', value: comp.beds },
    { label: 'Baths', value: comp.baths },
    { label: 'Reported Finished Area', value: comp.sqft ? formatNumber(comp.sqft) : null },
    { label: 'Above-Grade Finished Area', value: comp.above_grade_finished_area ? formatNumber(comp.above_grade_finished_area) : null },
    { label: 'Below-Grade Finished Area', value: comp.below_grade_finished_area ? formatNumber(comp.below_grade_finished_area) : null },
    { label: 'Year Built', value: comp.year_built },
    { label: 'Acres', value: comp.lot_size ? formatAcresFromSqft(comp.lot_size).replace(' ac', '') : null },
    { label: 'School District', value: pdfDistrict(comp.school_district) },
    { label: 'Water Source', value: comp.water_source ? formatCmaUtilityValue(comp.water_source) : null },
    { label: 'Sewer / Septic', value: comp.sewer ? formatCmaUtilityValue(comp.sewer) : null },
    { label: 'Annual Taxes', value: comp.annual_taxes ? formatMoney(comp.annual_taxes) : null },
    { label: 'Days on Market', value: comp.days_on_market },
    { label: 'Distance', value: comp.distance_miles != null ? `${comp.distance_miles} mi` : null },
  ].filter(Boolean).filter(fact => {
    const value = (fact as { value?: string | number | null }).value;
    return value !== null && value !== undefined && String(value).trim() !== '';
  }).map(fact => ({
    label: (fact as { label: string }).label,
    value: String((fact as { value: string | number }).value),
  }));
  // A fact long enough to wrap to two lines (e.g. "Tredyffrin- Easttown") makes its row taller -
  // give that height back from the photo so the page never spills onto a blank extra page.
  const tallFact = compFacts.some(f => f.value.length > 13) ? 16 : 0;
  const compPhotoHeight = (isLongNote ? (hasQuality ? 185 : 205) : (hasQuality ? 225 : 245)) - tallFact;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader
        label={`Comp #${index + 1}${displayedStrength ? ` - ${STRENGTH_LABEL[displayedStrength]}` : ''}`}
        title={comp.street_address || `Comparable #${index + 1}`}
        subtitle={cityState}
      />

      <View style={{ position: 'relative', marginBottom: 10 }}>
        {comp.photo_url ? (
          <Image src={cmaPdfImageUrl(comp.photo_url)} style={{ width: '100%', height: compPhotoHeight, objectFit: 'cover', borderRadius: 12, backgroundColor: '#F3F4F6' }} />
        ) : (
          <View style={{ width: '100%', height: compPhotoHeight, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, color: COLORS.white, fontWeight: 900 }}>Comparable Property</Text>
          </View>
        )}
        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: COMP_STATUS_HEX[comp.status] || '#374151', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 }}>
          <Text style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#FFFFFF' }}>{COMP_STATUS_LABEL[comp.status] || comp.status}</Text>
        </View>
        {/* White pill / black price (not the reverse) - saves ink across a multi-page PDF with a
            price badge on every comp photo. */}
        <View style={{ position: 'absolute', left: 12, bottom: 12, backgroundColor: COLORS.white, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, border: '1 solid rgba(0,0,0,0.08)' }}>
          <Text style={{ fontSize: 18, fontFamily: 'Montserrat', fontWeight: 900, color: COLORS.text }}>{formatMoney(compDisplayPrice(comp).value)}</Text>
          {psf && <Text style={{ fontSize: 7, color: COLORS.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>${psf}/sqft</Text>}
        </View>
      </View>

      {/* Side by side, half-width each, when there's a quality rating to show - stats on the
          left, Strength & Quality on the right. marginTop: -8 on the right column cancels
          CmaComparableQualitySection's own marginTop so the two boxes' top edges line up. Falls
          back to the stats panel alone at full width when there's nothing to rate yet. */}
      {hasQuality ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <CmaSubjectStatsPanel stats={compFacts} standalone columns={3} />
          </View>
          <View style={{ flex: 1, marginTop: -8 }}>
            <CmaComparableQualitySection comp={comp} />
          </View>
        </View>
      ) : (
        <CmaSubjectStatsPanel stats={compFacts} standalone />
      )}

      {note && (
        <View style={{ marginTop: 8, backgroundColor: COLORS.white, borderRadius: 10, padding: isLongNote ? 11 : 13, border: `1 solid ${COLORS.border}`, borderTop: '3 solid #C9A24D' }}>
          <Text style={{ fontSize: 8.4, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.1, color: COLORS.text, marginBottom: 6 }}>Comparable Analysis</Text>
          <Text style={{ fontSize: isLongNote ? 8.4 : 9.2, lineHeight: isLongNote ? 1.35 : 1.45, color: COLORS.text }}>{note}</Text>
        </View>
      )}
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaBarChart({ title, subjectLabel, subjectValue, bars, formatValue }: {
  title: string; subjectLabel?: string; subjectValue?: number | null; bars: { label: string; value: number }[]; formatValue: (v: number) => string;
}) {
  const max = Math.max(...bars.map(b => b.value), subjectValue || 0, 1);
  return (
    <View style={cma.chartCard}>
      <Text style={cma.chartTitle}>{title}</Text>
      {subjectValue != null && (
        <View style={cma.barRow}>
          <Text style={[cma.barLabel, { color: '#C9A24D' }]}>{subjectLabel || 'Subject'}</Text>
          <View style={cma.barTrack}><View style={[cma.barFill, { width: `${(subjectValue / max) * 100}%`, backgroundColor: COLORS.text }]} /></View>
          <Text style={cma.barValue}>{formatValue(subjectValue)}</Text>
        </View>
      )}
      {bars.map(b => (
        <View key={b.label} style={cma.barRow}>
          <Text style={cma.barLabel}>{b.label}</Text>
          <View style={cma.barTrack}><View style={[cma.barFill, { width: `${(b.value / max) * 100}%` }]} /></View>
          <Text style={cma.barValue}>{b.value ? formatValue(b.value) : '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function CmaChartsPage({ report, comparables, agent }: { report: CmaReport; comparables: CmaComparable[]; agent: CmaPdfAgent }) {
  const psfBars = comparables.map((c, i) => ({ label: `#${i + 1}`, value: pricePerSqft(effectiveCompPrice(c) ?? compDisplayPrice(c).value, c.sqft) ?? 0 }));
  const saleBars = comparables.map((c, i) => ({ label: `#${i + 1}`, value: effectiveCompPrice(c) ?? compDisplayPrice(c).value ?? 0 }));
  const subjectPsf = report.subject.list_price && report.subject.sqft ? pricePerSqft(report.subject.list_price, report.subject.sqft) : null;
  // Authoritative backend stats (ai_estimate.comp_stats) when present; computeMarketMetrics only
  // as the fallback for pre-comp_stats reports. metricsWeighted === metricsAll (the "weighted"
  // pool is the same valuation-comp set) - kept as an alias so the labels below don't change.
  const metricsAll = resolveCmaMarketMetrics(comparables, report.pricing.ai_estimate);
  const metricsWeighted = metricsAll;
  // See CmaChartsPageV2: no aggregate stats => no page (never a grid of dashes for the client).
  if (!metricsAll.enoughForStats) return null;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Bringing It Together" title="Market Analysis" subtitle="What the most comparable homes sold for" />
      <View style={cma.marketStatsPanel}>
        <Text style={{ fontSize: 6.4, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8b7355', marginBottom: 5 }}>
          {`Based on the ${metricsAll.count} most comparable ${metricsAll.count === 1 ? 'sale' : 'sales'} near ${report.subject.street_address || 'this home'}`}
        </Text>
        <View style={cma.marketStatsGrid}>
          <CmaMarketFact label="Typical Comparable Sale" value={formatMoney(metricsAll.saleMedian ?? metricsAll.saleAvg, { compact: true })} />
          <CmaMarketFact label="Typical Price Per Sq Ft" value={(metricsAll.psfMedian ?? metricsAll.psfAvg) != null ? `$${Math.round((metricsAll.psfMedian ?? metricsAll.psfAvg) as number)}` : '-'} />
        </View>
      </View>
      <View style={{ height: 18 }} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: '49%', marginRight: '2%' }}>
          <CmaBarChart title="Price Per Square Foot" subjectLabel="Subj." subjectValue={subjectPsf} bars={psfBars} formatValue={v => `$${v}`} />
        </View>
        <View style={{ width: '49%' }}>
          <CmaBarChart title="Comparable Sale Prices" subjectLabel="Subj." subjectValue={report.subject.list_price} bars={saleBars} formatValue={v => formatMoney(v, { compact: true })} />
        </View>
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaChartsPageV2({ report, comparables, agent }: { report: CmaReport; comparables: CmaComparable[]; agent: CmaPdfAgent }) {
  const psfBars = comparables.map((c, i) => ({ label: `#${i + 1}`, value: pricePerSqft(effectiveCompPrice(c) ?? compDisplayPrice(c).value, c.sqft) ?? 0 }));
  const saleBars = comparables.map((c, i) => ({ label: `#${i + 1}`, value: effectiveCompPrice(c) ?? compDisplayPrice(c).value ?? 0 }));
  const subjectPsf = report.subject.list_price && report.subject.sqft ? pricePerSqft(report.subject.list_price, report.subject.sqft) : null;
  // Authoritative backend stats (ai_estimate.comp_stats) when present; computeMarketMetrics only
  // as the fallback for pre-comp_stats reports. metricsWeighted === metricsAll (the "weighted"
  // pool is the same valuation-comp set) - kept as an alias so the labels below don't change.
  const metricsAll = resolveCmaMarketMetrics(comparables, report.pricing.ai_estimate);
  const metricsWeighted = metricsAll;
  // Aggregate-stats-only page. Without enough verified local Strong/Supporting sales there are no
  // real ranges or averages to show - drop the whole page rather than print a grid of dashes and
  // empty bar charts to the client. The valuation reasoning still lives on the Final Analysis page.
  if (!metricsAll.enoughForStats) return null;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Bringing It Together" title="Market Analysis" subtitle="What the most comparable homes sold for" />
      <View style={cma.marketStatsPanel}>
        <Text style={{ fontSize: 6.4, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8b7355', marginBottom: 5 }}>
          {`Based on the ${metricsAll.count} most comparable ${metricsAll.count === 1 ? 'sale' : 'sales'} near ${report.subject.street_address || 'this home'}`}
        </Text>
        <View style={cma.marketStatsGrid}>
          <CmaMarketFact label="Typical Comparable Sale" value={formatMoney(metricsAll.saleMedian ?? metricsAll.saleAvg, { compact: true })} />
          <CmaMarketFact label="Typical Price Per Sq Ft" value={(metricsAll.psfMedian ?? metricsAll.psfAvg) != null ? `$${Math.round((metricsAll.psfMedian ?? metricsAll.psfAvg) as number)}` : '-'} />
        </View>
      </View>
      <View style={{ height: 14 }} />
      <View style={cma.chartGrid}>
        <CmaBarChart title="Price Per Square Foot" subjectLabel="Subj." subjectValue={subjectPsf} bars={psfBars} formatValue={v => `$${v}`} />
        <CmaBarChart title="Comparable Sale Prices" subjectLabel="Subj." subjectValue={report.subject.list_price} bars={saleBars} formatValue={v => formatMoney(v, { compact: true })} />
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaPricingPage({ report, comparables, agent }: { report: CmaReport; comparables: CmaComparable[]; agent: CmaPdfAgent }) {
  // The backend's locked final valuation is authoritative; legacy fields only support old reports.
  const aiEstimate = report.pricing.ai_estimate;
  const finalValuation = aiEstimate?.final_valuation;
  const offerFields = aiEstimate?.offer_strategy_fields;
  const authoritativeValue = finalValuation?.value ?? aiEstimate?.value ?? null;
  const suggested = {
    min: finalValuation?.range_min ?? aiEstimate?.range_min ?? null,
    max: finalValuation?.range_max ?? aiEstimate?.range_max ?? null,
  };
  const isBuyer = report.mode === 'buyer';
  const headline = isBuyer
    ? (authoritativeValue != null ? formatMoney(authoritativeValue) : formatMoney(report.pricing.estimated_fair_value))
    : (suggested.min != null && suggested.max != null
        ? formatMoneyRange(suggested.min, suggested.max)
        : formatMoneyRange(report.pricing.recommended_min, report.pricing.recommended_max));
  const authoritativeCommentary = aiEstimate?.methodology_summary
    ?? (isBuyer ? report.pricing.offer_strategy_commentary : report.pricing.pricing_commentary);
  const commentarySections = cmaGuidanceSections(authoritativeCommentary);

  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Agent Final Analysis" title={isBuyer ? 'Estimated Fair Market Value' : 'Recommended Value'} subtitle={isBuyer ? 'Buyer valuation and offer guidance' : 'Pricing analysis and list-price guidance'} />
      <View style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 18, marginBottom: 16, border: `1 solid ${COLORS.border}`, borderTop: '4 solid #C9A24D' }}>
        <Text style={{ fontSize: 8, color: '#8b7355', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>
          {isBuyer ? 'Estimated Fair Market Value' : 'Recommended Value'}
        </Text>
        <Text style={{ fontSize: 30, fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.text, marginBottom: 14 }}>{headline}</Text>
        {/* qa_flags are an internal reconciliation log - never printed in the client PDF.
            Contradictions are resolved before render (see cma_ai_service.py).
            Valuation Confidence and the "Why This Number" comp-by-comp $/sqft breakdown are
            intentionally left off the client PDF - internal working, not client-facing. */}
        <View style={{ borderTop: `1 solid ${COLORS.line}`, paddingTop: 12 }}>
        <View style={cma.factsGrid}>
          {isBuyer ? (
            <>
              <CmaFact label="Suggested Offer Min" value={(offerFields?.opening_offer_low ?? report.pricing.suggested_offer_min) ? formatMoney(offerFields?.opening_offer_low ?? report.pricing.suggested_offer_min) : null} />
              <CmaFact label="Suggested Offer Max" value={(offerFields?.opening_offer_high ?? report.pricing.suggested_offer_max) ? formatMoney(offerFields?.opening_offer_high ?? report.pricing.suggested_offer_max) : null} />
              <CmaFact label="Strong Offer" value={(offerFields?.strong_offer ?? report.pricing.strong_offer) ? formatMoney(offerFields?.strong_offer ?? report.pricing.strong_offer) : null} />
            </>
          ) : (
            <>
              <CmaFact label="Most Likely Value" value={report.pricing.most_likely_value ? formatMoney(report.pricing.most_likely_value) : null} />
              <CmaFact label="Recommended List Price" value={report.pricing.recommended_list_price ? formatMoney(report.pricing.recommended_list_price) : null} />
            </>
          )}
        </View>
        </View>
      </View>

      {commentarySections.length > 0 && (
        <View style={{ marginTop: 4, backgroundColor: COLORS.white, borderRadius: 10, padding: 16, border: `1 solid ${COLORS.border}` }}>
          <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#C9A24D', marginBottom: 8 }}>
            {isBuyer ? 'Buyer Valuation Notes' : 'Agent Pricing Analysis'}
          </Text>
          <CmaGuidanceSections sections={commentarySections} />
        </View>
      )}

      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaOfferSuggestionPage({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) {
  const aiEstimate = report.pricing.ai_estimate;
  const offerFields = aiEstimate?.offer_strategy_fields;
  const guidance = splitCmaBuyerGuidance({
    ...report.pricing,
    offer_strategy_commentary: aiEstimate?.methodology_summary ?? report.pricing.offer_strategy_commentary,
    offer_suggestion_notes: aiEstimate?.offer_strategy_considerations ?? report.pricing.offer_suggestion_notes,
  });
  if (report.mode !== 'buyer' || !guidance.offerText) return null;
  const authoritativeValue = aiEstimate?.final_valuation?.value
    ?? aiEstimate?.value
    ?? report.pricing.estimated_fair_value;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Buyer Strategy" title="Offer Suggestion" subtitle="Suggested positioning and negotiating approach" />
      <View style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 18, border: `1 solid ${COLORS.border}`, borderTop: '4 solid #C9A24D' }}>
        <View style={cma.offerStatsRow}>
          <CmaOfferFact label="Fair Market Value" value={authoritativeValue ? formatMoney(authoritativeValue) : null} />
          <CmaOfferFact label="Suggested Offer Min" value={(offerFields?.opening_offer_low ?? report.pricing.suggested_offer_min) ? formatMoney(offerFields?.opening_offer_low ?? report.pricing.suggested_offer_min) : null} />
          <CmaOfferFact label="Suggested Offer Max" value={(offerFields?.opening_offer_high ?? report.pricing.suggested_offer_max) ? formatMoney(offerFields?.opening_offer_high ?? report.pricing.suggested_offer_max) : null} />
          <CmaOfferFact label="Strong Offer" value={(offerFields?.strong_offer ?? report.pricing.strong_offer) ? formatMoney(offerFields?.strong_offer ?? report.pricing.strong_offer) : null} />
        </View>
        <View style={{ backgroundColor: COLORS.panel, borderRadius: 12, border: `1 solid ${COLORS.border}`, padding: 17 }}>
          <Text style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, color: '#8b7355', marginBottom: 9 }}>
            Agent Offer Guidance
          </Text>
          <CmaGuidanceSections sections={guidance.offerSections} />
        </View>
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaInspectionConcernsPage({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) {
  const guidance = splitCmaBuyerGuidance(report.pricing);
  if (report.mode !== 'buyer' || !guidance.inspectionText) return null;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Buyer Due Diligence" title="Inspection Concerns" subtitle="Property condition, utility, and systems items to verify before closing" />
      <View style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 18, border: `1 solid ${COLORS.border}`, borderTop: '4 solid #C9A24D' }}>
        <CmaGuidanceSections sections={guidance.inspectionSections} />
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

// Seller/listing mirror of CmaOfferSuggestionPage: same layout, the seller's own numbers.
function CmaPricingStrategyPage({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) {
  const sections = cmaGuidanceSections(report.pricing.listing_strategy_notes);
  if (report.mode === 'buyer' || sections.length === 0) return null;
  const aiEstimate = report.pricing.ai_estimate;
  const rangeMin = aiEstimate?.final_valuation?.range_min ?? aiEstimate?.range_min ?? report.pricing.recommended_min;
  const rangeMax = aiEstimate?.final_valuation?.range_max ?? aiEstimate?.range_max ?? report.pricing.recommended_max;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Seller Strategy" title="Pricing Strategy" subtitle="Where to set the list price and how to position the home" />
      <View style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 18, border: `1 solid ${COLORS.border}`, borderTop: '4 solid #C9A24D' }}>
        <View style={cma.offerStatsRow}>
          <CmaOfferFact label="Recommended List Price" value={report.pricing.recommended_list_price ? formatMoney(report.pricing.recommended_list_price) : null} />
          <CmaOfferFact label="Most Likely Value" value={report.pricing.most_likely_value ? formatMoney(report.pricing.most_likely_value) : null} />
          <CmaOfferFact label="Supported Range" value={rangeMin && rangeMax ? formatMoneyRange(rangeMin, rangeMax) : null} />
        </View>
        <View style={{ backgroundColor: COLORS.panel, borderRadius: 12, border: `1 solid ${COLORS.border}`, padding: 17 }}>
          <Text style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, color: '#8b7355', marginBottom: 9 }}>
            Agent Listing Guidance
          </Text>
          <CmaGuidanceSections sections={sections} />
        </View>
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

// Seller/listing mirror of CmaInspectionConcernsPage.
function CmaListingPrepPage({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) {
  const sections = cmaGuidanceSections(report.pricing.listing_prep_notes);
  if (report.mode === 'buyer' || sections.length === 0) return null;
  return (
    <Page size="LETTER" style={cma.page}>
      <CmaPdfHeader label="Seller Preparation" title="Listing Prep" subtitle="What to address, document, or disclose before going on the market" />
      <View style={{ backgroundColor: COLORS.white, borderRadius: 14, padding: 18, border: `1 solid ${COLORS.border}`, borderTop: '4 solid #C9A24D' }}>
        <CmaGuidanceSections sections={sections} />
      </View>
      <CmaPageFooter agent={agent} />
    </Page>
  );
}

function CmaBackCoverPage({ agent }: { agent: CmaPdfAgent }) {
  return (
    <Page size="LETTER" style={[cma.coverPage, { justifyContent: 'center', alignItems: 'center' }]}>
      <View style={cma.coverAccentLine} />
      <View style={{ alignItems: 'center', width: '78%', borderTop: `1 solid ${COLORS.line}`, borderBottom: `1 solid ${COLORS.line}`, paddingVertical: 30 }}>
        <CmaAgentAvatar agent={agent} size={70} style={{ marginBottom: 16 }} />
        <Text style={{ fontSize: 24, fontFamily: 'Playfair Display', fontWeight: 900, color: COLORS.text }}>{agent.name}</Text>
        {agent.brokerage && <Text style={{ fontSize: 8, color: '#8b7355', marginTop: 5, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 900 }}>{agent.brokerage}</Text>}
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          {agent.phone && <Text style={{ fontSize: 9, color: COLORS.subtext, marginBottom: 3 }}>{agent.phone}</Text>}
          {agent.email && <Text style={{ fontSize: 9, color: COLORS.subtext, marginBottom: 3 }}>{agent.email}</Text>}
          {agent.service_area && (
            <Text style={{ fontSize: 8, color: COLORS.subtext, marginTop: 3, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 700 }}>
              Serving {agent.service_area}
            </Text>
          )}
        </View>
      </View>
    </Page>
  );
}

export const CmaPresentationDocument = ({ report, agent }: { report: CmaReport; agent: CmaPdfAgent }) => {
  const hidden = new Set(report.presentation?.hidden_sections || []);
  const hiddenCompIds = new Set(report.presentation?.hidden_comp_ids || []);
  const comparables = sortComparables(report.comparables).filter(c => c.is_included && !hiddenCompIds.has(c.id));

  // Tells one story in order: here is your property -> here's where the comps sit -> here's my
  // take on each one -> here's how they compare side-by-side -> here's what the market says ->
  // here's my final professional opinion.
  return (
    <Document>
      <CmaCoverPage report={report} agent={agent} />
      {!hidden.has('location') && comparables.length > 0 && <CmaLocationPage report={report} comparables={comparables} agent={agent} />}
      {!hidden.has('comparables') && comparables.map((c, i) => <CmaComparablePage key={c.id} comp={c} index={i} agent={agent} />)}
      {!hidden.has('comparison_table') && comparables.length > 0 && <CmaComparisonTablePage report={report} comparables={comparables} agent={agent} />}
      {!hidden.has('market_context') && <CmaMarketSnapshotPage report={report} agent={agent} />}
      {!hidden.has('charts') && comparables.length > 0 && <CmaChartsPageV2 report={report} comparables={comparables} agent={agent} />}
      {!hidden.has('pricing') && <CmaPricingPage report={report} comparables={comparables} agent={agent} />}
      {!hidden.has('pricing') && <CmaInspectionConcernsPage report={report} agent={agent} />}
      {!hidden.has('pricing') && <CmaOfferSuggestionPage report={report} agent={agent} />}
      {!hidden.has('pricing') && <CmaPricingStrategyPage report={report} agent={agent} />}
      {!hidden.has('pricing') && <CmaListingPrepPage report={report} agent={agent} />}
      <CmaBackCoverPage agent={agent} />
    </Document>
  );
};
